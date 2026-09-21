import { db } from "../firebase";

// Learning Hub — realtime "something changed" pings for the BIG collections. The SSE stream (routes/events.ts) used to
// attach a Firestore listener per collection per connection, and attaching a listener READS the whole result set: with
// ~5,000 questions, ~4,500 flashcards, ~500 assessments and thousands of attempts that is a five-figure read bill (and
// megabytes of memory) every time a tab opens. Instead each API write to those collections stamps ONE tiny per-tenant
// document (`hubPings/{tenantId}`, one field per collection) and the stream listens to that single document.
//
//  · Writes are coalesced (≤ one Firestore write per tenant per PING_MS) so a bulk import can't hammer one document.
//  · Only writes made THROUGH the API ping; a seed script writing straight to Firestore doesn't (the client refetches on
//    its own schedule / next visit). That is the trade for not streaming whole collections.
const pings = db.collection("hubPings");
const PING_MS = 700;

const pending = new Map<string, { fields: Set<string>; timer: ReturnType<typeof setTimeout> }>();

export function pingHub(tenantId: string, ...collections: string[]) {
  if (!tenantId || !collections.length) return;
  const cur = pending.get(tenantId);
  if (cur) { for (const c of collections) cur.fields.add(c); return; }
  const fields = new Set(collections);
  const timer = setTimeout(() => {
    pending.delete(tenantId);
    const at = new Date().toISOString();
    const data: Record<string, unknown> = { tenantId, updatedAt: at };
    for (const f of fields) data[f] = at;
    void pings.doc(tenantId).set(data, { merge: true }).catch((e) => console.error("[hubPing]", (e as Error).message));
  }, PING_MS);
  timer.unref?.();
  pending.set(tenantId, { fields, timer });
}

export const hubPingRef = (tenantId: string) => pings.doc(tenantId);
