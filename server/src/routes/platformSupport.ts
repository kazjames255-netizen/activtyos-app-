// HQ Support & messages inbox (see docs/support-inbox-handoff.md).
//
// Two routers live here:
//   platformSupport — mounted at /api/platform/support, platform-role only:
//                     the HQ side (list threads, start one, reply, resolve).
//   supportReport   — mounted at /api/support/report, any signed-in account:
//                     the in-app "Report a bug" intake that opens a bug thread.
//
// Threads live in supportThreads/{id} with messages EMBEDDED as an array —
// a support conversation is a handful of messages, read and written as one
// unit, so a subcollection would only buy extra round-trips.

import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "../firebase";
import { notify } from "../lib/notify";

type Tier = "freelancer" | "company" | "franchise";

export interface Msg {
  id: string;
  from: "hq" | "them";
  body: string;
  at: string;
  // "Message ActivityOS" carries a per-message topic + subject (the provider
  // picks one each time); HQ replies leave them blank.
  topic?: string;
  subject?: string;
}

export interface ThreadDoc {
  party: "provider" | "customer";
  name: string;
  email: string;
  tier: Tier;
  providerId: string | null;
  // Which franchise (within a company tenant) this thread belongs to — franchises
  // share their head office's tenantId, so this keeps each franchise's support
  // separate. null for freelancers / a company's own (non-franchise) threads.
  franchiseId?: string | null;
  providerName: string;
  subject: string;
  // Human-friendly reference for search + reference in conversation: BUG-0001 / MSG-0001.
  ticket?: string;
  kind: "message" | "bug";
  // HQ triage: what it's ABOUT (a category id) — separate from status. A bug
  // report auto-tags "bug"; a plain message starts "" until HQ categorises it.
  category?: string;
  report?: { channel: string; page: string; severity: "low" | "medium" | "high"; device: string; steps: string };
  // Workflow lifecycle (separate from category). Older threads only had open/resolved.
  status: "open" | "in_progress" | "resolved";
  resolvedAt?: string | null;
  // HQ-only internal notes (root cause, "dup of…", "fixed in v1.3"). Never shown to the provider.
  notes?: ThreadNote[];
  // Manual duplicate-linking: the canonical thread this one duplicates (for trend counts).
  duplicateOf?: string | null;
  unreadByHq: boolean;
  // Set when HQ sends the provider/customer a message or update they haven't read
  // yet — drives the provider's Support badge (cleared when they open the chat).
  unreadByUser?: boolean;
  messages: Msg[];
  createdAt: string;
  updatedAt: string;
}
export interface ThreadNote { id: string; at: string; byUid: string; byEmail: string | null; text: string }

// The starter categories HQ triages with — editable (stored in platformConfig/support).
export const DEFAULT_SUPPORT_CATEGORIES = [
  { id: "bug", label: "Bug", emoji: "🐞" },
  { id: "billing", label: "Billing & payments", emoji: "💳" },
  { id: "feature", label: "Feature request", emoji: "✨" },
  { id: "howto", label: "How-to / question", emoji: "❓" },
  { id: "complaint", label: "Complaint", emoji: "😟" },
  { id: "onboarding", label: "Onboarding", emoji: "🚀" },
  { id: "account", label: "Account / login", emoji: "🔑" },
  { id: "other", label: "Other", emoji: "📋" },
];

const nowIso = () => new Date().toISOString();
const msg = (from: Msg["from"], body: string): Msg => ({ id: randomUUID(), from, body, at: nowIso() });

// Sequential, human-friendly ticket refs (BUG-0001, MSG-0001) from an atomic
// counter — so every thread has a stable code to search and quote.
export async function nextTicket(kind: "bug" | "message"): Promise<string> {
  const ref = db.collection("platformConfig").doc("counters");
  const field = kind === "bug" ? "bugSeq" : "msgSeq";
  const n = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const cur = (snap.exists ? (snap.get(field) as number | undefined) : 0) ?? 0;
    tx.set(ref, { [field]: cur + 1 }, { merge: true });
    return cur + 1;
  });
  return `${kind === "bug" ? "BUG" : "MSG"}-${String(n).padStart(4, "0")}`;
}

