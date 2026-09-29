import type { NextFunction, Request, Response } from "express";
import { db } from "../firebase";

// ─────────────────────────────────────────────────────────────────────────
// The real subscription wall. The client's SubscriptionGate is UX; this is
// the API deciding what a tenant whose bill has gone wrong can still do.
//
// THE GRACE MODEL (13 Sept 2026 — confirmed by Kaz, s13-sub3). Safety first: a
// billing problem must never take a provider out of the records that keep
// children safe while they're on site.
//
//   mode       when                                     what works
//   ─────────  ───────────────────────────────────────  ─────────────────────
//   full       active · trialing · "none" · canceling   everything
//              before its cancelAt · no record at all
//   grace      past_due, first GRACE_DAYS (14) days     everything — the UI
//              from pastDueSince                        shows a "payment
//                                                       failed — update card"
//                                                       banner
//   readonly   past_due beyond the grace period         every READ; writes
//                                                       only to SAFETY + OPEN
//   locked     canceled · unpaid · canceling past its   SAFETY (read + write),
//              cancelAt                                 SAFETY_READ (GET), OPEN
//
//   SAFETY      registers, children, incidents/accidents, medication, child
//               files (EHCP/care plans), uploads (incident photos) — marking
//               today's register, logging an accident, recording a dose and
//               reading a child's allergy/medical/emergency details work in
//               EVERY mode, locked included.
//   SAFETY_READ what those screens load alongside: who's booked (bookings),
//               parent contact numbers (customers), settings (library), the
//               head-office franchise filter (franchises). GET only.
//   OPEN        seeing/fixing the bill and the shell around it: subscription,
//               me, account, notifications, tenants, register-role, privacy
//               (GDPR export/erasure), support (Message ActivityOS / bug
//               reports), invites — except CREATING a new invite, which is
//               normal business and follows the mode. Deactivating a leaver
//               stays open: taking access away is a safeguarding action.
//
//   Who: the whole tenant team follows the tenant's mode — owner (freelancer /
//   company), franchise and staff alike — so staff can't carry on writing
//   while the owner is locked out. Parents are never walled here (their own
//   bookings and their children's records are theirs), nor is platform — but
//   once the provider is readonly or locked, a NEW parent booking or waitlist
//   join is refused in POST /api/my/bookings (takesNewBookings below).
//   "none" (a fresh signup yet to pick a plan) stays full API-side — the UI
//   gate walls it behind the plan picker.
//
// pastDueSince is stamped by lib/billing.ts (markPastDue / syncFromStripe);
// an overdue record without one (older data) is stamped here on first sight.
// "unpaid" is Stripe's end-of-dunning state — every retry spent. syncFromStripe
// maps it straight through (s13-sub4c, 21 Sept), so it LOCKS rather than
// lingering read-only until Stripe eventually cancels: by then the grace
// period is long gone and the card has been given every chance. The
// subscription still exists, so it's recoverable — POST /subscription/card
// (or /reactivate) pays the open invoice and the tenant goes straight back to
// active, which is why this isn't folded into "canceled".
// ─────────────────────────────────────────────────────────────────────────

export const GRACE_DAYS = 14;
export type AccessMode = "full" | "grace" | "readonly" | "locked";

// Matched as whole path segments under /api — a bare startsWith let "/me"
// open /medications, /messages, /meals… (acceptance test d19s5).
const OPEN = ["/subscription", "/me", "/account", "/notifications", "/tenants", "/register-role", "/invites", "/privacy", "/platform/support", "/support"];
const SAFETY = ["/registers", "/children", "/incidents", "/medications", "/my/files", "/uploads"];
const SAFETY_READ = ["/bookings", "/customers", "/library", "/franchises"];

const under = (path: string, list: string[]) => list.some((p) => path === p || path.startsWith(`${p}/`));
const isRead = (method: string) => method === "GET" || method === "HEAD" || method === "OPTIONS";

/** The tenant roles the wall applies to — everyone who works in the tenant. */
const TEAM_ROLES = new Set(["freelancer", "company", "franchise", "staff"]);
const OWNER_ROLES = new Set(["freelancer", "company"]);

export interface SubState { status: string; cancelAt: string | null; pastDueSince: string | null }

/** Pure: which mode a subscription record puts the tenant in, and (while
 *  past_due) when the grace period ends. Shared with GET /api/subscription. */
