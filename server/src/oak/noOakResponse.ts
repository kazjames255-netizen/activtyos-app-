// Render-time enforcement of the OWNER RULE (see noOak.ts): nothing under /api/learning-hub may leave the server
// mentioning the publisher, whatever is stored. Stored notes can predate the import scrubber, so every JSON / HTML
// response is checked (cheap regex pre-test) and scrubbed only when it matches. Covers notes, lessons, homework,
// search results, exports/print HTML and preview emails, for tutor, parent and kid alike.
import type { Request, Response, NextFunction } from "express";
import { BRAND_RE, mentionsOak, scrubDeep, scrubText } from "./noOak";

const QUICK = /oak|thenational\.academy|\bOGL\b|government licen/i;

/** HTML (digest email, print view): scrub the text nodes only, leave markup untouched. */
export function scrubHtml(html: string): string {
  if (!QUICK.test(html) || (!BRAND_RE.test(html) && !/\boak\b/i.test(html))) return html;
  return html.replace(/>([^<>]+)</g, (m, t: string) => (mentionsOak(t) || /thenational\.academy|oaknational/i.test(t) ? `>${scrubText(t)}<` : m));
}

/** JSON-ish value: deep scrub (drops brand slides, brand sentences, brand links). Returns the same object when clean. */
export function scrubPayload<T>(v: T): T {
  let s: string;
  try { s = JSON.stringify(v); } catch { return v; }
  if (!s || !QUICK.test(s)) return v;
  return dropAttribution(scrubDeep(v).value) as T;
}

/** `source.attribution` / `source.licence` are provenance (skipped by scrubDeep as internal), but they hold the credit line
 *  verbatim, so they never leave the API either. */
function dropAttribution(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(dropAttribution);
  if (x && typeof x === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, y] of Object.entries(x)) {
      if ((k === "attribution" || k === "licence") && typeof y === "string" && (BRAND_RE.test(y) || /OGL/.test(y))) continue;
      o[k] = dropAttribution(y);
    }
    return o;
  }
  return x;
}

export function noOakResponse(_req: Request, res: Response, next: NextFunction): void {
  const json = res.json.bind(res);
  res.json = (body?: unknown) => json(scrubPayload(body));
  const send = res.send.bind(res);
  res.send = (body?: unknown) => (typeof body === "string" && /html/i.test(String(res.get("Content-Type") ?? "")) ? send(scrubHtml(body)) : send(body as never));
  next();
}
