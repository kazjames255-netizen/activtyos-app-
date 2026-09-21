"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Dialog, FOCUS, useNow } from "../../teachKit";
import { BIcon } from "./boardIcons";
import { MiniCanvas } from "./MiniCanvas";
import { newPadState, type PadHub, type PadInfo } from "./pads";
import { ImageCache, type Paper } from "./render";
import type { Attendee } from "./StudentsPop";

// The tutor's "Student work" view: a grid of MINI LIVE BOARDS, one per student —
// each student's private pad, updating as they write. Per tile: name, a "writing…"
// dot, time since their last stroke, Done ✓. Open one to enlarge it and mark over
// it in red; "Show to class" puts it on the main board (read-only); "Send back"
// takes it off again. "Set a question" writes the same question at the top of every
// chosen pad; "Compare answers" lays the pads out side by side.

const ago = (ms: number) => { const s = Math.round(ms / 1000); return s < 5 ? "just now" : s < 60 ? `${s}s ago` : `${Math.round(s / 60)} min ago`; };

export function WorkView({ leading, hub, attendees, present, shown, paper, compare, onCompare, onOpen, onShow, onSendBack, onlyOnBoard, selected, onSelect, onQuestion, onSaveAll }: {
  leading?: React.ReactNode;
  hub: PadHub; attendees: Attendee[]; present: Set<string>; shown: (a: Attendee, i: number) => string;
  paper: Paper; compare: boolean; onCompare: (on: boolean) => void;
  onOpen: (cid: string) => void; onShow: (cid: string) => void; onSendBack: (cid: string) => void;
  /** childIds whose pad is currently a page on the main board. */
  onlyOnBoard: Set<string>;
  selected: Set<string>; onSelect: (s: Set<string>) => void;
  onQuestion: () => void; onSaveAll?: () => void;
}) {
  const ver = useSyncExternalStore(hub.subscribe, () => hub.version, () => 0);
  const now = useNow(1000);
  const [imgV, setImgV] = useState(0);
  const images = useMemo(() => new ImageCache(() => setImgV((n) => n + 1)), []);
  // only students who are here or have something on their pad are worth a tile (up to 30, but ~12 is the design size)
  const rows = attendees.map((a, i) => ({ a, i, pad: hub.pads.get(a.childId) })).filter((r) => present.has(r.a.childId) || (r.pad && (r.pad.state.pages[0]!.els.size > 0 || r.pad.done)));
  const done = rows.filter((r) => r.pad?.done).length;
  useEffect(() => { /* keep the selection sensible as students come and go */
    const ids = new Set(rows.map((r) => r.a.childId));
    if ([...selected].some((s) => !ids.has(s))) onSelect(new Set([...selected].filter((s) => ids.has(s))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length]);
  const tileW = compare ? 420 : 260, tileH = Math.round(tileW * 0.64);

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="student-work" style={{ background: "var(--hub-warm)" }}>
      <div className="flex flex-none flex-wrap items-center gap-2 border-b border-[var(--hub-warm-line)] px-2 py-2">
        {leading}
        <div className="min-w-0 flex-1 basis-[160px]">
          <div className="text-[14px] font-extrabold text-[var(--ink)]">Student work</div>
          <div className="text-[11.5px] text-[var(--ink-3)]" data-testid="work-summary">{rows.length ? `${done} of ${rows.length} done · updating live` : "Nobody's here yet"}</div>
        </div>
        <button type="button" data-action="set-question" onClick={onQuestion} disabled={!rows.length} className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-transparent px-3.5 text-[13px] font-extrabold text-white disabled:opacity-50 ${FOCUS}`} style={{ background: "linear-gradient(180deg, var(--brand-2), var(--brand))" }}><BIcon name="text" size={17} />Set a question</button>
        <button type="button" data-action="compare" aria-pressed={compare} onClick={() => onCompare(!compare)} className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3 text-[13px] font-extrabold ${FOCUS} ${compare ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "border-[var(--hub-warm-line)] bg-[var(--surface)] text-[var(--ink-2)] hover:border-[var(--brand)]"}`}><BIcon name="pages" size={17} />Compare answers</button>
        {onSaveAll && <button type="button" data-action="save-all-work" onClick={onSaveAll} disabled={!rows.length} className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[var(--hub-warm-line)] bg-[var(--surface)] px-3 text-[13px] font-extrabold text-[var(--ink-2)] hover:border-[var(--brand)] disabled:opacity-50 ${FOCUS}`}><BIcon name="save" size={17} />Save all to lessons</button>}
        {rows.length > 1 && (
          <button type="button" onClick={() => onSelect(selected.size === rows.length ? new Set() : new Set(rows.map((r) => r.a.childId)))} className={`inline-flex min-h-[44px] items-center rounded-xl px-3 text-[12.5px] font-bold text-[var(--brand)] hover:bg-[var(--brand-soft)] ${FOCUS}`}>{selected.size === rows.length ? "Clear selection" : "Select all"}</button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {!rows.length ? (
          <div className="mx-auto mt-10 max-w-[340px] rounded-2xl border border-dashed border-[var(--hub-warm-line)] px-4 py-8 text-center">
            <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]" aria-hidden><BIcon name="pages" size={22} /></div>
            <div className="mt-2 text-[14px] font-extrabold text-[var(--ink)]">Waiting for students</div>
            <p className="m-0 mt-1 text-[12.5px] leading-relaxed text-[var(--ink-3)]">When students join, each one gets a private page to write and show their working. You&apos;ll see it here as they go.</p>
          </div>
        ) : (
          <ul className="m-0 grid list-none gap-3 p-0" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${tileW}px, 1fr))` }} data-imgv={imgV} data-ver={ver}>
            {rows.map(({ a, i, pad }) => (
              <Tile key={a.childId} a={a} name={shown(a, i)} pad={pad} here={present.has(a.childId)} now={now} paper={paper} images={images} version={(pad?.v ?? 0) + imgV} w={tileW} h={tileH}
                selected={selected.has(a.childId)} onSelect={(on) => { const s = new Set(selected); if (on) s.add(a.childId); else s.delete(a.childId); onSelect(s); }}
                onBoard={onlyOnBoard.has(a.childId)} onOpen={() => onOpen(a.childId)} onShow={() => onShow(a.childId)} onSendBack={() => onSendBack(a.childId)} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Tile({ a, name, pad, here, now, paper, images, version, w, h, selected, onSelect, onBoard, onOpen, onShow, onSendBack }: {
  a: Attendee; name: string; pad: PadInfo | undefined; here: boolean; now: number; paper: Paper; images: ImageCache; version: number; w: number; h: number;
  selected: boolean; onSelect: (on: boolean) => void; onBoard: boolean; onOpen: () => void; onShow: () => void; onSendBack: () => void;
}) {
  const writing = !!pad && pad.lastStrokeAt > 0 && now - pad.lastStrokeAt < 2500;
  const idle = pad && pad.lastStrokeAt > 0 ? ago(now - pad.lastStrokeAt) : "no writing yet";
  const empty = !pad || pad.state.pages[0]!.els.size === 0;
  return (
    <li data-testid="pad-tile" data-student={a.childId} data-done={pad?.done ? "1" : "0"} data-writing={writing ? "1" : "0"} className={`flex flex-col rounded-2xl border bg-[var(--surface)] p-2.5 shadow-[var(--shadow-sm)] ${selected ? "border-[var(--brand)]" : "border-[var(--hub-warm-line)]"} ${here ? "" : "opacity-70"}`}>
      <div className="mb-2 flex items-center gap-2">
        <label className="grid h-11 w-8 flex-none cursor-pointer place-items-center" title={`Include ${name} when setting a question`}>
          <input type="checkbox" checked={selected} onChange={(e) => onSelect(e.target.checked)} aria-label={`Include ${name}`} className="h-4 w-4 accent-[var(--brand)]" />
        </label>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[14px] font-extrabold text-[var(--ink)]" data-testid="pad-name">{name}</span>
            {writing && <span className="inline-flex items-center gap-1 rounded-full bg-[var(--green-soft)] px-2 py-px text-[11px] font-extrabold text-[var(--hub-green-ink)]" data-testid="pad-writing"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--green)] motion-reduce:animate-none" />writing…</span>}
          </div>
          <div className="text-[11.5px] text-[var(--ink-3)]">{here ? idle : "not in the call"}</div>
        </div>
        {pad?.done && <span className="inline-flex items-center gap-1 rounded-full bg-[var(--green)] px-2.5 py-1 text-[11.5px] font-extrabold text-white" data-testid="pad-done"><BIcon name="check" size={13} sw={2.6} />Done</span>}
      </div>
      <button type="button" onClick={onOpen} aria-label={`Open ${name}'s page`} data-action="open-pad" className={`relative block overflow-hidden rounded-xl border border-[var(--hub-warm-line)] ${FOCUS}`} style={{ width: "100%" }}>
        <div className="flex justify-center bg-[var(--surface)]"><MiniCanvas state={pad?.state ?? EMPTY_STATE} version={version} paper={paper} images={images} w={w - 24} h={h - 12} label={`${name}'s working`} /></div>
        {empty && <span className="absolute inset-0 grid place-items-center text-[12px] font-bold text-[var(--ink-3)]">Nothing written yet</span>}
      </button>
      <div className="mt-2 flex gap-1.5">
        <button type="button" data-action="open-pad" onClick={onOpen} className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--hub-warm-line)] px-2 text-[12.5px] font-extrabold text-[var(--ink-2)] hover:border-[var(--brand)] hover:text-[var(--brand)] ${FOCUS}`}><BIcon name="pen" size={16} />Open &amp; mark</button>
        {onBoard
          ? <button type="button" data-action="send-back" onClick={onSendBack} className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--gold-line)] bg-[var(--gold-soft)] px-2 text-[12.5px] font-extrabold text-[var(--ink)] ${FOCUS}`}>Send back</button>
          : <button type="button" data-action="show-to-class" onClick={onShow} disabled={empty} className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--brand-line)] bg-[var(--brand-soft)] px-2 text-[12.5px] font-extrabold text-[var(--brand-strong)] disabled:opacity-50 ${FOCUS}`}><BIcon name="present" size={16} />Show to class</button>}
      </div>
    </li>
  );
}
const EMPTY_STATE = newPadState();
