import fs from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { test, type Page } from "@playwright/test";
import { ROOT } from "../helpers/env";
import { apiFetch, apiPost, fbSignIn } from "../helpers/accounts";
import { createParentChild } from "../helpers/tenantData";
import { seedOakLesson } from "../helpers/lessonFixture";
import { buildFixture, ensureFixture, ctxFor, gotoHubPage, handOver, settle, HUB, type Fx } from "./fixture";

// Captures the REAL screens that the Teaching Hub "How it works" explainers animate. Throwaway @activityos-test.com accounts only
// (built by e2e/review/fixture.ts); nothing is emailed; the family invite created here is never claimed.
// Raw PNGs land in scratch/hiw-raw; `node scripts/hiw-optimise.mjs` turns them into public/how-it-works/*.webp.
//   scripts/e2e-locked.sh e2e/review/how-it-works-shots.spec.ts            (all)      |  add  -g "t-enrol"  for one recipe
// The fixture is cached in scratch/hiw-fx.json and reused while its data is still alive.
const OUT = path.join(ROOT, process.env.HIW_OUT ?? "scratch/hiw-raw");           // HIW_OUT / HIW_FX let a run keep its own captures and fixture (isolated from other agents)
const FXF = path.join(ROOT, process.env.HIW_FX ?? "scratch/hiw-fx.json");
test.use({ actionTimeout: 20_000 });
test.describe.configure({ retries: 2 });   // a capture is retried in the same run (same data) if the dev stack hiccups
interface Extra { quizId?: string; fx: Fx; miaId: string; miaName: string; sciTopicId: string; noteId: string; noteTitle: string; inviteToken: string; year1Kid: string }
let X: Extra = fs.existsSync(FXF) ? (JSON.parse(fs.readFileSync(FXF, "utf8")) as Extra) : (undefined as unknown as Extra); // cached fixture, so a single recipe can run with -g

test("00 fixture", async ({ browser }) => {
  test.setTimeout(900_000);
  fs.mkdirSync(OUT, { recursive: true });
  if (process.env.HIW_REUSE_FIXTURE === "1" && fs.existsSync(FXF)) {
    try {
      const saved = JSON.parse(fs.readFileSync(FXF, "utf8")) as Extra;
      const fx = await ensureFixture(browser, saved.fx, 3, true);
      if (fx === saved.fx) { X = saved; return; }
    } catch { /* rebuild */ }
  }
  const fx = await buildFixture(3, true, browser);
  const t = (await fbSignIn(fx.accounts.freelancer.email)).idToken;
  const stamp = Date.now().toString(36);
  // a child who has BOOKED but is not enrolled yet (so the Enrol dialog shows a real Enrol button)
  const miaName = "Mia" + stamp.slice(-4);
  const miaId = await createParentChild(fx.accounts.parent, { name: miaName, dob: "2018-03-01" });
  // a science lesson (Oak-shaped) the kids are enrolled in, with a homework that points at it
  const subject = "Science";
  await apiPost(`${HUB}/topics`, t, { subject, topic: "The nervous system" });
  const topics = await apiFetch<{ id: string; subject: string }[]>(`${HUB}/topics`, t);
  const sciTopicId = topics.find((x) => x.subject === subject)!.id;
  const lesson = await seedOakLesson(t, { stamp: "", subject, topicId: sciTopicId, widget: "neurone" });
  for (const k of fx.kids) {
    const cur = (await apiFetch<{ childId: string; subjects: string[] }[]>(`${HUB}/students`, t)).find((s) => s.childId === k.id);
    await apiFetch(`${HUB}/students/${k.id}`, t, { method: "PUT", body: JSON.stringify({ subjects: [...(cur?.subjects ?? []), subject] }) });
  }
  await apiFetch(`${HUB}/students/${fx.kids[1].id}`, t, { method: "PUT", body: JSON.stringify({ yearGroup: "Year 1" }) });
  // the lesson gets a worksheet (PDF + interactive version), exactly what the bulk loader leaves behind, so the worksheet picker has a real row
  execFileSync("npx", ["tsx", path.join(ROOT, "e2e/helpers/seedWorksheet.ts"), fx.tenantId, lesson.noteId, lesson.quizId], { cwd: path.join(ROOT, "server"), stdio: "pipe" });
  const nn = await apiFetch<{ topicId: string; title: string; body: string }>(`/api/learning-hub/notes/${lesson.noteId}?tenantId=${fx.tenantId}`, t);
  await apiFetch(`/api/learning-hub/notes/${lesson.noteId}?tenantId=${fx.tenantId}`, t, { method: "PUT", body: JSON.stringify({ topicId: nn.topicId, title: nn.title, body: nn.body ?? "", published: true }) });
  await apiPost(`${HUB}/homework`, t, { title: "Do the worksheet", instructions: "Do the worksheet on screen, then have a go at question 5 in your book.", assignedChildIds: fx.kids.map((k) => k.id), worksheetNoteIds: [lesson.noteId], dueAt: new Date(Date.now() + 3 * 86_400_000).toISOString() });
  await apiPost(`${HUB}/homework`, t, { title: "Read about neurones", instructions: "Have a go at the lesson, then the quiz at the end.", assignedChildIds: fx.kids.map((k) => k.id), noteIds: [lesson.noteId], dueAt: new Date(Date.now() + 2 * 86_400_000).toISOString() });
  const inv = await apiPost<{ token: string }>(`${HUB}/family-invites`, t, { forName: "The Patel family" });
  X = { quizId: lesson.quizId, fx, miaId, miaName, sciTopicId, noteId: lesson.noteId, noteTitle: lesson.title, inviteToken: inv.token, year1Kid: fx.kids[1].id };
  fs.writeFileSync(FXF, JSON.stringify(X, null, 1));
});

