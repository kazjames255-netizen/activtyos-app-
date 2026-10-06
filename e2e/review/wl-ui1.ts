import * as L from "./wl-lib";
const { check, snap, pageFor, must } = L;
(async () => {
  const S = JSON.parse(require("node:fs").readFileSync(L.SHOTS + "/state-a.json", "utf8"));
  await check("W06-ui-parent-position", "ui", async (shots) => {
    const p = await pageFor("pc", "/custdash/bookings");
    await p.getByText("My waiting list").first().waitFor({ timeout: 40000 });
    shots.push(await snap(p, "w06-parent-mybookings", [/Waiting for/i]));
    const txt = await p.locator("body").innerText();
    await p.close();
    must(/position 1|1st|first in line|#1/i.test(txt), "parent sees queue position (text: " + (txt.match(/.{0,40}(waiting|position).{0,60}/i)?.[0] ?? "none") + ")");
    return "parent My bookings shows position: " + (txt.match(/.{0,30}position.{0,40}/i)?.[0] ?? "").replace(/\n/g, " ");
  });
  await check("W07-ui-provider-no-unpaid", "ui", async (shots) => {
    const p = await pageFor("pv", "/freelancer/bookings");
    shots.push(await snap(p, "w07-provider-bookings", [/WLT-10314/]));
    const body = (await p.locator("body").innerText()).replace(/\n+/g, " | ");
    const txt = body.slice(body.indexOf("Ref WLT-10314") - 40, body.indexOf("Ref WLT-10314") + 260);
    await p.close();
    if (/Unpaid|Mark paid|Resend invoice/i.test(txt)) throw new Error("waitlisted row shows money prompts: " + txt.slice(0, 250));
    return "provider row: " + txt.slice(0, 220);
  });
  await check("W08-ui-booking-page-full", "ui", async (shots) => {
    const p = await pageFor("pe", `/book/${S.L1.id}`);
    await p.getByText(/Tap a week/).first().waitFor({ timeout: 45000 });
    shots.push(await snap(p, "w08-bookpage-full-day"));
    const txt = await p.locator("body").innerText();
    await p.close();
    return "page mentions waiting list: " + /waiting list|waitlist/i.test(txt) + " | full marker: " + /full|sold out/i.test(txt);
  });
  await L.closeAll(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
