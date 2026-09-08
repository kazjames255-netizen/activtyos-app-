"use client";

import { useEffect, useMemo, useState } from "react";
import { PLAN, PLAN_START, AMIR_DUE, PREREQS, type Day, type Step } from "@/lib/testing/plan";
import { BACKLOG, bySeverity, type Who } from "@/lib/testing/backlog";
import {
  loadRun, saveResult, clearStep, progressOf, openFor, buildHandover, buildFullReport,
  stepById, type Run, type Verdict, type Owner,
} from "@/lib/testing/store";
import { testLoggerOn, setTestLoggerOn } from "./TestLogger";

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
  claude: { label: "Front-end", bg: "rgba(107,77,230,.12)", fg: "#6b4de6" },
  kaz: { label: "You", bg: "#fdf1dc", fg: "#a5760a" },
  decision: { label: "Needs a decision", bg: "rgba(200,30,94,.10)", fg: "#b3123c" },
};
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
          <div className="mt-1 text-[12.5px] text-[var(--ink-2)]"><b>Where:</b> {step.where}</div>
          <div className="mt-0.5 text-[12.5px] text-[var(--ink-2)]"><b>Expect:</b> {step.expect}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {step.regression && <Chip bg="rgba(200,30,94,.12)" fg="#b3123c">Known bug — verify the fix</Chip>}
            {step.needsBackend && <Chip bg="rgba(47,107,216,.12)" fg="#2f6bd8">Needs Amir&rsquo;s backend</Chip>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {result
            ? (
              <>
                <Chip bg={VERDICT[result.verdict].bg} fg={VERDICT[result.verdict].fg}>{VERDICT[result.verdict].label}</Chip>
                <button type="button" onClick={onClear} className="rounded-full border border-[var(--line)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">Redo</button>
              </>
            )
            : (["pass", "fail", "blocked"] as Verdict[]).map((v) => (
              <button key={v} type="button" onClick={() => commit(v)}
                className="rounded-full px-3 py-1.5 text-[12px] font-extrabold"
                style={{ background: VERDICT[v].bg, color: VERDICT[v].fg }}>
                {VERDICT[v].label}
              </button>
            ))}
        </div>
      </div>

      {open && pending && (
        <div className="mt-3 rounded-[12px] border border-[var(--line)] bg-[var(--panel)] p-3">
          <label className="block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">What actually happened?</label>
          <textarea value={actual} onChange={(e) => setActual(e.target.value)} rows={2}
            placeholder="Be specific — this is what gets handed over"
            className="mt-1 w-full rounded-[10px] border border-[var(--line)] bg-white p-2 text-[13px]" />
          <label className="mt-2 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Notes (optional)</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)}
            className="mt-1 w-full rounded-[10px] border border-[var(--line)] bg-white p-2 text-[13px]" />
          <div className="mt-2 rounded-[10px] bg-white px-3 py-2 text-[12px] text-[var(--ink-2)]">
            Routing to <b>{owner === "amir" ? "Amir (backend)" : "triage"}</b> — you don&rsquo;t have to decide.
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => { onSave(pending, owner, actual, notes); setOpen(false); setPending(null); }}
              className="rounded-full bg-[#b3123c] px-4 py-2 text-[12.5px] font-extrabold text-white">Log {VERDICT[pending].label.toLowerCase()}</button>
            <button type="button" onClick={() => { setOpen(false); setPending(null); }}
              className="rounded-full border border-[var(--line)] px-4 py-2 text-[12.5px] font-bold text-[var(--ink-2)]">Cancel</button>
          </div>
        </div>
      )}
    </li>
  );
}

