// Fetch the latest DfE GIAS (Get Information about Schools) "Establishment fields CSV" full extract and unzip it
// into scripts/leads/out/gias/extracted/. The site 403s a plain fetch without a real browser User-Agent, and the
// actual CSV is behind a 3-step flow (not a static link): GET /Downloads for a fresh antiforgery token + session
// cookie → POST /Downloads/Collate with that token + the "all.edubase.data" checkbox ticked → follow the redirect
// to /Downloads/Generated/<id> → POST /Downloads/Download/Extract with the id → follow the redirect to the actual
// ea-edubase-api-prod.azurewebsites.net zip. Run from server/: node scripts/leads/fetch_gias.mjs
import fs from "fs"; import path from "path"; import { execFile } from "child_process"; import { promisify } from "util";
const run = promisify(execFile);
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const BASE = "https://get-information-schools.service.gov.uk";
const OUT = "scripts/leads/out/gias"; fs.mkdirSync(`${OUT}/extracted`, { recursive: true });

async function get(url, jar) {
  const r = await fetch(url, { headers: { "user-agent": UA, cookie: jar.header() }, redirect: "manual" });
  for (const [k, v] of r.headers.entries()) if (k === "set-cookie") jar.add(v);
  return r;
}
async function post(url, jar, body) {
  const r = await fetch(url, { method: "POST", redirect: "manual", headers: { "user-agent": UA, cookie: jar.header(), "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body) });
  for (const [k, v] of r.headers.entries()) if (k === "set-cookie") jar.add(v);
  return r;
}
function makeJar() { const m = new Map(); return {
  add(setCookie) { const [pair] = setCookie.split(";"); const i = pair.indexOf("="); if (i > 0) m.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim()); },
  header() { return [...m.entries()].map(([k, v]) => `${k}=${v}`).join("; "); },
}; }
const token = (html) => (html.match(/name="__RequestVerificationToken" type="hidden" value="([^"]*)"/) || [])[1];

const jar = makeJar();
console.log("1/4 GET /Downloads (session + token)");
let r = await get(`${BASE}/Downloads`, jar); let html = await r.text();
let tok = token(html);
if (!tok) { console.log("no token on /Downloads — page structure may have changed"); process.exit(1); }

console.log("2/4 POST /Downloads/Collate (select establishment fields CSV)");
const today = new Date();
r = await post(`${BASE}/Downloads/Collate`, jar, {
  __RequestVerificationToken: tok, Skip: "", SearchType: "Latest",
  "FilterDate.Day": String(today.getDate()), "FilterDate.Month": String(today.getMonth() + 1), "FilterDate.Year": String(today.getFullYear()),
  "Downloads[0].Tag": "all.edubase.data", "Downloads[0].FileGeneratedDate": today.toLocaleDateString("en-US") + " 12:00:00 AM", "Downloads[0].Selected": "true",
});
let loc = r.headers.get("location");
if (r.status !== 302 || !loc) { console.log("Collate did not redirect as expected, status", r.status); process.exit(1); }

console.log("3/4 GET generated download page, POST Extract");
r = await get(`${BASE}${loc}`, jar); html = await r.text();
tok = token(html);
const id = (html.match(/name="id" type="hidden" value="([^"]*)"/) || [])[1];
const extractPath = (html.match(/name="path" type="hidden" value="([^"]*)"/) || [])[1];
if (!id || !extractPath) { console.log("no id/path on generated page — GIAS may not have finished generating; retry in a minute"); process.exit(1); }
r = await post(`${BASE}/Downloads/Download/Extract`, jar, { __RequestVerificationToken: tok, id, path: extractPath, returnSource: "Downloads" });
loc = r.headers.get("location");
if (r.status !== 302 || !loc) { console.log("Extract did not redirect as expected, status", r.status); process.exit(1); }

console.log("4/4 downloading zip from", loc);
r = await fetch(loc, { headers: { "user-agent": UA }, redirect: "follow" });
if (r.status !== 200) { console.log("zip download failed, status", r.status); process.exit(1); }
const buf = Buffer.from(await r.arrayBuffer());
fs.writeFileSync(`${OUT}/Results.zip`, buf);
console.log("downloaded", buf.length, "bytes — unzipping");
await run("unzip", ["-o", "-q", `${OUT}/Results.zip`, "-d", `${OUT}/extracted`]);
const csvFile = fs.readdirSync(`${OUT}/extracted`).find((f) => /^edubasealldata\d+\.csv$/i.test(f));
console.log("done —", csvFile || "(no edubasealldata*.csv found in the zip, check contents)");
process.exit(0);
