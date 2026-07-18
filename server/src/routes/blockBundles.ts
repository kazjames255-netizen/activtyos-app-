import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "../firebase";
import { canWrite } from "../middleware/role";
import {
  resolveBundlePricing,
  type BundleDoc,
  type PassDoc,
  type PeriodDoc,
} from "../lib/bundlePricing";

// The Blocks BUILDER (distinct from the dated-run `blocks` collection):
// reusable scheduling patterns — Periods (session time windows), Passes
// (booking lengths) and Block Bundles (period+pass sets with the pricing
// calculator), kept in a per-tenant library and "sent" to listings.
//
// "Send to listings" = association + snapshotting the RESOLVED pass prices
// into each listing's `passes`, so the existing checkout keeps pricing
// server-side from bundle pricing. It does NOT create dated runs — that
// stays the explicit POST /api/blocks step.

export const periods = Router();
export const passes = Router();
export const blockBundles = Router();

const periodsCol = db.collection("periods");
const passesCol = db.collection("passes");
const bundlesCol = db.collection("blockBundles");

const timeRe = /^\d{2}:\d{2}$/;

const periodSchema = z
  .object({
    title: z.string().trim().min(2).max(120),
    start: z.string().regex(timeRe),
    finish: z.string().regex(timeRe),
  })
  .refine((p) => p.start < p.finish, { message: "finish must be after start" });

const passSchema = z.object({
  name: z.string().trim().min(2).max(120),
  days: z.number().int().min(1).max(365),
});

const bundleSchema = z.object({
  name: z.string().trim().min(2).max(120),
  periodIds: z.array(z.string().min(1)).max(50).default([]),
  passIds: z.array(z.string().min(1)).max(50).default([]),
  archived: z.boolean().default(false),
  priced: z.boolean().default(false),
  masterPrice: z.number().nonnegative().nullable().default(null),
  calcOn: z.boolean().default(true),
  passFlat: z.record(z.string(), z.number().nonnegative()).default({}),
  passMode: z.record(z.string(), z.literal("flat")).default({}),
  periodPrice: z.record(z.string(), z.number().nonnegative()).default({}),
});

function operatorTenant(req: Request, res: Response): string | null {
  const auth = req.auth!;
  if (auth.role === "platform") {
    const t = req.query.tenantId;
    if (typeof t === "string" && t) return t;
    res.status(400).json({ error: "tenantId query param required for platform accounts" });
    return null;
  }
  if (auth.role === "parent" || !auth.tenantId) {
    res.status(403).json({ error: "Requires an operator account with a tenant" });
    return null;
  }
  return auth.tenantId;
}

function requireOperatorWrite(req: Request, res: Response): string | null {
  const auth = req.auth!;
  if (!canWrite(auth.role) || !auth.tenantId) {
    res.status(403).json({ error: "Requires an operator account with a tenant" });
    return null;
  }
  return auth.tenantId;
}

async function ownDoc(col: FirebaseFirestore.CollectionReference, tenantId: string, id: string) {
  const snap = await col.doc(id).get();
  if (!snap.exists || snap.data()!.tenantId !== tenantId) return null;
  return snap;
}

// Load a tenant's periods+passes as lookup maps for the pricing resolver.
async function pricingContext(tenantId: string) {
  const [periodsSnap, passesSnap] = await Promise.all([
    periodsCol.where("tenantId", "==", tenantId).get(),
    passesCol.where("tenantId", "==", tenantId).get(),
  ]);
  const periodsById = new Map(
    periodsSnap.docs.map((d) => [d.id, { id: d.id, ...(d.data() as PeriodDoc) }]),
  );
  const passesById = new Map(
    passesSnap.docs.map((d) => [d.id, { id: d.id, ...(d.data() as PassDoc) }]),
  );
  return { periodsById, passesById };
}

function bundleOut(
  id: string,
  b: BundleDoc,
  ctx: Awaited<ReturnType<typeof pricingContext>>,
) {
  return { id, ...b, resolved: resolveBundlePricing(b, ctx.passesById, ctx.periodsById) };
}

// ——— Periods ———

periods.get("/", async (req, res) => {
  const tenantId = operatorTenant(req, res);
  if (!tenantId) return;
  const snap = await periodsCol.where("tenantId", "==", tenantId).get();
  const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as PeriodDoc) }));
  list.sort((a, b) => (a.start < b.start ? -1 : 1));
  res.json(list);
});

periods.post("/", async (req, res) => {
  const tenantId = requireOperatorWrite(req, res);
  if (!tenantId) return;
  const parsed = periodSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const doc = { ...parsed.data, tenantId };
  const ref = await periodsCol.add(doc);
  res.status(201).json({ id: ref.id, ...doc });
});

