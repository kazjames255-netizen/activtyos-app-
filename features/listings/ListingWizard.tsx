"use client";

import { deliveryLabel } from "./delivery";
import { dateLocale as dl } from "@/lib/i18n/format";
import { addonLinesFor } from "@/features/bookings/helpers";
import { useEffect, useMemo, useRef, useState } from "react";
import { GoLiveModal, fetchGoLive, goLiveReady } from "@/features/billing/GoLiveModal";
import { api, get as apiGet, post as apiPost, isDemoMode, ApiError } from "@/lib/api";
import { firebaseAuth } from "@/lib/firebase/client";
import { money, visitAddressLabel } from "@/features/bookings/helpers";
import { Button, Card, FieldLabel, Input, Select } from "@/components/ui";
import type { AddonQuestion, AddonTemplate, LocalState, StaffMember, Venue } from "./FreelancerListingsApp";
import { VenueMap } from "./VenueMap";
import * as blocksApi from "@/features/blocks/blocksApi";
import { uid, to12h, pHours, toggle, genDates, fmtDate, groupWeeks } from "./format";
import type { SavedMenu } from "@/features/meals/SavedMenus";
import { mealDayPlan, dishesForDay, type MealPlanValue } from "@/features/meals/plan";
import { useBooking, useOpensAt, type BasketItem } from "./booking";
import { LOW_LEFT, blockOn, capacityNote } from "./capacity";
import { useTenantSettings, useSettings, detailsForListing, DEFAULT_SETTINGS } from "@/lib/settings";
import { MatchedThemes } from "./MatchedThemes";
import { brandFromSettings } from "@/features/setup/BrandColours";
import { policyWording, type NamedPolicy } from "@/lib/cancellation";
import { CheckoutPanel } from "./checkout";
import { HMRC_CONNECTED, TFC_FAILURE_COPY, payBookings, type TfcChildPayment, type TfcFailure } from "./tfc";
import { ThemeHero, useThemeFont } from "./ThemeHero";
import { THEME_TOKENS, themeArtOn, NEW_THEME_KEYS, FONT_STACK, type NewThemeKey, type ThemeTokens } from "./pageThemes";
import { BlocksApp } from "@/features/blocks/BlocksApp";
import { listingPrereqs, titleMissing, mayCreateOnServer, isAbandonedDraft, newBlockId, bookingLink } from "./prereqs";
import type { ChildProfile } from "./checkout";
// Re-exported so existing importers don't have to care that these moved.
export { ageOn, ageProblem } from "./checkout";
export type { ChildProfile } from "./checkout";
import type { ResolvedPricing } from "@/features/blocks/blocksApi";

// ─────────────────────────────────────────────────────────────────────────
// The build-manual's 10-step Listing builder (freelancer). Front-end only:
// the whole draft persists to localStorage; on Publish, the listing name +
// derived tickets sync to /api/listings (the only part with a backend). Step 6
// reads the Blocks builder's saved blocks (localStorage) — Listings ↔ Blocks.
// Reusable option lists (provided/safety/send/outcomes/add-ons/staff) live in
// the shared listings store so they carry across every listing.
// ─────────────────────────────────────────────────────────────────────────


const STEPS = [
  { key: "basics", label: "Basics", stage: "About" },
  { key: "details", label: "Details", stage: "About" },
  { key: "capacity", label: "Capacity", stage: "About" },
  { key: "content", label: "Content", stage: "About" },
  { key: "provided", label: "Provided", stage: "About" },
  { key: "safety", label: "Safety & SEND", stage: "About" },
  { key: "run", label: "When it runs", stage: "When it runs" },
  { key: "tickets", label: "Tickets & pricing", stage: "Tickets & pricing" },
  { key: "discounts", label: "Discounts", stage: "Tickets & pricing" },
  { key: "addons", label: "Add-ons", stage: "Extras & team" },
  { key: "staff", label: "Staff", stage: "Extras & team" },
  // Preview last but one: there's nothing left to add, so what it shows is
  // what publishing will produce.
  { key: "preview", label: "Preview", stage: "Publish" },
  { key: "policy", label: "Policy & publish", stage: "Publish" },
] as const;

// Only the shapes that genuinely render differently. Multiple photos rotate as
// a carousel (see the note under the picker) — the old "Collage"/"Big +
// thumbnails" options did nothing and were removed.
const LAYOUTS = [
  { key: "big", label: "One big image · 1600×900px" },
  { key: "wide", label: "Wide banner · 1920×640px" },
];
const SECTION_TYPES = ["Summary", "What we'll do", "When you arrive", "Our curriculum"];
// Display keys for the stored (English) section names above.
const SECTION_TYPE_KEY: Record<string, string> = { "Summary": "waSec_summary", "What we'll do": "waSec_do", "When you arrive": "waSec_arrive", "Our curriculum": "waSec_curriculum" };
const WEEKDAYS: [number, string][] = [[1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"], [0, "Sun"]];
// Exact cancellation-policy wording from the build manual.
const CANCELLATION_POLICIES = [
  "No refunds are given except in the case of a cancellation by the organiser.",
  "Refunds are not generally available, but may be considered with sufficient notice.",
  "Cancel at least 24 hours before the start to receive a full refund.",
  "Cancel at least 48 hours before the start to receive a full refund.",
  "Cancel more than one week before the start to receive a full refund.",
  "Cancel more than two weeks before the start to receive a full refund.",
  "Free bookings do not require refunds, but as places are limited, please cancel if you cannot attend so your place can be offered to someone else.",
];
export type BookRule = "week" | "listing" | "blocks";
// "How parents can book each pass" — a visual option per rule: icon, short
// label, one-line hint and its own colour (kept simple on purpose).
const BOOK_RULES: { key: BookRule; icon: string; label: (d: number) => string; hint: (d: number) => string; color: string }[] = [
  { key: "week", icon: "📅", label: (d) => `Any ${d} days in a week`, hint: (d) => `Pick any ${d} days within one week.`, color: "#2f6bd8" },
  { key: "listing", icon: "🗓️", label: (d) => `Any ${d} days, any week`, hint: (d) => `Mix any ${d} days across all the weeks.`, color: "#7c3aed" },
  { key: "blocks", icon: "📦", label: (d) => `Whole ${d}-day block`, hint: () => `Sold as one fixed block — all days together.`, color: "#0f9d7a" },
];

function who() {
  return firebaseAuth.currentUser?.uid || firebaseAuth.currentUser?.email || "anon";
}

// ── Blocks builder data (read-only, from localStorage) ─────────────────────
interface BPeriod { id: string; title: string; start: string; finish: string }
interface BPass { id: string; name: string; days: number; details?: string }
interface BBlock {
  id: string; name: string; periodIds: string[]; passIds: string[];
  /** Creation order on the server (higher = newer). */
  order?: number;
  createdAt?: string;
  /** False until the provider has set prices (Blocks > Set prices). */
  priced?: boolean;
  masterPrice?: number; calcOn?: boolean; passFlat?: Record<string, number>; passMode?: Record<string, string>;
  periodPrice?: Record<string, number>; // key `${passId}_${periodId}`
}
interface BlocksStore {
  periods: BPeriod[];
  passes: BPass[];
  library: BBlock[];
  /** Server-resolved pricing per bundle id — authoritative when present. */
  resolved: Record<string, ResolvedPricing>;
  loading: boolean;
  error: string | null;
  /** Re-read the library (after the Blocks builder modal closes); resolves to the fresh store. */
  reload?: () => Promise<BlocksStore>;
}
const EMPTY_BLOCKS: BlocksStore = { periods: [], passes: [], library: [], resolved: {}, loading: true, error: null };

// Blocks live on the server (see features/blocks/blocksApi.ts). The server also
// resolves pricing, so we keep `resolved` and prefer it over local arithmetic.
async function fetchBlocks(): Promise<BlocksStore> {
  const [periodsR, passesR, bundlesR] = await Promise.all([
    blocksApi.listPeriods(),
    blocksApi.listPasses(),
    blocksApi.listBundles(),
  ]);
  // A brand-new account (or a demo without this data) can return null — treat it
  // as "no blocks yet" rather than crashing on .map.
  const periods = periodsR ?? [];
  const passes = passesR ?? [];
  const bundles = bundlesR ?? [];
  return {
    periods,
    passes,
    library: bundles.map((b) => ({
      id: b.id,
      name: b.name,
      periodIds: b.periodIds,
      passIds: b.passIds,
      order: (b as { order?: number }).order,
      createdAt: (b as { createdAt?: string }).createdAt,
      priced: b.priced,
      masterPrice: b.masterPrice ?? undefined,
      calcOn: b.calcOn,
      passFlat: b.passFlat,
      passMode: b.passMode,
      periodPrice: b.periodPrice,
    })),
    resolved: Object.fromEntries(bundles.map((b) => [b.id, b.resolved])),
    loading: false,
    error: null,
  };
}
/** Load the blocks library once per mount. */
function useBlocks(): BlocksStore {
  const [store, setStore] = useState<BlocksStore>(EMPTY_BLOCKS);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    void (async () => {
      try {
        const s = await fetchBlocks();
        if (alive.current) setStore(s);
      } catch (e) {
        // Surface it — "no blocks" and "couldn't fetch blocks" look identical
        // in the ticket picker otherwise.
        if (alive.current)
          setStore({ ...EMPTY_BLOCKS, loading: false, error: e instanceof Error ? e.message : "Couldn’t load your blocks." });
      }
    })();
    return () => {
      alive.current = false;
    };
  }, []);
  const reload = async () => {
    const s = await fetchBlocks();
    if (alive.current) setStore(s);
    return s;
  };
  return useMemo(() => ({ ...store, reload }), [store]); // eslint-disable-line react-hooks/exhaustive-deps
}
function blockTickets(store: BlocksStore, blockId: string | null) {
  const b = store.library.find((x) => x.id === blockId);
  if (!b) return [] as { name: string; days: number; price: number }[];
  // Server-resolved prices win — they're what checkout will charge.
  const res = blockId ? store.resolved[blockId] : undefined;
  if (res) return res.passes.map((p) => ({ name: p.name, days: p.days, price: p.price }));
  const passes = b.passIds.map((id) => store.passes.find((p) => p.id === id)).filter(Boolean) as BPass[];
  const sorted = [...passes].sort((a, c) => c.days - a.days);
  const master = sorted[0];
  const calcOn = b.calcOn !== false;
  const mPrice = b.masterPrice ?? 0;
  const perDay = calcOn && master && master.days ? mPrice / master.days : 0;
  return sorted.map((q, idx) => {
    const flat = b.passMode?.[q.id] === "flat";
    const price = idx === 0 ? mPrice : !calcOn ? b.passFlat?.[q.id] ?? 0 : flat ? b.passFlat?.[q.id] ?? 0 : q.days * perDay;
    return { name: q.name, days: q.days, price: Math.round(price * 100) / 100 };
  });
}
// 12-hour time label, e.g. "09:00" -> "9:00 AM"
export interface BookPass { id: string; name: string; days: number; basePrice: number; details?: string }
export interface BookPeriod { id: string; title: string; start: string; finish: string; range: string }
export type RunBlock = { id: string; name: string; startDate: string; endDate: string; capacity: number; spotsLeft: number; open: boolean; capacityScope?: "day" | "listing"; sessions?: { date: string; spotsLeft: number }[] };

/**
 * What counts as "running low" on a date. Flat-5 was wrong for small groups —
 * a 4-child tuition group would have shown the warning permanently, from its
 * first day. Scales to a quarter of the group, capped at 5.
 */

/**
 * How availability reads to a parent. Says there's room while there is, names
 * the number once it's running out, and never makes them do the arithmetic.
 */

/** Online venues have no address, map or travel — just joining details. */
/** One entry per pass + time slot actually booked (a basket can mix passes with different timings), with the days it covers. */
function slotsOf(lines: { pass: string; dates: string[]; timing?: string }[]): { pass: string; timing: string; dates: string[] }[] {
  const m = new Map<string, { pass: string; timing: string; dates: Set<string> }>();
  for (const l of lines) {
    const k = `${l.pass}|${l.timing ?? ""}`;
    const cur = m.get(k) ?? { pass: l.pass, timing: l.timing ?? "", dates: new Set<string>() };
    l.dates.forEach((d) => cur.dates.add(d));
    m.set(k, cur);
  }
  return [...m.values()].map((x) => ({ pass: x.pass, timing: x.timing, dates: [...x.dates].sort() }));
}

export { isOnlineVenue } from "./wizardRules";
import { isOnlineVenue, fixYear, runLooksWrong, saveStatusFor, onlineVenueChoice, deliveryPatch, dateProblem, todayIso, maxRunIso, periodDates, periodSpan, periodsProblem, setWeekOff } from "./wizardRules";

/** The dated run covering a date, when the server has told us about them. */

export interface BlockBooking { passes: BookPass[]; periods: BookPeriod[]; priceFor: (passId: string, periodId: string | null) => number }
// Full booking model for a block: passes with base prices, the timings
// (periods) parents choose from, and per-timing prices (mirrors the manual's
// hours-based calculator with per-cell overrides).
function blockBooking(store: BlocksStore, blockId: string | null): BlockBooking | null {
  const b = store.library.find((x) => x.id === blockId);
  if (!b) return null;
  const passList = (b.passIds.map((id) => store.passes.find((p) => p.id === id)).filter(Boolean) as BPass[]).sort((a, c) => c.days - a.days);
  const periodList = (b.periodIds.map((id) => store.periods.find((p) => p.id === id)).filter(Boolean) as BPeriod[]).sort((a, c) => pHours(c) - pHours(a));
  const calcOn = b.calcOn !== false;
  const master = passList[0];
  const mPrice = b.masterPrice ?? 0;
  const perDay = calcOn && master && master.days ? mPrice / master.days : 0;
  const baseH = periodList.length ? Math.max(...periodList.map(pHours)) : 1;
  const basePrice = (q: BPass, idx: number) => {
    const flat = b.passMode?.[q.id] === "flat";
    const price = idx === 0 ? mPrice : !calcOn ? b.passFlat?.[q.id] ?? 0 : flat ? b.passFlat?.[q.id] ?? 0 : q.days * perDay;
    return Math.round(price * 100) / 100;
  };
  // Server-resolved prices win — they're what checkout will charge.
  const res = blockId ? store.resolved[blockId] : undefined;
  const resolvedBase = new Map((res?.passes ?? []).map((p) => [p.id, p.price]));
  const passes: BookPass[] = passList.map((q, i) => ({
    id: q.id,
    name: q.name,
    days: q.days,
    basePrice: resolvedBase.get(q.id) ?? basePrice(q, i),
    details: q.details,
  }));
  const priceFor = (passId: string, periodId: string | null) => {
    const qi = passList.findIndex((p) => p.id === passId);
    if (qi < 0) return 0;
    const base = passes[qi].basePrice;
    if (!periodId) return base;
    const fromServer = res?.timings[`${passId}_${periodId}`];
    if (fromServer != null) return fromServer;
    const per = periodList.find((p) => p.id === periodId);
    if (!per) return base;
    const ov = b.periodPrice?.[`${passId}_${periodId}`];
    if (ov != null) return Math.round(ov * 100) / 100;
    return calcOn && baseH ? Math.round(((base * pHours(per)) / baseH) * 100) / 100 : 0;
  };
  return {
    passes,
    periods: periodList.map((p) => ({ id: p.id, title: p.title, start: p.start, finish: p.finish, range: `${to12h(p.start)}–${to12h(p.finish)}` })),
    priceFor,
  };
}

// ── Wizard draft ───────────────────────────────────────────────────────────
interface TicketOverride { ageFrom?: string; ageTo?: string; capacity?: string; hidden?: boolean }
export interface ListingImage { src: string; x: number; y: number; zoom: number }
export interface WizardDraft {
  id: string | null;
  title: string;
  images: ListingImage[];
  gallery: ListingImage[];
  layout: string;
  ageFrom: string;
  ageTo: string;
  categoryIds: string[];
  venueId: string | null;
  /** Where sessions happen: a fixed "venue" (the default), a "home-visit"
   *  provider who travels to the family, or "both" — a venue plus a coverage
   *  area for visits. Absent on older listings = "venue" (unchanged behaviour). */
  deliveryMode?: "venue" | "home-visit" | "both";
  /** Online listings: "platform" (our video room, default) or "own" (the provider's own link). */
  videoMode?: "platform" | "own";
  ownLink?: string;
  showLinkNow?: boolean;
  maxJoiners?: string;
  /** Where a home-visit ("home-visit" or "both") listing will travel to — either
   *  a flat list of postcode prefixes ("SW1", "SW2 1") or a radius in miles
   *  from the provider's base postcode. Checkout validates the family's service
   *  address against this before the booking is allowed. */
  coverageArea?: {
    mode: "postcodePrefixes" | "radius";
    postcodePrefixes?: string[];
    basePostcode?: string;
    radiusMiles?: number;
  } | null;
  /** Freelancer manual scheduling control (product decision: no algorithmic
   *  travel-time buffers for freelancers) — the minimum gap, in minutes, the
   *  provider wants between the end of one session and the start of the next.
   *  Plain no-overlap-plus-gap check, enforced when a booking is placed.
   *  Freelancer-editable; default 30. */
  minGapMinutes?: number;
  /** Which season this listing runs in (Setup → Seasons). Drives the season
   *  filter on Bookings, Audiences and money-in. Null = not set. */
  seasonId?: string | null;
  /** Optional on-the-day contact number, shown to parents ONLY while the camp
   *  is actually running (today within the run dates) — e.g. how to reach staff
   *  during sessions. Blank = not shown. */
  sitePhone?: string;
  /** Which off-platform payment methods this listing accepts (subset of the
   *  tenant's Setup → Payment methods). Card is ALWAYS accepted and isn't listed
   *  here. Undefined = accept everything the tenant offers (legacy default). */
  payMethods?: string[];
  allowOutOfRange: boolean;
  maxAttendees: string;
  capacityScope: "day" | "listing";
  /**
   * Optional per-age-group place caps, keyed by ratio-group id → max places.
   * On top of maxAttendees: total still applies, this limits each age band.
   * Front-end config only for now — enforcing it at booking needs the backend
   * (handoff §S). A blank/absent entry means no cap for that group.
   */
  ageCaps?: Record<string, number>;
  /** Whether age caps are in use — separate from the values, so the section
   *  can be on with every band left blank (no limit). */
  ageCapsOn?: boolean;
  showSpaces: boolean;
  /** Which category is featured on the hero image when several are chosen. */
  heroCategoryId?: string | null;
  /** Customer-page section headings, keyed by SECTION_KEYS — all editable. */
  headings?: Record<string, string>;
  descriptionSection: string;
  description: string;
  sections: { id: string; type: string; text: string }[];
  outcomes: string[];
  provided: string[];
  toBring: string[];
  safety: string[];
  send: string[];
  runFrom: string;
  runTo: string;
  blockMode: "weekly" | "custom";
  days: number[];
  datesOff: string[];
  /** Separate date ranges (e.g. a week now and another in 6 months). Absent = the single runFrom..runTo range. runFrom/runTo then hold their outer span. */
  runPeriods?: { from: string; to: string }[];
  blockId: string | null;
  /** Whether this listing offers meals. When on, the menu + allergens auto-show
   *  to parents at checkout, and `mealPlan` says which saved menu runs each day. */
  mealsEnabled?: boolean;
  /** Per-day meal schedule: run-date (ISO) → the menu + the dishes served that
   *  day ({ menuId, itemIds }). A legacy plain menu-id string = the whole menu.
   *  Built in the Meals area's per-listing planner (not the wizard). */
  mealPlan?: Record<string, MealPlanValue>;
  /** Server-embedded (GET /api/listings/:id): the saved menus referenced by
   *  mealPlan, resolved for parents so checkout can show the menu + allergens
   *  without the operator-only menu endpoint. Read-only — never edited here. */
  mealMenus?: SavedMenu[];
  ticketOverrides: Record<string, TicketOverride>;
  /** Server-computed (GET /api/listings): per pass name, the dates its own capacity is used up. Read-only. */
  passFullDates?: Record<string, string[]>;
  bookRules: Record<string, BookRule>;
  addonIds: string[];
  staffIds: string[];
  visibility: "public" | "hidden";
  opensAt?: string;              // local datetime; blank = open now
  /** Stop taking family bookings this many hours before each session ("" = none).
   *  The server enforces it at checkout; an operator's manual booking may override. */
  bookingCutoffHours?: string;
  bookingType: "auto" | "manual";
  waitlist: boolean;
  waitlistSize: string;
  /** Who decides when a place frees up — see step 11. */
  waitlistMode?: "manual" | "auto";
  cancellation: string;
  /** Which named policy this listing uses — see lib/cancellation.ts. */
  cancellationPolicyId?: string;
  discounts?: DiscountRule[];
  /** Server-set on the signed-in family's view: they already used a fixed-£ early bird this season. */
  earlyFixedUsed?: boolean;
  earlyFixedRef?: string;
  earlyFixedUnpaid?: boolean;
  status: "draft" | "live";
  archived?: boolean;
  pageStyle?: PageTheme;
  /** Draw the theme's artwork when the listing has no photo (default true; false = a plain themed header strip). A photo always wins. */
  themeArt?: boolean;
}
export type PageTheme = "playful" | "sport" | "emerald" | "teal" | "royal" | "aubergine" | "burgundy" | "terracotta" | "slate" | "crimson" | NewThemeKey;

// ── Automatic discounts ────────────────────────────────────────────────────
// The engine lives in ./discounts — shared verbatim with the server, which
// prices every parent booking with it. Re-exported so existing imports hold.
export { applyDiscounts, emptyRule, ruleSummary } from "./discounts";
export type { DiscountKind, DiscountLine, DiscountRule } from "./discounts";
import { emptyRule, ruleSummary, prettyRuleName, ruleDisplayName, type DiscountKind, type DiscountRule } from "./discounts";
import { useT, useI18n, useWord, tNow } from "@/lib/i18n/provider";
import { Rich } from "@/components/i18n/Rich";
import { PayModal } from "@/features/payments/PayModal";
import { OnlineSessionsPanel } from "@/features/onlinesessions/OnlineSessionsPanel";
import { pickPlural } from "@/lib/i18n/plural";
import { seasonDisplayName } from "@/lib/seasons";

// Every heading a parent sees, so the operator can reword all of them.
// `about` falls back to the editable "Section title" from step 2.
export const SECTION_KEYS = [
  { key: "about", label: "About the camp", eyebrow: "The camp", title: "How it runs" },
  { key: "learn", label: "What you'll learn", eyebrow: "What you'll learn", title: "Skills that stick" },
  { key: "included", label: "What's included", eyebrow: "What's included", title: "In the price" },
  { key: "safety", label: "Safety", eyebrow: "Safety", title: "Covered" },
  { key: "send", label: "SEND & accessibility", eyebrow: "SEND & access", title: "Everyone plays" },
  { key: "team", label: "Meet the team", eyebrow: "The team", title: "Your child's crew" },
  { key: "addons", label: "Optional add-ons", eyebrow: "Add-ons", title: "Extras" },
  { key: "gallery", label: "Gallery", eyebrow: "Gallery", title: "In action" },
] as const;
/** Display name for a library option. The seeded defaults (categories, what's provided, safety, SEND, outcomes) are stored in English; show them in the reader's language. Anything the operator typed shows as typed. */
export function optionLabel(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!slug) return name;
  const k = "p8lst.waOpt_" + slug;
  const r = tNow(k);
  return r !== k ? r : name;
}
export const WHERE_HEAD_DEFAULT = { eyebrow: "Where is it", title: "Location" };
/** The venue section's heading. Lives on the operator's library, not the listing — the same venue reads the same on every listing. */
export function whereHeading(local: LocalState): { eyebrow: string; title: string } {
  return {
    eyebrow: local.whereHeading?.eyebrow?.trim() || tNow("p7pg.h_where_eyebrow"),
    title: local.whereHeading?.title?.trim() || tNow("p7pg.h_where_title"),
  };
}

/** Heading for a section — the operator's wording if set, else the default. */
export function headingOf(d: WizardDraft, key: string, field: "eyebrow" | "title"): string {
  const def = SECTION_KEYS.find((s) => s.key === key);
  const custom = d.headings?.[`${key}.${field}`]?.trim();
  if (custom) return custom;
  if (key === "about" && field === "title" && d.descriptionSection.trim()) {
    // The four preset names are stored in English; show them in the reader's language (an operator's own wording is shown as typed).
    const presetKey = SECTION_TYPE_KEY[d.descriptionSection.trim()];
    return presetKey ? tNow("p8lst." + presetKey) : d.descriptionSection.trim();
  }
  if (!def) return "";
  const k = `p7pg.h_${key}_${field}`; const tv = tNow(k);
  return tv !== k ? tv : def[field];
}

/** Postcodes the server said it cannot find (filled by the "Recognised" lines under the coverage area as the provider types). A listing
 *  with one of these in its home-visit area cannot be published: it would otherwise show to every parent whatever their distance. */
const badPostcodes = new Set<string>();
const pcKey = (s: string) => s.trim().toUpperCase().replace(/\s+/g, "");
export function coverageHasBadPostcode(c: WizardDraft["coverageArea"] | undefined): boolean {
  if (!c) return false;
  const list = c.mode === "radius" ? (c.basePostcode ? [c.basePostcode] : []) : (c.postcodePrefixes ?? []);
  return list.some((p) => badPostcodes.has(pcKey(p)));
}

/**
 * What has to be true before a listing can be published. Each blocker names the
 * step that fixes it — "something's missing" without saying what is worse than
 * no check at all.
 */
export function publishBlockers(d: WizardDraft, ticketCount: number, visibleTicketCount?: number): { step: number; what: string }[] {
  // Referenced by key, not index — the steps get reordered and a stale number
  // would send someone to the wrong screen without failing.
  const at = (key: string) => Math.max(0, STEPS.findIndex((x) => x.key === key));
  const out: { step: number; what: string }[] = [];
  if (!d.title.trim()) out.push({ step: at("basics"), what: tNow("p8lst.waBlkName") });
  const homeVisit = d.deliveryMode === "home-visit" || d.deliveryMode === "both";
  if (d.deliveryMode !== "home-visit" && !d.venueId) out.push({ step: at("details"), what: tNow("p8lst.waBlkVenue") });
  if (d.videoMode === "own" && !/^https:\/\/[^\s/$.?#][^\s]*\.[^\s]+$/i.test((d.ownLink ?? "").trim())) out.push({ step: at("details"), what: tNow("p9tx.vmNeedLink") });
  if (homeVisit && !d.coverageArea) out.push({ step: at("details"), what: tNow("p8lst.waBlkArea") });
  else if (homeVisit && d.coverageArea?.mode === "postcodePrefixes" && !(d.coverageArea.postcodePrefixes ?? []).length)
    out.push({ step: at("details"), what: tNow("p8lst.waBlkPrefix") });
  else if (homeVisit && d.coverageArea?.mode === "radius" && (!d.coverageArea.basePostcode || !d.coverageArea.radiusMiles))
    out.push({ step: at("details"), what: tNow("p8lst.waBlkRadius") });
  if (d.runPeriods?.length && periodsProblem(d.runPeriods)) out.push({ step: at("run"), what: tNow("p8lst.wbPeriodsBad") });
  else if (!d.runFrom || !d.runTo) out.push({ step: at("run"), what: tNow("p8lst.waBlkDates") });
  else if (d.runTo < d.runFrom) out.push({ step: at("run"), what: tNow("p8lst.waBlkEndBefore") });
  else if (dateProblem(d.runTo) === "past" || dateProblem(d.runTo) === "far" || dateProblem(d.runFrom, todayIso(), 365) === "past") out.push({ step: at("run"), what: tNow("p8lst.waBlkPast") });
  else if (!periodDates(d, genDates).filter((x) => !(d.datesOff ?? []).includes(x)).length) {
    // The trap: a range that only covers days the operator has unticked.
    out.push({ step: at("run"), what: tNow("p8lst.waBlkNoDays") });
  }
  if (homeVisit && coverageHasBadPostcode(d.coverageArea)) out.push({ step: at("details"), what: tNow("p8lst.waBlkPcBad") });
  if (!d.blockId) out.push({ step: at("tickets"), what: tNow("p8lst.waBlkPickBlock") });
  else if (ticketCount === 0) out.push({ step: at("tickets"), what: tNow("p8lst.waBlkNoPasses") });
  else if (visibleTicketCount === 0) out.push({ step: at("tickets"), what: tNow("p8lst.waBlkAllHidden") });
  // Capacity is deliberately not required — left blank the listing just
  // doesn't show capacity anywhere, which is a legitimate way to run one.
  return out;
}

/**
 * A brand-new listing.
 *
 * `defaults` comes from Setup & features. It's optional so the handful of
 * callers that only need a shape (previews, tests) don't have to hold
 * settings — those keep the compiled-in values, which are the same numbers
 * the settings default to.
 */
export function emptyDraft(defaults?: {
  defaultCapacity: number;
  defaultRunningDays: number[];
  showSpaces: boolean;
  cancellationPolicies?: NamedPolicy[];
  /** The provider's saved default page theme (settings.defaultListingTheme): a NEW listing starts on it. */
  defaultListingTheme?: string;
}): WizardDraft {
  const firstLive = (defaults?.cancellationPolicies ?? [])[0];
  return {
    // In a walkthrough/demo, start with a sample hero photo already added so the
    // Basics step can show the real crop-and-move panel (a file upload can't be
    // driven from the tour). Real accounts always start empty.
    id: null, title: "", images: isDemoMode() ? [{ src: "/mockups/listing-hero-sample.svg", x: 50, y: 50, zoom: 100 }] : [], gallery: [], layout: "big", ageFrom: "", ageTo: "",
    categoryIds: [], venueId: null, deliveryMode: "venue", coverageArea: null, minGapMinutes: 0, seasonId: null, allowOutOfRange: false, maxAttendees: String(defaults?.defaultCapacity ?? 60), capacityScope: "listing", showSpaces: defaults?.showSpaces ?? true,
    descriptionSection: "Summary", description: "", sections: [], outcomes: [], provided: [], toBring: [], safety: [], send: [],
    runFrom: "", runTo: "", blockMode: "weekly", days: defaults?.defaultRunningDays ?? [1, 2, 3, 4, 5], datesOff: [], blockId: null,
    mealsEnabled: false, mealPlan: {},
    ticketOverrides: {}, bookRules: {}, addonIds: [], staffIds: [], visibility: "public", bookingType: "auto", waitlist: true, waitlistSize: "20", waitlistMode: "auto",
    // The first policy still in use — a new listing must never start on one
    // the provider has switched off.
    cancellation: firstLive ? policyWording({ ...firstLive, wording: undefined }) : CANCELLATION_POLICIES[3],
    cancellationPolicyId: firstLive?.id, discounts: [], status: "draft", pageStyle: defaults?.defaultListingTheme ? resolveTheme(defaults.defaultListingTheme) : "sport",
  };
}

function draftsKey() {
  return `activityos.listing-wizard.${who()}`;
}
export function loadDrafts(): Record<string, WizardDraft> {
  try {
    return JSON.parse(localStorage.getItem(draftsKey()) || "{}") as Record<string, WizardDraft>;
  } catch {
    return {};
  }
}
function saveDraft(key: string, d: WizardDraft) {
  try {
    const all = loadDrafts();
    all[key] = d;
    localStorage.setItem(draftsKey(), JSON.stringify(all));
  } catch {
    /* non-fatal */
  }
}
export function deleteDraft(key: string) {
  try {
    const all = loadDrafts();
    delete all[key];
    localStorage.setItem(draftsKey(), JSON.stringify(all));
  } catch {
    /* non-fatal */
  }
}
export function getDraftVisibility(key: string): WizardDraft["visibility"] {
  return loadDrafts()[key]?.visibility ?? "public";
}
export function setDraftVisibility(key: string, vis: WizardDraft["visibility"]) {
  try {
    const all = loadDrafts();
    all[key] = { ...(all[key] ?? { ...emptyDraft(), id: key }), visibility: vis };
    localStorage.setItem(draftsKey(), JSON.stringify(all));
  } catch {
    /* non-fatal */
  }
}
export function getDraftArchived(key: string): boolean {
  return !!loadDrafts()[key]?.archived;
}
export function copyDraft(fromKey: string, toKey: string, overrides: Partial<WizardDraft>) {
  try {
    const all = loadDrafts();
    const src = all[fromKey];
    if (!src) return;
    all[toKey] = { ...src, id: toKey, ...overrides };
    localStorage.setItem(draftsKey(), JSON.stringify(all));
  } catch {
    /* non-fatal */
  }
}
export function setDraftArchived(key: string, archived: boolean) {
  try {
    const all = loadDrafts();
    all[key] = { ...(all[key] ?? { ...emptyDraft(), id: key }), archived };
    localStorage.setItem(draftsKey(), JSON.stringify(all));
  } catch {
    /* non-fatal */
  }
}

// Summary bits for the Listings-tab row (image, dates, total days).
export function listingRowInfo(draft: WizardDraft): { cover: ListingImage | null; dateLabel: string | null; from: string; to: string; totalDays: number; capacity: number | null; capacityScope: "day" | "listing"; showSpaces: boolean; live: boolean; opensAt: string } {
  const imgs = ((draft.images as unknown as (string | ListingImage)[]) || []).map((im) => (typeof im === "string" ? { src: im, x: 50, y: 50, zoom: 100 } : im));
  const dates = periodDates(draft, genDates).filter((x) => !(draft.datesOff || []).includes(x));
  // Show the year when the run leaves the current one — otherwise a mistyped
  // end year looks identical to a normal range while quietly inflating the
  // day count.
  const thisYear = new Date().getUTCFullYear();
  const yearOf = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCFullYear();
  const showYear = !!draft.runFrom && !!draft.runTo && (yearOf(draft.runFrom) !== thisYear || yearOf(draft.runTo) !== thisYear || yearOf(draft.runFrom) !== yearOf(draft.runTo));
  const withYear = (iso: string) => (showYear ? `${fmtDate(iso)} ${yearOf(iso)}` : fmtDate(iso));
  const dateLabel = draft.runFrom && draft.runTo ? `${withYear(draft.runFrom)} – ${withYear(draft.runTo)}` : null;
  const capacity = parseInt(draft.maxAttendees, 10) || null;
  return { cover: imgs[0] || null, dateLabel, from: draft.runFrom, to: draft.runTo, totalDays: dates.length, capacity, capacityScope: draft.capacityScope, showSpaces: draft.showSpaces, live: listingIsLive(draft), opensAt: draft.opensAt ?? "" };
}

// Has the run finished? Nothing to do with publication — a published
// listing whose last date has passed is "Ended", an unpublished one is neither.
export function listingIsLive(draft: WizardDraft): boolean {
  if (!draft.runTo) return true;
  return draft.runTo >= new Date().toISOString().slice(0, 10);
}

// True if the listing has a live running day on the given ISO date.
export function listingRunsOn(draft: WizardDraft, iso: string): boolean {
  if (!iso) return true;
  return periodDates(draft, genDates).includes(iso) && !(draft.datesOff || []).includes(iso);
}

// True while the camp is currently on — today within the run window. Gates the
// on-the-day contact number, which parents should only see during the camp.
export function listingRunningNow(draft: WizardDraft): boolean {
  if (!draft.runFrom || !draft.runTo) return false;
  const today = new Date().toISOString().slice(0, 10);
  return today >= draft.runFrom && today <= draft.runTo;
}

// Swap any data-URL images for uploaded ones (POST /api/uploads → URL).
// Already-uploaded images pass through untouched, so re-saving is free.
async function uploadImages(arr: ListingImage[]): Promise<ListingImage[]> {
  return Promise.all(
    (arr ?? []).map(async (im) =>
      im.src.startsWith("data:")
        ? { ...im, src: (await apiPost<{ url: string }>("/api/uploads", { dataUrl: im.src })).url }
        : im,
    ),
  );
}

// ── Server-persisted listings ──────────────────────────────────────────────
// GET /api/listings/:id returns the draft fields verbatim plus everything the
// customer page needs resolved server-side: dated blocks, the block bundle's
// prices/timings, and the slice of the tenant library the listing references.
export interface ServerListing extends Omit<Partial<WizardDraft>, "id"> {
  id: string;
  name: string;
  tenantId?: string;
  tenantName?: string;
  /** Set by the API for a head office: which franchise owns the listing (null/absent = head office's own). */
  franchiseId?: string | null;
  /** Optimistic-concurrency stamp (server-set) — send back as `expectedUpdatedAt`
   *  on PUT so a stale tab's autosave is refused instead of silently reverting
   *  someone else's more recent edit. */
  updatedAt?: number;
  passes: { name: string; price: number; days?: number }[];
  blocks?: { id: string; name: string; startDate: string; endDate: string; capacity: number; spotsLeft: number; open: boolean }[];
  bundle?: {
    id: string;
    name: string;
    passes: { id: string; name: string; days: number; price: number; details?: string }[];
    timings: Record<string, number>;
    periods: { id: string; title: string; start: string; finish: string }[];
  } | null;
  library?: {
    venue: { id: string; name: string; address: string } | null;
    addons: LocalState["addons"];
    staff: LocalState["staff"];
    categories: { id: string; name: string }[];
  } | null;
}

/** A server listing doc → the WizardDraft shape everything here renders. */
export function draftFromListing(l: ServerListing): WizardDraft {
  const norm = (arr: unknown) =>
    ((arr as (string | ListingImage)[]) || []).map((im) => (typeof im === "string" ? { src: im, x: 50, y: 50, zoom: 100 } : im));
  return {
    ...emptyDraft(),
    ...l,
    id: l.id,
    title: (l.title ?? l.name) || "",
    images: norm(l.images),
    gallery: norm(l.gallery),
    bookRules: l.bookRules ?? {},
    ticketOverrides: l.ticketOverrides ?? {},
    passFullDates: l.passFullDates ?? undefined,
  };
}

/** Booking model from the server's resolved bundle (parents can't read the
 * operator blocks-builder endpoints — /:id embeds everything they need). */
export function bookingFromBundle(bundle: ServerListing["bundle"]): BlockBooking | null {
  if (!bundle || !bundle.passes.length) return null;
  const passes: BookPass[] = bundle.passes.map((p) => ({ id: p.id, name: p.name, days: p.days, basePrice: p.price, details: p.details }));
  const periods: BookPeriod[] = [...bundle.periods]
    .sort((a, b) => pHours(b) - pHours(a))
    .map((p) => ({ id: p.id, title: p.title, start: p.start, finish: p.finish, range: `${to12h(p.start)}–${to12h(p.finish)}` }));
  const priceFor = (passId: string, periodId: string | null) => {
    const base = passes.find((p) => p.id === passId)?.basePrice ?? 0;
    if (!periodId) return base;
    return bundle.timings[`${passId}_${periodId}`] ?? base;
  };
  return { passes, periods, priceFor };
}

/**
 * Drop passes hidden on this listing (`ticketOverrides[name].hidden`) from a
 * booking, so the parent never sees them. The block is untouched — this is a
 * per-listing choice applied at the point the customer page reads passes.
 * Returns null when nothing bookable remains (publish blocks all-hidden, so in
 * practice this only bites on a half-built draft).
 */
function withoutHiddenPasses(booking: BlockBooking | null, overrides: Record<string, TicketOverride>): BlockBooking | null {
  if (!booking) return booking;
  const passes = booking.passes.filter((p) => overrides[p.name]?.hidden !== true);
  return passes.length ? { ...booking, passes } : null;
}

/** The customer page a PARENT sees — rendered purely from the API's
 * GET /api/listings/:id response, so it is pixel-for-pixel the operator's
 * "Preview as a parent" (same ParentPreview component, same data shape). */
export function CustomerPage({ listing, topRight, bookingOnly, logo }: { listing: ServerListing; topRight?: React.ReactNode; bookingOnly?: boolean; logo?: string | null }) {
  const t = useT();
  const d = draftFromListing(listing);
  const { settings: tSettings } = useTenantSettings();
  const [bookState, setBookState] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });
  const [done, setDone] = useState<{ holdCard?: boolean; cardDue?: number; bank?: { bankName?: string; accountName?: string; sortCode?: string; accountNumber?: string; reference: string; amount?: number }; waitlisted?: boolean; waitOffer?: number; refs: string[]; total: number; children: string[]; passes: string[]; firstDate?: string; lastDate?: string; dates?: string[]; slots?: { pass: string; timing: string; dates: string[] }[]; voucherScheme?: string; voucherDetails?: { label: string; value: string }[]; needsApproval?: boolean; payByCard?: boolean; payCash?: boolean; listPrice?: number; discountOff?: number; discountNames?: string[]; visitAt?: string; extras?: string[]; tfcPaid?: Extract<TfcChildPayment, { ok: true }>[]; tfcFailure?: { failure: TfcFailure; uncertain?: boolean } } | null>(null);
  const [payClosed, setPayClosed] = useState(false);
  const [paidNow, setPaidNow] = useState(false);
  const [payInstead, setPayInstead] = useState(false); // bank-transfer done screen: "Pay by card instead" opens the card form
  const [savedChildren, setSavedChildren] = useState<ChildProfile[]>([]);
  useEffect(() => {
    // Signed out this 401s, which just means there's nothing saved to match.
    apiGet<ChildProfile[]>("/api/my/children").then(setSavedChildren).catch(() => {});
  }, []);
  const lib = listing.library;
  const local: LocalState = {
    categories: lib?.categories ?? [],
    venues: lib?.venue ? [lib.venue] : [],
    provided: [],
    toBring: [],
    safety: [],
    send: [],
    outcomes: [],
    addons: lib?.addons ?? [],
    staff: lib?.staff ?? [],
    emojis: {},
  };
  // The basket is per child and per date; the API takes one block per call, so
  // a basket spanning two weeks goes as two calls. Flagged to Amir — the server
  // is the better place to accept a mixed basket.
  async function book(basket: BasketItem[], dayAssign: Record<string, Record<string, string[]>>, addonSel: Record<string, Record<string, string[]>>, method: string, children: ChildProfile[] = [], addonAns: Record<string, Record<string, string>> = {}, voucherScheme?: string, discountCodes?: string[], voucherRefs?: Record<string, string>, walletCap?: number, phone?: string, mealSel: Record<string, string> = {}, serviceAddress?: { address: string; postcode: string }, tfc?: { amount: number; remainderVia: string; references: Record<string, string> }) {
    setBookState({ busy: true, error: null });
    try {
      // Save children we haven't seen before, so next time is one tap. A
      // failure here mustn't cost them the booking — it's a convenience.
      // Only children we haven't got a profile for. Matching on name as well
      // as id stops a second booking saving "sally" all over again — that's
      // how the saved list ended up with the same child three times.
      const known = new Set(savedChildren.map((c) => c.name.trim().toLowerCase()));
      await Promise.all(
        children
          .filter((c) => !c.id && c.name.trim() && !known.has(c.name.trim().toLowerCase()))
          .map((c) => apiPost("/api/my/children", c).catch(() => null)),
      );
      // One line per child per pass, holding only the days that child is on —
      // a family where one sibling skips Wednesday is two different bookings.
      type Line = { blockId: string; pass: string; dates: string[]; child: string; itemId: string; periodId?: string; timing?: string };
      const lines: Line[] = [];
      for (const item of basket) {
        const perChild = new Map<string, string[]>();
        for (const iso of item.dates) {
          for (const name of dayAssign[item.id]?.[iso] ?? []) {
            perChild.set(name, [...(perChild.get(name) ?? []), iso]);
          }
        }
        for (const [child, dates] of perChild) {
          const blk = blockOn(listing.blocks, dates[0]);
          if (!blk) throw new Error(t("p7cl.errClosed"));
          lines.push({ blockId: blk.id, pass: item.name, dates, child, itemId: item.id, periodId: item.periodId, timing: item.timing });
        }
      }
      if (!lines.length) throw new Error(t("p7cl.errNobody"));
      const byBlock = new Map<string, Line[]>();
      for (const l of lines) byBlock.set(l.blockId, [...(byBlock.get(l.blockId) ?? []), l]);
      const refs: string[] = [];
      let total = 0;
      let listSum = 0, offSum = 0, waitOffer = 0; const offNames = new Set<string>(); const extraLines: string[] = [];
      let voucherDetails: { label: string; value: string }[] | undefined;
      let bankPay: { bankName?: string; accountName?: string; sortCode?: string; accountNumber?: string; reference: string; amount?: number } | undefined;
      let heldForApproval = false;
      let holdCard = false; // manual approval + card: the card is held now, taken only if the provider approves
      let seated = false; // any booking the server actually placed (not Waitlisted)
      // A basket spanning two blocks POSTs twice; discount codes must ride on
      // just ONE of them, or they'd come off each block's subtotal (and count as
      // extra redemptions). They apply to the first — the server re-validates.
      let codesSent = false;
      // A capped wallet spend is a total for the whole basket, so — like codes —
      // it rides on just the FIRST block's POST; later blocks send 0 so the
      // family never spends more than they chose. Undefined = auto-apply all
      // (omit it entirely and let the server draw it down across the blocks).
      let walletSent = false;
      let tfcSent = false;
      for (const [blockId, items] of byBlock) {
        const sendCodes = discountCodes && discountCodes.length > 0 && !codesSent;
        if (sendCodes) codesSent = true;
        const walletThisPost = walletCap === undefined ? undefined : walletSent ? 0 : walletCap;
        if (walletCap !== undefined) walletSent = true;
        const tfcThisPost = tfc && !tfcSent; if (tfcThisPost) tfcSent = true;
        const res = await apiPost<{ bookings: { ref: string; status?: string }[]; total: number; bank?: { bankName?: string; accountName?: string; sortCode?: string; accountNumber?: string; reference: string; amount?: number }; voucher?: { scheme: string; details: { label: string; value: string }[] } }>("/api/my/bookings", {
          listingId: listing.id,
          blockId,
          method,
          ...(voucherScheme ? { voucherScheme } : {}),
          // Part-paid Tax-Free Childcare: HMRC's share and how the rest is settled (rides on the first POST only, like wallet/codes).
          ...(tfcThisPost && tfc ? { tfc: { amount: tfc.amount, remainderVia: tfc.remainderVia } } : {}),
          ...(sendCodes ? { discountCodes } : {}),
          ...(walletThisPost !== undefined ? { walletCap: walletThisPost } : {}),
          ...(phone?.trim() ? { phone: phone.trim() } : {}),
          ...(serviceAddress?.postcode?.trim() ? { serviceAddress } : {}),
          items: items.map((l) => {
            // That child's own extras on that line, with the days they picked.
            const sel = addonSel[`${l.itemId}|${l.child}`] ?? {};
            const addons = Object.entries(sel).map(([id, days]) => {
              // Answers ride with the add-on they belong to, so the provider
              // reads "tshirt — Age 7-8" rather than a size with no owner.
              const ans = addonAns[`${l.itemId}|${l.child}|${id}`] ?? {};
              return {
                id,
                ...(days[0] === "*" ? {} : { days }),
                ...(Object.keys(ans).length ? { answers: ans } : {}),
              };
            });
            // Meals this child chose on this line's days → {menuItemId, date}.
            const meals = l.dates
              .map((dt) => ({ dt, id: mealSel[`${l.child}|${dt}`] }))
              .filter((m) => m.id)
              .map((m) => ({ menuItemId: m.id, date: m.dt }));
            // periodId makes the server price the chosen timing, not the base pass.
            // Their answers to the provider's "every booking" questions ride with the line (the server keeps only those).
            const kidAnswers = children.find((c) => c.name.trim() === l.child)?.answers;
            return { pass: l.pass, dates: l.dates, child: l.child, ...(kidAnswers && Object.keys(kidAnswers).length ? { answers: kidAnswers } : {}), ...(l.periodId ? { periodId: l.periodId } : {}), ...(voucherRefs?.[l.child]?.trim() ? { paymentRef: voucherRefs[l.child].trim() } : {}), ...(addons.length ? { addons } : {}), ...(meals.length ? { meals } : {}) };
          }),
        });
        refs.push(...res.bookings.map((x) => x.ref));
        // the server's own verdict: an auto-confirm listing still holds the place for approval when, say, a child is outside the listing's age range
        if (res.bookings.some((x) => x.status === "Approval needed")) heldForApproval = true;
        if ((res.bookings as { cardHold?: { state?: string } }[]).some((x) => x.cardHold?.state === "awaiting")) holdCard = true;
        if (res.bookings.some((x) => x.status !== "Waitlisted")) seated = true;
        total += res.total;
        for (const x of res.bookings as { status?: string; amount?: number; listPrice?: number; discountOff?: number; discountNames?: string[]; addons?: string[]; addonLines?: { child: string; label: string; price: number }[]; kids?: unknown[] }[]) { addonLinesFor(x).forEach((l) => extraLines.push(l)); if (x.status === "Waitlisted") waitOffer += x.amount ?? 0; listSum += x.listPrice ?? x.amount ?? 0; offSum += x.discountOff ?? 0; (x.discountNames ?? []).forEach((n) => offNames.add(n)); }
        if (res.voucher?.details?.length) voucherDetails = res.voucher.details;
        if (res.bank) bankPay = res.bank;
      }
      // Tax-Free Childcare with HMRC connected: ask HMRC to pay the provider now,
      // from each child's linked TFC account. The server works out what is owed
      // from the bookings just made; a waiting-list place owes nothing. Any
      // failure leaves the booking exactly as before — awaiting the scheme's
      // money — and the family gets the manual instructions below.
      let tfcPaid: Extract<TfcChildPayment, { ok: true }>[] | undefined;
      let tfcFailure: { failure: TfcFailure; uncertain?: boolean } | undefined;
      if (/^tfc$/i.test(String(method)) && HMRC_CONNECTED && seated && listing.tenantId) {
        const r = await payBookings({ tenantId: listing.tenantId, refs });
        const ok = (r.payments ?? []).filter((x): x is Extract<TfcChildPayment, { ok: true }> => x.ok);
        if (ok.length) tfcPaid = ok;
        if (!r.ok && !r.nothingDue) tfcFailure = { failure: r.failure ?? "connection-failed", ...(r.uncertain ? { uncertain: true } : {}) };
      }
      const allDates = lines.flatMap((l) => l.dates).sort();
      setDone({
        ...(tfcPaid ? { tfcPaid } : {}),
        ...(tfcFailure ? { tfcFailure } : {}),
        refs,
        total,
        ...(extraLines.length ? { extras: extraLines } : {}),
        ...(offSum > 0.004 ? { listPrice: Math.round(listSum * 100) / 100, discountOff: Math.round(offSum * 100) / 100, discountNames: [...offNames] } : {}),
        children: [...new Set(lines.map((l) => l.child))],
        passes: [...new Set(lines.map((l) => l.pass))],
        firstDate: allDates[0],
        lastDate: allDates[allDates.length - 1],
        dates: [...new Set(allDates)],
        slots: slotsOf(lines),
        voucherScheme,
        voucherDetails,
        bank: bankPay,
        ...(serviceAddress?.postcode?.trim() ? { visitAt: visitAddressLabel(serviceAddress) } : {}),
        needsApproval: heldForApproval,
        ...(holdCard ? { holdCard: true } : {}),
        waitlisted: !seated,
        ...(!seated && waitOffer > 0 ? { waitOffer: Math.round(waitOffer * 100) / 100 } : {}),
        payByCard: (/^card$/i.test(String(method)) || (/^tfc$/i.test(String(method)) && /^card$/i.test(tfc?.remainderVia ?? "") && (tfc?.amount ?? 0) < total)) && seated,
        // Part-paid TFC: the card remainder the family pays now (the HMRC share is awaited, shown via the scheme card).
        ...(/^tfc$/i.test(String(method)) && /^card$/i.test(tfc?.remainderVia ?? "") && (tfc?.amount ?? 0) < total ? { cardDue: Math.round((total - (tfc?.amount ?? 0)) * 100) / 100 } : {}),
        payCash: /^cash$/i.test(String(method)) && seated && total > 0,
      });
    } catch (e) {
      setBookState({ busy: false, error: e instanceof Error ? e.message : t("p7cl.errBooking") });
      return;
    }
    setBookState({ busy: false, error: null });
  }

  if (done) {
    const venue = lib?.venue;
    const fmtDay = (iso?: string) =>
      iso ? new Date(`${iso}T00:00:00`).toLocaleDateString(dl(), { weekday: "short", day: "numeric", month: "short", ...(Number(iso.slice(0, 4)) !== new Date().getFullYear() ? { year: "numeric" as const } : {}) }) : null;
    // Say exactly which days were booked: a run of consecutive days (weekends skipped) reads "Mon 19 Oct – Fri 23 Oct", but two or three
    // separate days read "Mon 19 Oct and Fri 23 Oct" (not a range that implies every day in between).
    const ds = done.dates ?? [];
    const dayNo = (iso: string) => Math.round(new Date(`${iso}T00:00:00Z`).getTime() / 86_400_000);
    const runsOn = ds.length > 1 && ds.every((iso, i) => i === 0 || dayNo(iso) - dayNo(ds[i - 1]) === 1 || (new Date(`${ds[i - 1]}T00:00:00Z`).getUTCDay() === 5 && dayNo(iso) - dayNo(ds[i - 1]) === 3));
    const when =
      ds.length > 1 && !runsOn
        ? (ds.length <= 6 ? new Intl.ListFormat(dl(), { style: "long", type: "conjunction" }).format(ds.map((d) => fmtDay(d) ?? d)) : `${ds.length} days, ${fmtDay(ds[0])} – ${fmtDay(ds[ds.length - 1])}`)
        : done.firstDate && done.lastDate && done.lastDate !== done.firstDate
          ? `${fmtDay(done.firstDate)} – ${fmtDay(done.lastDate)}`
          : fmtDay(done.firstDate);
    const kids = done.children.length > 1 ? new Intl.ListFormat(dl(), { style: "long", type: "conjunction" }).format(done.children) : done.children.join(", ");
    const where = (venue as { kind?: string } | null | undefined)?.kind === "online" ? t("p8lst.dlvOnline") : venue?.name ? [venue.name, venue.address].filter(Boolean).join(", ") : null;
    // Voucher bookings are NOT paid yet — the family pays through their scheme's
    // own site. Surface that + a link, instead of a false "paid".
    const scheme = done.voucherScheme;
    // A manual-approval listing holds the place until the provider says yes —
    // nothing is confirmed or charged until then.
    // what the server actually decided (a manual listing, or an auto-confirm one that held the place, e.g. a child outside the age range)
    const needsApproval = done.needsApproval ?? d.bookingType === "manual";
    const provider = scheme ? (tSettings.voucherProviders ?? []).find((v) => v.name === scheme) : undefined;
    // The right account/Ofsted/reference for this listing's setting — shown on
    // the card so the family can pay without hunting through the email.
    // Prefer the details the SERVER resolved and emailed (done.voucherDetails);
    // fall back to a client-side resolve for older cached bookings.
    const vDetails = done.voucherDetails?.length
      ? done.voucherDetails
      : provider ? detailsForListing(provider, { listingId: listing.id, locationId: (listing as { venueId?: string | null }).venueId }) : [];
    const websiteD = vDetails.find((d) => /website|url|link|portal/i.test(d.label) || /^https?:\/\//i.test(d.value));
    const website = websiteD ? (/^https?:\/\//i.test(websiteD.value) ? websiteD.value : `https://${websiteD.value}`) : null;
    const isUrlD = (d: { label: string; value: string }) => /website|url|link|portal/i.test(d.label) || /^https?:\/\//i.test(d.value);
    // The same test as the "Pay now" button below: a card booking with money still to pay is held, not yet complete.
    // Once the card has been paid the booking is complete: no more 'Nearly there - pay to finish' (an auto-confirm listing is simply booked).
    const awaitingCard = !paidNow && !!done.payByCard && !needsApproval && !done.waitlisted && (!scheme || !!done.cardDue) && (done.cardDue ?? done.total) > 0;
    const rowCls = "flex items-start gap-3 py-1.5 text-[13px]";
    const labCls = "w-[92px] flex-none text-[#8a86a3]";
    const valCls = "font-semibold text-[#171534]";
    return (
      <div className="mx-auto max-w-[540px] p-6 text-center">
        <div className="text-[44px]">{done.waitlisted ? "⏳" : needsApproval ? "📩" : awaitingCard ? "💳" : "🎉"}</div>
        <h2 className="mt-2 text-[24px] font-extrabold tracking-[-0.01em] text-[#171534]" style={{ color: "#171534" }}>
          {done.waitlisted
            ? (kids ? t("p9tx.ckWaitFor", { kids }) : t("p9tx.ckWait"))
            : needsApproval
            ? (kids ? t("p7cl.reqReceivedFor", { kids }) : t("p7cl.reqReceived"))
            : awaitingCard
            ? (kids ? t("p9tx.ckNearlyFor", { kids }) : t("p9tx.ckNearly"))
            : (kids ? t(done.children.length > 1 ? "p7cl.bookedKidsMany" : "p7cl.bookedKids", { kids }) : t("p7cl.bookedYou"))}
        </h2>
        <p className="mt-1.5 text-[13px] text-[#6a6785]">
          {done.waitlisted
            ? t("p9tx.ckWaitBody")
            : needsApproval
            ? t(scheme ? "p7cl.approvalBodyScheme" : "p7cl.approvalBody", { provider: listing.tenantName || t("p7cl.theProvider") })
            : awaitingCard
            ? t("p9tx.ckHeldBody")
            : t("p7cl.confirmEmail")}
        </p>

        <div className="mt-4 overflow-hidden rounded-2xl border border-[#e6e9f2] bg-white text-start shadow-[0_10px_30px_-14px_rgba(20,30,80,.25)]">
          <div className="px-4 py-3" style={{ background: "linear-gradient(120deg,#1d3a8f,#2f6bd8)" }}>
            <div className="text-[15px] font-extrabold text-white">{listing.title || listing.name}</div>
            <div className="text-[11.5px] text-[#cdddf7]">{listing.tenantName}</div>
          </div>
          <div className="p-4">
            {kids && <div className={rowCls}><span className={labCls}>{t("p7cl.lblWho")}</span><span className={valCls}>{kids}</span></div>}
            {(() => { const ov = listing.library?.venue as unknown as { kind?: string; directions?: string } | null | undefined; return ov?.kind === "online" ? (
              <div className="mb-1 rounded-xl border-2 border-[#2f6bd8] bg-[#eef4ff] p-3 text-start text-[13px]"><div className="text-[11px] font-extrabold uppercase tracking-wide text-[#1d3a8f]">💻 {t("p7pg.howToJoin")}</div>
                {(ov.directions ?? "").trim() && <div className="mt-1 whitespace-pre-line font-semibold text-[#171534]">{(ov.directions ?? "").trim()}</div>}
                {/* What actually happens, from the server: pay to unlock / opens at HH:MM / host starts first / Join now. */}
                <div className="mt-1.5"><OnlineSessionsPanel refs={done.refs} providerName={listing.tenantName} compact /></div></div>
            ) : null; })()}
            {done.visitAt && <div className={rowCls}><span className={labCls}>🚗 {t("p9tx.hvWeCome")}</span><span className={valCls}>{done.visitAt}</span></div>}
            {done.passes.length > 0 && <div className={rowCls}><span className={labCls}>{t("p7cl.lblPass")}</span><span className={valCls}>{done.passes.join(", ")}</span></div>}
            {(() => {
              // The time(s) of what was booked. One shared time reads as a single "Time" row; different passes with different times are listed
              // one per pass with their own days, so a family never has to guess which day starts when.
              const sl = (done.slots ?? []).filter((x) => x.timing);
              if (!sl.length) return null;
              const same = sl.every((x) => x.timing === sl[0].timing);
              if (same) return <div className={rowCls}><span className={labCls}>{t("p7cl.lblTime")}</span><span className={valCls}>{sl[0].timing}</span></div>;
              return (
                <div className={rowCls}>
                  <span className={labCls}>{t("p7cl.lblTime")}</span>
                  <span className={`${valCls} flex flex-col gap-1`}>
                    {sl.map((x) => <span key={`${x.pass}|${x.timing}`}>{x.timing} <span className="font-normal text-[#6a6785]">· {x.pass}{x.dates.length ? ` · ${new Intl.ListFormat(dl(), { style: "short", type: "conjunction" }).format(x.dates.map((d) => fmtDay(d) ?? d))}` : ""}</span></span>)}
                  </span>
                </div>
              );
            })()}
            {(done.extras?.length ?? 0) > 0 && <div className={rowCls}><span className={labCls}>{t("p8lst.ck8Addons")}</span><span className={`${valCls} flex flex-col gap-0.5`}>{done.extras!.map((x, i) => <span key={i}>{x}</span>)}</span></div>}
            {when && <div className={rowCls}><span className={labCls}>{t("p7cl.lblStarts")}</span><span className={valCls}>{when}</span></div>}
            {where && <div className={rowCls}><span className={labCls}>{t("p7cl.lblWhere")}</span><span className={valCls}>{where}</span></div>}
            {done.refs.length > 1 && <div className="mt-2 rounded-lg bg-[#eef3ff] px-3 py-2 text-[12px] text-[#1d3a8f]">{t("p7cl.multiBookings", { n: String(done.refs.length) })}</div>}
            {(done.discountOff ?? 0) > 0 && (
              <div className="mt-2 rounded-lg bg-[#e8f8ee] px-3 py-2 text-[13px] text-[#0f6b34]">
                <div className="flex items-center justify-between"><span>{t("p9tx.ckPriceBefore")}</span><b>{money(done.listPrice ?? done.total)}</b></div>
                <div className="flex items-start justify-between gap-3"><span className="min-w-0">{done.discountNames?.length ? t("p9tx.ckDiscountWith", { names: done.discountNames.join(", ") }) : t("p9tx.ckDiscount")}</span><b className="flex-none">− {money(done.discountOff ?? 0)}</b></div>
              </div>
            )}
            <div className="mt-2 flex items-center justify-between border-t border-[#eef0f5] pt-2.5 text-[13px]">
              <span className="text-[#8a86a3]">{done.refs.length === 1 ? t("p7cl.refOne") : t("p7cl.refMany")} {done.refs.join(", ")}</span>
              {scheme
                ? <b className="text-[15px] text-[#a5670a]">{t("p7cl.toPayVia", { amt: money(done.total), scheme })}</b>
                : needsApproval
                ? <b className="text-[15px] text-[#8a5300]">{t("p7cl.payableOnApproval", { amt: money(done.total) })}</b>
                : done.waitlisted && (done.waitOffer ?? 0) > 0
                ? <b className="text-[15px] text-[#8a5300]">{t("p7cl.waitOffered", { amt: money(done.waitOffer!) })}</b>
                : <b className="text-[15px] text-[#171534]">{money(done.total)}</b>}
            </div>
          </div>
        </div>

        {/* Bank transfer: the family is told exactly where to send the money and what to quote. */}
        {done.bank && !needsApproval && !done.waitlisted && (
          <div className="mt-3 rounded-2xl border-2 border-[#1d3a8f] bg-[#eef3ff] p-4 text-start">
            <div className="text-[13px] font-extrabold uppercase tracking-wide text-[#1d3a8f]">{t("p7pub.bankTitle")} · {money(done.bank.amount ?? done.total)}</div>
            <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[14px]">
              {done.bank.bankName && (<><span className="text-[#6a6785]">{t("p7pub.bankName")}</span><b className="text-[#171534]">{done.bank.bankName}</b></>)}
              {done.bank.accountName && (<><span className="text-[#6a6785]">{t("p7pub.accountName")}</span><b className="text-[#171534]">{done.bank.accountName}</b></>)}
              {done.bank.sortCode && (<><span className="text-[#6a6785]">{t("p7pub.sortCode")}</span><b className="text-[#171534]">{done.bank.sortCode}</b></>)}
              {done.bank.accountNumber && (<><span className="text-[#6a6785]">{t("p7pub.accountNumber")}</span><b className="text-[#171534]">{done.bank.accountNumber}</b></>)}
              <span className="text-[#6a6785]">{t("p9tx.ckBankRefLbl")}</span><b className="text-[#171534]">{done.bank.reference}</b>
            </div>
            <div className="mt-2 text-[12px] text-[#6a6785]">{t("p9tx.ckBankNote", { provider: listing.tenantName || t("p9tx.ckYourProvider") })}</div>
            {!paidNow && (
              <button type="button" onClick={() => setPayInstead(true)} className="mt-3 rounded-full border border-[#1d3a8f] bg-white px-4 py-2 text-[13px] font-extrabold text-[#1d3a8f]" data-testid="pay-card-instead">{t("p8lst.payByCardInstead")}</button>
            )}
            {payInstead && !paidNow && (
              <PayModal refs={done.refs} tenantId={listing.tenantId} tenantName={listing.tenantName} onClose={() => setPayInstead(false)} onPaid={() => { setPaidNow(true); setPayInstead(false); }} />
            )}
          </div>
        )}

        {/* Cash on the day: nothing is taken now, so say what to bring. */}
        {done.payCash && !needsApproval && !done.waitlisted && done.total > 0 && (
          <div className="mt-3 rounded-2xl border-2 border-[#0f6b34] bg-[#e8f8ee] p-4 text-start">
            <div className="text-[13px] font-extrabold uppercase tracking-wide text-[#0f6b34]">{t("p9tx.ckCashTitle", { amt: money(done.total) })}</div>
            <div className="mt-1 text-[14px] text-[#171534]">{t("p9tx.ckCashBody", { amt: money(done.total) })}</div>
          </div>
        )}

        {/* Manual approval + card: the card is HELD now (not charged); the provider's approval takes the payment. */}
        {done.holdCard && needsApproval && (
          <div className="mt-3">
            {paidNow ? (
              <div className="rounded-xl bg-[#e8f8ee] px-4 py-3 text-[14px] font-extrabold text-[#0f6b34]">✓ {t("p8lst.holdDone")}</div>
            ) : (
              <>
                <p className="mb-2 rounded-lg bg-[#fff7e0] px-3 py-2 text-start text-[12.5px] font-semibold text-[#7a4b00]">{t("p8lst.holdNote", { provider: listing.tenantName || t("p7cl.theProvider") })}</p>
                <button type="button" onClick={() => setPayClosed(false)} className="w-full rounded-full px-5 py-3.5 text-[15px] font-extrabold text-white" style={{ background: "#1d3a8f" }}>
                  {t("p8lst.holdAddCard")}
                </button>
              </>
            )}
            {!payClosed && !paidNow && (
              <PayModal refs={done.refs} tenantId={listing.tenantId} tenantName={listing.tenantName} onClose={() => setPayClosed(true)} onPaid={() => { setPaidNow(true); setPayClosed(true); }} />
            )}
          </div>
        )}

        {/* Card booking that is confirmed: take the payment right here (the card form opens straight away, and the button reopens it if closed). */}
        {done.payByCard && !needsApproval && (!scheme || !!done.cardDue) && (done.cardDue ?? done.total) > 0 && (
          <div className="mt-3">
            {paidNow ? (
              <div className="rounded-xl bg-[#e8f8ee] px-4 py-3 text-[14px] font-extrabold text-[#0f6b34]">✓ {t("p7cl.paidThanks")}</div>
            ) : (
              <button type="button" onClick={() => setPayClosed(false)} className="w-full rounded-full px-5 py-3.5 text-[15px] font-extrabold text-white" style={{ background: "#1d3a8f", boxShadow: "0 10px 24px -12px rgba(29,58,143,.6)" }}>
                {t("p7cl.payNowBtn", { amt: money(done.cardDue ?? done.total) })}
              </button>
            )}
            {!payClosed && !paidNow && (
              <PayModal refs={done.refs} tenantId={listing.tenantId} onClose={() => setPayClosed(true)} onPaid={() => { setPaidNow(true); setPayClosed(true); }} />
            )}
          </div>
        )}

        {/* Tax-Free Childcare paid through HMRC from the checkout: say so, with
            HMRC's own payment reference and when the money lands. */}
        {!!done.tfcPaid?.length && (
          <div className="mt-3 rounded-2xl border border-[#bfe5cc] bg-[#e8f8ee] p-4 text-start text-[12.5px] leading-relaxed text-[#0f5c2e]">
            <Rich text={t("p7cl.tfcPaidHead", { amt: money(done.tfcPaid.reduce((s, x) => s + x.amount, 0)), provider: listing.tenantName || t("p7cl.yourProvider") })} />
            <table className="mt-2.5" cellPadding={0}>
              <tbody>
                {done.tfcPaid.map((x) => (
                  <tr key={x.paymentReference}>
                    <td className="pe-4 align-top text-[#3c7d55]">{x.child}</td>
                    <td className="align-top font-extrabold text-[#0f5c2e]">{t("p7cl.tfcPaidLine", { amt: money(x.amount), ref: x.paymentReference, date: x.estimatedPaymentDate })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* HMRC couldn't take it from here: why, then the manual way to pay. */}
        {done.tfcFailure && !done.waitlisted && (
          <div className="mt-3 rounded-2xl border border-[#f5c2c2] bg-[#fdecec] p-4 text-start text-[12.5px] leading-relaxed text-[#8a1f1f]">
            <div className="font-extrabold">{TFC_FAILURE_COPY[done.tfcFailure.failure]?.title}</div>
            <div className="mt-1">{TFC_FAILURE_COPY[done.tfcFailure.failure]?.detail}</div>
            {done.tfcFailure.uncertain && <div className="mt-1 font-bold">{t("p7cl.tfcUncertain")}</div>}
          </div>
        )}

        {/* The "go and pay in your scheme account" card — only when something is
            actually owed: never for a waiting-list place (nothing to pay until a
            place is offered) and never once HMRC has been asked from here. */}
        {scheme && !done.waitlisted && !(done.tfcPaid?.length && !done.tfcFailure) && (
          <div className="mt-3 rounded-2xl border border-[#f3d98a] bg-[#fdf6e3] p-4 text-start text-[12.5px] leading-relaxed text-[#7a5a12]">
            <Rich text={t("p7cl.almostThere", { scheme, amt: money(done.total), provider: listing.tenantName || t("p7cl.yourProvider") })} />
            {vDetails.length > 0 && (
              <table className="mt-2.5" cellPadding={0}>
                <tbody>
                  {vDetails.map((dt, di) => (
                    <tr key={di}>
                      <td className="pe-4 align-top text-[#a5834a]">{dt.label}</td>
                      <td className="align-top font-extrabold text-[#5a4410]">{isUrlD(dt) ? <a href={/^https?:\/\//i.test(dt.value) ? dt.value : `https://${dt.value}`} target="_blank" rel="noreferrer" className="underline" style={{ color: "#2f6bd8" }}>{dt.value} ↗</a> : dt.value}</td>
                    </tr>
                  ))}
                  <tr><td className="pe-4 text-[#a5834a]">{t("p7cl.bookingRef")}</td><td className="font-extrabold text-[#5a4410]">{done.refs.join(", ")}</td></tr>
                  <tr><td className="pe-4 text-[#a5834a]">{t("p7cl.amountLbl")}</td><td className="font-extrabold text-[#5a4410]">{money(done.total)}</td></tr>
                </tbody>
              </table>
            )}
            {website && (
              <div className="mt-2.5">
                <a href={website} target="_blank" rel="noreferrer" className="inline-flex rounded-lg px-4 py-2 text-[13px] font-bold text-white" style={{ background: "var(--brand-2,#2f6bd8)" }}>{t("p7cl.goToPay", { scheme: scheme || t("p7cl.theProvider") })}</a>
              </div>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <a href="/custdash/bookings" className="rounded-lg px-5 py-2.5 text-[13px] font-bold text-white" style={{ background: "var(--brand-2,#2f6bd8)" }}>{t("p7cl.seeMyBookings")}</a>
          {listing.tenantId && <a href={`/custdash/messages?compose=1&tenant=${encodeURIComponent(listing.tenantId)}`} className="rounded-lg border border-[#dbe0ec] bg-white px-5 py-2.5 text-[13px] font-bold text-[#4a4763]">{t("p7cl.messageProvider", { provider: listing.tenantName || t("p7cl.theProvider") })}</a>}
          <a href="/custdash/browse" className="rounded-lg border border-[#dbe0ec] bg-white px-5 py-2.5 text-[13px] font-bold text-[#4a4763]">{t("p7cl.browseMore")}</a>
        </div>
      </div>
    );
  }

  // Quick book (from the browse card): just the booking flow, forced to the
  // white/blue theme, using the SAME parent submission + success as the page.
  if (bookingOnly) return (
    <BookingOnly
      listing={listing}
      mode="parent"
      theme="playful"
      bookState={bookState}
      onBook={(p) => void book(p.basket, p.dayAssign, p.addonSel, p.method, p.children, p.addonAns, p.voucherScheme, p.discountCodes, p.voucherRefs, p.walletCap, p.phone, p.mealSel, p.serviceAddress, p.tfc)}
    />
  );

  return (
    <ParentPreview
      d={d}
      venue={lib?.venue ?? null}
      local={local}
      booking={withoutHiddenPasses(bookingFromBundle(listing.bundle), d.ticketOverrides)}
      blocks={listing.blocks}
      addons={lib?.addons ?? []}
      theme={resolveTheme(d.pageStyle)}
      brand={listing.tenantName}
      logo={logo}
      tenantId={listing.tenantId}
      mode="parent"
      bookState={bookState}
      onBook={(p) => void book(p.basket, p.dayAssign, p.addonSel, p.method, p.children, p.addonAns, p.voucherScheme, p.discountCodes, p.voucherRefs, p.walletCap, p.phone, p.mealSel, p.serviceAddress, p.tfc)}
      topRight={topRight}
      full
    />
  );
}

/**
 * Just the booking widget for a listing — pass, timing, dates, then the
 * checkout — with no customer page around it. Take booking uses this: the
 * operator has already chosen the listing from a dropdown, so the hero image
 * and the "what's included" copy are page furniture they don't need.
 *
 * Same component the parent gets, in operator mode, so the two can't diverge.
 */
export function BookingOnly({ listing, onBook, bookState, mode = "operator", theme }: {
  listing: ServerListing;
  onBook?: (p: { method: string; voucherScheme?: string; voucherRefs?: Record<string, string>; tfc?: { amount: number; remainderVia: string; references: Record<string, string> }; discountCodes?: string[]; walletCap?: number; phone?: string; basket: BasketItem[]; addonSel: Record<string, Record<string, string[]>>; addonAns: Record<string, Record<string, string>>; mealSel: Record<string, string>; children: ChildProfile[]; dayAssign: Record<string, Record<string, string[]>>; parent?: { id: string; name: string; email?: string; phone?: string; address?: string } | null; /** Home-visit listings only: where this session actually happens — defaults to the parent's saved address, editable at checkout. */ serviceAddress?: { address: string; postcode: string }; /** Operator checkout "Override the total" (server accepts it only for a booking made on a family's behalf). */ overrideTotal?: number; overrideReason?: string }) => void;
  bookState?: { busy: boolean; error: string | null };
  /** "operator" (Take booking) or "parent" (Quick book). */
  mode?: "operator" | "parent";
  /** Override the listing's page style — Quick book forces the white/blue theme. */
  theme?: PageTheme;
}) {
  const d = draftFromListing(listing);
  const lib = listing.library;
  const dates = periodDates(d, genDates);
  const capParsed = parseInt(d.maxAttendees, 10);
  return (
    <BookingWidget
      d={d}
      booking={withoutHiddenPasses(bookingFromBundle(listing.bundle), d.ticketOverrides)}
      weeks={groupWeeks(dates)}
      spacesLeft={d.showSpaces && Number.isFinite(capParsed) ? capParsed : null}
      addons={(lib?.addons ?? []).filter((a) => d.addonIds.includes(a.id))}
      blocks={listing.blocks}
      mode={mode}
      onBook={onBook}
      bookState={bookState}
      theme={theme ?? resolveTheme(d.pageStyle)}
      tenantId={listing.tenantId}
    />
  );
}

// Standalone customer-page preview (for the "View" action on the Listings tab).
export function ListingPreview({ draft, local, runs }: { draft: WizardDraft; local: LocalState; runs?: RunBlock[] }) {
  const blocks = useBlocks();
  const [theme, setTheme] = useState<PageTheme>(resolveTheme(draft.pageStyle));
  const norm = (arr: unknown) => ((arr as (string | ListingImage)[]) || []).map((im) => (typeof im === "string" ? { src: im, x: 50, y: 50, zoom: 100 } : im));
  const d2 = { ...draft, images: norm(draft.images), gallery: norm(draft.gallery), bookRules: draft.bookRules ?? {}, ticketOverrides: draft.ticketOverrides ?? {} };
  const venue = local.venues.find((v) => v.id === draft.venueId) || null;
  const booking = withoutHiddenPasses(blockBooking(blocks, draft.blockId), d2.ticketOverrides);
  const addons = local.addons.filter((a) => draft.addonIds.includes(a.id));
  return <ParentPreview d={d2} venue={venue} local={local} booking={booking} addons={addons} blocks={runs} theme={theme} onTheme={setTheme} full />;
}

async function fileToImage(file: File): Promise<string> {
  const img = document.createElement("img");
  const url = URL.createObjectURL(file);
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
  const maxW = 1200;
  const scale = Math.min(1, maxW / img.width);
  const canvas = document.createElement("canvas");
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);
  return canvas.toDataURL("image/jpeg", 0.82);
}


// 1st, 2nd, 3rd, 4th…

// Portal-blue-led palette for the colour-coded week calendar.
const WEEK_PAL = ["#1d3a8f", "#2f6bd8", "#3f78d8", "#f5b81f", "#e22295", "#6a4fd0", "#0ea5e9", "#f97316"];

/** The 10-step listing builder. */
export function ListingWizard({
  initial,
  wizardKey,
  local,
  patchLocal,
  onClose,
  onSaved,
}: {
  initial: WizardDraft;
  wizardKey: string;
  local: LocalState;
  patchLocal: (fn: (s: LocalState) => LocalState) => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const tr = useT();
  const { locale: loc } = useI18n();
  const [d, setD] = useState<WizardDraft>(() => {
    const norm = (arr: unknown) =>
      ((arr as (string | ListingImage)[]) || []).map((im) => (typeof im === "string" ? { src: im, x: 50, y: 50, zoom: 100 } : im));
    return { ...initial, images: norm(initial.images), gallery: norm(initial.gallery), bookRules: initial.bookRules ?? {}, ticketOverrides: initial.ticketOverrides ?? {} };
  });
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [fullPreview, setFullPreview] = useState(false);
  // Blocks builder opened over the wizard (so the draft and the step are kept), and the post-publish confirmation.
  const [blocksOpen, setBlocksOpen] = useState(false);
  const blockIdsBefore = useRef<string[]>([]);
  const [publishedId, setPublishedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const savedIdRef = useRef<string | null>(initial.id ?? null);
  const [saveState, setSaveState] = useState<"idle" | "dirty" | "saving" | "saved" | "error">("idle");
  const blocks = useBlocks();
  const upd = (patch: Partial<WizardDraft>) => setD((p) => ({ ...p, ...patch }));
  // Brand colours (Setup → Branding / first-run) drive the "Matched to your brand" themes on the Preview step; the theme the
  // provider approves is also saved as their default (settings.defaultListingTheme) so every NEW listing starts on it.
  const { settings: brandSettings, loading: brandLoading, save: saveBrandSettings } = useSettings();
  const brandColours = brandLoading ? null : brandFromSettings(brandSettings, DEFAULT_SETTINGS.brandColor);
  const [themeSaved, setThemeSaved] = useState(false);
  // The wizard can open before Setup has loaded (emptyDraft then used the stock theme): a still-untouched NEW listing picks up the default once it arrives.
  const defaultApplied = useRef(false);
  useEffect(() => {
    if (brandLoading || defaultApplied.current) return;
    defaultApplied.current = true;
    const def = brandSettings.defaultListingTheme;
    if (def && !initial.id && initial.pageStyle === "sport") setD((p) => (p.pageStyle === "sport" ? { ...p, pageStyle: resolveTheme(def) } : p));
  }, [brandLoading, brandSettings.defaultListingTheme, initial.id, initial.pageStyle]);
  const pickTheme = (t: PageTheme) => {
    upd({ pageStyle: t });
    // Only a NEW listing updates the remembered default; editing an existing one never overwrites it.
    if (initial.id || savedIdRef.current) return;
    if (brandLoading || brandSettings.defaultListingTheme === t) { setThemeSaved(!brandLoading); return; }
    setThemeSaved(false);
    void saveBrandSettings({ settings: { ...brandSettings, defaultListingTheme: t } }).then(() => setThemeSaved(true)).catch(() => { /* the listing keeps its own theme either way */ });
  };
  const tickets = useMemo(() => blockTickets(blocks, d.blockId), [blocks, d.blockId]);
  const booking = useMemo(() => withoutHiddenPasses(blockBooking(blocks, d.blockId), d.ticketOverrides), [blocks, d.blockId, d.ticketOverrides]);
  const venue = local.venues.find((v) => v.id === d.venueId) || null;
  const addons = local.addons.filter((a) => d.addonIds.includes(a.id));

  useEffect(() => { saveDraft(wizardKey, d); }, [d, wizardKey]);

  // Optimistic-concurrency stamp for /api/listings/:id PUT — tracks the
  // `updatedAt` this tab last loaded/saved. Two tabs editing the SAME listing
  // used to autosave the WHOLE object last-writer-wins: Tab B's stale save
  // (still holding its old form state) could silently revert Tab A's more
  // recent edit. Now each PUT sends the version it was based on; if the
  // server has moved on, it's refused with 409 instead of clobbering it.
  const updatedAtRef = useRef<number | undefined>((initial as WizardDraft & { updatedAt?: number }).updatedAt);
  // Once a save is refused as stale, stop autosaving blind — the operator's
  // further edits would just keep bouncing off the same conflict, and quiet
  // retries would eventually give up and look like they'd saved when they
  // hadn't. They have to explicitly reload to pick a side.
  const [conflicted, setConflicted] = useState(false);

  // Saves from THIS tab run one at a time. The debounced autosave doesn't set
  // `busy`, so pressing Save changes while it was mid-flight sent a second PUT
  // carrying the same (now stale) version: the autosave won and bumped it, and
  // the explicit save was refused as a "change in another tab" (it was our own
  // write). Queued, each save reads the latest version when it actually runs;
  // a genuine cross-tab write still mismatches and still conflicts.
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  function syncApi(status: "draft" | "live", quiet = false): Promise<boolean> {
    const run = saveQueue.current.then(() => syncApiNow(status, quiet));
    saveQueue.current = run.catch(() => undefined);
    return run;
  }
  async function syncApiNow(status: "draft" | "live", quiet = false): Promise<boolean> {
    if (conflicted) { setMsg(tr("p8lst.waConflictReload")); return false; }
    // No draft reaches the server until it has a name: stops empty abandoned "New listing" drafts piling up.
    if (!mayCreateOnServer(d)) { if (!quiet) setMsg(tr("p9jr.nameFirst")); return false; }
    if (!quiet) setBusy(true);
    setMsg(null);
    try {
      // Hidden tickets are dropped from the offer — a per-listing choice that
      // leaves the block untouched. Blank fallback stays "Standard".
      const visibleTickets = tickets.filter((t) => d.ticketOverrides[t.name]?.hidden !== true);
      const passes = visibleTickets.length ? visibleTickets.map((t) => ({ name: t.name, price: t.price })) : [{ name: "Standard", price: 0 }];
      // Images go to POST /api/uploads first — the listing doc stores URLs
      // only (the server rejects data URLs; Firestore caps docs at 1MB).
      const images = await uploadImages(d.images);
      const gallery = await uploadImages(d.gallery);
      // The WHOLE draft persists server-side — the listing doc IS the draft,
      // so the customer page renders identically on any machine.
      const { id: draftId, ...draftBody } = { ...d, images, gallery };
      const body = { ...draftBody, status, name: d.title.trim() || "Untitled listing", passes, expectedUpdatedAt: updatedAtRef.current };
      let id = draftId;
      savedIdRef.current = id ?? null;
      let saved: { updatedAt?: number };
      if (id) saved = await api<{ updatedAt?: number }>(`/api/listings/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(body) });
      else { const created = await apiPost<{ id: string; updatedAt?: number }>("/api/listings", body); id = created.id; saved = created; }
      if (typeof saved.updatedAt === "number") updatedAtRef.current = saved.updatedAt;
      savedIdRef.current = id ?? null;
      const next = { ...d, images, gallery, id, status };
      selfUpdate.current = true; // this setD is our own save result — don't let it re-trigger autosave
      setD(next);
      saveDraft(id!, next);
      if (!quiet) setBusy(false);
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.rawMessage.includes("changed elsewhere")) {
        setConflicted(true);
        setMsg(tr("p8lst.waConflictTab"));
        if (!quiet) setBusy(false);
        return false;
      }
      // Autosaves fail silently — the blockers strip already says what's missing,
      // and a half-built draft failing validation shouldn't nag mid-typing.
      // EXCEPT a refused date removal: children are booked on it, and the
      // operator has to know the change didn't happen and why.
      const rawMsg = e instanceof Error ? e.message : "";
      if (quiet && /children are booked on/i.test(rawMsg)) setMsg(rawMsg);
      if (!quiet) {
        const raw = rawMsg;
        // Server validation comes back as a raw JSON issues array — never show that.
        const looksLikeValidation = /\[\{|"code"|too_small|"path"/.test(raw);
        setMsg(looksLikeValidation ? (d.title.trim() ? tr("p8lst.waSaveCheck") : tr("p8lst.waGiveName")) : (raw || tr("p8lst.waSaveFailed")));
        setBusy(false);
      }
      return false;
    }
  }
  // The builder used to reach the server only when someone pressed Save draft
  // or Publish, while autosaving to localStorage on every keystroke — so the
  // screen looked saved, the customer page disagreed, and nothing said which
  // was right. Now every edit reaches the server, and the header says so.
  const dirtyRef = useRef(false);
  const selfUpdate = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!dirtyRef.current) { dirtyRef.current = true; return; } // skip the first render
    if (selfUpdate.current) { selfUpdate.current = false; return; } // change came from our own save — not a user edit
    setSaveState("dirty");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      if (busy) { setSaveState("dirty"); return; } // an explicit save is already running
      setSaveState("saving");
      // Never promotes: an unpublished listing stays unpublished.
      const ok = await syncApi(d.status === "live" ? "live" : "draft", true);
      setSaveState(ok ? "saved" : "error");
    }, 1200);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d]);

  // The wizard is a full-screen overlay with no URL of its own (it opens over
  // /freelancer/listings without a route change) and, unlike the app's other
  // modals (see features/parent/QuickBookModal.tsx for the same pattern),
  // Escape didn't close it. Closes the topmost layer first — the full-screen
  // preview, if that's open — same as clicking its own × / backdrop.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (fullPreview) setFullPreview(false);
      else if (blocksOpen) void closeBlocks();
      else void closeRef.current();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [fullPreview, blocksOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Closing throws away an unpublished draft that never got a name (and its local copy).
  const closeRef = useRef<() => Promise<void>>(async () => {});
  closeRef.current = async () => {
    const id = savedIdRef.current ?? d.id ?? null;
    if (isAbandonedDraft({ id, title: d.title, status: d.status })) {
      try { await api(`/api/listings/${encodeURIComponent(id!)}`, { method: "DELETE" }); } catch { /* already gone */ }
      deleteDraft(id!);
    }
    if (!d.title.trim()) deleteDraft(wizardKey);
    onSaved();
    onClose();
  };
  const openBlocks = () => { blockIdsBefore.current = blocks.library.map((b) => b.id); setBlocksOpen(true); };
  async function closeBlocks() {
    setBlocksOpen(false);
    try {
      const fresh = await blocks.reload?.();
      const nid = fresh ? newBlockId(blockIdsBefore.current, fresh.library.map((b) => b.id)) : null;
      if (nid && !d.blockId) upd({ blockId: nid });
    } catch { /* the picker keeps showing what it had */ }
  }
  // Step 1 needs a name before anything else.
  const goStep = (i: number) => {
    if (i > 0 && titleMissing(d.title)) { setStep(0); setMsg(tr("p9jr.nameFirst")); return; }
    setStep(i);
  };
  // On a LIVE listing this button must keep it live: it used to send status "draft", silently taking the listing off sale (parents then see "This booking isn't open right now").
  const saveDraftAction = async () => { if (await syncApi(saveStatusFor(d.status))) { setSaveState("saved"); onSaved(); } };
  const blockers = publishBlockers(d, tickets.length, tickets.filter((t) => d.ticketOverrides[t.name]?.hidden !== true).length);
  const [goLiveOpen, setGoLiveOpen] = useState(false);
  const [, bumpPc] = useState(0);
  useEffect(() => { const f = () => bumpPc((n) => n + 1); window.addEventListener("hv-pc-verdict", f); return () => window.removeEventListener("hv-pc-verdict", f); }, []);
  const publishAction = async () => {
    if (blockers.length) {
      // Send them to the first thing that's missing rather than making them hunt.
      setStep(blockers[0].step);
      // Keep what they typed (a draft; a LIVE listing stays live) and say plainly that it is NOT live and what is missing.
      void syncApi(saveStatusFor(d.status));
      setMsg(tr("p8lst.waDraftNotLive", { what: blockers.map((b) => b.what).join("; ") }));
      return;
    }
    // A new provider must have started their plan and chosen how parents pay before the first listing goes live.
    if (!goLiveOpen) {
      const gl = await fetchGoLive();
      if (!goLiveReady(gl)) { setGoLiveOpen(true); return; }
    }
    if (await syncApi("live")) { setGoLiveOpen(false); onSaved(); setPublishedId(savedIdRef.current ?? d.id ?? null); }
  };

  const previewProps = { d, venue, local, booking, addons, theme: resolveTheme(d.pageStyle), onTheme: (t: PageTheme) => upd({ pageStyle: t }) };
  const stepKey = STEPS[step].key;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-[#eef2f9] text-[var(--ink)]"
      style={{ ["--bg" as string]: "#f5f8fd", ["--surface" as string]: "#fff", ["--panel" as string]: "#fbf8fc", ["--ink" as string]: "#171534", ["--ink-2" as string]: "#4a4763", ["--ink-3" as string]: "#8a86a3", ["--line" as string]: "#ece6f1" } as React.CSSProperties}>

      {goLiveOpen && <GoLiveModal onClose={() => setGoLiveOpen(false)} onGoLive={() => void publishAction()} busy={busy} />}
      {/* Fancy blue header + segmented progress — the campaign-wizard slideshow look. */}
      <div className="flex-none px-5 py-4 text-white sm:px-6" style={{ background: "linear-gradient(120deg,#16306e,#3f78d8)" }}>
        <div className="mx-auto flex max-w-[1160px] flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[19px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{d.id ? tr("p8lst.waEditListing") : tr("p8lst.waCreateListing")}</div>
            <div className="truncate text-[12.5px] text-white/80">{tr("p8lst.waStepOf", { n: step + 1, total: STEPS.length, label: tr("p8lst.waStep_" + STEPS[step].key) })}</div>
          </div>
          <div className="flex flex-none flex-wrap items-center gap-2">
            {msg && <span className="me-0.5 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold text-white">{msg}</span>}
            {(() => {
              const label = { idle: "", dirty: "", saving: tr("p8lst.waSaving"), saved: tr("p8lst.waSaved"), error: "" }[saveState];
              return label ? <span className="me-0.5 text-[11.5px] font-semibold text-white/85">{saveState === "saved" ? "✓ " : ""}{label}</span> : null;
            })()}
            <button type="button" disabled={busy} onClick={saveDraftAction} className="rounded-full bg-white/15 px-3 py-1.5 text-[12.5px] font-bold text-white hover:bg-white/25 disabled:opacity-40">{d.status === "live" ? tr("p8lst.waSaveChanges") : tr("p8lst.waSaveDraft")}</button>
            <button type="button" onClick={() => setFullPreview(true)} className="rounded-full bg-white/15 px-3 py-1.5 text-[12.5px] font-bold text-white hover:bg-white/25">{tr("p8lst.waPreviewBtn")}</button>
            <button type="button" disabled={busy} onClick={publishAction} title={blockers.length ? pickPlural(tr, loc, "p8lst.waThingsLeft", blockers.length) : undefined} className="rounded-full bg-white px-3.5 py-1.5 text-[12.5px] font-extrabold text-[#16306e] shadow-sm hover:bg-white/90 disabled:opacity-60">{tr("p8lst.waPublish")}{blockers.length > 0 && <span className="ms-1 opacity-70">({blockers.length})</span>}</button>
            <button type="button" onClick={() => void closeRef.current()} aria-label={tr("p8lst.waClose")} className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-white/20 text-[17px] font-bold hover:bg-white/30">×</button>
          </div>
        </div>
        <div className="mx-auto mt-3 flex max-w-[1160px] items-center gap-1">
          {STEPS.map((s, i) => (
            <button key={s.key} type="button" onClick={() => goStep(i)} title={`${i + 1}. ${tr("p8lst.waStep_" + s.key)}`} className="group flex-1">
              <div className={`h-1.5 rounded-full transition ${i <= step ? "bg-white" : "bg-white/25 group-hover:bg-white/50"}`} />
            </button>
          ))}
        </div>
      </div>


      {/* Big centered slide — ONLY this area scrolls (no whole-page scroll). */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5" style={{ backgroundColor: "#e8f0fb", backgroundImage: "radial-gradient(760px 380px at 12% -14%, #c9dcf8 0%, rgba(201,220,248,0) 55%), radial-gradient(760px 380px at 100% -6%, #d4e4fb 0%, rgba(212,228,251,0) 55%), radial-gradient(rgba(31,84,163,.055) 1px, transparent 1.4px)", backgroundSize: "auto, auto, 22px 22px" }}>
        <div className="mx-auto w-full max-w-[1160px]">
          <div className={stepKey === "preview"
            ? "mx-auto w-full"
            : "overflow-hidden rounded-[22px] border border-[#cddcf7] shadow-[0_22px_60px_-20px_rgba(31,84,163,.34)]"}
            style={stepKey === "preview" ? undefined : { background: "linear-gradient(180deg,#ffffff 0%,#f1f6ff 100%)" }}>
            {stepKey !== "preview" && <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg,#16306e,#3f78d8,#8fbcff)" }} />}
            <div className={stepKey === "preview" ? "" : "px-4 py-4 sm:px-7 sm:py-5"}>
            {stepKey === "basics" && <BasicsStep d={d} upd={upd} local={local} patchLocal={patchLocal} blocks={blocks} onCreateBlock={openBlocks} />}
            {stepKey === "details" && <DetailsStep d={d} upd={upd} local={local} patchLocal={patchLocal} />}
            {stepKey === "capacity" && <CapacityStep d={d} upd={upd} />}
            {stepKey === "content" && <ContentStep d={d} upd={upd} local={local} patchLocal={patchLocal} />}
            {stepKey === "provided" && <ChipStep n={3} kicker={tr("p8lst.waKickProvided")} title={tr("p8lst.waProvidedTitle")} cardTitle={tr("p8lst.waProvidedTitle")} lede={tr("p8lst.waProvidedLede")} options={local.provided} sel={d.provided} emojis={local.emojis} onToggle={(v) => upd({ provided: toggle(d.provided, v) })} onAdd={(name, emoji) => { patchLocal((s) => ({ ...s, provided: [...s.provided, name], emojis: { ...s.emojis, [name]: emoji } })); upd({ provided: [...d.provided, name] }); }} onDelete={(v) => { patchLocal((s) => ({ ...s, provided: s.provided.filter((x) => x !== v) })); upd({ provided: d.provided.filter((x) => x !== v) }); }}
              extra={
                <div className="mt-4">
                  <RichCard icon="🧳" title={tr("p8lst.waBringTitle")} subtitle={tr("p8lst.waBringSub")}>
                    <EditableChips options={local.toBring} sel={d.toBring} emojis={local.emojis} showEmoji check
                      onToggle={(v) => upd({ toBring: toggle(d.toBring, v) })}
                      onAdd={(name, emoji) => { patchLocal((s) => ({ ...s, toBring: [...s.toBring, name], emojis: { ...s.emojis, [name]: emoji } })); upd({ toBring: [...d.toBring, name] }); }}
                      onDelete={(v) => { patchLocal((s) => ({ ...s, toBring: s.toBring.filter((x) => x !== v) })); upd({ toBring: d.toBring.filter((x) => x !== v) }); }} />
                  </RichCard>
                </div>
              } />}
            {stepKey === "safety" && <SafetyStep d={d} upd={upd} local={local} patchLocal={patchLocal} />}
            {stepKey === "run" && <RunStep d={d} upd={upd} />}
            {stepKey === "tickets" && <TicketsStep d={d} upd={upd} blocks={blocks} tickets={tickets} onCreateBlock={openBlocks} />}
            {stepKey === "discounts" && <DiscountsStep d={d} upd={upd} tickets={tickets} />}
            {stepKey === "preview" && <div><StepHead n={10} kicker={tr("p8lst.waKickPreview")} title={tr("p8lst.waStep_preview")} lede={tr("p8lst.waPreviewLede")} /><HeadingsEditor d={d} upd={upd} />
              <label data-testid="theme-art-switch" className="mx-3 mb-3 flex cursor-pointer items-start gap-2.5 rounded-xl border bg-white px-3.5 py-2.5 sm:mx-5" style={{ borderColor: "var(--line)" }}>
                <input type="checkbox" className="mt-1 h-4 w-4" checked={themeArtOn(d)} onChange={(e) => upd({ themeArt: e.target.checked })} />
                <span><span className="block text-[13px] font-bold text-[var(--ink)]">{tr("p8lst.waThemeArt")}</span><span className="block text-[11.5px] text-[var(--ink-3)]">{tr("p8lst.waThemeArtHint")}</span></span>
              </label>
              {brandColours && <MatchedThemes brand={brandColours} value={resolveTheme(d.pageStyle)} onPick={(k) => pickTheme(k as PageTheme)} label={(k) => tr("p8lst.wbTheme_" + k)} saved={themeSaved}
                allThemes={<ThemePicker value={resolveTheme(d.pageStyle)} onChange={pickTheme} />} />}
              {!brandColours && <div className="sticky top-0 z-10 mx-3 mb-3 rounded-2xl border-2 bg-white p-3.5 sm:mx-5" style={{ borderColor: "#e9a915", boxShadow: "0 12px 30px -16px rgba(233,169,21,.8)" }}>
                <FieldLabel>{tr("p8lst.waThemeLbl")} <span className="font-normal text-[var(--ink-3)]">{tr("p8lst.waThemeNote")}</span></FieldLabel>
                <div className="mt-1"><ThemePicker value={resolveTheme(d.pageStyle)} onChange={pickTheme} /></div>
                <div className="mt-1.5 text-[11.5px] font-semibold text-[#7a4b00]">{tr("p9tx.wpThemeLive")}</div>
              </div>}<ParentPreview {...previewProps} full /></div>}
            {stepKey === "addons" && <AddonsStep d={d} upd={upd} local={local} patchLocal={patchLocal} />}
            {stepKey === "staff" && <StaffStep d={d} upd={upd} local={local} patchLocal={patchLocal} />}
            {stepKey === "policy" && (
              <>
                {blockers.length > 0 && (
                  <div className="mb-3 max-w-[720px] rounded-xl border p-3.5" style={{ borderColor: "#fed7aa", background: "#fff7ed" }}>
                    <div className="text-[12.5px] font-extrabold" style={{ color: "#9a3412" }}>
                      {tr("p8lst.waBeforePublish", { n: blockers.length })}
                    </div>
                    <ul className="mt-1.5 flex flex-col gap-1">
                      {blockers.map((bl, i) => (
                        <li key={i} className="flex items-start gap-2 text-[12px]" style={{ color: "#9a3412" }}>
                          <span className="mt-[2px]">•</span>
                          <button type="button" onClick={() => setStep(bl.step)} className="text-start underline underline-offset-2">
                            {bl.what} <span className="opacity-70">{tr("p8lst.waStepN", { n: bl.step + 1 })}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 text-[11px]" style={{ color: "#9a3412" }}>
                      <Rich text={tr("p8lst.waStillSave")} />
                    </div>
                  </div>
                )}
                <PolicyStep d={d} upd={upd} />
              </>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer nav — big, fixed. */}
      <div className="flex-none border-t border-[var(--line)] bg-[var(--surface)] px-5 py-3 sm:px-6">
        <div className="mx-auto flex max-w-[1160px] items-center justify-between gap-3">
          <Button disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>{tr("p8lst.waBack")}</Button>
          {step < STEPS.length - 1 ? (
            <div className="flex items-center gap-2">
              {/* When editing an existing listing, let them save from any step
                  instead of walking to the end every time. */}
              {d.id && (
                <Button variant="solid" disabled={busy || blockers.length > 0} onClick={publishAction}
                  title={blockers.length ? pickPlural(tr, loc, "p8lst.waLeftFinish", blockers.length) : tr("p8lst.waSaveNow")}>
                  {blockers.length ? tr("p8lst.waSaveLeft", { n: blockers.length }) : d.status === "live" ? tr("p8lst.waSaveChanges") : tr("p8lst.waSavePublish")}
                </Button>
              )}
              <Button variant="primary" disabled={step === 0 && titleMissing(d.title)} title={step === 0 && titleMissing(d.title) ? tr("p9jr.nameFirst") : undefined} onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))} className="min-w-[130px]">{tr("p8lst.waNext")}</Button>
            </div>
          ) : (
            <Button variant="primary" disabled={busy || blockers.length > 0} onClick={publishAction} className="min-w-[130px]">
              {blockers.length ? tr("p8lst.waToFinish", { n: blockers.length }) : tr("p8lst.waPublishParty")}
            </Button>
          )}
        </div>
      </div>

      {blocksOpen && (
        <div data-ui="blocks-modal" className="fixed inset-0 z-[10000] flex flex-col bg-[#eef2f9]">
          <div className="flex flex-none items-center justify-between gap-3 px-5 py-3 text-white" style={{ background: "linear-gradient(120deg,#16306e,#3f78d8)" }}>
            <div className="min-w-0 text-[13px] font-semibold text-white/90">{tr("p9jr.blocksModalHint")}</div>
            <button type="button" onClick={() => void closeBlocks()} className="flex-none rounded-full bg-white px-4 py-1.5 text-[12.5px] font-extrabold text-[#16306e]">{tr("p9jr.backToListing")}</button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4"><BlocksApp embedded /></div>
        </div>
      )}

      {publishedId && (() => {
        const url = bookingLink(typeof window !== "undefined" ? window.location.origin : "", publishedId);
        const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
        return (
          <div data-ui="publish-success" className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/55 p-4">
            <div className="w-full max-w-[520px] rounded-2xl bg-white p-6 text-center shadow-2xl">
              <div className="text-[34px]">🎉</div>
              <h2 className="mt-1 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{tr("p9jr.liveTitle")}</h2>
              <p className="mt-1 text-[13px] text-[var(--ink-2)]">{tr("p9jr.liveBody")}</p>
              <input readOnly value={url} aria-label={tr("p9jr.liveLinkLabel")} onFocus={(e) => e.currentTarget.select()} className="mt-3 w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-center text-[13px] font-semibold" />
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <Button variant="primary" onClick={() => { void navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }); }}>{copied ? tr("p9jr.liveCopied") : tr("p9jr.liveCopy")}</Button>
                {canShare && <Button onClick={() => { void navigator.share({ title: d.title, url }).catch(() => {}); }}>{tr("p9jr.liveShare")}</Button>}
                <Button onClick={() => window.open(`/book/${publishedId}?preview=1`, "_blank", "noopener")}>{tr("p8lst.flViewAsParent")}</Button>
              </div>
              <button type="button" onClick={onClose} className="mt-4 text-[13px] font-bold text-[var(--ink-3)] underline">{tr("p9jr.liveDone")}</button>
            </div>
          </div>
        );
      })()}

      {fullPreview && (
        <div onClick={(e) => e.target === e.currentTarget && setFullPreview(false)}
          className="fixed inset-0 z-[10000] flex items-start justify-center overflow-auto bg-black/60 p-4 sm:p-6">
          <div className="w-full max-w-[1040px]">
            <div className="mb-2 flex items-center justify-between text-white">
              <span className="text-[13px] font-bold">{tr("p8lst.waCustomerView", { name: venue?.name || tr("p8lst.waYourListing") })}</span>
              <button type="button" onClick={() => setFullPreview(false)} className="text-[22px] leading-none">×</button>
            </div>
            <ParentPreview {...previewProps} full />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Reusable editable chip group (options carry across all listings) ───────
function EditableChips({ options, sel, onToggle, onAdd, onDelete, emojis, showEmoji, check }: { options: string[]; sel: string[]; onToggle: (v: string) => void; onAdd: (v: string, emoji: string) => void; onDelete?: (v: string) => void; emojis?: Record<string, string>; showEmoji?: boolean; check?: boolean }) {
  const tr = useT();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("⭐");
  const [picker, setPicker] = useState(false);
  const add = () => { if (name.trim().length < 2) return; onAdd(name.trim(), emoji); setName(""); setEmoji("⭐"); setAdding(false); setPicker(false); };
  const chipEmoji = (o: string) => OPT_EMOJI[o] || emojis?.[o] || "";
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {options.map((o) => {
        const on = sel.includes(o);
        const em = showEmoji ? chipEmoji(o) : "";
        return (
          <span key={o} className="inline-flex items-center overflow-hidden rounded-full border" style={on ? { borderColor: "transparent", background: "linear-gradient(120deg,#3f78d8,#1b3f8f)", boxShadow: "0 4px 12px -3px rgba(31,84,163,.55)" } : { borderColor: "var(--line)", background: "#fff" }}>
            <button type="button" onClick={() => onToggle(o)} className="py-1.5 ps-3 text-[12px] font-bold" style={{ color: on ? "#fff" : "var(--ink-2)" }}>{on && check ? "✓ " : ""}{em ? em + " " : ""}{optionLabel(o)}</button>
            {onDelete && <button type="button" onClick={() => onDelete(o)} aria-label={tr("p8lst.waDeleteX", { name: o })} className="px-2 text-[11px]" style={{ color: on ? "rgba(255,255,255,.7)" : "var(--ink-3)" }}>✕</button>}
            {!onDelete && <span className="pe-3" />}
          </span>
        );
      })}
      {adding ? (
        <span className="relative inline-flex items-center gap-1">
          <button type="button" onClick={() => setPicker((p) => !p)} title={tr("p8lst.waPickEmoji")} className="flex h-[30px] w-[34px] items-center justify-center rounded-lg border border-[var(--line)] text-[16px]">{emoji}</button>
          <Input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder={tr("p8lst.waNewOption")} className="w-[150px]" autoFocus />
          <Button sm variant="primary" onClick={add}>{tr("p8lst.waAdd")}</Button>
          {picker && (
            <div className="absolute start-0 top-[36px] z-20 max-h-[190px] w-[248px] overflow-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2 shadow-[0_12px_30px_rgba(0,0,0,.18)]">
              <div className="grid grid-cols-8 gap-0.5">
                {EMOJI_BANK.map((e, i) => <button key={i} type="button" onClick={() => { setEmoji(e); setPicker(false); }} className="flex h-6 w-6 items-center justify-center rounded text-[15px] hover:bg-[var(--panel)]">{e}</button>)}
              </div>
            </div>
          )}
        </span>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="rounded-full border border-dashed border-[var(--line)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-3)]">{tr("p8lst.waAddOption")}</button>
      )}
    </div>
  );
}

function ChipStep({ n, kicker, title, lede, options, sel, onToggle, onAdd, onDelete, emojis, headings, cardIcon = "🎒", cardTitle, cardSubtitle, extra }: { n: number; kicker: string; title: string; lede: string; options: string[]; sel: string[]; onToggle: (v: string) => void; onAdd: (v: string, emoji: string) => void; onDelete: (v: string) => void; emojis: Record<string, string>; headings?: React.ReactNode; cardIcon?: string; cardTitle?: string; cardSubtitle?: string; extra?: React.ReactNode }) {
  const tr = useT();
  return (
    <div className="mx-auto max-w-[900px]">
      <StepHead n={n} kicker={kicker} title={title} lede={lede} />
      <RichCard icon={cardIcon} title={cardTitle ?? title} subtitle={cardSubtitle ?? tr("p8lst.waChipSubDefault")}>
        <EditableChips options={options} sel={sel} onToggle={onToggle} onAdd={onAdd} onDelete={onDelete} emojis={emojis} showEmoji check />
        {headings}
      </RichCard>
      {extra}
    </div>
  );
}

// ── Shared image bits ──────────────────────────────────────────────────────
// One renderer used in the editor AND the customer view, so cropping is WYSIWYG.
// Focal-point crop via background sizing: the image is sized to *cover* the frame
// and then scaled by zoom, so it always overflows both axes once zoomed — which
// lets Left/Right (x) AND Up/Down (y) both pan via background-position. (The old
// object-position approach could only ever pan the single axis that happened to
// overflow, so Left/Right was dead on portrait-ish images.)
export function CroppedImage({ im, className, style, contain }: { im: ListingImage; className?: string; style?: React.CSSProperties; contain?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ai, setAi] = useState(0); // image aspect (w/h)
  const [ac, setAc] = useState(0); // container aspect (w/h)
  useEffect(() => {
    const el = ref.current; if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => { const r = el.getBoundingClientRect(); if (r.width && r.height) setAc(r.width / r.height); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    let alive = true; const img = new window.Image();
    img.onload = () => { if (alive && img.naturalWidth && img.naturalHeight) setAi(img.naturalWidth / img.naturalHeight); };
    img.src = im.src;
    return () => { alive = false; };
  }, [im.src]);
  const z = (im.zoom || 100) / 100;
  const ready = ai > 0 && ac > 0;
  // Cover size on each axis (≥100% of the container) × zoom. Ratio preserved: the
  // wider-relative axis stays at 100%×zoom, the other grows to cover — both scale
  // by the same z, so the image never distorts and pans smoothly in both directions.
  const bgW = ready ? Math.max(1, ai / ac) * z * 100 : 100;
  const bgH = ready ? Math.max(1, ac / ai) * z * 100 : 100;
  return (
    <div
      ref={ref}
      className={`overflow-hidden bg-[var(--panel)] ${className || ""}`}
      style={{
        ...style,
        backgroundImage: `url("${im.src}")`,
        backgroundRepeat: "no-repeat",
        // contain = show the WHOLE image (never crop — e.g. certificates/docs in
        // the gallery); otherwise cover-crop with the pan/zoom focal point.
        backgroundPosition: contain ? "center" : `${im.x}% ${im.y}%`,
        backgroundSize: contain ? "contain" : ready ? `${bgW}% ${bgH}%` : "cover",
      }}
      role="img"
    />
  );
}

function ImageManager({ images, onChange, addLabel, previewAspect = "16 / 9", contain = false }: { images: ListingImage[]; onChange: (imgs: ListingImage[]) => void; addLabel: string; previewAspect?: string; contain?: boolean }) {
  const tr = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  // In a walkthrough, the main photo is pre-seeded — open its crop panel on
  // mount so the tour can show the crop-and-move controls straight away.
  const [editIdx, setEditIdx] = useState<number | null>(
    () => (isDemoMode() && addLabel.includes("main") && images.length > 0 ? 0 : null),
  );
  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    const add: ListingImage[] = [];
    for (const f of files) { try { add.push({ src: await fileToImage(f), x: 50, y: 50, zoom: 100 }); } catch { /* skip */ } }
    if (add.length) { const start = images.length; onChange([...images, ...add]); if (!contain) setEditIdx(start); }
  }
  const setCrop = (i: number, patch: Partial<ListingImage>) => onChange(images.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const im = editIdx !== null ? images[editIdx] : null;
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        <Button sm onClick={() => fileRef.current?.click()}>{addLabel}</Button>
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={pick} className="hidden" />
      </div>
      {images.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {images.map((x, i) => (
            <div key={i} className="relative">
              <div onClick={() => { if (!contain) setEditIdx(i); }} className={`rounded-lg border ${contain ? "" : "cursor-pointer"}`} style={{ borderColor: editIdx === i && !contain ? "var(--brand-2)" : "var(--line)" }}>
                <CroppedImage im={x} className="h-[64px] w-[96px] rounded-lg" contain={contain} />
              </div>
              <button type="button" onClick={() => { onChange(images.filter((_, j) => j !== i)); setEditIdx(null); }} className="absolute -end-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-[10px] text-white">×</button>
            </div>
          ))}
        </div>
      )}
      {!contain && im && editIdx !== null && (
        <div className="mb-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12px] font-extrabold">{tr("p8lst.waCropMove")}</span>
            <Button sm variant="primary" onClick={() => setEditIdx(null)}>{tr("p8lst.waDone")}</Button>
          </div>
          <CroppedImage im={im} className="w-full max-w-[420px] rounded-lg border border-[var(--line)]" style={{ aspectRatio: previewAspect }} />
          <div className="mt-2 flex max-w-[320px] flex-col gap-1.5 text-[11.5px] text-[var(--ink-3)]">
            <label className="flex items-center gap-2">{tr("p8lst.waZoom")}<input type="range" min={100} max={300} value={im.zoom} onChange={(e) => setCrop(editIdx, { zoom: +e.target.value })} className="flex-1" /></label>
            <label className="flex items-center gap-2">{tr("p8lst.waLeftRight")}<input type="range" min={0} max={100} value={im.x} onChange={(e) => setCrop(editIdx, { x: +e.target.value })} className="flex-1" /></label>
            <label className="flex items-center gap-2">{tr("p8lst.waUpDown")}<input type="range" min={0} max={100} value={im.y} onChange={(e) => setCrop(editIdx, { y: +e.target.value })} className="flex-1" /></label>
            <div className="text-[10.5px]">{tr("p8lst.waCropTip")}</div>
            <Button sm onClick={() => setCrop(editIdx, { x: 50, y: 50, zoom: 100 })}>{tr("p8lst.waReset")}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Distinct emoji per known safety / SEND option.
const OPT_EMOJI: Record<string, string> = {
  "DBS-checked staff": "🛡️", "First aid on site": "🚑", "Safeguarding lead": "🧑‍⚖️", "Low ratios": "👥", "Secure venue": "🚪", "Fire drills": "🧯",
  "Wheelchair accessible": "♿", "1:1 support available": "🤝", "Quiet space": "🤫", "Visual timetables": "🗓️", "SEND-trained staff": "🎓", "Accessible toilets": "🚻",
  "Sensory space": "🌈", "Hearing support": "👂", "Sign language": "🤟", "Calm-down area": "🧸",
};

// A bank of ~200 emojis to pick from when adding a new option.
const EMOJI_BANK = ("⭐ 🌟 ✨ 🎯 🏆 🥇 🎖️ 🏅 🎗️ 🎉 🎊 🎈 🎁 🧸 🪅 🎠 🎡 🎢 ⚽ 🏀 🏈 ⚾ 🥎 🎾 🏐 🏉 🥏 🎱 🏓 🏸 🥅 🏒 🏑 🥍 🏏 🥊 🥋 🤺 ⛳ ⛸️ 🎣 🤿 🎽 🛹 🛼 🛷 ⛷️ 🏂 🏋️ 🤸 🤾 🤹 🧘 🏃 🚴 🏇 🏄 🏊 🤽 🚣 🧗 🎿 🥌 🎮 🕹️ 🎲 ♟️ 🧩 🪀 🎭 🎨 🖌️ 🖍️ ✏️ 🖊️ 📝 📚 📖 📓 🔬 🔭 🧪 🧬 🔎 💡 🧠 🗣️ 👂 👀 🩹 ⛑️ 🩺 💊 🚑 🚒 🧯 🚪 🔐 🔒 🛡️ 👮 👷 🤝 🫶 💬 🗨️ 📣 📢 🔔 🎵 🎶 🎤 🎧 🥁 🎸 🎹 🎺 🎻 🪕 🎬 📷 📸 🎥 🍎 🍌 🍓 🍇 🥕 🥪 🥗 🍲 🍚 🍜 🥤 🧃 💧 🍪 🎂 🧁 🍿 🥨 ☀️ 🌤️ 🌈 ⛅ 🌧️ ❄️ ⛄ 🔥 🌊 🌱 🌳 🌲 🍃 🌸 🌻 🌍 🗺️ 📍 🧭 🚌 🚐 🚗 🚲 ⏰ 📅 🗓️ 🕘 🎫 🎟️ 💷 💰 🏷️ ✅ ☑️ ✔️ ❤️ 🧡 💛 💚 💙 💜 🤍 ⚠️ ♿ 🚻 🤟 🧏 🦮 👋 🙌 👍 👏 🌟 🎓 🏫 🧴 🧼 🚽").split(/\s+/);

// ── Copy "AI" — uses the field's words as a prompt, is section-aware, caps at
// 300 chars, and REPLACES the text each time (rotating variant → refresh changes
// the whole paragraph, never appends). Swap for a real model via the backend.
const AI_STOP = new Set("a an and the of for to in on at with is are our we you your they it this that be will can each every day days week weeks child children kids age ages fun great good very really".split(" "));
function aiKeywords(text: string, max = 6): string[] {
  const seen = new Set<string>();
  return text.toLowerCase().replace(/[^\p{L}\p{N} &-]/gu, " ").split(/\s+/)
    .filter((w) => w.length > 2 && !AI_STOP.has(w) && !seen.has(w) && seen.add(w))
    .slice(0, max);
}
const cap1 = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
// The writing templates live in the catalogue (p8lst.waAi*) so the generated paragraph comes out in the picker's language.
const aiPick = (base: string, variant: number, vars: Record<string, string | number>) => tNow(`p8lst.${base}${(variant % 3) + 1}`, vars).slice(0, 300);
function genDescription(prompt: string, section: string, d: WizardDraft, cats: string[], variant: number): string {
  const kws = aiKeywords(prompt);
  const cat = (cats[0] || tNow("p8lst.waAiActivity")).toLowerCase();
  const kw = kws.length ? kws.join(", ") : tNow("p8lst.waAiSessions", { cat });
  const age = d.ageFrom && d.ageTo ? tNow("p8lst.waAiAges", { from: d.ageFrom, to: d.ageTo }) : "";
  const sec = section.trim().toLowerCase();
  // A section name is matched in English (the stored preset) and in the current language (translated preset / the operator's own words).
  const isSec = (en: string, key: string) => sec.includes(en) || sec.includes(tNow("p8lst." + key).toLowerCase());
  const vars = { kw, cat, age };
  if (isSec("arrive", "waSec_arrive")) return aiPick("waAiArrive", variant, vars);
  if (sec.includes("curriculum") || sec.includes("learn") || sec.includes(tNow("p8lst.waSec_curriculum").toLowerCase())) return aiPick("waAiCurr", variant, vars);
  if (sec.includes("what") || sec.includes(tNow("p8lst.waSec_do").toLowerCase())) return aiPick("waAiWhat", variant, vars);
  return aiPick("waAiDef", variant, { ...vars, kw: variant % 3 === 2 ? cap1(kw) : kw });
}
function genBio(prompt: string, m: StaffMember, variant: number): string {
  const name = [m.first, m.last].filter(Boolean).join(" ") || tNow("p8lst.waAiThisCoach");
  const kws = aiKeywords(prompt, 5);
  const kw = kws.join(", ");
  const v = variant % 3;
  if (v === 0) return tNow(kw ? "p8lst.waAiBio1a" : "p8lst.waAiBio1b", { name, kw }).slice(0, 300);
  if (v === 1) return tNow("p8lst.waAiBio2", { name, kw: kw || tNow("p8lst.waAiWorkKids") }).slice(0, 300);
  return tNow("p8lst.waAiBio3", { name, kw: kw || tNow("p8lst.waAiFunActs") }).slice(0, 300);
}

// ── Step: Basics ───────────────────────────────────────────────────────────
/** Add a venue without leaving the wizard: writes to the same library the Locations tab edits and selects it on this listing. */
function InlineVenueForm({ patchLocal, onAdded, onCancel }: { patchLocal: (fn: (s: LocalState) => LocalState) => void; onAdded: (id: string) => void; onCancel?: () => void }) {
  const tr = useT();
  const [nm, setNm] = useState("");
  const [addr, setAddr] = useState("");
  const add = () => {
    if (nm.trim().length < 2) return;
    const id = uid();
    patchLocal((s) => ({ ...s, venues: [...s.venues, { id, name: nm.trim(), address: addr.trim() }] }));
    onAdded(id);
    setNm(""); setAddr("");
  };
  return (
    <div data-ui="inline-venue" className="mb-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
      <div className="mb-2 text-[12px] font-extrabold">{tr("p9jr.addVenueTitle")}</div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div><FieldLabel>{tr("p8lst.flVenueNamePh")}</FieldLabel><Input value={nm} onChange={(e) => setNm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} className="w-full" /></div>
        <div><FieldLabel>{tr("p8lst.flAddrPh")}</FieldLabel><Input value={addr} onChange={(e) => setAddr(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} className="w-full" /></div>
      </div>
      <div className="mt-2 flex gap-2">
        <Button variant="primary" sm disabled={nm.trim().length < 2} onClick={add}>{tr("p8lst.flAdd")}</Button>
        {onCancel && <Button sm onClick={onCancel}>{tr("p8lst.blkCancel")}</Button>}
      </div>
    </div>
  );
}

/** Step 1: what has to exist before this listing can go live, with live ticks and a button to create each missing piece. */
function PrereqPanel({ d, upd, local, patchLocal, blocks, onCreateBlock }: { d: WizardDraft; upd: (p: Partial<WizardDraft>) => void; local: LocalState; patchLocal: (fn: (s: LocalState) => LocalState) => void; blocks: BlocksStore; onCreateBlock: () => void }) {
  const tr = useT();
  const [addingVenue, setAddingVenue] = useState(false);
  const pre = listingPrereqs({ venueCount: local.venues.length, deliveryMode: d.deliveryMode, blocks: blocks.library.map((b) => ({ passCount: b.passIds.length, priced: b.priced === true })) });
  const venueOk = pre[0].ok, blockOk = pre[1].ok;
  const tick = (ok: boolean) => <span aria-hidden className="flex h-5 w-5 flex-none items-center justify-center rounded-full text-[11px] font-extrabold text-white" style={{ background: ok ? "#0f9d58" : "#c4c9d6" }}>{ok ? "✓" : ""}</span>;
  return (
    <div data-ui="prereq-panel" className="mb-4 rounded-2xl border border-[#cddcf7] bg-white p-4">
      <div className="text-[14px] font-extrabold">{tr("p9jr.prereqTitle")}</div>
      <p className="mb-2 text-[12px] text-[var(--ink-3)]">{tr("p9jr.prereqLede")}</p>
      <div className="flex flex-col gap-2">
        <div data-ui="prereq-venue" data-ok={venueOk ? "1" : "0"} className="flex flex-wrap items-center gap-2.5 text-[13px]">
          {tick(venueOk)}
          <span className="font-bold">{tr("p9jr.prereqVenue")}</span>
          <span className="text-[var(--ink-3)]">{tr("p9jr.prereqVenueSub")}</span>
          {!venueOk && !addingVenue && <Button sm className="ms-auto" onClick={() => setAddingVenue(true)}>{tr("p9jr.prereqAddVenue")}</Button>}
        </div>
        {addingVenue && !venueOk && <InlineVenueForm patchLocal={patchLocal} onAdded={(id) => { upd({ venueId: id }); setAddingVenue(false); }} onCancel={() => setAddingVenue(false)} />}
        <div data-ui="prereq-block" data-ok={blockOk ? "1" : "0"} className="flex flex-wrap items-center gap-2.5 text-[13px]">
          {tick(blockOk)}
          <span className="font-bold">{tr("p9jr.prereqBlock")}</span>
          <span className="text-[var(--ink-3)]">{tr("p9jr.prereqBlockSub")}</span>
          {!blockOk && !blocks.loading && <Button sm className="ms-auto" onClick={onCreateBlock}>{tr("p9jr.prereqCreateBlock")}</Button>}
        </div>
      </div>
    </div>
  );
}

function BasicsStep({ d, upd, local, patchLocal, blocks, onCreateBlock }: { d: WizardDraft; upd: (p: Partial<WizardDraft>) => void; local: LocalState; patchLocal: (fn: (s: LocalState) => LocalState) => void; blocks: BlocksStore; onCreateBlock: () => void }) {
  const tr = useT();
  return (
    <div className="max-w-[1120px]">
      <StepHead n={1} kicker={tr("p8lst.waKickBasics")} title={tr("p8lst.waBasicsTitle")} lede={tr("p8lst.waBasicsLede")} />
      <PrereqPanel d={d} upd={upd} local={local} patchLocal={patchLocal} blocks={blocks} onCreateBlock={onCreateBlock} />
      <FieldLabel>{tr("p8lst.waTitleLbl")} <span className="text-[#c0392b]">*</span></FieldLabel>
      <Input value={d.title} maxLength={70} aria-required onChange={(e) => upd({ title: e.target.value })} placeholder={tr("p8lst.waTitlePh")} className="mb-1 w-full" />
      {titleMissing(d.title) && <div className="mb-3 text-[11.5px] font-semibold text-[#b45309]">{tr("p9jr.nameFirst")}</div>}
      {!titleMissing(d.title) && <div className="mb-3" />}

      <div className="grid items-start gap-4 md:grid-cols-2">
        <RichCard icon="🖼️" title={tr("p8lst.waMainImage")} subtitle={tr("p8lst.waMainImageSub")}>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {LAYOUTS.map((l) => (
              <button key={l.key} type="button" onClick={() => upd({ layout: l.key })} className="rounded-lg border px-2.5 py-1.5 text-[11px] font-bold"
                style={d.layout === l.key ? { borderColor: "var(--brand-2)", background: "var(--brand-soft)", color: "var(--brand-ink)" } : { borderColor: "var(--line)", background: "#fff", color: "var(--ink-3)" }}>
                {tr("p8lst.waLayout_" + l.key)}
              </button>
            ))}
          </div>
          <ImageManager images={d.images} onChange={(imgs) => upd({ images: imgs })} addLabel={tr("p8lst.waAddMainPhoto")} previewAspect={d.layout === "wide" ? "3 / 1" : "16 / 9"} />
          <div className="mt-1 text-[11px] text-[var(--ink-3)]"><Rich text={tr("p8lst.waShapeHint")} /></div>
        </RichCard>
        <RichCard icon="📸" title={tr("p8lst.waGallery")} subtitle={tr("p8lst.waGallerySub")} tint="teal">
          <ImageManager images={d.gallery} onChange={(imgs) => upd({ gallery: imgs })} addLabel={tr("p8lst.waAddGallery")} previewAspect="1 / 1" />
          <div className="mt-1 text-[11px] text-[var(--ink-3)]">{tr("p8lst.waGalleryHint")}</div>
        </RichCard>
      </div>
    </div>
  );
}

// ── Step: Details (venue, ages, season, categories, capacity) ────────────────
function DetailsStep({ d, upd, local, patchLocal }: { d: WizardDraft; upd: (p: Partial<WizardDraft>) => void; local: LocalState; patchLocal: (fn: (s: LocalState) => LocalState) => void }) {
  // Categories are created right here now (no separate Categories tab): type a
  // new one, it's added to the tenant library and selected on this listing.
  const tr = useT();
  // Is the platform's video-room service switched on? (a yes/no from the server; unknown = say nothing)
  const [videoReady, setVideoReady] = useState<boolean | null>(null);
  useEffect(() => { apiGet<{ videoReady: boolean }>("/api/online-sessions/status").then((r) => setVideoReady(r.videoReady)).catch(() => undefined); }, []);
  const w = useWord();
  const { locale } = useI18n();
  const [newCat, setNewCat] = useState("");
  const [addingVenue, setAddingVenue] = useState(false);
  const addCat = () => {
    const name = newCat.trim();
    if (name.length < 2) return;
    // Don't duplicate an existing category — just select it.
    const existing = local.categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      if (!d.categoryIds.includes(existing.id)) upd({ categoryIds: [...d.categoryIds, existing.id] });
      setNewCat("");
      return;
    }
    const id = uid();
    patchLocal((s) => ({ ...s, categories: [...s.categories, { id, name }] }));
    upd({ categoryIds: [...d.categoryIds, id] });
    setNewCat("");
  };
  const { settings } = useSettings();
  const seasons = settings.seasons ?? [];
  // Card is always accepted; these are the extra methods the tenant offers.
  const nonCard = (settings.payMethods ?? []).filter((m) => !/card/i.test(m));
  const accepted = d.payMethods ?? nonCard; // undefined = accept everything (legacy)
  return (
    <div className="max-w-[1120px]">
      <StepHead n={2} kicker={tr("p8lst.waKickDetails")} title={tr("p8lst.waDetailsTitle")} lede={tr("p8lst.waDetailsLede")} />
      <div className="grid items-start gap-4 md:grid-cols-2">
      <RichCard icon="📍" title={tr("p8lst.waWhereWhen")} subtitle={tr("p8lst.waWhereWhenSub")}>
      <SectionHead icon="🚗">{tr("p8lst.waDeliver")}</SectionHead>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {([["venue", tr("p8lst.waDel_venue")], ["online", "💻 " + tr("p9tx.delOnline")], ["home-visit", tr("p8lst.waDel_home")], ...(d.deliveryMode === "both" ? [["both", tr("p8lst.waDel_both")]] : [])] as [NonNullable<WizardDraft["deliveryMode"]> | "online", string][]).map(([mode, label]) => {
          const isOnl = isOnlineVenue(local.venues.find((v) => v.id === d.venueId)) && (d.deliveryMode ?? "venue") === "venue";
          const on = mode === "online" ? isOnl : mode === "venue" ? !isOnl && (d.deliveryMode ?? "venue") === "venue" : (d.deliveryMode ?? "venue") === mode;
          return (
            <button key={mode} type="button" onClick={() => {
              if (mode === "online") {
                // Online sessions have no address: use (or create) the account's "Online" place, so every page already knows how to show it.
                const pick = onlineVenueChoice(local.venues, uid());
                const id = pick.id;
                if (pick.create) patchLocal((st) => ({ ...st, venues: [...st.venues, { id, name: "Online", address: "", kind: "online" }] }));
                // Online: how families join is a real, saved choice from the start (ActivityOS room unless the provider picks their own link).
                upd({ deliveryMode: "venue", venueId: id, coverageArea: null, videoMode: d.videoMode ?? "platform" });
              } else {
                upd(deliveryPatch(mode, local.venues, d.venueId, !!d.coverageArea));
              }
            }}
              className="rounded-full border px-3 py-1.5 text-[12px] font-bold"
              style={on ? { borderColor: "var(--brand-2)", background: "var(--brand-soft)", color: "var(--brand-ink)" } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>
              {on ? "✓ " : ""}{label}
            </button>
          );
        })}
      </div>
      <div className="mb-1 text-[11px] text-[var(--ink-3)]">{tr("p8lst.waHomeHint")}</div>
      {(d.deliveryMode === "home-visit" || d.deliveryMode === "both") && (
        <div className="mb-3 flex items-start gap-2 rounded-xl border-2 border-[#12805a] bg-[#e9f9f2] px-3 py-2 text-[12.5px] font-bold leading-snug text-[#0b5a3f]">
          <span aria-hidden>🔒</span><span>{tr("p9tx.hvPrivacy")}</span>
        </div>
      )}

      {(d.deliveryMode ?? "venue") === "venue" && isOnlineVenue(local.venues.find((v) => v.id === d.venueId)) && (() => {
        const ov = local.venues.find((v) => v.id === d.venueId)!;
        return (
          <div className="mb-3 rounded-xl border-2 border-[#2f6bd8] bg-[#eef4ff] p-3">
            <div className="text-[13px] font-extrabold text-[#1d3a8f]">💻 {tr("p9tx.onlineTitle")}</div>
            <div className="mt-0.5 text-[12px] font-semibold text-[#3d4763]">{tr("p9tx.onlineNote")}</div>
            <div className="mt-2.5 opacity-60"><FieldLabel>{tr("p8lst.waVenue")}</FieldLabel><Select value={ov.id} disabled className="w-full max-w-[360px]"><option value={ov.id}>{ov.name}: {tr("p9tx.noAddressNeeded")}</option></Select></div>
            <div className="mt-3 rounded-xl border border-[var(--line)] bg-white p-3">
              <div className="text-[12.5px] font-extrabold text-[#16306e]">{tr("p9tx.vmTitle")}</div>
              {([["platform", tr("p9tx.vmPlatform"), tr("p9tx.vmPlatformSub")], ["own", tr("p9tx.vmOwn"), tr("p9tx.vmOwnSub")]] as const).map(([k, label, sub]) => {
                const on = (d.videoMode ?? "platform") === k;
                return (
                  <label key={k} className="mt-2 flex cursor-pointer items-start gap-2.5 rounded-lg border-2 p-2.5" style={on ? { borderColor: "var(--brand-2)", background: "var(--brand-soft)" } : { borderColor: "var(--line)" }}>
                    <input type="radio" name="wiz-video-mode" checked={on} onChange={() => upd({ videoMode: k })} className="mt-1" />
                    <span><span className="block text-[13px] font-extrabold">{label}</span><span className="block text-[11.5px] leading-snug text-[var(--ink-3)]">{sub}</span></span>
                  </label>
                );
              })}
              {(d.videoMode ?? "platform") === "platform" && videoReady === false && (
                <div className="mt-2 rounded-lg border border-[#f0c96b] bg-[#fff7e0] px-3 py-2 text-[12px] font-semibold text-[#7a4b00]">{tr("p9tx.vmNotReady")}</div>
              )}
              {(d.videoMode ?? "platform") === "own" ? (
                <div className="mt-2.5">
                  <FieldLabel htmlFor="wiz-own-link">{tr("p9tx.ownLinkLbl")}</FieldLabel>
                  <Input id="wiz-own-link" type="url" value={d.ownLink ?? ""} onChange={(e) => upd({ ownLink: e.target.value })} placeholder="https://" className="w-full" />
                  {(d.ownLink ?? "").trim() && !/^https:\/\/[^\s/$.?#][^\s]*\.[^\s]+$/i.test((d.ownLink ?? "").trim()) && <div role="alert" className="mt-1 text-[12px] font-semibold text-[#c02636]" data-testid="wiz-own-link-bad">{tr("p9tx.ownLinkBad")}</div>}
                  <label className="mt-2 flex cursor-pointer items-center gap-2 text-[12.5px] font-semibold"><input type="checkbox" checked={d.showLinkNow === true} onChange={(e) => upd({ showLinkNow: e.target.checked })} />{tr("p9tx.showNow")}</label>
                </div>
              ) : (
                <div className="mt-2.5 w-[170px]"><FieldLabel htmlFor="wiz-max-joiners">{tr("p9tx.maxJoinLbl")}</FieldLabel><Input id="wiz-max-joiners" type="number" min={1} value={d.maxJoiners ?? ""} onChange={(e) => upd({ maxJoiners: e.target.value })} className="w-full" /></div>
              )}
            </div>
            <div className="mt-2.5"><FieldLabel>{tr("p9tx.howJoinNotes")}</FieldLabel>
              <textarea rows={2} value={ov.directions ?? ""} onChange={(e) => patchLocal((st) => ({ ...st, venues: st.venues.map((v) => (v.id === ov.id ? { ...v, directions: e.target.value } : v)) }))}
                placeholder={tr("p9tx.howJoinNotesPh")} className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[var(--brand-2)]" /></div>
          </div>
        );
      })()}
      {(d.deliveryMode ?? "venue") !== "home-visit" && !(((d.deliveryMode ?? "venue") === "venue") && isOnlineVenue(local.venues.find((v) => v.id === d.venueId))) && (<>
        <SectionHead icon="📍">{tr("p8lst.waVenue")}</SectionHead>
        <Select value={d.venueId ?? ""} onChange={(e) => upd({ venueId: e.target.value || null })} className="mb-1 w-full max-w-[360px]">
          <option value="">{tr("p8lst.waSelectVenue")}</option>
          {local.venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </Select>
        {(local.venues.length === 0 || addingVenue) ? (
          <InlineVenueForm patchLocal={patchLocal} onAdded={(id) => { upd({ venueId: id }); setAddingVenue(false); }} onCancel={local.venues.length ? () => setAddingVenue(false) : undefined} />
        ) : (
          <button type="button" onClick={() => setAddingVenue(true)} className="mb-2 block text-[12px] font-bold text-[var(--brand-ink)] underline">{tr("p9jr.prereqAddVenue")}</button>
        )}
        <div className="mb-3 text-[11px] text-[var(--ink-3)]"><Rich text={tr("p8lst.waVenueHint")} /></div>
      </>)}

      {(d.deliveryMode === "home-visit" || d.deliveryMode === "both") && (
        <div className="mb-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
          <div className="mb-2 text-[11.5px] font-bold">{tr("p8lst.waCoverage")}</div>
          <div className="mb-2 flex gap-1.5">
            {([["postcodePrefixes", tr("p8lst.waCov_postcodePrefixes")], ["radius", tr("p8lst.waCov_radius")]] as [NonNullable<WizardDraft["coverageArea"]>["mode"], string][]).map(([mode, label]) => {
              const on = (d.coverageArea?.mode ?? "postcodePrefixes") === mode;
              return (
                <button key={mode} type="button" onClick={() => upd({ coverageArea: mode === "radius" ? { mode, basePostcode: d.coverageArea?.basePostcode, radiusMiles: d.coverageArea?.radiusMiles } : { mode, postcodePrefixes: d.coverageArea?.postcodePrefixes } })} className="rounded-full border px-3 py-1 text-[11.5px] font-bold"
                  style={on ? { borderColor: "var(--brand-2)", background: "var(--brand-soft)", color: "var(--brand-ink)" } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>
                  {on ? "✓ " : ""}{label}
                </button>
              );
            })}
          </div>
          {(d.coverageArea?.mode ?? "postcodePrefixes") === "postcodePrefixes" ? (
            <>
              <PostcodeListInput
                prefixes={d.coverageArea?.postcodePrefixes ?? []}
                placeholder={tr("p8lst.waPcPh")}
                onChange={(list) => upd({ coverageArea: { ...(d.coverageArea ?? { mode: "postcodePrefixes" }), mode: "postcodePrefixes", postcodePrefixes: list } })}
              />
              <div className="text-[11px] text-[var(--ink-3)]">{tr("p8lst.waPcHint")}</div>
            </>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <FieldLabel>{tr("p8lst.waBasePc")} <span className="font-normal text-[#0b5a3f]">{tr("p9tx.hvBaseHidden")}</span></FieldLabel>
                <PostcodeRecognised value={d.coverageArea?.basePostcode ?? ""} />
                <Input value={d.coverageArea?.basePostcode ?? ""} onChange={(e) => upd({ coverageArea: { ...(d.coverageArea ?? { mode: "radius" }), mode: "radius", basePostcode: e.target.value } })} placeholder={tr("p8lst.waBasePcPh")} className="w-[160px]" />
              </div>
              <div>
                <FieldLabel>{tr("p8lst.waRadius")}</FieldLabel>
                <Input type="number" min={1} value={d.coverageArea?.radiusMiles ?? ""} onChange={(e) => upd({ coverageArea: { ...(d.coverageArea ?? { mode: "radius" }), mode: "radius", radiusMiles: e.target.value ? Number(e.target.value) : undefined } })} className="w-[100px]" />
              </div>
            </div>
          )}
        </div>
      )}

      {seasons.length > 0 && (<>
        <SectionHead icon="📅">{tr("p8lst.waSeason")}</SectionHead>
        <Select value={d.seasonId ?? ""} onChange={(e) => upd({ seasonId: e.target.value || null })} className="mb-1 w-full max-w-[360px]">
          <option value="">{tr("p8lst.waNoSeason")}</option>
          {seasons.map((s) => <option key={s.id} value={s.id}>{seasonDisplayName(tr, s.name)}</option>)}
        </Select>
        <div className="mb-3 text-[11px] text-[var(--ink-3)]"><Rich text={tr("p8lst.waSeasonHint")} /></div>
      </>)}

      <FieldLabel>{tr("p8lst.waSitePhone")} <span className="font-normal text-[var(--ink-3)]">{tr("p8lst.waOptional")}</span></FieldLabel>
      <Input value={d.sitePhone ?? ""} onChange={(e) => upd({ sitePhone: e.target.value })} placeholder={tr("p8lst.waSitePh")} className="mb-1 w-full max-w-[280px]" inputMode="tel" />
      <div className="text-[11px] leading-[1.4] text-[var(--ink-3)]"><Rich text={tr("p8lst.waSiteHint")} /></div>

      </RichCard>
      <div className="flex flex-col gap-4">
      <RichCard icon="🏷️" title={tr("p8lst.waCategories")} subtitle={tr("p8lst.waCategoriesSub")} tint="teal">
      <div>
      <div className="mb-1 text-[11.5px] text-[var(--ink-3)]">{tr("p8lst.waCatHint")}</div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {local.categories.map((c) => (
          <button key={c.id} type="button" onClick={() => upd({ categoryIds: toggle(d.categoryIds, c.id) })} className="rounded-full border px-3 py-1.5 text-[12px] font-bold"
            style={d.categoryIds.includes(c.id) ? { borderColor: "var(--brand-2)", background: "var(--brand-soft)", color: "var(--brand-ink)" } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>
            {d.categoryIds.includes(c.id) ? "✓ " : ""}{optionLabel(c.name)}
          </button>
        ))}
        {local.categories.length === 0 && (
          <span className="py-1.5 text-[12px] text-[var(--ink-3)]">{tr("p8lst.waNoCats")}</span>
        )}
      </div>
      {/* Add a new category inline — no separate Categories tab. */}
      <div className="mb-3 flex gap-1.5">
        <input
          value={newCat}
          onChange={(e) => setNewCat(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCat(); } }}
          placeholder={tr("p8lst.waCatAddPh")}
          className="h-9 w-[220px] max-w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-[12.5px] text-[var(--ink)] outline-none focus:border-[var(--brand-2)]"
        />
        <button type="button" onClick={addCat} disabled={newCat.trim().length < 2}
          className="h-9 rounded-lg px-3.5 text-[12.5px] font-bold text-white transition-opacity disabled:opacity-40"
          style={{ background: "var(--brand-2)" }}>
          {tr("p8lst.waCatAddBtn")}
        </button>
      </div>
      {/* Orphaned tags: category ids saved earlier that no longer exist in the
          library (its ids were regenerated). Their names are gone, so the only
          fix is re-picking — say so plainly rather than dropping them silently. */}
      {d.categoryIds.some((id) => !local.categories.some((c) => c.id === id)) && (
        <div className="mb-3 rounded-xl border border-[#f0d9a8] bg-[#fdf6e6] p-3 text-[11.5px] leading-[1.5] text-[#7a5b06]">
          <Rich text={pickPlural(tr, locale, "p8lst.waOrphan", d.categoryIds.filter((id) => !local.categories.some((c) => c.id === id)).length)} />
        </div>
      )}
      {/* Every chosen type is listed on the page, but only one fits the hero
          image badge — let the operator say which. */}
      {d.categoryIds.length > 1 && (
        <div className="mb-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
          <div className="text-[11.5px] font-bold">{tr("p8lst.waHeroCat")}</div>
          <div className="mb-2 text-[11px] text-[var(--ink-3)]">{tr("p8lst.waHeroCatSub", { n: d.categoryIds.length })}</div>
          <div className="flex flex-wrap gap-1.5">
            {local.categories.filter((c) => d.categoryIds.includes(c.id)).map((c) => {
              const on = (d.heroCategoryId ?? d.categoryIds[0]) === c.id;
              return (
                <button key={c.id} type="button" onClick={() => upd({ heroCategoryId: c.id })} className="rounded-full border px-3 py-1.5 text-[12px] font-bold"
                  style={on ? { borderColor: "var(--brand-2)", background: "var(--brand-soft)", color: "var(--brand-ink)" } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>
                  {on ? "★ " : ""}{optionLabel(c.name)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      </div>
      </RichCard>
        <RichCard icon="💳" title={tr("p8lst.waPayTitle")} subtitle={tr("p8lst.waPaySub")} tint="teal">
          <div className="mb-2.5 text-[11.5px] leading-[1.5] text-[var(--ink-3)]"><Rich text={tr("p8lst.waPayHint")} /></div>
          <div className="flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[12px] font-bold" style={{ borderColor: "var(--line)", background: "var(--panel)", color: "var(--ink-2)" }}>{tr("p8lst.waCard")} <span className="font-normal text-[var(--ink-3)]">{tr("p8lst.waAlwaysOn")}</span></span>
            {nonCard.map((m) => {
              const on = accepted.includes(m);
              return (
                <button key={m} type="button" onClick={() => upd({ payMethods: toggle(accepted, m) })} className="rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors"
                  style={on ? { borderColor: "var(--brand-2)", background: "var(--brand-soft)", color: "var(--brand-ink)" } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>
                  {on ? "✓ " : ""}{w(m)}
                </button>
              );
            })}
            {nonCard.length === 0 && <span className="text-[12px] text-[var(--ink-3)]">{tr("p8lst.waNoOtherMethods")}</span>}
          </div>
        </RichCard>
      </div>
      </div>

    </div>
  );
}

// ── Step: Capacity (its own page — the age-caps make it tall) ─────────────────
function CapacityStep({ d, upd }: { d: WizardDraft; upd: (p: Partial<WizardDraft>) => void }) {
  const tr = useT();
  const { settings, save } = useSettings();
  return (
    <div className="mx-auto max-w-[1120px]">
      <StepHead n={3} kicker={tr("p8lst.waKickCapacity")} title={tr("p8lst.waCapacityTitle")} lede={tr("p8lst.waCapacityLede")} />
      <div className="grid items-start gap-4 md:grid-cols-2">
        <RichCard icon="👧👦" title={tr("p8lst.waPlacesSpaces")}>
      <div className="mb-3 flex gap-3 rounded-xl border border-[var(--line)] bg-white p-3">
        <div className="w-[110px]"><FieldLabel>{tr("p8lst.waAgeFrom")}</FieldLabel><Input type="number" min={0} value={d.ageFrom} onChange={(e) => upd({ ageFrom: e.target.value })} className="w-full" /></div>
        <div className="w-[110px]"><FieldLabel>{tr("p8lst.waAgeTo")}</FieldLabel><Input type="number" min={0} value={d.ageTo} onChange={(e) => upd({ ageTo: e.target.value })} className="w-full" /></div>
      </div>
          <YesNo label={tr("p8lst.waAllowOOR")} value={d.allowOutOfRange} onChange={(v) => upd({ allowOutOfRange: v })} help={tr("p8lst.waAllowOORHelp")} />
          {d.allowOutOfRange && (
            <div className="mb-2 flex items-start gap-2 rounded-lg border border-[#f0d9b5] bg-[#fdf6ea] px-3 py-2 text-[11.5px] leading-[1.5] text-[#8a5a09]">
              <span>ℹ️</span>
              <span><Rich text={tr("p8lst.waOORNote")} /></span>
            </div>
          )}
          <div className="my-2 flex flex-wrap items-end gap-2">
            <div className="w-[160px]"><FieldLabel>{tr("p8lst.waMaxAtt")}</FieldLabel><Input type="number" min={1} value={d.maxAttendees} onChange={(e) => upd({ maxAttendees: e.target.value })} className="w-full" /></div>
            <div className="flex gap-1 pb-[3px]">
              {[["day", tr("p8lst.waPerDay")], ["listing", tr("p8lst.waWholeListing")]].map(([k, l]) => (
                <button key={k} type="button" onClick={() => upd({ capacityScope: k as "day" | "listing" })} className="rounded-full border px-2.5 py-1 text-[11px] font-bold"
                  style={d.capacityScope === k ? { borderColor: "var(--brand-2)", background: "var(--brand-soft)", color: "var(--brand-ink)" } : { borderColor: "var(--line)", background: "#fff", color: "var(--ink-3)" }}>{l}</button>
              ))}
            </div>
          </div>
          <YesNo label={tr("p8lst.waShowSpaces")} value={d.showSpaces} onChange={(v) => upd({ showSpaces: v })} help={tr("p8lst.waShowSpacesHelp")} />
          <div className="mt-2 text-[11px] text-[var(--ink-3)]"><Rich text={tr("p8lst.waCapDefaults")} /></div>
        </RichCard>
        <RichCard icon="🎚️" title={tr("p8lst.waPerAgeCaps")} subtitle={tr("p8lst.waPerAgeCapsSub")} tint="violet">
          <AgeCaps d={d} upd={upd} />
        </RichCard>
      </div>
      <div className="mt-4">
      <SectionHead icon="⏳">{tr("p8lst.wbWaitHead")}</SectionHead>
      <YesNo label={tr("p8lst.wbWaitlistLabel")} value={d.waitlist} onChange={(v) => upd({ waitlist: v })} help={tr("p8lst.wbWaitlistHelp")} />
      {d.waitlist && (
        <div className="mt-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
          <YesNo label={tr("p8lst.wbAutoOfferLabel")} value={(d.waitlistMode ?? "manual") === "auto"} onChange={(v) => upd({ waitlistMode: v ? "auto" : "manual" })} help={(d.waitlistMode ?? "manual") === "auto" ? tr("p8lst.wbAutoOnHelp") : tr("p8lst.wbAutoOffHelp")} />
          {(d.waitlistMode ?? "manual") !== "auto" && (() => {
            const alertOn = settings.autoEmails?.waitlistFreeAlert !== false;
            return (
              <div className="mt-2 rounded-lg bg-[#fff7e0] px-2.5 py-2">
                <YesNo
                  label={tr("p8lst.wbAlertQ")}
                  value={alertOn}
                  onChange={(v) => {
                    if (!v && !window.confirm(tr("p8em.emWaitAlertOffWarn"))) return;
                    void save({ settings: { ...settings, autoEmails: { ...(settings.autoEmails ?? {}), waitlistFreeAlert: v } } });
                  }}
                  help={alertOn ? tr("p8lst.wbAlertOnNote") : tr("p8lst.wbAlertOffNote")}
                />
              </div>
            );
          })()}
          <div className="mt-2.5 w-[150px]">
            <FieldLabel>{tr("p8lst.wbMaxWaiting")}</FieldLabel>
            <Input type="number" min={0} value={d.waitlistSize} onChange={(e) => upd({ waitlistSize: e.target.value })} placeholder={tr("p8lst.wbNoLimit")} className="w-full" />
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

// Optional per-age-group place caps, drawn from the tenant's ratio groups so
// the freelancer caps against the same rooms they staff. On top of the total
// capacity above. Config only — the backend enforces it later (§S). This is
// the honest home for what "max size" was pretending to be on the ratios board:
// a booking-time limit, set before anyone books, not a flag on the day.
function AgeCaps({ d, upd }: { d: WizardDraft; upd: (p: Partial<WizardDraft>) => void }) {
  // Read-only: the group name, age range and room size are the shared tenant
  // policy, defined once in Setup → Age groups & rooms. Here you only set this
  // listing's per-day cap for each group. That keeps a listing from ever
  // contradicting the group config — you can go below the room size, never above.
  const tr = useT();
  const { settings } = useSettings();
  const from = parseInt(d.ageFrom, 10);
  const to = parseInt(d.ageTo, 10);
  // Groups are the tenant master record (name, age band, ratio, room size) — a
  // listing never changes them, it only caps places. Show the groups that
  // overlap this listing's age range.
  const groups = settings.ratioGroups.filter(
    (g) => (!Number.isFinite(to) || g.ageFrom <= to) && (!Number.isFinite(from) || g.ageTo >= from),
  );
  // These caps ALLOCATE the day's places across ages — so they can never add
  // up to more than the total. Each one is clamped to whatever's left after
  // the others, which makes "37 out of 22" impossible rather than something to
  // explain away.
  const totalCap = parseInt(d.maxAttendees, 10);
  const ceiling = Number.isFinite(totalCap) && totalCap > 0 ? totalCap : Infinity;
  const caps = d.ageCaps ?? {};
  const on = d.ageCapsOn || Object.keys(caps).length > 0;
  const capSum = groups.reduce((n, g) => n + (caps[g.id] ?? 0), 0);
  const anySet = Object.keys(caps).length > 0;
  const setCap = (id: string, v: string) => {
    const next = { ...caps };
    // Blank and zero are different: blank = no limit; 0 = closed, no child of
    // that age can book. Only a truly empty field means "no limit".
    if (v === "") { delete next[id]; upd({ ageCaps: next }); return; }
    const raw = parseInt(v, 10);
    if (Number.isNaN(raw) || raw < 0) return;
    if (raw === 0) { next[id] = 0; upd({ ageCaps: next }); return; }
    // A positive cap can't exceed (a) the day total minus the others, or
    // (b) the group's own room max from Ratios & groups — you can't put more
    // in a room than it holds. Whichever is smaller wins, so a listing cap can
    // never contradict the room size set in settings.
    const others = capSum - (caps[id] ?? 0);
    const budget = Number.isFinite(ceiling) ? Math.max(0, ceiling - others) : Infinity;
    const grp = groups.find((g) => g.id === id);
    const roomMax = grp && grp.maxSize > 0 ? grp.maxSize : Infinity;
    next[id] = Math.min(raw, budget, roomMax);
    upd({ ageCaps: next });
  };

  if (groups.length === 0) return null;

  return (
    <div className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--panel,#fbf8fc)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[12.5px] font-bold">{tr("p8lst.waLimitByAge")} <span className="font-normal text-[var(--ink-3)]">{tr("p8lst.waOptionalSkip")}</span></div>
          <div className="text-[11px] leading-[1.5] text-[var(--ink-3)]">
            <Rich text={Number.isFinite(ceiling) ? tr("p8lst.waCapsHintTotal", { n: ceiling }) : tr("p8lst.waCapsHintNoTotal")} />
          </div>
        </div>
        {!on && (
          <button type="button" onClick={() => upd({ ageCapsOn: true })}
            className="rounded-full border border-[var(--line)] px-3 py-1 text-[11.5px] font-bold text-[var(--brand-ink,#1d3a8f)]">
            {tr("p8lst.waSetAgeCaps")}
          </button>
        )}
      </div>

      {on && (
        <div className="mt-2.5 flex flex-col gap-1.5">
          {groups.map((g) => {
            const roomMax = g.maxSize > 0 ? g.maxSize : Infinity;
            const inputMax = Math.min(Number.isFinite(ceiling) ? ceiling : Infinity, roomMax);
            return (
            <div key={g.id} className="flex flex-wrap items-center gap-2">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: g.colour }} />
              {/* Name + age + room size are the shared group — read-only here,
                  defined in Setup → Age groups & rooms. */}
              <span className="w-[120px] text-[12px] font-semibold">{g.name}</span>
              <span className="text-[11px] text-[var(--ink-3)]">{tr("p8lst.waYrs", { from: g.ageFrom, to: g.ageTo })}</span>
              {g.maxSize > 0 && <span className="text-[10.5px] text-[var(--ink-3)]" title={tr("p8lst.waRoomTitle")}>{tr("p8lst.waRoomHolds", { n: g.maxSize })}</span>}
              <span className="ms-auto inline-flex items-center gap-1.5">
                <input type="number" min={0} max={Number.isFinite(inputMax) ? inputMax : undefined} value={caps[g.id] ?? ""} placeholder={tr("p8lst.waNoLimit")}
                  onChange={(e) => setCap(g.id, e.target.value)}
                  className="w-[86px] rounded-lg border bg-[var(--surface)] px-2 py-1 text-[12.5px]"
                  style={{ borderColor: caps[g.id] === 0 ? "#f0b8b8" : "var(--line)" }} />
                <span className="text-[11px] font-bold" style={{ color: caps[g.id] === 0 ? "#c0392b" : "var(--ink-3)" }}>
                  {caps[g.id] === 0 ? tr("p8lst.waClosed") : tr("p8lst.waADay")}
                </span>
              </span>
            </div>
            );
          })}

          {/* Allocation status. Over-spend is impossible (each cap is clamped
              to what's left), so this only ever confirms or nudges. */}
          {Number.isFinite(ceiling) && anySet && (() => {
            // "Capped" = has a hard number, 0 included (closed is a limit too).
            const allCapped = groups.every((g) => g.id in caps);
            const diff = ceiling - capSum;
            let tone: [string, string] = ["var(--surface)", "var(--ink-2)"];
            let msg: React.ReactNode;
            if (diff === 0) { tone = ["#eaf0fc", "#1d3a8f"]; msg = <Rich text={tr("p8lst.waAllocAll", { n: ceiling })} />; }
            else if (allCapped) { tone = ["#fff8ec", "#8a5300"]; msg = <Rich text={tr("p8lst.waAllocAllCapped", { sum: capSum, n: ceiling, diff })} />; }
            else { msg = <Rich text={tr("p8lst.waAllocPartial", { sum: capSum, n: ceiling, diff })} />; }
            return <div className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold leading-[1.5]" style={{ background: tone[0], color: tone[1] }}>{msg}</div>;
          })()}
          <div className="mt-2 flex flex-wrap items-center gap-2.5 border-t border-[var(--line)] pt-2.5">
            <button
              type="button"
              onClick={() => upd({ ageCapsOn: false, ageCaps: {} })}
              className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 py-1.5 text-[12px] font-bold text-[var(--ink-2)] hover:border-[var(--ink-3)]"
            >
              {tr("p8lst.waTurnOffCaps")}
            </button>
            <span className="text-[11px] text-[var(--ink-3)]"><Rich text={tr("p8lst.waSavesWith")} /></span>
            <span className="rounded-full bg-[#fff3e0] px-2 py-[2px] text-[10.5px] font-extrabold text-[#8a5300]">{tr("p8lst.waEnforced")}</span>
          </div>
          <div className="mt-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[11px] leading-[1.5] text-[var(--ink-3)]">
            <Rich text={tr("p8lst.waFullForAge")} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step: Content ──────────────────────────────────────────────────────────
function ContentStep({ d, upd, local, patchLocal }: { d: WizardDraft; upd: (p: Partial<WizardDraft>) => void; local: LocalState; patchLocal: (fn: (s: LocalState) => LocalState) => void }) {
  const tr = useT();
  const [aiN, setAiN] = useState(0);
  function writeAI() {
    const cats = local.categories.filter((c) => d.categoryIds.includes(c.id)).map((c) => c.name);
    // the field's words are the prompt; regenerate replaces (never appends).
    upd({ description: genDescription(d.description, d.descriptionSection, d, cats, aiN) });
    setAiN((n) => n + 1);
  }
  return (
    <div className="max-w-[1120px]">
      <StepHead n={2} kicker={tr("p8lst.waKickContent")} title={tr("p8lst.waContentTitle")} lede={tr("p8lst.waContentLede")} />
      <div className="grid items-start gap-4 md:grid-cols-2">
        <RichCard icon="📝" title={tr("p8lst.waMainDesc")} subtitle={tr("p8lst.waMainDescSub")}>
          <div className="mb-1.5 flex flex-wrap items-end gap-2">
            <div className="flex-1"><FieldLabel>{tr("p8lst.waSectionTitleEd")}</FieldLabel>
              <Input value={d.descriptionSection} onChange={(e) => upd({ descriptionSection: e.target.value })} placeholder={tr("p8lst.waSectionPh")} className="w-full" />
            </div>
            <Button sm variant="primary" onClick={writeAI} className="mb-[1px]">{tr("p8lst.waWriteAI")}</Button>
          </div>
          <div className="mb-1.5 flex flex-wrap gap-1">
            {SECTION_TYPES.map((t) => <button key={t} type="button" onClick={() => upd({ descriptionSection: t })} className="rounded-full border border-[var(--line)] bg-white px-2 py-[2px] text-[10.5px] font-bold text-[var(--ink-3)] hover:border-[var(--brand)]">{tr("p8lst." + SECTION_TYPE_KEY[t])}</button>)}
          </div>
          <textarea value={d.description} maxLength={300} onChange={(e) => upd({ description: e.target.value })}
            placeholder={tr("p8lst.waDescPh")}
            className="h-[120px] w-full rounded-lg border border-[var(--line)] bg-white p-2.5 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--brand)]" />
          <div className="mt-1 text-[11px] text-[var(--ink-3)]"><Rich text={tr("p8lst.waDescHint", { n: d.description.length, section: d.descriptionSection || tr("p8lst.waSectionWord") })} /></div>
        </RichCard>
        <div className="flex flex-col gap-4">
          <RichCard icon="➕" title={tr("p8lst.waAddSections")} subtitle={tr("p8lst.waAddSectionsSub")} tint="violet">
            <div className="mb-2 flex flex-col gap-1.5">
              {d.sections.map((s) => (
                <div key={s.id} className="rounded-lg border border-[var(--line)] bg-white p-2.5">
                  <div className="mb-1 flex items-center gap-2">
                    <Input value={s.type} onChange={(e) => upd({ sections: d.sections.map((x) => x.id === s.id ? { ...x, type: e.target.value } : x) })} placeholder={tr("p8lst.waSecTitlePh")} className="flex-1 font-bold" />
                    <button type="button" onClick={() => upd({ sections: d.sections.filter((x) => x.id !== s.id) })} className="text-[var(--ink-3)] hover:text-[var(--red)]">✕</button>
                  </div>
                  <Input value={s.text} onChange={(e) => upd({ sections: d.sections.map((x) => x.id === s.id ? { ...x, text: e.target.value } : x) })} placeholder={tr("p8lst.waSecTextPh")} className="w-full" />
                </div>
              ))}
            </div>
            <Select value="" onChange={(e) => e.target.value && upd({ sections: [...d.sections, { id: uid(), type: e.target.value, text: "" }] })} className="w-full">
              <option value="">{tr("p8lst.waAddASection")}</option>
              {SECTION_TYPES.map((s) => <option key={s} value={s}>{tr("p8lst." + SECTION_TYPE_KEY[s])}</option>)}
            </Select>
          </RichCard>
          <RichCard icon="🌟" title={tr("p8lst.waOutcomes")} subtitle={tr("p8lst.waOutcomesSub")} tint="teal">
            <EditableChips options={local.outcomes} sel={d.outcomes} emojis={local.emojis} showEmoji onToggle={(v) => upd({ outcomes: toggle(d.outcomes, v) })} onAdd={(name, emoji) => { patchLocal((s) => ({ ...s, outcomes: [...s.outcomes, name], emojis: { ...s.emojis, [name]: emoji } })); upd({ outcomes: [...d.outcomes, name] }); }} onDelete={(v) => { patchLocal((s) => ({ ...s, outcomes: s.outcomes.filter((x) => x !== v) })); upd({ outcomes: d.outcomes.filter((x) => x !== v) }); }} check />
          </RichCard>
        </div>
      </div>
    </div>
  );
}

// The wizard's classy building block — a deep-header card, light body.
function RichCard({ icon, title, subtitle, tint = "blue", children, className = "" }: { icon: string; title: string; subtitle?: string; tint?: "blue" | "teal" | "violet"; children: React.ReactNode; className?: string }) {
  const T = {
    blue: { head: "linear-gradient(120deg,#122a63 0%,#274f9e 55%,#3f78d8 100%)", border: "#b6cbef", ring: "rgba(18,41,95,.36)" },
    teal: { head: "linear-gradient(120deg,#0c4a5e 0%,#157b95 55%,#2fa6bf 100%)", border: "#b7dde7", ring: "rgba(12,74,94,.34)" },
    violet: { head: "linear-gradient(120deg,#2b1f66 0%,#5a3fb0 55%,#8064d8 100%)", border: "#cbc0f0", ring: "rgba(43,31,102,.34)" },
  }[tint];
  return (
    <div className={`overflow-hidden rounded-2xl border bg-white ${className}`} style={{ borderColor: T.border, boxShadow: `0 20px 44px -20px ${T.ring}` }}>
      <div className="flex items-center gap-2 px-3.5 py-2 text-white" style={{ background: T.head }}>
        <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-white/15 text-[14px] ring-1 ring-white/25">{icon}</span>
        <div className="min-w-0">
          <div className="text-[13px] font-extrabold leading-tight tracking-[-0.01em]">{title}</div>
          {subtitle && <div className="truncate text-[10px] font-semibold text-white/70">{subtitle}</div>}
        </div>
      </div>
      <div className="p-3.5" style={{ background: "linear-gradient(180deg,#ffffff,#eef4fd)" }}>{children}</div>
    </div>
  );
}

function SafetyStep({ d, upd, local, patchLocal }: { d: WizardDraft; upd: (p: Partial<WizardDraft>) => void; local: LocalState; patchLocal: (fn: (s: LocalState) => LocalState) => void }) {
  const tr = useT();
  return (
    <div className="max-w-[1120px]">
      <StepHead n={4} kicker={tr("p8lst.waKickSafety")} title={tr("p8lst.waSafetyTitle")} lede={tr("p8lst.waSafetyLede")} />
      <div className="grid gap-4 md:grid-cols-2">
        <RichCard icon="🛡️" title={tr("p8lst.waSafetyFeatures")}>
          <EditableChips options={local.safety} sel={d.safety} emojis={local.emojis} showEmoji onToggle={(v) => upd({ safety: toggle(d.safety, v) })} onAdd={(name, emoji) => { patchLocal((s) => ({ ...s, safety: [...s.safety, name], emojis: { ...s.emojis, [name]: emoji } })); upd({ safety: [...d.safety, name] }); }} onDelete={(v) => { patchLocal((s) => ({ ...s, safety: s.safety.filter((x) => x !== v) })); upd({ safety: d.safety.filter((x) => x !== v) }); }} check />
        </RichCard>
        <RichCard icon="🤝" title={tr("p8lst.waSendAccess")} tint="teal">
          <EditableChips options={local.send} sel={d.send} emojis={local.emojis} showEmoji onToggle={(v) => upd({ send: toggle(d.send, v) })} onAdd={(name, emoji) => { patchLocal((s) => ({ ...s, send: [...s.send, name], emojis: { ...s.emojis, [name]: emoji } })); upd({ send: [...d.send, name] }); }} onDelete={(v) => { patchLocal((s) => ({ ...s, send: s.send.filter((x) => x !== v) })); upd({ send: d.send.filter((x) => x !== v) }); }} check />
        </RichCard>
      </div>
      <div className="mt-2 text-[11px] text-[var(--ink-3)]">{tr("p8lst.waNewOptionsNote")}</div>
    </div>
  );
}

// ── Step: When it runs ─────────────────────────────────────────────────────
function RunStep({ d, upd }: { d: WizardDraft; upd: (p: Partial<WizardDraft>) => void }) {
  const tr = useT();
  const { locale } = useI18n();
  const weekly = d.blockMode === "weekly";
  const dates = useMemo(() => periodDates(d, genDates), [d.runFrom, d.runTo, d.days, d.runPeriods]);
  const weeks = useMemo(() => groupWeeks(dates), [dates]);
  const live = dates.filter((x) => !d.datesOff.includes(x)).length;
  // Changing the dates/days doesn't wipe the per-pass booking rules: the Tickets
  // & pricing step re-validates each rule against the new dates (falling back and
  // flagging any that no longer fit), and the booking engine guards them too — so
  // still-valid rules survive and only the impossible ones self-correct there.
  const dayLabel = <span className="mb-1.5 block text-[11.5px] font-extrabold text-[#16306e]">{weekly ? tr("p8lst.wbDaysLocked") : tr("p8lst.wbDaysItRuns")}</span>;
  return (
    <div className="max-w-[1120px]">
      <StepHead n={5} kicker={tr("p8lst.wbKickRun")} title={tr("p8lst.wbRunTitle")} lede={tr("p8lst.wbRunLede")} />
      <div className="grid items-start gap-4 md:grid-cols-2">
        <RichCard icon="🗓️" title={tr("p8lst.wbRunDatesTitle")} subtitle={tr("p8lst.wbRunDatesSub")}>
          {!(d.runPeriods?.length) && (<div className="mb-3 flex gap-3">
            <div className="flex-1"><FieldLabel htmlFor="wiz-run-from">{tr("p8lst.wbRunsFrom")}</FieldLabel><Input id="wiz-run-from" type="date" min={todayIso()} max={maxRunIso()} value={d.runFrom} onChange={(e) => upd({ runFrom: e.target.value })} onBlur={(e) => upd({ runFrom: fixYear(e.target.value) })} className="w-full" />{dateProblem(d.runFrom, todayIso(), 365) && <div className="mt-1 text-[11.5px] font-bold text-[#c02636]">{dateProblem(d.runFrom, todayIso(), 365) === "past" ? tr("p8lst.dateInPast") : tr("p8lst.dateTooFar")}</div>}</div>
            <div className="flex-1"><FieldLabel htmlFor="wiz-run-to">{tr("p8lst.wbRunsTo")}</FieldLabel><Input id="wiz-run-to" type="date" min={todayIso()} max={maxRunIso()} value={d.runTo} onChange={(e) => upd({ runTo: e.target.value })} onBlur={(e) => upd({ runTo: fixYear(e.target.value) })} className="w-full" />{dateProblem(d.runTo) && <div className="mt-1 text-[11.5px] font-bold text-[#c02636]">{dateProblem(d.runTo) === "past" ? tr("p8lst.dateInPast") : tr("p8lst.dateTooFar")}</div>}</div>
          </div>)}
          {/* Separate periods: a week now and another in 6 months, with nothing generated in between. */}
          {(d.runPeriods?.length ?? 0) > 0 && (
            <div className="mb-3 flex flex-col gap-2 rounded-xl border border-[var(--line)] bg-white p-2.5">
              {d.runPeriods!.map((p, i) => {
                const setP = (patch: Partial<{ from: string; to: string }>) => {
                  const next = d.runPeriods!.map((x, j) => (j === i ? { ...x, ...patch } : x));
                  const span = periodSpan(next);
                  upd({ runPeriods: next, runFrom: span.from, runTo: span.to });
                };
                return (
                  <div key={i} className="flex flex-wrap items-end gap-2">
                    <span className="w-[70px] pb-2 text-[11.5px] font-extrabold text-[#16306e]">{tr("p8lst.wbPeriodN", { n: i + 1 })}</span>
                    <Input type="date" aria-label={tr("p8lst.wbRunsFrom")} min={todayIso()} max={maxRunIso()} value={p.from} onChange={(e) => setP({ from: e.target.value })} onBlur={(e) => setP({ from: fixYear(e.target.value) })} className="w-[150px]" />
                    <Input type="date" aria-label={tr("p8lst.wbRunsTo")} min={todayIso()} max={maxRunIso()} value={p.to} onChange={(e) => setP({ to: e.target.value })} onBlur={(e) => setP({ to: fixYear(e.target.value) })} className="w-[150px]" />
                    {d.runPeriods!.length > 1 && (
                      <button type="button" onClick={() => { const next = d.runPeriods!.filter((_, j) => j !== i); const span = periodSpan(next); upd(next.length > 1 ? { runPeriods: next, runFrom: span.from, runTo: span.to } : { runPeriods: undefined, runFrom: next[0]?.from ?? "", runTo: next[0]?.to ?? "" }); }} className="pb-2 text-[12px] font-bold text-[var(--ink-3)] hover:text-[var(--red)]" title={tr("p8lst.wbPeriodRemove")}>✕</button>
                    )}
                  </div>
                );
              })}
              {periodsProblem(d.runPeriods!) === "overlap" || periodsProblem(d.runPeriods!) === "endBefore" ? <div className="text-[11.5px] font-bold text-[#c02636]">{tr("p8lst.wbPeriodsBad")}</div> : null}
              <div className="text-[11px] text-[var(--ink-3)]">{tr("p8lst.wbPeriodsNote")}</div>
            </div>
          )}
          <button type="button" onClick={() => upd(d.runPeriods?.length ? { runPeriods: [...d.runPeriods, { from: "", to: "" }] } : { runPeriods: [{ from: d.runFrom, to: d.runTo }, { from: "", to: "" }] })} className="mb-3 block text-[12px] font-bold text-[var(--brand-ink)] underline">{tr("p8lst.wbAddPeriod")}</button>
          <span className="mb-1.5 block text-[11.5px] font-extrabold text-[#16306e]">{tr("p8lst.wbBlockSize")}</span>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {[["weekly", tr("p8lst.wbBlockWeekly")], ["custom", tr("p8lst.wbBlockCustom")]].map(([k, label]) => (
              <button key={k} type="button" onClick={() => upd({ blockMode: k as "weekly" | "custom", days: k === "weekly" ? [1, 2, 3, 4, 5] : d.days })} className="rounded-lg border px-3 py-1.5 text-[12px] font-bold"
                style={d.blockMode === k ? { borderColor: "var(--brand-2)", background: "var(--brand-soft)", color: "var(--brand-ink)" } : { borderColor: "var(--line)", background: "#fff", color: "var(--ink-3)" }}>{label}</button>
            ))}
          </div>
          {dayLabel}
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map(([n]) => {
              const label = tr("p8lst.wbDay_" + n);
              const on = d.days.includes(n);
              return (
                <button key={n} type="button" disabled={weekly} onClick={() => upd({ days: toggle(d.days.map(String), String(n)).map(Number) })} className="rounded-full border px-3 py-1.5 text-[12px] font-bold disabled:opacity-50"
                  style={on ? { borderColor: "var(--brand-2)", background: "var(--brand-soft)", color: "var(--brand-ink)" } : { borderColor: "var(--line)", background: "#fff", color: "var(--ink-3)" }}>{label}</button>
              );
            })}
          </div>
        </RichCard>

        {runLooksWrong(weeks.length, d.runFrom) && (
          <div className="md:col-span-2 -mb-1 flex items-start gap-2 rounded-xl border-2 border-[#e9a915] bg-[#fff6dc] px-3 py-2 text-[12.5px] font-bold text-[#7a4b00]"><span aria-hidden>⚠️</span><span>{tr("p9tx.runTooLong", { n: weeks.length })}</span></div>
        )}
        <RichCard icon="📆" title={pickPlural(tr, locale, "p8lst.wbCalTitle", weeks.length)} subtitle={tr("p8lst.wbCalSub", { n: live })} tint="teal">
          {dates.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--line)] p-4 text-center text-[12px] text-[var(--ink-3)]">
              {tr("p8lst.wbCalEmpty")}
            </div>
          ) : (
            <>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-[11.5px] font-bold text-[var(--ink-2)]">
              <span>{tr("p8lst.wbWeeksSelected", { n: weeks.filter((w) => w.days.some((x) => !d.datesOff.includes(x))).length, total: weeks.length })}</span>
              <button type="button" onClick={() => upd({ datesOff: setWeekOff(d.datesOff, weeks.flatMap((w) => w.days), false) })} className="underline">{tr("p8lst.wbSelectAll")}</button>
              <button type="button" onClick={() => upd({ datesOff: setWeekOff(d.datesOff, weeks.flatMap((w) => w.days), true) })} className="underline">{tr("p8lst.wbSelectNone")}</button>
            </div>
            <div className="flex max-h-[300px] flex-col gap-2 overflow-y-auto pe-1">
              {weeks.map((w, i) => {
                const col = WEEK_PAL[i % WEEK_PAL.length];
                const weekOn = w.days.some((x) => !d.datesOff.includes(x));
                return (
                  <div key={w.mon} className="shrink-0 overflow-hidden rounded-xl border border-[var(--line)]" style={weekOn ? undefined : { opacity: 0.55 }}>
                    <div className="flex items-center gap-2 px-3 py-1.5 text-[12px] font-extrabold text-white" style={{ background: col }}>
                      <input type="checkbox" checked={weekOn} aria-label={tr("p8lst.wbIncludeWeek")} onChange={() => upd({ datesOff: setWeekOff(d.datesOff, w.days, weekOn) })} className="h-4 w-4 accent-white" />
                      {tr("p8lst.wbWeekN", { n: w.n })} <span className="font-semibold opacity-80">{tr("p8lst.wbWeekFrom", { date: fmtDate(w.mon) })}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 p-2.5">
                      {w.days.map((iso) => {
                        const off = d.datesOff.includes(iso);
                        return (
                          <button key={iso} type="button" onClick={() => upd({ datesOff: off ? d.datesOff.filter((x) => x !== iso) : [...d.datesOff, iso] })}
                            className="rounded-lg border px-2.5 py-1 text-[11px] font-bold"
                            style={off ? { borderColor: "var(--line)", color: "var(--ink-3)", textDecoration: "line-through", background: "#fff" } : { borderColor: col, color: col, background: "#fff" }}>
                            {fmtDate(iso)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            </>
          )}
        </RichCard>
      </div>
    </div>
  );
}

// ── Step: Tickets & pricing (pulls from Blocks) ────────────────────────────
function TicketsStep({ d, upd, blocks, tickets, onCreateBlock }: { d: WizardDraft; upd: (p: Partial<WizardDraft>) => void; blocks: BlocksStore; tickets: { name: string; days: number; price: number }[]; onCreateBlock: () => void }) {
  const tr = useT();
  const { locale } = useI18n();
  const [blkQ, setBlkQ] = useState("");
  const [blkSort, setBlkSort] = useState<"new" | "az">("new");
  // Newest first by default; or A to Z. Search matches the name. The block already picked stays visible while searching.
  const shownBlocks = useMemo(() => {
    const q = blkQ.trim().toLowerCase();
    const list = blocks.library.filter((b) => !q || b.name.toLowerCase().includes(q) || b.id === d.blockId);
    return [...list].sort(blkSort === "az"
      ? (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true })
      : (a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "") || (b.order ?? 0) - (a.order ?? 0));
  }, [blocks.library, blkQ, blkSort, d.blockId]);
  const ovUpd = (name: string, field: keyof TicketOverride, value: string) =>
    upd({ ticketOverrides: { ...d.ticketOverrides, [name]: { ...d.ticketOverrides[name], [field]: value } } });
  const toggleHidden = (name: string, hidden: boolean) =>
    upd({ ticketOverrides: { ...d.ticketOverrides, [name]: { ...d.ticketOverrides[name], hidden } } });
  // Close = capacity "0" (shows "Closed" to parents, not bookable). Reopen
  // clears it back to the listing default. Distinct from Hide, which removes
  // the pass from the listing entirely.
  const toggleClosed = (name: string, close: boolean) =>
    upd({ ticketOverrides: { ...d.ticketOverrides, [name]: { ...d.ticketOverrides[name], capacity: close ? "0" : "" } } });
  const setBookRule = (name: string, rule: BookRule) => upd({ bookRules: { ...(d.bookRules ?? {}), [name]: rule } });
  const multiDay = tickets.filter((t) => t.days > 1);
  // Booking-rule validity for multi-day passes — how many days a single week
  // offers vs the whole run. A pass can only book a way that actually fits.
  const weekLen = d.blockMode === "weekly" ? (d.days?.length || 5) : 7;
  const totalRun = periodDates(d, genDates).filter((x) => !(d.datesOff ?? []).includes(x)).length;
  const ruleValid = (days: number, k: BookRule) => k === "week" ? days <= weekLen : k === "blocks" ? (days === weekLen || days === totalRun) : days <= totalRun;
  const anyRuleReset = multiDay.some((t) => { const s = (d.bookRules ?? {})[t.name]; return s && !ruleValid(t.days, s); });
  return (
    <div className="mx-auto max-w-[1120px]">
      <StepHead n={6} kicker={tr("p8lst.wbKickTickets")} title={tr("p8lst.wbTicketsTitle")} lede={tr("p8lst.wbTicketsLede")} />
      <RichCard icon="🎟️" title={tr("p8lst.wbChooseBlock")} subtitle={tr("p8lst.wbChooseBlockSub")}>
        <div>
      {blocks.loading ? (
        <Card className="p-4 text-[12.5px] text-[var(--ink-3)]">{tr("p8lst.wbBlocksLoading")}</Card>
      ) : blocks.error ? (
        <Card className="p-4 text-[12.5px]" style={{ borderColor: "#f4c7c7", background: "#fdf2f2", color: "#b91c1c" }}>
          <b>{tr("p8lst.wbBlocksLoadFail")}</b> {blocks.error}
        </Card>
      ) : blocks.library.length === 0 ? (
        <Card className="p-4 text-[12.5px] text-[var(--ink-3)]">
          <div className="font-bold text-[var(--ink)]">{tr("p8lst.wbNoBlockTitle")}</div>
          <p className="mt-1">{tr("p8lst.wbNoBlockBody")}</p>
          <button type="button" data-ui="create-block" onClick={onCreateBlock} className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-[#1d3a8f] px-3.5 py-1.5 text-[12px] font-extrabold text-white hover:bg-[#16306e]">{tr("p9jr.prereqCreateBlock")}</button>
          <p className="mt-2.5 text-[11.5px]"><Rich text={tr("p8lst.wbNoBlockNote")} /></p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1"><span className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[14px]" aria-hidden>🔍</span>
              <input value={blkQ} onChange={(e) => setBlkQ(e.target.value)} placeholder={tr("p9tx.blkSearchPh")} aria-label={tr("p9tx.blkSearchPh")} className="w-full rounded-full border border-[var(--line)] bg-white py-2 ps-9 pe-3 text-[13px] outline-none focus:border-[var(--brand-2)]" /></div>
            <div className="inline-flex overflow-hidden rounded-full border border-[var(--line)] bg-white text-[12px] font-extrabold" role="group" aria-label={tr("p9tx.blkSortLbl")}>
              {([["new", tr("p9tx.blkSortNew")], ["az", tr("p9tx.blkSortAz")]] as const).map(([k, label]) => (
                <button key={k} type="button" aria-pressed={blkSort === k} onClick={() => setBlkSort(k)} className="px-3.5 py-2" style={blkSort === k ? { background: "#1d3a8f", color: "#fff" } : { color: "var(--ink-2)" }}>{label}</button>
              ))}
            </div>
          </div>
          {shownBlocks.length === 0 && <div className="rounded-xl border border-dashed border-[var(--line)] p-3 text-center text-[12.5px] text-[var(--ink-3)]">{tr("p9tx.blkNoMatch")}</div>}
          {shownBlocks.map((b, bi) => {
            const on = b.id === d.blockId;
            const openBlocks = onCreateBlock;
            if (on) return (
              // Selected: a strong, clearly-picked state with its own actions —
              // no longer a toggle, so clicking to explore can't deselect it.
              <div key={b.id} className="rounded-xl border-2 p-3" style={{ borderColor: "var(--brand-2)", background: "var(--brand-soft)" }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="whitespace-nowrap rounded-full bg-[var(--brand-2,#2f6bd8)] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">{tr("p8lst.wbSelected")}</span>
                    <div>
                      <div className="text-[13.5px] font-extrabold text-[var(--brand-ink)]">{b.name}</div>
                      <div className="text-[11.5px] text-[var(--ink-3)]">{tr("p8lst.wbPeriodsPasses", { p: b.periodIds.length, q: b.passIds.length })}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={openBlocks} className="whitespace-nowrap rounded-full border border-[var(--brand-2)] bg-white px-2.5 py-1 text-[11px] font-bold text-[var(--brand-ink)] hover:bg-[var(--brand-soft)]">{tr("p8lst.wbEditBlock")}</button>
                    <button type="button" onClick={() => upd({ blockId: null })} className="whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold text-[var(--ink-3)] hover:text-[#c0392b]">{tr("p8lst.wbUnselect")}</button>
                  </div>
                </div>
                <div className="mt-2.5 rounded-lg bg-white/60 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--brand-ink)]"><Rich text={tr("p8lst.wbPassesNow")} /></div>
              </div>
            );
            return (
              <button key={b.id} type="button" onClick={() => upd({ blockId: b.id })}
                className="flex items-center justify-between gap-2 rounded-xl border p-3 text-start transition-colors hover:border-[var(--brand-2)] hover:bg-[var(--panel)]"
                style={{ borderColor: "var(--line)" }}>
                <div>
                  <div className="text-[13.5px] font-extrabold">▥ {b.name}</div>
                  <div className="text-[11.5px] text-[var(--ink-3)]">{tr("p8lst.wbPeriodsPasses", { p: b.periodIds.length, q: b.passIds.length })}{b.createdAt ? ` · ${tr("p9tx.blkCreated", { date: new Date(b.createdAt).toLocaleDateString(dl(), { day: "numeric", month: "short", year: "numeric" }) })}` : ""}</div>
                </div>
                <span className="flex items-center gap-2">
                  {b.priced === false && <span className="whitespace-nowrap rounded-full bg-[#fdf0e3] px-2 py-0.5 text-[10px] font-extrabold text-[#b45309]">{tr("p9jr.needsPrices")}</span>}
                  <span className="whitespace-nowrap rounded-full border border-[var(--brand-2)] px-3 py-1 text-[11.5px] font-bold text-[var(--brand-ink)]">{tr("p8lst.wbUseBlock")}</span>
                </span>
              </button>
            );
          })}
          <button type="button" data-ui="create-block" onClick={onCreateBlock} className="self-start rounded-full border border-dashed border-[var(--brand-2)] px-3.5 py-1.5 text-[12px] font-bold text-[var(--brand-ink)] hover:bg-[var(--brand-soft)]">+ {tr("p9jr.prereqCreateBlock")}</button>
        </div>
      )}
      {tickets.length > 0 && (
        <div className="mt-3">
          <SectionHead icon="🎟️">{tr("p8lst.wbTicketsHead")}</SectionHead>
          <p className="mb-2 text-[11.5px] leading-[1.5] text-[var(--ink-3)]">
            <Rich text={tr("p8lst.wbCapPerDay")} />
          </p>
          {tickets.some((x) => x.days > 1) && (
            <div className="aos-rule-flash mb-3 flex items-start gap-3 rounded-2xl border-2 border-[#e9a915] px-4 py-3 text-[#5a3500]" style={{ background: "linear-gradient(120deg,#fff3cf,#ffe3a3)" }} role="note">
              <span className="text-[26px] leading-none" aria-hidden>👇</span>
              <div>
                <div className="text-[15px] font-extrabold">{tr("p9tx.ruleBannerTitle")}</div>
                <div className="mt-0.5 text-[13px] font-semibold leading-snug">{tr("p9tx.ruleBannerBody")}</div>
              </div>
            </div>
          )}
          <style>{`@keyframes aosRuleFlash{0%,100%{box-shadow:0 0 0 0 rgba(233,169,21,0)}50%{box-shadow:0 0 0 9px rgba(233,169,21,.55)}}.aos-rule-flash{animation:aosRuleFlash 1.1s ease-in-out 5}.aos-rule-label{animation:aosRuleFlash 1.1s ease-in-out 5;border-radius:10px;padding:4px 8px;display:inline-block}@media (prefers-reduced-motion: reduce){.aos-rule-flash,.aos-rule-label{animation:none}}`}</style>
          {anyRuleReset && (
            <div className="mb-2 rounded-lg border border-[#f0d9a8] bg-[#fdf6e6] px-3 py-2 text-[11.5px] font-semibold text-[#7a5b06]">
              {tr("p8lst.wbRuleReset")}
            </div>
          )}
          <div className="mb-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[10.5px] text-[var(--ink-3)]">
            <span><Rich text={tr("p8lst.wbCloseNote")} /></span>
            <span><Rich text={tr("p8lst.wbHideNote")} /></span>
          </div>
          {tickets.map((t) => {
            const ov = d.ticketOverrides[t.name] || {};
            const closed = ov.capacity === "0";
            const hidden = ov.hidden === true;
            // A pass needing more days than the whole run offers can't be booked
            // at all — grey the whole card out (parents can't pick it either;
            // the booking widget's passFits disables it the same way).
            const unfit = t.days > totalRun;
            // Accent bar reads state at a glance: red = closed / won't fit,
            // grey = hidden, brand blue = live.
            const accent = unfit ? "#c0392b" : hidden ? "var(--ink-3)" : closed ? "#e21d27" : "var(--brand-2,#2f6bd8)";
            return (
              <div key={t.name} className="mb-2 flex overflow-hidden rounded-xl border bg-[var(--surface)]" style={{ borderColor: unfit || (closed && !hidden) ? "#f0b8b8" : "var(--line)", opacity: unfit ? 0.6 : hidden ? 0.72 : 1, boxShadow: hidden ? "none" : "0 1px 0 rgba(20,30,60,.04)" }}>
                <span className="w-[5px] flex-none" style={{ background: accent }} />
                <div className="flex-1 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span className="text-[14px] font-extrabold">{t.name}</span>
                      <span className="rounded-full bg-[var(--panel)] px-2 py-[1px] text-[10.5px] font-bold text-[var(--ink-3)]">{pickPlural(tr, locale, "p8lst.wbDaysN", t.days)}</span>
                      {hidden && <span className="rounded-full bg-[var(--panel)] px-2 py-[1px] text-[10px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">{tr("p8lst.wbHidden")}</span>}
                      {unfit && !hidden && <span className="rounded-full bg-[#fdebec] px-2 py-[1px] text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#c0392b]">{tr("p8lst.wbWontFit")}</span>}
                      {closed && !hidden && !unfit && <span className="rounded-full bg-[#fdebec] px-2 py-[1px] text-[10px] font-extrabold uppercase tracking-[0.04em] text-[#c0392b]">{tr("p8lst.wbClosed")}</span>}
                    </span>
                    <span className="flex items-center gap-2.5">
                      <span className="text-[16px] font-black tracking-[-0.01em]" style={{ fontVariantNumeric: "tabular-nums", color: (closed || unfit) && !hidden ? "#c0392b" : "var(--ink)", textDecoration: unfit ? "line-through" : undefined }}>{money(t.price)}</span>
                      {!hidden && !unfit && (
                        <button type="button" onClick={() => toggleClosed(t.name, !closed)} title={closed ? tr("p8lst.wbReopenTip") : tr("p8lst.wbCloseTip")}
                          className="rounded-full border px-3 py-[4px] text-[11px] font-bold transition-colors"
                          style={closed ? { borderColor: "#e21d27", background: "#e21d27", color: "#fff" } : { borderColor: "#f0b8b8", color: "#c0392b" }}>
                          {closed ? tr("p8lst.wbReopen") : tr("p8lst.wbClose")}
                        </button>
                      )}
                      <button type="button" onClick={() => toggleHidden(t.name, !hidden)} className="rounded-full border border-[var(--line)] px-3 py-[4px] text-[11px] font-bold text-[var(--ink-2)] hover:border-[var(--ink-3)]">
                        {hidden ? tr("p8lst.wbShow") : tr("p8lst.wbHide")}
                      </button>
                    </span>
                  </div>
                  {!hidden && unfit && (
                    <div className="mt-2 rounded-lg bg-[#fdecec] px-2.5 py-2 text-[11.5px] font-semibold leading-[1.5] text-[#c0392b]">
                      <Rich text={tr("p8lst.wbUnfit", { days: t.days, total: totalRun })} />
                    </div>
                  )}
                  {!hidden && !unfit && (
                    <div className="mt-2.5 flex flex-wrap items-end gap-2">
                      <div className="w-[84px]"><FieldLabel>{tr("p8lst.wbAgeFrom")}</FieldLabel><Input type="number" min={0} value={ov.ageFrom ?? ""} onChange={(e) => ovUpd(t.name, "ageFrom", e.target.value)} placeholder={d.ageFrom || "—"} className="w-full" /></div>
                      <div className="w-[84px]"><FieldLabel>{tr("p8lst.wbAgeTo")}</FieldLabel><Input type="number" min={0} value={ov.ageTo ?? ""} onChange={(e) => ovUpd(t.name, "ageTo", e.target.value)} placeholder={d.ageTo || "—"} className="w-full" /></div>
                      <div className="w-[110px]"><FieldLabel>{tr("p8lst.wbCapDay")}</FieldLabel><Input type="number" min={0} value={ov.capacity ?? ""} onChange={(e) => ovUpd(t.name, "capacity", e.target.value)} placeholder={d.maxAttendees} className="w-full" style={closed ? { borderColor: "#f0b8b8", color: "#c0392b", fontWeight: 700 } : undefined} /></div>
                      <span className="pb-[6px] text-[10.5px] text-[var(--ink-3)]"><Rich text={tr("p8lst.wbPerDayNote")} /></span>
                    </div>
                  )}
                  {hidden && <div className="mt-1.5 text-[10.5px] text-[var(--ink-3)]"><Rich text={tr("p8lst.wbHiddenNote")} /></div>}
                  {/* How parents can book this pass — on the card itself (multi-day
                      passes only; a single day is always just picked per day). */}
                  {!hidden && !unfit && t.days > 1 && (() => {
                    const weekOk = t.days <= weekLen;
                    const blockOk = t.days === weekLen || t.days === totalRun;
                    const listingOk = t.days <= totalRun;
                    const okFor = (k: BookRule) => (k === "week" ? weekOk : k === "blocks" ? blockOk : listingOk);
                    const stored = (d.bookRules ?? {})[t.name];
                    const rule: BookRule = stored && okFor(stored) ? stored : (weekOk ? "week" : "listing");
                    const wasReset = !!stored && !okFor(stored);
                    return (
                      <div className="mt-2.5 border-t border-dashed border-[var(--line)] pt-2">
                        <FieldLabel><span className="aos-rule-label" style={{ background: "#fff3cf", color: "#5a3500" }}>👉 {tr("p8lst.wbHowBook")}</span>{wasReset && <span className="ms-1 font-bold text-[#c0392b]"> {tr("p8lst.wbResetConfirm")}</span>}</FieldLabel>
                        <div className="flex flex-wrap gap-1.5">
                          {BOOK_RULES.map((r) => {
                            const disabled = !okFor(r.key);
                            const sel = rule === r.key;
                            const why = r.key === "week" ? tr("p8lst.wbRuleWhyWeek", { days: t.days, week: weekLen })
                              : tr("p8lst.wbRuleWhyOther", { week: weekLen, total: totalRun });
                            return (
                              <button key={r.key} type="button" disabled={disabled} onClick={() => setBookRule(t.name, r.key)}
                                title={disabled ? why : undefined}
                                className="flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-[12px] font-extrabold transition-colors disabled:cursor-not-allowed disabled:opacity-35"
                                style={sel ? { background: r.color, borderColor: r.color, color: "#fff" } : { borderColor: `${r.color}59`, color: r.color, background: "#fff" }}>
                                <span className="text-[13px]">{r.icon}</span>{tr("p8lst.wbRuleLabel_" + r.key, { d: t.days })}
                              </button>
                            );
                          })}
                        </div>
                        <div className="mt-1 text-[11px] font-semibold text-[var(--ink-2)]">{tr("p8lst.wbRuleHint_" + (BOOK_RULES.find((r) => r.key === rule) ?? BOOK_RULES[0]).key, { d: t.days })}</div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      )}
        </div>
      </RichCard>
    </div>
  );
}

// ── Step: Automatic discounts ──────────────────────────────────────────────
// title/eg are English fallbacks — rendered through p8lst.wbDk_<kind>_title/_eg.
const DISCOUNT_KINDS: { kind: DiscountKind; title: string; eg: string; icon: string; colour: string }[] = [
  { kind: "person", title: "Multi-person", eg: "Siblings pay £3.50 each, bring a friend pay £10.00 each", icon: "👨‍👩‍👧", colour: "#2f6bd8" },
  { kind: "session", title: "Multi-session", eg: "Book more than 3 sessions to get 10% off", icon: "📅", colour: "#3f78d8" },
  { kind: "early", title: "Early bird", eg: "£10 off when they book before 1 June", icon: "🐦", colour: "#d97706" },
];

function DiscountsStep({ d, upd, tickets }: { d: WizardDraft; upd: (p: Partial<WizardDraft>) => void; tickets: { name: string; days: number; price: number }[] }) {
  const tr = useT();
  const { locale } = useI18n();
  const tx = { tr, locale };
  const rules = d.discounts ?? [];
  const setRules = (next: DiscountRule[]) => upd({ discounts: next });
  // One form at a time: picking a type opens it here rather than stacking
  // another card onto the page.
  const [form, setForm] = useState<DiscountRule | null>(null);
  // The name defaults to the auto-summary (e.g. "Siblings pay £3.50 each") and
  // keeps following the settings — until the operator types their own.
  const [nameEdited, setNameEdited] = useState(false);
  const openForm = (r: DiscountRule | null, edited = false) => { setForm(r); setNameEdited(edited); };
  const editing = !!form && rules.some((r) => r.id === form.id);
  // Editing an existing rule applies straight to the listing (as well as to the open form): the form has its own
  // "Save changes" button right above the wizard's, and pressing only the wizard's used to drop the edit silently.
  const set = (p: Partial<DiscountRule>) => {
    setForm((f) => (f ? { ...f, ...p } : f));
    if (editing && form) setRules(rules.map((r) => (r.id === form.id ? { ...r, ...p } : r)));
  };
  // Multi-person discounts are percentage-only. A rule saved earlier with another method keeps it until it is edited.
  const legacyPersonMethod = !!form && form.kind === "person" && editing && rules.find((r) => r.id === form.id)?.method !== "percent";
  const personPctOnly = !!form && form.kind === "person" && !legacyPersonMethod;
  const save = () => {
    if (!form) return;
    // Persist the shown name — the auto-summary when they didn't type their own.
    const finalRule = nameEdited && form.name.trim() ? form : { ...form, name: "" };
    setRules(editing ? rules.map((r) => (r.id === form.id ? finalRule : r)) : [...rules, finalRule]);
    openForm(null);
  };
  const kindOf = (k: DiscountKind) => DISCOUNT_KINDS.find((x) => x.kind === k)!;

  return (
    <div className="mx-auto max-w-[1120px]">
      <StepHead n={7} kicker={tr("p8lst.wbKickDisc")} title={tr("p8lst.wbDiscTitle")} lede={tr("p8lst.wbDiscLede")} />
      <RichCard icon="🏷️" title={tr("p8lst.wbDiscRules")} subtitle={tr("p8lst.wbDiscRulesSub")} tint="violet">
        <div>

      {/* Create / edit panel */}
      <Card className="mb-4 overflow-hidden p-0">
        <div className="border-b border-[var(--line)] bg-[var(--panel)] px-4 py-3">
          <div className="text-[13px] font-extrabold">{editing ? tr("p8lst.wbDiscEditRule") : tr("p8lst.wbDiscCreateRule")}</div>
          <div className="text-[11.5px] text-[var(--ink-3)]">{tr("p8lst.wbDiscSelectType")}</div>
        </div>

        <div className="grid gap-2 p-4 sm:grid-cols-3">
          {DISCOUNT_KINDS.map((k) => {
            const on = form?.kind === k.kind;
            return (
              <button key={k.kind} type="button" onClick={() => { if (!(on && form)) openForm(emptyRule(k.kind), false); }}
                className="rounded-xl border-2 p-3 text-start transition-all"
                style={on ? { borderColor: k.colour, background: `${k.colour}0f` } : { borderColor: "var(--line)" }}>
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg text-[16px]" style={{ background: `${k.colour}1a` }}>{k.icon}</span>
                  <span className="text-[12.5px] font-extrabold" style={{ color: on ? k.colour : "var(--ink)" }}>{tr("p8lst.wbDk_" + k.kind + "_title")}</span>
                  {on && <span className="ms-auto text-[13px]" style={{ color: k.colour }}>✓</span>}
                </div>
                <div className="mt-1.5 text-[11px] leading-[1.45] text-[var(--ink-3)]">{tr("p8lst.wbDk_" + k.kind + "_eg")}</div>
              </button>
            );
          })}
        </div>

        {form && (
          <div className="border-t border-[var(--line)] p-4">
            <FieldLabel>{tr("p8lst.wbDiscName")}</FieldLabel>
            <Input value={nameEdited ? form.name : ruleSummary(form, tx)} onChange={(e) => { const v = e.target.value; if (v.trim() === "") { setNameEdited(false); set({ name: "" }); } else { setNameEdited(true); set({ name: v }); } }} placeholder={ruleSummary(form, tx)} className="mb-3.5 w-full text-[12.5px]" />

            <FieldLabel>{tr("p8lst.wbDiscWhich")}</FieldLabel>
            <div className="mb-3.5 flex flex-wrap gap-1.5">
              <button type="button" onClick={() => set({ passNames: [] })} className="rounded-full border px-2.5 py-1 text-[11.5px] font-bold"
                style={form.passNames.length === 0 ? { borderColor: "var(--brand-2)", background: "var(--brand-soft)", color: "var(--brand-ink)" } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>{tr("p8lst.wbAllTickets")}</button>
              {tickets.map((t) => {
                const on = form.passNames.includes(t.name);
                return (
                  <button key={t.name} type="button" onClick={() => set({ passNames: on ? form.passNames.filter((x) => x !== t.name) : [...form.passNames, t.name] })}
                    className="rounded-full border px-2.5 py-1 text-[11.5px] font-bold"
                    style={on ? { borderColor: "var(--brand-2)", background: "var(--brand-soft)", color: "var(--brand-ink)" } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>{t.name}</button>
                );
              })}
              {tickets.length === 0 && <span className="text-[11.5px] text-[var(--ink-3)]">{tr("p8lst.wbPickBlockFirst")}</span>}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {form.kind !== "early" ? (
                <div>
                  <FieldLabel>{form.kind === "person" ? tr("p8lst.wbDiscMoreAtt") : tr("p8lst.wbDiscMoreSes")}</FieldLabel>
                  <Input type="number" min={1} value={form.moreThan} onChange={(e) => set({ moreThan: Math.max(1, parseInt(e.target.value, 10) || 1) })} className="w-full" />
                </div>
              ) : (
                <div>
                  <FieldLabel>{tr("p8lst.wbDiscBefore")}</FieldLabel>
                  <Input type="date" value={form.beforeDate} onChange={(e) => set({ beforeDate: e.target.value })} className="w-full" />
                </div>
              )}

              {form.kind === "person" && (
                <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[11.5px] leading-[1.5] text-[var(--ink-2)]">
                  <Rich text={tr("p8lst.wbDiscPersonNote")} />
                </div>
              )}

              <div>
                <FieldLabel>{tr("p8lst.wbDiscMethod")}</FieldLabel>
                <Select value={form.method} onChange={(e) => set({ method: e.target.value as DiscountRule["method"] })} className="w-full text-[12px]">
                  {form.kind !== "session" && !personPctOnly && <option value="price">{tr("p8lst.wbDiscM_price")}</option>}
                  {form.kind !== "session" && !personPctOnly && <option value="subtract">{tr("p8lst.wbDiscM_subtract")}</option>}
                  <option value="percent">{tr("p8lst.wbDiscM_percent")}</option>
                </Select>
              </div>
              <div>
                <FieldLabel>{form.method === "percent" ? tr("p8lst.wbDiscPercentOff") : tr("p8lst.wbDiscAmount")}</FieldLabel>
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-extrabold text-[var(--ink-3)]">{form.method === "percent" ? "%" : "£"}</span>
                  <Input type="number" min={0} step="0.01" value={form.value} onChange={(e) => set({ value: Math.max(0, parseFloat(e.target.value) || 0) })} className="w-full" />
                </div>
              </div>
            </div>

            {form.kind === "early" && form.method !== "percent" && (
              <div className="mt-3 text-[11.5px] leading-[1.5] text-[var(--ink-3)]">
                <Rich text={tr("p8lst.wbDiscEarlyOnce")} />
              </div>
            )}
            {form.kind === "person" && (
              <div className="mt-3 text-[11.5px] leading-[1.5] text-[var(--ink-3)]">
                <Rich text={tr(legacyPersonMethod ? "p8lst.wbDiscPersonLegacy" : "p8lst.wbDiscPersonWhyPct")} />
              </div>
            )}
            <div className="mt-3.5 rounded-lg border-s-4 bg-[var(--panel)] p-2.5 text-[12px] text-[var(--ink-2)]" style={{ borderInlineStartColor: kindOf(form.kind).colour }}>
              <b>{tr("p8lst.wbParentsSee")}</b> {nameEdited && form.name.trim() ? prettyRuleName(form.name.trim()) : ruleSummary(form, tx)}
            </div>

            {form.kind === "early" && !form.beforeDate && (
              <div className="mt-3 text-[11.5px] font-bold text-[var(--ink-2)]">{tr("p8lst.wbDiscNoDate")}</div>
            )}
            <div className="mt-3 flex gap-2">
              <Button variant="primary" onClick={save}>{editing ? tr("p8lst.wbSaveChanges") : tr("p8lst.wbAddDiscount")}</Button>
              <Button onClick={() => openForm(null)}>{tr("p8lst.wbCancel")}</Button>
            </div>
          </div>
        )}
      </Card>

      {/* Saved rules */}
      {rules.length > 0 && (
        <>
          <SectionHead>{tr("p8lst.wbYourDiscounts", { n: rules.length })}</SectionHead>
          <div className="flex flex-col gap-2">
            {rules.map((r) => {
              const k = kindOf(r.kind);
              return (
                <div key={r.id} className="flex flex-wrap items-center gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3" style={{ borderInlineStart: `4px solid ${k.colour}`, opacity: r.enabled ? 1 : 0.55 }}>
                  <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-[15px]" style={{ background: `${k.colour}1a` }}>{k.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-bold">{ruleDisplayName(r, tx)}</span>
                    <span className="block truncate text-[11px] text-[var(--ink-3)]">{tr("p8lst.wbDk_" + k.kind + "_title")} · {r.passNames.length ? r.passNames.join(", ") : tr("p8lst.wbAllTicketsLc")}</span>
                  </span>
                  <span className="rounded-full px-2.5 py-1 text-[11.5px] font-extrabold" style={{ background: `${k.colour}1a`, color: k.colour }}>
                    {r.method === "percent" ? `${r.value}%` : money(r.value)}
                  </span>
                  <button type="button" onClick={() => setRules(rules.map((x) => (x.id === r.id ? { ...x, enabled: !x.enabled } : x)))}
                    className="rounded-full border px-2.5 py-1 text-[11px] font-bold"
                    style={r.enabled ? { borderColor: "var(--brand-2)", background: "var(--brand-soft)", color: "var(--brand-ink)" } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>{r.enabled ? tr("p8lst.wbOn") : tr("p8lst.wbOff")}</button>
                  <Button sm onClick={() => openForm(r, !!r.name?.trim() && ruleDisplayName(r) === prettyRuleName(r.name.trim()))}>{tr("p8lst.wbEdit")}</Button>
                  <button type="button" onClick={() => { setRules(rules.filter((x) => x.id !== r.id)); if (form?.id === r.id) openForm(null); }} className="text-[var(--ink-3)] hover:text-[var(--red)]">✕</button>
                  {r.kind === "person" && r.method !== "percent" && (
                    <div className="basis-full rounded-lg border-2 border-[#e9a915] bg-[#fff3cf] px-3 py-2 text-[12px] font-bold leading-snug text-[#5a3500]" role="note">
                      ⚠️ {tr("p9tx.oldPersonWarn")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {rules.length === 0 && !form && (
        <Card className="p-4 text-[12.5px] text-[var(--ink-3)]">{tr("p8lst.wbNoDiscounts")}</Card>
      )}

      <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 text-[11.5px] text-[var(--ink-3)]">
        <Rich text={tr("p8lst.wbDiscStack")} bClass="text-[var(--ink-2)]" />
      </div>
        </div>
      </RichCard>
    </div>
  );
}

// Inline on each step: reword the heading this step's content appears under on
// the customer page. Blank keeps the wording shown as the placeholder.
// Reword every heading a parent sees. Blank = use the wording shown as the
// placeholder. Lives once on the Preview step (was also inline on each step —
// removed as redundant clutter).
function HeadingsEditor({ d, upd }: { d: WizardDraft; upd: (p: Partial<WizardDraft>) => void }) {
  const tr = useT();
  const [open, setOpen] = useState(false);
  const set = (k: string, v: string) => upd({ headings: { ...(d.headings ?? {}), [k]: v } });
  return (
    <Card className="mb-3 p-3.5">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-start">
        <span>
          <span className="text-[13px] font-extrabold">{tr("p8lst.wbSecHeadings")}</span>
          <span className="ms-2 text-[11.5px] text-[var(--ink-3)]">{tr("p8lst.wbSecHeadingsSub")}</span>
        </span>
        <span className="text-[13px] text-[var(--ink-3)]">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="mt-3 flex flex-col gap-2.5">
          {SECTION_KEYS.map((s) => (
            <div key={s.key} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[130px_1fr_1fr]">
              <span className="text-[11.5px] font-bold text-[var(--ink-2)]">{tr("p8lst.wbSecLabel_" + s.key)}</span>
              <Input value={d.headings?.[`${s.key}.eyebrow`] ?? ""} onChange={(e) => set(`${s.key}.eyebrow`, e.target.value)} placeholder={(() => { const k = `p7pg.h_${s.key}_eyebrow`; const v = tr(k); return v !== k ? v : s.eyebrow; })()} className="w-full text-[12px]" />
              <Input value={d.headings?.[`${s.key}.title`] ?? ""} onChange={(e) => set(`${s.key}.title`, e.target.value)} placeholder={s.key === "about" && d.descriptionSection ? d.descriptionSection : (() => { const k = `p7pg.h_${s.key}_title`; const v = tr(k); return v !== k ? v : s.title; })()} className="w-full text-[12px]" />
            </div>
          ))}
          <div className="text-[11px] text-[var(--ink-3)]">{tr("p8lst.wbSecHeadingsNote")}</div>
        </div>
      )}
    </Card>
  );
}

// Give an add-on an emoji (from the bank) or a photo — shown next to it on the
// customer page. A photo wins over an emoji.
function AddonIcon({ addon, patchLocal }: { addon: AddonTemplate; patchLocal: (fn: (s: LocalState) => LocalState) => void }) {
  const tr = useT();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<AddonTemplate>) =>
    patchLocal((s) => ({ ...s, addons: s.addons.map((x) => (x.id === addon.id ? { ...x, ...patch } : x)) }));
  async function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) set({ image: await fileToImage(f), emoji: undefined });
    e.target.value = "";
    setOpen(false);
  }
  const shown = q.trim() ? EMOJI_BANK.filter((_, i) => i < 300).filter((x) => x.includes(q.trim())) : EMOJI_BANK.slice(0, 300);
  return (
    <span className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} title={tr("p8lst.wbPickEmojiTip")}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] text-[15px] hover:border-[var(--brand)]">
        {addon.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={addon.image} alt="" className="h-full w-full rounded-lg object-cover" />
        ) : addon.emoji || "🖼"}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute end-0 z-30 mt-1 w-[290px] rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2.5 shadow-lg">
            <div className="mb-2 flex items-center gap-1.5">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("p8lst.wbSearchEmoji")} className="w-full text-[12px]" />
              <Button sm onClick={() => fileRef.current?.click()}>{tr("p8lst.wbImage")}</Button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickImage} />
            <div className="grid max-h-[190px] grid-cols-10 gap-0.5 overflow-y-auto">
              {shown.map((e, i) => (
                <button key={i} type="button" onClick={() => { set({ emoji: e, image: undefined }); setOpen(false); }}
                  className="flex h-6 w-6 items-center justify-center rounded text-[15px] hover:bg-[var(--panel)]">{e}</button>
              ))}
            </div>
            {(addon.emoji || addon.image) && (
              <button type="button" onClick={() => { set({ emoji: undefined, image: undefined }); setOpen(false); }}
                className="mt-2 w-full rounded-lg border border-[var(--line)] py-1.5 text-[11.5px] font-bold text-[var(--ink-3)]">{tr("p8lst.wbRemove")}</button>
            )}
          </div>
        </>
      )}
    </span>
  );
}

function AddonsStep({ d, upd, local, patchLocal }: { d: WizardDraft; upd: (p: Partial<WizardDraft>) => void; local: LocalState; patchLocal: (fn: (s: LocalState) => LocalState) => void }) {
  const tr = useT();
  const [name, setName] = useState("");
  const [type, setType] = useState<"perday" | "once">("perday");
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState("");
  // Editing reuses the create form rather than a second one: same fields, same
  // validation, and no chance of the two drifting apart.
  const [editing, setEditing] = useState<string | null>(null);
  const [qs, setQs] = useState<AddonQuestion[]>([]);
  const types: Record<string, string> = { perday: tr("p8lst.wbAddonPerDay"), once: tr("p8lst.wbAddonOnce") };
  const clear = () => { setName(""); setPrice(""); setDesc(""); setType("perday"); setQs([]); setEditing(null); };
  const startEdit = (a: AddonTemplate) => {
    setEditing(a.id);
    setName(a.name);
    setType(a.type === "perday" ? "perday" : "once");
    setPrice(String(a.price ?? ""));
    setDesc(a.description ?? "");
    setQs(a.questions ?? []);
  };
  const save = () => {
    if (name.trim().length < 2) return;
    // Questions with no label are half-typed rows, not questions.
    const keep = qs.filter((q) => q.label.trim()).map((q) => ({
      ...q,
      label: q.label.trim(),
      options: q.type === "choice" ? (q.options ?? []).map((o) => o.trim()).filter(Boolean) : undefined,
    }));
    const fields = {
      name: name.trim(), type, price: Math.max(0, parseFloat(price) || 0),
      description: desc.trim() || undefined,
      questions: keep.length ? keep : undefined,
    };
    if (editing) {
      // A price change has to reach anything already using it, so patch in
      // place rather than replacing the id.
      patchLocal((s) => ({ ...s, addons: s.addons.map((x) => (x.id === editing ? { ...x, ...fields } : x)) }));
    } else {
      const a = { id: uid(), ...fields };
      patchLocal((s) => ({ ...s, addons: [...s.addons, a] }));
      upd({ addonIds: [...d.addonIds, a.id] });
    }
    clear();
  };
  return (
    <div className="mx-auto max-w-[1120px]">
      <StepHead n={8} kicker={tr("p8lst.wbKickAddons")} title={tr("p8lst.wbAddonsTitle")} lede={tr("p8lst.wbAddonsLede")} />
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-[#b7dde7] bg-[#eef8fb] px-3 py-2 text-[11.5px] leading-[1.5] text-[#0c4a5e]">
        <span>🍽</span>
        <span className="flex-1"><Rich text={tr("p8lst.wbFoodNote")} /></span>
        <button type="button" onClick={() => window.open(window.location.pathname.replace(/\/[^/]*$/, "/meals"), "_blank")} className="whitespace-nowrap rounded-full border border-[#0c4a5e] bg-white px-2.5 py-1 text-[11px] font-bold text-[#0c4a5e] hover:bg-[#eef8fb]">{tr("p8lst.wbOpenMeals")}</button>
      </div>
      <div className="grid items-start gap-4 md:grid-cols-2">
      <RichCard icon="🧩" title={tr("p8lst.wbYourAddons")} subtitle={tr("p8lst.wbTickForListing")} tint="teal">
      {local.addons.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {local.addons.map((a) => {
            const on = d.addonIds.includes(a.id);
            return (
              <div key={a.id} className="flex items-center gap-2 rounded-lg border p-2.5" style={on ? { borderColor: "var(--brand-2)", background: "var(--brand-soft)" } : { borderColor: "var(--line)" }}>
                <button type="button" onClick={() => upd({ addonIds: toggle(d.addonIds, a.id) })} className="flex flex-1 items-center gap-2 text-start">
                  <span className="text-[13px]">{on ? "☑" : "☐"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-bold">{a.name}</span>
                    {a.description && <span className="block text-[10.5px] leading-[1.4] text-[var(--ink-3)]">{a.description}</span>}
                  </span>
                  <span className="flex-none text-[11px] text-[var(--ink-3)]">{types[a.type] ?? tr("p8lst.wbAddonOnce")} · {money(a.price)}</span>
                </button>
                <AddonIcon addon={a} patchLocal={patchLocal} />
                <button type="button" onClick={() => startEdit(a)} title={tr("p8lst.wbEditItem", { name: a.name })}
                  className="rounded-lg border border-[var(--line)] px-2 py-1 text-[11px] font-bold text-[var(--ink-2)] hover:border-[var(--brand)]">{tr("p8lst.wbEdit")}</button>
                <button type="button" onClick={() => { if (!confirm(tr("p9tx.adDelConfirm", { name: a.name }))) return; if (editing === a.id) clear(); patchLocal((s) => ({ ...s, addons: s.addons.filter((x) => x.id !== a.id) })); upd({ addonIds: d.addonIds.filter((x) => x !== a.id) }); }} className="text-[var(--ink-3)] hover:text-[var(--red)]">✕</button>
              </div>
            );
          })}
        </div>
      ) : <div className="rounded-lg border border-dashed border-[var(--line)] p-5 text-center text-[12px] text-[var(--ink-3)]">{tr("p8lst.wbNoAddons")}</div>}
      </RichCard>
      <RichCard icon={editing ? "✏️" : "➕"} title={editing ? tr("p8lst.wbEditingTitle", { name: local.addons.find((x) => x.id === editing)?.name ?? "" }) : tr("p8lst.wbCreateAddon")} subtitle={tr("p8lst.wbSavedReusable")}>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1"><FieldLabel>{tr("p8lst.wbName")}</FieldLabel><Input value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("p8lst.wbAddonNamePh")} className="w-full" /></div>
        <div><FieldLabel>{tr("p8lst.wbType")}</FieldLabel><Select value={type} onChange={(e) => setType(e.target.value as "perday" | "once")} className="w-[130px]">{Object.entries(types).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></div>
        <div className="w-[90px]"><FieldLabel>{tr("p8lst.wbPriceGbp")}</FieldLabel><Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} className="w-full" /></div>
        <div className="w-full"><FieldLabel>{tr("p8lst.wbDescription")} <span className="font-normal text-[var(--ink-3)]">{tr("p8lst.wbOptionalShown")}</span></FieldLabel>
          <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={tr("p8lst.wbAddonDescPh")} className="w-full" /></div>
        <div className="w-full">
          <FieldLabel>{tr("p8lst.wbQuestions")} <span className="font-normal text-[var(--ink-3)]">{tr("p8lst.wbQuestionsSub")}</span></FieldLabel>
          {qs.map((q, i) => {
            const set = (patch: Partial<AddonQuestion>) => setQs(qs.map((x, n) => (n === i ? { ...x, ...patch } : x)));
            return (
              <div key={q.id} className="mb-1.5 flex flex-wrap items-end gap-2 rounded-lg border border-[var(--line)] p-2">
                <div className="min-w-[150px] flex-1">
                  <FieldLabel>{tr("p8lst.wbQuestion")}</FieldLabel>
                  <Input value={q.label} onChange={(e) => set({ label: e.target.value })} placeholder={tr("p8lst.wbQuestionPh")} className="w-full" />
                </div>
                <div>
                  <FieldLabel>{tr("p8lst.wbAnswer")}</FieldLabel>
                  <Select value={q.type} onChange={(e) => set({ type: e.target.value as AddonQuestion["type"] })} className="w-[130px]">
                    <option value="choice">{tr("p8lst.wbPickOne")}</option>
                    <option value="text">{tr("p8lst.wbTypeAnswer")}</option>
                  </Select>
                </div>
                {q.type === "choice" && (
                  <div className="min-w-[180px] flex-1">
                    <FieldLabel>{tr("p8lst.wbOptions")} <span className="font-normal text-[var(--ink-3)]">{tr("p8lst.wbOptionsSub")}</span></FieldLabel>
                    <Input value={(q.options ?? []).join(", ")} onChange={(e) => set({ options: e.target.value.split(",") })}
                      placeholder={tr("p8lst.wbOptionsPh")} className="w-full" />
                  </div>
                )}
                <label className="flex items-center gap-1.5 pb-2 text-[11.5px] font-bold text-[var(--ink-2)]">
                  <input type="checkbox" checked={!!q.required} onChange={(e) => set({ required: e.target.checked })} />
                  {tr("p8lst.wbMustAnswer")}
                </label>
                <button type="button" onClick={() => setQs(qs.filter((_, n) => n !== i))}
                  className="pb-2 text-[var(--ink-3)] hover:text-[var(--red)]">✕</button>
              </div>
            );
          })}
          <Button sm onClick={() => setQs([...qs, { id: uid(), label: "", type: "choice", options: [] }])}>{tr("p8lst.wbAddQuestion")}</Button>
        </div>
        <Button variant="primary" onClick={save}>{editing ? tr("p8lst.wbSaveChanges") : tr("p8lst.wbAddPlus")}</Button>
        {editing && <Button onClick={clear}>{tr("p8lst.wbCancel")}</Button>}
      </div>
      </RichCard>
      </div>
    </div>
  );
}

function StaffStep({ d, upd, local, patchLocal }: { d: WizardDraft; upd: (p: Partial<WizardDraft>) => void; local: LocalState; patchLocal: (fn: (s: LocalState) => LocalState) => void }) {
  const tr = useT();
  const [q, setQ] = useState("");
  const [bioN, setBioN] = useState<Record<string, number>>({});
  // The tenant's real team (people who have joined through Team & invites) — so onboarding someone makes them
  // tickable here without re-typing them into the library's own staff list. Managers only: anyone else gets a 403 and keeps the library list.
  const [team, setTeam] = useState<{ uid: string; name: string }[]>([]);
  useEffect(() => { apiGet<{ team?: { uid: string; name: string }[] }>("/api/location-staff").then((r) => setTeam(r.team ?? [])).catch(() => {}); }, []);
  const teamId = (uid: string) => `u_${uid}`;
  const toMember = (t: { uid: string; name: string }): StaffMember => { const [first, ...rest] = t.name.trim().split(/\s+/); return { id: teamId(t.uid), first: first || t.name, last: rest.join(" "), bio: "" }; };
  const known = new Set(local.staff.map((m) => m.id));
  const all: StaffMember[] = [...local.staff, ...team.filter((t) => !known.has(teamId(t.uid))).map(toMember)];
  // A team member joins the library list (what customer pages read) the moment they're ticked or given a bio.
  const adopt = (m: StaffMember, patch: Partial<StaffMember> = {}) => patchLocal((s) => (s.staff.some((x) => x.id === m.id) ? { ...s, staff: s.staff.map((x) => (x.id === m.id ? { ...x, ...patch } : x)) } : { ...s, staff: [...s.staff, { ...m, ...patch }] }));
  const updMember = (m: StaffMember, patch: Partial<StaffMember>) => adopt(m, patch);
  // "Write with AI" works from the few words the person typed. Pressing it again must reuse THOSE words, not read back the bio it just wrote
  // (that produced gibberish like "a gift for tom, lead, friendly"). Typing in the box starts a fresh set of words.
  const [seed, setSeed] = useState<Record<string, string>>({});
  const writeBio = (m: StaffMember) => { const base = seed[m.id] ?? m.bio; if (seed[m.id] === undefined) setSeed((x) => ({ ...x, [m.id]: m.bio })); updMember(m, { bio: genBio(base, m, bioN[m.id] || 0) }); setBioN((x) => ({ ...x, [m.id]: (x[m.id] || 0) + 1 })); };
  const query = q.trim().toLowerCase();
  const list = query ? all.filter((m) => `${m.first} ${m.last}`.toLowerCase().includes(query)) : all;
  const assignedCount = all.filter((m) => d.staffIds.includes(m.id)).length;
  return (
    <div className="mx-auto max-w-[1120px]">
      <StepHead n={9} kicker={tr("p8lst.wbKickStaff")} title={tr("p8lst.wbStaffTitle")} lede={tr("p8lst.wbStaffLede")} />
      <RichCard icon="🧑‍🏫" title={tr("p8lst.wbYourTeam")} subtitle={tr("p8lst.wbYourTeamSub")}>
        <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("p8lst.wbSearchStaffPh")} className="w-full max-w-[300px]" />
        <span className="text-[11.5px] font-semibold text-[var(--ink-3)]">{tr("p8lst.wbAssignedN", { n: assignedCount })}</span>
      </div>
      {all.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--line)] p-5 text-center text-[12px] text-[var(--ink-3)]"><Rich text={tr("p8lst.wbNoStaff")} /></div>
      ) : list.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--line)] p-5 text-center text-[12px] text-[var(--ink-3)]">{tr("p8lst.wbNoStaffMatch", { q })}</div>
      ) : (
        <div className="grid items-start gap-2 md:grid-cols-2">
          {list.map((m) => {
            const on = d.staffIds.includes(m.id);
            return (
              <div key={m.id} className="rounded-xl border p-3" style={on ? { borderColor: "var(--brand-2)", background: "var(--brand-soft)" } : { borderColor: "var(--line)", background: "var(--panel)" }}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-white font-extrabold text-[var(--brand-ink)] ring-1 ring-[var(--brand-2)]/30">{(m.first[0] || "?").toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-extrabold text-[var(--ink)]">{m.first} {m.last}</div>
                    <div className="truncate text-[10.5px] text-[var(--ink-3)]">{m.bio ? m.bio : tr("p8lst.wbNoBio")}</div>
                  </div>
                  <Button sm variant={on ? "primary" : "default"} onClick={() => { if (!on) adopt(m); upd({ staffIds: toggle(d.staffIds, m.id) }); }}>{on ? tr("p8lst.wbOnsite") : tr("p8lst.wbAssign")}</Button>
                </div>
                <div className="mb-1 flex items-center justify-between">
                  <FieldLabel>{tr("p8lst.wbBio")} <span className="font-normal text-[var(--ink-3)]">{tr("p8lst.wbParentsSeeThis")}</span></FieldLabel>
                  <Button sm onClick={() => writeBio(m)}>{tr("p8lst.wbWriteAI")}</Button>
                </div>
                <textarea value={m.bio} maxLength={300} onChange={(e) => { setSeed((x) => { const { [m.id]: _drop, ...rest } = x; return rest; }); updMember(m, { bio: e.target.value }); }} placeholder={tr("p8lst.wbBioPh")}
                  className="h-[58px] w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2 text-[12.5px] text-[var(--ink)] outline-none focus:border-[var(--brand)]" />
              </div>
            );
          })}
        </div>
      )}
      <div className="mt-2 text-[11px] text-[var(--ink-3)]"><Rich text={tr("p8lst.wbStaffNote")} /></div>
        </div>
      </RichCard>
    </div>
  );
}

/** Optional embargo: the listing is visible, but booking is held until a date. */
function BookingOpens({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const tr = useT();
  // Default to 9am tomorrow — a sensible "next morning" release most operators want.
  const suggest = () => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    t.setHours(9, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T09:00`;
  };
  if (!value) {
    return (
      <button type="button" onClick={() => onChange(suggest())}
        className="mb-1 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[12.5px] font-bold text-[var(--brand-ink)] hover:border-[var(--brand-2)]">
        {tr("p8lst.wbScheduleOpen")}
      </button>
    );
  }
  return (
    <div className="mb-1 rounded-xl border p-3" style={{ borderColor: "var(--brand-2)", background: "var(--brand-soft)" }}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="text-[12.5px] font-extrabold text-[var(--brand-ink)]">{tr("p8lst.wbBookingsOpenAt")}</div>
        <button type="button" onClick={() => onChange("")} className="text-[11.5px] font-bold text-[var(--ink-3)] underline">{tr("p8lst.wbOpenNow")}</button>
      </div>
      <Input type="datetime-local" value={value} onChange={(e) => onChange(e.target.value)} className="w-full max-w-[240px]" />
      <div className="mt-1.5 text-[11px] leading-[1.5] text-[var(--ink-2)]">
        {tr("p8lst.wbOpensNote")}
      </div>
    </div>
  );
}

// The booking cut-off — how close to a session families can still book.
function BookingCutoff({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const tr = useT();
  return (
    <div className="mb-1 mt-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
      <div className="text-[12.5px] font-extrabold text-[var(--brand-ink)]">{tr("p8lst.wbStopBookings")}</div>
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12.5px] font-semibold text-[var(--ink-2)]">
        <Input type="number" min={0} step={1} value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, "").slice(0, 4))} placeholder="0" className="w-[90px]" aria-label={tr("p8lst.wbHoursBeforeAria")} />
        <span>{tr("p8lst.wbHoursBefore")}</span>
      </div>
      <div className="mt-1.5 text-[11px] leading-[1.5] text-[var(--ink-2)]">
        {tr("p8lst.wbCutoffNote")}
      </div>
    </div>
  );
}

/** Parent-facing line under "Choose your dates" when the listing has a cut-off. */
function cutoffNote(d: WizardDraft, color: string, tr: (k: string, v?: Record<string, string | number>) => string, locale: string) {
  const h = parseInt(d.bookingCutoffHours ?? "", 10);
  if (!Number.isFinite(h) || h <= 0) return null;
  const label = h >= 48 && h % 24 === 0 ? pickPlural(tr, locale, "p7pol.dy", h / 24) : pickPlural(tr, locale, "p7pol.hr", h);
  return <div className="-mt-1 mb-2 text-[11.5px] font-semibold" style={{ color }}>{tr("p7be.cutoffNote", { label })}</div>;
}

function PolicyStep({ d, upd }: { d: WizardDraft; upd: (p: Partial<WizardDraft>) => void }) {
  const tr = useT();
  const { settings: wizSettings } = useTenantSettings();
  const vis: [WizardDraft["visibility"], string, string][] = [
    ["public", tr("p8lst.wbVisPublic"), tr("p8lst.wbVisPublicDesc")],
    ["hidden", tr("p8lst.wbVisHidden"), tr("p8lst.wbVisHiddenDesc")],
  ];
  const book: [WizardDraft["bookingType"], string][] = [["auto", tr("p8lst.wbBookAuto")], ["manual", tr("p8lst.wbBookManual")]];
  // The provider's own policies, written in Setup & features. Picking one here
  // sets both the id (what the refund is worked out from) and the wording
  // (what a parent reads) — they can't be chosen separately any more, because
  // separately is how they came to disagree.
  const ownPolicies = wizSettings.cancellationPolicies;
  return (
    <div className="mx-auto max-w-[1120px]">
      <StepHead n={11} kicker={tr("p8lst.wbKickPolicy")} title={tr("p8lst.wbPolicyTitle")} lede={tr("p8lst.wbPolicyLede")} />
      <RichCard icon="📋" title={tr("p8lst.wbPolicyCard")} subtitle={tr("p8lst.wbPolicyCardSub")}>
        <div>
      <SectionHead icon="👁️">{tr("p8lst.wbWhoSees")}</SectionHead>
      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        {vis.map(([k, label, desc]) => (
          <button key={k} type="button" onClick={() => upd({ visibility: k })} className="rounded-xl border p-2.5 text-start" style={d.visibility === k ? { borderColor: "var(--brand-2)", background: "var(--brand-soft)" } : { borderColor: "var(--line)" }}>
            <div className="text-[12.5px] font-extrabold">{d.visibility === k ? "● " : ""}{label}</div>
            <div className="text-[11px] text-[var(--ink-3)]">{desc}</div>
          </button>
        ))}
      </div>
      <BookingOpens value={d.opensAt ?? ""} onChange={(v) => upd({ opensAt: v })} />
      <BookingCutoff value={d.bookingCutoffHours ?? ""} onChange={(v) => upd({ bookingCutoffHours: v })} />
      <SectionHead icon="📋">{tr("p8lst.wbApproveHead")}</SectionHead>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {book.map(([k, label]) => (
          <button key={k} type="button" onClick={() => upd({ bookingType: k })} className="rounded-lg border px-3 py-1.5 text-[12px] font-bold" style={d.bookingType === k ? { borderColor: "var(--brand-2)", background: "var(--brand-soft)", color: "var(--brand-ink)" } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>{d.bookingType === k ? "✓ " : ""}{label}</button>
        ))}
      </div>
      <SectionHead icon="📄">{tr("p8lst.wbCancelPolicy")}</SectionHead>
      <Select
        value={d.cancellationPolicyId ?? ownPolicies[0]?.id ?? ""}
        onChange={(e) => {
          const chosen = ownPolicies.find((p) => p.id === e.target.value);
          // Store both: the id is what a refund is worked out from, the
          // wording is what the storefront shows. Setting them together is the
          // only way they stay in agreement.
          if (chosen) upd({ cancellationPolicyId: chosen.id, cancellation: policyWording({ ...chosen, wording: undefined }) });
        }}
        className="w-full text-[12px]"
      >
        {ownPolicies.map((p) => (
          <option key={p.id} value={p.id}>{p.name || tr("p8lst.wbUntitledPolicy")}</option>
        ))}
      </Select>
      <div className="mt-1.5 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 py-2 text-[11.5px] leading-[1.5] text-[var(--ink-2)]">
        {d.cancellation || tr("p8lst.wbPickPolicy")}
      </div>
      <div className="mt-1 text-[11px] text-[var(--ink-3)]">
        <Rich text={tr("p8lst.wbPolicyFrom")} />
      </div>
        </div>
      </RichCard>
    </div>
  );
}

// ── Live parent preview — mirrors the manual's customer storefront ─────────
function myBrand() {
  const u = firebaseAuth.currentUser;
  return u?.displayName || (u?.email ? u.email.split("@")[0] : "") || "Your business";
}
/**
 * Scheduled open (step 11). The listing stays browsable — only booking is held
 * — so everyone gets the same starting gun on a popular run.
 */

type BookView = { b: ReturnType<typeof useBooking>; d: WizardDraft; booking: BlockBooking | null; weeks: { n: number; mon: string; days: string[] }[]; spacesLeft: number | null; addons: LocalState["addons"]; mode?: "operator" | "parent"; onBook?: (p: { method: string; voucherScheme?: string; voucherRefs?: Record<string, string>; tfc?: { amount: number; remainderVia: string; references: Record<string, string> }; discountCodes?: string[]; walletCap?: number; phone?: string; basket: BasketItem[]; addonSel: Record<string, Record<string, string[]>>; addonAns: Record<string, Record<string, string>>; mealSel: Record<string, string>; children: ChildProfile[]; dayAssign: Record<string, Record<string, string[]>>; parent?: { id: string; name: string; email?: string; phone?: string; address?: string } | null; /** Home-visit listings only: where this session actually happens — defaults to the parent's saved address, editable at checkout. */ serviceAddress?: { address: string; postcode: string }; /** Operator checkout "Override the total" (server accepts it only for a booking made on a family's behalf). */ overrideTotal?: number; overrideReason?: string }) => void; bookState?: { busy: boolean; error: string | null }; tenantId?: string };

// Dispatcher — same logic, theme-specific presentation.
/**
 * The waiting-list half of the picker. Full dates are chosen the same way
 * bookable ones are, so someone wanting five days with two full doesn't have
 * to choose between booking and queuing — they do both in one go.
 */
function WaitlistPanel({ b, d, tone }: { b: ReturnType<typeof useBooking>; d: WizardDraft; tone: "light" | "dark" }) {
  const tr = useT();
  const { locale } = useI18n();
  if (!b.waitlistOn || !b.fullCount) return null;
  const dark = tone === "dark";
  // Red, to match the "full" markers (a full day's dot is #ff5470). A warm,
  // readable red — not alarm-red — so "full" reads consistently everywhere.
  const box = dark
    ? { borderColor: "#ff5470", background: "#2a1016", color: "#ffc2cd" }
    : { borderColor: "#f6c9cc", background: "#fdecec", color: "#b3261e" };
  const cta = dark ? "#e5484d" : "#dc2626";

  if (b.waitDone) {
    return (
      <div className="mt-3 rounded-2xl border p-3.5 text-[12px] leading-[1.55]" style={box}>
        <b>{tr("p7bw.onWaitlist")}</b>
        {/* Spell out exactly what they're queued for — a parent who booked
            three separate dates needs to know which ones this covers. */}
        {b.waitSel.length > 0 && (
          <div className="mt-1.5 rounded-lg px-2.5 py-1.5" style={{ background: dark ? "#00000030" : "#ffffff80" }}>
            <div className="font-bold">{b.datesPretty(b.waitSel)}</div>
            {b.period?.range && <div className="opacity-90">{b.period.range}{b.pass?.name ? ` · ${b.pass.name}` : ""}</div>}
          </div>
        )}
        <div className="mt-1.5">
          <Rich text={tr((d.waitlistMode ?? "manual") === "auto" ? "p7bw.waitAuto" : "p7bw.waitManual")} />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border p-3.5" style={box}>
      <div className="flex flex-wrap items-center gap-2">
        <b className="text-[12.5px]">{pickPlural(tr, locale, "p7bw.daysFull", b.fullCount)}</b>
        <button type="button" onClick={b.waitAll} className="ms-auto text-[11.5px] font-bold underline underline-offset-2">
          {b.waitSel.length === b.fullCount ? tr("p7med.clearAll") : tr("p7bw.joinAll", { n: b.fullCount })}
        </button>
      </div>
      <div className="mt-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] leading-[1.5]" style={{ background: dark ? "#00000030" : "#ffffff70" }}>
        <span className="font-bold">{tr("p7bw.fullLbl")}</span> {b.datesPretty(b.fullDays)}
      </div>
      <div className="mt-1.5 text-[11.5px] leading-[1.5]">
        {b.waitSel.length === 0
          ? tr("p7bw.tapFullDay")
          : pickPlural(tr, locale, "p7bw.onYourList", b.waitSel.length, { dates: b.datesPretty(b.waitSel) })}
      </div>
      {b.waitSel.length > 0 && !b.isSingle && (
        <div className="mt-2 text-[11.5px] font-bold leading-[1.45]">
          {tr("p9tx.wzWaitOneDay")}
        </div>
      )}
      {b.waitSel.length > 0 && b.isSingle && (
        <>
          <button type="button" onClick={b.joinWaitlist}
            className="mt-2.5 w-full rounded-xl py-2.5 text-[12.5px] font-extrabold text-white"
            style={{ background: cta }}>
            {pickPlural(tr, locale, "p7bw.joinWaitN", b.waitSel.length)}
          </button>
          <div className="mt-1.5 text-[11px] leading-[1.45] opacity-90">
            {tr("p7bw.nothingToPayWait")}
          </div>
        </>
      )}
    </div>
  );
}

const BASKET_NOTE_KEY = "aos.basket.lastListing.v1";
function BookingWidget({ d, booking, weeks, spacesLeft, addons, blocks, mode, onBook, bookState, theme = "playful", tenantId }: {
  d: WizardDraft; booking: BlockBooking | null; weeks: { n: number; mon: string; days: string[] }[]; spacesLeft: number | null; addons: LocalState["addons"]; blocks?: RunBlock[]; mode?: "operator" | "parent"; onBook?: (p: { method: string; voucherScheme?: string; voucherRefs?: Record<string, string>; tfc?: { amount: number; remainderVia: string; references: Record<string, string> }; discountCodes?: string[]; walletCap?: number; phone?: string; basket: BasketItem[]; addonSel: Record<string, Record<string, string[]>>; addonAns: Record<string, Record<string, string>>; mealSel: Record<string, string>; children: ChildProfile[]; dayAssign: Record<string, Record<string, string[]>>; parent?: { id: string; name: string; email?: string; phone?: string; address?: string } | null; /** Home-visit listings only: where this session actually happens — defaults to the parent's saved address, editable at checkout. */ serviceAddress?: { address: string; postcode: string }; /** Operator checkout "Override the total" (server accepts it only for a booking made on a family's behalf). */ overrideTotal?: number; overrideReason?: string }) => void; bookState?: { busy: boolean; error: string | null }; theme?: PageTheme; tenantId?: string;
}) {
  const tr = useT();
  const { locale } = useI18n();
  // A family can't pick a day that's already gone (the server enforces it too).
  // Operators still see every day — they may record a past attendance.
  // useState initialiser, not a bare new Date() in render (React Compiler).
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const weeksShown = mode === "parent"
    ? weeks.map((w) => ({ ...w, days: w.days.filter((iso) => iso >= today) })).filter((w) => w.days.length > 0)
    : weeks;
  const b = useBooking(d, booking, weeksShown, blocks, mode);
  const view: BookView = { b, d, booking, weeks: weeksShown, spacesLeft, addons, mode, onBook, bookState, tenantId };
  // Checkout is much shorter than the calendar it replaces, so without this the
  // card collapses and leaves you staring at whitespace. "nearest" nudges it
  // into view only if it isn't already — no jump to the top of the page.
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (b.stage !== "pick") box.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [b.stage]);
  // Only one listing's basket is kept at a time (useBooking's state is fresh per listing page) —
  // a family who picks a pass here, then browses to a different listing, loses that selection with
  // no warning today. Not fixing the "one basket" limit itself (that's a real product decision), just
  // making the silent loss visible: note what's in the basket in sessionStorage, and if a DIFFERENT
  // listing's basket is found stashed when this one mounts, say what was dropped.
  const [droppedBasketNotice, setDroppedBasketNotice] = useState<string | null>(null);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(BASKET_NOTE_KEY);
      if (raw) {
        const prev = JSON.parse(raw) as { listingId: string | null; title: string; count: number };
        if (prev.listingId !== d.id) {
          setDroppedBasketNotice(pickPlural(tr, locale, "p7bw.dropped", prev.count, { title: prev.title }));
        }
        sessionStorage.removeItem(BASKET_NOTE_KEY);
      }
    } catch { /* sessionStorage unavailable (private mode etc) — the notice is a courtesy, not load-bearing */ }
    // Once per mount (a fresh listing page), not on every basket change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    try {
      if (b.basket.length > 0) sessionStorage.setItem(BASKET_NOTE_KEY, JSON.stringify({ listingId: d.id, title: d.title, count: b.basket.length }));
      else sessionStorage.removeItem(BASKET_NOTE_KEY);
    } catch { /* ignore */ }
  }, [b.basket.length, d.id, d.title]);
  return (
    <div ref={box}>
      {droppedBasketNotice && (
        <div className="mb-2.5 flex items-start justify-between gap-2 rounded-xl border border-dashed border-[#d9a84e] bg-[#fff8e8] px-3 py-2 text-[12px] font-semibold text-[#7a5210]">
          <span>⚠️ {droppedBasketNotice}</span>
          <button type="button" onClick={() => setDroppedBasketNotice(null)} className="shrink-0 font-extrabold opacity-70 hover:opacity-100" aria-label={tr("p7bw.dismiss")}>✕</button>
        </div>
      )}
      {theme === "playful" ? <PlayfulBooking {...view} /> : <SportBooking {...view} surf={THEMES[theme]} />}
    </div>
  );
}

// Parents for this tenant — the operator books on their behalf.


/**
 * Operator-side checkout: add-ons, find the parent, then put a child against
 * each pass (with bulk add). Shared by both page styles — only colours differ.
 */
/**
 * The checkout, for both audiences. An operator is booking on someone's behalf
 * so starts by finding the parent; a parent already is the parent, so that step
 * doesn't exist for them and they get a payment method instead. Everything
 * between — children per pass, add-ons per day, bulk assign, discounts — is the
 * same code, because it's the same job.
 */

/** Age on the day the listing starts — the number that decides eligibility. */

/** Why a child can't be booked onto this listing, if they can't. */

/**
 * The parent's children. Saved profiles come back from /api/my/children and
 * apply in a tap; a new child is asked once for the things a provider needs on
 * the day, and never asked again.
 */


// ── Meals at checkout — read-only "what's on the menu these days" ───────────
// Shown on a meals-enabled listing: for the days the parent is picking (or all
// planned days before they choose), the menu that runs and its allergens. Info
// only — ordering/paying is a separate step in the customer Meals area.
function MealsAtCheckout({ d, dates, tone = "light" }: { d: WizardDraft; dates: string[]; tone?: "light" | "dark" }) {
  const tr = useT();
  const { locale } = useI18n();
  const [open, setOpen] = useState(false);
  const menus = d.mealMenus ?? [];
  const plan = d.mealPlan ?? {};
  const byId = useMemo(() => new Map(menus.map((m) => [m.id, m])), [menus]);
  // The dishes served on a given day (a menu subset), resolved from the plan.
  const dayMenu = (iso: string) => {
    const p = mealDayPlan(plan[iso]);
    const menu = p ? byId.get(p.menuId) : undefined;
    return p && menu ? { name: menu.name, items: dishesForDay(p, menu.items) } : undefined;
  };
  if (!d.mealsEnabled || menus.length === 0 || Object.keys(plan).length === 0) return null;
  const has = (iso: string) => !!dayMenu(iso);
  const chosen = dates.filter(has);
  const showDays = (chosen.length ? chosen : Object.keys(plan).filter(has)).sort();
  if (showDays.length === 0) return null;
  const allergens = [...new Set(showDays.flatMap((iso) => dayMenu(iso)!.items.flatMap((it) => it.allergens ?? [])))];
  const dark = tone === "dark";
  const cardBg = dark ? "rgba(255,255,255,.05)" : "#f4f8ff";
  const line = dark ? "rgba(255,255,255,.14)" : "#d6e3fb";
  const ink = dark ? "#eaf1ff" : "#1d3a8f";
  const sub = dark ? "#a9b7d4" : "#5b6478";
  return (
    <div className="mt-3 overflow-hidden rounded-2xl border" style={{ borderColor: line, background: cardBg }}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-3.5 py-2.5 text-start">
        <span className="text-[16px]">🍽️</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-extrabold" style={{ color: ink }}>{chosen.length ? tr("p7bw.mealsOnDays") : tr("p7bw.mealsAvail")}</span>
          <span className="block text-[11px]" style={{ color: sub }}>{chosen.length ? pickPlural(tr, locale, "p7bw.daysMenu", chosen.length) : pickPlural(tr, locale, "p7bw.menuSetFor", showDays.length)} · {tr("p7bw.addMealsCheckout")}</span>
        </span>
        {allergens.length > 0 && <span className="hidden rounded-full px-1.5 py-[1px] text-[10px] font-bold capitalize sm:inline" style={{ background: dark ? "rgba(226,29,41,.18)" : "#fdebec", color: "#e21d27" }}>{pickPlural(tr, locale, "p7bw.allergenN", allergens.length)}</span>}
        <span className="text-[12px]" style={{ color: sub }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="border-t px-3.5 py-2.5" style={{ borderColor: line }}>
          <div className="flex flex-col gap-2">
            {showDays.map((iso) => {
              const menu = dayMenu(iso)!;
              return (
                <div key={iso}>
                  <div className="text-[11.5px] font-extrabold" style={{ color: ink }}>{fmtDate(iso)} · {menu.name}</div>
                  <div className="mt-0.5 flex flex-col gap-0.5">
                    {menu.items.map((it) => (
                      <div key={it.id} className="flex flex-wrap items-baseline gap-1.5 text-[11.5px]" style={{ color: sub }}>
                        <span className="font-semibold" style={{ color: dark ? "#dbe6ff" : "#374151" }}>{it.name}</span>
                        <span className="tabular-nums">{money(it.price)}</span>
                        {(it.allergens?.length ?? 0) > 0 && <span className="capitalize text-[#e21d27]">⚠ {it.allergens!.join(", ")}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[10.5px]" style={{ color: sub }}>{tr("p7bw.allergenNote")}</p>
        </div>
      )}
    </div>
  );
}

// ── Booking · PLAYFUL (bright, rounded, blue) ──────────────────────────────
function PlayfulBooking({ b, d, booking, weeks, spacesLeft, addons, mode, onBook, bookState, tenantId }: BookView) {
  const tr = useT();
  const { locale } = useI18n();
  const BLUE = "#2f6bd8", DEEP = "#1d3a8f", TEAL = "#06d6a0", INKp = "#232842", MUTp = "#7a8194", LINEp = "#e8edf7", SOFTb = "#eef4ff";
  const idle = { background: "#fff", color: INKp, borderColor: LINEp };
  // Numbered so the order to work through is obvious. Timing is skipped when
  // the block has none, so dates become step 2.
  const step = (n: number, text: string) => (
    <div className="mb-2 mt-4 flex items-center gap-2">
      <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10px] font-extrabold text-white" style={{ background: BLUE }}>{n}</span>
      <span className="text-[10.5px] font-extrabold uppercase tracking-[0.1em]" style={{ color: MUTp }}>{text}</span>
    </div>
  );
  if (b.stage === "done") return (
    <div className="rounded-[26px] bg-white p-6 text-center" style={{ boxShadow: "0 24px 50px -26px rgba(47,107,216,.5)" }}>
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-[26px]" style={{ background: TEAL, color: "#053b2a" }}>✓</div>
      <div className="mt-3 text-[19px] font-extrabold tracking-[-0.02em]" style={{ color: INKp }}>{b.child ? tr("p7bw.bookedFor", { child: b.child }) : tr("p7bw.bookedNoChild")}</div>
      <div className="mt-1.5 text-[13px] text-[#7a8194]">{d.bookingType === "auto" ? tr("p7bw.instantlyConfirmed") : tr("p7bw.providerWillApprove")} {tr("p7bw.confEmailOnWay")}</div>
      <button className="mt-4 rounded-full px-6 py-2.5 text-[13.5px] font-extrabold text-white" style={{ background: BLUE }} onClick={b.reset}>{tr("p7bw.bookAgain")}</button>
    </div>
  );
  if (b.stage === "checkout") return (
    <div className="overflow-hidden rounded-[26px] bg-white" style={{ boxShadow: "0 24px 50px -26px rgba(47,107,216,.5)" }}>
      <div className="px-5 pt-5 text-[20px] font-extrabold tracking-[-0.02em]" style={{ color: INKp }}>{tr("p7bw.checkoutHead")}</div>
      <CheckoutPanel b={b} d={d} addons={addons} mode={mode} onBook={onBook} booking={bookState} tenantId={tenantId} tk={{ bg: "#fff", line: LINEp, ink: INKp, muted: MUTp, accent: BLUE, accentInk: "#fff", round: "rounded-2xl", inputBg: "#fff", bar: `linear-gradient(120deg,${DEEP},${BLUE})`, barInk: "#fff" }} />
    </div>
  );
  return (
    <div className="rounded-[26px] bg-white p-5" style={{ boxShadow: "0 24px 50px -26px rgba(47,107,216,.5)" }}>
      <div className="flex items-baseline justify-between">
        <span className="text-[20px] font-extrabold tracking-[-0.02em]" style={{ color: INKp }}>{tr("p7bw.chooseDatesTimes")}</span>
        {b.pass && <span className="text-[13px] text-[#7a8194]">{tr("p7bw.fromWord")} <b style={{ color: DEEP }}>{money(b.unitPrice)}</b></span>}
      </div>
      <div className="mt-2 text-[12.5px] font-bold" style={{ color: DEEP }}>👆 {tr("p9tx.bkTapHint")}</div>
      {b.hint && (
        <div className="mt-2.5 flex items-start gap-2 rounded-2xl px-3 py-2 text-[12px] font-bold" style={{ background: SOFTb, color: DEEP }}>
          <span aria-hidden>👉</span><span>{b.hint}</span>
        </div>
      )}
      {/* How close they are to the next discount. */}
      {b.nudge && (
        <div className="mt-1.5 flex items-start gap-2 rounded-2xl px-3 py-2 text-[12px] font-extrabold" style={{ background: "#e4f8ee", color: "#047857" }}>
          <span aria-hidden>⚡</span><span>{b.nudge}</span>
        </div>
      )}
      {b.passes.length === 0 ? <div className="mt-2 text-[13px] text-[#7a8194]">{tr("p7bw.pickBlock")}</div> : (
        <>
          {step(1, tr("p7bw.stepPass"))}
          <div className="flex flex-wrap gap-2">
            {b.passes.map((t) => { const closed = b.passClosed(t.id); const fits = b.passFits(t); const off = closed || !fits; return <button key={t.id} type="button" disabled={off} onClick={() => { if (!off) b.pickPass(t.id); }} title={closed ? tr("p7bw.passClosedTip") : !fits ? tr("p7bw.notEnoughTip", { n: t.days }) : undefined} className="rounded-full border-2 px-4 py-2 text-[12.5px] font-bold disabled:cursor-not-allowed" style={off ? { ...idle, opacity: 0.5, textDecoration: "line-through" } : t.id === b.passId ? { background: BLUE, color: "#fff", borderColor: BLUE } : idle}>{t.name} · {money(booking ? booking.priceFor(t.id, b.periodId) : t.basePrice)}{closed ? <span className="ms-1.5 no-underline">{tr("p7bw.closedTag")}</span> : !fits ? <span className="ms-1.5 no-underline">{tr("p7bw.notEnoughTag")}</span> : null}</button>; })}
          </div>
          {b.periods.length > 0 && <>
            {step(2, tr("p7bw.stepTiming"))}
            <div className="flex flex-wrap gap-2">
              {b.periods.map((p) => <button key={p.id} type="button" onClick={() => b.setPeriodId(p.id)} className="rounded-2xl border-2 px-3.5 py-2 text-start text-[12px] font-bold leading-tight" style={p.id === b.periodId ? { background: BLUE, color: "#fff", borderColor: BLUE } : idle}>{p.range}{b.pass ? <span className={p.id === b.periodId ? "block text-[10px] font-semibold opacity-90" : "block text-[10px] font-semibold text-[#7a8194]"}>{p.title} · {money(booking!.priceFor(b.pass.id, p.id))}</span> : null}</button>)}
            </div>
          </>}
          {b.pass && step(b.periods.length ? 3 : 2, b.isSingle ? tr("p7bw.stepAnyDates") : tr("p7bw.stepDates"))}
          {b.pass && cutoffNote(d, "#7a8194", tr, locale)}
          {weeks.length ? <div className="flex flex-col gap-3">
            {weeks.slice(0, 8).map((w) => <div key={w.mon}>
              <div className="mb-1.5 text-[11px] font-bold" style={{ color: BLUE }}>{tr("p7bw.weekN", { n: w.n })} <span className="font-semibold text-[#a6adba]">{tr("p7bw.fromDate", { date: fmtDate(w.mon) })}</span></div>
              <div className="flex flex-wrap gap-1.5">{w.days.map((iso) => {
                const dOff = b.off(iso); const dClosed = !b.past(iso) && b.closed(iso); const dPast = b.past(iso) || dClosed; const on = b.sel.includes(iso); const dt = new Date(`${iso}T00:00:00Z`);
                // Availability speaks only when it's bad news — a number on
                // every cell turns the calendar into a spreadsheet.
                const left = b.leftOn(iso); const held = b.heldByBasket(iso); const full = !dOff && !dPast && left !== null && left < 1 && !held; const low = !full && left !== null && (held || b.isLow(iso, left));
                const dot = dOff || dPast || left === null ? null : full ? "#dc2626" : low ? "#f59e0b" : "#3f78d8";
                const waiting = b.waitSel.includes(iso);
                const queueable = full && b.waitlistOn && !dOff;
                return <button key={iso} type="button" disabled={dPast || dOff || (full && !queueable)}
                  onClick={() => (queueable ? b.toggleWait(iso) : b.pickDay(iso, w.mon))}
                  title={dClosed ? tr("p9tx.wzClosed") : dPast ? tr("p7bw.dayPassed") : full ? (queueable ? (waiting ? tr("p7bw.onWaitTap") : tr("p7bw.fullTapJoin")) : tr("p7bw.fullWord")) : left === null ? undefined : d.showSpaces ? (low ? tr("p7bw.onlyLeft", { n: left }) : tr("p7bw.placesLeftN", { n: left })) : (low ? tr("p7bw.almostFull") : tr("p7bw.spaceAvail"))}
                  className="relative flex w-[44px] flex-col items-center rounded-xl border-2 py-1.5 disabled:cursor-not-allowed"
                  style={waiting ? { borderColor: "#c2410c", color: "#c2410c", background: "#fff7ed" }
                    : dPast ? { borderColor: LINEp, color: "#cdd2db", background: "#f3f4f7", opacity: 0.6 }
                    : dOff || full ? { borderColor: LINEp, color: "#c8ccd4", background: "#fafbfd" }
                    : on ? { borderColor: BLUE, color: "#fff", background: BLUE } : { borderColor: LINEp, color: INKp, background: "#fff" }}>
                  <span className="text-[9px] font-bold uppercase">{dt.toLocaleDateString(dl(), { weekday: "short", timeZone: "UTC" })}</span>
                  <span className="text-[14px] font-extrabold leading-none" style={full || dPast ? { textDecoration: "line-through" } : undefined}>{dt.getUTCDate()}</span>
                  {dClosed && <span className="mt-0.5 text-[7px] font-bold uppercase leading-none">closed</span>}
                  {dot && <span className="absolute -bottom-[3px] h-1.5 w-1.5 rounded-full" style={{ background: dot }} />}
                </button>; })}</div>
            </div>)}
          </div> : <div className="rounded-2xl border-2 border-dashed p-3.5 text-center text-[12px] text-[#a6adba]" style={{ borderColor: LINEp }}>{tr("p7bw.setDatesWhen")}</div>}
          {b.hasCounts && (
            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] font-semibold" style={{ color: MUTp }}>
              {([["#3f78d8", tr("p7bw.legendSpace")], ["#f59e0b", tr("p7bw.almostFull")], ["#dc2626", tr("p7bw.fullWord")]] as const).map(([c, l]) => (
                <span key={l} className="inline-flex items-center gap-1.5"><span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: c }} />{l}</span>
              ))}
            </div>
          )}
          {(() => {
            const note = capacityNote(d, b.seatsLeft ?? spacesLeft, tr, locale);
            if (!note) return null;
            // Same traffic light as the calendar — a different green here made
            // the key look like it belonged to something else.
            const col = note.tone === "gone" ? "#dc2626" : note.tone === "low" ? "#f59e0b" : "#3f78d8";
            return <div className="mt-3 flex items-center gap-1.5 text-[12px] font-bold" style={{ color: col }}>
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: col }} />{note.text}</div>;
          })()}
          <MealsAtCheckout d={d} dates={b.sel} tone="light" />
          <WaitlistPanel b={b} d={d} tone="light" />
          {/* Once something's in the basket the button has nothing to do until
              more dates are picked, so it goes and says why instead. */}
          {b.dupNote && (
            <div className="mt-3 rounded-2xl px-4 py-3 text-[12.5px] font-semibold leading-[1.5]" style={{ background: "#fff3cd", color: "#7a4b00" }} role="alert">⚠ {b.dupNote}</div>
          )}
          {b.basket.length > 0 && b.sel.length === 0 && !b.canAdd ? (
            <div className="mt-4 flex items-start gap-2.5 rounded-2xl px-4 py-3" style={{ background: "#e4f8ee" }}>
              <span className="aos-point-inline text-[22px] leading-none" aria-hidden>👆</span>
              <p className="text-[12.5px] leading-[1.5]" style={{ color: "#0f5132" }}>
                <Rich text={tr("p7bw.inBasket")} />
              </p>
            </div>
          ) : (
          <div className="relative mt-11">
          <button className={`w-full rounded-2xl py-3.5 text-[14px] font-extrabold text-white disabled:opacity-40 ${b.canAdd ? "aos-ready" : ""}`} style={{ background: BLUE, ["--aos-ready-ring" as string]: "rgba(47,107,216,.5)" } as React.CSSProperties} disabled={!b.canAdd} onClick={b.addToBasket}>
            {b.locked ? tr("p7bw.notOpenYet") : b.soldOut ? (d.waitlist ? tr("p7bw.soldOutJoin") : tr("p7bw.soldOut")) : !b.hasSpace ? (b.fullDates.length === 1 ? tr("p7bw.dateIsFull", { date: fmtDate(b.fullDates[0]) }) : pickPlural(tr, locale, "p7bw.nDaysFull", b.fullDates.length)) : b.canAdd ? (
              <span className="inline-flex flex-wrap items-baseline justify-center gap-x-2">
                <span>{b.isSingle ? tr("p7bw.addSingleBasket", { n: b.sel.length, name: b.pass?.name ?? "" }) : tr("p7bw.addPassBasket", { name: b.pass?.name ?? "" })}</span>
                <span className="inline-flex items-baseline gap-1.5">
                  {b.addNet < b.pendingGross && <s className="opacity-60">{money(b.pendingGross)}</s>}
                  <span>{money(b.addNet)}</span>
                </span>
              </span>
            ) : b.isSingle ? tr("p7bw.pickAtLeastOne") : b.pass ? pickPlural(tr, locale, "p7bw.selectMoreDays", Math.max(0, b.need - b.sel.length)) : tr("p7bw.pickAPass")}
          </button>
          {b.canAdd && <span className="aos-point" aria-hidden>👇</span>}
          </div>
          )}
          {b.addPreview && (
            <div className="mt-2 rounded-2xl p-3" style={{ background: "#e4f8ee" }}>
              <div className="text-[10px] font-extrabold uppercase tracking-[0.1em]" style={{ color: "#047857" }}>
                ⚡ {b.addPreview.lines.length === 1 ? tr("p7bw.discApplied") : tr("p7bw.discsApplied", { n: b.addPreview.lines.length })}
              </div>
              <div className="mt-1.5 flex flex-col gap-1">
                {b.addPreview.lines.map((l, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 text-[11.5px]">
                    <span className="min-w-0">
                      <span className="block" style={{ color: "#0f766e" }}>{l.name}</span>
                      <span className="block text-[10px] opacity-70" style={{ color: "#0f766e" }}>{l.scope}</span>
                    </span>
                    <b className="flex-none" style={{ color: "#047857" }}>−{money(l.amount)}</b>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex items-baseline justify-between border-t pt-2" style={{ borderColor: "#bfe8d4" }}>
                <span className="text-[11.5px] font-bold" style={{ color: "#0f766e" }}>{tr("p7bw.youllPay")}</span>
                <span className="flex items-baseline gap-2">
                  <s className="text-[11px]" style={{ color: "#7aa894" }}>{money(b.addPreview.gross)}</s>
                  <b className="text-[16px] font-extrabold" style={{ color: "#047857" }}>{money(b.addPreview.total)}</b>
                </span>
              </div>
            </div>
          )}
        </>
      )}
      <div className="mt-5 border-t-2 border-dashed pt-4" style={{ borderColor: LINEp }}>
        <div className="mb-2 flex items-center justify-between"><span className="text-[13.5px] font-extrabold" style={{ color: INKp }}>{tr("p7bw.yourBasket")}</span>{b.basket.length > 1 && (<button type="button" onClick={() => { if (window.confirm(tr("p9tx.wzEmptyConfirm"))) b.clearBasket(); }} className="ms-2 text-[11.5px] font-bold underline opacity-80">{tr("p9tx.wzClearBasket")}</button>)}<span className="rounded-full px-2 py-[2px] text-[10px] font-extrabold" style={{ background: SOFTb, color: BLUE }}>{b.basket.length}</span></div>
        {b.basket.length === 0 ? <div className="text-[12.5px] text-[#a6adba]">{tr("p7bw.nothingAdded")}</div> :
          <div className="flex flex-col gap-1.5">{b.basket.map((x) => <div key={x.id} className="flex items-start justify-between gap-2 rounded-xl px-2.5 py-2 text-[12px]" style={{ background: "#f4f7ff" }}><span className="min-w-0"><b className="block" style={{ color: INKp }}>{x.name}</b><span className="block text-[11px] leading-snug" style={{ color: "#5b6478" }}>{b.datesPretty(x.dates)}</span>{x.timing ? <span className="block text-[11px] font-bold" style={{ color: BLUE }}>🕘 {x.timing}</span> : null}</span><span className="flex items-baseline gap-2"><b style={{ color: INKp }}>{money(x.price)}</b><button type="button" onClick={() => b.removeItem(x.id)} className="text-[#c8ccd4] hover:text-[#e21d27]">✕</button></span></div>)}</div>}
        {b.basket.length > 0 && b.discountLines.length > 0 && (
          <div className="mt-2 rounded-xl p-2" style={{ background: "#e4f8ee" }}>
            {b.discountLines.map((l, i) => (
              <div key={i} className="flex items-baseline justify-between text-[11.5px]" style={{ color: "#047857" }}>
                <span className="pe-2">🎉 {l.name}</span><b>−{money(l.amount)}</b>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 flex items-center justify-between text-[14px]">
          <span className="text-[#7a8194]">{tr("p7bw.totalLbl")}</span>
          <span className="flex items-baseline gap-2">
            {b.saved > 0 && <s className="text-[12px] text-[#a6adba]">{money(b.subtotal)}</s>}
            <b style={{ color: DEEP }}>{money(b.total)}</b>
          </span>
        </div>
        <button className="mt-3 w-full rounded-2xl py-3.5 text-[14px] font-extrabold text-white disabled:opacity-40" style={{ background: DEEP }} disabled={b.basket.length === 0} onClick={() => b.setStage("checkout")}>{mode === "parent" ? tr("p7bw.nextAddChildren") : tr("p7bw.checkoutN", { n: b.basket.length })}</button>
      </div>
    </div>
  );
}

// ── Booking · SPORT (dark, electric, lime) ─────────────────────────────────
function SportBooking({ b, d, booking, weeks, spacesLeft, addons, mode, onBook, bookState, surf, tenantId }: BookView & { surf: Surf }) {
  const tr = useT();
  const { locale } = useI18n();
  const EL = surf.el;
  const LIME = surf.accent;      // headline accent (price, chips) — dark ink sits on it
  const INK = surf.accentInk;    // dark ink that reads on the accent
  const MUTs = surf.muted;
  const BAR = surf.bar;          // section-banner gradient
  const LINEs = surf.line, PANEL = surf.panel, CELL = surf.cell, CELLOFF = surf.cellOff;
  useThemeFont(surf.key);
  const V = surf.v2, k = V?.t;
  const light = !!V && !V.dark;
  const INKT = k?.ink ?? "#fff", BODYC = k?.ink ?? "#c3ccdb", FAINT = k?.mute ?? "#8f9bb0";
  const ACCT = k?.sec ?? LIME;                       // accent used as TEXT (labels)
  const WARN = light ? "#8a4b00" : "#ffb020", BAD = light ? "#b3261e" : "#ff5470", GOOD = light ? "#0a7a4a" : "#3ddc84";
  const TRACK = k?.line ?? "#26304a";
  const idle = { background: CELL, color: k?.ink ?? "#dfe6f2", borderColor: LINEs };
  // Numbered so the order to work through is obvious. Timing is skipped when
  // the block has none, so dates become step 2.
  const step = (n: number, text: string) => (
    <div className="mb-1.5 mt-3 flex items-center gap-2">
      <span className="flex h-[16px] w-[16px] items-center justify-center text-[9px] font-black" style={{ background: LIME, color: INK }}>{n}</span>
      <span className="text-[9.5px] font-black uppercase tracking-[0.14em]" style={{ color: MUTs }}>{text}</span>
    </div>
  );
  const on = k ? { background: `${k.sel}1f`, color: k.selInk, borderColor: k.sel } : { background: "rgba(198,255,0,.1)", color: LIME, borderColor: LIME };
  const skew: React.CSSProperties = V ? {} : { transform: "skewX(-6deg)" }, unskew: React.CSSProperties = V ? {} : { display: "inline-block", transform: "skewX(6deg)" };
  const wrap = V ? `border aos-th2${V.key === "poster" ? " aos-poster" : ""}` : "border";
  const wrapStyle: React.CSSProperties = V ? { borderColor: LINEs, background: PANEL, color: INKT, borderRadius: k!.r, overflow: "hidden", ...spVars(V) } : { borderColor: LINEs, background: PANEL };
  const ctaBg = k?.cta ?? LIME, ctaInk = k?.ctaInk ?? INK, ctaSh = k?.ctaSh;
  const BARINK = k?.phInk ?? "#fff";
  if (b.stage === "done") return (
    <div className={wrap} style={wrapStyle}>
      <div className="p-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center text-[26px] font-black" style={{ background: LIME, color: INK }}>✓</div>
        <div className="mt-3 text-[18px] font-black italic uppercase tracking-[-0.01em] text-[color:var(--sp-ink,#fff)]">Booked{b.child ? ` · ${b.child}` : ""}</div>
        <div className="mt-2 text-[12.5px] text-[color:var(--sp-faint,#8f9bb0)]">{d.bookingType === "auto" ? tr("p7bw.instantlyConfirmed") : tr("p7bw.providerApproves")} {tr("p7bw.confEmailOnWay")}</div>
        <button className="mt-4 px-6 py-2.5 text-[13px] font-black italic uppercase" style={{ ...skew, background: ctaBg, color: ctaInk, borderRadius: k?.rb }} onClick={b.reset}><span style={unskew}>{tr("p7bw.bookAgain")}</span></button>
      </div>
    </div>
  );
  if (b.stage === "checkout") return (
    <div className={wrap} style={wrapStyle}>
      <div className="aos-bh px-5 py-3.5 text-[18px] font-black italic uppercase" style={{ background: BAR, color: BARINK }}>{tr("p7bw.checkoutHead")}</div>
      <CheckoutPanel b={b} d={d} addons={addons} mode={mode} onBook={onBook} booking={bookState} tenantId={tenantId} tk={{ bg: PANEL, line: LINEs, ink: k?.ink ?? "#ffffff", muted: MUTs, accent: k?.cta ?? LIME, accentInk: k?.ctaInk ?? INK, round: "", inputBg: CELL, bar: BAR, barInk: BARINK }} />
    </div>
  );
  return (
    <div className={wrap} style={wrapStyle}>
      <div className={`aos-bh px-4 py-2.5${V ? " th-" + V.key : ""}`} style={{ background: BAR, color: BARINK }}>
        <div className="flex items-baseline justify-between">
          <span className="text-[15px] font-black italic uppercase">{tr("p7bw.chooseDatesTimes")}</span>
          {b.pass && <span className="text-[11px]" style={{ color: k ? BARINK : "#cfe8ff" }}>{tr("p7bw.fromWord")} <b className="italic" style={{ color: k ? BARINK : "#fff" }}>{money(b.unitPrice)}</b></span>}
        </div>
        <div className="mt-1.5 text-[11.5px] font-bold" style={{ color: k ? BARINK : "rgba(255,255,255,.9)" }}>👆 {tr("p9tx.bkTapHint")}</div>
        {b.hint && (
          <div className="mt-1.5 flex items-start gap-1.5 rounded bg-white/15 px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm" style={{ color: k ? BARINK : "#fff" }}>
            <span aria-hidden>👉</span><span>{b.hint}</span>
          </div>
        )}
        {/* How close they are to the next discount. */}
        {b.nudge && (
          <div className="mt-1 flex items-start gap-1.5 rounded px-2.5 py-1 text-[11px] font-black" style={{ background: LIME, color: INK }}>
            <span aria-hidden>⚡</span><span>{b.nudge}</span>
          </div>
        )}
      </div>
      <div className="p-4">
        {/* Single column: pass picker/dates, then the basket below. A 2-col grid
            here overlaps when the widget sits in a narrow sidebar. */}
        <div className="flex flex-col gap-4">
        <div className="min-w-0">
        {b.passes.length === 0 ? <div className="text-[13px] text-[color:var(--sp-faint,#8f9bb0)]">{tr("p7bw.pickBlock")}</div> : (
          <>
            {step(1, tr("p7bw.stepPass"))}
            <div className="flex flex-wrap gap-2">{b.passes.map((t) => { const closed = b.passClosed(t.id); const fits = b.passFits(t); const off = closed || !fits; return <button key={t.id} type="button" disabled={off} onClick={() => { if (!off) b.pickPass(t.id); }} title={closed ? tr("p7bw.passClosedTip") : !fits ? tr("p7bw.notEnoughTip", { n: t.days }) : undefined} className="border px-3 py-1.5 text-[12px] font-bold disabled:cursor-not-allowed" style={off ? { ...idle, opacity: 0.5, textDecoration: "line-through" } : t.id === b.passId ? on : idle}>{t.name} · {money(booking ? booking.priceFor(t.id, b.periodId) : t.basePrice)}{closed ? <span className="ms-1.5 no-underline">{tr("p7bw.closedTag")}</span> : !fits ? <span className="ms-1.5 no-underline">{tr("p7bw.notEnoughTag")}</span> : null}</button>; })}</div>
            {b.periods.length > 0 && <>
              {step(2, tr("p7bw.stepTiming"))}
              <div className="flex flex-wrap gap-2">{b.periods.map((p) => <button key={p.id} type="button" onClick={() => b.setPeriodId(p.id)} className="border px-3 py-1.5 text-start text-[11.5px] font-bold leading-tight" style={p.id === b.periodId ? on : idle}>{p.range}{b.pass ? <span className="block text-[10px] font-semibold opacity-80">{p.title} · {money(booking!.priceFor(b.pass.id, p.id))}</span> : null}</button>)}</div>
            </>}
            {b.pass && step(b.periods.length ? 3 : 2, b.isSingle ? tr("p7bw.stepAnyDates") : tr("p7bw.stepDates"))}
            {b.pass && cutoffNote(d, FAINT, tr, locale)}
            {weeks.length ? <div className="flex flex-col gap-3">{weeks.slice(0, 8).map((w) => <div key={w.mon}>
              <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[color:var(--sp-faint,#8f9bb0)]">{tr("p9tx.wzWeekFrom", { n: String(w.n), date: String(fmtDate(w.mon)) })}</div>
              <div className="flex flex-wrap gap-1.5">{w.days.map((iso) => {
                const dOff = b.off(iso); const dClosed = !b.past(iso) && b.closed(iso); const dPast = b.past(iso) || dClosed; const sel = b.sel.includes(iso); const dt = new Date(`${iso}T00:00:00Z`);
                const left = b.leftOn(iso); const held = b.heldByBasket(iso); const full = !dOff && !dPast && left !== null && left < 1 && !held; const low = !full && left !== null && (held || b.isLow(iso, left));
                const dot = dOff || dPast || left === null ? null : full ? "#ff5470" : low ? "#ffb020" : "#3ddc84";
                const waiting = b.waitSel.includes(iso);
                const queueable = full && b.waitlistOn && !dOff;
                return <button key={iso} type="button" disabled={dPast || dOff || (full && !queueable)}
                  onClick={() => (queueable ? b.toggleWait(iso) : b.pickDay(iso, w.mon))}
                  title={dClosed ? tr("p9tx.wzClosed") : dPast ? tr("p7bw.dayPassed") : full ? (queueable ? (waiting ? tr("p7bw.onWaitTap") : tr("p7bw.fullTapJoin")) : tr("p7bw.fullWord")) : left === null ? undefined : d.showSpaces ? (low ? tr("p7bw.onlyLeft", { n: left }) : tr("p7bw.placesLeftN", { n: left })) : (low ? tr("p7bw.almostFull") : tr("p7bw.spaceAvail"))}
                  className="relative flex w-[40px] flex-col items-center border py-1 disabled:cursor-not-allowed"
                  style={waiting ? { borderColor: WARN, color: WARN, background: light ? k!.surf2 : "#2a2110" }
                    : dPast ? { borderColor: LINEs, color: k ? MUTs : "#454d5e", background: CELLOFF, opacity: 0.5 }
                    : dOff || full ? { borderColor: LINEs, color: k ? MUTs : "#5a6478", background: CELLOFF, opacity: k ? 0.7 : undefined }
                    : sel ? { borderColor: k?.chip ?? LIME, color: k?.chipInk ?? INK, background: k?.chip ?? LIME } : { borderColor: LINEs, color: INKT, background: CELL }}>
                  <span className="text-[9px] font-bold uppercase">{dt.toLocaleDateString(dl(), { weekday: "short", timeZone: "UTC" })}</span>
                  <span className="text-[13px] font-black leading-none" style={full || dPast ? { textDecoration: "line-through" } : undefined}>{dt.getUTCDate()}</span>
                  {dClosed && <span className="mt-0.5 text-[7px] font-bold uppercase leading-none">closed</span>}
                  {dot && <span className="absolute -bottom-[3px] h-1.5 w-1.5" style={{ background: dot }} />}
                </button>; })}</div>
            </div>)}</div> : <div className="border border-dashed p-3.5 text-center text-[12px] text-[color:var(--sp-faint,#6a7488)]" style={{ borderColor: LINEs }}>{tr("p7bw.setDatesWhen")}</div>}
            {b.hasCounts && (
              <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] font-bold" style={{ color: MUTs }}>
                {([["#3ddc84", tr("p7bw.legendSpace")], ["#ffb020", tr("p7bw.almostFull")], ["#ff5470", tr("p7bw.fullWord")]] as const).map(([c, l]) => (
                  <span key={l} className="inline-flex items-center gap-1.5"><span className="inline-block h-1.5 w-1.5" style={{ background: c }} />{l}</span>
                ))}
              </div>
            )}
            {(() => {
              const note = capacityNote(d, b.seatsLeft ?? spacesLeft, tr, locale);
              if (!note) return null;
              const col = note.tone === "gone" ? BAD : note.tone === "low" ? WARN : GOOD;
              return <div className="mt-3 flex items-center gap-1.5 text-[12px] font-bold" style={{ color: col }}>
                <span className="inline-block h-2 w-2" style={{ background: col }} />{note.text}</div>;
            })()}
            <MealsAtCheckout d={d} dates={b.sel} tone={light ? "light" : "dark"} />
            <WaitlistPanel b={b} d={d} tone={light ? "light" : "dark"} />
            {b.dupNote && (
              <div className="mt-3 border px-3 py-2.5 text-[12.5px] font-semibold leading-[1.5]" style={{ borderColor: WARN, background: light ? k!.surf2 : "#2a2008", color: light ? WARN : "#ffd98a" }} role="alert">⚠ {b.dupNote}</div>
            )}
            {b.basket.length > 0 && b.sel.length === 0 && !b.canAdd ? (
              <div className="mt-4 flex items-start gap-2.5 border p-3" style={{ borderColor: LIME, background: CELL }}>
                <span className="aos-point-inline text-[22px] leading-none" aria-hidden>👆</span>
                <p className="text-[12.5px] leading-[1.5]" style={{ color: BODYC }}>
                  <Rich text={tr("p7bw.inBasket")} />
                </p>
              </div>
            ) : (
            <div className="relative mt-6">
            <button className={`w-full py-3 text-[12.5px] font-black italic uppercase disabled:opacity-40 ${b.canAdd ? "aos-ready" : ""}`} style={{ ...skew, background: ctaBg, color: ctaInk, borderRadius: k?.rb, boxShadow: ctaSh, ["--aos-ready-ring" as string]: surf.ring } as React.CSSProperties} disabled={!b.canAdd} onClick={b.addToBasket}><span style={unskew}>
                {b.locked ? tr("p7bw.notOpenYet") : b.soldOut ? (d.waitlist ? tr("p7bw.soldOutJoin") : tr("p7bw.soldOut")) : !b.hasSpace ? (b.fullDates.length === 1 ? tr("p7bw.dateIsFull", { date: fmtDate(b.fullDates[0]) }) : pickPlural(tr, locale, "p7bw.nDaysFull", b.fullDates.length)) : b.canAdd ? (
                  <span className="inline-flex flex-wrap items-baseline justify-center gap-x-2">
                    <span>{b.isSingle ? tr("p7bw.addSingleBasket", { n: b.sel.length, name: b.pass?.name ?? "" }) : tr("p7bw.addPassBasket", { name: b.pass?.name ?? "" })}</span>
                    <span className="inline-flex items-baseline gap-1.5">
                      {b.addNet < b.pendingGross && <s className="opacity-60">{money(b.pendingGross)}</s>}
                      <span>{money(b.addNet)}</span>
                    </span>
                  </span>
                ) : b.isSingle ? tr("p7bw.pickAtLeastOne") : b.pass ? tr("p7bw.selectMoreN", { n: Math.max(0, b.need - b.sel.length) }) : tr("p7bw.pickAPass")}
              </span></button>
            {b.canAdd && <span className="aos-point" aria-hidden>👇</span>}
            </div>
            )}
            {b.addPreview && (
              <div className="mt-2 border-s-[3px] p-3" style={{ borderInlineStartColor: LIME, background: CELL }}>
                <div className="text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: ACCT }}>
                  ⚡ {b.addPreview.lines.length === 1 ? tr("p7bw.discApplied") : tr("p7bw.discsApplied", { n: b.addPreview.lines.length })}
                </div>
                <div className="mt-1.5 flex flex-col gap-1">
                  {b.addPreview.lines.map((l, i) => (
                    <div key={i} className="flex items-start justify-between gap-3 text-[11.5px]">
                      <span className="min-w-0">
                        <span className="block" style={{ color: BODYC }}>{l.name}</span>
                        <span className="block text-[10px]" style={{ color: MUTs }}>{l.scope}</span>
                      </span>
                      <b className="flex-none" style={{ color: ACCT }}>−{money(l.amount)}</b>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-baseline justify-between border-t pt-2" style={{ borderColor: LINEs }}>
                  <span className="text-[11.5px] font-bold" style={{ color: MUTs }}>{tr("p7bw.youllPay")}</span>
                  <span className="flex items-baseline gap-2">
                    <s className="text-[11px]" style={{ color: MUTs }}>{money(b.addPreview.gross)}</s>
                    <b className="text-[16px] font-black italic uppercase text-[color:var(--sp-ink,#fff)]">{money(b.addPreview.total)}</b>
                  </span>
                </div>
              </div>
            )}
          </>
        )}
        </div>
        <div className="mt-1 border-t pt-4" style={{ borderColor: LINEs }}>
          <div className="mb-2 flex items-center justify-between"><span className="text-[13px] font-black italic uppercase text-[color:var(--sp-ink,#fff)]">{tr("p7bw.yourBasket")}</span>{b.basket.length > 1 && (<button type="button" onClick={() => { if (window.confirm(tr("p9tx.wzEmptyConfirm"))) b.clearBasket(); }} className="ms-2 text-[11.5px] font-bold underline opacity-80">{tr("p9tx.wzClearBasket")}</button>)}<span className="px-2 py-[2px] text-[10px] font-black" style={{ background: CELL, color: LIME }}>{b.basket.length}</span></div>
          {b.basket.length === 0 ? <div className="text-[12.5px] text-[color:var(--sp-faint,#6a7488)]">{tr("p7bw.nothingAdded")}</div> :
            <div className="flex flex-col gap-1.5">{b.basket.map((x) => <div key={x.id} className="flex items-start justify-between gap-2 text-[12px] text-[color:var(--sp-body,#c3ccdb)]"><span className="min-w-0"><b className="block text-[color:var(--sp-ink,#fff)]">{x.name}</b><span className="block text-[11px] leading-snug" style={{ color: MUTs }}>{b.datesPretty(x.dates)}</span>{x.timing ? <span className="block text-[11px] font-bold" style={{ color: LIME }}>🕘 {x.timing}</span> : null}</span><span className="flex items-baseline gap-2"><b className="text-[color:var(--sp-ink,#fff)]">{money(x.price)}</b><button type="button" onClick={() => b.removeItem(x.id)} className="text-[color:var(--sp-faint,#5c6678)] hover:text-[color:var(--sp-bad,#ff5d5d)]">✕</button></span></div>)}</div>}
          {b.basket.length > 0 && b.discountLines.length > 0 && (
            <div className="mt-2 border p-2" style={{ borderColor: k?.sel ?? LIME, background: k ? `${k.sel}14` : "rgba(198,255,0,.08)" }}>
              {b.discountLines.map((l, i) => (
                <div key={i} className="flex items-baseline justify-between text-[11.5px]" style={{ color: ACCT }}>
                  <span className="pe-2">{l.name}</span><b>−{money(l.amount)}</b>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 flex items-center justify-between text-[14px]">
            <span style={{ color: MUTs }}>{tr("p7bw.totalLbl")}</span>
            <span className="flex items-baseline gap-2">
              {b.saved > 0 && <s className="text-[12px]" style={{ color: MUTs }}>{money(b.subtotal)}</s>}
              <b className="italic text-[color:var(--sp-ink,#fff)]">{money(b.total)}</b>
            </span>
          </div>
          <button className="mt-3 w-full py-3 text-[12.5px] font-black italic uppercase disabled:opacity-40" style={{ ...skew, background: ctaBg, color: ctaInk, borderRadius: k?.rb, boxShadow: ctaSh }} disabled={b.basket.length === 0} onClick={() => b.setStage("checkout")}><span style={unskew}>{mode === "parent" ? tr("p7bw.nextAddChildren") : tr("p7bw.checkoutN", { n: b.basket.length })}</span></button>
        </div>
        </div>
      </div>
    </div>
  );
}

function ParentPreview({ d, venue, local, booking, addons, blocks, mode, onBook, bookState, full, theme = "playful", onTheme, brand, logo, tenantId, topRight }: {
  topRight?: React.ReactNode;
  d: WizardDraft; venue: Venue | null; local: LocalState; blocks?: RunBlock[];
  mode?: "operator" | "parent"; onBook?: (p: { method: string; voucherScheme?: string; voucherRefs?: Record<string, string>; tfc?: { amount: number; remainderVia: string; references: Record<string, string> }; discountCodes?: string[]; walletCap?: number; phone?: string; basket: BasketItem[]; addonSel: Record<string, Record<string, string[]>>; addonAns: Record<string, Record<string, string>>; mealSel: Record<string, string>; children: ChildProfile[]; dayAssign: Record<string, Record<string, string[]>>; parent?: { id: string; name: string; email?: string; phone?: string; address?: string } | null; /** Home-visit listings only: where this session actually happens — defaults to the parent's saved address, editable at checkout. */ serviceAddress?: { address: string; postcode: string }; /** Operator checkout "Override the total" (server accepts it only for a booking made on a family's behalf). */ overrideTotal?: number; overrideReason?: string }) => void; bookState?: { busy: boolean; error: string | null };
  booking: BlockBooking | null; addons: LocalState["addons"]; full?: boolean;
  theme?: PageTheme; onTheme?: (t: PageTheme) => void;
  /** The provider's brand in the page header. Defaults to the signed-in
   * account (right for the operator's own preview, wrong for a parent). */
  brand?: string;
  /** The provider's logo beside the brand in the header (public storefront only). */
  logo?: string | null;
  /** The listing's tenant, so a signed-out parent can read that provider's
   *  public settings (vouchers, child questions). */
  tenantId?: string;
}) {
  const tr = useT();
  const { locale } = useI18n();
  const cats = local.categories.filter((c) => d.categoryIds.includes(c.id));
  const imgs = d.images;
  const town = venue?.address?.split(",").slice(-1)[0]?.trim() || venue?.address || "";
  const runLabel = d.runFrom && d.runTo ? `${fmtDate(d.runFrom)} – ${fmtDate(d.runTo)}` : tr("p7pg.datesTbc");
  const dates = periodDates(d, genDates);
  const weeks = groupWeeks(dates);
  // Blank capacity means "not set", not zero — `|| 0` was showing "Sold out"
  // on listings that had never had a limit typed in.
  const capParsed = parseInt(d.maxAttendees, 10);
  const spacesLeft = d.showSpaces && Number.isFinite(capParsed) ? capParsed : null;
  const staff = local.staff.filter((m) => d.staffIds.includes(m.id));
  const staffNames = staff.map((m) => `${m.first} ${m.last}`.trim()).filter(Boolean);
  const emo = (o: string, fb: string) => OPT_EMOJI[o] || local.emojis?.[o] || fb;

  const fromPrice = booking && booking.passes.length ? Math.min(...booking.passes.map((pp) => pp.basePrice)) : null;
  // "5 day pass from £150" reads far better than a bare "from £30". Full list —
  // the page shows the first few and a "+N more" toggle for the rest.
  const passSummary = (booking?.passes ?? []).map((pp) => ({ name: pp.name, price: pp.basePrice, days: pp.days, details: pp.details }));
  // Which category sits on the hero image when several are chosen.
  const heroCat = cats.find((c) => c.id === d.heroCategoryId) ?? cats[0] ?? null;
  const widget = <BookingWidget d={d} booking={booking} weeks={weeks} spacesLeft={spacesLeft} addons={addons} blocks={blocks} mode={mode} onBook={onBook} bookState={bookState} theme={theme} tenantId={tenantId} />;
  const opens = useOpensAt(d.opensAt);
  const p: PageProps = { d, venue, cats, heroCat, town, runLabel, staff, staffNames, addons, imgs, widget, full, emo, fromPrice, passSummary, spacesLeft, whereHead: whereHeading(local), opens, blocks, brand: brand ?? myBrand(), logo, topRight };

  // No theme picker here — the colour theme is chosen in the listing editor
  // (Basics step), so the preview shows exactly what the parent sees, nothing more.
  return (
    <div>
      {theme === "playful" ? <PlayfulPage {...p} /> : <SportPage {...p} surf={THEMES[theme]} />}
    </div>
  );
}

interface PageProps {
  d: WizardDraft; venue: Venue | null; cats: { id: string; name: string }[];
  heroCat: { id: string; name: string } | null;
  town: string; runLabel: string; staff: LocalState["staff"]; staffNames: string[];
  addons: LocalState["addons"]; imgs: ListingImage[];
  widget: React.ReactNode; full?: boolean; emo: (o: string, fb: string) => string;
  fromPrice: number | null; passSummary: { name: string; price: number; days?: number; details?: string }[]; spacesLeft: number | null;
  /** Set once in Locations, not per listing. */
  whereHead: { eyebrow: string; title: string };
  opens: { locked: boolean; countdown: string; opensLabel: string };
  blocks?: RunBlock[];
  brand: string;
  logo?: string | null;
  /** Optional links rendered in the storefront header (e.g. the signed-in
   *  parent's "My home page / My bookings" on the real booking page). */
  topRight?: React.ReactNode;
}
const HERO_FALLBACK = "linear-gradient(160deg,#7fd4d6,#2f7fae 55%,#1b4a6b)";
// A full theme for the bold "Sport"-style customer page. Every colour role is
// here so one design renders in ten completely different, professionally-paired
// palettes. Each dark ground has: a bright ACCENT (price/chips) with a dark
// accentInk that sits on it, an EL mid-bright for borders/buttons, a lighter
// SECONDARY for links/location, and a light MUTED for body text — all chosen for
// legible contrast on the ground. Playful is the one light theme (own renderer).
type Surf = {
  key: PageTheme; label: string; swatch: string; // picker chip
  bg: string; panel: string; line: string; cell: string; cellOff: string;
  accent: string; accentInk: string; el: string; secondary: string; muted: string;
  header?: string; bar: string; ring: string;
  /** Set for the round-three themes: every colour role as a token (see pageThemes.ts). Absent = the original ten. */
  v2?: ThemeTokens;
};
/** CSS variables a round-three themed page sets on its root so the shared bits (rows, sections, headings) follow the theme. */
function spVars(V: ThemeTokens): React.CSSProperties {
  const t = V.t;
  const v: Record<string, string | number> = {
    "--sp-ink": t.ink, "--sp-body": t.ink, "--sp-faint": t.mute, "--sp-bad": V.dark ? "#ff5d5d" : "#b3261e", "--sp-line": t.line, "--sp-acc": t.acc, "--sp-sec": t.sec, "--sp-panel": t.surf,
    "--sp-bandink": t.bandInk, "--sp-stripink": t.stripInk, "--sp-barink": t.phInk, "--sp-rs": `${t.rs}px`,
    "--t-display": FONT_STACK[V.font], "--t-dw": V.dw, "--t-dstyle": V.dstyle ?? "normal", "--t-dcase": V.dcase ?? "none", "--t-dtrack": V.dtrack ?? (V.dw >= 800 ? "-.02em" : "0"),
    "--t-btncase": t.btncase ?? "none", "--t-btnstyle": t.btnstyle ?? "normal", "--t-grain": t.grain,
  };
  return v as React.CSSProperties;
}
function themeFromTokens(V: ThemeTokens): Surf {
  const t = V.t;
  return {
    key: V.key, label: V.label, swatch: V.dot, bg: t.bg, panel: t.surf, line: t.line, cell: t.bg, cellOff: t.surf2,
    accent: t.acc, accentInk: t.accInk, el: t.chip, secondary: t.sec, muted: t.mute, header: t.band, bar: t.ph, ring: `${t.cta}66`, v2: V,
  };
}
const THEMES: Record<PageTheme, Surf> = {
  playful:    { key: "playful",    label: "Playful",     swatch: "#2f6bd8", bg: "#ffffff", panel: "#eef4fd", line: "#dbe7fb", cell: "#f4f9ff", cellOff: "#eaf1fc", accent: "#2f6bd8", accentInk: "#ffffff", el: "#2f6bd8", secondary: "#2f6bd8", muted: "#5a6b86", bar: "linear-gradient(120deg,#2f6bd8,#4f9dff)", ring: "rgba(47,107,216,.5)" },
  sport:      { key: "sport",      label: "Midnight",    swatch: "#c6ff00", bg: "#0b0d12", panel: "#12161f", line: "#1e2430", cell: "#0e131c", cellOff: "#0c0f16", accent: "#c6ff00", accentInk: "#12280a", el: "#0047ff", secondary: "#00c2ff", muted: "#adb8ca", bar: "linear-gradient(120deg,#0047ff,#0090ff)", ring: "rgba(198,255,0,.55)" },
  emerald:    { key: "emerald",    label: "Emerald",     swatch: "#10b981", bg: "#052a20", panel: "#0a3d2d", line: "#14563f", cell: "#0b3324", cellOff: "#08281d", accent: "#f5c451", accentInk: "#2a1e02", el: "#10b981", secondary: "#6ee7b7", muted: "#a6d8c7", header: "linear-gradient(120deg,#0a3d2d 0%,#12674a 100%)", bar: "linear-gradient(120deg,#0f9d6e,#34d399)", ring: "rgba(245,196,81,.5)" },
  teal:       { key: "teal",       label: "Deep teal",   swatch: "#0e7490", bg: "#04262e", panel: "#073c47", line: "#0f5966", cell: "#063139", cellOff: "#04262d", accent: "#ff9d5c", accentInk: "#3a1608", el: "#22d3ee", secondary: "#67e8f9", muted: "#a4ccd6", header: "linear-gradient(120deg,#073c47 0%,#0a5e70 100%)", bar: "linear-gradient(120deg,#0891b2,#22d3ee)", ring: "rgba(255,157,92,.5)" },
  royal:      { key: "royal",      label: "Royal",       swatch: "#4f46e5", bg: "#0d1533", panel: "#16204d", line: "#263272", cell: "#121b45", cellOff: "#0d1533", accent: "#f5b81f", accentInk: "#2a1e02", el: "#6366f1", secondary: "#a5b4fc", muted: "#b7c0e8", header: "linear-gradient(120deg,#16204d 0%,#2a3a86 100%)", bar: "linear-gradient(120deg,#4f46e5,#818cf8)", ring: "rgba(245,184,31,.5)" },
  aubergine:  { key: "aubergine",  label: "Aubergine",   swatch: "#7c3aed", bg: "#1a1030", panel: "#271847", line: "#3d2a6b", cell: "#201541", cellOff: "#180f2e", accent: "#fbbf24", accentInk: "#2a1e02", el: "#a855f7", secondary: "#d8b4fe", muted: "#c7b6e6", header: "linear-gradient(120deg,#271847 0%,#3a2568 100%)", bar: "linear-gradient(120deg,#7c3aed,#a855f7)", ring: "rgba(251,191,36,.5)" },
  burgundy:   { key: "burgundy",   label: "Burgundy",    swatch: "#9f1239", bg: "#260a14", panel: "#3a1020", line: "#571830", cell: "#2f0d19", cellOff: "#230912", accent: "#f6c453", accentInk: "#2e1e04", el: "#e11d48", secondary: "#fda4af", muted: "#e0b3bf", header: "linear-gradient(120deg,#3a1020 0%,#5a1c38 100%)", bar: "linear-gradient(120deg,#be123c,#e11d48)", ring: "rgba(246,196,83,.5)" },
  terracotta: { key: "terracotta", label: "Terracotta",  swatch: "#c2410c", bg: "#2a140c", panel: "#3c1e12", line: "#5a2e1a", cell: "#331810", cellOff: "#26120a", accent: "#fbbf24", accentInk: "#2e1e04", el: "#f97316", secondary: "#fdba74", muted: "#e6c3ac", header: "linear-gradient(120deg,#3c1e12 0%,#5c3016 100%)", bar: "linear-gradient(120deg,#ea580c,#f97316)", ring: "rgba(251,191,36,.5)" },
  slate:      { key: "slate",      label: "Slate",       swatch: "#64748b", bg: "#14181d", panel: "#1c222b", line: "#2b333f", cell: "#171c24", cellOff: "#12161c", accent: "#f59e0b", accentInk: "#2e1e04", el: "#38bdf8", secondary: "#7dd3fc", muted: "#aab6c6", header: "linear-gradient(120deg,#1c222b 0%,#2b3644 100%)", bar: "linear-gradient(120deg,#0ea5e9,#38bdf8)", ring: "rgba(245,158,11,.5)" },
  crimson:    { key: "crimson",    label: "Crimson",     swatch: "#dc2626", bg: "#2a0a0a", panel: "#3d1212", line: "#5a1c1c", cell: "#330f0f", cellOff: "#260a0a", accent: "#fbbf24", accentInk: "#2e1e04", el: "#ef4444", secondary: "#fca5a5", muted: "#e6b3b3", header: "linear-gradient(120deg,#3d1212 0%,#5c1e1e 100%)", bar: "linear-gradient(120deg,#dc2626,#ef4444)", ring: "rgba(251,191,36,.5)" },
  ...(Object.fromEntries(NEW_THEME_KEYS.map((k) => [k, themeFromTokens(THEME_TOKENS[k])])) as Record<NewThemeKey, Surf>),
};
// Resolve a stored/absent page style to a valid theme: legacy "navy" → the new
// "royal", anything unknown → "sport". Keeps old listings rendering.
function resolveTheme(t?: string): PageTheme {
  if (t === "navy") return "royal";
  return t && t in THEMES ? (t as PageTheme) : "sport";
}
// The colour-theme picker — lives in the listing editor (not on the preview), so
// the parent only ever sees the chosen theme for that listing.
function ThemePicker({ value, onChange }: { value: PageTheme; onChange: (t: PageTheme) => void }) {
  const tr = useT();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {Object.values(THEMES).map((t) => {
        const on = value === t.key;
        return (
          <button key={t.key} type="button" onClick={() => onChange(t.key)} title={tr("p8lst.wbTheme_" + t.key)}
            className="flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-bold transition-all"
            style={on ? { borderColor: t.swatch, background: `${t.swatch}1f`, color: "var(--ink)" } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>
            <span className="h-3.5 w-3.5 flex-none rounded-full ring-1 ring-black/10" style={{ background: t.swatch }} />
            {tr("p8lst.wbTheme_" + t.key)}{on ? " ✓" : ""}
          </button>
        );
      })}
    </div>
  );
}
// Rolling hero carousel — auto-advances + arrows/dots when there's >1 photo.
function HeroImages({ imgs, fallback }: { imgs: ListingImage[]; fallback: string }) {
  const tr = useT();
  const [i, setI] = useState(0);
  const n = imgs.length;
  useEffect(() => {
    if (n <= 1) return;
    const t = setInterval(() => setI((x) => (x + 1) % n), 4500);
    return () => clearInterval(t);
  }, [n]);
  if (n === 0) return <div className="absolute inset-0" style={{ background: fallback }} />;
  const cur = i % n;
  return (
    <>
      {imgs.map((im, idx) => <CroppedImage key={idx} im={im} className="absolute inset-0 h-full w-full transition-opacity duration-700" style={{ opacity: idx === cur ? 1 : 0 }} />)}
      {n > 1 && (
        <>
          <button type="button" aria-label={tr("p8lst.wbPrevPhoto")} onClick={() => setI((x) => (x - 1 + n) % n)} className="absolute start-2 top-1/2 z-[3] flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-[18px] text-white backdrop-blur-sm hover:bg-black/55">‹</button>
          <button type="button" aria-label={tr("p8lst.wbNextPhoto")} onClick={() => setI((x) => (x + 1) % n)} className="absolute end-2 top-1/2 z-[3] flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-[18px] text-white backdrop-blur-sm hover:bg-black/55">›</button>
          <div className="absolute inset-x-0 bottom-3 z-[3] flex justify-center gap-1.5">
            {imgs.map((_, idx) => <button key={idx} type="button" aria-label={tr("p8lst.wbPhotoN", { n: idx + 1 })} onClick={() => setI(idx)} className="h-1.5 rounded-full transition-all" style={{ width: idx === cur ? 18 : 6, background: idx === cur ? "#fff" : "rgba(255,255,255,.55)" }} />)}
          </div>
        </>
      )}
    </>
  );
}
// Section card for the Playful page.
function PlayCard({ e, tint, title, sub, children }: { e: string; tint: string; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-white p-5" style={{ boxShadow: "0 2px 0 #e8edf7" }}>
      <div className="mb-1 flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-2xl text-[17px]" style={{ background: tint }}>{e}</span><h2 className="text-[20px] font-extrabold tracking-[-0.02em] text-[#232842]">{title}</h2></div>
      {sub && <p className="mb-3 ms-[46px] text-[12.5px] text-[#7a8194]">{sub}</p>}
      <div className={sub ? "" : "mt-3"}>{children}</div>
    </div>
  );
}
// Bordered row + section header for the Sport page.
function SportRow({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-2.5 border border-s-[3px] px-3.5 py-3 text-[13.5px] font-bold text-[color:var(--sp-ink,#fff)]" style={{ borderColor: "var(--sp-line,#1e2430)", borderInlineStartColor: "var(--sp-acc,#c6ff00)", background: "var(--sp-panel,#12161f)" }}>{children}</div>;
}
function SportSec({ eye, title, children }: { eye: string; title: string; children: React.ReactNode }) {
  return (
    <div className="border-t pt-6" style={{ borderColor: "var(--sp-line,#1e2430)" }}>
      <div className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-[color:var(--sp-sec,#c6ff00)]">{eye}</div>
      <div className="mb-3 mt-1 text-[24px] font-black italic uppercase tracking-[-0.01em] text-[color:var(--sp-ink,#fff)]">{title}</div>
      {children}
    </div>
  );
}

// ── PAGE · PLAYFUL (bright, rounded, friendly) ─────────────────────────────
function PlayfulPage({ d, venue, whereHead, opens, cats, heroCat, town, runLabel, staff, addons, imgs, widget, full, emo, passSummary, brand, logo, topRight }: PageProps) {
  const tr = useT();
  const { locale } = useI18n();
  const BLUE = "#2f6bd8", DEEP = "#1d3a8f", INKp = "#232842", MUTp = "#7a8194";
  // Fixed ASPECT (not height) so the hero crops identically on every screen and
  // matches the wizard's crop preview exactly — WYSIWYG.
  const heroAspect = d.layout === "wide" ? "3 / 1" : "16 / 9";
  // Show the first few passes, then a "+N more" toggle so a long block list
  // doesn't run down the whole hero.
  const [morePasses, setMorePasses] = useState(false);
  const [openPass, setOpenPass] = useState<string | null>(null);
  const PASS_LIMIT = 3;
  const passesShown = morePasses ? passSummary : passSummary.slice(0, PASS_LIMIT);
  const passesExtra = passSummary.length - PASS_LIMIT;
  const chip = (o: string, fb: string, i: number) => (
    <div key={o} className="flex items-center gap-2.5 rounded-2xl bg-[#f4f7ff] px-3 py-2.5">
      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-xl text-[15px]" style={{ background: ["#e7f0ff", "#e4f8ee", "#fff0f5", "#fff6e0", "#e0f5ff"][i % 5] }}>{emo(o, fb)}</span>
      <b className="text-[13px]" style={{ color: INKp }}>{optionLabel(o)}</b>
    </div>
  );
  const grid2 = full ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1";
  const [teamOpen, setTeamOpen] = useState(true);
  const [whereOpen, setWhereOpen] = useState(false);
  return (
    <div className={`overflow-hidden ${full ? "" : "rounded-[26px] border border-[#e8edf7]"}`} style={{ background: "#f4f7ff", fontFamily: '"Segoe UI",system-ui,sans-serif', boxShadow: full ? undefined : undefined }}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 bg-white px-6 py-4">
        <span className="flex min-w-0 items-center gap-2.5">
          {logo && <img src={logo} alt={`${brand} logo`} className="h-9 w-9 flex-none rounded-lg object-contain" />}
          <span className="text-[18px] font-extrabold tracking-[-0.02em]" style={{ color: BLUE }}>{brand}</span>
        </span>
        <span className="flex items-center gap-4 [&_a]:text-[#2f6bd8]">
          {topRight}
          <span className="rounded-full px-3.5 py-1.5 text-[11.5px] font-bold" style={{ background: "#fff6e0", color: "#c98a00" }}>{tr("p7pg.trusted")}</span>
        </span>
      </div>
      <div className={full ? "p-6 lg:p-7" : "p-5"}>
        {/* title above the image */}
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
          {/* every chosen type, sized so the row always fits */}
          {/* Types in blue, location in muted grey — one colour ran them together. */}
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[10.5px] font-extrabold uppercase leading-tight tracking-[0.1em]">
            {cats.length ? cats.map((c, i) => (
              <span key={c.id} style={{ color: BLUE }}>{i > 0 && <span style={{ color: MUTp, opacity: 0.5 }}> / </span>}{optionLabel(c.name)}</span>
            )) : <span style={{ color: BLUE }}>{tr("p7pg.holidayCamp")}</span>}
            {town && (
              <>
                <span style={{ color: MUTp, opacity: 0.5 }}>|</span>
                <span style={{ color: MUTp }}>{town}</span>
              </>
            )}
          </div>
          <h1 className="mt-1 font-extrabold leading-[1.06] tracking-[-0.03em]" style={{ color: INKp, fontSize: full ? 27 : 21 }}>{d.title || tr("p7pg.yourListingTitle")}</h1>
          </div>
          {opens.locked && (
            <div className="flex-none rounded-2xl px-3.5 py-2 text-end" style={{ background: "#eef3ff", border: `1.5px solid ${BLUE}` }}>
              <div className="text-[9.5px] font-extrabold uppercase tracking-[0.1em]" style={{ color: BLUE }}>{tr("p7pg.bookingOpensIn")}</div>
              <div className="text-[17px] font-extrabold leading-tight tabular-nums" style={{ color: BLUE }}>{opens.countdown}</div>
              <div className="text-[10px]" style={{ color: MUTp }}>{opens.opensLabel}</div>
            </div>
          )}
        </div>
        {/* hero image (no text on it) */}
        <div className="relative overflow-hidden rounded-[28px]" style={{ aspectRatio: imgs.length ? heroAspect : "6 / 1", minHeight: imgs.length ? undefined : 72 }}>
          <HeroImages imgs={imgs} fallback={HERO_FALLBACK} />
          {heroCat && <span className="absolute start-4 top-4 z-[2] rounded-full bg-white px-3.5 py-2 text-[12px] font-extrabold" style={{ color: BLUE, transform: "rotate(-3deg)" }}>🎉 {optionLabel(heroCat.name)}</span>}
        </div>

        {/* passes — fancy accordion, tap to open details */}
        {passSummary.length > 0 && (
          <div className="mt-4">
            <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em]" style={{ color: BLUE }}>{tr("p7pg.passes")}</div>
            <div className="flex flex-col gap-2">
              {passesShown.map((p) => {
                const isOpen = openPass === p.name;
                const canOpen = !!(p.details || p.days);
                return (
                  <div key={p.name} className="overflow-hidden rounded-xl bg-white" style={{ border: `1.5px solid ${isOpen ? BLUE : `${BLUE}22`}`, boxShadow: "0 3px 10px -8px rgba(30,50,90,.3)" }}>
                    <button type="button" onClick={() => canOpen && setOpenPass(isOpen ? null : p.name)} className="flex w-full items-center gap-2.5 px-2.5 py-2 text-start">
                      <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg text-[12px] font-black text-white" style={{ background: `linear-gradient(140deg,${BLUE},${DEEP})` }}>🎟</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11.5px] font-extrabold leading-tight" style={{ color: INKp }}>{p.name}</span>
                        {p.days ? <span className="text-[10px] font-semibold" style={{ color: MUTp }}>{pickPlural(tr, locale, "p7pg.daysN", p.days)}{canOpen ? " " + tr("p7pg.tapDetails") : ""}</span> : null}
                      </span>
                      <span className="flex-none text-[13px] font-black tracking-[-0.01em]" style={{ color: DEEP, fontVariantNumeric: "tabular-nums" }}><span className="text-[8.5px] font-bold uppercase" style={{ color: MUTp }}>{tr("p7bw.fromWord")} </span>{money(p.price)}</span>
                      {canOpen && <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full text-[12px] font-extrabold text-white transition-transform" style={{ background: BLUE, transform: isOpen ? "rotate(180deg)" : "none" }}>⌄</span>}
                    </button>
                    {isOpen && (
                      <div className="border-t px-3 py-2 text-[11.5px] leading-[1.55]" style={{ borderColor: "#eef2fb", color: "#3d4763", background: "#f8faff" }}>
                        {p.details || tr("p7pg.passDetail", { n: p.days ?? "" })}
                      </div>
                    )}
                  </div>
                );
              })}
              {passesExtra > 0 && (
                <button type="button" onClick={() => setMorePasses((v) => !v)} className="self-start rounded-full px-4 py-1.5 text-[12px] font-extrabold text-white" style={{ background: `linear-gradient(140deg,${BLUE},${DEEP})` }}>
                  {morePasses ? tr("p7pg.showFewer") : tr("p7pg.plusMore", { n: passesExtra })}
                </button>
              )}
            </div>
          </div>
        )}

        {/* on-the-day contact — only while the camp is running */}
        {d.sitePhone && listingRunningNow(d) && (
          <div className="mt-3 flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: "#e4f8ee", border: "1.5px solid #b6e6c8" }}>
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl text-[16px]" style={{ background: "#fff" }}>📞</span>
            <div className="min-w-0">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.1em]" style={{ color: "#1d3a8f" }}>{tr("p7pg.campOnNow")}</div>
              <a href={`tel:${d.sitePhone.replace(/\s+/g, "")}`} className="text-[16px] font-black tracking-[-0.01em]" style={{ color: "#0b6b3a" }}>{d.sitePhone}</a>
            </div>
          </div>
        )}

        {/* Ways to pay — card is always accepted; show whatever else this listing takes */}
        {d.payMethods && d.payMethods.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 px-2 text-[12px]">
            <span className="font-extrabold uppercase tracking-[0.08em] text-[#7a8194]">{tr("p7pg.waysToPay")}</span>
            <span className="rounded-full border px-2.5 py-1 font-bold" style={{ borderColor: "#cdddf7", background: "#eef4ff", color: "#1d3a8f" }}>{tr("p7pg.cardWord")}</span>
            {d.payMethods.filter((m) => !/^card$/i.test(String(m).trim())).map((m) => (
              <span key={m} className="rounded-full border px-2.5 py-1 font-bold" style={{ borderColor: "#b6e6c8", background: "#e4f8ee", color: "#0b6b3a" }}>{m}</span>
            ))}
          </div>
        )}

        {/* fancy fact strip (under the image) */}
        <div className="relative z-10 mx-2 -mt-6 flex flex-col overflow-hidden rounded-2xl bg-white sm:flex-row" style={{ boxShadow: "0 18px 34px -18px rgba(30,50,90,.35)" }}>
          {([["📍", tr("p7pg.whereLbl"), (deliveryLabel(tr, { deliveryMode: d.deliveryMode, venueKind: (venue as { kind?: string } | null | undefined)?.kind }, venue?.name, "parent") ?? (venue?.name || town || tr("p7pg.venueTbc"))), "#eef4ff", venue?.address || null], ["📆", tr("p7pg.whenLbl"), runLabel, "#e4f8ee", null], ["👧👦", tr("p7pg.agesLbl"), d.ageFrom && d.ageTo ? tr("p7pg.agesYears", { from: d.ageFrom, to: d.ageTo }) : tr("p7pg.allAges"), "#fff0f5", null]] as [string, string, string, string, string | null][]).map(([e, k, v, tint, sub], i) => (
            <div key={k} className={`flex flex-1 items-center gap-3 px-4 py-3.5 ${i ? "border-t border-[#eef2fb] sm:border-s sm:border-t-0" : ""}`}>
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl text-[16px]" style={{ background: tint }}>{e}</span>
              <div className="min-w-0"><div className="text-[9.5px] font-extrabold uppercase tracking-[0.1em] text-[#7a8194]">{k}</div><div className="truncate text-[13px] font-extrabold" style={{ color: DEEP }}>{v}</div>{sub && <div className="truncate text-[11px] font-medium text-[#7a8194]">{sub}</div>}</div>
            </div>
          ))}
        </div>

        <div className={`mt-5 ${full ? "grid items-start gap-6 lg:grid-cols-[1fr_360px]" : ""}`}>
          <div className="flex flex-col gap-4">
            {d.description && <div className="rounded-3xl bg-white p-5 text-[13.5px] leading-[1.65]" style={{ color: "#3d4763", boxShadow: "0 2px 0 #e8edf7" }}>{d.description}</div>}
            {!full && <div id="aos-book">{widget}</div>}
            {d.sections.some((s) => s.text) && <PlayCard e="🎯" tint="#e7f0ff" title={headingOf(d, "about", "title")}>{d.sections.filter((s) => s.text).map((s) => <div key={s.id} className="mb-3 last:mb-0"><div className="text-[11px] font-extrabold uppercase tracking-[0.06em]" style={{ color: BLUE }}>{s.type}</div><p className="mt-1 text-[13.5px] leading-[1.6]" style={{ color: "#3d4763" }}>{s.text}</p></div>)}</PlayCard>}
            {d.outcomes.length > 0 && <PlayCard e="🌟" tint="#fff6e0" title={headingOf(d, "learn", "title")} sub={headingOf(d, "learn", "eyebrow")}><div className={`grid gap-2 ${grid2}`}>{d.outcomes.map((o, i) => chip(o, "⭐", i))}</div></PlayCard>}
            {d.provided.length > 0 && <PlayCard e="🎒" tint="#e4f8ee" title={headingOf(d, "included", "title")} sub={headingOf(d, "included", "eyebrow")}><div className={`grid gap-2 ${grid2}`}>{d.provided.map((o, i) => chip(o, "✅", i))}</div></PlayCard>}
            {d.toBring.length > 0 && <PlayCard e="🧳" tint="#fff0f5" title={tr("p7pg.whatToBring")} sub={tr("p7pg.pleasePack")}><div className={`grid gap-2 ${grid2}`}>{d.toBring.map((o, i) => chip(o, "🎒", i))}</div></PlayCard>}
            {d.safety.length > 0 && <PlayCard e="🛡️" tint="#fff0f5" title={headingOf(d, "safety", "title")} sub={headingOf(d, "safety", "eyebrow")}><div className={`grid gap-2 ${grid2}`}>{d.safety.map((o, i) => chip(o, "🚑", i))}</div></PlayCard>}
            {d.send.length > 0 && <PlayCard e="🤝" tint="#e0f5ff" title={headingOf(d, "send", "title")} sub={headingOf(d, "send", "eyebrow")}><div className={`grid gap-2 ${grid2}`}>{d.send.map((o, i) => chip(o, "♿", i))}</div></PlayCard>}
            {venue && (isOnlineVenue(venue) || venue.address || venue.lat !== undefined || venue.directions || venue.facilities?.length || venue.what3words || venue.transport) && (
              <div className="rounded-3xl bg-white p-5" style={{ boxShadow: "0 2px 0 #e8edf7" }}>
                <button type="button" onClick={() => setWhereOpen((o) => !o)} className="flex w-full items-center justify-between text-start">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-2xl text-[17px]" style={{ background: "#e7f0ff" }}>📍</span>
                    <div>
                      <div className="text-[11px] font-extrabold uppercase tracking-[0.06em]" style={{ color: BLUE }}>{whereHead.eyebrow}</div>
                      <h2 className="text-[20px] font-extrabold tracking-[-0.02em]" style={{ color: INKp }}>{whereHead.title}</h2>
                    </div>
                  </div>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full text-[16px] font-extrabold text-white" style={{ background: BLUE }}>{whereOpen ? "–" : "+"}</span>
                </button>
                {whereOpen && (<div className="mt-4">
                <div className="text-[14px] font-extrabold" style={{ color: INKp }}>{venue.name}</div>
                {isOnlineVenue(venue) ? <div className="mt-0.5 text-[13px]" style={{ color: MUTp }}>{tr("p7pg.runsOnline")}</div> : venue.address && <div className="mt-0.5 text-[13px]" style={{ color: MUTp }}>{venue.address}</div>}
                {!isOnlineVenue(venue) && venue.lat !== undefined && <div className="mt-3"><VenueMap lat={venue.lat} lng={venue.lng} zoom={venue.zoom} height={170} /></div>}
                {!!venue.facilities?.length && (
                  <div className={`mt-3 grid gap-2 ${grid2}`}>{venue.facilities.map((f, i) => chip(f, "✅", i))}</div>
                )}
                {!isOnlineVenue(venue) && (venue.what3words || venue.transport) && (
                  <div className="mt-3 flex flex-wrap gap-2 text-[12.5px]">
                    {venue.what3words && (
                      <a href={`https://what3words.com/${encodeURIComponent(venue.what3words.replace(/^\/+/, ""))}`} target="_blank" rel="noreferrer noopener"
                        className="rounded-2xl px-3 py-2 font-bold" style={{ background: "#fff0f5", color: "#c81e5b" }}>
                        {"///"} {venue.what3words.replace(/^\/+/, "")}
                      </a>
                    )}
                    {venue.transport && (
                      <span className="rounded-2xl px-3 py-2 font-bold" style={{ background: "#e4f8ee", color: "#1d3a8f" }}>🚌 {venue.transport}</span>
                    )}
                  </div>
                )}
                {venue.directions && (
                  <div className="mt-3 rounded-2xl p-3.5" style={{ background: "#f4f7ff" }}>
                    <div className="text-[11px] font-extrabold uppercase tracking-[0.06em]" style={{ color: BLUE }}>{isOnlineVenue(venue) ? tr("p7pg.howToJoin") : tr("p7pg.gettingThere")}</div>
                    <p className="mt-1 whitespace-pre-line text-[13px] leading-[1.6]" style={{ color: "#3d4763" }}>{venue.directions}</p>
                  </div>
                )}
                </div>)}
              </div>
            )}
            {staff.length > 0 && (
              <div className="rounded-3xl bg-white p-5" style={{ boxShadow: "0 2px 0 #e8edf7" }}>
                <button type="button" onClick={() => setTeamOpen((o) => !o)} className="flex w-full items-center justify-between text-start">
                  <div className="flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-2xl text-[17px]" style={{ background: "#e7f0ff" }}>👋</span><h2 className="text-[20px] font-extrabold tracking-[-0.02em] text-[#232842]">{headingOf(d, "team", "title")}</h2></div>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full text-[16px] font-extrabold text-white" style={{ background: BLUE }}>{teamOpen ? "–" : "+"}</span>
                </button>
                {teamOpen && <div className={`mt-4 grid gap-3 ${grid2}`}>{staff.map((m, i) => <div key={m.id} className="rounded-2xl p-3.5" style={{ background: "#f4f7ff" }}><div className="flex items-center gap-2.5"><span className="flex h-10 w-10 flex-none items-center justify-center rounded-2xl text-[15px] font-extrabold text-white" style={{ background: [BLUE, "#ff5d8f", "#06d6a0", "#f59e0b"][i % 4] }}>{(m.first[0] || "?").toUpperCase()}</span><b className="text-[14px]" style={{ color: INKp }}>{m.first} {m.last}</b></div>{m.bio && <p className="mt-2 text-[12.5px] leading-[1.55]" style={{ color: MUTp }}>{m.bio}</p>}</div>)}</div>}
              </div>
            )}
            {addons.length > 0 && <PlayCard e="✨" tint="#e4f8ee" title={headingOf(d, "addons", "title")} sub={headingOf(d, "addons", "eyebrow")}><div className="flex flex-col gap-2">{addons.map((a, i) => <div key={i} className="flex items-center justify-between rounded-2xl px-4 py-3" style={{ background: "#f4f7ff" }}><span className="flex items-center gap-2.5 text-[13.5px] font-bold" style={{ color: INKp }}>{a.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.image} alt="" className="h-8 w-8 flex-none rounded-lg object-cover" />
            ) : (
              <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-[15px]" style={{ background: a.emoji ? "#e4f8ee" : "#06d6a0", color: a.emoji ? undefined : "#fff" }}>{a.emoji || "＋"}</span>
            )}{a.name}</span><b style={{ color: DEEP }}>{money(a.price)}<span className="ms-1 text-[10.5px] font-semibold opacity-70">{a.type === "perday" ? tr("p8lst.ck8PerDay") : tr("p8lst.ck8OneOff")}</span></b></div>)}</div></PlayCard>}
            {d.gallery.length > 0 && <PlayCard e="📸" tint="#fff6e0" title={headingOf(d, "gallery", "title")}><div className={`grid gap-2.5 ${full ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>{d.gallery.map((im, i) => <CroppedImage key={i} im={im} className="rounded-2xl" style={{ aspectRatio: "1 / 1" }} />)}</div></PlayCard>}
          </div>
          {full && <div id="aos-book" className="self-start lg:sticky lg:top-4">{widget}</div>}
        </div>

        {/* footer */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl px-6 py-5" style={{ background: DEEP, color: "#cdd8f0" }}>
          <div className="text-[17px] font-extrabold text-white">{brand}</div>
          <div className="text-[11px] opacity-70">{tr("p7pg.poweredBy")}</div>
        </div>
      </div>
    </div>
  );
}

// ── PAGE · SPORT (dark, electric, athletic) ────────────────────────────────
function SportPage({ d, venue, whereHead, opens, blocks, staffNames, cats, heroCat, town, runLabel, staff, addons, imgs, widget, full, emo, passSummary, spacesLeft, surf, brand, logo, topRight }: PageProps & { surf: Surf }) {
  const tr = useT();
  const { locale } = useI18n();
  const BG = surf.bg, PANEL = surf.panel, LINEs = surf.line;
  const EL = surf.el;
  const LIME = surf.accent;      // headline accent (price, chips, borders)
  const INK = surf.accentInk;    // dark ink that reads on the accent
  const CY = surf.secondary;     // location / secondary
  const MUTs = surf.muted;       // muted body text
  const headerBg = surf.header;  // top-bar gradient (undefined = plain ground)
  useThemeFont(surf.key);
  const V = surf.v2, k = V?.t;
  const light = !!V && !V.dark;
  const INKT = k?.ink ?? "#fff", BODYC = k?.ink ?? "#c3ccdb";
  const ACCT = k?.sec ?? LIME, PRICE = k?.price ?? LIME, EYEB = k?.eyebrow ?? LIME;   // accent as TEXT: labels / prices / eyebrow on the header
  const BANDINK = k?.bandInk ?? "#fff", MUTBAND = k ? BANDINK : MUTs;
  const STRIPBG = k?.strip ?? PANEL, STRIPINK = k?.stripInk ?? "#fff";
  const CHIPBG = k ? `${k.stripInk}17` : "rgba(255,255,255,.06)";
  const WARN = light ? "#8a4b00" : "#ffb020", BAD = light ? "#b3261e" : "#ff5470";
  const TRACK = k?.line ?? "#26304a";
  const cond = V ? "aos-disp" : "italic uppercase tracking-[-0.01em]";
  const grid2 = full ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1";
  // Fixed ASPECT (not height) so the hero crops the same on every screen and
  // matches the wizard's crop preview exactly — WYSIWYG.
  const heroAspect = d.layout === "wide" ? "3 / 1" : "16 / 9";
  const [teamOpen, setTeamOpen] = useState(true);
  const [whereOpen, setWhereOpen] = useState(false);
  const [morePasses, setMorePasses] = useState(false);
  const [openPass, setOpenPass] = useState<string | null>(null);
  const PASS_LIMIT = 3;
  const passesShown = morePasses ? passSummary : passSummary.slice(0, PASS_LIMIT);
  const passesExtra = passSummary.length - PASS_LIMIT;
  return (
    <div className={`overflow-hidden ${full ? "" : "rounded-[18px] border"}${V ? ` aos-th2${V.key === "poster" ? " aos-poster" : ""}` : ""}`} style={{ background: BG, color: INKT, borderColor: LINEs, fontFamily: "system-ui,-apple-system,sans-serif", ...(V ? { ...spVars(V), ...(full ? {} : { borderRadius: k!.r }) } : {}) }}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b px-6 py-4" style={{ borderColor: LINEs, background: headerBg, color: BANDINK }}>
        <span className="flex min-w-0 items-center gap-2.5">
          {logo && <img src={logo} alt={`${brand} logo`} className="h-9 w-9 flex-none rounded-lg bg-white object-contain p-0.5" />}
          <span className={`text-[18px] font-black ${cond}`}>{brand}</span>
        </span>
        <span className="flex items-center gap-4 [&_a]:text-[color:var(--sp-bandink,#fff)]">
          {topRight}
          <span className="text-[11px]" style={{ color: MUTBAND, opacity: k ? 0.85 : 1 }}>{tr("p7pg.secureCheckout")}</span>
        </span>
      </div>
      {/* title above the image — every chosen type listed, sized to fit */}
      <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-6" style={k ? { background: k.band, color: BANDINK } : undefined}>
        <div className="min-w-0 flex-1">
        {/* Types in lime, location in cyan — one colour for both ran them together. */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-black uppercase leading-tight tracking-[0.12em]">
          {cats.length ? cats.map((c, i) => (
            <span key={c.id} className="inline-flex items-center gap-2">
              {i > 0 && <span style={{ color: MUTBAND, opacity: 0.5 }}>/</span>}
              <span style={{ color: EYEB }}>{optionLabel(c.name)}</span>
            </span>
          )) : <span style={{ color: EYEB }}>{tr("p7pg.holidayCamp")}</span>}
          {town && (
            <>
              <span style={{ color: MUTBAND, opacity: 0.5 }}>|</span>
              <span style={{ color: k ? BANDINK : CY }}>{town}</span>
            </>
          )}
        </div>
        <h1 className={`mt-1.5 font-black ${cond}`} style={{ fontSize: full ? 38 : 26, lineHeight: .94, color: BANDINK }}>{d.title || tr("p7pg.yourListingTitle")}</h1>
        </div>
        {opens.locked && (
          <div className="flex-none border px-3.5 py-2 text-end" style={{ borderColor: LIME, background: PANEL }}>
            <div className="text-[9.5px] font-black uppercase tracking-[0.12em]" style={{ color: ACCT }}>{tr("p7pg.bookingOpensIn")}</div>
            <div className="text-[17px] font-black leading-tight tabular-nums" style={{ color: INKT }}>{opens.countdown}</div>
            <div className="text-[10px]" style={{ color: MUTs }}>{opens.opensLabel}</div>
          </div>
        )}
      </div>
      {/* hero image (no text on it) */}
      {V && !imgs.length ? (
        // No photo: the theme's own artwork (a listing with a photo keeps its photo).
        <div className="relative overflow-hidden" data-testid="theme-hero" data-theme-art={themeArtOn(d) ? "on" : "off"}>
          {!themeArtOn(d)
            ? <div aria-hidden style={{ height: 72, background: `linear-gradient(90deg, ${k!.band}, ${k!.acc})` }} />
            : <ThemeHero theme={V.key} title={d.title} run={runLabel} brand={brand} />}
          {heroCat && <span className="absolute start-0 top-4 z-[6] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.1em]" style={{ background: LIME, color: INK, borderRadius: `0 ${k!.rs}px ${k!.rs}px 0`, paddingInlineStart: 20 }}>{optionLabel(heroCat.name)}</span>}
        </div>
      ) : (
      <div className="relative overflow-hidden" style={{ aspectRatio: imgs.length ? heroAspect : "6 / 1", minHeight: imgs.length ? undefined : 72 }}>
        <HeroImages imgs={imgs} fallback={`linear-gradient(120deg,${EL},#00a3ff 70%,#003)`} />
        <div className="pointer-events-none absolute inset-0 z-[1]" style={{ backgroundImage: "repeating-linear-gradient(115deg,transparent 0 46px,rgba(255,255,255,.05) 46px 48px)" }} />
        {heroCat && <span className="absolute start-6 top-5 z-[2] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.1em]" style={{ background: LIME, color: INK, transform: V ? undefined : "skewX(-8deg)", borderRadius: k?.rs }}>{optionLabel(heroCat.name)}</span>}
      </div>
      )}
      {/* fancy info strip (under the image) */}
      <div className="flex flex-col border-y sm:flex-row" style={{ borderColor: LINEs, background: STRIPBG, color: STRIPINK }}>
        {([["📍", (deliveryLabel(tr, { deliveryMode: d.deliveryMode, venueKind: (venue as { kind?: string } | null | undefined)?.kind }, venue?.name, "parent") ?? (venue?.name || town || tr("p7pg.venueTbc"))), venue?.address || null], ["📆", runLabel, null], ["👧👦", d.ageFrom && d.ageTo ? tr("p7pg.agesRange", { from: d.ageFrom, to: d.ageTo }) : tr("p7pg.allAges"), null]] as [string, string, string | null][]).map(([e, v, sub], i) => (
          <div key={i} className={`flex flex-1 items-center gap-2.5 px-5 py-3 ${i ? "border-t sm:border-s sm:border-t-0" : ""}`} style={i ? { borderColor: LINEs } : undefined}>
            <span className="text-[15px]">{e}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-bold uppercase tracking-[0.05em]" style={{ color: STRIPINK }}>{v}</span>
              {sub && <span className="block truncate text-[10.5px] font-medium normal-case" style={{ color: k ? STRIPINK : "rgba(255,255,255,.6)", opacity: k ? 0.78 : 1 }}>{sub}</span>}
            </span>
            <span className="h-2 w-2 flex-none" style={{ background: LIME }} />
          </div>
        ))}
      </div>
      {d.payMethods && d.payMethods.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b px-5 py-2.5" style={{ borderColor: LINEs, background: STRIPBG, color: STRIPINK }}>
          <span className="me-0.5 text-[10px] font-extrabold uppercase tracking-[0.1em]" style={{ color: k ? STRIPINK : "rgba(255,255,255,.6)", opacity: k ? 0.78 : 1 }}>{tr("p7pg.waysToPay")}</span>
          <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ color: STRIPINK, background: `${LIME}26`, border: `1px solid ${LIME}` }}>{tr("p7pg.cardWord")}</span>
          {d.payMethods.map((m) => <span key={m} className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ color: STRIPINK, background: CHIPBG, border: `1px solid ${LINEs}` }}>{m}</span>)}
        </div>
      )}
      <div className={full ? "px-6 pb-8 lg:px-8" : "px-5 pb-6"}>
        {/* stats strip */}
        {/* Spec strip: ages, availability, all passes in one box, discounts in
            the next — so the prices don't eat the whole row. */}
        {(() => {
          const todayIso = new Date().toISOString().slice(0, 10);
          const live = (d.discounts ?? []).filter(
            (r) => r.enabled && !(r.kind === "early" && r.beforeDate && todayIso > r.beforeDate),
          );
          // Flex, not a column count: tiles come and go (no staff, no
          // discounts, spaces hidden) and column maths silently wrapped the
          // last one onto its own row every time the mix changed.
          const tile = "min-w-0 flex-1 border-b border-s px-4 py-3.5 first:border-s-0";
          const wide = tile;
          const lab = "truncate text-[9.5px] font-bold uppercase tracking-[0.12em]";
          return (
            <div className="mt-5 border" style={{ borderColor: LINEs, background: PANEL }}>
             <div className="flex flex-col sm:flex-row">
              {/* Ages already appear in the facts strip above the image — this
                  slot earns more as the team, names visible, bios on tap. */}
              {staff.length > 0 && (
                <button type="button" onClick={() => setTeamOpen((o) => !o)}
                  className={`${wide} flex flex-col text-start`} style={{ borderColor: LINEs, borderTop: `2px solid ${LIME}` }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className={lab} style={{ color: MUTs }}>{headingOf(d, "team", "eyebrow")}</div>
                      <div className={`mt-1 truncate text-[15px] font-black ${cond} text-[color:var(--sp-ink,#fff)]`}>{headingOf(d, "team", "title")}</div>
                      <div className="mt-1 truncate text-[11px]" style={{ color: BODYC }}>{staffNames.join(" · ")}</div>
                    </div>
                    <span className="flex h-5 w-5 flex-none items-center justify-center text-[14px] font-black" style={{ background: LIME, color: INK }}>{teamOpen ? "–" : "+"}</span>
                  </div>
                </button>
              )}
              {/* "Show spaces" hides the numbers here — the calendar keeps its
                  colours either way, so a parent can still see which days are
                  going without being shown a running total. */}
              {d.showSpaces && (
              <div className={wide} style={{ borderColor: LINEs, borderTop: `2px solid ${LIME}` }}>
                <div className={lab} style={{ color: MUTs }}>{tr("p8lst.wbSpacesLbl")}</div>
                {(() => {
                  // Totals come from the real runs when there are any. They
                  // legitimately differ by scope: 20/day over ten days is 200
                  // places, 60 across the camp is 60 — so read, don't assume.
                  // No dated runs means no bookings to count. Showing
                  // "0 booked · 0% full" there states a fact we don't have —
                  // it's what made a listing with a booking look empty.
                  if (!blocks?.length) {
                    return spacesLeft === null
                      ? <div className={`mt-1 text-[18px] font-black ${cond} text-[color:var(--sp-ink,#fff)]`}>—</div>
                      : (<>
                          <div className={`mt-1 truncate text-[18px] font-black ${cond} text-[color:var(--sp-ink,#fff)]`}>Up to {spacesLeft}</div>
                          <div className="mt-1 text-[10.5px]" style={{ color: MUTs }}>{tr("p7pg.bookingsShowOnce")}</div>
                        </>);
                  }
                  // Per-day capacity is a daily limit: 10 a day for three weeks
                  // is "10 left", not 30, so show the busiest block, not a sum.
                  const perDay = d.capacityScope === "day";
                  const total = perDay ? Math.max(...blocks.map((x) => x.capacity)) : blocks.reduce((n, x) => n + x.capacity, 0);
                  // Headline "left" = the best day still bookable (sold out only
                  // when EVERY date is full); "booked" = the busiest day.
                  const dayLefts = blocks.flatMap((x) => (x.open ? (x.sessions?.length ? x.sessions.map((q) => q.spotsLeft) : [x.spotsLeft]) : [0]));
                  const left = perDay ? Math.max(0, ...dayLefts) : blocks.reduce((n, x) => n + x.spotsLeft, 0);
                  const used = perDay ? Math.max(0, total - Math.min(...blocks.map((x) => x.spotsLeft))) : Math.max(0, total - left);
                  const pct = total > 0 ? Math.round((used / total) * 100) : 0;
                  return (
                    <>
                      <div className={`mt-1 truncate text-[18px] font-black ${cond}`}
                        style={{ fontVariantNumeric: "tabular-nums", color: left <= 0 ? BAD : INKT }}>
                        {left <= 0 ? tr("p7pg.soldOut") : perDay ? tr("p9tx.wzPlacesADay", { total: String(total) }) : tr("p7pg.leftOfTotal", { left, total })}
                      </div>
                      <div className="mt-1.5 h-1 w-full" style={{ background: TRACK }}>
                        <div className="h-full" style={{ width: `${pct}%`, background: left <= 0 ? "#ff5470" : LIME }} />
                      </div>
                      <div className="mt-1 text-[10.5px]" style={{ color: MUTs }}>{perDay ? tr("p9tx.wzBusiest", { used: String(used), total: String(total) }) : tr("p9tx.wzBookedPct", { used: String(used), pct: String(pct) })}</div>
                    </>
                  );
                })()}
                {(() => {
                  // Counted in dates, because that's the unit a parent books in
                  // — "15 places left" doesn't say whether the days they want
                  // are among them.
                  const dates = periodDates(d, genDates).filter((x) => !(d.datesOff ?? []).includes(x));
                  if (!dates.length || !blocks?.length) return null;
                  const leftOnDate = (iso: string) => { const blk = blockOn(blocks, iso); if (!blk) return null; if (!blk.open) return 0; return blk.capacityScope === "day" ? blk.sessions?.find((q) => q.date === iso)?.spotsLeft ?? blk.spotsLeft : blk.spotsLeft; };
                  const open = dates.filter((x) => (leftOnDate(x) ?? 1) > 0);

                  // Runs of consecutive dates sharing a count collapse to a
                  // range. Today counts are per week so that yields one range
                  // per week; when they go per session it yields real dates,
                  // with no change here.
                  const spans: { from: string; to: string; left: number }[] = [];
                  dates.forEach((iso) => {
                    const n = leftOnDate(iso);
                    if (n === null || n <= 0 || n > LOW_LEFT) return;
                    const last = spans[spans.length - 1];
                    const prev = dates[dates.indexOf(iso) - 1];
                    if (last && last.left === n && last.to === prev) last.to = iso;
                    else spans.push({ from: iso, to: iso, left: n });
                  });
                  const label = (sp: { from: string; to: string; left: number }) =>
                    `${sp.from === sp.to ? fmtDate(sp.from) : `${fmtDate(sp.from)}–${fmtDate(sp.to)}`} ${tr("p7pg.spanLeft", { left: sp.left })}`;

                  return (
                    <>
                      {/* Only worth saying once some dates have actually gone. */}
                      {open.length < dates.length && (
                        <div className="mt-1.5 text-[10.5px]" style={{ color: MUTs }}>
                          {(() => { const parts = tr("p9tx.wzDatesSpace", { open: "\u0000", total: String(dates.length) }).split("\u0000"); return <>{parts[0]}<b className="text-[color:var(--sp-ink,#fff)]">{open.length}</b>{parts[1]}</>; })()}
                        </div>
                      )}
                      {spans.length > 0 && (
                        <div className="mt-1 text-[10.5px] font-bold leading-[1.45]" style={{ color: WARN }}>
                          {tr("p7pg.nearlyFull", { spans: spans.slice(0, 3).map(label).join(" · ") + (spans.length > 3 ? " " + tr("p7pg.plusMore", { n: spans.length - 3 }) : "") })}
                        </div>
                      )}
                    </>
                  );
                })()}
                {/* Sold out is a dead end unless it says what to do next. */}
                {spacesLeft !== null && spacesLeft <= 0 && (
                  d.waitlist ? (
                    <button type="button"
                      onClick={() => document.getElementById("aos-book")?.scrollIntoView({ behavior: "smooth", block: "center" })}
                      className="mt-2 w-full px-2 py-1.5 text-[11px] font-black uppercase tracking-[0.08em]"
                      style={{ background: LIME, color: INK }}>
                      {tr("p8lst.wbJoinWaitlist")}
                    </button>
                  ) : (
                    <div className="mt-1.5 text-[11px]" style={{ color: MUTs }}>{tr("p7pg.noWaitlist")}</div>
                  )
                )}
              </div>
              )}
              {d.sitePhone && listingRunningNow(d) && (
                <div className={wide} style={{ borderColor: LINEs, borderTop: `2px solid ${LIME}` }}>
                  <div className={lab} style={{ color: ACCT }}>{tr("p7pg.campOnNowShort")}</div>
                  <a href={`tel:${d.sitePhone.replace(/\s+/g, "")}`} className={`mt-1 block text-[17px] font-black ${cond}`} style={{ color: INKT }}>{d.sitePhone}</a>
                </div>
              )}
              {passSummary.length > 0 && (
                <div className={wide} style={{ borderColor: LINEs, borderTop: `2px solid ${LIME}` }}>
                  <div className={lab} style={{ color: MUTs }}>{tr("p8lst.wbPassesLbl")}</div>
                  <div className="mt-1.5 flex flex-col gap-1">
                    {passesShown.map((pp) => {
                      const isOpen = openPass === pp.name;
                      const canOpen = !!(pp.details || pp.days);
                      return (
                        <div key={pp.name} className="overflow-hidden rounded-md" style={{ background: surf.cell, borderInlineStart: `2px solid ${LIME}` }}>
                          <button type="button" onClick={() => canOpen && setOpenPass(isOpen ? null : pp.name)} className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-start">
                            <span className="min-w-0">
                              <span className={`block truncate text-[10.5px] font-bold text-[color:var(--sp-ink,#fff)] ${cond}`}>{pp.name}</span>
                              {pp.days ? <span className="block whitespace-nowrap text-[9px]" style={{ color: MUTs }}>{pickPlural(tr, locale, "p8lst.wbDaysN", pp.days)}{canOpen ? ` ${tr("p8lst.wbDetailsSfx")}` : ""}</span> : null}
                            </span>
                            <span className="flex flex-none items-center gap-1">
                              <b className="text-[12px] font-black" style={{ color: PRICE, fontVariantNumeric: "tabular-nums" }}>{money(pp.price)}</b>
                              {canOpen && <span className="text-[10px] font-black transition-transform" style={{ color: ACCT, transform: isOpen ? "rotate(180deg)" : "none" }}>⌄</span>}
                            </span>
                          </button>
                          {isOpen && (
                            <div className="border-t px-2 py-1.5 text-[10.5px] leading-[1.5]" style={{ borderColor: LINEs, color: k ? INKT : "#d7deea" }}>
                              {pp.details || tr("p7pg.passDetail", { n: pp.days ?? "" })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {passesExtra > 0 && (
                      <button type="button" onClick={() => setMorePasses((v) => !v)} className={`mt-0.5 self-start rounded-full px-3 py-1 text-[11px] font-black ${cond}`} style={{ background: LIME, color: INK }}>
                        {morePasses ? tr("p7pg.showFewer") : tr("p7pg.plusMore", { n: passesExtra })}
                      </button>
                    )}
                  </div>
                </div>
              )}
              <div className={wide} style={{ borderColor: LINEs, borderTop: `2px solid ${LIME}` }}>
                <div className={lab} style={{ color: MUTs }}>{tr("p8lst.wbDiscountsLbl")}</div>
                {live.length === 0 ? (
                  <div className="mt-1.5 text-[11.5px]" style={{ color: MUTs }}>{tr("p7pg.noneListing")}</div>
                ) : (
                  <div className="mt-1.5 flex flex-col gap-1">
                    {live.slice(0, 3).map((r) => (
                      <div key={r.id} className="flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block text-[11px] leading-snug" style={{ color: BODYC }}>{ruleDisplayName(r, { tr, locale })}</span>
                          {/* Which tickets it covers — a rule on one pass shouldn't look universal. */}
                          <span className="block text-[9.5px]" style={{ color: MUTs }}>
                            {r.passNames.length === 0 ? tr("p7pg.allPasses") : r.passNames.join(", ")}
                            {r.kind === "early" && r.beforeDate ? " " + tr("p7pg.bookBy", { date: fmtDate(r.beforeDate) }) : ""}
                          </span>
                        </span>
                        <b className="flex-none text-[12px] font-black" style={{ color: PRICE, fontVariantNumeric: "tabular-nums" }}>
                          {r.method === "percent" ? `-${r.value}%` : `-${money(r.value)}`}
                        </b>
                      </div>
                    ))}
                    {live.length > 3 && <div className="text-[10.5px]" style={{ color: MUTs }}>+{live.length - 3} more</div>}
                  </div>
                )}
              </div>
             </div>
              {teamOpen && staff.length > 0 && (
                <div className="border-t px-4 py-4" style={{ borderColor: LINEs }}>
                  <div className={`grid gap-3 ${grid2}`}>
                    {staff.map((m) => (
                      <div key={m.id} className="border p-3.5" style={{ borderColor: LINEs, background: BG }}>
                        <div className="flex items-center gap-2.5">
                          <span className={`flex h-9 w-9 flex-none items-center justify-center font-black ${cond} text-[15px]`} style={{ background: EL, color: k?.chipInk ?? "#fff" }}>{(m.first[0] || "?").toUpperCase()}</span>
                          <b className="text-[13.5px]">{m.first} {m.last}</b>
                        </div>
                        {m.bio && <p className="mt-2 text-[12.5px] leading-[1.55]" style={{ color: MUTs }}>{m.bio}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        <div className={`mt-8 ${full ? "grid items-start gap-7 lg:grid-cols-[1fr_360px]" : ""}`}>
          <div className="flex flex-col gap-6">
            {d.description && <div><div className="text-[12px] font-extrabold uppercase tracking-[0.14em]" style={{ color: ACCT }}>{headingOf(d, "about", "title")}</div><p className="mt-1.5 text-[13.5px] leading-[1.65]" style={{ color: BODYC }}>{d.description}</p></div>}
            {!full && <div id="aos-book">{widget}</div>}
            {d.sections.some((s) => s.text) && <SportSec eye={headingOf(d, "about", "eyebrow")} title={headingOf(d, "about", "title")}>{d.sections.filter((s) => s.text).map((s) => <div key={s.id} className="mb-3 last:mb-0"><div className="text-[10.5px] font-bold uppercase tracking-[0.1em]" style={{ color: CY }}>{s.type}</div><p className="mt-1 text-[14px] leading-[1.6]" style={{ color: BODYC }}>{s.text}</p></div>)}</SportSec>}
            {d.outcomes.length > 0 && <SportSec eye={headingOf(d, "learn", "eyebrow")} title={headingOf(d, "learn", "title")}><div className={`grid gap-2 ${grid2}`}>{d.outcomes.map((o, i) => <SportRow key={o}><span className={`w-6 font-black ${cond}`} style={{ color: CY }}>{String(i + 1).padStart(2, "0")}</span>{optionLabel(o)}</SportRow>)}</div></SportSec>}
            {d.provided.length > 0 && <SportSec eye={headingOf(d, "included", "eyebrow")} title={headingOf(d, "included", "title")}><div className={`grid gap-2 ${grid2}`}>{d.provided.map((o) => <SportRow key={o}><span>{emo(o, "✅")}</span>{optionLabel(o)}</SportRow>)}</div></SportSec>}
            {d.toBring.length > 0 && <SportSec eye={tr("p7pg.pleasePack")} title={tr("p7pg.whatToBring")}><div className={`grid gap-2 ${grid2}`}>{d.toBring.map((o) => <SportRow key={o}><span>{emo(o, "🎒")}</span>{optionLabel(o)}</SportRow>)}</div></SportSec>}
            {d.safety.length > 0 && <SportSec eye={headingOf(d, "safety", "eyebrow")} title={headingOf(d, "safety", "title")}><div className={`grid gap-2 ${grid2}`}>{d.safety.map((o) => <SportRow key={o}><span>{emo(o, "🚑")}</span>{optionLabel(o)}</SportRow>)}</div></SportSec>}
            {d.send.length > 0 && <SportSec eye={headingOf(d, "send", "eyebrow")} title={headingOf(d, "send", "title")}><div className={`grid gap-2 ${grid2}`}>{d.send.map((o) => <SportRow key={o}><span>{emo(o, "♿")}</span>{optionLabel(o)}</SportRow>)}</div></SportSec>}
            {venue && (isOnlineVenue(venue) || venue.address || venue.lat !== undefined || venue.directions || venue.facilities?.length || venue.what3words || venue.transport) && (
              <div className="border-t pt-6" style={{ borderColor: LINEs }}>
                <button type="button" onClick={() => setWhereOpen((o) => !o)} className="flex w-full items-center justify-between border px-4 py-3 text-start" style={{ borderColor: LINEs, background: PANEL }}>
                  <span className="flex items-baseline gap-2.5">
                    <span className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: ACCT }}>{whereHead.eyebrow}</span>
                    <span className={`text-[16px] font-black ${cond} text-[color:var(--sp-ink,#fff)]`}>{whereHead.title}</span>
                  </span>
                  <span className="flex h-6 w-6 items-center justify-center text-[16px] font-black" style={{ background: LIME, color: INK }}>{whereOpen ? "–" : "+"}</span>
                </button>
                {whereOpen && (<div className="mt-3">
                <div className="text-[14px] font-black text-[color:var(--sp-ink,#fff)]">{venue.name}</div>
                {isOnlineVenue(venue) ? <div className="mt-0.5 text-[13px]" style={{ color: MUTs }}>{tr("p7pg.runsOnline")}</div> : venue.address && <div className="mt-0.5 text-[13px]" style={{ color: MUTs }}>{venue.address}</div>}
                {!isOnlineVenue(venue) && venue.lat !== undefined && <div className="mt-3"><VenueMap lat={venue.lat} lng={venue.lng} zoom={venue.zoom} height={170} /></div>}
                {!!venue.facilities?.length && (
                  <div className="mt-3 flex flex-wrap gap-1.5">{venue.facilities.map((f) => (
                    <span key={f} className="border px-2.5 py-1 text-[11.5px] font-bold" style={{ borderColor: LINEs, background: PANEL, color: INKT }}>{f}</span>
                  ))}</div>
                )}
                {!isOnlineVenue(venue) && (venue.what3words || venue.transport) && (
                  <div className="mt-3 flex flex-wrap gap-2 text-[12.5px] font-bold">
                    {venue.what3words && (
                      <a href={`https://what3words.com/${encodeURIComponent(venue.what3words.replace(/^\/+/, ""))}`} target="_blank" rel="noreferrer noopener"
                        className="border px-3 py-2" style={{ borderColor: ACCT, color: ACCT }}>{"///"} {venue.what3words.replace(/^\/+/, "")}</a>
                    )}
                    {venue.transport && (
                      <span className="border px-3 py-2" style={{ borderColor: LINEs, background: PANEL, color: INKT }}>🚌 {venue.transport}</span>
                    )}
                  </div>
                )}
                {venue.directions && (
                  <div className="mt-3 border p-3.5" style={{ borderColor: LINEs, background: PANEL }}>
                    <div className="text-[10.5px] font-black uppercase tracking-[0.12em]" style={{ color: ACCT }}>{isOnlineVenue(venue) ? tr("p7pg.howToJoin") : tr("p7pg.gettingThere")}</div>
                    <p className="mt-1 whitespace-pre-line text-[13px] leading-[1.6]" style={{ color: MUTs }}>{venue.directions}</p>
                  </div>
                )}
                </div>)}
              </div>
            )}
            {addons.length > 0 && <SportSec eye={headingOf(d, "addons", "eyebrow")} title={headingOf(d, "addons", "title")}>{addons.map((a, i) => <div key={i} className="mt-2 flex items-center justify-between border px-4 py-3 first:mt-0" style={{ borderColor: LINEs, background: PANEL }}><span className="flex items-center gap-2.5 text-[13.5px] font-bold">{a.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.image} alt="" className="h-8 w-8 flex-none object-cover" />
            ) : a.emoji ? <span className="text-[16px]">{a.emoji}</span> : null}{a.name}</span><span className={`font-black ${cond}`} style={{ color: PRICE }}>{money(a.price)}<span className="ms-1 text-[10.5px] font-semibold normal-case not-italic opacity-70">{a.type === "perday" ? tr("p8lst.ck8PerDay") : tr("p8lst.ck8OneOff")}</span></span></div>)}</SportSec>}
            {d.gallery.length > 0 && <SportSec eye={headingOf(d, "gallery", "eyebrow")} title={headingOf(d, "gallery", "title")}><div className={`grid gap-2 ${full ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>{d.gallery.map((im, i) => <CroppedImage key={i} im={im} style={{ aspectRatio: "1 / 1" }} />)}</div></SportSec>}
          </div>
          {full && <div id="aos-book" className="self-start lg:sticky lg:top-4">{widget}</div>}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t px-6 py-5 text-[12px]" style={{ borderColor: LINEs, color: MUTs }}>
        <span className={`font-black ${cond} text-[color:var(--sp-ink,#fff)]`}>{brand}</span>
        <span>{tr("p7pg.poweredBy")}</span>
      </div>
    </div>
  );
}

// ── Small shared bits ──────────────────────────────────────────────────────
function StepHead({ kicker, title, lede }: { n?: number; kicker: string; title: string; lede: string }) {
  return (
    <div className="mb-2.5 text-center">
      <div className="inline-flex items-center rounded-full px-2.5 py-[2px] text-[9px] font-extrabold uppercase tracking-[0.12em] text-white shadow-sm" style={{ background: "linear-gradient(120deg,#16306e,#3f78d8)" }}>{kicker.replace(/^STEP\s+\d+\s*·\s*/i, "")}</div>
      <h3 className="mt-1 text-[19px] font-extrabold leading-[1.1] tracking-[-0.03em]" style={{ fontFamily: "var(--ff-display)", background: "linear-gradient(115deg,#16306e 10%,#3f78d8 60%,#6aa0ee)", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent", color: "transparent" }}>{title}</h3>
      <p className="mx-auto mt-0.5 max-w-[600px] text-[11.5px] leading-[1.45] text-[var(--ink-2)]">{lede}</p>
    </div>
  );
}
/**
 * Starts a band within the step's card. The rule and the icon are what stop a
 * long step reading as one undifferentiated wall of fields.
 */
function SectionHead({ children, icon }: { children: React.ReactNode; icon?: string }) {
  return (
    <div className="mb-1.5 mt-3 flex items-center gap-2 first:mt-0">
      {icon && <span className="flex h-6 w-6 flex-none items-center justify-center rounded-lg text-[12px] text-white shadow-[0_2px_6px_rgba(31,84,163,.3)]" style={{ background: "linear-gradient(135deg,#3f78d8,#16306e)" }}>{icon}</span>}
      <div className="text-[12.5px] font-extrabold tracking-[-0.01em] text-[#16306e]">{children}</div>
      <div className="ms-1 h-px flex-1 rounded-full" style={{ background: "linear-gradient(90deg,var(--brand-line,#cdddf7),transparent)" }} />
    </div>
  );
}
function YesNo({ label, value, onChange, help }: { label: string; value: boolean; onChange: (v: boolean) => void; help?: string }) {
  const tr = useT();
  return (
    <div>
      <div className="text-[12.5px] font-semibold">{label}</div>
      <div className="mt-1 flex gap-1.5">
        {[[tr("p8lst.wbYes"), true], [tr("p8lst.wbNo"), false]].map(([l, v]) => (
          <button key={l as string} type="button" onClick={() => onChange(v as boolean)} className="rounded-full border px-3 py-1 text-[11.5px] font-bold" style={value === v ? { borderColor: "var(--brand-2)", background: "var(--brand-soft)", color: "var(--brand-ink)" } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>{l as string}</button>
        ))}
      </div>
      {help && <div className="mt-1 text-[11px] text-[var(--ink-3)]">{help}</div>}
    </div>
  );
}

/** "✓ Recognised: Camden, London" / "✗ We can't find that postcode" under a postcode as the provider types (debounced; asks the server). */
function PostcodeRecognised({ value }: { value: string }) {
  const tr = useT();
  const [state, setState] = useState<{ q: string; ok: boolean; place: string } | "checking" | null>(null);
  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) { setState(null); return; }
    setState("checking");
    let alive = true;
    const id = setTimeout(() => {
      apiGet<{ ok: boolean; postcode: string; place?: string }>(`/api/geo/recognise?q=${encodeURIComponent(q)}`)
        .then((r) => { if (r.ok) badPostcodes.delete(pcKey(q)); else badPostcodes.add(pcKey(q)); if (typeof window !== "undefined") window.dispatchEvent(new Event("hv-pc-verdict")); if (alive) setState({ q, ok: r.ok, place: [r.postcode, r.place].filter(Boolean).join(" · ") }); })
        .catch(() => alive && setState(null));
    }, 500);
    return () => { alive = false; clearTimeout(id); };
  }, [value]);
  if (!state) return null;
  if (state === "checking") return <div className="mb-1 text-[11.5px] text-[var(--ink-3)]">{tr("p8lst.pcChecking")}</div>;
  return <div className="mb-1 text-[11.5px] font-bold" style={{ color: state.ok ? "#0f7a43" : "#c02636" }}>{state.ok ? tr("p8lst.pcRecognised", { place: state.place }) : tr("p8lst.pcNotFound")}</div>;
}

/** The comma-separated list of areas the provider travels to. Keeps what is TYPED (so a comma stays put) and hands the cleaned list up;
 *  each entry gets its own recognised / not-found line. */
function PostcodeListInput({ prefixes, onChange, placeholder }: { prefixes: string[]; onChange: (list: string[]) => void; placeholder: string }) {
  const [text, setText] = useState(prefixes.join(", "));
  const list = text.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  return (
    <>
      <Input
        value={text}
        onChange={(e) => { setText(e.target.value); onChange(e.target.value.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean)); }}
        placeholder={placeholder}
        className="mb-1 w-full max-w-[360px]"
      />
      {[...new Set(list)].slice(0, 8).map((p) => <PostcodeRecognised key={p} value={p} />)}
    </>
  );
}