test("01 mia has booked (not enrolled)", async () => {
  test.setTimeout(300_000);
  const t = (await fbSignIn(X.fx.accounts.freelancer.email)).idToken;
  const p = (await fbSignIn(X.fx.accounts.parent.email)).idToken;
  const seen = async () => (await apiFetch<{ name: string }[]>("/api/children/lookup", t)).some((c) => c.name === X.miaName);
  if (await seen()) return;
  const listings = await apiFetch<{ id: string; title: string; tenantId?: string }[]>("/api/listings", t);
  const l = listings.find((x) => /E2E Review Tuition/.test(x.title) && (!x.tenantId || x.tenantId === X.fx.tenantId))!;
  const doc = await apiFetch<{ blocks: { id: string; startDate: string; endDate: string }[] }>(`/api/listings/${l.id}`, p);
  let last = "";
  for (const b of doc.blocks) for (let d = new Date(b.endDate + "T12:00:00"), n = 0; n < 14; d.setDate(d.getDate() - 1), n++) {
    if (d.getDay() < 1 || d.getDay() > 5) continue;
    const day = d.toISOString().slice(0, 10);
    if (day < b.startDate) break;
    try { await apiPost("/api/my/bookings", p, { listingId: l.id, blockId: b.id, method: "card", items: [{ pass: "Day pass", child: X.miaName, age: 8, dates: [day] }] }); if (await seen()) return; } catch (e) { last = String(e).slice(0, 200); }
  }
  throw new Error("could not book Mia: " + last);
});

const TOOL_QUIZ = "Measure the angle";
test("02 quiz with a tool question", async () => {
  test.setTimeout(300_000);
  const t = (await fbSignIn(X.fx.accounts.freelancer.email)).idToken;
  const list = await apiFetch<{ title: string }[]>(`${HUB}/assessments`, t);
  if (list.some((a) => a.title === TOOL_QUIZ)) return;
  const topics = await apiFetch<{ id: string; subject: string }[]>(`${HUB}/topics`, t);
  const topic = topics.find((x) => /^Maths [a-z0-9]{6,}$/.test(x.subject)) ?? topics.find((x) => /^Maths/.test(x.subject))!;   // the fixture's own Maths subject: the children are enrolled in it, so they see the quiz
  const q = await apiPost<{ id: string }>(`${HUB}/questions`, t, { topicId: topic.id, kind: "short", prompt: "Use a protractor to measure the size of the angle in the triangle.", answer: "60", marks: 1 });
  await apiPost(`${HUB}/assessments`, t, { type: "quiz", title: TOOL_QUIZ, subject: topic.subject, topicIds: [topic.id], questionIds: [q.id], timeLimitMins: null, passMarkPct: 50, published: true, retakePolicy: "unlimited" });
});

