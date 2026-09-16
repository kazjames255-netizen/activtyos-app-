import { Router } from "express";
import { db } from "../firebase";

// VENTURE CYCLE PROJECT — Phase 1 read-only list.
// Separate business venture (lake/country-park cycle-hire feasibility list),
// unrelated to the childcare "leads" pipeline. Its own Firestore collection
// (`ventureLakes`), its own route, no overlap with routes/leads.ts.
// Data is populated offline by server/scripts/ventureLakes/fetch.mjs (Overpass
// + postcodes.io + OSRM) — this route just serves what's there. Platform-only,
// same as the rest of HQ's prospecting tools.
//
// Scope is sites within a 90-minute DRIVE (not straight-line distance) of
// Milton Keynes — see driveTimeMinutes. An earlier whole-UK pass predates
// that requirement; those docs are marked `excluded: true` rather than
// deleted (see fetch.mjs's markOutOfRangeExcluded), so this route filters
// them out here instead of trusting every doc in the collection.
export const ventureLakes = Router();

ventureLakes.use((req, res, next) => {
  if (req.auth!.role !== "platform") {
    res.status(403).json({ error: "Requires the platform role" });
    return;
  }
  next();
});

ventureLakes.get("/", async (req, res) => {
  const snap = await db.collection("ventureLakes").orderBy("acres", "desc").get();
  const items = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((v: Record<string, unknown>) => !v.excluded);
  res.json({ items });
});
