import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "../firebase";
import { canWrite, type Role } from "../middleware/role";

// Activity timetable (the builder). One doc per tenant per run: the
// operator's DRAFT (setup + built plan), plus — once published — a frozen
// PUBLISHED snapshot that staff and parents read. Publishing copies the
// draft, so the operator can keep editing without live audiences seeing a
// half-finished week until they publish again.
export const timetables = Router();
const col = db.collection("timetables");

const canRead = (role: Role) => role === "staff" || canWrite(role);

// ── Shapes (mirror features/timetable/types.ts) ─────────────────────────
const cellSchema = z.object({
  name: z.string().max(80),
  color: z.string().max(24),
  cat: z.string().max(60),
  place: z.string().max(60),
});
const rowSchema = z.object({
  type: z.enum(["signin", "signout", "lunch", "break", "session"]),
  time: z.string().max(16).optional(),
  times: z.array(z.string().max(8)).max(12).optional(),
  cells: z.array(cellSchema).max(16).nullable().optional(),
  whole: cellSchema.optional(),
});
const daySchema = z.array(rowSchema).max(40);
const dayInfoSchema = z.object({ n: z.string().max(4), d: z.string().max(12), iso: z.string().max(10) });
const configSchema = z.object({
  start: z.string().max(8),
  end: z.string().max(8),
  perDay: z.number().int().min(1).max(16),
  breaks: z.number().int().min(0).max(8),
  lunch: z.string().max(8),
  signin: z.array(z.string().max(8)).max(8),
  signout: z.array(z.string().max(8)).max(8),
  wholeTimes: z.array(z.string().max(8)).max(8),
  groups: z.array(z.string().max(60)).min(1).max(16),
});
const timetableSchema = z.object({
  listingId: z.string().max(60).nullable().optional(),
  name: z.string().trim().min(1).max(120),
  dateFrom: z.string().max(10),
  dateTo: z.string().max(10),
  excluded: z.array(z.string().max(10)).max(62).default([]),
  config: configSchema,
  dayList: z.array(dayInfoSchema).max(31),
  plan: z.array(daySchema).max(31),
  mode: z.enum(["auto", "manual"]).default("auto"),
});
const publishSchema = z.object({
  staff: z.boolean(),
  parents: z.boolean(),
  audience: z.enum(["booked", "everyone"]).default("booked"),
});

// Firestore forbids directly nested arrays, and a Plan is Day[] = row-array
// per day. Days are stored wrapped as {rows} and unwrapped on every read —
// the API keeps the client's Plan shape.
type Row = z.infer<typeof rowSchema>;
const planToDoc = (plan: Row[][]) => plan.map((rows) => ({ rows }));
const planFromDoc = (p: unknown): Row[][] =>
  Array.isArray(p) ? p.map((d) => (d as { rows?: Row[] }).rows ?? []) : [];
function docOut(id: string, data: FirebaseFirestore.DocumentData) {
  const out: Record<string, unknown> = { id, ...data };
  out.plan = planFromDoc(data.plan);
  if (data.published)
    out.published = { ...data.published, plan: planFromDoc((data.published as { plan?: unknown }).plan) };
  return out;
}

// ── Operator/staff side ─────────────────────────────────────────────────

// GET /api/timetables — the tenant's timetables (drafts + published state).
timetables.get("/", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canRead(auth.role)) {
    res.status(403).json({ error: "Requires an operator or staff account" });
    return;
  }
  const snap = await col.where("tenantId", "==", auth.tenantId).get();
  const list = snap.docs.map((d) => docOut(d.id, d.data()));
  list.sort((a, b) => (((b as { updatedAt?: string }).updatedAt ?? "") < ((a as { updatedAt?: string }).updatedAt ?? "") ? -1 : 1));
  res.json(list);
});

timetables.post("/", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canWrite(auth.role)) {
    res.status(403).json({ error: "Requires an operator account" });
    return;
  }
  const parsed = timetableSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const doc = {
    ...parsed.data,
    plan: planToDoc(parsed.data.plan),
    listingId: parsed.data.listingId ?? null,
    tenantId: auth.tenantId,
    updatedAt: new Date().toISOString(),
    updatedBy: req.user?.email ?? "unknown",
  };
  const ref = await col.add(doc);
  res.status(201).json(docOut(ref.id, doc));
});

async function ownTimetable(req: Request, id: string) {
  const auth = req.auth!;
  if (!auth.tenantId || !canWrite(auth.role)) return { status: 403 as const };
  const snap = await col.doc(id).get();
  if (!snap.exists || snap.data()!.tenantId !== auth.tenantId) return { status: 404 as const };
  return { status: 200 as const, snap };
}

timetables.put("/:id", async (req, res) => {
  const own = await ownTimetable(req, req.params.id);
  if (own.status !== 200) { res.status(own.status).json({ error: own.status === 403 ? "Requires an operator account" : "Timetable not found" }); return; }
  const parsed = timetableSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const patch = {
    ...parsed.data,
    plan: planToDoc(parsed.data.plan),
    listingId: parsed.data.listingId ?? null,
    updatedAt: new Date().toISOString(),
    updatedBy: req.user?.email ?? "unknown",
  };
  await own.snap.ref.set(patch, { merge: true }); // keeps `published` untouched
  const after = await own.snap.ref.get();
  res.json(docOut(after.id, after.data()!));
});

