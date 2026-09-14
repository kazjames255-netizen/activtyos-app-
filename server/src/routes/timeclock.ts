import { Router } from "express";
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

interface ClockEvent { t: string; kind: "in" | "out" | "break-start" | "break-end"; loc?: string }
interface ClockRecord {
  id: string; name: string; role?: string; op?: string;
  status: "out" | "in" | "break";
  clockInAt?: string; clockOutAt?: string; breakStart?: string; breakMs: number;
  lateMin?: number; loc?: string; approved?: boolean;
  payBasis?: string; payHoursOverride?: number; editNote?: string;
  events: ClockEvent[]; day: string;
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
  day: z.string().regex(DAY),
  name: z.string().trim().max(120).optional(),
  role: z.string().trim().max(80).optional(),
  loc: z.string().trim().max(160).optional(),
  lateMin: z.number().int().min(0).max(24 * 60).optional(),
});
class AlreadyIn extends Error { constructor(public since: string) { super("already_in"); } }

timeclock.post("/event", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !(canManage(auth.role) || auth.role === "staff")) { res.status(403).json({ error: "Forbidden" }); return; }
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const p = parsed.data;
  const self = await ownName(req.user?.uid);
  const onBehalf = canManage(auth.role) || auth.lead === true;
  const name = (onBehalf && p.name ? p.name : self).trim();
  if (!name) { res.status(400).json({ error: "Your account has no name on it — ask your manager to add one in Team & invites." }); return; }
  if (auth.role === "staff" && !auth.lead && p.name && slug(p.name) !== slug(self)) { res.status(403).json({ error: "You can only clock yourself in and out." }); return; }
  const key = keyOf(auth.tenantId, auth.franchiseId);
  const id = slug(name);
  const ref = db.collection("clockRecords").doc(docId(key, p.day, id));
  const now = new Date().toISOString();
  let rec: ClockRecord;
  try { rec = await db.runTransaction(async (tx) => {
    const cur = (await tx.get(ref)).data();
    const r: ClockRecord = cur ? strip(cur) : { id, name, status: "out", breakMs: 0, events: [], day: p.day };
    r.events = [...(r.events ?? [])];
    if (p.role && !r.role) r.role = p.role;
    switch (p.kind) {
      case "in":
        // A second clock-in while already on shift (or on a break) would wipe the
        // real start time — refuse it; the app should offer clock-out instead.
        if (r.status !== "out") throw new AlreadyIn(r.clockInAt ?? now);
        r.status = "in"; r.clockInAt = now; r.clockOutAt = undefined; r.breakMs = 0; r.breakStart = undefined;
        if (p.lateMin !== undefined) r.lateMin = p.lateMin;
        if (p.loc) r.loc = p.loc;
        r.events.push({ t: now, kind: "in", ...(p.loc ? { loc: p.loc } : {}) });
        break;
      case "out":
        if (r.status === "break" && r.breakStart) { r.breakMs += Date.parse(now) - Date.parse(r.breakStart); r.breakStart = undefined; }
        r.status = "out"; r.clockOutAt = now; r.events.push({ t: now, kind: "out" });
        break;
      case "break-start":
        if (r.status === "in") { r.status = "break"; r.breakStart = now; r.events.push({ t: now, kind: "break-start" }); }
        break;
      case "break-end":
        if (r.status === "break" && r.breakStart) { r.breakMs += Date.parse(now) - Date.parse(r.breakStart); r.breakStart = undefined; r.status = "in"; r.events.push({ t: now, kind: "break-end" }); }
        break;
    }
    const clean = JSON.parse(JSON.stringify(r)) as ClockRecord; // drop undefined
    tx.set(ref, { ...clean, key, tenantId: auth.tenantId, franchiseId: auth.franchiseId ?? null, updatedAt: now, ...(name === self ? { uid: req.user?.uid ?? null } : {}) });
    return clean;
  }); } catch (e) {
    if (e instanceof AlreadyIn) { res.status(409).json({ error: "Already clocked in — clock out first.", code: "already_in", since: e.since }); return; }
    throw e;
  }
  res.json(rec);
});

// PATCH /api/timeclock/:id?day= — a manager edits a timesheet row (times,
// break, pay basis) or approves it for payroll.
const patchSchema = z.object({
  approved: z.boolean().optional(),
  payBasis: z.enum(["actual", "scheduled", "scheduled-less-late", "custom"]).nullable().optional(),
  payHoursOverride: z.number().min(0).max(24).nullable().optional(),
  editNote: z.string().trim().max(500).optional(),
  clockInAt: z.string().max(40).optional(),
  clockOutAt: z.string().max(40).nullable().optional(),
  breakMs: z.number().min(0).max(24 * 3600_000).optional(),
  lateMin: z.number().int().min(0).max(24 * 60).optional(),
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
  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString(), editedBy: req.user?.email ?? null };
  for (const [k, v] of Object.entries(parsed.data)) if (v !== undefined) patch[k] = v;
  await ref.set(patch, { merge: true });
  res.json(strip((await ref.get()).data()!));
});
