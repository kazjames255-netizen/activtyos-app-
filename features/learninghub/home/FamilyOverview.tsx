"use client";

// Level 1 (Family home, /custdash/learninghub for a family with more than one child): one big card per child —
// avatar, name, year, tutor name, a status chip, and up to THREE action rows in priority order, each a direct
// link to the actual item (never a bare "See homework"): the soonest homework due, the next live lesson, then
// the next thing to practise (starting quiz → tutor-set quiz → flashcards). Tapping the card (or an action row)
// opens the item straight away — "≤2 taps to a specific homework" per the redesign brief. A single child skips
// this screen entirely (LearningHubApp sends the URL itself to /[portal]/learninghub/[childId]).

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { colorFor } from "@/features/money/finance-kit";
import { Avatar } from "../kit";
import { HomeSkeleton, Icon, FOCUS, TONES, DISPLAY, type IconName } from "./homeKit";
import { firstName } from "./homeLib";
import { useStudentHome } from "./useHomeData";
import { DAILY_CARD_CAP } from "./homeLib";
import { dueState } from "../homework/hwTypes";
import { lessonTiming } from "../live/lessonTypes";
import { over } from "./NextLesson";
import { useNow } from "../teachKit";
import { PARENT_COPY, overdueVerdict } from "../family/parentCopy";
import { useH } from "./homeI18n";
import type { PanelProps } from "../panelTypes";
import type { FamilyKid } from "../family/FamilyContext";

