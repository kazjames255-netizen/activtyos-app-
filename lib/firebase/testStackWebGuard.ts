// Web side of the test-stack guard (see server/src/lib/testStackGuard.ts). When NEXT_PUBLIC_TEST_STACK=1 the dev server
// must be pointed at the Firebase Auth emulator and a demo- project, and at a local API. Pure, so it is unit-tested.
type Env = Record<string, string | undefined>;

const LOCAL = /^(?:https?:\/\/)?(localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?\/?$/i;

export function webTestStackProblems(env: Env): string[] {
  if (env.NEXT_PUBLIC_TEST_STACK !== "1") return [];
  const problems: string[] = [];
  const host = env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
  if (!host) problems.push("NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST is not set");
  else if (!LOCAL.test(host.trim())) problems.push("NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST does not point at localhost / 127.0.0.1 / [::1]");
  const project = env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "";
  if (!project.startsWith("demo-")) problems.push(`NEXT_PUBLIC_FIREBASE_PROJECT_ID "${project}" does not start with "demo-"`);
  const api = env.NEXT_PUBLIC_API_URL;
  if (api && !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\/?$/i.test(api.trim())) problems.push("NEXT_PUBLIC_API_URL is not a local address");
  return problems;
}

export function enforceWebTestStackGuard(env: Env = process.env): void {
  const problems = webTestStackProblems(env);
  if (problems.length) {
    console.error("\nREFUSING TO START: NEXT_PUBLIC_TEST_STACK=1 but the web app is not safely pointed at the Firebase emulator.");
    for (const p of problems) console.error(`  - ${p}`);
    console.error("Use npm run dev:emu:web (after npm run emu:start). Nothing was started.\n");
    process.exit(78);
  }
}