periods.put("/:id", async (req, res) => {
  const tenantId = requireOperatorWrite(req, res);
  if (!tenantId) return;
  const snap = await ownDoc(periodsCol, tenantId, req.params.id);
  if (!snap) {
    res.status(404).json({ error: "Period not found" });
    return;
  }
  const parsed = periodSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  await snap.ref.set({ ...parsed.data, tenantId });
  res.json({ id: snap.id, ...parsed.data, tenantId });
});

periods.delete("/:id", async (req, res) => {
  const tenantId = requireOperatorWrite(req, res);
  if (!tenantId) return;
  const snap = await ownDoc(periodsCol, tenantId, req.params.id);
  if (!snap) {
    res.status(404).json({ error: "Period not found" });
    return;
  }
  // Cascade: strip the id from every bundle in the tenant. (Filtered in
  // memory — ==+array-contains would need a composite Firestore index.)
  const bundles = await bundlesCol.where("tenantId", "==", tenantId).get();
  const batch = db.batch();
  for (const b of bundles.docs) {
    const ids = b.data().periodIds as string[];
    if (ids.includes(snap.id)) batch.update(b.ref, { periodIds: ids.filter((x) => x !== snap.id) });
  }
  batch.delete(snap.ref);
  await batch.commit();
  res.json({ ok: true });
});

// ——— Passes ———

passes.get("/", async (req, res) => {
  const tenantId = operatorTenant(req, res);
  if (!tenantId) return;
  const snap = await passesCol.where("tenantId", "==", tenantId).get();
  const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as PassDoc) }));
  list.sort((a, b) => b.days - a.days);
  res.json(list);
});

passes.post("/", async (req, res) => {
  const tenantId = requireOperatorWrite(req, res);
  if (!tenantId) return;
  const parsed = passSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const doc = { ...parsed.data, tenantId };
  const ref = await passesCol.add(doc);
  res.status(201).json({ id: ref.id, ...doc });
});

passes.put("/:id", async (req, res) => {
  const tenantId = requireOperatorWrite(req, res);
  if (!tenantId) return;
  const snap = await ownDoc(passesCol, tenantId, req.params.id);
  if (!snap) {
    res.status(404).json({ error: "Pass not found" });
    return;
  }
  const parsed = passSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  await snap.ref.set({ ...parsed.data, tenantId });
  res.json({ id: snap.id, ...parsed.data, tenantId });
});

passes.delete("/:id", async (req, res) => {
  const tenantId = requireOperatorWrite(req, res);
  if (!tenantId) return;
  const snap = await ownDoc(passesCol, tenantId, req.params.id);
  if (!snap) {
    res.status(404).json({ error: "Pass not found" });
    return;
  }
  const bundles = await bundlesCol.where("tenantId", "==", tenantId).get();
  const batch = db.batch();
  for (const b of bundles.docs) {
    const ids = b.data().passIds as string[];
    if (ids.includes(snap.id)) batch.update(b.ref, { passIds: ids.filter((x) => x !== snap.id) });
  }
  batch.delete(snap.ref);
  await batch.commit();
  res.json({ ok: true });
});

// ——— Block bundles (the library) ———

async function validateRefs(
  tenantId: string,
  data: { periodIds: string[]; passIds: string[] },
): Promise<string | null> {
  const ctx = await pricingContext(tenantId);
  for (const id of data.periodIds) if (!ctx.periodsById.has(id)) return `Unknown period ${id}`;
  for (const id of data.passIds) if (!ctx.passesById.has(id)) return `Unknown pass ${id}`;
  return null;
}

blockBundles.get("/", async (req, res) => {
  const tenantId = operatorTenant(req, res);
  if (!tenantId) return;
  const snap = await bundlesCol.where("tenantId", "==", tenantId).get();
  const ctx = await pricingContext(tenantId);
  const list = snap.docs.map((d) => bundleOut(d.id, d.data() as BundleDoc, ctx));
  list.sort((a, b) => a.order - b.order);
  res.json(list);
});

blockBundles.post("/", async (req, res) => {
  const tenantId = requireOperatorWrite(req, res);
  if (!tenantId) return;
  const parsed = bundleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const refErr = await validateRefs(tenantId, parsed.data);
  if (refErr) {
    res.status(400).json({ error: refErr });
    return;
  }
  const existing = await bundlesCol.where("tenantId", "==", tenantId).get();
  const order = existing.docs.reduce((m, d) => Math.max(m, (d.data().order as number) ?? 0), -1) + 1;
  const doc: BundleDoc = { ...parsed.data, listingIds: [], order, tenantId };
  const ref = await bundlesCol.add(doc);
  res.status(201).json(bundleOut(ref.id, doc, await pricingContext(tenantId)));
});

