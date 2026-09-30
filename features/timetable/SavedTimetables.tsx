"use client";

import { dateLocale as dl } from "@/lib/i18n/format";
import { useState } from "react";
import { useTimetableStore } from "./store";
import { useSettings } from "@/lib/settings";
import { downloadTimetableHtml } from "./printHtml";
import { useI18n } from "@/lib/i18n/provider";
import { pickPlural } from "@/lib/i18n/plural";

const fmt = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString(dl(), { day: "numeric", month: "short" });
};
const fmtWhen = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString(dl(), { day: "numeric", month: "short", year: "numeric" });
};

/** The operator's folder of saved weeks — everything auto-saved from the
 * builder, with its published state, openable and downloadable. */
export function SavedTimetables() {
  const { t: tx, locale } = useI18n();
  const saved = useTimetableStore((s) => s.saved);
  const FAC = useTimetableStore((s) => s.FAC);
  const openSaved = useTimetableStore((s) => s.openSaved);
  const deleteSaved = useTimetableStore((s) => s.deleteSaved);
  const setTab = useTimetableStore((s) => s.setTab);
  const { settings } = useSettings();
  const brand = settings.providerName || settings.billing?.businessName || "";
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (!saved.length) {
    return (
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-5 py-10 text-center">
        <div className="text-[15px] font-extrabold text-[var(--ink)]">{tx("p8set.stNone")}</div>
        <div className="mx-auto mt-1 max-w-[420px] text-[12.5px] text-[var(--ink-3)]">
          {tx("p8set.stNoneD")}
        </div>
        <button
          onClick={() => setTab(0)}
          className="mt-4 rounded-full px-4 py-2 text-[12.5px] font-bold text-white"
          style={{ background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)" }}
        >
          {tx("p8set.stBuild")}
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {saved.map((t) => {
        const pub = t.published;
        const tone = pub?.parents
          ? { label: tx("p8set.stSharedParents", { aud: tx(pub.audience === "booked" ? "p8set.ttAudBooked" : "p8set.ttAudEveryone") }), bg: "#e2f7ec", fg: "#12995a" }
          : pub?.staff
            ? { label: tx("p8set.stPubStaff"), bg: "#eaf0fc", fg: "#16306e" }
            : { label: tx("p8set.lcDraft"), bg: "#f1eef7", fg: "#6a4fd0" };
        return (
          <div key={t.id} className="flex flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-[0_1px_3px_rgba(20,30,60,.06)]">
            <div className="px-4 py-3 text-white" style={{ background: "radial-gradient(120% 140% at 12% -20%, #4f8bf5 0%, transparent 55%), linear-gradient(120deg,#16306e 0%,#3f78d8 100%)" }}>
              <div className="text-[14px] font-extrabold [overflow-wrap:anywhere]">{t.name}</div>
              <div className="mt-0.5 text-[11.5px] text-white/85">
                {fmt(t.dateFrom)} – {fmt(t.dateTo)} · {pickPlural(tx, locale, "p8set.wzNDays", t.dayList.length)}
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-2.5 p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full px-2.5 py-0.5 text-[11px] font-extrabold" style={{ background: tone.bg, color: tone.fg }}>
                  {tone.label}
                </span>
                {t.updatedAt && <span className="text-[11px] text-[var(--ink-3)]">{tx("p8set.stSavedOn", { date: fmtWhen(t.updatedAt) })}</span>}
              </div>

              <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                <button
                  onClick={() => openSaved(t.id)}
                  className="rounded-full px-3 py-1.5 text-[12px] font-bold text-white"
                  style={{ background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)" }}
                >
                  {tx("p8set.stOpen")}
                </button>
                <button
                  onClick={() => downloadTimetableHtml({ name: t.name, plan: t.plan, dayList: t.dayList, groups: t.config.groups, FAC, brandName: brand })}
                  className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)]"
                >
                  {tx("p8set.tmDownload")}
                </button>
                {confirmId === t.id ? (
                  <span className="inline-flex items-center gap-1.5">
                    <button
                      onClick={() => { deleteSaved(t.id); setConfirmId(null); }}
                      className="rounded-full bg-[var(--red,#e21d27)] px-3 py-1.5 text-[12px] font-bold text-white"
                    >
                      {tx("p8set.stDeleteGood")}
                    </button>
                    <button onClick={() => setConfirmId(null)} className="text-[12px] font-bold text-[var(--ink-3)]">{tx("p8set.cancel")}</button>
                  </span>
                ) : (
                  <button
                    onClick={() => setConfirmId(t.id)}
                    className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-3)]"
                  >
                    {tx("p8set.delete")}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
