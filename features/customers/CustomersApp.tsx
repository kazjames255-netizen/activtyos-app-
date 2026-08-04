"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, get as apiGet, post as apiPost, openFile } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Button, Card, FieldLabel, Input } from "@/components/ui";
import { PageHero } from "@/components/OperatorPage";
import { Pill, PillSelect } from "@/features/listings/FreelancerListingsApp";
import { bookingKids, sessionIsoDates } from "@/features/bookings/helpers";
import { uploadPlan } from "@/features/listings/planUpload";
import { CHILD_LIMITS, ageOn } from "@/features/listings/checkout";
import { HowItWorks } from "@/components/HowItWorks";
import { useTenantSettings, questionsFor, dobRequired, limitFor } from "@/lib/settings";
import { QuestionFields } from "@/components/QuestionFields";

/**
 * A child's age, worked out from their date of birth rather than stored.
 *
 * A typed age is right for a year and wrong for ever after — a five-year-old
 * entered in 2026 is still five in 2031, on a register used to check they're
 * in the right group. Date of birth is the fact; age is a view of it. The
 * stored `age` is only a fallback for records that predate this.
 */
const ageOf = (c: { dob?: string; age?: number }): number | null =>
  ageOn(c.dob, new Date().toISOString().slice(0, 10)) ?? (c.age ?? null);
import { FamiliesExport, type FamilyRow } from "./FamiliesExport";
import { FamilyImport } from "./FamilyImport";
import type { Booking } from "@/features/bookings/types";

// ─────────────────────────────────────────────────────────────────────────
// Leads & customers — the tenant's parent records. SELF-FILLING: every
// booking (taken or self-served) upserts the family server-side, so this
// page grows on its own; the form below covers the manual cases (a family
// phoning before their first booking, fixing a record). Staff see it
// read-only. Deliberately simple — a richer version is a UI milestone.
// ─────────────────────────────────────────────────────────────────────────

interface Child {
  name: string;
  age?: number;
  dob?: string;
  // Care details — present on linked/operator records, blank on thin
  // booking-only ones (hence the "not visible" note only when all are absent).
  allergies?: string;
  medical?: string;
  dietary?: string;
  send?: string;
  /** The provider's own copy of a SEND plan, emailed to them by the family. */
  sendPlanId?: string;
  sendPlanName?: string;
  collectionPassword?: string;
  photoConsent?: boolean;
  emergencyName?: string;
  emergencyPhone?: string;
  likes?: string;
  dislikes?: string;
  /** The parent's own photo of them, shown on the register once linked. */
  photo?: string;
}
interface Customer {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  locationId?: string;
  locationName?: string;
  marketingOptIn?: boolean;
  marketingOptInAt?: string;
  notes?: string;
  children?: Child[];
  /** Set once they've been invited to set a password. */
  invitedAt?: string;
  /** Set the first time they actually sign in (accepted the invite / joined). */
  joinedAt?: string;
}
interface Draft {
  id: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  locationId: string;
  marketingOptIn: boolean;
  /** When consent was first recorded — the PECR audit trail. */
  marketingOptInAt?: string;
  notes: string;
  children: {
    name: string;
    age: string;
    dob: string;
    allergies: string;
    medical: string;
    send: string;
    collectionPassword: string;
    likes: string;
    dislikes: string;
    photoConsent: "" | "yes" | "no";
    emergencyName: string;
    emergencyPhone: string;
    sendPlanId: string;
    sendPlanName: string;
    /** Answers to the provider's own questions, keyed by question id. */
    answers: Record<string, string>;
  }[];
}

const emptyDraft = (): Draft => ({
  id: null, firstName: "", lastName: "", email: "", phone: "",
  locationId: "", marketingOptIn: false, notes: "", children: [],
});

/**
 * Where a family has got to with you. The language a provider uses on the
 * phone — a lead is someone who rang, a customer is someone who booked — so
 * the page says that rather than "customer record".
 *
 * Honest limit: we can see that a sign-up link was *sent*, not that they set
 * a password, so there is no "registered" stage yet. That needs the account
 * link in §K of the backend handoff.
 */
type Stage = "lead" | "invited" | "customer" | "repeat";

/**
 * A funnel, so the four are mutually exclusive and add up to everyone. Repeat
 * sits at the end because it's the one worth growing: a family who books
 * twice is worth several who book once, and it's the only number here that
 * says whether they liked it.
 */
const STAGES: { key: Stage; label: string; hint: string; colour: string }[] = [
  { key: "lead", label: "Lead", hint: "Enquired, never booked, not invited yet", colour: "#e22295" },
  { key: "invited", label: "Invited", hint: "Sent a sign-up link, not signed in yet", colour: "#2f6bd8" },
  { key: "customer", label: "Customer", hint: "Signed up or booked with you", colour: "#3f78d8" },
  { key: "repeat", label: "Repeat", hint: "Booked more than once — they came back", colour: "#6a4fd0" },
];

/**
 * Every way to reach a family, behind one button.
 *
 * The row of Email / WhatsApp buttons grew every time another channel was
 * wanted, and each one was a link the provider might never use. A menu holds
 * as many as we like without the card getting louder — and it can say which
 * ones aren't possible for this family rather than silently hiding them.
 */
/**
 * The second face of a family card. The card slides across to it and back —
 * no overlay, no portal, nothing covering the list.
 *
 * Two earlier attempts sat *on top of* the card: a dropdown (clipped by the
 * card's own overflow, then painted over by the next card down) and a panel
 * in a portal (which escaped the page's palette and came out black). Sliding
 * within the card has neither problem, because it never leaves the card.
 */
function ContactPane({
  email,
  phone,
  name,
  onBack,
}: {
  email?: string;
  phone?: string;
  name: string;
  onBack: () => void;
}) {
  const digits = (phone ?? "").replace(/\D/g, "");
  // A UK mobile typed as 07… won't work on wa.me, which wants the country code.
  const intl = digits.startsWith("0") ? `44${digits.slice(1)}` : digits;
  const usable = digits.length >= 10;

  const item =
    "flex items-center gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[12.5px] font-bold text-[var(--ink)] transition-colors hover:border-[var(--ink-3)]";
  const dead =
    "flex items-center gap-2.5 rounded-xl border border-dashed border-[var(--line)] px-3 py-2 text-[12px] text-[var(--ink-3)]";

  return (
    <div className="flex h-full flex-col p-4 pl-5">
      <div className="mb-2.5 flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-[3px] text-[11.5px] font-bold text-[var(--ink-2)] hover:border-[var(--ink-3)]"
        >
          ← Back
        </button>
        <b className="min-w-0 flex-1 truncate text-[13px] text-[var(--ink)]">Contact {name}</b>
      </div>

      <div className="grid gap-1.5 sm:grid-cols-2">
        {email ? (
          <a href={`mailto:${email}`} className={item}>
            ✉ <span className="min-w-0 flex-1 truncate">Email</span>
          </a>
        ) : (
          <span className={dead}>✉ No email</span>
        )}
        {usable ? (
          <>
            <a href={`https://wa.me/${intl}`} target="_blank" rel="noreferrer" className={item}>
              💬 WhatsApp
            </a>
            <a href={`sms:${phone}`} className={item}>
              📱 Text message
            </a>
            <a href={`tel:${phone}`} className={item}>
              📞 Call
            </a>
          </>
        ) : (
          <span className={dead}>📱 No phone number</span>
        )}
        {email ? (
          <a href={`/freelancer/messages?compose&emails=${encodeURIComponent(email)}&body=${encodeURIComponent(`Hi ${name.split(" ")[0] || "there"},\n\n`)}`} className={item}>
            💌 <span className="min-w-0 flex-1 truncate">Message in app</span>
          </a>
        ) : (
          <span className={dead}>💌 No email for in-app message</span>
        )}
      </div>

      {(email || usable) && (
        <div className="mt-2 truncate text-[10.5px] text-[var(--ink-3)]">
          {[email, phone].filter(Boolean).join(" · ")}
        </div>
      )}
    </div>
  );
}

