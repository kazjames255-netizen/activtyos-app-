import { Router, type Request } from "express";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../firebase";
import { esc } from "../lib/html";
import { franchiseChildIds, isFranchise } from "../lib/franchiseScope";
import { notify, parentEmailForChild } from "../lib/notify";
import { franchiseForChild, loadSettings } from "../lib/tenantLibrary";
import { childVisibleTo } from "../lib/childAccess";
import { siteRecordFilter } from "../lib/siteScope";
import { isPlainStaff, type Role } from "../middleware/role";

// ─────────────────────────────────────────────────────────────────────────
// Medication (Pupils) — two records, because real practice is two things:
//
//   medications      — an AUTHORISED medicine for a child, with the parent's
//                      written consent. Nothing is given without one.
//   medicationAdmin  — the MAR: every dose actually given (what, when, how
//                      much, by whom, witnessed). The legal record.
//
// The consent gate is the whole point: you cannot log a dose against a
// medication that isn't authorised. Staff administer and record on the ground
// (their job); operators manage the authorisations. Tenant-scoped.
// ─────────────────────────────────────────────────────────────────────────

export const medications = Router();

const medsCol = db.collection("medications");
const adminCol = db.collection("medicationAdmin");

const canRecord = (role: Role) =>
  role === "staff" || role === "company" || role === "freelancer" || role === "franchise";
const canManage = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";

const medSchema = z.object({
  childId: z.string().max(60).optional(),
  childName: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120), // the medicine
  dose: z.string().trim().min(1).max(120), // "5ml", "one puff"
  route: z.string().trim().max(60).optional(), // oral / inhaler / cream …
  condition: z.string().trim().max(160).optional(), // "asthma"
  schedule: z.string().trim().max(200).optional(), // "twice daily", "as needed"
  instructions: z.string().trim().max(2000).optional(), // how to administer — shown to staff
  asNeeded: z.boolean().default(false), // PRN
  storage: z.string().trim().max(200).optional(),
  heldOnSite: z.boolean().default(false),
  startDate: z.string().max(10).optional(),
  endDate: z.string().max(10).optional(),
  expiryDate: z.string().max(10).optional(),
  // Parental consent — the authorising artefact. No consent, no medicine.
  consentBy: z.string().trim().max(120).optional(),
  consentDate: z.string().max(25).optional(),
  consentGranted: z.boolean().default(false),
  notes: z.string().trim().max(1_000).optional(),
  archived: z.boolean().default(false),
});

/** The provider's Medication toggles (Setup → Medication), all default-on.
 *  Pass the franchise the child belongs to: a franchise keeps its own Setup,
 *  and reading the head office's instead made its safety gates decorative. */
async function medSettings(tenantId: string, franchiseId?: string | null) {
  const s = await loadSettings(tenantId, franchiseId);
  const m = (s as { medication?: Record<string, boolean> }).medication ?? {};
  return {
    informParentGiven: m.informParentGiven !== false,
    informParentMissed: m.informParentMissed !== false,
    notifyParentNote: m.notifyParentNote !== false,
    notifyParentAuthorise: m.notifyParentAuthorise !== false,
    // Two SAFETY gates, not notification prefs. Both default OFF (a provider
    // opts in), matching how the operator screen reads them.
    leadsOnly: m.leadsOnly === true,
    requireWitness: m.requireWitness === true,
  };
}

/** The operator's medication form picks a child by NAME out of the customer
 *  list, which carries no canonical id — so a dose has nothing to reach the
 *  parent by. Resolve the name against this tenant's bookings, which DO carry
 *  `childId`. A walk-in with no booking stays unlinked, which is correct: there
 *  is no account to notify. */
