import { Router } from "express";
import { db } from "../firebase";

export const customers = Router();

// GET /api/customers — read-only for now (full Parents view arrives in a
// later milestone).
customers.get("/", async (_req, res) => {
  const snap = await db.collection("customers").orderBy("name").get();
  res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
});
