import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "../firebase";
import { canWrite } from "../middleware/role";
import { blockSummary, type BlockDoc } from "../lib/blockDomain";
import { desiredRuns, syncListingBlocks } from "../lib/listingRuns";
import { resolveBundlePricing, type BundleDoc, type PassDoc, type PeriodDoc } from "../lib/bundlePricing";

export const listings = Router();

const col = db.collection("listings");

// ── Schema ────────────────────────────────────────────────────────────────
// A listing stores the builder's draft near-verbatim (the WizardDraft shape
// in features/listings/ListingWizard.tsx) so the customer page a parent sees
// is exactly what the operator previewed. `name` + `passes` are kept for
// compatibility: `name` mirrors `title`, `passes` is the priced-tickets
// snapshot written by the Blocks builder's "send to listings".
//
// Images must be uploaded first (POST /api/uploads) — data URLs are rejected
// here so a listing document can never blow Firestore's 1MB limit.

const imageSchema = z.object({
  src: z
    .string()
    .min(1)
    .max(500)
    .refine((s) => !s.startsWith("data:"), {
      message: "Upload images via POST /api/uploads and store the returned URL",
    }),
  x: z.number(),
  y: z.number(),
  zoom: z.number(),
});

const passSchema = z.object({
  name: z.string().min(1),
  price: z.number().nonnegative(),
  days: z.number().positive().optional(), // session count, for discount thresholds
});

const discountRuleSchema = z.object({
  id: z.string().max(60),
  kind: z.enum(["person", "session", "early"]),
  name: z.string().max(120),
  passNames: z.array(z.string().max(120)).max(30),
  enabled: z.boolean(),
  moreThan: z.number().int().nonnegative(),
  appliesTo: z.enum(["all", "after1", "second"]),
  method: z.enum(["price", "subtract", "percent"]),
  value: z.number().nonnegative(),
  beforeDate: z.string().max(10),
});

const strArr = z.array(z.string().max(400)).max(100);

const baseListingSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    title: z.string().trim().min(1).max(120).optional(),
    passes: z.array(passSchema).max(30).optional(),
    // media
    images: z.array(imageSchema).max(12).optional(),
    gallery: z.array(imageSchema).max(24).optional(),
    layout: z.string().max(40).optional(),
    // who it's for
    ageFrom: z.string().max(10).optional(),
    ageTo: z.string().max(10).optional(),
    categoryIds: z.array(z.string().max(60)).max(50).optional(),
    heroCategoryId: z.string().max(60).nullable().optional(),
    venueId: z.string().max(60).nullable().optional(),
    allowOutOfRange: z.boolean().optional(),
    // capacity
    maxAttendees: z.string().max(10).optional(),
    capacityScope: z.enum(["day", "listing"]).optional(),
    showSpaces: z.boolean().optional(),
    // content
    headings: z.record(z.string().max(60), z.string().max(200)).optional(),
    descriptionSection: z.string().max(200).optional(),
    description: z.string().max(10_000).optional(),
    sections: z
      .array(z.object({ id: z.string().max(60), type: z.string().max(40), text: z.string().max(5_000) }))
      .max(30)
      .optional(),
    outcomes: strArr.optional(),
    provided: strArr.optional(),
    safety: strArr.optional(),
    send: strArr.optional(),
    // when it runs (the recipe the server turns into dated blocks)
    runFrom: z.string().max(10).optional(),
    runTo: z.string().max(10).optional(),
    blockMode: z.enum(["weekly", "custom"]).optional(),
    days: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    datesOff: z.array(z.string().max(10)).max(400).optional(),
    // tickets
    blockId: z.string().max(60).nullable().optional(), // block bundle
    ticketOverrides: z
      .record(
        z.string().max(60),
        z.object({
          ageFrom: z.string().max(10).optional(),
          ageTo: z.string().max(10).optional(),
          capacity: z.string().max(10).optional(),
        }),
      )
      .optional(),
    bookRules: z.record(z.string().max(60), z.string().max(20)).optional(),
    // extras & team
    addonIds: z.array(z.string().max(60)).max(50).optional(),
    staffIds: z.array(z.string().max(60)).max(50).optional(),
    // policy
    visibility: z.enum(["public", "hidden"]).optional(),
    opensAt: z.string().max(25).optional(), // local datetime; blank = open now
    bookingType: z.enum(["auto", "manual"]).optional(),
    waitlist: z.boolean().optional(),
    // "manual": the operator offers places. "auto": a freed seat is offered
    // to the front of that date's queue automatically (2h hold each).
    waitlistMode: z.enum(["manual", "auto"]).optional(),
    waitlistSize: z.string().max(10).optional(),
    cancellation: z.string().max(2_000).optional(),
    discounts: z.array(discountRuleSchema).max(30).optional(),
    // presentation & lifecycle
    pageStyle: z.enum(["playful", "sport", "navy"]).optional(),
    status: z.enum(["draft", "live"]).optional(),
    archived: z.boolean().optional(),
  });

