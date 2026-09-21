import { gzipSync, constants } from "node:zlib";
import type { NextFunction, Request, Response } from "express";

// gzip for API responses, without a dependency. Wraps `res.send` (which `res.json` goes through), so every JSON /
// text body ≥ 1 KB goes out gzipped when the client accepts it. Anything written with `res.write` — the SSE event
// stream, streamed downloads — is untouched, as are images and other already-compressed media.
//
// Why it matters: the Learning Hub's big reads (topics 385 KB, flashcard stats 154 KB, a page of quizzes) compress
// 8–10×, and on a laptop-hosted dev stack the wire time was most of the wait.

const MIN_BYTES = 1024;
const COMPRESSIBLE = /^(application\/(json|javascript|xml|.*\+json|.*\+xml)|text\/|image\/svg)/i;

export function gzipResponses(req: Request, res: Response, next: NextFunction) {
  const accept = String(req.headers["accept-encoding"] ?? "");
  if (!/\bgzip\b/i.test(accept)) { next(); return; }
  const send = res.send.bind(res);
  res.send = ((body?: unknown) => {
    if (res.headersSent || res.getHeader("Content-Encoding") || typeof body === "object" && body !== null && !Buffer.isBuffer(body)) return send(body as never);
    if (typeof body !== "string" && !Buffer.isBuffer(body)) return send(body as never);
    const ct = String(res.getHeader("Content-Type") ?? "");
    if (String(res.getHeader("Cache-Control") ?? "").includes("no-transform") || (ct && !COMPRESSIBLE.test(ct))) return send(body as never);
    const raw = Buffer.isBuffer(body) ? body : Buffer.from(body, "utf8");
    if (raw.length < MIN_BYTES || req.method === "HEAD") return send(body as never);
    // A string body with no type yet: express would pick text/html — set it now so the check above stays honest next time.
    if (!ct) res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Encoding", "gzip");
    res.setHeader("Vary", [String(res.getHeader("Vary") ?? ""), "Accept-Encoding"].filter(Boolean).join(", "));
    return send(gzipSync(raw, { level: constants.Z_DEFAULT_COMPRESSION }));
  }) as Response["send"];
  next();
}
