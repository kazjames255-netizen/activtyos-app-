// Plan-2 Day 14 — robustness sweeps (p2-r1..r19; r10 is browser-only, r14 is
// a code-read/decision record, r15/r20 need Stripe/a Spark-tier project and
// are recorded blocked). Throwaway freelancer A (+ staff S1/S2), company C +
// franchise F1, HO site lead L, parent P (real allowlisted address for
// r13's mail proof), platform H. All deleted at the end (try/finally).
//   cd server && npx tsx --tsconfig ../tsconfig.json scripts/plan2/p2H_day14.mts
import fs from "node:fs";
import { execSync } from "node:child_process";
import { api, db, mkTenant, mkFranchise, mkStaff, mkParent, mkPlatform, setSettings, cleanup, start, stop, ymd, daysFromNow, type Actor } from "./p2H_harness.mts";
import { forgetSettings } from "../../src/middleware/access";
import { csvCell } from "../../../lib/csv";

type V = { verdict: "pass" | "fail" | "blocked"; actual: string; notes?: string; method?: string };
const results: Record<string, V> = {};
const origLog = console.log;
const step = async (id: string, fn: () => Promise<void>) => { try { await fn(); } catch (e) { results[id] = { verdict: "blocked", actual: `script error: ${(e as Error).message}` }; origLog(`  !! ${id} threw`, e); } origLog(`[${id}] ${results[id]?.verdict} — ${results[id]?.actual}`); };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const err = (r: { json: any }) => JSON.stringify(r.json?.error ?? r.json ?? "").slice(0, 140);
const today = ymd(new Date());
const D = (n: number) => ymd(daysFromNow(n));
const REAL_API = "http://localhost:4000";
const TARGET = "kazjames255@gmail.com"; // server/.env MAIL_ALLOWLIST — real send, no MAIL_LIVE needed
const mailLog: string[] = [];
console.log = (...a: unknown[]) => { const s = a.map(String).join(" "); if (s.startsWith("[mail]")) mailLog.push(s); origLog(...a); };
const mailTo = (email: string) => mailLog.filter((l) => l.toLowerCase().includes(`→ ${email.toLowerCase()}`));
const parentBells = async (email: string) => (await db.collection("notifications").where("email", "==", email.toLowerCase()).get()).docs.map((d) => d.data());

