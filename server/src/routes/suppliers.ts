import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";

// Suppliers — a saved contact directory (name, email, phone, address) the
// operator reuses when logging expenses, so they don't retype who they paid.
// Operators only, tenant-scoped, realtime. Platform reads with ?tenantId=.
export const suppliers = Router();
const col = db.collection("suppliers");
const canManage = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";

const supplierSchema = z.object({
  name: z.string().trim().min(1).max(160),
  email: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(60).optional(),
  address: z.string().trim().max(400).optional(),
  notes: z.string().trim().max(1_000).optional(),
});

function scope(req: Request, res: import("express").Response): string | null {
  const auth = req.auth!;
  if (auth.role === "platform") {
    const t = typeof req.query.tenantId === "string" ? req.query.tenantId : null;
    if (!t) { res.status(400).json({ error: "Platform: pass ?tenantId=" }); return null; }
    return t;
  }
  if (!canManage(auth.role) || !auth.tenantId) { res.status(403).json({ error: "Requires an operator account" }); return null; }
  return auth.tenantId;
}

suppliers.get("/", async (req, res) => {
  const tenantId = scope(req, res);
  if (!tenantId) return;
  const snap = await col.where("tenantId", "==", tenantId).get();
  const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { name?: string })[];
  list.sort((a, b) => `${a.name ?? ""}`.localeCompare(`${b.name ?? ""}`));
  res.json(list);
});

suppliers.post("/", async (req, res) => {
  const auth = req.auth!;
  if (!canManage(auth.role) || !auth.tenantId) { res.status(403).json({ error: "Requires an operator account" }); return; }
  const parsed = supplierSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const doc = { ...parsed.data, tenantId: auth.tenantId, createdBy: req.user?.email ?? "unknown", createdAt: new Date().toISOString() };
  const ref = await col.add(doc);
  res.status(201).json({ id: ref.id, ...doc });
});

async function own(req: Request, id: string) {
  const auth = req.auth!;
  if (!canManage(auth.role) || !auth.tenantId) return { status: 403 as const };
  const snap = await col.doc(id).get();
  if (!snap.exists || snap.data()!.tenantId !== auth.tenantId) return { status: 404 as const };
  return { status: 200 as const, snap };
}

suppliers.put("/:id", async (req, res) => {
  const o = await own(req, req.params.id);
  if (o.status !== 200) { res.status(o.status).json({ error: o.status === 403 ? "Requires an operator account" : "Supplier not found" }); return; }
  const parsed = supplierSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  await o.snap.ref.set(parsed.data, { merge: true });
  const after = await o.snap.ref.get();
  res.json({ id: after.id, ...after.data() });
});

suppliers.delete("/:id", async (req, res) => {
  const o = await own(req, req.params.id);
  if (o.status !== 200) { res.status(o.status).json({ error: o.status === 403 ? "Requires an operator account" : "Supplier not found" }); return; }
  await o.snap.ref.delete();
  res.json({ ok: true });
});
