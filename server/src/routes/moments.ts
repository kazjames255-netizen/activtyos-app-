import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";
import { countsTowardCapacity, type BlockDoc } from "../lib/blockDomain";
import { fromDoc, type BookingDoc } from "../lib/bookingDoc";

// ─────────────────────────────────────────────────────────────────────────
// Moments (Pupils) — the photos a provider shares of the day, and the feed a
// parent sees of their own child.
//
// The rule that governs everything here: PHOTO CONSENT. A child may only be
// tagged in a moment if their record has `photoConsent: true`. It's enforced
// server-side on every create/edit — a child whose family said "no photos"
// can never appear, regardless of what the client sends.
//
// Operators and staff post; a parent sees moments featuring their children
// (cross-provider — a family's feed spans everywhere their child goes).
// ─────────────────────────────────────────────────────────────────────────

export const moments = Router();

const col = db.collection("moments");
const canPost = (role: Role) =>
  role === "staff" || role === "company" || role === "freelancer" || role === "franchise";
const canManage = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";

const momentBase = z.object({
  photoUrl: z.string().max(500).optional(), // uploaded via /api/uploads first; optional so a text-only highlight can be shared
  caption: z.string().trim().max(500).optional(),
  activity: z.string().trim().max(60).optional(), // e.g. "Arts & crafts", "Swimming"
  photoType: z.enum(["child", "work"]).default("child"), // "work" = a photo of their work (no faces → no consent needed)
  date: z.string().max(10).optional(),
  blockId: z.string().max(60).optional(),
  listingId: z.string().max(60).optional(),
  childIds: z.array(z.string().max(60)).max(30).default([]),
});
const momentSchema = momentBase.refine((d) => d.photoUrl || d.caption, { message: "Add a photo or a highlight" });

// Resolve tagged children → names. A CHILD photo requires photo consent for
// every tagged child; a WORK photo (no faces in shot) does not.
async function resolveChildren(
  childIds: string[],
  requireConsent: boolean,
): Promise<{ ok: true; names: Record<string, string> } | { ok: false; blocked: string }> {
  if (!childIds.length) return { ok: true, names: {} };
  const docs = await db.getAll(...childIds.map((id) => db.collection("children").doc(id)));
  const names: Record<string, string> = {};
  for (const d of docs) {
    if (!d.exists) return { ok: false, blocked: "a child who no longer exists" };
    const c = d.data() as { name?: string; photoConsent?: boolean };
    if (requireConsent && c.photoConsent !== true) return { ok: false, blocked: c.name ?? "a child" };
    names[d.id] = c.name ?? "";
  }
  return { ok: true, names };
}

const todayIso = () => new Date().toISOString().slice(0, 10);

// POST /api/moments — share a moment (operators + staff).
moments.post("/", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canPost(auth.role)) {
    res.status(403).json({ error: "Requires an operator or staff account with a tenant" });
    return;
  }
  const parsed = momentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const consent = await resolveChildren(parsed.data.childIds, parsed.data.photoType !== "work");
  if (!consent.ok) {
    res.status(409).json({ error: `${consent.blocked} can't be tagged in a child photo — no photo consent on file. Use “their work” instead.` });
    return;
  }
  const doc = {
    ...parsed.data,
    date: parsed.data.date ?? todayIso(),
    childNames: parsed.data.childIds.map((id) => consent.names[id] ?? ""),
    tenantId: auth.tenantId,
    postedBy: req.user?.email ?? req.user?.uid ?? "unknown",
    postedByName: req.user?.name ?? req.user?.email ?? "Staff",
    createdAt: new Date().toISOString(),
  };
  const ref = await col.add(doc);
  res.status(201).json({ id: ref.id, ...doc });
});

// GET /api/moments — role-aware:
//   parent          → moments featuring THEIR children (any provider)
//   operator/staff  → the tenant's moments (optional ?date= / ?childId=)
moments.get("/", async (req, res) => {
  const auth = req.auth!;

  if (auth.role === "parent") {
    const kids = await db.collection("children").where("parentUid", "==", req.user!.uid).get();
    const ids = kids.docs.map((d) => d.id).slice(0, 10); // Firestore array-contains-any cap
    if (!ids.length) {
      res.json([]);
      return;
    }
    const snap = await col.where("childIds", "array-contains-any", ids).get();
    const list = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
      .sort((a, b) => (`${(b as { createdAt?: string }).createdAt}` < `${(a as { createdAt?: string }).createdAt}` ? -1 : 1));
    res.json(list);
    return;
  }

  const tenantId =
    auth.role === "platform" ? (typeof req.query.tenantId === "string" ? req.query.tenantId : null) : auth.tenantId;
  if (!tenantId) {
    res.status(auth.role === "platform" ? 400 : 403).json({ error: "No tenant" });
    return;
  }
  let q = col.where("tenantId", "==", tenantId) as FirebaseFirestore.Query;
  if (typeof req.query.childId === "string") q = q.where("childIds", "array-contains", req.query.childId);
  const snap = await q.get();
  let list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { id: string; date?: string; createdAt?: string })[];
  if (typeof req.query.date === "string") list = list.filter((x) => x.date === req.query.date);
  list.sort((a, b) => (`${b.createdAt}` < `${a.createdAt}` ? -1 : 1));
  res.json(list);
});

