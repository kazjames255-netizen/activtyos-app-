import { test, expect, type Locator, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadAccounts, ROOT, API_URL } from "./helpers/env";
import { fbSignIn, TEST_PASSWORD } from "./helpers/accounts";

// Records the three operator how-to videos (Xero, QuickBooks, Sage setup preview) against the REAL Payroll > Integrations UI of the standing
// e2e company account. Xero = 'ActivityOS Test' org, QuickBooks = Intuit SANDBOX (posting authorised there ONLY); every journal is voided/deleted,
// the throwaway pay run is deleted and the account mapping is restored. Provider login/consent pages are never opened for real (stubbed, and
// nothing is typed): they are explained on title cards. Run only when RECORD_VIDEOS=1; output goes to OUT (default ~/Downloads/ActivityOS accounting videos).
const OUT = process.env.VIDEO_OUT || path.join(os.homedir(), "Downloads/ActivityOS accounting videos");
const server = path.join(ROOT, "server");
const tsx = (helper: string, ...args: string[]) => execFileSync("npx", ["tsx", path.join(ROOT, "e2e/helpers", helper), ...args], { cwd: server, stdio: "pipe" }).toString();
const patchDoc = (c: string, id: string, patch: Record<string, unknown>) => tsx("docPatch.ts", c, id, JSON.stringify(patch));
const json = (out: string) => JSON.parse(out.match(/@@JSON@@(.*)@@END@@/)![1]);
async function call(method: string, p: string, token: string, body?: unknown) {
  const r = await fetch(`${API_URL}${p}`, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });
  let j: any = null; try { j = await r.json(); } catch { /* */ }
  return { status: r.status, body: j };
}
const LINES = [
  { id: "e2e-vid-a", name: "Sam Example (demo)", grossM: 1200, payeM: 120, eeNiM: 96, erNiM: 156, eePenM: 36, erPenM: 48, netM: 948 },
  { id: "e2e-vid-b", name: "Alex Sample (demo)", grossM: 800, payeM: 80, eeNiM: 64, erNiM: 104, eePenM: 24, erPenM: 32, netM: 632 },
];

