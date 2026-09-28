"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Select } from "@/components/ui";
import { del, get, put } from "@/lib/api";
import { Icon, subjectColor, subjectInk, tint } from "../kit";
import { DirArrow } from "../rtl";
import { subjectSwatch } from "../subjectColour";
import type { PanelProps } from "../panelTypes";
import { SubjectCover, SubjectGlyph } from "../subjectArt";
import { canChangeRow, errMsg, topicLabel } from "../types";
import { setHubIntent, takeHubIntent } from "../hubIntent";
import { hubPath, type Assessment, type AssessType, type AttemptRow } from "../shared-assess/api";
import { audienceChips } from "../shared-assess/audience";
import { OK, type Tone } from "../shared-assess/format";
import { effectivePolicy, policyLabel } from "../shared-assess/retake";
import { LIFT, useGrow } from "../shared-assess/motion";
import { CardGridSkeleton, Chip, display, EmptyState, FOCUS, HourglassIcon, Modal, Notice, TAP } from "../shared-assess/ui";
import { AssessmentBuilder } from "./AssessmentBuilder";
import { StatTiles, quizStatTiles } from "./StatTiles";
import { kindMix, statsFor, type AssessStats } from "./assessStats";
import { PlacementGuide } from "./PlacementGuide";
import { useAssessmentPage, useNearEnd } from "./useAssessmentPage";
import { WaiveCard } from "./WaiveCard";
import { kindText } from "./kindLabel";
import { useHubI18n } from "../family/hubT";

const GOLD: Tone = { fill: "var(--gold)", soft: "var(--gold-soft)", ink: "color-mix(in srgb, var(--gold) 30%, var(--ink))" };
const BRAND: Tone = { fill: "var(--brand)", soft: "var(--brand-soft)", ink: "var(--brand-strong)" };
const GRID = "grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr))]";
// `subject`: the chip wears its subject's colour (set inline by the caller) instead of the brand's.
const CHIP = (on: boolean, subject = false) => `min-h-[44px] lg:min-h-[40px] flex-none rounded-full border px-3.5 text-[12.5px] font-bold transition-colors ${FOCUS} ${on ? (subject ? "font-extrabold" : "border-[var(--brand)] bg-[var(--brand)] text-white") : `${subject ? "bg-[var(--surface)]" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] hover:border-[var(--brand)]"}`}`;

/** Tutor's list of quizzes / placement tests with the builder. Each card carries its
 *  real numbers (average, score spread, attempts, papers waiting to be marked).
 *
 *  SCALE: the library is server-paged (40 at a time, more on scroll or "Show more") and server-filtered — subject /
 *  topic from the sidebar, year group, a title search and published state — with the chip counts coming back as facets
 *  on every page. Nothing here ever holds the whole library. */
