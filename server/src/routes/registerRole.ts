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
  z.object({ role: z.literal("parent") }),
  z.object({
    role: z.enum(["company", "freelancer"]),
    businessName: z.string().trim().min(2).max(80),
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
    await userRef.set({ email: user.email ?? null, role: "parent", chosen: true });
    res.json({ role: "parent", tenantId: null });
    return;
  }

  const { role, businessName } = parsed.data;
  const tenantRef = db.collection("tenants").doc();
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
  });
  res.status(201).json({ role, tenantId: tenantRef.id, tenantName: businessName });
});