type Ev = { t: number; file: string };
class Rec {
  t0 = 0; evs: Ev[] = []; n = 0;
  constructor(public page: Page, public dir: string) {}
  start() { this.t0 = Date.now(); }
  private speak(text: string) {
    const f = path.join(this.dir, `vo-${this.n++}.aiff`);
    execFileSync("say", ["-v", "Daniel", "-r", "185", "-o", f, text]);
    const dur = parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString());
    return { f, dur };
  }
  /** Caption bar (+ optional highlighted element), spoken; holds long enough for the voice-over to finish. */
  async cap(text: string, o: { step?: string; hl?: Locator; min?: number } = {}) {
    const { f, dur } = this.speak(text);
    if (o.hl) { await o.hl.scrollIntoViewIfNeeded().catch(() => {}); await o.hl.evaluate((e) => { (e as HTMLElement).style.outline = "4px solid #ffb703"; (e as HTMLElement).style.outlineOffset = "4px"; (e as HTMLElement).style.borderRadius = "10px"; }).catch(() => {}); }
    await this.page.evaluate(({ text, step }) => {
      let d = document.getElementById("__cap"); if (!d) { d = document.createElement("div"); d.id = "__cap"; document.documentElement.appendChild(d); }
      d.setAttribute("style", "position:fixed;left:0;right:0;bottom:0;z-index:2147483000;background:rgba(10,18,50,.94);color:#fff;font:600 26px/1.35 system-ui,-apple-system,sans-serif;padding:22px 48px 22px 96px;display:flex;gap:20px;align-items:center;");
      d.innerHTML = (step ? `<span style="flex:none;background:#ffb703;color:#111;border-radius:999px;padding:4px 16px;font-size:20px;font-weight:800">${step}</span>` : "") + `<span>${text}</span>`;
    }, { text, step: o.step ?? "" });
    this.evs.push({ t: (Date.now() - this.t0) / 1000, file: f });
    await this.page.waitForTimeout(Math.max(o.min ?? 2500, dur * 1000 + 700));
    if (o.hl) await o.hl.evaluate((e) => { (e as HTMLElement).style.outline = ""; }).catch(() => {});
  }
  /** Full-screen title / explainer card. */
  async card(title: string, lines: string[], spoken: string, o: { tag?: string; min?: number } = {}) {
    const { f, dur } = this.speak(spoken);
    await this.page.evaluate(({ title, lines, tag }) => {
      document.getElementById("__cap")?.remove();
      let d = document.getElementById("__card"); if (!d) { d = document.createElement("div"); d.id = "__card"; document.documentElement.appendChild(d); }
      d.setAttribute("style", "position:fixed;inset:0;z-index:2147483600;background:linear-gradient(135deg,#1d3a8f,#10195a);color:#fff;font-family:system-ui,-apple-system,sans-serif;display:flex;flex-direction:column;justify-content:center;padding:0 140px;");
      d.innerHTML = (tag ? `<div style="align-self:flex-start;background:#ffb703;color:#111;font-weight:800;font-size:22px;border-radius:999px;padding:6px 20px;margin-bottom:28px">${tag}</div>` : "") + `<div style="font-size:56px;font-weight:800;line-height:1.15;margin-bottom:30px">${title}</div>` + lines.map((l) => `<div style="font-size:30px;line-height:1.5;margin:6px 0;color:#dfe7ff">${l}</div>`).join("");
    }, { title, lines, tag: o.tag ?? "" });
    this.evs.push({ t: (Date.now() - this.t0) / 1000, file: f });
    await this.page.waitForTimeout(Math.max(o.min ?? 4000, dur * 1000 + 900));
  }
  async hideCard() { await this.page.evaluate(() => document.getElementById("__card")?.remove()); }
}

/** webm -> mp4 with the voice-over lines placed at their recorded times. */
function finish(rec: Rec, webm: string, out: string) {
  const args = ["-y", "-i", webm];
  rec.evs.forEach((e) => args.push("-i", e.file));
  const filt = rec.evs.map((e, i) => `[${i + 1}:a]adelay=${Math.round(e.t * 1000)}|${Math.round(e.t * 1000)}[a${i}]`).join(";") + `;${rec.evs.map((_, i) => `[a${i}]`).join("")}amix=inputs=${rec.evs.length}:normalize=0[aout]`;
  args.push("-filter_complex", filt, "-map", "0:v", "-map", "[aout]", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-r", "25", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-shortest", out);
  execFileSync("ffmpeg", args, { stdio: "pipe" });
}

test.describe.configure({ mode: "serial" });
test.skip(!process.env.RECORD_VIDEOS, "video recording only runs with RECORD_VIDEOS=1");

async function session(browser: import("@playwright/test").Browser, email: string) {
  const c = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await c.newPage();
  await p.goto("/login");
  await p.getByPlaceholder("you@example.com").fill(email);
  await p.locator('input[type="password"]').fill(TEST_PASSWORD);
  await p.getByRole("button", { name: "Sign in", exact: true }).click();
  await p.waitForURL(/\/company/, { timeout: 60_000 });
  const state = await c.storageState({ indexedDB: true });
  await c.close();
  return state;
}

