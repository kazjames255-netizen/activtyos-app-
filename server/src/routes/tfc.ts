import { randomBytes } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { db } from "../firebase";
import { rateLimit } from "../lib/rateLimit";
import { childcareSettingsComplete, loadChildcareSettings, looksLikeTfcRef } from "../lib/childcare";
import { ukToday } from "../lib/ukDate";
import {
  accountBalance,
  authorizeUrl,
  exchangeCode,
  linkAccount,
  openToken,
  payOnce,
  sealToken,
  submitPayment,
  type PayRec,
  type PayStore,
  tfcConfig,
  withFreshTokens,
  type TfcTokens,
} from "../lib/tfc";
import type { TfcFailure } from "../../../lib/tfc";
import type { Booking } from "../../../features/bookings/types";
import { owedOf } from "../../../features/bookings/helpers";
import { fromDoc, type BookingDoc } from "../lib/bookingDoc";
import { bookingDocId } from "./bookings";

// ─────────────────────────────────────────────────────────────────────────
// Tax-Free Childcare — the parent-facing routes behind features/listings/tfc.ts.
//
//   GET  /api/my/tfc/config        — is HMRC wired up on this deployment?
//   POST /api/my/tfc/link/start    — begin the GOV.UK hand-off for one child
//   GET  /api/my/tfc/link/status   — has that hand-off finished?
//   POST /api/my/tfc/balance       — the live balance for a linked child
//   POST /api/my/tfc/pay           — ask HMRC to pay the provider for the parent's bookings
//   GET  /api/my/tfc/links         — which of the parent's children hold a live link
//   GET  /api/tfc/callback         — HMRC's OAuth redirect (public, see below)
//
// SCOPE. Every route is parent-only and resolves the child from the CALLER's
// own children (`children.parentUid == req.user.uid`) — a child id or a
// reference from the browser is never trusted on its own. `req.user.uid` is
// already the impersonated account when an HQ owner is viewing as a parent
// (middleware/role.ts), so it is the right identity everywhere here.
//
// With no HMRC credentials configured every route answers "not connected" and
// the browser falls back to the manual reference the checkout has always
// captured (routes/my.ts, `tfcReference`). Nothing about that path changes.
//
// ── TOKEN STORAGE: WHAT IS STILL OWED ────────────────────────────────────
// `tfcLinks/{childId}` holds an HMRC access + refresh token per child. A
// refresh token is a long-lived key to a family's Tax-Free Childcare account,
// and this codebase has no field-level encryption, so today it sits in
// Firestore in plaintext, protected only by the service account (the browser
// never reads this collection — there are no client Firestore rules to lean
// on because the browser never touches Firestore at all).
// Before this goes live with real HMRC credentials it needs, in order:
//   1. envelope encryption of `accessToken`/`refreshToken` with a KMS key
//      (Google Cloud KMS is already available to this project), so a leaked
//      database export is not a set of live TFC credentials;
//   2. deletion on unlink and on account closure (routes/privacy.ts), which
//      must also revoke at HMRC;
//   3. an audit line per use — who, which child, which correlation id.
// Until then: never log them, never return them to the browser, never put
// them on a booking, and never copy them into another collection.
// ─────────────────────────────────────────────────────────────────────────

/** Parent routes — mounted under /api/my/tfc (after requireAuth + attachRole). */
export const tfc = Router();
/** HMRC's OAuth redirect — mounted at /api/tfc/callback, PUBLIC (see below). */
export const tfcCallback = Router();

const childrenCol = db.collection("children");
const linksCol = db.collection("tfcLinks");
const statesCol = db.collection("tfcLinkStates");
const paymentsCol = db.collection("tfcPayments");
const bookingsCol = db.collection("bookings");

/** A hand-off is only worth this long. Long enough to sign in at GOV.UK with
 *  a password manager and a two-factor code, short enough that an abandoned
 *  one is dead. */
const STATE_TTL_MS = 15 * 60_000;

