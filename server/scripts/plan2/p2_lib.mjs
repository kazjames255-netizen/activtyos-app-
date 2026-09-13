// Plan-2 agent J harness: mint real Firebase ID tokens for THROWAWAY accounts,
// call the running API on :4000, and clean up everything created by run id.
// Usage from another script:  import { mk, api, cleanupRun } from "./p2_lib.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const here = path.dirname(fileURLToPath(import.meta.url));
const key = JSON.parse(fs.readFileSync(path.join(here, "serviceAccountKey.json"), "utf8"));
const app = getApps()[0] ?? initializeApp({ credential: cert(key), projectId: key.project_id });
export const db = getFirestore(app);
db.settings({ ignoreUndefinedProperties: true });
export const auth = getAuth(app);
export const API = process.env.API_URL || "http://localhost:4000";
const envLocal = fs.readFileSync(path.join(here, "..", ".env.local"), "utf8");
const API_KEY = /NEXT_PUBLIC_FIREBASE_API_KEY=(.+)/.exec(envLocal)?.[1]?.trim();
export const DOMAIN = "@activityos-test.com";
export const RUN = process.env.P2_RUN || `p2j${Date.now()}`;

export function log(...a) { console.log(...a); }

/** Create (or reuse) an auth user for this run and return a fresh ID token. */
export async function mk(name, opts = {}) {
  const email = `${RUN}-${name}${DOMAIN}`;
  let user;
  try { user = await auth.getUserByEmail(email); }
  catch { user = await auth.createUser({ email, password: `Pw-${RUN}-x1!`, displayName: opts.displayName || name, emailVerified: true }); }
  const token = await tokenFor(user.uid);
  return { uid: user.uid, email, token, name };
}

export async function tokenFor(uid) {
  const custom = await auth.createCustomToken(uid);
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: custom, returnSecureToken: true }),
  });
  const d = await r.json();
  if (!d.idToken) throw new Error(`token mint failed: ${JSON.stringify(d).slice(0, 300)}`);
  return d.idToken;
}

export async function api(token, method, p, body, extraHeaders = {}) {
  const headers = { ...extraHeaders };
  if (body !== undefined && !(body instanceof Uint8Array) && typeof body !== "string") headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(`${API}${p}`, { method, headers, body: body === undefined ? undefined : (typeof body === "string" || body instanceof Uint8Array ? body : JSON.stringify(body)) });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: r.status, json, text, headers: r.headers };
}

/** Provision a tenant owner: role company|freelancer. Returns {uid,email,token,tenantId}. */
export async function mkTenant(name, role = "freelancer", extra = {}) {
  const u = await mk(name);
  const r = await api(u.token, "POST", "/api/register-role", { role, businessName: `ZZ P2J ${name} ${RUN}`, ...extra });
  if (r.status !== 201) throw new Error(`register-role ${name}: ${r.status} ${r.text.slice(0, 200)}`);
  return { ...u, tenantId: r.json.tenantId, role };
}
export async function mkParent(name, extra = {}) {
  const u = await mk(name);
  const r = await api(u.token, "POST", "/api/register-role", { role: "parent", ...extra });
  if (r.status !== 200) throw new Error(`register-role parent ${name}: ${r.status} ${r.text.slice(0, 200)}`);
  return { ...u, role: "parent" };
}

// Every collection whose docs carry a tenantId (copied from e2eCleanup.ts) + a few more.
const TENANT_SCOPED = [
  "bookings", "blocks", "listings", "customers", "children", "payments", "discountCodes", "threads", "periods", "messages",
  "blockBundles", "referrals", "passes", "mealOrders", "discountRedemptions", "timetables", "ratioGroups", "ratioBoards", "posts",
  "moments", "medications", "mealOptions", "trips", "tasks", "shifts", "registers", "purchaseOrders", "menus", "medicationAdmin",
  "invoices", "invites", "incidents", "expenses", "emails", "documents", "deletionRequests", "certifications", "supportMessages",
  "messageTemplates", "messageFolders", "images", "customerGroups", "childFiles", "broadcasts", "wallet", "walletEntries",
  "notifications", "schedulerFired", "calendarEvents", "inventory", "emailMessages", "scheduledEmails", "emailSuppressions",
  "suppliers", "income", "expenseClaims", "leaveRequests", "absences", "timeclockEvents", "timeclock", "payrollRuns", "appraisals",
  "staffAnnouncements", "availabilityRequests", "references", "feedback", "memberships", "franchises", "leads", "locationStaff", "onboarding",
  "supportThreads", "learningNotify", "credentials", "events",
];
const USER_SCOPED = [["children", "parentUid"], ["childFiles", "ownerUid"], ["threads", "parentUid"], ["referrals", "referrerUid"], ["notifications", "uid"], ["feedback", "uid"]];

/** Delete every auth user + tenant + doc this run created. Only touches emails with the run prefix. */
export async function cleanupRun(run = RUN) {
  const users = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    for (const u of page.users) if (u.email?.startsWith(`${run}-`) && u.email.endsWith(DOMAIN)) users.push({ uid: u.uid, email: u.email });
    pageToken = page.pageToken;
  } while (pageToken);
  const uids = users.map((u) => u.uid);
  const tenantIds = new Set();
  for (const uid of uids) {
    const doc = await db.collection("users").doc(uid).get();
    const tid = doc.data()?.tenantId; if (tid) tenantIds.add(tid);
  }
  for (let i = 0; i < uids.length; i += 10) {
    const owned = await db.collection("tenants").where("ownerUid", "in", uids.slice(i, i + 10)).get();
    owned.docs.forEach((d) => tenantIds.add(d.id));
  }
  let n = 0;
  for (const tid of tenantIds) {
    for (const col of TENANT_SCOPED) {
      try {
        const snap = await db.collection(col).where("tenantId", "==", tid).get();
        await Promise.all(snap.docs.map((d) => db.recursiveDelete(d.ref))); n += snap.size;
      } catch (e) { /* collection may need an index / not exist */ }
    }
    await db.recursiveDelete(db.collection("libraries").doc(tid));
    await db.recursiveDelete(db.collection("tenants").doc(tid));
  }
  for (const uid of uids) {
    for (const [col, field] of USER_SCOPED) {
      try { const snap = await db.collection(col).where(field, "==", uid).get(); await Promise.all(snap.docs.map((d) => db.recursiveDelete(d.ref))); n += snap.size; } catch {}
    }
    await db.recursiveDelete(db.collection("users").doc(uid));
    try { await auth.deleteUser(uid); } catch {}
  }
  log(`[cleanup ${run}] ${users.length} users, ${tenantIds.size} tenants, ${n} scoped docs removed`);
  return { users: users.length, tenants: [...tenantIds], docs: n };
}

if (process.argv[1] && process.argv[1].endsWith("_t_p2_lib.mjs") && process.argv[2] === "cleanup") {
  await cleanupRun(process.argv[3] || RUN);
}
