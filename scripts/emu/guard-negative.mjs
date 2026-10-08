#!/usr/bin/env node
// Negative proof of the server guard: boots the real API entry with TEST_STACK=1 and deliberately unsafe environments;
// each must exit non-zero with a message. Needs no emulator (the guard fires before Firebase is touched).
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const emu = { FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080", FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099" };
const cases = {
  "a no emulator vars": {},
  "b live project id": { ...emu, FIREBASE_PROJECT_ID: "activityos-bef89" },
  "c service account set": { ...emu, FIREBASE_SERVICE_ACCOUNT: "e30=" },
  "d sk_live stripe key": { ...emu, STRIPE_SECRET_KEY: "sk_live_notarealkey" },
  "e GOOGLE_APPLICATION_CREDENTIALS": { ...emu, GOOGLE_APPLICATION_CREDENTIALS: "/nonexistent.json" },
};
let bad = 0;
for (const [name, extra] of Object.entries(cases)) {
  const r = spawnSync(resolve(root, "server/node_modules/.bin/tsx"), ["server/src/index.ts"], {
    cwd: root, encoding: "utf8", timeout: 60000,
    env: { PATH: process.env.PATH, HOME: process.env.HOME, TEST_STACK: "1", PORT: "4199", ...extra },
  });
  const refused = r.status !== 0 && r.status !== null && /REFUSING TO START/.test(r.stderr);
  if (!refused) bad++;
  console.log(`${refused ? "PASS" : "FAIL"}  ${name}: exit ${r.status}\n${r.stderr.split("\n").filter((l) => /REFUSING|^  - /.test(l)).join("\n")}`);
}
process.exit(bad ? 1 : 0);
