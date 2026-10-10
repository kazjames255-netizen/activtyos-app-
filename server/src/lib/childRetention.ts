import { FieldValue } from "firebase-admin/firestore";
import { db } from "../firebase";
import { addDays, ukToday } from "./ukDate";
import { whereEmail } from "./emailCase";
import { skipTenant } from "./testTenant";

// Two owner decisions of 10 Oct 2026 (UK GDPR Art 17 erasure, Art 5 storage limitation; solicitor to confirm):
//
//  1. Deleting a child removes or anonymises its PHOTOS and MOMENTS within 30 days; at the same moment the profile is ANONYMISED
//     (doc id and links kept, name -> "Deleted child", everything else dropped) and the plan file is deleted outright. Deleting the child (DELETE /api/my/children/:id)
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

export const DELETED_CHILD_LABEL = "Deleted child";

/** What is left of a deleted child's profile: the same document id and links (parent, deletion dates) so bookings, registers, accident,
 *  safeguarding and medication records still resolve to it, a neutral name and the birth YEAR only (statutory records may need an age
 *  band). Every other field - dob, age, allergies, medical, SEND, contacts, collection password, likes, answers, notes, photo, consent,
 *  plan link and any free text - is dropped because the replacement is an allow-list. */
export function anonymisedChild(c: Record<string, unknown>): Record<string, unknown> {
  const by = /^(\d{4})-/.exec(String(c.dob ?? ""));
  return {
    name: DELETED_CHILD_LABEL,
    parentUid: c.parentUid ?? null,
    archived: true,
    ...(c.archivedAt ? { archivedAt: c.archivedAt } : {}),
    ...(c.createdAt ? { createdAt: c.createdAt } : {}),
    ...(by ? { birthYear: Number(by[1]) } : (typeof c.birthYear === "number" ? { birthYear: c.birthYear } : {})),
    photoConsent: false,
    photosErasedAt: new Date().toISOString(),
    anonymisedAt: new Date().toISOString(),
  };
}

/** Delete the child's plan (EHCP / SEND) file completely: the document, every stored chunk of the upload, and with it every provider
 *  grant. Left alone if another (live) child still points at the same file. */
async function deletePlanFile(childId: string, fileId: string | undefined): Promise<void> {
  if (!fileId) return;
  const others = await db.collection("children").where("sendPlanId", "==", fileId).get();
  if (others.docs.some((o) => o.id !== childId && o.get("archived") !== true)) return;
  const ref = db.collection("childFiles").doc(fileId);
  const chunks = await ref.collection("chunks").get();
  for (let i = 0; i < chunks.docs.length; i += 400) {
    const batch = db.batch();
    chunks.docs.slice(i, i + 400).forEach((c) => batch.delete(c.ref));
    await batch.commit();
  }
  await ref.delete();
}

/** The provider's thin child list on the family's record (customers.children) names the child too: swap the name for the label. */
async function anonymiseCrmEntries(childId: string, parentUid: string | undefined): Promise<void> {
  if (!parentUid) return;
  const email = String((await db.collection("users").doc(parentUid).get()).get("email") ?? "");
  if (!email) return;
  const recs = await whereEmail(db, "customers", "email", email);
  for (const r of recs.docs) {
    const kids = (r.get("children") ?? []) as Record<string, unknown>[];
    if (!kids.some((k) => k?.childId === childId)) continue;
    await r.ref.update({ children: kids.map((k) => (k?.childId === childId ? { name: DELETED_CHILD_LABEL, childId } : k)) });
  }
}

export interface ErasureResult { momentsDeleted: number; momentsUntagged: number; photosDeleted: number; failures: number }

/** A failure is logged with ids and the error class only (never a child's text) so one bad record cannot block the rest. */
const fail = (what: string, ids: string, e: unknown) => console.error(`[retention] ${what} failed ${ids}: ${(e as Error)?.name ?? "Error"}`);

