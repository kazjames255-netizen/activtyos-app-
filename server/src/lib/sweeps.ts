import { db } from "../firebase";
import { fireOnce, sweep, toMinutes, ukNow } from "./scheduler";
import { notify, parentEmailForChild } from "./notify";
import { expireOffers } from "./waitlist";
import { stripe } from "./stripe";
import { syncFromStripe, updateMeteredQuantities } from "./billing";
import { clearSubscriptionCache } from "../middleware/subscription";
import { AUTO_EMAIL_DEFAULTS, type AutoEmailPrefs } from "./autoEmails";
import { performEmailSend } from "./emailSend";

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
        key: "calendar-reminder",
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
    // Ring 5 minutes BEFORE the dose is due (a heads-up), and keep firing for a
    // short window after in case the sweep ran late — a reminder hours late is
    // worse than none.
    if (now < due - 5 || now >= due + 15) continue;

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
        key: "med-due",
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

// ── Safeguarding action reviews ───────────────────────────────────────────
// A DSL action can carry a review/complete-by date. On/after that day, while
// it isn't marked done, bell + email the team once a day so nothing is missed.
async function safeguardingReviews(): Promise<void> {
  const { date } = ukNow();
  const snap = await db.collection("incidents").where("kind", "==", "safeguarding").get();
  if (snap.empty) return;
  for (const d of snap.docs) {
    const inc = d.data() as { tenantId?: string; childName?: string; subject?: string; dslLog?: { id: string; label: string; reviewDate?: string; done?: boolean }[] };
    if (!inc.tenantId || !Array.isArray(inc.dslLog)) continue;
    const due = inc.dslLog.filter((e) => e.reviewDate && !e.done && e.reviewDate <= date);
    for (const e of due) {
      const who = inc.subject === "staff" ? "a member of staff" : (inc.childName ?? "a child");
      await fireOnce(`sgreview_${d.id}_${e.id}_${date}`, { tenantId: inc.tenantId }, () =>
        notify({
          tenantId: inc.tenantId!,
          to: { kind: "tenant" },
          category: "incident",
          key: "safeguarding-due",
          title: `🛡️ Safeguarding action due: ${e.label}`,
          body: `Review "${e.label}" for the concern about ${who} — due ${e.reviewDate}. Mark it done in Log concern → Safeguarding.`,
          subject: `Safeguarding action due — ${e.label}`,
          href: "/company/incidents",
          ref: d.id,
        }),
      ).catch((err) => console.error(`[sweeps] sg review ${d.id}/${e.id}:`, (err as Error).message));
    }
  }
}

// ── Trip consent chase ────────────────────────────────────────────────────
// "Remind until they respond": while a planned trip is still ahead and a
// child's consent is pending, re-nudge that family once a day (skipping the
// day the original request went out). Naturally bounded by the trip date.
async function tripConsentChase(): Promise<void> {
  const { date } = ukNow();
  const snap = await db.collection("trips").where("status", "==", "planned").get();
  if (snap.empty) return;
  const settingsFor = settingsLoader();

  for (const d of snap.docs) {
    const t = d.data() as {
      tenantId?: string; destination?: string; date?: string; askConsent?: boolean;
      attendees?: { n: string; childId?: string; consent?: string; consentRequestedAt?: string }[];
    };
    if (!t.tenantId || t.askConsent === false || !t.date || t.date < date) continue;
    const trips = (await settingsFor(t.tenantId)).trips ?? {};
    if (trips.notifyParent === false) continue;

    for (const a of t.attendees ?? []) {
      if (!a.childId || (a.consent ?? "pending") !== "pending") continue;
      if (!a.consentRequestedAt || a.consentRequestedAt.slice(0, 10) >= date) continue; // first ask covers today
      const email = await parentEmailForChild(a.childId);
      if (!email) continue;
      await fireOnce(`tripconsent_${d.id}_${a.childId}_${date}`, { tenantId: t.tenantId }, () =>
        notify({
          tenantId: t.tenantId!,
          to: { kind: "parent", email },
          category: "trip",
          title: `Still needed: consent for ${a.n} — trip to ${t.destination}`,
          body: `The trip on ${t.date} is coming up and ${a.n}'s consent is still pending. Give or decline it in your Trips area — one tap.`,
          subject: `Reminder: ${a.n}'s trip consent is still needed`,
          href: "/custdash/trips",
          ref: d.id,
        }),
      ).catch((err) => console.error(`[sweeps] trip consent chase ${d.id}:`, (err as Error).message));
    }
  }
}

