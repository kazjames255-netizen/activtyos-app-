import { Router } from "express";
import { z } from "zod";
import { db } from "../firebase";
import type { Role } from "../middleware/role";
import { notifyTenantMember } from "../lib/notify";
import { ukToday } from "../lib/ukDate";

// Staff announcements — the internal notice board (managers post, staff read).
//
// Until 12 Sept this was the posting browser's localStorage: the composer said
// "Sent to … — it's on their Announcements board now" and no member of staff
// ever saw it, while every staff board showed three made-up seed notices.
//
// Scope: a head-office / freelancer post (franchiseId null) reaches everyone in
// the tenant; a franchise's post reaches only that franchise's staff. Posting
// bells each staff member in scope (and emails them when marked important).
// Read receipts are per person.

export const staffAnnouncements = Router();
const col = db.collection("staffAnnouncements");
const canPost = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";
const canRead = (role: Role) => role === "staff" || canPost(role);
const readKey = (email: string) => email.trim().toLowerCase().replace(/\./g, ",");

const postSchema = z.object({
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(5_000),
  author: z.string().trim().max(120).optional(),
  role: z.string().trim().max(80).optional(),
  audienceLabel: z.string().trim().max(160).optional(),
  pinned: z.boolean().optional(),
  important: z.boolean().optional(),
  // Head office can aim a post at ONE franchise's team.
  franchiseId: z.string().trim().max(80).optional(),
});

/** Visible to this account: its franchise's posts, plus the whole-tenant ones. */
function visible(auth: { role: Role; franchiseId: string | null }, a: { franchiseId?: string | null }): boolean {
  if (auth.role === "company" || auth.role === "freelancer") return true;
  return !a.franchiseId || a.franchiseId === auth.franchiseId;
}

// GET /api/staff-announcements — newest first, with `read` for the caller.
staffAnnouncements.get("/", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canRead(auth.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const me = readKey(req.user?.email ?? req.user?.uid ?? "");
  const snap = await col.where("tenantId", "==", auth.tenantId).get();
  const list = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }) as Record<string, unknown> & { id: string; createdAt?: string; franchiseId?: string | null; readBy?: Record<string, string> })
    .filter((a) => visible(auth, a))
    .sort((a, b) => (`${b.createdAt}` < `${a.createdAt}` ? -1 : 1))
    .map(({ readBy, ...a }) => ({
      ...a,
      read: !!readBy?.[me],
      // Managers see how many have read it; staff don't see each other.
      ...(canPost(auth.role) ? { readCount: Object.keys(readBy ?? {}).length } : {}),
    }));
  res.json(list);
});

// POST /api/staff-announcements — post to the board and tell the team.
staffAnnouncements.post("/", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canPost(auth.role)) { res.status(403).json({ error: "Only a manager can post to the staff board" }); return; }
  const parsed = postSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const now = new Date();
  const doc = {
    ...parsed.data,
    author: parsed.data.author || req.user?.name || req.user?.email || "Manager",
    role: parsed.data.role || "Manager",
    date: ukToday(now),
    tenantId: auth.tenantId,
    franchiseId: auth.role === "franchise" ? auth.franchiseId : auth.role === "company" && parsed.data.franchiseId ? parsed.data.franchiseId : null,
    createdAt: now.toISOString(),
    createdBy: req.user?.email ?? req.user?.uid ?? null,
    readBy: {},
  };
  const ref = await col.add(doc);
  res.status(201).json({ id: ref.id, ...doc, read: false });

  // Bell every staff member in scope; email them too when it's important.
  void (async () => {
    const staff = await db.collection("users").where("tenantId", "==", auth.tenantId).where("role", "==", "staff").get();
    for (const u of staff.docs) {
      const email = u.get("email") as string | undefined;
      if (!email || u.get("disabled") === true) continue;
      if (doc.franchiseId && u.get("franchiseId") !== doc.franchiseId) continue;
      await notifyTenantMember(auth.tenantId!, email, {
        category: "task",
        title: `${doc.important ? "⚠ " : ""}${doc.title}`,
        body: doc.body.length > 200 ? `${doc.body.slice(0, 197)}…` : doc.body,
        href: "/staff/announcements",
        ref: ref.id,
        sendEmail: !!doc.important,
      });
    }
  })().catch((e) => console.error("[staff-announcements] notify:", (e as Error).message));
});

// POST /api/staff-announcements/:id/read — I've read it.
staffAnnouncements.post("/:id/read", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canRead(auth.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const snap = await col.doc(req.params.id).get();
  if (!snap.exists || snap.get("tenantId") !== auth.tenantId || !visible(auth, snap.data() as { franchiseId?: string | null })) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const me = readKey(req.user?.email ?? req.user?.uid ?? "");
  await snap.ref.update({ [`readBy.${me}`]: new Date().toISOString() });
  res.json({ ok: true });
});

// DELETE /api/staff-announcements/:id — take a post down (managers).
staffAnnouncements.delete("/:id", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId || !canPost(auth.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  const snap = await col.doc(req.params.id).get();
  if (!snap.exists || snap.get("tenantId") !== auth.tenantId) { res.status(404).json({ error: "Not found" }); return; }
  if (auth.role === "franchise" && snap.get("franchiseId") !== auth.franchiseId) { res.status(404).json({ error: "Not found" }); return; }
  await snap.ref.delete();
  res.json({ ok: true });
});