type LinkDoc = {
  parentUid: string;
  childId: string;
  childName?: string;
  reference?: string;
  childFullName?: string;
  linked?: boolean;
  linkedAt?: string;
  failure?: TfcFailure | null;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
};

type StateDoc = {
  parentUid: string;
  childId: string;
  reference?: string;
  status: "pending" | "working" | "linked" | "failed";
  failure?: TfcFailure | null;
  childFullName?: string;
  createdAt: string;
  expiresAt: number;
};

const tokensOf = (d: LinkDoc): TfcTokens | null => {
  if (!d.accessToken || !d.refreshToken || typeof d.expiresAt !== "number") return null;
  // Sealed at rest when HMRC_TFC_TOKEN_KEY is set; null if it can't be opened.
  const accessToken = openToken(d.accessToken);
  const refreshToken = openToken(d.refreshToken);
  return accessToken && refreshToken ? { accessToken, refreshToken, expiresAt: d.expiresAt } : null;
};

/** Persist rotated tokens. HMRC issues a NEW refresh token on every refresh;
 *  dropping it costs the parent a fresh GOV.UK sign-in. */
async function saveTokens(childId: string, t: TfcTokens): Promise<void> {
  await linksCol.doc(childId).set({ accessToken: sealToken(t.accessToken), refreshToken: sealToken(t.refreshToken), expiresAt: t.expiresAt }, { merge: true });
}

/** HMRC wants YYYY-MM-DD. Children carry whatever the parent typed. */
function isoDob(dob: unknown): string | null {
  const s = String(dob ?? "").trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : ukToday(d);
}

/** Parent-only. Everything below reads and writes one family's data. */
// Per-user limit (the tokens and HMRC calls behind these routes are costly and,
// for /pay, move money): 60 requests a minute per signed-in parent.
tfc.use(rateLimit("tfc", 60, 60_000, (req) => req.user?.uid));
tfc.use((req, res, next) => {
  if (req.auth?.role !== "parent") {
    res.status(403).json({ error: "Tax-Free Childcare is a parent account feature" });
    return;
  }
  next();
});

/** One of the caller's own children, by id or by name. */
async function myChild(uid: string, opts: { childId?: string; childName?: string }) {
  if (opts.childId) {
    const snap = await childrenCol.doc(opts.childId).get();
    // Not "403": a child that isn't yours is a child that doesn't exist, the
    // same answer the rest of the parent routes give.
    if (!snap.exists || snap.get("parentUid") !== uid) return null;
    return snap;
  }
  const name = (opts.childName ?? "").trim().toLowerCase();
  if (!name) return null;
  const kids = await childrenCol.where("parentUid", "==", uid).get();
  return kids.docs.find((d) => String(d.get("name") ?? "").trim().toLowerCase() === name) ?? null;
}

/** The link for one of the caller's children, if it is theirs. */
async function myLink(uid: string, childId: string): Promise<LinkDoc | null> {
  const snap = await linksCol.doc(childId).get();
  if (!snap.exists) return null;
  const d = snap.data() as LinkDoc;
  return d.parentUid === uid ? d : null;
}

// ── GET /api/my/tfc/config ───────────────────────────────────────────────
// The browser asks once whether the real integration exists here. When it
// doesn't, features/listings/tfc.ts keeps its simulated link and the parent
// types a reference by hand — exactly as before this route existed.
tfc.get("/config", (_req, res) => {
  res.json({ configured: tfcConfig() !== null });
});

// ── POST /api/my/tfc/link/start ──────────────────────────────────────────
const startSchema = z.object({
  childId: z.string().trim().max(60).optional(),
  childName: z.string().trim().max(80).optional(),
  /** The parent's own reference from the TFC portal, if they've typed it at
   *  checkout. Falls back to the one saved on the child. */
  reference: z.string().trim().max(40).optional(),
});

