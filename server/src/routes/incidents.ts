import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "../firebase";
import { esc } from "../lib/html";
import { bareImageUrl, signImageUrl } from "../lib/signing";
import { franchiseChildIds, isFranchise } from "../lib/franchiseScope";
import { franchiseForChild, loadSettings } from "../lib/tenantLibrary";
import { childVisibleTo } from "../lib/childAccess";
import { siteRecordFilter } from "../lib/siteScope";
import type { Role } from "../middleware/role";
import { notify, parentEmailForChild } from "../lib/notify";
import { alertDsl, isSafeguardingLead, leadCovers, namesALead } from "../lib/dslAlert";

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

// A body-map mark — a numbered pin an operator drops on the child silhouette.
const bodyMarkSchema = z.object({
  view: z.enum(["front", "back"]).default("front"),
  x: z.number().min(0).max(100), // percentage of the silhouette box
  y: z.number().min(0).max(100),
  note: z.string().trim().max(300).optional(),
});

const logSchema = z.object({
  kind: z.enum(["accident", "incident", "safeguarding"]),
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
  // safeguarding-specific
  concernCategory: z.string().trim().max(120).optional(),   // physical / emotional / neglect / disclosure …
  concernType: z.string().trim().max(120).optional(),       // observed / disclosed / told by third party
  childVoice: z.string().trim().max(2_000).optional(),      // what the child said, verbatim
  reportedTo: z.string().trim().max(160).optional(),        // DSL / designated safeguarding lead informed
  reportedToRole: z.string().trim().max(120).optional(),
  externalReferral: z.string().trim().max(300).optional(),  // MASH / social care / police reference
  confidential: z.boolean().optional(),                     // keep off the parent's profile
  subject: z.enum(["child", "staff"]).optional(),           // concern about a child OR a member of staff
  aboutDsl: z.boolean().optional(),                         // an allegation about the DSL / deputy themselves → account holder only
  dslActions: z.array(z.string().max(120)).max(12).optional(), // legacy flat list of decisions
  dslOutcome: z.string().trim().max(4_000).optional(),      // legacy written outcome
  dslActionedAt: z.string().max(25).optional(),
  shareWithReporter: z.boolean().optional(),
  // The DSL's chronological action log — one entry per action taken, each with
  // its own note (what was said / did), an optional review date, and done flag.
  dslLog: z.array(z.object({
    id: z.string().max(40),
    key: z.string().max(60),
    label: z.string().max(160),
    note: z.string().max(4_000).optional(),
    reviewDate: z.string().max(10).optional(),
    at: z.string().max(30),
    by: z.string().max(120).optional(),
    done: z.boolean().optional(),
    doneAt: z.string().max(30).optional(),
  })).max(60).optional(),
  localAuthority: z.string().trim().max(120).optional(),    // which council this concern sits under
  bodyMap: z.array(bodyMarkSchema).max(40).optional(),
  attachments: z.array(z.string().max(500)).max(10).optional(), // /api/uploads URLs
  // Whether this record is shared with the parent (the "share with parent"
  // control). Accidents always inform; behaviour/safeguarding are opt-in per record.
  shareWithParent: z.boolean().optional(),
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
const KINDS = ["accident", "incident", "safeguarding"] as const;
const isKind = (v: unknown): v is (typeof KINDS)[number] => typeof v === "string" && (KINDS as readonly string[]).includes(v);

/** The provider's Safeguarding toggles (Setup → Safeguarding). Accidents are
 *  notified by default because a parent has a right to know their child was
 *  hurt; other incidents are opt-in, since "incident" covers everything from a
 *  near-miss to a behaviour note and not every one warrants an email home. */
async function safeguardingSettings(tenantId: string, childId?: string | null) {
  // Follows the CHILD: a franchise's child is covered by that franchise's own
  // Setup → Safeguarding, whoever logged the record.
  const s = await loadSettings(tenantId, await franchiseForChild(tenantId, childId));
  const sg = (s as { safeguarding?: Record<string, boolean> }).safeguarding ?? {};
  return {
    notifyParentAccident: sg.notifyParentAccident !== false,
    notifyParentIncident: sg.notifyParentIncident === true,
    notifyStaffAcknowledged: sg.notifyStaffAcknowledged !== false,
  };
}

const kindWord = (kind: string) => (kind === "accident" ? "accident" : kind === "safeguarding" ? "safeguarding concern" : "incident");
// Whether a record should reach the parent: accidents always (per settings),
// behaviour when the setting is on OR staff ticked share, safeguarding only
// when staff explicitly chose to share (it's confidential by default).
function sharesWithParent(rec: { kind?: string; shareWithParent?: boolean; subject?: string }, gates: { notifyParentAccident: boolean; notifyParentIncident: boolean }) {
  // A concern about a member of staff reaches a family only when the DSL chose to share it.
  if (rec.subject === "staff") return rec.shareWithParent === true;
  if (rec.kind === "accident") return gates.notifyParentAccident;
  if (rec.kind === "safeguarding") return rec.shareWithParent === true;
  return gates.notifyParentIncident || rec.shareWithParent === true;
}

/** Photo links on a record (the injury photo + safeguarding attachments),
 *  signed for reading or stripped back to bare URLs for storing. */
function signPhotos<T extends Record<string, unknown>>(x: T): T {
  return {
    ...x,
    photoUrl: signImageUrl(x.photoUrl),
    ...(Array.isArray(x.attachments) ? { attachments: (x.attachments as unknown[]).map((u) => signImageUrl(u)) } : {}),
  };
}
function barePhotos<T extends { photoUrl?: string; attachments?: string[] }>(x: T): T {
  if (x.photoUrl !== undefined) x.photoUrl = bareImageUrl(x.photoUrl);
  if (x.attachments) x.attachments = x.attachments.map((u) => bareImageUrl(u));
  return x;
}

/** How much of this record may this account see? Staff run the day, so
 *  accidents and incidents are theirs to see. A SAFEGUARDING concern (or
 *  anything marked confidential) is not: it is DSL-routed, and a staff member
 *  sees only the ones they logged themselves. A concern whose SUBJECT is a
 *  member of staff is for managers / the DSL only, whatever kind it was filed
 *  under — filed as an "incident" it used to be on every colleague's list,
 *  dossier included (acceptance d24s6). Whoever reported it sees that it was
 *  received and whether it has been acted on ("status"), not its contents. */
function staffAccess(req: Request, rec: Record<string, unknown>, lead = false): "full" | "status" | "none" {
  if (req.auth!.role !== "staff") return "full";
  // The DSL / deputy named in Setup → Safeguarding has full access to concerns
  // and allegations even on a staff account — except an allegation about a
  // lead themselves, which is the account holder's alone (s13-fx5-dsl).
  if (lead && leadCovers(rec)) return "full";
  const me = req.user?.email ?? req.user?.uid;
  const mine = !!me && rec.recordedBy === me;
  if (rec.subject === "staff") return mine ? "status" : "none";
  if (rec.kind !== "safeguarding" && rec.confidential !== true) return "full";
  return mine ? "full" : "none";
}
const staffMayRead = (req: Request, rec: Record<string, unknown>, lead = false) => staffAccess(req, rec, lead) === "full";
/** Is the signed-in STAFF member a named safeguarding lead (DSL / deputy)?
 *  Owners see the whole log anyway. */
const staffLead = (req: Request) => req.auth!.role === "staff" && isSafeguardingLead(req.auth!, req.user?.email);

/** The reporter's view of their own report about a colleague: when it was
 *  made and where it has got to — none of what it says or who it names. */
function statusOnly(rec: Record<string, unknown> & { id: string }) {
  const actioned = (Array.isArray(rec.dslLog) && rec.dslLog.length > 0) || (Array.isArray(rec.dslActions) && rec.dslActions.length > 0);
  return {
    id: rec.id, tenantId: rec.tenantId, franchiseId: rec.franchiseId ?? null, kind: rec.kind, subject: "staff",
    date: rec.date, time: rec.time, createdAt: rec.createdAt, recordedBy: rec.recordedBy, recordedByName: rec.recordedByName,
    childName: "A member of staff", description: "", restricted: true,
    status: actioned ? "actioned" : "received",
    statusLabel: rec.aboutDsl === true
      ? (actioned ? "The account holder has acted on your report" : "Received — with the account holder")
      : actioned ? "The safeguarding lead has acted on your report" : "Received — with the safeguarding lead",
  };
}

/** Staff assigned to certain sites (a site lead) see the log for those sites
 *  — a record naming their session, or about a child booked there — plus any
 *  record they logged themselves. Same rule for the list and each record. */
const siteLogFilter = (req: Request) => {
  const me = req.user?.email ?? req.user?.uid;
  return siteRecordFilter(req.auth!, (r) => !!me && r.recordedBy === me);
};

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
    let list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { id: string; kind?: string; date?: string; time?: string; tenantId?: string; shareWithParent?: boolean; confidential?: boolean })[];
    // A parent NEVER sees safeguarding concerns (confidential, DSL-routed) unless
    // staff explicitly shared them; confidential records stay off their profile.
    // Behaviour records reach the parent only when staff chose "share with parent".
    list = list.filter((x) => x.kind !== "safeguarding" || x.shareWithParent === true);
    list = list.filter((x) => x.kind !== "incident" || x.shareWithParent === true);
    list = list.filter((x) => !x.confidential || x.shareWithParent === true);
    list = list.filter((x) => x.subject !== "staff" || x.shareWithParent === true);
    if (isKind(req.query.kind)) list = list.filter((x) => x.kind === req.query.kind);
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
    res.json(list.map(signPhotos));
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
  if (isKind(req.query.kind)) q = q.where("kind", "==", req.query.kind);
  if (typeof req.query.childId === "string") q = q.where("childId", "==", req.query.childId);
  const snap = await q.get();
  let list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { id: string; date?: string; time?: string; childId?: string })[];
  // A franchise sees safeguarding records only for ITS OWN children (any child
  // booked on its listings) — showing every record for those children whoever
  // logged it. Head office sees the whole tenant.
  if ((req.auth!.role === "franchise" || req.auth!.role === "staff") && req.auth!.franchiseId) {
    const kids = await franchiseChildIds(tenantId, req.auth!.franchiseId);
    list = list.filter((x) => x.franchiseId === req.auth!.franchiseId || (typeof x.childId === "string" && kids.has(x.childId)));
  }
  const from = typeof req.query.from === "string" ? req.query.from : null;
  const to = typeof req.query.to === "string" ? req.query.to : null;
  if (from) list = list.filter((x) => String(x.date) >= from);
  if (to) list = list.filter((x) => String(x.date) <= to);
  const lead = await staffLead(req);
  // A site-scoped DSL still sees every concern and allegation in their scope.
  const inSite = await siteLogFilter(req);
  if (inSite) list = list.filter((x) => inSite(x) || (lead && leadCovers(x)));
  list = list.flatMap((x) => { const a = staffAccess(req, x, lead); return a === "full" ? [x] : a === "status" ? [statusOnly(x) as typeof x] : []; });
  list.sort((a, b) => (`${b.date} ${b.time ?? ""}` < `${a.date} ${a.time ?? ""}` ? -1 : 1));
  // Injury photos of named children: signed, expiring links (lib/signing.ts).
  res.json(list.map(signPhotos));
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
  // Only a child this provider actually has — else the record lands on another
  // provider's child (their parent is emailed; the dossier hands their family back).
  if (parsed.data.childId && !(await childVisibleTo({ ...req.auth!, tenantId: scope.tenantId }, parsed.data.childId))) {
    res.status(403).json({ error: "That child isn't booked with you", code: "child_not_yours" });
    return;
  }
  // An allegation naming the DSL / deputy (the form's tick, or the named staff
  // member matching them in Setup) is the account holder's only.
  const aboutDsl = parsed.data.subject === "staff"
    && (await namesALead(scope.tenantId, (await franchiseForChild(scope.tenantId, parsed.data.childId)) ?? req.auth!.franchiseId ?? null, parsed.data));
  const { aboutDsl: _asked, ...fields } = barePhotos(parsed.data);
  const doc = {
    ...fields,
    ...(aboutDsl ? { aboutDsl: true } : {}),
    tenantId: scope.tenantId,
    // Which franchise recorded it — so a walk-in (no child linked) still
    // belongs to the franchise that logged it.
    franchiseId: req.auth!.franchiseId ?? null,
    recordedBy: req.user?.email ?? req.user?.uid ?? "unknown",
    recordedByName: req.user?.name ?? req.user?.email ?? "Staff",
    createdAt: new Date().toISOString(),
  };
  const ref = await col.add(doc);
  res.status(201).json(signPhotos({ id: ref.id, ...doc }));

  // Alert the safeguarding lead(s) named in Setup (bell + a details-free email);
  // a staff allegation also the account holder, one about a lead ONLY the
  // account holder — never whoever logged it (a solo provider IS the DSL). d13s2.
  void alertDsl(scope.tenantId, ref.id, doc);

  // Tell the parent. Only possible when the record is linked to a child — a
  // walk-in with no booking has nobody to reach, and that's not an error.
  void (async () => {
    const gates = await safeguardingSettings(scope.tenantId!, doc.childId);
    if (!sharesWithParent(doc, gates)) return;
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
        `<p>An ${word} involving <b>${esc(doc.childName)}</b> was recorded on <b>${when}</b>.</p>` +
        `<p>${esc(doc.description)}</p>` +
        (doc.injury ? `<p><b>Injury:</b> ${esc(doc.injury)}${doc.bodyPart ? ` (${esc(doc.bodyPart)})` : ""}</p>` : "") +
        (doc.treatment ? `<p><b>Treatment given:</b> ${esc(doc.treatment)}${doc.firstAider ? ` — by ${esc(doc.firstAider)}` : ""}</p>` : "") +
        (doc.actionTaken ? `<p><b>Action taken:</b> ${esc(doc.actionTaken)}</p>` : ""),
      href: "/custdash/accidents",
      ref: ref.id,
    });
  })();
});

