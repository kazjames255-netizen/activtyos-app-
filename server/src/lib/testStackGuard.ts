// Test-stack guard. When TEST_STACK=1 the process must be talking ONLY to the Firebase Emulator Suite, never the
// live project (activityos-bef89). The check is a pure function of the environment so it can be unit-tested; the
// wrapper below prints the problems and exits non-zero. With TEST_STACK unset nothing happens (no behaviour change).

export const LIVE_PROJECT_ID = "activityos-bef89";

type Env = Record<string, string | undefined>;

/** host:port that points at this machine (localhost, 127.0.0.1 or [::1]). */
function isLocalHostPort(v: string | undefined): boolean {
  if (!v) return false;
  return /^(?:https?:\/\/)?(localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?\/?$/i.test(v.trim());
}

/** Returns the reasons the environment is NOT safe for the test stack ([] = safe). Always [] when TEST_STACK is off. */
export function testStackProblems(env: Env): string[] {
  if (env.TEST_STACK !== "1") return [];
  const problems: string[] = [];
  if (!env.FIRESTORE_EMULATOR_HOST) problems.push("FIRESTORE_EMULATOR_HOST is not set");
  else if (!isLocalHostPort(env.FIRESTORE_EMULATOR_HOST)) problems.push("FIRESTORE_EMULATOR_HOST does not point at localhost / 127.0.0.1 / [::1]");
  if (!env.FIREBASE_AUTH_EMULATOR_HOST) problems.push("FIREBASE_AUTH_EMULATOR_HOST is not set");
  else if (!isLocalHostPort(env.FIREBASE_AUTH_EMULATOR_HOST)) problems.push("FIREBASE_AUTH_EMULATOR_HOST does not point at localhost / 127.0.0.1 / [::1]");
  const project = (env.FIREBASE_PROJECT_ID || "demo-activityos").trim();
  if (project === LIVE_PROJECT_ID) problems.push(`FIREBASE_PROJECT_ID is the LIVE project (${LIVE_PROJECT_ID})`);
  else if (!project.startsWith("demo-")) problems.push(`FIREBASE_PROJECT_ID "${project}" does not start with "demo-"`);
  if (env.FIREBASE_SERVICE_ACCOUNT) problems.push("FIREBASE_SERVICE_ACCOUNT is set (live credentials must not be present)");
  if (env.GOOGLE_APPLICATION_CREDENTIALS) problems.push("GOOGLE_APPLICATION_CREDENTIALS is set (live credentials must not be present)");
  const sk = env.STRIPE_SECRET_KEY?.trim();
  if (sk && !sk.startsWith("sk_test")) problems.push("STRIPE_SECRET_KEY is set but is not a test key (must start with sk_test)");
  return problems;
}

/** Call first thing at startup. Exits (code 78) with a clear message if TEST_STACK=1 and anything is unsafe. */
export function enforceTestStackGuard(env: Env = process.env): void {
  const problems = testStackProblems(env);
  if (problems.length) {
    console.error("\nREFUSING TO START: TEST_STACK=1 but this is not safely pointed at the Firebase emulator.");
    for (const p of problems) console.error(`  - ${p}`);
    console.error("Start the emulators (npm run emu:start) and use npm run dev:emu:api. Nothing was started.\n");
    process.exit(78);
  }
  if (env.TEST_STACK === "1") console.log(`[test-stack] guard OK: emulator only (project ${env.FIREBASE_PROJECT_ID || "demo-activityos"}).`);
}
