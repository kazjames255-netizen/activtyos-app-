import { Router } from "express";
import { z } from "zod";
import { db } from "../firebase";
import { FEATURE_API, FEATURE_WRITE_API, CA_FEATURES, OPT_IN_FEATURES } from "../../../lib/accessMap";
import { NAV_CONFIG } from "../../../lib/nav/config";
import { isKnownFeatureKey, SAFETY_FEATURES, seedFromHeadOffice } from "../lib/franchiseLibrary";
import { loadLibrary } from "../lib/tenantLibrary";
import { forgetSettings } from "../middleware/access";
import { franchiseExists } from "../lib/franchiseScope";
import { areasOverlap, type TerritoryAreaGeo } from "../../../lib/geo";

// Head-office view of its franchises + their agreed/proposed territories, so the
// HQ can see every border on one map (coverage, gaps, overlaps). Company only.
export const franchises = Router();

// Territory agreement is a HEAD-OFFICE decision (a franchise can't self-approve).
// Rings are stored as {lat,lng} objects — Firestore forbids nested arrays.
const territorySchema = z.object({
  status: z.enum(["draft", "proposed", "agreed"]).optional(),
  areas: z.array(z.object({
    id: z.string().max(60), name: z.string().max(80), color: z.string().max(20),
    rings: z.array(z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })).max(500),
  })).max(20).optional(),
});

interface Territory { areas?: TerritoryAreaGeo[]; status?: string; agreedAt?: string; agreedBy?: string }
interface Frs { franchiseId: string; name: string; territory: Territory }

/** One row per franchise (first login wins) with its territory. */
async function franchiseTerritories(tenantId: string): Promise<Frs[]> {
  const snap = await db.collection("users").where("tenantId", "==", tenantId).where("role", "==", "franchise").get();
  const by = new Map<string, Frs>();
  for (const d of snap.docs) {
    const u = d.data() as { franchiseId?: string; franchiseName?: string; name?: string; email?: string; franchiseTerritory?: Territory };
    const fid = u.franchiseId ?? d.id;
    if (!by.has(fid)) by.set(fid, { franchiseId: fid, name: u.franchiseName || u.name || u.email || "Franchise", territory: u.franchiseTerritory ?? { areas: [], status: "draft" } });
  }
  return [...by.values()];
}

/** For each AGREED territory that overlaps another franchise's AGREED territory: who it overlaps. Warning only, never a block. */
function overlapPairs(rows: Frs[]): Map<string, { franchiseId: string; name: string }[]> {
  const agreed = rows.filter((r) => r.territory.status === "agreed" && (r.territory.areas?.length ?? 0) > 0);
  const out = new Map<string, { franchiseId: string; name: string }[]>();
  for (const a of agreed) for (const o of agreed) {
    if (a.franchiseId === o.franchiseId || !areasOverlap(a.territory.areas!, o.territory.areas!)) continue;
    out.set(a.franchiseId, [...(out.get(a.franchiseId) ?? []), { franchiseId: o.franchiseId, name: o.name }]);
  }
  return out;
}
async function territoryOverlaps(tenantId: string, franchiseId: string) {
  return overlapPairs(await franchiseTerritories(tenantId)).get(franchiseId) ?? [];
}

