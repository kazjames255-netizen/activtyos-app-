import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "../firebase";
import { canWrite, operatorScope } from "../middleware/role";

// Customers & families — the tenant's parent records. Mostly SELF-FILLING:
// every booking (operator-taken or parent checkout) upserts the family via
// lib/customerUpsert.ts, so the collection accumulates real customers.
// These endpoints cover reading them and the manual cases (adding a family
// before their first booking, fixing a record, removing one).
export const customers = Router();

const col = db.collection("customers");

const childSchema = z.object({
  name: z.string().trim().min(1).max(80),
  age: z.number().int().min(0).max(17).optional(),
  dob: z.string().trim().max(20).optional(),
});
const customerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().max(160).default(""),
  phone: z.string().trim().max(40).default(""),
  children: z.array(childSchema).max(20).default([]),
});

// GET /api/customers — the caller's tenant's customers (staff may read;
// platform may filter with ?tenantId= or see all).
customers.get("/", async (req, res) => {
  const scope = operatorScope(req, res);
  if (!scope) return;

  let q = db.collection("customers") as FirebaseFirestore.Query;
  if (scope.role === "platform") {
    const tenantFilter = typeof req.query.tenantId === "string" ? req.query.tenantId : null;
    if (tenantFilter) q = q.where("tenantId", "==", tenantFilter);
  } else {
    q = q.where("tenantId", "==", scope.tenantId);
  }
  const snap = await q.get();
  const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as { name?: string }) }));
  list.sort((a, b) => ((a.name ?? "") < (b.name ?? "") ? -1 : 1));
  res.json(list);
});

customers.post("/", async (req, res) => {
  const auth = req.auth!;
  if (!canWrite(auth.role) || !auth.tenantId) {
    res.status(403).json({ error: "Requires an operator account with a tenant" });
    return;
  }
  const parsed = customerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const doc = { ...parsed.data, tenantId: auth.tenantId };
  const ref = await col.add(doc);
  res.status(201).json({ id: ref.id, ...doc });
});

async function ownCustomer(req: Request, id: string) {
  const auth = req.auth!;
  if (!canWrite(auth.role) || !auth.tenantId) return { status: 403 as const };
  const snap = await col.doc(id).get();
  if (!snap.exists || snap.data()!.tenantId !== auth.tenantId) return { status: 404 as const };
  return { status: 200 as const, snap };
}

customers.put("/:id", async (req, res) => {
  const own = await ownCustomer(req, req.params.id);
  if (own.status !== 200) {
    res
      .status(own.status)
      .json({ error: own.status === 403 ? "Requires an operator account" : "Customer not found" });
    return;
  }
  const parsed = customerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  await own.snap.ref.update(parsed.data);
  res.json({ id: own.snap.id, ...own.snap.data(), ...parsed.data });
});

customers.delete("/:id", async (req, res) => {
  const own = await ownCustomer(req, req.params.id);
  if (own.status !== 200) {
    res
      .status(own.status)
      .json({ error: own.status === 403 ? "Requires an operator account" : "Customer not found" });
    return;
  }
  await own.snap.ref.delete();
  res.json({ ok: true });
});
