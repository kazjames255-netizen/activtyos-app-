import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";
import { notify, parentEmailForChild } from "../lib/notify";

// Trips & visits (Run the day) — the record for an off-site trip: where, when,
// who's going (children + staff), transport, the risk-assessment note and
// headcount. Staff and operators create; operators delete. Tenant-scoped.
export const trips = Router();
const col = db.collection("trips");
const canUse = (role: Role) => role === "staff" || role === "company" || role === "freelancer" || role === "franchise";
const canManage = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";

const tripSchema = z.object({
  destination: z.string().trim().min(1).max(160),
  address: z.string().trim().max(240).optional(),
  date: z.string().max(10),
  departTime: z.string().max(8).optional(),
  returnTime: z.string().max(8).optional(),
  listingId: z.string().max(60).optional(),
  transport: z.string().trim().max(160).optional(),
  childNames: z.array(z.string().max(80)).max(200).default([]),
  staff: z.array(z.string().max(80)).max(50).default([]),
  headcount: z.number().int().nonnegative().optional(),
  riskAssessment: z.string().trim().max(4_000).optional(),
  // Structured risk assessment (the manual's hazard table): each hazard names
  // who's at risk, the controls, an initial and residual risk (L/M/H) and
  // whether the controls are confirmed in place. Signed off by an assessor.
  hazards: z.array(z.object({
    h: z.string().max(200),
    who: z.string().max(400).optional(),
    controls: z.string().max(4_000).optional(),
    initial: z.enum(["L", "M", "H", ""]).optional(),
    residual: z.enum(["L", "M", "H", ""]).optional(),
    done: z.boolean().optional(),
    amendedOn: z.string().max(40).optional(),
    amendedBy: z.string().max(120).optional(),
  })).max(80).optional(),
  raSigned: z.boolean().optional(),
  raAssessor: z.string().max(120).optional(),
  raDate: z.string().max(40).optional(),
  raRef: z.string().max(60).optional(),
  raReview: z.string().max(200).optional(),
  // The manual's full 7-step planner: a trip lead + EVC + cost + off-site ratio,
  // an itinerary, an equipment/kit note, a staff roster (roles + first-aider),
  // an attendee list (per-child consent + paid + flags), on-the-day head-count
  // checkpoints, the line-manager sign-off and whether it has returned.
  lead: z.string().max(120).optional(),
  leadPhone: z.string().max(40).optional(),
  evc: z.string().max(120).optional(),
  cost: z.string().max(20).optional(),
  offsiteRatio: z.number().int().positive().max(50).optional(),
  itinerary: z.array(z.object({ t: z.string().max(20).optional(), a: z.string().max(200).optional(), k: z.string().max(300).optional() })).max(40).optional(),
  kit: z.string().max(1_000).optional(),
  roster: z.array(z.object({ n: z.string().max(80), r: z.string().max(80).optional(), fa: z.boolean().optional() })).max(50).optional(),
  // childId + the consent trail are stamped server-side (see enrichTrip) —
  // accepted here so an operator PUT can't accidentally strip them.
  attendees: z.array(z.object({ n: z.string().max(80), childId: z.string().max(60).optional(), age: z.number().nonnegative().optional(), consent: z.enum(["granted", "pending", "declined"]).optional(), consentAt: z.string().max(60).optional(), consentBy: z.string().max(160).optional(), consentRequestedAt: z.string().max(60).optional(), paid: z.boolean().optional(), em: z.boolean().optional(), med: z.string().max(160).optional(), sent: z.boolean().optional() })).max(200).optional(),
  checkpoints: z.array(z.object({ n: z.string().max(80), counted: z.number().int().nonnegative().nullable().optional(), time: z.string().max(40).optional() })).max(30).optional(),
  signoff: z.object({ approvedBy: z.string().max(120).optional(), approvedAt: z.string().max(60).optional(), submitted: z.boolean().optional() }).optional(),
  returned: z.boolean().optional(),
  // Optional parent message/payment step: an editable template + a pay-by date.
  // Sending the link + showing it in the parent's profile is Amir's.
  parentMsg: z.string().max(4_000).optional(),
  payBy: z.string().max(40).optional(),
  parentMsgSentAt: z.string().max(60).optional(),
  askPay: z.boolean().optional(),
  askConsent: z.boolean().optional(),
  consentObtained: z.boolean().default(false),
  notes: z.string().trim().max(2_000).optional(),
  status: z.enum(["planned", "completed", "cancelled"]).default("planned"),
});

