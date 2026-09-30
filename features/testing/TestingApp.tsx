"use client";

import { dateLocale as dl } from "@/lib/i18n/format";
import { useT } from "@/lib/i18n/provider";
import { useEffect, useMemo, useState } from "react";
import { PLAN, PLAN_START, AMIR_DUE, PREREQS, type Day, type Step } from "@/lib/testing/plan";
import { PLAN2, PLAN2_START, PREREQS2 } from "@/lib/testing/plan2";
import { BACKLOG, bySeverity, type Who } from "@/lib/testing/backlog";
import {
  loadRun, saveResult, clearStep, progressOf, openFor, buildHandover, buildFullReport,
  stepById, type Run, type Verdict, type Owner,
} from "@/lib/testing/store";
import { testLoggerOn, setTestLoggerOn } from "./TestLogger";
import { AGENT_RESULTS, type AgentResult } from "@/lib/testing/agentResults";

const METHOD_KEY: Record<AgentResult["method"], string> = {
  api: "p8tst.methodApi",
  "live-read": "p8tst.methodLive",
  code: "p8tst.methodCode",
  browser: "p8tst.methodBrowser",
};
const VERDICT_KEY: Record<Verdict, string> = { pass: "p8tst.vPass", fail: "p8tst.vFail", blocked: "p8tst.vBlocked" };

/** What Claude's test agents found for a step — shown beside your own verdict,
 *  never instead of it. */
function AgentLine({ a, onAdopt, adopted }: { a: AgentResult; onAdopt?: () => void; adopted: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(a.verdict === "fail");
  return (
    <div className="mt-3 rounded-[12px] border px-3 py-2" style={{ borderColor: a.verdict === "fail" ? "#f3c1cc" : a.verdict === "blocked" ? "#f3dfb4" : "#bfe6cf", background: a.verdict === "fail" ? "#fff6f8" : a.verdict === "blocked" ? "#fffaf0" : "#f3fbf6" }}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full flex-wrap items-center gap-2 text-start">
        <span className="text-[12px] font-extrabold text-[var(--ink)]">{t("p8tst.checkedByClaude")}</span>
        <Chip bg={VERDICT[a.verdict].bg} fg={VERDICT[a.verdict].fg}>{t(VERDICT_KEY[a.verdict])}</Chip>
        <span className="text-[11px] text-[var(--ink-3)]">{METHOD_KEY[a.method] ? t(METHOD_KEY[a.method]) : a.method}</span>
        <span className="ms-auto text-[11px] font-bold text-[var(--ink-3)]">{open ? "▲" : t("p8tst.details")}</span>
      </button>
      {open && (
        <div className="mt-1.5 space-y-1 text-[12.5px] text-[var(--ink-2)]">
          <div><b>{t("p8tst.actualHappened")}</b> {a.actual}</div>
          {a.notes && <div><b>{t("p8tst.notesLbl")}</b> {a.notes}</div>}
          {a.evidence && <div className="break-all text-[11.5px] text-[var(--ink-3)]"><b>{t("p8tst.evidenceLbl")}</b> {a.evidence}</div>}
          <div className="text-[11px] text-[var(--ink-3)]">{new Date(a.at).toLocaleString(dl())}{a.agent ? t("p8tst.agentSuffix", { name: a.agent }) : ""}</div>
          {onAdopt && !adopted && <button type="button" onClick={onAdopt} className="mt-1 rounded-full bg-[#16306e] px-3 py-1 text-[11.5px] font-extrabold text-white">{t("p8tst.copyIntoRun")}</button>}
        </div>
      )}
    </div>
  );
}

// The 25-day acceptance run, in the owner's own portal. The plan is fixed
// (lib/testing/plan.ts); this is the place you work through it and the place
// the resulting handover lists are produced.

const todayISO = () => new Date().toISOString().slice(0, 10);

const TICK_KEY = "aos.testing.ticks.v1";
const loadTicks = (): Record<string, boolean> => {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(TICK_KEY) ?? "{}") as Record<string, boolean>; } catch { return {}; }
};
const saveTick = (id: string, on: boolean) => {
  const t = loadTicks(); if (on) t[id] = true; else delete t[id];
  localStorage.setItem(TICK_KEY, JSON.stringify(t));
  window.dispatchEvent(new Event("aos:testing"));
};

