"use client";

import { useEffect } from "react";
import { useTimetableStore } from "./store";
import { SetupWizard } from "./SetupWizard";
import { TimetableGrid } from "./TimetableGrid";
import { PublishPanel } from "./PublishPanel";
import { SavedTimetables } from "./SavedTimetables";
import { printTimetable, downloadTimetableHtml } from "./printHtml";
import { useRealtime } from "@/lib/realtime";
import { Button } from "@/components/ui";
import { OperatorPage } from "@/components/OperatorPage";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n/provider";
import { dayShort, dayNum } from "./engine";

let didInit = false;

export function TimetableApp() {
  const t = useT();
  const tab = useTimetableStore((s) => s.tab);
  const view = useTimetableStore((s) => s.view);
  const dayList = useTimetableStore((s) => s.dayList);
  const cur = useTimetableStore((s) => s.cur);
  const loading = useTimetableStore((s) => s.loading);
  const loadError = useTimetableStore((s) => s.loadError);
  const listings = useTimetableStore((s) => s.LISTINGS);
  const saveState = useTimetableStore((s) => s.saveState);
  const saved = useTimetableStore((s) => s.saved);
  const setTab = useTimetableStore((s) => s.setTab);
  const setView = useTimetableStore((s) => s.setView);
  const showDay = useTimetableStore((s) => s.showDay);
  const generate = useTimetableStore((s) => s.generate);
  const { settings } = useSettings();
  const brand = settings.providerName || settings.billing?.businessName || "";

  useEffect(() => {
    if (!didInit) {
      didInit = true;
      void useTimetableStore.getState().init();
    }
  }, []);
  // New/changed listings and blocks appear in the picker live; the draft
  // being edited is never clobbered by the refresh.
  useRealtime(["listings", "blocks"], () => void useTimetableStore.getState().refreshListings());

  const doPrint = () => {
    const s = useTimetableStore.getState();
    printTimetable({ view: s.view, plan: s.plan, cur: s.cur, dayList: s.dayList, groups: s.groups(), FAC: s.FAC, brandName: brand });
  };
  const doDownload = () => {
    const s = useTimetableStore.getState();
    downloadTimetableHtml({ name: s.curListing?.name || "Timetable", plan: s.plan, dayList: s.dayList, groups: s.groups(), FAC: s.FAC, brandName: brand });
  };

  const saveLabel =
    saveState === "saving" ? t("p8set.saving") : saveState === "saved" ? t("p8set.tmSaved") : saveState === "error" ? t("p8set.tmSaveErr") : "";

  return (
    <OperatorPage
      title={t("p8set.tmTitle")}
      lede={t("p8set.tmLede")}
      icon="▦"
      actions={
        saveLabel ? (
          <span className={`text-[11.5px] ${saveState === "error" ? "font-bold text-[#ffdada]" : "text-white/85"}`}>
            {saveLabel}
          </span>
        ) : undefined
      }
    >
      {/* Top-level switch: build vs the folder of saved weeks. */}
      <div className="mb-3.5 inline-flex gap-1 rounded-full border border-[var(--line)] bg-[var(--panel)] p-1">
        <button
          onClick={() => { if (tab === 3) setTab(0); }}
          className={`rounded-full px-4 py-1.5 text-[12.5px] font-bold ${tab !== 3 ? "bg-[var(--brand)] text-white" : "text-[var(--ink-2)]"}`}
        >
          {t("p8set.tmBuilder")}
        </button>
        <button
          onClick={() => setTab(3)}
          className={`rounded-full px-4 py-1.5 text-[12.5px] font-bold ${tab === 3 ? "bg-[var(--brand)] text-white" : "text-[var(--ink-2)]"}`}
        >
          {t("p8set.tmMine")}{saved.length ? ` (${saved.length})` : ""}
        </button>
      </div>

      {tab === 3 && <SavedTimetables />}

      {tab !== 3 && loading && <div className="text-[13px] text-[var(--ink-3)]">{t("p8set.tmLoading")}</div>}
      {tab !== 3 && !loading && loadError && (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 text-[13px]">
          <span className="font-bold text-[var(--red,#e21d27)]">{loadError}</span>
          <Button className="ms-3" onClick={() => void useTimetableStore.getState().init()}>{t("p8set.tmTryAgain")}</Button>
        </div>
      )}
      {tab !== 3 && !loading && !loadError && !listings.length && (
        <div className="mb-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3.5 py-2.5 text-[12.5px] text-[var(--ink-2)]">
          {t("p8set.tmNoListings")}
        </div>
      )}

      {tab !== 3 && !loading && !loadError && (
        <>
          {tab === 0 && <SetupWizard />}

          {tab === 1 && (
            <div>
              <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
                <Button onClick={() => setTab(0)}>{t("p8set.tmBackSetup")}</Button>
                <div className="flex gap-2">
                  <Button onClick={doDownload}>{t("p8set.tmDownload")}</Button>
                  <Button onClick={doPrint}>{t("p8set.tmPrint")}</Button>
                  <Button variant="solid" onClick={() => setTab(2)}>
                    {t("p8set.tmPublish")}
                  </Button>
                </div>
              </div>

              {/* View tabs */}
              <div className="mb-3 inline-flex gap-1 rounded-full border border-[var(--line)] bg-[var(--panel)] p-1">
                {(["day", "week", "month"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={`rounded-full px-3.5 py-1.5 text-[12px] font-bold ${
                      view === v ? "bg-[var(--brand)] text-white" : "text-[var(--ink-2)]"
                    }`}
                  >
                    {v === "day" ? t("p8set.clDay") : v === "week" ? t("p8set.clWeek") : t("p8set.tm4Weeks")}
                  </button>
                ))}
              </div>

              {/* Day selector */}
              {view !== "month" && (
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {dayList.map((d, i) => (
                    <button
                      key={i}
                      onClick={() => showDay(i)}
                      className={`rounded-lg border px-2.5 py-1.5 text-[12px] font-bold ${
                        i === cur
                          ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                          : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)]"
                      }`}
                    >
                      {dayShort(d)}
                      {d.d && <span className="ms-1 font-semibold opacity-70">{dayNum(d)}</span>}
                    </button>
                  ))}
                </div>
              )}

              {/* Generate controls */}
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Button onClick={() => generate("auto")}>{t("p8set.tmAutoFill")}</Button>
                <Button onClick={() => generate("manual")}>{t("p8set.tmBlank")}</Button>
                <Button onClick={() => generate()}>{t("p8set.tmRebuild")}</Button>
                <span className="text-[11.5px] text-[var(--ink-3)]">
                  {t("p8set.tmHint")}
                </span>
              </div>

              <TimetableGrid />
            </div>
          )}

          {tab === 2 && <PublishPanel />}
        </>
      )}
    </OperatorPage>
  );
}