// Creating needs a name; updating may be a partial patch (e.g. just
// {visibility} or {archived} from the listings-tab quick actions).
const createSchema = baseListingSchema.refine((d) => d.name || d.title, {
  message: "A listing needs a name or title",
});

type ListingInput = z.infer<typeof baseListingSchema>;

/** Fields whose change means the dated blocks must be re-synced. */
const RUN_FIELDS = ["runFrom", "runTo", "blockMode", "days", "datesOff", "maxAttendees", "capacityScope", "blockId"] as const;

function runRecipeOf(doc: Record<string, unknown>) {
  return {
    runFrom: doc.runFrom as string | undefined,
    runTo: doc.runTo as string | undefined,
    blockMode: doc.blockMode as "weekly" | "custom" | undefined,
    days: doc.days as number[] | undefined,
    datesOff: doc.datesOff as string[] | undefined,
    maxAttendees: doc.maxAttendees as string | undefined,
    capacityScope: doc.capacityScope as "day" | "listing" | undefined,
    blockId: doc.blockId as string | null | undefined,
  };
}

// Publishing has requirements the builder already enforces client-side —
// mirrored here so `status: "live"` can't arrive by API with none of them
// (the client-side lock is a courtesy, this is the control). Only checked
// when the WRITE itself publishes; existing live docs aren't re-judged.
function publishProblems(merged: Record<string, unknown>): string[] {
  const problems: string[] = [];
  if (!((merged.title as string) ?? (merged.name as string))?.trim()) problems.push("a name");
  if (!merged.venueId) problems.push("a venue");
  const recipe = runRecipeOf(merged);
  const runs = desiredRuns(recipe, { start: "09:00", end: "15:30" });
  if (!runs.length) problems.push("dates with at least one running day");
  if (!((merged.passes as unknown[]) ?? []).length) problems.push("a block with passes");
  return problems;
}

// Join each listing's real blocks (availability included) onto the response.
// Only the blocks for the listings being returned are read — this used to scan
// the whole `blocks` collection (every tenant's) on every listings request,
// which got slower as the platform grew.
const IN_CHUNK = 30; // Firestore's max values per `in` filter

async function withBlocks(
  docs: { id: string; data: Record<string, unknown> }[],
): Promise<Record<string, unknown>[]> {
  const byListing = new Map<string, ReturnType<typeof blockSummary>[]>();
  const ids = docs.map((d) => d.id);
  if (ids.length) {
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += IN_CHUNK) chunks.push(ids.slice(i, i + IN_CHUNK));
    const snaps = await Promise.all(
      chunks.map((c) => db.collection("blocks").where("listingId", "in", c).get()),
    );
    for (const snap of snaps) {
      for (const d of snap.docs) {
        const b = d.data() as BlockDoc;
        const arr = byListing.get(b.listingId) ?? [];
        arr.push(blockSummary(d.id, b));
        byListing.set(b.listingId, arr);
      }
    }
  }
  return docs.map((d) => ({
    id: d.id,
    ...d.data,
    blocks: (byListing.get(d.id) ?? []).sort((a, b) => (a.startDate < b.startDate ? -1 : 1)),
  }));
}

