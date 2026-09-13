import { randomBytes } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { db } from "../firebase";
import { contentDisposition } from "../lib/contentDisposition";
import { emailReferenceRequest, emailReferenceReceived } from "../lib/emails";
import { webUrl } from "../lib/stripe";
import { canWrite, managerScope } from "../middleware/role";
// The question model is shared with the front end on purpose: the gate and the
// form must agree on what counts as a safeguarding concern.
import { DEFAULT_REFERENCE_SECTIONS, flagsConcern, type RefSection } from "../../../features/team/referenceQuestions";

// Employment references — the half of safer recruitment that actually leaves
// the building. The onboarding record captures who the referees ARE; this
// obtains what they say.
//
//   POST   /api/references                   (operator) create + email the referee
//   GET    /api/references?staff=Name        (operator) list
//   POST   /api/references/:token/resend     (operator) chase
//   POST   /api/references/:token/record     (operator) reference taken by phone
//   POST   /api/references/:token/resolve    (operator) safeguarding concern reviewed
//   DELETE /api/references/:token            (operator) revoke — link stops working
//
//   GET  /api/public/reference/:token        (public) the referee opens the form
//   POST /api/public/reference/:token        (public) they submit it
//   POST /api/public/reference/:token/decline
//
// The token IS the authorisation on the public half (same contract as invites
// and invoice pay links) and it's single-use: once submitted or declined the
// link 410s, so a forwarded email can't be used to overwrite a reference.
export const references = Router();

// Public half — mounted separately, ABOVE requireAuth.
export const referencePublic = Router();

const col = db.collection("references");

// A CONCERN means the reference is recorded but can't satisfy the
// cleared-to-start gate until a named person has reviewed it.
//
// Which answers count is the provider's to set (⚙ Reference questions marks
// options with ⚠), so this can't be a hardcoded list of ids any more. Two rules
// keep it honest:
//   · it's computed from the SNAPSHOT stored on the request — the questions
//     that referee was actually asked, not whatever the set says today;
//   · it's computed HERE from the answers, never trusted from the form; and via
//     the same flagsConcern the UI uses, so the two can't disagree.
// The editor won't save a safeguarding question with no ⚠ option, so a provider
// can't switch the gate off by rewording a dropdown (see validateSections).
const hasConcern = (sections: RefSection[] | undefined, answers: Record<string, string>): boolean =>
  flagsConcern(sections?.length ? sections : DEFAULT_REFERENCE_SECTIONS, answers);

/** What this provider asks referees right now. Snapshotted onto each request at
 *  creation, so editing the set never rewrites a question already answered. */
async function askedSections(tenantId: string): Promise<RefSection[]> {
  const lib = await db.collection("libraries").doc(tenantId).get();
  const s = (lib.data()?.settings ?? {}) as { referenceQuestions?: RefSection[] };
  return s.referenceQuestions?.length ? s.referenceQuestions : DEFAULT_REFERENCE_SECTIONS;
}

// The provider's CURRENT display name — the editable trading name in Setup wins
// over the tenant doc's original sign-up value. Same precedence as invites.ts /
// lib/sender.ts, so the referee sees the same business name everywhere.
async function providerName(tenantId: string): Promise<string> {
  const [tenant, lib] = await Promise.all([
    db.collection("tenants").doc(tenantId).get(),
    db.collection("libraries").doc(tenantId).get(),
  ]);
  const s = (lib.data()?.settings ?? {}) as { providerName?: string; billing?: { businessName?: string } };
  return (
    (s.billing?.businessName || "").trim() ||
    (s.providerName || "").trim() ||
    (tenant.exists ? (tenant.data()!.name as string) : "") ||
    "Your provider"
  );
}

