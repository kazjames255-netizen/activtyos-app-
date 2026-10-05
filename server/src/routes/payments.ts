import { Router, type Response } from "express";
import { z } from "zod";
import { db } from "../firebase";
import { canWrite, operatorScope, type Role, managerScope } from "../middleware/role";
import { platformFallback, stripe, toPence, webUrl } from "../lib/stripe";
import { retrieveConnected } from "../lib/connectedAccount";
import { autoEmailOn } from "../lib/autoEmails";
import { ensurePayDomains } from "../lib/payDomains";
import { fromDoc, toDoc, type BookingDoc } from "../lib/bookingDoc";
import { bookingDocId } from "./bookings";
import { settlePaymentRecord } from "../lib/settlePayment";
import { bookingForToken } from "../lib/bookingPayToken";
import { payable, balanceOf } from "../lib/payGate";
import { buildPayOptions } from "../lib/publicPayOptions";
import { BRAND } from "../lib/brand";

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

/** The portal an operator role lives in — Stripe has to send them back to
 *  their OWN portal, or PortalGuard bounces them on return. */
const portalOf = (role: Role): string =>
  role === "freelancer" || role === "franchise" ? role : "company";

function needStripe(res: Response) {
  if (stripe) return stripe;
  console.warn("[payments] Stripe is not configured (STRIPE_SECRET_KEY missing) — card payments disabled");
  res.status(503).json({ error: "Card payments are being set up — you can still take cash and bank-transfer bookings." });
  return null;
}

// Stripe's own messages are actionable ("you've not signed up for Connect",
// "this account can't take charges yet") — surface them, don't 500.
function stripeFail(res: Response, e: unknown) {
  const msg = e instanceof Error ? e.message : "Stripe request failed";
  console.error("[payments]", msg);
  res.status(502).json({ error: `Stripe: ${msg}` });
}


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
  // A franchise shares its head office's tenant Stripe account — it must NOT be
  // able to create/onboard/open it. Only the head office (company) owns payouts.
  if (auth.role === "franchise") {
    res.status(403).json({ error: "Your head office manages the payout (Stripe) account." });
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
    if (accountId) {
      // Gone (deleted / revoked / a test id under live keys) → cleared; make a new one below.
      const account = await retrieveConnected(s, auth.tenantId, accountId);
      if (!account) accountId = undefined;
      // Repair accounts created before capabilities were requested — the
      // onboarding link below then collects anything newly required.
      else if (!account.capabilities?.card_payments) {
        await s.accounts.update(accountId, {
          capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
        });
      }
    }
    if (!accountId) {
      // Matches the live Connect platform profile: Stripe carries negative-balance
      // liability and the provider gets the full Stripe Dashboard. An Express
      // account (platform-liable) contradicts that profile and Stripe refuses it
      // in live mode ("review the responsibilities of managing losses").
      const account = await s.accounts.create({
        controller: {
          losses: { payments: "stripe" },
          fees: { payer: "account" },
          requirement_collection: "stripe",
          stripe_dashboard: { type: "full" },
        },
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
    }
    // Return to the CALLER's own Finance page. These used to be hardcoded to
    // /freelancer/finance, which bounced a company or franchise operator into
    // a portal PortalGuard then blocked — they came back from Stripe to an
    // error instead of their payouts.
    const finance = `${webUrl}/${portalOf(auth.role)}/finance`;
    const link = await s.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      // Both return to Finance — /status tells the UI how far they got.
      refresh_url: finance,
      return_url: finance,
    });
    res.json({ url: link.url, accountId });
  } catch (e) {
    stripeFail(res, e);
  }
});

// POST /api/payments/dashboard — a one-time link into the provider's own
// Stripe dashboard, where they change bank details, see payouts and
// download statements. This is the "Manage" route AFTER onboarding: an
// account_onboarding link is for finishing setup, not for revisiting it.
payments.post("/dashboard", async (req, res) => {
  const s = needStripe(res);
  if (!s) return;
  const auth = req.auth!;
  if (!canWrite(auth.role) || !auth.tenantId) {
    res.status(403).json({ error: "Requires an operator account with a tenant" });
    return;
  }
  // Head office owns the Stripe account; a franchise can't open its dashboard.
  if (auth.role === "franchise") {
    res.status(403).json({ error: "Your head office manages the payout (Stripe) account." });
    return;
  }
  const tenant = await tenantsCol.doc(auth.tenantId).get();
  const accountId: string | undefined = tenant.data()?.stripeAccountId;
  if (!accountId) {
    res.status(409).json({ error: "Connect your payout account first" });
    return;
  }
  try {
    // Stripe only issues a login link once onboarding has been submitted;
    // before that the right destination is still the onboarding form.
    const account = await retrieveConnected(s, auth.tenantId, accountId);
    if (!account) {
      res.status(409).json({ error: "Connect your payout account first" });
      return;
    }
    if (!account.details_submitted) {
      const finance = `${webUrl}/${portalOf(auth.role)}/finance`;
      const link = await s.accountLinks.create({
        account: accountId, type: "account_onboarding",
        refresh_url: finance, return_url: finance,
      });
      res.json({ url: link.url, onboarding: true });
      return;
    }
    // Login links exist only for Express-dashboard accounts (the ones made
    // before the switch); full-dashboard accounts sign in to Stripe directly.
    if (account.controller?.stripe_dashboard?.type === "express" || account.type === "express") {
      const login = await s.accounts.createLoginLink(accountId);
      res.json({ url: login.url, onboarding: false });
    } else {
      res.json({ url: "https://dashboard.stripe.com/", onboarding: false });
    }
  } catch (e) {
    stripeFail(res, e);
  }
});

