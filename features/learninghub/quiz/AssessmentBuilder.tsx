"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, FieldLabel, Input, Select } from "@/components/ui";
import { get, post, put } from "@/lib/api";
import type { PanelProps } from "../panelTypes";
import { canChangeRow, errMsg } from "../types";
import { Icon } from "../kit";
import { hubPath, NO_AUDIENCE, ruleOf, type Assessment, type AssessType, type Audience, type QLite, type QPage, type RetakeOverride } from "../shared-assess/api";
import type { Student } from "../types";
import { audienceChips } from "../shared-assess/audience";
import { effectivePolicy, policyLabel } from "../shared-assess/retake";
import { topicShort } from "../shared-assess/format";
import { Chip, FOCUS, Modal, Notice, Segmented, Switch, TAP } from "../shared-assess/ui";
import { NEUTRAL } from "../shared-assess/format";
import { QuestionForm } from "./QuestionForm";
import { kindText } from "./kindLabel";
import { CreatorTabs, DiscardStrip, ExistingPicker, type ExistingPage, type ExistingQuery } from "../EditExisting";
import type { AssessmentPage } from "./useAssessmentPage";
import { NewTopicInline, useTopicsWithNew } from "../NewTopicInline";
import { useHubI18n } from "../family/hubT";

const BRANDT = { fill: "var(--brand)", soft: "var(--brand-soft)", ink: "var(--brand-strong)" };

// Build / edit a quiz or placement test: pick the subject and topics, choose and
// order questions (or write one on the spot), set timing and pass mark, publish.