// A reference document scanned/photographed on headed paper. Held inline on the
// doc like every other onboarding upload — capped well under Firestore's 1MB
// limit, since the answers share the document.
const MAX_FILE_CHARS = 700_000;
const fileSchema = z
  .object({
    // No SVG: it's an "image" that can carry script, and this form is PUBLIC.
    fileData: z.string().max(MAX_FILE_CHARS).regex(/^data:(image\/(jpeg|png|webp|gif|heic|heif)|application\/pdf)[;,]/, "Attach a photo (JPG, PNG) or a PDF"),
    fileName: z.string().trim().max(120),
  })
  .optional();

// Free-text lives in `answers`; the form owns the question list, the server only
// bounds it. Long-answer questions (comments, concern details) need the room.
const answersSchema = z.record(z.string().max(40), z.string().max(4000)).refine(
  (a) => Object.keys(a).length <= 60,
  "Too many answers",
);

interface RefDoc {
  tenantId: string;
  franchiseId: string | null;
  staffName: string;
  slot: number;
  refereeName: string;
  refereeOrg: string | null;
  refereeRel: string | null;
  refereeEmail: string | null;
  jobTitle: string | null;
  status: "sent" | "opened" | "received" | "declined";
  /** How it reached the referee: we emailed them, the operator sends the link
   *  themselves (WhatsApp/their own mail), or it's being taken over the phone. */
  method: "email" | "link" | "phone";
  createdBy: string;
  createdByEmail: string | null;
  /** Which portal to send them back to when the reference lands. */
  createdByRole?: string;
  createdAt: string;
  lastSentAt: string | null;
  chases: number;
  openedAt?: string | null;
  submittedAt?: string | null;
  declinedAt?: string | null;
  declineReason?: string | null;
  answers?: Record<string, string>;
  fileData?: string | null;
  fileName?: string | null;
  concern?: boolean;
  concernResolved?: { by: string; at: string; note: string } | null;
  recordedBy?: string | null;
  /** The questions this request was created with. */
  sections?: RefSection[];
}

// What an operator is allowed to see. The whole doc minus nothing — references
// are theirs — but `fileData` is a ~700KB string, so it's fetched on demand
// (GET /:token/file) rather than dragged through every list response.
const publicShape = (id: string, d: RefDoc) => ({
  token: id,
  staffName: d.staffName,
  slot: d.slot,
  refereeName: d.refereeName,
  refereeOrg: d.refereeOrg ?? null,
  refereeRel: d.refereeRel ?? null,
  refereeEmail: d.refereeEmail ?? null,
  status: d.status,
  method: d.method ?? "email",
  createdAt: d.createdAt,
  createdBy: d.createdByEmail ?? null,
  lastSentAt: d.lastSentAt ?? null,
  chases: d.chases ?? 0,
  openedAt: d.openedAt ?? null,
  submittedAt: d.submittedAt ?? null,
  declinedAt: d.declinedAt ?? null,
  declineReason: d.declineReason ?? null,
  answers: d.answers ?? null,
  fileName: d.fileName ?? null,
  hasFile: !!d.fileData,
  concern: !!d.concern,
  concernResolved: d.concernResolved ?? null,
  recordedBy: d.recordedBy ?? null,
  sections: d.sections ?? null,
});

// ——————————————————————————————————————— operator ———

const createSchema = z.object({
  staffName: z.string().trim().min(1).max(120),
  slot: z.number().int().min(1).max(4),
  refereeName: z.string().trim().min(1).max(120),
  refereeOrg: z.string().trim().max(120).optional(),
  refereeRel: z.string().trim().max(120).optional(),
  refereeEmail: z.string().trim().email().max(160).optional(),
  jobTitle: z.string().trim().max(120).optional(),
  message: z.string().trim().max(1000).optional(),
  /** How to reach the referee:
   *   email — we send the form (needs refereeEmail)
   *   link  — create the request, send the link yourself; nothing is emailed
   *   phone — no form at all; the operator rings them and types it up
   *  All three create the same record, so the chase list tracks every one. */
  deliver: z.enum(["email", "link", "phone"]).optional(),
});

