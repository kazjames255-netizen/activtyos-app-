import { execFileSync } from "node:child_process";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { API_URL, ROOT, loadAccounts } from "./helpers/env";
import { TEST_EMAIL_DOMAIN, fbSignIn, fbSignUp } from "./helpers/accounts";

// PAYROLL SECURITY / PRIVACY / AUDIT — API-level, real tokens for every role.
// Provisions its own throwaway company (+ a seeded 2nd owner for approval), a franchise with a staff member, two HO staff, a rival company,
// a freelancer and a parent, then tries to read/write/IDOR every payroll, payslip and accounting-post endpoint. Every assertion is anchored to
// THIS run's stamp. Cleans up its own payroll data at the end (e2e:cleanup removes the accounts).

test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
const email = (n: string) => `e2e-paysec-${n}-${stamp}@${TEST_EMAIL_DOMAIN}`;
const NI = "QQ123456C";
const slug = (n: string) => n.trim().toLowerCase().replace(/\s+/g, "-");
const NAME = { s1: `Pay Alpha ${stamp}`, s2: `Pay Beta ${stamp}`, fs: `Pay Fran ${stamp}` };
const tokens: Record<string, string> = {};
const uids: Record<string, string> = {};
let tenantId = "";
let franchiseKey = "";
const bodies: string[] = []; // every non-reveal response body, scanned at the end for leaked NI

const call = async (who: string | null, method: string, url: string, body?: unknown, raw?: boolean) => {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(`${API_URL}${url}`, {
        method,
        headers: { "Content-Type": "application/json", ...(who ? { Authorization: `Bearer ${tokens[who]}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (raw) return { status: res.status, json: null as unknown, buf: Buffer.from(await res.arrayBuffer()), headers: res.headers };
      const t = await res.text();
      let json: unknown = null;
      try { json = JSON.parse(t); } catch { /* empty */ }
      if (!/\/ni$|\/api\/onboarding$/.test(url)) bodies.push(t);
      return { status: res.status, json, buf: null as Buffer | null, headers: res.headers };
    } catch (e) {
      if (attempt >= 12) throw e;
      await new Promise((r) => setTimeout(r, 4_000));
    }
  }
};
const txt = (v: unknown) => JSON.stringify(v ?? null);
const admin = (...args: string[]) => {
  const out = execFileSync("npx", ["tsx", "../e2e/helpers/payrollAdmin.ts", ...args], { cwd: path.join(ROOT, "server"), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const m = out.match(/@@JSON@@([\s\S]*?)@@END@@/);
  return m ? JSON.parse(m[1]) : null;
};
const auditFor = async (payKey: string, action: string, pred: (e: Record<string, unknown>) => boolean = () => true) => {
  for (let i = 0; i < 8; i++) {
    const rows = (admin("audit", payKey) as Record<string, unknown>[]).filter((e) => e.action === action && pred(e));
    if (rows.length) return rows;
    await new Promise((r) => setTimeout(r, 1_500));
  }
  return [];
};

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
const line = (name: string, over: Record<string, unknown> = {}) => ({ id: slug(name), name, grossM: 2000, payeM: 200, eeNiM: 100, erNiM: 120, eePenM: 0, erPenM: 0, netM: 1700, ...over });
const emp = (name: string, over: Record<string, unknown> = {}) => ({ id: slug(name), name, role: "Coach", basis: "year", rate: 30000, hpw: 0, weeks: 52, taxCode: "1257L", niCat: "A", pension: false, ...over });

let runApproved = ""; // approved + published, lines for s1 and s2
let runDraft = ""; // still a draft

test.beforeAll(async () => {
  test.setTimeout(300_000);
  const co = await fbSignUp(email("co"));
  tokens.co = co.idToken; uids.co = co.uid;
  const reg = await call("co", "POST", "/api/register-role", { role: "company", businessName: `PaySec Co ${stamp}`, providerName: `PaySec Co ${stamp}`, providerNameMode: "business" });
  expect(reg.status, txt(reg.json)).toBe(201);
  tenantId = (reg.json as { tenantId: string }).tenantId;
  execFileSync("npm", ["--prefix", path.join(ROOT, "server"), "run", "e2e-unwall", "--", tenantId], { stdio: "pipe" });

  const co2 = await fbSignUp(email("co2"));
  tokens.co2 = co2.idToken; uids.co2 = co2.uid;
  admin("seed-owner", co2.uid, email("co2"), tenantId);

  const join = async (who: string, inviter: string, body: Record<string, unknown>) => {
    const inv = await call(inviter, "POST", "/api/invites", body);
    expect(inv.status, txt(inv.json)).toBe(201);
    const s = await fbSignUp(email(who));
    tokens[who] = s.idToken; uids[who] = s.uid;
    const real = await fetch(`${API_URL}/api/invites/${(inv.json as { token: string }).token}/accept`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.idToken}` }, body: "{}" });
    expect(real.status).toBe(200);
  };
  await join("s1", "co", { role: "staff", name: NAME.s1, staffRole: "Coach", assignment: { mode: "all", ids: [] } });
  await join("s2", "co", { role: "staff", name: NAME.s2, staffRole: "Coach", assignment: { mode: "all", ids: [] } });
  await join("fr", "co", { role: "franchise", franchiseName: `PaySec Fr ${stamp}` });
  await join("fs", "fr", { role: "staff", name: NAME.fs, staffRole: "Coach", assignment: { mode: "all", ids: [] } });

  const rival = await fbSignUp(email("rival"));
  tokens.rival = rival.idToken;
  expect((await call("rival", "POST", "/api/register-role", { role: "company", businessName: `PaySec Rival ${stamp}`, providerName: `PaySec Rival ${stamp}`, providerNameMode: "business" })).status).toBe(201);
  const fl = await fbSignUp(email("fl"));
  tokens.fl = fl.idToken;
  expect((await call("fl", "POST", "/api/register-role", { role: "freelancer", businessName: `PaySec Fl ${stamp}`, providerName: `PaySec Fl ${stamp}`, providerNameMode: "business" })).status).toBe(201);
  const pa = await fbSignUp(email("parent"));
  tokens.parent = pa.idToken;
  expect([200, 201]).toContain((await call("parent", "POST", "/api/register-role", { role: "parent" })).status);
  try {
    const plat = loadAccounts().accounts.platform;
    if (plat) tokens.platform = (await fbSignIn(plat.email)).idToken;
  } catch { /* no standing platform account on this machine */ }
});

