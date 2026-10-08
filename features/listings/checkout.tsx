"use client";

// ─────────────────────────────────────────────────────────────────────────
// The checkout, for both audiences. An operator books on someone's behalf so
// starts by finding the parent; a parent already is the parent, so that step
// doesn't exist for them and they get a payment method instead. Everything
// between — children per pass, extras per child per day, discounts — is the
// same code, because it's the same job.
//
// Two stages for a parent: settle who's on which pass, then choose extras.
// Extras are per child per day, so they can't be picked until the first is
// right.
// ─────────────────────────────────────────────────────────────────────────

import { tfcReady } from "@/lib/tfcReady";
import { GenderQuickAdd } from "@/features/common/GenderQuickAdd";
import { HowItWorks } from "@/components/HowItWorks";
import { dateLocale as dl } from "@/lib/i18n/format";
import type { DiscountKind } from "./discounts";
import { useEffect, useRef, useState } from "react";
import { tNow, useI18n } from "@/lib/i18n/provider";
import { pickPlural } from "@/lib/i18n/plural";
import { Rich } from "@/components/i18n/Rich";
import Link from "next/link";
import { get as apiGet, put as apiPut, api } from "@/lib/api";
import { translateApiMessage } from "@/lib/i18n/apiErrors";
import { AddressFields } from "@/features/common/AddressFields";
import { composeAddress, isFullAddress, splitAddress, visitLineHasHouse, type AddressParts } from "@/lib/addressComplete";
import { money, PAY_METHODS } from "@/features/bookings/helpers";
import { fmtDate, ordinal } from "./format";
import { uploadPlan, PLAN_MAX_BYTES } from "./planUpload";
import { dobRequired } from "@/lib/childDob";
import { useTenantSettings, questionsFor, asksEveryBooking, limitFor, liveVouchers, detailsForListing } from "@/lib/settings";
import { voucherWindow } from "@/lib/vouchers";
import { TFC_COPY_STEM } from "@/lib/tfc";
import { HMRC_CONNECTED, TFC_FAILURE_COPY, balance as tfcBalance, linkedChildren, referenceHint, referencePrefix, type TfcBalance, type TfcFailure } from "./tfc";
import { TfcConnect } from "./TfcConnect";
import { QuestionFields, unansweredRequired } from "@/components/QuestionFields";
import type { useBooking, BasketItem } from "./booking";
import type { AddonTemplate, LocalState } from "./FreelancerListingsApp";
import type { WizardDraft } from "./ListingWizard";
import { mealDayPlan, dishesForDay } from "@/features/meals/plan";
import { useT } from "@/lib/i18n/provider";
import { keepBasketForAuth } from "@/features/listings/booking";

export type ParentRow = { id: string; name: string; email?: string; phone?: string; address?: string; children?: ChildProfile[] };

export function useParents(skip = false) {
  const [list, setList] = useState<ParentRow[]>([]);
  // Derived, not set in the effect: a parent never has an address book to load.
  const [state, setState] = useState<"loading" | "ready" | "error">(skip ? "ready" : "loading");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (skip) return; // parents can't read /api/customers, and shouldn't
    let alive = true;
    apiGet<{ id: string; name?: string; email?: string; phone?: string; address?: string; postcode?: string; children?: ChildProfile[] }[]>("/api/customers")
      .then((cs) => {
        if (!alive) return;
        setList(cs.map((c) => ({ id: c.id, name: c.name || c.email || tNow("p8lst.ck8Unnamed"), email: c.email, phone: c.phone, address: [c.address, c.postcode].filter(Boolean).join(", ") || undefined, children: c.children ?? [] })));
        setState("ready");
      })
      // An empty address book and a failed request look identical otherwise.
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : tNow("p7ck.errParents"));
        setState("error");
      });
    return () => {
      alive = false;
    };
  }, [skip]);
  return { list, state, error };
}
/** "My scheme isn't listed" — never a real scheme id. */
const NOT_LISTED = "__not_listed__";

export type CkStage = "parent" | "who" | "extras" | "meals" | "pay";

export type CkTheme = {
  bg: string; line: string; ink: string; muted: string;
  accent: string; accentInk: string; round: string; inputBg: string;
  /** The panel's own header colour — extras use it so the flow keeps one voice. */
  bar: string; barInk: string;
};
export type ChildProfile = {
  id?: string; name: string; dob?: string;
  allergies?: string; medical?: string; likes?: string; dislikes?: string;
  /** SEND / additional needs, in the parent's words. */
  send?: string;
  /** A face for the register. Optional, and asked for with a reason rather
   *  than as another empty field — staff who have never met the child use it
   *  to know who they're handing over at the end of the day. */
  photo?: string;
  /** The word anyone other than the usual adult must say to collect this
   *  child. A safeguarding control, not a credential: staff read it off the
   *  register, so it is stored and shown in plain text and must never be
   *  reused as an account password. */
  collectionPassword?: string;
  /** An EHCP or SEND plan: the id of the uploaded file and the name it came in
   *  under. The bytes live in storage, not here. Only offered once they've
   *  said there are needs — an upload box on its own asks a question the
   *  parent hasn't been asked yet. */
  sendPlanId?: string; sendPlanName?: string;
  /** Set once this child's HMRC Tax-Free Childcare account has been linked, so
   *  a returning family goes straight to paying instead of linking again. */
  tfcReference?: string;
  photoConsent?: boolean;
  /** Required when adding a child; optional on the type because children saved
   *  before this was asked for don't have one. Those keep the neutral chip. Optional for the family. */
  sex?: "boy" | "girl" | "other" | "na";
  /** Answers to the provider's own child questions, keyed by question id.
   *  Set in Setup & features — see lib/settings.ts. */
  answers?: Record<string, string>;
};

/**
 * A child's photo, centre-cropped to a 128px square and re-encoded. Small
 * enough to sit on the child record without threatening Firestore's 1MB
 * document limit, which a phone photo would do several times over.
 */
export async function squareAvatar(file: File): Promise<string> {
  const img = document.createElement("img");
  const url = URL.createObjectURL(file);
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const min = Math.min(img.width, img.height);
  canvas.getContext("2d")!.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, size, size);
  URL.revokeObjectURL(url);
  return canvas.toDataURL("image/jpeg", 0.8);
}

/**
 * How long each free-text field on a child may be.
 *
 * Not arbitrary: these land in registers and CSV exports, and a paragraph in
 * an "allergies" column makes both unreadable. Short enough to force the
 * useful sentence, long enough for a real answer — "Nuts (EpiPen in bag),
 * dairy" fits in 140.
 *
 * Shared with the operator's copy of this form so the two can't disagree.
 */
export const CHILD_LIMITS = {
  allergies: 140,
  medical: 140,
  send: 200,
  likes: 80,
  dislikes: 80,
  collectionPassword: 40,
  emergencyName: 80,
  emergencyPhone: 30,
} as const;

/** Chip colours: blue for boys, pink for girls, neutral when unsaid. */
export function sexTint(sex: ChildProfile["sex"], on = false): { border: string; bg: string; ink: string } {
  // Two strengths of the same colour: soft while a child is simply listed,
  // solid once they're actually on something, so "chosen" is obvious at a
  // glance rather than a shade apart.
  if (sex === "boy")
    return on
      ? { border: "#1d5fd0", bg: "#2f7bf0", ink: "#ffffff" }
      : { border: "#7fb0ff", bg: "#e8f1ff", ink: "#14448f" };
  if (sex === "girl")
    return on
      ? { border: "#c9186b", bg: "#ec2f86", ink: "#ffffff" }
      : { border: "#ff9ec4", bg: "#ffeaf3", ink: "#9d1d54" };
  return on
    ? { border: "#3f4658", bg: "#5a6478", ink: "#ffffff" }
    : { border: "#d7dbe6", bg: "#f4f6fb", ink: "#3f4658" };
}
export function ageOn(dob: string | undefined, iso: string): number | null {
  if (!dob || !iso) return null;
  const b = new Date(`${dob}T00:00:00Z`), on = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(b.getTime()) || Number.isNaN(on.getTime())) return null;
  let age = on.getUTCFullYear() - b.getUTCFullYear();
  const m = on.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && on.getUTCDate() < b.getUTCDate())) age -= 1;
  return age;
}
export function ageProblem(d: WizardDraft, c: ChildProfile, tr?: (k: string, v?: Record<string, string | number>) => string): string | null {
  if (d.allowOutOfRange) return null; // the operator has said they'll take them
  const from = parseInt(d.ageFrom, 10), to = parseInt(d.ageTo, 10);
  if (!Number.isFinite(from) && !Number.isFinite(to)) return null;
  const age = ageOn(c.dob, d.runFrom);
  if (age === null) return null; // no date of birth yet — nothing to judge
  if (Number.isFinite(from) && age < from) return tr ? tr("p7ck.ageTooOld", { name: c.name || tr("p7ck.thisChild"), age, from: d.ageFrom, to: d.ageTo }) : `${c.name || "This child"} would be ${age} — this listing is for ${d.ageFrom}–${d.ageTo}.`;
  if (Number.isFinite(to) && age > to) return tr ? tr("p7ck.ageTooOld", { name: c.name || tr("p7ck.thisChild"), age, from: d.ageFrom, to: d.ageTo }) : `${c.name || "This child"} would be ${age} — this listing is for ${d.ageFrom}–${d.ageTo}.`;
  return null;
}
/** Out of range, but the listing accepts out-of-range children — a heads-up
 *  (not a block) that the place has to be approved by the provider. */
export function ageApprovalNote(d: WizardDraft, c: ChildProfile, tr?: (k: string, v?: Record<string, string | number>) => string): string | null {
  if (!d.allowOutOfRange) return null;
  const from = parseInt(d.ageFrom, 10), to = parseInt(d.ageTo, 10);
  if (!Number.isFinite(from) && !Number.isFinite(to)) return null;
  const age = ageOn(c.dob, d.runFrom);
  if (age === null) return null;
  const outside = (Number.isFinite(from) && age < from) || (Number.isFinite(to) && age > to);
  if (!outside) return null;
  return tr ? tr("p7ck.ageOutsideNote", { name: c.name || tr("p7ck.thisChild"), from: d.ageFrom, to: d.ageTo }) : `${c.name || "This child"} is outside the ${d.ageFrom}–${d.ageTo} age range, so this place has to be approved by the provider — you'll book now and they'll confirm.`;
}
/** A child's age TODAY (UK calendar date), worked out exactly as the server does when it checks a booking (server/src/routes/my.ts ageFromDob). */
export function ageToday(dob: string | undefined): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const uk = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: "Europe/London" }).split("-").map(Number);
  const [by, bm, bd] = uk(d), [ny, nm, nd] = uk(new Date());
  let a = ny - by;
  if (nm < bm || (nm === bm && nd < bd)) a--;
  return a >= 0 && a <= 25 ? a : null;
}
/** The ticket's own Age from / Age to (wizard > Tickets & pricing), falling back to the listing's range for a blank box: the same range the server applies. */
export function ticketAgeRange(d: WizardDraft, passName: string): { from: number; to: number; own: boolean } {
  const ov = d.ticketOverrides?.[passName];
  const f = parseInt(ov?.ageFrom ?? "", 10), t = parseInt(ov?.ageTo ?? "", 10);
  const lf = parseInt(d.ageFrom, 10), lt = parseInt(d.ageTo, 10);
  return { from: Number.isFinite(f) ? f : lf, to: Number.isFinite(t) ? t : lt, own: Number.isFinite(f) || Number.isFinite(t) };
}
/** True when this child's age sits outside the ticket's range (an unknown age is never judged, as on the server). */
export function outsideTicketRange(d: WizardDraft, c: ChildProfile, passName: string): { from: number; to: number } | null {
  const age = ageToday(c.dob);
  if (age === null) return null;
  const r = ticketAgeRange(d, passName);
  const out = (Number.isFinite(r.from) && age < r.from) || (Number.isFinite(r.to) && age > r.to);
  return out ? { from: r.from, to: r.to } : null;
}
/** Going back was a faint line of underlined text; at every stage it is now a
 *  button that looks like one, so the way out is as findable as the way on. */
