import { Router } from "express";
import { db } from "../firebase";
import { operatorScope } from "../middleware/role";

export const customers = Router();

// GET /api/customers — the caller's tenant's customers (platform may filter
// with ?tenantId= or see all). Read-only for now.
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
