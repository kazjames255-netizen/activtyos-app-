"use client";

import { useEffect, useMemo, useState } from "react";
import { useT } from "@/lib/i18n/provider";
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
  const tx = useT();
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
  if (a.error && !a.data) return <WsEmpty icon="warning" title={tx("hublive.aQz_loadFail")} body={a.error} action={<WsButton variant="soft" icon="refresh" onClick={() => void a.reload()}>{tx("hublive.aStage_tryAgain")}</WsButton>} />;
  if (!list.length) return <WsEmpty icon="quiz" title={subject ? tx("hublive.aQz_noneSubj", { subject }) : tx("hublive.aQz_none")} body={tx("hublive.aQz_noneBody")} />;

  return (
    <div className="grid gap-2.5">
      <p className="m-0 text-[12px] text-[var(--ink-3)]">{subject ? tx("hublive.aQz_headSubj", { subject }) : tx("hublive.aQz_headAll")} · {total > list.length ? tx("hublive.aQz_firstOf", { a: list.length, b: total }) : list.length}</p>
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
                <div className="text-[11.5px] text-[var(--ink-3)]">{x.timeLimitMins ? tx("hublive.aQz_metaTime", { kind: x.type === "diagnostic" ? tx("hublive.aQz_starting") : tx("hublive.aQz_quiz"), n: x.questionCount ?? qs.length, mins: x.timeLimitMins, pct: x.passMarkPct }) : tx("hublive.aQz_meta", { kind: x.type === "diagnostic" ? tx("hublive.aQz_starting") : tx("hublive.aQz_quiz"), n: x.questionCount ?? qs.length, pct: x.passMarkPct })}</div>
              </div>
              {results.length > 0 && <Pill tone="green">{tx("hublive.aQz_taken", { n: results.length })}</Pill>}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <WsButton variant="soft" icon="eye" onClick={() => setOpen(isOpen ? null : x.id)} ariaLabel={tx(isOpen ? "hublive.aQz_hidePrev" : "hublive.aQz_showPrev", { title: x.title })}>{isOpen ? tx("hublive.aQz_hidePreview") : tx("hublive.aQz_previewQs")}</WsButton>
              {!present && <WsButton variant="ghost" icon="homework" onClick={() => setSetting(x.id)}>{attendees.length > 1 ? tx("hublive.aQz_setHwGroup") : tx("hublive.aQz_setHw")}</WsButton>}
            </div>
            {isOpen && <Preview qs={p.qs} ids={qs} showKey={!present} big={big} />}
            {results.length > 0 && (
              <ul className="m-0 mt-2.5 flex list-none flex-wrap gap-1.5 p-0" aria-label={tx("hublive.aQz_resultsAria")}>
                {results.map((r) => <ResultChip key={r.id} r={r} name={shown(attendees.find((z) => z.childId === r.childId) ?? { childId: r.childId, name: r.childName ?? tx("hublive.aPanel_student") }, attendees.findIndex((z) => z.childId === r.childId))} hide={hideNames} />)}
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
  const tx = useT();
  const pending = r.status === "pending_marking";
  return <li><Pill tone={pending ? "gold" : r.passed ? "green" : "neutral"}>{name.split(" ")[0]} · {pending ? tx("hublive.aQz_awaiting") : hide ? tx("hublive.aQz_done") : `${Math.round(r.pct ?? 0)}%`}</Pill></li>;
}

/** One question at a time, read by id as the tutor steps through (the bank is never downloaded). */
function Preview({ qs, ids, showKey, big }: { qs: string; ids: string[]; showKey: boolean; big: boolean }) {
  const tx = useT();
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
  if (!ids.length) return <p className="m-0 mt-3 text-[12.5px] text-[var(--ink-3)]">{tx("hublive.aQz_noQs")}</p>;
  const questions = ids;
  const cur = cache.get(id!);
  const go = (n: number) => { setI(Math.max(0, Math.min(questions.length - 1, n))); setReveal(false); };
  if (cur === undefined) return <Skeleton className="mt-3 h-[120px]" />;
  if (cur === null) return <p className="m-0 mt-3 text-[12.5px] text-[var(--ink-3)]">{tx("hublive.aQz_qLoadFail", { n: i + 1 })} <button type="button" onClick={() => setCache((c) => { const n = new Map(c); n.delete(id!); return n; })} className={`font-bold text-[var(--brand)] hover:underline ${FOCUS}`}>{tx("hublive.aStage_tryAgain")}</button></p>;
  const keyIds = Array.isArray(cur.answer) ? cur.answer : typeof cur.answer === "string" ? [cur.answer] : [];
  return (
    <div className="mt-3 rounded-xl border border-[var(--hub-warm-line)] p-3" style={{ background: "var(--hub-warm)" }}>
      <div className="mb-1.5 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]">{tx("hublive.aQz_qOf", { i: i + 1, n: questions.length })}<span className="ms-auto rounded-full bg-[var(--surface)] px-2 py-px normal-case tracking-normal">{tx("hublive.aQz_marksN", { n: cur.marks })}</span></div>
      <p className={`m-0 whitespace-pre-wrap font-bold leading-snug text-[var(--ink)] ${big ? "text-[19px]" : "text-[14px]"}`}>{cur.prompt}</p>
      {cur.options?.length > 0 && (
        <ul className="m-0 mt-2 grid list-none gap-1.5 p-0">
          {cur.options.map((o, k) => {
            const right = reveal && showKey && keyIds.includes(o.id);
            return (
              <li key={o.id} className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${big ? "text-[16px]" : "text-[13px]"} ${right ? "border-[var(--green-line)] bg-[var(--green-soft)] font-bold text-[var(--hub-green-ink)]" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)]"}`}>
                <span aria-hidden className="grid h-5 w-5 flex-none place-items-center rounded-full bg-[var(--panel)] text-[11px] font-extrabold">{String.fromCharCode(65 + k)}</span>{o.text}{right && <Ico name="check" size={14} className="ms-auto" />}
              </li>
            );
          })}
        </ul>
      )}
      {reveal && showKey && (!cur.options?.length) && cur.answer != null && <p className="m-0 mt-2 rounded-lg border border-[var(--green-line)] bg-[var(--green-soft)] px-2.5 py-1.5 text-[13px] font-bold text-[var(--hub-green-ink)]">{tx("hublive.aQz_answer", { a: String(cur.answer) })}</p>}
      {reveal && showKey && cur.explanation && <p className="m-0 mt-2 text-[12.5px] leading-relaxed text-[var(--ink-2)]">{cur.explanation}</p>}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <WsButton variant="ghost" onClick={() => go(i - 1)} disabled={i === 0} ariaLabel={tx("hublive.aQz_prevQ")} icon="arrowLeft">{tx("hublive.aQz_prev")}</WsButton>
        <WsButton variant="ghost" onClick={() => go(i + 1)} disabled={i >= questions.length - 1} ariaLabel={tx("hublive.aQz_nextQ")}>{tx("hublive.aQz_next")}<Ico name="chevronRight" size={14} className="rtl:-scale-x-100" /></WsButton>
        {showKey && <button type="button" onClick={() => setReveal((v) => !v)} aria-pressed={reveal} className={`ms-auto min-h-[44px] rounded-xl px-3 text-[12.5px] font-extrabold text-[var(--brand)] hover:underline ${FOCUS}`}>{reveal ? tx("hublive.aQz_hideAns") : tx("hublive.aQz_revealAns")}</button>}
      </div>
    </div>
  );
}
