import { test, expect } from "@playwright/test";
import { loadAccounts } from "./helpers/env";
import { fbSignIn } from "./helpers/accounts";
import { API_URL } from "./helpers/env";

// Input validation the company/staff APIs used to skip (P1 sweep): impossible dates/times, absurd amounts, non-web links in link fields,
// malformed ids, bad emails. Each request is REJECTED, so nothing is written and nothing needs cleaning up.
async function call(token: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${API_URL}${path}`, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, text: await res.text() };
}

test("company API refuses impossible dates, times, amounts, links and emails", async () => {
  test.setTimeout(120_000);
  const a = loadAccounts().accounts;
  const co = (await fbSignIn(a.company.email)).idToken as string;
  const staff = (await fbSignIn(a.staff.email)).idToken as string;

  const bad: [string, string, unknown, RegExp][] = [
    ["POST", "/api/expenses", { date: "2026-13-45", category: "x", amount: 5 }, /calendar date/],
    ["POST", "/api/expenses", { date: "2026-02-30", category: "x", amount: 5 }, /calendar date/],
    ["POST", "/api/expenses", { date: "2026-09-30", category: "x", amount: 1e308 }, /less than or equal/],
    ["POST", "/api/expenses", { date: "2026-09-30", category: "x", amount: 5, receiptUrl: "javascript:alert(1)" }, /web addresses/],
    ["POST", "/api/tasks", { t: "x", due: "2026-09-30", time: "zz:99" }, /real time/],
    ["POST", "/api/calendar-events", { title: "x", date: "garbage" }, /calendar date/],
    ["POST", "/api/trips", { destination: "x", date: "soon" }, /calendar date/],
    ["POST", "/api/discounts", { code: "P1VALID500", type: "percent", value: 500 }, /can't exceed 100/],
    ["POST", "/api/customers", { name: "x", email: "not an email" }, /valid email/],
    ["POST", "/api/invoices", { customerName: "x", date: "2026-09-30", customerEmail: "nope" }, /valid email/],
    ["POST", "/api/posts", { body: "x", status: "draft", cta: { label: "Go", url: "javascript:alert(1)" } }, /web addresses/],
    ["POST", "/api/leave/absences", { name: "x", kind: "annual", start: "2026-10-20", end: "2026-10-20", days: 50, status: "pending" }, /More days/],
    ["PUT", "/api/franchises/x/territory", { areas: [{ id: "a", name: "x", color: "red", rings: [{ lat: 999, lng: 0 }] }] }, /less than or equal to 90/],
  ];
  for (const [m, p, body, re] of bad) {
    const r = await call(co, m, p, body);
    expect(r.status, `${m} ${p} ${JSON.stringify(body).slice(0, 60)}`).toBe(400);
    expect(r.text).toMatch(re);
  }

  // A block session can't end before it starts or use a 25:99 clock.
  const listings = JSON.parse((await call(co, "GET", "/api/listings")).text) as { id: string; tenantId: string }[];
  const mine = listings.find((l) => l.tenantId === a.company.tenantId);
  if (mine) {
    const r = await call(co, "POST", "/api/blocks", { listingId: mine.id, name: "P1 bad times", startDate: "2027-03-01", endDate: "2027-03-02", capacity: 5, schedule: { startTime: "15:00", endTime: "09:00" } });
    expect(r.status).toBe(400);
    expect(r.text).toMatch(/endTime must be after startTime/);
  }

  // A staff claim can't carry a javascript: receipt link into the manager's list.
  const claim = await call(staff, "POST", "/api/expense-claims", { date: "2026-09-30", category: "Other", amount: 1, receiptUrl: "javascript:alert(1)" });
  expect(claim.status).toBe(400);

  // Malformed record ids are a plain 404 (used to be a 500 that also raised the ops alarm).
  for (const id of ["a%2Fb", "__proto__", ".."]) {
    const r = await call(co, "PUT", `/api/expenses/${id}`, { amount: 1 });
    expect(r.status, `PUT /api/expenses/${id}`).toBe(404);
  }
});
