import { Router } from "express";
import { isRealDay, isRealTime, ukToday, ukTodayPlus } from "../lib/ukDate";
import { z } from "zod";
import { db } from "../firebase";
import type { AuthContext, Role } from "../middleware/role";

// Clock in/out, on the server.
//
// Every clock record lived in the browser that made it (localStorage
// "aos.timeclock.v1"), so a member of staff clocking in on their phone never
// appeared on the manager's "who's in" board, the On-site-now card, or the
// timesheets that feed payroll — each device saw only its own clockings. A
// fire register built from that would be wrong.
//
// One doc per person per day in `clockRecords`, keyed like the rota
// (tenant, or tenant__fr__franchise). People are matched by the same slug of
// their name the rota and payroll use. The screens keep a same-device cache
// (features/timeclock/data.ts) that this refreshes.

export const timeclock = Router();

const canManage = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";
const keyOf = (tenantId: string, franchiseId: string | null) => (franchiseId ? `${tenantId}__fr__${franchiseId}` : tenantId);
const slug = (name: string) => name.trim().toLowerCase().replace(/\s+/g, "-");
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const docId = (key: string, day: string, id: string) => `${key}_${day}_${id}`.replace(/\//g, "_");

interface ClockEvent { t: string; kind: "in" | "out" | "break-start" | "break-end"; loc?: string; manual?: boolean }
interface ClockRecord {
  id: string; name: string; role?: string; op?: string;
  status: "out" | "in" | "break";
  clockInAt?: string; clockOutAt?: string; breakStart?: string; breakMs: number;
  lateMin?: number; loc?: string; approved?: boolean;
  payBasis?: string; payHoursOverride?: number; editNote?: string;
  events: ClockEvent[]; day: string;
  // Set when staff supplied the time themselves for an earlier day (tenant setting staffBackfillDays) — the manager must review it.
  staffEdited?: boolean; needsReview?: boolean; staffEditedBy?: string; staffEditedAt?: string;
}

// Tenant-wide pay-policy settings (grace minutes, rounding, pay basis, lead
// label) — was per-device localStorage (Amir 63): every manager's browser
// had its own copy, so the same late clock-in could pay differently
// depending who ran the timesheet. One doc per tenant (or franchise), same
// key convention as the clock records above and payroll's `payrollConfig`.
const clockCfg = (key: string) => db.collection("clockSettings").doc(key.replace(/\//g, "_"));
interface ClockPaySettings {
  payPolicy: "actual" | "scheduled" | "scheduled-less-late";
  autoPayOvertime: boolean;
  graceMin: number;
  rounding: 0 | 5 | 15;
  leadLabel: string;
  /** 0 = off (default): only a manager fixes a forgotten clock-out on an earlier day. 1-14 = staff may correct their OWN clockings up to this many days back (by giving the real time). */
  staffBackfillDays: number;
}
const DEFAULT_CLOCK_SETTINGS: ClockPaySettings = { payPolicy: "actual", autoPayOvertime: false, graceMin: 5, rounding: 0, leadLabel: "Lead", staffBackfillDays: 0 };
const settingsSchema = z.object({
  payPolicy: z.enum(["actual", "scheduled", "scheduled-less-late"]),
  autoPayOvertime: z.boolean(),
  graceMin: z.number().int().min(0).max(120),
  rounding: z.union([z.literal(0), z.literal(5), z.literal(15)]),
  leadLabel: z.string().trim().min(1).max(60),
  staffBackfillDays: z.number().int().min(0).max(14).optional(),
});

// GET /api/timeclock/settings — the tenant's pay-policy settings. Managers
// AND staff can read (a staff member's own timesheet display computes
// against this too); only a manager can change it (PUT below).
timeclock.get("/settings", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !(canManage(auth.role) || auth.role === "staff")) { res.status(403).json({ error: "Forbidden" }); return; }
  const snap = await clockCfg(keyOf(auth.tenantId, auth.franchiseId)).get();
  const data = snap.data() ?? {};
  const { tenantId: _t, franchiseId: _f, updatedAt: _a, updatedBy: _b, ...rest } = data;
  res.json({ ...DEFAULT_CLOCK_SETTINGS, ...rest });
});

// PUT /api/timeclock/settings — a manager sets the tenant's clock & pay
// policy so every manager's timesheet computes the same pay from the same
// place, instead of each browser's own localStorage copy.
timeclock.put("/settings", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canManage(auth.role)) { res.status(403).json({ error: "Only a manager can change clock & pay-policy settings" }); return; }
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const key = keyOf(auth.tenantId, auth.franchiseId);
  await clockCfg(key).set({ ...parsed.data, tenantId: auth.tenantId, franchiseId: auth.franchiseId ?? null, updatedAt: new Date().toISOString(), updatedBy: req.user?.email ?? null }, { merge: true });
  res.json({ ok: true, settings: parsed.data });
});

