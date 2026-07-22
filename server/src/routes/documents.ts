import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";

// Documents (Compliance) — the provider's document store: policies, risk
// assessments, insurance certificates. Operators upload & delete; staff read
// (they need the policies to hand). Files go through the existing /api/uploads
// store — this holds the metadata + the resulting url (or an external link).
export const documents = Router();
const col = db.collection("documents");
const canManage = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";
const canRead = (role: Role) => role === "staff" || canManage(role);

const docSchema = z.object({
  title: z.string().trim().min(1).max(160),
  category: z.string().trim().min(1).max(60),
  url: z.string().trim().min(1).max(600),
  fileType: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(1_000).optional(),
});

function readScope(req: Request, res: Response): string | null {
  const auth = req.auth!;
  if (auth.role === "platform") {
    const t = typeof req.query.tenantId === "string" ? req.query.tenantId : null;
    if (!t) { res.status(400).json({ error: "Platform: pass ?tenantId=" }); return null; }
    return t;
  }
  if (!canRead(auth.role) || !auth.tenantId) { res.status(403).json({ error: "Requires an operator or staff account" }); return null; }
  return auth.tenantId;
}

documents.get("/", async (req, res) => {
  const tenantId = readScope(req, res);
  if (!tenantId) return;
  const snap = await col.where("tenantId", "==", tenantId).get();
  const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { createdAt?: string })[];
  list.sort((a, b) => (`${b.createdAt ?? ""}` < `${a.createdAt ?? ""}` ? -1 : 1));
  res.json(list);
});

documents.post("/", async (req, res) => {
  const auth = req.auth!;
  if (!canManage(auth.role) || !auth.tenantId) { res.status(403).json({ error: "Requires an operator account" }); return; }
  const parsed = docSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const doc = { ...parsed.data, tenantId: auth.tenantId, uploadedBy: req.user?.email ?? "unknown", uploadedByName: req.user?.name ?? req.user?.email ?? "Operator", createdAt: new Date().toISOString() };
  const ref = await col.add(doc);
  res.status(201).json({ id: ref.id, ...doc });
});

documents.delete("/:id", async (req, res) => {
  const auth = req.auth!;
  if (!canManage(auth.role) || !auth.tenantId) { res.status(403).json({ error: "Requires an operator account" }); return; }
  const snap = await col.doc(req.params.id).get();
  if (!snap.exists || snap.data()!.tenantId !== auth.tenantId) { res.status(404).json({ error: "Document not found" }); return; }
  await snap.ref.delete();
  res.json({ ok: true });
});
