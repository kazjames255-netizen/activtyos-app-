"use client";

import { type ReactNode } from "react";
import { useSettings, type SchedulingSettings, DEFAULT_SCHEDULING } from "@/lib/settings";
import { Card, Input, Select } from "@/components/ui";

// Company-wide scheduling defaults — the settings that drive the rota (first
// day, default shift/break, on-cost, swaps/offers…). Lives as a tab in the
// staff-schedule area. Self-contained: loads + saves settings.scheduling.
export function SchedulingSettingsForm() {
  const { settings, save } = useSettings();
  const value = { ...DEFAULT_SCHEDULING, ...(settings.scheduling ?? {}) };
  const set = <K extends keyof SchedulingSettings>(k: K, v: SchedulingSettings[K]) => void save({ settings: { ...settings, scheduling: { ...value, [k]: v } } });
  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <SecHead>Basics</SecHead>
        <SelRow label="First day of week" desc="Determines the start day of the schedule and the default week period for calculating weekly overtime." value={value.firstDay} onChange={(v) => set("firstDay", v as "mon" | "sun")} opts={[["mon", "Mon"], ["sun", "Sun"]]} />
        <NumRow label="Default shift duration (hours)" desc="Default shift length when creating shifts." value={value.defaultShiftHours} onChange={(v) => set("defaultShiftHours", v)} suffix="hrs" />
        <NumRow label="Default break duration (minutes)" desc="Default break length when creating shifts." value={value.defaultBreakMins} onChange={(v) => set("defaultBreakMins", v)} suffix="mins" />
        <SelRow label="Default break — paid or unpaid" desc="Sets whether the pre-filled break counts as paid time. Drives worked-hours and the pay vs cost split shown on the schedule. Recorded only — no money is moved." value={value.breakPaid} onChange={(v) => set("breakPaid", v as "paid" | "unpaid")} opts={[["unpaid", "Unpaid"], ["paid", "Paid"]]} />
      </Card>

      <Card className="p-5">
        <SecHead>Creating and publishing shifts</SecHead>
        <SelRow label="Shift notifications recipient" desc="Who receives shift notifications for late staff and shift-swap approvals." value={value.notifyRecipient} onChange={(v) => set("notifyRecipient", v as SchedulingSettings["notifyRecipient"])} opts={[["bestfit", "Best fit"], ["manager", "Site manager"], ["admin", "Admin / Owner"]]} />
        <SelRow label="Send notification when shifts are removed" desc="Notify staff when they are removed from a published shift." value={value.notifyOnRemoved} onChange={(v) => set("notifyOnRemoved", v as SchedulingSettings["notifyOnRemoved"])} opts={[["email_push", "Email and smartphone push"], ["email", "Email only"], ["push", "Push only"], ["none", "Don't notify"]]} />
        <TogRow label="Allow staff to claim or request open shifts if unavailable" desc="Staff can claim or request open shifts (with approval) even if unavailable or partially available. Extends to staff-initiated swaps and offers." value={value.allowClaimOpen} onChange={(v) => set("allowClaimOpen", v)} />
        <SelRow label="Turn unconfirmed published shifts to open shifts" desc="After this timeframe, unconfirmed published shifts become open shifts." value={value.unconfirmedToOpen} onChange={(v) => set("unconfirmedToOpen", v as SchedulingSettings["unconfirmedToOpen"])} opts={[["off", "Not required"], ["12h", "After 12 hours"], ["24h", "After 24 hours"], ["48h", "After 48 hours"]]} />
        <SelRow label="Scheduling suggestion order" desc="How suggested staff are displayed. Best fit spreads scheduled hours evenly across the team while minimising cost." value={value.suggestionOrder} onChange={(v) => set("suggestionOrder", v as SchedulingSettings["suggestionOrder"])} opts={[["bestfit", "Best fit"], ["cost", "Lowest cost first"], ["hours", "Fewest hours first"]]} />
        <TogRow label="Display location and area name when publishing via SMS and calendar" desc="Show location and area names instead of codes. May result in additional SMS charges." value={value.showLocationNames} onChange={(v) => set("showLocationNames", v)} />
      </Card>

      <Card className="p-5">
        <SecHead>Swaps and offers</SecHead>
        <SelRow label="Co-worker schedule visibility" desc="Who can see the team's “Who’s on this week” rota on their My schedule page. Same listing = staff see everyone rostered on a listing they work on; Leads & managers = only leads see it." value={value.coworkerVisibility} onChange={(v) => set("coworkerVisibility", v as SchedulingSettings["coworkerVisibility"])} opts={[["all", "All staff"], ["team", "Same listing only"], ["leads", "Leads & managers only"], ["none", "Hidden"]]} />
        <TogRow label="Swap shifts" desc="Staff can swap shifts with each other if both hold the appropriate training/qualifications." value={value.swapShifts} onChange={(v) => set("swapShifts", v)} />
        <TogRow label="Manager approval for shift swaps" desc="Require a manager to approve shift swaps." value={value.swapApproval} onChange={(v) => set("swapApproval", v)} />
        <TogRow label="Offer shifts" desc="Staff can offer their shift to qualified, available co-workers. Manager approval not required but a manager is notified when the shift is accepted." value={value.offerShifts} onChange={(v) => set("offerShifts", v)} />
      </Card>

      <Card className="p-5">
        <SecHead>Reporting</SecHead>
        <NumRow label="On-cost percentage" desc="Adds an additional cost on top of all wages (e.g. employer NI, pension). Shows on the schedule and on cost reports. Recorded only — ActivityOS never moves money." value={value.onCostPct} onChange={(v) => set("onCostPct", v)} suffix="%" step="0.01" />
        <NumRow label="Default open/empty shift cost (per hour)" desc="Open/empty shifts are included in scheduled hours and cost using this default hourly cost." value={value.openShiftCost} onChange={(v) => set("openShiftCost", v)} suffix="£/hr" />
      </Card>

      <Card className="p-5">
        <SecHead>Availability</SecHead>
        <TogRow label="Send reminders" desc="Remind staff to keep their availability up to date." value={value.availabilityReminders} onChange={(v) => set("availabilityReminders", v)} />
        <TogRow label="Auto-request availability each new period" desc="When a new week or season opens, automatically ask staff who haven't submitted to confirm their availability." value={value.autoRequestAvailability} onChange={(v) => set("autoRequestAvailability", v)} />
        <SelRow label="Auto-chase unconfirmed staff" desc="Keep reminding staff who haven't submitted their availability until they do." value={value.autoRemindUnconfirmed} onChange={(v) => set("autoRemindUnconfirmed", v as SchedulingSettings["autoRemindUnconfirmed"])} opts={[["off", "Off — I'll chase manually"], ["24h", "Every 24 hours"], ["48h", "Every 48 hours"]]} />
      </Card>

      <Card className="p-5">
        <SecHead>Notifications &amp; automation</SecHead>
        <SelRow label="Notify staff when the rota is published" desc="How assigned staff are told about their shifts when you publish." value={value.notifyOnPublish} onChange={(v) => set("notifyOnPublish", v as SchedulingSettings["notifyOnPublish"])} opts={[["email_push", "Email and smartphone push"], ["email", "Email only"], ["push", "Push only"], ["off", "Don't notify"]]} />
        <SelRow label="Shift reminder to staff" desc="Send each staff member a reminder before their shift starts." value={value.shiftReminder} onChange={(v) => set("shiftReminder", v as SchedulingSettings["shiftReminder"])} opts={[["off", "Off"], ["24h", "24 hours before"], ["2h", "2 hours before"]]} />
        <SelRow label="Check-in grace period" desc="How long after a shift's start time before an assigned staff member who hasn't checked in shows in Check-in alerts." value={String(value.checkinGraceMin)} onChange={(v) => set("checkinGraceMin", Number(v) as SchedulingSettings["checkinGraceMin"])} opts={[["10", "10 minutes"], ["15", "15 minutes"], ["30", "30 minutes"]]} />
        <TogRow label="Auto-flag overdue check-ins" desc="Automatically surface staff who aren't checked in past the grace period in Check-in alerts. Turn off to hide the alerts panel." value={value.checkinAutoAlert} onChange={(v) => set("checkinAutoAlert", v)} />
      </Card>
    </div>
  );
}