// GET /api/payments/status — how connected the tenant is.
payments.get("/status", async (req, res) => {
  const s = needStripe(res);
  if (!s) return;
  const scope = managerScope(req, res);
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
    const account = await retrieveConnected(s, scope.tenantId, accountId);
    if (!account) {
      res.json({ connected: false, platformFallback });
      return;
    }
    if (account.charges_enabled && account.capabilities?.card_payments === "active") void ensurePayDomains(scope.tenantId, accountId);
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
  const scope = managerScope(req, res);
  if (!scope) return;
  let q = paymentsCol as FirebaseFirestore.Query;
  if (scope.role === "platform") {
    const t = typeof req.query.tenantId === "string" ? req.query.tenantId : null;
    if (t) q = q.where("tenantId", "==", t);
  } else {
    q = q.where("tenantId", "==", scope.tenantId);
  }
  const snap = await q.get();
  let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  // A franchise sees only payments for ITS OWN bookings (on its listings).
  if ((scope.role === "franchise" || scope.role === "staff") && scope.franchiseId && scope.tenantId) {
    const bk = await db.collection("bookings").where("tenantId", "==", scope.tenantId).where("franchiseId", "==", scope.franchiseId).get();
    const refs = new Set(bk.docs.map((d) => (d.data() as { ref?: string }).ref).filter(Boolean) as string[]);
    list = list.filter((p) => ((p as { refs?: string[] }).refs ?? []).some((r) => refs.has(r)));
  }
  list.sort((a, b) => (((a as { createdAt?: string }).createdAt ?? "") < ((b as { createdAt?: string }).createdAt ?? "") ? 1 : -1));
  res.json(list);
});