type Attendee = {
  n: string; childId?: string; age?: number;
  consent?: "granted" | "pending" | "declined"; consentAt?: string; consentBy?: string; consentRequestedAt?: string;
  paid?: boolean; em?: boolean; med?: string; sent?: boolean;
};

/** Setup → Trips & visits toggles (defaults per the handoff: both on). */
async function tripSettings(tenantId: string) {
  const lib = await db.collection("libraries").doc(tenantId).get();
  const t = (lib.data()?.settings as { trips?: Record<string, unknown> } | undefined)?.trips ?? {};
  return { notifyParent: t.notifyParent !== false, requireConsent: t.requireConsent !== false };
}

// ── Server-side enrichment (the handoff's #2) ────────────────────────────
// The front-end picks booked children by NAME; parents are reached by
// childId. Resolve names against the tenant's bookings (same matching the
// medication flow uses), guarantee an attendee entry per child, and fill
// the emergency/medical flags from the child's own profile.
async function enrichTrip(
  tenantId: string,
  childNames: string[],
  attendees: Attendee[] | undefined,
): Promise<{ attendees: Attendee[]; childIds: string[] }> {
  const list: Attendee[] = (attendees ?? []).map((a) => ({ ...a }));
  for (const n of childNames) {
    if (!list.some((a) => a.n.trim().toLowerCase() === n.trim().toLowerCase())) {
      list.push({ n, consent: "pending" });
    }
  }
  if (!list.length) return { attendees: [], childIds: [] };

  // One tenant-wide scan resolves every name (per-name queries would be N×).
  const bookings = await col.firestore.collection("bookings").where("tenantId", "==", tenantId).get();
  const idByName = new Map<string, string>();
  for (const d of bookings.docs) {
    const b = d.data() as { child?: string; childId?: string; kids?: { name?: string; childId?: string }[] };
    if (b.childId && b.child) idByName.set(b.child.trim().toLowerCase(), b.childId);
    for (const k of b.kids ?? []) if (k.childId && k.name) idByName.set(k.name.trim().toLowerCase(), k.childId);
  }
  for (const a of list) a.childId = a.childId ?? idByName.get(a.n.trim().toLowerCase());

  const ids = [...new Set(list.map((a) => a.childId).filter(Boolean) as string[])];
  if (ids.length) {
    const kids = await db.getAll(...ids.map((id) => db.collection("children").doc(id)));
    const profile = new Map(kids.filter((k) => k.exists).map((k) => [k.id, k.data() as { emergencyName?: string; emergencyPhone?: string; medical?: string; allergies?: string }]));
    for (const a of list) {
      const p = a.childId ? profile.get(a.childId) : undefined;
      if (!p) continue;
      a.em = Boolean(p.emergencyName || p.emergencyPhone);
      const med = [p.medical, p.allergies].filter(Boolean).join(" · ");
      if (med && !a.med) a.med = med.slice(0, 160);
    }
  }
  return { attendees: list, childIds: ids };
}

