"use client";

import { useCallback, useEffect, useState } from "react";
import { api, get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";

// ─────────────────────────────────────────────────────────────────────────
// Tenant settings — the store behind Setup & features.
//
// Everything here is one provider's answer to "how do we run?", and none of
// it belongs in code. The rule for what lands in this file: if two real UK
// providers would reasonably disagree, it is a setting; if disagreeing would
// break the product or the law, it is not.
//
// Storage is the existing `libraries/{tenantId}` doc rather than a new
// collection — it is already tenant-scoped, already operator-write-only,
// already on the realtime channel, and already read by every screen that
// needs this. Two keys: `settings` for the flat bag, `childQuestions` for the
// list that will grow.
// ─────────────────────────────────────────────────────────────────────────

export type QuestionType = "text" | "choice" | "yesno";

/** Used when a text question doesn't set its own limit. */
export const DEFAULT_QUESTION_LENGTH = 300;

export interface ChildQuestion {
  id: string;
  /** What the parent is asked — "Can your child swim?". */
  label: string;
  type: QuestionType;
  /** For "choice" only. */
  options?: string[];
  /**
   * For "text" only — how much a family may write. Per question rather than
   * one global number: "any nickname they answer to" wants a line, "what a
   * new coach should know before day one" wants a paragraph, and a single
   * limit makes one of them useless.
   */
  maxLength?: number;
  /**
   * When it's asked.
   *
   * "once" (the default) asks while the child is being set up and never
   * again — the answer sticks to the child and rides along on every booking
   * after. Right for anything stable: dietary needs, swimming ability.
   *
   * "every" re-asks on each new booking, because the answer goes stale —
   * "any injuries we should know about?" is true in March and wrong by
   * August. The answer refreshes the one on the child record, so what staff
   * read is always the latest.
   */
  ask?: "once" | "every";
  /** Shown under the field — where a provider explains why they're asking. */
  help?: string;
  required?: boolean;
  /**
   * Which listings ask it. "all" is the default and the common case; an array
   * of listing ids restricts it — a swim school's water-confidence question
   * has no business on their multi-sports camp.
   */
  scope: "all" | string[];
  /**
   * Only ask about a child of this age. Either end may be left open.
   *
   * The age is worked out from the child's date of birth every time the
   * question is rendered — never stored — so a child moves into and out of a
   * question's range on their own birthday, with nothing to update. "May they
   * walk home alone?" set to 8+ starts being asked the first time a family
   * books after the child turns 8.
   *
   * A child with no date of birth yet is asked nothing age-gated: we don't
   * know their age, and guessing on a walk-home question is not a guess worth
   * making.
   */
  minAge?: number;
  maxAge?: number;
  /**
   * Stop asking, but keep every answer already given. Deleting a question a
   * hundred families have answered throws that away; hiding is what an
   * operator almost always actually means, so it is the prominent control and
   * delete is the buried one.
   */
  hidden?: boolean;
  /**
   * For the seeded six only: the typed field on the child record that this
   * question supersedes. Documentation for the migration, NOT a storage key —
   * every answer stores under the question's id in `answers`.
   *
   * Storing under the old names would collide with their types: `swimming` is
   * an enum of four values and the three consents are booleans, so a
   * free-text or renamed-option answer would be rejected by the child schema.
   * Once a provider renames "Swimming ability" or adds a fifth option, the
   * enum is wrong anyway — which is the whole reason these stopped being
   * columns.
   */
  replaces?: string;
}

export interface PipelineStage {
  id: string;
  label: string;
  hint: string;
  colour: string;
}

export interface TenantSettings {
  // ── People & safeguarding ──
  /** Every child needs a date of birth before the record can be saved. */
  requireDob: boolean;
  /**
   * Ask a child's gender at checkout.
   *
   * The stored field on the child record is still `sex` — it predates this
   * and is in the server schema — but nothing a parent or operator reads
   * says that word.
   */
  collectGender: boolean;
  genderOptions: string[];
  collectPhoto: boolean;
  /**
   * Whether to ask permission to use photos OF the child — in a newsletter,
   * on your website. Separate from collectPhoto, which is the parent
   * uploading a face so staff recognise them at collection. A family can
   * easily want the second and refuse the first.
   */
  askPhotoConsent: boolean;
  /** The SEND / additional-needs question itself. */
  collectSend: boolean;
  /**
   * The EHCP / SEND plan upload, offered once a family says there are needs.
   *
   * Split from collectSend because they are different asks with different
   * weights: one is a sentence a parent types, the other is a formal document
   * they have to find, and holding a copy of it is a data-protection decision
   * a provider should make on purpose. Asking about needs without wanting the
   * paperwork is a perfectly normal position.
   */
  collectSendPlan: boolean;
  emergencyContacts: number;
  collectionCheck: "off" | "pin" | "password";
  /** Longest a parent may write in each free-text child field. */
  charLimits: { allergies: number; medical: number; send: number; likes: number; dislikes: number };

  // ── Bookings & payments ──
  payMethods: string[];
  cancellationReasons: string[];

  // ── Listings ──
  cancellationPolicies: string[];
  defaultCapacity: number;
  defaultRunningDays: number[];
  /** Show "only N places left" at or below this many. 0 turns it off. */
  lowPlacesAt: number;
  showSpaces: boolean;

  // ── Families ──
  pipelineStages: PipelineStage[];
  /** Bookings before a family counts as "repeat". */
  repeatAt: number;
}

// The fields that shipped as fixed columns on the child record, restated as
// questions. Seeded only when a provider has never opened Setup, so nothing
// changes underneath anyone — but unlike the old columns, every one can now
// be renamed, reordered, scoped to some listings, hidden or deleted.
//
// Five of the six, not all six: "care & behaviour notes" is deliberately not
// seeded. It asked the same question as the built-in likes & dislikes pair,
// whose own help text already says "what settles them and what doesn't" — so
// a parent would have written the same answer twice, and staff would have had
// to read both to be sure they had it. The server's `careNotes` field is
// consequently unused; a provider who wants it back adds their own question.
export const SEEDED_QUESTIONS: ChildQuestion[] = [
  {
    id: "q-dietary",
    label: "Dietary requirements",
    type: "text",
    help: "Separate from allergies — vegetarian, halal, no pork.",
    scope: "all",
    replaces: "dietary",
  },
  {
    id: "q-swimming",
    label: "Swimming ability",
    type: "choice",
    options: ["Non-swimmer", "Weak", "Confident", "Strong"],
    scope: "all",
    replaces: "swimming",
  },
  { id: "q-suncream", label: "May we apply sun cream?", type: "yesno", scope: "all", replaces: "suncreamConsent" },
  { id: "q-firstaid", label: "May we give first aid?", type: "yesno", scope: "all", replaces: "firstAidConsent" },
  {
    id: "q-walkhome",
    label: "May they walk home alone?",
    type: "yesno",
    help: "Asked only about children old enough — set the age in Setup & features.",
    scope: "all",
    // Deliberately conservative. A provider who lets younger children walk
    // home can lower it; one who never does can hide the question. What must
    // not happen is the product asking a parent of a five-year-old whether
    // they may walk home alone.
    minAge: 8,
    replaces: "walkHomeConsent",
  },
];

export const DEFAULT_SETTINGS: TenantSettings = {
  requireDob: true,
  collectGender: true,
  genderOptions: ["Boy", "Girl", "Prefer not to say"],
  collectPhoto: true,
  askPhotoConsent: true,
  collectSend: true,
  collectSendPlan: true,
  emergencyContacts: 1,
  collectionCheck: "password",
  charLimits: { allergies: 140, medical: 140, send: 200, likes: 80, dislikes: 80 },

  payMethods: ["Card", "Bank transfer", "Tax-Free Childcare", "Childcare vouchers", "HAF (funded £0)", "Cash on the day"],
  cancellationReasons: ["Illness", "Weather", "Staffing", "Venue unavailable", "Parent request", "Duplicate booking"],

  cancellationPolicies: [
    "No refunds are given except in the case of a cancellation by the organiser.",
    "Refunds are not generally available, but may be considered with sufficient notice.",
    "Cancel at least 24 hours before the session for a full refund.",
    "Cancel at least 48 hours before the session for a full refund.",
    "Cancel more than one week before the session for a full refund.",
    "Cancel more than two weeks before the session for a full refund.",
  ],
  defaultCapacity: 60,
  defaultRunningDays: [1, 2, 3, 4, 5],
  lowPlacesAt: 5,
  showSpaces: true,

  pipelineStages: [
    { id: "lead", label: "Lead", hint: "Enquired, never booked, not invited yet", colour: "#e22295" },
    { id: "invited", label: "Invited", hint: "Sent a sign-up link, hasn't booked yet", colour: "#2f6bd8" },
    { id: "customer", label: "Customer", hint: "Booked with you once", colour: "#15b364" },
    { id: "repeat", label: "Repeat", hint: "Booked more than once — they came back", colour: "#6a4fd0" },
  ],
  repeatAt: 2,
};

/**
 * Fill in anything a stored settings object is missing.
 *
 * Every provider whose library predates a new setting has to get the default
 * for it, and a partially-stored object must not leave a screen reading
 * `undefined` where it expects a number. Nested objects merge one level down
 * so adding a field to `charLimits` doesn't blank the others.
 */
export function withDefaults(stored: Partial<TenantSettings> | null | undefined): TenantSettings {
  const s = stored ?? {};
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    charLimits: { ...DEFAULT_SETTINGS.charLimits, ...(s.charLimits ?? {}) },
    pipelineStages: s.pipelineStages?.length ? s.pipelineStages : DEFAULT_SETTINGS.pipelineStages,
    payMethods: s.payMethods?.length ? s.payMethods : DEFAULT_SETTINGS.payMethods,
    genderOptions: s.genderOptions?.length ? s.genderOptions : DEFAULT_SETTINGS.genderOptions,
  };
}