async function ownLog(req: Request, id: string, lead = false) {
  const auth = req.auth!;
  if (!auth.tenantId) return { status: 403 as const };
  const snap = await col.doc(id).get();
  if (!snap.exists || snap.data()!.tenantId !== auth.tenantId) return { status: 404 as const };
  // A franchise (and its staff) acts only on records for its own children —
  // the same rule as the list — not a sibling franchise's (acceptance test d22s4).
  if (isFranchise(auth)) {
    const rec = snap.data()!;
    const childId = rec.childId as string | undefined;
    const mine = rec.franchiseId === auth.franchiseId || (!!childId && (await franchiseChildIds(auth.tenantId, auth.franchiseId)).has(childId));
    if (!mine) return { status: 404 as const };
  }
  const inSite = await siteLogFilter(req);
  if (inSite && !inSite(snap.data()!) && !(lead && leadCovers(snap.data()!))) return { status: 404 as const };
  return { status: 200 as const, snap };
}

// PUT /api/incidents/:id — edit (operators, or the staff member who recorded
// it — they may need to finish or correct their own entry).
incidents.put("/:id", async (req, res) => {
  const lead = await staffLead(req);
  const own = await ownLog(req, req.params.id, lead);
  if (own.status !== 200) {
    res.status(own.status).json({ error: own.status === 403 ? "Requires an operator account" : "Log not found" });
    return;
  }
  const auth = req.auth!;
  const recorder = own.snap.data()!.recordedBy;
  // A report about a colleague is the DSL's once made — its reporter sees its
  // status, and can't reopen or rewrite it (nor anyone else's they can't read).
  if (!canManage(auth.role) && !staffMayRead(req, own.snap.data()!, lead)) {
    res.status(404).json({ error: "Log not found" });
    return;
  }
  // The named DSL / deputy records their decisions on concerns and allegations.
  if (!canManage(auth.role) && !(lead && leadCovers(own.snap.data()!)) && recorder !== (req.user?.email ?? req.user?.uid)) {
    res.status(403).json({ error: "Only the provider, the safeguarding lead or the person who recorded it can edit this" });
    return;
  }
  const parsed = logSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  if (parsed.data.childId && parsed.data.childId !== own.snap.data()!.childId && !(await childVisibleTo(auth, parsed.data.childId))) {
    res.status(403).json({ error: "That child isn't booked with you", code: "child_not_yours" });
    return;
  }
  // Only the account holder can clear "about the safeguarding lead"; an edit
  // that names a lead turns it on.
  if (!canManage(auth.role)) delete parsed.data.aboutDsl;
  {
    const merged = { ...own.snap.data()!, ...parsed.data } as Record<string, unknown>;
    if (merged.subject === "staff" && merged.aboutDsl !== true && (parsed.data.childName !== undefined || parsed.data.subject !== undefined)
      && (await namesALead(auth.tenantId!, (await franchiseForChild(auth.tenantId!, merged.childId as string | undefined)) ?? (merged.franchiseId as string | null) ?? null, merged))) parsed.data.aboutDsl = true;
  }
  // Screens hold the SIGNED photo link; compare and store the bare one, or a
  // re-save would read as a changed photo (and email the family) every time.
  barePhotos(parsed.data);
  // Only a real change is an edit. Re-saving an unchanged form must not send
  // the family a second "this was updated" email.
  const before = own.snap.data()!;
  const changed = Object.entries(parsed.data).filter(
    ([k, v]) => k !== "notifyParentOfEdit" && JSON.stringify(before[k]) !== JSON.stringify(v),
  );
  await own.snap.ref.set({ ...parsed.data, updatedAt: new Date().toISOString() }, { merge: true });
  const after = await own.snap.ref.get();
  res.json(signPhotos({ id: after.id, ...after.data() }));

  // Staff choose per edit whether the family is alerted or the record is just
  // quietly corrected on their profile — the stamp updates either way.
  void (async () => {
    if (!changed.length || parsed.data.notifyParentOfEdit !== true) return;
    const rec = after.data()!;
    const kind = String(rec.kind ?? "incident");
    const gates = await safeguardingSettings(String(rec.tenantId), rec.childId as string | undefined);
    if (!sharesWithParent({ kind, shareWithParent: rec.shareWithParent === true, subject: rec.subject as string | undefined }, gates)) return;
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
        `<p>The ${word} record for <b>${esc(rec.childName)}</b> from <b>${esc(rec.date)}</b> has been updated by the provider.</p>` +
        `<p>${esc(rec.description)}</p>`,
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
    if (!(await safeguardingSettings(String(rec.tenantId), rec.childId as string | undefined)).notifyStaffAcknowledged) return;
    const word = kindWord(String(rec.kind ?? "incident"));
    await notify({
      tenantId: String(rec.tenantId),
      to: { kind: "tenant" },
      category: rec.kind === "accident" ? "accident" : "incident",
      key: "incident-ack",
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
  } else if (canRecord(auth.role) && auth.tenantId) {
    // Same reach as editing: this tenant, this franchise, and — for staff — only
    // records they may read (not an allegation kept from them: d22s4 / d24s6).
    const lead = await staffLead(req);
    const own = await ownLog(req, req.params.id, lead);
    if (own.status !== 200 || !staffMayRead(req, data, lead)) { res.status(404).json({ error: "Record not found" }); return; }
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

  // Alert the other side so the conversation flows both ways. A parent's reply
  // bells the team; the provider's reply emails + bells the parent.
  void (async () => {
    const tenantId = data.tenantId as string | undefined;
    if (!tenantId) return;
    const word = kindWord(String(data.kind ?? "incident"));
    if (role === "parent") {
      await notify({
        tenantId, to: { kind: "tenant" }, category: data.kind === "accident" ? "accident" : "incident",
        key: "incident-reply",
        title: `${note.by} replied about the ${word} for ${data.childName}`,
        body: parsed.data.text,
        href: "/company/incidents", ref: snap.id,
      });
    } else {
      // Only email the parent when the record is one they can see.
      if (data.kind === "safeguarding" && data.shareWithParent !== true) return;
      if (data.kind === "incident" && data.shareWithParent !== true) return;
      if (data.subject === "staff" && data.shareWithParent !== true) return;
      const email = await parentEmailForChild(data.childId as string | undefined);
      if (!email) return;
      await notify({
        tenantId, to: { kind: "parent", email }, category: data.kind === "accident" ? "accident" : "incident",
        title: `${data.childName}: the provider replied to your message`,
        body: parsed.data.text,
        emailHtml: `<p><b>${esc(note.by)}</b> replied about the ${word} for <b>${esc(data.childName)}</b>:</p><p>${esc(parsed.data.text)}</p>`,
        subject: `${data.childName}: a reply from your provider`,
        href: "/custdash/accidents", ref: snap.id,
      });
    }
  })();
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

// GET /api/incidents/:id/dossier — everything on file about the child a concern
// is about, pulled together for a safeguarding PDF: profile, parent + emergency
// contacts, siblings, recent bookings and their incident/behaviour history.
// Operators/staff of the tenant only (it's sensitive personal data).
incidents.get("/:id/dossier", async (req, res) => {
  const scope = tenantScope(req);
  if (!scope || !scope.tenantId || !canRecord(scope.role)) { res.status(403).json({ error: "Requires an operator or staff account" }); return; }
  const lead = await staffLead(req);
  const snap = await col.doc(req.params.id).get();
  // A genuinely missing/foreign-tenant record stays 404 (don't reveal it
  // exists). A record that DOES exist in this tenant but this staff member
  // isn't assigned to is a real, named permissions gate, not a lookup miss —
  // 403 says so honestly instead of masquerading as "not found".
  if (!snap.exists || snap.data()!.tenantId !== scope.tenantId) { res.status(404).json({ error: "Record not found" }); return; }
  if (!staffMayRead(req, snap.data()!, lead)) { res.status(403).json({ error: "You don't have access to this record" }); return; }
  const rec = snap.data()!;
  const childName = String(rec.childName ?? "");

  // Recent bookings for this child (also used to resolve the child by name when
  // the record wasn't linked to a childId).
  const bsnap = await db.collection("bookings").where("tenantId", "==", scope.tenantId).get();
  const nameMatch = (b: Record<string, unknown>) => b.child && String(b.child).trim().toLowerCase() === childName.trim().toLowerCase();
  let childId = (rec.childId as string | undefined) || undefined;
  if (!childId) { const hit = bsnap.docs.map((d) => d.data() as Record<string, unknown>).find((b) => b.childId && nameMatch(b)); if (hit) childId = hit.childId as string; }

  // The dossier hands back the family's contact details — only for a child
  // this provider has (records filed before that check existed could name anyone's).
  if (childId && !(await childVisibleTo({ ...req.auth!, tenantId: scope.tenantId }, childId))) childId = undefined;

  let child: Record<string, unknown> | null = null;
  let parent: { name?: string; email?: string; phone?: string; address?: string; postcode?: string } | null = null;
  let siblings: { name?: string; dob?: string; age?: number }[] = [];
  if (childId) {
    const cs = await db.collection("children").doc(childId).get();
    if (cs.exists) {
      const c = cs.data()!;
      child = c;
      const parentUid = c.parentUid as string | undefined;
      if (parentUid) {
        const us = await db.collection("users").doc(parentUid).get();
        const u = (us.data() ?? {}) as Record<string, string>;
        parent = { name: u.name, phone: u.phone, address: u.address, postcode: u.postcode, email: u.email };
        const sib = await db.collection("children").where("parentUid", "==", parentUid).get();
        siblings = sib.docs.filter((d) => d.id !== childId).map((d) => { const s = d.data(); return { name: s.name as string, dob: s.dob as string, age: s.age as number }; });
      }
    }
  }

  const bookings = bsnap.docs
    .map((d) => d.data() as Record<string, unknown>)
    .filter((b) => (childId && b.childId === childId) || nameMatch(b))
    .map((b) => ({ listing: b.listing as string, dates: (b.dates ?? b.sessionLabel) as string, status: b.status as string, createdAt: b.createdAt as string, booker: b.booker as string, email: b.email as string, phone: b.phone as string }))
    .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))
    .slice(0, 12);
  // Fall back to a booking for the parent's name/email/phone if the user doc had none.
  if (bookings[0]) parent = { name: parent?.name || bookings[0].booker, email: parent?.email || bookings[0].email, phone: parent?.phone || bookings[0].phone, address: parent?.address, postcode: parent?.postcode };

  // This child's incident / accident / behaviour / safeguarding history in the tenant.
  const isnap = await col.where("tenantId", "==", scope.tenantId).get();
  // The child's other records — through the same staff filter as the record
  // itself, or opening an ordinary accident showed staff the confidential
  // safeguarding concerns about that child.
  const history = isnap.docs.filter((d) => staffMayRead(req, d.data(), lead))
    .map((d) => { const x = d.data() as Record<string, unknown>; return { id: d.id, childId: x.childId as string | undefined, childName: x.childName as string | undefined, kind: x.kind as string, date: x.date as string, category: (x.concernCategory ?? x.incidentType ?? x.injury) as string, severity: x.severity as string, description: x.description as string }; })
    .filter((h) => h.id !== req.params.id && ((childId && h.childId === childId) || (h.childName && h.childName.trim().toLowerCase() === childName.trim().toLowerCase())))
    .map((h) => ({ kind: h.kind, date: h.date, category: h.category, severity: h.severity, description: h.description }))
    .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")))
    .slice(0, 30);

  res.json({ child, parent, siblings, bookings, history });
});
