import { db } from "../firebase";
import { esc } from "./html";
import { fireOnce, sweep, ukNow, toMinutes } from "./scheduler";
import { addDays } from "./ukDate";
import { notify, notifyTenantMember } from "./notify";
import { sendMail } from "./mailer";
import { tenantSender } from "./sender";
import { loadSettings } from "./tenantLibrary";

// The remaining "send" flows from docs/amir-backend-outstanding.md (items 22-26).
// One file so the pieces stay together; each export is called from a single
// hook (routes) or registered once in startOctSweeps (called from startSweeps).
// Mail goes through lib/mailer, so MAIL_LIVE/MAIL_ALLOWLIST still decide whether
// anything really leaves the building.

const lc = (v: unknown) => String(v ?? "").trim().toLowerCase();
const isEmail = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);

// ── 22. Timetable publish → notify parents ────────────────────────────────

export interface TimetablePublishInfo {
  tenantId: string;
  timetableId: string;
  franchiseId?: string | null;
  name: string;
  listingId?: string | null;
  dateFrom: string;
  dateTo: string;
  audience: "booked" | "everyone";
}

/** Who a published week reaches: families with a live booking with this provider
 *  (narrowed to the timetable's listing, and to the franchise's own families when
 *  it is a franchise's timetable), or — for "everyone" — every customer of the
 *  provider (same franchise rule). Returns lowercased distinct emails. */
export async function timetableAudience(p: TimetablePublishInfo): Promise<string[]> {
  const out = new Set<string>();
  const bookings = await db.collection("bookings").where("tenantId", "==", p.tenantId).get();
  for (const d of bookings.docs) {
    const b = d.data() as { email?: string; status?: string; listingId?: string; franchiseId?: string | null; days?: string[]; kids?: { dates?: string[] }[] };
    if (!b.email || b.status === "Cancelled" || b.status === "Declined") continue;
    if (p.franchiseId && b.franchiseId !== p.franchiseId) continue;
    if (p.audience === "booked") {
      if (p.listingId && b.listingId !== p.listingId) continue;
      const days = [...(b.days ?? []), ...(b.kids ?? []).flatMap((k) => k.dates ?? [])];
      if (days.length && !days.some((x) => x >= p.dateFrom && x <= p.dateTo)) continue;
    }
    out.add(lc(b.email));
  }
  if (p.audience === "everyone") {
    const cust = await db.collection("customers").where("tenantId", "==", p.tenantId).get();
    for (const d of cust.docs) {
      const e = lc(d.get("email"));
      if (e && !p.franchiseId) out.add(e); // a franchise's "everyone" is its booked families only (customers carry no franchise)
    }
  }
  return [...out].filter(isEmail);
}

/** Bell (notifyPush) and/or email (notifyEmail) to the audience. Fire-and-forget
 *  from the publish route. Unsubscribed addresses get the bell only; a family's
 *  own mute (category "calendar") is applied inside notify(). */
export async function notifyTimetablePublished(p: TimetablePublishInfo, opts: { notifyEmail?: boolean; notifyPush?: boolean }): Promise<number> {
  if (!opts.notifyEmail && !opts.notifyPush) return 0;
  const emails = (await timetableAudience(p)).slice(0, 500);
  const sup = new Set<string>();
  if (opts.notifyEmail) {
    const s = await db.collection("emailSuppressions").where("tenantId", "==", p.tenantId).get();
    for (const x of s.docs) sup.add(lc(x.get("email")));
  }
  for (const email of emails) {
    await notify({
      tenantId: p.tenantId,
      to: { kind: "parent", email },
      category: "calendar",
      title: `New timetable: ${p.name}`,
      body: `A new timetable for ${p.dateFrom} to ${p.dateTo} has been published. Open your account to see the week.`,
      href: "/custdash/timetable",
      ref: p.timetableId,
      bellOnly: !opts.notifyEmail || sup.has(email),
    });
  }
  return emails.length;
}

