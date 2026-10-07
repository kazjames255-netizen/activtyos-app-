import { Router, type Request } from "express";
import { isBlankOrWebUrl } from "../lib/safeUrl";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../firebase";
import type { Role } from "../middleware/role";
import { customerAreaOn } from "../lib/customerArea";

// ─────────────────────────────────────────────────────────────────────────
// Newsfeed (Communication) — a provider's announcements to their families.
// A post has a TEMPLATE (announcement / event / reminder / urgent / celebration
// / booking nudge) which drives its styling and what it carries: an event holds
// a date + RSVP, a booking nudge holds a call-to-action, an urgent notice is
// pinned + acknowledgement-required. Operators + staff post to their tenant,
// optionally scoped to a site or listing; a parent sees the feed of every
// provider they've booked with. Distinct from Moments (photos OF a child).
// ─────────────────────────────────────────────────────────────────────────
export const posts = Router();
const col = db.collection("posts");
class PostNotFound extends Error {}
class PostForbidden extends Error {}
class PostFull extends Error {}
const canPost = (role: Role) => role === "staff" || role === "company" || role === "freelancer" || role === "franchise";
const canManage = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";

// A call-to-action / link on a post: a label plus either a listing (target = its
// title, opens the listing in-app) or an external url.
const ctaSchema = z.object({ label: z.string().trim().max(60), target: z.string().trim().max(160).optional(), listingId: z.string().trim().max(80).optional(), url: z.string().trim().max(600).refine(isBlankOrWebUrl, "Links must be web addresses (https://…)").optional() }).nullable();
// A designed newsletter payload (layout + palette + company + content blocks).
// Block fields are all strings; images are uploaded URLs, so the doc stays small.
const nlBlockSchema = z.object({ t: z.string().max(20) }).catchall(z.union([z.string().max(4_000), z.number()]));
const newsletterSchema = z.object({
  layout: z.string().max(40),
  palette: z.string().max(40),
  company: z.object({ name: z.string().max(120).optional(), phone: z.string().max(60).optional(), email: z.string().max(160).optional(), address: z.string().max(200).optional(), logo: z.string().max(600).optional() }),
  blocks: z.array(nlBlockSchema).max(40),
}).nullable();
const postSchema = z.object({
  tpl: z.enum(["announce", "event", "reminder", "urgent", "celebrate", "booking", "newsletter"]).optional(),
  newsletter: newsletterSchema.optional(),
  title: z.string().trim().max(160).optional(),
  body: z.string().trim().min(1).max(4_000),
  photoUrl: z.string().trim().max(600).optional(),      // uploaded image URL (uses the /api/uploads store)
  imageAspect: z.string().trim().max(8).optional(),     // "full" (whole image) | "16/9" | "1/1" | "4/5"
  imageX: z.number().min(-100).max(100).optional(),     // crop pan X (% of frame)
  imageY: z.number().min(-100).max(100).optional(),     // crop pan Y (% of frame)
  imageZoom: z.number().min(1).max(5).optional(),       // crop zoom (1 = fit)
  priority: z.enum(["normal", "urgent"]).optional(),
  colour: z.string().trim().max(20).optional(),         // accent colour override (hex); default = template colour
  pinned: z.boolean().optional(),                       // stays at the top of the feed
  ackRequired: z.boolean().optional(),                  // families must tap "Got it"
  react: z.boolean().optional(),                        // allow likes/reactions (default on)
  status: z.enum(["draft", "published", "scheduled", "archived"]).optional(),
  audience: z.enum(["all", "site", "listing"]).optional(),
  audId: z.string().trim().max(80).optional(),          // single site/listing id (legacy / one)
  audIds: z.array(z.string().trim().max(80)).max(60).optional(), // multiple listing ids when scoped to several
  audLabel: z.string().trim().max(200).optional(),      // human label ("Listings: Camp A, Camp B")
  date: z.string().trim().max(40).optional(),           // event date
  time: z.string().trim().max(20).optional(),           // event time
  location: z.string().trim().max(160).optional(),      // event location
  capacity: z.number().int().positive().max(100_000).optional(), // event: cap on "yes" RSVPs (unset = unlimited)
  cta: ctaSchema.optional(),                            // booking nudge {label,target}
  publishAt: z.string().trim().max(40).optional(),      // when status==="scheduled"
  folder: z.string().trim().max(80).optional(),         // library folder a newsletter is filed in
  ref: z.string().trim().max(120).optional(),           // operator-only "save as" name, for searching the library
  // Franchise targeting (head office): null/absent = ALL parents across the
  // network; a franchiseId = only that franchise's parents. A franchise's own
  // posts are auto-scoped to itself server-side.
  franchiseId: z.string().trim().max(60).nullable().optional(),
});
const partialSchema = postSchema.partial();