async function resolveChildId(tenantId: string, childName: string): Promise<string | undefined> {
  const want = childName.trim().toLowerCase();
  if (!want) return undefined;
  const snap = await db.collection("bookings").where("tenantId", "==", tenantId).get();
  const found = new Set<string>();
  for (const d of snap.docs) {
    const b = d.data() as { child?: string; childId?: string; kids?: { name?: string; childId?: string }[] };
    if (b.childId && (b.child ?? "").trim().toLowerCase() === want) found.add(b.childId);
    for (const k of b.kids ?? []) if (k.childId && (k.name ?? "").trim().toLowerCase() === want) found.add(k.childId);
  }
  // Two different children with this name: don't guess. Linking a medicine
  // (and its dose notifications) to the wrong child's parent is worse than
  // leaving it unlinked for the picker to fix.
  return found.size === 1 ? [...found][0] : undefined;
}

const tenantOf = (req: Request) => {
  const auth = req.auth!;
  if (auth.role === "platform") return typeof req.query.tenantId === "string" ? req.query.tenantId : null;
  return auth.tenantId;
};

// A parent's own children (by uid) — the scope for everything a parent reads
// or authorises. Firestore `in` caps at 10, which is plenty for one family.
async function myChildIds(uid: string): Promise<string[]> {
  const snap = await db.collection("children").where("parentUid", "==", uid).get();
  return snap.docs.map((d) => d.id).slice(0, 10);
}
async function ownsChild(uid: string, childId: string): Promise<boolean> {
  const d = await db.collection("children").doc(childId).get();
  return d.exists && d.data()!.parentUid === uid;
}
/** Staff assigned to certain sites (a site lead) see medication for children
 *  booked at those sites, plus any they recorded themselves — the list, each
 *  record (so a dose can't be logged elsewhere) and the MAR. */
const siteMedFilter = (req: Request) => {
  const me = req.user?.email ?? req.user?.uid;
  return siteRecordFilter(req.auth!, (r) => !!me && r.recordedBy === me);
};

async function hasBooking(tenantId: string, email: string): Promise<boolean> {
  const snap = await db.collection("bookings").where("tenantId", "==", tenantId).where("email", "==", email).limit(1).get();
  return !snap.empty;
}

// ——— Authorised medications ———

// GET /api/medications?childId=&includeArchived=
medications.get("/", async (req, res) => {
  const auth = req.auth!;
  if (auth.role === "parent") {
    // A parent sees their OWN children's medications, across every provider.
    const ids = await myChildIds(req.user!.uid);
    if (!ids.length) { res.json([]); return; }
    const snap = await medsCol.where("childId", "in", ids).get();
    let list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { id: string; archived?: boolean; childName?: string })[];
    if (req.query.includeArchived !== "1") list = list.filter((m) => !m.archived);
    list.sort((a, b) => (`${a.childName ?? ""}` < `${b.childName ?? ""}` ? -1 : 1));
    res.json(list);
    return;
  }
  const tenantId = tenantOf(req);
  if (!tenantId) {
    res.status(auth.role === "platform" ? 400 : 403).json({ error: "No tenant" });
    return;
  }
  let q = medsCol.where("tenantId", "==", tenantId) as FirebaseFirestore.Query;
  if (typeof req.query.childId === "string") q = q.where("childId", "==", req.query.childId);
  const snap = await q.get();
  let list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { id: string; archived?: boolean; name?: string; childId?: string })[];
  // A franchise sees medications only for ITS OWN children (booked on its listings).
  if ((auth.role === "franchise" || auth.role === "staff") && auth.franchiseId) {
    const kids = await franchiseChildIds(tenantId, auth.franchiseId);
    list = list.filter((m) => m.franchiseId === auth.franchiseId || (typeof m.childId === "string" && kids.has(m.childId)));
  }
  const inSite = await siteMedFilter(req);
  if (inSite) list = list.filter(inSite);
  if (req.query.includeArchived !== "1") list = list.filter((m) => !m.archived);
  list.sort((a, b) => ((a.childName as string) < (b.childName as string) ? -1 : 1));
  res.json(list);
});

