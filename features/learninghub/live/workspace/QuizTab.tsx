"use client";

import { useEffect, useMemo, useState } from "react";
import type { PanelProps } from "../../panelTypes";
import { FOCUS, Pill, Skeleton } from "../../teachKit";
import { Ico } from "../../teachIcons";
import { HomeworkForm } from "../../homework/HomeworkForm";
import { get } from "@/lib/api";
import { hubPath, type Assessment, type Question } from "../../shared-assess/api";
import { useHubData } from "../../shared-assess/hooks";
import type { AttemptRow } from "../../home/homeLib";
import type { Lesson } from "../lessonTypes";
import { WsButton, WsEmpty, useShownName, useWsView, type Attendee } from "./wsKit";
import type { WsData } from "./useWorkspaceData";
import { lessonSubject } from "./wsLib";

// "Quiz" — the quizzes and placement tests for this lesson's subject: peek at a
// question (with the answer hidden until you reveal it), set one as homework for
// exactly these students, and see who has taken it so far.

export function QuizTab({ p, lesson, attendees, data }: { p: PanelProps; lesson: Lesson; attendees: Attendee[]; data: WsData }) {
  const { present, hideNames, big } = useWsView();
  const shown = useShownName();
  const subject = lessonSubject(p.topics, lesson);
  const { want } = data;
  useEffect(() => want(["attempts"]), [want]);
  // SCALE: a library can hold thousands of papers and the bank ~90k questions, so this never downloads either. The
  // lesson's subject narrows the published papers server-side (first 100, with the ids); a preview reads one question
  // at a time by id.
  const a = useHubData<{ items: Assessment[]; total: number }>(hubPath(p.qs, "/assessments", { published: "1", subject: subject || null, limit: "100" }), ["hubAssessments", "hubQuestions"]);
  const [open, setOpen] = useState<string | null>(null);
  const [setting, setSetting] = useState<string | null>(null);
  const ids = useMemo(() => new Set(attendees.map((x) => x.childId)), [attendees]);

  const list = useMemo(() => (a.data?.items ?? []).filter((x) => x.published !== false), [a.data]);
  const total = a.data?.total ?? list.length;

  if (a.loading && !a.data) return <div className="grid gap-2" aria-busy="true"><Skeleton className="h-[84px]" /><Skeleton className="h-[84px]" /></div>;
  if (a.error && !a.data) return <WsEmpty icon="warning" title="Couldn't load the quizzes" body={a.error} action={<WsButton variant="soft" icon="refresh" onClick={() => void a.reload()}>Try again</WsButton>} />;
  if (!list.length) return <WsEmpty icon="quiz" title={subject ? `No ${subject} quizzes yet` : "No quizzes yet"} body="Build one in the Quizzes tab and it appears here for the lesson." />;

  return (
    <div className="grid gap-2.5">
      <p className="m-0 text-[12px] text-[var(--ink-3)]">{subject ? `${subject} quizzes and placement tests` : "All quizzes and placement tests"} · {total > list.length ? `first ${list.length} of ${total}` : list.length}</p>
      {list.map((x) => {
        const isOpen = open === x.id;
        const results = (data.attempts ?? []).filter((r) => r.assessmentId === x.id && ids.has(r.childId) && r.status !== "in_progress");
        const qs = x.questionIds ?? [];
        return (
          <div key={x.id} data-assessment={x.id} className="rounded-2xl border border-[var(--hub-warm-line)] bg-[var(--surface)] p-3 shadow-[var(--shadow-sm)]">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`grid h-9 w-9 flex-none place-items-center rounded-xl ${x.type === "diagnostic" ? "bg-[var(--violet-soft)] text-[var(--violet)]" : "bg-[var(--brand-soft)] text-[var(--brand)]"}`} aria-hidden><Ico name={x.type === "diagnostic" ? "compass" : "quiz"} size={17} /></span>
              <div className="min-w-0 flex-1">
                <div className={`truncate font-extrabold text-[var(--ink)] ${big ? "text-[16px]" : "text-[13.5px]"}`}>{x.title}</div>
                <div className="text-[11.5px] text-[var(--ink-3)]">{x.type === "diagnostic" ? "Placement test" : "Quiz"} · {x.questionCount ?? qs.length} questions{x.timeLimitMins ? ` · ${x.timeLimitMins} min` : ""} · pass {x.passMarkPct}%</div>
              </div>
              {results.length > 0 && <Pill tone="green">{results.length} taken</Pill>}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <WsButton variant="soft" icon="eye" onClick={() => setOpen(isOpen ? null : x.id)} ariaLabel={`${isOpen ? "Hide" : "Preview"} ${x.title}`}>{isOpen ? "Hide preview" : "Preview questions"}</WsButton>
              {!present && <WsButton variant="ghost" icon="homework" onClick={() => setSetting(x.id)}>{attendees.length > 1 ? "Set as homework for this group" : "Set as homework"}</WsButton>}
            </div>
            {isOpen && <Preview qs={p.qs} ids={qs} showKey={!present} big={big} />}
            {results.length > 0 && (
              <ul className="m-0 mt-2.5 flex list-none flex-wrap gap-1.5 p-0" aria-label="Results so far">
                {results.map((r) => <ResultChip key={r.id} r={r} name={shown(attendees.find((z) => z.childId === r.childId) ?? { childId: r.childId, name: r.childName ?? "Student" }, attendees.findIndex((z) => z.childId === r.childId))} hide={hideNames} />)}
              </ul>
            )}
          </div>
        );
      })}
      {setting && (
        <HomeworkForm homework={null} students={p.students} topics={p.topics} qs={p.qs} config={p.config} groups={p.groups ?? []}
          initialChildIds={attendees.map((z) => z.childId)} initialGroupIds={lesson.groupIds} initialAssessmentId={setting}
          onClose={() => setSetting(null)} onSaved={() => { setSetting(null); data.reload(); }} />
      )}
    </div>
  );
}