// ── Automatic emails (Setup → Email → Automatic emails) ──────────────────
// The sender behind settings.autoEmails: session reminders, payment-due
// reminders, review requests, and the day-of register alerts. Every one
// checks the tenant's flag first and delivers exactly once via fireOnce.

const addDaysIso = (iso: string, n: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** UK wall-clock instants compared on one axis: dates parse as UTC midnight
 *  on both sides, so the timezone offset cancels out of every comparison. */
const atAbs = (date: string, minutes: number): number => Date.parse(`${date}T00:00:00Z`) + minutes * 60_000;

const niceDate = (iso: string): string =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

const gbp = (n: number) => `£${(Math.round(n * 100) / 100).toFixed(2)}`;

/** The whole libraries doc per tenant (settings + venues), cached per run. */
function libraryLoader() {
  const cache = new Map<string, Record<string, unknown>>();
  return async (tenantId: string): Promise<Record<string, unknown>> => {
    const hit = cache.get(tenantId);
    if (hit) return hit;
    const doc = await db.collection("libraries").doc(tenantId).get();
    const data = (doc.data() ?? {}) as Record<string, unknown>;
    cache.set(tenantId, data);
    return data;
  };
}

const autoEmailsOf = (lib: Record<string, unknown>): AutoEmailPrefs => ({
  ...AUTO_EMAIL_DEFAULTS,
  ...(((lib.settings as Record<string, unknown> | undefined)?.autoEmails ?? {}) as Partial<AutoEmailPrefs>),
});

interface SweepBlock {
  id: string;
  tenantId: string;
  listingId?: string;
  name?: string;
  sessions?: { date: string; start: string; end: string }[];
}

/** Blocks that still have sessions today or later (endDate keeps the query
 *  cheap; callers filter to the dates they care about). */
async function upcomingBlocks(today: string): Promise<SweepBlock[]> {
  const snap = await db.collection("blocks").where("endDate", ">=", today).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<SweepBlock, "id">) }))
    .filter((b) => b.tenantId);
}

type SweepBooking = {
  ref: string; status?: string; email?: string; booker?: string; child?: string;
  kids?: { name?: string }[]; days?: string[]; pay?: string; amount?: number; listing?: string;
};

/** Bookings per block, cached per run. */
function blockBookingsLoader() {
  const cache = new Map<string, SweepBooking[]>();
  return async (blockId: string): Promise<SweepBooking[]> => {
    const hit = cache.get(blockId);
    if (hit) return hit;
    const snap = await db.collection("bookings").where("blockId", "==", blockId).get();
    const list = snap.docs.map((d) => d.data() as SweepBooking);
    cache.set(blockId, list);
    return list;
  };
}

/** Is this booking in on this date? (No days field = every session.) */
const bookedOn = (b: SweepBooking, date: string): boolean => !b.days || b.days.includes(date);

const kidNames = (b: SweepBooking): string =>
  b.kids?.length ? b.kids.map((k) => k.name).filter(Boolean).join(", ") : (b.child ?? "Your child");

