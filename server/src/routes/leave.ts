import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";
import { notify, notifyTenantMember } from "../lib/notify";
import { ukToday } from "../lib/ukDate";

// Leave & absence (the holiday planner), on the server.
//
// It lived in the browser: "Request sent to your manager" went nowhere, an
// approval changed one laptop's copy, nobody was told either way, and the
// planner was seeded with made-up staff and absences. Now:
//   · staff request leave for THEMSELVES only, always as pending, and can
//     cancel their own; they can't approve, or touch anyone else's;
//   · managers add, edit and decide; a decision is stamped with who and when;
//   · the manager is told of a request, the person of the decision;
//   · staff see colleagues' APPROVED absences for "who's off", but another
//     person's sickness shows only as "away" — health data is special category.
// Scope: tenant, or tenant__fr__franchise for a franchise (its own team).

export const leave = Router();
const col = db.collection("absences");
const canManage = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";
const canRead = (role: Role) => role === "staff" || canManage(role);
const keyOf = (req: Request) => (req.auth!.franchiseId ? `${req.auth!.tenantId}__fr__${req.auth!.franchiseId}` : req.auth!.tenantId!);
const slug = (name: string) => name.trim().toLowerCase().replace(/\s+/g, "-");

const KINDS = ["annual", "sickness", "toil", "unpaid", "maternity", "adoption", "parental", "bereavement", "other"] as const;
const absenceSchema = z.object({
  // Server ids are rotaKey_clientId — a franchise key alone is ~55 chars.
  id: z.string().max(200).optional(),
  staffId: z.string().max(120).optional(),
  name: z.string().trim().max(120).optional(),
  kind: z.enum(KINDS),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  half: z.enum(["am", "pm"]).nullable().optional(),
  fromTime: z.string().max(5).optional(),
  toTime: z.string().max(5).optional(),
  days: z.number().nonnegative().max(400),
  status: z.enum(["pending", "approved", "declined", "cancelled"]).optional(),
  reason: z.string().trim().max(1_000).optional(),
  note: z.string().trim().max(1_000).optional(),
  paid: z.boolean().optional(),
  pay: z.string().max(40).optional(),
  ssp: z.enum(["eligible", "withheld"]).optional(),
  awe: z.number().nonnegative().max(100_000).optional(),
}).refine((a) => a.end >= a.start, { message: "End date is before the start date" });

type AbsenceDoc = z.infer<typeof absenceSchema> & { rotaKey: string; tenantId: string; staffEmail?: string | null; requestedAt: string; requestedBy?: string | null; decidedBy?: string; decidedAt?: string };

// The caller's name comes from their account (set by their manager), never
// the token's display name — a user can change that themselves and would then
// match a colleague's absences (acceptance test d24s5).
const accountNames = new WeakMap<Request, string>();
leave.use(async (req, _res, next) => {
  if (req.user?.uid) accountNames.set(req, String((await db.collection("users").doc(req.user.uid).get()).get("name") ?? "").trim());
  next();
});
const me = (req: Request) => ({
  name: accountNames.get(req) ?? "",
  email: (req.user?.email ?? "").trim().toLowerCase(),
});

/** Is this absence the caller's own? (Staff are matched by email, else name.) */
function isMine(req: Request, a: { staffEmail?: string | null; name?: string; staffId?: string }): boolean {
  const m = me(req);
  if (a.staffEmail && m.email) return a.staffEmail === m.email;
  return !!m.name && (a.name ?? "").trim().toLowerCase() === m.name.toLowerCase();
}

/** The email for a named person on this team, so a decision reaches them. */
async function emailForName(tenantId: string, name: string, franchiseId: string | null = null): Promise<string | null> {
  if (!name.trim()) return null;
  const snap = await db.collection("users").where("tenantId", "==", tenantId).get();
  // Same team only: head office and each franchise keep their own staff, so a
  // same-named person in another franchise must not get this one's leave emails.
  const hit = snap.docs.find((d) => String(d.get("name") ?? "").trim().toLowerCase() === name.trim().toLowerCase() && ((d.get("franchiseId") as string | undefined) ?? null) === franchiseId);
  return (hit?.get("email") as string | undefined)?.toLowerCase() ?? null;
}