// POST /api/medications — authorise a medication (staff + operators).
medications.post("/", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canRecord(auth.role)) {
    res.status(403).json({ error: "Requires an operator or staff account with a tenant" });
    return;
  }
  const parsed = medSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  // Only a child this provider has — else the medicine appears on another
  // provider's child's record and their parent is asked to consent to it.
  if (parsed.data.childId && !(await childVisibleTo(auth, parsed.data.childId))) {
    res.status(403).json({ error: "That child isn't booked with you", code: "child_not_yours" });
    return;
  }
  const doc = {
    ...parsed.data,
    // Stamped here, not by the client: without it the medication and every
    // dose against it are invisible to the parent.
    childId: parsed.data.childId || (await resolveChildId(auth.tenantId, parsed.data.childName)) || null,
    tenantId: auth.tenantId,
    franchiseId: auth.franchiseId ?? null,
    recordedBy: req.user?.email ?? req.user?.uid ?? "unknown",
    recordedByName: req.user?.name ?? req.user?.email ?? "Staff",
    createdAt: new Date().toISOString(),
    // A consent entered by the provider (a paper form, a phone call) is legit,
    // but the record has to say WHO on the team entered it — `consentBy` is
    // free text naming the parent and proves nothing on its own.
    ...(parsed.data.consentGranted ? consentStamp(req, "consent recorded by provider", true) : {}),
  };
  const ref = await medsCol.add(doc);
  res.status(201).json({ id: ref.id, ...doc });
});

/** Who changed a consent, and when — kept on the record and appended to its
 *  history, so "who authorised this medicine" always has an answer. */
function consentStamp(req: Request, what: string, fresh = false) {
  const at = new Date().toISOString();
  const by = req.user?.email ?? req.user?.uid ?? "unknown";
  const entry = { at, by, what };
  return {
    consentRecordedBy: by,
    consentRecordedByName: req.user?.name ?? by,
    consentRecordedAt: at,
    // A new doc gets a plain array (it's also echoed back as JSON); an edit
    // appends without a read-modify-write race.
    consentHistory: fresh ? [entry] : FieldValue.arrayUnion(entry),
  };
}

async function ownMed(req: Request, id: string) {
  const auth = req.auth!;
  if (!auth.tenantId) return { status: 403 as const };
  const snap = await medsCol.doc(id).get();
  if (!snap.exists || snap.data()!.tenantId !== auth.tenantId) return { status: 404 as const };
  // A franchise (and its staff) acts only on records for its own children —
  // the same rule as the list — not a sibling franchise's (acceptance test d22s4).
  if (isFranchise(auth)) {
    const rec = snap.data()!;
    const childId = rec.childId as string | undefined;
    const mine = rec.franchiseId === auth.franchiseId || (!!childId && (await franchiseChildIds(auth.tenantId, auth.franchiseId)).has(childId));
    if (!mine) return { status: 404 as const };
  }
  const inSite = await siteMedFilter(req);
  if (inSite && !inSite(snap.data()!)) return { status: 404 as const };
  return { status: 200 as const, snap };
}