references.post("/", async (req, res) => {
  const scope = managerScope(req, res);
  if (!scope) return;
  if (!canWrite(scope.role) || !scope.tenantId) {
    res.status(403).json({ error: "Your account cannot request references" });
    return;
  }
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const p = parsed.data;
  // No delivery stated: email them if we can, otherwise it's a phone job.
  const deliver = p.deliver ?? (p.refereeEmail ? "email" : "phone");
  if (deliver === "email" && !p.refereeEmail) { res.status(400).json({ error: "Add the referee's email address, or create a link to send them yourself." }); return; }

  const token = randomBytes(16).toString("hex");
  const doc: RefDoc = {
    tenantId: scope.tenantId,
    // A franchise's own staff records stay inside that franchise — head office
    // sees them, a sibling franchise never does. Same rule as invites.
    franchiseId: scope.role === "franchise" ? scope.franchiseId : null,
    staffName: p.staffName,
    slot: p.slot,
    refereeName: p.refereeName,
    refereeOrg: p.refereeOrg ?? null,
    refereeRel: p.refereeRel ?? null,
    refereeEmail: p.refereeEmail ?? null,
    jobTitle: p.jobTitle ?? null,
    status: "sent",
    method: deliver,
    createdBy: req.user!.uid,
    createdByEmail: req.user?.email ?? null,
    createdByRole: scope.role,
    createdAt: new Date().toISOString(),
    lastSentAt: null,
    chases: 0,
    sections: await askedSections(scope.tenantId),
  };
  await col.doc(token).set(doc);

  if (deliver === "email" && p.refereeEmail) {
    emailReferenceRequest({
      to: p.refereeEmail,
      refereeName: p.refereeName,
      tenantName: await providerName(scope.tenantId),
      candidateName: p.staffName,
      jobTitle: p.jobTitle,
      link: `${webUrl}/reference/${token}`,
      message: p.message,
      tenantId: scope.tenantId,
    });
    doc.lastSentAt = new Date().toISOString();
    await col.doc(token).set({ lastSentAt: doc.lastSentAt }, { merge: true });
  }
  res.status(201).json(publicShape(token, doc));
});

references.get("/", async (req, res) => {
  // Managers only (managerScope): a reference holds a referee's words about a
  // candidate, including any safeguarding concern — staff never read them.
  const scope = managerScope(req, res);
  if (!scope) return;
  if (!scope.tenantId) { res.status(400).json({ error: "Open an account first (platform: view as the provider)" }); return; }
  let q = col.where("tenantId", "==", scope.tenantId);
  const staff = typeof req.query.staff === "string" ? req.query.staff : null;
  if (staff) q = q.where("staffName", "==", staff);
  const snap = await q.get();
  const own = scope.role === "franchise"
    ? snap.docs.filter((d) => (d.data().franchiseId ?? null) === (scope.franchiseId ?? null))
    : snap.docs;
  const list = own.map((d) => publicShape(d.id, d.data() as RefDoc));
  list.sort((a, b) => (a.slot === b.slot ? (a.createdAt < b.createdAt ? 1 : -1) : a.slot - b.slot));
  res.json(list);
});

/** Fetch a reference that belongs to this tenant (and, for a franchisee, to its
 *  own franchise). Writes the error and returns null when it doesn't. */
async function ownReference(
  token: string,
  scope: { role: string; tenantId: string | null; franchiseId: string | null },
  res: import("express").Response,
) {
  const ref = col.doc(String(token));
  const snap = await ref.get();
  if (!snap.exists) { res.status(404).json({ error: "Reference request not found" }); return null; }
  const d = snap.data() as RefDoc;
  if (d.tenantId !== scope.tenantId) { res.status(403).json({ error: "Not your reference request" }); return null; }
  if (scope.role === "franchise" && (d.franchiseId ?? null) !== (scope.franchiseId ?? null)) {
    res.status(403).json({ error: "Not your reference request" }); return null;
  }
  return { ref, d };
}

