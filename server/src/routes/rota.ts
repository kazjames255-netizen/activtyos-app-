import { Router } from "express";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";
import { staffRosterBlock } from "../lib/staffPolicy";
import { loadSettings } from "../lib/tenantLibrary";

// The Schedule & rota screen's store, on the server.
//
// The rota lived in each manager's browser (localStorage "aos.rota.v5"): a
// second manager saw an empty rota, clearing the browser lost it, and — the
// part that matters — the Settings → Staff & workforce compliance policy
// (requireDBS / requireCompliance, enforced by /api/shifts) was never reached,
// so someone with no DBS on file could be rostered to work with children.
//
// The screen saves its whole store at once, so this takes the store and diffs
// it: roster metadata (staff list, sites) in `rotas/{key}`, one doc per shift
// in `rotaShifts` (so a long season can't hit Firestore's 1MB doc limit). Any
// NEW assignment — a shift gaining a person, or changing person — is checked
// against the policy, and the save is refused (409, nothing written) naming
// who and why.
//
// Key: the tenant, or tenant__fr__franchise for a franchise (its own rota).

export const rota = Router();

const canManage = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";
const canRead = (role: Role) => role === "staff" || canManage(role);

const staffSchema = z.object({
  id: z.string().max(80),
  name: z.string().max(120),
  role: z.string().max(80).optional().default(""),
  rate: z.number().nonnegative().max(10_000).optional().default(0),
}).passthrough();
const shiftSchema = z.object({
  id: z.string().max(80),
  staffId: z.string().max(80).nullable(),
  site: z.string().max(160).optional().default(""),
  role: z.string().max(80).optional().default(""),
  date: z.string().max(10),
  start: z.string().max(8),
  end: z.string().max(8),
}).passthrough();
const storeSchema = z.object({
  staff: z.array(staffSchema).max(1_000),
  shifts: z.array(shiftSchema).max(20_000),
  sites: z.array(z.string().max(160)).max(500).default([]),
  // The version the screen started from. If someone else has saved since, the
  // save is refused (412) rather than deleting their shifts — the store is
  // saved whole, so last-writer-wins would wipe anything not on this screen.
  baseUpdatedAt: z.string().max(40).nullable().optional(),
});

/** JSON with keys in a fixed order — Firestore hands fields back in its own
 *  order, so a plain stringify said every shift had changed on every save. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(v ?? null);
}

const keyOf = (tenantId: string, franchiseId: string | null) => (franchiseId ? `${tenantId}__fr__${franchiseId}` : tenantId);
const shiftDocId = (key: string, id: string) => `${key}_${id}`.replace(/\//g, "_");

async function loadStore(key: string) {
  const [meta, shiftsSnap] = await Promise.all([
    db.collection("rotas").doc(key).get(),
    db.collection("rotaShifts").where("rotaKey", "==", key).get(),
  ]);
  const m = meta.data() ?? {};
  const shifts = shiftsSnap.docs.map((d) => {
    const { rotaKey: _k, tenantId: _t, franchiseId: _f, ...s } = d.data() as Record<string, unknown>;
    return s;
  });
  return { staff: (m.staff as Record<string, unknown>[] | undefined) ?? [], sites: (m.sites as string[] | undefined) ?? [], shifts, updatedAt: (m.updatedAt as string | undefined) ?? null };
}

// Approved leave (Leave & absence — the `absences` collection in leave.ts) →
// this team's shifts. A shift's staff member may have leave approved for that
// date; the rota never cross-referenced it, so it kept showing them as
// scheduled with nothing to say otherwise. `absences` is keyed by the same
// rotaKey (tenant, or tenant__fr__franchise) as the rota — but by NAME, not
// staffId: leave.ts stamps `staffId: slug(name)` (e.g. "jordan-lee"), which
// isn't the rota's own staff.id (e.g. "team-jordan-lee" — see withTeam in
// ScheduleApp.tsx), so the two only line up reliably by name. Matches
// staffRosterBlock's own trimmed-lowercase name comparison (staffPolicy.ts).
async function approvedLeaveByName(key: string): Promise<Map<string, { start: string; end: string }[]>> {
  const snap = await db.collection("absences").where("rotaKey", "==", key).where("status", "==", "approved").get();
  const byName = new Map<string, { start: string; end: string }[]>();
  for (const d of snap.docs) {
    const a = d.data() as { name?: string; start?: string; end?: string };
    const name = (a.name ?? "").trim().toLowerCase();
    if (!name || !a.start || !a.end) continue;
    const arr = byName.get(name) ?? [];
    arr.push({ start: a.start, end: a.end });
    byName.set(name, arr);
  }
  return byName;
}
const dateInRanges = (ranges: { start: string; end: string }[] | undefined, date: string): boolean =>
  !!ranges && ranges.some((r) => r.start <= date && date <= r.end);

/** Stamp `staffOnLeave`/`needsCover` onto any shift whose staff member has
 *  approved leave covering that shift's date — the UI shows "Off — needs
 *  cover" instead of silently rendering them as rostered. */
