"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Input, Select } from "@/components/ui";
import { Icon } from "./kit";
import { useT } from "@/lib/i18n/provider";
import { FOCUS, Segmented } from "./teachKit";
import { errMsg, topicLabel, type Topic } from "./types";

// "New" / "Edit existing" — the tab strip at the top of every tutor creator (lesson editor, quiz builder, flashcard dialog)
// and the searchable list behind "Edit existing". Tutors only: the creators themselves are never rendered for a family or a
// view-only staff role, so neither is this. The list is server-paged and server-searched by the caller's `fetchPage`
// (the same list endpoints the panels already use) — it never downloads a whole library.

export type CreatorMode = "new" | "existing";

export function CreatorTabs({ mode, onChange, noun, className = "" }: { mode: CreatorMode; onChange: (m: CreatorMode) => void; noun: string; className?: string }) {
  const t = useT();
  return (
    <div className={className} data-testid="creator-tabs">
      <Segmented<CreatorMode> label={t("hublessons.edEditorAria", { noun })} value={mode} onChange={onChange} options={[{ v: "new", label: t("hublessons.edNew") }, { v: "existing", label: t("hublessons.edEditExisting") }]} />
    </div>
  );
}

/** The amber "you'll lose unsaved changes — sure?" strip the creators show before swapping what's open. */
export function DiscardStrip({ message, keepLabel, confirmLabel, onKeep, onConfirm, testId }: { message: string; keepLabel?: string; confirmLabel: string; onKeep: () => void; onConfirm: () => void; testId?: string }) {
  const t = useT();
  return (
    <div role="alert" className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] border-s-4 border-s-[var(--gold)] bg-[var(--panel)] px-3.5 py-2.5 text-[13px] text-[var(--ink)]">
      <span className="min-w-0 flex-1">{message}</span>
      <Button onClick={onKeep} className="!h-[44px] lg:!h-[40px]">{keepLabel ?? t("hublessons.edKeepEditing")}</Button>
      <Button variant="danger" onClick={onConfirm} className="!h-[44px] lg:!h-[40px]" data-testid={testId}>{confirmLabel}</Button>
    </div>
  );
}

export interface ExistingRow { id: string; title: string; /** Small grey line under the title. */ meta?: string; topicId?: string; draft?: boolean }
export interface ExistingPage { rows: ExistingRow[]; total: number; next: string | null }
export interface ExistingQuery { q: string; subject: string; topicId: string; yearGroup: string; cursor: string | null }

