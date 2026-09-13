import { Router } from "express";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";
import { notifyTenantMember } from "../lib/notify";

// Learning Centre notifications.
//
// "Assign & notify" said "they'll be notified" and "Remind" said "Reminder
// sent to … and to admin" — both were a toast; nothing left the browser. The
// courses and assignments themselves still live in the browser (a real LMS
// store is Amir's — docs/amir-backend-outstanding.md #37), but telling people
// is done here, for real: each member of staff the assignment covers gets a
// bell (and an email), and the response says how many were actually reached,
// so the screen can stop claiming more than happened.

export const learning = Router();
const canManage = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";

const schema = z.object({
  kind: z.enum(["assign", "remind"]),
  title: z.string().trim().min(1).max(200),
  due: z.string().trim().max(40).optional(),
  required: z.boolean().optional(),
  target: z.object({
    kind: z.enum(["all", "roles", "staff", "locs"]),
    roles: z.array(z.string().max(80)).max(100).default([]),
    staff: z.array(z.string().max(120)).max(1_000).default([]),
    // Company only: which locations the assignment covers — "Company-owned"
    // (head office's own staff) or a franchise's name/area. Empty or "all" =
    // everywhere.
    locs: z.array(z.string().max(120)).max(200).default([]),
  }),
});

learning.post("/notify", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canManage(auth.role)) {
    res.status(403).json({ error: "Only a manager can assign training" });
    return;
  }
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const { kind, title, due, required, target } = parsed.data;

  const [users, franchises] = await Promise.all([
    db.collection("users").where("tenantId", "==", auth.tenantId).where("role", "==", "staff").get(),
    db.collection("users").where("tenantId", "==", auth.tenantId).where("role", "==", "franchise").get(),
  ]);
  const lc = (v: unknown) =>
    String(v ?? "")
      .trim()
      .toLowerCase();
  // Location targeting was accepted and ignored — "Bedford only" reached every
  // member of staff in the network. Resolve each location to the franchises it
  // names; staff are then in scope by their franchiseId.
  const locs = target.locs.map(lc).filter(Boolean);
  const everywhere = !locs.length || locs.includes("all");
  const hoOwn = locs.some((l) => l.startsWith("company-owned") || l === "head office");
  const inLocs = new Set(
    franchises.docs
      .filter((f) => {
        const labels = [f.get("franchiseName"), f.get("franchiseArea"), f.get("name"), f.get("businessName")].map(lc).filter(Boolean);
        return locs.some((l) => labels.some((x) => x === l || x.includes(l) || l.includes(x)));
      })
      .map((f) => f.id),
  );
  const locOk = (u: FirebaseFirestore.QueryDocumentSnapshot) => {
    if (everywhere || auth.role === "franchise") return true;
    const fr = (u.get("franchiseId") as string | null | undefined) ?? null;
    return fr ? inLocs.has(fr) : hoOwn;
  };
  const names = new Set(target.staff.map(lc));
  const roles = target.roles.map(lc);
  const recipients = users.docs.filter((u) => {
    if (u.get("disabled") === true || !u.get("email")) return false;
    // A franchise assigns to its own team only.
    if (auth.role === "franchise" && u.get("franchiseId") !== auth.franchiseId) return false;
    if (!locOk(u)) return false;
    if (target.kind === "all" || target.kind === "locs") return true;
    if (target.kind === "staff") return names.has(lc(u.get("name")));
    const jobs = [lc(u.get("jobTitle")), lc(u.get("staffRole"))].filter(Boolean);
    return roles.some((r) => jobs.some((j) => j.includes(r) || r.includes(j)));
  });

  const dueTxt = due && due !== "—" ? ` — due ${due}` : "";
  // Answer now; the bells and emails go out behind it (one email each — a
  // network-wide assignment used to hold the button for a minute or more).
  res.json({
    sent: recipients.length,
    names: recipients.map((u) => String(u.get("name") ?? u.get("email"))),
  });
  const tenantId = auth.tenantId;
  const senderEmail = (req.user?.email ?? "").trim().toLowerCase();
  void (async () => {
    for (const u of recipients) {
      await notifyTenantMember(tenantId, String(u.get("email")), {
        category: "task",
        title: kind === "assign" ? `New training: ${title}` : `Reminder: ${title}`,
        body: kind === "assign" ? `You've been assigned "${title}"${dueTxt}${required ? " (required)" : ""}. Open it in My learning.` : `"${title}" is still to complete${dueTxt}. Open it in My learning.`,
        href: "/staff/certificates",
        sendEmail: true,
      }).catch(() => {});
    }
    // "…and to admin": the reminder is logged on the bell of the manager who
    // sent it — only theirs. It was an untargeted team alert in category
    // 'task', which staff see, so it landed on every colleague's bell (d17s9).
    // The people reminded have their own "Reminder: …" above.
    if (kind === "remind" && senderEmail) {
      await notifyTenantMember(tenantId, senderEmail, {
        category: "task",
        title: `Training reminder sent: ${title}`,
        body: `${recipients.length} ${recipients.length === 1 ? "person" : "people"} reminded${dueTxt}.`,
        ...(auth.role === "company" ? { href: "/company/learning" } : {}),
      }).catch(() => {});
    }
  })().catch((e) => console.error("[learning] notify:", (e as Error).message));
});