// ── Session reminders ─────────────────────────────────────────────────────
// sessionTiming hours before each booked session: child, date, times, venue,
// what to bring, and the outstanding balance (never re-quoted once paid).
async function sessionReminders(): Promise<void> {
  const { date: today, minutes } = ukNow();
  const nowAbs = atAbs(today, minutes);
  const horizon = addDaysIso(today, 3); // timings top out at 72h
  const blocks = await upcomingBlocks(today);
  if (!blocks.length) return;
  const libFor = libraryLoader();
  const bookingsFor = blockBookingsLoader();
  const listingCache = new Map<string, Record<string, unknown> | null>();

  for (const block of blocks) {
    const due = (block.sessions ?? []).filter((s) => {
      if (s.date < today || s.date > horizon) return false;
      const start = toMinutes(s.start);
      return start !== null;
    });
    if (!due.length) continue;
    const lib = await libFor(block.tenantId);
    const prefs = autoEmailsOf(lib);
    if (!prefs.sessionReminder) continue;
    const leadMs = (Number(prefs.sessionTiming) || 48) * 3_600_000;

    for (const s of due) {
      const startAbs = atAbs(s.date, toMinutes(s.start)!);
      // From the reminder point up to the start — late beats silent, but a
      // reminder after the session began is noise.
      if (nowAbs < startAbs - leadMs || nowAbs >= startAbs) continue;

      let listing = listingCache.get(block.listingId ?? "");
      if (listing === undefined) {
        const snap = block.listingId ? await db.collection("listings").doc(block.listingId).get() : null;
        listing = snap?.exists ? (snap.data() as Record<string, unknown>) : null;
        listingCache.set(block.listingId ?? "", listing);
      }
      const blockListingName = listing?.title ?? listing?.name;
      const venues = (lib.venues ?? []) as { id: string; name: string }[];
      const venue = venues.find((v) => v.id === listing?.venueId)?.name;
      const bring = typeof listing?.whatToBring === "string" ? listing.whatToBring.trim() : "";

      for (const b of await bookingsFor(block.id)) {
        if (b.status !== "Confirmed" || !b.email?.includes("@") || !bookedOn(b, s.date)) continue;
        const owes = b.pay !== "Paid" && (b.amount ?? 0) > 0;
        // The booking snapshots the listing name — the best fallback when the
        // block doesn't link to a live listing doc.
        const listingName = String(blockListingName ?? b.listing ?? "your activity");
        await fireOnce(`sessrem_${block.tenantId}_${b.ref}_${s.date}`, { tenantId: block.tenantId }, () =>
          notify({
            tenantId: block.tenantId,
            to: { kind: "parent", email: b.email! },
            category: "booking",
            title: `Reminder: ${listingName} — ${niceDate(s.date)}, ${s.start}`,
            body: `${kidNames(b)} is booked in ${s.start}–${s.end}${venue ? ` at ${venue}` : ""}.`,
            subject: `Reminder: ${listingName} on ${niceDate(s.date)}`,
            emailHtml:
              `<p><b>${kidNames(b)}</b> is booked in for <b>${listingName}</b> on <b>${niceDate(s.date)}</b>, ` +
              `<b>${s.start}–${s.end}</b>${venue ? ` at <b>${venue}</b>` : ""}.</p>` +
              (bring ? `<p><b>What to bring:</b> ${bring}</p>` : "") +
              (owes ? `<p><b>Outstanding balance:</b> ${gbp(b.amount!)} — you can pay from My bookings.</p>` : ""),
            href: "/custdash/bookings",
            ref: b.ref,
          }),
        ).catch((err) => console.error(`[sweeps] session reminder ${b.ref}/${s.date}:`, (err as Error).message));
      }
    }
  }
}

