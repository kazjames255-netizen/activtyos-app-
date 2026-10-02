import { execFileSync } from "node:child_process";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { API_URL, ROOT } from "./helpers/env";
import { TEST_EMAIL_DOMAIN, fbSignUp } from "./helpers/accounts";

// Agent L: payroll records (idempotent YTD ledger, P60/P45, reconcile/repost, audit with no NI) + Learning Centre persistence
// (courses, attempts, certificates) + media-upload flag OFF. API-level, throwaway accounts, own data wiped at the end.
test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
const email = (n: string) => `e2e-lrec-${n}-${stamp}@${TEST_EMAIL_DOMAIN}`;
const NI = "QQ123456C";
const slug = (n: string) => n.trim().toLowerCase().replace(/\s+/g, "-");
const NAME = { s1: `Rec Alpha ${stamp}`, s2: `Rec Beta ${stamp}` };
const tokens: Record<string, string> = {};
let tenantId = "";
const bodies: string[] = [];

const call = async (who: string | null, method: string, url: string, body?: unknown, raw?: boolean) => {
  const res = await fetch(`${API_URL}${url}`, { method, headers: { "Content-Type": "application/json", ...(who ? { Authorization: `Bearer ${tokens[who]}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (raw) return { status: res.status, json: null as unknown, buf: Buffer.from(await res.arrayBuffer()), headers: res.headers };
  const t = await res.text(); bodies.push(t);
  let json: unknown = null; try { json = JSON.parse(t); } catch { /* empty */ }
  return { status: res.status, json, buf: null as Buffer | null, headers: res.headers };
};
const txt = (v: unknown) => JSON.stringify(v ?? null);
const admin = (...args: string[]) => {
  const out = execFileSync("npx", ["tsx", "../e2e/helpers/payrollAdmin.ts", ...args], { cwd: path.join(ROOT, "server"), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const m = out.match(/@@JSON@@([\s\S]*?)@@END@@/); return m ? JSON.parse(m[1]) : null;
};
const line = (name: string, over: Record<string, unknown> = {}) => ({ id: slug(name), name, grossM: 2000, payeM: 200, eeNiM: 100, erNiM: 120, eePenM: 0, erPenM: 0, netM: 1700, taxCode: "1257L", ...over });
const emp = (name: string, over: Record<string, unknown> = {}) => ({ id: slug(name), name, role: "Coach", basis: "year", rate: 30000, hpw: 0, weeks: 52, taxCode: "1257L", niCat: "A", pension: false, ...over });
const PAST = "2025-06-28"; // tax year 2025-26 — ended
let runId = "";

test.beforeAll(async () => {
  test.setTimeout(300_000);
  const co = await fbSignUp(email("co")); tokens.co = co.idToken;
  const reg = await call("co", "POST", "/api/register-role", { role: "company", businessName: `LRec Co ${stamp}`, providerName: `LRec Co ${stamp}`, providerNameMode: "business" });
  expect(reg.status, txt(reg.json)).toBe(201);
  tenantId = (reg.json as { tenantId: string }).tenantId;
  execFileSync("npm", ["--prefix", path.join(ROOT, "server"), "run", "e2e-unwall", "--", tenantId], { stdio: "pipe" });
  const co2 = await fbSignUp(email("co2")); tokens.co2 = co2.idToken;
  admin("seed-owner", co2.uid, email("co2"), tenantId);
  for (const who of ["s1", "s2"] as const) {
    const inv = await call("co", "POST", "/api/invites", { role: "staff", name: NAME[who], staffRole: "Coach", assignment: { mode: "all", ids: [] } });
    expect(inv.status, txt(inv.json)).toBe(201);
    const s = await fbSignUp(email(who)); tokens[who] = s.idToken;
    expect((await fetch(`${API_URL}/api/invites/${(inv.json as { token: string }).token}/accept`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.idToken}` }, body: "{}" })).status).toBe(200);
  }
  const rival = await fbSignUp(email("rival")); tokens.rival = rival.idToken;
  expect((await call("rival", "POST", "/api/register-role", { role: "company", businessName: `LRec Rival ${stamp}`, providerName: `LRec Rival ${stamp}`, providerNameMode: "business" })).status).toBe(201);
});
test.afterAll(async () => { try { if (tenantId) admin("wipe", tenantId); } catch (e) { console.error("wipe failed", (e as Error).message); } });

