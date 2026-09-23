"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, FieldLabel, Input, Select } from "@/components/ui";
import { get, post, put } from "@/lib/api";
import type { PanelProps } from "../panelTypes";
import { canChangeRow, errMsg } from "../types";
import { Icon } from "../kit";
import { hubPath, kindLabel, NO_AUDIENCE, ruleOf, type Assessment, type AssessType, type Audience, type QLite, type QPage, type RetakeOverride } from "../shared-assess/api";
import { audienceChips } from "../shared-assess/audience";
import { effectivePolicy, policyLabel } from "../shared-assess/retake";
import { topicShort } from "../shared-assess/format";
import { Chip, FOCUS, Modal, Notice, Segmented, Switch, TAP } from "../shared-assess/ui";
import { NEUTRAL } from "../shared-assess/format";
import { QuestionForm } from "./QuestionForm";
import { CreatorTabs, DiscardStrip, ExistingPicker, type ExistingPage, type ExistingQuery } from "../EditExisting";
import type { AssessmentPage } from "./useAssessmentPage";
import { NewTopicInline, useTopicsWithNew } from "../NewTopicInline";

const BRANDT = { fill: "var(--brand)", soft: "var(--brand-soft)", ink: "var(--brand-strong)" };

// Build / edit a quiz or placement test: pick the subject and topics, choose and
// order questions (or write one on the spot), set timing and pass mark, publish.

