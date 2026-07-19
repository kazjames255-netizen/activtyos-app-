import { Router, type Response } from "express";
import { z } from "zod";
import { db } from "../firebase";
import { canWrite, operatorScope } from "../middleware/role";
import { platformFallback, stripe, toPence, webUrl } from "../lib/stripe";
import { fromDoc, toDoc, type BookingDoc } from "../lib/bookingDoc";
import { bookingDocId } from "./bookings";

// ─────────────────────────────────────────────────────────────────────────
// Payments — Stripe Connect (build item 7).
//
// Operator side: connect/resume Express onboarding, see connection status
// and the tenant's payment records (ActivityOS records every payment and
// refund for oversight — the money itself never touches the platform).
//
// Parent side: POST /checkout {refs} creates ONE PaymentIntent for the
// bookings (a family pays a basket at once) as a DIRECT CHARGE on the
// provider's connected account; /checkout/{id}/confirm verifies with
// Stripe and flips the bookings to Paid. The client only ever gets a
// client secret — amounts are computed here from the booking records.
// ─────────────────────────────────────────────────────────────────────────

export const payments = Router();

const paymentsCol = db.collection("payments");
const tenantsCol = db.collection("tenants");

function needStripe(res: Response) {
  if (stripe) return stripe;
  res.status(503).json({ error: "Payments aren't configured (no STRIPE_SECRET_KEY on the server)" });
  return null;
}

// Stripe's own messages are actionable ("you've not signed up for Connect",
// "this account can't take charges yet") — surface them, don't 500.
function stripeFail(res: Response, e: unknown) {
  const msg = e instanceof Error ? e.message : "Stripe request failed";
  console.error("[payments]", msg);
  res.status(502).json({ error: `Stripe: ${msg}` });
}

/** Bookings a parent may pay for: confirmed places, or operator invoices. */
const payable = (b: { status: string; pay: string }) =>
  b.pay !== "Paid" &&
  b.pay !== "Refunded" &&
  (b.status === "Confirmed" || b.pay === "Invoice sent");

// POST /api/payments/connect — create (or resume onboarding for) the
// tenant's Express account; returns the hosted onboarding URL.
payments.post("/connect", async (req, res) => {
  const s = needStripe(res);
  if (!s) return;
  const auth = req.auth!;
  if (!canWrite(auth.role) || !auth.tenantId) {
    res.status(403).json({ error: "Requires an operator account with a tenant" });
    return;
  }
  const tenantRef = tenantsCol.doc(auth.tenantId);
  const tenant = await tenantRef.get();
  if (!tenant.exists) {
    res.status(400).json({ error: "Your tenant no longer exists" });
    return;
  }
  try {
    let accountId: string | undefined = tenant.data()!.stripeAccountId;
    if (!accountId) {
      const account = await s.accounts.create({
        type: "express",
        country: "GB",
        email: req.user?.email ?? undefined,
        metadata: { tenantId: auth.tenantId },
        business_profile: { name: tenant.data()!.name },
        // Capabilities must be REQUESTED explicitly — an Express account
        // without card_payments completes onboarding but then rejects every
        // charge ("cannot create a charge … without the card_payments
        // capability").
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      });
      accountId = account.id;
      await tenantRef.update({ stripeAccountId: accountId });
    } else {
      // Repair accounts created before capabilities were requested — the
      // onboarding link below then collects anything newly required.
      const account = await s.accounts.retrieve(accountId);
      if (!account.capabilities?.card_payments) {
        await s.accounts.update(accountId, {
          capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
        });
      }
    }
    const link = await s.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      // Both return to Finance — /status tells the UI how far they got.
      refresh_url: `${webUrl}/freelancer/finance`,
      return_url: `${webUrl}/freelancer/finance`,
    });
    res.json({ url: link.url, accountId });
  } catch (e) {
    stripeFail(res, e);
  }
});

// GET /api/payments/status — how connected the tenant is.
payments.get("/status", async (req, res) => {
  const s = needStripe(res);
  if (!s) return;
  const scope = operatorScope(req, res);
  if (!scope || !scope.tenantId) {
    if (scope) res.status(403).json({ error: "Requires a tenant account" });
    return;
  }
  const tenant = await tenantsCol.doc(scope.tenantId).get();
  const accountId: string | undefined = tenant.data()?.stripeAccountId;
  if (!accountId) {
    res.json({ connected: false, platformFallback });
    return;
  }
  try {
    const account = await s.accounts.retrieve(accountId);
    res.json({
      connected: true,
      accountId,
      // "Can take card payments" = the capability is ACTIVE, not merely
      // charges_enabled (which can be true while card_payments was never
      // requested/granted).
      chargesEnabled: account.charges_enabled && account.capabilities?.card_payments === "active",
      detailsSubmitted: account.details_submitted,
      payoutsEnabled: account.payouts_enabled,
      platformFallback,
    });
  } catch (e) {
    stripeFail(res, e);
  }
});

// GET /api/payments — the tenant's payment & refund records (oversight).
payments.get("/", async (req, res) => {
  const scope = operatorScope(req, res);
  if (!scope) return;
  let q = paymentsCol as FirebaseFirestore.Query;
  if (scope.role === "platform") {
    const t = typeof req.query.tenantId === "string" ? req.query.tenantId : null;
    if (t) q = q.where("tenantId", "==", t);
  } else {
    q = q.where("tenantId", "==", scope.tenantId);
  }
  const snap = await q.get();
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  list.sort((a, b) => (((a as { createdAt?: string }).createdAt ?? "") < ((b as { createdAt?: string }).createdAt ?? "") ? 1 : -1));
  res.json(list);
});

