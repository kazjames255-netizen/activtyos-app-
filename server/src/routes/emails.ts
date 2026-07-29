import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "../firebase";
import { sendMail } from "../lib/mailer";
import type { Role } from "../middleware/role";

// Email (Communication) — the out-of-app channel. An operator emails their
// families: everyone who's booked, or one address. Reuses the transactional
// mailer. A `dryRun` returns who WOULD receive it (preview before a blast),
// and every real send is recorded in `emails` for a history/audit trail.
export const emails = Router();
const col = db.collection("emails");
const canManage = (role: Role) => role === "company" || role === "freelancer" || role === "franchise";
const MAX_RECIPIENTS = 2000;

const sendSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(20_000),
  html: z.string().max(400_000).optional(),            // pre-rendered HTML (a designed post/newsletter) — sent as-is
  audience: z.enum(["all", "one"]).default("all"),
  to: z.string().trim().email().max(160).optional(),
  dryRun: z.boolean().default(false),
}).refine((s) => s.audience !== "one" || !!s.to, { message: "Provide a recipient address for a single email" });

function opScope(req: Request, res: Response): string | null {
  const auth = req.auth!;
  if (auth.role === "platform") {
    const t = typeof req.query.tenantId === "string" ? req.query.tenantId : null;
    if (!t) { res.status(400).json({ error: "Platform: pass ?tenantId=" }); return null; }
    return t;
  }
  if (!canManage(auth.role) || !auth.tenantId) { res.status(403).json({ error: "Requires an operator account" }); return null; }
  return auth.tenantId;
}

// The distinct family (booker) emails for a tenant — everyone who's booked and
// isn't cancelled/declined. This is the "all families" audience.
async function familyEmails(tenantId: string): Promise<string[]> {
  const snap = await db.collection("bookings").where("tenantId", "==", tenantId).get();
  const set = new Set<string>();
  for (const d of snap.docs) {
    const b = d.data() as { email?: string; status?: string };
    if (!b.email || b.status === "Cancelled" || b.status === "Declined") continue;
    set.add(b.email.toLowerCase());
  }
  return [...set];
}

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
const bodyHtml = (body: string) => `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#111">${esc(body).replace(/\n/g, "<br>")}</div>`;

// GET /api/emails/recipients — how many families the "all" blast would reach.
emails.get("/recipients", async (req, res) => {
  const tenantId = opScope(req, res);
  if (!tenantId) return;
  const list = await familyEmails(tenantId);
  res.json({ count: list.length, sample: list.slice(0, 20) });
});

// GET /api/emails — the send history (operators).
emails.get("/", async (req, res) => {
  const tenantId = opScope(req, res);
  if (!tenantId) return;
  const snap = await col.where("tenantId", "==", tenantId).get();
  const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { createdAt?: string })[];
  list.sort((a, b) => (`${b.createdAt ?? ""}` < `${a.createdAt ?? ""}` ? -1 : 1));
  res.json(list);
});

// POST /api/emails/send — send (or dry-run) to the chosen audience.
emails.post("/send", async (req, res) => {
  const auth = req.auth!;
  if (!canManage(auth.role) || !auth.tenantId) { res.status(403).json({ error: "Requires an operator account" }); return; }
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const input = parsed.data;

  const recipients = input.audience === "one" ? [input.to!.toLowerCase()] : await familyEmails(auth.tenantId);
  if (recipients.length === 0) { res.status(400).json({ error: "No families to email yet" }); return; }
  if (recipients.length > MAX_RECIPIENTS) { res.status(400).json({ error: `Too many recipients (${recipients.length}) — max ${MAX_RECIPIENTS}` }); return; }

  if (input.dryRun) { res.json({ dryRun: true, recipientCount: recipients.length, sample: recipients.slice(0, 20) }); return; }

  // A pre-rendered designed document (post/newsletter) is sent as-is; otherwise
  // the plain-text body is wrapped. `body` is kept as the plain-text record.
  const html = input.html && input.html.trim() ? input.html : bodyHtml(input.body);
  for (const to of recipients) void sendMail(to, input.subject, html);

  const doc = {
    tenantId: auth.tenantId,
    subject: input.subject,
    body: input.body,
    audience: input.audience,
    recipientCount: recipients.length,
    sentBy: req.user?.email ?? "operator",
    sentByName: req.user?.name ?? req.user?.email ?? "Operator",
    createdAt: new Date().toISOString(),
  };
  const ref = await col.add(doc);
  res.status(201).json({ id: ref.id, ...doc });
});
