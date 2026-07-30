import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";
import { staffRosterBlock } from "../lib/staffPolicy";

// Schedule & rota (Run the day) — staff shifts. Operators build the rota;
// staff read it (they need to know when they're on). Tenant-scoped.
// Settings → Staff & workforce policy is enforced here: requireDBS /
// requireCompliance can refuse to roster someone whose checks aren't in order.
export const shifts = Router();
const col = db.collection("shifts");
const canManage = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";
const canRead = (role: Role) => role === "staff" || canManage(role);

const shiftSchema = z.object({
  staffId: z.string().max(60).optional(),
  staffName: z.string().trim().min(1).max(80),
  date: z.string().max(10),
  start: z.string().max(8),
  end: z.string().max(8),
  role: z.string().trim().max(80).optional(),
  listingId: z.string().max(60).optional(),
  notes: z.string().trim().max(500).optional(),
});

// GET /api/shifts?from=&to= — the rota (staff + operators read).
shifts.get("/", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canRead(auth.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const snap = await col.where("tenantId", "==", auth.tenantId).get();
  let list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { date?: string; start?: string })[];
  const from = typeof req.query.from === "string" ? req.query.from : null;
  const to = typeof req.query.to === "string" ? req.query.to : null;
  if (from) list = list.filter((x) => `${x.date}` >= from);
  if (to) list = list.filter((x) => `${x.date}` <= to);
  list.sort((a, b) => (`${a.date} ${a.start}` < `${b.date} ${b.start}` ? -1 : 1));
  res.json(list);
});

shifts.post("/", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canManage(auth.role)) { res.status(403).json({ error: "Requires an operator account" }); return; }
  const parsed = shiftSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const block = await staffRosterBlock(auth.tenantId, parsed.data.staffName);
  if (block) { res.status(409).json({ error: block }); return; }
  const doc = { ...parsed.data, tenantId: auth.tenantId, createdAt: new Date().toISOString() };
  const ref = await col.add(doc);
  res.status(201).json({ id: ref.id, ...doc });
});

async function own(req: Request, id: string) {
  const auth = req.auth!;
  if (!auth.tenantId || !canManage(auth.role)) return { status: 403 as const };
  const snap = await col.doc(id).get();
  if (!snap.exists || snap.data()!.tenantId !== auth.tenantId) return { status: 404 as const };
  return { status: 200 as const, snap };
}

shifts.put("/:id", async (req, res) => {
  const o = await own(req, req.params.id);
  if (o.status !== 200) { res.status(o.status).json({ error: o.status === 403 ? "Requires an operator account" : "Shift not found" }); return; }
  const parsed = shiftSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  // Re-rostering to a different person re-runs the compliance policy; edits
  // that just move times don't.
  if (parsed.data.staffName && parsed.data.staffName !== o.snap.data()!.staffName) {
    const block = await staffRosterBlock(req.auth!.tenantId!, parsed.data.staffName);
    if (block) { res.status(409).json({ error: block }); return; }
  }
  await o.snap.ref.set(parsed.data, { merge: true });
  const after = await o.snap.ref.get();
  res.json({ id: after.id, ...after.data() });
});

shifts.delete("/:id", async (req, res) => {
  const o = await own(req, req.params.id);
  if (o.status !== 200) { res.status(o.status).json({ error: o.status === 403 ? "Requires an operator account" : "Shift not found" }); return; }
  await o.snap.ref.delete();
  res.json({ ok: true });
});
