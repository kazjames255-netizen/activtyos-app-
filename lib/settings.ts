"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { DEFAULT_POLICIES, type NamedPolicy } from "@/lib/cancellation";
import type { WhenTooClose } from "@/lib/vouchers";

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
   * Surface this answer on the child's register card so staff can see it on the
   * day. Undefined is treated as true (legacy questions stay visible); set false
   * to keep an answer out of the register.
   */
  showOnRegister?: boolean;
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

/**
 * A reason a booking was cancelled.
 *
 * Scoped, because the two sides cancel for different reasons and shouldn't
 * see each other's list. "Venue unavailable" in a parent's dropdown is
 * nonsense, and "Staffing" tells them something about your operation that
 * isn't theirs to know. "Illness" belongs to both.
 */
export interface CancelReason {
  id: string;
  label: string;
  /** Who is offered it when they cancel. */
  who: "both" | "provider" | "parent";
}

export const DEFAULT_CANCEL_REASONS: CancelReason[] = [
  { id: "illness", label: "Illness", who: "both" },
  { id: "weather", label: "Weather", who: "provider" },
  { id: "staffing", label: "Staffing", who: "provider" },
  { id: "venue", label: "Venue unavailable", who: "provider" },
  { id: "too-few", label: "Too few booked", who: "provider" },
  { id: "asked", label: "Family asked us to", who: "provider" },
  { id: "plans", label: "Plans changed", who: "parent" },
  { id: "childcare", label: "No longer need the childcare", who: "parent" },
  { id: "cost", label: "Cost", who: "parent" },
  { id: "duplicate", label: "Booked by mistake", who: "both" },
];

/**
 * A sensible starting scope for a reason, read from its wording.
 *
 * Only strong signals count. "Venue unavailable" is obviously yours and
 * "Cost" is obviously theirs, but plenty of reasons genuinely belong to both,
 * and a confident wrong guess is worse than none — the provider has to notice
 * it before fixing it. Anything unclear stays on "both", which is safe
 * because it hides nothing from anyone.
 */
export function inferWho(label: string): CancelReason["who"] {
  const t = label.toLowerCase();
  // Things only a provider can cause or know about.
  if (/venue|facilit|pool|pitch|hall|staff|coach|tutor|instructor|teacher|weather|snow|flood|ice|storm|closure|closed|too few|under.?subscribed|minimum number|our (error|mistake)|we cancel/.test(t))
    return "provider";
  // Things only a family can decide.
  if (/plans?|holiday|cost|afford|price|money|no longer need|childcare|changed (their )?mind|moved away|another (club|camp|activity)/.test(t))
    return "parent";
  return "both";
}

/** The reasons offered to one side or the other. */
export const reasonsFor = (all: CancelReason[], who: "provider" | "parent"): CancelReason[] =>
  all.filter((r) => r.who === "both" || r.who === who);

/**
 * A childcare-voucher scheme the provider is registered with.
 *
 * The reference is what a parent has to quote to send money — an Edenred
 * account number, a Fideliti code. A scheme with no reference filled in is
 * never shown to parents: sending someone to Edenred with nothing to quote is
 * worse than not offering it, because they'll get halfway and ring you.
 *
 * Tax-Free Childcare is deliberately NOT one of these. It's HMRC rather than
 * an employer scheme, it's identified by an Ofsted number, and it has its own
 * reconciliation being built.
 */
export interface VoucherDetail {
  id: string;
  /** What it's called — schemes ask for different things. Editable, because
   *  no fixed set covers them all. */
  label: string;
  value: string;
}

/**
 * A childcare-voucher scheme the provider is registered with.
 *
 * Details rather than a single reference: Sodexo wants your setting name,
 * Computershare an account number, some want an Ofsted number. A parent given
 * the wrong kind of identifier can't complete the payment.
 *
 * A scheme with nothing filled in is never shown to parents — sending someone
 * to Edenred with nothing to quote is worse than not offering it, because they
 * get halfway and ring you.
 *
 * Tax-Free Childcare is deliberately NOT one of these. It's HMRC rather than
 * an employer scheme and has its own reconciliation being built.
 */
export interface VoucherProvider {
  id: string;
  name: string;
  details: VoucherDetail[];
}

/** The labels schemes usually ask for. Starting points, not a fixed list. */
export const VOUCHER_DETAIL_LABELS = ["Account number/ID", "Setting name", "Ofsted/Regulator No"];

/** Details actually filled in — the only ones worth showing anyone. */
export const filledDetails = (v: VoucherProvider): VoucherDetail[] =>
  v.details.filter((d) => d.value.trim().length > 0);

/** The schemes a parent can actually be sent to. */
export const liveVouchers = (all: VoucherProvider[]): VoucherProvider[] =>
  all.filter((v) => filledDetails(v).length > 0);

/** The UK schemes providers are usually registered with. Blank to start. */
export const DEFAULT_VOUCHERS: VoucherProvider[] = [
  "Edenred",
  "Computershare",
  "Fideliti",
  "Care-4",
  "KiddiVouchers",
  "Caboodle",
  "Sodexo",
  "Co-operative Flexible Benefits",
  "Enjoy Benefits",
  "Salary Extras",
].map((name) => {
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return { id, name, details: [{ id: `${id}-acc`, label: "Account number/ID", value: "" }] };
});