// A tenant's tier the way the HQ inbox shows it: the franchise plan wins,
// otherwise the tenant type (anything unexpected counts as a company).
export async function tenantTier(providerId: string): Promise<{ tier: Tier; providerName: string } | null> {
  const snap = await db.collection("tenants").doc(providerId).get();
  if (!snap.exists) return null;
  const t = snap.data()!;
  const plan = (t.subscription as Record<string, unknown> | undefined)?.plan;
  const tier: Tier = plan === "franchise" ? "franchise" : t.type === "freelancer" ? "freelancer" : "company";
  return { tier, providerName: (t.name as string) ?? providerId };
}

// A franchise's own business name + area (e.g. "APF Activity Camps · London"),
// so its support threads read as the franchisee, not the head-office tenant they
// share. Returns null if the franchise record can't be found.
export async function franchiseLabel(tenantId: string, franchiseId: string): Promise<string | null> {
  const snap = await db.collection("users").where("tenantId", "==", tenantId).where("role", "==", "franchise").where("franchiseId", "==", franchiseId).limit(1).get();
  if (snap.empty) return null;
  const u = snap.docs[0].data() as { franchiseName?: string; franchiseArea?: string; name?: string };
  const nm = (u.franchiseName || u.name || "").trim();
  if (!nm) return null;
  return u.franchiseArea?.trim() ? `${nm} · ${u.franchiseArea.trim()}` : nm;
}

// ── The HQ side (platform-role only) ────────────────────────────────────────

export const platformSupport = Router();

platformSupport.use((req, res, next) => {
  if (req.auth!.role !== "platform") {
    res.status(403).json({ error: "Requires the platform role" });
    return;
  }
  next();
});

// GET / — every thread, messages embedded, newest activity first.
platformSupport.get("/", async (_req, res) => {
  const snap = await db.collection("supportThreads").get();
  let threads = snap.docs.map((d) => ({ id: d.id, ...(d.data() as ThreadDoc) }));
  // Backfill: any pre-ticket thread gets a ref the first time HQ loads the inbox
  // (oldest first so the numbering follows chronology).
  const missing = threads.filter((t) => !t.ticket).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  for (const t of missing) {
    const ticket = await nextTicket(t.kind === "bug" ? "bug" : "message");
    await db.collection("supportThreads").doc(t.id).update({ ticket });
    t.ticket = ticket;
  }
  threads = threads.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  res.json({ threads });
});

// POST / — HQ starts a conversation (with a provider, or with a provider's
// customer). Tier and provider name are resolved server-side from the tenant.
const createSchema = z.object({
  party: z.enum(["provider", "customer"]),
  providerId: z.string().min(1).max(100).optional(),
  name: z.string().min(1).max(200),
  email: z.string().max(200),
  subject: z.string().min(1).max(300),
  body: z.string().min(1).max(5000),
});
platformSupport.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const { party, providerId, name, email, subject, body } = parsed.data;

  let tier: Tier = "company";
  let providerName = "";
  if (providerId) {
    const t = await tenantTier(providerId);
    if (!t) {
      res.status(404).json({ error: "No such provider" });
      return;
    }
    tier = t.tier;
    providerName = t.providerName;
  }

  const at = nowIso();
  const doc: ThreadDoc = {
    party,
    name,
    email,
    tier,
    providerId: providerId ?? null,
    providerName,
    subject,
    ticket: await nextTicket("message"),
    kind: "message",
    status: "open",
    unreadByHq: false,
    messages: [msg("hq", body)],
    createdAt: at,
    updatedAt: at,
  };
  const ref = await db.collection("supportThreads").add(doc);
  res.status(201).json({ id: ref.id, ...doc });
});