tfc.post("/link/start", async (req, res) => {
  const cfg = tfcConfig();
  if (!cfg) { res.json({ configured: false }); return; }
  const p = startSchema.safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: p.error.issues }); return; }
  const uid = req.user!.uid;
  const child = await myChild(uid, p.data);
  if (!child) { res.status(404).json({ error: "Child not found" }); return; }

  const existing = await myLink(uid, child.id);
  const reference = (p.data.reference || existing?.reference || String(child.get("tfcReference") ?? "")).trim();

  // A link this family already holds: no need to send them to GOV.UK again.
  // HMRC's link call is the confirmation, so we re-run it against the stored
  // token — which also proves the token is still good, and refreshes it when
  // it isn't. This is the spec's "returning parent" case: the children that
  // are linked stay linked.
  const tokens = existing ? tokensOf(existing) : null;
  if (tokens && reference) {
    const done = await completeLink(cfg, child, tokens, reference, uid);
    res.json({ configured: true, ...done });
    return;
  }

  // No reference and no date of birth means HMRC cannot link this child
  // whatever happens next, so don't send the family to GOV.UK to sign in for
  // nothing. They type the reference on the same row and press the button
  // again. (The failure screen's own advice is to pay from HMRC and give us
  // the reference, which also works.)
  if (!looksLikeTfcRef(reference) || !isoDob(child.get("dob"))) {
    res.json({ configured: true, linked: false, failure: "connection-failed" satisfies TfcFailure });
    return;
  }

  // Otherwise: the GOV.UK hand-off. `state` is the only thing tying HMRC's
  // redirect back to this parent and this child, so it is a 32-byte random
  // id, single use, and dead in 15 minutes.
  const state = randomBytes(32).toString("hex");
  const doc: StateDoc = {
    parentUid: uid,
    childId: child.id,
    ...(reference ? { reference } : {}),
    status: "pending",
    createdAt: new Date().toISOString(),
    expiresAt: Date.now() + STATE_TTL_MS,
  };
  await statesCol.doc(state).set(doc);
  res.json({ configured: true, url: authorizeUrl(cfg, state), state });
});

/**
 * Run HMRC's link call and record the result. Shared by the "already linked"
 * shortcut above and the OAuth callback below.
 */
async function completeLink(
  cfg: NonNullable<ReturnType<typeof tfcConfig>>,
  child: FirebaseFirestore.DocumentSnapshot,
  tokens: TfcTokens,
  reference: string,
  uid: string,
): Promise<{ linked: boolean; reference?: string; childFullName?: string; failure?: TfcFailure }> {
  const dob = isoDob(child.get("dob"));
  if (!reference || !looksLikeTfcRef(reference) || !dob) {
    // HMRC needs the parent's 12-character reference AND the child's date of
    // birth to link. Neither is something we can invent — E0025/E0026 is
    // exactly what inventing one earns. The checkout already asks for both,
    // so the recovery is: type them in and press Login with HMRC again.
    await linksCol.doc(child.id).set(
      { parentUid: uid, childId: child.id, childName: child.get("name") ?? null, linked: false, failure: "connection-failed" satisfies TfcFailure, ...(reference ? { reference } : {}) },
      { merge: true },
    );
    return { linked: false, failure: "connection-failed" };
  }
  const r = await withFreshTokens(cfg, tokens, (t) => saveTokens(child.id, t), (t) =>
    linkAccount(cfg, t, { outboundChildPaymentRef: reference, childDateOfBirth: dob }));
  if (!r.ok) {
    await linksCol.doc(child.id).set({ parentUid: uid, childId: child.id, linked: false, failure: r.failure, reference }, { merge: true });
    return { linked: false, failure: r.failure };
  }
  const childFullName = r.data.child_full_name ?? "";
  await linksCol.doc(child.id).set(
    {
      parentUid: uid,
      childId: child.id,
      childName: child.get("name") ?? null,
      reference,
      childFullName,
      linked: true,
      linkedAt: new Date().toISOString(),
      failure: null,
    },
    { merge: true },
  );
  // Save the reference on the child so a returning family never links twice —
  // the same field the manual path writes (routes/my.ts, childSchema).
  if (String(child.get("tfcReference") ?? "").trim() !== reference) {
    await child.ref.set({ tfcReference: reference }, { merge: true });
  }
  return { linked: true, reference, childFullName };
}

