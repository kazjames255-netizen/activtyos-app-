"use client";

// The operator half of obtaining a reference. Two screens use it:
//
//  · Applications — request referees at shortlist/accept, which is when safer
//    recruitment says to ask (before interview, not after onboarding).
//  · Onboarding → References & history — the same requests, tracked to the
//    cleared-to-start gate.
//
// They are deliberately NOT two features. Requests key on the candidate's name,
// and the Applications tab already writes the onboarding record under that same
// name on accept (ApplicationsApp's carryOver) — so a reference chased during
// recruitment is simply already there on the day they're hired.
//
// Unlike the rest of the onboarding record (localStorage — see OnboardingApp),
// references live server-side. What a referee says is third-party personal data
// about the candidate, so it can't sit in a browser store; the request/response
// pair is the API's (server/src/routes/references.ts).
import { useCallback, useEffect, useState } from "react";
import { Button, Input } from "@/components/ui";
import { del, get, openFile, post } from "@/lib/api";
import { useSettings } from "@/lib/settings";
import { ReferenceQuestionForm, ReferenceReadback } from "./ReferenceAnswers";
import { DEFAULT_REFERENCE_SECTIONS, type RefSection } from "./referenceQuestions";
import { ReferenceQuestionsEditor } from "./ReferenceQuestionsEditor";
import type { OnboardField, OnboardValue } from "./OnboardingApp";

export interface ReferenceRequest {
  token: string;
  staffName: string;
  slot: number;
  refereeName: string;
  refereeOrg: string | null;
  refereeRel: string | null;
  refereeEmail: string | null;
  status: "sent" | "opened" | "received" | "declined";
  /** email — we sent the form · link — the operator sends it themselves ·
   *  phone — no form, they ring the referee. Mirrors the server's RefDoc. */
  method: "email" | "link" | "phone";
  createdAt: string;
  createdBy: string | null;
  lastSentAt: string | null;
  chases: number;
  openedAt: string | null;
  submittedAt: string | null;
  declinedAt: string | null;
  declineReason: string | null;
  answers: Record<string, string> | null;
  fileName: string | null;
  hasFile: boolean;
  concern: boolean;
  concernResolved: { by: string; at: string; note: string } | null;
  recordedBy: string | null;
  /** The questions this request was sent under. Editing the provider's set
   *  never rewrites an existing request — this is what it was asked. */
  sections: RefSection[] | null;
}

/** One referee, whatever screen supplied them — onboarding fields on one side,
 *  application answers on the other. */
export interface Referee { slot: number; name: string; org?: string; rel?: string; email?: string }

// Which onboarding fields make up each referee. Slot order matches the `slot`
// on the request, so a renamed label can't decouple the two.
const REF_GROUPS = [
  { slot: 1, title: "Reference 1", ids: ["ref1Name", "ref1Org", "ref1Rel", "ref1Phone", "ref1Email"], nameId: "ref1Name", orgId: "ref1Org", relId: "ref1Rel", emailId: "ref1Email" },
  { slot: 2, title: "Reference 2", ids: ["ref2Name", "ref2Org", "ref2Rel", "ref2Phone", "ref2Email"], nameId: "ref2Name", orgId: "ref2Org", relId: "ref2Rel", emailId: "ref2Email" },
];
const REF_FIELD_IDS = new Set(REF_GROUPS.flatMap((g) => g.ids));

const fmt = (iso?: string | null) => { if (!iso) return ""; const d = new Date(iso); return isNaN(+d) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }); };
const daysSince = (iso?: string | null) => { if (!iso) return 0; const d = new Date(iso); return isNaN(+d) ? 0 : Math.floor((Date.now() - +d) / 86_400_000); };
/** A reference only counts once any flagged concern has been dealt with. */
const counts = (r: ReferenceRequest) => r.status === "received" && (!r.concern || !!r.concernResolved);

const esc = (s = "") => String(s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] as string));

// ——— the shared tracker ———

