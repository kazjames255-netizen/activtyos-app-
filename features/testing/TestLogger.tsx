"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PLAN } from "@/lib/testing/plan";
import { loadRun, saveResult, type Run, type Verdict } from "@/lib/testing/store";

/**
 * The floating test logger.
 *
 * Rides along in every portal so a result is logged where the testing actually
 * happens — on the register screen, mid-checkout — instead of remembered and
 * typed up later, which is where detail goes to die.
 *
 * Off by default and remembered per browser; it only appears once you turn it
 * on from HQ → Testing, so a real provider never sees it.
 */

const ON_KEY = "aos.testing.logger.v1";

export function testLoggerOn(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(ON_KEY) === "1";
}
export function setTestLoggerOn(on: boolean) {
  localStorage.setItem(ON_KEY, on ? "1" : "0");
  window.dispatchEvent(new Event("aos:testing-logger"));
}

const todayISO = () => new Date().toISOString().slice(0, 10);

export function TestLogger() {
  const [on, setOn] = useState(false);
  const [run, setRun] = useState<Run>({});
  const [open, setOpen] = useState(false);
  const [failing, setFailing] = useState(false);
  const [actual, setActual] = useState("");

  useEffect(() => {
    const syncOn = () => setOn(testLoggerOn());
    const syncRun = () => setRun(loadRun());
    syncOn(); syncRun();
    window.addEventListener("aos:testing-logger", syncOn);
    window.addEventListener("aos:testing", syncRun);
    return () => { window.removeEventListener("aos:testing-logger", syncOn); window.removeEventListener("aos:testing", syncRun); };
  }, []);

  if (!on) return null;

  // Today's day if the calendar matches, else the first day with unlogged steps
  // — so the logger still works if you run ahead of or behind the schedule.
  const day = PLAN.find((d) => d.date === todayISO())
    ?? PLAN.find((d) => d.steps.some((s) => !run[s.id]))
    ?? PLAN[PLAN.length - 1];
  const next = day.steps.find((s) => !run[s.id]);
  const doneToday = day.steps.filter((s) => run[s.id]).length;

  const log = (v: Verdict) => {
    if (!next) return;
    if (v !== "pass" && !failing) { setFailing(true); setOpen(true); return; }
    // Owner is derived from the step, never asked — see lib/testing/store.ts.
    saveResult({ stepId: next.id, verdict: v, owner: next.needsBackend ? "amir" : "triage", actual, at: new Date().toISOString() });
    setActual(""); setFailing(false);
  };

  return (
    <div className="fixed bottom-4 right-4 z-[900] w-[min(360px,calc(100vw-2rem))] print:hidden">
      {open && (
        <div className="mb-2 rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[0_24px_60px_-24px_rgba(16,35,86,.5)]">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-[.1em] text-[#2f6bd8]">Day {day.day} · {doneToday}/{day.steps.length}</span>
            <Link href="/platform/testing" className="ml-auto text-[12px] font-bold text-[var(--ink-3)] underline">Open plan</Link>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-[16px] leading-none text-[var(--ink-3)]">×</button>
          </div>

          {!next ? (
            <p className="mt-3 text-[13.5px] font-bold text-[#0b7a52]">Day {day.day} complete. </p>
          ) : (
            <>
              <div className="mt-2 text-[13.5px] font-extrabold text-[var(--ink)]">{next.action}</div>
              <div className="mt-1 text-[12px] text-[var(--ink-2)]"><b>Where:</b> {next.where}</div>
              <div className="mt-0.5 text-[12px] text-[var(--ink-2)]"><b>Expect:</b> {next.expect}</div>

              {failing && (
                <>
                  <textarea value={actual} onChange={(e) => setActual(e.target.value)} rows={2} autoFocus
                    placeholder="What actually happened?"
                    className="mt-2 w-full rounded-[10px] border border-[var(--line)] p-2 text-[13px]" />
                  <div className="mt-1.5 text-[11.5px] text-[var(--ink-3)]">
                    Routes to <b>{next.needsBackend ? "Amir" : "triage"}</b> automatically.
                  </div>
                </>
              )}

              <div className="mt-3 flex gap-2">
                {!failing && <button type="button" onClick={() => log("pass")} className="flex-1 rounded-full bg-[#e4f7ed] px-3 py-2 text-[13px] font-extrabold text-[#0b7a52]">✓ Pass</button>}
                <button type="button" onClick={() => log("fail")} className="flex-1 rounded-full bg-[#fdeaee] px-3 py-2 text-[13px] font-extrabold text-[#b3123c]">{failing ? "Log fail" : "✗ Fail"}</button>
                {!failing && <button type="button" onClick={() => { setFailing(true); }} className="rounded-full bg-[#fdf1dc] px-3 py-2 text-[13px] font-extrabold text-[#a5760a]">Blocked</button>}
              </div>
            </>
          )}
        </div>
      )}

      <button type="button" onClick={() => setOpen((o) => !o)}
        className="ml-auto flex items-center gap-2 rounded-full px-4 py-3 text-[13px] font-extrabold text-white shadow-[0_18px_40px_-18px_rgba(16,35,86,.8)]"
        style={{ background: "linear-gradient(135deg,#16306e,#3f78d8)" }}>
        🧪 Day {day.day} · {doneToday}/{day.steps.length}
      </button>
    </div>
  );
}