// Friendly names on screen: strip the run stamps, hide the dev badge. Screen-only; never touches the data.
const SCRUB = () => {
  const rules: [RegExp, string][] = [
    [/\b(Ava|Ben|Cora|Dev|Ella|Finn|Gia|Hugo|Mia)[a-z0-9]{4,9}\b/g, "$1"],
    [/E2E? ?Freelancer?\s+\w+/gi, "Bright Minds Tutoring"],
    [/\b(Maths|English|Fractions quiz|Fractions sheet|Live fractions|Overdue reading|Reading|Quiz homework|Placement|Year 3-5|Year 6-8|E2E Review Tuition|Review question \d|Neurones and synapses)\s+[a-z0-9]{7,9}\b/g, "$1"],
  ];
  const fix = (n: Node) => { const v = n.nodeValue; if (!v) return; let o = v; for (const [re, to] of rules) o = o.replace(re, to); if (o !== v) n.nodeValue = o; };
  const walk = (root: Node) => { const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n: Node | null; while ((n = w.nextNode())) fix(n); };
  const go = () => { document.head || document.documentElement; const st = document.createElement("style"); st.textContent = "nextjs-portal,[data-nextjs-toast],[data-nextjs-dev-tools-button]{display:none!important}"; document.documentElement.appendChild(st); walk(document.body); new MutationObserver((ms) => ms.forEach((m) => { m.addedNodes.forEach((a) => walk(a)); if (m.type === "characterData") fix(m.target); })).observe(document.body, { childList: true, subtree: true, characterData: true }); };
  if (document.body) go(); else document.addEventListener("DOMContentLoaded", go);
};
// Every capture also records where the interesting elements are (percent of the viewport), so the explainers can ring / zoom /
// point at the REAL element instead of a hand-placed guess:  <name>.rects.json  (label, testid, tag, x, y, w, h).
const RECTS = () => {
  const vw = innerWidth, vh = innerHeight, out: { t: string; id: string; tag: string; role: string; x: number; y: number; w: number; h: number }[] = [];
  const sel = "button,a[href],[role=tab],[role=button],[role=dialog],[role=menuitem],[role=menu],[role=option],[role=radio],[role=tablist],[role=group],nav,section,header,form,ul,table,input,textarea,select,h1,h2,h3,summary,label,[data-testid],[data-ui=card],li";
  // with a dialog open, only the dialog counts: the page behind it is dimmed and can not be pointed at
  const dlgs = Array.from(document.querySelectorAll<HTMLElement>("[role=dialog]")).filter((d) => { const r = d.getBoundingClientRect(); return r.width > 40 && r.height > 40 && getComputedStyle(d).visibility !== "hidden"; });
  const scope: HTMLElement | Document = dlgs.length ? dlgs[dlgs.length - 1] : document;
  const list = Array.from(scope.querySelectorAll<HTMLElement>(sel)); if (dlgs.length) list.unshift(dlgs[dlgs.length - 1]);
  for (const el of list) {
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8 || r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) continue;
    const t = (el.getAttribute("aria-label") || el.innerText || el.getAttribute("placeholder") || (el as HTMLInputElement).value || "").trim().replace(/\s+/g, " ").slice(0, 90);
    const x0 = Math.max(0, r.left), y0 = Math.max(0, r.top), x1 = Math.min(vw, r.right), y1 = Math.min(vh, r.bottom);
    const f = (n: number, d: number) => Math.round((n / d) * 10000) / 100;
    out.push({ t, id: el.getAttribute("data-testid") || el.id || "", tag: el.tagName.toLowerCase(), role: el.getAttribute("role") || "", x: f(x0, vw), y: f(y0, vh), w: f(x1 - x0, vw), h: f(y1 - y0, vh) });
  }
  return out.slice(0, 500);
};
const shot = async (page: Page, n: string) => {
  await page.evaluate(DEDUPE).catch(() => undefined);
  if (await page.getByText(BAD).first().isVisible({ timeout: 500 }).catch(() => false)) throw new Error(`not saving ${n}: an error / splash is on screen`);
  await page.screenshot({ path: path.join(OUT, n + ".png") }).catch((e) => console.log("shot failed", n, String(e).slice(0, 100)));
  const rects = await page.evaluate(RECTS).catch(() => []);
  fs.writeFileSync(path.join(OUT, n + ".rects.json"), JSON.stringify(rects));
};
const wide = { width: 1440, height: 900 };
async function noSplash(page: Page) {
  const sp = page.getByRole("dialog", { name: /Welcome to the Teaching and Learning Hub/ });
  if (await sp.isVisible({ timeout: 2500 }).catch(() => false)) {
    await page.waitForTimeout(1100); await page.keyboard.press("Shift").catch(() => undefined);
    await sp.waitFor({ state: "detached", timeout: 10_000 }).catch(() => undefined);
  }
  await page.waitForTimeout(900);
}
// Never capture a broken moment: the API being down ("can't reach Teaching Hub"), the welcome splash, or duplicate subject chips from the fixture data.
const BAD = /can't reach Teaching Hub|Couldn't reach the server|Tap anywhere to continue|Checking session/i;
const DEDUPE = () => {
  const groups = new Map<Element, Set<string>>();
  document.querySelectorAll<HTMLElement>("button,[role=radio],[role=tab]").forEach((b) => {
    const p = b.parentElement; if (!p) return; const t = (b.innerText || "").trim().replace(/\s+/g, " "); if (!t || t.length > 24) return;
    const seen = groups.get(p) ?? new Set<string>(); groups.set(p, seen);
    if (seen.has(t)) b.style.display = "none"; else seen.add(t);
  });
};
async function healthy(page: Page) {
  for (let n = 0; n < 5; n++) {
    const bad = await page.getByText(BAD).first().isVisible({ timeout: 1500 }).catch(() => false);
    if (!bad) return;
    const tap = page.getByText(/Tap anywhere to continue/).first();
    if (await tap.isVisible().catch(() => false)) { await page.mouse.click(700, 450); await page.waitForTimeout(1500); continue; }
    await page.waitForTimeout(10_000); await page.reload({ waitUntil: "load" }); await settle(page); await page.waitForTimeout(1500);
  }
  throw new Error("still showing an error / splash after 5 tries: not capturing it");
}
const go = async (page: Page, url: string) => { await gotoHubPage(page, url, X.fx); await noSplash(page); await settle(page); await page.waitForTimeout(1200); await healthy(page); };
type Role = "freelancer" | "parent";
/** One capture = one test (its own context), so any of them can be re-run alone with -g "<name>". */
function cap(name: string, role: Role, fn: (page: Page) => Promise<void>, o: { vp?: { width: number; height: number }; dsf?: number } = {}) {
  test(name, async ({ browser }) => {
    test.setTimeout(400_000);
    const ctx = await browser.newContext({ storageState: path.join(process.env.REVIEW_AUTH_DIR ? path.resolve(process.env.REVIEW_AUTH_DIR) : path.join(ROOT, "e2e/review/.auth"), `${role}.json`), viewport: o.vp ?? wide, deviceScaleFactor: o.dsf ?? 1.5 });
    const page = await ctx.newPage();
    await page.addInitScript(SCRUB);
    try { await fn(page); } finally { await ctx.close(); }
  });
}
const T = (name: string, fn: (page: Page) => Promise<void>) => cap(name, "freelancer", fn);
const tutorUrl = (tab: string) => `/freelancer/learninghub?tab=${tab}`;

