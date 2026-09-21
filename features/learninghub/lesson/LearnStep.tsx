"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { KeywordText } from "./KeywordText";
import { Btn, StepCard, Tag, display } from "./lessonUi";
import type { Lesson } from "./types";
import type { WidgetDef } from "./widgets";

// "Learn": one key learning point per card, key words highlighted (tap for the meaning), plus — when the lesson has one — an
// interactive Explore widget card slotted in after the third point.

type Card = { t: "point"; i: number; text: string } | { t: "explore" };

export function LearnStep({ lesson, widget, addXP, onDone, onBack }: { lesson: Lesson; widget: WidgetDef | null; addXP: (n: number) => void; onDone: () => void; onBack: () => void }) {
  const cards = useMemo(() => {
    const c: Card[] = lesson.points.map((text, i) => ({ t: "point", i, text }));
    if (widget) c.splice(Math.min(3, c.length), 0, { t: "explore" });
    return c;
  }, [lesson.points, widget]);
  const [i, setI] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.focus({ preventScroll: true }); }, [i]);
  const card = cards[i];
  if (!card) return null;
  const last = i === cards.length - 1;

  return (
    <StepCard key={i}>
      <div ref={box} tabIndex={-1} className="outline-none" aria-label={`Idea ${i + 1} of ${cards.length}`}>
        {card.t === "point" ? (
          <>
            <div className="mb-3 grid h-10 w-10 place-items-center rounded-full bg-[var(--brand-soft)] text-[16px] font-black text-[var(--brand)]" aria-hidden="true">{card.i + 1}</div>
            <h2 className="sr-only">Key idea {card.i + 1}</h2>
            <KeywordText text={card.text} keywords={lesson.keywords} className="m-0 text-[19px] font-bold leading-[1.45] text-[var(--ink)] sm:text-[21px]" />
          </>
        ) : widget ? (
          <>
            <Tag>Explore</Tag>
            <h2 className="m-0 mb-1.5 mt-2 text-[21px] font-extrabold text-[var(--ink)]" style={display}>{widget.title}</h2>
            {widget.intro && <p className="m-0 mb-3 text-[14.5px] text-[var(--ink-2)]">{widget.intro}</p>}
            <widget.Component onXP={addXP} />
          </>
        ) : null}
      </div>

      <div className="mt-4 flex justify-center gap-1.5" aria-hidden="true">
        {cards.map((_, k) => <i key={k} className={`h-2 rounded-full transition-all duration-300 ${k === i ? "w-[22px] bg-[var(--brand)]" : "w-2 bg-[var(--line)]"}`} />)}
      </div>
      <div className="mt-5 flex items-center justify-between gap-3">
        <Btn tone="ghost" onClick={() => (i === 0 ? onBack() : setI(i - 1))}>Back</Btn>
        <Btn onClick={() => { if (last) { addXP(10); onDone(); } else { addXP(2); setI(i + 1); } }} data-testid="lesson-next">{last ? "Continue →" : "Next"}</Btn>
      </div>
    </StepCard>
  );
}
