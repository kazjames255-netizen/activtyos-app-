"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { post } from "@/lib/api";
import { errMsg } from "../types";
import { DISPLAY, FOCUS, HERO_BG, Pill, ProgressBar, TONES, withQs, type Tone } from "../teachKit";
import { Ico } from "../teachIcons";
import { ChildChip } from "../family/FamilyContext";
import { RATINGS, intervalText, type QueueCard, type Rating, type ReviewResult } from "./fcTypes";

// The review session: a big flip card, 1-4 to rate, space to flip. The queue is
// a snapshot the server handed us (due first, then new); rating a card advances
// at once (optimistic) while the review saves in the background. No scheduling
// maths here — the server's SM-2 answer is only displayed.

interface Result { card: QueueCard; quality: number; label: string; tone: Tone; interval: number | null; state: "saving" | "saved" | "failed" }

function FlipCard({ card, flipped, onFlip, position }: { card: QueueCard; flipped: boolean; onFlip: () => void; position: string }) {
  const face = "absolute inset-0 flex flex-col rounded-[28px] border p-6 sm:p-9";
  const hide = { backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" } as const;
  return (
    <div className="[perspective:1400px]" data-testid="hub-flashcard" data-flipped={flipped}>
      <button type="button" onClick={onFlip} aria-label={flipped ? `Answer: ${card.back}. Press to see the question.` : `Question: ${card.front}. Press to reveal the answer.`}
        className={`relative block h-[300px] w-full rounded-[28px] text-left transition-transform duration-500 ease-out motion-reduce:transition-none sm:h-[360px] ${FOCUS}`}
        style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "none" }}>
        <span className={`${face} border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow)]`} style={hide}>
          <span className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--brand)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-2)]" /> Question {card.isNew && <Pill tone="violet">New</Pill>}
            <span className="ml-auto font-bold normal-case tracking-normal text-[var(--ink-3)]">{position}</span>
          </span>
          <span className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto py-3 text-center">
            <span className="whitespace-pre-wrap break-words text-[22px] font-extrabold leading-snug text-[var(--ink)] sm:text-[28px]" style={DISPLAY}>{card.front}</span>
          </span>
          <span className="text-center text-[12px] font-semibold text-[var(--ink-3)]">Tap the card or press <kbd className="rounded border border-[var(--line)] bg-[var(--panel)] px-1.5 py-px font-mono text-[11px]">Space</kbd> to flip</span>
        </span>
        <span className={`${face} border-transparent text-white shadow-[var(--shadow)]`} style={{ ...hide, transform: "rotateY(180deg)", ...HERO_BG }}>
          <span className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/75"><span className="h-1.5 w-1.5 rounded-full bg-white" /> Answer<span className="ml-auto font-bold normal-case tracking-normal text-white/60">{position}</span></span>
          <span className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto py-3 text-center">
            <span className="whitespace-pre-wrap break-words text-[21px] font-bold leading-snug sm:text-[26px]" style={DISPLAY}>{card.back}</span>
          </span>
          <span className="text-center text-[12px] font-semibold text-white/70">How well did you know it?</span>
        </span>
      </button>
    </div>
  );
}