timetables.delete("/:id", async (req, res) => {
  const own = await ownTimetable(req, req.params.id);
  if (own.status !== 200) { res.status(own.status).json({ error: own.status === 403 ? "Requires an operator account" : "Timetable not found" }); return; }
  await own.snap.ref.delete();
  res.json({ ok: true });
});

// POST /api/timetables/:id/publish — freeze the CURRENT draft for the chosen
// audiences. Both audiences off = unpublish.
timetables.post("/:id/publish", async (req, res) => {
  const own = await ownTimetable(req, req.params.id);
  if (own.status !== 200) { res.status(own.status).json({ error: own.status === 403 ? "Requires an operator account" : "Timetable not found" }); return; }
  const parsed = publishSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const d = own.snap.data()!;
  const published =
    parsed.data.staff || parsed.data.parents
      ? {
          at: new Date().toISOString(),
          by: req.user?.email ?? "unknown",
          staff: parsed.data.staff,
          parents: parsed.data.parents,
          audience: parsed.data.audience,
          // The frozen copy audiences actually see.
          name: d.name,
          listingId: d.listingId ?? null,
          dateFrom: d.dateFrom,
          dateTo: d.dateTo,
          config: d.config,
          dayList: d.dayList,
          plan: d.plan,
        }
      : null;
  await own.snap.ref.set({ published }, { merge: true });
  const after = await own.snap.ref.get();
  res.json(docOut(after.id, after.data()!));
});

// ── Audience side ───────────────────────────────────────────────────────

type Published = NonNullable<z.infer<typeof publishSchema>> & {
  at: string;
  name: string;
  listingId: string | null;
  dateFrom: string;
  dateTo: string;
  config: z.infer<typeof configSchema>;
  dayList: z.infer<typeof dayInfoSchema>[];
  plan: z.infer<typeof daySchema>[];
};

// GET /api/timetables/published — what the caller is allowed to see.
//   Staff: their tenant's weeks published to the Staff portal.
//   Operators: everything their tenant has published (either audience).
//   Parents: weeks published to Parents by any provider they've booked
//   with; audience "booked" trims each week to the days that family has
//   actually booked (via the bookings the parent already owns).
timetables.get("/published", async (req, res) => {
  const auth = req.auth!;

  if (auth.tenantId && canRead(auth.role)) {
    const snap = await col.where("tenantId", "==", auth.tenantId).get();
    const out = snap.docs
      .map((d) => ({ id: d.id, published: d.data().published as Published | null }))
      .filter((t) => t.published && (canWrite(auth.role) || t.published.staff))
      .map((t) => ({ id: t.id, ...t.published!, plan: planFromDoc(t.published!.plan) }));
    out.sort((a, b) => (a.dateFrom < b.dateFrom ? -1 : 1));
    res.json(out);
    return;
  }

  const email = req.user?.email?.toLowerCase();
  if (!email) { res.json([]); return; }
  const bookingSnap = await db.collection("bookings").where("email", "==", email).get();
  // Booked days per tenant — cancelled/declined bookings don't count.
  const daysByTenant = new Map<string, Set<string>>();
  for (const d of bookingSnap.docs) {
    const b = d.data() as { tenantId?: string; status?: string; days?: string[]; kids?: { dates?: string[] }[] };
    if (!b.tenantId || b.status === "Cancelled" || b.status === "Declined") continue;
    const set = daysByTenant.get(b.tenantId) ?? new Set<string>();
    for (const day of b.days ?? []) set.add(day);
    for (const k of b.kids ?? []) for (const day of k.dates ?? []) set.add(day);
    daysByTenant.set(b.tenantId, set);
  }
  const tenantIds = [...daysByTenant.keys()].slice(0, 10);
  if (!tenantIds.length) { res.json([]); return; }
  const [snaps, tenantSnaps] = await Promise.all([
    Promise.all(tenantIds.map((tid) => col.where("tenantId", "==", tid).get())),
    Promise.all(tenantIds.map((tid) => db.collection("tenants").doc(tid).get())),
  ]);
  const out: Record<string, unknown>[] = [];
  snaps.forEach((snap, i) => {
    const tid = tenantIds[i];
    const booked = daysByTenant.get(tid)!;
    for (const doc of snap.docs) {
      const pub = doc.data().published as Published | null;
      if (!pub || !pub.parents) continue;
      let dayList = pub.dayList;
      let plan = planFromDoc(pub.plan);
      if (pub.audience === "booked") {
        const full = plan;
        const keep = dayList.map((day, di) => ({ day, di })).filter((x) => booked.has(x.day.iso));
        dayList = keep.map((x) => x.day);
        plan = keep.map((x) => full[x.di]);
        if (!dayList.length) continue; // nothing this family attends
      }
      out.push({
        id: doc.id,
        tenantId: tid,
        tenantName: tenantSnaps[i].data()?.name ?? "Your provider",
        name: pub.name,
        at: pub.at,
        dateFrom: pub.dateFrom,
        dateTo: pub.dateTo,
        config: pub.config,
        dayList,
        plan,
      });
    }
  });
  out.sort((a, b) => ((a as { dateFrom: string }).dateFrom < (b as { dateFrom: string }).dateFrom ? -1 : 1));
  res.json(out);
});