export function accessFor(s: SubState, now = Date.now()): { mode: AccessMode; graceEndsAt: string | null } {
  if (s.status === "canceled" || s.status === "unpaid") return { mode: "locked", graceEndsAt: null };
  if (s.status === "canceling" && !!s.cancelAt && s.cancelAt < new Date(now).toISOString()) return { mode: "locked", graceEndsAt: null };
  if (s.status === "past_due") {
    const since = Date.parse(s.pastDueSince ?? "") || now;
    const ends = since + GRACE_DAYS * 86_400_000;
    return { mode: now < ends ? "grace" : "readonly", graceEndsAt: new Date(ends).toISOString() };
  }
  return { mode: "full", graceEndsAt: null };
}

// One Firestore read per tenant per minute, not per request — Spark quota is
// a hard cap. Mutating endpoints clear their tenant's entry immediately.
const TTL_MS = 60_000;
const cache = new Map<string, SubState & { at: number }>();

export function clearSubscriptionCache(tenantId: string): void {
  cache.delete(tenantId);
}

export async function subscriptionState(tenantId: string): Promise<SubState> {
  const hit = cache.get(tenantId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit;
  const ref = db.collection("tenants").doc(tenantId);
  const t = await ref.get();
  const sub = t.exists ? (t.data()!.subscription as { status?: string; cancelAt?: string; pastDueSince?: string | null } | undefined) : undefined;
  const state = { status: sub?.status ?? "active", cancelAt: sub?.cancelAt ?? null, pastDueSince: sub?.pastDueSince ?? null, at: Date.now() };
  if ((state.status === "past_due" || state.status === "unpaid") && !state.pastDueSince) {
    state.pastDueSince = new Date().toISOString();
    await ref.set({ subscription: { pastDueSince: state.pastDueSince } }, { merge: true }).catch(() => {});
  }
  cache.set(tenantId, state);
  return state;
}

/** Is this provider taking NEW online bookings? Yes while full or in grace; no
 *  once read-only or locked (decided by Kaz 13 Sept, backlog s13-sub3). Only
 *  new places are refused — a family's existing bookings, cancellations and
 *  their own records carry on (parents are never walled). */
export async function takesNewBookings(tenantId: string): Promise<boolean> {
  const { mode } = accessFor(await subscriptionState(tenantId));
  return mode === "full" || mode === "grace";
}
export const NOT_TAKING_BOOKINGS = "This provider isn't taking online bookings right now — please contact them directly.";

function refusal(mode: "readonly" | "locked", owner: boolean, status: string): string {
  const still = "Registers, children's details, incidents, first aid and medication still work.";
  if (mode === "readonly") {
    return owner
      ? `Your last ActivityOS payment failed over ${GRACE_DAYS} days ago, so your account is read-only until you update your card in Money → Subscription. ${still}`
      : `Your provider's ActivityOS payment is overdue, so this is read-only for now. ${still}`;
  }
  // "unpaid" locks like a cancellation but ISN'T one — the subscription is
  // still there and a working card settles it immediately, so don't tell the
  // operator it has ended.
  if (status === "unpaid") {
    return owner
      ? `Your ActivityOS payment has failed every retry, so the account is paused. Update your card in Money → Subscription and we'll settle the outstanding invoice straight away. ${still}`
      : `Your provider's ActivityOS payment hasn't gone through, so this is paused for now. ${still}`;
  }
  return owner
    ? `Your ActivityOS subscription has ended — reactivate it in Money → Subscription to continue. ${still}`
    : `Your provider's ActivityOS subscription has ended. ${still}`;
}

export async function enforceSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = req.auth;
  if (!auth || !TEAM_ROLES.has(auth.role) || !auth.tenantId) {
    next();
    return;
  }
  // Creating an invite is new business, so it follows the mode; everything
  // else under /invites (list, revoke, switch a leaver off) stays open.
  const creatingInvite = req.method === "POST" && req.path === "/invites";
  if (under(req.path, OPEN) && !creatingInvite) {
    next();
    return;
  }
  const state = await subscriptionState(auth.tenantId);
  const { mode } = accessFor(state);
  const allowed =
    mode === "full" || mode === "grace"
    || under(req.path, SAFETY)
    || (isRead(req.method) && (mode === "readonly" || under(req.path, SAFETY_READ)));
  if (allowed) {
    next();
    return;
  }
  res.status(402).json({
    error: refusal(mode === "readonly" ? "readonly" : "locked", OWNER_ROLES.has(auth.role), state.status),
    code: mode === "readonly" ? "subscription_readonly" : "subscription_locked",
  });
}
