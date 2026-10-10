// What a FAMILY's data export (GET /api/privacy/export, parent role) may contain. Built from ALLOW-LISTS per collection (parent-portal P25):
// a group moment tags other families' children and carries their replies, the poster's sign-in email and uid; a payment row carries the
// provider's own notes. The export used to hand back the raw documents. Anything not listed here is not exported.

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

/** A moment (photo / note shared with the families in a session), reduced to THIS family's part of it. */
export function exportMoment(m: Doc, ownChildIds: Set<string>, ownUid: string): Doc {
  const ids = Array.isArray(m.childIds) ? (m.childIds as string[]) : [];
  const names = Array.isArray(m.childNames) ? (m.childNames as string[]) : [];
  const mine = ids.map((id, i) => (ownChildIds.has(id) ? i : -1)).filter((i) => i >= 0);
  const comments = (Array.isArray(m.comments) ? (m.comments as Doc[]) : [])
    .filter((c) => c.role !== "parent" || c.by === ownUid)
    .map((c) => ({ text: str(c.text), at: str(c.at), role: c.role === "parent" ? "parent" : "team", from: c.role === "parent" ? "you" : staffLabel(c.byName, "team") }));
  return {
    ...pick(m, ["id", "tenantId", "date", "createdAt", "caption", "text", "note", "title", "photoUrl", "photoType", "listing", "listingName", "kind"]),
    childIds: mine.map((i) => ids[i]),
    childNames: mine.map((i) => names[i] ?? ""),
    sharedBy: staffLabel(m.postedByName),
    comments,
  };
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

export function exportPayment(p: Doc): Doc {
  return pick(p, ["id", "tenantId", "refs", "mealOrderIds", "invoiceId", "type", "amount", "currency", "method", "via", "status", "createdAt", "paidAt", "email", "paymentIntentId", "refundId"]);
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