blockBundles.put("/:id", async (req, res) => {
  const tenantId = requireOperatorWrite(req, res);
  if (!tenantId) return;
  const snap = await ownDoc(bundlesCol, tenantId, req.params.id);
  if (!snap) {
    res.status(404).json({ error: "Bundle not found" });
    return;
  }
  const parsed = bundleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const refErr = await validateRefs(tenantId, parsed.data);
  if (refErr) {
    res.status(400).json({ error: refErr });
    return;
  }
  const existing = snap.data() as BundleDoc;
  const doc: BundleDoc = {
    ...parsed.data,
    listingIds: existing.listingIds, // managed via /:id/listings
    order: existing.order, // managed via /reorder
    tenantId,
  };
  await snap.ref.set(doc);
  res.json(bundleOut(snap.id, doc, await pricingContext(tenantId)));
});

blockBundles.delete("/:id", async (req, res) => {
  const tenantId = requireOperatorWrite(req, res);
  if (!tenantId) return;
  const snap = await ownDoc(bundlesCol, tenantId, req.params.id);
  if (!snap) {
    res.status(404).json({ error: "Bundle not found" });
    return;
  }
  await snap.ref.delete();
  res.json({ ok: true });
});

blockBundles.post("/:id/duplicate", async (req, res) => {
  const tenantId = requireOperatorWrite(req, res);
  if (!tenantId) return;
  const snap = await ownDoc(bundlesCol, tenantId, req.params.id);
  if (!snap) {
    res.status(404).json({ error: "Bundle not found" });
    return;
  }
  const src = snap.data() as BundleDoc;
  const existing = await bundlesCol.where("tenantId", "==", tenantId).get();
  const order = existing.docs.reduce((m, d) => Math.max(m, (d.data().order as number) ?? 0), -1) + 1;
  const copy: BundleDoc = { ...src, name: `${src.name} (copy)`, listingIds: [], order };
  const ref = await bundlesCol.add(copy);
  res.status(201).json(bundleOut(ref.id, copy, await pricingContext(tenantId)));
});

blockBundles.post("/:id/archive", async (req, res) => {
  const tenantId = requireOperatorWrite(req, res);
  if (!tenantId) return;
  const snap = await ownDoc(bundlesCol, tenantId, req.params.id);
  if (!snap) {
    res.status(404).json({ error: "Bundle not found" });
    return;
  }
  const parsed = z.object({ archived: z.boolean() }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  await snap.ref.update({ archived: parsed.data.archived });
  const doc = { ...(snap.data() as BundleDoc), archived: parsed.data.archived };
  res.json(bundleOut(snap.id, doc, await pricingContext(tenantId)));
});

blockBundles.post("/reorder", async (req, res) => {
  const tenantId = requireOperatorWrite(req, res);
  if (!tenantId) return;
  const parsed = z.object({ orderedIds: z.array(z.string().min(1)).min(1) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const snaps = await Promise.all(parsed.data.orderedIds.map((id) => bundlesCol.doc(id).get()));
  const batch = db.batch();
  for (const [i, snap] of snaps.entries()) {
    if (!snap.exists || snap.data()!.tenantId !== tenantId) {
      res.status(404).json({ error: `Bundle ${parsed.data.orderedIds[i]} not found` });
      return;
    }
    batch.update(snap.ref, { order: i });
  }
  await batch.commit();
  res.json({ ok: true });
});

// "Send to listings": associate + snapshot the RESOLVED pass prices into
// each listing's `passes` (so the existing checkout prices from the bundle).
blockBundles.put("/:id/listings", async (req, res) => {
  const tenantId = requireOperatorWrite(req, res);
  if (!tenantId) return;
  const snap = await ownDoc(bundlesCol, tenantId, req.params.id);
  if (!snap) {
    res.status(404).json({ error: "Bundle not found" });
    return;
  }
  const parsed = z.object({ listingIds: z.array(z.string().min(1)).max(100) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const listingSnaps = await Promise.all(
    parsed.data.listingIds.map((id) => db.collection("listings").doc(id).get()),
  );
  for (const [i, ls] of listingSnaps.entries()) {
    if (!ls.exists || ls.data()!.tenantId !== tenantId) {
      res.status(400).json({ error: `Unknown listing ${parsed.data.listingIds[i]}` });
      return;
    }
  }

  const bundle = { ...(snap.data() as BundleDoc), listingIds: parsed.data.listingIds };
  const ctx = await pricingContext(tenantId);
  const resolved = resolveBundlePricing(bundle, ctx.passesById, ctx.periodsById);

  const batch = db.batch();
  batch.update(snap.ref, { listingIds: parsed.data.listingIds });
  if (bundle.priced && bundle.masterPrice !== null && resolved.passes.length) {
    for (const ls of listingSnaps) {
      batch.update(ls.ref, {
        passes: resolved.passes.map((p) => ({ name: p.name, price: p.price })),
      });
    }
  }
  await batch.commit();
  res.json(bundleOut(snap.id, bundle, ctx));
});
