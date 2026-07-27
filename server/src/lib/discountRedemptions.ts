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

/** Record that a basket spent these codes. One doc per code, listing every
 *  booking ref it paid for. Fire-and-forget — the hard usage cap is
 *  re-checked on the next redemption anyway. */
export async function consumeDiscountCodes(
  tenantId: string,
  codes: { codeId: string; code: string }[],
  refs: string[],
  email?: string,
): Promise<void> {
  await Promise.all(
    codes.map(async (c) => {
      await db.collection("discountCodes").doc(c.codeId).update({ usedCount: FieldValue.increment(1) });
      await redemptions().add({
        codeId: c.codeId,
        tenantId,
        code: c.code,
        ...(email ? { email: email.toLowerCase() } : {}),
        refs,
        at: new Date().toISOString(),
      } satisfies RedemptionDoc);
    }),
  ).catch((e) => console.error("consumeDiscountCodes", e));
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
