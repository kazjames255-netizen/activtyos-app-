import type { NextFunction, Request, Response } from "express";
import type { DecodedIdToken } from "firebase-admin/auth";
import { auth } from "../firebase";

declare module "express-serve-static-core" {
  interface Request {
    user?: DecodedIdToken;
  }
}

// A token stays valid for up to an hour after it's issued. When an account's
// sessions are revoked (password change, "sign out everywhere", Team →
// Deactivate), Firebase stamps tokensValidAfterTime — so a token issued before
// that is refused here, not honoured until it expires (acceptance d26s3/d26s4).
// Looked up per account and cached briefly, so it isn't an Auth call per request.
const VALID_AFTER_TTL = 60_000;
const validAfter = new Map<string, { at: number; ms: number }>();
async function revokedBefore(uid: string): Promise<number> {
  const hit = validAfter.get(uid);
  if (hit && Date.now() - hit.at < VALID_AFTER_TTL) return hit.ms;
  let ms = 0;
  try {
    const u = await auth.getUser(uid);
    ms = u.tokensValidAfterTime ? Date.parse(u.tokensValidAfterTime) : 0;
  } catch { /* unknown to Auth — the token check itself already passed */ }
  if (validAfter.size > 20_000) validAfter.clear();
  validAfter.set(uid, { at: Date.now(), ms });
  return ms;
}
/** Forget the cached cut-off (call right after revoking an account's sessions). */
export function forgetRevocation(uid: string) { validAfter.delete(uid); }

/** Verify the token and refuse one issued before the account's sessions were revoked. */
export async function verifyFresh(token: string): Promise<DecodedIdToken> {
  const decoded = await auth.verifyIdToken(token);
  const cutoff = await revokedBefore(decoded.uid);
  // auth_time is when the person signed in (seconds); tokens refreshed from a
  // revoked session can't be minted, so this catches the ones already issued.
  if (cutoff && decoded.auth_time * 1000 < cutoff) throw new Error("revoked");
  return decoded;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Missing Authorization bearer token" });
    return;
  }
  try {
    req.user = await verifyFresh(token);
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
    req.user = await verifyFresh(token);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