// PUT /api/medications/:id — edit (operator or recorder). Archiving is a PUT
// with {archived:true} — a medication with an administration history is never
// hard-deleted, because the MAR must survive.
medications.put("/:id", async (req, res) => {
  const own = await ownMed(req, req.params.id);
  if (own.status !== 200) {
    res.status(own.status).json({ error: own.status === 403 ? "Requires an operator account" : "Medication not found" });
    return;
  }
  const auth = req.auth!;
  if (!canManage(auth.role) && own.snap.data()!.recordedBy !== (req.user?.email ?? req.user?.uid)) {
    res.status(403).json({ error: "Only the provider or whoever recorded it can edit this" });
    return;
  }
  const parsed = medSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const before = own.snap.data()!;
  if (parsed.data.childId && parsed.data.childId !== before.childId && !(await childVisibleTo(auth, parsed.data.childId))) {
    res.status(403).json({ error: "That child isn't booked with you", code: "child_not_yours" });
    return;
  }
  const patch: Record<string, unknown> = { ...parsed.data };
  // A parent's withdrawal is final from the provider's side. Re-granting it, or
  // un-archiving the record so doses can be given again, used to be a plain
  // edit — a provider could undo a parent saying "stop" with nothing on the
  // record to say who did it. The parent has to authorise again themselves.
  if (before.consentWithdrawnAt && (patch.consentGranted === true || patch.archived === false)) {
    res.status(409).json({
      error: `The parent withdrew consent for this on ${String(before.consentWithdrawnAt).slice(0, 10)}. Only they can authorise it again — ask them to add it from their portal.`,
    });
    return;
  }
  // A consent the PARENT gave in their portal stays attributed to them: the
  // provider can't rewrite whose name or date is on it.
  if (before.source === "parent") { delete patch.consentBy; delete patch.consentDate; }
  const grantChanged = typeof patch.consentGranted === "boolean" && patch.consentGranted !== (before.consentGranted === true);
  await own.snap.ref.set({
    ...patch,
    ...(grantChanged ? consentStamp(req, patch.consentGranted ? "consent recorded by provider" : "consent removed by provider") : {}),
    updatedAt: new Date().toISOString(),
  }, { merge: true });
  const after = await own.snap.ref.get();
  res.json({ id: after.id, ...after.data() });
});

// DELETE /api/medications/:id — operators only, and only for a record entered
// by mistake. Once a dose has been recorded OR the parent has withdrawn consent
// it can only be ARCHIVED — kept with its full history, hidden from the active
// list, shown under Archived and in exports (decided by Kaz 13 Sept, d12s6):
// deleting a withdrawn medicine erased the parent's "stop" from the record.
medications.delete("/:id", async (req, res) => {
  const own = await ownMed(req, req.params.id);
  if (own.status !== 200) {
    res.status(own.status).json({ error: own.status === 403 ? "Requires an operator account" : "Medication not found" });
    return;
  }
  if (!canManage(req.auth!.role)) {
    res.status(403).json({ error: "Only the provider can remove a medication" });
    return;
  }
  const rec = own.snap.data()!;
  if (rec.consentWithdrawnAt) {
    res.status(409).json({ error: `The parent withdrew consent for this on ${String(rec.consentWithdrawnAt).slice(0, 10)} — it's kept as part of the child's record and can't be deleted. It stays under Archived.`, code: "keep_archived" });
    return;
  }
  const given = await adminCol.where("medicationId", "==", req.params.id).limit(1).get();
  if (!given.empty) {
    res.status(409).json({ error: "This medication has doses recorded — archive it instead so the record is kept", code: "keep_archived" });
    return;
  }
  await own.snap.ref.delete();
  res.json({ ok: true });
});

// ——— Administration log (the MAR) ———

const administerSchema = z.object({
  date: z.string().max(10),
  time: z.string().max(8).optional(),
  doseGiven: z.string().trim().min(1).max(120),
  /** The outcome, first-class. `doseGiven` is free text ("5ml", "Not given"),
   *  which is no basis for deciding whether to tell a parent their child
   *  missed a dose. */
  given: z.boolean().optional(),
  witnessedBy: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1_000).optional(), // reaction, refused, etc.
  // Set when the caller has already been warned about a likely duplicate and
  // wants it recorded anyway (a genuine second dose can happen).
  confirmDuplicate: z.boolean().optional(),
});

// Two administer calls for the SAME medication within this window are almost
// always a double-tap (slow network retry, an accidental second submit), not
// a genuine second dose — flag it rather than silently recording both.
const MED_DUP_WINDOW_MS = 2 * 60 * 1000;

