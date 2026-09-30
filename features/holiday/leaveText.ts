// Display-only translations of the statutory / pay-treatment wording that lib/holiday.ts builds in English
// (PAY_TREATMENT, sickPayNote, sickNotifyRuleText, familyLeaveNote). The figures still come from lib/holiday.ts;
// only the sentences are looked up in the p8wf catalogue so the operator planner reads in the active language.
import { pickPlural } from "@/lib/i18n/plural";
import { dateLocale } from "@/lib/i18n/format";
import { FAMILY_LEL, SSP_WEEKLY, STATUTORY_FAMILY_RATE, type AbsenceKind, type HolidayPolicy, type PayTreatment } from "@/lib/holiday";

type T = (key: string, vars?: Record<string, string | number>) => string;

const PAY_LABEL: Record<PayTreatment, string> = { normal: "hlPtNormal", ssp: "hlPtSsp", statutory: "hlPtStat", unpaid: "hlPtUnpaid", toil: "hlPtToil" };
const PAY_NOTE: Record<PayTreatment, string> = { normal: "hlPnNormal", ssp: "hlPnSsp", statutory: "hlPnStat", unpaid: "hlPnUnpaid", toil: "hlPnToil" };

export const payLabel = (t: T, p: PayTreatment) => t("p8wf." + PAY_LABEL[p]);
export const payNote = (t: T, p: PayTreatment) => t("p8wf." + PAY_NOTE[p], { rate: STATUTORY_FAMILY_RATE.toFixed(2) });

const FAMILY_KEY: Partial<Record<AbsenceKind, string>> = { maternity: "hlFamMaternity", adoption: "hlFamAdoption", parental: "hlFamParental", bereavement: "hlFamBereavement" };
export const familyNote = (t: T, kind: AbsenceKind): string => { const k = FAMILY_KEY[kind]; return k ? t("p8wf." + k, { rate: STATUTORY_FAMILY_RATE.toFixed(2), lel: FAMILY_LEL }) : ""; };

export function sickPayNote(t: T, locale: string, policy: Pick<HolidayPolicy, "sickPay" | "enhancedDays">): string {
  const ssp = t("p8wf.hlSickNoteSsp", { cap: SSP_WEEKLY.toFixed(2) });
  return policy.sickPay === "enhanced" ? pickPlural(t, locale, "p8wf.hlSickNoteEnh", policy.enhancedDays, { ssp }) : t("p8wf.hlSickNoteOnly", { ssp });
}

export function sickRuleText(t: T, locale: string, p: Pick<HolidayPolicy, "sickNotifyMode" | "sickNotifyHours" | "sickNotifyTime">): string {
  if (p.sickNotifyMode === "time") {
    const [h, m] = (p.sickNotifyTime || "09:00").split(":").map(Number);
    return t("p8wf.hlRuleTime", { time: new Date(2000, 0, 1, h || 0, m || 0).toLocaleTimeString(dateLocale(), { hour: "numeric", minute: "2-digit" }) });
  }
  return pickPlural(t, locale, "p8wf.hlRuleHours", p.sickNotifyHours);
}