export function AssessmentList({ p, type, attempts, onGoMarking, onGoResults }: {
  p: PanelProps; type: AssessType; attempts: AttemptRow[] | null; onGoMarking?: () => void; onGoResults?: () => void;
}) {
  const { t, tp } = useHubI18n();
  const [editing, setEditing] = useState<Assessment | "new" | null>(null);
  const [confirmDel, setConfirmDel] = useState<Assessment | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [yearF, setYearF] = useState("");
  const [subjectChip, setSubjectF] = useState("");
  // The sidebar's subject wins over the in-page subject chips (which only show when the sidebar is on "all").
  const subjectF = p.filter.subject || p.filter.topicId ? "" : subjectChip;
  const [state, setState] = useState<"" | "published" | "draft">("");
  const [search, setSearch] = useState("");
  const [dq, setDq] = useState("");
  const [preview, setPreview] = useState<Assessment | null>(null);
  // A save that forked a head-office (shared-library) paper into the tutor's own copy — the builder
  // (or togglePublish) closes/finishes right away, so the confirmation lives here, not in it.
  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => { if (!flash) return; const h = setTimeout(() => setFlash(null), 5000); return () => clearTimeout(h); }, [flash]);
  // Home's "New quiz" quick action lands here with the builder already open.
  useEffect(() => { if (type === "quiz" && !p.readOnly && p.topics.length && takeHubIntent(["newQuiz"])) setEditing("new"); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { const h = setTimeout(() => setDq(search.trim()), 250); return () => clearTimeout(h); }, [search]);
  const diag = type === "diagnostic";
  const Q = diag ? "T" : "Q"; // key suffix: T = placement test, Q = quiz

  const page = useAssessmentPage(p.qs, {
    type, subject: p.filter.subject || subjectF || null, topicId: p.filter.topicId, yearGroup: yearF || null, q: dq || null,
    published: state === "published" ? "1" : state === "draft" ? "0" : null,
  }, p.onError);
  const { items: list, total, facets, loaded, reload } = page;
  const stats = useMemo(() => new Map(list.map((a) => [a.id, statsFor(a, attempts ?? [])])), [list, attempts]);
  const sentinel = useNearEnd(page.loadMore, !!page.next && !page.loading);

  // The tiles: published / drafts come back with the page (server counts over every match); attempts, average and
  // "to mark" are rolled up from the attempts the tab already holds (narrowed to the sidebar's subject when set).
  const totals = useMemo(() => {
    const subj = (p.filter.subject || subjectF || "").toLowerCase();
    const rows = (attempts ?? []).filter((r) => r.status !== "in_progress" && (!subj || !r.subject || r.subject.toLowerCase() === subj));
    const marked = rows.filter((r) => r.status === "marked" && r.pct != null);
    return {
      attempts: rows.length, toMark: rows.filter((r) => r.status === "pending_marking").length,
      avg: marked.length ? marked.reduce((n, r) => n + (r.pct ?? 0), 0) / marked.length : null,
      published: facets?.published ?? 0, drafts: facets?.drafts ?? 0,
    };
  }, [attempts, facets, p.filter.subject, subjectF]);

  // The list rows are light (no question ids): anything that saves a paper — or opens it in the builder — first reads it in full.
  const full = (a: Assessment) => get<Assessment>(hubPath(p.qs, `/assessments/${a.id}`));
  const openEditor = async (a: Assessment) => {
    setBusy(a.id);
    try { setEditing(await full(a)); }
    catch (e) { p.onError(errMsg(e, t(`hubfam.qzAlOpenFail${Q}`))); }
    finally { setBusy(null); }
  };
  const togglePublish = async (row: Assessment) => {
    setBusy(row.id);
    try {
      const a = await full(row);
      const r = await put<{ forked?: boolean }>(hubPath(p.qs, `/assessments/${a.id}`), { type: a.type, title: a.title, subject: a.subject, topicIds: a.topicIds, questionIds: a.questionIds ?? [], timeLimitMins: a.timeLimitMins, passMarkPct: a.passMarkPct, published: !a.published, ...(a.audience ? { audience: a.audience } : {}), ...(a.retakePolicy ? { retakePolicy: a.retakePolicy } : {}), ...(a.retakeCooldownHours != null ? { retakeCooldownHours: a.retakeCooldownHours } : {}) });
      if (r.forked) setFlash(t("hubfam.qzAlForkPublish", { title: a.title }));
      reload();
    } catch (e) { p.onError(errMsg(e, t("hubfam.qzAlPublishFail"))); }
    finally { setBusy(null); }
  };
  // "Set for children": hand this paper to the Homework form (quiz preselected — the form itself warns about a draft, or students it can't reach).
  const assign = (a: Assessment) => {
    setHubIntent({ kind: "homework", groupId: "", assessmentId: a.id, title: a.title, instructions: t(a.type === "diagnostic" ? "hubfam.qzAlHwInstrT" : "hubfam.qzAlHwInstrQ", { title: a.title }) });
    p.goTo?.("homework");
  };
  const remove = async (a: Assessment) => {
    setBusy(a.id);
    try { await del(hubPath(p.qs, `/assessments/${a.id}`)); setConfirmDel(null); reload(); }
    catch (e) { setConfirmDel(null); p.onError(errMsg(e, t(`hubfam.qzAlDelFail${Q}`))); }
    finally { setBusy(null); }
  };

  // Subjects with a placement test (from the subject facet, which ignores the subject filter) — the ghost tile names
  // the next one to add and the waive form lists them.
  const diagSubjects = useMemo(() => (diag && facets ? facets.subjects.map((s) => s.subject) : []), [diag, facets]);
  const withoutDiag = useMemo(() => {
    if (!diag) return [];
    const have = new Set(diagSubjects.map((s) => s.toLowerCase()));
    return [...new Set(p.topics.map((x) => x.subject))].filter((s) => !have.has(s.toLowerCase()));
  }, [diag, diagSubjects, p.topics]);

  const narrowed = !!(p.filter.subject || p.filter.topicId || subjectF || yearF || dq || state);
  const ghost = total === 1 && !narrowed && p.topics.length > 0;
  const showSubjects = !p.filter.subject && !p.filter.topicId && !!facets && facets.subjects.length > 1;

  return (
    <div className="grid gap-4" data-testid={`hub-${type}-admin`}>
      {diag && <PlacementGuide requireDiagnostic={p.config.requireDiagnostic} />}
      {flash && <Notice tone="ok" onDismiss={() => setFlash(null)}>{flash}</Notice>}

      <div className="flex flex-wrap items-center gap-2">
        <p className="m-0 min-w-[200px] flex-1 text-[12.5px] text-[var(--ink-3)]">{diag ? t("hubfam.qzAlIntroDiag") : t("hubfam.qzAlIntroQuiz")}</p>
        {!p.readOnly && <Button variant="solid" className={`${TAP} !px-5`} onClick={() => setEditing("new")} disabled={!p.topics.length} data-testid="hub-new-assessment">{t(`hubfam.qzAlNew${Q}`)}</Button>}
      </div>
      {(loaded && (total > 0 || narrowed)) && (
        <div className="flex flex-wrap items-center gap-2" data-testid="hub-assessment-search">
          <div className="min-w-[180px] flex-1"><Input aria-label={t(`hubfam.qzAlSearchAria${Q}`)} placeholder={t(`hubfam.qzAlSearchPh${Q}`)} value={search} onChange={(e) => setSearch(e.target.value)} className="min-h-[44px] w-full !rounded-xl" /></div>
          <Select aria-label={t("hubfam.qzAlFilterStatus")} value={state} onChange={(e) => setState(e.target.value as typeof state)} className="min-h-[44px] !rounded-xl"><option value="">{t("hubfam.qzAlAnyStatus")}</option><option value="published">{t("hubfam.qzAlPublished")}</option><option value="draft">{t("hubfam.qzAlDrafts")}</option></Select>
        </div>
      )}
      {showSubjects && (
        <div className="flex flex-wrap items-center gap-2" data-testid="hub-subject-filter">
          <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]">{t("hubfam.qzSubject")}</span>
          <div className="flex max-w-full gap-1.5 overflow-x-auto pb-0.5">
            <button type="button" aria-pressed={!subjectF} onClick={() => setSubjectF("")} className={CHIP(!subjectF)}>{t("hubfam.qzAlAll")}<span className="ms-1 tabular-nums opacity-70">{facets!.subjects.reduce((n, s) => n + s.count, 0)}</span></button>
            {facets!.subjects.map((s) => (
              <button key={s.subject} type="button" aria-pressed={subjectF === s.subject} onClick={() => setSubjectF(subjectF === s.subject ? "" : s.subject)} className={CHIP(subjectF === s.subject, true)} style={subjectF === s.subject ? { background: tint(subjectColor(s.subject), 16), borderColor: subjectColor(s.subject), color: subjectInk(s.subject) } : { borderColor: subjectSwatch(s.subject).ring, color: subjectInk(s.subject) }}>{s.subject}<span className="ms-1 tabular-nums opacity-70">{s.count}</span></button>
            ))}
          </div>
        </div>
      )}
      {facets?.anyYearTargeted && (
        <div className="flex flex-wrap items-center gap-2" data-testid="hub-year-filter">
          <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]">{t("hubfam.qzAlYearGroup")}</span>
          <div className="flex max-w-full gap-1.5 overflow-x-auto pb-0.5">
            <button type="button" aria-pressed={!yearF} onClick={() => setYearF("")} className={CHIP(!yearF)}>{t("hubfam.qzAlAll")}<span className="ms-1 tabular-nums opacity-70">{facets.allYearGroups}</span></button>
            {facets.yearGroups.map((y) => (
              <button key={y.yearGroup} type="button" aria-pressed={yearF.toLowerCase() === y.yearGroup.toLowerCase()} onClick={() => setYearF(y.yearGroup)} className={CHIP(yearF.toLowerCase() === y.yearGroup.toLowerCase())}>{y.yearGroup}<span className="ms-1 tabular-nums opacity-70">{y.count}</span></button>
            ))}
          </div>
        </div>
      )}
      {!p.topics.length && <Notice tone="info">{t(`hubfam.qzAlNeedTopic${Q}`)}</Notice>}

      {total > 0 && (
        <StatTiles label={t("hubfam.qzAlPublished")} tiles={quizStatTiles({
          publishedLabel: t("hubfam.qzAlPublished"), published: totals.published, publishedHint: totals.drafts ? t("hubfam.qzAlSubDrafts", { n: totals.drafts }) : t("hubfam.qzAlNoDrafts"),
          attemptsLabel: t("hubfam.qzRsAttempts"), attempts: attempts ? totals.attempts : null, attemptsHint: t("hubfam.qzAlHandedIn"), onAttempts: onGoResults,
          avgLabel: diag ? t("hubfam.qzAlAvgStart") : t("hubfam.qzAlAvgScore"), avg: totals.avg, avgHint: totals.avg != null ? t("hubfam.qzAlAcross") : t("hubfam.qzAlNothingMarked"),
          toMarkLabel: t("hubfam.qzRsToMark"), toMark: totals.toMark, toMarkHint: totals.toMark ? t("hubfam.qzAlWaiting") : t("hubfam.qzAlCaughtUp"), onToMark: onGoMarking,
        })} />
      )}

      {page.loading && !loaded && <CardGridSkeleton count={3} label={t("hubfam.qzLoadingShort")} />}
      {loaded && total === 0 && p.topics.length > 0 && (narrowed
        ? <EmptyState icon={diag ? "compass" : "quiz"} title={t(`hubfam.qzAlNoMatch${Q}`)} body={t("hubfam.qzAlTryOther")} action={<Button className={TAP} onClick={() => { setSearch(""); setYearF(""); setSubjectF(""); setState(""); }}>{t("hubfam.qzAlClear")}</Button>} />
        : <EmptyState icon={diag ? "compass" : "quiz"} title={t(`hubfam.qzAlNone${Q}`)} body={diag ? t("hubfam.qzAlEmptyDiag") : t("hubfam.qzAlEmptyQuiz")}
          action={p.readOnly ? undefined : <Button variant="solid" className={TAP} onClick={() => setEditing("new")}>{t(`hubfam.qzAlNew${Q}`)}</Button>} />
      )}

      {list.length > 0 && (
        <>
          <p className="m-0 text-[12px] font-semibold tabular-nums text-[var(--ink-3)]" data-testid="hub-assessment-count" aria-live="polite">{t("hubfam.qzAlShowing", { n: list.length, total })}</p>
          <div className={GRID} data-testid="hub-assessment-grid">
            {list.map((a) => (
              <TutorCard key={a.id} a={a} s={stats.get(a.id)!} statsReady={!!attempts} diag={diag} p={p} mix={kindMix(a, p.config.questionKinds, (id) => kindText(t, p.config.questionKinds, id))} busy={busy === a.id}
                onEdit={() => void openEditor(a)} onToggle={() => togglePublish(a)} onDelete={() => setConfirmDel(a)} onGoMarking={onGoMarking} onPreview={() => setPreview(a)} onAssign={() => assign(a)} />
            ))}
            {ghost && !p.readOnly && (
              <button type="button" onClick={() => setEditing("new")} className={`flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[var(--line)] bg-transparent px-6 py-8 text-center text-[var(--ink-2)] transition-colors hover:border-[var(--brand)] hover:bg-[var(--brand-soft)] hover:text-[var(--brand)] ${FOCUS}`}>
                <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--brand-soft)] text-[var(--brand)]"><Icon name="plus" size={22} strokeWidth={2.2} /></span>
                <span className="text-[14px] font-extrabold text-[var(--ink)]" style={display}>{diag ? t("hubfam.qzAlAddTest") : t("hubfam.qzAlBuildAnother")}</span>
                <span className="max-w-[240px] text-[12.5px] leading-snug text-[var(--ink-3)]">{diag && withoutDiag.length ? (withoutDiag.length === 1 ? t("hubfam.qzAlGhostOne", { a: withoutDiag[0]! }) : withoutDiag.length === 2 ? t("hubfam.qzAlGhostTwo", { a: withoutDiag[0]!, b: withoutDiag[1]! }) : t("hubfam.qzAlGhostMore", { a: withoutDiag[0]!, b: withoutDiag[1]!, n: withoutDiag.length - 2 })) : t("hubfam.qzAlGhostDefault")}</span>
              </button>
            )}
          </div>
          {page.next && (
            <div ref={sentinel} className="flex justify-center">
              <Button onClick={page.loadMore} disabled={page.loading} className="!min-h-[40px]" data-testid="hub-assessment-more">{page.loading ? t("hubfam.qzLoading") : t("hubfam.qzShowMore", { n: total - list.length })}</Button>
            </div>
          )}
        </>
      )}

      {diag && !p.readOnly && <WaiveCard p={p} diagSubjects={diagSubjects} />}

      {editing && <AssessmentBuilder key={editing === "new" ? "new" : editing.id} p={p} type={type} assessment={editing === "new" ? null : editing} all={list} onClose={() => setEditing(null)}
        onSaved={(forked) => { setEditing(null); reload(); if (forked) setFlash(t(`hubfam.qzAlForkSave${Q}`)); }}
        onOpenOther={p.readOnly ? undefined : async (id) => { const a = await get<Assessment>(hubPath(p.qs, `/assessments/${id}`)); if (!canChangeRow(p.franchiseId, a.franchiseId)) throw new Error(t(`hubfam.qzAlNotYours${Q}`)); setEditing(a); }}
        onStartNew={() => setEditing("new")} />}
      {preview && <PreviewModal p={p} a={preview} onClose={() => setPreview(null)} />}
      {confirmDel && (
        <Modal title={t(`hubfam.qzAlDelTitle${Q}`)} onClose={() => setConfirmDel(null)}
          footer={<><Button variant="ghost" className={TAP} onClick={() => setConfirmDel(null)}>{t("hubfam.qzKeepIt")}</Button><Button variant="danger" className={TAP} disabled={busy === confirmDel.id} onClick={() => remove(confirmDel)} data-autofocus>{t("hubfam.qzDelete")}</Button></>}>
          <p className="m-0 text-[14px] leading-relaxed text-[var(--ink-2)]">{t("hubfam.qzAlDelBody", { title: confirmDel.title })}</p>
        </Modal>
      )}
    </div>
  );
}

