// Display translations for the growth studio. The API (server/src/routes/growth.ts) returns English sentences with numbers
// baked in; each one is rebuilt here from its id/key + the numbers parsed out of it. Anything that doesn't match the
// expected shape falls back to the server's own text, so a wording change on the server can never blank the screen.
import { dateLocale } from "@/lib/i18n/format";

type T = (key: string, vars?: Record<string, string | number>) => string;

export interface PlayLike { id: string; title: string; signal: string; insight: string; impactLabel: string; actionLabel: string; secondary?: { label: string; view: string } }
export interface AudienceLike { key: string; label: string; blurb: string; advice: string }

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export function weekdayName(english: string): string {
  const i = WEEKDAYS.indexOf(english);
  if (i < 0) return english;
  try { return new Intl.DateTimeFormat(dateLocale(), { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 7 + i))); } catch { return english; }
}

export function playView(t: T, p: PlayLike): { title: string; signal: string; insight: string; impact: string; action: string; secondary?: string } {
  const raw = { title: p.title, signal: p.signal, insight: p.insight, impact: p.impactLabel, action: p.actionLabel, secondary: p.secondary?.label };
  let m: RegExpMatchArray | null;
  switch (p.id) {
    case "fill-empty": {
      m = p.signal.match(/^(\d+) empty \w+ across (\d+) \w+ in the next 30 days$/);
      const a = p.impactLabel.match(/^£([\d,]+) within reach$/);
      return { title: t("p8fin.grFillTitle"), signal: m ? t("p8fin.grFillSignal", { n: m[1], s: m[2] }) : raw.signal, insight: t("p8fin.grFillInsight"), impact: a ? t("p8fin.grImpactReach", { amount: `£${a[1]}` }) : raw.impact, action: t("p8fin.grFillAction"), secondary: raw.secondary ? t("p8fin.grFillSecondary") : undefined };
    }
    case "lapsed": {
      m = p.signal.match(/^(\d+) families booked with you before but not in the last (\d+) months$/);
      const a = p.impactLabel.match(/^£([\d,]+) within reach$/);
      return { title: t("p8fin.grLapsedTitle"), signal: m ? t("p8fin.grLapsedSignal", { n: m[1], m: m[2] }) : raw.signal, insight: t("p8fin.grLapsedInsight"), impact: a ? t("p8fin.grImpactReach", { amount: `£${a[1]}` }) : raw.impact, action: t("p8fin.grLapsedAction"), secondary: raw.secondary ? t("p8fin.grLapsedSecondary") : undefined };
    }
    case "reviews": {
      m = p.signal.match(/^(\d+) bookings have finished .* only (\d+) \w+$/);
      return { title: t("p8fin.grReviewsTitle"), signal: m ? t("p8fin.grReviewsSignal", { a: m[1], r: m[2] }) : raw.signal, insight: t("p8fin.grReviewsInsight"), impact: p.impactLabel === "More enquiries" ? t("p8fin.grReviewsImpact") : raw.impact, action: t("p8fin.grReviewsAction"), secondary: raw.secondary ? t("p8fin.grReviewsSecondary") : undefined };
    }
    case "memberships": {
      m = p.signal.match(/^(\d+) regular families/);
      const a = p.impactLabel.match(/^(\d+) to convert$/);
      return { title: t("p8fin.grMembTitle"), signal: m ? t("p8fin.grMembSignal", { n: m[1] }) : raw.signal, insight: t("p8fin.grMembInsight"), impact: a ? t("p8fin.grMembImpact", { n: a[1] }) : raw.impact, action: t("p8fin.grMembAction"), secondary: raw.secondary ? t("p8fin.grMembSecondary") : undefined };
    }
    case "re-engage": {
      const none = p.signal.match(/^You haven.t posted an update yet — you have (\d+) families to reach$/);
      const days = p.signal.match(/^Your last update was (\d+) days ago — you have (\d+) families to reach$/);
      const a = p.impactLabel.match(/^(\d+) families$/);
      return { title: t("p8fin.grReTitle"), signal: none ? t("p8fin.grReSignalNone", { n: none[1] }) : days ? t("p8fin.grReSignalDays", { d: days[1], n: days[2] }) : raw.signal, insight: t("p8fin.grReInsight"), impact: a ? t("p8fin.grReImpact", { n: a[1] }) : raw.impact, action: t("p8fin.grReAction"), secondary: raw.secondary ? t("p8fin.grReSecondary") : undefined };
    }
    case "midweek": {
      const ti = p.title.match(/^Beat the (\w+) dip$/);
      const sg = p.signal.match(/^(\w+)s run (\d+)% emptier than (\w+)s$/);
      const ac = p.actionLabel.match(/^Email a (\w+) offer$/);
      const im = p.impactLabel.match(/^(\d+)% gap to close$/);
      return {
        title: ti ? t("p8fin.grMidTitle", { day: weekdayName(ti[1]) }) : raw.title,
        signal: sg ? t("p8fin.grMidSignal", { day: weekdayName(sg[1]), gap: sg[2], day2: weekdayName(sg[3]) }) : raw.signal,
        insight: t("p8fin.grMidInsight"),
        impact: im ? t("p8fin.grMidImpact", { gap: im[1] }) : raw.impact,
        action: ac ? t("p8fin.grMidAction", { day: weekdayName(ac[1]) }) : raw.action,
        secondary: raw.secondary ? t("p8fin.grMidSecondary") : undefined,
      };
    }
    default: return raw;
  }
}

const AUD: Record<string, [string, string, string]> = {
  new: ["p8fin.grAudNew", "p8fin.grBlurbNew", "p8fin.grAdvNew"],
  onetime: ["p8fin.grAudOnetime", "p8fin.grBlurbOnetime", "p8fin.grAdvOnetime"],
  loyal: ["p8fin.grAudLoyal", "p8fin.grBlurbLoyal", "p8fin.grAdvLoyal"],
  lapsed: ["p8fin.grAudLapsed", "p8fin.grBlurbLapsed", "p8fin.grAdvLapsed"],
  enquiries: ["p8fin.grAudEnquiries", "p8fin.grBlurbEnquiries", "p8fin.grAdvEnquiries"],
  waitlisted: ["p8fin.grAudWaitlisted", "p8fin.grBlurbWaitlisted", "p8fin.grAdvWaitlisted"],
};
export function audienceView(t: T, a: AudienceLike): { label: string; blurb: string; advice: string } {
  const k = AUD[a.key];
  if (!k) return { label: a.label, blurb: a.blurb, advice: a.advice };
  const n = a.blurb.match(/(\d+)/)?.[1];
  return { label: t(k[0]), blurb: n ? t(k[1], { n }) : t(k[1]), advice: t(k[2]) };
}

const SEG: Record<string, string> = { new: "p8fin.grSegNew", onetime: "p8fin.grSegOnetime", loyal: "p8fin.grSegLoyal", lapsed: "p8fin.grSegLapsed" };
export const segmentLabel = (t: T, key: string, fallback: string) => (SEG[key] ? t(SEG[key]) : fallback);

export function listingAdvice(t: T, health: string, fallback: string): string {
  return health === "quiet" ? t("p8fin.grLstAdvQuiet") : health === "filling" ? t("p8fin.grLstAdvFilling") : health === "full" ? t("p8fin.grLstAdvFull") : fallback;
}
