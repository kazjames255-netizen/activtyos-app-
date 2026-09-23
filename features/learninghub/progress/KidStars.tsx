"use client";

import { useEffect, useState } from "react";
import { get } from "@/lib/api";
import { SubjectTile } from "../subjectArt";
import type { PanelProps } from "../panelTypes";
import { errMsg } from "../types";
import { RetryFace } from "../homework/RetryFace";
import { hubPath } from "../shared-assess/api";
import { EmptyState } from "../shared-assess/ui";

// A child's Progress: stars only (P-03). Child-scoped (the one child kid mode is locked to), read-only, no chat and no
// free text, no percentages, no comparison, no animation. One row per subject with 1 to 3 stars.

interface MasteryLite { subjects?: { subject: string; masteryPct: number | null }[] }

/** 0 to 3 stars from the subject's mastery (3 = 70%+, 2 = 40%+, 1 = started). */
export const starsOf = (pct: number | null | undefined): number => (pct == null || pct <= 0 ? 0 : pct >= 70 ? 3 : pct >= 40 ? 2 : 1);

function Star({ on }: { on: boolean }) {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" aria-hidden focusable="false">
      <path d="M12 2.8l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.6l-5.8 3.1 1.1-6.5L2.6 9.6l6.5-.9z" fill={on ? "var(--gold)" : "none"} stroke={on ? "var(--gold)" : "var(--ink-3)"} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export function KidStars({ p, childId }: { p: PanelProps; childId: string }) {
  const [rows, setRows] = useState<{ subject: string; stars: number }[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    get<MasteryLite>(hubPath(p.qs, "/mastery", { childId }))
      .then((r) => { if (live) { setFailed(false); setRows((r?.subjects ?? []).filter((s) => s.masteryPct != null).map((s) => ({ subject: s.subject, stars: starsOf(s.masteryPct) }))); } })
      .catch((e) => { if (live) { setFailed(true); p.onError(errMsg(e, "Couldn't load your stars")); } });
    return () => { live = false; };
  }, [p.qs, childId, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  if (failed && !rows) return <RetryFace what="your stars" kid onRetry={() => { setFailed(false); setTick((t) => t + 1); }} />;
  if (!rows) return <div role="status" aria-busy="true" aria-label="Loading your stars" className="h-[160px] rounded-3xl bg-[var(--panel)]" />;
  if (rows.length === 0) return <EmptyState icon="chart" title="Your stars are on the way" body="Do a quiz and your first star will shine here." />;
  return (
    <section id="hub-kid-stars" aria-label="My stars" className="grid gap-3">
      <h2 className="m-0 text-[22px] font-extrabold text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>My stars</h2>
      <ul className="m-0 grid list-none gap-3 p-0">
        {rows.map((r) => (
          <li key={r.subject} className="flex min-h-[72px] items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-sm)]" aria-label={`${r.subject}: ${r.stars} of 3 stars`}>
            <SubjectTile subject={r.subject} size={40} />
            <span className="min-w-0 flex-1 truncate text-[18px] font-extrabold text-[var(--ink)]">{r.subject}</span>
            <span className="flex flex-none gap-1">{[1, 2, 3].map((n) => <Star key={n} on={n <= r.stars} />)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
