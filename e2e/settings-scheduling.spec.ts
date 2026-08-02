import { test, expect } from "@playwright/test";
import { loadAccounts, statePath, type AccountManifest } from "./helpers/env";
import { provisionLiveListing } from "./helpers/tenantData";

// Settings that silently shape the customer experience, and the scheduling
// tools (timetable → staff, rota → staff, ratio groups → ratios board).

test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
let accounts: AccountManifest["accounts"];

test.beforeAll(async () => {
  accounts = loadAccounts().accounts;
});

test.describe("setup reaches the parent checkout", () => {
  test.use({ storageState: statePath("company") });

  test("custom child question + gender toggle change the checkout form", async ({ page, browser }) => {
    test.setTimeout(150_000);
    const question = `Can your child swim 25m? E2E ${stamp}`;
    const listing = await provisionLiveListing(accounts.company, { title: `E2E Setup Camp ${stamp}`, price: 0 });

    await page.goto("/company/setup?tab=people");
    await expect(page.getByText("What you collect about every child")).toBeVisible({ timeout: 15_000 });

    // Add a custom question (autosave — wait for the Saved stamp).
    await page.getByRole("button", { name: /Add a question/ }).click();
    await page.getByPlaceholder("e.g. Can your child swim 25m?").fill(question);
    await expect(page.getByText(/^Saved \d{2}:\d{2}$/)).toBeVisible({ timeout: 15_000 });

    // Turn "Ask a child's gender" OFF (row-scoped so no other toggle is hit).
    const genderRow = page
      .locator("div")
      .filter({ has: page.getByText("Ask a child's gender", { exact: true }) })
      .filter({ has: page.getByRole("button", { name: "Off", exact: true }) })
      .last();
    await genderRow.getByRole("button", { name: "Off", exact: true }).click();
    await expect(page.getByText(/^Saved \d{2}:\d{2}$/)).toBeVisible({ timeout: 15_000 });

    // Parent checkout: the question appears, Boy/Girl is gone.
    const parentCtx = await browser.newContext({ storageState: statePath("parent") });
    const pp = await parentCtx.newPage();
    try {
      await pp.goto(`/book/${listing.id}`);
      await pp.getByRole("button", { name: /Day pass · £/ }).first().click();
      const timing = pp.getByText(/choose a timing/i);
      if (await timing.isVisible().catch(() => false)) await pp.getByRole("button", { name: /Full day/ }).first().click();
      await pp.getByRole("button", { name: /^(Mon|Tue|Wed|Thu|Fri) \d+$/ }).first().click();
      await pp.getByRole("button", { name: /Add .* to basket/ }).click();
      await pp.getByRole("button", { name: /Next — add children/ }).click();
      await pp.getByRole("button", { name: /Add a new child/ }).click();

      await expect(pp.getByText(question).first()).toBeVisible({ timeout: 15_000 });
      await expect(pp.getByText("Boy or girl?")).toBeHidden();
    } finally {
      await parentCtx.close();
      // Restore defaults for other specs: gender back ON (row-scoped)…
      await genderRow.getByRole("button", { name: "On", exact: true }).click().catch(() => {});
      // …and delete the question. Its editor auto-opened on creation and the
      // operator page never navigated, so the page's ONLY Delete button is
      // inside our question's editor.
      page.on("dialog", (d) => d.accept());
      await page.getByRole("button", { name: "Delete", exact: true }).click().catch(() => {});
      await expect(page.getByText(/^Saved \d{2}:\d{2}$/)).toBeVisible({ timeout: 15_000 });
    }
  });
});