// ── Consent requests (the handoff's #1) ──────────────────────────────────
// Email + bell each newly-added child's parent, once — the stamped
// consentRequestedAt is the "already asked" marker the chase sweep also
// keys off. Fire-and-forget: notifying must never fail the trip save.
async function requestConsents(tripId: string, trip: Record<string, unknown>): Promise<void> {
  const tenantId = String(trip.tenantId);
  if (trip.status !== "planned" || trip.askConsent === false) return;
  if (!(await tripSettings(tenantId)).notifyParent) return;
  const attendees = (trip.attendees as Attendee[] | undefined) ?? [];
  const when = [trip.date, trip.departTime && `departing ${trip.departTime}`, trip.returnTime && `back ${trip.returnTime}`].filter(Boolean).join(", ");
  let changed = false;
  for (const a of attendees) {
    if (!a.childId || a.consentRequestedAt || (a.consent ?? "pending") !== "pending") continue;
    const email = await parentEmailForChild(a.childId);
    if (!email) continue;
    await notify({
      tenantId,
      to: { kind: "parent", email },
      category: "trip",
      title: `Consent needed: ${a.n} — trip to ${trip.destination}`,
      body: `${when}${trip.transport ? ` · ${trip.transport}` : ""}. Please give or decline consent in your Trips area.`,
      subject: `${a.n}: consent needed for the trip to ${trip.destination}`,
      emailHtml:
        `<p><b>${a.n}</b> is down for a trip to <b>${String(trip.destination)}</b> on <b>${when}</b>${trip.transport ? ` (travel: ${String(trip.transport)})` : ""}.</p>` +
        (trip.cost ? `<p>Cost: £${String(trip.cost)}${trip.payBy ? ` — pay by ${String(trip.payBy)}` : ""}.</p>` : "") +
        `<p>Please open your Trips area to <b>give or decline consent</b> — it takes one tap.</p>`,
      href: "/custdash/trips",
      ref: tripId,
    });
    a.consentRequestedAt = new Date().toISOString();
    a.sent = true;
    changed = true;
  }
  if (changed) await col.doc(tripId).set({ attendees }, { merge: true });
}

trips.get("/", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canUse(auth.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const snap = await col.where("tenantId", "==", auth.tenantId).get();
  const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { date?: string })[];
  list.sort((a, b) => (`${b.date}` < `${a.date}` ? -1 : 1));
  res.json(list);
});

trips.post("/", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canUse(auth.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const parsed = tripSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const enriched = await enrichTrip(auth.tenantId, parsed.data.childNames, parsed.data.attendees as Attendee[] | undefined);
  const doc = {
    ...parsed.data,
    attendees: enriched.attendees,
    childIds: enriched.childIds,
    headcount: parsed.data.headcount ?? parsed.data.childNames.length,
    tenantId: auth.tenantId,
    createdBy: req.user?.email ?? "unknown",
    createdByName: req.user?.name ?? req.user?.email ?? "Staff",
    createdAt: new Date().toISOString(),
  };
  const ref = await col.add(doc);
  void requestConsents(ref.id, doc).catch((e) => console.error("[trips] consent notify:", (e as Error).message));
  res.status(201).json({ id: ref.id, ...doc });
});

async function own(req: Request, id: string) {
  const auth = req.auth!;
  if (!auth.tenantId || !canUse(auth.role)) return { status: 403 as const };
  const snap = await col.doc(id).get();
  if (!snap.exists || snap.data()!.tenantId !== auth.tenantId) return { status: 404 as const };
  return { status: 200 as const, snap };
}

trips.put("/:id", async (req, res) => {
  const o = await own(req, req.params.id);
  if (o.status !== 200) { res.status(o.status).json({ error: o.status === 403 ? "Forbidden" : "Trip not found" }); return; }
  const parsed = tripSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const before = o.snap.data()!;
  const tenantId = String(before.tenantId);

  // Re-resolve whenever the children change; a merge must never lose the
  // consent trail already collected, so carry each existing attendee's
  // consent fields onto the incoming entry (matched by childId, else name).
  let patch: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.childNames || parsed.data.attendees) {
    const prev = (before.attendees as Attendee[] | undefined) ?? [];
    const incoming = (parsed.data.attendees as Attendee[] | undefined) ?? prev;
    const names = parsed.data.childNames ?? (before.childNames as string[] | undefined) ?? [];
    const enriched = await enrichTrip(tenantId, names, incoming);
    for (const a of enriched.attendees) {
      const was = prev.find((p) => (a.childId && p.childId === a.childId) || p.n.trim().toLowerCase() === a.n.trim().toLowerCase());
      if (!was) continue;
      a.consent = a.consent === undefined || a.consent === "pending" ? (was.consent ?? a.consent) : a.consent;
      a.consentAt = a.consentAt ?? was.consentAt;
      a.consentBy = a.consentBy ?? was.consentBy;
      a.consentRequestedAt = a.consentRequestedAt ?? was.consentRequestedAt;
    }
    patch = { ...patch, attendees: enriched.attendees, childIds: enriched.childIds };
  }

  // Enforcement (the handoff's #3): with Setup → requireConsent on, a trip
  // can't be completed while any attending child's consent is still pending
  // ("declined" = not coming — that child isn't on the trip to block it).
  if (parsed.data.status === "completed" && (before.askConsent !== false)) {
    const { requireConsent } = await tripSettings(tenantId);
    if (requireConsent) {
      const list = (patch.attendees as Attendee[] | undefined) ?? ((before.attendees as Attendee[] | undefined) ?? []);
      const pending = list.filter((a) => (a.consent ?? "pending") === "pending");
      if (pending.length) {
        res.status(409).json({ error: `${pending.length} ${pending.length === 1 ? "child still needs" : "children still need"} consent before this trip can be completed (${pending.map((a) => a.n).slice(0, 4).join(", ")}${pending.length > 4 ? "…" : ""}).` });
        return;
      }
    }
  }

  await o.snap.ref.set({ ...patch, updatedAt: new Date().toISOString() }, { merge: true });
  const after = await o.snap.ref.get();
  void requestConsents(after.id, after.data()!).catch((e) => console.error("[trips] consent notify:", (e as Error).message));
  res.json({ id: after.id, ...after.data() });
});