export function ReviewSession({ cards, qs, childId, onFinished, onError }: {
  cards: QueueCard[];
  qs: string;
  childId: string | null;
  /** Called with true when the student wants another round. */
  onFinished: (again: boolean) => void;
  onError: (m: string) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [ended, setEnded] = useState(false);
  const count = useRef(0);
  const ratedIdx = useRef(-1);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const total = cards.length;
  const card = cards[idx];
  const finished = ended || idx >= total;

  const save = useCallback((i: number, c: QueueCard, quality: number) => {
    post<ReviewResult>(`/api/learning-hub/flashcards/${c.id}/review${withQs(qs, {})}`, { childId, quality })
      .then((r) => { if (mounted.current) setResults((cur) => cur.map((x, j) => (j === i ? { ...x, interval: r.intervalDays, state: "saved" } : x))); })
      .catch((e) => { if (mounted.current) { setResults((cur) => cur.map((x, j) => (j === i ? { ...x, state: "failed" } : x))); onError(errMsg(e, "A rating didn't save — you can retry it on the summary")); } });
  }, [qs, childId, onError]);

  const rate = useCallback((r: Rating) => {
    if (!card || finished) return;
    if (ratedIdx.current === idx) return; // a double-tap must not rate the same card twice
    ratedIdx.current = idx;
    const i = count.current++;
    setResults((cur) => [...cur, { card, quality: r.quality, label: r.label, tone: r.tone, interval: null, state: "saving" }]);
    setIdx((n) => n + 1);
    setFlipped(false);
    save(i, card, r.quality);
  }, [card, finished, idx, save]);

  // Keyboard: space/enter flips, 1-4 rate (once the answer is showing).
  useEffect(() => {
    if (finished) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.key === " " || e.key === "Enter") && !(el && el.tagName === "BUTTON")) { e.preventDefault(); setFlipped((f) => !f); return; }
      const r = RATINGS.find((x) => x.key === e.key);
      if (r) { e.preventDefault(); if (flipped) rate(r); else setFlipped(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finished, flipped, rate]);

  if (finished) {
    const counts = RATINGS.map((r) => ({ ...r, n: results.filter((x) => x.quality === r.quality).length }));
    const good = results.filter((x) => x.quality >= 4).length;
    const pct = results.length ? Math.round((good / results.length) * 100) : 0;
    const failed = results.map((x, i) => ({ x, i })).filter((r) => r.x.state === "failed");
    const intervals = results.map((x) => x.interval).filter((n): n is number => n !== null);
    const soonest = intervals.length ? Math.min(...intervals) : null;
    return (
      <div className="mx-auto grid max-w-[720px] gap-4" data-testid="hub-fc-summary">
        <section className="overflow-hidden rounded-3xl p-6 text-center text-white shadow-[var(--shadow)] sm:p-8" style={HERO_BG}>
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white/18" aria-hidden><Ico name={pct >= 70 ? "sparkle" : "bolt"} size={30} /></div>
          <h3 className="mt-1 text-[24px] font-extrabold" style={DISPLAY}>{results.length ? "Session complete" : "Nothing reviewed"}</h3>
          {results.length > 0 && <div className="mt-2 flex justify-center"><ChildChip childId={childId} tone="dark" /></div>}
          <p className="mt-1 text-[14px] text-white/85">{results.length ? <>You reviewed <strong>{results.length}</strong> card{results.length === 1 ? "" : "s"} · <strong>{pct}%</strong> felt good or easy.</> : "Come back whenever you're ready."}</p>
          {soonest !== null && <p className="mt-2 inline-block rounded-full bg-white/15 px-3 py-1 text-[12.5px] font-bold">Next cards back {intervalText(soonest)}</p>}
        </section>
        {results.length > 0 && (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {counts.map((c) => (
              <div key={c.key} className="rounded-2xl border p-3 text-center" style={{ background: TONES[c.tone].bg, borderColor: TONES[c.tone].line }}>
                <div className="text-[26px] font-extrabold leading-none tabular-nums" style={{ ...DISPLAY, color: TONES[c.tone].fg }}>{c.n}</div>
                <div className="mt-1 text-[11.5px] font-bold text-[var(--ink-2)]">{c.label}</div>
              </div>
            ))}
          </div>
        )}
        {failed.length > 0 && (
          <div role="alert" className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--red-line)] bg-[var(--red-soft)] px-3.5 py-2.5 text-[12.5px] font-semibold text-[var(--red)]">
            {failed.length} rating{failed.length === 1 ? "" : "s"} didn&rsquo;t save.
            <Button variant="ghost" className={`min-h-[44px] lg:min-h-[40px] ${FOCUS}`} onClick={() => failed.forEach(({ x, i }) => { setResults((cur) => cur.map((y, j) => (j === i ? { ...y, state: "saving" } : y))); save(i, x.card, x.quality); })}>Retry</Button>
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-2.5">
          <Button variant="solid" className={`min-h-[48px] px-6 text-[14px] ${FOCUS}`} onClick={() => onFinished(true)}>Check for more cards</Button>
          <Button variant="ghost" className={`min-h-[48px] px-6 text-[14px] ${FOCUS}`} onClick={() => onFinished(false)}>Done for now</Button>
        </div>
      </div>
    );
  }

  const position = `${idx + 1} / ${total}`;
  return (
    <div className="mx-auto grid max-w-[720px] gap-4" data-testid="hub-fc-session">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <ChildChip childId={childId} />
        <div className="min-w-0 flex-1 basis-[120px]"><ProgressBar pct={(idx / total) * 100} label="Session progress" /></div>
        <span className="text-[12px] font-bold tabular-nums text-[var(--ink-3)]">{idx} of {total} done</span>
        <button type="button" onClick={() => setEnded(true)} className={`min-h-[44px] rounded-lg px-3 text-[12px] font-bold text-[var(--ink-3)] hover:text-[var(--ink)] ${FOCUS}`}>End session</button>
      </div>

      <FlipCard key={card!.id} card={card!} flipped={flipped} onFlip={() => setFlipped((f) => !f)} position={position} />

      {!flipped ? (
        <Button variant="solid" className={`min-h-[56px] w-full text-[15px] transition-transform active:scale-[.98] motion-reduce:active:transform-none ${FOCUS}`} onClick={() => setFlipped(true)}>Show answer</Button>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4" role="group" aria-label="How well did you know it?">
          {RATINGS.map((r) => (
            <button key={r.key} type="button" data-rating={r.quality} onClick={() => rate(r)}
              className={`flex min-h-[68px] flex-col items-center justify-center gap-0.5 rounded-2xl border px-2 py-2 text-center transition duration-150 hover:-translate-y-px hover:shadow-[var(--shadow)] active:scale-[.97] motion-reduce:transition-none motion-reduce:hover:transform-none motion-reduce:active:transform-none ${FOCUS}`}
              style={{ background: TONES[r.tone].bg, borderColor: TONES[r.tone].line, color: TONES[r.tone].fg }}>
              <span className="text-[15px] font-extrabold">{r.label}</span>
              <span className="text-[11px] font-semibold text-[var(--ink-3)]">{r.hint}</span>
              <kbd className="mt-0.5 hidden rounded border border-[var(--line)] bg-[var(--surface)] px-1.5 font-mono text-[11px] text-[var(--ink-2)] sm:inline">{r.key}</kbd>
            </button>
          ))}
        </div>
      )}
      <p className="hidden text-center text-[11.5px] text-[var(--ink-3)] sm:block">Shortcuts: <kbd className="rounded border border-[var(--line)] bg-[var(--panel)] px-1.5 font-mono">Space</kbd> flip · <kbd className="rounded border border-[var(--line)] bg-[var(--panel)] px-1.5 font-mono">1</kbd> Again · <kbd className="rounded border border-[var(--line)] bg-[var(--panel)] px-1.5 font-mono">2</kbd> Hard · <kbd className="rounded border border-[var(--line)] bg-[var(--panel)] px-1.5 font-mono">3</kbd> Good · <kbd className="rounded border border-[var(--line)] bg-[var(--panel)] px-1.5 font-mono">4</kbd> Easy</p>
    </div>
  );
}
