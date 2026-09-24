"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import type { PanelProps } from "../panelTypes";
import { MarkDialog } from "../homework/MarkDialog";
import { MarkForm } from "../quiz/MarkingQueue";
import { timeAgo } from "../shared-assess/format";
import { Avatar, DISPLAY, FOCUS, Pill, Skeleton } from "../teachKit";
import { Ico } from "../teachIcons";
import { KIND_LABEL, type MarkItem, type useMarkItems } from "./useMarkItems";

// R-2 One Mark queue. One list, three kinds, longest-waiting first. A row opens the EXISTING marking UI for that item in place
// (homework: MarkDialog; written quiz / starting-quiz answers: MarkForm) and "Mark & next" / "Save and next" walks straight to the
// next row whatever its kind. The old entry points (Quizzes > Marking, Starting quizzes > Marking, Homework > Inbox) still work.

const TONE = { homework: "brand", quiz: "violet", starting: "violet" } as const;
const wait = (at: string | null) => (at ? timeAgo(at).replace(" ago", "") : "unknown");

export function MarkQueue({ p, q }: { p: PanelProps; q: ReturnType<typeof useMarkItems> }) {
  const { items, ready, reload } = q;
  const [openKey, setOpenKey] = useState<string | null>(null);
  const open = openKey ? items.find((i) => i.key === openKey) ?? null : null;
  // The row after the open one (wrapping to the first other row): read from the list as it stood BEFORE the save reloads it.
  const nextOf = (cur: MarkItem | null): MarkItem | null => { if (!cur) return items[0] ?? null; const i = items.indexOf(cur); return items[i + 1] ?? items.find((x) => x.key !== cur.key) ?? null; };
  const advance = (cur: MarkItem) => { const n = nextOf(cur); reload(); setOpenKey(n && n.key !== cur.key ? n.key : null); };

  if (open?.attempt) {
    return <MarkForm key={open.key} p={p} attemptId={open.id} hasNext={items.length > 1} onBack={() => { setOpenKey(null); reload(); }} onSaved={() => advance(open)} />;
  }
  if (!ready) return <div className="grid gap-2" aria-busy="true" aria-label="Loading the mark queue"><Skeleton className="h-[64px]" /><Skeleton className="h-[64px]" /><Skeleton className="h-[64px]" /></div>;
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--surface)] px-6 py-10 text-center" data-testid="hub-mark-empty">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)]" aria-hidden><Ico name="check" size={24} /></div>
        <div className="mt-1 text-[14.5px] font-extrabold text-[var(--ink)]" style={DISPLAY}>Nothing waiting to be marked</div>
        <p className="mt-1 text-[12.5px] text-[var(--ink-3)]">Hand-ins and written quiz or starting-quiz answers appear here the moment a student submits.</p>
      </div>
    );
  }
  const openHw = open?.hw ?? null;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3" id="hub-mark-queue" data-testid="hub-mark-queue">
      <div className="flex flex-wrap items-center gap-2">
        <p className="m-0 min-w-0 flex-1 basis-[200px] text-[12.5px] text-[var(--ink-3)]">{items.length} waiting, longest first. Homework, quiz answers and starting quizzes, all here.</p>
        {!p.readOnly && <Button variant="solid" className={`min-h-[44px] gap-1.5 ${FOCUS}`} onClick={() => setOpenKey(items[0].key)} data-testid="hub-mark-next">Next to mark <Ico name="arrowRight" size={14} /></Button>}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-2" role="list">
        {items.map((r) => (
          <button key={r.key} type="button" role="listitem" data-testid="hub-mark-row" data-kind={r.kind} onClick={() => setOpenKey(r.key)}
            className={`flex min-h-[64px] w-full items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3.5 text-left shadow-[var(--shadow-sm)] transition duration-200 hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-[var(--shadow)] motion-reduce:transition-none motion-reduce:hover:transform-none ${FOCUS}`}>
            <Avatar name={r.childName} size={40} tone={r.kind === "homework" ? "brand" : "violet"} />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="truncate text-[14px] font-extrabold text-[var(--ink)]">{r.childName}</span>
                <Pill tone={TONE[r.kind]}>{KIND_LABEL[r.kind]}</Pill>
                {r.late && <Pill tone="red">Late</Pill>}
              </span>
              <span className="mt-0.5 block truncate text-[12px] text-[var(--ink-3)]">{r.what}{r.detail ? ` · ${r.detail}` : ""}</span>
            </span>
            <span className="flex-none text-right text-[12px] font-bold tabular-nums text-[var(--ink-2)]"><span className="block text-[10.5px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Waiting</span>{wait(r.at)}</span>
            <Ico name="chevronRight" size={18} className="flex-none text-[var(--ink-3)]" />
          </button>
        ))}
      </div>
      {open && openHw && (
        <MarkDialog key={open.key} row={openHw} readOnly={p.readOnly} hasNext={items.length > 1} qs={p.qs} onClose={() => setOpenKey(null)}
          onMarked={(adv) => { if (adv) advance(open); else { reload(); setOpenKey(null); } }} />
      )}
    </div>
  );
}