/** A colour per child within a family, so the tiles are told apart at a glance. */
const KID_TINTS = ["#2f6bd8", "#6a4fd0", "#0b8a4b", "#e22295", "#0ea5e9"];

/** Identifies a child across the two views, so a chip can open their profile. */
const childKey = (familyId: string, name: string) => `${familyId}::${name}`;

/** One line of a child's detail. Declared out here, not inside render. */
function Row({ label, value, wide }: { label: string; value?: string; wide?: boolean }) {
  const v = value?.trim();
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--ink-3)]">
        {label}
      </div>
      {/* Stacked, not label-beside-value: an email in a half-width column
          broke mid-address and wrapped under the next label. */}
      <div className="break-words text-[12px] font-semibold" title={v || undefined}>
        {v || "—"}
      </div>
    </div>
  );
}

/** Existing records hold one `name`; split it so they can still be edited. */
const splitName = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
};

export function CustomersApp() {
  // The provider's own child questions, set in Setup & features. Falls back to
  // the defaults if the fetch fails — a settings blip must not hide fields
  // that staff are relying on.
  const { questions: childQuestions, settings } = useTenantSettings();
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [stage, setStage] = useState<Stage | "">("");
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<"families" | "children">("families");
  const [loc, setLoc] = useState("");
  const [day, setDay] = useState("");
  const [openKid, setOpenKid] = useState<string | null>(null);
  const [contactId, setContactId] = useState<string | null>(null);
  const [kidIdx, setKidIdx] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [canWrite, setCanWrite] = useState(false);
  const [venues, setVenues] = useState<{ id: string; name: string }[]>([]);
  // Bookings and spend per family. Aggregated here from the tenant's own
  // bookings rather than stored on the customer, so it can never go stale or
  // disagree with the Bookings page.
  const [stats, setStats] = useState<Record<string, { n: number; days: string[]; kids: string[] }>>({});

  const refresh = useCallback(() => {
    apiGet<Customer[]>("/api/customers")
      .then((c) => {
        setCustomers(c);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load customers"));
  }, []);
  useEffect(() => {
    refresh();
    apiGet<{ role: string }>("/api/me")
      .then((me) => setCanWrite(["company", "freelancer", "franchise"].includes(me.role)))
      .catch(() => {});
    // The provider's own sites, from the library they already maintain.
    apiGet<{ venues?: { id: string; name: string }[] }>("/api/library")
      .then((lib) => setVenues(lib.venues ?? []))
      .catch(() => {});
    apiGet<Booking[]>("/api/bookings")
      .then((bs) => {
        const by: Record<string, { n: number; days: string[]; kids: string[] }> = {};
        for (const b of bs) {
          const key = (b.email ?? "").trim().toLowerCase();
          // A cancelled booking isn't a booking they made — counting it would
          // put someone who booked once and cancelled into "Repeat".
          if (!key || b.status === "Cancelled") continue;
          const row = (by[key] ??= { n: 0, days: [], kids: [] });
          row.n += 1;
          row.days.push(...sessionIsoDates(b));
          for (const k of bookingKids(b)) {
            const nm = (k.name ?? "").trim().toLowerCase();
            if (nm && !row.kids.includes(nm)) row.kids.push(nm);
          }
        }
        setStats(by);
      })
      .catch(() => {});
  }, [refresh]);
  useRealtime(["customers"], refresh);

  async function save(sendInvite: boolean) {
    if (!draft || !draft.firstName.trim()) return;
    // A child without a date of birth has no reliable age, and age is what
    // decides which group they're in. Named, so it's obvious which one.
    //
    // Whether it's compulsory is the provider's call in Setup — except that
    // an age-gated question overrules them, since it can't be asked without
    // an age. The message says which of the two is stopping them.
    const dobRule = dobRequired(settings, childQuestions);
    const noDob = dobRule.required ? draft.children.filter((k) => k.name.trim() && !k.dob.trim()) : [];
    if (noDob.length) {
      const who = noDob.map((k) => k.name.trim()).join(", ");
      setError(
        dobRule.forcedBy.length && !settings.requireDob
          ? `Add a date of birth for ${who} — “${dobRule.forcedBy[0].label}” is only asked about certain ages, and there's no age without one.`
          : `Add a date of birth for ${who} — their age is worked out from it, so a typed age would be wrong within a year.`,
      );
      return;
    }
    setBusy(true);
    setError(null);
    // `name` stays the composite because every other screen reads it — the
    // parts are stored alongside so "Dear Sarah" is possible in an email.
    const first = draft.firstName.trim();
    const last = draft.lastName.trim();
    const body = {
      name: [first, last].filter(Boolean).join(" "),
      firstName: first,
      lastName: last,
      email: draft.email.trim(),
      phone: draft.phone.trim(),
      locationId: draft.locationId,
      // The name too, so a record still reads properly if a venue is renamed
      // or removed from the library later.
      locationName: venues.find((v) => v.id === draft.locationId)?.name ?? "",
      marketingOptIn: draft.marketingOptIn,
      // PECR audit trail: stamp when consent was first recorded, keep the
      // original date on re-saves, and clear it if consent is withdrawn.
      marketingOptInAt: draft.marketingOptIn ? (draft.marketingOptInAt ?? new Date().toISOString()) : undefined,
      notes: draft.notes.trim(),
      // Sent back deliberately. `children` has `.default([])` on the server,
      // so leaving it out of a PUT doesn't mean "unchanged" — it means an
      // empty array, and every edit was quietly wiping the family's children.
      children: draft.children
        .filter((k) => k.name.trim())
        .map((k) => ({
          name: k.name.trim(),
          // Age isn't written when there's a date of birth: two facts that can
          // disagree, one of which rots. Kept only for records with no dob.
          ...(k.dob.trim() ? { dob: k.dob.trim() } : k.age.trim() ? { age: parseInt(k.age, 10) || 0 } : {}),
          ...(k.sendPlanId ? { sendPlanId: k.sendPlanId, sendPlanName: k.sendPlanName } : {}),
        })),
    };
    try {
      const saved = draft.id
        ? await api<Customer>(`/api/customers/${encodeURIComponent(draft.id)}`, {
            method: "PUT",
            body: JSON.stringify(body),
          })
        : await apiPost<Customer>("/api/customers", body);
      // Saving must not fail because the invite did — the family record is the
      // thing that had to happen; an invite can be re-sent from the row.
      if (sendInvite && body.email) {
        try {
          await apiPost(`/api/customers/${encodeURIComponent(saved.id)}/invite`, {});
        } catch (e) {
          setError(
            `Saved ${body.name}, but the sign-up link didn't send — ${
              e instanceof Error ? e.message : "unknown error"
            }`,
          );
        }
      }
      // Anything the operator typed into a parent-owned field goes to the
      // family's record, not onto our copy. Its own call because it can fail
      // for a reason that has nothing to do with the customer save — chiefly
      // "they haven't got an account yet".
      const detail = draft.children
        .filter(
          (k) =>
            k.name.trim() &&
            (k.allergies || k.medical || k.send || k.collectionPassword || k.likes || k.dislikes || k.photoConsent || k.emergencyName || k.emergencyPhone),
        )
        .map((k) => ({
          name: k.name.trim(),
          ...(k.dob.trim() ? { dob: k.dob.trim() } : {}),
          ...(k.allergies.trim() ? { allergies: k.allergies.trim() } : {}),
          ...(k.medical.trim() ? { medical: k.medical.trim() } : {}),
          ...(k.send.trim() ? { send: k.send.trim() } : {}),
          ...(k.collectionPassword.trim() ? { collectionPassword: k.collectionPassword.trim() } : {}),
          ...(k.likes.trim() ? { likes: k.likes.trim() } : {}),
          ...(k.dislikes.trim() ? { dislikes: k.dislikes.trim() } : {}),
          ...(k.photoConsent ? { photoConsent: k.photoConsent === "yes" } : {}),
          ...(k.emergencyName.trim() ? { emergencyName: k.emergencyName.trim() } : {}),
          ...(k.emergencyPhone.trim() ? { emergencyPhone: k.emergencyPhone.trim() } : {}),
        }));
      if (detail.length) {
        try {
          await api(`/api/customers/${encodeURIComponent(saved.id)}/children`, {
            method: "PUT",
            body: JSON.stringify({ children: detail }),
          });
        } catch (e) {
          setError(
            `Saved ${body.name}, but the children's details didn't — ${
              e instanceof Error ? e.message : "unknown error"
            }`,
          );
          setBusy(false);
          return;
        }
      }
      setDraft(null);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
    setBusy(false);
  }

  /** Invite a family already on the books — the edit form no longer offers it. */
  async function sendInvite(c: Customer) {
    setError(null); setNotice(null); setInvitingId(c.id);
    const who = c.name || c.email || "the family";
    try {
      await apiPost(`/api/customers/${encodeURIComponent(c.id)}/invite`, {});
      refresh();
      const msg = `✓ Sign-up link ${c.invitedAt ? "re-sent" : "sent"} to ${who}.`;
      setNotice(msg);
      setTimeout(() => setNotice((n) => (n === msg ? null : n)), 5000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the sign-up link");
    } finally {
      setInvitingId(null);
    }
  }

  async function remove(c: Customer) {
    if (!confirm(`Remove “${c.name}”? They've never booked, so nothing else goes with them.`)) return;
    try {
      await api(`/api/customers/${encodeURIComponent(c.id)}`, { method: "DELETE" });
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  const edit = (c: Customer) => {
    // The form opens at the top of a long list, so without this nothing
    // appears to happen — you're left looking at the card you just pressed.
    //
    // scrollIntoView, not window.scrollTo: the portal scrolls an inner <main>,
    // not the window, so scrolling the window moves nothing at all.
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setKidIdx(0);
    setDraft({
      id: c.id,
      firstName: c.firstName ?? splitName(c.name).firstName,
      lastName: c.lastName ?? splitName(c.name).lastName,
      email: c.email ?? "",
      phone: c.phone ?? "",
      locationId: c.locationId ?? "",
      marketingOptIn: !!c.marketingOptIn,
      marketingOptInAt: c.marketingOptInAt,
      notes: c.notes ?? "",
      children: (c.children ?? []).map((k) => ({
        name: k.name,
        age: k.age !== undefined ? String(k.age) : "",
        dob: k.dob ?? "",
        // Blank until we can read the family's record — typing here writes
        // to theirs rather than filling a copy of our own.
        allergies: "",
        medical: "",
        send: "",
        collectionPassword: "",
        likes: "",
        dislikes: "",
        photoConsent: "",
        emergencyName: "",
        emergencyPhone: "",
        sendPlanId: k.sendPlanId ?? "",
        sendPlanName: k.sendPlanName ?? "",
        answers: {},
      })),
    });
  };

  const stageOf = (c: Customer): Stage => {
    const st = stats[(c.email ?? "").trim().toLowerCase()];
    if (st && st.n > 1) return "repeat";
    if (st && st.n > 0) return "customer";
    // Signed in / accepted the invite but not booked yet — an active account
    // holder, so "Customer", not still "Invited".
    if (c.joinedAt) return "customer";
    return c.invitedAt ? "invited" : "lead";
  };

  const query = q.trim().toLowerCase();
  const shown = (customers ?? []).filter(
    (c) =>
      (!stage || stageOf(c) === stage) &&
      (!loc || c.locationId === loc) &&
      (!day || (stats[(c.email ?? "").trim().toLowerCase()]?.days ?? []).includes(day)) &&
      (!query ||
      // Location included: the point of holding it is being able to pull
      // "everyone interested in Bedford" out of the list.
      `${c.name} ${c.email ?? ""} ${c.phone ?? ""} ${c.locationName ?? ""} ${(c.children ?? [])
        .map((k) => k.name)
        .join(" ")}`
        .toLowerCase()
        .includes(query)),
  );

  // Every child, with the family they belong to. Built from the same records
  // rather than fetched — a child has no existence apart from their family.
  // Thin for now (name and age): the full profile — allergies, SEND, the
  // collection password — lives on the parent's own child record, which an
  // operator can't read yet. See §K of the backend handoff.
  // The colour of whoever is being edited — a new family has no stage yet, so
  // it borrows the brand blue.
  const draftTint = draft?.id
    ? (STAGES.find((x) => x.key === stageOf((customers ?? []).find((c) => c.id === draft.id)!))?.colour ??
      "#2f6bd8")
    : "#2f6bd8";

  const kids = shown.flatMap((c) =>
    (c.children ?? []).map((k) => ({ ...k, family: c })),
  );
  // Siblings grouped under their family — joined in one card, still opened
  // individually (see the Children view).
  const childFamilies = shown
    .map((c) => ({ family: c, kids: (c.children ?? []).map((k) => ({ ...k, family: c })) }))
    .filter((g) => g.kids.length > 0);

  return (
    // The same light palette Listings, Sessions & blocks and Bookings each set
    // locally. Without it this page ran on the portal's near-black, where the
    // navy "How it works" heading was all but invisible — and it sits in the
    // same sidebar group as three screens that are light.
    <div
      className="-m-5 min-h-[calc(100vh-3.5rem)] p-5"
      style={
        {
          background: "var(--bg)",
          color: "var(--ink)",
          "--bg": "#f5f8fd",
          "--surface": "#ffffff",
          "--panel": "#fbf8fc",
          "--ink": "#171534",
          "--ink-2": "#4a4763",
          "--ink-3": "#8a86a3",
          "--line": "#ece6f1",
        } as React.CSSProperties
      }
    >
      <div ref={topRef}>
        <PageHero
          title="Leads & customers"
          lede="Everyone who's enquired or booked with you."
          icon="👪"
          actions={<>
            <Button
              disabled={!customers || customers.length === 0}
              title={customers?.length ? "Choose families, columns and a format" : "Nobody to export yet"}
              onClick={() => setExporting(true)}
            >
              ⬇ Export
            </Button>
            {canWrite && (
              <Button title="Bulk-add families from a spreadsheet + invite them" onClick={() => setImporting(true)}>
                📥 Import
              </Button>
            )}
            {canWrite && !draft && (
              <Button variant="primary" className="!bg-white !border-white !text-[#1d3a8f]" onClick={() => { topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); setDraft(emptyDraft()); }}>
                ＋ Add family
              </Button>
            )}
          </>}
        />
      </div>
      <HowItWorks
        video="Adding a family from a phone call, sending the sign-up link, and what each pipeline stage means."
        minutes="2 min"
      >
        <p className="mb-2">
          Everyone who has enquired or booked, and where each of them has got to. Bookings add
          people on their own — you never type a family in after they&rsquo;ve booked.
        </p>
        <p className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 py-2 text-[var(--ink-2)]">
          <b>Add a family when someone rings.</b> Take their name and email, send a sign-up link,
          and they land in their own area with every live listing — so they can book themselves
          without ringing back.
        </p>
      </HowItWorks>

      {error && (
        <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">
          {error}
        </div>
      )}

      {notice && (
        <div className="mb-3 rounded-lg border border-[#bfe6cf] bg-[#e9f8ef] px-3 py-2 text-[12.5px] font-semibold text-[#0f7a43]">
          {notice}
        </div>
      )}

      {draft && (
        <div className="mb-3.5 max-w-[1100px] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[0_10px_30px_-22px_rgba(9,20,44,.6)]">
          {/* A coloured head, in the family's own stage colour — the form
              should feel like it belongs to the card you opened it from. */}
          <div
            className="flex items-center gap-2.5 px-4 py-2.5 text-white"
            style={{ background: `linear-gradient(100deg, ${draftTint}, ${draftTint}cc)` }}
          >
            <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-white/25 text-[13px] font-extrabold">
              {(draft.firstName.trim() || "?").charAt(0).toUpperCase()}
            </span>
            <b className="min-w-0 flex-1 truncate text-[14px]">
              {draft.id
                ? [draft.firstName, draft.lastName].filter(Boolean).join(" ") || "This family"
                : "Add a family"}
            </b>
            <span className="flex-none rounded-full bg-white/20 px-2 py-[2px] text-[10px] font-extrabold uppercase tracking-[0.06em]">
              {draft.id ? "Editing" : "New"}
            </span>
          </div>
          <div className="p-4">
          <div className="grid gap-2.5 sm:grid-cols-4">
            <div>
              <FieldLabel>First name</FieldLabel>
              <Input value={draft.firstName} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} className="w-full" />
            </div>
            <div>
              <FieldLabel>Surname</FieldLabel>
              <Input value={draft.lastName} onChange={(e) => setDraft({ ...draft, lastName: e.target.value })} className="w-full" />
            </div>
            <div>
              <FieldLabel>Email</FieldLabel>
              <Input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} className="w-full" />
            </div>
            <div>
              <FieldLabel>Phone <span className="font-normal text-[var(--ink-3)]">(optional)</span></FieldLabel>
              <Input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} className="w-full" placeholder="Optional — they add it themselves if blank" />
            </div>
          </div>

          {/* One of your own sites, not their home address. A campaign goes to
              "everyone interested in Bedford", and a session provider posts
              nothing — so a street address would be personal data held for no
              purpose. */}
          <div className="mt-2.5 max-w-[320px]">
            <FieldLabel>
              Location{" "}
              <span className="font-normal text-[var(--ink-3)]">— which site they asked about</span>
            </FieldLabel>
            {venues.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--line)] px-2.5 py-2 text-[11.5px] text-[var(--ink-3)]">
                No locations set up yet — add them under Listings → Locations.
              </div>
            ) : (
              <select
                value={draft.locationId}
                onChange={(e) => setDraft({ ...draft, locationId: e.target.value })}
                className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[12.5px] text-[var(--ink)] outline-none"
              >
                <option value="">Not said</option>
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Children as tiles: pick one, edit it below. A family with three
              was three stacked cards and a very long form; this is one row
              and one editor, however many there are. */}
          {draft.id && (
            <div className="mt-3">
              <div className="mb-1.5 text-[11.5px] font-extrabold">
                Children{" "}
                <span className="font-normal text-[var(--ink-3)]">
                  {draft.children.length === 0
                    ? "— none yet"
                    : `— ${draft.children.length} on this family`}
                </span>
              </div>

              <div className="mb-2.5 flex flex-wrap gap-2">
                {draft.children.map((k, i) => {
                  const on = kidIdx === i;
                  const c2 = KID_TINTS[i % KID_TINTS.length];
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setKidIdx(i)}
                      className={`flex min-w-[150px] items-center gap-2 rounded-xl px-3 py-2 text-left transition-all ${
                        on ? "border-2" : "border opacity-75 hover:opacity-100"
                      }`}
                      style={{ borderColor: on ? c2 : "var(--line)", background: "var(--surface)" }}
                    >
                      <span
                        className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[12px] font-extrabold text-white"
                        style={{ background: c2 }}
                      >
                        {(k.name.trim() || "?").charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[12.5px] font-extrabold">
                          {k.name.trim().split(" ")[0] || "New child"}
                        </span>
                        <span className="block text-[10.5px] text-[var(--ink-3)]">
                          {ageOf({ dob: k.dob, age: k.age ? Number(k.age) : undefined }) ?? "age —"}
                          {on ? " · editing" : ""}
                        </span>
                      </span>
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => {
                    setDraft({
                      ...draft,
                      children: [
                        ...draft.children,
                        {
                          name: "", age: "", dob: "", allergies: "", medical: "", send: "",
                          collectionPassword: "", likes: "", dislikes: "", photoConsent: "",
                          emergencyName: "", emergencyPhone: "", sendPlanId: "", sendPlanName: "",
                          answers: {},
                        },
                      ],
                    });
                    setKidIdx(draft.children.length);
                  }}
                  className="rounded-xl border border-dashed border-[var(--line)] px-3 py-2 text-[12px] font-bold text-[var(--ink-3)] hover:text-[var(--ink)]"
                >
                  ＋ Add
                </button>
              </div>

              {draft.children[kidIdx] &&
                (() => {
                  const k = draft.children[kidIdx];
                  const c2 = KID_TINTS[kidIdx % KID_TINTS.length];
                  const set = (patch: Partial<typeof k>) =>
                    setDraft({
                      ...draft,
                      children: draft.children.map((x, j) => (j === kidIdx ? { ...x, ...patch } : x)),
                    });
                  const bookedNames =
                    stats[(draft.email ?? "").trim().toLowerCase()]?.kids ?? [];
                  const hasBooked = bookedNames.includes(k.name.trim().toLowerCase());
                  const typed = Object.entries(k).some(
                    ([f, v]) => f !== "name" && String(v ?? "").trim() !== "",
                  );
                  const removeKid = () => {
                    if (hasBooked) return;
                    if (
                      (typed || k.name.trim()) &&
                      !confirm(
                        `Remove ${k.name.trim() || "this child"} from the family? Anything typed about them here goes too.`,
                      )
                    )
                      return;
                    setDraft({ ...draft, children: draft.children.filter((_, j) => j !== kidIdx) });
                    setKidIdx(Math.max(0, kidIdx - 1));
                  };
                  return (
                    <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
                      <div className="flex items-center gap-2 border-b border-[var(--line)] bg-[var(--panel)] px-3 py-1.5">
                        <b className="min-w-0 flex-1 truncate text-[12px]">
                          {k.name.trim() || "New child"}
                        </b>
                        {hasBooked ? (
                          <span
                            className="text-[10.5px] text-[var(--ink-3)]"
                            title="This child has been on a booking — their record has to stay"
                          >
                            Has bookings
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={removeKid}
                            className="text-[11px] font-bold text-[var(--ink-3)] transition-colors hover:text-[var(--red,#e21d27)]"
                          >
                            Remove child
                          </button>
                        )}
                      </div>
                      <div className="grid gap-2 p-3 sm:grid-cols-4">
                        <div className="sm:col-span-2">
                          <FieldLabel>Full name</FieldLabel>
                          <Input value={k.name} placeholder="First and last name" onChange={(e) => set({ name: e.target.value })} className="w-full" />
                        </div>
                        <div>
                          <FieldLabel>
                            Date of birth <span style={{ color: "var(--red,#e21d27)" }}>*</span>
                          </FieldLabel>
                          <Input value={k.dob} type="date" onChange={(e) => set({ dob: e.target.value })} className="w-full" />
                        </div>
                        <div>
                          <FieldLabel>Age</FieldLabel>
                          {/* Worked out, not typed — see ageOf. */}
                          <div className="flex h-[34px] items-center rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 text-[12.5px] font-bold text-[var(--ink-2)]">
                            {ageOf({ dob: k.dob, age: k.age ? Number(k.age) : undefined }) ?? "—"}
                            <span className="ml-1.5 text-[10.5px] font-normal text-[var(--ink-3)]">
                              {k.dob ? "from date of birth" : "add a date of birth"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Writes to the family's own record, so it looks like a
                          different thing — because it is one. */}
                      <div
                        className="border-t px-3 py-2.5"
                        style={{ borderColor: "var(--line)", borderLeft: `4px solid ${c2}`, background: `${c2}0d` }}
                      >
                        <div className="mb-1.5 flex flex-wrap items-baseline gap-1.5">
                          <b className="text-[11.5px]" style={{ color: c2 }}>
                            👪 The family&rsquo;s own record
                          </b>
                          <span className="text-[10.5px] text-[var(--ink-3)]">
                            — typing here writes to their profile, not a copy
                          </span>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                          {(
                            [
                              // The wide ones get two columns: 140 characters
                              // in a quarter-width box is a keyhole.
                              ["allergies", "Allergies", "Nuts, dairy…", 2],
                              ["medical", "Medical", "Asthma inhaler…", 2],
                              ["send", "SEND / additional needs", "Autism, 1:1 support…", 2],
                              ["collectionPassword", "Collection password", "e.g. Bluebell", 1],
                              ["likes", "Likes", "Football, drawing", 1],
                              ["dislikes", "Dislikes", "Loud rooms", 1],
                              ["emergencyName", "Emergency contact — name", "Aunt Priya", 1],
                              ["emergencyPhone", "…and number", "07700 900123", 1],
                            ] as [keyof typeof CHILD_LIMITS, string, string, number][]
                          ).map(([f, label, ph, span]) => {
                            const max = limitFor(settings, f, CHILD_LIMITS);
                            const left = max - String(k[f] ?? "").length;
                            return (
                              <div key={f} className={span === 2 ? "lg:col-span-2" : undefined}>
                                <FieldLabel>
                                  {label}
                                  {/* Only once it's nearly full — a counter on
                                      an empty box is noise. */}
                                  {left <= 25 && (
                                    <span
                                      className="ml-1 font-normal"
                                      style={{ color: left <= 0 ? "var(--red,#e21d27)" : "var(--ink-3)" }}
                                    >
                                      {left} left
                                    </span>
                                  )}
                                </FieldLabel>
                                <Input
                                  value={k[f]}
                                  maxLength={max}
                                  placeholder={ph}
                                  // Hovering shows the whole thing when it's
                                  // longer than the box.
                                  title={k[f] || undefined}
                                  onChange={(e) => set({ [f]: e.target.value })}
                                  className="w-full"
                                />
                              </div>
                            );
                          })}
                        </div>

                        {/* The provider's own questions, in the order they set
                            in Setup. Rendered from the same list the parent
                            answers at checkout — one question, one answer, two
                            places to fill it in. */}
                        <QuestionFields
                          // No listing in hand here, so only the age rule
                          // narrows the list — from the date of birth being
                          // typed in the field above, so an age-gated question
                          // appears the moment a real birthday is entered.
                          questions={questionsFor(childQuestions, undefined, ageOn(k.dob, new Date().toISOString().slice(0, 10)))}
                          answers={k.answers}
                          onChange={(answers) => set({ answers })}
                        />

                        {settings.askPhotoConsent && (
                        <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-2">
                          <span className="text-[11px] font-bold">Photo consent</span>
                          {(
                            [
                              ["yes", "Yes"],
                              ["no", "No"],
                            ] as ["yes" | "no", string][]
                          ).map(([v, l]) => (
                            <button
                              key={v}
                              type="button"
                              onClick={() => set({ photoConsent: k.photoConsent === v ? "" : v })}
                              className="rounded-full border-2 px-2.5 py-[2px] text-[11px] font-bold transition-colors"
                              style={
                                k.photoConsent === v
                                  ? { borderColor: c2, background: c2, color: "#fff" }
                                  : { borderColor: "var(--line)", color: "var(--ink-2)" }
                              }
                            >
                              {l}
                            </button>
                          ))}
                          <span className="text-[10.5px] text-[var(--ink-3)]">
                            {k.photoConsent ? "Will save to their profile" : "Not answered yet"}
                          </span>
                        </div>
                        )}

                        {/* Your copy of a plan the family emailed you — read
                            by your staff, not shown back to the parent, who
                            has the original. Because it's yours and not a
                            second version of theirs, it carries none of the
                            "which one is true" risk. */}
                        {settings.collectSend && settings.collectSendPlan && (
                        <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-2">
                          <span className="text-[11px] font-bold">SEND plan</span>
                          {k.sendPlanId ? (
                            <>
                              <button
                                type="button"
                                // Fetch with the operator's token — a plain link
                                // 401s (every /api route needs a Bearer token).
                                onClick={() => { void openFile(`/api/my/files/${k.sendPlanId}`).catch((e) => alert(e instanceof Error ? e.message : "Couldn’t open the plan.")); }}
                                className="max-w-[220px] truncate rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-[2px] text-[11px] font-bold text-[var(--ink)] hover:border-[var(--brand)]"
                              >
                                📎 {k.sendPlanName || "Open plan"}
                              </button>
                              <button
                                type="button"
                                onClick={() => set({ sendPlanId: "", sendPlanName: "" })}
                                className="text-[10.5px] font-bold text-[var(--ink-3)] hover:text-[var(--ink)]"
                              >
                                Remove
                              </button>
                            </>
                          ) : (
                            <>
                              <label className="cursor-pointer rounded-full border-2 px-2.5 py-[2px] text-[11px] font-bold" style={{ borderColor: c2, color: c2 }}>
                                📎 Upload
                                <input
                                  type="file"
                                  accept="application/pdf,image/*"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const f = e.target.files?.[0];
                                    e.target.value = "";
                                    if (!f) return;
                                    setError(null);
                                    try {
                                      const ref = await uploadPlan(f);
                                      set({ sendPlanId: ref.id, sendPlanName: ref.name });
                                    } catch (err) {
                                      setError(err instanceof Error ? err.message : "Upload failed");
                                    }
                                  }}
                                />
                              </label>
                              <span className="text-[10.5px] text-[var(--ink-3)]">
                                Your copy, for your staff — the parent isn&rsquo;t shown it
                              </span>
                            </>
                          )}
                        </div>
                        )}

                        <div className="mt-2 flex flex-wrap gap-1">
                          <span className="rounded-full border border-dashed border-[var(--line)] px-2 py-[2px] text-[10.5px] text-[var(--ink-3)]">
                            Photo · uploaded by the parent
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

              {draft.children.length === 0 && (
                <div className="rounded-xl border border-dashed border-[var(--line)] px-3 py-2.5 text-[11.5px] text-[var(--ink-3)]">
                  They&rsquo;ll appear here with their first booking, or add one above.
                </div>
              )}

              <div className="mt-1.5 text-[10.5px] leading-[1.45] text-[var(--ink-3)]">
                Your list of children is built from their bookings. <b>Anything you type here
                saves to the family&rsquo;s own record too</b>, so you and the parent are looking at
                the same details — and either of you can fill any of it in. They need an account
                for that: send a sign-up link if they haven&rsquo;t got one.
              </div>
            </div>
          )}

          {/* Says plainly that the family never sees these. A note written
              believing it's private and later surfaced is worse than having
              no notes at all. */}
          <div className="mt-2.5">
            <FieldLabel>
              Notes{" "}
              <span className="font-normal text-[var(--ink-3)]">— only your team sees these, never the family</span>
            </FieldLabel>
            <textarea
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              rows={2}
              placeholder="Rang about August, wants the Bedford site, dad collects on Fridays…"
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[12.5px] text-[var(--ink)] outline-none"
            />
          </div>

          {/* Marketing email needs consent under PECR, and the answer has to
              come from the parent — so it's a question the provider ticks
              because the family said yes, not a default. */}
          <label className="mt-2.5 flex cursor-pointer items-start gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-2.5">
            <input
              type="checkbox"
              checked={draft.marketingOptIn}
              onChange={(e) => setDraft({ ...draft, marketingOptIn: e.target.checked })}
              className="mt-0.5"
            />
            <span>
              <span className="block text-[12.5px] font-bold">
                They said yes to hearing about upcoming activities
              </span>
              <span className="block text-[11px] leading-[1.45] text-[var(--ink-3)]">
                Only tick this if they actually agreed on the call. Marketing email without
                consent is unlawful, and this is the record of it. Booking confirmations and
                payment links are sent either way — those aren&rsquo;t marketing.
              </span>
            </span>
          </label>

          {/* Children aren't asked for here. The parent adds them once, with
              everything that actually matters — date of birth, allergies,
              SEND, collection password — and a thin name-and-age copy in a
              second place is how two versions of a child come to exist. */}
          {/* Two buttons on a new family, one on an edit. Sending an invite is
              a thing you decide by pressing it, not a checkbox to remember —
              and editing a family shouldn't offer to email them at all. */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="primary" disabled={busy || !draft.firstName.trim()} onClick={() => save(false)}>
              {busy ? "Saving…" : "Save"}
            </Button>
            {/* On a new family this creates the account; on an existing one it
                saves the edits first, so a corrected email address is the one
                the link goes to. */}
            <Button
              disabled={busy || !draft.firstName.trim() || !draft.email.trim()}
              title={draft.email.trim() ? "Save, then email them a link to set a password" : "Needs an email address"}
              onClick={() => save(true)}
            >
              ✉ Save &amp; send sign-up link
            </Button>
            <Button onClick={() => setDraft(null)}>Cancel</Button>
          </div>
          <div className="mt-1.5 text-[11px] leading-[1.45] text-[var(--ink-3)]">
            The link lets them set a password and land in their own area, where they can see
            every live listing and its dates. Their name and email carry over — it won&rsquo;t
            ask again.
          </div>
          </div>
        </div>
      )}

      {/* The pipeline, and the filter. Each tile is a stage and pressing one
          narrows the list to it — the count is the point, so it may as well
          be the control. */}
      {customers && customers.length > 0 && (
        <div className="mb-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
          <button type="button" title="Everyone — clear the filter" onClick={() => setStage("")} className={"rounded-2xl px-4 py-3 text-left transition-all hover:-translate-y-px " + (stage === "" ? "text-white shadow-[0_10px_24px_-16px_rgba(9,20,44,.8)]" : "bg-[var(--surface)]")} style={stage === "" ? { background: "#1d3a8f" } : { border: "1px solid var(--line)", borderLeft: "5px solid #1d3a8f" }}>
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.07em]" style={{ color: stage === "" ? "rgba(255,255,255,.9)" : "var(--ink-3)" }}>All families</div>
            <div className="text-[24px] font-extrabold leading-tight tabular-nums">{customers.length}</div>
            <div className="text-[10.5px] leading-[1.35]" style={{ color: stage === "" ? "rgba(255,255,255,.85)" : "var(--ink-3)" }}>Everyone on your list</div>
          </button>
          {STAGES.map((st) => {
            const n = customers.filter((c) => stageOf(c) === st.key).length;
            const on = stage === st.key;
            return (
              <button
                key={st.key}
                type="button"
                title={st.hint}
                onClick={() => setStage(on ? "" : st.key)}
                className={
                  "rounded-2xl px-4 py-3 text-left transition-all hover:-translate-y-px " +
                  (on ? "text-white shadow-[0_10px_24px_-16px_rgba(9,20,44,.8)]" : "bg-[var(--surface)]")
                }
                style={
                  on
                    ? { background: st.colour }
                    : { border: "1px solid var(--line)", borderLeft: `5px solid ${st.colour}` }
                }
              >
                <div
                  className="text-[10.5px] font-extrabold uppercase tracking-[0.07em]"
                  style={{ color: on ? "rgba(255,255,255,.9)" : "var(--ink-3)" }}
                >
                  {st.label}
                </div>
                <div className="text-[24px] font-extrabold leading-tight tabular-nums">{n}</div>
                <div
                  className="text-[10.5px] leading-[1.35]"
                  style={{ color: on ? "rgba(255,255,255,.85)" : "var(--ink-3)" }}
                >
                  {st.hint}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Location and a booking date, in the same components the Listings and
          Bookings tabs use, so the three screens filter the same way. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {venues.length > 0 && (
          <Pill active={!!loc} onClear={() => setLoc("")}>
            <PillSelect
              active={!!loc}
              value={loc}
              onChange={setLoc}
              title="Filter by location"
              options={[["", "All locations"], ...venues.map((v) => [v.id, v.name] as [string, string])]}
            />
          </Pill>
        )}

        <Pill active={!!day} onClear={() => setDay("")}>
          <span
            className="whitespace-nowrap text-[12.5px] font-semibold"
            style={{ color: day ? "#fff" : "var(--ink)" }}
          >
            Booked on
          </span>
          <input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="h-full w-[112px] border-0 bg-transparent text-[12.5px] font-semibold outline-none"
            style={{ color: day ? "#fff" : "var(--ink)", colorScheme: day ? "dark" : "light" }}
          />
        </Pill>

        {/* A button, not a line of underlined text — it's the way out of a
            filter you may not remember setting. */}
        {(stage || loc || day) && (
          <button
            type="button"
            onClick={() => {
              setStage("");
              setLoc("");
              setDay("");
            }}
            className="h-8 rounded-full border-2 border-[var(--brand)] px-3.5 text-[12px] font-extrabold text-[var(--brand)] transition-colors hover:bg-[var(--brand)] hover:text-white"
          >
            Show everyone
          </button>
        )}

        {(stage || loc || day) && (
          <span className="text-[11.5px] text-[var(--ink-3)]">
            {shown.length} of {customers?.length ?? 0}
          </span>
        )}
      </div>

      {/* One list or the other, same filters underneath — a provider thinks
          in families when chasing money and in children when running a day. */}
      <div className="mb-3 inline-flex rounded-full border border-[var(--line)] bg-[var(--surface)] p-0.5">
        {(
          [
            ["families", `Families${customers ? ` (${shown.length})` : ""}`],
            ["children", `Children${customers ? ` (${kids.length})` : ""}`],
          ] as ["families" | "children", string][]
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className="rounded-full px-3.5 py-1.5 text-[12px] font-bold transition-colors"
            style={view === v ? { background: "var(--brand)", color: "#fff" } : { color: "var(--ink-3)" }}
          >
            {label}
          </button>
        ))}
      </div>

      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍  Search by name, child, email, phone or location…" className="mb-3 w-full max-w-[360px]" />

      {!customers ? (
        <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
      ) : shown.length === 0 ? (
        <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">
          {query ? "Nobody matches your search." : "Nobody here yet — people appear automatically with their first booking, or add one when someone enquires."}
        </Card>
      ) : view === "children" ? (
        kids.length === 0 ? (
          <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">
            No children on record yet — they arrive with a booking, or when a parent adds them
            to their own account.
          </Card>
        ) : (
          <div className="grid gap-2.5 lg:grid-cols-2">
            {childFamilies.map(({ family, kids: sibs }) => {
              const st = STAGES.find((x) => x.key === stageOf(family))!;
              return (
                <div
                  key={family.id}
                  className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] transition-all hover:shadow-[0_14px_30px_-20px_rgba(9,20,44,.6)]"
                >
                <span className="absolute inset-y-0 left-0 z-[1] w-1.5" style={{ background: st.colour }} />
                {/* Family header — siblings joined under one card, still opened individually. */}
                <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] bg-[var(--panel)] px-4 py-2 pl-5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span aria-hidden className="text-[14px]">👪</span>
                    <span className="truncate text-[13px] font-extrabold">{family.name}</span>
                    <span className="flex-none rounded-full bg-[var(--brand-soft)] px-2 py-[1px] text-[10px] font-bold text-[var(--brand-strong)]">{sibs.length} {sibs.length === 1 ? "child" : "children"}</span>
                  </div>
                  {family.locationName && <span className="flex-none truncate text-[11px] text-[var(--ink-3)]">📍 {family.locationName}</span>}
                </div>
                {sibs.map((k, sibIdx) => {
                  const key = childKey(family.id, k.name);
                  return (
                <div key={key} className={sibIdx > 0 ? "border-t border-[var(--line)]" : ""}>
                <div className="flex items-center gap-3 px-4 py-3 pl-5">
                  {k.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={k.photo}
                      alt=""
                      className="h-10 w-10 flex-none rounded-full object-cover"
                      style={{ boxShadow: `0 0 0 2.5px ${st.colour}` }}
                    />
                  ) : (
                    <span
                      className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-[14px] font-extrabold text-white"
                      style={{ background: st.colour }}
                    >
                      {k.name.trim().charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-1.5">
                      <span className="truncate text-[14px] font-extrabold">{k.name}</span>
                      {ageOf(k) !== null && (
                        <span className="text-[11.5px] text-[var(--ink-3)]">age {ageOf(k)}</span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenKid(key === openKid ? null : key)}
                    className="flex-none rounded-full border-2 px-3 py-[3px] text-[11.5px] font-extrabold transition-colors"
                    style={
                      key === openKid
                        ? { borderColor: st.colour, background: st.colour, color: "#fff" }
                        : { borderColor: st.colour, color: st.colour }
                    }
                  >
                    {key === openKid ? "Close" : "Open"}
                  </button>
                </div>

                {key === openKid && (
                  <div className="border-t border-[var(--line)] bg-[var(--panel)] px-4 py-3 pl-5">
                    <div className="grid gap-x-4 gap-y-2.5 sm:grid-cols-4">
                      <Row label="Date of birth" value={k.dob} />
                      <Row label="Age" value={ageOf(k) !== null ? String(ageOf(k)) : ""} />
                      <Row label="Family" value={k.family.name} />
                      <Row label="Stage" value={st.label} />
                      <Row label="Email" value={k.family.email} wide />
                      <Row label="Phone" value={k.family.phone} />
                      <Row label="Location" value={k.family.locationName} />
                    </div>

                    {(() => {
                      const hasDetail = Boolean(
                        k.allergies || k.medical || k.dietary || k.send || k.sendPlanName ||
                        k.collectionPassword || k.emergencyName || k.emergencyPhone ||
                        k.likes || k.dislikes || typeof k.photoConsent === "boolean",
                      );
                      // A thin booking-only record has none of these — keep the
                      // "held by the parent" note. A linked/entered child shows
                      // the real care details.
                      if (!hasDetail) {
                        return (
                          <div className="mt-2.5 rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface)] px-3 py-2">
                            <div className="text-[11px] font-extrabold text-[var(--ink-2)]">Not filled in yet</div>
                            <div className="mt-0.5 text-[11px] leading-[1.5] text-[var(--ink-3)]">
                              Allergies · Medical · SEND · Collection password · Emergency contact — the
                              family hasn&rsquo;t added these to this child yet. A blank line does <b>not</b> mean a child has none.
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div className="mt-2.5 grid gap-x-4 gap-y-2.5 sm:grid-cols-4">
                          <Row label="Allergies" value={k.allergies || "None recorded"} wide />
                          <Row label="Medical" value={k.medical || "None recorded"} wide />
                          {k.dietary && <Row label="Dietary" value={k.dietary} wide />}
                          {k.send && <Row label="SEND / additional needs" value={k.send} wide />}
                          {k.sendPlanName && <Row label="SEND plan" value={`📎 ${k.sendPlanName}`} />}
                          {(k.emergencyName || k.emergencyPhone) && (
                            <Row label="Emergency contact" value={[k.emergencyName, k.emergencyPhone].filter(Boolean).join(" · ")} wide />
                          )}
                          {k.collectionPassword && <Row label="Collection password" value={k.collectionPassword} />}
                          {typeof k.photoConsent === "boolean" && <Row label="Photo consent" value={k.photoConsent ? "Allowed" : "No photos"} />}
                          {(k.likes || k.dislikes) && <Row label="Likes / dislikes" value={[k.likes, k.dislikes].filter(Boolean).join(" · ")} wide />}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
              );
                })}
              </div>
              );
            })}
          </div>
        )
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {shown.map((c) => {
            const st = stats[(c.email ?? "").trim().toLowerCase()] ?? { n: 0, days: [], kids: [] };
            // The card wears its stage colour — the same four as the tiles
            // above — so the list is scannable by where people have got to.
            // A per-family colour looked pretty and told you nothing.
            const stageNow = stageOf(c);
            const stageDef = STAGES.find((x) => x.key === stageNow)!;
            const tint = stageDef.colour;
            return (
              <div
                key={c.id}
                className="group relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] transition-all hover:-translate-y-px hover:shadow-[0_14px_30px_-20px_rgba(9,20,44,.6)]"
              >
                {/* Two faces, one card. The track is twice the width and
                    slides by half — so the contact options arrive from the
                    right rather than landing on top of anything. */}
                <div
                  className="flex w-[200%] transition-transform duration-300 ease-out"
                  style={{ transform: contactId === c.id ? "translateX(-50%)" : "translateX(0)" }}
                >
                <div className="w-1/2 flex-none">

                {/* No avatar on a family. It's an adult we'll never have a
                    photo of, so the circle was two initials in a colour the
                    spine and the stage pill already carry. */}
                {/* Style 7 — a thin gradient top strip carries the name + stage;
                    the body leads with the family's details. */}
                <div className="flex items-center justify-between gap-2 px-4 py-1.5 text-white" style={{ background: "linear-gradient(120deg,#2f5fc0 0%,#5b95e8 100%)" }}>
                  <span className="truncate text-[12.5px] font-extrabold" title={stageDef.hint}>{c.name}</span>
                  <span className="flex-none whitespace-nowrap text-[9px] font-extrabold uppercase tracking-[0.04em] text-white/85">{stageDef.label} · {st.n} booking{st.n === 1 ? "" : "s"}</span>
                </div>
                <div className="px-4 py-3 pl-5">
                  <div className="mb-1.5 truncate text-[11.5px] text-[var(--ink-3)]">
                    {[c.email, c.phone].filter(Boolean).join(" · ") || "No contact details"}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {c.locationName && (
                      <span className="rounded-full bg-[var(--brand-soft,#eaf0fc)] px-2 py-[2px] text-[10px] font-extrabold text-[var(--brand-ink,#1d3a8f)]">📍 {c.locationName}</span>
                    )}
                    {c.marketingOptIn && (
                      <span className="rounded-full bg-[#eaf0fc] px-2 py-[2px] text-[10px] font-extrabold text-[#1d3a8f]">✉ Marketing</span>
                    )}
                    {c.joinedAt ? (
                      <span className="rounded-full bg-[#e6f6ec] px-2 py-[2px] text-[10px] font-extrabold text-[#1a7f43]">✓ Signed up</span>
                    ) : c.invitedAt ? (
                      <span className="rounded-full bg-[#eef0f6] px-2 py-[2px] text-[10px] font-extrabold text-[#5b6478]">Invited</span>
                    ) : null}
                    {(c.children ?? []).length === 0 ? (
                      <span className="text-[11px] text-[var(--ink-3)]">No children on record</span>
                    ) : (
                      (c.children ?? []).map((k) => (
                        <button
                          key={k.name}
                          type="button"
                          title={`Open ${k.name}'s profile`}
                          onClick={() => {
                            setView("children");
                            setOpenKid(childKey(c.id, k.name));
                            topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                          }}
                          className="rounded-full border px-2.5 py-[3px] text-[11px] font-bold transition-colors hover:brightness-95"
                          style={{ borderColor: `${tint}44`, background: `${tint}12`, color: "var(--ink-2)" }}
                        >
                          {k.name}
                          {ageOf(k) !== null ? ` · ${ageOf(k)}` : ""}
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Actions sit on their own strip: reachable, but not shouting
                    over the family's name the way two buttons at the top did. */}
                <div className="flex flex-wrap items-center gap-1.5 rounded-b-2xl border-t border-[var(--line)] bg-[var(--panel)] px-4 py-2 pl-5">
                  <button
                    type="button"
                    onClick={() => setContactId(c.id)}
                    className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-[3px] text-[11.5px] font-bold text-[var(--ink-2)] hover:border-[var(--ink-3)]"
                  >
                    Contact →
                  </button>
                  {canWrite && (c.email ?? "").includes("@") && (
                    <button
                      type="button"
                      onClick={() => sendInvite(c)}
                      disabled={invitingId === c.id}
                      title={c.invitedAt ? "Send the sign-up link again" : "Create their account and email a link to set a password"}
                      className="rounded-full border border-[var(--brand-2,#2f6bd8)] bg-[var(--brand-soft,#eaf0fc)] px-2.5 py-[3px] text-[11.5px] font-bold text-[var(--brand-ink,#1d3a8f)] disabled:opacity-50"
                    >
                      {invitingId === c.id ? "Sending…" : c.invitedAt ? "Re-send sign-up link" : "Send sign-up link"}
                    </button>
                  )}
                  {canWrite && (
                    <>
                      <button
                        type="button"
                        onClick={() => edit(c)}
                        className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-[3px] text-[11.5px] font-bold text-[var(--ink-2)] hover:border-[var(--ink-3)]"
                      >
                        View / edit
                      </button>
                      {/* Only ever deletable before they've booked. After
                          that the record is holding their bookings' history
                          and whatever they agreed to — the server refuses it
                          too, this just doesn't offer what won't work. */}
                      {st.n === 0 ? (
                        <button
                          type="button"
                          onClick={() => remove(c)}
                          className="ml-auto rounded-full px-2.5 py-[3px] text-[11.5px] font-bold text-[var(--ink-3)] transition-colors hover:text-[var(--red,#e21d27)]"
                        >
                          Remove
                        </button>
                      ) : (
                        <span
                          className="ml-auto text-[10.5px] text-[var(--ink-3)]"
                          title="Families with bookings can't be deleted — their bookings and consent record depend on it"
                        >
                          Has bookings
                        </span>
                      )}
                    </>
                  )}
                </div>
                </div>

                <div className="w-1/2 flex-none">
                  {/* Mounted only while it's the one showing, so a hundred
                      cards aren't each holding a hidden contact pane. */}
                  {contactId === c.id && (
                    <ContactPane
                      email={c.email}
                      phone={c.phone}
                      name={c.name}
                      onBack={() => setContactId(null)}
                    />
                  )}
                </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {exporting && (
        <FamiliesExport
          rows={(customers ?? []).map<FamilyRow>((c) => ({
            ...c,
            stage: STAGES.find((x) => x.key === stageOf(c))?.label ?? "",
            bookings: stats[(c.email ?? "").trim().toLowerCase()]?.n ?? 0,
          }))}
          stages={STAGES.map((x) => ({ key: x.label, label: x.label }))}
          locations={venues}
          onClose={() => setExporting(false)}
        />
      )}
      {importing && <FamilyImport onClose={() => setImporting(false)} onDone={refresh} />}
    </div>
  );
}
