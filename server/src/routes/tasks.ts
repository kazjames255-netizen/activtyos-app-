import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";

// Tasks (Run the day) — a shared to-do list for the team. Staff and operators
// create and tick off; operators delete. Tenant-scoped, realtime.
export const tasks = Router();
const col = db.collection("tasks");
const canUse = (role: Role) => role === "staff" || role === "company" || role === "freelancer" || role === "franchise";
const canManage = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";

const taskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(1_000).optional(),
  done: z.boolean().default(false),
  assignee: z.string().trim().max(80).optional(),
  dueDate: z.string().max(10).optional(),
  priority: z.enum(["low", "normal", "high"]).default("normal"),
});

tasks.get("/", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canUse(auth.role)) {
    res.status(403).json({ error: "Requires an operator or staff account" });
    return;
  }
  const snap = await col.where("tenantId", "==", auth.tenantId).get();
  const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { done?: boolean; priority?: string; dueDate?: string; createdAt?: string })[];
  const rank = { high: 0, normal: 1, low: 2 } as Record<string, number>;
  list.sort((a, b) =>
    (a.done ? 1 : 0) - (b.done ? 1 : 0) ||
    (rank[a.priority ?? "normal"] ?? 1) - (rank[b.priority ?? "normal"] ?? 1) ||
    (`${a.dueDate ?? "9999"}` < `${b.dueDate ?? "9999"}` ? -1 : 1),
  );
  res.json(list);
});

tasks.post("/", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canUse(auth.role)) {
    res.status(403).json({ error: "Requires an operator or staff account" });
    return;
  }
  const parsed = taskSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const doc = { ...parsed.data, tenantId: auth.tenantId, createdBy: req.user?.email ?? "unknown", createdByName: req.user?.name ?? req.user?.email ?? "Staff", createdAt: new Date().toISOString() };
  const ref = await col.add(doc);
  res.status(201).json({ id: ref.id, ...doc });
});

async function ownTask(req: Request, id: string) {
  const auth = req.auth!;
  if (!auth.tenantId || !canUse(auth.role)) return { status: 403 as const };
  const snap = await col.doc(id).get();
  if (!snap.exists || snap.data()!.tenantId !== auth.tenantId) return { status: 404 as const };
  return { status: 200 as const, snap };
}

tasks.put("/:id", async (req, res) => {
  const own = await ownTask(req, req.params.id);
  if (own.status !== 200) { res.status(own.status).json({ error: own.status === 403 ? "Forbidden" : "Task not found" }); return; }
  const parsed = taskSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const patch: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.done !== undefined) patch.completedAt = parsed.data.done ? new Date().toISOString() : null;
  await own.snap.ref.set(patch, { merge: true });
  const after = await own.snap.ref.get();
  res.json({ id: after.id, ...after.data() });
});

tasks.delete("/:id", async (req, res) => {
  const own = await ownTask(req, req.params.id);
  if (own.status !== 200) { res.status(own.status).json({ error: own.status === 403 ? "Forbidden" : "Task not found" }); return; }
  if (!canManage(req.auth!.role)) { res.status(403).json({ error: "Only the provider can delete a task" }); return; }
  await own.snap.ref.delete();
  res.json({ ok: true });
});