// POST /:id/messages — HQ replies. Replying reopens a resolved thread.
const replySchema = z.object({ body: z.string().min(1).max(5000) });
platformSupport.post("/:id/messages", async (req, res) => {
  const parsed = replySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const ref = db.collection("supportThreads").doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) {
    res.status(404).json({ error: "No such thread" });
    return;
  }
  const t = snap.data() as ThreadDoc;
  const m = msg("hq", parsed.data.body);
  await ref.update({
    messages: [...(t.messages ?? []), m],
    status: "open",
    unreadByHq: false,
    unreadByUser: true,   // the provider/customer now has an unread reply
    updatedAt: m.at,
  });
  // Nudge the recipient: ring their in-app bell (and email) so they actually
  // know HQ has replied / updated their bug — otherwise it sits unseen.
  const preview = parsed.data.body.length > 140 ? parsed.data.body.slice(0, 137) + "…" : parsed.data.body;
  try {
    if (t.party === "provider" && t.providerId) {
      await notify({ tenantId: t.providerId, to: { kind: "tenant" }, category: "message", title: "Reply from ActivityOS support", body: preview, href: "/freelancer/support", subject: "ActivityOS support replied" });
    } else if (t.party === "customer" && t.providerId && t.email) {
      await notify({ tenantId: t.providerId, to: { kind: "parent", email: t.email }, category: "message", title: "Reply from ActivityOS support", body: preview, href: "/custdash/activityos", subject: "ActivityOS support replied" });
    }
  } catch (e) { console.error("[support] notify failed", e); }
  res.json({ ok: true, message: m });
});

// ── Categories config (HQ-editable). Defined BEFORE /:id so the param route
// can't swallow "/categories". ──
const CFG_REF = () => db.collection("platformConfig").doc("support");
platformSupport.get("/categories", async (_req, res) => {
  const snap = await CFG_REF().get();
  const cats = snap.exists ? (snap.data()!.categories as unknown[]) : null;
  res.json({ categories: cats?.length ? cats : DEFAULT_SUPPORT_CATEGORIES });
});
const catsSchema = z.object({ categories: z.array(z.object({ id: z.string().min(1).max(40), label: z.string().min(1).max(60), emoji: z.string().max(8).optional() })).max(40) });
platformSupport.put("/categories", async (req, res) => {
  const parsed = catsSchema.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  await CFG_REF().set({ categories: parsed.data.categories }, { merge: true });
  res.json({ ok: true, categories: parsed.data.categories });
});

// PUT /:id — triage: status, category, duplicate link, mark read. Any subset.
const patchSchema = z.object({
  status: z.enum(["open", "in_progress", "resolved"]).optional(),
  category: z.string().max(40).optional(),
  duplicateOf: z.string().max(120).nullable().optional(),
  read: z.literal(true).optional(),
});
platformSupport.put("/:id", async (req, res) => {
  const parsed = patchSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const ref = db.collection("supportThreads").doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) {
    res.status(404).json({ error: "No such thread" });
    return;
  }
  const patch: Partial<ThreadDoc> = {};
  if (parsed.data.status) {
    patch.status = parsed.data.status;
    patch.resolvedAt = parsed.data.status === "resolved" ? nowIso() : null;
    patch.updatedAt = nowIso(); // status change is activity; reading isn't
  }
  if (parsed.data.category !== undefined) patch.category = parsed.data.category;
  if (parsed.data.duplicateOf !== undefined) patch.duplicateOf = parsed.data.duplicateOf;
  if (parsed.data.read) patch.unreadByHq = false;
  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }
  await ref.update(patch);
  res.json({ ok: true });
});

// POST /:id/note — an HQ-only internal note (never sent to the provider).
const noteSchema = z.object({ text: z.string().trim().min(1).max(4000) });
platformSupport.post("/:id/note", async (req, res) => {
  const parsed = noteSchema.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const ref = db.collection("supportThreads").doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) { res.status(404).json({ error: "No such thread" }); return; }
  const note = { id: randomUUID(), at: nowIso(), byUid: req.user!.uid, byEmail: req.user?.email ?? null, text: parsed.data.text };
  await ref.update({ notes: [...((snap.data() as ThreadDoc).notes ?? []), note] });
  res.status(201).json({ note });
});

