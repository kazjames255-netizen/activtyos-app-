import { FieldValue } from "firebase-admin/firestore";
import { db } from "../firebase";
import { addDays, ukToday } from "./ukDate";
import { whereEmail } from "./emailCase";

// Two owner decisions of 10 Oct 2026 (UK GDPR Art 17 erasure, Art 5 storage limitation; solicitor to confirm):
//
//  1. Deleting a child removes or anonymises its PHOTOS and MOMENTS within 30 days. Deleting the child (DELETE /api/my/children/:id)
//     stamps `erasureDueAt`; the daily sweep `childPhotoErasure` does the work once that date passes. What is NOT touched, because the
//     provider must keep it: safeguarding concerns, accidents / incidents, registers, bookings, medication records.
//       - a moment that shows only this child (or its work) is deleted with its photo file;
//       - a group moment keeps its other children: this child is untagged and its parent's comments go. The photo is deleted too when
//         it is a photo of children, because the face cannot be taken out of a shared picture (open question for the owner).
//  2. A provider's access to a child's plan (EHCP / SEND file) ends 90 days after the family's last booking with that provider.
//     `planAccessExpiry` removes the tenant from the file's `tenantIds`; the parent keeps the file, and booking again re-grants it.
//
// Both sweeps are idempotent (a second run finds nothing due) and only ever touch the child's / file's own documents.

export const ERASURE_DAYS = 30;
export const PLAN_ACCESS_DAYS = 90;

/** When a child deleted at `archivedAt` must be photo-free by. */
export const erasureDueFor = (archivedAtIso: string): string => new Date(new Date(archivedAtIso).getTime() + ERASURE_DAYS * 86_400_000).toISOString();

const imageId = (url: unknown): string | null => {
  const m = typeof url === "string" ? url.match(/\/api\/images\/([A-Za-z0-9_-]+)/) : null;
  return m ? m[1] : null;
};

async function deleteImage(url: unknown): Promise<boolean> {
  const id = imageId(url);
  if (!id) return false;
  await db.collection("images").doc(id).delete();
  return true;
}

export interface ErasureResult { momentsDeleted: number; momentsUntagged: number; photosDeleted: number }

/** Remove / anonymise one child's photos and moments. Safe to run twice. */
export async function erasePhotosAndMoments(childId: string): Promise<ErasureResult> {
  const res: ErasureResult = { momentsDeleted: 0, momentsUntagged: 0, photosDeleted: 0 };
  const childRef = db.collection("children").doc(childId);
  const child = await childRef.get();
  const parentUid = child.exists ? (child.get("parentUid") as string | undefined) : undefined;

  const moments = await db.collection("moments").where("childIds", "array-contains", childId).get();
  for (const m of moments.docs) {
    const d = m.data() as { childIds?: string[]; childNames?: string[]; photoUrl?: string; photoType?: string; comments?: { role?: string; by?: string }[] };
    const ids = d.childIds ?? [];
    const names = d.childNames ?? [];
    const keep = ids.map((id, i) => ({ id, name: names[i] ?? "" })).filter((x) => x.id !== childId);
    const noteIds = await db.collection("notifications").where("ref", "==", m.id).get();
    const dropBells = () => Promise.all(noteIds.docs.filter((n) => n.get("category") === "moment").map((n) => n.ref.delete()));
    if (!keep.length) {
      if (await deleteImage(d.photoUrl)) res.photosDeleted++;
      await dropBells();
      await m.ref.delete();
      res.momentsDeleted++;
      continue;
    }
    const patch: Record<string, unknown> = {
      childIds: keep.map((x) => x.id),
      childNames: keep.map((x) => x.name),
      comments: (d.comments ?? []).filter((c) => !(c.role === "parent" && parentUid && c.by === parentUid)),
    };
    if (d.photoType !== "work" && d.photoUrl) {
      if (await deleteImage(d.photoUrl)) res.photosDeleted++;
      patch.photoUrl = FieldValue.delete();
      patch.photoRemovedForErasure = true;
    }
    await dropBells();
    await m.ref.set(patch, { merge: true });
    res.momentsUntagged++;
  }

  // The child's own profile photo, and any photo consent: gone with the photos.
  if (child.exists) {
    const own = child.get("photo");
    const patch: Record<string, unknown> = { photoConsent: false, photosErasedAt: new Date().toISOString(), erasureDueAt: FieldValue.delete() };
    if (own !== undefined) {
      if (await deleteImage(own)) res.photosDeleted++;
      patch.photo = FieldValue.delete();
    }
    await childRef.set(patch, { merge: true });
  }
  return res;
}

/** One-off: children deleted before this rule existed get a due date of (deleted at + 30 days). Marked done in `sweepState`. */
async function backfillErasureDates(): Promise<void> {
  const flag = db.collection("sweepState").doc("childErasureBackfill");
  if ((await flag.get()).exists) return;
  const old = await db.collection("children").where("archived", "==", true).get();
  for (const d of old.docs) {
    if (d.get("erasureDueAt") || d.get("photosErasedAt") || !d.get("archivedAt")) continue;
    await d.ref.set({ erasureDueAt: erasureDueFor(String(d.get("archivedAt"))) }, { merge: true });
  }
  await flag.set({ at: new Date().toISOString() });
}

