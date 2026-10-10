import { Router, type Request } from "express";
import { isRealDay, isBlankOrRealTime, ukToday } from "../lib/ukDate";
import { z } from "zod";
import { db } from "../firebase";
import { esc } from "../lib/html";
import { isPlainStaff, type Role } from "../middleware/role";
import { notify, parentEmailForChild } from "../lib/notify";
import { franchiseChildIds, isFranchise } from "../lib/franchiseScope";
import { loadSettings } from "../lib/tenantLibrary";
import { bookingInSite, siteRecordFilter, staffSiteScope, type SiteScope } from "../lib/siteScope";
import { parentBell } from "../lib/parentBells";
import { bellBody, bellDay } from "../lib/bellText";
import {
  consentObtained, consentPending as pendingOf, headCountRecorded, materialSnapshot, parseCost, reopenedSignoff, signoffProblems, unlinkedChildren, viewForReader,
} from "../lib/tripRules";

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
  date: z.string().max(10).refine(isRealDay, "Not a real calendar date"),
  departTime: z.string().max(8).refine(isBlankOrRealTime, "Not a real time (HH:MM)").optional(),
  returnTime: z.string().max(8).refine(isBlankOrRealTime, "Not a real time (HH:MM)").optional(),
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
  // consentObtained is NOT accepted from the client: the server works it out from the children's answers (consentObtained in lib/tripRules).
  notes: z.string().trim().max(2_000).optional(),
  status: z.enum(["planned", "completed", "cancelled"]).default("planned"),
});

type Attendee = {
  n: string; childId?: string; age?: number;
  consent?: "granted" | "pending" | "declined"; consentAt?: string; consentBy?: string; consentRequestedAt?: string;
  /** Who made the decision: the parent in their portal, or the provider
   *  recording it (a paper form). A parent's decision can't be overwritten. */
  consentSource?: "parent" | "provider";
  paid?: boolean; em?: boolean; med?: string; sent?: boolean;
};

/** Setup → Trips & visits toggles (defaults per the handoff: both on). A
 *  franchise's own Setup applies to its own trips. */
async function tripSettings(tenantId: string, franchiseId?: string | null) {
  const t = ((await loadSettings(tenantId, franchiseId)) as { trips?: Record<string, unknown> }).trips ?? {};
  return {
    notifyParent: t.notifyParent !== false,
    requireConsent: t.requireConsent !== false,
    whoCanPlan: (t.whoCanPlan === "leads" || t.whoCanPlan === "managers" ? t.whoCanPlan : "all") as "all" | "leads" | "managers",
    whoCanSend: (t.whoCanSend === "lead" ? "lead" : "all") as "all" | "lead",
  };
}

/** Setup → Trips "who can send" gate for the Step 8 parent message. Managers
 *  and owners can always send (same carve-out as planning); a plain staff or
 *  lead needs the setting on "all", or to be the trip's organiser (createdBy)
 *  or its named trip lead. */
async function canSendTripMessage(req: Request, trip: Record<string, unknown>): Promise<boolean> {
  const auth = req.auth!;
  if (canManage(auth.role)) return true;
  const tenantId = String(trip.tenantId);
  const { whoCanSend } = await tripSettings(tenantId, (trip.franchiseId as string | null | undefined) ?? auth.franchiseId);
  if (whoCanSend !== "lead") return true;
  return isTripLead(req, trip);
}

/** The signed-in person's account name, as the manager put it on the account - never the token's display name, which the user can change to
 *  the trip lead's. Read once per request. */
const nameCache = new WeakMap<Request, Promise<string>>();
function accountName(req: Request): Promise<string> {
  let p = nameCache.get(req);
  if (!p) {
    p = req.user?.uid ? db.collection("users").doc(req.user.uid).get().then((d) => String(d.get("name") ?? "").trim()) : Promise.resolve("");
    nameCache.set(req, p);
  }
  return p;
}

