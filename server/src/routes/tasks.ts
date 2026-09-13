import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";

// Task Manager — the operator to-do system. A task hangs off a real operational
// record (camp / booking / compliance / venue) which is what makes it ActivityOS
// Tasks rather than a generic to-do. Tenant-scoped; staff see only their own.
export const tasks = Router();
const col = db.collection("tasks");
const canUse = (role: Role) => role === "staff" || role === "company" || role === "freelancer" || role === "franchise" || role === "platform";

/**
 * Which bucket a caller's tasks live in.
 *
 * A platform (HQ) account has no tenant — tenantId is null — so it gets its own
 * fixed bucket rather than a tenant's. HQ's own to-do list is not a provider's,
 * and must never appear in one: "__platform__" can never collide with a real
 * Firestore-generated tenant id.
 */
/** Is this task assigned to the caller? Email first — a rename must not hand
 *  someone else's tasks over, nor take yours away. Name only as a fallback for
 *  tasks written before whoEmail existed. */
function assignedTo(req: Request, t: { who?: unknown; whoEmail?: unknown }): boolean {
  const email = (req.user?.email ?? "").trim().toLowerCase();
  const tEmail = String(t.whoEmail ?? "").trim().toLowerCase();
  if (tEmail) return !!email && tEmail === email;
  const name = (req.user?.name ?? req.user?.email ?? "").trim().toLowerCase();
  return String(t.who ?? "").trim().toLowerCase() === name;
}

// ── Subtask assignees (acceptance d11s8) ─────────────────────────────────────
// A checklist step handed to someone else used to reach nobody: their My tasks
// was empty and ticking it 404'd. Decision (least privilege — Kaz to confirm):
// a member of STAFF given a step sees the task in their own list (flagged
// `subtaskOnly`), and may tick/untick THEIR step(s) and add comments — nothing
// else (no title/status/due/assignee edits, no other people's steps, no
// delete). Operators already see and edit every task in their bucket.
interface Me { email: string; names: Set<string> }
async function whoAmI(req: Request): Promise<Me> {
  const email = (req.user?.email ?? "").trim().toLowerCase();
  const names = new Set<string>();
  const add = (n: unknown) => { const v = String(n ?? "").trim().toLowerCase(); if (v) names.add(v); };
  add(req.user?.name);
  if (req.user?.uid) add((await db.collection("users").doc(req.user.uid).get()).get("name"));
  return { email, names };
}
/** Is this step the caller's? Email first (steps picked from the team list
 *  carry one); a bare name — or an email typed as the name — otherwise. */
function subIsMine(me: Me, sub: { who?: unknown; whoEmail?: unknown }): boolean {
  const e = String(sub.whoEmail ?? "").trim().toLowerCase();
  if (e) return !!me.email && e === me.email;
  const w = String(sub.who ?? "").trim().toLowerCase();
  return !!w && (me.names.has(w) || (!!me.email && w === me.email));
}
const mySubs = (me: Me, t: Record<string, unknown>): number[] =>
  (Array.isArray(t.subs) ? (t.subs as { who?: unknown; whoEmail?: unknown }[]) : []).flatMap((s, i) => (subIsMine(me, s) ? [i] : []));

const PLATFORM_BUCKET = "__platform__";
const bucketOf = (auth: { role: string; tenantId: string | null }) =>
  auth.role === "platform" ? PLATFORM_BUCKET : auth.tenantId;