// ── Payment-due reminders ─────────────────────────────────────────────────
// paymentDueTiming hours before a balance's due date: unpaid invoices (with
// their pay link) and voucher bookings approaching their send-by date.
async function paymentDueReminders(): Promise<void> {
  const { date: today, minutes } = ukNow();
  const nowAbs = atAbs(today, minutes);
  const horizon = addDaysIso(today, 4);
  const libFor = libraryLoader();
  const wants = async (tenantId: string) => {
    const prefs = autoEmailsOf(await libFor(tenantId));
    return prefs.paymentDue ? (Number(prefs.paymentDueTiming) || 24) * 3_600_000 : null;
  };
  // "Due by the 14th" reads as before that day starts — the window opens
  // paymentDueTiming hours before midnight and closes when the day arrives.
  const inWindow = (dueDate: string, leadMs: number) => {
    const dueAbs = atAbs(dueDate, 0);
    return nowAbs >= dueAbs - leadMs && nowAbs < dueAbs;
  };

  const invoices = await db.collection("invoices")
    .where("dueDate", ">=", today).where("dueDate", "<=", horizon).get();
  for (const d of invoices.docs) {
    const inv = d.data() as {
      tenantId?: string; status?: string; dueDate?: string; amount?: number;
      customerEmail?: string; customerName?: string; payToken?: string;
    };
    if (!inv.tenantId || inv.status !== "sent" || !inv.dueDate || !inv.customerEmail?.includes("@")) continue;
    const leadMs = await wants(inv.tenantId);
    if (leadMs === null || !inWindow(inv.dueDate, leadMs)) continue;
    await fireOnce(`paydue_${d.id}_${inv.dueDate}`, { tenantId: inv.tenantId }, () =>
      notify({
        tenantId: inv.tenantId!,
        to: { kind: "parent", email: inv.customerEmail! },
        category: "billing",
        title: `Payment due ${niceDate(inv.dueDate!)}: ${gbp(inv.amount ?? 0)}`,
        body: `Your invoice for ${gbp(inv.amount ?? 0)} is due on ${niceDate(inv.dueDate!)}.`,
        subject: `Reminder: payment of ${gbp(inv.amount ?? 0)} due ${niceDate(inv.dueDate!)}`,
        emailHtml:
          `<p>A friendly reminder that your invoice for <b>${gbp(inv.amount ?? 0)}</b> is due on ` +
          `<b>${niceDate(inv.dueDate!)}</b>.${inv.payToken ? " You can pay it securely online:" : ""}</p>`,
        ...(inv.payToken ? { href: `/pay/${inv.payToken}` } : {}),
        ref: d.id,
      }),
    ).catch((err) => console.error(`[sweeps] payment due ${d.id}:`, (err as Error).message));
  }

  const vouchers = await db.collection("bookings").where("pay", "==", "Awaiting voucher payment").get();
  for (const d of vouchers.docs) {
    const b = d.data() as SweepBooking & { tenantId?: string; voucherScheme?: string; voucherSendBy?: string; listing?: string };
    if (!b.tenantId || !b.email?.includes("@")) continue;
    if (!b.voucherSendBy || b.voucherSendBy < today || b.voucherSendBy > horizon) continue;
    if (b.status === "Cancelled" || b.status === "Declined") continue;
    const leadMs = await wants(b.tenantId);
    if (leadMs === null || !inWindow(b.voucherSendBy, leadMs)) continue;
    const scheme = b.voucherScheme ?? "childcare voucher";
    await fireOnce(`vouchdue_${b.tenantId}_${b.ref}_${b.voucherSendBy}`, { tenantId: b.tenantId }, () =>
      notify({
        tenantId: b.tenantId!,
        to: { kind: "parent", email: b.email! },
        category: "billing",
        title: `Reminder: send your ${scheme} payment by ${niceDate(b.voucherSendBy!)}`,
        body: `${gbp(b.amount ?? 0)} for ${b.listing ?? "your booking"} (${b.ref}) is still to come through ${scheme}.`,
        subject: `Reminder: ${scheme} payment due by ${niceDate(b.voucherSendBy!)}`,
        href: "/custdash/bookings",
        ref: b.ref,
      }),
    ).catch((err) => console.error(`[sweeps] voucher due ${b.ref}:`, (err as Error).message));
  }
}

// ── Review requests ───────────────────────────────────────────────────────
// Once, the day after a family's LAST booked session with the provider — a
// later booking simply moves that day and may earn another ask months on.
async function reviewRequests(): Promise<void> {
  const { date: today } = ukNow();
  const snap = await db.collection("bookings").get();
  if (snap.empty) return;
  const libFor = libraryLoader();

  // tenant__email → the latest booked day (with its activity + child) across
  // every active booking, so the prompt can name what they did.
  const lastDay = new Map<string, { tenantId: string; email: string; last: string; listing?: string; child?: string }>();
  for (const d of snap.docs) {
    const b = d.data() as SweepBooking & { tenantId?: string; listing?: string };
    if (!b.tenantId || !b.email?.includes("@") || b.status !== "Confirmed" || !b.days?.length) continue;
    const key = `${b.tenantId}__${b.email.toLowerCase()}`;
    const max = [...b.days].sort().pop()!;
    const hit = lastDay.get(key);
    if (!hit || max > hit.last) lastDay.set(key, { tenantId: b.tenantId, email: b.email.toLowerCase(), last: max, listing: b.listing, child: kidNames(b) });
  }

  for (const { tenantId, email, last, listing, child } of lastDay.values()) {
    if (last >= today) continue; // still booked in — not their last session yet
    const age = Math.floor((Date.parse(today) - Date.parse(last)) / 86_400_000);
    if (age < 1 || age > 2) continue; // the day after (with one day's grace)
    if (!autoEmailsOf(await libFor(tenantId)).reviewRequests) continue;
    const what = listing ? `${child ? `${child}'s ` : "your "}last session — ${listing}` : "your last booked session with us";
    const href = `/custdash/feedback?p=${tenantId}${listing ? `&listing=${encodeURIComponent(listing)}` : ""}`;
    await fireOnce(`review_${tenantId}_${email}_${last}`, { tenantId }, () =>
      notify({
        tenantId,
        to: { kind: "parent", email },
        category: "booking",
        title: "How did we do? We'd love your feedback",
        body: `${what[0].toUpperCase()}${what.slice(1)} was on ${niceDate(last)}. Tap to leave a quick star rating — it only takes a moment.`,
        subject: "How did we do? We'd love your feedback",
        emailHtml:
          `<p>${what[0].toUpperCase()}${what.slice(1)} was on <b>${niceDate(last)}</b>.</p>` +
          `<p>If you have a minute, leave us a quick star rating and a few words — it genuinely helps a small provider.</p>`,
        href,
      }),
    ).catch((err) => console.error(`[sweeps] review request ${tenantId}/${email}:`, (err as Error).message));
  }
}