// PUT /api/franchises/:franchiseId/territory — the head office agrees / revokes /
// edits a franchise's operating border. Writes to every user on that franchiseId.
franchises.put("/:franchiseId/territory", async (req, res) => {
  const auth = req.auth!;
  if (auth.role !== "company" || !auth.tenantId) { res.status(403).json({ error: "Head office only" }); return; }
  const parsed = territorySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const snap = await db.collection("users").where("tenantId", "==", auth.tenantId).where("role", "==", "franchise").where("franchiseId", "==", req.params.franchiseId).get();
  if (snap.empty) { res.status(404).json({ error: "Franchise not found" }); return; }
  // Merge onto the existing territory so a status-only change keeps the areas. A MATERIAL edit (a different set of areas) to an agreed
  // territory is no longer agreed: it goes back to "proposed" and the agreement stamp is cleared, so head office re-agrees what is now drawn.
  const first = (snap.docs[0].data().franchiseTerritory as Territory | undefined) ?? { areas: [], status: "draft" };
  const areasChanged = parsed.data.areas !== undefined && JSON.stringify(parsed.data.areas) !== JSON.stringify(first.areas ?? []);
  const reset = areasChanged && first.status === "agreed" && parsed.data.status !== "agreed";
  await Promise.all(snap.docs.map((d) => {
    const cur = (d.data().franchiseTerritory as Territory | undefined) ?? { areas: [], status: "draft" };
    const status = reset ? "proposed" : parsed.data.status ?? cur.status ?? "draft";
    const next: Territory = { areas: parsed.data.areas ?? cur.areas ?? [], status };
    if (status === "agreed") {
      if (parsed.data.status === "agreed" || !cur.agreedAt) { next.agreedAt = new Date().toISOString(); next.agreedBy = req.user?.email ?? "head office"; }
      else { next.agreedAt = cur.agreedAt; if (cur.agreedBy) next.agreedBy = cur.agreedBy; }
    }
    return d.ref.update({ franchiseTerritory: next }); // update() replaces the whole map: a cleared agreedAt must not survive a merge
  }));
  const warnings = await territoryOverlaps(auth.tenantId, req.params.franchiseId);
  res.json({ ok: true, status: reset ? "proposed" : parsed.data.status ?? null, ...(reset ? { reset: true } : {}), ...(warnings.length ? { overlapWarnings: warnings } : {}) });
});

// The franchise ids in a tenant (distinct), with their display names.
async function franchiseList(tenantId: string): Promise<{ franchiseId: string; name: string }[]> {
  const snap = await db.collection("users").where("tenantId", "==", tenantId).where("role", "==", "franchise").get();
  const by = new Map<string, string>();
  for (const d of snap.docs) { const u = d.data(); const fid = (u.franchiseId as string) || d.id; if (!by.has(fid)) by.set(fid, (u.franchiseName as string) || (u.name as string) || "Franchise"); }
  return [...by.entries()].map(([franchiseId, name]) => ({ franchiseId, name }));
}

// Set one feature on/off on a franchise's OWN settings doc. The doc is seeded from the head-office library's franchise-safe fields only (never bank
// details, payroll administrators or billing - lib/franchiseLibrary). Turning a feature OFF also LOCKS it (`hoLocks`): head office's switch is
// authoritative, the franchise cannot turn it back on. Turning it ON lifts the lock.
async function setFranchiseFeature(tenantId: string, franchiseId: string, view: string, on: boolean): Promise<void> {
  const frRef = db.collection("libraries").doc(`${tenantId}__fr__${franchiseId}`);
  const [frSnap, hoSnap] = await Promise.all([frRef.get(), db.collection("libraries").doc(tenantId).get()]);
  const base = (frSnap.exists ? frSnap.data() : seedFromHeadOffice(hoSnap.data())) as Record<string, unknown>;
  const settings = { ...((base.settings as Record<string, unknown>) ?? {}) };
  settings.features = { ...((settings.features as Record<string, unknown>) ?? {}), [view]: on };
  const hoLocks = { ...((base.hoLocks as Record<string, unknown>) ?? {}) };
  if (on) delete hoLocks[view]; else hoLocks[view] = false;
  await frRef.set({ ...base, tenantId, franchiseId, settings, hoLocks });
}

const gatedKeys = (): string[] => [
  ...FEATURE_API.flatMap((f) => f.keys), ...FEATURE_WRITE_API.flatMap((f) => f.keys), ...Object.values(CA_FEATURES).flat(), ...OPT_IN_FEATURES,
  "payroll", "newsfeed", "email", "messages", "marketing", "splitfees", "reviews", "referrals", "memberships", "ai", "schedule", "holiday",
];
const navViews = (): string[] => (["company", "franchise", "freelancer", "staff"] as const).flatMap((p) => NAV_CONFIG[p].map((i) => i.view));