function ResultChip({ r, name, hide }: { r: AttemptRow; name: string; hide: boolean }) {
  const pending = r.status === "pending_marking";
  return <li><Pill tone={pending ? "gold" : r.passed ? "green" : "neutral"}>{name.split(" ")[0]} · {pending ? "awaiting marking" : hide ? "done" : `${Math.round(r.pct ?? 0)}%`}</Pill></li>;
}

/** One question at a time, read by id as the tutor steps through (the bank is never downloaded). */
function Preview({ qs, ids, showKey, big }: { qs: string; ids: string[]; showKey: boolean; big: boolean }) {
  const [i, setI] = useState(0);
  const [reveal, setReveal] = useState(false);
  const [cache, setCache] = useState<Map<string, Question | null>>(() => new Map());
  const id = ids[Math.min(i, Math.max(0, ids.length - 1))];
  useEffect(() => {
    if (!id || cache.has(id)) return;
    let live = true;
    get<Question>(hubPath(qs, `/questions/${id}`))
      .then((q) => { if (live) setCache((c) => new Map(c).set(id, q)); })
      .catch(() => { if (live) setCache((c) => new Map(c).set(id, null)); });
    return () => { live = false; };
  }, [qs, id, cache]);
  if (!ids.length) return <p className="m-0 mt-3 text-[12.5px] text-[var(--ink-3)]">No questions to preview.</p>;
  const questions = ids;
  const cur = cache.get(id!);
  const go = (n: number) => { setI(Math.max(0, Math.min(questions.length - 1, n))); setReveal(false); };
  if (cur === undefined) return <Skeleton className="mt-3 h-[120px]" />;
  if (cur === null) return <p className="m-0 mt-3 text-[12.5px] text-[var(--ink-3)]">Couldn&apos;t load question {i + 1}. <button type="button" onClick={() => setCache((c) => { const n = new Map(c); n.delete(id!); return n; })} className={`font-bold text-[var(--brand)] hover:underline ${FOCUS}`}>Try again</button></p>;
  const keyIds = Array.isArray(cur.answer) ? cur.answer : typeof cur.answer === "string" ? [cur.answer] : [];
  return (
    <div className="mt-3 rounded-xl border border-[var(--hub-warm-line)] p-3" style={{ background: "var(--hub-warm)" }}>
      <div className="mb-1.5 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]">Question {i + 1} of {questions.length}<span className="ml-auto rounded-full bg-[var(--surface)] px-2 py-px normal-case tracking-normal">{cur.marks} mark{cur.marks === 1 ? "" : "s"}</span></div>
      <p className={`m-0 whitespace-pre-wrap font-bold leading-snug text-[var(--ink)] ${big ? "text-[19px]" : "text-[14px]"}`}>{cur.prompt}</p>
      {cur.options?.length > 0 && (
        <ul className="m-0 mt-2 grid list-none gap-1.5 p-0">
          {cur.options.map((o, k) => {
            const right = reveal && showKey && keyIds.includes(o.id);
            return (
              <li key={o.id} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${big ? "text-[16px]" : "text-[13px]"} ${right ? "border-[var(--green-line)] bg-[var(--green-soft)] font-bold text-[var(--hub-green-ink)]" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)]"}`}>
                <span aria-hidden className="grid h-5 w-5 flex-none place-items-center rounded-full bg-[var(--panel)] text-[11px] font-extrabold">{String.fromCharCode(65 + k)}</span>{o.text}{right && <Ico name="check" size={14} className="ml-auto" />}
              </li>
            );
          })}
        </ul>
      )}
      {reveal && showKey && (!cur.options?.length) && cur.answer != null && <p className="m-0 mt-2 rounded-lg border border-[var(--green-line)] bg-[var(--green-soft)] px-2.5 py-1.5 text-[13px] font-bold text-[var(--hub-green-ink)]">Answer: {String(cur.answer)}</p>}
      {reveal && showKey && cur.explanation && <p className="m-0 mt-2 text-[12.5px] leading-relaxed text-[var(--ink-2)]">{cur.explanation}</p>}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <WsButton variant="ghost" onClick={() => go(i - 1)} disabled={i === 0} ariaLabel="Previous question" icon="arrowLeft">Prev</WsButton>
        <WsButton variant="ghost" onClick={() => go(i + 1)} disabled={i >= questions.length - 1} ariaLabel="Next question">Next<Ico name="chevronRight" size={14} /></WsButton>
        {showKey && <button type="button" onClick={() => setReveal((v) => !v)} aria-pressed={reveal} className={`ml-auto min-h-[44px] rounded-xl px-3 text-[12.5px] font-extrabold text-[var(--brand)] hover:underline ${FOCUS}`}>{reveal ? "Hide answer" : "Reveal answer"}</button>}
      </div>
    </div>
  );
}
