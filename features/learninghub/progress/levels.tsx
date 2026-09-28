"use client";

import { useState } from "react";
import { Button, Input } from "@/components/ui";
import { put } from "@/lib/api";
import type { HubSettings } from "@/lib/hubConfig";
import { Icon } from "../kit";
import type { PanelProps } from "../panelTypes";
import { toneAt } from "../shared-assess/format";
import { hubPath } from "../shared-assess/api";
import { LEVELS_CHANGED } from "../shared-assess/hooks";
import { FOCUS, Modal, Notice, TAP } from "../shared-assess/ui";
import { errMsg } from "../types";
import { useT } from "@/lib/i18n/provider";
import { hubT } from "../family/hubT";
import { bandName } from "../family/KidMode";

// The tenant's attainment LEVELS (settings.hub.masteryBands): a name and the % a
// student reaches it at. One editor, used in the Progress tab (a modal that saves
// straight to PUT /config) and inside Setup → Learning Hub. Everything that draws a
// level (legend, attainment bar, chips) reads the same list, so nothing is hardcoded.

export type Band = HubSettings["masteryBands"][number];
export const MIN_LEVELS = 2;
export const MAX_LEVELS = 8;

/** The server's rules, mirrored so the form can explain a problem before saving. */
export function validateBands(bands: Band[]): string[] {
  const T = (k: string, v?: Record<string, string | number>) => hubT(`hubfam.${k}`, v);
  const out: string[] = [];
  if (bands.length < MIN_LEVELS) out.push(T("pgLvMin", { n: MIN_LEVELS }));
  if (bands.length > MAX_LEVELS) out.push(T("pgLvMax", { n: MAX_LEVELS }));
  if (bands[0] && bands[0].min !== 0) out.push(T("pgLvFirst"));
  bands.forEach((b, i) => {
    const l = b.label.trim();
    if (!l) out.push(T("pgLvNeedsName", { i: i + 1 }));
    else if (l.length > 24) out.push(T("pgLvLong", { i: i + 1 }));
    if (!Number.isInteger(b.min) || b.min < 0 || b.min > 100) out.push(T("pgLvRange", { i: i + 1 }));
    if (i > 0 && b.min <= bands[i - 1].min) out.push(T("pgLvHigher", { a: l || T("pgLvDefault", { i: i + 1 }), b: bands[i - 1].label.trim() || T("pgLvDefault", { i }) }));
  });
  const names = bands.map((b) => b.label.trim().toLowerCase()).filter(Boolean);
  if (new Set(names).size !== names.length) out.push(T("pgLvShared"));
  return [...new Set(out)];
}

/** [{label, from, to}] with `to` = one below the next level's start (last runs to 100). */
export function bandRanges(bands: Band[]): { label: string; from: number; to: number; i: number }[] {
  const s = bands.filter((b) => Number.isFinite(b.min)).sort((a, b) => a.min - b.min);
  return s.map((b, i) => ({ label: b.label, from: b.min, to: s[i + 1] ? s[i + 1].min - 1 : 100, i }));
}