// ── GET /api/my/tfc/link/status?state=… ──────────────────────────────────
// The browser polls this while the GOV.UK window is open. The state belongs
// to the parent who started it and to nobody else.
tfc.get("/link/status", async (req, res) => {
  const state = String(req.query.state ?? "").trim();
  if (!state) { res.status(400).json({ error: "state is required" }); return; }
  const snap = await statesCol.doc(state).get();
  if (!snap.exists || snap.get("parentUid") !== req.user!.uid) { res.status(404).json({ error: "Unknown sign-in" }); return; }
  const d = snap.data() as StateDoc;
  // Terminal answers are read once and the record is then thrown away: it has
  // done its job, and nothing should keep a child id and a payment reference
  // lying around for the life of the database. A poll that finds it gone is
  // treated by the browser as a failed link, which recovers by re-linking (and
  // an already-linked child links instantly).
  const forget = () => void snap.ref.delete().catch(() => { /* it expires anyway */ });
  if (d.status === "linked") {
    res.json({ done: true, linked: true, reference: d.reference ?? null, childFullName: d.childFullName ?? null });
    forget();
    return;
  }
  if (d.status === "failed") { res.json({ done: true, linked: false, failure: d.failure ?? "connection-failed" }); forget(); return; }
  if (d.expiresAt <= Date.now()) { res.json({ done: true, linked: false, failure: "connection-failed" }); forget(); return; }
  res.json({ done: false });
});

// ── POST /api/my/tfc/balance ─────────────────────────────────────────────
// The live balance for one linked child. The checkout shows this figure as
// the family's real money, so there is no fallback here: if HMRC can't be
// asked, this answers ok:false and the line simply doesn't appear.
const refSchema = z.object({ reference: z.string().trim().min(1).max(40) });

tfc.post("/balance", async (req, res) => {
  const cfg = tfcConfig();
  if (!cfg) { res.json({ ok: false, failure: "not-connected" satisfies TfcFailure }); return; }
  const p = refSchema.safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: p.error.issues }); return; }
  const link = await linkForReference(req.user!.uid, p.data.reference);
  if (!link) { res.json({ ok: false, failure: "not-connected" satisfies TfcFailure }); return; }
  const tokens = tokensOf(link);
  if (!tokens) { res.json({ ok: false, failure: "not-connected" satisfies TfcFailure }); return; }
  const r = await withFreshTokens(cfg, tokens, (t) => saveTokens(link.childId, t), (t) =>
    accountBalance(cfg, t, { outboundChildPaymentRef: link.reference! }));
  if (!r.ok) {
    if (r.failure === "connection-expired") await linksCol.doc(link.childId).set({ linked: false, failure: r.failure }, { merge: true });
    res.json({ ok: false, failure: r.failure });
    return;
  }
  res.json({
    ok: true,
    // What can be spent today — HMRC's own rule is that a payment may not
    // exceed cleared funds, so this is the figure to warn against.
    amount: r.data.clearedFunds,
    status: r.data.status,
    totalBalance: r.data.totalBalance,
    paidInByYou: r.data.paidInByYou,
    governmentTopUp: r.data.governmentTopUp,
    topUpAllowance: r.data.topUpAllowance,
  });
});

/** The caller's own link carrying this reference — the browser sends a
 *  reference, never a child id, and a reference is not a credential. */
async function linkForReference(uid: string, reference: string): Promise<LinkDoc | null> {
  const ref = reference.trim();
  if (!ref) return null;
  // Equality-only on two fields: Firestore serves this from single-field
  // indexes, no composite index needed.
  const q = await linksCol.where("parentUid", "==", uid).where("reference", "==", ref).limit(1).get();
  const d = q.docs[0];
  return d ? (d.data() as LinkDoc) : null;
}