test.afterAll(async () => {
  try { if (tenantId) admin("wipe", tenantId); } catch (e) { console.error("payroll wipe failed", (e as Error).message); }
});

test("unauthenticated: every payroll / payslip / accounting endpoint refuses", async () => {
  const eps: [string, string][] = [
    ["GET", "/api/payroll"], ["PUT", "/api/payroll/employees"], ["GET", "/api/payroll/employees/x/ni"], ["PUT", "/api/payroll/settings"], ["PUT", "/api/payroll/adjust"],
    ["POST", "/api/payroll/runs"], ["POST", "/api/payroll/runs/x/approve"], ["POST", "/api/payroll/runs/x/publish"], ["GET", "/api/payroll/ytd/x"], ["GET", "/api/payroll/timesheets?from=2026-01-01&to=2026-01-02"],
    ["GET", "/api/payroll/mine"], ["GET", "/api/payroll/runs/x/payslip/y/pdf"], ["POST", "/api/payroll/runs/x/payslip/email"],
    ["GET", "/api/accounting/connections"], ["GET", "/api/accounting/mapping?provider=xero"], ["PUT", "/api/accounting/mapping"], ["POST", "/api/accounting/post/x?provider=xero"], ["GET", "/api/accounting/xero/connect"],
  ];
  for (const [m, u] of eps) expect((await call(null, m, u, m === "GET" ? undefined : {})).status, `${m} ${u}`).toBe(401);
});