/**
 * The questions actually asked about one child — the hide, listing-scope and
 * age rules applied together.
 *
 * `age` is the child's age at the moment that matters, which the caller
 * decides: the checkout passes their age on the listing's first day, matching
 * the age gate that already decides whether they can attend at all. Pass null
 * when there's no date of birth to work it out from.
 */
export function questionsFor(
  all: ChildQuestion[],
  listingId?: string,
  age?: number | null,
): ChildQuestion[] {
  return all.filter((q) => {
    if (q.hidden) return false;

    const ageGated = q.minAge !== undefined || q.maxAge !== undefined;
    if (ageGated) {
      // No date of birth yet — ask nothing age-gated rather than guess.
      if (age === null || age === undefined) return false;
      if (q.minAge !== undefined && age < q.minAge) return false;
      if (q.maxAge !== undefined && age > q.maxAge) return false;
    }

    if (q.scope === "all") return true;
    // A scoped question with no listing in hand (the Families screen, an
    // export) still shows: hiding a child's swimming ability from staff
    // because we don't know which listing they're looking at is worse than
    // showing one question too many.
    return !listingId || q.scope.includes(listingId);
  });
}

/**
 * Whether a date of birth is compulsory — and why, when the provider didn't
 * choose it directly.
 *
 * Age-gating a question makes the date of birth compulsory whatever the
 * setting says. Without one there is no age, and without an age an age-gated
 * question is never asked: a provider who set "may they walk home alone?" to
 * 8+ and then made date of birth optional would have quietly switched that
 * question off for every child, while the setting still read 8+.
 *
 * So the two settings aren't independent. Rather than let them contradict
 * each other silently, the age gate wins and the Setup screen says why.
 */