/** The trip's organiser (the account that planned it) or its named trip lead. */
async function isTripLead(req: Request, trip: Record<string, unknown>): Promise<boolean> {
  const email = req.user?.email;
  if (email && trip.createdBy === email) return true;
  const name = await accountName(req);
  return !!name && typeof trip.lead === "string" && trip.lead.trim().toLowerCase() === name.toLowerCase();
}

/** Who may CHANGE a trip: the owner roles, or the trip's organiser / named lead. Not any member of staff. */
async function canEditTrip(req: Request, trip: Record<string, unknown>): Promise<boolean> {
  return canManage(req.auth!.role) || (await isTripLead(req, trip));
}

/** Who may READ children's medical text on a trip: those who may change it, and team leads. Other staff see a flag. */
async function canSeeTripMedical(req: Request, trip: Record<string, unknown>): Promise<boolean> {
  return (await canEditTrip(req, trip)) || req.auth!.lead === true;
}

/** The trip as this reader may see it: medical text only for leads, and the children nobody can be asked about, named. */
async function present(req: Request, trip: Record<string, unknown>): Promise<Record<string, unknown>> {
  const attendees = (trip.attendees as Attendee[] | undefined) ?? [];
  return {
    ...trip,
    attendees: viewForReader(attendees, await canSeeTripMedical(req, trip)),
    unlinked: unlinkedChildren(attendees).map((a) => a.n),
  };
}

/** A decision the PARENT made. Since 12 Sept it's marked; before that the
 *  parent route stamped their email as consentBy, which the operator form
 *  never did — so an email-shaped consentBy is theirs too. */
const parentOwned = (a: Attendee) =>
  a.consentSource === "parent" || (a.consentSource === undefined && !!a.consentBy && /@/.test(a.consentBy) && (a.consent ?? "pending") !== "pending");

/** Children with no answer yet stop the trip going ahead. A DECLINED child is
 *  "not going" everywhere — the planner's headcount, roll call, ratio and the
 *  parent message all leave them out, and the decline stays on the record —
 *  so a decline doesn't block; what mattered was that nobody but the parent
 *  can turn it into a yes (see parentOwned above). */
const consentPending = pendingOf;

class TripRefusal extends Error { constructor(public code: number, msg: string) { super(msg); } }