const linkSchema = z.object({ k: z.enum(["child", "parent", "camp", "book", "comp", "venue", "list", "gen", "sales"]), v: z.string().max(160), href: z.string().max(400).optional() }).nullable();
// A checklist step can be handed to someone (`who`) — dropped before, so the
// assignee vanished on save (acceptance test d11s8).
const subSchema = z.object({ t: z.string().max(200), done: z.boolean(), who: z.string().max(80).optional(), whoEmail: z.string().max(160).optional() });
const commentSchema = z.object({ who: z.string().max(80), body: z.string().max(2_000), when: z.string().max(40) });
const attSchema = z.object({ name: z.string().max(200) });
// A link on a task — a Google Drive/Docs/Sheets file, a Dropbox or OneDrive
// share, any web page. Web addresses only: a `javascript:` or `data:` "link"
// would run in whoever clicks it.
const urlSchema = z.object({
  url: z.string().trim().max(2000).refine((u) => { try { const x = new URL(u); return x.protocol === "https:" || x.protocol === "http:"; } catch { return false; } }, "Links must be web addresses (https://…)"),
  title: z.string().trim().max(200).optional(),
  by: z.string().max(80).optional(),
  at: z.string().max(40).optional(),
});

const taskSchema = z.object({
  t: z.string().trim().min(1).max(200),               // title
  who: z.string().max(80).optional(),                 // assignee display name ("" = unassigned)
  // The assignee's email, alongside the name. Names are not unique — two
  // people called Sarah are one assignee — and renaming someone orphans their
  // tasks. The email is the stable identity; the name is what's displayed.
  whoEmail: z.string().max(160).optional(),
  prio: z.enum(["urgent", "high", "med", "low"]).optional(),
  due: z.string().max(10).nullable().optional(),      // ISO date (yyyy-mm-dd) or null
  time: z.string().max(5).nullable().optional(),      // optional HH:MM deadline time
  status: z.enum(["backlog", "todo", "prog", "done"]).optional(),
  link: linkSchema.optional(),                        // {k,v} or null
  co: z.string().max(160).optional(),                 // freelancer: company the task is filed to
  labels: z.array(z.string().max(60)).max(20).optional(),
  subs: z.array(subSchema).max(50).optional(),
  comments: z.array(commentSchema).max(200).optional(),
  atts: z.array(attSchema).max(50).optional(),
  urls: z.array(urlSchema).max(30).optional(),
  spawn: z.boolean().optional(),                      // auto-created (P2 engine) — shows the "auto" badge
  cat: z.string().max(60).optional(),                 // custom "linked to" category
  archived: z.boolean().optional(),                   // hidden from the main views, kept in Archive
  calEventId: z.string().max(60).nullable().optional(),// id of the mirrored calendarEvents doc (if shown on the Events calendar)
  // Recurrence, on CREATE only. The series is materialised into one real task
  // per date (see below) rather than stored as a rule, so each day's task can
  // be ticked, reassigned or deleted on its own — which is what a to-do list
  // is for. `seriesId` ties them together for a future "delete the series".
  repeat: z.object({
    freq: z.enum(["daily", "weekdays", "weekly", "monthly"]),
    until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),   // inclusive end date
  }).optional(),
});
const partialSchema = taskSchema.partial();

tasks.get("/", async (req, res) => {
  const auth = req.auth!;
  const bucket = bucketOf(auth);
  if (!bucket || !canUse(auth.role)) { res.status(403).json({ error: "Requires an operator or staff account" }); return; }
  const snap = await col.where("tenantId", "==", bucket).get();
  let list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { due?: string | null; who?: string; franchiseId?: string | null })[];
  // A franchisee sees only its own board — before this it read head office's
  // internal to-dos, notes and linked entities, and could edit them.
  // NOTE: tasks created before franchiseId was stamped have none, and are
  // treated as head office's. A franchisee therefore loses sight of any legacy
  // task it created. That is the conservative direction: the alternative leaks.
  if (auth.role === "franchise" || (auth.role === "staff" && auth.franchiseId)) {
    const mine = auth.franchiseId ?? null;
    list = list.filter((t) => (t.franchiseId ?? null) === mine);
  }
  // Staff only see tasks assigned to them — or with a step assigned to them,
  // which comes flagged `subtaskOnly` (they may tick their step + comment).
  if (auth.role === "staff") {
    const me = await whoAmI(req);
    list = list.flatMap((t) => (assignedTo(req, t) ? [t] : mySubs(me, t).length ? [{ ...t, subtaskOnly: true }] : []));
  }
  list.sort((a, b) => (`${a.due ?? "9999-99"}` < `${b.due ?? "9999-99"}` ? -1 : 1));
  res.json(list);
});

