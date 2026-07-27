import { db } from "../firebase";
import { fireOnce, sweep, toMinutes, ukNow } from "./scheduler";
import { notify, parentEmailForChild } from "./notify";
import { expireOffers } from "./waitlist";

// ─────────────────────────────────────────────────────────────────────────
// Every time-based behaviour in the platform, as scheduler sweeps (see
// lib/scheduler.ts for the multi-instance safety story):
//
//   · calendar reminders  — N minutes before an event starts, bell+email the
//     team (Setup → Calendar; per-event override remindMode/remindMinutes).
//   · medication due     — a med whose schedule carries "· at HH:MM" rings
//     the staff bell at that time on a day the child is actually booked.
//   · acknowledgement chase — while Setup → Safeguarding requires it, an
//     unacknowledged accident re-nudges the family daily (capped).
//   · waitlist expiry    — the former index.ts setInterval, now single-run.
//
// All wall-clock decisions are UK time (ukNow) — the times operators type in
// are UK local whatever region the server runs in.
// ─────────────────────────────────────────────────────────────────────────

type Settings = Record<string, Record<string, unknown> | undefined>;

/** One tenant's Setup settings, cached per sweep run (each sweep constructs
 *  its own cache — a sweep is short-lived, staleness isn't a concern). */
function settingsLoader() {
  const cache = new Map<string, Settings>();
  return async (tenantId: string): Promise<Settings> => {
    const hit = cache.get(tenantId);
    if (hit) return hit;
    const lib = await db.collection("libraries").doc(tenantId).get();
    const s = ((lib.data()?.settings ?? {}) as Settings) || {};
    cache.set(tenantId, s);
    return s;
  };
}

// ── Calendar reminders ────────────────────────────────────────────────────
// Scan today's manual events; fire once per event when the reminder window
// opens and the event hasn't started yet. A moved event is simply seen at its
// new time on the next scan; a reminder already sent stays sent.
async function calendarReminders(): Promise<void> {
  const { date, minutes: now } = ukNow();
  const snap = await db.collection("calendarEvents").where("date", "==", date).get();
  if (snap.empty) return;
  const settingsFor = settingsLoader();

  for (const d of snap.docs) {
    const e = d.data() as {
      tenantId?: string; title?: string; start?: string; allDay?: boolean;
      category?: string; remindMode?: "default" | "on" | "off"; remindMinutes?: number;
    };
    if (!e.tenantId || e.allDay) continue;
    const start = toMinutes(e.start);
    if (start === null) continue;

    const cal = (await settingsFor(e.tenantId)).calendar ?? {};
    const mode = e.remindMode ?? "default";
    if (mode === "off") continue;
    if (mode === "default" && cal.reminderOn === false) continue;
    const lead = mode === "on"
      ? (e.remindMinutes ?? Number(cal.reminderMinutes ?? 30))
      : Number(cal.reminderMinutes ?? 30);

    // Fire from the reminder point up to the start — late (server was down)
    // still beats silent, but a reminder after the event began is noise.
    if (now < start - lead || now >= start) continue;

    await fireOnce(`cal_${d.id}_${date}`, { tenantId: e.tenantId }, () =>
      notify({
        tenantId: e.tenantId!,
        to: { kind: "tenant" },
        category: "calendar",
        title: `Coming up at ${e.start}: ${e.title ?? "Calendar event"}`,
        body: e.category ? `${e.category} — starts at ${e.start}.` : `Starts at ${e.start}.`,
        href: "/company/calendar",
      }),
    ).catch((err) => console.error(`[sweeps] calendar reminder ${d.id}:`, (err as Error).message));
  }
}

// ── Medication due-times ──────────────────────────────────────────────────
// The med forms append "· at HH:MM" to the schedule text. On a day the child
// is actually booked in, ring the staff bell at that time. Child-to-booking
// is a per-tenant scan (same trade-off medications.ts documents).
const AT_TIME = /·\s*at\s*(\d{1,2}:\d{2})/;

