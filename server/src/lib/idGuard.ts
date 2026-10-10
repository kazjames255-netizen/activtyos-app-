import type { NextFunction, Request, Response } from "express";

// One guard for every `:ref` / `:id` / `:token` in an /api path. A 2000-character id used to reach a Firestore query, which threw
// ("value for ref is too large to be used in a query"), became a 500 and raised the ops alarm; a NUL or backslash in an id is never a
// real id either. Anything that cannot be a real id is "no such record": a plain 404, before auth work or a database round trip.

/** Longest path segment any real id/token in the API uses (signed links are the longest, ~150). Firestore's own document-id limit is 1500 bytes. */
export const MAX_SEGMENT = 300;

export function badPathSegment(rawPath: string): boolean {
  for (const seg of rawPath.split("/")) {
    if (!seg) continue;
    if (seg.length > MAX_SEGMENT) return true;
    let dec: string;
    try { dec = decodeURIComponent(seg); } catch { return true; } // malformed %-escape
    if (dec.length > MAX_SEGMENT) return true;
    // eslint-disable-next-line no-control-regex
    if (/[\u0000-\u001f\u007f\\]/.test(dec)) return true;
  }
  return false;
}

export function pathIdGuard(req: Request, res: Response, next: NextFunction): void {
  if (req.path.startsWith("/api/") || req.path === "/api") {
    if (badPathSegment(req.path)) { res.status(404).json({ error: "Not found" }); return; }
  }
  next();
}