async function flagShiftsOnLeave(key: string, staff: Record<string, unknown>[], shifts: Record<string, unknown>[]): Promise<Record<string, unknown>[]> {
  const byName = await approvedLeaveByName(key);
  if (!byName.size) return shifts;
  const nameOfStaffId = new Map(staff.map((s) => [String(s.id), String(s.name ?? "").trim().toLowerCase()]));
  return shifts.map((s) => {
    const staffId = s.staffId as string | null | undefined;
    const date = s.date as string | undefined;
    const name = staffId ? nameOfStaffId.get(staffId) : undefined;
    if (name && date && dateInRanges(byName.get(name), date)) {
      return { ...s, staffOnLeave: true, needsCover: true };
    }
    return s;
  });
}

// GET /api/rota — the store. Staff read it too (it's their rota), but never
// see colleagues' pay rates.
rota.get("/", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canRead(auth.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const key = keyOf(auth.tenantId, auth.franchiseId);
  const store = await loadStore(key);
  store.shifts = await flagShiftsOnLeave(key, store.staff as Record<string, unknown>[], store.shifts as Record<string, unknown>[]) as typeof store.shifts;
  if (auth.role === "staff") {
    store.staff = store.staff.map(({ rate: _r, ...s }) => s);
    // Colleagues' shifts follow Setup → Scheduling "who can see co-workers"
    // (all / same listing / leads only / hidden) on the SERVER too — the screen
    // hid them, but the whole rota was one request away (acceptance d16s2).
    // "Me" is the account name the manager set (never the token's).
    const sched = ((await loadSettings(auth.tenantId, auth.franchiseId)).scheduling ?? {}) as { coworkerVisibility?: string };
    const vis = sched.coworkerVisibility ?? "all";
    const acct = req.user?.uid ? String((await db.collection("users").doc(req.user.uid).get()).get("name") ?? "").trim().toLowerCase() : "";
    const myIds = new Set(store.staff.filter((m) => acct && String(m.name ?? "").trim().toLowerCase() === acct).map((m) => String(m.id)));
    const shifts = store.shifts as { staffId?: string | null; role?: string; listing?: string; site?: string }[];
    const mine = shifts.filter((x) => x.staffId && myIds.has(x.staffId));
    const lead = !!auth.lead || mine.some((x) => /lead|manager|owner/i.test(x.role ?? ""));
    const myPlaces = new Set(mine.map((x) => x.listing || x.site).filter(Boolean));
    const visible = (x: (typeof shifts)[number]) =>
      !x.staffId || myIds.has(x.staffId) // open shifts carry no one's details
      || vis === "all"
      || (vis === "leads" && lead)
      || (vis === "team" && myPlaces.has(x.listing || x.site));
    store.shifts = shifts.filter(visible) as typeof store.shifts;
    const shown = new Set((store.shifts as { staffId?: string | null }[]).map((x) => x.staffId).filter(Boolean));
    store.staff = store.staff.filter((m) => myIds.has(String(m.id)) || shown.has(String(m.id)));
  }
  res.json(store);
});

