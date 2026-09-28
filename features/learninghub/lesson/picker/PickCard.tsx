"use client";

import type { ReactNode } from "react";
import { useT } from "@/lib/i18n/provider";
import { FOCUS, Icon, tint } from "../../kit";
import { SubjectGlyph } from "../../subjectArt";
import type { PickItem } from "./types";

/** ONE lesson / quiz card in the Lessons area's own card language (gradient header in the subject colour with its glyph, year pill,
 *  title in the display font, two lines of text, badges) plus a clear selected state: brand ring + tick. The title button stretches over the
 *  whole card, so the card is one big 44px+ touch target; `actions` (e.g. Preview) sit above it. */
export function PickCard({ item, selected, single, compact, onPick, actions, badges }: {
  item: PickItem; selected: boolean; single: boolean; compact?: boolean; onPick: (it: PickItem) => void; actions?: ReactNode; badges?: ReactNode;
}) {
  const t = useT();
  const c = item.color ?? "var(--brand)";
  const hd = compact ? 36 : 60;
  return (
    <article data-ui="card" data-selected={selected ? "1" : undefined}
      className={`hub-lift group relative flex flex-col overflow-hidden rounded-2xl border bg-[var(--surface)] shadow-[var(--shadow-sm)] has-[.hit:focus-visible]:ring-2 has-[.hit:focus-visible]:ring-[var(--brand-2)] ${compact ? "w-[220px] flex-none" : ""} ${selected ? "border-[var(--brand)] ring-2 ring-[var(--brand)] ring-offset-1 ring-offset-[var(--surface)]" : "border-[var(--line)]"}`}>
      <div className="relative flex-none overflow-hidden" style={{ height: hd, background: `linear-gradient(135deg, ${tint(c, 30)} 0%, ${tint(c, 12)} 100%)`, color: c }}>
        <SubjectGlyph subject={item.subject ?? item.title} size={compact ? 50 : 75} className="pointer-events-none absolute -bottom-3 -end-2 opacity-25" />
        <div className="relative flex items-center gap-2 ps-3.5 pe-2" style={{ height: hd }}>
          {item.year ? <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-extrabold text-[var(--ink)] backdrop-blur">{t("hublessons.yearN", { n: item.year })}</span> : null}
          {item.kind && <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-extrabold text-[var(--ink)] backdrop-blur">{item.kind === "diagnostic" ? t("hubpicker.startingQuiz") : t("hubpicker.quiz")}</span>}
          <span className="relative z-10 ms-auto flex flex-none items-center gap-1">{actions}
            <span aria-hidden className={`grid h-7 w-7 place-items-center rounded-full border-2 text-[13px] font-extrabold ${selected ? "border-[var(--brand)] bg-[var(--brand)] text-[var(--on-brand,#fff)]" : "border-white/80 bg-white/60 text-transparent"}`}>{selected ? <Icon name="check" size={14} /> : null}</span>
          </span>
        </div>
      </div>
      <div className={`flex flex-1 flex-col ${compact ? "p-2.5" : "p-3.5"}`}>
        <h4 className={`m-0 font-extrabold leading-snug text-[var(--ink)] ${compact ? "line-clamp-2 text-[13px]" : "text-[14.5px]"}`} style={{ fontFamily: "var(--ff-display)" }}>
          <button type="button" onClick={() => onPick(item)} data-pick={item.id} aria-label={t("hubpicker.choose", { title: item.title })}
            {...(single ? { role: "radio", "aria-checked": selected } : { "aria-pressed": selected })}
            className="hit min-h-[44px] rounded text-start outline-none after:absolute after:inset-0 after:content-['']">{item.title}</button>
        </h4>
        {!compact && item.excerpt ? <p className="mt-1 line-clamp-2 text-[12.5px] leading-[1.5] text-[var(--ink-2)]">{item.excerpt}</p> : null}
        {!compact && (
          <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3 text-[11px] font-semibold text-[var(--ink-2)]">
            {item.isLesson && <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-extrabold" style={{ background: tint("var(--violet)", 12), color: "var(--violet)" }}><Icon name="sparkle" size={11} />{t("hubpicker.interactive")}</span>}
            {item.hasWorksheet && <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-extrabold" style={{ background: tint("var(--brand)", 12), color: "var(--brand)" }}><Icon name="notes" size={11} />{item.isLesson ? t("hubpicker.worksheet") : t("hubpicker.interactive")}</span>}
            {item.questionCount != null && <span className="font-extrabold">{t("hubpicker.quizMeta", { n: item.questionCount })}</span>}
            {item.subject && <span className="truncate">{item.subject}</span>}
            {badges}
          </div>
        )}
      </div>
    </article>
  );
}
export const CARD_GRID = "m-0 grid list-none gap-3 p-0 grid-cols-[repeat(auto-fill,minmax(230px,1fr))]";
export { FOCUS };