/** Remove / anonymise one child's photos and moments. Safe to run twice. */
export async function erasePhotosAndMoments(childId: string): Promise<ErasureResult> {
  const res: ErasureResult = { momentsDeleted: 0, momentsUntagged: 0, photosDeleted: 0, failures: 0 };
  const childRef = db.collection("children").doc(childId);
  const child = await childRef.get();
  const parentUid = child.exists ? (child.get("parentUid") as string | undefined) : undefined;

  const moments = await db.collection("moments").where("childIds", "array-contains", childId).get();
  for (const m of moments.docs) {
   try {
    if (await skipTenant(m.get("tenantId") as string | undefined)) continue; // a test tenant's data is left to its own cleanup (SWEEPS_SKIP_TEST_TENANTS)
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
    await m.ref.update(patch).catch(() => undefined); // update, not set: a moment the provider deleted meanwhile must not be recreated
    res.momentsUntagged++;
   } catch (e) { res.failures++; fail("moment", `child=${childId} moment=${m.id}`, e); }
  }
  // A moment that could not be cleaned means the child is NOT anonymised yet: its due date stays, so the next run retries it.
  if (res.failures) return res;

  // The child's own profile photo goes, then the profile itself is ANONYMISED and the plan file deleted (owner decisions 10 Oct).
  if (child.exists) {
    const own = child.get("photo");
    if (own !== undefined && (await deleteImage(own))) res.photosDeleted++;
    await deletePlanFile(childId, child.get("sendPlanId") as string | undefined);
    await anonymiseCrmEntries(childId, parentUid);
    await childRef.set(anonymisedChild(child.data() as Record<string, unknown>)); // REPLACES the document: nothing not listed survives
  }
  return res;
}

/** ONE-OFF (server/src/childRetentionBackfill.ts, dry run by default): children deleted before this rule existed get a due date of
 *  (deleted at + 30 days). Those already past 30 days lose their photos on the next sweep, so take the count first. */
export async function backfillErasureDates(apply: boolean): Promise<{ candidates: number; alreadyPastDue: number; withPlanFile: number; erasedNotAnonymised: number }> {
  const old = await db.collection("children").where("archived", "==", true).get();
  let candidates = 0, alreadyPastDue = 0, withPlanFile = 0, erasedNotAnonymised = 0;
  const nowIso = new Date().toISOString();
  for (const d of old.docs) {
    if (d.get("anonymisedAt") || d.get("erasureDueAt")) continue;
    // Photos were already erased (an earlier version of the sweep) but the profile was not anonymised: do that on the next sweep.
    if (d.get("photosErasedAt")) { erasedNotAnonymised++; if (d.get("sendPlanId")) withPlanFile++; if (apply) await d.ref.set({ erasureDueAt: nowIso }, { merge: true }); continue; }
    if (!d.get("archivedAt")) continue;
    const due = erasureDueFor(String(d.get("archivedAt")));
    candidates++;
    if (d.get("sendPlanId")) withPlanFile++;
    if (due <= nowIso) alreadyPastDue++;
    if (apply) await d.ref.set({ erasureDueAt: due }, { merge: true });
  }
  return { candidates, alreadyPastDue, withPlanFile, erasedNotAnonymised };
}

/** Daily sweep: every deleted child whose 30 days are up loses its photos and moments. Idempotent. */
export async function childPhotoErasure(nowIso: string = new Date().toISOString()): Promise<ErasureResult & { children: number }> {
  const total = { momentsDeleted: 0, momentsUntagged: 0, photosDeleted: 0, children: 0, failures: 0 };
  const due = await db.collection("children").where("erasureDueAt", "<=", nowIso).limit(200).get();
  for (const c of due.docs) {
    try {
      if (c.get("archived") !== true) { await c.ref.set({ erasureDueAt: FieldValue.delete() }, { merge: true }); continue; } // never erase a live child
      const r = await erasePhotosAndMoments(c.id);
      total.momentsDeleted += r.momentsDeleted; total.momentsUntagged += r.momentsUntagged; total.photosDeleted += r.photosDeleted; total.failures += r.failures;
      if (r.failures) continue;
      total.children++;
    } catch (e) { total.failures++; fail("child", `child=${c.id}`, e); }
  }
  if (total.children) console.log(`[sweeps] child-photo-erasure: ${total.children} child(ren), ${total.momentsDeleted} moment(s) deleted, ${total.momentsUntagged} untagged, ${total.photosDeleted} photo file(s) removed`);
  if (total.failures) console.error(`[retention] child-photo-erasure: ${total.failures} failure(s), retried next run`);
  return total;
}

// ── Plan access ───────────────────────────────────────────────────────────