/** Load and mutate one person's reference requests. */
function useReferences(staffName: string, jobTitle?: string) {
  // Held WITH the name it was fetched for: switching person must not show
  // theirs against this one while the fetch is in flight. Stale reads as
  // "still loading".
  const [loaded, setLoaded] = useState<{ staff: string; list: ReferenceRequest[] } | null>(null);
  const reqs = loaded && loaded.staff === staffName ? loaded.list : null;
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () =>
    get<ReferenceRequest[] | null>(`/api/references?staff=${encodeURIComponent(staffName)}`)
      // Demo/tour mode answers null rather than hitting the network.
      .then((list) => { setLoaded({ staff: staffName, list: Array.isArray(list) ? list : [] }); setErr(null); })
      .catch((e) => { setErr(e instanceof Error ? e.message : "Couldn't load the references"); setLoaded({ staff: staffName, list: [] }); });
  // Re-reads when the operator picks a different person.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [staffName]);

  /** Run a mutation, refresh, and hand the result back — callers like "create a
   *  link" need the new token to put on the clipboard straight away. */
  async function act<T>(key: string, fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(key); setErr(null);
    let out: T | undefined;
    try { out = await fn(); await load(); } catch (e) { setErr((e as Error).message); }
    setBusy(null);
    return out;
  }

  /** The live request for a slot — a declined one only shows if there's nothing
   *  newer, so "ask someone else" leaves a trail rather than vanishing. */
  const forSlot = (slot: number) => (reqs ?? []).find((r) => r.slot === slot && !r.declinedAt)
    ?? (reqs ?? []).find((r) => r.slot === slot) ?? null;

  /** Create the request. `deliver` decides whether we email the referee, hand
   *  the operator a link to send however they like, or record a phone call. */
  const request = (referee: Referee, deliver: "email" | "link" | "phone" = "email") => {
    if (!referee.name) { setErr("Add the referee's name first."); return; }
    return act(`send-${referee.slot}`, () => post<ReferenceRequest>("/api/references", {
      staffName,
      slot: referee.slot,
      refereeName: referee.name,
      refereeOrg: referee.org || undefined,
      refereeRel: referee.rel || undefined,
      refereeEmail: referee.email || undefined,
      jobTitle: jobTitle || undefined,
      deliver,
    }));
  };

  const live = (reqs ?? []).filter((r) => !r.declinedAt);
  return { reqs, err, busy, load, act, forSlot, request, staffName, live, satisfiedCount: live.filter(counts).length };
}

type RefCtl = ReturnType<typeof useReferences>;