/** UK wall-clock `day` + `HH:MM` -> the real instant (ISO), DST-safe. */
function ukWallToISO(day: string, hm: string): string {
  const want = Date.parse(`${day}T${hm}:00Z`);
  const offsetAt = (t: number) => {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(t));
    const g = (ty: string) => Number(parts.find((x) => x.type === ty)!.value);
    return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")) - Math.floor(t / 1000) * 1000;
  };
  let t = want - offsetAt(want);
  t = want - offsetAt(t);
  return new Date(t).toISOString();
}

/** The signed-in member of staff's own name, from their account. */
async function ownName(uid: string | undefined): Promise<string> {
  if (!uid) return "";
  const u = await db.collection("users").doc(uid).get();
  return String(u.get("name") ?? "").trim();
}

function strip(d: FirebaseFirestore.DocumentData): ClockRecord {
  const { key: _k, tenantId: _t, franchiseId: _f, uid: _u, updatedAt: _a, ...r } = d;
  return r as ClockRecord;
}

// GET /api/timeclock?day=YYYY-MM-DD — that day's records. Managers and leads
// see everyone; other staff see only their own.
timeclock.get("/", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !(canManage(auth.role) || auth.role === "staff")) { res.status(403).json({ error: "Forbidden" }); return; }
  const day = String(req.query.day ?? "");
  if (!DAY.test(day)) { res.status(400).json({ error: "day=YYYY-MM-DD required" }); return; }
  const snap = await db.collection("clockRecords").where("key", "==", keyOf(auth.tenantId, auth.franchiseId)).where("day", "==", day).get();
  let list = snap.docs.map((d) => strip(d.data()));
  if (auth.role === "staff" && !auth.lead) {
    const me = slug(await ownName(req.user?.uid));
    list = list.filter((r) => r.id === me);
  }
  res.json(list);
});

// POST /api/timeclock/event — clock in / out / start or end a break. The time
// is the server's. Staff clock themselves; a manager (or lead) can clock
// someone in from the board by name.
const eventSchema = z.object({
  kind: z.enum(["in", "out", "break-start", "break-end"]),
  day: z.string().regex(DAY).refine(isRealDay, "Not a real calendar date"),
  name: z.string().trim().max(120).optional(),
  role: z.string().trim().max(80).optional(),
  loc: z.string().trim().max(160).optional(),
  lateMin: z.number().int().min(0).max(24 * 60).optional(),
  /** HH:MM (UK) — the real clocking time, required when staff correct an earlier day. */
  time: z.string().refine(isRealTime, "Not a real time (HH:MM)").optional(),
});
class BadCorrection extends Error {}
class AlreadyIn extends Error { constructor(public since: string) { super("already_in"); } }

