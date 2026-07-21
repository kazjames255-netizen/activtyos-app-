"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api, get as apiGet, post as apiPost } from "@/lib/api";
import { firebaseAuth } from "@/lib/firebase/client";
import { money } from "@/features/bookings/helpers";
import { Button, Card, FieldLabel, Input, Select } from "@/components/ui";
import type { AddonQuestion, AddonTemplate, LocalState, StaffMember, Venue } from "./FreelancerListingsApp";
import { VenueMap } from "./VenueMap";
import * as blocksApi from "@/features/blocks/blocksApi";
import { uid, to12h, pHours, toggle, genDates, fmtDate, groupWeeks } from "./format";
import { useBooking, useOpensAt, type BasketItem } from "./booking";
import { LOW_LEFT, blockOn, capacityNote } from "./capacity";
import { useTenantSettings, useSettings } from "@/lib/settings";
import { policyWording, type NamedPolicy } from "@/lib/cancellation";
import { CheckoutPanel } from "./checkout";
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

const LAYOUTS = [
  { key: "big", label: "One big image · 1600×900px" },
  { key: "wide", label: "Wide banner · 1920×640px" },
  { key: "collage", label: "Collage (2×2) · 800×800px each" },
  { key: "thumbs", label: "Big + thumbnails · 1600×900px" },
];
const SECTION_TYPES = ["Summary", "What we'll do", "When you arrive", "Our curriculum"];
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
// "How parents can book each pass" — options + descriptions from the manual.
const BOOK_RULES: [BookRule, (days: number) => string][] = [
  ["week", (d) => `Any ${d} days in one week`],
  ["listing", (d) => `Any ${d} days across the listing`],
  ["blocks", (d) => `Fixed ${d}-day block`],
];
export type BookRule = "week" | "listing" | "blocks";
const bookRuleDesc = (rule: BookRule, days: number) =>
  rule === "listing" ? `Parents pick any ${days} days across all the weeks it runs.`
    : rule === "blocks" ? `Sold as one fixed ${days}-day block.`
      : `Parents pick any ${days} days within a single week.`;

function who() {
  return firebaseAuth.currentUser?.uid || firebaseAuth.currentUser?.email || "anon";
}

// ── Blocks builder data (read-only, from localStorage) ─────────────────────
interface BPeriod { id: string; title: string; start: string; finish: string }
interface BPass { id: string; name: string; days: number }
interface BBlock {
  id: string; name: string; periodIds: string[]; passIds: string[];
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
}
const EMPTY_BLOCKS: BlocksStore = { periods: [], passes: [], library: [], resolved: {}, loading: true, error: null };