platformSupport.get("/insights", async (_req, res) => {
  const snap = await db.collection("supportThreads").get();
  const threads = snap.docs.map((d) => ({ id: d.id, ...(d.data() as ThreadDoc) }));
  // A duplicate rolls up into its canonical thread — count clusters, not rows.
  const primary = threads.filter((t) => !t.duplicateOf);
  const dupesOf = new Map<string, number>();
  for (const t of threads) if (t.duplicateOf) dupesOf.set(t.duplicateOf, (dupesOf.get(t.duplicateOf) ?? 0) + 1);

  const byCategory: Record<string, number> = {};
  const byPage: Record<string, number> = {};
  const byProvider: Record<string, { name: string; count: number; categories: Record<string, number> }> = {};
  const byWeek: Record<string, number> = {};
  let resolvedCount = 0, resolveMsTotal = 0;
  const weekKey = (iso: string) => { const d = new Date(iso); const day = (d.getUTCDay() + 6) % 7; const mon = new Date(d.getTime() - day * 86_400_000); return mon.toISOString().slice(0, 10); };

  for (const t of primary) {
    const cat = t.category || "uncategorised";
    byCategory[cat] = (byCategory[cat] ?? 0) + 1;
    if (t.kind === "bug" && t.report?.page) byPage[t.report.page] = (byPage[t.report.page] ?? 0) + 1;
    const pkey = t.providerId ? `${t.providerId}:${t.franchiseId ?? ""}` : t.email;
    const pv = byProvider[pkey] ?? { name: t.name, count: 0, categories: {} };
    pv.count += 1; pv.categories[cat] = (pv.categories[cat] ?? 0) + 1;
    byProvider[pkey] = pv;
    if (t.createdAt) byWeek[weekKey(t.createdAt)] = (byWeek[weekKey(t.createdAt)] ?? 0) + 1;
    if (t.status === "resolved" && t.resolvedAt && t.createdAt) { resolvedCount += 1; resolveMsTotal += Math.max(0, Date.parse(t.resolvedAt) - Date.parse(t.createdAt)); }
  }
  // Repeat concerns: providers who've raised the same category 2+ times.
  const repeatConcerns = Object.entries(byProvider)
    .flatMap(([, pv]) => Object.entries(pv.categories).filter(([, n]) => n >= 2).map(([cat, n]) => ({ provider: pv.name, category: cat, count: n })))
    .sort((a, b) => b.count - a.count).slice(0, 20);

  res.json({
    totals: { threads: primary.length, open: primary.filter((t) => t.status === "open").length, inProgress: primary.filter((t) => t.status === "in_progress").length, resolved: primary.filter((t) => t.status === "resolved").length, bugs: primary.filter((t) => t.kind === "bug").length },
    byCategory,
    topBugPages: Object.entries(byPage).map(([page, count]) => ({ page, count })).sort((a, b) => b.count - a.count).slice(0, 12),
    topProviders: Object.values(byProvider).map((p) => ({ name: p.name, count: p.count })).sort((a, b) => b.count - a.count).slice(0, 12),
    repeatConcerns,
    byWeek: Object.entries(byWeek).map(([week, count]) => ({ week, count })).sort((a, b) => (a.week < b.week ? -1 : 1)).slice(-12),
    avgResolveHours: resolvedCount ? Math.round(resolveMsTotal / resolvedCount / 3_600_000) : null,
    dupeClusters: [...dupesOf.entries()].map(([id, n]) => ({ id, dupes: n })).sort((a, b) => b.dupes - a.dupes).slice(0, 12),
  });
});