// ── 23. Meal-order request decision → the parent ──────────────────────────

export async function notifyMealRequestDecision(o: { tenantId: string; parentEmail: string; childName?: string; date?: string; id: string }, decision: "approved" | "declined", kind: "change" | "removal"): Promise<void> {
  const what = kind === "removal" ? "removal" : "change";
  await notify({
    tenantId: o.tenantId,
    to: { kind: "parent", email: o.parentEmail },
    category: "booking",
    title: `Meal ${what} ${decision}${o.childName ? ` — ${o.childName}` : ""}`,
    body: `Your request to ${kind === "removal" ? "remove" : "change"} the meal on ${o.date ?? "that day"} was ${decision} by the provider.`,
    href: "/custdash/meals",
    ref: o.id,
  });
}

// ── 24. Caterer digest ────────────────────────────────────────────────────

/** Pure: which days a digest covers. Daily = tomorrow's orders; weekly (sent
 *  Mondays) = the 7 days starting today. null = not due today. */
export function catererWindow(every: string | undefined, today: string): { from: string; to: string } | null {
  if (every === "day") return { from: addDays(today, 1), to: addDays(today, 1) };
  if (every === "week") {
    const dow = new Date(`${today}T12:00:00Z`).getUTCDay();
    return dow === 1 ? { from: today, to: addDays(today, 6) } : null;
  }
  return null;
}

export async function catererDigest(now = ukNow()): Promise<number> {
  let sent = 0;
  const snap = await db.collection("listings").where("mealConfig.catererEvery", "in", ["day", "week"]).get();
  for (const d of snap.docs) {
    const l = d.data() as { tenantId?: string; name?: string; title?: string; mealConfig?: { catererEmail?: string; catererEvery?: string; catererAt?: string } };
    const mc = l.mealConfig ?? {};
    const to = (mc.catererEmail ?? "").trim();
    if (!l.tenantId || !isEmail(to)) continue;
    const win = catererWindow(mc.catererEvery, now.date);
    if (!win || now.minutes < (toMinutes(mc.catererAt) ?? 8 * 60)) continue;
    await fireOnce(`caterer_${d.id}_${now.date}`, { tenantId: l.tenantId }, async () => {
      const orders = await db.collection("mealOrders").where("tenantId", "==", l.tenantId!).get();
      const rows = orders.docs
        .map((o) => o.data() as { listingId?: string; date?: string; status?: string; childName?: string; items?: { name: string; qty?: number }[]; allergenWarning?: string[] })
        .filter((o) => o.listingId === d.id && o.status !== "cancelled" && (o.date ?? "") >= win.from && (o.date ?? "") <= win.to)
        .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.childName).localeCompare(String(b.childName)));
      if (!rows.length) return; // nothing to cook, nothing to send
      const li = rows.map((o) => `<li><b>${esc(o.date)}</b> — ${esc(o.childName)}: ${(o.items ?? []).map((i) => `${i.qty && i.qty > 1 ? `${i.qty} × ` : ""}${esc(i.name)}`).join(", ")}${o.allergenWarning?.length ? ` <b>(allergy flag: ${esc(o.allergenWarning.join("; "))})</b>` : ""}</li>`).join("");
      const sender = await tenantSender(l.tenantId!);
      const label = l.name ?? l.title ?? "your activity";
      await sendMail(to, `Meal orders — ${label} (${win.from === win.to ? win.from : `${win.from} to ${win.to}`})`, `<p>Meal orders for <b>${esc(label)}</b>, ${win.from === win.to ? win.from : `${win.from} to ${win.to}`}:</p><ul>${li}</ul><p>${rows.length} order${rows.length === 1 ? "" : "s"}.</p>`, sender);
      sent++;
    }).catch((e) => console.error(`[caterer] ${d.id}:`, (e as Error).message));
  }
  return sent;
}

// ── 25. Schedule sends ────────────────────────────────────────────────────

