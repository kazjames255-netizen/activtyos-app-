"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { get } from "@/lib/api";
import { useT } from "@/lib/i18n/provider";
import { errMsg, type Topic } from "../../types";
import { FOCUS, Icon, SkeletonRows, subjectColor } from "../../kit";
import { YearPills } from "../../curriculum/CurriculumCard";
import { withQs } from "../../teachKit";
import { CAP, PAGE, loadTopics } from "./data";
import { CARD_GRID, PickCard } from "./PickCard";
import type { PickItem } from "./types";

// The quiz / placement-test twin of LessonPicker: same search, chips and card language (the Quizzes area's cards), server paged.
interface PaperRow { id: string; title: string; subject: string; type: "quiz" | "diagnostic"; questionCount: number }

export function QuizPicker({ qs, value, onChange, idPrefix = "qp", testId = "quiz-picker" }: { qs: string; value: string[]; onChange: (ids: string[], items: PickItem[]) => void; idPrefix?: string; testId?: string }) {
  const t = useT();
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  useEffect(() => { const id = setTimeout(() => setDq(q.trim()), 250); return () => clearTimeout(id); }, [q]);
  const [topics, setTopics] = useState<Topic[]>([]);
  useEffect(() => { loadTopics(qs).then(setTopics).catch(() => undefined); }, [qs]);
  const subjects = useMemo(() => [...new Set(topics.map((x) => x.subject).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [topics]);
  const [subj, setSubj] = useState("");
  const [year, setYear] = useState<number | null>(null);
  const [rows, setRows] = useState<PickItem[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const seen = useRef(new Map<string, PickItem>());
  const seq = useRef(0);
  const fetchRows = async (cursor: string | null) => {
    const r = await get<{ items: PaperRow[]; nextCursor?: string | null } | PaperRow[]>(`/api/learning-hub/assessments${withQs(qs, { light: "1", published: "1", limit: String(PAGE), cursor: cursor ?? undefined, q: dq || undefined, yearGroup: year ? `Year ${year}` : undefined, subject: subj || undefined })}`);
    const list = Array.isArray(r) ? r : r.items ?? [];
    return { items: list.map<PickItem>((p) => ({ id: p.id, title: p.title, subject: p.subject, color: p.subject ? subjectColor(p.subject) : undefined, kind: p.type, questionCount: p.questionCount, year })), next: Array.isArray(r) ? null : r.nextCursor ?? null };
  };
  const load = () => {
    const mine = ++seq.current; setRows(null); setErr(null);
    fetchRows(null).then((r) => { if (mine === seq.current) { r.items.forEach((x) => seen.current.set(x.id, x)); setRows(r.items); setNext(r.next); } }).catch((e) => { if (mine === seq.current) { setRows([]); setErr(errMsg(e, t("hubpicker.errLoad"))); } });
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [qs, dq, subj, year]);
  const showMore = async () => {
    if (!next || more) return;
    setMore(true);
    try { const r = await fetchRows(next); r.items.forEach((x) => seen.current.set(x.id, x)); setRows((cur) => [...(cur ?? []), ...r.items.filter((x) => !(cur ?? []).some((c) => c.id === x.id))]); setNext(r.next); }
    catch (e) { setErr(errMsg(e, t("hubpicker.errLoad"))); } finally { setMore(false); }
  };
  const pick = (it: PickItem) => { const ids = value[0] === it.id ? [] : [it.id]; onChange(ids, ids.map((id) => seen.current.get(id) ?? { id, title: it.title })); };
  const chip = (on: boolean) => `min-h-[44px] flex-none rounded-full border-2 px-3.5 text-[13.5px] font-extrabold ${FOCUS} ${on ? "border-[var(--brand)] bg-[var(--brand)] text-[var(--on-brand,#fff)]" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"}`;
  return (
    <div data-testid={testId} className="grid min-w-0 gap-3 [grid-template-columns:minmax(0,1fr)]">
      <div className="relative">
        <Icon name="search" size={18} className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-[var(--ink-2)]" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("hubpicker.searchQuizzes")} aria-label={t("hubpicker.searchQuizzes")} id={`${idPrefix}-search`}
          className={`min-h-[52px] w-full rounded-2xl border-2 border-[var(--line)] bg-[var(--surface)] ps-11 pe-4 text-[15px] font-semibold text-[var(--ink)] placeholder:font-medium placeholder:text-[var(--ink-3)] focus:border-[var(--brand)] ${FOCUS}`} />
      </div>
      {subjects.length > 1 && (
        <div role="group" aria-label={t("hubpicker.subjectsAria")} className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
          <button type="button" aria-pressed={!subj} onClick={() => setSubj("")} className={chip(!subj)}>{t("hubpicker.allSubjects")}</button>
          {subjects.map((s) => { const c = subjectColor(s), on = subj === s; return (
            <button key={s} type="button" aria-pressed={on} onClick={() => setSubj(on ? "" : s)} className={`min-h-[44px] flex-none rounded-full border-2 px-3.5 text-[13.5px] font-extrabold ${FOCUS}`}
              style={on ? { borderColor: c, background: c, color: "#fff" } : { borderColor: c, background: "var(--surface)", color: c }}>{s}</button>); })}
        </div>
      )}
      <YearPills years={Array.from({ length: 13 }, (_, i) => i + 1)} value={year} onPick={setYear} />
      {err && <p role="alert" className="m-0 text-[13px] font-semibold text-[var(--sem-crit)]">{err}</p>}
      {rows === null ? <SkeletonRows rows={3} variant="card" grid label={t("hubpicker.loading")} /> : rows.length === 0 ? (
        <div className="grid justify-items-center gap-2 rounded-2xl border border-dashed border-[var(--line)] p-6 text-center"><p className="m-0 text-[14px] font-semibold text-[var(--ink-2)]">{t("hubpicker.noQuizzes")}</p>
          {(dq || subj || year) && <Button onClick={() => { setQ(""); setSubj(""); setYear(null); }} className="!min-h-[44px]">{t("hubpicker.clearFilters")}</Button>}</div>
      ) : (
        <>
          <ul className={CARD_GRID} role="radiogroup" aria-label={t("hubpicker.quizzes")} data-testid={`${idPrefix}-cards`}>
            {rows.map((it) => <li key={it.id} className="grid"><PickCard item={it} selected={value[0] === it.id} single onPick={pick} /></li>)}
          </ul>
          {rows.length >= CAP ? <p className="m-0 text-center text-[12.5px] font-semibold text-[var(--ink-2)]">{t("hubpicker.capHint", { n: CAP })}</p>
            : next && <div className="flex justify-center"><Button onClick={() => void showMore()} disabled={more} className="!min-h-[44px] !px-6">{more ? t("hubpicker.loading") : t("hubpicker.showMore", { n: PAGE })}</Button></div>}
        </>
      )}
    </div>
  );
}