// GET /api/tasks/assignees — who a task can be assigned to. For a head office
// (company with franchises) this comes back GROUPED BY FRANCHISE: each franchise
// (+ a "Head office" group for the HO's own team) with its people, so the UI can
// make the operator pick a franchise first, then a person. Non-HO operators get
// a single flat group (their own team).
tasks.get("/assignees", async (req, res) => {
  const auth = req.auth!;
  if (!bucketOf(auth) || !canUse(auth.role)) { res.status(403).json({ error: "Requires an operator account" }); return; }
  // HQ has no tenant and therefore no team directory to draw from — it assigns
  // to itself. Returning an empty flat group keeps the picker working instead
  // of 403-ing the whole panel.
  if (auth.role === "platform") {
    const nm = (req.user?.name ?? "").trim();
    const em = (req.user?.email ?? "").trim();
    res.json({ headOffice: false, groups: [{ franchiseId: null, name: "HQ", people: em || nm ? [{ name: nm, email: em }] : [] }] });
    return;
  }
  const [usersSnap, tasksSnap] = await Promise.all([
    db.collection("users").where("tenantId", "==", auth.tenantId).get(),
    col.where("tenantId", "==", auth.tenantId).get(),
  ]);
  const nameOf = (u: Record<string, unknown>) => ((u.name as string) || ((u.email as string) || "").split("@")[0] || "").trim();
  // Franchises in this tenant, keyed by franchiseId, with a display name.
  const franchises = new Map<string, { franchiseId: string; name: string }>();
  for (const d of usersSnap.docs) {
    const u = d.data();
    if (u.role === "franchise") {
      const fid = (u.franchiseId as string) || d.id;
      if (!franchises.has(fid)) franchises.set(fid, { franchiseId: fid, name: (u.franchiseName as string) || "Franchise" });
    }
  }
  // People buckets: one per franchiseId + "__ho__" for the head office's own team.
  // Keyed by email where there is one, so the same person can't appear twice.
  const buckets = new Map<string, Map<string, { name: string; email: string }>>();
  const add = (key: string, name: string, email: string) => {
    if (!name && !email) return;
    if (!buckets.has(key)) buckets.set(key, new Map());
    buckets.get(key)!.set((email || name).toLowerCase(), { name, email });
  };
  for (const d of usersSnap.docs) {
    const u = d.data();
    if (u.role === "parent" || u.role === "platform") continue;      // never assign to a parent
    const fid = (u.franchiseId as string) || null;
    add(fid && franchises.has(fid) ? fid : "__ho__", nameOf(u), ((u.email as string) || "").trim());
  }
  // Fold in any names already used on existing tasks (free-typed), into HO-own so
  // they never disappear from the picker.
  for (const d of tasksSnap.docs) {
    const t = d.data();
    const w = String(t.who ?? "").trim();
    if (w) add("__ho__", w, String(t.whoEmail ?? "").trim());
  }

  const sortPeople = (m?: Map<string, { name: string; email: string }>) =>
    [...(m?.values() ?? [])].sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
  const isHeadOffice = auth.role === "company" && franchises.size > 0;
  if (!isHeadOffice) {
    // Flat team = everyone we found (any bucket), sorted & de-duped.
    const flat = [...new Map([...buckets.values()].flatMap((m) => [...m])).values()]
      .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
    res.json({ headOffice: false, groups: [{ franchiseId: null, name: "Team", people: flat }] });
    return;
  }
  const groups = [
    { franchiseId: null as string | null, name: "Head office", people: sortPeople(buckets.get("__ho__")) },
    ...[...franchises.values()].map((f) => ({ franchiseId: f.franchiseId, name: f.name, people: sortPeople(buckets.get(f.franchiseId)) })),
  ];
  res.json({ headOffice: true, groups });
});

