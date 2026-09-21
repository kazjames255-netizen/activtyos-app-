import { db } from "../firebase";
import { notify } from "./notify";
import type { EnrolmentDoc } from "./hubCore";

// Learning Hub → the family's bell + email (category "learning", which a parent
// can mute — the bell entry is still written, only the email is suppressed:
// lib/notify.ts). Fire-and-forget by design: a notification must NEVER block or
// fail the request that caused it, so callers use `void notifyFamilies(...)`
// and this function swallows every error.
//
// Only ENROLLED, ACTIVE children's parents are told, and the parent's email is
// read here from the enrolment — it never travels back out to any client.

const HREF = "/custdash/learninghub";
const MAX_RECIPIENTS = 200;

export interface FamilyNotice {
  tenantId: string;
  /** Limit to these children; null/undefined = every enrolled child in scope. */
  childIds?: string[] | null;
  /** Content scope: a franchise's own content reaches only its own students
   *  (head-office content, franchiseId null, reaches everyone). Omit = no filter. */
  franchiseId?: string | null;
  /** Content subject: children enrolled for specific subjects only hear about theirs. */
  subject?: string | null;
  /** What to say, given this family's child names (one parent may have several in scope). */
  compose: (childNames: string[]) => { title: string; body: string };
  /** The record it is about (a homework / lesson / note id). */
  ref?: string;
  /** Where the bell entry lands inside the hub: `?tab=…` (default: the hub's Home) and, for one thing, `open=<kind>:<id>` (a lesson to play,
   *  a quiz to start, a homework to open). The child rides along (`child=`) whenever this family has exactly one child in scope, so the
   *  link opens the right child's view instead of whichever child was last picked. */
  tab?: "home" | "live" | "quizzes" | "diagnostic" | "homework" | "notes" | "flashcards";
  open?: { kind: "quiz" | "lesson" | "hw"; id: string } | null;
}

/** /custdash/learninghub?tab=…&child=…&open=… — the same shape the hub reads (features/learninghub/family/link.ts). */
export function hubHref(o: { tab?: string; childId?: string | null; open?: { kind: string; id: string } | null }): string {
  const p = new URLSearchParams();
  if (o.tab) p.set("tab", o.tab);
  if (o.childId) p.set("child", o.childId);
  if (o.open) p.set("open", `${o.open.kind}:${o.open.id}`);
  const q = p.toString();
  return q ? `${HREF}?${q}` : HREF;
}

export async function notifyFamilies(n: FamilyNotice): Promise<number> {
  try {
    const snap = await db.collection("hubEnrolments").where("tenantId", "==", n.tenantId).get();
    const want = n.childIds ? new Set(n.childIds) : null;
    const subject = n.subject?.trim().toLowerCase() || null;
    const byParent = new Map<string, { names: string[]; childIds: string[] }>();
    for (const d of snap.docs) {
      const e = d.data() as EnrolmentDoc;
      if (e.active === false || !e.parentEmail) continue;
      if (want && !want.has(e.childId)) continue;
      if (n.franchiseId !== undefined && n.franchiseId !== null && (e.franchiseId ?? null) !== n.franchiseId) continue;
      if (subject && e.subjects?.length && !e.subjects.some((s) => s.toLowerCase() === subject)) continue;
      const email = e.parentEmail.trim().toLowerCase();
      const cur = byParent.get(email) ?? { names: [], childIds: [] };
      cur.names.push(e.childName); cur.childIds.push(e.childId);
      byParent.set(email, cur);
    }
    let sent = 0;
    for (const [email, who] of [...byParent].slice(0, MAX_RECIPIENTS)) {
      const c = n.compose(who.names);
      const href = n.tab || n.open ? hubHref({ tab: n.tab, childId: who.childIds.length === 1 ? who.childIds[0] : null, open: n.open }) : who.childIds.length === 1 ? hubHref({ childId: who.childIds[0] }) : HREF;
      await notify({ tenantId: n.tenantId, to: { kind: "parent", email }, category: "learning", title: c.title, body: c.body, href, ...(n.ref ? { ref: n.ref } : {}) });
      sent++;
    }
    return sent;
  } catch (e) {
    console.error("[hub-notify] failed:", (e as Error).message);
    return 0;
  }
}

/** "Maya", "Maya and Leo", "Maya, Leo and Ava" */
export const nameList = (names: string[]) => {
  const uniq = [...new Set(names.map((x) => x.trim()).filter(Boolean))];
  return uniq.length <= 1 ? (uniq[0] ?? "your child") : `${uniq.slice(0, -1).join(", ")} and ${uniq[uniq.length - 1]}`;
};

/** New published note → the families of students who can see its topic. Called
 *  once from POST /notes; resolves the topic's subject itself so that route
 *  needs only this one line. */
export function notifyNewNote(tenantId: string, franchiseId: string | null, topicId: string, title: string, noteId: string): void {
  void (async () => {
    const t = await db.collection("hubTopics").doc(topicId).get();
    const subject = t.exists && t.get("tenantId") === tenantId ? ((t.get("subject") as string | undefined) ?? null) : null;
    await notifyFamilies({
      tenantId, franchiseId, subject, ref: noteId, tab: "notes", open: { kind: "lesson", id: noteId },
      compose: (names) => ({ title: "New lesson shared", body: `New lesson for ${nameList(names)}: "${title}"${subject ? ` (${subject})` : ""}.` }),
    });
  })().catch(() => {});
}
