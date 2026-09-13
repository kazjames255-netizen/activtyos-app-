import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "../firebase";
import { esc } from "../lib/html";
import { bareImageUrl, signImageUrl } from "../lib/signing";
import { franchiseChildIds, isFranchise } from "../lib/franchiseScope";
import type { Role } from "../middleware/role";
import { countsTowardCapacity, type BlockDoc } from "../lib/blockDomain";
import { fromDoc, type BookingDoc } from "../lib/bookingDoc";
import { notify, parentEmailForChild } from "../lib/notify";
import { ukToday } from "../lib/ukDate";
import { siteChildIds, siteRecordFilter, staffSiteScope } from "../lib/siteScope";
import { customerAreaOn } from "../lib/customerArea";

// ─────────────────────────────────────────────────────────────────────────
// Moments (Pupils) — the photos a provider shares of the day, and the feed a
// parent sees of their own child.
//
// The rule that governs everything here: PHOTO CONSENT. A child may only be
// tagged in a moment if their record has `photoConsent: true`. It's enforced
// server-side on every create/edit — a child whose family said "no photos"
// can never appear, regardless of what the client sends.
//
// Operators and staff post; a parent sees moments featuring their children
// (cross-provider — a family's feed spans everywhere their child goes).
// ─────────────────────────────────────────────────────────────────────────

export const moments = Router();

const col = db.collection("moments");
const canPost = (role: Role) =>
  role === "staff" || role === "company" || role === "freelancer" || role === "franchise";
const canManage = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";

const momentBase = z.object({
  photoUrl: z.string().max(500).optional(), // uploaded via /api/uploads first; optional so a text-only highlight can be shared
  caption: z.string().trim().max(500).optional(),
  activity: z.string().trim().max(60).optional(), // e.g. "Arts & crafts", "Swimming"
  photoType: z.enum(["child", "work"]).default("child"), // "work" = a photo of their work (no faces → no consent needed)
  date: z.string().max(10).optional(),
  blockId: z.string().max(60).optional(),
  listingId: z.string().max(60).optional(),
  childIds: z.array(z.string().max(60)).max(30).default([]),
});
const momentSchema = momentBase.refine((d) => d.photoUrl || d.caption, { message: "Add a photo or a highlight" });

// Resolve tagged children → names. A CHILD photo requires photo consent for
// every tagged child; a WORK photo (no faces in shot) does not.
async function resolveChildren(
  childIds: string[],
  requireConsent: boolean,
): Promise<{ ok: true; names: Record<string, string> } | { ok: false; blocked: string }> {
  if (!childIds.length) return { ok: true, names: {} };
  const docs = await db.getAll(...childIds.map((id) => db.collection("children").doc(id)));
  const names: Record<string, string> = {};
  for (const d of docs) {
    if (!d.exists) return { ok: false, blocked: "a child who no longer exists" };
    const c = d.data() as { name?: string; photoConsent?: boolean };
    if (requireConsent && c.photoConsent !== true) return { ok: false, blocked: c.name ?? "a child" };
    names[d.id] = c.name ?? "";
  }
  return { ok: true, names };
}

const todayIso = () => ukToday();

/** Staff assigned to certain sites (a site lead) see, tag and act on moments
 *  from those sites only — or ones they posted themselves. */
const siteMomentFilter = (req: Request) => {
  const me = req.user?.email ?? req.user?.uid;
  return siteRecordFilter(req.auth!, (m) => !!me && m.postedBy === me);
};
async function siteMayTag(req: Request, childIds: string[], listingId?: string): Promise<boolean> {
  const site = await staffSiteScope(req.auth!);
  if (!site) return true;
  if (listingId && !site.listings.has(listingId)) return false;
  if (!childIds.length) return true;
  const kids = await siteChildIds(req.auth!.tenantId!, site);
  return childIds.every((c) => kids.has(c));
}

