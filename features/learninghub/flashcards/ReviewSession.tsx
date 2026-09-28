"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { post } from "@/lib/api";
import { errMsg } from "../types";
import { DISPLAY, FOCUS, HERO_BG, Pill, ProgressBar, TONES, withQs, type Tone } from "../teachKit";
import { Ico } from "../teachIcons";
import { ChildChip, useSupport } from "../family/FamilyContext";
import { bandOrDefault } from "../family/kidCopy";
import { FlipCard } from "../shared-ui/FlipCard";
import { GlassOrb } from "../shared-ui/GlassOrb";
import { Confetti } from "../lesson/lessonUi";
import { subjectSwatch } from "../subjectColour";
import { useI18n } from "@/lib/i18n/provider";
import { rich } from "../lesson/tRich";
import { RATINGS, intervalText, type QueueCard, type Rating, type ReviewResult } from "./fcTypes";

// The review session: a big flip card, 1-4 to rate, space to flip. The queue is
// a snapshot the server handed us (due first, then new); rating a card advances
// at once (optimistic) while the review saves in the background. No scheduling
// maths here — the server's SM-2 answer is only displayed.

interface Result { card: QueueCard; quality: number; tone: Tone; interval: number | null; state: "saving" | "saved" | "failed" }

// Emoji faces for the four ratings (the server still gets 1 / 3 / 4 / 5).
const FACE: Record<string, string> = { "1": "😕", "2": "🤔", "3": "🙂", "4": "😄" };

