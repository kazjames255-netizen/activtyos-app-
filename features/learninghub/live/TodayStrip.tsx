"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Topic } from "../types";
import { subjectColor, tint } from "../kit";
import { DISPLAY, FOCUS, fmtDay, humanSpan } from "../teachKit";
import { Ico } from "../teachIcons";
import { Stack } from "../home/homeKit";
import { lessonStage, lessonTiming, type Lesson } from "./lessonTypes";

// "Today" — a horizontal timeline of the day's lessons: hour ruler, one block per
// lesson coloured by its subject, a red marker for "now", student avatar stacks,
// and a small countdown ring for whatever starts next. Scrolls sideways on
// narrow screens and centres on "now" when it opens.

const HOUR = 3_600_000;
const PX = 104; // px per hour
const MIN_BLOCK = 140; // narrowest a block may get, so a 30-minute lesson stays readable
const LANE = 62;
const RULER = 34;

const dayStart = (ms: number) => { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
const hh = (h: number) => `${String(h % 24).padStart(2, "0")}:00`;
const clock = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

function MiniRing({ progress, value }: { progress: number; value: string }) {
  const size = 40, sw = 4, r = size / 2 - sw / 2, c = 2 * Math.PI * r;
  return (
    <span className="relative inline-grid flex-none place-items-center" style={{ width: size, height: size }} aria-hidden>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={sw} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--brand)" strokeWidth={sw} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0.04, Math.min(1, progress)))} className="transition-[stroke-dashoffset] duration-1000 ease-linear motion-reduce:transition-none" />
      </svg>
      <span className="absolute text-[11px] font-extrabold tabular-nums text-[var(--ink)]" style={DISPLAY}>{value}</span>
    </span>
  );
}