// ── Server-side enrichment (the handoff's #2) ────────────────────────────
// The front-end picks booked children by NAME; parents are reached by
// childId. Resolve names against the tenant's bookings (same matching the
// medication flow uses), guarantee an attendee entry per child, and fill
// the emergency/medical flags from the child's own profile.
async function enrichTrip(
  tenantId: string,
  childNames: string[],
  attendees: Attendee[] | undefined,
  site?: SiteScope | null,
  franchiseId?: string | null,
  /** childIds already on this trip (a save must keep working for them). Any OTHER childId the client sends must be one of this tenant's booked children. */
  known: Set<string> = new Set(),
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
  const idsByName = new Map<string, Set<string>>();
  const allowedIds = new Set<string>();
  const note = (name: string, id: string) => { const k = name.trim().toLowerCase(); idsByName.set(k, (idsByName.get(k) ?? new Set()).add(id)); };
  for (const d of bookings.docs) {
    const b = d.data() as { child?: string; childId?: string; listingId?: string; blockId?: string; kids?: { name?: string; childId?: string }[] };
    // A site-scoped planner (a site lead) links only children booked at their
    // sites — typing another site's child's name mustn't pull their medical notes.
    if (site && !bookingInSite(b, site)) continue;
    // A franchise planner links only ITS OWN children — typing (or sending the id of) another franchise's or head
    // office's child must not pull their medical notes or send their parent a consent request.
    if (franchiseId && (b as { franchiseId?: string | null }).franchiseId !== franchiseId) continue;
    if (b.childId) allowedIds.add(b.childId);
    for (const k of b.kids ?? []) if (k.childId) allowedIds.add(k.childId);
    if (b.childId && b.child && !b.kids?.length) note(b.child, b.childId);
    for (const k of b.kids ?? []) if (k.childId && k.name) note(k.name, k.childId);
  }
  // A childId is only ever taken from this provider's own bookings. A client naming another provider's child would otherwise pull that child's
  // medical text onto this trip and send their parent a consent request.
  for (const a of list) {
    if (a.childId && !allowedIds.has(a.childId) && !known.has(a.childId)) throw new TripRefusal(400, `${a.n} isn't one of your booked children, so they can't be added to a trip.`);
  }
  if (franchiseId || site) for (const a of list) if (a.childId && !allowedIds.has(a.childId)) delete a.childId;
  // Only an UNAMBIGUOUS name links. With two children of the same name, the
  // last booking used to win — and the wrong parent was asked for consent.
  for (const a of list) {
    if (a.childId) continue;
    const ids = idsByName.get(a.n.trim().toLowerCase());
    if (ids?.size === 1) a.childId = [...ids][0];
  }

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
  if (!(await tripSettings(tenantId, (trip.franchiseId as string | null | undefined) ?? null)).notifyParent) return;
  const attendees = (trip.attendees as Attendee[] | undefined) ?? [];
  const when = [trip.date, trip.departTime && `departing ${trip.departTime}`, trip.returnTime && `back ${trip.returnTime}`].filter(Boolean).join(", ");
  const asked = new Map<string, string>(); // childId → when we asked
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
        `<p><b>${esc(a.n)}</b> is down for a trip to <b>${esc(String(trip.destination))}</b> on <b>${when}</b>${trip.transport ? ` (travel: ${esc(String(trip.transport))})` : ""}.</p>` +
        (trip.cost ? `<p>Cost: £${esc(String(trip.cost))}${trip.payBy ? ` — pay by ${esc(String(trip.payBy))}` : ""}.</p>` : "") +
        `<p>Please open your Trips area to <b>give or decline consent</b> — it takes one tap.</p>`,
      href: "/custdash/trips",
      ref: tripId,
    });
    asked.set(a.childId, new Date().toISOString());
  }
  if (!asked.size) return;
  // Stamp "asked" onto the attendees as they are NOW. This runs after the save
  // has returned; writing back the list it started with wiped any answer given
  // while the emails went out — a parent's decline (or a provider's grant) went
  // back to "pending" (acceptance re-test d14s4/d14s5).
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(col.doc(tripId));
    if (!snap.exists) return;
    const current = (snap.get("attendees") as Attendee[] | undefined) ?? [];
    for (const a of current) {
      const at = a.childId ? asked.get(a.childId) : undefined;
      if (at && !a.consentRequestedAt) { a.consentRequestedAt = at; a.sent = true; }
    }
    tx.update(snap.ref, { attendees: current });
  });
}

/** A cancelled trip: every family still in it (consent given, or still waiting) is told by bell (in their language) and email. A family that
 *  declined already said no. Always sent, whatever Setup says about consent requests: a family must never turn up for a trip that is off.
 *  Nothing is collected or refunded through the app for trips, and the message says so. */
export async function notifyTripCancelled(tripId: string, trip: Record<string, unknown>): Promise<void> {
  const tenantId = String(trip.tenantId);
  const dest = String(trip.destination ?? "your trip");
  const date = String(trip.date ?? "");
  const bell = parentBell("trip-cancelled", { dest, date: bellDay(date) || date });
  const told = new Set<string>();
  for (const a of (trip.attendees as Attendee[] | undefined) ?? []) {
    if (!a.childId || (a.consent ?? "pending") === "declined") continue;
    const email = await parentEmailForChild(a.childId);
    if (!email) continue;
    const mark = `${email}|${a.childId}`;
    if (told.has(mark)) continue;
    told.add(mark);
    await notify({
      tenantId,
      to: { kind: "parent", email },
      category: "trip",
      title: bell.title,
      body: bell.body ?? "",
      i18n: bell.i18n,
      subject: `${a.n}: the trip to ${dest} on ${date} is cancelled`,
      emailHtml:
        `<p>The trip to <b>${esc(dest)}</b> on <b>${esc(date)}</b> that <b>${esc(a.n)}</b> was down for has been <b>cancelled</b>.</p>` +
        `<p>No payment was taken through the app. If you paid your provider directly, please ask them about it.</p>`,
      href: "/custdash/trips",
      ref: tripId,
    });
  }
}

