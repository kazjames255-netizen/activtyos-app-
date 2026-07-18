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
}

declare module "express-serve-static-core" {
  interface Request {
    auth?: AuthContext;
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
    req.auth = {
      role: normalizeRole(d.role),
      tenantId: d.tenantId ?? null,
      franchiseId: d.franchiseId ?? null,
    };
  } else {
    await ref.set({ email: user.email ?? null, role: "parent" });
    req.auth = { role: "parent", tenantId: null, franchiseId: null };
  }
  next();
}

// After optionalAuth: signed-in users get their real role, anonymous
// visitors browse with parent-shaped (most restricted) permissions — every
// existing guard then behaves correctly without knowing about anonymity.
export async function attachRoleOptional(req: Request, res: Response, next: NextFunction) {
  if (req.user) {
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

export function requireOperator(req: Request, res: Response, next: NextFunction) {
  if (!req.auth || !isOperator(req.auth.role)) {
    res.status(403).json({ error: "Requires an operator account" });
    return;
  }
  next();
}
