"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/lib/i18n/provider";
import { get } from "@/lib/api";
import type { PanelProps } from "../../panelTypes";
import { topicLabel } from "../../types";
import { DISPLAY, FOCUS, Skeleton, usePrefersReducedMotion } from "../../teachKit";
import { Ico } from "../../teachIcons";
import { asArray } from "../../home/homeLib";
import { hubPath } from "../../shared-assess/api";
import type { Card } from "../../flashcards/fcTypes";
import type { QueueCard } from "../../flashcards/fcTypes";
import type { Lesson } from "../lessonTypes";
import { PaneOverlay, WsButton, WsEmpty, WsSection, useWsView } from "./wsKit";

// "Cards" — the flashcards for this lesson's topic, with a big flip-card
// PRESENT mode for teaching: tap or Space flips, arrows step, S shuffles.
// (Tutors read the published deck; a family reads their child's queue — display
// only, no reviews are recorded from here.)

interface Face { id: string; topicId: string; front: string; back: string }

export function CardsTab({ p, lesson, isTutor }: { p: PanelProps; lesson: Lesson; isTutor: boolean }) {
  const tx = useT();
  const { big } = useWsView();
  const [cards, setCards] = useState<Face[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [deck, setDeck] = useState<{ title: string; cards: Face[] } | null>(null);
  const topic = p.topics.find((t) => t.id === lesson.topicId) ?? null;
  const childId = isTutor ? null : p.childId ?? lesson.childIds[0] ?? null;

  useEffect(() => {
    let live = true;
    const path = isTutor ? hubPath(p.qs, "/flashcards", { topicId: lesson.topicId }) : hubPath(p.qs, "/flashcards/due", { childId, topicId: lesson.topicId });
    get<unknown>(path)
      .then((r) => {
        if (!live) return;
        const list = isTutor ? asArray<Card>(r).filter((c) => c.published !== false) : asArray<QueueCard>(r, "due");
        setCards(list.map((c) => ({ id: c.id, topicId: c.topicId, front: c.front, back: c.back })));
      })
      .catch(() => { if (live) { setFailed(true); setCards([]); } });
    return () => { live = false; };
  }, [p.qs, lesson.topicId, isTutor, childId]);

  const groups = useMemo(() => {
    const m = new Map<string, Face[]>();
    for (const c of cards ?? []) m.set(c.topicId, [...(m.get(c.topicId) ?? []), c]);
    return [...m.entries()].map(([id, list]) => { const t = p.topics.find((x) => x.id === id); return { id, title: t ? topicLabel(t) : tx("hublive.aCd_other"), cards: list }; }).sort((a, b) => a.title.localeCompare(b.title));
  }, [cards, p.topics, tx]);

  if (cards === null) return <div className="grid gap-2"><Skeleton className="h-[84px]" /><Skeleton className="h-[84px]" /></div>;
  if (!cards.length) return <WsEmpty icon="cards" title={failed ? tx("hublive.aCd_loadFail") : topic ? tx("hublive.aCd_noneTopic") : tx("hublive.aCd_none")} body={isTutor ? tx("hublive.aCd_noneBodyTutor") : tx("hublive.aCd_noneBodyFam")} />;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <WsButton variant="solid" icon="cards" id="ws-present-deck" onClick={() => setDeck({ title: topic ? topicLabel(topic) : tx("hublive.aCd_allCards"), cards })}>{tx("hublive.aCd_presentN", { n: cards.length })}</WsButton>
        <span className="text-[12px] text-[var(--ink-3)]">{isTutor ? tx("hublive.aCd_hintTutor") : tx("hublive.aCd_hintFam")}</span>
      </div>
      {groups.map((g) => (
        <WsSection key={g.id} title={g.title} icon="cards" aside={<button type="button" onClick={() => setDeck({ title: g.title, cards: g.cards })} className={`min-h-[44px] lg:min-h-[36px] rounded-lg px-2 text-[12px] font-extrabold text-[var(--brand)] hover:underline ${FOCUS}`}>{tx("hublive.aCd_present")}</button>}>
          <ul className="m-0 grid list-none gap-1.5 p-0">
            {g.cards.slice(0, 40).map((c) => (
              <li key={c.id} className="grid gap-0.5 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 sm:grid-cols-2 sm:gap-3">
                <span className={`font-bold text-[var(--ink)] ${big ? "text-[15px]" : "text-[13px]"}`}>{c.front}</span>
                <span className={`text-[var(--ink-2)] ${big ? "text-[15px]" : "text-[13px]"}`}>{c.back}</span>
              </li>
            ))}
          </ul>
        </WsSection>
      ))}
      {deck && <PaneOverlay><FlipDeck title={deck.title} cards={deck.cards} onClose={() => setDeck(null)} /></PaneOverlay>}
    </div>
  );
}