/**
 * A standing ratio group — a "room" on the Ratios & groups board.
 *
 * Children fall into a group by age (ageFrom–ageTo); the target ratio and max
 * size drive the live cover check. Editing one flows to every card on the
 * board. This is the manual's "ratio policy" table, made real.
 */
export interface RatioGroup {
  id: string;
  name: string;
  colour: string;
  ageFrom: number;
  ageTo: number;
  /** Children per adult — the "1 : N" target. */
  targetRatio: number;
  /** Most children the room holds. */
  maxSize: number;
}

/** Sensible starting groups for a 5–17 activity camp — all editable. */
export const DEFAULT_RATIO_GROUPS: RatioGroup[] = [
  { id: "cubs", name: "Cubs", colour: "#e2225f", ageFrom: 5, ageTo: 7, targetRatio: 8, maxSize: 32 },
  { id: "explorers", name: "Explorers", colour: "#2f6bd8", ageFrom: 8, ageTo: 10, targetRatio: 8, maxSize: 32 },
  { id: "adventurers", name: "Adventurers", colour: "#16234b", ageFrom: 11, ageTo: 14, targetRatio: 10, maxSize: 30 },
  { id: "trailblazers", name: "Trailblazers", colour: "#0e9f6e", ageFrom: 15, ageTo: 17, targetRatio: 12, maxSize: 24 },
];

/** The group an age falls into, or null if it's outside every range. */
export const groupForAge = (groups: RatioGroup[], age: number): RatioGroup | null =>
  groups.find((g) => age >= g.ageFrom && age <= g.ageTo) ?? null;

/** A parent testimonial an operator saved from Moments into the Email area. */
export interface SavedQuote {
  id: string;
  text: string;
  byName?: string;
  /** The child the commenting parent belongs to, for context. */
  childName?: string;
  momentId?: string;
  savedAt: string;
}

/** A Moments photo an operator pushed to the Email area — a self-contained
 *  snapshot that re-renders identically (with or without its baked text). */
export interface SavedImage {
  id: string;
  momentId: string;
  photoUrl: string;
  ratio: "square" | "portrait" | "story";
  /** How the photo fills a non-square frame — "contain" shows the whole image. */
  fit?: "cover" | "contain";
  color: string;
  /** Which text the banner shows — re-editable in the Email area. */
  include?: { caption: boolean; quote: boolean; comments: boolean };
  /** The moment's caption at save time, so "include caption" can be re-toggled. */
  sourceCaption?: string;
  /** A custom message typed in the Email area — overrides the moment's caption
   *  under the photo (empty string = deliberately no message). */
  customCaption?: string;
  /** The moment's parent comments at save time (with their marketing flag). */
  sourceComments?: { text: string; byName?: string; marketing?: boolean }[];
  /** Attribution line drawn at the foot of the banner. */
  footer?: string;
  childName?: string;
  activity?: string;
  savedAt: string;
  /** @deprecated legacy baked fields (pre-editor snapshots). */
  caption?: string;
  quotes?: { text: string; byName?: string; marketing?: boolean }[];
}

export interface TenantSettings {
  // ── Public identity ──
  /**
   * What parents see this provider called — everywhere the business is named
   * to a family: the storefront heading, booking pages, "Message {provider}".
   *
   * Chosen at onboarding as either the operator's own name or their business
   * name (see providerNameMode), then freely editable here. It's also the
   * default name of the account-holder on the Ratios board's team roster —
   * seeded once, editable there without touching this.
   *
   * Empty falls back to the tenant's business name, so an older library that
   * predates this setting still reads correctly.
   */
  providerName: string;
  /** Which the operator picked at onboarding — kept so Setup can show it and
   *  re-resolve from the live name if they later rename the business. */
  providerNameMode: "person" | "business";
  /** What the provider runs (holiday camps, clubs, classes…), captured at
   *  onboarding. Informational — surfaces in Setup and helps tailor copy. */
  activityKinds?: string[];
  /** Business postcode from onboarding — lets the storefront sort by distance
   *  without re-asking. Also stored on the tenant doc. */
  postcode?: string;
  /**
   * List this provider in the cross-provider marketplace — the parent Browse
   * feed that shows every opted-in provider's live public activities, not just
   * the ones a family has already booked. Off by default: a provider's public
   * listings always show on their OWN storefront (/store/:tenantId) regardless,
   * but appearing in the shared marketplace is an explicit, opt-in decision.
   */
  marketplaceListed: boolean;

  /**
   * Money → Expenses preferences. `includeSubscription` folds the operator's
   * own ActivityOS plan fee into their expense totals; `categories` is the
   * persistent custom-category registry (so a category can exist — and be
   * renamed or deleted — independently of whether any expense uses it yet).
   */
  expenses?: { includeSubscription?: boolean; categories?: string[] };

