"use client";

import { useState } from "react";
import { Icon } from "../kit";
import type { MasteryOverall } from "../shared-assess/api";
import { toneAt } from "../shared-assess/format";
import { useGrow, useReducedMotion } from "../shared-assess/motion";
import { display, FOCUS, TAP } from "../shared-assess/ui";
import { bandRanges, type Band } from "./levels";
import { useFamily } from "../family/FamilyContext";
import { kidBand } from "../family/KidMode";

// "Where am I, really?" — the child's REAL attainment level, from GET /mastery
// (`overall`): the band their average mastery falls in against the levels the tutor
// set, a segmented bar of those levels with their position marked, and the gap to the
// next level. It replaces the fun XP / Level-N bar, which measured effort, not level.

export interface SubjectLevel { subject: string; band: string | null; masteryPct: number | null }

interface Props {
  overall: MasteryOverall | null | undefined;
  bands: Band[];
  subjects?: SubjectLevel[];
  /** "hero" sits on the coloured Home banner (white ink); "card" on a normal surface. */
  variant?: "card" | "hero";
  onEmptyAction?: () => void;
  emptyActionLabel?: string;
  /** Skip the wrapper chrome (the parent supplies its own card). */
  bare?: boolean;
  maxSubjects?: number;
}

const EXPLAIN = "This comes from your quiz results measured against the levels your tutor set. It is where you are now, not a game score. It moves as you practise.";
const EXPLAIN_KID = "This shows how well you know things, from your quizzes. It goes up as you practise.";

