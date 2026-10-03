import { addDays, ukToday } from "./ukDate";

// Pure: when a public invoice pay link closes (extracted from routes/invoices.ts, behaviour unchanged).
const LINK_DAYS = 90;
export function linkExpiresOn(inv: Record<string, unknown>, today: string = ukToday()): string {
  const day = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : "");
  const base = [inv.dueDate, inv.date, inv.emailedAt, inv.paidAt, inv.createdAt].map(day).filter(Boolean).sort().pop() ?? today;
  return addDays(base, LINK_DAYS); // calendar days — adding raw ms shifts the day across the 25 Oct clock change
}
export const linkExpired = (inv: Record<string, unknown>, today: string = ukToday()) => today > linkExpiresOn(inv, today);
