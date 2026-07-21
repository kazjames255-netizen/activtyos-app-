import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";

// ─────────────────────────────────────────────────────────────────────────
// Newsfeed (Communication) — a provider's announcements to their families
// ("Bring wellies tomorrow"). Operators + staff post to the whole tenant; a
// parent sees the feed of every provider they've booked with. Photos reuse
// the existing /api/uploads store. Distinct from Moments (photos OF a child):
// this is text the provider broadcasts.
// ─────────────────────────────────────────────────────────────────────────
export const posts = Router();
const col = db.collection("posts");
const canPost = (role: Role) => role === "staff" || role === "company" || role === "freelancer" || role === "franchise";
const canManage = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";

const postSchema = z.object({
  title: z.string().trim().max(160).optional(),
  body: z.string().trim().min(1).max(4_000),
  photoUrl: z.string().trim().max(600).optional(),
});

async function tenantName(tenantId: string) {
  const t = await db.collection("tenants").doc(tenantId).get();
  return (t.exists && (t.data()!.name as string)) || "Your activity provider";
}

// The distinct tenants a parent has any booking with — the providers whose
// feed they're entitled to see.
async function parentTenantIds(email: string) {
  const snap = await db.collection("bookings").where("email", "==", email).get();
  const ids = new Set<string>();
  for (const d of snap.docs) { const t = (d.data() as { tenantId?: string }).tenantId; if (t) ids.add(t); }
  return [...ids].slice(0, 10); // Firestore `in` cap
}

// GET /api/posts — role-aware. Parent: every booked provider's feed.
posts.get("/", async (req, res) => {
  const auth = req.auth!;
  if (auth.role === "parent") {
    const email = req.user?.email;
    if (!email) { res.status(400).json({ error: "Account has no email address" }); return; }
    const tenantIds = await parentTenantIds(email);
    if (!tenantIds.length) { res.json([]); return; }
    const snap = await col.where("tenantId", "in", tenantIds).get();
    const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { createdAt?: string })[];
    list.sort((a, b) => (`${b.createdAt ?? ""}` < `${a.createdAt ?? ""}` ? -1 : 1));
    res.json(list);
    return;
  }
  const tenantId = auth.role === "platform" ? (typeof req.query.tenantId === "string" ? req.query.tenantId : null) : auth.tenantId;
  if (!tenantId) { res.status(403).json({ error: "Requires a tenant account" }); return; }
  const snap = await col.where("tenantId", "==", tenantId).get();
  const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { createdAt?: string })[];
  list.sort((a, b) => (`${b.createdAt ?? ""}` < `${a.createdAt ?? ""}` ? -1 : 1));
  res.json(list);
});

posts.post("/", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canPost(auth.role)) { res.status(403).json({ error: "Requires an operator or staff account" }); return; }
  const parsed = postSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const doc = {
    ...parsed.data,
    tenantId: auth.tenantId,
    tenantName: await tenantName(auth.tenantId),
    audience: "all" as const,
    postedBy: req.user?.email ?? "unknown",
    postedByName: req.user?.name ?? req.user?.email ?? "Staff",
    createdAt: new Date().toISOString(),
  };
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

posts.delete("/:id", async (req, res) => {
  const o = await own(req, req.params.id);
  if (o.status !== 200) { res.status(o.status).json({ error: o.status === 403 ? "Only the provider can delete a post" : "Post not found" }); return; }
  await o.snap.ref.delete();
  res.json({ ok: true });
});
