// Copy of an API answer so one caller can never mutate another's data. structuredClone does not exist before iOS Safari 15.4 / Chrome 98:
// calling it unguarded made every data fetch throw on older iPhones (blank screens), so fall back to a JSON round trip (API data is JSON).
export function cloneJson<T>(v: T): T {
  if (v === null || typeof v !== "object") return v;
  if (typeof structuredClone === "function") {
    try { return structuredClone(v); } catch { /* fall through to JSON */ }
  }
  return JSON.parse(JSON.stringify(v)) as T;
}
