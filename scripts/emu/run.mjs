#!/usr/bin/env node
// Emulator test-stack launcher.  node scripts/emu/run.mjs <emu|api|web|all>
// Ports (EMU_PORT_OFFSET shifts them all, e.g. 100 gives API 4201, web 3201, Auth 9199, Firestore 8180):
//   API 4101 | web 3101 | Auth 9099 | Firestore 8080 | Emulator UI 4000+offset+... (off by default)
// Every child gets TEST_STACK=1, so the guards refuse to start unless this is emulator-only.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const off = Number(process.env.EMU_PORT_OFFSET || 0);
if (!Number.isInteger(off) || off < 0) { console.error("EMU_PORT_OFFSET must be a non-negative integer"); process.exit(2); }
const P = { api: 4101 + off, web: 3101 + off, auth: 9099 + off, fs: 8080 + off };
const project = "demo-activityos";

// Java fallback for the emulators.
const env = { ...process.env };
function ensureJava() {
  const jh = join(homedir(), "ActivityOS-QA/tools/jdk/Contents/Home");
  // macOS ships a /usr/bin/java stub that exists but fails, so test that java really runs.
  const hasJava = spawnSync("java", ["-version"], { stdio: "ignore" }).status === 0;
  if (!hasJava && existsSync(join(jh, "bin/java"))) { env.JAVA_HOME = jh; env.PATH = `${jh}/bin:${env.PATH}`; } // same as: source ~/ActivityOS-QA/tools/java-env.sh
}

// Test-stack env. Live credentials are deliberately scrubbed so a stray server/.env can never leak in.
const emuEnv = {
  TEST_STACK: "1",
  FIRESTORE_EMULATOR_HOST: `127.0.0.1:${P.fs}`,
  FIREBASE_AUTH_EMULATOR_HOST: `127.0.0.1:${P.auth}`,
  FIREBASE_PROJECT_ID: project,
  GCLOUD_PROJECT: project,
  PORT: String(P.api),
  CORS_ORIGIN: `http://localhost:${P.web}`,
  WEB_URL: `http://localhost:${P.web}`,
  API_URL: `http://localhost:${P.api}`,
  MAIL_LIVE: "0",
  NEXT_PUBLIC_TEST_STACK: "1",
  NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST: `127.0.0.1:${P.auth}`,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: project,
  NEXT_PUBLIC_FIREBASE_API_KEY: "emulator-any-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: `${project}.firebaseapp.com`,
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:0:web:emulator",
  NEXT_PUBLIC_API_URL: `http://localhost:${P.api}`,
};
const childEnv = () => ({ ...env, ...emuEnv });

function run(name, cmd, args, e, opts = {}) {
  const c = spawn(cmd, args, { cwd: root, env: e, stdio: "inherit", ...opts });
  c.on("exit", (code) => { console.log(`[${name}] exited ${code}`); if (code) process.exitCode = code; });
  return c;
}

const mode = process.argv[2];
const kids = [];
const stopAll = () => kids.forEach((k) => k.kill("SIGTERM"));
process.on("SIGINT", stopAll); process.on("SIGTERM", stopAll);

if (mode === "emu") {
  ensureJava();
  const dir = join(root, ".emu"); mkdirSync(dir, { recursive: true });
  const cfg = join(dir, `firebase.${off}.json`);
  writeFileSync(cfg, JSON.stringify({ emulators: { auth: { port: P.auth, host: "127.0.0.1" }, firestore: { port: P.fs, host: "127.0.0.1" }, ui: { enabled: false }, hub: { port: 14400 + off }, logging: { port: 14500 + off }, singleProjectMode: true } }, null, 2));
  console.log(`[emu] Auth 127.0.0.1:${P.auth}  Firestore 127.0.0.1:${P.fs}  project ${project}  (data is in memory: gone on stop)`);
  kids.push(run("emu", "npx", ["--yes", "firebase-tools@latest", "emulators:start", "--only", "auth,firestore", "--project", project, "--config", cfg], env));
} else if (mode === "api") {
  const e = childEnv();
  // Strip live credentials (the guard would refuse them anyway; this keeps a stray shell/export from blocking a good run).
  // Set to "" (not deleted) so dotenv cannot fill them back in from a server/.env. STRIPE_SECRET_KEY is passed through only if the shell has one (the guard requires sk_test).
  for (const k of ["FIREBASE_SERVICE_ACCOUNT", "GOOGLE_APPLICATION_CREDENTIALS", "RESEND_API_KEY"]) e[k] = "";
  e.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
  kids.push(run("api", "server/node_modules/.bin/tsx", ["server/src/index.ts"], e));
} else if (mode === "web") {
  kids.push(run("web", "node_modules/.bin/next", ["dev", "-p", String(P.web)], { ...childEnv(), NEXT_DIST_DIR: `.next-emu${off || ""}` }));
} else if (mode === "all") {
  const self = fileURLToPath(import.meta.url);
  for (const m of ["api", "web"]) kids.push(run(m, process.execPath, [self, m], process.env));
} else {
  console.error("usage: run.mjs emu|api|web|all"); process.exit(2);
}
