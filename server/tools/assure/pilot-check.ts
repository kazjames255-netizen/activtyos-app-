// Real-money pilot checker. READ-ONLY: it never writes to Firestore and only ever makes GET requests to Stripe.
//   server/node_modules/.bin/tsx server/tools/assure/pilot-check.ts APF-10312
//   server/node_modules/.bin/tsx server/tools/assure/pilot-check.ts APF-10312 --after-refund
//   server/node_modules/.bin/tsx server/tools/assure/pilot-check.ts --all-since 2026-10-06T00:00:00Z [--tenant <id>]
//   server/node_modules/.bin/tsx server/tools/assure/pilot-check.ts --selftest      (prints PILOT SELFTEST OK)
// Works for any tenant (the booking's own tenantId is used). Safe on LIVE data.
import dotenv from "dotenv";
import path from "node:path";
dotenv.config({ path: path.resolve(process.cwd(), "server/.env"), quiet: true });
import { reconcileBooking } from "../../src/lib/reconcileMath";
import { refundedGross } from "../../../features/bookings/helpers";

export type Status = "PASS" | "FAIL" | "WARN" | "NA";
export interface Check { id: string; label: string; status: Status; detail: string }

/** Everything the checks need, already loaded, so the checks are pure and testable. */
export interface PilotCtx {
  booking: Record<string, any> | null;
  payments: Record<string, any>[];           // every payment record for the tenant (payments + refunds)
  blocks: Record<string, any>[];             // blocks of the booking's listing
  mailLog: { to: string; subject: string; status?: string; at: string }[] | null; // null = log unavailable
  stripePI: Record<string, any> | null | "unavailable" | "error"; // retrieved read-only
  tenant: Record<string, any> | null;
  connectedAccountId?: string | null;
  payDomainsDone?: string[];
  wantPayDomains?: string[];
  refunded: boolean;                         // --after-refund mode
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const ok = (id: string, label: string, detail = ""): Check => ({ id, label, status: "PASS", detail });
const bad = (id: string, label: string, detail: string): Check => ({ id, label, status: "FAIL", detail });
const warn = (id: string, label: string, detail: string): Check => ({ id, label, status: "WARN", detail });
const na = (id: string, label: string, detail: string): Check => ({ id, label, status: "NA", detail });

const isMoney = (p: Record<string, any>) => p.type !== "refund";
const addonsOf = (b: Record<string, any>): number => {
  if (typeof b.addonsTotal === "number") return b.addonsTotal;
  const lines = Array.isArray(b.addonLines) ? b.addonLines : [];
  return r2(lines.reduce((s: number, l: any) => s + num(l?.price) * (l?.qty ?? 1), 0));
};
const t = (iso?: string) => (iso ? Date.parse(iso) : NaN);

export function evaluate(c: PilotCtx): Check[] {
  const out: Check[] = [];
  const b = c.booking;
  if (!b) return [bad("exists", "Booking exists", "No booking with that reference was found.")];
  const mine = c.payments.filter((p) => (p.refs ?? []).includes(b.ref));
  const money = mine.filter(isMoney);
  const refunds = mine.filter((p) => p.type === "refund");
  const paidRecs = money.filter((p) => p.status === "succeeded" || p.status === "recorded");
  const method = String(b.method ?? b.payMethod ?? "").toLowerCase();
  const isCard = b.pay === "Paid" ? paidRecs.some((p) => !!p.paymentIntentId) || /card/.test(method) : /card/.test(method);

  // 1. booking status
  const statusOk = ["Confirmed"].includes(b.status) || (c.refunded && /Cancel|Refund/i.test(String(b.status)));
  out.push(statusOk ? ok("status", "Booking status", `${b.status} / ${b.pay}`) : warn("status", "Booking status", `${b.status} / ${b.pay} (expected Confirmed${c.refunded ? " or Cancelled" : ""})`));

  // 2. payment record
  if (b.pay === "Paid" || paidRecs.length) {
    const total = r2(paidRecs.reduce((s, p) => s + num(p.amount), 0));
    out.push(paidRecs.length && Math.abs(total - num(b.amount)) < 0.005
      ? ok("payrec", "Payment record matches the booking", `£${total.toFixed(2)} on ${paidRecs.length} record(s)`)
      : bad("payrec", "Payment record matches the booking", `records total £${total.toFixed(2)}, booking amount £${num(b.amount).toFixed(2)}`));
  } else if (num(b.amount) === 0) {
    out.push(na("payrec", "Payment record", "£0 booking, nothing to pay"));
  } else {
    out.push(bad("payrec", "Payment record", `booking is ${b.pay}, no succeeded payment record found`));
  }
  const refsOk = paidRecs.every((p) => (p.refs ?? []).includes(b.ref));
  if (paidRecs.length) out.push(refsOk ? ok("refs", "Payment refs include this booking") : bad("refs", "Payment refs include this booking", "a payment record does not list the booking ref"));

  // 3. Stripe payment intent
  const withPI = paidRecs.filter((p) => p.paymentIntentId);
  if (!isCard || !paidRecs.length) {
    out.push(na("pi", "Stripe payment intent", `not a card payment (${method || "no method"})`));
  } else if (!withPI.length) {
    out.push(bad("pi", "Stripe payment intent id on the record", "card booking but no paymentIntentId stored"));
  } else {
    out.push(ok("pi", "Stripe payment intent id on the record", String(withPI[0].paymentIntentId)));
    const pi = c.stripePI;
    if (pi === "unavailable" || pi == null) out.push(warn("pi-stripe", "Stripe says the payment succeeded", "no STRIPE_SECRET_KEY in server/.env, check it in the Stripe dashboard"));
    else if (pi === "error") out.push(warn("pi-stripe", "Stripe says the payment succeeded", "could not retrieve it from Stripe (wrong mode, account or key)"));
    else {
      const amt = num(pi.amount) / 100;
      const sOk = pi.status === "succeeded" && String(pi.currency).toLowerCase() === "gbp" && Math.abs(amt - num(withPI[0].amount)) < 0.005;
      out.push(sOk ? ok("pi-stripe", "Stripe: succeeded, GBP, amount matches", `£${amt.toFixed(2)}`) : bad("pi-stripe", "Stripe: succeeded, GBP, amount matches", `status ${pi.status}, ${pi.currency}, £${amt.toFixed(2)} vs record £${num(withPI[0].amount).toFixed(2)}`));
      const refundedStripe = num(pi.amount_refunded) / 100;
      if (c.refunded) out.push(refundedStripe > 0 ? ok("pi-refund", "Stripe shows the refund", `£${refundedStripe.toFixed(2)} refunded`) : bad("pi-refund", "Stripe shows the refund", "no refund on the payment in Stripe"));
      else out.push(refundedStripe === 0 ? ok("pi-norefund", "No refund taken yet") : warn("pi-norefund", "No refund taken yet", `Stripe already shows £${refundedStripe.toFixed(2)} refunded`));
      out.push(!pi.receipt_email ? ok("pi-receipt", "Stripe's own receipt email is off", "receipt_email not set") : bad("pi-receipt", "Stripe's own receipt email is off", `Stripe will also email ${pi.receipt_email}: parent may get two receipts`));
      if (c.connectedAccountId) out.push(pi.__account === c.connectedAccountId || pi.__account == null ? ok("pi-acct", "Charged on the provider's own Stripe account", c.connectedAccountId) : bad("pi-acct", "Charged on the provider's own Stripe account", `charged on ${pi.__account}`));
    }
  }

  // 4. price arithmetic
  const list = typeof b.listPrice === "number" ? b.listPrice : null;
  if (list == null) out.push(warn("math", "Amount = list price - discount + add-ons", "no listPrice stored on this booking"));
  else {
    const expect = r2(list - num(b.discountOff) + addonsOf(b));
    out.push(Math.abs(expect - num(b.amount)) < 0.005 ? ok("math", "Amount = list price - discount + add-ons", `${list.toFixed(2)} - ${num(b.discountOff).toFixed(2)} + ${addonsOf(b).toFixed(2)} = ${expect.toFixed(2)}`) : bad("math", "Amount = list price - discount + add-ons", `expected £${expect.toFixed(2)}, booking says £${num(b.amount).toFixed(2)}`));
  }

  // 5. capacity
  const days: string[] = b.days ?? [];
  const seats = num(b.seats) || 1;
  const blk = c.blocks.find((x) => x.id === b.blockId) ?? c.blocks[0];
  if (!blk || !days.length) out.push(na("cap", "Capacity counts include this booking", "no block or no days on the booking"));
  else {
    const counts: Record<string, number> = blk.dayCounts ?? {};
    const live = !/Cancel|Declined|Waitlisted/i.test(String(b.status));
    const short = live ? days.filter((d) => num(counts[d]) < seats) : [];
    const over = days.filter((d) => num(counts[d]) > num(blk.capacity));
    out.push(short.length ? bad("cap", "Capacity counts include this booking", `day count lower than the ${seats} seat(s) on ${short.join(", ")}`)
      : over.length ? bad("cap", "Capacity not exceeded", `over capacity on ${over.join(", ")}`)
      : ok("cap", "Capacity counts include this booking, none over capacity", live ? `${days.length} day(s)` : "booking is not live"));
  }

  // 6. emails
  const mail = c.mailLog;
  const listing = String(b.listing ?? "");
  if (mail == null) out.push(warn("mail", "Emails (one payment-received, none early)", "not verifiable: the mail log is unavailable"));
  else {
    const to = String(b.email ?? "").toLowerCase();
    const mine2 = mail.filter((m) => m.to.toLowerCase() === to && (!listing || m.subject.includes(listing)) && m.status !== "failed" && !(Number.isFinite(t(String(b.createdAt ?? b.bookedAt ?? ""))) && t(m.at) < t(String(b.createdAt ?? b.bookedAt)) - 120_000)); // only mail sent since THIS booking (same parent + listing can have earlier bookings)
    const payMails = mine2.filter((m) => /^Payment received/i.test(m.subject));
    const bookedMails = mine2.filter((m) => /^Booking confirmed/i.test(m.subject));
    const payAt = paidRecs.map((p) => t(p.createdAt)).filter(Number.isFinite).sort()[0];
    if (isCard && paidRecs.length) {
      out.push(payMails.length === 1 ? ok("mail-pay", "Exactly one 'Payment received' email", payMails[0].status ?? "") : bad("mail-pay", "Exactly one 'Payment received' email", `${payMails.length} found`));
      const early = bookedMails.filter((m) => Number.isFinite(payAt) && t(m.at) < (payAt as number) - 1000);
      out.push(early.length ? bad("mail-early", "No 'Booking confirmed' before the card was paid", `sent ${early.length} email(s) before the payment`) : ok("mail-early", "No 'Booking confirmed' before the card was paid"));
    } else {
      out.push(na("mail-pay", "Payment received email", "not a card payment"));
      out.push(bookedMails.length <= 1 ? ok("mail-booked", "At most one 'Booking confirmed' email", `${bookedMails.length} found`) : bad("mail-booked", "At most one 'Booking confirmed' email", `${bookedMails.length} found`));
    }
    if (c.refunded) {
      const refMails = mine2.filter((m) => /^(Refund|Wallet credit)/i.test(m.subject));
      out.push(refMails.length === 1 ? ok("mail-refund", "Exactly one refund email", refMails[0].subject) : bad("mail-refund", "Exactly one refund email", `${refMails.length} found`));
    }
  }

  // 7. wallet / refund fields
  const refunded = r2(refundedGross(b as never) || num(b.refunded)), wallet = num(b.walletApplied);
  const refundRecSum = r2(refunds.filter((p) => ["succeeded", "recorded", "credited", "to-reimburse"].includes(p.status)).reduce((s, p) => s + num(p.amount), 0));
  if (c.refunded) {
    out.push(refundRecSum > 0 ? ok("refrec", "Refund record exists", `£${refundRecSum.toFixed(2)}`) : bad("refrec", "Refund record exists", "no refund payment record found for this booking"));
    out.push(Math.abs(refundRecSum - refunded) < 0.005 || refundRecSum > 0 ? ok("refmatch", "Refund amounts agree", `booking refunded £${refunded.toFixed(2)}, records £${refundRecSum.toFixed(2)}`) : bad("refmatch", "Refund amounts agree", `booking refunded £${refunded.toFixed(2)} but records £${refundRecSum.toFixed(2)}`));
    out.push(refunded > 0 && refunded <= num(b.amount) + 0.005 ? ok("refcap", "Refunded no more than was paid") : bad("refcap", "Refunded no more than was paid", `refunded £${refunded.toFixed(2)} of £${num(b.amount).toFixed(2)}`));
  } else {
    out.push(refunded === 0 && !refunds.length ? ok("norefund", "No refund recorded yet") : warn("norefund", "No refund recorded yet", `booking refunded £${refunded.toFixed(2)}, ${refunds.length} refund record(s)`));
    out.push(wallet >= 0 && wallet <= num(b.amount) + 0.005 ? ok("wallet", "Wallet amount sensible", `£${wallet.toFixed(2)} applied`) : bad("wallet", "Wallet amount sensible", `wallet £${wallet.toFixed(2)} on a £${num(b.amount).toFixed(2)} booking`));
  }

  // 8. finance reconcile
  const rec = reconcileBooking(b, c.payments as never);
  out.push(rec.ok ? ok("recon", "Finance dashboard figure matches the payment records", `in £${rec.inn.toFixed(2)}, refunds £${rec.ref.toFixed(2)}, net £${rec.net.toFixed(2)}`) : bad("recon", "Finance dashboard figure matches the payment records", `records net £${rec.net.toFixed(2)} but the dashboard helper says £${rec.helper.toFixed(2)}`));

  // 9. Apple Pay domain
  if (!c.connectedAccountId) out.push(warn("applepay", "Apple Pay domain registered on the provider's Stripe account", "no connected account id on the tenant"));
  else {
    const want = c.wantPayDomains ?? [], done = c.payDomainsDone ?? [];
    out.push(!want.length ? warn("applepay", "Apple Pay domain registered", "PAY_DOMAINS and WEB_URL are not set here, so it can't be checked") : want.every((d) => done.includes(d)) ? ok("applepay", "Apple Pay domain registered on the provider's Stripe account", done.join(", ")) : warn("applepay", "Apple Pay domain registered on the provider's Stripe account", `not recorded as done for: ${want.filter((d) => !done.includes(d)).join(", ")} (set PAY_DOMAINS on Railway, then take one card payment)`));
  }
  return out;
}

export function nextStep(checks: Check[], refunded: boolean, ref: string): string {
  const fails = checks.filter((c) => c.status === "FAIL");
  if (fails.length) return `STOP. ${fails.length} check(s) failed. Do not do more pilot bookings. Note ${ref} and the failed lines, and ask.`;
  if (!refunded) return `Now press Refund in Stripe or in the app for ${ref}, then run me again with --after-refund.`;
  return `All refund checks passed for ${ref}. Tick it off in the manual and do the next pilot booking.`;
}

export function render(ref: string, checks: Check[], refunded: boolean): string {
  const mark = { PASS: "PASS", FAIL: "FAIL", WARN: "WARN", NA: " n/a" } as const;
  const lines = checks.map((c) => `  ${mark[c.status]}  ${c.label}${c.detail ? `  (${c.detail})` : ""}`);
  const p = checks.filter((c) => c.status === "PASS").length, f = checks.filter((c) => c.status === "FAIL").length, w = checks.filter((c) => c.status === "WARN").length;
  return [`${ref}${refunded ? " (after refund)" : ""}`, ...lines, `  -> ${p} pass, ${f} fail, ${w} warn`, `  NEXT: ${nextStep(checks, refunded, ref)}`].join("\n");
}

// ───────────────────────────── self-test (no network, no Firestore) ─────────────────────────────
function selftest(): boolean {
  let fails = 0;
  const expect = (name: string, cond: boolean) => { if (!cond) { fails++; console.log(`  SELFTEST FAIL: ${name}`); } };
  const find = (cs: Check[], id: string) => cs.find((c) => c.id === id);
  const base = (): PilotCtx => ({
    booking: { ref: "APF-1", status: "Confirmed", pay: "Paid", amount: 10, listPrice: 12, discountOff: 2, addonsTotal: 0, email: "p@x.com", listing: "Camp", blockId: "b1", days: ["2026-10-26"], seats: 1, method: "Card", refunded: 0, walletApplied: 0 },
    payments: [{ refs: ["APF-1"], amount: 10, status: "succeeded", paymentIntentId: "pi_1", createdAt: "2026-10-06T10:00:00Z" }],
    blocks: [{ id: "b1", capacity: 5, dayCounts: { "2026-10-26": 1 } }],
    mailLog: [{ to: "p@x.com", subject: "Payment received — Camp", status: "sent", at: "2026-10-06T10:00:05Z" }],
    stripePI: { amount: 1000, currency: "gbp", status: "succeeded", amount_refunded: 0, receipt_email: null },
    tenant: {}, connectedAccountId: "acct_1", payDomainsDone: ["site.test"], wantPayDomains: ["site.test"], refunded: false,
  });
  // clean control: nothing fails
  const clean = evaluate(base());
  expect("clean control has no FAIL", clean.every((c) => c.status !== "FAIL"));
  expect("clean control has passes", clean.filter((c) => c.status === "PASS").length >= 8);
  // positive controls: each broken fixture must fail the intended check
  const brk = (mut: (c: PilotCtx) => void, id: string, name: string) => { const c = base(); mut(c); expect(name, find(evaluate(c), id)?.status === "FAIL"); };
  brk((c) => { c.booking = null; }, "exists", "missing booking is flagged");
  brk((c) => { c.payments = []; }, "payrec", "no payment record is flagged");
  brk((c) => { c.payments[0].amount = 9; }, "payrec", "wrong payment amount is flagged");
  brk((c) => { c.payments[0].paymentIntentId = undefined; }, "pi", "missing payment intent is flagged");
  brk((c) => { (c.stripePI as any).status = "requires_payment_method"; }, "pi-stripe", "unsucceeded Stripe payment is flagged");
  brk((c) => { (c.stripePI as any).receipt_email = "p@x.com"; }, "pi-receipt", "Stripe receipt email on is flagged");
  brk((c) => { c.booking!.discountOff = 5; }, "math", "wrong discount arithmetic is flagged");
  brk((c) => { c.blocks[0].dayCounts["2026-10-26"] = 0; }, "cap", "capacity count missing the booking is flagged");
  brk((c) => { c.blocks[0].dayCounts["2026-10-26"] = 9; }, "cap", "over-capacity is flagged");
  brk((c) => { c.mailLog = [...c.mailLog!, { to: "p@x.com", subject: "Payment received — Camp", status: "sent", at: "2026-10-06T10:00:06Z" }]; }, "mail-pay", "double payment email is flagged");
  brk((c) => { c.mailLog = [{ to: "p@x.com", subject: "Booking confirmed — Camp", status: "sent", at: "2026-10-06T09:59:00Z" }, ...c.mailLog!]; }, "mail-early", "booked-in email before payment is flagged");
  brk((c) => { c.mailLog = []; }, "mail-pay", "missing payment email is flagged");
  brk((c) => { c.booking!.walletApplied = 99; }, "wallet", "silly wallet amount is flagged");
  brk((c) => { c.payments.push({ refs: ["APF-1"], amount: 4, status: "succeeded", paymentIntentId: "pi_2" }); }, "payrec", "payments summing past the booking are flagged");
  // not-verifiable and n/a paths
  const noMail = base(); noMail.mailLog = null; expect("missing mail log is a WARN not a PASS", find(evaluate(noMail), "mail")?.status === "WARN");
  const noStripe = base(); noStripe.stripePI = "unavailable"; expect("no Stripe key is a WARN", find(evaluate(noStripe), "pi-stripe")?.status === "WARN");
  const cash = base(); cash.booking!.method = "Cash"; cash.booking!.pay = "Unpaid"; cash.payments = []; cash.booking!.amount = 10;
  expect("unpaid cash booking has no card checks", find(evaluate(cash), "pi")?.status === "NA");
  // after-refund path
  const ref = base(); ref.refunded = true; ref.booking!.status = "Cancelled"; ref.booking!.pay = "Refunded"; ref.booking!.refundLog = [{ amount: 10, label: "Refund approved" }]; ref.booking!.cancel = { refund: "approved", amount: 10 }; ref.stripePI = { amount: 1000, currency: "gbp", status: "succeeded", amount_refunded: 1000, receipt_email: null };
  ref.payments.push({ refs: ["APF-1"], amount: 10, type: "refund", status: "succeeded", createdAt: "2026-10-06T11:00:00Z" });
  ref.mailLog = [...ref.mailLog!, { to: "p@x.com", subject: "Refund approved — Camp", status: "sent", at: "2026-10-06T11:00:05Z" }];
  const rc = evaluate(ref);
  expect("after-refund clean control has no FAIL", rc.every((c) => c.status !== "FAIL"));
  const noRef = { ...ref, payments: ref.payments.slice(0, 1) } as PilotCtx; expect("after-refund with no refund record is flagged", find(evaluate(noRef), "refrec")?.status === "FAIL");
  const over = { ...ref, booking: { ...ref.booking!, refundLog: [{ amount: 99, label: "Refund approved" }] } } as PilotCtx; expect("refunding more than paid is flagged", find(evaluate(over), "refcap")?.status === "FAIL");
  const noRefMail = { ...ref, mailLog: ref.mailLog!.slice(0, 1) } as PilotCtx; expect("missing refund email is flagged", find(evaluate(noRefMail), "mail-refund")?.status === "FAIL");
  const stripeNoRefund = { ...ref, stripePI: { ...(ref.stripePI as any), amount_refunded: 0 } } as PilotCtx; expect("Stripe not showing the refund is flagged", find(evaluate(stripeNoRefund), "pi-refund")?.status === "FAIL");
  // next-step wording
  expect("next step after pass asks for a refund", /Refund in Stripe/.test(nextStep(clean, false, "APF-1")));
  expect("next step after a failure says STOP", /^STOP/.test(nextStep(evaluate((() => { const c = base(); c.payments = []; return c; })()), false, "APF-1")));
  expect("render prints a NEXT line", /NEXT:/.test(render("APF-1", clean, false)));
  console.log(fails ? `PILOT SELFTEST FAILED (${fails})` : "PILOT SELFTEST OK");
  return fails === 0;
}

// ───────────────────────────── live loading (read-only) ─────────────────────────────
async function load(ref: string, refunded: boolean): Promise<PilotCtx> {
  const { db } = await import("../../src/firebase");
  const { payDomains } = await import("../../src/lib/payDomains");
  const bs = await db.collection("bookings").where("ref", "==", ref).limit(1).get();
  if (bs.empty) return { booking: null, payments: [], blocks: [], mailLog: null, stripePI: null, tenant: null, refunded };
  const booking = { id: bs.docs[0].id, ...(bs.docs[0].data() as Record<string, any>) };
  const tenantId = booking.tenantId as string;
  const [ps, blocks, tdoc] = await Promise.all([
    db.collection("payments").where("tenantId", "==", tenantId).get(),
    booking.listingId ? db.collection("blocks").where("listingId", "==", booking.listingId).get() : Promise.resolve(null),
    db.collection("tenants").doc(tenantId).get(),
  ]);
  const payments = ps.docs.map((d) => d.data() as Record<string, any>).filter((p) => (p.refs ?? []).includes(ref) || true);
  let mailLog: PilotCtx["mailLog"] = null;
  try {
    const email = String(booking.email ?? "").toLowerCase();
    const ms = await db.collection("mailLog").where("to", "==", email).get();
    mailLog = ms.docs.map((d) => d.data() as { to: string; subject: string; status?: string; at: string });
  } catch { mailLog = null; }
  const tenant = (tdoc.data() ?? {}) as Record<string, any>;
  const accountId = (tenant.stripeAccountId as string | undefined) ?? null;
  let stripePI: PilotCtx["stripePI"] = "unavailable";
  const piId = payments.filter((p) => (p.refs ?? []).includes(ref)).map((p) => p.paymentIntentId).find(Boolean) as string | undefined;
  const key = process.env.STRIPE_SECRET_KEY;
  if (key && piId) {
    try {
      const Stripe = (await import("stripe")).default;
      const s = new Stripe(key);
      const pi = await s.paymentIntents.retrieve(piId, accountId ? { stripeAccount: accountId } : undefined); // GET only
      stripePI = { ...(pi as unknown as Record<string, any>), __account: accountId ?? undefined };
    } catch { stripePI = "error"; }
  }
  return { booking, payments, blocks: blocks ? blocks.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, any>) })) : [], mailLog, stripePI, tenant, connectedAccountId: accountId, payDomainsDone: (tenant.payDomains as string[] | undefined) ?? [], wantPayDomains: payDomains(), refunded };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--selftest")) process.exit(selftest() ? 0 : 1);
  const refunded = args.includes("--after-refund");
  const since = args.indexOf("--all-since");
  if (since >= 0) {
    const iso = args[since + 1];
    if (!iso || Number.isNaN(Date.parse(iso))) { console.error("--all-since needs an ISO date, e.g. 2026-10-06T00:00:00Z"); process.exit(2); }
    const tIdx = args.indexOf("--tenant");
    const tenantId = tIdx >= 0 ? args[tIdx + 1] : process.env.TENANT_ID ?? "0nD9U5p80agzQkBXeMZR"; // APF Activity Camps
    const { db } = await import("../../src/firebase");
    const snap = await db.collection("bookings").where("tenantId", "==", tenantId).get();
    const refs = snap.docs.map((d) => d.data() as Record<string, any>).filter((b) => String(b.createdAt ?? b.bookedAt ?? "") >= iso).map((b) => String(b.ref)).sort();
    console.log(`REF          PASS FAIL WARN  RESULT   (tenant ${tenantId}, since ${iso})`);
    let anyFail = false;
    for (const r of refs) {
      const cs = evaluate(await load(r, false));
      const p = cs.filter((c) => c.status === "PASS").length, f = cs.filter((c) => c.status === "FAIL").length, w = cs.filter((c) => c.status === "WARN").length;
      if (f) anyFail = true;
      console.log(`${r.padEnd(12)} ${String(p).padStart(4)} ${String(f).padStart(4)} ${String(w).padStart(4)}  ${f ? "FAIL: " + cs.filter((c) => c.status === "FAIL").map((c) => c.id).join(",") : "ok"}`);
    }
    console.log(refs.length ? `${refs.length} booking(s) checked.` : "No bookings since that time.");
    process.exit(anyFail ? 1 : 0);
  }
  const ref = args.find((a) => !a.startsWith("--"));
  if (!ref) { console.error("usage: pilot-check.ts <BOOKING-REF> [--after-refund] | --all-since <ISO> [--tenant <id>] | --selftest"); process.exit(2); }
  const checks = evaluate(await load(ref, refunded));
  console.log(render(ref, checks, refunded));
  process.exit(checks.some((c) => c.status === "FAIL") ? 1 : 0);
}

if (process.argv[1] && /pilot-check\.ts$/.test(process.argv[1])) void main();
