import { Router } from "express";
import { z } from "zod";
import { db } from "../firebase";

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
});
type UserProfile = { name?: string; phone?: string; address?: string; postcode?: string; marketingConsent?: boolean; emergencyName?: string; emergencyPhone?: string };

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
    role: auth.role,
    tenantId: auth.tenantId ?? null,
  });
});

account.put("/", async (req, res) => {
  const uid = req.user?.uid;
  if (!uid) { res.status(400).json({ error: "No account" }); return; }
  const parsed = putSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  await db.collection("users").doc(uid).set({ ...parsed.data, profileUpdatedAt: new Date().toISOString() }, { merge: true });
  const doc = await db.collection("users").doc(uid).get();
  const u = doc.data()! as UserProfile;
  res.json({ name: u.name ?? "", phone: u.phone ?? "", address: u.address ?? "", postcode: u.postcode ?? "", marketingConsent: u.marketingConsent ?? false });
});