  /**
   * Money section shape. `show` picks which sides of the ledger appear
   * (outgoing = Expenses + Bills/POs; incoming = customer Invoices);
   * `usePurchaseOrders` turns the PO stage on the Bills page on/off (many
   * providers just track supplier bills, no formal PO).
   */
  money?: {
    show?: "outgoing" | "incoming" | "both";
    usePurchaseOrders?: boolean;
    /**
     * Accounting basis for when a bill counts as money-out spend:
     * `cash` (default) = only once it's marked paid; `accrual` = on the bill's
     * own date, paid or not. Drives the fold-in of bills on the money-out hub.
     */
    basis?: "cash" | "accrual";
  };

  /**
   * Business & bank details printed on POs and invoices (and their PDFs/emails).
   * All optional — a provider fills in what they have. Bank details show only on
   * invoices (money in), as the "how to pay" block.
   */
  billing?: {
    businessName?: string; address?: string; email?: string; phone?: string; vatNumber?: string;
    bankName?: string; accountName?: string; sortCode?: string; accountNumber?: string;
    paymentTerms?: string; footer?: string;
    // Template extras printed on invoices/POs.
    logoUrl?: string; companyReg?: string;
    // Which optional per-invoice fields to offer on the form + show on the doc.
    fields?: { poNumber?: boolean; accountRef?: boolean; address?: boolean; vat?: boolean };
    defaultTaxRate?: number;
    // Purchase-order template boilerplate (editable in Setup → Money), printed
    // on every PO document below the order.
    poPaymentMethod?: string;    // e.g. "To be invoiced"
    poInstructions?: string;     // numbered instructions to suppliers (one per line)
    poTerms?: string;            // terms & conditions text
  };

  /**
   * Automatic (system) emails — which transactional/reminder emails ActivityOS
   * sends on the provider's behalf, and their timing. Edited on the Email page
   * ("Automatic emails" tab). The SENDING is a backend job (see
   * docs/email-notifications-handoff.md); this block is just the on/off + timing
   * preferences the front-end reads and the backend must honour.
   */
  autoEmails?: {
    bookings?: boolean;         // booking confirmed / approved / declined / cancelled (core transactional)
    payments?: boolean;         // receipts, refunds, payment-failed
    paymentDue?: boolean;       // a payment-due reminder before the balance is owed
    paymentDueTiming?: number;  // hours before the due date (12 / 24 / 48 / 72)
    sessionReminder?: boolean;  // pre-session reminder with the key details & what to bring
    sessionTiming?: number;     // hours before the session (12 / 24 / 48 / 72)
    waitlist?: boolean;         // place-opened / moved-up-the-queue emails
    dayOf?: boolean;            // on-the-day register / arrival / incident-logged alerts
    lateCollection?: boolean;   // alert when a child is checked out late
    announcements?: boolean;    // re-marketing to past/opted-in customers when new camps open (opt-in)
    reviewRequests?: boolean;   // ask a parent to review after their LAST booked session
  };

  /** Branding — a customer-facing accent colour. The logo + business/display name
   *  live in `billing` / `providerName` (single source of truth); this just tints
   *  customer pages. */
  brandColor?: string;

  /** Staff & workforce policy. Front-end preferences; the actual enforcement
   *  (blocking an out-of-date DBS, gating who assigns staff) is backend — see
   *  docs/settings-areas-handoff.md. */
  staff?: {
    assignByLeads?: boolean;      // only site managers/leads can assign staff to groups
    requireDBS?: boolean;         // a valid DBS must be on file before a staff member works
    requireCompliance?: boolean;  // key certificates (first aid, safeguarding) must be in date
    defaultRatioTarget?: number;  // default staff:child ratio target
    inviteMessage?: string;       // a note added to staff invite emails
  };

  /** Learning & development. */
  learning?: {
    trackTraining?: boolean;      // keep staff training / certificate records
    observations?: boolean;       // enable learning observations / journeys for children
    framework?: string;           // curriculum framework label (e.g. "EYFS")
  };

  /** Meals & catering (the parent-facing meal ordering). */
  meals?: {
    ordering?: boolean;           // parents can pre-order meals
    showAllergens?: boolean;      // show allergen info on the menu
    orderCutoffHours?: number;    // hours before a session that ordering closes
    menuNote?: string;            // a note shown on the meals page
  };

  /** Medication administration policy — edited in Setup → Medication, read by
   *  features/medication/MedicationApp.tsx (and, for notifications, by the
   *  backend once wired — see docs/medication-parent-notify-handoff.md). */
  medication?: {
    informParentGiven?: boolean;   // notify the parent when a dose is logged
    informParentMissed?: boolean;  // …and when a dose is missed / refused
    notifyParentNote?: boolean;    // email + bell the provider when a parent adds a note
    notifyParentAuthorise?: boolean; // email + bell the provider when a parent authorises a med
    remindWhenDue?: boolean;       // bell staff when a timed dose is due
    requireWitness?: boolean;      // a second person must witness each dose
    leadsOnly?: boolean;           // only leads/managers can record doses, not all staff
  };

