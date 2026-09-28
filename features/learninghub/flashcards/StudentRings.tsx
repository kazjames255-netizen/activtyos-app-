"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { FOCUS, Pill, fmtDay } from "../teachKit";
import { Person } from "../home/homeKit";
import { requestOpenStudent } from "../hubIntent";
import type { FlashStats } from "./fcTypes";

// Tutor Flashcards → "Student progress": one frosted-glass card per child with a progress RING measured against the
// cards ASSIGNED to that child (never the whole library: 14 of 22,229 always read as 0%). At most 5 cards, "Show all"
// for the rest, and an Open / Close toggle for the whole list.

type Row = FlashStats["students"][number];

const DAY = 86_400_000;
/** Whole days since the child last reviewed a card (0 = today); null when they never have. */
function daysAgo(iso: string | null, now: number): number | null {
  if (!iso) return null;
  const d = new Date(iso), n = new Date(now);
  return Math.max(0, Math.round((new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / DAY));
}

function Ring({ pct, dashed, size = 88 }: { pct: number; dashed: boolean; size?: number }) {
  const r = size / 2 - 8, C = 2 * Math.PI * r, c = size / 2;
  // Mount at "empty" and let a CSS transition fill it (reduced-motion: no transition).
  const [go, setGo] = useState(false);
  useEffect(() => { const t = requestAnimationFrame(() => setGo(true)); return () => cancelAnimationFrame(t); }, []);
  const off = C * (1 - (go ? Math.min(1, Math.max(0, pct / 100)) : 0));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <defs>
        <linearGradient id="fcRingGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="color-mix(in srgb, var(--brand-2) 55%, var(--green))" />
          <stop offset="1" stopColor="var(--brand)" />
        </linearGradient>
        <radialGradient id="fcRingGloss" cx=".35" cy=".3" r=".8">
          <stop offset="0" stopColor="white" stopOpacity=".85" />
          <stop offset="1" stopColor="white" stopOpacity=".08" />
        </radialGradient>
      </defs>
      <circle cx={c} cy={c} r={r + 1} fill="url(#fcRingGloss)" opacity=".55" />
      <circle cx={c} cy={c} r={r} fill="none" strokeWidth="9" stroke={dashed ? "var(--ink-3)" : "var(--line)"} strokeDasharray={dashed ? "3 5" : undefined} opacity={dashed ? 0.7 : 1} />
      {!dashed && pct > 0 && (
        <circle cx={c} cy={c} r={r} fill="none" stroke="url(#fcRingGrad)" strokeWidth="9" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={off}
          transform={`rotate(-90 ${c} ${c})`} style={{ transition: "stroke-dashoffset .9s cubic-bezier(.2,.8,.2,1)" }} className="motion-reduce:!transition-none" />
      )}
    </svg>
  );
}

