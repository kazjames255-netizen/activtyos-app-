import { db } from "../firebase";
import { ttlCache } from "./ttlCache";

// HQ (platform-role) screens read WHOLE collections (tenants, users, bookings, listings, libraries,
// supportThreads). Several of them fire together when HQ opens a page, and each used to re-read everything.
// This shares one copy of each collection between all of them for a short while. Platform-only callers: the
// data is global, never tenant-scoped, so there is no per-tenant/role keying to get wrong. Callers must treat
// the snapshot as read-only.
const TTL_MS = 45_000;
const snaps = ttlCache<FirebaseFirestore.QuerySnapshot>(TTL_MS);

export function cachedCollection(name: string): Promise<FirebaseFirestore.QuerySnapshot> {
  return snaps.wrap(name, () => db.collection(name).get());
}

/** Call after a write that an HQ screen must show on its very next read. */
export function invalidateCollection(...names: string[]): void {
  if (!names.length) snaps.clear();
  for (const n of names) snaps.clear(n);
}