export function ExistingPicker({ noun, topics, fetchPage, onPick, onError, initialSubject = "", initialTopicId = "", yearGroups, guard, refresh = 0 }: {
  /** The item's name, already in the active language — used in labels. */
  noun: string;
  topics: Topic[];
  fetchPage: (q: ExistingQuery) => Promise<ExistingPage>;
  onPick: (row: ExistingRow) => Promise<void> | void;
  onError?: (msg: string) => void;
  initialSubject?: string;
  initialTopicId?: string;
  /** Offer a year-group filter (when the list endpoint supports one). */
  yearGroups?: string[];
  /** Set when opening another item would throw away unsaved work: the tutor is asked to confirm first. */
  guard?: string | null;
  refresh?: number;
}) {
  const t = useT();
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [subject, setSubject] = useState(initialSubject);
  const [topicId, setTopicId] = useState(initialTopicId);
  const [year, setYear] = useState("");
  const [rows, setRows] = useState<ExistingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ExistingRow | null>(null);
  const seq = useRef(0);
  const fetchRef = useRef(fetchPage);
  const errRef = useRef(onError);
  useEffect(() => { fetchRef.current = fetchPage; errRef.current = onError; });
  useEffect(() => { const t = setTimeout(() => setDq(q.trim()), 250); return () => clearTimeout(t); }, [q]);

  const subjects = useMemo(() => [...new Set(topics.map((t) => t.subject))].sort((a, b) => a.localeCompare(b)), [topics]);
  const subjectTopics = useMemo(() => topics.filter((t) => t.subject === subject).sort((a, b) => topicLabel(a).localeCompare(topicLabel(b))), [topics, subject]);

  const load = (more: boolean, cursor: string | null) => {
    const mine = ++seq.current;
    setLoading(true);
    fetchRef.current({ q: dq, subject, topicId, yearGroup: year, cursor: more ? cursor : null })
      .then((r) => {
        if (mine !== seq.current) return;
        setRows((cur) => (more ? [...cur, ...r.rows.filter((x) => !cur.some((c) => c.id === x.id))] : r.rows));
        setTotal(r.total); setNext(r.next);
      })
      .catch((e) => { if (mine === seq.current) errRef.current?.(errMsg(e, t("hublessons.edCouldntLoad"))); })
      .finally(() => { if (mine === seq.current) setLoading(false); });
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(false, null); }, [dq, subject, topicId, year, refresh]);

  const open = async (r: ExistingRow) => {
    setConfirm(null); setBusyId(r.id);
    try { await onPick(r); }
    catch (e) { onError?.(errMsg(e, t("hublessons.edCouldntOpen"))); }
    finally { setBusyId(null); }
  };
  const choose = (r: ExistingRow) => { if (guard) setConfirm(r); else void open(r); };
  const filtered = !!(dq || subject || topicId || year);
  const byTopic = useMemo(() => new Map(topics.map((t) => [t.id, t])), [topics]);

  return (
    <div className="grid gap-3" data-testid="edit-existing" role="tabpanel" aria-label={t("hublessons.edEditExistingNoun", { noun })}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Icon name="search" size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--ink-2)]" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("hublessons.edSearchPh")} aria-label={t("hublessons.edSearchPh")} data-testid="edit-existing-search" className={`!min-h-[44px] w-full !rounded-xl !ps-9 ${FOCUS}`} />
        </div>
        <Select aria-label={t("hublessons.edSubject")} value={subject} onChange={(e) => { setSubject(e.target.value); setTopicId(""); }} className="min-h-[44px] !rounded-xl">
          <option value="">{t("hublessons.edAllSubjects")}</option>
          {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        {subject && subjectTopics.length > 0 && (
          <Select aria-label={t("hublessons.edTopic")} value={topicId} onChange={(e) => setTopicId(e.target.value)} className="min-h-[44px] max-w-[260px] !rounded-xl">
            <option value="">{t("hublessons.edAllTopics")}</option>
            {subjectTopics.map((t) => <option key={t.id} value={t.id}>{topicLabel(t)}</option>)}
          </Select>
        )}
        {yearGroups && yearGroups.length > 0 && (
          <Select aria-label={t("hublessons.edYearGroup")} value={year} onChange={(e) => setYear(e.target.value)} className="min-h-[44px] !rounded-xl">
            <option value="">{t("hublessons.edAllYears")}</option>
            {yearGroups.map((y) => <option key={y} value={y}>{y}</option>)}
          </Select>
        )}
      </div>
      <p className="m-0 text-[12px] font-semibold text-[var(--ink-2)]" aria-live="polite">{loading && rows.length === 0 ? t("hublessons.edLoading") : t(filtered ? "hublessons.edMatches" : "hublessons.edTotal", { n: total })}</p>

      {confirm && (
        <DiscardStrip message={t("hublessons.edOpenAnyway", { guard: guard ?? "", title: confirm.title })} keepLabel={t("hublessons.edKeepWhatIHave")} confirmLabel={t("hublessons.edDiscardOpen")} onKeep={() => setConfirm(null)} onConfirm={() => void open(confirm)} testId="edit-existing-confirm" />
      )}

      {!loading && rows.length === 0 ? (
        <p className="m-0 rounded-2xl border border-dashed border-[var(--line)] px-4 py-8 text-center text-[13px] text-[var(--ink-2)]" data-testid="edit-existing-empty">{filtered ? t("hublessons.edNoMatch") : t("hublessons.edNoneYet")}</p>
      ) : (
        <ul className="m-0 grid max-h-[520px] list-none gap-1.5 overflow-y-auto p-0" data-testid="edit-existing-list">
          {rows.map((r) => {
            const tp = r.topicId ? byTopic.get(r.topicId) : undefined;
            const meta = [tp ? topicLabel(tp) : null, r.meta].filter(Boolean).join(" · ");
            return (
              <li key={r.id}>
                <button type="button" onClick={() => choose(r)} disabled={!!busyId} data-testid="edit-existing-row" data-id={r.id} aria-label={t("hublessons.edEditTitle", { title: r.title })}
                  className={`flex min-h-[52px] w-full items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2 text-start transition hover:border-[var(--brand-2)] disabled:opacity-60 ${FOCUS}`}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-extrabold text-[var(--ink)]">{r.title}</span>
                    {meta && <span className="block truncate text-[11.5px] font-semibold text-[var(--ink-2)]">{meta}</span>}
                  </span>
                  {r.draft && <span className="flex-none rounded-full border border-dashed border-[var(--ink-2)] px-2 py-px text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-2)]">{t("hublessons.edDraft")}</span>}
                  <span className="flex-none text-[12.5px] font-extrabold text-[var(--brand)]">{busyId === r.id ? t("hublessons.edOpening") : t("hublessons.edEdit")}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {next && <div className="flex justify-center"><Button onClick={() => load(true, next)} disabled={loading} className="!min-h-[44px] !px-6">{loading ? t("hublessons.edLoading") : t("hublessons.edShowMore", { n: Math.max(0, total - rows.length) })}</Button></div>}
    </div>
  );
}
