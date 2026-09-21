import type { Request, Response } from "express";
import { db } from "../firebase";
import { effectiveSettings } from "../middleware/access";
import { customerAreaOn } from "./customerArea";
import { firstOff } from "../../../lib/accessMap";
import { mergeHub, type HubSettings } from "../../../lib/hubConfig";

// Learning Hub — the ONE place that decides who is calling and what part of a
// tenant's hub they may see or change. Every hub route (topics, notes, and each
// later milestone's router) starts with `resolveCtx()` and filters rows through
// `canSee` / `canWriteRow`, so tenancy, franchise scope and family access are
// decided identically everywhere and can't drift per-route.
//
// TENANCY  every hub doc carries `tenantId`; lists are filtered by it, single-doc
//          reads re-check it (foreign ids are a 404, never a 403).
// FRANCHISE content docs carry `franchiseId` (null = head office / a freelancer
//          / a company's own). A tenant-level operator sees and edits all rows;
//          a franchise (and its staff) sees head-office rows READ-ONLY plus its
//          own, and edits only its own.
// FAMILIES a parent reads a provider's hub only through an ACTIVE ENROLMENT of
//          their own child (hubEnrolments) — being a customer, or having
//          followed the provider, proves nothing (a provider can type any email
//          in as a customer; any parent can follow any live provider). The
//          enrolment also says which franchise's content the child sees and,
//          optionally, which subjects.
// ON/OFF   Setup → Features → Learning Hub (opt-in; lib/accessMap.ts).
//          Operators: middleware/access.ts (FEATURE_API) AND re-checked here;
//          families: customerAreaOn().

export const hubEnrolments = db.collection("hubEnrolments");

const OPERATORS = new Set(["company", "freelancer", "franchise", "staff"]);

export interface EnrolledChild { childId: string; childName: string; franchiseId: string | null; subjects: string[] }

export interface HubCtx {
  tenantId: string;
  uid: string;
  /** Display name for `createdByName` — never an email address. */
  name: string;
  role: string;
  /** Tutor side: may author (subject to caps for staff, franchise scope for rows). */
  canEdit: boolean;
  /** Operator's franchise; null = tenant-level (company, freelancer, HO staff). */
  franchiseId: string | null;
  /** Parent side: this parent's ACTIVE enrolled children at this tenant. */
  children: EnrolledChild[];
  /** Parent side: the child the request is about (?childId=), when given. */
  childId: string | null;
}

/** A doc id can't contain "/" — refuse odd ids up front so `.doc()` never throws. */
export const okId = (id: unknown): id is string => typeof id === "string" && id.length > 0 && id.length <= 200 && !id.includes("/");

/** Active enrolments for a parent, across every provider. Cached for a few seconds per parent: every hub request a
 *  family makes starts here, and a first paint is several requests at once. `forgetEnrolments()` (called by the
 *  roster routes and the privacy erase) drops it, so pausing / un-enrolling a child takes effect immediately. */
const parentEnrolCache = new Map<string, { at: number; p: Promise<(EnrolmentDoc & { id: string })[]> }>();
const PARENT_ENROL_TTL_MS = 8_000;
export const forgetEnrolments = () => { parentEnrolCache.clear(); };
export function enrolmentsForParent(uid: string): Promise<(EnrolmentDoc & { id: string })[]> {
  const hit = parentEnrolCache.get(uid);
  if (hit && Date.now() - hit.at < PARENT_ENROL_TTL_MS) return hit.p;
  const p = hubEnrolments.where("parentUid", "==", uid).get()
    .then((snap) => snap.docs.map((d) => ({ id: d.id, ...(d.data() as EnrolmentDoc) })).filter((e) => e.active !== false));
  p.catch(() => { if (parentEnrolCache.get(uid)?.p === p) parentEnrolCache.delete(uid); });
  if (parentEnrolCache.size > 2000) parentEnrolCache.clear();
  parentEnrolCache.set(uid, { at: Date.now(), p });
  return p;
}