export function TodayStrip({ lessons, now, isTutor, topicById, attendeesOf, tutorOf, onOpen }: {
  lessons: Lesson[];
  now: number;
  isTutor: boolean;
  topicById: Map<string, Topic>;
  attendeesOf: (l: Lesson) => string[];
  tutorOf: (l: Lesson) => string;
  onOpen: (l: Lesson) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const centred = useRef(false);

  const day = useMemo(() => {
    const s0 = dayStart(now), s1 = s0 + 24 * HOUR;
    const items = lessons
      .filter((l) => l.status !== "cancelled")
      .map((l) => { const t = lessonTiming(l, now); return { l, start: t.startMs, end: t.endMs }; })
      .filter((x) => x.start < s1 && x.end > s0)
      .sort((a, b) => a.start - b.start);
    if (!items.length) return null;
    const first = Math.min(items[0]!.start, now), last = Math.max(...items.map((i) => i.end), now);
    let from = Math.max(0, Math.floor((first - s0) / HOUR) - 1);
    let to = Math.min(24, Math.ceil((last - s0) / HOUR) + 1);
    if (to - from < 7) { to = Math.min(24, from + 7); from = Math.max(0, to - 7); }
    // lanes: a lesson goes in the first lane whose previous block (at its rendered width) has ended
    const laneEnd: number[] = [];
    const placed = items.map((it) => {
      const w = Math.max(((it.end - it.start) / HOUR) * PX, MIN_BLOCK);
      let lane = laneEnd.findIndex((e) => e <= it.start);
      if (lane < 0) { lane = laneEnd.length; laneEnd.push(0); }
      laneEnd[lane] = it.start + (w / PX) * HOUR;
      return { ...it, lane, left: ((it.start - s0) / HOUR - from) * PX, width: w };
    });
    return { s0, from, to, lanes: laneEnd.length, placed };
  }, [lessons, now]);

  useEffect(() => {
    const el = scroller.current;
    if (!el || !day || centred.current) return;
    centred.current = true;
    const nowX = ((now - day.s0) / HOUR - day.from) * PX;
    el.scrollLeft = Math.max(0, nowX - el.clientWidth * 0.3);
  }, [day, now]);

  if (!day) return null;
  const width = (day.to - day.from) * PX;
  const height = RULER + day.lanes * LANE + 8;
  const nowX = ((now - day.s0) / HOUR - day.from) * PX;
  const next = day.placed.find((p) => p.end > now && ["upcoming", "soon"].includes(lessonStage(p.l, now)));
  const untilNext = next ? next.start - now : null;
  const live = day.placed.filter((p) => lessonStage(p.l, now) === "live");

  return (
    <section aria-label="Today's lessons" id="hub-today-strip" className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3.5 shadow-[var(--shadow-sm)] sm:p-4">
      <div className="mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span aria-hidden className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]"><Ico name="calendar" size={18} /></span>
          <div className="min-w-0">
            <h3 className="m-0 text-[15px] font-extrabold text-[var(--ink)]" style={DISPLAY}>Today</h3>
            <div className="text-[11.5px] font-semibold text-[var(--ink-3)]">{fmtDay(new Date(now).toISOString())} · {day.placed.length} lesson{day.placed.length === 1 ? "" : "s"}</div>
          </div>
        </div>
        <div className="ml-auto flex min-w-0 items-center gap-2.5">
          {live.length > 0 && <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--green-line)] bg-[var(--green-soft)] px-2.5 py-1 text-[11.5px] font-extrabold text-[var(--hub-green-ink)]"><span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--green)] motion-reduce:animate-none" />{live.length} live now</span>}
          {next && untilNext !== null && untilNext < 6 * HOUR && (
            <span className="inline-flex min-w-0 items-center gap-2 rounded-full bg-[var(--panel)] py-1 pl-1 pr-3 text-[12px] font-bold text-[var(--ink-2)]" role="timer" aria-label={`${next.l.title} starts in ${humanSpan(untilNext)}`}>
              <MiniRing progress={1 - untilNext / HOUR} value={untilNext < HOUR ? String(Math.max(1, Math.round(untilNext / 60_000))) : `${Math.round(untilNext / HOUR)}h`} />
              <span className="min-w-0 truncate">{untilNext < HOUR ? "starts in" : "next in"} <b className="text-[var(--ink)]">{humanSpan(untilNext)}</b></span>
            </span>
          )}
        </div>
      </div>

      <div ref={scroller} className="-mx-1 overflow-x-auto px-1 pb-1" tabIndex={0} role="group" aria-label="Timeline of today's lessons, scrolls sideways">
        <div className="relative" style={{ width, height }}>
          {/* hour ruler + grid */}
          {Array.from({ length: day.to - day.from + 1 }, (_, i) => {
            const h = day.from + i;
            return (
              <div key={h} aria-hidden className="absolute bottom-0 top-0 border-l border-[var(--line)]" style={{ left: i * PX }}>
                <span className="absolute left-1.5 top-1 text-[11px] font-bold tabular-nums text-[var(--ink-3)]">{hh(h)}</span>
              </div>
            );
          })}
          <div aria-hidden className="absolute inset-x-0 border-t border-[var(--line)]" style={{ top: RULER - 4 }} />

          {day.placed.map((p) => {
            const topic = p.l.topicId ? topicById.get(p.l.topicId) : undefined;
            const c = topic ? subjectColor(topic.subject) : "var(--brand)";
            const stage = lessonStage(p.l, now);
            const isLive = stage === "live";
            const past = stage === "ended";
            const who = isTutor ? attendeesOf(p.l) : [tutorOf(p.l)];
            return (
              <button key={p.l.id} type="button" onClick={() => onOpen(p.l)} data-strip-lesson={p.l.id} data-stage={stage}
                aria-label={`${p.l.title}, ${clock(p.start)} to ${clock(p.end)}${isLive ? ", live now" : ""}`}
                className={`absolute flex flex-col justify-between overflow-hidden rounded-xl border px-2.5 py-1.5 text-left transition hover:-translate-y-0.5 hover:shadow-[var(--shadow)] motion-reduce:transition-none motion-reduce:hover:transform-none ${FOCUS} ${isLive ? "ring-2 ring-[var(--green)] ring-offset-1 ring-offset-[var(--surface)]" : ""} ${past ? "opacity-60" : ""}`}
                style={{ left: p.left, width: p.width - 4, top: RULER + p.lane * LANE, height: LANE - 6, background: tint(c, 15), borderColor: tint(c, 38), borderLeft: `4px solid ${c}` }}>
                <span className="flex items-center gap-1.5">
                  {isLive && <span aria-hidden className="h-1.5 w-1.5 flex-none animate-pulse rounded-full bg-[var(--green)] motion-reduce:animate-none" />}
                  <span className="truncate text-[12.5px] font-extrabold text-[var(--ink)]">{p.l.title}</span>
                </span>
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--ink-2)]">
                  <span className="tabular-nums">{clock(p.start)}–{clock(p.end)}</span>
                  {who.length > 0 && <span className="ml-auto"><Stack names={who} max={3} size={18} /></span>}
                </span>
              </button>
            );
          })}

          {/* now marker */}
          <div aria-hidden className="pointer-events-none absolute bottom-0 top-0 z-10" style={{ left: nowX }}>
            <div className="absolute -translate-x-1/2 rounded-full bg-[var(--red)] px-1.5 py-px text-[11px] font-extrabold uppercase tracking-wide text-white" style={{ top: 2 }}>{clock(now)}</div>
            <div className="absolute bottom-0 w-[2px] -translate-x-1/2 bg-[var(--red)]" style={{ top: 18 }} />
          </div>
        </div>
      </div>
    </section>
  );
}
