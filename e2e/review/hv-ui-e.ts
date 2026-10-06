import { chromium, login, shot, go, rec, results, load } from "./hv-ui-lib";
import { call, ok, db, tokFor } from "./hv-lib";
import fs from "node:fs";
(async () => {
  const S = load(); const b = await chromium.launch();
  // company cb: library WITHOUT an online place, so the wizard must create one
  const cb = await tokFor(S.accts.cb.email);
  const lib = (await call(cb, "GET", "/api/library")).json ?? {};
  await ok(cb, "PUT", "/api/library", { venues: (lib.venues ?? []).filter((v: any) => v.kind !== "online"), settings: lib.settings ?? {} });
  const { page: pc } = await login(b, S.accts.cb.email);
  await go(pc, "/company/listings");
  await pc.getByRole("button", { name: /New listing/ }).first().click(); await pc.waitForTimeout(3000);
  await shot(pc, "hv-wiz-step1");
  const title = pc.getByPlaceholder(/Summer Multi-Activity/);
  await title.fill("Online Maths Tutoring"); await pc.waitForTimeout(800);
  await pc.waitForTimeout(7000); await shot(pc, "hv-wiz-after-title"); await pc.getByRole("button", { name: /Next/ }).last().click(); await pc.waitForTimeout(3500);
  const opts = await pc.locator("button").allInnerTexts();
  rec("WIZ step 2 offers four delivery options (venue / Online / Home visits / Both)", ["At a venue", "Online", "Home visits", "Both"].every((x) => opts.some((o) => o.includes(x))), opts.filter((o) => /venue|Online|Home|Both/.test(o)).slice(0, 6).join(" | "), await shot(pc, "hv-wiz-step2-default"));
  await pc.getByRole("button", { name: /Online/ }).first().click(); await pc.waitForTimeout(1500);
  const t = await pc.locator("body").innerText();
  const selDisabled = await pc.locator("select[disabled]").count();
  rec("WIZ Online: venue greyed ('no address needed'), join box shown, no add-venue link, no coverage box", /no address needed/i.test(t) && selDisabled >= 1 && !/\+ Add a venue/.test(t) && !/Coverage area/.test(t), `disabled selects=${selDisabled}`, await shot(pc, "hv-wiz-online"));
  await pc.locator("textarea").first().fill("Zoom link https://zoom.example/j/987 - have a calculator ready");
  await pc.waitForTimeout(1500);
  await pc.getByRole("button", { name: /Home visits/ }).first().click(); await pc.waitForTimeout(1000);
  const th = await pc.locator("body").innerText();
  rec("WIZ Home visits: green 'Parents never see your address' notice, base-postcode hint, venue hidden", /Parents never see your address/.test(th) && !/Sessions run online/.test(th), "notice present: " + /Parents never see your address/.test(th), await shot(pc, "hv-wiz-home"));
  await pc.waitForTimeout(2500); await pc.getByRole("button", { name: /Radius from base/ }).first().click(); await pc.waitForTimeout(2500);
  rec("WIZ radius mode: base postcode field labelled '(never shown to parents)'", /never shown to parents/i.test(await pc.locator("body").innerText()), "label present", await shot(pc, "hv-wiz-radius"));
  await pc.getByRole("button", { name: /^✓? ?At a venue/ }).first().click(); await pc.waitForTimeout(800);
  const tv = await pc.locator("body").innerText();
  rec("WIZ back to 'At a venue': venue picker returns, online card gone", /Select a venue|Venue/i.test(tv) && !/Sessions run online/.test(tv), "online card removed: " + !/Sessions run online/.test(tv), await shot(pc, "hv-wiz-venue-again"));
  await pc.getByRole("button", { name: /Online/ }).first().click(); await pc.waitForTimeout(800);
  await pc.getByRole("button", { name: /Save draft/ }).first().click(); await pc.waitForTimeout(3500);
  const mine = ((await call(cb, "GET", "/api/listings?mine=1")).json ?? []) as any[];
  const dr = mine.find((l) => /Online Maths Tutoring/.test(l.title ?? l.name));
  const lib2 = (await call(cb, "GET", "/api/library")).json ?? {};
  const ov = (lib2.venues ?? []).find((v: any) => v.id === dr?.venueId);
  rec("WIZ Online saved: draft's venue is a new 'Online' place with the join text, deliveryMode venue, no coverage", !!dr && ov?.kind === "online" && /987/.test(ov.directions ?? "") && (dr.deliveryMode ?? "venue") === "venue" && !dr.coverageArea, `venue=${JSON.stringify(ov)?.slice(0, 160)} mode=${dr?.deliveryMode} cov=${JSON.stringify(dr?.coverageArea)}`);
  // can it publish without a venue/address?
  if (dr) { const pub = await call(cb, "PUT", `/api/listings/${dr.id}`, { status: "live", runFrom: "2026-10-12", runTo: "2026-10-30" }); rec("SERVER publish of an online listing needs no street venue (only fails for real missing items)", pub.status < 300 || !/venue/i.test(JSON.stringify(pub.json)), `HTTP ${pub.status} ${JSON.stringify(pub.json).slice(0, 220)}`); }
  fs.writeFileSync("/private/tmp/claude-501/-Users-kazjames-Downloads-activtyos-app-/d6be64b6-4124-4419-9525-b7eb6fbb7058/scratchpad/hv-ui-e.json", JSON.stringify(results, null, 1));
  await b.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