// PUT /api/rota — save the whole store (managers). Refuses non-compliant
// assignments; otherwise writes only what changed.
rota.put("/", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canManage(auth.role)) { res.status(403).json({ error: "Only a manager can change the rota" }); return; }
  const parsed = storeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const key = keyOf(auth.tenantId, auth.franchiseId);
  const { staff, shifts, sites, baseUpdatedAt } = parsed.data;

  const existingSnap = await db.collection("rotaShifts").where("rotaKey", "==", key).get();
  const existing = new Map(existingSnap.docs.map((d) => [d.get("id") as string, d]));
  const nameOf = new Map(staff.map((s) => [s.id, s.name]));

  // Compliance: every assignment that's new (or moved to a different person).
  const blocked: { shiftId: string; name: string; date: string; reason: string }[] = [];
  const checked = new Map<string, string | null>();
  for (const s of shifts) {
    if (!s.staffId) continue;
    const before = existing.get(s.id);
    if (before && before.get("staffId") === s.staffId) continue;
    const name = nameOf.get(s.staffId) ?? "";
    if (!name.trim()) continue;
    if (!checked.has(name)) checked.set(name, await staffRosterBlock(auth.tenantId, name, auth.franchiseId));
    const reason = checked.get(name);
    if (reason) blocked.push({ shiftId: s.id, name, date: s.date, reason });
  }
  if (blocked.length) {
    const first = blocked[0];
    res.status(409).json({
      error: blocked.length === 1 ? first.reason : `${first.reason} (${blocked.length} assignments can't be made — nothing was saved.)`,
      blocked,
    });
    return;
  }

  // Claim the new version atomically: only a save that started from the
  // current version may write. (A first save — nothing stored yet — always may.)
  const now = new Date().toISOString();
  const metaRef = db.collection("rotas").doc(key);
  const clash = await db.runTransaction(async (tx) => {
    const meta = await tx.get(metaRef);
    const cur = (meta.get("updatedAt") as string | undefined) ?? null;
    if (cur && baseUpdatedAt !== undefined && baseUpdatedAt !== cur) return cur;
    tx.set(metaRef, { tenantId: auth.tenantId, franchiseId: auth.franchiseId ?? null, staff, sites, updatedAt: now, updatedBy: req.user?.email ?? null });
    return null;
  });
  if (clash) {
    res.status(412).json({ error: "Someone else changed the rota since you opened it — their version has been loaded. Please make your change again.", updatedAt: clash });
    return;
  }
  const keep = new Set(shifts.map((s) => s.id));
  const ops: ((b: FirebaseFirestore.WriteBatch) => void)[] = [];
  for (const s of shifts) {
    const before = existing.get(s.id);
    // Clock-in/out times are stamped on the server by the clock (POST /clock)
    // — a manager's screen opened before someone clocked in doesn't have them
    // and mustn't erase them by saving.
    if (before && before.get("staffId") === s.staffId) {
      for (const f of ["in", "out", "clockedBreakMin"] as const) if (s[f] === undefined && before.get(f) !== undefined) (s as Record<string, unknown>)[f] = before.get(f);
    }
    if (before) {
      const { rotaKey: _k, tenantId: _t, franchiseId: _f, ...old } = before.data() as Record<string, unknown>;
      if (stable(old) === stable(s)) continue;
    }
    ops.push((b) => b.set(db.collection("rotaShifts").doc(shiftDocId(key, s.id)), { ...s, rotaKey: key, tenantId: auth.tenantId, franchiseId: auth.franchiseId ?? null }));
  }
  for (const [id, d] of existing) if (!keep.has(id)) ops.push((b) => b.delete(d.ref));
  for (let i = 0; i < ops.length; i += 450) {
    const batch = db.batch();
    for (const op of ops.slice(i, i + 450)) op(batch);
    await batch.commit();
  }
  res.json({ ok: true, updatedAt: now, written: ops.length });
});

// POST /api/rota/clock — the clock stamps the real in/out time on today's shift.
// It only ever reached this browser's copy of the rota, which the next sync (or
// a manager's save) replaced, so the Schedule's checked-in state and payroll's
// actual hours never saw it. Staff stamp their own shift; a manager clocking
// someone in from the board names them.
const clockSchema = z.object({
  field: z.enum(["in", "out"]),
  hm: z.string().regex(/^\d{2}:\d{2}$/),
  // On clock-out: minutes actually spent on break, so payroll uses the real
  // break rather than the planned one (acceptance d16s3).
  breakMin: z.number().int().min(0).max(1440).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().trim().max(120).optional(),
});
rota.post("/clock", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canRead(auth.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const parsed = clockSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const { field, hm, date } = parsed.data;
  const me = req.user?.uid ? await db.collection("users").doc(req.user.uid).get() : null;
  const name = (auth.role === "staff" ? String(me?.get("name") ?? "") : parsed.data.name ?? "").trim().toLowerCase();
  if (!name) { res.json({ stamped: false }); return; }
  const key = keyOf(auth.tenantId, auth.franchiseId);
  const [meta, day] = await Promise.all([
    db.collection("rotas").doc(key).get(),
    db.collection("rotaShifts").where("rotaKey", "==", key).where("date", "==", date).get(),
  ]);
  const ids = new Set(((meta.get("staff") as { id: string; name?: string }[] | undefined) ?? []).filter((s) => String(s.name ?? "").trim().toLowerCase() === name).map((s) => s.id));
  const mine = day.docs.filter((d) => ids.has(d.get("staffId") as string)).sort((a, b) => String(a.get("start")).localeCompare(String(b.get("start"))));
  // In: the first shift not yet clocked in. Out: the one they're clocked in on.
  const target = field === "in" ? mine.find((d) => !d.get("in")) ?? mine[0] : mine.find((d) => d.get("in") && !d.get("out")) ?? mine[mine.length - 1];
  if (!target) { res.json({ stamped: false }); return; }
  await target.ref.set({ [field]: hm, ...(field === "out" && parsed.data.breakMin !== undefined ? { clockedBreakMin: parsed.data.breakMin } : {}) }, { merge: true });
  res.json({ stamped: true, shiftId: target.get("id") });
});
