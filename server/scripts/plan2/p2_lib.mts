// Plan-2 harness helpers: throwaway tenants/accounts via the REAL routes
// (in-process app, fake auth), plus a cleanup that deletes only what we made.
import fs from "node:fs";
import { db } from "../../src/firebase";
import { serve } from "./p2_app.mts";

export const RUN = process.env.P2_RUN || `p2${Date.now().toString(36)}`;
const RUN_FILE = new URL(`./_t_p2_run_${RUN}.json`, import.meta.url);

export type Res = { status: number; json: any; headers: Headers; text: string };
export const tok = (uid: string, email?: string) => `fake:${uid}${email ? ":" + email.replace("@", "_at_") : ""}`;

let server: { base: string; close: () => void } | null = null;
export async function start() { if (!server) server = await serve(); return server.base; }
export function stop() { server?.close(); server = null; }

export async function api(token: string | null, method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<Res> {
  const base = await start();
  const r = await fetch(base + path, {
    method,
    headers: { ...(body !== undefined && !(body instanceof Uint8Array) ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : body instanceof Uint8Array ? body : JSON.stringify(body),
  });
  const text = await r.text();
  let json: any = null; try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: r.status, json, headers: r.headers, text };
}

export const track = { tenants: new Set<string>(), uids: new Set<string>(), emails: new Set<string>() };
export function saveRun() {
  fs.writeFileSync(RUN_FILE, JSON.stringify({ tenants: [...track.tenants], uids: [...track.uids], emails: [...track.emails] }, null, 2));
}

/** A fresh account uid + token for this run. */
export function acct(label: string) {
  const uid = `${RUN}_${label}`;
  const email = `${uid}@p2test.local`;
  track.uids.add(uid); track.emails.add(email);
  return { uid, email, token: tok(uid, email) };
}

export async function owner(label: string, role: "freelancer" | "company", extra: Record<string, unknown> = {}) {
  const a = acct(label);
  const r = await api(a.token, "POST", "/api/register-role", { role, businessName: `P2 ${label} ${RUN}`, ...extra });
  if (r.status !== 201) throw new Error(`register-role ${label}: ${r.status} ${r.text}`);
  track.tenants.add(r.json.tenantId);
  // Skip the "none" plan wall: treat the tenant as active (pre-existing tenants have no subscription field).
  await db.collection("tenants").doc(r.json.tenantId).set({ subscription: { status: "active", plan: role === "company" ? "franchise" : "freelancer", since: new Date().toISOString() } }, { merge: true });
  saveRun();
  return { ...a, tenantId: r.json.tenantId as string };
}

export async function parent(label: string) {
  const a = acct(label);
  const r = await api(a.token, "POST", "/api/register-role", { role: "parent" });
  if (r.status !== 200) throw new Error(`parent ${label}: ${r.status} ${r.text}`);
  saveRun();
  return a;
}

/** Invite + accept through the real routes. */
export async function invite(byToken: string, label: string, body: Record<string, unknown>) {
  const inv = await api(byToken, "POST", "/api/invites", body);
  if (inv.status !== 201) throw new Error(`invite ${label}: ${inv.status} ${inv.text}`);
  const a = acct(label);
  const acc = await api(a.token, "POST", `/api/invites/${inv.json.token}/accept`, {});
  if (acc.status !== 200) throw new Error(`accept ${label}: ${acc.status} ${acc.text}`);
  const u = await db.collection("users").doc(a.uid).get();
  saveRun();
  return { ...a, inviteToken: inv.json.token as string, user: u.data() as Record<string, any> };
}

export async function platformAcct(label: string) {
  const a = acct(label);
  await db.collection("users").doc(a.uid).set({ email: a.email, role: "platform", chosen: true });
  saveRun();
  return a;
}

const TENANT_SCOPED = [
  "bookings", "blocks", "listings", "customers", "children", "payments",
  "discountCodes", "threads", "periods", "messages", "blockBundles",
  "referrals", "passes", "mealOrders", "discountRedemptions", "timetables",
  "ratioGroups", "ratioBoards", "posts", "moments", "medications",
  "mealOptions", "trips", "tasks", "shifts", "registers", "purchaseOrders",
  "menus", "medicationAdmin", "invoices", "invites", "incidents", "expenses",
  "emails", "documents", "deletionRequests", "certifications",
  "supportMessages", "messageTemplates", "messageFolders", "images",
  "customerGroups", "childFiles", "broadcasts", "wallet", "walletEntries",
  "notifications", "schedulerFired", "calendarEvents", "inventory",
  "emailMessages", "scheduledEmails", "emailSuppressions", "suppliers",
  "expenseClaims", "income", "memberships", "leave", "leaveRequests", "availabilityRequests",
  "timeclock", "payrollRuns", "appraisals", "locationStaff", "franchises", "ratios",
];
const USER_SCOPED: [string, string][] = [["children", "parentUid"], ["childFiles", "ownerUid"], ["threads", "parentUid"], ["referrals", "referrerUid"], ["memberships", "uid"], ["notifications", "uid"], ["wallets", "uid"]];

export async function cleanup(run?: { tenants: string[]; uids: string[]; emails: string[] }) {
  const r = run ?? { tenants: [...track.tenants], uids: [...track.uids], emails: [...track.emails] };
  let n = 0;
  const del = async (docs: FirebaseFirestore.QueryDocumentSnapshot[]) => { for (const d of docs) { await db.recursiveDelete(d.ref); n++; } };
  for (const tid of r.tenants) {
    for (const col of TENANT_SCOPED) {
      try { await del((await db.collection(col).where("tenantId", "==", tid).get()).docs); } catch (e) { console.warn("cleanup", col, (e as Error).message); }
    }
    await del((await db.collection("supportThreads").where("providerId", "==", tid).get()).docs).catch(() => {});
    await del((await db.collection("libraries").where("tenantId", "==", tid).get()).docs).catch(() => {});
    for (const lib of (await db.collection("libraries").listDocuments())) if (lib.id === tid || lib.id.startsWith(`${tid}__fr__`)) { await db.recursiveDelete(lib); n++; }
    await db.recursiveDelete(db.collection("tenants").doc(tid)); n++;
  }
  for (const [col, field] of USER_SCOPED) {
    for (let i = 0; i < r.uids.length; i += 10) {
      const chunk = r.uids.slice(i, i + 10); if (!chunk.length) continue;
      try { await del((await db.collection(col).where(field, "in", chunk).get()).docs); } catch { /* index */ }
    }
  }
  for (const uid of r.uids) { await db.recursiveDelete(db.collection("users").doc(uid)); n++; }
  for (const em of r.emails) {
    for (const col of ["customers", "bookings", "threads"]) {
      try { await del((await db.collection(col).where("email", "==", em).get()).docs); } catch { /* */ }
    }
  }
  try { fs.unlinkSync(RUN_FILE); } catch { /* */ }
  return n;
}

// ── tiny assertion log ──
export const results: Record<string, { verdict: "pass" | "fail" | "blocked"; method: string; actual: string; notes?: string; evidence?: string; at: string; agent: "G" }> = {};
export function record(id: string, verdict: "pass" | "fail" | "blocked", method: string, actual: string, extra: { notes?: string; evidence?: string } = {}) {
  results[id] = { verdict, method, actual, ...extra, at: new Date().toISOString(), agent: "G" };
  console.log(`[${verdict.toUpperCase()}] ${id}: ${actual}${extra.notes ? "\n   notes: " + extra.notes : ""}`);
}
export function flush(file: string) {
  let cur: Record<string, unknown> = {};
  try { cur = JSON.parse(fs.readFileSync(file, "utf8")); } catch { /* new */ }
  fs.writeFileSync(file, JSON.stringify({ ...cur, ...results }, null, 2));
}
export const RESULTS = "/Users/kazjames/Downloads/activtyos-app-/lib/testing/agent-results/plan2-agent-G.json";