async function tenantName(tenantId: string) {
  const t = await db.collection("tenants").doc(tenantId).get();
  const lib = await db.collection("libraries").doc(tenantId).get();
  const biz = (lib.data()?.settings as { billing?: { businessName?: string } } | undefined)?.billing?.businessName;
  return biz || (t.exists && (t.data()!.name as string)) || "Your activity provider";
}

// A franchise's head-office-granted display name (for attribution/target labels).
async function franchiseNameOf(tenantId: string, franchiseId: string): Promise<string> {
  const snap = await db.collection("users").where("tenantId", "==", tenantId).where("role", "==", "franchise").where("franchiseId", "==", franchiseId).limit(1).get();
  const u = snap.docs[0]?.data() as { franchiseName?: string; name?: string } | undefined;
  return u?.franchiseName || u?.name || "a franchise";
}

// The franchiseIds a parent belongs to (bookings stamped with franchiseId, else
// resolved from the listing owner) — so they see franchise-targeted posts.
async function parentFranchiseIds(email: string): Promise<Set<string>> {
  const snap = await db.collection("bookings").where("email", "==", email).get();
  const set = new Set<string>();
  const listingIds = new Set<string>();
  for (const d of snap.docs) { const b = d.data() as { franchiseId?: string; listingId?: string }; if (b.franchiseId) set.add(b.franchiseId); else if (b.listingId) listingIds.add(b.listingId); }
  if (listingIds.size) {
    const docs = await db.getAll(...[...listingIds].map((id) => db.collection("listings").doc(id)));
    for (const l of docs) { const f = l.exists ? (l.data() as { franchiseId?: string }).franchiseId : undefined; if (f) set.add(f); }
  }
  return set;
}

// The listings a parent has booked (any status) — a post aimed at "chosen families" (audience "listing")
// is for the families of those listings only, not every family of the provider.
async function parentListingIds(email: string): Promise<Set<string>> {
  const snap = await db.collection("bookings").where("email", "==", email).get();
  const set = new Set<string>();
  for (const d of snap.docs) { const l = (d.data() as { listingId?: string }).listingId; if (l) set.add(l); }
  return set;
}
const postListingIds = (p: { audience?: string; audId?: string; audIds?: string[] }): string[] =>
  p.audience === "listing" ? [...(p.audIds ?? []), ...(p.audId ? [p.audId] : [])] : [];

// The distinct tenants a parent has any booking with — the providers whose
// feed they're entitled to see.
async function parentTenantIds(email: string) {
  const snap = await db.collection("bookings").where("email", "==", email).get();
  const ids = new Set<string>();
  for (const d of snap.docs) { const t = (d.data() as { tenantId?: string }).tenantId; if (t) ids.add(t); }
  return [...ids];
}

// pinned first, then newest.
function feedSort(a: { pinned?: boolean; createdAt?: string }, b: { pinned?: boolean; createdAt?: string }) {
  if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
  return `${b.createdAt ?? ""}` < `${a.createdAt ?? ""}` ? -1 : 1;
}