T("cap t-home", async (page) => { await go(page, tutorUrl("home")); await shot(page, "t-home"); });
T("cap t-students", async (page) => {
  await go(page, tutorUrl("students")); await shot(page, "t-students");
  await page.getByRole("heading", { name: /^Ava/ }).first().scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0, 260)); await page.waitForTimeout(900); await shot(page, "t-students-cards");
  const act = page.locator('button[aria-label^="Actions for Ava"]').first();
  await act.click(); await page.getByRole("menuitem").first().waitFor({ timeout: 15_000 }); await page.waitForTimeout(700); await shot(page, "t-students-menu");
});
T("cap t-enrol", async (page) => {
  await go(page, tutorUrl("students"));
  await page.getByRole("button", { name: /Enrol a student/ }).first().click();
  const dlg = page.locator("#hub-enrol-modal");
  const mia = dlg.getByRole("button", { name: new RegExp(`^Enrol ${X.miaName}`) });
  await mia.waitFor({ timeout: 45_000 }); await page.waitForTimeout(800); await shot(page, "t-enrol");
  await mia.click(); await page.waitForTimeout(1200); await shot(page, "t-enrol-pick");
});
T("cap t-enrol-invite", async (page) => {
  await go(page, tutorUrl("students"));
  await page.getByRole("button", { name: /Enrol a student/ }).first().click();
  const dlg = page.locator("#hub-enrol-modal");
  await dlg.getByTestId("hub-family-invite-create").waitFor({ timeout: 30_000 });
  await dlg.locator("[class*='animate-pulse']").first().waitFor({ state: "detached", timeout: 45_000 }).catch(() => undefined);
  await dlg.getByLabel("Who is it for (optional)").fill("The Patel family");
  await dlg.getByTestId("hub-family-invite-create").click();
  await dlg.getByTestId("hub-family-invite-link").waitFor({ timeout: 20_000 });
  await dlg.getByTestId("hub-family-invite-link").scrollIntoViewIfNeeded();
  await page.waitForTimeout(800); await shot(page, "t-enrol-invite");
  await dlg.getByPlaceholder(/Search by child/).fill("zzzz");
  await page.waitForTimeout(1000); await shot(page, "t-enrol-link");
});
T("cap t-support", async (page) => {
  await go(page, tutorUrl("students"));
  const act = page.locator(`button[aria-label^="Actions for ${X.fx.kids[0].name}"]`).first();
  await act.waitFor({ timeout: 40_000 }); await act.scrollIntoViewIfNeeded(); await act.click();
  await page.getByRole("menuitem", { name: /Edit/ }).first().click();
  await page.getByRole("dialog").first().waitFor({ timeout: 20_000 });
  const sec = page.locator("#hub-support-section, [data-testid=hub-support-section]").first();
  await sec.waitFor({ timeout: 30_000 }); await sec.scrollIntoViewIfNeeded(); await page.waitForTimeout(700); await shot(page, "t-support");
});

