#!/usr/bin/env node
// `npm run test:emu` - behaviour tests that need the Firebase emulators (Auth + Firestore) and the real API.
//   node scripts/emu/test-emu.mjs            starts the emulators with `firebase emulators:exec` (or reuses a running Firestore
//                                            emulator on the port), starts the API against them, runs tests/emulator/*.test.mts.
//   EMU_PORT_OFFSET=200 shifts every port (API 4301, Auth 9299, Firestore 8280), same convention as scripts/emu/run.mjs.
// Emulator-only: the API process gets TEST_STACK=1 (its guard refuses anything that is not local / demo-*) and blank live credentials.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { createConnection } from "node:net";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const off = Number(process.env.EMU_PORT_OFFSET || 0);
if (!Number.isInteger(off) || off < 0) { console.error("EMU_PORT_OFFSET must be a non-negative integer"); process.exit(2); }
const P = { api: 4101 + off, auth: 9099 + off, fs: 8080 + off };
const project = "demo-activityos";
const env = { ...process.env };

if (process.argv[2] === "--inner") {
  // Inside `emulators:exec` (or against a reused emulator): start the API, wait for it, run the tests, stop the API.
  const e = {
    ...env, TEST_STACK: "1", FIRESTORE_EMULATOR_HOST: `127.0.0.1:${P.fs}`, FIREBASE_AUTH_EMULATOR_HOST: `127.0.0.1:${P.auth}`,
    FIREBASE_PROJECT_ID: project, GCLOUD_PROJECT: project, PORT: String(P.api), MAIL_LIVE: "0",
    CORS_ORIGIN: "http://localhost:3101", WEB_URL: "http://localhost:3101", API_URL: `http://localhost:${P.api}`,
    FIREBASE_SERVICE_ACCOUNT: "", GOOGLE_APPLICATION_CREDENTIALS: "", RESEND_API_KEY: "", STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY || "",
    EMU_API: `http://localhost:${P.api}`, E2E_PASSWORD: env.E2E_PASSWORD || `Emu-${Math.random().toString(36).slice(2)}-Aa1!`,
    // Pay tests: dev platform-account mode (the connected-account path is NOT exercised) and a local-only webhook secret the tests sign with.
    STRIPE_PLATFORM_FALLBACK: "1", STRIPE_WEBHOOK_SECRET: env.STRIPE_WEBHOOK_SECRET || `whsec_emu_${Math.random().toString(36).slice(2)}`,
  };
  // A Stripe TEST key is optional: without one the card-payment tests are skipped (the API guard refuses anything but sk_test).
  const hasKey = (e.STRIPE_SECRET_KEY || "").startsWith("sk_test");
  if (!hasKey) e.STRIPE_SECRET_KEY = "";
  const api = spawn("server/node_modules/.bin/tsx", ["server/src/index.ts"], { cwd: root, env: e, stdio: ["ignore", "ignore", "inherit"] });
  const stop = () => { try { api.kill("SIGTERM"); } catch { /* gone */ } };
  process.on("exit", stop);
  let up = false;
  for (let i = 0; i < 120 && !up; i++) {
    if (api.exitCode !== null) { console.error("API exited early with", api.exitCode); process.exit(1); }
    up = await fetch(`${e.EMU_API}/health`).then((r) => r.status < 500, () => false);
    if (!up) await new Promise((r) => setTimeout(r, 500));
  }
  if (!up) { stop(); console.error("API did not come up"); process.exit(1); }
  let files = process.argv.slice(3);
  if (!files.length) {
    files = readdirSync(join(root, "tests/emulator")).filter((n) => n.endsWith(".test.mts")).sort().map((n) => `tests/emulator/${n}`);
    if (!hasKey) {
      const skipped = files.filter((n) => n.includes("/pay-"));
      files = files.filter((n) => !n.includes("/pay-"));
      console.log(`Pay tests skipped: no Stripe test key (set STRIPE_SECRET_KEY=sk_test_... to run ${skipped.length} file(s))`);
    }
  }
  if (files.some((n) => n.includes("/pay-"))) {
    const seed = spawnSync("server/node_modules/.bin/tsx", ["scripts/emu/seed-coupon-run.mts", "--api", e.EMU_API, "--auth", e.FIREBASE_AUTH_EMULATOR_HOST, "--fs", e.FIRESTORE_EMULATOR_HOST], { cwd: root, env: e, stdio: ["ignore", "ignore", "inherit"] });
    if (seed.status !== 0) { stop(); console.error("synthetic seed failed"); process.exit(1); }
  }
  const t = spawnSync("server/node_modules/.bin/tsx", ["--test", "--test-concurrency=1", ...files], { cwd: root, env: e, stdio: "inherit" });
  stop();
  process.exit(t.status ?? 1);
}

const open = (port) => new Promise((ok) => { const s = createConnection({ port, host: "127.0.0.1" }); s.on("connect", () => { s.destroy(); ok(true); }); s.on("error", () => ok(false)); });
const self = fileURLToPath(import.meta.url);
const rest = process.argv.slice(2);
if (await open(P.fs)) {
  console.log(`[test:emu] reusing the Firestore emulator on ${P.fs}`);
  const r = spawnSync(process.execPath, [self, "--inner", ...rest], { cwd: root, env, stdio: "inherit" });
  process.exit(r.status ?? 1);
}
const jh = join(homedir(), "ActivityOS-QA/tools/jdk/Contents/Home");
if (spawnSync("java", ["-version"], { stdio: "ignore" }).status !== 0 && existsSync(join(jh, "bin/java"))) { env.JAVA_HOME = jh; env.PATH = `${jh}/bin:${env.PATH}`; }
const dir = join(root, ".emu"); mkdirSync(dir, { recursive: true });
const cfg = join(dir, `firebase.test.${off}.json`);
writeFileSync(cfg, JSON.stringify({ emulators: { auth: { port: P.auth, host: "127.0.0.1" }, firestore: { port: P.fs, host: "127.0.0.1" }, ui: { enabled: false }, hub: { port: 14400 + off }, logging: { port: 14500 + off }, singleProjectMode: true } }, null, 2));
const inner = `${JSON.stringify(process.execPath)} ${JSON.stringify(self)} --inner ${rest.map((a) => JSON.stringify(a)).join(" ")}`;
const r = spawnSync("npx", ["--yes", "firebase-tools@latest", "emulators:exec", "--only", "auth,firestore", "--project", project, "--config", cfg, inner], { cwd: root, env, stdio: "inherit" });
process.exit(r.status ?? 1);
