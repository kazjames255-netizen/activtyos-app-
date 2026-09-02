"use client";

import { type ReactNode } from "react";
import { useSettings, type SchedulingSettings, DEFAULT_SCHEDULING } from "@/lib/settings";
import { useT } from "@/lib/i18n/provider";
import { Card, Input, Select } from "@/components/ui";

// Company-wide scheduling defaults — the settings that drive the rota (first
// day, default shift/break, on-cost, swaps/offers…). Lives as a tab in the
// staff-schedule area. Self-contained: loads + saves settings.scheduling.
export function SchedulingSettingsForm() {
  const t = useT();
  const { settings, save } = useSettings();
  const value = { ...DEFAULT_SCHEDULING, ...(settings.scheduling ?? {}) };
  const set = <K extends keyof SchedulingSettings>(k: K, v: SchedulingSettings[K]) => void save({ settings: { ...settings, scheduling: { ...value, [k]: v } } });
  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <SecHead>{t("schedule.secBasics")}</SecHead>
        <SelRow label={t("schedule.firstDayLabel")} desc={t("schedule.firstDayDesc")} value={value.firstDay} onChange={(v) => set("firstDay", v as "mon" | "sun")} opts={[["mon", t("schedule.optMon")], ["sun", t("schedule.optSun")]]} />
        <NumRow label={t("schedule.defaultShiftLabel")} desc={t("schedule.defaultShiftDesc")} value={value.defaultShiftHours} onChange={(v) => set("defaultShiftHours", v)} suffix={t("schedule.suffixHrs")} />
        <NumRow label={t("schedule.defaultBreakLabel")} desc={t("schedule.defaultBreakDesc")} value={value.defaultBreakMins} onChange={(v) => set("defaultBreakMins", v)} suffix={t("schedule.suffixMins")} />
        <SelRow label={t("schedule.breakPaidLabel")} desc={t("schedule.breakPaidDesc")} value={value.breakPaid} onChange={(v) => set("breakPaid", v as "paid" | "unpaid")} opts={[["unpaid", t("schedule.optUnpaid")], ["paid", t("schedule.optPaid")]]} />
      </Card>

      <Card className="p-5">
        <SecHead>{t("schedule.secCreatingPublishing")}</SecHead>
        <SelRow label={t("schedule.notifyRecipientLabel")} desc={t("schedule.notifyRecipientDesc")} value={value.notifyRecipient} onChange={(v) => set("notifyRecipient", v as SchedulingSettings["notifyRecipient"])} opts={[["bestfit", t("schedule.optBestFit")], ["manager", t("schedule.optSiteManager")], ["admin", t("schedule.optAdminOwner")]]} />
        <SelRow label={t("schedule.notifyRemovedLabel")} desc={t("schedule.notifyRemovedDesc")} value={value.notifyOnRemoved} onChange={(v) => set("notifyOnRemoved", v as SchedulingSettings["notifyOnRemoved"])} opts={[["email_push", t("schedule.optEmailPush")], ["email", t("schedule.optEmailOnly")], ["push", t("schedule.optPushOnly")], ["none", t("schedule.optDontNotify")]]} />
        <TogRow label={t("schedule.allowClaimLabel")} desc={t("schedule.allowClaimDesc")} value={value.allowClaimOpen} onChange={(v) => set("allowClaimOpen", v)} />
        <SelRow label={t("schedule.unconfirmedToOpenLabel")} desc={t("schedule.unconfirmedToOpenDesc")} value={value.unconfirmedToOpen} onChange={(v) => set("unconfirmedToOpen", v as SchedulingSettings["unconfirmedToOpen"])} opts={[["off", t("schedule.optNotRequired")], ["12h", t("schedule.optAfter12h")], ["24h", t("schedule.optAfter24h")], ["48h", t("schedule.optAfter48h")]]} />
        <SelRow label={t("schedule.suggestionOrderLabel")} desc={t("schedule.suggestionOrderDesc")} value={value.suggestionOrder} onChange={(v) => set("suggestionOrder", v as SchedulingSettings["suggestionOrder"])} opts={[["bestfit", t("schedule.optBestFit")], ["cost", t("schedule.optLowestCost")], ["hours", t("schedule.optFewestHours")]]} />
        <TogRow label={t("schedule.showLocationLabel")} desc={t("schedule.showLocationDesc")} value={value.showLocationNames} onChange={(v) => set("showLocationNames", v)} />
      </Card>

      <Card className="p-5">
        <SecHead>{t("schedule.secSwapsOffers")}</SecHead>
        <SelRow label={t("schedule.coworkerVisLabel")} desc={t("schedule.coworkerVisDesc")} value={value.coworkerVisibility} onChange={(v) => set("coworkerVisibility", v as SchedulingSettings["coworkerVisibility"])} opts={[["all", t("schedule.optAllStaff")], ["team", t("schedule.optSameListing")], ["leads", t("schedule.optLeadsManagers")], ["none", t("schedule.optHidden")]]} />
        <TogRow label={t("schedule.staffSeeAbsenceLabel")} desc={t("schedule.staffSeeAbsenceDesc")} value={value.staffSeeTeamAbsence} onChange={(v) => set("staffSeeTeamAbsence", v)} />
        <TogRow label={t("schedule.swapShiftsLabel")} desc={t("schedule.swapShiftsDesc")} value={value.swapShifts} onChange={(v) => set("swapShifts", v)} />
        <TogRow label={t("schedule.swapApprovalLabel")} desc={t("schedule.swapApprovalDesc")} value={value.swapApproval} onChange={(v) => set("swapApproval", v)} />
        <TogRow label={t("schedule.offerShiftsLabel")} desc={t("schedule.offerShiftsDesc")} value={value.offerShifts} onChange={(v) => set("offerShifts", v)} />
      </Card>

      <Card className="p-5">
        <SecHead>{t("schedule.secReporting")}</SecHead>
        <NumRow label={t("schedule.onCostLabel")} desc={t("schedule.onCostDesc")} value={value.onCostPct} onChange={(v) => set("onCostPct", v)} suffix="%" step="0.01" />
        <NumRow label={t("schedule.openShiftCostLabel")} desc={t("schedule.openShiftCostDesc")} value={value.openShiftCost} onChange={(v) => set("openShiftCost", v)} suffix="£/hr" />
      </Card>

      <Card className="p-5">
        <SecHead>{t("schedule.secAvailability")}</SecHead>
        <TogRow label={t("schedule.sendRemindersLabel")} desc={t("schedule.sendRemindersDesc")} value={value.availabilityReminders} onChange={(v) => set("availabilityReminders", v)} />
        <TogRow label={t("schedule.autoRequestLabel")} desc={t("schedule.autoRequestDesc")} value={value.autoRequestAvailability} onChange={(v) => set("autoRequestAvailability", v)} />
        <SelRow label={t("schedule.autoRemindLabel")} desc={t("schedule.autoRemindDesc")} value={value.autoRemindUnconfirmed} onChange={(v) => set("autoRemindUnconfirmed", v as SchedulingSettings["autoRemindUnconfirmed"])} opts={[["off", t("schedule.optOffChase")], ["24h", t("schedule.optEvery24h")], ["48h", t("schedule.optEvery48h")]]} />
        <SelRow label={t("schedule.lockAvailLabel")} desc={t("schedule.lockAvailDesc")} value={String(value.availabilityLockHours ?? 24)} onChange={(v) => set("availabilityLockHours", Number(v))} opts={[["0", t("schedule.optWhenDayStarts")], ["2", t("schedule.opt2hBefore")], ["12", t("schedule.opt12hBefore")], ["24", t("schedule.opt24hBefore")], ["48", t("schedule.opt48hBefore")], ["72", t("schedule.opt72hBefore")]]} />
      </Card>

      <Card className="p-5">
        <SecHead>{t("schedule.secNotificationsAutomation")}</SecHead>
        <SelRow label={t("schedule.notifyPublishLabel")} desc={t("schedule.notifyPublishDesc")} value={value.notifyOnPublish} onChange={(v) => set("notifyOnPublish", v as SchedulingSettings["notifyOnPublish"])} opts={[["email_push", t("schedule.optEmailPush")], ["email", t("schedule.optEmailOnly")], ["push", t("schedule.optPushOnly")], ["off", t("schedule.optDontNotify")]]} />
        <SelRow label={t("schedule.shiftReminderLabel")} desc={t("schedule.shiftReminderDesc")} value={value.shiftReminder} onChange={(v) => set("shiftReminder", v as SchedulingSettings["shiftReminder"])} opts={[["off", t("schedule.optOff")], ["24h", t("schedule.opt24hBefore")], ["2h", t("schedule.opt2hBefore")]]} />
        <SelRow label={t("schedule.checkinGraceLabel")} desc={t("schedule.checkinGraceDesc")} value={String(value.checkinGraceMin)} onChange={(v) => set("checkinGraceMin", Number(v) as SchedulingSettings["checkinGraceMin"])} opts={[["10", t("schedule.opt10min")], ["15", t("schedule.opt15min")], ["30", t("schedule.opt30min")]]} />
        <TogRow label={t("schedule.checkinAutoLabel")} desc={t("schedule.checkinAutoDesc")} value={value.checkinAutoAlert} onChange={(v) => set("checkinAutoAlert", v)} />
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
  const t = useT();
  return <RowShell label={label} desc={desc} control={
    <span className="inline-flex items-center gap-2">
      <button type="button" onClick={() => onChange(!value)} role="switch" aria-checked={value} className="relative h-[24px] w-[44px] flex-none rounded-full transition-colors" style={{ background: value ? "#22b365" : "var(--line)" }}><span className="absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white transition-all" style={{ left: value ? "23px" : "3px" }} /></button>
      <span className="w-[26px] text-[11px] font-extrabold" style={{ color: value ? "#0f7a43" : "var(--ink-3)" }}>{value ? t("schedule.on") : t("schedule.off")}</span>
    </span>
  } />;
}
