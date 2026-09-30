"use client";

// Compact live "Who's in now" card for the operator Dashboard — clocked in / on
// break / off right now, with a jump to the full Clock in/out & timesheets area.
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { isRTL } from "@/lib/i18n/config";
import { type ClockRecord, loadClock, offToday, sinceLabel, useClockRefresh } from "./data";

export function LiveClockCard() {
  const { t, locale } = useI18n();
  const rtl = isRTL(locale);
  const [all, setAll] = useState<Record<string, ClockRecord>>({});
  useClockRefresh(setAll);
  const [off, setOff] = useState<{ name: string; kind: string }[]>([]);
  useEffect(() => { setAll(loadClock()); setOff(offToday()); const t = setInterval(() => setAll(loadClock()), 30000); return () => clearInterval(t); }, []);
  const people = Object.values(all);
  const inNow = people.filter((r) => r.status === "in");
  const onBreak = people.filter((r) => r.status === "break");

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#12b76a] opacity-60" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#12b76a]" /></span>
        <div className="text-[13px] font-extrabold text-[var(--ink)]">{t("p8wf.lccWhosIn")}</div>
        <a href="timesheets" className="ms-auto text-[11.5px] font-bold text-[#1d3a8f] hover:underline">{t("p8wf.lccTimesheets")} {rtl ? "←" : "→"}</a>
      </div>
      <div className="mb-2 flex flex-wrap gap-3 text-[12px]">
        <span className="font-bold text-[#0f7a43]">🟢 {t("p8wf.lccNIn", { n: inNow.length })}</span>
        <span className="font-bold text-[#8a5a09]">⏸ {t("p8wf.lccNBreak", { n: onBreak.length })}</span>
        <span className="font-bold text-[#8b5cf6]">🏖 {t("p8wf.lccNOff", { n: off.length })}</span>
      </div>
      {inNow.length + onBreak.length === 0 ? <div className="text-[12px] text-[var(--ink-3)]">{t("p8wf.lccNobody")}</div> : (
        <div className="space-y-1">{[...inNow, ...onBreak].slice(0, 6).map((r) => (
          <div key={r.id} className="flex items-center gap-2 text-[12px]">
            <span className="h-2 w-2 flex-none rounded-full" style={{ background: r.status === "break" ? "#f59e0b" : "#12b76a" }} />
            <span className="truncate font-semibold text-[var(--ink)]">{r.name}</span>
            {r.op && <span className="truncate text-[var(--ink-3)]">· {r.op}</span>}
            <span className="ms-auto flex-none text-[var(--ink-3)]">{r.status === "break" ? t("p8wf.onBreakLc") : sinceLabel(r.clockInAt)}{r.lateMin ? ` · ${t("p8wf.lateLc")}` : ""}</span>
          </div>
        ))}</div>
      )}
    </div>
  );
}