test.describe("timetable publish reaches staff", () => {
  test.use({ storageState: statePath("company") });

  test("build a manual day plan and publish to the staff portal", async ({ page, browser }) => {
    test.setTimeout(150_000);
    await page.goto("/company/timetable");
    await expect(page.getByText("Activity timetable builder")).toBeVisible({ timeout: 15_000 });

    // Step 1: pick our first listing — dates flow in and a draft auto-saves.
    await page.locator("select").first().selectOption({ index: 1 });
    await expect(page.getByText(/Pulled from listing|Dates edited/)).toBeVisible({ timeout: 15_000 });

    // Step 7: manual build → grid. Anchored to end-of-name: the rebuilt
    // timetable page added a "Builder" tab button that a bare /Build/ also hits.
    await page.getByRole("button", { name: /^\d*\s*Build$/ }).click();
    await page.getByRole("button", { name: /Manual →/ }).click();

    // Type one activity into the first empty cell (a clickable div, not a
    // button). Stamp-unique: it's the proof on the staff side that THIS
    // publish arrived, not a week left by an earlier run.
    const activity = `E2E Dodgeball ${stamp}`;
    await page.getByText("+", { exact: true }).first().click();
    await page.getByPlaceholder("Type activity…").fill(activity);
    await page.getByRole("button", { name: "Done", exact: true }).click();

    // Publish. The audience rows are TOGGLES with no readable state, and a
    // draft can arrive with staff off (share state persists per draft) — so
    // publish, read the status text, and only flip the row when it proves
    // staff is off.
    await page.getByRole("button", { name: /Publish →/ }).click();
    await page.getByRole("button", { name: "Publish timetable" }).click();
    const published = page.getByText(/Published ✓/);
    const needPick = page.getByText(/pick at least one audience/);
    await expect(published.or(needPick)).toBeVisible({ timeout: 45_000 });
    const staffVisible = page.getByText(/Visible to:.*Staff portal/);
    if (!(await staffVisible.isVisible().catch(() => false))) {
      await page.getByText("Publish to the Staff portal", { exact: true }).click();
      await page.getByRole("button", { name: "Publish timetable" }).click();
      await expect(staffVisible).toBeVisible({ timeout: 45_000 });
    }

    // Staff portal sees THIS run's published plan — the unique activity name,
    // not just "some published week" (an old run's week also renders a grid).
    const staffCtx = await browser.newContext({ storageState: statePath("staff") });
    const sp = await staffCtx.newPage();
    await sp.goto("/staff/timetable");
    await expect(sp.getByText("Nothing published yet", { exact: false })).toBeHidden({ timeout: 15_000 });
    await expect(sp.getByText(activity).first()).toBeVisible({ timeout: 15_000 });
    await staffCtx.close();
  });
});

test.describe("rota reaches staff read-only", () => {
  test.use({ storageState: statePath("franchise") });

  test("franchise adds a shift; staff see it without edit controls", async ({ page, browser }) => {
    const staffName = `E2E Steward ${stamp}`;
    await page.goto("/franchise/schedule");
    await expect(page.getByRole("heading", { name: "Schedule & rota" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /Add a shift/ }).click();
    const form = page.locator("div").filter({ has: page.getByText("Add a shift", { exact: true }) }).filter({ has: page.getByRole("button", { name: "Save shift" }) }).last();
    await form.locator("input").first().fill(staffName);
    await page.getByRole("button", { name: "Save shift" }).click();
    await expect(page.getByText(staffName).first()).toBeVisible({ timeout: 15_000 });

    const staffCtx = await browser.newContext({ storageState: statePath("staff") });
    const sp = await staffCtx.newPage();
    await sp.goto("/staff/schedule");
    await expect(sp.getByText(staffName).first()).toBeVisible({ timeout: 15_000 });
    // Read-only for staff: no add button, no delete ×.
    await expect(sp.getByRole("button", { name: /Add a shift/ })).toBeHidden();
    await staffCtx.close();
  });
});

test.describe("ratio groups flow from Setup to the Ratios board", () => {
  test.use({ storageState: statePath("company") });

  test("group added in Setup shows on the Ratios policy table", async ({ page }) => {
    const groupName = `E2E Group ${stamp}`;
    await page.goto("/company/setup?tab=groups");
    await expect(page.getByText("Age groups & rooms").first()).toBeVisible({ timeout: 15_000 });
    const startStandard = page.getByRole("button", { name: "Start from the standard groups" });
    if (await startStandard.isVisible().catch(() => false)) await startStandard.click();
    await page.getByRole("button", { name: /Add group/ }).click();
    await page.getByPlaceholder("Group name").last().fill(groupName);
    // The Saved stamp may already be showing from the row-add — blur, let the
    // debounced autosave flush, and prove persistence with a reload.
    await page.keyboard.press("Tab");
    await page.waitForTimeout(2_500);
    await page.reload();
    await expect(page.locator(`input[value="${groupName}"]`)).toBeVisible({ timeout: 15_000 });

    await page.goto("/company/ratios");
    await expect(page.getByText("Your ratio policy").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(groupName).first()).toBeVisible();
  });
});
