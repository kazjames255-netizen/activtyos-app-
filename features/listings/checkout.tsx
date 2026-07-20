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

import { useEffect, useRef, useState } from "react";
import { get as apiGet, api } from "@/lib/api";
import { money, PAY_METHODS } from "@/features/bookings/helpers";
import { fmtDate, ordinal } from "./format";
import { uploadPlan, PLAN_MAX_BYTES } from "./planUpload";
import { useTenantSettings, questionsFor, dobRequired, asksEveryBooking, limitFor } from "@/lib/settings";
import { QuestionFields, unansweredRequired } from "@/components/QuestionFields";
import type { useBooking, BasketItem } from "./booking";
import type { AddonTemplate, LocalState } from "./FreelancerListingsApp";
import type { WizardDraft } from "./ListingWizard";

export type ParentRow = { id: string; name: string; email?: string; children?: ChildProfile[] };

export function useParents(skip = false) {
  const [list, setList] = useState<ParentRow[]>([]);
  // Derived, not set in the effect: a parent never has an address book to load.
  const [state, setState] = useState<"loading" | "ready" | "error">(skip ? "ready" : "loading");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (skip) return; // parents can't read /api/customers, and shouldn't
    let alive = true;
    apiGet<{ id: string; name?: string; email?: string; children?: ChildProfile[] }[]>("/api/customers")
      .then((cs) => {
        if (!alive) return;
        setList(cs.map((c) => ({ id: c.id, name: c.name || c.email || "Unnamed", email: c.email, children: c.children ?? [] })));
        setState("ready");
      })
      // An empty address book and a failed request look identical otherwise.
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Couldn't load your parents.");
        setState("error");
      });
    return () => {
      alive = false;
    };
  }, [skip]);
  return { list, state, error };
}
export type CkStage = "parent" | "who" | "extras" | "pay";

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
  photoConsent?: boolean;
  /** Required when adding a child; optional on the type because children saved
   *  before this was asked for don't have one. Those keep the neutral chip. */
  sex?: "boy" | "girl";
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
export function ageProblem(d: WizardDraft, c: ChildProfile): string | null {
  if (d.allowOutOfRange) return null; // the operator has said they'll take them
  const from = parseInt(d.ageFrom, 10), to = parseInt(d.ageTo, 10);
  if (!Number.isFinite(from) && !Number.isFinite(to)) return null;
  const age = ageOn(c.dob, d.runFrom);
  if (age === null) return null; // no date of birth yet — nothing to judge
  if (Number.isFinite(from) && age < from) return `${c.name || "This child"} would be ${age} — this listing is for ${d.ageFrom}–${d.ageTo}.`;
  if (Number.isFinite(to) && age > to) return `${c.name || "This child"} would be ${age} — this listing is for ${d.ageFrom}–${d.ageTo}.`;
  return null;
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
export function ChildrenPanel({ d, tk, saved, roster, setRoster, comingCount, onUnassignAll, onAdded, canSave = true }: {
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
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<ChildProfile>({ name: "", photoConsent: false });
  const label = { fontSize: 10, letterSpacing: "0.12em" } as const;
  const inp = `aos-in w-full border px-2.5 py-2 text-[12.5px] outline-none ${tk.round}`;
  // tk.line is a hairline meant for dividers; on the dark themes it left the
  // fields with no visible edge at all.
  const inpStyle = { background: tk.inputBg, borderColor: `${tk.ink}4d`, color: tk.ink };
  const problem = draft.name.trim() ? ageProblem(d, draft) : null;
  // The provider's own questions, narrowed to this listing and this child's
  // age. `d.runFrom` rather than today, matching ageProblem above: the age
  // that matters is the one they'll be on the first day they attend, and two
  // age rules disagreeing on the same screen would be indefensible.
  const { questions: allQuestions, settings } = useTenantSettings();
  // The form asks the "once" questions only. The every-booking ones are
  // rendered per child on the roster above, so listing them here too would
  // ask the same thing twice on the same screen.
  const askQuestions = questionsFor(allQuestions, d.id ?? undefined, ageOn(draft.dob, d.runFrom)).filter(
    (q) => !asksEveryBooking(q),
  );
  const needDob = dobRequired(settings, allQuestions).required;
  const pinMode = settings.collectionCheck === "pin";
  // Name, date of birth and boy/girl are required: the age gate can't judge a
  // booking without a birthday, and registers are drawn up from both. All of
  // them at once, not the first — being sent back three times running for one
  // more field each time is the worst version of this.
  const missing = [
    !draft.name.trim() && "their name",
    // Compulsory unless the provider has said otherwise — and never optional
    // while a question is age-gated, because there is no age without it.
    !draft.dob && needDob && "their date of birth",
    !draft.sex && settings.collectGender && "boy or girl",
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
    if (missing.length || problem) { setTried(true); return; }
    if (editing !== null) {
      setRoster(roster.map((c, i) => (i === editing ? draft : c)));
      // Keep their saved profile in step with the edit, when there is one.
      if (canSave && draft.id) void api(`/api/my/children/${encodeURIComponent(draft.id)}`, { method: "PUT", body: JSON.stringify(draft) }).catch(() => {});
    } else {
      onAdded(draft.name.trim());
      setRoster([...roster, draft]);
    }
    setDraft({ name: "", photoConsent: false });
    setEditing(null);
    setTried(false);
    setOpen(false);
  };


  return (
    <>
      <div className="mt-4 font-bold uppercase" style={{ ...label, color: tk.muted }}>Your children</div>

      {saved.length > 0 && (
        <div className="mt-1.5">
          <div className="text-[11px]" style={{ color: tk.muted }}>Click to add child to dates.</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {/* Every saved child stays on the row whether they're coming or
                not — one dropping out of sight because it hasn't been added
                yet looks like it's been lost. The chip just changes state. */}
            {[...new Map(saved.map((sv) => [sv.name.trim().toLowerCase(), sv])).values()].map((sv) => {
              const bad = ageProblem(d, sv);
              const added = roster.some((r) => (r.id && r.id === sv.id) || r.name === sv.name);
              const c = sexTint(sv.sex, added);
              return (
                <button key={sv.id ?? sv.name} type="button" disabled={!!bad}
                  title={bad ?? (added ? `Take ${sv.name} off this booking` : `Add ${sv.name} to this booking`)}
                  onClick={() => {
                    if (added) { setRoster(roster.filter((r) => !((r.id && r.id === sv.id) || r.name === sv.name))); return; }
                    onAdded(sv.name.trim());
                    setRoster([...roster, sv]);
                  }}
                  className={`border-2 px-3 py-1.5 text-[12px] font-bold disabled:opacity-45 ${tk.round}`}
                  style={{ borderColor: c.border, background: c.bg, color: c.ink }}>
                  {added ? "✓ " : "+ "}{sv.name}{bad ? " · out of age range" : ""}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {roster.length > 0 && (
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {roster.map((c, i) => {
            const on = comingCount(c.name.trim());
            // Same two strengths as the chips below: soft while a child is only
            // listed, solid once they're on something.
            return (
              <div key={`${c.name}-${i}`} className={`border-2 px-3 py-2 ${tk.round}`}
                style={{ borderColor: sexTint(c.sex, true).border, background: sexTint(c.sex, true).bg }}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex-1 text-[12.5px] font-bold" style={{ color: sexTint(c.sex, true).ink }}>
                    {c.name}
                    {c.dob && <span className="ml-1.5 text-[11px] font-semibold" style={{ color: "rgba(255,255,255,.8)" }}>age {ageOn(c.dob, d.runFrom) ?? "—"}</span>}
                  </span>
                  {/* On the solid fill the muted greys vanish, so the actions
                      follow the row's state too. */}
                  <button type="button" onClick={() => { setDraft(c); setEditing(i); setOpen(true); }}
                    className="text-[11.5px] font-bold" style={{ color: "rgba(255,255,255,.9)" }}>Edit details</button>
                  {/* Off the booking entirely — their dates go and they drop
                      back to a pale chip above, ready to add again. Deleting
                      the profile belongs in the profile area, not mid-booking. */}
                  <button type="button"
                    onClick={() => { onUnassignAll(c.name.trim()); setRoster(roster.filter((_, n) => n !== i)); }}
                    className="text-[11.5px] font-bold" style={{ color: "rgba(255,255,255,.9)" }}>Not coming</button>
                </div>
                {/* Says what just happened and where to change it — a child
                    silently landing on every date is the surprise worth
                    heading off. */}
                <div className="mt-1 text-[11px] leading-[1.45]" style={{ color: "rgba(255,255,255,.85)" }}>
                  {on > 0
                    ? "Added to all dates — you can take them off individual dates below."
                    : "Not on any dates yet — tap their name on a pass below."}
                </div>
              </div>
            );
          })}
        </div>
      )}

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
              About {c.name.trim() || "this child"}, for this booking
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

      {!open ? (
        <button type="button" onClick={() => setOpen(true)}
          className={`mt-2 w-full border border-dashed px-3 py-2 text-[12.5px] font-bold ${tk.round}`}
          style={{ borderColor: tk.line, color: tk.ink }}>
          ＋ Add a new child
        </button>
      ) : (
        <div className={`mt-2 border p-3 ${tk.round}`} style={{ borderColor: tk.line }}>
          <div className="flex flex-wrap gap-2">
            <div className="min-w-[150px] flex-1">
              <div className="mb-1 text-[11px] font-bold" style={{ color: tk.ink }}>Child&rsquo;s full name <span style={{ color: "#f87171" }}>*</span></div>
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="First and last name" className={inp} style={{ ...inpStyle, ...flag(!draft.name.trim()) }} />
            </div>
            <div className="w-[150px]">
              <div className="mb-1 text-[11px] font-bold" style={{ color: tk.ink }}>Date of birth {needDob ? <span style={{ color: "#f87171" }}>*</span> : <span className="font-normal">— optional</span>}</div>
              <input type="date" value={draft.dob ?? ""} onChange={(e) => setDraft({ ...draft, dob: e.target.value })}
                className={inp} style={{ ...inpStyle, ...flag(!draft.dob) }} />
            </div>
          </div>

          {problem && (
            <div className={`mt-2 border px-3 py-2 text-[12px] font-bold ${tk.round}`}
              style={{ borderColor: "#f87171", background: "rgba(248,113,113,.12)", color: "#fca5a5" }}>{problem}</div>
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
              title={draft.photo ? "Change photo" : "Add a photo"}>
              {draft.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={draft.photo} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-[20px]">📷</span>
              )}
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-[11.5px] font-bold" style={{ color: tk.ink }}>
                A photo of {draft.name.trim() || "your child"} <span className="font-normal">— optional</span>
              </div>
              <div className="mt-0.5 text-[10.5px] leading-[1.45]" style={{ color: tk.muted }}>
                It goes on the register so staff who haven&rsquo;t met them know who they&rsquo;re
                greeting, and who they&rsquo;re handing over to at the end of the day.
              </div>
              {draft.photo ? (
                <button type="button" onClick={() => setDraft({ ...draft, photo: undefined })}
                  className="mt-1 text-[10.5px] font-bold" style={{ color: tk.muted }}>Remove photo</button>
              ) : (
                <button type="button" onClick={() => photoRef.current?.click()}
                  className={`mt-1.5 border-2 px-2.5 py-1 text-[11px] font-extrabold ${tk.round}`}
                  style={{ borderColor: tk.accent, color: tk.accent }}>📷 Add a photo</button>
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
              Collection {pinMode ? "PIN" : "password"} <span className="font-normal">— optional</span>
            </div>
            <div className="mb-1.5 text-[10.5px] leading-[1.45]" style={{ color: tk.muted }}>
              Pick {pinMode ? "a number" : "a word"} only your family knows. If <b style={{ color: tk.ink }}>anyone other than you</b> comes
              to collect {draft.name.trim() || "your child"} — a grandparent, a friend, another parent on the
              school run — staff will ask them for it, and won&rsquo;t hand over without it.
            </div>
            <input value={draft.collectionPassword ?? ""}
              maxLength={CHILD_LIMITS.collectionPassword}
              onChange={(e) => setDraft({ ...draft, collectionPassword: e.target.value })}
              inputMode={pinMode ? "numeric" : undefined}
              placeholder={pinMode ? "e.g. 4816" : "e.g. Bluebell"} className={inp} style={inpStyle} />
            <div className="mt-1 text-[10px] leading-[1.4]" style={{ color: tk.muted }}>
              Staff can see this {pinMode ? "PIN" : "word"}, so don&rsquo;t use a password from anywhere else.
            </div>
          </div>
          )}

          <div className="mt-2">
            <div className="mb-1 text-[11px] font-bold" style={{ color: tk.ink }}>Allergies <span className="font-normal">— optional</span></div>
            <input value={draft.allergies ?? ""} onChange={(e) => setDraft({ ...draft, allergies: e.target.value })}
              maxLength={limitFor(settings, "allergies", CHILD_LIMITS)} placeholder="Nuts, dairy…" className={inp} style={inpStyle} />
          </div>
          <div className="mt-2">
            <div className="mb-1 text-[11px] font-bold" style={{ color: tk.ink }}>Medical <span className="font-normal">— optional</span></div>
            <input value={draft.medical ?? ""} onChange={(e) => setDraft({ ...draft, medical: e.target.value })}
              maxLength={limitFor(settings, "medical", CHILD_LIMITS)} placeholder="Asthma inhaler, epilepsy plan…" className={inp} style={inpStyle} />
          </div>
          {settings.collectSend && (
          <div className="mt-2">
            <div className="mb-1 text-[11px] font-bold" style={{ color: tk.ink }}>SEND / additional needs <span className="font-normal">— optional</span></div>
            <input value={draft.send ?? ""} onChange={(e) => setDraft({ ...draft, send: e.target.value })}
              maxLength={limitFor(settings, "send", CHILD_LIMITS)} placeholder="Autism, ADHD, 1:1 support, sensory needs…" className={inp} style={inpStyle} />
            {/* The upload only appears once they've told us there's something
                to support — asking for a plan before that is asking twice. */}
            {settings.collectSendPlan && !!draft.send?.trim() && (
              <div className={`mt-2 border border-dashed p-2.5 ${tk.round}`} style={{ borderColor: `${tk.ink}4d` }}>
                <div className="text-[11px] font-bold" style={{ color: tk.ink }}>
                  SEND or EHCP plan <span className="font-normal">— optional</span>
                </div>
                <div className="mt-0.5 text-[10.5px] leading-[1.45]" style={{ color: tk.muted }}>
                  If you have one, upload it so staff can read it before day one. PDF or image, up to {PLAN_MAX_BYTES / 1_000_000}MB.
                </div>
                {draft.sendPlanId ? (
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[11.5px] font-bold" style={{ color: tk.ink }}>
                      📎 {draft.sendPlanName ?? "Plan attached"}
                    </span>
                    <button type="button" onClick={() => setDraft({ ...draft, sendPlanId: undefined, sendPlanName: undefined })}
                      className="text-[11px] font-bold" style={{ color: tk.muted }}>Remove</button>
                  </div>
                ) : planPct !== null ? (
                  <div className="mt-2">
                    <div className="text-[11.5px] font-bold" style={{ color: tk.ink }}>Uploading… {Math.round(planPct * 100)}%</div>
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
                    <span aria-hidden>📎</span> Choose a file to upload
                  </button>
                )}
                {!draft.sendPlanId && (
                  <input ref={planRef} type="file" accept="application/pdf,image/*" className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (!f) return;
                      if (f.size > PLAN_MAX_BYTES) {
                        setPlanError(`${f.name} is ${Math.round(f.size / 1_000_000)}MB — the limit is ${PLAN_MAX_BYTES / 1_000_000}MB.`);
                        return;
                      }
                      setPlanError(null);
                      setPlanPct(0);
                      try {
                        const ref = await uploadPlan(f, setPlanPct);
                        setDraft({ ...draft, sendPlanId: ref.id, sendPlanName: ref.name });
                      } catch (err) {
                        setPlanError(err instanceof Error ? err.message : "That upload didn't finish — try again.");
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
            <div className="mb-1 text-[11px] font-bold" style={{ color: tk.ink }}>Likes &amp; dislikes <span className="font-normal">— optional</span></div>
            <div className="mb-1 text-[10.5px] leading-[1.45]" style={{ color: tk.muted }}>
              What settles them and what doesn&rsquo;t — football and drawing, or loud rooms and being rushed. It helps staff on day one.
            </div>
            <div className="flex flex-wrap gap-2">
              <input value={draft.likes ?? ""} onChange={(e) => setDraft({ ...draft, likes: e.target.value })} maxLength={limitFor(settings, "likes", CHILD_LIMITS)}
                placeholder="Likes…" className={`${inp} min-w-[130px] flex-1`} style={inpStyle} />
              <input value={draft.dislikes ?? ""} onChange={(e) => setDraft({ ...draft, dislikes: e.target.value })} maxLength={limitFor(settings, "dislikes", CHILD_LIMITS)}
                placeholder="Dislikes…" className={`${inp} min-w-[130px] flex-1`} style={inpStyle} />
            </div>
          </div>

          {/* The provider's own questions. Same list the operator sees on the
              Families screen, so an answer given here is the answer there. */}
          <QuestionFields
            questions={askQuestions}
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

          {/* A provider with no reason to ask can switch this off entirely in
              Setup — asking a parent to sex their child for no purpose isn't
              a neutral default. */}
          {settings.collectGender && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <span className="flex-1 text-[12px]" style={{ color: tk.ink }}>Boy or girl? <span style={{ color: "#f87171" }}>*</span></span>
            {([["boy", "Boy"], ["girl", "Girl"]] as const).map(([v, l]) => {
              const on = draft.sex === v;
              const c = sexTint(v);
              return (
                <button key={v} type="button" onClick={() => setDraft({ ...draft, sex: on ? undefined : v })}
                  className={`border-2 px-3 py-1 text-[11.5px] font-bold ${tk.round}`}
                  style={on
                    ? { borderColor: c.border, background: c.bg, color: c.ink }
                    : { borderColor: `${tk.ink}59`, color: tk.ink, ...flag(!draft.sex) }}>
                  {l}
                </button>
              );
            })}
            <span className="w-full text-[10.5px]" style={{ color: tk.muted }}>Used on the register and to colour their name in your list.</span>
          </div>
          )}

          {/* Permission to USE photos of them — not the photo above, which is
              for staff to recognise them. A provider who never publishes
              photos shouldn't be asking families to rule on it. */}
          {settings.askPhotoConsent && (
            <div className="mt-2.5 flex items-center gap-2">
              <span className="flex-1 text-[12px]" style={{ color: tk.ink }}>Happy for photos of them to be used?</span>
              {[["Yes", true], ["No", false]].map(([l, v]) => (
                <button key={String(l)} type="button" onClick={() => setDraft({ ...draft, photoConsent: v as boolean })}
                  className={`border px-3 py-1 text-[11.5px] font-bold ${tk.round}`}
                  style={draft.photoConsent === v
                    ? { borderColor: tk.accent, background: tk.accent, color: tk.accentInk }
                    : { borderColor: `${tk.ink}59`, color: tk.ink }}>{l as string}</button>
              ))}
            </div>
          )}

          {tried && missing.length > 0 && !problem && (
            <div className={`mt-2.5 border px-3 py-2 text-[12px] font-bold ${tk.round}`}
              style={{ borderColor: "#f87171", background: "rgba(248,113,113,.12)", color: "#fca5a5" }}>
              Before you can add {draft.name.trim() || "this child"}, we still need{" "}
              {missing.length === 1 ? missing[0] : `${missing.slice(0, -1).join(", ")} and ${missing[missing.length - 1]}`}.
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={add}
              className={`flex-1 py-2 text-[12.5px] font-extrabold ${tk.round}`}
              style={{ background: tk.accent, color: tk.accentInk }}>{editing !== null ? "Save details" : "Add child"}</button>
            <button type="button" onClick={() => { setOpen(false); setEditing(null); setTried(false); setDraft({ name: "", photoConsent: false }); }}
              className="text-[12px] font-bold" style={{ color: tk.muted }}>Cancel</button>
          </div>
        </div>
      )}
    </>
  );
}
export function CheckoutPanel({ b, d, addons, tk, mode = "operator", onBook, booking }: {
  b: ReturnType<typeof useBooking>; d: WizardDraft; addons: LocalState["addons"]; tk: CkTheme;
  mode?: "operator" | "parent";
  onBook?: (p: { method: string; basket: BasketItem[]; addonSel: Record<string, Record<string, string[]>>; addonAns: Record<string, Record<string, string>>; children: ChildProfile[]; dayAssign: Record<string, Record<string, string[]>> }) => void;
  booking?: { busy: boolean; error: string | null };
}) {
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
  // The provider's own child questions, for the every-booking ones this stage
  // both asks and enforces.
  const { questions: ckQuestions, settings: ckSettings } = useTenantSettings();
  // Settings arrive after first paint, so the state above starts on the
  // compiled-in default. Derive the one actually in force rather than
  // correcting the state afterwards: a booking must never be recorded against
  // a method the provider has removed, and there's no moment where the two
  // disagree if it's computed.
  const payList: readonly string[] = ckSettings.payMethods.length ? ckSettings.payMethods : PAY_METHODS;
  const method = parentMode || payList.includes(rawMethod) ? rawMethod : payList[0];
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
  const { roster, setRoster } = b;
  // Store the EXCEPTIONS, not the assignments: who has been taken off which
  // day. A child is therefore on everything the moment they're added, with no
  // seeding step to go wrong — the previous version tracked "who's new" in a
  // ref mutated inside a setState updater, which React re-runs, so a newly
  // added child could be filtered straight back out.
  const [q, setQ] = useState("");
  // A family being created on the call. Held here until there's a server route
  // that can make the account — see §H of the backend handoff.
  const [np, setNp] = useState({ name: "", email: "", phone: "", address: "" });
  const npReady = np.name.trim().length > 1 && /.+@.+\..+/.test(np.email.trim()) && !!np.phone.trim() && !!np.address.trim();
  const matches = q.trim()
    ? parents.filter((p) => `${p.name} ${p.email ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6)
    : [];
  useEffect(() => {
    if (!parentMode) return;
    // Signed out this 401s, which is fine — they just type the details in.
    apiGet<ChildProfile[]>("/api/my/children").then(setSaved).catch(() => {});
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
  const calculated = b.total + addonTotal;
  const grandTotal = b.totalOverride ?? calculated;
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
  const unassigned = shortPasses.length;
  const label = { fontSize: 10, letterSpacing: "0.12em" } as const;

  // Where we are in the sequence: dates, children, one step per extra, pay.
  // Each extra is named, because "Extra 2" tells a parent looking for the
  // t-shirt nothing at all.
  const steps = [
    "Dates",
    ...(parentMode ? [] : ["Parent"]),
    "Children",
    ...ordered.map((a) => a.name),
    parentMode ? "Pay" : "Payment",
  ];
  /** Where "Children" sits — one further along for an operator. */
  const whoAt = parentMode ? 1 : 2;
  const stepNow = ckStage === "parent" ? 1
    : ckStage === "who" ? whoAt
    : ckStage === "extras" ? whoAt + 1 + extraIdx
    : steps.length - 1;
  // Anything already passed can be jumped straight back to. Forward is not
  // offered: the extras depend on who is on which pass, so skipping ahead
  // would ask a question whose answer isn't settled yet.
  const goStep = (i: number) => {
    if (i >= stepNow) return;
    if (i === 0) { b.setStage("pick"); return; }
    if (!parentMode && i === 1) { setCkStage("parent"); return; }
    if (i === whoAt) { setCkStage("who"); return; }
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
          lunches to reach it. */}
      {steps.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {steps.map((name, i) => {
            const done = i < stepNow, now = i === stepNow;
            return (
              <button key={`${name}-${i}`} type="button" onClick={() => goStep(i)} disabled={i > stepNow}
                title={done ? `Back to ${name.toLowerCase()}` : name}
                className={`border-2 px-2.5 py-1 text-[11.5px] font-extrabold transition-colors ${tk.round}`}
                style={now
                  ? { borderColor: tk.accent, background: tk.accent, color: tk.accentInk }
                  : done
                    ? { borderColor: `${tk.ink}59`, color: tk.ink, background: "transparent", cursor: "pointer" }
                    : { borderColor: tk.line, color: tk.muted, background: "transparent" }}>
                {done && <span aria-hidden>← </span>}{name}
              </button>
            );
          })}
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
                  className={`w-[74px] border px-2 py-1 text-right text-[12.5px] font-bold outline-none ${tk.round}`}
                  style={{ background: tk.inputBg, borderColor: b.priceEdit[x.id] !== undefined ? tk.accent : tk.line, color: tk.ink }} />
              </span>
            )}
          </div>
        ))}
        {!parentMode && <div className="text-[10.5px]" style={{ color: tk.muted }}>Prices are editable — discounts recalculate from what you set.</div>}
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
            {b.parent.id === "new" && <span className="ml-1.5 text-[11px] font-normal" style={{ color: tk.muted }}>— new account</span>}
          </span>
          <button type="button" onClick={() => b.setParent(null)} className="text-[11.5px] font-bold" style={{ color: tk.muted }}>Change</button>
        </div>
      ) : (
        <>
          <div className="mt-4 font-bold uppercase" style={{ ...label, color: tk.ink }}>Whose booking is this?</div>

          <div className={`mt-2 border p-3 ${tk.round}`} style={{ borderColor: tk.line }}>
            <div className="text-[12.5px] font-extrabold" style={{ color: tk.ink }}>1 · They&rsquo;re on your books</div>
            <div className="mb-2 mt-0.5 text-[11.5px] leading-[1.5]" style={{ color: tk.ink }}>
              Anyone who has booked with you before. The booking goes on the account they already
              have, with their children ready to pick. Someone who only registered — and never
              booked with you — won&rsquo;t be here; use option 2 and we&rsquo;ll link their account.
            </div>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email…"
              className={`w-full border px-3 py-2 text-[13px] outline-none ${tk.round}`} style={{ background: tk.inputBg, borderColor: tk.line, color: tk.ink }} />
            <div className="mt-1 text-[11px]" style={{ color: parentsState === "error" ? "#fca5a5" : tk.ink }}>
              {parentsState === "loading"
                ? "Loading your parents…"
                : parentsState === "error"
                  ? `Couldn't load your parents — ${parentsError}`
                  : parents.length === 0
                    ? "No families on your account yet — use option 2."
                    : `${parents.length} famil${parents.length === 1 ? "y" : "ies"} on your account`}
            </div>
            {q.trim() && (
              <div className="mt-1.5 flex flex-col gap-1">
                {matches.map((p) => (
                  <button key={p.id} type="button" onClick={() => { b.setParent(p); setQ(""); }}
                    className={`border px-3 py-2 text-left text-[12.5px] ${tk.round}`} style={{ borderColor: tk.line, color: tk.ink }}>
                    <b>{p.name}</b>{p.email ? <span className="ml-1.5 text-[11px]" style={{ color: tk.muted }}>{p.email}</span> : null}
                  </button>
                ))}
                {matches.length === 0 && (
                  <div className="text-[11px]" style={{ color: tk.muted }}>Nobody by that name has booked with you — use option 2 below.</div>
                )}
              </div>
            )}
          </div>

          <div className={`mt-2 border p-3 ${tk.round}`} style={{ borderColor: tk.line }}>
            <div className="text-[12.5px] font-extrabold" style={{ color: tk.ink }}>2 · Anyone else</div>
            <div className="mt-0.5 text-[11.5px] leading-[1.5]" style={{ color: tk.ink }}>
              New to you, or registered but never booked. If that email already has an ActivityOS
              account we&rsquo;ll use it rather than making a second; if not, they get one. Either way
              they&rsquo;re emailed the booking, a way to set a password, and a link to pay. Ask them for:
            </div>
            <div className="mt-1.5 mb-2 text-[11px] leading-[1.6]" style={{ color: tk.ink }}>
              <b>Now:</b> their name, email, phone and address.<br />
              <b>Next step:</b> each child&rsquo;s name, date of birth and boy/girl.
            </div>
            {(["name", "email", "phone", "address"] as const).map((k) => (
              <div key={k} className="mb-1.5">
                <div className="mb-1 text-[10.5px] font-bold" style={{ color: tk.ink }}>
                  {{ name: "Parent's full name", email: "Email", phone: "Phone", address: "Address" }[k]}
                </div>
                <input value={np[k]} onChange={(e) => setNp({ ...np, [k]: e.target.value })}
                  className={`aos-in w-full border px-2.5 py-2 text-[12.5px] outline-none ${tk.round}`}
                  style={{ background: tk.inputBg, borderColor: `${tk.ink}4d`, color: tk.ink }} />
              </div>
            ))}
            {/* A mistyped address creates an account for a stranger holding a
                child's name and date of birth, so it gets read back. */}
            {npReady && (
              <div className={`mb-2 border px-3 py-2 text-[11.5px] leading-[1.5] ${tk.round}`}
                style={{ borderColor: tk.accent, background: `${tk.accent}1a`, color: tk.ink }}>
                Their login and booking go to <b>{np.email.trim()}</b> — read it back to them before you carry on.
              </div>
            )}
            <button type="button" disabled={!npReady}
              onClick={() => b.setParent({ id: "new", name: np.name.trim(), email: np.email.trim(), phone: np.phone.trim(), address: np.address.trim() })}
              className={`w-full py-2 text-[12.5px] font-extrabold disabled:opacity-40 ${tk.round}`}
              style={{ background: tk.accent, color: tk.accentInk }}>
              {npReady ? `Set up ${np.name.trim()} →` : "Fill in all four to carry on"}
            </button>
          </div>
        </>
      )}

      {!parentMode && ckStage === "parent" && (
        <button type="button" disabled={!b.parent} onClick={() => setCkStage("who")}
          className={`mt-3 w-full py-2.5 text-[13px] font-extrabold disabled:opacity-40 ${tk.round}`}
          style={{ background: tk.accent, color: tk.accentInk }}>
          {b.parent ? `Book for ${b.parent.name} →` : "Find the parent first"}
        </button>
      )}

      {/* 2 · a child and their extras, per pass */}
      {ckStage === "who" && (
        <>
          {(
            <ChildrenPanel d={d} tk={tk} saved={savedFor} roster={roster} setRoster={setRoster} canSave={parentMode}
              comingCount={(name) => b.basket.filter((x) => b.childrenOn(x.id).includes(name)).length}
                      onUnassignAll={(name) => b.basket.forEach((x) => { if (b.childrenOn(x.id).includes(name)) b.toggleChild(x.id, name); })}
              onAdded={(name) => b.clearRemovalsFor(name)}
 />
          )}
          <div className="mt-4 font-bold uppercase" style={{ ...label, color: tk.muted }}>Who&rsquo;s on each pass</div>
          {(
            <div className="mt-1.5 text-[11px]" style={{ color: tk.muted }}>
              {roster.length === 0
                ? "Add a child above to get started."
                : "Tap a name to take them off."}
            </div>
          )}

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
                        <span className="flex-none text-right text-[12px]">
                          <b style={{ color: tk.ink }}>{money(b.priceOf(x) * heads)}</b>
                          {heads > 1 && <span className="block text-[10.5px]" style={{ color: tk.muted }}>{money(b.priceOf(x))} × {heads}</span>}
                        </span>
                      );
                    })()}
                    <button type="button" onClick={() => b.removeItem(x.id)}
                      title={x.dates.length === 1 ? "Remove this day" : `Remove this ${x.dates.length}-day pass`}
                      className="flex-none px-1 text-[15px] leading-none"
                      style={{ color: tk.muted }}>×</button>
                  </div>

                  {/* Every day, not just the first few — you can't take a child
                      off a day the list doesn't show. */}
                  {(
                    <div className="mt-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px]" style={{ color: tk.muted }}>
                          {x.dates.length === 1 ? "Who's coming" : `Who's on all ${x.dates.length} days`}
                        </span>
                        {roster.length === 0 && <span className="text-[11px]" style={{ color: "#c2410c" }}>add a child above</span>}
                        {roster.map((c) => {
                          const name = c.name.trim();
                          const going = b.childrenOn(x.id).includes(name);
                          return (
                            <button key={name} type="button" onClick={() => b.toggleChild(x.id, name)}
                              title={x.dates.length === 1
                                ? (going ? `Take ${name} off this day` : `Put ${name} on this day`)
                                : (going ? `Take ${name} off this ${x.dates.length}-day pass` : `Put ${name} on this ${x.dates.length}-day pass`)}
                              className={`border-2 px-2.5 py-[3px] text-[11.5px] font-bold ${tk.round}`}
                              style={going
                                ? { borderColor: sexTint(c.sex, true).border, background: sexTint(c.sex, true).bg, color: sexTint(c.sex, true).ink }
                                : { borderColor: "#c3c9d6", background: "#eceff5", color: "#5a6478" }}>
                              {going ? "✓ " : "+ "}{name}
                            </button>
                          );
                        })}
                      </div>
                      {clashesOn(x.id).length > 0 && (
                        <div className="mt-1.5 border px-2.5 py-1.5 text-[11px] leading-[1.45]"
                          style={{ borderColor: "#fed7aa", background: "#fff7ed", color: "#9a3412" }}>
                          {[...new Set(clashesOn(x.id).map((c) => c.name))].join(" and ")} {clashesOn(x.id).length === 1 ? "is" : "are"} already
                          booked at this time on {[...new Set(clashesOn(x.id).map((c) => fmtDate(c.iso)))].join(", ")} in another pass.
                          Take them off one of the two, or pick a session at a different time.
                        </div>
                      )}
                      {b.childrenOn(x.id).length === 0 && roster.length > 0 && (
                        <div className="mt-1 text-[11px]" style={{ color: "#c2410c" }}>
                          Nobody&rsquo;s on this {x.dates.length === 1 ? "day" : "pass"} — remove it or put a child on it.
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
                              <span style={{ color: tk.muted }}>Cost</span>
                              <span style={{ color: tk.ink }}>{money(gross)}</span>
                            </div>
                            {savings.map((sv) => (
                              <div key={sv.name} className="flex items-baseline justify-between gap-3 text-[11px]">
                                <span className="min-w-0" style={{ color: tk.muted }}>
                                  {sv.name}
                                  {sv.terms && <span className="ml-1 opacity-70">({sv.terms})</span>}
                                </span>
                                <span className="flex-none font-bold" style={{ color: tk.accent }}>−{money(sv.amount)}</span>
                              </div>
                            ))}
                            <div className="mt-0.5 flex items-baseline justify-between gap-3 border-t pt-1 text-[12.5px] font-extrabold"
                              style={{ borderColor: tk.line }}>
                              <span style={{ color: tk.ink }}>Pass total</span>
                              <span style={{ color: tk.ink }}>{money(Math.max(0, gross - off))}</span>
                            </div>
                          </div>
                        );
                      })()}
                      <button type="button" onClick={() => b.editDates(x.id)}
                        className="mt-1.5 text-[11px] font-bold underline underline-offset-2" style={{ color: tk.muted }}>
                        {x.dates.length === 1 ? "Change this date" : `Change which ${x.dates.length} days`}
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
        </>
      )}

      {/* Totals belong to the paying step. Showing prices and discounts while
          someone is choosing lunches was two conversations at once. */}
      {ckStage === "pay" && (
      <div className="mt-4 border-t pt-3" style={{ borderColor: tk.line }}>
        {b.discountLines.map((l, i) => (
          <div key={i} className="flex items-baseline justify-between gap-3 text-[11.5px]">
            <span className="min-w-0" style={{ color: tk.muted }}>
              {l.name}{l.terms && <span className="ml-1 opacity-70">({l.terms})</span>}
            </span>
            <b className="flex-none" style={{ color: tk.accent }}>−{money(l.amount)}</b>
          </div>
        ))}
        {addonTotal > 0 && (
          <div className="flex items-baseline justify-between text-[11.5px]" style={{ color: tk.muted }}>
            <span>Add-ons</span><b style={{ color: tk.ink }}>{money(addonTotal)}</b>
          </div>
        )}
        <div className="mt-2 flex items-baseline justify-between text-[14px]">
          <span style={{ color: tk.muted }}>Total</span>
          <span className="flex items-baseline gap-2">
            {/* What it was BEFORE discounts — showing the discounted total here
                struck through said "£540, was £540". */}
            {(b.saved > 0 || b.totalOverride !== null) && <s className="text-[11px]" style={{ color: tk.muted }}>{money(b.subtotal + addonTotal)}</s>}
            <b style={{ color: tk.ink }}>{money(grandTotal)}</b>
          </span>
        </div>
        {/* Final say on the price — for a one-off arrangement a rule can't express. Operators only. */}
        {!parentMode && <div className="mt-2 flex items-center gap-2">
          <span className="flex-1 text-[11.5px]" style={{ color: tk.muted }}>Override the total</span>
          <span className="flex items-center gap-1">
            <span className="text-[11px]" style={{ color: tk.muted }}>£</span>
            <input type="number" min={0} step="0.01" value={b.totalOverride ?? ""} placeholder={calculated.toFixed(2)}
              onChange={(e) => b.setTotalOverride(e.target.value === "" ? null : Math.max(0, parseFloat(e.target.value) || 0))}
              className={`w-[86px] border px-2 py-1 text-right text-[12.5px] font-bold outline-none ${tk.round}`}
              style={{ background: tk.inputBg, borderColor: b.totalOverride !== null ? tk.accent : tk.line, color: tk.ink }} />
            {b.totalOverride !== null && (
              <button type="button" onClick={() => b.setTotalOverride(null)} className="text-[11px] font-bold" style={{ color: tk.muted }}>Reset</button>
            )}
          </span>
        </div>}
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
          ).map((q) => ({ who: c.name.trim() || "this child", label: q.label })),
        );
        const ready =
          roster.length > 0 && unassigned === 0 && shortPasses.length === 0 && clashes.length === 0 && outstanding.length === 0;
        const next = "Next";
        return (
          <>
            {/* Where the booking stands, once rather than per card. */}
            {b.basket.length > 0 && roster.length > 0 && (
              <div className={`mt-4 flex items-baseline justify-between gap-3 border-2 px-4 py-3 ${tk.round}`}
                style={{ borderColor: `${tk.muted}55`, background: tk.inputBg }}>
                <span className="text-[12.5px] font-bold" style={{ color: tk.ink }}>
                  Booking so far
                  <span className="ml-1.5 text-[11px] font-semibold" style={{ color: tk.muted }}>
                    {b.basket.length} pass{b.basket.length === 1 ? "" : "es"}
                    {b.saved > 0 ? ` · ${money(b.saved)} saved` : ""}
                  </span>
                </span>
                <span className="flex items-baseline gap-2">
                  {b.saved > 0 && <s className="text-[11.5px]" style={{ color: tk.muted }}>{money(b.subtotal)}</s>}
                  <b className="text-[17px]" style={{ color: tk.ink }}>{money(b.total)}</b>
                </span>
              </div>
            )}

            <button type="button" disabled={!ready} onClick={() => { setExtraIdx(0); setCkStage(addons.length ? "extras" : "pay"); }}
              className={`mt-3 w-full py-3 text-[13.5px] font-extrabold disabled:opacity-40 ${tk.round}`}
              style={{ background: tk.accent, color: tk.accentInk }}>
              {roster.length === 0 ? "Add a child first"
                : clashes.length > 0 ? `${clashes[0].name} is booked twice at the same time on ${fmtDate(clashes[0].iso)}`
                : unassigned > 0 || shortPasses.length > 0 ? "Put a child on every pass"
                : outstanding.length > 0 ? `Answer “${outstanding[0].label}” for ${outstanding[0].who}`
                : next}
            </button>
            <BackBtn tk={tk} onClick={() => b.setStage("pick")} className="mt-2 w-full justify-center">Back to dates</BackBtn>
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
          if (last) setCkStage("pay"); else setExtraIdx(extraIdx + 1);
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
          ? (perDay ? "Everyone, every day" : "Everyone")
          : (perDay ? "Every day" : null);
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
                className={`${btn} disabled:opacity-50`} style={solid}>Next →</button>
            ) : (
              <button type="button" onClick={() => { clearAll(); step(1); }}
                className={btn} style={ghost}>Skip →</button>
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
                      <b className="italic" style={{ opacity: 1 }}>{money(a.price)}</b> {perDay ? "per day" : "one-off"}
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
                        <div key={kid} className={`mb-2.5 border-l-4 py-1 pl-3 last:mb-0 ${tk.round}`} style={{ borderColor: kc.bg }}>
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
                                ? (all ? `✓ All ${x.dates.length} days` : "Every day")
                                : (days.length ? `✓ Yes · ${money(a.price)}` : `Add · ${money(a.price)}`)}
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
                                    {dt.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })}
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
                                        placeholder="Your answer…"
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
                  <span style={{ color: tk.ink }}>{a.name} total</span>
                  <span style={{ color: tk.ink }}>{money(thisExtra)}</span>
                </div>
              )}
              <div className="mt-1.5 flex items-baseline justify-between text-[11.5px]" style={{ color: tk.muted }}>
                <span>Passes</span><span>{money(b.total)}</span>
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
                <span style={{ color: tk.ink }}>So far</span>
                <span style={{ color: tk.accent }}>{money(b.total + addonTotal)}</span>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <BackBtn tk={tk} onClick={() => step(-1)}>
                Back to {extraIdx === 0 ? "children" : ordered[extraIdx - 1].name}
              </BackBtn>
              {/* One way on, never two: Skip until something is chosen, Next
                  after. Offering to decline what they've just picked reads as
                  a way to undo it, and both at once is a choice with no answer. */}
              {anyPicked ? (
                <button type="button" onClick={() => step(1)} disabled={unanswered.length > 0}
                  className={`ml-auto px-5 py-2 text-[12.5px] font-extrabold disabled:opacity-50 ${tk.round}`}
                  style={{ background: tk.accent, color: tk.accentInk, boxShadow: `0 10px 22px -12px ${tk.accent}` }}>
                  {unanswered.length ? `${unanswered[0].kid} needs ${unanswered[0].label.toLowerCase()}` : "Next →"}
                </button>
              ) : (
                <button type="button" onClick={() => { clearAll(); step(1); }}
                  className={`ml-auto border-2 px-4 py-2 text-[12.5px] font-extrabold ${tk.round}`}
                  style={{ borderColor: tk.muted, color: tk.ink }}>
                  Skip →
                </button>
              )}
            </div>
          </div>
        );
      })()}


      {/* No "change extras" button here any more — the tabs above go straight
          to the one they want, by name. */}
      {ckStage === "pay" && (
        <BackBtn tk={tk} onClick={() => { if (addons.length) { setExtraIdx(ordered.length - 1); setCkStage("extras"); } else setCkStage("who"); }} className="mt-3">
          Back to {ordered.length ? ordered[ordered.length - 1].name : "children"}
        </BackBtn>
      )}
      {ckStage === "pay" && (
        <div className="mt-3">
          <div className="font-bold uppercase" style={{ ...label, color: tk.muted }}>
            {parentMode ? "How you\u2019ll pay" : "How the parent is paying"}
          </div>
          <select value={method} onChange={(e) => setMethod(e.target.value)}
            className={`mt-1.5 w-full border px-3 py-2 text-[13px] outline-none ${tk.round}`}
            style={{ background: tk.inputBg, borderColor: tk.line, color: tk.ink }}>
            {(parentMode
              ? [["card", "Card"], ["bank", "Bank transfer"], ["cash", "Cash on the day"]]
              : payList.map((m) => [m, m])
            ).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {!parentMode && (
            <div className={`mt-2 border px-3 py-2 text-[11.5px] leading-[1.5] ${tk.round}`}
              style={{ borderColor: tk.line, color: tk.muted }}>
              The booking is held as <b>Invoice sent</b> and the parent gets the payment-link
              email. Mark it paid from the booking itself once the money lands.
            </div>
          )}
        </div>
      )}

      {booking?.error && (
        <div className="mt-2 text-[11.5px] font-semibold" style={{ color: "#dc2626" }}>{booking.error}</div>
      )}

      {ckStage === "pay" && <button className={`mt-3 w-full py-3 text-[13.5px] font-extrabold disabled:opacity-40 ${tk.round}`} style={{ background: tk.accent, color: tk.accentInk }}
        disabled={(!parentMode && !b.parent) || roster.length === 0 || unassigned > 0 || shortPasses.length > 0 || clashes.length > 0 || !!booking?.busy}
        onClick={() => {
          b.setChild(Object.values(b.assign).filter(Boolean).join(", "));
          // A parent's confirm actually books; the operator preview still just
          // shows the done screen until the operator flow is wired.
          if (parentMode && onBook) onBook({
            method, basket: b.basket, addonSel: b.addonSel, addonAns: b.addonAns, children: roster,
            // Resolved here so the caller gets plain "who's on what" rather than exceptions.
            dayAssign: Object.fromEntries(b.basket.map((x) => [x.id, Object.fromEntries(x.dates.map((iso) => [iso, b.childrenOn(x.id)]))])),
          });
          else b.setStage("done");
        }}>
        {booking?.busy ? "Booking…"
          : !parentMode && !b.parent ? "Find the parent first"
          : roster.length === 0 ? "Add a child first"
          : unassigned > 0 ? `${unassigned} day${unassigned === 1 ? " has" : "s have"} nobody on ${unassigned === 1 ? "it" : "them"}`
          : clashes.length > 0 ? `${clashes[0].name} is booked twice at the same time on ${fmtDate(clashes[0].iso)}`
          : shortPasses.length > 0 ? `One child needs all ${shortPasses[0].dates.length} days of the ${shortPasses[0].name}`
          : parentMode ? `Confirm & pay ${money(grandTotal)}`
          : `Send payment link & create · ${money(grandTotal)}`}
      </button>}

      <div className="mt-2 text-[11px] leading-[1.5]" style={{ color: tk.muted }}>{d.cancellation}</div>
      </div>
    </div>
    </>
  );
}
