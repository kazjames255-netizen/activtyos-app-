"use client";
// Training Ground — a generic, subject-agnostic rapid-drill practice arena (see core.ts for the engine + content
// packs). English-only UI copy for now (see BOT_FOUNDRY_BUILD note in the PR/report — the other Learning Hub games
// route their copy through lib/i18n/messages/areas/hubgames.ts across 11 locales; doing that for three brand-new
// games' full content tonight, alongside sibling agents editing those same huge catalogue files, was left for a
// follow-up rather than risking either a broken merge or fabricated translations).
import { useEffect, useRef, useState } from "react";
import { Button, Card } from "@/components/ui";
import type { Backend, Started, Finished } from "./store";
import { DRILL } from "./core";

type Phase = "pick" | "intro" | "play" | "saving" | "done" | "error";

export function TrainingApp({ backend, calm, onExit }: { backend: Backend; calm: boolean; onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>("pick");
  const [session, setSession] = useState<Started | null>(null);
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<Finished | null>(null);
  const [err, setErr] = useState("");
  const answers = useRef<{ v: string; ms: number }[]>([]);
  const t0 = useRef(0);
  const [msLeft, setMsLeft] = useState<number>(DRILL.answerMs);
  const inputRef = useRef<HTMLInputElement>(null);

  const start = async (packId: string) => {
    try { const s = await backend.start(packId); setSession(s); answers.current = []; setIdx(0); setTyped(""); setPhase("intro"); }
    catch (e) { setErr((e as Error).message); }
  };
  const begin = () => { t0.current = performance.now(); setMsLeft(session!.limits.answerMs); setPhase("play"); };

  const submitOne = (v: string) => {
    if (!session) return;
    answers.current.push({ v, ms: Math.round(performance.now() - t0.current) });
    if (idx + 1 >= session.plan.length) {
      setPhase("saving");
      backend.finish(session.sessionId, answers.current).then((r) => { setResult(r); setPhase("done"); }).catch((e: Error) => { setErr(e.message); setPhase("intro"); });
      return;
    }
    setIdx((i) => i + 1); setTyped(""); t0.current = performance.now(); setMsLeft(session.limits.answerMs);
  };

  useEffect(() => { if (phase === "play") inputRef.current?.focus(); }, [phase, idx]);
  useEffect(() => {
    if (phase !== "play" || calm) return; // Calm mode: no visible countdown, no auto-submit on time — thinking is never rushed.
    const id = setInterval(() => {
      const left = (session?.limits.answerMs ?? DRILL.answerMs) - (performance.now() - t0.current);
      if (left <= 0) { clearInterval(id); submitOne(typed); } else setMsLeft(left);
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, idx, calm]);

  if (phase === "pick") {
    const bySubject = new Map<string, typeof backend.packs>();
    for (const p of backend.packs) bySubject.set(p.subject, [...(bySubject.get(p.subject) ?? []), p]);
    return (
      <Card className="p-4" data-testid="training-pick">
        <h3 className="m-0 mb-1 text-[16px] font-extrabold text-[var(--ink)]">Training Ground</h3>
        <p className="m-0 mb-3 text-[13px] font-semibold text-[var(--ink-2)]">A quick practice sprint. Pick what to practise.</p>
        {err && <p role="alert" className="mb-2 text-[12.5px] font-bold text-[#b23a3a]">{err}</p>}
        {[...bySubject.entries()].map(([subject, packs]) => (
          <div key={subject} className="mb-3">
            <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{subject}</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {packs.map((p) => (
                <button key={p.id} type="button" data-testid={`training-pack-${p.id}`} onClick={() => void start(p.id)}
                  className="flex min-h-[48px] items-center justify-between rounded-xl border-2 border-[var(--line)] bg-[var(--surface)] px-3.5 py-2.5 text-start hover:border-[var(--brand)]">
                  <span className="text-[13px] font-bold text-[var(--ink)]">{p.title}</span>
                  <span className="text-[11px] font-semibold text-[var(--ink-3)]">{p.items.length} items</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        <Button variant="ghost" className="mt-1" onClick={onExit}>Back</Button>
      </Card>
    );
  }

  if (phase === "intro" && session) {
    return (
      <Card className="p-4 text-center" data-testid="training-intro">
        <h3 className="m-0 mb-1 text-[16px] font-extrabold text-[var(--ink)]">{session.packTitle}</h3>
        <p className="m-0 mb-3 text-[13px] font-semibold text-[var(--ink-2)]">{session.limits.n} quick questions. Type your answer and press Enter.</p>
        <div className="flex justify-center gap-2">
          <Button variant="solid" data-testid="training-start" onClick={begin}>Start</Button>
          <Button variant="ghost" onClick={onExit}>Back</Button>
        </div>
      </Card>
    );
  }

  if (phase === "play" && session) {
    const item = session.plan[idx]!;
    const pct = calm ? 1 : Math.max(0, Math.min(1, msLeft / session.limits.answerMs));
    return (
      <Card className="p-4" data-testid="training-play">
        <p className="m-0 mb-1 text-[12px] font-bold text-[var(--ink-3)]">Question {idx + 1} of {session.plan.length}</p>
        {!calm && <div aria-hidden className="mb-3 h-1.5 overflow-hidden rounded-full bg-[var(--line)]"><div className="h-full rounded-full bg-[var(--brand)] transition-[width] duration-100 linear" style={{ width: `${pct * 100}%` }} /></div>}
        <p className="m-0 mb-4 text-[20px] font-extrabold text-[var(--ink)]" data-testid="training-prompt">{item.prompt}</p>
        <form onSubmit={(e) => { e.preventDefault(); submitOne(typed); }}>
          <input ref={inputRef} value={typed} onChange={(e) => setTyped(e.target.value)} data-testid="training-input" autoComplete="off" spellCheck={false}
            className="w-full rounded-xl border-2 border-[var(--line)] bg-[var(--panel)] px-3.5 py-2.5 text-[16px] font-bold text-[var(--ink)] outline-none focus-visible:border-[var(--brand)]" />
          <div className="mt-3 flex gap-2"><Button type="submit" variant="solid" data-testid="training-submit">Submit</Button></div>
        </form>
      </Card>
    );
  }

  if (phase === "saving") return <Card className="p-4 text-center"><p className="m-0 text-[13px] font-semibold text-[var(--ink-2)]">Marking…</p></Card>;

  if (phase === "done" && result) {
    return (
      <Card className="p-4" data-testid="training-done">
        <h3 className="m-0 mb-1 text-[16px] font-extrabold text-[var(--ink)]">Nice work!</h3>
        <p className="m-0 mb-3 text-[24px] font-extrabold text-[var(--brand-strong)]" data-testid="training-score">{result.score} / {result.total}</p>
        {result.wrong.length > 0 && (
          <ul className="m-0 mb-3 list-none space-y-1 rounded-xl bg-[var(--panel)] p-3">
            {result.wrong.slice(0, 8).map((w, i) => (
              <li key={i} className="text-[12.5px] font-semibold text-[var(--ink-2)]">{w.prompt} → <b>{w.answer}</b>{w.entered ? <span className="text-[var(--ink-3)]"> (you wrote &ldquo;{w.entered}&rdquo;)</span> : null}</li>
            ))}
          </ul>
        )}
        <div className="flex gap-2"><Button variant="solid" onClick={() => setPhase("pick")}>Play again</Button><Button variant="ghost" onClick={onExit}>Back to games</Button></div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <p role="alert" className="text-[12.5px] font-bold text-[#b23a3a]">{err || "Something went wrong."}</p>
      <Button variant="ghost" onClick={onExit}>Back</Button>
    </Card>
  );
}
