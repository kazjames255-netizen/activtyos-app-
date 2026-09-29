import { Router, type Request } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../firebase";
import { paidSoFar } from "../../../features/bookings/helpers";
import { settleInvoiceBooking, settleInvoicePayment } from "../lib/settlePayment";
import type { Booking } from "../../../features/bookings/types";
import { sendMail } from "../lib/mailer";
import { tenantSender } from "../lib/sender";
import { renderMoneyDoc } from "../lib/moneyDoc";
import { platformFallback, stripe, toPence } from "../lib/stripe";
import { applyHoNetFilter } from "../lib/franchiseScope";
import type { Role } from "../middleware/role";
import { addDays, ukToday } from "../lib/ukDate";

// PUBLIC_WEB_URL/APP_URL are this file's historic names; WEB_URL is what the
// rest of the server (lib/stripe.ts) and DEPLOY.md use. Accept all three or a
// deploy following the guide ships pay links pointing at localhost.
const WEB_URL = process.env.PUBLIC_WEB_URL || process.env.APP_URL || process.env.WEB_URL || "http://localhost:3000";

// Invoices (Money — INCOMING / accounts receivable) — a bill the provider
// SENDS a customer (parent) to collect payment, optionally tied to a booking.
// Each carries an unguessable payToken so the parent can open a public pay
// page. Operators only for management; the pay page is public by token.
//
// The public pay page takes card payments through Stripe (direct charge on
// the provider's connected account — see /:token/checkout below); manual
// methods stay listed and the provider can still mark those paid by hand.
export const invoices = Router();
export const invoicePublic = Router();
const col = db.collection("invoices");
const canManage = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";
const STATUSES = ["draft", "sent", "paid", "cancelled"] as const;
const OWED = new Set(["sent"]); // sent-but-unpaid is money still to collect

const lineItemSchema = z.object({
  description: z.string().trim().max(200),
  qty: z.number().nonnegative().default(1),
  unitPrice: z.number().nonnegative().default(0),
});
const invoiceSchema = z.object({
  customerName: z.string().trim().min(1).max(160),
  customerEmail: z.string().trim().max(160).optional(),
  customerAddress: z.string().trim().max(500).optional(),
  bookingRef: z.string().trim().max(80).optional(),
  reference: z.string().trim().max(80).optional(),
  poNumber: z.string().trim().max(80).optional(),   // the customer's PO this invoice is against
  poAttachmentUrl: z.string().trim().max(600).optional(), // uploaded copy of that PO
  accountRef: z.string().trim().max(80).optional(),
  description: z.string().trim().max(300).optional(),
  amount: z.number().nonnegative().optional(),
  lineItems: z.array(lineItemSchema).max(50).optional(),
  taxRate: z.number().min(0).max(100).optional(),   // VAT %, applied to the subtotal
  date: z.string().max(10),
  dueDate: z.string().max(10).optional(),
  status: z.enum(STATUSES).default("draft"),
  paidVia: z.enum(["link", "manual"]).optional(),   // how it was marked paid
  paidAt: z.string().max(40).optional(),
  notes: z.string().trim().max(2_000).optional(),
  emailedAt: z.string().max(40).optional(),
});
const round2 = (n: number) => Math.round(n * 100) / 100;
type LineItem = z.infer<typeof lineItemSchema>;
const subtotalOf = (lineItems: LineItem[] | undefined, fallback: number | undefined) =>
  lineItems && lineItems.length ? round2(lineItems.reduce((s, li) => s + li.qty * li.unitPrice, 0)) : round2(fallback ?? 0);
// The stored amount is the grand total (subtotal + VAT), so analytics stay right.
const grandTotal = (lineItems: LineItem[] | undefined, fallback: number | undefined, taxRate: number | undefined) =>
  round2(subtotalOf(lineItems, fallback) * (1 + (taxRate ?? 0) / 100));

function scope(req: Request, res: import("express").Response): string | null {
  const auth = req.auth!;
  if (auth.role === "platform") {
    const t = typeof req.query.tenantId === "string" ? req.query.tenantId : null;
    if (!t) { res.status(400).json({ error: "Platform: pass ?tenantId=" }); return null; }
    return t;
  }
  if (!canManage(auth.role) || !auth.tenantId) { res.status(403).json({ error: "Requires an operator account" }); return null; }
  return auth.tenantId;
}

