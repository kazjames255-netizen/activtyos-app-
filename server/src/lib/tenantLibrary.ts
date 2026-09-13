import { db } from "../firebase";

// A franchise edits its OWN Setup, stored at libraries/{tenantId}__fr__{franchiseId}
// (see routes/library.ts). Anything that ENFORCES a setting has to read that
// same doc, or the franchise's switch is decorative: on 12 Sept a franchise
// turned on "a witness is required for each dose" and the API still took a
// dose without one, because the gate read the head office's doc.
//
// Resolution: the franchise's own doc when it exists, else the head office's —
// exactly how GET /api/library seeds a franchise that has never opened Setup.

export function libraryDocId(tenantId: string, franchiseId?: string | null): string {
  return franchiseId ? `${tenantId}__fr__${franchiseId}` : tenantId;
}

/** The library doc whose settings apply to this tenant — or to one franchise
 *  inside it. Never throws on a missing doc; returns {} instead. */
export async function loadLibrary(tenantId: string, franchiseId?: string | null): Promise<Record<string, unknown>> {
  if (franchiseId) {
    const fr = await db.collection("libraries").doc(libraryDocId(tenantId, franchiseId)).get();
    if (fr.exists) return fr.data() ?? {};
  }
  const snap = await db.collection("libraries").doc(tenantId).get();
  return snap.data() ?? {};
}

/** Just the Setup & features bag. */
export async function loadSettings(tenantId: string, franchiseId?: string | null): Promise<Record<string, unknown>> {
  return ((await loadLibrary(tenantId, franchiseId)).settings as Record<string, unknown> | undefined) ?? {};
}

/** Which franchise (if any) looks after this child: the franchiseId on any of
 *  the child's bookings in this tenant. Used where a setting must follow the
 *  CHILD rather than whoever is signed in — head office recording a dose for a
 *  franchise's child is still bound by that franchise's medication rules. */
export async function franchiseForChild(tenantId: string, childId: string | null | undefined): Promise<string | null> {
  if (!childId) return null;
  const snap = await db.collection("bookings").where("tenantId", "==", tenantId).where("childId", "==", childId).get();
  for (const d of snap.docs) {
    const f = (d.data() as { franchiseId?: string | null }).franchiseId;
    if (f) return f;
  }
  // A sibling on a joint booking is only in kids[] (the booking's childId is
  // the first child) — look there too, among the franchise-owned bookings.
  // (Filtered here, not with a `!=` query — that needs a composite index.)
  const fr = await db.collection("bookings").where("tenantId", "==", tenantId).get();
  for (const d of fr.docs) {
    const b = d.data() as { franchiseId?: string | null; kids?: { childId?: string }[] };
    if (b.franchiseId && b.kids?.some((k) => k.childId === childId)) return b.franchiseId;
  }
  return null;
}

/** The effective library DOCUMENT (for callers that want a snapshot): the
 *  franchise's own when it has one, else head office's. */
export async function librarySnap(tenantId: string, franchiseId?: string | null): Promise<FirebaseFirestore.DocumentSnapshot> {
  if (franchiseId) {
    const fr = await db.collection("libraries").doc(libraryDocId(tenantId, franchiseId)).get();
    if (fr.exists) return fr;
  }
  return db.collection("libraries").doc(tenantId).get();
}