const lessonBtn = (page: Page) => page.getByRole("button", { name: "Neurones and synapses", exact: true }).first();
async function findLesson(page: Page) {
  await go(page, tutorUrl("notes"));
  await page.getByPlaceholder(/Search areas or lessons/).fill("neurones and synapses");
  await lessonBtn(page).waitFor({ timeout: 60_000 });
}
async function openReader(page: Page) {
  await findLesson(page); await lessonBtn(page).click();
  await page.getByTestId("lesson-preview").waitFor({ timeout: 90_000 }); await page.waitForTimeout(1500);
}
T("cap t-lessons", async (page) => { await go(page, tutorUrl("notes")); await shot(page, "t-lessons"); });
T("cap t-area", async (page) => {
  await go(page, tutorUrl("notes"));
  await page.locator("button,[role=tab]").filter({ hasText: /^Science$/ }).first().click(); await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /^Coordination and control, \d+ lessons/ }).first().click().catch(() => undefined);
  await page.waitForTimeout(2000); await shot(page, "t-area");
});
T("cap t-search", async (page) => { await findLesson(page); await lessonBtn(page).scrollIntoViewIfNeeded(); await page.waitForTimeout(900); await shot(page, "t-search"); });
T("cap t-lesson-reader", async (page) => { await openReader(page); await shot(page, "t-lesson-reader"); });
T("cap t-lesson-choice", async (page) => {
  await openReader(page);
  await page.getByTestId("lesson-open").click(); await page.getByTestId("lesson-one-room").waitFor({ timeout: 40_000 }); await page.waitForTimeout(1500); await shot(page, "t-lesson-choice");
  await page.getByTestId("lesson-one-room").click(); await page.locator("input[type=checkbox]").first().waitFor({ timeout: 25_000 }).catch(() => undefined); await page.waitForTimeout(1500); await shot(page, "t-oneroom");
});
T("cap t-preview-tools", async (page) => {
  await openReader(page);
  await page.getByTestId("lesson-preview").click();
  const pill = page.getByRole("button", { name: /Tools for this lesson/ }).first();
  await pill.waitFor({ timeout: 90_000 }); await page.waitForTimeout(1500); await shot(page, "t-preview-pill");
  await pill.click();
  const q = page.getByTestId("preview-question-tool"); await q.waitFor({ timeout: 60_000 }); await page.waitForTimeout(1200); await shot(page, "t-preview-tool");
  await page.getByTestId("preview-tool-add").click(); await page.waitForTimeout(1200); await shot(page, "t-preview-picker");
  await page.locator("[data-testid^='tool-picker-subject-']").nth(1).click(); await page.getByTestId("tool-picker-list").waitFor({ timeout: 20_000 }); await page.waitForTimeout(1000); await shot(page, "t-preview-list");
  await page.locator("[data-testid^='tool-picker-item-']").first().click(); await page.waitForTimeout(2000);
  await page.getByTestId("tool-add-all").waitFor({ timeout: 20_000 }); await page.waitForTimeout(600); await shot(page, "t-preview-added");
});
T("cap t-builder", async (page) => {
  await go(page, tutorUrl("notes"));
  await page.getByRole("button", { name: /create new lesson/i }).first().click();
  await page.getByTestId("hub-note-topic-subjects").getByRole("button", { name: /^Science/ }).click();
  await page.getByTestId("hub-note-topic-list").getByRole("option", { name: /nervous system/i }).first().click();
  await page.getByTestId("sb-title").fill("How messages travel");
  await page.getByTestId("sb-add-block").click();
  await page.getByTestId("sb-add-text").click();
  await page.getByTestId("sb-block-0").locator("textarea").fill("A **neurone** is a nerve cell. It carries tiny electrical messages around your body.");
  await page.waitForTimeout(900); await shot(page, "t-builder");
  await page.getByTestId("sb-add-block").click(); await page.waitForTimeout(700); await shot(page, "t-builder-blocks");
  await page.keyboard.press("Escape");
  await page.getByTestId("sb-new-slide").click();
  await page.getByTestId("sb-template-question").click();
  await page.getByTestId("sb-choice-q").fill("What do neurones carry?");
  await page.getByTestId("sb-choice-opt-0").fill("Tiny electrical messages");
  await page.getByTestId("sb-choice-opt-1").fill("Water");
  await page.getByTestId("sb-choice-opt-2").fill("Air");
  await page.waitForTimeout(900); await shot(page, "t-builder-question");
  await page.getByTestId("sb-preview").click(); await page.waitForTimeout(1200); await shot(page, "t-builder-preview");
});
T("cap t-tools", async (page) => {
  await go(page, tutorUrl("tools")); await shot(page, "t-tools");
  await page.getByRole("button", { name: /Number line/ }).first().click(); await page.waitForTimeout(1800); await shot(page, "t-tool-open");
});
T("cap t-live", async (page) => { await go(page, tutorUrl("live")); await shot(page, "t-live"); });
T("cap t-mark", async (page) => {
  await go(page, tutorUrl("homework&sub=mark")); await shot(page, "t-mark");
  const row = page.getByTestId("hub-mark-row").first(); await row.waitFor({ timeout: 45_000 }); await row.click(); await page.locator("#hub-mark-dialog").waitFor({ timeout: 30_000 }); await page.waitForTimeout(1500); await shot(page, "t-mark-open");
});
T("cap t-homework", async (page) => {
  await go(page, tutorUrl("homework&sub=set"));
  const dlg = page.locator("#hub-homework-form");
  if (await dlg.isVisible({ timeout: 5000 }).catch(() => false)) { await page.keyboard.press("Escape"); await dlg.waitFor({ state: "detached", timeout: 10_000 }).catch(() => undefined); }
  await page.waitForTimeout(2500); await shot(page, "t-homework");
});
T("cap t-hw-form", async (page) => {
  { // the API keeps its worksheet index in memory and loses it on a restart: touch the lesson so it is listed again (unchanged content)
    const t = (await fbSignIn(X.fx.accounts.freelancer.email)).idToken;
    const nn = await apiFetch<{ topicId: string; title: string; body: string }>(`/api/learning-hub/notes/${X.noteId}?tenantId=${X.fx.tenantId}`, t);
    await apiFetch(`/api/learning-hub/notes/${X.noteId}?tenantId=${X.fx.tenantId}`, t, { method: "PUT", body: JSON.stringify({ topicId: nn.topicId, title: nn.title, body: nn.body ?? "", published: true }) });
  }
  await go(page, tutorUrl("homework&sub=set"));
  const dlg = page.locator("#hub-homework-form");
  if (!(await dlg.isVisible({ timeout: 4000 }).catch(() => false))) { await page.getByRole("button", { name: /^\s*Set homework/ }).first().click(); }
  await dlg.waitFor({ timeout: 30_000 });
  await page.waitForTimeout(900); await shot(page, "t-hw-form-0");
  await dlg.getByText(/^Year 3-5/).first().click(); await page.waitForTimeout(900); await shot(page, "t-hw-form-who");
  await dlg.locator("#hub-hw-title").fill("Angles pract"); await page.waitForTimeout(300); await shot(page, "t-hw-form-a");
  await dlg.locator("#hub-hw-title").fill("Angles practice, set A");
  await dlg.locator("#hub-hw-instructions").fill("Do questions 1 to 6. Show your working,"); await page.waitForTimeout(300); await shot(page, "t-hw-form-b");
  await dlg.locator("#hub-hw-instructions").fill("Do questions 1 to 6. Show your working, and hand in a photo of your page.");
  await page.waitForTimeout(900); await shot(page, "t-hw-form");
  await dlg.locator("#hub-hw-due").scrollIntoViewIfNeeded().catch(() => undefined); await page.waitForTimeout(800); await shot(page, "t-hw-due");
  const ws = dlg.locator("[data-testid=hub-hw-ws-picker], [data-testid=hub-hw-worksheets]").first();
  await ws.scrollIntoViewIfNeeded();
  await ws.locator("input[type=search]").first().fill("Neurones");
  const card = ws.locator("[data-testid=hub-hw-ws-cards] li").first();
  await ws.locator("button[data-pick]").first().waitFor({ timeout: 60_000 }); await page.waitForTimeout(1200); await shot(page, "t-hw-worksheet");
  await card.locator("button[data-pick]").first().click(); await page.waitForTimeout(1200); await shot(page, "t-hw-worksheet-picked");
  await dlg.getByTestId("hub-hw-year-all").scrollIntoViewIfNeeded().catch(() => undefined);
  await dlg.getByText("Assign to").first().scrollIntoViewIfNeeded(); await page.waitForTimeout(1200); await shot(page, "t-hw-assign");
});
T("cap t-quizzes", async (page) => { await go(page, tutorUrl("quizzes")); await shot(page, "t-quizzes"); await go(page, tutorUrl("diagnostic")); await shot(page, "t-starting"); });
T("cap t-progress", async (page) => {
  await go(page, tutorUrl("dashboard")); await shot(page, "t-progress");
  const open = page.getByTitle(/Ava/).first();
  if (await open.isVisible({ timeout: 15_000 }).catch(() => false)) { await open.click(); await page.getByText(/mastery/i).first().waitFor({ timeout: 20_000 }).catch(() => undefined); await page.waitForTimeout(2500); await shot(page, "t-progress-child"); }
});
T("cap t-progress-levels", async (page) => {
  await go(page, tutorUrl("dashboard"));
  const edit = page.getByRole("button", { name: /Edit levels/ }).first();
  if (await edit.isVisible({ timeout: 15_000 }).catch(() => false)) { await edit.click(); await page.waitForTimeout(1500); await shot(page, "t-progress-levels"); }
});
T("cap t-flashcards", async (page) => { await go(page, tutorUrl("flashcards")); await shot(page, "t-flashcards"); });
T("cap t-messages", async (page) => {   // the real Messages screen: list of threads (one folder per student), the composer, a typed reply
  await go(page, tutorUrl("questions"));
  await page.getByTestId("question-new-message").click();
  const pick = page.getByTestId("question-new-child"); await pick.waitFor({ timeout: 30_000 });
  await pick.selectOption({ label: X.fx.kids[0].name.replace(/[a-z0-9]{6,}$/, (m) => m) }).catch(() => undefined);
  await page.getByTestId("question-new-text").fill("Well done on your fractions quiz. Have a go at the extra questions when you can.");
  await page.waitForTimeout(800); await shot(page, "t-msg-new");
  await page.getByTestId("question-new-send").click();
  await page.getByTestId("question-thread-reply").waitFor({ timeout: 30_000 }); await page.waitForTimeout(1500); await shot(page, "t-messages");
  await page.getByTestId("question-thread-reply").fill("Thank you. Take your time, and ask me if anything is tricky."); await page.waitForTimeout(700); await shot(page, "t-msg-reply");
});
T("cap t-quiz-new", async (page) => {
  await go(page, tutorUrl("quizzes"));
  await page.getByRole("button", { name: /New quiz/ }).last().click(); await page.waitForTimeout(2500); await shot(page, "t-quiz-new");
});
T("cap t-quiz-marking", async (page) => {
  await go(page, tutorUrl("quizzes"));
  await page.getByRole("tab", { name: /^Marking/ }).first().click().catch(() => undefined); await page.waitForTimeout(2500); await shot(page, "t-quiz-marking");
});