invoices.get("/", async (req, res) => {
  const auth = req.auth!;
  const tenantId = scope(req, res);
  if (!tenantId) return;
  const snap = await col.where("tenantId", "==", tenantId).get();
  const today = ukToday();
  const thisYear = today.slice(0, 4);
  let list = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }) as Record<string, unknown> & { date?: string; dueDate?: string; amount?: number; status?: string; franchiseId?: string | null })
    .map((p) => ({ ...p, overdue: OWED.has(p.status ?? "") && !!p.dueDate && (p.dueDate as string) < today }));
  // Franchise sees only its own invoices; head office sees the whole tenant.
  if (auth.role === "franchise") list = list.filter((p) => (p.franchiseId ?? null) === auth.franchiseId);
  list = applyHoNetFilter(list, auth.role, req.query.franchiseId); // head-office network scope
  list.sort((a, b) => (`${b.date ?? ""}` < `${a.date ?? ""}` ? -1 : 1));
  const outstanding = round2(list.filter((p) => OWED.has(p.status ?? "")).reduce((s, p) => s + (p.amount ?? 0), 0));
  const collected = round2(list.filter((p) => p.status === "paid" && (p.date ?? "").slice(0, 4) === thisYear).reduce((s, p) => s + (p.amount ?? 0), 0));
  res.json({ items: list, summary: { count: list.length, outstanding, collected, overdue: list.filter((p) => p.overdue).length } });
});

invoices.post("/", async (req, res) => {
  const auth = req.auth!;
  if (!canManage(auth.role) || !auth.tenantId) { res.status(403).json({ error: "Requires an operator account" }); return; }
  const parsed = invoiceSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const doc = { ...parsed.data, amount: grandTotal(parsed.data.lineItems, parsed.data.amount, parsed.data.taxRate), payToken: randomUUID(), tenantId: auth.tenantId, franchiseId: auth.role === "franchise" ? auth.franchiseId : null, createdBy: req.user?.email ?? "unknown", createdAt: new Date().toISOString() };
  const ref = await col.add(doc);
  // Raised already paid (cash taken on the spot) — settle its booking now,
  // exactly as marking it paid later does (acceptance d4s7 side finding).
  if (doc.status === "paid")
    await settleInvoiceBooking(ref.id, { via: "manual" }).catch((e) => console.error("[invoices] settle booking:", (e as Error).message));
  res.status(201).json({ id: ref.id, ...doc });
});

async function own(req: Request, id: string) {
  const auth = req.auth!;
  if (!canManage(auth.role) || !auth.tenantId) return { status: 403 as const };
  const snap = await col.doc(id).get();
  if (!snap.exists || snap.data()!.tenantId !== auth.tenantId) return { status: 404 as const };
  if (auth.role === "franchise" && (snap.data()!.franchiseId ?? null) !== auth.franchiseId) return { status: 404 as const };
  return { status: 200 as const, snap };
}

invoices.put("/:id", async (req, res) => {
  const o = await own(req, req.params.id);
  if (o.status !== 200) { res.status(o.status).json({ error: o.status === 403 ? "Requires an operator account" : "Invoice not found" }); return; }
  const parsed = invoiceSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const p = parsed.data;
  const patch = { ...p, ...(p.lineItems !== undefined ? { amount: grandTotal(p.lineItems, p.amount, p.taxRate) } : p.amount !== undefined ? { amount: round2(p.amount) } : {}) };
  await o.snap.ref.set(patch, { merge: true });
  if (p.status === "paid" && o.snap.data()!.status !== "paid")
    await settleInvoiceBooking(o.snap.id, { via: "manual" }).catch((e) => console.error("[invoices] settle booking:", (e as Error).message));
  const after = await o.snap.ref.get();
  res.json({ id: after.id, ...after.data() });
});

