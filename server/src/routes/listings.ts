import { Router } from "express";
import { db } from "../firebase";

export const listings = Router();

// GET /api/listings — read-only for now (feeds the take-booking form;
// full listings CRUD arrives with the Listings view milestone).
listings.get("/", async (_req, res) => {
  const snap = await db.collection("listings").orderBy("name").get();
  res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
});
