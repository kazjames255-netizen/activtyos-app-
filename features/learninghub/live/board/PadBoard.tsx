"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { FOCUS } from "../../teachKit";
import { BIcon } from "./boardIcons";
import { BoardShell } from "./BoardShell";
import { useCtrl } from "./BoardUi";
import { BoardController } from "./controller";
import type { PadHub } from "./pads";
import { PadOutbox } from "./pads";
import type { Paper } from "./render";
import type { BoardLink } from "./sync";

// One student's private page. The student sees and writes on their own (plus the
// tutor's question and marks); the tutor opens any student's to enlarge it and mark
// over it in red. Same board shell as the main board.

export function PadBoard({ hub, cid, name, role, linkRef, paper, palette, active, onBack, extraRight, hideName, leading }: {
  hub: PadHub; cid: string; name: string; role: "student" | "tutor"; linkRef: { current: BoardLink | null };
  paper: Paper; palette: string[]; active: boolean; onBack?: () => void; extraRight?: React.ReactNode; hideName?: boolean; leading?: React.ReactNode;
}) {
  const pad = hub.pad(cid, name);
  const ctrl = useMemo(() => {
    const isTutor = role === "tutor";
    const c = new BoardController({
      isTutor, padMode: true, readOnlyBoard: false, state: pad.state,
      self: isTutor ? { tutor: true, own: "T", name: "Tutor" } : { tutor: false, own: `c:${cid}`, by: name, cid, name },
    });
    c.setPaper(paper, palette);
    if (isTutor) c.setUi({ colour: paper.danger, penSize: 6 }); // marks over a student's work stand out in red
    c.out = new PadOutbox(() => linkRef.current, () => (isTutor ? linkRef.current?.peerByCid(cid)?.id : linkRef.current?.tutorPeer()?.id), () => hub.touch(cid));
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cid, role, hub]);
  // the other end writing to this pad (the student, or the tutor's marks) repaints it
  useEffect(() => hub.subscribe(() => ctrl.notify()), [hub, ctrl]);
  const ver = useSyncExternalStore(hub.subscribe, () => hub.version, () => 0); void ver;
  useCtrl(ctrl);
  const [busyDone, setBusyDone] = useState(false);
  const done = pad.done;

  return (
    <div className="h-full" data-testid="pad-board" data-role={role} data-elements={ctrl.curPage.els.size} data-can-draw="1">
    <BoardShell ctrl={ctrl} active={active} label={role === "student" ? "Your private page. Your tutor can see it; other students can't." : `${hideName ? "Student" : name}'s private page`}
      empty={role === "student" ? "This page is just for you and your tutor. Write your working out here." : undefined}
      topLeft={<>{leading}{role === "tutor" ? (
        <div className="flex items-center gap-1.5 rounded-2xl border border-[var(--hub-warm-line)] bg-[var(--surface)] p-1 shadow-[var(--shadow)]">
          <button type="button" data-action="back-to-work" onClick={onBack} className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-[13px] font-extrabold text-[var(--ink-2)] hover:bg-[var(--brand-soft)] ${FOCUS}`}><BIcon name="chevron" size={16} className="rotate-90" />All students</button>
          <span className="truncate pr-2 text-[13.5px] font-extrabold text-[var(--ink)]" data-testid="pad-title">{name}</span>
          {done && <span className="mr-1 inline-flex items-center gap-1 rounded-full bg-[var(--green)] px-2.5 py-1 text-[11.5px] font-extrabold text-white"><BIcon name="check" size={13} sw={2.6} />Done</span>}
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--hub-warm-line)] bg-[var(--surface)] px-3 py-2 text-[12.5px] font-bold text-[var(--ink-2)] shadow-[var(--shadow)]"><BIcon name="lock" size={14} className="mr-1.5 inline align-[-2px]" />Private — only you and your tutor</div>
      )}</>}
      topRight={() => (
        <>
          {extraRight}
          {role === "student" && (
            <button type="button" data-action="pad-done" aria-pressed={done} disabled={busyDone} onClick={() => { setBusyDone(true); hub.setDone(linkRef.current, !done); setTimeout(() => setBusyDone(false), 400); }}
              className={`inline-flex min-h-[52px] items-center gap-1.5 rounded-2xl border px-4 text-[14px] font-extrabold shadow-[var(--shadow)] ${FOCUS} ${done ? "border-[var(--green)] bg-[var(--green)] text-white" : "border-[var(--hub-warm-line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--green)]"}`}>
              <BIcon name="check" size={17} sw={2.6} />{done ? "Done — tap to undo" : "I'm done"}
            </button>
          )}
        </>
      )}
      statusPill={<span className="inline-flex min-h-[28px] items-center gap-1.5 rounded-full border border-[var(--hub-warm-line)] bg-[var(--surface)] px-2.5 text-[11.5px] font-bold text-[var(--ink-3)]">{role === "tutor" ? "Marking in red · the student sees your marks" : "Your tutor sees this as you write"}</span>}
    />
    </div>
  );
}