// ── Day-of register alerts ────────────────────────────────────────────────
// Two alerts for the team, one scan: not-arrived a while after a session
// starts (only when the register is actually in use), and late-collection once
// a session has ended.
const NO_SHOW_GRACE = 30;          // minutes after start before chasing
const NO_SHOW_STALE = 120;         // stop chasing once the session's long begun

async function dayOfAlerts(): Promise<void> {
  const { date: today, minutes: now } = ukNow();
  const blocks = (await upcomingBlocks(today))
    .map((b) => ({ ...b, todaySessions: (b.sessions ?? []).filter((s) => s.date === today) }))
    .filter((b) => b.todaySessions.length);
  if (!blocks.length) return;

  const libFor = libraryLoader();
  const bookingsFor = blockBookingsLoader();
  const regSnap = await db.collection("registers").where("date", "==", today).get();
  type RegEntry = { status?: string; collectedAt?: string | null };
  const registers = new Map(regSnap.docs.map((d) => [
    (d.data() as { blockId?: string }).blockId ?? "",
    d.data() as { entries?: Record<string, RegEntry> },
  ]));
  const expected = async (b: (typeof blocks)[number]) =>
    (await bookingsFor(b.id)).filter(
      (bk) => (bk.status === "Confirmed" || bk.status === "Approval needed") && bookedOn(bk, today),
    );

  for (const b of blocks) {
    const lib = await libFor(b.tenantId);
    const prefs = autoEmailsOf(lib);
    const reg = registers.get(b.id);
    const entries = reg?.entries ?? {};

    // Not arrived — expected children with no mark, once the session's begun.
    // Only when the register is in use: a tenant not taking attendance in the
    // app shouldn't be told nobody has arrived.
    if (prefs.dayOf && reg) {
      for (const s of b.todaySessions) {
        const start = toMinutes(s.start);
        if (start === null || now < start + NO_SHOW_GRACE || now >= start + NO_SHOW_STALE) continue;
        const missing = (await expected(b)).filter((bk) => !entries[bk.ref]?.status);
        if (!missing.length) continue;
        const names = missing.map(kidNames).slice(0, 6).join(", ");
        await fireOnce(`noshow_${b.id}_${today}`, { tenantId: b.tenantId }, () =>
          notify({
            tenantId: b.tenantId,
            to: { kind: "tenant" },
            category: "register",
            key: "register-missing",
            title: `${missing.length} expected ${missing.length === 1 ? "child hasn't" : "children haven't"} been signed in — ${b.name ?? "today's session"}`,
            body: `Not yet marked in: ${names}${missing.length > 6 ? "…" : ""}. Mark them present or absent so the day's numbers are right.`,
            href: "/company/registers",
          }),
        ).catch((err) => console.error(`[sweeps] no-show ${b.id}:`, (err as Error).message));
      }
    }

    // Late collection — signed in, not collected, session over + threshold.
    // One alert per session (30 min after it ends by default). The email never
    // names the children — it just flags that some are still to be collected;
    // staff open the register to see who.
    if (prefs.lateCollection) {
      const regSettings = ((lib.settings as Record<string, unknown> | undefined)?.registers ?? {}) as { lateThresholdMinutes?: number };
      const threshold = Number(regSettings.lateThresholdMinutes) > 0 ? Number(regSettings.lateThresholdMinutes) : 30;
      for (const s of b.todaySessions) {
        const end = toMinutes(s.end);
        if (end === null || now < end + threshold) continue;
        const inRefs = Object.entries(entries).filter(([, e]) => e.status === "in" && !e.collectedAt).map(([ref]) => ref);
        if (!inRefs.length) continue;
        const byRef = new Map((await bookingsFor(b.id)).map((bk) => [bk.ref, bk]));
        const uncollected = inRefs.filter((ref) => { const bk = byRef.get(ref); return bk && bookedOn(bk, today); });
        if (!uncollected.length) continue;
        await fireOnce(`latecol_${b.id}_${today}_${s.end}`, { tenantId: b.tenantId }, () =>
          notify({
            tenantId: b.tenantId,
            to: { kind: "tenant" },
            category: "register",
            key: "register-collect",
            title: `Children not collected yet — session ended ${s.end}`,
            body: `Some children are still signed in ${threshold}+ minutes after the session ended. Open the register to see who, contact the families, and log each collection.`,
            href: "/company/registers",
          }),
        ).catch((err) => console.error(`[sweeps] late collection ${b.id}:`, (err as Error).message));
      }
    }
  }
}