// ── POST /api/my/tfc/pay ─────────────────────────────────────────────────
const paySchema = z.object({
  /** The provider whose bookings these are (booking numbers repeat across providers). */
  tenantId: z.string().trim().min(1).max(60),
  /** The bookings to pay from Tax-Free Childcare. The amount, the child and the
   *  TFC account are all worked out HERE from the parent's own bookings and
   *  links — the browser never names a sum, a payee or a reference. */
  refs: z.array(z.string().trim().min(1).max(40)).min(1).max(40),
  /** One id per payment the parent intends. A repeat with the same key (a
   *  retry, a double-click) replays the first outcome and never re-sends. */
  idempotencyKey: z.string().trim().min(8).max(80).regex(/^[A-Za-z0-9_-]+$/).optional(),
});

/** Firestore-backed payment ledger for payOnce(): create() is the atomic claim. */
const payStore: PayStore = {
  async begin(id, rec) {
    const ref = paymentsCol.doc(id);
    try {
      await ref.create({ ...rec, createdAt: new Date().toISOString() });
      return null;
    } catch {
      const cur = await ref.get();
      if (cur.exists) return cur.data() as PayRec;
      throw new Error("could not record payment intent");
    }
  },
  async finish(id, patch) {
    await paymentsCol.doc(id).set({ ...patch, updatedAt: new Date().toISOString() }, { merge: true });
  },
};

const PAY_LOCK_MS = 60_000;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** What HMRC is asked for on one booking: the TFC share of a part-paid booking,
 *  else everything still owed on it. */
const tfcDueOf = (b: Booking) => round2(Number(b.tfcAmount ?? 0) > 0 ? Number(b.tfcAmount) : owedOf(b));

/** One child's slice of the request — one HMRC payment per child, because each
 *  child has their own TFC account. */
type ChildPayResult =
  | { childId: string; child: string; refs: string[]; amount: number; ok: true; paymentReference: string; estimatedPaymentDate: string }
  | { childId: string | null; child: string; refs: string[]; amount: number; ok: false; failure: TfcFailure; uncertain?: boolean };

