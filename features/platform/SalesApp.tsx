"use client";

import { dateLocale as dl } from "@/lib/i18n/format";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { tNow, useT } from "@/lib/i18n/provider";
import { del, get, post, put } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { whoLabel, foldRepeats, REPEAT_WORD, type Person } from "@/features/tasks/taskDisplay";
import { DemoSlotsPanel } from "./DemoSlotsPanel";
import { VideoCallsPanel } from "./VideoCallsPanel";

// ── Sales CRM ───────────────────────────────────────────────────────────────
// Backed by the platform Sales CRM API (/api/platform/leads — see
// docs/sales-crm-handoff.md); live via the "leads" realtime channel. The
// server stamps timestamps and activity identity. No rep logins yet — one HQ
// view.

export type Stage = "new" | "contacted" | "demo" | "trial" | "won" | "lost";
type Source = "cold_call" | "email" | "social" | "referral" | "event" | "inbound" | "website_build";
type Kind = "person" | "business" | "group" | "franchise" | "school" | "cluster" | "charity";
// What sort of prospect this is. `nameLabel` retitles the first field, because
// "Business" is wrong for a self-employed coach and misleading for a trust.
// Labels are getters over the catalogue so module-level data still follows the language picker (read at render time).
const kindDef = (k: string, icon: string) => ({ get label() { return tNow(`p8hq.slKind${k}`); }, get nameLabel() { return tNow(`p8hq.slName${k}`); }, icon });
const KINDS: Record<Kind, { label: string; nameLabel: string; icon: string }> = {
  person:    kindDef("Person", "👤"),
  business:  kindDef("Business", "🏢"),
  group:     kindDef("Group", "🏘️"),
  franchise: kindDef("Franchise", "🔗"),
  school:    kindDef("School", "🎓"),
  cluster:   kindDef("Cluster", "🏛️"),
  charity:   kindDef("Charity", "🤝"),
};
const KIND_ORDER: Kind[] = ["person", "business", "group", "franchise", "school", "cluster", "charity"];
// `direction` only applies to a real email exchange (the question/reply
// thread — see LeadModal): "in" is the lead's own words, "out" is HQ's.
// Absent on every other activity type (a logged call, a note, …).
export interface Activity { id: string; type: "call" | "email" | "social" | "demo" | "note"; note: string; outcome?: string; at: string; by: string; direction?: "in" | "out"; shared?: boolean }
interface SalesTask {
  id: string; t: string; due?: string | null; time?: string | null; who?: string;
  // The assignee's email and the repeat this date belongs to. Both were missing,
  // so this board printed a raw `who` where the task manager says "Me", and
  // listed a repeating task once per date.
  whoEmail?: string; seriesId?: string; seriesFreq?: string;
  prio?: "urgent" | "high" | "med" | "low"; status?: string; archived?: boolean;
  link?: { k: string; v: string; href?: string } | null;
}