/** "amir khan" / "AMIR KHAN" → "Amir Khan" — the provider/tutor name is shown in title case everywhere a family sees it. */
function titleCase(s: string | undefined | null): string {
  return (s ?? "").trim().toLowerCase().replace(/(^|[\s'-])\p{L}/gu, (m) => m.toUpperCase());
}

interface ActionRow { key: string; label: string; href: string; live?: boolean }

const ROW_LOOK: Record<string, { icon: IconName; tone: keyof typeof TONES }> = {
  hw: { icon: "homework", tone: "brand" }, lesson: { icon: "video", tone: "violet" }, quiz: { icon: "quiz", tone: "gold" }, cards: { icon: "cards", tone: "violet" },
};

function ChildRow({ kid, qs, portal, providerName, yearGroup, onOpen }: {
  kid: FamilyKid; qs: string; portal: string; providerName?: string; yearGroup?: string | null; onOpen: () => void;
}) {
  const { t, pl } = useH();
  const { ready, parts } = useStudentHome(qs, kid.childId, () => undefined);
  const now = useNow(60_000);
  const first = firstName(kid.childName);
  const base = `/${portal}/learninghub/${encodeURIComponent(kid.childId)}`;

  const info = useMemo(() => {
    if (!ready || !parts) return null;
    const { homework, attempts, mastery, lessons, assessments, due } = parts;
    const todo = homework
      .filter((h) => h.childId === kid.childId && h.submission.status === "assigned")
      .map((h) => ({ ...h, st: dueState(h.dueAt, h.submission.status, now, false) }))
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    const overdueN = todo.filter((h) => h.st.overdue).length;
    const weekAgo = now - 7 * 86_400_000;
    const weekQuizzes = attempts.filter((a) => a.assessmentType !== "diagnostic" && a.status !== "in_progress" && !!a.submittedAt && new Date(a.submittedAt).getTime() >= weekAgo).length;
    const weekHomework = homework.filter((h) => h.childId === kid.childId && !!h.submission.submittedAt && new Date(h.submission.submittedAt).getTime() >= weekAgo).length;
    const top = (mastery?.subjects ?? []).filter((s) => s.masteryPct != null).sort((a, b) => (b.masteryPct ?? 0) - (a.masteryPct ?? 0))[0] ?? null;
    const stats = [top ? t("hubshell.hm_familyLevel", { subject: top.subject, pct: Math.round(top.masteryPct ?? 0) }) : null, todo.length ? pl("hm_familyHwCount", todo.length) : null].filter(Boolean).join(" · ");

    // ── the up-to-3 action rows, in the brief's fixed priority order ──
    const rows: ActionRow[] = [];
    const dayName = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: "short" });
    if (todo[0]) {
      rows.push({ key: "hw", label: t("hubshell.hm_familyRowHomework", { title: todo[0].title, day: dayName(todo[0].dueAt) }), href: `${base}/homework/${encodeURIComponent(todo[0].id)}` });
    }
    const mine = lessons.filter((l) => !l.childIds?.length || l.childIds.includes(kid.childId));
    const upcoming = mine.filter((l) => ["upcoming", "open"].includes(lessonTiming(l, now).phase)).sort((a, b) => Number(over(a, now)) - Number(over(b, now)) || a.startsAt.localeCompare(b.startsAt));
    const next = upcoming[0] ?? null;
    if (next && rows.length < 3) {
      const live = lessonTiming(next, now).phase === "open";
      rows.push({ key: "lesson", label: live ? t("hubshell.hm_familyRowJoin", { title: next.title }) : t("hubshell.hm_familyRowLesson", { title: next.title, day: dayName(next.startsAt) }), href: `${base}/live/${encodeURIComponent(next.id)}`, live });
    }
    if (rows.length < 3) {
      const av = assessments.filter((a) => !a.locked);
      const diag = av.find((a) => a.type === "diagnostic" && !a.done && !a.lastAttempt);
      const fresh = av.find((a) => a.type === "quiz" && !a.lastAttempt && !a.lessonNoteId);
      const retry = [...av].filter((a) => a.type === "quiz" && a.lastAttempt?.status === "marked" && a.lastAttempt.pct < a.passMarkPct).sort((a, b) => (a.lastAttempt?.pct ?? 0) - (b.lastAttempt?.pct ?? 0))[0];
      const nextQuiz = diag ?? fresh ?? retry ?? null;
      const dueCards = (due?.dueCount ?? 0) + (due?.newCount ?? 0);
      if (nextQuiz) rows.push({ key: "quiz", label: diag ? t("hubshell.hm_familyRowStarting", { title: nextQuiz.title }) : t("hubshell.hm_familyRowQuiz", { title: nextQuiz.title }), href: `${base}/quiz/${encodeURIComponent(nextQuiz.id)}` });
      // Same display-time cap as StudentHome's flashcards badge (homeLib.ts DAILY_CARD_CAP) — a huge imported
      // backlog must not show as "Review 41,955 flashcards" in this one-line family row either.
      else if (dueCards > 0) rows.push({ key: "cards", label: pl("hm_familyRowCards", Math.min(dueCards, DAILY_CARD_CAP)), href: `${base}/flashcards` });
    }

    if (overdueN) return { text: overdueVerdict(overdueN, first), tone: "var(--red)", icon: "warning" as const, chip: t("hubshell.hm_chipNudge"), stats, rows };
    if (todo.length === 0 && weekHomework + weekQuizzes > 0) return { text: PARENT_COPY.verdict.allDone, tone: "var(--green)", icon: "check" as const, chip: PARENT_COPY.verdict.allDone, stats, rows };
    return { text: PARENT_COPY.verdict.onTrack, tone: "var(--green)", icon: "check" as const, chip: PARENT_COPY.verdict.onTrack, stats, rows };
  }, [ready, parts, kid.childId, now, first, t, pl, base]);

  const tint = colorFor(kid.childName);
  return (
    <div data-testid="hub-family-row" data-child-id={kid.childId}
      className="flex flex-col gap-2.5 rounded-[20px] border p-3.5 shadow-[var(--shadow-sm)] transition motion-safe:hover:-translate-y-0.5"
      style={{ borderColor: `color-mix(in srgb, ${tint} 30%, var(--line))`, background: `linear-gradient(160deg, color-mix(in srgb, ${tint} 9%, var(--surface)), var(--surface) 65%)`, borderInlineStart: `4px solid ${tint}` }}>
      <Link href={base} onClick={onOpen} className={`flex min-h-[64px] items-center gap-3 rounded-xl text-start ${FOCUS}`}>
        <span className="relative flex-none rounded-full ring-2" style={{ boxShadow: `0 0 0 3px color-mix(in srgb, ${tint} 22%, transparent)` }}><Avatar name={kid.childName} size={46} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-[15.5px] font-extrabold text-[var(--ink)]" style={DISPLAY}>{kid.childName}</span>
            {yearGroup && <span className="text-[12px] font-bold text-[var(--ink-3)]">{yearGroup}</span>}
          </div>
          {providerName && <div className="truncate text-[11.5px] font-semibold text-[var(--ink-3)]">{t("hubshell.st_tutorName", { name: titleCase(providerName) })}</div>}
        </div>
        {info ? (
          <span className="inline-flex flex-none items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold" style={{ background: `color-mix(in srgb, ${info.tone} 16%, var(--surface))`, color: info.tone, border: `1px solid color-mix(in srgb, ${info.tone} 35%, transparent)` }}>
            <Icon name={info.icon} size={12} />{info.chip}
          </span>
        ) : (
          <div className="h-[22px] w-[92px] flex-none animate-pulse rounded-full bg-[var(--panel)]" aria-hidden />
        )}
        <Icon name="chevronRight" size={18} className="flex-none text-[var(--ink-3)]" />
      </Link>

      {!info ? (
        <div className="space-y-1.5 ps-[58px]">
          <div className="h-[14px] w-[70%] animate-pulse rounded bg-[var(--panel)]" aria-hidden />
          <div className="h-[14px] w-[50%] animate-pulse rounded bg-[var(--panel)]" aria-hidden />
        </div>
      ) : (
        <>
          {info.stats && <div className="truncate ps-[58px] text-[12px] font-semibold text-[var(--ink-2)]">{info.stats}</div>}
          {info.rows.length > 0 ? (
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {info.rows.map((r) => {
                const look = ROW_LOOK[r.key] ?? ROW_LOOK.hw!;
                const rt = TONES[look.tone];
                return (
                  <li key={r.key}>
                    <Link href={r.href} data-testid="hub-family-action"
                      className={`flex min-h-[44px] w-full items-center gap-2.5 rounded-xl border px-2.5 text-start text-[12.5px] font-bold text-[var(--ink)] transition motion-safe:hover:-translate-y-px ${FOCUS}`}
                      style={{ background: rt.bg, borderColor: rt.line }}>
                      <span className="relative grid h-8 w-8 flex-none place-items-center rounded-lg" style={{ background: "var(--surface)", color: rt.fg, boxShadow: "var(--shadow-sm)" }}>
                        <Icon name={look.icon} size={15} />
                        {r.live && <span aria-hidden className="absolute -end-1 -top-1 h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--red)] ring-2 ring-[var(--surface)]" />}
                      </span>
                      <span className="min-w-0 flex-1 truncate" style={{ color: rt.fg }}>{r.label}</span>
                      <span className="flex-none" style={{ color: rt.fg }}><Icon name="chevronRight" size={14} /></span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="m-0 ps-[58px] text-[12px] font-semibold text-[var(--ink-3)]">{t("hubshell.hm_familyNothingSet", { name: first, tutor: titleCase(providerName || "") })}</p>
          )}
        </>
      )}
    </div>
  );
}

export function FamilyOverview({ kids, qs, providerName, yearOf, onOpen }: {
  kids: FamilyKid[]; qs: string; providerName?: string; yearOf?: (childId: string) => string | null | undefined; onOpen: (childId: string) => void;
}) {
  const { t } = useH();
  const pathname = usePathname() ?? "";
  const portal = pathname.split("/")[1] || "custdash";
  if (!kids.length) return <HomeSkeleton label={t("hubshell.hm_loadingDay")} />;
  return (
    <div id="hub-family-overview" className="space-y-3">
      <h2 className="m-0 text-[13px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]">{t("hubshell.hm_familyOverviewTitle")}</h2>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {kids.map((k) => (
          <ChildRow key={k.childId} kid={k} qs={qs} portal={portal} providerName={providerName} yearGroup={yearOf?.(k.childId)} onOpen={() => onOpen(k.childId)} />
        ))}
      </div>
    </div>
  );
}