// POST /api/medications/:id/administer — log a dose given. Gated on an
// authorised, consented, unarchived medication — the safety rule.
medications.post("/:id/administer", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canRecord(auth.role)) {
    res.status(403).json({ error: "Requires an operator or staff account with a tenant" });
    return;
  }
  const own = await ownMed(req, req.params.id);
  if (own.status !== 200) {
    res.status(own.status).json({ error: "Medication not found" });
    return;
  }
  const med = own.snap.data()!;
  if (!med.consentGranted) {
    res.status(409).json({ error: "No parental consent on file for this medication — can't record a dose." });
    return;
  }
  if (med.archived) {
    res.status(409).json({ error: "This medication is archived." });
    return;
  }
  const parsed = administerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const expiryDate = med.expiryDate as string | undefined;
  if (expiryDate && expiryDate < parsed.data.date) {
    res.status(409).json({ error: `${med.name} expired on ${expiryDate} — check the medication before recording a dose.` });
    return;
  }
  if (!parsed.data.confirmDuplicate) {
    // No orderBy here on purpose — where(medicationId==) alone needs no
    // composite index; the window compare is cheap to do in memory over a
    // single medication's (small) admin history.
    const recent = await adminCol.where("medicationId", "==", req.params.id).get();
    const lastAt = recent.docs
      .map((d) => Date.parse((d.data() as { createdAt?: string }).createdAt ?? ""))
      .filter((t) => Number.isFinite(t))
      .sort((a, b) => b - a)[0];
    if (lastAt !== undefined && Date.now() - lastAt <= MED_DUP_WINDOW_MS) {
      res.status(409).json({
        error: `A dose of ${med.name} was just recorded a moment ago — is this a genuine second dose? Confirm to record it anyway.`,
        code: "possible_duplicate",
      });
      return;
    }
  }
  // Both of the following lived ONLY in MedicationApp.tsx — the button was
  // hidden and the form refused to submit, but the endpoint took the dose from
  // anyone who called it, and the client's own gate fails open if /api/me is
  // slow or errors. These are safety rules about administering a drug to a
  // child, so they belong next to the consent check, not in a form validator.
  // They are TENANT settings (Setup → Medication), not fields on the med doc.
  const safety = await medSettings(auth.tenantId, auth.franchiseId ?? (await franchiseForChild(auth.tenantId, med.childId as string | undefined)));
  if (safety.leadsOnly && isPlainStaff(auth)) {
    res.status(403).json({ error: "Doses are set to leads only — a lead or manager must record this one." });
    return;
  }
  if (safety.requireWitness && !parsed.data.witnessedBy?.trim()) {
    res.status(400).json({ error: "A witness is required for each dose — record who witnessed it." });
    return;
  }
  // A medication authorised before the child-link existed carries no childId,
  // and the parent's MAR is queried by it — so resolve now and backfill, or
  // this dose would never appear on their side.
  let childId = (med.childId as string | undefined) || undefined;
  if (!childId) {
    childId = await resolveChildId(auth.tenantId, String(med.childName));
    if (childId) void own.snap.ref.set({ childId }, { merge: true });
  }
  const doc = {
    ...parsed.data,
    tenantId: auth.tenantId,
    medicationId: req.params.id,
    medName: med.name,
    childId: childId ?? null,
    childName: med.childName,
    administeredBy: req.user?.email ?? req.user?.uid ?? "unknown",
    administeredByName: req.user?.name ?? req.user?.email ?? "Staff",
    createdAt: new Date().toISOString(),
  };
  const ref = await adminCol.add(doc);
  res.status(201).json({ id: ref.id, ...doc });

  // Tell the parent their child was given (or missed) their medicine.
  void (async () => {
    const given = parsed.data.given ?? !/^\s*not\s+given/i.test(parsed.data.doseGiven);
    const gates = safety;
    if (!(given ? gates.informParentGiven : gates.informParentMissed)) return;
    const email = await parentEmailForChild(childId);
    if (!email) return;
    const when = `${parsed.data.date}${parsed.data.time ? ` at ${parsed.data.time}` : ""}`;
    await notify({
      tenantId: auth.tenantId!,
      to: { kind: "parent", email },
      category: "medication",
      ignoreMute: !given,
      title: given
        ? `${med.childName} was given ${med.name}`
        : `${med.childName} did NOT have their ${med.name}`,
      body: `${parsed.data.doseGiven} · ${when}${parsed.data.notes ? ` — ${parsed.data.notes}` : ""}`,
      subject: given
        ? `${med.childName} had their ${med.name}`
        : `${med.childName} missed a dose of ${med.name}`,
      emailHtml:
        `<p><b>${esc(med.childName)}</b> ${given ? "was given" : "did <b>not</b> have"} <b>${esc(med.name)}</b> on <b>${when}</b>.</p>` +
        `<p><b>Dose:</b> ${esc(parsed.data.doseGiven)}</p>` +
        (parsed.data.notes ? `<p><b>Notes:</b> ${esc(parsed.data.notes)}</p>` : "") +
        `<p>Recorded by ${esc(doc.administeredByName)}.</p>`,
      href: "/custdash/medication",
      ref: ref.id,
    });
  })();
});

