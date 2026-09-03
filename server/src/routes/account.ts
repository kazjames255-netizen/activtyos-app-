import { Router } from "express";
import { z } from "zod";
import { db } from "../firebase";
import { fromDoc, type BookingDoc } from "../lib/bookingDoc";

// Account (shared, every portal) — the signed-in user's own profile. Email and
// the base identity come from the verified Firebase token; the editable extras
// (display name, phone, marketing consent) live on the users doc. Password and
// sign-out are Firebase client operations — the UI does those directly.
export const account = Router();

const putSchema = z.object({
  name: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  address: z.string().trim().max(300).optional(),
  postcode: z.string().trim().max(16).optional(),
  marketingConsent: z.boolean().optional(),
  // A family-level emergency contact — the same across all their children, so
  // it's captured once here rather than re-typed on every child profile.
  emergencyName: z.string().trim().max(120).optional(),
  emergencyPhone: z.string().trim().max(40).optional(),
  // UI language preference (follows the user across devices).
  locale: z.string().trim().max(8).optional(),
  // Franchise only — the franchise's own business name + territory (e.g. "London").
  franchiseName: z.string().trim().max(120).optional(),
  franchiseArea: z.string().trim().max(120).optional(),
  // Franchise territory map — one or more drawn areas + an agreed/draft status.
  // Points are {lat,lng} OBJECTS, not [lat,lng] tuples: Firestore forbids nested
  // arrays, so a polygon ring can't be an array-of-arrays.
  franchiseTerritory: z.object({
    areas: z.array(z.object({
      id: z.string().max(40),
      name: z.string().max(80),
      color: z.string().max(16),
      rings: z.array(z.object({ lat: z.number(), lng: z.number() })).max(4000),
    })).max(50),
    // draft = franchise still drawing · proposed = submitted, awaiting HO · agreed = HO approved.
    status: z.enum(["draft", "proposed", "agreed"]).optional(),
  }).optional(),
});
type Territory = { areas: { id: string; name: string; color: string; rings: { lat: number; lng: number }[] }[]; status?: "draft" | "proposed" | "agreed" };
type UserProfile = { name?: string; phone?: string; address?: string; postcode?: string; marketingConsent?: boolean; emergencyName?: string; emergencyPhone?: string; locale?: string; franchiseName?: string; franchiseArea?: string; franchiseTerritory?: Territory };

account.get("/", async (req, res) => {
  const auth = req.auth!;
  const uid = req.user?.uid;
  if (!uid) { res.status(400).json({ error: "No account" }); return; }
  const doc = await db.collection("users").doc(uid).get();
  const u = (doc.exists ? doc.data()! : {}) as UserProfile;
  res.json({
    email: req.user?.email ?? null,
    name: u.name ?? req.user?.name ?? "",
    phone: u.phone ?? "",
    address: u.address ?? "",
    postcode: u.postcode ?? "",
    marketingConsent: u.marketingConsent ?? false,
    emergencyName: u.emergencyName ?? "",
    emergencyPhone: u.emergencyPhone ?? "",
    locale: u.locale ?? "en",
    franchiseName: u.franchiseName ?? "",
    franchiseArea: u.franchiseArea ?? "",
    franchiseTerritory: u.franchiseTerritory ?? null,
    role: auth.role,
    tenantId: auth.tenantId ?? null,
  });
});

account.put("/", async (req, res) => {
  const auth = req.auth!;
  const uid = req.user?.uid;
  if (!uid) { res.status(400).json({ error: "No account" }); return; }
  const parsed = putSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const data = parsed.data;
  // Territory agreement is HEAD-OFFICE-ONLY: a franchise can draw/propose its
  // border but can never mark it "agreed" itself. Coerce their status to
  // proposed (has areas) or draft (none) regardless of what the client sent.
  if (auth.role === "franchise" && data.franchiseTerritory) {
    data.franchiseTerritory.status = data.franchiseTerritory.areas.length ? "proposed" : "draft";
  }
  await db.collection("users").doc(uid).set({ ...data, profileUpdatedAt: new Date().toISOString() }, { merge: true });
  const doc = await db.collection("users").doc(uid).get();
  const u = doc.data()! as UserProfile;
  res.json({ name: u.name ?? "", phone: u.phone ?? "", address: u.address ?? "", postcode: u.postcode ?? "", marketingConsent: u.marketingConsent ?? false });
});

// POST /api/account/deactivate — parent self-service soft close. Records the
// intent, stops marketing, and hard-GATES on outstanding money server-side (the
// client gate is UX only — never trust it). Memberships are cancelled by the
// client first (existing /api/my/memberships/cancel per provider).
//   OWED (Amir), see docs/account-deactivation-handoff.md: actually BLOCK login
//   (admin.auth().updateUser(uid,{disabled:true})), reactivate-on-sign-in within
//   a 30-day grace window, wallet forfeiture/refund policy, and record retention.
account.post("/deactivate", async (req, res) => {
  const uid = req.user?.uid;
  const email = req.user?.email;
  if (!uid || !email) { res.status(400).json({ error: "No account" }); return; }
  // Outstanding balance = live (not cancelled/declined) bookings that aren't paid.
  const snap = await db.collection("bookings").where("email", "==", email).get();
  const unpaid = snap.docs
    .map((d) => fromDoc(d.data() as BookingDoc))
    .filter((b) => b.status !== "Cancelled" && b.status !== "Declined" && b.pay !== "Paid" && (b.amount ?? 0) > 0);
  if (unpaid.length) {
    const total = unpaid.reduce((n, b) => n + (b.amount ?? 0), 0);
    res.status(409).json({ error: "Please settle your outstanding balance before closing your account.", outstanding: Math.round(total * 100) / 100, count: unpaid.length });
    return;
  }
  const reason = typeof (req.body as { reason?: unknown })?.reason === "string" ? (req.body as { reason: string }).reason.trim().slice(0, 500) : "";
  await db.collection("users").doc(uid).set({
    deactivatedAt: new Date().toISOString(),
    deactivationReason: reason || null,
    marketingConsent: false, // stop all marketing immediately
  }, { merge: true });
  res.json({ ok: true });
});
