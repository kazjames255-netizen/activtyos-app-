import { db } from "../firebase";

// Test tenants are skipped by the scheduled sweeps. SAME name and semantics as the mail-volume-10oct branch (lib/scheduler.ts
// skipTestTenantsOn / isTestTenant and lib/mailPolicy.ts looksLikeTestTenant); when that branch is merged, drop this file and import
// those. ON by default in production, OFF elsewhere (the emulator suites rely on test tenants); SWEEPS_SKIP_TEST_TENANTS=1 forces it
// on, =0 forces it off.
export const skipTestTenantsOn = (): boolean => {
  const f = process.env.SWEEPS_SKIP_TEST_TENANTS;
  return f === "1" ? true : f === "0" ? false : process.env.NODE_ENV === "production";
};

const FAKE_DOMAIN_EXACT = new Set(["localhost", "example.com", "example.org", "example.net", "activityos-test.com"]);
const FAKE_TLDS = new Set(["test", "example", "invalid", "local", "localhost"]);
export function isFakeAddress(addr: string): boolean {
  const a = addr.trim().toLowerCase();
  const at = a.lastIndexOf("@");
  if (at < 1) return false;
  const domain = a.slice(at + 1);
  if (!domain) return false;
  if (FAKE_DOMAIN_EXACT.has(domain)) return true;
  for (const d of FAKE_DOMAIN_EXACT) if (domain.endsWith(`.${d}`)) return true;
  return FAKE_TLDS.has(domain.slice(domain.lastIndexOf(".") + 1));
}
/** Flagged (`test: true` / `isTest: true`) or ALL the contact addresses it has are fake/reserved. No address at all = not a test tenant. */
export function looksLikeTestTenant(t: { test?: unknown; isTest?: unknown; email?: unknown; notifyEmail?: unknown }, ownerEmail?: string | null): boolean {
  if (t.test === true || t.isTest === true) return true;
  const addrs = [t.notifyEmail, t.email, ownerEmail].filter((x): x is string => typeof x === "string" && x.includes("@"));
  return addrs.length > 0 && addrs.every(isFakeAddress);
}

const TTL = 30 * 60_000;
const cache = new Map<string, { v: boolean; at: number }>();
export async function isTestTenant(tenantId: string): Promise<boolean> {
  const hit = cache.get(tenantId);
  if (hit && Date.now() - hit.at < TTL) return hit.v;
  let v = false;
  try {
    const t = await db.collection("tenants").doc(tenantId).get();
    if (t.exists) {
      const d = t.data() as { test?: unknown; isTest?: unknown; email?: unknown; notifyEmail?: unknown; ownerUid?: string };
      let owner: string | undefined;
      if (!d.notifyEmail && !d.email && d.ownerUid) owner = ((await db.collection("users").doc(d.ownerUid).get()).data() as { email?: string } | undefined)?.email;
      v = looksLikeTestTenant(d, owner);
    }
  } catch { v = false; /* on doubt, behave as a real tenant */ }
  cache.set(tenantId, { v, at: Date.now() });
  return v;
}
export const clearTestTenantCache = () => cache.clear();

/** True when the sweep should leave this tenant's data alone. */
export const skipTenant = async (tenantId: string | undefined | null): Promise<boolean> => !!tenantId && skipTestTenantsOn() && (await isTestTenant(tenantId));
