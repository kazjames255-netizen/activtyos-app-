// Which topic videos this browser has watched to the end (a tick in the chooser). Per-browser only; never leaves the device.
const key = (role: string) => `aos.hiw.done.${role}`;
export function getDone(role: string): string[] {
  try { const v = JSON.parse(localStorage.getItem(key(role)) ?? "[]"); return Array.isArray(v) ? v.filter((x) => typeof x === "string") : []; } catch { return []; }
}
export function markDone(role: string, topic: string): void {
  try { const d = getDone(role); if (!d.includes(topic)) localStorage.setItem(key(role), JSON.stringify([...d, topic])); } catch { /* storage blocked: no tick */ }
}