type P = { id: "xero" | "quickbooks"; name: string; file: string; consent: string[]; spokenConsent: string; where: string[]; spokenDone: string; pick: [RegExp, RegExp][] };   // [preferred name, required account type] per bucket, in the order the six selects appear
const PROVIDERS: P[] = [
  { id: "xero", name: "Xero", file: "xero.mp4",
    consent: ["1. Sign in to Xero with your own Xero login.", "2. Choose which organisation to connect.", "3. Xero lists what ActivityOS may do, then you press Allow access:", "&nbsp;&nbsp;&nbsp;&bull; create manual journals   &bull; read your chart of accounts   &bull; stay connected (offline access)", "ActivityOS never sees your Xero password."],
    spokenConsent: "A Xero window opens. Sign in with your own Xero login, choose the organisation, and press Allow access. Xero shows exactly what ActivityOS may do: create manual journals, read your chart of accounts, and stay connected. ActivityOS never sees your password.",
    where: ["In Xero: Accounting, then Advanced, then Manual journals.", "The journal is narrated &ldquo;ActivityOS payroll&rdquo; with the pay period."], spokenDone: "Done. In Xero, open Accounting, Advanced, Manual journals, and the wages journal is there, labelled with the pay period.",
    pick: [[/Salaries|Wages/, /\(EXPENSE\)$/], [/National Insurance/, /\(EXPENSE\)$/], [/Pension/, /\(EXPENSE\)$/], [/PAYE|Payroll Tax|Tax/, /\(LIABILITY\)$/], [/Pension|Superannuation/, /\(LIABILITY\)$/], [/Wages Payable|Payable/, /\(LIABILITY\)$/]] },
  { id: "quickbooks", name: "QuickBooks Online", file: "quickbooks.mp4",
    consent: ["1. Sign in to Intuit with your own QuickBooks login.", "2. Choose the company file to connect.", "3. Review the permission and press Connect:", "&nbsp;&nbsp;&nbsp;&bull; QuickBooks Online accounting (create journal entries, read accounts)", "ActivityOS never sees your Intuit password."],
    spokenConsent: "An Intuit window opens. Sign in with your own QuickBooks login, choose the company, and press Connect. Intuit shows the one permission ActivityOS needs: accounting access, to create journal entries and read your accounts. ActivityOS never sees your password.",
    where: ["In QuickBooks: Transactions, then Chart of accounts, or Reports, then Journal.", "The journal number starts AOS-PAYROLL and carries the pay month."], spokenDone: "Done. In QuickBooks, the journal entry appears with a number starting A O S payroll, dated on the pay day.",
    pick: [[/Payroll|Wages|Labor/, /\(Expense\)$/], [/Payroll Tax|Tax/, /\(Expense\)$/], [/Insurance|Pension/, /\(Expense\)$/], [/Payroll|Tax|Payable/, /\(Other Current Liability\)$/], [/Pension|Payable/, /\(Other Current Liability\)$/], [/Checking/, /\(Bank\)$/]] },
];