interface RotaStaff { id: string; name: string }
async function staffEmailByName(tenantId: string, franchiseId: string | null): Promise<Map<string, string>> {
  const users = await db.collection("users").where("tenantId", "==", tenantId).where("role", "==", "staff").get();
  const m = new Map<string, string>();
  for (const u of users.docs) {
    if (u.get("disabled") === true || !u.get("email")) continue;
    if (franchiseId && u.get("franchiseId") !== franchiseId) continue;
    if (!franchiseId && u.get("franchiseId")) continue;
    m.set(lc(u.get("name")), lc(u.get("email")));
  }
  return m;
}

/** Rota save hook: shifts newly published (locked false -> true) with a person on
 *  them → one bell/email per staff member, per Setup "notifyOnPublish". */
export async function notifyRotaPublished(tenantId: string, franchiseId: string | null, staff: RotaStaff[], published: { staffId: string | null; date: string; start: string; end: string }[]): Promise<number> {
  if (!published.length) return 0;
  const sched = ((await loadSettings(tenantId, franchiseId)).scheduling ?? {}) as { notifyOnPublish?: string };
  const mode = sched.notifyOnPublish ?? "email_push";
  if (mode === "off") return 0;
  const wantEmail = mode === "email" || mode === "email_push";
  const emails = await staffEmailByName(tenantId, franchiseId);
  const nameOf = new Map(staff.map((s) => [s.id, lc(s.name)]));
  const per = new Map<string, typeof published>();
  for (const s of published) {
    const e = s.staffId ? emails.get(nameOf.get(s.staffId) ?? "") : undefined;
    if (e) per.set(e, [...(per.get(e) ?? []), s]);
  }
  for (const [email, list] of per) {
    list.sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
    await notifyTenantMember(tenantId, email, {
      category: "calendar",
      title: "Your schedule has been published",
      body: `${list.length} shift${list.length === 1 ? "" : "s"}: ${list.slice(0, 6).map((s) => `${s.date} ${s.start}-${s.end}`).join(", ")}${list.length > 6 ? ` and ${list.length - 6} more` : ""}.`,
      href: "/staff/schedule",
      sendEmail: wantEmail,
    });
  }
  return per.size;
}

/** Sweep: shiftReminder (24h / 2h before a published shift) + autoRemindUnconfirmed
 *  (nudge staff with a pending availability request every 24h / 48h). */