// Email this invoice to the customer with the pay-link (real send via mailer).
invoices.post("/:id/email", async (req, res) => {
  const o = await own(req, req.params.id);
  if (o.status !== 200) { res.status(o.status).json({ error: o.status === 403 ? "Requires an operator account" : "Invoice not found" }); return; }
  const doc: Record<string, unknown> = { id: o.snap.id, ...(o.snap.data() as Record<string, unknown>) };
  const to = (typeof req.body?.to === "string" && req.body.to.trim()) || (doc.customerEmail as string) || "";
  if (!to) { res.status(400).json({ error: "No email address to send to — add the customer's email." }); return; }
  const tenant = await db.collection("tenants").doc(o.snap.data()!.tenantId as string).get();
  const billing = (tenant.data()?.settings as Record<string, unknown> | undefined)?.billing as Record<string, unknown> | undefined;
  // `link:false` sends the bank-details-only version (no online pay-link).
  const withLink = req.body?.link !== false;
  const payUrl = withLink && doc.payToken ? `${WEB_URL}/pay/${doc.payToken}` : undefined;
  const html = renderMoneyDoc("invoice", doc, billing, payUrl);
  // The trading name on the invoice is the name it should arrive from, and a
  // billing query has to be able to reply to the provider, not the platform.
  const sender = await tenantSender(o.snap.data()!.tenantId as string, (billing?.businessName as string) || undefined);
  await sendMail(to, `Invoice${doc.reference ? ` ${doc.reference}` : ""} from ${(billing?.businessName as string) || (tenant.data()?.name as string) || "your provider"}`, html, sender);
  const emailedAt = new Date().toISOString();
  // Sending an invoice moves a draft to "sent" (now awaiting payment).
  await o.snap.ref.set({ emailedAt, ...(doc.status === "draft" ? { status: "sent" } : {}) }, { merge: true });
  res.json({ ok: true, emailedAt, to });
});

invoices.delete("/:id", async (req, res) => {
  const o = await own(req, req.params.id);
  if (o.status !== 200) { res.status(o.status).json({ error: o.status === 403 ? "Requires an operator account" : "Invoice not found" }); return; }
  await o.snap.ref.delete();
  res.json({ ok: true });
});

// ── Public pay page (no auth; found by unguessable token) ──────────────────
// A pay link doesn't live for ever: it closes LINK_DAYS after the latest of the
// invoice's due date, issue date, last send and payment — so re-sending an
// overdue invoice (or moving its due date) gives the family a working link
// again, and an old link in an inbox stops showing who owed what.
const LINK_DAYS = 90;
function linkExpiresOn(inv: Record<string, unknown>): string {
  const day = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : "");
  const base = [inv.dueDate, inv.date, inv.emailedAt, inv.paidAt, inv.createdAt].map(day).filter(Boolean).sort().pop() ?? ukToday();
  return addDays(base, LINK_DAYS); // calendar days — adding raw ms shifts the day across the 25 Oct clock change
}
const linkExpired = (inv: Record<string, unknown>) => ukToday() > linkExpiresOn(inv);

invoicePublic.get("/:token", async (req, res) => {
  const snap = await col.where("payToken", "==", req.params.token).limit(1).get();
  if (snap.empty) { res.status(404).json({ error: "This payment link isn’t valid." }); return; }
  const inv = snap.docs[0].data() as Record<string, unknown>;
  const tenant = await db.collection("tenants").doc(inv.tenantId as string).get();
  const settings = (tenant.exists && (tenant.data()!.settings as Record<string, unknown>)) || {};
  const provider = (settings.providerName as string) || (tenant.data()?.name as string) || "Your provider";
  const status = (inv.status as string) ?? "sent";
  if (linkExpired(inv)) {
    res.status(410).json({ error: "This payment link has expired.", code: "link_expired", provider, status: status === "paid" || status === "cancelled" ? status : "expired" });
    return;
  }
  // Paid or cancelled: the link shows that and nothing to pay with. A paid one
  // keeps its receipt details (what, how much, when) until the link expires.
  if (status === "paid" || status === "cancelled") {
    res.json({
      provider, status, closed: true, amount: inv.amount ?? 0, description: inv.description ?? null, reference: inv.bookingRef ?? null,
      paidAt: status === "paid" ? (inv.paidAt ?? null) : null, dueDate: null, customerName: null, payMethods: [], cardEnabled: false,
    });
    return;
  }
  const payMethods = Array.isArray(settings.payMethods) && settings.payMethods.length ? settings.payMethods : ["Bank transfer", "Tax-Free Childcare", "Childcare vouchers"];
  res.json({
    expiresOn: linkExpiresOn(inv),
    provider, amount: inv.amount ?? 0, description: inv.description ?? null, reference: inv.bookingRef ?? null,
    status: inv.status ?? "sent", dueDate: inv.dueDate ?? null, customerName: inv.customerName ?? null,
    payMethods,
    // Card is on when Stripe is configured and the provider has a connected
    // account (or the dev platform fallback). The checkout call re-checks
    // the account can actually charge before any intent is created.
    cardEnabled: !!stripe && (!!tenant.data()?.stripeAccountId || platformFallback),
  });
});