export interface Lead {
  id: string; business: string; contactName: string; email: string; phone: string; location: string;
  source: Source; owner: string; plan: "freelancer" | "company" | "franchise"; estMrr: number;
  kind?: Kind;
  stage: Stage; lostReason?: string; notes: string; activities: Activity[]; createdAt: string; updatedAt: string;
  // The demo page's chosen call time (ISO), if they booked a slot rather
  // than just leaving a "call me" request — see routes/demoSlots.ts.
  slotAt?: string;
  // The demo page's "What would you like us to cover?" ticks — rendered as
  // its own list in LeadModal, not folded into the free-text Notes.
  interestedFeatures?: string[];
  // The pricing page's website-design add-on: which of its two buttons they
  // used ("Add website design & maintenance" vs "Ask a question first") — a
  // question gets its own card treatment with the question text up front,
  // not buried in Notes like a generic message.
  interest?: "website-design-signup" | "website-design-question";
  // Their original free-text message, kept separate from the editable
  // Notes field (which is HQ's own working notes, not their words).
  message?: string;
  // What they run, ticked on the pricing-page form — shown as its own line,
  // not folded into Notes.
  businessTypes?: string[];
  // The question/reply thread for a "website-design-question" lead lives in
  // `activities` as ordinary entries with direction "in" (the lead's own
  // words) / "out" (HQ's) — an append-only log, not a single overwritable
  // field, so a later reply can never look like it erased an earlier one.
  // Set when the lead replies to one of our emails — routes/emails.ts's
  // inbound webhook recognises the "lead-<token>@…" Reply-To on every
  // lead-facing email and files their reply as a direction:"in" activity.
  lastReplyAt?: string;
  // A real Jitsi Meet room (server/src/lib/emails.ts's ensureLeadVideoUrl) —
  // assigned once per lead and reused for every email about their booked
  // call, so rescheduling never breaks a link already sent.
  videoRoom?: string;
}
// Built per call so it follows the active language (a module-level Intl object would freeze on the first locale).
const slotFmt = { format: (d: Date) => new Intl.DateTimeFormat(dl(), { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d) };

// 5 clear steps left→right (a fresh Lead → a New customer who's signed up), plus
// Lost held separately at the end. When a signup matches a lead's email/phone/
// business, the backend auto-moves it to "New customer" (see sales-crm-handoff).
const stg = (id: Stage, key: string, color: string, prob: number) => ({ id, get label() { return tNow(`p8hq.${key}`); }, color, prob });
export const STAGES: { id: Stage; label: string; color: string; prob: number }[] = [
  stg("new", "slStNew", "#6b6880", 0.1),
  stg("contacted", "slStContacted", "#3f78d8", 0.25),
  stg("demo", "slStDemo", "#7c3aed", 0.5),
  stg("trial", "slStTrial", "#a5670a", 0.8),
  stg("won", "slStWon", "#0f7a43", 1),
  stg("lost", "slStLost", "#c02636", 0),
];
const stageOf = (id: Stage) => STAGES.find((s) => s.id === id) ?? STAGES[0];
const VALID_STAGES = new Set(STAGES.map((s) => s.id));
const opt = <I extends string>(id: I, key: string) => ({ id, get label() { return tNow(`p8hq.${key}`); } });
const SOURCES: { id: Source; label: string }[] = [
  opt("cold_call", "slSrcCold"), opt("email", "slSrcEmail"), opt("social", "slSrcSocial"),
  opt("referral", "slSrcReferral"), opt("event", "slSrcEvent"), opt("inbound", "slSrcInbound"),
  opt("website_build", "slSrcWebsite"),
];
const srcLabel = (s: Source) => SOURCES.find((x) => x.id === s)?.label ?? s;
const ACT: { id: Activity["type"]; label: string }[] = [
  opt("call", "slActCall"), opt("email", "slSrcEmail"), opt("social", "slSrcSocial"), opt("demo", "slActDemo"), opt("note", "slActNote"),
];
const PLAN_MRR: Record<Lead["plan"], number> = { freelancer: 29, company: 69, franchise: 86 };
// Stored outcome text stays English (the value); the datalist shows the translated label.
const OUTCOMES = ["Interested", "Booked a demo", "Sent info / pricing", "Call back later", "No answer", "Left voicemail", "Wants to think", "Not interested", "Wrong contact", "Signed up 🎉"];
const HERO = "radial-gradient(120% 160% at 12% -30%, rgba(120,170,255,.5) 0%, transparent 55%), linear-gradient(120deg,#16306e 0%,#274ba3 58%,#3f78d8 100%)";
const money = (n: number) => `£${Math.round(n).toLocaleString(dl())}`;
const uid = () => { try { return crypto.randomUUID(); } catch { return `${Date.now()}-${Math.round(Math.random() * 1e6)}`; } };
const nowIso = () => new Date().toISOString();
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString(dl(), { day: "numeric", month: "short" });

// A touch logged in the modal but not yet saved to the server (the server
// stamps `at`/`by` itself when it lands).
type NewActivity = { type: Activity["type"]; note: string; outcome?: string };


/**
 * The `leads` collection has TWO writers with different shapes, and the board
 * only ever knew about one of them.
 *
 * The public "Book a demo" form (server/src/routes/leads.ts) stores
 * { name, email, phone, business, size, interest, message, source, status } —
 * no contactName, no stage, no plan, no estMrr and, fatally, no activities.
 * The board reads l.activities[0], l.estMrr and l.stage, so a single genuine
 * inbound lead threw "Cannot read properties of undefined (reading '0')" and
 * took the whole page down.
 *
 * Normalising on load rather than guarding at each of the six read sites: a
 * guard would have to be remembered every time someone touches this file, and
 * the next omission is another white screen on the page you use to sell.
 */
const bizDef = (key: string) => ({ get v() { return tNow(`p8hq.${key}`); } });
const BIZ_DEFS: Record<string, { v: string }> = {
  holiday: bizDef("slBizHoliday"), wraparound: bizDef("slBizWrap"), activity: bizDef("slBizActivity"),
  tuition: bizDef("slBizTuition"), preschool: bizDef("slBizPreschool"), nursery: bizDef("slBizNursery"),
  childminder: bizDef("slBizChildminder"), school: bizDef("slBizSchool"), other: bizDef("slBizOther"),
};
// Reads the active language at lookup time (Proxy over the catalogue-backed definitions above).
export const BIZ_TYPE_LABEL: Record<string, string> = new Proxy({} as Record<string, string>, {
  get: (_t, k) => (typeof k === "string" ? BIZ_DEFS[k]?.v : undefined),
});

function normaliseLead(raw: Lead & Partial<{ name: string; message: string; status: string; interest: string; interestedFeatures: string[]; businessType: string; businessTypes: string[] }>): Lead {
  const plan = (["freelancer", "company", "franchise"] as const).includes(raw.plan) ? raw.plan : "company";
  // The demo form's role picker ("Freelancer" / "Company" / "Franchise" /
  // "School or MAT" — the last two both submit as plan "company", since they
  // use the same feature set, but businessType keeps the distinction visible)
  // — surfaced up front in Notes (the one free-text field this board already
  // shows). Its "What would you like us to cover?" checkboxes are kept as
  // their own array (interestedFeatures below) and rendered as a real list
  // in LeadModal, not run together into this sentence-shaped field.
  // The pricing-page add-on form is genuinely multi-select (businessTypes) —
  // the demo page's own role picker stays single-value (businessType).
  // Kept as its own field (not folded into Notes) — see LeadModal, which
  // shows it as a plain info line, and Notes stays purely HQ's own working
  // notes rather than auto-generated text mixed in with real ones.
  const bizTypes = Array.isArray(raw.businessTypes) ? raw.businessTypes : (raw.businessType ? [raw.businessType] : []);
  return {
    ...raw,
    // The demo form calls them name/message/status.
    contactName: raw.contactName || raw.name || "",
    notes: raw.notes || "",
    message: raw.message || undefined,
    businessTypes: bizTypes.length ? bizTypes : undefined,
    interestedFeatures: Array.isArray(raw.interestedFeatures) ? raw.interestedFeatures : undefined,
    interest: raw.interest === "website-design-signup" || raw.interest === "website-design-question" ? raw.interest : undefined,
    stage: VALID_STAGES.has(raw.stage) ? raw.stage : VALID_STAGES.has(raw.status as Stage) ? (raw.status as Stage) : "new",
    business: raw.business || raw.name || raw.email || "Untitled", // canonical stored fallback
    email: raw.email || "", phone: raw.phone || "", location: raw.location || "", owner: raw.owner || "",
    source: normSource(raw.source || "inbound"),
    plan,
    // estMrr feeds a column total — undefined turns it into NaN on screen.
    estMrr: typeof raw.estMrr === "number" ? raw.estMrr : PLAN_MRR[plan],
    kind: (raw.kind && KIND_ORDER.includes(raw.kind)) ? raw.kind : "business",
    activities: Array.isArray(raw.activities) ? raw.activities : [],
    createdAt: raw.createdAt || nowIso(),
    updatedAt: raw.updatedAt || raw.createdAt || nowIso(),
  };
}

export function SalesApp() {
  const tr = useT();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"pipeline" | "dashboard" | "slots" | "calls">("pipeline");
  const [detail, setDetail] = useState<Lead | null>(null);
  const [adding, setAdding] = useState(false);
  // Tasks the HQ board has linked to a lead. They're ordinary tasks — this is
  // the same list, filtered — so ticking one off here or there is the same act.
  const [salesTasks, setSalesTasks] = useState<SalesTask[]>([]);
  // Who's looking, so an assignee that's you reads "Me" here as it does on the
  // task manager.
  const [me, setMe] = useState<Person>({ name: "", email: "" });
  useEffect(() => {
    get<{ name?: string; email?: string }>("/api/me")
      .then((m) => setMe({ name: (m.name ?? "").trim(), email: (m.email ?? "").trim() }))
      .catch(() => {});
  }, []);
  const loadTasks = useCallback(() => {
    get<SalesTask[]>("/api/tasks")
      .then((ts) => setSalesTasks(ts.filter((t) => t.link?.k === "sales" && !t.archived)))
      .catch(() => {});
  }, []);
  useEffect(() => { loadTasks(); }, [loadTasks]);
  const [importing, setImporting] = useState(false);
  const [query, setQuery] = useState("");

  // The API may return stages the board no longer shows (e.g. the old
  // "interested") — fold those into "new" so no lead vanishes between columns.
  const refresh = useCallback(() => {
    get<Lead[]>("/api/platform/leads")
      .then((list) => { setLeads(list.map(normaliseLead)); setError(null); })
      .catch((e) => setError(e instanceof Error ? e.message : tNow("p8hq.slLoadFail")))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtime(["leads"], refresh);

  const upsert = async (lead: Lead, newActs: NewActivity[]) => {
    try {
      let id = lead.id;
      if (leads.some((x) => x.id === lead.id)) await put(`/api/platform/leads/${lead.id}`, lead);
      else id = (await post<Lead>("/api/platform/leads", lead)).id;
      for (const a of newActs) await post(`/api/platform/leads/${id}/activities`, a);
      refresh();
    } catch (e) { setError(e instanceof Error ? e.message : tNow("p8hq.slSaveFail")); }
  };
  const remove = async (id: string) => {
    try { await del(`/api/platform/leads/${id}`); setDetail(null); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : tNow("p8hq.slDeleteFail")); }
  };
  // Drag between columns: optimistic (the card lands instantly), then the
  // realtime refresh confirms — or a failed PUT reverts via refetch.
  const move = (id: string, stage: Stage) => {
    setLeads((cur) => cur.map((x) => (x.id === id ? { ...x, stage, updatedAt: nowIso() } : x)));
    put(`/api/platform/leads/${id}`, { stage }).catch((e) => { setError(e instanceof Error ? e.message : tNow("p8hq.slMoveFail")); refresh(); });
  };
  // HQ books a non-demo lead (e.g. a website-add-on enquiry) onto a real
  // open call slot — sets exactly what a genuine /demo submission would
  // (stage "demo" + slotAt), so it follows the same downstream flow as if
  // they'd booked it themselves.
  const bookDemo = (id: string, slotAt: string) => {
    setLeads((cur) => cur.map((x) => (x.id === id ? { ...x, stage: "demo", slotAt, updatedAt: nowIso() } : x)));
    put(`/api/platform/leads/${id}`, { stage: "demo", slotAt }).catch((e) => { setError(e instanceof Error ? e.message : tNow("p8hq.slBookFail")); refresh(); });
  };
  const doImport = async (rows: Lead[]) => {
    setImporting(false);
    try { await post("/api/platform/leads/bulk", rows); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : tNow("p8hq.slImportFail")); }
  };
  // Answering a "website-design-question" lead: stores the reply on the lead
  // (so it's visible later, not just fired-and-forgotten) AND emails the
  // customer their original question + this answer + a "Book a demo" link —
  // all server-side in one call, see POST …/:id/answer.
  const answerQuestion = async (id: string, answer: string) => {
    await put(`/api/platform/leads/${id}/answer`, { answer });
    refresh();
  };

  const PRIO_DOT: Record<string, string> = { urgent: "#ef4444", high: "#f59e0b", med: "#3b82f6", low: "#8a93a6" };
  const today = new Date().toISOString().slice(0, 10);
  const tasksByLead = salesTasks.reduce<Record<string, SalesTask[]>>((acc, t) => {
    const k = t.link?.v ?? "—";
    (acc[k] ??= []).push(t);
    return acc;
  }, {});

  return (
    <div className="text-[var(--ink)]">
      <div className="overflow-hidden rounded-2xl text-white" style={{ backgroundImage: `radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1.6px), ${HERO}`, backgroundSize: "18px 18px, cover, cover, cover, cover", backgroundRepeat: "repeat, no-repeat, no-repeat, no-repeat, no-repeat" }}>
        <div className="flex flex-wrap items-end justify-between gap-3 px-6 py-5">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "#ffd23f" }}>{tr("p8hq.slEyebrow")}</div>
            <h2 className="mt-0.5 text-[25px] font-extrabold" style={{ fontFamily: "var(--ff-display)", color: "#fff" }}>{tr("p8hq.slTitle")}</h2>
            <p className="mt-1 max-w-[620px] text-[12.5px] leading-snug text-white/85">{tr("p8hq.slSubtitle")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-full bg-white/12 p-1 text-[12px] font-bold">
              {([["pipeline", tr("p8hq.slTabPipeline")], ["dashboard", tr("p8hq.slTabDashboard")], ["slots", tr("p8hq.slTabSlots")], ["calls", tr("p8hq.slTabCalls")]] as const).map(([v, l]) => (
                <button key={v} type="button" onClick={() => setTab(v)} className="rounded-full px-3 py-1 transition-colors" style={tab === v ? { background: "#fff", color: "#1d3a8f" } : { color: "rgba(255,255,255,.8)" }}>{l}</button>
              ))}
            </div>
            <button type="button" onClick={() => setImporting(true)} className="rounded-full border border-white/30 bg-white/10 px-4 py-2 text-[12.5px] font-bold text-white hover:bg-white/20">{tr("p8hq.slImportCsv")}</button>
            <button type="button" onClick={() => setAdding(true)} className="rounded-full bg-[#ffd23f] px-4 py-2 text-[12.5px] font-extrabold text-[#3a2a00] hover:brightness-105">{tr("p8hq.slAddLead")}</button>
          </div>
        </div>
      </div>

      {error && <div className="mt-3 rounded-lg bg-[#fdebec] px-3 py-2 text-[12px] font-bold text-[var(--red)]">{error}</div>}

      {loading ? <div className="py-12 text-center text-[12.5px] text-[var(--ink-3)]">{tr("p8hq.slLoading")}</div> : tab === "pipeline" ? (() => {
        const q = query.trim().toLowerCase();
        const qDigits = q.replace(/\D/g, "");
        const filtered = !q ? leads : leads.filter((l) => {
          const hay = `${l.business} ${l.contactName} ${l.email} ${l.location} ${l.owner}`.toLowerCase();
          const phoneMatch = qDigits.length >= 3 && l.phone.replace(/\D/g, "").includes(qDigits);
          return hay.includes(q) || phoneMatch;
        });
        return (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tr("p8hq.slSearchPh")} className="w-full max-w-[440px] rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-[13px] text-[var(--ink)] outline-none focus:border-[#1d3a8f]" />
              {q && <span className="text-[12px] text-[var(--ink-3)]">{tr("p8hq.slMatches", { n: filtered.length })} · <button type="button" onClick={() => setQuery("")} className="font-bold text-[#1d3a8f]">{tr("p8hq.slClear")}</button></span>}
              {q && filtered.length === 0 && <button type="button" onClick={() => setAdding(true)} className="rounded-full bg-[#0f7a43] px-3 py-1.5 text-[12px] font-bold text-white">{tr("p8hq.slNewNotFound")}</button>}
            </div>
            <Pipeline leads={filtered} onOpen={setDetail} onMove={move} onBookDemo={bookDemo} />
          </>
        );
      })() : tab === "dashboard" ? <Dashboard leads={leads} /> : tab === "slots" ? <DemoSlotsPanel /> : <VideoCallsPanel leads={leads} onOpen={setDetail} onMove={move} />}

      {(detail || adding) && (
        <LeadModal
          lead={detail}
          onClose={() => { setDetail(null); setAdding(false); }}
          onSave={(l, acts) => { void upsert(l, acts); setDetail(null); setAdding(false); }}
          onDelete={detail ? () => void remove(detail.id) : undefined}
          onAnswerQuestion={answerQuestion}
        />
      )}
      {tab === "pipeline" && salesTasks.length > 0 && (
        <section className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-[16px] font-extrabold">{tr("p8hq.slTasksTitle")}</h3>
              <p className="mt-0.5 text-[12.5px] text-[var(--ink-2)]">
                {tr("p8hq.slTasksSub", { n: salesTasks.filter((t) => t.due && t.due < today && t.status !== "done").length })}
              </p>
            </div>
            <a href="/platform/tasks" className="rounded-full border border-[var(--line)] px-3 py-1.5 text-[12px] font-bold text-[#1d3a8f] hover:bg-[#eef4fd]">{tr("p8hq.slTasksOpen")}</a>
          </div>
          <div className="mt-4 space-y-4">
            {Object.entries(tasksByLead).sort(([a], [b]) => a.localeCompare(b)).map(([lead, ts]) => (
              <div key={lead}>
                <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{lead}</div>
                <ul className="overflow-hidden rounded-xl border border-[var(--line)]">
                  {/* Sorted by date, THEN folded — so the row a repeat shows is
                      its next date, with the count of the rest beside it rather
                      than thirty more rows under it. */}
                  {foldRepeats([...ts].sort((a, b) => `${a.due ?? "9999"}`.localeCompare(`${b.due ?? "9999"}`))).map(({ lead: t, rest }, i) => {
                    const overdue = !!t.due && t.due < today && t.status !== "done";
                    const who = whoLabel(t, me);
                    return (
                      <li key={t.id} className={`flex items-center gap-3 px-3 py-2.5 ${i > 0 ? "border-t border-[var(--line)]" : ""}`}>
                        <span className="h-2 w-2 flex-none rounded-full" style={{ background: PRIO_DOT[t.prio ?? "med"] }} />
                        <a href={`/platform/tasks?task=${t.id}`} className={`min-w-0 flex-1 truncate text-[13.5px] font-semibold hover:underline ${t.status === "done" ? "text-[var(--ink-3)] line-through" : ""}`}>{t.t}</a>
                        {rest.length > 0 && (
                          <span className="hidden shrink-0 rounded-full bg-[var(--panel)] px-2 py-0.5 text-[11px] font-bold text-[var(--ink-3)] sm:inline"
                            title={tr("p8hq.slTaskRepeats", { freq: t.seriesFreq ? REPEAT_WORD[t.seriesFreq] ?? t.seriesFreq : "", n: rest.length })}>
                            🔁 +{rest.length}
                          </span>
                        )}
                        {who && <span className="hidden shrink-0 text-[11.5px] text-[var(--ink-3)] sm:inline">{who}</span>}
                        <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-extrabold"
                          style={overdue ? { background: "#fdeaee", color: "#b3123c" } : { background: "var(--panel)", color: "var(--ink-3)" }}>
                          {t.due ? (overdue ? tr("p8hq.slOverdue", { date: t.due }) : t.due) : tr("p8hq.slNoDate")}{t.time ? ` · ${t.time}` : ""}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
      {importing && <ImportModal existing={leads} onClose={() => setImporting(false)} onImport={(next) => void doImport(next)} />}
    </div>
  );
}

// ── Pipeline — one full-width page per stage ────────────────────────────────
// Was a 6-column kanban board with drag-and-drop between columns: dragging
// wasn't usable on touch/smaller screens, and side-by-side narrow columns
// left leads' details cramped and later columns squeezed off-screen. Each
// stage now gets the full page width as its own tab; the "Move to" dropdown
// (already added for non-drag devices) is the only way to change stage now.
function Pipeline({ leads, onOpen, onMove, onBookDemo }: { leads: Lead[]; onOpen: (l: Lead) => void; onMove: (id: string, s: Stage) => void; onBookDemo: (id: string, slotAt: string) => void }) {
  const router = useRouter();
  const tr = useT();
  const [stage, setStage] = useState<Stage>("new");
  const items = leads.filter((l) => l.stage === stage);
  const sum = items.reduce((a, b) => a + b.estMrr, 0);

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-1.5">
        {STAGES.map((st) => {
          const n = leads.filter((l) => l.stage === st.id).length;
          return (
            <button key={st.id} type="button" onClick={() => setStage(st.id)}
              className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] font-extrabold ${stage === st.id ? "border-[#1d3a8f] bg-[#eaf0fc] text-[#1d3a8f]" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)]"}`}>
              <span className="h-2 w-2 rounded-full" style={{ background: st.color }} />{st.label}
              <span className="text-[var(--ink-3)]">{n}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[12.5px] font-bold text-[var(--ink-2)]">{tr("p8hq.slLeadsSum", { n: items.length, sum: money(sum) })}</span>
      </div>

      <div className="mt-2 flex flex-col gap-2">
        {items.length === 0 && <div className="rounded-xl border border-dashed border-[var(--line)] py-8 text-center text-[12.5px] text-[var(--ink-3)]">{tr("p8hq.slNothingIn", { stage: STAGES.find((s) => s.id === stage)?.label ?? "" })}</div>}
        {items.map((l) => (
          <div key={l.id} onClick={() => onOpen(l)}
            className="flex cursor-pointer flex-wrap items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 shadow-[0_1px_2px_rgba(16,24,40,.05)] hover:border-[var(--ink-3)]">
            <span title={KINDS[l.kind ?? "business"].label} className="text-[16px]">{KINDS[l.kind ?? "business"].icon}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-extrabold">{l.business}</div>
              <div className="truncate text-[11.5px] text-[var(--ink-3)]">{l.contactName} · {l.location}</div>
              {l.interest === "website-design-question" && (
                <div className="mt-0.5 truncate text-[11.5px] font-semibold text-[#a5670a]">{tr("p8hq.slAsked", { msg: l.message || tr("p8hq.slNoMessage") })}{l.activities.some((a) => a.direction === "out") ? tr("p8hq.slAnswered") : ""}</div>
              )}
            </div>
            {l.interest === "website-design-signup" && (
              <span className="truncate rounded-md bg-[#eafaf0] px-2 py-1 text-[11px] font-bold text-[#127a3e]">{tr("p8hq.slWantsSite")}</span>
            )}
            {l.interest === "website-design-question" && (
              <span className="truncate rounded-md bg-[#fdf3e5] px-2 py-1 text-[11px] font-bold text-[#a5670a]">{tr("p8hq.slQuestion")}</span>
            )}
            {l.slotAt && (
              l.videoRoom ? (
                <button type="button" onClick={(e) => { e.stopPropagation(); router.push(`/platform/call/${l.id}`); }}
                  className="truncate rounded-md bg-[#eef4fd] px-2 py-1 text-[11px] font-bold text-[#1d3a8f] hover:bg-[#dde8fb]">
                  {tr("p8hq.slVideoCallAt", { time: slotFmt.format(new Date(l.slotAt)) })}
                </button>
              ) : (
                <span className="truncate rounded-md bg-[#eef4fd] px-2 py-1 text-[11px] font-bold text-[#1d3a8f]">
                  {tr("p8hq.slVideoCallAt", { time: slotFmt.format(new Date(l.slotAt)) })}
                </span>
              )
            )}
            {l.lastReplyAt && (
              <span title={tr("p8hq.slRepliedTip")} className="truncate rounded-md bg-[#eef2fb] px-2 py-1 text-[11px] font-bold text-[#3f5bb3]">{tr("p8hq.slReplied", { date: fmtDay(l.lastReplyAt) })}</span>
            )}
            <span className="text-[11px] text-[var(--ink-3)]">{srcLabel(l.source).split(" ")[0]}{l.owner ? ` · ${l.owner}` : ""}</span>
            <span className="rounded-full bg-[#eaf0fc] px-2 py-0.5 text-[11px] font-bold capitalize text-[#1d3a8f]">{tr(`p8hq.slPlan${l.plan === "freelancer" ? "Freelancer" : l.plan === "franchise" ? "Franchise" : "Company"}`)}</span>
            {l.activities[0] && <span className="truncate text-[10.5px] text-[var(--ink-3)]">{fmtDay(l.activities[0].at)}: {l.activities[0].note}</span>}
            {!l.slotAt && l.stage !== "won" && l.stage !== "lost" && (
              <BookDemoButton onBook={(iso) => onBookDemo(l.id, iso)} />
            )}
            <select
              value={l.stage}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => onMove(l.id, e.target.value as Stage)}
              className="ms-auto rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2 py-1.5 text-[11.5px] font-bold text-[var(--ink-2)]"
            >
              {STAGES.map((s) => <option key={s.id} value={s.id}>{tr("p8hq.slMoveTo", { stage: s.label })}</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

// A lead who hasn't booked a call themselves (a website-add-on enquiry, a
// cold prospect, …) can still be put on one by HQ — reuses the exact same
// open-slot feed the public /demo page reads (server/src/routes/demoSlots.ts),
// so a slot taken here can never double-book a real self-served one, and
// picking one drives the lead through the identical stage+slotAt shape a
// genuine demo submission would.
interface DemoSlot { iso: string; durationMins: number }
const slotDayFmt = { format: (d: Date) => new Intl.DateTimeFormat(dl(), { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short" }).format(d) };
const slotTimeFmt = { format: (d: Date) => new Intl.DateTimeFormat(dl(), { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" }).format(d) };
const slotDayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" });

function BookDemoButton({ onBook }: { onBook: (iso: string) => void }) {
  const tr = useT();
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState<DemoSlot[] | null>(null);

  const openPicker = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(true);
    if (!slots) get<DemoSlot[]>("/api/demo-slots").then(setSlots).catch(() => setSlots([]));
  };

  const byDay = (slots ?? []).reduce<Record<string, DemoSlot[]>>((acc, s) => {
    const k = slotDayKey.format(new Date(s.iso));
    (acc[k] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button type="button" onClick={openPicker} className="truncate rounded-md border border-[#dbe6fb] bg-[var(--surface)] px-2 py-1 text-[11px] font-bold text-[#1d3a8f] hover:bg-[#eef4fd]">
        {tr("p8hq.slBookDemoBtn")}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[59]" onClick={() => setOpen(false)} />
          <div className="absolute end-0 top-full z-[60] mt-1.5 max-h-72 w-72 overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2.5 shadow-xl">
            {slots === null ? (
              <div className="p-2 text-[12px] text-[var(--ink-3)]">{tr("p8hq.slSlotsLoading")}</div>
            ) : Object.keys(byDay).length === 0 ? (
              <div className="p-2 text-[12px] text-[var(--ink-3)]">{tr("p8hq.slSlotsNone")}</div>
            ) : (
              Object.entries(byDay).map(([day, daySlots]) => (
                <div key={day} className="mb-2 last:mb-0">
                  <div className="mb-1 text-[10.5px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{slotDayFmt.format(new Date(daySlots[0].iso))}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {daySlots.map((s) => (
                      <button key={s.iso} type="button" onClick={() => { onBook(s.iso); setOpen(false); }}
                        className="rounded-full border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1 text-[11.5px] font-bold text-[var(--ink-2)] hover:border-[#1d3a8f] hover:bg-[#eef4fd] hover:text-[#1d3a8f]">
                        {slotTimeFmt.format(new Date(s.iso))}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Dashboard ───────────────────────────────────────────────────────────────
const PERIOD_KEYS: [string, string][] = [["today", "slPerToday"], ["5d", "slPer5d"], ["week", "slPerWeek"], ["month", "slPerMonth"], ["3m", "slPer3m"], ["6m", "slPer6m"], ["9m", "slPer9m"]];
const PERIOD_DAYS: Record<string, number> = { "5d": 5, week: 7, month: 30, "3m": 90, "6m": 180, "9m": 270 };

function Dashboard({ leads }: { leads: Lead[] }) {
  const tr = useT();
  const PERIODS: [string, string][] = PERIOD_KEYS.map(([id, k]) => [id, tr(`p8hq.${k}`)]);
  const [now] = useState(() => Date.now()); // captured once — pure during render
  const [period, setPeriod] = useState("month");
  const DAY = 86_400_000;
  const midnight = (() => { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.getTime(); })();
  const cutoff = period === "today" ? midnight : now - (PERIOD_DAYS[period] ?? 30) * DAY;
  const within = (iso: string) => new Date(iso).getTime() >= cutoff;
  const pLabel = (PERIODS.find((p) => p[0] === period)?.[1] ?? "").toLocaleLowerCase(dl());

  // Now-snapshots (live pipeline — not time-bound).
  const open = leads.filter((l) => l.stage !== "won" && l.stage !== "lost");
  const pipeline = open.reduce((a, b) => a + b.estMrr, 0);
  const forecast = open.reduce((a, b) => a + b.estMrr * stageOf(b.stage).prob, 0);
  const funnelMax = Math.max(1, ...STAGES.filter((s) => s.id !== "lost").map((s) => leads.filter((l) => l.stage === s.id).length));

  // Period-filtered figures.
  const newLeads = leads.filter((l) => within(l.createdAt));
  const wonP = leads.filter((l) => l.stage === "won" && within(l.updatedAt));
  const lostP = leads.filter((l) => l.stage === "lost" && within(l.updatedAt));
  const wonMrr = wonP.reduce((a, b) => a + b.estMrr, 0);
  const winRate = wonP.length + lostP.length ? wonP.length / (wonP.length + lostP.length) : 0;
  const activities = leads.flatMap((l) => l.activities.map((a) => ({ ...a, business: l.business }))).filter((a) => within(a.at)).sort((a, b) => (a.at < b.at ? 1 : -1));
  const byType: Record<string, number> = {}; for (const a of activities) byType[a.type] = (byType[a.type] ?? 0) + 1;
  const byRep: Record<string, number> = {}; for (const a of activities) byRep[a.by] = (byRep[a.by] ?? 0) + 1;
  const bySource = (() => { const m: Record<string, number> = {}; for (const l of newLeads) m[l.source] = (m[l.source] ?? 0) + 1; return Object.entries(m).sort((a, b) => b[1] - a[1]); })();
  const bySourceMax = Math.max(1, ...bySource.map((s) => s[1]));

  // This window vs the equal window before it.
  const len = now - cutoff;
  const winMetrics = (from: number, to: number) => {
    const inW = (iso: string) => { const t = new Date(iso).getTime(); return t >= from && t < to; };
    const a = leads.flatMap((l) => l.activities).filter((x) => inW(x.at));
    return {
      newLeads: leads.filter((l) => inW(l.createdAt)).length,
      contacted: a.filter((x) => x.type === "call" || x.type === "email" || x.type === "social").length,
      demos: a.filter((x) => x.type === "demo").length,
      trials: leads.filter((l) => l.stage === "trial" && inW(l.updatedAt)).length,
      won: leads.filter((l) => l.stage === "won" && inW(l.updatedAt)).length,
    };
  };
  const cur = winMetrics(cutoff, now);
  const prev = winMetrics(cutoff - len, cutoff);
  const COMPARE: [string, keyof typeof cur][] = [[tr("p8hq.slCmpNew"), "newLeads"], [tr("p8hq.slCmpContacted"), "contacted"], [tr("p8hq.slCmpDemos"), "demos"], [tr("p8hq.slCmpTrials"), "trials"], [tr("p8hq.slCmpCustomers"), "won"]];

  return (
    <div className="mt-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-bold text-[var(--ink-3)]">{tr("p8hq.slShow")}</span>
        <div className="inline-flex flex-wrap items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--surface)] p-1 text-[12px] font-bold">
          {PERIODS.map(([id, label]) => (
            <button key={id} type="button" onClick={() => setPeriod(id)} className="rounded-full px-3 py-1 transition-colors" style={period === id ? { background: "#1d3a8f", color: "#fff" } : { color: "var(--ink-3)" }}>{label}</button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label={tr("p8hq.slTileOpen")} value={money(pipeline)} sub={tr("p8hq.slTileLive", { n: open.length })} accent="#1d3a8f" />
        <Tile label={tr("p8hq.slTileForecast")} value={money(forecast)} sub={tr("p8hq.slTileOdds")} accent="#7c3aed" />
        <Tile label={tr("p8hq.slTileNewCust", { period: pLabel })} value={String(wonP.length)} sub={tr("p8hq.slTileWon", { money: money(wonMrr), pct: Math.round(winRate * 100) })} accent="#0f7a43" />
        <Tile label={tr("p8hq.slTileActivity", { period: pLabel })} value={String(activities.length)} sub={tr("p8hq.slTileActivitySub", { calls: byType.call ?? 0, emails: byType.email ?? 0, demos: byType.demo ?? 0 })} accent="#f0b100" />
      </div>

      <div className="mt-4">
        <Card title={tr("p8hq.slCompareTitle", { period: pLabel })}>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead><tr className="text-start text-[10.5px] uppercase tracking-wide text-[var(--ink-3)]"><th className="pb-2">{tr("p8hq.slColMetric")}</th><th className="pb-2 text-end">{tr("p8hq.slColPrev")}</th><th className="pb-2 text-end">{tr("p8hq.slColThis")}</th><th className="pb-2 text-end">{tr("p8hq.slColChange")}</th></tr></thead>
              <tbody>
                {COMPARE.map(([label, key]) => {
                  const c = cur[key], p = prev[key], delta = c - p;
                  const col = delta > 0 ? "#0f7a43" : delta < 0 ? "#c02636" : "var(--ink-3)";
                  return (
                    <tr key={key} className="border-t border-[var(--line)]">
                      <td className="py-2 font-semibold">{label}</td>
                      <td className="py-2 text-end tabular-nums text-[var(--ink-3)]">{p}</td>
                      <td className="py-2 text-end text-[15px] font-extrabold tabular-nums">{c}</td>
                      <td className="py-2 text-end font-bold tabular-nums" style={{ color: col }}>{delta > 0 ? "▲ +" : delta < 0 ? "▼ −" : "• "}{delta === 0 ? "0" : Math.abs(delta)}{p > 0 ? ` (${delta >= 0 ? "+" : "−"}${Math.round((Math.abs(delta) / p) * 100)}%)` : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title={tr("p8hq.slFunnel")}>
          <div className="flex flex-col gap-2">
            {STAGES.filter((s) => s.id !== "lost").map((st) => {
              const items = leads.filter((l) => l.stage === st.id);
              const sum = items.reduce((a, b) => a + b.estMrr, 0);
              return (
                <div key={st.id}>
                  <div className="mb-1 flex items-center justify-between text-[12px]"><span className="flex items-center gap-1.5 font-semibold"><span className="h-2 w-2 rounded-full" style={{ background: st.color }} />{st.label}</span><span className="text-[var(--ink-3)]">{items.length} · {money(sum)}</span></div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full" style={{ width: `${(items.length / funnelMax) * 100}%`, background: st.color }} /></div>
                </div>
              );
            })}
          </div>
        </Card>
        <Card title={tr("p8hq.slBySource", { period: pLabel })}>
          {bySource.length ? (
            <div className="flex flex-col gap-2.5">
              {bySource.map(([src, n]) => (
                <div key={src}>
                  <div className="mb-1 flex items-center justify-between text-[12px]"><span className="font-semibold">{srcLabel(src as Source)}</span><span className="text-[var(--ink-3)]">{tr("p8hq.slLeadsN", { n })}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full" style={{ width: `${(n / bySourceMax) * 100}%`, background: "#3f78d8" }} /></div>
                </div>
              ))}
            </div>
          ) : <div className="py-6 text-center text-[12px] text-[var(--ink-3)]">{tr("p8hq.slNoNewLeads")}</div>}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title={tr("p8hq.slRepActivity", { period: pLabel })}>
          {Object.keys(byRep).length ? (
            <div className="flex flex-col divide-y divide-[var(--line)]">
              {Object.entries(byRep).sort((a, b) => b[1] - a[1]).map(([rep, n]) => (
                <div key={rep} className="flex items-center justify-between py-2 text-[12.5px]"><span className="font-semibold">{rep}</span><span className="font-extrabold tabular-nums">{tr("p8hq.slTouches", { n })}</span></div>
              ))}
            </div>
          ) : <div className="py-6 text-center text-[12px] text-[var(--ink-3)]">{tr("p8hq.slNoActivity")}</div>}
        </Card>
        <Card title={tr("p8hq.slRecentActivity", { period: pLabel })}>
          <div className="flex flex-col divide-y divide-[var(--line)]">
            {activities.slice(0, 8).map((a) => (
              <div key={a.id} className="flex items-start gap-2 py-2 text-[12px]">
                <span>{ACT.find((x) => x.id === a.type)?.label.split(" ")[0]}</span>
                <div className="min-w-0 flex-1"><span className="font-semibold">{a.business}</span> <span className="text-[var(--ink-3)]">— {a.note}{a.outcome ? ` (${a.outcome})` : ""}</span></div>
                <span className="shrink-0 text-[10.5px] text-[var(--ink-3)]">{fmtDay(a.at)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── Lead modal (add / edit / activity) ──────────────────────────────────────
function LeadModal({ lead, onClose, onSave, onDelete, onAnswerQuestion }: { lead: Lead | null; onClose: () => void; onSave: (l: Lead, newActs: NewActivity[]) => void; onDelete?: () => void; onAnswerQuestion: (id: string, answer: string) => Promise<void> }) {
  const router = useRouter();
  const tr = useT();
  const [f, setF] = useState<Lead>(() => lead ?? {
    id: "", business: "", kind: "business", contactName: "", email: "", phone: "", location: "", source: "cold_call", owner: "", plan: "company", estMrr: PLAN_MRR.company, stage: "new", notes: "", activities: [], createdAt: nowIso(), updatedAt: nowIso(),
  });
  const [act, setAct] = useState<{ type: Activity["type"]; note: string; outcome: string }>({ type: "call", note: "", outcome: "" });
  // Always starts blank — this is "write a NEW message", never "edit the
  // last one". The thread itself (f.activities, direction "in"/"out") is
  // the only record of what's already been said; nothing here overwrites it.
  const [answerDraft, setAnswerDraft] = useState("");
  const [answerBusy, setAnswerBusy] = useState(false);
  const sendAnswer = async () => {
    const text = answerDraft.trim();
    if (!text || answerBusy) return;
    setAnswerBusy(true);
    try {
      await onAnswerQuestion(f.id, text);
      // Reflect it immediately rather than waiting on a refetch — the server
      // prepends the identical shape (routes/platformLeads.ts PUT …/answer).
      setF((x) => ({ ...x, activities: [{ id: uid(), type: "email", direction: "out", note: text, at: nowIso(), by: "You" }, ...x.activities] }));
      setAnswerDraft("");
    } finally {
      setAnswerBusy(false);
    }
  };
  // A dedicated "call notes" writer — distinct from the generic activity
  // logger below, so it's obvious this is HQ's own working notes on this
  // person (saved straight to the lead), with an explicit choice on whether
  // it also gets emailed to them or stays internal-only. Posts through the
  // same activities endpoint (type "note"), tagged `shared` server-side.
  const [noteDraft, setNoteDraft] = useState("");
  const [noteShare, setNoteShare] = useState<boolean>(false);
  const [noteBusy, setNoteBusy] = useState(false);
  const saveCallNote = async () => {
    const text = noteDraft.trim();
    if (!text || noteBusy || !f.id) return;
    setNoteBusy(true);
    try {
      // The server returns the WHOLE lead (its activities array, freshly
      // prepended) — same response shape as the answer-question endpoint.
      const saved = await post<Lead>(`/api/platform/leads/${f.id}/activities`, { type: "note", note: text, shared: noteShare });
      setF((x) => ({ ...x, activities: saved.activities }));
      setNoteDraft("");
      setNoteShare(false);
    } finally {
      setNoteBusy(false);
    }
  };
  // Touches logged here are sent on Save (POST …/activities — the server
  // stamps at/by); shown in the list immediately with a local placeholder.
  const [pending, setPending] = useState<NewActivity[]>([]);
  const set = (patch: Partial<Lead>) => setF((x) => ({ ...x, ...patch }));
  const fld = "w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] text-[var(--ink)] outline-none focus:border-[#1d3a8f]";
  const lbl = "text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]";
  const logActivity = () => {
    if (!act.note.trim()) return;
    const entry: NewActivity = { type: act.type, note: act.note.trim(), ...(act.outcome.trim() ? { outcome: act.outcome.trim() } : {}) };
    setPending((p) => [...p, entry]);
    set({ activities: [{ id: uid(), ...entry, at: nowIso(), by: f.owner || "—" }, ...f.activities], updatedAt: nowIso() });
    setAct({ type: "call", note: "", outcome: "" });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={onClose}>
      <div className="my-6 w-[min(640px,96vw)] rounded-2xl bg-[var(--surface)] shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2 rounded-t-2xl px-5 py-3.5 text-white" style={{ background: HERO }}>
          <div className="text-[15px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{lead ? f.business || tr("p8hq.slLead") : tr("p8hq.slNewLead")}</div>
          <button type="button" onClick={onClose} className="rounded-full bg-white/15 px-3 py-1 text-[12px] font-bold">{tr("p8hq.slClose")}</button>
        </div>
        {f.interest === "website-design-question" && (() => {
          // The thread: their original message first, then every "in"/"out"
          // activity in chronological order. f.activities is stored
          // newest-first (every writer prepends — see platformLeads.ts and
          // routes/emails.ts), so the email-thread slice is reversed for
          // natural oldest-to-newest reading; the generic Activity log
          // further down keeps the newest-first order it's always had.
          const thread = f.activities.filter((a) => a.type === "email" && a.direction).slice().reverse();
          const bubble = (dir: "in" | "out", text: string, who: string, at?: string) => (
            <div key={`${dir}-${at ?? "orig"}-${who}`} className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed ${dir === "out" ? "ms-auto bg-[#1d3a8f] text-white" : "border border-[#bfe6cf] bg-[#eafaf0] text-[#0f5132]"}`}>
              <div className={`mb-0.5 text-[10.5px] font-bold uppercase tracking-wide ${dir === "out" ? "text-white/70" : "text-[#127a3e]"}`}>{who}{at ? ` · ${fmtDay(at)}` : ""}</div>
              {text}
            </div>
          );
          return (
            <div className="border-b border-[var(--line)] bg-[#fff8ee] p-5">
              <div className="mb-2.5 text-[11px] font-extrabold uppercase tracking-wide text-[#a5670a]">{tr("p8hq.slThreadTitle")}</div>
              <div className="flex flex-col gap-2">
                {bubble("in", f.message || tr("p8hq.slNoMsgIncluded"), tr("p8hq.slThem"))}
                {thread.map((a) => bubble(a.direction!, a.note, a.direction === "out" ? tr("p8hq.slYou") : tr("p8hq.slThem"), a.at))}
              </div>
              <textarea rows={2} value={answerDraft} onChange={(e) => setAnswerDraft(e.target.value)} placeholder={tr("p8hq.slReplyPh")}
                className="mt-3 w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2.5 text-[13px] text-[var(--ink)] outline-none focus:border-[#1d3a8f]" />
              <div className="mt-2 flex items-center gap-2">
                <button type="button" onClick={() => void sendAnswer()} disabled={!answerDraft.trim() || answerBusy} className="rounded-lg bg-[#1d3a8f] px-4 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-40">
                  {answerBusy ? tr("p8hq.slSending") : tr("p8hq.slSend")}
                </button>
                <span className="text-[11px] text-[var(--ink-3)]">{tr("p8hq.slEmailsThem", { who: f.email || tr("p8hq.slThemFallback") })}</span>
              </div>
            </div>
          );
        })()}
        {f.videoRoom && (
          <div className="border-b border-[var(--line)] bg-[#eef4fd] p-5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wide text-[#1d3a8f]">{tr("p8hq.slVideoCallHead")}{f.slotAt ? ` · ${slotFmt.format(new Date(f.slotAt))}` : ""}</span>
              {/* A real portal page (/platform/call/<id>), not a modal iframe
                  or an external tab — the call, and a place to take notes on
                  it, live inside the app the same as everything else. */}
              <button type="button" onClick={() => { onClose(); router.push(`/platform/call/${f.id}`); }} className="ms-auto rounded-lg bg-[#1d3a8f] px-3 py-1.5 text-[12px] font-bold text-white hover:brightness-110">
                {tr("p8hq.slJoinCall")}
              </button>
            </div>
          </div>
        )}
        <div className="border-b border-[var(--line)] bg-[var(--panel)] p-5">
          <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[#1d3a8f]">{tr("p8hq.slCallNotes")}</div>
          <p className="mb-2 text-[11.5px] text-[var(--ink-3)]">{tr("p8hq.slCallNotesHelp")}</p>
          {f.activities.filter((a) => a.type === "note").length > 0 && (
            <div className="mb-3 flex flex-col gap-1.5">
              {f.activities.filter((a) => a.type === "note").map((a) => (
                <div key={a.id} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[12.5px] text-[var(--ink)]">
                  <div className="mb-0.5 flex items-center gap-1.5 text-[10.5px] font-bold text-[var(--ink-3)]">
                    {a.by} · {fmtDay(a.at)}
                    {a.shared ? <span className="rounded-full bg-[#eafaf0] px-1.5 py-0.5 font-extrabold text-[#127a3e]">{tr("p8hq.slSharedWith")}</span> : <span className="rounded-full bg-[var(--panel)] px-1.5 py-0.5 font-extrabold text-[var(--ink-3)]">{tr("p8hq.slInternalOnly")}</span>}
                  </div>
                  {a.note}
                </div>
              ))}
            </div>
          )}
          <textarea rows={2} value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder={tr("p8hq.slNotesPh")}
            className="w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2.5 text-[13px] text-[var(--ink)] outline-none focus:border-[#1d3a8f]" />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-[11.5px] font-bold text-[var(--ink-3)]">{tr("p8hq.slShareQ")}</span>
            <button type="button" onClick={() => setNoteShare(false)} className={`rounded-full border px-3 py-1 text-[11.5px] font-bold ${!noteShare ? "border-[#1d3a8f] bg-[#eaf0fc] text-[#1d3a8f]" : "border-[var(--line)] text-[var(--ink-2)]"}`}>{tr("p8hq.slShareNo")}</button>
            <button type="button" onClick={() => setNoteShare(true)} className={`rounded-full border px-3 py-1 text-[11.5px] font-bold ${noteShare ? "border-[#127a3e] bg-[#eafaf0] text-[#127a3e]" : "border-[var(--line)] text-[var(--ink-2)]"}`}>{tr("p8hq.slShareYes")}</button>
            <button type="button" onClick={() => void saveCallNote()} disabled={!noteDraft.trim() || noteBusy} className="ms-auto rounded-lg bg-[#1d3a8f] px-4 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-40">
              {noteBusy ? tr("p8hq.slSaving") : tr("p8hq.slSaveNote")}
            </button>
          </div>
        </div>
        <div className="p-5">
          {!!f.businessTypes?.length && (
            <div className="mb-3 text-[12.5px] text-[var(--ink-2)]"><span className="font-bold text-[var(--ink-3)]">{tr("p8hq.slRuns")}</span> {f.businessTypes.map((t) => BIZ_TYPE_LABEL[t] || t).join(", ")}</div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Selects use htmlFor/id, not a wrapping <label>, so their accessible name is
                just the label text — a wrapped <select>'s computed name also picks up
                whichever <option> is currently selected (e.g. "Type" + "Business"), which
                collided with the real "Business name" field's label in strict-mode lookups. */}
            <div className="block"><label htmlFor="lead-kind" className={lbl}>{tr("p8hq.slFType")}</label>
              <select id="lead-kind" className={fld} value={f.kind ?? "business"} onChange={(e) => set({ kind: e.target.value as Kind })}>
                {KIND_ORDER.map((k) => <option key={k} value={k}>{KINDS[k].icon} {KINDS[k].label}</option>)}
              </select>
            </div>
            <label className="block"><span className={lbl}>{KINDS[f.kind ?? "business"].nameLabel}</span><input className={fld} value={f.business} onChange={(e) => set({ business: e.target.value })} /></label>
            <label className="block"><span className={lbl}>{tr("p8hq.slFContact")}</span><input className={fld} value={f.contactName} onChange={(e) => set({ contactName: e.target.value })} /></label>
            <label className="block"><span className={lbl}>{tr("p8hq.slFLocation")}</span><input className={fld} value={f.location} onChange={(e) => set({ location: e.target.value })} /></label>
            <label className="block"><span className={lbl}>{tr("p8hq.slFEmail")}</span><input className={fld} value={f.email} onChange={(e) => set({ email: e.target.value })} /></label>
            <label className="block"><span className={lbl}>{tr("p8hq.slFPhone")}</span><input className={fld} value={f.phone} onChange={(e) => set({ phone: e.target.value })} /></label>
            <div className="block"><label htmlFor="lead-source" className={lbl}>{tr("p8hq.slFSource")}</label><select id="lead-source" className={fld} value={f.source} onChange={(e) => set({ source: e.target.value as Source })}>{SOURCES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
            <label className="block"><span className={lbl}>{tr("p8hq.slFOwner")}</span><input className={fld} value={f.owner} onChange={(e) => set({ owner: e.target.value })} placeholder={tr("p8hq.slFOwnerPh")} /></label>
            <div className="block"><label htmlFor="lead-plan" className={lbl}>{tr("p8hq.slFPlan")}</label><select id="lead-plan" className={fld} value={f.plan} onChange={(e) => set({ plan: e.target.value as Lead["plan"], estMrr: PLAN_MRR[e.target.value as Lead["plan"]] })}>{(["freelancer", "company", "franchise"] as const).map((p) => <option key={p} value={p}>{tr(`p8hq.slPlan${p === "freelancer" ? "Freelancer" : p === "franchise" ? "Franchise" : "Company"}`)}</option>)}</select></div>
            <div className="block"><label htmlFor="lead-stage" className={lbl}>{tr("p8hq.slFStage")}</label><select id="lead-stage" className={fld} value={f.stage} onChange={(e) => set({ stage: e.target.value as Stage })}>{STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
            {!!f.interestedFeatures?.length && (
              <div className="block sm:col-span-2">
                <span className={lbl}>{tr("p8hq.slFWants")}</span>
                <ul className="mt-1 list-disc space-y-0.5 ps-4 text-[13px] text-[var(--ink)]">
                  {f.interestedFeatures.map((x) => <li key={x}>{x}</li>)}
                </ul>
              </div>
            )}
            <label className="block sm:col-span-2"><span className={lbl}>{tr("p8hq.slFNotes")}</span><textarea rows={2} className={`${fld} resize-y`} value={f.notes} onChange={(e) => set({ notes: e.target.value })} /></label>
          </div>

          {/* Activity log */}
          <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#1d3a8f]">{tr("p8hq.slActLog")}</div>
            <div className="flex flex-wrap gap-2">
              <select className={`${fld} w-auto`} value={act.type} onChange={(e) => setAct({ ...act, type: e.target.value as Activity["type"] })}>{ACT.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select>
              <input className={`${fld} min-w-[120px] flex-1`} placeholder={tr("p8hq.slWhatHappened")} value={act.note} onChange={(e) => setAct({ ...act, note: e.target.value })} />
              <input className={`${fld} w-[170px]`} list="sales-outcomes" placeholder={tr("p8hq.slOutcomePh")} value={act.outcome} onChange={(e) => setAct({ ...act, outcome: e.target.value })} />
              <datalist id="sales-outcomes">{OUTCOMES.map((o, i) => <option key={o} value={o} label={tr(`p8hq.slOut${i + 1}`)} />)}</datalist>
              <button type="button" onClick={logActivity} className="rounded-lg bg-[#1d3a8f] px-3 py-1.5 text-[12px] font-bold text-white">{tr("p8hq.slLog")}</button>
            </div>
            {f.activities.length > 0 && (
              <div className="mt-2.5 flex flex-col divide-y divide-[var(--line)]">
                {f.activities.map((a) => (
                  <div key={a.id} className="flex items-start gap-2 py-1.5 text-[12px]"><span>{ACT.find((x) => x.id === a.type)?.label.split(" ")[0]}</span><div className="min-w-0 flex-1"><span className="font-semibold">{a.note}</span>{a.outcome ? <span className="text-[var(--ink-3)]"> — {a.outcome}</span> : null}<span className="text-[10.5px] text-[var(--ink-3)]"> · {a.by} · {fmtDay(a.at)}</span></div></div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between">
            {onDelete ? <button type="button" onClick={onDelete} className="text-[12px] font-bold text-[var(--red)] hover:underline">{tr("p8hq.slDeleteLead")}</button> : <span />}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="rounded-full border border-[var(--line)] px-4 py-2 text-[12.5px] font-bold text-[var(--ink-3)]">{tr("p8hq.slCancel")}</button>
              <button type="button" onClick={() => onSave({ ...f, business: f.business.trim() || "Untitled", updatedAt: nowIso() }, pending)} className="rounded-full bg-[#1d3a8f] px-5 py-2 text-[12.5px] font-extrabold text-white">{lead ? tr("p8hq.slSave") : tr("p8hq.slAddLead").replace(/^\+\s*/, "")}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="absolute start-0 top-0 h-full w-1" style={{ background: accent }} />
      <div className="ps-1.5"><div className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{label}</div><div className="mt-1 text-[24px] font-extrabold leading-none tabular-nums" style={{ fontFamily: "var(--ff-display)" }}>{value}</div><div className="mt-1.5 text-[11.5px] text-[var(--ink-3)]">{sub}</div></div>
    </div>
  );
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4"><div className="mb-3 text-[13px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{title}</div>{children}</div>;
}

// ── CSV import ──────────────────────────────────────────────────────────────
function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}
type Field = "business" | "contactName" | "email" | "phone" | "location" | "source" | "owner" | "plan" | "estMrr" | "stage" | "notes";
const ALIASES: Record<Field, string[]> = {
  contactName: ["contact", "contact name", "contact_name", "person", "full name", "first name", "lead name"],
  business: ["business", "company", "business name", "organisation", "organization", "provider", "name", "club", "camp"],
  email: ["email", "e-mail", "email address", "mail"],
  phone: ["phone", "tel", "telephone", "mobile", "number", "phone number", "contact number"],
  location: ["location", "city", "town", "area", "region", "county"],
  source: ["source", "channel", "lead source"],
  owner: ["owner", "rep", "assigned", "assigned to", "sales rep", "salesperson"],
  plan: ["plan", "tier", "package"],
  estMrr: ["est mrr", "estmrr", "value", "mrr", "monthly", "price", "£/mo", "est £"],
  stage: ["stage", "status", "pipeline"],
  notes: ["notes", "note", "comment", "comments"],
};
const fieldForHeader = (h: string): Field | null => { const k = h.trim().toLowerCase(); for (const f of Object.keys(ALIASES) as Field[]) if (ALIASES[f].includes(k)) return f; return null; };
const SOURCE_IDS = new Set(SOURCES.map((s) => s.id));
// The demo form and the pricing-page add-on both post a raw `source` string
// with no login — never assume it matches one of our Source ids as-is (an
// unrecognised value silently rendered as the <select>'s first option, "Cold
// call", which is how a website build request once showed up as a cold call).
const normSource = (v: string): Source => {
  const k = v.toLowerCase().trim();
  if (SOURCE_IDS.has(k as Source)) return k as Source;
  if (k.includes("website") || k.includes("addon") || k.includes("add-on")) return "website_build";
  if (k.includes("cold") || k.includes("call")) return "cold_call";
  if (k.includes("email") || k.includes("mail")) return "email";
  if (k.includes("social") || k.includes("insta") || k.includes("face") || k.includes("linked") || k.includes("dm")) return "social";
  if (k.includes("refer")) return "referral";
  if (k.includes("event") || k.includes("confer") || k.includes("expo")) return "event";
  if (k.includes("inbound") || k.includes("web") || k.includes("form") || k.includes("demo")) return "inbound";
  return "cold_call";
};
const normPlan = (v: string): Lead["plan"] => { const k = v.toLowerCase(); if (k.includes("free") || k.includes("solo")) return "freelancer"; if (k.includes("franch")) return "franchise"; return "company"; };
const normStage = (v: string): Stage => { const k = v.toLowerCase(); if (k.includes("won") || k.includes("customer") || k.includes("signed")) return "won"; if (k.includes("lost") || k.includes("dead")) return "lost"; if (k.includes("trial")) return "trial"; if (k.includes("demo")) return "demo"; if (k.includes("contact")) return "contacted"; return "new"; };

function ImportModal({ existing, onClose, onImport }: { existing: Lead[]; onClose: () => void; onImport: (l: Lead[]) => void }) {
  const tr = useT();
  const [parsed, setParsed] = useState<{ leads: Lead[]; skipped: number; fileName: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const onFile = async (file: File) => {
    setErr(null); setParsed(null);
    try {
      const rows = parseCsv(await file.text());
      if (rows.length < 2) { setErr(tr("p8hq.slCsvNoRows")); return; }
      const headers = rows[0];
      const col: Partial<Record<Field, number>> = {};
      headers.forEach((h, i) => { const f = fieldForHeader(h); if (f && col[f] == null) col[f] = i; });
      if (col.business == null && col.contactName == null && col.email == null) { setErr(tr("p8hq.slCsvNoCol")); return; }
      const seen = new Set(existing.map((l) => l.email.trim().toLowerCase()).filter(Boolean));
      const leads: Lead[] = []; let skipped = 0;
      for (const r of rows.slice(1)) {
        const g = (f: Field) => (col[f] != null ? (r[col[f]!] ?? "").trim() : "");
        const email = g("email");
        if (email && seen.has(email.toLowerCase())) { skipped++; continue; }
        if (email) seen.add(email.toLowerCase());
        const plan = col.plan != null ? normPlan(g("plan")) : "company";
        const est = Number(g("estMrr").replace(/[^0-9.]/g, ""));
        const now = nowIso();
        leads.push({ id: uid(), business: g("business") || g("contactName") || email || "Untitled", contactName: g("contactName"), email, phone: g("phone"), location: g("location"), source: col.source != null ? normSource(g("source")) : "cold_call", owner: g("owner"), plan, estMrr: est > 0 ? est : PLAN_MRR[plan], stage: col.stage != null ? normStage(g("stage")) : "new", notes: g("notes"), activities: [], createdAt: now, updatedAt: now });
      }
      if (!leads.length) { setErr(skipped ? tr("p8hq.slCsvAllDup", { n: skipped }) : tr("p8hq.slCsvNoValid")); return; }
      setParsed({ leads, skipped, fileName: file.name });
    } catch { setErr(tr("p8hq.slCsvReadFail")); }
  };

  const template = "data:text/csv;charset=utf-8," + encodeURIComponent("Business,Contact name,Email,Phone,Location,Source,Owner,Plan,Est MRR,Stage,Notes\nSunrise Camps,Jo Bloggs,jo@sunrise.example,07700 900000,Leeds,Cold call,Priya,Company,69,New,Met at expo\n");

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={onClose}>
      <div className="my-6 w-[min(600px,96vw)] rounded-2xl bg-[var(--surface)] shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2 rounded-t-2xl px-5 py-3.5 text-white" style={{ background: HERO }}>
          <div className="text-[15px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{tr("p8hq.slCsvTitle")}</div>
          <button type="button" onClick={onClose} className="rounded-full bg-white/15 px-3 py-1 text-[12px] font-bold">{tr("p8hq.slClose")}</button>
        </div>
        <div className="p-5">
          <p className="text-[12.5px] text-[var(--ink-3)]">{tr("p8hq.slCsvHelp")}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="cursor-pointer rounded-full bg-[#1d3a8f] px-4 py-2 text-[12.5px] font-bold text-white hover:brightness-110">{tr("p8hq.slCsvChoose")}<input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = ""; }} /></label>
            <a href={template} download="activityos-leads-template.csv" className="text-[12px] font-bold text-[#1d3a8f] hover:underline">{tr("p8hq.slCsvTemplate")}</a>
          </div>
          {err && <div className="mt-3 rounded-lg bg-[#fdebec] px-3 py-2 text-[12px] font-bold text-[var(--red)]">{err}</div>}
          {parsed && (
            <div className="mt-4">
              <div className="rounded-lg bg-[#eaf0fc] px-3 py-2 text-[12.5px] font-bold text-[#1d3a8f]">{tr("p8hq.slCsvReady", { file: parsed.fileName, n: parsed.leads.length, skipped: parsed.skipped ? tr("p8hq.slCsvSkipped", { n: parsed.skipped }) : "" })}</div>
              <div className="mt-2 overflow-hidden rounded-xl border border-[var(--line)]">
                <div className="max-h-[220px] overflow-y-auto">
                  {parsed.leads.slice(0, 25).map((l) => (
                    <div key={l.id} className="flex items-center gap-2 border-b border-[var(--line)] px-3 py-1.5 text-[12px] last:border-0">
                      <span className="min-w-0 flex-1 truncate font-semibold">{l.business}</span>
                      <span className="truncate text-[11px] text-[var(--ink-3)]">{l.email || l.phone || "—"}</span>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: stageOf(l.stage).color }}>{stageOf(l.stage).label}</span>
                    </div>
                  ))}
                </div>
                {parsed.leads.length > 25 && <div className="px-3 py-1.5 text-[10.5px] text-[var(--ink-3)]">{tr("p8hq.slCsvMore", { n: parsed.leads.length - 25 })}</div>}
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <button type="button" onClick={onClose} className="rounded-full border border-[var(--line)] px-4 py-2 text-[12.5px] font-bold text-[var(--ink-3)]">{tr("p8hq.slCancel")}</button>
                <button type="button" onClick={() => onImport(parsed.leads)} className="rounded-full bg-[#0f7a43] px-5 py-2 text-[12.5px] font-extrabold text-white">{tr("p8hq.slCsvImportN", { n: parsed.leads.length })}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