  /** Safeguarding (accidents/incidents) policy — Setup → Safeguarding, read by
   *  features/incidents/IncidentsApp.tsx (notifications are Amir's, gated here). */
  safeguarding?: {
    notifyParentAccident?: boolean;  // email + bell the parent when an accident is logged
    notifyParentIncident?: boolean;  // …and for incidents (usually off — often internal)
    notifyStaffAcknowledged?: boolean; // email + bell staff when a parent acknowledges a record
    requireAcknowledgement?: boolean;  // enforce: nag the parent until they acknowledge (off = optional)
    /** The safeguarding lead a concern is reported to — title (editable, e.g.
     *  "DSL") + name, shown to staff. This person is alerted on every concern. */
    dslTitle?: string;
    dslName?: string;
    dslEmail?: string;               // who to email; blank = the account holder
    /** Editable list of concern categories staff pick from. */
    categories?: string[];
    /** The editable default "What to do now" protocol shown on the form. */
    protocol?: { due?: string; ref?: string; steps?: string[] };
    /** The external agencies a freelancer actually reports to — their real
     *  safeguarding channels. Shown on the form + PDF with click-to-call. */
    contacts?: {
      /** National emergency numbers shown under "if a child is in danger". */
      nspccPhone?: string; policePhone?: string;
      /** One entry per council you work in — each with its own LADO + MASH.
       *  The concern form picks which authority applies. */
      authorities?: { id: string; name: string; ladoName?: string; ladoPhone?: string; socialCarePhone?: string; outOfHoursPhone?: string }[];
      /** Any further contacts the provider wants on the form + PDF. */
      extra?: { label: string; phone: string }[];
      // ── legacy single fields (pre multi-authority) — still read as a fallback ──
      ladoName?: string; ladoPhone?: string; socialCarePhone?: string; outOfHoursPhone?: string; localAuthority?: string;
    };
  };

  /** Trips & visits. */
  trips?: {
    notifyParent?: boolean;   // email + bell + ask consent when a child is on a trip
    requireConsent?: boolean; // a trip can't be marked ready/completed until every child has consent
    ratioTarget?: number;     // target children-per-staff; the trip flags when it's exceeded
  };

  /** Calendar — reusable event categories + start-time reminders. */
  calendar?: {
    categories?: { id: string; name: string; color: string }[];
    reminderOn?: boolean;     // email + in-app reminder before an event starts
    reminderMinutes?: number; // how many minutes before (default 30)
  };

  /** Moments — the reusable activity tags a shared moment can carry. */
  moments?: {
    activities?: { k: string; n: string; e: string; c: string }[];
  };

  /** Register — sign-in/out timestamps and which profile fields show when you
   *  tap a child on the register. */
  registers?: {
    timestamps?: boolean;   // show the time next to In / Collected
    requireCollectionPin?: boolean; // show the "collection PIN required" banner
    fields?: { contact?: boolean; emergency?: boolean; password?: boolean; school?: boolean };
    /** Which facts appear on a child's register card. Each defaults to on. */
    card?: {
      allergies?: boolean; medical?: boolean; dietary?: boolean; send?: boolean; swimming?: boolean;
      careNotes?: boolean; likes?: boolean; dislikes?: boolean; answers?: boolean; consents?: boolean;
      mainContact?: boolean; emergency?: boolean; password?: boolean; school?: boolean; bookingNotes?: boolean; attending?: boolean;
    };
    /** Which quick-link actions appear on each register row. Each defaults to on. */
    actions?: { firstAid?: boolean; incident?: boolean; medication?: boolean; message?: boolean; moments?: boolean; email?: boolean; whatsapp?: boolean };
  };

  /**
   * Marketing library — quotes and images an operator pushed from Moments to the
   * Email area, kept for reuse. Quotes carry their text; images store a snapshot
   * of exactly what to re-render (photo + baked caption/quotes/colour) so the
   * download matches the Moments preview without re-reading the live moment.
   */
  emailAssets?: {
    quotes?: SavedQuote[];
    images?: SavedImage[];
    /** Mirror every Moments photo into the Email area automatically as they're posted. */
    autoAddPhotos?: boolean;
  };

  /** Email signatures — reusable HTML blocks (logo + details) appended to a send.
   *  Managed + picked on the Email page's Compose tab. */
  emailSignatures?: { id: string; name: string; html: string }[];
  /** Which signature is pre-selected on a new email ("" / absent = none). */
  defaultSignatureId?: string;
  /** Email preferences (Email page → Settings tab). */
  emailPrefs?: {
    undoSeconds?: number;              // send-cancellation window: 0 (off) | 5 | 10 | 20 | 30
    defaultReply?: "reply" | "replyAll"; // which reply action leads in the inbox
    replySignatureId?: string;         // signature to use on replies/forwards ("" = none)
  };

  /** Inventory — reusable categories, storage locations and seasons. */
  inventory?: {
    categories?: string[];
    locations?: string[];
    seasons?: string[];
    currentSeason?: string;
    /** When a reorder is logged to Expenses, is it "paid" already or "pending" (owed). */
    orderExpenseStatus?: "paid" | "pending";
    /** Default Expenses category a reorder is filed under. */
    orderCategory?: string;
    /** Flag an item for a stock check if it hasn't been counted in this many days. */
    checkEveryDays?: number;
    /** Warn (and, later, notify) when an item hits its reorder level. */
    lowStockAlert?: boolean;
  };

