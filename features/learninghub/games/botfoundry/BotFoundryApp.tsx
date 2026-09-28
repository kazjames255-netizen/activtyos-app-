"use client";
// Bot Foundry — computing/logic. A child assembles a program (sequence / selection / iteration) that a bot then
// runs on a grid. The child can RUN their program as many times as they like before submitting a puzzle — thinking
// is never timed, only the bot's own on-grid animation is. See core.ts for the pure engine + curriculum content.
import { useMemo, useState } from "react";
import { Button, Card } from "@/components/ui";
import { runProgram, type Program, type Step } from "./core";
import type { Backend, Started, Finished, PlanPuzzle } from "./store";

type Phase = "intro" | "play" | "saving" | "done" | "error";
const DIR_ARROW = ["↑", "→", "↓", "←"];

function Grid({ grid, botPos, botDir, path }: { grid: string[]; botPos: { x: number; y: number }; botDir: number; path: { x: number; y: number }[] }) {
  const visited = new Set(path.map((p) => `${p.x},${p.y}`));
  return (
    <div className="mb-3 inline-grid gap-0.5 rounded-xl bg-[var(--line)] p-1.5" style={{ gridTemplateColumns: `repeat(${grid[0]!.length}, 34px)` }}>
      {grid.flatMap((row, y) => [...row].map((c, x) => {
        const isBot = botPos.x === x && botPos.y === y;
        const bg = c === "#" ? "#2b2f36" : c === "G" ? "var(--brand-soft)" : visited.has(`${x},${y}`) ? "color-mix(in srgb, var(--brand) 18%, var(--surface))" : "var(--surface)";
        return (
          <div key={`${x},${y}`} className="grid h-[34px] w-[34px] place-items-center rounded-md text-[15px] font-extrabold" style={{ background: bg }}>
            {isBot ? <span aria-hidden style={{ display: "inline-block", transform: `rotate(${botDir * 90}deg)` }}>🤖</span> : c === "G" ? "🏁" : ""}
          </div>
        );
      }))}
    </div>
  );
}

function ProgramBuilder({ program, setProgram, hasIfWall }: { program: Program; setProgram: (p: Program) => void; hasIfWall: boolean }) {
  const add = (s: Step) => setProgram([...program, s]);
  const removeAt = (i: number) => setProgram(program.filter((_, j) => j !== i));
  const label = (s: Step): string => s.op === "forward" ? "Forward" : s.op === "left" ? "Turn left" : s.op === "right" ? "Turn right" : s.op === "repeat" ? `Repeat ×${s.n}: [${s.body.map(label).join(", ")}]` : `If wall ahead: [${s.then.map(label).join(", ")}]`;
  return (
    <div>
      <div className="mb-2 min-h-[44px] rounded-xl border-2 border-dashed border-[var(--line)] bg-[var(--panel)] p-2">
        {program.length === 0 && <span className="text-[12px] font-semibold text-[var(--ink-3)]">Build your program below…</span>}
        <ol className="m-0 list-decimal space-y-1 ps-4">
          {program.map((s, i) => (
            <li key={i} className="flex items-center justify-between gap-2 text-[12.5px] font-bold text-[var(--ink)]">
              <span>{label(s)}</span>
              <button type="button" onClick={() => removeAt(i)} aria-label="Remove step" className="text-[11px] font-extrabold text-[var(--ink-3)] hover:text-[#b23a3a]">✕</button>
            </li>
          ))}
        </ol>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button sm onClick={() => add({ op: "forward" })} data-testid="bot-add-forward">➡️ Forward</Button>
        <Button sm onClick={() => add({ op: "left" })}>⟲ Turn left</Button>
        <Button sm onClick={() => add({ op: "right" })}>⟳ Turn right</Button>
        <Button sm onClick={() => add({ op: "repeat", n: 3, body: [{ op: "forward" }] })} data-testid="bot-add-repeat">🔁 Repeat ×3 [Forward]</Button>
        {hasIfWall && <Button sm onClick={() => add({ op: "if_wall", then: [{ op: "left" }] })} data-testid="bot-add-ifwall">❓ If wall ahead → Turn left</Button>}
        <Button sm variant="ghost" onClick={() => setProgram([])}>Clear</Button>
      </div>
    </div>
  );
}

