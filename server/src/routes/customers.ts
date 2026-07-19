import { Router, type Request } from "express";
import { z } from "zod";
import { auth, db } from "../firebase";
import { canWrite, operatorScope } from "../middleware/role";
import { emailSignUpInvite } from "../lib/emails";

// Customers & families — the tenant's parent records. Mostly SELF-FILLING:
// every booking (operator-taken or parent checkout) upserts the family via
// lib/customerUpsert.ts, so the collection accumulates real customers.
// These endpoints cover reading them and the manual cases (adding a family
// before their first booking, fixing a record, removing one).
export const customers = Router();

const col = db.collection("customers");

const childSchema = z.object({
  name: z.string().trim().min(1).max(80),
  age: z.number().int().min(0).max(17).optional(),
  dob: z.string().trim().max(20).optional(),
});
const customerSchema = z.object({
  // `name` stays the composite every other screen reads; the parts are kept
  // alongside so an email can open "Dear Sarah" rather than "Dear Sarah Doyle".
  name: z.string().trim().min(1).max(120),
  firstName: z.string().trim().max(60).optional(),
  lastName: z.string().trim().max(60).optional(),
  email: z.string().trim().max(160).default(""),
  phone: z.string().trim().max(40).default(""),
  // Which of the provider's own sites this family belongs to — the thing a
  // campaign is actually built on ("everyone interested in Bedford"). A home
  // address was the wrong answer: a session provider posts nothing, so it
  // would have been personal data held for no purpose.
  locationId: z.string().trim().max(60).optional(),
  locationName: z.string().trim().max(120).optional(),
  /** PECR: marketing email needs consent. Absent means no, never assumed. */
  marketingOptIn: z.boolean().optional(),
  /** When it was given, and how. Consent you can't date or account for is
   *  consent you can't rely on if anyone ever asks. Stamped server-side so
   *  it records what happened rather than what was typed. */
  marketingOptInAt: z.string().trim().max(40).optional(),
  marketingSource: z.string().trim().max(60).optional(),
  children: z.array(childSchema).max(20).default([]),
});

// GET /api/customers — the caller's tenant's customers (staff may read;
// platform may filter with ?tenantId= or see all).
customers.get("/", async (req, res) => {
  const scope = operatorScope(req, res);
  if (!scope) return;

  let q = db.collection("customers") as FirebaseFirestore.Query;
  if (scope.role === "platform") {
    const tenantFilter = typeof req.query.tenantId === "string" ? req.query.tenantId : null;
    if (tenantFilter) q = q.where("tenantId", "==", tenantFilter);
  } else {
    q = q.where("tenantId", "==", scope.tenantId);
  }
  const snap = await q.get();
  const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as { name?: string }) }));
  list.sort((a, b) => ((a.name ?? "") < (b.name ?? "") ? -1 : 1));
  res.json(list);
});


/**
 * Stamp when consent was given and where it came from — but only on the
 * transition. Re-saving an unrelated field mustn't refresh the date, or the
 * record stops meaning "they agreed on this day".
 */
function withConsentStamp(
  next: Record<string, unknown>,
  prev?: FirebaseFirestore.DocumentData,
): Record<string, unknown> {
  const was = !!prev?.marketingOptIn;
  const now = !!next.marketingOptIn;
  if (now && !was) return { ...next, marketingOptInAt: new Date().toISOString(), marketingSource: "Added by the provider" };
  if (!now) return { ...next, marketingOptInAt: "", marketingSource: "" };
  return { ...next, marketingOptInAt: prev?.marketingOptInAt ?? "", marketingSource: prev?.marketingSource ?? "" };
}

customers.post("/", async (req, res) => {
  const auth = req.auth!;
  if (!canWrite(auth.role) || !auth.tenantId) {
    res.status(403).json({ error: "Requires an operator account with a tenant" });
    return;
  }
  const parsed = customerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const doc = { ...withConsentStamp(parsed.data), tenantId: auth.tenantId };
  const ref = await col.add(doc);
  res.status(201).json({ id: ref.id, ...doc });
});

async function ownCustomer(req: Request, id: string) {
  const auth = req.auth!;
  if (!canWrite(auth.role) || !auth.tenantId) return { status: 403 as const };
  const snap = await col.doc(id).get();
  if (!snap.exists || snap.data()!.tenantId !== auth.tenantId) return { status: 404 as const };
  return { status: 200 as const, snap };
}

