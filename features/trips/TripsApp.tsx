"use client";

import { dateLocale as dl } from "@/lib/i18n/format";
import { useT, useI18n, tNow } from "@/lib/i18n/provider";
import { isRTL } from "@/lib/i18n/config";
import { richT } from "@/components/shell/richT";
import { pickPlural } from "@/lib/i18n/plural";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { api, get as apiGet, post as apiPost, put as apiPut } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useSettings } from "@/lib/settings";
import { Badge, Button, Card } from "@/components/ui";
import { SettingsLink } from "@/components/OperatorPage";
import { TourLauncher } from "@/features/common/TourLauncher";
import { bankByCategory, categoryLabel, localiseEntry, HAZARD_BANK } from "./hazardBank";

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
  planned: { label: "p8ops.tpStatPlanned", bg: "#eaf0fc", fg: BLUE },
  completed: { label: "p8ops.tpStatCompleted", bg: "#e7f6ee", fg: GREEN },
  cancelled: { label: "p8ops.tpStatCancelled", bg: "#fdebec", fg: RED },
} as const;
const RISK = { L: { lbl: "p8ops.tpRiskLow", bg: "#e7f6ee", fg: GREEN }, M: { lbl: "p8ops.tpRiskMed", bg: "#fdf3d8", fg: AMBER }, H: { lbl: "p8ops.tpRiskHigh", bg: "#fdebec", fg: RED } } as const;
const TRANSPORT = ["Minibus", "Coach", "Walking", "Public bus", "Train", "Parents drop-off", "Provider vehicles"];
// Stored values stay English; only the label is translated.
const TRANSPORT_KEY: Record<string, string> = { "Minibus": "p8ops.tpTrMinibus", "Coach": "p8ops.tpTrCoach", "Walking": "p8ops.tpTrWalking", "Public bus": "p8ops.tpTrPublicBus", "Train": "p8ops.tpTrTrain", "Parents drop-off": "p8ops.tpTrParents", "Provider vehicles": "p8ops.tpTrProvider" };
// Template wording for a NEW trip is offered in the active language (catalogue key derived from the English text); a record that is
// already saved keeps whatever text it holds. Role names stay as typed: the staffing check looks for "Lead".
const tz = (s: string): string => { const k = `p8ops.ti_${s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48)}`; const r = tNow(k); return r !== k ? r : s; };
const EN_HAZARDS: Hazard[] = [
  { h: "Transport / travel", who: "All children & staff", controls: "Seatbelts on; head-count on and off; first-aider on board; DBS-checked driver", initial: "M", residual: "L", done: false },
  { h: "Lost / separated child", who: "Children", controls: "Hi-vis; agreed meeting point; head-count at every leg; named lead holds register; buddy system", initial: "H", residual: "L", done: false },
  { h: "Road crossing / pedestrian", who: "All", controls: "Use crossings; staff front and back; walk in pairs", initial: "M", residual: "L", done: false },
  { h: "Weather / sun / heat", who: "All", controls: "Sun cream; hats; water; shade breaks; check forecast", initial: "L", residual: "L", done: false },
  { h: "Medical / allergies", who: "Named children", controls: "Meds & care plans carried; first-aid kit; emergency contacts to hand", initial: "M", residual: "L", done: false },
  { h: "Venue-specific hazards", who: "All", controls: "Follow venue rules & staff briefing; site risk-assessment reviewed", initial: "M", residual: "L", done: false },
];
const defaultHazards = (): Hazard[] => EN_HAZARDS.map((h) => ({ ...h, h: tz(h.h), who: h.who ? tz(h.who) : h.who, controls: h.controls ? tz(h.controls) : h.controls }));
const defaultCheckpoints = (): Checkpoint[] => ["Depart base", "Arrive venue", "Lunch / midpoint", "Before return", "Back at base"].map((n) => ({ n: tz(n), counted: null }));
const TITLE_KEYS = ["", "p8ops.tpStep1", "p8ops.tpStep2", "p8ops.tpStep3", "p8ops.tpStep4", "p8ops.tpStep5", "p8ops.tpStep6", "p8ops.tpStep7"];
const STEP_NUMS = [1, 2, 3, 4, 5, 6, 7];
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