function BackBtn({ tk, onClick, children, className = "" }: {
  tk: CkTheme; onClick: () => void; children: React.ReactNode; className?: string;
}) {
  return (
    <button type="button" onClick={onClick}
      className={`inline-flex items-center gap-1.5 border-2 px-3.5 py-2 text-[12.5px] font-extrabold ${tk.round} ${className}`}
      style={{ borderColor: `${tk.muted}80`, color: tk.ink, background: "transparent" }}>
      <span aria-hidden>←</span>{children}
    </button>
  );
}
export function ChildrenPanel({ d, tk, saved, roster, setRoster, comingCount, onUnassignAll, onAdded, canSave = true, tenantId }: {
  d: WizardDraft; tk: CkTheme;
  /** False for an operator: these are someone else's children, and
   *  /api/my/children is the operator's own family. Edits stay on the booking
   *  until there's an endpoint for writing to a customer's record. */
  canSave?: boolean;
  saved: ChildProfile[];
  roster: ChildProfile[];
  setRoster: (c: ChildProfile[]) => void;
  /** How many basket lines this child is currently on. */
  comingCount: (name: string) => number;
  onUnassignAll: (name: string) => void;
  /** Clears any "taken off this pass" marks, so a child added is on everything. */
  onAdded: (name: string) => void;
  /** The listing's tenant, so a signed-out parent can read that provider's
   *  public settings (child questions, char limits, DOB rule). */
  tenantId?: string;
}) {
  const tr = useT();
  const { locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<ChildProfile>({ name: "", photoConsent: false });
  // Children added on this screen, kept so their card stays on the list (and can be tapped back on) after being switched off.
  const [created, setCreated] = useState<ChildProfile[]>([]);
  const [more, setMore] = useState(false);
  const label = { fontSize: 10, letterSpacing: "0.12em" } as const;
  const inp = `aos-in w-full border px-2.5 py-2 text-[12.5px] outline-none ${tk.round}`;
  // tk.line is a hairline meant for dividers; on the dark themes it left the
  // fields with no visible edge at all.
  const inpStyle = { background: tk.inputBg, borderColor: `${tk.ink}4d`, color: tk.ink };
  const problem = draft.name.trim() ? ageProblem(d, draft, tr) : null;
  const approvalNote = draft.name.trim() && !problem ? ageApprovalNote(d, draft, tr) : null;
  // The provider's own questions, narrowed to this listing and this child's
  // age. `d.runFrom` rather than today, matching ageProblem above: the age
  // that matters is the one they'll be on the first day they attend, and two
  // age rules disagreeing on the same screen would be indefensible.
  const { questions: allQuestions, settings, ready: settingsReady } = useTenantSettings(tenantId, d.id ?? undefined);
  // The form asks the "once" questions only. The every-booking ones are
  // rendered per child on the roster above, so listing them here too would
  // ask the same thing twice on the same screen.
  const askQuestions = questionsFor(allQuestions, d.id ?? undefined, ageOn(draft.dob, d.runFrom)).filter(
    (q) => !asksEveryBooking(q),
  );
  // The provider's Setup toggle decides (Setup warns what stops working without a date of birth); an age-gated question forces it.
  const needDob = dobRequired(settings, allQuestions);
  const pinMode = settings.collectionCheck === "pin";
  // Name, date of birth and boy/girl are required: the age gate can't judge a
  // booking without a birthday, and registers are drawn up from both. All of
  // them at once, not the first — being sent back three times running for one
  // more field each time is the worst version of this.
  const missing = [
    !draft.name.trim() && tr("p7ck.missTheirName"),
    // Compulsory unless the provider has said otherwise — and never optional
    // while a question is age-gated, because there is no age without it.
    !draft.dob && needDob && tr("p7ck.missDob"),
    // A question the provider marked "must be answered" is as required as the
    // built-ins, and joins the same one-shot list rather than being a second
    // rejection after this one is satisfied.
    ...unansweredRequired(askQuestions, draft.answers ?? {}).map((q) => q.label.toLowerCase()),
  ].filter(Boolean) as string[];
  // The button stays live and answers when pressed. A dead button tells you
  // nothing about why it is dead.
  const [tried, setTried] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const planRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const [planPct, setPlanPct] = useState<number | null>(null);
  const flag = (bad: boolean) => (tried && bad ? { borderColor: "#f87171", boxShadow: "0 0 0 1px #f87171" } : null);

  const add = () => {
    // The provider's required questions aren't known until their settings have
    // loaded; adding before then would skip them (CF-005).
    if (!settingsReady) return;
    if (missing.length || problem) { setTried(true); return; }
    if (editing !== null) {
      setRoster(roster.map((c, i) => (i === editing ? draft : c)));
      // Keep their saved profile in step with the edit, when there is one.
      if (canSave && draft.id) void api(`/api/my/children/${encodeURIComponent(draft.id)}`, { method: "PUT", body: JSON.stringify(draft) }).catch(() => {});
    } else {
      onAdded(draft.name.trim());
      setRoster([...roster, draft]);
      setCreated((cs) => [...cs, draft]);
    }
    setDraft({ name: "", photoConsent: false });
    setEditing(null);
    setTried(false);
    setOpen(false);
    setMore(false);
  };
  // One list, one card style: saved profiles first, then anyone just added here.
  const nkey = (c: ChildProfile) => c.name.trim().toLowerCase();
  const cards = [...new Map(saved.map((sv) => [nkey(sv), sv])).values()];
  for (const c of [...roster, ...created]) if (!cards.some((x) => nkey(x) === nkey(c))) cards.push(c);


  return (
    <>
      <div className="mt-4 text-[17px] font-extrabold" style={{ color: tk.ink }}>{tr("p7ck.whosComingQ")}</div>
      {(() => {
        const from = parseInt(d.ageFrom, 10), to = parseInt(d.ageTo, 10);
        if (!Number.isFinite(from) && !Number.isFinite(to)) return null;
        const range = Number.isFinite(from) && Number.isFinite(to)
          ? (from === to ? tr("p7ck.rangeAge", { from }) : tr("p7ck.rangeAges", { from, to }))
          : Number.isFinite(from) ? tr("p7ck.rangeOver", { from }) : tr("p7ck.rangeUpTo", { to });
        return <div className="mt-0.5 text-[14px]" style={{ color: tk.muted }}><Rich text={tr("p7ck.listingFor", { range, tail: d.allowOutOfRange ? tr("p7ck.tailOthers") : "." })} /></div>;
      })()}

      {settings.collectGender && cards.filter((c) => c.id && !c.sex).slice(0, 3).map((c) => (
        <GenderQuickAdd key={c.id} kid={{ id: c.id!, name: c.name }} variant="inline" />
      ))}
      <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {/* One card style for everyone: saved children and ones just added here. Tap = on every chosen date, tap again = off. */}
        {cards.map((sv) => {
          const bad = ageProblem(d, sv, tr);
          const same = (r: ChildProfile) => (r.id && r.id === sv.id) || r.name.trim().toLowerCase() === sv.name.trim().toLowerCase();
          const added = roster.some(same);
          const initial = (sv.name.trim()[0] ?? "?").toUpperCase();
          return (
            <button key={sv.id ?? sv.name} type="button" disabled={!!bad}
              aria-pressed={added} data-ui="child-card"
              title={bad ?? (added ? tr("p7ck.takeOffBooking", { name: sv.name }) : tr("p7ck.addToBooking", { name: sv.name }))}
              onClick={() => {
                if (added) { setRoster(roster.filter((r) => !same(r))); return; }
                onAdded(sv.name.trim());
                setRoster([...roster, sv]);
              }}
              className="flex min-h-[72px] items-center gap-3 rounded-2xl border-2 p-3 text-start transition active:scale-[0.99] disabled:opacity-45"
              style={{ borderColor: added ? "#16a34a" : "#c7d2f0", background: added ? "#ecfdf3" : "#fff", boxShadow: added ? "0 8px 22px -12px rgba(22,163,74,.55)" : "0 6px 16px -12px rgba(20,30,90,.35)" }}>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[19px] font-extrabold text-white" style={{ background: added ? "#16a34a" : "#1d3a8f" }} aria-hidden>{initial}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-extrabold" style={{ color: "#171534" }}>
                  {sv.name}
                  {sv.dob && <span className="ms-1.5 text-[14px] font-semibold" style={{ color: "#5b6074" }}>age {ageOn(sv.dob, d.runFrom) ?? "—"}</span>}
                </span>
                {bad && <span className="mt-0.5 block text-[14px] leading-snug" style={{ color: "#b91c1c" }}>{bad}</span>}
                {added && !bad && (
                  <span role="button" tabIndex={0} className="mt-0.5 inline-block text-[14px] font-bold underline" style={{ color: "#1d3a8f" }}
                    onClick={(e) => { e.stopPropagation(); const ri = roster.findIndex(same); if (ri >= 0) { setDraft(roster[ri]); setEditing(ri); setMore(true); setOpen(true); } }}
                    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.click(); }}>{tr("p7ck.editDetails")}</span>
                )}
              </span>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-[17px] font-black"
                style={added ? { background: "#16a34a", borderColor: "#16a34a", color: "#fff" } : { borderColor: "#1d3a8f", color: "#1d3a8f" }} aria-hidden>
                {added ? "✓" : "+"}
              </span>
            </button>
          );
        })}
        {!open && (
          <button type="button" onClick={() => { setMore(false); setOpen(true); }} data-ui="add-child"
            className="flex min-h-[72px] items-center gap-3 rounded-2xl border-2 border-dashed p-3 text-start"
            style={{ borderColor: "#9aa7d6", background: "transparent", color: tk.ink }}>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-dashed text-[22px] font-black" style={{ borderColor: "#9aa7d6" }} aria-hidden>+</span>
            <span className="text-[16px] font-extrabold">{tr("p7ck.addAChild")}</span>
          </button>
        )}
      </div>
      {/* Questions the provider re-asks every booking.
          These sit out here rather than inside "Edit details" on purpose: a
          returning family never opens that form, so a question buried in it
          would be asked once and never again — the exact opposite of what
          "every booking" means. The answer refreshes the one on the child's
          record, so staff always read the current one. */}
      {roster.map((c, i) => {
        const qs = questionsFor(allQuestions, d.id ?? undefined, ageOn(c.dob, d.runFrom)).filter(asksEveryBooking);
        if (!qs.length) return null;
        return (
          <div key={`ask-${c.name}-${i}`} className={`mt-2 border p-3 ${tk.round}`} style={{ borderColor: tk.line }}>
            <div className="text-[12px] font-bold" style={{ color: tk.ink }}>
              {tr("p8lst.ck8AboutChild", { name: c.name.trim() || tr("p7ck.thisChildLower") })}
            </div>
            <QuestionFields
              questions={qs}
              answers={c.answers ?? {}}
              onChange={(answers) => setRoster(roster.map((x, n) => (n === i ? { ...x, answers } : x)))}
              tone={{
                ink: tk.ink,
                muted: tk.muted,
                inputClass: inp,
                inputStyle: inpStyle,
                accent: tk.accent,
                accentSoft: `${tk.accent}26`,
                line: `${tk.ink}26`,
              }}
            />
          </div>
        );
      })}
      {open && (
        <div className={`mt-2.5 border-2 p-3.5 ${tk.round}`} style={{ borderColor: "#c7d2f0" }}>
          <div className="flex flex-wrap gap-2">
            <div className="min-w-[150px] flex-1">
              <div className="mb-1 text-[11px] font-bold" style={{ color: tk.ink }}>{tr("p7ck.lblChildName")} <span style={{ color: "#f87171" }}>*</span></div>
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder={tr("p7ck.phFullName")} className={inp} style={{ ...inpStyle, ...flag(!draft.name.trim()) }} />
            </div>
            {needDob && (
            <div className="w-[150px]">
              <div className="mb-1 text-[11px] font-bold" style={{ color: tk.ink }}>{tr("p7ck.lblDob")} {needDob ? <span style={{ color: "#f87171" }}>*</span> : <span className="font-normal">{tr("p7ck.optionalDash")}</span>}</div>
              <input type="date" value={draft.dob ?? ""} onChange={(e) => setDraft({ ...draft, dob: e.target.value })}
                className={inp} style={{ ...inpStyle, ...flag(!draft.dob) }} />
            </div>
            )}
          </div>
          {problem && (
            <div className={`mt-2 border px-3 py-2 text-[12px] font-bold ${tk.round}`}
              style={{ borderColor: "#f87171", background: "rgba(248,113,113,.12)", color: "#fca5a5" }}>{problem}</div>
          )}
          {approvalNote && (
            <div className={`mt-2 border px-3 py-2 text-[12px] font-semibold leading-[1.5] ${tk.round}`}
              style={{ borderColor: "#f59e0b", background: "rgba(245,158,11,.12)", color: "#e0a020" }}>{approvalNote}</div>
          )}
          {/* A provider with no reason to ask can switch this off entirely in
              Setup — asking a parent to sex their child for no purpose isn't
              a neutral default. */}
          {settings.collectGender && (
          <div className="mt-2.5">
            <div className="mb-1 text-[12px]" style={{ color: tk.ink }}>{tr("p8lst.genLabel")}</div>
            <div className="flex flex-wrap gap-2">
              {(["boy", "girl", "other", "na"] as const).map((v) => {
                const on = draft.sex === v;
                const c = sexTint(v);
                const lbl = v === "boy" ? tr("p8lst.genBoy") : v === "girl" ? tr("p8lst.genGirl") : v === "other" ? tr("p8lst.genOther") : tr("p8lst.genNa");
                return (
                  <button key={v} type="button" onClick={() => setDraft({ ...draft, sex: on ? undefined : v })}
                    className={`border-2 px-3 py-1 text-[11.5px] font-bold ${tk.round}`}
                    style={on ? { borderColor: c.border, background: c.bg, color: c.ink } : { borderColor: `${tk.ink}59`, color: tk.ink }}>
                    {lbl}
                  </button>
                );
              })}
            </div>
            <span className="mt-1 block text-[10.5px]" style={{ color: tk.muted }}>{tr("p8lst.genNote")}</span>
          </div>
          )}
          <QuestionFields
            questions={askQuestions.filter((q) => q.required)}
            answers={draft.answers ?? {}}
            onChange={(answers) => setDraft({ ...draft, answers })}
            tone={{
              ink: tk.ink,
              muted: tk.muted,
              inputClass: inp,
              inputStyle: inpStyle,
              accent: tk.accent,
              accentSoft: `${tk.accent}26`,
              line: `${tk.ink}26`,
            }}
          />

          <button type="button" onClick={() => setMore(!more)} className="mt-3 text-[14px] font-bold underline underline-offset-2" style={{ color: tk.muted }}>{more ? tr("p7ck.fewerDetails") : tr("p7ck.moreDetailsOpt")}</button>
          {more && (<>
            {!needDob && (
              <div className="mt-2 w-[170px]">
              <div className="mb-1 text-[11px] font-bold" style={{ color: tk.ink }}>{tr("p7ck.lblDob")} {needDob ? <span style={{ color: "#f87171" }}>*</span> : <span className="font-normal">{tr("p7ck.optionalDash")}</span>}</div>
              <input type="date" value={draft.dob ?? ""} onChange={(e) => setDraft({ ...draft, dob: e.target.value })}
                className={inp} style={{ ...inpStyle, ...flag(!draft.dob) }} />
            </div>
            )}
          {/* After the name, so it can be asked for by name, and so the two
              required fields lead the form. Asked with a reason attached —
              "add a photo" on its own is just another empty box. */}
          {settings.collectPhoto && (
          <div className={`mt-2.5 flex items-center gap-3 border border-dashed p-2.5 ${tk.round}`}
            style={{ borderColor: `${tk.ink}33` }}>
            <button type="button" onClick={() => photoRef.current?.click()}
              className="flex h-14 w-14 flex-none items-center justify-center overflow-hidden rounded-full border-2 border-dashed"
              style={{ borderColor: `${tk.ink}40`, color: tk.muted }}
              title={draft.photo ? tr("p7ck.changePhoto") : tr("p7ck.addPhoto")}>
              {draft.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={draft.photo} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-[20px]">📷</span>
              )}
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-[11.5px] font-bold" style={{ color: tk.ink }}>
                {tr("p7ck.photoOf", { name: draft.name.trim() || tr("p7ck.yourChildWord") })} <span className="font-normal">{tr("p7ck.optionalDash")}</span>
              </div>
              <div className="mt-0.5 text-[10.5px] leading-[1.45]" style={{ color: tk.muted }}>
                {tr("p9tx.ckPhotoNote")}
              </div>
              {draft.photo ? (
                <button type="button" onClick={() => setDraft({ ...draft, photo: undefined })}
                  className="mt-1 text-[10.5px] font-bold" style={{ color: tk.muted }}>{tr("p7ck.removePhoto")}</button>
              ) : (
                <button type="button" onClick={() => photoRef.current?.click()}
                  className={`mt-1.5 border-2 px-2.5 py-1 text-[11px] font-extrabold ${tk.round}`}
                  style={{ borderColor: tk.accent, color: tk.accent }}>{tr("p7ck.addPhotoBtn")}</button>
              )}
            </div>
            <input ref={photoRef} type="file" accept="image/*" className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                const data = await squareAvatar(f).catch(() => null);
                if (data) setDraft({ ...draft, photo: data });
              }} />
          </div>
          )}

          {/* Safeguarding, so it says plainly what it's for and when it's
              used. A parent who doesn't understand the field leaves it blank,
              and then nobody can collect but them. */}
          {settings.collectionCheck !== "off" && (
          <div className={`mt-2.5 border p-2.5 ${tk.round}`} style={{ borderColor: `${tk.ink}33` }}>
            <div className="mb-1 text-[11.5px] font-bold" style={{ color: tk.ink }}>
              {pinMode ? tr("p7ck.collectionPin") : tr("p7ck.collectionPassword")} <span className="font-normal">{tr("p7ck.optionalDash")}</span>
            </div>
            <div className="mb-1.5 text-[10.5px] leading-[1.45]" style={{ color: tk.muted }}>
              <Rich text={tr(pinMode ? "p7ck.collectionHelpNum" : "p7ck.collectionHelpWord", { name: draft.name.trim() || tr("p7ck.yourChildWord") })} bClass="" />
            </div>
            <input value={draft.collectionPassword ?? ""}
              maxLength={CHILD_LIMITS.collectionPassword}
              onChange={(e) => setDraft({ ...draft, collectionPassword: e.target.value })}
              inputMode={pinMode ? "numeric" : undefined}
              placeholder={pinMode ? tr("p8lst.ck8PhPin") : tr("p8lst.ck8PhWord")} className={inp} style={inpStyle} />
            <div className="mt-1 text-[10px] leading-[1.4]" style={{ color: tk.muted }}>
              {tr(pinMode ? "p8lst.ck8StaffSeePin" : "p8lst.ck8StaffSeeWord")}
            </div>
          </div>
          )}

          <div className="mt-2">
            <div className="mb-1 text-[11px] font-bold" style={{ color: tk.ink }}>{tr("p7ck.lblAllergies")} <span className="font-normal">{tr("p7ck.optionalDash")}</span></div>
            <input value={draft.allergies ?? ""} onChange={(e) => setDraft({ ...draft, allergies: e.target.value })}
              maxLength={limitFor(settings, "allergies", CHILD_LIMITS)} placeholder={tr("p7ck.phAllergies")} className={inp} style={inpStyle} />
          </div>
          <div className="mt-2">
            <div className="mb-1 text-[11px] font-bold" style={{ color: tk.ink }}>{tr("p7ck.lblMedical")} <span className="font-normal">{tr("p7ck.optionalDash")}</span></div>
            <input value={draft.medical ?? ""} onChange={(e) => setDraft({ ...draft, medical: e.target.value })}
              maxLength={limitFor(settings, "medical", CHILD_LIMITS)} placeholder={tr("p7ck.phMedical")} className={inp} style={inpStyle} />
          </div>
          {settings.collectSend && (
          <div className="mt-2">
            <div className="mb-1 text-[11px] font-bold" style={{ color: tk.ink }}>{tr("p7ck.lblSend")} <span className="font-normal">{tr("p7ck.optionalDash")}</span></div>
            <input value={draft.send ?? ""} onChange={(e) => setDraft({ ...draft, send: e.target.value })}
              maxLength={limitFor(settings, "send", CHILD_LIMITS)} placeholder={tr("p7ck.phSend")} className={inp} style={inpStyle} />
            {/* The upload only appears once they've told us there's something
                to support — asking for a plan before that is asking twice. */}
            {settings.collectSendPlan && !!draft.send?.trim() && (
              <div className={`mt-2 border border-dashed p-2.5 ${tk.round}`} style={{ borderColor: `${tk.ink}4d` }}>
                <div className="text-[11px] font-bold" style={{ color: tk.ink }}>
                  {tr("p7ck.lblEhcp")} <span className="font-normal">{tr("p7ck.optionalDash")}</span>
                </div>
                <div className="mt-0.5 text-[10.5px] leading-[1.45]" style={{ color: tk.muted }}>
                  {tr("p9tx.ckPlanNote", { mb: String(PLAN_MAX_BYTES / 1_000_000) })}
                </div>
                {draft.sendPlanId ? (
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[11.5px] font-bold" style={{ color: tk.ink }}>
                      📎 {draft.sendPlanName ?? tr("p7ck.planAttached")}
                    </span>
                    <button type="button" onClick={() => setDraft({ ...draft, sendPlanId: undefined, sendPlanName: undefined })}
                      className="text-[11px] font-bold" style={{ color: tk.muted }}>{tr("p7ck.removeWord")}</button>
                  </div>
                ) : planPct !== null ? (
                  <div className="mt-2">
                    <div className="text-[11.5px] font-bold" style={{ color: tk.ink }}>{tr("p9tx.ckUploading", { pct: String(Math.round(planPct * 100)) })}</div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full" style={{ background: `${tk.ink}26` }}>
                      <div className="h-full rounded-full" style={{ width: `${planPct * 100}%`, background: tk.accent }} />
                    </div>
                  </div>
                ) : (
                  // The bare file input rendered as the browser's own grey
                  // "Choose File / No file chosen", which reads as a disabled
                  // label rather than something to press.
                  <button type="button" onClick={() => planRef.current?.click()}
                    className={`mt-2 flex w-full items-center justify-center gap-2 border-2 px-3 py-2.5 text-[12.5px] font-extrabold ${tk.round}`}
                    style={{ borderColor: tk.accent, color: tk.accent, background: "transparent" }}>
                    <span aria-hidden>📎</span> {tr("p8lst.ck8ChooseFile")}
                  </button>
                )}
                {!draft.sendPlanId && (
                  <input ref={planRef} type="file" accept="application/pdf,image/*" className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (!f) return;
                      if (f.size > PLAN_MAX_BYTES) {
                        setPlanError(tr("p7ck.planTooBig", { name: f.name, mb: Math.round(f.size / 1_000_000), max: PLAN_MAX_BYTES / 1_000_000 }));
                        return;
                      }
                      setPlanError(null);
                      setPlanPct(0);
                      try {
                        const ref = await uploadPlan(f, setPlanPct);
                        setDraft({ ...draft, sendPlanId: ref.id, sendPlanName: ref.name });
                      } catch (err) {
                        setPlanError(err instanceof Error ? err.message : tr("p7ck.uploadFailed"));
                      } finally {
                        setPlanPct(null);
                      }
                    }} />
                )}
                {planError && (
                  <div className="mt-1.5 text-[11px] font-bold" style={{ color: "#fca5a5" }}>{planError}</div>
                )}
              </div>
            )}
          </div>
          )}

          <div className="mt-2">
            <div className="mb-1 text-[11px] font-bold" style={{ color: tk.ink }}>{tr("p7ck.lblLikes")} <span className="font-normal">{tr("p7ck.optionalDash")}</span></div>
            <div className="mb-1 text-[10.5px] leading-[1.45]" style={{ color: tk.muted }}>
              {tr("p9tx.ckLikesNote")}
            </div>
            <div className="flex flex-wrap gap-2">
              <input value={draft.likes ?? ""} onChange={(e) => setDraft({ ...draft, likes: e.target.value })} maxLength={limitFor(settings, "likes", CHILD_LIMITS)}
                placeholder={tr("p7ck.phLikes")} className={`${inp} min-w-[130px] flex-1`} style={inpStyle} />
              <input value={draft.dislikes ?? ""} onChange={(e) => setDraft({ ...draft, dislikes: e.target.value })} maxLength={limitFor(settings, "dislikes", CHILD_LIMITS)}
                placeholder={tr("p7ck.phDislikes")} className={`${inp} min-w-[130px] flex-1`} style={inpStyle} />
            </div>
          </div>

          <QuestionFields
            questions={askQuestions.filter((q) => !q.required)}
            answers={draft.answers ?? {}}
            onChange={(answers) => setDraft({ ...draft, answers })}
            tone={{
              ink: tk.ink,
              muted: tk.muted,
              inputClass: inp,
              inputStyle: inpStyle,
              accent: tk.accent,
              accentSoft: `${tk.accent}26`,
              line: `${tk.ink}26`,
            }}
          />
          {/* Permission to USE photos of them — not the photo above, which is
              for staff to recognise them. A provider who never publishes
              photos shouldn't be asking families to rule on it. */}
          {settings.askPhotoConsent && (
            <div className="mt-2.5 flex items-center gap-2">
              <span className="flex-1 text-[12px]" style={{ color: tk.ink }}>{tr("p7ck.photosQ")}</span>
              {[[tr("p7ck.yesWord"), true], [tr("p7ck.noWord"), false]].map(([l, v]) => (
                <button key={String(l)} type="button" onClick={() => setDraft({ ...draft, photoConsent: v as boolean })}
                  className={`border px-3 py-1 text-[11.5px] font-bold ${tk.round}`}
                  style={draft.photoConsent === v
                    ? { borderColor: tk.accent, background: tk.accent, color: tk.accentInk }
                    : { borderColor: `${tk.ink}59`, color: tk.ink }}>{l as string}</button>
              ))}
            </div>
          )}
          </>)}
          {tried && missing.length > 0 && !problem && (
            <div className={`mt-2.5 border px-3 py-2 text-[12px] font-bold ${tk.round}`}
              style={{ borderColor: "#f87171", background: "rgba(248,113,113,.12)", color: "#fca5a5" }}>
              {tr("p7ck.stillNeed", { name: draft.name.trim() || tr("p7ck.thisChildLower"), list: new Intl.ListFormat(dl(), { style: "long", type: "conjunction" }).format(missing) }).replace(/([?!؟])\s*[.。۔।]$/, "$1")}
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={add} disabled={!settingsReady} aria-busy={!settingsReady}
              className={`flex-1 py-2 text-[12.5px] font-extrabold disabled:cursor-wait disabled:opacity-60 ${tk.round}`}
              style={{ background: tk.accent, color: tk.accentInk }}>{!settingsReady ? tr("p7ck.loadingChildQs") : editing !== null ? tr("p7ck.saveDetails") : tr("p7ck.addChild")}</button>
            <button type="button" onClick={() => { setOpen(false); setMore(false); setEditing(null); setTried(false); setDraft({ name: "", photoConsent: false }); }}
              className="text-[12px] font-bold" style={{ color: tk.muted }}>{tr("p8lst.ck8Cancel")}</button>
          </div>
        </div>
      )}
    </>
  );
}
/**
 * Is this checkout sitting on a dark background?
 *
 * The panel renders in two places with opposite palettes: the parent portal
 * (white) and the operator's public storefront (their theme — "Midnight" and
 * "Royal" are near-black). The Tax-Free Childcare green was one fixed mint,
 * which read fine on navy and disappeared on white. So pick the green from the
 * host background rather than picking one and hoping.
 */
function ckDarkBg(hex: string): boolean {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((hex ?? "").trim());
  if (!m) return false;              // gradients / named colours → assume light
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  const [r, g, bl] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl < 0.5;
}

