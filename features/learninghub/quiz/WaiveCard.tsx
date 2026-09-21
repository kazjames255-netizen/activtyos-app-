"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";
import { post } from "@/lib/api";
import { Icon } from "../kit";
import type { PanelProps } from "../panelTypes";
import { errMsg } from "../types";
import { hubPath } from "../shared-assess/api";
import { display, Modal, Notice, TAP } from "../shared-assess/ui";

const SEL = "min-h-[44px] w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-[13.5px] text-[var(--ink)] outline-none focus:border-[var(--brand)]";

/** Let a tutor skip the placement test for one student in one subject — a labelled
 *  form with a plain-English explanation and a confirm step. */
export function WaiveCard({ p, diagSubjects }: { p: PanelProps; /** Subjects that have a placement test (the list's subject facet). */ diagSubjects: string[] }) {
  const subjects = [...new Set([...p.topics.map((t) => t.subject), ...diagSubjects])].sort();
  const [childId, setChildId] = useState("");
  const [subject, setSubject] = useState("");
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const active = p.students.filter((s) => s.active !== false);
  if (!active.length || !subjects.length) return null;
  const name = active.find((s) => s.childId === childId)?.childName ?? "this student";
  const ready = !!childId && !!subject;

  const go = async () => {
    setBusy(true); setDone(null);
    try {
      await post(hubPath(p.qs, `/students/${childId}/diagnostic-waive`), { subject });
      setDone(`${name} no longer needs the ${subject} placement test.`);
      setAsk(false); setChildId(""); setSubject("");
    } catch (e) { setAsk(false); p.onError(errMsg(e, "Couldn't waive the placement test")); }
    finally { setBusy(false); }
  };

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-8">
        <div className="flex min-w-0 flex-1 gap-3.5">
          <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-[var(--gold-soft)]" style={{ color: "color-mix(in srgb, var(--gold) 35%, var(--ink))" }} aria-hidden><Icon name="play" size={20} /></span>
          <div className="min-w-0">
            <h4 className="m-0 text-[15px] font-extrabold text-[var(--ink)]" style={display}>Waive the placement test</h4>
            <p className="m-0 mt-1 text-[12.5px] leading-relaxed text-[var(--ink-2)]">For a student whose level you already know. Their quizzes in that subject unlock straight away, without a baseline. Growth is then measured from their first quiz.</p>
          </div>
        </div>
        <div className="w-full flex-none lg:w-[420px]">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]">Student
              <select value={childId} onChange={(e) => setChildId(e.target.value)} className={`${SEL} normal-case tracking-normal font-semibold`}><option value="">Choose a student</option>{active.map((s) => <option key={s.childId} value={s.childId}>{s.childName}</option>)}</select>
            </label>
            <label className="grid gap-1 text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]">Subject
              <select value={subject} onChange={(e) => setSubject(e.target.value)} className={`${SEL} normal-case tracking-normal font-semibold`}><option value="">Choose a subject</option>{subjects.map((s) => <option key={s} value={s}>{s}</option>)}</select>
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button variant="solid" className={`${TAP} !px-5`} disabled={!ready || busy} onClick={() => setAsk(true)}>Waive placement test</Button>
            {!ready && <span className="text-[12px] text-[var(--ink-3)]">Choose a student and a subject to continue.</span>}
          </div>
        </div>
      </div>
      {done && <div className="mt-3"><Notice tone="ok" onDismiss={() => setDone(null)}>{done}</Notice></div>}
      {ask && (
        <Modal title="Waive this placement test?" onClose={() => setAsk(false)}
          footer={<><Button variant="ghost" className={TAP} onClick={() => setAsk(false)}>Cancel</Button><Button variant="solid" className={TAP} disabled={busy} onClick={go} data-autofocus>{busy ? "Working…" : "Yes, waive it"}</Button></>}>
          <p className="m-0 text-[14px] leading-relaxed text-[var(--ink-2)]"><b className="text-[var(--ink)]">{name}</b> will be able to take {subject} quizzes without sitting the placement test first, and won&apos;t have a baseline for that subject.</p>
        </Modal>
      )}
    </Card>
  );
}