// A small, self-contained Groq JSON call — reuses the same env-gated integration
// as the AI assistant (no new keys). Returns null when unconfigured or on any
// failure, so the review screen still renders its grouped data without AI text.
async function groqSummarise(payload: string): Promise<{ overview: string; summaries: Record<string, string> } | null> {
  if (!process.env.GROQ_API_KEY) return null;
  const system = "You are a support-operations analyst for a childcare-activity SaaS. You are given a JSON digest of support threads grouped by category. Reply ONLY with JSON: {\"overview\": string, \"summaries\": {\"<categoryId>\": string}}. 'overview' is 1–2 sentences naming the biggest recurring themes and any spikes. Each category summary is ONE plain-English sentence capturing the common concern and, if obvious, the likely cause. Be specific, no fluff, no markdown.";
  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({ model: process.env.GROQ_MODEL || "openai/gpt-oss-120b", messages: [{ role: "system", content: system }, { role: "user", content: payload }], temperature: 0.3, max_tokens: 900, response_format: { type: "json_object" } }),
    });
    if (!r.ok) { console.error(`[support/review] Groq ${r.status}`); return null; }
    const data = (await r.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = data.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw) as { overview?: string; summaries?: Record<string, string> };
    return { overview: parsed.overview ?? "", summaries: parsed.summaries ?? {} };
  } catch (e) { console.error("[support/review] summarise failed", e); return null; }
}

// GET /review — the sidebar "Support review" page: every thread recollected and
// grouped by CATEGORY, then by PROVIDER, each category carrying an AI summary of
// the recurring concern so trends are trackable at a glance.
platformSupport.get("/review", async (_req, res) => {
  const [threadsSnap, cfgSnap] = await Promise.all([
    db.collection("supportThreads").get(),
    CFG_REF().get(),
  ]);
  const threads = threadsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as ThreadDoc) }));
  const primary = threads.filter((t) => !t.duplicateOf);
  const dupesOf = new Map<string, number>();
  for (const t of threads) if (t.duplicateOf) dupesOf.set(t.duplicateOf, (dupesOf.get(t.duplicateOf) ?? 0) + 1);
  const cats: { id: string; label: string; emoji?: string }[] = cfgSnap.exists && (cfgSnap.data()!.categories as unknown[])?.length
    ? (cfgSnap.data()!.categories as { id: string; label: string; emoji?: string }[]) : DEFAULT_SUPPORT_CATEGORIES;
  const labelOf = (id: string) => (id === "uncategorised" ? "Uncategorised" : cats.find((c) => c.id === id)?.label ?? id);
  const emojiOf = (id: string) => cats.find((c) => c.id === id)?.emoji;
  const firstBody = (t: ThreadDoc & { id: string }) => (t.messages ?? []).find((m) => m.from === "them")?.body ?? t.subject ?? "";

  // Flat, singular thread rows grouped only by CATEGORY — each row carries its
  // own provider info + email (so the review page can open that account).
  type Row = { id: string; ticket: string | null; subject: string; status: string; snippet: string; at: string; providerName: string; tier: Tier; franchiseId: string | null; email: string; providerId: string | null; party: string; notes: { id: string; at: string; byEmail: string | null; text: string }[] };
  const byCat = new Map<string, Row[]>();
  for (const t of primary) {
    const cat = t.category || "uncategorised";
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat)!.push({
      id: t.id, ticket: t.ticket ?? null, subject: t.subject, status: t.status, snippet: firstBody(t).slice(0, 200), at: t.createdAt,
      providerName: t.name, tier: t.tier, franchiseId: t.franchiseId ?? null, email: t.email ?? "", providerId: t.providerId ?? null, party: t.party,
      notes: (t.notes ?? []).map((n) => ({ id: n.id, at: n.at, byEmail: n.byEmail ?? null, text: n.text })),
    });
  }

  const categoryGroups = [...byCat.entries()].map(([catId, rows]) => {
    const threads = rows.sort((a, b) => (a.at < b.at ? 1 : -1));
    return { categoryId: catId, label: labelOf(catId), emoji: emojiOf(catId), count: threads.length, open: threads.filter((r) => r.status !== "resolved").length, threads };
  }).sort((a, b) => b.count - a.count);

  // Build a compact digest for the model — subjects + a snippet per category.
  const digest = categoryGroups.map((g) => ({
    categoryId: g.categoryId, label: g.label, count: g.count,
    examples: g.threads.map((r) => `${r.providerName}: ${r.subject} — ${r.snippet}`).slice(0, 12),
  }));
  const ai = primary.length ? await groqSummarise(JSON.stringify(digest)) : null;

  res.json({
    aiConfigured: !!process.env.GROQ_API_KEY,
    totals: { threads: primary.length, open: primary.filter((t) => t.status === "open").length, inProgress: primary.filter((t) => t.status === "in_progress").length, resolved: primary.filter((t) => t.status === "resolved").length, bugs: primary.filter((t) => t.category === "bug").length },
    overview: ai?.overview ?? null,
    categoryGroups: categoryGroups.map((g) => ({ ...g, aiSummary: ai?.summaries?.[g.categoryId] ?? null })),
    dupeClusters: [...dupesOf.entries()].map(([id, n]) => ({ id, dupes: n })).sort((a, b) => b.dupes - a.dupes).slice(0, 12),
  });
});