timeclock.post("/event", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !(canManage(auth.role) || auth.role === "staff")) { res.status(403).json({ error: "Forbidden" }); return; }
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const p = parsed.data;
  // The time is the server's, but the DAY the record files under was the client's word: a member of staff could hang today's real clocking on
  // any date they weren't rostered (a pay row for a day they didn't work). Staff clock for today only. Earlier days are manager-only unless the
  // tenant turned on staffBackfillDays — and then the staff member must SUPPLY the real time (server "now" on Monday's record made on Wednesday
  // would be a ~48h shift), and the record is flagged for the manager. A manager or lead back-filling from the board is unrestricted.
  const isPlainStaff = auth.role === "staff" && !auth.lead;
  const today = ukToday();
  let correctionAt: string | null = null;
  if (isPlainStaff && p.day !== today) {
    if (p.day > today) { res.status(400).json({ error: "You can't clock in or out for a future day." }); return; }
    const cfg = (await clockCfg(keyOf(auth.tenantId, auth.franchiseId)).get()).data() ?? {};
    const lookBack = Number(cfg.staffBackfillDays ?? 0);
    if (!(lookBack > 0)) { res.status(400).json({ error: "You can only clock in and out for today. Ask your manager to fix an earlier day." }); return; }
    if (p.day < ukTodayPlus(-lookBack)) { res.status(400).json({ error: `You can only correct the last ${lookBack} day${lookBack === 1 ? "" : "s"}. Ask your manager.` }); return; }
    if (p.kind !== "in" && p.kind !== "out") { res.status(400).json({ error: "Only a clock-in or clock-out can be corrected for an earlier day." }); return; }
    if (!p.time) { res.status(400).json({ error: "Enter the actual time (HH:MM) you clocked." }); return; }
    correctionAt = ukWallToISO(p.day, p.time);
    if (Date.parse(correctionAt) > Date.now()) { res.status(400).json({ error: "That time is in the future." }); return; }
  }
  const self = await ownName(req.user?.uid);
  const onBehalf = canManage(auth.role) || auth.lead === true;
  const name = (onBehalf && p.name ? p.name : self).trim();
  if (!name) { res.status(400).json({ error: "Your account has no name on it — ask your manager to add one in Team & invites." }); return; }
  if (auth.role === "staff" && !auth.lead && p.name && slug(p.name) !== slug(self)) { res.status(403).json({ error: "You can only clock yourself in and out." }); return; }
  const key = keyOf(auth.tenantId, auth.franchiseId);
  const id = slug(name);
  const ref = db.collection("clockRecords").doc(docId(key, p.day, id));
  const realNow = new Date().toISOString();
  const now = correctionAt ?? realNow;
  const manual = correctionAt !== null;
  let rec: ClockRecord;
  try { rec = await db.runTransaction(async (tx) => {
    const cur = (await tx.get(ref)).data();
    const r: ClockRecord = cur ? strip(cur) : { id, name, status: "out", breakMs: 0, events: [], day: p.day };
    r.events = [...(r.events ?? [])];
    if (p.role && !r.role) r.role = p.role;
    if (manual && p.kind === "out") {
      if (!r.clockInAt) throw new BadCorrection("There's no clock-in on that day to clock out of.");
      if (!(Date.parse(now) > Date.parse(r.clockInAt))) throw new BadCorrection("Clock-out must be after your clock-in.");
    }
    switch (p.kind) {
      case "in":
        // A second clock-in while already on shift (or on a break) would wipe the
        // real start time — refuse it; the app should offer clock-out instead.
        if (r.status !== "out") throw new AlreadyIn(r.clockInAt ?? now);
        r.status = "in"; r.clockInAt = now; r.clockOutAt = undefined; r.breakMs = 0; r.breakStart = undefined;
        if (p.lateMin !== undefined) r.lateMin = p.lateMin;
        if (p.loc) r.loc = p.loc;
        r.events.push({ t: now, kind: "in", ...(p.loc ? { loc: p.loc } : {}), ...(manual ? { manual: true } : {}) });
        break;
      case "out":
        if (r.status === "break" && r.breakStart) { r.breakMs += Date.parse(now) - Date.parse(r.breakStart); r.breakStart = undefined; }
        r.status = "out"; r.clockOutAt = now; r.events.push({ t: now, kind: "out", ...(manual ? { manual: true } : {}) });
        break;
      case "break-start":
        if (r.status === "in") { r.status = "break"; r.breakStart = now; r.events.push({ t: now, kind: "break-start" }); }
        break;
      case "break-end":
        if (r.status === "break" && r.breakStart) { r.breakMs += Date.parse(now) - Date.parse(r.breakStart); r.breakStart = undefined; r.status = "in"; r.events.push({ t: now, kind: "break-end" }); }
        break;
    }
    if (manual) { r.staffEdited = true; r.needsReview = true; r.staffEditedBy = req.user?.email ?? self; r.staffEditedAt = realNow; }
    const clean = JSON.parse(JSON.stringify(r)) as ClockRecord; // drop undefined
    tx.set(ref, { ...clean, key, tenantId: auth.tenantId, franchiseId: auth.franchiseId ?? null, updatedAt: realNow, ...(name === self ? { uid: req.user?.uid ?? null } : {}) });
    return clean;
  }); } catch (e) {
    if (e instanceof AlreadyIn) { res.status(409).json({ error: "Already clocked in — clock out first.", code: "already_in", since: e.since }); return; }
    if (e instanceof BadCorrection) { res.status(400).json({ error: e.message }); return; }
    throw e;
  }
  if (manual) void db.collection("clockAuditLog").add({ tenantId: auth.tenantId, franchiseId: auth.franchiseId ?? null, key, action: "staff-correction", actor: req.user?.email ?? req.user?.uid ?? null, name, day: p.day, kind: p.kind, suppliedTime: p.time, recordedAt: now, at: realNow }).catch((e2) => console.error("[clockAudit] write failed:", (e2 as Error).message));
  res.json(rec);
});