export function dobRequired(
  settings: TenantSettings,
  questions: ChildQuestion[],
): { required: boolean; forcedBy: ChildQuestion[] } {
  const forcedBy = questions.filter((q) => !q.hidden && (q.minAge !== undefined || q.maxAge !== undefined));
  return { required: settings.requireDob || forcedBy.length > 0, forcedBy };
}

/**
 * Where a question's answer lives — always `answers[id]` on the child record.
 * A function rather than inlining `q.id` so there is one place to change if
 * answers ever move.
 */
/**
 * How long a built-in child field may be.
 *
 * The five a provider can set live in settings; the rest (collection
 * password, emergency name and number) have no control yet and fall back to
 * the compiled-in default, so this never returns undefined.
 */
export function limitFor(
  settings: TenantSettings,
  field: string,
  fallback: Record<string, number>,
): number {
  const tuned = (settings.charLimits as Record<string, number | undefined>)[field];
  return tuned ?? fallback[field] ?? DEFAULT_QUESTION_LENGTH;
}

/** Questions re-asked on every booking, rather than once when set up. */
export const asksEveryBooking = (q: ChildQuestion) => q.ask === "every";

export const answerKey = (q: ChildQuestion): string => q.id;

type LibraryShape = { settings?: Partial<TenantSettings>; childQuestions?: ChildQuestion[] };

