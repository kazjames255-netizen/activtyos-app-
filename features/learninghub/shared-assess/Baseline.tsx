"use client";

import type { PanelProps } from "../panelTypes";
import { topicShort } from "./format";
import { hubPath, type Mastery } from "./api";
import { useHubData } from "./hooks";
import { display, Meter, Skeleton } from "./ui";
import { useFamily } from "../family/FamilyContext";
import { useT } from "@/lib/i18n/provider";

// The placement-test result's extra: the baseline the server recorded for each
// topic of this subject ("this is where you're starting from"). Read-only.
export function BaselineCard({ p, childId, subject }: { p: PanelProps; childId: string; subject: string }) {
  const t = useT();
  const kid = useFamily().kid;
  const { data, loading } = useHubData<Mastery>(hubPath(p.qs, "/mastery", { childId }), ["hubMastery"]);
  if (loading && !data) return <Skeleton className="h-[120px] rounded-2xl" />;
  const s = data?.subjects.find((x) => x.subject === subject);
  const topics = (s?.topics ?? []).filter((x) => x.baselinePct != null);
  if (!s || (s.baselinePct == null && topics.length === 0)) return null;
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]" data-testid="hub-baseline">
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="m-0 text-[14px] font-extrabold text-[var(--ink)]" style={display}>{t("hubfam.asStartingPointIn", { subject })}</h4>
        {s.baselinePct != null && <span className="text-[20px] font-extrabold tabular-nums text-[var(--brand)]" style={display}>{Math.round(s.baselinePct)}%</span>}
      </div>
      <p className="m-0 mt-0.5 text-[12.5px] text-[var(--ink-3)]">{kid ? t("hubfam.asBaselineKid") : t("hubfam.asBaselineParent")}</p>
      <ul className="m-0 mt-3 grid list-none gap-2.5 p-0">
        {topics.map((x) => (
          <li key={x.topicId}>
            <div className="mb-1 flex justify-between gap-3 text-[12.5px]"><span className="min-w-0 truncate font-bold text-[var(--ink)]">{topicShort({ subject, topic: x.topic, subtopic: x.subtopic })}</span><span className="font-semibold tabular-nums text-[var(--ink-3)]">{Math.round(x.baselinePct!)}%</span></div>
            <Meter pct={x.baselinePct!} tone={{ fill: "var(--brand)", soft: "var(--brand-soft)", ink: "var(--brand-strong)" }} label={t("hubfam.asTopicStart", { topic: x.topic })} />
          </li>
        ))}
      </ul>
    </section>
  );
}