/** The sign-off no longer covers the trip as it now stands: ring the provider (the planner and the lead) so it is signed off again. */
export async function notifySignoffReopened(tripId: string, trip: Record<string, unknown>, why: string): Promise<void> {
  await notify({
    tenantId: String(trip.tenantId),
    to: { kind: "tenant" },
    category: "trip",
    title: "Trip sign-off reopened",
    body: bellBody([String(trip.destination ?? "").slice(0, 24), why]),
    subject: `Trip sign-off reopened: ${String(trip.destination ?? "")}`,
    emailHtml: `<p>The sign-off for the trip to <b>${esc(String(trip.destination ?? ""))}</b> on <b>${esc(String(trip.date ?? ""))}</b> no longer stands because ${esc(why)}. Check the trip and sign it off again.</p>`,
    href: "/company/trips",
    ref: tripId,
  });
}

/** Attendees on a NEW trip, as the server will keep them. The client may name children and, as the provider, record a decision it holds on paper -
 *  stamped with who recorded it and when. It can never claim to be the parent, backdate, or mark a family as already asked. */
function newAttendees(list: Attendee[] | undefined, who: string): Attendee[] | undefined {
  if (!list) return undefined;
  const now = new Date().toISOString();
  return list.map((a) => {
    const out: Attendee = { n: a.n, ...(a.childId ? { childId: a.childId } : {}), ...(a.age !== undefined ? { age: a.age } : {}), ...(a.paid !== undefined ? { paid: a.paid } : {}), ...(a.em !== undefined ? { em: a.em } : {}), ...(a.med ? { med: a.med } : {}), consent: "pending" };
    if (a.consent === "granted" || a.consent === "declined") Object.assign(out, { consent: a.consent, consentAt: now, consentBy: who, consentSource: "provider" });
    return out;
  });
}

/** Staff named on this trip's roster (by account name). */
async function isRostered(req: Request, trip: Record<string, unknown>): Promise<boolean> {
  const name = (await accountName(req)).toLowerCase();
  if (!name) return false;
  const names = [...((trip.roster as { n?: string }[] | undefined) ?? []).map((r) => r.n ?? ""), ...((trip.staff as string[] | undefined) ?? [])];
  return names.some((n) => n.trim().toLowerCase() === name);
}

/** Does this trip belong to the franchise? Trips created since 12 Sept carry
 *  the franchiseId they were made under. Older ones carry none, so they're
 *  derived from who is on them: a trip taking any of the franchise's children
 *  is the franchise's. A head-office trip with none of its children stays hidden. */
function tripInFranchise(t: Record<string, unknown>, franchiseId: string, kids: Set<string>): boolean {
  if (t.franchiseId) return t.franchiseId === franchiseId;
  return ((t.childIds as string[] | undefined) ?? []).some((c) => kids.has(c));
}

/** A site-scoped member of staff (a site lead) sees a trip from one of their
 *  sites (its listing, or a child booked there) or one they planned. */
const siteTripFilter = (req: Request) => {
  const me = req.user?.email;
  return siteRecordFilter(req.auth!, (t) => !!me && t.createdBy === me);
};

