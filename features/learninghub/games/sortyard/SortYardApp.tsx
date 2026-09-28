"use client";
// Sort Yard — statistics/data-handling. Classify real data into categories, read a simple chart, order values.
// See core.ts for the pure engine + curriculum content.
import { useState } from "react";
import { Button, Card } from "@/components/ui";
import type { Backend, Started, Finished, PlanRound, Submission } from "./store";

type Phase = "intro" | "play" | "saving" | "done" | "error";

function SortRoundView({ round, onSubmit }: { round: Extract<PlanRound, { kind: "sort" }>; onSubmit: (s: Submission) => void }) {
  const [assign, setAssign] = useState<Record<string, string>>({});
  const done = round.items.every((it) => assign[it]);
  return (
    <Card className="p-4" data-testid="sort-round-sort">
      <p className="m-0 mb-0.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Sort</p>
      <h4 className="m-0 mb-3 text-[15px] font-extrabold text-[var(--ink)]">{round.title}</h4>
      <div className="space-y-2">
        {round.items.map((it) => (
          <div key={it} className="flex items-center justify-between gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2">
            <span className="text-[13px] font-bold text-[var(--ink)]">{it}</span>
            <select value={assign[it] ?? ""} onChange={(e) => setAssign((a) => ({ ...a, [it]: e.target.value }))} data-testid={`sort-select-${it}`}
              className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 text-[12.5px] font-bold text-[var(--ink)]">
              <option value="" disabled>Choose…</option>
              {round.categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        ))}
      </div>
      <Button variant="solid" className="mt-3" disabled={!done} data-testid="sort-submit" onClick={() => onSubmit({ kind: "sort", roundId: round.id, assignments: assign })}>Submit</Button>
    </Card>
  );
}

function ChartRoundView({ round, onSubmit }: { round: Extract<PlanRound, { kind: "chart" }>; onSubmit: (s: Submission) => void }) {
  const [val, setVal] = useState("");
  const max = Math.max(...round.bars.map((b) => b.value), 1);
  return (
    <Card className="p-4" data-testid="sort-round-chart">
      <p className="m-0 mb-0.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Chart</p>
      <h4 className="m-0 mb-1 text-[15px] font-extrabold text-[var(--ink)]">{round.chartTitle}</h4>
      <div className="mb-3 flex h-[140px] items-end gap-3 border-b-2 border-[var(--line)] pb-1">
        {round.bars.map((b) => (
          <div key={b.label} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[11px] font-extrabold text-[var(--ink)]">{b.value}</span>
            <div className="w-full rounded-t-md bg-[var(--brand)]" style={{ height: `${(b.value / max) * 100}px` }} />
            <span className="text-[10.5px] font-bold text-[var(--ink-3)]">{b.label}</span>
          </div>
        ))}
      </div>
      <p className="m-0 mb-2 text-[13.5px] font-bold text-[var(--ink)]">{round.question}</p>
      <form onSubmit={(e) => { e.preventDefault(); const n = Number(val); if (Number.isFinite(n)) onSubmit({ kind: "chart", roundId: round.id, value: n }); }}>
        <input type="number" value={val} onChange={(e) => setVal(e.target.value)} data-testid="sort-chart-input"
          className="w-32 rounded-xl border-2 border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[16px] font-bold text-[var(--ink)] outline-none focus-visible:border-[var(--brand)]" />
        <Button type="submit" variant="solid" className="ms-2" data-testid="sort-submit">Submit</Button>
      </form>
    </Card>
  );
}

function OrderRoundView({ round, onSubmit }: { round: Extract<PlanRound, { kind: "order" }>; onSubmit: (s: Submission) => void }) {
  const [remaining, setRemaining] = useState<number[]>(round.values);
  const [chosen, setChosen] = useState<number[]>([]);
  const pick = (v: number, i: number) => { setChosen((c) => [...c, v]); setRemaining((r) => r.filter((_, j) => j !== i)); };
  const reset = () => { setChosen([]); setRemaining(round.values); };
  return (
    <Card className="p-4" data-testid="sort-round-order">
      <p className="m-0 mb-0.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Order</p>
      <h4 className="m-0 mb-3 text-[15px] font-extrabold text-[var(--ink)]">{round.title}</h4>
      <div className="mb-2 flex min-h-[44px] flex-wrap gap-2 rounded-xl border-2 border-dashed border-[var(--line)] bg-[var(--panel)] p-2">
        {chosen.map((v, i) => <span key={i} className="rounded-lg bg-[var(--brand-soft)] px-2.5 py-1 text-[13px] font-extrabold text-[var(--brand-strong)]">{v}</span>)}
      </div>
      <div className="flex flex-wrap gap-2">
        {remaining.map((v, i) => <button key={i} type="button" onClick={() => pick(v, i)} data-testid={`sort-order-chip-${v}`} className="rounded-lg border-2 border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[13px] font-extrabold text-[var(--ink)] hover:border-[var(--brand)]">{v}</button>)}
      </div>
      <div className="mt-3 flex gap-2">
        <Button variant="ghost" onClick={reset} disabled={chosen.length === 0}>Reset</Button>
        <Button variant="solid" disabled={remaining.length > 0} data-testid="sort-submit" onClick={() => onSubmit({ kind: "order", roundId: round.id, order: chosen })}>Submit</Button>
      </div>
    </Card>
  );
}

export function SortYardApp({ backend, onExit }: { backend: Backend; onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [session, setSession] = useState<Started | null>(null);
  const [idx, setIdx] = useState(0);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [result, setResult] = useState<Finished | null>(null);
  const [err, setErr] = useState("");

  const begin = async () => {
    try { const s = await backend.start(); setSession(s); setIdx(0); setSubs([]); setPhase("play"); }
    catch (e) { setErr((e as Error).message); }
  };
  const onSubmit = (s: Submission) => {
    const next = [...subs, s];
    if (idx + 1 >= session!.plan.length) {
      setPhase("saving");
      backend.finish(session!.sessionId, next).then((r) => { setResult(r); setPhase("done"); }).catch((e: Error) => { setErr(e.message); setPhase("intro"); });
      return;
    }
    setSubs(next); setIdx((i) => i + 1);
  };

  if (phase === "intro") {
    return (
      <Card className="p-4 text-center" data-testid="sort-intro">
        <h3 className="m-0 mb-1 text-[16px] font-extrabold text-[var(--ink)]">Sort Yard</h3>
        <p className="m-0 mb-3 text-[13px] font-semibold text-[var(--ink-2)]">Classify data, read charts, and put values in order.</p>
        {err && <p role="alert" className="mb-2 text-[12.5px] font-bold text-[#b23a3a]">{err}</p>}
        <div className="flex justify-center gap-2"><Button variant="solid" data-testid="sort-start" onClick={begin}>Start</Button><Button variant="ghost" onClick={onExit}>Back</Button></div>
      </Card>
    );
  }
  if (phase === "play" && session) {
    const round = session.plan[idx]!;
    return (
      <div>
        <p className="m-0 mb-2 text-[12px] font-bold text-[var(--ink-3)]">Round {idx + 1} of {session.plan.length}</p>
        {round.kind === "sort" ? <SortRoundView key={round.id} round={round} onSubmit={onSubmit} />
          : round.kind === "chart" ? <ChartRoundView key={round.id} round={round} onSubmit={onSubmit} />
          : <OrderRoundView key={round.id} round={round} onSubmit={onSubmit} />}
      </div>
    );
  }
  if (phase === "saving") return <Card className="p-4 text-center"><p className="m-0 text-[13px] font-semibold text-[var(--ink-2)]">Marking…</p></Card>;
  if (phase === "done" && result) {
    return (
      <Card className="p-4" data-testid="sort-done">
        <h3 className="m-0 mb-1 text-[16px] font-extrabold text-[var(--ink)]">Yard cleared!</h3>
        <p className="m-0 mb-3 text-[24px] font-extrabold text-[var(--brand-strong)]" data-testid="sort-score">{result.correct} / {result.total}</p>
        <ul className="m-0 mb-3 list-none space-y-1">
          {result.rows.map((r) => <li key={r.roundId} className="text-[12.5px] font-semibold text-[var(--ink-2)]">{r.title}: {r.correct ? "Correct" : r.detail}</li>)}
        </ul>
        <div className="flex gap-2"><Button variant="solid" onClick={() => setPhase("intro")}>Play again</Button><Button variant="ghost" onClick={onExit}>Back to games</Button></div>
      </Card>
    );
  }
  return <Card className="p-4"><p role="alert" className="text-[12.5px] font-bold text-[#b23a3a]">{err || "Something went wrong."}</p><Button variant="ghost" onClick={onExit}>Back</Button></Card>;
}
