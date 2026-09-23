import type { NextFunction, Request, Response } from "express";
import { db } from "../firebase";

// The six account types from the product spec, enforced server-side, now
// with real tenancy:
//
//   platform   — ActivityOS super-admin: sees every tenant (read-only on
//                bookings for now).
//   company    — owns a company tenant (Head Office): full access to the
//                whole tenant, including its franchises' data.
//   freelancer — owns a freelancer (solo) tenant: full access to it.
//   franchise  — belongs to a company tenant; scoped to its own
//                franchiseId subset, read/write.
//   staff      — belongs to a tenant; read-only.
//   parent     — the customer portal: /api/my/* and listings only.
//
// parent / company / freelancer provision themselves at signup
// (POST /api/register-role — operators create their tenant there).
// franchise / staff join through invite links (/api/invites).
export type Role = "platform" | "company" | "franchise" | "freelancer" | "staff" | "parent";

export const ALL_ROLES: Role[] = [
  "platform",
  "company",
  "franchise",
  "freelancer",
  "staff",
  "parent",
];

export interface AuthContext {
  role: Role;
  tenantId: string | null;
  franchiseId: string | null;
  /** Staff only: a lead (Team & invites → "Lead"). Every "leads only"
   *  setting lets a lead through and refuses other staff. */
  lead?: boolean;
  /** Staff only: their Setup → Roles & permissions role id (users.permRole,
   *  else the role picked on their invite, users.staffRole). */
  permRole?: string | null;
  /** Staff only: what that role may do per area, once resolved by
   *  middleware/access.ts. null/absent = not restricted. */
  caps?: Record<string, "none" | "view" | "edit"> | null;
  /** Staff only: the sites/listings they were assigned to on their invite
   *  (Team & invites). mode "locations" = venue ids; see lib/siteScope.ts. */
  assignment?: { mode: string; ids: string[] } | null;
}

/** The staff-only fields of AuthContext, from a users doc. */
function staffFields(d: FirebaseFirestore.DocumentData): Pick<AuthContext, "lead" | "permRole" | "assignment"> {
  if (normalizeRole(d.role) !== "staff") return { lead: false };
  const a = d.assignment as { mode?: unknown; ids?: unknown } | undefined;
  return {
    lead: d.lead === true,
    permRole: (typeof d.permRole === "string" && d.permRole) || (typeof d.staffRole === "string" && d.staffRole) || null,
    assignment: a && typeof a.mode === "string" ? { mode: a.mode, ids: Array.isArray(a.ids) ? a.ids.map(String) : [] } : null,
  };
}

/** A member of staff who ISN'T a lead — who "leads only" settings refuse. */
export const isPlainStaff = (auth: Pick<AuthContext, "role" | "lead">) => auth.role === "staff" && !auth.lead;

declare module "express-serve-static-core" {
  interface Request {
    auth?: AuthContext;
    // Set when a Platform (HQ) owner is viewing the app AS another account.
    impersonating?: { byUid: string; byEmail: string | null; uid: string };
  }
}

function normalizeRole(role: string | undefined): Role {
  // Migration: milestone-2 accounts stored the pre-six-roles "provider".
  if (role === "provider") return "freelancer";
  return ALL_ROLES.includes(role as Role) ? (role as Role) : "parent";
}

export async function attachRole(req: Request, _res: Response, next: NextFunction) {
  const user = req.user;
  if (!user) {
    next(new Error("attachRole must run after requireAuth"));
    return;
  }
  const ref = db.collection("users").doc(user.uid);
  const snap = await ref.get();
  if (snap.exists) {
    const d = snap.data()!;
    // A switched-off account (Team → Deactivate, or a closed parent account)
    // gets nothing. Before this there was no way to put anyone out: a token
    // stayed good for everything until it expired, and a refreshed one forever.
    if (d.disabled === true && normalizeRole(d.role) !== "platform") {
      _res.status(403).json({ error: "This account has been switched off. Contact the provider if you think that's wrong.", code: "account_disabled" });
      return;
    }
    // A parent who CLOSED their own account can reopen it — that one route
    // stays open; everything else is refused until they do.
    if (d.deactivatedAt && normalizeRole(d.role) !== "platform" && !req.originalUrl.startsWith("/api/account/reactivate")) {
      _res.status(403).json({ error: "You closed this account. Reopen it to carry on — your bookings and history are still here.", code: "account_closed" });
      return;
    }
    const role = normalizeRole(d.role);
    // Mandatory email 2FA for the platform (HQ super-admin) portal — a small,
    // manually-provisioned set of accounts (routes/twoFa.ts). A platform
    // account only gets `req.auth.role = "platform"` (and so only reaches
    // any /platform/* page or API) once `twoFaVerifiedAt` is set and still
    // within this session TTL; otherwise every /api/* request 403s with
    // `2fa_required`, including GET /api/me — the client reads that as "show
    // the code-entry step". 12h: long enough not to re-prompt mid-shift,
    // short enough that a stolen token alone (no email access) can't sit
    // valid indefinitely.
    const TWO_FA_TTL_MS = 12 * 60 * 60_000;
    if (role === "platform") {
      const verifiedAt = Number(d.twoFaVerifiedAt) || 0;
      if (!verifiedAt || Date.now() - verifiedAt > TWO_FA_TTL_MS) {
        _res.status(403).json({ error: "Two-factor verification required.", code: "2fa_required" });
        return;
      }
    }
    req.auth = {
      role,
      tenantId: d.tenantId ?? null,
      franchiseId: d.franchiseId ?? null,
      ...staffFields(d),
    };
  } else {
    await ref.set({ email: user.email ?? null, role: "parent" });
    req.auth = { role: "parent", tenantId: null, franchiseId: null };
  }
  await applyImpersonation(req, user);
  next();
}

