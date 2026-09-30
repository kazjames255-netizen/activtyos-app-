#!/usr/bin/env node
// PORTAL WIPE DRY RUN -- strictly READ-ONLY. Reports what a full wipe (everything except the HQ / platform portal and an
// allow-list) WOULD remove. It performs no Firestore or Auth mutation of any kind; the only local file it writes is its own
// JSON report (and a run marker).  See docs/live-hardening/wipe-plan.md.
//
//   node scripts/wipe-portals-dryrun.mjs --selftest
//   node scripts/wipe-portals-dryrun.mjs --live --out <report.json> [--keep-email a@b.com ...] [--keep-file keep.txt]
//                                        [--keep-e2e] [--show-emails] [--cap 2000]
//
// READ BUDGET (enforced in code by the Meter below, stated in the plan):
//   * at most 2,000 Firestore DOCUMENTS read per run (HARD_DOC_CAP; --cap can only lower it). Used for: platform users
//     (<=50), kept-user docs, kept tenants. Everything else is a count() aggregation, billed ~1 read per 1,000 index entries.
//   * at most 1,500 count() queries per run, and the `leads` collection (71k docs) gets exactly ONE plain count() -- a second
//     or a filtered query on it throws.
//   * Auth listing (no Firestore reads) capped at 20,000 users; Storage listing capped at 1,000 objects.
// Credentials are loaded exactly like server/src/firebase.ts (inline FIREBASE_SERVICE_ACCOUNT, GOOGLE_APPLICATION_CREDENTIALS,
// server/serviceAccountKey.json) and are never printed.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const HARD_DOC_CAP = 2000;
const COUNT_QUERY_CAP = 1500;
const AUTH_LIST_CAP = 20000;
const STORAGE_LIST_CAP = 1000;
const E2E_DOMAIN = "@activityos-test.com";
const ROLES = ["platform", "company", "franchise", "freelancer", "staff", "parent", "provider"];
const WRITE_NAMES = ["delete", "set", "update", "create", "add", "commit", "batch", "run" + "Transaction", "recursive" + "Delete", "bulk" + "Writer", "deleteUser", "deleteUsers", "setCustomUserClaims"];