export function StudentRings({ students, goTo }: { students: Row[]; goTo?: (key: never) => void }) {
  const { t: tr } = useI18n();
  const [open, setOpen] = useState(true);
  const [all, setAll] = useState(false);
  const [now] = useState(() => Date.now()); // fixed at mount: recency is by whole days
  // Most due first, then the child who studied longest ago; children who never have go last.
  const sorted = [...students].sort((a, b) => b.due - a.due || (a.lastReviewedAt ?? "9999").localeCompare(b.lastReviewedAt ?? "9999"));
  const shown = sorted.slice(0, all ? 200 : 5);

  const openChild = (s: Row) => { if (!goTo) return; requestOpenStudent(s.childId, s.childName); (goTo as (k: string) => void)("dashboard"); };

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]" aria-label={tr("hublessons.tfStudentProgress")} data-testid="fc-student-rings">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]">{tr("hublessons.tfStudentProgress")}</div>
        <button type="button" data-testid="fc-rings-toggle" aria-expanded={open} aria-controls="fc-rings-list" onClick={() => setOpen((o) => !o)}
          className={`inline-flex min-h-[36px] items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--panel)] px-3 text-[12px] font-extrabold text-[var(--brand-strong)] ${FOCUS}`}>
          {open ? tr("hubshell.hm_feedClose") : tr("hubshell.hm_feedOpen")} <span aria-hidden>{open ? "▲" : "▼"}</span>
        </button>
      </div>
      <div id="fc-rings-list" hidden={!open}>
        <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((s) => {
            const assigned = s.assigned ?? 0;
            const pct = assigned ? Math.round(((s.assignedReviewed ?? 0) / assigned) * 100) : 0;
            const days = daysAgo(s.lastReviewedAt, now);
            const recency = days === null ? "var(--ink-3)" : days <= 1 ? "var(--green)" : days <= 6 ? "var(--gold)" : "var(--red)";
            const last = days === null ? tr("hubshell.hm_fcNever") : days === 0 ? tr("hubshell.hm_fcToday") : days === 1 ? tr("hubshell.hm_fcYesterday") : tr("hubshell.hm_fcLastOn", { day: fmtDay(s.lastReviewedAt!) });
            const aria = assigned
              ? tr("hubshell.hm_fcAria", { name: s.childName, p: pct, due: s.due, n: s.new })
              : tr("hubshell.hm_fcAriaNone", { name: s.childName, a: s.reviewed, due: s.due });
            const inner = (
              <>
                <span className="relative grid place-items-center">
                  <Ring pct={pct} dashed={!assigned} />
                  <span className="absolute text-[20px] font-extrabold leading-none text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{assigned ? `${pct}%` : "–"}</span>
                </span>
                <span className="flex items-center gap-2"><Person name={s.childName} size={26} /><span className="truncate text-[14px] font-extrabold text-[var(--ink)]">{s.childName.split(" ")[0]}</span></span>
                <span className="flex flex-wrap justify-center gap-1.5">
                  {s.due > 0 && <Pill tone="gold">{tr("hublessons.tfDueN", { n: s.due })}</Pill>}
                  {s.new > 0 && <Pill tone="violet">{tr("hublessons.tfNewN", { n: s.new })}</Pill>}
                  {s.due === 0 && s.new === 0 && <Pill tone="green">{tr("hublessons.tfUpToDate")}</Pill>}
                </span>
                <span className="text-[11.5px] font-semibold text-[var(--ink-2)]">{assigned ? tr("hubshell.hm_fcRingOf", { a: s.assignedReviewed ?? 0, b: assigned }) : tr("hubshell.hm_fcRingRev", { a: s.reviewed })}</span>
                <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold" style={{ color: recency }}><span aria-hidden className="h-2 w-2 rounded-full" style={{ background: recency }} />{last}</span>
                {!assigned && s.cardsAvailable > 0 && <span className="text-[10.5px] font-semibold text-[var(--ink-3)]">{tr("hubshell.hm_fcLib", { n: s.cardsAvailable.toLocaleString() })}</span>}
              </>
            );
            const cls = `group grid w-full justify-items-center gap-1.5 rounded-[20px] border p-3 text-center backdrop-blur-sm transition duration-150 motion-reduce:transition-none ${goTo ? `cursor-pointer hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 ${FOCUS}` : ""}`;
            const style = {
              background: "linear-gradient(160deg, color-mix(in srgb, var(--brand-2) 16%, var(--surface)), var(--surface))",
              borderColor: "color-mix(in srgb, var(--brand-2) 24%, var(--line))",
              boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--surface) 60%, white), inset 0 -8px 16px -12px color-mix(in srgb, var(--brand-2) 30%, transparent), 0 10px 22px -16px color-mix(in srgb, var(--brand) 55%, transparent)",
            } as const;
            return (
              <li key={s.childId}>
                {goTo
                  ? <button type="button" aria-label={aria} onClick={() => openChild(s)} className={cls} style={style} data-testid={`fc-ring-${s.childId}`}>{inner}</button>
                  : <div role="group" aria-label={aria} className={cls} style={style} data-testid={`fc-ring-${s.childId}`}>{inner}</div>}
              </li>
            );
          })}
        </ul>
        {students.length > 5 && (
          <button type="button" onClick={() => setAll((v) => !v)} className={`mt-3 min-h-[44px] rounded-lg px-1 text-[12px] font-bold text-[var(--brand)] hover:underline lg:min-h-[40px] ${FOCUS}`}>
            {all ? tr("hublessons.tfShowFewer") : tr("hublessons.tfShowAll", { n: students.length })}
          </button>
        )}
      </div>
    </section>
  );
}