// GET /api/posts — role-aware. Parent: every booked provider's published feed.
posts.get("/", async (req, res) => {
  const auth = req.auth!;
  if (auth.role === "parent") {
    const email = req.user?.email;
    if (!email) { res.status(400).json({ error: "Account has no email address" }); return; }
    // Not from a provider that switched the Newsfeed off (Setup → Features / Customer area).
    const all = await parentTenantIds(email);
    const onFlags = await Promise.all(all.map((t) => customerAreaOn(t, "newsfeed")));
    const tenantIds = all.filter((_, i) => onFlags[i]);
    if (!tenantIds.length) { res.json([]); return; }
    // Firestore's `in` takes at most 10 values — a family with more providers than that is queried in chunks, not silently cut off.
    const chunks = Array.from({ length: Math.ceil(tenantIds.length / 10) }, (_, i) => tenantIds.slice(i * 10, i * 10 + 10));
    const snaps = await Promise.all(chunks.map((c) => col.where("tenantId", "in", c).get()));
    const snap = { docs: snaps.flatMap((x) => x.docs) };
    // A parent sees a post if it's network-wide (no franchiseId) OR targeted to
    // a franchise they belong to.
    const franSet = await parentFranchiseIds(email);
    const myListings = await parentListingIds(email);
    const uid = req.user?.uid ?? "";
    const list = (snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { createdAt?: string; pinned?: boolean; status?: string; franchiseId?: string | null })[])
      .filter((p) => (p.status ?? "published") === "published")
      .filter((p) => !p.franchiseId || franSet.has(p.franchiseId))
      .filter((p) => { const ids = postListingIds(p as { audience?: string; audId?: string; audIds?: string[] }); return !ids.length || ids.some((i) => myListings.has(i)); });
    list.sort(feedSort);
    // Families see the sender as authorLabel ("Head office" / the franchise / the brand) — never a staff member's
    // sign-in email, which postedBy / postedByName carry.
    // The per-person maps (reactedBy / rsvpBy / ackBy, keyed by uid) stay server-side; each parent gets only their OWN state back as `mine`.
    res.json(list.map(({ postedBy: _pb, postedByName: _pn, reactedBy, rsvpBy, ackBy, ...rest }) => ({
      ...rest,
      mine: { reacted: !!(reactedBy as Record<string, true> | undefined)?.[uid], rsvp: (rsvpBy as Record<string, string> | undefined)?.[uid] ?? null, acked: !!(ackBy as Record<string, true> | undefined)?.[uid] },
    })));
    return;
  }
  const tenantId = auth.role === "platform" ? (typeof req.query.tenantId === "string" ? req.query.tenantId : null) : auth.tenantId;
  if (!tenantId) { res.status(403).json({ error: "Requires a tenant account" }); return; }
  const snap = await col.where("tenantId", "==", tenantId).get();
  let list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { createdAt?: string; pinned?: boolean; franchiseId?: string | null })[];
  // A franchise (or a staff member scoped to a franchise) sees network posts
  // from head office + its own franchise's posts; a head office / freelancer
  // sees everything in the tenant.
  if ((auth.role === "franchise" || auth.role === "staff") && auth.franchiseId) {
    list = list.filter((p) => !p.franchiseId || p.franchiseId === auth.franchiseId);
  }
  list.sort(feedSort);
  res.json(list);
});

posts.post("/", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canPost(auth.role)) { res.status(403).json({ error: "Requires an operator or staff account" }); return; }
  const parsed = postSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const d = parsed.data;
  const brand = await tenantName(auth.tenantId);
  // Who's posting + who it targets:
  //  · a FRANCHISE posts only to its own parents, signed with its own name.
  //  · a HEAD OFFICE (company) picks: all-network (franchiseId null) or one
  //    franchise; either way it's signed "Head office".
  //  · anyone else posts to their own families under their brand.
  let targetFr: string | null = null;
  let authorLabel = brand;
  let authorScope: "network" | "franchise" | "own" = "own";
  let targetName: string | null = null;
  if ((auth.role === "franchise" || auth.role === "staff") && auth.franchiseId) {
    targetFr = auth.franchiseId;
    authorLabel = await franchiseNameOf(auth.tenantId, auth.franchiseId);
    authorScope = "franchise";
  } else if (auth.role === "company") {
    targetFr = d.franchiseId ?? null;
    authorLabel = "Head office";
    authorScope = targetFr ? "franchise" : "network";
    if (targetFr) targetName = await franchiseNameOf(auth.tenantId, targetFr);
  }
  const doc = {
    tpl: "announce", priority: "normal", pinned: false, ackRequired: false, react: true, status: "published", audience: "all", cta: null,
    ...d,
    franchiseId: targetFr,                 // TARGET (null = all network)
    authorLabel,                           // who sent it ("Head office" / franchise / brand)
    authorScope,                           // network | franchise | own
    targetName,                            // the franchise name when franchise-targeted
    // Events carry an RSVP tally; everything else doesn't.
    rsvp: d.tpl === "event" ? { yes: 0, no: 0, maybe: 0 } : null,
    seen: 0,
    reactions: 0,
    tenantId: auth.tenantId,
    tenantName: brand,
    postedBy: req.user?.email ?? "unknown",
    postedByName: req.user?.name ?? req.user?.email ?? "Staff",
    createdAt: new Date().toISOString(),
  };
  const ref = await col.add(doc);
  res.status(201).json({ id: ref.id, ...doc });
});