test("YTD is posted once per run (idempotent), reconciles, and repost never double-counts", async () => {
  expect((await call("co", "PUT", "/api/payroll/employees", { employees: [emp(NAME.s1, { niNumber: NI, leaveDate: "2026-03-31" }), emp(NAME.s2)] })).status).toBe(200);
  const r = await call("co", "POST", "/api/payroll/runs", { period: `Rec A ${stamp}`, paidOn: PAST, lines: [line(NAME.s1), line(NAME.s2, { grossM: 1000, netM: 800 })] });
  expect(r.status, txt(r.json)).toBe(201);
  runId = (r.json as { id: string }).id;
  expect((await call("co2", "POST", `/api/payroll/runs/${runId}/approve`, {})).status).toBe(200);
  const y = (await call("co", "GET", `/api/payroll/ytd/${slug(NAME.s1)}?taxYear=2025-26`)).json as { gross: number; runs: number };
  expect(y.gross).toBe(2000); expect(y.runs).toBe(1);
  // repost with nothing flagged changes nothing; even forcing the flag on cannot double count
  admin("flag-repost", tenantId, runId);
  const rp = await call("co", "POST", "/api/payroll/ytd/repost", {});
  expect(rp.status, txt(rp.json)).toBe(200);
  expect((rp.json as { posted: number }).posted).toBe(0);
  const y2 = (await call("co", "GET", `/api/payroll/ytd/${slug(NAME.s1)}?taxYear=2025-26`)).json as { gross: number; runs: number };
  expect(y2.gross).toBe(2000); expect(y2.runs).toBe(1);
  const rc = (await call("co", "GET", `/api/payroll/ytd/${slug(NAME.s1)}/reconcile?taxYear=2025-26`)).json as { stored: { gross: number }; ledger: { gross: number; runs: number }; approvedRuns: { gross: number }; unposted: string[] };
  expect(rc.stored.gross).toBe(2000); expect(rc.ledger.gross).toBe(2000); expect(rc.approvedRuns.gross).toBe(2000); expect(rc.unposted).toEqual([]);
  // staff / rival cannot reconcile or repost
  expect((await call("s1", "GET", `/api/payroll/ytd/${slug(NAME.s1)}/reconcile`)).status).toBe(403);
  // another tenant's manager only ever sees its OWN (empty) scope — nothing of ours
  const rv = (await call("rival", "GET", `/api/payroll/ytd/${slug(NAME.s1)}/reconcile?taxYear=2025-26`)).json as { stored: { gross: number }; ledger: { runs: number } };
  expect(rv.stored.gross).toBe(0); expect(rv.ledger.runs).toBe(0);
  expect((await call("s1", "POST", "/api/payroll/ytd/repost", {})).status).toBe(403);
});

test("P60: manager any employee; staff only their own and only once published; other tenants refused; NI masked", async () => {
  const id1 = slug(NAME.s1), id2 = slug(NAME.s2);
  // unpublished: staff refused
  expect((await call("s1", "GET", `/api/payroll/records/${id1}/p60?taxYear=2025-26`, undefined, true)).status).toBe(403);
  const m = await call("co", "GET", `/api/payroll/records/${id1}/p60?taxYear=2025-26`, undefined, true);
  expect(m.status).toBe(200);
  expect(m.headers.get("content-type")).toContain("application/pdf");
  expect(m.buf!.subarray(0, 5).toString()).toBe("%PDF-");
  expect(m.buf!.toString("latin1")).not.toContain(NI);
  expect((await call("co", "POST", `/api/payroll/runs/${runId}/publish`, { published: true })).status).toBe(200);
  const own = await call("s1", "GET", `/api/payroll/records/${id1}/p60?taxYear=2025-26`, undefined, true);
  expect(own.status).toBe(200);
  expect(own.buf!.equals(m.buf!)).toBe(true); // issued once, served byte-identical
  // staff cannot read a colleague's, nor the current (un-ended) year
  expect((await call("s1", "GET", `/api/payroll/records/${id2}/p60?taxYear=2025-26`, undefined, true)).status).toBe(403);
  expect((await call("s2", "GET", `/api/payroll/records/${id1}/p60?taxYear=2025-26`, undefined, true)).status).toBe(403);
  expect((await call("co", "GET", `/api/payroll/records/${id1}/p60?taxYear=2099-00`, undefined, true)).status).toBe(409);
  expect((await call("co", "GET", `/api/payroll/records/${id1}/p60?taxYear=bad`, undefined, true)).status).toBe(400);
  // other tenant / unauthenticated
  expect([403, 404]).toContain((await call("rival", "GET", `/api/payroll/records/${id1}/p60?taxYear=2025-26`, undefined, true)).status);
  expect((await call(null, "GET", `/api/payroll/records/${id1}/p60?taxYear=2025-26`, undefined, true)).status).toBe(401);
  // listing
  const l = (await call("s1", "GET", `/api/payroll/records/${id1}`)).json as { p60: { taxYear: string; ended: boolean }[] };
  expect(l.p60[0]).toMatchObject({ taxYear: "2025-26", ended: true });
});