trips.get("/", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canUse(auth.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const snap = await col.where("tenantId", "==", auth.tenantId).get();
  let list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { date?: string })[];
  // A franchise (and its staff) saw every trip in the company — each one names
  // children, a destination and a date. Narrow to the franchise's own.
  if (auth.franchiseId) {
    const kids = await franchiseChildIds(auth.tenantId, auth.franchiseId);
    list = list.filter((t) => tripInFranchise(t, auth.franchiseId!, kids));
  }
  const inSite = await siteTripFilter(req);
  if (inSite) list = list.filter(inSite);
  list.sort((a, b) => (`${b.date}` < `${a.date}` ? -1 : 1));
  res.json(await Promise.all(list.map((t) => present(req, t))));
});

const COST_REFUSAL = (e: string) => [{ path: ["cost"], message: e }];

trips.post("/", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canUse(auth.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  // Setup → Trips "who can plan" used to only hide the button on the staff
  // portal. Anything but "all" means leads and managers plan trips — not a
  // plain staff token calling the API.
  const who = auth.role === "staff" ? (await tripSettings(auth.tenantId, auth.franchiseId)).whoCanPlan : "all";
  if ((who === "leads" && isPlainStaff(auth)) || (who === "managers" && auth.role === "staff")) {
    res.status(403).json({ error: "Planning trips is limited to leads and managers (Setup → Trips & visits)" });
    return;
  }
  const parsed = tripSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const cost = parseCost(parsed.data.cost);
  if (!cost.ok) { res.status(400).json({ error: cost.error, issues: COST_REFUSAL(cost.error) }); return; }
  const site = await staffSiteScope(auth);
  if (site && parsed.data.listingId && !site.listings.has(parsed.data.listingId)) {
    res.status(403).json({ error: "You can only plan trips for the sites you're assigned to" });
    return;
  }
  let enriched: Awaited<ReturnType<typeof enrichTrip>>;
  try {
    enriched = await enrichTrip(auth.tenantId, parsed.data.childNames, newAttendees(parsed.data.attendees as Attendee[] | undefined, req.user?.email ?? req.user?.uid ?? "provider"), site, isFranchise(auth) ? auth.franchiseId : null);
  } catch (e) {
    if (e instanceof TripRefusal) { res.status(e.code).json({ error: e.message }); return; }
    throw e;
  }
  const { cost: _rawCost, ...rest } = parsed.data;
  void _rawCost;
  const doc = {
    ...rest,
    ...(cost.value !== undefined ? { cost: cost.value } : {}),
    attendees: enriched.attendees,
    childIds: enriched.childIds,
    // Worked out here from the children's answers - never taken from the browser.
    consentObtained: consentObtained(enriched.attendees),
    headcount: parsed.data.headcount ?? parsed.data.childNames.length,
    tenantId: auth.tenantId,
    franchiseId: auth.franchiseId ?? null,
    createdBy: req.user?.email ?? "unknown",
    createdByName: req.user?.name ?? req.user?.email ?? "Staff",
    createdAt: new Date().toISOString(),
  };
  const ref = await col.add(doc);
  void requestConsents(ref.id, doc).catch((e) => console.error("[trips] consent notify:", (e as Error).message));
  res.status(201).json(await present(req, { id: ref.id, ...doc }));
});

async function own(req: Request, id: string) {
  const auth = req.auth!;
  if (!auth.tenantId || !canUse(auth.role)) return { status: 403 as const };
  const snap = await col.doc(id).get();
  if (!snap.exists || snap.data()!.tenantId !== auth.tenantId) return { status: 404 as const };
  if (auth.franchiseId && !tripInFranchise(snap.data()!, auth.franchiseId, await franchiseChildIds(auth.tenantId, auth.franchiseId)))
    return { status: 404 as const };
  const inSite = await siteTripFilter(req);
  if (inSite && !inSite(snap.data()!)) return { status: 404 as const };
  return { status: 200 as const, snap };
}