/** Daily sweep: every deleted child whose 30 days are up loses its photos and moments. Idempotent. */
export async function childPhotoErasure(nowIso: string = new Date().toISOString()): Promise<ErasureResult & { children: number }> {
  await backfillErasureDates();
  const total = { momentsDeleted: 0, momentsUntagged: 0, photosDeleted: 0, children: 0 };
  const due = await db.collection("children").where("erasureDueAt", "<=", nowIso).limit(200).get();
  for (const c of due.docs) {
    if (c.get("archived") !== true) { await c.ref.set({ erasureDueAt: FieldValue.delete() }, { merge: true }); continue; } // never erase a live child
    const r = await erasePhotosAndMoments(c.id);
    total.momentsDeleted += r.momentsDeleted; total.momentsUntagged += r.momentsUntagged; total.photosDeleted += r.photosDeleted; total.children++;
  }
  if (total.children) console.log(`[sweeps] child-photo-erasure: ${total.children} child(ren), ${total.momentsDeleted} moment(s) deleted, ${total.momentsUntagged} untagged, ${total.photosDeleted} photo file(s) removed`);
  return total;
}

// ── Plan access ───────────────────────────────────────────────────────────

/** Record when a tenant was given a plan, and schedule its first review. Called by grantPlanAccess. */
export const planGrantFields = (tenantId: string) => ({
  [`tenantGrants.${tenantId}`]: new Date().toISOString(),
  accessReviewDue: addDays(ukToday(), PLAN_ACCESS_DAYS),
});

async function backfillAccessReviews(): Promise<void> {
  const flag = db.collection("sweepState").doc("planAccessBackfill");
  if ((await flag.get()).exists) return;
  const all = await db.collection("childFiles").get(); // top-level docs only (chunks are a subcollection)
  for (const d of all.docs) {
    const t = d.get("tenantIds");
    if (Array.isArray(t) && t.length && !d.get("accessReviewDue")) await d.ref.set({ accessReviewDue: ukToday() }, { merge: true });
  }
  await flag.set({ at: new Date().toISOString() });
}

/** The last day a family has a (not cancelled) booking with each provider, for the given children. */
async function lastBookingDays(ownerEmail: string, childIds: Set<string>): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!ownerEmail || !childIds.size) return out;
  const bs = await whereEmail(db, "bookings", "email", ownerEmail);
  const blockEnd = new Map<string, string | null>();
  for (const d of bs.docs) {
    const b = d.data() as { tenantId?: string; childId?: string; kids?: { childId?: string; cancelled?: boolean }[]; status?: string; days?: string[]; blockId?: string; createdAt?: string };
    if (!b.tenantId || ["Cancelled", "Declined"].includes(b.status ?? "")) continue;
    if (!(b.childId && childIds.has(b.childId)) && !b.kids?.some((k) => k.childId && childIds.has(k.childId) && !k.cancelled)) continue;
    let last = [...(b.days ?? [])].sort().pop();
    if (!last && b.blockId) {
      if (!blockEnd.has(b.blockId)) blockEnd.set(b.blockId, ((await db.collection("blocks").doc(b.blockId).get()).get("endDate") as string | undefined) ?? null);
      last = blockEnd.get(b.blockId) ?? undefined;
    }
    last = last ?? String(b.createdAt ?? "").slice(0, 10);
    if (last && last > (out.get(b.tenantId) ?? "")) out.set(b.tenantId, last);
  }
  return out;
}

/** Daily sweep: a provider's access to a child's plan ends 90 days after the family's last booking with them. Idempotent. */
export async function planAccessExpiry(today: string = ukToday()): Promise<{ checked: number; revoked: number }> {
  await backfillAccessReviews();
  let checked = 0, revoked = 0;
  const due = await db.collection("childFiles").where("accessReviewDue", "<=", today).limit(300).get();
  for (const f of due.docs) {
    checked++;
    const tenants = ((f.get("tenantIds") as string[] | undefined) ?? []);
    if (!tenants.length) { await f.ref.set({ accessReviewDue: FieldValue.delete() }, { merge: true }); continue; }
    const kids = await db.collection("children").where("sendPlanId", "==", f.id).get();
    const owner = String((await db.collection("users").doc(String(f.get("ownerUid"))).get()).get("email") ?? "");
    const last = await lastBookingDays(owner, new Set(kids.docs.map((k) => k.id)));
    const grants = (f.get("tenantGrants") ?? {}) as Record<string, string>;
    const fallback = String(f.get("createdAt") ?? "").slice(0, 10) || today;
    const keep: string[] = [];
    let next: string | null = null;
    for (const t of tenants) {
      const end = last.get(t) ?? (grants[t] ? grants[t].slice(0, 10) : fallback);
      const expires = addDays(end, PLAN_ACCESS_DAYS);
      if (expires <= today) { revoked++; continue; }
      keep.push(t);
      if (!next || expires < next) next = expires;
    }
    const patch: Record<string, unknown> = { accessReviewDue: next ?? FieldValue.delete() };
    if (keep.length !== tenants.length) {
      patch.tenantIds = keep;
      for (const t of tenants.filter((x) => !keep.includes(x))) patch[`tenantGrants.${t}`] = FieldValue.delete();
    }
    await f.ref.update(patch);
  }
  if (revoked) console.log(`[sweeps] plan-access-expiry: ended ${revoked} provider grant(s) older than ${PLAN_ACCESS_DAYS} days after the last booking`);
  return { checked, revoked };
}