// POST /api/public/invoice/:token/checkout — start a card payment. Public:
// the unguessable token IS the authorisation, exactly like the GET. Same
// rules as booking checkout — a DIRECT CHARGE on the provider's connected
// account; the amount only ever comes from the invoice doc.
invoicePublic.post("/:token/checkout", async (req, res) => {
  if (!stripe) { res.status(503).json({ error: "Card payments aren't configured" }); return; }
  const snap = await col.where("payToken", "==", req.params.token).limit(1).get();
  if (snap.empty) { res.status(404).json({ error: "This payment link isn’t valid." }); return; }
  const doc = snap.docs[0];
  const inv = doc.data() as Record<string, unknown>;
  if (inv.status === "paid") { res.status(409).json({ error: "This invoice is already paid" }); return; }
  if (inv.status === "cancelled") { res.status(409).json({ error: "This invoice was cancelled" }); return; }
  if (linkExpired(inv)) { res.status(410).json({ error: "This payment link has expired — ask your provider to send it again.", code: "link_expired" }); return; }
  const amount =Math.round(Number(inv.amount ?? 0) * 100) / 100;
  if (!(amount > 0)) { res.status(409).json({ error: "Nothing to pay" }); return; }

  const tenant = await db.collection("tenants").doc(inv.tenantId as string).get();
  const accountId = tenant.data()?.stripeAccountId as string | undefined;
  let stripeAccount: string | null = null;
  if (accountId) {
    const account = await stripe.accounts.retrieve(accountId);
    if (account.charges_enabled && account.capabilities?.card_payments === "active") stripeAccount = accountId;
  }
  if (!stripeAccount && !platformFallback) {
    res.status(409).json({ error: "This provider can't take card payments yet — pay by one of the listed methods instead" });
    return;
  }
  try {
    const intent = await stripe.paymentIntents.create(
      {
        amount: toPence(amount),
        currency: "gbp",
        automatic_payment_methods: { enabled: true },
        description: `${(tenant.data()?.name as string) ?? "ActivityOS"} — invoice ${(inv.reference as string) || doc.id}`,
        metadata: { tenantId: inv.tenantId as string, invoiceId: doc.id, kind: "invoice" },
        ...(typeof inv.customerEmail === "string" && inv.customerEmail.includes("@") ? { receipt_email: inv.customerEmail } : {}),
      },
      stripeAccount ? { stripeAccount } : undefined,
    );
    const rec = await db.collection("payments").add({
      kind: "invoice",
      tenantId: inv.tenantId,
      invoiceId: doc.id,
      email: inv.customerEmail ?? null,
      amount,
      currency: "gbp",
      paymentIntentId: intent.id,
      stripeAccount,
      platformFallback: !stripeAccount,
      status: "created",
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ paymentId: rec.id, clientSecret: intent.client_secret, stripeAccount, amount });
  } catch (e) {
    res.status(502).json({ error: e instanceof Error ? e.message : "Stripe error" });
  }
});

// POST /api/public/invoice/:token/confirm/:paymentId — verify with Stripe,
// mark the invoice paid. Idempotent; the payment must belong to this invoice.
invoicePublic.post("/:token/confirm/:paymentId", async (req, res) => {
  if (!stripe) { res.status(503).json({ error: "Card payments aren't configured" }); return; }
  const snap = await col.where("payToken", "==", req.params.token).limit(1).get();
  if (snap.empty) { res.status(404).json({ error: "This payment link isn’t valid." }); return; }
  const invDoc = snap.docs[0];
  const paySnap = await db.collection("payments").doc(req.params.paymentId).get();
  if (!paySnap.exists || paySnap.data()!.invoiceId !== invDoc.id) {
    res.status(404).json({ error: "Payment not found" });
    return;
  }
  const rec = paySnap.data() as { paymentIntentId: string; stripeAccount: string | null; status: string };
  const intent = await stripe.paymentIntents.retrieve(
    rec.paymentIntentId,
    {},
    rec.stripeAccount ? { stripeAccount: rec.stripeAccount } : undefined,
  );
  if (intent.status !== "succeeded") {
    res.json({ status: intent.status, paid: false });
    return;
  }
  // Shared with the Stripe webhook, so a payer who closes the tab still gets
  // the invoice settled (backlog b7).
  await settleInvoicePayment(paySnap.id, invDoc.id, rec.paymentIntentId, { auto: false, by: "pay link" })
    .catch((e) => console.error("[invoices] settle:", (e as Error).message));
  res.json({ status: "succeeded", paid: true });
});