async function own(req: Request, id: string) {
  const auth = req.auth!;
  if (!auth.tenantId || !canManage(auth.role)) return { status: 403 as const };
  const snap = await col.doc(id).get();
  if (!snap.exists || snap.data()!.tenantId !== auth.tenantId) return { status: 404 as const };
  // A franchise (or its staff) may only change posts of ITS OWN franchise — never
  // head office's network posts or a sibling franchise's.
  if (auth.role === "franchise" && auth.franchiseId && (snap.data()!.franchiseId ?? null) !== auth.franchiseId) return { status: 404 as const };
  return { status: 200 as const, snap };
}

// PUT /api/posts/:id — operator edit / pin / archive (partial merge).
posts.put("/:id", async (req, res) => {
  const o = await own(req, req.params.id);
  if (o.status !== 200) { res.status(o.status).json({ error: o.status === 403 ? "Only the provider can edit a post" : "Post not found" }); return; }
  const parsed = partialSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const patch: Record<string, unknown> = { ...parsed.data, editedAt: new Date().toISOString() };
  // A franchise's posts stay targeted at that franchise: it can't re-aim one at the whole network.
  if (req.auth!.role !== "company" && req.auth!.role !== "freelancer") delete patch.franchiseId;
  await o.snap.ref.set(patch, { merge: true });
  const after = await o.snap.ref.get();
  res.json({ id: after.id, ...after.data() });
});

posts.delete("/:id", async (req, res) => {
  const o = await own(req, req.params.id);
  if (o.status !== 200) { res.status(o.status).json({ error: o.status === 403 ? "Only the provider can delete a post" : "Post not found" }); return; }
  await o.snap.ref.delete();
  res.json({ ok: true });
});

// ── Family interactions — anyone signed in who can see the post, and each
// person's own react/RSVP/ack tracked per-person (reactedBy/rsvpBy/ackBy, maps
// keyed by uid on the post doc — a post's audience is small, so this stays far
// lighter than a subcollection) so a repeat call is idempotent rather than a
// free-running counter, and so a future UI can show "who reacted"/"who's
// coming" from real state instead of a raw tally.
type PostData = Record<string, unknown> & {
  tenantId?: string;
  status?: string;
  franchiseId?: string | null;
  reactedBy?: Record<string, true>;
  rsvpBy?: Record<string, "yes" | "no" | "maybe">;
  ackBy?: Record<string, true>;
  rsvp?: { yes?: number; no?: number; maybe?: number } | null;
  capacity?: number;
};

/** Whether this signed-in user may see (and therefore react/RSVP/acknowledge)
 *  this one post — the identical rule GET /posts applies to its list, applied
 *  to a single document by id instead. */
async function canSeePost(req: Request, post: PostData): Promise<boolean> {
  const auth = req.auth!;
  if (!post.tenantId) return false;
  if (auth.role === "parent") {
    const email = req.user?.email;
    if (!email) return false;
    if ((post.status ?? "published") !== "published") return false;
    if (post.franchiseId) {
      const franSet = await parentFranchiseIds(email);
      if (!franSet.has(post.franchiseId)) return false;
    }
    if (!(await customerAreaOn(post.tenantId, "newsfeed"))) return false;
    const aud = postListingIds(post as { audience?: string; audId?: string; audIds?: string[] });
    if (aud.length) { const mine = await parentListingIds(email); if (!aud.some((i) => mine.has(i))) return false; }
    const tenantIds = await parentTenantIds(email);
    return tenantIds.includes(post.tenantId);
  }
  if (!auth.tenantId || post.tenantId !== auth.tenantId) return false;
  if ((auth.role === "franchise" || auth.role === "staff") && auth.franchiseId) {
    return !post.franchiseId || post.franchiseId === auth.franchiseId;
  }
  // Company / freelancer see everything in their own tenant; platform has no
  // tenant of its own here and is denied above.
  return true;
}

