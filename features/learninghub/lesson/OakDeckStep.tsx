"use client";

import { useT } from "@/lib/i18n/provider";
import { Btn, StepCard, Tag, display } from "./lessonUi";

// Oak's own lesson: their real slide deck (a public Google Slides file), shown full-width in the lesson player. Oak publishes every
// deck this way; the id is stored on the lesson (`lesson.oakDeck`). When we also hold our own summary slides the learner can switch.

export function OakDeckStep({ deckId, title, hasSummary, onSummary, onDone, onBack, addXP }: {
  deckId: string; title: string; hasSummary: boolean; onSummary: () => void; onDone: () => void; onBack: () => void; addXP: (n: number) => void;
}) {
  const t = useT();
  return (
    <StepCard>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <Tag>{t("hublessons.theLesson")}</Tag>
          <h2 className="m-0 mt-1.5 truncate text-[18px] font-extrabold text-[var(--ink)]" style={display}>{title}</h2>
        </div>
        {hasSummary && <Btn tone="ghost" onClick={onSummary} data-testid="oak-deck-summary">{t("hublessons.summarySlidesInstead")}</Btn>}
      </div>
      <div className="relative w-full overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]" style={{ aspectRatio: "16 / 9" }}>
        <iframe
          title={t("hublessons.lessonSlidesTitle", { title })}
          data-testid="oak-deck-frame"
          src={`https://docs.google.com/presentation/d/${deckId}/embed?start=false&loop=false&delayms=60000`}
          className="absolute inset-0 h-full w-full border-0"
          allow="fullscreen"
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </div>
      <p className="m-0 mt-2 text-[12px] text-[var(--ink-3)]">{t("hublessons.oakArrowsHelp")}</p>
      <div className="mt-4 flex items-center justify-between gap-3">
        <Btn tone="ghost" onClick={onBack}>{t("hublessons.back")}</Btn>
        <Btn onClick={() => { addXP(10); onDone(); }} data-testid="lesson-next">{t("hublessons.continue")}</Btn>
      </div>
    </StepCard>
  );
}
