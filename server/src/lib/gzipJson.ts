import zlib from "node:zlib";
import type { NextFunction, Request, Response } from "express";

// gzip for the Learning Hub's JSON responses. The API had no compression at all: a hub first paint moved ~100 KB of
// topics and a few hundred KB of lists uncompressed. Mounted on the hub router only (routes/learningHub.ts), for
// clients that ask for it (every browser does) and bodies large enough to be worth the CPU.
const MIN_BYTES = 1024;

export function gzipJson(req: Request, res: Response, next: NextFunction) {
  if (!/\bgzip\b/.test(String(req.headers["accept-encoding"] ?? ""))) { next(); return; }
  const send = res.send.bind(res) as (body?: unknown) => Response;
  res.send = ((body?: unknown) => {
    const type = String(res.getHeader("Content-Type") ?? "");
    if (res.headersSent || res.getHeader("Content-Encoding") || !/json|text/.test(type) || (typeof body !== "string" && !Buffer.isBuffer(body))) return send(body);
    const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
    if (buf.length < MIN_BYTES) return send(body);
    res.vary("Accept-Encoding");
    zlib.gzip(buf, { level: 5 }, (err, z) => {
      if (err) { send(body); return; }
      res.setHeader("Content-Encoding", "gzip");
      send(z);
    });
    return res;
  }) as typeof res.send;
  next();
}