/** Record when a tenant was given a plan, and schedule its first review. Called by grantPlanAccess. */
export const planGrantFields = (tenantId: string, existingDue?: string | null) => {
  const mine = addDays(ukToday(), PLAN_ACCESS_DAYS);
  return {
    [`tenantGrants.${tenantId}`]: new Date().toISOString(),
    // The EARLIEST review stands: another provider's access that is already due must not be pushed out by this grant (the sweep works
    // out each provider's real end date from its own last booking and reschedules).
    accessReviewDue: existingDue && existingDue < mine ? existingDue : mine,
  };
};

/** ONE-OFF (server/src/childRetentionBackfill.ts, dry run by default): every plan file that already has provider grants becomes due for
 *  review today, so a provider whose last booking is over 90 days old is removed on the next sweep. Take the count first. */
export async function backfillAccessReviews(apply: boolean): Promise<{ candidates: number }> {
  const all = await db.collection("childFiles").get(); // top-level docs only (chunks are a subcollection)
  let candidates = 0;
  for (const d of all.docs) {
    const t = d.get("tenantIds");
    if (!(Array.isArray(t) && t.length) || d.get("accessReviewDue")) continue;
    candidates++;
    if (apply) await d.ref.set({ accessReviewDue: ukToday() }, { merge: true });
  }
  return { candidates };
}

/** A booking that is a real place: Confirmed (paid, funded or still to pay) and not refunded. Waitlisted, Offered, Approval needed,
 *  Cancelled and Declined are not, nor is a Confirmed one whose money has been given back. */
export const isRealPlace = (b: { status?: string; pay?: string }): boolean => b.status === "Confirmed" && !["Refunded", "Refund pending"].includes(b.pay ?? "");

/** The last day a family has a real place with each provider, for the given children. Found by the CHILD (any booker email that
 *  booked it), by the file owner's account email, and by every other email those bookings were made under. */
async function lastBookingDays(ownerEmails: string[], childIds: Set<string>): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!childIds.size) return out;
  const seen = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  const add = (q: { docs: FirebaseFirestore.QueryDocumentSnapshot[] }) => q.docs.forEach((d) => seen.set(d.id, d));
  const emails = new Set(ownerEmails.map((e) => e.trim().toLowerCase()).filter(Boolean));
  for (const id of childIds) {
    const q = await db.collection("bookings").where("childId", "==", id).get();
    add(q);
    for (const d of q.docs) { const e = String(d.get("email") ?? "").trim().toLowerCase(); if (e) emails.add(e); }
  }
  for (const e of emails) add(await whereEmail(db, "bookings", "email", e));
  const blockEnd = new Map<string, string | null>();
  for (const d of seen.values()) {
    const b = d.data() as { tenantId?: string; childId?: string; kids?: { childId?: string; cancelled?: boolean }[]; status?: string; pay?: string; days?: string[]; blockId?: string; createdAt?: string };
    if (!b.tenantId || !isRealPlace(b)) continue;
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
export async function planAccessExpiry(today: string = ukToday()): Promise<{ checked: number; revoked: number; failures: number }> {
  let checked = 0, revoked = 0, failures = 0;
  const due = await db.collection("childFiles").where("accessReviewDue", "<=", today).limit(300).get();
  for (const f of due.docs) {
   checked++;
   try {
    const tenants = ((f.get("tenantIds") as string[] | undefined) ?? []);
    if (!tenants.length) { await f.ref.set({ accessReviewDue: FieldValue.delete() }, { merge: true }); continue; }
    const kids = await db.collection("children").where("sendPlanId", "==", f.id).get();
    const owner = String((await db.collection("users").doc(String(f.get("ownerUid"))).get()).get("email") ?? "");
    const last = await lastBookingDays([owner], new Set(kids.docs.map((k) => k.id)));
    const grants = (f.get("tenantGrants") ?? {}) as Record<string, string>;
    const fallback = String(f.get("createdAt") ?? "").slice(0, 10) || today;
    const keep: string[] = [];
    let next: string | null = null;
    for (const t of tenants) {
      if (await skipTenant(t)) { keep.push(t); continue; } // a test tenant's grant is left alone (SWEEPS_SKIP_TEST_TENANTS)
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
   } catch (e) { failures++; fail("plan file", `file=${f.id}`, e); }
  }
  if (revoked) console.log(`[sweeps] plan-access-expiry: ended ${revoked} provider grant(s) older than ${PLAN_ACCESS_DAYS} days after the last booking`);
  if (failures) console.error(`[retention] plan-access-expiry: ${failures} failure(s), retried next run`);
  return { checked, revoked, failures };
}
