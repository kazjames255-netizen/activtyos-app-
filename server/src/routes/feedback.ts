import { Router } from "express";
import { z } from "zod";
import { createHash } from "node:crypto";
import { db } from "../firebase";
import { normRef } from "../lib/bookingRef";

// Parent feedback / reviews. A parent leaves a rating + comment for a provider
// they've booked with (reached from the "How did we do?" prompt). Read back so
// the page can show what they've already sent. Operator-side viewing is later.
//   POST /api/my/feedback   — leave feedback
//   GET  /api/my/feedback   — my submitted feedback
export const feedback = Router();
const col = db.collection("feedback");
const lc = (s: string) => s.trim().toLowerCase();

const schema = z.object({
  tenantId: z.string().min(1).max(60),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
  listing: z.string().trim().max(160).optional(),
  ref: z.string().trim().max(60).optional(),
});

feedback.post("/", async (req, res) => {
  const email = lc(req.user?.email ?? "");
  if (!email) { res.status(403).json({ error: "Sign in to leave feedback" }); return; }
  const p = schema.safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: p.error.issues }); return; }
  // Only a family that has booked with the provider can review it, and the
  // review is pinned to the franchise that ran the booking — so it lands with
  // the right franchise even when two run a listing with the same name (d22s4).
  const mine = (await Promise.all([...new Set([email, (req.user?.email ?? "").trim()])].filter(Boolean)
    .map((e) => db.collection("bookings").where("tenantId", "==", p.data.tenantId).where("email", "==", e).get()))).flatMap((q) => q.docs);
  if (!mine.length) { res.status(403).json({ error: "You can review a provider once you've booked with them" }); return; }
  // Only a place that was actually taken counts: a cancelled, declined, waitlisted, offered or still-unapproved booking can't be reviewed.
  const eligible = mine.filter((d) => d.get("status") === "Confirmed");
  if (!eligible.length) { res.status(403).json({ error: "You can review a provider once you have a confirmed place with them" }); return; }
  const wantRef = p.data.ref ? normRef(p.data.ref) : "";
  const booking = (wantRef ? eligible.find((d) => normRef(d.get("ref")) === wantRef) : undefined)
    ?? (p.data.listing ? eligible.find((d) => d.get("listing") === p.data.listing) : undefined);
  if (wantRef && !booking) { res.status(403).json({ error: "That booking can't be reviewed (it must be a confirmed place of yours)" }); return; }
  // One review per booking: sending it again replaces the first (same id). With no booking named it is one per provider.
  const slot = booking ? String(booking.get("ref") ?? booking.id) : "provider";
  const id = createHash("sha256").update(`${email}|${p.data.tenantId}|${slot}`).digest("hex").slice(0, 32);
  const doc = {
    tenantId: p.data.tenantId,
    ...(booking ? { franchiseId: (booking.get("franchiseId") as string | undefined) ?? null, listingId: (booking.get("listingId") as string | undefined) ?? null } : {}),
    email,
    name: req.user?.name ?? null,
    rating: p.data.rating,
    comment: p.data.comment ?? "",
    listing: p.data.listing ?? null,
    ref: booking ? String(booking.get("ref") ?? "") || null : null,
    createdAt: new Date().toISOString(),
  };
  const prior = await col.doc(id).get();
  // Replacing keeps the provider's reply and the first-written date; the rating and words are the new ones.
  await col.doc(id).set({ ...doc, ...(prior.exists ? { createdAt: prior.get("createdAt") ?? doc.createdAt, updatedAt: doc.createdAt, ...(prior.get("reply") ? { reply: prior.get("reply") } : {}) } : {}) });
  res.status(prior.exists ? 200 : 201).json({ id, ...doc });
});

feedback.get("/", async (req, res) => {
  const email = lc(req.user?.email ?? "");
  if (!email) { res.status(403).json({ error: "Sign in first" }); return; }
  const snap = await col.where("email", "==", email).get();
  const list = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
    .sort((a, b) => (`${(a as { createdAt?: string }).createdAt}` < `${(b as { createdAt?: string }).createdAt}` ? 1 : -1));
  res.json(list);
});