// GET /api/leave — { absences, profiles, policy } for this team.
leave.get("/", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canRead(auth.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const key = keyOf(req);
  const [snap, cfg] = await Promise.all([col.where("rotaKey", "==", key).get(), db.collection("leaveConfig").doc(key).get()]);
  let absences = snap.docs.map((d) => ({ id: d.id, ...(d.data() as AbsenceDoc) }));
  let profiles = ((cfg.data()?.profiles ?? []) as { id: string; name: string }[]);
  if (auth.role === "staff") {
    absences = absences
      .filter((a) => isMine(req, a) || a.status === "approved")
      .map((a) => (isMine(req, a) ? a : {
        // Colleagues: when they're off, not why — and never that it's sickness.
        id: a.id, staffId: a.staffId, name: a.name, start: a.start, end: a.end, half: a.half, days: a.days, status: a.status,
        kind: a.kind === "annual" ? "annual" : "other",
      } as typeof a));
    profiles = profiles.filter((p) => p.name.trim().toLowerCase() === me(req).name.toLowerCase());
  }
  const clean = absences.map(({ rotaKey: _k, tenantId: _t, ...a }) => a);
  res.json({ absences: clean, profiles, policy: cfg.data()?.policy ?? null });
});

// POST /api/leave/absences — request (staff: for yourself, pending) or record (manager).
leave.post("/absences", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canRead(auth.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const parsed = absenceSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const m = me(req);
  const manager = canManage(auth.role);
  const name = manager ? (parsed.data.name ?? "").trim() : m.name || m.email;
  if (!name) { res.status(400).json({ error: "Who is this for?" }); return; }
  const now = new Date().toISOString();
  const doc: AbsenceDoc = {
    ...parsed.data,
    name,
    staffId: parsed.data.staffId || slug(name),
    // Staff can only ASK. A manager recording leave sets the status they choose.
    status: manager ? (parsed.data.status ?? "approved") : "pending",
    staffEmail: manager ? await emailForName(auth.tenantId, name, auth.franchiseId ?? null) : m.email || null,
    rotaKey: keyOf(req),
    tenantId: auth.tenantId,
    requestedAt: now,
    requestedBy: m.email || null,
    ...(manager && (parsed.data.status ?? "approved") !== "pending" ? { decidedBy: req.user?.name ?? m.email, decidedAt: now } : {}),
  };
  if (!manager) { delete doc.note; delete doc.ssp; delete doc.awe; }
  const ref = parsed.data.id ? col.doc(`${doc.rotaKey}_${parsed.data.id}`.replace(/\//g, "_")) : col.doc();
  if (parsed.data.id && (await ref.get()).exists) { res.status(409).json({ error: "That absence already exists" }); return; }
  await ref.set(doc);
  res.status(201).json({ ...doc, id: ref.id });

  void (async () => {
    const when = doc.start === doc.end ? doc.start : `${doc.start} – ${doc.end}`;
    if (doc.status === "pending") {
      await notify({ tenantId: auth.tenantId!, to: { kind: "tenant" }, category: "leave", franchiseId: auth.franchiseId ?? null, key: "leave-request",
        title: `Leave request — ${doc.name}`, body: `${doc.kind === "sickness" ? "Sickness" : "Time off"} · ${when} (${doc.days} day${doc.days === 1 ? "" : "s"})${doc.reason && doc.kind !== "sickness" ? ` · ${doc.reason}` : ""}. Approve or decline it in Leave & absence.`,
        href: "/company/holiday", ref: ref.id });
    } else if (doc.staffEmail && doc.staffEmail !== m.email) {
      await notifyTenantMember(auth.tenantId!, doc.staffEmail, { category: "leave", title: `Leave recorded for you: ${when}`, body: `${doc.kind} · ${doc.days} day${doc.days === 1 ? "" : "s"}. Check it in My leave.`, href: "/staff/holiday" });
    }
  })().catch((e) => console.error("[leave] notify:", (e as Error).message));
});

async function ownAbsence(req: Request, id: string) {
  const snap = await col.doc(id).get();
  if (!snap.exists || snap.get("tenantId") !== req.auth!.tenantId || snap.get("rotaKey") !== keyOf(req)) return null;
  return snap;
}

// PUT /api/leave/absences/:id — a manager edits a booking (dates, kind, pay…).
leave.put("/absences/:id", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canManage(auth.role)) { res.status(403).json({ error: "Only a manager can change someone's leave" }); return; }
  const snap = await ownAbsence(req, req.params.id);
  if (!snap) { res.status(404).json({ error: "Not found" }); return; }
  const parsed = absenceSchema.safeParse({ ...snap.data(), ...req.body });
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const { status: _s, id: _i, ...patch } = parsed.data; // decisions go through /decide
  await snap.ref.set({ ...patch, updatedAt: new Date().toISOString(), updatedBy: req.user?.email ?? null }, { merge: true });
  res.json({ id: snap.id, ...(await snap.ref.get()).data() });
});