export interface SettingsState {
  settings: TenantSettings;
  questions: ChildQuestion[];
  loading: boolean;
  /** Saves immediately — Setup has no Save button by design (see SetupApp). */
  save: (patch: { settings?: TenantSettings; questions?: ChildQuestion[] }) => Promise<void>;
  error: string | null;
}

export function useSettings(): SettingsState {
  const [settings, setSettings] = useState<TenantSettings>(DEFAULT_SETTINGS);
  const [questions, setQuestions] = useState<ChildQuestion[]>(SEEDED_QUESTIONS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      apiGet<LibraryShape | null>("/api/library").then(
        (lib) => {
          setSettings(withDefaults(lib?.settings));
          // An empty array is a real answer — the provider deleted every
          // question. Only an absent key means "never set up", which seeds
          // the six that shipped as fixed columns.
          setQuestions(lib?.childQuestions ?? SEEDED_QUESTIONS);
          setError(null);
          setLoading(false);
        },
        (e: unknown) => {
          setError(e instanceof Error ? e.message : "Couldn't load your settings");
          setLoading(false);
        },
      ),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);
  useRealtime(["library"], () => void load());

  const save = useCallback(
    async ({ settings: next, questions: nextQ }: { settings?: TenantSettings; questions?: ChildQuestion[] }) => {
      // Optimistic: a toggle that waits for a round-trip before moving feels
      // broken, and this screen is nothing but toggles.
      if (next) setSettings(next);
      if (nextQ) setQuestions(nextQ);
      const body: LibraryShape = {};
      if (next) body.settings = next;
      if (nextQ) body.childQuestions = nextQ;
      try {
        await api("/api/library", { method: "PUT", body: JSON.stringify(body) });
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save — your change may not have stuck");
        void load(); // put the UI back to what's actually stored
      }
    },
    [load],
  );

  return { settings, questions, loading, save, error };
}

/**
 * Read-only settings for the screens that consume them (checkout, Families,
 * Bookings) rather than edit them. Falls back to the defaults on any error:
 * a parent must never be blocked from booking because a settings fetch failed.
 */
export function useTenantSettings(): { settings: TenantSettings; questions: ChildQuestion[]; ready: boolean } {
  const [state, setState] = useState<{ settings: TenantSettings; questions: ChildQuestion[]; ready: boolean }>({
    settings: DEFAULT_SETTINGS,
    questions: SEEDED_QUESTIONS,
    ready: false,
  });

  useEffect(() => {
    let live = true;
    apiGet<LibraryShape | null>("/api/library")
      .then((lib) => {
        if (!live) return;
        setState({
          settings: withDefaults(lib?.settings),
          questions: lib?.childQuestions ?? SEEDED_QUESTIONS,
          ready: true,
        });
      })
      .catch(() => live && setState((s) => ({ ...s, ready: true })));
    return () => {
      live = false;
    };
  }, []);

  return state;
}