tfc.post("/pay", async (req, res) => {
  const cfg = tfcConfig();
  if (!cfg) { res.json({ ok: false, failure: "not-connected" satisfies TfcFailure }); return; }
  const p = paySchema.safeParse(req.body);
  if (!p.success) { res.status(400).json({ error: p.error.issues }); return; }
  const uid = req.user!.uid;
  const email = req.user?.email;
  if (!email) { res.status(400).json({ error: "Account has no email address" }); return; }
  const { tenantId, refs } = p.data;

  // The parent's own bookings at this provider — email-scoped, so another
  // family's booking number is simply never found.
  const snaps = await Promise.all([...new Set(refs)].map((ref) => bookingsCol.doc(bookingDocId(tenantId, ref)).get()));
  const mine = snaps.filter((d) => d.exists && d.get("email") === email);
  if (mine.length !== new Set(refs).size) { res.status(404).json({ error: "Booking not found" }); return; }

  // Only places that are actually held and still waiting on the scheme's money.
  // A waiting-list place owes nothing; one already requested is never sent twice.
  const due = mine
    .map((d) => ({ snap: d, b: fromDoc(d.data() as BookingDoc) }))
    .filter(({ b }) => b.status !== "Waitlisted" && b.status !== "Cancelled" && b.pay === "Awaiting voucher payment" && !b.tfcPayment && tfcDueOf(b) > 0);
  if (!due.length) { res.json({ ok: true, payments: [], nothingDue: true }); return; }

  const provider = await providerIdentity(tenantId);
  if (!provider) {
    // We can't name the provider to HMRC, so there is nothing to ask for. The
    // parent gets the manual path and the provider is told (in Setup) that
    // their childcare registration details are missing.
    console.warn(`[tfc] payment skipped: tenant ${tenantId} has no settings.childcare registration number / postcode`);
    res.json({ ok: false, failure: "not-connected" satisfies TfcFailure });
    return;
  }

  // Group by child: each child pays from their own linked TFC account.
  const myChildren = await childrenCol.where("parentUid", "==", uid).get();
  const childIdByName = new Map(myChildren.docs.map((c) => [String(c.get("name") ?? "").trim().toLowerCase(), c.id]));
  const groups = new Map<string, { childId: string | null; child: string; items: typeof due }>();
  for (const it of due) {
    const childId = it.b.childId ?? childIdByName.get(String(it.b.child ?? "").trim().toLowerCase()) ?? null;
    const key = childId ?? `name:${it.b.child}`;
    const g = groups.get(key) ?? { childId, child: it.b.child ?? "", items: [] };
    g.items.push(it);
    groups.set(key, g);
  }

  const results: ChildPayResult[] = [];
  for (const g of groups.values()) {
    const amount = round2(g.items.reduce((sum, it) => sum + tfcDueOf(it.b), 0));
    const base = { child: g.child, refs: g.items.map((it) => it.b.ref), amount };
    const linkSnap = g.childId ? await linksCol.doc(g.childId).get() : null;
    const link = linkSnap?.exists ? (linkSnap.data() as LinkDoc) : null;
    const tokens = link && link.parentUid === uid ? tokensOf(link) : null;
    if (!g.childId || !link || link.parentUid !== uid || !tokens || !link.reference || link.linked !== true) {
      results.push({ ...base, childId: g.childId, ok: false, failure: link?.failure === "connection-expired" ? "connection-expired" : "not-connected" });
      continue;
    }
    const childId = g.childId;

    // One payment in flight per child: a second request while the first is out
    // is refused rather than queued (double-submit / two tabs).
    const lockRef = db.collection("tfcPayLocks").doc(childId);
    const locked = await db.runTransaction(async (tx) => {
      const cur = await tx.get(lockRef);
      if (cur.exists && (cur.get("expiresAt") as number) > Date.now()) return false;
      tx.set(lockRef, { parentUid: uid, expiresAt: Date.now() + PAY_LOCK_MS });
      return true;
    });
    if (!locked) { results.push({ ...base, childId, ok: false, failure: "connection-failed" }); continue; }

    // The intent is written BEFORE HMRC is called, keyed by the idempotency key
    // (or a fresh id), so a crash between "HMRC paid" and "we recorded it" leaves
    // a pending row to reconcile rather than no trace at all.
    const payId = p.data.idempotencyKey ? `${childId}_${p.data.idempotencyKey}` : `${childId}_${randomBytes(12).toString("hex")}`;
    let r;
    try {
      r = await payOnce(payStore, payId, async () => {
        // Audit context on the row (no tokens, no secrets).
        await paymentsCol.doc(payId).set({
          parentUid: uid, childId, reference: link.reference, tenantId, refs: base.refs, amount,
        }, { merge: true }).catch((e) => console.error("[tfc] could not annotate payment intent:", (e as Error).message));
        return withFreshTokens(cfg, tokens, (t) => saveTokens(childId, t), (t) =>
          submitPayment(cfg, t, {
            outboundChildPaymentRef: link.reference!,
            amount,
            ccpRegReference: provider.registrationNumber,
            ccpPostcode: provider.postcode,
          }));
      });
    } finally {
      await lockRef.delete().catch(() => { /* expires in a minute anyway */ });
    }

    if (!r.ok) {
      if (r.failure === "connection-expired") await linksCol.doc(childId).set({ linked: false, failure: r.failure }, { merge: true });
      results.push({ ...base, childId, ok: false, failure: r.failure, ...(r.uncertain ? { uncertain: true } : {}) });
      continue;
    }
    // HMRC has accepted the request; the money reaches the provider on or
    // around the estimated date, so the booking keeps waiting on the scheme
    // ("Awaiting voucher payment") and carries the payment so it is never
    // requested twice and the provider can match it when it lands.
    const tfcPayment = {
      paymentReference: r.data.paymentReference,
      estimatedPaymentDate: r.data.estimatedPaymentDate,
      amount,
      requestedAt: new Date().toISOString(),
    };
    await Promise.all(g.items.map((it) =>
      it.snap.ref.set({ tfcPayment: { ...tfcPayment, amount: tfcDueOf(it.b) } }, { merge: true }).catch((e) =>
        console.error(`[tfc] paid but could not stamp booking ${it.b.ref}:`, (e as Error).message))));
    results.push({ ...base, childId, ok: true, paymentReference: r.data.paymentReference, estimatedPaymentDate: r.data.estimatedPaymentDate });
  }

  const failed = results.find((x) => !x.ok) as Extract<ChildPayResult, { ok: false }> | undefined;
  res.json({
    ok: !failed,
    payments: results,
    ...(failed ? { failure: failed.failure, ...(results.some((x) => !x.ok && x.uncertain) ? { uncertain: true } : {}) } : {}),
  });
});