// GET /api/medications/administrations?date=&childId=&medicationId= — the MAR.
medications.get("/administrations", async (req, res) => {
  const auth = req.auth!;
  if (auth.role === "parent") {
    // The parent's own children's dose history (the MAR they're entitled to).
    const ids = await myChildIds(req.user!.uid);
    if (!ids.length) { res.json([]); return; }
    const snap = await adminCol.where("childId", "in", ids).get();
    let list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { id: string; date?: string; time?: string; medicationId?: string })[];
    if (typeof req.query.medicationId === "string") list = list.filter((x) => x.medicationId === req.query.medicationId);
    list.sort((a, b) => (`${b.date} ${b.time ?? ""}` < `${a.date} ${a.time ?? ""}` ? -1 : 1));
    res.json(list);
    return;
  }
  const tenantId = tenantOf(req);
  if (!tenantId) {
    res.status(auth.role === "platform" ? 400 : 403).json({ error: "No tenant" });
    return;
  }
  let q = adminCol.where("tenantId", "==", tenantId) as FirebaseFirestore.Query;
  if (typeof req.query.medicationId === "string") q = q.where("medicationId", "==", req.query.medicationId);
  if (typeof req.query.childId === "string") q = q.where("childId", "==", req.query.childId);
  const snap = await q.get();
  let list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { id: string; date?: string; time?: string; childId?: string; medicationId?: string })[];
  // The MAR follows the list: a franchise (and its staff) sees doses for its own
  // children; a site-scoped member of staff, doses at their sites or given by them.
  if (isFranchise(auth)) {
    const [kids, own] = await Promise.all([
      franchiseChildIds(tenantId, auth.franchiseId),
      medsCol.where("tenantId", "==", tenantId).where("franchiseId", "==", auth.franchiseId).get(),
    ]);
    const ownMeds = new Set(own.docs.map((d) => d.id));
    list = list.filter((x) => (typeof x.childId === "string" && kids.has(x.childId)) || ownMeds.has(String(x.medicationId)));
  }
  const me = req.user?.email ?? req.user?.uid;
  const inSite = await siteRecordFilter(auth, (r) => !!me && r.administeredBy === me);
  if (inSite) list = list.filter(inSite);
  if (typeof req.query.date === "string") list = list.filter((x) => x.date === req.query.date);
  list.sort((a, b) => (`${b.date} ${b.time ?? ""}` < `${a.date} ${a.time ?? ""}` ? -1 : 1));
  res.json(list);
});

// ——— Parent-authorised medications (digital consent) ———
//
// The consent gate is the whole point of this feature — and the most authentic
// consent is the parent's own. A parent authorises a medicine for THEIR child
// at a provider they've booked; the record lands consented, so staff can
// administer against it through the normal flow. The parent can withdraw it
// (archive) at any time. They never touch other families' data.

const authoriseSchema = z.object({
  tenantId: z.string().min(1).max(60),
  childId: z.string().min(1).max(60),
  childName: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  dose: z.string().trim().min(1).max(120),
  route: z.string().trim().max(60).optional(),
  condition: z.string().trim().max(160).optional(),
  schedule: z.string().trim().max(200).optional(),
  asNeeded: z.boolean().default(false),
  storage: z.string().trim().max(200).optional(),
  startDate: z.string().max(10).optional(),
  endDate: z.string().max(10).optional(),
  expiryDate: z.string().max(10).optional(),
  notes: z.string().trim().max(1_000).optional(),
});

