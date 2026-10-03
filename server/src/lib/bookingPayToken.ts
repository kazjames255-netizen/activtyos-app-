import { randomUUID } from "node:crypto";
import { db } from "../firebase";
import { webUrl } from "./stripe";

// A no-login pay link for one booking. The unguessable token IS the authorisation (same idea as an invoice's
// payToken): it can only ever pay THAT booking's outstanding balance, by card, to that provider. Kept in its own
// collection so the booking document and its types are untouched. One token per booking, created on first use.
const col = db.collection("bookingPayTokens");

export async function bookingPayToken(tenantId: string, ref: string): Promise<string> {
  const key = `${tenantId}_${ref.trim()}`;
  const found = await col.where("key", "==", key).limit(1).get();
  if (!found.empty) return found.docs[0].id;
  const token = randomUUID();
  await col.doc(token).set({ key, tenantId, ref: ref.trim(), createdAt: new Date().toISOString() });
  return token;
}

export async function bookingForToken(token: string): Promise<{ tenantId: string; ref: string } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null;
  const s = await col.doc(token).get();
  return s.exists ? { tenantId: s.data()!.tenantId as string, ref: s.data()!.ref as string } : null;
}

/** The link in the email: public pay page when we can mint a token, else the signed-in My bookings page. */
export async function bookingPayUrl(tenantId: string | undefined, ref: string): Promise<string> {
  const fallback = `${webUrl}/custdash/bookings?pay=${encodeURIComponent(ref)}`;
  if (!tenantId) return fallback;
  try { return `${webUrl}/pay/b/${await bookingPayToken(tenantId, ref)}`; } catch { return fallback; }
}
