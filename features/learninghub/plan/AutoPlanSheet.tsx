"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Select } from "@/components/ui";
import { useI18n, useT } from "@/lib/i18n/provider";
import { Dialog, FOCUS } from "../teachKit";
import { suggestPlan, type PlanChip, type PlanItem, type PlanReason, type PlanResponse, type PlanTarget } from "./planApi";
import { uiDate } from "@/lib/i18n/format";

// "Plan next week": a props-driven sheet that shows the server's SUGGESTED week (GET /plan/suggest) as checkable cards.
// It never sets anything itself: "Set these" hands the ticked items to onAccept, and the parent decides what to do
// (prefill the Set homework form, or call setPlanItems from ./planApi). See docs/auto-plan.md for mounting.

export interface AutoPlanSheetProps {
  /** Exactly one of childId / groupId. */
  target: PlanTarget;
  /** Display name (child or group). Falls back to the name the API returns. */
  targetName?: string;
  /** The panel's tenant scope string ("" or "?tenantId=…"), like the other hub panels. */
  qs?: string;
  onClose: () => void;
  /** Called with the ticked items (in due-date order). May be async: the sheet shows "Setting…" and stays open if it throws. */
  onAccept: (items: PlanItem[]) => void | Promise<void>;
  initialDays?: number;
  initialMinutesPerDay?: number;
}

const CHIP_TONE: Record<PlanChip, string> = {
  weak: "bg-[var(--red-soft)] text-[var(--red)]",
  stale: "bg-[var(--gold-soft)] text-[var(--brand-ink)]",
  quiz: "bg-[var(--brand-soft)] text-[var(--brand-strong)]",
  lesson: "bg-[var(--violet-soft)] text-[var(--violet)]",
  worksheet: "bg-[var(--violet-soft)] text-[var(--violet)]",
  recap: "bg-[var(--violet-soft)] text-[var(--violet)]",
  fresh: "bg-[var(--green-soft)] text-[var(--hub-green-ink)]",
  untimed: "bg-[var(--panel)] text-[var(--ink-2)]",
  extraTime: "bg-[var(--panel)] text-[var(--ink-2)]",
  calm: "bg-[var(--panel)] text-[var(--ink-2)]",
  groupShare: "bg-[var(--panel)] text-[var(--ink-2)]",
};

const errText = (e: unknown) => (e instanceof Error ? e.message : "");