// Blocks live on the server (see features/blocks/blocksApi.ts). The server also
// resolves pricing, so we keep `resolved` and prefer it over local arithmetic.
async function fetchBlocks(): Promise<BlocksStore> {
  const [periods, passes, bundles] = await Promise.all([
    blocksApi.listPeriods(),
    blocksApi.listPasses(),
    blocksApi.listBundles(),
  ]);
  return {
    periods,
    passes,
    library: bundles.map((b) => ({
      id: b.id,
      name: b.name,
      periodIds: b.periodIds,
      passIds: b.passIds,
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
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const s = await fetchBlocks();
        if (alive) setStore(s);
      } catch (e) {
        // Surface it — "no blocks" and "couldn't fetch blocks" look identical
        // in the ticket picker otherwise.
        if (alive)
          setStore({ ...EMPTY_BLOCKS, loading: false, error: e instanceof Error ? e.message : "Couldn’t load your blocks." });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  return store;
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
export interface BookPass { id: string; name: string; days: number; basePrice: number }
export interface BookPeriod { id: string; title: string; start: string; finish: string; range: string }
export type RunBlock = { id: string; name: string; startDate: string; endDate: string; capacity: number; spotsLeft: number; open: boolean };

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
export function isOnlineVenue(v: { kind?: string } | null | undefined): boolean {
  return v?.kind === "online";
}

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
interface TicketOverride { ageFrom?: string; ageTo?: string; capacity?: string }
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
  /**
   * Per-listing age-band overrides, keyed by group id: this camp runs that
   * group over `{from,to}` instead of the master band in settings. Only used
   * when the tenant setting `allowListingAgeRange` is on; the master group is
   * never touched. Enforcement/grouping that respects these is backend (§S).
   */
  ageRanges?: Record<string, { from: number; to: number }>;
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
  safety: string[];
  send: string[];
  runFrom: string;
  runTo: string;
  blockMode: "weekly" | "custom";
  days: number[];
  datesOff: string[];
  blockId: string | null;
  ticketOverrides: Record<string, TicketOverride>;
  bookRules: Record<string, BookRule>;
  addonIds: string[];
  staffIds: string[];
  visibility: "public" | "hidden";
  opensAt?: string;              // local datetime; blank = open now
  bookingType: "auto" | "manual";
  waitlist: boolean;
  waitlistSize: string;
  /** Who decides when a place frees up — see step 11. */
  waitlistMode?: "manual" | "auto";
  cancellation: string;
  /** Which named policy this listing uses — see lib/cancellation.ts. */
  cancellationPolicyId?: string;
  discounts?: DiscountRule[];
  status: "draft" | "live";
  archived?: boolean;
  pageStyle?: PageTheme;
}
export type PageTheme = "playful" | "sport" | "navy";

// ── Automatic discounts ────────────────────────────────────────────────────
// The engine lives in ./discounts — shared verbatim with the server, which
// prices every parent booking with it. Re-exported so existing imports hold.
export { applyDiscounts, emptyRule, ruleSummary } from "./discounts";
export type { DiscountKind, DiscountLine, DiscountRule } from "./discounts";
import { emptyRule, ruleSummary, type DiscountKind, type DiscountRule } from "./discounts";

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
export const WHERE_HEAD_DEFAULT = { eyebrow: "Where is it", title: "Location" };
/** The venue section's heading. Lives on the operator's library, not the listing — the same venue reads the same on every listing. */
export function whereHeading(local: LocalState): { eyebrow: string; title: string } {
  return {
    eyebrow: local.whereHeading?.eyebrow?.trim() || WHERE_HEAD_DEFAULT.eyebrow,
    title: local.whereHeading?.title?.trim() || WHERE_HEAD_DEFAULT.title,
  };
}

/** Heading for a section — the operator's wording if set, else the default. */
export function headingOf(d: WizardDraft, key: string, field: "eyebrow" | "title"): string {
  const def = SECTION_KEYS.find((s) => s.key === key);
  const custom = d.headings?.[`${key}.${field}`]?.trim();
  if (custom) return custom;
  if (key === "about" && field === "title" && d.descriptionSection.trim()) return d.descriptionSection.trim();
  return def ? def[field] : "";
}

/**
 * What has to be true before a listing can be published. Each blocker names the
 * step that fixes it — "something's missing" without saying what is worse than
 * no check at all.
 */
export function publishBlockers(d: WizardDraft, ticketCount: number): { step: number; what: string }[] {
  // Referenced by key, not index — the steps get reordered and a stale number
  // would send someone to the wrong screen without failing.
  const at = (key: string) => Math.max(0, STEPS.findIndex((x) => x.key === key));
  const out: { step: number; what: string }[] = [];
  if (!d.title.trim()) out.push({ step: at("basics"), what: "Give the listing a name" });
  if (!d.venueId) out.push({ step: at("basics"), what: "Choose where it runs (or pick your online option)" });
  if (!d.runFrom || !d.runTo) out.push({ step: at("run"), what: "Set the dates it runs between" });
  else if (d.runTo < d.runFrom) out.push({ step: at("run"), what: "The end date is before the start date" });
  else if (!genDates(d.runFrom, d.runTo, d.days).filter((x) => !(d.datesOff ?? []).includes(x)).length) {
    // The trap: a range that only covers days the operator has unticked.
    out.push({ step: at("run"), what: "Those dates don't include any running days — check which weekdays are ticked" });
  }
  if (!d.blockId) out.push({ step: at("tickets"), what: "Pick a block so the listing has passes and prices" });
  else if (ticketCount === 0) out.push({ step: at("tickets"), what: "That block has no passes — add some in the Blocks area" });
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
}): WizardDraft {
  const firstLive = (defaults?.cancellationPolicies ?? [])[0];
  return {
    id: null, title: "", images: [], gallery: [], layout: "big", ageFrom: "", ageTo: "",
    categoryIds: [], venueId: null, allowOutOfRange: false, maxAttendees: String(defaults?.defaultCapacity ?? 60), capacityScope: "listing", showSpaces: defaults?.showSpaces ?? true,
    descriptionSection: "Summary", description: "", sections: [], outcomes: [], provided: [], safety: [], send: [],
    runFrom: "", runTo: "", blockMode: "weekly", days: defaults?.defaultRunningDays ?? [1, 2, 3, 4, 5], datesOff: [], blockId: null,
    ticketOverrides: {}, bookRules: {}, addonIds: [], staffIds: [], visibility: "public", bookingType: "auto", waitlist: true, waitlistSize: "20", waitlistMode: "manual",
    // The first policy still in use — a new listing must never start on one
    // the provider has switched off.
    cancellation: firstLive ? policyWording({ ...firstLive, wording: undefined }) : CANCELLATION_POLICIES[3],
    cancellationPolicyId: firstLive?.id, discounts: [], status: "draft", pageStyle: "playful",
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
  const dates = genDates(draft.runFrom, draft.runTo, draft.days).filter((x) => !(draft.datesOff || []).includes(x));
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
  return genDates(draft.runFrom, draft.runTo, draft.days).includes(iso) && !(draft.datesOff || []).includes(iso);
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
  passes: { name: string; price: number; days?: number }[];
  blocks?: { id: string; name: string; startDate: string; endDate: string; capacity: number; spotsLeft: number; open: boolean }[];
  bundle?: {
    id: string;
    name: string;
    passes: { id: string; name: string; days: number; price: number }[];
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
  };
}

/** Booking model from the server's resolved bundle (parents can't read the
 * operator blocks-builder endpoints — /:id embeds everything they need). */
export function bookingFromBundle(bundle: ServerListing["bundle"]): BlockBooking | null {
  if (!bundle || !bundle.passes.length) return null;
  const passes: BookPass[] = bundle.passes.map((p) => ({ id: p.id, name: p.name, days: p.days, basePrice: p.price }));
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

/** The customer page a PARENT sees — rendered purely from the API's
 * GET /api/listings/:id response, so it is pixel-for-pixel the operator's
 * "Preview as a parent" (same ParentPreview component, same data shape). */
export function CustomerPage({ listing }: { listing: ServerListing }) {
  const d = draftFromListing(listing);
  const [bookState, setBookState] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });
  const [done, setDone] = useState<{ refs: string[]; total: number } | null>(null);
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
  async function book(basket: BasketItem[], dayAssign: Record<string, Record<string, string[]>>, addonSel: Record<string, Record<string, string[]>>, method: string, children: ChildProfile[] = [], addonAns: Record<string, Record<string, string>> = {}, voucherScheme?: string) {
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
      type Line = { blockId: string; pass: string; dates: string[]; child: string; itemId: string; periodId?: string };
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
          if (!blk) throw new Error("Those dates aren't open for booking any more.");
          lines.push({ blockId: blk.id, pass: item.name, dates, child, itemId: item.id, periodId: item.periodId });
        }
      }
      if (!lines.length) throw new Error("Nobody is on any of these days yet.");
      const byBlock = new Map<string, Line[]>();
      for (const l of lines) byBlock.set(l.blockId, [...(byBlock.get(l.blockId) ?? []), l]);
      const refs: string[] = [];
      let total = 0;
      for (const [blockId, items] of byBlock) {
        const res = await apiPost<{ bookings: { ref: string }[]; total: number }>("/api/my/bookings", {
          listingId: listing.id,
          blockId,
          method,
          ...(voucherScheme ? { voucherScheme } : {}),
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
            // periodId makes the server price the chosen timing, not the base pass.
            return { pass: l.pass, dates: l.dates, child: l.child, ...(l.periodId ? { periodId: l.periodId } : {}), ...(addons.length ? { addons } : {}) };
          }),
        });
        refs.push(...res.bookings.map((x) => x.ref));
        total += res.total;
      }
      setDone({ refs, total });
    } catch (e) {
      setBookState({ busy: false, error: e instanceof Error ? e.message : "Booking failed" });
      return;
    }
    setBookState({ busy: false, error: null });
  }

  if (done)
    return (
      <div className="mx-auto max-w-[520px] p-6 text-center">
        <div className="text-[40px]">🎉</div>
        <h2 className="mt-2 text-[22px] font-extrabold">You&rsquo;re booked in</h2>
        <p className="mt-1.5 text-[13.5px] text-[var(--ink-3)]">
          {done.refs.length === 1 ? "Reference" : "References"} {done.refs.join(", ")} · {money(done.total)} paid.
          A confirmation email is on its way.
        </p>
      </div>
    );

  return (
    <ParentPreview
      d={d}
      venue={lib?.venue ?? null}
      local={local}
      booking={bookingFromBundle(listing.bundle)}
      blocks={listing.blocks}
      addons={lib?.addons ?? []}
      theme={d.pageStyle ?? "playful"}
      brand={listing.tenantName}
      tenantId={listing.tenantId}
      mode="parent"
      bookState={bookState}
      onBook={(p) => void book(p.basket, p.dayAssign, p.addonSel, p.method, p.children, p.addonAns, p.voucherScheme)}
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
export function BookingOnly({ listing, onBook, bookState }: {
  listing: ServerListing;
  onBook?: (p: { method: string; voucherScheme?: string; basket: BasketItem[]; addonSel: Record<string, Record<string, string[]>>; addonAns: Record<string, Record<string, string>>; children: ChildProfile[]; dayAssign: Record<string, Record<string, string[]>> }) => void;
  bookState?: { busy: boolean; error: string | null };
}) {
  const d = draftFromListing(listing);
  const lib = listing.library;
  const dates = genDates(d.runFrom, d.runTo, d.days);
  const capParsed = parseInt(d.maxAttendees, 10);
  return (
    <BookingWidget
      d={d}
      booking={bookingFromBundle(listing.bundle)}
      weeks={groupWeeks(dates)}
      spacesLeft={d.showSpaces && Number.isFinite(capParsed) ? capParsed : null}
      addons={(lib?.addons ?? []).filter((a) => d.addonIds.includes(a.id))}
      blocks={listing.blocks}
      mode="operator"
      onBook={onBook}
      bookState={bookState}
      theme={d.pageStyle ?? "playful"}
    />
  );
}

// Standalone customer-page preview (for the "View" action on the Listings tab).
export function ListingPreview({ draft, local, runs }: { draft: WizardDraft; local: LocalState; runs?: RunBlock[] }) {
  const blocks = useBlocks();
  const [theme, setTheme] = useState<PageTheme>(draft.pageStyle ?? "playful");
  const norm = (arr: unknown) => ((arr as (string | ListingImage)[]) || []).map((im) => (typeof im === "string" ? { src: im, x: 50, y: 50, zoom: 100 } : im));
  const d2 = { ...draft, images: norm(draft.images), gallery: norm(draft.gallery), bookRules: draft.bookRules ?? {}, ticketOverrides: draft.ticketOverrides ?? {} };
  const venue = local.venues.find((v) => v.id === draft.venueId) || null;
  const booking = blockBooking(blocks, draft.blockId);
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
const WEEK_PAL = ["#1d3a8f", "#2f6bd8", "#15b364", "#f5b81f", "#e22295", "#6a4fd0", "#0ea5e9", "#f97316"];

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
  const [d, setD] = useState<WizardDraft>(() => {
    const norm = (arr: unknown) =>
      ((arr as (string | ListingImage)[]) || []).map((im) => (typeof im === "string" ? { src: im, x: 50, y: 50, zoom: 100 } : im));
    return { ...initial, images: norm(initial.images), gallery: norm(initial.gallery), bookRules: initial.bookRules ?? {}, ticketOverrides: initial.ticketOverrides ?? {} };
  });
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [fullPreview, setFullPreview] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "dirty" | "saving" | "saved" | "error">("idle");
  const blocks = useBlocks();
  const upd = (patch: Partial<WizardDraft>) => setD((p) => ({ ...p, ...patch }));
  const tickets = useMemo(() => blockTickets(blocks, d.blockId), [blocks, d.blockId]);
  const booking = useMemo(() => blockBooking(blocks, d.blockId), [blocks, d.blockId]);
  const venue = local.venues.find((v) => v.id === d.venueId) || null;
  const addons = local.addons.filter((a) => d.addonIds.includes(a.id));

  useEffect(() => { saveDraft(wizardKey, d); }, [d, wizardKey]);

  async function syncApi(status: "draft" | "live", quiet = false): Promise<boolean> {
    if (!quiet) setBusy(true);
    setMsg(null);
    try {
      const passes = tickets.length ? tickets.map((t) => ({ name: t.name, price: t.price })) : [{ name: "Standard", price: 0 }];
      // Images go to POST /api/uploads first — the listing doc stores URLs
      // only (the server rejects data URLs; Firestore caps docs at 1MB).
      const images = await uploadImages(d.images);
      const gallery = await uploadImages(d.gallery);
      // The WHOLE draft persists server-side — the listing doc IS the draft,
      // so the customer page renders identically on any machine.
      const { id: draftId, ...draftBody } = { ...d, images, gallery };
      const body = { ...draftBody, status, name: d.title.trim() || "Untitled listing", passes };
      let id = draftId;
      if (id) await api(`/api/listings/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(body) });
      else id = (await apiPost<{ id: string }>("/api/listings", body)).id;
      const next = { ...d, images, gallery, id, status };
      setD(next);
      saveDraft(id!, next);
      if (!quiet) setBusy(false);
      return true;
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
      if (!quiet) setBusy(false);
      return false;
    }
  }
  // The builder used to reach the server only when someone pressed Save draft
  // or Publish, while autosaving to localStorage on every keystroke — so the
  // screen looked saved, the customer page disagreed, and nothing said which
  // was right. Now every edit reaches the server, and the header says so.
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!dirtyRef.current) { dirtyRef.current = true; return; } // skip the first render
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

  const saveDraftAction = async () => { if (await syncApi("draft")) { setSaveState("saved"); onSaved(); } };
  const blockers = publishBlockers(d, tickets.length);
  const publishAction = async () => {
    if (blockers.length) {
      // Send them to the first thing that's missing rather than making them hunt.
      setStep(blockers[0].step);
      setMsg(`${blockers.length} thing${blockers.length === 1 ? "" : "s"} to finish before this can be published`);
      return;
    }
    if (await syncApi("live")) { onSaved(); onClose(); }
  };

  const previewProps = { d, venue, local, booking, addons, theme: d.pageStyle ?? "playful", onTheme: (t: PageTheme) => upd({ pageStyle: t }) };
  const stepKey = STEPS[step].key;

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-[var(--bg,#f5f8fd)] text-[var(--ink)]"
      style={{ ["--bg" as string]: "#f5f8fd", ["--surface" as string]: "#fff", ["--panel" as string]: "#fbf8fc", ["--ink" as string]: "#171534", ["--ink-2" as string]: "#4a4763", ["--ink-3" as string]: "#8a86a3", ["--line" as string]: "#ece6f1" } as React.CSSProperties}>
      {/* Header + progress stick; everything else scrolls with the page. */}
      <div className="sticky top-0 z-30">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] bg-[var(--surface)] px-5 py-3">
        <div>
          <div className="text-[16px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{d.id ? "Edit listing" : "Create listing"}</div>
          <div className="text-[11.5px] text-[var(--ink-3)]">Listing → Tickets · tickets are the bookable products</div>
        </div>
        <div className="flex items-center gap-1.5">
          {msg && <span className="mr-1 text-[12px] text-[var(--red)]">{msg}</span>}
          {(() => {
            const label = { idle: "", dirty: "Unsaved changes", saving: "Saving…", saved: "Saved", error: "Couldn't save" }[saveState];
            if (!label) return null;
            const col = saveState === "error" ? "var(--red)" : saveState === "saved" ? "#0f7a44" : "var(--ink-3)";
            return <span className="mr-1 text-[11.5px] font-semibold" style={{ color: col }}>{saveState === "saved" ? "✓ " : ""}{label}</span>;
          })()}
          <Button sm disabled={busy} onClick={saveDraftAction}>Save draft</Button>
          <Button sm variant="cta" onClick={() => setFullPreview(true)}>👁 Preview as a parent</Button>
          <Button sm variant="primary" disabled={busy} onClick={publishAction} title={blockers.length ? `${blockers.length} thing${blockers.length === 1 ? "" : "s"} left to do` : undefined}>Publish{blockers.length > 0 && <span className="ml-1 opacity-80">({blockers.length})</span>}</Button>
          <button type="button" onClick={onClose} aria-label="Close" className="ml-1 text-[20px] leading-none text-[var(--ink-3)]">×</button>
        </div>
      </div>

      {/* Progress ring + what's left, always in view — eleven screens of fields
          with no sense of distance travelled is what made this a slog. */}
      <div className="flex flex-wrap items-center gap-4 border-b border-[var(--line)] bg-[var(--panel)] px-5 py-3">
        {(() => {
          const pct = Math.round(((step + 1) / STEPS.length) * 100);
          const r = 15.5, circ = 2 * Math.PI * r;
          return (
            <div className="flex items-center gap-3">
              <svg width="46" height="46" viewBox="0 0 36 36" className="flex-none">
                <circle cx="18" cy="18" r={r} fill="none" stroke="var(--line)" strokeWidth="4" />
                <circle cx="18" cy="18" r={r} fill="none" stroke="var(--brand)" strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={`${(circ * pct) / 100} ${circ}`} transform="rotate(-90 18 18)" />
                <text x="18" y="21" textAnchor="middle" fontSize="9" fontWeight="800" fill="var(--ink)">{pct}%</text>
              </svg>
              <div>
                <div className="text-[13px] font-extrabold leading-tight">{STEPS[step].label}</div>
                <div className="text-[11.5px] text-[var(--ink-3)]">Step {step + 1} of {STEPS.length} · {STEPS[step].stage}</div>
              </div>
            </div>
          );
        })()}
        {blockers.length > 0 ? (
          <div className="ml-auto max-w-[420px] rounded-xl border px-3 py-2" style={{ borderColor: "#fed7aa", background: "#fff7ed" }}>
            <div className="text-[11px] font-extrabold" style={{ color: "#9a3412" }}>
              {blockers.length} thing{blockers.length === 1 ? "" : "s"} left before you can publish
            </div>
            <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[10.5px]" style={{ color: "#9a3412" }}>
              {blockers.slice(0, 3).map((bl, i) => (
                <button key={i} type="button" onClick={() => setStep(bl.step)} className="underline underline-offset-2">{bl.what}</button>
              ))}
              {blockers.length > 3 && <span>+{blockers.length - 3} more</span>}
            </div>
          </div>
        ) : (
          <div className="ml-auto rounded-xl px-3 py-2 text-[11.5px] font-bold" style={{ background: "var(--green-soft,#e7f8ee)", color: "#0f7a44" }}>
            ✓ Everything&rsquo;s ready to publish
          </div>
        )}
      </div>
      </div>

      <div className="flex">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap gap-1 border-b border-[var(--line)] bg-[var(--surface)] px-3 py-2">
            {STEPS.map((s, i) => (
              <button key={s.key} type="button" onClick={() => setStep(i)}
                className="rounded-full px-2.5 py-1 text-[11.5px] font-bold transition-colors"
                style={i === step ? { background: "var(--brand)", color: "#fff" } : { color: "var(--ink-3)" }}>
                {i + 1} {s.label}
              </button>
            ))}
          </div>

          <div className="flex-1 bg-[var(--surface)] px-5 py-7">
            <div className={stepKey === "preview"
              ? "mx-auto w-full"
              : "mx-auto w-full max-w-[660px] rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-6 shadow-[0_1px_2px_rgba(16,35,86,.05)]"}>
            {stepKey === "basics" && <BasicsStep d={d} upd={upd} local={local} patchLocal={patchLocal} />}
            {stepKey === "content" && <ContentStep d={d} upd={upd} local={local} patchLocal={patchLocal} />}
            {stepKey === "provided" && <ChipStep headings={<HeadingFields d={d} upd={upd} sectionKey="included" />} n={3} kicker="STEP 3 · PROVIDED" title="What is provided" lede="Tick everything included — this shows on the listing." options={local.provided} sel={d.provided} emojis={local.emojis} onToggle={(v) => upd({ provided: toggle(d.provided, v) })} onAdd={(name, emoji) => { patchLocal((s) => ({ ...s, provided: [...s.provided, name], emojis: { ...s.emojis, [name]: emoji } })); upd({ provided: [...d.provided, name] }); }} onDelete={(v) => { patchLocal((s) => ({ ...s, provided: s.provided.filter((x) => x !== v) })); upd({ provided: d.provided.filter((x) => x !== v) }); }} />}
            {stepKey === "safety" && <SafetyStep d={d} upd={upd} local={local} patchLocal={patchLocal} />}
            {stepKey === "run" && <RunStep d={d} upd={upd} />}
            {stepKey === "tickets" && <TicketsStep d={d} upd={upd} blocks={blocks} tickets={tickets} />}
            {stepKey === "discounts" && <DiscountsStep d={d} upd={upd} tickets={tickets} />}
            {stepKey === "preview" && <div><StepHead n={10} kicker="STEP 10 · PREVIEW" title="Preview" lede="Exactly what parents see — the full customer page." /><HeadingsEditor d={d} upd={upd} /><ParentPreview {...previewProps} full /></div>}
            {stepKey === "addons" && <AddonsStep d={d} upd={upd} local={local} patchLocal={patchLocal} />}
            {stepKey === "staff" && <StaffStep d={d} upd={upd} local={local} patchLocal={patchLocal} />}
            {stepKey === "policy" && (
              <>
                {blockers.length > 0 && (
                  <div className="mb-3 max-w-[720px] rounded-xl border p-3.5" style={{ borderColor: "#fed7aa", background: "#fff7ed" }}>
                    <div className="text-[12.5px] font-extrabold" style={{ color: "#9a3412" }}>
                      Before this can be published ({blockers.length})
                    </div>
                    <ul className="mt-1.5 flex flex-col gap-1">
                      {blockers.map((bl, i) => (
                        <li key={i} className="flex items-start gap-2 text-[12px]" style={{ color: "#9a3412" }}>
                          <span className="mt-[2px]">•</span>
                          <button type="button" onClick={() => setStep(bl.step)} className="text-left underline underline-offset-2">
                            {bl.what} <span className="opacity-70">— step {bl.step + 1}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 text-[11px]" style={{ color: "#9a3412" }}>
                      You can still <b>Save draft</b> — it stays unpublished until these are done.
                    </div>
                  </div>
                )}
                <PolicyStep d={d} upd={upd} />
              </>
            )}
            </div>
          </div>

          <div className="sticky bottom-0 z-20 flex items-center justify-center gap-3 border-t border-[var(--line)] bg-[var(--surface)] px-5 py-3.5">
            <Button disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>‹ Back</Button>
            {step < STEPS.length - 1 ? (
              <Button variant="primary" onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>Next ›</Button>
            ) : (
              <Button variant="primary" disabled={busy || blockers.length > 0} onClick={publishAction}>
                {blockers.length ? `${blockers.length} thing${blockers.length === 1 ? "" : "s"} to finish` : "Publish"}
              </Button>
            )}
          </div>
        </div>

        <div className="hidden w-[340px] flex-none self-start border-l border-[var(--line)] bg-[var(--panel)] p-4 lg:sticky lg:top-[112px] lg:block">
          <div className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">↘ Customer page · exactly what parents see</div>
          <ParentPreview {...previewProps} />
        </div>
      </div>

      {fullPreview && (
        <div onClick={(e) => e.target === e.currentTarget && setFullPreview(false)}
          className="fixed inset-0 z-[10000] flex items-start justify-center overflow-auto bg-black/60 p-4 sm:p-6">
          <div className="w-full max-w-[1040px]">
            <div className="mb-2 flex items-center justify-between text-white">
              <span className="text-[13px] font-bold">Customer view — {venue?.name || "your listing"}</span>
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
          <span key={o} className="inline-flex items-center overflow-hidden rounded-full border" style={on ? { borderColor: "var(--brand-2)", background: "var(--brand-soft)" } : { borderColor: "var(--line)" }}>
            <button type="button" onClick={() => onToggle(o)} className="py-1.5 pl-3 text-[12px] font-bold" style={{ color: on ? "var(--brand-ink)" : "var(--ink-3)" }}>{on && check ? "✓ " : ""}{em ? em + " " : ""}{o}</button>
            {onDelete && <button type="button" onClick={() => onDelete(o)} aria-label={`Delete ${o}`} className="px-2 text-[11px] text-[var(--ink-3)] hover:text-[var(--red)]">✕</button>}
            {!onDelete && <span className="pr-3" />}
          </span>
        );
      })}
      {adding ? (
        <span className="relative inline-flex items-center gap-1">
          <button type="button" onClick={() => setPicker((p) => !p)} title="Pick an emoji" className="flex h-[30px] w-[34px] items-center justify-center rounded-lg border border-[var(--line)] text-[16px]">{emoji}</button>
          <Input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="New option" className="w-[150px]" autoFocus />
          <Button sm variant="primary" onClick={add}>Add</Button>
          {picker && (
            <div className="absolute left-0 top-[36px] z-20 max-h-[190px] w-[248px] overflow-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2 shadow-[0_12px_30px_rgba(0,0,0,.18)]">
              <div className="grid grid-cols-8 gap-0.5">
                {EMOJI_BANK.map((e, i) => <button key={i} type="button" onClick={() => { setEmoji(e); setPicker(false); }} className="flex h-6 w-6 items-center justify-center rounded text-[15px] hover:bg-[var(--panel)]">{e}</button>)}
              </div>
            </div>
          )}
        </span>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="rounded-full border border-dashed border-[var(--line)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-3)]">＋ Add option</button>
      )}
    </div>
  );
}

function ChipStep({ n, kicker, title, lede, options, sel, onToggle, onAdd, onDelete, emojis, headings }: { n: number; kicker: string; title: string; lede: string; options: string[]; sel: string[]; onToggle: (v: string) => void; onAdd: (v: string, emoji: string) => void; onDelete: (v: string) => void; emojis: Record<string, string>; headings?: React.ReactNode }) {
  return (
    <div className="max-w-[720px]">
      <StepHead n={n} kicker={kicker} title={title} lede={lede} />
      {headings}
      <EditableChips options={options} sel={sel} onToggle={onToggle} onAdd={onAdd} onDelete={onDelete} emojis={emojis} showEmoji check />
      <div className="mt-2 text-[11px] text-[var(--ink-3)]">Add options (pick an emoji), delete with ✕ — saved and offered on every listing.</div>
    </div>
  );
}

// ── Shared image bits ──────────────────────────────────────────────────────
// One renderer used in the editor AND the customer view, so cropping is WYSIWYG.
export function CroppedImage({ im, className, style }: { im: ListingImage; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`overflow-hidden ${className || ""}`} style={style}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={im.src} alt="" className="h-full w-full object-cover" style={{ objectPosition: `${im.x}% ${im.y}%`, transform: `scale(${im.zoom / 100})` }} />
    </div>
  );
}

function ImageManager({ images, onChange, addLabel }: { images: ListingImage[]; onChange: (imgs: ListingImage[]) => void; addLabel: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    const add: ListingImage[] = [];
    for (const f of files) { try { add.push({ src: await fileToImage(f), x: 50, y: 50, zoom: 100 }); } catch { /* skip */ } }
    if (add.length) { const start = images.length; onChange([...images, ...add]); setEditIdx(start); }
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
              <div onClick={() => setEditIdx(i)} className="cursor-pointer rounded-lg border" style={{ borderColor: editIdx === i ? "var(--brand-2)" : "var(--line)" }}>
                <CroppedImage im={x} className="h-[64px] w-[96px] rounded-lg" />
              </div>
              <button type="button" onClick={() => { onChange(images.filter((_, j) => j !== i)); setEditIdx(null); }} className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-[10px] text-white">×</button>
            </div>
          ))}
        </div>
      )}
      {im && editIdx !== null && (
        <div className="mb-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12px] font-extrabold">✂ Crop &amp; move — drag the sliders (this is exactly what parents see)</span>
            <Button sm variant="primary" onClick={() => setEditIdx(null)}>Done</Button>
          </div>
          <CroppedImage im={im} className="w-full max-w-[320px] rounded-lg border border-[var(--line)]" style={{ aspectRatio: "16 / 9" }} />
          <div className="mt-2 flex max-w-[320px] flex-col gap-1.5 text-[11.5px] text-[var(--ink-3)]">
            <label className="flex items-center gap-2">Zoom<input type="range" min={100} max={300} value={im.zoom} onChange={(e) => setCrop(editIdx, { zoom: +e.target.value })} className="flex-1" /></label>
            <label className="flex items-center gap-2">Left ⇄ Right<input type="range" min={0} max={100} value={im.x} onChange={(e) => setCrop(editIdx, { x: +e.target.value })} className="flex-1" /></label>
            <label className="flex items-center gap-2">Up ⇅ Down<input type="range" min={0} max={100} value={im.y} onChange={(e) => setCrop(editIdx, { y: +e.target.value })} className="flex-1" /></label>
            <div className="text-[10.5px]">Tip: zoom in first, then Left/Right + Up/Down move the photo inside the frame.</div>
            <Button sm onClick={() => setCrop(editIdx, { x: 50, y: 50, zoom: 100 })}>Reset</Button>
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
  return text.toLowerCase().replace(/[^a-z0-9 &-]/g, " ").split(/\s+/)
    .filter((w) => w.length > 2 && !AI_STOP.has(w) && !seen.has(w) && seen.add(w))
    .slice(0, max);
}
const cap1 = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
function genDescription(prompt: string, section: string, d: WizardDraft, cats: string[], variant: number): string {
  const kws = aiKeywords(prompt);
  const cat = (cats[0] || "activity").toLowerCase();
  const kw = kws.length ? kws.join(", ") : `${cat} sessions`;
  const age = d.ageFrom && d.ageTo ? ` (ages ${d.ageFrom}–${d.ageTo})` : "";
  const sec = section.trim().toLowerCase();
  let arr: string[];
  if (sec.includes("arrive")) arr = [
    `On arrival our team welcome your child, sign them in and settle them fast — calm, friendly drop-off, then straight into ${kw}.`,
    `When you arrive a familiar face meets you at the door: bags away, name badge on, and into the morning's ${kw}.`,
    `The first hour is all about settling in — a warm welcome, a quick register and gentle group games. Think ${kw}.`,
  ];
  else if (sec.includes("curriculum") || sec.includes("learn")) arr = [
    `Our programme builds real skills — ${kw} — through structured, age-appropriate sessions led by qualified coaches.`,
    `Children progress through ${kw}, growing in confidence, teamwork and technique at every single session.`,
    `Every session maps to clear outcomes: ${kw}. Coaches track progress and celebrate each and every win.`,
  ];
  else if (sec.includes("what")) arr = [
    `Each day we dive into ${kw} — games, challenges and team play that keep every child moving and laughing.`,
    `Expect ${kw} and lots more: skills in the morning, team games and free play after lunch, all fully supervised.`,
    `From ${kw} to big group games, every session is planned to be active, inclusive and genuinely fun.`,
  ];
  else arr = [
    `A fun-packed ${cat}${age} — ${kw}. Active, safe and full of new friends. Book early, places go fast!`,
    `Join us${age} for a brilliant week of ${kw}. Expert coaches, big smiles and a safe, welcoming setting throughout.`,
    `${cap1(kw)}${age}. Non-stop fun from drop-off to pick-up, with friendly, qualified staff every step of the way.`,
  ];
  return arr[variant % arr.length].slice(0, 300);
}
function genBio(prompt: string, m: StaffMember, variant: number): string {
  const first = m.first || "They";
  const name = [m.first, m.last].filter(Boolean).join(" ") || "This coach";
  const kws = aiKeywords(prompt, 5);
  const kw = kws.join(", ");
  const arr = [
    `${name} is a friendly, experienced coach who ${kw ? "loves " + kw : "loves getting every child involved"}. DBS-checked and first-aid trained, ${first} makes sure everyone joins in.`,
    `With a real gift for ${kw || "working with children"}, ${name} brings energy and patience to every session — qualified, first-aid trained and endlessly encouraging.`,
    `${name} specialises in ${kw || "fun, inclusive activities"} and is brilliant with first-timers. Safe hands, big smiles, and a coach the children adore.`,
  ];
  return arr[variant % arr.length].slice(0, 300);
}

// ── Step: Basics ───────────────────────────────────────────────────────────
function BasicsStep({ d, upd, local, patchLocal }: { d: WizardDraft; upd: (p: Partial<WizardDraft>) => void; local: LocalState; patchLocal: (fn: (s: LocalState) => LocalState) => void }) {
  return (
    <div className="max-w-[720px]">
      <StepHead n={1} kicker="STEP 1 · BASICS" title="Make a great first impression" lede="A clear name, a hook and a big, bright photo — pick a layout to see how it looks." />
      <FieldLabel>Listing title · up to 70 characters</FieldLabel>
      <Input value={d.title} maxLength={70} onChange={(e) => upd({ title: e.target.value })} placeholder="e.g. Summer Multi-Activity Camp" className="mb-3 w-full" />

      <SectionHead icon="🖼️">Main image</SectionHead>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {LAYOUTS.map((l) => (
          <button key={l.key} type="button" onClick={() => upd({ layout: l.key })} className="rounded-lg border px-2.5 py-1.5 text-[11px] font-bold"
            style={d.layout === l.key ? { borderColor: "var(--brand-2)", background: "var(--brand-soft)", color: "var(--brand-ink)" } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>
            {l.label}
          </button>
        ))}
      </div>
      <div className="mb-1 text-[11px] text-[var(--ink-3)]">Crop each photo to fit — the crop preview matches the customer page exactly. Add more than one and the main image rotates as a carousel.</div>
      <ImageManager images={d.images} onChange={(imgs) => upd({ images: imgs })} addLabel="＋ Add main photo" />

      <SectionHead icon="📸">Gallery</SectionHead>
      <div className="mb-1 text-[11px] text-[var(--ink-3)]">Extra photos — shown as a gallery at the bottom of the customer page.</div>
      <HeadingFields d={d} upd={upd} sectionKey="gallery" />
      <ImageManager images={d.gallery} onChange={(imgs) => upd({ gallery: imgs })} addLabel="＋ Add gallery image" />

      <div className="mb-3 flex gap-3">
        <div className="w-[110px]"><FieldLabel>Age from</FieldLabel><Input type="number" min={0} value={d.ageFrom} onChange={(e) => upd({ ageFrom: e.target.value })} className="w-full" /></div>
        <div className="w-[110px]"><FieldLabel>Age to</FieldLabel><Input type="number" min={0} value={d.ageTo} onChange={(e) => upd({ ageTo: e.target.value })} className="w-full" /></div>
      </div>

      <SectionHead icon="📍">Venue</SectionHead>
      <Select value={d.venueId ?? ""} onChange={(e) => upd({ venueId: e.target.value || null })} className="mb-1 w-full max-w-[360px]">
        <option value="">Select a venue…</option>
        {local.venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
      </Select>
      <div className="mb-3 text-[11px] text-[var(--ink-3)]">Address &amp; map pin are set per venue in the Locations tab — just pick a venue here.</div>

      <SectionHead icon="🏷️">Categories</SectionHead>
      <div className="mb-1 text-[11.5px] text-[var(--ink-3)]">Choose what describes your listing — manage the options in the Categories tab.</div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {local.categories.map((c) => (
          <button key={c.id} type="button" onClick={() => upd({ categoryIds: toggle(d.categoryIds, c.id) })} className="rounded-full border px-3 py-1.5 text-[12px] font-bold"
            style={d.categoryIds.includes(c.id) ? { borderColor: "var(--brand-2)", background: "var(--brand-soft)", color: "var(--brand-ink)" } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>
            {c.name}
          </button>
        ))}
      </div>
      {/* Every chosen type is listed on the page, but only one fits the hero
          image badge — let the operator say which. */}
      {d.categoryIds.length > 1 && (
        <div className="mb-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
          <div className="text-[11.5px] font-bold">Which type shows on the main image?</div>
          <div className="mb-2 text-[11px] text-[var(--ink-3)]">All {d.categoryIds.length} appear above the title — this one gets the badge on the photo.</div>
          <div className="flex flex-wrap gap-1.5">
            {local.categories.filter((c) => d.categoryIds.includes(c.id)).map((c) => {
              const on = (d.heroCategoryId ?? d.categoryIds[0]) === c.id;
              return (
                <button key={c.id} type="button" onClick={() => upd({ heroCategoryId: c.id })} className="rounded-full border px-3 py-1.5 text-[12px] font-bold"
                  style={on ? { borderColor: "var(--brand-2)", background: "var(--brand-soft)", color: "var(--brand-ink)" } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>
                  {on ? "★ " : ""}{c.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <SectionHead icon="👧👦">Capacity</SectionHead>
      <YesNo label="Allow children outside this age range to attend?" value={d.allowOutOfRange} onChange={(v) => upd({ allowOutOfRange: v })} help="If No, out-of-range parents can't book. If Yes, they can request a place." />
      <div className="my-2 flex items-end gap-2">
        <div className="w-[160px]"><FieldLabel>Maximum attendees</FieldLabel><Input type="number" min={1} value={d.maxAttendees} onChange={(e) => upd({ maxAttendees: e.target.value })} className="w-full" /></div>
        <div className="flex gap-1 pb-[3px]">
          {[["day", "Per day"], ["listing", "Whole listing"]].map(([k, l]) => (
            <button key={k} type="button" onClick={() => upd({ capacityScope: k as "day" | "listing" })} className="rounded-full border px-2.5 py-1 text-[11px] font-bold"
              style={d.capacityScope === k ? { borderColor: "var(--brand-2)", background: "var(--brand-soft)", color: "var(--brand-ink)" } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>{l}</button>
          ))}
        </div>
      </div>
      <YesNo label="Show remaining spaces to parents?" value={d.showSpaces} onChange={(v) => upd({ showSpaces: v })} help="Displays “X spaces left” on the listing." />

      <AgeCaps d={d} upd={upd} />

      <div className="mt-2 text-[11px] text-[var(--ink-3)]">ⓘ These are defaults — each ticket can amend its own age &amp; capacity in <b>Tickets &amp; pricing</b>.</div>
      {/* patchLocal is unused here but kept for signature symmetry with other steps */}
      <span className="hidden">{typeof patchLocal}</span>
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
  const { settings } = useSettings();
  const allowRange = settings.allowListingAgeRange;
  const ranges = d.ageRanges ?? {};
  const from = parseInt(d.ageFrom, 10);
  const to = parseInt(d.ageTo, 10);
  // Effective bands: the master group age range, unless this listing overrides
  // it AND the tenant allows per-listing ranges. name/colour/id/maxSize always
  // stay master — only the age band can shift, and only for this camp.
  const eff = settings.ratioGroups.map((g) => {
    const r = allowRange ? ranges[g.id] : undefined;
    return r ? { ...g, ageFrom: r.from, ageTo: r.to } : g;
  });
  // Only the groups that overlap this listing's age range are relevant.
  const groups = eff.filter(
    (g) => (!Number.isFinite(to) || g.ageFrom <= to) && (!Number.isFinite(from) || g.ageTo >= from),
  );
  const setRange = (id: string, key: "from" | "to", v: string) => {
    const raw = parseInt(v, 10);
    if (Number.isNaN(raw) || raw < 0) return;
    const g = settings.ratioGroups.find((x) => x.id === id);
    if (!g) return;
    const cur = ranges[id] ?? { from: g.ageFrom, to: g.ageTo };
    upd({ ageRanges: { ...ranges, [id]: { ...cur, [key]: raw } } });
  };
  const resetRange = (id: string) => {
    const next = { ...ranges };
    delete next[id];
    upd({ ageRanges: next });
  };
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
          <div className="text-[12.5px] font-bold">Limit places by age group, per day <span className="font-normal text-[var(--ink-3)]">— optional</span></div>
          <div className="text-[11px] leading-[1.5] text-[var(--ink-3)]">
            Cap only the ages you want to limit — you can set a max on one group and leave the rest blank,
            and the day&rsquo;s {Number.isFinite(ceiling) ? `${ceiling} places` : "total"} still can&rsquo;t be exceeded
            (the uncapped ages share whatever&rsquo;s left). <b>Blank = no limit; 0 = closed</b>, so no child that age
            can book. <b>Per day</b>, since a room refills each day. Group names and room sizes are set in <b>Setup → Age groups &amp; rooms</b>.{" "}
            {allowRange
              ? "Age ranges are editable here for this camp only — the master group and your other listings don't change."
              : "Age ranges are fixed there too — here you only set this listing's caps."}
          </div>
        </div>
        {!on && (
          <button type="button" onClick={() => upd({ ageCapsOn: true })}
            className="rounded-full border border-[var(--line)] px-3 py-1 text-[11.5px] font-bold text-[var(--brand-ink,#1d3a8f)]">
            Set age caps
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
              {allowRange ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-[var(--ink-3)]">
                  <input type="number" min={0} max={21} value={g.ageFrom} onChange={(e) => setRange(g.id, "from", e.target.value)}
                    className="w-[46px] rounded-lg border border-[var(--line)] bg-[var(--surface)] px-1.5 py-1 text-[12px]" aria-label={`${g.name} minimum age for this listing`} />
                  –
                  <input type="number" min={0} max={21} value={g.ageTo} onChange={(e) => setRange(g.id, "to", e.target.value)}
                    className="w-[46px] rounded-lg border border-[var(--line)] bg-[var(--surface)] px-1.5 py-1 text-[12px]" aria-label={`${g.name} maximum age for this listing`} />
                  yrs
                  {ranges[g.id] && (
                    <button type="button" onClick={() => resetRange(g.id)} title="Back to the group's standard age range" className="ml-0.5 rounded-full bg-[#eef2ff] px-1.5 py-[1px] text-[9.5px] font-bold text-[var(--brand-ink,#1d3a8f)]">
                      this camp · reset
                    </button>
                  )}
                </span>
              ) : (
                <span className="text-[11px] text-[var(--ink-3)]">{g.ageFrom}–{g.ageTo} yrs</span>
              )}
              {g.maxSize > 0 && <span className="text-[10.5px] text-[var(--ink-3)]" title="Room capacity, set in Setup → Age groups & rooms">room holds {g.maxSize}</span>}
              <span className="ml-auto inline-flex items-center gap-1.5">
                <input type="number" min={0} max={Number.isFinite(inputMax) ? inputMax : undefined} value={caps[g.id] ?? ""} placeholder="no limit"
                  onChange={(e) => setCap(g.id, e.target.value)}
                  className="w-[86px] rounded-lg border bg-[var(--surface)] px-2 py-1 text-[12.5px]"
                  style={{ borderColor: caps[g.id] === 0 ? "#f0b8b8" : "var(--line)" }} />
                <span className="text-[11px] font-bold" style={{ color: caps[g.id] === 0 ? "#c0392b" : "var(--ink-3)" }}>
                  {caps[g.id] === 0 ? "closed" : "a day"}
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
            if (diff === 0) { tone = ["#e7f8ee", "#0f7a44"]; msg = <>✓ All <b>{ceiling}</b> places allocated by age.</>; }
            else if (allCapped) { tone = ["#fff8ec", "#8a5300"]; msg = <><b>{capSum}</b> of <b>{ceiling}</b> allocated — and every age is capped, so the last {diff} can never fill. Raise a limit or leave an age uncapped for the rest.</>; }
            else { msg = <><b>{capSum}</b> of <b>{ceiling}</b> allocated — the other {diff} stay open to the uncapped ages.</>; }
            return <div className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold leading-[1.5]" style={{ background: tone[0], color: tone[1] }}>{msg}</div>;
          })()}
          <div className="mt-2 flex flex-wrap items-center gap-2.5 border-t border-[var(--line)] pt-2.5">
            <button
              type="button"
              onClick={() => upd({ ageCapsOn: false, ageCaps: {} })}
              className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 py-1.5 text-[12px] font-bold text-[var(--ink-2)] hover:border-[var(--ink-3)]"
            >
              ✕ Turn off age caps
            </button>
            <span className="text-[11px] text-[var(--ink-3)]">Saves with the listing — use <b>Save draft</b> or <b>Publish</b> below.</span>
            <span className="rounded-full bg-[#fff3e0] px-2 py-[2px] text-[10.5px] font-extrabold text-[#8a5300]">Enforced once the backend is built (§S)</span>
          </div>
          <div className="mt-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[11px] leading-[1.5] text-[var(--ink-3)]">
            👪 When an age is full, parents of that age will see &ldquo;<b>full for this age</b>&rdquo; on the listing before they start —
            so nobody adds their child at checkout only to be turned away.
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step: Content ──────────────────────────────────────────────────────────
function ContentStep({ d, upd, local, patchLocal }: { d: WizardDraft; upd: (p: Partial<WizardDraft>) => void; local: LocalState; patchLocal: (fn: (s: LocalState) => LocalState) => void }) {
  const [aiN, setAiN] = useState(0);
  function writeAI() {
    const cats = local.categories.filter((c) => d.categoryIds.includes(c.id)).map((c) => c.name);
    // the field's words are the prompt; regenerate replaces (never appends).
    upd({ description: genDescription(d.description, d.descriptionSection, d, cats, aiN) });
    setAiN((n) => n + 1);
  }
  return (
    <div className="max-w-[720px]">
      <StepHead n={2} kicker="STEP 2 · CONTENT" title="Describe your activity" lede="A clear description helps parents choose. Add sections and learning outcomes." />
      <div className="mb-1 flex items-end gap-2">
        <div className="flex-1"><FieldLabel>Section title — editable</FieldLabel>
          <Input value={d.descriptionSection} onChange={(e) => upd({ descriptionSection: e.target.value })} placeholder="e.g. Summary, When you arrive, Our curriculum" className="w-full max-w-[300px]" />
        </div>
        <Button sm onClick={writeAI} className="mb-[1px]">✨ Write with AI</Button>
      </div>
      <div className="mb-1.5 flex flex-wrap gap-1">
        {SECTION_TYPES.map((t) => <button key={t} type="button" onClick={() => upd({ descriptionSection: t })} className="rounded-full border border-[var(--line)] px-2 py-[2px] text-[10.5px] font-bold text-[var(--ink-3)] hover:border-[var(--brand)]">{t}</button>)}
      </div>
      <textarea value={d.description} maxLength={300} onChange={(e) => upd({ description: e.target.value })}
        placeholder="Type a few words (e.g. dodgeball, arts, new friends) then ✨ Write with AI…"
        className="mb-1 h-[100px] w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2.5 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--brand)]" />
      <div className="mb-3 text-[11px] text-[var(--ink-3)]">{d.description.length}/300 · “Write with AI” turns your words into a paragraph for the <b>{d.descriptionSection || "section"}</b> section — press again for a fresh version.</div>

      <SectionHead icon="📝">Additional sections</SectionHead>
      <div className="mb-2 flex flex-col gap-1.5">
        {d.sections.map((s) => (
          <div key={s.id} className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-2.5">
            <div className="mb-1 flex items-center gap-2">
              <Input value={s.type} onChange={(e) => upd({ sections: d.sections.map((x) => x.id === s.id ? { ...x, type: e.target.value } : x) })} placeholder="Section title (e.g. When you arrive)" className="flex-1 font-bold" />
              <button type="button" onClick={() => upd({ sections: d.sections.filter((x) => x.id !== s.id) })} className="text-[var(--ink-3)] hover:text-[var(--red)]">✕</button>
            </div>
            <Input value={s.text} onChange={(e) => upd({ sections: d.sections.map((x) => x.id === s.id ? { ...x, text: e.target.value } : x) })} placeholder="Section text…" className="w-full" />
          </div>
        ))}
      </div>
      <Select value="" onChange={(e) => e.target.value && upd({ sections: [...d.sections, { id: uid(), type: e.target.value, text: "" }] })} className="mb-3 w-[220px]">
        <option value="">＋ Add a section…</option>
        {SECTION_TYPES.map((s) => <option key={s}>{s}</option>)}
      </Select>

      <SectionHead icon="🌟">Learning outcomes</SectionHead>
      <HeadingFields d={d} upd={upd} sectionKey="learn" />
      <EditableChips options={local.outcomes} sel={d.outcomes} emojis={local.emojis} showEmoji onToggle={(v) => upd({ outcomes: toggle(d.outcomes, v) })} onAdd={(name, emoji) => { patchLocal((s) => ({ ...s, outcomes: [...s.outcomes, name], emojis: { ...s.emojis, [name]: emoji } })); upd({ outcomes: [...d.outcomes, name] }); }} onDelete={(v) => { patchLocal((s) => ({ ...s, outcomes: s.outcomes.filter((x) => x !== v) })); upd({ outcomes: d.outcomes.filter((x) => x !== v) }); }} check />
    </div>
  );
}

function SafetyStep({ d, upd, local, patchLocal }: { d: WizardDraft; upd: (p: Partial<WizardDraft>) => void; local: LocalState; patchLocal: (fn: (s: LocalState) => LocalState) => void }) {
  return (
    <div className="max-w-[720px]">
      <StepHead n={4} kicker="STEP 4 · SAFETY & SEND" title="Safety & inclusion" lede="Show your safety features and the SEND support you offer." />
      <SectionHead icon="🛡️">Safety features</SectionHead>
      <HeadingFields d={d} upd={upd} sectionKey="safety" />
      <div className="mb-3"><EditableChips options={local.safety} sel={d.safety} emojis={local.emojis} showEmoji onToggle={(v) => upd({ safety: toggle(d.safety, v) })} onAdd={(name, emoji) => { patchLocal((s) => ({ ...s, safety: [...s.safety, name], emojis: { ...s.emojis, [name]: emoji } })); upd({ safety: [...d.safety, name] }); }} onDelete={(v) => { patchLocal((s) => ({ ...s, safety: s.safety.filter((x) => x !== v) })); upd({ safety: d.safety.filter((x) => x !== v) }); }} check /></div>
      <SectionHead icon="🤝">SEND &amp; accessibility</SectionHead>
      <HeadingFields d={d} upd={upd} sectionKey="send" />
      <EditableChips options={local.send} sel={d.send} emojis={local.emojis} showEmoji onToggle={(v) => upd({ send: toggle(d.send, v) })} onAdd={(name, emoji) => { patchLocal((s) => ({ ...s, send: [...s.send, name], emojis: { ...s.emojis, [name]: emoji } })); upd({ send: [...d.send, name] }); }} onDelete={(v) => { patchLocal((s) => ({ ...s, send: s.send.filter((x) => x !== v) })); upd({ send: d.send.filter((x) => x !== v) }); }} check />
      <div className="mt-2 text-[11px] text-[var(--ink-3)]">New options you add here are saved and offered on every listing.</div>
    </div>
  );
}

// ── Step: When it runs ─────────────────────────────────────────────────────
function RunStep({ d, upd }: { d: WizardDraft; upd: (p: Partial<WizardDraft>) => void }) {
  const weekly = d.blockMode === "weekly";
  const dates = useMemo(() => genDates(d.runFrom, d.runTo, d.days), [d.runFrom, d.runTo, d.days]);
  const weeks = useMemo(() => groupWeeks(dates), [dates]);
  const live = dates.filter((x) => !d.datesOff.includes(x)).length;
  return (
    <div className="max-w-[720px]">
      <StepHead n={5} kicker="STEP 5 · WHEN IT RUNS" title="When it runs" lede="Pick the block size and which days run — including weekends. The calendar builds itself." />
      <div className="mb-3 flex gap-3">
        <div className="flex-1"><FieldLabel>Camp runs from</FieldLabel><Input type="date" value={d.runFrom} onChange={(e) => upd({ runFrom: e.target.value })} className="w-full" /></div>
        <div className="flex-1"><FieldLabel>Camp runs to</FieldLabel><Input type="date" value={d.runTo} onChange={(e) => upd({ runTo: e.target.value })} className="w-full" /></div>
      </div>
      <SectionHead icon="▥">Block size</SectionHead>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {[["weekly", "Weekly (Mon–Fri)"], ["custom", "Custom days (incl. weekends)"]].map(([k, label]) => (
          <button key={k} type="button" onClick={() => upd({ blockMode: k as "weekly" | "custom", days: k === "weekly" ? [1, 2, 3, 4, 5] : d.days })} className="rounded-lg border px-3 py-1.5 text-[12px] font-bold"
            style={d.blockMode === k ? { borderColor: "var(--brand-2)", background: "var(--brand-soft)", color: "var(--brand-ink)" } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>{label}</button>
        ))}
      </div>
      <SectionHead>Choose the days of the week it runs{weekly ? " (locked to Mon–Fri)" : ""}</SectionHead>
      <div className="flex flex-wrap gap-1.5">
        {WEEKDAYS.map(([n, label]) => {
          const on = d.days.includes(n);
          return (
            <button key={n} type="button" disabled={weekly} onClick={() => upd({ days: toggle(d.days.map(String), String(n)).map(Number) })} className="rounded-full border px-3 py-1.5 text-[12px] font-bold disabled:opacity-50"
              style={on ? { borderColor: "var(--brand-2)", background: "var(--brand-soft)", color: "var(--brand-ink)" } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>{label}</button>
          );
        })}
      </div>

      <div className="mt-4">
        <SectionHead>Calendar — {weeks.length} {weeks.length === 1 ? "week" : "weeks"} · {live} bookable dates live</SectionHead>
        {dates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--line)] p-4 text-center text-[12px] text-[var(--ink-3)]">
            Set the from/to dates (and pick weekdays) and the calendar builds itself here. Tap any day to switch it off.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {weeks.map((w, i) => {
              const col = WEEK_PAL[i % WEEK_PAL.length];
              return (
                <div key={w.mon} className="overflow-hidden rounded-xl border border-[var(--line)]">
                  <div className="flex items-center gap-2 px-3 py-1.5 text-[12px] font-extrabold text-white" style={{ background: col }}>
                    Week {w.n} <span className="font-semibold opacity-80">· from {fmtDate(w.mon)}</span>
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
        )}
      </div>
    </div>
  );
}

// ── Step: Tickets & pricing (pulls from Blocks) ────────────────────────────
function TicketsStep({ d, upd, blocks, tickets }: { d: WizardDraft; upd: (p: Partial<WizardDraft>) => void; blocks: BlocksStore; tickets: { name: string; days: number; price: number }[] }) {
  const ovUpd = (name: string, field: keyof TicketOverride, value: string) =>
    upd({ ticketOverrides: { ...d.ticketOverrides, [name]: { ...d.ticketOverrides[name], [field]: value } } });
  const setBookRule = (name: string, rule: BookRule) => upd({ bookRules: { ...(d.bookRules ?? {}), [name]: rule } });
  const multiDay = tickets.filter((t) => t.days > 1);
  return (
    <div className="max-w-[720px]">
      <StepHead n={6} kicker="STEP 6 · TICKETS & PRICING" title="Tickets & pricing" lede="Pick a block you built in the Blocks area — its passes & prices become this listing's tickets." />
      {blocks.loading ? (
        <Card className="p-4 text-[12.5px] text-[var(--ink-3)]">Loading your blocks…</Card>
      ) : blocks.error ? (
        <Card className="p-4 text-[12.5px]" style={{ borderColor: "#f4c7c7", background: "#fdf2f2", color: "#b91c1c" }}>
          <b>Couldn’t load your blocks.</b> {blocks.error}
        </Card>
      ) : blocks.library.length === 0 ? (
        <Card className="p-4 text-[12.5px] text-[var(--ink-3)]">No blocks saved yet. Build one in the <b>Blocks</b> area — set your periods (times) and passes once, then reuse them here.</Card>
      ) : (
        <div className="flex flex-col gap-2">
          {blocks.library.map((b) => {
            const on = b.id === d.blockId;
            return (
              // Clicking the selected block clears it — picking the wrong one
              // otherwise left no way back to "no block".
              <button key={b.id} type="button" onClick={() => upd({ blockId: on ? null : b.id })}
                title={on ? "Click to unselect" : undefined}
                className="group flex items-center justify-between gap-2 rounded-xl border p-3 text-left"
                style={on ? { borderColor: "var(--brand-2)", background: "var(--brand-soft)" } : { borderColor: "var(--line)" }}>
                <div>
                  <div className="text-[13.5px] font-extrabold">▥ {b.name}</div>
                  <div className="text-[11.5px] text-[var(--ink-3)]">{b.periodIds.length} periods · {b.passIds.length} passes</div>
                </div>
                <span className="whitespace-nowrap text-[11.5px] font-bold" style={{ color: on ? "var(--brand-ink)" : "var(--ink-3)" }}>
                  {on ? <><span className="group-hover:hidden">✓ Selected</span><span className="hidden group-hover:inline">✕ Unselect</span></> : "Use this block"}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {tickets.length > 0 && (
        <div className="mt-3">
          <SectionHead icon="🎟️">Tickets on this listing — each can amend its own age &amp; capacity</SectionHead>
          <p className="mb-2 text-[11.5px] leading-[1.5] text-[var(--ink-3)]">
            <b>Capacity</b> here limits how many of <em>that</em> pass can be booked — separate from the whole-listing total.
            It&rsquo;s how you cap a <b>SEND / 1:1</b> pass to the number of dedicated staff you have: set it to, say, 2 and only two
            1:1 places can be booked, so you&rsquo;re never committed to support you can&rsquo;t provide.
          </p>
          {tickets.map((t) => {
            const ov = d.ticketOverrides[t.name] || {};
            return (
              <div key={t.name} className="mb-1.5 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-2.5">
                <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
                  <span className="font-bold">{t.name} <span className="text-[var(--ink-3)]">· {t.days} day{t.days === 1 ? "" : "s"}</span></span>
                  <span className="font-bold">{money(t.price)}</span>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="w-[84px]"><FieldLabel>Age from</FieldLabel><Input type="number" min={0} value={ov.ageFrom ?? ""} onChange={(e) => ovUpd(t.name, "ageFrom", e.target.value)} placeholder={d.ageFrom || "—"} className="w-full" /></div>
                  <div className="w-[84px]"><FieldLabel>Age to</FieldLabel><Input type="number" min={0} value={ov.ageTo ?? ""} onChange={(e) => ovUpd(t.name, "ageTo", e.target.value)} placeholder={d.ageTo || "—"} className="w-full" /></div>
                  <div className="w-[110px]"><FieldLabel>Capacity</FieldLabel><Input type="number" min={0} value={ov.capacity ?? ""} onChange={(e) => ovUpd(t.name, "capacity", e.target.value)} placeholder={d.maxAttendees} className="w-full" /></div>
                  <span className="pb-[6px] text-[10.5px] text-[var(--ink-3)]">Blank = uses the listing defaults.</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {multiDay.length > 0 && (
        <div className="mt-3">
          <SectionHead icon="🧭">How parents can book each pass</SectionHead>
          {multiDay.map((t) => {
            const rule = (d.bookRules ?? {})[t.name] ?? "week";
            return (
              <div key={t.name} className="border-b border-dashed border-[var(--line)] py-2 last:border-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <b className="text-[13px]">{t.name}</b>
                  <span className="rounded-full bg-[var(--panel)] px-2 py-[2px] text-[10.5px] font-bold text-[var(--ink-3)]">{t.days} days</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {BOOK_RULES.map(([k, label]) => (
                    <button key={k} type="button" onClick={() => setBookRule(t.name, k)} className="rounded-lg border px-2.5 py-1 text-[11.5px] font-bold"
                      style={rule === k ? { borderColor: "var(--brand-2)", background: "var(--brand-soft)", color: "var(--brand-ink)" } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>
                      {label(t.days)}
                    </button>
                  ))}
                </div>
                <div className="mt-1 text-[11px] text-[var(--ink-2)]">{bookRuleDesc(rule, t.days)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Step: Add-ons (reusable library) ───────────────────────────────────────
// ── Step: Automatic discounts ──────────────────────────────────────────────
const DISCOUNT_KINDS: { kind: DiscountKind; title: string; eg: string; icon: string; colour: string }[] = [
  { kind: "person", title: "Multi-person", eg: "Siblings pay £3.50 each, bring a friend pay £10.00 each", icon: "👨‍👩‍👧", colour: "#2f6bd8" },
  { kind: "session", title: "Multi-session", eg: "Book more than 3 sessions to get 10% off", icon: "📅", colour: "#0e9f6e" },
  { kind: "early", title: "Early bird", eg: "£10 off when they book before 1 June", icon: "🐦", colour: "#d97706" },
];

function DiscountsStep({ d, upd, tickets }: { d: WizardDraft; upd: (p: Partial<WizardDraft>) => void; tickets: { name: string; days: number; price: number }[] }) {
  const rules = d.discounts ?? [];
  const setRules = (next: DiscountRule[]) => upd({ discounts: next });
  // One form at a time: picking a type opens it here rather than stacking
  // another card onto the page.
  const [form, setForm] = useState<DiscountRule | null>(null);
  const editing = !!form && rules.some((r) => r.id === form.id);
  const set = (p: Partial<DiscountRule>) => setForm((f) => (f ? { ...f, ...p } : f));
  const save = () => {
    if (!form) return;
    setRules(editing ? rules.map((r) => (r.id === form.id ? form : r)) : [...rules, form]);
    setForm(null);
  };
  const kindOf = (k: DiscountKind) => DISCOUNT_KINDS.find((x) => x.kind === k)!;

  return (
    <div className="max-w-[760px]">
      <StepHead n={7} kicker="STEP 7 · DISCOUNTS" title="Automatic discounts" lede="Rules that come off the price by themselves at checkout — no codes for parents to remember." />

      {/* Create / edit panel */}
      <Card className="mb-4 overflow-hidden p-0">
        <div className="border-b border-[var(--line)] bg-[var(--panel)] px-4 py-3">
          <div className="text-[13px] font-extrabold">{editing ? "Edit discount rule" : "Create an automatic discount rule"}</div>
          <div className="text-[11.5px] text-[var(--ink-3)]">Select a discount type</div>
        </div>

        <div className="grid gap-2 p-4 sm:grid-cols-3">
          {DISCOUNT_KINDS.map((k) => {
            const on = form?.kind === k.kind;
            return (
              <button key={k.kind} type="button" onClick={() => setForm(on && form ? form : emptyRule(k.kind))}
                className="rounded-xl border-2 p-3 text-left transition-all"
                style={on ? { borderColor: k.colour, background: `${k.colour}0f` } : { borderColor: "var(--line)" }}>
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg text-[16px]" style={{ background: `${k.colour}1a` }}>{k.icon}</span>
                  <span className="text-[12.5px] font-extrabold" style={{ color: on ? k.colour : "var(--ink)" }}>{k.title}</span>
                  {on && <span className="ml-auto text-[13px]" style={{ color: k.colour }}>✓</span>}
                </div>
                <div className="mt-1.5 text-[11px] leading-[1.45] text-[var(--ink-3)]">{k.eg}</div>
              </button>
            );
          })}
        </div>

        {form && (
          <div className="border-t border-[var(--line)] p-4">
            <FieldLabel>Name your discount — parents see this on the booking page</FieldLabel>
            <Input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder={ruleSummary(form)} className="mb-3.5 w-full text-[12.5px]" />

            <FieldLabel>Which tickets does it apply to?</FieldLabel>
            <div className="mb-3.5 flex flex-wrap gap-1.5">
              <button type="button" onClick={() => set({ passNames: [] })} className="rounded-full border px-2.5 py-1 text-[11.5px] font-bold"
                style={form.passNames.length === 0 ? { borderColor: "var(--brand-2)", background: "var(--brand-soft)", color: "var(--brand-ink)" } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>All tickets</button>
              {tickets.map((t) => {
                const on = form.passNames.includes(t.name);
                return (
                  <button key={t.name} type="button" onClick={() => set({ passNames: on ? form.passNames.filter((x) => x !== t.name) : [...form.passNames, t.name] })}
                    className="rounded-full border px-2.5 py-1 text-[11.5px] font-bold"
                    style={on ? { borderColor: "var(--brand-2)", background: "var(--brand-soft)", color: "var(--brand-ink)" } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>{t.name}</button>
                );
              })}
              {tickets.length === 0 && <span className="text-[11.5px] text-[var(--ink-3)]">Pick a block in Tickets &amp; pricing first.</span>}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {form.kind !== "early" ? (
                <div>
                  <FieldLabel>{form.kind === "person" ? "Applies when attendees are more than" : "Applies when sessions are more than"}</FieldLabel>
                  <Input type="number" min={1} value={form.moreThan} onChange={(e) => set({ moreThan: Math.max(1, parseInt(e.target.value, 10) || 1) })} className="w-full" />
                </div>
              ) : (
                <div>
                  <FieldLabel>Must book on or before</FieldLabel>
                  <Input type="date" value={form.beforeDate} onChange={(e) => set({ beforeDate: e.target.value })} className="w-full" />
                </div>
              )}

              {form.kind === "person" && (
                <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[11.5px] leading-[1.5] text-[var(--ink-2)]">
                  Applies to <b>every child</b> on the same pass. Two siblings on one week both get it;
                  a child booked on their own doesn&rsquo;t.
                </div>
              )}

              <div>
                <FieldLabel>Discount method</FieldLabel>
                <Select value={form.method} onChange={(e) => set({ method: e.target.value as DiscountRule["method"] })} className="w-full text-[12px]">
                  {form.kind !== "session" && <option value="price">A discounted price</option>}
                  {form.kind !== "session" && <option value="subtract">Subtract an amount</option>}
                  <option value="percent">By a percentage</option>
                </Select>
              </div>
              <div>
                <FieldLabel>{form.method === "percent" ? "Percent off" : "Amount"}</FieldLabel>
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-extrabold text-[var(--ink-3)]">{form.method === "percent" ? "%" : "£"}</span>
                  <Input type="number" min={0} step="0.01" value={form.value} onChange={(e) => set({ value: Math.max(0, parseFloat(e.target.value) || 0) })} className="w-full" />
                </div>
              </div>
            </div>

            <div className="mt-3.5 rounded-lg border-l-4 bg-[var(--panel)] p-2.5 text-[12px] text-[var(--ink-2)]" style={{ borderLeftColor: kindOf(form.kind).colour }}>
              <b>Parents will see:</b> {form.name.trim() || ruleSummary(form)}
            </div>

            <div className="mt-3 flex gap-2">
              <Button variant="primary" onClick={save}>{editing ? "Save changes" : "Add discount"}</Button>
              <Button onClick={() => setForm(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </Card>

      {/* Saved rules */}
      {rules.length > 0 && (
        <>
          <SectionHead>Your discounts ({rules.length})</SectionHead>
          <div className="flex flex-col gap-2">
            {rules.map((r) => {
              const k = kindOf(r.kind);
              return (
                <div key={r.id} className="flex flex-wrap items-center gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3" style={{ borderLeft: `4px solid ${k.colour}`, opacity: r.enabled ? 1 : 0.55 }}>
                  <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-[15px]" style={{ background: `${k.colour}1a` }}>{k.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-bold">{r.name.trim() || ruleSummary(r)}</span>
                    <span className="block truncate text-[11px] text-[var(--ink-3)]">{k.title} · {r.passNames.length ? r.passNames.join(", ") : "all tickets"}</span>
                  </span>
                  <span className="rounded-full px-2.5 py-1 text-[11.5px] font-extrabold" style={{ background: `${k.colour}1a`, color: k.colour }}>
                    {r.method === "percent" ? `${r.value}%` : money(r.value)}
                  </span>
                  <button type="button" onClick={() => setRules(rules.map((x) => (x.id === r.id ? { ...x, enabled: !x.enabled } : x)))}
                    className="rounded-full border px-2.5 py-1 text-[11px] font-bold"
                    style={r.enabled ? { borderColor: "var(--brand-2)", background: "var(--brand-soft)", color: "var(--brand-ink)" } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>{r.enabled ? "On" : "Off"}</button>
                  <Button sm onClick={() => setForm(r)}>Edit</Button>
                  <button type="button" onClick={() => { setRules(rules.filter((x) => x.id !== r.id)); if (form?.id === r.id) setForm(null); }} className="text-[var(--ink-3)] hover:text-[var(--red)]">✕</button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {rules.length === 0 && !form && (
        <Card className="p-4 text-[12.5px] text-[var(--ink-3)]">No discounts yet — pick a type above to create your first rule.</Card>
      )}

      <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 text-[11.5px] text-[var(--ink-3)]">
        <b className="text-[var(--ink-2)]">How these stack:</b> multi-session discounts are applied after multi-person ones have been calculated, then early bird. If two rules conflict, the parent is offered the best price.
      </div>
    </div>
  );
}

// Inline on each step: reword the heading this step's content appears under on
// the customer page. Blank keeps the wording shown as the placeholder.
function HeadingFields({ d, upd, sectionKey }: { d: WizardDraft; upd: (p: Partial<WizardDraft>) => void; sectionKey: string }) {
  const def = SECTION_KEYS.find((s) => s.key === sectionKey);
  if (!def) return null;
  const set = (k: string, v: string) => upd({ headings: { ...(d.headings ?? {}), [k]: v } });
  return (
    <div className="mb-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
      <div className="text-[11.5px] font-bold">How this appears on the customer page</div>
      <div className="mb-2 text-[11px] text-[var(--ink-3)]">Leave blank to use the wording shown.</div>
      <div className="flex flex-wrap gap-2">
        <div className="min-w-[150px] flex-1">
          <FieldLabel>Small label above</FieldLabel>
          <Input value={d.headings?.[`${sectionKey}.eyebrow`] ?? ""} onChange={(e) => set(`${sectionKey}.eyebrow`, e.target.value)} placeholder={def.eyebrow} className="w-full text-[12px]" />
        </div>
        <div className="min-w-[150px] flex-1">
          <FieldLabel>Heading</FieldLabel>
          <Input value={d.headings?.[`${sectionKey}.title`] ?? ""} onChange={(e) => set(`${sectionKey}.title`, e.target.value)} placeholder={sectionKey === "about" ? d.descriptionSection || def.title : def.title} className="w-full text-[12px]" />
        </div>
      </div>
    </div>
  );
}

// Reword every heading a parent sees. Blank = use the wording shown as the
// placeholder.
function HeadingsEditor({ d, upd }: { d: WizardDraft; upd: (p: Partial<WizardDraft>) => void }) {
  const [open, setOpen] = useState(false);
  const set = (k: string, v: string) => upd({ headings: { ...(d.headings ?? {}), [k]: v } });
  return (
    <Card className="mb-3 p-3.5">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-left">
        <span>
          <span className="text-[13px] font-extrabold">Section headings</span>
          <span className="ml-2 text-[11.5px] text-[var(--ink-3)]">Reword any heading parents see — leave blank for the default.</span>
        </span>
        <span className="text-[13px] text-[var(--ink-3)]">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="mt-3 flex flex-col gap-2.5">
          {SECTION_KEYS.map((s) => (
            <div key={s.key} className="grid grid-cols-[130px_1fr_1fr] items-center gap-2">
              <span className="text-[11.5px] font-bold text-[var(--ink-2)]">{s.label}</span>
              <Input value={d.headings?.[`${s.key}.eyebrow`] ?? ""} onChange={(e) => set(`${s.key}.eyebrow`, e.target.value)} placeholder={s.eyebrow} className="w-full text-[12px]" />
              <Input value={d.headings?.[`${s.key}.title`] ?? ""} onChange={(e) => set(`${s.key}.title`, e.target.value)} placeholder={s.key === "about" ? d.descriptionSection || s.title : s.title} className="w-full text-[12px]" />
            </div>
          ))}
          <div className="text-[11px] text-[var(--ink-3)]">Left = the small label above the heading; right = the heading itself. “About the camp” follows your Section title from step 2 unless you set one here.</div>
        </div>
      )}
    </Card>
  );
}

// Give an add-on an emoji (from the bank) or a photo — shown next to it on the
// customer page. A photo wins over an emoji.
function AddonIcon({ addon, patchLocal }: { addon: AddonTemplate; patchLocal: (fn: (s: LocalState) => LocalState) => void }) {
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
      <button type="button" onClick={() => setOpen((v) => !v)} title="Choose an emoji or image"
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--line)] text-[15px] hover:border-[var(--brand)]">
        {addon.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={addon.image} alt="" className="h-full w-full rounded-lg object-cover" />
        ) : addon.emoji || "🖼"}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-30 mt-1 w-[290px] rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2.5 shadow-lg">
            <div className="mb-2 flex items-center gap-1.5">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search emoji…" className="w-full text-[12px]" />
              <Button sm onClick={() => fileRef.current?.click()}>Image</Button>
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
                className="mt-2 w-full rounded-lg border border-[var(--line)] py-1.5 text-[11.5px] font-bold text-[var(--ink-3)]">Remove</button>
            )}
          </div>
        </>
      )}
    </span>
  );
}

function AddonsStep({ d, upd, local, patchLocal }: { d: WizardDraft; upd: (p: Partial<WizardDraft>) => void; local: LocalState; patchLocal: (fn: (s: LocalState) => LocalState) => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"perday" | "once">("perday");
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState("");
  // Editing reuses the create form rather than a second one: same fields, same
  // validation, and no chance of the two drifting apart.
  const [editing, setEditing] = useState<string | null>(null);
  const [qs, setQs] = useState<AddonQuestion[]>([]);
  const types: Record<string, string> = { perday: "Per day", once: "One-off" };
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
      name: name.trim(), type, price: parseFloat(price) || 0,
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
    <div className="max-w-[720px]">
      <StepHead n={8} kicker="STEP 8 · ADD-ONS" title="Optional add-ons" lede="Per-day, whole-block or one-off extras. Add-ons you create are saved and reusable on any listing." />
      <HeadingFields d={d} upd={upd} sectionKey="addons" />
      {local.addons.length > 0 && (
        <div className="mb-3 flex flex-col gap-1.5">
          <SectionHead icon="✨">Your add-ons — tick the ones for this listing</SectionHead>
          {local.addons.map((a) => {
            const on = d.addonIds.includes(a.id);
            return (
              <div key={a.id} className="flex items-center gap-2 rounded-lg border p-2.5" style={on ? { borderColor: "var(--brand-2)", background: "var(--brand-soft)" } : { borderColor: "var(--line)" }}>
                <button type="button" onClick={() => upd({ addonIds: toggle(d.addonIds, a.id) })} className="flex flex-1 items-center gap-2 text-left">
                  <span className="text-[13px]">{on ? "☑" : "☐"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-bold">{a.name}</span>
                    {a.description && <span className="block text-[10.5px] leading-[1.4] text-[var(--ink-3)]">{a.description}</span>}
                  </span>
                  <span className="flex-none text-[11px] text-[var(--ink-3)]">{types[a.type] ?? "One-off"} · {money(a.price)}</span>
                </button>
                <AddonIcon addon={a} patchLocal={patchLocal} />
                <button type="button" onClick={() => startEdit(a)} title={`Edit ${a.name}`}
                  className="rounded-lg border border-[var(--line)] px-2 py-1 text-[11px] font-bold text-[var(--ink-2)] hover:border-[var(--brand)]">Edit</button>
                <button type="button" onClick={() => { if (editing === a.id) clear(); patchLocal((s) => ({ ...s, addons: s.addons.filter((x) => x.id !== a.id) })); upd({ addonIds: d.addonIds.filter((x) => x !== a.id) }); }} className="text-[var(--ink-3)] hover:text-[var(--red)]">✕</button>
              </div>
            );
          })}
        </div>
      )}
      <SectionHead icon={editing ? "✏️" : "➕"}>{editing ? `Editing “${local.addons.find((x) => x.id === editing)?.name ?? ""}”` : "Create a new add-on"}</SectionHead>
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-2.5">
        <div className="flex-1"><FieldLabel>Name</FieldLabel><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hot lunch" className="w-full" /></div>
        <div><FieldLabel>Type</FieldLabel><Select value={type} onChange={(e) => setType(e.target.value as "perday" | "once")} className="w-[130px]">{Object.entries(types).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></div>
        <div className="w-[90px]"><FieldLabel>Price £</FieldLabel><Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} className="w-full" /></div>
        <div className="w-full"><FieldLabel>Description <span className="font-normal text-[var(--ink-3)]">— optional, shown to parents</span></FieldLabel>
          <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Hot meal, dessert and a drink. Vegetarian by default — tell us about allergies when you book." className="w-full" /></div>
        <div className="w-full">
          <FieldLabel>Questions <span className="font-normal text-[var(--ink-3)]">— optional, asked per child at checkout</span></FieldLabel>
          {qs.map((q, i) => {
            const set = (patch: Partial<AddonQuestion>) => setQs(qs.map((x, n) => (n === i ? { ...x, ...patch } : x)));
            return (
              <div key={q.id} className="mb-1.5 flex flex-wrap items-end gap-2 rounded-lg border border-[var(--line)] p-2">
                <div className="min-w-[150px] flex-1">
                  <FieldLabel>Question</FieldLabel>
                  <Input value={q.label} onChange={(e) => set({ label: e.target.value })} placeholder="e.g. T-shirt size" className="w-full" />
                </div>
                <div>
                  <FieldLabel>Answer</FieldLabel>
                  <Select value={q.type} onChange={(e) => set({ type: e.target.value as AddonQuestion["type"] })} className="w-[130px]">
                    <option value="choice">Pick one</option>
                    <option value="text">Type an answer</option>
                  </Select>
                </div>
                {q.type === "choice" && (
                  <div className="min-w-[180px] flex-1">
                    <FieldLabel>Options <span className="font-normal text-[var(--ink-3)]">— comma separated</span></FieldLabel>
                    <Input value={(q.options ?? []).join(", ")} onChange={(e) => set({ options: e.target.value.split(",") })}
                      placeholder="Age 5-6, Age 7-8, Age 9-10" className="w-full" />
                  </div>
                )}
                <label className="flex items-center gap-1.5 pb-2 text-[11.5px] font-bold text-[var(--ink-2)]">
                  <input type="checkbox" checked={!!q.required} onChange={(e) => set({ required: e.target.checked })} />
                  Must answer
                </label>
                <button type="button" onClick={() => setQs(qs.filter((_, n) => n !== i))}
                  className="pb-2 text-[var(--ink-3)] hover:text-[var(--red)]">✕</button>
              </div>
            );
          })}
          <Button sm onClick={() => setQs([...qs, { id: uid(), label: "", type: "choice", options: [] }])}>＋ Add a question</Button>
        </div>
        <Button variant="primary" onClick={save}>{editing ? "Save changes" : "＋ Add"}</Button>
        {editing && <Button onClick={clear}>Cancel</Button>}
      </div>
    </div>
  );
}

function StaffStep({ d, upd, local, patchLocal }: { d: WizardDraft; upd: (p: Partial<WizardDraft>) => void; local: LocalState; patchLocal: (fn: (s: LocalState) => LocalState) => void }) {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [bioN, setBioN] = useState<Record<string, number>>({});
  const updMember = (id: string, patch: Partial<StaffMember>) => patchLocal((s) => ({ ...s, staff: s.staff.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
  const writeBio = (m: StaffMember) => { updMember(m.id, { bio: genBio(m.bio, m, bioN[m.id] || 0) }); setBioN((s) => ({ ...s, [m.id]: (s[m.id] || 0) + 1 })); };
  const addMember = () => {
    if (first.trim().length < 1) return;
    const m = { id: uid(), first: first.trim(), last: last.trim(), bio: "" };
    patchLocal((s) => ({ ...s, staff: [...s.staff, m] }));
    upd({ staffIds: [...d.staffIds, m.id] });
    setFirst(""); setLast("");
  };
  const removeMember = (id: string) => {
    if (!confirm("Remove this staff member?")) return;
    patchLocal((s) => ({ ...s, staff: s.staff.filter((m) => m.id !== id) }));
    upd({ staffIds: d.staffIds.filter((x) => x !== id) });
  };
  return (
    <div className="max-w-[720px]">
      <StepHead n={9} kicker="STEP 9 · STAFF" title="Staff onsite" lede="Add your team — first & last name and a short bio each — then assign who's onsite for this listing." />
      <HeadingFields d={d} upd={upd} sectionKey="team" />
      <div className="mb-3 flex flex-col gap-2">
        {local.staff.map((m) => {
          const on = d.staffIds.includes(m.id);
          return (
            <div key={m.id} className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[var(--brand-soft)] font-extrabold text-[var(--brand-ink)]">{(m.first[0] || "?").toUpperCase()}</span>
                <Input value={m.first} onChange={(e) => updMember(m.id, { first: e.target.value })} placeholder="First name" className="w-[130px]" />
                <Input value={m.last} onChange={(e) => updMember(m.id, { last: e.target.value })} placeholder="Surname" className="w-[130px]" />
                <div className="ml-auto flex gap-1.5">
                  <Button sm variant={on ? "primary" : "default"} onClick={() => upd({ staffIds: toggle(d.staffIds, m.id) })}>{on ? "Onsite" : "Assign"}</Button>
                  <button type="button" onClick={() => removeMember(m.id)} aria-label="Remove" className="px-1 text-[var(--ink-3)] hover:text-[var(--red)]">✕</button>
                </div>
              </div>
              <div className="mb-1 flex items-center justify-between">
                <FieldLabel>Short bio</FieldLabel>
                <Button sm onClick={() => writeBio(m)}>✨ Write bio with AI</Button>
              </div>
              <textarea value={m.bio} maxLength={300} onChange={(e) => updMember(m.id, { bio: e.target.value })} placeholder="Type a few words (e.g. football, patient, 6 years experience) then ✨ Write bio with AI…"
                className="h-[58px] w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2 text-[12.5px] text-[var(--ink)] outline-none focus:border-[var(--brand)]" />
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-end gap-1.5">
        <div><FieldLabel>First name</FieldLabel><Input value={first} onChange={(e) => setFirst(e.target.value)} placeholder="First" className="w-[130px]" /></div>
        <div><FieldLabel>Surname</FieldLabel><Input value={last} onChange={(e) => setLast(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addMember()} placeholder="Surname" className="w-[130px]" /></div>
        <Button onClick={addMember}>＋ Add staff</Button>
      </div>
      <div className="mt-2 text-[11px] text-[var(--ink-3)]">Staff &amp; bios are saved and reusable on every listing.</div>
    </div>
  );
}

/** Optional embargo: the listing is visible, but booking is held until a date. */
function BookingOpens({ value, onChange }: { value: string; onChange: (v: string) => void }) {
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
        ⏰ Schedule when bookings open
      </button>
    );
  }
  return (
    <div className="mb-1 rounded-xl border p-3" style={{ borderColor: "var(--brand-2)", background: "var(--brand-soft)" }}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="text-[12.5px] font-extrabold text-[var(--brand-ink)]">⏰ Bookings open at</div>
        <button type="button" onClick={() => onChange("")} className="text-[11.5px] font-bold text-[var(--ink-3)] underline">Open straight away</button>
      </div>
      <Input type="datetime-local" value={value} onChange={(e) => onChange(e.target.value)} className="w-full max-w-[240px]" />
      <div className="mt-1.5 text-[11px] leading-[1.5] text-[var(--ink-2)]">
        Parents can see the listing before this, but can&rsquo;t book — they see a countdown instead of the book button.
        Use it so everyone gets a fair shot at a popular camp rather than whoever happens to be looking.
      </div>
    </div>
  );
}

function PolicyStep({ d, upd }: { d: WizardDraft; upd: (p: Partial<WizardDraft>) => void }) {
  const { settings: wizSettings } = useTenantSettings();
  const vis: [WizardDraft["visibility"], string, string][] = [
    ["public", "Public", "Visible in search & browse"],
    ["hidden", "Hidden link", "Not searchable — anyone with the link can book · schools, HAF, private groups"],
  ];
  const book: [WizardDraft["bookingType"], string][] = [["auto", "Automatic approval"], ["manual", "Manual approval"]];
  // The provider's own policies, written in Setup & features. Picking one here
  // sets both the id (what the refund is worked out from) and the wording
  // (what a parent reads) — they can't be chosen separately any more, because
  // separately is how they came to disagree.
  const ownPolicies = wizSettings.cancellationPolicies;
  return (
    <div className="max-w-[720px]">
      <StepHead n={11} kicker="STEP 11 · POLICY & PUBLISH" title="Set clear expectations & publish" lede="Booking style, who can see it, cancellation policy — then publish." />
      <SectionHead icon="👁️">Who can see it</SectionHead>
      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        {vis.map(([k, label, desc]) => (
          <button key={k} type="button" onClick={() => upd({ visibility: k })} className="rounded-xl border p-2.5 text-left" style={d.visibility === k ? { borderColor: "var(--brand-2)", background: "var(--brand-soft)" } : { borderColor: "var(--line)" }}>
            <div className="text-[12.5px] font-extrabold">{d.visibility === k ? "● " : ""}{label}</div>
            <div className="text-[11px] text-[var(--ink-3)]">{desc}</div>
          </button>
        ))}
      </div>
      <BookingOpens value={d.opensAt ?? ""} onChange={(v) => upd({ opensAt: v })} />
      <SectionHead icon="📋">Booking &amp; waiting list</SectionHead>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {book.map(([k, label]) => (
          <button key={k} type="button" onClick={() => upd({ bookingType: k })} className="rounded-lg border px-3 py-1.5 text-[12px] font-bold" style={d.bookingType === k ? { borderColor: "var(--brand-2)", background: "var(--brand-soft)", color: "var(--brand-ink)" } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>{d.bookingType === k ? "✓ " : ""}{label}</button>
        ))}
      </div>
      <YesNo label="Waiting list" value={d.waitlist} onChange={(v) => upd({ waitlist: v })} help="Let parents queue for dates that are already full." />
      {d.waitlist && (
        <div className="mt-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
          <div className="mb-2 text-[11.5px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-3)]">When a place frees up</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {([
              ["manual", "You choose", "Nothing happens automatically. You see who's waiting for each date and offer the place to whoever you pick. Best when you know your families, or want to keep siblings together."],
              ["auto", "First in the queue", "The place is offered to whoever joined first, by email, and held for them for 2 hours. If they don't take it, it passes to the next person. Fairest, and you don't have to do anything."],
            ] as const).map(([k, label, desc]) => {
              const on = (d.waitlistMode ?? "manual") === k;
              return (
                <button key={k} type="button" onClick={() => upd({ waitlistMode: k })} className="rounded-xl border p-3 text-left"
                  style={on ? { borderColor: "var(--brand-2)", background: "var(--brand-soft)" } : { borderColor: "var(--line)", background: "var(--panel)" }}>
                  <div className="text-[12.5px] font-extrabold">{on ? "● " : ""}{label}</div>
                  <div className="mt-1 text-[11px] leading-[1.5] text-[var(--ink-3)]">{desc}</div>
                </button>
              );
            })}
          </div>
          <div className="mt-2.5 w-[150px]">
            <FieldLabel>Max people waiting</FieldLabel>
            <Input type="number" min={0} value={d.waitlistSize} onChange={(e) => upd({ waitlistSize: e.target.value })} placeholder="No limit" className="w-full" />
          </div>
        </div>
      )}
      <SectionHead icon="📄">Cancellation policy</SectionHead>
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
          <option key={p.id} value={p.id}>{p.name || "Untitled policy"}</option>
        ))}
      </Select>
      <div className="mt-1.5 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 py-2 text-[11.5px] leading-[1.5] text-[var(--ink-2)]">
        {d.cancellation || "Pick a policy above."}
      </div>
      <div className="mt-1 text-[11px] text-[var(--ink-3)]">
        Written from the rules in <b>Setup &amp; features → Bookings &amp; payments</b>. Change it
        there and every listing using this policy follows.
      </div>
      <div className="mt-1.5 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-2.5 text-[12px] text-[var(--ink-2)]">{d.cancellation}</div>
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

type BookView = { b: ReturnType<typeof useBooking>; d: WizardDraft; booking: BlockBooking | null; weeks: { n: number; mon: string; days: string[] }[]; spacesLeft: number | null; addons: LocalState["addons"]; mode?: "operator" | "parent"; onBook?: (p: { method: string; voucherScheme?: string; basket: BasketItem[]; addonSel: Record<string, Record<string, string[]>>; addonAns: Record<string, Record<string, string>>; children: ChildProfile[]; dayAssign: Record<string, Record<string, string[]>> }) => void; bookState?: { busy: boolean; error: string | null }; tenantId?: string };

// Dispatcher — same logic, theme-specific presentation.
/**
 * The waiting-list half of the picker. Full dates are chosen the same way
 * bookable ones are, so someone wanting five days with two full doesn't have
 * to choose between booking and queuing — they do both in one go.
 */
function WaitlistPanel({ b, d, tone }: { b: ReturnType<typeof useBooking>; d: WizardDraft; tone: "light" | "dark" }) {
  if (!b.waitlistOn || !b.fullCount) return null;
  const dark = tone === "dark";
  const box = dark
    ? { borderColor: "#ffb020", background: "#2a2110", color: "#ffd79a" }
    : { borderColor: "#fed7aa", background: "#fff7ed", color: "#9a3412" };

  if (b.waitDone) {
    return (
      <div className="mt-3 rounded-2xl border p-3.5 text-[12px] leading-[1.55]" style={box}>
        <b>You&rsquo;re on the waiting list.</b>
        {/* Spell out exactly what they're queued for — a parent who booked
            three separate dates needs to know which ones this covers. */}
        {b.waitSel.length > 0 && (
          <div className="mt-1.5 rounded-lg px-2.5 py-1.5" style={{ background: dark ? "#00000030" : "#ffffff80" }}>
            <div className="font-bold">{b.datesPretty(b.waitSel)}</div>
            {b.period?.range && <div className="opacity-90">{b.period.range}{b.pass?.name ? ` · ${b.pass.name}` : ""}</div>}
          </div>
        )}
        <div className="mt-1.5">
          We&rsquo;ll email you the moment a place comes up
          {(d.waitlistMode ?? "manual") === "auto"
            ? " — first in the queue gets it, and you'll have 2 hours to take it."
            : " — the organiser will be in touch if one does."}
          {" "}You can see this any time under <b>My waiting list</b> in your account.
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-2xl border p-3.5" style={box}>
      <div className="flex flex-wrap items-center gap-2">
        <b className="text-[12.5px]">{b.fullCount} day{b.fullCount === 1 ? " is" : "s are"} full</b>
        <button type="button" onClick={b.waitAll} className="ml-auto text-[11.5px] font-bold underline underline-offset-2">
          {b.waitSel.length === b.fullCount ? "Clear all" : `Join the waiting list for all ${b.fullCount}`}
        </button>
      </div>
      <div className="mt-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] leading-[1.5]" style={{ background: dark ? "#00000030" : "#ffffff70" }}>
        <span className="font-bold">Full:</span> {b.datesPretty(b.fullDays)}
      </div>
      <div className="mt-1.5 text-[11.5px] leading-[1.5]">
        {b.waitSel.length === 0
          ? "Tap a full day above to join the waiting list for it — you can pick as many as you like."
          : `On your list for ${b.waitSel.length} day${b.waitSel.length === 1 ? "" : "s"}: ${b.datesPretty(b.waitSel)}`}
      </div>
      {b.waitSel.length > 0 && (
        <>
          <button type="button" onClick={() => b.setWaitDone(true)}
            className="mt-2.5 w-full rounded-xl py-2.5 text-[12.5px] font-extrabold text-white"
            style={{ background: dark ? "#c2410c" : "#c2410c" }}>
            Join the waiting list for {b.waitSel.length} day{b.waitSel.length === 1 ? "" : "s"}
          </button>
          <div className="mt-1.5 text-[11px] leading-[1.45] opacity-90">
            Nothing to pay — you&rsquo;re only charged if a place comes up and you take it.
          </div>
        </>
      )}
    </div>
  );
}

function BookingWidget({ d, booking, weeks, spacesLeft, addons, blocks, mode, onBook, bookState, theme = "playful", tenantId }: {
  d: WizardDraft; booking: BlockBooking | null; weeks: { n: number; mon: string; days: string[] }[]; spacesLeft: number | null; addons: LocalState["addons"]; blocks?: RunBlock[]; mode?: "operator" | "parent"; onBook?: (p: { method: string; voucherScheme?: string; basket: BasketItem[]; addonSel: Record<string, Record<string, string[]>>; addonAns: Record<string, Record<string, string>>; children: ChildProfile[]; dayAssign: Record<string, Record<string, string[]>> }) => void; bookState?: { busy: boolean; error: string | null }; theme?: PageTheme; tenantId?: string;
}) {
  const b = useBooking(d, booking, weeks, blocks, mode);
  const view: BookView = { b, d, booking, weeks, spacesLeft, addons, mode, onBook, bookState, tenantId };
  // Checkout is much shorter than the calendar it replaces, so without this the
  // card collapses and leaves you staring at whitespace. "nearest" nudges it
  // into view only if it isn't already — no jump to the top of the page.
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (b.stage !== "pick") box.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [b.stage]);
  return (
    <div ref={box}>
      {theme === "playful" ? <PlayfulBooking {...view} /> : <SportBooking {...view} surf={theme === "navy" ? SPORT_NAVY : SPORT_BLACK} />}
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


// ── Booking · PLAYFUL (bright, rounded, blue) ──────────────────────────────
function PlayfulBooking({ b, d, booking, weeks, spacesLeft, addons, mode, onBook, bookState, tenantId }: BookView) {
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
      <div className="mt-3 text-[19px] font-extrabold tracking-[-0.02em]" style={{ color: INKp }}>Booked{b.child ? ` for ${b.child}` : ""}! 🎉</div>
      <div className="mt-1.5 text-[13px] text-[#7a8194]">{d.bookingType === "auto" ? "Instantly confirmed." : "The provider will approve your booking."} A confirmation email is on its way.</div>
      <button className="mt-4 rounded-full px-6 py-2.5 text-[13.5px] font-extrabold text-white" style={{ background: BLUE }} onClick={b.reset}>Book again</button>
    </div>
  );
  if (b.stage === "checkout") return (
    <div className="overflow-hidden rounded-[26px] bg-white" style={{ boxShadow: "0 24px 50px -26px rgba(47,107,216,.5)" }}>
      <div className="px-5 pt-5 text-[20px] font-extrabold tracking-[-0.02em]" style={{ color: INKp }}>Checkout</div>
      <CheckoutPanel b={b} d={d} addons={addons} mode={mode} onBook={onBook} booking={bookState} tenantId={tenantId} tk={{ bg: "#fff", line: LINEp, ink: INKp, muted: MUTp, accent: BLUE, accentInk: "#fff", round: "rounded-2xl", inputBg: "#fff", bar: `linear-gradient(120deg,${DEEP},${BLUE})`, barInk: "#fff" }} />
    </div>
  );
  return (
    <div className="rounded-[26px] bg-white p-5" style={{ boxShadow: "0 24px 50px -26px rgba(47,107,216,.5)" }}>
      <div className="flex items-baseline justify-between">
        <span className="text-[20px] font-extrabold tracking-[-0.02em]" style={{ color: INKp }}>Choose dates &amp; times</span>
        {b.pass && <span className="text-[13px] text-[#7a8194]">from <b style={{ color: DEEP }}>{money(b.unitPrice)}</b></span>}
      </div>
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
      {b.passes.length === 0 ? <div className="mt-2 text-[13px] text-[#7a8194]">Pick a block in Tickets &amp; pricing to enable booking.</div> : (
        <>
          {step(1, "Choose your pass")}
          <div className="flex flex-wrap gap-2">
            {b.passes.map((t) => <button key={t.id} type="button" onClick={() => { b.setPassId(t.id); }} className="rounded-full border-2 px-4 py-2 text-[12.5px] font-bold" style={t.id === b.passId ? { background: BLUE, color: "#fff", borderColor: BLUE } : idle}>{t.name} · {money(booking ? booking.priceFor(t.id, b.periodId) : t.basePrice)}</button>)}
          </div>
          {b.periods.length > 0 && <>
            {step(2, "Choose a timing")}
            <div className="flex flex-wrap gap-2">
              {b.periods.map((p) => <button key={p.id} type="button" onClick={() => b.setPeriodId(p.id)} className="rounded-2xl border-2 px-3.5 py-2 text-left text-[12px] font-bold leading-tight" style={p.id === b.periodId ? { background: BLUE, color: "#fff", borderColor: BLUE } : idle}>{p.range}{b.pass ? <span className={p.id === b.periodId ? "block text-[10px] font-semibold opacity-90" : "block text-[10px] font-semibold text-[#7a8194]"}>{p.title} · {money(booking!.priceFor(b.pass.id, p.id))}</span> : null}</button>)}
            </div>
          </>}
          {b.pass && step(b.periods.length ? 3 : 2, b.isSingle ? "Choose any dates" : "Choose your dates")}
          {weeks.length ? <div className="flex flex-col gap-3">
            {weeks.slice(0, 8).map((w) => <div key={w.mon}>
              <div className="mb-1.5 text-[11px] font-bold" style={{ color: BLUE }}>Week {w.n} <span className="font-semibold text-[#a6adba]">· from {fmtDate(w.mon)}</span></div>
              <div className="flex flex-wrap gap-1.5">{w.days.map((iso) => {
                const dOff = b.off(iso); const on = b.sel.includes(iso); const dt = new Date(`${iso}T00:00:00Z`);
                // Availability speaks only when it's bad news — a number on
                // every cell turns the calendar into a spreadsheet.
                const left = b.leftOn(iso); const full = !dOff && left !== null && left < 1; const low = !full && left !== null && b.isLow(iso, left);
                const dot = dOff || left === null ? null : full ? "#dc2626" : low ? "#f59e0b" : "#16a34a";
                const waiting = b.waitSel.includes(iso);
                const queueable = full && b.waitlistOn && !dOff;
                return <button key={iso} type="button" disabled={dOff || (full && !queueable)}
                  onClick={() => (queueable ? b.toggleWait(iso) : b.pickDay(iso, w.mon))}
                  title={full ? (queueable ? (waiting ? "On your waiting list — tap to remove" : "Full — tap to join the waiting list") : "Full") : left === null ? undefined : d.showSpaces ? (low ? `Only ${left} left` : `${left} places left`) : (low ? "Almost full" : "Space available")}
                  className="relative flex w-[44px] flex-col items-center rounded-xl border-2 py-1.5 disabled:cursor-not-allowed"
                  style={waiting ? { borderColor: "#c2410c", color: "#c2410c", background: "#fff7ed" }
                    : dOff || full ? { borderColor: LINEp, color: "#c8ccd4", background: "#fafbfd" }
                    : on ? { borderColor: BLUE, color: "#fff", background: BLUE } : { borderColor: LINEp, color: INKp, background: "#fff" }}>
                  <span className="text-[9px] font-bold uppercase">{dt.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })}</span>
                  <span className="text-[14px] font-extrabold leading-none" style={full ? { textDecoration: "line-through" } : undefined}>{dt.getUTCDate()}</span>
                  {dot && <span className="absolute -bottom-[3px] h-1.5 w-1.5 rounded-full" style={{ background: dot }} />}
                </button>; })}</div>
            </div>)}
          </div> : <div className="rounded-2xl border-2 border-dashed p-3.5 text-center text-[12px] text-[#a6adba]" style={{ borderColor: LINEp }}>Set the dates in “When it runs”.</div>}
          {b.hasCounts && (
            <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] font-semibold" style={{ color: MUTp }}>
              {([["#16a34a", "Space"], ["#f59e0b", "Almost full"], ["#dc2626", "Full"]] as const).map(([c, l]) => (
                <span key={l} className="inline-flex items-center gap-1.5"><span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: c }} />{l}</span>
              ))}
            </div>
          )}
          {(() => {
            const note = capacityNote(d, b.seatsLeft ?? spacesLeft);
            if (!note) return null;
            // Same traffic light as the calendar — a different green here made
            // the key look like it belonged to something else.
            const col = note.tone === "gone" ? "#dc2626" : note.tone === "low" ? "#f59e0b" : "#16a34a";
            return <div className="mt-3 flex items-center gap-1.5 text-[12px] font-bold" style={{ color: col }}>
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: col }} />{note.text}</div>;
          })()}
          <WaitlistPanel b={b} d={d} tone="light" />
          {/* Once something's in the basket the button has nothing to do until
              more dates are picked, so it goes and says why instead. */}
          {b.basket.length > 0 && b.sel.length === 0 && !b.canAdd ? (
            <div className="mt-4 flex items-start gap-2.5 rounded-2xl px-4 py-3" style={{ background: "#e4f8ee" }}>
              <span className="aos-point-inline text-[22px] leading-none" aria-hidden>👆</span>
              <p className="text-[12.5px] leading-[1.5]" style={{ color: "#0f5132" }}>
                <b>In your basket.</b> Pick more dates above if you&rsquo;d like another pass — otherwise carry on below.
              </p>
            </div>
          ) : (
          <div className="relative mt-11">
          <button className={`w-full rounded-2xl py-3.5 text-[14px] font-extrabold text-white disabled:opacity-40 ${b.canAdd ? "aos-ready" : ""}`} style={{ background: BLUE, ["--aos-ready-ring" as string]: "rgba(47,107,216,.5)" } as React.CSSProperties} disabled={!b.canAdd} onClick={b.addToBasket}>
            {b.locked ? "Booking not open yet" : b.soldOut ? (d.waitlist ? "Sold out — join the waiting list" : "Sold out") : !b.hasSpace ? (b.fullDates.length === 1 ? `${fmtDate(b.fullDates[0])} is full` : `${b.fullDates.length} of those days are full`) : b.canAdd ? (
              <span className="inline-flex flex-wrap items-baseline justify-center gap-x-2">
                <span>Add {b.isSingle ? `${b.sel.length} × ${b.pass?.name}` : b.pass?.name} to basket</span>
                <span className="inline-flex items-baseline gap-1.5">
                  {b.addNet < b.pendingGross && <s className="opacity-60">{money(b.pendingGross)}</s>}
                  <span>{money(b.addNet)}</span>
                </span>
              </span>
            ) : b.isSingle ? "Pick at least one day" : b.pass ? `Select ${Math.max(0, b.need - b.sel.length)} more day${b.need - b.sel.length === 1 ? "" : "s"}` : "Pick a pass"}
          </button>
          {b.canAdd && <span className="aos-point" aria-hidden>👇</span>}
          </div>
          )}
          {b.addPreview && (
            <div className="mt-2 rounded-2xl p-3" style={{ background: "#e4f8ee" }}>
              <div className="text-[10px] font-extrabold uppercase tracking-[0.1em]" style={{ color: "#047857" }}>
                ⚡ {b.addPreview.lines.length === 1 ? "Discount applied" : `${b.addPreview.lines.length} discounts applied`}
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
                <span className="text-[11.5px] font-bold" style={{ color: "#0f766e" }}>You&apos;ll pay</span>
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
        <div className="mb-2 flex items-center justify-between"><span className="text-[13.5px] font-extrabold" style={{ color: INKp }}>Your basket</span><span className="rounded-full px-2 py-[2px] text-[10px] font-extrabold" style={{ background: SOFTb, color: BLUE }}>{b.basket.length}</span></div>
        {b.basket.length === 0 ? <div className="text-[12.5px] text-[#a6adba]">Nothing added yet — pick a pass and dates.</div> :
          <div className="flex flex-col gap-1.5">{b.basket.map((x) => <div key={x.id} className="flex items-start justify-between gap-2 rounded-xl px-2.5 py-2 text-[12px]" style={{ background: "#f4f7ff" }}><span className="min-w-0"><b className="block" style={{ color: INKp }}>{x.name}</b><span className="block text-[11px] leading-snug" style={{ color: "#5b6478" }}>{b.datesPretty(x.dates)}</span>{x.timing ? <span className="block text-[11px] font-bold" style={{ color: BLUE }}>🕘 {x.timing}</span> : null}</span><span className="flex items-baseline gap-2"><b style={{ color: INKp }}>{money(x.price)}</b><button type="button" onClick={() => b.removeItem(x.id)} className="text-[#c8ccd4] hover:text-[#e21d27]">✕</button></span></div>)}</div>}
        {b.basket.length > 0 && b.discountLines.length > 0 && (
          <div className="mt-2 rounded-xl p-2" style={{ background: "#e4f8ee" }}>
            {b.discountLines.map((l, i) => (
              <div key={i} className="flex items-baseline justify-between text-[11.5px]" style={{ color: "#047857" }}>
                <span className="pr-2">🎉 {l.name}</span><b>−{money(l.amount)}</b>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 flex items-center justify-between text-[14px]">
          <span className="text-[#7a8194]">Total</span>
          <span className="flex items-baseline gap-2">
            {b.saved > 0 && <s className="text-[12px] text-[#a6adba]">{money(b.subtotal)}</s>}
            <b style={{ color: DEEP }}>{money(b.total)}</b>
          </span>
        </div>
        <button className="mt-3 w-full rounded-2xl py-3.5 text-[14px] font-extrabold text-white disabled:opacity-40" style={{ background: DEEP }} disabled={b.basket.length === 0} onClick={() => b.setStage("checkout")}>{mode === "parent" ? "Next — add children" : `Checkout (${b.basket.length})`}</button>
      </div>
    </div>
  );
}

// ── Booking · SPORT (dark, electric, lime) ─────────────────────────────────
function SportBooking({ b, d, booking, weeks, spacesLeft, addons, mode, onBook, bookState, surf, tenantId }: BookView & { surf: Surf }) {
  const EL = "#0047ff", LIME = "#c6ff00", MUTs = "#adb8ca";
  const LINEs = surf.line, PANEL = surf.panel, CELL = surf.cell, CELLOFF = surf.cellOff;
  const idle = { background: CELL, color: "#dfe6f2", borderColor: LINEs };
  // Numbered so the order to work through is obvious. Timing is skipped when
  // the block has none, so dates become step 2.
  const step = (n: number, text: string) => (
    <div className="mb-2 mt-4 flex items-center gap-2">
      <span className="flex h-[18px] w-[18px] items-center justify-center text-[10px] font-black" style={{ background: LIME, color: "#12280a" }}>{n}</span>
      <span className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: MUTs }}>{text}</span>
    </div>
  );
  const on = { background: "rgba(198,255,0,.1)", color: LIME, borderColor: LIME };
  const skew = { transform: "skewX(-6deg)" } as const, unskew = { display: "inline-block", transform: "skewX(6deg)" } as const;
  const wrap = "border", wrapStyle = { borderColor: LINEs, background: PANEL };
  if (b.stage === "done") return (
    <div className={wrap} style={wrapStyle}>
      <div className="p-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center text-[26px] font-black" style={{ background: LIME, color: "#12280a" }}>✓</div>
        <div className="mt-3 text-[18px] font-black italic uppercase tracking-[-0.01em] text-white">Booked{b.child ? ` · ${b.child}` : ""}</div>
        <div className="mt-2 text-[12.5px] text-[#8f9bb0]">{d.bookingType === "auto" ? "Instantly confirmed." : "Provider will approve your booking."} Confirmation email incoming.</div>
        <button className="mt-4 px-6 py-2.5 text-[13px] font-black italic uppercase text-[#12280a]" style={{ ...skew, background: LIME }} onClick={b.reset}><span style={unskew}>Book again</span></button>
      </div>
    </div>
  );
  if (b.stage === "checkout") return (
    <div className={wrap} style={wrapStyle}>
      <div className="px-5 py-3.5 text-[18px] font-black italic uppercase text-white" style={{ background: `linear-gradient(120deg,${EL},#0090ff)` }}>Checkout</div>
      <CheckoutPanel b={b} d={d} addons={addons} mode={mode} onBook={onBook} booking={bookState} tenantId={tenantId} tk={{ bg: PANEL, line: LINEs, ink: "#ffffff", muted: MUTs, accent: LIME, accentInk: "#12280a", round: "", inputBg: CELL, bar: `linear-gradient(120deg,${EL},#0090ff)`, barInk: "#fff" }} />
    </div>
  );
  return (
    <div className={wrap} style={wrapStyle}>
      <div className="px-5 py-3.5" style={{ background: `linear-gradient(120deg,${EL},#0090ff)` }}>
        <div className="flex items-baseline justify-between">
          <span className="text-[18px] font-black italic uppercase text-white">Choose dates &amp; times</span>
          {b.pass && <span className="text-[12px] text-[#cfe8ff]">from <b className="italic text-white">{money(b.unitPrice)}</b></span>}
        </div>
        {b.hint && (
          <div className="mt-2 flex items-start gap-1.5 rounded bg-white/15 px-2.5 py-1.5 text-[11.5px] font-semibold text-white backdrop-blur-sm">
            <span aria-hidden>👉</span><span>{b.hint}</span>
          </div>
        )}
        {/* How close they are to the next discount. */}
        {b.nudge && (
          <div className="mt-1.5 flex items-start gap-1.5 rounded px-2.5 py-1.5 text-[11.5px] font-black" style={{ background: LIME, color: "#12280a" }}>
            <span aria-hidden>⚡</span><span>{b.nudge}</span>
          </div>
        )}
      </div>
      <div className="p-5">
        {b.passes.length === 0 ? <div className="text-[13px] text-[#8f9bb0]">Pick a block in Tickets &amp; pricing to enable booking.</div> : (
          <>
            {step(1, "Choose your pass")}
            <div className="flex flex-wrap gap-2">{b.passes.map((t) => <button key={t.id} type="button" onClick={() => b.setPassId(t.id)} className="border px-4 py-2 text-[12.5px] font-bold" style={t.id === b.passId ? on : idle}>{t.name} · {money(booking ? booking.priceFor(t.id, b.periodId) : t.basePrice)}</button>)}</div>
            {b.periods.length > 0 && <>
              {step(2, "Choose a timing")}
              <div className="flex flex-wrap gap-2">{b.periods.map((p) => <button key={p.id} type="button" onClick={() => b.setPeriodId(p.id)} className="border px-3.5 py-2 text-left text-[12px] font-bold leading-tight" style={p.id === b.periodId ? on : idle}>{p.range}{b.pass ? <span className="block text-[10px] font-semibold opacity-80">{p.title} · {money(booking!.priceFor(b.pass.id, p.id))}</span> : null}</button>)}</div>
            </>}
            {b.pass && step(b.periods.length ? 3 : 2, b.isSingle ? "Choose any dates" : "Choose your dates")}
            {weeks.length ? <div className="flex flex-col gap-3">{weeks.slice(0, 8).map((w) => <div key={w.mon}>
              <div className="mb-1.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-[#8f9bb0]">Week {w.n} · from {fmtDate(w.mon)}</div>
              <div className="flex flex-wrap gap-1.5">{w.days.map((iso) => {
                const dOff = b.off(iso); const sel = b.sel.includes(iso); const dt = new Date(`${iso}T00:00:00Z`);
                const left = b.leftOn(iso); const full = !dOff && left !== null && left < 1; const low = !full && left !== null && b.isLow(iso, left);
                const dot = dOff || left === null ? null : full ? "#ff5470" : low ? "#ffb020" : "#3ddc84";
                const waiting = b.waitSel.includes(iso);
                const queueable = full && b.waitlistOn && !dOff;
                return <button key={iso} type="button" disabled={dOff || (full && !queueable)}
                  onClick={() => (queueable ? b.toggleWait(iso) : b.pickDay(iso, w.mon))}
                  title={full ? (queueable ? (waiting ? "On your waiting list — tap to remove" : "Full — tap to join the waiting list") : "Full") : left === null ? undefined : d.showSpaces ? (low ? `Only ${left} left` : `${left} places left`) : (low ? "Almost full" : "Space available")}
                  className="relative flex w-[44px] flex-col items-center border py-1.5 disabled:cursor-not-allowed"
                  style={waiting ? { borderColor: "#ffb020", color: "#ffb020", background: "#2a2110" }
                    : dOff || full ? { borderColor: LINEs, color: "#5a6478", background: CELLOFF }
                    : sel ? { borderColor: LIME, color: "#12280a", background: LIME } : { borderColor: LINEs, color: "#fff", background: CELL }}>
                  <span className="text-[9px] font-bold uppercase">{dt.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })}</span>
                  <span className="text-[14px] font-black leading-none" style={full ? { textDecoration: "line-through" } : undefined}>{dt.getUTCDate()}</span>
                  {dot && <span className="absolute -bottom-[3px] h-1.5 w-1.5" style={{ background: dot }} />}
                </button>; })}</div>
            </div>)}</div> : <div className="border border-dashed p-3.5 text-center text-[12px] text-[#6a7488]" style={{ borderColor: LINEs }}>Set the dates in “When it runs”.</div>}
            {b.hasCounts && (
              <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] font-bold" style={{ color: MUTs }}>
                {([["#3ddc84", "Space"], ["#ffb020", "Almost full"], ["#ff5470", "Full"]] as const).map(([c, l]) => (
                  <span key={l} className="inline-flex items-center gap-1.5"><span className="inline-block h-1.5 w-1.5" style={{ background: c }} />{l}</span>
                ))}
              </div>
            )}
            {(() => {
              const note = capacityNote(d, b.seatsLeft ?? spacesLeft);
              if (!note) return null;
              const col = note.tone === "gone" ? "#ff5470" : note.tone === "low" ? "#ffb020" : "#3ddc84";
              return <div className="mt-3 flex items-center gap-1.5 text-[12px] font-bold" style={{ color: col }}>
                <span className="inline-block h-2 w-2" style={{ background: col }} />{note.text}</div>;
            })()}
            <WaitlistPanel b={b} d={d} tone="dark" />
            {b.basket.length > 0 && b.sel.length === 0 && !b.canAdd ? (
              <div className="mt-4 flex items-start gap-2.5 border p-3" style={{ borderColor: LIME, background: CELL }}>
                <span className="aos-point-inline text-[22px] leading-none" aria-hidden>👆</span>
                <p className="text-[12.5px] leading-[1.5]" style={{ color: "#d7ffa8" }}>
                  <b>In your basket.</b> Pick more dates above if you&rsquo;d like another pass — otherwise carry on below.
                </p>
              </div>
            ) : (
            <div className="relative mt-11">
            <button className={`w-full py-3.5 text-[13px] font-black italic uppercase text-[#12280a] disabled:opacity-40 ${b.canAdd ? "aos-ready" : ""}`} style={{ ...skew, background: LIME, ["--aos-ready-ring" as string]: "rgba(198,255,0,.55)" } as React.CSSProperties} disabled={!b.canAdd} onClick={b.addToBasket}><span style={unskew}>
                {b.locked ? "Booking not open yet" : b.soldOut ? (d.waitlist ? "Sold out — join the waiting list" : "Sold out") : !b.hasSpace ? (b.fullDates.length === 1 ? `${fmtDate(b.fullDates[0])} is full` : `${b.fullDates.length} of those days are full`) : b.canAdd ? (
                  <span className="inline-flex flex-wrap items-baseline justify-center gap-x-2">
                    <span>Add {b.isSingle ? `${b.sel.length} × ${b.pass?.name}` : b.pass?.name} to basket</span>
                    <span className="inline-flex items-baseline gap-1.5">
                      {b.addNet < b.pendingGross && <s className="opacity-60">{money(b.pendingGross)}</s>}
                      <span>{money(b.addNet)}</span>
                    </span>
                  </span>
                ) : b.isSingle ? "Pick at least one day" : b.pass ? `Select ${Math.max(0, b.need - b.sel.length)} more` : "Pick a pass"}
              </span></button>
            {b.canAdd && <span className="aos-point" aria-hidden>👇</span>}
            </div>
            )}
            {b.addPreview && (
              <div className="mt-2 border-l-[3px] p-3" style={{ borderLeftColor: LIME, background: CELL }}>
                <div className="text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: LIME }}>
                  ⚡ {b.addPreview.lines.length === 1 ? "Discount applied" : `${b.addPreview.lines.length} discounts applied`}
                </div>
                <div className="mt-1.5 flex flex-col gap-1">
                  {b.addPreview.lines.map((l, i) => (
                    <div key={i} className="flex items-start justify-between gap-3 text-[11.5px]">
                      <span className="min-w-0">
                        <span className="block" style={{ color: "#c3ccdb" }}>{l.name}</span>
                        <span className="block text-[10px]" style={{ color: MUTs }}>{l.scope}</span>
                      </span>
                      <b className="flex-none" style={{ color: LIME }}>−{money(l.amount)}</b>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-baseline justify-between border-t pt-2" style={{ borderColor: LINEs }}>
                  <span className="text-[11.5px] font-bold" style={{ color: MUTs }}>You&apos;ll pay</span>
                  <span className="flex items-baseline gap-2">
                    <s className="text-[11px]" style={{ color: MUTs }}>{money(b.addPreview.gross)}</s>
                    <b className="text-[16px] font-black italic uppercase text-white">{money(b.addPreview.total)}</b>
                  </span>
                </div>
              </div>
            )}
          </>
        )}
        <div className="mt-5 border-t pt-4" style={{ borderColor: LINEs }}>
          <div className="mb-2 flex items-center justify-between"><span className="text-[13px] font-black italic uppercase text-white">Your basket</span><span className="px-2 py-[2px] text-[10px] font-black" style={{ background: CELL, color: LIME }}>{b.basket.length}</span></div>
          {b.basket.length === 0 ? <div className="text-[12.5px] text-[#6a7488]">Nothing added yet — pick a pass and dates.</div> :
            <div className="flex flex-col gap-1.5">{b.basket.map((x) => <div key={x.id} className="flex items-start justify-between gap-2 text-[12px] text-[#c3ccdb]"><span className="min-w-0"><b className="block text-white">{x.name}</b><span className="block text-[11px] leading-snug" style={{ color: MUTs }}>{b.datesPretty(x.dates)}</span>{x.timing ? <span className="block text-[11px] font-bold" style={{ color: LIME }}>🕘 {x.timing}</span> : null}</span><span className="flex items-baseline gap-2"><b className="text-white">{money(x.price)}</b><button type="button" onClick={() => b.removeItem(x.id)} className="text-[#5c6678] hover:text-[#ff5d5d]">✕</button></span></div>)}</div>}
          {b.basket.length > 0 && b.discountLines.length > 0 && (
            <div className="mt-2 border p-2" style={{ borderColor: LIME, background: "rgba(198,255,0,.08)" }}>
              {b.discountLines.map((l, i) => (
                <div key={i} className="flex items-baseline justify-between text-[11.5px]" style={{ color: LIME }}>
                  <span className="pr-2">{l.name}</span><b>−{money(l.amount)}</b>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 flex items-center justify-between text-[14px]">
            <span style={{ color: MUTs }}>Total</span>
            <span className="flex items-baseline gap-2">
              {b.saved > 0 && <s className="text-[12px]" style={{ color: MUTs }}>{money(b.subtotal)}</s>}
              <b className="italic text-white">{money(b.total)}</b>
            </span>
          </div>
          <button className="mt-3 w-full py-3.5 text-[13px] font-black italic uppercase text-[#12280a] disabled:opacity-40" style={{ ...skew, background: LIME }} disabled={b.basket.length === 0} onClick={() => b.setStage("checkout")}><span style={unskew}>{mode === "parent" ? "Next — add children" : `Checkout (${b.basket.length})`}</span></button>
        </div>
      </div>
    </div>
  );
}

function ParentPreview({ d, venue, local, booking, addons, blocks, mode, onBook, bookState, full, theme = "playful", onTheme, brand, tenantId }: {
  d: WizardDraft; venue: Venue | null; local: LocalState; blocks?: RunBlock[];
  mode?: "operator" | "parent"; onBook?: (p: { method: string; voucherScheme?: string; basket: BasketItem[]; addonSel: Record<string, Record<string, string[]>>; addonAns: Record<string, Record<string, string>>; children: ChildProfile[]; dayAssign: Record<string, Record<string, string[]>> }) => void; bookState?: { busy: boolean; error: string | null };
  booking: BlockBooking | null; addons: LocalState["addons"]; full?: boolean;
  theme?: PageTheme; onTheme?: (t: PageTheme) => void;
  /** The provider's brand in the page header. Defaults to the signed-in
   * account (right for the operator's own preview, wrong for a parent). */
  brand?: string;
  /** The listing's tenant, so a signed-out parent can read that provider's
   *  public settings (vouchers, child questions). */
  tenantId?: string;
}) {
  const cats = local.categories.filter((c) => d.categoryIds.includes(c.id));
  const imgs = d.images;
  const town = venue?.address?.split(",").slice(-1)[0]?.trim() || venue?.address || "";
  const runLabel = d.runFrom && d.runTo ? `${fmtDate(d.runFrom)} – ${fmtDate(d.runTo)}` : "Dates TBC";
  const dates = genDates(d.runFrom, d.runTo, d.days);
  const weeks = groupWeeks(dates);
  // Blank capacity means "not set", not zero — `|| 0` was showing "Sold out"
  // on listings that had never had a limit typed in.
  const capParsed = parseInt(d.maxAttendees, 10);
  const spacesLeft = d.showSpaces && Number.isFinite(capParsed) ? capParsed : null;
  const staff = local.staff.filter((m) => d.staffIds.includes(m.id));
  const staffNames = staff.map((m) => `${m.first} ${m.last}`.trim()).filter(Boolean);
  const emo = (o: string, fb: string) => OPT_EMOJI[o] || local.emojis?.[o] || fb;

  const fromPrice = booking && booking.passes.length ? Math.min(...booking.passes.map((pp) => pp.basePrice)) : null;
  // "5 day pass from £150" reads far better than a bare "from £30". Cap at 3
  // so the row always fits.
  const passSummary = (booking?.passes ?? []).slice(0, 3).map((pp) => ({ name: pp.name, price: pp.basePrice }));
  // Which category sits on the hero image when several are chosen.
  const heroCat = cats.find((c) => c.id === d.heroCategoryId) ?? cats[0] ?? null;
  const widget = <BookingWidget d={d} booking={booking} weeks={weeks} spacesLeft={spacesLeft} addons={addons} blocks={blocks} mode={mode} onBook={onBook} bookState={bookState} theme={theme} tenantId={tenantId} />;
  const opens = useOpensAt(d.opensAt);
  const p: PageProps = { d, venue, cats, heroCat, town, runLabel, staff, staffNames, addons, imgs, widget, full, emo, fromPrice, passSummary, spacesLeft, whereHead: whereHeading(local), opens, blocks, brand: brand ?? myBrand() };

  const LABEL: Record<PageTheme, string> = { playful: "A · Playful", sport: "B · Sport", navy: "C · Navy" };
  const flick = onTheme ? (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[var(--ink-3)]">Page style</span>
      <div className="inline-flex rounded-full border border-[var(--line)] bg-[var(--panel)] p-0.5">
        {(["playful", "sport", "navy"] as PageTheme[]).map((t) => (
          <button key={t} type="button" onClick={() => onTheme(t)} className="rounded-full px-3 py-1 text-[11.5px] font-bold transition-colors" style={theme === t ? { background: "var(--brand)", color: "#fff" } : { color: "var(--ink-3)" }}>{LABEL[t]}</button>
        ))}
      </div>
    </div>
  ) : null;

  return (
    <div>
      {flick}
      {theme === "playful" ? <PlayfulPage {...p} /> : <SportPage {...p} surf={theme === "navy" ? SPORT_NAVY : SPORT_BLACK} />}
    </div>
  );
}

interface PageProps {
  d: WizardDraft; venue: Venue | null; cats: { id: string; name: string }[];
  heroCat: { id: string; name: string } | null;
  town: string; runLabel: string; staff: LocalState["staff"]; staffNames: string[];
  addons: LocalState["addons"]; imgs: ListingImage[];
  widget: React.ReactNode; full?: boolean; emo: (o: string, fb: string) => string;
  fromPrice: number | null; passSummary: { name: string; price: number }[]; spacesLeft: number | null;
  /** Set once in Locations, not per listing. */
  whereHead: { eyebrow: string; title: string };
  opens: { locked: boolean; countdown: string; opensLabel: string };
  blocks?: RunBlock[];
  brand: string;
}
const HERO_FALLBACK = "linear-gradient(160deg,#7fd4d6,#2f7fae 55%,#1b4a6b)";
// Dark surfaces for the Sport-style pages — swappable so the same design can be
// near-black (Sport) or portal navy (Navy). Accents stay electric-blue + lime.
type Surf = { bg: string; panel: string; line: string; cell: string; cellOff: string };
const SPORT_BLACK: Surf = { bg: "#0b0d12", panel: "#12161f", line: "#1e2430", cell: "#0e131c", cellOff: "#0c0f16" };
const SPORT_NAVY: Surf = { bg: "#101d42", panel: "#1a2c5e", line: "#2b3d74", cell: "#152552", cellOff: "#0e1a3c" };
// Rolling hero carousel — auto-advances + arrows/dots when there's >1 photo.
function HeroImages({ imgs, fallback }: { imgs: ListingImage[]; fallback: string }) {
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
          <button type="button" aria-label="Previous photo" onClick={() => setI((x) => (x - 1 + n) % n)} className="absolute left-2 top-1/2 z-[3] flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-[18px] text-white backdrop-blur-sm hover:bg-black/55">‹</button>
          <button type="button" aria-label="Next photo" onClick={() => setI((x) => (x + 1) % n)} className="absolute right-2 top-1/2 z-[3] flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-[18px] text-white backdrop-blur-sm hover:bg-black/55">›</button>
          <div className="absolute inset-x-0 bottom-3 z-[3] flex justify-center gap-1.5">
            {imgs.map((_, idx) => <button key={idx} type="button" aria-label={`Photo ${idx + 1}`} onClick={() => setI(idx)} className="h-1.5 rounded-full transition-all" style={{ width: idx === cur ? 18 : 6, background: idx === cur ? "#fff" : "rgba(255,255,255,.55)" }} />)}
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
      {sub && <p className="mb-3 ml-[46px] text-[12.5px] text-[#7a8194]">{sub}</p>}
      <div className={sub ? "" : "mt-3"}>{children}</div>
    </div>
  );
}
// Bordered row + section header for the Sport page.
function SportRow({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-2.5 border border-l-[3px] px-3.5 py-3 text-[13.5px] font-bold text-white" style={{ borderColor: "#1e2430", borderLeftColor: "#c6ff00", background: "#12161f" }}>{children}</div>;
}
function SportSec({ eye, title, children }: { eye: string; title: string; children: React.ReactNode }) {
  return (
    <div className="border-t pt-6" style={{ borderColor: "#1e2430" }}>
      <div className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#c6ff00]">{eye}</div>
      <div className="mb-3 mt-1 text-[24px] font-black italic uppercase tracking-[-0.01em] text-white">{title}</div>
      {children}
    </div>
  );
}

// ── PAGE · PLAYFUL (bright, rounded, friendly) ─────────────────────────────
function PlayfulPage({ d, venue, whereHead, opens, cats, heroCat, town, runLabel, staff, addons, imgs, widget, full, emo, passSummary, brand }: PageProps) {
  const BLUE = "#2f6bd8", DEEP = "#1d3a8f", INKp = "#232842", MUTp = "#7a8194";
  const heroH = full ? 320 : 220;
  const chip = (o: string, fb: string, i: number) => (
    <div key={o} className="flex items-center gap-2.5 rounded-2xl bg-[#f4f7ff] px-3 py-2.5">
      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-xl text-[15px]" style={{ background: ["#e7f0ff", "#e4f8ee", "#fff0f5", "#fff6e0", "#e0f5ff"][i % 5] }}>{emo(o, fb)}</span>
      <b className="text-[13px]" style={{ color: INKp }}>{o}</b>
    </div>
  );
  const grid2 = full ? "grid-cols-2" : "grid-cols-1";
  const [teamOpen, setTeamOpen] = useState(true);
  const [whereOpen, setWhereOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-[26px] border border-[#e8edf7]" style={{ background: "#f4f7ff", fontFamily: '"Segoe UI",system-ui,sans-serif', boxShadow: full ? "0 40px 90px -60px rgba(30,50,90,.4)" : undefined }}>
      <div className="flex items-center justify-between bg-white px-6 py-4">
        <span className="text-[18px] font-extrabold tracking-[-0.02em]" style={{ color: BLUE }}>{brand}</span>
        <span className="rounded-full px-3.5 py-1.5 text-[11.5px] font-bold" style={{ background: "#fff6e0", color: "#c98a00" }}>★ Trusted provider</span>
      </div>
      <div className={full ? "p-6 lg:p-7" : "p-5"}>
        {/* title above the image */}
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
          {/* every chosen type, sized so the row always fits */}
          {/* Types in blue, location in muted grey — one colour ran them together. */}
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[10.5px] font-extrabold uppercase leading-tight tracking-[0.1em]">
            {cats.length ? cats.map((c, i) => (
              <span key={c.id} style={{ color: BLUE }}>{i > 0 && <span style={{ color: MUTp, opacity: 0.5 }}> / </span>}{c.name}</span>
            )) : <span style={{ color: BLUE }}>Holiday camp</span>}
            {town && (
              <>
                <span style={{ color: MUTp, opacity: 0.5 }}>|</span>
                <span style={{ color: MUTp }}>{town}</span>
              </>
            )}
          </div>
          <h1 className="mt-1 font-extrabold leading-[1.04] tracking-[-0.03em]" style={{ color: INKp, fontSize: full ? 34 : 24 }}>{d.title || "Your listing title"}</h1>
          </div>
          {opens.locked && (
            <div className="flex-none rounded-2xl px-3.5 py-2 text-right" style={{ background: "#eef3ff", border: `1.5px solid ${BLUE}` }}>
              <div className="text-[9.5px] font-extrabold uppercase tracking-[0.1em]" style={{ color: BLUE }}>⏰ Booking opens in</div>
              <div className="text-[17px] font-extrabold leading-tight tabular-nums" style={{ color: BLUE }}>{opens.countdown}</div>
              <div className="text-[10px]" style={{ color: MUTp }}>{opens.opensLabel}</div>
            </div>
          )}
        </div>
        {/* hero image (no text on it) */}
        <div className="relative overflow-hidden rounded-[28px]" style={{ height: heroH }}>
          <HeroImages imgs={imgs} fallback={HERO_FALLBACK} />
          {heroCat && <span className="absolute left-4 top-4 z-[2] rounded-full bg-white px-3.5 py-2 text-[12px] font-extrabold" style={{ color: BLUE, transform: "rotate(-3deg)" }}>🎉 {heroCat.name}</span>}
        </div>

        {/* pass prices — named, not a bare "from" figure */}
        {passSummary.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {passSummary.map((p) => (
              <span key={p.name} className="inline-flex items-baseline gap-1.5 rounded-full bg-white px-3.5 py-2" style={{ boxShadow: "0 2px 0 #e8edf7" }}>
                <span className="text-[11.5px] font-bold" style={{ color: MUTp }}>{p.name}</span>
                <span className="text-[13px] font-extrabold" style={{ color: DEEP, fontVariantNumeric: "tabular-nums" }}>from {money(p.price)}</span>
              </span>
            ))}
          </div>
        )}

        {/* fancy fact strip (under the image) */}
        <div className="relative z-10 mx-2 -mt-6 flex flex-col overflow-hidden rounded-2xl bg-white sm:flex-row" style={{ boxShadow: "0 18px 34px -18px rgba(30,50,90,.35)" }}>
          {([["📍", "Where", venue?.name || town || "Venue TBC", "#eef4ff"], ["📆", "When", runLabel, "#e4f8ee"], ["👧👦", "Ages", d.ageFrom && d.ageTo ? `${d.ageFrom}–${d.ageTo} years` : "All ages", "#fff0f5"]] as const).map(([e, k, v, tint], i) => (
            <div key={k} className={`flex flex-1 items-center gap-3 px-4 py-3.5 ${i ? "border-t border-[#eef2fb] sm:border-l sm:border-t-0" : ""}`}>
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl text-[16px]" style={{ background: tint }}>{e}</span>
              <div className="min-w-0"><div className="text-[9.5px] font-extrabold uppercase tracking-[0.1em] text-[#7a8194]">{k}</div><div className="truncate text-[13px] font-extrabold" style={{ color: DEEP }}>{v}</div></div>
            </div>
          ))}
        </div>

        <div className={`mt-5 ${full ? "grid items-start gap-6 lg:grid-cols-[1fr_360px]" : ""}`}>
          <div className="flex flex-col gap-4">
            {d.description && <div className="rounded-3xl bg-white p-5 text-[15px] leading-[1.7]" style={{ color: "#3d4763", boxShadow: "0 2px 0 #e8edf7" }}>{d.description}</div>}
            {!full && <div id="aos-book">{widget}</div>}
            {d.sections.some((s) => s.text) && <PlayCard e="🎯" tint="#e7f0ff" title={headingOf(d, "about", "title")}>{d.sections.filter((s) => s.text).map((s) => <div key={s.id} className="mb-3 last:mb-0"><div className="text-[11px] font-extrabold uppercase tracking-[0.06em]" style={{ color: BLUE }}>{s.type}</div><p className="mt-1 text-[13.5px] leading-[1.6]" style={{ color: "#3d4763" }}>{s.text}</p></div>)}</PlayCard>}
            {d.outcomes.length > 0 && <PlayCard e="🌟" tint="#fff6e0" title={headingOf(d, "learn", "title")} sub={headingOf(d, "learn", "eyebrow")}><div className={`grid gap-2 ${grid2}`}>{d.outcomes.map((o, i) => chip(o, "⭐", i))}</div></PlayCard>}
            {d.provided.length > 0 && <PlayCard e="🎒" tint="#e4f8ee" title={headingOf(d, "included", "title")} sub={headingOf(d, "included", "eyebrow")}><div className={`grid gap-2 ${grid2}`}>{d.provided.map((o, i) => chip(o, "✅", i))}</div></PlayCard>}
            {d.safety.length > 0 && <PlayCard e="🛡️" tint="#fff0f5" title={headingOf(d, "safety", "title")} sub={headingOf(d, "safety", "eyebrow")}><div className={`grid gap-2 ${grid2}`}>{d.safety.map((o, i) => chip(o, "🚑", i))}</div></PlayCard>}
            {d.send.length > 0 && <PlayCard e="🤝" tint="#e0f5ff" title={headingOf(d, "send", "title")} sub={headingOf(d, "send", "eyebrow")}><div className={`grid gap-2 ${grid2}`}>{d.send.map((o, i) => chip(o, "♿", i))}</div></PlayCard>}
            {venue && (isOnlineVenue(venue) || venue.address || venue.lat !== undefined || venue.directions || venue.facilities?.length || venue.what3words || venue.transport) && (
              <div className="rounded-3xl bg-white p-5" style={{ boxShadow: "0 2px 0 #e8edf7" }}>
                <button type="button" onClick={() => setWhereOpen((o) => !o)} className="flex w-full items-center justify-between text-left">
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
                {isOnlineVenue(venue) ? <div className="mt-0.5 text-[13px]" style={{ color: MUTp }}>💻 Runs online</div> : venue.address && <div className="mt-0.5 text-[13px]" style={{ color: MUTp }}>{venue.address}</div>}
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
                      <span className="rounded-2xl px-3 py-2 font-bold" style={{ background: "#e4f8ee", color: "#0f7a44" }}>🚌 {venue.transport}</span>
                    )}
                  </div>
                )}
                {venue.directions && (
                  <div className="mt-3 rounded-2xl p-3.5" style={{ background: "#f4f7ff" }}>
                    <div className="text-[11px] font-extrabold uppercase tracking-[0.06em]" style={{ color: BLUE }}>{isOnlineVenue(venue) ? "How to join" : "Getting there & parking"}</div>
                    <p className="mt-1 whitespace-pre-line text-[13px] leading-[1.6]" style={{ color: "#3d4763" }}>{venue.directions}</p>
                  </div>
                )}
                </div>)}
              </div>
            )}
            {staff.length > 0 && (
              <div className="rounded-3xl bg-white p-5" style={{ boxShadow: "0 2px 0 #e8edf7" }}>
                <button type="button" onClick={() => setTeamOpen((o) => !o)} className="flex w-full items-center justify-between text-left">
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
            )}{a.name}</span><b style={{ color: DEEP }}>{money(a.price)}</b></div>)}</div></PlayCard>}
            {d.gallery.length > 0 && <PlayCard e="📸" tint="#fff6e0" title={headingOf(d, "gallery", "title")}><div className={`grid gap-2.5 ${full ? "grid-cols-4" : "grid-cols-3"}`}>{d.gallery.map((im, i) => <CroppedImage key={i} im={im} className="rounded-2xl" style={{ aspectRatio: "1 / 1" }} />)}</div></PlayCard>}
          </div>
          {full && <div id="aos-book" className="self-start lg:sticky lg:top-4">{widget}</div>}
        </div>

        {/* footer */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl px-6 py-5" style={{ background: DEEP, color: "#cdd8f0" }}>
          <div className="text-[17px] font-extrabold text-white">{brand}</div>
          <div className="text-[11px] opacity-70">Bookings powered by ActivityOS</div>
        </div>
      </div>
    </div>
  );
}

// ── PAGE · SPORT (dark, electric, athletic) ────────────────────────────────
function SportPage({ d, venue, whereHead, opens, blocks, staffNames, cats, heroCat, town, runLabel, staff, addons, imgs, widget, full, emo, passSummary, spacesLeft, surf, brand }: PageProps & { surf: Surf }) {
  const EL = "#0047ff", LIME = "#c6ff00", CY = "#00c2ff", MUTs = "#adb8ca";
  const BG = surf.bg, PANEL = surf.panel, LINEs = surf.line;
  const cond = "italic uppercase tracking-[-0.01em]";
  const grid2 = full ? "grid-cols-2" : "grid-cols-1";
  const heroH = full ? 340 : 240;
  const [teamOpen, setTeamOpen] = useState(true);
  const [whereOpen, setWhereOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-[18px] border" style={{ background: BG, color: "#fff", borderColor: LINEs, fontFamily: "system-ui,-apple-system,sans-serif" }}>
      <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: LINEs }}>
        <span className={`text-[18px] font-black ${cond}`}>{brand}</span>
        <span className="text-[11px]" style={{ color: MUTs }}>Secure checkout</span>
      </div>
      {/* title above the image — every chosen type listed, sized to fit */}
      <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-6">
        <div className="min-w-0 flex-1">
        {/* Types in lime, location in cyan — one colour for both ran them together. */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-black uppercase leading-tight tracking-[0.12em]">
          {cats.length ? cats.map((c, i) => (
            <span key={c.id} className="inline-flex items-center gap-2">
              {i > 0 && <span style={{ color: MUTs, opacity: 0.5 }}>/</span>}
              <span style={{ color: LIME }}>{c.name}</span>
            </span>
          )) : <span style={{ color: LIME }}>Holiday camp</span>}
          {town && (
            <>
              <span style={{ color: MUTs, opacity: 0.5 }}>|</span>
              <span style={{ color: CY }}>{town}</span>
            </>
          )}
        </div>
        <h1 className={`mt-1.5 font-black ${cond}`} style={{ fontSize: full ? 48 : 30, lineHeight: .92, color: "#fff" }}>{d.title || "Your listing title"}</h1>
        </div>
        {opens.locked && (
          <div className="flex-none border px-3.5 py-2 text-right" style={{ borderColor: LIME, background: PANEL }}>
            <div className="text-[9.5px] font-black uppercase tracking-[0.12em]" style={{ color: LIME }}>⏰ Booking opens in</div>
            <div className="text-[17px] font-black leading-tight tabular-nums text-white">{opens.countdown}</div>
            <div className="text-[10px]" style={{ color: MUTs }}>{opens.opensLabel}</div>
          </div>
        )}
      </div>
      {/* hero image (no text on it) */}
      <div className="relative overflow-hidden" style={{ height: heroH }}>
        <HeroImages imgs={imgs} fallback={`linear-gradient(120deg,${EL},#00a3ff 70%,#003)`} />
        <div className="pointer-events-none absolute inset-0 z-[1]" style={{ backgroundImage: "repeating-linear-gradient(115deg,transparent 0 46px,rgba(255,255,255,.05) 46px 48px)" }} />
        {heroCat && <span className="absolute left-6 top-5 z-[2] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.1em] text-[#12280a]" style={{ background: LIME, transform: "skewX(-8deg)" }}>{heroCat.name}</span>}
      </div>
      {/* fancy info strip (under the image) */}
      <div className="flex flex-col border-y sm:flex-row" style={{ borderColor: LINEs, background: PANEL }}>
        {([["📍", venue?.name || town || "Venue TBC"], ["📆", runLabel], ["👧👦", d.ageFrom && d.ageTo ? `Ages ${d.ageFrom}–${d.ageTo}` : "All ages"]] as const).map(([e, v], i) => (
          <div key={i} className={`flex flex-1 items-center gap-2.5 px-5 py-3 ${i ? "border-t sm:border-l sm:border-t-0" : ""}`} style={i ? { borderColor: LINEs } : undefined}>
            <span className="text-[15px]">{e}</span>
            <span className="truncate text-[12px] font-bold uppercase tracking-[0.05em] text-white">{v}</span>
            <span className="ml-auto h-2 w-2 flex-none" style={{ background: LIME }} />
          </div>
        ))}
      </div>
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
          const tile = "min-w-0 flex-1 border-b border-l px-4 py-3.5 first:border-l-0";
          const wide = tile;
          const lab = "truncate text-[9.5px] font-bold uppercase tracking-[0.12em]";
          return (
            <div className="mt-5 border" style={{ borderColor: LINEs, background: PANEL }}>
             <div className="flex flex-col sm:flex-row">
              {/* Ages already appear in the facts strip above the image — this
                  slot earns more as the team, names visible, bios on tap. */}
              {staff.length > 0 && (
                <button type="button" onClick={() => setTeamOpen((o) => !o)}
                  className={`${wide} flex flex-col text-left`} style={{ borderColor: LINEs, borderTop: `2px solid ${LIME}` }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className={lab} style={{ color: MUTs }}>{headingOf(d, "team", "eyebrow")}</div>
                      <div className={`mt-1 truncate text-[15px] font-black ${cond} text-white`}>{headingOf(d, "team", "title")}</div>
                      <div className="mt-1 truncate text-[11px]" style={{ color: "#c3ccdb" }}>{staffNames.join(" · ")}</div>
                    </div>
                    <span className="flex h-5 w-5 flex-none items-center justify-center text-[14px] font-black" style={{ background: LIME, color: "#12280a" }}>{teamOpen ? "–" : "+"}</span>
                  </div>
                </button>
              )}
              {/* "Show spaces" hides the numbers here — the calendar keeps its
                  colours either way, so a parent can still see which days are
                  going without being shown a running total. */}
              {d.showSpaces && (
              <div className={wide} style={{ borderColor: LINEs, borderTop: `2px solid ${LIME}` }}>
                <div className={lab} style={{ color: MUTs }}>spaces</div>
                {(() => {
                  // Totals come from the real runs when there are any. They
                  // legitimately differ by scope: 20/day over ten days is 200
                  // places, 60 across the camp is 60 — so read, don't assume.
                  // No dated runs means no bookings to count. Showing
                  // "0 booked · 0% full" there states a fact we don't have —
                  // it's what made a listing with a booking look empty.
                  if (!blocks?.length) {
                    return spacesLeft === null
                      ? <div className={`mt-1 text-[18px] font-black ${cond} text-white`}>—</div>
                      : (<>
                          <div className={`mt-1 truncate text-[18px] font-black ${cond} text-white`}>Up to {spacesLeft}</div>
                          <div className="mt-1 text-[10.5px]" style={{ color: MUTs }}>Bookings show once the run is saved</div>
                        </>);
                  }
                  const total = blocks.reduce((n, x) => n + x.capacity, 0);
                  const left = blocks.reduce((n, x) => n + x.spotsLeft, 0);
                  const used = Math.max(0, total - left);
                  const pct = total > 0 ? Math.round((used / total) * 100) : 0;
                  return (
                    <>
                      <div className={`mt-1 truncate text-[18px] font-black ${cond}`}
                        style={{ fontVariantNumeric: "tabular-nums", color: left <= 0 ? "#ff5470" : "#fff" }}>
                        {left <= 0 ? "Sold out" : `${left} of ${total} left`}
                      </div>
                      <div className="mt-1.5 h-1 w-full" style={{ background: "#26304a" }}>
                        <div className="h-full" style={{ width: `${pct}%`, background: left <= 0 ? "#ff5470" : LIME }} />
                      </div>
                      <div className="mt-1 text-[10.5px]" style={{ color: MUTs }}>{used} booked · {pct}% full</div>
                    </>
                  );
                })()}
                {(() => {
                  // Counted in dates, because that's the unit a parent books in
                  // — "15 places left" doesn't say whether the days they want
                  // are among them.
                  const dates = genDates(d.runFrom, d.runTo, d.days).filter((x) => !(d.datesOff ?? []).includes(x));
                  if (!dates.length || !blocks?.length) return null;
                  const leftOnDate = (iso: string) => { const blk = blockOn(blocks, iso); return blk ? (blk.open ? blk.spotsLeft : 0) : null; };
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
                    `${sp.from === sp.to ? fmtDate(sp.from) : `${fmtDate(sp.from)}–${fmtDate(sp.to)}`} (${sp.left} left)`;

                  return (
                    <>
                      {/* Only worth saying once some dates have actually gone. */}
                      {open.length < dates.length && (
                        <div className="mt-1.5 text-[10.5px]" style={{ color: MUTs }}>
                          <b className="text-white">{open.length}</b> of {dates.length} dates still have space
                        </div>
                      )}
                      {spans.length > 0 && (
                        <div className="mt-1 text-[10.5px] font-bold leading-[1.45]" style={{ color: "#ffb020" }}>
                          ⚠ Nearly full: {spans.slice(0, 3).map(label).join(" · ")}{spans.length > 3 ? ` +${spans.length - 3} more` : ""}
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
                      style={{ background: LIME, color: "#12280a" }}>
                      Join the waiting list
                    </button>
                  ) : (
                    <div className="mt-1.5 text-[11px]" style={{ color: MUTs }}>No waiting list on this one</div>
                  )
                )}
              </div>
              )}
              {passSummary.length > 0 && (
                <div className={wide} style={{ borderColor: LINEs, borderTop: `2px solid ${LIME}` }}>
                  <div className={lab} style={{ color: MUTs }}>passes</div>
                  <div className="mt-1.5 flex flex-col gap-1">
                    {passSummary.map((pp) => (
                      <div key={pp.name} className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[11px]" style={{ color: MUTs }}>{pp.name}</span>
                        <b className={`flex-none text-[13px] font-black ${cond} text-white`} style={{ fontVariantNumeric: "tabular-nums" }}>{money(pp.price)}</b>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className={wide} style={{ borderColor: LINEs, borderTop: `2px solid ${LIME}` }}>
                <div className={lab} style={{ color: MUTs }}>discounts</div>
                {live.length === 0 ? (
                  <div className="mt-1.5 text-[11.5px]" style={{ color: MUTs }}>None on this listing</div>
                ) : (
                  <div className="mt-1.5 flex flex-col gap-1">
                    {live.slice(0, 3).map((r) => (
                      <div key={r.id} className="flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block text-[11px] leading-snug" style={{ color: "#c3ccdb" }}>{r.name.trim() || ruleSummary(r)}</span>
                          {/* Which tickets it covers — a rule on one pass shouldn't look universal. */}
                          <span className="block text-[9.5px]" style={{ color: MUTs }}>
                            {r.passNames.length === 0 ? "All passes" : r.passNames.join(", ")}
                            {r.kind === "early" && r.beforeDate ? ` · book by ${fmtDate(r.beforeDate)}` : ""}
                          </span>
                        </span>
                        <b className="flex-none text-[12px] font-black" style={{ color: LIME, fontVariantNumeric: "tabular-nums" }}>
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
                          <span className={`flex h-9 w-9 flex-none items-center justify-center font-black ${cond} text-[15px] text-white`} style={{ background: EL }}>{(m.first[0] || "?").toUpperCase()}</span>
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
            {d.description && <div><div className="text-[12px] font-extrabold uppercase tracking-[0.14em]" style={{ color: LIME }}>{headingOf(d, "about", "title")}</div><p className="mt-1.5 text-[15px] leading-[1.7]" style={{ color: "#c3ccdb" }}>{d.description}</p></div>}
            {!full && <div id="aos-book">{widget}</div>}
            {d.sections.some((s) => s.text) && <SportSec eye={headingOf(d, "about", "eyebrow")} title={headingOf(d, "about", "title")}>{d.sections.filter((s) => s.text).map((s) => <div key={s.id} className="mb-3 last:mb-0"><div className="text-[10.5px] font-bold uppercase tracking-[0.1em]" style={{ color: CY }}>{s.type}</div><p className="mt-1 text-[14px] leading-[1.6]" style={{ color: "#c3ccdb" }}>{s.text}</p></div>)}</SportSec>}
            {d.outcomes.length > 0 && <SportSec eye={headingOf(d, "learn", "eyebrow")} title={headingOf(d, "learn", "title")}><div className={`grid gap-2 ${grid2}`}>{d.outcomes.map((o, i) => <SportRow key={o}><span className={`w-6 font-black ${cond}`} style={{ color: CY }}>{String(i + 1).padStart(2, "0")}</span>{o}</SportRow>)}</div></SportSec>}
            {d.provided.length > 0 && <SportSec eye={headingOf(d, "included", "eyebrow")} title={headingOf(d, "included", "title")}><div className={`grid gap-2 ${grid2}`}>{d.provided.map((o) => <SportRow key={o}><span>{emo(o, "✅")}</span>{o}</SportRow>)}</div></SportSec>}
            {d.safety.length > 0 && <SportSec eye={headingOf(d, "safety", "eyebrow")} title={headingOf(d, "safety", "title")}><div className={`grid gap-2 ${grid2}`}>{d.safety.map((o) => <SportRow key={o}><span>{emo(o, "🚑")}</span>{o}</SportRow>)}</div></SportSec>}
            {d.send.length > 0 && <SportSec eye={headingOf(d, "send", "eyebrow")} title={headingOf(d, "send", "title")}><div className={`grid gap-2 ${grid2}`}>{d.send.map((o) => <SportRow key={o}><span>{emo(o, "♿")}</span>{o}</SportRow>)}</div></SportSec>}
            {venue && (isOnlineVenue(venue) || venue.address || venue.lat !== undefined || venue.directions || venue.facilities?.length || venue.what3words || venue.transport) && (
              <div className="border-t pt-6" style={{ borderColor: LINEs }}>
                <button type="button" onClick={() => setWhereOpen((o) => !o)} className="flex w-full items-center justify-between border px-4 py-3 text-left" style={{ borderColor: LINEs, background: PANEL }}>
                  <span className="flex items-baseline gap-2.5">
                    <span className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: LIME }}>{whereHead.eyebrow}</span>
                    <span className={`text-[16px] font-black ${cond} text-white`}>{whereHead.title}</span>
                  </span>
                  <span className="flex h-6 w-6 items-center justify-center text-[16px] font-black" style={{ background: LIME, color: "#12280a" }}>{whereOpen ? "–" : "+"}</span>
                </button>
                {whereOpen && (<div className="mt-3">
                <div className="text-[14px] font-black text-white">{venue.name}</div>
                {isOnlineVenue(venue) ? <div className="mt-0.5 text-[13px]" style={{ color: MUTs }}>💻 Runs online</div> : venue.address && <div className="mt-0.5 text-[13px]" style={{ color: MUTs }}>{venue.address}</div>}
                {!isOnlineVenue(venue) && venue.lat !== undefined && <div className="mt-3"><VenueMap lat={venue.lat} lng={venue.lng} zoom={venue.zoom} height={170} /></div>}
                {!!venue.facilities?.length && (
                  <div className="mt-3 flex flex-wrap gap-1.5">{venue.facilities.map((f) => (
                    <span key={f} className="border px-2.5 py-1 text-[11.5px] font-bold" style={{ borderColor: LINEs, background: PANEL, color: "#fff" }}>{f}</span>
                  ))}</div>
                )}
                {!isOnlineVenue(venue) && (venue.what3words || venue.transport) && (
                  <div className="mt-3 flex flex-wrap gap-2 text-[12.5px] font-bold">
                    {venue.what3words && (
                      <a href={`https://what3words.com/${encodeURIComponent(venue.what3words.replace(/^\/+/, ""))}`} target="_blank" rel="noreferrer noopener"
                        className="border px-3 py-2" style={{ borderColor: LIME, color: LIME }}>{"///"} {venue.what3words.replace(/^\/+/, "")}</a>
                    )}
                    {venue.transport && (
                      <span className="border px-3 py-2" style={{ borderColor: LINEs, background: PANEL, color: "#fff" }}>🚌 {venue.transport}</span>
                    )}
                  </div>
                )}
                {venue.directions && (
                  <div className="mt-3 border p-3.5" style={{ borderColor: LINEs, background: PANEL }}>
                    <div className="text-[10.5px] font-black uppercase tracking-[0.12em]" style={{ color: LIME }}>{isOnlineVenue(venue) ? "How to join" : "Getting there & parking"}</div>
                    <p className="mt-1 whitespace-pre-line text-[13px] leading-[1.6]" style={{ color: MUTs }}>{venue.directions}</p>
                  </div>
                )}
                </div>)}
              </div>
            )}
            {addons.length > 0 && <SportSec eye={headingOf(d, "addons", "eyebrow")} title={headingOf(d, "addons", "title")}>{addons.map((a, i) => <div key={i} className="mt-2 flex items-center justify-between border px-4 py-3 first:mt-0" style={{ borderColor: LINEs, background: PANEL }}><span className="flex items-center gap-2.5 text-[13.5px] font-bold">{a.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.image} alt="" className="h-8 w-8 flex-none object-cover" />
            ) : a.emoji ? <span className="text-[16px]">{a.emoji}</span> : null}{a.name}</span><span className={`font-black ${cond}`} style={{ color: LIME }}>{money(a.price)}</span></div>)}</SportSec>}
            {d.gallery.length > 0 && <SportSec eye={headingOf(d, "gallery", "eyebrow")} title={headingOf(d, "gallery", "title")}><div className={`grid gap-2 ${full ? "grid-cols-4" : "grid-cols-3"}`}>{d.gallery.map((im, i) => <CroppedImage key={i} im={im} style={{ aspectRatio: "1 / 1" }} />)}</div></SportSec>}
          </div>
          {full && <div id="aos-book" className="self-start lg:sticky lg:top-4">{widget}</div>}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t px-6 py-5 text-[12px]" style={{ borderColor: LINEs, color: MUTs }}>
        <span className={`font-black ${cond} text-white`}>{brand}</span>
        <span>Bookings powered by ActivityOS</span>
      </div>
    </div>
  );
}

// ── Small shared bits ──────────────────────────────────────────────────────
function StepHead({ kicker, title, lede }: { n?: number; kicker: string; title: string; lede: string }) {
  return (
    <div className="mb-5 text-center">
      <div className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[var(--brand-2)]">{kicker}</div>
      <h3 className="mt-1.5 text-[26px] font-extrabold leading-[1.15] tracking-[-0.03em]" style={{ fontFamily: "var(--ff-display)" }}>{title}</h3>
      <p className="mx-auto mt-1.5 max-w-[460px] text-[13px] leading-[1.55] text-[var(--ink-3)]">{lede}</p>
    </div>
  );
}
/**
 * Starts a band within the step's card. The rule and the icon are what stop a
 * long step reading as one undifferentiated wall of fields.
 */
function SectionHead({ children, icon }: { children: React.ReactNode; icon?: string }) {
  return (
    <div className="mb-2.5 mt-5 flex items-center gap-2 border-t border-[var(--line)] pt-4 first:mt-0 first:border-t-0 first:pt-0">
      {icon && <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[14px]">{icon}</span>}
      <div className="text-[12.5px] font-extrabold text-[var(--ink)]">{children}</div>
    </div>
  );
}
function YesNo({ label, value, onChange, help }: { label: string; value: boolean; onChange: (v: boolean) => void; help?: string }) {
  return (
    <div>
      <div className="text-[12.5px] font-semibold">{label}</div>
      <div className="mt-1 flex gap-1.5">
        {[["Yes", true], ["No", false]].map(([l, v]) => (
          <button key={l as string} type="button" onClick={() => onChange(v as boolean)} className="rounded-full border px-3 py-1 text-[11.5px] font-bold" style={value === v ? { borderColor: "var(--brand-2)", background: "var(--brand-soft)", color: "var(--brand-ink)" } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>{l as string}</button>
        ))}
      </div>
      {help && <div className="mt-1 text-[11px] text-[var(--ink-3)]">{help}</div>}
    </div>
  );
}