export function AssessmentBuilder({ p, type: initialType, assessment, all, onClose, onSaved, onOpenOther, onStartNew }: {
  p: PanelProps; type: AssessType; assessment: Assessment | null; all: Assessment[]; onClose: () => void; /** `forked`: the save landed on a NEW copy (the original was head office's / shared) rather than `assessment.id`. */ onSaved: (forked?: boolean) => void;
  /** "Edit existing" tab: open another paper (the list swaps the builder over to it). Without it the tab strip is not shown. */
  onOpenOther?: (id: string) => Promise<void>;
  /** "New" tab while editing an existing paper: swap over to a blank builder. */
  onStartNew?: () => void;
}) {
  const { t, tp } = useHubI18n();
  // Topics created here ("+ New subject / topic") are usable at once, before the realtime refetch lands.
  const [allTopics, rememberTopic] = useTopicsWithNew(p.topics);
  const subjects = useMemo(() => [...new Set(allTopics.map((x) => x.subject))].sort((a, b) => a.localeCompare(b)), [allTopics]);
  const [type, setType] = useState<AssessType>(assessment?.type ?? initialType);
  const [title, setTitle] = useState(assessment?.title ?? "");
  const [subject, setSubject] = useState(assessment?.subject ?? p.filter.subject ?? subjects[0] ?? "");
  const [topicIds, setTopicIds] = useState<string[]>(assessment?.topicIds ?? (p.filter.topicId ? [p.filter.topicId] : []));
  const [qids, setQids] = useState<string[]>(assessment?.questionIds ?? []);
  const [timed, setTimed] = useState(!!assessment?.timeLimitMins);
  const [mins, setMins] = useState(String(assessment?.timeLimitMins ?? 20));
  const [pass, setPass] = useState(String(assessment?.passMarkPct ?? p.config.passMarkPct));
  const [published, setPublished] = useState(assessment?.published ?? false);
  const [aud, setAud] = useState<Audience>(assessment?.audience ?? NO_AUDIENCE);
  // Diagnostics only: who it is actually assigned to. `null` = untouched legacy (every audience-fitting
  // student counts, same as before assignment existed) — a brand-new diagnostic starts at `[]`, forcing an
  // explicit choice. The moment the tutor toggles a checkbox this becomes a real array (see `toggleAssigned`).
  const [assigned, setAssigned] = useState<string[] | null>(() => (assessment?.assignedChildIds !== undefined ? assessment.assignedChildIds : assessment ? null : []));
  const [retake, setRetake] = useState<RetakeOverride>(assessment?.retakePolicy ?? "inherit");
  const [cool, setCool] = useState(String(assessment?.retakeCooldownHours ?? p.config.retakeCooldownHours ?? 24));
  const [search, setSearch] = useState("");
  const [newQ, setNewQ] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // "Edit existing" tab: the picker replaces the form (whatever is typed stays underneath until another paper is chosen).
  const [picking, setPicking] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const snapNow = JSON.stringify([type, title, subject, topicIds, qids, timed, mins, pass, published, aud, retake, cool, assigned]);
  const initialSnap = useRef<string | null>(null);
  if (initialSnap.current === null) initialSnap.current = snapNow;
  const dirty = snapNow !== initialSnap.current;

  // Questions already in the paper (from GET /assessments/:id) + ones added from the picker: id → light row. The picker
  // itself never holds the bank — it asks for one topic's questions at a time (paged, searchable).
  const [known, setKnown] = useState<Map<string, QLite>>(() => new Map((assessment?.questions ?? []).map((q) => [q.id, q] as const)));
  const qById = known;
  const subjectTopics = useMemo(() => allTopics.filter((x) => x.subject === subject).sort((a, b) => topicShort(a).localeCompare(topicShort(b))), [allTopics, subject]);
  // A subject can have ~140 topic + "Year N" subtopic rows: show the topics, and a chosen topic's subtopics beneath (a small subject shows all).
  const chips = useMemo(() => (subjectTopics.length <= 24 ? subjectTopics : subjectTopics.filter((x) => !x.parentTopicId || topicIds.includes(x.parentTopicId) || topicIds.includes(x.id))), [subjectTopics, topicIds]);
  const scope = useMemo(() => {
    if (!topicIds.length) return new Set(subjectTopics.map((x) => x.id));
    const s = new Set(topicIds);
    for (const x of subjectTopics) if (x.parentTopicId && s.has(x.parentTopicId)) s.add(x.id);
    return s;
  }, [topicIds, subjectTopics]);
  // ── the picker: GET /questions?light=1 scoped to the chosen topics (else the subject), searched server-side ──
  const [pool, setPool] = useState<QLite[]>([]);
  const [poolTotal, setPoolTotal] = useState(0);
  const [poolNext, setPoolNext] = useState<string | null>(null);
  const [poolBusy, setPoolBusy] = useState(false);
  const [dSearch, setDSearch] = useState("");
  // A quiz for Year 5 draws on Year 5 questions: while the quiz has year groups the bank is narrowed to them (switch off to see every year).
  // Off by default: a freshly-written question has no year yet, so narrowing by default would hide it from its own quiz.
  const [yearOnly, setYearOnly] = useState(false);
  const yearKey = yearOnly ? aud.yearGroups.join(",") : "";
  const poolSeq = useRef(0);
  const [poolTick, setPoolTick] = useState(0);
  useEffect(() => { const h = setTimeout(() => setDSearch(search.trim()), 250); return () => clearTimeout(h); }, [search]);
  const poolPath = useCallback((cursor: string | null) => hubPath(p.qs, "/questions", {
    light: "1", sort: "prompt", limit: "30", cursor, subject, ...(topicIds.length ? { topicIds: topicIds.join(",") } : {}), q: dSearch || null, yearGroup: yearKey || null,
  }), [p.qs, subject, topicIds, dSearch, yearKey]);
  const loadPool = useCallback((more: boolean, cursor: string | null = null) => {
    const mine = ++poolSeq.current;
    setPoolBusy(true);
    get<QPage>(poolPath(more ? cursor : null))
      .then((r) => {
        if (mine !== poolSeq.current) return;
        setPool((cur) => (more ? [...cur, ...r.items.filter((x) => !cur.some((c) => c.id === x.id))] : r.items));
        setPoolTotal(r.total); setPoolNext(r.nextCursor);
      })
      .catch((e) => { if (mine === poolSeq.current) setErr(errMsg(e, t("hubfam.qzAbPoolFail"))); })
      .finally(() => { if (mine === poolSeq.current) setPoolBusy(false); });
  }, [poolPath]);
  useEffect(() => { loadPool(false); }, [loadPool, poolTick]);
  const shownPool = useMemo(() => pool.filter((q) => !qids.includes(q.id)), [pool, qids]);
  const addQ = (q: QLite) => { setKnown((m) => new Map(m).set(q.id, q)); setQids((c) => (c.includes(q.id) ? c : [...c, q.id])); };
  const chosen = qids.map((id) => qById.get(id)).filter((q): q is QLite => !!q);
  const totalMarks = chosen.reduce((s, q) => s + q.marks, 0);

  const toggleYear = (y: string) => setAud((a) => ({ ...a, yearGroups: a.yearGroups.includes(y) ? a.yearGroups.filter((x) => x !== y) : [...a.yearGroups, y] }));
  const audience: Audience = { yearGroups: aud.yearGroups, ageMin: null, ageMax: null };
  // Same rule as the server (assessments.ts otherPublishedDiagnostic): a clash is the same subject AND the same audience.
  const audKey = (a?: Audience) => `${[...(a?.yearGroups ?? [])].map((g) => g.toLowerCase()).sort().join("|")}#${a?.ageMin ?? ""}-${a?.ageMax ?? ""}`;
  const clash = type === "diagnostic" && published ? all.find((a) => a.type === "diagnostic" && a.published && a.subject.toLowerCase() === subject.toLowerCase() && a.id !== assessment?.id && audKey(a.audience) === audKey(audience)) : undefined;
  const writtenCount = chosen.filter((q) => ruleOf(p.config.questionKinds, q.kind) === "manual").length;
  const inherited = effectivePolicy({ retakePolicy: "inherit", retakeCooldownHours: null }, p.config);

  // Diagnostics only: enrolled, active students this audience actually reaches (mirrors the server's
  // audienceFit — a student whose year group isn't tagged is still offered, never silently excluded).
  const audienceYearGroups = aud.yearGroups;
  const fittingStudents: Student[] = useMemo(() => {
    if (type !== "diagnostic") return [];
    return p.students
      .filter((s) => s.active !== false && (!s.subjects.length || s.subjects.some((x) => x.toLowerCase() === subject.toLowerCase())))
      .filter((s) => !audienceYearGroups.length || !s.yearGroup || audienceYearGroups.some((y) => y.toLowerCase() === s.yearGroup!.toLowerCase()))
      .sort((a, b) => a.childName.localeCompare(b.childName));
  }, [p.students, type, subject, audienceYearGroups]);
  const fittingIds = useMemo(() => fittingStudents.map((s) => s.childId), [fittingStudents]);
  // `assigned === null` (untouched legacy) reads as "every fitting student", until the tutor touches a
  // checkbox — at which point it becomes a real, explicit list (see `toggleAssigned`).
  const isAssigned = (childId: string) => (assigned === null ? fittingIds.includes(childId) : assigned.includes(childId));
  const toggleAssigned = (childId: string) => setAssigned((cur) => { const base = cur === null ? fittingIds : cur; return base.includes(childId) ? base.filter((x) => x !== childId) : [...base, childId]; });
  const assignedCount = assigned === null ? fittingIds.length : assigned.filter((id) => fittingIds.includes(id)).length;

  const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= qids.length) return; const n = [...qids]; [n[i], n[j]] = [n[j], n[i]]; setQids(n); };
  const toggleTopic = (id: string) => setTopicIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const save = async () => {
    setErr(null);
    if (!title.trim()) return setErr(t("hubfam.qzAbErrTitle"));
    if (!subject) return setErr(t("hubfam.qzAbErrSubject"));
    if (published && !qids.length) return setErr(t("hubfam.qzAbErrNoQ"));
    if (published && chosen.some((q) => !q.published)) return setErr(t("hubfam.qzAbErrUnpub"));
    const passN = Number(pass);
    if (!(passN >= 0 && passN <= 100)) return setErr(t("hubfam.qzAbErrPass"));
    if (timed && !(Number(mins) >= 1)) return setErr(t("hubfam.qzAbErrTime"));
    if (retake === "cooldown" && !(Number(cool) >= 1 && Number(cool) <= 720)) return setErr(t("hubfam.qzAbErrCool"));
    setBusy(true);
    try {
      const body = { audience, retakePolicy: retake, ...(retake === "cooldown" ? { retakeCooldownHours: Math.round(Number(cool)) } : {}), type, title: title.trim(), subject, topicIds: topicIds.length ? topicIds : [...new Set(chosen.map((q) => q.topicId))], questionIds: qids, timeLimitMins: timed ? Math.round(Number(mins)) : null, ...(type === "quiz" ? { passMarkPct: Math.round(passN) } : {}), ...(type === "diagnostic" ? { assignedChildIds: assigned === null ? fittingIds : assigned } : {}), published };
      if (assessment) {
        // A head-office (shared-library) quiz can't be edited in place — the server forks it into
        // a new one owned by this tenant instead, and says so with `forked: true`. Nothing here
        // keeps editing `assessment.id` afterwards (the builder closes on save), but the caller
        // needs to know so it can tell the tutor what actually happened.
        const r = await put<{ forked?: boolean }>(hubPath(p.qs, `/assessments/${assessment.id}`), body);
        onSaved(r.forked === true);
      } else {
        await post(hubPath(p.qs, "/assessments"), body);
        onSaved(false);
      }
    } catch (e) { setErr(errMsg(e, t("hubfam.qzAbSaveFail"))); }
    finally { setBusy(false); }
  };

  const diagT = type === "diagnostic";
  const label = diagT ? t("hubfam.qzNounTest") : t("hubfam.qzNounQuiz");
  const fetchExisting = useCallback(async (x: ExistingQuery): Promise<ExistingPage> => {
    const r = await get<AssessmentPage>(hubPath(p.qs, "/assessments", { light: "1", limit: "20", cursor: x.cursor, type, ...(x.topicId ? { topicId: x.topicId } : x.subject ? { subject: x.subject } : {}), yearGroup: x.yearGroup || null, q: x.q || null }));
    return { rows: r.items.map((a) => ({ id: a.id, title: a.title, draft: !a.published, meta: [a.subject, a.questionCount != null ? tp("hubfam.qzQuestions", a.questionCount) : null, !canChangeRow(p.franchiseId, a.franchiseId) ? t("hubfam.qzFromHeadRO") : null].filter(Boolean).join(" · ") })), total: r.total, next: r.nextCursor };
  }, [p.qs, p.franchiseId, type]);
  const pickExisting = async (row: { id: string }) => { await onOpenOther?.(row.id); };
  const onTab = (m: "new" | "existing") => {
    if (m === "existing") { setPicking(true); return; }
    if (assessment) { if (dirty) setConfirmNew(true); else onStartNew?.(); return; }
    setPicking(false);
  };
  return (
    <>
      <Modal wide title={assessment ? (diagT ? t("hubfam.qzAbEditT") : t("hubfam.qzAbEditQ")) : (diagT ? t("hubfam.qzAbNewT") : t("hubfam.qzAbNewQ"))} onClose={onClose} id="hub-assessment-builder"
        footer={<>
          <Button variant="ghost" className={TAP} onClick={onClose}>{t("hubfam.qzCancel")}</Button>
          <Button variant="solid" className={`${TAP} !px-6`} onClick={save} disabled={busy || picking} data-testid="hub-save-assessment">{busy ? t("hubfam.qzSaving") : published ? t("hubfam.qzAbSavePub") : t("hubfam.qzAbSaveDraft")}</Button>
        </>}>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
          {err && <Notice onDismiss={() => setErr(null)}>{err}</Notice>}
          {onOpenOther && <CreatorTabs mode={picking || assessment ? "existing" : "new"} onChange={onTab} noun={diagT ? t("hubfam.qzNounTestCap") : t("hubfam.qzNounQuizCap")} />}
          {confirmNew && <DiscardStrip message={diagT ? t("hubfam.qzAbStartNewT") : t("hubfam.qzAbStartNewQ")} confirmLabel={t("hubfam.qzAbDiscardNew")} onKeep={() => setConfirmNew(false)} onConfirm={() => onStartNew?.()} testId="edit-existing-confirm-new" />}
          {picking && onOpenOther ? (
            <ExistingPicker noun={label} topics={p.topics} fetchPage={fetchExisting} onPick={pickExisting} onError={p.onError}
              initialSubject={p.filter.subject ?? ""} initialTopicId={p.filter.topicId ?? ""} yearGroups={p.config.yearGroups}
              guard={dirty ? (diagT ? t("hubfam.qzAbUnsavedT") : t("hubfam.qzAbUnsavedQ")) : null} />
          ) : (<>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div>
              <FieldLabel htmlFor="ha-title">{t("hubfam.qzTitle")}</FieldLabel>
              <Input id="ha-title" data-autofocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={diagT ? t("hubfam.qzAbTitlePhTest") : t("hubfam.qzAbTitlePhQuiz")} className="min-h-[44px] w-full" />
            </div>
            <div>
              <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">{t("hubfam.qzType")}</div>
              <Segmented label={t("hubfam.qzType")} value={type} onChange={(v) => { if (!assessment) setType(v); }} options={[{ id: "quiz", label: t("hubfam.qzNounQuizCap") }, { id: "diagnostic", label: t("hubfam.qzNounTestCap") }]} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="ha-subject">{t("hubfam.qzSubject")}</FieldLabel>
              <Select id="ha-subject" value={subject} onChange={(e) => { setSubject(e.target.value); setTopicIds([]); }} className="min-h-[44px] w-full">
                {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {type === "quiz" && (
                <div>
                  <FieldLabel htmlFor="ha-pass">{t("hubfam.qzAbPass")}</FieldLabel>
                  <Input id="ha-pass" type="number" min={0} max={100} value={pass} onChange={(e) => setPass(e.target.value)} className="min-h-[44px] w-full tabular-nums" />
                </div>
              )}
              <div className={type === "quiz" ? "" : "col-span-2"}>
                <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">{t("hubfam.qzAbTimeLimit")}</div>
                <div className="flex items-center gap-2">
                  <Switch on={timed} onChange={setTimed} label={timed ? "" : t("hubfam.qzOff")} />
                  {timed && <><Input aria-label={t("hubfam.qzAbMinutes")} type="number" min={1} value={mins} onChange={(e) => setMins(e.target.value)} className="min-h-[44px] w-[80px] tabular-nums" /><span className="text-[12.5px] text-[var(--ink-3)]">{t("hubfam.qzAbMinUnit")}</span></>}
                </div>
              </div>
            </div>
          </div>

          {subjectTopics.length > 0 && (
            <div>
              <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">{t("hubfam.qzAbTopics")} <span className="normal-case tracking-normal">{t("hubfam.qzAbTopicsNote")}</span></div>
              <div className="flex flex-wrap gap-1.5">
                {chips.map((tc) => {
                  const on = topicIds.includes(tc.id);
                  return <button key={tc.id} type="button" aria-pressed={on} onClick={() => toggleTopic(tc.id)} className={`min-h-[44px] lg:min-h-[40px] rounded-full border px-3.5 text-[12.5px] font-bold transition-colors ${FOCUS} ${on ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] hover:border-[var(--brand)]"}`}>{topicShort(tc)}</button>;
                })}
              </div>
            </div>
          )}
          <NewTopicInline qs={p.qs} topics={allTopics} subject={subject} canCreate={p.canEdit && !p.readOnly} testId="quiz-new-topic"
            onCreated={(nt, kind) => { rememberTopic(nt); setSubject(nt.subject); setTopicIds(kind === "topic" ? [nt.id] : []); }} />

          <section aria-label={t("hubfam.qzAbWho")} className="grid grid-cols-[minmax(0,1fr)] gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3.5 sm:p-4" data-testid="hub-audience">
            <div>
              <h4 className="m-0 flex items-center gap-1.5 text-[13px] font-extrabold text-[var(--ink)]"><Icon name="users" size={15} />{t("hubfam.qzAbWho")}</h4>
              <p className="m-0 mt-0.5 text-[12px] leading-snug text-[var(--ink-3)]">{diagT ? t("hubfam.qzAbWhoBodyT") : t("hubfam.qzAbWhoBodyQ")}</p>
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("hubfam.qzYgList")}>
              {p.config.yearGroups.map((y) => {
                const on = aud.yearGroups.includes(y);
                return <button key={y} type="button" aria-pressed={on} onClick={() => toggleYear(y)} className={`min-h-[44px] lg:min-h-[40px] rounded-full border px-3.5 text-[12.5px] font-bold transition-colors ${FOCUS} ${on ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] hover:border-[var(--brand)]"}`}>{y}</button>;
              })}
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[160px] flex-1 pb-1.5" aria-live="polite">
                {audienceChips(audience, p.config.yearGroups).length ? (
                  <div className="flex flex-wrap gap-1.5" data-testid="hub-audience-summary">{audienceChips(audience, p.config.yearGroups).map((c) => <Chip key={c} tone={BRANDT}>{c}</Chip>)}</div>
                ) : <span className="text-[12px] font-semibold text-[var(--ink-3)]">{diagT ? t("hubfam.qzAbEveryoneT") : t("hubfam.qzAbEveryoneQ")}</span>}
              </div>
            </div>
            <p className="m-0 text-[11.5px] text-[var(--ink-3)]">{diagT ? t("hubfam.qzAbYgNoteT") : t("hubfam.qzAbYgNoteQ")}</p>
          </section>

          {diagT && (
            <section aria-label={t("hubfam.qzAbAssign")} className="grid grid-cols-[minmax(0,1fr)] gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3.5 sm:p-4" data-testid="hub-diag-assign">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h4 className="m-0 flex items-center gap-1.5 text-[13px] font-extrabold text-[var(--ink)]"><Icon name="users" size={15} />{t("hubfam.qzAbAssign")}</h4>
                  <p className="m-0 mt-0.5 text-[12px] leading-snug text-[var(--ink-3)]">{t("hubfam.qzAbAssignBody")}</p>
                </div>
                {fittingStudents.length > 0 && <Chip tone={NEUTRAL}>{t("hubfam.qzAbAssignCount", { n: assignedCount, total: fittingStudents.length })}</Chip>}
              </div>
              {fittingStudents.length === 0 ? (
                <p className="m-0 text-[12.5px] text-[var(--ink-3)]">{t("hubfam.qzAbAssignNone")}</p>
              ) : (<>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="ghost" className={TAP} onClick={() => setAssigned([...fittingIds])} data-testid="hub-diag-assign-all">{t("hubfam.qzAbAssignAll")}</Button>
                  <Button type="button" variant="ghost" className={TAP} onClick={() => setAssigned([])} data-testid="hub-diag-assign-none">{t("hubfam.qzAbAssignNoneBtn")}</Button>
                </div>
                <div className="grid max-h-[220px] grid-cols-1 gap-1 overflow-y-auto pe-0.5 sm:grid-cols-2" role="group" aria-label={t("hubfam.qzAbAssign")}>
                  {fittingStudents.map((s) => {
                    const on = isAssigned(s.childId);
                    return (
                      <label key={s.childId} className={`flex min-h-[40px] cursor-pointer items-center gap-2 rounded-lg border px-2.5 text-[12.5px] font-semibold transition-colors ${FOCUS} ${on ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)]"}`}>
                        <input type="checkbox" checked={on} onChange={() => toggleAssigned(s.childId)} className="h-4 w-4" data-testid="hub-diag-assign-student" />
                        <span className="min-w-0 flex-1 truncate">{s.childName}{s.yearGroup ? ` · ${s.yearGroup}` : ""}</span>
                      </label>
                    );
                  })}
                </div>
              </>)}
              {assignedCount === 0 && <Notice tone="warn">{t("hubfam.qzAbAssignWarn")}</Notice>}
            </section>
          )}

          <section aria-label={t("hubfam.qzAbRetakes")} className="grid grid-cols-[minmax(0,1fr)] gap-2 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3.5 sm:p-4" data-testid="hub-retake-override">
            <div>
              <h4 className="m-0 text-[13px] font-extrabold text-[var(--ink)]">{t("hubfam.qzAbRetakes")}</h4>
              <p className="m-0 mt-0.5 text-[12px] leading-snug text-[var(--ink-3)]">{t("hubfam.qzAbRetakeBody", { policy: policyLabel(inherited.policy, inherited.hours).toLowerCase() })}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="max-w-full overflow-x-auto"><Segmented<RetakeOverride> label={t("hubfam.qzAbRetakePolicy")} value={retake} onChange={setRetake} options={[{ id: "inherit", label: t("hubfam.qzAbRtInherit") }, { id: "unlimited", label: t("hubfam.qzAbRtUnlimited") }, { id: "once", label: t("hubfam.qzAbRtOnce") }, { id: "cooldown", label: t("hubfam.qzAbRtCool") }]} /></div>
              {retake === "cooldown" && <span className="inline-flex items-center gap-2"><Input aria-label={t("hubfam.qzAbHoursAria")} type="number" min={1} max={720} value={cool} onChange={(e) => setCool(e.target.value)} className="min-h-[44px] w-[84px] tabular-nums" /><span className="text-[12.5px] text-[var(--ink-3)]">{t("hubfam.qzAbHours")}</span></span>}
            </div>
            {retake === "once" && <p className="m-0 text-[11.5px] text-[var(--ink-3)]">{t("hubfam.qzAbOnceNote")}</p>}
          </section>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <section aria-label={t("hubfam.qzAbQsAria")} className="min-w-0">
              <div className="mb-1.5 flex items-baseline justify-between"><h4 className="m-0 text-[13px] font-extrabold text-[var(--ink)]">{diagT ? t("hubfam.qzAbInThisT") : t("hubfam.qzAbInThisQ")} <span className="font-semibold text-[var(--ink-3)]">{t("hubfam.qzAbCounts", { questions: tp("hubfam.qzQuestions", chosen.length), marks: tp("hubfam.qzMarks", totalMarks) })}</span></h4></div>
              {chosen.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--line)] px-4 py-8 text-center text-[12.5px] text-[var(--ink-3)]">{t("hubfam.qzAbNothingYet")}</div>
              ) : (
                <ol className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-1.5 p-0">
                  {chosen.map((q, i) => (
                    <li key={q.id} className="flex min-w-0 items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] py-1.5 ps-3 pe-1.5">
                      <span className="w-5 flex-none text-[12px] font-extrabold tabular-nums text-[var(--ink-3)]">{i + 1}</span>
                      <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-semibold text-[var(--ink)]">{q.prompt}</div><div className="text-[11px] text-[var(--ink-3)]">{kindText(t, p.config.questionKinds, q.kind)}{ruleOf(p.config.questionKinds, q.kind) === "manual" ? <b className="font-extrabold text-[var(--brand-strong)]">{t("hubfam.qzAbWritten")}</b> : null} · {tp("hubfam.qzMarks", q.marks)}{q.hasImage ? t("hubfam.qzAbPicTag") : ""}{q.published ? "" : t("hubfam.qzAbDraftTag")}</div></div>
                      <button type="button" aria-label={t("hubfam.qzAbMoveUp", { n: i + 1 })} disabled={i === 0} onClick={() => move(i, -1)} className={`grid h-11 w-9 place-items-center rounded-lg text-[var(--ink-2)] hover:bg-[var(--panel)] disabled:opacity-25 ${FOCUS}`}>↑</button>
                      <button type="button" aria-label={t("hubfam.qzAbMoveDown", { n: i + 1 })} disabled={i === chosen.length - 1} onClick={() => move(i, 1)} className={`grid h-11 w-9 place-items-center rounded-lg text-[var(--ink-2)] hover:bg-[var(--panel)] disabled:opacity-25 ${FOCUS}`}>↓</button>
                      <button type="button" aria-label={t("hubfam.qzAbRemoveQ", { n: i + 1 })} onClick={() => setQids(qids.filter((x) => x !== q.id))} className={`grid h-11 w-9 place-items-center rounded-lg text-[16px] text-[var(--red)] hover:bg-[var(--red-soft)] ${FOCUS}`}>×</button>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section aria-label={t("hubfam.qzTabBank")} className="min-w-0">
              <div className="mb-1.5 flex items-center justify-between gap-2"><h4 className="m-0 text-[13px] font-extrabold text-[var(--ink)]">{t("hubfam.qzTabBank")}</h4>
                <Button variant="ghost" className={TAP} onClick={() => setNewQ(true)} data-testid="hub-inline-new-question">{t("hubfam.qzNewQuestion")}</Button></div>
              <Input aria-label={t("hubfam.qzAbSearchBank")} placeholder={t("hubfam.qzSearchEllipsis")} value={search} onChange={(e) => setSearch(e.target.value)} className="mb-2 min-h-[44px] w-full" />
              {aud.yearGroups.length > 0 && (
                <label className="mb-2 flex min-h-[32px] items-center gap-2 text-[12.5px] font-semibold text-[var(--ink-2)]" data-testid="hub-bank-yearonly">
                  <input type="checkbox" checked={yearOnly} onChange={(e) => setYearOnly(e.target.checked)} className="h-4 w-4" />
                  {t("hubfam.qzAbOnlyYears", { years: aud.yearGroups.join(", ") })}
                </label>
              )}
              <div className="grid max-h-[340px] grid-cols-[minmax(0,1fr)] gap-1.5 overflow-y-auto pe-0.5">
                {shownPool.length === 0 && !poolBusy && <div className="rounded-xl border border-dashed border-[var(--line)] px-4 py-6 text-center text-[12.5px] text-[var(--ink-3)]">{poolTotal > 0 ? t("hubfam.qzAbAllAdded") : t("hubfam.qzAbNoQsTopics")}</div>}
                {poolBusy && pool.length === 0 && <div role="status" aria-busy="true" className="rounded-xl border border-dashed border-[var(--line)] px-4 py-6 text-center text-[12.5px] text-[var(--ink-3)]">{t("hubfam.qzAbLoadingQs")}</div>}
                {shownPool.map((q) => (
                  <div key={q.id} className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] py-1.5 ps-3 pe-1.5">
                    <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-semibold text-[var(--ink)]">{q.prompt}</div><div className="text-[11px] text-[var(--ink-3)]">{kindText(t, p.config.questionKinds, q.kind)}{ruleOf(p.config.questionKinds, q.kind) === "manual" ? <b className="font-extrabold text-[var(--brand-strong)]">{t("hubfam.qzAbWritten")}</b> : null} · {tp("hubfam.qzMarks", q.marks)}{q.hasImage ? t("hubfam.qzAbPicTag") : ""}{q.published ? "" : t("hubfam.qzAbDraftTag")}</div></div>
                    <button type="button" onClick={() => addQ(q)} aria-label={t("hubfam.qzAbAddAria", { prompt: q.prompt.slice(0, 40) })} className={`min-h-[44px] flex-none rounded-lg px-3 text-[12.5px] font-extrabold text-[var(--brand)] hover:bg-[var(--brand-soft)] ${FOCUS}`}>{t("hubfam.qzAbAddBtn")}</button>
                  </div>
                ))}
                {poolNext && <Button variant="ghost" className={TAP} disabled={poolBusy} onClick={() => loadPool(true, poolNext)}>{poolBusy ? t("hubfam.qzLoading") : t("hubfam.qzShowMore", { n: Math.max(0, poolTotal - pool.length) })}</Button>}
              </div>
            </section>
          </div>

          <div className="grid gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <Switch on={published} onChange={setPublished} label={published ? t("hubfam.qzAbPublishedSw") : t("hubfam.qzAbDraftSw")} />
              <Chip tone={NEUTRAL}>{t("hubfam.qzAbChip", { questions: tp("hubfam.qzQuestions", chosen.length), marks: tp("hubfam.qzMarks", totalMarks) })}</Chip>
              {writtenCount > 0 && <Chip tone={BRANDT} icon={<Icon name="edit" size={11} />}>{t("hubfam.qzAbWrittenChip", { n: writtenCount })}</Chip>}
            </div>
            {clash && <Notice tone="warn">{t("hubfam.qzAbClash", { title: clash.title, subject })}</Notice>}
            {writtenCount > 0 && <p className="m-0 text-[12px] leading-snug text-[var(--ink-3)]">{t("hubfam.qzAbWrittenNote")}</p>}
            {type === "diagnostic" && !clash && <p className="m-0 text-[12px] text-[var(--ink-3)]">{t("hubfam.qzAbDiagNote")}</p>}
          </div>
          </>)}
        </div>
      </Modal>
      {newQ && <QuestionForm p={{ ...p, topics: allTopics }} defaultTopicId={topicIds[0] ?? subjectTopics[0]?.id} onClose={() => setNewQ(false)} onSaved={(q) => { setNewQ(false); setPoolTick((n) => n + 1); if (q.id) addQ({ id: q.id, topicId: q.topicId, kind: q.kind, prompt: q.prompt, marks: q.marks, published: q.published, hasImage: !!q.image?.id }); }} />}
    </>
  );
}
