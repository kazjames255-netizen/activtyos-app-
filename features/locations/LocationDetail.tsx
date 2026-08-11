"use client";

import { useState } from "react";
import { Card } from "@/components/ui";

export interface Venue {
  id: string;
  name: string;
  address?: string;
  city?: string;
  kind?: "place" | "online";
  facilities?: string[];
  directions?: string;
  transport?: string;
  what3words?: string;
  lat?: number;
  lng?: number;
  zoom?: number;
}

type LocTab = "timesheets" | "notifications";
const TABS: [LocTab, string][] = [
  ["timesheets", "Timesheets"], ["notifications", "Notifications & extensions"],
];

// A location's own bits — staff assignment now lives in the Deployment overview.
// This page holds Timesheets and Notifications for the venue.
export function LocationDetail({ venue, onBack }: { venue: Venue; venues: Venue[]; onBack: () => void }) {
  const [tab, setTab] = useState<LocTab>("timesheets");
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <button type="button" onClick={onBack} className="mb-1 text-[13px] font-bold text-[#1d3a8f] hover:underline">‹ Deployment</button>
          <h2 className="text-[26px] font-extrabold text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{venue.name}</h2>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="lg:w-[180px] lg:flex-none">
          <div className="flex gap-1.5 overflow-x-auto lg:flex-col">
            {TABS.map(([t, lbl]) => (
              <button key={t} type="button" onClick={() => setTab(t)}
                className={"whitespace-nowrap rounded-xl px-3.5 py-2.5 text-left text-[13.5px] font-bold transition-colors " + (tab === t ? "bg-[#eef4fd] text-[#1d3a8f]" : "text-[var(--ink-2)] hover:bg-[var(--panel)]")}
                style={tab === t ? { boxShadow: "inset 3px 0 0 #2f6bd8" } : undefined}>{lbl}</button>
            ))}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          {tab === "timesheets" && <TimesheetsTab venueName={venue.name} />}
          {tab === "notifications" && <NotificationsTab />}
        </div>
      </div>
    </div>
  );
}

function TimesheetsTab({ venueName }: { venueName: string }) {
  return (
    <Card className="p-5">
      <div className="text-[16px] font-extrabold text-[var(--ink)]">Timesheets</div>
      <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--ink-2)]">Once staff check in and out on the register, their hours at {venueName} roll up here and feed Payroll (hours × rate, plus on-cost). Check-in / check-out is wired on the schedule; the timesheet roll-up and export are on the backend list.</p>
      <div className="mt-3 rounded-xl bg-[var(--panel)] px-3 py-3 text-center text-[12.5px] text-[var(--ink-3)]">No approved hours yet this period.</div>
    </Card>
  );
}
function NotificationsTab() {
  const [flags, setFlags] = useState({ shiftPublished: true, checkinMissed: true, weeklySummary: false });
  const rows: [keyof typeof flags, string, string][] = [
    ["shiftPublished", "Shifts published", "Tell staff at this location when their rota is published."],
    ["checkinMissed", "Missed check-in", "Alert a manager when someone assigned here hasn't checked in by their start time."],
    ["weeklySummary", "Weekly summary", "Email a manager a Monday summary of the week's hours and gaps."],
  ];
  return (
    <Card className="p-5">
      <div className="text-[16px] font-extrabold text-[var(--ink)]">Notifications & extensions</div>
      <p className="mt-1 text-[12.5px] text-[var(--ink-3)]">What this location tells staff and managers. Saved locally for now.</p>
      <div className="mt-3 flex flex-col divide-y divide-[var(--line-2,#eef2f8)]">
        {rows.map(([k, title, desc]) => (
          <div key={k} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1"><div className="text-[13.5px] font-extrabold text-[var(--ink)]">{title}</div><div className="text-[11.5px] text-[var(--ink-3)]">{desc}</div></div>
            <button type="button" onClick={() => setFlags((f) => ({ ...f, [k]: !f[k] }))} role="switch" aria-checked={flags[k]} className="relative h-[22px] w-[40px] flex-none rounded-full transition-colors" style={{ background: flags[k] ? "#2f6bd8" : "var(--line)" }}><span className="absolute top-[3px] h-[16px] w-[16px] rounded-full bg-white transition-all" style={{ left: flags[k] ? "21px" : "3px" }} /></button>
          </div>
        ))}
      </div>
    </Card>
  );
}
