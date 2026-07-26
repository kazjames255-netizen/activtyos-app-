"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { api, get as apiGet, post as apiPost, put as apiPut } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useSettings } from "@/lib/settings";
import { Badge, Button, Card } from "@/components/ui";
import { bankByCategory, HAZARD_BANK } from "./hazardBank";

// ─────────────────────────────────────────────────────────────────────────
// Trips & visits — the manual's full end-to-end off-site planner. Browse every
// trip as a card (readiness + stat chips), and open one into a 7-step planner:
// details & itinerary, risk assessment, staffing & ratio, parent permissions,
// line-manager sign-off, on-the-day head counts, return & debrief. Backed by
// /api/trips. Payment (Stripe Connect) and parent-side consent are Amir's.
// ─────────────────────────────────────────────────────────────────────────

type Status = "planned" | "completed" | "cancelled";
type RiskLevel = "" | "L" | "M" | "H";
type Consent = "granted" | "pending" | "declined";
interface Hazard { h: string; who?: string; controls?: string; initial?: RiskLevel; residual?: RiskLevel; done?: boolean; amendedOn?: string; amendedBy?: string }
interface ItinItem { t?: string; a?: string; k?: string }
interface RosterMember { n: string; r?: string; fa?: boolean }
interface Attendee { n: string; age?: number; consent?: Consent; paid?: boolean; em?: boolean; med?: string; sent?: boolean }
interface Checkpoint { n: string; counted?: number | null; time?: string }
interface Signoff { approvedBy?: string; approvedAt?: string; submitted?: boolean }
interface Trip {
  id: string; destination: string; address?: string; date: string; departTime?: string; returnTime?: string;
  listingId?: string; transport?: string; lead?: string; leadPhone?: string; evc?: string; cost?: string; offsiteRatio?: number;
  itinerary?: ItinItem[]; kit?: string;
  hazards?: Hazard[]; raSigned?: boolean; raAssessor?: string; raDate?: string; raRef?: string; raReview?: string;
  roster?: RosterMember[]; attendees?: Attendee[]; checkpoints?: Checkpoint[]; signoff?: Signoff; returned?: boolean;
  parentMsg?: string; payBy?: string; parentMsgSentAt?: string; askPay?: boolean; askConsent?: boolean;
  childNames: string[]; staff: string[]; headcount?: number; consentObtained: boolean; notes?: string; status: Status; createdByName?: string;
}

const LIGHT_PALETTE = {
  "--bg": "#f5f8fd", "--surface": "#ffffff", "--panel": "#fbf8fc",
  "--ink": "#171534", "--ink-2": "#4a4763", "--ink-3": "#8a86a3", "--line": "#ece6f1",
} as CSSProperties;
const BLUE = "#1d3a8f", SIG = "#3f78d8", GREEN = "#0f7a43", AMBER = "#9a5a00", RED = "#c02636";
const STAT = {
  planned: { label: "Planned", bg: "#eaf0fc", fg: BLUE },
  completed: { label: "Completed", bg: "#e7f6ee", fg: GREEN },
  cancelled: { label: "Cancelled", bg: "#fdebec", fg: RED },
} as const;
const RISK = { L: { lbl: "Low", bg: "#e7f6ee", fg: GREEN }, M: { lbl: "Med", bg: "#fdf3d8", fg: AMBER }, H: { lbl: "High", bg: "#fdebec", fg: RED } } as const;
const TRANSPORT = ["Minibus", "Coach", "Walking", "Public bus", "Train", "Parents drop-off", "Provider vehicles"];
const DEFAULT_HAZARDS: Hazard[] = [
  { h: "Transport / travel", who: "All children & staff", controls: "Seatbelts on; head-count on and off; first-aider on board; DBS-checked driver", initial: "M", residual: "L", done: false },
  { h: "Lost / separated child", who: "Children", controls: "Hi-vis; agreed meeting point; head-count at every leg; named lead holds register; buddy system", initial: "H", residual: "L", done: false },
  { h: "Road crossing / pedestrian", who: "All", controls: "Use crossings; staff front and back; walk in pairs", initial: "M", residual: "L", done: false },
  { h: "Weather / sun / heat", who: "All", controls: "Sun cream; hats; water; shade breaks; check forecast", initial: "L", residual: "L", done: false },
  { h: "Medical / allergies", who: "Named children", controls: "Meds & care plans carried; first-aid kit; emergency contacts to hand", initial: "M", residual: "L", done: false },
  { h: "Venue-specific hazards", who: "All", controls: "Follow venue rules & staff briefing; site risk-assessment reviewed", initial: "M", residual: "L", done: false },
];
const DEFAULT_CHECKPOINTS: Checkpoint[] = [
  { n: "Depart base", counted: null }, { n: "Arrive venue", counted: null }, { n: "Lunch / midpoint", counted: null }, { n: "Before return", counted: null }, { n: "Back at base", counted: null },
];
const TITLES = ["", "Trip details & itinerary", "Risk assessment", "Staffing & off-site ratio", "Parent permissions", "Line-manager sign-off", "On the day — head counts", "Return & debrief", "Message parents & payment"];
const STEP_NUMS = [1, 2, 3, 4, 5, 6, 7, 8]; // step 8 is optional — not counted toward readiness
// Extensive, editable pick-lists for the itinerary (offered as datalists).
const ITIN_ACTIVITIES = [
  "Depart base", "Board coach / minibus", "Travel to venue", "Arrive at venue", "Meet venue staff / guide",
  "Registration & head count", "Welcome & safety briefing", "Toilet & handwash break", "Morning activity session",
  "Guided tour", "Workshop / led session", "Snack break", "Free time / supervised play", "Lunch",
  "Afternoon activity session", "Group photo", "Gift shop / souvenirs", "Wash hands", "Final head count & register",
  "Board coach for return", "Depart venue", "Travel back to base", "Arrive back at base", "Handover to parents / carers",
];
const ITIN_ACTIONS = [
  "Head-count on", "Head-count off", "Seatbelts checked", "Register taken", "Toilet & handwash",
  "Apply sun cream / hats", "Water / hydration break", "First-aid kit to hand", "Medication check", "Inhalers to hand",
  "Emergency contacts reviewed", "Buddy-up in pairs", "Meeting-point reminder", "Hi-vis on", "Wash hands after animals",
  "Count in and out of water", "Collect belongings", "Confirm collection / password", "Weather check", "Phone tree ready",
];

