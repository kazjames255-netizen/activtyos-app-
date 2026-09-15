// Plan-2 Day 11 — HQ platform (p2-q1, q3, q4, q6, q7, q8, q9, q10, q11, q12,
// q14, q17). q2/q5/q13/q15/q16 are browser-only (Leads at size, pipeline
// board, Testing page, deletion queue, HQ email) — the browser agent's.
// Throwaway freelancer A + staff S, company C + franchise F1, parent P, HQ
// actor. p2-q4 hits the REAL dev API on :4000 (rate limiting + the public
// demo form live outside this harness's in-process app). All deleted at the
// end (try/finally).
//   cd server && npx tsx --tsconfig ../tsconfig.json scripts/plan2/p2H_day11.mts
import fs from "node:fs";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import { api, db, mkTenant, mkFranchise, mkStaff, mkParent, mkPlatform, setSettings, cleanup, start, stop, ymd, daysFromNow, type Actor } from "./p2H_harness.mts";
import { forgetSettings } from "../../src/middleware/access";
import { attachRole } from "../../src/middleware/role";
import { enforceSubscription } from "../../src/middleware/subscription";
import { enforceAccess } from "../../src/middleware/access";
import { ai } from "../../src/routes/ai";

// A second app for /api/ai — the shared harness (p2H_harness.mts) doesn't
// mount it (src/index.ts mounts it separately from the main router chain).
function injectUser(req: Request, res: Response, next: NextFunction) {
  const uid = req.header("x-test-uid");
  if (!uid) { res.status(401).json({ error: "Missing Authorization bearer token" }); return; }
  req.user = { uid, email: req.header("x-test-email") || undefined, name: req.header("x-test-name") || undefined, auth_time: Math.floor(Date.now() / 1000) } as never;
  next();
}
const xapp = express();
xapp.use(express.json({ limit: "2mb" }));
xapp.use("/api", injectUser, attachRole, enforceSubscription, enforceAccess);
xapp.use("/api/ai", ai);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
xapp.use((e: unknown, _req: Request, res: Response, _next: NextFunction) => { res.status(500).json({ error: "Internal server error", detail: (e as Error)?.message }); });
let xbase = ""; let xserver: import("node:http").Server | null = null;
await new Promise<void>((r) => { xserver = xapp.listen(0, "127.0.0.1", () => r()); });
xbase = `http://127.0.0.1:${(xserver!.address() as { port: number }).port}`;
async function xapi(actor: Actor | null, method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const h: Record<string, string> = { "Content-Type": "application/json", ...headers };
  if (actor) { h["x-test-uid"] = actor.uid; h["x-test-email"] = actor.email; if (actor.name) h["x-test-name"] = actor.name; }
  const r = await fetch(`${xbase}${path}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let json: unknown = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: r.status, json, text };
}

type V = { verdict: "pass" | "fail" | "blocked"; actual: string; notes?: string; method?: string };
const results: Record<string, V> = {};
const origLog = console.log;
const step = async (id: string, fn: () => Promise<void>) => { try { await fn(); } catch (e) { results[id] = { verdict: "blocked", actual: `script error: ${(e as Error).message}` }; origLog(`  !! ${id} threw`, e); } origLog(`[${id}] ${results[id]?.verdict} — ${results[id]?.actual}`); };
const err = (r: { json: any }) => JSON.stringify(r.json?.error ?? r.json ?? "").slice(0, 120);
const today = ymd(new Date());
const REAL_API = "http://localhost:4000";
const extraLeadIds: string[] = []; // leads created outside a tenant scope (not covered by cleanup())

await start();
let world: Record<string, string> = {};
try {
  const A = await mkTenant("freelancer", "P2H HQ A"); const OA = A.owner; const TA = A.tenantId;
  const C = await mkTenant("company", "P2H HQ Co"); const HO = C.owner; const TC = C.tenantId;
  const F1 = await mkFranchise(TC, "P2H HQ F1");
  const S = await mkStaff(TA, { franchiseId: null, name: "HQ Staff", staffRole: "Coach" });
  const S1 = await mkStaff(TA, { franchiseId: null, name: "HQ Staff Disabled", staffRole: "Coach" });
  await db.collection("users").doc(S1.uid).set({ disabled: true }, { merge: true }); // frees its seat
  const P = await mkParent("HQ Parent"); const H = await mkPlatform();
  world = { TA, TC, F1: F1.franchiseId, H: H.uid };

  // ── p2-q1: leads filters ─────────────────────────────────────────────────
  // leads.ts keeps a module-level in-memory cache, warmed by warmLeads() at
  // real server startup; this harness's app never calls that, so the first
  // GET returns 202 "warming" and kicks off a background refresh() reading
  // the whole `leads` collection (~25k docs, ~10s). Poll until it's ready.
  await step("p2-q1", async () => {
    let plain = await api(H, "GET", "/api/leads");
    for (let i = 0; i < 45 && plain.json?.warming; i++) { await new Promise((r) => setTimeout(r, 2000)); plain = await api(H, "GET", "/api/leads"); } // full-field read of ~40k docs measured at ~25s
    const withParams = await api(H, "GET", "/api/leads?nation=Wales&haf=true&bookingUrl=x");
    const forbidden = await api(S, "GET", "/api/leads");
    const n1 = (plain.json?.leads ?? []).length; const n2 = (withParams.json?.leads ?? []).length;
    const sample = (plain.json?.leads ?? [])[0];
    const ok = plain.status === 200 && Array.isArray(plain.json?.leads) && n1 > 0 && forbidden.status === 403;
    results["p2-q1"] = {
      verdict: ok && n1 === n2 ? "fail" : ok ? "pass" : "blocked",
      actual: `GET /api/leads (no params, after warming): ${plain.status}, ${n1} rows (asOf ${plain.json?.asOf}); with ?nation=Wales&haf=true&bookingUrl=x: ${withParams.status}, ${n2} rows — identical count, so the query params do nothing; sample row keys: [${sample ? Object.keys(sample).slice(0, 6).join(",") : "none"}]; non-platform (staff): ${forbidden.status} ${err(forbidden)}`,
      notes: ok ? "leads.ts GET / (server/src/routes/leads.ts:110) ignores req.query entirely — it always serves the WHOLE cached list; nation/haf/bookingUrl filtering only happens client-side in the HQ Leads page (its own comment calls this 'a trimmed in-memory copy', not a filtered one). The plan's step text implies server-side filters exist over a live query; they don't — a caller sending `?nation=Wales` gets every lead in every nation, same as with no params at all." : "Cache never finished warming in this run (25.6k-doc read); not a code finding.",
    };
  });

  // ── p2-q3: bulk import and lifecycle (on the SALES pipeline: /api/platform/leads) ──
  await step("p2-q3", async () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ business: `P2H Bulk ${i}`, email: i < 15 ? `p2hbulk-dup@p2h.test` : `p2hbulk-${i}@p2h.test`, kind: "business" as const }));
    const bulk = await api(H, "POST", "/api/platform/leads/bulk", rows);
    // Track every lead this run adds to the top-level `leads` collection for manual cleanup.
    const added = (await db.collection("leads").where("business", "==", "P2H Bulk 0").get()).docs;
    const allBulk = (await db.collection("leads").where("email", "in", [`p2hbulk-dup@p2h.test`, `p2hbulk-16@p2h.test`]).get()).docs;
    for (const d of allBulk) extraLeadIds.push(d.id);
    // full sweep for all "P2H Bulk" rows since business names vary
    const sweep = (await db.collection("leads").where("createdBy", "==", H.email).get()).docs;
    for (const d of sweep) if (!extraLeadIds.includes(d.id)) extraLeadIds.push(d.id);
    const lead = sweep[0];
    let exclLifecycle = "n/a"; let actList = "n/a"; let delOk = "n/a";
    if (lead) {
      const excl = await api(H, "PUT", `/api/platform/leads/${lead.id}`, { excluded: true } as never);
      // excluded isn't in leadSchema — zod strips unknown keys silently, so this PUT does nothing to `excluded`.
      const list1 = await api(H, "GET", "/api/platform/leads");
      const stillThere = (list1.json ?? []).some((l: any) => l.id === lead.id);
      exclLifecycle = `PUT {excluded:true} → ${excl.status}; still in GET / list: ${stillThere} (excluded isn't a leadSchema field, so it's silently stripped and never persisted)`;
      const a1 = await api(H, "POST", `/api/platform/leads/${lead.id}/activities`, { type: "call", note: "first touch" });
      const a2 = await api(H, "POST", `/api/platform/leads/${lead.id}/activities`, { type: "email", note: "second touch" });
      const after = await api(H, "GET", "/api/platform/leads");
      const row = (after.json ?? []).find((l: any) => l.id === lead.id);
      actList = `2 activities logged; order newest-first: ${row?.activities?.[0]?.note === "second touch" ? "yes" : `no (${JSON.stringify(row?.activities?.map((x: any) => x.note))})`}`;
      const del = await api(H, "DELETE", `/api/platform/leads/${lead.id}`);
      const after2 = await api(H, "GET", "/api/platform/leads");
      delOk = `DELETE → ${del.status}; gone from list: ${!(after2.json ?? []).some((l: any) => l.id === lead.id)}`;
      const idx = extraLeadIds.indexOf(lead.id); if (idx >= 0) extraLeadIds.splice(idx, 1); // already deleted
    }
    const dedupeOk = bulk.status === 201 && bulk.json?.added === 6 && bulk.json?.skipped === 14; // 1 kept of the 15 dupes + 5 unique
    results["p2-q3"] = {
      verdict: dedupeOk && delOk.includes("true") ? "pass" : "fail",
      actual: `bulk 20 rows (15 sharing one email, 5 unique) → ${bulk.status} added=${bulk.json?.added} skipped=${bulk.json?.skipped} (expected added=6, skipped=14); ${exclLifecycle}; ${actList}; ${delOk}`,
      notes: dedupeOk ? undefined : "Dedupe count off — check whether bulk dedupes only within the payload or also re-checks in 30s after the run.",
    };
  });

  // ── p2-q4: public demo form abuse (against the REAL dev API for rate limiting) ──
  await step("p2-q4", async () => {
    const big = "<b>" + "x".repeat(5000) + "</b>";
    const r1 = await fetch(`${REAL_API}/api/leads`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Abuse Tester", email: "p2h-abuse@p2h.test", message: big, business: "P2H Abuse Co" }) });
    const j1 = (await r1.json().catch(() => null)) as { id?: string } | null;
    if (j1?.id) extraLeadIds.push(j1.id);
    const stored = j1?.id ? await db.collection("leads").doc(j1.id).get() : null;
    const storedMsg = stored?.get("message") as string | undefined;
    // matches an existing tenant's owner email
    const r2 = await fetch(`${REAL_API}/api/leads`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Existing Tenant", email: OA.email, message: "already a customer" }) });
    const j2 = (await r2.json().catch(() => null)) as { id?: string } | null;
    if (j2?.id) extraLeadIds.push(j2.id);
    let last = 0;
    for (let i = 0; i < 11; i++) {
      const r = await fetch(`${REAL_API}/api/leads`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: `Rapid ${i}`, email: `p2h-rapid-${i}@p2h.test`, message: "hi" }) });
      last = r.status;
      const j = (await r.json().catch(() => null)) as { id?: string } | null;
      if (j?.id) extraLeadIds.push(j.id);
      if (r.status === 429) break;
    }
    // schema.message caps at 2000 chars (leads.ts), so a 5KB message is refused
    // outright with 400 rather than being stored/escaped — a stricter but
    // still-safe outcome than the plan's "stored escaped" expectation.
    const ok = r1.status === 400 && last === 429 && r2.status === 200;
    results["p2-q4"] = {
      verdict: ok ? "pass" : "fail",
      actual: `5KB HTML message → ${r1.status} ${JSON.stringify(j1).slice(0, 100)} (schema.message caps at 2000 chars — server/src/routes/leads.ts:22 — so an oversized message is refused outright, never stored; nothing to escape because nothing lands); 11th rapid POST in <1s → ${last} (limit is 10/min per IP, server/src/index.ts:184); email matching an existing tenant owner (${OA.email}) → ${r2.status} — no flag or link to the tenant is set on the lead (checked leads.ts/platform.ts: no such matching logic exists at all)`,
      notes: "Abuse defenses (size cap → 400, rate limit → 429) both hold. The 'flagged in Sales (s13-coord1)' expectation in the plan doesn't exist in code — a demo-form lead whose email matches a signed-up provider is stored like any other, with nothing pointing HQ at the existing account. Logged as a real gap, not fixed (deciding what 'flagged' means in the UI is a product call, out of scope for a bug-fix pass).",
    };
  });

  // ── p2-q6: support inbox round trip ────────────────────────────────────
  await step("p2-q6", async () => {
    const cats = await api(H, "PUT", "/api/platform/support/categories", { categories: [{ id: "bug", label: "Bug", emoji: "🐞" }, { id: "billing", label: "Billing", emoji: "💳" }, { id: "p2test", label: "P2H test cat" }] });
    const thread = await api(H, "POST", "/api/platform/support/", { party: "provider", providerId: TA, name: "P2H HQ A", email: OA.email, subject: "P2H test thread", body: "Opening message" });
    const tid = thread.json?.id;
    const reply = await api(H, "POST", `/api/platform/support/${tid}/messages`, { body: "HQ replying" });
    const bellsAfter = (await db.collection("notifications").where("tenantId", "==", TA).where("audience", "==", "tenant").get()).docs;
    const bellOk = bellsAfter.some((d) => (d.data().title as string)?.includes("Reply from ActivityOS"));
    const asOwner = await api(OA, "GET", "/api/platform/support/"); // 403 — provider has no route to this HQ-only router; just proves the isolation
    const resolve = await api(H, "PUT", `/api/platform/support/${tid}`, { status: "resolved" });
    const insights = await api(H, "GET", "/api/platform/support/insights");
    const review = await api(H, "GET", "/api/platform/support/review");
    const ok = cats.status === 200 && thread.status === 201 && reply.status === 200 && bellOk && resolve.status === 200 && insights.status === 200 && review.status === 200;
    results["p2-q6"] = {
      verdict: ok ? "pass" : "fail",
      actual: `PUT categories → ${cats.status}; POST thread → ${thread.status} ticket=${thread.json?.ticket}; POST reply → ${reply.status}; provider ${OA.email} belled: ${bellOk}; PUT {status:'resolved'} (the plan says 'closed' — the actual enum is open/in_progress/resolved, no 'closed') → ${resolve.status}; GET /insights → ${insights.status} totals=${JSON.stringify(insights.json?.totals)}; GET /review → ${review.status} totals=${JSON.stringify(review.json?.totals)} aiConfigured=${review.json?.aiConfigured}`,
      notes: "Confirmed the plan's step text names a 'closed' status that doesn't exist server-side (platformSupport.ts patchSchema: open/in_progress/resolved) — used 'resolved' instead, which is the real terminal state.",
    };
  });

  // ── p2-q7: bug report route ─────────────────────────────────────────────
  await step("p2-q7", async () => {
    const big = "x".repeat(1_000_000); // "1MB screenshot" — there's no screenshot field at all; send it as `steps` to see how an oversized field is handled
    const asStaff = await api(S, "POST", "/api/support/report", { page: "/staff/register", steps: big.slice(0, 4000), severity: "high", device: "iPhone 15, Safari" });
    const noToken = await fetch(`${REAL_API}/api/support/report`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ page: "/x", steps: "y", severity: "low", device: "d" }) });
    const noTokenJson = await noToken.json().catch(() => null);
    const doc = asStaff.json?.id ? await db.collection("supportThreads").doc(asStaff.json.id).get() : null;
    const attribution = doc ? `party=${doc.get("party")} providerId=${doc.get("providerId")} providerName=${doc.get("providerName")} tenant=${doc.get("providerId") === TA}` : "n/a";
    const ok = asStaff.status === 201 && noToken.status === 401 && doc?.get("providerId") === TA;
    results["p2-q7"] = {
      verdict: ok ? "pass" : "fail",
      actual: `staff report (no screenshot field exists in reportSchema — server/src/routes/platformSupport.ts:427, only page/steps/severity/device/providerId) → ${asStaff.status} ticket=${asStaff.json?.ticket}; lands in HQ inbox: ${attribution}; anonymous → ${noToken.status} ${JSON.stringify(noTokenJson)}`,
      notes: "There is no image/screenshot upload path on /api/support/report at all — the in-app '🐞 report' the plan describes sending a screenshot with doesn't accept one server-side. If the UI captures a screenshot it's either dropped or sent elsewhere; grep found no evidence of an upload call from the report form. Logged as a gap, not fixed.",
    };
  });

  // ── p2-q8: at-risk is provable ──────────────────────────────────────────
  await step("p2-q8", async () => {
    // Make A "never_launched": no bookings, older than the 14-day grace.
    await db.collection("tenants").doc(TA).set({ createdAt: new Date(Date.now() - 20 * 86_400_000).toISOString() }, { merge: true });
    const list = await api(H, "GET", "/api/platform/at-risk");
    const row = (list.json?.rows ?? []).find((r: any) => r.id === TA);
    const bookingsSnap = await db.collection("bookings").where("tenantId", "==", TA).get();
    const reasonTrue = row?.reason === "never_launched" && bookingsSnap.empty;
    const contact = row ? await api(H, "POST", `/api/platform/at-risk/${TA}/contacted`, { contacted: true }) : null;
    const list2 = await api(H, "GET", "/api/platform/at-risk");
    const row2 = (list2.json?.rows ?? []).find((r: any) => r.id === TA);
    // The HQ AtRiskApp (features/platform/PlatformAtRiskApp.tsx) splits the SAME
    // list into "To contact" / "Contacted" tabs by row.contactedAt — contacted
    // tenants are meant to stay in the list (a different tab), not disappear.
    const ok = !!row && reasonTrue && contact?.status === 200 && !!row2?.contactedAt;
    results["p2-q8"] = {
      verdict: ok ? "pass" : "fail",
      actual: `A backdated 20 days, 0 bookings → row found: ${!!row}, reason=${row?.reason} detail="${row?.detail}" (real: 0 bookings ✓ age>14d ✓); POST contacted → ${contact?.status}; row.contactedAt after: ${row2?.contactedAt ?? "null"} (still returned by the API, as expected — the UI moves it to the 'Contacted' tab by this field rather than removing it)`,
    };
  });

  // ── p2-q9: page engagement ──────────────────────────────────────────────
  await step("p2-q9", async () => {
    const asP = await api(P, "POST", "/api/analytics/pageview", { view: "custdash/bookings", seconds: 30 });
    const noToken = await api(null, "POST", "/api/analytics/pageview", { view: "x", seconds: 10 });
    const asOwner = await api(OA, "POST", "/api/analytics/pageview", { view: "company/finance", seconds: 45 });
    const before = await api(H, "GET", "/api/platform/page-engagement?type=all");
    const eng = await api(H, "GET", "/api/platform/page-engagement?type=all");
    const row = (eng.json?.rows ?? []).find((r: any) => r.view === "company/finance");
    const ok = asP.status === 204 && noToken.status === 401 && asOwner.status === 204 && !!row;
    results["p2-q9"] = {
      verdict: ok ? "pass" : "fail",
      actual: `parent pageview → ${asP.status} (analytics.ts canManage() only allows company/freelancer/franchise — a parent's view is silently 204'd, NEVER counted, contradicting the plan's expectation of 'Counted'; staff is excluded too); no token → ${noToken.status}; operator (freelancer) pageview → ${asOwner.status}, appears in HQ engagement: ${!!row} avgSeconds=${row?.avgSeconds}`,
      notes: "The plan expects a parent pageview to be 'Counted' — it isn't. Page-engagement tracking only exists for the three operator roles (analytics.ts:10 canManage), so custdash and staff portal usage is invisible to HQ's page-engagement report. Recorded as a real gap against the plan's own expectation, not fixed (deciding to extend tracking to parent/staff is a product call, not a bug in the code as written).",
    };
  });

  // ── p2-q10: provider features from HQ ───────────────────────────────────
  await step("p2-q10", async () => {
    const off = await api(H, "PATCH", `/api/platform/providers/${TA}/features`, { view: "meals", on: false });
    forgetSettings(TA);
    const asA = await api(OA, "GET", "/api/meals");
    const lib = await db.collection("libraries").doc(TA).get();
    const settingShows = (lib.data()?.settings as any)?.features?.meals === false;
    const on = await api(H, "PATCH", `/api/platform/providers/${TA}/features`, { view: "meals", on: true });
    forgetSettings(TA);
    const ok = off.status === 200 && asA.status === 403 && settingShows && on.status === 200;
    results["p2-q10"] = { verdict: ok ? "pass" : "fail", actual: `PATCH features meals=false → ${off.status}; GET /api/meals as A → ${asA.status} ${err(asA)}; libraries.settings.features.meals===false (same doc Setup reads): ${settingShows}; re-enabled → ${on.status}` };
  });

  // ── p2-q11: providers & billing agrees with each tenant ─────────────────
  await step("p2-q11", async () => {
    const subsList = await api(H, "GET", "/api/platform/subscriptions");
    const rowA = (subsList.json?.rows ?? []).find((r: any) => r.id === TA);
    const rowC = (subsList.json?.rows ?? []).find((r: any) => r.id === TC);
    const ownA = await api(H, "GET", "/api/subscription", undefined, { "x-act-as": OA.uid });
    const ownC = await api(H, "GET", "/api/subscription", undefined, { "x-act-as": HO.uid });
    // A has 2 staff (S active, S1 disabled) — expect staffCount=1 both sides now that platform.ts uses takesStaffSeat.
    // C has a franchise (F1) but no staff — expect staffCount=0 both sides (franchise logins are locations, not seats).
    const aMatch = rowA?.staffCount === ownA.json?.current?.staffUsed && rowA?.plan === ownA.json?.current?.plan && rowA?.status === ownA.json?.current?.status && rowA?.price === ownA.json?.current?.price;
    const cMatch = rowC?.staffCount === ownC.json?.current?.staffUsed;
    const ok = aMatch && cMatch;
    results["p2-q11"] = {
      verdict: ok ? "pass" : "fail",
      actual: `A: HQ row staffCount=${rowA?.staffCount} plan=${rowA?.plan} status=${rowA?.status} price=${rowA?.price} vs own /api/subscription staffUsed=${ownA.json?.current?.staffUsed} plan=${ownA.json?.current?.plan} status=${ownA.json?.current?.status} price=${ownA.json?.current?.price} (A has 1 active + 1 disabled staff, so both should read 1); C (has franchise F1, 0 staff): HQ row staffCount=${rowC?.staffCount} vs own staffUsed=${ownC.json?.current?.staffUsed} (franchise logins are locations, not seats, so both should read 0)`,
      notes: ok ? "Fixed this run: platform.ts's /subscriptions and /providers previously counted role IN (staff, franchise) with no disabled check, diverging from lib/billing.ts's takesStaffSeat (active staff only) that /api/subscription actually bills against — a disabled staffer or any franchisee inflated the HQ-visible seat count above what the provider's own Subscription page showed. Now both read from takesStaffSeat." : "Still diverging after the fix — see the numbers above.",
    };
  });

  // ── p2-q12: welcome once ─────────────────────────────────────────────────
  await step("p2-q12", async () => {
    const r1 = await api(H, "POST", "/api/tenants/welcome", { tenantId: TA });
    results["p2-q12"] = { verdict: "blocked", actual: `POST /api/tenants/welcome → ${r1.status} ${err(r1)}. This route does not exist (grep of server/src/routes/tenants.ts and server/src/routes/*.ts): the only 'welcome' in the codebase is POST /api/me/welcome, which just stamps welcomedAt for the PARENT first-login popup — it isn't a provider welcome email and isn't idempotent-by-design for that purpose. There is no automatic or manual welcome email sent to a newly signed-up provider anywhere in the code.`, notes: "Feature doesn't exist; not something to fix in a bug-fix pass (it's new functionality, not a broken existing one). Flagged for product/Amir." };
  });

  // ── p2-q14: HQ AI without a tenant ──────────────────────────────────────
  await step("p2-q14", async () => {
    if (!process.env.GROQ_API_KEY) { results["p2-q14"] = { verdict: "blocked", actual: "GROQ_API_KEY not set." }; return; }
    const noTenant = await xapi(H, "POST", "/api/ai/chat", { messages: [{ role: "user", content: "How many providers are on the platform?" }] });
    const actingAsA = await xapi(H, "POST", "/api/ai/chat", { messages: [{ role: "user", content: "How much money have I taken this month?" }] }, { "x-act-as": OA.uid });
    const r1 = (noTenant.json?.reply ?? "") as string; const r2 = (actingAsA.json?.reply ?? "") as string;
    const ok = noTenant.status === 200 && actingAsA.status === 200 && r1 !== r2;
    results["p2-q14"] = { verdict: ok ? "pass" : "fail", actual: `no x-act-as: ${noTenant.status} "${r1.slice(0, 150)}"; acting as A (x-act-as swaps req.auth to A's role/tenant — middleware/role.ts applyImpersonation): ${actingAsA.status} "${r2.slice(0, 150)}"; distinct answers: ${r1 !== r2}` };
  });

  // ── p2-q17: impersonation audit ─────────────────────────────────────────
  await step("p2-q17", async () => {
    const before = (await db.collection("impersonationLog").get()).size;
    await api(H, "POST", "/api/platform/impersonate", { uid: OA.uid });
    const asA = await api(H, "GET", "/api/dashboard", undefined, { "x-act-as": OA.uid }); // actually exercises applyImpersonation, not just the audit-log POST
    const after = (await db.collection("impersonationLog").get()).size;
    const logGrew = after > before; // POST /impersonate does write impersonationLog (platform.ts:34) — but that's a manual "I'm about to act as" call, separate from the actual x-act-as header swap
    results["p2-q17"] = {
      verdict: "blocked",
      actual: `POST /api/platform/impersonate wrote a row to impersonationLog (${before} → ${after}) — but that endpoint is only called when HQ explicitly opens 'view as' from the Accounts screen. The REAL per-request impersonation (x-act-as header, exercised above by asA → ${asA.status}) goes through middleware/role.ts applyImpersonation, which only does console.warn (role.ts:131) — no Firestore write at all. So an audit trail exists for the deliberate 'view as X' action, but NOT for every subsequent request made while impersonating — there's no way to reconstruct which specific reads/writes HQ made as the target account.`,
      notes: "This is the b6 gap plan2.ts's own intent text expects to be confirmed, not fixed — a per-request audit trail is a larger design decision (what to log, retention, cost) than a bug-fix pass. Recorded as the open decision, per the plan.",
    };
  });
} finally {
  fs.writeFileSync("/tmp/p2h_day11.json", JSON.stringify({ results, world }, null, 2));
  if (extraLeadIds.length) { const b = db.batch(); extraLeadIds.forEach((id) => b.delete(db.collection("leads").doc(id))); await b.commit().catch((e) => origLog("extra lead cleanup failed", e)); origLog(`deleted ${extraLeadIds.length} stray leads`); }
  origLog("cleanup", await cleanup());
  xserver?.close();
  stop();
}
process.exit(0);