const P = (name: string, fn: (page: Page) => Promise<void>, vp = wide) => cap(name, "parent", fn, { vp });
const kid = () => X.fx.kids[0];
const parentUrl = (tab: string) => `/custdash/learninghub?tab=${tab}&child=${kid().id}`;
P("cap p-home", async (page) => { await go(page, parentUrl("home")); await shot(page, "p-home"); });
P("cap p-live", async (page) => { await go(page, parentUrl("live")); await shot(page, "p-live"); });
P("cap p-lessons", async (page) => { await go(page, parentUrl("notes")); await shot(page, "p-lessons"); });
P("cap p-homework", async (page) => { await go(page, parentUrl("homework")); await shot(page, "p-homework"); });
P("cap p-progress", async (page) => {
  await go(page, parentUrl("dashboard")); await shot(page, "p-progress");
  await page.getByTestId("hub-report-open").click(); await page.getByTestId("hub-report-homework").waitFor({ timeout: 30_000 }); await page.waitForTimeout(800); await shot(page, "p-report");
});
P("cap p-invite", async (page) => { await page.goto(`/custdash/learninghub?invite=${X.inviteToken}`); await page.getByTestId(/hub-invite-enrol-/).first().waitFor({ timeout: 60_000 }).catch(() => undefined); await page.waitForTimeout(1500); await shot(page, "p-invite"); });
P("cap p-handover", async (page) => {
  await go(page, parentUrl("home"));
  await page.locator("[data-testid='hub-hand-over'],[data-testid='hub-hand-over-toggle']").first().scrollIntoViewIfNeeded(); await page.waitForTimeout(800); await shot(page, "p-handover");
});