// POST /api/leave/absences/:id/decide {status: approved|declined, note}
leave.post("/absences/:id/decide", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canManage(auth.role)) { res.status(403).json({ error: "Only a manager can approve or decline leave" }); return; }
  const parsed = z.object({ status: z.enum(["approved", "declined"]), note: z.string().trim().max(1_000).optional() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const snap = await ownAbsence(req, req.params.id);
  if (!snap) { res.status(404).json({ error: "Not found" }); return; }
  const now = new Date().toISOString();
  const by = req.user?.name ?? req.user?.email ?? "Manager";
  await snap.ref.set({ status: parsed.data.status, decidedBy: by, decidedAt: now, ...(parsed.data.note ? { note: parsed.data.note } : {}) }, { merge: true });
  res.json({ ok: true, status: parsed.data.status, decidedBy: by, decidedAt: now });

  const a = snap.data() as AbsenceDoc;
  const email = a.staffEmail ?? (await emailForName(auth.tenantId, a.name ?? "", auth.franchiseId ?? null));
  if (email) {
    const when = a.start === a.end ? a.start : `${a.start} – ${a.end}`;
    void notifyTenantMember(auth.tenantId, email, {
      category: "leave",
      title: parsed.data.status === "approved" ? `Leave approved: ${when}` : `Leave declined: ${when}`,
      body: parsed.data.status === "approved" ? `${by} approved your ${a.kind} leave.` : `${by} declined it${parsed.data.note ? ` — "${parsed.data.note}"` : ""}.`,
      href: "/staff/holiday",
      sendEmail: true,
    }).catch(() => {});
  }
});

// POST /api/leave/absences/:id/cancel — the person (their own, while it's
// pending or still in the future) or a manager.
leave.post("/absences/:id/cancel", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canRead(auth.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const snap = await ownAbsence(req, req.params.id);
  if (!snap) { res.status(404).json({ error: "Not found" }); return; }
  const a = snap.data() as AbsenceDoc;
  if (!canManage(auth.role)) {
    if (!isMine(req, a)) { res.status(404).json({ error: "Not found" }); return; }
    const today = ukToday();
    if (a.status !== "pending" && a.start <= today) { res.status(409).json({ error: "This leave has started — ask your manager to change it" }); return; }
  }
  await snap.ref.set({ status: "cancelled", cancelledAt: new Date().toISOString(), cancelledBy: req.user?.email ?? null }, { merge: true });
  res.json({ ok: true });
});

// PUT /api/leave/config {policy?, profiles?} — Setup + allowances (managers).
leave.put("/config", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canManage(auth.role)) { res.status(403).json({ error: "Only a manager can change leave settings" }); return; }
  const parsed = z.object({
    policy: z.record(z.string(), z.unknown()).optional(),
    profiles: z.array(z.object({ id: z.string().max(120), name: z.string().max(120) }).passthrough()).max(2_000).optional(),
  }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  await db.collection("leaveConfig").doc(keyOf(req)).set({
    tenantId: auth.tenantId, franchiseId: auth.franchiseId ?? null, updatedAt: new Date().toISOString(),
    ...(parsed.data.policy ? { policy: parsed.data.policy } : {}),
    ...(parsed.data.profiles ? { profiles: parsed.data.profiles } : {}),
  }, { merge: true });
  res.json({ ok: true });
});