export async function scheduleReminders(now = ukNow()): Promise<void> {
  const metas = await db.collection("rotas").get();
  for (const m of metas.docs) {
    const tenantId = m.get("tenantId") as string | undefined;
    if (!tenantId) continue;
    const franchiseId = (m.get("franchiseId") as string | null) ?? null;
    const sched = ((await loadSettings(tenantId, franchiseId)).scheduling ?? {}) as { shiftReminder?: string; autoRemindUnconfirmed?: string };
    if (sched.shiftReminder === "24h" || sched.shiftReminder === "2h") {
      const lead = sched.shiftReminder === "24h" ? 24 * 60 : 120;
      const staff = (m.get("staff") as RotaStaff[] | undefined) ?? [];
      const nameOf = new Map(staff.map((s) => [s.id, lc(s.name)]));
      // A reminder lead is at most 24h, so only a shift today or tomorrow can be inside its window (dayDiff <= 1 below).
      // Equality/`in` only, so no composite index; before, every shift of the whole season was read every 15 minutes per rota.
      const shifts = await db.collection("rotaShifts").where("rotaKey", "==", m.id).where("date", "in", [now.date, addDays(now.date, 1)]).get();
      const emails = shifts.empty ? new Map<string, string>() : await staffEmailByName(tenantId, franchiseId);
      for (const sd of shifts.docs) {
        const s = sd.data() as { id: string; staffId?: string | null; date: string; start: string; end: string; locked?: boolean };
        const startMin = toMinutes(s.start);
        if (!s.locked || !s.staffId || startMin === null || s.date < now.date) continue;
        const dayDiff = Math.round((Date.parse(`${s.date}T00:00:00Z`) - Date.parse(`${now.date}T00:00:00Z`)) / 86_400_000);
        const minsUntil = dayDiff * 1440 + startMin - now.minutes;
        if (minsUntil > lead || minsUntil < 0) continue;
        const email = emails.get(nameOf.get(s.staffId) ?? "");
        if (!email) continue;
        await fireOnce(`shiftrem_${sd.id}_${sched.shiftReminder}`, { tenantId }, () =>
          notifyTenantMember(tenantId, email, { category: "calendar", title: "Shift reminder", body: `You're on shift ${s.date} ${s.start}-${s.end}.`, href: "/staff/schedule", sendEmail: true }),
        ).catch((e) => console.error("[sched] shift reminder:", (e as Error).message));
      }
    }
    if (sched.autoRemindUnconfirmed === "24h" || sched.autoRemindUnconfirmed === "48h") {
      const gap = sched.autoRemindUnconfirmed === "24h" ? 24 : 48;
      const pend = await db.collection("availabilityRequests").where("tenantId", "==", tenantId).where("status", "==", "pending").get();
      for (const r of pend.docs) {
        if ((r.get("franchiseId") ?? null) !== franchiseId) continue;
        const ageH = (Date.now() - Date.parse(String(r.get("createdAt")))) / 3_600_000;
        const n = Math.floor(ageH / gap);
        if (n < 1) continue;
        await fireOnce(`availchase_${r.id}_${n}`, { tenantId }, () =>
          notifyTenantMember(tenantId, String(r.get("staffEmail")), { category: "calendar", title: "Reminder: availability still needed", body: `Please add your availability for ${(r.get("window") as { label?: string } | undefined)?.label ?? "the requested period"}.`, href: "/staff/availability", ref: r.id, sendEmail: true }),
        ).catch((e) => console.error("[sched] avail chase:", (e as Error).message));
      }
    }
  }
}

// ── 26. Learning chasers + weekly manager digest ──────────────────────────

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
/** "2026-07-30", "30 Jun", "30 Jun 2026" → ISO. A year-less date means the
 *  current year, or next year when that would put it more than 6 months back. */
export function parseDue(due: string | undefined, today: string): string | null {
  const s = (due ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = /^(\d{1,2})\s+([A-Za-z]{3})[a-z]*(?:\s+(\d{4}))?$/.exec(s);
  if (!m) return null;
  const mi = MONTHS.indexOf(m[2].toLowerCase());
  if (mi < 0) return null;
  const mk = (y: number) => `${y}-${String(mi + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const y = m[3] ? Number(m[3]) : Number(today.slice(0, 4));
  const iso = mk(y);
  return !m[3] && iso < addDays(today, -183) ? mk(y + 1) : iso;
}

interface Asn { course: string; title: string; kind?: string; roles?: string[]; staff?: string[]; locs?: string[]; due?: string; required?: boolean; renewMonths?: number }
export type LearnStage = "due-soon" | "due-today" | "overdue" | "renewal";
/** Pure: what, if anything, to chase today. Overdue chases weekly (Mondays). */
export function learnStage(dueIso: string | null, doneDate: string | null, renewMonths: number | undefined, today: string): LearnStage | null {
  if (doneDate) {
    if (!renewMonths) return null;
    const d = new Date(`${doneDate}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + renewMonths);
    const exp = d.toISOString().slice(0, 10);
    return today >= addDays(exp, -30) && today <= exp && new Date(`${today}T12:00:00Z`).getUTCDay() === 1 ? "renewal" : null;
  }
  if (!dueIso) return null;
  if (dueIso === today) return "due-today";
  if (dueIso === addDays(today, 3)) return "due-soon";
  if (dueIso < today && new Date(`${today}T12:00:00Z`).getUTCDay() === 1) return "overdue";
  return null;
}