export function Attainment({ overall, bands, subjects = [], variant = "card", onEmptyAction, emptyActionLabel = "Browse quizzes", bare, maxSubjects = 6 }: Props) {
  const kidMode = useFamily().kid; // kid mode: "My level", not "Attainment"
  const hero = variant === "hero";
  const [why, setWhy] = useState(false);
  const pct = overall?.masteryPct ?? null;
  const has = pct != null && overall != null;
  const lab = (s: string | null | undefined) => kidBand(s, kidMode);
  const ranges = bandRanges(bands);
  const n = ranges.length;
  const cur = has ? Math.max(0, Math.min(n - 1, overall!.bandIndex >= 0 && overall!.bandIndex < n ? overall!.bandIndex : ranges.map((r) => r.from <= pct!).lastIndexOf(true))) : -1;
  const grow = useGrow(has ? Math.min(100, Math.max(0, pct!)) : 0, 120);
  const reduced = useReducedMotion();

  const ink = hero ? "text-white" : "text-[var(--ink)]";
  const soft = hero ? "text-white/75" : "text-[var(--ink-3)]";
  const trackBg = (i: number) => (hero ? "color-mix(in srgb, white 22%, transparent)" : `color-mix(in srgb, ${toneAt(i, n).fill} 20%, var(--surface))`);
  const fillBg = (i: number) => (hero ? "white" : toneAt(i, n).fill);
  const named = subjects.filter((s) => s.band && s.masteryPct != null).slice(0, maxSubjects);

  const valueText = has ? `${lab(overall!.band ?? ranges[cur]?.label)}, ${Math.round(pct!)} percent${kidMode ? "" : " mastery"}${overall!.next && overall!.toNext != null ? `. ${Math.round(overall!.toNext)} percent to reach ${lab(overall!.next.label)}` : ". Top level reached"}` : "No level yet";

  const body = (
    <div data-testid="hub-attainment" data-state={has ? "level" : "empty"}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className={`text-[11px] font-extrabold uppercase tracking-[0.12em] ${hero ? "text-white/70" : "text-[var(--ink-3)]"}`}>{kidMode ? "My level" : "Attainment"}</div>
          {has ? (
            <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
              <span className={`text-[26px] font-extrabold leading-tight sm:text-[30px] ${ink}`} style={display} data-testid="hub-attainment-band">{lab(overall!.band ?? ranges[cur]?.label)}</span>
              <span className={`text-[13px] font-bold tabular-nums ${soft}`}>{Math.round(pct!)}%{kidMode ? "" : " mastery"}</span>
            </div>
          ) : (
            <div className={`mt-0.5 text-[18px] font-extrabold leading-tight ${ink}`} style={display}>Take a quiz to see where you are</div>
          )}
        </div>
        <button type="button" aria-expanded={why} aria-controls="hub-attain-why" aria-label="Where does this level come from?" title={kidMode ? EXPLAIN_KID : EXPLAIN} onClick={() => setWhy((v) => !v)}
          className={`-mr-2 -mt-1.5 grid h-11 w-11 flex-none place-items-center rounded-full ${hero ? "text-white/85 hover:bg-white/15" : "text-[var(--ink-3)] hover:bg-[var(--panel)]"} ${FOCUS}`}><InfoDot /></button>
      </div>
      {why && <p id="hub-attain-why" className={`m-0 mt-1.5 rounded-xl px-3 py-2 text-[12px] leading-relaxed ${hero ? "bg-black/15 text-white/90" : "bg-[var(--panel)] text-[var(--ink-2)]"}`}>{kidMode ? EXPLAIN_KID : EXPLAIN}</p>}

      <div className="mt-3.5">
        <div role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={has ? Math.round(pct!) : undefined} aria-valuetext={valueText} aria-label={kidMode ? "My level" : "Attainment level"} className="relative">
          <div className="flex h-3 gap-[3px]">
            {ranges.map((r, i) => {
              const span = r.to + 1 - r.from;
              const f = has ? Math.min(1, Math.max(0, (grow - r.from) / span)) : 0;
              return (
                <span key={`${r.label}-${r.from}`} className="relative overflow-hidden rounded-full" style={{ flex: `${Math.max(1, span)} 1 0`, background: trackBg(i), minWidth: 8 }}>
                  <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${f * 100}%`, background: fillBg(i), opacity: hero && i !== cur ? 0.7 : 1, transition: reduced ? "none" : "width 700ms cubic-bezier(.2,.8,.2,1)" }} />
                </span>
              );
            })}
          </div>
          {has && (
            <span aria-hidden className="absolute top-1/2 h-[19px] w-[19px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] shadow-[var(--shadow)]" data-testid="hub-attainment-marker"
              style={{ left: `${Math.min(99, Math.max(1, grow))}%`, background: hero ? "var(--brand-strong)" : "var(--surface)", borderColor: hero ? "white" : toneAt(cur, n).fill, transition: reduced ? "none" : "left 700ms cubic-bezier(.2,.8,.2,1)" }} />
          )}
        </div>
        <div className="mt-1.5 flex gap-[3px]" aria-hidden>
          {ranges.map((r, i) => {
            const span = r.to + 1 - r.from;
            const mine = i === cur;
            return (
              <span key={`${r.label}-${r.from}-t`} className="min-w-[8px] overflow-hidden" style={{ flex: `${Math.max(1, span)} 1 0` }}>
                <span className={`block truncate text-[11px] leading-tight ${mine ? `font-extrabold ${ink}` : `font-semibold ${soft}`}`}>{lab(r.label)}</span>
                <span className={`block text-[11px] font-semibold tabular-nums ${soft}`}>{r.from}%</span>
              </span>
            );
          })}
        </div>
      </div>

      <div className="mt-3">
        {has ? (
          overall!.next && overall!.toNext != null ? (
            <p className={`m-0 text-[13px] font-semibold ${hero ? "text-white/90" : "text-[var(--ink-2)]"}`} data-testid="hub-attainment-next"><b className={`tabular-nums ${ink}`}>{Math.round(overall!.toNext)}%</b> to reach <b className={ink}>{lab(overall!.next.label)}</b></p>
          ) : (
            <p className={`m-0 text-[13px] font-extrabold ${ink}`} data-testid="hub-attainment-next">Top level reached. Keep it up.</p>
          )
        ) : (
          <>
            <p className={`m-0 text-[12.5px] leading-snug ${soft}`}>{kidMode ? "Your level shows up here after your first quiz." : "Your level appears here after your first marked quiz, measured against the levels your tutor set."}</p>
            {onEmptyAction && <button type="button" onClick={onEmptyAction} className={`${TAP} mt-2 inline-flex items-center gap-1.5 rounded-full px-4 text-[13px] font-extrabold ${hero ? "bg-white text-[var(--brand-strong)]" : "bg-[var(--brand)] text-white"}`}>{emptyActionLabel}<Icon name="chevronRight" size={14} strokeWidth={2.4} /></button>}
          </>
        )}
      </div>

      {named.length > 0 && (
        <ul className="m-0 mt-3 flex list-none flex-wrap gap-1.5 p-0" aria-label="Level in each subject" data-testid="hub-attainment-subjects">
          {named.map((s) => {
            const idx = ranges.findIndex((r) => r.label === s.band);
            const t = toneAt(Math.max(0, idx), n);
            return (
              <li key={s.subject} className="inline-flex max-w-full items-center gap-1.5 rounded-full py-1 pl-2 pr-2.5 text-[11.5px] font-bold" style={hero ? { background: "color-mix(in srgb, white 16%, transparent)", color: "white" } : { background: "var(--panel)", color: "var(--ink)" }}>
                <span aria-hidden className="h-2 w-2 flex-none rounded-full" style={{ background: hero ? "white" : t.fill }} />
                <span className="truncate">{s.subject}</span>
                <span className={`flex-none ${hero ? "text-white/80" : ""}`} style={hero ? undefined : { color: t.ink }}>{lab(s.band)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  if (bare || hero) return body;
  return <section aria-label={kidMode ? "My level" : "Attainment"} data-ui="card" className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)] sm:p-5">{body}</section>;
}

function InfoDot() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.5v.5" /></svg>
  );
}