// Chase — re-send the same link. The referee may also have been given a new
// address ("she's left, try this one"), which is saved.
const resendSchema = z.object({ email: z.string().trim().email().max(160).optional(), message: z.string().trim().max(1000).optional() });
references.post("/:token/resend", async (req, res) => {
  const scope = managerScope(req, res);
  if (!scope || !canWrite(scope.role)) { if (scope) res.status(403).json({ error: "Your account cannot send references" }); return; }
  const parsed = resendSchema.safeParse(req.body ?? {});
  const found = await ownReference(req.params.token, scope, res);
  if (!found) return;
  if (found.d.submittedAt) { res.status(410).json({ error: "This reference has already come back." }); return; }
  // A declined link is closed for good (the public form refuses it), so a
  // "chase" would email a referee who said no a link that doesn't work.
  if (found.d.declinedAt) { res.status(410).json({ error: "This referee declined. Ask for a reference from someone else instead." }); return; }
  const to = (parsed.success && parsed.data.email) || found.d.refereeEmail;
  if (!to) { res.status(400).json({ error: "No email on this request — add one to send it." }); return; }
  emailReferenceRequest({
    to,
    refereeName: found.d.refereeName,
    tenantName: await providerName(scope.tenantId!),
    candidateName: found.d.staffName,
    jobTitle: found.d.jobTitle,
    link: `${webUrl}/reference/${req.params.token}`,
    message: parsed.success ? parsed.data.message : undefined,
    tenantId: scope.tenantId ?? undefined,
    // Changes the wording to a reminder rather than a first approach.
    chase: true,
  });
  const patch = {
    refereeEmail: to,
    method: "email" as const,
    lastSentAt: new Date().toISOString(),
    chases: (found.d.chases ?? 0) + 1,
  };
  await found.ref.set(patch, { merge: true });
  res.json({ ...publicShape(req.params.token, { ...found.d, ...patch }) });
});

// A reference taken over the phone, or one that arrived by post/email and is
// being typed up. Same answers, recorded against a named member of staff — that
// attribution is the point of the endpoint.
const recordSchema = z.object({
  answers: answersSchema,
  file: fileSchema,
  note: z.string().trim().max(2000).optional(),
});
references.post("/:token/record", async (req, res) => {
  const scope = managerScope(req, res);
  if (!scope || !canWrite(scope.role)) { if (scope) res.status(403).json({ error: "Your account cannot record references" }); return; }
  const parsed = recordSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const found = await ownReference(req.params.token, scope, res);
  if (!found) return;
  // A reference the referee has already returned is never typed over: that
  // replaced their answers and recalculated `concern` — which could silently
  // clear a flagged safeguarding concern and let the person start work.
  if (found.d.submittedAt) { res.status(409).json({ error: "This reference has already been returned — it can't be recorded over. Send a new request if you need another." }); return; }
  const answers = parsed.data.answers as Record<string, string>;
  const patch = {
    status: "received" as const,
    method: "phone" as const,
    answers,
    ...(parsed.data.file ? { fileData: parsed.data.file.fileData, fileName: parsed.data.file.fileName } : {}),
    concern: hasConcern(found.d.sections, answers),
    submittedAt: new Date().toISOString(),
    recordedBy: req.user?.email ?? req.user?.uid ?? null,
  };
  await found.ref.set(patch, { merge: true });
  res.json(publicShape(req.params.token, { ...found.d, ...patch }));
});

