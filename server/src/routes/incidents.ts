import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";
import { notify, parentEmailForChild } from "../lib/notify";

// ─────────────────────────────────────────────────────────────────────────
// Incidents & Accidents (Pupils) — the safeguarding log every OFSTED-
// registered provider must keep. One collection, `kind` discriminates:
//   accident — a child got hurt (body part, injury, treatment, first aider)
//   incident — anything else recorded (behaviour, near-miss, safeguarding
//              concern) with the action taken.
//
// Staff record these on the ground (it's their job, like registers), so
// staff can read and create; only operators edit or delete — a safeguarding
// record shouldn't be quietly changed or removed by whoever's on shift.
// Tenant-scoped; not parent-facing (parents are informed out of band, and
// the record tracks that they were).
// ─────────────────────────────────────────────────────────────────────────

export const incidents = Router();

const col = db.collection("incidents");

const canRecord = (role: Role) =>
  role === "staff" || role === "company" || role === "freelancer" || role === "franchise";
const canManage = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";

const logSchema = z.object({
  kind: z.enum(["accident", "incident"]),
  date: z.string().max(10), // ISO date of the event
  time: z.string().max(8).optional(), // "14:30"
  childId: z.string().max(60).optional(),
  childName: z.string().trim().min(1).max(80),
  blockId: z.string().max(60).optional(),
  listingId: z.string().max(60).optional(),
  sessionLabel: z.string().max(160).optional(),
  location: z.string().trim().max(160).optional(),
  description: z.string().trim().min(1).max(4_000), // what happened
  // accident-specific
  bodyPart: z.string().trim().max(120).optional(),
  injury: z.string().trim().max(300).optional(),
  treatment: z.string().trim().max(1_000).optional(),
  firstAider: z.string().trim().max(120).optional(),
  // incident-specific
  incidentType: z.string().trim().max(120).optional(),
  actionTaken: z.string().trim().max(2_000).optional(),
  witnesses: z.string().trim().max(300).optional(),
  severity: z.enum(["minor", "moderate", "serious"]).default("minor"),
  parentNotified: z.boolean().default(false),
  parentNotifiedAt: z.string().max(25).optional(),
  parentNotifiedHow: z.string().max(60).optional(),
  // On an edit, whether staff chose to alert the parent (email + bell) or to
  // just update the record on their profile silently. Read by the notify layer.
  notifyParentOfEdit: z.boolean().optional(),
  photoUrl: z.string().max(500).optional(),
  followUp: z.string().trim().max(2_000).optional(),
});

/** The provider's Safeguarding toggles (Setup → Safeguarding). Accidents are
 *  notified by default because a parent has a right to know their child was
 *  hurt; other incidents are opt-in, since "incident" covers everything from a
 *  near-miss to a behaviour note and not every one warrants an email home. */
async function safeguardingSettings(tenantId: string) {
  const lib = await db.collection("libraries").doc(tenantId).get();
  const sg = (lib.data()?.settings as { safeguarding?: Record<string, boolean> } | undefined)?.safeguarding ?? {};
  return {
    notifyParentAccident: sg.notifyParentAccident !== false,
    notifyParentIncident: sg.notifyParentIncident === true,
    notifyStaffAcknowledged: sg.notifyStaffAcknowledged !== false,
  };
}

const kindWord = (kind: string) => (kind === "accident" ? "accident" : "incident");

function tenantScope(req: Request): { role: Role; tenantId: string | null } | null {
  const auth = req.auth!;
  return auth.tenantId || auth.role === "platform" ? { role: auth.role, tenantId: auth.tenantId } : null;
}