/** The dates a repeat covers, from `start` to `until` inclusive. Parsed as UTC
 *  and stepped by whole days — the local timezone would drop or duplicate a
 *  date across the October clock change. Capped at a year of dailies. */
const REPEAT_MAX = 366;
function repeatDates(start: string, until: string, freq: string): string[] {
  const dates: string[] = [];
  const d = new Date(`${start}T00:00:00Z`);
  const end = new Date(`${until}T00:00:00Z`);
  while (d <= end && dates.length < REPEAT_MAX) {
    const day = d.getUTCDay();
    if (freq !== "weekdays" || (day !== 0 && day !== 6)) dates.push(d.toISOString().slice(0, 10));
    if (freq === "weekly") d.setUTCDate(d.getUTCDate() + 7);
    else if (freq === "monthly") d.setUTCMonth(d.getUTCMonth() + 1);
    else d.setUTCDate(d.getUTCDate() + 1);
  }
  return dates;
}

tasks.post("/", async (req, res) => {
  const auth = req.auth!;
  if (!bucketOf(auth) || !canUse(auth.role)) { res.status(403).json({ error: "Requires an operator or staff account" }); return; }
  const parsed = taskSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const doc = {
    status: "todo", prio: "med", labels: [], subs: [], comments: [], atts: [], spawn: false, link: null, who: "", due: null,
    ...parsed.data,
    tenantId: bucketOf(auth), createdBy: req.user?.email ?? "unknown", createdByName: req.user?.name ?? req.user?.email ?? "Staff", createdAt: new Date().toISOString(),
    // Which network this task belongs to. Head office and freelancers write
    // null; a franchisee's tasks are pinned to it so the GET can scope them.
    franchiseId: auth.role === "franchise" ? (auth.franchiseId ?? null) : null,
  };
  const { repeat, ...base } = doc as typeof doc & { repeat?: { freq: string; until: string } };

  if (!repeat) {
    const ref = await col.add(base);
    res.status(201).json({ id: ref.id, ...base });
    return;
  }

  // ── Recurrence ──────────────────────────────────────────────────────────
  // Needs a start: the task's own due date, or today if it has none.
  const start = (base.due as string | null) || new Date().toISOString().slice(0, 10);
  if (repeat.until < start) { res.status(400).json({ error: "The repeat end date is before the start date" }); return; }

  const dates = repeatDates(start, repeat.until, repeat.freq);
  if (!dates.length) { res.status(400).json({ error: "That repeat produces no dates" }); return; }

  const seriesId = col.doc().id;
  // Firestore caps a batch at 500 writes; MAX keeps us inside one batch.
  const batch = db.batch();
  const first = { ...base, due: dates[0], seriesId, seriesFreq: repeat.freq, seriesFrom: dates[0], seriesUntil: repeat.until };
  const firstRef = col.doc();
  batch.set(firstRef, first);
  for (const due of dates.slice(1)) {
    batch.set(col.doc(), { ...base, due, seriesId, seriesFreq: repeat.freq, seriesFrom: dates[0], seriesUntil: repeat.until });
  }
  await batch.commit();
  res.status(201).json({ id: firstRef.id, ...first, created: dates.length });
});

