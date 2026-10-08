// INC UI: drive the first-aid wizard as company/staff/parent, screenshot at 1440/390 x light/dark. node e2e/review/inc-ui.mjs <acc.json> <outdir>
import { chromium } from "/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright/index.mjs";
import fs from "node:fs";
const A = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const OUT = process.argv[3];
fs.mkdirSync(OUT, { recursive: true });
const WEB = "http://localhost:3011";
const b = await chromium.launch();
const report = [];
const note = (k, v) => { report.push(`${k}: ${v}`); console.log(k, v); };

async function login(email) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage(); p.setDefaultTimeout(90000);
  await p.goto(WEB + "/login", { waitUntil: "load", timeout: 120000 });
  await p.getByPlaceholder("you@example.com").fill(email);
  await p.locator('input[type="password"]').fill(A.password);
  await p.getByRole("button", { name: "Sign in", exact: true }).click();
  await p.waitForURL((u) => !/login/.test(u.pathname), { timeout: 120000 });
  await p.waitForTimeout(2500);
  const st = await ctx.storageState({ indexedDB: true });
  await ctx.close();
  return st;
}
const states = {};
for (const [k, e] of [["company", A.A.email], ["staff1", A.staff1.email], ["staff2", A.staff2.email], ["parent", A.parent.email]]) states[k] = await login(e);

async function page(role, w, h, scheme) {
  const ctx = await b.newContext({ storageState: states[role], viewport: { width: w, height: h }, colorScheme: scheme });
  const p = await ctx.newPage(); p.setDefaultTimeout(60000);
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e)));
  p.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 200)); });
  p.__errs = errs;
  return p;
}
const shot = async (p, name) => p.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
const overflow = async (p, name) => {
  const o = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  if (o.sw > o.cw + 1) note("HORIZONTAL OVERFLOW " + name, JSON.stringify(o));
};
const skip = async (p) => { for (const t of ["Skip", "Not now", "Maybe later", "Got it", "Close", "Skip for now", "I'll do it later"]) { const x = p.getByRole("button", { name: t }).first(); if (await x.isVisible().catch(() => false)) await x.click().catch(() => {}); } };