test("non-managers (staff, franchise staff, parent, platform) are refused on every manager endpoint", async () => {
  const eps: [string, string, unknown?][] = [
    ["GET", "/api/payroll"], ["PUT", "/api/payroll/employees", { employees: [] }], ["GET", "/api/payroll/employees/x/ni"], ["PUT", "/api/payroll/settings", { sickPay: "full" }],
    ["POST", "/api/payroll/runs", { period: "p", paidOn: today, lines: [line("X")] }], ["POST", "/api/payroll/runs/x/approve", {}], ["POST", "/api/payroll/runs/x/publish", { published: true }],
    ["GET", "/api/payroll/ytd/x"], [`GET`, `/api/payroll/timesheets?from=${today}&to=${today}`],
    ["POST", "/api/payroll/runs/x/payslip/email", {}],
    ["GET", "/api/accounting/connections"], ["GET", "/api/accounting/mapping?provider=xero"], ["PUT", "/api/accounting/mapping", { provider: "xero", mapping: {} }],
    ["POST", "/api/accounting/post/x?provider=xero", {}], ["GET", "/api/accounting/xero/connect"], ["POST", "/api/accounting/xero/disconnect", {}],
  ];
  for (const who of ["s1", "fs", "parent", ...(tokens.platform ? ["platform"] : [])]) {
    for (const [m, u, b] of eps) {
      const r = await call(who, m, u, m === "GET" ? undefined : b);
      expect([401, 403], `${who} ${m} ${u} → ${r.status} ${txt(r.json)}`).toContain(r.status);
    }
  }
});

test("employee pay details: NI encrypted at rest, masked in every read, money fields validated", async () => {
  const put = await call("co", "PUT", "/api/payroll/employees", { employees: [emp(NAME.s1, { niNumber: NI }), emp(NAME.s2)] });
  expect(put.status, txt(put.json)).toBe(200);
  const list = await call("co", "GET", "/api/payroll");
  expect(list.status).toBe(200);
  const e1 = ((list.json as { employees: Record<string, unknown>[] }).employees).find((e) => e.id === slug(NAME.s1))!;
  expect(e1.hasNiNumber).toBe(true);
  expect(txt(list.json)).not.toContain(NI);
  expect(txt(list.json)).not.toContain("niNumberEnc");
  const raw = admin("rawconfig", tenantId);
  expect(JSON.stringify(raw)).not.toContain(NI); // encrypted at rest
  expect(JSON.stringify(raw)).toContain("niNumberEnc");
  // reveal is explicit, and works for the payroll admin
  const rev = await call("co", "GET", `/api/payroll/employees/${slug(NAME.s1)}/ni`);
  expect((rev.json as { niNumber: string }).niNumber).toBe(NI);
  // invalid NI must not be echoed back in the error
  const bad = await call("co", "PUT", "/api/payroll/employees", { employees: [emp(NAME.s1, { niNumber: "ZZ999999Z" })] });
  expect(bad.status).toBe(400);
  expect(txt(bad.json)).not.toContain("ZZ999999Z");
  // an edit that doesn't resend NI keeps it
  await call("co", "PUT", "/api/payroll/employees", { employees: [emp(NAME.s1, { rate: 31000 }), emp(NAME.s2)] });
  expect(((await call("co", "GET", `/api/payroll/employees/${slug(NAME.s1)}/ni`)).json as { niNumber: string }).niNumber).toBe(NI);

  // money-field validation: negative, huge, string, null, NaN-ish, wrong type
  for (const [k, v] of [["rate", -1], ["rate", 1e12], ["rate", "30000"], ["rate", null], ["hpw", 500], ["weeks", 0], ["hpw", "x"]] as const) {
    const r = await call("co", "PUT", "/api/payroll/employees", { employees: [emp(NAME.s2, { [k]: v })] });
    expect(r.status, `${k}=${String(v)}`).toBe(400);
  }
  const adjBad = [
    { hours: -1 }, { hours: 1e9 }, { hours: "8" }, { additions: [{ id: "a", label: "x", amount: 1e12 }] }, { deductions: [{ id: "a", label: "x", amount: "5" }] },
    { override: { paye: -5 } }, { override: { eeNi: 1e12 } },
  ];
  for (const a of adjBad) expect((await call("co", "PUT", "/api/payroll/adjust", { period: `p-${stamp}`, adjust: { [slug(NAME.s1)]: a } })).status, txt(a)).toBe(400);
  const runBad: Record<string, unknown>[] = [
    line(NAME.s1, { grossM: -5 }), line(NAME.s1, { grossM: 1e12 }), line(NAME.s1, { grossM: "2000" }), line(NAME.s1, { netM: null }), line(NAME.s1, { payeM: 1e15 }), line(NAME.s1, { eeNiM: -1 }),
  ];
  for (const l of runBad) expect((await call("co", "POST", "/api/payroll/runs", { period: `bad-${stamp}`, paidOn: today, lines: [l] })).status, txt(l)).toBe(400);
  expect((await call("co", "POST", "/api/payroll/runs", { period: `bad-${stamp}`, paidOn: "2026-02-30", lines: [line(NAME.s1)] })).status).toBe(400);
  // legit adjustment + settings accepted
  expect((await call("co", "PUT", "/api/payroll/adjust", { period: `p-${stamp}`, adjust: { [slug(NAME.s1)]: { hours: 10, additions: [{ id: "b", label: "Bonus", amount: 50 }] } } })).status).toBe(200);
  expect((await call("co", "PUT", "/api/payroll/settings", { sickPay: "ssp" })).status).toBe(200);
  expect((await call("co", "PUT", "/api/payroll/settings", { sickPay: "bogus" })).status).toBe(400);
});