  /**
   * Which dashboard modules this operator uses, keyed by nav view. A view is
   * hidden only when explicitly set `false` (absent = shown), so switching one
   * off hides it from the operator's own nav — and, for anything a family also
   * sees, cascades to the customer side (see useCustomerArea). The core of
   * running (bookings, listings, customers, finance, setup) is never listed and
   * can't be switched off (see CORE_VIEWS).
   */
  features: Record<string, boolean>;

  /**
   * What families see in their customer area. Each is ON by default; turning one
   * off hides that section from every family linked to this provider. The
   * essentials (bookings, payments, child profiles, "report a problem") aren't
   * here — those can't be hidden.
   */
  customerArea: {
    /**
     * Simple mode — strip the family area back to the booking essentials only
     * (browse activities, bookings, child profiles, account, support). When on,
     * it overrides every individual toggle below and hides everything else.
     */
    simpleMode: boolean;
    codesBanner: boolean; // the scrolling discount-codes ticker
    coupons: boolean;     // the Coupons & discount codes page
    newsfeed: boolean;    // your posts to families
    moments: boolean;     // "My child's day" photos
    messaging: boolean;   // families can message you
    wallet: boolean;      // store credit
    meals: boolean;       // meal ordering
    memberships: boolean; // memberships
    browse: boolean;      // browse more activities
    refer: boolean;       // the "Refer a friend" page
  };

  /**
   * Refer-a-friend — every family gets a personal link; a friend using it on
   * their FIRST booking gets `friendOff` off, and once that booking goes through
   * the referrer is issued a `referrerReward` code. The provider funds it, so
   * it's off by default and the amounts are theirs to set.
   */
  referral: {
    enabled: boolean;
    /** Whether the amounts below are pounds off or a percentage off. */
    type: "amount" | "percent";
    friendOff: number;      // £ (or %) off the friend's first booking
    referrerReward: number; // £ (or %) the referrer earns (as a code in their Coupons)
    minSpend: number;       // 0 = none; friend's basket must reach this
    /** Cap the referrer's reward to what the friend actually spent — you can
     *  never give away more than the referral brought in. */
    capToFriendSpend: boolean;
  };

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
  /** Whether to ask about dietary needs. Optional because not every provider
   *  serves food — a sports coach hiring a pitch has no use for it. */
  collectDietary: boolean;
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
  charLimits: { allergies: number; medical: number; dietary: number; send: number; likes: number; dislikes: number };

  // ── Bookings & payments ──
  payMethods: string[];
  cancellationReasons: CancelReason[];
  /**
   * What happens when a refund is due.
   *
   * "review" (the default) flags it and waits for the provider — which is what
   * happens today, since nothing moves money automatically.
   *
   * "auto" would issue it through Stripe without anyone clicking, for refunds
   * the policy calculates cleanly. Faster for parents and less admin, but a
   * refund is irreversible and a mistake can't be taken back, so it stays off
   * unless a provider deliberately turns it on.
   */
  refundApproval: "review" | "auto";
  /** Childcare-voucher schemes you're registered with, and your reference. */
  voucherProviders: VoucherProvider[];
  /**
   * How long a place is held while waiting for voucher money to arrive.
   *
   * One number for all schemes rather than per scheme: they all take roughly
   * the same few working days, and the thing being protected is the place, not
   * the scheme. Without a limit an unpaid voucher booking holds a place
   * forever — you lose the place and the money.
   */
  voucherHoldDays: number;
  /**
   * How long voucher money takes to reach you. Vouchers aren't offered at all
   * when a booking starts sooner than this — taking a payment that cannot
   * arrive in time just moves the problem to the morning of the camp.
   */
  voucherClearDays: number;
  /**
   * How many days before the first session the money must have arrived.
   * 0 means "by the day it starts"; 1 means "the day before", and so on.
   */
  voucherDueByDays: number;
  /** What to do when a booking starts sooner than the money can arrive. */
  voucherWhenClose: WhenTooClose;
  /**
   * The provider's own ratio groups — the standing rooms/bands children are
   * split into on the Ratios & groups board. Each has a colour, an age range,
   * a target staff ratio and a max size, and the whole board flows from them.
   * A tenant-level policy, not per session.
   */
  ratioGroups: RatioGroup[];
  /** Ask the operator why, when they cancel. Off = don't make them answer. */
  askReasonOperator: boolean;
  /** Ask the parent why, when they cancel their own booking. */
  askReasonParent: boolean;
  /**
   * The refund rules, one set per policy. A provider writes them here and
   * picks one when they build a listing — a holiday camp and a weekly club
   * rarely want the same notice period.
   *
   * Prose is generated from the bands rather than typed, so what a parent is
   * told and what the system works out can never disagree.
   */
  cancellationPolicies: NamedPolicy[];

  // ── Amending booking dates ──
  /** Can a parent move their own session dates, or must they request it? Off =
   *  a request you approve, like a cancellation. */
  amendSelfService: boolean;
  /** How close to a session it can still be moved. Stored in hours; the UI
   *  lets a provider enter it as hours or days. */
  amendNoticeHours: number;
  /** Most self-service moves allowed per booking (0 = endless) — stops one
   *  place being juggled endlessly. */
  amendLimit: number;
  /** Admin fee charged per amend, in whole pounds (0 = free). */
  amendFee: number;
  /** Whether a parent may move to a CHEAPER pass/date at all. */
  amendAllowCheaper: boolean;

