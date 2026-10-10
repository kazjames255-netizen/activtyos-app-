import { db } from "../firebase";

// RULE (privacy, 10 Oct): a parent who closed their account (POST /api/account/deactivate) gets NO marketing and NO non-essential
// email, and is left out of every marketing recipient list. What they DO still get is the transactional mail the law or the money
// needs: refund and payment receipts, booking cancellations/declines, invoices (callers mark these `essential` - see lib/emails.ts
// sendGated for the "payments" and "cancellation" groups, routes/invoices.ts). Everything else (provider messages, reminders, digests,
// newsletters, marketing sends) is suppressed at the mailer, so a new sender is safe by default.
//
// Cost: one query on users for closed accounts only (`deactivatedAt` set), cached for a minute per instance. deactivate/reactivate
// on THIS instance update the cache at once; another instance catches up within CLOSED_TTL_MS.

const CLOSED_TTL_MS = Number(process.env.CLOSED_ACCOUNTS_TTL_MS ?? 60_000);
let cache: { at: number; emails: Set<string> } | null = null;
let inflight: Promise<Set<string>> | null = null;
let gen = 0;

async function load(): Promise<Set<string>> {
  const snap = await db.collection("users").where("deactivatedAt", ">", "").select("email").get();
  const emails = new Set<string>();
  for (const d of snap.docs) {
    const e = String(d.get("email") ?? "").trim().toLowerCase();
    if (e) emails.add(e);
  }
  return emails;
}

/** Lower-cased emails of every closed (deactivated) account. */
export async function closedEmails(): Promise<Set<string>> {
  if (cache && Date.now() - cache.at < CLOSED_TTL_MS) return cache.emails;
  const g = gen;
  inflight ??= load().then((emails) => { if (g === gen) cache = { at: Date.now(), emails }; return emails; }).finally(() => { inflight = null; });
  try { return await inflight; } catch (e) {
    // If the lookup fails, keep the last known set rather than blocking all mail (or letting everything through blind).
    console.error("[closed-accounts] lookup failed:", (e as Error).message);
    return cache?.emails ?? new Set();
  }
}

export async function isClosedAccount(email: string): Promise<boolean> {
  const e = String(email ?? "").trim().toLowerCase();
  return !!e && (await closedEmails()).has(e);
}

/** Call right after an account is closed / reopened so this instance sees it immediately. */
export function noteClosure(email: string, closed: boolean): void {
  const e = String(email ?? "").trim().toLowerCase();
  if (!e) return;
  gen++; // any lookup already in flight may predate this change: don't let it overwrite the cache
  inflight = null;
  if (!cache) return; // nothing loaded yet: the next call reads Firestore, which already has the change
  const emails = new Set(cache.emails);
  if (closed) emails.add(e); else emails.delete(e);
  cache = { at: cache.at, emails };
}