// POST /api/moments — share a moment (operators + staff).
moments.post("/", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canPost(auth.role)) {
    res.status(403).json({ error: "Requires an operator or staff account with a tenant" });
    return;
  }
  const parsed = momentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  if (!(await siteMayTag(req, parsed.data.childIds, parsed.data.listingId))) {
    res.status(403).json({ error: "You can only share moments of children at the sites you're assigned to", code: "child_not_yours" });
    return;
  }
  const consent = await resolveChildren(parsed.data.childIds, parsed.data.photoType !== "work");
  if (!consent.ok) {
    res.status(409).json({ error: `${consent.blocked} can't be tagged in a child photo — no photo consent on file. Use “their work” instead.` });
    return;
  }
  const doc = {
    ...parsed.data,
    photoUrl: bareImageUrl(parsed.data.photoUrl),
    date: parsed.data.date ?? todayIso(),
    childNames: parsed.data.childIds.map((id) => consent.names[id] ?? ""),
    tenantId: auth.tenantId,
    postedBy: req.user?.email ?? req.user?.uid ?? "unknown",
    postedByName: req.user?.name ?? req.user?.email ?? "Staff",
    createdAt: new Date().toISOString(),
  };
  const ref = await col.add(doc);

  // Tell the tagged children's families — the parent app already promises
  // "parents are notified & emailed" when a moment is shared. One
  // notification per family, however many of their children are in the shot;
  // an unlinked child (no parent account) simply has nobody to tell.
  const emails = await Promise.all(parsed.data.childIds.map((id) => parentEmailForChild(id)));
  const byFamily = new Map<string, string[]>();
  parsed.data.childIds.forEach((id, i) => {
    const email = emails[i];
    if (!email) return;
    byFamily.set(email, [...(byFamily.get(email) ?? []), consent.names[id] || "your child"]);
  });
  const what = doc.photoType === "work" ? "a photo of their work" : "a new photo";
  await Promise.all(
    [...byFamily].map(([email, names]) =>
      notify({
        tenantId: auth.tenantId!,
        to: { kind: "parent", email },
        category: "moment",
        title: `A new moment featuring ${names.join(" and ")}`,
        body: doc.caption || (doc.activity ? `${doc.activity} — ${what} from the day.` : `${what[0].toUpperCase()}${what.slice(1)} from the day.`),
        subject: `${names.join(" and ")}: a new moment was shared`,
        emailHtml:
          `<p><b>${esc(names.join(" and "))}</b> ${names.length > 1 ? "were" : "was"} featured in ${what} shared today${doc.activity ? ` from <b>${esc(doc.activity)}</b>` : ""}.</p>` +
          (doc.caption ? `<p>“${esc(doc.caption)}”</p>` : "") +
          `<p>See it — and leave a comment — in your Moments feed.</p>`,
        href: "/custdash/moments",
        ref: ref.id,
      }),
    ),
  );

  res.status(201).json({ id: ref.id, ...doc, photoUrl: signImageUrl(doc.photoUrl) });
});

// GET /api/moments — role-aware:
/** Consent is checked when a child is TAGGED — but a parent can withdraw it
 *  afterwards, and the photo stayed published to every family in the session.
 *  Re-check on every read: any child-photo moment tagging a child whose photo
 *  consent is now off is hidden from parents, and flagged for the provider so
 *  they can take it down. Photo links are re-signed on the way out. */
async function forViewing<T extends Record<string, unknown> & { childIds?: string[]; photoType?: unknown; photoUrl?: unknown }>(
  list: T[],
  viewer: "parent" | "team",
): Promise<T[]> {
  const ids = [...new Set(list.filter((m) => m.photoType !== "work").flatMap((m) => m.childIds ?? []))];
  const consent = new Map<string, boolean>();
  for (let i = 0; i < ids.length; i += 300) {
    const snaps = await db.getAll(...ids.slice(i, i + 300).map((id) => db.collection("children").doc(id)));
    for (const d of snaps) consent.set(d.id, d.exists ? d.get("photoConsent") === true : false);
  }
  const withdrawn = (m: T) => m.photoType !== "work" && !!m.photoUrl && (m.childIds ?? []).some((id) => consent.get(id) === false);
  return list
    .filter((m) => viewer === "team" || !withdrawn(m))
    .map((m) => ({ ...m, photoUrl: signImageUrl(m.photoUrl), ...(viewer === "team" && withdrawn(m) ? { consentWithdrawn: true } : {}) }));
}