  // ── Money back (governs both cancellation refunds and cheaper amends) ──
  /** Whether money can go back to the customer's card at all. Off means every
   *  refund is store credit (their wallet) — money never leaves the business. */
  allowCardRefund: boolean;
  /** When a card refund is allowed, does the customer choose card vs credit at
   *  the point of cancelling/moving, or does it always go back to card? */
  refundLetCustomerChoose: boolean;
  /** When the cancellation policy gives NO cash refund, still give the family a
   *  credit note for the FULL amount they paid, to spend on a future booking.
   *  On/off — they keep the value, you keep the cash. Off = a no-refund is
   *  simply nothing back. */
  noRefundCredit: boolean;
  /** Let a family release individual days of a multi-day pass (not just cancel
   *  the whole booking). What they can do with a released day is set by the
   *  three flags below — at least one must be on for the option to appear. */
  /** Whether families can change/move their booked dates at all. Off = the
   *  "Change dates" flow tells them up front it isn't offered for this listing. */
  allowDateChanges: boolean;
  allowPartialCancel: boolean;
  /** A released day's pro-rata value can be REFUNDED (cash, per the cancellation
   *  policy). The only option that lets a block discount leak — off by choice. */
  partialAllowRefund: boolean;
  /** A released day's pro-rata value can go to the family's WALLET as spend-later
   *  credit (stays in the business, instant). */
  partialAllowWallet: boolean;
  /** A released day can be MOVED to another of the listing's dates instead of
   *  cancelled. Only makes sense when the listing lets families pick days across
   *  your dates (not a fixed week) — off by default; provider opts in. */
  partialAllowChangeDate: boolean;

  // ── Listings ──
  defaultCapacity: number;
  defaultRunningDays: number[];
  showSpaces: boolean;

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
  providerName: "",
  providerNameMode: "business",
  marketplaceListed: false,
  features: {},
  customerArea: { simpleMode: false, codesBanner: true, coupons: true, newsfeed: true, moments: true, messaging: true, wallet: true, meals: true, memberships: true, browse: true, refer: true },
  referral: { enabled: false, type: "amount", friendOff: 10, referrerReward: 10, minSpend: 0, capToFriendSpend: true },
  requireDob: true,
  collectGender: true,
  genderOptions: ["Boy", "Girl", "Prefer not to say"],
  collectPhoto: true,
  collectDietary: true,
  askPhotoConsent: true,
  collectSend: true,
  collectSendPlan: true,
  emergencyContacts: 1,
  collectionCheck: "password",
  charLimits: { allergies: 140, medical: 140, dietary: 140, send: 200, likes: 80, dislikes: 80 },
  autoEmails: { bookings: true, payments: true, paymentDue: true, paymentDueTiming: 24, sessionReminder: true, sessionTiming: 48, waitlist: true, dayOf: true, lateCollection: true, announcements: false, reviewRequests: true },
  brandColor: "#2f6bd8",
  staff: { assignByLeads: false, requireDBS: true, requireCompliance: true, defaultRatioTarget: 8, inviteMessage: "" },
  learning: { trackTraining: true, observations: false, framework: "EYFS" },
  meals: { ordering: true, showAllergens: true, orderCutoffHours: 18, menuNote: "" },
  medication: { informParentGiven: true, informParentMissed: true, notifyParentNote: true, notifyParentAuthorise: true, remindWhenDue: true, requireWitness: false, leadsOnly: false },
  safeguarding: { notifyParentAccident: true, notifyParentIncident: false, notifyStaffAcknowledged: true, dslTitle: "Designated Safeguarding Lead (DSL)", contacts: { nspccPhone: "0808 800 5000", policePhone: "999 (emergency) / 101" } },
  trips: { notifyParent: true, requireConsent: true, ratioTarget: 8 },
  calendar: {
    categories: [
      { id: "general", name: "General", color: "#7A5AF8" },
      { id: "meeting", name: "Staff meeting", color: "#2AACE2" },
      { id: "training", name: "Training / INSET", color: "#0f9d58" },
      { id: "openday", name: "Open day", color: "#f0b100" },
      { id: "closure", name: "Closure / holiday", color: "#e07a5f" },
    ],
    reminderOn: true,
    reminderMinutes: 30,
  },
  moments: {
    activities: [
      { k: "art", n: "Arts & crafts", e: "🎨", c: "#be1259" }, { k: "sport", n: "Sports", e: "⚽", c: "#047857" },
      { k: "swim", n: "Swimming", e: "🏊", c: "#0369a1" }, { k: "food", n: "Lunch & snack", e: "🍎", c: "#b45309" },
      { k: "nature", n: "Outdoors", e: "🌳", c: "#0e7490" }, { k: "science", n: "Science", e: "🔬", c: "#6d28d9" },
      { k: "drama", n: "Drama", e: "🎭", c: "#c2410c" }, { k: "play", n: "Free play", e: "🧩", c: "#4338ca" },
    ],
  },
  emailAssets: { quotes: [], images: [] },
  emailSignatures: [],
  emailPrefs: { undoSeconds: 5, defaultReply: "reply" },
  registers: {
    timestamps: true,
    fields: { contact: true, emergency: true, password: true, school: true },
    card: { allergies: true, medical: true, dietary: true, send: true, swimming: true, careNotes: true, likes: true, dislikes: true, answers: true, consents: true, mainContact: true, emergency: true, password: true, school: true, bookingNotes: true, attending: true },
    actions: { firstAid: true, incident: true, medication: true, message: true, moments: true, email: true, whatsapp: true },
  },
  inventory: {
    categories: ["Sports equipment", "Arts & crafts", "First aid", "Stationery", "Catering", "Cleaning", "Uniform / kit"],
    locations: ["Main store", "Van", "Shed", "Office"],
    seasons: ["Summer 2026"],
    currentSeason: "Summer 2026",
    orderExpenseStatus: "paid",
    orderCategory: "Equipment",
    checkEveryDays: 30,
    lowStockAlert: true,
  },

