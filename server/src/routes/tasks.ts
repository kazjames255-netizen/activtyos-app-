import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";

// Task Manager — the operator to-do system. A task hangs off a real operational
// record (camp / booking / compliance / venue) which is what makes it ActivityOS
// Tasks rather than a generic to-do. Tenant-scoped; staff see only their own.
export const tasks = Router();
const col = db.collection("tasks");
const canUse = (role: Role) => role === "staff" || role === "company" || role === "freelancer" || role === "franchise";

const linkSchema = z.object({ k: z.enum(["child", "parent", "camp", "book", "comp", "venue", "list", "gen"]), v: z.string().max(160), href: z.string().max(400).optional() }).nullable();
const subSchema = z.object({ t: z.string().max(200), done: z.boolean() });
const commentSchema = z.object({ who: z.string().max(80), body: z.string().max(2_000), when: z.string().max(40) });
const attSchema = z.object({ name: z.string().max(200) });

const taskSchema = z.object({
  t: z.string().trim().min(1).max(200),               // title
  who: z.string().max(80).optional(),                 // assignee display name ("" = unassigned)
  prio: z.enum(["urgent", "high", "med", "low"]).optional(),
  due: z.string().max(10).nullable().optional(),      // ISO date (yyyy-mm-dd) or null
  time: z.string().max(5).nullable().optional(),      // optional HH:MM deadline time
  status: z.enum(["backlog", "todo", "prog", "done"]).optional(),
  link: linkSchema.optional(),                        // {k,v} or null
  co: z.string().max(160).optional(),                 // freelancer: company the task is filed to
  labels: z.array(z.string().max(60)).max(20).optional(),
  subs: z.array(subSchema).max(50).optional(),
  comments: z.array(commentSchema).max(200).optional(),
  atts: z.array(attSchema).max(50).optional(),
  spawn: z.boolean().optional(),                      // auto-created (P2 engine) — shows the "auto" badge
  cat: z.string().max(60).optional(),                 // custom "linked to" category
  archived: z.boolean().optional(),                   // hidden from the main views, kept in Archive
  calEventId: z.string().max(60).nullable().optional(),// id of the mirrored calendarEvents doc (if shown on the Events calendar)
});
const partialSchema = taskSchema.partial();

tasks.get("/", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canUse(auth.role)) { res.status(403).json({ error: "Requires an operator or staff account" }); return; }
  const snap = await col.where("tenantId", "==", auth.tenantId).get();
  let list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { due?: string | null; who?: string })[];
  // Staff only see tasks assigned to them.
  if (auth.role === "staff") { const me = (req.user?.name ?? req.user?.email ?? "").trim().toLowerCase(); list = list.filter((t) => String(t.who ?? "").trim().toLowerCase() === me); }
  list.sort((a, b) => (`${a.due ?? "9999-99"}` < `${b.due ?? "9999-99"}` ? -1 : 1));
  res.json(list);
});

tasks.post("/", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canUse(auth.role)) { res.status(403).json({ error: "Requires an operator or staff account" }); return; }
  const parsed = taskSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const doc = {
    status: "todo", prio: "med", labels: [], subs: [], comments: [], atts: [], spawn: false, link: null, who: "", due: null,
    ...parsed.data,
    tenantId: auth.tenantId, createdBy: req.user?.email ?? "unknown", createdByName: req.user?.name ?? req.user?.email ?? "Staff", createdAt: new Date().toISOString(),
  };
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
  const parsed = partialSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  await own.snap.ref.set(parsed.data, { merge: true });
  const after = await own.snap.ref.get();
  res.json({ id: after.id, ...after.data() });
});

tasks.delete("/:id", async (req, res) => {
  const own = await ownTask(req, req.params.id);
  if (own.status !== 200) { res.status(own.status).json({ error: own.status === 403 ? "Forbidden" : "Task not found" }); return; }
  await own.snap.ref.delete();
  res.json({ ok: true });
});