// GET /api/incidents?kind=&childId=&from=&to= — the tenant's log, newest
// first. Staff and operators read; platform passes ?tenantId=.
incidents.get("/", async (req, res) => {
  const auth = req.auth!;
  if (auth.role === "parent") {
    // A parent reads their OWN children's records (accidents/incidents),
    // across every provider — scoped by the child's parentUid.
    const kids = await db.collection("children").where("parentUid", "==", req.user!.uid).get();
    const ids = kids.docs.map((d) => d.id).slice(0, 10);
    if (!ids.length) { res.json([]); return; }
    const snap = await col.where("childId", "in", ids).get();
    let list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { id: string; kind?: string; date?: string; time?: string; tenantId?: string })[];
    if (req.query.kind === "accident" || req.query.kind === "incident") list = list.filter((x) => x.kind === req.query.kind);
    // Attach the owning provider's "require acknowledgement" flag so the parent
    // UI only nags on records from providers who ask for it.
    const tenantIds = [...new Set(list.map((x) => x.tenantId).filter(Boolean) as string[])];
    const requireByTenant: Record<string, boolean> = {};
    await Promise.all(tenantIds.map(async (tid) => {
      const lib = await db.collection("libraries").doc(tid).get();
      const sg = (lib.data()?.settings as { safeguarding?: { requireAcknowledgement?: boolean } } | undefined)?.safeguarding;
      requireByTenant[tid] = sg?.requireAcknowledgement === true;
    }));
    list = list.map((x) => ({ ...x, requireAck: x.tenantId ? (requireByTenant[x.tenantId] ?? false) : false }));
    list.sort((a, b) => (`${b.date} ${b.time ?? ""}` < `${a.date} ${a.time ?? ""}` ? -1 : 1));
    res.json(list);
    return;
  }
  let tenantId = auth.tenantId;
  if (auth.role === "platform") {
    tenantId = typeof req.query.tenantId === "string" ? req.query.tenantId : null;
    if (!tenantId) {
      res.status(400).json({ error: "Platform accounts must pass ?tenantId=" });
      return;
    }
  }
  if (!tenantId) {
    res.status(403).json({ error: "Your account has no tenant" });
    return;
  }
  let q = col.where("tenantId", "==", tenantId) as FirebaseFirestore.Query;
  if (req.query.kind === "accident" || req.query.kind === "incident") q = q.where("kind", "==", req.query.kind);
  if (typeof req.query.childId === "string") q = q.where("childId", "==", req.query.childId);
  const snap = await q.get();
  let list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { id: string; date?: string; time?: string })[];
  const from = typeof req.query.from === "string" ? req.query.from : null;
  const to = typeof req.query.to === "string" ? req.query.to : null;
  if (from) list = list.filter((x) => String(x.date) >= from);
  if (to) list = list.filter((x) => String(x.date) <= to);
  list.sort((a, b) => (`${b.date} ${b.time ?? ""}` < `${a.date} ${a.time ?? ""}` ? -1 : 1));
  res.json(list);
});

// POST /api/incidents — log an accident or incident (staff + operators).
incidents.post("/", async (req, res) => {
  const scope = tenantScope(req);
  if (!scope || !scope.tenantId || !canRecord(scope.role)) {
    res.status(403).json({ error: "Requires an operator or staff account with a tenant" });
    return;
  }
  const parsed = logSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const doc = {
    ...parsed.data,
    tenantId: scope.tenantId,
    recordedBy: req.user?.email ?? req.user?.uid ?? "unknown",
    recordedByName: req.user?.name ?? req.user?.email ?? "Staff",
    createdAt: new Date().toISOString(),
  };
  const ref = await col.add(doc);
  res.status(201).json({ id: ref.id, ...doc });

  // Tell the parent. Only possible when the record is linked to a child — a
  // walk-in with no booking has nobody to reach, and that's not an error.
  void (async () => {
    const gates = await safeguardingSettings(scope.tenantId!);
    if (!(doc.kind === "accident" ? gates.notifyParentAccident : gates.notifyParentIncident)) return;
    const email = await parentEmailForChild(doc.childId);
    if (!email) return;
    const word = kindWord(doc.kind);
    const when = `${doc.date}${doc.time ? ` at ${doc.time}` : ""}`;
    await notify({
      tenantId: scope.tenantId!,
      to: { kind: "parent", email },
      category: doc.kind === "accident" ? "accident" : "incident",
      title: `An ${word} was recorded for ${doc.childName}`,
      body: `${doc.description}${doc.treatment ? ` Treatment: ${doc.treatment}.` : ""}`,
      subject: `${doc.childName}: ${word} recorded on ${doc.date}`,
      emailHtml:
        `<p>An ${word} involving <b>${doc.childName}</b> was recorded on <b>${when}</b>.</p>` +
        `<p>${doc.description}</p>` +
        (doc.injury ? `<p><b>Injury:</b> ${doc.injury}${doc.bodyPart ? ` (${doc.bodyPart})` : ""}</p>` : "") +
        (doc.treatment ? `<p><b>Treatment given:</b> ${doc.treatment}${doc.firstAider ? ` — by ${doc.firstAider}` : ""}</p>` : "") +
        (doc.actionTaken ? `<p><b>Action taken:</b> ${doc.actionTaken}</p>` : ""),
      href: "/custdash/accidents",
      ref: ref.id,
    });
  })();
});