  payMethods: ["Card", "Bank transfer", "Tax-Free Childcare", "Childcare vouchers", "HAF (funded £0)", "Free place", "Cash on the day"],
  cancellationReasons: DEFAULT_CANCEL_REASONS,
  voucherProviders: DEFAULT_VOUCHERS,
  voucherHoldDays: 7,
  voucherClearDays: 3,
  voucherDueByDays: 0,
  voucherWhenClose: "hide",
  ratioGroups: DEFAULT_RATIO_GROUPS,
  refundApproval: "review",
  askReasonOperator: true,
  askReasonParent: false,
  cancellationPolicies: DEFAULT_POLICIES,
  amendSelfService: true,
  amendNoticeHours: 48,
  amendLimit: 2,
  amendFee: 0,
  amendAllowCheaper: true,
  allowCardRefund: true,
  refundLetCustomerChoose: true,
  noRefundCredit: false,
  allowDateChanges: true,
  allowPartialCancel: true,
  partialAllowRefund: true,
  partialAllowWallet: true,
  partialAllowChangeDate: false,

  defaultCapacity: 60,
  defaultRunningDays: [1, 2, 3, 4, 5],
  showSpaces: true,

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
    features: { ...(s.features ?? {}) },
    customerArea: { ...DEFAULT_SETTINGS.customerArea, ...(s.customerArea ?? {}) },
    referral: { ...DEFAULT_SETTINGS.referral, ...(s.referral ?? {}) },
    charLimits: { ...DEFAULT_SETTINGS.charLimits, ...(s.charLimits ?? {}) },
    autoEmails: { ...DEFAULT_SETTINGS.autoEmails, ...(s.autoEmails ?? {}) },
    emailPrefs: { ...DEFAULT_SETTINGS.emailPrefs, ...(s.emailPrefs ?? {}) },
    staff: { ...DEFAULT_SETTINGS.staff, ...(s.staff ?? {}) },
    learning: { ...DEFAULT_SETTINGS.learning, ...(s.learning ?? {}) },
    meals: { ...DEFAULT_SETTINGS.meals, ...(s.meals ?? {}) },
    medication: { ...DEFAULT_SETTINGS.medication, ...(s.medication ?? {}) },
    safeguarding: { ...DEFAULT_SETTINGS.safeguarding, ...(s.safeguarding ?? {}), contacts: { ...DEFAULT_SETTINGS.safeguarding!.contacts, ...(s.safeguarding?.contacts ?? {}) } },
    trips: { ...DEFAULT_SETTINGS.trips, ...(s.trips ?? {}) },
    calendar: { ...DEFAULT_SETTINGS.calendar, ...(s.calendar ?? {}), categories: s.calendar?.categories ?? DEFAULT_SETTINGS.calendar!.categories },
    moments: { activities: s.moments?.activities?.length ? s.moments.activities : DEFAULT_SETTINGS.moments!.activities },
    registers: {
      timestamps: s.registers?.timestamps ?? true,
      requireCollectionPin: s.registers?.requireCollectionPin ?? false,
      fields: { ...DEFAULT_SETTINGS.registers!.fields, ...(s.registers?.fields ?? {}) },
      card: { ...DEFAULT_SETTINGS.registers!.card, ...(s.registers?.card ?? {}) },
      actions: { ...DEFAULT_SETTINGS.registers!.actions, ...(s.registers?.actions ?? {}) },
    },
    emailAssets: { quotes: s.emailAssets?.quotes ?? [], images: s.emailAssets?.images ?? [], autoAddPhotos: s.emailAssets?.autoAddPhotos ?? false },
    inventory: { ...DEFAULT_SETTINGS.inventory, ...(s.inventory ?? {}) },
    payMethods: s.payMethods?.length ? s.payMethods : DEFAULT_SETTINGS.payMethods,
    // Schemes held a single `reference` string before they held labelled
    // details. Lift rather than drop — a provider's account numbers are not
    // something to make them type again.
    voucherProviders: (s.voucherProviders ?? []).length
      ? (s.voucherProviders as unknown[]).map((v) => {
          const p = v as VoucherProvider & { reference?: string };
          if (p.details) return p;
          return { id: p.id, name: p.name, details: [{ id: `${p.id}-acc`, label: "Account number/ID", value: p.reference ?? "" }] };
        })
      : DEFAULT_SETTINGS.voucherProviders,
    cancellationPolicies: s.cancellationPolicies?.length ? s.cancellationPolicies : DEFAULT_SETTINGS.cancellationPolicies,
    // Reasons were a flat string[] before they were scoped. Anything stored
    // under the old shape is lifted rather than thrown away — a provider's own
    // wording is theirs, and it lands on "both", which is what it effectively
    // was.
    cancellationReasons: (s.cancellationReasons ?? []).length
      ? (s.cancellationReasons as unknown[]).map((r, i) =>
          // Old flat strings get a scope guessed from their wording rather
          // than all landing on "both" — otherwise every provider who already
          // had a list has to re-classify the whole thing by hand.
          typeof r === "string" ? { id: `r${i}`, label: r, who: inferWho(r) } : (r as CancelReason),
        )
      : DEFAULT_SETTINGS.cancellationReasons,
    genderOptions: s.genderOptions?.length ? s.genderOptions : DEFAULT_SETTINGS.genderOptions,
    ratioGroups: s.ratioGroups?.length ? s.ratioGroups : DEFAULT_SETTINGS.ratioGroups,
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