export function AssessmentBuilder({ p, type: initialType, assessment, all, onClose, onSaved, onOpenOther, onStartNew }: {
  p: PanelProps; type: AssessType; assessment: Assessment | null; all: Assessment[]; onClose: () => void; onSaved: () => void;
  /** "Edit existing" tab: open another paper (the list swaps the builder over to it). Without it the tab strip is not shown. */
  onOpenOther?: (id: string) => Promise<void>;
  /** "New" tab while editing an existing paper: swap over to a blank builder. */
  onStartNew?: () => void;
}) {
  // Topics created here ("+ New subject / topic") are usable at once, before the realtime refetch lands.
  const [allTopics, rememberTopic] = useTopicsWithNew(p.topics);
  const subjects = useMemo(() => [...new Set(allTopics.map((t) => t.subject))].sort((a, b) => a.localeCompare(b)), [allTopics]);
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
  const [retake, setRetake] = useState<RetakeOverride>(assessment?.retakePolicy ?? "inherit");
  const [cool, setCool] = useState(String(assessment?.retakeCooldownHours ?? p.config.retakeCooldownHours ?? 24));
  const [search, setSearch] = useState("");
  const [newQ, setNewQ] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // "Edit existing" tab: the picker replaces the form (whatever is typed stays underneath until another paper is chosen).
  const [picking, setPicking] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const snapNow = JSON.stringify([type, title, subject, topicIds, qids, timed, mins, pass, published, aud, retake, cool]);
  const initialSnap = useRef<string | null>(null);
  if (initialSnap.current === null) initialSnap.current = snapNow;
  const dirty = snapNow !== initialSnap.current;

  // Questions already in the paper (from GET /assessments/:id) + ones added from the picker: id → light row. The picker
  // itself never holds the bank — it asks for one topic's questions at a time (paged, searchable).
  const [known, setKnown] = useState<Map<string, QLite>>(() => new Map((assessment?.questions ?? []).map((q) => [q.id, q] as const)));
  const qById = known;
  const subjectTopics = useMemo(() => allTopics.filter((t) => t.subject === subject).sort((a, b) => topicShort(a).localeCompare(topicShort(b))), [allTopics, subject]);
  // A subject can have ~140 topic + "Year N" subtopic rows: show the topics, and a chosen topic's subtopics beneath (a small subject shows all).
  const chips = useMemo(() => (subjectTopics.length <= 24 ? subjectTopics : subjectTopics.filter((t) => !t.parentTopicId || topicIds.includes(t.parentTopicId) || topicIds.includes(t.id))), [subjectTopics, topicIds]);
  const scope = useMemo(() => {
    if (!topicIds.length) return new Set(subjectTopics.map((t) => t.id));
    const s = new Set(topicIds);
    for (const t of subjectTopics) if (t.parentTopicId && s.has(t.parentTopicId)) s.add(t.id);
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
  useEffect(() => { const t = setTimeout(() => setDSearch(search.trim()), 250); return () => clearTimeout(t); }, [search]);
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
      .catch((e) => { if (mine === poolSeq.current) setErr(errMsg(e, "Couldn't load the question bank")); })
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

  const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= qids.length) return; const n = [...qids]; [n[i], n[j]] = [n[j], n[i]]; setQids(n); };
  const toggleTopic = (id: string) => setTopicIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const save = async () => {
    setErr(null);
    if (!title.trim()) return setErr("Give it a title.");
    if (!subject) return setErr("Choose a subject.");
    if (published && !qids.length) return setErr("Add at least one question before publishing, or save it as a draft.");
    if (published && chosen.some((q) => !q.published)) return setErr("Every question must be published before the quiz can be. Publish the draft questions (marked \"draft\") in the Question bank, or remove them.");
    const passN = Number(pass);
    if (!(passN >= 0 && passN <= 100)) return setErr("Pass mark must be between 0 and 100.");
    if (timed && !(Number(mins) >= 1)) return setErr("Enter the time limit in minutes.");
    if (retake === "cooldown" && !(Number(cool) >= 1 && Number(cool) <= 720)) return setErr("Wait between attempts must be 1 to 720 hours.");
    setBusy(true);
    try {
      const body = { audience, retakePolicy: retake, ...(retake === "cooldown" ? { retakeCooldownHours: Math.round(Number(cool)) } : {}), type, title: title.trim(), subject, topicIds: topicIds.length ? topicIds : [...new Set(chosen.map((q) => q.topicId))], questionIds: qids, timeLimitMins: timed ? Math.round(Number(mins)) : null, ...(type === "quiz" ? { passMarkPct: Math.round(passN) } : {}), published };
      if (assessment) await put(hubPath(p.qs, `/assessments/${assessment.id}`), body);
      else await post(hubPath(p.qs, "/assessments"), body);
      onSaved();
    } catch (e) { setErr(errMsg(e, "Couldn't save")); }
    finally { setBusy(false); }
  };

  const label = type === "diagnostic" ? "placement test" : "quiz";
  const fetchExisting = useCallback(async (x: ExistingQuery): Promise<ExistingPage> => {
    const r = await get<AssessmentPage>(hubPath(p.qs, "/assessments", { light: "1", limit: "20", cursor: x.cursor, type, ...(x.topicId ? { topicId: x.topicId } : x.subject ? { subject: x.subject } : {}), yearGroup: x.yearGroup || null, q: x.q || null }));
    return { rows: r.items.map((a) => ({ id: a.id, title: a.title, draft: !a.published, meta: [a.subject, a.questionCount != null ? `${a.questionCount} ${a.questionCount === 1 ? "question" : "questions"}` : null, !canChangeRow(p.franchiseId, a.franchiseId) ? "From head office (read-only)" : null].filter(Boolean).join(" · ") })), total: r.total, next: r.nextCursor };
  }, [p.qs, p.franchiseId, type]);
  const pickExisting = async (row: { id: string }) => { await onOpenOther?.(row.id); };
  const onTab = (m: "new" | "existing") => {
    if (m === "existing") { setPicking(true); return; }
    if (assessment) { if (dirty) setConfirmNew(true); else onStartNew?.(); return; }
    setPicking(false);
  };
  return (
    <>
      <Modal wide title={assessment ? `Edit ${label}` : `New ${label}`} onClose={onClose} id="hub-assessment-builder"
        footer={<>
          <Button variant="ghost" className={TAP} onClick={onClose}>Cancel</Button>
          <Button variant="solid" className={`${TAP} !px-6`} onClick={save} disabled={busy || picking} data-testid="hub-save-assessment">{busy ? "Saving…" : published ? "Save and publish" : "Save draft"}</Button>
        </>}>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
          {err && <Notice onDismiss={() => setErr(null)}>{err}</Notice>}
          {onOpenOther && <CreatorTabs mode={picking || assessment ? "existing" : "new"} onChange={onTab} noun={type === "diagnostic" ? "Placement test" : "Quiz"} />}
          {confirmNew && <DiscardStrip message={`Start a new ${label}? Your unsaved changes to this one will be lost.`} confirmLabel="Discard and start new" onKeep={() => setConfirmNew(false)} onConfirm={() => onStartNew?.()} testId="edit-existing-confirm-new" />}
          {picking && onOpenOther ? (
            <ExistingPicker noun={label} topics={p.topics} fetchPage={fetchExisting} onPick={pickExisting} onError={p.onError}
              initialSubject={p.filter.subject ?? ""} initialTopicId={p.filter.topicId ?? ""} yearGroups={p.config.yearGroups}
              guard={dirty ? `You have unsaved changes to this ${label}.` : null} />
          ) : (<>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div>
              <FieldLabel htmlFor="ha-title">Title</FieldLabel>
              <Input id="ha-title" data-autofocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={type === "diagnostic" ? "e.g. Maths placement test" : "e.g. Quadratics check-in"} className="min-h-[44px] w-full" />
            </div>
            <div>
              <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">Type</div>
              <Segmented label="Type" value={type} onChange={(v) => { if (!assessment) setType(v); }} options={[{ id: "quiz", label: "Quiz" }, { id: "diagnostic", label: "Placement test" }]} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="ha-subject">Subject</FieldLabel>
              <Select id="ha-subject" value={subject} onChange={(e) => { setSubject(e.target.value); setTopicIds([]); }} className="min-h-[44px] w-full">
                {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {type === "quiz" && (
                <div>
                  <FieldLabel htmlFor="ha-pass">Pass mark %</FieldLabel>
                  <Input id="ha-pass" type="number" min={0} max={100} value={pass} onChange={(e) => setPass(e.target.value)} className="min-h-[44px] w-full tabular-nums" />
                </div>
              )}
              <div className={type === "quiz" ? "" : "col-span-2"}>
                <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">Time limit</div>
                <div className="flex items-center gap-2">
                  <Switch on={timed} onChange={setTimed} label={timed ? "" : "Off"} />
                  {timed && <><Input aria-label="Minutes" type="number" min={1} value={mins} onChange={(e) => setMins(e.target.value)} className="min-h-[44px] w-[80px] tabular-nums" /><span className="text-[12.5px] text-[var(--ink-3)]">min</span></>}
                </div>
              </div>
            </div>
          </div>

          {subjectTopics.length > 0 && (
            <div>
              <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">Topics covered <span className="normal-case tracking-normal">· none selected = whole subject</span></div>
              <div className="flex flex-wrap gap-1.5">
                {chips.map((t) => {
                  const on = topicIds.includes(t.id);
                  return <button key={t.id} type="button" aria-pressed={on} onClick={() => toggleTopic(t.id)} className={`min-h-[44px] lg:min-h-[40px] rounded-full border px-3.5 text-[12.5px] font-bold transition-colors ${FOCUS} ${on ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] hover:border-[var(--brand)]"}`}>{topicShort(t)}</button>;
                })}
              </div>
            </div>
          )}
          <NewTopicInline qs={p.qs} topics={allTopics} subject={subject} canCreate={p.canEdit && !p.readOnly} testId="quiz-new-topic"
            onCreated={(t, kind) => { rememberTopic(t); setSubject(t.subject); setTopicIds(kind === "topic" ? [t.id] : []); }} />

          <section aria-label="Who is this for?" className="grid grid-cols-[minmax(0,1fr)] gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3.5 sm:p-4" data-testid="hub-audience">
            <div>
              <h4 className="m-0 flex items-center gap-1.5 text-[13px] font-extrabold text-[var(--ink)]"><Icon name="users" size={15} />Who is this for?</h4>
              <p className="m-0 mt-0.5 text-[12px] leading-snug text-[var(--ink-3)]">Choose the year groups. Families only see {label}s that suit their child. Leave it empty for everyone.</p>
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Year groups">
              {p.config.yearGroups.map((y) => {
                const on = aud.yearGroups.includes(y);
                return <button key={y} type="button" aria-pressed={on} onClick={() => toggleYear(y)} className={`min-h-[44px] lg:min-h-[40px] rounded-full border px-3.5 text-[12.5px] font-bold transition-colors ${FOCUS} ${on ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] hover:border-[var(--brand)]"}`}>{y}</button>;
              })}
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[160px] flex-1 pb-1.5" aria-live="polite">
                {audienceChips(audience, p.config.yearGroups).length ? (
                  <div className="flex flex-wrap gap-1.5" data-testid="hub-audience-summary">{audienceChips(audience, p.config.yearGroups).map((c) => <Chip key={c} tone={BRANDT}>{c}</Chip>)}</div>
                ) : <span className="text-[12px] font-semibold text-[var(--ink-3)]">Everyone can see this {label}.</span>}
              </div>
            </div>
            <p className="m-0 text-[11.5px] text-[var(--ink-3)]">Year groups come from the tag you give each student. If a child&apos;s year group isn&apos;t known, the {label} still shows for them with a note.</p>
          </section>

          <section aria-label="Retakes" className="grid grid-cols-[minmax(0,1fr)] gap-2 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3.5 sm:p-4" data-testid="hub-retake-override">
            <div>
              <h4 className="m-0 text-[13px] font-extrabold text-[var(--ink)]">Retakes</h4>
              <p className="m-0 mt-0.5 text-[12px] leading-snug text-[var(--ink-3)]">Can a child sit this again after handing it in? By default it follows your Teaching Hub setting ({policyLabel(inherited.policy, inherited.hours).toLowerCase()}).</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="max-w-full overflow-x-auto"><Segmented<RetakeOverride> label="Retake policy" value={retake} onChange={setRetake} options={[{ id: "inherit", label: "Follow my setting" }, { id: "unlimited", label: "Unlimited" }, { id: "once", label: "One attempt" }, { id: "cooldown", label: "Wait between" }]} /></div>
              {retake === "cooldown" && <span className="inline-flex items-center gap-2"><Input aria-label="Hours to wait between attempts" type="number" min={1} max={720} value={cool} onChange={(e) => setCool(e.target.value)} className="min-h-[44px] w-[84px] tabular-nums" /><span className="text-[12.5px] text-[var(--ink-3)]">hours</span></span>}
            </div>
            {retake === "once" && <p className="m-0 text-[11.5px] text-[var(--ink-3)]">You can still grant one more attempt to a student from the Results tab.</p>}
          </section>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <section aria-label="Questions in this quiz" className="min-w-0">
              <div className="mb-1.5 flex items-baseline justify-between"><h4 className="m-0 text-[13px] font-extrabold text-[var(--ink)]">In this {label} <span className="font-semibold text-[var(--ink-3)]">· {chosen.length} {chosen.length === 1 ? "question" : "questions"}, {totalMarks} marks</span></h4></div>
              {chosen.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--line)] px-4 py-8 text-center text-[12.5px] text-[var(--ink-3)]">Nothing yet. Add questions from your bank, or write a new one.</div>
              ) : (
                <ol className="m-0 grid list-none grid-cols-[minmax(0,1fr)] gap-1.5 p-0">
                  {chosen.map((q, i) => (
                    <li key={q.id} className="flex min-w-0 items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] py-1.5 pl-3 pr-1.5">
                      <span className="w-5 flex-none text-[12px] font-extrabold tabular-nums text-[var(--ink-3)]">{i + 1}</span>
                      <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-semibold text-[var(--ink)]">{q.prompt}</div><div className="text-[11px] text-[var(--ink-3)]">{kindLabel(p.config.questionKinds, q.kind)}{ruleOf(p.config.questionKinds, q.kind) === "manual" ? <b className="font-extrabold text-[var(--brand-strong)]"> · Written, you mark this</b> : null} · {q.marks}m{q.hasImage ? " · picture" : ""}{q.published ? "" : " · draft"}</div></div>
                      <button type="button" aria-label={`Move question ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)} className={`grid h-11 w-9 place-items-center rounded-lg text-[var(--ink-2)] hover:bg-[var(--panel)] disabled:opacity-25 ${FOCUS}`}>↑</button>
                      <button type="button" aria-label={`Move question ${i + 1} down`} disabled={i === chosen.length - 1} onClick={() => move(i, 1)} className={`grid h-11 w-9 place-items-center rounded-lg text-[var(--ink-2)] hover:bg-[var(--panel)] disabled:opacity-25 ${FOCUS}`}>↓</button>
                      <button type="button" aria-label={`Remove question ${i + 1}`} onClick={() => setQids(qids.filter((x) => x !== q.id))} className={`grid h-11 w-9 place-items-center rounded-lg text-[16px] text-[var(--red)] hover:bg-[var(--red-soft)] ${FOCUS}`}>×</button>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section aria-label="Question bank" className="min-w-0">
              <div className="mb-1.5 flex items-center justify-between gap-2"><h4 className="m-0 text-[13px] font-extrabold text-[var(--ink)]">Question bank</h4>
                <Button variant="ghost" className={TAP} onClick={() => setNewQ(true)} data-testid="hub-inline-new-question">+ New question</Button></div>
              <Input aria-label="Search the bank" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-2 min-h-[44px] w-full" />
              {aud.yearGroups.length > 0 && (
                <label className="mb-2 flex min-h-[32px] items-center gap-2 text-[12.5px] font-semibold text-[var(--ink-2)]" data-testid="hub-bank-yearonly">
                  <input type="checkbox" checked={yearOnly} onChange={(e) => setYearOnly(e.target.checked)} className="h-4 w-4" />
                  Only questions for {aud.yearGroups.join(", ")}
                </label>
              )}
              <div className="grid max-h-[340px] grid-cols-[minmax(0,1fr)] gap-1.5 overflow-y-auto pr-0.5">
                {shownPool.length === 0 && !poolBusy && <div className="rounded-xl border border-dashed border-[var(--line)] px-4 py-6 text-center text-[12.5px] text-[var(--ink-3)]">{poolTotal > 0 ? "Every matching question is already added." : "No questions for these topics yet."}</div>}
                {poolBusy && pool.length === 0 && <div role="status" aria-busy="true" className="rounded-xl border border-dashed border-[var(--line)] px-4 py-6 text-center text-[12.5px] text-[var(--ink-3)]">Loading questions…</div>}
                {shownPool.map((q) => (
                  <div key={q.id} className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] py-1.5 pl-3 pr-1.5">
                    <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-semibold text-[var(--ink)]">{q.prompt}</div><div className="text-[11px] text-[var(--ink-3)]">{kindLabel(p.config.questionKinds, q.kind)}{ruleOf(p.config.questionKinds, q.kind) === "manual" ? <b className="font-extrabold text-[var(--brand-strong)]"> · Written, you mark this</b> : null} · {q.marks}m{q.hasImage ? " · picture" : ""}{q.published ? "" : " · draft"}</div></div>
                    <button type="button" onClick={() => addQ(q)} aria-label={`Add “${q.prompt.slice(0, 40)}”`} className={`min-h-[44px] flex-none rounded-lg px-3 text-[12.5px] font-extrabold text-[var(--brand)] hover:bg-[var(--brand-soft)] ${FOCUS}`}>+ Add</button>
                  </div>
                ))}
                {poolNext && <Button variant="ghost" className={TAP} disabled={poolBusy} onClick={() => loadPool(true, poolNext)}>{poolBusy ? "Loading…" : `Show more (${Math.max(0, poolTotal - pool.length)} left)`}</Button>}
              </div>
            </section>
          </div>

          <div className="grid gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <Switch on={published} onChange={setPublished} label={published ? "Published: students can take it" : "Draft: only you can see it"} />
              <Chip tone={NEUTRAL}>{chosen.length} questions · {totalMarks} marks</Chip>
              {writtenCount > 0 && <Chip tone={BRANDT} icon={<Icon name="edit" size={11} />}>{writtenCount} written, you mark {writtenCount === 1 ? "this" : "these"}</Chip>}
            </div>
            {clash && <Notice tone="warn">&ldquo;{clash.title}&rdquo; is already the published {subject} placement test for this same audience. Change who this one is for year groups, unpublish the other first, or save this as a draft. The server will refuse otherwise.</Notice>}
            {writtenCount > 0 && <p className="m-0 text-[12px] leading-snug text-[var(--ink-3)]">Written answers are marked by you, so families see their auto-marked score straight away and this part &ldquo;with your tutor&rdquo; until you mark it in the Marking tab.</p>}
            {type === "diagnostic" && !clash && <p className="m-0 text-[12px] text-[var(--ink-3)]">One placement test can be published per subject and audience year groups. It sets each child&apos;s starting point.</p>}
          </div>
          </>)}
        </div>
      </Modal>
      {newQ && <QuestionForm p={{ ...p, topics: allTopics }} defaultTopicId={topicIds[0] ?? subjectTopics[0]?.id} onClose={() => setNewQ(false)} onSaved={(q) => { setNewQ(false); setPoolTick((n) => n + 1); if (q.id) addQ({ id: q.id, topicId: q.topicId, kind: q.kind, prompt: q.prompt, marks: q.marks, published: q.published, hasImage: !!q.image?.id }); }} />}
    </>
  );
}