// ── GET /api/my/tfc/links ────────────────────────────────────────────────
// Which of the caller's children hold a live HMRC link. The checkout shows
// "linked" from THIS, never from a reference saved on the child: the manual
// path saves a reference too, and a reference is not a sign-in.
tfc.get("/links", async (req, res) => {
  if (!tfcConfig()) { res.json({ configured: false, links: [] }); return; }
  const q = await linksCol.where("parentUid", "==", req.user!.uid).get();
  const links = q.docs
    .map((d) => d.data() as LinkDoc)
    .filter((l) => l.linked === true && !!l.reference && !!l.accessToken)
    .map((l) => ({ childId: l.childId, childName: l.childName ?? null, reference: l.reference }));
  res.json({ configured: true, links });
});

/**
 * Who HMRC pays: the provider's regulator registration number and the
 * postcode registered with it (`ccp_reg_reference` / `ccp_postcode`).
 *
 * Straight from the tenant's own Setup — `settings.childcare` (spec Part B1),
 * normalised on the way in by lib/childcare.ts, which is also what the
 * reconciliation half reads. Never from the browser: a request that could name
 * its own payee is a request that can send a family's childcare money
 * somewhere else.
 *
 * TODO(b8): a parent's request carries no franchiseId, so this reads head
 * office's settings. When a booking belongs to a franchise with its own
 * registration, resolve the franchise from the booking and pass it through.
 */
async function providerIdentity(tenantId?: string): Promise<{ registrationNumber: string; postcode: string } | null> {
  if (!tenantId) return null;
  const cc = await loadChildcareSettings(tenantId).catch(() => null);
  if (!cc || !childcareSettingsComplete(cc)) return null;
  return { registrationNumber: cc.registrationNumber, postcode: cc.postcode };
}