const fmtDate = (iso?: string) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString(dl(), { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");
const todayIso = () => { const t = new Date(); const p = (n: number) => String(n).padStart(2, "0"); return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`; };
const nowLabel = () => new Date().toLocaleTimeString(dl(), { hour: "2-digit", minute: "2-digit" });
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
  if (t.returned) return ["p8ops.tpPillCompleted", GREEN];
  if ((t.checkpoints ?? []).some((c) => c.counted != null)) return ["p8ops.tpPillOnTrip", SIG];
  if (s5Ok(t)) return ["p8ops.tpPillApproved", GREEN];
  if (canSubmit(t)) return ["p8ops.tpPillReady", SIG];
  return ["p8ops.tpPillPlanning", "#8a86a3"];
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
    lead: "", leadPhone: "", evc: "", kit: tz("Packed lunch, water, sun cream, weather-appropriate clothing."),
    itinerary: [{ t: "09:00", a: tz("Depart base"), k: tz("Head-count on") }, { t: "", a: "", k: "" }],
    hazards: defaultHazards(), raRef: "", raAssessor: "", raDate: todayIso(), raReview: tz("Reviewed before each run"),
    roster: [], attendees: [], checkpoints: defaultCheckpoints(), signoff: {}, returned: false,
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
  const tr = useT();
  return (
    <div className="inline-flex items-center gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">{label}</span>
      <div className="inline-flex overflow-hidden rounded-lg border border-[var(--line)] shadow-[0_1px_2px_rgba(23,21,52,.04)]">
        {(["L", "M", "H"] as const).map((v) => (
          <button key={v} type="button" onClick={() => on(v)} className="border-s border-[var(--line)] px-2.5 py-1 text-[11px] font-extrabold transition-colors first:border-s-0" style={cur === v ? { background: RISK[v].fg, color: "#fff" } : { background: "var(--surface)", color: RISK[v].fg }}>{tr(RISK[v].lbl)}</button>
        ))}
      </div>
    </div>
  );
}

function Ring({ pct }: { pct: number }) {
  const tr = useT();
  const r = 52, circ = 2 * Math.PI * r, off = circ * (1 - pct / 100), col = pct >= 100 ? GREEN : BLUE;
  return (
    <div className="relative h-[112px] w-[112px] flex-none">
      <svg viewBox="0 0 120 120" className="h-[112px] w-[112px] -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--line)" strokeWidth="11" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={col} strokeWidth="11" strokeLinecap="round" strokeDasharray={circ.toFixed(1)} strokeDashoffset={off.toFixed(1)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <b className="text-[26px] font-extrabold leading-none" style={{ color: col }}>{pct}%</b>
        <span className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--ink-3)]">{tr("p8ops.tpReadyWord")}</span>
      </div>
    </div>
  );
}

// ── the 7-step planner ────────────────────────────────────────────────────
const defaultParentMsg = (t: Trip, provider: string) => {
  const pay = t.askPay !== false, consent = t.askConsent !== false;
  // The letter's wording follows the active language; the {Merge} fields stay as literal tokens and are filled by resolveMsg.
  const ask = tNow(pay && consent ? "p8ops.tpLetterAskBoth" : pay ? "p8ops.tpLetterAskPay" : consent ? "p8ops.tpLetterAskConsent" : "p8ops.tpLetterAskNone");
  const action = [consent ? tNow("p8ops.tpLetterBtnConsent") : "", pay ? tNow("p8ops.tpLetterBtnPay") : ""].filter(Boolean).join("\n");
  return tNow("p8ops.tpLetterBody", { costLine: pay ? tNow("p8ops.tpLetterCost") : "", ask, action, provider });
};
const resolveMsg = (msg: string, t: Trip, provider: string) => msg
  .replace(/{Destination}/g, t.destination || tNow("p8ops.tpFbVenue"))
  .replace(/{Address}/g, t.address || "")
  .replace(/{Date}/g, fmtDate(t.date) || tNow("p8ops.tpFbDate"))
  .replace(/{Depart}/g, t.departTime || "—").replace(/{Return}/g, t.returnTime || "—")
  .replace(/{Transport}/g, t.transport ? (TRANSPORT_KEY[t.transport] ? tNow(TRANSPORT_KEY[t.transport]) : t.transport) : "—").replace(/{Cost}/g, t.cost || "0.00")
  .replace(/{PayBy}/g, t.payBy ? fmtDate(t.payBy) : tNow("p8ops.tpFbDateBelow"))
  .replace(/{Lead}/g, t.lead || tNow("p8ops.tpFbLead")).replace(/{LeadPhone}/g, t.leadPhone || "—")
  .replace(/{Provider}/g, provider);
const MERGE_FIELDS = ["{Destination}", "{Date}", "{Depart}", "{Return}", "{Transport}", "{Cost}", "{PayBy}", "{Lead}", "{LeadPhone}", "{Provider}"];

function TripPlanner({ existing, ratioTarget, providerName, onSaved, onClose }: { existing?: Trip; ratioTarget: number; providerName: string; onSaved: () => void; onClose: () => void }) {
  const tr = useT();
  const { locale } = useI18n();
  const arrow = isRTL(locale) ? "←" : "→";
  const isEdit = !!existing;
  const [t, setT] = useState<Trip>(() => existing ? { ...blankTrip(ratioTarget), ...existing, hazards: existing.hazards?.length ? existing.hazards : defaultHazards(), checkpoints: existing.checkpoints?.length ? existing.checkpoints : defaultCheckpoints(), roster: existing.roster ?? [], attendees: existing.attendees ?? [], itinerary: existing.itinerary?.length ? existing.itinerary : [{ t: "", a: "", k: "" }], signoff: existing.signoff ?? {} } : blankTrip(ratioTarget));
  const [open, setOpen] = useState<number>(existing ? Math.min(7, activeStepOf(existing)) : 1);
  const [track, setTrack] = useState(false);
  const [review, setReview] = useState(false);
  const [changes, setChanges] = useState<Change[]>([]);
  const [bkgs, setBkgs] = useState<Booking[]>([]);
  const [listingStaff, setListingStaff] = useState<string[]>([]);
  const [team, setTeam] = useState<string[]>([]);
  const [venues, setVenues] = useState<{ name: string; address?: string; city?: string }[]>([]);
  const [me, setMe] = useState(() => tNow("p8ops.tpYou"));
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
  const addBankHazard = (id: string) => { const e0 = HAZARD_BANK.find((x) => x.id === id); if (!e0) return; const e = localiseEntry(tr, e0); mut((d) => { (d.hazards ??= []).push({ h: e.desc, who: e.who, controls: e.controls.map((c) => `• ${c}`).join("\n"), initial: e.initial, residual: e.residual, done: false, amendedOn: todayIso(), amendedBy: me }); d.raSigned = false; }); };
  // edit a hazard text field and stamp "last amended" with today + assessor
  // set any hazard field: records the change (when Track changes is on) and stamps "last amended"
  const hazSet = (i: number, field: "h" | "who" | "controls" | "initial" | "residual" | "done", value: unknown, label: string) => { edit(`hazards.${i}.${field}`, value, label); mut((d) => { if (d.hazards?.[i]) { d.hazards[i].amendedOn = todayIso(); d.hazards[i].amendedBy = me; if (d.raSigned) d.raSigned = false; } }); };
  // look up a saved venue's address when the destination matches one by name
  const venueFor = (name: string) => venues.find((v) => v.name.trim().toLowerCase() === name.trim().toLowerCase());

  useEffect(() => { apiGet<Booking[]>("/api/bookings").then(setBkgs).catch(() => {}); }, []);
  useEffect(() => { apiGet<{ staff?: { first?: string; last?: string }[]; venues?: { name?: string; address?: string; city?: string }[] } | null>("/api/library").then((l) => { setTeam((l?.staff ?? []).map((s) => `${s.first ?? ""} ${s.last ?? ""}`.trim()).filter(Boolean)); setVenues((l?.venues ?? []).filter((v) => v.name).map((v) => ({ name: v.name!, address: v.address, city: v.city }))); }).catch(() => {}); }, []);
  useEffect(() => { apiGet<{ name?: string; email?: string }>("/api/me").then((m) => setMe(m.name || m.email || tr("p8ops.tpYou"))).catch(() => {}); }, []);
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
    if (!t.destination.trim() || !t.date) { setError(tr("p8ops.tpAddDestDate")); setOpen(1); return; }
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
    } catch (e) { setError(e instanceof Error ? e.message : tr("p8ops.tpCouldntSave")); setBusy(false); }
  }

  // Soft-cancel (keeps the record marked Cancelled) or reinstate a saved trip.
  async function cancelTrip() {
    if (!isEdit) return;
    const cancelling = t.status !== "cancelled";
    if (cancelling && !confirm(tr("p8ops.tpConfirmCancel", { dest: t.destination || tr("p8ops.tpThisVenue") }))) return;
    setBusy(true); setError(null);
    try { await apiPut(`/api/trips/${encodeURIComponent(existing!.id)}`, { status: cancelling ? "cancelled" : "planned", returned: false }); onClose(); onSaved(); }
    catch (e) { setError(e instanceof Error ? e.message : tr("p8ops.tpCouldntUpdate")); setBusy(false); }
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
        <div className="text-[15px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{isEdit ? tr("p8ops.tpPlannerTitle") : tr("p8ops.tpPlan").replace(/^＋\s*/, "")}</div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setTrack((v) => !v)} className="flex items-center gap-2 text-[12px] font-semibold text-[var(--ink-2)]">
            <span className="relative h-[22px] w-[40px] rounded-full transition-colors" style={{ background: track ? GREEN : "var(--line)" }}><span className="absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow transition-all" style={{ left: track ? "20px" : "2px" }} /></span>
            {tr("p8ops.tpTrackChanges")} <b style={{ color: "var(--ink)" }}>{track ? tr("p8ops.tpOn") : tr("p8ops.tpOff")}</b>
          </button>
          <button type="button" onClick={() => setReview((v) => !v)} className="rounded-lg border px-3 py-1.5 text-[12px] font-bold transition-colors" style={review ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{tr("p8ops.tpReviewChanges", { n: changes.length })}</button>
        </div>
      </div>

      {review && (
        <div className="mb-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
          <div className="mb-1.5 flex items-center justify-between text-[12.5px] font-extrabold">{tr("p8ops.tpTrackedChanges", { n: changes.length })}{changes.length > 0 && <span className="flex gap-1.5"><button type="button" onClick={() => setChanges([])} className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-0.5 text-[11px] font-bold">{tr("p8ops.tpAcceptAll")}</button><button type="button" onClick={() => { changes.forEach((c) => mut((d) => setPath(d, c.key, c.old))); setChanges([]); }} className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-0.5 text-[11px] font-bold">{tr("p8ops.tpRejectAll")}</button></span>}</div>
          {changes.length === 0 ? <div className="text-[11.5px] text-[var(--ink-3)]">{tr("p8ops.tpNoChanges")}</div>
            : <div className="flex flex-col gap-1.5">{changes.map((c, i) => (
              <div key={i} className="flex items-center justify-between gap-2 rounded-lg bg-[var(--surface)] px-2.5 py-1.5">
                <div className="min-w-0 text-[11.5px]"><b>{c.label}</b><div className="text-[var(--ink-2)]"><del className="text-[var(--ink-3)]">{c.old || "—"}</del> {arrow} <ins className="rounded bg-[#e7f6ee] px-1 no-underline" style={{ color: GREEN }}>{c.next || "—"}</ins> <span className="text-[var(--ink-3)]">· {c.who} · {c.ts}</span></div></div>
                <span className="flex flex-none gap-1"><button type="button" onClick={() => setChanges((cs) => cs.filter((x) => x !== c))} className="rounded-md border border-[var(--line)] px-2 py-0.5 text-[11px] font-bold">{tr("p8ops.tpAccept")}</button><button type="button" onClick={() => { mut((d) => setPath(d, c.key, c.old)); setChanges((cs) => cs.filter((x) => x !== c)); }} className="rounded-md border border-[var(--line)] px-2 py-0.5 text-[11px] font-bold">{tr("p8ops.tpReject")}</button></span>
              </div>
            ))}</div>}
        </div>
      )}

      {/* hero */}
      <div className="mb-4 flex flex-wrap items-center gap-4 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4">
        <Ring pct={pct} />
        <div className="min-w-[220px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[18px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{t.destination || tr("p8ops.tpNewTrip")}</span>
            <span className="rounded-full px-2.5 py-0.5 text-[11px] font-extrabold" style={{ background: `color-mix(in srgb,${sp[1]} 14%,transparent)`, color: `color-mix(in srgb,${sp[1]} 74%,#000)` }}>{tr(sp[0])}</span>
          </div>
          <div className="mb-2.5 mt-1 text-[12.5px] text-[var(--ink-2)]">{t.date ? fmtDate(t.date) : tr("p8ops.tpNoDate")}{t.departTime ? ` · ${tr("p8ops.tpDepartT", { time: t.departTime })}` : ""}{t.returnTime ? `, ${tr("p8ops.tpBackT", { time: t.returnTime })}` : ""}</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {chip(tr("p8ops.tpChipChildren"), attendingOf(t).length)}
            {chip(tr("p8ops.rtStaffWord"), (t.roster ?? []).length, staffOk(t) ? "ok" : "bad")}
            {chip(tr("p8ops.tpChipRatio"), `1:${ratioOf(t)}`)}
            {chip(tr("p8ops.tpChipConsents"), `${attendingOf(t).length}/${(t.attendees ?? []).length - declinedOf(t).length}`, permsOk(t) ? "ok" : "warn")}
            {chip(tr("p8ops.tpChipRA"), raDone(t) ? tr("p8ops.tpSigned") : tr("p8ops.tpDraft"), raDone(t) ? "ok" : "warn")}
            {chip(tr("p8ops.tpChipSignoff"), s5Ok(t) ? tr("p8ops.tpApproved") : tr("p8ops.tpPending"), s5Ok(t) ? "ok" : "warn")}
          </div>
        </div>
      </div>

      {/* step rail — jump to any step (wraps so every tab is visible) */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {STEP_NUMS.map((n) => {
          const dn = stepDone(t, n), cur = open === n;
          return (
            <button key={n} type="button" onClick={() => setOpen(n)} title={tr("p8ops.tpStepTip", { n, title: tr(TITLE_KEYS[n]) })} className="flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-start transition-colors" style={cur ? { borderColor: BLUE, background: "#eef4fd" } : { borderColor: "var(--line)", background: "var(--surface)" }}>
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[11px] font-extrabold" style={dn ? { background: GREEN, color: "#fff" } : cur ? { background: BLUE, color: "#fff" } : { background: "var(--panel)", color: "var(--ink-3)" }}>{dn ? "✓" : n}</span>
              <span className="hidden text-[11.5px] font-bold sm:block" style={{ color: cur ? BLUE : "var(--ink-2)" }}>{tr(TITLE_KEYS[n])}</span>
            </button>
          );
        })}
      </div>

      {/* current step — one at a time (slideshow) */}
      <div className="overflow-hidden rounded-2xl border" style={{ borderColor: `color-mix(in srgb,${SIG} 40%,var(--line))` }}>
        {STEP_NUMS.map((n) => {
          if (n !== open) return null;
          const dn = stepDone(t, n), locked = n === 6 && !s5Ok(t);
          const pillTone = dn ? { t: tr("p8ops.tpPillComplete"), c: GREEN } : locked ? { t: tr("p8ops.tpPillLocked"), c: "#8a86a3" } : n === act ? { t: tr("p8ops.tpPillAction"), c: SIG } : { t: tr("p8ops.tpPillTodo"), c: "#8a86a3" };
          return (
            <div key={n}>
              <div className="flex items-center gap-3 border-b border-[var(--line)] bg-[var(--surface)] px-4 py-3">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[15px] font-extrabold" style={dn ? { background: GREEN, color: "#fff" } : { background: "#eef4fd", color: BLUE }}>{dn ? "✓" : n}</span>
                <span className="flex-1 min-w-0"><span className="text-[10px] font-bold uppercase tracking-[0.05em] text-[var(--ink-3)]">{tr("p8ops.tpStepOf", { n })}</span><div className="text-[16px] font-extrabold leading-tight" style={{ fontFamily: "var(--ff-display)" }}>{tr(TITLE_KEYS[n])}</div></span>
                <span className="rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold" style={{ background: `color-mix(in srgb,${pillTone.c} 14%,transparent)`, color: `color-mix(in srgb,${pillTone.c} 74%,#000)` }}>{pillTone.t}</span>
              </div>
              <div className="bg-[var(--panel)] p-4">
                {/* ── Step 1 ── */}
                {n === 1 && <div className="flex flex-col gap-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="relative flex flex-col gap-1">{fl(tr("p8ops.tpWhere"))}
                      <input value={t.destination ?? ""} onChange={(e) => { const v = e.target.value; edit("destination", v, tr("p8ops.tpLblDestination")); setVenueMenu(true); const m = venueFor(v); if (m?.address) edit("address", m.address, tr("p8ops.tpAddress")); }} onFocus={() => setVenueMenu(true)} onBlur={() => setTimeout(() => setVenueMenu(false), 150)} placeholder={tr("p8ops.tpVenuePh")} className={inputCls} autoComplete="off" />
                      {venueMenu && (() => {
                        const q = (t.destination ?? "").trim().toLowerCase();
                        const matches = venues.filter((v) => !q || v.name.toLowerCase().includes(q) || (v.address ?? "").toLowerCase().includes(q)).slice(0, 8);
                        if (matches.length === 0) return null;
                        return (
                          <div className="absolute start-0 end-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-[0_12px_28px_-12px_rgba(23,21,52,.4)]">
                            {matches.map((v) => (
                              <button key={v.name} type="button" onMouseDown={(e) => { e.preventDefault(); edit("destination", v.name, tr("p8ops.tpLblDestination")); edit("address", v.address ?? "", tr("p8ops.tpAddress")); setVenueMenu(false); }} className="flex w-full flex-col items-start gap-0.5 border-b border-[var(--line)] px-3 py-2 text-start last:border-b-0 hover:bg-[#eef4fd]">
                                <span className="text-[12.5px] font-bold">📍 {v.name}</span>
                                {v.address && <span className="text-[11px] text-[var(--ink-3)]">{v.address}</span>}
                              </button>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                    <label className="flex flex-col gap-1">{fl(tr("p8ops.tpAddress"))}<input value={t.address ?? ""} onChange={(e) => edit("address", e.target.value, tr("p8ops.tpAddress"))} placeholder={tr("p8ops.tpAddressPh")} className={inputCls} /></label>
                    {listings.length > 0 && <label className="flex flex-col gap-1 sm:col-span-2">{fl(tr("p8ops.tpForWhichCamp"))}<select value={t.listingId ?? ""} onChange={(e) => edit("listingId", e.target.value || "", tr("p8ops.rgHdrListing"))} className={inputCls}><option value="">{tr("p8ops.tpAllMyBookings")}</option>{listings.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>}
                    <label className="flex flex-col gap-1">{fl(tr("p8ops.rgHdrDate"))}{fieldInput("date", tr("p8ops.rgHdrDate"), { type: "date" })}</label>
                    <label className="flex flex-col gap-1">{fl(tr("p8ops.tpCostPerChild"))}{fieldInput("cost", tr("p8ops.tpLblCost"))}</label>
                    <label className="flex flex-col gap-1">{fl(tr("p8ops.tpDepart"))}{fieldInput("departTime", tr("p8ops.tpDepart"), { type: "time" })}</label>
                    <label className="flex flex-col gap-1">{fl(tr("p8ops.tpReturn"))}{fieldInput("returnTime", tr("p8ops.tpReturn"), { type: "time" })}</label>
                  </div>
                  <div>{fl(tr("p8ops.tpTransport"))}<div className="mt-1 flex flex-wrap gap-1.5">{TRANSPORT.map((x) => <button key={x} type="button" onClick={() => edit("transport", x, tr("p8ops.tpTransport"))} className="rounded-full border-2 px-3 py-1 text-[12px] font-bold transition-colors" style={t.transport === x ? { borderColor: BLUE, background: "#eaf0fc", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{tr(TRANSPORT_KEY[x])}</button>)}</div><input value={TRANSPORT.includes(t.transport ?? "") ? "" : t.transport ?? ""} onChange={(e) => edit("transport", e.target.value, tr("p8ops.tpTransport"))} placeholder={tr("p8ops.tpOrTypeOwn")} className={`${inputCls} mt-1.5`} /></div>
                  <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                    <div className="mb-1.5 flex items-center gap-2 text-[12.5px] font-extrabold">{tr("p8ops.tpLeadContact")}</div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <label className="flex flex-col gap-1">{fl(tr("p8ops.tpTripLead"))}<input list="trip-leads" value={t.lead ?? ""} onChange={(e) => edit("lead", e.target.value, tr("p8ops.tpTripLead"))} placeholder={tr("p8ops.tpTypeOrPickName")} className={inputCls} /><datalist id="trip-leads">{[...new Set([...(t.roster ?? []).map((s) => s.n), ...listingStaff, ...team])].filter(Boolean).map((nm) => <option key={nm} value={nm} />)}</datalist></label>
                      <label className="flex flex-col gap-1">{fl(tr("p8ops.tpLeadPhone"))}{fieldInput("leadPhone", tr("p8ops.tpLeadPhone"), { placeholder: "07700 900000" })}</label>
                      <label className="flex flex-col gap-1">{fl(tr("p8ops.tpEvc"))}{fieldInput("evc", "EVC")}</label>
                    </div>
                  </div>
                  <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                    <div className="mb-1.5 flex items-center justify-between"><span className="text-[12.5px] font-extrabold">{tr("p8ops.tpItinerary")}</span><button type="button" onClick={() => mut((d) => { (d.itinerary ??= []).push({ t: "", a: "", k: "" }); })} className="rounded-md border border-[var(--line)] px-2 py-0.5 text-[11px] font-bold">{tr("p8ops.tpAddItin")}</button></div>
                    <datalist id="itin-activities">{ITIN_ACTIVITIES.map((a) => <option key={a} value={tz(a)} />)}</datalist>
                    <datalist id="itin-actions">{ITIN_ACTIONS.map((a) => <option key={a} value={tz(a)} />)}</datalist>
                    <div className="flex flex-col gap-1.5">{(t.itinerary ?? []).map((r, i) => (
                      <div key={i} className="grid grid-cols-[64px_1fr_1fr_auto] items-center gap-1.5 max-sm:grid-cols-[64px_minmax(0,1fr)_minmax(0,1fr)_auto]">
                        <input value={r.t ?? ""} onChange={(e) => edit(`itinerary.${i}.t`, e.target.value, tr("p8ops.tpLblItinTime"))} placeholder="09:00" className={inputCls} />
                        <input list="itin-activities" value={r.a ?? ""} onChange={(e) => edit(`itinerary.${i}.a`, e.target.value, tr("p8ops.tpLblActivity"))} placeholder={tr("p8ops.tpPickActivity")} className={inputCls} />
                        <input list="itin-actions" value={r.k ?? ""} onChange={(e) => edit(`itinerary.${i}.k`, e.target.value, tr("p8ops.tpLblKeyAction"))} placeholder={tr("p8ops.tpPickAction")} className={inputCls} />
                        <button type="button" onClick={() => mut((d) => { d.itinerary = (d.itinerary ?? []).filter((_, j) => j !== i); })} className="px-1 text-[var(--ink-3)] hover:text-[#c02636]">✕</button>
                      </div>
                    ))}</div>
                    <div className="mt-1 text-[10.5px] text-[var(--ink-3)]">{tr("p8ops.tpItinHint")}</div>
                  </div>
                  <label className="flex flex-col gap-1">{fl(tr("p8ops.tpKit"))}<textarea value={t.kit ?? ""} onChange={(e) => edit("kit", e.target.value, tr("p8ops.tpLblKit"))} placeholder={tr("p8ops.tpKitPh")} className={`${taCls} min-h-[52px]`} /><span className="text-[11px] text-[var(--ink-2)]">{richT(tr, "p8ops.tpEmergencyLine", { label: <b>{tr("p8ops.tpEmergencyDay")}</b> }, { phone: t.leadPhone || "—" })}</span></label>
                </div>}

                {/* ── Step 2: Risk assessment ── */}
                {n === 2 && <div className="flex flex-col gap-2.5">
                  <div className="grid gap-2 sm:grid-cols-4">
                    <label className="flex flex-col gap-1">{fl(tr("p8ops.tpRef"))}{fieldInput("raRef", tr("p8ops.tpLblRaRef"), { placeholder: "RA-2025-074" })}</label>
                    <label className="flex flex-col gap-1">{fl(tr("p8ops.tpAssessor"))}{fieldInput("raAssessor", tr("p8ops.tpAssessor"))}</label>
                    <label className="flex flex-col gap-1">{fl(tr("p8ops.rgHdrDate"))}{fieldInput("raDate", tr("p8ops.tpLblRaDate"), { type: "date" })}</label>
                    <label className="flex flex-col gap-1">{fl(tr("p8ops.tpReviewLbl"))}{fieldInput("raReview", tr("p8ops.tpReviewLbl"))}</label>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-[11.5px] text-[var(--ink-3)]">{tr("p8ops.tpRaHelp")}</span><span className="flex flex-wrap gap-1.5"><button type="button" onClick={() => setBankOpen((v) => !v)} className="rounded-md border px-2 py-0.5 text-[11px] font-bold transition-colors" style={bankOpen ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{bankOpen ? tr("p8ops.tpBankClose") : tr("p8ops.tpBankOpen")}</button><button type="button" onClick={() => mut((d) => { (d.hazards ??= []).push({ h: "", who: "", controls: "", initial: "M", residual: "", done: false }); if (d.raSigned) d.raSigned = false; })} className="rounded-md border border-[var(--line)] px-2 py-0.5 text-[11px] font-bold">{tr("p8ops.tpBlankHazard")}</button></span></div>
                  {(t.hazards ?? []).length > 0 && (() => { const allDone = (t.hazards ?? []).every((h) => h.done); const n = (t.hazards ?? []).filter((h) => h.done).length; return (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--surface)] px-3 py-2">
                      <span className="text-[12px] font-semibold" style={{ color: allDone ? GREEN : "var(--ink-2)" }}>{allDone ? "✓ " : ""}{tr("p8ops.tpHazCtlCount", { n, total: (t.hazards ?? []).length })}</span>
                      <button type="button" onClick={() => mut((d) => { const target = !allDone; (d.hazards ?? []).forEach((h) => { h.done = target; h.amendedOn = todayIso(); h.amendedBy = me; }); d.raSigned = false; })} className="rounded-md border px-2.5 py-1 text-[11.5px] font-bold transition-colors" style={allDone ? { borderColor: "var(--line)", color: "var(--ink-2)" } : { borderColor: GREEN, color: GREEN }}>{allDone ? tr("p8ops.tpUntickAll") : tr("p8ops.tpTickAll")}</button>
                    </div>
                  ); })()}
                  {bankOpen && (() => {
                    const have = new Set((t.hazards ?? []).map((h) => h.h.trim().toLowerCase()));
                    const isAdded = (e: (typeof HAZARD_BANK)[number]) => have.has(e.desc.trim().toLowerCase());
                    const bq = bankQ.trim().toLowerCase();
                    const groups = bankByCategory().map((g) => ({ ...g, entries: g.entries.map((en) => localiseEntry(tr, en)).filter((e) => !bq || `${e.area} ${e.desc} ${e.who} ${e.controls.join(" ")}`.toLowerCase().includes(bq)) })).filter((g) => g.entries.length > 0);
                    return (
                      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2.5">
                        <div className="mb-2 flex items-center gap-2">
                          <input value={bankQ} onChange={(e) => setBankQ(e.target.value)} placeholder={tr("p8ops.tpBankSearch", { n: HAZARD_BANK.length })} className={`${inputCls} flex-1`} />
                          <button type="button" onClick={() => { const ids = groups.flatMap((g) => g.entries).filter((e) => !isAdded(e)).map((e) => e.id); ids.forEach(addBankHazard); }} className="whitespace-nowrap rounded-md border border-[var(--line)] px-2 py-1.5 text-[11px] font-bold" style={{ color: BLUE }}>{tr("p8ops.tpAddAllShown")}</button>
                        </div>
                        <div className="flex max-h-[320px] flex-col gap-2.5 overflow-y-auto [scrollbar-width:thin]">
                          {groups.map((g) => (
                            <div key={g.cat}>
                              <div className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.05em] text-[var(--ink-3)]">{categoryLabel(tr, g.cat)}</div>
                              <div className="flex flex-col gap-1.5">
                                {g.entries.map((e) => {
                                  const added = isAdded(e);
                                  return (
                                    <div key={e.id} className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-2.5">
                                      <div className="flex items-start gap-2">
                                        <div className="min-w-0 flex-1">
                                          <div className="flex flex-wrap items-center gap-1.5"><span className="text-[12.5px] font-extrabold">{e.area}</span><Badge tone={{ bg: RISK[e.initial].bg, fg: RISK[e.initial].fg }}>{tr(RISK[e.initial].lbl)}{arrow}{tr(RISK[e.residual].lbl)}</Badge><span className="text-[10.5px] text-[var(--ink-3)]">{tr("p8ops.tpControlsCount", { n: e.controls.length })}</span></div>
                                          <div className="mt-1 text-[11.5px] leading-[1.5] text-[var(--ink-2)]">{e.desc}</div>
                                          <div className="mt-1 text-[11px] leading-[1.5] text-[var(--ink-3)]"><b className="text-[var(--ink-2)]">{tr("p8ops.tpRiskColon")}</b> {e.who}</div>
                                        </div>
                                        <button type="button" disabled={added} onClick={() => addBankHazard(e.id)} className="flex-none rounded-md border px-2.5 py-1 text-[11px] font-bold" style={added ? { borderColor: "var(--line)", color: "var(--ink-3)" } : { borderColor: BLUE, color: BLUE }}>{added ? tr("p8ops.tpAdded") : tr("p8ops.rtAdd")}</button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                          {groups.length === 0 && <div className="px-1 py-3 text-center text-[12px] text-[var(--ink-3)]">{tr("p8ops.tpNoHazMatch", { q: bankQ })}</div>}
                        </div>
                        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-[var(--line)] pt-2.5">
                          <span className="text-[11.5px] font-semibold" style={{ color: GREEN }}>{tr("p8ops.tpHazOnAssess", { n: (t.hazards ?? []).length })}</span>
                          <Button sm variant="solid" onClick={() => setBankOpen(false)}>{tr("p8ops.tpDoneView")}</Button>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="flex flex-col gap-3">{(t.hazards ?? []).map((h, i) => {
                    return (
                    <div key={i} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3.5">
                      <div className="mb-2.5 flex items-center justify-between">
                        <span className="rounded-full bg-[#eef4fd] px-2.5 py-0.5 text-[11px] font-extrabold" style={{ color: BLUE }}>{tr("p8ops.tpHazardN", { n: i + 1 })}</span>
                        <button type="button" onClick={() => mut((d) => { d.hazards = (d.hazards ?? []).filter((_, j) => j !== i); d.raSigned = false; })} className="text-[11px] font-semibold text-[var(--ink-3)] hover:text-[#c02636]">{tr("p8ops.tpRemoveBtn")}</button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="flex flex-col gap-1.5">{fl(tr("p8ops.tpHazWhat"))}<textarea value={h.h} onChange={(e) => hazSet(i, "h", e.target.value, tr("p8ops.tpLblHazard"))} placeholder={tr("p8ops.tpHazPh")} className={`${taCls} min-h-[46px] font-bold`} /></label>
                        <label className="flex flex-col gap-1.5">{fl(tr("p8ops.tpRiskWho"))}<textarea value={h.who ?? ""} onChange={(e) => hazSet(i, "who", e.target.value, tr("p8ops.tpLblWhoAtRisk"))} placeholder={tr("p8ops.tpRiskPh")} className={`${taCls} min-h-[46px]`} /></label>
                      </div>
                      <label className="mt-3 flex flex-col gap-1.5">{fl(tr("p8ops.tpControlMeasures"))}<textarea value={h.controls ?? ""} onChange={(e) => hazSet(i, "controls", e.target.value, tr("p8ops.tpLblControls"))} placeholder={tr("p8ops.tpControlsPh")} className={`${taCls} min-h-[64px]`} /></label>
                      <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-[var(--line)] pt-3">
                        <div className="flex flex-col gap-1.5">{fl(tr("p8ops.tpRiskRating"))}
                          <div className="flex flex-wrap items-center gap-2">
                            <RatingGroup label={tr("p8ops.tpInitial")} cur={h.initial} on={(x) => hazSet(i, "initial", x, tr("p8ops.tpLblInitialRisk"))} />
                            <span className="text-[13px] font-bold text-[var(--ink-3)]">{arrow}</span>
                            <RatingGroup label={tr("p8ops.tpResidual")} cur={h.residual} on={(x) => hazSet(i, "residual", x, tr("p8ops.tpLblResidualRisk"))} />
                          </div>
                        </div>
                        <label className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-bold transition-colors" style={h.done ? { background: "#e7f6ee", color: GREEN } : { background: "var(--panel)", color: "var(--ink-2)" }}><input type="checkbox" checked={!!h.done} onChange={(e) => hazSet(i, "done", e.target.checked, tr("p8ops.tpControlsInPlace"))} />{tr("p8ops.tpControlsInPlace")}</label>
                      </div>
                      <div className="mt-2 text-[10.5px] text-[var(--ink-3)]">{tr("p8ops.tpLastAmended", { by: `${h.amendedBy ? `${h.amendedBy} · ` : ""}${h.amendedOn ? fmtDate(h.amendedOn) : "—"}` })}</div>
                    </div>
                    );
                  })}</div>
                  {t.raSigned ? <div className="flex items-center gap-2 rounded-lg bg-[#e7f6ee] px-3 py-2 text-[12px] font-semibold" style={{ color: GREEN }}>{tr("p8ops.tpRaSignedBy", { name: t.raAssessor || me, date: fmtDate(t.raDate) })}<button type="button" onClick={() => mut((d) => { d.raSigned = false; })} className="ms-auto text-[11.5px] font-bold underline" style={{ color: GREEN }}>{tr("p8ops.tpReopen")}</button></div>
                    : <div><Button variant="solid" disabled={!raReady(t.hazards ?? [])} onClick={() => mut((d) => { d.raSigned = true; d.raAssessor = d.raAssessor || me; d.raDate = d.raDate || todayIso(); })}>{tr("p8ops.tpSignOffRa")}</Button>{!raReady(t.hazards ?? []) && <div className="mt-1.5 rounded-lg bg-[#fdf3d8] px-3 py-2 text-[11.5px] font-semibold" style={{ color: AMBER }}>{tr("p8ops.tpRaNeedsAll")}</div>}</div>}
                </div>}

                {/* ── Step 3: Staffing & ratio ── */}
                {n === 3 && <div className="flex flex-col gap-2.5">
                  <div className="flex flex-wrap items-center gap-2 text-[12px]">
                    <span className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5">{richT(tr, "p8ops.tpChildrenGoing", { n: <b>{attendingOf(t).length}</b> })}</span>
                    <span className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5">{richT(tr, "p8ops.tpStaffCount", { n: <b>{(t.roster ?? []).length}</b> })}</span>
                    <span className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5">{richT(tr, "p8ops.tpActualRatio", { r: <b>1:{(t.roster ?? []).length ? Math.ceil(attendingOf(t).length / Math.max(1, (t.roster ?? []).length)) : "—"}</b> })}</span>
                    <span className="ms-auto flex items-center gap-1.5 text-[var(--ink-2)]">{tr("p8ops.tpOffsitePolicy")}<input type="number" min={1} value={ratioOf(t)} onChange={(e) => edit("offsiteRatio", Math.max(1, parseInt(e.target.value, 10) || 1), tr("p8ops.tpLblOffsiteRatio"))} className="w-14 rounded-md border border-[var(--line)] px-1.5 py-1 text-center text-[13px] font-extrabold" /> {richT(tr, "p8ops.tpNeedN", { n: <b>{needOf(t)}</b> })}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--line)]"><div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, Math.round((t.roster ?? []).length / needOf(t) * 100))}%`, background: staffOk(t) ? GREEN : RED }} /></div>
                  {staffSuggest.length > 0 && <div><div className="mb-1 text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">{listingStaff.length ? tr("p8ops.tpAssignedListing") : tr("p8ops.tpYourTeamTap")}</div><div className="flex flex-wrap gap-1.5">{staffSuggest.map((s) => <button key={s} type="button" onClick={() => mut((d) => { (d.roster ??= []).push({ n: s, r: "Activity leader", fa: false }); })} className="rounded-full border-2 border-dashed px-2.5 py-1 text-[12px] font-bold" style={{ borderColor: "var(--line)", color: "var(--ink-2)" }}>＋ {s}</button>)}</div></div>}
                  <div className="flex flex-col gap-1.5">{(t.roster ?? []).map((s, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2">
                      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[#eaf0fc] text-[11px] font-extrabold" style={{ color: BLUE }}>{ini(s.n)}</span>
                      <input value={s.n} onChange={(e) => edit(`roster.${i}.n`, e.target.value, tr("p8ops.tpLblStaffName"))} placeholder={tr("p8ops.tpStaffNamePh")} className="min-w-[120px] flex-1 rounded-md border border-[var(--line)] px-2 py-1 text-[12.5px] font-bold outline-none focus:border-[#1d3a8f]" />
                      <input value={s.r ?? ""} onChange={(e) => edit(`roster.${i}.r`, e.target.value, tr("p8ops.tpLblRole"))} placeholder={tr("p8ops.tpRolePh")} className="min-w-[110px] flex-1 rounded-md border border-[var(--line)] px-2 py-1 text-[12px] outline-none focus:border-[#1d3a8f]" />
                      <button type="button" onClick={() => mut((d) => { d.roster![i].fa = !d.roster![i].fa; })} className="rounded-full px-2.5 py-1 text-[11px] font-extrabold" style={s.fa ? { background: "#e7f6ee", color: GREEN } : { background: "var(--panel)", color: "var(--ink-3)" }}>{s.fa ? tr("p8ops.tpFirstAider") : tr("p8ops.tpPlusFirstAid")}</button>
                      <button type="button" onClick={() => mut((d) => { d.roster = (d.roster ?? []).filter((_, j) => j !== i); })} className="px-1 text-[var(--ink-3)] hover:text-[#c02636]">✕</button>
                    </div>
                  ))}</div>
                  <button type="button" onClick={() => mut((d) => { (d.roster ??= []).push({ n: "", r: "Activity leader", fa: false }); })} className="self-start rounded-lg border-2 border-dashed border-[var(--line)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)]">{tr("p8ops.tpAddStaffMember")}</button>
                  <div className="rounded-lg px-3 py-2 text-[12px] font-semibold" style={staffOk(t) ? { background: "#e7f6ee", color: GREEN } : { background: "#fdebec", color: RED }}>{staffOk(t) ? tr("p8ops.tpRatioMet", { r: ratioOf(t) }) : `⚠️ ${((t.roster ?? []).length < needOf(t)) ? tr("p8ops.tpNeedMoreStaff", { n: needOf(t) - (t.roster ?? []).length, r: ratioOf(t) }) : ""}${hasLead(t) ? "" : tr("p8ops.tpNoLead")}${hasFA(t) ? "" : tr("p8ops.tpNoFirstAider")}`}</div>
                </div>}

                {/* ── Step 4: Parent permissions ── */}
                {n === 4 && <div className="flex flex-col gap-2.5">
                  <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                    <div className="mb-2 text-[12.5px] font-extrabold">{tr("p8ops.tpAddBooked")}</div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="flex flex-col gap-1">{fl(tr("p8ops.tpFromCamp"))}<select value={t.listingId ?? ""} onChange={(e) => { edit("listingId", e.target.value || "", tr("p8ops.rgHdrListing")); setPassFilter(""); }} className={inputCls}><option value="">{tr("p8ops.tpAllMyBookings")}</option>{listings.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
                      <label className="flex flex-col gap-1">{fl(tr("p8ops.tpWhichPass"))}<select value={passFilter} onChange={(e) => setPassFilter(e.target.value)} className={inputCls}><option value="">{tr("p8ops.tpAllPasses")}</option>{passOptions.map((p) => <option key={p} value={p}>{p}</option>)}</select>{passOptions.length === 0 && <span className="text-[10.5px] text-[var(--ink-3)]">{tr("p8ops.tpNoPasses")}</span>}</label>
                    </div>
                    <div className="mt-2 mb-1 flex items-center justify-between"><span className="text-[11px] font-semibold text-[var(--ink-3)]">{tr("p8ops.tpNotYetAdded", { n: notBooked.length, date: fmtDate(t.date), pass: passFilter ? ` · ${passFilter}` : "" })}</span>{notBooked.length > 0 && <button type="button" onClick={() => mut((d) => { const have = new Set((d.attendees ?? []).map((a) => a.n)); notBooked.forEach((b) => { if (!have.has(b.n)) (d.attendees ??= []).push({ n: b.n, age: b.age, consent: "pending", paid: false, em: false }); }); })} className="rounded-md border border-[#1d3a8f] px-2.5 py-1 text-[11px] font-bold" style={{ color: BLUE }}>{tr("p8ops.tpAddAllN", { n: notBooked.length })}</button>}</div>
                    {notBooked.length > 0 ? <div className="flex max-h-44 flex-col gap-1 overflow-y-auto [scrollbar-width:thin]">{notBooked.map((b) => (
                      <div key={b.n} className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1.5">
                        <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[#eaf0fc] text-[10.5px] font-extrabold" style={{ color: BLUE }}>{ini(b.n)}</span>
                        <span className="flex-1 text-[12.5px] font-semibold">{b.n}{b.age ? <span className="font-normal text-[var(--ink-3)]"> · {tr("p8ops.tpAgeN", { n: b.age })}</span> : ""}</span>
                        <button type="button" onClick={() => mut((d) => { if (!(d.attendees ?? []).some((a) => a.n === b.n)) (d.attendees ??= []).push({ n: b.n, age: b.age, consent: "pending", paid: false, em: false }); })} className="rounded-md border border-[var(--line)] px-2.5 py-0.5 text-[11px] font-bold" style={{ color: BLUE }}>{tr("p8ops.rtAdd")}</button>
                      </div>
                    ))}</div> : <div className="rounded-lg bg-[var(--panel)] px-3 py-2 text-[12px] text-[var(--ink-3)]">{booked.length === 0 ? tr("p8ops.tpNoBookedOnDate") : tr("p8ops.tpEveryoneAdded")}</div>}
                  </div>
                  {(t.attendees ?? []).length > 0 ? <>
                    <div className="text-[12px] text-[var(--ink-2)]">{richT(tr, "p8ops.tpConsentSummary", { a: <b>{attendingOf(t).length}</b>, b: <b style={{ color: AMBER }}>{pendingOf(t).length}</b>, c: <b style={{ color: "var(--ink-3)" }}>{declinedOf(t).length}</b>, d: <b>{paidCountOf(t)}/{(t.attendees ?? []).length - declinedOf(t).length}</b> })}</div>
                    <div className="flex h-2 overflow-hidden rounded-full bg-[var(--line)]">
                      <div style={{ width: `${attendingOf(t).length / (t.attendees ?? []).length * 100}%`, background: GREEN }} /><div style={{ width: `${pendingOf(t).length / (t.attendees ?? []).length * 100}%`, background: "#f0b100" }} /><div style={{ width: `${declinedOf(t).length / (t.attendees ?? []).length * 100}%`, background: "#8a86a3" }} />
                    </div>
                    {pendingOf(t).length > 0 && <div className="flex items-center gap-2"><button type="button" onClick={() => setRemindStamp(nowLabel())} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-bold" style={{ color: BLUE }}>{tr("p8ops.tpSendRequestN", { n: pendingOf(t).length })}</button>{remindStamp && <span className="text-[11.5px] font-semibold" style={{ color: GREEN }}>{tr("p8ops.tpRequestedAt", { time: remindStamp })}</span>}</div>}
                    <div className="flex flex-col gap-1.5">{(t.attendees ?? []).map((c, i) => {
                      const cs = c.consent ?? "pending"; const tone = cs === "granted" ? { l: tr("p8ops.tpConsented"), bg: "#e7f6ee", fg: GREEN } : cs === "pending" ? { l: tr("p8ops.tpPending"), bg: "#fdf3d8", fg: AMBER } : { l: tr("p8ops.tpNotComing"), bg: "#f0eef4", fg: "#8a86a3" };
                      return (
                        <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2">
                          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[#eaf0fc] text-[11px] font-extrabold" style={{ color: BLUE }}>{ini(c.n)}</span>
                          <div className="min-w-[130px] flex-1"><div className="text-[12.5px] font-extrabold">{c.n}</div><div className="text-[11px] text-[var(--ink-3)]">{c.age ? `${tr("p8ops.tpAgeN", { n: c.age }).replace(/^./, (ch) => ch.toUpperCase())} · ` : ""}{c.em ? tr("p8ops.tpEmContactOk") : tr("p8ops.tpNoContact")}{c.med ? ` · ⚠ ${c.med}` : ""}</div></div>
                          <span className="rounded-full px-2 py-0.5 text-[10.5px] font-extrabold" style={c.paid ? { background: "#e7f6ee", color: GREEN } : { background: "var(--panel)", color: "var(--ink-3)" }}>{c.paid ? tr("p8ops.tpPaidAmt", { cost: t.cost ?? "" }) : tr("p8ops.tpUnpaid")}</span>
                          <span className="rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold" style={{ background: tone.bg, color: tone.fg }}>{tone.l}</span>
                          {cs === "pending" && (c.paid ? <button type="button" onClick={() => mut((d) => { d.attendees![i].consent = "granted"; })} className="rounded-md border border-[var(--line)] px-2 py-0.5 text-[11px] font-bold" style={{ color: BLUE }}>{tr("p8ops.tpRecordConsent")}</button> : <button type="button" onClick={() => mut((d) => { d.attendees![i].paid = true; })} className="rounded-md border border-[var(--line)] px-2 py-0.5 text-[11px] font-bold" style={{ color: BLUE }}>{tr("p8ops.tpTakePayment")}</button>)}
                          {cs !== "declined" ? <button type="button" onClick={() => mut((d) => { d.attendees![i].consent = "declined"; })} className="px-1 text-[11px] text-[var(--ink-3)] hover:text-[#c02636]" title={tr("p8ops.tpMarkNotComing")}>✕</button> : <button type="button" onClick={() => mut((d) => { d.attendees![i].consent = "pending"; })} className="rounded-md border border-[var(--line)] px-2 py-0.5 text-[11px] font-bold">{tr("p8ops.tpReadd")}</button>}
                        </div>
                      );
                    })}</div>
                    <div className="rounded-lg bg-[#f4f8ff] px-3 py-2 text-[11px] text-[var(--ink-2)]">{tr("p8ops.tpPaymentNote")}</div>
                  </> : <div className="rounded-lg bg-[var(--panel)] px-3 py-2 text-[12px] text-[var(--ink-3)]">{booked.length > 0 ? tr("p8ops.tpNoChildrenAddAbove") : tr("p8ops.tpNoChildrenNoBookings")}</div>}
                </div>}

                {/* ── Step 5: Sign-off ── */}
                {n === 5 && <div className="flex flex-col gap-2.5">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="rounded-xl border-2 px-3 py-2" style={{ borderColor: `color-mix(in srgb,${GREEN} 40%,transparent)`, background: "#f2fbf6" }}>{fl(tr("p8ops.tpPreparedBy"))}<div className="text-[13px] font-extrabold">{t.lead || tr("p8ops.tpTripLead")}</div><div className="text-[11px] text-[var(--ink-3)]">{tr("p8ops.tpTripLead")}</div></div>
                    <div className="rounded-xl border border-[var(--line)] px-3 py-2">{fl(tr("p8ops.tpChecks"))}<div className="text-[13px] font-extrabold">{tr("p8ops.tpChecksVal")}</div><div className="text-[11px] text-[var(--ink-3)]">{raDone(t) && staffOk(t) && permsOk(t) ? tr("p8ops.tpAllClear") : tr("p8ops.tpInProgress")}</div></div>
                    <div className="rounded-xl border border-[var(--line)] px-3 py-2">{fl(tr("p8ops.tpApprovedBy"))}<div className="text-[13px] font-extrabold">{s5Ok(t) ? t.signoff?.approvedBy : tr("p8ops.tpAwaitingMgr")}</div><div className="text-[11px] text-[var(--ink-3)]">{s5Ok(t) ? t.signoff?.approvedAt : tr("p8ops.tpLineManager")}</div></div>
                  </div>
                  {s5Ok(t) ? <div className="rounded-lg bg-[#e7f6ee] px-3 py-2 text-[12px] font-semibold" style={{ color: GREEN }}>{tr("p8ops.tpApprovedMsg", { name: t.signoff?.approvedBy ?? "", when: t.signoff?.approvedAt ?? "" })}</div>
                    : <><Button variant="solid" disabled={!canSubmit(t)} onClick={() => mut((d) => { d.signoff = { approvedBy: `${me} (Manager)`, approvedAt: `${fmtDate(todayIso())}, ${nowLabel()}`, submitted: true }; })}>{tr("p8ops.tpApproveBtn")}</Button>{!canSubmit(t) && <div className="rounded-lg bg-[#fdf3d8] px-3 py-2 text-[11.5px] font-semibold" style={{ color: AMBER }}>{tr("p8ops.tpCannotApprove", { list: [!s1Ok(t) && tr("p8ops.tpOutDetails"), !raDone(t) && tr("p8ops.tpOutRa"), !staffOk(t) && tr("p8ops.tpOutStaffing"), !permsOk(t) && tr("p8ops.tpOutConsents", { n: pendingOf(t).length })].filter(Boolean).join(", ") })}</div>}</>}
                </div>}

                {/* ── Step 6: Head counts ── */}
                {n === 6 && (locked ? <div className="rounded-lg bg-[var(--panel)] px-3 py-2 text-[12px] text-[var(--ink-3)]">{tr("p8ops.tpHeadLocked")}</div> : <div className="flex flex-col gap-2">
                  <div className="text-[12px] text-[var(--ink-2)]">{richT(tr, "p8ops.tpChildrenOnTrip", { n: <b>{attendingOf(t).length}</b> })}</div>
                  {(t.checkpoints ?? []).map((c, i) => {
                    const go = attendingOf(t).length, counted = c.counted != null, ok = counted && (c.counted ?? 0) >= go;
                    return (
                      <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2">
                        <input value={c.n} onChange={(e) => edit(`checkpoints.${i}.n`, e.target.value, tr("p8ops.tpLblCheckpoint"))} className="min-w-[120px] flex-1 rounded-md border border-[var(--line)] px-2 py-1 text-[12.5px] font-bold outline-none focus:border-[#1d3a8f]" />
                        <input type="number" min={0} value={counted ? c.counted! : go} disabled={counted} onChange={(e) => mut((d) => { d.checkpoints![i].counted = Math.max(0, parseInt(e.target.value, 10) || 0); })} className="w-16 rounded-md border border-[var(--line)] px-2 py-1 text-center text-[13px] font-extrabold disabled:opacity-60" id={`cp-${i}`} />
                        {counted ? <><span className="rounded-full px-2.5 py-0.5 text-[11px] font-extrabold" style={ok ? { background: "#e7f6ee", color: GREEN } : { background: "#fdebec", color: RED }}>{ok ? tr("p8ops.tpAllCountedN", { n: c.counted ?? 0 }) : `⚠ ${c.counted}/${go}`}</span><button type="button" onClick={() => mut((d) => { d.checkpoints![i].counted = null; d.checkpoints![i].time = undefined; })} className="px-1 text-[var(--ink-3)]" title={tr("p8ops.tpRecount")}>↻</button></> : <button type="button" onClick={() => { const el = document.getElementById(`cp-${i}`) as HTMLInputElement | null; const v = el ? (parseInt(el.value, 10) || go) : go; mut((d) => { d.checkpoints![i].counted = v; d.checkpoints![i].time = nowLabel(); }); }} className="rounded-md border border-[var(--line)] px-2 py-0.5 text-[11px] font-bold" style={{ color: BLUE }}>{tr("p8ops.tpConfirmCount")}</button>}
                      </div>
                    );
                  })}
                  <button type="button" onClick={() => mut((d) => { (d.checkpoints ??= []).push({ n: tz("New checkpoint"), counted: null }); })} className="self-start rounded-lg border-2 border-dashed border-[var(--line)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)]">{tr("p8ops.tpAddCheckpoint")}</button>
                  <div className="rounded-lg bg-[#fdebec] px-3 py-2 text-[12px] font-semibold" style={{ color: RED }}>{tr("p8ops.tpEmergencyStep6", { phone: t.leadPhone || "—" })}</div>
                </div>)}

                {/* ── Step 7: Return & debrief ── */}
                {n === 7 && <div className="flex flex-col gap-2.5">
                  <label className="flex flex-col gap-1.5">{fl(tr("p8ops.tpDebrief"))}<textarea value={t.notes ?? ""} onChange={(e) => edit("notes", e.target.value, tr("p8ops.tpDebrief"))} placeholder={tr("p8ops.tpDebriefPh")} className={`${taCls} min-h-[72px]`} /></label>
                  {t.returned ? <div className="flex flex-wrap items-center gap-2 rounded-lg bg-[#e7f6ee] px-3 py-2 text-[12px] font-semibold" style={{ color: GREEN }}>{tr("p8ops.tpReturnedClosed")}<button type="button" onClick={() => mut((d) => { d.returned = false; d.status = "planned"; })} className="ms-auto text-[11.5px] font-bold underline" style={{ color: GREEN }}>{tr("p8ops.tpReopenTrip")}</button></div>
                    : s6Ok(t) ? <Button variant="solid" onClick={() => mut((d) => { d.returned = true; d.status = "completed"; })}>{tr("p8ops.tpMarkReturned")}</Button>
                    : <div className="rounded-lg bg-[#fdf3d8] px-3 py-2 text-[11.5px] font-semibold" style={{ color: AMBER }}>{tr("p8ops.tpCompleteCheckpoints")}</div>}
                </div>}

                {/* ── Step 4 (part 2): parent letter — consent & payment ── */}
                {n === 4 && (() => {
                  const msg = t.parentMsg && t.parentMsg.trim() ? t.parentMsg : defaultParentMsg(t, providerName);
                  return (
                    <div className="mt-1 flex flex-col gap-3 border-t border-[var(--line)] pt-4">
                      <div className="flex items-center gap-2 text-[13px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{tr("p8ops.tpLetterTitle")} <span className="rounded-full bg-[var(--panel)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">{tr("p8ops.tpOptional")}</span></div>
                      <div className="rounded-lg bg-[#f4f8ff] px-3 py-2 text-[12px] text-[var(--ink-2)]">{tr("p8ops.tpLetterSkip")}</div>
                      <div>{fl(tr("p8ops.tpLetterAsk"))}
                        <div className="mt-1 flex flex-wrap gap-2">
                          <button type="button" onClick={() => mut((d) => { d.askConsent = d.askConsent === false; })} className="flex items-center gap-2 rounded-lg border-2 px-3 py-1.5 text-[12px] font-bold transition-colors" style={t.askConsent !== false ? { borderColor: GREEN, background: "#e7f6ee", color: GREEN } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{t.askConsent !== false ? "✓" : "○"} {tr("p8ops.tpAskConsent")}</button>
                          <button type="button" onClick={() => mut((d) => { d.askPay = d.askPay === false; })} className="flex items-center gap-2 rounded-lg border-2 px-3 py-1.5 text-[12px] font-bold transition-colors" style={t.askPay !== false ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{t.askPay !== false ? "✓" : "○"} {tr("p8ops.tpAskPayment")}</button>
                        </div>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="flex flex-col gap-1">{fl(t.askPay !== false ? tr("p8ops.tpPayBy") : tr("p8ops.tpRespondBy"))}<input type="date" value={t.payBy ?? ""} min={todayIso()} max={t.date} onChange={(e) => edit("payBy", e.target.value, tr("p8ops.tpLblPayBy"))} className={inputCls} /></label>
                        {t.askPay !== false && <div className="flex flex-col gap-1">{fl(tr("p8ops.tpCostPerChildLbl"))}<div className="rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 py-1.5 text-[12.5px] font-bold">£{t.cost || "0.00"} <span className="font-normal text-[var(--ink-3)]">{tr("p8ops.tpSetInStep1")}</span></div></div>}
                      </div>
                      <div>
                        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">{fl(tr("p8ops.tpMsgEditable"))}<button type="button" onClick={() => edit("parentMsg", defaultParentMsg(t, providerName), tr("p8ops.tpLblParentMsg"))} className="rounded-md border border-[var(--line)] px-2 py-0.5 text-[11px] font-bold text-[var(--ink-2)]">{tr("p8ops.tpResetTemplate")}</button></div>
                        <textarea value={msg} onChange={(e) => edit("parentMsg", e.target.value, tr("p8ops.tpLblParentMsg"))} className={`${inputCls} min-h-[180px] [field-sizing:content] resize-y leading-[1.6]`} />
                        <div className="mt-1.5 flex flex-wrap items-center gap-1"><span className="text-[10.5px] font-semibold text-[var(--ink-3)]">{tr("p8ops.tpMergeFields")}</span>{MERGE_FIELDS.map((f) => <code key={f} className="rounded bg-[var(--panel)] px-1.5 py-0.5 text-[10.5px] text-[#1d3a8f]">{f}</code>)}</div>
                      </div>
                      <div>
                        {fl(tr("p8ops.tpPreview"))}
                        <div className="mt-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                          <div className="whitespace-pre-line [overflow-wrap:anywhere] text-[12.5px] leading-[1.6] text-[var(--ink-2)]">{resolveMsg(msg, t, providerName)}</div>
                          <div className="mt-2.5 flex flex-wrap gap-2">
                            {t.askConsent !== false && <div className="inline-flex items-center gap-2 rounded-lg border-2 border-[#0f7a43]/30 bg-[#e7f6ee] px-3 py-1.5 text-[12px] font-extrabold" style={{ color: GREEN }}>{tr("p8ops.tpGivePermission", { dest: t.destination || tr("p8ops.tpTheTrip") })}</div>}
                            {t.askPay !== false && <div className="inline-flex items-center gap-2 rounded-lg bg-[#eef4fd] px-3 py-1.5 text-[12px] font-extrabold" style={{ color: BLUE }}>{tr("p8ops.tpPayPreview", { cost: t.cost || "0.00" })}{t.payBy ? tr("p8ops.tpByDate", { date: fmtDate(t.payBy) }) : ""}</div>}
                            {t.askConsent === false && t.askPay === false && <div className="text-[11.5px] text-[var(--ink-3)]">{tr("p8ops.tpNothingRequested")}</div>}
                          </div>
                        </div>
                      </div>
                      {(() => {
                        const recips = (t.attendees ?? []).filter((a) => a.consent !== "declined");
                        const sentN = recips.filter((a) => a.sent).length;
                        const sendAll = () => mut((d) => { (d.attendees ?? []).forEach((a) => { if (a.consent !== "declined") a.sent = true; }); d.parentMsgSentAt = `${fmtDate(todayIso())}, ${nowLabel()}`; });
                        return (
                          <div>
                            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">{fl(tr("p8ops.tpWhoGoesTo"))}<span className="text-[11px] font-semibold" style={{ color: sentN === recips.length && recips.length > 0 ? GREEN : "var(--ink-3)" }}>{tr("p8ops.tpSentN", { n: sentN, total: recips.length })}</span></div>
                            {recips.length === 0 ? <div className="rounded-lg bg-[var(--panel)] px-3 py-2 text-[12px] text-[var(--ink-3)]">{tr("p8ops.tpNoChildrenAddFirst")}</div>
                              : <div className="flex flex-col gap-1">
                                {recips.map((a, i) => {
                                  const idx = (t.attendees ?? []).indexOf(a);
                                  return (
                                    <div key={i} className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5">
                                      <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[#eaf0fc] text-[10.5px] font-extrabold" style={{ color: BLUE }}>{ini(a.n)}</span>
                                      <span className="flex-1 text-[12.5px] font-semibold">{a.n}<span className="font-normal text-[var(--ink-3)]">{tr("p8ops.tpParentSuffix")}</span></span>
                                      {a.sent ? <span className="rounded-full px-2 py-0.5 text-[10.5px] font-extrabold" style={{ background: "#e7f6ee", color: GREEN }}>{tr("p8ops.tpSentTick")}</span> : <span className="rounded-full px-2 py-0.5 text-[10.5px] font-extrabold" style={{ background: "#fdf3d8", color: AMBER }}>{tr("p8ops.tpNotSent")}</span>}
                                      <button type="button" onClick={() => mut((d) => { if (d.attendees?.[idx]) d.attendees[idx].sent = true; d.parentMsgSentAt = `${fmtDate(todayIso())}, ${nowLabel()}`; })} className="rounded-md border border-[var(--line)] px-2 py-0.5 text-[11px] font-bold" style={{ color: BLUE }}>{a.sent ? tr("p8ops.tpResend") : tr("p8ops.tpSend")}</button>
                                    </div>
                                  );
                                })}
                              </div>}
                            {recips.length > 0 && <div className="mt-2.5 flex flex-wrap items-center gap-2">
                              <Button variant="solid" onClick={sendAll}>{sentN > 0 ? tr("p8ops.tpResendAll") : tr("p8ops.tpSendAll")}</Button>
                              {sentN < recips.length && sentN > 0 && <button type="button" onClick={() => mut((d) => { (d.attendees ?? []).forEach((a) => { if (a.consent !== "declined" && !a.sent) a.sent = true; }); d.parentMsgSentAt = `${fmtDate(todayIso())}, ${nowLabel()}`; })} className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[12px] font-bold" style={{ color: BLUE }}>{tr("p8ops.tpSendNotYet", { n: recips.length - sentN })}</button>}
                              {t.parentMsgSentAt && <span className="text-[11.5px] font-semibold" style={{ color: GREEN }}>{tr("p8ops.tpLastSent", { time: t.parentMsgSentAt })}</span>}
                            </div>}
                            <div className="mt-1.5 text-[11px] text-[var(--ink-3)]">{tr("p8ops.tpEmailsNote")}</div>
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
        <Button disabled={open <= 1} onClick={() => setOpen(Math.max(1, open - 1))}>{tr("p8ops.tpPrev")}</Button>
        <span className="hidden text-[11.5px] font-semibold text-[var(--ink-3)] sm:block">{tr("p8ops.tpStepNav", { n: open, title: tr(TITLE_KEYS[open]) })}</span>
        <Button variant="solid" disabled={open >= 7} onClick={() => setOpen(Math.min(7, open + 1))}>{tr("p8ops.tpNext")}</Button>
      </div>

      {error && <div className="mt-3 text-[12.5px] font-bold text-[var(--red,#e21d27)]">{error}</div>}
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--line)] pt-3">
        <div className="flex flex-wrap gap-2"><Button onClick={onClose}>{tr("p8ops.tpBackToTrips")}</Button>{isEdit && <Button variant={t.status === "cancelled" ? undefined : "danger"} disabled={busy} onClick={cancelTrip}>{t.status === "cancelled" ? tr("p8ops.tpReinstateTrip") : tr("p8ops.tpCancelTrip")}</Button>}</div>
        <div className="flex gap-2"><Button disabled={busy} onClick={() => save(false)}>{busy ? tr("p8ops.tpSaving") : tr("p8ops.rtSave")}</Button><Button variant="solid" disabled={busy} onClick={() => save(true)}>{busy ? tr("p8ops.tpSaving") : tr("p8ops.tpSaveClose")}</Button></div>
      </div>
    </Card>
  );
}

export function TripsApp() {
  const tr = useT();
  const { locale } = useI18n();
  const { settings } = useSettings();
  // Who can plan a trip. Operators (company/franchise/freelancer) always can; on
  // the staff portal we honour the setting — "all" lets staff plan, otherwise
  // only leads/managers may (true per-user role gating is Amir's roles system).
  const onStaffPortal = (usePathname()?.split("/")[1] ?? "") === "staff";
  // A lead (Team & invites → Make lead) plans when the setting is "leads".
  const [lead, setLead] = useState(false);
  useEffect(() => { if (onStaffPortal) apiGet<{ lead?: boolean }>("/api/me").then((m) => setLead(m.lead === true)).catch(() => {}); }, [onStaffPortal]);
  const who = settings.trips?.whoCanPlan ?? "all";
  const canPlan = !onStaffPortal || who === "all" || (who === "leads" && lead);
  const ratioTarget = settings.trips?.ratioTarget ?? 8;
  const notifies = settings.trips?.notifyParent ?? true;
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [planning, setPlanning] = useState<{ trip?: Trip } | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const refresh = useCallback(() => { apiGet<Trip[]>("/api/trips").then((t) => { setTrips(t); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : tr("p8ops.dbFailedLoad"))); }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { apiGet<{ role: string }>("/api/me").then((me) => setCanManage(["company", "freelancer", "franchise"].includes(me.role))).catch(() => {}); }, []);
  useRealtime(["trips"], refresh);

  async function remove(t: Trip) { if (!confirm(tr("p8ops.tpConfirmDelete", { dest: t.destination }))) return; try { await api(`/api/trips/${encodeURIComponent(t.id)}`, { method: "DELETE" }); refresh(); } catch (e) { setError(e instanceof Error ? e.message : tr("p8ops.tpFailed")); } }
  async function setStatus(t: Trip, status: Status) { if (status === "cancelled" && !confirm(tr("p8ops.tpConfirmCancel", { dest: t.destination }))) return; try { await apiPut(`/api/trips/${encodeURIComponent(t.id)}`, { status, returned: false }); refresh(); } catch (e) { setError(e instanceof Error ? e.message : tr("p8ops.tpFailed")); } }
  // Quick head count from the card — confirm the next checkpoint without opening the planner.
  async function quickCount(t: Trip, count: number) {
    const cps = (t.checkpoints ?? []).map((c) => ({ ...c }));
    const next = cps.findIndex((c) => c.counted == null);
    if (next < 0) return;
    cps[next] = { ...cps[next], counted: count, time: nowLabel() };
    try { await apiPut(`/api/trips/${encodeURIComponent(t.id)}`, { checkpoints: cps }); refresh(); } catch (e) { setError(e instanceof Error ? e.message : tr("p8ops.tpFailed")); }
  }

  const all = useMemo(() => trips ?? [], [trips]);
  const upcoming = all.filter((t) => !t.returned && t.status !== "cancelled" && t.date >= todayIso()).length;
  const thisMonth = all.filter((t) => (t.date ?? "").slice(0, 7) === todayIso().slice(0, 7)).length;
  const needAction = all.filter((t) => t.status === "planned" && !t.returned && !canSubmit(t)).length;
  const tiles: [string, number][] = [[tr("p8ops.tpUpcoming"), upcoming], [tr("p8ops.tpThisMonth"), thisMonth], [tr("p8ops.tpNeedAction"), needAction], [tr("p8ops.tpTotal"), all.length]];
  const ql = q.trim().toLowerCase();
  const shown = useMemo(() => all.filter((t) => (!ql || t.destination.toLowerCase().includes(ql) || (t.childNames ?? []).join(" ").toLowerCase().includes(ql)) && (!statusFilter || t.status === statusFilter)).sort((a, b) => (`${b.date}` < `${a.date}` ? -1 : 1)), [all, ql, statusFilter]);

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-3 sm:-m-5 sm:p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      <div className="relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 100%)" }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}><span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">🚌</span>{tr("p8ops.tpTitle")}</div>
            <p className="mt-1.5 max-w-[640px] text-[12.5px] leading-[1.5] text-white/85">{tr("p8ops.tpLede")}</p>
          </div>
          <div className="flex flex-none flex-wrap items-center gap-2">
            <TourLauncher view="trips" compact />
            <SettingsLink />
            {!planning && (canPlan
              ? <button type="button" onClick={() => setPlanning({})} className="rounded-full bg-white px-4 py-2 text-[13px] font-extrabold text-[#1d3a8f] shadow-md transition-transform hover:-translate-y-px">{tr("p8ops.tpPlan")}</button>
              : <span className="rounded-full bg-white/15 px-3 py-1.5 text-[11.5px] font-semibold text-white/85 backdrop-blur-sm" title={tr("p8ops.tpSetInSetup")}>{tr("p8ops.tpOnlyLeads")}</span>)}
          </div>
        </div>
        {trips && (
          <div className="mt-4 flex flex-wrap gap-2.5">{tiles.map(([label, v]) => (
            <div key={label} className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur-sm"><div className="text-[20px] font-extrabold leading-none">{v}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/80">{label}</div></div>
          ))}</div>
        )}
      </div>

      {error && <div className="mb-3 rounded-lg border border-[#f6c9cc] bg-[#fdebec] px-3 py-2 text-[12.5px] text-[#e21d27]">{error}</div>}
      {planning && <TripPlanner key={planning.trip?.id ?? "new"} existing={planning.trip} ratioTarget={ratioTarget} providerName={settings.providerName || tr("p8ops.tpYourProvider")} onSaved={refresh} onClose={() => setPlanning(null)} />}

      {!planning && trips && all.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {([["", tr("p8ops.tpAll")], ["planned", tr("p8ops.tpStatPlanned")], ["completed", tr("p8ops.tpStatCompleted")], ["cancelled", tr("p8ops.tpStatCancelled")]] as [string, string][]).map(([id, label]) => (
            <button key={label} type="button" onClick={() => setStatusFilter(id)} className="rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-colors" style={statusFilter === id ? { borderColor: BLUE, background: BLUE, color: "#fff" } : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-2)" }}>{label}</button>
          ))}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("p8ops.tpSearchPh")} className="ms-auto w-56 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 py-1.5 text-[12.5px] outline-none focus:border-[#1d3a8f]" />
        </div>
      )}

      {planning ? null
        : !trips ? <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">{tr("p8ops.shLoading")}</div>
        : shown.length === 0 ? <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">{all.length === 0 ? tr("p8ops.tpNone") : tr("p8ops.tpNoMatch")}</Card>
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
                      <span className="text-[16px] font-extrabold leading-tight" style={{ fontFamily: "var(--ff-display)" }}>{t.destination || tr("p8ops.tpUntitled")}</span>
                      <span className="rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold" style={{ background: `color-mix(in srgb,${sp[1]} 14%,transparent)`, color: `color-mix(in srgb,${sp[1]} 74%,#000)` }}>{tr(sp[0])}</span>
                    </div>
                    <p className="mt-1 text-[12.5px] text-[var(--ink-2)]">{fmtDate(t.date)}{t.transport ? ` · ${TRANSPORT_KEY[t.transport] ? tr(TRANSPORT_KEY[t.transport]) : t.transport}` : ""}{t.departTime ? ` · ${tr("p8ops.tpDepartT", { time: t.departTime })}` : ""}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge tone={{ bg: "#eef4fd", fg: BLUE }}>{pickPlural(tr, locale, "p8ops.rtChildN", kids)}</Badge>
                      <Badge tone={staffOk(t) ? { bg: "#e7f6ee", fg: GREEN } : { bg: "#fdebec", fg: RED }}>{tr("p8ops.tpStaffRatio", { n: staffN, r: ratioOf(t) })}</Badge>
                      <Badge tone={raDone(t) ? { bg: "#e7f6ee", fg: GREEN } : { bg: "#fdf3d8", fg: AMBER }}>{raDone(t) ? tr("p8ops.tpRaSigned") : tr("p8ops.tpRaDraft")}</Badge>
                      {(() => { const tot = (t.attendees ?? []).length - declinedOf(t).length, con = attendingOf(t).length, paid = paidCountOf(t); return <>
                        <Badge tone={con >= tot && tot > 0 ? { bg: "#e7f6ee", fg: GREEN } : { bg: "#fdf3d8", fg: AMBER }}>{tr("p8ops.tpConsentBadge", { n: con, tot: tot || 0 })}</Badge>
                        {t.askPay !== false && (paid > 0 || tot > 0) && <Badge tone={paid >= tot && tot > 0 ? { bg: "#e7f6ee", fg: GREEN } : { bg: "#eef4fd", fg: BLUE }}>{tr("p8ops.tpPaidBadge", { n: paid, tot: tot || 0 })}</Badge>}
                      </>; })()}
                      <Badge tone={s5Ok(t) ? { bg: "#e7f6ee", fg: GREEN } : { bg: "#fdf3d8", fg: AMBER }}>{s5Ok(t) ? tr("p8ops.tpSignedOff") : tr("p8ops.tpSignoffPending")}</Badge>
                      {under && <Badge tone={{ bg: "#fdebec", fg: RED }}>{tr("p8ops.tpOverRatio", { r: ratioOf(t) })}</Badge>}
                    </div>
                  </div>
                  <div className="flex flex-none flex-col gap-2 sm:items-end">
                    <Button sm variant="solid" onClick={() => { setPlanning({ trip: t }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>{tr("p8ops.tpOpenPlanner")}</Button>
                    {canManage && <Button sm onClick={() => setStatus(t, t.status === "cancelled" ? "planned" : "cancelled")}>{t.status === "cancelled" ? tr("p8ops.tpReinstate") : tr("p8ops.tpCancelTrip")}</Button>}
                    {canManage && <Button sm variant="danger" onClick={() => remove(t)}>{tr("p8ops.tpDelete")}</Button>}
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
                      <span className="text-[12px] font-extrabold" style={{ color: BLUE }}>{tr("p8ops.tpHeadCount")}</span>
                      <span className="text-[11.5px] text-[var(--ink-2)]">{tr("p8ops.tpHcSummary", { go, done: doneN, total: cps.length })}{last ? tr("p8ops.tpHcLast", { c: last.counted ?? 0, go, time: last.time ?? "" }) : ""}</span>
                      {allOk ? <span className="ms-auto rounded-full bg-[#e7f6ee] px-2.5 py-0.5 text-[11px] font-extrabold" style={{ color: GREEN }}>{tr("p8ops.tpAllCounted")}</span>
                        : <button type="button" onClick={() => quickCount(t, go)} className="ms-auto rounded-lg px-3 py-1.5 text-[12px] font-extrabold text-white shadow-sm" style={{ background: BLUE }}>{tr("p8ops.tpQuickCount", { name: nextCp!.n, go })}</button>}
                    </div>
                  );
                })()}
                {notifies && !t.returned && pendingOf(t).length > 0 && <div className="border-t border-[var(--line)] bg-[#f4f8ff] px-4 py-2 text-[11.5px] text-[var(--ink-2)]">{tr("p8ops.tpChaseConsent", { n: pendingOf(t).length })}</div>}
              </Card>
            );
          })}</div>
        )}
    </div>
  );
}