// GET /api/listings — the browse feed: LIVE, PUBLIC, unarchived listings from
// every provider (feeds the parent marketplace). `hidden` means unlisted, not
// private — those listings only come back from GET /api/listings/:id (the
// direct link). With ?mine=1, ALL of the caller's own tenant's listings
// (drafts and hidden included — the operator management view).
listings.get("/", async (req, res) => {
  if (req.query.mine === "1") {
    const auth = req.auth!;
    if (!auth.tenantId) {
      res.status(403).json({ error: "Requires an operator account with a tenant" });
      return;
    }
    const snap = await col.where("tenantId", "==", auth.tenantId).get();
    const list = await withBlocks(snap.docs.map((d) => ({ id: d.id, data: d.data() })));
    list.sort((a, b) => ((a.name as string) < (b.name as string) ? -1 : 1));
    res.json(list);
    return;
  }
  // ?tenantId= narrows the public feed to ONE provider — the storefront
  // page and embed widget use it ("all of this provider's activities").
  const tenantFilter = typeof req.query.tenantId === "string" ? req.query.tenantId : null;
  const snap = await col.orderBy("name").get();
  const visible = snap.docs.filter((d) => {
    const l = d.data();
    if (tenantFilter && l.tenantId !== tenantFilter) return false;
    return (l.status ?? "live") === "live" && (l.visibility ?? "public") === "public" && !l.archived;
  });
  res.json(await withBlocks(visible.map((d) => ({ id: d.id, data: d.data() }))));
});

// GET /api/listings/:id — the direct link (`/book/{id}` reads this). Returns
// hidden listings too (hidden = unlisted but bookable by link). Drafts and
// archived listings only exist for their own tenant (and platform).
// Embeds everything the customer page needs beyond the doc itself:
//   blocks   — dated runs with availability
//   bundle   — the block bundle's passes/timings, server-priced
//   library  — the tenant's venue/add-ons/staff/categories the listing uses
listings.get("/:id", async (req, res) => {
  const snap = await col.doc(req.params.id).get();
  if (!snap.exists) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }
  const l = snap.data()!;
  const auth = req.auth!;
  const own = auth.role === "platform" || (auth.tenantId && auth.tenantId === l.tenantId);
  if (((l.status ?? "live") !== "live" || l.archived) && !own) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }

  const [joined] = await withBlocks([{ id: snap.id, data: l }]);

  // Block-bundle pricing (passes × timings), resolved server-side.
  let bundle: unknown = null;
  if (l.blockId) {
    const bSnap = await db.collection("blockBundles").doc(l.blockId).get();
    if (bSnap.exists && bSnap.data()!.tenantId === l.tenantId) {
      const b = bSnap.data() as BundleDoc;
      const [periodSnaps, passSnaps] = await Promise.all([
        Promise.all((b.periodIds ?? []).map((id: string) => db.collection("periods").doc(id).get())),
        Promise.all((b.passIds ?? []).map((id: string) => db.collection("passes").doc(id).get())),
      ]);
      const periodsById = new Map(
        periodSnaps
          .filter((s) => s.exists && s.data()!.tenantId === l.tenantId)
          .map((s) => [s.id, { id: s.id, ...(s.data() as PeriodDoc) }]),
      );
      const passesById = new Map(
        passSnaps
          .filter((s) => s.exists && s.data()!.tenantId === l.tenantId)
          .map((s) => [s.id, { id: s.id, ...(s.data() as PassDoc) }]),
      );
      const resolved = resolveBundlePricing(b, passesById, periodsById);
      bundle = {
        id: bSnap.id,
        name: b.name,
        passes: resolved.passes,
        timings: resolved.timings,
        periods: [...periodsById.values()].map((p) => ({
          id: p.id,
          title: p.title,
          start: p.start,
          finish: p.finish,
        })),
      };
    }
  }

  // The slice of the tenant's library this listing references.
  const libSnap = await db.collection("libraries").doc(l.tenantId).get();
  const lib = libSnap.exists ? (libSnap.data() as Record<string, { id: string }[]>) : {};
  const pick = (arr: { id: string }[] | undefined, ids: string[] | undefined) =>
    (arr ?? []).filter((x) => (ids ?? []).includes(x.id));
  const library = {
    venue: (lib.venues ?? []).find((v) => v.id === l.venueId) ?? null,
    addons: pick(lib.addons, l.addonIds as string[]),
    staff: pick(lib.staff, l.staffIds as string[]),
    categories: lib.categories ?? [],
  };

  res.json({ ...joined, bundle, library });
});