/** "0–49% Learning · 50–79% Developing · 80–100% Secure", from the tenant's own levels. */
export function LevelLegend({ bands, onEdit, className = "" }: { bands: Band[]; onEdit?: () => void; className?: string }) {
  const t = useT();
  const r = bandRanges(bands);
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11.5px] font-semibold text-[var(--ink-2)] ${className}`} aria-label={t("hubfam.pgLevels")} data-testid="hub-level-legend">
      {r.map((b) => (
        <span key={b.label} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: toneAt(b.i, r.length).fill }} />
          {bandName(b.label)} <span className="tabular-nums text-[var(--ink-3)]">{b.from}–{b.to}%</span>
        </span>
      ))}
      {onEdit && <button type="button" onClick={onEdit} data-testid="hub-edit-levels" className={`inline-flex min-h-[44px] items-center gap-1 rounded-full px-2.5 text-[12px] font-extrabold text-[var(--brand)] hover:bg-[var(--brand-soft)] ${FOCUS}`}><Icon name="edit" size={13} strokeWidth={2} />{t("hubfam.pgEditLevels")}</button>}
    </div>
  );
}

/** Live preview: one segment per level, sized by its % range, named beneath. */
export function LevelsPreview({ bands }: { bands: Band[] }) {
  const t = useT();
  const r = bandRanges(bands);
  const ok = validateBands(bands).length === 0;
  return (
    <div aria-label={t("hubfam.pgPreview")} role="img" className={ok ? "" : "opacity-60"}>
      <div className="flex h-3.5 gap-[2px] overflow-hidden rounded-full">
        {r.map((b) => <span key={`${b.label}-${b.from}`} className="min-w-[6px]" style={{ flex: `${Math.max(1, b.to - b.from + 1)} 1 0`, background: toneAt(b.i, r.length).fill, transition: "flex-grow 250ms ease" }} />)}
      </div>
      <div className="mt-1.5 flex gap-[2px]">
        {r.map((b) => (
          <span key={`${b.label}-${b.from}-l`} className="min-w-0 overflow-hidden text-[11px] font-bold leading-tight text-[var(--ink-2)]" style={{ flex: `${Math.max(1, b.to - b.from + 1)} 1 0` }}>
            <span className="block truncate">{b.label || "·"}</span>
            <span className="block tabular-nums font-semibold text-[var(--ink-3)]">{b.from}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Controlled editor: rename levels, change thresholds, add / remove (2–8). */
export function LevelsEditor({ bands, onChange }: { bands: Band[]; onChange: (b: Band[]) => void }) {
  const t = useT();
  const problems = validateBands(bands);
  const set = (i: number, patch: Partial<Band>) => onChange(bands.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const sortNow = () => { if (bands.every((b) => Number.isFinite(b.min))) onChange([...bands].sort((a, b) => a.min - b.min)); };
  const add = () => {
    const last = bands[bands.length - 1]?.min ?? 0;
    onChange([...bands, { min: Math.min(99, last + Math.max(1, Math.round((100 - last) / 2))), label: t("hubfam.pgLvDefault", { i: bands.length + 1 }) }]);
  };
  return (
    <div className="grid gap-4" data-testid="hub-levels-editor">
      <LevelsPreview bands={bands} />
      <ul className="m-0 grid list-none gap-2 p-0">
        {bands.map((b, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2">
            <span aria-hidden className="h-8 w-1.5 flex-none rounded-full" style={{ background: toneAt(i, bands.length).fill }} />
            <label className="min-w-[140px] flex-1">
              <span className="sr-only">{t("hubfam.pgLvNameSr", { i: i + 1 })}</span>
              <Input value={b.label} maxLength={24} onChange={(e) => set(i, { label: e.target.value })} className="min-h-[44px] w-full" placeholder={t("hubfam.pgLvNamePh")} aria-label={t("hubfam.pgLvNameSr", { i: i + 1 })} />
            </label>
            <label className="flex items-center gap-1.5 text-[12px] font-bold text-[var(--ink-2)]">
              {t("hubfam.pgFrom")}
              <Input type="number" inputMode="numeric" min={0} max={100} value={Number.isFinite(b.min) ? b.min : ""} disabled={i === 0} onBlur={sortNow}
                onChange={(e) => set(i, { min: e.target.value === "" ? NaN : Math.round(Number(e.target.value)) })} className="min-h-[44px] w-[76px] tabular-nums" aria-label={t("hubfam.pgLvStartsAria", { i: i + 1 })} />
              %
            </label>
            <button type="button" disabled={bands.length <= MIN_LEVELS || i === 0} onClick={() => onChange(bands.filter((_, j) => j !== i))} aria-label={t("hubfam.pgRemoveLevel", { name: b.label || i + 1 })}
              className={`grid h-11 w-11 place-items-center rounded-xl text-[var(--ink-3)] hover:bg-[var(--red-soft)] hover:text-[var(--red)] disabled:opacity-30 ${FOCUS}`}><Icon name="trash" size={16} /></button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={bands.length >= MAX_LEVELS} onClick={add} className={`${TAP} inline-flex items-center gap-1.5 rounded-xl border border-dashed border-[var(--line)] px-3.5 text-[12.5px] font-extrabold text-[var(--brand)] hover:border-[var(--brand)] disabled:opacity-40`}><Icon name="plus" size={14} strokeWidth={2.2} />{t("hubfam.pgAddLevel")}</button>
        <span className="text-[11.5px] text-[var(--ink-3)]">{t("hubfam.pgLevelsCount", { n: bands.length, max: MAX_LEVELS })}</span>
      </div>
      {problems.length > 0 && <div role="alert" data-testid="hub-levels-problems"><Notice tone="warn"><ul className="m-0 list-disc ps-4">{problems.map((x) => <li key={x}>{x}</li>)}</ul></Notice></div>}
    </div>
  );
}

/** "Edit levels" from Progress: saves through PUT /config, then refreshes the hub's settings. */
export function LevelsModal({ p, onClose }: { p: PanelProps; onClose: () => void }) {
  const t = useT();
  const [bands, setBands] = useState<Band[]>(() => p.config.masteryBands.map((b) => ({ ...b })));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const problems = validateBands(bands);
  const save = async () => {
    if (problems.length) return;
    setBusy(true); setErr(null);
    try {
      await put(hubPath(p.qs, "/config"), { hub: { masteryBands: [...bands].sort((a, b) => a.min - b.min).map((b) => ({ min: b.min, label: b.label.trim() })) } });
      p.refreshStudents?.();          // re-reads the hub's config for every panel
      window.dispatchEvent(new Event(LEVELS_CHANGED)); // …and every open view refetches its (server-banded) data
      onClose();
    } catch (e) { setErr(errMsg(e, t("hubfam.pgCouldntSaveLevels"))); }
    finally { setBusy(false); }
  };
  return (
    <Modal title={t("hubfam.pgEditLevels")} onClose={onClose} id="hub-levels-modal"
      footer={<>
        <Button variant="ghost" className={TAP} onClick={onClose}>{t("hubfam.pgCancel")}</Button>
        <Button variant="solid" className={`${TAP} !px-6`} onClick={save} disabled={busy || problems.length > 0} data-testid="hub-save-levels">{busy ? t("hubfam.pgSaving") : t("hubfam.pgSaveLevels")}</Button>
      </>}>
      <div className="grid gap-3">
        <p className="m-0 text-[13px] leading-relaxed text-[var(--ink-2)]">{t("hubfam.pgLevelsIntro")}</p>
        {err && <Notice onDismiss={() => setErr(null)}>{err}</Notice>}
        <LevelsEditor bands={bands} onChange={setBands} />
      </div>
    </Modal>
  );
}

/** Same editor for a settings screen that saves on every change: edits are held as a draft and
 *  only handed up (`onCommit`) once they're valid, so a half-typed threshold is never saved. */
export function LevelsEditorDraft({ bands, onCommit }: { bands: Band[]; onCommit: (b: Band[]) => void }) {
  const [draft, setDraft] = useState<Band[]>(() => bands.map((b) => ({ ...b })));
  const change = (next: Band[]) => {
    setDraft(next);
    if (validateBands(next).length === 0) onCommit(next.map((b) => ({ min: b.min, label: b.label.trim() })));
  };
  return <LevelsEditor bands={draft} onChange={change} />;
}