// ── GET /api/tfc/callback ────────────────────────────────────────────────
// HMRC redirects the PARENT'S BROWSER here after they sign in at GOV.UK, so
// there is no Authorization header to require — the `state` is the proof.
// It is 32 random bytes, bound to one parent and one child, single use, and
// valid for 15 minutes. A code without a live state does nothing at all.
const callbackPage = (title: string, message: string, ok: boolean) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head><body style="font-family:system-ui,-apple-system,Arial,sans-serif;background:#f4f7fc;margin:0;padding:44px 16px"><div style="max-width:440px;margin:0 auto;background:#fff;border-radius:18px;padding:30px;text-align:center;box-shadow:0 16px 44px -22px rgba(20,33,58,.5)"><div style="font-size:42px">${ok ? "✅" : "⚠️"}</div><h1 style="font-size:21px;color:#16306e;margin:10px 0 8px">${esc(title)}</h1><p style="font-size:14px;color:#5b6472;line-height:1.55;margin:0">${esc(message)}</p></div><script>try{window.opener&&window.opener.postMessage({source:"aos-tfc",ok:${ok ? "true" : "false"}},"*");}catch(e){}setTimeout(function(){try{window.close();}catch(e){}},1200);</script></body></html>`;
const esc = (v: unknown): string =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

tfcCallback.get("/", async (req, res) => {
  const html = (title: string, message: string, ok: boolean, status = 200) =>
    res.status(status).set("Content-Type", "text/html").send(callbackPage(title, message, ok));

  const cfg = tfcConfig();
  if (!cfg) { html("Not connected", "Paying HMRC directly isn't switched on here. Close this window and pay from your HMRC account as usual.", false, 503); return; }

  const state = String(req.query.state ?? "").trim();
  const code = String(req.query.code ?? "").trim();
  const snap = state ? await statesCol.doc(state).get() : null;
  if (!snap?.exists) { html("That link has expired", "Close this window and select 'Login with HMRC' again.", false, 400); return; }
  const d = snap.data() as StateDoc;
  if (d.status !== "pending" || d.expiresAt <= Date.now()) {
    html("That link has expired", "Close this window and select 'Login with HMRC' again.", false, 400);
    return;
  }
  // Single use: claim it ATOMICALLY before doing anything that can be replayed
  // (a read-then-write would let two concurrent redirects both pass).
  const claimed = await db.runTransaction(async (tx) => {
    const cur = await tx.get(snap.ref);
    if (!cur.exists || cur.get("status") !== "pending") return false;
    tx.update(snap.ref, { status: "working" });
    return true;
  });
  if (!claimed) { html("That link has expired", "Close this window and select 'Login with HMRC' again.", false, 400); return; }

  const finish = async (failure: TfcFailure | null, childFullName?: string, reference?: string) => {
    await snap.ref.set(
      failure ? { status: "failed", failure } : { status: "linked", failure: null, childFullName: childFullName ?? "", ...(reference ? { reference } : {}) },
      { merge: true },
    );
  };

  // The parent said no at GOV.UK, or HMRC refused. `req.query.error` is an
  // OAuth error name, not anything private.
  const oauthError = String(req.query.error ?? "").trim();
  if (oauthError || !code) {
    console.warn(`[tfc] callback without a code (${oauthError || "no error given"})`);
    await finish("connection-failed");
    html("HMRC sign-in didn't complete", "Close this window and try again, or pay from your HMRC account and give us the payment reference.", false);
    return;
  }

  const tokenRes = await exchangeCode(cfg, code);
  if (!tokenRes.ok) {
    await finish(tokenRes.failure);
    html("HMRC connection failed", "Close this window and select 'Login with HMRC' to try again.", false);
    return;
  }

  const child = await childrenCol.doc(d.childId).get();
  if (!child.exists || child.get("parentUid") !== d.parentUid) {
    // The child was removed (or never belonged to this parent) between the
    // hand-off starting and coming back. The tokens are not stored.
    await finish("connection-failed");
    html("We couldn't finish linking", "That child's record has changed. Close this window and try again.", false);
    return;
  }

  // Store the tokens first: the OAuth half succeeded, and keeping them means a
  // retry (e.g. after a mistyped reference) doesn't send the family back to
  // GOV.UK. See the token-storage note at the top of this file.
  await linksCol.doc(child.id).set(
    {
      parentUid: d.parentUid,
      childId: child.id,
      childName: child.get("name") ?? null,
      accessToken: sealToken(tokenRes.data.accessToken),
      refreshToken: sealToken(tokenRes.data.refreshToken),
      expiresAt: tokenRes.data.expiresAt,
      linked: false,
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  );

  const reference = (d.reference || String(child.get("tfcReference") ?? "")).trim();
  const done = await completeLink(cfg, child, tokenRes.data, reference, d.parentUid);
  if (!done.linked) {
    await finish(done.failure ?? "connection-failed");
    html("We couldn't finish linking", "Close this window, check the reference on your HMRC account and try again — or pay from HMRC and give us the payment reference.", false);
    return;
  }
  await finish(null, done.childFullName, done.reference);
  html("Account linked", `${done.childFullName || "This child"}'s Tax-Free Childcare account is connected. You can close this window and carry on with your booking.`, true);
});
