// Shared harness for plan2 days 9-11 (agent I). Throwaway accounts only:
// every account is *@activityos-test.com; every tenant created here is
// recorded and torn down by cleanup(). Never points at real tenants.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { auth, db } from "../../src/firebase";

export const API = process.env.API_URL || "http://localhost:4000";
const WEB_KEY = (() => {
  const env = fs.readFileSync(path.resolve(import.meta.dirname, "../.env.local"), "utf8");
  return env.match(/NEXT_PUBLIC_FIREBASE_API_KEY=(.+)/)![1].trim();
})();

export const RUN = `p2i${Date.now().toString(36)}`;
export const em = (n: string) => `${RUN}-${n}@activityos-test.com`;

export interface Acct { uid: string; email: string; token: string }
const created: { uids: string[]; tenants: string[] } = { uids: [], tenants: [] };

export async function mkUser(name: string, displayName?: string): Promise<Acct> {
  const email = em(name);
  const u = await auth.createUser({ email, password: "test1234!", displayName: displayName ?? name, emailVerified: true });
  created.uids.push(u.uid);
  const custom = await auth.createCustomToken(u.uid);
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${WEB_KEY}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: custom, returnSecureToken: true }),
  });
  const d = (await r.json()) as { idToken?: string; error?: unknown };
  if (!d.idToken) throw new Error(`token exchange failed: ${JSON.stringify(d.error)}`);
  return { uid: u.uid, email, token: d.idToken };
}

export async function api(token: string | null, method: string, p: string, body?: unknown, headers: Record<string, string> = {}) {
  const r = await fetch(`${API}${p}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, json, headers: r.headers };
}

/** Provision an operator tenant (company | freelancer). */
export async function mkTenant(name: string, role: "company" | "freelancer", businessName: string, extra: Record<string, unknown> = {}) {
  const acct = await mkUser(name);
  const r = await api(acct.token, "POST", "/api/register-role", { role, businessName, ...extra });
  if (r.status !== 201) throw new Error(`register-role failed: ${r.status} ${JSON.stringify(r.json)}`);
  created.tenants.push(r.json.tenantId);
  return { ...acct, tenantId: r.json.tenantId as string };
}
export async function mkParent(name: string, postcode?: string) {
  const acct = await mkUser(name);
  const r = await api(acct.token, "POST", "/api/register-role", { role: "parent", ...(postcode ? { postcode } : {}) });
  if (r.status !== 200) throw new Error(`parent register failed: ${r.status}`);
  return acct;
}
/** Staff / franchise via invite link (the only way in). */
export async function joinByInvite(ownerToken: string, name: string, inviteBody: Record<string, unknown>) {
  const inv = await api(ownerToken, "POST", "/api/invites", inviteBody);
  if (inv.status !== 201) throw new Error(`invite failed: ${inv.status} ${JSON.stringify(inv.json)}`);
  const acct = await mkUser(name);
  const acc = await api(acct.token, "POST", `/api/invites/${inv.json.token}/accept`, {});
  if (acc.status >= 300) throw new Error(`invite accept failed: ${acc.status} ${JSON.stringify(acc.json)}`);
  return { ...acct, accept: acc.json };
}
/** A throwaway PLATFORM (HQ) account — users doc role platform. */
export async function mkPlatform(name: string) {
  const acct = await mkUser(name);
  await db.collection("users").doc(acct.uid).set({ email: acct.email, role: "platform", chosen: true });
  return acct;
}

export const TENANT_SCOPED = [
  "bookings", "blocks", "listings", "customers", "children", "payments", "discountCodes", "threads", "periods", "messages",
  "blockBundles", "referrals", "passes", "mealOrders", "discountRedemptions", "timetables", "ratioGroups", "ratioBoards",
  "posts", "moments", "medications", "mealOptions", "trips", "tasks", "shifts", "registers", "purchaseOrders", "menus",
  "medicationAdmin", "invoices", "invites", "incidents", "expenses", "emails", "documents", "deletionRequests",
  "certifications", "supportMessages", "messageTemplates", "messageFolders", "images", "customerGroups", "childFiles",
  "broadcasts", "wallet", "walletEntries", "notifications", "schedulerFired", "calendarEvents", "inventory",
  "emailMessages", "scheduledEmails", "emailSuppressions", "feedback", "reviews", "supportThreads", "franchises",
  "leaveRequests", "availabilityRequests", "timesheets", "timeclock", "payrollRuns", "appraisals", "suppliers",
  "income", "expenseClaims", "onboarding", "references", "locationStaff", "rota", "learningCompletions",
];
const USER_SCOPED: [string, string][] = [["children", "parentUid"], ["childFiles", "ownerUid"], ["threads", "parentUid"], ["referrals", "referrerUid"], ["notifications", "uid"], ["deletionRequests", "uid"], ["pageviews", "uid"]];

export function track(tenantId: string) { created.tenants.push(tenantId); }

export async function cleanup() {
  const tenants = [...new Set(created.tenants)];
  const uids = [...new Set(created.uids)];
  let n = 0;
  for (const coll of TENANT_SCOPED) {
    for (const t of tenants) {
      try {
        const q = await db.collection(coll).where("tenantId", "==", t).get();
        for (const d of q.docs) { await db.recursiveDelete(d.ref); n++; }
      } catch (e) { /* collection may not exist / index */ }
    }
  }
  for (const [coll, field] of USER_SCOPED) {
    for (const u of uids) {
      try {
        const q = await db.collection(coll).where(field, "==", u).get();
        for (const d of q.docs) { await db.recursiveDelete(d.ref); n++; }
      } catch {}
    }
  }
  for (const t of tenants) {
    await db.collection("libraries").doc(t).delete().catch(() => {});
    await db.recursiveDelete(db.collection("tenants").doc(t)).catch(() => {});
    n += 2;
  }
  for (const u of uids) {
    await db.recursiveDelete(db.collection("users").doc(u)).catch(() => {});
    await auth.deleteUser(u).catch(() => {});
    n++;
  }
  console.log(`[cleanup] ${tenants.length} tenants, ${uids.length} accounts, ~${n} docs removed`);
}

export function log(label: string, v: unknown) { console.log(`\n## ${label}\n` + (typeof v === "string" ? v : JSON.stringify(v, null, 1).slice(0, 1500))); }