// POST /api/medications/authorise — a parent authorises (consents to) a med.
medications.post("/authorise", async (req, res) => {
  const auth = req.auth!;
  if (auth.role !== "parent") { res.status(403).json({ error: "Only a parent can authorise their child's medication" }); return; }
  const parsed = authoriseSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const input = parsed.data;
  if (!(await ownsChild(req.user!.uid, input.childId))) { res.status(403).json({ error: "That child isn't on your account" }); return; }
  if (!(await hasBooking(input.tenantId, req.user!.email ?? ""))) { res.status(403).json({ error: "You can only authorise medication for a provider you've booked with" }); return; }
  const parentName = req.user?.name ?? req.user?.email ?? "Parent";
  const doc = {
    ...input,
    heldOnSite: false,
    archived: false,
    // The authorising artefact — granted by the parent, in their name, now.
    consentGranted: true,
    consentBy: parentName,
    consentDate: new Date().toISOString(),
    source: "parent" as const,
    recordedBy: req.user?.email ?? req.user?.uid ?? "parent",
    recordedByName: parentName,
    createdAt: new Date().toISOString(),
  };
  const ref = await medsCol.add(doc);
  res.status(201).json({ id: ref.id, ...doc });

  // A self-serve authorisation is easy for a provider to miss — it arrives
  // with no conversation attached, and staff can't give the medicine until
  // they know it's there.
  void (async () => {
    if (!(await medSettings(input.tenantId, await franchiseForChild(input.tenantId, input.childId))).notifyParentAuthorise) return;
    await notify({
      tenantId: input.tenantId,
      to: { kind: "tenant" },
      category: "medication",
      key: "med-consent",
      title: `${parentName} authorised ${input.name} for ${input.childName}`,
      body: `${input.dose}${input.schedule ? ` · ${input.schedule}` : ""}${input.condition ? ` · for ${input.condition}` : ""}`,
      subject: `New medication consent: ${input.name} for ${input.childName}`,
      emailHtml:
        `<p><b>${esc(parentName)}</b> has authorised <b>${esc(input.name)}</b> for <b>${esc(input.childName)}</b>.</p>` +
        `<p><b>Dose:</b> ${esc(input.dose)}${input.route ? ` (${esc(input.route)})` : ""}</p>` +
        (input.schedule ? `<p><b>When:</b> ${esc(input.schedule)}</p>` : "") +
        (input.notes ? `<p><b>From the parent:</b> ${esc(input.notes)}</p>` : "") +
        `<p>Consent is on file, so your team can record doses against it.</p>`,
      href: "/company/medication",
      ref: ref.id,
    });
  })();
});

// POST /api/medications/:id/consent — a parent gives consent to a medicine the
// PROVIDER entered (they added it at drop-off, or from a form). The only parent
// route used to be /authorise, which creates a separate record — so the
// provider's entry sat unconsented forever and showed the parent "consent
// withdrawn" with no way to say yes. Recorded in the parent's name, now; a
// parent may also re-consent to one they withdrew (the provider can't).
medications.post("/:id/consent", async (req, res) => {
  const auth = req.auth!;
  if (auth.role !== "parent") { res.status(403).json({ error: "Only the parent can give consent" }); return; }
  const snap = await medsCol.doc(req.params.id).get();
  if (!snap.exists) { res.status(404).json({ error: "Medication not found" }); return; }
  const med = snap.data()!;
  const childId = med.childId as string | undefined;
  if (!childId || !(await ownsChild(req.user!.uid, childId))) { res.status(404).json({ error: "Medication not found" }); return; }
  if (med.consentGranted === true) { res.json({ ok: true, already: true }); return; }
  const parentName = req.user?.name ?? req.user?.email ?? "Parent";
  const at = new Date().toISOString();
  await snap.ref.set({
    consentGranted: true, consentBy: parentName, consentDate: at, archived: false, consentWithdrawnAt: null,
    ...consentStamp(req, "consent given by parent"),
  }, { merge: true });
  res.json({ ok: true, consentBy: parentName, consentDate: at });
  void notify({
    tenantId: String(med.tenantId), to: { kind: "tenant" }, category: "medication", key: "med-consent",
    title: `${parentName} gave consent for ${med.name} (${med.childName})`,
    body: `${med.dose ?? ""}${med.schedule ? ` · ${med.schedule}` : ""}`,
    subject: `Medication consent given: ${med.name} for ${med.childName}`,
    emailHtml: `<p><b>${esc(parentName)}</b> has given consent for <b>${esc(String(med.name))}</b> for <b>${esc(String(med.childName))}</b>. Your team can now record doses.</p>`,
    href: "/company/medication", ref: snap.id,
  }).catch(() => {});
});

