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
});
type UserProfile = { name?: string; phone?: string; address?: string; postcode?: string; marketingConsent?: boolean };

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