function PuzzleStage({ puzzle, onSolved }: { puzzle: PlanPuzzle; onSolved: (program: Program) => void }) {
  const [program, setProgram] = useState<Program>(puzzle.starterBug ?? []);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const trace = useMemo(() => runProgram({ id: puzzle.id, title: puzzle.title, concept: puzzle.concept, years: [], grid: puzzle.grid, parMoves: puzzle.parMoves }, program), [puzzle, program, running ? step : -1]);
  const startPos = useMemo(() => { let x = 0, y = 0; puzzle.grid.forEach((row, ry) => [...row].forEach((c, rx) => { if (c === "S") { x = rx; y = ry; } })); return { x, y }; }, [puzzle]);
  const shown = running ? Math.min(step, trace.path.length - 1) : trace.path.length - 1;
  const pos = trace.path[shown] ?? startPos;

  const run = () => {
    setRunning(true); setStep(0);
    let i = 0;
    const id = setInterval(() => { i++; setStep(i); if (i >= trace.path.length - 1) { clearInterval(id); setRunning(false); } }, 260);
  };

  return (
    <Card className="p-4" data-testid="bot-puzzle">
      <p className="m-0 mb-0.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{puzzle.concept}</p>
      <h4 className="m-0 mb-2 text-[15px] font-extrabold text-[var(--ink)]">{puzzle.title}</h4>
      <Grid grid={puzzle.grid} botPos={pos} botDir={1} path={trace.path.slice(0, shown + 1)} />
      <ProgramBuilder program={program} setProgram={setProgram} hasIfWall={puzzle.concept === "selection" || puzzle.concept === "debug"} />
      <p className="mt-2 text-[12px] font-semibold text-[var(--ink-2)]" role="status" aria-live="polite">
        {running ? "Running…" : trace.reached ? `Reached the goal in ${trace.steps} moves! (target: ${puzzle.parMoves})` : trace.crashed ? "Crashed into a wall — try again." : "Not there yet — press Run to test your program."}
      </p>
      <div className="mt-2 flex gap-2">
        <Button variant="ghost" onClick={run} disabled={running || program.length === 0} data-testid="bot-run">▶ Run</Button>
        <Button variant="solid" onClick={() => onSolved(program)} disabled={running} data-testid="bot-submit">{trace.reached ? "Submit ✓" : "Submit anyway"}</Button>
      </div>
    </Card>
  );
}

export function BotFoundryApp({ backend, onExit }: { backend: Backend; onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [session, setSession] = useState<Started | null>(null);
  const [idx, setIdx] = useState(0);
  const [subs, setSubs] = useState<{ puzzleId: string; program: Program }[]>([]);
  const [result, setResult] = useState<Finished | null>(null);
  const [err, setErr] = useState("");

  const begin = async () => {
    try { const s = await backend.start(); setSession(s); setIdx(0); setSubs([]); setPhase("play"); }
    catch (e) { setErr((e as Error).message); }
  };
  const onSolved = (program: Program) => {
    const puzzle = session!.plan[idx]!;
    const next = [...subs, { puzzleId: puzzle.id, program }];
    if (idx + 1 >= session!.plan.length) {
      setPhase("saving");
      backend.finish(session!.sessionId, next).then((r) => { setResult(r); setPhase("done"); }).catch((e: Error) => { setErr(e.message); setPhase("intro"); });
      return;
    }
    setSubs(next); setIdx((i) => i + 1);
  };

  if (phase === "intro") {
    return (
      <Card className="p-4 text-center" data-testid="bot-intro">
        <h3 className="m-0 mb-1 text-[16px] font-extrabold text-[var(--ink)]">Bot Foundry</h3>
        <p className="m-0 mb-3 text-[13px] font-semibold text-[var(--ink-2)]">Build a program of instructions to get your bot to the flag — sequence, loops and if-checks.</p>
        {err && <p role="alert" className="mb-2 text-[12.5px] font-bold text-[#b23a3a]">{err}</p>}
        <div className="flex justify-center gap-2"><Button variant="solid" data-testid="bot-start" onClick={begin}>Start</Button><Button variant="ghost" onClick={onExit}>Back</Button></div>
      </Card>
    );
  }
  if (phase === "play" && session) return <PuzzleStage key={session.plan[idx]!.id} puzzle={session.plan[idx]!} onSolved={onSolved} />;
  if (phase === "saving") return <Card className="p-4 text-center"><p className="m-0 text-[13px] font-semibold text-[var(--ink-2)]">Marking…</p></Card>;
  if (phase === "done" && result) {
    return (
      <Card className="p-4" data-testid="bot-done">
        <h3 className="m-0 mb-1 text-[16px] font-extrabold text-[var(--ink)]">Foundry complete!</h3>
        <p className="m-0 mb-3 text-[24px] font-extrabold text-[var(--brand-strong)]" data-testid="bot-score">{result.solved} / {result.total} solved · {result.stars}★</p>
        <ul className="m-0 mb-3 list-none space-y-1">
          {result.rows.map((r) => <li key={r.puzzleId} className="text-[12.5px] font-semibold text-[var(--ink-2)]">{r.title}: {r.reached ? `Solved in ${r.steps} moves (${r.stars}★)` : r.crashed ? "Crashed" : "Not solved"}</li>)}
        </ul>
        <div className="flex gap-2"><Button variant="solid" onClick={() => setPhase("intro")}>Play again</Button><Button variant="ghost" onClick={onExit}>Back to games</Button></div>
      </Card>
    );
  }
  return <Card className="p-4"><p role="alert" className="text-[12.5px] font-bold text-[#b23a3a]">{err || "Something went wrong."}</p><Button variant="ghost" onClick={onExit}>Back</Button></Card>;
}
