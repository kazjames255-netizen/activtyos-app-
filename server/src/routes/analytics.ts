import { Router } from "express";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";

// Product analytics ingest — records how long an operator spent on a page, so
// HQ can see which pages/tabs are most used. One row per page visit; the
// platform side aggregates. (At scale this becomes a batched/rolled-up write.)
export const analytics = Router();
const canManage = (r: Role) => r === "company" || r === "freelancer" || r === "franchise";

const schema = z.object({
  view: z.string().trim().min(1).max(60),
  seconds: z.number().min(1).max(3600),
});

analytics.post("/pageview", async (req, res) => {
  const auth = req.auth!;
  // Only operators are tracked; anything else is silently ignored (204).
  if (!canManage(auth.role) || !auth.tenantId) { res.status(204).end(); return; }
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  await db.collection("pageViews").add({
    tenantId: auth.tenantId,
    role: auth.role, // freelancer | company | franchise — used for the HQ filter
    view: parsed.data.view,
    seconds: Math.round(parsed.data.seconds),
    createdAt: new Date().toISOString(),
  });
  res.status(204).end();
});
