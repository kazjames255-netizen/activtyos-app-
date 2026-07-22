import { Router } from "express";
import { z } from "zod";
import { db } from "../firebase";

// Account provisioning at signup — one shot, then locked:
//   {role: "parent"}                               → parent account
//   {role: "company"|"freelancer", businessName}   → creates the TENANT and
//                                                    links the account as its
//                                                    owner
// franchise and staff accounts are NOT self-selectable — they join an
// existing tenant through invite links (/api/invites), matching the product
// spec (Head Office invites franchises; operators invite staff).
export const registerRole = Router();

const schema = z.discriminatedUnion("role", [
  // Postcode is captured at signup so the customer browse can sort/filter by
  // distance without asking again. Optional — a parent can skip it.
  z.object({ role: z.literal("parent"), postcode: z.string().trim().max(12).optional() }),
  z.object({
    role: z.enum(["company", "freelancer"]),
    businessName: z.string().trim().min(2).max(80),
    // What parents see the provider called. The client resolves it (their own
    // name vs the business name) since the person's name lives only on the
    // Firebase profile; we store the result and the mode they picked.
    providerName: z.string().trim().min(1).max(80).optional(),
    providerNameMode: z.enum(["person", "business"]).optional(),
  }),
]);

registerRole.post("/", async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const user = req.user!;
  const userRef = db.collection("users").doc(user.uid);
  const snap = await userRef.get();
  if (snap.exists && snap.data()!.chosen) {
    res.status(409).json({ error: "Account type already set" });
    return;
  }

  if (parsed.data.role === "parent") {
    await userRef.set({
      email: user.email ?? null,
      role: "parent",
      chosen: true,
      ...(parsed.data.postcode ? { postcode: parsed.data.postcode } : {}),
    });
    res.json({ role: "parent", tenantId: null });
    return;
  }

  const { role, businessName, providerName, providerNameMode } = parsed.data;
  const tenantRef = db.collection("tenants").doc();
  const libRef = db.collection("libraries").doc(tenantRef.id);
  await db.runTransaction(async (tx) => {
    tx.set(tenantRef, {
      name: businessName,
      type: role,
      ownerUid: user.uid,
      createdAt: new Date().toISOString(),
      nextBid: 10312,
    });
    tx.set(userRef, {
      email: user.email ?? null,
      role,
      chosen: true,
      tenantId: tenantRef.id,
    });
    // Seed the library with the public-facing name chosen at onboarding, so
    // the storefront and Ratios roster read it from the very first load.
    tx.set(libRef, {
      tenantId: tenantRef.id,
      settings: {
        providerName: providerName || businessName,
        providerNameMode: providerNameMode ?? "business",
      },
    });
  });
  res.status(201).json({ role, tenantId: tenantRef.id, tenantName: businessName });
});