export async function learningChasers(now = ukNow()): Promise<void> {
  const docs = await db.collection("learningAssignments").get();
  for (const ad of docs.docs) {
    const tenantId = ad.get("tenantId") as string | undefined;
    if (!tenantId) continue;
    const franchiseId = (ad.get("franchiseId") as string | null) ?? null;
    const asns = ((ad.get("assignments") as Asn[] | undefined) ?? []).filter((a) => a && a.course);
    if (!asns.length) continue;
    const learn = ((await loadSettings(tenantId, franchiseId)).learning ?? {}) as { trackTraining?: boolean };
    if (learn.trackTraining === false) continue;
    const users = (await db.collection("users").where("tenantId", "==", tenantId).where("role", "==", "staff").get()).docs
      .filter((u) => u.get("disabled") !== true && u.get("email") && ((franchiseId && u.get("franchiseId") === franchiseId) || (!franchiseId && !u.get("franchiseId"))));
    const comps = (await db.collection("learningCompletions").where("key", "==", ad.id).get()).docs.map((c) => c.data());
    const tally = { overdue: 0, soon: 0, people: new Set<string>() };
    for (const a of asns) {
      const dueIso = parseDue(a.due, now.date);
      const norm = (x: string) => x.replace(/[^a-z0-9]+/g, " ").trim();
      for (const u of users) {
        const name = lc(u.get("name"));
        const jobs = [lc(u.get("jobTitle")), lc(u.get("staffRole"))].filter(Boolean).map(norm);
        const reach = a.kind === "staff" ? (a.staff ?? []).some((s) => lc(s) === name)
          : a.kind === "roles" ? (a.roles ?? []).some((r) => jobs.includes(norm(lc(r))))
          : true;
        if (!reach) continue;
        const done = comps.find((c) => c.courseId === a.course && (c.uid === u.id || lc(c.staffName) === name));
        const stage = learnStage(dueIso, (done?.date as string | undefined) ?? null, a.renewMonths, now.date);
        if (!stage) continue;
        if (stage === "overdue" || stage === "renewal") { tally.overdue++; tally.people.add(name); } else tally.soon++;
        const text = { "due-soon": `is due in 3 days`, "due-today": `is due today`, overdue: `is overdue (due ${dueIso})`, renewal: `is coming up for renewal` }[stage];
        await fireOnce(`learnchase_${ad.id}_${a.course}_${u.id}_${stage}_${now.date}`, { tenantId }, () =>
          notifyTenantMember(tenantId, String(u.get("email")), { category: "task", title: `Training ${stage === "renewal" ? "renewal" : "reminder"}: ${a.title}`, body: `"${a.title}" ${text}. Open it in My learning.`, href: "/staff/certificates", sendEmail: true }),
        ).catch((e) => console.error("[learning] chase:", (e as Error).message));
      }
    }
    // Weekly manager digest (Mondays): one line, only when something needs chasing.
    if (new Date(`${now.date}T12:00:00Z`).getUTCDay() === 1 && (tally.overdue || tally.soon)) {
      await fireOnce(`learndigest_${ad.id}_${now.date}`, { tenantId }, () =>
        notify({ tenantId, to: { kind: "tenant" }, category: "task", key: "learning-digest", franchiseId, title: "Weekly training digest", body: `${tally.overdue} overdue or renewal-due item${tally.overdue === 1 ? "" : "s"} across ${tally.people.size} ${tally.people.size === 1 ? "person" : "people"}; ${tally.soon} due soon.`, href: "/company/learning" }),
      ).catch((e) => console.error("[learning] digest:", (e as Error).message));
    }
  }
}

export function startOctSweeps(): void {
  sweep("caterer-digest", 10 * 60_000, async () => { await catererDigest(); });
  sweep("schedule-reminders", 15 * 60_000, () => scheduleReminders());
  sweep("learning-chasers", 6 * 60 * 60_000, () => learningChasers());
}