  // A save that has happened locally but may not be back from the server yet.
  // Until it settles, a realtime reload must not overwrite what's on screen.
  const quietUntil = useRef(0);
  const pending = useRef<LibraryShape>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    () =>
      apiGet<LibraryShape | null>("/api/library").then(
        (lib) => {
          setLoading(false);
          // Our own write echoes back down the realtime channel, and a
          // half-typed name would be replaced by whatever the server last
          // saw. Typing into a field and watching characters vanish is what
          // "it isn't editable" actually looks like.
          if (Date.now() < quietUntil.current) return;
          setSettings(withDefaults(lib?.settings));
          // An empty array is a real answer — the provider deleted every
          // question. Only an absent key means "never set up", which seeds
          // the ones that shipped as fixed columns.
          setQuestions(lib?.childQuestions ?? SEEDED_QUESTIONS);
          setError(null);
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

  const flush = useCallback(async () => {
    const body = pending.current;
    pending.current = {};
    if (!Object.keys(body).length) return;
    try {
      await api("/api/library", { method: "PUT", body: JSON.stringify(body) });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save — your change may not have stuck");
      quietUntil.current = 0;
      void load(); // put the UI back to what's actually stored
      return;
    }
    // Stay quiet a moment longer: the echo arrives after the write returns.
    quietUntil.current = Date.now() + 2_000;
  }, [load]);

  const save = useCallback(
    async ({ settings: next, questions: nextQ }: { settings?: TenantSettings; questions?: ChildQuestion[] }) => {
      // Optimistic: a toggle that waits for a round-trip before moving feels
      // broken, and this screen is nothing but toggles.
      if (next) {
        setSettings(next);
        pending.current.settings = next;
      }
      if (nextQ) {
        setQuestions(nextQ);
        pending.current.childQuestions = nextQ;
      }
      // Coalesce: a name being typed is one save, not one per keystroke.
      quietUntil.current = Date.now() + 10_000;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), 500);
    },
    [flush],
  );

  // Leaving the screen mid-keystroke must not lose the change.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      void flush();
    },
    [flush],
  );

  return { settings, questions, loading, save, error };
}

/**
 * Read-only settings for the screens that consume them (checkout, Families,
 * Bookings) rather than edit them. Falls back to the defaults on any error:
 * a parent must never be blocked from booking because a settings fetch failed.
 */
/**
 * Read-only settings for the screens that consume them.
 *
 * `tenantId` is for the signed-out booking page: a parent has no account, so
 * the authed /api/library 401s them and the public slice has to be fetched by
 * tenant instead. Operator screens omit it — they're always signed in — and
 * fall straight through to the authed read.
 *
 * Falls back to the defaults on any error: a parent must never be blocked from
 * booking because a settings fetch failed.
 */
export function useTenantSettings(tenantId?: string): { settings: TenantSettings; questions: ChildQuestion[]; ready: boolean } {
  const [state, setState] = useState<{ settings: TenantSettings; questions: ChildQuestion[]; ready: boolean }>({
    settings: DEFAULT_SETTINGS,
    questions: SEEDED_QUESTIONS,
    ready: false,
  });

  useEffect(() => {
    let live = true;
    const apply = (lib: LibraryShape | null) => {
      if (!live) return;
      setState({
        settings: withDefaults(lib?.settings),
        questions: lib?.childQuestions ?? SEEDED_QUESTIONS,
        ready: true,
      });
    };
    const publicRead = () =>
      tenantId
        ? apiGet<LibraryShape | null>(`/api/public/library/${tenantId}`).then(apply, () => live && setState((s) => ({ ...s, ready: true })))
        : (live && setState((s) => ({ ...s, ready: true })), Promise.resolve());

    // Signed-in read first; a parent (401, or no token) falls back to the
    // public slice keyed by the listing's tenant.
    apiGet<LibraryShape | null>("/api/library").then(apply, () => void publicRead());
    return () => {
      live = false;
    };
  }, [tenantId]);

  return state;
}
