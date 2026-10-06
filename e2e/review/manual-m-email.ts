import fs from "node:fs"; import path from "node:path"; import { execFileSync } from "node:child_process";
import { fbSignIn, apiFetch } from "../helpers/accounts";
import { ROOT } from "../helpers/env";
import { bookingConfirmedSpec, layout, type BankPayDetails } from "../../server/src/lib/emailTemplates";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { chromium } = require("/Users/kazjames/Downloads/activtyos-app-/node_modules/playwright");
const OUT = path.join(ROOT, "e2e/review/shots/manualm");
(async () => {
  const meta = JSON.parse(fs.readFileSync(path.join(OUT, "meta.json"), "utf8"));
  const tok = (await fbSignIn(meta.parent)).idToken;
  const mine = await apiFetch<any[]>("/api/my/bookings", tok);
  const b = mine.find((x) => x.ref === meta.ref);
  const bank: BankPayDetails = { bankName: "Barclays", accountName: "Riverside Activity Camps", sortCode: "20-00-00", accountNumber: "12345678", reference: b.ref, amount: b.amount };
  const spec = bookingConfirmedSpec({ ...b, booker: "Alex Morgan", email: "alex@example.com" }, "Riverside Activity Camps", bank);
  const html = layout({ name: "Riverside Activity Camps", hasLogo: false }, spec.title, spec.body, { ...b, booker: "Alex Morgan", email: "alex@example.com" }, {}, "http://localhost:3000");
  const page = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#eaecf2;font-family:system-ui"><div style="max-width:760px;margin:0 auto;padding:18px"><div style="background:#fff;border-radius:12px 12px 0 0;padding:14px 18px;font-size:13px"><b>From:</b> Riverside Activity Camps<br><b>To:</b> alex@example.com<br><b style="font-size:16px">${spec.subject}</b></div>${html}</div>`;
  const f = path.join(OUT, "bank-4-email.html"); fs.writeFileSync(f, page);
  const br = await chromium.launch(); const p = await (await br.newContext({ viewport: { width: 800, height: 900 }, deviceScaleFactor: 2 })).newPage();
  await p.goto("file://" + f); await p.waitForTimeout(600);
  const h = await p.evaluate(() => document.body.scrollHeight);
  const png = path.join(OUT, "bank-4-email.png"); await p.screenshot({ path: png, clip: { x: 0, y: 0, width: 800, height: Math.min(h, 1500) } });
  execFileSync("sips", ["--resampleWidth", "1000", "-s", "format", "jpeg", "-s", "formatOptions", "82", png, "--out", path.join(OUT, "bank-4-email.jpg")], { stdio: "pipe" });
  await br.close(); console.log("email ok", spec.subject); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