// A flagged safeguarding concern, reviewed by a named person. Until this exists
// the reference can't count towards cleared-to-start.
const resolveSchema = z.object({ note: z.string().trim().min(1).max(2000) });
references.post("/:token/resolve", async (req, res) => {
  const scope = managerScope(req, res);
  if (!scope || !canWrite(scope.role)) { if (scope) res.status(403).json({ error: "Your account cannot resolve concerns" }); return; }
  const parsed = resolveSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Write down what you did about it — that note is the record." }); return; }
  const found = await ownReference(req.params.token, scope, res);
  if (!found) return;
  if (!found.d.concern) { res.status(409).json({ error: "Nothing flagged on this reference." }); return; }
  const concernResolved = {
    by: req.user?.email ?? req.user?.uid ?? "unknown",
    at: new Date().toISOString(),
    note: parsed.data.note,
  };
  await found.ref.set({ concernResolved }, { merge: true });
  res.json(publicShape(req.params.token, { ...found.d, concernResolved }));
});

// The uploaded reference document, fetched on demand. Authenticated — unlike
// /api/images, a reference is never world-readable by id.
references.get("/:token/file", async (req, res) => {
  const scope = managerScope(req, res);
  if (!scope) return;
  const found = await ownReference(req.params.token, scope, res);
  if (!found) return;
  const data = found.d.fileData;
  if (!data) { res.status(404).json({ error: "No document on this reference" }); return; }
  const m = data.match(/^data:([^;]+);base64,([\s\S]*)$/);
  if (!m) { res.status(404).json({ error: "No document on this reference" }); return; }
  const safe = /^(image\/(jpeg|png|webp|gif|heic|heif)|application\/pdf)$/i.test(m[1]);
  res.setHeader("Content-Type", safe ? m[1] : "application/octet-stream");
  res.setHeader("Content-Disposition", contentDisposition(safe ? "inline" : "attachment", found.d.fileName ?? "reference"));
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "sandbox");
  res.send(Buffer.from(m[2], "base64"));
});

// Revoke — the link stops working. A reference that's already come back is kept:
// deleting what a referee said about a safeguarding concern is not a thing an
// operator should be able to do with one click.
references.delete("/:token", async (req, res) => {
  const scope = managerScope(req, res);
  if (!scope || !canWrite(scope.role)) { if (scope) res.status(403).json({ error: "Your account cannot cancel references" }); return; }
  const found = await ownReference(req.params.token, scope, res);
  if (!found) return;
  if (found.d.submittedAt) { res.status(409).json({ error: "This reference has already come back — it can't be deleted." }); return; }
  await found.ref.delete();
  res.json({ ok: true });
});

// ——————————————————————————————————————— public ———

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

// What the referee's page shows. Deliberately thin: the candidate's name, who's
// asking, and what they applied for. NOT their address, DOB or any other
// onboarding detail — a forwarded link must not leak the candidate's file.
referencePublic.get("/:token", async (req, res) => {
  const snap = await col.doc(req.params.token).get();
  if (!snap.exists) { res.status(404).json({ error: "This reference link isn’t valid." }); return; }
  const d = snap.data() as RefDoc;
  if (d.submittedAt) { res.status(410).json({ error: "This reference has already been completed. Thank you." }); return; }
  if (d.declinedAt) { res.status(410).json({ error: "This reference request has been closed." }); return; }
  // First open stamps the request — it's what tells the operator the email
  // arrived and was read, which is the difference between "chase the referee"
  // and "check the address".
  if (!d.openedAt) {
    await col.doc(req.params.token).set({ openedAt: new Date().toISOString(), status: "opened" }, { merge: true });
  }
  res.json({
    tenantName: await providerName(d.tenantId),
    candidateName: d.staffName,
    jobTitle: d.jobTitle ?? null,
    refereeName: d.refereeName,
    refereeOrg: d.refereeOrg ?? null,
    // The questions as they were when this request went out.
    sections: d.sections ?? DEFAULT_REFERENCE_SECTIONS,
  });
});

const submitSchema = z.object({
  answers: answersSchema,
  file: fileSchema,
  signedName: z.string().trim().min(1).max(120),
  signedPosition: z.string().trim().max(120).optional(),
  signedOrg: z.string().trim().max(120).optional(),
  confirmed: z.literal(true),
});

