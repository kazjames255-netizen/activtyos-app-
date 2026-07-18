// ─────────────────────────────────────────────────────────────────────────
// Dates, times and ids — the small pure helpers the listing builder, the
// customer page and the checkout all reach for. No React, no API, no state:
// anything here can be called from anywhere without dragging the rest of the
// listings feature in behind it.
// ─────────────────────────────────────────────────────────────────────────

export const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
export function to12h(t: string): string {
  const [hStr, m] = (t || "").split(":");
  let h = parseInt(hStr, 10);
  if (Number.isNaN(h)) return t;
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m ?? "00"} ${ap}`;
}
export const pMins = (t: string) => { const [h, m] = (t || "").split(":").map(Number); return (h || 0) * 60 + (m || 0); };
export const pHours = (p: { start: string; finish: string }) => { const d = (pMins(p.finish) - pMins(p.start)) / 60; return d > 0 ? d : 1; };
export const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
export function genDates(from: string, to: string, days: number[]): string[] {
  if (!from || !to) return [];
  const d = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if (isNaN(d.getTime()) || isNaN(end.getTime())) return [];
  const out: string[] = [];
  let guard = 0;
  while (d <= end && guard++ < 400) {
    if (days.includes(d.getUTCDay())) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}
export const ordinal = (n: number) => {
  const rest = n % 100;
  const suffix = rest >= 11 && rest <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${suffix}`;
};
export const fmtDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" });
export function mondayOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}
export function groupWeeks(dates: string[]): { n: number; mon: string; days: string[] }[] {
  const map = new Map<string, string[]>();
  for (const iso of dates) {
    const k = mondayOf(iso);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(iso);
  }
  return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([mon, days], i) => ({ n: i + 1, mon, days }));
}