const checkoutSchema = z.object({ refs: z.array(z.string().min(1)).min(1).max(20), tenantId: z.string().max(80).optional() });

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
  // Meal-order checkout — meals ordered from the parent Meals planner live in
  // their own collection but pay through the SAME direct-charge flow. All the
  // orders must be one provider (one connected account) and belong to the
  // paying family.
  if (Array.isArray((req.body as { mealOrderIds?: unknown }).mealOrderIds)) {
    const ids = ((req.body as { mealOrderIds: unknown[] }).mealOrderIds).filter((x): x is string => typeof x === "string").slice(0, 40);
    if (!ids.length) { res.status(400).json({ error: "No meals to pay for" }); return; }
    const emailLc = email.toLowerCase();
    const snaps = await db.getAll(...ids.map((id) => db.collection("mealOrders").doc(id)));
    const orders = snaps.filter((x) => x.exists).map((x) => ({ id: x.id, ...(x.data() as { tenantId: string; parentEmail: string; status?: string; pay?: string; total?: number }) }));
    if (orders.length !== ids.length || orders.some((o) => o.parentEmail !== emailLc)) { res.status(404).json({ error: "Meal order not found" }); return; }
    const tenantId = orders[0].tenantId;
    if (orders.some((o) => o.tenantId !== tenantId)) { res.status(400).json({ error: "These meals belong to different providers — pay them separately" }); return; }
    const bad = orders.find((o) => o.status === "cancelled" || o.pay === "Paid");
    if (bad) { res.status(409).json({ error: bad.pay === "Paid" ? "One of these meals is already paid" : "One of these meals was cancelled" }); return; }
    const amount = Math.round(orders.reduce((sum, o) => sum + (o.total ?? 0), 0) * 100) / 100;
    if (amount <= 0) { res.status(409).json({ error: "Nothing to pay" }); return; }
    const tenant = await tenantsCol.doc(tenantId).get();
    const accountId: string | undefined = tenant.data()?.stripeAccountId;
    let stripeAccount: string | null = null;
    if (accountId) { const account = await retrieveConnected(s, tenantId, accountId); if (account?.charges_enabled && account.capabilities?.card_payments === "active") stripeAccount = accountId; }
    if (!stripeAccount && !platformFallback) { res.status(409).json({ error: "This provider can't take card payments yet — they haven't finished Stripe onboarding" }); return; }
    let intent;
    try {
      intent = await s.paymentIntents.create({
        amount: toPence(amount), currency: "gbp", automatic_payment_methods: { enabled: true },
        description: `${tenant.data()?.name ?? `${BRAND}`} — meal${orders.length > 1 ? "s" : ""}`,
        metadata: { tenantId, mealOrders: orders.map((o) => o.id).join(","), email },
        ...((await autoEmailOn(tenantId, "payments")) ? { receipt_email: email } : {}), // meal orders have no email of our own, so Stripe's receipt stays
      }, stripeAccount ? { stripeAccount } : undefined);
    } catch (e) { stripeFail(res, e); return; }
    const rref = await paymentsCol.add({ tenantId, mealOrderIds: orders.map((o) => o.id), email, amount, currency: "gbp", paymentIntentId: intent.id, stripeAccount, platformFallback: !stripeAccount, status: "created", createdAt: new Date().toISOString() });
    res.status(201).json({ paymentId: rref.id, clientSecret: intent.client_secret, stripeAccount, amount });
    return;
  }

  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  // Email-scoped lookup — a ref from another family is simply never found.
  // Numbers repeat across providers: pay the ones at the provider the screen
  // names, and refuse an ambiguous number rather than charging the wrong one.
  const snaps = await Promise.all(
    parsed.data.refs.map((ref) =>
      db.collection("bookings").where("email", "==", email).where("ref", "==", ref).get(),
    ),
  );
  const picked = snaps.map((x) => (parsed.data.tenantId ? x.docs.filter((d) => d.get("tenantId") === parsed.data.tenantId) : x.docs));
  if (picked.some((docs) => docs.length > 1)) {
    res.status(409).json({ error: "More than one booking has this number (with different providers). Pay from the booking itself in My bookings." });
    return;
  }
  const bookings = picked.filter((docs) => docs.length === 1).map((docs) => fromDoc(docs[0].data() as BookingDoc));
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
  const settledAlready = bookings.find((b) => balanceOf(b) <= 0);
  if (settledAlready) {
    res.status(409).json({ error: `Booking ${settledAlready.ref} is already paid` });
    return;
  }
  const amount = Math.round(bookings.reduce((sum, b) => sum + balanceOf(b), 0) * 100) / 100;
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
    const account = await retrieveConnected(s, tenantId, accountId);
    // Both must hold: the account processes charges AND the card_payments
    // capability is active (charges_enabled alone isn't enough).
    if (account?.charges_enabled && account.capabilities?.card_payments === "active")
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
        description: `${tenant.data()?.name ?? `${BRAND}`} — booking${bookings.length > 1 ? "s" : ""} ${bookings.map((b) => b.ref).join(", ")}`,
        metadata: { tenantId, refs: bookings.map((b) => b.ref).join(","), email },
        // No Stripe receipt email: parents get our own "Payment received" email only (one receipt, in the provider's name).
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
    refs?: string[];
    mealOrderIds?: string[];
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
  // One shared settle path with the Stripe webhook — idempotent, so the
  // browser callback and a webhook delivery for the same payment are safe
  // in either order (backlog b7).
  await settlePaymentRecord(snap.id, { auto: false, by: req.user?.name ?? email ?? "payer" });
  if (rec.mealOrderIds?.length) {
    res.json({ status: "succeeded", paid: true });
    return;
  }
  res.json({ status: "succeeded", paid: true, refs: rec.refs ?? [] });
});


// ─────────────────────────────────────────────────────────────────────────
// PUBLIC booking pay link — no sign-in. /pay/b/{token} in the web app. The unguessable token (bookingPayTokens) IS
// the authorisation: it can only pay THAT booking's outstanding balance, by card, direct to that provider. Amounts
// come from the booking record, never the client. Same response shape as the public invoice page so one page serves
// both. Settlement is the shared path (also used by the Stripe webhook), so a closed tab still settles.
// ─────────────────────────────────────────────────────────────────────────
export const bookingPayPublic = Router();

async function bookingByToken(token: string) {
  const t = await bookingForToken(token);
  if (!t) return null;
  const snap = await db.collection("bookings").doc(bookingDocId(t.tenantId, t.ref)).get();
  return snap.exists ? fromDoc(snap.data() as BookingDoc) : null;
}

