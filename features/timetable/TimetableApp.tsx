"use client";

import { useEffect } from "react";
import { useTimetableStore } from "./store";
import { SetupWizard } from "./SetupWizard";
import { TimetableGrid } from "./TimetableGrid";
import { PublishPanel } from "./PublishPanel";
import { printTimetable } from "./printHtml";
import { TBtn } from "./ui";

let didInit = false;

export function TimetableApp() {
  const tab = useTimetableStore((s) => s.tab);
  const view = useTimetableStore((s) => s.view);
  const dayList = useTimetableStore((s) => s.dayList);
  const cur = useTimetableStore((s) => s.cur);
  const setTab = useTimetableStore((s) => s.setTab);
  const setView = useTimetableStore((s) => s.setView);
  const showDay = useTimetableStore((s) => s.showDay);
  const generate = useTimetableStore((s) => s.generate);

  useEffect(() => {
    if (!didInit) {
      didInit = true;
      useTimetableStore.getState().init();
    }
  }, []);

  const doPrint = () => {
    const s = useTimetableStore.getState();
    printTimetable({ view: s.view, plan: s.plan, cur: s.cur, dayList: s.dayList, groups: s.groups(), FAC: s.FAC });
  };

  return (
    <div className="text-[var(--ink)]">
      {/* Header */}
      <div className="mb-3.5">
        <h3 className="m-0 flex items-center gap-2 font-[var(--ff-display)] text-[20px] font-extrabold text-[var(--ink)]">
          Activity timetable builder
          <span className="rounded-full bg-[var(--panel)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--ink-3)]">
            Phase 2
          </span>
        </h3>
        <div className="mt-0.5 text-[12.5px] text-[var(--ink-3)]">
          Build each day from your activity bank, then publish to staff &amp; parents
        </div>
      </div>

      {tab === 0 && <SetupWizard />}

      {tab === 1 && (
        <div>
          <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
            <TBtn onClick={() => setTab(0)}>← Back to setup</TBtn>
            <div className="flex gap-2">
              <TBtn onClick={doPrint}>↓ Download PDF</TBtn>
              <TBtn variant="solid" onClick={() => setTab(2)}>
                Publish →
              </TBtn>
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
                {v === "day" ? "Day" : v === "week" ? "Week" : "4 weeks"}
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
                  {d.n}
                  {d.d && <span className="ml-1 font-semibold opacity-70">{d.d.split(" ")[0]}</span>}
                </button>
              ))}
            </div>
          )}

          {/* Generate controls */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <TBtn onClick={() => generate("auto")}>Auto-fill</TBtn>
            <TBtn onClick={() => generate("manual")}>Blank template</TBtn>
            <TBtn onClick={() => generate()}>↻ Rebuild</TBtn>
            <span className="text-[11.5px] text-[var(--ink-3)]">
              Each day is different. Drag a block to swap it, or drag an activity from the bank onto a cell.
            </span>
          </div>

          <TimetableGrid />
        </div>
      )}

      {tab === 2 && <PublishPanel />}
    </div>
  );
}