for (const [w, h, wn] of [[1440, 900, "d"], [390, 844, "m"]]) {
  for (const scheme of ["light", "dark"]) {
    const tag = `${wn}-${scheme}`;
    // ---- company: wizard
    let p = await page("company", w, h, scheme);
    await p.goto(WEB + "/company/accidents", { waitUntil: "load" });
    await p.waitForTimeout(3500); await skip(p);
    await shot(p, `co-${tag}-1-list`); await overflow(p, "co list " + tag);
    await p.getByRole("button", { name: /Log first aid/ }).first().click();
    await p.waitForTimeout(800);
    await shot(p, `co-${tag}-2-step1`);
    if (scheme === "light" && wn === "d") {
      await p.getByPlaceholder("Search a booked child…").fill(A.kids.booked.slice(0, 8));
      await p.waitForTimeout(1200);
      await shot(p, `co-${tag}-2b-picker`);
      await p.getByRole("button", { name: A.kids.booked, exact: true }).click();
      await p.getByPlaceholder("e.g. the main hall").fill("Main hall");
      await p.getByRole("button", { name: "Next →", exact: true }).click();
      await p.locator("textarea").first().fill("Slipped on wet floor and bumped head, UI test");
      await p.getByPlaceholder(/injury/i).first().fill("Bump").catch(() => {});
      await shot(p, `co-${tag}-3-step2`);
      await p.getByRole("button", { name: "Next →", exact: true }).click();
      await p.waitForTimeout(500);
      await shot(p, `co-${tag}-4-step3`);
      const raw = await p.locator("text=/p7inc\\./").count();
      note("raw i18n keys visible on step 3 (after fix)", raw);
      await p.getByRole("button", { name: "Save record" }).click();
      await p.waitForTimeout(2500);
      await shot(p, `co-${tag}-5-saved`);
    } else {
      await p.locator("textarea").count();
    }
    note(`console errors co ${tag}`, JSON.stringify(p.__errs.slice(0, 3)));
    await p.context().close();
  }
}
// expanded details / edit / delete as company (desktop light)
{
  const p = await page("company", 1440, 900, "light");
  await p.goto(WEB + "/company/accidents", { waitUntil: "load" }); await p.waitForTimeout(3500); await skip(p);
  const det = p.getByRole("button", { name: /Details/ }).first();
  if (await det.isVisible().catch(() => false)) { await det.click(); await p.waitForTimeout(600); await shot(p, "co-d-light-6-details"); } else note("details button", "NOT FOUND");
  await p.getByRole("button", { name: "Edit", exact: true }).first().click();
  await p.waitForTimeout(500);
  await p.getByRole("button", { name: "Next →", exact: true }).click();
  await p.getByRole("button", { name: "Next →", exact: true }).click();
  await shot(p, "co-d-light-7-edit-step3");
  await p.close();
}
// staff
for (const [w, h, wn] of [[1440, 900, "d"], [390, 844, "m"]]) {
  const p = await page("staff2", w, h, "light");
  await p.goto(WEB + "/staff/accidents", { waitUntil: "load" }); await p.waitForTimeout(3500); await skip(p);
  await shot(p, `staff2-${wn}-1-list`); await overflow(p, "staff list " + wn);
  const ed = p.getByRole("button", { name: "Edit", exact: true }).first();
  if (await ed.isVisible().catch(() => false)) {
    await ed.click(); await p.waitForTimeout(500);
    await p.getByRole("button", { name: "Next →", exact: true }).click();
    await p.getByRole("button", { name: "Next →", exact: true }).click();
    await p.getByRole("button", { name: "Save record" }).click();
    await p.waitForTimeout(2000);
    await shot(p, `staff2-${wn}-2-edit-others`);
    const txt = await p.locator("body").innerText();
    note("staff2 edits company's record -> visible error", (txt.match(/Only the provider[^\n]*/) ?? ["(no error shown)"])[0]);
  } else note("staff Edit button", "none");
  const del = await p.getByRole("button", { name: "Delete", exact: true }).count();
  note("staff sees Delete button count", del);
  await p.close();
}
// parent
for (const [w, h, wn] of [[1440, 900, "d"], [390, 844, "m"]]) {
  for (const scheme of ["light", "dark"]) {
    const p = await page("parent", w, h, scheme);
    await p.goto(WEB + "/custdash/accidents", { waitUntil: "load" }); await p.waitForTimeout(4000); await skip(p);
    await shot(p, `par-${wn}-${scheme}-1`); await overflow(p, `parent ${wn} ${scheme}`);
    if (scheme === "light") {
      const sd = p.getByRole("button", { name: /Show details|details/i }).first();
      if (await sd.isVisible().catch(() => false)) { await sd.click(); await p.waitForTimeout(500); await shot(p, `par-${wn}-${scheme}-2-details`); }
      await p.getByRole("button", { name: /Incident|Behaviour/i }).first().click().catch(() => {});
      await p.waitForTimeout(500); await shot(p, `par-${wn}-${scheme}-3-incidents-tab`);
    }
    note(`console errors parent ${wn}${scheme}`, JSON.stringify(p.__errs.slice(0, 3)));
    await p.close();
  }
}
// log concern (behaviour) as company
{
  const p = await page("company", 1440, 900, "light");
  await p.goto(WEB + "/company/incidents", { waitUntil: "load" }); await p.waitForTimeout(3500); await skip(p);
  await shot(p, "co-d-light-8-logconcern");
  await p.close();
}
fs.writeFileSync(`${OUT}/report.txt`, report.join("\n"));
await b.close();
process.exit(0);
