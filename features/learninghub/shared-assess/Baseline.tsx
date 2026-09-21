"use client";

import type { PanelProps } from "../panelTypes";
import { topicShort } from "./format";
import { hubPath, type Mastery } from "./api";
import { useHubData } from "./hooks";
import { display, Meter, Skeleton } from "./ui";
import { useFamily } from "../family/FamilyContext";

// The placement-test result's extra: the baseline the server recorded for each
// topic of this subject ("this is where you're starting from"). Read-only.
export function BaselineCard({ p, childId, subject }: { p: PanelProps; childId: string; subject: string }) {
  const kid = useFamily().kid;
  const { data, loading } = useHubData<Mastery>(hubPath(p.qs, "/mastery", { childId }), ["hubMastery"]);
  if (loading && !data) return <Skeleton className="h-[120px] rounded-2xl" />;
  const s = data?.subjects.find((x) => x.subject === subject);
  const topics = (s?.topics ?? []).filter((t) => t.baselinePct != null);
  if (!s || (s.baselinePct == null && topics.length === 0)) return null;
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]" data-testid="hub-baseline">
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="m-0 text-[14px] font-extrabold text-[var(--ink)]" style={display}>Your starting point in {subject}</h4>
        {s.baselinePct != null && <span className="text-[20px] font-extrabold tabular-nums text-[var(--brand)]" style={display}>{Math.round(s.baselinePct)}%</span>}
      </div>
      <p className="m-0 mt-0.5 text-[12.5px] text-[var(--ink-3)]">{kid ? "Every quiz you do from now on shows how far you have grown." : "Your Progress tab will show how far you grow from here."}</p>
      <ul className="m-0 mt-3 grid list-none gap-2.5 p-0">
        {topics.map((t) => (
          <li key={t.topicId}>
            <div className="mb-1 flex justify-between gap-3 text-[12.5px]"><span className="min-w-0 truncate font-bold text-[var(--ink)]">{topicShort({ subject, topic: t.topic, subtopic: t.subtopic })}</span><span className="font-semibold tabular-nums text-[var(--ink-3)]">{Math.round(t.baselinePct!)}%</span></div>
            <Meter pct={t.baselinePct!} tone={{ fill: "var(--brand)", soft: "var(--brand-soft)", ink: "var(--brand-strong)" }} label={`${t.topic} starting point`} />
          </li>
        ))}
      </ul>
    </section>
  );
}