trips.put("/:id", async (req, res) => {
  const o = await own(req, req.params.id);
  if (o.status !== 200) { res.status(o.status).json({ error: o.status === 403 ? "Forbidden" : "Trip not found" }); return; }
  // Only the owner roles and the trip's own organiser / named lead change a trip - not any member of staff.
  if (!(await canEditTrip(req, o.snap.data()!))) {
    // The one exception: staff on the trip's roster can record the day (head counts / returned) and nothing else, still behind the consent gate.
    const keys = Object.keys((req.body ?? {}) as object);
    const dayOnly = keys.length > 0 && keys.every((k) => k === "checkpoints" || k === "returned");
    if (!(dayOnly && (await isRostered(req, o.snap.data()!)))) {
      res.status(403).json({ error: "Only the trip lead or the person who planned this trip can change it. Ask them, or a manager." });
      return;
    }
  }
  const parsed = tripSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  if (parsed.data.cost !== undefined && parsed.data.cost !== o.snap.data()!.cost) {
    const cost = parseCost(parsed.data.cost);
    if (!cost.ok) { res.status(400).json({ error: cost.error, issues: COST_REFUSAL(cost.error) }); return; }
    parsed.data.cost = cost.value ?? "";
  }
  const site = await staffSiteScope(req.auth!);
  if (site && parsed.data.listingId && !site.listings.has(parsed.data.listingId)) {
    res.status(403).json({ error: "You can only plan trips for the sites you're assigned to" });
    return;
  }
  let cancelledNow = false;
  let reopenedWhy: string | null = null;
  // Read-merge-write in ONE transaction: a parent answering consent while the
  // planner is open used to have their answer overwritten by the stale
  // "pending" this screen was holding.
  try {
    await db.runTransaction(async (tx) => {
      cancelledNow = false; reopenedWhy = null; // a retried transaction starts clean
      const fresh = await tx.get(o.snap.ref);
      const before = fresh.data()!;
      const tenantId = String(before.tenantId);

      // Re-resolve whenever the children change; a merge must never lose the
      // consent trail already collected, so carry each existing attendee's
      // consent fields onto the incoming entry (matched by childId, else name).
      let patch: Record<string, unknown> = { ...parsed.data };
      if (parsed.data.childNames || parsed.data.attendees) {
        const prev = (before.attendees as Attendee[] | undefined) ?? [];
        const incoming = (parsed.data.attendees as Attendee[] | undefined) ?? prev;
        const names = parsed.data.childNames ?? (before.childNames as string[] | undefined) ?? [];
        const enriched = await enrichTrip(tenantId, names, incoming, site, isFranchise(req.auth!) ? req.auth!.franchiseId : null, new Set(prev.map((p) => p.childId).filter(Boolean) as string[]));
        const who = req.user?.email ?? req.user?.uid ?? "provider";
        const now = new Date().toISOString();
        for (const a of enriched.attendees) {
          const was = prev.find((p) => (a.childId && p.childId === a.childId) || p.n.trim().toLowerCase() === a.n.trim().toLowerCase());
          a.consentRequestedAt = a.consentRequestedAt ?? was?.consentRequestedAt;
          if (was && parentOwned(was)) {
            // The parent's answer stands. A staff PUT carrying "granted" used to
            // overwrite a decline — and kept the parent's name and date on it, so
            // the record claimed the parent had said yes.
            a.consent = was.consent; a.consentAt = was.consentAt; a.consentBy = was.consentBy; a.consentSource = "parent";
            continue;
          }
          const incomingDecision = a.consent && a.consent !== "pending" ? a.consent : undefined;
          if (incomingDecision && incomingDecision !== was?.consent) {
            // The provider recorded (or changed) a decision — say who did, and when.
            a.consentAt = now; a.consentBy = who; a.consentSource = "provider";
          } else if (was) {
            a.consent = was.consent ?? a.consent; a.consentAt = was.consentAt; a.consentBy = was.consentBy; a.consentSource = was.consentSource;
          }
        }
        patch = { ...patch, attendees: enriched.attendees, childIds: enriched.childIds };
      }

      // Enforcement (the handoff's #3): with Setup → requireConsent on, a trip
      // can't be completed while any attending child's consent is still pending
      // ("declined" = not coming — that child isn't on the trip to block it).
      //
      // It bites when the trip is submitted for sign-off (before it goes) as well
      // as on completion, and it no longer honours the per-trip askConsent switch:
      // with the Setup gate on, a trip can't be waved through by turning consent
      // off for that one trip. askConsent now only means "don't chase parents in
      // the app" — consent collected on paper still has to be recorded per child.
      //
      // The same gate now also bites on the DAY: a head count with a number in it, or "returned", is refused while anyone is still pending.
      const wasSigned = (before.signoff as { submitted?: boolean } | undefined)?.submitted === true;
      // Approval fields count as a sign-off even without "submitted": the same gate applies, and it is stored as submitted.
      const approvalGiven = !!parsed.data.signoff?.approvedBy?.trim();
      const submitting = (parsed.data.signoff?.submitted === true || (approvalGiven && parsed.data.signoff?.submitted !== false)) && !wasSigned;
      const list = (patch.attendees as Attendee[] | undefined) ?? ((before.attendees as Attendee[] | undefined) ?? []);
      const dayAction =
        (parsed.data.returned === true && before.returned !== true) ||
        headCountRecorded(before.checkpoints as { n: string; counted?: number | null }[] | undefined, parsed.data.checkpoints);
      if (parsed.data.status === "completed" || submitting || dayAction) {
        const { requireConsent } = await tripSettings(tenantId, (before.franchiseId as string | null | undefined) ?? req.auth!.franchiseId);
        if (requireConsent) {
          const pending = consentPending(list);
          const names = (xs: Attendee[]) => `${xs.map((a) => a.n).slice(0, 4).join(", ")}${xs.length > 4 ? "…" : ""}`;
          if (pending.length) {
            const unlinked = unlinkedChildren(pending);
            const what = submitting ? "be signed off" : dayAction && parsed.data.status !== "completed" ? "go ahead (no head count or return can be recorded)" : "be completed";
            // A child with no booking or a clashing name has nobody to ask, so the family never gets a request: say so, and say how to fix it.
            const fix = unlinked.length
              ? ` ${names(unlinked)} ${unlinked.length === 1 ? "isn't" : "aren't"} linked to a booking, so no family can be asked. Pick the booked child in the list (a same-name clash needs the right child chosen), or record the consent you hold on paper.`
              : "";
            throw new TripRefusal(409, `${pending.length} ${pending.length === 1 ? "child still needs" : "children still need"} consent before this trip can ${what} (${names(pending)}).${fix}`);
          }
        }
      }
      // Sign-off is a server rule too, not just a disabled button: ratio, a finished risk assessment, the roster.
      if (submitting) {
        const problems = signoffProblems({ ...(before as object), ...(patch as object), attendees: list } as Parameters<typeof signoffProblems>[0]);
        if (problems.length) throw new TripRefusal(409, `This trip can't be signed off yet: ${problems.join("; ")}.`);
        patch.signoff = { ...(parsed.data.signoff ?? {}), submitted: true };
      }
      // The consent flag is the server's: worked out from the answers, whatever the browser sent.
      patch.consentObtained = consentObtained(list);
      // A change to what the sign-off covered (who is going, who looks after them, where, when) means it no longer stands.
      if (wasSigned && parsed.data.signoff?.submitted !== false) {
        const merged = { ...(before as object), ...(patch as object), attendees: list } as Parameters<typeof materialSnapshot>[0];
        if (materialSnapshot(before as Parameters<typeof materialSnapshot>[0]) !== materialSnapshot(merged)) {
          reopenedWhy = "the trip changed";
          patch.signoff = reopenedSignoff({ ...(before.signoff as object), ...(parsed.data.signoff ?? {}) }, reopenedWhy, new Date().toISOString());
        }
      }
      // Families are told once: putting a cancelled trip back and cancelling it again does not message them again.
      cancelledNow = parsed.data.status === "cancelled" && before.status !== "cancelled" && !before.cancelNotifiedAt;
      if (cancelledNow) patch.cancelNotifiedAt = new Date().toISOString();
      // Turning in-app consent requests off for a trip is the provider's call.
      // (Compared as "on unless false" — the planner always sends the flag, and
      // older trips never stored it.)
      if (parsed.data.askConsent !== undefined && (parsed.data.askConsent !== false) !== (before.askConsent !== false) && !canManage(req.auth!.role)) {
        throw new TripRefusal(403, "Only the provider can change how consent is collected for a trip");
      }


      tx.set(o.snap.ref, { ...patch, updatedAt: new Date().toISOString() }, { merge: true });
    });
  } catch (e) {
    if (e instanceof TripRefusal) { res.status(e.code).json({ error: e.message }); return; }
    throw e;
  }
  const after = await o.snap.ref.get();
  void requestConsents(after.id, after.data()!).catch((e) => console.error("[trips] consent notify:", (e as Error).message));
  // Told after the save, never able to fail it. Families first: they must not turn up for a trip that is off.
  if (cancelledNow) await notifyTripCancelled(after.id, after.data()!).catch((e) => console.error("[trips] cancel notify:", (e as Error).message));
  if (reopenedWhy) void notifySignoffReopened(after.id, after.data()!, reopenedWhy).catch((e) => console.error("[trips] reopen notify:", (e as Error).message));
  res.json(await present(req, { id: after.id, ...after.data() }));
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
  if (!(await canSendTripMessage(req, trip))) {
    res.status(403).json({ error: "Sending the trip message is limited to the trip lead / organiser (Setup → Trips & visits)" });
    return;
  }
  const template = String((req.body?.message as string | undefined) ?? trip.parentMsg ?? "").trim();
  if (!template) { res.status(400).json({ error: "Write the parent message first (Step 8), then send." }); return; }

  const attendees = ((trip.attendees as Attendee[] | undefined) ?? []).filter((a) => a.consent !== "declined");
  let base = template;
  for (const [tok, fn] of SEND_TOKENS) base = base.split(tok).join(fn(trip));

  let sent = 0;
  const messaged = new Set<string>();
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
    messaged.add(a.childId);
    sent++;
  }
  const now = new Date().toISOString();
  // Stamp "sent" onto the attendees as they are NOW (same reason as
  // requestConsents): writing back the list read before the emails went out
  // wiped any consent a parent gave (or declined) while they were sending.
  await db.runTransaction(async (tx) => {
    const fresh = await tx.get(o.snap.ref);
    if (!fresh.exists) return;
    const current = (fresh.get("attendees") as Attendee[] | undefined) ?? [];
    for (const a of current) if (a.childId && messaged.has(a.childId)) a.sent = true;
    tx.set(o.snap.ref, { attendees: current, parentMsgSentAt: now, updatedAt: now }, { merge: true });
  });
  res.json({ ok: true, sent });
});

trips.delete("/:id", async (req, res) => {
  const o = await own(req, req.params.id);
  if (o.status !== 200) { res.status(o.status).json({ error: o.status === 403 ? "Forbidden" : "Trip not found" }); return; }
  if (!canManage(req.auth!.role)) { res.status(403).json({ error: "Only the provider can delete a trip" }); return; }
  // Deleting an upcoming trip families were told about is a cancellation too: tell them.
  const gone = o.snap.data()!;
  if (gone.status === "planned" && !gone.cancelNotifiedAt && String(gone.date ?? "") >= ukToday()) await notifyTripCancelled(o.snap.id, gone).catch((e) => console.error("[trips] cancel notify:", (e as Error).message));
  await o.snap.ref.delete();
  res.json({ ok: true });
});