const fmtDate = (iso?: string) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");
const todayIso = () => { const t = new Date(); const p = (n: number) => String(n).padStart(2, "0"); return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`; };
const nowLabel = () => new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const ini = (n?: string) => (n ?? "").split(/\s+/).map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase() || "?";

// ── domain (mirrors the manual's helpers) ─────────────────────────────────
const attendingOf = (t: Trip) => (t.attendees ?? []).filter((c) => c.consent === "granted");
const pendingOf = (t: Trip) => (t.attendees ?? []).filter((c) => (c.consent ?? "pending") === "pending");
const declinedOf = (t: Trip) => (t.attendees ?? []).filter((c) => c.consent === "declined");
const paidCountOf = (t: Trip) => (t.attendees ?? []).filter((c) => c.paid && c.consent !== "declined").length;
const ratioOf = (t: Trip) => t.offsiteRatio || 1;
const needOf = (t: Trip) => Math.max(1, Math.ceil(attendingOf(t).length / ratioOf(t)));
const hasLead = (t: Trip) => (t.roster ?? []).some((s) => /lead/i.test(s.r ?? ""));
const hasFA = (t: Trip) => (t.roster ?? []).some((s) => s.fa);
const raReady = (hz: Hazard[]) => hz.length > 0 && hz.every((h) => h.done && h.residual);
const raDone = (t: Trip) => raReady(t.hazards ?? []) && !!t.raSigned;
const staffOk = (t: Trip) => (t.roster ?? []).length >= needOf(t) && hasLead(t) && hasFA(t);
const permsOk = (t: Trip) => pendingOf(t).length === 0 && attendingOf(t).length > 0;
const s1Ok = (t: Trip) => !!(t.destination && t.date && t.lead && t.transport);
const s5Ok = (t: Trip) => !!t.signoff?.approvedBy;
const canSubmit = (t: Trip) => s1Ok(t) && raDone(t) && staffOk(t) && permsOk(t);
const s6Ok = (t: Trip) => { const go = attendingOf(t).length; const cps = t.checkpoints ?? []; return cps.length > 0 && cps.every((c) => c.counted != null && c.counted >= go); };
const stepDone = (t: Trip, n: number): boolean => [null, s1Ok, raDone, staffOk, permsOk, s5Ok, s6Ok, (x: Trip) => !!x.returned][n]!(t);
const readinessOf = (t: Trip) => { let c = 0; for (let n = 1; n <= 7; n++) if (stepDone(t, n)) c++; return Math.round((c / 7) * 100); };
const activeStepOf = (t: Trip) => { for (let n = 1; n <= 7; n++) if (!stepDone(t, n)) return n; return 8; };
function statusPill(t: Trip): [string, string] {
  if (t.returned) return ["Completed", GREEN];
  if ((t.checkpoints ?? []).some((c) => c.counted != null)) return ["On the trip", SIG];
  if (s5Ok(t)) return ["Approved — ready to go", GREEN];
  if (canSubmit(t)) return ["Ready to submit", SIG];
  return ["In planning", "#8a86a3"];
}

// Bookings carry the child (or a kids[] list) + the ISO session dates each
// occupies — so the planner can offer exactly who's booked on the day.
interface BookKid { name: string; dates?: string[]; cancelledDays?: string[]; cancelled?: boolean; age?: number }
interface Booking { child?: string; listing?: string; listingId?: string; pass?: string; days?: string[]; kids?: BookKid[]; status?: string; age?: number }
const LIVE_BOOKING = (s?: string) => !/cancel|declin|waitl|offer/i.test(s ?? "");
// distinct passes booked on a listing for a date — so the operator can pick the
// trip pass (some passes include the trip, some don't).
function passesFor(bkgs: Booking[], listingId: string | undefined, dateIso: string): string[] {
  const out = new Set<string>();
  for (const b of bkgs) {
    if (!LIVE_BOOKING(b.status) || !b.pass) continue;
    if (listingId && b.listingId !== listingId) continue;
    const onDay = b.kids?.length ? b.kids.some((k) => !k.cancelled && (!k.dates?.length || k.dates.includes(dateIso))) : (!b.days?.length || b.days.includes(dateIso));
    if (onDay) out.add(b.pass);
  }
  return [...out].sort();
}
function bookedOnDate(bkgs: Booking[], listingId: string | undefined, pass: string | undefined, dateIso: string): { n: string; age?: number }[] {
  const out = new Map<string, { n: string; age?: number }>();
  for (const b of bkgs) {
    if (!LIVE_BOOKING(b.status)) continue;
    if (listingId && b.listingId !== listingId) continue;
    if (pass && b.pass !== pass) continue;
    if (b.kids?.length) {
      for (const k of b.kids) {
        if (k.cancelled || (k.cancelledDays ?? []).includes(dateIso)) continue;
        if (!k.dates?.length || k.dates.includes(dateIso)) if (k.name) out.set(k.name.trim(), { n: k.name.trim(), age: k.age });
      }
    } else if (b.child) {
      if (!b.days?.length || b.days.includes(dateIso)) out.set(b.child.trim(), { n: b.child.trim(), age: b.age });
    }
  }
  return [...out.values()].sort((a, b) => (a.n < b.n ? -1 : 1));
}

// nested get/set on a structured clone (for track-changes edits)
function getPath(o: unknown, path: string): unknown { return path.split(".").reduce<unknown>((a, k) => (a == null ? a : (a as Record<string, unknown>)[k]), o); }
function setPath(o: unknown, path: string, v: unknown) { const ks = path.split("."); let cur = o as Record<string, unknown>; for (let i = 0; i < ks.length - 1; i++) cur = cur[ks[i]] as Record<string, unknown>; cur[ks[ks.length - 1]] = v; }

interface Change { key: string; label: string; old: string; next: string; who: string; ts: string }

function blankTrip(ratioTarget: number): Trip {
  return {
    id: "", destination: "", address: "", date: todayIso(), transport: "", offsiteRatio: ratioTarget, cost: "0.00",
    lead: "", leadPhone: "", evc: "", kit: "Packed lunch, water, sun cream, weather-appropriate clothing.",
    itinerary: [{ t: "09:00", a: "Depart base", k: "Head-count on" }, { t: "", a: "", k: "" }],
    hazards: DEFAULT_HAZARDS.map((h) => ({ ...h })), raRef: "", raAssessor: "", raDate: todayIso(), raReview: "Reviewed before each run",
    roster: [], attendees: [], checkpoints: DEFAULT_CHECKPOINTS.map((c) => ({ ...c })), signoff: {}, returned: false,
    askPay: true, askConsent: true,
    childNames: [], staff: [], consentObtained: false, notes: "", status: "planned",
  };
}

// ── small field helpers ───────────────────────────────────────────────────
const inputCls = "w-full rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-[12.5px] outline-none focus:border-[#1d3a8f]";
// auto-fit textarea — grows to fit all its text (field-sizing) so nothing is clipped
const taCls = "w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[12.5px] leading-[1.55] outline-none focus:border-[#1d3a8f] [field-sizing:content] resize-y";
const fl = (s: string) => <span className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-2)]"><span className="h-3 w-[3px] flex-none rounded-full bg-[#3f78d8]" />{s}</span>;
// a polished connected L/M/H segmented control for risk ratings
function RatingGroup({ label, cur, on }: { label: string; cur?: RiskLevel; on: (v: RiskLevel) => void }) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">{label}</span>
      <div className="inline-flex overflow-hidden rounded-lg border border-[var(--line)] shadow-[0_1px_2px_rgba(23,21,52,.04)]">
        {(["L", "M", "H"] as const).map((v) => (
          <button key={v} type="button" onClick={() => on(v)} className="border-l border-[var(--line)] px-2.5 py-1 text-[11px] font-extrabold transition-colors first:border-l-0" style={cur === v ? { background: RISK[v].fg, color: "#fff" } : { background: "var(--surface)", color: RISK[v].fg }}>{RISK[v].lbl}</button>
        ))}
      </div>
    </div>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 52, circ = 2 * Math.PI * r, off = circ * (1 - pct / 100), col = pct >= 100 ? GREEN : BLUE;
  return (
    <div className="relative h-[112px] w-[112px] flex-none">
      <svg viewBox="0 0 120 120" className="h-[112px] w-[112px] -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--line)" strokeWidth="11" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={col} strokeWidth="11" strokeLinecap="round" strokeDasharray={circ.toFixed(1)} strokeDashoffset={off.toFixed(1)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <b className="text-[26px] font-extrabold leading-none" style={{ color: col }}>{pct}%</b>
        <span className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--ink-3)]">Ready</span>
      </div>
    </div>
  );
}

// ── the 7-step planner ────────────────────────────────────────────────────
const defaultParentMsg = (t: Trip, provider: string) => {
  const pay = t.askPay !== false, consent = t.askConsent !== false;
  const ask = pay && consent ? "give your permission and pay £{Cost} by {PayBy}"
    : pay ? "pay £{Cost} by {PayBy}"
    : consent ? "give your permission by {PayBy}"
    : "let us know by {PayBy}";
  const action = [consent ? "[ ✓ I give permission for my child to attend ]" : "", pay ? "[ Pay £{Cost} for this trip → ]" : ""].filter(Boolean).join("\n");
  return `Hi,

We're excited to offer your child a place on our trip to {Destination} on {Date}, departing {Depart} and back by {Return}.

Getting there: {Transport}${pay ? "\nCost: £{Cost} per child" : ""}

To confirm your child's place, please ${ask} using the link below. If we don't hear from you by then, we may offer the place to another family.

${action}

Any questions, please contact {Lead} on {LeadPhone}.

Thank you,
${provider}`;
};
const resolveMsg = (msg: string, t: Trip, provider: string) => msg
  .replace(/{Destination}/g, t.destination || "the venue")
  .replace(/{Address}/g, t.address || "")
  .replace(/{Date}/g, fmtDate(t.date) || "the date")
  .replace(/{Depart}/g, t.departTime || "—").replace(/{Return}/g, t.returnTime || "—")
  .replace(/{Transport}/g, t.transport || "—").replace(/{Cost}/g, t.cost || "0.00")
  .replace(/{PayBy}/g, t.payBy ? fmtDate(t.payBy) : "the date below")
  .replace(/{Lead}/g, t.lead || "the trip lead").replace(/{LeadPhone}/g, t.leadPhone || "—")
  .replace(/{Provider}/g, provider);
const MERGE_FIELDS = ["{Destination}", "{Date}", "{Depart}", "{Return}", "{Transport}", "{Cost}", "{PayBy}", "{Lead}", "{LeadPhone}", "{Provider}"];

function TripPlanner({ existing, ratioTarget, providerName, onSaved, onClose }: { existing?: Trip; ratioTarget: number; providerName: string; onSaved: () => void; onClose: () => void }) {
  const isEdit = !!existing;
  const [t, setT] = useState<Trip>(() => existing ? { ...blankTrip(ratioTarget), ...existing, hazards: existing.hazards?.length ? existing.hazards : DEFAULT_HAZARDS.map((h) => ({ ...h })), checkpoints: existing.checkpoints?.length ? existing.checkpoints : DEFAULT_CHECKPOINTS.map((c) => ({ ...c })), roster: existing.roster ?? [], attendees: existing.attendees ?? [], itinerary: existing.itinerary?.length ? existing.itinerary : [{ t: "", a: "", k: "" }], signoff: existing.signoff ?? {} } : blankTrip(ratioTarget));
  const [open, setOpen] = useState<number>(existing ? Math.min(7, activeStepOf(existing)) : 1);
  const [track, setTrack] = useState(false);
  const [review, setReview] = useState(false);
  const [changes, setChanges] = useState<Change[]>([]);
  const [bkgs, setBkgs] = useState<Booking[]>([]);
  const [listingStaff, setListingStaff] = useState<string[]>([]);
  const [team, setTeam] = useState<string[]>([]);
  const [venues, setVenues] = useState<{ name: string; address?: string; city?: string }[]>([]);
  const [me, setMe] = useState("You");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remindStamp, setRemindStamp] = useState<string | null>(null);
  const [bankOpen, setBankOpen] = useState(false);
  const [bankQ, setBankQ] = useState("");
  const [venueMenu, setVenueMenu] = useState(false);
  const [passFilter, setPassFilter] = useState("");

  // edit a field by path; records old→new when track-changes is on
  const edit = (key: string, value: unknown, label: string) => {
    const old = getPath(t, key);
    if (String(old ?? "") === String(value ?? "")) return;
    setT((prev) => { const next = structuredClone(prev) as Trip; setPath(next, key, value); return next; });
    if (track) setChanges((cs) => {
      const ex = cs.find((c) => c.key === key);
      if (ex) return String(ex.old) === String(value) ? cs.filter((c) => c !== ex) : cs.map((c) => (c === ex ? { ...c, next: String(value), ts: nowLabel() } : c));
      return [...cs, { key, label, old: String(old ?? ""), next: String(value), who: me, ts: nowLabel() }];
    });
  };
  const mut = (fn: (d: Trip) => void) => setT((prev) => { const next = structuredClone(prev) as Trip; fn(next); return next; });
  const addBankHazard = (id: string) => { const e = HAZARD_BANK.find((x) => x.id === id); if (!e) return; mut((d) => { (d.hazards ??= []).push({ h: e.desc, who: e.who, controls: e.controls.map((c) => `• ${c}`).join("\n"), initial: e.initial, residual: e.residual, done: false, amendedOn: todayIso(), amendedBy: me }); d.raSigned = false; }); };
  // edit a hazard text field and stamp "last amended" with today + assessor
  // set any hazard field: records the change (when Track changes is on) and stamps "last amended"
  const hazSet = (i: number, field: "h" | "who" | "controls" | "initial" | "residual" | "done", value: unknown, label: string) => { edit(`hazards.${i}.${field}`, value, label); mut((d) => { if (d.hazards?.[i]) { d.hazards[i].amendedOn = todayIso(); d.hazards[i].amendedBy = me; if (d.raSigned) d.raSigned = false; } }); };
  // look up a saved venue's address when the destination matches one by name
  const venueFor = (name: string) => venues.find((v) => v.name.trim().toLowerCase() === name.trim().toLowerCase());

  useEffect(() => { apiGet<Booking[]>("/api/bookings").then(setBkgs).catch(() => {}); }, []);
  useEffect(() => { apiGet<{ staff?: { first?: string; last?: string }[]; venues?: { name?: string; address?: string; city?: string }[] } | null>("/api/library").then((l) => { setTeam((l?.staff ?? []).map((s) => `${s.first ?? ""} ${s.last ?? ""}`.trim()).filter(Boolean)); setVenues((l?.venues ?? []).filter((v) => v.name).map((v) => ({ name: v.name!, address: v.address, city: v.city }))); }).catch(() => {}); }, []);
  useEffect(() => { apiGet<{ name?: string; email?: string }>("/api/me").then((m) => setMe(m.name || m.email || "You")).catch(() => {}); }, []);
  useEffect(() => {
    let alive = true; const lid = t.listingId;
    const p = lid ? apiGet<{ library?: { staff?: { name?: string }[]; venue?: { name?: string; address?: string } | null } }>(`/api/listings/${encodeURIComponent(lid)}`).then((r) => ({ staff: (r.library?.staff ?? []).map((s) => (s.name ?? "").trim()).filter(Boolean), venue: r.library?.venue ?? null })).catch(() => ({ staff: [] as string[], venue: null })) : Promise.resolve({ staff: [] as string[], venue: null });
    p.then((r) => { if (!alive) return; setListingStaff(r.staff); if (r.venue) mut((d) => { if (!d.destination.trim() && r.venue!.name) d.destination = r.venue!.name; if (!d.address?.trim() && r.venue!.address) d.address = r.venue!.address; }); });
    return () => { alive = false; };
  }, [t.listingId]);

  const booked = useMemo(() => bookedOnDate(bkgs, t.listingId, passFilter || undefined, t.date), [bkgs, t.listingId, passFilter, t.date]);
  const passOptions = useMemo(() => passesFor(bkgs, t.listingId, t.date), [bkgs, t.listingId, t.date]);
  const listings = useMemo(() => [...new Map(bkgs.filter((b) => b.listingId && b.listing).map((b) => [b.listingId!, b.listing!])).entries()], [bkgs]);
  const rosterNames = new Set((t.roster ?? []).map((s) => s.n));
  const staffSuggest = [...new Set([...listingStaff, ...team])].filter((s) => !rosterNames.has(s));
  const attendeeNames = new Set((t.attendees ?? []).map((a) => a.n));
  const notBooked = booked.filter((b) => !attendeeNames.has(b.n));

  async function save(close: boolean) {
    if (!t.destination.trim() || !t.date) { setError("Add a destination and date in Step 1."); setOpen(1); return; }
    setBusy(true); setError(null);
    const childNames = attendingOf(t).map((c) => c.n);
    const body = {
      destination: t.destination, address: t.address || undefined, date: t.date, departTime: t.departTime || undefined, returnTime: t.returnTime || undefined,
      listingId: t.listingId || undefined, transport: t.transport || undefined, lead: t.lead || undefined, leadPhone: t.leadPhone || undefined,
      evc: t.evc || undefined, cost: t.cost || undefined, offsiteRatio: t.offsiteRatio ?? ratioTarget, itinerary: (t.itinerary ?? []).filter((r) => r.a?.trim() || r.t?.trim()),
      kit: t.kit || undefined, hazards: (t.hazards ?? []).filter((h) => h.h.trim()), raSigned: !!t.raSigned, raAssessor: t.raAssessor || undefined, raDate: t.raDate || undefined, raRef: t.raRef || undefined, raReview: t.raReview || undefined,
      roster: t.roster ?? [], attendees: t.attendees ?? [], checkpoints: t.checkpoints ?? [], signoff: t.signoff ?? {}, returned: !!t.returned,
      parentMsg: t.parentMsg || undefined, payBy: t.payBy || undefined, parentMsgSentAt: t.parentMsgSentAt || undefined, askPay: t.askPay !== false, askConsent: t.askConsent !== false,
      childNames, staff: (t.roster ?? []).map((s) => s.n), consentObtained: permsOk(t), notes: t.notes || undefined, status: t.returned ? "completed" : (t.status ?? "planned"),
    };
    try {
      if (isEdit) await apiPut(`/api/trips/${encodeURIComponent(existing!.id)}`, body); else await apiPost("/api/trips", body);
      if (close) { onClose(); onSaved(); } else { onSaved(); setBusy(false); }
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save"); setBusy(false); }
  }

  const pct = readinessOf(t), act = activeStepOf(t), sp = statusPill(t);
  const chip = (label: string, val: ReactNode, tone?: "ok" | "bad" | "warn") => (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
      <div className="text-[9px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">{label}</div>
      <div className="mt-0.5 text-[16px] font-extrabold leading-none" style={{ color: tone === "ok" ? GREEN : tone === "bad" ? RED : tone === "warn" ? AMBER : "var(--ink)" }}>{val}</div>
    </div>
  );
  const fieldInput = (key: keyof Trip, label: string, opts?: { type?: string; placeholder?: string }) => (
    <input type={opts?.type ?? "text"} value={(t[key] as string) ?? ""} placeholder={opts?.placeholder} onChange={(e) => edit(String(key), e.target.value, label)} className={inputCls} />
  );

  return (
    <Card className="mb-3.5 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[15px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{isEdit ? "Trip planner" : "Plan a trip"}</div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setTrack((v) => !v)} className="flex items-center gap-2 text-[12px] font-semibold text-[var(--ink-2)]">
            <span className="relative h-[22px] w-[40px] rounded-full transition-colors" style={{ background: track ? GREEN : "var(--line)" }}><span className="absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow transition-all" style={{ left: track ? "20px" : "2px" }} /></span>
            Track changes <b style={{ color: "var(--ink)" }}>{track ? "ON" : "OFF"}</b>
          </button>
          <button type="button" onClick={() => setReview((v) => !v)} className="rounded-lg border px-3 py-1.5 text-[12px] font-bold transition-colors" style={review ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>Review changes ({changes.length})</button>
        </div>
      </div>

      {review && (
        <div className="mb-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
          <div className="mb-1.5 flex items-center justify-between text-[12.5px] font-extrabold">Tracked changes ({changes.length}){changes.length > 0 && <span className="flex gap-1.5"><button type="button" onClick={() => setChanges([])} className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-0.5 text-[11px] font-bold">Accept all</button><button type="button" onClick={() => { changes.forEach((c) => mut((d) => setPath(d, c.key, c.old))); setChanges([]); }} className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-0.5 text-[11px] font-bold">Reject all</button></span>}</div>
          {changes.length === 0 ? <div className="text-[11.5px] text-[var(--ink-3)]">No changes yet. Turn Track changes ON, then edit a field — old → new appears here to accept or reject.</div>
            : <div className="flex flex-col gap-1.5">{changes.map((c, i) => (
              <div key={i} className="flex items-center justify-between gap-2 rounded-lg bg-[var(--surface)] px-2.5 py-1.5">
                <div className="min-w-0 text-[11.5px]"><b>{c.label}</b><div className="text-[var(--ink-2)]"><del className="text-[var(--ink-3)]">{c.old || "—"}</del> → <ins className="rounded bg-[#e7f6ee] px-1 no-underline" style={{ color: GREEN }}>{c.next || "—"}</ins> <span className="text-[var(--ink-3)]">· {c.who} · {c.ts}</span></div></div>
                <span className="flex flex-none gap-1"><button type="button" onClick={() => setChanges((cs) => cs.filter((x) => x !== c))} className="rounded-md border border-[var(--line)] px-2 py-0.5 text-[11px] font-bold">Accept</button><button type="button" onClick={() => { mut((d) => setPath(d, c.key, c.old)); setChanges((cs) => cs.filter((x) => x !== c)); }} className="rounded-md border border-[var(--line)] px-2 py-0.5 text-[11px] font-bold">Reject</button></span>
              </div>
            ))}</div>}
        </div>
      )}

      {/* hero */}
      <div className="mb-4 flex flex-wrap items-center gap-4 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4">
        <Ring pct={pct} />
        <div className="min-w-[220px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[18px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{t.destination || "New trip"}</span>
            <span className="rounded-full px-2.5 py-0.5 text-[11px] font-extrabold" style={{ background: `color-mix(in srgb,${sp[1]} 14%,transparent)`, color: `color-mix(in srgb,${sp[1]} 74%,#000)` }}>{sp[0]}</span>
          </div>
          <div className="mb-2.5 mt-1 text-[12.5px] text-[var(--ink-2)]">{t.date ? fmtDate(t.date) : "no date"}{t.departTime ? ` · depart ${t.departTime}` : ""}{t.returnTime ? `, back ${t.returnTime}` : ""}</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {chip("Children", attendingOf(t).length)}
            {chip("Staff", (t.roster ?? []).length, staffOk(t) ? "ok" : "bad")}
            {chip("Off-site ratio", `1:${ratioOf(t)}`)}
            {chip("Consents", `${attendingOf(t).length}/${(t.attendees ?? []).length - declinedOf(t).length}`, permsOk(t) ? "ok" : "warn")}
            {chip("RA", raDone(t) ? "Signed" : "Draft", raDone(t) ? "ok" : "warn")}
            {chip("Sign-off", s5Ok(t) ? "Approved" : "Pending", s5Ok(t) ? "ok" : "warn")}
          </div>
        </div>
      </div>

      {/* step rail — jump to any step (wraps so every tab is visible) */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {STEP_NUMS.map((n) => {
          const dn = n <= 7 ? stepDone(t, n) : !!t.parentMsgSentAt, cur = open === n, opt = n === 8;
          return (
            <button key={n} type="button" onClick={() => setOpen(n)} title={`Step ${n} — ${TITLES[n]}`} className="flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left transition-colors" style={cur ? { borderColor: BLUE, background: "#eef4fd" } : { borderColor: "var(--line)", background: "var(--surface)" }}>
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[11px] font-extrabold" style={dn ? { background: GREEN, color: "#fff" } : cur ? { background: BLUE, color: "#fff" } : { background: "var(--panel)", color: "var(--ink-3)" }}>{dn ? "✓" : opt ? "✚" : n}</span>
              <span className="hidden text-[11.5px] font-bold sm:block" style={{ color: cur ? BLUE : "var(--ink-2)" }}>{TITLES[n]}{opt ? " (optional)" : ""}</span>
            </button>
          );
        })}
      </div>

      {/* current step — one at a time (slideshow) */}
      <div className="overflow-hidden rounded-2xl border" style={{ borderColor: `color-mix(in srgb,${SIG} 40%,var(--line))` }}>
        {STEP_NUMS.map((n) => {
          if (n !== open) return null;
          const dn = n <= 7 ? stepDone(t, n) : !!t.parentMsgSentAt, locked = n === 6 && !s5Ok(t);
          const pillTone = n === 8 ? (t.parentMsgSentAt ? { t: "Sent", c: GREEN } : { t: "Optional", c: "#8a86a3" }) : dn ? { t: "Complete", c: GREEN } : locked ? { t: "Locked", c: "#8a86a3" } : n === act ? { t: "Action needed", c: SIG } : { t: "To do", c: "#8a86a3" };
          return (
            <div key={n}>
              <div className="flex items-center gap-3 border-b border-[var(--line)] bg-[var(--surface)] px-4 py-3">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[15px] font-extrabold" style={dn ? { background: GREEN, color: "#fff" } : { background: "#eef4fd", color: BLUE }}>{dn ? "✓" : n}</span>
                <span className="flex-1 min-w-0"><span className="text-[10px] font-bold uppercase tracking-[0.05em] text-[var(--ink-3)]">Step {n} of 8</span><div className="text-[16px] font-extrabold leading-tight" style={{ fontFamily: "var(--ff-display)" }}>{TITLES[n]}</div></span>
                <span className="rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold" style={{ background: `color-mix(in srgb,${pillTone.c} 14%,transparent)`, color: `color-mix(in srgb,${pillTone.c} 74%,#000)` }}>{pillTone.t}</span>
              </div>
              <div className="bg-[var(--panel)] p-4">
                {/* ── Step 1 ── */}
                {n === 1 && <div className="flex flex-col gap-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="relative flex flex-col gap-1">{fl("Where are you going?")}
                      <input value={t.destination ?? ""} onChange={(e) => { const v = e.target.value; edit("destination", v, "Destination"); setVenueMenu(true); const m = venueFor(v); if (m?.address) edit("address", m.address, "Address"); }} onFocus={() => setVenueMenu(true)} onBlur={() => setTimeout(() => setVenueMenu(false), 150)} placeholder="Search your saved venues, or type a place" className={inputCls} autoComplete="off" />
                      {venueMenu && (() => {
                        const q = (t.destination ?? "").trim().toLowerCase();
                        const matches = venues.filter((v) => !q || v.name.toLowerCase().includes(q) || (v.address ?? "").toLowerCase().includes(q)).slice(0, 8);
                        if (matches.length === 0) return null;
                        return (
                          <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-[0_12px_28px_-12px_rgba(23,21,52,.4)]">
                            {matches.map((v) => (
                              <button key={v.name} type="button" onMouseDown={(e) => { e.preventDefault(); edit("destination", v.name, "Destination"); edit("address", v.address ?? "", "Address"); setVenueMenu(false); }} className="flex w-full flex-col items-start gap-0.5 border-b border-[var(--line)] px-3 py-2 text-left last:border-b-0 hover:bg-[#eef4fd]">
                                <span className="text-[12.5px] font-bold">📍 {v.name}</span>
                                {v.address && <span className="text-[11px] text-[var(--ink-3)]">{v.address}</span>}
                              </button>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                    <label className="flex flex-col gap-1">{fl("Address")}<input value={t.address ?? ""} onChange={(e) => edit("address", e.target.value, "Address")} placeholder="Postcode or full address (auto-fills from a saved venue)" className={inputCls} /></label>
                    {listings.length > 0 && <label className="flex flex-col gap-1 sm:col-span-2">{fl("For which camp/club? (pulls booked children, staff & venue)")}<select value={t.listingId ?? ""} onChange={(e) => edit("listingId", e.target.value || "", "Listing")} className={inputCls}><option value="">All my bookings</option>{listings.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>}
                    <label className="flex flex-col gap-1">{fl("Date")}{fieldInput("date", "Date", { type: "date" })}</label>
                    <label className="flex flex-col gap-1">{fl("Cost per child (£)")}{fieldInput("cost", "Cost per child")}</label>
                    <label className="flex flex-col gap-1">{fl("Depart")}{fieldInput("departTime", "Depart", { type: "time" })}</label>
                    <label className="flex flex-col gap-1">{fl("Return")}{fieldInput("returnTime", "Return", { type: "time" })}</label>
                  </div>
                  <div>{fl("Transport")}<div className="mt-1 flex flex-wrap gap-1.5">{TRANSPORT.map((x) => <button key={x} type="button" onClick={() => edit("transport", x, "Transport")} className="rounded-full border-2 px-3 py-1 text-[12px] font-bold transition-colors" style={t.transport === x ? { borderColor: BLUE, background: "#eaf0fc", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{x}</button>)}</div><input value={TRANSPORT.includes(t.transport ?? "") ? "" : t.transport ?? ""} onChange={(e) => edit("transport", e.target.value, "Transport")} placeholder="…or type your own" className={`${inputCls} mt-1.5`} /></div>
                  <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                    <div className="mb-1.5 flex items-center gap-2 text-[12.5px] font-extrabold">Main trip lead & contact</div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <label className="flex flex-col gap-1">{fl("Trip lead")}<input list="trip-leads" value={t.lead ?? ""} onChange={(e) => edit("lead", e.target.value, "Trip lead")} placeholder="Type or pick a name" className={inputCls} /><datalist id="trip-leads">{[...new Set([...(t.roster ?? []).map((s) => s.n), ...listingStaff, ...team])].filter(Boolean).map((nm) => <option key={nm} value={nm} />)}</datalist></label>
                      <label className="flex flex-col gap-1">{fl("Lead phone")}{fieldInput("leadPhone", "Lead phone", { placeholder: "07700 900000" })}</label>
                      <label className="flex flex-col gap-1">{fl("EVC (visit coordinator)")}{fieldInput("evc", "EVC")}</label>
                    </div>
                  </div>
                  <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                    <div className="mb-1.5 flex items-center justify-between"><span className="text-[12.5px] font-extrabold">Itinerary & key actions</span><button type="button" onClick={() => mut((d) => { (d.itinerary ??= []).push({ t: "", a: "", k: "" }); })} className="rounded-md border border-[var(--line)] px-2 py-0.5 text-[11px] font-bold">+ Add itinerary / action</button></div>
                    <datalist id="itin-activities">{ITIN_ACTIVITIES.map((a) => <option key={a} value={a} />)}</datalist>
                    <datalist id="itin-actions">{ITIN_ACTIONS.map((a) => <option key={a} value={a} />)}</datalist>
                    <div className="flex flex-col gap-1.5">{(t.itinerary ?? []).map((r, i) => (
                      <div key={i} className="grid grid-cols-[64px_1fr_1fr_auto] items-center gap-1.5">
                        <input value={r.t ?? ""} onChange={(e) => edit(`itinerary.${i}.t`, e.target.value, "Itinerary time")} placeholder="09:00" className={inputCls} />
                        <input list="itin-activities" value={r.a ?? ""} onChange={(e) => edit(`itinerary.${i}.a`, e.target.value, "Activity")} placeholder="Pick or type an activity" className={inputCls} />
                        <input list="itin-actions" value={r.k ?? ""} onChange={(e) => edit(`itinerary.${i}.k`, e.target.value, "Key action")} placeholder="Pick or type a key action" className={inputCls} />
                        <button type="button" onClick={() => mut((d) => { d.itinerary = (d.itinerary ?? []).filter((_, j) => j !== i); })} className="px-1 text-[var(--ink-3)] hover:text-[#c02636]">✕</button>
                      </div>
                    ))}</div>
                    <div className="mt-1 text-[10.5px] text-[var(--ink-3)]">Start typing to search the list, or write your own — every field is editable.</div>
                  </div>
                  <label className="flex flex-col gap-1">{fl("Kit to take")}<textarea value={t.kit ?? ""} onChange={(e) => edit("kit", e.target.value, "Kit")} placeholder="Packed lunch, water, sun cream, weather-appropriate clothing, medication, first-aid kit…" className={`${taCls} min-h-[52px]`} /><span className="text-[11px] text-[var(--ink-2)]"><b>Emergency on the day:</b> trip lead {t.leadPhone || "—"} · office · 999.</span></label>
                </div>}

                {/* ── Step 2: Risk assessment ── */}
                {n === 2 && <div className="flex flex-col gap-2.5">
                  <div className="grid gap-2 sm:grid-cols-4">
                    <label className="flex flex-col gap-1">{fl("Reference")}{fieldInput("raRef", "RA reference", { placeholder: "RA-2025-074" })}</label>
                    <label className="flex flex-col gap-1">{fl("Assessor")}{fieldInput("raAssessor", "Assessor")}</label>
                    <label className="flex flex-col gap-1">{fl("Date")}{fieldInput("raDate", "RA date", { type: "date" })}</label>
                    <label className="flex flex-col gap-1">{fl("Review")}{fieldInput("raReview", "Review")}</label>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-[11.5px] text-[var(--ink-3)]">Set the residual risk and tick “controls in place” for every hazard, then sign off.</span><span className="flex flex-wrap gap-1.5"><button type="button" onClick={() => setBankOpen((v) => !v)} className="rounded-md border px-2 py-0.5 text-[11px] font-bold transition-colors" style={bankOpen ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{bankOpen ? "✕ Close hazard bank" : "📚 Add from hazard bank"}</button><button type="button" onClick={() => mut((d) => { (d.hazards ??= []).push({ h: "", who: "", controls: "", initial: "M", residual: "", done: false }); if (d.raSigned) d.raSigned = false; })} className="rounded-md border border-[var(--line)] px-2 py-0.5 text-[11px] font-bold">+ Blank hazard</button></span></div>
                  {(t.hazards ?? []).length > 0 && (() => { const allDone = (t.hazards ?? []).every((h) => h.done); const n = (t.hazards ?? []).filter((h) => h.done).length; return (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--surface)] px-3 py-2">
                      <span className="text-[12px] font-semibold" style={{ color: allDone ? GREEN : "var(--ink-2)" }}>{allDone ? "✓ " : ""}{n}/{(t.hazards ?? []).length} hazards have controls in place</span>
                      <button type="button" onClick={() => mut((d) => { const target = !allDone; (d.hazards ?? []).forEach((h) => { h.done = target; h.amendedOn = todayIso(); h.amendedBy = me; }); d.raSigned = false; })} className="rounded-md border px-2.5 py-1 text-[11.5px] font-bold transition-colors" style={allDone ? { borderColor: "var(--line)", color: "var(--ink-2)" } : { borderColor: GREEN, color: GREEN }}>{allDone ? "Untick all" : "✓ Tick all controls in place"}</button>
                    </div>
                  ); })()}
                  {bankOpen && (() => {
                    const have = new Set((t.hazards ?? []).map((h) => h.h.trim().toLowerCase()));
                    const isAdded = (e: (typeof HAZARD_BANK)[number]) => have.has(e.desc.trim().toLowerCase());
                    const bq = bankQ.trim().toLowerCase();
                    const groups = bankByCategory().map((g) => ({ ...g, entries: g.entries.filter((e) => !bq || `${e.area} ${e.desc} ${e.who} ${e.controls.join(" ")}`.toLowerCase().includes(bq)) })).filter((g) => g.entries.length > 0);
                    return (
                      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2.5">
                        <div className="mb-2 flex items-center gap-2">
                          <input value={bankQ} onChange={(e) => setBankQ(e.target.value)} placeholder={`Search ${HAZARD_BANK.length} hazards — travel, water, allergy, safeguarding…`} className={`${inputCls} flex-1`} />
                          <button type="button" onClick={() => { const ids = groups.flatMap((g) => g.entries).filter((e) => !isAdded(e)).map((e) => e.id); ids.forEach(addBankHazard); }} className="whitespace-nowrap rounded-md border border-[var(--line)] px-2 py-1.5 text-[11px] font-bold" style={{ color: BLUE }}>Add all shown</button>
                        </div>
                        <div className="flex max-h-[320px] flex-col gap-2.5 overflow-y-auto [scrollbar-width:thin]">
                          {groups.map((g) => (
                            <div key={g.cat}>
                              <div className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.05em] text-[var(--ink-3)]">{g.cat}</div>
                              <div className="flex flex-col gap-1.5">
                                {g.entries.map((e) => {
                                  const added = isAdded(e);
                                  return (
                                    <div key={e.id} className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-2.5">
                                      <div className="flex items-start gap-2">
                                        <div className="min-w-0 flex-1">
                                          <div className="flex flex-wrap items-center gap-1.5"><span className="text-[12.5px] font-extrabold">{e.area}</span><Badge tone={{ bg: RISK[e.initial].bg, fg: RISK[e.initial].fg }}>{RISK[e.initial].lbl}→{RISK[e.residual].lbl}</Badge><span className="text-[10.5px] text-[var(--ink-3)]">{e.controls.length} controls</span></div>
                                          <div className="mt-1 text-[11.5px] leading-[1.5] text-[var(--ink-2)]">{e.desc}</div>
                                          <div className="mt-1 text-[11px] leading-[1.5] text-[var(--ink-3)]"><b className="text-[var(--ink-2)]">Risk:</b> {e.who}</div>
                                        </div>
                                        <button type="button" disabled={added} onClick={() => addBankHazard(e.id)} className="flex-none rounded-md border px-2.5 py-1 text-[11px] font-bold" style={added ? { borderColor: "var(--line)", color: "var(--ink-3)" } : { borderColor: BLUE, color: BLUE }}>{added ? "✓ Added" : "＋ Add"}</button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                          {groups.length === 0 && <div className="px-1 py-3 text-center text-[12px] text-[var(--ink-3)]">No hazards match “{bankQ}”.</div>}
                        </div>
                        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-[var(--line)] pt-2.5">
                          <span className="text-[11.5px] font-semibold" style={{ color: GREEN }}>{(t.hazards ?? []).length} hazard{(t.hazards ?? []).length === 1 ? "" : "s"} on your assessment</span>
                          <Button sm variant="solid" onClick={() => setBankOpen(false)}>Done — view my hazards ↓</Button>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="flex flex-col gap-3">{(t.hazards ?? []).map((h, i) => {
                    return (
                    <div key={i} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3.5">
                      <div className="mb-2.5 flex items-center justify-between">
                        <span className="rounded-full bg-[#eef4fd] px-2.5 py-0.5 text-[11px] font-extrabold" style={{ color: BLUE }}>Hazard {i + 1}</span>
                        <button type="button" onClick={() => mut((d) => { d.hazards = (d.hazards ?? []).filter((_, j) => j !== i); d.raSigned = false; })} className="text-[11px] font-semibold text-[var(--ink-3)] hover:text-[#c02636]">✕ Remove</button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="flex flex-col gap-1.5">{fl("Hazard — what it is")}<textarea value={h.h} onChange={(e) => hazSet(i, "h", e.target.value, "Hazard")} placeholder="e.g. Too few staff / low ratios" className={`${taCls} min-h-[46px] font-bold`} /></label>
                        <label className="flex flex-col gap-1.5">{fl("Risk — who's harmed & how")}<textarea value={h.who ?? ""} onChange={(e) => hazSet(i, "who", e.target.value, "Who at risk")} placeholder="e.g. Children — injury near roads or water" className={`${taCls} min-h-[46px]`} /></label>
                      </div>
                      <label className="mt-3 flex flex-col gap-1.5">{fl("Control measures")}<textarea value={h.controls ?? ""} onChange={(e) => hazSet(i, "controls", e.target.value, "Controls")} placeholder="Control measures — one statement per line" className={`${taCls} min-h-[64px]`} /></label>
                      <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-[var(--line)] pt-3">
                        <div className="flex flex-col gap-1.5">{fl("Risk rating")}
                          <div className="flex flex-wrap items-center gap-2">
                            <RatingGroup label="Initial" cur={h.initial} on={(x) => hazSet(i, "initial", x, "Initial risk")} />
                            <span className="text-[13px] font-bold text-[var(--ink-3)]">→</span>
                            <RatingGroup label="Residual" cur={h.residual} on={(x) => hazSet(i, "residual", x, "Residual risk")} />
                          </div>
                        </div>
                        <label className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-bold transition-colors" style={h.done ? { background: "#e7f6ee", color: GREEN } : { background: "var(--panel)", color: "var(--ink-2)" }}><input type="checkbox" checked={!!h.done} onChange={(e) => hazSet(i, "done", e.target.checked, "Controls in place")} />Controls in place</label>
                      </div>
                      <div className="mt-2 text-[10.5px] text-[var(--ink-3)]">Last amended: {h.amendedBy ? `${h.amendedBy} · ` : ""}{h.amendedOn ? fmtDate(h.amendedOn) : "—"}</div>
                    </div>
                    );
                  })}</div>
                  {t.raSigned ? <div className="flex items-center gap-2 rounded-lg bg-[#e7f6ee] px-3 py-2 text-[12px] font-semibold" style={{ color: GREEN }}>✓ Signed off by {t.raAssessor || me} ({fmtDate(t.raDate)}).<button type="button" onClick={() => mut((d) => { d.raSigned = false; })} className="ml-auto text-[11.5px] font-bold underline" style={{ color: GREEN }}>Re-open</button></div>
                    : <div><Button variant="solid" disabled={!raReady(t.hazards ?? [])} onClick={() => mut((d) => { d.raSigned = true; d.raAssessor = d.raAssessor || me; d.raDate = d.raDate || todayIso(); })}>Sign off risk assessment</Button>{!raReady(t.hazards ?? []) && <div className="mt-1.5 rounded-lg bg-[#fdf3d8] px-3 py-2 text-[11.5px] font-semibold" style={{ color: AMBER }}>For every hazard: set a residual risk and tick “controls in place”.</div>}</div>}
                </div>}

                {/* ── Step 3: Staffing & ratio ── */}
                {n === 3 && <div className="flex flex-col gap-2.5">
                  <div className="flex flex-wrap items-center gap-2 text-[12px]">
                    <span className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5"><b>{attendingOf(t).length}</b> children going</span>
                    <span className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5"><b>{(t.roster ?? []).length}</b> staff</span>
                    <span className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5">actual ratio <b>1:{(t.roster ?? []).length ? Math.ceil(attendingOf(t).length / Math.max(1, (t.roster ?? []).length)) : "—"}</b></span>
                    <span className="ml-auto flex items-center gap-1.5 text-[var(--ink-2)]">Off-site policy 1 :<input type="number" min={1} value={ratioOf(t)} onChange={(e) => edit("offsiteRatio", Math.max(1, parseInt(e.target.value, 10) || 1), "Off-site ratio")} className="w-14 rounded-md border border-[var(--line)] px-1.5 py-1 text-center text-[13px] font-extrabold" /> · need <b>{needOf(t)}</b></span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--line)]"><div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, Math.round((t.roster ?? []).length / needOf(t) * 100))}%`, background: staffOk(t) ? GREEN : RED }} /></div>
                  {staffSuggest.length > 0 && <div><div className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">{listingStaff.length ? "Assigned to this listing / your team — tap to add" : "Your team — tap to add"}</div><div className="flex flex-wrap gap-1.5">{staffSuggest.map((s) => <button key={s} type="button" onClick={() => mut((d) => { (d.roster ??= []).push({ n: s, r: "Activity leader", fa: false }); })} className="rounded-full border-2 border-dashed px-2.5 py-1 text-[12px] font-bold" style={{ borderColor: "var(--line)", color: "var(--ink-2)" }}>＋ {s}</button>)}</div></div>}
                  <div className="flex flex-col gap-1.5">{(t.roster ?? []).map((s, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2">
                      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[#eaf0fc] text-[11px] font-extrabold" style={{ color: BLUE }}>{ini(s.n)}</span>
                      <input value={s.n} onChange={(e) => edit(`roster.${i}.n`, e.target.value, "Staff name")} placeholder="Staff name" className="min-w-[120px] flex-1 rounded-md border border-[var(--line)] px-2 py-1 text-[12.5px] font-bold outline-none focus:border-[#1d3a8f]" />
                      <input value={s.r ?? ""} onChange={(e) => edit(`roster.${i}.r`, e.target.value, "Role")} placeholder="Role (e.g. Lead)" className="min-w-[110px] flex-1 rounded-md border border-[var(--line)] px-2 py-1 text-[12px] outline-none focus:border-[#1d3a8f]" />
                      <button type="button" onClick={() => mut((d) => { d.roster![i].fa = !d.roster![i].fa; })} className="rounded-full px-2.5 py-1 text-[11px] font-extrabold" style={s.fa ? { background: "#e7f6ee", color: GREEN } : { background: "var(--panel)", color: "var(--ink-3)" }}>{s.fa ? "First aider" : "+ first aid"}</button>
                      <button type="button" onClick={() => mut((d) => { d.roster = (d.roster ?? []).filter((_, j) => j !== i); })} className="px-1 text-[var(--ink-3)] hover:text-[#c02636]">✕</button>
                    </div>
                  ))}</div>
                  <button type="button" onClick={() => mut((d) => { (d.roster ??= []).push({ n: "", r: "Activity leader", fa: false }); })} className="self-start rounded-lg border-2 border-dashed border-[var(--line)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)]">＋ Add staff member</button>
                  <div className="rounded-lg px-3 py-2 text-[12px] font-semibold" style={staffOk(t) ? { background: "#e7f6ee", color: GREEN } : { background: "#fdebec", color: RED }}>{staffOk(t) ? `✓ Off-site ratio met (1:${ratioOf(t)}), with a named lead and a first aider.` : `⚠️ ${((t.roster ?? []).length < needOf(t)) ? `Need ${needOf(t) - (t.roster ?? []).length} more staff for 1:${ratioOf(t)}. ` : ""}${hasLead(t) ? "" : "No named lead (give a staff member a role containing “Lead”). "}${hasFA(t) ? "" : "No first aider assigned."}`}</div>
                </div>}

                {/* ── Step 4: Parent permissions ── */}
                {n === 4 && <div className="flex flex-col gap-2.5">
                  <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                    <div className="mb-2 text-[12.5px] font-extrabold">Add children booked on this trip</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="flex flex-col gap-1">{fl("From which camp / club")}<select value={t.listingId ?? ""} onChange={(e) => { edit("listingId", e.target.value || "", "Listing"); setPassFilter(""); }} className={inputCls}><option value="">All my bookings</option>{listings.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
                      <label className="flex flex-col gap-1">{fl("Which pass (some include the trip, some don't)")}<select value={passFilter} onChange={(e) => setPassFilter(e.target.value)} className={inputCls}><option value="">All passes</option>{passOptions.map((p) => <option key={p} value={p}>{p}</option>)}</select>{passOptions.length === 0 && <span className="text-[10.5px] text-[var(--ink-3)]">No passes found for this listing/date.</span>}</label>
                    </div>
                    <div className="mt-2 mb-1 flex items-center justify-between"><span className="text-[11px] font-semibold text-[var(--ink-3)]">{notBooked.length} booked on {fmtDate(t.date)}{passFilter ? ` · ${passFilter}` : ""} not yet added</span>{notBooked.length > 0 && <button type="button" onClick={() => mut((d) => { const have = new Set((d.attendees ?? []).map((a) => a.n)); notBooked.forEach((b) => { if (!have.has(b.n)) (d.attendees ??= []).push({ n: b.n, age: b.age, consent: "pending", paid: false, em: false }); }); })} className="rounded-md border border-[#1d3a8f] px-2.5 py-1 text-[11px] font-bold" style={{ color: BLUE }}>✓ Add all {notBooked.length}</button>}</div>
                    {notBooked.length > 0 ? <div className="flex max-h-44 flex-col gap-1 overflow-y-auto [scrollbar-width:thin]">{notBooked.map((b) => (
                      <div key={b.n} className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1.5">
                        <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[#eaf0fc] text-[10.5px] font-extrabold" style={{ color: BLUE }}>{ini(b.n)}</span>
                        <span className="flex-1 text-[12.5px] font-semibold">{b.n}{b.age ? <span className="font-normal text-[var(--ink-3)]"> · age {b.age}</span> : ""}</span>
                        <button type="button" onClick={() => mut((d) => { if (!(d.attendees ?? []).some((a) => a.n === b.n)) (d.attendees ??= []).push({ n: b.n, age: b.age, consent: "pending", paid: false, em: false }); })} className="rounded-md border border-[var(--line)] px-2.5 py-0.5 text-[11px] font-bold" style={{ color: BLUE }}>＋ Add</button>
                      </div>
                    ))}</div> : <div className="rounded-lg bg-[var(--panel)] px-3 py-2 text-[12px] text-[var(--ink-3)]">{booked.length === 0 ? "No children booked on this date for the chosen listing/pass." : "Everyone booked here is already on the trip."}</div>}
                  </div>
                  {(t.attendees ?? []).length > 0 ? <>
                    <div className="text-[12px] text-[var(--ink-2)]"><b>{attendingOf(t).length}</b> consented · <b style={{ color: AMBER }}>{pendingOf(t).length}</b> pending · <b style={{ color: "var(--ink-3)" }}>{declinedOf(t).length}</b> not coming · <b>{paidCountOf(t)}/{(t.attendees ?? []).length - declinedOf(t).length}</b> paid</div>
                    <div className="flex h-2 overflow-hidden rounded-full bg-[var(--line)]">
                      <div style={{ width: `${attendingOf(t).length / (t.attendees ?? []).length * 100}%`, background: GREEN }} /><div style={{ width: `${pendingOf(t).length / (t.attendees ?? []).length * 100}%`, background: "#f0b100" }} /><div style={{ width: `${declinedOf(t).length / (t.attendees ?? []).length * 100}%`, background: "#8a86a3" }} />
                    </div>
                    {pendingOf(t).length > 0 && <div className="flex items-center gap-2"><button type="button" onClick={() => setRemindStamp(nowLabel())} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-bold" style={{ color: BLUE }}>Send request to {pendingOf(t).length} parent{pendingOf(t).length > 1 ? "s" : ""}</button>{remindStamp && <span className="text-[11.5px] font-semibold" style={{ color: GREEN }}>✓ requested {remindStamp}</span>}</div>}
                    <div className="flex flex-col gap-1.5">{(t.attendees ?? []).map((c, i) => {
                      const cs = c.consent ?? "pending"; const tone = cs === "granted" ? { l: "Consented", bg: "#e7f6ee", fg: GREEN } : cs === "pending" ? { l: "Pending", bg: "#fdf3d8", fg: AMBER } : { l: "Not coming", bg: "#f0eef4", fg: "#8a86a3" };
                      return (
                        <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2">
                          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[#eaf0fc] text-[11px] font-extrabold" style={{ color: BLUE }}>{ini(c.n)}</span>
                          <div className="min-w-[130px] flex-1"><div className="text-[12.5px] font-extrabold">{c.n}</div><div className="text-[11px] text-[var(--ink-3)]">{c.age ? `Age ${c.age} · ` : ""}{c.em ? "✓ emergency contact" : "⚠ no contact"}{c.med ? ` · ⚠ ${c.med}` : ""}</div></div>
                          <span className="rounded-full px-2 py-0.5 text-[10.5px] font-extrabold" style={c.paid ? { background: "#e7f6ee", color: GREEN } : { background: "var(--panel)", color: "var(--ink-3)" }}>{c.paid ? `Paid £${t.cost}` : "Unpaid"}</span>
                          <span className="rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold" style={{ background: tone.bg, color: tone.fg }}>{tone.l}</span>
                          {cs === "pending" && (c.paid ? <button type="button" onClick={() => mut((d) => { d.attendees![i].consent = "granted"; })} className="rounded-md border border-[var(--line)] px-2 py-0.5 text-[11px] font-bold" style={{ color: BLUE }}>Record consent</button> : <button type="button" onClick={() => mut((d) => { d.attendees![i].paid = true; })} className="rounded-md border border-[var(--line)] px-2 py-0.5 text-[11px] font-bold" style={{ color: BLUE }}>Take payment</button>)}
                          {cs !== "declined" ? <button type="button" onClick={() => mut((d) => { d.attendees![i].consent = "declined"; })} className="px-1 text-[11px] text-[var(--ink-3)] hover:text-[#c02636]" title="Mark not coming">✕</button> : <button type="button" onClick={() => mut((d) => { d.attendees![i].consent = "pending"; })} className="rounded-md border border-[var(--line)] px-2 py-0.5 text-[11px] font-bold">Re-add</button>}
                        </div>
                      );
                    })}</div>
                    <div className="rounded-lg bg-[#f4f8ff] px-3 py-2 text-[11px] text-[var(--ink-2)]">📨 Parents confirm consent & pay in their area — payment runs through your connected processor (Stripe Connect). Collecting consent from parents is set up by Amir.</div>
                  </> : <div className="rounded-lg bg-[var(--panel)] px-3 py-2 text-[12px] text-[var(--ink-3)]">No children on the trip yet — {booked.length > 0 ? "add the booked children above." : "no bookings found on this date."}</div>}
                </div>}

                {/* ── Step 5: Sign-off ── */}
                {n === 5 && <div className="flex flex-col gap-2.5">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="rounded-xl border-2 px-3 py-2" style={{ borderColor: `color-mix(in srgb,${GREEN} 40%,transparent)`, background: "#f2fbf6" }}>{fl("Prepared by")}<div className="text-[13px] font-extrabold">{t.lead || "Trip lead"}</div><div className="text-[11px] text-[var(--ink-3)]">Trip lead</div></div>
                    <div className="rounded-xl border border-[var(--line)] px-3 py-2">{fl("Checks")}<div className="text-[13px] font-extrabold">RA · ratio · consents</div><div className="text-[11px] text-[var(--ink-3)]">{raDone(t) && staffOk(t) && permsOk(t) ? "All clear" : "In progress"}</div></div>
                    <div className="rounded-xl border border-[var(--line)] px-3 py-2">{fl("Approved by")}<div className="text-[13px] font-extrabold">{s5Ok(t) ? t.signoff?.approvedBy : "Awaiting manager"}</div><div className="text-[11px] text-[var(--ink-3)]">{s5Ok(t) ? t.signoff?.approvedAt : "Line manager"}</div></div>
                  </div>
                  {s5Ok(t) ? <div className="rounded-lg bg-[#e7f6ee] px-3 py-2 text-[12px] font-semibold" style={{ color: GREEN }}>✓ Approved by {t.signoff?.approvedBy} on {t.signoff?.approvedAt}. The trip is cleared to run.</div>
                    : <><Button variant="solid" disabled={!canSubmit(t)} onClick={() => mut((d) => { d.signoff = { approvedBy: `${me} (Manager)`, approvedAt: `${fmtDate(todayIso())}, ${nowLabel()}`, submitted: true }; })}>Approve trip (manager)</Button>{!canSubmit(t) && <div className="rounded-lg bg-[#fdf3d8] px-3 py-2 text-[11.5px] font-semibold" style={{ color: AMBER }}>⚠️ Cannot approve yet — outstanding: {[!s1Ok(t) && "trip details", !raDone(t) && "risk assessment", !staffOk(t) && "staffing/ratio", !permsOk(t) && `${pendingOf(t).length} consent${pendingOf(t).length === 1 ? "" : "s"}`].filter(Boolean).join(", ")}.</div>}</>}
                </div>}

                {/* ── Step 6: Head counts ── */}
                {n === 6 && (locked ? <div className="rounded-lg bg-[var(--panel)] px-3 py-2 text-[12px] text-[var(--ink-3)]">Head counts unlock once the trip is approved (Step 5).</div> : <div className="flex flex-col gap-2">
                  <div className="text-[12px] text-[var(--ink-2)]">Children on trip: <b>{attendingOf(t).length}</b></div>
                  {(t.checkpoints ?? []).map((c, i) => {
                    const go = attendingOf(t).length, counted = c.counted != null, ok = counted && (c.counted ?? 0) >= go;
                    return (
                      <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2">
                        <input value={c.n} onChange={(e) => edit(`checkpoints.${i}.n`, e.target.value, "Checkpoint")} className="min-w-[120px] flex-1 rounded-md border border-[var(--line)] px-2 py-1 text-[12.5px] font-bold outline-none focus:border-[#1d3a8f]" />
                        <input type="number" min={0} value={counted ? c.counted! : go} disabled={counted} onChange={(e) => mut((d) => { d.checkpoints![i].counted = Math.max(0, parseInt(e.target.value, 10) || 0); })} className="w-16 rounded-md border border-[var(--line)] px-2 py-1 text-center text-[13px] font-extrabold disabled:opacity-60" id={`cp-${i}`} />
                        {counted ? <><span className="rounded-full px-2.5 py-0.5 text-[11px] font-extrabold" style={ok ? { background: "#e7f6ee", color: GREEN } : { background: "#fdebec", color: RED }}>{ok ? `✓ all ${c.counted}` : `⚠ ${c.counted}/${go}`}</span><button type="button" onClick={() => mut((d) => { d.checkpoints![i].counted = null; d.checkpoints![i].time = undefined; })} className="px-1 text-[var(--ink-3)]" title="Recount">↻</button></> : <button type="button" onClick={() => { const el = document.getElementById(`cp-${i}`) as HTMLInputElement | null; const v = el ? (parseInt(el.value, 10) || go) : go; mut((d) => { d.checkpoints![i].counted = v; d.checkpoints![i].time = nowLabel(); }); }} className="rounded-md border border-[var(--line)] px-2 py-0.5 text-[11px] font-bold" style={{ color: BLUE }}>Confirm count</button>}
                      </div>
                    );
                  })}
                  <button type="button" onClick={() => mut((d) => { (d.checkpoints ??= []).push({ n: "New checkpoint", counted: null }); })} className="self-start rounded-lg border-2 border-dashed border-[var(--line)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)]">＋ Add checkpoint</button>
                  <div className="rounded-lg bg-[#fdebec] px-3 py-2 text-[12px] font-semibold" style={{ color: RED }}>☎ Emergency on the day: trip lead {t.leadPhone || "—"} · office · 999. Phone tree & first-aider with the group.</div>
                </div>)}

                {/* ── Step 7: Return & debrief ── */}
                {n === 7 && <div className="flex flex-col gap-2.5">
                  <label className="flex flex-col gap-1.5">{fl("Debrief notes")}<textarea value={t.notes ?? ""} onChange={(e) => edit("notes", e.target.value, "Debrief notes")} placeholder="Debrief — what went well, any incidents, anything to change next time…" className={`${taCls} min-h-[72px]`} /></label>
                  {t.returned ? <div className="flex flex-wrap items-center gap-2 rounded-lg bg-[#e7f6ee] px-3 py-2 text-[12px] font-semibold" style={{ color: GREEN }}>✓ Trip returned and closed — all children accounted for and handed back. You can still edit the debrief above.<button type="button" onClick={() => mut((d) => { d.returned = false; d.status = "planned"; })} className="ml-auto text-[11.5px] font-bold underline" style={{ color: GREEN }}>Re-open trip</button></div>
                    : s6Ok(t) ? <Button variant="solid" onClick={() => mut((d) => { d.returned = true; d.status = "completed"; })}>Mark trip returned & complete</Button>
                    : <div className="rounded-lg bg-[#fdf3d8] px-3 py-2 text-[11.5px] font-semibold" style={{ color: AMBER }}>Complete every head-count checkpoint (Step 6) to close the trip — you can still write the debrief now.</div>}
                </div>}

                {/* ── Step 8: Message parents & payment (optional) ── */}
                {n === 8 && (() => {
                  const msg = t.parentMsg && t.parentMsg.trim() ? t.parentMsg : defaultParentMsg(t, providerName);
                  return (
                    <div className="flex flex-col gap-3">
                      <div className="rounded-lg bg-[#f4f8ff] px-3 py-2 text-[12px] text-[var(--ink-2)]"><b>Optional.</b> Skip this if parents consent/pay when they book. Choose what to ask for below — the letter and its buttons adapt.</div>
                      <div>{fl("What is this letter asking parents to do?")}
                        <div className="mt-1 flex flex-wrap gap-2">
                          <button type="button" onClick={() => mut((d) => { d.askConsent = d.askConsent === false; })} className="flex items-center gap-2 rounded-lg border-2 px-3 py-1.5 text-[12px] font-bold transition-colors" style={t.askConsent !== false ? { borderColor: GREEN, background: "#e7f6ee", color: GREEN } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{t.askConsent !== false ? "✓" : "○"} Ask for consent (permission tick)</button>
                          <button type="button" onClick={() => mut((d) => { d.askPay = d.askPay === false; })} className="flex items-center gap-2 rounded-lg border-2 px-3 py-1.5 text-[12px] font-bold transition-colors" style={t.askPay !== false ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{t.askPay !== false ? "✓" : "○"} Ask for payment</button>
                        </div>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="flex flex-col gap-1">{fl(t.askPay !== false ? "Ask parents to pay by" : "Ask parents to respond by")}<input type="date" value={t.payBy ?? ""} min={todayIso()} max={t.date} onChange={(e) => edit("payBy", e.target.value, "Pay-by date")} className={inputCls} /></label>
                        {t.askPay !== false && <div className="flex flex-col gap-1">{fl("Cost per child")}<div className="rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 py-1.5 text-[12.5px] font-bold">£{t.cost || "0.00"} <span className="font-normal text-[var(--ink-3)]">· set in Step 1</span></div></div>}
                      </div>
                      <div>
                        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">{fl("Message to parents (editable)")}<button type="button" onClick={() => edit("parentMsg", defaultParentMsg(t, providerName), "Parent message")} className="rounded-md border border-[var(--line)] px-2 py-0.5 text-[11px] font-bold text-[var(--ink-2)]">↺ Reset to template</button></div>
                        <textarea value={msg} onChange={(e) => edit("parentMsg", e.target.value, "Parent message")} className={`${inputCls} min-h-[180px] [field-sizing:content] resize-y leading-[1.6]`} />
                        <div className="mt-1.5 flex flex-wrap items-center gap-1"><span className="text-[10.5px] font-semibold text-[var(--ink-3)]">Merge fields:</span>{MERGE_FIELDS.map((f) => <code key={f} className="rounded bg-[var(--panel)] px-1.5 py-0.5 text-[10.5px] text-[#1d3a8f]">{f}</code>)}</div>
                      </div>
                      <div>
                        {fl("Preview — what parents receive")}
                        <div className="mt-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                          <div className="whitespace-pre-line text-[12.5px] leading-[1.6] text-[var(--ink-2)]">{resolveMsg(msg, t, providerName)}</div>
                          <div className="mt-2.5 flex flex-wrap gap-2">
                            {t.askConsent !== false && <div className="inline-flex items-center gap-2 rounded-lg border-2 border-[#0f7a43]/30 bg-[#e7f6ee] px-3 py-1.5 text-[12px] font-extrabold" style={{ color: GREEN }}>☑ I give permission for my child to attend {t.destination || "the trip"}</div>}
                            {t.askPay !== false && <div className="inline-flex items-center gap-2 rounded-lg bg-[#eef4fd] px-3 py-1.5 text-[12px] font-extrabold" style={{ color: BLUE }}>💳 Pay £{t.cost || "0.00"}{t.payBy ? ` · by ${fmtDate(t.payBy)}` : ""}</div>}
                            {t.askConsent === false && t.askPay === false && <div className="text-[11.5px] text-[var(--ink-3)]">Nothing is being requested — turn on consent and/or payment above.</div>}
                          </div>
                        </div>
                      </div>
                      {(() => {
                        const recips = (t.attendees ?? []).filter((a) => a.consent !== "declined");
                        const sentN = recips.filter((a) => a.sent).length;
                        const sendAll = () => mut((d) => { (d.attendees ?? []).forEach((a) => { if (a.consent !== "declined") a.sent = true; }); d.parentMsgSentAt = `${fmtDate(todayIso())}, ${nowLabel()}`; });
                        return (
                          <div>
                            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">{fl("Who this goes to")}<span className="text-[11px] font-semibold" style={{ color: sentN === recips.length && recips.length > 0 ? GREEN : "var(--ink-3)" }}>{sentN}/{recips.length} sent</span></div>
                            {recips.length === 0 ? <div className="rounded-lg bg-[var(--panel)] px-3 py-2 text-[12px] text-[var(--ink-3)]">No children on the trip yet — add them in Step 4 (Parent permissions).</div>
                              : <div className="flex flex-col gap-1">
                                {recips.map((a, i) => {
                                  const idx = (t.attendees ?? []).indexOf(a);
                                  return (
                                    <div key={i} className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5">
                                      <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[#eaf0fc] text-[10.5px] font-extrabold" style={{ color: BLUE }}>{ini(a.n)}</span>
                                      <span className="flex-1 text-[12.5px] font-semibold">{a.n}<span className="font-normal text-[var(--ink-3)]"> · parent</span></span>
                                      {a.sent ? <span className="rounded-full px-2 py-0.5 text-[10.5px] font-extrabold" style={{ background: "#e7f6ee", color: GREEN }}>✓ Sent</span> : <span className="rounded-full px-2 py-0.5 text-[10.5px] font-extrabold" style={{ background: "#fdf3d8", color: AMBER }}>Not sent</span>}
                                      <button type="button" onClick={() => mut((d) => { if (d.attendees?.[idx]) d.attendees[idx].sent = true; d.parentMsgSentAt = `${fmtDate(todayIso())}, ${nowLabel()}`; })} className="rounded-md border border-[var(--line)] px-2 py-0.5 text-[11px] font-bold" style={{ color: BLUE }}>{a.sent ? "Resend" : "Send"}</button>
                                    </div>
                                  );
                                })}
                              </div>}
                            {recips.length > 0 && <div className="mt-2.5 flex flex-wrap items-center gap-2">
                              <Button variant="solid" onClick={sendAll}>{sentN > 0 ? "Resend to all" : "Send to all parents & generate pay links"}</Button>
                              {sentN < recips.length && sentN > 0 && <button type="button" onClick={() => mut((d) => { (d.attendees ?? []).forEach((a) => { if (a.consent !== "declined" && !a.sent) a.sent = true; }); d.parentMsgSentAt = `${fmtDate(todayIso())}, ${nowLabel()}`; })} className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[12px] font-bold" style={{ color: BLUE }}>Send to {recips.length - sentN} not-yet-sent</button>}
                              {t.parentMsgSentAt && <span className="text-[11.5px] font-semibold" style={{ color: GREEN }}>✓ last sent {t.parentMsgSentAt}</span>}
                            </div>}
                            <div className="mt-1.5 text-[11px] text-[var(--ink-3)]">Emails the message + a secure pay link to each parent and adds it to their profile — the sending, link and profile entry are wired up by your backend.</div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>
      {/* slideshow nav */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <Button disabled={open <= 1} onClick={() => setOpen(Math.max(1, open - 1))}>← Previous</Button>
        <span className="hidden text-[11.5px] font-semibold text-[var(--ink-3)] sm:block">Step {open} of 8 · {TITLES[open]}</span>
        <Button variant="solid" disabled={open >= 8} onClick={() => setOpen(Math.min(8, open + 1))}>Next →</Button>
      </div>

      {error && <div className="mt-3 text-[12.5px] font-bold text-[var(--red,#e21d27)]">{error}</div>}
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--line)] pt-3">
        <Button onClick={onClose}>← Back to trips</Button>
        <div className="flex gap-2"><Button disabled={busy} onClick={() => save(false)}>{busy ? "Saving…" : "Save"}</Button><Button variant="solid" disabled={busy} onClick={() => save(true)}>{busy ? "Saving…" : "Save & close"}</Button></div>
      </div>
    </Card>
  );
}

export function TripsApp() {
  const { settings } = useSettings();
  const ratioTarget = settings.trips?.ratioTarget ?? 8;
  const notifies = settings.trips?.notifyParent ?? true;
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [planning, setPlanning] = useState<{ trip?: Trip } | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const refresh = useCallback(() => { apiGet<Trip[]>("/api/trips").then((t) => { setTrips(t); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load")); }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { apiGet<{ role: string }>("/api/me").then((me) => setCanManage(["company", "freelancer", "franchise"].includes(me.role))).catch(() => {}); }, []);
  useRealtime(["trips"], refresh);

  async function remove(t: Trip) { if (!confirm(`Delete the trip to ${t.destination}?`)) return; try { await api(`/api/trips/${encodeURIComponent(t.id)}`, { method: "DELETE" }); refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } }
  // Quick head count from the card — confirm the next checkpoint without opening the planner.
  async function quickCount(t: Trip, count: number) {
    const cps = (t.checkpoints ?? []).map((c) => ({ ...c }));
    const next = cps.findIndex((c) => c.counted == null);
    if (next < 0) return;
    cps[next] = { ...cps[next], counted: count, time: nowLabel() };
    try { await apiPut(`/api/trips/${encodeURIComponent(t.id)}`, { checkpoints: cps }); refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }

  const all = useMemo(() => trips ?? [], [trips]);
  const upcoming = all.filter((t) => !t.returned && t.status !== "cancelled" && t.date >= todayIso()).length;
  const thisMonth = all.filter((t) => (t.date ?? "").slice(0, 7) === todayIso().slice(0, 7)).length;
  const needAction = all.filter((t) => t.status === "planned" && !t.returned && !canSubmit(t)).length;
  const tiles: [string, number][] = [["Upcoming", upcoming], ["This month", thisMonth], ["Need action", needAction], ["Total", all.length]];
  const ql = q.trim().toLowerCase();
  const shown = useMemo(() => all.filter((t) => (!ql || t.destination.toLowerCase().includes(ql) || (t.childNames ?? []).join(" ").toLowerCase().includes(ql)) && (!statusFilter || t.status === statusFilter)).sort((a, b) => (`${b.date}` < `${a.date}` ? -1 : 1)), [all, ql, statusFilter]);

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      <div className="relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 62%,#ffffff 100%)" }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}><span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">🚌</span>Trips &amp; visits</div>
            <p className="mt-1.5 max-w-[640px] text-[12.5px] leading-[1.5] text-white/85">Plan an off-site visit end to end — details &amp; itinerary, risk assessment, ratios, parent consent, line-manager sign-off and live head counts.</p>
          </div>
          {!planning && <button type="button" onClick={() => setPlanning({})} className="rounded-full bg-white px-4 py-2 text-[13px] font-extrabold text-[#1d3a8f] shadow-md transition-transform hover:-translate-y-px">＋ Plan a trip</button>}
        </div>
        {trips && (
          <div className="mt-4 flex flex-wrap gap-2.5">{tiles.map(([label, v]) => (
            <div key={label} className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur-sm"><div className="text-[20px] font-extrabold leading-none">{v}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/80">{label}</div></div>
          ))}</div>
        )}
      </div>

      {error && <div className="mb-3 rounded-lg border border-[#f6c9cc] bg-[#fdebec] px-3 py-2 text-[12.5px] text-[#e21d27]">{error}</div>}
      {planning && <TripPlanner key={planning.trip?.id ?? "new"} existing={planning.trip} ratioTarget={ratioTarget} providerName={settings.providerName || "Your provider"} onSaved={refresh} onClose={() => setPlanning(null)} />}

      {!planning && trips && all.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {([["", "All"], ["planned", "Planned"], ["completed", "Completed"], ["cancelled", "Cancelled"]] as [string, string][]).map(([id, label]) => (
            <button key={label} type="button" onClick={() => setStatusFilter(id)} className="rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-colors" style={statusFilter === id ? { borderColor: BLUE, background: BLUE, color: "#fff" } : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-2)" }}>{label}</button>
          ))}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search destination or child…" className="ml-auto w-56 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 py-1.5 text-[12.5px] outline-none focus:border-[#1d3a8f]" />
        </div>
      )}

      {planning ? null
        : !trips ? <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
        : shown.length === 0 ? <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">{all.length === 0 ? "No trips planned yet — plan your first off-site visit." : "No trips match."}</Card>
        : (
          <div className="flex flex-col gap-2.5">{shown.map((t) => {
            const st = STAT[t.status] ?? STAT.planned, pct = readinessOf(t), sp = statusPill(t);
            const kids = attendingOf(t).length || t.headcount || t.childNames.length, staffN = (t.roster ?? []).length || t.staff.length;
            const under = kids > 0 && staffN > 0 && kids / staffN > ratioOf(t);
            return (
              <Card key={t.id} className="overflow-hidden p-0">
                <div className="h-1.5 w-full" style={{ background: st.fg }} />
                <div className="flex flex-wrap items-center gap-4 p-4">
                  <Ring pct={pct} />
                  <div className="min-w-[200px] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[16px] font-extrabold leading-tight" style={{ fontFamily: "var(--ff-display)" }}>{t.destination || "Untitled trip"}</span>
                      <span className="rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold" style={{ background: `color-mix(in srgb,${sp[1]} 14%,transparent)`, color: `color-mix(in srgb,${sp[1]} 74%,#000)` }}>{sp[0]}</span>
                    </div>
                    <p className="mt-1 text-[12.5px] text-[var(--ink-2)]">{fmtDate(t.date)}{t.transport ? ` · ${t.transport}` : ""}{t.departTime ? ` · depart ${t.departTime}` : ""}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge tone={{ bg: "#eef4fd", fg: BLUE }}>{kids} children</Badge>
                      <Badge tone={staffOk(t) ? { bg: "#e7f6ee", fg: GREEN } : { bg: "#fdebec", fg: RED }}>{staffN} staff · 1:{ratioOf(t)}</Badge>
                      <Badge tone={raDone(t) ? { bg: "#e7f6ee", fg: GREEN } : { bg: "#fdf3d8", fg: AMBER }}>{raDone(t) ? "✓ RA signed" : "RA draft"}</Badge>
                      {(() => { const tot = (t.attendees ?? []).length - declinedOf(t).length, con = attendingOf(t).length, paid = paidCountOf(t); return <>
                        <Badge tone={con >= tot && tot > 0 ? { bg: "#e7f6ee", fg: GREEN } : { bg: "#fdf3d8", fg: AMBER }}>✍️ Consent {con}/{tot || 0}</Badge>
                        {t.askPay !== false && (paid > 0 || tot > 0) && <Badge tone={paid >= tot && tot > 0 ? { bg: "#e7f6ee", fg: GREEN } : { bg: "#eef4fd", fg: BLUE }}>💳 Paid {paid}/{tot || 0}</Badge>}
                      </>; })()}
                      <Badge tone={s5Ok(t) ? { bg: "#e7f6ee", fg: GREEN } : { bg: "#fdf3d8", fg: AMBER }}>{s5Ok(t) ? "✓ signed off" : "sign-off pending"}</Badge>
                      {under && <Badge tone={{ bg: "#fdebec", fg: RED }}>⚠️ over 1:{ratioOf(t)}</Badge>}
                    </div>
                  </div>
                  <div className="flex flex-none flex-col gap-2 sm:items-end">
                    <Button sm variant="solid" onClick={() => { setPlanning({ trip: t }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Open planner</Button>
                    {canManage && <Button sm variant="danger" onClick={() => remove(t)}>Delete</Button>}
                  </div>
                </div>
                {s5Ok(t) && !t.returned && (() => {
                  const go = attendingOf(t).length, cps = t.checkpoints ?? [];
                  const doneN = cps.filter((c) => c.counted != null).length;
                  const nextCp = cps.find((c) => c.counted == null);
                  const last = [...cps].reverse().find((c) => c.counted != null);
                  const allOk = !nextCp;
                  return (
                    <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] bg-[#eef4fd] px-4 py-2.5">
                      <span className="text-[12px] font-extrabold" style={{ color: BLUE }}>🧮 Head count</span>
                      <span className="text-[11.5px] text-[var(--ink-2)]">{go} on trip · {doneN}/{cps.length} checkpoints{last ? ` · last ${last.counted}/${go} at ${last.time}` : ""}</span>
                      {allOk ? <span className="ml-auto rounded-full bg-[#e7f6ee] px-2.5 py-0.5 text-[11px] font-extrabold" style={{ color: GREEN }}>✓ all counted</span>
                        : <button type="button" onClick={() => quickCount(t, go)} className="ml-auto rounded-lg px-3 py-1.5 text-[12px] font-extrabold text-white shadow-sm" style={{ background: BLUE }}>✓ {nextCp!.n}: all {go} present</button>}
                    </div>
                  );
                })()}
                {notifies && !t.returned && pendingOf(t).length > 0 && <div className="border-t border-[var(--line)] bg-[#f4f8ff] px-4 py-2 text-[11.5px] text-[var(--ink-2)]">📨 {pendingOf(t).length} parent{pendingOf(t).length === 1 ? "" : "s"} still to confirm consent — chase from Step 4.</div>}
              </Card>
            );
          })}</div>
        )}
    </div>
  );
}
