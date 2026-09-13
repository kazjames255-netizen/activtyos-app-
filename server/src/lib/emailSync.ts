import type { Request } from "express";
import { db } from "../firebase";
import { walletDocId } from "./wallet";

// Sign-in email change — the server half (acceptance d26s5).
//
// The change itself is Firebase's: the account page calls
// verifyBeforeUpdateEmail, Firebase emails a link to the NEW address, and the
// login only switches once it's clicked (the old address then can't sign in,
// and Firebase ends the account's other sessions). What Firebase can't do is
// move this app's records — families are matched to their bookings, customer
// rows, messages, wallet and so on BY EMAIL, so an unmigrated change would
// orphan everything they have.
//
// So: on the next authenticated read (/api/me, /api/account), when the
// verified token's email differs from the one stored on the users doc, the
// records under the old address move to the new one. Only when the new
// address is proven — Firebase marked it verified, or it's the change this
// account asked for (pendingEmail, recorded by POST /api/account/email-change).

const norm = (e: string) => e.trim().toLowerCase();

// [collection, email field] — everything a family's account finds by email.
const BY_EMAIL: [string, string][] = [
  ["bookings", "email"],
  ["threads", "parentEmail"],
  ["mealOrders", "parentEmail"],
  ["memberships", "email"],
  ["payments", "email"],
  ["walletEntries", "email"],
  ["notifications", "email"],
  ["discountRedemptions", "email"], // a once-per-family code stays used
  ["emailSuppressions", "email"],   // an unsubscribe stays an unsubscribe (PECR)
  ["supportThreads", "email"],
];

const inFlight = new Set<string>();

/** Docs whose `field` is the old address, in the case it was stored in. */
async function docsFor(col: string, field: string, variants: string[]) {
  const snaps = await Promise.all(variants.map((v) => db.collection(col).where(field, "==", v).get()));
  const seen = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  for (const s of snaps) for (const d of s.docs) seen.set(d.ref.path, d);
  return [...seen.values()];
}

async function commitAll(writes: ((b: FirebaseFirestore.WriteBatch) => void)[]) {
  for (let i = 0; i < writes.length; i += 400) {
    const batch = db.batch();
    for (const w of writes.slice(i, i + 400)) w(batch);
    await batch.commit();
  }
}

export interface EmailSyncResult { from: string; to: string; moved: Record<string, number>; skippedCustomers: number }

/**
 * Bring this account's stored email (and every record keyed on it) up to the
 * token's email. No-op when they already match, when the account has no stored
 * email yet (that's just recorded), or when the new address isn't proven.
 */
export async function syncAccountEmail(req: Request): Promise<EmailSyncResult | null> {
  // HQ "view as" swaps req.user to the target with a borrowed email — never
  // treat that as the target changing their address.
  if (req.impersonating) return null;
  const user = req.user;
  if (!user?.uid || !user.email) return null;
  const to = norm(user.email);
  const ref = db.collection("users").doc(user.uid);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const stored = typeof snap.get("email") === "string" ? norm(snap.get("email") as string) : "";
  if (stored === to) return null;
  if (!stored) { await ref.set({ email: to }, { merge: true }); return null; }
  const pending = typeof snap.get("pendingEmail") === "string" ? norm(snap.get("pendingEmail") as string) : "";
  if (user.email_verified !== true && pending !== to) return null;
  if (inFlight.has(user.uid)) return null;
  inFlight.add(user.uid);
  try {
    const from = stored;
    const rawStored = String(snap.get("email"));
    const variants = [...new Set([from, rawStored.trim()])];
    const moved: Record<string, number> = {};
    const writes: ((b: FirebaseFirestore.WriteBatch) => void)[] = [];

    for (const [col, field] of BY_EMAIL) {
      const docs = await docsFor(col, field, variants);
      moved[col] = docs.length;
      for (const d of docs) writes.push((b) => b.update(d.ref, { [field]: to }));
    }

    // Customer rows are one per provider (tenant). A row another account is
    // linked to is theirs, not ours — leave it for that provider to sort out.
    let skippedCustomers = 0;
    const custs = await docsFor("customers", "email", variants);
    moved.customers = 0;
    for (const d of custs) {
      const linked = d.get("uid") as string | undefined;
      if (linked && linked !== user.uid) { skippedCustomers++; continue; }
      moved.customers++;
      writes.push((b) => b.update(d.ref, { email: to, uid: user.uid, previousEmails: [...new Set([...((d.get("previousEmails") as string[] | undefined) ?? []), from])] }));
    }
    await commitAll(writes);

    // Store credit lives on a doc whose id IS the email — move each balance
    // onto the new address's doc (adding to any credit already there) inside a
    // transaction, and leave the old doc at £0 pointing at where it went.
    const wallets = await docsFor("wallet", "email", variants);
    moved.wallet = 0;
    for (const w of wallets) {
      const tenantId = String(w.get("tenantId") ?? "");
      if (!tenantId) continue;
      const dest = db.collection("wallet").doc(walletDocId(tenantId, to));
      if (dest.path === w.ref.path) continue;
      await db.runTransaction(async (tx) => {
        const [src, dst] = await Promise.all([tx.get(w.ref), tx.get(dest)]);
        const bal = Number(src.get("balance") ?? 0);
        const have = dst.exists ? Number(dst.get("balance") ?? 0) : 0;
        const now = new Date().toISOString();
        tx.set(dest, { tenantId, email: to, balance: Math.round((have + bal) * 100) / 100, updatedAt: now }, { merge: true });
        tx.set(w.ref, { balance: 0, movedTo: to, updatedAt: now }, { merge: true });
      });
      moved.wallet++;
    }

    const prev = ((snap.get("previousEmails") as string[] | undefined) ?? []).filter((e) => e !== from);
    await ref.set({ email: to, previousEmails: [...prev, from], emailChangedAt: new Date().toISOString(), pendingEmail: null }, { merge: true });
    console.log(`[account] sign-in email changed for ${user.uid}: moved`, JSON.stringify(moved), skippedCustomers ? `(${skippedCustomers} customer row(s) linked to another account left alone)` : "");
    return { from, to, moved, skippedCustomers };
  } finally {
    inFlight.delete(user.uid);
  }
}
