import { Router, type Request } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../firebase";
import { normaliseCode } from "../lib/discountCodes";
import { emailNewMessage } from "../lib/emails";
import { webUrl } from "../lib/stripe";

// Refer-a-friend (parent-facing). Every family gets a personal code: a friend
// using it on their FIRST booking gets `friendOff` off (an ordinary discount
// code under the hood, flagged `referral` + `newCustomerOnly`), and once that
// booking goes through the referrer is issued a `referrerReward` code — the
// reward is minted in POST /api/my/bookings (see my.ts). Provider-funded, so it
// only exists when the provider has switched it on with amounts.
export const referral = Router();

// Operator-facing referrals dashboard (Money area). Read-only overview of who's
// referring whom and what it's paid out.
export const referralsAdmin = Router();
const canManage = (role?: string) => role === "company" || role === "freelancer" || role === "franchise";

referralsAdmin.get("/", async (req, res) => {
  const auth = req.auth!;
  const tenantId = auth.role === "platform" ? (typeof req.query.tenantId === "string" ? req.query.tenantId : null) : auth.tenantId;
  if (auth.role !== "platform" && !canManage(auth.role)) { res.status(403).json({ error: "Requires an operator account" }); return; }
  if (!tenantId) { res.status(400).json({ error: "No tenant" }); return; }

  const lib = (await db.collection("libraries").doc(tenantId).get()).data() as { settings?: { referral?: { enabled?: boolean; type?: "amount" | "percent"; friendOff?: number; referrerReward?: number } } } | undefined;
  const ref = lib?.settings?.referral;

  const snap = await db.collection("referrals").where("tenantId", "==", tenantId).get();
  const list = snap.docs.map((d) => d.data() as { referrerEmail: string; friendEmail: string; reward?: number; at?: string; viaCode?: string });
  const rewardsPaid = list.reduce((s, r) => s + (Number(r.reward) || 0), 0);

  const counts = new Map<string, { count: number; reward: number }>();
  for (const r of list) {
    const cur = counts.get(r.referrerEmail) ?? { count: 0, reward: 0 };
    counts.set(r.referrerEmail, { count: cur.count + 1, reward: cur.reward + (Number(r.reward) || 0) });
  }
  const leaderboard = [...counts.entries()].map(([email, v]) => ({ email, ...v })).sort((a, b) => b.count - a.count).slice(0, 20);

  list.sort((a, b) => `${b.at ?? ""}`.localeCompare(`${a.at ?? ""}`));
  res.json({
    enabled: !!ref?.enabled,
    type: ref?.type === "percent" ? "percent" : "amount",
    friendOff: Number(ref?.friendOff) || 0,
    referrerReward: Number(ref?.referrerReward) || 0,
    friendsBooked: list.length,
    rewardsPaid,
    leaderboard,
    recent: list.slice(0, 100),
  });
});

const tokenEmail = (req: Request): string | null => (req.user?.email ? req.user.email.toLowerCase() : null);

// A readable, stable code from the family's email — local-part + a short hash so
// two families never collide.
function referralCodeFor(email: string): string {
  const local = (email.split("@")[0] || "").replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 8) || "FRIEND";
  let h = 0;
  for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) >>> 0;
  const suf = h.toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3).padEnd(3, "X");
  return normaliseCode(`${local}${suf}`);
}
export { referralCodeFor };

const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };

/** Reward the referrer once their friend's first booking goes through: mint a
 *  code reserved to them + a "thanks" message/email. Called from the booking
 *  redemption. Idempotent per (referrer, friend) and a no-op if referrals are
 *  off or the reward is £0. Best-effort — never blocks the friend's booking. */