export interface EnrolmentDoc {
  tenantId: string;
  franchiseId: string | null;
  childId: string;
  childName: string;
  parentUid: string;
  parentEmail: string;
  /** Empty = every subject the provider teaches. */
  subjects: string[];
  tutorUid: string | null;
  tutorName: string;
  active: boolean;
  /** Year group tag ("Year 4"). `yearGroupAuto` = filled in from the child's dob (kept current each September);
   *  undefined = an enrolment from before year groups existed (derived on the fly); null = tutor says unknown. */
  yearGroup?: string | null;
  yearGroupAuto?: boolean;
  /** Lower-cased subjects a tutor waived the placement test for. */
  diagnosticWaived?: string[];
  /** Assessment ids a tutor allowed ONE more attempt at (consumed on start). */
  retakeGrants?: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** The display name to stamp on things a tutor creates. Never an email. Cached for a while per (user, tenant):
 *  it was 1–3 Firestore reads on EVERY hub request, which is a large part of a tutor's page-load time. */
const nameCache = new Map<string, { name: string; at: number }>();
const NAME_TTL_MS = 10 * 60_000;
async function displayName(uid: string, tokenName?: string, tenantId?: string): Promise<string> {
  if (tokenName?.trim()) return tokenName.trim();
  const key = `${uid}|${tenantId ?? ""}`;
  const hit = nameCache.get(key);
  if (hit && Date.now() - hit.at < NAME_TTL_MS) return hit.name;
  let name = uid ? (((await db.collection("users").doc(uid).get()).get("name") as string | undefined)?.trim() ?? "") : "";
  // A login with no display name: use the business's own name rather than a bare "Your tutor".
  if (!name && tenantId) {
    const [lib, ten] = await Promise.all([db.collection("libraries").doc(tenantId).get(), db.collection("tenants").doc(tenantId).get()]);
    name = ((lib.get("settings.providerName") as string | undefined)?.trim() || (ten.get("name") as string | undefined)?.trim() || "");
  }
  name = name || "Your tutor";
  if (nameCache.size > 500) nameCache.clear();
  nameCache.set(key, { name, at: Date.now() });
  return name;
}

/** Who is calling and which tenant's hub they work in — or a refusal has already
 *  been sent and this returns null. */
export async function resolveCtx(req: Request, res: Response): Promise<HubCtx | null> {
  const auth = req.auth!;
  const uid = req.user?.uid ?? "";

  if (OPERATORS.has(auth.role)) {
    if (!auth.tenantId) { res.status(403).json({ error: "This account has no provider workspace" }); return null; }
    const inFranchise = (auth.role === "franchise" || auth.role === "staff") && !!auth.franchiseId;
    // A franchise account with no franchise can't be scoped: refuse rather than
    // hand it the whole network (same rule as GET /api/children/lookup).
    if (auth.role === "franchise" && !auth.franchiseId) { res.status(403).json({ error: "This franchise account isn't linked to a franchise" }); return null; }
    const franchiseId = inFranchise ? auth.franchiseId! : null;
    // The middleware already refuses a switched-off module; re-check here so a
    // settings-lookup hiccup there (it fails open) can't serve an opt-in module.
    const features = (await effectiveSettings(auth.tenantId, franchiseId)).features as Record<string, unknown> | undefined;
    if (firstOff(features, ["learninghub"])) {
      res.status(403).json({ error: "Teaching Hub is turned off for this account. You can turn it on in Setup → Features.", code: "feature_off", feature: "learninghub" });
      return null;
    }
    return { tenantId: auth.tenantId, uid, name: await displayName(uid, req.user?.name, auth.tenantId), role: auth.role, canEdit: true, franchiseId, children: [], childId: null };
  }

  if (auth.role === "parent") {
    const tenantId = typeof req.query.tenantId === "string" ? req.query.tenantId : "";
    if (!okId(tenantId) || !uid) { res.status(400).json({ error: "Which provider? Pass ?tenantId=" }); return null; }
    const mine = (await enrolmentsForParent(uid)).filter((e) => e.tenantId === tenantId);
    // No enrolment = no relationship as far as the hub goes; 404 so a tenant id
    // can't be probed for existence.
    if (!mine.length) { res.status(404).json({ error: "Provider not found" }); return null; }
    // On if ANY of the child's franchises has the hub switched on.
    const franchises = [...new Set(mine.map((e) => e.franchiseId ?? null))];
    const on = (await Promise.all(franchises.map((f) => customerAreaOn(tenantId, "learninghub", f)))).some(Boolean);
    if (!on) { res.status(403).json({ error: "This provider hasn't switched on My Classroom.", code: "feature_off", feature: "learninghub" }); return null; }
    const children: EnrolledChild[] = mine.map((e) => ({ childId: e.childId, childName: e.childName, franchiseId: e.franchiseId ?? null, subjects: e.subjects ?? [] }));
    const wanted = typeof req.query.childId === "string" && req.query.childId ? req.query.childId : null;
    if (wanted && !children.some((c) => c.childId === wanted)) { res.status(404).json({ error: "Student not found" }); return null; }
    return { tenantId, uid, name: "", role: "parent", canEdit: false, franchiseId: null, children, childId: wanted };
  }

  res.status(403).json({ error: "The Teaching Hub is for providers and My Classroom is for their families" });
  return null;
}

export const requireEdit = (ctx: HubCtx, res: Response) => {
  if (ctx.canEdit) return true;
  res.status(403).json({ error: "Only tutors can change the Teaching Hub" });
  return false;
};

/** The children a parent request is about: the one asked for, else all enrolled. */
export const scopedChildren = (ctx: HubCtx) => (ctx.childId ? ctx.children.filter((c) => c.childId === ctx.childId) : ctx.children);

/** Franchise scopes a parent's content comes from: head office (null) plus each
 *  enrolled child's franchise. */
function parentFranchises(ctx: HubCtx): Set<string | null> {
  return new Set<string | null>([null, ...scopedChildren(ctx).map((c) => c.franchiseId)]);
}

/** Subjects a parent may see: null = all. A child enrolled with no subject list
 *  sees everything; otherwise the union of their subject lists. */
export function parentSubjects(ctx: HubCtx): Set<string> | null {
  if (ctx.role !== "parent") return null;
  const kids = scopedChildren(ctx);
  if (!kids.length || kids.some((c) => !c.subjects.length)) return null;
  return new Set(kids.flatMap((c) => c.subjects.map((s) => s.toLowerCase())));
}

/** May this caller read a row carrying this franchiseId? */
export function canSee(ctx: HubCtx, franchiseId: string | null | undefined): boolean {
  const f = franchiseId ?? null;
  if (ctx.role === "parent") return parentFranchises(ctx).has(f);
  if (ctx.franchiseId === null) return true; // tenant-level operator: the whole tenant
  return f === null || f === ctx.franchiseId; // franchise: head office's (read-only) + its own
}

/** May this caller see a PEOPLE row (an enrolment, attempt, submission, mastery
 *  row, lesson with attendees) carrying this franchiseId? Stricter than `canSee`,
 *  which lets a franchise READ head office's shared CONTENT (topics, notes…): a
 *  franchise must never see head office's — or another franchise's — students, so
 *  it gets only its own; tenant-level operators see the whole tenant. Families
 *  are already limited to their own children. */
export function canSeeStudent(ctx: HubCtx, franchiseId: string | null | undefined): boolean {
  if (ctx.role === "parent") return canSee(ctx, franchiseId);
  return ctx.franchiseId === null || (franchiseId ?? null) === ctx.franchiseId;
}

/** May this caller change a row carrying this franchiseId? */
export function canWriteRow(ctx: HubCtx, franchiseId: string | null | undefined): boolean {
  if (!ctx.canEdit) return false;
  return ctx.franchiseId === null || (franchiseId ?? null) === ctx.franchiseId;
}

/** Subject visibility for a parent's enrolled subjects (case-insensitive). */
export const subjectAllowed = (ctx: HubCtx, subject: string) => {
  const allowed = parentSubjects(ctx);
  return !allowed || allowed.has(subject.toLowerCase());
};

export const norm = (s: string) => s.trim().replace(/\s+/g, " ");
export const same = (a: string | null | undefined, b: string | null | undefined) => (a ?? "").toLowerCase() === (b ?? "").toLowerCase();

/** Every collection whose docs point at a topic via `topicId`. A topic can't be
 *  deleted while anything here uses it. Each milestone registers its own. */
const topicRefs: FirebaseFirestore.CollectionReference[] = [];
export const registerTopicRef = (col: FirebaseFirestore.CollectionReference) => { if (!topicRefs.includes(col)) topicRefs.push(col); };
export const topicReferences = () => topicRefs;

/** The tenant's hub config (settings.hub merged over the defaults). Pass the
 *  franchise a record belongs to when it has one — a franchise keeps its own Setup. */
export async function hubConfig(tenantId: string, franchiseId?: string | null): Promise<HubSettings> {
  const s = await effectiveSettings(tenantId, franchiseId);
  return mergeHub(s.hub as Partial<HubSettings> | undefined);
}

export { ageInYears, ukYearGroup, yearGroupFromDob, effectiveYearGroup } from "./hubRules";

/** Dates of birth for these children (null = none on file). Read straight from the family's child
 *  profiles with a field mask — only the dob leaves Firestore, and only to derive an age / year group. */
const dobCache = new Map<string, { at: number; dob: string | null }>();
const DOB_TTL_MS = 120_000; // a child's date of birth almost never changes; the roster asks for every student's on each load
export async function childDobs(childIds: string[]): Promise<Map<string, string | null>> {
  const ids = [...new Set(childIds)].filter(okId);
  const out = new Map<string, string | null>();
  const now = Date.now();
  const miss: string[] = [];
  for (const id of ids) {
    const hit = dobCache.get(id);
    if (hit && now - hit.at < DOB_TTL_MS) out.set(id, hit.dob); else miss.push(id);
  }
  for (let i = 0; i < miss.length; i += 300) {
    const snaps = await db.getAll(...miss.slice(i, i + 300).map((id) => db.collection("children").doc(id)), { fieldMask: ["dob"] });
    for (const s of snaps) {
      const dob = s.exists && typeof s.get("dob") === "string" && s.get("dob") ? (s.get("dob") as string) : null;
      out.set(s.id, dob);
      dobCache.set(s.id, { at: now, dob });
    }
  }
  if (dobCache.size > 5000) dobCache.clear();
  return out;
}

/** The libraries doc a caller's Setup lives in — a franchise (and its staff) keeps its OWN, everyone else the tenant's.
 *  Mirrors libDocId in routes/library.ts: keep the two in step. */
export const libraryDocId = (ctx: Pick<HubCtx, "tenantId" | "franchiseId">) => (ctx.franchiseId ? `${ctx.tenantId}__fr__${ctx.franchiseId}` : ctx.tenantId);
