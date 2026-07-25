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
    // The pricing tier they chose at signup — seeds the subscription plan. A
    // "franchise" signup is still a company-type tenant (see role above).
    plan: z.enum(["freelancer", "company", "franchise"]).optional(),
    // Extras captured by the onboarding wizard — all optional, seeded straight
    // into the tenant's settings so Setup/storefront/invoices start populated.
    activityKinds: z.array(z.string().trim().max(40)).max(12).optional(),
    address: z.string().trim().max(400).optional(),
    postcode: z.string().trim().max(12).optional(),
    contactEmail: z.string().trim().max(160).optional(),
    phone: z.string().trim().max(40).optional(),
    logoUrl: z.string().trim().max(600).optional(),
    // Marketing attribution — where the operator first heard about ActivityOS.
    heardAbout: z.string().trim().max(60).optional(),
    // The `?ref=` code from the invite link they signed up through, if any.
    referredBy: z.string().trim().max(80).optional(),
    billing: z
      .object({
        bankName: z.string().trim().max(120).optional(),
        accountName: z.string().trim().max(120).optional(),
        sortCode: z.string().trim().max(12).optional(),
        accountNumber: z.string().trim().max(20).optional(),
      })
      .optional(),
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

  const { role, businessName, providerName, providerNameMode, activityKinds, address, postcode, logoUrl, billing, heardAbout, referredBy, plan, contactEmail, phone } = parsed.data;
  const tenantRef = db.collection("tenants").doc();
  const libRef = db.collection("libraries").doc(tenantRef.id);
  // Only carry the billing keys that were actually given (drop undefineds so we
  // never write `field: undefined` into Firestore).
  const billingSeed: Record<string, unknown> = {
    businessName,
    // Contact email defaults to the login email so there's always one to show
    // on invoices / the storefront; phone is optional.
    email: contactEmail || user.email || undefined,
    ...(phone ? { phone } : {}),
    ...(address ? { address } : {}),
    ...(logoUrl ? { logoUrl } : {}),
    ...(billing?.bankName ? { bankName: billing.bankName } : {}),
    ...(billing?.accountName ? { accountName: billing.accountName } : {}),
    ...(billing?.sortCode ? { sortCode: billing.sortCode } : {}),
    ...(billing?.accountNumber ? { accountNumber: billing.accountNumber } : {}),
  };
  await db.runTransaction(async (tx) => {
    tx.set(tenantRef, {
      name: businessName,
      type: role,
      ownerUid: user.uid,
      createdAt: new Date().toISOString(),
      nextBid: 10312,
      ...(postcode ? { postcode } : {}),
      ...(heardAbout ? { heardAbout } : {}),
      ...(referredBy ? { referredBy } : {}),
      // Fresh signups start un-subscribed → the portal gates them onto the
      // subscription page until they start a plan. (Pre-existing tenants have
      // no `subscription` field and are treated as active — never retro-gated.)
      subscription: { status: "none", plan: plan ?? (role === "company" ? "company" : "freelancer"), since: null },
    });
    tx.set(userRef, {
      email: user.email ?? null,
      role,
      chosen: true,
      tenantId: tenantRef.id,
    });
    // Seed the library with everything gathered at onboarding, so the
    // storefront, Ratios roster, Setup and invoices all read it from the very
    // first load rather than starting empty.
    tx.set(libRef, {
      tenantId: tenantRef.id,
      settings: {
        providerName: providerName || businessName,
        providerNameMode: providerNameMode ?? "business",
        ...(activityKinds?.length ? { activityKinds } : {}),
        ...(postcode ? { postcode } : {}),
        billing: billingSeed,
      },
    });
  });
  res.status(201).json({ role, tenantId: tenantRef.id, tenantName: businessName });
});