//   parent          → moments featuring THEIR children (any provider)
//   operator/staff  → the tenant's moments (optional ?date= / ?childId=)
moments.get("/", async (req, res) => {
  const auth = req.auth!;

  if (auth.role === "parent") {
    const kids = await db.collection("children").where("parentUid", "==", req.user!.uid).get();
    const ids = kids.docs.map((d) => d.id).slice(0, 10); // Firestore array-contains-any cap
    if (!ids.length) {
      res.json([]);
      return;
    }
    const snap = await col.where("childIds", "array-contains-any", ids).get();
    // Not from a provider that switched Moments off (Setup → Features / Customer area).
    const tenants = [...new Set(snap.docs.map((d) => String(d.get("tenantId") ?? "")))].filter(Boolean);
    const on = new Map(await Promise.all(tenants.map(async (t) => [t, await customerAreaOn(t, "moments")] as const)));
    const list = snap.docs
      .filter((d) => on.get(String(d.get("tenantId") ?? "")))
      .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))
      .sort((a, b) => (`${(b as { createdAt?: string }).createdAt}` < `${(a as { createdAt?: string }).createdAt}` ? -1 : 1));
    res.json(await forViewing(list as (Record<string, unknown> & { childIds?: string[] })[], "parent"));
    return;
  }

  const tenantId =
    auth.role === "platform" ? (typeof req.query.tenantId === "string" ? req.query.tenantId : null) : auth.tenantId;
  if (!tenantId) {
    res.status(auth.role === "platform" ? 400 : 403).json({ error: "No tenant" });
    return;
  }
  let q = col.where("tenantId", "==", tenantId) as FirebaseFirestore.Query;
  if (typeof req.query.childId === "string") q = q.where("childIds", "array-contains", req.query.childId);
  const snap = await q.get();
  let list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { id: string; date?: string; createdAt?: string; childIds?: string[] })[];
  // A franchise sees moments (child photos) only for ITS OWN children.
  if ((auth.role === "franchise" || auth.role === "staff") && auth.franchiseId) {
    const kids = await franchiseChildIds(tenantId, auth.franchiseId);
    list = list.filter((m) => (m.childIds ?? []).some((cid) => kids.has(cid)));
  }
  const inSite = await siteMomentFilter(req);
  if (inSite) list = list.filter(inSite);
  if (typeof req.query.date === "string") list = list.filter((x) => x.date === req.query.date);
  list.sort((a, b) => (`${b.createdAt}` < `${a.createdAt}` ? -1 : 1));
  res.json(await forViewing(list, "team"));
});

