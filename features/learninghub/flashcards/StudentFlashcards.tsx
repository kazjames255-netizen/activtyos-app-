"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { get } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import type { PanelProps } from "../panelTypes";
import { errMsg } from "../types";
import { DISPLAY, EmptyState, FOCUS, HERO_BG, Skeleton, useCountUp, withQs } from "../teachKit";
import { GradientTile, Ico } from "../teachIcons";
import { subjectColor } from "../kit";
import { StackedCards } from "./StackedCards";
import { ChildChip, useChildGate, WhoIsLearning } from "../family/FamilyContext";
import { ReviewSession } from "./ReviewSession";
import type { DueResponse, QueueCard } from "./fcTypes";

// Student flashcards: today's review queue (due first, then new), a start
// screen with honest counts, then the session.

export function StudentFlashcards({ qs, childId, filter, covered, students, topics, onError, setFocus }: PanelProps) {
  const [data, setData] = useState<DueResponse | null>(null);
  const [session, setSession] = useState<QueueCard[] | null>(null);
  const inSession = useRef(false);
  const gate = useChildGate(childId);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { inSession.current = !!session; }, [session]);

  // A review is a focus moment: the shell drops its hero + sidebar, and ALWAYS gets them back.
  const focusRef = useRef(setFocus);
  useEffect(() => { focusRef.current = setFocus; });
  const reviewing = !!session;
  useEffect(() => {
    if (!reviewing) return;
    focusRef.current?.(true);
    return () => focusRef.current?.(false);
  }, [reviewing]);

  const path = `/api/learning-hub/flashcards/due${withQs(qs, { childId, topicId: filter.topicId })}`;
  const load = useCallback(() => {
    if (!childId) { setData({ due: [], dueCount: 0, newCount: 0, upcoming: 0 }); return; }
    get<DueResponse>(path).then((r) => { if (mounted.current) setData(r); })
      .catch((e) => { if (mounted.current) { setData((c) => c ?? { due: [], dueCount: 0, newCount: 0, upcoming: 0 }); onError(errMsg(e, "Couldn't load your flashcards")); } });
  }, [path, childId, onError]);
  useEffect(() => { setData(null); setSession(null); load(); }, [load]);
  // Don't yank the queue out from under a running session.
  useRealtime(["hubFlashcards"], () => { if (!inSession.current) load(); });

  // A subject (no single topic) is narrowed client-side — the server takes a topic.
  const queue = useMemo(() => {
    if (!data) return [];
    return filter.subject && !filter.topicId ? data.due.filter((c) => covered.has(c.topicId)) : data.due;
  }, [data, filter, covered]);
  const dueNow = queue.filter((c) => !c.isNew).length;
  const fresh = queue.length - dueNow;
  const child = students.find((s) => s.childId === childId)?.childName ?? "";
  const shownCount = useCountUp(queue.length, 700);
  // Which topics today's cards come from (largest first).
  const breakdown = useMemo(() => {
    const byId = new Map(topics.map((t) => [t.id, t]));
    const m = new Map<string, { label: string; subject: string; n: number }>();
    for (const c of queue) {
      const t = byId.get(c.topicId);
      const key = t ? t.id : "other";
      const cur = m.get(key) ?? { label: t ? (t.subtopic ?? t.topic) : "Other", subject: t?.subject ?? "Other", n: 0 };
      cur.n++;
      m.set(key, cur);
    }
    return [...m.values()].sort((a, b) => b.n - a.n);
  }, [queue, topics]);

  if (data === null) return <div className="grid gap-3" aria-busy="true" aria-label="Loading flashcards"><Skeleton className="h-[260px] rounded-3xl" /><Skeleton className="h-[44px]" /></div>;

  if (session) {
    return <ReviewSession cards={session} qs={qs} childId={childId} onError={onError} onFinished={(again) => { setSession(null); setData(null); load(); if (!again) { /* stay on the start screen */ } }} />;
  }

  const nothingAtAll = data.dueCount + data.newCount + data.upcoming === 0;
  if (nothingAtAll || (queue.length === 0 && data.upcoming === 0)) {
    return <EmptyState icon={<Ico name="cards" size={26} />} title="No flashcards yet" body={`Your tutor hasn't published any cards${filter.topicId || filter.subject ? " for this topic" : ""} yet. When they do, they'll show up here for a quick daily review.`} />;
  }

  if (queue.length === 0) {
    return (
      <section className="overflow-hidden rounded-3xl p-7 text-center text-white shadow-[var(--shadow)] sm:p-9" style={HERO_BG} data-testid="hub-fc-caughtup">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white/18" aria-hidden><Ico name="check" size={32} strokeWidth={2.6} /></div>
        <h2 className="mt-1 text-[24px] font-extrabold" style={DISPLAY}>You&rsquo;re all caught up</h2>
        <p className="mx-auto mt-1.5 max-w-[420px] text-[14px] text-white/85">Nothing due today{child ? `, ${child}` : ""}. {data.upcoming} card{data.upcoming === 1 ? " is" : "s are"} scheduled to come back soon — the app will bring them up exactly when it&rsquo;s time to revise.</p>
      </section>
    );
  }

  const mins = Math.max(1, Math.round(queue.length * 0.4));
  const onlyNew = dueNow === 0 && fresh > 0;
  const pill = "inline-flex items-center gap-1.5 rounded-full bg-white/18 px-3 py-1";
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4" id="hub-flashcards">
      <div className="flex items-center gap-3">
        <GradientTile icon="cards" size={44} />
        <div>
          <h2 className="m-0 text-[19px] font-extrabold text-[var(--ink)]" style={DISPLAY}>Flashcards</h2>
          <p className="text-[12.5px] text-[var(--ink-3)]">A little every day beats a lot once — cards you find hard come back sooner.</p>
        </div>
      </div>
      <section className="relative overflow-hidden rounded-3xl p-6 text-white shadow-[var(--shadow)] sm:p-8" style={HERO_BG} data-testid="hub-fc-start">
        <div className="relative grid items-center gap-x-8 gap-y-5 md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/70">Today&rsquo;s review</div>
            <div className="mt-2 flex flex-wrap items-end gap-x-5 gap-y-2">
              <div><span className="text-[58px] font-extrabold leading-none tabular-nums" style={DISPLAY}><span className="sr-only">{queue.length}</span><span aria-hidden>{shownCount}</span></span> <span className="text-[15px] font-bold text-white/80">card{queue.length === 1 ? "" : "s"} to review</span></div>
              <div className="flex flex-wrap gap-2 pb-1.5 text-[12.5px] font-bold">
                {dueNow > 0 && fresh > 0 && <span className={pill}><Ico name="refresh" size={13} />{dueNow} due back</span>}
                {dueNow > 0 && fresh > 0 && <span className={pill}><Ico name="sparkle" size={13} />{fresh} new</span>}
                {onlyNew && <span className={pill}><Ico name="sparkle" size={13} />First time seeing these</span>}
                <span className={pill}><Ico name="clock" size={13} />about {mins} min</span>
              </div>
            </div>
            {breakdown.length > 0 && (
              <div className="mt-4" aria-label="Topics in today's review">
                <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-white/65">What&rsquo;s in it</div>
                <ul className="flex flex-wrap gap-1.5">
                  {breakdown.slice(0, 5).map((b) => (
                    <li key={b.label + b.subject} className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/20 bg-white/10 py-1 pl-2 pr-1 text-[12px] font-bold">
                      <span aria-hidden className="h-2 w-2 flex-none rounded-full" style={{ background: subjectColor(b.subject), boxShadow: "0 0 0 1.5px rgba(255,255,255,.7)" }} />
                      <span className="truncate">{b.label}</span>
                      <span className="rounded-full bg-white/20 px-2 py-px text-[11px] tabular-nums">{b.n}</span>
                    </li>
                  ))}
                  {breakdown.length > 5 && <li className="inline-flex items-center px-1.5 text-[12px] font-bold text-white/75">+{breakdown.length - 5} more</li>}
                </ul>
              </div>
            )}
            {data.dueCount + data.newCount > queue.length && !filter.subject && <p className="mt-3 text-[12px] text-white/75">{data.dueCount + data.newCount} in total — we&rsquo;ll do {queue.length} at a time.</p>}
            <div className="mt-5"><WhoIsLearning childId={childId} tone="dark" /></div>
            <button type="button" id="hub-fc-start" disabled={!gate.ok} onClick={() => { if (gate.ok) setSession(queue); }}
              className={`inline-flex min-h-[54px] items-center gap-2.5 rounded-2xl bg-white px-7 text-[15px] font-extrabold text-[var(--brand-strong)] shadow-[0_8px_24px_rgba(0,0,0,0.25)] transition disabled:opacity-50 hover:-translate-y-px active:scale-[.98] motion-reduce:transition-none ${FOCUS}`}>
              <Ico name="play" size={16} />Start review
            </button>
            <p className="mt-2.5 hidden text-[11.5px] text-white/70 sm:block">Space flips the card · 1 Again · 2 Hard · 3 Good · 4 Easy</p>
          </div>
          <StackedCards className="mx-auto hidden h-[168px] w-[210px] md:block" />
        </div>
      </section>
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-[var(--ink-3)]">
        {data.upcoming > 0 && <span className="inline-flex items-center gap-1.5"><Ico name="calendar" size={14} />{data.upcoming} more card{data.upcoming === 1 ? "" : "s"} scheduled for later.</span>}
        <Button variant="ghost" className={`ml-auto min-h-[44px] gap-1.5 ${FOCUS}`} onClick={() => { setData(null); load(); }}><Ico name="refresh" size={14} />Refresh</Button>
      </div>
    </div>
  );
}
