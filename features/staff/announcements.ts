"use client";

// Shared "staff announcements / notifications" store — the internal notice board
// posted by managers and leads, read by all staff on the site. Distinct from the
// parent-facing newsfeed: this is the STAFF audience of the notifications feature
// (the operator composes it from the Newsfeed → "To staff" tab; leads can post
// from their own Announcements page). Demo/localStorage-backed — server-side
// scoping to the staffer's site/role and push delivery are Amir's.

export interface Announcement {
  id: string;
  author: string;          // who posted (name)
  role: string;            // their role/title label, e.g. "Camp Manager"
  title: string;
  body: string;
  date: string;            // ISO date (yyyy-mm-dd)
  audienceLabel?: string;  // e.g. "All staff · Riverside Club"
  pinned?: boolean;
  important?: boolean;
}

export const ANN_KEY = "aos.staff.announcements.v1";
export const ANN_READ_KEY = "aos.staff.announcements.read.v1";

export const ANN_SEED: Announcement[] = [
  { id: "a1", author: "Head Office", role: "Operations", title: "Summer holiday club — kit & uniform", important: true, pinned: true, date: "2026-08-17", audienceLabel: "All staff", body: "Everyone working the summer camps: please collect your branded polo and lanyard from the office before your first shift. Wear closed-toe shoes and bring a refillable water bottle. Sun cream is provided but please help children reapply at lunch." },
  { id: "a2", author: "Sam Carter", role: "Camp Manager", title: "Fire drill this Thursday", date: "2026-08-16", audienceLabel: "All staff · Riverside Club", body: "We'll run a practice evacuation at around 11am on Thursday. When you hear the alarm, calmly lead your group to the assembly point on the top field, take your register, and do a head count. Please read the Fire Safety course beforehand if you haven't." },
  { id: "a3", author: "Head Office", role: "Safeguarding", title: "Reminder: report concerns the same day", date: "2026-08-12", audienceLabel: "All staff", body: "A quick refresher — if you notice, hear or are told anything that worries you about a child, record it and tell the Designated Safeguarding Lead the same day. If a child is in immediate danger, call 999. Never promise to keep a secret." },
];

const read = <T,>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try { const v = JSON.parse(localStorage.getItem(key) || "null"); return v ?? fallback; } catch { return fallback; }
};
const write = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ } };

const todayISO = () => { const d = new Date(); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

export function loadAnnouncements(): Announcement[] {
  const v = read<Announcement[] | null>(ANN_KEY, null);
  return Array.isArray(v) && v.length ? v : ANN_SEED;
}
export const saveAnnouncements = (list: Announcement[]) => write(ANN_KEY, list);

// Post a new announcement to the top of the board; returns the new list.
export function addAnnouncement(input: { author: string; role: string; title: string; body: string; audienceLabel?: string; pinned?: boolean; important?: boolean }): Announcement[] {
  const list = loadAnnouncements();
  const item: Announcement = { id: `a-${Date.now()}`, date: todayISO(), ...input };
  const next = [item, ...list];
  saveAnnouncements(next);
  return next;
}

export const loadRead = (): string[] => read<string[]>(ANN_READ_KEY, []);
export const saveRead = (ids: string[]) => write(ANN_READ_KEY, ids);