export async function rewardReferrer(tenantId: string, referrerEmail: string, friendEmail: string, viaCode: string, friendSpend = 0): Promise<void> {
  const rel = referrerEmail.trim().toLowerCase();
  const fel = friendEmail.trim().toLowerCase();
  if (!rel || rel === fel) return;
  const dupe = await db.collection("referrals").where("referrerEmail", "==", rel).where("friendEmail", "==", fel).limit(1).get();
  if (!dupe.empty) return; // already rewarded for this friend

  const lib = (await db.collection("libraries").doc(tenantId).get()).data() as { settings?: { referral?: { enabled?: boolean; type?: "amount" | "percent"; referrerReward?: number; capToFriendSpend?: boolean } } } | undefined;
  const ref = lib?.settings?.referral;
  if (!ref?.enabled) return;
  const type = ref.type === "percent" ? "percent" : "amount";
  const reward = Math.max(0, Number(ref.referrerReward) || 0);
  // Cap the £ the reward can take off to what the friend actually spent — you
  // can never give away more than the referral brought in.
  const cap = ref.capToFriendSpend ? Math.max(0, Math.round((Number(friendSpend) || 0) * 100) / 100) : undefined;
  const rewardTxt = (type === "percent" ? `${reward}% off` : `£${reward} off`) + (cap != null ? ` (up to £${cap})` : "");
  const now = new Date().toISOString();
  await db.collection("referrals").add({ tenantId, referrerEmail: rel, friendEmail: fel, viaCode, reward, type, ...(cap != null ? { cap } : {}), at: now });
  if (reward <= 0) return;

  const tName = (await db.collection("tenants").doc(tenantId).get()).data()?.name ?? "Your provider";
  const rewardCode = normaliseCode(`THANKS${hash(rel + now).toString(36).toUpperCase().slice(0, 5)}`);
  await db.collection("discountCodes").add({
    tenantId, code: rewardCode, type, value: reward, assignedTo: rel,
    ...(cap != null ? { maxOff: cap } : {}),
    active: true, usedCount: 0, referralReward: true, createdAt: now,
  });

  // Message + email the referrer (mirrors notifyAssigned; carries a copyable chip).
  const id = `${tenantId}__${rel}`;
  const body = `🎉 Thanks for referring a friend to ${tName}! Here's your reward — code ${rewardCode} for ${rewardTxt} on your next booking. It's ready and waiting at checkout.`;
  const tRef = db.collection("threads").doc(id);
  const existing = await tRef.get();
  await tRef.set({
    tenantId, tenantName: existing.exists ? existing.data()!.tenantName : tName,
    parentEmail: rel, parentName: existing.exists ? existing.data()!.parentName : rel,
    lastBody: body, lastFrom: "operator", lastAt: now, operatorHidden: false,
    ...(existing.exists ? {} : { createdAt: now, operatorUnread: 0, parentUnread: 0 }),
    parentUnread: FieldValue.increment(1),
  }, { merge: true });
  await db.collection("messages").add({ threadId: id, tenantId, parentEmail: rel, from: "operator", senderName: tName, body, coupon: { code: rewardCode, valueTxt: rewardTxt, scope: "all listings", expiry: null }, createdAt: now });
  try { emailNewMessage(rel, { providerName: tName, senderName: tName, body, deepLink: `${webUrl}/custdash/messages` }); } catch { /* email never blocks */ }
}

// GET /api/my/referral — the family's referral code, link, amounts and stats.
referral.get("/", async (req, res) => {
  const email = tokenEmail(req);
  if (!email) { res.status(400).json({ error: "Account has no email address" }); return; }

  // Phase 1 is single-provider: the family refers to the provider they book with.
  const bk = await db.collection("bookings").where("email", "==", email).get();
  const tenantId = bk.docs.map((d) => (d.data() as { tenantId?: string }).tenantId).filter(Boolean)[0];
  if (!tenantId) { res.json({ enabled: false, reason: "Book with a provider first to unlock referrals." }); return; }

  const lib = (await db.collection("libraries").doc(tenantId).get()).data() as { settings?: { referral?: { enabled?: boolean; type?: "amount" | "percent"; friendOff?: number; referrerReward?: number; minSpend?: number } } } | undefined;
  const ref = lib?.settings?.referral;
  if (!ref?.enabled) { res.json({ enabled: false }); return; }

  const type = ref.type === "percent" ? "percent" : "amount";
  const friendOff = Math.max(0, Number(ref.friendOff) || 0);
  const referrerReward = Math.max(0, Number(ref.referrerReward) || 0);
  const minSpend = Math.max(0, Number(ref.minSpend) || 0);
  const tName = (await db.collection("tenants").doc(tenantId).get()).data()?.name ?? "your provider";
  const code = referralCodeFor(email);

  // Ensure the friend-facing discount code exists and reflects the current amount/type.
  const codesCol = db.collection("discountCodes");
  const existing = await codesCol.where("tenantId", "==", tenantId).where("code", "==", code).limit(1).get();
  const codeDoc = {
    tenantId, code, type, value: friendOff,
    ...(minSpend ? { minSpend } : {}),
    referral: true, referrerEmail: email, newCustomerOnly: true, active: true,
  };
  if (existing.empty) await codesCol.add({ ...codeDoc, usedCount: 0, createdAt: new Date().toISOString() });
  else await existing.docs[0].ref.set(codeDoc, { merge: true });

  // Stats — each successful referral is one `referrals` doc.
  const mine = await db.collection("referrals").where("referrerEmail", "==", email).get();
  const booked = mine.size;

  res.json({
    enabled: true,
    provider: tName,
    code, type,
    link: `${webUrl}/store/${tenantId}?ref=${encodeURIComponent(code)}`,
    friendOff, referrerReward, minSpend,
    booked,
    earned: booked * referrerReward,
  });
});