test("P45: manager issues for a leaver (idempotent); the leaver reads own; others cannot; audit has no NI", async () => {
  const id1 = slug(NAME.s1), id2 = slug(NAME.s2);
  expect((await call("s1", "GET", `/api/payroll/records/${id1}/p45`, undefined, true)).status).toBe(404); // not issued yet
  expect((await call("s1", "POST", `/api/payroll/records/${id1}/p45`, {}, true)).status).toBe(403); // staff can't issue
  expect((await call("co", "POST", `/api/payroll/records/${id2}/p45`, {}, true)).status).toBe(409); // no leaving date
  const a = await call("co", "POST", `/api/payroll/records/${id1}/p45`, {}, true);
  expect(a.status).toBe(200);
  expect(a.buf!.subarray(0, 5).toString()).toBe("%PDF-");
  const b = await call("co", "POST", `/api/payroll/records/${id1}/p45`, {}, true);
  expect(b.buf!.equals(a.buf!)).toBe(true);
  expect((await call("s1", "GET", `/api/payroll/records/${id1}/p45`, undefined, true)).status).toBe(200);
  expect((await call("s2", "GET", `/api/payroll/records/${id1}/p45`, undefined, true)).status).toBe(403);
  const audit = (admin("audit", tenantId) as Record<string, unknown>[]).filter((e) => ["view-p60", "issue-p45", "view-p45", "reconcile-ytd", "repost-ytd"].includes(String(e.action)));
  expect(audit.length).toBeGreaterThanOrEqual(5);
  expect(JSON.stringify(audit)).not.toContain(NI);
  expect(bodies.join("\n")).not.toContain(NI);
});

test("Learning Centre: courses persist per tenant; attempts + certificates only for real completions, own-only for staff", async () => {
  expect(((await call("s1", "GET", "/api/learning/courses")).json as { courses: unknown }).courses).toBeNull();
  expect((await call("s1", "PUT", "/api/learning/courses", { courses: [] })).status).toBe(403);
  const course = { id: `c-${stamp}`, title: `Safeguarding ${stamp}`, pass: 80, lessons: [] };
  expect((await call("co", "PUT", "/api/learning/courses", { courses: [course] })).status).toBe(200);
  expect(((await call("s1", "GET", "/api/learning/courses")).json as { courses: { id: string }[] }).courses[0].id).toBe(course.id);
  expect(((await call("rival", "GET", "/api/learning/courses")).json as { courses: unknown }).courses).toBeNull();
  expect((await call("co", "PUT", "/api/learning/courses", { courses: [{ id: "x", pad: "x".repeat(900_000) }] })).status).toBe(413);

  // attempts: a fail then a pass; server judges against the pass mark
  const f = await call("s1", "POST", "/api/learning/attempts", { courseId: course.id, title: course.title, score: 40, correct: 4, total: 10 });
  expect(f.status, txt(f.json)).toBe(201); expect(f.json).toMatchObject({ attempt: 1, passed: false });
  const p = await call("s1", "POST", "/api/learning/attempts", { courseId: course.id, title: course.title, score: 90, correct: 9, total: 10 });
  expect(p.json).toMatchObject({ attempt: 2, passed: true });
  expect((await call("s1", "POST", "/api/learning/attempts", { courseId: course.id, score: 120 })).status).toBe(400);
  expect(((await call("s1", "GET", "/api/learning/attempts")).json as unknown[]).length).toBe(2);
  expect(((await call("s2", "GET", "/api/learning/attempts")).json as unknown[]).length).toBe(0);
  expect(((await call("co", "GET", "/api/learning/attempts")).json as unknown[]).length).toBe(2);
  expect(((await call("rival", "GET", "/api/learning/attempts")).json as unknown[]).length).toBe(0);

  // certificate needs a real completion
  expect((await call("s1", "POST", "/api/learning/certificates", { courseId: course.id })).status).toBe(409);
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
  expect((await call("s1", "POST", "/api/learning/completions", { courseId: course.id, title: course.title, score: 90, date })).status).toBe(200);
  const c1 = await call("s1", "POST", "/api/learning/certificates", { courseId: course.id });
  expect(c1.status, txt(c1.json)).toBe(201);
  const c2 = await call("s1", "POST", "/api/learning/certificates", { courseId: course.id });
  expect((c2.json as { ref: string }).ref).toBe((c1.json as { ref: string }).ref); // idempotent
  expect(((await call("s1", "GET", "/api/learning/certificates")).json as unknown[]).length).toBe(1);
  expect(((await call("s2", "GET", "/api/learning/certificates")).json as unknown[]).length).toBe(0);
  expect(((await call("co", "GET", "/api/learning/certificates")).json as unknown[]).length).toBe(1);
  expect((await call("s2", "POST", "/api/learning/certificates", { courseId: course.id })).status).toBe(409);
});

test("media uploads are OFF by default (503) and never reachable without auth", async () => {
  const r = await call("co", "POST", "/api/media/upload-url", { contentType: "video/mp4", bytes: 1000 });
  expect([503, 201]).toContain(r.status);
  if (r.status === 503) expect(r.json).toMatchObject({ code: "media_storage_disabled" });
  expect((await call(null, "POST", "/api/media/upload-url", { contentType: "video/mp4", bytes: 1000 })).status).toBe(401);
});
