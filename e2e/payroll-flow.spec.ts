import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { API_URL, loadAccounts, ROOT, statePath } from "./helpers/env";
import { fbSignIn, fbSignUp, TEST_EMAIL_DOMAIN } from "./helpers/accounts";
import { cardWith } from "./helpers/ui";

// Payroll end to end, real API + real screens (company Payroll, staff My payslips).
//   · lifecycle over the API with TWO managers: draft -> self-approve refused -> a different manager approves -> publish -> staff sees only
//     their own line -> PDF gates -> email -> YTD counted once; duplicate-period guard; unauthorised roles/tenants.
//   · the company screen: new starter (pro-rata), leaver (paid to last day) and long-gone leaver (not on the run); dates survive an edit;
//     the run created from the screen equals what the API stores; Draft -> Approved is shown on THIS run's card.
//   · staff screen: own payslip only, matches the API, RTL in Arabic/Urdu, no sideways scroll at 390px.
// Throwaway data only: unique-stamped names/periods, the second manager is an @activityos-test.com user removed by `npm run e2e:cleanup`.
test.describe.configure({ mode: "serial", timeout: 300_000 });

const stamp = Date.now().toString(36);
const server = path.join(ROOT, "server");
const slug = (n: string) => n.trim().toLowerCase().replace(/\s+/g, "-");
const r2 = (n: number) => Math.round(n * 100) / 100;
const gbp = (n: number) => "£" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const call = async (method: string, p: string, token: string | null, body?: unknown) => {
  // one retry on a dropped socket (the dev API restarts under tsx watch when files change), then name the call that failed
  const send = () => fetch(`${API_URL}${p}`, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const r = await send().catch(async () => { await new Promise((res) => setTimeout(res, 3000)); return send(); }).catch((e) => { throw new Error(`${method} ${p} -> ${String((e as Error).cause ?? e)}`); });
  const ct = r.headers.get("content-type") || "";
  return { status: r.status, ct, body: ct.includes("json") ? await r.json().catch(() => null) : null, bytes: ct.includes("pdf") ? Buffer.from(await r.arrayBuffer()) : null } as { status: number; ct: string; body: any; bytes: Buffer | null };
};

let A = "", B = "", S = "", F = "", tenantId = "", staffName = "", staffEmail = "";
const mgrName = `Payroll Approver ${stamp}`;

test.beforeAll(async () => {
  const m = loadAccounts();
  tenantId = m.accounts.company.tenantId!;
  A = (await fbSignIn(m.accounts.company.email)).idToken;
  S = (await fbSignIn(m.accounts.staff.email)).idToken;
  F = (await fbSignIn(m.accounts.freelancer.email)).idToken;
  staffEmail = m.accounts.staff.email;
  staffName = String((await call("GET", "/api/account", S)).body?.name ?? "").trim();
  expect(staffName, "the standing staff account needs a name").not.toBe("");
  // a SECOND manager on the same company tenant (the approver)
  const email = `e2e-payroll-mgr-${stamp}@${TEST_EMAIL_DOMAIN}`;
  const u = await fbSignUp(email);
  execFileSync("npx", ["tsx", path.join(ROOT, "e2e/helpers/mkManager.ts"), u.uid, email, mgrName, tenantId], { cwd: server, stdio: "pipe" });
  B = (await fbSignIn(email)).idToken;
});

const mkLine = (id: string, name: string, gross: number) => {
  const paye = r2(gross * 0.1), ni = r2(gross * 0.08), pen = r2(gross * 0.03);
  return { id, staffKey: id, name, role: "E2E", op: "", basis: "year", rate: gross * 12, hpw: 0, weeks: 52, taxCode: "1257L", niCat: "A", hoursM: 0, basePayM: gross, addM: 0, dedM: 0, additions: [], deductions: [], manual: { paye: false, eeNi: false, eePen: false }, grossM: gross, payeM: paye, eeNiM: ni, erNiM: r2(gross * 0.15), eePenM: pen, erPenM: r2(gross * 0.02), netM: r2(gross - paye - ni - pen) };
};

test("lifecycle over the API: segregation of duties, duplicate guard, publish, PDF + email gates, YTD once", async () => {
  const sid = slug(staffName), period = `E2E Flow ${stamp}`;
  const staffLine = mkLine(sid, staffName, 2000), otherLine = mkLine(`e2e-other-${stamp}`, `E2E Other ${stamp}`, 1500);
  // employee round trip keeps the additive fields (start/leave date) and never returns an NI number
  const emps = [{ id: sid, name: staffName, role: "Coach", op: "", basis: "year", rate: 24000, hpw: 0, weeks: 52, taxCode: "1257L", niCat: "A", pension: true, startDate: "2025-01-06", leaveDate: null, niNumber: "QQ123456C" }];
  expect((await call("PUT", "/api/payroll/employees", A, { employees: emps })).status).toBe(200);
  const got = (await call("GET", "/api/payroll", A)).body;
  expect(got.employees[0].startDate).toBe("2025-01-06");
  expect(got.employees[0].hasNiNumber).toBe(true);
  expect(JSON.stringify(got)).not.toContain("QQ123456C");

  // create: draft, created by A
  const c = await call("POST", "/api/payroll/runs", A, { period, paidOn: "2026-09-30", freq: "monthly", lines: [staffLine, otherLine] });
  expect(c.status, JSON.stringify(c.body)).toBe(201);
  expect(c.body.status).toBe("draft");
  const id = c.body.id as string;
  // stored lines equal what was sent, to the penny
  const stored = ((await call("GET", "/api/payroll", A)).body.runs as any[]).find((r) => r.id === id);
  expect(stored.lines.map((l: any) => [l.id, l.grossM, l.netM])).toEqual([[sid, 2000, staffLine.netM], [otherLine.id, 1500, otherLine.netM]]);

  // duplicate period: refused unless deliberate; both then exist
  const dup = await call("POST", "/api/payroll/runs", A, { period, paidOn: "2026-09-30", lines: [staffLine] });
  expect(dup.status).toBe(409);
  expect(dup.body.code).toBe("duplicate_run");
  expect(dup.body.existingRunId).toBe(id);

  // a draft can't be published, emailed, or shown to staff; nobody outside may touch it
  expect((await call("POST", `/api/payroll/runs/${id}/publish`, A, { published: true })).status).toBe(400);
  expect((await call("POST", `/api/payroll/runs/${id}/payslip/email`, A, {})).status).toBe(409);
  expect((await call("GET", `/api/payroll/mine`, S)).body.some((r: any) => r.id === id)).toBe(false);
  expect((await call("GET", `/api/payroll/runs/${id}/payslip/${sid}/pdf`, S)).status).toBe(403);
  expect((await call("GET", `/api/payroll`, S)).status).toBe(403);
  expect((await call("POST", `/api/payroll/runs/${id}/approve`, S, {})).status).toBe(403);
  expect((await call("POST", `/api/payroll/runs/${id}/approve`, F, {})).status).toBe(404); // another tenant can't even see it
  // a manager may preview a draft's PDF
  const draftPdf = await call("GET", `/api/payroll/runs/${id}/payslip/${sid}/pdf`, A);
  expect(draftPdf.status).toBe(200);
  expect(draftPdf.ct).toContain("application/pdf");
  expect(draftPdf.bytes!.subarray(0, 5).toString()).toBe("%PDF-");

  // segregation of duties
  const self = await call("POST", `/api/payroll/runs/${id}/approve`, A, {});
  expect(self.status).toBe(403);
  expect(self.body.error).toMatch(/Segregation of duties/);
  const ok = await call("POST", `/api/payroll/runs/${id}/approve`, B, {});
  expect(ok.status, JSON.stringify(ok.body)).toBe(200);
  expect(ok.body.status).toBe("approved");
  expect(ok.body.approvedBy).toContain("e2e-payroll-mgr");
  expect((await call("POST", `/api/payroll/runs/${id}/approve`, B, {})).status).toBe(400); // already approved

  // YTD counted exactly once for the staff member
  const ytd = (await call("GET", `/api/payroll/ytd/${sid}`, A)).body;
  expect(ytd.runs).toBeGreaterThanOrEqual(1);
  const before = ytd.gross;
  expect((await call("POST", `/api/payroll/runs/${id}/approve`, A, {})).status).toBe(400);
  expect((await call("GET", `/api/payroll/ytd/${sid}`, A)).body.gross).toBe(before);

  // publish -> staff sees ONLY their own line, matching the stored figures
  expect((await call("POST", `/api/payroll/runs/${id}/publish`, A, { published: true })).status).toBe(200);
  const mine = (await call("GET", "/api/payroll/mine", S)).body as any[];
  const mineRun = mine.find((r) => r.id === id);
  expect(mineRun.lines).toHaveLength(1);
  expect(mineRun.lines[0].netM).toBe(staffLine.netM);
  expect(JSON.stringify(mineRun)).not.toContain(otherLine.name);
  const own = await call("GET", `/api/payroll/runs/${id}/payslip/${sid}/pdf`, S);
  expect(own.status).toBe(200);
  expect(own.ct).toContain("application/pdf");
  expect((await call("GET", `/api/payroll/runs/${id}/payslip/${otherLine.id}/pdf`, S)).status).toBe(403);
  expect((await call("GET", `/api/payroll/runs/${id}/payslip/${sid}/pdf`, F)).status).toBe(404);
  // the issued PDF is stable: the same bytes on a re-download
  const again = await call("GET", `/api/payroll/runs/${id}/payslip/${sid}/pdf`, S);
  expect(again.bytes!.equals(own.bytes!)).toBe(true);

  // email: staff can't send; managers can; only the address on the account is used
  expect((await call("POST", `/api/payroll/runs/${id}/payslip/email`, S, {})).status).toBe(403);
  const em = await call("POST", `/api/payroll/runs/${id}/payslip/email`, B, { employeeId: sid });
  expect(em.status, JSON.stringify(em.body)).toBe(200);
  expect(em.body.results[0].employeeId).toBe(sid);
  expect(["sent", "no account email on file"]).toContain(em.body.results[0].status);
  expect((await call("POST", `/api/payroll/runs/${id}/payslip/email`, B, { employeeId: "nobody-here" })).status).toBe(404);

  // unpublish hides it again
  expect((await call("POST", `/api/payroll/runs/${id}/publish`, A, { published: false })).status).toBe(200);
  expect((await call("GET", "/api/payroll/mine", S)).body.some((r: any) => r.id === id)).toBe(false);
  expect((await call("GET", `/api/payroll/runs/${id}/payslip/${sid}/pdf`, S)).status).toBe(403);

  // input errors are readable, not a crash
  expect((await call("POST", "/api/payroll/runs", A, { period: "", paidOn: "2026-13-45", lines: [] })).status).toBe(400);
  expect((await call("POST", "/api/payroll/runs", A, { period: `E2E neg ${stamp}`, paidOn: "2026-09-30", lines: [{ ...staffLine, grossM: -5 }] })).status).toBe(400);
  expect((await call("PUT", "/api/payroll/employees", A, { employees: [{ ...emps[0], leaveDate: "2026-02-31" }] })).status).toBe(400);
  expect((await call("GET", "/api/payroll/timesheets?from=2026-09-01&to=2026-01-01", A)).status).toBe(400);
});

// ── the company screen ──────────────────────────────────────────────────────
const isoD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const now = new Date();
const mStart = new Date(now.getFullYear(), now.getMonth(), 1), mEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
const weekdays = (from: Date, to: Date) => { let n = 0; for (const d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) if (d.getDay() !== 0 && d.getDay() !== 6) n++; return n; };
const startD = new Date(now.getFullYear(), now.getMonth(), 16), leaveD = new Date(now.getFullYear(), now.getMonth(), 9);
const goneD = new Date(now.getFullYear(), now.getMonth() - 1, 20);
const share = (from: Date, to: Date) => weekdays(from, to) / weekdays(mStart, mEnd);
const salaryMonth = 24000 / 12;

async function openPayroll(page: Page) {
  await page.goto("/company/payroll");
  // the standing storage state can have been signed out by other suites' account churn — sign in through the real form if so
  const emailBox = page.getByPlaceholder("you@example.com"), tab = page.getByRole("button", { name: /Pay run/ });
  await Promise.race([emailBox.waitFor({ timeout: 90_000 }), tab.waitFor({ timeout: 90_000 })]).catch(() => {});
  if (await emailBox.isVisible().catch(() => false)) {
    const m = loadAccounts();
    await page.getByPlaceholder("you@example.com").fill(m.accounts.company.email);
    await page.locator('input[type="password"]').fill(m.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL("**/company/**", { timeout: 60_000 });
    await page.goto("/company/payroll");
  }
  await expect(page.getByRole("button", { name: /Pay run/ })).toBeVisible({ timeout: 90_000 });
}

test("company screen: starter pro-rata, leaver to last day, gone leaver excluded, dates survive an edit, draft -> approved", async ({ browser }) => {
  const names = { starter: `E2E Starter ${stamp}`, leaver: `E2E Leaver ${stamp}`, gone: `E2E Gone ${stamp}` };
  const mk = (name: string, extra: Record<string, unknown>) => ({ id: slug(name), name, role: "Admin", op: "", basis: "year", rate: 24000, hpw: 0, weeks: 52, taxCode: "1257L", niCat: "A", pension: false, paidFrom: "contracted", source: "manual", ...extra });
  const base = ((await call("GET", "/api/payroll", A)).body.employees ?? []) as any[];
  const keep = base.filter((e) => !/^E2E (Starter|Leaver|Gone) /.test(e.name));
  expect((await call("PUT", "/api/payroll/employees", A, { employees: [...keep, mk(names.starter, { startDate: isoD(startD) }), mk(names.leaver, { leaveDate: isoD(leaveD) }), mk(names.gone, { leaveDate: isoD(goneD) })] })).status).toBe(200);

  const ctx = await browser.newContext({ storageState: statePath("company") });
  const page = await ctx.newPage();
  page.on("dialog", (d) => d.accept()); // "create another?" / confirms
  await openPayroll(page);

  // Employees tab: editing the starter and saving must NOT drop the dates (the old save stripped them)
  await page.getByRole("button", { name: /Employees/ }).click();
  const empRow = page.locator("tr").filter({ hasText: names.starter });
  await expect(empRow).toBeVisible({ timeout: 30_000 });
  await empRow.getByRole("button", { name: "Edit" }).click();
  await expect(page.getByTestId("emp-start")).toHaveValue(isoD(startD));
  // a leaving date before the start date is refused with a readable message
  await page.getByTestId("emp-leave").fill(isoD(new Date(startD.getFullYear(), startD.getMonth(), 2)));
  await page.getByRole("button", { name: /^Save/ }).click();
  await expect(page.getByText("The leaving date can't be before the start date.")).toBeVisible();
  await page.getByTestId("emp-leave").fill("");
  await page.locator("input[inputmode=decimal]").first().fill("24000");
  await page.getByRole("button", { name: /^Save/ }).click();
  await expect.poll(async () => ((await call("GET", "/api/payroll", A)).body.employees as any[]).find((e) => e.name === names.starter)?.startDate, { timeout: 15_000 }).toBe(isoD(startD));
  const afterEdit = ((await call("GET", "/api/payroll", A)).body.employees as any[]);
  expect(afterEdit.find((e) => e.name === names.leaver).leaveDate).toBe(isoD(leaveD));

  // Pay run tab: who is on the run, and the pro-rata figures
  await page.getByRole("button", { name: /▶ Pay run/ }).click();
  const starterRow = page.locator("tr").filter({ hasText: names.starter });
  const leaverRow = page.locator("tr").filter({ hasText: names.leaver });
  await expect(starterRow).toBeVisible({ timeout: 30_000 });
  await expect(leaverRow).toBeVisible();
  await expect(page.locator("tr").filter({ hasText: names.gone })).toHaveCount(0);
  await expect(page.getByTestId("not-in-run")).toContainText(names.gone);
  const sShare = share(startD, mEnd), lShare = share(mStart, leaveD);
  await expect(starterRow).toContainText(`pro-rata ${Math.round(sShare * 100)}%`);
  await expect(leaverRow).toContainText(`pro-rata ${Math.round(lShare * 100)}%`);
  await expect(starterRow).toContainText(gbp(r2(salaryMonth * sShare)));
  await expect(leaverRow).toContainText(gbp(r2(salaryMonth * lShare)));

  // create the run from the screen -> a DRAFT on the Payslips tab, on THIS run's card
  await page.getByRole("button", { name: "✓ Create pay run" }).click();
  await expect(page.getByRole("button", { name: /Payslips/ })).toBeVisible();
  const card = cardWith(page, names.starter, names.leaver);
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(card).toContainText("Draft");
  await expect(card).not.toContainText(names.gone);
  await expect(card.getByRole("button", { name: /Approve run/ })).toBeVisible();

  // every figure on the card equals what the API stored
  const run = ((await call("GET", "/api/payroll", A)).body.runs as any[]).find((r) => r.lines.some((l: any) => l.name === names.starter));
  expect(run.status).toBe("draft");
  const sl = run.lines.find((l: any) => l.name === names.starter), ll = run.lines.find((l: any) => l.name === names.leaver);
  expect(sl.grossM).toBe(r2(salaryMonth * sShare));
  expect(ll.grossM).toBe(r2(salaryMonth * lShare));
  await expect(card.locator("button").filter({ hasText: names.starter })).toContainText(gbp(sl.netM));
  await expect(card.locator("button").filter({ hasText: names.leaver })).toContainText(gbp(ll.netM));

  // the creator (this browser is the company owner = A) cannot approve; the toast says why
  await card.getByRole("button", { name: /Approve run/ }).click();
  await expect(page.getByText(/Segregation of duties/)).toBeVisible({ timeout: 15_000 });
  await expect(card).toContainText("Draft");

  // a different manager approves (API); the screen picks it up on reload and shows Approved + Publish
  expect((await call("POST", `/api/payroll/runs/${run.id}/approve`, B, {})).status).toBe(200);
  await page.reload();
  await page.getByRole("button", { name: /Payslips/ }).click();
  const card2 = cardWith(page, names.starter, names.leaver);
  await expect(card2).toContainText("Approved", { timeout: 30_000 });
  await card2.getByRole("button", { name: /Publish to staff/ }).click();
  await expect(card2).toContainText("Published to staff", { timeout: 15_000 });
  await expect.poll(async () => ((await call("GET", "/api/payroll", A)).body.runs as any[]).find((r) => r.id === run.id)?.publishedAt, { timeout: 15_000 }).toBeTruthy();

  // creating the same month again asks first, and is allowed only deliberately (server has the last word)
  await page.getByRole("button", { name: /▶ Pay run/ }).click();
  await page.getByRole("button", { name: "✓ Create pay run" }).click();
  await expect.poll(async () => ((await call("GET", "/api/payroll", A)).body.runs as any[]).filter((r) => r.lines.some((l: any) => l.name === names.starter)).length, { timeout: 20_000 }).toBe(2);
  await ctx.close();
});

// ── staff screen ────────────────────────────────────────────────────────────
test("staff My payslips: own payslip only, matches the API; RTL in Arabic/Urdu; fits 390px", async ({ browser }) => {
  const sid = slug(staffName), period = `E2E Staff View ${stamp}`;
  const line = mkLine(sid, staffName, 1875.5);
  const other = mkLine(`e2e-notme-${stamp}`, `E2E NotMe ${stamp}`, 999);
  const c = await call("POST", "/api/payroll/runs", A, { period, paidOn: "2026-09-30", freq: "monthly", lines: [line, other] });
  expect(c.status).toBe(201);
  expect((await call("POST", `/api/payroll/runs/${c.body.id}/approve`, B, {})).status).toBe(200);
  expect((await call("POST", `/api/payroll/runs/${c.body.id}/publish`, A, { published: true })).status).toBe(200);

  for (const [locale, title, dir] of [["en", "My payslips", "ltr"], ["ar", "قسائم راتبي", "rtl"], ["ur", "میری پے سلپس", "rtl"]] as const) {
    const ctx = await browser.newContext({ storageState: statePath("staff"), viewport: { width: 390, height: 844 } });
    await ctx.addInitScript((l) => { try { localStorage.setItem("aos.locale", l); } catch { /* */ } }, locale);
    const page = await ctx.newPage();
    await page.goto("/staff/payslips");
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 90_000 });
    const row = cardWith(page, period);
    await expect(row).toBeVisible({ timeout: 30_000 });
    // this run's card shows the net figure the API holds for THIS person, never the other person's
    await expect(row).toContainText(gbp(line.netM));
    await expect(page.getByText(other.name)).toHaveCount(0);
    await expect(row).not.toContainText(gbp(other.netM));
    if (locale !== "en") expect(await page.evaluate(() => document.documentElement.dir)).toBe(dir);
    // no sideways scroll at phone width
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `horizontal overflow in ${locale}`).toBeLessThanOrEqual(1);
    await ctx.close();
  }
  // the person-level PDF the button opens is theirs and a real PDF
  const pdf = await call("GET", `/api/payroll/runs/${c.body.id}/payslip/${sid}/pdf`, S);
  expect(pdf.status).toBe(200);
  expect(pdf.bytes!.subarray(0, 5).toString()).toBe("%PDF-");
});

test("company Payroll fits a 390px phone on every tab (no page-level sideways scroll)", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: statePath("company"), viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await openPayroll(page);
  for (const tab of [/Overview/, /Employees/, /▶ Pay run/, /Payslips/, /Integrations/]) {
    await page.getByRole("button", { name: tab }).click();
    await page.waitForTimeout(400);
    // payroll's own content must sit inside the viewport (elements inside a deliberately scrollable table wrapper are skipped)
    const offenders = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth, out: string[] = [];
      for (const el of Array.from(document.querySelectorAll("main *"))) {
        if (el.closest(".overflow-x-auto, .overflow-auto, [class*='overflow-x-']")) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > vw + 1) out.push(`${el.tagName}.${String((el as HTMLElement).className).slice(0, 50)} right=${Math.round(r.right)}`);
      }
      return out.slice(0, 5);
    });
    expect(offenders, `content wider than the phone on ${tab}`).toEqual([]);
  }
  await ctx.close();
});

test("staff /mine is a list for staff and closed to signed-out callers", async () => {
  expect(Array.isArray((await call("GET", "/api/payroll/mine", S)).body)).toBe(true);
  expect((await call("GET", "/api/payroll/mine", null)).status).toBe(401);
});
