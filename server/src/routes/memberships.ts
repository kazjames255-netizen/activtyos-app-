import { Router, type Request } from "express";
import { db } from "../firebase";
import { normaliseCode } from "../lib/discountCodes";
import { creditWallet } from "../lib/wallet";
import { notify } from "../lib/notify";

// Customer memberships (parent-facing). A provider offers up to three monthly
// tiers; a family joins one and gets EITHER wallet credit each month (credit
// tier) or a standing % off every booking (percent tier — an ordinary discount
// code flagged `membership`, auto-applied at checkout and STACKING with coupons).
//
// Phase 1: benefits are delivered on join (there is no recurring charge yet).
// Phase 2 (Amir): Stripe recurring billing on the connected account calls
// `deliverMembershipBenefit` from the renewal webhook — the same hook — so
// nothing else here changes when real billing lands. See the handoff doc.
export const memberships = Router(); // mounted at /api/my/memberships (parent)
export const membershipsAdmin = Router(); // mounted at /api/memberships (operator)

const canManage = (role?: string) => role === "company" || role === "freelancer" || role === "franchise";
const tokenEmail = (req: Request): string | null => (req.user?.email ? req.user.email.toLowerCase() : null);
const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };

interface TierCfg {
  id: string; name: string; enabled: boolean;
  priceMonthly: number; benefitType: "credit" | "percent"; benefitValue: number;
  perks?: string[]; blurb?: string;
}

async function membershipsCfg(tenantId: string): Promise<{ enabled: boolean; tiers: TierCfg[] }> {
  const s = (await db.collection("libraries").doc(tenantId).get()).data()?.settings as
    { memberships?: { enabled?: boolean; tiers?: TierCfg[] } } | undefined;
  const m = s?.memberships;
  return { enabled: !!m?.enabled, tiers: (m?.tiers ?? []).filter((t) => t && t.id) };
}

const memDocId = (tenantId: string, email: string) => `${tenantId}__${email.trim().toLowerCase()}`;
const membershipCodeFor = (email: string, tierId: string) =>
  normaliseCode(`MEMBER${hash(email.trim().toLowerCase() + tierId).toString(36).toUpperCase().slice(0, 6)}`);

/** Deliver a tier's monthly benefit: credit → wallet, percent → a standing
 *  auto-apply discount code assigned to the member. Idempotent for the percent
 *  case (merges the code). Called on JOIN today, and — once Stripe recurring
 *  lands — from the renewal webhook (Phase 2), unchanged. */
export async function deliverMembershipBenefit(tenantId: string, email: string, tier: TierCfg): Promise<void> {
  const el = email.trim().toLowerCase();
  if (tier.benefitType === "credit") {
    // benefitValue is the £ that lands in the wallet each month, to spend on any
    // booking whenever they like (a "£40/mo → £50 wallet" plan).
    if (tier.benefitValue > 0) await creditWallet(tenantId, el, tier.benefitValue, `${tier.name} membership credit`);
    return;
  }
  // percent — ensure the member's standing % code exists and is active. It's a
  // normal stackable code (no perCustomerLimit, not exclusive) so it applies to
  // EVERY booking and sits on top of any coupon.
  const code = membershipCodeFor(el, tier.id);
  const codesCol = db.collection("discountCodes");
  const existing = await codesCol.where("tenantId", "==", tenantId).where("code", "==", code).limit(1).get();
  const doc = {
    tenantId, code, type: "percent" as const, value: Math.max(0, Math.min(100, tier.benefitValue)),
    assignedTo: el, membership: true, membershipTierId: tier.id, active: true, exclusive: false,
  };
  if (existing.empty) await codesCol.add({ ...doc, usedCount: 0, createdAt: new Date().toISOString() });
  else await existing.docs[0].ref.set(doc, { merge: true });
}

async function deactivateMembershipCode(tenantId: string, email: string, tierId: string): Promise<void> {
  const code = membershipCodeFor(email, tierId);
  const snap = await db.collection("discountCodes").where("tenantId", "==", tenantId).where("code", "==", code).limit(1).get();
  if (!snap.empty) await snap.docs[0].ref.set({ active: false }, { merge: true });
}

// GET /api/my/memberships?tenantId= — the tiers on offer + the family's own membership.
memberships.get("/", async (req, res) => {
  const email = tokenEmail(req);
  if (!email) { res.status(400).json({ error: "Account has no email address" }); return; }
  // Phase 1 single-provider: an explicit ?tenantId, else the provider they've booked with.
  let tenantId = typeof req.query.tenantId === "string" ? req.query.tenantId : "";
  if (!tenantId) {
    const bk = await db.collection("bookings").where("email", "==", email).get();
    tenantId = (bk.docs.map((d) => (d.data() as { tenantId?: string }).tenantId).filter(Boolean)[0]) ?? "";
  }
  if (!tenantId) { res.json({ enabled: false, reason: "Book with a provider first to see their memberships." }); return; }
  const { enabled, tiers } = await membershipsCfg(tenantId);
  if (!enabled) { res.json({ enabled: false }); return; }
  const tName = (await db.collection("tenants").doc(tenantId).get()).data()?.name ?? "your provider";
  const mine = (await db.collection("memberships").doc(memDocId(tenantId, email)).get()).data() ?? null;
  res.json({
    enabled: true, provider: tName, tenantId,
    tiers: tiers.filter((t) => t.enabled),
    current: mine && mine.status === "active"
      ? { tierId: mine.tierId, benefitType: mine.benefitType, benefitValue: mine.benefitValue, priceMonthly: mine.priceMonthly, startedAt: mine.startedAt, renewsAt: mine.renewsAt }
      : null,
  });
});