function HandoverPanel({ run, owner, title, lede }: { run: Run; owner: Owner; title: string; lede: string }) {
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
          {copied ? "Copied ✓" : `Copy ${items.length} item${items.length === 1 ? "" : "s"} as markdown`}
        </button>
      </div>
      {!items.length
        ? <p className="mt-5 rounded-[14px] border border-dashed border-[var(--line)] p-6 text-center text-[13.5px] text-[var(--ink-3)]">Nothing open here.</p>
        : (
          <ul className="mt-4 flex flex-col gap-2.5">
            {items.map((r) => {
              const s = stepById(r.stepId);
              return (
                <li key={r.stepId} className="rounded-[14px] border border-[var(--line)] bg-[var(--surface)] p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="rounded-md bg-[var(--panel)] px-2 py-1 text-[11px] font-bold text-[var(--ink-2)]">{r.stepId}</code>
                    <Chip bg={VERDICT[r.verdict].bg} fg={VERDICT[r.verdict].fg}>{VERDICT[r.verdict].label}</Chip>
                    {s && <span className="text-[12px] text-[var(--ink-3)]">Day {s.day} · {s.dayTitle}</span>}
                    <button type="button" onClick={() => saveResult({ ...r, resolved: true })}
                      className="ml-auto rounded-full border border-[var(--line)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">Mark done</button>
                  </div>
                  {s && <div className="mt-2 text-[13.5px] font-extrabold text-[var(--ink)]">{s.step.action}</div>}
                  {s && <div className="mt-1 text-[12.5px] text-[var(--ink-2)]"><b>Expected:</b> {s.step.expect}</div>}
                  <div className="mt-1 text-[12.5px] text-[var(--ink-2)]"><b>Got:</b> {r.actual || <i>not recorded</i>}</div>
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
  const [run, setRun] = useState<Run>({});
  const [tab, setTab] = useState<"start" | "plan" | "backlog" | "amir" | "frontend" | "export">("start");
  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  const today = todayISO();
  // Land on today's day if the run is under way, else day 1.
  const [dayNo, setDayNo] = useState(() => PLAN.find((d) => d.date === todayISO())?.day ?? 1);
  const [logger, setLogger] = useState(false);
  useEffect(() => { setLogger(testLoggerOn()); }, []);

  useEffect(() => {
    const sync = () => { setRun(loadRun()); setTicks(loadTicks()); };
    sync();
    window.addEventListener("aos:testing", sync);
    return () => window.removeEventListener("aos:testing", sync);
  }, []);

  const p = useMemo(() => progressOf(run), [run]);
  const day = PLAN.find((d) => d.day === dayNo)!;
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
        <div className="text-[11px] font-extrabold uppercase tracking-[.12em] text-[#f5b81f]">Acceptance testing</div>
        <h1 className="mt-2 text-[30px] font-extrabold leading-tight">28 days, {p.total} checks.</h1>
        <p className="mt-2 max-w-[70ch] text-[14.5px] text-white/80">
          {PLAN_START} to 2026-10-08. Days 1&ndash;7 need nothing from Amir; his work is due {AMIR_DUE} and Day 8 is the Tax-Free Childcare reconciliation.
          Log every step as you do it &mdash; a fail is only useful if you write down what actually happened.
        </p>
        <button type="button"
          onClick={() => { const next = !logger; setTestLoggerOn(next); setLogger(next); }}
          className="mt-4 rounded-full px-4 py-2 text-[13px] font-extrabold"
          style={logger ? { background: "#f5b81f", color: "#12224e" } : { background: "rgba(255,255,255,.16)", color: "#fff" }}>
          {logger ? "🧪 Floating logger ON — showing in every portal" : "Turn on the floating logger"}
        </button>
        <div className="mt-4 flex flex-wrap gap-2.5 text-[12.5px] font-bold">
          <Chip bg="rgba(255,255,255,.16)" fg="#fff">{p.done}/{p.total} logged &middot; {pct}%</Chip>
          <Chip bg="#e4f7ed" fg="#0b7a52">{p.pass} pass</Chip>
          <Chip bg="#fdeaee" fg="#b3123c">{p.fail} fail</Chip>
          <Chip bg="#fdf1dc" fg="#a5760a">{p.blocked} blocked</Chip>
          <Chip bg="rgba(255,255,255,.16)" fg="#fff">{p.openForAmir} open for Amir</Chip>
          <Chip bg="rgba(255,255,255,.16)" fg="#fff">{p.openForTriage} to triage</Chip>
        </div>
      </header>

      <nav className="mt-5 flex flex-wrap gap-2">
        {([["start", "Before you start"], ["plan", "The 28 days"], ["backlog", `Known issues (${BACKLOG.filter((b) => !ticks[b.id]).length})`], ["amir", `For Amir (${p.openForAmir})`], ["frontend", `To triage (${p.openForTriage})`], ["export", "Export"]] as const).map(([k, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            className="rounded-full px-4 py-2 text-[13px] font-extrabold"
            style={tab === k ? { background: "#16306e", color: "#fff" } : { background: "var(--panel)", color: "var(--ink-2)" }}>
            {label}
          </button>
        ))}
      </nav>

      {tab === "start" && (
        <section className="mt-6">
          <h3 className="text-[18px] font-extrabold text-[var(--ink)]">Do these before Day 1</h3>
          <p className="mt-1 max-w-[75ch] text-[13.5px] text-[var(--ink-2)]">
            Not optional. Without them a large part of the run cannot fail: mail is off by default and a skipped send
            reports success, Stripe has no key set, and there is no deployed environment to test on.
          </p>
          <ul className="mt-4 flex flex-col gap-2.5">
            {PREREQS.map((q) => (
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
              <h3 className="text-[18px] font-extrabold text-[var(--ink)]">Known issues, before you test anything</h3>
              <p className="mt-1 max-w-[75ch] text-[13.5px] text-[var(--ink-2)]">
                Every item here is confirmed — verified adversarially by the portal audit, or found by the five-reviewer
                critique reading the code. Nothing speculative. Tick them off as they land; anything still open on the
                11th is something the run will hit, and the step that catches it is named.
              </p>
            </div>
            <button type="button"
              onClick={() => navigator.clipboard.writeText(
                BACKLOG.filter((b) => !ticks[b.id] && b.who === "amir").sort(bySeverity)
                  .map((b) => `## ${b.title}\n${b.detail}${b.file ? `\n\nWhere: ${b.file}` : ""}${b.step ? `\nTest step: ${b.step}` : ""}`)
                  .join("\n\n"))}
              className="rounded-full bg-[#2f6bd8] px-4 py-2 text-[13px] font-extrabold text-white">
              Copy Amir&rsquo;s list
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
                      <Chip bg={SEV[b.severity].bg} fg={SEV[b.severity].fg}>{b.severity}</Chip>
                      <Chip bg={WHO[b.who].bg} fg={WHO[b.who].fg}>{WHO[b.who].label}</Chip>
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
            {PLAN.map((d) => {
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
              <h2 className="text-[22px] font-extrabold text-[var(--ink)]">Day {day.day} &middot; {day.title}</h2>
              <span className="text-[13px] font-bold text-[var(--ink-3)]">{day.label}</span>
              <Chip bg="var(--panel)" fg="var(--ink-2)">{day.portal} portal</Chip>
              {day.date === today && <Chip bg="#fdf1dc" fg="#a5760a">Today</Chip>}
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
            title="Backend findings for Amir"
            lede="Copy this as markdown and send it. Each item carries the exact step, what you expected and what you got." />
        </section>
      )}

      {tab === "frontend" && (
        <section className="mt-6">
          <HandoverPanel run={run} owner="triage"
            title="To triage"
            lede="Everything that isn't obviously backend. Hand this list over and it gets sorted into front-end fixes and backend work for Amir — you don't have to know which." />
        </section>
      )}

      {tab === "export" && (
        <section className="mt-6 rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-6">
          <h3 className="text-[18px] font-extrabold text-[var(--ink)]">Export the run</h3>
          <p className="mt-2 max-w-[70ch] text-[13.5px] text-[var(--ink-2)]">
            This run lives in <b>this browser only</b> &mdash; there is no server store behind it yet. Export at the end of every day so
            25 days of work can&rsquo;t be lost to a cleared cache or a different laptop.
          </p>
          <button type="button" onClick={download}
            className="mt-4 rounded-full bg-[#2f6bd8] px-5 py-2.5 text-[13.5px] font-extrabold text-white">Download full report (.md)</button>
        </section>
      )}
    </div>
  );
}
