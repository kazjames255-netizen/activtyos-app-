// Customer wallet — store credit a family holds WITH one provider (handoff §Z).
//
// Credit arrives when a cancellation is settled to the wallet instead of a card,
// when a no-refund policy still issues a credit note, or when an amend makes a
// booking cheaper. It is spend-only: never paid back out to a card, never
// transferable between providers. That's the point — the money stays in the
// business and is instant to reuse.
//
// Two collections, written together:
//   `wallet`        — one balance doc per (tenant, family). The authoritative
//                     figure, so a spend can be taken in a transaction rather
//                     than by summing a ledger and hoping nobody raced us.
//   `walletEntries` — the ledger behind it, one doc per movement.
// `wallet` is the name the client's realtime channel watches, so the balance
// doc changing is what nudges the parent's wallet page.

import { db } from "../firebase";

const wallets = () => db.collection("wallet");
const entries = () => db.collection("walletEntries");

/** Deterministic id so a balance can be read/written without a query. */
export const walletDocId = (tenantId: string, email: string) => `${tenantId}__${email.trim().toLowerCase()}`;

export interface WalletDoc {
  tenantId: string;
  email: string;
  balance: number;
  updatedAt: string;
}

export interface WalletEntryDoc {
  tenantId: string;
  email: string;
  /** Pounds. Positive = credit added, negative = spent. */
  delta: number;
  /** Plain English, shown to the family: "Refund from Summer Camp". */
  reason: string;
  /** The booking it relates to, when there is one. */
  ref?: string;
  at: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Move a family's balance and log the ledger entry, atomically. `delta` may be
 *  negative (a spend), but the balance is never allowed below zero — a spend
 *  bigger than the balance takes only what's there and returns what it took. */
export async function moveWallet(
  tenantId: string,
  email: string,
  delta: number,
  reason: string,
  ref?: string,
): Promise<number> {
  const em = email.trim().toLowerCase();
  if (!em || !tenantId || !delta) return 0;
  const docRef = wallets().doc(walletDocId(tenantId, em));
  const applied = await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    const balance = snap.exists ? Number(snap.get("balance") ?? 0) : 0;
    const move = delta < 0 ? -Math.min(balance, -delta) : round2(delta);
    if (!move) return 0;
    tx.set(
      docRef,
      { tenantId, email: em, balance: round2(balance + move), updatedAt: new Date().toISOString() } satisfies WalletDoc,
      { merge: true },
    );
    tx.set(entries().doc(), {
      tenantId,
      email: em,
      delta: move,
      reason,
      ...(ref ? { ref } : {}),
      at: new Date().toISOString(),
    } satisfies WalletEntryDoc);
    return move;
  });
  return applied;
}

/** The balance document, for callers that need to read it inside their own
 *  transaction (checkout takes credit atomically with the booking it pays for,
 *  so two baskets can never spend the same pound). */
export const walletRef = (tenantId: string, email: string) => wallets().doc(walletDocId(tenantId, email));

/** Spend inside someone else's transaction. `balance` must come from a
 *  `tx.get(walletRef(...))` made before any write in that transaction; the
 *  caller is responsible for never spending more than it. */
export function spendWalletInTx(
  tx: FirebaseFirestore.Transaction,
  tenantId: string,
  email: string,
  balance: number,
  spends: { ref: string; amount: number; reason: string }[],
): void {
  const em = email.trim().toLowerCase();
  const total = round2(spends.reduce((s, x) => s + x.amount, 0));
  if (!total) return;
  const at = new Date().toISOString();
  tx.set(
    walletRef(tenantId, em),
    { tenantId, email: em, balance: round2(balance - total), updatedAt: at } satisfies WalletDoc,
    { merge: true },
  );
  for (const s of spends)
    tx.set(entries().doc(), {
      tenantId,
      email: em,
      delta: -round2(s.amount),
      reason: s.reason,
      ref: s.ref,
      at,
    } satisfies WalletEntryDoc);
}

/** Add credit. Returns the amount credited. */
export const creditWallet = (tenantId: string, email: string, amount: number, reason: string, ref?: string) =>
  moveWallet(tenantId, email, Math.abs(amount), reason, ref);

/** Take credit, never more than the family holds. Returns how much was
 *  actually available and taken, as a positive number. */
export const spendWallet = async (tenantId: string, email: string, amount: number, reason: string, ref?: string) =>
  Math.abs(await moveWallet(tenantId, email, -Math.abs(amount), reason, ref));

/** What this family can spend with this provider, right now. */
export async function walletBalance(tenantId: string, email: string): Promise<number> {
  if (!tenantId || !email) return 0;
  const snap = await wallets().doc(walletDocId(tenantId, email)).get();
  return snap.exists ? Number(snap.get("balance") ?? 0) : 0;
}

export interface FamilyWallet {
  tenantId: string;
  provider: string;
  balance: number;
  transactions: { id: string; at: string; delta: number; reason: string; ref?: string }[];
}

/** Every provider this family holds credit (or history) with, newest movement
 *  first, shaped exactly as the parent's Wallet page reads it. */
export async function walletsForFamily(email: string): Promise<FamilyWallet[]> {
  const em = email.trim().toLowerCase();
  if (!em) return [];
  const [balSnap, entrySnap] = await Promise.all([
    wallets().where("email", "==", em).get(),
    entries().where("email", "==", em).get(),
  ]);
  const tenantIds = [
    ...new Set([
      ...balSnap.docs.map((d) => String(d.get("tenantId") ?? "")),
      ...entrySnap.docs.map((d) => String(d.get("tenantId") ?? "")),
    ]),
  ].filter(Boolean);
  if (!tenantIds.length) return [];
  const names = new Map<string, string>();
  await Promise.all(
    tenantIds.map(async (id) => {
      const t = await db.collection("tenants").doc(id).get();
      names.set(id, (t.exists ? (t.get("name") as string) : "") || "Your provider");
    }),
  );
  const balanceOf = new Map(balSnap.docs.map((d) => [String(d.get("tenantId")), Number(d.get("balance") ?? 0)]));
  return tenantIds
    .map((tenantId) => ({
      tenantId,
      provider: names.get(tenantId) ?? "Your provider",
      balance: round2(balanceOf.get(tenantId) ?? 0),
      transactions: entrySnap.docs
        .filter((d) => d.get("tenantId") === tenantId)
        .map((d) => {
          const e = d.data() as WalletEntryDoc;
          return { id: d.id, at: e.at, delta: e.delta, reason: e.reason, ...(e.ref ? { ref: e.ref } : {}) };
        })
        .sort((a, b) => b.at.localeCompare(a.at)),
    }))
    .sort((a, b) => b.balance - a.balance);
}

/** Unspent credit the provider owes across all its families — the liability
 *  figure for the money dashboard. */
export async function tenantWalletOutstanding(tenantId: string): Promise<number> {
  const snap = await wallets().where("tenantId", "==", tenantId).get();
  return round2(snap.docs.reduce((sum, d) => sum + Number(d.get("balance") ?? 0), 0));
}