const WHO: Record<Who, { label: string; bg: string; fg: string }> = {
  amir: { label: "Amir", bg: "rgba(47,107,216,.12)", fg: "#2f6bd8" },
  claude: { label: "p8tst.whoFrontend", bg: "rgba(107,77,230,.12)", fg: "#6b4de6" },
  kaz: { label: "p8tst.whoYou", bg: "#fdf1dc", fg: "#a5760a" },
  decision: { label: "p8tst.whoDecision", bg: "rgba(200,30,94,.10)", fg: "#b3123c" },
};
const SEV_KEY: Record<string, string> = { critical: "p8tst.sevCritical", high: "p8tst.sevHigh", medium: "p8tst.sevMedium" };
const SEV: Record<string, { bg: string; fg: string }> = {
  critical: { bg: "#fdeaee", fg: "#b3123c" },
  high: { bg: "#fdf1dc", fg: "#a5760a" },
  medium: { bg: "var(--panel)", fg: "var(--ink-2)" },
};

const VERDICT: Record<Verdict, { label: string; bg: string; fg: string }> = {
  pass: { label: "Pass", bg: "#e4f7ed", fg: "#0b7a52" },
  fail: { label: "Fail", bg: "#fdeaee", fg: "#b3123c" },
  blocked: { label: "Blocked", bg: "#fdf1dc", fg: "#a5760a" },
};

function Chip({ children, bg, fg }: { children: React.ReactNode; bg: string; fg: string }) {
  return <span className="rounded-full px-2.5 py-1 text-[11px] font-extrabold" style={{ background: bg, color: fg }}>{children}</span>;
}

/** One step: the instruction, then the verdict controls, then the detail form. */
function StepRow({ day, step, result, onSave, onClear }: {
  day: Day; step: Step; result?: Run[string];
  onSave: (v: Verdict, owner: Owner, actual: string, notes: string) => void;
  onClear: () => void;
}) {
  const t = useT();
  const agent = AGENT_RESULTS[step.id];
  const [open, setOpen] = useState(false);
  const [actual, setActual] = useState(result?.actual ?? "");
  const [notes, setNotes] = useState(result?.notes ?? "");
  const [pending, setPending] = useState<Verdict | null>(null);

  // Derived, not asked: a step flagged as backend-only can only fail in the
  // backend; everything else goes to triage rather than making you guess.
  const owner: Owner = step.needsBackend ? "amir" : "triage";

  const commit = (v: Verdict) => {
    if (v === "pass") { onSave("pass", owner, "", ""); setOpen(false); return; }
    setPending(v); setOpen(true);          // a fail needs detail before it's useful
  };

  return (
    <li className="rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-start gap-3">
        <code className="mt-0.5 shrink-0 rounded-md bg-[var(--panel)] px-2 py-1 text-[11px] font-bold text-[var(--ink-2)]">{step.id}</code>
        <div className="min-w-[240px] flex-1">
          <div className="text-[13.5px] font-extrabold text-[var(--ink)]">{step.action}</div>
          <div className="mt-1 text-[12.5px] text-[var(--ink-2)]"><b>{t("p8tst.whereLbl")}</b> {step.where}</div>
          <div className="mt-0.5 text-[12.5px] text-[var(--ink-2)]"><b>{t("p8tst.expectLbl")}</b> {step.expect}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {step.regression && <Chip bg="rgba(200,30,94,.12)" fg="#b3123c">{t("p8tst.knownBugVerify")}</Chip>}
            {step.needsBackend && <Chip bg="rgba(47,107,216,.12)" fg="#2f6bd8">{t("p8tst.needsAmir")}</Chip>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {result
            ? (
              <>
                <Chip bg={VERDICT[result.verdict].bg} fg={VERDICT[result.verdict].fg}>{t(VERDICT_KEY[result.verdict])}</Chip>
                <button type="button" onClick={onClear} className="rounded-full border border-[var(--line)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">{t("p8tst.redo")}</button>
              </>
            )
            : (["pass", "fail", "blocked"] as Verdict[]).map((v) => (
              <button key={v} type="button" onClick={() => commit(v)}
                className="rounded-full px-3 py-1.5 text-[12px] font-extrabold"
                style={{ background: VERDICT[v].bg, color: VERDICT[v].fg }}>
                {t(VERDICT_KEY[v])}
              </button>
            ))}
        </div>
      </div>

      {agent && <AgentLine a={agent} adopted={!!result} onAdopt={() => onSave(agent.verdict, owner, agent.actual, `[Claude · ${agent.method}] ${agent.notes ?? ""}`.trim())} />}

      {open && pending && (
        <div className="mt-3 rounded-[12px] border border-[var(--line)] bg-[var(--panel)] p-3">
          <label className="block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("p8tst.whatHappenedQ")}</label>
          <textarea value={actual} onChange={(e) => setActual(e.target.value)} rows={2}
            placeholder={t("p8tst.beSpecific")}
            className="mt-1 w-full rounded-[10px] border border-[var(--line)] bg-white p-2 text-[13px]" />
          <label className="mt-2 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("p8tst.notesOptional")}</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)}
            className="mt-1 w-full rounded-[10px] border border-[var(--line)] bg-white p-2 text-[13px]" />
          <div className="mt-2 rounded-[10px] bg-white px-3 py-2 text-[12px] text-[var(--ink-2)]">
            {owner === "amir" ? t("p8tst.routeAmir") : t("p8tst.routeTriage")}
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => { onSave(pending, owner, actual, notes); setOpen(false); setPending(null); }}
              className="rounded-full bg-[#b3123c] px-4 py-2 text-[12.5px] font-extrabold text-white">{pending === "fail" ? t("p8tst.logFail") : t("p8tst.logBlocked")}</button>
            <button type="button" onClick={() => { setOpen(false); setPending(null); }}
              className="rounded-full border border-[var(--line)] px-4 py-2 text-[12.5px] font-bold text-[var(--ink-2)]">{t("p8tst.cancel")}</button>
          </div>
        </div>
      )}
    </li>
  );
}

