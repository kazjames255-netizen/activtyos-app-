// Consuming and un-consuming marketing discount codes.
//
// A redemption is recorded once per BASKET (not per booking) in
// `discountRedemptions`, carrying the refs it paid for. That record is what
// makes a code releasable: when every booking a code paid for has been
// cancelled, the family never got the activity, so the usage is handed back —
// `usedCount` comes down and a one-per-customer code becomes usable again.
//
// Both cancel paths (parent `/api/my/bookings/:ref/cancel` and the operator
// action in `routes/bookings.ts`) call `releaseDiscountCodes`.

import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../firebase";

const redemptions = () => db.collection("discountRedemptions");

export interface RedemptionDoc {
  codeId: string;
  tenantId: string;
  code?: string;
  email?: string;
  refs?: string[];
  at: string;
}

/** Per-customer codes get a redemption doc with a DETERMINISTIC id (code +
 *  hashed email), so two simultaneous checkouts by one family contend on the
 *  same document inside their transactions and only one can create it. Other
 *  codes can be used many times by one family, so theirs stay auto-id. */
const perCustomerRedemptionId = (codeId: string, email: string) =>
  `pc_${codeId}_${createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 24)}`;

export interface CodeToRedeem { codeId: string; code: string; perCustomer: boolean }

/**
 * Redeem codes INSIDE the booking transaction (acceptance d7s6). The usage cap
 * used to be checked before the transaction and `usedCount` bumped after it,
 * so three simultaneous checkouts with a one-use code all passed the check and
 * all got the discount (usedCount ended at 3). Now each code doc — and, for a
 * one-per-customer code, the family's redemption doc — is READ in the
 * transaction and written with the bookings: Firestore serialises the
 * contenders, so the loser re-runs, sees the code spent and is refused, and no
 * booking is written at the discounted price.
 *
 * Call before the transaction's first write (Firestore: all reads first).
 * Returns a refusal reason, or a `commit(refs)` that performs the writes.
 */
export async function redeemCodesInTx(
  tx: FirebaseFirestore.Transaction,
  tenantId: string,
  codes: CodeToRedeem[],
  email?: string,
): Promise<{ ok: false; reason: string } | { ok: true; commit: (refs: string[]) => void }> {
  const lower = email?.trim().toLowerCase() || undefined;
  const codeRefs = codes.map((c) => db.collection("discountCodes").doc(c.codeId));
  const lockRefs = codes.map((c) => (c.perCustomer && lower ? redemptions().doc(perCustomerRedemptionId(c.codeId, lower)) : null));
  const codeSnaps = codeRefs.length ? await Promise.all(codeRefs.map((r) => tx.get(r))) : [];
  const lockSnaps = await Promise.all(lockRefs.map((r) => (r ? tx.get(r) : Promise.resolve(null))));
  for (let i = 0; i < codes.length; i++) {
    const c = codes[i];
    const snap = codeSnaps[i];
    if (!snap.exists || snap.get("active") === false) return { ok: false, reason: `Code ${c.code} is no longer available — remove it to book without it` };
    const limit = snap.get("usageLimit") as number | undefined;
    if (limit != null && Number(snap.get("usedCount") ?? 0) >= limit)
      return { ok: false, reason: `Code ${c.code} has just been used up — remove it to book without it` };
    if (lockSnaps[i]?.exists) return { ok: false, reason: `You’ve already used code ${c.code}` };
  }
  return {
    ok: true,
    commit: (refs) => {
      codes.forEach((c, i) => {
        tx.update(codeRefs[i], { usedCount: FieldValue.increment(1) });
        tx.set(lockRefs[i] ?? redemptions().doc(), {
          codeId: c.codeId,
          tenantId,
          code: c.code,
          ...(lower ? { email: lower } : {}),
          refs,
          at: new Date().toISOString(),
        } satisfies RedemptionDoc);
      });
    },
  };
}

/** True when a ref no longer holds its place — cancelled, or gone entirely. */
async function isSpent(tenantId: string, ref: string): Promise<boolean> {
  const snap = await db
    .collection("bookings")
    .where("tenantId", "==", tenantId)
    .where("ref", "==", ref)
    .limit(1)
    .get();
  return snap.empty || snap.docs[0].get("status") === "Cancelled";
}

/** Hand a cancelled booking's codes back. Only releases once EVERY booking the
 *  redemption paid for is cancelled — one child of a sibling basket dropping
 *  out doesn't free a code the rest of the basket is still using.
 *
 *  Call AFTER the cancelling write has committed. Fire-and-forget. */
export async function releaseDiscountCodes(tenantId: string, ref: string): Promise<void> {
  try {
    const snap = await redemptions().where("tenantId", "==", tenantId).where("refs", "array-contains", ref).get();
    for (const doc of snap.docs) {
      const data = doc.data() as RedemptionDoc;
      const siblings = (data.refs ?? []).filter((r) => r !== ref);
      const spent = await Promise.all(siblings.map((r) => isSpent(tenantId, r)));
      if (spent.some((s) => !s)) continue; // the basket still holds the code
      const codeRef = db.collection("discountCodes").doc(data.codeId);
      await db
        .runTransaction(async (tx) => {
          const code = await tx.get(codeRef);
          if (!code.exists) return; // code deleted since — the redemption still goes
          const used = Number(code.get("usedCount") ?? 0);
          tx.update(codeRef, { usedCount: Math.max(0, used - 1) });
        })
        .catch(() => {});
      await doc.ref.delete();
    }
  } catch (e) {
    console.error("releaseDiscountCodes", e);
  }
}