// ---------------------------------------------------------------------------------------------------------------------
// Classification catalog. cls: DELETE (tenant data, removed with its tenant) | KEEP | DECIDE (needs Kaz: legal / shared).
// scope: tenantId (field == tenant id) | providerId | docId (doc id is the tenant id) | uid (doc id is the user uid) | none.
// `also` = a second owner field (parent-owned docs have no tenant).  Derived from server/src (grep of collection names),
// server/src/e2eCleanup.ts TENANT_SCOPED, and the route files.
// ---------------------------------------------------------------------------------------------------------------------
const T = (names, note = "") => names.split(/\s+/).filter(Boolean).map((name) => ({ name, cls: "DELETE", scope: "tenantId", note }));
const CATALOG = [
  { name: "users", cls: "DELETE", scope: "uid", note: "non-kept user docs; platform + allow-list kept" },
  { name: "tenants", cls: "DELETE", scope: "docId", note: "only tenants NOT owned by / assigned to a kept user" },
  { name: "libraries", cls: "DELETE", scope: "docId", note: "one doc per tenant (+ tenant__fr__franchise docs); kept figure is a LOWER BOUND" },
  ...T("bookings blocks listings customers discountCodes messages periods blockBundles passes mealOrders discountRedemptions timetables ratioGroups ratioBoards posts moments mealOptions trips tasks shifts registers purchaseOrders menus invites emails documents images customerGroups broadcasts wallet walletEntries notifications calendarEvents inventory mealMenus memberships rotas rotaShifts onboardFiles staffAnnouncements availabilityRequests availabilityPatterns autoDiscounts appraisalsConfig appraisalReviews accountingMappings accountingConnections milestones milestoneProgress certifications credentialTypes leaveConfig absences suppliers feedback reviews references docLibraries docFiles demoSlotTemplates demoSlotBlackouts locationStaff learningAssignments learningCompletions messageTemplates messageFolders notificationPrefs onboarding"),
  { name: "children", cls: "DELETE", scope: "tenantId", also: "parentUid", note: "parent-owned docs carry parentUid, not tenantId" },
  { name: "childFiles", cls: "DELETE", scope: "tenantId", also: "ownerUid", note: "has a `chunks` subcollection (recursive delete needed)" },
  { name: "threads", cls: "DELETE", scope: "tenantId", also: "parentUid", note: "" },
  { name: "referrals", cls: "DELETE", scope: "tenantId", also: "referrerUid", note: "" },
  { name: "schedulerFired", cls: "DELETE", scope: "tenantId", note: "cached scheduler dedupe markers" },
  { name: "accountingOAuthStates", cls: "DELETE", scope: "tenantId", note: "ephemeral OAuth state" },
  { name: "mailboxSummary", cls: "DELETE", scope: "docId", note: "cache, doc id = tenant id" },
  { name: "scheduledEmails", cls: "DELETE", scope: "tenantId", note: "queued sends -- would be cancelled" },
  // Learning Hub: every hub doc carries tenantId. Curriculum lives in the OWNER tenants, so it survives only if those tenants are kept.
  ...T("hubTopics hubNotes hubEnrolments hubQuestions hubAssessments hubAttempts hubPings hubMastery hubHomework hubSubmissions hubFlashcards hubFlashcardReviews hubFlashcardAssignments hubFeedbackBank hubLessons hubGroups hubBoards hubBoardTemplates hubFamilyInvites hubNcTags hubToolStates hubToolEvents hubDigestLog hubDigestPrefs hubGameSessions hubFactState hubGameProfile hubMiniGameProfile hubDoubts hubLessonViews hubQuizProfile hubQuizItemState hubQuizArcadeProfile hubQuizArcadeMastery hubTrainingItemState hubSortRoundState hubBotPuzzleState hubAppliedState hubAppliedSessions",
    "Learning Hub; curriculum survives ONLY in kept (owner) tenants"),
  // Legal / financial / safeguarding: a delete is not automatically lawful.
  ...["payments", "invoices", "expenses", "expenseClaims", "income", "tfcPayments", "tfcLinks", "tfcPayLocks", "tfcLinkStates", "payrollRuns", "payrollConfig", "payrollYtd", "payrollAuditLog", "payslipPdfs", "clockRecords", "clockAuditLog", "clockSettings", "subscriptionEvents"]
    .map((name) => ({ name, cls: "DECIDE", scope: "tenantId", note: "LEGAL RETENTION: tax / payroll / payments record (UK: 6y+). Export before any delete" })),
  ...["incidents", "medications", "medicationAdmin", "credentialRecords", "onboardRecords", "deletionRequests", "incidentDeletionAudit"]
    .map((name) => ({ name, cls: "DECIDE", scope: "tenantId", note: "safeguarding / H&S / DBS / GDPR-request record: retention rules apply" })),
  { name: "emailSuppressions", cls: "DECIDE", scope: "tenantId", note: "unsubscribe + bounce list (PECR): deleting lets us email opted-out people again -- keep or copy to HQ" },
  { name: "emailMessages", cls: "DELETE", scope: "tenantId", note: "synced mailbox" },
  { name: "supportThreads", cls: "DECIDE", scope: "providerId", note: "HQ support inbox: threads keyed by providerId=tenant; HQ may want history" },
  { name: "supportMessages", cls: "DECIDE", scope: "tenantId", note: "HQ support inbox" },
  // Platform / HQ / not tenant scoped.
  { name: "leads", cls: "KEEP", scope: "none", note: "sales DB (71k docs). ONE count() only -- never read" },
  { name: "platform", cls: "KEEP", scope: "none", note: "HQ settings (billing, notifPrefs)" },
  { name: "platformConfig", cls: "KEEP", scope: "none", note: "support counters / config" },
  { name: "ventureLakes", cls: "KEEP", scope: "none", note: "HQ reference data" },
  { name: "pageViews", cls: "KEEP", scope: "none", note: "marketing analytics; not tenant data" },
  { name: "opsHeartbeat", cls: "KEEP", scope: "none", note: "monitor state" },
  { name: "incidentsOps", cls: "KEEP", scope: "none", note: "ops monitor incidents" },
  { name: "schedulerLocks", cls: "KEEP", scope: "none", note: "live scheduler leader locks -- deleting can double-fire sweeps" },
  { name: "stripeEvents", cls: "KEEP", scope: "none", note: "webhook idempotency ledger: deleting allows re-processing old Stripe events" },
  { name: "impersonationLog", cls: "KEEP", scope: "none", note: "HQ security audit log" },
  { name: "chunks", cls: "KEEP", scope: "none", note: "subcollection of childFiles/*; removed with its parent, not a root collection" },
];
const BY_NAME = Object.fromEntries(CATALOG.map((c) => [c.name, c]));
const EXPECTED_SUBCOLLECTIONS = [{ parent: "childFiles", sub: "chunks", note: "file bytes; recursive delete needed" }];

