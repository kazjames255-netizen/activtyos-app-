// Mass-bookings QA (fork F) — shared helpers. Own stack only: web :3016 -> API :4016. Throwaway @activityos-test.com accounts only.
import fs from "node:fs";
import path from "node:path";
import { fbSignUp, fbSignIn, TEST_EMAIL_DOMAIN } from "../helpers/accounts";
import { API_URL, ROOT } from "../helpers/env";

if (!/:4016$/.test(API_URL)) throw new Error(`Refusing to run: NEXT_PUBLIC_API_URL must be http://localhost:4016 (got ${API_URL})`);

export const SCRATCH = "/private/tmp/claude-501/-Users-kazjames-Downloads-activtyos-app-/90282caf-1701-4ffc-a82d-955cde3224d8/scratchpad";
export const STATE = path.join(SCRATCH, "mb-state.json");
export const MAIL = path.join(SCRATCH, "mail.jsonl");
export const SHOTS = path.join(ROOT, "docs/qa-overnight/mass-bookings-shots");
export const RUN = process.env.MB_RUN || "r1";
export const em = (k: string) => `qa-f-${k}-${RUN}@${TEST_EMAIL_DOMAIN}`;

export async function call(tok: string | null, method: string, url: string, body?: unknown) {
  const res = await fetch(`${API_URL}${url}`, { method, headers: { "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  let json: any = null; try { json = await res.json(); } catch { /* empty */ }
  return { status: res.status, json };
}
export const ok = async (tok: string | null, method: string, url: string, b?: unknown) => {
  const r = await call(tok, method, url, b);
  if (r.status >= 300) throw new Error(`${method} ${url} -> ${r.status} ${JSON.stringify(r.json).slice(0, 400)}`);
  return r.json;
};
export const load = () => JSON.parse(fs.readFileSync(STATE, "utf8"));
export const save = (s: unknown) => fs.writeFileSync(STATE, JSON.stringify(s, null, 1));
export const tokFor = async (email: string) => (await fbSignIn(email)).idToken;
export { fbSignUp, fbSignIn };

/** All mail the sink caught, decoded to {to, subject, text}. */
export function mails(): { to: string; subject: string; text: string; html: string }[] {
  if (!fs.existsSync(MAIL)) return [];
  return fs.readFileSync(MAIL, "utf8").split("\n").filter(Boolean).map((l) => {
    const raw: string = JSON.parse(l).raw;
    const [head, ...rest] = raw.split("\r\n\r\n");
    const hdr = (n: string) => (head.match(new RegExp(`^${n}:\\s*(.*(?:\\r\\n[ \\t].*)*)`, "im")) || [])[1]?.replace(/\r\n[ \t]/g, " ") ?? "";
    let body = rest.join("\r\n\r\n");
    if (/quoted-printable/i.test(raw)) body = body.replace(/=\r\n/g, "").replace(/=([0-9A-F]{2})/g, (_m, h) => String.fromCharCode(parseInt(h, 16)));
    if (/base64/i.test(head)) { try { body = Buffer.from(body.replace(/\s+/g, ""), "base64").toString("utf8"); } catch { /* keep */ } }
    // nodemailer encodes subjects as =?UTF-8?Q?..?= when non-ASCII
    let subject = hdr("Subject");
    subject = subject.replace(/=\?UTF-8\?([QB])\?([^?]*)\?=/gi, (_m, enc, t) => enc.toUpperCase() === "B" ? Buffer.from(t, "base64").toString("utf8") : Buffer.from(t.replace(/_/g, " ").replace(/=([0-9A-F]{2})/gi, (_x: string, h: string) => String.fromCharCode(parseInt(h, 16))), "latin1").toString("utf8"));
    const text = body.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&pound;/g, "£").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
    return { to: hdr("To"), subject, text, html: body };
  });
}
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