// ── Scheduled email sends ─────────────────────────────────────────────────
// The Email composer's "Schedule send": fire each queued email through the
// send engine once its UK wall-clock sendAt arrives. The queue doc keeps the
// full payload (recipients frozen at schedule time), so firing is a straight
// hand-off; fireOnce makes it exactly-once across instances.
async function scheduledEmailSends(): Promise<void> {
  const { date, minutes } = ukNow();
  const now = `${date}T${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  const snap = await db.collection("scheduledEmails").where("status", "==", "scheduled").get();
  for (const d of snap.docs) {
    const s = d.data() as {
      tenantId?: string; subject?: string; body?: string; html?: string;
      recipients?: string[]; audience?: "all" | "one"; sendAt?: string;
      createdBy?: string; createdByName?: string;
    };
    if (!s.tenantId || !s.sendAt || s.sendAt > now) continue;
    await fireOnce(`schedmail_${d.id}`, { tenantId: s.tenantId }, async () => {
      const sent = await performEmailSend({
        tenantId: s.tenantId!,
        subject: s.subject ?? "(no subject)",
        body: s.body ?? "",
        html: s.html,
        recipients: (s.recipients ?? []).filter((r) => r.includes("@")),
        audience: s.audience ?? "all",
        sentBy: s.createdBy ?? "operator",
        sentByName: s.createdByName ?? "Operator",
        scheduledId: d.id,
      });
      await d.ref.set({ status: "sent", sentAt: new Date().toISOString(), emailId: sent.id }, { merge: true });
    }).catch((err) => console.error(`[sweeps] scheduled email ${d.id}:`, (err as Error).message));
  }
}

// ── Subscription sync ─────────────────────────────────────────────────────
// Backstop for the Stripe webhook: pull every billed tenant's subscription
// and reconcile status/periods + metered quantities. Keeps dev (no public
// webhook URL) truthful and heals missed deliveries in production.
async function subscriptionSync(): Promise<void> {
  if (!stripe) return;
  const snap = await db.collection("tenants").get();
  for (const t of snap.docs) {
    const sub = t.get("subscription") as { stripeSubscriptionId?: string; status?: string } | undefined;
    if (!sub?.stripeSubscriptionId || sub.status === "canceled") continue;
    try {
      const s = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
      await syncFromStripe(t.id, s);
      await updateMeteredQuantities(t.id);
      clearSubscriptionCache(t.id);
    } catch (e) {
      console.error(`[sweeps] subscription sync ${t.id}:`, (e as Error).message);
    }
  }
}

/** Called once from index.ts at startup. Safe on every instance. */
export function startSweeps(): void {
  sweep("calendar-reminders", 60_000, calendarReminders);
  sweep("medication-due", 60_000, medicationDue);
  sweep("ack-chase", 30 * 60_000, acknowledgementChase);
  sweep("safeguarding-reviews", 30 * 60_000, safeguardingReviews);
  // The waitlist expiry that used to be a bare setInterval in index.ts —
  // unchanged behaviour, but now exactly one instance runs it per interval.
  sweep("waitlist-expiry", 5 * 60_000, expireOffers);
  sweep("subscription-sync", 6 * 60 * 60_000, subscriptionSync);
  sweep("trip-consent-chase", 6 * 60 * 60_000, tripConsentChase);
  // Automatic emails (Setup → Email → Automatic emails).
  sweep("session-reminders", 30 * 60_000, sessionReminders);
  sweep("payment-due", 60 * 60_000, paymentDueReminders);
  sweep("review-requests", 6 * 60 * 60_000, reviewRequests);
  sweep("day-of-alerts", 10 * 60_000, dayOfAlerts);
  sweep("scheduled-emails", 60_000, scheduledEmailSends);
}