test("approval segregation: no spoofing, no double-approve, no concurrent double-approve, no edit/delete after approval", async () => {
  const spoof = await call("co", "POST", "/api/payroll/runs", { period: `Run A ${stamp}`, paidOn: today, freq: "monthly", lines: [line(NAME.s1), line(NAME.s2)], createdBy: email("co2"), status: "approved", approvedBy: email("co2"), publishedAt: "2026-01-01" });
  expect(spoof.status, txt(spoof.json)).toBe(201);
  const r = spoof.json as { id: string; status: string; createdBy: string; approvedBy: string | null; publishedAt: string | null };
  expect(r.status).toBe("draft");
  expect(r.createdBy).toBe(email("co"));
  expect(r.approvedBy).toBeNull();
  expect(r.publishedAt).toBeNull();
  runDraft = r.id;
  // creator cannot approve their own run (even with a case-changed email — same account)
  const self = await call("co", "POST", `/api/payroll/runs/${runDraft}/approve`, {});
  expect(self.status, txt(self.json)).toBe(403);
  // a draft can't be published, emailed or posted
  expect((await call("co", "POST", `/api/payroll/runs/${runDraft}/publish`, { published: true })).status).toBe(400);
  expect((await call("co", "POST", `/api/payroll/runs/${runDraft}/payslip/email`, {})).status).toBe(409);
  expect((await call("co", "POST", `/api/accounting/post/${runDraft}?provider=xero`, {})).status).toBe(409);
  // other roles / tenants can't approve it
  for (const who of ["rival", "fl", "fr"]) expect((await call(who, "POST", `/api/payroll/runs/${runDraft}/approve`, {})).status, who).toBe(404);
  expect((await call("s1", "POST", `/api/payroll/runs/${runDraft}/approve`, {})).status).toBe(403);

  // run B: two simultaneous approvals by the other owner → exactly one wins, and YTD is added once
  const b = await call("co", "POST", "/api/payroll/runs", { period: `Run B ${stamp}`, paidOn: today, lines: [line(NAME.s2, { grossM: 1000, netM: 800 })] });
  const idB = (b.json as { id: string }).id;
  const both = await Promise.all([call("co2", "POST", `/api/payroll/runs/${idB}/approve`, {}), call("co2", "POST", `/api/payroll/runs/${idB}/approve`, {})]);
  expect(both.map((x) => x.status).sort(), txt(both.map((x) => x.json))).toEqual([200, 400]);
  const ytd = await call("co", "GET", `/api/payroll/ytd/${slug(NAME.s2)}`);
  expect((ytd.json as { runs: number }).runs).toBe(1);
  expect((ytd.json as { gross: number }).gross).toBe(1000);

  // approve run A properly
  const ok = await call("co2", "POST", `/api/payroll/runs/${runDraft}/approve`, {});
  expect(ok.status, txt(ok.json)).toBe(200);
  expect((ok.json as { approvedBy: string }).approvedBy).toBe(email("co2"));
  expect((await call("co2", "POST", `/api/payroll/runs/${runDraft}/approve`, {})).status).toBe(400);
  expect((await call("co", "POST", `/api/payroll/runs/${runDraft}/approve`, {})).status).toBe(400);
  runApproved = runDraft; runDraft = "";
  // no route exists to edit or delete a run, approved or not
  for (const m of ["PUT", "PATCH", "DELETE"]) {
    const r2 = await call("co2", m, `/api/payroll/runs/${runApproved}`, { lines: [line(NAME.s1, { grossM: 99999 })] });
    expect([404, 405], `${m} run`).toContain(r2.status);
  }
  // re-POSTing can't overwrite it (server-minted ids) — the stored figures are unchanged
  await call("co2", "POST", "/api/payroll/runs", { id: runApproved, period: "hijack", paidOn: today, lines: [line(NAME.s1, { grossM: 99999 })] });
  const back = ((await call("co", "GET", "/api/payroll")).json as { runs: { id: string; status: string; lines: { grossM: number }[]; period: string }[] }).runs.find((x) => x.id === runApproved)!;
  expect(back.status).toBe("approved");
  expect(back.period).toBe(`Run A ${stamp}`);
  expect(back.lines[0].grossM).toBe(2000);
  // a fresh draft, kept unpublished for the visibility tests
  runDraft = ((await call("co", "POST", "/api/payroll/runs", { period: `Run C ${stamp}`, paidOn: today, lines: [line(NAME.s1, { grossM: 555, netM: 444 })] })).json as { id: string }).id;
});

