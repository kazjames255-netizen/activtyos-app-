import { test, expect } from "@playwright/test";
import { loadAccounts, statePath } from "./helpers/env";
import { apiFetch, apiPost, fbSignIn } from "./helpers/accounts";
import { createParentChild, markParentWelcomed, provisionLiveListing } from "./helpers/tenantData";
import { cardWith, dismissParentWelcome } from "./helpers/ui";

// Parent portal money + guard rules found in the P5 sweep. Everything is anchored to THIS run's children/refs.
//  · Payments / My bookings ask for the BALANCE (part-paid → £20 of £30; a paid booking that released a day → no Pay button; a
//    waitlisted booking owes nothing)
//  · the cancel panel doesn't promise a refund on an unpaid booking
//  · the API guards: trip consent on a cancelled/past trip, meals for a day the child isn't booked, bad DOB, infant age gate,
//    date-change onto a past day.
test.describe.configure({ mode: "serial" });
const stamp = Date.now().toString(36);
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

test.describe("parent money rules", () => {
  test.use({ storageState: statePath("parent") });

  test("balance owed, released-day booking, unpaid cancel wording", async ({ page }) => {
    test.setTimeout(240_000);
    const consoleErrors: string[] = [];
    page.on("console", (m) => { if (m.type() === "error" && /same key/.test(m.text())) consoleErrors.push(m.text()); });
    const acc = loadAccounts().accounts;
    const s = await fbSignIn(acc.parent.email);
    const op = await fbSignIn(acc.company.email);
    await markParentWelcomed(acc.parent);

    // A listing with a 3-day pass (£30) so a day can be released.
    const { ensureVenue } = await import("./helpers/tenantData");
    const venueId = await ensureVenue(acc.company, true);
    const period = await apiPost<{ id: string }>("/api/periods", op.idToken, { title: "Full day", start: "09:00", finish: "15:30" });
    const pass = await apiPost<{ id: string }>("/api/passes", op.idToken, { name: "3 day", days: 3 });
    const bundle = await apiPost<{ id: string }>("/api/block-bundles", op.idToken, { name: `E2E MoneyRules ${stamp}`, periodIds: [period.id], passIds: [pass.id], priced: true, masterPrice: 30, calcOn: true });
    const start = new Date(); start.setDate(start.getDate() + ((8 - start.getDay()) % 7 || 7)); const end = new Date(start); end.setDate(end.getDate() + 11);
    const L = await apiPost<{ id: string }>("/api/listings", op.idToken, { title: `E2E MoneyRules Camp ${stamp}`, venueId, runFrom: iso(start), runTo: iso(end), blockMode: "weekly", days: [1, 2, 3, 4, 5], maxAttendees: "20", capacityScope: "day", showSpaces: true, ageFrom: "5", ageTo: "12", blockId: bundle.id, passes: [{ name: "3 day", price: 30, days: 3 }], bookingType: "auto", status: "live", visibility: "public" });
    await apiFetch(`/api/block-bundles/${bundle.id}/listings`, op.idToken, { method: "PUT", body: JSON.stringify({ listingIds: [L.id] }) });
    const doc = await apiFetch<{ blocks: { id: string; sessions: { date: string }[] }[] }>(`/api/listings/${L.id}`, s.idToken);
    const days = doc.blocks[0].sessions.slice(0, 3).map((x) => x.date);
    const kidRel = `E2E MR Rel ${stamp}`, kidPart = `E2E MR Part ${stamp}`, kidUnpaid = `E2E MR Unpaid ${stamp}`;
    for (const k of [kidRel, kidPart, kidUnpaid]) await createParentChild(acc.parent, { name: k });
    const book = async (child: string) => (await apiPost<{ bookings: { ref: string; amount: number }[] }>("/api/my/bookings", s.idToken, { listingId: L.id, blockId: doc.blocks[0].id, method: "card", items: [{ pass: "3 day", child, age: 8, dates: days }] })).bookings[0];
    const rel = await book(kidRel), part = await book(kidPart), unpaid = await book(kidUnpaid);
    const rec = (ref: string, amount: number) => apiPost(`/api/bookings/${ref}/record-payment`, op.idToken, { amount, method: "Cash" });
    await rec(rel.ref, rel.amount); await rec(part.ref, 10);
    await apiPost(`/api/my/bookings/${rel.ref}/cancel`, s.idToken, { days: [days[2]], resolution: "wallet" });

    await page.goto("/custdash/bookings");
    await dismissParentWelcome(page);
    // My bookings: the released-day (paid) booking has no Pay button; the part-paid one asks for its balance, not the price.
    await expect(cardWith(page, `Ref ${rel.ref}`, "Partially refunded")).toBeVisible({ timeout: 30_000 });
    await expect(cardWith(page, `Ref ${rel.ref}`).getByRole("button", { name: /^Pay £/ })).toHaveCount(0);
    const owedNow = Math.round((part.amount - 10) * 100) / 100;
    await expect(cardWith(page, `Ref ${part.ref}`).getByRole("button", { name: `Pay £${owedNow.toFixed(2)}` })).toBeVisible();

    // My payments: part-paid is listed as owed; released-day is a paid row (receipt), not owed.
    await page.getByRole("button", { name: /My payments/ }).click();
    const owedCard = cardWith(page, "Waiting on payment");
    await expect(owedCard).toContainText(`Ref ${part.ref}`, { timeout: 20_000 });
    await expect(owedCard).not.toContainText(`Ref ${rel.ref}`);
    await expect(cardWith(page, "Paid", `Ref ${rel.ref}`)).toBeVisible();

    // Unpaid booking: the cancel panel must not promise a refund.
    await page.getByRole("button", { name: /My bookings/ }).first().click();
    const uCard = cardWith(page, `Ref ${unpaid.ref}`);
    await uCard.getByRole("button", { name: /Cancel booking/ }).first().click();
    await expect(uCard.getByText("Nothing has been paid on this booking, so there’s nothing to refund.")).toBeVisible({ timeout: 15_000 });
    await expect(uCard.getByText(/entitled to a full refund/)).toHaveCount(0);
    expect(consoleErrors, "duplicate React keys on the parent money screens").toEqual([]);
  });

  test("API guards: trips, meals, DOB, age gate, date change", async () => {
    test.setTimeout(240_000);
    const acc = loadAccounts().accounts;
    const s = await fbSignIn(acc.parent.email);
    const op = await fbSignIn(acc.company.email);
    const call = async (path: string, tok: string, method: string, body?: unknown) => {
      const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}${path}`, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: body ? JSON.stringify(body) : undefined });
      return { status: r.status, j: (await r.json().catch(() => null)) as { id?: string; error?: unknown; bookings?: { ref: string }[] } | null };
    };

    // Bad / future / infant dates of birth
    expect((await call("/api/my/children", s.idToken, "POST", { name: `E2E DOB ${stamp}`, dob: "banana" })).status).toBe(400);
    expect((await call("/api/my/children", s.idToken, "POST", { name: `E2E DOB ${stamp}`, dob: "2099-01-01" })).status).toBe(400);
    const infant = await createParentChild(acc.parent, { name: `E2E Infant ${stamp}`, dob: iso(new Date(Date.now() - 100 * 86400000)) });

    const L = await provisionLiveListing(acc.company, { title: `E2E Guards Camp ${stamp}`, price: 0, maxAttendees: 30, startToday: true });
    const doc = await apiFetch<{ blocks: { id: string; sessions: { date: string }[] }[] }>(`/api/listings/${L.id}`, s.idToken);
    const blockId = doc.blocks[0].id;
    const days = doc.blocks[0].sessions.map((x) => x.date);
    const inf = await call("/api/my/bookings", s.idToken, "POST", { listingId: L.id, blockId, method: "card", items: [{ pass: "Day pass", child: `E2E Infant ${stamp}`, childId: infant, dates: [days[0]] }] });
    expect(inf.status, "an infant (age 0) is outside a 5–12 listing").toBe(400);

    // Trip consent on a cancelled and on a past trip is refused; on an upcoming one it works.
    const kid = `E2E Guard Kid ${stamp}`;
    const kidId = await createParentChild(acc.parent, { name: kid });
    const bk = await call("/api/my/bookings", s.idToken, "POST", { listingId: L.id, blockId, method: "card", items: [{ pass: "Day pass", child: kid, age: 8, dates: [days[0]] }] });
    expect(bk.status).toBe(201);
    const mkTrip = async (status: string, offset: number) => (await call("/api/trips", op.idToken, "POST", { destination: `E2E Guard ${status} ${stamp}`, date: iso(new Date(Date.now() + offset * 86400000)), departTime: "09:00", returnTime: "15:00", transport: "Coach", childNames: [kid], staff: ["x"], status })).j!.id!;
    const tCancelled = await mkTrip("cancelled", 5), tPast = await mkTrip("planned", -3), tOk = await mkTrip("planned", 6);
    expect((await call(`/api/my/trips/${tCancelled}/consent`, s.idToken, "POST", { childId: kidId, decision: "granted" })).status).toBe(409);
    expect((await call(`/api/my/trips/${tPast}/consent`, s.idToken, "POST", { childId: kidId, decision: "granted" })).status).toBe(409);
    expect((await call(`/api/my/trips/${tOk}/consent`, s.idToken, "POST", { childId: kidId, decision: "granted" })).status).toBe(200);
    for (const t of [tCancelled, tPast, tOk]) await call(`/api/trips/${t}`, op.idToken, "DELETE");

    // Meals: only for a day the child holds a place.
    const menu = await call("/api/meal-menus", op.idToken, "POST", { name: `E2E Guard Menu ${stamp}`, items: [{ id: "m1", name: "Pasta", price: 3.5, allergens: [] }] });
    const plan: Record<string, unknown> = {}; for (const d of days) plan[d] = { menuId: menu.j!.id, itemIds: [] };
    await call(`/api/listings/${L.id}`, op.idToken, "PUT", { mealsEnabled: true, mealPlan: plan, mealConfig: { cutoffWhen: "off" } });
    const meal = (date: string) => call("/api/meal-orders", s.idToken, "POST", { tenantId: L.tenantId, listingId: L.id, date, childName: kid, items: [{ menuItemId: "m1", qty: 1 }] });
    const okMeal = await meal(days[0]);
    expect(okMeal.status).toBe(201);
    expect((await meal(days[days.length - 1])).status, "a meal for a day the child isn't booked").toBe(409);
    if (okMeal.j?.id) await call(`/api/meal-orders/${okMeal.j.id}/cancel`, s.idToken, "POST", {});
    await call(`/api/meal-menus/${menu.j!.id}`, op.idToken, "DELETE");

    // Date change onto a past day is refused.
    const ref = bk.j!.bookings![0].ref;
    expect((await call(`/api/my/bookings/${ref}/amend`, s.idToken, "POST", { moves: [{ from: days[0], to: "2020-01-06" }] })).status).toBe(400);
    await call(`/api/my/bookings/${ref}/cancel`, s.idToken, "POST", {});
  });
});
