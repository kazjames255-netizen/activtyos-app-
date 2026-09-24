import type { Locator, Page } from "@playwright/test";

// The tutor / operator hub groups its tabs: seven top tabs (Home, Lessons, Students, Progress, Quizzes, Homework, Messages) with a
// sub-tab row under most of them (features/learninghub/tabGroups.ts). Specs still think in the OLD tab names ("Live lessons",
// "Starting quizzes", "Set homework"…), so `openTab` takes an old name (RegExp or string), clicks the right top tab and then the
// right sub-tab (the side card at desktop width, the pill row under the top strip elsewhere; both are role=tab with data-sub). Parents and children keep the flat strip: with no `[data-top]` tab on the page it just clicks the tab by name.

interface Entry { top: string; sub: string | null; labels: string[] }
// First match wins; order matters where a looser regexp could hit two labels.
const MAP: Entry[] = [
  { top: "home", sub: null, labels: ["Home"] },
  { top: "lessons", sub: "lessons", labels: ["Lessons & curriculum", "Lessons"] },
  { top: "lessons", sub: "live", labels: ["Live lessons"] },
  { top: "lessons", sub: "schedule", labels: ["Schedule video lesson"] },
  { top: "lessons", sub: "teach", labels: ["Teach in person"] },
  { top: "lessons", sub: "tools", labels: ["Tools"] },
  { top: "lessons", sub: "flashcards", labels: ["Flashcards"] },
  { top: "students", sub: "students", labels: ["Students"] },
  { top: "students", sub: "enrol", labels: ["Enrol a student", "Enrol student"] },
  { top: "progress", sub: null, labels: ["Progress"] },
  { top: "quizzes", sub: "quizzes", labels: ["Quizzes"] },
  { top: "quizzes", sub: "starting", labels: ["Starting quizzes", "Placement test"] },
  { top: "quizzes", sub: "newquiz", labels: ["New quiz"] },
  { top: "homework", sub: "mark", labels: ["Homework", "To mark"] },
  { top: "homework", sub: "inbox", labels: ["Inbox"] },
  { top: "homework", sub: "set", labels: ["Set homework"] },
  { top: "messages", sub: null, labels: ["Messages", "Student message centre"] },
];

const matches = (name: RegExp | string, label: string) => (typeof name === "string" ? label.toLowerCase().includes(name.toLowerCase()) : new RegExp(name.source, name.flags.replace(/[gy]/g, "")).test(label));
/** The tab an old name means: the sub-tab when both a top tab and a sub-tab carry it (e.g. Quizzes). */
export const tabOf = (page: Page, name: RegExp | string): Locator => page.getByRole("tab", { name }).last();

/** Open the hub tab the OLD strip called `name`: top tab, then sub-tab. Works unchanged for a parent / child's flat strip. */
export async function openTab(page: Page, name: RegExp | string): Promise<void> {
  await page.getByRole("tab").first().waitFor({ state: "visible", timeout: 30_000 });
  const grouped = (await page.locator('[role="tab"][data-top]').count()) > 0;
  const e = grouped ? MAP.find((m) => m.labels.some((l) => matches(name, l))) : undefined;
  if (!e) { await tabOf(page, name).click(); return; }
  if (!e.sub) { await page.locator(`[role="tab"][data-top="${e.top}"]`).click(); return; }
  const sub = page.locator(`[role="tab"][data-sub="${e.sub}"]`);
  if (!(await sub.isVisible().catch(() => false))) {
    await page.locator(`[role="tab"][data-top="${e.top}"]`).click();
    await sub.waitFor({ state: "visible", timeout: 15_000 });
  }
  await sub.click();
}
