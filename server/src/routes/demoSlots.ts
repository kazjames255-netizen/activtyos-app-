import { Router } from "express";
import { z } from "zod";
import { db } from "../firebase";
import { addDays, ukToday } from "../lib/ukDate";

// "Book a demo" call slots — a weekly recurring template HQ manages (turn a
// day/time on or off, add more), computed out into real bookable instances
// for the next 7 days on the public /demo page. One booking per instance
// (it's a 1-on-1 call): once a lead has claimed a slot, it drops off the
// public list.
//
// demoSlotTemplates: { weekday: 0 (Sun) – 6 (Sat), time: "HH:MM" (24h, UK
// local), durationMins, active, createdAt }. The instances themselves are
// NOT stored — they're derived fresh from active templates each read, so
// turning a template off immediately clears its future slots without a
// cleanup job.

export const demoSlotsPublic = Router();
export const demoSlotTemplates = Router();
export const demoSlotBlackouts = Router();

const col = db.collection("demoSlotTemplates");
const blackoutCol = db.collection("demoSlotBlackouts");
const leadsCol = db.collection("leads");

const templateSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24h HH:MM"),
  durationMins: z.number().int().min(10).max(240).optional().default(30),
  active: z.boolean().optional().default(true),
});

// A quick "I'm not available" override — one date, or a range — that blocks
// out slots the weekly template would otherwise offer, without touching the
// template itself (so normal availability resumes automatically after).
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const blackoutSchema = z.object({
  from: z.string().regex(DATE_RE, "Use YYYY-MM-DD"),
  to: z.string().regex(DATE_RE, "Use YYYY-MM-DD"),
  note: z.string().trim().max(160).optional().default(""),
}).refine((v) => v.from <= v.to, { message: "'from' must not be after 'to'" });

/** A UK wall-clock date+time (BST/GMT-aware) as a UTC Date. */
function ukWallTimeToUtc(dateStr: string, timeStr: string): Date {
  const guess = new Date(`${dateStr}T${timeStr}:00Z`);
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
  const p = fmt.formatToParts(guess).reduce((a, x) => { a[x.type] = x.value; return a; }, {} as Record<string, string>);
  const ukAsUtc = new Date(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`);
  return new Date(guess.getTime() + (guess.getTime() - ukAsUtc.getTime()));
}

// GET /api/demo-slots — public. Every open instance over the next 7 days
// from active templates, minus blacked-out dates and ones a lead already holds.
demoSlotsPublic.get("/", async (_req, res) => {
  const [tmplSnap, blackoutSnap] = await Promise.all([
    col.where("active", "==", true).get(),
    blackoutCol.get(),
  ]);
  const templates = tmplSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as
    { id: string; weekday: number; time: string; durationMins: number }[];
  const blackouts = blackoutSnap.docs.map((d) => d.data() as { from: string; to: string });
  const isBlacked = (dateStr: string) => blackouts.some((b) => dateStr >= b.from && dateStr <= b.to);
  if (!templates.length) { res.json([]); return; }

  const now = new Date();
  const minLeadMs = 2 * 60 * 60 * 1000; // at least 2 hours' notice
  const candidates: { iso: string; durationMins: number }[] = [];
  for (let i = 0; i < 8; i++) {
    const dateStr = addDays(ukToday(now), i);
    if (isBlacked(dateStr)) continue;
    const weekday = new Date(`${dateStr}T12:00:00Z`).getUTCDay();
    for (const t of templates) {
      if (t.weekday !== weekday) continue;
      const at = ukWallTimeToUtc(dateStr, t.time);
      if (at.getTime() - now.getTime() < minLeadMs) continue;
      candidates.push({ iso: at.toISOString(), durationMins: t.durationMins ?? 30 });
    }
  }
  if (!candidates.length) { res.json([]); return; }
  candidates.sort((a, b) => (a.iso < b.iso ? -1 : 1));

  // Drop any instance someone's already booked (a lead's chosen `slotAt`
  // matches it exactly). ISO-8601 UTC strings sort lexicographically, so a
  // plain range covers the whole window in one read.
  const from = candidates[0].iso, to = candidates[candidates.length - 1].iso;
  const booked = new Set(
    (await leadsCol.where("slotAt", ">=", from).where("slotAt", "<=", to).get()).docs
      .map((d) => d.get("slotAt") as string),
  );
  res.json(candidates.filter((c) => !booked.has(c.iso)));
});

// Everything below is HQ-only (platform role).
demoSlotTemplates.use((req, res, next) => {
  if (req.auth!.role !== "platform") { res.status(403).json({ error: "Requires the platform role" }); return; }
  next();
});

demoSlotTemplates.get("/", async (_req, res) => {
  const snap = await col.orderBy("weekday").get();
  res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
});

demoSlotTemplates.post("/", async (req, res) => {
  const parsed = templateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const ref = await col.add({ ...parsed.data, createdAt: new Date().toISOString() });
  res.json({ id: ref.id });
});

demoSlotTemplates.patch("/:id", async (req, res) => {
  const parsed = templateSchema.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  await col.doc(req.params.id).set(parsed.data, { merge: true });
  res.json({ ok: true });
});

demoSlotTemplates.delete("/:id", async (req, res) => {
  await col.doc(req.params.id).delete();
  res.json({ ok: true });
});

demoSlotBlackouts.use((req, res, next) => {
  if (req.auth!.role !== "platform") { res.status(403).json({ error: "Requires the platform role" }); return; }
  next();
});

demoSlotBlackouts.get("/", async (_req, res) => {
  const snap = await blackoutCol.orderBy("from").get();
  res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
});

demoSlotBlackouts.post("/", async (req, res) => {
  const parsed = blackoutSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const ref = await blackoutCol.add({ ...parsed.data, createdAt: new Date().toISOString() });
  res.json({ id: ref.id });
});

demoSlotBlackouts.delete("/:id", async (req, res) => {
  await blackoutCol.doc(req.params.id).delete();
  res.json({ ok: true });
});