const phone = { width: 390, height: 844 };
async function asKid(page: Page, id: string) {
  await gotoHubPage(page, `/custdash/learninghub?tab=home&child=${id}`, X.fx); await noSplash(page); await settle(page); await healthy(page);
  await handOver(page, id); await noSplash(page); await settle(page); await page.waitForTimeout(1500);
}
const K = (name: string, fn: (page: Page) => Promise<void>, id = () => kid().id) => cap(name, "parent", async (page) => { await asKid(page, id()); await fn(page); }, { vp: phone, dsf: 2 });
K("cap k-home", async (page) => { await shot(page, "k-home"); });
for (const [n, tab] of [["k-lessons", "notes"], ["k-homework", "homework"], ["k-quizzes", "quizzes"], ["k-flashcards", "flashcards"], ["k-stars", "dashboard"], ["k-starting", "diagnostic"]] as const) {
  K(`cap ${n}`, async (page) => { await page.goto(`/custdash/learninghub?tab=${tab}&child=${kid().id}`); await noSplash(page); await settle(page); await page.waitForTimeout(1500); await healthy(page); await shot(page, n); });
}
K("cap k-hw-open", async (page) => {
  await page.goto(`/custdash/learninghub?tab=homework&child=${kid().id}`); await noSplash(page); await settle(page); await page.waitForTimeout(1500);
  await healthy(page); await page.getByText(/Do the worksheet/).first().click({ timeout: 20_000 }).catch(() => undefined);
  await page.waitForTimeout(2500); await shot(page, "k-hw-open");
});
K("cap k-quiz-tool", async (page) => {
  await page.goto(`/custdash/learninghub?tab=quizzes&child=${kid().id}`); await noSplash(page); await settle(page); await page.waitForTimeout(1200);
  const card = page.locator("[id^='hub-assess-']").filter({ hasText: TOOL_QUIZ });
  await card.getByTestId("hub-open-assessment").click(); await page.getByTestId("hub-start").click();
  const runner = page.getByTestId("hub-runner"); await runner.waitFor({ timeout: 30_000 });
  await runner.getByTestId("question-tools").waitFor({ timeout: 20_000 }); await page.waitForTimeout(800); await shot(page, "k-quiz-tool");
  await runner.getByTestId("question-tools").locator("[data-testid^='question-tool-']").first().click(); await page.waitForTimeout(1500); await shot(page, "k-tool-open");
});
K("cap k-ks1", async (page) => {
  await shot(page, "k-ks1-home");
  await page.getByTestId("kid-tab-play").click(); await page.waitForTimeout(1500); await shot(page, "k-ks1-play");
  await page.getByTestId("kid-tab-stars").click(); await page.waitForTimeout(1500); await shot(page, "k-ks1-stars");
}, () => X.year1Kid);

// Last: mark one hand-in (as the tutor would), then capture what the family and the child see once it is marked.
test("cap 99-mark-hand-in", async () => {
  test.setTimeout(120_000);
  const t = (await fbSignIn(X.fx.accounts.freelancer.email)).idToken;
  const inbox = await apiFetch<{ submissionId: string; childId: string; status: string }[]>(`${HUB}/homework/inbox?status=submitted&tenantId=${X.fx.tenantId}`, t);
  const row = inbox.find((r) => r.childId === X.fx.kids[0].id) ?? inbox[0];
  if (!row) throw new Error("no hand-in to mark");
  await apiFetch(`${HUB}/submissions/${row.submissionId}/mark?tenantId=${X.fx.tenantId}`, t, { method: "PUT", body: JSON.stringify({ score: 8, max: 10, feedback: "Great work, well done! Have another look at question 2." }) });
});
P("cap p-homework-marked", async (page) => { await go(page, parentUrl("homework")); await shot(page, "p-homework-marked"); });
K("cap k-homework-marked", async (page) => { await page.goto(`/custdash/learninghub?tab=homework&child=${kid().id}`); await noSplash(page); await settle(page); await page.waitForTimeout(1500); await healthy(page); await shot(page, "k-homework-marked"); });
