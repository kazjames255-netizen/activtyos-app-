"use client";

import { useMemo, useState } from "react";
import { Button, Card, Select } from "@/components/ui";
import { post } from "@/lib/api";
import type { PanelProps } from "../panelTypes";
import { errMsg } from "../types";
import { hubPath, type AssessType, type Assessment, type AttemptRow, type Result } from "../shared-assess/api";
import { fmtDate, NEUTRAL, OK, type Tone } from "../shared-assess/format";
import { useHubData } from "../shared-assess/hooks";
import { ResultView } from "../shared-assess/ResultView";
import { GroupViewChip } from "../groupKit";
import type { HubGroup } from "../types";
import { Chip, display, EmptyState, FOCUS, ListSkeleton, Modal, Notice, Stat, TAP } from "../shared-assess/ui";

const BRAND: Tone = { fill: "var(--brand)", soft: "var(--brand-soft)", ink: "var(--brand-strong)" };
const GOLD: Tone = { fill: "var(--gold)", soft: "var(--gold-soft)", ink: "color-mix(in srgb, var(--gold) 30%, var(--ink))" };

/** A group card's Quiz tile: only these attempts (its members', at the quizzes set for the group), with a chip to clear. */
export interface GroupScope { group: HubGroup; onClear: () => void; keep: (r: AttemptRow) => boolean }

/** Every submitted attempt, filterable by assessment and student; open one for the full review. */
export function Results({ p, type, rows, assessments, loading, error, scope = null }: { p: PanelProps; type: AssessType; rows: AttemptRow[] | null; assessments: Assessment[]; loading: boolean; error: string | null; scope?: GroupScope | null }) {
  const [aId, setAId] = useState("");
  const [cId, setCId] = useState("");
  const [open, setOpen] = useState<AttemptRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [granting, setGranting] = useState<string | null>(null);
  const aById = useMemo(() => new Map(assessments.map((a) => [a.id, a])), [assessments]);
  const names = useMemo(() => new Map(p.students.map((s) => [s.childId, s.childName])), [p.students]);
  const ofType = useMemo(() => assessments.filter((a) => a.type === type), [assessments, type]);

  const shown = useMemo(() => (rows ?? [])
    .filter((r) => (r.assessmentType ?? aById.get(r.assessmentId)?.type) === type)
    .filter((r) => r.status !== "in_progress")
    .filter((r) => !scope || scope.keep(r))
    .filter((r) => !aId || r.assessmentId === aId)
    .filter((r) => !cId || r.childId === cId)
    .filter((r) => { const a = aById.get(r.assessmentId); return !(p.filter.subject || p.filter.topicId) || !a || (p.filter.topicId ? a.topicIds.some((t) => p.covered.has(t)) : a.subject === p.filter.subject); })
    .sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? "")), [rows, type, aId, cId, aById, p.filter, p.covered, scope]);

  // "Allow one more attempt": the server grants exactly one extra sitting (consumed on start).
  const allow = async (r: AttemptRow) => {
    setGranting(r.id);
    try {
      await post(hubPath(p.qs, `/assessments/${r.assessmentId}/allow-retake`), { childId: r.childId });
      setToast(`${r.childName ?? names.get(r.childId) ?? "The student"} can now sit "${r.assessmentTitle ?? aById.get(r.assessmentId)?.title ?? "it"}" once more.`);
    } catch (e) { p.onError(errMsg(e, "Couldn't allow another attempt")); }
    finally { setGranting(null); }
  };
  const students = new Set(shown.map((r) => r.childId)).size;
  const waiting = shown.filter((r) => r.status === "pending_marking").length;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3" data-testid="hub-results">
      {scope && <GroupViewChip group={scope.group} what="quiz results" onClear={scope.onClear} />}
      <div className="grid grid-cols-3 gap-2.5">
        <Stat label="Attempts" value={shown.length} />
        <Stat label="Students" value={students} />
        <Stat label="To mark" value={waiting} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Select aria-label="Filter by assessment" value={aId} onChange={(e) => setAId(e.target.value)} className="min-h-[44px] max-w-full !rounded-xl"><option value="">All {type === "diagnostic" ? "placement tests" : "quizzes"}</option>{ofType.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}</Select>
        <Select aria-label="Filter by student" value={cId} onChange={(e) => setCId(e.target.value)} className="min-h-[44px] max-w-full !rounded-xl"><option value="">All students</option>{p.students.map((s) => <option key={s.childId} value={s.childId}>{s.childName}</option>)}</Select>
      </div>
      {toast && <Notice tone="ok" onDismiss={() => setToast(null)}>{toast}</Notice>}
      {error && !rows && <Notice>{error}</Notice>}
      {loading && !rows && <ListSkeleton rows={4} label="Loading results" />}
      {rows && shown.length === 0 && <EmptyState icon="📊" title="No results yet" body="Scores appear here as soon as students hand in a quiz." />}
      {shown.length > 0 && (
        <Card className="divide-y divide-[var(--line)] overflow-hidden p-0">
          {shown.map((r) => {
            const a = aById.get(r.assessmentId);
            const pending = r.status === "pending_marking";
            const passed = r.passed === true;
            const cname = r.childName ?? names.get(r.childId) ?? "Student";
            const autoBit = pending && (r.autoMax ?? 0) > 0 && r.autoMarks != null ? ` · auto-marked ${r.autoMarks}/${r.autoMax}` : "";
            return (
              <div key={r.id} className="flex items-stretch" data-testid="hub-result-row">
                <button type="button" onClick={() => setOpen(r)} className={`flex min-h-[60px] min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left hover:bg-[var(--panel)]/60 ${FOCUS}`}>
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-[var(--brand-soft)] text-[13px] font-extrabold text-[var(--brand-strong)]" aria-hidden>{cname.slice(0, 1).toUpperCase()}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-extrabold text-[var(--ink)]" style={display}>{cname}</span>
                    <span className="block truncate text-[12px] text-[var(--ink-3)]">{r.assessmentTitle ?? a?.title ?? "Assessment"} · {fmtDate(r.submittedAt)}{autoBit}</span>
                  </span>
                  {pending ? <Chip tone={BRAND} icon="⏳">To mark</Chip> : type === "diagnostic" ? <Chip tone={NEUTRAL}>Baseline</Chip> : passed ? <Chip tone={OK} icon="✓">Passed</Chip> : <Chip tone={GOLD}>Not passed</Chip>}
                  <span className="w-12 flex-none text-right text-[16px] font-extrabold tabular-nums text-[var(--ink)]" style={display}>{Math.round(r.pct ?? 0)}%{pending && (r.autoMax ?? 0) > 0 ? <span className="sr-only"> so far</span> : null}</span>
                </button>
                {!pending && (
                  <button type="button" disabled={granting === r.id} onClick={() => void allow(r)} aria-label={`Allow one more attempt for ${cname}`} title="Let this student sit it once more" className={`hidden min-h-[60px] flex-none items-center gap-1 border-l border-[var(--line)] px-3.5 text-[12px] font-extrabold text-[var(--brand)] hover:bg-[var(--brand-soft)] disabled:opacity-50 sm:inline-flex ${FOCUS}`}>{granting === r.id ? "Allowing…" : "Allow retake"}</button>
                )}
              </div>
            );
          })}
        </Card>
      )}
      {open && <AttemptModal p={p} row={open} type={type} passMark={aById.get(open.assessmentId)?.passMarkPct} onClose={() => setOpen(null)} />}
    </div>
  );
}