referencePublic.post("/:token", async (req, res) => {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const ref = col.doc(req.params.token);
  const answers = parsed.data.answers as Record<string, string>;
  try {
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpError(404, "This reference link isn’t valid.");
      const d = snap.data() as RefDoc;
      // Re-read inside the transaction: two tabs, or a double-submit, must not
      // let the second one overwrite what the first referee said.
      if (d.submittedAt) throw new HttpError(410, "This reference has already been completed. Thank you.");
      if (d.declinedAt) throw new HttpError(410, "This reference request has been closed.");
      tx.update(ref, {
        status: "received",
        answers: {
          ...answers,
          signedName: parsed.data.signedName,
          signedPosition: parsed.data.signedPosition ?? "",
          signedOrg: parsed.data.signedOrg ?? "",
        },
        ...(parsed.data.file ? { fileData: parsed.data.file.fileData, fileName: parsed.data.file.fileName } : {}),
        concern: hasConcern(d.sections, answers),
        submittedAt: new Date().toISOString(),
      });
      return d;
    });
    // A reference that raises a safeguarding concern puts the person's
    // "references satisfactory" tick back on hold, so their onboarding can't
    // read "cleared to start" while it's unreviewed (acceptance d15s16) — even
    // if the tick was given before this reference came back.
    if (hasConcern(result.sections, answers)) void holdReferencesTick(result.tenantId, result.staffName).catch(() => {});
    // Tell the person who asked for it. Fire-and-forget — a mail failure must
    // never lose the referee's work or make them think the submit didn't land.
    if (result.createdByEmail) {
      emailReferenceReceived({
        to: result.createdByEmail,
        tenantName: await providerName(result.tenantId),
        candidateName: result.staffName,
        refereeName: parsed.data.signedName || result.refereeName,
        concern: hasConcern(result.sections, answers),
        portal: result.createdByRole,
        tenantId: result.tenantId,
      });
    }
    res.json({ ok: true });
  } catch (e) {
    if (e instanceof HttpError) res.status(e.status).json({ error: e.message });
    else throw e;
  }
});

async function holdReferencesTick(tenantId: string, staffName: string) {
  const name = staffName.trim().toLowerCase();
  const recs = await db.collection("onboardRecords").where("tenantId", "==", tenantId).get();
  for (const r of recs.docs) {
    if (String(r.get("staff") ?? "").trim().toLowerCase() !== name) continue;
    const refs = (r.get("values") ?? {}).refsCheck as { status?: string } | undefined;
    if (refs?.status !== "verified") continue;
    await r.ref.set({ values: { refsCheck: { ...refs, status: "pending", heldFor: "reference_concern", heldAt: new Date().toISOString() } } }, { merge: true });
  }
}

// "You've got the wrong person" / "our policy is HR-only". Closing the request
// rather than ignoring it is what stops the chaser emails.
const declineSchema = z.object({ reason: z.string().trim().max(600).optional() });
referencePublic.post("/:token/decline", async (req, res) => {
  const parsed = declineSchema.safeParse(req.body ?? {});
  const ref = col.doc(req.params.token);
  const snap = await ref.get();
  if (!snap.exists) { res.status(404).json({ error: "This reference link isn’t valid." }); return; }
  const d = snap.data() as RefDoc;
  if (d.submittedAt || d.declinedAt) { res.status(410).json({ error: "This reference request is already closed." }); return; }
  await ref.set({
    status: "declined",
    declinedAt: new Date().toISOString(),
    declineReason: (parsed.success && parsed.data.reason) || null,
  }, { merge: true });
  if (d.createdByEmail) {
    emailReferenceReceived({
      to: d.createdByEmail,
      tenantName: await providerName(d.tenantId),
      candidateName: d.staffName,
      refereeName: d.refereeName,
      concern: false,
      declined: (parsed.success && parsed.data.reason) || "No reason given",
      portal: d.createdByRole,
      tenantId: d.tenantId,
    });
  }
  res.json({ ok: true });
});
