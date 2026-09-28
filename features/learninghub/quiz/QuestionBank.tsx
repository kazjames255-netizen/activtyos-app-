"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Input, Select } from "@/components/ui";
import { del, get, put } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import type { PanelProps } from "../panelTypes";
import { canChangeRow, errMsg, topicLabel } from "../types";
import { Icon } from "../kit";
import { hubPath, ruleOf, type QLite, type QPage, type Question } from "../shared-assess/api";
import { NEUTRAL, OK, type Tone } from "../shared-assess/format";
import { Chip, EmptyState, FOCUS, ListSkeleton, Modal, TAP } from "../shared-assess/ui";
import { QuestionForm } from "./QuestionForm";
import { toQuestionBody } from "./questionBody";
import { kindText } from "./kindLabel";
import { hubT, useHubI18n } from "../family/hubT";

// Question bank: every question a tutor has written, grouped by topic, narrowed
// by the sidebar's subject/topic filter. Questions are reusable across quizzes
// and placement tests.

const BRAND_T: Tone = { fill: "var(--brand)", soft: "var(--brand-soft)", ink: "var(--brand-strong)" };
const GOLD: Tone = { fill: "var(--gold)", soft: "var(--gold-soft)", ink: "color-mix(in srgb, var(--gold) 30%, var(--ink))" };

import { GENERATOR_LABEL } from "../tools/problems";

export function answerSummary(q: Question, p: PanelProps): string {
  const rule = ruleOf(p.config.questionKinds, q.kind);
  const text = (id: unknown) => q.options?.find((o) => o.id === id)?.text ?? String(id);
  if (rule === "choice") return q.answer ? text(q.answer) : "";
  if (rule === "multi") return Array.isArray(q.answer) ? q.answer.map(text).join(", ") : "";
  if (rule === "numeric") return q.answer == null ? "" : `${q.answer}${q.tolerance ? ` ± ${q.tolerance}` : ""}`;
  if (rule === "match") return (q.pairs ?? []).map((x) => `${x.term} ↔ ${x.definition}`).join(" · ");
  if (rule === "order") return (q.items ?? []).map((x, i) => `${i + 1}. ${x}`).join("  ");
  if (rule === "exact") return [q.answer, ...(q.acceptedAnswers ?? [])].filter(Boolean).join(" / ");
  if (rule === "tool") return hubT(q.tool?.seed ? "hubfam.qzQbToolFixed" : "hubfam.qzQbToolNew", { label: (q.tool && GENERATOR_LABEL[q.tool.generatorId]) || hubT("hubfam.qzQbToolQ"), seed: q.tool?.seed ?? "" });
  return hubT("hubfam.qzQbByHand");
}