// POST /api/my/memberships/join { tenantId, tierId }
memberships.post("/join", async (req, res) => {
  const email = tokenEmail(req);
  if (!email) { res.status(400).json({ error: "Account has no email address" }); return; }
  const body = (req.body ?? {}) as { tenantId?: string; tierId?: string };
  const tenantId = String(body.tenantId ?? "");
  const tierId = String(body.tierId ?? "");
  if (!tenantId || !tierId) { res.status(400).json({ error: "tenantId and tierId are required" }); return; }
  const { enabled, tiers } = await membershipsCfg(tenantId);
  const tier = tiers.find((t) => t.id === tierId && t.enabled);
  if (!enabled || !tier) { res.status(400).json({ error: "That membership isn’t available" }); return; }

  const now = new Date();
  const renews = new Date(now); renews.setMonth(renews.getMonth() + 1);
  await db.collection("memberships").doc(memDocId(tenantId, email)).set({
    tenantId, email, tierId: tier.id, tierName: tier.name,
    benefitType: tier.benefitType, benefitValue: tier.benefitValue, priceMonthly: tier.priceMonthly,
    status: "active", startedAt: now.toISOString(), renewsAt: renews.toISOString(), lastDeliveredAt: now.toISOString(),
  }, { merge: true });

  // Phase 1: deliver the benefit on join. Phase 2 must gate this behind a
  // successful Stripe charge (call deliverMembershipBenefit from the webhook).
  await deliverMembershipBenefit(tenantId, email, tier);

  const renewTxt = renews.toLocaleDateString("en-GB");
  void notify({
    tenantId, to: { kind: "parent", email }, category: "billing", bellOnly: true,
    title: `You’re a ${tier.name} member 🎉`,
    body: tier.benefitType === "percent"
      ? `${tier.benefitValue}% off every booking is now active. Your ${tier.name} membership renews ${renewTxt}.`
      : `£${tier.benefitValue.toFixed(2)} added to your wallet — ready to spend on any booking, anytime. Your ${tier.name} membership renews ${renewTxt}.`,
    href: "/custdash/memberships", ref: tenantId,
  });
  res.json({ ok: true, tierId: tier.id, renewsAt: renews.toISOString() });
});

// POST /api/my/memberships/cancel { tenantId }
memberships.post("/cancel", async (req, res) => {
  const email = tokenEmail(req);
  if (!email) { res.status(400).json({ error: "Account has no email address" }); return; }
  const tenantId = String(((req.body ?? {}) as { tenantId?: string }).tenantId ?? "");
  if (!tenantId) { res.status(400).json({ error: "tenantId is required" }); return; }
  const ref = db.collection("memberships").doc(memDocId(tenantId, email));
  const cur = (await ref.get()).data();
  if (!cur || cur.status !== "active") { res.status(400).json({ error: "No active membership to cancel" }); return; }
  await ref.set({ status: "cancelled", cancelledAt: new Date().toISOString() }, { merge: true });
  // The % perk stops now; wallet credit already given is theirs to keep.
  if (cur.benefitType === "percent" && cur.tierId) await deactivateMembershipCode(tenantId, email, cur.tierId as string);
  res.json({ ok: true });
});

// GET /api/memberships — operator view of active members + monthly recurring total.
membershipsAdmin.get("/", async (req, res) => {
  const auth = req.auth!;
  const tenantId = auth.role === "platform" ? (typeof req.query.tenantId === "string" ? req.query.tenantId : null) : auth.tenantId;
  if (auth.role !== "platform" && !canManage(auth.role)) { res.status(403).json({ error: "Requires an operator account" }); return; }
  if (!tenantId) { res.status(400).json({ error: "No tenant" }); return; }
  const { tiers } = await membershipsCfg(tenantId);
  const snap = await db.collection("memberships").where("tenantId", "==", tenantId).get();
  const members = snap.docs.map((d) => d.data()).filter((m) => m.status === "active").map((m) => ({
    email: m.email, tierId: m.tierId, tierName: m.tierName,
    benefitType: m.benefitType, benefitValue: m.benefitValue, priceMonthly: m.priceMonthly,
    startedAt: m.startedAt, renewsAt: m.renewsAt,
  }));
  res.json({ tiers, members, mrr: Math.round(members.reduce((s, m) => s + (Number(m.priceMonthly) || 0), 0) * 100) / 100 });
});