// ── Platform (HQ) impersonation ─────────────────────────────────────────────
// SECURITY-CRITICAL: only a genuine platform account may act as another user.
// When it does, we swap req.auth + req.user to the TARGET so every downstream
// route behaves exactly as that account would (their tenant, their email scope).
// Guarded strictly on the REAL account's role; header-driven so it's per-request
// and never persisted server-side. (Flagged for Amir's security review.)
async function applyImpersonation(req: Request, realUser: NonNullable<Request["user"]>) {
  if (req.auth?.role !== "platform") return;
  const actAs = (req.header("x-act-as") || "").trim();
  if (!actAs || actAs === realUser.uid) return;
  const tSnap = await db.collection("users").doc(actAs).get();
  if (!tSnap.exists) return;
  const t = tSnap.data()!;
  req.auth = { role: normalizeRole(t.role), tenantId: t.tenantId ?? null, franchiseId: t.franchiseId ?? null, ...staffFields(t) };
  // Email/uid scoping (parents, message senderName, etc.) must be the target too.
  req.user = { ...realUser, uid: actAs, email: (t.email as string) ?? realUser.email, name: (t.name as string) ?? realUser.name } as typeof realUser;
  req.impersonating = { byUid: realUser.uid, byEmail: realUser.email ?? null, uid: actAs };
  console.warn(`[impersonate] platform ${realUser.email ?? realUser.uid} acting as ${(t.email as string) ?? actAs} (${t.role ?? "parent"})`);
}

// After optionalAuth: signed-in users get their real role, anonymous
// visitors browse with parent-shaped (most restricted) permissions — every
// existing guard then behaves correctly without knowing about anonymity.
export async function attachRoleOptional(req: Request, res: Response, next: NextFunction) {
  if (req.user) {
    // Public pages: a switched-off or closed account browses as a visitor
    // rather than being refused the storefront outright.
    const u = await db.collection("users").doc(req.user.uid).get();
    if (u.exists && (u.get("disabled") === true || u.get("deactivatedAt")) && u.get("role") !== "platform") {
      req.auth = { role: "parent", tenantId: null, franchiseId: null };
      req.user = undefined;
      next();
      return;
    }
    await attachRole(req, res, next);
    return;
  }
  req.auth = { role: "parent", tenantId: null, franchiseId: null };
  next();
}

export const isOperator = (role: Role) => role !== "parent";

// Staff and platform can look but not mutate operator data.
export const canWrite = (role: Role) =>
  role === "company" || role === "freelancer" || role === "franchise";

/**
 * The tenant scope an account may read bookings/customers in.
 *  - platform: null tenant filter (all tenants; routes may accept ?tenantId=)
 *  - operators/staff: their own tenant (franchise additionally narrowed to
 *    its franchiseId by the routes)
 * Responds 403 and returns null when the account has no operator scope
 * (parents, or operators that never finished provisioning).
 */
export function operatorScope(
  req: Request,
  res: Response,
): { role: Role; tenantId: string | null; franchiseId: string | null } | null {
  const auth = req.auth!;
  if (!isOperator(auth.role)) {
    res.status(403).json({ error: "Requires an operator account" });
    return null;
  }
  if (auth.role !== "platform" && !auth.tenantId) {
    res.status(403).json({
      error: "Your account has no tenant — finish signup (or ask an admin to run set-role).",
    });
    return null;
  }
  return { role: auth.role, tenantId: auth.tenantId, franchiseId: auth.franchiseId };
}

/**
 * operatorScope minus STAFF — for the tenant's money (payment ledger,
 * reconciliation, dashboard figures, Stripe status) and full child records
 * pulled by booking. A coach's token used to return all of these: the screens
 * were hidden, the data was one request away.
 */
export function managerScope(
  req: Request,
  res: Response,
): { role: Role; tenantId: string | null; franchiseId: string | null } | null {
  const scope = operatorScope(req, res);
  if (!scope) return null;
  if (scope.role === "staff") {
    res.status(403).json({ error: "Requires a manager or owner account" });
    return null;
  }
  return scope;
}

export function requireOperator(req: Request, res: Response, next: NextFunction) {
  if (!req.auth || !isOperator(req.auth.role)) {
    res.status(403).json({ error: "Requires an operator account" });
    return;
  }
  next();
}
