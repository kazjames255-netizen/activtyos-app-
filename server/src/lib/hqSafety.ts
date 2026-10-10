// Pure helpers for the HQ (platform) portal's safety rules. No database, no network: everything here is unit-tested in tests/hq-safety.test.mts.
//   - bank details are masked in every list payload (full details only through the audited Reveal route)
//   - the impersonation audit's short body hash (the body itself is never stored)
//   - price / feature-key / duplicate-cycle checks
//   - redaction of personal data before a support digest is sent to the AI model
import { createHash } from "node:crypto";
import { CA_FEATURES, featureKeysForView } from "../../../lib/accessMap";
import { NAV_GROUPS, PORTALS } from "../../../lib/nav/config";

// ── Bank details ────────────────────────────────────────────────────────────
/** "20-30-34" -> "**-**-34". Anything that is not six digits keeps only its last two characters. */
export function maskSortCode(v: unknown): string | null {
  if (v == null || v === "") return null;
  const d = String(v).replace(/\D/g, "");
  if (d.length === 6) return `**-**-${d.slice(4)}`;
  return d.length > 2 ? `${"*".repeat(d.length - 2)}${d.slice(-2)}` : "**";
}
/** "12345678" -> "****5678". Never longer than the real number, never fewer than four stars. */
export function maskAccountNumber(v: unknown): string | null {
  if (v == null || v === "") return null;
  const d = String(v).replace(/\s/g, "");
  return `${"*".repeat(Math.max(4, d.length - 4))}${d.slice(-4)}`;
}
export interface BankLike { bankName?: unknown; accountName?: unknown; sortCode?: unknown; accountNumber?: unknown }
export function maskBank(b: BankLike | null | undefined): { bankName: string | null; accountName: string | null; sortCode: string | null; accountNumber: string | null; masked: true } | null {
  if (!b) return null;
  return {
    bankName: (b.bankName as string) ?? null, accountName: (b.accountName as string) ?? null,
    sortCode: maskSortCode(b.sortCode), accountNumber: maskAccountNumber(b.accountNumber), masked: true,
  };
}

// ── Impersonation audit ─────────────────────────────────────────────────────
/**
 * A keyed fingerprint of a request body for the audit trail: lets a reviewer tell "same request twice" without storing the content.
 * `mac` is the server's secret-keyed HMAC (lib/signing.sign), so the value cannot be brute-forced offline from a low-entropy body (an 8-digit
 * account number) the way a plain unsalted hash can. The full digest is kept (no truncation). null for no body.
 */
export function bodyHash(body: unknown, mac: (s: string) => string): string | null {
  if (body == null) return null;
  if (typeof body === "object" && Object.keys(body as object).length === 0) return null;
  let s: string;
  try { s = typeof body === "string" ? body : JSON.stringify(body); } catch { return null; }
  if (!s || s === "{}") return null;
  return mac(`hq-audit-body:${s}`);
}
export const MIN_REASON = 5;
/** A reason for opening someone's account: trimmed, 5 to 300 characters. null when it is not acceptable. */
export function cleanReason(v: unknown): string | null {
  if (typeof v !== "string") return null;
  // Invisible characters (zero-width, bidi marks, control, filler letters) must not count towards the length: five zero-width spaces are not a reason.
  const r = v.replace(/[\p{Cf}\p{Cc}\u034f\u115f\u1160\u3164\uffa0]/gu, (c) => (/\s/.test(c) ? " " : "")).replace(/\s+/g, " ").trim();
  return r.length >= MIN_REASON && r.length <= 300 ? r : null;
}
/** A flag stored as true / "true" / 1 reads as true (a string "false" or 0 as false): one reading of "disabled" for every HQ guard. */
export function truthyFlag(v: unknown): boolean {
  if (typeof v === "string") return /^(true|1|yes|on)$/i.test(v.trim());
  return v === true || v === 1;
}
/** A switched-off or closed account: HQ may look but not change anything while acting as it. */
export const isFrozenAccount = (u: { disabled?: unknown; deactivatedAt?: unknown }) => truthyFlag(u.disabled) || !!u.deactivatedAt;
export const isReadMethod = (m: string) => m === "GET" || m === "HEAD" || m === "OPTIONS";

// ── Validation ──────────────────────────────────────────────────────────────
/** A plan or band price in pounds: more than 0, at most 10 000, at most two decimals. */
export function validPrice(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0 && n <= 10_000 && Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
}
/** Every feature key a provider's Features switch can really gate (the operator sidebar views, the staff views that map onto them, the customer-area modules). */
export function knownFeatureKeys(): Set<string> {
  const out = new Set<string>(["registers", "admin-registers"]);
  for (const portal of PORTALS) for (const g of NAV_GROUPS[portal]) for (const it of g.items) for (const k of featureKeysForView(portal, it.view)) out.add(k);
  for (const keys of Object.values(CA_FEATURES)) for (const k of keys) out.add(k);
  return out;
}
/** Would pointing `id` at `target` as its duplicate create a loop (A is a duplicate of B, B of A, or any longer ring)? `dupOf` maps thread id -> the thread it duplicates. */
export function makesDuplicateCycle(dupOf: Record<string, string | null | undefined>, id: string, target: string): boolean {
  const seen = new Set<string>([id]);
  let cur: string | null | undefined = target;
  while (cur) {
    if (seen.has(cur)) return true;
    seen.add(cur);
    cur = dupOf[cur];
  }
  return false;
}