// GET /api/timeclock/review — records staff corrected themselves (earlier days) that a manager hasn't reviewed yet, last 15 days.
timeclock.get("/review", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canManage(auth.role)) { res.status(403).json({ error: "Only a manager can review staff corrections" }); return; }
  const snap = await db.collection("clockRecords").where("key", "==", keyOf(auth.tenantId, auth.franchiseId)).where("day", ">=", ukTodayPlus(-15)).get();
  res.json(snap.docs.map((d) => strip(d.data())).filter((r) => r.needsReview).sort((a, b) => a.day.localeCompare(b.day)));
});

// PATCH /api/timeclock/:id?day= — a manager edits a timesheet row (times,
// break, pay basis) or approves it for payroll.
const patchSchema = z.object({
  approved: z.boolean().optional(),
  payBasis: z.enum(["actual", "scheduled", "scheduled-less-late", "custom"]).nullable().optional(),
  payHoursOverride: z.number().min(0).max(24).nullable().optional(),
  editNote: z.string().trim().max(500).optional(),
  // Stored and later subtracted for payroll hours: an unparseable stamp ("garbage") became NaN hours.
  clockInAt: z.string().max(40).refine((v) => Number.isFinite(Date.parse(v)), "Not a real date/time").optional(),
  clockOutAt: z.string().max(40).refine((v) => Number.isFinite(Date.parse(v)), "Not a real date/time").nullable().optional(),
  breakMs: z.number().min(0).max(24 * 3600_000).optional(),
  lateMin: z.number().int().min(0).max(24 * 60).optional(),
  needsReview: z.literal(false).optional(), // a manager marks a staff-made correction as reviewed
});
timeclock.patch("/:id", async (req, res) => {
  const auth: AuthContext = req.auth!;
  if (!auth.tenantId || !canManage(auth.role)) { res.status(403).json({ error: "Only a manager can edit timesheets" }); return; }
  const day = String(req.query.day ?? "");
  if (!DAY.test(day)) { res.status(400).json({ error: "day=YYYY-MM-DD required" }); return; }
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const ref = db.collection("clockRecords").doc(docId(keyOf(auth.tenantId, auth.franchiseId), day, String(req.params.id)));
  const snap = await ref.get();
  if (!snap.exists) { res.status(404).json({ error: "No clock record for that person on that day" }); return; }
  // The edited clock-in/out must still make sense together: out after in, and not a shift longer than a day.
  const inAt = parsed.data.clockInAt ?? (snap.get("clockInAt") as string | undefined);
  const outAt = parsed.data.clockOutAt !== undefined ? parsed.data.clockOutAt : (snap.get("clockOutAt") as string | null | undefined);
  if (inAt && outAt) {
    const span = Date.parse(outAt) - Date.parse(inAt);
    if (!(span > 0)) { res.status(400).json({ error: "Clock-out must be after clock-in" }); return; }
    if (span > 24 * 3600_000) { res.status(400).json({ error: "That shift is longer than 24 hours — check the times" }); return; }
  }
  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString(), editedBy: req.user?.email ?? null };
  for (const [k, v] of Object.entries(parsed.data)) if (v !== undefined) patch[k] = v;
  await ref.set(patch, { merge: true });
  res.json(strip((await ref.get()).data()!));
});