/** Five 20-point score bands as tiny columns; bars at/above the pass mark are green, the rest amber. */
function Spread({ dist, passMark, diag }: { dist: number[]; passMark: number; diag: boolean }) {
  const { t, tp } = useHubI18n();
  const max = Math.max(1, ...dist);
  const g = useGrow(1, 120);
  const labels = ["0–19", "20–39", "40–59", "60–79", "80–100"];
  return (
    <div>
      <div role="img" aria-label={t("hubfam.qzAlSpreadAria", { list: dist.map((n, i) => `${labels[i]}% ${n}`).join(", ") })} className="flex h-[34px] items-end gap-[3px]">
        {dist.map((n, i) => {
          const mid = i * 20 + 10;
          const fill = diag ? "var(--brand)" : mid >= passMark ? "var(--green)" : "var(--gold)";
          return (
            <span key={i} title={t("hubfam.qzAlSpreadTitle", { range: labels[i]!, students: tp("hubfam.qzStudents", n) })} className="w-[18px] rounded-t-[4px]"
              style={{ height: n ? Math.max(5, (n / max) * 34) * g : 2, background: n ? fill : "var(--line)", transition: "height 600ms cubic-bezier(.2,.8,.2,1)" }} />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[11px] font-bold tabular-nums text-[var(--ink-3)]"><span>0</span><span>100%</span></div>
    </div>
  );
}

function TutorCard({ a, s, statsReady, diag, p, mix, busy, onEdit, onToggle, onDelete, onGoMarking, onPreview, onAssign }: {
  a: Assessment; s: AssessStats; statsReady: boolean; diag: boolean; p: PanelProps; mix: { label: string; n: number }[]; busy: boolean; onEdit: () => void; onToggle: () => void; onDelete: () => void; onGoMarking?: () => void; onPreview: () => void; onAssign: () => void;
}) {
  const { t, tp } = useHubI18n();
  const qn = a.questionCount ?? a.questionIds?.length ?? 0;
  const mine = canChangeRow(p.franchiseId, a.franchiseId);
  const chips = audienceChips(a.audience, p.config.yearGroups);
  const rp = effectivePolicy(a, p.config);
  const topicNames = a.topicIds.map((id) => p.topics.find((x) => x.id === id)).filter(Boolean).map((tt) => topicLabel(tt!).split(" › ").slice(1).join(" › ")).filter(Boolean);
  return (
    <Card className={`flex flex-col overflow-hidden ${LIFT}`} id={`hub-assessment-${a.id}`}>
      <SubjectCover subject={a.subject} height={62} rounded="rounded-none">
        <div className="flex h-[62px] items-center justify-between gap-2 px-4">
          <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-2)]"><SubjectGlyph subject={a.subject} size={15} /><span className="truncate">{a.subject}</span></span>
          {a.published ? <Chip tone={OK} icon={<span className="h-1.5 w-1.5 rounded-full bg-[var(--green)]" />}>{t("hubfam.qzAlPublished")}</Chip> : <Chip tone={GOLD} icon={<span className="h-1.5 w-1.5 rounded-full border border-[var(--gold)]" />}>{t("hubfam.qzAlDraft")}</Chip>}
        </div>
      </SubjectCover>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h4 className="m-0 text-[16px] font-extrabold leading-snug text-[var(--ink)] [overflow-wrap:anywhere]" style={display}>{a.title}</h4>
          <div className="mt-1 text-[12px] font-semibold text-[var(--ink-3)]">
            {[tp("hubfam.qzQuestions", qn), a.totalMarks != null ? tp("hubfam.qzMarks", a.totalMarks) : null, a.timeLimitMins ? t("hubfam.qzAlMin", { n: a.timeLimitMins }) : t("hubfam.qzAlUntimed"), diag ? null : t("hubfam.qzAlPass", { n: a.passMarkPct })].filter(Boolean).join(" · ")}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5" data-testid="hub-card-audience">
            {chips.length > 0
              ? chips.map((c) => <span key={c} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold" style={{ background: BRAND.soft, color: BRAND.ink }}><Icon name="users" size={11} strokeWidth={2} />{c}</span>)
              : <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--ink-3)]"><Icon name="users" size={11} strokeWidth={2} />{t("hubfam.qzAlEveryone")}</span>}
            {a.eligibleCount != null && <span className="text-[11px] font-semibold text-[var(--ink-3)]">{t("hubfam.qzAlEligible", { students: tp("hubfam.qzStudents", a.eligibleCount) })}</span>}
            {rp.policy !== "unlimited" && <span className="text-[11px] font-semibold text-[var(--ink-3)]">· {policyLabel(rp.policy, rp.hours).toLowerCase()}</span>}
          </div>
          {mix.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1" aria-label={t("hubfam.qzAlKindsAria")}>
              {mix.slice(0, 4).map((m) => <span key={m.label} className="inline-flex items-center gap-1 rounded-md bg-[var(--panel)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--ink-2)]"><b className="tabular-nums text-[var(--ink)]">{m.n}</b> {m.label}</span>)}
              {mix.length > 4 && <span className="px-1 text-[11px] font-bold text-[var(--ink-3)]">+{mix.length - 4}</span>}
            </div>
          )}
          {topicNames.length > 0 && <div className="mt-1.5 line-clamp-1 text-[11.5px] text-[var(--ink-3)]">{topicNames.join(" · ")}</div>}
        </div>

        <div className="mt-auto rounded-xl bg-[var(--panel)] p-3">
          {!statsReady ? (
            <div aria-hidden className="h-[52px] animate-pulse rounded-lg bg-[var(--line)]/60" />
          ) : s.attempts === 0 ? (
            <div className="flex items-center gap-2.5 text-[12.5px] leading-snug text-[var(--ink-3)]">
              <span className="grid h-9 w-9 flex-none place-items-center rounded-full border-2 border-dashed border-[var(--line)]" aria-hidden><Icon name="users" size={16} /></span>
              {a.published ? t("hubfam.qzAlNoAttempts") : t("hubfam.qzAlPublishFirst")}
            </div>
          ) : (
            <div className="flex items-end gap-4">
              <div className="min-w-[64px]">
                <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]">{diag ? t("hubfam.qzAlAvgStartShort") : t("hubfam.qzAlAverage")}</div>
                <div className="mt-0.5 text-[26px] font-extrabold leading-none tabular-nums text-[var(--ink)]" style={display}>{s.avg != null ? `${Math.round(s.avg)}%` : "–"}</div>
                <div className="mt-1 text-[11px] font-semibold tabular-nums text-[var(--ink-3)]">{s.students > 0 && s.students !== s.attempts ? t("hubfam.qzAlAttemptsStudents", { attempts: tp("hubfam.qzAttempts", s.attempts), students: tp("hubfam.qzStudents", s.students) }) : tp("hubfam.qzAttempts", s.attempts)}</div>
              </div>
              {s.marked > 0 && <div className="ms-auto"><Spread dist={s.dist} passMark={a.passMarkPct} diag={diag} /></div>}
              {s.marked > 0 && !diag && <div className="text-end text-[11px] font-semibold leading-snug text-[var(--ink-3)]"><b className="block text-[15px] tabular-nums text-[var(--ink)]" style={display}>{s.passed}/{s.marked}</b>{t("hubfam.qzAlPassedWord")}</div>}
            </div>
          )}
          {statsReady && s.toMark > 0 && (
            <button type="button" onClick={onGoMarking} disabled={!onGoMarking} className={`mt-2.5 inline-flex min-h-[44px] lg:min-h-[36px] items-center gap-1.5 rounded-full px-3 text-[12px] font-extrabold hover:brightness-95 ${FOCUS}`} style={{ background: BRAND.soft, color: BRAND.ink }}>
              <HourglassIcon size={13} />{t("hubfam.qzAlNToMark", { n: s.toMark })}<DirArrow />
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--line)] px-4 py-3">
        {!p.readOnly && <Button variant="solid" className={TAP} onClick={onAssign} data-testid="hub-assessment-assign" title={a.published ? undefined : t("hubfam.qzAlDraftHint")}>{t("hubfam.qzAlSetFor")}</Button>}
        <Button variant="ghost" className={TAP} onClick={onPreview} data-testid="hub-assessment-preview">{t("hubfam.qzAlPreview")}</Button>
        {mine && !p.readOnly && <Button variant="ghost" className={TAP} onClick={onEdit}>{t("hubfam.qzEdit")}</Button>}
        {mine && !p.readOnly && <Button variant="ghost" className={TAP} disabled={busy} onClick={onToggle}>{a.published ? t("hubfam.qzUnpublish") : t("hubfam.qzPublish")}</Button>}
        {!mine && <span data-testid="hub-from-head-office" className="text-[11.5px] font-bold text-[var(--ink-3)]" title={t("hubfam.qzAlHeadTitle")}>{t("hubfam.qzFromHead")}</span>}
        {mine && !p.readOnly && <button type="button" aria-label={t("hubfam.qzAlDelAria", { title: a.title })} onClick={onDelete} className={`ms-auto grid h-11 w-11 place-items-center rounded-full border border-[var(--line)] text-[var(--ink-3)] transition-colors hover:border-[var(--red-line)] hover:bg-[var(--red-soft)] hover:text-[var(--red)] ${FOCUS}`}><Icon name="trash" size={17} /></button>}
      </div>
    </Card>
  );
}


