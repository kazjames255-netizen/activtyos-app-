"use client";

import type { ReactNode } from "react";
import { useT } from "@/lib/i18n/provider";
import { subjectColor, tint } from "../../kit";

// The redesigned "Lesson outline" slide (Oak's own template: a title + a pill-per-"learning cycle"-step list, each
// paired with a numbered circle). This is a genuinely different LAYOUT from the earlier pill/dot recolour
// (slideTheme.ts's themeBlock still handles that recolour for any slide that DOESN'T match this card-list — this
// component only renders once slideTheme.ts's `lessonOutlineSlide` has found >= 2 real pill/dot pairs), following the
// same "replace, not reskin" approach as LessonIntroCard.tsx for the Outcome slide.
//
// What's real vs decorative: subject / heading / each item's own title text are the lesson's actual content (never
// invented — an item's wording comes straight from its own canvas text element).
//
// `currentPart`: Oak's own raw decks repeat this exact slide once before EACH learning-cycle/part (confirmed by
// inspecting real decks — see the investigation this fixed), so the SAME static list used to reappear unchanged
// every time, looking like a pointless repeat rather than a recap. This is real, not illustrative: CanvasSlide.tsx
// counts which occurrence of the outline slide is currently showing (0-based, by walking the deck up to and
// including the current slide) and passes that in — it's the deck's own actual position, nothing invented. Parts
// before it are genuinely already behind the student (ticked, muted); the current one is genuinely the part about
// to start (highlighted, "You are here"); later ones are plain, not "locked" — nothing here claims to know whether
// a student will actually do them in order. `currentPart` is left undefined only if the caller can't determine an
// occurrence, in which case every item renders plain (the original, no-status treatment).

export interface LessonOutlineItem {
  title: string;
  /** Tutor edit only: an inline-editable element (CanvasSlide's own contentEditable/onCommit mechanism, matching
   *  LessonIntroCard's objectiveEditable) rendered in place of the plain title, styled identically (ITEM_TITLE_CLASS).
   *  Undefined in the student view, which keeps the plain, non-editable title. */
  editable?: ReactNode;
}

/** The item title's own classes — exported so CanvasSlide.tsx's inline-editable version matches exactly. */
export const ITEM_TITLE_CLASS = "m-0 mt-[.3cqw] truncate text-[2.1cqw] font-extrabold leading-snug";

/** A plain number for every not-yet-reached item — not a subject icon (an earlier version cycled through a
 *  subject's icon set by index, which implied each item had its own distinct meaning; there's no real per-item
 *  signal to hang that on). A DONE item swaps to a tick — that one's real. */
function ItemBadge({ accent, n, done }: { accent: string; n: number; done: boolean }) {
  return (
    <span aria-hidden="true" className="grid h-[7cqw] w-[7cqw] max-h-14 max-w-14 flex-none place-items-center rounded-full text-[2cqw] font-extrabold" style={{ background: tint(accent, 16), color: accent }}>
      {done ? (
        <svg viewBox="0 0 24 24" width="52%" height="52%" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
      ) : n}
    </span>
  );
}

export function LessonOutlineCard({ subject, heading, items, currentPart }: {
  subject: string;
  /** The slide's own title (the outline's heading), never invented — the caller passes the slide's real `label`. */
  heading: string;
  items: LessonOutlineItem[];
  /** 0-based: which item is the part about to start, from the deck's own occurrence count (see file header). Items
   *  before it are already done, this one is current, later ones are plain. Undefined = no status at all. */
  currentPart?: number;
}) {
  const t = useT();
  const accent = subjectColor(subject || "");
  const at = currentPart != null ? Math.min(Math.max(currentPart, 0), items.length - 1) : undefined;
  const doneCount = at ?? 0;
  return (
    <div data-testid="lesson-outline-card" className="flex h-full w-full flex-col overflow-hidden" style={{ fontFamily: "var(--ff-display), var(--ff), system-ui, sans-serif", background: "var(--sb-paper, #fff)" }}>
      {/* HEADER — this app's own sidebar brand recipe (var(--side-bg)), the same band this session's other redesigned
          slides use — never a per-lesson guessed colour. */}
      <div className="relative flex flex-none flex-wrap items-center justify-between gap-[2.4cqw] px-[4.5cqw] py-[3.6cqw]"
        style={{ backgroundImage: "radial-gradient(rgba(255,255,255,.14) 1px, transparent 1.6px), var(--side-bg)", backgroundSize: "18px 18px, cover" }}>
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[1.8cqw] font-extrabold uppercase tracking-[0.08em] text-white/75">{subject ? t("hublessons.loSubjectOutline", { subject }) : t("hublessons.loOutline")}</p>
          <h2 className="m-0 mt-[.7cqw] max-w-[48cqw] text-[3.3cqw] font-extrabold leading-[1.12]" style={{ color: "#fff" }}>{heading}</h2>
        </div>
        {/* Real position, when known (see file header) — "Part N of M starting" / a filled-in progress rail — rather
            than always reading "not started" regardless of where the student actually is in the deck. */}
        <div className="flex flex-none flex-col items-end gap-[.9cqw]" style={{ minWidth: "17cqw" }}>
          <span className="text-[1.6cqw] font-bold text-white/75">{at != null ? t("hublessons.loPartStarting", { n: at + 1, total: items.length }) : t("hublessons.loParts", { n: items.length })}</span>
          <div className="h-[.8cqw] w-full overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,.24)" }}>
            <span className="block h-full rounded-full" style={{ width: at != null ? `${Math.round(((at + 0.5) / items.length) * 100)}%` : "4%", background: "var(--gold, #f5b81f)" }} />
          </div>
        </div>
      </div>

      {/* LIST — one rounded white card per outline item. */}
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-[1.5cqw] overflow-auto px-[4cqw] py-[3cqw]" style={{ background: "var(--sb-a-tint, #f2f4fb)" }}>
        {items.map((item, i) => {
          const done = at != null && i < doneCount;
          const here = at != null && i === at;
          return (
            <div key={i} className="flex items-center gap-[2.2cqw] rounded-[1.5cqw] bg-white px-[2.4cqw] py-[1.8cqw]"
              style={{ boxShadow: here ? `0 .3cqw 1.3cqw rgba(15,23,42,.08), inset 0 0 0 .18cqw ${accent}` : "0 .3cqw 1.3cqw rgba(15,23,42,.08)", opacity: done ? 0.62 : 1 }}>
              <ItemBadge accent={accent} n={i + 1} done={done} />
              <div className="min-w-0 flex-1">
                <p className="m-0 text-[1.4cqw] font-extrabold uppercase tracking-[0.06em]" style={{ color: accent }}>{t("hublessons.loPartN", { n: i + 1 })}</p>
                {item.editable ?? <p className={ITEM_TITLE_CLASS} style={{ color: "var(--sb-ink, #171534)" }}>{item.title}</p>}
              </div>
              {here && <span className="flex-none rounded-full px-[2.1cqw] py-[1cqw] text-[1.6cqw] font-extrabold text-white" style={{ background: accent }}>{t("hublessons.loYouAreHere")}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