// ── Assignments + completions ───────────────────────────────────────────────
// Who's been assigned which course, and who has passed it, lived in browsers:
// the assignment list on the manager's laptop, a completion on the phone the
// course was taken on. The manager's "who's in date" view saw neither unless
// it was the same device. Both are here now; the course content itself is
// still the built-in library (plus a manager's edits, still per-device).
const keyOf = (tenantId: string, franchiseId: string | null) => (franchiseId ? `${tenantId}__fr__${franchiseId}` : tenantId);
const nameSlug = (n: string) => n.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, 100) || "unnamed";
async function accountName(uid: string | undefined): Promise<string> {
  if (!uid) return "";
  return String((await db.collection("users").doc(uid).get()).get("name") ?? "").trim();
}

// Does a head-office assignment's location list reach this member of staff?
// Same rule /notify uses to decide who's told: none / "all" = everywhere;
// "Company-owned" = head office's own staff; any other label names a franchise
// (its name, area or business name). frLabels = null for head-office staff.
const lcs = (v: unknown) => String(v ?? "").trim().toLowerCase();
function locsReach(locsRaw: unknown, frLabels: string[] | null): boolean {
  const locs = (Array.isArray(locsRaw) ? locsRaw : []).map(lcs).filter(Boolean);
  if (!locs.length || locs.includes("all")) return true;
  if (!frLabels) return locs.some((l) => l.startsWith("company-owned") || l === "head office");
  return locs.some((l) => frLabels.some((x) => x === l || x.includes(l) || l.includes(x)));
}
async function franchiseLabels(tenantId: string, franchiseId: string): Promise<string[]> {
  let f: FirebaseFirestore.DocumentSnapshot | undefined = await db.collection("users").doc(franchiseId).get();
  if (!(f.exists && f.get("tenantId") === tenantId && f.get("role") === "franchise")) {
    f = (await db.collection("users").where("tenantId", "==", tenantId).where("franchiseId", "==", franchiseId).where("role", "==", "franchise").limit(1).get()).docs[0];
  }
  return f ? [f.get("franchiseName"), f.get("franchiseArea"), f.get("name"), f.get("businessName")].map(lcs).filter(Boolean) : [];
}

learning.get("/assignments", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !(canManage(auth.role) || auth.role === "staff")) { res.status(403).json({ error: "Forbidden" }); return; }
  const d = await db.collection("learningAssignments").doc(keyOf(auth.tenantId, auth.franchiseId)).get();
  const own = (d.get("assignments") as Record<string, unknown>[] | undefined) ?? null;
  // Managers get exactly their own list — it's what their screen edits and
  // PUTs back whole.
  if (auth.role !== "staff") { res.json({ assignments: own }); return; }
  // Staff: head office's list is narrowed to the locations it covers (a
  // "Bedford only" course isn't head office's own staff's). Franchise staff
  // ALSO get head office's network-wide assignments that reach their
  // franchise, alongside their franchise's own (d17s10 — they were told about
  // a course that never appeared in My learning). Read-only: tagged fromHo.
  if (!auth.franchiseId) { res.json({ assignments: own && own.filter((a) => locsReach(a.locs, null)) }); return; }
  const ho = ((await db.collection("learningAssignments").doc(auth.tenantId).get()).get("assignments") as Record<string, unknown>[] | undefined) ?? [];
  const labels = ho.length ? await franchiseLabels(auth.tenantId, auth.franchiseId) : [];
  const fromHo = ho.filter((a) => locsReach(a.locs, labels)).map((a) => ({ ...a, fromHo: true }));
  res.json({ assignments: own || fromHo.length ? [...(own ?? []), ...fromHo] : null });
});