// POST /:id/send-message — the planner's Step 8: send the operator's message
// to every attending child's family (email + bell), with the trip's details
// merged in. {child} personalises per family; the other tokens come from the
// trip. Payment collection itself isn't wired yet — the message can carry
// payment instructions, and the operator records payment on the trip.
const SEND_TOKENS: [string, (t: Record<string, unknown>) => string][] = [
  ["{destination}", (t) => String(t.destination ?? "")],
  ["{date}", (t) => String(t.date ?? "")],
  ["{depart}", (t) => String(t.departTime ?? "")],
  ["{return}", (t) => String(t.returnTime ?? "")],
  ["{transport}", (t) => String(t.transport ?? "")],
  ["{cost}", (t) => (t.cost ? `£${String(t.cost)}` : "")],
  ["{payBy}", (t) => String(t.payBy ?? "")],
];

trips.post("/:id/send-message", async (req, res) => {
  const o = await own(req, req.params.id);
  if (o.status !== 200) { res.status(o.status).json({ error: o.status === 403 ? "Forbidden" : "Trip not found" }); return; }
  const trip = o.snap.data()!;
  const template = String((req.body?.message as string | undefined) ?? trip.parentMsg ?? "").trim();
  if (!template) { res.status(400).json({ error: "Write the parent message first (Step 8), then send." }); return; }

  const attendees = ((trip.attendees as Attendee[] | undefined) ?? []).filter((a) => a.consent !== "declined");
  let base = template;
  for (const [tok, fn] of SEND_TOKENS) base = base.split(tok).join(fn(trip));

  let sent = 0;
  for (const a of attendees) {
    if (!a.childId) continue;
    const email = await parentEmailForChild(a.childId);
    if (!email) continue;
    const msg = base.split("{child}").join(a.n);
    await notify({
      tenantId: String(trip.tenantId),
      to: { kind: "parent", email },
      category: "trip",
      title: `Trip to ${String(trip.destination)} — a message from your provider`,
      body: msg.slice(0, 600),
      subject: `${a.n}: trip to ${String(trip.destination)} on ${String(trip.date)}`,
      emailHtml: `<p>${msg.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>")}</p>`,
      href: "/custdash/trips",
      ref: o.snap.id,
    });
    a.sent = true;
    sent++;
  }
  const now = new Date().toISOString();
  await o.snap.ref.set({ attendees: (trip.attendees as Attendee[]) ?? [], parentMsgSentAt: now, updatedAt: now }, { merge: true });
  res.json({ ok: true, sent });
});

trips.delete("/:id", async (req, res) => {
  const o = await own(req, req.params.id);
  if (o.status !== 200) { res.status(o.status).json({ error: o.status === 403 ? "Forbidden" : "Trip not found" }); return; }
  if (!canManage(req.auth!.role)) { res.status(403).json({ error: "Only the provider can delete a trip" }); return; }
  await o.snap.ref.delete();
  res.json({ ok: true });
});