const SecHead = ({ children }: { children: ReactNode }) => <div className="mb-1 text-[17px] font-extrabold text-[var(--ink)]">{children}</div>;
function RowShell({ label, desc, control }: { label: string; desc: string; control: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-4 border-t border-[var(--line-2,#eef2f8)] py-3.5 first:border-t-0">
      <div className="min-w-[180px] flex-1"><div className="text-[13.5px] font-extrabold text-[var(--ink)]">{label}</div><div className="mt-0.5 text-[11.5px] leading-relaxed text-[var(--ink-3)]">{desc}</div></div>
      <div className="flex-none">{control}</div>
    </div>
  );
}
function SelRow({ label, desc, value, onChange, opts }: { label: string; desc: string; value: string; onChange: (v: string) => void; opts: [string, string][] }) {
  return <RowShell label={label} desc={desc} control={<Select value={value} onChange={(e) => onChange(e.target.value)} className="min-w-[190px]">{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>} />;
}
function NumRow({ label, desc, value, onChange, suffix, step }: { label: string; desc: string; value: number; onChange: (v: number) => void; suffix?: string; step?: string }) {
  return <RowShell label={label} desc={desc} control={<span className="inline-flex items-center gap-1.5"><Input type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-[120px] text-right" />{suffix && <span className="text-[12.5px] font-bold text-[var(--ink-3)]">{suffix}</span>}</span>} />;
}
function TogRow({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return <RowShell label={label} desc={desc} control={
    <span className="inline-flex items-center gap-2">
      <button type="button" onClick={() => onChange(!value)} role="switch" aria-checked={value} className="relative h-[24px] w-[44px] flex-none rounded-full transition-colors" style={{ background: value ? "#22b365" : "var(--line)" }}><span className="absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white transition-all" style={{ left: value ? "23px" : "3px" }} /></button>
      <span className="w-[26px] text-[11px] font-extrabold" style={{ color: value ? "#0f7a43" : "var(--ink-3)" }}>{value ? "ON" : "OFF"}</span>
    </span>
  } />;
}
