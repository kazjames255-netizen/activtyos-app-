import { test, expect } from "@playwright/test";
import { loadAccounts, statePath, type AccountManifest } from "./helpers/env";
import { apiFetch, apiPost, fbSignIn } from "./helpers/accounts";
import { bookViaApi, createParentChild, provisionLiveListing } from "./helpers/tenantData";
import { cardWith } from "./helpers/ui";

// Trips notify-and-consent: the trip is arranged through the operator API
// (the 7-step planner UI has its own life; the consent MACHINERY is what
// this spec pins down), then the parent journey runs through the real UI:
// the bell rings, the Trips & consent view shows the request, one tap gives
// consent, and the server enforces requireConsent on completion.

test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

let accounts: AccountManifest["accounts"];
const childName = `E2E Trip Kid ${stamp}`;
const destination = `E2E Farm Park ${stamp}`;
let tripId: string;

interface Trip {
  id: string;
  attendees?: { n: string; childId?: string; consent?: string; consentRequestedAt?: string }[];
  childIds?: string[];
  consentObtained?: boolean;
  status?: string;
}

test.beforeAll(async () => {
  accounts = loadAccounts().accounts;
  await createParentChild(accounts.parent, { name: childName });
  // The child must hold a booking with this tenant — that's how the server
  // resolves the trip's childNames to childIds (and so to the parent).
  const listing = await provisionLiveListing(accounts.company, { title: `E2E Trip Camp ${stamp}`, price: 0, startToday: true });
  await bookViaApi(accounts.parent, listing, { child: childName, dates: [iso(new Date())] });

  const op = await fbSignIn(accounts.company.email);
  const in7 = new Date(Date.now() + 7 * 86_400_000);
  const trip = await apiPost<Trip>("/api/trips", op.idToken, {
    destination,
    date: iso(in7),
    departTime: "09:30",
    returnTime: "15:00",
    transport: "Minibus",
    childNames: [childName],
    staff: ["E2E Lead"],
    status: "planned",
  });
  tripId = trip.id;

  // Server-side enrichment is the foundation of everything below.
  expect(trip.attendees?.[0]?.childId, "childName should resolve to a childId").toBeTruthy();
  expect(trip.childIds?.length).toBe(1);
});

test.describe("parent consent journey", () => {
  test.use({ storageState: statePath("parent") });

  test("bell rings, consent given through the UI, operator side updates", async ({ page }) => {
    // The consent request must have raised the family's bell — assert the
    // BELL UI itself (badge + entry), not just the API record behind it.
    await page.goto("/custdash/bookings");
    const bell = page.getByRole("button", { name: /^Notifications/ });
    await expect(bell).toBeVisible();
    await bell.click();
    await expect(page.getByText(`Consent needed: ${childName} — trip to ${destination}`)).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press("Escape");

    // Completing before consent must be refused server-side (requireConsent
    // defaults on). apiFetch surfaces the API's error message.
    const op = await fbSignIn(accounts.company.email);
    await expect(
      apiFetch(`/api/trips/${tripId}`, op.idToken, { method: "PUT", body: JSON.stringify({ status: "completed" }) }),
    ).rejects.toThrow(/consent/i);

    // The Trips & consent view: this run's trip card, pending, then one tap.
    await page.goto("/custdash/trips");
    const card = cardWith(page, destination, "Consent needed");
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.getByRole("button", { name: "Give consent" }).click();
    await expect(cardWith(page, destination, "Consent given ✓")).toBeVisible({ timeout: 15_000 });

    // Server state: per-child consent recorded + whole-trip flag flipped,
    // the operator's team bell heard it, and completion now goes through.
    // (The trips API is list-only — no GET /:id.)
    const all = await apiFetch<Trip[]>("/api/trips", op.idToken);
    const after = all.find((t) => t.id === tripId);
    expect(after?.attendees?.[0]?.consent).toBe("granted");
    expect(after?.consentObtained).toBe(true);

    const opBell = await apiFetch<{ notifications: { category: string; title: string; ref?: string }[] }>(
      "/api/notifications",
      op.idToken,
    );
    expect(opBell.notifications.some((n) => n.ref === tripId && /consent given/i.test(n.title))).toBe(true);

    const done = await apiFetch<Trip>(`/api/trips/${tripId}`, op.idToken, {
      method: "PUT",
      body: JSON.stringify({ status: "completed" }),
    });
    expect(done.status).toBe("completed");
  });
});
