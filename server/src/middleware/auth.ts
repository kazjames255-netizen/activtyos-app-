import type { NextFunction, Request, Response } from "express";
import type { DecodedIdToken } from "firebase-admin/auth";
import { auth } from "../firebase";

declare module "express-serve-static-core" {
  interface Request {
    user?: DecodedIdToken;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Missing Authorization bearer token" });
    return;
  }
  try {
    req.user = await auth.verifyIdToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

// For public storefront reads: a valid token attaches the user, no token
// continues anonymously — but a BAD token is still a 401, because silently
// downgrading a signed-in operator to anonymous would just look like their
// drafts had vanished.
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    next();
    return;
  }
  try {
    req.user = await auth.verifyIdToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
