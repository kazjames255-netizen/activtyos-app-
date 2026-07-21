import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";

// Trips & visits (Run the day) — the record for an off-site trip: where, when,
// who's going (children + staff), transport, the risk-assessment note and
// headcount. Staff and operators create; operators delete. Tenant-scoped.
export const trips = Router();
const col = db.collection("trips");
const canUse = (role: Role) => role === "staff" || role === "company" || role === "freelancer" || role === "franchise";
const canManage = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";

const tripSchema = z.object({
  destination: z.string().trim().min(1).max(160),
  date: z.string().max(10),
  departTime: z.string().max(8).optional(),
  returnTime: z.string().max(8).optional(),
  listingId: z.string().max(60).optional(),
  transport: z.string().trim().max(160).optional(),
  childNames: z.array(z.string().max(80)).max(200).default([]),
  staff: z.array(z.string().max(80)).max(50).default([]),
  headcount: z.number().int().nonnegative().optional(),
  riskAssessment: z.string().trim().max(4_000).optional(),
  consentObtained: z.boolean().default(false),
  notes: z.string().trim().max(2_000).optional(),
  status: z.enum(["planned", "completed", "cancelled"]).default("planned"),
});

trips.get("/", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canUse(auth.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const snap = await col.where("tenantId", "==", auth.tenantId).get();
  const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { date?: string })[];
  list.sort((a, b) => (`${b.date}` < `${a.date}` ? -1 : 1));
  res.json(list);
});

trips.post("/", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canUse(auth.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const parsed = tripSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const doc = { ...parsed.data, headcount: parsed.data.headcount ?? parsed.data.childNames.length, tenantId: auth.tenantId, createdBy: req.user?.email ?? "unknown", createdByName: req.user?.name ?? req.user?.email ?? "Staff", createdAt: new Date().toISOString() };
  const ref = await col.add(doc);
  res.status(201).json({ id: ref.id, ...doc });
});

async function own(req: Request, id: string) {
  const auth = req.auth!;
  if (!auth.tenantId || !canUse(auth.role)) return { status: 403 as const };
  const snap = await col.doc(id).get();
  if (!snap.exists || snap.data()!.tenantId !== auth.tenantId) return { status: 404 as const };
  return { status: 200 as const, snap };
}

trips.put("/:id", async (req, res) => {
  const o = await own(req, req.params.id);
  if (o.status !== 200) { res.status(o.status).json({ error: o.status === 403 ? "Forbidden" : "Trip not found" }); return; }
  const parsed = tripSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  await o.snap.ref.set({ ...parsed.data, updatedAt: new Date().toISOString() }, { merge: true });
  const after = await o.snap.ref.get();
  res.json({ id: after.id, ...after.data() });
});

trips.delete("/:id", async (req, res) => {
  const o = await own(req, req.params.id);
  if (o.status !== 200) { res.status(o.status).json({ error: o.status === 403 ? "Forbidden" : "Trip not found" }); return; }
  if (!canManage(req.auth!.role)) { res.status(403).json({ error: "Only the provider can delete a trip" }); return; }
  await o.snap.ref.delete();
  res.json({ ok: true });
});