// POST /api/medications/:id/withdraw — a parent withdraws consent (archives).
// The record is kept (dose history must survive); it just can't be given again.
medications.post("/:id/withdraw", async (req, res) => {
  const auth = req.auth!;
  if (auth.role !== "parent") { res.status(403).json({ error: "Only a parent can withdraw their consent" }); return; }
  const snap = await medsCol.doc(req.params.id).get();
  if (!snap.exists) { res.status(404).json({ error: "Medication not found" }); return; }
  const childId = snap.data()!.childId as string | undefined;
  if (!childId || !(await ownsChild(req.user!.uid, childId))) { res.status(404).json({ error: "Medication not found" }); return; }
  await snap.ref.set({ archived: true, consentGranted: false, consentWithdrawnAt: new Date().toISOString() }, { merge: true });
  res.json({ ok: true });
});

// POST /api/medications/:id/note — a parent adds/edits their own note on a med
// (visible to staff). Scoped to their own child, like /withdraw.
const noteSchema = z.object({ note: z.string().trim().max(1_000) });
medications.post("/:id/note", async (req, res) => {
  const auth = req.auth!;
  if (auth.role !== "parent") { res.status(403).json({ error: "Only a parent can add a note here" }); return; }
  const parsed = noteSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const snap = await medsCol.doc(req.params.id).get();
  if (!snap.exists) { res.status(404).json({ error: "Medication not found" }); return; }
  const childId = snap.data()!.childId as string | undefined;
  if (!childId || !(await ownsChild(req.user!.uid, childId))) { res.status(404).json({ error: "Medication not found" }); return; }
  await snap.ref.set({ parentNote: parsed.data.note, parentNoteAt: new Date().toISOString() }, { merge: true });
  res.json({ ok: true });

  // The mirror of the dose notification, pointing the other way: a parent
  // adding "she's had a reaction to this before" needs to reach staff before
  // the next dose, not sit on a record nobody reopens.
  void (async () => {
    const med = snap.data()!;
    if (!med.tenantId || !parsed.data.note) return;
    if (!(await medSettings(String(med.tenantId), await franchiseForChild(String(med.tenantId), childId))).notifyParentNote) return;
    const who = req.user?.name ?? req.user?.email ?? "A parent";
    await notify({
      tenantId: String(med.tenantId),
      to: { kind: "tenant" },
      category: "medication",
      key: "med-note",
      title: `${who} left a note on ${med.childName}'s ${med.name}`,
      body: parsed.data.note,
      subject: `Note from ${who} about ${med.childName}'s medication`,
      emailHtml:
        `<p><b>${esc(who)}</b> added a note to <b>${esc(med.childName)}</b>'s <b>${esc(med.name)}</b>:</p>` +
        `<blockquote style="border-left:3px solid #cdddf7;margin:12px 0;padding:6px 0 6px 14px;color:#4a4763">${esc(parsed.data.note)}</blockquote>`,
      href: "/company/medication",
      ref: snap.id,
    });
  })();
});
