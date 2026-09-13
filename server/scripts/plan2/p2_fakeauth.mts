// Plan-2 test harness: fake auth. "Bearer fake:<uid>[:<email>]" becomes req.user
// without Firebase Auth; any other bearer falls through to the real verifier.
import type { NextFunction, Request, Response } from "express";
import { verifyFresh } from "../../src/middleware/auth";

function fake(token: string) {
  if (!token.startsWith("fake:")) return null;
  const [, uid, email] = token.split(":");
  return { uid, email: email ? email.replace(/_at_/, "@") : `${uid}@p2test.local`, auth_time: Math.floor(Date.now() / 1000), name: uid } as any;
}
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) { res.status(401).json({ error: "Missing Authorization bearer token" }); return; }
  const f = fake(token);
  if (f) { req.user = f; next(); return; }
  try { req.user = await verifyFresh(token); next(); } catch { res.status(401).json({ error: "Invalid or expired token" }); }
}
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) { next(); return; }
  const f = fake(token);
  if (f) { req.user = f; next(); return; }
  try { req.user = await verifyFresh(token); next(); } catch { res.status(401).json({ error: "Invalid or expired token" }); }
}
export { verifyFresh };