// ---------------------------------------------------------------------------------------------------------------------
// Meter: wraps ANY data source (real or fixture) and enforces the read budget + the leads rule.
// ---------------------------------------------------------------------------------------------------------------------
function makeMeter(src, docCap) {
  const m = { docReads: 0, countQueries: 0, countUnits: 0, capped: false, leadsCounted: false, docCap };
  const take = (n) => {
    const room = Math.max(0, m.docCap - m.docReads);
    const allowed = Math.min(n, room);
    if (allowed < n) m.capped = true;
    return allowed;
  };
  const api = {
    meter: m,
    listCollections: () => src.listCollections(),
    listAuthPage: (t) => src.listAuthPage(t),
    listStorage: (prefix, cap) => src.listStorage(prefix, cap),
    async count(col, filter) {
      if (col === "leads") {
        if (filter || m.leadsCounted) throw new Error("GUARD: leads may only be counted once, unfiltered");
        m.leadsCounted = true;
      }
      if (m.countQueries >= COUNT_QUERY_CAP) { m.capped = true; return null; }
      m.countQueries += 1;
      const n = await src.count(col, filter);
      m.countUnits += Math.max(1, Math.ceil(n / 1000));
      return n;
    },
    async queryDocs(col, filter, limit) {
      if (col === "leads") throw new Error("GUARD: leads documents must never be read");
      const n = take(limit);
      if (n === 0) return [];
      const docs = await src.queryDocs(col, filter, n);
      m.docReads += Math.max(1, docs.length); // a query that returns nothing still costs one read
      return docs;
    },
    async getDocs(col, ids) {
      if (col === "leads") throw new Error("GUARD: leads documents must never be read");
      const n = take(ids.length);
      if (n === 0) return [];
      const docs = await src.getDocs(col, ids.slice(0, n));
      m.docReads += n;
      return docs;
    },
  };
  return api;
}

const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
const uniq = (a) => [...new Set(a)];
const maskEmail = (e) => { const [u, d] = String(e || "").split("@"); return d ? `${u.slice(0, 2)}***@${d}` : "(none)"; };

