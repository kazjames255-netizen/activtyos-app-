// HMRC Tax-Free Childcare SANDBOX scenario runner. Owner runs it:  server/node_modules/.bin/tsx e2e/review/hm-run.mts
// Writes the results into docs/tfc/sandbox-test-evidence.md. Sandbox host only; no Stripe, no Firebase; no secrets/tokens/full references are printed.
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { createRequire } from "node:module";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createTestUser, assertSandbox, SCENARIOS, runScenario, renderResults, spliceResults, extractCode, scrub, type Row } from "./hm-run-lib";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// Same loader the server uses (dotenv, server/.env); real environment variables win.
try {
  const dotenv = createRequire(path.join(root, "server/package.json"))("dotenv");
  dotenv.config({ path: path.join(root, "server/.env"), quiet: true });
} catch { /* dotenv not installed: rely on the real environment */ }

const die = (m: string): never => { console.error(m); process.exit(1); };

// Hard sandbox check BEFORE the client is configured or anything is sent.
const base = (process.env.HMRC_TFC_BASE_URL ?? "").trim() || "https://test-api.service.hmrc.gov.uk";
try { assertSandbox(base); } catch (e) { die((e as Error).message); }

const { tfcConfig, authorizeUrl, exchangeCode } = await import("../../server/src/lib/tfc");
const cfg = tfcConfig();
if (!cfg) die("HMRC is not configured: set HMRC_TFC_CLIENT_ID, HMRC_TFC_CLIENT_SECRET, HMRC_TFC_EPP_UNIQUE_CUSTOMER_ID and HMRC_TFC_EPP_REG_REFERENCE (env or server/.env).");
const c = cfg!;
assertSandbox(c.baseUrl);
const secrets = [c.clientId, c.clientSecret, c.eppUniqueCustomerId, c.eppRegReference];

// Record the HTTP status of the client's calls, and block any non-sandbox host as a second guard.
let last: number | null = null;
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: any, init?: any) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  assertSandbox(new URL(url).origin);
  const res = await realFetch(input, init);
  last = res.status;
  return res;
}) as typeof fetch;

// A user access token: either supplied, or obtained once through the real GOV.UK sandbox sign-in.
let tokens: { accessToken: string; refreshToken: string; expiresAt: number };
const supplied = (process.env.HMRC_TFC_SANDBOX_ACCESS_TOKEN ?? "").trim();
if (supplied) {
  tokens = { accessToken: supplied, refreshToken: "", expiresAt: Date.now() + 3 * 3600_000 };
  secrets.push(supplied);
} else {
  console.log("Creating a FAKE sandbox test user at HMRC (sandbox only, no real person) ...");
  const services = (process.env.HMRC_TFC_SANDBOX_TEST_USER_SERVICES ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const tu = await createTestUser(c, services.length ? services : undefined);
  if (!tu.ok) {
    console.error(`HMRC refused to create a test user (${tu.step} step, HTTP ${tu.status ?? "no response"}): ${tu.body}`);
    console.error(`What to do: ${tu.manual}`);
    process.exit(1);
  }
  console.log("\nFAKE sandbox test user (sandbox-only credentials, not a real person; safe to show):");
  console.log(`  User ID:  ${tu.userId}`);
  console.log(`  Password: ${tu.password}`);
  try {
    const dir = path.join(root, "e2e/review/.local");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "hmrc-sandbox-test-user.txt"), `userId=${tu.userId}\npassword=${tu.password}\n`);
    console.log("  (also saved to e2e/review/.local/hmrc-sandbox-test-user.txt, which git ignores)");
  } catch { /* saving is optional */ }
  console.log("\nWhat happens next:");
  console.log("  1. Your browser opens the HMRC / GOV.UK sandbox sign-in page.");
  console.log("  2. Type the User ID and Password above into it and sign in.");
  console.log("  3. Press the button to grant Activityos permission (Tax-Free Childcare).");
  console.log("  4. The browser then goes to the redirect address and may show an error or blank page. That is fine.");
  console.log("  5. Copy the full address from the browser address bar and paste it below, then press Enter.\n");
  const url = authorizeUrl(c, "hm-run");
  console.log("Opening the HMRC sandbox sign-in in your browser.");
  console.log("(The link is not printed because it contains the client id.)");
  execFile("open", [url], () => {});
  console.log("When the browser lands on the redirect page, copy the full address (or just the code= value) and paste it here.");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const pasted: string = await new Promise((r) => rl.question("Paste redirect URL or code: ", (a) => { rl.close(); r(a); }));
  const ex = await exchangeCode(c, extractCode(pasted));
  if (!ex.ok) { die(`Could not exchange the sign-in code for a token (${ex.failure}). Try again.`); process.exit(1); }
  tokens = ex.data;
  secrets.push(tokens.accessToken, tokens.refreshToken);
}

const ccp = {
  ref: (process.env.HMRC_TFC_SANDBOX_CCP_REG_REFERENCE ?? "").trim() || "EY123456",
  postcode: (process.env.HMRC_TFC_SANDBOX_CCP_POSTCODE ?? "").trim() || "AB12 3CD",
};

const rows: Row[] = [];
for (const sc of SCENARIOS) {
  const r = await runScenario({ cfg: c, tokens, lastStatus: () => last, ccp }, sc);
  rows.push(...r);
  for (const x of r) console.log(scrub(`${x.pass ? "PASS" : "FAIL"}  ${x.id}  ${x.request.padEnd(7)} HTTP ${x.status ?? "-"}  ${x.code || "-"}  -> ${x.screen}`, secrets));
}

const file = path.join(root, "docs/tfc/sandbox-test-evidence.md");
const when = new Date().toISOString();
fs.writeFileSync(file, spliceResults(fs.readFileSync(file, "utf8"), renderResults(rows, when)));
const passed = rows.filter((r) => r.pass).length;
console.log(`\n${passed}/${rows.length} requests passed. Evidence written to docs/tfc/sandbox-test-evidence.md`);
const failed = [...new Set(rows.filter((r) => !r.pass).map((r) => r.id))];
if (failed.length) console.log(`Failed scenarios: ${failed.join(", ")}`);
process.exit(failed.length ? 2 : 0);