function HandoverPanel({ run, owner, title, lede }: { run: Run; owner: Owner; title: string; lede: string }) {
  const t = useT();
  const items = openFor(run, owner);
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(buildHandover(run, owner)).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); });
  };
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[18px] font-extrabold text-[var(--ink)]">{title}</h3>
          <p className="mt-1 text-[13px] text-[var(--ink-2)]">{lede}</p>
        </div>
        <button type="button" onClick={copy} disabled={!items.length}
          className="rounded-full bg-[#2f6bd8] px-4 py-2 text-[13px] font-extrabold text-white disabled:opacity-40">
          {copied ? t("p8tst.copied") : items.length === 1 ? t("p8tst.copyOne") : t("p8tst.copyMany", { n: items.length })}
        </button>
      </div>
      {!items.length
        ? <p className="mt-5 rounded-[14px] border border-dashed border-[var(--line)] p-6 text-center text-[13.5px] text-[var(--ink-3)]">{t("p8tst.nothingOpen")}</p>
        : (
          <ul className="mt-4 flex flex-col gap-2.5">
            {items.map((r) => {
              const s = stepById(r.stepId);
              return (
                <li key={r.stepId} className="rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="rounded-md bg-[var(--panel)] px-2 py-1 text-[11px] font-bold text-[var(--ink-2)]">{r.stepId}</code>
                    <Chip bg={VERDICT[r.verdict].bg} fg={VERDICT[r.verdict].fg}>{t(VERDICT_KEY[r.verdict])}</Chip>
                    {s && <span className="text-[12px] text-[var(--ink-3)]">{t("p8tst.dayNTitle", { n: s.day, title: s.dayTitle })}</span>}
                    <button type="button" onClick={() => saveResult({ ...r, resolved: true })}
                      className="ms-auto rounded-full border border-[var(--line)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">{t("p8tst.markDone")}</button>
                  </div>
                  {s && <div className="mt-2 text-[13.5px] font-extrabold text-[var(--ink)]">{s.step.action}</div>}
                  {s && <div className="mt-1 text-[12.5px] text-[var(--ink-2)]"><b>{t("p8tst.expectedLbl")}</b> {s.step.expect}</div>}
                  <div className="mt-1 text-[12.5px] text-[var(--ink-2)]"><b>{t("p8tst.gotLbl")}</b> {r.actual || <i>{t("p8tst.notRecorded")}</i>}</div>
                  {r.notes && <div className="mt-1 text-[12.5px] text-[var(--ink-3)]">{r.notes}</div>}
                </li>
              );
            })}
          </ul>
        )}
    </div>
  );
}