// GET /api/moments/taggable?date= — the day's booked children who HAVE photo
// consent (childId + name). The post form offers only these, so a
// non-consented child is never even presented as an option.
moments.get("/taggable", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canPost(auth.role)) {
    res.status(403).json({ error: "Requires an operator or staff account" });
    return;
  }
  const listingId = typeof req.query.listingId === "string" ? req.query.listingId : "";
  // A listing shows everyone ever booked on it; "All my bookings" shows every
  // child booked anywhere. Not date-filtered — you can share a moment about any
  // child you run sessions for.
  const blocks = await db.collection("blocks").where("tenantId", "==", auth.tenantId).get();
  const site = await staffSiteScope(auth);
  const relevant = blocks.docs
    .map((d) => ({ id: d.id, block: d.data() as BlockDoc }))
    .filter(({ block }) => (!listingId || block.listingId === listingId))
    .filter(({ block }) => !site || site.listings.has(block.listingId));
  if (!relevant.length) {
    res.json([]);
    return;
  }
  const bookingSnaps = await Promise.all(
    relevant.map(({ id }) => db.collection("bookings").where("blockId", "==", id).get()),
  );
  const childIds = new Set<string>();
  const parentOf = new Map<string, { parentName: string; email: string; listing: string }>();
  for (const snap of bookingSnaps)
    for (const d of snap.docs) {
      // A franchise (and its staff) tags only its own families (d22s6).
      if (isFranchise(auth) && (d.get("franchiseId") ?? null) !== auth.franchiseId) continue;
      const b = fromDoc(d.data() as BookingDoc);
      if (b.childId && countsTowardCapacity(b.status) && b.status !== "Offered") {
        childIds.add(b.childId);
        if (!parentOf.has(b.childId)) parentOf.set(b.childId, { parentName: b.booker ?? "", email: b.email ?? "", listing: b.listing ?? "" });
      }
    }
  const docs = childIds.size ? await db.getAll(...[...childIds].map((cid) => db.collection("children").doc(cid))) : [];
  // the parent's postcode (captured at signup) lives on their user doc
  const parentUids = [...new Set(docs.filter((d) => d.exists).map((d) => (d.data() as { parentUid?: string }).parentUid).filter((u): u is string => !!u))];
  const userDocs = parentUids.length ? await db.getAll(...parentUids.map((u) => db.collection("users").doc(u))) : [];
  const postcodeOf = new Map<string, string>();
  userDocs.forEach((u) => { if (u.exists) postcodeOf.set(u.id, ((u.data() as { postcode?: string }).postcode ?? "")); });
  // Every booked child + consent flag + who to find them by (parent name, where
  // they live, email, listing). A child photo can only tag consented children;
  // a work photo can tag anyone (client gates it, server enforces it on create).
  const taggable = docs
    .filter((d) => d.exists)
    .map((d) => { const cd = d.data() as { name?: string; photoConsent?: boolean; parentUid?: string }; const p = parentOf.get(d.id) ?? { parentName: "", email: "", listing: "" }; return { childId: d.id, name: cd.name ?? "", photoConsent: cd.photoConsent === true, ...p, postcode: cd.parentUid ? (postcodeOf.get(cd.parentUid) ?? "") : "" }; })
    .sort((a, b) => (a.name < b.name ? -1 : 1));
  res.json(taggable);
});

async function ownMoment(req: Request, id: string) {
  const auth = req.auth!;
  if (!auth.tenantId) return { status: 403 as const };
  const snap = await col.doc(id).get();
  if (!snap.exists || snap.data()!.tenantId !== auth.tenantId) return { status: 404 as const };
  const inSite = await siteMomentFilter(req);
  if (inSite && !inSite(snap.data()!)) return { status: 404 as const };
  return { status: 200 as const, snap };
}

// PUT /api/moments/:id — edit caption/tags (operator or the poster). Re-runs
// the consent check on any newly tagged children.
moments.put("/:id", async (req, res) => {
  const own = await ownMoment(req, req.params.id);
  if (own.status !== 200) {
    res.status(own.status).json({ error: own.status === 403 ? "Requires an operator account" : "Moment not found" });
    return;
  }
  const auth = req.auth!;
  if (!canManage(auth.role) && own.snap.data()!.postedBy !== (req.user?.email ?? req.user?.uid)) {
    res.status(403).json({ error: "Only the provider or whoever posted it can edit this" });
    return;
  }
  const parsed = momentBase.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const patch: Record<string, unknown> = { ...parsed.data, updatedAt: new Date().toISOString() };
  if (parsed.data.photoUrl !== undefined) patch.photoUrl = bareImageUrl(parsed.data.photoUrl);
  if (parsed.data.childIds && !(await siteMayTag(req, parsed.data.childIds, parsed.data.listingId))) {
    res.status(403).json({ error: "You can only tag children at the sites you're assigned to", code: "child_not_yours" });
    return;
  }
  if (parsed.data.childIds) {
    const requireConsent = (parsed.data.photoType ?? (own.snap.data()!.photoType as string | undefined)) !== "work";
    const consent = await resolveChildren(parsed.data.childIds, requireConsent);
    if (!consent.ok) {
      res.status(409).json({ error: `${consent.blocked} can't be tagged in a child photo — no photo consent on file.` });
      return;
    }
    patch.childNames = parsed.data.childIds.map((id: string) => consent.names[id] ?? "");
  }
  await own.snap.ref.set(patch, { merge: true });
  const after = await own.snap.ref.get();
  res.json({ id: after.id, ...after.data(), photoUrl: signImageUrl(after.get("photoUrl")) });
});