/** The big teaching deck. Fills the workspace pane. */
export function FlipDeck({ title, cards, onClose }: { title: string; cards: Face[]; onClose: () => void }) {
  const tx = useT();
  const [order, setOrder] = useState(() => cards.map((_, i) => i));
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const reduced = usePrefersReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const cur = cards[order[Math.min(i, order.length - 1)]!]!;
  const n = order.length;

  const go = useCallback((d: number) => { setI((v) => Math.max(0, Math.min(n - 1, v + d))); setFlipped(false); }, [n]);
  const shuffle = useCallback(() => { setOrder((o) => { const a = [...o]; for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [a[k], a[j]] = [a[j]!, a[k]!]; } return a; }); setI(0); setFlipped(false); }, []);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    root.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); }
      else if (e.key === " " || e.key === "Enter") { if (t?.tagName === "BUTTON" && t.dataset.deckCard === undefined) return; e.preventDefault(); setFlipped((f) => !f); }
      else if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
      else if (e.key.toLowerCase() === "s") { shuffle(); }
    };
    document.addEventListener("keydown", onKey, true);
    return () => { document.removeEventListener("keydown", onKey, true); prev?.focus?.({ preventScroll: true }); };
  }, [go, shuffle, onClose]);

  const tapFlip = tx("hublive.aCd_tapFlip").split("{key}");
  const face = "absolute inset-0 flex flex-col rounded-[28px] border p-6 sm:p-10";
  const hide = { backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" } as const;
  return (
    <div ref={root} tabIndex={-1} role="dialog" aria-label={tx("hublive.aCd_deckAria", { title })} data-testid="ws-deck"
      className="absolute inset-0 z-20 flex flex-col gap-3 p-3 outline-none sm:p-4" style={{ background: "var(--hub-warm-2)" }}>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1"><div className="truncate text-[15px] font-extrabold text-[var(--ink)]" style={DISPLAY}>{title}</div><div className="text-[12px] font-bold text-[var(--ink-3)]">{tx("hublive.aCd_cardOf", { i: Math.min(i + 1, n), n })}</div></div>
        <WsButton variant="ghost" icon="refresh" onClick={shuffle} ariaLabel={tx("hublive.aCd_shuffleAria")}>{tx("hublive.aCd_shuffle")}</WsButton>
        <WsButton variant="ghost" icon="close" onClick={onClose} ariaLabel={tx("hublive.aCd_closeAria")}>{tx("hublive.aCd_close")}</WsButton>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--line)]" role="progressbar" aria-valuemin={1} aria-valuemax={n} aria-valuenow={Math.min(i + 1, n)}><div className="h-full rounded-full bg-[var(--brand)] transition-[width] motion-reduce:transition-none" style={{ width: `${(Math.min(i + 1, n) / n) * 100}%` }} /></div>
      <div className="min-h-0 flex-1 [perspective:1600px]" data-flipped={flipped}>
        <button type="button" data-deck-card onClick={() => setFlipped((f) => !f)} aria-label={flipped ? tx("hublive.aCd_ansAria", { a: cur.back }) : tx("hublive.aCd_qAria", { q: cur.front })}
          className={`relative block h-full min-h-[220px] w-full rounded-[28px] text-start ${reduced ? "" : "transition-transform duration-500 ease-out"} ${FOCUS}`}
          style={{ transformStyle: reduced ? undefined : "preserve-3d", transform: !reduced && flipped ? "rotateY(180deg)" : "none" }}>
          <span className={`${face} border-[var(--hub-warm-line)] bg-[var(--surface)] shadow-[var(--shadow)]`} style={{ ...(reduced ? {} : hide), display: reduced && flipped ? "none" : undefined }}>
            <span className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--brand)]"><span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-2)]" />{tx("hublive.aCd_question")}</span>
            <span className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto py-3 text-center"><span className="whitespace-pre-wrap break-words text-[clamp(26px,4.2vw,52px)] font-extrabold leading-tight text-[var(--ink)]" style={DISPLAY}>{cur.front}</span></span>
            <span className="text-center text-[12.5px] font-semibold text-[var(--ink-3)]">{tapFlip[0]}<kbd className="rounded border border-[var(--line)] bg-[var(--panel)] px-1.5 py-px font-mono text-[11px]">{tx("hublive.aCd_key")}</kbd>{tapFlip[1]}</span>
          </span>
          <span className={`${face} border-[var(--brand-line)] bg-[var(--brand-soft)] shadow-[var(--shadow)]`} style={{ ...(reduced ? {} : { ...hide, transform: "rotateY(180deg)" }), display: reduced && !flipped ? "none" : undefined }}>
            <span className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[var(--brand-strong)]"><span className="h-1.5 w-1.5 rounded-full bg-[var(--brand)]" />{tx("hublive.aCd_answerLbl")}</span>
            <span className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto py-3 text-center"><span className="whitespace-pre-wrap break-words text-[clamp(24px,3.8vw,46px)] font-bold leading-tight text-[var(--brand-ink)]" style={DISPLAY}>{cur.back}</span></span>
            <span className="text-center text-[12.5px] font-semibold text-[var(--brand-strong)]/80">{tx("hublive.aCd_tapBack")}</span>
          </span>
        </button>
      </div>
      <div className="flex items-center justify-center gap-3">
        <WsButton variant="ghost" icon="arrowLeft" onClick={() => go(-1)} disabled={i === 0} ariaLabel={tx("hublive.aCd_prevCard")} className="min-w-[110px]">{tx("hublive.aQz_prev")}</WsButton>
        <WsButton variant="solid" onClick={() => setFlipped((f) => !f)} className="min-w-[120px]">{flipped ? tx("hublive.aCd_showQ") : tx("hublive.aCd_flip")}</WsButton>
        <WsButton variant="ghost" onClick={() => go(1)} disabled={i >= n - 1} ariaLabel={tx("hublive.aCd_nextCard")} className="min-w-[110px]">{tx("hublive.aQz_next")}<Ico name="chevronRight" size={14} className="rtl:-scale-x-100" /></WsButton>
      </div>
    </div>
  );
}