export function TestingApp() {
  const t = useT();
  // Plan 1 = the 28-day acceptance run (done); Plan 2 = the 244 checks it never covered.
  const [planNo, setPlanNo] = useState<1 | 2>(2);
  const plan = planNo === 2 ? PLAN2 : PLAN;
  const prereqs = planNo === 2 ? PREREQS2 : PREREQS;
  const [run, setRun] = useState<Run>({});
  const [tab, setTab] = useState<"start" | "plan" | "backlog" | "amir" | "frontend" | "export">("start");
  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  const today = todayISO();
  // Land on today's day if the run is under way, else day 1.
  const [dayNo, setDayNo] = useState(() => PLAN.find((d) => d.date === todayISO())?.day ?? 1);
  useEffect(() => { setDayNo(1); }, [planNo]);
  const [logger, setLogger] = useState(false);
  useEffect(() => { setLogger(testLoggerOn()); }, []);

  useEffect(() => {
    const sync = () => { setRun(loadRun()); setTicks(loadTicks()); };
    sync();
    window.addEventListener("aos:testing", sync);
    return () => window.removeEventListener("aos:testing", sync);
  }, []);

  const p = useMemo(() => progressOf(run), [run]);
  const day = plan.find((d) => d.day === dayNo) ?? plan[0];
  const pct = Math.round((p.done / p.total) * 100);

  const download = () => {
    const blob = new Blob([buildFullReport(run)], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `test-run-${today}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 py-6">
      <header className="rounded-[20px] p-6 text-white" style={{ background: "linear-gradient(120deg,#16306e,#274ba3 58%,#3f78d8)" }}>
        <div className="text-[11px] font-extrabold uppercase tracking-[.12em] text-[#f5b81f]">{t("p8tst.acceptanceTesting")}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {([1, 2] as const).map((n) => (
            <button key={n} type="button" onClick={() => setPlanNo(n)} className="rounded-full px-3.5 py-1.5 text-[12.5px] font-extrabold"
              style={planNo === n ? { background: "#f5b81f", color: "#12224e" } : { background: "rgba(255,255,255,.16)", color: "#fff" }}>
              {n === 1 ? t("p8tst.plan1Btn", { n: PLAN.reduce((a, d) => a + d.steps.length, 0) }) : t("p8tst.plan2Btn", { n: PLAN2.reduce((a, d) => a + d.steps.length, 0) })}
            </button>
          ))}
        </div>
        <h1 className="mt-3 text-[30px] font-extrabold leading-tight">{t("p8tst.headline", { days: plan.length, n: plan.reduce((a, d) => a + d.steps.length, 0) })}</h1>
        <p className="mt-2 max-w-[70ch] text-[14.5px] text-white/80">
          {planNo === 1
            ? t("p8tst.intro1", { start: PLAN_START, due: AMIR_DUE })
            : t("p8tst.intro2", { start: PLAN2_START })}
          {" "}{t("p8tst.logEvery")}
        </p>
        <button type="button"
          onClick={() => { const next = !logger; setTestLoggerOn(next); setLogger(next); }}
          className="mt-4 rounded-full px-4 py-2 text-[13px] font-extrabold"
          style={logger ? { background: "#f5b81f", color: "#12224e" } : { background: "rgba(255,255,255,.16)", color: "#fff" }}>
          {logger ? t("p8tst.loggerOn") : t("p8tst.loggerTurnOn")}
        </button>
        <div className="mt-4 flex flex-wrap gap-2.5 text-[12.5px] font-bold">
          <Chip bg="rgba(255,255,255,.16)" fg="#fff">{t("p8tst.loggedPct", { done: p.done, total: p.total, pct })}</Chip>
          <Chip bg="#e4f7ed" fg="#0b7a52">{t("p8tst.nPass", { n: p.pass })}</Chip>
          <Chip bg="#fdeaee" fg="#b3123c">{t("p8tst.nFail", { n: p.fail })}</Chip>
          <Chip bg="#fdf1dc" fg="#a5760a">{t("p8tst.nBlocked", { n: p.blocked })}</Chip>
          <Chip bg="rgba(255,255,255,.16)" fg="#fff">{t("p8tst.openForAmir", { n: p.openForAmir })}</Chip>
          <Chip bg="rgba(255,255,255,.16)" fg="#fff">{t("p8tst.toTriage", { n: p.openForTriage })}</Chip>
        </div>
        {(() => {
          const ag = Object.values(AGENT_RESULTS);
          if (!ag.length) return null;
          const n = (v: string) => ag.filter((a) => a.verdict === v).length;
          const adoptable = Object.entries(AGENT_RESULTS).filter(([id]) => !run[id]);
          return (
            <div className="mt-3 flex flex-wrap items-center gap-2.5 rounded-[14px] bg-white/10 px-3 py-2 text-[12.5px] font-bold ring-1 ring-white/20">
              <span>{t("p8tst.claudeChecked", { n: ag.length, total: p.total })}</span>
              <Chip bg="#e4f7ed" fg="#0b7a52">{t("p8tst.nPass", { n: n("pass") })}</Chip>
              <Chip bg="#fdeaee" fg="#b3123c">{t("p8tst.nFail", { n: n("fail") })}</Chip>
              <Chip bg="#fdf1dc" fg="#a5760a">{t("p8tst.nBlocked", { n: n("blocked") })}</Chip>
              {adoptable.length > 0 && (
                <button type="button" onClick={() => {
                  if (!confirm(t("p8tst.adoptConfirm", { n: adoptable.length }))) return;
                  let r = run;
                  for (const [id, a] of adoptable) {
                    const st = [...PLAN, ...PLAN2].flatMap((d) => d.steps).find((x) => x.id === id);
                    r = saveResult({ stepId: id, verdict: a.verdict, owner: st?.needsBackend ? "amir" : "triage", actual: a.actual, notes: `[Claude · ${a.method}] ${a.notes ?? ""}`.trim(), at: a.at });
                  }
                  setRun(r);
                }} className="ms-auto rounded-full bg-[#f5b81f] px-3 py-1 text-[12px] font-extrabold text-[#12224e]">{t("p8tst.adoptBtn", { n: adoptable.length })}</button>
              )}
            </div>
          );
        })()}
      </header>

      <nav className="mt-5 flex flex-wrap gap-2">
        {([["start", t("p8tst.tabStart")], ["plan", t("p8tst.tabPlan")], ["backlog", t("p8tst.tabBacklog", { n: BACKLOG.filter((b) => !ticks[b.id]).length })], ["amir", t("p8tst.tabAmir", { n: p.openForAmir })], ["frontend", t("p8tst.tabTriage", { n: p.openForTriage })], ["export", t("p8tst.tabExport")]] as const).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            className="rounded-full px-4 py-2 text-[13px] font-extrabold"
            style={tab === k ? { background: "#16306e", color: "#fff" } : { background: "var(--panel)", color: "var(--ink-2)" }}>
            {label}
          </button>
        ))}
      </nav>

      {tab === "start" && (
        <section className="mt-6">
          <h3 className="text-[18px] font-extrabold text-[var(--ink)]">{t("p8tst.doBefore")}</h3>
          <p className="mt-1 max-w-[75ch] text-[13.5px] text-[var(--ink-2)]">{t("p8tst.doBeforeLede")}</p>
          <ul className="mt-4 flex flex-col gap-2.5">
            {prereqs.map((q) => (
              <li key={q.id} className="rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-4">
                <div className="flex items-start gap-3">
                  <input type="checkbox" checked={!!ticks[q.id]} onChange={(e) => { saveTick(q.id, e.target.checked); setTicks(loadTicks()); }}
                    className="mt-1 h-5 w-5 shrink-0 accent-[#0b7a52]" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-extrabold text-[var(--ink)]">{q.title}</span>
                      <Chip bg={q.who === "Amir" ? "rgba(47,107,216,.12)" : "#fdf1dc"} fg={q.who === "Amir" ? "#2f6bd8" : "#a5760a"}>{q.who}</Chip>
                    </div>
                    <p className="mt-1.5 whitespace-pre-line text-[13px] text-[var(--ink-2)]">{q.why}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "backlog" && (
        <section className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-[18px] font-extrabold text-[var(--ink)]">{t("p8tst.knownTitle")}</h3>
              <p className="mt-1 max-w-[75ch] text-[13.5px] text-[var(--ink-2)]">{t("p8tst.knownLede")}</p>
            </div>
            <button type="button"
              onClick={() => navigator.clipboard.writeText(
                BACKLOG.filter((b) => !ticks[b.id] && b.who === "amir").sort(bySeverity)
                  .map((b) => `## ${b.title}\n${b.detail}${b.file ? `\n\nWhere: ${b.file}` : ""}${b.step ? `\nTest step: ${b.step}` : ""}`)
                  .join("\n\n"))}
              className="rounded-full bg-[#2f6bd8] px-4 py-2 text-[13px] font-extrabold text-white">
              {t("p8tst.copyAmirList")}
            </button>
          </div>
          <ul className="mt-4 flex flex-col gap-2.5">
            {[...BACKLOG].sort(bySeverity).map((b) => (
              <li key={b.id} className="rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-4"
                style={ticks[b.id] ? { opacity: 0.45 } : undefined}>
                <div className="flex items-start gap-3">
                  <input type="checkbox" checked={!!ticks[b.id]} onChange={(e) => { saveTick(b.id, e.target.checked); setTicks(loadTicks()); }}
                    className="mt-1 h-5 w-5 shrink-0 accent-[#0b7a52]" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Chip bg={SEV[b.severity].bg} fg={SEV[b.severity].fg}>{SEV_KEY[b.severity] ? t(SEV_KEY[b.severity]) : b.severity}</Chip>
                      <Chip bg={WHO[b.who].bg} fg={WHO[b.who].fg}>{b.who === "amir" ? WHO[b.who].label : t(WHO[b.who].label)}</Chip>
                      {b.step && <code className="rounded-md bg-[var(--panel)] px-2 py-0.5 text-[11px] font-bold text-[var(--ink-2)]">{b.step}</code>}
                    </div>
                    <div className="mt-1.5 text-[14px] font-extrabold text-[var(--ink)]">{b.title}</div>
                    <p className="mt-1 text-[13px] text-[var(--ink-2)]">{b.detail}</p>
                    {b.file && <p className="mt-1 text-[11.5px] text-[var(--ink-3)]">{b.file}</p>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "plan" && (
        <>
          <div className="mt-5 flex flex-wrap gap-1.5">
            {plan.map((d) => {
              const logged = d.steps.filter((s) => run[s.id]).length;
              const failed = d.steps.some((s) => run[s.id] && run[s.id].verdict !== "pass" && !run[s.id].resolved);
              const done = logged === d.steps.length;
              const isToday = d.date === today;
              return (
                <button key={d.day} type="button" onClick={() => setDayNo(d.day)} title={`${d.label} — ${d.title}`}
                  className="h-9 w-9 rounded-[10px] text-[12px] font-extrabold"
                  style={{
                    background: d.day === dayNo ? "#16306e" : failed ? "#fdeaee" : done ? "#e4f7ed" : "var(--panel)",
                    color: d.day === dayNo ? "#fff" : failed ? "#b3123c" : done ? "#0b7a52" : "var(--ink-2)",
                    outline: isToday && d.day !== dayNo ? "2px solid #f5b81f" : undefined,
                  }}>
                  {d.day}
                </button>
              );
            })}
          </div>

          <section className="mt-5">
            <div className="flex flex-wrap items-baseline gap-3">
              <h2 className="text-[22px] font-extrabold text-[var(--ink)]">{t("p8tst.dayNTitle", { n: day.day, title: day.title })}</h2>
              <span className="text-[13px] font-bold text-[var(--ink-3)]">{day.label}</span>
              <Chip bg="var(--panel)" fg="var(--ink-2)">{t("p8tst.portalSuffix", { portal: day.portal })}</Chip>
              {day.date === today && <Chip bg="#fdf1dc" fg="#a5760a">{t("p8tst.today")}</Chip>}
            </div>
            <p className="mt-2 max-w-[80ch] text-[14px] text-[var(--ink-2)]">{day.intent}</p>
            <ul className="mt-4 flex flex-col gap-2.5">
              {day.steps.map((step) => (
                <StepRow key={step.id} day={day} step={step} result={run[step.id]}
                  onSave={(v, owner, actual, notes) => setRun(saveResult({ stepId: step.id, verdict: v, owner, actual, notes, at: new Date().toISOString() }))}
                  onClear={() => setRun(clearStep(step.id))} />
              ))}
            </ul>
          </section>
        </>
      )}

      {tab === "amir" && (
        <section className="mt-6">
          <HandoverPanel run={run} owner="amir"
            title={t("p8tst.backendFindings")}
            lede={t("p8tst.backendLede")} />
        </section>
      )}

      {tab === "frontend" && (
        <section className="mt-6">
          <HandoverPanel run={run} owner="triage"
            title={t("p8tst.triageTitle")}
            lede={t("p8tst.triageLede")} />
        </section>
      )}

      {tab === "export" && (
        <section className="mt-6 rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-6">
          <h3 className="text-[18px] font-extrabold text-[var(--ink)]">{t("p8tst.exportTitle")}</h3>
          <p className="mt-2 max-w-[70ch] text-[13.5px] text-[var(--ink-2)]">{t("p8tst.exportLede")}</p>
          <button type="button" onClick={download}
            className="mt-4 rounded-full bg-[#2f6bd8] px-5 py-2.5 text-[13.5px] font-extrabold text-white">{t("p8tst.downloadReport")}</button>
        </section>
      )}
    </div>
  );
}
