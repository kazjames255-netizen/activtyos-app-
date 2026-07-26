import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";

// Manual calendar events — one-off things the operator adds to the calendar
// alongside the auto-generated listing sessions (INSET days, staff meetings,
// open days, etc.). Optional category + colour. Tenant-scoped; operators and
// staff create, operators delete.
export const calendarEvents = Router();
const col = db.collection("calendarEvents");
const canUse = (role: Role) => role === "staff" || role === "company" || role === "freelancer" || role === "franchise";
const canManage = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";

const eventSchema = z.object({
  title: z.string().trim().min(1).max(160),
  date: z.string().max(10),
  endDate: z.string().max(10).optional(),
  start: z.string().max(8).optional(),
  end: z.string().max(8).optional(),
  allDay: z.boolean().optional(),
  category: z.string().max(60).optional(),
  color: z.string().max(20).optional(),
  notes: z.string().trim().max(2_000).optional(),
  // Per-event reminder override: "default" follows the tenant's calendar
  // setting; "on"/"off" force it. remindMinutes overrides how long before.
  // The actual email + in-app bell delivery is wired server-side.
  remindMode: z.enum(["default", "on", "off"]).optional(),
  remindMinutes: z.number().int().nonnegative().max(1440).optional(),
});

calendarEvents.get("/", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canUse(auth.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const snap = await col.where("tenantId", "==", auth.tenantId).get();
  const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { date?: string })[];
  list.sort((a, b) => (`${a.date}` < `${b.date}` ? -1 : 1));
  res.json(list);
});

calendarEvents.post("/", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canUse(auth.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const doc = { ...parsed.data, tenantId: auth.tenantId, createdBy: req.user?.email ?? "unknown", createdByName: req.user?.name ?? req.user?.email ?? "Staff", createdAt: new Date().toISOString() };
  const ref = await col.add(doc);
  res.status(201).json({ id: ref.id, ...doc });
});

async function own(req: Request, id: string) {
  const auth = req.auth!;
  if (!auth.tenantId || !canUse(auth.role)) return { status: 403 as const };
  const snap = await col.doc(id).get();
  if (!snap.exists || snap.data()!.tenantId !== auth.tenantId) return { status: 404 as const };
  return { status: 200 as const, snap };
}

calendarEvents.put("/:id", async (req, res) => {
  const o = await own(req, req.params.id);
  if (o.status !== 200) { res.status(o.status).json({ error: o.status === 403 ? "Forbidden" : "Event not found" }); return; }
  const parsed = eventSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  await o.snap.ref.set({ ...parsed.data, updatedAt: new Date().toISOString() }, { merge: true });
  const after = await o.snap.ref.get();
  res.json({ id: after.id, ...after.data() });
});

calendarEvents.delete("/:id", async (req, res) => {
  const o = await own(req, req.params.id);
  if (o.status !== 200) { res.status(o.status).json({ error: o.status === 403 ? "Forbidden" : "Event not found" }); return; }
  if (!canManage(req.auth!.role)) { res.status(403).json({ error: "Only the provider can delete an event" }); return; }
  await o.snap.ref.delete();
  res.json({ ok: true });
});