export function QuestionBank({ p }: { p: PanelProps }) {
  const { t, tp } = useHubI18n();
  const [editing, setEditing] = useState<Question | "new" | null>(null);
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [kind, setKind] = useState("");
  const [year, setYear] = useState("");
  const [state, setState] = useState<"" | "published" | "draft">("");
  const [confirmDel, setConfirmDel] = useState<QLite | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const topicById = useMemo(() => new Map(p.topics.map((t) => [t.id, t])), [p.topics]);

  // SCALE: the bank can hold ~5,000 questions, so it is never loaded whole. The list is server-filtered by the sidebar's
  // topic / subject plus the search box (debounced), light rows only (no options / key / explanation), 40 at a time and
  // sorted by topic so each shelf stays together. Editing a question fetches that one question in full.
  const PAGE = 40;
  const [items, setItems] = useState<QLite[]>([]);
  const [total, setTotal] = useState(0);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const seq = useRef(0);
  const count = useRef(PAGE);
  useEffect(() => { const h = setTimeout(() => setDq(q.trim()), 250); return () => clearTimeout(h); }, [q]);
  const listPath = useCallback((cursor: string | null, limit: number) => hubPath(p.qs, "/questions", {
    light: "1", sort: "topic", limit: String(limit), cursor,
    ...(p.filter.topicId ? { topicId: p.filter.topicId } : p.filter.subject ? { subject: p.filter.subject } : {}),
    q: dq || null, kind: kind || null, published: state === "published" ? "1" : state === "draft" ? "0" : null, yearGroup: year || null,
  }), [p.qs, p.filter.topicId, p.filter.subject, dq, kind, state, year]);
  const load = useCallback((more: boolean, cursor: string | null = null, keep = false) => {
    const mine = ++seq.current;
    setLoading(true);
    // A reload after an edit / realtime nudge re-reads as many rows as are on screen (up to 200) so the page doesn't jump back.
    get<QPage>(listPath(more ? cursor : null, more ? PAGE : keep ? Math.min(200, Math.max(PAGE, count.current)) : PAGE))
      .then((r) => {
        if (mine !== seq.current) return;
        setItems((cur) => (more ? [...cur, ...r.items.filter((x) => !cur.some((c) => c.id === x.id))] : r.items));
        count.current = more ? count.current + r.items.length : Math.max(PAGE, r.items.length);
        setTotal(r.total); setNext(r.nextCursor); setLoaded(true);
      })
      .catch((e) => { if (mine === seq.current) { setLoaded(true); p.onError(errMsg(e, t("hubfam.qzQbLoadFail"))); } })
      .finally(() => { if (mine === seq.current) setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listPath]);
  useEffect(() => { count.current = PAGE; load(false); }, [load]);
  const reload = useCallback(() => load(false, null, true), [load]);
  useRealtime(["hubQuestions", "hubTopics"], reload);

  const groups = useMemo(() => {
    const m = new Map<string, QLite[]>();
    for (const x of items) { const l = m.get(x.topicId); if (l) l.push(x); else m.set(x.topicId, [x]); }
    return [...m.entries()];
  }, [items]);
  const fetchFull = (x: QLite) => get<Question>(hubPath(p.qs, `/questions/${x.id}`));

  const openEditor = async (x: QLite) => {
    setBusy(x.id);
    try { setEditing(await fetchFull(x)); }
    catch (e) { p.onError(errMsg(e, t("hubfam.qzQbOpenFail"))); }
    finally { setBusy(null); }
  };
  const togglePublish = async (x: QLite) => {
    setBusy(x.id);
    try {
      const full = await fetchFull(x);
      await put(hubPath(p.qs, `/questions/${x.id}`), toQuestionBody(full, { published: !x.published }));
      reload();
    } catch (e) { p.onError(errMsg(e, t("hubfam.qzQbUpdateFail"))); }
    finally { setBusy(null); }
  };
  const remove = async (x: QLite) => {
    setBusy(x.id);
    try { await del(hubPath(p.qs, `/questions/${x.id}`)); setConfirmDel(null); reload(); }
    catch (e) { setConfirmDel(null); p.onError(errMsg(e, t("hubfam.qzQbDelFail"))); }
    finally { setBusy(null); }
  };
  const narrowed = !!(p.filter.topicId || p.filter.subject || dq || kind || state || year);

  if (!p.topics.length) return <EmptyState icon="🗂️" title={t("hubfam.qzQbAddTopicT")} body={t("hubfam.qzQbAddTopicB")} />;

  return (
    <div className="grid gap-3" data-testid="hub-bank">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[180px] flex-1"><Input aria-label={t("hubfam.qzQbSearchAria")} placeholder={t("hubfam.qzQbSearchPh")} value={q} onChange={(e) => setQ(e.target.value)} className="min-h-[44px] w-full !rounded-xl" /></div>
        <Select aria-label={t("hubfam.qzQbFilterYear")} value={year} onChange={(e) => setYear(e.target.value)} className="min-h-[44px] !rounded-xl" data-testid="hub-bank-year"><option value="">{t("hubfam.qzQbAllYears")}</option>{p.config.yearGroups.map((y) => <option key={y} value={y}>{y}</option>)}<option value="none">{t("hubfam.qzQbNoYear")}</option></Select>
        <Select aria-label={t("hubfam.qzQbFilterType")} value={kind} onChange={(e) => setKind(e.target.value)} className="min-h-[44px] !rounded-xl"><option value="">{t("hubfam.qzQbAllTypes")}</option>{p.config.questionKinds.map((k) => <option key={k.id} value={k.id}>{kindText(t, p.config.questionKinds, k.id)}</option>)}</Select>
        <Select aria-label={t("hubfam.qzAlFilterStatus")} value={state} onChange={(e) => setState(e.target.value as typeof state)} className="min-h-[44px] !rounded-xl"><option value="">{t("hubfam.qzAlAnyStatus")}</option><option value="published">{t("hubfam.qzAlPublished")}</option><option value="draft">{t("hubfam.qzAlDrafts")}</option></Select>
        {!p.readOnly && <Button variant="solid" className={`${TAP} !px-5`} onClick={() => setEditing("new")} data-testid="hub-new-question">{t("hubfam.qzNewQuestion")}</Button>}
      </div>

      {loading && !loaded && <ListSkeleton rows={3} label={t("hubfam.qzQbLoadingList")} />}
      {loaded && groups.length === 0 && (
        <EmptyState icon="❓" title={narrowed ? t("hubfam.qzQbNoMatch") : t("hubfam.qzQbNone")} body={narrowed ? t("hubfam.qzQbTryClear") : t("hubfam.qzQbFirst")}
          action={!narrowed && !p.readOnly ? <Button variant="solid" className={TAP} onClick={() => setEditing("new")}>{t("hubfam.qzNewQuestion")}</Button> : undefined} />
      )}
      {loaded && groups.length > 0 && <p className="m-0 px-1 text-[12px] font-semibold text-[var(--ink-3)]" aria-live="polite">{tp("hubfam.qzQuestions", total)}{!p.filter.subject && !dq && total > PAGE ? t("hubfam.qzQbNarrowHint") : ""}</p>}

      {groups.map(([topicId, items]) => {
        const tc = topicById.get(topicId);
        return (
          <section key={topicId} aria-label={tc ? topicLabel(tc) : t("hubfam.qzQbTopic")}>
            <h3 className="m-0 mb-1.5 mt-1 px-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]">{tc ? topicLabel(tc) : t("hubfam.qzQbUnknownTopic")} <span className="font-semibold normal-case tracking-normal">· {items.length}</span></h3>
            <div className="grid gap-2">
              {items.map((x) => (
                <Card key={x.id} className="p-3.5 sm:p-4" id={`hub-q-${x.id}`}>
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 whitespace-pre-wrap text-[14px] font-bold leading-snug text-[var(--ink)] [overflow-wrap:anywhere]">{x.prompt}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Chip tone={NEUTRAL}>{kindText(t, p.config.questionKinds, x.kind)}</Chip>
                        {(x.yearGroups ?? []).length > 0 && <Chip tone={NEUTRAL}>{(x.yearGroups ?? []).join(", ")}</Chip>}
                        <Chip tone={NEUTRAL}>{tp("hubfam.qzMarks", x.marks)}</Chip>
                        {ruleOf(p.config.questionKinds, x.kind) === "manual" && <Chip tone={BRAND_T} icon={<Icon name="edit" size={11} />}>{t("hubfam.qzQbWrittenChip")}</Chip>}
                        {x.hasImage && <Chip tone={NEUTRAL} icon={<Icon name="image" size={11} />}>{t("hubfam.qzImgPicture")}</Chip>}
                        {!!x.usedBy && <Chip tone={NEUTRAL}>{t("hubfam.qzQbUsedIn", { n: x.usedBy })}</Chip>}
                        {x.published ? <Chip tone={OK}>{t("hubfam.qzAlPublished")}</Chip> : <Chip tone={GOLD}>{t("hubfam.qzAlDraft")}</Chip>}
                      </div>
                    </div>
                    {p.readOnly ? null : !canChangeRow(p.franchiseId, x.franchiseId) ? (
                      <span className="text-[11.5px] font-bold text-[var(--ink-3)]" title={t("hubfam.qzQbHeadTitle")}>{t("hubfam.qzFromHead")}</span>
                    ) : (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button variant="ghost" className={TAP} disabled={busy === x.id} onClick={() => void openEditor(x)}>{t("hubfam.qzEdit")}</Button>
                      <Button variant="ghost" className={TAP} disabled={busy === x.id} onClick={() => togglePublish(x)}>{x.published ? t("hubfam.qzUnpublish") : t("hubfam.qzPublish")}</Button>
                      <button type="button" aria-label={t("hubfam.qzQbDelAria")} onClick={() => setConfirmDel(x)} className={`grid h-11 w-11 place-items-center rounded-full border border-[var(--line)] text-[15px] text-[var(--red)] hover:bg-[var(--red-soft)] ${FOCUS}`}>🗑</button>
                    </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </section>
        );
      })}
      {next && <div className="flex justify-center"><Button onClick={() => load(true, next)} disabled={loading} className={`${TAP} !px-6`}>{loading ? t("hubfam.qzLoading") : t("hubfam.qzShowMore", { n: Math.max(0, total - items.length) })}</Button></div>}

      {editing && <QuestionForm p={p} question={editing === "new" ? null : editing} defaultTopicId={p.filter.topicId ?? undefined} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
      {confirmDel && (
        <Modal title={t("hubfam.qzQbDelTitle")} onClose={() => setConfirmDel(null)}
          footer={<><Button variant="ghost" className={TAP} onClick={() => setConfirmDel(null)}>{t("hubfam.qzKeepIt")}</Button><Button variant="danger" className={TAP} disabled={busy === confirmDel.id} onClick={() => remove(confirmDel)} data-autofocus>{t("hubfam.qzDelete")}</Button></>}>
          <p className="m-0 text-[14px] leading-relaxed text-[var(--ink-2)]">{t("hubfam.qzQbDelBody", { prompt: confirmDel.prompt.slice(0, 120) })}</p>
        </Modal>
      )}
    </div>
  );
}
