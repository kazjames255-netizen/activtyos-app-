"use client";

import { useT } from "@/lib/i18n/provider";
import { useState } from "react";
import { Btn, StepCard, Tag, display } from "./lessonUi";
import type { Lesson } from "./types";
import { FOCUS } from "../kit";

// "Key words": flip cards (say it first, then check). They are the lesson's flashcard deck — the flashcards themselves are
// created by the import, so nothing is saved from here.

export function WordsStep({ lesson, addXP, onDone, onBack }: { lesson: Lesson; addXP: (n: number) => void; onDone: () => void; onBack: () => void }) {
  const t = useT();
  const [seen, setSeen] = useState<Set<number>>(new Set());
  const [on, setOn] = useState<Set<number>>(new Set());
  const total = lesson.keywords.length;
  const flip = (i: number) => {
    setOn((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; });
    setSeen((s) => (s.has(i) ? s : new Set(s).add(i)));
  };
  const all = seen.size >= total;

  return (
    <StepCard>
      <Tag>{t("hublessons.keyWordsTag")}</Tag>
      <h2 className="m-0 mb-1.5 mt-2 text-[21px] font-extrabold text-[var(--ink)]" style={display} tabIndex={-1} data-autofocus>{t("hublessons.flipEachCard")}</h2>
      <p className="m-0 mb-4 text-[14.5px] text-[var(--ink-2)]">{t("hublessons.flipHelp")}</p>
      <ul className="m-0 grid list-none gap-3 p-0 [grid-template-columns:repeat(auto-fill,minmax(min(100%,230px),1fr))]">
        {lesson.keywords.map((k, i) => {
          const flipped = on.has(i);
          return (
            <li key={k.keyword}>
              <button type="button" aria-pressed={flipped} onClick={() => flip(i)} aria-label={flipped ? t("hublessons.cardBackAria", { word: k.keyword, meaning: k.description }) : t("hublessons.cardFrontAria", { word: k.keyword })}
                className={`ls-flip block h-[150px] w-full rounded-[14px] border-0 bg-transparent p-0 text-start ${FOCUS}`}>
                <span className="ls-in block">
                  <span aria-hidden={flipped} className="ls-f flex flex-col items-center justify-center rounded-[14px] border-2 border-[var(--brand-line)] bg-[var(--brand-soft)] p-4 text-center text-[19px] font-black text-[var(--brand)]">
                    {k.keyword}<small className="mt-1.5 text-[11px] font-extrabold text-[var(--ink-3)]">{t("hublessons.tapToFlip")}</small>
                  </span>
                  <span aria-hidden={!flipped} className="ls-b flex flex-col justify-center overflow-auto rounded-[14px] border-2 border-[var(--brand-2)] bg-[var(--surface)] p-4 text-[14px] leading-snug text-[var(--ink)]">{k.description || "—"}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <Btn tone="ghost" onClick={onBack}>{t("hublessons.back")}</Btn>
        <span className="text-[13px] text-[var(--ink-3)]" role="status">{t("hublessons.flippedCount", { n: seen.size, total })}</span>
        <span className="flex flex-wrap gap-2">
          {!all && <Btn tone="ghost" onClick={() => setSeen(new Set(lesson.keywords.map((_, i) => i)))}>{t("hublessons.showAll")}</Btn>}
          <Btn disabled={!all} onClick={() => { addXP(10); onDone(); }} data-testid="lesson-next">{t("hublessons.continue")}</Btn>
        </span>
      </div>
    </StepCard>
  );
}