// ── The in-app bug report (any signed-in account) ───────────────────────────

export const supportReport = Router();

// POST / — a 🐞 report from the operator or customer shell. The client sends
// what it captured (route, UA, severity, steps); the server works out WHO is
// reporting so the thread lands in the HQ inbox already attributed:
//   operators/staff → party "provider", named after their tenant;
//   parents         → party "customer", linked to the provider they were
//                     booking with (explicit providerId, else their most
//                     recent booking's tenant).
const reportSchema = z.object({
  page: z.string().min(1).max(300),
  steps: z.string().min(1).max(5000),
  severity: z.enum(["low", "medium", "high"]),
  device: z.string().max(500),
  providerId: z.string().max(100).optional(),
});
supportReport.post("/", async (req, res) => {
  const parsed = reportSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const { page, steps, severity, device, providerId: bodyProviderId } = parsed.data;
  const auth = req.auth!;
  const email = req.user?.email ?? "";

  let party: ThreadDoc["party"] = "customer";
  let name = req.user?.name || (email ? email.split("@")[0] : "Unknown reporter");
  let providerId: string | null = null;
  let providerName = "";
  let tier: Tier = "company";

  const isOperator = ["company", "freelancer", "franchise", "staff"].includes(auth.role) && !!auth.tenantId;
  const reporterFranchiseId = auth.role === "franchise" ? (auth.franchiseId ?? null) : null;
  if (isOperator) {
    party = "provider";
    providerId = auth.tenantId;
  } else {
    // Customer: prefer the provider the client says they were with (e.g. a
    // storefront), else the provider of their most recent booking.
    if (bodyProviderId) {
      providerId = bodyProviderId;
    } else if (email) {
      const bookings = await db.collection("bookings").where("email", "==", email).get();
      const latest = bookings.docs
        .map((d) => d.data() as { tenantId?: string; createdAt?: string })
        .filter((b) => b.tenantId)
        .sort((a, b) => ((a.createdAt ?? "") < (b.createdAt ?? "") ? 1 : -1))[0];
      providerId = latest?.tenantId ?? null;
    }
  }

  if (providerId) {
    const t = await tenantTier(providerId);
    if (t) {
      tier = t.tier;
      providerName = t.providerName;
      if (isOperator) name = t.providerName; // provider threads are named after the business
      // A franchisee shares its head office's tenant — name the thread after the
      // franchise itself so HQ knows exactly who reported it.
      if (reporterFranchiseId) {
        const fl = await franchiseLabel(providerId, reporterFranchiseId);
        if (fl) { name = fl; providerName = fl; }
      }
    } else {
      providerId = null;
    }
  }

  const at = nowIso();
  const doc: ThreadDoc = {
    party,
    name,
    email,
    tier,
    providerId,
    franchiseId: reporterFranchiseId,
    providerName,
    subject: `Bug: ${page}`,
    ticket: await nextTicket("bug"),
    kind: "bug",
    category: "bug",
    report: { channel: "In-app report", page, severity, device, steps },
    status: "open",
    unreadByHq: true,
    messages: [msg("them", steps)],
    createdAt: at,
    updatedAt: at,
  };
  const ref = await db.collection("supportThreads").add(doc);
  res.status(201).json({ id: ref.id, ticket: doc.ticket });
});