function AttemptModal({ p, row, type, passMark, onClose }: { p: PanelProps; row: AttemptRow; type: AssessType; passMark?: number; onClose: () => void }) {
  const { data, loading, error, reload } = useHubData<Result>(hubPath(p.qs, `/attempts/${row.id}`));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const allowRetake = async () => {
    setBusy(true);
    try { await post(hubPath(p.qs, `/assessments/${row.assessmentId}/allow-retake`), { childId: row.childId }); setMsg("One more attempt allowed. They can start it now."); }
    catch (e) { p.onError(errMsg(e, "Couldn't allow another attempt")); }
    finally { setBusy(false); }
  };
  const resetBaseline = async () => {
    setBusy(true);
    try { await post(hubPath(p.qs, `/attempts/${row.id}/reset-baseline`), {}); setMsg("Baseline cleared. The student can retake the placement test."); }
    catch (e) { p.onError(errMsg(e, "Couldn't reset the baseline")); }
    finally { setBusy(false); }
  };
  return (
    <Modal wide title={`${row.childName ?? p.students.find((s) => s.childId === row.childId)?.childName ?? "Student"} · ${row.assessmentTitle ?? "Attempt"}`} onClose={onClose}
      footer={row.status !== "pending_marking" ? <>
        <Button variant="ghost" className={TAP} disabled={busy} onClick={allowRetake} data-testid="hub-allow-retake">Allow one more attempt</Button>
        {type === "diagnostic" && row.status === "marked" && <Button variant="danger" className={TAP} disabled={busy} onClick={resetBaseline}>{busy ? "Working…" : "Reset baseline (allow a retake)"}</Button>}
      </> : undefined}>
      {msg && <div className="mb-3"><Notice tone="ok" onDismiss={() => setMsg(null)}>{msg}</Notice></div>}
      {loading && !data && <ListSkeleton rows={2} label="Loading attempt" />}
      {error && !data && <Notice>{error}</Notice>}
      {data && <ResultView tutor onRefreshImages={reload} result={data} topics={p.topics} config={p.config} type={type} passMarkPct={passMark} />}
    </Modal>
  );
}
