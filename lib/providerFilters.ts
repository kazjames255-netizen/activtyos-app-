// Pure helpers for the HQ "Providers & billing" list: status tabs, test-account matcher, tile maths, sort.
// No React, no network: everything works over the rows the API already returns (tenant subscription + the /subscriptions rows).

export type StatusTab = "all" | "trial" | "endingSoon" | "trialEnded" | "active" | "pastDue" | "cancelled" | "noCard";
export const STATUS_TABS: StatusTab[] = ["all", "trial", "endingSoon", "trialEnded", "active", "pastDue", "cancelled", "noCard"];
export const ENDING_SOON_DAYS = 7;

export interface ProviderLike {
  id: string;
  name: string;
  ownerEmail?: string | null;
  contactEmail?: string | null;
  createdAt?: string | null;
  status: string; // trialing | active | canceling | canceled | past_due | none
  trialEndsAt?: string | null;
  hasCard: boolean;
  price?: number | null;
}

const ukDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }); // raw-locale-ok: machine date key
const dayNumber = (d: Date) => { const [y, m, dd] = ukDay.format(d).split("-").map(Number); return Date.UTC(y, m - 1, dd) / 86_400_000; };

/** Whole UK calendar days from `now` to the trial end (0 = ends today). null when there is no usable trial end date. */
export function trialDaysLeft(trialEndsAt: string | null | undefined, now: Date): number | null {
  if (!trialEndsAt) return null;
  const end = new Date(trialEndsAt);
  if (Number.isNaN(end.getTime())) return null;
  return dayNumber(end) - dayNumber(now);
}

/** A trial that has not yet run out (the end moment is still ahead of `now`). A trial with no end date counts as running. */
export function isOnTrial(p: Pick<ProviderLike, "status" | "trialEndsAt">, now: Date): boolean {
  if (p.status !== "trialing") return false;
  if (!p.trialEndsAt) return true;
  const end = new Date(p.trialEndsAt);
  return Number.isNaN(end.getTime()) || end.getTime() >= now.getTime();
}

/** Every tab this provider belongs to (tabs overlap: a trial with no card is in "trial" and "noCard"). */
export function classify(p: ProviderLike, now: Date): Set<StatusTab> {
  const s = new Set<StatusTab>(["all"]);
  const onTrial = isOnTrial(p, now);
  if (onTrial) {
    s.add("trial");
    const d = trialDaysLeft(p.trialEndsAt, now);
    if (d != null && d <= ENDING_SOON_DAYS) s.add("endingSoon");
  }
  if (p.status === "trialing" && !onTrial) s.add("trialEnded");
  if (p.status === "active") s.add("active");
  if (p.status === "past_due") s.add("pastDue");
  if (p.status === "canceled" || p.status === "canceling") s.add("cancelled");
  if (p.status === "trialing" && !p.hasCard) s.add("noCard");
  return s;
}

const TEST_EMAIL_SUFFIX = "@activityos-test.com";
/** Throwaway accounts: login/contact email on the test domain, or a business name starting "QA ". */
export function isTestAccount(p: Pick<ProviderLike, "name" | "ownerEmail" | "contactEmail">): boolean {
  const mails = [p.ownerEmail, p.contactEmail].map((e) => (e ?? "").trim().toLowerCase());
  return mails.some((e) => e.endsWith(TEST_EMAIL_SUFFIX)) || (p.name ?? "").startsWith("QA ");
}

export function matchesSearch(p: Pick<ProviderLike, "id" | "name" | "ownerEmail" | "contactEmail">, q: string): boolean {
  const n = q.trim().toLowerCase();
  if (!n) return true;
  return [p.name, p.ownerEmail, p.contactEmail, p.id].some((v) => (v ?? "").toLowerCase().includes(n));
}

export interface Tiles { total: number; mrr: number; trialing: number; active: number }
/** The four top tiles over a set of providers. Same rule as the server summary: MRR adds the price of active, trialing and cancelling accounts. */
export function tiles(rows: Pick<ProviderLike, "status" | "price">[]): Tiles {
  return {
    total: rows.length,
    mrr: rows.filter((r) => ["active", "trialing", "canceling"].includes(r.status)).reduce((s, r) => s + (r.price ?? 0), 0),
    trialing: rows.filter((r) => r.status === "trialing").length,
    active: rows.filter((r) => r.status === "active").length,
  };
}

export type SortKey = "newest" | "trialEnding" | "name" | "value";
export const SORT_KEYS: SortKey[] = ["newest", "trialEnding", "name", "value"];
export function sortProviders<T extends ProviderLike>(rows: T[], key: SortKey, now: Date): T[] {
  const a = [...rows];
  const byName = (x: T, y: T) => x.name.localeCompare(y.name, "en", { sensitivity: "base" });
  if (key === "name") return a.sort(byName);
  if (key === "value") return a.sort((x, y) => (y.price ?? 0) - (x.price ?? 0) || byName(x, y));
  if (key === "trialEnding") {
    // Running trials soonest first, then everything else (newest first).
    const t = (x: T) => (isOnTrial(x, now) && x.trialEndsAt ? new Date(x.trialEndsAt).getTime() : Infinity);
    return a.sort((x, y) => (t(x) === t(y) ? (y.createdAt ?? "").localeCompare(x.createdAt ?? "") : t(x) - t(y)));
  }
  return a.sort((x, y) => (y.createdAt ?? "").localeCompare(x.createdAt ?? ""));
}