export function AutoPlanSheet({ target, targetName, qs = "", onClose, onAccept, initialDays = 7, initialMinutesPerDay = 20 }: AutoPlanSheetProps) {
  const t = useT();
  const { locale } = useI18n();
  const [days, setDays] = useState(initialDays);
  const [perDay, setPerDay] = useState(initialMinutesPerDay);
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [setErr, setSetErr] = useState<string | null>(null);
  const childId = target.childId, groupId = target.groupId;

  const load = useCallback(() => {
    let live = true;
    setLoading(true); setFailed(null);
    suggestPlan(childId ? { childId } : { groupId: groupId! }, { qs, days, minutesPerDay: perDay })
      .then((p) => { if (!live) return; setPlan(p); setPicked(new Set(p.items.map((i) => i.id))); })
      .catch((e) => { if (live) setFailed(errText(e) || "-"); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [childId, groupId, qs, days, perDay]);
  useEffect(() => load(), [load]);

  const dayFmt = useMemo(() => ({ format: (d: Date) => uiDate(d, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }, locale) }), [locale]);
  const fmtDay = (iso: string) => dayFmt.format(new Date(`${iso}T12:00:00Z`));
  const when = (d: number | null) => (d === null ? "" : d <= 0 ? t("hubplan.when_today") : d === 1 ? t("hubplan.when_yesterday") : d < 7 ? t("hubplan.when_days", { n: d }) : d < 14 ? t("hubplan.when_lastWeek") : t("hubplan.when_weeks", { n: Math.floor(d / 7) }));
  const reason = (r: PlanReason) => {
    const w = when(r.daysAgo);
    if (r.kind === "group") return t("hubplan.reason_group", { weak: r.weak ?? 0, total: r.total ?? 0, topic: r.topic, pct: r.pct });
    if (r.kind === "baseline") return t("hubplan.reason_baseline", { pct: r.pct, topic: r.topic });
    if (r.kind === "stale") return t("hubplan.reason_stale", { pct: r.pct, topic: r.topic, when: w });
    return w ? t("hubplan.reason_scored", { pct: r.pct, topic: r.topic, when: w }) : t("hubplan.reason_scored_nw", { pct: r.pct, topic: r.topic });
  };

  const items = plan?.items ?? [];
  const chosen = items.filter((i) => picked.has(i.id));
  const chosenMins = chosen.reduce((a, i) => a + i.minutes, 0);
  const name = targetName ?? (plan ? (plan.target.kind === "child" ? plan.target.childName : plan.target.name) : "");
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const accept = async () => {
    if (!chosen.length || busy) return;
    setBusy(true); setSetErr(null);
    try { await onAccept(chosen); } catch (e) { setSetErr(errText(e) || t("hubplan.error")); } finally { setBusy(false); }
  };

  const footer = (
    <>
      <span className="me-auto text-[12.5px] font-bold text-[var(--ink-3)]" aria-live="polite">
        {items.length > 0 && t("hubplan.summary", { count: chosen.length, mins: chosenMins })}
      </span>
      <Button onClick={onClose}>{t("hubplan.close")}</Button>
      <Button variant="solid" onClick={accept} disabled={!chosen.length || busy || loading} data-testid="autoplan-set">
        {busy ? t("hubplan.setting") : t("hubplan.set", { count: chosen.length })}
      </Button>
    </>
  );

  return (
    <Dialog title={t("hubplan.title")} subtitle={name ? t(target.childId ? "hubplan.sub_child" : "hubplan.sub_group", { name }) : undefined} onClose={onClose} footer={footer} size="lg" id="autoplan-sheet">
      <p className="m-0 mb-3 rounded-xl bg-[var(--brand-soft)] px-3 py-2 text-[12.5px] font-bold text-[var(--brand-strong)]">{t("hubplan.note")}</p>

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[12px] font-extrabold text-[var(--ink-3)]">
          {t("hubplan.label_days")}
          <Select value={String(days)} onChange={(e) => setDays(Number(e.target.value))} aria-label={t("hubplan.label_days")}>
            {[3, 5, 7, 14].map((d) => <option key={d} value={d}>{d}</option>)}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-extrabold text-[var(--ink-3)]">
          {t("hubplan.label_perday")}
          <Select value={String(perDay)} onChange={(e) => setPerDay(Number(e.target.value))} aria-label={t("hubplan.label_perday")}>
            {[10, 15, 20, 30, 45].map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
        </label>
        {items.length > 0 && (
          <div className="ms-auto flex gap-2">
            <button type="button" className={`text-[12.5px] font-extrabold text-[var(--brand)] ${FOCUS}`} onClick={() => setPicked(new Set(items.map((i) => i.id)))}>{t("hubplan.select_all")}</button>
            <button type="button" className={`text-[12.5px] font-extrabold text-[var(--ink-3)] ${FOCUS}`} onClick={() => setPicked(new Set())}>{t("hubplan.select_none")}</button>
          </div>
        )}
      </div>

      {loading && <div role="status" className="py-10 text-center text-[13px] font-bold text-[var(--ink-3)]">{t("hubplan.loading")}</div>}

      {!loading && failed !== null && (
        <div role="alert" className="rounded-2xl border border-[var(--red-line)] bg-[var(--red-soft)] p-4 text-[13px] text-[var(--red)]">
          <div className="font-extrabold">{t("hubplan.error")}</div>
          {failed && failed !== "-" && <div className="mt-1">{failed}</div>}
          <Button className="mt-3" onClick={() => load()}>{t("hubplan.retry")}</Button>
        </div>
      )}

      {!loading && failed === null && plan && items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[var(--line)] p-6 text-center">
          <div className="text-[15px] font-extrabold text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{t("hubplan.empty_t")}</div>
          <div className="mt-1 text-[13px] text-[var(--ink-3)]">{t("hubplan.empty_b")}</div>
        </div>
      )}

      {!loading && failed === null && items.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0" aria-label={t("hubplan.list_aria")}>
          {items.map((it) => {
            const on = picked.has(it.id);
            return (
              <li key={it.id} data-ui="card" className={`rounded-2xl border-2 p-3.5 transition ${on ? "border-[var(--brand-2)] bg-[var(--surface)]" : "border-[var(--line)] bg-[var(--panel)] opacity-80"}`}>
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" checked={on} onChange={() => toggle(it.id)} className={`mt-1 h-5 w-5 flex-none accent-[var(--brand)] ${FOCUS}`} data-testid="autoplan-item" />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-[14.5px] font-extrabold text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{it.title}</span>
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[12px] font-bold text-[var(--ink-3)]">
                      <span>{t("hubplan.due", { date: fmtDay(it.dueDay) })}</span>
                      <span>{t("hubplan.mins", { n: it.minutes })}</span>
                      <span>{t("hubplan.rank", { n: it.rank })}</span>
                    </span>
                    <span className="mt-1.5 block text-[13px] text-[var(--ink-2)]">{reason(it.reason)}</span>
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      {it.chips.map((c) => (
                        <span key={c} className={`inline-flex items-center rounded-full px-2.5 py-[3px] text-[11px] font-bold ${CHIP_TONE[c]}`}>{t(`hubplan.chip_${c}`)}</span>
                      ))}
                    </span>
                    {it.parts.length > 0 && (
                      <span className="mt-2 block text-[12px] text-[var(--ink-3)]">
                        <span className="sr-only">{t("hubplan.parts")}: </span>
                        {it.parts.map((p) => `${t(`hubplan.chip_${p.kind}`)}: ${p.title}`).join(" · ")}
                      </span>
                    )}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {setErr && <div role="alert" className="mt-3 rounded-xl bg-[var(--red-soft)] px-3 py-2 text-[13px] font-bold text-[var(--red)]">{setErr}</div>}

      {!loading && plan && plan.gaps.length > 0 && (
        <div className="mt-4">
          <div className="text-[12px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]">{t("hubplan.gaps_t")}</div>
          <ul className="m-0 mt-1.5 list-none space-y-1 p-0 text-[12.5px] text-[var(--ink-2)]">
            {plan.gaps.map((g) => <li key={g.topicId}>{g.topicLabel} ({g.pct}%) <span className="text-[var(--ink-3)]">· {t(`hubplan.gap_${g.why}`)}</span></li>)}
          </ul>
        </div>
      )}
    </Dialog>
  );
}