export function ReviewSession({ cards, qs, childId, subjectOf, yearGroup, onFinished, onError }: {
  cards: QueueCard[];
  /** Which subject a card's topic belongs to (colours the card face). */
  subjectOf?: (topicId: string) => string;
  yearGroup?: string | null;
  qs: string;
  childId: string | null;
  /** Called with true when the student wants another round. */
  onFinished: (again: boolean) => void;
  onError: (m: string) => void;
}) {
  const { t, locale } = useI18n();
  const calm = useSupport().calm;
  const ks1 = bandOrDefault(yearGroup) === "ks1";
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
  // A finished session gets confetti (Confetti itself skips calm children and reduced motion).
  const hadResults = results.length > 0;

  const save = useCallback((i: number, c: QueueCard, quality: number) => {
    post<ReviewResult>(`/api/learning-hub/flashcards/${c.id}/review${withQs(qs, {})}`, { childId, quality })
      .then((r) => { if (mounted.current) setResults((cur) => cur.map((x, j) => (j === i ? { ...x, interval: r.intervalDays, state: "saved" } : x))); })
      .catch((e) => { if (mounted.current) { setResults((cur) => cur.map((x, j) => (j === i ? { ...x, state: "failed" } : x))); onError(errMsg(e, t("hublessons.fcCouldntSaveRating"))); } });
  }, [qs, childId, onError]);

  const rate = useCallback((r: Rating) => {
    if (!card || finished) return;
    if (ratedIdx.current === idx) return; // a double-tap must not rate the same card twice
    ratedIdx.current = idx;
    const i = count.current++;
    setResults((cur) => [...cur, { card, quality: r.quality, tone: r.tone, interval: null, state: "saving" }]);
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
      <div className="relative mx-auto grid max-w-[720px] gap-4" data-testid="hub-fc-summary">
        <Confetti fire={hadResults ? 1 : 0} scale={ks1 ? 1 : 0.8} />
        <section className="overflow-hidden rounded-3xl p-6 text-center text-white shadow-[var(--shadow)] sm:p-8" style={HERO_BG}>
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-white/18 text-[44px]" aria-hidden>{results.length ? (ks1 || pct >= 70 ? "🎉" : "🌟") : "🃏"}</div>
          <h3 className="mt-1 text-[26px] font-extrabold" style={DISPLAY}>{results.length ? t("hublessons.fcKidDone", { n: results.length }) : t("hublessons.fcNothingReviewed")}</h3>
          {results.length > 0 && <div className="mt-2 flex justify-center"><ChildChip childId={childId} tone="dark" /></div>}
          {results.length === 0 && <p className="mt-1 text-[14px] text-white/85">{t("hublessons.fcComeBack")}</p>}
          {soonest !== null && <p className="mt-2 inline-block rounded-full bg-white/15 px-3 py-1 text-[12.5px] font-bold">{t("hublessons.fcNextBack", { when: intervalText(soonest, locale) })}</p>}
        </section>
        {results.length > 0 && !ks1 && !calm && (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {counts.map((c) => (
              <div key={c.key} className="rounded-2xl border p-3 text-center" style={{ background: TONES[c.tone].bg, borderColor: TONES[c.tone].line }}>
                <div className="text-[26px] font-extrabold leading-none tabular-nums" style={{ ...DISPLAY, color: TONES[c.tone].fg }}><span aria-hidden className="me-1 text-[20px]">{FACE[c.key]}</span>{c.n}</div>
                <div className="mt-1 text-[11.5px] font-bold text-[var(--ink-2)]">{t(c.labelKey)}</div>
              </div>
            ))}
          </div>
        )}
        {failed.length > 0 && (
          <div role="alert" className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--red-line)] bg-[var(--red-soft)] px-3.5 py-2.5 text-[12.5px] font-semibold text-[var(--red)]">
            {t("hublessons.fcRatingsFailed", { n: failed.length })}
            <Button variant="ghost" className={`min-h-[44px] lg:min-h-[40px] ${FOCUS}`} onClick={() => failed.forEach(({ x, i }) => { setResults((cur) => cur.map((y, j) => (j === i ? { ...y, state: "saving" } : y))); save(i, x.card, x.quality); })}>{t("hublessons.fcRetry")}</Button>
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-2.5">
          <Button variant="solid" className={`min-h-[48px] px-6 text-[14px] ${FOCUS}`} onClick={() => onFinished(true)}>{t("hublessons.fcCheckMore")}</Button>
          <Button variant="ghost" className={`min-h-[48px] px-6 text-[14px] ${FOCUS}`} onClick={() => onFinished(false)}>{t("hublessons.fcDoneNow")}</Button>
        </div>
      </div>
    );
  }

  const position = `${idx + 1} / ${total}`;
  return (
    <div className="mx-auto grid max-w-[720px] gap-4" data-testid="hub-fc-session">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <GlassOrb pct={total ? (idx / total) * 100 : 0} size={64} color={subjectSwatch((subjectOf ? subjectOf(card!.topicId) : "")).base} calm={calm} aria={t("hublessons.fcDoneOf", { n: idx, total })}
          center={<span className="text-[13px] font-extrabold text-[var(--ink)]" style={DISPLAY}>{idx}/{total}</span>} />
        <ChildChip childId={childId} />
        <div className="min-w-0 flex-1 basis-[120px]"><ProgressBar pct={(idx / total) * 100} label={t("hublessons.fcSessionProgress")} /></div>
        <button type="button" onClick={() => setEnded(true)} className={`min-h-[44px] rounded-lg px-3 text-[12px] font-bold text-[var(--ink-3)] hover:text-[var(--ink)] ${FOCUS}`}>{t("hublessons.fcEndSession")}</button>
      </div>

      <FlipCard key={card!.id} front={card!.front} back={card!.back} flipped={flipped} onFlip={() => setFlipped((f) => !f)} subject={(subjectOf ? subjectOf(card!.topicId) : "")} position={position} big={ks1}
        badge={card!.isNew ? <Pill tone="violet">{t("hublessons.fcNew")}</Pill> : undefined}
        labels={{ front: t("hublessons.fcQuestion"), back: t("hublessons.fcAnswer"), frontAria: t("hublessons.fcQAria", { text: card!.front }), backAria: t("hublessons.fcAnsAria", { text: card!.back }) }}
        hint={ks1 ? undefined : rich(t("hublessons.fcTapFlip"), { key: <kbd className="rounded border border-[var(--line)] bg-[var(--panel)] px-1.5 py-px font-mono text-[11px]">Space</kbd> })}
        howWell={t("hublessons.fcHowWell")} />

      {!flipped ? (
        <Button variant="solid" className={`min-h-[56px] w-full text-[15px] transition-transform active:scale-[.98] motion-reduce:active:transform-none ${FOCUS}`} onClick={() => setFlipped(true)}>{t("hublessons.fcShowAnswer")}</Button>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4" role="group" aria-label={t("hublessons.fcHowWell")}>
          {RATINGS.map((r) => (
            <button key={r.key} type="button" data-rating={r.quality} onClick={() => rate(r)}
              className={`flex ${ks1 ? "min-h-[104px]" : "min-h-[84px]"} flex-col items-center justify-center gap-0.5 rounded-2xl border-2 px-2 py-2 text-center shadow-[0_3px_0_color-mix(in_srgb,currentColor_30%,transparent)] transition duration-150 hover:-translate-y-0.5 active:translate-y-px active:shadow-none motion-reduce:transition-none motion-reduce:hover:transform-none motion-reduce:active:transform-none ${FOCUS}`}
              style={{ background: TONES[r.tone].bg, borderColor: TONES[r.tone].line, color: TONES[r.tone].fg }}>
              <span aria-hidden className={ks1 ? "text-[44px] leading-none" : "text-[32px] leading-none"}>{FACE[r.key]}</span>
              <span className={`${ks1 ? "text-[15px]" : "text-[14px]"} font-extrabold`}>{t(r.labelKey)}</span>
              {!ks1 && <span className="text-[11px] font-semibold text-[var(--ink-3)]">{t(r.hintKey)}</span>}
              <kbd className="mt-0.5 hidden rounded border border-[var(--line)] bg-[var(--surface)] px-1.5 font-mono text-[11px] text-[var(--ink-2)] sm:inline">{r.key}</kbd>
            </button>
          ))}
        </div>
      )}
      <p className="hidden text-center text-[11.5px] text-[var(--ink-3)] sm:block">{t("hublessons.fcShortcuts")} <kbd className="rounded border border-[var(--line)] bg-[var(--panel)] px-1.5 font-mono">Space</kbd> {t("hublessons.fcFlipWord")} · {RATINGS.map((r, i) => <span key={r.key}>{i > 0 && " · "}<kbd className="rounded border border-[var(--line)] bg-[var(--panel)] px-1.5 font-mono">{r.key}</kbd> {t(r.labelKey)}</span>)}</p>
    </div>
  );
}
