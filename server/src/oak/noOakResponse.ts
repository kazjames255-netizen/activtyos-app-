// Render-time enforcement of the OWNER RULE (see noOak.ts): nothing under /api/learning-hub may leave the server
// mentioning the publisher, whatever is stored. Stored notes can predate the import scrubber, so every JSON / HTML
// response is checked (cheap regex pre-test) and scrubbed only when it matches. Covers notes, lessons, homework,
// search results, exports/print HTML and preview emails, for tutor, parent and kid alike.
import type { Request, Response, NextFunction } from "express";
import { BRAND_RE, mentionsOak, scrubPayload, scrubText } from "./noOak";

export { scrubPayload }; // lives in noOak.ts now (the web app's i18n route uses it too)

const QUICK = /oak|thenational\.academy|\bOGL\b|government licen/i;

/** HTML (digest email, print view): scrub the text nodes only, leave markup untouched. */
export function scrubHtml(html: string): string {
  if (!QUICK.test(html) || (!BRAND_RE.test(html) && !/\boak\b/i.test(html))) return html;
  return html.replace(/>([^<>]+)</g, (m, t: string) => (mentionsOak(t) || /thenational\.academy|oaknational/i.test(t) ? `>${scrubText(t)}<` : m));
}

export function noOakResponse(_req: Request, res: Response, next: NextFunction): void {
  const json = res.json.bind(res);
  res.json = (body?: unknown) => json(scrubPayload(body));
  const send = res.send.bind(res);
  res.send = (body?: unknown) => (typeof body === "string" && /html/i.test(String(res.get("Content-Type") ?? "")) ? send(scrubHtml(body)) : send(body as never));
  next();
}