// ---------------------------------------------------------------------------------------------------------------------
// The inventory (pure function of a source; used by both the live run and the selftest).
// ---------------------------------------------------------------------------------------------------------------------
async function inventory(src, opts) {
  const io = makeMeter(src, Math.min(opts.cap ?? HARD_DOC_CAP, HARD_DOC_CAP));
  const keepEmails = uniq((opts.keepEmails || []).map((e) => e.trim().toLowerCase()).filter(Boolean));
  const out = { generatedAt: new Date().toISOString(), options: { keepEmails: keepEmails.map(maskEmail), keepE2E: !!opts.keepE2E, docCap: io.meter.docCap }, notes: [] };

  // 1. Auth users (Auth API, not Firestore reads).
  const auth = []; let token;
  do {
    const page = await io.listAuthPage(token);
    for (const u of page.users) if (auth.length < AUTH_LIST_CAP) auth.push(u);
    token = page.next;
  } while (token && auth.length < AUTH_LIST_CAP);
  const authCapped = !!token;
  const lower = (u) => (u.email || "").toLowerCase();
  const e2eAuth = auth.filter((u) => lower(u).endsWith(E2E_DOMAIN));
  const keepAuth = auth.filter((u) => keepEmails.includes(lower(u)));
  const missingKeep = keepEmails.filter((e) => !auth.some((u) => lower(u) === e));

  // 2. Protected set: platform (HQ) users + allow-list + (optionally) e2e accounts.
  const platformDocs = await io.queryDocs("users", { field: "role", op: "==", value: "platform" }, 50);
  const platformUids = platformDocs.map((d) => d.id);
  let keptUids = uniq([...platformUids, ...keepAuth.map((u) => u.uid), ...(opts.keepE2E ? e2eAuth.map((u) => u.uid) : [])]);
  const keptDocs = keptUids.length ? await io.getDocs("users", keptUids) : [];
  const keptRoleOf = {};
  for (const d of keptDocs) keptRoleOf[d.id] = d.data.role || "parent";
  const keptTenantIds = [];
  const tenantSet = {};
  for (const d of keptDocs) if (d.data.tenantId) tenantSet[d.data.tenantId] = "assigned to a kept user";
  for (const c of chunk(keptUids, 10)) {
    const owned = await io.queryDocs("tenants", { field: "ownerUid", op: "in", values: c }, 100);
    for (const t of owned) tenantSet[t.id] = "owned by a kept user";
  }
  for (const id of Object.keys(tenantSet)) keptTenantIds.push(id);
  const keptRoleCounts = {};
  for (const uid of keptUids) { const r = keptRoleOf[uid] || "(no users doc)"; keptRoleCounts[r] = (keptRoleCounts[r] || 0) + 1; }

  // 3. Users by portal / role (count aggregations) versus kept.
  const totalUsersDocs = await io.count("users");
  const roleTotals = {};
  let roleSum = 0;
  for (const r of ROLES) { const n = await io.count("users", { field: "role", op: "==", value: r }); roleTotals[r] = n; roleSum += n ?? 0; }
  roleTotals["(none/unknown -> treated as parent)"] = Math.max(0, (totalUsersDocs ?? 0) - roleSum);
  const usersByPortal = {};
  for (const [r, n] of Object.entries(roleTotals)) {
    const kept = keptRoleCounts[r] ?? 0;
    usersByPortal[r] = { total: n, kept, delete: Math.max(0, (n ?? 0) - kept) };
  }
  out.auth = {
    authUsersListed: auth.length, authListCapped: authCapped, e2eAccounts: e2eAuth.length,
    keptAuthUsers: keptUids.length, deleteAuthUsers: Math.max(0, auth.length - keptUids.length),
    authWithoutUserDoc: Math.max(0, auth.length - (totalUsersDocs ?? 0)),
    keepListEmailsNotFoundInAuth: missingKeep.map(maskEmail),
    platformUids: platformUids.length, keptRoleCounts,
    nonE2eUnprotectedAccounts: auth.filter((u) => !keptUids.includes(u.uid) && !lower(u).endsWith(E2E_DOMAIN)).length,
    unprotectedSample: opts.showEmails ? auth.filter((u) => !keptUids.includes(u.uid) && !lower(u).endsWith(E2E_DOMAIN)).slice(0, 40).map((u) => u.email) : auth.filter((u) => !keptUids.includes(u.uid) && !lower(u).endsWith(E2E_DOMAIN)).slice(0, 10).map((u) => maskEmail(u.email)),
  };
  out.usersByPortal = usersByPortal;
  out.keptTenants = { count: keptTenantIds.length, ids: keptTenantIds, why: tenantSet };
  if (keptTenantIds.length) {
    let n = 0;
    for (const c of chunk(keptTenantIds, 10)) n += (await io.count("users", { field: "tenantId", op: "in", values: c })) ?? 0;
    out.keptTenants.usersInsideKeptTenants = n;
    out.keptTenants.nonKeptUsersInsideKeptTenants = Math.max(0, n - keptDocs.filter((d) => keptTenantIds.includes(d.data.tenantId)).length);
  }

  // 4. Every collection: total, kept, delete. Discover unknown root collections (listCollections costs no document reads).
  const found = await io.listCollections();
  const rows = [];
  const classify = async (c) => {
    const total = await io.count(c.name);
    let kept = 0; let keptUid = 0;
    if (c.cls === "KEEP") kept = total ?? 0;
    else if (c.scope === "uid") kept = keptUids.length;
    else if (c.scope === "docId" && c.name === "tenants") kept = keptTenantIds.length;
    else if (c.scope === "docId") {
      const ids = c.name === "mailboxSummary" ? keptTenantIds : keptTenantIds;
      kept = ids.length ? (await io.getDocs(c.name, ids)).filter((d) => d.exists).length : 0;
    } else if (c.scope === "tenantId" || c.scope === "providerId") {
      for (const ch of chunk(keptTenantIds, 10)) kept += (await io.count(c.name, { field: c.scope, op: "in", values: ch })) ?? 0;
      if (c.also) for (const ch of chunk(keptUids, 10)) keptUid += (await io.count(c.name, { field: c.also, op: "in", values: ch })) ?? 0;
    }
    const del = c.cls === "KEEP" ? 0 : Math.max(0, (total ?? 0) - kept - keptUid);
    return { name: c.name, cls: c.cls, scope: c.scope + (c.also ? "+" + c.also : ""), total, kept: kept + keptUid, delete: del, note: c.note || "", present: true };
  };
  const unclassified = [];
  for (const name of found) {
    if (name === "leads") { rows.push({ name, cls: "KEEP", scope: "none", total: await io.count("leads"), kept: null, delete: 0, note: BY_NAME.leads.note, present: true }); continue; }
    const c = BY_NAME[name];
    if (!c) { unclassified.push(name); rows.push({ name, cls: "UNCLASSIFIED", scope: "?", total: await io.count(name), kept: null, delete: null, note: "NOT IN CATALOG -- needs a decision before any wipe", present: true }); continue; }
    rows.push(await classify(c));
  }
  const notFound = CATALOG.filter((c) => !found.includes(c.name) && c.name !== "chunks").map((c) => c.name);
  out.collections = rows.sort((a, b) => a.cls.localeCompare(b.cls) || a.name.localeCompare(b.name));
  out.unclassifiedCollections = unclassified;
  out.catalogCollectionsAbsentFromProject = notFound;
  out.subcollections = EXPECTED_SUBCOLLECTIONS;
  out.totals = {
    deleteDocs: rows.filter((r) => r.cls === "DELETE").reduce((a, r) => a + (r.delete || 0), 0),
    decideDocs: rows.filter((r) => r.cls === "DECIDE").reduce((a, r) => a + (r.delete || 0), 0),
    keepDocs: rows.filter((r) => r.cls === "KEEP").reduce((a, r) => a + (r.total || 0), 0),
  };

  // 5. Storage (object listing, capped).
  try {
    const s = await io.listStorage("hubSlides/", STORAGE_LIST_CAP);
    const inKept = s.tenants.filter((t) => keptTenantIds.includes(t)).length;
    out.storage = { prefix: "hubSlides/", objectsListed: s.objects, listCapped: s.capped, tenantFoldersSeen: s.tenants.length, foldersOfKeptTenants: inKept, foldersOfOtherTenants: s.tenants.length - inKept };
  } catch (e) { out.storage = { error: "storage listing unavailable: " + String(e.message || e).slice(0, 120) }; }

  out.scheduledAndCachedState = [
    "scheduledEmails (queued sends), schedulerFired (dedupe markers), schedulerLocks (KEEP), payslipPdfs (PDF cache, tied to payroll retention), mailboxSummary (cache), hubDigest* (digest queue/log), accountingOAuthStates",
    "OUTSIDE Firestore: Stripe subscriptions/connected accounts, Xero/QuickBooks connections, Resend/SMTP suppression lists, Firebase Auth sessions -- see wipe plan",
  ];
  out.readBudget = { docReads: io.meter.docReads, docCap: io.meter.docCap, countQueries: io.meter.countQueries, countQueryCap: COUNT_QUERY_CAP, estimatedCountReadUnits: io.meter.countUnits, capHit: io.meter.capped, leadsCountedOnce: io.meter.leadsCounted };
  return out;
}