test("payslips: staff see ONLY their own line, only once published; downloads need auth and the right tenant", async () => {
  // unpublished → staff get nothing / 403
  expect(txt((await call("s1", "GET", "/api/payroll/mine")).json)).toBe("[]");
  expect((await call("s1", "GET", `/api/payroll/runs/${runApproved}/payslip/${slug(NAME.s1)}/pdf`, undefined, true)).status).toBe(403);
  expect((await call("co", "POST", `/api/payroll/runs/${runApproved}/publish`, { published: true })).status).toBe(200);

  const m1 = (await call("s1", "GET", "/api/payroll/mine")).json as { id: string; lines: { name: string }[] }[];
  const mine = m1.find((r) => r.id === runApproved)!;
  expect(mine.lines.map((l) => l.name)).toEqual([NAME.s1]); // never s2's line
  expect(txt(m1)).not.toContain(NAME.s2);
  expect(txt((await call("s2", "GET", "/api/payroll/mine")).json)).not.toContain(NAME.s1);
  // the draft run (Run C) is never visible to staff
  expect(txt(m1)).not.toContain(`Run C ${stamp}`);
  expect((await call("s1", "GET", `/api/payroll/runs/${runDraft}/payslip/${slug(NAME.s1)}/pdf`, undefined, true)).status).toBe(403);

  const own = await call("s1", "GET", `/api/payroll/runs/${runApproved}/payslip/${slug(NAME.s1)}/pdf`, undefined, true);
  expect(own.status).toBe(200);
  expect(own.headers.get("content-type")).toContain("application/pdf");
  expect(own.headers.get("cache-control")).toContain("no-store");
  expect(own.buf!.subarray(0, 4).toString()).toBe("%PDF");
  // IDOR: s1 asks for s2's payslip, by every route spelling
  for (const emp2 of [slug(NAME.s2), NAME.s2, encodeURIComponent(NAME.s2), `${slug(NAME.s1)}/../${slug(NAME.s2)}`]) {
    const r = await call("s1", "GET", `/api/payroll/runs/${runApproved}/payslip/${emp2}/pdf`, undefined, true);
    expect([403, 404], `s1 → ${emp2}`).toContain(r.status);
  }
  // no auth / wrong tenant / wrong scope / wrong role
  expect((await call(null, "GET", `/api/payroll/runs/${runApproved}/payslip/${slug(NAME.s1)}/pdf`, undefined, true)).status).toBe(401);
  for (const who of ["rival", "fl", "fr", "fs", "parent", ...(tokens.platform ? ["platform"] : [])]) {
    const r = await call(who, "GET", `/api/payroll/runs/${runApproved}/payslip/${slug(NAME.s1)}/pdf`, undefined, true);
    expect([403, 404], who).toContain(r.status);
  }
  // franchise sees none of head office's payroll; its own list is empty of our people
  const frList = await call("fr", "GET", "/api/payroll");
  expect(txt(frList.json)).not.toContain(NAME.s1);
  expect(txt(frList.json)).not.toContain(`Run A ${stamp}`);
  const fsMine = await call("fs", "GET", "/api/payroll/mine");
  expect(txt(fsMine.json)).not.toContain(NAME.s1);
  // manager (payroll admin) can fetch anyone's
  expect((await call("co", "GET", `/api/payroll/runs/${runApproved}/payslip/${slug(NAME.s2)}/pdf`, undefined, true)).status).toBe(200);
});