// A Setup payment-method label → the parent's payment rail [key, label]. Card/
// bank/cash/tfc are fixed rails (card routes to Stripe); voucher is handled
// separately because it only shows once a scheme has a reference to quote.
function parentMethodEntry(m: string): [string, string] | null {
  if (/card/i.test(m)) return ["card", tNow("p7ck.methodCard")];
  if (/bank|transfer/i.test(m)) return ["bank", tNow("p7ck.methodBank")];
  if (/cash/i.test(m)) return ["cash", tNow("p7ck.methodCash")];
  if (/tax.?free|tfc/i.test(m)) return ["tfc", "Tax-Free Childcare"];
  if (/haf|funded/i.test(m)) return ["haf", m];
  if (/voucher/i.test(m)) return null;
  return [m.toLowerCase().replace(/[^a-z0-9]+/g, "-"), m];
}
export function CheckoutPanel({ b, d, addons, tk, mode = "operator", onBook, booking, tenantId }: {
  b: ReturnType<typeof useBooking>; d: WizardDraft; addons: LocalState["addons"]; tk: CkTheme;
  mode?: "operator" | "parent";
  onBook?: (p: { method: string; voucherScheme?: string; voucherRefs?: Record<string, string>; tfc?: { amount: number; remainderVia: string; references: Record<string, string> }; discountCodes?: string[]; walletCap?: number; phone?: string; basket: BasketItem[]; addonSel: Record<string, Record<string, string[]>>; addonAns: Record<string, Record<string, string>>; mealSel: Record<string, string>; children: ChildProfile[]; dayAssign: Record<string, Record<string, string[]>>; parent?: { id: string; name: string; email?: string; phone?: string; address?: string } | null; /** Home-visit listings only: where this session actually happens — defaults to the parent's saved address, editable at checkout. */ serviceAddress?: { address: string; postcode: string }; /** Operator checkout "Override the total" (server accepts it only for a booking made on a family's behalf). */ overrideTotal?: number; overrideReason?: string }) => void;
  booking?: { busy: boolean; error: string | null };
  /** The listing's tenant, for the signed-out parent's public settings read. */
  tenantId?: string;
}) {
  const tr = useT();
  const dkLabel = (k: DiscountKind) => tr(k === "person" ? "p9tx.dkPerson" : k === "session" ? "p9tx.dkSession" : "p9tx.dkEarly");
  const { locale } = useI18n();
  const parentMode = mode === "parent";
  const { list: parents, state: parentsState, error: parentsError } = useParents(parentMode);
  // The operator's method list is the provider's own (Setup & features); the
  // parent's three are NOT, because "card" routes to Stripe and "bank" does
  // not — those are payment rails, not labels a provider can rename.
  const [rawMethod, setMethod] = useState<string>(parentMode ? "card" : PAY_METHODS[0]);
  // Two stages. Sorting out who's on which pass and picking everyone's lunches
  // at the same time is two jobs on one screen; the first has to be right
  // before the second even makes sense.
  // Operators walk the same road as parents — dates, children, extras, pay —
  // with one stage in front of it: whose booking this is. A parent already is
  // the parent, so they start at "who".
  const [ckStage, setCkStage] = useState<CkStage>(parentMode ? "who" : "parent");
  const [openMealKid, setOpenMealKid] = useState<string | null>(null); // which child's meal picker is expanded
  // The provider's own child questions, for the every-booking ones this stage
  // both asks and enforces.
  const { questions: ckQuestions, settings: ckSettings } = useTenantSettings(tenantId, d.id ?? undefined);
  // Settings arrive after first paint, so the state above starts on the
  // compiled-in default. Derive the one actually in force rather than
  // correcting the state afterwards: a booking must never be recorded against
  // a method the provider has removed, and there's no moment where the two
  // disagree if it's computed.
  // Card is always offered; other methods only if THIS listing accepts them
  // (d.payMethods). Undefined = accept everything the tenant offers (legacy).
  const allMethods: readonly string[] = ckSettings.payMethods.length ? ckSettings.payMethods : PAY_METHODS;
  // A parent can only pay by bank transfer if the provider has given somewhere to send it (the public settings carry just a yes/no).
  const bankReady = !!(ckSettings as unknown as { bankReady?: boolean }).bankReady;
  const cardReadyFlag = (ckSettings as unknown as { cardReady?: boolean }).cardReady;
  const payList: readonly string[] = allMethods
    .filter((m) => /card/i.test(m) || !d.payMethods || d.payMethods.includes(m))
    .filter((m) => !(parentMode && /bank|transfer/i.test(m) && !bankReady))
    // A provider who has not finished Stripe cannot take a card payment: do not offer Card to a parent (it would fail at Pay now).
    .filter((m) => !(parentMode && /^card$/i.test(m) && cardReadyFlag === false))
    // HAF (funded) places are arranged by the provider, never self-selected by a parent: a funded place is £0 only once the provider confirms it.
    .filter((m) => !(parentMode && /haf|funded/i.test(m)));
  // Voucher schemes with a reference filled in — the only ones a parent can
  // actually be sent to.
  const vouchers = liveVouchers(ckSettings.voucherProviders);
  const [voucherId, setVoucherId] = useState<string>("");
  // The parent's own payment reference per child (voucher/TFC), so the provider
  // can match the money in their bank. Forced before they can confirm.
  const [voucherRefs, setVoucherRefs] = useState<Record<string, string>>({});
  // ── Tax-Free Childcare ───────────────────────────────────────────────────
  // Linked accounts per child, how much of the total comes from HMRC, and how
  // the remainder is settled. The HMRC calls themselves live behind ./tfc so
  // the whole journey is here now and Amir swaps the stubs for the real API.
  const [tfcLinked, setTfcLinked] = useState<Record<string, string>>({});   // child → reference
  const [tfcConnecting, setTfcConnecting] = useState<string | null>(null);   // child whose GOV.UK hand-off is open
  const [tfcFail, setTfcFail] = useState<TfcFailure | null>(null);
  const [tfcAmount, setTfcAmount] = useState<string>("");                    // "" = the whole amount
  // How the remainder is settled. Whatever the provider accepts — not a fixed
  // card/bank pair — minus TFC itself, since that's the part being split off.
  const [tfcRest, setTfcRest] = useState<string>("card");
  const [tfcBalances, setTfcBalances] = useState<Record<string, TfcBalance>>({});   // child → account balance
  // Read each linked account's balance, so the family can see whether it covers
  // this booking before they promise to pay it.
  useEffect(() => {
    let stop = false;
    (async () => {
      for (const [child, ref] of Object.entries(tfcLinked)) {
        if (tfcBalances[child] || !ref) continue;
        const bal = await tfcBalance(ref);
        if (!stop && bal) setTfcBalances((m) => ({ ...m, [child]: bal }));
      }
    })();
    return () => { stop = true; };
  }, [tfcLinked, tfcBalances]);
  // The earliest day anyone is actually booked in — what the deadline has to
  // respect. Nothing dated (free-text sessions) leaves it undefined, which
  // the window handles.
  const firstDate = b.basket.flatMap((x) => x.dates).sort()[0];
  const vWindow = voucherWindow(new Date().toISOString(), firstDate, ckSettings.voucherHoldDays, ckSettings.voucherClearDays, ckSettings.voucherDueByDays);
  const chosenVoucher = vouchers.find((v) => v.id === voucherId) ?? null;
  // The right account/Ofsted/reference for THIS listing's registered setting.
  const voucherDetails = chosenVoucher ? detailsForListing(chosenVoucher, { listingId: d.id, locationId: d.venueId }) : [];
  // The parent's dropdown honours THIS listing's accepted methods (payList),
  // mapped to payment rails — not a hardcoded card/bank/cash.
  const parentOpts: [string, string][] = payList.map(parentMethodEntry).filter((e): e is [string, string] => !!e);
  // Show vouchers whenever the listing accepts them and a scheme has details to
  // quote. If it's too close for the money to clear, the deadline note below
  // still cautions the family — but the option no longer silently vanishes.
  if (payList.some((m) => /voucher/i.test(m)) && vouchers.length) parentOpts.push(["voucher", tr("p7ck.methodVouchers")]);
  // Tax-Free Childcare is only offered when HMRC can actually PAY this provider: their registered name, regulator registration number and postcode
  // (Setup > Tax-Free Childcare). Without them every payment would fail with "provider not added", so the option waits and the family is told why.
  const tfcBlocked = parentMode && parentOpts.some(([k]) => k === "tfc") && !tfcReady(ckSettings.childcare, ckSettings.providerName).ready;
  if (tfcBlocked) parentOpts.splice(parentOpts.findIndex(([k]) => k === "tfc"), 1);
  // A parent whose chosen method has been taken off the list (Card, when the provider has not finished Stripe) moves to the first one left.
  const method = parentMode
    ? (parentOpts.length === 0 || parentOpts.some(([k]) => k === rawMethod) ? rawMethod : parentOpts[0][0])
    : payList.includes(rawMethod) ? rawMethod : payList[0];
  // The full-page checkout scrolls itself, so the page underneath must stop —
  // otherwise there are two scrollbars and the outer one moves nothing you can
  // see. Restored on the way out, including if the tab closes mid-booking.
  useEffect(() => {
    if (!parentMode) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [parentMode]);
  const [extraIdx, setExtraIdx] = useState(0);
  // Per-day extras first, one-offs last: a t-shirt is a yes/no and belongs
  // after the choices that need thought.
  const ordered = [...addons].sort((m, n) => (m.type === "perday" ? 0 : 1) - (n.type === "perday" ? 0 : 1));
  const [saved, setSaved] = useState<ChildProfile[]>([]);
  // A link belongs to the CHILD, not to this checkout. Anyone who linked on a
  // previous booking comes back already connected — they shouldn't be sent to
  // HMRC a second time to be told what they already told it.
  // The saved reference always pre-fills the reference box. Whether the child
  // counts as LINKED is a separate question: with HMRC connected only the
  // server knows (a live sign-in for that child), because the manual path saves
  // a reference too — treating that as a link skipped the GOV.UK sign-in and
  // the payment then failed.
  useEffect(() => {
    const known = Object.fromEntries(saved.filter((c) => (c.tfcReference ?? "").trim()).map((c) => [c.name, c.tfcReference!.trim()]));
    if (Object.keys(known).length) setVoucherRefs((m) => ({ ...known, ...m }));
    if (!HMRC_CONNECTED) {
      if (Object.keys(known).length) setTfcLinked((m) => ({ ...known, ...m })); // a fresh link this session wins
      return;
    }
    let live = true;
    void linkedChildren().then((byId) => {
      if (!live) return;
      const linked = Object.fromEntries(saved.filter((c) => c.id && byId[c.id]).map((c) => [c.name, byId[c.id!]]));
      if (Object.keys(linked).length) setTfcLinked((m) => ({ ...linked, ...m }));
    });
    return () => { live = false; };
  }, [saved]);
  const { roster, setRoster } = b;
  // Store the EXCEPTIONS, not the assignments: who has been taken off which
  // day. A child is therefore on everything the moment they're added, with no
  // seeding step to go wrong — the previous version tracked "who's new" in a
  // ref mutated inside a setState updater, which React re-runs, so a newly
  // added child could be filtered straight back out.
  const [q, setQ] = useState("");
  const [showPasses, setShowPasses] = useState(false);
  // A family being created on the call. Held here until there's a server route
  // that can make the account — see §H of the backend handoff.
  const [np, setNp] = useState({ name: "", email: "", phone: "", address: "" });
  // Quick book needs only what is required to reserve the place and reach the family. Address is left to the parent.
  const npReady = np.name.trim().length > 1 && /.+@.+\..+/.test(np.email.trim()) && !!np.phone.trim();
  const matches = q.trim()
    // Find a family by parent name, email, phone, address OR a child's name.
    ? parents.filter((p) => `${p.name} ${p.email ?? ""} ${p.phone ?? ""} ${p.address ?? ""} ${(p.children ?? []).map((c) => c.name).join(" ")}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8)
    : [];
  useEffect(() => {
    if (!parentMode) return;
    // A signed-out parent 401s (fine — they type the details in), but a
    // TRANSIENT failure (a dropped dev-server socket, a flaky network) used to
    // be swallowed and leave "Your children" blank forever until an unrelated
    // re-render happened to refetch. Retry a few times so a one-off blip
    // recovers on its own rather than looking like the family has no children.
    let alive = true;
    const load = (tries = 0) => {
      apiGet<ChildProfile[]>("/api/my/children")
        .then((cs) => { if (alive) setSaved(cs); })
        .catch((e) => {
          // 401 = genuinely signed out; don't retry that. Anything else is worth another go.
          const status = (e as { status?: number })?.status;
          if (alive && status !== 401 && tries < 4) setTimeout(() => load(tries + 1), 700 * (tries + 1));
        });
    };
    load();
    return () => { alive = false; };
  }, [parentMode]);
  // An operator's "saved children" are the ones on the family they've just
  // found, so the same one-tap row works for them too.
  const savedFor = parentMode ? saved : (parents.find((p) => p.id === b.parent?.id)?.children ?? []);
  // Each rule's saving, broken down by the basket line that earned it.
  const savingsOn = (id: string) => {
    const i = b.basket.findIndex((x) => x.id === id);
    if (i < 0) return [] as { name: string; amount: number; terms?: string }[];
    return b.discountLines
      .map((l) => ({ name: l.name, terms: l.terms, amount: l.perItem?.[i] ?? 0 }))
      .filter((l) => l.amount > 0.004);
  };
  const addonById = new Map(addons.map((a) => [a.id, a]));
  const costOf = (a: AddonTemplate, days: string[]) => (a.type === "perday" ? a.price * days.length : a.price);
  // Per child, because that's what an add-on is: a lunch each, a t-shirt each.
  // The server already charges them per child (it prices one line per child),
  // so showing one lunch for two children quoted a price we wouldn't honour.
  // Each child's extras are chosen separately, so the total is simply the sum
  // of what was chosen — no head-count multiplier guessing on their behalf.
  const addonTotal = b.basket.reduce((sum, item) => {
    const kids = b.childrenOn(item.id);
    return sum + kids.reduce((t, kid) => {
      const sel = b.addonSel[b.addonKey(item.id, kid)] ?? {};
      return t + Object.entries(sel).reduce((n, [aid, days]) => {
        const a = addonById.get(aid);
        return a ? n + costOf(a, days) : n;
      }, 0);
    }, 0);
  }, 0);
  // Meals bought at checkout — priced from the listing's scheduled day-menu,
  // one item per child per day. Folds into the total like add-ons; the server
  // re-prices authoritatively (see /api/my/bookings items[].meals).
  const mealMenus = d.mealMenus ?? [];
  const mealPlanMap = d.mealPlan ?? {};
  const menuByIdCk = new Map(mealMenus.map((m) => [m.id, m]));
  // Only the dishes served that day (a menu subset) are orderable.
  const menuForDate = (date: string) => {
    const p = mealDayPlan(mealPlanMap[date]);
    const menu = p ? menuByIdCk.get(p.menuId) : undefined;
    return p && menu ? { id: menu.id, name: menu.name, items: dishesForDay(p, menu.items) } : undefined;
  };
  const mealItemAt = (date: string, itemId: string) => menuForDate(date)?.items.find((i) => i.id === itemId);
  // Every (child, day) the family could order a meal for — deduped so a child
  // on two lines the same day is counted once.
  const mealSlots: { kid: string; date: string }[] = [];
  if (d.mealsEnabled) {
    const seen = new Set<string>();
    for (const item of b.basket) for (const kid of b.childrenOn(item.id)) for (const date of item.dates) {
      const k = `${kid}|${date}`;
      if (!seen.has(k) && menuForDate(date)) { seen.add(k); mealSlots.push({ kid, date }); }
    }
  }
  const mealTotal = mealSlots.reduce((sum, { kid, date }) => { const sel = b.mealFor(kid, date); const it = sel ? mealItemAt(date, sel) : undefined; return it ? sum + it.price : sum; }, 0);
  const mealKids = [...new Set(mealSlots.map((s) => s.kid))];
  const fmtMealDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString(dl(), { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  // Copy one child's picks to every sibling (same date → same dish, since a
  // day's menu is the same for all children) — one tap for a big family.
  const copyMealsToAll = (fromKid: string) => { for (const { kid, date } of mealSlots) { if (kid === fromKid) continue; const src = b.mealFor(fromKid, date); if (src && mealItemAt(date, src)) b.pickMeal(kid, date, src); } };
  // "Same every Monday": apply this dish (matched by name, since later weeks may
  // use a different menu) to all this child's days of the same weekday.
  const applyEveryWeekday = (kid: string, fromDate: string, itemId: string) => {
    const wd = new Date(`${fromDate}T00:00:00Z`).getUTCDay();
    const name = mealItemAt(fromDate, itemId)?.name;
    if (!name) return;
    for (const { kid: k, date } of mealSlots) {
      if (k !== kid || new Date(`${date}T00:00:00Z`).getUTCDay() !== wd) continue;
      const match = menuForDate(date)?.items.find((i) => i.name === name);
      if (match) b.pickMeal(kid, date, match.id);
    }
  };
  // Apply this dish (by name) to every one of the child's days that has it.
  const applyAllDays = (kid: string, fromDate: string, itemId: string) => {
    const name = mealItemAt(fromDate, itemId)?.name;
    if (!name) return;
    for (const { kid: k, date } of mealSlots) { if (k !== kid) continue; const match = menuForDate(date)?.items.find((i) => i.name === name); if (match) b.pickMeal(kid, date, match.id); }
  };
  const calculated = b.total + addonTotal + mealTotal;
  // What the family would be offered the place(s) at if one opens: the pass price per child (at least one), before any code or credit.
  const waitOfferAmt = b.basket.reduce((s, x) => s + x.price * Math.max(1, b.childrenOn(x.id).length), 0);
  const grandTotal = b.totalOverride ?? calculated;
  const [overrideReason, setOverrideReason] = useState("");

  // Wallet credit the family holds with THIS provider. The server auto-applies
  // it at booking time (authoritative); here we just preview the reduction so
  // the parent sees what they'll actually owe. Zero until the backend lands.
  const [walletBalance, setWalletBalance] = useState(0);
  // How much of the wallet to spend on THIS booking. null = use all (the
  // default auto-apply); a number = the family chose to spend less and keep the
  // rest for another time.
  const [walletUse, setWalletUse] = useState<number | null>(null);
  useEffect(() => {
    if (!parentMode || !tenantId) {
      setWalletBalance(0);
      return;
    }
    apiGet<{ balances: { tenantId: string; balance: number }[] }>("/api/my/wallet")
      .then((r) => setWalletBalance((r?.balances ?? []).find((x) => x.tenantId === tenantId)?.balance ?? 0))
      .catch(() => {});
  }, [tenantId]);

  // The parent's contact phone. Prefilled from what the provider has on file
  // (e.g. from a bulk import); if they've none, the family enters it here — a
  // booking needs a contact number, so it's required before they can book.
  const [phone, setPhone] = useState("");
  const [phonePrefilled, setPhonePrefilled] = useState(false);
  // A real number has at least 10 digits; "44" (just the UK code) came from sign-up and is not one.
  const phoneOk = phone.replace(/\D/g, "").length >= 10;
  const [editPhone, setEditPhone] = useState(false);
  useEffect(() => {
    if (!parentMode || !tenantId) return;
    apiGet<{ phone: string; from?: string }>(`/api/my/contact?tenantId=${encodeURIComponent(tenantId)}`)
      .then((r) => { if (r?.phone?.trim()) { setPhone(r.phone.trim()); setPhonePrefilled(r.from !== "account"); } })
      .catch(() => {});
  }, [parentMode, tenantId]);

  // ── Home-visit service address ──────────────────────────────────────────
  // For a home-visit (or "both") listing, checkout needs to know where THIS
  // session actually happens — defaults to the parent's saved account address,
  // editable here (e.g. booking a session at a grandparent's house). The
  // server re-validates the postcode against the provider's coverage area
  // before the booking is allowed to complete.
  const homeVisit = d.deliveryMode === "home-visit" || d.deliveryMode === "both";
  const [serviceAddress, setServiceAddress] = useState({ address: "", postcode: "", notes: "" });
  // The saved account address is OFFERED first ("is this where you want us to come?"); null = none saved. useSaved: null = not answered yet.
  const [savedAddr, setSavedAddr] = useState<{ address: string; postcode: string } | null>(null);
  const [useSaved, setUseSaved] = useState<boolean | null>(null);
  // A saved address with no house number/name (or a missing town) can't be offered with "Yes, come here": the provider could not find the door.
  // The family completes it right here, and it is saved back to their account.
  const savedIncomplete = !!savedAddr && !isFullAddress(savedAddr.address, savedAddr.postcode);
  const [fix, setFix] = useState<AddressParts | null>(null);
  const [fixBusy, setFixBusy] = useState(false);
  const [fixErr, setFixErr] = useState<string | null>(null);
  const fixParts: AddressParts = fix ?? splitAddress(savedAddr?.address ?? "", savedAddr?.postcode ?? "");
  async function saveFix() {
    const addr = composeAddress(fixParts);
    if (!isFullAddress(addr, fixParts.postcode)) { setFixErr(tr("p7ck.adrIncomplete")); return; }
    setFixBusy(true); setFixErr(null);
    try {
      await apiPut("/api/account", { address: addr, postcode: fixParts.postcode.trim().toUpperCase() });
      const pc = fixParts.postcode.trim().toUpperCase();
      setSavedAddr({ address: addr, postcode: pc });
      setServiceAddress((s) => ({ ...s, address: addr, postcode: pc }));
      setUseSaved(true);
    } catch (e) { setFixErr(e instanceof Error ? e.message : tr("p7ck.adrIncomplete")); }
    setFixBusy(false);
  }
  const askSaved = homeVisit && !!savedAddr && useSaved === null;
  const [addressPrefilled, setAddressPrefilled] = useState(false);
  // The postcode step: recognised by the SERVER (real UK postcode + the town it is in + inside this provider's area), shown as the family types.
  type PcState = { status: "idle" | "checking" | "ok" | "bad" | "unsure"; msg?: string; pc?: string; area?: string };
  const [pcState, setPcState] = useState<PcState>({ status: "idle" });
  useEffect(() => {
    if (!homeVisit) return;
    const raw = serviceAddress.postcode.trim();
    if (!raw) { setPcState({ status: "idle" }); return; }
    if (!/^[A-Za-z]{1,2}\d[A-Za-z\d]?\s?\d[A-Za-z]{2}$/.test(raw)) {
      // not shaped like a postcode (yet): only complain once there is enough typed to be a full one
      setPcState(raw.replace(/\s/g, "").length >= 6 ? { status: "bad", msg: tr("p7ck.pcFormat") } : { status: "idle" });
      return;
    }
    setPcState({ status: "checking" });
    let alive = true;
    const id = setTimeout(() => {
      apiGet<{ ok: boolean; code?: string; postcode?: string; area?: string }>(`/api/my/postcode-check?postcode=${encodeURIComponent(raw)}${d.id ? `&listingId=${encodeURIComponent(d.id)}` : ""}`)
        .then((r) => {
          if (!alive) return;
          if (r.ok) setPcState({ status: "ok", pc: r.postcode, area: r.area });
          else if (r.code === "outside") setPcState({ status: "bad", msg: tr("p7ck.pcOutside", { pc: r.postcode ?? raw, area: r.area ? ` (${r.area})` : "" }) });
          else setPcState({ status: "bad", msg: tr(r.code === "format" ? "p7ck.pcFormat" : "p7ck.pcNotFound") });
        })
        // the check itself failed (network): don't block the family - the server enforces it again when they book
        .catch(() => alive && setPcState({ status: "unsure" }));
    }, 450);
    return () => { alive = false; clearTimeout(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeVisit, serviceAddress.postcode, d.id]);
  useEffect(() => {
    if (!parentMode || !homeVisit) return;
    apiGet<{ address?: string; postcode?: string }>("/api/account")
      .then((r) => {
        if (r?.address?.trim() || r?.postcode?.trim()) {
          setServiceAddress((s) => ({ ...s, address: r.address?.trim() ?? "", postcode: r.postcode?.trim() ?? "" }));
          setAddressPrefilled(true);
          if (r.postcode?.trim()) setSavedAddr({ address: r.address?.trim() ?? "", postcode: r.postcode.trim() });
        }
      })
      .catch(() => {});
  }, [parentMode, homeVisit]);
  // ── Discount code (parent only) ─────────────────────────────────────────
  // A parent can type a code or one-tap one of their own coupons. We validate it
  // against the SAME engine the charge uses (/api/discounts/validate → shared
  // lib/discountCodes) so the saving previewed here is exactly what's taken off.
  const attendees = Math.max(1, new Set(b.basket.flatMap((x) => b.childrenOn(x.id))).size);
  type MyCoupon = { code: string; type: "percent" | "amount" | "perAttendee"; value: number; tenantId: string; listingId: string | null; membership?: boolean };
  type Applied = { code: string; off: number; exclusive: boolean };
  const [myCoupons, setMyCoupons] = useState<MyCoupon[]>([]);
  const [codeInput, setCodeInput] = useState("");
  // Codes STACK by default; a code flagged `exclusive` can't sit alongside others.
  const [appliedCodes, setAppliedCodes] = useState<Applied[]>([]);
  const [codeErr, setCodeErr] = useState<string | null>(null);
  const [codeBusy, setCodeBusy] = useState(false);
  useEffect(() => {
    if (!parentMode || !tenantId) { setMyCoupons([]); return; }
    apiGet<MyCoupon[]>("/api/my/coupons")
      .then((list) => setMyCoupons((list ?? []).filter((c) => c.tenantId === tenantId && (!c.listingId || c.listingId === d.id))))
      .catch(() => {});
  }, [parentMode, tenantId, d.id]);
  // Any change to the basket total or head-count invalidates checked codes.
  useEffect(() => { setAppliedCodes([]); setCodeErr(null); }, [grandTotal, attendees]);
  const isApplied = (code: string) => appliedCodes.some((a) => a.code === code.toUpperCase());
  function removeCode(code: string) { setAppliedCodes((a) => a.filter((x) => x.code !== code.toUpperCase())); setCodeErr(null); }
  async function applyCode(raw: string) {
    const code = raw.trim().toUpperCase();
    if (!code || !tenantId) return;
    if (isApplied(code)) { removeCode(code); return; } // tapping an applied code removes it
    setCodeBusy(true); setCodeErr(null);
    try {
      const r = await api<{ valid: boolean; reason?: string; code?: string; off?: number; exclusive?: boolean }>("/api/discounts/validate", {
        method: "POST",
        // b.total, NOT grandTotal. The server applies a code to the pass
        // subtotal after automatic discounts and excluding add-ons and meals
        // (server/src/routes/my.ts:982 — checkCode(l.data, discounted, …)),
        // and b.total is that same figure. Previewing against the whole basket
        // quoted a bigger saving than the booking actually took, so the parent
        // was charged more than the screen said.
        body: JSON.stringify({ tenantId, code, subtotal: b.total, attendees, ...(d.id ? { listingId: d.id } : {}) }),
      });
      if (!r.valid || !r.off || r.off <= 0) { setCodeErr(r.reason ? translateApiMessage(r.reason) : tr("p7ck.codeNoUse")); return; }
      // Exclusivity: an exclusive code can't join others, and can't be added when others are already on.
      if (appliedCodes.length && (r.exclusive || appliedCodes.some((a) => a.exclusive))) {
        setCodeErr(tr("p7ck.codeNoCombine", { code: r.exclusive ? (r.code ?? code) : appliedCodes.find((a) => a.exclusive)!.code }));
        return;
      }
      setAppliedCodes((a) => [...a, { code: r.code ?? code, off: r.off!, exclusive: !!r.exclusive }]);
      setCodeInput("");
    } catch (e) { setCodeErr(e instanceof Error ? e.message : tr("p7ck.codeCheckFail")); }
    finally { setCodeBusy(false); }
  }
  // Capped at the pass subtotal, matching the server's own cap
  // (my.ts:987 — totalOff = Math.min(totalOff, discounted)). A code can never
  // eat into add-ons or meals, so it must not appear to here either.
  const codeOff = Math.min(appliedCodes.reduce((s, a) => s + a.off, 0), b.total);

  // A friend arriving via a referral link (/store/:id?ref=CODE) gets the code
  // applied automatically — stashed in sessionStorage so it survives navigation
  // into the wizard. Tried once, when the total is known.
  const triedRef = useRef(false);
  useEffect(() => {
    if (!parentMode || triedRef.current || grandTotal <= 0 || appliedCodes.length) return;
    let code: string | null = null;
    try {
      const fromUrl = new URLSearchParams(window.location.search).get("ref");
      if (fromUrl) { code = fromUrl; sessionStorage.setItem("aos.ref", fromUrl); }
      else code = sessionStorage.getItem("aos.ref");
    } catch { /* no storage → nothing to auto-apply */ }
    if (code) { triedRef.current = true; void applyCode(code); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentMode, grandTotal]);

  // A member's standing % perk auto-applies on top of everything (it stacks —
  // that's the point of paying for the membership). Applied once, when the
  // family's coupons + total are known.
  const triedMembership = useRef(false);
  useEffect(() => {
    if (!parentMode || triedMembership.current || grandTotal <= 0) return;
    const perk = myCoupons.find((c) => c.membership);
    if (!perk || isApplied(perk.code)) return;
    triedMembership.current = true;
    void applyCode(perk.code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentMode, grandTotal, myCoupons]);

  // Order of deductions mirrors the server: automatic discounts (already in
  // grandTotal) → discount code → wallet credit.
  const afterCode = Math.max(0, grandTotal - codeOff);
  // Most that could come off this booking from the wallet (can't exceed what's
  // owed after codes). Auto-apply spends all of it; the family can dial it back.
  // Joining a waiting list spends nothing (the server leaves the wallet alone for a queued place), so don't show credit as used.
  const walletAvail = b.waitlistOnly ? 0 : Math.min(walletBalance, afterCode);
  const walletApplied = walletUse === null ? walletAvail : Math.max(0, Math.min(walletUse, walletAvail));
  const amountDue = Math.max(0, afterCode - walletApplied);
  // What makes a pass valid depends on how it was sold.
  //
  //   fixed block / any-N-days-in-a-week — the days are the pass, so at least
  //     one child has to be on all of them. Otherwise it's a shorter pass
  //     bought at the wrong price.
  //   any-N-days-across-the-run — the days are independent, so each one just
  //     needs somebody on it; it needn't be the same child throughout.
  // A pass is a block: a child is on all of its days or none. So the only
  // thing to check is that somebody is on each line.
  const shortPasses = b.basket.filter((x) => b.childrenOn(x.id).length === 0);
  // Voucher/TFC references are asked only for children who are actually on a pass in the basket.
  const refKids = roster.filter((c) => b.basket.some((x) => b.childrenOn(x.id).includes(c.name.trim())));

  // Overlapping passes: a 5 day pass covering the 27th–31st and a 4 day pass
  // covering the 28th–31st are easy to end up with, and nobody can attend the
  // same day twice — they'd be paying for it twice.
  const clashes = (() => {
    // Two sessions in one day are fine — a morning club and an afternoon one —
    // so this asks whether the times overlap, not just whether the dates match.
    const mins = (t?: string) => {
      if (!t) return null;
      const [h, m] = t.split(":").map(Number);
      return Number.isFinite(h) ? h * 60 + (m || 0) : null;
    };
    const overlaps = (a: BasketItem, c: BasketItem) => {
      const a1 = mins(a.start), a2 = mins(a.finish), c1 = mins(c.start), c2 = mins(c.finish);
      // Unknown times: treat as a clash rather than wave through a double
      // booking we can't rule out.
      if (a1 === null || a2 === null || c1 === null || c2 === null) return true;
      return a1 < c2 && c1 < a2;
    };
    const byChildDate = new Map<string, BasketItem[]>();
    for (const x of b.basket) {
      for (const name of b.childrenOn(x.id)) {
        for (const iso of x.dates) {
          const key = `${name}|${iso}`;
          byChildDate.set(key, [...(byChildDate.get(key) ?? []), x]);
        }
      }
    }
    const out: { name: string; iso: string; itemIds: string[] }[] = [];
    for (const [key, items] of byChildDate) {
      if (items.length < 2) continue;
      const hit = new Set<string>();
      for (let i = 0; i < items.length; i++)
        for (let j = i + 1; j < items.length; j++)
          if (overlaps(items[i], items[j])) { hit.add(items[i].id); hit.add(items[j].id); }
      if (!hit.size) continue;
      const [name, iso] = key.split("|");
      out.push({ name, iso, itemIds: [...hit] });
    }
    return out;
  })();
  const clashesOn = (id: string) => clashes.filter((c) => c.itemIds.includes(id));

  // Children who already hold a live place on a chosen date of THIS listing.
  // The server refuses it at Pay time (kept as the backstop); catching it on the
  // Children step saves the family a dead end. Signed-out / failed read = no warning.
  const [myBookings, setMyBookings] = useState<{ ref: string; status?: string; listingId?: string; timing?: string; child?: string; days?: string[]; kids?: { name: string; dates?: string[]; days?: string[]; cancelled?: boolean; cancelledDays?: string[] }[] }[]>([]);
  useEffect(() => {
    if (!parentMode || !d.id) return;
    let live = true;
    apiGet<typeof myBookings>("/api/my/bookings").then((r) => { if (live && Array.isArray(r)) setMyBookings(r); }).catch(() => {});
    return () => { live = false; };
  }, [parentMode, d.id]);
  const existingClashes = (() => {
    if (!parentMode || !myBookings.length) return [] as { name: string; iso: string; itemIds: string[]; ref: string }[];
    const dead = new Set(["cancelled", "declined", "waitlisted", "offered", "refunded"]);
    const tm = (t?: string) => (t ?? "").trim().toLowerCase();
    const held = new Map<string, string>(); // "child|iso|timing" -> booking ref
    for (const bk of myBookings) {
      if (bk.listingId !== d.id || dead.has(tm(bk.status))) continue;
      const rows = bk.kids && bk.kids.length
        ? bk.kids.filter((k) => !k.cancelled).map((k) => ({ child: k.name, days: (k.dates ?? k.days ?? bk.days ?? []).filter((x) => !(k.cancelledDays ?? []).includes(x)) }))
        : [{ child: bk.child ?? "", days: bk.days ?? [] }];
      for (const r of rows) for (const iso of r.days) held.set(`${tm(r.child)}|${iso}|${tm(bk.timing)}`, bk.ref);
    }
    const out: { name: string; iso: string; itemIds: string[]; ref: string }[] = [];
    for (const x of b.basket) {
      for (const name of b.childrenOn(x.id)) {
        for (const iso of x.dates) {
          // A different timing on the same day is a different session (as on the server).
          const ref = held.get(`${tm(name)}|${iso}|${tm(x.timing)}`) ?? held.get(`${tm(name)}|${iso}|`);
          if (ref) out.push({ name, iso, itemIds: [x.id], ref });
        }
      }
    }
    return out;
  })();
  const existingOn = (id: string) => existingClashes.filter((c) => c.itemIds.includes(id));
  const unassigned = shortPasses.length;
  // A ticket with its own age range: any child put on it who is outside the range. Blocks Confirm (or, when the listing takes out-of-range children,
  // just warns that the place becomes a request). Only tickets that set their own range are checked here: the listing-wide range is on the child cards.
  const ticketAgeIssues = b.basket.flatMap((x) =>
    b.childrenOn(x.id).flatMap((name) => {
      const c = roster.find((r) => r.name.trim() === name);
      if (!c || !ticketAgeRange(d, x.name).own) return [];
      const out = outsideTicketRange(d, c, x.name);
      return out ? [{ itemId: x.id, name, ticket: x.name, from: out.from, to: out.to }] : [];
    }),
  );
  const ticketAgeBlocks = !d.allowOutOfRange && ticketAgeIssues.length > 0;
  const ticketAgeText = (i: { name: string; ticket: string; from: number; to: number }) =>
    tr("p9tx.ckTicketAge", { name: i.name, ticket: i.ticket, from: Number.isFinite(i.from) ? i.from : "", to: Number.isFinite(i.to) ? i.to : "" });
  // Per-pass fine control stays tucked away unless something on a pass needs fixing.
  const passesForced = roster.length > 0 && (unassigned > 0 || clashes.length > 0 || existingClashes.length > 0);
  const passesOpen = showPasses || passesForced;
  // A server error describes the basket as it was when Pay was pressed. The moment
  // the basket, the dates or the children change it is out of date, so hide it
  // (it comes back if Pay is pressed again and is still true).
  const basketSig = JSON.stringify([b.basket.map((x) => [x.id, x.dates]), b.rosterNames, b.basket.map((x) => b.childrenOn(x.id))]);
  const [errSeen, setErrSeen] = useState<{ err: string | null; sig: string }>({ err: null, sig: "" });
  useEffect(() => {
    const e = booking?.error ?? null;
    setErrSeen((cur) => (cur.err === e ? cur : { err: e, sig: basketSig }));
  }, [booking?.error, basketSig]);
  const errFresh = errSeen.err !== (booking?.error ?? null) || errSeen.sig === basketSig;
  // A booking that has just been created must not leave its basket behind: the
  // same days would clash with the bookings that now exist (and the family
  // could pay twice). When a request finishes without an error, empty it.
  const wasBusy = useRef(false);
  useEffect(() => {
    const busy = !!booking?.busy;
    if (wasBusy.current && !busy && !booking?.error) b.reset();
    wasBusy.current = busy;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?.busy, booking?.error]);
  const label = { fontSize: 10, letterSpacing: "0.12em" } as const;

  // Where we are in the sequence: dates, children, one step per extra, pay.
  // Each extra is named, because "Extra 2" tells a parent looking for the
  // t-shirt nothing at all.
  const hasMeals = !!d.mealsEnabled && mealSlots.length > 0;
  const steps = [
    "Dates",
    ...(parentMode ? [] : ["Parent"]),
    "Children",
    ...ordered.map((a) => a.name),
    ...(hasMeals ? ["Meals"] : []),
    parentMode ? "Pay" : "Payment",
  ];
  // The step names double as identifiers (the "Meals" pill is styled by name), so translate at display time only.
  const tfcCopy = (f: keyof typeof TFC_FAILURE_COPY, part: "title" | "detail") => { const k = (TFC_COPY_STEM as Record<string, string>)[f]; return k ? tr(`p7ck.${k}_${part}`) : TFC_FAILURE_COPY[f][part]; };
  const stepLabel = (n: string) => ({ Dates: tr("p7ck.stepDates"), Parent: tr("p7ck.stepParent"), Children: tr("p7ck.stepChildren"), Meals: tr("p7ck.stepMeals"), Pay: tr("p7ck.stepPay"), Payment: tr("p7ck.stepPayment") } as Record<string, string>)[n] ?? n;
  /** Where "Children" sits — one further along for an operator. */
  const whoAt = parentMode ? 1 : 2;
  const mealsAt = whoAt + 1 + ordered.length; // index of the "Meals" step (only valid when hasMeals)
  const stepNow = ckStage === "parent" ? 1
    : ckStage === "who" ? whoAt
    : ckStage === "extras" ? whoAt + 1 + extraIdx
    : ckStage === "meals" ? mealsAt
    : steps.length - 1;
  // Anything already passed can be jumped straight back to. Forward is not
  // offered: the extras depend on who is on which pass, so skipping ahead
  // would ask a question whose answer isn't settled yet.
  const goStep = (i: number) => {
    if (i >= stepNow) return;
    if (i === 0) { b.setStage("pick"); return; }
    if (!parentMode && i === 1) { setCkStage("parent"); return; }
    if (i === whoAt) { setCkStage("who"); return; }
    if (hasMeals && i === mealsAt) { setCkStage("meals"); return; }
    if (i === steps.length - 1) { setCkStage("pay"); return; }
    setExtraIdx(i - whoAt - 1);
    setCkStage("extras");
  };

  // Past the dates the checkout is the whole page, so children and their days
  // lay out across instead of down — a family of three across two weeks was a
  // long scroll in a 340px column.
  return (
    <>
    {/* Past the dates the checkout takes the whole page. The listing has done
        its job by then, and a half-visible page behind competes with the thing
        being filled in. */}
    {parentMode && <div className="fixed inset-0 z-30" style={{ background: tk.bg }} aria-hidden />}
    <div
      className={parentMode
        ? "fixed inset-0 z-40 overflow-y-auto px-5 py-6 sm:px-8"
        : "p-5"}
      style={{ background: tk.bg }}>
      <div className={parentMode ? "mx-auto w-full max-w-[900px]" : ""}>
      {/* The whole route, named and walkable. A single "Change lunches &
          extras" meant a parent who wanted the t-shirt had to re-walk the
          lunches to reach it. Signed-in parents also get their dashboard links
          to the right of the steps, reachable from every step. */}
      {(steps.length > 0 || parentMode) && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {steps.map((name, i) => {
            const done = i < stepNow, now = i === stepNow;
            return (
              <button key={`${name}-${i}`} type="button" onClick={() => goStep(i)} disabled={i > stepNow}
                title={done ? tr("p7ck.backTo", { step: stepLabel(name) }) : stepLabel(name)}
                className={`border-2 px-2.5 py-1 text-[11.5px] font-extrabold transition-colors ${tk.round} ${name === "Meals" ? "animate-pulse" : ""}`}
                style={name === "Meals"
                  ? { borderColor: "#38bdf8", background: now ? "#38bdf8" : "#38bdf826", color: now ? "#042a3d" : "#7dd3fc" }
                  : now
                  ? { borderColor: tk.accent, background: tk.accent, color: tk.accentInk }
                  : done
                    ? { borderColor: `${tk.ink}59`, color: tk.ink, background: "transparent", cursor: "pointer" }
                    : { borderColor: tk.line, color: tk.muted, background: "transparent" }}>
                {done && <span aria-hidden>← </span>}{stepLabel(name)}
              </button>
            );
          })}
          {parentMode && (
            <span className="ms-auto flex items-center gap-3 text-[12px] font-extrabold">
              <Link href="/custdash" className="underline" style={{ color: tk.accent }}>{tr("p7ck.myHomePage")}</Link>
              <Link href="/custdash/bookings" className="underline" style={{ color: tk.accent }}>{tr("p7ck.myBookings")}</Link>
            </span>
          )}
        </div>
      )}
      {/* What's being booked. For a parent this is already spelled out on each
          line below — pass, dates, timing, price — so listing it again here was
          the same information twice. */}
      {!parentMode && ckStage === "pay" && (
        <div className="flex flex-col gap-2">
        {b.basket.map((x) => (
          <div key={x.id} className="flex items-start justify-between gap-3 text-[12.5px]">
            <span className="min-w-0">
              <b className="block" style={{ color: tk.ink }}>{x.name}</b>
              <span className="block text-[11px] leading-snug" style={{ color: tk.muted }}>
                {b.datesPretty(x.dates)}
              </span>
              {x.timing && <span className="block text-[11px] font-bold" style={{ color: tk.accent }}>🕘 {x.timing}</span>}
            </span>
            {parentMode ? (
              <b className="flex-none text-[12.5px]" style={{ color: tk.ink }}>{money(b.priceOf(x))}</b>
            ) : (
              <span className="flex flex-none items-center gap-1">
                <span className="text-[11px]" style={{ color: tk.muted }}>£</span>
                <input type="number" min={0} step="0.01" value={b.priceOf(x)}
                  onChange={(e) => b.setItemPrice(x.id, e.target.value === "" ? null : parseFloat(e.target.value))}
                  className={`w-[74px] border px-2 py-1 text-end text-[12.5px] font-bold outline-none ${tk.round}`}
                  style={{ background: tk.inputBg, borderColor: b.priceEdit[x.id] !== undefined ? tk.accent : tk.line, color: tk.ink }} />
              </span>
            )}
          </div>
        ))}
        {!parentMode && <div className="text-[10.5px]" style={{ color: tk.muted }}>{tr("p7ck.pricesEditable")}</div>}
      </div>
      )}

      {/* Whose booking this is — operators only; a parent is already themselves.
          Two routes, said out loud: the family exists, or you're creating them.
          The second needs details the operator has to ask for on the call, so
          it says which ones before they start rather than after. */}
      {parentMode || ckStage !== "parent" ? null : b.parent ? (
        <div className={`mt-4 flex items-center gap-2 border px-3 py-2 ${tk.round}`} style={{ borderColor: tk.accent, background: `${tk.accent}1a` }}>
          <span className="flex-1 text-[12.5px] font-bold" style={{ color: tk.ink }}>
            {b.parent.name}
            {b.parent.id === "new" && <span className="ms-1.5 text-[11px] font-normal" style={{ color: tk.muted }}>{tr("p7ck.newAccount")}</span>}
          </span>
          <button type="button" onClick={() => b.setParent(null)} className="text-[11.5px] font-bold" style={{ color: tk.muted }}>{tr("p7ck.changeWord")}</button>
        </div>
      ) : (
        <>
          <div className="mt-3 font-bold uppercase" style={{ ...label, color: tk.ink }}>{tr("p7ck.whoseBooking")}</div>

          <div className={`mt-1.5 border p-2.5 ${tk.round}`} style={{ borderColor: tk.line }}>
            <div className="text-[12px] font-extrabold" style={{ color: tk.ink }}>{tr("p7ck.optAlready")}</div>
            <div className="mb-1.5 mt-0.5 text-[11px] leading-[1.4]" style={{ color: tk.muted }}>{tr("p7ck.optAlreadyBody")} <span title={tr("p7ck.regOnlyTip")}>{tr("p7ck.regOnlyUse2")}</span></div>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("p9tx.ckSearchPh")}
              className={`w-full border px-3 py-2 text-[13px] outline-none ${tk.round}`} style={{ background: tk.inputBg, borderColor: tk.line, color: tk.ink }} />
            <div className="mt-1 text-[11px]" style={{ color: parentsState === "error" ? "#fca5a5" : tk.ink }}>
              {parentsState === "loading"
                ? tr("p7ck.loadingParents")
                : parentsState === "error"
                  ? tr("p7ck.errParentsN", { err: parentsError ?? "" })
                  : parents.length === 0
                    ? tr("p7ck.noFamilies")
                    : pickPlural(tr, locale, "p7ck.familiesN", parents.length)}
            </div>
            {q.trim() && (
              <div className="mt-1.5 flex flex-col gap-1">
                {matches.map((p) => (
                  <button key={p.id} type="button" onClick={() => { b.setParent(p); setQ(""); }}
                    className={`border px-3 py-2 text-start text-[12.5px] ${tk.round}`} style={{ borderColor: tk.line, color: tk.ink }}>
                    <b>{p.name}</b>{p.email ? <span className="ms-1.5 text-[11px]" style={{ color: tk.muted }}>{p.email}</span> : null}
                    {(p.phone || p.address) && (
                      <div className="mt-0.5 text-[11px]" style={{ color: tk.muted }}>{[p.phone, p.address].filter(Boolean).join(" · ")}</div>
                    )}
                    {(p.children?.length ?? 0) > 0 && (
                      <div className="mt-0.5 text-[11px] font-semibold" style={{ color: tk.ink }}>
                        Children: {(p.children ?? []).map((c) => c.name).join(", ")}
                      </div>
                    )}
                  </button>
                ))}
                {matches.length === 0 && (
                  <div className="text-[11px]" style={{ color: tk.muted }}>{tr("p7ck.nobodyByName")}</div>
                )}
              </div>
            )}
          </div>

          <HowItWorks
            tour={
              <div className="grid gap-4 md:grid-cols-[1fr_340px]">
                <div className="max-w-[560px] text-[12.5px] leading-[1.6]">
                  <p><Rich text={tr("p9tx.ckTakeFor1")} /></p>
                  <p className="mt-1.5"><Rich text={tr("p9tx.ckTakeFor2")} /></p>
                </div>
                <video src="/v2/video/take-a-booking.mp4" controls preload="metadata" className="w-full self-start rounded-lg border border-[var(--line)] bg-black" aria-label={tr("p9tx.ckTakeForVideo")} />
              </div>
            }
          />
          <div className={`mt-2 border p-2.5 ${tk.round}`} style={{ borderColor: tk.line }}>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <div className="text-[12px] font-extrabold" style={{ color: tk.ink }}>{tr("p7ck.optElse")}</div>
              <div className="text-[11px] leading-[1.4]" style={{ color: tk.muted }} title={tr("p7ck.optElseTip")}>{tr("p7ck.optElseBody")}</div>
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              {(["name", "email", "phone"] as const).map((k) => (
                <div key={k} className={k === "name" ? "col-span-2" : ""}>
                  <div className="mb-0.5 text-[10px] font-bold" style={{ color: tk.muted }}>
                    {{ name: tr("p7ck.fldName"), email: tr("p7ck.fldEmail"), phone: tr("p7ck.fldPhone") }[k]}
                  </div>
                  <input value={np[k]} onChange={(e) => setNp({ ...np, [k]: e.target.value })}
                    className={`aos-in w-full border px-2.5 py-1.5 text-[12.5px] outline-none ${tk.round}`}
                    style={{ background: tk.inputBg, borderColor: `${tk.ink}4d`, color: tk.ink }} />
                </div>
              ))}
            </div>
            {/* A mistyped address creates an account for a stranger holding a
                child's name and date of birth, so it gets read back. */}
            {npReady && (
              <div className={`mb-2 border px-3 py-2 text-[11.5px] leading-[1.5] ${tk.round}`}
                style={{ borderColor: tk.accent, background: `${tk.accent}1a`, color: tk.ink }}>
                <Rich text={tr("p8lst.ck8LoginGoesTo", { email: np.email.trim() })} bClass="" />
              </div>
            )}
            <button type="button" disabled={!npReady}
              onClick={() => b.setParent({ id: "new", name: np.name.trim(), email: np.email.trim(), phone: np.phone.trim() })}
              className={`w-full py-2 text-[12.5px] font-extrabold disabled:opacity-40 ${tk.round}`}
              style={{ background: tk.accent, color: tk.accentInk }}>
              {npReady ? tr("p7ck.setUpName", { name: np.name.trim() }) : tr("p9tx.ckFillNp")}
            </button>
          </div>
        </>
      )}

      {!parentMode && ckStage === "parent" && (
        <button type="button" disabled={!b.parent} onClick={() => setCkStage("who")}
          className={`mt-3 w-full py-2.5 text-[13px] font-extrabold disabled:opacity-40 ${tk.round}`}
          style={{ background: tk.accent, color: tk.accentInk }}>
          {b.parent ? tr("p7ck.bookForName", { name: b.parent.name }) : tr("p7ck.findParentFirst")}
        </button>
      )}

      {/* 2 · a child and their extras, per pass */}
      {ckStage === "who" && (
        <>
          {(
            <ChildrenPanel d={d} tk={tk} tenantId={tenantId} saved={savedFor} roster={roster} setRoster={setRoster} canSave={parentMode}
              comingCount={(name) => b.basket.filter((x) => b.childrenOn(x.id).includes(name)).length}
                      onUnassignAll={(name) => b.basket.forEach((x) => { if (b.childrenOn(x.id).includes(name)) b.toggleChild(x.id, name); })}
              onAdded={(name) => b.clearRemovalsFor(name)}
 />
          )}
          {roster.length > 0 && (() => {
            const days = new Set(b.basket.flatMap((x) => x.dates)).size;
            return (
              <div className="mt-3 text-[15px] font-bold" style={{ color: tk.ink }} data-ui="who-status">
                {b.waitlistOnly
                  ? tr("p7ck.waitStatus", { kids: pickPlural(tr, locale, "p7ck.kidsN", roster.length), days: pickPlural(tr, locale, "p7ck.daysN", days), amt: money(waitOfferAmt) })
                  // Children are added before they are put on a pass: until then the total reads £0.00, which looks like a free booking. Show the price instead.
                  : tr("p7ck.whoStatus", { kids: pickPlural(tr, locale, "p7ck.kidsN", roster.length), days: pickPlural(tr, locale, "p7ck.daysN", days), amt: money(b.total > 0 || b.basket.length === 0 ? b.total : waitOfferAmt) })}
              </div>
            );
          })()}
          {roster.length > 0 && !passesOpen && (
            <button type="button" onClick={() => setShowPasses(true)} className="mt-1.5 py-2 text-[14px] font-bold underline underline-offset-2" style={{ color: tk.muted }}>
              {tr("p7ck.chooseDaysEach")}
            </button>
          )}
          {roster.length > 0 && passesOpen && !passesForced && (
            <button type="button" onClick={() => setShowPasses(false)} className="mt-1.5 py-2 text-[14px] font-bold underline underline-offset-2" style={{ color: tk.muted }}>
              {tr("p7ck.hideDaysEach")}
            </button>
          )}

          {passesOpen && (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {b.basket.map((x) => {
              return (
                // Quietly raised off the page — a lighter panel and a single
                // hairline. Enough to separate three passes without decorating
                // them.
                <div key={x.id} className={`p-4 ${tk.round}`}
                  style={{ background: tk.inputBg, border: `2px solid ${tk.muted}55` }}>
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 text-[11.5px]" style={{ color: tk.muted }}>
                      <b style={{ color: tk.ink }}>{x.name}</b> · {b.datesPretty(x.dates)}
                      {x.timing && <span className="block text-[11px] font-bold" style={{ color: tk.accent }}>🕘 {x.timing}</span>}
                    </span>
                    {(() => {
                      const heads = b.childrenOn(x.id).length;
                      return (
                        <span className="flex-none text-end text-[12px]">
                          <b style={{ color: tk.ink }}>{money(b.priceOf(x) * heads)}</b>
                          {heads > 1 && <span className="block text-[10.5px]" style={{ color: tk.muted }}>{money(b.priceOf(x))} × {heads}</span>}
                        </span>
                      );
                    })()}
                    <button type="button" onClick={() => b.removeItem(x.id)}
                      title={x.dates.length === 1 ? tr("p7ck.removeDay") : tr("p7ck.removePassN", { n: x.dates.length })}
                      className="flex-none px-1 text-[15px] leading-none"
                      style={{ color: tk.muted }}>×</button>
                  </div>

                  {/* Every day, not just the first few — you can't take a child
                      off a day the list doesn't show. */}
                  {(
                    <div className="mt-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px]" style={{ color: tk.muted }}>
                          {x.dates.length === 1 ? tr("p7ck.whosComing") : tr("p7ck.whosOnAllN", { n: x.dates.length })}
                        </span>
                        {roster.length === 0 && <span className="text-[11px]" style={{ color: "#c2410c" }}>{tr("p7ck.addChildAboveLower")}</span>}
                        {roster.map((c) => {
                          const name = c.name.trim();
                          const going = b.childrenOn(x.id).includes(name);
                          const outT = ticketAgeRange(d, x.name).own ? outsideTicketRange(d, c, x.name) : null;
                          return (
                            <button key={name} type="button" disabled={!!outT && !going && !d.allowOutOfRange} onClick={() => b.toggleChild(x.id, name)}
                              title={x.dates.length === 1
                                ? (going ? tr("p7ck.takeOffDay", { name }) : tr("p7ck.putOnDay", { name }))
                                : (going ? tr("p7ck.takeOffPassN", { name, n: x.dates.length }) : tr("p7ck.putOnPassN", { name, n: x.dates.length }))}
                              className={`border-2 px-2.5 py-[3px] text-[11.5px] font-bold ${tk.round}`}
                              style={going
                                ? { borderColor: sexTint(c.sex, true).border, background: sexTint(c.sex, true).bg, color: sexTint(c.sex, true).ink }
                                : { borderColor: "#c3c9d6", background: "#eceff5", color: "#5a6478" }}>
                              {going ? "✓ " : "+ "}{name}{outT && !going ? ` · ${tr("p9tx.ckTicketAgeShort", { from: Number.isFinite(outT.from) ? outT.from : "", to: Number.isFinite(outT.to) ? outT.to : "" })}` : ""}
                            </button>
                          );
                        })}
                      </div>
                      {ticketAgeIssues.filter((i) => i.itemId === x.id).map((i) => (
                        <div key={i.name} role="alert" className="mt-1.5 text-[11.5px] font-bold" style={{ color: d.allowOutOfRange ? "#9a5a00" : "#c0392b" }}>
                          {d.allowOutOfRange ? "ℹ️ " : "⚠️ "}{d.allowOutOfRange ? tr("p9tx.ckTicketAgeReq", { name: i.name, ticket: i.ticket, from: Number.isFinite(i.from) ? i.from : "", to: Number.isFinite(i.to) ? i.to : "" }) : ticketAgeText(i)}
                        </div>
                      ))}
                      {clashesOn(x.id).length > 0 && (
                        <div className="mt-1.5 border px-2.5 py-1.5 text-[11px] leading-[1.45]"
                          style={{ borderColor: "#fed7aa", background: "#fff7ed", color: "#9a3412" }}>
                          {tr([...new Set(clashesOn(x.id).map((c) => c.name))].length === 1 ? "p8lst.ck8ClashOne" : "p8lst.ck8ClashMany", {
                            names: new Intl.ListFormat(dl(), { style: "long", type: "conjunction" }).format([...new Set(clashesOn(x.id).map((c) => c.name))]),
                            dates: new Intl.ListFormat(dl(), { style: "long", type: "conjunction" }).format([...new Set(clashesOn(x.id).map((c) => fmtDate(c.iso)))]),
                          })}
                        </div>
                      )}
                      {existingOn(x.id).length > 0 && (
                        <div className="mt-1.5 border px-2.5 py-1.5 text-[11px] leading-[1.45]"
                          style={{ borderColor: "#fcd34d", background: "#fffbeb", color: "#92400e" }}>
                          {existingOn(x.id).map((c) => tr("p9tx.ckAlreadyPlace", { name: c.name, date: String(fmtDate(c.iso)), ref: c.ref })).join(" ")}{" "}
                          {tr("p9tx.ckTakeOffPass")}
                        </div>
                      )}
                      {b.childrenOn(x.id).length === 0 && roster.length > 0 && (
                        <div className="mt-1 text-[11px]" style={{ color: "#c2410c" }}>
                          {tr(x.dates.length === 1 ? "p8lst.ck8NobodyDay" : "p8lst.ck8NobodyPass")}
                        </div>
                      )}
                      {/* The saving on the line that earned it — a lump at the
                          bottom doesn't tell you which choice paid off. */}
                      {/* Cost, what came off, what's left — the three numbers a
                          parent wants, in that order, on the pass they apply to. */}
                      {(() => {
                        const savings = savingsOn(x.id);
                        const gross = b.priceOf(x) * b.childrenOn(x.id).length;
                        const off = savings.reduce((t, sv) => t + sv.amount, 0);
                        if (!b.childrenOn(x.id).length) return null;
                        return (
                          <div className="mt-2 flex flex-col gap-0.5 border-t pt-2" style={{ borderColor: tk.line }}>
                            <div className="flex items-baseline justify-between gap-3 text-[11.5px]">
                              <span style={{ color: tk.muted }}>{tr("p8lst.ck8Cost")}</span>
                              <span style={{ color: tk.ink }}>{money(gross)}</span>
                            </div>
                            {savings.map((sv) => (
                              <div key={sv.name} className="flex items-baseline justify-between gap-3 text-[11px]">
                                <span className="min-w-0" style={{ color: tk.muted }}>
                                  {sv.name}
                                  {sv.terms && <span className="ms-1 opacity-70">({sv.terms})</span>}
                                </span>
                                <span className="flex-none font-bold" style={{ color: tk.accent }}>−{money(sv.amount)}</span>
                              </div>
                            ))}
                            <div className="mt-0.5 flex items-baseline justify-between gap-3 border-t pt-1 text-[12.5px] font-extrabold"
                              style={{ borderColor: tk.line }}>
                              <span style={{ color: tk.ink }}>{tr("p7ck.passTotal")}</span>
                              <span style={{ color: tk.ink }}>{money(Math.max(0, gross - off))}</span>
                            </div>
                          </div>
                        );
                      })()}
                      <button type="button" onClick={() => b.editDates(x.id)}
                        className="mt-1.5 text-[11px] font-bold underline underline-offset-2" style={{ color: tk.muted }}>
                        {x.dates.length === 1 ? tr("p7ck.changeThisDate") : tr("p7ck.changeWhichN", { n: x.dates.length })}
                      </button>
                    </div>
                  )}

                  {/* Extras, per child. A sibling might want lunch on two days
                      and the other on all five, so each gets their own row —
                      and nothing is ticked for them by default. */}
                </div>
              );
            })}
          </div>
          )}
        </>
      )}

      {/* Meals — pick from the day's menu; the cost joins the total below and
          is paid with the booking. Optional, one meal per child per day. */}
      {ckStage === "meals" && (
        <div>
          <div className="text-[15px] font-extrabold" style={{ color: tk.ink }}>{tr("p7ck.addMealsHead")} <span className="text-[12px] font-semibold" style={{ color: tk.muted }}>{tr("p7ck.optionalDot")}</span></div>
          <p className="mb-3 mt-0.5 text-[12px]" style={{ color: tk.muted }}>{tr("p7ck.mealsIntro")}</p>
          <div className="flex flex-col gap-3">
            {mealKids.map((kid, ki) => {
              const slots = mealSlots.filter((s) => s.kid === kid);
              const chosen = slots.filter((s) => b.mealFor(kid, s.date)).length;
              const single = mealKids.length === 1;
              const open = single || (openMealKid === null ? kid === mealKids[0] : openMealKid === kid);
              return (
                <div key={kid} className="overflow-hidden rounded-xl" style={{ border: `2px solid ${chosen ? tk.accent : tk.line}` }}>
                  <button type="button" onClick={() => !single && setOpenMealKid(open ? "" : kid)} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-start" style={{ background: `${tk.accent}1f`, cursor: single ? "default" : "pointer" }}>
                    <span className="grid h-6 w-6 flex-none place-items-center rounded-full text-[12px] font-black" style={{ background: tk.accent, color: tk.accentInk }}>{ki + 1}</span>
                    <span className="text-[13.5px] font-extrabold" style={{ color: tk.ink }}>{kid}</span>
                    <span className="rounded-full px-2 py-[1px] text-[10.5px] font-extrabold" style={{ background: chosen ? tk.accent : "transparent", color: chosen ? tk.accentInk : tk.muted, border: chosen ? "none" : `1px solid ${tk.line}` }}>{chosen}/{slots.length} meals</span>
                    {!single && <span className="ms-auto text-[13px]" style={{ color: tk.muted }}>{open ? "▲" : "▼"}</span>}
                  </button>
                  {open && (
                    <div className="px-3 pb-3 pt-2.5">
                      {!single && chosen > 0 && <button type="button" onClick={() => copyMealsToAll(kid)} className="mb-2.5 rounded-full px-3 py-1.5 text-[11.5px] font-extrabold" style={{ border: `1px solid ${tk.accent}`, color: tk.accent }}>{tr("p9tx.ckCopyMeals", { kid })}</button>}
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {slots.map(({ date }) => {
                          const menu = menuForDate(date);
                          if (!menu) return null;
                          const sel = b.mealFor(kid, date);
                          const wd = new Date(`${date}T00:00:00Z`).getUTCDay();
                          const wdLabel = new Date(`${date}T00:00:00Z`).toLocaleDateString(dl(), { weekday: "long", timeZone: "UTC" });
                          const sameWdCount = slots.filter((s) => new Date(`${s.date}T00:00:00Z`).getUTCDay() === wd).length;
                          return (
                            <div key={date} className="rounded-lg p-2" style={{ border: `1px solid ${sel ? tk.accent : tk.line}`, background: sel ? `${tk.accent}14` : "transparent" }}>
                              <div className="text-[11px] font-bold" style={{ color: tk.muted }}>{fmtMealDay(date)} · {menu.name}</div>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {menu.items.map((it) => {
                                  const on = sel === it.id;
                                  return (
                                    <button key={it.id} type="button" onClick={() => b.pickMeal(kid, date, on ? null : it.id)}
                                      className="rounded-full px-2 py-[3px] text-[11.5px] font-bold"
                                      style={on ? { background: tk.accent, color: tk.accentInk } : { border: `1px solid ${tk.line}`, color: tk.ink }}
                                      title={(it.allergens?.length ?? 0) > 0 ? tr("p7ck.contains", { list: it.allergens!.join(", ") }) : undefined}>
                                      {on ? "✓ " : ""}{it.name}{it.price > 0 ? ` · ${money(it.price)}` : ""}{(it.allergens?.length ?? 0) > 0 ? " ⚠" : ""}
                                    </button>
                                  );
                                })}
                              </div>
                              {sel && slots.length > 1 && (
                                <div className="mt-1.5 flex flex-wrap gap-2">
                                  {sameWdCount > 1 && <button type="button" onClick={() => applyEveryWeekday(kid, date, sel)} className="text-[10.5px] font-extrabold underline" style={{ color: tk.accent }}>{tr("p9tx.ckSameEvery", { wd: String(wdLabel) })}</button>}
                                  <button type="button" onClick={() => applyAllDays(kid, date, sel)} className="text-[10.5px] font-extrabold underline" style={{ color: tk.accent }}>{tr("p9tx.ckSameAll", { kid: kid.split(" ")[0] })}</button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <button type="button" onClick={() => setCkStage("pay")} className={`mt-4 w-full py-3 text-[13.5px] font-extrabold ${tk.round}`} style={{ background: tk.accent, color: tk.accentInk }}>
            {mealTotal > 0 ? tr("p7ck.nextMeals", { amt: money(mealTotal) }) : tr("p7ck.nextArrow")}
          </button>
          <BackBtn tk={tk} onClick={() => { if (addons.length) { setExtraIdx(ordered.length - 1); setCkStage("extras"); } else setCkStage("who"); }} className="mt-3">
            {ordered.length ? tr("p7ck.backTo", { step: ordered[ordered.length - 1].name }) : tr("p8lst.ck8BackToChildren")}
          </BackBtn>
        </div>
      )}

      {/* Totals belong to the paying step. Showing prices and discounts while
          someone is choosing lunches was two conversations at once. */}
      {ckStage === "pay" && (
      <div className="mt-4 border-t pt-3" style={{ borderColor: tk.line }}>
        {/* Big, unmissable: the saving the parent is getting, or why an early bird they expected is not applied. */}
        {b.saved > 0 && (
          <div className="mb-2 flex items-center justify-between gap-3 rounded-xl border-2 px-3 py-2.5" style={{ borderColor: tk.accent, background: `${tk.accent}1f` }}>
            <span className="text-[14px] font-extrabold" style={{ color: tk.ink }}>🎉 {b.discountLines.length === 1 && b.discountLines[0].kind ? tr("p9tx.ckKindApplied", { kind: dkLabel(b.discountLines[0].kind) }) : tr("p9tx.ckDiscountsApplied")}</span>
            <b className="text-[18px]" style={{ color: tk.accent }}>{tr("p9tx.ckYouSave", { amt: money(b.saved) })}</b>
          </div>
        )}
        {b.saved <= 0 && (d as { earlyFixedUsed?: boolean }).earlyFixedUsed && (
          <div className="mb-2 rounded-xl border px-3 py-2 text-[12px]" style={{ borderColor: tk.line, color: tk.muted }}>
            {tr("p9tx.ckEarlyUsed")}
            {(d as { earlyFixedUnpaid?: boolean }).earlyFixedUnpaid && (d as { earlyFixedRef?: string }).earlyFixedRef && (
              <> {tr("p9tx.ckEarlyUnpaid")} <Link href={`/custdash/bookings?cancel=${encodeURIComponent((d as { earlyFixedRef?: string }).earlyFixedRef!)}`} className="font-bold underline" style={{ color: tk.accent }}>{tr("p9tx.ckEarlyCancel", { ref: String((d as { earlyFixedRef?: string }).earlyFixedRef) })}</Link> {tr("p9tx.ckEarlyInstead")}</>
            )}
          </div>
        )}
        {b.discountLines.map((l, i) => (
          <div key={i} className="flex items-baseline justify-between gap-3 text-[11.5px]">
            <span className="min-w-0" style={{ color: tk.muted }}>
              {l.kind && <b className="me-1.5" style={{ color: tk.ink }}>{dkLabel(l.kind)}</b>}
              {l.kind && !l.custom ? (l.terms ? <span>({l.terms})</span> : null) : <>{l.name}{l.terms && !l.name.includes(l.terms) && <span className="ms-1 opacity-70">({l.terms})</span>}</>}
            </span>
            <b className="flex-none" style={{ color: tk.accent }}>−{money(l.amount)}</b>
          </div>
        ))}
        {addonTotal > 0 && (
          <div className="flex items-baseline justify-between text-[11.5px]" style={{ color: tk.muted }}>
            <span>{tr("p8lst.ck8Addons")}</span><b style={{ color: tk.ink }}>{money(addonTotal)}</b>
          </div>
        )}
        {mealTotal > 0 && (
          <div className="flex items-baseline justify-between text-[11.5px]" style={{ color: tk.muted }}>
            <span>{tr("p7ck.stepMeals")}</span><b style={{ color: tk.ink }}>{money(mealTotal)}</b>
          </div>
        )}
        <div className="mt-2 flex items-baseline justify-between text-[14px]">
          <span style={{ color: tk.muted }}>{tr("p8lst.ck8Total")}</span>
          <span className="flex items-baseline gap-2">
            {/* What it was BEFORE discounts — showing the discounted total here
                struck through said "£540, was £540". */}
            {(b.saved > 0 || b.totalOverride !== null) && <s className="text-[11px]" style={{ color: tk.muted }}>{money(b.subtotal + addonTotal + mealTotal)}</s>}
            <b style={{ color: tk.ink }}>{money(grandTotal)}</b>
          </span>
        </div>
        {/* Discount codes — clearly labelled. Codes STACK: tap as many as apply
            (an exclusive one stands alone); tap again to remove. */}
        {parentMode && (
          <div className="mt-3 border-t pt-2.5" style={{ borderColor: tk.line }}>
            <div className="mb-1.5 text-[12.5px] font-extrabold" style={{ color: tk.ink }}>{tr("p7ck.haveCodes")}</div>
            <div className="flex gap-1.5">
              <input
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void applyCode(codeInput); } }}
                placeholder={tr("p7ck.phTypeCode")}
                className="min-w-0 flex-1 rounded-lg px-2.5 py-2 text-[12.5px] uppercase outline-none"
                style={{ background: tk.inputBg, border: `1px solid ${tk.line}`, color: tk.ink }}
              />
              <button type="button" disabled={codeBusy || !codeInput.trim()} onClick={() => void applyCode(codeInput)} className="flex-none rounded-lg px-4 py-2 text-[12px] font-extrabold disabled:opacity-50" style={{ background: tk.accent, color: tk.accentInk }}>{codeBusy ? "…" : "Apply"}</button>
            </div>
            {codeErr && <div className="mt-1 text-[11px]" style={{ color: "#ef5350" }}>{codeErr}</div>}
            {myCoupons.length > 0 && (
              <div className="mt-2">
                <div className="mb-1 text-[11px]" style={{ color: tk.muted }}>{tr("p7ck.tapCodes")}</div>
                <div className="flex flex-wrap gap-1.5">
                  {myCoupons.map((c) => {
                    const active = isApplied(c.code);
                    return (
                      <button key={c.code} type="button" onClick={() => void applyCode(c.code)} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-bold transition-transform hover:-translate-y-px" style={active ? { background: tk.accent, color: tk.accentInk, border: `1.5px solid ${tk.accent}` } : { background: "transparent", color: tk.ink, border: `1.5px solid ${tk.accent}` }}>
                        <span style={{ color: active ? tk.accentInk : tk.accent }}>{active ? "✓" : "＋"}</span>
                        {c.type === "percent" ? tr("p7ck.codeOffPct", { code: c.code, v: c.value }) : c.type === "perAttendee" ? tr("p7ck.codePerChild", { code: c.code, amt: money(c.value) }) : tr("p7ck.codeOffAmt", { code: c.code, amt: money(c.value) })}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
        {/* Deductions — each discount code, then wallet credit, and the final due-now. */}
        {parentMode && (codeOff > 0 || walletAvail > 0) && (
          <>
            {appliedCodes.map((a) => (
              <div key={a.code} className="mt-2 flex items-baseline justify-between text-[12px]">
                <span style={{ color: tk.muted }}>{tr(a.exclusive ? "p8lst.ck8CodeLineExclusive" : "p8lst.ck8CodeLine", { code: a.code })}</span>
                <b style={{ color: tk.accent }}>−{money(Math.min(a.off, grandTotal))}</b>
              </div>
            ))}
            {walletAvail > 0 && (
              <div className="mt-2">
                <div className="flex items-baseline justify-between text-[12px]">
                  <span style={{ color: tk.muted }}>{tr("p8lst.ck8WalletCredit", { amt: money(walletBalance) })}</span>
                  <b style={{ color: walletApplied > 0 ? tk.accent : tk.muted }}>−{money(walletApplied)}</b>
                </div>
                {/* Auto-applied in full, but the family can spend less and keep
                    the rest for another time. */}
                <div className="mt-1 flex items-center gap-1.5">
                  {([["All", walletAvail], ["None", 0]] as const).map(([label, amt]) => {
                    const on = label === "All" ? walletApplied === walletAvail : walletApplied === 0;
                    return (
                      <button key={label} type="button" onClick={() => setWalletUse(label === "All" ? null : 0)}
                        className={`px-2 py-[3px] text-[10.5px] font-bold ${tk.round}`}
                        style={on ? { background: tk.accent, color: "#0a0a0a" } : { border: `1px solid ${tk.line}`, color: tk.muted }}>
                        {label === "All" ? tr("p8lst.ck8WalletAll") : tr("p8lst.ck8WalletNone")}
                      </button>
                    );
                  })}
                  <input type="range" min={0} max={walletAvail} step={0.01} value={walletApplied}
                    onChange={(e) => setWalletUse(parseFloat(e.target.value))} aria-label={tr("p7ck.walletAria")}
                    className="h-1.5 flex-1 cursor-pointer" style={{ accentColor: tk.accent }} />
                </div>
                {walletApplied < walletAvail && (
                  <div className="mt-0.5 text-[10.5px]" style={{ color: tk.muted }}>
                    {tr("p8lst.ck8WalletStays", { amt: money(walletBalance - walletApplied) })}
                  </div>
                )}
              </div>
            )}
            <div className="mt-1.5 flex items-baseline justify-between border-t pt-1.5 text-[15px] font-extrabold" style={{ borderColor: tk.line, color: tk.ink }}>
              <span>{tr("p7ck.dueNow")}</span>
              <b>{money(amountDue)}</b>
            </div>
          </>
        )}
        {/* Final say on the price — for a one-off arrangement a rule can't express. Operators only. */}
        {!parentMode && <div className="mt-2 flex items-center gap-2">
          <span className="flex-1 text-[11.5px]" style={{ color: tk.muted }}>{tr("p7ck.overrideTotal")}</span>
          <span className="flex items-center gap-1">
            <span className="text-[11px]" style={{ color: tk.muted }}>£</span>
            <input type="number" min={0} step="0.01" value={b.totalOverride ?? ""} placeholder={calculated.toFixed(2)}
              onChange={(e) => b.setTotalOverride(e.target.value === "" ? null : Math.max(0, parseFloat(e.target.value) || 0))}
              className={`w-[86px] border px-2 py-1 text-end text-[12.5px] font-bold outline-none ${tk.round}`}
              style={{ background: tk.inputBg, borderColor: b.totalOverride !== null ? tk.accent : tk.line, color: tk.ink }} />
            {b.totalOverride !== null && (
              <button type="button" onClick={() => b.setTotalOverride(null)} className="text-[11px] font-bold" style={{ color: tk.muted }}>{tr("p8lst.ck8Reset")}</button>
            )}
          </span>
        </div>}
        {!parentMode && b.totalOverride !== null && (
          <input type="text" maxLength={200} value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder={tr("p9tx.ckReason")}
            className={`mt-1.5 w-full border px-2 py-1 text-[12px] outline-none ${tk.round}`} style={{ background: tk.inputBg, borderColor: tk.line, color: tk.ink }} />
        )}
      </div>
      )}

      {ckStage === "who" && (() => {
        // A question the provider marked "must be answered" and set to every
        // booking is asked on this screen, after a child has been added — so
        // the child form can't enforce it and this step has to. Named, so the
        // parent isn't hunting a blank box down the page.
        const outstanding = roster.flatMap((c) =>
          unansweredRequired(
            questionsFor(ckQuestions, d.id ?? undefined, ageOn(c.dob, d.runFrom)).filter(asksEveryBooking),
            c.answers ?? {},
          ).map((q) => ({ who: c.name.trim() || tr("p7ck.thisChildLower"), label: q.label })),
        );
        const ready =
          roster.length > 0 && unassigned === 0 && shortPasses.length === 0 && clashes.length === 0 && existingClashes.length === 0 && outstanding.length === 0 && !ticketAgeBlocks;
        const next = tr("p7ck.ctaNext");
        return (
          <>
            {/* Where the booking stands, once rather than per card. */}
            {b.basket.length > 0 && roster.length > 0 && (
              <div className={`mt-4 flex items-baseline justify-between gap-3 border-2 px-4 py-3 ${tk.round}`}
                style={{ borderColor: `${tk.muted}55`, background: tk.inputBg }}>
                <span className="text-[12.5px] font-bold" style={{ color: tk.ink }}>
                  {tr("p8lst.ck8BookingSoFar")}
                  <span className="ms-1.5 text-[11px] font-semibold" style={{ color: tk.muted }}>
                    {pickPlural(tr, locale, "p8lst.ck8PassCount", b.basket.length)}
                    {b.saved > 0 ? tr("p7ck.savedAmt", { amt: money(b.saved) }) : ""}
                    {b.saved > 0 && b.discountLines.length > 0 ? ` (${[...new Set(b.discountLines.map((l) => (l.kind ? dkLabel(l.kind) : l.name)))].join(", ")})` : ""}
                  </span>
                </span>
                <span className="flex items-baseline gap-2">
                  {b.saved > 0 && <s className="text-[11.5px]" style={{ color: tk.muted }}>{money(b.subtotal)}</s>}
                  <b className="text-[17px]" style={{ color: tk.ink }}>{money(b.total)}</b>
                </span>
              </div>
            )}

            <button type="button" disabled={!ready} onClick={() => { setExtraIdx(0); setCkStage(addons.length ? "extras" : hasMeals ? "meals" : "pay"); }}
              className={`mt-3 w-full py-3 text-[13.5px] font-extrabold disabled:opacity-40 ${tk.round}`}
              style={{ background: tk.accent, color: tk.accentInk }}>
              {roster.length === 0 ? tr("p7ck.ctaAddChildFirst")
                : clashes.length > 0 ? tr("p7ck.ctaClash", { name: clashes[0].name, date: fmtDate(clashes[0].iso) })
                : existingClashes.length > 0 ? tr("p9tx.ckAlreadyBooked", { name: existingClashes[0].name, date: String(fmtDate(existingClashes[0].iso)) })
                : unassigned > 0 || shortPasses.length > 0 ? tr("p7ck.ctaPutChild")
                : ticketAgeBlocks ? ticketAgeText(ticketAgeIssues[0])
                : outstanding.length > 0 ? tr("p7ck.ctaAnswer", { label: outstanding[0].label, who: outstanding[0].who })
                : next}
            </button>
            <BackBtn tk={tk} onClick={() => b.setStage("pick")} className="mt-2 w-full justify-center">{tr("p7ck.backToDates")}</BackBtn>
          </>
        );
      })()}

      {/* Extras, one per step, in the panel — no popup. Same accent as the rest
          of the flow so moving between steps feels continuous. */}
      {ckStage === "extras" && ordered[extraIdx] && (() => {
        const a = ordered[extraIdx];
        const perDay = a.type === "perday";
        const kids = [...new Set(b.basket.flatMap((x) => b.childrenOn(x.id)))];
        const anyPicked = b.basket.some((x) => kids.some((k) => b.addonDays(x.id, k, a.id).length > 0));
        const last = extraIdx === ordered.length - 1;
        const clearAll = () => b.basket.forEach((x) => kids.forEach((k) => b.setAddonDays(x.id, k, a.id, [])));
        // A t-shirt with no size is an order the provider can't fill, so the
        // step won't close over one.
        const unanswered = b.basket.flatMap((x) =>
          b.childrenOn(x.id)
            .filter((k) => b.addonDays(x.id, k, a.id).length > 0)
            .flatMap((k) => (a.questions ?? [])
              .filter((q) => q.required && !(b.answers(x.id, k, a.id)[q.id] ?? "").trim())
              .map((q) => ({ kid: k, label: q.label }))));
        // What this extra costs, per child and in total, plus where the
        // booking stands — without repeating the pass lines from two steps ago.
        const costFor = (kid: string) =>
          b.basket.reduce((t, x) => t + costOf(a, b.addonDays(x.id, kid, a.id)), 0);
        const thisExtra = kids.reduce((t, k) => t + costFor(k), 0);
        const step = (n: number) => {
          if (n < 0) { if (extraIdx === 0) setCkStage("who"); else setExtraIdx(extraIdx - 1); return; }
          if (last) setCkStage(hasMeals ? "meals" : "pay"); else setExtraIdx(extraIdx + 1);
        };
        // Bar pieces, built once and arranged two ways below — a photo changes
        // the shape of this bar, not the things on it.
        // Dressed as the "Choose dates & times" header the parent has already
        // met: the panel's own gradient, an italic uppercase title with the
        // price opposite, and the description in a translucent strip.
        const BAR = tk.bar, BAR_INK = tk.barInk;
        const onBar = BAR.includes("gradient") ? "#0047ff" : BAR;
        const solid = { borderColor: BAR_INK, background: BAR_INK, color: onBar };
        const ghost = { borderColor: `${BAR_INK}66`, background: "rgba(255,255,255,.15)", color: BAR_INK };
        const btn = `flex-none border-2 px-3 py-1.5 text-[12px] font-extrabold ${tk.round}`;
        const every = b.basket.every((x) =>
          b.childrenOn(x.id).every((k) => b.addonDays(x.id, k, a.id).length === (perDay ? x.dates.length : 1)));
        // The shortcut only earns its place when there's something to shortcut:
        // a one-off for a single child is one tap either way, and "every day"
        // is meaningless on something that isn't per-day.
        const sweep = kids.length > 1
          ? (perDay ? tr("p7ck.everyoneEveryDay") : tr("p7ck.everyoneWord"))
          : (perDay ? tr("p7ck.everyDay") : null);
        const buttons = (
          <div className="flex flex-none flex-wrap gap-2">
            {sweep && (
              <button type="button"
                onClick={() => b.basket.forEach((x) => b.childrenOn(x.id).forEach((k) =>
                  b.setAddonDays(x.id, k, a.id, every ? [] : perDay ? [...x.dates] : ["*"])))}
                className={btn} style={every ? solid : ghost}>
                {every ? `✓ ${sweep}` : sweep}
              </button>
            )}
            {/* Once something's chosen the way on is Next, and it belongs here
                too — with everyone sorted in one tap, the buttons at the bottom
                are a scroll away past sixty date tiles. */}
            {anyPicked ? (
              <button type="button" onClick={() => step(1)} disabled={unanswered.length > 0}
                className={`${btn} disabled:opacity-50`} style={solid}>{tr("p7ck.nextArrow")}</button>
            ) : (
              <button type="button" onClick={() => { clearAll(); step(1); }}
                className={btn} style={ghost}>{tr("p7ck.skipArrow")}</button>
            )}
          </div>
        );
        const eyebrow = (
          <div className="font-bold uppercase" style={{ ...label, color: BAR_INK, opacity: 0.75 }}>
            Extra {extraIdx + 1} of {ordered.length}
          </div>
        );
        return (
          <div key={a.id} className="aos-step mt-4">
            {/* One bar carrying the whole extra: what it is, what it costs, its
                description, and the way past it. */}
            <div className={`px-5 py-3.5 ${tk.round}`} style={{ background: BAR }}>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                {a.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.image} alt={a.name}
                    className={`aspect-square w-[86px] flex-none object-cover ${tk.round}`}
                    style={{ boxShadow: "0 0 0 2px rgba(255,255,255,.5)" }} />
                )}
                <div className="min-w-0 flex-1">
                  {eyebrow}
                  {/* Title left, price opposite — the shape of the dates header. */}
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="text-[18px] font-black uppercase italic" style={{ color: BAR_INK }}>{a.name}</span>
                    <span className="text-[12px]" style={{ color: BAR_INK, opacity: 0.8 }}>
                      <b className="italic" style={{ opacity: 1 }}>{money(a.price)}</b> {perDay ? tr("p8lst.ck8PerDay") : tr("p8lst.ck8OneOff")}
                    </span>
                  </div>
                  {a.description && (
                    <div className="mt-2 flex items-start gap-1.5 rounded px-2.5 py-1.5 text-[11.5px] font-semibold backdrop-blur-sm"
                      style={{ background: "rgba(255,255,255,.15)", color: BAR_INK }}>
                      <span aria-hidden>👉</span><span>{a.description}</span>
                    </div>
                  )}
                </div>
                {buttons}
              </div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {b.basket.map((x) => {
                const on = b.childrenOn(x.id);
                if (!on.length) return null;
                return (
                  <div key={x.id} className="mb-3 last:mb-0">
                    {b.basket.length > 1 && (
                      <div className="mb-1.5 text-[11px] font-bold" style={{ color: tk.muted }}>
                        {x.name} · {b.datesPretty(x.dates)}
                      </div>
                    )}
                    {on.map((kid) => {
                      const days = b.addonDays(x.id, kid, a.id);
                      const all = days.length === x.dates.length;
                      // The child's own colour, so each block is theirs at a
                      // glance rather than three identical grey lists.
                      const rec = roster.find((r) => r.name.trim() === kid);
                      const kc = sexTint(rec?.sex, true);
                      return (
                        <div key={kid} className={`mb-2.5 border-s-4 py-1 ps-3 last:mb-0 ${tk.round}`} style={{ borderColor: kc.bg }}>
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            {rec?.photo ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={rec.photo} alt="" className="h-6 w-6 flex-none rounded-full object-cover"
                                style={{ boxShadow: `0 0 0 2px ${kc.bg}` }} />
                            ) : (
                              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[11px] font-extrabold"
                                style={{ background: kc.bg, color: kc.ink }}>{kid.trim().charAt(0).toUpperCase()}</span>
                            )}
                            <b className="min-w-0 flex-1 truncate text-[13.5px]" style={{ color: kc.bg }}>{kid}</b>
                            <button type="button"
                              onClick={() => b.setAddonDays(x.id, kid, a.id, days.length ? [] : perDay ? [...x.dates] : ["*"])}
                              className={`flex-none border-2 px-3 py-1 text-[11.5px] font-extrabold ${tk.round}`}
                              style={(perDay ? all : days.length > 0)
                                ? { borderColor: kc.bg, background: kc.bg, color: kc.ink }
                                : { borderColor: kc.bg, background: "transparent", color: kc.bg }}>
                              {perDay
                                ? (all ? tr("p7ck.allNDays", { n: x.dates.length }) : tr("p7ck.everyDay"))
                                : (days.length ? tr("p7ck.yesPrice", { amt: money(a.price) }) : tr("p7ck.addPrice", { amt: money(a.price) }))}
                            </button>
                          </div>
                          {perDay && (
                          <div className="flex flex-wrap gap-1.5">
                            {x.dates.map((iso) => {
                              const active = days.includes(iso);
                              const dt = new Date(`${iso}T00:00:00Z`);
                              return (
                                <button key={iso} type="button"
                                  onClick={() => b.setAddonDays(x.id, kid, a.id, active ? days.filter((dd) => dd !== iso) : [...days, iso])}
                                  className={`flex min-w-[44px] flex-col items-center gap-0.5 border-2 px-1.5 py-1 transition-transform ${tk.round}`}
                                  style={active
                                    ? { borderColor: kc.bg, background: kc.bg, color: kc.ink, transform: "translateY(-1px)", boxShadow: `0 6px 14px -8px ${kc.bg}` }
                                    : { borderColor: tk.line, color: tk.muted }}>
                                  <span className="text-[8px] font-bold uppercase tracking-[0.06em] opacity-80">
                                    {dt.toLocaleDateString(dl(), { weekday: "short", timeZone: "UTC" })}
                                  </span>
                                  <span className="text-[12px] font-extrabold leading-none">{ordinal(dt.getUTCDate())}</span>
                                </button>
                              );
                            })}
                          </div>
                          )}
                          {/* Whatever the provider needs to know before they can
                              supply it — a size, a meal choice. Asked once per
                              child, and only once they're actually having it. */}
                          {days.length > 0 && (a.questions ?? []).length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {(a.questions ?? []).map((q) => {
                                const val = b.answers(x.id, kid, a.id)[q.id] ?? "";
                                const needsAnswer = !!q.required && !val.trim();
                                return (
                                  <div key={q.id} className="min-w-[170px] flex-1">
                                    <div className="mb-1 text-[10.5px] font-bold" style={{ color: tk.ink }}>
                                      {q.label}{q.required && <span style={{ color: "#f87171" }}> *</span>}
                                    </div>
                                    {q.type === "choice" ? (
                                      <div className="flex flex-wrap gap-1.5">
                                        {(q.options ?? []).map((o) => {
                                          const picked = val === o;
                                          return (
                                            <button key={o} type="button"
                                              onClick={() => b.setAnswer(x.id, kid, a.id, q.id, picked ? "" : o)}
                                              className={`border-2 px-2.5 py-1 text-[11.5px] font-bold ${tk.round}`}
                                              style={picked
                                                ? { borderColor: kc.bg, background: kc.bg, color: kc.ink }
                                                : { borderColor: needsAnswer ? "#f87171" : `${tk.ink}59`, color: tk.ink }}>
                                              {o}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <input value={val} onChange={(e) => b.setAnswer(x.id, kid, a.id, q.id, e.target.value)}
                                        placeholder={tr("p7ck.phYourAnswer")}
                                        className={`aos-in w-full border px-2.5 py-1.5 text-[12px] outline-none ${tk.round}`}
                                        style={{ background: tk.inputBg, color: tk.ink, borderColor: needsAnswer ? "#f87171" : `${tk.ink}4d` }} />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <div className={`mt-3 border-t pt-2.5`} style={{ borderColor: tk.line }}>
              {kids.filter((k) => costFor(k) > 0).map((k) => (
                <div key={k} className="flex items-baseline justify-between text-[11.5px]">
                  <span style={{ color: tk.muted }}>{k} · {a.name}</span>
                  <span style={{ color: tk.ink }}>{money(costFor(k))}</span>
                </div>
              ))}
              {thisExtra > 0 && (
                <div className="mt-0.5 flex items-baseline justify-between text-[12px] font-bold">
                  <span style={{ color: tk.ink }}>{tr("p8lst.ck8ExtraTotal", { name: a.name })}</span>
                  <span style={{ color: tk.ink }}>{money(thisExtra)}</span>
                </div>
              )}
              <div className="mt-1.5 flex items-baseline justify-between text-[11.5px]" style={{ color: tk.muted }}>
                <span>{tr("p8lst.ck8Passes")}</span><span>{money(b.total)}</span>
              </div>
              {/* Named, not lumped: "Extras £50" doesn't tell you the t-shirts
                  from the lunches, which is the thing you'd want to change. */}
              {ordered.map((ex) => {
                const total = b.basket.reduce((t, x) =>
                  t + b.childrenOn(x.id).reduce((n, k) => n + costOf(ex, b.addonDays(x.id, k, ex.id)), 0), 0);
                if (total <= 0) return null;
                return (
                  <div key={ex.id} className="flex items-baseline justify-between text-[11.5px]" style={{ color: tk.muted }}>
                    <span>{ex.name}</span><span>{money(total)}</span>
                  </div>
                );
              })}
              <div className="mt-1 flex items-baseline justify-between text-[14px] font-extrabold">
                <span style={{ color: tk.ink }}>{tr("p7ck.soFar")}</span>
                <span style={{ color: tk.accent }}>{money(b.total + addonTotal)}</span>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <BackBtn tk={tk} onClick={() => step(-1)}>
                {extraIdx === 0 ? tr("p8lst.ck8BackToChildren") : tr("p7ck.backTo", { step: ordered[extraIdx - 1].name })}
              </BackBtn>
              {/* One way on, never two: Skip until something is chosen, Next
                  after. Offering to decline what they've just picked reads as
                  a way to undo it, and both at once is a choice with no answer. */}
              {anyPicked ? (
                <button type="button" onClick={() => step(1)} disabled={unanswered.length > 0}
                  className={`ms-auto px-5 py-2 text-[12.5px] font-extrabold disabled:opacity-50 ${tk.round}`}
                  style={{ background: tk.accent, color: tk.accentInk, boxShadow: `0 10px 22px -12px ${tk.accent}` }}>
                  {unanswered.length ? tr("p7ck.needsAnswer", { kid: unanswered[0].kid, what: unanswered[0].label.toLowerCase() }) : tr("p7ck.nextArrow")}
                </button>
              ) : (
                <button type="button" onClick={() => { clearAll(); step(1); }}
                  className={`ms-auto border-2 px-4 py-2 text-[12.5px] font-extrabold ${tk.round}`}
                  style={{ borderColor: tk.muted, color: tk.ink }}>
                  {tr("p7ck.skipArrow")}
                </button>
              )}
            </div>
          </div>
        );
      })()}


      {/* No "change extras" button here any more — the tabs above go straight
          to the one they want, by name. */}
      {ckStage === "pay" && (
        <BackBtn tk={tk} onClick={() => { if (hasMeals) setCkStage("meals"); else if (addons.length) { setExtraIdx(ordered.length - 1); setCkStage("extras"); } else setCkStage("who"); }} className="mt-3">
          {hasMeals ? tr("p8lst.ck8BackToMeals") : ordered.length ? tr("p7ck.backTo", { step: ordered[ordered.length - 1].name }) : tr("p9tx.ckChangeKids")}
        </BackBtn>
      )}
      {ckStage === "pay" && (
        <BackBtn tk={tk} onClick={() => b.setStage("pick")} className="mt-2 w-full justify-center">{tr("p9tx.ckChangeDates")}</BackBtn>
      )}
      {/* Nothing to pay: a parent isn't asked how they'd like to settle £0.
          The operator still picks one, because "HAF" and "Free place" are how
          a funded place gets recorded and reported on even when no money
          moves. */}
      {ckStage === "pay" && grandTotal <= 0 && parentMode && (
        <div className={`mt-3 border px-3 py-2.5 text-[12.5px] leading-[1.5] ${tk.round}`}
          style={{ borderColor: tk.line, color: tk.ink }}>
          {/* A waiting-list join is not "free": say what it will cost IF a place opens. */}
          <Rich text={b.waitlistOnly ? tr("p7ck.waitPayHead", { amt: money(waitOfferAmt) }) : tr("p7ck.freeHead")} />
        </div>
      )}

      {ckStage === "pay" && !(grandTotal <= 0 && parentMode) && (
        <div className="mt-3">
          <div className="font-bold uppercase" style={{ ...label, color: tk.muted }}>
            {parentMode ? tr("p7ck.howYoullPayHead") : tr("p7ck.howParentPaying")}
          </div>
          <select value={method} onChange={(e) => setMethod(e.target.value)}
            className={`mt-1.5 w-full border px-3 py-2 text-[13px] outline-none ${tk.round}`}
            style={{ background: tk.inputBg, borderColor: tk.line, color: tk.ink }}>
            {(parentMode ? parentOpts : payList.map((m) => [m, m] as [string, string]))
              .map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {parentMode && parentOpts.length === 0 && (
            <p className="mt-2 text-[12px]" style={{ color: tk.muted }}>{tr("p9tx.ckNoOnlinePay")}</p>
          )}
          {tfcBlocked && (
            <p className="mt-2 text-[12px] font-semibold" style={{ color: tk.muted }} data-testid="tfc-not-ready">{tr("p8lst.tfcNotReady")}</p>
          )}

          {/* Paying by voucher happens on the scheme's own website, so this
              has to hand over everything needed to do it: which scheme, the
              reference to quote, the amount, and by when. */}
          {/* ── Tax-Free Childcare ─────────────────────────────────────────
              The parent journey from the design: link each child's HMRC
              account, choose how much comes from it, settle any remainder, and
              promise to pay. The HMRC calls sit behind ./tfc — while they're
              stubbed the link simulates success so the flow runs, and the
              reference it mints is the one Reconciliation matches on. */}
          {parentMode && method === "tfc" && (() => {
            const linkedAll = roster.length > 0 && roster.every((c) => (tfcLinked[c.name] ?? "").trim());
            const fromTfc = Math.min(amountDue, Math.max(0, parseFloat(tfcAmount || String(amountDue)) || 0));
            const remainder = Math.max(0, amountDue - fromTfc);
            // Siblings each have their own account, so what's payable from HMRC
            // is the sum of the linked ones.
            // Every method this provider takes, except TFC — that's the part
            // being split off. A provider who accepts cash or vouchers should
            // see them here; hard-coding card/bank hid half their own options.
            const restOpts = parentOpts.filter(([k]) => k !== "tfc");
            // The default was hardcoded "card", but a provider needn't accept
            // card at all — this listing takes bank/cash/vouchers/HAF only, so
            // the remainder was defaulting to a method not on offer. Fall back
            // to the first one they DO take.
            const restSel = restOpts.some(([k]) => k === tfcRest) ? tfcRest : (restOpts[0]?.[0] ?? "");
            const bals = roster.map((c) => tfcBalances[c.name]).filter(Boolean) as TfcBalance[];
            const available = bals.length ? bals.reduce((s2, b2) => s2 + b2.amount, 0) : null;
            const simulatedBalance = bals.some((b2) => b2.simulated);
            const cc = ckSettings.childcare ?? {};
            const dark = ckDarkBg(tk.bg);
            // Two greens, not one: a deep green that holds up on white, a bright
            // one for dark storefront themes.
            const TFC_GREEN = dark ? "#5fe3a8" : "#0a7a4a";
            const TFC_BAR = dark
              ? "linear-gradient(120deg,#0f9d6e,#5fe3a8)"
              : "linear-gradient(120deg,#065f3c,#0f9d6e)";
            const linkedCount = roster.filter((c) => (tfcLinked[c.name] ?? "").trim()).length;
            // The share of the bill coming from HMRC, drawn rather than described.
            const tfcPct = amountDue > 0 ? Math.min(1, Math.max(0, fromTfc / amountDue)) : 1;
            const restLabel = (parentOpts.find(([k]) => k === restSel)?.[1] ?? restSel);
            return (
              <div className={`mt-3 overflow-hidden border ${tk.round}`} style={{ borderColor: `${tk.ink}26`, background: tk.inputBg }}>

                {/* A solid green header instead of a heading + paragraph. The
                    method dropdown directly above already says "Tax-Free
                    Childcare", so restating it in prose was pure noise — and a
                    block of colour anchors the panel the way a wall of 11px
                    grey text never did. Always white-on-green, so it doesn't
                    depend on the host theme at all. */}
                <div className="flex items-center gap-2.5 px-3 py-2.5" style={{ background: TFC_BAR }}>
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[13px] font-extrabold"
                    style={{ background: "rgba(255,255,255,.22)", color: "#fff" }}>£</span>
                  <div>
                    <div className="text-[13px] font-extrabold leading-tight text-white">{tr("p7ck.payFromHmrc")}</div>
                    <div className="text-[10.5px] leading-tight" style={{ color: "rgba(255,255,255,.8)" }}>{tr("p7ck.methodTfc")}</div>
                  </div>
                  <span className="ms-auto shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-extrabold"
                    style={{ background: linkedAll ? "rgba(255,255,255,.95)" : "rgba(255,255,255,.2)", color: linkedAll ? "#065f3c" : "#fff" }}>
                    {linkedAll ? tr("p7ck.linkedShort") : tr("p7ck.linkedOfN", { a: linkedCount, n: roster.length })}
                  </span>
                </div>

                <div className="p-3">
                {/* One row per child — siblings each have their own account. */}
                <div className="flex flex-col gap-2">
                  {roster.map((c) => {
                    const ref = tfcLinked[c.name] ?? "";
                    const typed = (voucherRefs[c.name] ?? ref).trim().toUpperCase();
                    // "usually" on purpose — the pattern holds for most references
                    // but not all (a live one reads LHERB7808TFC, four surname
                    // letters), so a mismatch warns and never blocks.
                    const looksRight = new RegExp(`^${referencePrefix(c.name)}\\d{5}TFC$`).test(typed);
                    return (
                      <div key={c.name} className={`border p-2.5 ${tk.round}`}
                        style={{ borderColor: ref ? `${TFC_GREEN}59` : `${tk.ink}26`, background: ref ? `${TFC_GREEN}0d` : "transparent" }}>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-[12.5px] font-bold" style={{ color: tk.ink }}>{c.name}</span>
                          {ref
                            ? <span className="text-[11px] font-bold" style={{ color: TFC_GREEN }}>{tr("p7ck.linkedCheck")}</span>
                            : (
                              <button type="button"
                                onClick={() => { setTfcFail(null); setTfcConnecting(c.name); }}
                                className={`ms-auto border-2 px-3 py-1 text-[11.5px] font-bold ${tk.round}`}
                                style={{ borderColor: tk.accent, background: `${tk.accent}26`, color: tk.ink }}>
                                {tr("p7ck.loginHmrc")}
                              </button>
                            )}
                        </div>
                        <div className="relative mt-1.5">
                          <input value={voucherRefs[c.name] ?? ref}
                            onChange={(e) => { setVoucherRefs((m) => ({ ...m, [c.name]: e.target.value.toUpperCase() })); }}
                            placeholder={referenceHint(c.name)}
                            aria-label={tr("p7ck.payRefFor", { name: c.name })}
                            className={`w-full border px-2.5 py-1.5 pe-8 text-[12.5px] font-semibold tracking-wide ${tk.round}`}
                            style={{ borderColor: typed ? (looksRight ? `${TFC_GREEN}80` : "#e0a020") : `${tk.ink}33`, background: tk.inputBg, color: tk.ink }} />
                          {typed && looksRight && (
                            <span className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 text-[12px] font-extrabold"
                              style={{ color: TFC_GREEN }}>✓</span>
                          )}
                        </div>
                        {/* The format guide earns its space only when it can still
                            help: a reference that already matches doesn't need a
                            paragraph telling it so. */}
                        {!looksRight && (
                          <div className="mt-1 text-[10.5px] leading-[1.45]" style={{ color: typed ? "#e0a020" : tk.muted }}>
                            {typed ? tr("p7ck.doubleCheck") : tr("p7ck.fromHmrcAcct")}
                            <Rich text={tr("p7ck.usuallyRef", { prefix: referencePrefix(c.name) })} bClass="" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* HOW to add this provider inside HMRC. Folded shut, not cut:
                    "(setting name) is not added to your HMRC account" is one of
                    the designed payment failures and a parent can only avoid it
                    if they're told what to search for — but most families have
                    already done it, so it doesn't get to shout at all of them.
                    Falls back to the provider's trading name when the childcare
                    settings haven't been filled in (Reconciliation → ⚙ Settings),
                    because saying nothing is what causes the failed payment. */}
                {!linkedAll && (() => {
                  const settingName = (cc.settingName ?? "").trim() || (ckSettings.providerName ?? "").trim();
                  const rows = ([
                    [tr("p7ck.settingNameLbl"), settingName],
                    [tr("p7ck.ofstedNo"), cc.registrationNumber],
                    [tr("p7ck.postcodeLbl"), cc.postcode],
                  ] as const).filter(([, v]) => (v ?? "").trim());
                  return (
                    <details className={`mt-2 border ${tk.round}`} style={{ borderColor: `${tk.ink}26` }}>
                      <summary className="cursor-pointer px-2.5 py-2 text-[11.5px] font-bold" style={{ color: tk.ink }}>
                        {tr("p7ck.notAddedHmrc")}
                      </summary>
                      <div className="border-t px-2.5 py-2" style={{ borderColor: `${tk.ink}1a` }}>
                        <ol className="flex list-decimal flex-col gap-1 ps-4 text-[11.5px] leading-[1.5]" style={{ color: tk.muted }}>
                          <li><Rich text={tr("p7ck.signInGov")} /></li>
                          <li>{settingName ? <Rich text={tr("p7ck.searchProviderNamed", { name: settingName })} /> : tr("p7ck.searchProviderThis")}</li>
                          <li>{tr("p7ck.comeBackPay")}</li>
                        </ol>
                        {rows.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t pt-2" style={{ borderColor: `${tk.ink}1a` }}>
                            {rows.map(([label, v]) => (
                              <div key={label}>
                                <div className="text-[10px]" style={{ color: tk.muted }}>{label}</div>
                                <div className="text-[13px] font-extrabold" style={{ color: tk.ink }}>{v}</div>
                              </div>
                            ))}
                          </div>
                        )}
                        {!settingName && (
                          <div className="mt-2 text-[11px]" style={{ color: "#e0a020" }}>
                            {tr("p7ck.notPublished")}
                          </div>
                        )}
                      </div>
                    </details>
                  );
                })()}

                {/* The split, drawn. This replaced three stacked paragraphs that
                    each restated the same two numbers: what comes from HMRC and
                    what's left. A bar and two rows say it at a glance. */}
                <div className="mt-3 border-t pt-3" style={{ borderColor: `${tk.ink}1a` }}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: tk.muted }}>{tr("p7ck.howYoullPayShort")}</span>
                    <span className="text-[20px] font-extrabold tracking-[-0.01em]" style={{ color: tk.ink }}>{money(amountDue)}</span>
                  </div>
                  <div className="mt-2 flex h-3 w-full overflow-hidden rounded-full" style={{ background: `${tk.ink}14` }}>
                    <div style={{ width: `${tfcPct * 100}%`, background: TFC_BAR }} />
                    {remainder > 0 && <div style={{ width: `${(1 - tfcPct) * 100}%`, background: tk.accent }} />}
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: TFC_BAR }} />
                    <span className="text-[12px] font-semibold" style={{ color: tk.ink }}>{tr("p7ck.methodTfc")}</span>
                    <span className="ms-auto flex items-center gap-1">
                      <span className="text-[12.5px] font-extrabold" style={{ color: tk.ink }}>£</span>
                      <input inputMode="decimal" value={tfcAmount} onChange={(e) => setTfcAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                        placeholder={String(amountDue.toFixed(2))}
                        aria-label={tr("p7ck.amtFromTfc")}
                        className={`w-[86px] border px-2 py-1 text-end text-[12.5px] font-extrabold ${tk.round}`}
                        style={{ borderColor: `${tk.ink}33`, background: tk.inputBg, color: tk.ink }} />
                    </span>
                  </div>
                  {remainder > 0 && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: tk.accent }} />
                      <span className="text-[12px] font-semibold" style={{ color: tk.ink }}>{restLabel}</span>
                      <span className="ms-auto text-[12.5px] font-extrabold" style={{ color: tk.ink }}>{money(remainder)}</span>
                    </div>
                  )}

                  {/* What's actually in the account. */}
                  {available !== null && fromTfc <= available && (
                    <div className="mt-2 text-[11px]" style={{ color: tk.muted }}>
                      <Rich text={tr("p7ck.balanceLine", { amt: money(available) })} bClass="" />
                      {simulatedBalance && <span style={{ color: "#e0a020" }}> {tr("p7ck.exampleFigure")}</span>}
                    </div>
                  )}

                  {/* Short by X — the number that matters, and the one tap that
                      fixes it. */}
                  {available !== null && fromTfc > available && (
                    <div className={`mt-2 flex flex-wrap items-center gap-2 border px-2.5 py-2 ${tk.round}`}
                      style={{ borderColor: "#e0a02066", background: "#e0a0201a" }}>
                      <span className="text-[11.5px]" style={{ color: tk.ink }}>
                        <Rich text={tr("p7ck.shortBy", { amt: money(fromTfc - available), bal: money(available) })} />
                        {simulatedBalance && <span style={{ color: "#e0a020" }}> {tr("p7ck.examplePar")}</span>}
                      </span>
                      <button type="button"
                        onClick={() => { setTfcAmount(available.toFixed(2)); if (restOpts[0]) setTfcRest(restOpts[0][0]); }}
                        className={`ms-auto border-2 px-2.5 py-1 text-[11px] font-bold ${tk.round}`}
                        style={{ borderColor: tk.accent, background: `${tk.accent}26`, color: tk.ink }}>
                        {tr("p7ck.splitIt")}
                      </button>
                      <span className="w-full text-[10.5px]" style={{ color: tk.muted }}>
                        <Rich text={tr("p7ck.orTopUp")} bClass="" />
                      </span>
                    </div>
                  )}

                  {remainder > 0 && (
                    <div className="mt-2.5">
                      <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: tk.muted }}>{tr("p7ck.payTheRest")}</div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {restOpts.map(([k, label]) => (
                          <button key={k} type="button" onClick={() => setTfcRest(k)}
                            className={`border-2 px-3 py-1 text-[11.5px] font-bold ${tk.round}`}
                            style={restSel === k
                              ? { borderColor: tk.accent, background: `${tk.accent}26`, color: tk.ink }
                              : { borderColor: `${tk.ink}40`, color: tk.muted }}>
                            {label}
                          </button>
                        ))}
                      </div>

                      {/* A bank transfer is only payable if you're told WHERE to
                          send it and WHAT to quote — otherwise the money arrives
                          with nothing to match it to, which is the whole problem
                          Reconciliation exists to clean up. */}
                      {restSel === "voucher" && (
                        <div className={`mt-2 border p-2.5 text-[11.5px] leading-[1.5] ${tk.round}`} style={{ borderColor: `${tk.ink}26`, color: tk.muted }}>
                          {tr("p7ck.restVoucher", { amt: money(remainder), schemes: vouchers.length ? ` (${vouchers.slice(0, 3).map((v) => v.name).join(", ")}${vouchers.length > 3 ? tr("p7ck.andOthers") : ""})` : "" })}
                        </div>
                      )}
                      {restSel === "cash" && (
                        <div className={`mt-2 border p-2.5 text-[11.5px] leading-[1.5] ${tk.round}`} style={{ borderColor: `${tk.ink}26`, color: tk.muted }}>
                          {tr("p7ck.restCash", { amt: money(remainder) })}
                        </div>
                      )}
                      {restSel === "bank" && (() => {
                        const bank = ckSettings.billing ?? {};
                        const rows = ([
                          [tr("p7ck.acctName"), bank.accountName || bank.businessName],
                          [tr("p7ck.sortCode"), bank.sortCode],
                          [tr("p7ck.acctNumber"), bank.accountNumber],
                          [tr("p7ck.bankLbl"), bank.bankName],
                        ] as const).filter(([, v]) => (v ?? "").trim());
                        return (
                          <div className={`mt-2 border p-2.5 ${tk.round}`} style={{ borderColor: `${tk.ink}26` }}>
                            {rows.length > 0 ? (
                              <>
                                <div className="text-[11px]" style={{ color: tk.muted }}>{tr("p7ck.sendTo", { amt: money(remainder) })}</div>
                                {rows.map(([label, v]) => (
                                  <div key={label} className="mt-1 flex flex-wrap items-baseline gap-x-2">
                                    <span className="text-[11px]" style={{ color: tk.muted }}>{label}</span>
                                    <span className="text-[14px] font-extrabold" style={{ color: tk.ink }}>{v}</span>
                                  </div>
                                ))}
                              </>
                            ) : (
                              <div className="text-[11.5px] leading-[1.5]" style={{ color: tk.muted }}>
                                {tr("p7ck.bankWillSend", { amt: money(remainder) })}
                              </div>
                            )}
                            <div className="mt-2 text-[11.5px] leading-[1.5]" style={{ color: tk.muted }}>
                              {/* The booking reference doesn't exist until the booking does, so
                                  don't pretend to show it — say where it will be. */}
                              <Rich text={tr("p7ck.useBookingRef")} bClass="" />
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* Whatever HMRC says, the money arrives later — so this is a
                    promise, and it says so. It used to be an amber box restating
                    both figures the bar above already shows; one quiet line
                    carries the only part that was actually news. */}
                {!HMRC_CONNECTED && (
                  <div className="mt-2.5 text-[10.5px] leading-[1.45]" style={{ color: tk.muted }}>
                    {tr("p7ck.payFromHmrcNote")}
                  </div>
                )}

                {/* The GOV.UK consent + sign-in hand-off. */}
                {tfcConnecting && (
                  <TfcConnect
                    childName={tfcConnecting}
                    providerName={(ckSettings.providerName ?? "").trim() || tr("p8lst.ck8YourProvider")}
                    reference={voucherRefs[tfcConnecting]}
                    onLinked={(reference) => {
                      setTfcLinked((m) => ({ ...m, [tfcConnecting]: reference }));
                      setVoucherRefs((m) => ({ ...m, [tfcConnecting]: reference }));
                      // Save it against the child so the next booking starts linked.
                      const child = saved.find((c) => c.name === tfcConnecting);
                      if (child?.id) {
                        void api(`/api/my/children/${encodeURIComponent(child.id)}`, {
                          method: "PUT", body: JSON.stringify({ ...child, tfcReference: reference }),
                        }).catch(() => { /* the booking still carries the reference */ });
                        setSaved((cs) => cs.map((c) => (c.id === child.id ? { ...c, tfcReference: reference } : c)));
                      }
                    }}
                    onClose={() => setTfcConnecting(null)}
                  />
                )}

                {/* A real HMRC failure still gets a full red box — those are the
                    designed error states and they have to be read. "Not linked
                    yet" is not a failure: the header chip counts it and every
                    unlinked row carries its own button, so a third telling was
                    just noise dressed as an alarm. */}
                {tfcFail ? (
                  <div className={`mt-2 border p-2.5 text-[11.5px] leading-[1.5] ${tk.round}`} style={{ borderColor: "#d9534f66", background: "#d9534f1a", color: tk.ink }}>
                    <b>{tfcCopy(tfcFail, "title")}</b>
                    <div className="mt-0.5" style={{ color: tk.muted }}>{tfcCopy(tfcFail, "detail")}</div>
                  </div>
                ) : !linkedAll && (
                  <div className="mt-2 text-[10.5px]" style={{ color: "#e0a020" }}>
                    {tr("p7ck.linkEachChild")}
                  </div>
                )}
                </div>
              </div>
            );
          })()}

          {parentMode && method === "voucher" && (
            <div className={`mt-2 border px-3 py-2.5 ${tk.round}`} style={{ borderColor: tk.line }}>
              <div className="text-[12px] font-bold" style={{ color: tk.ink }}>{tr("p7ck.whichScheme")}</div>
              <div className="mt-0.5 text-[10.5px] leading-[1.45]" style={{ color: tk.muted }}>
                {tr("p7ck.schemeHelp")}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {vouchers.map((v) => (
                  <button key={v.id} type="button" onClick={() => setVoucherId(v.id)}
                    className={`border-2 px-3 py-1 text-[11.5px] font-bold ${tk.round}`}
                    style={voucherId === v.id
                      ? { borderColor: tk.accent, background: `${tk.accent}26`, color: tk.ink }
                      : { borderColor: `${tk.ink}40`, color: tk.muted }}>
                    {v.name}
                  </button>
                ))}
                {/* No list is complete, and a parent whose scheme is missing
                    must not be stuck. */}
                <button type="button" onClick={() => setVoucherId(NOT_LISTED)}
                  className={`border-2 border-dashed px-3 py-1 text-[11.5px] font-bold ${tk.round}`}
                  style={voucherId === NOT_LISTED
                    ? { borderColor: tk.accent, background: `${tk.accent}26`, color: tk.ink }
                    : { borderColor: `${tk.ink}40`, color: tk.muted }}>
                  {tr("p7ck.notListed")}
                </button>
              </div>

              {chosenVoucher && (
                <div className={`mt-2.5 border p-2.5 ${tk.round}`} style={{ borderColor: `${tk.ink}26`, background: tk.inputBg }}>
                  <div className="text-[11px]" style={{ color: tk.muted }}>{tr("p7ck.payUsing", { scheme: chosenVoucher.name })}</div>
                  {/* Every detail they've given us, labelled. A scheme asking
                      for a setting name and getting an account number is a
                      payment that doesn't arrive. */}
                  {voucherDetails.map((d) => {
                    const isLink = /website|url|link|portal/i.test(d.label) || /^https?:\/\//i.test(d.value);
                    const href = /^https?:\/\//i.test(d.value) ? d.value : `https://${d.value}`;
                    return (
                      <div key={d.id} className="mt-1 flex flex-wrap items-baseline gap-x-2">
                        <span className="text-[11px]" style={{ color: tk.muted }}>{d.label}</span>
                        {isLink
                          ? <a href={href} target="_blank" rel="noreferrer" className="text-[14px] font-extrabold underline" style={{ color: "var(--brand-2)" }}>{d.value} ↗</a>
                          : <span className="text-[14.5px] font-extrabold" style={{ color: tk.ink }}>{d.value}</span>}
                      </div>
                    );
                  })}
                  {voucherDetails.some((d) => /website|url|link|portal/i.test(d.label) || /^https?:\/\//i.test(d.value)) && (
                    <div className="mt-1 text-[11px]" style={{ color: tk.muted }}>{tr("p7ck.tapLinkPay", { scheme: chosenVoucher.name })}</div>
                  )}
                  <div className="mt-2 text-[11.5px] leading-[1.5]" style={{ color: tk.muted }}>
                    <Rich text={tr(voucherDetails.length === 1 ? "p7ck.sendThroughOne" : "p7ck.sendThroughMany", { amt: money(grandTotal) })} bClass="" />
                  </div>

                  {/* Force the parent to give THEIR own reference so the provider
                      can match the money. One per child — siblings often pay under
                      two separate references. */}
                  {refKids.length > 0 && (
                    <div className="mt-3 border-t pt-3" style={{ borderColor: `${tk.ink}1a` }}>
                      <div className="text-[12px] font-bold" style={{ color: tk.ink }}>{refKids.length > 1 ? tr("p7ck.yourPayRefs") : tr("p7ck.yourPayRef")}</div>
                      <div className="mt-0.5 text-[11px]" style={{ color: tk.muted }}>{tr("p7ck.refHelp", { scheme: chosenVoucher.name })} {refKids.length > 1 ? tr("p7ck.refHelpSiblings") : ""}</div>
                      <div className="mt-2 flex flex-col gap-2">
                        {refKids.map((c) => (
                          <div key={c.name} className="flex flex-wrap items-center gap-2">
                            {refKids.length > 1 && <span className="min-w-[92px] text-[12px] font-semibold" style={{ color: tk.ink }}>{c.name}</span>}
                            <input value={voucherRefs[c.name] ?? ""} onChange={(e) => setVoucherRefs((r) => ({ ...r, [c.name]: e.target.value }))}
                              placeholder={tr("p7ck.phAcctRef")} className={`flex-1 border px-3 py-2 text-[13px] ${tk.round}`}
                              style={{ borderColor: (voucherRefs[c.name] ?? "").trim() ? `${tk.ink}33` : "#e0a020", background: tk.inputBg, color: tk.ink }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {voucherId === NOT_LISTED && (
                <div className="mt-2.5 text-[11.5px] leading-[1.5]" style={{ color: tk.muted }}>
                  {tr("p7ck.noProblemBook")}
                </div>
              )}

              {/* Too close for the money to land, but the provider allows it
                  anyway. Saying so plainly is the difference between a parent
                  who pays today and one who finds out at the gate. */}
              {vWindow.tooClose && (
                <div className={`mt-2.5 border-2 px-3 py-2 text-[11.5px] leading-[1.5] ${tk.round}`}
                  style={{ borderColor: "#f59e0b", color: tk.ink }}>
                  <Rich text={tr("p7ck.headsUp", { reason: vWindow.closeReason ?? "" })} />{" "}
                  <span style={{ color: tk.muted }}>
                    {tr("p7ck.voucherSlow")}{" "}
                    {ckSettings.voucherWhenClose === "approve"
                      ? tr("p7ck.closeApprove")
                      : tr("p7ck.closeNoHold")}
                  </span>
                </div>
              )}

              <div className="mt-2 text-[11px] leading-[1.5]" style={{ color: tk.muted }}>
                {/* One date, and it's the send-by. The arrival date is real
                    and the provider chases against it, but a parent given two
                    has to work out which one is theirs — and telling them when
                    it must ARRIVE, when it spends days in transit, is telling
                    them to be late. */}
                <Rich text={tr("p7ck.sendByLine", { when: vWindow.sendBy ? fmtDate(vWindow.sendBy) : tr("p7ck.daysFromNow", { n: vWindow.daysToPay ?? 0 }) })} bClass="" />
              </div>
            </div>
          )}
          {!parentMode && (
            <div className={`mt-2 border px-3 py-2 text-[11.5px] leading-[1.5] ${tk.round}`}
              style={{ borderColor: tk.line, color: tk.muted }}>
              {/* Judged on the total, not the method name. A funded or free
                  place has nothing to invoice, and telling the operator a
                  payment link is on its way — then leaving the booking sat at
                  "Unpaid" — starts someone chasing money that was never
                  owed. */}
              {grandTotal <= 0 ? (
                <>
                  <Rich text={tr("p7ck.opNothingCollect")} />
                </>
              ) : (
                <>
                  <Rich text={tr("p7ck.opInvoiceHeld")} />
                </>
              )}
            </div>
          )}
        </div>
      )}

      {booking?.error && errFresh && /^not signed in/i.test(booking.error) && (
        <div className="mt-2 rounded-lg border px-3 py-2.5 text-[12px] font-semibold" style={{ borderColor: tk.accent, color: tk.ink }}>
          <div>{tr("p7ck.signInToConfirm")}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {([["/login", "p7ck.signInBtn"], ["/parent?tab=up&", "p7ck.createAccountBtn"]] as const).map(([base, key]) => (
              <button key={key} type="button" className="rounded-full border-2 px-4 py-1.5 text-[12px] font-extrabold" style={{ borderColor: tk.accent, color: tk.accent, background: "transparent" }}
                onClick={() => {
                  keepBasketForAuth();
                  const here = encodeURIComponent(window.location.pathname + window.location.search);
                  window.location.assign(`${base}${base.endsWith("&") ? "" : "?"}next=${here}${base.endsWith("&") && tenantId ? `&provider=${encodeURIComponent(tenantId)}` : ""}`);
                }}>{tr(key)}</button>
            ))}
          </div>
        </div>
      )}

      {booking?.error && errFresh && !/^not signed in/i.test(booking.error) && !(() => {
        // Once the named child has been taken off, their error is stale.
        const m = /^(.+?) already has a place on/.exec(booking.error);
        if (!m) return false;
        if (!b.rosterNames.includes(m[1])) return true;
        // Also stale once that child has been taken off the clashing day(s) (the "Take X off <day> only" button leaves them in the roster).
        const md = /^(.+?) already has a place on (.+?) \(booking/.exec(booking.error);
        if (!md) return false;
        const pretty = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
        return !b.basket.some((x) => x.dates.some((iso) => pretty(iso) === md[2]) && b.childrenOn(x.id).includes(md[1]));
      })() && (
        <div className="mt-2 text-[11.5px] font-semibold" style={{ color: "#dc2626" }}>
          {booking.error}
          {(() => {
            // The server refuses a child who already holds a place that day.
            // Let the parent take that child off this booking right here.
            const m = /^(.+?) already has a place on (.+?) \(booking/.exec(booking.error);
            if (!m) return null;
            const kid = m[1];
            // Take the child off ONLY the clashing day(s), so the rest of the
            // basket can still be booked straight away.
            const pretty = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
            const hits = b.basket.filter((x) => x.dates.some((iso) => pretty(iso) === m[2]) && b.childrenOn(x.id).includes(kid));
            return (
              <button type="button"
                onClick={() => (hits.length ? hits.forEach((x) => b.toggleChild(x.id, kid)) : b.setRoster((r) => r.filter((c) => c.name !== kid)))}
                className="ms-2 rounded-full border px-3 py-1 text-[11.5px] font-extrabold" style={{ borderColor: "#dc2626", color: "#dc2626" }}>
                {hits.length
                  ? (hits.some((x) => x.dates.length > 1)
                      // A 3 or 5 day pass is one pass: you cannot drop one day of it, so say so.
                      ? tr("p9tx.ckTakeOffClash", { kid, pass: hits.find((x) => x.dates.length > 1)!.name, date: String(m[2]) })
                      : tr("p9tx.ckTakeOffOnly", { kid, date: String(m[2]) }))
                  : tr("p9tx.ckRemoveKid", { kid })}
              </button>
            );
          })()}
        </div>
      )}

      {ckStage === "pay" && parentMode && (
        <div className="mt-3">
          {phoneOk && !editPhone ? (
            <div className="flex items-center justify-between gap-2 text-[12.5px]" style={{ color: tk.muted }}>
              <span>{tr("p9tx.ckPhoneUse1")} <b style={{ color: tk.ink }}>{phone.trim()}</b> {tr("p9tx.ckPhoneUse2")}</span>
              <button type="button" onClick={() => setEditPhone(true)} className="font-bold underline">Change</button>
            </div>
          ) : (<>
          <label className="mb-1 block text-[11px] font-bold" style={{ color: tk.muted }}>{tr("p7ck.contactPhone")}</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={tr("p7ck.phPhone")}
            className={`w-full border px-3 py-2 text-[13px] outline-none ${tk.round}`}
            style={{ background: tk.inputBg, borderColor: phone.trim() ? tk.line : tk.accent, color: tk.ink }} />
          <div className="mt-1 text-[11px]" style={{ color: tk.muted }}>
            {phone.trim()
              ? (phonePrefilled ? tr("p7ck.phoneFromProvider") : tr("p7ck.phoneReach"))
              : tr("p7ck.phoneNeed")}
            {phone.trim() && !phoneOk && <b style={{ color: "#dc2626" }}> {tr("p9tx.ckPhoneBad")}</b>}
          </div>
          </>)}
        </div>
      )}

      {ckStage === "pay" && homeVisit && (
        <div className="mt-3">
          <label className="mb-1 block text-[11px] font-bold" style={{ color: tk.muted }}>{tr("p7ck.weCome")}</label>
          {savedAddr && savedIncomplete && useSaved !== false ? (
            <div className={`border p-3 ${tk.round}`} style={{ background: tk.inputBg, borderColor: "#dc2626" }}>
              <div className="mb-2 text-[13px] font-extrabold" style={{ color: "#dc2626" }}>{tr("p7ck.adrNeedHouse")}</div>
              <AddressFields value={fixParts} onChange={setFix} idPrefix="ck-fix" showWhy={false} />
              {fixErr && <div className="mt-2 text-[12px] font-bold" style={{ color: "#dc2626" }}>{fixErr}</div>}
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled={fixBusy} onClick={() => void saveFix()} className="rounded-full px-4 py-2 text-[13px] font-extrabold text-white disabled:opacity-40" style={{ background: "#15b364" }}>{fixBusy ? tr("p7ck.adrSaving") : tr("p7ck.adrSave")}</button>
                <button type="button" onClick={() => { setUseSaved(false); setAddressPrefilled(false); setServiceAddress((s) => ({ ...s, address: "", postcode: "" })); }} className="rounded-full border px-4 py-2 text-[13px] font-extrabold" style={{ borderColor: tk.line, color: tk.ink }}>{tr("p7ck.addrNo")}</button>
              </div>
            </div>
          ) : savedAddr && useSaved !== false ? (
            <div className={`border p-3 ${tk.round}`} style={{ background: tk.inputBg, borderColor: useSaved ? "#15b364" : tk.accent }}>
              <div className="text-[13px] font-extrabold" style={{ color: tk.ink }}>{tr("p7ck.addrConfirmQ")}</div>
              <div className="mt-1 text-[14px] font-bold" style={{ color: tk.ink }}>
                {[savedAddr.address, savedAddr.postcode].filter(Boolean).join(", ")}{pcState.status === "ok" && pcState.area ? ` · ${pcState.area}` : ""}
              </div>
              <div className="mt-1 text-[12px] font-bold" aria-live="polite">
                {pcState.status === "checking" && <span style={{ color: tk.muted }}>{tr("p7ck.pcChecking")}</span>}
                {pcState.status === "ok" && <span style={{ color: "#0f7a43" }}>{pcState.area ? tr("p7ck.pcOk", { pc: pcState.pc ?? "", area: pcState.area }) : tr("p7ck.pcOkNoArea", { pc: pcState.pc ?? "" })}</span>}
                {pcState.status === "bad" && <span style={{ color: "#dc2626" }}>{pcState.msg}</span>}
              </div>
              {useSaved ? (
                <button type="button" onClick={() => { setUseSaved(false); setAddressPrefilled(false); setServiceAddress((s) => ({ ...s, address: "", postcode: "" })); }} className="mt-2 text-[12px] font-bold underline" style={{ color: tk.accent }}>{tr("p7ck.addrChange")}</button>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" disabled={pcState.status === "bad" || pcState.status === "checking"} onClick={() => setUseSaved(true)} className="rounded-full border px-4 py-2 text-[13px] font-extrabold disabled:opacity-40" style={{ borderColor: tk.accent, color: tk.ink, background: tk.inputBg }}>{tr("p7ck.addrYes")}</button>
                  <button type="button" onClick={() => { setUseSaved(false); setAddressPrefilled(false); setServiceAddress((s) => ({ ...s, address: "", postcode: "" })); }} className="rounded-full border px-4 py-2 text-[13px] font-extrabold" style={{ borderColor: tk.line, color: tk.ink, background: tk.inputBg }}>{tr("p7ck.addrNo")}</button>
                </div>
              )}
            </div>
          ) : (
          <>
          <label className="mb-0.5 block text-[10.5px] font-extrabold uppercase tracking-wide" style={{ color: tk.muted }}>{tr("p7ck.pcLabel")}</label>
          <input value={serviceAddress.postcode} onChange={(e) => setServiceAddress((s) => ({ ...s, postcode: e.target.value.toUpperCase() }))} placeholder="e.g. MK10 9NR" autoComplete="postal-code"
            className={`w-full border px-3 py-2 text-[14px] font-bold outline-none ${tk.round}`}
            style={{ background: tk.inputBg, borderColor: pcState.status === "ok" ? "#15b364" : pcState.status === "bad" ? "#dc2626" : serviceAddress.postcode.trim() ? tk.line : tk.accent, color: tk.ink }} />
          <div className="mt-1 text-[12px] font-bold" aria-live="polite">
            {pcState.status === "checking" && <span style={{ color: tk.muted }}>{tr("p7ck.pcChecking")}</span>}
            {pcState.status === "ok" && <span style={{ color: "#0f7a43" }}>{pcState.area ? tr("p7ck.pcOk", { pc: pcState.pc ?? "", area: pcState.area }) : tr("p7ck.pcOkNoArea", { pc: pcState.pc ?? "" })}</span>}
            {pcState.status === "bad" && <span style={{ color: "#dc2626" }}>{pcState.msg}</span>}
            {(pcState.status === "idle") && <span style={{ color: tk.muted }}>{serviceAddress.postcode.trim() ? (addressPrefilled ? tr("p7ck.addrPrefilled") : tr("p7ck.addrWhere")) : tr("p7ck.addrNeed")}</span>}
          </div>
          <input value={serviceAddress.address} onChange={(e) => setServiceAddress((s) => ({ ...s, address: e.target.value }))} placeholder={tr("p7ck.adrVisitLine")}
            className={`mt-2 w-full border px-3 py-2 text-[13px] outline-none ${tk.round}`}
            style={{ background: tk.inputBg, borderColor: tk.line, color: tk.ink }} />
          {serviceAddress.address.trim() && !visitLineHasHouse(serviceAddress.address) && <div className="mt-1 text-[12px] font-bold" style={{ color: "#dc2626" }}>{tr("p7ck.adrNeedHouse")}</div>}
          <div className="mt-1 text-[11px]" style={{ color: tk.muted }}>
            {tr("p7ck.pcWhy")}
            <div className="mt-0.5 font-bold">🔒 {tr("p9tx.hvParentAddr")}</div>
          </div>
          </>
          )}
          <label className="mb-0.5 mt-3 block text-[11px] font-bold" style={{ color: tk.muted }}>{tr("p7ck.notesLabel")}</label>
          <textarea value={serviceAddress.notes} maxLength={500} rows={2} onChange={(e) => setServiceAddress((s) => ({ ...s, notes: e.target.value }))} placeholder={tr("p7ck.notesPh")}
            className={`w-full border px-3 py-2 text-[13px] outline-none ${tk.round}`} style={{ background: tk.inputBg, borderColor: tk.line, color: tk.ink }} />
          <div className="mt-0.5 text-[11px]" style={{ color: tk.muted }}>🔒 {tr("p7ck.notesWarn")}</div>
        </div>
      )}

      {ckStage === "pay" && <button className={`mt-3 w-full py-3 text-[13.5px] font-extrabold disabled:opacity-40 ${tk.round}`} style={{ background: tk.accent, color: tk.accentInk }}
        disabled={(!parentMode && !b.parent) || (parentMode && !phoneOk) || (homeVisit && (askSaved || (savedIncomplete && useSaved !== false) || !serviceAddress.postcode.trim() || pcState.status === "bad" || pcState.status === "checking" || (useSaved !== true && !visitLineHasHouse(serviceAddress.address)))) || roster.length === 0 || unassigned > 0 || shortPasses.length > 0 || clashes.length > 0 || existingClashes.length > 0 || ticketAgeBlocks || !!booking?.busy || (method === "voucher" && !!chosenVoucher && refKids.some((c) => !(voucherRefs[c.name] ?? "").trim())) || (method === "tfc" && roster.some((c) => !(voucherRefs[c.name] ?? "").trim()))}
        onClick={() => {
          b.setChild(Object.values(b.assign).filter(Boolean).join(", "));
          // With an onBook handler the confirm actually books — the parent
          // checkout AND the operator's Take a booking. Without one (the
          // wizard's preview) it just shows the done screen.
          // For a voucher the scheme is part of the answer — a bookings list
          // showing "voucher" with no scheme can't be reconciled against the
          // money when it arrives. Fold it into the stored method so it's
          // there even before the server learns the dedicated field (§Q).
          const submitMethod =
            method === "voucher"
              ? chosenVoucher
                ? `Childcare voucher — ${chosenVoucher.name}`
                : "Childcare voucher"
              : method;
          if (onBook) onBook({
            parent: b.parent ?? null,
            method: submitMethod,
            // The scheme the parent picked — the backend keys the "Awaiting
            // voucher payment" state off this, not the method string.
            // TFC rides the same rail: the server keys "Awaiting voucher
            // payment" off voucherScheme, and Reconciliation buckets it as
            // Tax-Free Childcare from the scheme name.
            voucherScheme: method === "voucher" ? chosenVoucher?.name : method === "tfc" ? "HMRC Tax-Free Childcare" : undefined,
            // The parent's own payment reference per child (voucher/TFC matching).
            voucherRefs: method === "voucher" || method === "tfc" ? voucherRefs : undefined,
            // Split payment: how much comes from HMRC and how the rest is
            // settled. `cardPaid` on the booking is the field that already
            // exists for this; the server side is Amir's.
            tfc: method === "tfc" ? {
              amount: Math.min(amountDue, Math.max(0, parseFloat(tfcAmount || String(amountDue)) || 0)),
              remainderVia: tfcRest,
              references: voucherRefs,
            } : undefined,
            discountCodes: appliedCodes.map((a) => a.code),
            // The parent's contact number (required above); lands on their
            // family record if it hasn't got one yet.
            phone: parentMode ? phone.trim() || undefined : undefined,
            // Only sent when the family chose to spend LESS than their full
            // balance — otherwise the server auto-applies it all (authoritative).
            walletCap: walletUse === null ? undefined : walletApplied,
            serviceAddress: homeVisit && serviceAddress.postcode.trim() ? serviceAddress : undefined,
            // Operator-only: the agreed total, applied by the server after discounts (never honoured for a parent's own booking).
            overrideTotal: !parentMode && b.totalOverride !== null ? b.totalOverride : undefined,
            overrideReason: !parentMode && b.totalOverride !== null ? overrideReason.trim() || undefined : undefined,
            basket: b.basket, addonSel: b.addonSel, addonAns: b.addonAns, mealSel: b.mealSel, children: roster,
            // Resolved here so the caller gets plain "who's on what" rather than exceptions.
            dayAssign: Object.fromEntries(b.basket.map((x) => [x.id, Object.fromEntries(x.dates.map((iso) => [iso, b.childrenOn(x.id)]))])),
          });
          else b.setStage("done");
        }}>
        {booking?.busy ? tr("p7ck.ctaBooking")
          : !parentMode && !b.parent ? tr("p7ck.findParentFirst")
          : parentMode && !phoneOk ? tr("p7ck.ctaAddPhone")
          : homeVisit && askSaved ? tr("p7ck.ctaConfirmAddr")
          : homeVisit && (!serviceAddress.postcode.trim() || pcState.status === "bad") ? tr("p7ck.ctaVisitAddr")
          : roster.length === 0 ? tr("p7ck.ctaAddChildFirst")
          : ticketAgeBlocks ? ticketAgeText(ticketAgeIssues[0])
          : unassigned > 0 ? pickPlural(tr, locale, "p7ck.ctaNobody", unassigned)
          : clashes.length > 0 ? tr("p7ck.ctaClash", { name: clashes[0].name, date: fmtDate(clashes[0].iso) })
          : existingClashes.length > 0 ? tr("p9tx.ckAlreadyBooked", { name: existingClashes[0].name, date: String(fmtDate(existingClashes[0].iso)) })
          : shortPasses.length > 0 ? tr("p7ck.ctaShort", { n: shortPasses[0].dates.length, pass: shortPasses[0].name })
          // "Confirm & pay £0.00" and "Send payment link · £0.00" both promise
          // something that isn't going to happen.
          : parentMode && b.waitlistOnly ? tr("p9tx.ckJoinWait")
          : grandTotal <= 0 ? (parentMode ? tr("p7ck.ctaConfirm") : tr("p7ck.ctaCreateFree"))
          // Paying by voucher happens on the scheme's website, not here — so
          // the button confirms the booking, it doesn't take a payment.
          : parentMode && method === "voucher" ? tr("p7ck.ctaConfirm")
          // Only a card is charged at this moment; the other rails are honest about it.
          : parentMode && method === "bank" ? `Confirm booking · ${money(amountDue)} to pay by bank transfer`
          : parentMode && method === "cash" ? `Confirm booking · pay ${money(amountDue)} in cash on the day`
          : parentMode && method === "tfc" ? `Confirm booking · ${money(amountDue)} to pay with Tax-Free Childcare`
          : parentMode && method === "haf" ? tr("p7ck.ctaConfirm")
          : parentMode && method === "card" && d.bookingType === "manual" ? tr("p8lst.holdCtaBtn", { amt: money(amountDue) })
          : parentMode ? tr("p7ck.ctaConfirmPay", { amt: money(amountDue) })
          : tr("p7ck.ctaSendLink", { amt: money(amountDue) })}
      </button>}
      {parentMode && method === "card" && d.bookingType === "manual" && grandTotal > 0 && (
        <div className="mt-2 rounded-lg px-3 py-2 text-[12px] font-semibold leading-[1.5]" style={{ background: "#fff7e0", color: "#7a4b00" }}>{tr("p8lst.holdCheckoutNote", { amt: money(amountDue) })}</div>
      )}

      <div className="mt-2 text-[11px] leading-[1.5]" style={{ color: tk.muted }}>{d.cancellation ? d.cancellation.charAt(0).toLocaleUpperCase() + d.cancellation.slice(1) : d.cancellation}</div>
      </div>
    </div>
    </>
  );
}
