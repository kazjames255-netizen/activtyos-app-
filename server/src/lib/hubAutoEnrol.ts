import { db } from "../firebase";
import { customerAreaOn } from "./customerArea";
import { forgetEnrolments, hubConfig, hubEnrolments, okId, type EnrolmentDoc } from "./hubCore";
import { forgetHub } from "./hubCache";
import { yearGroupFromDob } from "./hubRules";

// Learning Hub — AUTO-ENROL ON BOOKING. Off by default (settings.hub.autoEnrolOnBooking); a tutor switches it on in Setup.
// When a parent books with a provider that has the Learning Hub on, each child on the booking is enrolled the moment the booking is
// taken, instead of waiting in the "Enrol a student" list for the tutor to click Enrol.
//
// Deliberately conservative — it only ever ADDS a missing enrolment:
//  · an enrolment that already exists (active OR paused by the tutor) is never touched, so a tutor's pause/remove decision sticks;
//  · the child must be on the booking parent's OWN account (children.parentUid) and not archived;
//  · it enrols with no subject list (= every subject the provider teaches, as a manual Enrol with nothing ticked) and no tutor (an
//    unassigned student is visible to every tutor of the business); what a family can open is still governed by lessonAccess / what is set;
//  · nothing is emailed from here.
// Best-effort and fire-and-forget: a booking never fails because of this.

export interface AutoEnrolInput {
  tenantId: string;
  franchiseId?: string | null;
  parentUid: string | null | undefined;
  /** The children on the booking: by id when the booking carries one, else matched by name against the parent's own children. */
  children: { childId?: string | null; name?: string | null }[];
}

export async function autoEnrolFromBooking(o: AutoEnrolInput): Promise<string[]> {
  const franchiseId = o.franchiseId ?? null;
  if (!o.parentUid || !o.children.length) return [];
  const cfg = await hubConfig(o.tenantId, franchiseId);
  if (cfg.autoEnrolOnBooking !== true) return [];
  if (!(await customerAreaOn(o.tenantId, "learninghub", franchiseId))) return [];

  const mine = (await db.collection("children").where("parentUid", "==", o.parentUid).get()).docs.filter((d) => d.get("archived") !== true);
  const byId = new Map(mine.map((d) => [d.id, d]));
  const byName = new Map(mine.map((d) => [String(d.get("name") ?? "").trim().toLowerCase(), d]));
  const picked = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  for (const c of o.children) {
    const hit = (c.childId && okId(c.childId) ? byId.get(c.childId) : undefined) ?? byName.get((c.name ?? "").trim().toLowerCase());
    if (hit) picked.set(hit.id, hit);
  }
  if (!picked.size) return [];

  const parentEmail = (((await db.collection("users").doc(o.parentUid).get()).get("email") as string | undefined) ?? "").trim().toLowerCase();
  const now = new Date().toISOString();
  const enrolled: string[] = [];
  for (const [childId, child] of picked) {
    const dob = typeof child.get("dob") === "string" && child.get("dob") ? (child.get("dob") as string) : null;
    const doc: EnrolmentDoc = {
      tenantId: o.tenantId, franchiseId, childId, childName: (child.get("name") as string) ?? "", parentUid: o.parentUid, parentEmail,
      subjects: [], tutorUid: null, tutorName: "", active: true,
      yearGroup: yearGroupFromDob(dob, cfg.yearGroups), yearGroupAuto: true,
      createdBy: "auto-enrol", createdAt: now, updatedAt: now,
    };
    try {
      await hubEnrolments.doc(`${o.tenantId}__${childId}`).create(doc); // create() fails if the doc exists: never overwrites or re-activates
      enrolled.push(childId);
    } catch (e) {
      if ((e as { code?: number }).code !== 6) throw e; // 6 = ALREADY_EXISTS: someone (a tutor, an invite) got there first — fine
    }
  }
  if (enrolled.length) { forgetHub(o.tenantId, "roster"); forgetEnrolments(); }
  return enrolled;
}
