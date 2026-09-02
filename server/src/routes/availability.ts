import { Router } from "express";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";
import { notifyTenantMember } from "../lib/notify";

// ── Availability requests ───────────────────────────────────────────────────
// An operator asks a specific staff member to submit their availability for a
// window (a named week, a date range, or their standing pattern). The staff
// member sees the request on their "My availability" page and submits against
// it. Tenant-scoped; the staff match is by verified email on the token.
//   POST   /api/availability/requests        (operator) create a request
//   GET    /api/availability/requests         (operator) list this tenant's
//   DELETE /api/availability/requests/:id      (operator) withdraw one
//   GET    /api/availability/mine              (staff)   my requests + pattern
//   PUT    /api/availability/mine              (staff)   save pattern + mark done
export const availability = Router();
const reqs = db.collection("availabilityRequests");
const patterns = db.collection("availabilityPatterns");
const canManage = (r: Role) => r === "company" || r === "franchise" || r === "freelancer";
const lc = (s: string) => s.trim().toLowerCase();

const windowSchema = z.object({
  kind: z.enum(["week", "range", "ongoing", "camp"]),
  label: z.string().trim().max(80),
  from: z.string().max(10).optional(),
  to: z.string().max(10).optional(),
});
// When the request is for a specific listing/camp, we carry the assignment and
// the camp's operating hours so the staff page can frame + bound the grid.
const campSchema = z.object({
  listingName: z.string().trim().max(120),
  location: z.string().trim().max(160).optional(),
  open: z.string().max(8),
  close: z.string().max(8),
  weeks: z.number().int().min(1).max(26),
  startDate: z.string().max(10), // Monday of week 1
});
const createSchema = z.object({
  staffEmail: z.string().trim().email().max(160),
  staffName: z.string().trim().max(80).optional(),
  window: windowSchema,
  camp: campSchema.optional(),
  note: z.string().trim().max(500).optional(),
});

// operator → create a request for a staff member
availability.post("/requests", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canManage(auth.role)) { res.status(403).json({ error: "Requires an operator account" }); return; }
  const p = createSchema.safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: p.error.issues }); return; }
  const doc = {
    tenantId: auth.tenantId,
    staffEmail: lc(p.data.staffEmail),
    staffName: p.data.staffName ?? null,
    window: p.data.window,
    camp: p.data.camp ?? null,
    note: p.data.note ?? "",
    status: "pending" as const,
    createdAt: new Date().toISOString(),
    createdBy: req.user?.email ?? null,
  };
  const ref = await reqs.add(doc);
  // In-app bell for that staff member only — a nudge to complete their availability.
  await notifyTenantMember(auth.tenantId, doc.staffEmail, {
    category: "calendar",
    title: doc.camp ? `Availability needed — ${doc.camp.listingName}` : "Availability requested",
    body: doc.camp ? `You've been assigned to ${doc.camp.listingName}. Add the days & hours you can work across the ${doc.camp.weeks} weeks.` : `Please add your availability for ${doc.window.label}.`,
    href: "/staff/availability",
    ref: ref.id,
  });
  res.status(201).json({ id: ref.id, ...doc });
});

// operator → list this tenant's requests
availability.get("/requests", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canManage(auth.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const snap = await reqs.where("tenantId", "==", auth.tenantId).get();
  const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
    .sort((a, b) => (`${(a as { createdAt?: string }).createdAt}` < `${(b as { createdAt?: string }).createdAt}` ? 1 : -1));
  res.json(list);
});

// operator → withdraw a request
availability.delete("/requests/:id", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canManage(auth.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const s = await reqs.doc(req.params.id).get();
  if (!s.exists || s.data()!.tenantId !== auth.tenantId) { res.status(404).json({ error: "Not found" }); return; }
  await s.ref.delete();
  res.json({ ok: true });
});

// staff → my requests (matched by email) + my saved pattern
availability.get("/mine", async (req, res) => {
  const auth = req.auth!;
  const email = lc(req.user?.email ?? "");
  if (!auth.tenantId || !email) { res.status(403).json({ error: "Forbidden" }); return; }
  const snap = await reqs.where("tenantId", "==", auth.tenantId).get();
  const requests = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
    .filter((r) => `${(r as { staffEmail?: string }).staffEmail}` === email)
    .sort((a, b) => (`${(a as { createdAt?: string }).createdAt}` < `${(b as { createdAt?: string }).createdAt}` ? 1 : -1));
  const pat = await patterns.doc(`${auth.tenantId}_${email}`).get();
  res.json({ requests, pattern: pat.exists ? pat.data() : null });
});

// staff → save my availability pattern and mark my pending requests submitted
const daySchema = z.object({ on: z.boolean(), from: z.string().max(8), to: z.string().max(8) });
const saveSchema = z.object({
  days: z.record(z.string(), daySchema).optional(),  // standing weekly pattern (mon..sun)
  grid: z.record(z.string(), daySchema).optional(),  // per-date grid (camp requests)
  note: z.string().max(1000).optional(),
});
availability.put("/mine", async (req, res) => {
  const auth = req.auth!;
  const email = lc(req.user?.email ?? "");
  if (!auth.tenantId || !email) { res.status(403).json({ error: "Forbidden" }); return; }
  const p = saveSchema.safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: p.error.issues }); return; }
  const now = new Date().toISOString();
  await patterns.doc(`${auth.tenantId}_${email}`).set(
    {
      tenantId: auth.tenantId, staffEmail: email, staffName: req.user?.name ?? null,
      ...(p.data.days ? { days: p.data.days } : {}),
      ...(p.data.grid ? { grid: p.data.grid } : {}),
      note: p.data.note ?? "", submittedAt: now,
    },
    { merge: true },
  );
  const snap = await reqs.where("tenantId", "==", auth.tenantId).get();
  await Promise.all(
    snap.docs
      .filter((d) => `${d.data().staffEmail}` === email && d.data().status === "pending")
      .map((d) => d.ref.update({ status: "submitted", submittedAt: now })),
  );
  res.json({ ok: true, submittedAt: now });
});
