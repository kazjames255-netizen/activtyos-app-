"use client";

import { useEffect, useState } from "react";
import { Button, Input, Select } from "@/components/ui";
import { ApiError, fetchBlob, post } from "@/lib/api";
import { useT } from "@/lib/i18n/provider";
import type { Student } from "../types";

// Tutor controls for the parent digest & homework reminders (docs/learning-hub.md "Parent digest & homework nudges"):
// two switches + lead time (edited in the Setup draft, saved with it), "Preview parent email" (GET /digest/preview) and
// "What would go out?" (POST /digest/run, a dry run: nothing is ever sent from here).

type Kind = "digest" | "nudge_before" | "nudge_after";
interface RunItem { childId: string; childName: string; kind: string; status: string; reason?: string }
interface RunResult { items: RunItem[] }

const Switch = ({ on, onChange, label, id }: { on: boolean; onChange: (v: boolean) => void; label: string; id: string }) => (
  <button type="button" role="switch" id={id} aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
    className={`relative h-7 w-12 flex-none rounded-full border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)] ${on ? "border-[var(--brand)] bg-[var(--brand)]" : "border-[var(--line)] bg-[var(--panel)]"}`}>
    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all motion-reduce:transition-none ${on ? "start-[26px]" : "start-0.5"}`} />
  </button>
);

export function ParentEmailSettings({ parentDigest, homeworkNudges, nudgeLeadHours, onChange, students, qs }: {
  parentDigest: boolean; homeworkNudges: boolean; nudgeLeadHours: number;
  onChange: (patch: { parentDigest?: boolean; homeworkNudges?: boolean; nudgeLeadHours?: number }) => void;
  students: Student[]; qs: string;
}) {
  const t = useT();
  const [child, setChild] = useState("");
  const [kind, setKind] = useState<Kind>("digest");
  const [busy, setBusy] = useState<"preview" | "run" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [run, setRun] = useState<RunResult | null>(null);
  const roster = students.filter((s) => s.active !== false);
  const childId = child || roster[0]?.childId || "";
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const fail = (e: unknown) => setErr(e instanceof ApiError || e instanceof Error ? e.message : t("hubplan.dg_fail"));
  const doPreview = async () => {
    if (!childId || busy) return;
    setBusy("preview"); setErr(null);
    try {
      const p = new URLSearchParams(qs.replace(/^\?/, "")); p.set("childId", childId); p.set("kind", kind);
      const blob = await fetchBlob(`/api/learning-hub/digest/preview?${p.toString()}`);
      setPreview(URL.createObjectURL(new Blob([blob], { type: "text/html" })));
    } catch (e) { fail(e); } finally { setBusy(null); }
  };
  const doRun = async () => {
    if (busy) return;
    setBusy("run"); setErr(null); setRun(null);
    try { setRun(await post<RunResult>(`/api/learning-hub/digest/run${qs}`, { what: "both" })); }
    catch (e) { fail(e); } finally { setBusy(null); }
  };

  return (
    <div className="grid gap-3" data-testid="hub-parent-email-settings">
      <p className="text-[12.5px] text-[var(--ink-3)]">{t("hubplan.dg_lede")}</p>
      <label className="flex items-center justify-between gap-3 text-[13px] font-bold" htmlFor="hub-digest-on">
        {t("hubplan.dg_digest")}<Switch id="hub-digest-on" on={parentDigest} onChange={(v) => onChange({ parentDigest: v })} label={t("hubplan.dg_digest")} />
      </label>
      <label className="flex items-center justify-between gap-3 text-[13px] font-bold" htmlFor="hub-nudges-on">
        {t("hubplan.dg_nudges")}<Switch id="hub-nudges-on" on={homeworkNudges} onChange={(v) => onChange({ homeworkNudges: v })} label={t("hubplan.dg_nudges")} />
      </label>
      <label className="flex flex-wrap items-center justify-between gap-3 text-[13px] font-bold">
        {t("hubplan.dg_lead")}
        <Input type="number" min={1} max={72} value={nudgeLeadHours} disabled={!homeworkNudges} className="w-24"
          onChange={(e) => onChange({ nudgeLeadHours: Math.min(72, Math.max(1, Math.round(Number(e.target.value) || 1))) })} />
      </label>

      <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-[var(--line)] pt-3">
        <Select value={childId} onChange={(e) => setChild(e.target.value)} className="min-h-[44px] w-full sm:w-52" aria-label={t("hubplan.dg_child")} disabled={!roster.length}>
          {roster.map((s) => <option key={s.childId} value={s.childId}>{s.childName}</option>)}
        </Select>
        <Select value={kind} onChange={(e) => setKind(e.target.value as Kind)} className="min-h-[44px] w-full sm:w-52" aria-label={t("hubplan.dg_kind")}>
          <option value="digest">{t("hubplan.dg_k_digest")}</option>
          <option value="nudge_before">{t("hubplan.dg_k_before")}</option>
          <option value="nudge_after">{t("hubplan.dg_k_after")}</option>
        </Select>
        <Button className="min-h-[44px]" disabled={!childId || !!busy} onClick={doPreview} data-testid="hub-digest-preview">{busy === "preview" ? t("hubplan.dg_working") : t("hubplan.dg_preview")}</Button>
        <Button className="min-h-[44px]" disabled={!!busy} onClick={doRun} data-testid="hub-digest-run">{busy === "run" ? t("hubplan.dg_working") : t("hubplan.dg_run")}</Button>
      </div>

      {err && <p role="alert" className="text-[12.5px] font-bold text-[var(--red)]">{err}</p>}
      {run && (
        <div role="status" className="rounded-xl bg-[var(--panel)] p-3 text-[12.5px]" data-testid="hub-digest-run-result">
          <div className="font-extrabold">{run.items.length ? t("hubplan.dg_result", { n: run.items.length }) : t("hubplan.dg_none")}</div>
          {run.items.length > 0 && <ul className="mt-1.5 grid gap-0.5 text-[var(--ink-2)]">{run.items.slice(0, 30).map((i, k) => <li key={k}>{i.childName} · {i.kind} · {i.status}</li>)}</ul>}
        </div>
      )}
      {preview && (
        <div className="grid gap-2" data-testid="hub-digest-preview-frame">
          <iframe src={preview} sandbox="" title={t("hubplan.dg_preview")} className="h-[480px] w-full rounded-xl border border-[var(--line)] bg-white" />
          <Button className="min-h-[44px] justify-self-start" onClick={() => setPreview(null)}>{t("hubplan.dg_closePreview")}</Button>
        </div>
      )}
    </div>
  );
}