// GET /api/franchises/features — each franchise's feature on/off map, so the HO
// can drive a per-franchise (and set-for-all) feature matrix. Company only.
franchises.get("/features", async (req, res) => {
  const auth = req.auth!;
  if (auth.role !== "company" || !auth.tenantId) { res.status(403).json({ error: "Head office only" }); return; }
  const [list, ho] = await Promise.all([franchiseList(auth.tenantId), db.collection("libraries").doc(auth.tenantId).get()]);
  const hoFeatures = ((ho.data()?.settings as { features?: Record<string, boolean> } | undefined)?.features) ?? {};
  const out = await Promise.all(list.map(async (f) => {
    // The franchise's resolved features (its own doc, head-office locks forced, or the head-office defaults when it has never opened Setup).
    const lib = await loadLibrary(auth.tenantId!, f.franchiseId);
    const features = ((lib.settings as { features?: Record<string, boolean> } | undefined)?.features) ?? hoFeatures;
    return { franchiseId: f.franchiseId, name: f.name, features };
  }));
  res.json(out);
});

// PUT /api/franchises/:fid/features — turn a feature on/off for ONE franchise, or
// for ALL of them (`fid=__all__`). Company only.
const featureToggleSchema = z.object({ view: z.string().min(1).max(60), on: z.boolean() });
franchises.put("/:fid/features", async (req, res) => {
  const auth = req.auth!;
  if (auth.role !== "company" || !auth.tenantId) { res.status(403).json({ error: "Head office only" }); return; }
  const parsed = featureToggleSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const view = parsed.data.view.trim();
  if (!isKnownFeatureKey(view, navViews(), gatedKeys())) { res.status(400).json({ error: `Unknown feature "${view}"` }); return; }
  // Safety features guard children: they cannot be switched off for a franchise (turning one ON is harmless and allowed).
  if (!parsed.data.on && SAFETY_FEATURES.has(view)) { res.status(400).json({ error: "Safety features can't be switched off: registers, incidents and medication stay on for every franchise." }); return; }
  const all = req.params.fid === "__all__";
  if (!all && !(await franchiseExists(auth.tenantId, req.params.fid))) { res.status(404).json({ error: "Franchise not found" }); return; }
  const targets = all ? (await franchiseList(auth.tenantId)).map((f) => f.franchiseId) : [req.params.fid];
  await Promise.all(targets.map((fid) => setFranchiseFeature(auth.tenantId!, fid, view, parsed.data.on)));
  if (all) {
    // Remember the network default so a franchise that joins LATER starts the same way (F10).
    const hoRef = db.collection("libraries").doc(auth.tenantId);
    const cur = ((await hoRef.get()).get("franchiseFeatureDefaults") as Record<string, boolean> | undefined) ?? {};
    await hoRef.set({ tenantId: auth.tenantId, franchiseFeatureDefaults: { ...cur, [view]: parsed.data.on } }, { merge: true });
  }
  forgetSettings(auth.tenantId);
  res.json({ ok: true, applied: targets.length });
});

franchises.get("/", async (req, res) => {
  const auth = req.auth!;
  if (auth.role !== "company" || !auth.tenantId) {
    res.status(403).json({ error: "Head office only" });
    return;
  }
  const snap = await db.collection("users").where("tenantId", "==", auth.tenantId).where("role", "==", "franchise").get();
  const overlaps = overlapPairs(await franchiseTerritories(auth.tenantId));
  const list = snap.docs.map((d) => {
    const u = d.data() as { franchiseId?: string; franchiseName?: string; name?: string; email?: string; franchiseArea?: string; franchiseTerritory?: { areas?: unknown[]; status?: string } };
    const franchiseId = u.franchiseId ?? d.id;
    const over = overlaps.get(franchiseId);
    return {
      franchiseId,
      name: u.franchiseName || u.name || u.email || "Franchise",
      area: u.franchiseArea ?? null,
      territory: u.franchiseTerritory ?? { areas: [], status: "draft" },
      ...(over?.length ? { overlapWarnings: over } : {}),
    };
  });
  res.json(list);
});