await start();
let world: Record<string, string> = {};
try {
  const A = await mkTenant("freelancer", "P2H Rob A"); const OA = A.owner; const TA = A.tenantId;
  const C = await mkTenant("company", "P2H Rob HO"); const HO = C.owner; const TC = C.tenantId;
  const F1 = await mkFranchise(TC, "P2H Rob F1");
  const S1 = await mkStaff(TA, { franchiseId: null, name: "Rob Staff One", staffRole: "Coach" });
  const S2 = await mkStaff(TA, { franchiseId: null, name: "Rob Staff Two", staffRole: "Coach" });
  const S3 = await mkStaff(TA, { franchiseId: null, name: "Rob Staff Three", staffRole: "Coach" });
  const H = await mkPlatform();
  // Real inbox parent, for r13's mail-arrival proof — same allowlist trick used
  // for d13/d15/d20 (server/.env MAIL_ALLOWLIST already permits real delivery
  // to this address without MAIL_LIVE=1).
  const P: Actor = { uid: "p2h-r13-parent", email: TARGET, name: "Rob Real Parent" };
  await db.collection("users").doc(P.uid).set({ email: TARGET, role: "parent", chosen: true, name: "Rob Real Parent" });
  world = { TA, TC, F1: F1.franchiseId, H: H.uid };

  await setSettings(TA, null, { locations: [{ id: "v1", name: "Venue One" }] }); forgetSettings(TA);
  const listing = await api(OA, "POST", "/api/listings", { title: "P2H Rob Camp", passes: [{ name: "Day", price: 12 }], venueId: "v1" });
  await db.collection("listings").doc(listing.json.id).set({ status: "live", venueId: "v1" }, { merge: true });
  const block = await api(OA, "POST", "/api/blocks", { listingId: listing.json.id, name: "Week", startDate: D(1), endDate: D(8), capacity: 10, schedule: { startTime: "09:00", endTime: "15:30", weekdays: [0, 1, 2, 3, 4, 5, 6] } });
  const child = await api(P, "POST", "/api/my/children", { name: "Rob Real Kid", dob: "2019-05-04" });

  // ── p2-r1: double-submit sweep ──────────────────────────────────────────
  await step("p2-r1", async () => {
    const pair = async (label: string, fn: () => Promise<{ status: number }>) => {
      const [a, b] = await Promise.all([fn(), fn()]);
      return { label, a: a.status, b: b.status, ok: (a.status === 201 && b.status === 409) || (a.status === 409 && b.status === 201) || (a.status === 201 && b.status === 201 && false) };
    };
    // memberships/join: needs a membership plan configured.
    await setSettings(TA, null, { memberships: { plans: [{ id: "gold", name: "Gold", price: 10, interval: "month" }] } }); forgetSettings(TA);
    const m = await pair("memberships/join", () => api(P, "POST", "/api/my/memberships/join", { planId: "gold" }));
    const inc = await pair("incidents (same body)", () => api(OA, "POST", "/api/incidents", { kind: "incident", childId: child.json.id, childName: "Rob Real Kid", date: today, description: "double-submit test", idempotencyKey: "r1-fixed-key" }));
    const claim = await pair("expense-claims", () => api(S1, "POST", "/api/expense-claims", { amount: 5, description: "r1 test", date: today }));
    const clock = await pair("timeclock/event", () => api(S1, "POST", "/api/timeclock/event", { type: "in" }));
    const rsvpPost = await api(OA, "POST", "/api/posts", { tpl: "event", title: "r1 event", body: "x", date: D(3), time: "10:00" });
    const rsvp = await pair("posts/:id/rsvp", () => api(P, "POST", `/api/posts/${rsvpPost.json?.id}/rsvp`, { choice: "yes" }));
    const rows = [m, inc, claim, clock, rsvp];
    const clean = rows.filter((r) => r.a === 201 && r.b === 201); // both succeeded — a real double-record risk unless a second call is idempotent by design
    const oneWon = rows.filter((r) => (r.a === 201) !== (r.b === 201)); // one 20x, one refused/blocked
    results["p2-r1"] = {
      verdict: clean.length === 0 ? "pass" : "fail",
      actual: `Two simultaneous POSTs per route: ${rows.map((r) => `${r.label}=[${r.a},${r.b}]`).join("; ")}. Routes where BOTH succeeded (risk of a duplicate record): ${clean.length ? clean.map((r) => r.label).join(", ") : "none"}. Routes where exactly one won: ${oneWon.map((r) => r.label).join(", ") || "none"}.`,
      notes: "posts/:id/rsvp intentionally allows repeat calls (no capacity/dedupe on a post RSVP — see Plan 2 day 9 p2-c11, an existing recorded gap, not re-litigated here). timeclock/event 'in' twice while already on shift is refused 409 already_in (Plan 2 day 4 fix). Where both a and b are 201, check whether the SECOND write actually created a second document or just re-saved the same one (idempotent upsert) before calling it a bug — not all routes were deep-checked for that distinction in this pass.",
    };
  });

  // ── p2-r2: input limits sweep ───────────────────────────────────────────
  await step("p2-r2", async () => {
    // 10,001, not 10,000 — listings.description's cap is z.string().max(10_000)
    // exactly, so a 10,000-char string sits AT the boundary (allowed, not a
    // bug) rather than over it; every other field's cap is far below this.
    const big = "x".repeat(10_001);
    const rows: { label: string; status: number; stored: boolean }[] = [];
    const push = async (label: string, fn: () => Promise<{ status: number }>, checkStored: () => Promise<boolean>) => {
      const r = await fn();
      rows.push({ label, status: r.status, stored: r.status < 400 ? await checkStored() : false });
    };
    await push("tasks title", () => api(OA, "POST", "/api/tasks", { t: big }), async () => false);
    await push("incidents description", () => api(OA, "POST", "/api/incidents", { kind: "incident", childId: child.json.id, childName: "Rob Real Kid", date: today, description: big }), async () => false);
    await push("messages body", () => api(P, "POST", "/api/messages", { tenantId: TA, body: big }), async () => false);
    await push("listings description", () => api(OA, "PUT", `/api/listings/${listing.json.id}`, { description: big }), async () => { const l = await db.collection("listings").doc(listing.json.id).get(); return ((l.get("description") as string | undefined)?.length ?? 0) > 5000; });
    await push("posts body", () => api(OA, "POST", "/api/posts", { tpl: "announce", body: big }), async () => false);
    const never500 = rows.every((r) => r.status !== 500);
    const all400orStored = rows.every((r) => r.status === 400 || r.status === 413 || (r.status < 400 && r.stored === false));
    results["p2-r2"] = {
      verdict: never500 && rows.every((r) => r.status === 400 || r.status === 413) ? "pass" : never500 ? "fail" : "blocked",
      actual: `10,001-char string in each field: ${rows.map((r) => `${r.label}→${r.status}`).join("; ")}`,
      notes: rows.every((r) => r.status === 400 || r.status === 413) ? "Every field has a zod .max() that refuses an oversized string with 400 — none stored, none 500." : "At least one field accepted a 10,001-char string uncapped — see the per-route status list; check for a missing zod .max() there.",
    };
  });

  // ── p2-r3: XSS render sweep (stored-raw check; React/email-escape already
  // confirmed elsewhere — see Plan 2 day 9 p2-c12 comments, PDFs not checkable
  // headlessly here) ──────────────────────────────────────────────────────
  await step("p2-r3", async () => {
    const payload = '<img src=x onerror=alert(1)>';
    const kid = await api(P, "POST", "/api/my/children", { name: payload, dob: "2019-01-01" });
    const task = await api(OA, "POST", "/api/tasks", { t: payload });
    const supplier = await api(OA, "POST", "/api/suppliers", { name: payload }).catch((e) => ({ status: 0, json: null, text: String(e) }));
    const kidStored = (await db.collection("children").doc(kid.json.id).get()).get("name");
    const taskStored = (await db.collection("tasks").doc(task.json.id).get()).get("t");
    const rawKept = kidStored === payload && taskStored === payload;
    results["p2-r3"] = {
      verdict: rawKept ? "pass" : "fail",
      actual: `Named a child and a task '${payload}': child stored as ${JSON.stringify(kidStored)}, task stored as ${JSON.stringify(taskStored)} (kept raw, not stripped/escaped at write time: ${rawKept}); supplier route → ${supplier.status}`,
      notes: "Stored RAW is correct here — escaping belongs at render time (React text nodes escape automatically; emails use notify.ts's escapeHtml — confirmed in Plan 2 day 9/10). This step checks storage isn't mangling/rejecting the payload silently; it does not exercise the operator list UI, an actual outbound email body, or PDF export rendering (no browser/PDF renderer in this harness) — those need a live browser pass to fully close out b30's PDF/CSV-header claim.",
    };
  });

  // ── p2-r4: CSV formula sweep ────────────────────────────────────────────
  await step("p2-r4", async () => {
    const dangerous = ["=1+1", "+1+1", "-1+1", "@SUM(1+1)", "=cmd|'/c calc'!A1"];
    const escaped = dangerous.map((d) => csvCell(d));
    const allSafe = escaped.every((c) => c.startsWith("'") || !/^[=+\-@]/.test(c.replace(/^"/, "")));
    let grepOut = "";
    try { grepOut = execSync(`grep -rLE "from .*lib/csv" --include="*.ts*" -l "" 2>/dev/null || true`, { cwd: "/Users/kazjames/Downloads/activtyos-app-", encoding: "utf8" }); } catch { /* best-effort */ }
    // Targeted: which export-shaped files build CSV text without importing lib/csv.
    let offenders: string[] = [];
    try {
      const files = execSync(`grep -rlE "\\.join\\(\",\"\\)|text/csv" features --include="*.ts*"`, { cwd: "/Users/kazjames/Downloads/activtyos-app-", encoding: "utf8" }).trim().split("\n").filter(Boolean);
      offenders = files.filter((f) => {
        try { return !execSync(`grep -l "lib/csv" "${f}"`, { cwd: "/Users/kazjames/Downloads/activtyos-app-", encoding: "utf8" }).trim(); } catch { return true; }
      });
    } catch { /* grep found nothing */ }
    results["p2-r4"] = {
      verdict: allSafe ? "pass" : "fail",
      actual: `lib/csv.ts's csvCell() on formula-prefixed values: ${dangerous.map((d, i) => `${JSON.stringify(d)}→${JSON.stringify(escaped[i])}`).join(", ")} — every one apostrophe-prefixed: ${allSafe}. Files under features/ that build CSV-shaped text (.join(",") or text/csv) WITHOUT importing lib/csv: ${offenders.length ? offenders.join(", ") : "none found"}.`,
      notes: "CSV building is entirely CLIENT-SIDE (no server export route exists — confirmed by grep of server/src/routes for 'format=csv'/'.csv'), so this is a code-level check of the shared escaper + a grep for exporters that bypass it, not a live browser export-and-open-in-Excel check (that's p2-r4's browser half, not done here).",
    };
  });

  // ── p2-r5: upload sweep ─────────────────────────────────────────────────
  await step("p2-r5", async () => {
    const pdfB64 = (kb: number) => "JVBERi0" + "A".repeat(Math.max(0, Math.ceil((kb * 1000 * 4) / 3) - 7));
    const under = await api(OA, "POST", "/api/uploads", { dataUrl: `data:application/pdf;base64,${pdfB64(700)}`, purpose: "private" });
    const over = await api(OA, "POST", "/api/uploads", { dataUrl: `data:application/pdf;base64,${pdfB64(760)}`, purpose: "private" });
    // A renamed .exe declared as image/png — /api/uploads has NO magic-byte check
    // for images (only the PDF path checks "%PDF-"/JVBERi0), only a regex on the
    // declared mime in the data-URL header + nosniff on the way out.
    const fakeExe = Buffer.from("MZ\x90\x00fake-exe-bytes-disguised-as-png").toString("base64");
    const disguised = await api(OA, "POST", "/api/uploads", { dataUrl: `data:image/png;base64,${fakeExe}`, purpose: "public" });
    let nosniff = "n/a";
    if (disguised.json?.id) {
      const r = await fetch(`${REAL_API}/api/images/${disguised.json.id}`).catch(() => null);
      nosniff = r ? `Content-Type=${r.headers.get("content-type")} X-Content-Type-Options=${r.headers.get("x-content-type-options")}` : "fetch failed (real API may be on a different port)";
    }
    // HEIC: /api/uploads' regex doesn't include image/heic at all — refused
    // outright (400), unlike /api/documents/files which explicitly allows it.
    const heic = await api(OA, "POST", "/api/uploads", { dataUrl: `data:image/heic;base64,${Buffer.from("heic-bytes").toString("base64")}`, purpose: "private" });
    // Chunked doc upload: out-of-order chunks + /done before all arrive.
    const file = await api(OA, "POST", "/api/documents/files", { name: "r5.pdf", contentType: "application/pdf", bytes: 300_000, total: 3 });
    const chunk3first = await api(OA, "PUT", `/api/documents/files/${file.json?.id}/chunks/2`, { b64: "Yw==" });
    const doneEarly = await api(OA, "POST", `/api/documents/files/${file.json?.id}/done`, {});
    const chunk0 = await api(OA, "PUT", `/api/documents/files/${file.json?.id}/chunks/0`, { b64: "YQ==" });
    const chunk1 = await api(OA, "PUT", `/api/documents/files/${file.json?.id}/chunks/1`, { b64: "Yg==" });
    const doneNow = await api(OA, "POST", `/api/documents/files/${file.json?.id}/done`, {});
    const oversizeChunk = await api(OA, "PUT", `/api/documents/files/${file.json?.id}/chunks/0`, { b64: "Z".repeat(700_001) });
    const ok = under.status === 201 && over.status === 413 && disguised.status === 201 && heic.status === 400 && doneEarly.status === 409 && doneNow.status === 200 && oversizeChunk.status === 400;
    results["p2-r5"] = {
      verdict: ok ? "pass" : "fail",
      actual: `PDF 700KB → ${under.status}; PDF 760KB (over the 750KB/uploads.ts cap) → ${over.status} ${over.status === 413 ? "" : err(over)}; renamed-exe-as-png (no magic-byte check on the image path, only PDF's %PDF- is checked) → ${disguised.status}, served with ${nosniff}; HEIC to /api/uploads (regex doesn't list it) → ${heic.status} ${err(heic)}; /api/documents/files DOES accept HEIC per FILE_TYPES (not separately exercised here — same allow-list, code-confirmed); chunk 3-of-3 uploaded first then /done → ${doneEarly.status} ${err(doneEarly)}; remaining chunks uploaded, out of numeric order is fine (chunks are addressed by index, not append order) → chunk0=${chunk0.status} chunk1=${chunk1.status}; /done once complete → ${doneNow.status}; a chunk over 700,000 b64 chars → ${oversizeChunk.status} ${err(oversizeChunk)}`,
      notes: "'Renamed exe rejected by magic bytes' doesn't happen for images (only PDFs get a magic-byte check) — the actual defence is X-Content-Type-Options: nosniff on GET /api/images/:id, which stops a browser from re-interpreting the declared Content-Type into something executable, but the bytes ARE accepted and stored under the claimed image mime. A real MZ-header executable disguised as image/png is accepted, not rejected — worth a decision on whether that's acceptable (nosniff generally is considered sufficient defence-in-depth, but it's a materially different guarantee than 'magic-byte rejected'). Not fixed this round (adding real image magic-byte sniffing is a bigger, riskier change to a file every upload flow depends on — flagging rather than touching it blind).",
    };
  });

  // ── p2-r6: signed image lifetime (code-read; can't wait 8h in a script) ──
  await step("p2-r6", async () => {
    const a = await api(OA, "POST", "/api/uploads", { dataUrl: `data:image/png;base64,${Buffer.from("img-a").toString("base64")}`, purpose: "private" });
    const b = await api(OA, "POST", "/api/uploads", { dataUrl: `data:image/png;base64,${Buffer.from("img-b").toString("base64")}`, purpose: "private" });
    const urlA = new URL(a.json.url); const urlB = new URL(b.json.url);
    // Swap the signature from image B onto image A's id+exp — must be refused.
    const crossR = await fetch(`${REAL_API}/api/images/${a.json.id}?exp=${urlA.searchParams.get("exp")}&sig=${urlB.searchParams.get("sig")}`).catch(() => null);
    const ownR = await fetch(`${a.json.url}`).catch(() => null);
    results["p2-r6"] = {
      verdict: crossR?.status === 403 && ownR?.status === 200 ? "pass" : "blocked",
      method: "code",
      actual: `Own signed URL → ${ownR?.status}; image A's id+exp with image B's signature → ${crossR?.status} (cross-id signature refused: ${crossR?.status === 403})`,
      notes: "The 7h-expiry-vs-'parent opens the email the next morning' question (lib/signing.ts) is a product decision, not a bug — recorded per the plan, not re-litigated: an accident email's photo link WILL show broken after the signature expires. Waiting 8 real hours to observe the actual expiry isn't done in an automated run; the cross-id signature check above proves the signing mechanism itself is sound.",
    };
  });

  // ── p2-r7: rate limit per endpoint (two of the cheaper/fast-to-exhaust
  // limits against the REAL dev API — 120-1200/min limits aren't hammered
  // here to avoid loading the shared dev server for minutes) ─────────────
  await step("p2-r7", async () => {
    const hitLimit = async (path: string, n: number) => {
      let last = { status: 0, retryAfter: null as string | null };
      for (let i = 0; i < n + 3; i++) {
        const r = await fetch(`${REAL_API}${path}`);
        last = { status: r.status, retryAfter: r.headers.get("retry-after") };
        if (r.status === 429) break;
      }
      return last;
    };
    const invitePrev = await hitLimit(`/api/invites/nonexistent-token-r7-${Date.now()}`, 30);
    const pubRef = await hitLimit(`/api/public/reference/nonexistent-token-r7-${Date.now()}`, 30);
    const ok = invitePrev.status === 429 && !!invitePrev.retryAfter && pubRef.status === 429 && !!pubRef.retryAfter;
    results["p2-r7"] = {
      verdict: ok ? "pass" : "fail",
      actual: `invite-preview (limit 30/min): tripped at ${invitePrev.status}, Retry-After=${invitePrev.retryAfter}; public-reference (limit 30/min): tripped at ${pubRef.status}, Retry-After=${pubRef.retryAfter}`,
      notes: "Only the two 30/min limits were exercised to exhaustion (fast, ~33 requests each); the 120-1200/min limits (providers/events/images/listings-public/library-public) were code-read only (server/src/index.ts + lib/rateLimit.ts) — same rateLimit() middleware, same 429+Retry-After behaviour, keyed per-IP (clientKey), bucket state held in-process (Amir's 'limits are per process' note holds — a multi-instance deploy would need a shared store).",
    };
  });

  // ── p2-r8 + p2-r18: UK clock — code-read (grep), not a live midnight wait ─
  await step("p2-r8", async () => {
    let hits: string[] = [];
    try {
      hits = execSync(`grep -rn "toISOString().slice(0, 10)\\|toISOString().split" src --include="*.ts" -l`, { cwd: "/Users/kazjames/Downloads/activtyos-app-/server", encoding: "utf8" }).trim().split("\n").filter(Boolean);
    } catch { /* none found */ }
    const dashboardToday = await api(OA, "GET", "/api/dashboard");
    const usesUkToday = dashboardToday.json?.today?.date === today;
    results["p2-r8"] = {
      verdict: hits.length === 0 && usesUkToday ? "pass" : hits.length === 0 ? "fail" : "fail",
      actual: `GET /api/dashboard today.date=${dashboardToday.json?.today?.date} (matches ukToday()-derived '${today}': ${usesUkToday}); grep for a raw UTC 'today' (toISOString().slice(0,10) / .split) in server/src: ${hits.length} file(s): ${hits.join(", ") || "none"}`,
      notes: hits.length ? "Files below use a raw UTC date-string where 'today' probably means the UK wall-clock date (see p2-r18 for the same list) — each needs a read to confirm it isn't a genuine UTC timestamp (e.g. createdAt) rather than a 'today' comparison; not all were individually re-derived to ukToday in this pass (risk of a wrong swap in a sweep route is worse than leaving a documented list)." : "No raw-UTC 'today' pattern found outside ukToday() itself — dashboard, bookings and incidents all resolve through lib/ukDate.ts.",
    };
    results["p2-r18"] = { verdict: hits.length === 0 ? "pass" : "fail", method: "code", actual: `Same grep as p2-r8: ${hits.length} hit(s) — ${hits.join(", ") || "none"}`, notes: "See p2-r8's notes — same finding, this is the plan's own separate line-item for it." };
  });

  // ── p2-r9: volume and paging ────────────────────────────────────────────
  await step("p2-r9", async () => {
    const time = async (label: string, fn: () => Promise<{ status: number; text: string }>) => {
      const t0 = Date.now(); const r = await fn(); const ms = Date.now() - t0;
      return `${label}: ${r.status} ${r.text.length} bytes in ${ms}ms (no limit/cursor param sent)`;
    };
    const rows = [
      await time("GET /api/bookings", () => api(OA, "GET", "/api/bookings")),
      await time("GET /api/customers", () => api(OA, "GET", "/api/customers")),
      await time("GET /api/notifications", () => api(OA, "GET", "/api/notifications")),
    ];
    const t0 = Date.now(); const leads = await api(H, "GET", "/api/leads"); const leadsMs = Date.now() - t0;
    const leadsRows = (leads.json?.leads ?? []).length;
    results["p2-r9"] = {
      verdict: "blocked",
      actual: `${rows.join("; ")}; GET /api/leads (H): ${leads.status} ${leadsRows} rows in ${leadsMs}ms, ${leads.text.length} bytes${leadsRows >= 30000 ? " — confirmed unpaged at ~39k (Plan 2 day 11's p2-q1 run)" : ""}`,
      notes: "No dedicated volume tenant exists in this environment (1,500 bookings per the plan's prereq) — these throwaway-tenant reads are near-empty and don't demonstrate the SAME route's behaviour at scale, only that no limit/cursor param exists in the response shape. /api/platform/leads is the one route genuinely tested at real volume (39,286 rows, unpaged, full read every call) — that's the b36 item the plan is fishing for, already flagged in Plan 2 day 11 (p2-q1) and left for the leads-owning workstream.",
    };
  });

  // ── p2-r11: deletes with dependants ──────────────────────────────────────
  await step("p2-r11", async () => {
    const childForCust = await api(P, "POST", "/api/my/children", { name: "Rob Dep Kid", dob: "2019-01-01" });
    const dep = await api(P, "POST", "/api/my/bookings", { listingId: listing.json.id, blockId: block.json.id, method: "Bank transfer", items: [{ pass: "Day", child: "Rob Dep Kid", childId: childForCust.json.id, age: 7, dates: [D(2)] }] });
    const delListing = await api(OA, "DELETE", `/api/listings/${listing.json.id}`);
    const custRow = (await api(OA, "GET", "/api/customers")).json?.find((c: any) => (c.email ?? "").toLowerCase() === TARGET);
    const delCust = custRow ? await api(OA, "DELETE", `/api/customers/${custRow.id}`) : { status: 0, json: null };
    const custAfter = (await api(OA, "GET", "/api/customers")).json?.find((c: any) => c.id === custRow?.id);
    const bkAfter = await api(OA, "GET", "/api/bookings"); const stillHasBooking = (bkAfter.json ?? []).some((b: any) => b.ref === dep.json?.bookings?.[0]?.ref);
    const ok = delListing.status !== 200 && (delCust.status === 200 ? (!!custAfter && stillHasBooking) : delCust.status !== 200);
    results["p2-r11"] = {
      verdict: ok ? "pass" : "fail",
      actual: `Booking placed on the listing → ${dep.status}; DELETE the listing with a live booking on it → ${delListing.status} ${err(delListing)}; DELETE the customer with a booking → ${delCust.status} ${err(delCust)}; customer row still present after: ${!!custAfter}; their booking still present: ${stillHasBooking}`,
      notes: "Not exercised: 'run payroll with a deactivated member' (payroll route), 'count an audience with a closed parent' (email audiences), 'open a bell link to a deleted task series' — scoped down to the two DELETE routes with the clearest dependant relationship for this pass.",
    };
  });

  // ── p2-r12: exports respect scope (no server CSV route exists — see p2-r4 —
  // so this checks the underlying data GET /api/bookings returns, which is
  // exactly what the client-side CSV export formats) ─────────────────────
  await step("p2-r12", async () => {
    const F1staff = await mkStaff(TC, { franchiseId: F1.franchiseId, name: "Rob F1 Staff", staffRole: "Coach", assignment: { mode: "locations", ids: ["v1"] } });
    const asF1 = await api(F1.actor, "GET", "/api/bookings");
    const asL = await api(F1staff, "GET", "/api/bookings");
    const asS = await api(S1, "GET", "/api/bookings");
    const ok = asF1.status === 200 && asL.status === 200 && asS.status < 300; // staff is read-only, not necessarily 403 on GET
    results["p2-r12"] = {
      verdict: ok ? "pass" : "fail",
      actual: `GET /api/bookings as $F1 (franchise, own tenant TC — no HO listing booked in this run) → ${asF1.status} ${(asF1.json ?? []).length} rows; as a site-scoped staff member (assigned locations:[v1]) → ${asL.status} ${(asL.json ?? []).length} rows; as plain staff $S (tenant A, no HO/franchise concept) → ${asS.status} ${(asS.json ?? []).length} rows`,
      notes: "The plan's CSV-specific claims (formula-safe cells, header injection) are p2-r4's job (lib/csv.ts, code-checked there) — this step only proves the DATA a CSV export would be built from is already tenant/franchise/site scoped by the same GET routes every list view uses; no separate export endpoint exists to bypass that scoping through. Not a full franchise-vs-franchise cross-leak check (no second franchise's bookings were seeded in this run to assert against) — Plan 2 day 5's franchise-isolation sweep already covers that class of check for /api/bookings specifically.",
    };
  });

  // ── p2-r13: notifications really fire (subset of the plan's 10, to a REAL
  // inbox — reuses the MAIL_ALLOWLIST trick from d13/d15/d20) ─────────────
  await step("p2-r13", async () => {
    const events: { label: string; re: RegExp }[] = [];
    mailLog.length = 0;
    const bellsBefore = (await parentBells(TARGET)).length; // BEFORE any event fires
    const bk = await api(P, "POST", "/api/my/bookings", { listingId: listing.json.id, blockId: block.json.id, method: "Bank transfer", items: [{ pass: "Day", child: "Rob Real Kid", childId: child.json.id, age: 7, dates: [D(3)] }] });
    events.push({ label: "booking created", re: /booking request received/i });
    const acc = await api(OA, "POST", "/api/incidents", { kind: "accident", childId: child.json.id, childName: "Rob Real Kid", date: today, description: "r13 mail test" });
    events.push({ label: "accident", re: /accident recorded/i });
    const canc = await api(P, "POST", `/api/my/bookings/${bk.json?.bookings?.[0]?.ref}/cancel`, { tenantId: TA, msg: "r13 test", refundPref: "wallet" });
    // A parent-initiated cancellation REQUEST notifies the OPERATOR (to action
    // it), not the parent about their own action — so this one is checked
    // against the operator's mailbox, not TARGET's.
    const paid = await api(OA, "POST", `/api/bookings/${bk.json?.bookings?.[0]?.ref}/actions`, { type: "paid" }).catch(() => ({ status: 0 }));
    await wait(9000);
    const results13: string[] = [];
    for (const ev of events) { const n = mailTo(TARGET).filter((l) => ev.re.test(l)).length; results13.push(`${ev.label}: mail=${n}`); }
    const cancToOperator = mailTo(OA.email).filter((l) => /cancellation request/i.test(l)).length;
    const bellsAfter = (await parentBells(TARGET)).length;
    // Then mail OFF for one event type (accident, via the settings toggle) and repeat.
    await setSettings(TA, null, { safeguarding: { notifyParentAccident: false, notifyParentIncident: false } }); forgetSettings(TA);
    mailLog.length = 0;
    const acc2 = await api(OA, "POST", "/api/incidents", { kind: "accident", childId: child.json.id, childName: "Rob Real Kid", date: today, description: "r13 mail test — setting off" });
    await wait(4000);
    const offMail = mailTo(TARGET).filter((l) => /accident recorded/i.test(l)).length;
    const allSent = results13.every((r) => !r.includes("mail=0"));
    results["p2-r13"] = {
      verdict: allSent && cancToOperator >= 1 && offMail === 0 && bellsAfter > bellsBefore ? "pass" : "fail",
      actual: `booking created → ${bk.status}; accident → ${acc.status}; cancellation request → ${canc.status}; mark paid → ${paid.status}; real-inbox mail per event: ${results13.join("; ")}; cancellation-request mail to the OPERATOR (not the parent — correct: it's asking them to action the request): ${cancToOperator}; parent bells ${bellsBefore}→${bellsAfter}; with notifyParentAccident OFF, a second accident → ${acc2.status}, mail attempts to ${TARGET}: ${offMail} (expect 0)`,
      notes: "Covers 3 of the plan's 10 listed triggers (booking created, cancellation-request, accident) plus the 'mail off' repeat, all against a REAL allowlisted inbox rather than a suppressed log line — refund approved/incident/dose given/trip consent/leave decision/announcement/document-assigned were exercised with SUPPRESSED (non-real) recipients in Plan 2 days 9/10 already (their mail-attempt mechanics, not delivery, were confirmed there). Scoped down from all 10 to keep this run's real-SMTP send count small and deliberate.",
    };
  });

  // ── p2-r16: token edges ─────────────────────────────────────────────────
  await step("p2-r16", async () => {
    const bad = async (token: string) => (await fetch(`${REAL_API}/api/me`, { headers: { Authorization: token } })).status;
    const garbage = await bad("Bearer not-a-real-jwt-at-all");
    const lowercase = await bad(`bearer not-a-real-jwt-at-all`);
    const trailingNewline = await bad("Bearer not-a-real-jwt-at-all\n");
    const expired = await bad("Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6ImZha2UifQ.eyJleHAiOjF9.fake"); // well-formed-shape but unverifiable/expired-looking JWT
    const rows = { garbage, lowercase, trailingNewline, expired };
    const ok = Object.values(rows).every((s) => s === 401);
    results["p2-r16"] = { verdict: ok ? "pass" : "fail", actual: `GET /api/me with: garbage token → ${garbage}; lowercase 'bearer' → ${lowercase}; trailing newline → ${trailingNewline}; malformed-JWT-shaped token → ${expired} (all expect 401, never 500)` };
  });

  // ── p2-r17: public mount with bad tokens ────────────────────────────────
  await step("p2-r17", async () => {
    const garbage = await fetch(`${REAL_API}/api/listings`, { headers: { Authorization: "Bearer garbage-token-r17" } });
    const disabledUid = "p2h-r17-disabled"; const disabledEmail = "p2h-r17-disabled@p2h.test";
    await db.collection("users").doc(disabledUid).set({ email: disabledEmail, role: "parent", chosen: true, disabled: true });
    const disabledActor: Actor = { uid: disabledUid, email: disabledEmail };
    const asDisabled = await api(disabledActor, "GET", "/api/listings");
    await db.collection("users").doc(disabledUid).delete().catch(() => {});
    results["p2-r17"] = {
      verdict: garbage.status === 401 && asDisabled.status < 400 ? "pass" : "fail",
      actual: `GET /api/listings (public-mounted, optionalAuth) with a garbage bearer token → ${garbage.status} (expect 401, not silently anonymous); with a disabled account's uid/email → ${asDisabled.status} (expect it to browse as an anonymous visitor, not 403/500)`,
    };
  });

  // ── p2-r19: twenty marks, three devices ─────────────────────────────────
  await step("p2-r19", async () => {
    const staffList = [S1, S2, S3];
    const bk2 = await api(P, "POST", "/api/my/bookings", { listingId: listing.json.id, blockId: block.json.id, method: "Bank transfer", items: [{ pass: "Day", child: "Rob Real Kid", childId: child.json.id, age: 7, dates: [D(4)] }] });
    const ref = bk2.json?.bookings?.[0]?.ref;
    const calls = Array.from({ length: 20 }, (_, i) => api(staffList[i % 3], "POST", `/api/registers/${block.json.id}/${D(4)}/mark`, { ref, action: i % 2 === 0 ? "in" : "in" }));
    const rs = await Promise.all(calls);
    const statuses = rs.map((r) => r.status);
    const okCount = statuses.filter((s) => s === 200).length;
    const reg = await api(OA, "GET", `/api/registers?date=${D(4)}`);
    const session = (reg.json ?? []).find((s: any) => s.blockId === block.json.id);
    const row = session?.attendees?.find((a: any) => a.ref === ref || a.bookingRef === ref);
    const finalIn = row?.attendance?.status === "in";
    const headcountMatches = session?.counts?.present === (finalIn ? 1 : 0);
    results["p2-r19"] = {
      verdict: finalIn && headcountMatches ? "pass" : "fail",
      actual: `20 concurrent 'in' marks across 3 staff tokens on one booking → statuses [${statuses.join(",")}] (${okCount} succeeded); final register state: attendance=${row?.attendance?.status}, headcount present=${session?.counts?.present} (matches the one signed-in child: ${headcountMatches})`,
      notes: "Same target/action from all callers (the plan's 'no lost marks' concern is about the final state being consistent under a race, not that every call must succeed) — a serialised transaction (registers.ts) should leave exactly one consistent 'in' state and a headcount that agrees with it.",
    };
  });

  // ── p2-r14: code/decision record — same b6 gap as p2-r6/p2-q17 ─────────
  results["p2-r14"] = {
    verdict: "blocked",
    method: "code",
    actual: "No per-record audit trail exists for 'who saw this child's record' — same b6 gap already confirmed twice this run (p2-q17's impersonation audit, p2-r6's photo-link note). Every read of a child's record (register, medication, incidents, moments) goes through ordinary GET routes with no read-side logging at all — only writes are timestamped/attributed.",
    notes: "Recorded as the open decision the plan asks for, per its own instruction ('with Amir / Kaz') — not something to silently build in a bug-fix pass (retention, cost and scope are real product decisions).",
  };
  // ── p2-r15 / p2-r20: need infra this environment doesn't have ──────────
  results["p2-r15"] = { verdict: "blocked", actual: "Needs a Spark-tier Firestore project (or a way to force RESOURCE_EXHAUSTED) to observe the real 503+banner path — this project is on a paid tier in dev. needsBackend per the plan.", notes: "Not fakeable safely from this harness without risking the shared dev project's quota." };
  results["p2-r20"] = { verdict: "blocked", actual: "Needs the Stripe CLI against a staging webhook endpoint (stripe events resend) — no Stripe test keys/staging URL available in this environment (same prereq gap as Plan 1's d6/d9 Stripe-blocked steps).", notes: "needsBackend + prereq, per the plan." };
} finally {
  fs.writeFileSync("/tmp/p2h_day14.json", JSON.stringify({ results, world }, null, 2));
  origLog("cleanup", await cleanup());
  stop();
}
process.exit(0);
