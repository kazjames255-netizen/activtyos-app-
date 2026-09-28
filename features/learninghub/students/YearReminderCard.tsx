"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { useT } from "@/lib/i18n/provider";
import { put } from "@/lib/api";
import { Modal, friendlyError } from "../kit";
import { DirArrow } from "../rtl";
import type { PanelProps } from "../panelTypes";
import { errMsg } from "../types";
import { isDismissed, loadHandled, manualYearStudents, markDone, pendingRows, saveHandled, shouldShow, snooze, type YearRow } from "./yearReminder";

// September reminder card (tutor Home + Students). Year groups typed by hand never move on their own: this lists them and lets the
// tutor move each up, keep it, or hand it back to the date of birth. Uses PUT /students/:childId only. Sends no email or notification.

type Prev = { yearGroup: string; auto: boolean };
type Done = { kind: "moved" | "kept" | "auto"; from: string; to?: string };

/**
 * `now` is injectable so a test can pin the date.
 * `alwaysShow` is for the Settings page (a tutor visits it on purpose, unlike the Home/Students ambush): it skips the
 * seasonal window and the "Not now"/dismissed-for-the-year gating entirely — the banner shows whenever there's a
 * pending row to review, full stop, and Settings shows a neutral "up to date" line instead when there's nothing to do.
 */