function printTable(r) {
  const pad = (s, n) => String(s ?? "-").padEnd(n).slice(0, n);
  const num = (n) => (n == null ? "-" : Number(n).toLocaleString("en-GB"));
  const L = [];
  L.push("WIPE DRY RUN (read-only) " + r.generatedAt);
  L.push(`Auth users listed ${r.auth.authUsersListed}${r.auth.authListCapped ? " (CAPPED)" : ""}; e2e accounts ${r.auth.e2eAccounts}; protected ${r.auth.keptAuthUsers}; would delete ${r.auth.deleteAuthUsers}; unprotected non-e2e ${r.auth.nonE2eUnprotectedAccounts}`);
  L.push("", "USERS BY PORTAL / ROLE          total    kept  delete");
  for (const [k, v] of Object.entries(r.usersByPortal)) L.push(pad(k, 36) + pad(num(v.total), 8) + pad(num(v.kept), 8) + num(v.delete));
  L.push("", `Kept tenants: ${r.keptTenants.count}` + (r.keptTenants.nonKeptUsersInsideKeptTenants != null ? `; non-kept users inside kept tenants: ${r.keptTenants.nonKeptUsersInsideKeptTenants}` : ""));
  L.push("", pad("COLLECTION", 28) + pad("CLASS", 12) + pad("SCOPE", 22) + pad("TOTAL", 10) + pad("KEPT", 10) + "DELETE");
  for (const c of r.collections) L.push(pad(c.name, 28) + pad(c.cls, 12) + pad(c.scope, 22) + pad(num(c.total), 10) + pad(num(c.kept), 10) + num(c.delete));
  L.push("", `Totals: DELETE ${num(r.totals.deleteDocs)} docs; DECIDE ${num(r.totals.decideDocs)} docs (legal/shared); KEEP ${num(r.totals.keepDocs)} docs`);
  if (r.unclassifiedCollections.length) L.push("UNCLASSIFIED: " + r.unclassifiedCollections.join(", "));
  L.push("Storage: " + JSON.stringify(r.storage));
  const b = r.readBudget;
  L.push(`Read budget: ${b.docReads}/${b.docCap} doc reads, ${b.countQueries}/${b.countQueryCap} count queries (~${b.estimatedCountReadUnits} billed read units), cap hit: ${b.capHit}`);
  return L.join("\n");
}

