import { Router } from "express";
import { z } from "zod";
import { db } from "../firebase";

// Head-office view of its franchises + their agreed/proposed territories, so the
// HQ can see every border on one map (coverage, gaps, overlaps). Company only.
export const franchises = Router();

// Territory agreement is a HEAD-OFFICE decision (a franchise can't self-approve).
// Rings are stored as {lat,lng} objects — Firestore forbids nested arrays.
const territorySchema = z.object({
  status: z.enum(["draft", "proposed", "agreed"]).optional(),
  areas: z.array(z.object({
    id: z.string().max(60), name: z.string().max(80), color: z.string().max(20),
    rings: z.array(z.object({ lat: z.number(), lng: z.number() })).max(500),
  })).max(20).optional(),
});

// PUT /api/franchises/:franchiseId/territory — the head office agrees / revokes /
// edits a franchise's operating border. Writes to every user on that franchiseId.
franchises.put("/:franchiseId/territory", async (req, res) => {
  const auth = req.auth!;
  if (auth.role !== "company" || !auth.tenantId) { res.status(403).json({ error: "Head office only" }); return; }
  const parsed = territorySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const snap = await db.collection("users").where("tenantId", "==", auth.tenantId).where("role", "==", "franchise").where("franchiseId", "==", req.params.franchiseId).get();
  if (snap.empty) { res.status(404).json({ error: "Franchise not found" }); return; }
  // Merge onto the existing territory so a status-only change keeps the areas.
  await Promise.all(snap.docs.map((d) => {
    const cur = (d.data().franchiseTerritory as { areas?: unknown[]; status?: string } | undefined) ?? { areas: [], status: "draft" };
    const next = {
      areas: parsed.data.areas ?? cur.areas ?? [],
      status: parsed.data.status ?? cur.status ?? "draft",
      ...(parsed.data.status === "agreed" ? { agreedAt: new Date().toISOString(), agreedBy: req.user?.email ?? "head office" } : {}),
    };
    return d.ref.set({ franchiseTerritory: next }, { merge: true });
  }));
  res.json({ ok: true, status: parsed.data.status ?? null });
});

// The franchise ids in a tenant (distinct), with their display names.
async function franchiseList(tenantId: string): Promise<{ franchiseId: string; name: string }[]> {
  const snap = await db.collection("users").where("tenantId", "==", tenantId).where("role", "==", "franchise").get();
  const by = new Map<string, string>();
  for (const d of snap.docs) { const u = d.data(); const fid = (u.franchiseId as string) || d.id; if (!by.has(fid)) by.set(fid, (u.franchiseName as string) || (u.name as string) || "Franchise"); }
  return [...by.entries()].map(([franchiseId, name]) => ({ franchiseId, name }));
}

// Set one feature on/off on a franchise's OWN settings doc — seeding it from the
// head-office library on first write so the franchise keeps every other default.
// This is the SAME `settings.features` map the franchise edits themselves, so
// the HO control and the franchise's own toggles are one and the same.
async function setFranchiseFeature(tenantId: string, franchiseId: string, view: string, on: boolean): Promise<void> {
  const frRef = db.collection("libraries").doc(`${tenantId}__fr__${franchiseId}`);
  const [frSnap, hoSnap] = await Promise.all([frRef.get(), db.collection("libraries").doc(tenantId).get()]);
  const base = (frSnap.exists ? frSnap.data() : hoSnap.exists ? hoSnap.data() : {}) as Record<string, unknown>;
  const settings = { ...((base.settings as Record<string, unknown>) ?? {}) };
  settings.features = { ...((settings.features as Record<string, unknown>) ?? {}), [view]: on };
  await frRef.set({ ...base, tenantId, franchiseId, settings }, { merge: true });
}

// GET /api/franchises/features — each franchise's feature on/off map, so the HO
// can drive a per-franchise (and set-for-all) feature matrix. Company only.
franchises.get("/features", async (req, res) => {
  const auth = req.auth!;
  if (auth.role !== "company" || !auth.tenantId) { res.status(403).json({ error: "Head office only" }); return; }
  const [list, ho] = await Promise.all([franchiseList(auth.tenantId), db.collection("libraries").doc(auth.tenantId).get()]);
  const hoFeatures = ((ho.data()?.settings as { features?: Record<string, boolean> } | undefined)?.features) ?? {};
  const out = await Promise.all(list.map(async (f) => {
    const fr = await db.collection("libraries").doc(`${auth.tenantId}__fr__${f.franchiseId}`).get();
    // Uncustomised franchise → inherits the head-office defaults.
    const features = fr.exists ? (((fr.data()?.settings as { features?: Record<string, boolean> } | undefined)?.features) ?? hoFeatures) : hoFeatures;
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
  const targets = req.params.fid === "__all__" ? (await franchiseList(auth.tenantId)).map((f) => f.franchiseId) : [req.params.fid];
  await Promise.all(targets.map((fid) => setFranchiseFeature(auth.tenantId!, fid, parsed.data.view, parsed.data.on)));
  res.json({ ok: true, applied: targets.length });
});

franchises.get("/", async (req, res) => {
  const auth = req.auth!;
  if (auth.role !== "company" || !auth.tenantId) {
    res.status(403).json({ error: "Head office only" });
    return;
  }
  const snap = await db.collection("users").where("tenantId", "==", auth.tenantId).where("role", "==", "franchise").get();
  const list = snap.docs.map((d) => {
    const u = d.data() as { franchiseId?: string; franchiseName?: string; name?: string; email?: string; franchiseArea?: string; franchiseTerritory?: { areas?: unknown[]; status?: string } };
    return {
      franchiseId: u.franchiseId ?? d.id,
      name: u.franchiseName || u.name || u.email || "Franchise",
      area: u.franchiseArea ?? null,
      territory: u.franchiseTerritory ?? { areas: [], status: "draft" },
    };
  });
  res.json(list);
});