export function YearReminder({ tenantId, qs, canEdit, readOnly, franchiseId, students, yearGroups, refreshStudents, now, alwaysShow }: Pick<PanelProps, "tenantId" | "qs" | "canEdit" | "readOnly" | "franchiseId" | "students" | "refreshStudents"> & { yearGroups: string[]; now?: () => Date; alwaysShow?: boolean }) {
  const t = useT();
  const clock = useCallback(() => (now ? now() : new Date()), [now]);
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [handled, setHandled] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<Record<string, Done>>({});
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [undo, setUndo] = useState<{ label: string; prev: Record<string, Prev> } | null>(null);
  const [live, setLive] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is read after mount (SSR-safe)
  useEffect(() => { setDismissed(isDismissed(tenantId, clock())); setHandled(loadHandled(tenantId, clock())); setReady(true); }, [tenantId, clock]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const editable = canEdit && !readOnly;
  const rows = manualYearStudents(students, yearGroups, franchiseId);
  // Rows changed in this open dialog stay listed (with what happened) until it is closed.
  const listed = rows.filter((r) => !handled.has(r.childId) || done[r.childId]);
  const pending = pendingRows(rows, handled);
  const show = ready && editable && (alwaysShow ? pending.length > 0 : shouldShow({ on: clock(), canEdit: editable, rows: pending, dismissed }));
  const settled = ready && editable && alwaysShow && pending.length === 0;
  if (!show && !settled && !open) return null;

  const mark = (ids: string[], on: boolean) => setHandled((h) => { const n = new Set(h); for (const id of ids) { if (on) n.add(id); else n.delete(id); } saveHandled(tenantId, n, clock()); return n; });
  const putYear = (childId: string, body: { yearGroup: string } | { yearGroupAuto: true }) => put(`/api/learning-hub/students/${childId}${qs}`, body);
  const fail = (childId: string, e: unknown) => setErrs((x) => ({ ...x, [childId]: friendlyError(errMsg(e, t("hubshell.st_yrChangeFail"))) }));
  const without = <T,>(o: Record<string, T>, k: string): Record<string, T> => Object.fromEntries(Object.entries(o).filter(([id]) => id !== k));
  const clearErr = (childId: string) => setErrs((x) => without(x, childId));

  const moveOne = async (r: YearRow) => {
    if (!r.next) return;
    setBusy(r.childId); clearErr(r.childId);
    try {
      await putYear(r.childId, { yearGroup: r.next });
      setDone((d) => ({ ...d, [r.childId]: { kind: "moved", from: r.current, to: r.next! } })); mark([r.childId], true);
      setLive(t("hubshell.st_yrMovedTo", { name: r.name, to: r.next })); refreshStudents?.();
    } catch (e) { fail(r.childId, e); } finally { setBusy(null); }
  };
  const undoOne = async (r: YearRow) => {
    const d = done[r.childId]; if (!d) return;
    setBusy(r.childId); clearErr(r.childId);
    try {
      await putYear(r.childId, { yearGroup: d.from });
      setDone((x) => without(x, r.childId)); mark([r.childId], false);
      setLive(t("hubshell.st_yrPutBackTo", { name: r.name, from: d.from })); refreshStudents?.();
    } catch (e) { fail(r.childId, e); } finally { setBusy(null); }
  };
  const keep = (r: YearRow) => { setDone((d) => ({ ...d, [r.childId]: { kind: "kept", from: r.current } })); mark([r.childId], true); setLive(t("hubshell.st_yrStays", { name: r.name, year: r.current })); };
  const setAuto = async (r: YearRow) => {
    setBusy(r.childId); clearErr(r.childId);
    try {
      await putYear(r.childId, { yearGroupAuto: true });
      setDone((d) => ({ ...d, [r.childId]: { kind: "auto", from: r.current } })); mark([r.childId], true);
      setLive(t("hubshell.st_yrNowAuto", { name: r.name })); refreshStudents?.();
    } catch (e) { fail(r.childId, e); } finally { setBusy(null); }
  };

  const moveAll = async () => {
    const todo = pending.filter((r) => r.next);
    setConfirmAll(false); setBusy("all");
    const prev: Record<string, Prev> = {}; let failed = 0;
    for (const r of todo) {
      try { await putYear(r.childId, { yearGroup: r.next! }); prev[r.childId] = { yearGroup: r.current, auto: false }; setDone((d) => ({ ...d, [r.childId]: { kind: "moved", from: r.current, to: r.next! } })); clearErr(r.childId); }
      catch (e) { failed++; fail(r.childId, e); }
    }
    const ids = Object.keys(prev);
    mark(ids, true); setBusy(null); refreshStudents?.();
    setLive(failed ? t("hubshell.st_yrMovedFail", { n: ids.length, failed }) : t("hubshell.st_yrMoved", { n: ids.length }));
    if (ids.length) {
      setUndo({ label: t("hubshell.st_yrMovedLabel", { n: ids.length }), prev });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setUndo(null), 10_000);
    }
  };
  const undoAll = async () => {
    if (!undo) return;
    if (timer.current) clearTimeout(timer.current);
    const { prev } = undo; setUndo(null); setBusy("all");
    const back: string[] = [];
    for (const [id, p] of Object.entries(prev)) {
      try { await putYear(id, { yearGroup: p.yearGroup }); back.push(id); setDone((d) => without(d, id)); }
      catch (e) { fail(id, e); }
    }
    mark(back, false); setBusy(null); refreshStudents?.();
    setLive(t("hubshell.st_yrPutBack", { n: back.length }));
  };

  const close = () => { setOpen(false); setConfirmAll(false); setDone({}); setErrs({}); };
  const allDone = () => { markDone(tenantId, clock()); setDismissed(true); close(); };
  const movable = pending.filter((r) => r.next).length;

  return (
    <>
      <div aria-live="polite" role="status" className="sr-only">{live}</div>
      {settled && (
        <p data-testid="year-reminder-settled" className="text-[13px] font-semibold text-[var(--ink-2)]"><span aria-hidden>✅ </span>{t("hubshell.st_yrUpToDate")}</p>
      )}
      {show && (
        <section data-testid="year-reminder" aria-label={t("hubshell.st_yrNewYear")} className="flex flex-wrap items-center gap-3 rounded-2xl border p-3 sm:p-4" style={{ background: "var(--gold-soft)", borderColor: "var(--gold-line)" }}>
          <div className="min-w-0 flex-1 basis-[220px]">
            <p className="text-[14px] font-extrabold leading-snug text-[var(--ink)]"><span aria-hidden>🎒 </span>{t("hubshell.st_yrNewYear")}</p>
            <p className="text-[12.5px] font-semibold text-[var(--ink-2)]">{t("hubshell.st_yrPendingBody", { n: pending.length })}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button sm className="!min-h-[44px] lg:!min-h-[36px]" onClick={() => setOpen(true)}>{t("hubshell.st_yrReview")}</Button>
            <button type="button" onClick={() => { snooze(tenantId, clock()); setDismissed(true); }} className="min-h-[44px] rounded-xl px-3 text-[13px] font-extrabold text-[var(--ink-2)] hover:bg-[var(--panel)] lg:min-h-[36px]">{t("hubshell.st_yrNotNow")}</button>
          </div>
        </section>
      )}
      <Modal open={open} onClose={close} wide title={t("hubshell.st_yrReview")}
        footer={<>
          {confirmAll ? (
            <span className="me-auto flex flex-wrap items-center gap-2" role="alertdialog" aria-label={t("hubshell.st_yrConfirmAria")}>
              <span className="text-[13px] font-bold text-[var(--ink)]">{t("hubshell.st_yrMoveQ", { n: movable })}</span>
              <Button sm onClick={moveAll} className="!min-h-[44px] lg:!min-h-[36px]">{t("hubshell.st_yrYesMove", { n: movable })}</Button>
              <button type="button" onClick={() => setConfirmAll(false)} className="min-h-[44px] rounded-xl px-3 text-[13px] font-extrabold text-[var(--ink-2)] lg:min-h-[36px]">{t("hubshell.st_cancel")}</button>
            </span>
          ) : (
            <Button sm variant="ghost" disabled={movable === 0 || busy !== null} onClick={() => setConfirmAll(true)} className="me-auto !min-h-[44px] lg:!min-h-[36px]">{movable ? t("hubshell.st_yrMoveAllN", { n: movable }) : t("hubshell.st_yrMoveAll")}</Button>
          )}
          <Button sm onClick={allDone} className="!min-h-[44px] lg:!min-h-[36px]">{t("hubshell.st_yrAllDone")}</Button>
        </>}>
        <p className="mb-3 text-[13px] text-[var(--ink-2)]">{t("hubshell.st_yrIntro")}</p>
        {undo && (
          <div role="status" data-testid="year-undo" className="mb-3 flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[13px] font-bold text-[var(--ink)]">
            <span className="flex-1">{undo.label}.</span>
            <button type="button" onClick={undoAll} className="min-h-[44px] rounded-lg px-3 font-extrabold text-[var(--brand-ink)] underline lg:min-h-[34px]">{t("hubshell.st_undo")}</button>
          </div>
        )}
        {listed.length === 0 && <p className="py-6 text-center text-[13px] font-semibold text-[var(--ink-2)]">{t("hubshell.st_yrNothingLeft")}</p>}
        <ul className="divide-y divide-[var(--line)]" aria-label={t("hubshell.st_yrListAria")}>
          {listed.map((r) => {
            const d = done[r.childId]; const b = busy === r.childId || busy === "all";
            return (
              <li key={r.childId} data-year-row={r.childId} className="py-2.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <div className="min-w-0 flex-1 basis-[150px]">
                    <p className="truncate text-[14px] font-extrabold text-[var(--ink)]">{r.name}</p>
                    <p className="text-[12.5px] font-semibold text-[var(--ink-2)]">
                      {d?.kind === "moved" ? <>{d.from} <DirArrow /> <b>{d.to}</b> <span aria-hidden>✓</span></>
                        : d?.kind === "kept" ? <>{t("hubshell.st_yrStaysIn", { year: d.from })} <span aria-hidden>✓</span></>
                        : d?.kind === "auto" ? <>{t("hubshell.st_yrNowAutomatic")} <span aria-hidden>✓</span></>
                        : r.next ? <>{r.current} <DirArrow /> <b>{r.next}</b></> : <>{t("hubshell.st_yrLeft", { year: r.current })}</>}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {d?.kind === "moved" && <button type="button" disabled={b} onClick={() => undoOne(r)} aria-label={t("hubshell.st_yrUndoName", { name: r.name })} className="min-h-[44px] rounded-lg px-3 text-[13px] font-extrabold text-[var(--brand-ink)] underline lg:min-h-[34px]">{t("hubshell.st_undo")}</button>}
                    {!d && r.next && <Button sm disabled={b} onClick={() => moveOne(r)} aria-label={t("hubshell.st_yrMoveNameTo", { name: r.name, to: r.next })} className="!min-h-[44px] lg:!min-h-[34px]">{t("hubshell.st_yrMoveUp")}</Button>}
                    {!d && <Button sm variant="ghost" disabled={b} onClick={() => keep(r)} aria-label={t("hubshell.st_yrKeepNameIn", { name: r.name, year: r.current })} className="!min-h-[44px] lg:!min-h-[34px]">{t("hubshell.st_yrKeep")}</Button>}
                    {!d && r.canAuto && <Button sm variant="ghost" disabled={b} onClick={() => setAuto(r)} aria-label={t("hubshell.st_yrSetAutoName", { name: r.name })} className="!min-h-[44px] lg:!min-h-[34px]">{t("hubshell.st_yrSetAuto")}</Button>}
                  </div>
                </div>
                {errs[r.childId] && <p role="alert" className="mt-1 text-[12.5px] font-semibold" style={{ color: "var(--red)" }}>{errs[r.childId]}</p>}
              </li>
            );
          })}
        </ul>
      </Modal>
    </>
  );
}
