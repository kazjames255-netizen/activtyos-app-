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

type Tier = "freelancer" | "company" | "franchise";

interface Msg {
  id: string;
  from: "hq" | "them";
  body: string;
  at: string;
}

interface ThreadDoc {
  party: "provider" | "customer";
  name: string;
  email: string;
  tier: Tier;
  providerId: string | null;
  providerName: string;
  subject: string;
  kind: "message" | "bug";
  report?: { channel: string; page: string; severity: "low" | "medium" | "high"; device: string; steps: string };
  status: "open" | "resolved";
  unreadByHq: boolean;
  messages: Msg[];
  createdAt: string;
  updatedAt: string;
}

const nowIso = () => new Date().toISOString();
const msg = (from: Msg["from"], body: string): Msg => ({ id: randomUUID(), from, body, at: nowIso() });

// A tenant's tier the way the HQ inbox shows it: the franchise plan wins,
// otherwise the tenant type (anything unexpected counts as a company).
async function tenantTier(providerId: string): Promise<{ tier: Tier; providerName: string } | null> {
  const snap = await db.collection("tenants").doc(providerId).get();
  if (!snap.exists) return null;
  const t = snap.data()!;
  const plan = (t.subscription as Record<string, unknown> | undefined)?.plan;
  const tier: Tier = plan === "franchise" ? "franchise" : t.type === "freelancer" ? "freelancer" : "company";
  return { tier, providerName: (t.name as string) ?? providerId };
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
  const threads = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as ThreadDoc) }))
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
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
  const m = msg("hq", parsed.data.body);
  await ref.update({
    messages: [...((snap.data() as ThreadDoc).messages ?? []), m],
    status: "open",
    unreadByHq: false,
    updatedAt: m.at,
  });
  res.json({ ok: true, message: m });
});

// PUT /:id — resolve / reopen, and/or mark read (clears the HQ unread dot).
const patchSchema = z.object({
  status: z.enum(["open", "resolved"]).optional(),
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
    patch.updatedAt = nowIso(); // resolving/reopening is activity; reading isn't
  }
  if (parsed.data.read) patch.unreadByHq = false;
  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }
  await ref.update(patch);
  res.json({ ok: true });
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
    providerName,
    subject: `Bug: ${page}`,
    kind: "bug",
    report: { channel: "In-app report", page, severity, device, steps },
    status: "open",
    unreadByHq: true,
    messages: [msg("them", steps)],
    createdAt: at,
    updatedAt: at,
  };
  const ref = await db.collection("supportThreads").add(doc);
  res.status(201).json({ id: ref.id });
});
