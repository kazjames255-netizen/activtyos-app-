import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";

// Compliance (Documents & Compliance) — staff certifications and their expiry:
// DBS, safeguarding, paediatric first aid, insurance… The whole point is the
// expiry watch, so GET derives a status (valid / expiring / expired) and a
// summary the board leads with. Operators manage; staff read (their own board).
export const compliance = Router();
const col = db.collection("certifications");
const canManage = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";
const canRead = (role: Role) => role === "staff" || canManage(role);

// Days before expiry we start warning. UK childcare renewals (DBS, first aid)
// want lead time to rebook — 45 days is a sensible nudge.
const EXPIRING_DAYS = 45;

const certSchema = z.object({
  staffName: z.string().trim().min(1).max(120),
  type: z.string().trim().min(1).max(80),
  reference: z.string().trim().max(80).optional(),
  issued: z.string().max(10).optional(),
  expiry: z.string().max(10),
  documentUrl: z.string().trim().max(600).optional(),
  notes: z.string().trim().max(1_000).optional(),
});

function statusOf(expiry: string, today: string, soon: string): "expired" | "expiring" | "valid" {
  if (expiry < today) return "expired";
  if (expiry <= soon) return "expiring";
  return "valid";
}

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

compliance.get("/", async (req, res) => {
  const tenantId = readScope(req, res);
  if (!tenantId) return;
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + EXPIRING_DAYS * 86_400_000).toISOString().slice(0, 10);
  const snap = await col.where("tenantId", "==", tenantId).get();
  const items = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }) as Record<string, unknown> & { expiry?: string })
    .map((c) => ({ ...c, status: statusOf(`${c.expiry ?? "9999"}`, today, soon) }));
  // Soonest to expire first — the ones needing action rise to the top.
  items.sort((a, b) => (`${a.expiry ?? "9999"}` < `${b.expiry ?? "9999"}` ? -1 : 1));
  const summary = {
    total: items.length,
    expired: items.filter((c) => c.status === "expired").length,
    expiring: items.filter((c) => c.status === "expiring").length,
    valid: items.filter((c) => c.status === "valid").length,
  };
  res.json({ items, summary });
});

compliance.post("/", async (req, res) => {
  const auth = req.auth!;
  if (!canManage(auth.role) || !auth.tenantId) { res.status(403).json({ error: "Requires an operator account" }); return; }
  const parsed = certSchema.safeParse(req.body);
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

compliance.put("/:id", async (req, res) => {
  const o = await own(req, req.params.id);
  if (o.status !== 200) { res.status(o.status).json({ error: o.status === 403 ? "Requires an operator account" : "Certificate not found" }); return; }
  const parsed = certSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  await o.snap.ref.set(parsed.data, { merge: true });
  const after = await o.snap.ref.get();
  res.json({ id: after.id, ...after.data() });
});

compliance.delete("/:id", async (req, res) => {
  const o = await own(req, req.params.id);
  if (o.status !== 200) { res.status(o.status).json({ error: o.status === 403 ? "Requires an operator account" : "Certificate not found" }); return; }
  await o.snap.ref.delete();
  res.json({ ok: true });
});
