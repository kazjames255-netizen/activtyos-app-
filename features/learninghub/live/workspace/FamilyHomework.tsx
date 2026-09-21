"use client";

import { useMemo } from "react";
import type { PanelProps } from "../../panelTypes";
import { Pill, Skeleton, useNow } from "../../teachKit";
import { Ico } from "../../teachIcons";
import { VideoEmbeds } from "../../videoKit";
import { dueState, pctOf, type StudentHomework } from "../../homework/hwTypes";
import { asArray } from "../../home/homeLib";
import { hubPath } from "../../shared-assess/api";
import { useHubData } from "../../shared-assess/hooks";
import type { Lesson } from "../lessonTypes";
import { WsEmpty, useWsView } from "./wsKit";

// The family workspace's Homework tab: THIS child's homework (never anyone
// else's), read-only — handing in stays on the Homework tab after the lesson.

export function FamilyHomework({ p, lesson }: { p: PanelProps; lesson: Lesson }) {
  const { big } = useWsView();
  const now = useNow(60_000);
  const childId = p.childId ?? lesson.childIds[0] ?? null;
  const r = useHubData<unknown>(childId ? hubPath(p.qs, "/homework", { childId }) : null, ["hubHomework", "hubSubmissions"]);
  const list = useMemo(() => asArray<StudentHomework>(r.data).sort((a, b) => Number(a.submission.status === "marked") - Number(b.submission.status === "marked") || a.dueAt.localeCompare(b.dueAt)), [r.data]);

  if (r.loading && !r.data) return <div className="grid gap-2"><Skeleton className="h-[80px]" /><Skeleton className="h-[80px]" /></div>;
  if (!list.length) return <WsEmpty icon="homework" title="No homework right now" body="When your tutor sets some, it shows up here." />;
  return (
    <div className="grid gap-2.5">
      {list.map((h) => {
        const d = dueState(h.dueAt, h.submission.status, now);
        return (
          <article key={h.id} className="rounded-2xl border border-[var(--hub-warm-line)] bg-[var(--surface)] p-3 shadow-[var(--shadow-sm)]" data-hw={h.id}>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className={`m-0 min-w-0 flex-1 truncate font-extrabold text-[var(--ink)] ${big ? "text-[16px]" : "text-[14px]"}`}>{h.title}</h4>
              <Pill tone={d.tone}>{d.label}</Pill>
            </div>
            {h.instructions && <p className={`m-0 mt-1.5 whitespace-pre-wrap leading-relaxed text-[var(--ink-2)] ${big ? "text-[15px]" : "text-[12.5px]"}`}>{h.instructions}</p>}
            {h.submission.mark && <p className="m-0 mt-1.5 flex items-center gap-1.5 text-[12.5px] font-bold text-[var(--hub-green-ink)]"><Ico name="check" size={14} />Marked: {pctOf(h.submission.mark)}%{h.submission.mark.feedback ? ` — ${h.submission.mark.feedback}` : ""}</p>}
            {(h.videos?.length ?? 0) > 0 && <VideoEmbeds videos={h.videos} heading="Videos" className="mt-2" />}
          </article>
        );
      })}
      <p className="m-0 flex items-center gap-1.5 text-[11.5px] text-[var(--ink-3)]"><Ico name="info" size={13} />Hand in from the Homework tab once the lesson is over.</p>
    </div>
  );
}