// Operators manage their own tenant's listings. (Bookings keep a denormalised
// listing name, so editing/deleting a listing never corrupts past bookings.)

listings.post("/", async (req, res) => {
  const auth = req.auth!;
  if (!canWrite(auth.role) || !auth.tenantId) {
    res.status(403).json({ error: "Requires an operator account with a tenant" });
    return;
  }
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const tenant = await db.collection("tenants").doc(auth.tenantId).get();
  const data = parsed.data;
  if (data.status === "live") {
    const problems = publishProblems(data as Record<string, unknown>);
    if (problems.length) {
      res.status(400).json({ error: `Can't publish yet — this listing needs ${problems.join(", ")}.` });
      return;
    }
  }
  const name = (data.title ?? data.name)!;
  const doc = {
    ...data,
    name,
    title: data.title ?? data.name,
    passes: data.passes ?? [],
    status: data.status ?? "draft",
    visibility: data.visibility ?? "public",
    tenantId: auth.tenantId,
    tenantName: tenant.exists ? tenant.data()!.name : "Unknown provider",
  };
  const ref = await col.add(doc);
  await syncListingBlocks(ref.id, auth.tenantId, runRecipeOf(doc));
  res.status(201).json({ id: ref.id, ...doc });
});

// Load a listing and verify it belongs to the caller's tenant.
async function ownListing(req: Request, id: string) {
  const auth = req.auth!;
  if (!canWrite(auth.role) || !auth.tenantId) return { status: 403 as const };
  const snap = await col.doc(id).get();
  if (!snap.exists) return { status: 404 as const };
  if (snap.data()!.tenantId !== auth.tenantId) return { status: 404 as const };
  return { status: 200 as const, snap };
}

listings.put("/:id", async (req, res) => {
  const own = await ownListing(req, req.params.id);
  if (own.status !== 200) {
    res
      .status(own.status)
      .json({ error: own.status === 403 ? "Requires an operator account" : "Listing not found" });
    return;
  }
  const parsed = baseListingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const data: ListingInput = parsed.data;
  if (data.status === "live") {
    const problems = publishProblems({ ...own.snap.data()!, ...data });
    if (problems.length) {
      res.status(400).json({ error: `Can't publish yet — this listing needs ${problems.join(", ")}.` });
      return;
    }
  }
  const patch: Record<string, unknown> = { ...data };
  if (data.title ?? data.name) {
    patch.name = data.title ?? data.name;
    patch.title = data.title ?? data.name;
  }
  await own.snap.ref.update(patch);
  const merged = { ...own.snap.data()!, ...patch };
  if (RUN_FIELDS.some((f) => f in data)) {
    await syncListingBlocks(own.snap.id, req.auth!.tenantId!, runRecipeOf(merged));
  }
  res.json({ id: own.snap.id, ...merged });
});

listings.delete("/:id", async (req, res) => {
  const own = await ownListing(req, req.params.id);
  if (own.status !== 200) {
    res
      .status(own.status)
      .json({ error: own.status === 403 ? "Requires an operator account" : "Listing not found" });
    return;
  }
  // A listing with booked places can't be deleted (its bookings would point
  // at nothing) — archive it instead. Empty blocks go with the listing.
  const blocks = await db.collection("blocks").where("listingId", "==", own.snap.id).get();
  const booked = blocks.docs.reduce((s, d) => s + (d.data().bookedCount ?? 0), 0);
  if (booked > 0) {
    res.status(409).json({ error: "This listing has bookings — archive it instead of deleting" });
    return;
  }
  const batch = db.batch();
  for (const b of blocks.docs) batch.delete(b.ref);
  batch.delete(own.snap.ref);
  await batch.commit();
  res.json({ ok: true });
});