for (const prov of PROVIDERS) {
  test(`record ${prov.name} how-to video`, async ({ browser }) => {
    test.setTimeout(900_000);
    const { accounts } = loadAccounts();
    const co = accounts.company;
    const tok = (await fbSignIn(co.email)).idToken;
    const conns = (await call("GET", "/api/accounting/connections", tok)).body;
    test.skip(!conns?.[prov.id]?.connected, `${prov.name} is not connected for the e2e company account`);
    if (prov.id === "xero") expect(conns.xero.label, "SAFETY: only ever post to the 'ActivityOS Test' Xero org").toBe("ActivityOS Test");
    else expect(String(conns.quickbooks.label), "SAFETY: only the Intuit sandbox company").toContain("9341458202792641");

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `aos-vid-${prov.id}-`));
    fs.mkdirSync(OUT, { recursive: true });
    const prior = (await call("GET", `/api/accounting/mapping?provider=${prov.id}`, tok)).body.mapping ?? {};
    const period = `Sep 2026 pay run (${prov.name} demo) ${Date.now().toString(36)}`;
    const mk = await call("POST", "/api/payroll/runs", tok, { period, paidOn: "2026-09-30", lines: LINES });
    expect(mk.status, JSON.stringify(mk.body)).toBe(201);
    const runId = mk.body.id as string;
    patchDoc("payrollRuns", `${co.tenantId}_${runId}`, { createdBy: "payroll.admin@activityos-test.com", createdByUid: "e2e-other-creator-uid" });   // "the second person" is the creator; the operator approves
    let journalId = "";
    const state = await session(browser, co.email);
    const ctx = await browser.newContext({ storageState: state, viewport: { width: 1440, height: 900 }, recordVideo: { dir, size: { width: 1440, height: 900 } } });
    const page = await ctx.newPage();
    page.on("dialog", (d) => d.accept());
    const rec = new Rec(page, dir);
    let webm = "";
    try {
      await ctx.route(/^https:\/\/(login\.xero\.com|appcenter\.intuit\.com|www\.sageone\.com)\//, (r) => r.fulfill({ contentType: "text/html", body: "<h1>provider sign-in (stubbed)</h1>" }));
      // fake "not connected" for the provider only inside this browser (the real connection is never touched)
      await page.route("**/api/accounting/connections", async (r) => { const j = await (await r.fetch()).json(); j[prov.id] = { configured: true, connected: false }; await r.fulfill({ json: j }); });
      await page.goto("/company/payroll");
      await expect(page.getByRole("button", { name: /Integrations/ })).toBeVisible({ timeout: 60_000 });
      rec.start();
      await rec.card(`Connect ${prov.name} and post your payroll`, ["ActivityOS how-to: about 90 seconds", "Connect once, map six accounts, approve a pay run, post the journal."], `How to connect ${prov.name} to ActivityOS and post your payroll journal.`, { tag: "HOW-TO" });
      await rec.hideCard();
      await rec.cap("Open Payroll from the sidebar.", { step: "Step 1" });
      await page.getByRole("button", { name: /Integrations/ }).click();
      await expect(page.getByText("Accounting integrations")).toBeVisible();
      const card = page.locator('[data-ui="card"]').filter({ has: page.getByText(prov.name, { exact: true }) }).last();
      await rec.cap("Then choose the Integrations tab. Here you can link QuickBooks, Xero or Sage.", { step: "Step 2", hl: card });
      const popupP = ctx.waitForEvent("page");
      await card.getByRole("button", { name: "Connect" }).click();
      await rec.cap(`Press Connect next to ${prov.name}. This card is shown before linking; your own account starts like this.`, { step: "Step 3", min: 3000 });
      (await popupP).close().catch(() => {});
      await rec.card(`${prov.name} sign-in and consent`, prov.consent, prov.spokenConsent, { tag: "ON THE PROVIDER'S SITE", min: 6000 });
      await rec.hideCard();
      // back to the real state: connected
      await page.unroute("**/api/accounting/connections");
      await page.reload();
      await page.getByRole("button", { name: /Integrations/ }).click();
      const card2 = page.locator('[data-ui="card"]').filter({ has: page.getByText(prov.name, { exact: true }) }).last();
      await expect(card2.getByText(/^Connected/)).toBeVisible({ timeout: 30_000 });
      await rec.cap("When you are sent back to ActivityOS the card says Connected, with the name of your organisation.", { step: "Step 4", hl: card2.getByText(/^Connected/) });
      // mapping
      await expect(card2.getByText("Account mapping")).toBeVisible();
      const sels = ["grossWages", "employerNi", "employerPension", "payeNicLiability", "pensionPayable", "netWagesBank"];
      const why = ["Gross wages: the expense account for everyone's pay before deductions.", "Employer National Insurance: the expense account for your NI cost.", "Employer pension: the expense account for your pension contributions.", "PAYE and NIC liability: what you owe HMRC.", "Pension payable: what you owe the pension provider.", "Net wages: the bank or clearing account staff are paid from."];
      await rec.cap("Now map the six accounts the journal uses, from your own chart of accounts.", { step: "Step 5", hl: card2.getByText("Account mapping"), min: 2500 });
      const used = new Set<string>();
      for (let i = 0; i < sels.length; i++) {
        const sel = page.locator(`#${prov.id}-${sels[i]}`);
        await expect(sel).toBeVisible();
        const opts = await sel.locator("option").evaluateAll((os) => os.map((o) => ({ v: (o as HTMLOptionElement).value, t: o.textContent ?? "" })).filter((o) => o.v));
        expect(opts.length, "chart of accounts loaded").toBeGreaterThan(2);
        const [pref, type] = prov.pick[i];
        const choice = opts.find((o) => pref.test(o.t) && type.test(o.t) && !used.has(o.v)) ?? opts.find((o) => type.test(o.t) && !used.has(o.v)) ?? opts[0];
        used.add(choice.v);
        await sel.selectOption(choice.v);
        await rec.cap(why[i], { hl: sel, min: 1500 });
      }
      const save = card2.getByRole("button", { name: /Save mapping/ });
      const saved = page.waitForResponse((r) => r.url().includes("/api/accounting/mapping") && r.request().method() === "PUT");
      await save.click();
      const sr = await saved;
      expect(sr.status(), `save mapping: ${await sr.text()}`).toBe(200);
      await rec.cap("Press Save mapping. You only do this once.", { step: "Step 6", hl: save });
      // approve
      await page.getByRole("button", { name: /Payslips/ }).click();
      const head = page.getByText(period, { exact: true }).locator("..");
      await expect(head).toBeVisible({ timeout: 30_000 });
      await rec.cap("On the Payslips tab, a new pay run waits as a draft. For safety, a different person from whoever created it must approve it.", { step: "Step 7", hl: head, min: 3000 });
      await head.getByRole("button", { name: /Approve run/ }).click();
      await expect(head.getByRole("button", { name: /Post to|Connect accounting/ }).first()).toBeVisible({ timeout: 30_000 });
      await rec.cap("The second person presses Approve run. Only approved runs can be posted, and you choose which connected system to post to.", { hl: head, min: 2500 });
      // post
      const postBtn = head.getByRole("button", { name: new RegExp(`Post to ${prov.name}`) });
      await expect(postBtn).toBeVisible();
      await rec.cap(`Now press Post to ${prov.name}.`, { step: "Step 8", hl: postBtn, min: 2000 });
      await postBtn.click();
      const toast = page.locator("div.fixed.bottom-5");
      await expect(toast.or(head.getByTestId("acct-posted")).first()).toBeVisible({ timeout: 60_000 });
      expect(await toast.innerText().catch(() => "posted"), "toast after posting").not.toMatch(/⚠/);
      await expect(head.getByTestId("acct-posted")).toBeVisible({ timeout: 30_000 });
      await rec.cap(`Posted. The badge confirms the wages journal is now in ${prov.name}. Pressing the button again never creates a second journal.`, { step: "Success", hl: head.getByTestId("acct-posted"), min: 3500 });
      await rec.card("Wages journal posted", ["Gross wages, employer NI and pension are debited.", "PAYE/NIC, pension payable and net wages are credited.", ...prov.where], prov.spokenDone, { tag: "DONE", min: 7000 });
      // remember the journal id for cleanup
      const st = ((await call("GET", "/api/payroll", tok)).body.runs as any[]).find((r) => r.id === runId);
      journalId = st?.accounting?.journalId ?? "";
      expect(journalId).toBeTruthy();
      const v = page.video()!;
      await ctx.close();
      webm = await v.path();
      finish(rec, webm, path.join(OUT, prov.file));
    } finally {
      await ctx.close().catch(() => {});
      // cleanup, always: journal, run, mapping
      if (!journalId) {
        const st = ((await call("GET", "/api/payroll", tok)).body?.runs as any[] | undefined)?.find((r) => r.id === runId);
        journalId = st?.accounting?.journalId ?? "";
      }
      try {
        if (journalId) {
          if (prov.id === "xero") expect(json(tsx("xeroAdmin.ts", co.tenantId!, "void", journalId)).Status).toBe("VOIDED");
          else expect(json(tsx("qboAdmin.ts", co.tenantId!, "delete", journalId)).deleted).toBeTruthy();
        }
      } finally {
        tsx("docDelete.ts", "payrollRuns", `${co.tenantId}_${runId}`);
        patchDoc("accountingMappings", `${co.tenantId}__${prov.id}`, { mapping: prior });
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  });
}

test("record Sage setup-preview video", async ({ browser }) => {
  test.setTimeout(600_000);
  const { accounts } = loadAccounts();
  const co = accounts.company;
  const tok = (await fbSignIn(co.email)).idToken;
  const conns = (await call("GET", "/api/accounting/connections", tok)).body;
  test.skip(conns?.sage?.connected, "Sage is connected — the preview would misrepresent the account");
  test.skip(!conns?.sage?.configured, "Sage is not configured on this server");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aos-vid-sage-"));
  fs.mkdirSync(OUT, { recursive: true });
  const state = await session(browser, co.email);
  const ctx = await browser.newContext({ storageState: state, viewport: { width: 1440, height: 900 }, recordVideo: { dir, size: { width: 1440, height: 900 } } });
  const page = await ctx.newPage();
  const rec = new Rec(page, dir);
  try {
    await ctx.route(/^https:\/\/(login\.xero\.com|appcenter\.intuit\.com|www\.sageone\.com)\//, (r) => r.fulfill({ contentType: "text/html", body: "<h1>provider sign-in (stubbed)</h1>" }));
    await page.goto("/company/payroll");
    await expect(page.getByRole("button", { name: /Integrations/ })).toBeVisible({ timeout: 60_000 });
    rec.start();
    const TAG = "SETUP PREVIEW";
    await rec.card("Sage Accounting (UK): setup preview", ["Connecting Sage from ActivityOS", "Preview only: no Sage business is linked to this demo account yet, so posting is not shown live."], "Sage Accounting, setup preview. This shows how you will connect Sage. No Sage business is linked to this demo account yet, so the final posting step is described rather than shown.", { tag: TAG, min: 7000 });
    await rec.hideCard();
    await rec.cap("Setup preview. Open Payroll, then the Integrations tab.", { step: TAG });
    await page.getByRole("button", { name: /Integrations/ }).click();
    const card = page.locator('[data-ui="card"]').filter({ has: page.getByText("Sage Business Cloud Accounting", { exact: true }) }).last();
    await expect(card.getByText("Not connected")).toBeVisible({ timeout: 30_000 });
    await rec.cap("Sage shows Not connected. That is the honest starting point for any new account.", { step: TAG, hl: card });
    const popupP = ctx.waitForEvent("page");
    await card.getByRole("button", { name: "Connect" }).click();
    await rec.cap("Press Connect. A Sage window opens, and the button shows Connecting while you finish there.", { step: TAG, hl: card, min: 3000 });
    (await popupP).close().catch(() => {});
    await rec.card("Sage sign-in and consent", ["1. Sign in with your Sage ID.", "2. Choose the Sage Accounting business to connect.", "3. Press Continue to allow ActivityOS to create journals and read your ledger accounts.", "ActivityOS never sees your Sage password."], "A Sage window opens. Sign in with your Sage I D, choose the business, and continue to allow access. ActivityOS never sees your password.", { tag: `${TAG} - ON SAGE'S SITE`, min: 6000 });
    await rec.card("After connecting: the same three steps as Xero", ["Map the six accounts: Gross wages, Employer NI, Employer pension, PAYE/NIC liability, Pension payable, Net wages.", "A second person approves the pay run.", "Press Post to Sage: the wages journal is created in your ledger."], "Once Sage is connected the steps are the same as for Xero. Map the six accounts, have a second person approve the pay run, then press Post to Sage.", { tag: TAG, min: 6000 });
    await rec.card("Still to do before this goes live", ["A Sage Accounting (UK) business to connect and test against.", "Then we will re-record this video with the real journal."], "Before this goes live we need a Sage Accounting business to connect and test against. We will then re-record this video with the real journal.", { tag: TAG, min: 6500 });
    const v = page.video()!;
    await ctx.close();
    finish(rec, await v.path(), path.join(OUT, "sage-preview.mp4"));
  } finally {
    await ctx.close().catch(() => {});
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
