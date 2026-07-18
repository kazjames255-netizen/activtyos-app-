import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "../firebase";
import { canWrite } from "../middleware/role";
import { blockSummary, type BlockDoc } from "../lib/blockDomain";

export const listings = Router();

const col = db.collection("listings");

const listingSchema = z.object({
  name: z.string().trim().min(2).max(120),
  passes: z
    .array(z.object({ name: z.string().min(1), price: z.number().nonnegative() }))
    .min(1),
});

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

// GET /api/listings — all providers' listings with their blocks/availability
// (feeds the parent Browse view). With ?mine=1, only the caller's own
// tenant's listings (the operator management view).
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
  const snap = await col.orderBy("name").get();
  res.json(await withBlocks(snap.docs.map((d) => ({ id: d.id, data: d.data() }))));
});

// Operators manage their own tenant's listings. (Bookings keep a denormalised
// listing name, so editing/deleting a listing never corrupts past bookings.)

listings.post("/", async (req, res) => {
  const auth = req.auth!;
  if (!canWrite(auth.role) || !auth.tenantId) {
    res.status(403).json({ error: "Requires an operator account with a tenant" });
    return;
  }
  const parsed = listingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const tenant = await db.collection("tenants").doc(auth.tenantId).get();
  const doc = {
    ...parsed.data,
    tenantId: auth.tenantId,
    tenantName: tenant.exists ? tenant.data()!.name : "Unknown provider",
  };
  const ref = await col.add(doc);
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
  const parsed = listingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  await own.snap.ref.update(parsed.data);
  res.json({ id: own.snap.id, ...own.snap.data(), ...parsed.data });
});

listings.delete("/:id", async (req, res) => {
  const own = await ownListing(req, req.params.id);
  if (own.status !== 200) {
    res
      .status(own.status)
      .json({ error: own.status === 403 ? "Requires an operator account" : "Listing not found" });
    return;
  }
  await own.snap.ref.delete();
  res.json({ ok: true });
});