test("payslip email: only approved runs, only by a manager, only to the staff member's own account (never a same-named parent / duplicate name)", async () => {
  expect((await call("s1", "POST", `/api/payroll/runs/${runApproved}/payslip/email`, {})).status).toBe(403);
  expect((await call("rival", "POST", `/api/payroll/runs/${runApproved}/payslip/email`, {})).status).toBe(404);
  expect((await call("co", "POST", `/api/payroll/runs/${runDraft}/payslip/email`, {})).status).toBe(409);
  // free-text recipient is not an accepted input
  const smuggle = await call("co", "POST", `/api/payroll/runs/${runApproved}/payslip/email`, { employeeId: slug(NAME.s1), to: "attacker@example.com", recipients: ["attacker@example.com"] });
  expect(smuggle.status, txt(smuggle.json)).toBe(200);
  expect(txt(smuggle.json)).not.toContain("attacker@example.com");
  expect((smuggle.json as { sent: number }).sent).toBe(1);
  // a PARENT account carrying s2's exact name must not become the payslip recipient
  const imposter = await fbSignUp(email("imposter"));
  tokens.imposter = imposter.idToken;
  expect([200, 201]).toContain((await call("imposter", "POST", "/api/register-role", { role: "parent" })).status);
  await call("imposter", "PUT", "/api/account", { name: NAME.s2 });
  const s2ok = await call("co", "POST", `/api/payroll/runs/${runApproved}/payslip/email`, { employeeId: slug(NAME.s2) });
  expect((s2ok.json as { results: { status: string }[] }).results[0].status).toBe("sent"); // s2 is the only staff account of that name
  // two staff accounts with the SAME name → ambiguous → nothing is sent (and neither can read the other's payslip)
  const inv = await call("co", "POST", "/api/invites", { role: "staff", name: NAME.s2, staffRole: "Coach", assignment: { mode: "all", ids: [] } });
  const dup = await fbSignUp(email("dup"));
  tokens.dup = dup.idToken;
  const acc = await fetch(`${API_URL}/api/invites/${(inv.json as { token: string }).token}/accept`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${dup.idToken}` }, body: "{}" });
  expect(acc.status).toBe(200);
  const amb = await call("co", "POST", `/api/payroll/runs/${runApproved}/payslip/email`, { employeeId: slug(NAME.s2) });
  expect((amb.json as { results: { status: string }[] }).results[0].status).toBe("no account email on file");
  expect((amb.json as { sent: number }).sent).toBe(0);
  expect(txt((await call("dup", "GET", "/api/payroll/mine")).json)).toBe("[]");
  expect(txt((await call("s2", "GET", "/api/payroll/mine")).json)).toBe("[]");
  expect((await call("dup", "GET", `/api/payroll/runs/${runApproved}/payslip/${slug(NAME.s2)}/pdf`, undefined, true)).status).toBe(403);
});

test("payroll-admin allow-list gates payslips + accounting too, and can't be self-edited", async () => {
  const lib = ((await call("co", "GET", "/api/library")).json ?? {}) as { settings?: Record<string, unknown> };
  const put = await call("co", "PUT", "/api/library", { settings: { ...(lib.settings ?? {}), payrollAdmins: [email("co")] } });
  expect(put.status, txt(put.json)).toBe(200);
  // co2 is an owner-tier login but NOT a payroll admin
  for (const [m, u, b] of [
    ["GET", "/api/payroll"], ["GET", `/api/payroll/employees/${slug(NAME.s1)}/ni`], ["GET", `/api/payroll/ytd/${slug(NAME.s1)}`],
    ["POST", `/api/payroll/runs/${runApproved}/payslip/email`, {}], ["GET", "/api/accounting/connections"], ["GET", "/api/accounting/mapping?provider=xero"],
    ["POST", `/api/accounting/post/${runApproved}?provider=xero`, {}],
  ] as [string, string, unknown?][]) {
    expect((await call("co2", m, u, b)).status, `${m} ${u}`).toBe(403);
  }
  expect((await call("co2", "GET", `/api/payroll/runs/${runApproved}/payslip/${slug(NAME.s1)}/pdf`, undefined, true)).status).toBe(403);
  // co2 cannot add itself to the list
  const l2 = ((await call("co2", "GET", "/api/library")).json ?? {}) as { settings?: Record<string, unknown> };
  const self = await call("co2", "PUT", "/api/library", { settings: { ...(l2.settings ?? {}), payrollAdmins: [email("co"), email("co2")] } });
  expect(self.status, txt(self.json)).toBe(403);
  // staff never see who the administrators are
  expect(txt((await call("s1", "GET", "/api/library")).json)).not.toContain("payrollAdmins");
  // the admin still works; then reopen it for the later audit steps
  expect((await call("co", "GET", "/api/payroll")).status).toBe(200);
  expect((await call("co", "PUT", "/api/library", { settings: { ...(lib.settings ?? {}), payrollAdmins: [] } })).status).toBe(200);
  expect((await call("co2", "GET", "/api/payroll")).status).toBe(200);
});

test("onboarding file (bank + NI): own record only, redacted for non-payroll-admin managers, duplicate names see nothing, reveals audited", async () => {
  const BANK = "87654321";
  for (const nm of [NAME.s1, NAME.s2]) {
    const put = await call("co", "PUT", `/api/onboarding/records/${encodeURIComponent(nm)}`, { values: { ni: { v: NI }, bankAccount: { v: BANK }, bankSort: { v: "11-22-33" } }, extra: [] });
    expect(put.status, txt(put.json)).toBe(200);
  }
  const as = async (who: string) => txt((await call(who, "GET", "/api/onboarding")).json);
  // payroll admin (unset list → any owner) sees the values; each staff member sees only their OWN record; the same-named duplicate sees none
  expect(await as("co")).toContain(BANK);
  const s1 = await as("s1");
  expect(s1).toContain(NAME.s1);
  expect(s1).not.toContain(NAME.s2);
  const dupView = await as("dup");
  expect(dupView).not.toContain(BANK);
  expect(dupView).not.toContain(NAME.s2);
  expect((await call("dup", "PUT", `/api/onboarding/records/${encodeURIComponent(NAME.s2)}`, { values: { bankAccount: { v: "00000000" } }, extra: [] })).status).toBe(403);
  // a non-admin owner-tier manager gets the record with the sensitive values redacted, and can't overwrite them
  const lib = ((await call("co", "GET", "/api/library")).json ?? {}) as { settings?: Record<string, unknown> };
  expect((await call("co", "PUT", "/api/library", { settings: { ...(lib.settings ?? {}), payrollAdmins: [email("co")] } })).status).toBe(200);
  const red = await as("co2");
  expect(red).toContain(NAME.s1);
  expect(red).not.toContain(BANK);
  expect(red).not.toContain(NI);
  expect((await call("co2", "PUT", `/api/onboarding/records/${encodeURIComponent(NAME.s1)}`, { values: { ni: { v: "" }, bankAccount: { v: "" }, bankSort: { v: "" } }, extra: [] })).status).toBe(200);
  expect(await as("co")).toContain(BANK); // still there
  expect((await call("co", "PUT", "/api/library", { settings: { ...(lib.settings ?? {}), payrollAdmins: [] } })).status).toBe(200);
  const rows = await auditFor(tenantId, "view-onboarding-sensitive");
  expect(rows.length).toBeGreaterThan(0);
  expect(JSON.stringify(rows)).not.toContain(BANK);
});

test("accounting: mapping + connections are manager-only, never expose tokens", async () => {
  const conns = await call("co", "GET", "/api/accounting/connections");
  expect(conns.status).toBe(200);
  expect(txt(conns.json)).not.toMatch(/accessToken|refreshToken|codeVerifier/);
  expect((await call("co", "PUT", "/api/accounting/mapping", { provider: "xero", mapping: { grossWages: "477" } })).status).toBe(200);
  expect((await call("co", "PUT", "/api/accounting/mapping", { provider: "bogus", mapping: {} })).status).toBe(400);
  // the mapping of one tenant is invisible to another
  expect(txt((await call("rival", "GET", "/api/accounting/mapping?provider=xero")).json)).not.toContain("477");
  // posting an unknown / foreign run
  expect((await call("rival", "POST", `/api/accounting/post/${runApproved}?provider=xero`, {})).status).toBe(404);
  // the public OAuth callback refuses an unknown state
  expect((await call(null, "GET", "/api/accounting/callback/xero?state=nope&code=x")).status).toBe(400);
});

test("audit trail: every payroll mutation and sensitive read is logged with actor, time and before/after, and never holds an NI number", async () => {
  const key = tenantId;
  const need = async (action: string, pred?: (e: Record<string, unknown>) => boolean) => {
    const rows = await auditFor(key, action, pred);
    expect(rows.length, `audit entry for ${action}`).toBeGreaterThan(0);
    const e = rows[rows.length - 1];
    expect(typeof e.at).toBe("string");
    expect(e.actor).toBeTruthy();
    return e;
  };
  const created = await need("create-run", (e) => (e.detail as { runId?: string })?.runId === runApproved);
  expect(created.actor).toBe(email("co"));
  const approved = await need("approve-run", (e) => (e.detail as { runId?: string })?.runId === runApproved);
  expect(approved.actor).toBe(email("co2"));
  expect((approved.detail as { createdBy: string }).createdBy).toBe(email("co"));
  expect((approved.detail as { after: { status: string } }).after.status).toBe("approved");
  const pub = await need("publish-run", (e) => (e.detail as { runId?: string })?.runId === runApproved);
  expect((pub.detail as { before: { publishedAt: unknown } }).before.publishedAt).toBeNull();
  const edit = await need("edit-employees", (e) => JSON.stringify(e.detail).includes('"rate"'));
  expect(JSON.stringify(edit.detail)).toContain('"from":30000');
  expect(JSON.stringify(edit.detail)).toContain('"to":31000');
  await need("edit-settings", (e) => (e.detail as { before?: unknown }) !== undefined);
  const adj = await need("edit-adjust");
  expect(JSON.stringify(adj.detail)).toContain("Bonus");
  const ni = await need("view-ni", (e) => (e.detail as { empId?: string })?.empId === slug(NAME.s1));
  expect(ni.actor).toBe(email("co"));
  await need("view-ytd");
  await need("view-payslip", (e) => e.actor === email("s1"));
  await need("view-payslip", (e) => e.actor === email("co"));
  const em = await need("email-payslip", (e) => (e.detail as { employeeId?: string })?.employeeId === slug(NAME.s1));
  expect((em.detail as { to: string }).to).toBe(email("s1"));
  await need("accounting-mapping");
  // the whole log for this tenant: no NI number, no ciphertext, in any entry
  const all = JSON.stringify(admin("audit", key));
  expect(all).not.toContain(NI);
  expect(all).not.toContain("niNumberEnc");
});

test("no response body, error or audit entry across the whole run leaked the NI number", async () => {
  for (const b of bodies) expect(b).not.toContain(NI);
  expect(bodies.length).toBeGreaterThan(50);
});

test("per-user rate limit on the NI reveal", async () => {
  // 30/min per signed-in user; a burst well over that gets a 429 (other users are unaffected)
  let limited = 0;
  for (let i = 0; i < 40; i++) if ((await call("co2", "GET", `/api/payroll/employees/${slug(NAME.s2)}/ni`)).status === 429) limited++;
  expect(limited).toBeGreaterThan(0);
  expect((await call("co", "GET", `/api/payroll/employees/${slug(NAME.s2)}/ni`)).status).toBe(200);
});