customers.put("/:id", async (req, res) => {
  const own = await ownCustomer(req, req.params.id);
  if (own.status !== 200) {
    res
      .status(own.status)
      .json({ error: own.status === 403 ? "Requires an operator account" : "Customer not found" });
    return;
  }
  const parsed = customerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const patch = withConsentStamp(parsed.data, own.snap.data());
  await own.snap.ref.update(patch);
  res.json({ id: own.snap.id, ...own.snap.data(), ...patch });
});

customers.delete("/:id", async (req, res) => {
  const own = await ownCustomer(req, req.params.id);
  if (own.status !== 200) {
    res
      .status(own.status)
      .json({ error: own.status === 403 ? "Requires an operator account" : "Customer not found" });
    return;
  }
  // A family with bookings can't be deleted. Their bookings would outlive
  // them — a register naming a child whose family record has gone — and with
  // the record goes the proof of what they consented to. Enforced here, not
  // only in the UI, because the UI is a courtesy and this is the rule.
  const email = ((own.snap.data()!.email as string) ?? "").trim();
  if (email) {
    const booked = await db
      .collection("bookings")
      .where("tenantId", "==", req.auth!.tenantId)
      .where("email", "==", email)
      .limit(1)
      .get();
    if (!booked.empty) {
      res.status(409).json({
        error: "That family has bookings with you, so their record has to stay. Cancel the bookings first if they've asked to be forgotten.",
      });
      return;
    }
  }
  await own.snap.ref.delete();
  res.json({ ok: true });
});


// POST /api/customers/:id/invite — give a family an account and email them a
// link to set a password.
//
// The case this exists for: a parent phones asking what's on. The provider
// takes their name, email and number, and sends this. The family lands in
// their own area with every live listing and its dates, already registered,
// with nothing to fill in that they've just said on the phone.
//
// Deliberately: no password is ever generated or emailed. The account is
// created without one and Firebase's own reset link sets it, so nothing
// guessable is ever in an inbox. If the email already has an account we use
// it — a family who booked with another provider on the platform must not
// end up with two.
customers.post("/:id/invite", async (req, res) => {
  const scope = operatorScope(req, res);
  if (!scope || !canWrite(scope.role)) {
    res.status(403).json({ error: "Requires an operator account" });
    return;
  }
  const ref = col.doc(req.params.id);
  const snap = await ref.get();
  // canWrite has already excluded platform and staff, so the tenant check
  // applies to everyone who gets this far — no exceptions to reason about.
  if (!snap.exists || snap.data()!.tenantId !== scope.tenantId) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  const c = snap.data() as { name?: string; firstName?: string; email?: string };
  const email = (c.email ?? "").trim();
  if (!email.includes("@")) {
    res.status(400).json({ error: "That family has no email address" });
    return;
  }

  try {
    // Reuse the account if there is one; only create when there isn't.
    let uid: string;
    let existed = true;
    try {
      uid = (await auth.getUserByEmail(email)).uid;
    } catch {
      existed = false;
      uid = (await auth.createUser({ email, displayName: c.name || undefined, emailVerified: false })).uid;
    }

    // Mark them a parent so the portal knows where to put them. `chosen`
    // skips the "what kind of account is this?" step they never asked for.
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists || !userSnap.data()!.chosen) {
      await userRef.set({ email, role: "parent", chosen: true }, { merge: true });
    }

    // Firebase's own reset page asks for a password and nothing else — no
    // name, no email, because we already have both. The continue URL puts
    // them back in their own area afterwards rather than on a dead end.
    const link = await auth.generatePasswordResetLink(email, {
      url: `${process.env.WEB_URL || "http://localhost:3000"}/custdash`,
    });
    const tenant = await db.collection("tenants").doc(snap.data()!.tenantId).get();
    emailSignUpInvite({
      to: email,
      firstName: (c.firstName || (c.name ?? "").split(" ")[0] || "there").trim(),
      providerName: (tenant.exists ? (tenant.data()!.name as string) : "") || "Your activity provider",
      link,
      existed,
    });

    await ref.update({ invitedAt: new Date().toISOString() });
    res.json({ ok: true, existed });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Couldn't send the invite";
    console.error("[customers] invite failed:", msg);
    res.status(502).json({ error: msg });
  }
});
