import { db } from "../firebase";
import { stripe, webUrl } from "./stripe";

// Apple Pay / Google Pay on a provider's checkout needs the web address the parent pays on registered with Stripe FOR THAT
// connected account (parents' card payments are charged on the provider's own account). We register every domain in PAY_DOMAINS
// (comma separated; defaults to the host of WEB_URL) on a provider's account once it can take cards, and remember which ones we
// have done on the tenant, so a new domain added later (the rebrand) is registered for everyone on next sight.
// The platform's OWN account needs the same domains registered once by hand (Stripe > Settings > Payment method domains).

const hostOf = (u: string) => { try { return new URL(/^https?:\/\//.test(u) ? u : `https://${u}`).hostname.toLowerCase(); } catch { return ""; } };

export function payDomains(): string[] {
  const list = (process.env.PAY_DOMAINS ?? "").split(/[,\s]+/).map(hostOf).filter(Boolean);
  const own = hostOf(webUrl);
  return [...new Set([...(list.length ? list : []), ...(own && !/^(localhost|127\.)/.test(own) ? [own] : [])])];
}

/** Register the pay domains on a connected account. Never throws; safe to call repeatedly (idempotent per domain). */
export async function ensurePayDomains(tenantId: string, accountId: string): Promise<void> {
  if (!stripe) return;
  const want = payDomains();
  if (!want.length) return;
  try {
    const ref = db.collection("tenants").doc(tenantId);
    const done = ((await ref.get()).get("payDomains") as string[] | undefined) ?? [];
    const todo = want.filter((d) => !done.includes(d));
    if (!todo.length) return;
    const ok: string[] = [];
    for (const d of todo) {
      try {
        await stripe.paymentMethodDomains.create({ domain_name: d }, { stripeAccount: accountId });
        ok.push(d);
      } catch (e) {
        // "already registered" is success; anything else is logged and retried next time.
        if (/already|exists|duplicate/i.test((e as Error).message)) ok.push(d);
        else console.error(`[paydomains] ${d} on ${accountId}:`, (e as Error).message);
      }
    }
    if (ok.length) await ref.set({ payDomains: [...new Set([...done, ...ok])] }, { merge: true });
  } catch (e) {
    console.error("[paydomains] failed:", (e as Error).message);
  }
}