// GET /api/moments/taggable?date= — the day's booked children who HAVE photo
// consent (childId + name). The post form offers only these, so a
// non-consented child is never even presented as an option.
moments.get("/taggable", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canPost(auth.role)) {
    res.status(403).json({ error: "Requires an operator or staff account" });
    return;
  }
  const date = typeof req.query.date === "string" && req.query.date ? req.query.date : todayIso();
  const listingId = typeof req.query.listingId === "string" ? req.query.listingId : "";
  const byListing = !!listingId; // a listing shows EVERYONE ever booked on it; no listing = that date's children
  const blocks = await db.collection("blocks").where("tenantId", "==", auth.tenantId).get();
  const relevant = blocks.docs
    .map((d) => ({ id: d.id, block: d.data() as BlockDoc }))
    .filter(({ block }) => (byListing ? block.listingId === listingId : block.sessions.some((s) => s.date === date)));
  if (!relevant.length) {
    res.json([]);
    return;
  }
  const bookingSnaps = await Promise.all(
    relevant.map(({ id }) => db.collection("bookings").where("blockId", "==", id).get()),
  );
  const childIds = new Set<string>();
  for (const snap of bookingSnaps)
    for (const d of snap.docs) {
      const b = fromDoc(d.data() as BookingDoc);
      if (b.childId && countsTowardCapacity(b.status) && b.status !== "Offered" && (byListing || !b.days || b.days.includes(date)))
        childIds.add(b.childId);
    }
  const docs = childIds.size ? await db.getAll(...[...childIds].map((cid) => db.collection("children").doc(cid))) : [];
  // Return every booked child WITH their consent flag — a child photo can only
  // tag consented children, but a work photo can tag anyone (the client gates it
  // and the server enforces it on create).
  const taggable = docs
    .filter((d) => d.exists)
    .map((d) => ({ childId: d.id, name: (d.data() as { name?: string }).name ?? "", photoConsent: (d.data() as { photoConsent?: boolean }).photoConsent === true }))
    .sort((a, b) => (a.name < b.name ? -1 : 1));
  res.json(taggable);
});

async function ownMoment(req: Request, id: string) {
  const auth = req.auth!;
  if (!auth.tenantId) return { status: 403 as const };
  const snap = await col.doc(id).get();
  if (!snap.exists || snap.data()!.tenantId !== auth.tenantId) return { status: 404 as const };
  return { status: 200 as const, snap };
}

// PUT /api/moments/:id — edit caption/tags (operator or the poster). Re-runs
// the consent check on any newly tagged children.
moments.put("/:id", async (req, res) => {
  const own = await ownMoment(req, req.params.id);
  if (own.status !== 200) {
    res.status(own.status).json({ error: own.status === 403 ? "Requires an operator account" : "Moment not found" });
    return;
  }
  const auth = req.auth!;
  if (!canManage(auth.role) && own.snap.data()!.postedBy !== (req.user?.email ?? req.user?.uid)) {
    res.status(403).json({ error: "Only the provider or whoever posted it can edit this" });
    return;
  }
  const parsed = momentBase.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const patch: Record<string, unknown> = { ...parsed.data, updatedAt: new Date().toISOString() };
  if (parsed.data.childIds) {
    const requireConsent = (parsed.data.photoType ?? (own.snap.data()!.photoType as string | undefined)) !== "work";
    const consent = await resolveChildren(parsed.data.childIds, requireConsent);
    if (!consent.ok) {
      res.status(409).json({ error: `${consent.blocked} can't be tagged in a child photo — no photo consent on file.` });
      return;
    }
    patch.childNames = parsed.data.childIds.map((id: string) => consent.names[id] ?? "");
  }
  await own.snap.ref.set(patch, { merge: true });
  const after = await own.snap.ref.get();
  res.json({ id: after.id, ...after.data() });
});

// DELETE /api/moments/:id — operators only.
moments.delete("/:id", async (req, res) => {
  const own = await ownMoment(req, req.params.id);
  if (own.status !== 200) {
    res.status(own.status).json({ error: own.status === 403 ? "Requires an operator account" : "Moment not found" });
    return;
  }
  if (!canManage(req.auth!.role)) {
    res.status(403).json({ error: "Only the provider can delete a moment" });
    return;
  }
  await own.snap.ref.delete();
  res.json({ ok: true });
});