/** The status line for one referee: what's happened, and what to do next. */
function RefereeStrip({ referee, ctl }: { referee: Referee; ctl: RefCtl }) {
  const [viewing, setViewing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [copied, setCopied] = useState(false);
  const r = ctl.forSlot(referee.slot);
  const { busy } = ctl;

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/reference/${token}`;
    void navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const modals = (
    <>
      {viewing && r && <ViewReference r={r} staffName={ctl.staffName} onClose={() => setViewing(false)} onResolved={() => { setViewing(false); void ctl.load(); }} />}
      {recording && r && <RecordByPhone r={r} staffName={ctl.staffName} onClose={() => setRecording(false)} onSaved={() => { setRecording(false); void ctl.load(); }} />}
    </>
  );

  if (ctl.reqs === null) return <div className="px-3 py-2 text-[11.5px] text-[var(--ink-3)]">Checking…</div>;

  if (!r) {
    const sending = busy === `send-${referee.slot}`;
    // What's missing, said out loud. A greyed-out button with the reason hidden
    // in a tooltip is how you end up staring at a row wondering where the
    // "send" is.
    const missing = !referee.name
      ? "Add the referee's name to request a reference — type it above, or pull it from their application."
      : !referee.email
        ? "No email for this referee. Create a link to send them yourself, or take the reference over the phone."
        : null;
    return (
      <div className="border-t border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11.5px] font-bold text-[var(--ink-3)]">Not requested yet</span>
          <div className="ml-auto flex flex-wrap gap-1.5">
            {referee.name && referee.email && (
              <Button sm variant="primary" disabled={sending} onClick={() => void ctl.request(referee, "email")}>
                {sending ? "Sending…" : "✉️ Send request"}
              </Button>
            )}
            {referee.name && (
              <>
                {/* Create + copy in one go: the point of this button is to end
                    up with the URL on the clipboard, not to admire a new row. */}
                <Button sm disabled={sending} onClick={() => void ctl.request(referee, "link")?.then((made) => { if (made) copyLink(made.token); })}>
                  {sending ? "Creating…" : copied ? "Link copied ✓" : "🔗 Create a link"}
                </Button>
                <Button sm disabled={sending} onClick={() => void ctl.request(referee, "phone")}>☎️ Take by phone</Button>
              </>
            )}
          </div>
        </div>
        {missing && <div className="mt-1 text-[11px] leading-snug text-[var(--ink-3)]">{missing}</div>}
      </div>
    );
  }

  if (r.status === "received") {
    const bad = r.concern && !r.concernResolved;
    return (
      <div className={"border-t px-3 py-2.5 " + (bad ? "border-[#f3c2c2] bg-[#fdecec]" : "border-[#cfe8d7] bg-[#f4fbf6]")}>
        <div className="flex flex-wrap items-center gap-2">
          <span className={"text-[11.5px] font-extrabold " + (bad ? "text-[#a32020]" : "text-[#0f7a43]")}>
            {bad ? "⚠ Concern flagged" : "✓ Received"} {fmt(r.submittedAt)}
            {r.method === "phone" ? ` · taken by phone${r.recordedBy ? ` by ${r.recordedBy}` : ""}` : ""}
          </span>
          <div className="ml-auto flex flex-wrap gap-1.5">
            {r.hasFile && <Button sm onClick={() => void openFile(`/api/references/${r.token}/file`)}>📎 {r.fileName ?? "Document"}</Button>}
            <Button sm variant="primary" onClick={() => setViewing(true)}>Read the reference</Button>
          </div>
        </div>
        {r.concernResolved && (
          <div className="mt-1.5 text-[11px] leading-snug text-[#0f7a43]">
            Reviewed by {r.concernResolved.by} on {fmt(r.concernResolved.at)} — {r.concernResolved.note}
          </div>
        )}
        {modals}
      </div>
    );
  }

  if (r.status === "declined") return (
    <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] bg-[var(--panel)] px-3 py-2.5">
      <span className="text-[11.5px] font-bold text-[var(--ink-2)]">Declined {fmt(r.declinedAt)}{r.declineReason ? ` — “${r.declineReason}”` : ""}</span>
      <Button sm className="ml-auto" disabled={busy === `del-${r.token}`} onClick={() => void ctl.act(`del-${r.token}`, () => del(`/api/references/${r.token}`))}>Ask someone else</Button>
    </div>
  );

  const waited = daysSince(r.lastSentAt ?? r.createdAt);
  const stale = waited >= 5;
  return (
    <div className={"border-t px-3 py-2.5 " + (stale ? "border-[#f3cfa6] bg-[#fdf3e0]" : "border-[var(--line)] bg-[var(--panel)]")}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={"text-[11.5px] font-extrabold " + (stale ? "text-[#8a4b09]" : "text-[var(--ink-2)]")}>
          {r.openedAt
            ? `👀 Opened ${fmt(r.openedAt)}`
            : r.method === "phone" && !r.lastSentAt
              ? "☎️ To take by phone"
              : r.method === "link" && !r.lastSentAt
                // Nothing was emailed — saying "Sent" would be a lie, and the
                // operator still has a job to do with that link.
                ? `🔗 Link ready ${fmt(r.createdAt)} — send it to them`
                : `✉️ Sent ${fmt(r.lastSentAt ?? r.createdAt)}`}
          {waited > 0 && <span className="font-semibold"> · {waited} day{waited === 1 ? "" : "s"} ago</span>}
          {r.chases > 0 && <span className="font-semibold"> · chased {r.chases}×</span>}
        </span>
        <div className="ml-auto flex flex-wrap gap-1.5">
          {r.refereeEmail && <Button sm disabled={busy === `chase-${r.token}`} onClick={() => void ctl.act(`chase-${r.token}`, () => post(`/api/references/${r.token}/resend`, {}))}>{busy === `chase-${r.token}` ? "Sending…" : "🔔 Chase"}</Button>}
          <Button sm onClick={() => copyLink(r.token)}>{copied ? "Copied ✓" : "🔗 Copy link"}</Button>
          <Button sm onClick={() => setRecording(true)}>☎️ Record what they said</Button>
          <Button sm variant="danger" disabled={busy === `del-${r.token}`} onClick={() => void ctl.act(`del-${r.token}`, () => del(`/api/references/${r.token}`))}>Cancel</Button>
        </div>
      </div>
      {stale && <div className="mt-1 text-[11px] text-[#8a4b09]">No reply yet — a chaser, or a phone call, usually does it.</div>}
      {modals}
    </div>
  );
}

// ——— pulling referees off an application ———

// The referee ids are the same on both sides — the application form's `mapsTo`
// points ref1Name → ref1Name — so carrying them over is a straight copy.
const PULL_IDS = ["ref1Name", "ref1Org", "ref1Rel", "ref1Phone", "ref1Email", "ref2Name", "ref2Org", "ref2Rel", "ref2Phone", "ref2Email"];
const APPS_KEY = "aos.team.applications.v1";
interface PulledApp { id: string; name: string; submittedAt: string; status: string; answers: Record<string, string> }

const appDate = (iso?: string) => { if (!iso) return ""; const d = new Date(iso); return isNaN(+d) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }); };

/** Fill this person's referee fields from an application they submitted. The
 *  details are already sitting in the Applications tab — nobody should be
 *  retyping a name and email that the candidate gave you in writing. */
function PullFromApplication({ staffName, hasAny, onPull }: {
  staffName: string;
  /** True when some referee detail is already filled in — pulling then
   *  overwrites, so it gets a confirm. */
  hasAny: boolean;
  onPull: (answers: Record<string, string>) => void;
}) {
  const [apps, setApps] = useState<PulledApp[]>([]);
  const [pickOpen, setPickOpen] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { const a = JSON.parse(localStorage.getItem(APPS_KEY) || "[]"); if (Array.isArray(a)) setApps(a); } catch { /* ignore */ }
  }, []);

  // Only applications that actually carry referee details are worth offering.
  const withRefs = apps.filter((a) => PULL_IDS.some((id) => (a.answers?.[id] ?? "").trim()));
  if (!withRefs.length) return null;
  const exact = withRefs.find((a) => a.name.trim().toLowerCase() === staffName.trim().toLowerCase());

  const pull = (a: PulledApp) => {
    if (hasAny && !window.confirm(`Replace the referee details on ${staffName}'s record with the ones from ${a.name}'s application?`)) return;
    onPull(a.answers ?? {});
    setPickOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#cdddf7] bg-[#eef4ff] px-3.5 py-2.5">
      <span className="text-[11.5px] font-semibold leading-snug text-[#1d54c4]">
        {exact
          ? <>📥 <b>{exact.name}</b> applied {appDate(exact.submittedAt)} and gave referee details on the form.</>
          : <>📥 Referee details can be pulled straight from an application.</>}
      </span>
      <div className="relative ml-auto">
        {exact ? (
          <Button sm onClick={() => pull(exact)}>Pull their referees</Button>
        ) : (
          <Button sm onClick={() => setPickOpen((v) => !v)}>Pull from an application…</Button>
        )}
        {pickOpen && (
          <div className="absolute right-0 z-20 mt-1 max-h-[240px] w-[260px] overflow-y-auto rounded-xl border border-[var(--line)] bg-white p-1 shadow-xl">
            {withRefs.map((a) => (
              <button key={a.id} type="button" onClick={() => pull(a)} className="block w-full truncate rounded-lg px-3 py-1.5 text-left text-[12px] font-semibold text-[var(--ink-2)] hover:bg-[var(--panel)]">
                {a.name} <span className="text-[10px] text-[var(--ink-3)]">· {a.status} · {appDate(a.submittedAt)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const errBar = (err: string | null) => err
  ? <div className="rounded-xl border border-[#f3c2c2] bg-[#fdecec] px-3.5 py-2 text-[12px] font-semibold text-[#a32020]">{err}</div>
  : null;

// ——— Applications tab ———

/** Request references straight off an application, before the person is
 *  onboarded (or even accepted). The referee details the candidate already gave
 *  on the application form are the ones used. */
export function ApplicationReferences({ candidateName, jobTitle, answers, accepted }: {
  candidateName: string;
  jobTitle?: string;
  answers: Record<string, string>;
  accepted: boolean;
}) {
  const ctl = useReferences(candidateName, jobTitle);
  const referees: Referee[] = [1, 2].map((slot) => ({
    slot,
    name: (answers[`ref${slot}Name`] ?? "").trim(),
    org: (answers[`ref${slot}Org`] ?? "").trim(),
    email: (answers[`ref${slot}Email`] ?? "").trim(),
  }));
  const named = referees.filter((x) => x.name);
  const done = ctl.satisfiedCount;

  return (
    <div className="mb-3 overflow-hidden rounded-xl border border-[#f3cfa6] bg-[#fffdfa]">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#f3cfa6] bg-[#fdf3e0] px-3 py-2">
        <span className="text-[12.5px] font-extrabold text-[#8a4b09]">📋 References</span>
        <span className="text-[11px] text-[#96632a]">
          {named.length === 0 ? "No referees on this application" : `${done} of ${named.length} back`}
        </span>
        {!accepted && named.length > 0 && (
          <span className="ml-auto text-[10.5px] font-bold text-[#96632a]">Ask now — before interview is the safer-recruitment norm</span>
        )}
      </div>
      <div className="space-y-2 p-2.5">
        {errBar(ctl.err)}
        {named.length === 0 ? (
          <p className="px-1 py-1 text-[11.5px] leading-snug text-[var(--ink-3)]">
            This application form didn&rsquo;t collect referee details, or the candidate left them blank. Add them on
            their onboarding record once they&rsquo;re accepted, and request from there.
          </p>
        ) : named.map((referee) => (
          <div key={referee.slot} className="overflow-hidden rounded-lg border border-[var(--line)] bg-white">
            <div className="px-3 py-2">
              <div className="text-[12.5px] font-extrabold text-[var(--ink)]">👤 {referee.name}</div>
              <div className="text-[11px] text-[var(--ink-3)]">
                {referee.org || "No organisation given"}
                {referee.email ? ` · ${referee.email}` : " · no email — phone only"}
              </div>
            </div>
            <RefereeStrip referee={referee} ctl={ctl} />
          </div>
        ))}
        {named.length > 0 && (
          <p className="px-1 text-[10.5px] leading-snug text-[var(--ink-3)]">
            These follow {candidateName.split(" ")[0]} into <b>Onboarding → References &amp; history</b>{" "}
            — same requests, nothing to re-send if they&rsquo;re hired.
          </p>
        )}
      </div>
    </div>
  );
}

// ——— Onboarding → References & history ———

export function ReferencesStep({ fields, staffName, jobTitle, values, setVal, setVals, fieldCard }: {
  fields: OnboardField[];
  staffName: string;
  jobTitle?: string;
  values: Record<string, OnboardValue>;
  setVal: (fieldId: string, patch: Partial<OnboardValue>) => void;
  /** Several fields in one write — a loop of setVal would keep overwriting
   *  itself, since each call closes over the same record. */
  setVals: (patches: Record<string, Partial<OnboardValue>>) => void;
  fieldCard: (f: OnboardField) => React.ReactNode;
}) {
  const ctl = useReferences(staffName, jobTitle);
  const { settings, save } = useSettings();
  const [editing, setEditing] = useState(false);
  // What NEW requests will ask. Existing ones keep their own snapshot.
  const askSections = settings.referenceQuestions?.length ? settings.referenceQuestions : DEFAULT_REFERENCE_SECTIONS;
  const refereeFor = (g: (typeof REF_GROUPS)[number]): Referee => ({
    slot: g.slot,
    name: (values[g.nameId]?.v ?? "").trim(),
    org: (values[g.orgId]?.v ?? "").trim(),
    rel: (values[g.relId]?.v ?? "").trim(),
    email: (values[g.emailId]?.v ?? "").trim(),
  });

  const refsCheck = fields.find((f) => f.id === "refsCheck");
  const blocking = ctl.live.filter((r) => r.status === "received" && r.concern && !r.concernResolved);
  const wanted = REF_GROUPS.filter((g) => (values[g.nameId]?.v ?? "").trim()).length || 2;
  const { satisfiedCount, reqs, live } = ctl;

  // Keep the shared `refsCheck` pill honest without taking the decision away:
  // the request state drives to-do / requested / received, but "satisfactory" is
  // a judgement someone has to make and click. Never downgrade a verified one.
  useEffect(() => {
    if (!refsCheck || reqs === null) return;
    const cur = values.refsCheck?.status ?? "todo";
    if (cur === "verified") return;
    const derived = satisfiedCount >= wanted && wanted > 0 ? "received" : live.length ? "requested" : "todo";
    if (derived !== cur) setVal("refsCheck", { status: derived });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reqs, satisfiedCount, wanted, live.length]);

  const rest = fields.filter((f) => !REF_FIELD_IDS.has(f.id) && f.id !== "refsCheck");

  return (
    <div className="space-y-2.5 px-4">
      {errBar(ctl.err)}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-[var(--ink-3)]">Referees are emailed a short form — or you can send the link yourself, or take it by phone.</span>
        <Button sm className="ml-auto" onClick={() => setEditing(true)}>⚙ Reference questions</Button>
      </div>
      {editing && (
        <ReferenceQuestionsEditor
          sections={askSections}
          onSave={(next) => void save({ settings: { ...settings, referenceQuestions: next } })}
          onClose={() => setEditing(false)}
        />
      )}

      <PullFromApplication
        staffName={staffName}
        hasAny={PULL_IDS.some((id) => (values[id]?.v ?? "").trim())}
        onPull={(answers) => setVals(Object.fromEntries(
          PULL_IDS.map((id) => [id, (answers[id] ?? "").trim()]).filter(([, v]) => v).map(([id, v]) => [id, { v }]),
        ))}
      />

      {REF_GROUPS.map((g) => {
        const gfields = g.ids.map((id) => fields.find((f) => f.id === id)).filter(Boolean) as OnboardField[];
        if (!gfields.length) return null;
        return (
          <div key={g.slot} className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
            <div className="flex items-center gap-1.5 px-3 pt-2.5 text-[12.5px] font-extrabold text-[#b45309]"><span>👤</span>{g.title}</div>
            <div className="grid gap-2.5 p-3 sm:grid-cols-2">{gfields.map(fieldCard)}</div>
            <RefereeStrip referee={refereeFor(g)} ctl={ctl} />
          </div>
        );
      })}

      {/* The shared gate field, driven by the requests above. */}
      {refsCheck && (
        <div className={"rounded-xl border p-3 " + (values.refsCheck?.status === "verified" ? "border-[#cfe8d7] bg-[#f4fbf6]" : "border-[var(--line)] bg-[var(--surface)]")}>
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[12px] font-bold text-[var(--ink-2)]">
            {values.refsCheck?.status === "verified" && <span className="text-[#0f7a43]">✓</span>}
            {refsCheck.label}<span className="text-[#c0392b]">*</span>
            <span title="Blocks cleared-to-start" className="text-[10px]">🚦</span>
          </div>
          <div className="text-[11.5px] text-[var(--ink-3)]">
            {satisfiedCount} of {wanted} reference{wanted === 1 ? "" : "s"} back.
            {blocking.length > 0 && <b className="text-[#a32020]"> A safeguarding concern is flagged — review it before signing this off.</b>}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {values.refsCheck?.status === "verified" ? (
              <>
                <span className="rounded-full bg-[#e6f4ea] px-2.5 py-1 text-[11px] font-bold text-[#0f7a43]">Satisfactory{values.refsCheck?.at ? ` · ${fmt(values.refsCheck.at)}` : ""}</span>
                <Button sm onClick={() => setVal("refsCheck", { status: satisfiedCount >= wanted ? "received" : "requested", at: undefined })}>Undo</Button>
              </>
            ) : (
              <Button
                sm
                variant="primary"
                disabled={satisfiedCount < wanted || blocking.length > 0}
                title={blocking.length ? "Record what you did about the flagged concern first" : satisfiedCount < wanted ? "Both references need to be back first" : undefined}
                onClick={() => setVal("refsCheck", { status: "verified", at: new Date().toISOString() })}
              >
                Mark references satisfactory
              </Button>
            )}
          </div>
        </div>
      )}

      {rest.length > 0 && <div className="grid gap-2.5 sm:grid-cols-2">{rest.map(fieldCard)}</div>}
    </div>
  );
}

// ——— read a returned reference ———

function ViewReference({ r, staffName, onClose, onResolved }: { r: ReferenceRequest; staffName: string; onClose: () => void; onResolved: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const answers = r.answers ?? {};
  const bad = r.concern && !r.concernResolved;

  const print = () => {
    const rows = Object.entries(answers).map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td class="v">${esc(v)}</td></tr>`).join("");
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Reference — ${esc(staffName)}</title><style>body{font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1c2b;padding:26px}h1{font-size:19px;margin:0 0 2px}.sub{color:#6b7086;font-size:12px;margin-bottom:14px}table{width:100%;border-collapse:collapse;font-size:12px}td{padding:6px 8px;border-top:1px solid #eef1f7;vertical-align:top}td.k{color:#6b7086;width:44%}td.v{font-weight:600}</style></head><body><h1>Reference for ${esc(staffName)}</h1><div class="sub">From ${esc(r.refereeName)}${r.refereeOrg ? ` · ${esc(r.refereeOrg)}` : ""} · received ${esc(fmt(r.submittedAt))}${r.method === "phone" ? " · taken by phone" : ""}</div><table>${rows}</table><script>window.onload=function(){setTimeout(function(){window.print()},350)}</script></body></html>`);
    w.document.close();
  };

  async function resolve() {
    if (!note.trim()) { setErr("Write down what you did about it — that note is the record."); return; }
    setBusy(true); setErr(null);
    try { await post(`/api/references/${r.token}/resolve`, { note }); onResolved(); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[143] flex justify-center overflow-y-auto bg-black/45 p-4 pt-[4vh]" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex-none border-b border-[var(--line)] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-extrabold text-[var(--ink)]">Reference for {staffName}</h3>
            <button type="button" onClick={onClose} className="ml-auto text-[18px] text-[var(--ink-3)]">×</button>
          </div>
          <p className="mt-0.5 text-[11.5px] text-[var(--ink-3)]">
            From {r.refereeName}{r.refereeOrg ? ` · ${r.refereeOrg}` : ""} · received {fmt(r.submittedAt)}
            {r.method === "phone" ? ` · taken by phone${r.recordedBy ? ` by ${r.recordedBy}` : ""}` : ""}
          </p>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {bad && (
            <div className="rounded-xl border border-[#f3c2c2] bg-[#fdecec] px-4 py-3">
              <div className="text-[13px] font-extrabold text-[#a32020]">⚠ A safeguarding question was answered “yes”.</div>
              <p className="mt-1 text-[12px] leading-snug text-[#8a2020]">
                {staffName} stays on hold until someone records what was done about this — a conversation with the referee,
                a note to the DSL, a decision not to proceed. The note below goes on the record with your name and today&rsquo;s date.
              </p>
            </div>
          )}
          <ReferenceReadback sections={r.sections?.length ? r.sections : DEFAULT_REFERENCE_SECTIONS} answers={answers} />
          {r.hasFile && (
            <Button onClick={() => void openFile(`/api/references/${r.token}/file`)}>📎 Open the attached document{r.fileName ? ` (${r.fileName})` : ""}</Button>
          )}
          {bad && (
            <div className="rounded-xl border border-[var(--line)] p-3">
              <div className="mb-1 text-[12px] font-extrabold text-[var(--ink-2)]">What did you do about it?</div>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="e.g. Phoned the referee 11 Sep — allegation was investigated and not substantiated. Discussed with DSL, proceeding with a 3-month review." className="w-full rounded-lg border border-[var(--line)] px-2.5 py-2 text-[13px] outline-none focus:border-[#1d3a8f]" />
              {err && <div className="mt-1.5 text-[11.5px] font-semibold text-[#a32020]">{err}</div>}
              <Button variant="primary" className="mt-2" disabled={busy} onClick={resolve}>{busy ? "Saving…" : "Record the review"}</Button>
            </div>
          )}
        </div>
        <div className="flex flex-none items-center gap-2 border-t border-[var(--line)] px-5 py-3">
          <span className="text-[11px] text-[var(--ink-3)]">Visible to your team only.</span>
          <Button className="ml-auto" onClick={print}>Print</Button>
          <Button variant="primary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}

// ——— a reference taken over the phone ———

function RecordByPhone({ r, staffName, onClose, onSaved }: { r: ReferenceRequest; staffName: string; onClose: () => void; onSaved: () => void }) {
  const [answers, setAnswers] = useState<Record<string, string>>(r.answers ?? {});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = useCallback((id: string, v: string) => setAnswers((a) => ({ ...a, [id]: v })), []);
  const [signedName, setSignedName] = useState(r.refereeName);

  async function save() {
    setBusy(true); setErr(null);
    try {
      await post(`/api/references/${r.token}/record`, { answers: { ...answers, signedName } });
      onSaved();
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[143] flex justify-center overflow-y-auto bg-black/45 p-4 pt-[4vh]" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex-none border-b border-[var(--line)] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-extrabold text-[var(--ink)]">Reference by phone — {staffName}</h3>
            <button type="button" onClick={onClose} className="ml-auto text-[18px] text-[var(--ink-3)]">×</button>
          </div>
          <p className="mt-0.5 text-[11.5px] text-[var(--ink-3)]">
            The same questions the form asks, so a phoned reference records the same things. It&rsquo;s saved
            against your name, with today&rsquo;s date, as the person who took it.
          </p>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto bg-[#f7f4ee] px-5 py-4">
          <div className="rounded-xl border border-[var(--line)] bg-white p-3">
            <label className="text-[12.5px] font-bold text-[var(--ink-2)]">Who you spoke to
              <Input value={signedName} onChange={(e) => setSignedName(e.target.value)} className="mt-1 w-full bg-white" />
            </label>
          </div>
          <ReferenceQuestionForm sections={r.sections?.length ? r.sections : DEFAULT_REFERENCE_SECTIONS} answers={answers} set={set} />
        </div>
        <div className="flex flex-none flex-wrap items-center gap-2 border-t border-[var(--line)] px-5 py-3">
          {err && <span className="text-[11.5px] font-semibold text-[#a32020]">{err}</span>}
          <Button className="ml-auto" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save the reference"}</Button>
        </div>
      </div>
    </div>
  );
}

export { REF_FIELD_IDS };