learning.put("/assignments", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canManage(auth.role)) { res.status(403).json({ error: "Only a manager can assign training" }); return; }
  const parsed = z.object({ assignments: z.array(z.object({ course: z.string().max(80) }).passthrough()).max(500) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  await db.collection("learningAssignments").doc(keyOf(auth.tenantId, auth.franchiseId)).set({ tenantId: auth.tenantId, franchiseId: auth.franchiseId ?? null, assignments: parsed.data.assignments, updatedAt: new Date().toISOString(), updatedBy: req.user?.email ?? null });
  res.json({ ok: true });
});

const doneSchema = z.object({
  courseId: z.string().trim().min(1).max(80),
  title: z.string().trim().max(200),
  score: z.number().min(0).max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  staffName: z.string().trim().max(120).optional(),
});
// POST /api/learning/completions — a course passed. Staff record their own
// (under their account name); a manager can record one for someone (e.g.
// training done elsewhere). A resit keeps the better score. The quiz is marked
// on the staff member's device (the course content isn't on the server), so a
// staff-recorded pass is stored — and shown to the manager — as self-reported;
// a manager-recorded one isn't.
learning.post("/completions", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !(canManage(auth.role) || auth.role === "staff")) { res.status(403).json({ error: "Forbidden" }); return; }
  const parsed = doneSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const p = parsed.data;
  const name = auth.role === "staff" ? await accountName(req.user?.uid) : (p.staffName ?? "").trim();
  if (!name) { res.status(400).json({ error: auth.role === "staff" ? "Your account has no name on it — ask your manager to add one." : "Who completed it?" }); return; }
  const key = keyOf(auth.tenantId, auth.franchiseId);
  const ref = db.collection("learningCompletions").doc(`${key}_${nameSlug(name)}_${p.courseId}`.replace(/\//g, "_"));
  const kept = await db.runTransaction(async (tx) => {
    const cur = (await tx.get(ref)).data();
    if (cur && Number(cur.score) > p.score) return cur;
    const doc = { key, tenantId: auth.tenantId, franchiseId: auth.franchiseId ?? null, staffName: name, uid: auth.role === "staff" ? req.user?.uid ?? null : null, courseId: p.courseId, title: p.title, score: Math.round(p.score), date: p.date, selfReported: auth.role === "staff", recordedAt: new Date().toISOString(), recordedBy: req.user?.email ?? null };
    tx.set(ref, doc);
    return doc;
  });
  res.json({ staffName: kept.staffName, courseId: kept.courseId, title: kept.title, score: kept.score, date: kept.date, selfReported: kept.selfReported === true });
});

// GET /api/learning/completions — { staffName: [done…] }. Managers see the
// team; staff see their own.
learning.get("/completions", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !(canManage(auth.role) || auth.role === "staff")) { res.status(403).json({ error: "Forbidden" }); return; }
  const snap = await db.collection("learningCompletions").where("key", "==", keyOf(auth.tenantId, auth.franchiseId)).get();
  const me = auth.role === "staff" ? (await accountName(req.user?.uid)).toLowerCase() : null;
  const out: Record<string, { courseId: string; title: string; score: number; date: string; selfReported: boolean }[]> = {};
  for (const d of snap.docs) {
    const x = d.data();
    if (me !== null && String(x.staffName).toLowerCase() !== me) continue;
    (out[x.staffName] ??= []).push({ courseId: x.courseId, title: x.title, score: x.score, date: x.date, selfReported: x.selfReported === true });
  }
  res.json(out);
});