async function medicationDue(): Promise<void> {
  const { date, minutes: now } = ukNow();
  const snap = await db.collection("medications").where("archived", "==", false).get();
  if (snap.empty) return;
  const settingsFor = settingsLoader();
  const bookedCache = new Map<string, Set<string>>(); // tenantId → childIds booked today

  const bookedToday = async (tenantId: string): Promise<Set<string>> => {
    const hit = bookedCache.get(tenantId);
    if (hit) return hit;
    const bs = await db.collection("bookings").where("tenantId", "==", tenantId).get();
    const ids = new Set<string>();
    for (const b of bs.docs) {
      const doc = b.data() as { status?: string; childId?: string; days?: string[]; kids?: { childId?: string }[] };
      if (doc.status === "Cancelled" || doc.status === "Declined") continue;
      if (doc.days && !doc.days.includes(date)) continue; // no days = every session
      if (doc.childId) ids.add(doc.childId);
      for (const k of doc.kids ?? []) if (k.childId) ids.add(k.childId);
    }
    bookedCache.set(tenantId, ids);
    return ids;
  };

  for (const d of snap.docs) {
    const m = d.data() as { tenantId?: string; name?: string; childName?: string; childId?: string; schedule?: string };
    if (!m.tenantId) continue;
    const at = AT_TIME.exec(m.schedule ?? "");
    const due = at ? toMinutes(at[1]) : null;
    if (due === null) continue;
    // A tight window: a dose reminder hours late is worse than none.
    if (now < due || now >= due + 15) continue;

    const med = (await settingsFor(m.tenantId)).medication ?? {};
    if (med.remindWhenDue === false) continue;
    // Only when the child is actually in today (unlinked meds can't be
    // checked, so they always remind — better than a missed dose).
    if (m.childId && !(await bookedToday(m.tenantId)).has(m.childId)) continue;

    await fireOnce(`med_${d.id}_${date}`, { tenantId: m.tenantId }, () =>
      notify({
        tenantId: m.tenantId!,
        to: { kind: "tenant" },
        category: "medication",
        title: `Medication due: ${m.name ?? "medicine"} for ${m.childName ?? "a child"}`,
        body: `Scheduled for ${at![1]} today. Log the dose once given.`,
        href: "/company/medication",
      }),
    ).catch((err) => console.error(`[sweeps] medication due ${d.id}:`, (err as Error).message));
  }
}

// ── Acknowledgement chase ─────────────────────────────────────────────────
// Setup → Safeguarding "requireAcknowledgement": while an accident stays
// unacknowledged, re-nudge the family once a day (skipping the day it was
// logged — the logging notification covers that), for at most a week. The
// bell entry always lands; a "accident"-muted family just isn't emailed.
const CHASE_DAYS = 7;

async function acknowledgementChase(): Promise<void> {
  const { date } = ukNow();
  const snap = await db.collection("incidents").get();
  if (snap.empty) return;
  const settingsFor = settingsLoader();

  for (const d of snap.docs) {
    const inc = d.data() as {
      tenantId?: string; kind?: string; childName?: string; childId?: string;
      acknowledgedAt?: string; createdAt?: string; date?: string;
    };
    if (!inc.tenantId || inc.acknowledgedAt || !inc.childId) continue;
    const sg = (await settingsFor(inc.tenantId)).safeguarding ?? {};
    if (sg.requireAcknowledgement !== true) continue;

    const loggedDay = (inc.createdAt ?? "").slice(0, 10) || inc.date || "";
    if (!loggedDay || loggedDay >= date) continue; // logged today → already notified
    const ageDays = Math.floor((Date.parse(date) - Date.parse(loggedDay)) / 86_400_000);
    if (ageDays > CHASE_DAYS) continue;

    const email = await parentEmailForChild(inc.childId);
    if (!email) continue;
    const word = inc.kind === "accident" ? "accident" : "incident";

    await fireOnce(`ackchase_${d.id}_${date}`, { tenantId: inc.tenantId }, () =>
      notify({
        tenantId: inc.tenantId!,
        to: { kind: "parent", email },
        category: inc.kind === "accident" ? "accident" : "incident",
        title: `Please confirm you've seen ${inc.childName ?? "your child"}'s ${word} record`,
        body: `The record from ${loggedDay} is waiting for your confirmation — it takes one tap.`,
        subject: `Reminder: ${inc.childName ?? "your child"}'s ${word} record needs your confirmation`,
        href: "/custdash/accidents",
        ref: d.id,
      }),
    ).catch((err) => console.error(`[sweeps] ack chase ${d.id}:`, (err as Error).message));
  }
}

/** Called once from index.ts at startup. Safe on every instance. */
export function startSweeps(): void {
  sweep("calendar-reminders", 60_000, calendarReminders);
  sweep("medication-due", 60_000, medicationDue);
  sweep("ack-chase", 30 * 60_000, acknowledgementChase);
  // The waitlist expiry that used to be a bare setInterval in index.ts —
  // unchanged behaviour, but now exactly one instance runs it per interval.
  sweep("waitlist-expiry", 5 * 60_000, expireOffers);
}