async function ownLog(req: Request, id: string) {
  const auth = req.auth!;
  if (!auth.tenantId) return { status: 403 as const };
  const snap = await col.doc(id).get();
  if (!snap.exists || snap.data()!.tenantId !== auth.tenantId) return { status: 404 as const };
  return { status: 200 as const, snap };
}

// PUT /api/incidents/:id — edit (operators, or the staff member who recorded
// it — they may need to finish or correct their own entry).
incidents.put("/:id", async (req, res) => {
  const own = await ownLog(req, req.params.id);
  if (own.status !== 200) {
    res.status(own.status).json({ error: own.status === 403 ? "Requires an operator account" : "Log not found" });
    return;
  }
  const auth = req.auth!;
  const recorder = own.snap.data()!.recordedBy;
  if (!canManage(auth.role) && recorder !== (req.user?.email ?? req.user?.uid)) {
    res.status(403).json({ error: "Only the provider or the person who recorded it can edit this" });
    return;
  }
  const parsed = logSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  // Only a real change is an edit. Re-saving an unchanged form must not send
  // the family a second "this was updated" email.
  const before = own.snap.data()!;
  const changed = Object.entries(parsed.data).filter(
    ([k, v]) => k !== "notifyParentOfEdit" && JSON.stringify(before[k]) !== JSON.stringify(v),
  );
  await own.snap.ref.set({ ...parsed.data, updatedAt: new Date().toISOString() }, { merge: true });
  const after = await own.snap.ref.get();
  res.json({ id: after.id, ...after.data() });

  // Staff choose per edit whether the family is alerted or the record is just
  // quietly corrected on their profile — the stamp updates either way.
  void (async () => {
    if (!changed.length || parsed.data.notifyParentOfEdit !== true) return;
    const rec = after.data()!;
    const kind = String(rec.kind ?? "incident");
    const gates = await safeguardingSettings(String(rec.tenantId));
    if (!(kind === "accident" ? gates.notifyParentAccident : gates.notifyParentIncident)) return;
    const email = await parentEmailForChild(rec.childId as string | undefined);
    if (!email) return;
    const word = kindWord(kind);
    await notify({
      tenantId: String(rec.tenantId),
      to: { kind: "parent", email },
      category: kind === "accident" ? "accident" : "incident",
      title: `An ${word} record for ${rec.childName} was updated`,
      body: String(rec.description ?? ""),
      subject: `${rec.childName}: ${word} record updated`,
      emailHtml:
        `<p>The ${word} record for <b>${rec.childName}</b> from <b>${rec.date}</b> has been updated by the provider.</p>` +
        `<p>${rec.description ?? ""}</p>`,
      href: "/custdash/accidents",
      ref: after.id,
    });
  })();
});

