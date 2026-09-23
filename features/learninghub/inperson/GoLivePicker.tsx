"use client";

import { useEffect, useState } from "react";
import { get } from "@/lib/api";
import { Icon } from "../kit";
import { Btn, StepCard, Tag, display } from "../lesson/lessonUi";
import { GroupQuickPick, pruneGroups } from "../groupKit";
import { StudentPicker } from "../teachKit";
import { errMsg, type HubGroup, type Student } from "../types";
import { createSession, type IpSession } from "./api";
import { newKey } from "./inKit";

// The lightweight "who's here?" step used when a tutor's own lesson PREVIEW (NotesPanel.tsx) goes live in person.
// This is the same picker InPersonApp's SetupStep uses (StudentPicker + GroupQuickPick) but skips "what are you
// teaching" — the lesson is already the one open (`noteId`). Confirming here creates the real in-person session
// (the same call InPersonApp makes) and the caller swaps the SAME LessonPlayer instance into live mode.

export function GoLivePicker({ qs, noteId, title, onCancel, onStarted }: {
  qs: string; noteId: string; title: string; onCancel: () => void;
  /** The session was created — swap into live mode. `roster` is every active student (for "someone else turned up" later). */
  onStarted: (session: IpSession, roster: Student[]) => void;
}) {
  const [students, setStudents] = useState<Student[] | null>(null);
  const [groups, setGroups] = useState<HubGroup[]>([]);
  const [childIds, setChildIds] = useState<string[]>([]);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    get<Student[]>(`/api/learning-hub/students${qs}`).then((r) => { if (alive) setStudents(Array.isArray(r) ? r.filter((s) => s.active !== false) : []); })
      .catch((e) => { if (alive) { setStudents([]); setErr(errMsg(e, "Couldn't load your students")); } });
    get<HubGroup[]>(`/api/learning-hub/groups${qs}`).then((r) => { if (alive) setGroups(Array.isArray(r) ? r : []); }).catch(() => undefined);
    return () => { alive = false; };
  }, [qs]);

  const start = async () => {
    if (!childIds.length) { setErr("Choose who's here first"); return; }
    setBusy(true); setErr(null);
    try {
      const s = await createSession(qs, { childIds, groupIds: groupIds.length ? groupIds : undefined, noteId, title, key: newKey() });
      onStarted(s, students ?? []);
    } catch (e) { setErr(errMsg(e, "Couldn't start the session")); }
    finally { setBusy(false); }
  };

  return (
    <StepCard>
      <Tag tone="brand">Teach in person</Tag>
      <h2 className="m-0 mb-1 mt-2 text-[22px] font-extrabold text-[var(--ink)]" style={display} tabIndex={-1} data-autofocus>Who&apos;s here?</h2>
      <p className="m-0 text-[14px] leading-relaxed text-[var(--ink-2)]">Tick who&apos;s with you — you&apos;ll tap in each child&apos;s answers at the quiz and every one of them gets a real result their parent can see.</p>
      {students === null ? (
        <div role="status" aria-label="Loading your students" className="mt-4 h-16 animate-pulse rounded-xl bg-[var(--panel)]" />
      ) : (
        <div className="mt-4 grid gap-3">
          <GroupQuickPick groups={groups} roster={students} childIds={childIds} groupIds={groupIds} onChange={(n) => { setChildIds(n.childIds); setGroupIds(n.groupIds); }} idPrefix="golive-group" />
          <StudentPicker students={students} value={childIds} onChange={(ids) => { setChildIds(ids); setGroupIds((g) => pruneGroups(groups, students, ids, g)); }} idPrefix="golive-student" />
        </div>
      )}
      {err && <p role="alert" className="mt-4 rounded-xl bg-[var(--red-soft)] px-3.5 py-2.5 text-[13.5px] font-semibold text-[var(--red)]">{err}</p>}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Btn tone="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn onClick={() => void start()} disabled={!childIds.length || busy} data-testid="golive-start"><Icon name="users" size={15} />{busy ? "Starting…" : "Start teaching →"}</Btn>
      </div>
    </StepCard>
  );
}