// ── Personal data out of the AI digest ──────────────────────────────────────
const EMAIL = /[A-Z0-9._%+'-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /(?:\+?\d[\d\s().-]{7,}\d)/g;
const NAME_AFTER = /\b(?:child|children|kid|daughter|son|pupil|student|baby|toddler|sibling|brother|sister|mum|mom|dad|mother|father|parent|guardian|mr|mrs|ms|miss|dr|called|named|name is|i am|i'm|im|this is)\s+(?:is\s+)?([A-Z][\p{L}'’-]+(?:\s+[A-Z][\p{L}'’-]+){0,2})/giu;
/** Two or more capitalised words in a row ("Jane Smith", "Ava Testchild") read as a person's name. */
const CAP_RUN = /\b[A-Z][\p{L}'’-]{1,}(?:\s+[A-Z][\p{L}'’-]{1,})+\b/gu;
// Words that start capitalised runs but are not people: kept so the digest still reads (days, months, product words).
const KEEP = new Set(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december", "stripe", "xero", "quickbooks", "sage", "google", "apple", "chrome", "safari", "android", "iphone", "uk", "hmrc", "sort", "code", "bank", "transfer", "direct", "debit", "setup", "blocks", "listings", "bookings", "finance", "dashboard", "messages", "registers", "payments", "refunds", "settings", "support", "bug", "the", "a", "an", "my", "our", "your", "no", "not", "please", "hi", "hello", "dear", "thanks", "thank", "you", "we", "is", "it", "can", "when", "how", "why", "what", "where", "this", "that", "page", "report", "problem", "billing", "question", "incident", "parent", "provider", "customer", "child"]);
const token = (s: string) => s.toLowerCase().replace(/[^\p{L}]/gu, "");

/**
 * Take the personal data out of one piece of support text before it goes to a third-party model:
 * emails, phone numbers, the thread's own known names (and their parts), words that follow "child / son / Mrs ...",
 * and any run of capitalised words. It keeps the shape of the complaint (what went wrong), not who it was about.
 * Free text can never be scrubbed perfectly, so callers also send no names/emails as separate fields and cap the length.
 */
export function redactPersonal(text: string, known: Array<string | null | undefined> = []): string {
  let out = String(text ?? "");
  out = out.replace(EMAIL, "[email]").replace(PHONE, (m) => (m.replace(/\D/g, "").length >= 8 ? "[phone]" : m));
  const words = new Set<string>();
  for (const k of known) {
    if (!k) continue;
    const local = k.includes("@") ? k.split("@")[0] : k;
    for (const w of local.split(/[\s._+-]+/)) if (w.length >= 3 && !KEEP.has(token(w))) words.add(w);
  }
  for (const w of words) out = out.replace(new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), "[name]");
  out = out.replace(NAME_AFTER, (m, name: string) => m.slice(0, m.length - name.length) + "[name]");
  out = out.replace(CAP_RUN, (m) => (m.split(/\s+/).every((w) => KEEP.has(token(w))) ? m : "[name]"));
  return out.replace(/(?:\[name\]\s*){2,}/g, "[name] ");
}

// ── Pricing history ─────────────────────────────────────────────────────────
type Plan = Record<string, unknown> & { id?: unknown };
function flatten(v: unknown, path: string, out: Map<string, unknown>) {
  if (Array.isArray(v)) {
    if (v.every((x) => typeof x !== "object" || x === null)) { out.set(path, JSON.stringify(v)); return; }
    v.forEach((x, i) => flatten(x, `${path}.${(x as { id?: unknown })?.id ?? i}`, out));
  } else if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v as object)) if (k !== "id") flatten(x, path ? `${path}.${k}` : k, out);
  } else out.set(path, v);
}
/** What changed between two catalogues, one line per field: `{ plan, path, old, new }` (e.g. freelancer / price / 29 / 35). Order-independent; ids are the keys. */
export function diffPlans(before: Plan[] | null | undefined, after: Plan[] | null | undefined): { plan: string; path: string; old: unknown; new: unknown }[] {
  const a = new Map((before ?? []).map((p) => [String(p.id), p])), b = new Map((after ?? []).map((p) => [String(p.id), p]));
  const out: { plan: string; path: string; old: unknown; new: unknown }[] = [];
  for (const id of new Set([...a.keys(), ...b.keys()])) {
    if (!a.has(id) || !b.has(id)) { out.push({ plan: id, path: "(plan)", old: a.has(id) ? "present" : "absent", new: b.has(id) ? "present" : "absent" }); continue; }
    const fa = new Map<string, unknown>(), fb = new Map<string, unknown>();
    flatten(a.get(id), "", fa); flatten(b.get(id), "", fb);
    for (const path of new Set([...fa.keys(), ...fb.keys()])) if (fa.get(path) !== fb.get(path)) out.push({ plan: id, path, old: fa.get(path) ?? null, new: fb.get(path) ?? null });
  }
  return out;
}