// POST /api/incidents/:id/acknowledge — a parent confirms they've seen the
// accident/incident for their child, so staff know it landed. Parent-only,
// scoped to their own child (like the medication note endpoint). Idempotent:
// re-acknowledging just refreshes the stamp.
incidents.post("/:id/acknowledge", async (req, res) => {
  const auth = req.auth!;
  if (auth.role !== "parent") { res.status(403).json({ error: "Only a parent can acknowledge this" }); return; }
  const snap = await col.doc(req.params.id).get();
  if (!snap.exists) { res.status(404).json({ error: "Record not found" }); return; }
  const childId = snap.data()!.childId as string | undefined;
  if (!childId) { res.status(404).json({ error: "Record not found" }); return; }
  const child = await db.collection("children").doc(childId).get();
  if (!child.exists || child.data()!.parentUid !== req.user!.uid) { res.status(404).json({ error: "Record not found" }); return; }
  const firstAck = !snap.data()!.acknowledgedAt;
  const who = req.user?.name ?? req.user?.email ?? "Parent";
  await snap.ref.set({ acknowledgedAt: new Date().toISOString(), acknowledgedBy: who }, { merge: true });
  res.json({ ok: true });

  // Tell the team the family has seen it — once. Re-acknowledging refreshes
  // the stamp but must not nag staff again.
  void (async () => {
    const rec = snap.data()!;
    if (!firstAck || !rec.tenantId) return;
    if (!(await safeguardingSettings(String(rec.tenantId))).notifyStaffAcknowledged) return;
    const word = kindWord(String(rec.kind ?? "incident"));
    await notify({
      tenantId: String(rec.tenantId),
      to: { kind: "tenant" },
      category: rec.kind === "accident" ? "accident" : "incident",
      title: `${who} acknowledged the ${word} for ${rec.childName}`,
      body: `The ${word} recorded on ${rec.date} has been seen by the parent.`,
      href: "/company/accidents",
      ref: snap.id,
    });
  })();
});

// POST /api/incidents/:id/note — append a note to the record's thread. Both a
// parent (on their own child) and staff/operators (on their tenant) can add
// one, so an accident can be discussed in one place. Notes are append-only.
const noteSchema = z.object({ text: z.string().trim().min(1).max(2_000) });
incidents.post("/:id/note", async (req, res) => {
  const auth = req.auth!;
  const parsed = noteSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const snap = await col.doc(req.params.id).get();
  if (!snap.exists) { res.status(404).json({ error: "Record not found" }); return; }
  const data = snap.data()!;
  let role: "parent" | "staff";
  if (auth.role === "parent") {
    const childId = data.childId as string | undefined;
    if (!childId) { res.status(404).json({ error: "Record not found" }); return; }
    const child = await db.collection("children").doc(childId).get();
    if (!child.exists || child.data()!.parentUid !== req.user!.uid) { res.status(404).json({ error: "Record not found" }); return; }
    role = "parent";
  } else if (canRecord(auth.role) && auth.tenantId && data.tenantId === auth.tenantId) {
    role = "staff";
  } else {
    res.status(403).json({ error: "You can't add a note here" }); return;
  }
  const note = {
    by: req.user?.name ?? req.user?.email ?? (role === "parent" ? "Parent" : "Staff"),
    role, text: parsed.data.text, at: new Date().toISOString(),
  };
  const notes = Array.isArray(data.notes) ? data.notes : [];
  await snap.ref.set({ notes: [...notes, note] }, { merge: true });
  res.status(201).json({ ok: true, note });
});

// DELETE /api/incidents/:id — operators only. A safeguarding record isn't
// something whoever's on shift should be able to remove.
incidents.delete("/:id", async (req, res) => {
  const own = await ownLog(req, req.params.id);
  if (own.status !== 200) {
    res.status(own.status).json({ error: own.status === 403 ? "Requires an operator account" : "Log not found" });
    return;
  }
  if (!canManage(req.auth!.role)) {
    res.status(403).json({ error: "Only the provider can delete a safeguarding record" });
    return;
  }
  await own.snap.ref.delete();
  res.json({ ok: true });
});
