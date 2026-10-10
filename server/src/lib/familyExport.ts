// Family-export helpers that are NOT per-record views. The per-collection ALLOW-LISTS (incidents, medications, doses, moments, customer
// record, payments) live in ONE place, lib/parentViews.ts, shared by the parent screens and the GDPR download. This file adds only the
// message/thread allow-lists and the deep backstop scrub applied to the finished export. Anything not listed is not exported.

type Doc = Record<string, unknown>;
const pick = (d: Doc, keys: readonly string[]): Doc => Object.fromEntries(keys.filter((k) => d[k] !== undefined).map((k) => [k, d[k]]));
const str = (v: unknown) => (typeof v === "string" ? v : "");
const isEmail = (s: string) => /@/.test(s);

/** Staff are shown as first name + role only, never a sign-in email or a uid. */
export function staffLabel(name: unknown, role?: string): string {
  const n = str(name).trim();
  const first = !n || isEmail(n) ? "" : n.split(/\s+/)[0];
  return first ? (role ? `${first} (${role})` : first) : (role ? `A member of the team (${role})` : "The team");
}

export function exportMessage(m: Doc): Doc {
  const fromOperator = m.from === "operator";
  return {
    ...pick(m, ["id", "threadId", "tenantId", "from", "body", "createdAt", "coupon", "broadcast"]),
    senderName: fromOperator ? staffLabel(m.senderName) : str(m.senderName),
  };
}

export function exportThread(t: Doc): Doc {
  return pick(t, ["id", "tenantId", "tenantName", "parentEmail", "parentName", "subject", "lastBody", "lastFrom", "lastAt", "createdAt"]);
}

/** Keys that are provider-internal or identify other people wherever they turn up in a family's export (backstop for the allow-lists above). */
const FORBIDDEN_KEY = /^(recon|reconNotes?|reconciledBy|internalNotes?|providerNotes?|staffNotes?|postedBy(Uid)?|recordedByUid|createdByUid|senderUid|staffJoined|stripeAccount|checkoutId|operatorUnread|operatorHidden)$/i;

/** Deep-copy `v` without any forbidden key (arrays and objects, any depth). */
export function scrubFamilyExport<T>(v: T, ownEmail = "", key = ""): T {
  if (Array.isArray(v)) return v.map((x) => scrubFamilyExport(x, ownEmail, key)) as unknown as T;
  if (v && typeof v === "object") {
    const out: Doc = {};
    for (const [k, x] of Object.entries(v as Doc)) if (!FORBIDDEN_KEY.test(k)) out[k] = scrubFamilyExport(x, ownEmail, k);
    return out as T;
  }
  // A bare email address under a "who did this" key (collectedBy, firstAider, by ...) is a member of staff's sign-in: first name + role only.
  if (typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && !/email/i.test(key) && v.trim().toLowerCase() !== ownEmail.toLowerCase()) return staffLabel(v) as unknown as T;
  return v;
}

export const FORBIDDEN_EXPORT_KEY = FORBIDDEN_KEY;