// DELETE /api/moments/:id — operators only.
moments.delete("/:id", async (req, res) => {
  const own = await ownMoment(req, req.params.id);
  if (own.status !== 200) {
    res.status(own.status).json({ error: own.status === 403 ? "Requires an operator account" : "Moment not found" });
    return;
  }
  if (!canManage(req.auth!.role)) {
    res.status(403).json({ error: "Only the provider can delete a moment" });
    return;
  }
  await own.snap.ref.delete();
  res.json({ ok: true });
});

// POST /api/moments/:id/comment — a parent whose child is in the moment (or the
// operator/staff) replies. Comments show in the photo area; the operator can
// mark a nice one to use as marketing.
const commentSchema = z.object({ text: z.string().trim().min(1).max(1000) });
moments.post("/:id/comment", async (req, res) => {
  const auth = req.auth!;
  const snap = await col.doc(req.params.id).get();
  if (!snap.exists) { res.status(404).json({ error: "Moment not found" }); return; }
  const m = snap.data()!;
  let allowed = false;
  if (auth.role === "parent") {
    const kids = await db.collection("children").where("parentUid", "==", req.user!.uid).get();
    const ids = new Set(kids.docs.map((d) => d.id));
    allowed = ((m.childIds as string[]) ?? []).some((id) => ids.has(id));
    if (allowed && !(await customerAreaOn(String(m.tenantId), "moments"))) {
      res.status(403).json({ error: "Moments aren't available from this provider at the moment.", code: "area_off" });
      return;
    }
  } else {
    allowed = canPost(auth.role) && m.tenantId === auth.tenantId;
    const inSite = allowed ? await siteMomentFilter(req) : null;
    if (inSite && !inSite(m)) allowed = false;
  }
  if (!allowed) { res.status(403).json({ error: "You can't comment on this moment" }); return; }
  const parsed = commentSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const comment = { by: req.user?.uid ?? req.user?.email ?? "unknown", byName: req.user?.name ?? (auth.role === "parent" ? "Parent" : "Staff"), role: auth.role === "parent" ? "parent" : "staff", text: parsed.data.text, at: new Date().toISOString(), marketing: false };
  const comments = Array.isArray(m.comments) ? m.comments : [];
  await snap.ref.set({ comments: [...comments, comment] }, { merge: true });
  const after = await snap.ref.get();
  res.json({ id: after.id, ...after.data(), photoUrl: signImageUrl(after.get("photoUrl")) });
});

// POST /api/moments/:id/comment/:idx/marketing — operator flips whether a
// comment can be used as marketing (a testimonial).
moments.post("/:id/comment/:idx/marketing", async (req, res) => {
  const own = await ownMoment(req, req.params.id);
  if (own.status !== 200) { res.status(own.status).json({ error: own.status === 403 ? "Requires an operator account" : "Moment not found" }); return; }
  if (!canManage(req.auth!.role)) { res.status(403).json({ error: "Only the provider can do this" }); return; }
  const idx = parseInt(req.params.idx, 10);
  const comments = Array.isArray(own.snap.data()!.comments) ? [...(own.snap.data()!.comments as { marketing?: boolean }[])] : [];
  if (!comments[idx]) { res.status(404).json({ error: "Comment not found" }); return; }
  comments[idx] = { ...comments[idx], marketing: !comments[idx].marketing };
  await own.snap.ref.set({ comments }, { merge: true });
  const after = await own.snap.ref.get();
  res.json({ id: after.id, ...after.data(), photoUrl: signImageUrl(after.get("photoUrl")) });
});