/** The uid an interaction is filed under — every signed-in role carries one. */
function actorUid(req: Request): string | null {
  return req.user?.uid || null;
}

const reactBody = z.object({ on: z.boolean() });
posts.post("/:id/react", async (req, res) => {
  const parsed = reactBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const uid = actorUid(req);
  if (!uid) { res.status(401).json({ error: "Sign in required" }); return; }
  const ref = col.doc(req.params.id);
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new PostNotFound();
      const post = snap.data() as PostData;
      if (!(await canSeePost(req, post))) throw new PostForbidden();
      const already = !!post.reactedBy?.[uid];
      const { on } = parsed.data;
      if (on === already) return; // idempotent: no double-count, no double-undo
      tx.update(ref, {
        [`reactedBy.${uid}`]: on ? true : FieldValue.delete(),
        reactions: FieldValue.increment(on ? 1 : -1),
      });
    });
  } catch (e) {
    if (e instanceof PostNotFound) { res.status(404).json({ error: "Post not found" }); return; }
    if (e instanceof PostForbidden) { res.status(403).json({ error: "You can't see this post" }); return; }
    throw e;
  }
  res.json({ ok: true });
});

const rsvpBody = z.object({ choice: z.enum(["yes", "no", "maybe"]) });
posts.post("/:id/rsvp", async (req, res) => {
  const parsed = rsvpBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const uid = actorUid(req);
  if (!uid) { res.status(401).json({ error: "Sign in required" }); return; }
  const ref = col.doc(req.params.id);
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new PostNotFound();
      const post = snap.data() as PostData;
      if (!(await canSeePost(req, post))) throw new PostForbidden();
      const { choice } = parsed.data;
      const prev = post.rsvpBy?.[uid] ?? null;
      if (prev === choice) return; // idempotent: same choice again is a no-op
      const cap = post.capacity;
      if (choice === "yes" && cap != null) {
        const goingNow = post.rsvp?.yes ?? 0;
        // prev === "yes" moving to a different choice never needs a fresh seat.
        if (prev !== "yes" && goingNow >= cap) throw new PostFull();
      }
      const upd: Record<string, unknown> = { [`rsvpBy.${uid}`]: choice, [`rsvp.${choice}`]: FieldValue.increment(1) };
      if (prev && prev !== choice) upd[`rsvp.${prev}`] = FieldValue.increment(-1);
      tx.update(ref, upd);
    });
  } catch (e) {
    if (e instanceof PostNotFound) { res.status(404).json({ error: "Post not found" }); return; }
    if (e instanceof PostForbidden) { res.status(403).json({ error: "You can't see this post" }); return; }
    if (e instanceof PostFull) { res.status(409).json({ error: "This event is full" }); return; }
    throw e;
  }
  res.json({ ok: true });
});

posts.post("/:id/ack", async (req, res) => {
  const uid = actorUid(req);
  if (!uid) { res.status(401).json({ error: "Sign in required" }); return; }
  const ref = col.doc(req.params.id);
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new PostNotFound();
      const post = snap.data() as PostData;
      if (!(await canSeePost(req, post))) throw new PostForbidden();
      if (post.ackBy?.[uid]) return; // idempotent: already acknowledged
      tx.update(ref, { [`ackBy.${uid}`]: true, seen: FieldValue.increment(1) });
    });
  } catch (e) {
    if (e instanceof PostNotFound) { res.status(404).json({ error: "Post not found" }); return; }
    if (e instanceof PostForbidden) { res.status(403).json({ error: "You can't see this post" }); return; }
    throw e;
  }
  res.json({ ok: true });
});