bookingPayPublic.get("/:token", async (req, res) => {
  const b = await bookingByToken(req.params.token);
  if (!b) { res.status(404).json({ error: "This payment link isn’t valid." }); return; }
  const tenant = await tenantsCol.doc(b.tenantId!).get();
  const settings = (tenant.exists && (tenant.data()!.settings as Record<string, unknown>)) || {};
  const provider = (settings.providerName as string) || (tenant.data()?.name as string) || "Your provider";
  const due = balanceOf(b);
  if (b.status === "Cancelled" || b.status === "Declined" || b.pay === "Paid" || due <= 0) {
    res.json({
      provider, status: b.pay === "Paid" ? "paid" : "cancelled", closed: true, amount: b.amount ?? 0, description: b.listing, reference: b.ref,
      paidAt: null, dueDate: null, customerName: null, payMethods: [], cardEnabled: false,
    });
    return;
  }
  const lib = (await db.collection("libraries").doc(b.tenantId!).get()).data() as { settings?: { billing?: Record<string, unknown> } } | undefined;
  const billing = lib?.settings?.billing ?? (settings.billing as Record<string, unknown> | undefined);
  const payOpts = buildPayOptions(settings.payMethods, billing, b.ref, ["Bank transfer", "Tax-Free Childcare", "Childcare vouchers"]);
  res.json({
    provider, amount: due, description: `${b.listing}${b.dates ? ` · ${b.dates}` : ""}`, reference: b.ref, status: "sent", dueDate: null,
    customerName: b.booker ?? null, payMethods: payOpts.methods, payOptions: payOpts,
    cardEnabled: !!stripe && (!!tenant.data()?.stripeAccountId || platformFallback),
  });
});

bookingPayPublic.post("/:token/checkout", async (req, res) => {
  const s = needStripe(res);
  if (!s) return;
  const b = await bookingByToken(req.params.token);
  if (!b) { res.status(404).json({ error: "This payment link isn’t valid." }); return; }
  if (b.status === "Cancelled" || b.status === "Declined") { res.status(409).json({ error: "This booking was cancelled" }); return; }
  if (b.pay === "Paid") { res.status(409).json({ error: "This booking is already paid" }); return; }
  if (!payable(b)) { res.status(409).json({ error: `This booking isn't ready to pay (${b.status} / ${b.pay})` }); return; }
  const amount = balanceOf(b);
  if (!(amount > 0)) { res.status(409).json({ error: "Nothing to pay" }); return; }
  const tenantId = b.tenantId!;
  const tenant = await tenantsCol.doc(tenantId).get();
  const accountId: string | undefined = tenant.data()?.stripeAccountId;
  let stripeAccount: string | null = null;
  if (accountId) {
    const account = await retrieveConnected(s, tenantId, accountId);
    if (account?.charges_enabled && account.capabilities?.card_payments === "active") stripeAccount = accountId;
  }
  if (!stripeAccount && !platformFallback) {
    res.status(409).json({ error: "This provider can't take card payments yet — pay by one of the listed methods instead" });
    return;
  }
  let intent;
  try {
    intent = await s.paymentIntents.create(
      {
        amount: toPence(amount),
        currency: "gbp",
        automatic_payment_methods: { enabled: true },
        description: `${tenant.data()?.name ?? `${BRAND}`} — booking ${b.ref}`,
        metadata: { tenantId, refs: b.ref, email: b.email, via: "pay-link" },
        // No Stripe receipt email: parents get our own "Payment received" email only (one receipt, in the provider's name).
      },
      stripeAccount ? { stripeAccount } : undefined,
    );
  } catch (e) { stripeFail(res, e); return; }
  const ref = await paymentsCol.add({
    tenantId, refs: [b.ref], email: b.email, amount, currency: "gbp", paymentIntentId: intent.id, stripeAccount,
    platformFallback: !stripeAccount, status: "created", via: "pay-link", createdAt: new Date().toISOString(),
  });
  res.status(201).json({ paymentId: ref.id, clientSecret: intent.client_secret, stripeAccount, amount });
});

bookingPayPublic.post("/:token/confirm/:paymentId", async (req, res) => {
  const s = needStripe(res);
  if (!s) return;
  const b = await bookingByToken(req.params.token);
  if (!b) { res.status(404).json({ error: "This payment link isn’t valid." }); return; }
  const snap = await paymentsCol.doc(req.params.paymentId).get();
  const rec = snap.data() as { tenantId?: string; refs?: string[]; paymentIntentId: string; stripeAccount: string | null } | undefined;
  // The payment must belong to THIS booking — a token can't settle someone else's payment.
  if (!snap.exists || !rec || rec.tenantId !== b.tenantId || !(rec.refs ?? []).includes(b.ref) || (rec.refs ?? []).length !== 1) {
    res.status(404).json({ error: "Payment not found" });
    return;
  }
  const intent = await s.paymentIntents.retrieve(rec.paymentIntentId, {}, rec.stripeAccount ? { stripeAccount: rec.stripeAccount } : undefined);
  if (intent.status !== "succeeded") { res.json({ status: intent.status, paid: false }); return; }
  await settlePaymentRecord(snap.id, { auto: false, by: "pay link" });
  res.json({ status: "succeeded", paid: true });
});