const checkoutSchema = z.object({ refs: z.array(z.string().min(1)).min(1).max(20) });

// POST /api/payments/checkout — the signed-in parent starts paying for
// their bookings (one PaymentIntent for the lot).
payments.post("/checkout", async (req, res) => {
  const s = needStripe(res);
  if (!s) return;
  const email = req.user?.email;
  if (!email) {
    res.status(400).json({ error: "Account has no email address" });
    return;
  }
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  // Email-scoped lookup — a ref from another family is simply never found.
  const snaps = await Promise.all(
    parsed.data.refs.map((ref) =>
      db.collection("bookings").where("email", "==", email).where("ref", "==", ref).limit(1).get(),
    ),
  );
  const bookings = snaps.filter((x) => !x.empty).map((x) => fromDoc(x.docs[0].data() as BookingDoc));
  if (bookings.length !== parsed.data.refs.length) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  const tenantId = bookings[0].tenantId!;
  if (bookings.some((b) => b.tenantId !== tenantId)) {
    res.status(400).json({ error: "These bookings belong to different providers — pay them separately" });
    return;
  }
  const notPayable = bookings.find((b) => !payable(b));
  if (notPayable) {
    res.status(409).json({
      error:
        notPayable.pay === "Paid"
          ? `Booking ${notPayable.ref} is already paid`
          : `Booking ${notPayable.ref} isn't ready to pay (${notPayable.status} / ${notPayable.pay})`,
    });
    return;
  }
  const amount = Math.round(bookings.reduce((sum, b) => sum + b.amount, 0) * 100) / 100;
  if (amount <= 0) {
    res.status(409).json({ error: "Nothing to pay" });
    return;
  }

  // Direct charge on the provider's connected account — the money lands in
  // THEIR Stripe balance. Falls back to the platform account in dev only.
  const tenant = await tenantsCol.doc(tenantId).get();
  const accountId: string | undefined = tenant.data()?.stripeAccountId;
  let stripeAccount: string | null = null;
  if (accountId) {
    const account = await s.accounts.retrieve(accountId);
    // Both must hold: the account processes charges AND the card_payments
    // capability is active (charges_enabled alone isn't enough).
    if (account.charges_enabled && account.capabilities?.card_payments === "active")
      stripeAccount = accountId;
  }
  if (!stripeAccount && !platformFallback) {
    res.status(409).json({ error: "This provider can't take card payments yet — they haven't finished Stripe onboarding" });
    return;
  }

  let intent;
  try {
    intent = await s.paymentIntents.create(
      {
        amount: toPence(amount),
        currency: "gbp",
        automatic_payment_methods: { enabled: true },
        description: `${tenant.data()?.name ?? "ActivityOS"} — booking${bookings.length > 1 ? "s" : ""} ${bookings.map((b) => b.ref).join(", ")}`,
        metadata: { tenantId, refs: bookings.map((b) => b.ref).join(","), email },
        receipt_email: email,
      },
      stripeAccount ? { stripeAccount } : undefined,
    );
  } catch (e) {
    stripeFail(res, e);
    return;
  }
  const record = {
    tenantId,
    refs: bookings.map((b) => b.ref),
    email,
    amount,
    currency: "gbp",
    paymentIntentId: intent.id,
    stripeAccount,
    platformFallback: !stripeAccount,
    status: "created",
    createdAt: new Date().toISOString(),
  };
  const ref = await paymentsCol.add(record);
  res.status(201).json({
    paymentId: ref.id,
    clientSecret: intent.client_secret,
    stripeAccount,
    amount,
  });
});

// POST /api/payments/checkout/{id}/confirm — verify with Stripe and flip
// the bookings to Paid. Idempotent; only the paying family can call it.
payments.post("/checkout/:id/confirm", async (req, res) => {
  const s = needStripe(res);
  if (!s) return;
  const email = req.user?.email;
  const snap = await paymentsCol.doc(req.params.id).get();
  if (!snap.exists || snap.data()!.email !== email) {
    res.status(404).json({ error: "Payment not found" });
    return;
  }
  const rec = snap.data() as {
    tenantId: string;
    refs: string[];
    paymentIntentId: string;
    stripeAccount: string | null;
    status: string;
  };
  const intent = await s.paymentIntents.retrieve(
    rec.paymentIntentId,
    {},
    rec.stripeAccount ? { stripeAccount: rec.stripeAccount } : undefined,
  );
  if (intent.status !== "succeeded") {
    res.json({ status: intent.status, paid: false });
    return;
  }
  if (rec.status !== "succeeded") {
    const batch = db.batch();
    for (const bookingRef of rec.refs) {
      const bSnap = await db.collection("bookings").doc(bookingDocId(rec.tenantId, bookingRef)).get();
      if (!bSnap.exists) continue;
      const b = fromDoc(bSnap.data() as BookingDoc);
      b.pay = "Paid";
      b.paymentIntentId = rec.paymentIntentId;
      b.stripeAccount = rec.stripeAccount;
      batch.set(bSnap.ref, toDoc(b));
    }
    batch.update(snap.ref, { status: "succeeded", paidAt: new Date().toISOString() });
    await batch.commit();
  }
  res.json({ status: "succeeded", paid: true, refs: rec.refs });
});
