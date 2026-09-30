import { test, expect, type Page } from "@playwright/test";
import { loadAccounts, statePath, API_URL } from "./helpers/env";
import { fbSignIn } from "./helpers/accounts";

// Head-office Finance (a company with franchises, viewing "all franchises"): Money out must total what has actually been PAID up to today —
// not a Pending bill, and not the future rows of a recurring expense (which are created up front). "Outstanding" invoices are the SENT
// unpaid ones (a draft was never issued, a cancelled one is not owed).
test.use({ storageState: statePath("company") });

const num = (s: string) => Number(s.replace(/[^0-9.-]/g, ""));
async function kpi(page: Page, label: string): Promise<number> {
  const el = page.getByText(label, { exact: true }).first().locator("xpath=following-sibling::div[1]");
  await expect(el).toBeVisible({ timeout: 60_000 });
  return num((await el.innerText()).trim());
}

test("HO finance totals only money that has moved, and owed = sent invoices", async ({ page }) => {
  test.setTimeout(240_000);
  const a = loadAccounts().accounts;
  const tok = (await fbSignIn(a.company.email)).idToken as string;
  const api = async (method: string, path: string, body?: unknown) => {
    const r = await fetch(`${API_URL}${path}`, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await r.text();
    if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${text.slice(0, 200)}`);
    return text ? JSON.parse(text) : {};
  };
  const d = new Date();
  const p2 = (n: number) => String(n).padStart(2, "0");
  const today = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
  const inTwoYears = `${d.getFullYear() + 2}-01-15`;

  await page.goto("/company/finance");
  const outBefore = await kpi(page, "Money out (own)");
  const inBefore = await kpi(page, "Money in (own)");

  const expenseIds: string[] = [];
  const incomeIds: string[] = [];
  const invoiceIds: string[] = [];
  try {
    expenseIds.push((await api("POST", "/api/expenses", { date: today, category: "P1fin", amount: 37, status: "paid" })).id);
    expenseIds.push((await api("POST", "/api/expenses", { date: today, category: "P1fin", amount: 61, status: "pending" })).id);
    // Monthly from today for three months: only today's row has happened.
    const series = await api("POST", "/api/expenses", { date: today, category: "P1fin", amount: 100, status: "paid", repeat: "monthly", repeatUntil: `${d.getFullYear() + 1}-${p2(d.getMonth() + 1)}-01` });
    for (const it of series.items ?? []) expenseIds.push(it.id);
    const inc = await api("POST", "/api/income", { date: today, category: "P1fin", amount: 20, repeat: "monthly", repeatUntil: `${d.getFullYear() + 1}-${p2(d.getMonth() + 1)}-01` });
    for (const it of inc.items ?? []) incomeIds.push(it.id);
    if (inc.id) incomeIds.push(inc.id);
    invoiceIds.push((await api("POST", "/api/invoices", { customerName: "P1 draft", date: today, amount: 20, status: "draft" })).id);
    invoiceIds.push((await api("POST", "/api/invoices", { customerName: "P1 cancelled", date: today, amount: 30, status: "cancelled" })).id);
    const outstandingBefore = 0;
    invoiceIds.push((await api("POST", "/api/invoices", { customerName: "P1 sent", date: today, amount: 40, status: "sent" })).id);
    void outstandingBefore; void inTwoYears;

    await page.reload();
    // The KPI tiles render as £0 before the ledgers arrive, so poll until they settle (a wrong total never converges on the right delta).
    await expect.poll(async () => (await kpi(page, "Money out (own)")) - outBefore, { timeout: 45_000, message: "paid £37 + today's £100 only (not the £61 pending, not the future months)" }).toBe(137);
    await expect.poll(async () => (await kpi(page, "Money in (own)")) - inBefore, { timeout: 45_000, message: "today's £20 only (not the future months)" }).toBe(20);

    // Overview 'Outstanding' shows sent-and-unpaid only.
    const outstanding = page.getByText("Outstanding", { exact: true }).first().locator("xpath=following-sibling::div[1]");
    await expect(outstanding).toBeVisible();
    const invs = await api("GET", "/api/invoices");
    const sentTotal = (invs.items as { status: string; amount: number }[]).filter((i) => i.status === "sent").reduce((s, i) => s + i.amount, 0);
    await expect.poll(async () => Math.round(num((await outstanding.innerText()).trim())), { timeout: 45_000 }).toBe(Math.round(sentTotal));
  } finally {
    for (const id of expenseIds) await api("DELETE", `/api/expenses/${id}`).catch(() => {});
    for (const id of incomeIds) await api("DELETE", `/api/income/${id}`).catch(() => {});
    for (const id of invoiceIds) await api("DELETE", `/api/invoices/${id}`).catch(() => {});
  }
});
