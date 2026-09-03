import { Router, type Request } from "express";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../firebase";
import type { Role } from "../middleware/role";

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
const canPost = (role: Role) => role === "staff" || role === "company" || role === "freelancer" || role === "franchise";
const canManage = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";

// A call-to-action / link on a post: a label plus either a listing (target = its
// title, opens the listing in-app) or an external url.
const ctaSchema = z.object({ label: z.string().trim().max(60), target: z.string().trim().max(160).optional(), listingId: z.string().trim().max(80).optional(), url: z.string().trim().max(600).optional() }).nullable();
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

// The distinct tenants a parent has any booking with — the providers whose
// feed they're entitled to see.
async function parentTenantIds(email: string) {
  const snap = await db.collection("bookings").where("email", "==", email).get();
  const ids = new Set<string>();
  for (const d of snap.docs) { const t = (d.data() as { tenantId?: string }).tenantId; if (t) ids.add(t); }
  return [...ids].slice(0, 10); // Firestore `in` cap
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
    const tenantIds = await parentTenantIds(email);
    if (!tenantIds.length) { res.json([]); return; }
    const snap = await col.where("tenantId", "in", tenantIds).get();
    // A parent sees a post if it's network-wide (no franchiseId) OR targeted to
    // a franchise they belong to.
    const franSet = await parentFranchiseIds(email);
    const list = (snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { createdAt?: string; pinned?: boolean; status?: string; franchiseId?: string | null })[])
      .filter((p) => (p.status ?? "published") === "published")
      .filter((p) => !p.franchiseId || franSet.has(p.franchiseId));
    list.sort(feedSort);
    res.json(list);
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
  if (auth.role === "franchise" && auth.franchiseId) {
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
  return { status: 200 as const, snap };
}

// PUT /api/posts/:id — operator edit / pin / archive (partial merge).
posts.put("/:id", async (req, res) => {
  const o = await own(req, req.params.id);
  if (o.status !== 200) { res.status(o.status).json({ error: o.status === 403 ? "Only the provider can edit a post" : "Post not found" }); return; }
  const parsed = partialSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  await o.snap.ref.set({ ...parsed.data, editedAt: new Date().toISOString() }, { merge: true });
  const after = await o.snap.ref.get();
  res.json({ id: after.id, ...after.data() });
});

posts.delete("/:id", async (req, res) => {
  const o = await own(req, req.params.id);
  if (o.status !== 200) { res.status(o.status).json({ error: o.status === 403 ? "Only the provider can delete a post" : "Post not found" }); return; }
  await o.snap.ref.delete();
  res.json({ ok: true });
});

// ── Family interactions — anyone signed in who can see the post. These bump
// aggregate counters; per-parent "who reacted / who's coming / who acknowledged"
// is a backend follow-up (see docs/newsfeed-handoff.md).
const reactBody = z.object({ on: z.boolean() });
posts.post("/:id/react", async (req, res) => {
  const parsed = reactBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const ref = col.doc(req.params.id);
  if (!(await ref.get()).exists) { res.status(404).json({ error: "Post not found" }); return; }
  await ref.update({ reactions: FieldValue.increment(parsed.data.on ? 1 : -1) });
  res.json({ ok: true });
});

const rsvpBody = z.object({ choice: z.enum(["yes", "no", "maybe"]), prev: z.enum(["yes", "no", "maybe"]).nullable().optional() });
posts.post("/:id/rsvp", async (req, res) => {
  const parsed = rsvpBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const ref = col.doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) { res.status(404).json({ error: "Post not found" }); return; }
  const { choice, prev } = parsed.data;
  const upd: Record<string, unknown> = { [`rsvp.${choice}`]: FieldValue.increment(1) };
  if (prev && prev !== choice) upd[`rsvp.${prev}`] = FieldValue.increment(-1);
  await ref.update(upd);
  res.json({ ok: true });
});

posts.post("/:id/ack", async (req, res) => {
  const ref = col.doc(req.params.id);
  if (!(await ref.get()).exists) { res.status(404).json({ error: "Post not found" }); return; }
  await ref.update({ seen: FieldValue.increment(1) });
  res.json({ ok: true });
});
