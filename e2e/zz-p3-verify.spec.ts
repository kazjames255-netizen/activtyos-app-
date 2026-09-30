import { test, expect } from "@playwright/test";
import { loadAccounts, API_URL } from "./helpers/env";
import { fbSignIn } from "./helpers/accounts";

// P3 (freelancer) live verification of the local money/tasks/discounts commits. Every row is tagged P3V and deleted at the end.
test("freelancer API: monthly repeat, date validation, clears, 409 rename, invoice VAT", async () => {
  test.setTimeout(180_000);
  const fl = (await fbSignIn(loadAccounts().accounts.freelancer.email)).idToken as string;
  const call = async (m: string, p: string, body?: unknown) => {
    const r = await fetch(`${API_URL}${p}`, { method: m, headers: { "Content-Type": "application/json", Authorization: `Bearer ${fl}` }, body: body === undefined ? undefined : JSON.stringify(body) });
    const t = await r.text(); let j: any = null; try { j = JSON.parse(t); } catch { /* */ }
    return { status: r.status, j, t };
  };
  const cleanup: (() => Promise<unknown>)[] = [];
  try {
    // monthly repeat: purchasing
    const po = await call("POST", "/api/purchasing", { supplier: "P3V Supplier", date: "2027-01-31", repeat: "monthly", repeatUntil: "2027-05-31", lineItems: [{ description: "x", qty: 1, unitPrice: 10 }] });
    expect(po.status).toBe(201);
    cleanup.push(() => call("DELETE", `/api/purchasing/series/${po.j.seriesId}`));
    expect(po.j.items.map((i: any) => i.date)).toEqual(["2027-01-31", "2027-02-28", "2027-03-31", "2027-04-30", "2027-05-31"]);
    // tasks monthly
    const tk = await call("POST", "/api/tasks", { t: "P3V monthly", due: "2027-01-31", repeat: { freq: "monthly", until: "2027-04-30" } });
    expect(tk.status).toBe(201);
    const all = await call("GET", "/api/tasks");
    const series = (all.j as any[]).filter((t) => t.seriesId === tk.j.seriesId).map((t) => t.due).sort();
    cleanup.push(() => call("DELETE", `/api/tasks/series/${tk.j.seriesId}`));
    expect(series).toEqual(["2027-01-31", "2027-02-28", "2027-03-31", "2027-04-30"]);
    // date validation
    for (const [p, b] of [["/api/expenses", { date: "2026-02-30", category: "x", amount: 1 }], ["/api/expenses", { date: "26-1-1", category: "x", amount: 1 }], ["/api/income", { date: "nope", category: "x", amount: 1 }], ["/api/invoices", { customerName: "P3V", date: "2026-13-01" }], ["/api/purchasing", { supplier: "P3V", date: "2026-09-31" }], ["/api/tasks", { t: "P3V", due: "2026-02-30" }]] as const) {
      const r = await call("POST", p, b); expect(r.status, `${p} ${JSON.stringify(b)}`).toBe(400);
    }
    // expense clears
    const ex = await call("POST", "/api/expenses", { date: "2026-09-01", category: "P3V", amount: 5, supplier: "S", notes: "N", status: "pending", dueDate: "2026-09-20" });
    expect(ex.status).toBe(201); cleanup.push(() => call("DELETE", `/api/expenses/${ex.j.id}`));
    const ex2 = await call("PUT", `/api/expenses/${ex.j.id}`, { supplier: null, notes: null, dueDate: null });
    expect(ex2.status).toBe(200);
    const exl = await call("GET", "/api/expenses"); const row = (exl.j.items ?? exl.j).find((e: any) => e.id === ex.j.id);
    expect(row.supplier).toBeFalsy(); expect(row.notes).toBeFalsy(); expect(row.dueDate).toBeFalsy(); expect(row.category).toBe("P3V");
    // PO clears
    const po1 = await call("POST", "/api/purchasing", { supplier: "P3V2", date: "2026-09-01", reference: "REF1", dueDate: "2026-09-10", amount: 10 });
    cleanup.push(() => call("DELETE", `/api/purchasing/${po1.j.id}`));
    const po2 = await call("PUT", `/api/purchasing/${po1.j.id}`, { reference: null, dueDate: null });
    expect(po2.status).toBe(200); expect(po2.j.reference).toBeFalsy(); expect(po2.j.dueDate).toBeFalsy(); expect(po2.j.supplier).toBe("P3V2");
    // income clear
    const inc = await call("POST", "/api/income", { date: "2026-09-01", category: "P3V", amount: 5, source: "src", notes: "n" });
    cleanup.push(() => call("DELETE", `/api/income/${inc.j.id}`));
    const inc2 = await call("PUT", `/api/income/${inc.j.id}`, { source: null });
    expect(inc2.status).toBe(200); expect(inc2.j.source).toBeFalsy(); expect(inc2.j.notes).toBe("n");
    // invoice VAT
    const inv = await call("POST", "/api/invoices", { customerName: "P3V", date: "2026-09-01", taxRate: 20, lineItems: [{ description: "a", qty: 2, unitPrice: 50 }] });
    expect(inv.status).toBe(201); expect(inv.j.amount).toBe(120); cleanup.push(() => call("DELETE", `/api/invoices/${inv.j.id}`));
    const i2 = await call("PUT", `/api/invoices/${inv.j.id}`, { lineItems: [{ description: "a", qty: 3, unitPrice: 50 }] });
    expect(i2.j.amount).toBe(180); // VAT kept
    const i3 = await call("PUT", `/api/invoices/${inv.j.id}`, { taxRate: 10 });
    expect(i3.j.amount).toBe(165);
    const i4 = await call("PUT", `/api/invoices/${inv.j.id}`, { taxRate: null });
    expect(i4.j.amount).toBe(150); expect(i4.j.taxRate).toBeFalsy();
    // amount-only invoice (no lines): rate change must not compound onto a gross amount
    const inv2 = await call("POST", "/api/invoices", { customerName: "P3V", date: "2026-09-01", taxRate: 20, amount: 100 });
    cleanup.push(() => call("DELETE", `/api/invoices/${inv2.j.id}`));
    expect(inv2.j.amount).toBe(120);
    const j2 = await call("PUT", `/api/invoices/${inv2.j.id}`, { taxRate: 10 });
    console.log("amount-only invoice 120@20% -> rate 10 gives", j2.j.amount);
    expect(j2.j.amount).toBe(110);
    // discounts
    const c1 = await call("POST", "/api/discounts", { code: "P3VAAA", type: "amount", value: 5, expiry: "2030-01-01", usageLimit: 10, minSpend: 20 });
    expect(c1.status).toBe(201); cleanup.push(() => call("DELETE", `/api/discounts/${c1.j.id}`));
    const c2 = await call("POST", "/api/discounts", { code: "P3VBBB", type: "amount", value: 5 });
    cleanup.push(() => call("DELETE", `/api/discounts/${c2.j.id}`));
    const cl = await call("PUT", `/api/discounts/${c1.j.id}`, { expiry: null, usageLimit: null, minSpend: null });
    expect(cl.status).toBe(200);
    const list = await call("GET", "/api/discounts"); const dc = (list.j.items ?? list.j).find((d: any) => d.id === c1.j.id);
    expect(dc.expiry).toBeFalsy(); expect(dc.usageLimit).toBeFalsy(); expect(dc.minSpend).toBeFalsy(); expect(dc.value).toBe(5);
    expect((await call("PUT", `/api/discounts/${c1.j.id}`, { code: "P3VBBB" })).status).toBe(409);
    expect((await call("PUT", `/api/discounts/${c1.j.id}`, { code: "p3vaaa" })).status).toBe(200); // same name (case) is fine
    expect((await call("PUT", `/api/discounts/${c1.j.id}`, { type: "percent", value: 500 })).status).toBe(400);
    expect((await call("POST", "/api/discounts", { code: "P3VAAA", type: "amount", value: 1 })).status).toBe(409);
  } finally {
    for (const f of cleanup.reverse()) await f().catch(() => null);
  }
});