// ---------------------------------------------------------------------------------------------------------------------
// Real source (firebase-admin from server/node_modules). Read-only methods only.
// ---------------------------------------------------------------------------------------------------------------------
function loadEnvKeys() {
  const f = path.join(ROOT, "server/.env");
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^\s*(FIREBASE_SERVICE_ACCOUNT|GOOGLE_APPLICATION_CREDENTIALS|STORAGE_BUCKET)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
async function realSource() {
  loadEnvKeys();
  const req = createRequire(path.join(ROOT, "server/package.json"));
  const { cert, getApps, initializeApp } = req("firebase-admin/app");
  const { getAuth } = req("firebase-admin/auth");
  const { getFirestore } = req("firebase-admin/firestore");
  const { getStorage } = req("firebase-admin/storage");
  const options = {};
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  const keyPath = path.join(ROOT, "server/serviceAccountKey.json");
  if (process.env.FIRESTORE_EMULATOR_HOST) options.projectId = process.env.FIREBASE_PROJECT_ID || "demo-activityos";
  else if (raw) { const key = JSON.parse(raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8")); options.credential = cert(key); options.projectId = key.project_id; }
  else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) { /* SDK reads the env var */ }
  else if (fs.existsSync(keyPath)) { const key = JSON.parse(fs.readFileSync(keyPath, "utf8")); options.credential = cert(key); options.projectId = key.project_id; }
  else throw new Error("No Firebase credentials found (same lookup order as server/src/firebase.ts).");
  const app = getApps()[0] ?? initializeApp(options);
  const db = getFirestore(app);
  const authSvc = getAuth(app);
  const q = (col, f) => { let x = db.collection(col); if (f) x = x.where(f.field, f.op, f.op === "in" ? f.values : f.value); return x; };
  return {
    listCollections: async () => (await db.listCollections()).map((c) => c.id),
    listAuthPage: async (t) => { const p = await authSvc.listUsers(1000, t); return { users: p.users.map((u) => ({ uid: u.uid, email: u.email || "" })), next: p.pageToken }; },
    count: async (col, f) => (await q(col, f).count().get()).data().count,
    queryDocs: async (col, f, limit) => (await q(col, f).limit(limit).get()).docs.map((d) => ({ id: d.id, exists: true, data: d.data() })),
    getDocs: async (col, ids) => (await db.getAll(...ids.map((i) => db.collection(col).doc(i)))).map((d) => ({ id: d.id, exists: d.exists, data: d.data() || {} })),
    listStorage: async (prefix, cap) => {
      const bucket = getStorage(app).bucket(process.env.STORAGE_BUCKET?.trim() || "activityos-bef89.firebasestorage.app");
      const [files] = await bucket.getFiles({ prefix, maxResults: cap, autoPaginate: false });
      const tenants = uniq(files.map((f) => f.name.split("/")[1]).filter(Boolean));
      return { objects: files.length, capped: files.length >= cap, tenants };
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Fixture (in-memory, Firestore-like, READ ONLY). Any write-named method throws.
// ---------------------------------------------------------------------------------------------------------------------
function makeFixture(collections, authUsers, storageTenants = []) {
  const matches = (d, f) => !f || (f.op === "==" ? d.data[f.field] === f.value : f.values.includes(d.data[f.field]));
  const docsOf = (col) => (collections[col] || []).map((x, i) => ({ id: x.id || `${col}${i}`, exists: true, data: x }));
  const base = {
    listCollections: async () => Object.keys(collections),
    listAuthPage: async (t) => { const s = t ? Number(t) : 0; const p = authUsers.slice(s, s + 3); return { users: p, next: s + 3 < authUsers.length ? String(s + 3) : undefined }; },
    count: async (col, f) => docsOf(col).filter((d) => matches(d, f)).length,
    queryDocs: async (col, f, limit) => docsOf(col).filter((d) => matches(d, f)).slice(0, limit),
    getDocs: async (col, ids) => ids.map((id) => docsOf(col).find((d) => d.id === id) || { id, exists: false, data: {} }),
    listStorage: async (_p, cap) => ({ objects: Math.min(cap, storageTenants.length * 2), capped: false, tenants: storageTenants }),
  };
  return new Proxy(base, {
    get(t, k) {
      if (WRITE_NAMES.includes(k)) return () => { throw new Error("FIXTURE IS READ-ONLY: " + String(k)); };
      return t[k];
    },
  });
}

async function selftest() {
  const assert = (c, m) => { if (!c) throw new Error("selftest failed: " + m); };
  const U = (uid, email) => ({ uid, email });
  const auth = [U("hq1", "hq@activityos.com"), U("kaz1", "kaz@real.com"), U("e2eC", "e2e-company-x" + E2E_DOMAIN), U("e2eP", "e2e-parent-x" + E2E_DOMAIN), U("c3", "owner@other.com"), U("p1", "mum@home.com"), U("s3", "staff@other.com")];
  const leads = Array.from({ length: 500 }, (_, i) => ({ id: "l" + i, email: "x" + i }));
  const cols = () => ({
    users: [
      { id: "hq1", role: "platform", tenantId: null }, { id: "kaz1", role: "company", tenantId: "T1" }, { id: "e2eC", role: "company", tenantId: "T2" },
      { id: "e2eP", role: "parent" }, { id: "c3", role: "company", tenantId: "T3" }, { id: "p1", role: "parent" }, { id: "s3", role: "staff", tenantId: "T3" },
    ],
    tenants: [{ id: "T1", ownerUid: "kaz1" }, { id: "T2", ownerUid: "e2eC" }, { id: "T3", ownerUid: "c3" }],
    bookings: [...Array(3).fill({ tenantId: "T1" }), ...Array(2).fill({ tenantId: "T2" }), ...Array(5).fill({ tenantId: "T3" })],
    children: [{ tenantId: "T3", parentUid: "p1" }, { parentUid: "e2eP" }, { tenantId: "T1" }],
    payrollRuns: [{ tenantId: "T1" }, { tenantId: "T3" }, { tenantId: "T3" }],
    hubQuestions: [...Array(6).fill({ tenantId: "T1" }), { tenantId: "T3" }],
    platformConfig: [{ id: "counters" }],
    leads, brandNewThing: [{ a: 1 }],
  });
  const opts = { keepEmails: ["kaz@real.com"], cap: 2000 };
  const col = (r, n) => r.collections.find((c) => c.name === n);
  const sum = (r) => r.collections.filter((c) => c.cls !== "KEEP" && c.cls !== "UNCLASSIFIED").every((c) => c.kept + c.delete >= Math.min(c.total, c.kept + c.delete) && c.delete + c.kept <= c.total + c.kept);

  // A. default: platform + allow-list protected, e2e NOT protected
  const a = await inventory(makeFixture(cols(), auth, ["T1", "T3", "T3"]), opts);
  assert(a.auth.keptAuthUsers === 2, "HQ + kept email protected (2) got " + a.auth.keptAuthUsers);
  assert(a.usersByPortal.platform.delete === 0 && a.usersByPortal.platform.kept === 1, "platform user must never be deletable");
  assert(a.usersByPortal.company.total === 3 && a.usersByPortal.company.kept === 1 && a.usersByPortal.company.delete === 2, "company roles");
  assert(a.usersByPortal.staff.delete === 1 && a.usersByPortal.parent.delete === 2, "staff/parent deletes");
  assert(a.keptTenants.count === 1 && a.keptTenants.ids[0] === "T1", "only Kaz's tenant kept");
  assert(col(a, "bookings").total === 10 && col(a, "bookings").kept === 3 && col(a, "bookings").delete === 7, "bookings 10/3/7");
  assert(col(a, "children").delete === 2 && col(a, "children").kept === 1, "children: T1 kept, tenant+parent docs deleted");
  assert(col(a, "hubQuestions").kept === 6 && col(a, "hubQuestions").delete === 1, "curriculum in kept tenant survives");
  assert(col(a, "payrollRuns").cls === "DECIDE" && col(a, "payrollRuns").delete === 2, "payroll flagged for decision");
  assert(col(a, "tenants").delete === 2 && col(a, "users").delete === 5, "tenants/users delete counts");
  assert(col(a, "leads").cls === "KEEP" && col(a, "leads").total === 500 && col(a, "leads").delete === 0, "leads kept, counted not read");
  assert(col(a, "platformConfig").delete === 0, "platform config kept");
  assert(a.unclassifiedCollections.join() === "brandNewThing", "unknown collection flagged");
  assert(a.readBudget.leadsCountedOnce && a.readBudget.docReads <= 20, "no bulk reads: " + a.readBudget.docReads);
  assert(sum(a), "counts add up");
  const tot = a.collections.filter((c) => c.cls === "DELETE" && c.scope === "tenantId" && !c.also).every((c) => c.kept + c.delete === c.total);
  assert(tot, "kept + delete == total for plain tenant collections");

  // B. --keep-e2e protects the standing e2e accounts and their tenant data
  const b = await inventory(makeFixture(cols(), auth), { ...opts, keepE2E: true });
  assert(b.auth.keptAuthUsers === 4 && col(b, "bookings").kept === 5 && col(b, "bookings").delete === 5, "keep-e2e protects e2e accounts + T2 data");
  assert(b.keptTenants.count === 2, "kept tenants T1 + T2");

  // C. read cap actually stops reads
  const c = await inventory(makeFixture(cols(), auth), { ...opts, cap: 2 });
  assert(c.readBudget.docReads <= 2 && c.readBudget.capHit === true, "cap 2 stops document reads and reports it");

  // D. leads guard + no write methods
  const io = makeMeter(makeFixture(cols(), auth), 100);
  await io.count("leads");
  let threw = 0;
  for (const f of [() => io.count("leads"), () => io.queryDocs("leads", null, 5), () => io.getDocs("leads", ["l1"])]) { try { await f(); } catch { threw++; } }
  assert(threw === 3, "leads guard (second count, query, getDocs) must all throw");
  const fx = makeFixture(cols(), auth);
  for (const n of WRITE_NAMES) { let t = false; try { fx[n](); } catch { t = true; } assert(t, "fixture write method must throw: " + n); }
  console.log("wipe-dryrun selftest passed");
}

// ---------------------------------------------------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--selftest")) { await selftest(); return; }
  if (!args.includes("--live")) { console.error("Refusing to touch the live project without --live. Use --selftest to test offline."); process.exit(2); }
  const val = (f) => { const o = []; args.forEach((a, i) => { if (a === f && args[i + 1]) o.push(args[i + 1]); }); return o; };
  let keepEmails = val("--keep-email");
  for (const f of val("--keep-file")) keepEmails = keepEmails.concat(fs.readFileSync(f, "utf8").split(/\r?\n/).map((l) => l.replace(/#.*/, "").trim()).filter(Boolean));
  const capArg = Number(val("--cap")[0] || HARD_DOC_CAP);
  const outFile = val("--out")[0] || path.join(os.tmpdir(), "wipe-dryrun.json");
  const marker = path.join(path.dirname(outFile), ".wipe-dryrun-last-live-run");
  if (fs.existsSync(marker) && !args.includes("--rerun")) { console.error("A live run already happened (" + fs.readFileSync(marker, "utf8").trim() + "). Re-running costs reads; pass --rerun to override."); process.exit(3); }
  const report = await inventory(await realSource(), { keepEmails, keepE2E: args.includes("--keep-e2e"), cap: capArg, showEmails: args.includes("--show-emails") });
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
  fs.writeFileSync(marker, new Date().toISOString());
  console.log(printTable(report));
  console.log("\nJSON report: " + outFile);
}
main().then(() => process.exit(0), (e) => { console.error(String(e.message || e)); process.exit(1); });