/** A read-only look at a paper's questions (prompts and marks) — so a tutor can check what they're about to set. */
function PreviewModal({ p, a, onClose }: { p: PanelProps; a: Assessment; onClose: () => void }) {
  const { t, tp } = useHubI18n();
  const [rows, setRows] = useState<{ id: string; kind: string; prompt: string; marks: number }[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    get<{ questions?: { id: string; kind: string; prompt: string; marks: number }[] }>(hubPath(p.qs, `/assessments/${a.id}`))
      .then((r) => { if (live) setRows(r.questions ?? []); }).catch(() => { if (live) { setFailed(true); setRows([]); } });
    return () => { live = false; };
  }, [p.qs, a.id]);
  return (
    <Modal title={a.title} onClose={onClose} wide id="hub-assessment-preview"
      footer={<Button variant="ghost" className={TAP} onClick={onClose} data-autofocus>{t("hubfam.qzClose")}</Button>}>
      {rows === null ? <div aria-busy="true" className="h-[80px] animate-pulse rounded-xl bg-[var(--panel)]" />
        : failed ? <p className="m-0 text-[13px] text-[var(--ink-2)]">{t("hubfam.qzAlPrevFail")}</p>
        : rows.length === 0 ? <p className="m-0 text-[13px] text-[var(--ink-2)]">{t("hubfam.qzAlPrevNone")}</p>
        : (
          <ol className="m-0 grid list-none gap-2 p-0">
            {rows.map((q, i) => (
              <li key={q.id} className="flex gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5">
                <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-[var(--panel)] text-[11.5px] font-extrabold tabular-nums text-[var(--ink-2)]">{i + 1}</span>
                <span className="min-w-0 flex-1 text-[13px] leading-snug text-[var(--ink)] [overflow-wrap:anywhere]">{q.prompt}</span>
                <span className="flex-none text-[11.5px] font-bold text-[var(--ink-3)]">{tp("hubfam.qzMarks", q.marks)}</span>
              </li>
            ))}
          </ol>
        )}
    </Modal>
  );
}