// PUT /api/tasks/series/:seriesId — apply one edit to every date in the repeat,
// for "you changed the 9am reconciliation to 10am — do all of them".
// Per-occurrence fields are stripped rather than rejected: `due` is the whole
// reason each date is its own task, `calEventId` points at THAT date's calendar
// event, and status/subs/comments/archived describe how one day went. Sending
// those across the series would flatten every date into the same day.
const PER_OCCURRENCE = new Set(["due", "calEventId", "status", "subs", "comments", "atts", "archived", "repeat"]);
tasks.put("/series/:seriesId", async (req, res) => {
  const auth = req.auth!;
  const bucket = bucketOf(auth);
  if (!bucket || !canUse(auth.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const parsed = partialSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const fields = Object.fromEntries(Object.entries(parsed.data).filter(([k]) => !PER_OCCURRENCE.has(k)));
  if (!Object.keys(fields).length) { res.status(400).json({ error: "Nothing in that change applies to a whole repeat" }); return; }
  const snap = await col.where("tenantId", "==", bucket).where("seriesId", "==", req.params.seriesId).get();
  if (snap.empty) { res.status(404).json({ error: "Series not found" }); return; }
  // Same write rules as a single task: a franchisee only touches its own, and
  // staff only what's assigned to them — enforced across EVERY date, so an edit
  // can't reach dates the caller couldn't have opened.
  if (auth.role === "franchise" && snap.docs.some((d) => ((d.data().franchiseId as string | null) ?? null) !== (auth.franchiseId ?? null))) {
    res.status(404).json({ error: "Series not found" }); return;
  }
  if (auth.role === "staff" && snap.docs.some((d) => !assignedTo(req, d.data()))) {
    res.status(404).json({ error: "Series not found" }); return;
  }
  const batch = db.batch();
  snap.docs.forEach((d) => batch.set(d.ref, fields, { merge: true }));
  await batch.commit();
  res.json({ ok: true, updated: snap.size });
});

// PUT /api/tasks/series/:seriesId/range — change when a repeat starts, ends
// or how often it runs. Dates the new range drops are removed — unless they're
// done or archived, which are kept as the record of what happened; dates it
// adds are made from the repeat's own details (fresh: to do, subtasks unticked,
// no comments). Dates in both are left exactly as they are.
const rangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  freq: z.enum(["daily", "weekdays", "weekly", "monthly"]).optional(),
});
tasks.put("/series/:seriesId/range", async (req, res) => {
  const auth = req.auth!;
  const bucket = bucketOf(auth);
  if (!bucket || !canUse(auth.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const parsed = rangeSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const { from, until } = parsed.data;
  if (until < from) { res.status(400).json({ error: "The end date is before the start date" }); return; }
  const snap = await col.where("tenantId", "==", bucket).where("seriesId", "==", req.params.seriesId).get();
  if (snap.empty) { res.status(404).json({ error: "Series not found" }); return; }
  if (auth.role === "franchise" && snap.docs.some((d) => ((d.data().franchiseId as string | null) ?? null) !== (auth.franchiseId ?? null))) {
    res.status(404).json({ error: "Series not found" }); return;
  }
  if (auth.role === "staff" && snap.docs.some((d) => !assignedTo(req, d.data()))) {
    res.status(404).json({ error: "Series not found" }); return;
  }
  const freq = parsed.data.freq ?? String(snap.docs[0].get("seriesFreq") ?? "daily");
  const dates = repeatDates(from, until, freq);
  if (!dates.length) { res.status(400).json({ error: "Those dates don't include any day this repeat runs on" }); return; }
  if (dates.length >= REPEAT_MAX) { res.status(400).json({ error: "That's more than a year of dates — shorten the range" }); return; }
  const want = new Set(dates);
  const byDue = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  for (const d of snap.docs) { const due = String(d.get("due") ?? ""); if (!byDue.has(due)) byDue.set(due, d); }
  const kept = (d: FirebaseFirestore.QueryDocumentSnapshot) => d.get("status") === "done" || d.get("archived") === true;
  // Template for new dates: the latest open occurrence (its edits are the
  // current ones), else any.
  const open = snap.docs.filter((d) => !kept(d)).sort((a, b) => String(b.get("due") ?? "").localeCompare(String(a.get("due") ?? "")));
  const tpl = (open[0] ?? snap.docs[0]).data();
  const { due: _due, calEventId: _cal, status: _st, comments: _c, atts: _a, archived: _ar, createdAt: _ca, ...base } = tpl;
  const subs = Array.isArray(tpl.subs) ? (tpl.subs as { t: string; who?: string }[]).map((x) => ({ ...x, done: false })) : [];
  const ops: ((b: FirebaseFirestore.WriteBatch) => void)[] = [];
  let removed = 0, keptDone = 0, created = 0;
  for (const d of snap.docs) {
    const due = String(d.get("due") ?? "");
    if (want.has(due) && byDue.get(due)?.id === d.id) {
      ops.push((b) => b.set(d.ref, { seriesFreq: freq, seriesFrom: from, seriesUntil: until }, { merge: true }));
    } else if (kept(d)) {
      keptDone++;
      ops.push((b) => b.set(d.ref, { seriesFreq: freq, seriesFrom: from, seriesUntil: until }, { merge: true }));
    } else {
      removed++;
      ops.push((b) => b.delete(d.ref));
      const cal = d.get("calEventId") as string | null | undefined;
      if (cal) ops.push((b) => b.delete(db.collection("calendarEvents").doc(cal)));
    }
  }
  const now = new Date().toISOString();
  for (const due of dates) {
    if (byDue.has(due)) continue;
    created++;
    ops.push((b) => b.set(col.doc(), { ...base, subs, due, status: "todo", comments: [], atts: [], archived: false, calEventId: null, seriesFreq: freq, seriesFrom: from, seriesUntil: until, createdAt: now }));
  }
  for (let i = 0; i < ops.length; i += 450) {
    const batch = db.batch();
    for (const op of ops.slice(i, i + 450)) op(batch);
    await batch.commit();
  }
  res.json({ ok: true, created, removed, keptDone, dates: dates.length });
});

// DELETE /api/tasks/series/:seriesId — remove the whole repeat, not one date.
tasks.delete("/series/:seriesId", async (req, res) => {
  const auth = req.auth!;
  const bucket = bucketOf(auth);
  if (!bucket || !canUse(auth.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const snap = await col.where("tenantId", "==", bucket).where("seriesId", "==", req.params.seriesId).get();
  if (snap.empty) { res.status(404).json({ error: "Series not found" }); return; }
  // A franchisee may only delete its own series — same rule as a single task.
  if (auth.role === "franchise" && snap.docs.some((d) => ((d.data().franchiseId as string | null) ?? null) !== (auth.franchiseId ?? null))) {
    res.status(404).json({ error: "Series not found" }); return;
  }
  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  res.json({ ok: true, deleted: snap.size });
});

async function ownTask(req: Request, id: string) {
  const auth = req.auth!;
  const bucket = bucketOf(auth);
  if (!bucket || !canUse(auth.role)) return { status: 403 as const };
  const snap = await col.doc(id).get();
  if (!snap.exists || snap.data()!.tenantId !== bucket) return { status: 404 as const };
  // Reads are scoped in the GET; writes need the same rule or a franchisee
  // could still PUT/DELETE head office's tasks by id.
  if (auth.role === "franchise" && ((snap.data()!.franchiseId as string | null) ?? null) !== (auth.franchiseId ?? null)) {
    return { status: 404 as const };
  }
  // Staff can only SEE their own tasks (the GET filters), but nothing stopped
  // them PUTting or DELETEing anyone's by id — a coach could quietly delete the
  // manager's board. Writes now follow the same rule as reads.
  if (auth.role === "staff" && !assignedTo(req, snap.data()!)) {
    // Given a step on someone else's task: their steps + comments only.
    const mine = mySubs(await whoAmI(req), snap.data()!);
    return mine.length ? { status: 200 as const, snap, stepsOnly: mine } : { status: 404 as const };
  }
  return { status: 200 as const, snap, stepsOnly: null };
}

/** A step-only assignee's save: tick/untick their own step(s), append comments.
 *  Everything else in the body must match what's stored — anything they
 *  mustn't change is refused, and a copy that has gone stale gets a 409. */
type Sub = z.infer<typeof subSchema>;
type Comment = z.infer<typeof commentSchema>;
class StepRefused extends Error { constructor(public status: number, msg: string) { super(msg); } }
const sameSub = (a: Sub, b: Sub) => a.t === b.t && (a.who ?? "") === (b.who ?? "") && (a.whoEmail ?? "") === (b.whoEmail ?? "");
async function saveOwnSteps(req: Request, ref: FirebaseFirestore.DocumentReference, mine: number[], body: z.infer<typeof partialSchema>) {
  const extra = Object.keys(body).filter((k) => k !== "subs" && k !== "comments");
  if (extra.length) throw new StepRefused(403, "You've been given a step on this task — you can tick your own step or add a comment, but not change the task itself.");
  const author = String(req.user?.name ?? "").trim() || String((await db.collection("users").doc(req.user!.uid).get()).get("name") ?? "").trim() || req.user?.email || "Staff";
  return db.runTransaction(async (tx) => {
    const cur = (await tx.get(ref)).data() as { subs?: Sub[]; comments?: Comment[] } | undefined;
    if (!cur) throw new StepRefused(404, "Task not found");
    const patch: { subs?: Sub[]; comments?: Comment[] } = {};
    if (body.subs) {
      const stored = cur.subs ?? [];
      const changed = "This task has changed since you opened it — it's been refreshed; tick your step again.";
      if (body.subs.length !== stored.length) throw new StepRefused(409, changed);
      body.subs.forEach((s, i) => {
        if (!sameSub(s, stored[i])) throw new StepRefused(mine.includes(i) ? 403 : 409, mine.includes(i) ? "You can tick or untick your step, but not rename or reassign it." : changed);
        if (s.done !== stored[i].done && !mine.includes(i)) throw new StepRefused(403, "That step is someone else's — you can only tick your own.");
      });
      patch.subs = stored.map((s, i) => (mine.includes(i) ? { ...s, done: body.subs![i].done } : s));
    }
    if (body.comments) {
      const stored = cur.comments ?? [];
      const prefixOk = body.comments.length >= stored.length && stored.every((c, i) => JSON.stringify(c) === JSON.stringify(body.comments![i]));
      if (!prefixOk) throw new StepRefused(409, "The comments have changed since you opened this task — it's been refreshed; add yours again.");
      const added = body.comments.slice(stored.length);
      if (added.length > 5) throw new StepRefused(400, "Add one comment at a time.");
      // Stamped with who actually wrote it — a step-only assignee can't post as someone else.
      patch.comments = [...stored, ...added.map((c) => ({ ...c, who: author }))];
    }
    if (Object.keys(patch).length) tx.set(ref, patch, { merge: true });
  });
}

tasks.put("/:id", async (req, res) => {
  const own = await ownTask(req, req.params.id);
  if (own.status !== 200) { res.status(own.status).json({ error: own.status === 403 ? "Forbidden" : "Task not found" }); return; }
  const parsed = partialSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  if (own.stepsOnly) {
    try { await saveOwnSteps(req, own.snap.ref, own.stepsOnly, parsed.data); }
    catch (e) { if (e instanceof StepRefused) { res.status(e.status).json({ error: e.message }); return; } throw e; }
    const after = await own.snap.ref.get();
    res.json({ id: after.id, ...after.data(), subtaskOnly: true });
    return;
  }
  await own.snap.ref.set(parsed.data, { merge: true });
  const after = await own.snap.ref.get();
  res.json({ id: after.id, ...after.data() });
});

tasks.delete("/:id", async (req, res) => {
  // Deleting a task someone assigned you isn't "done", it's "gone" — and the
  // person who asked for it loses the record that they ever did. Staff mark it
  // complete or comment; operators delete.
  if (req.auth!.role === "staff") {
    res.status(403).json({ error: "Only an operator can delete a task. Mark it complete instead." });
    return;
  }
  const own = await ownTask(req, req.params.id);
  if (own.status !== 200) { res.status(own.status).json({ error: own.status === 403 ? "Forbidden" : "Task not found" }); return; }
  await own.snap.ref.delete();
  res.json({ ok: true });
});
