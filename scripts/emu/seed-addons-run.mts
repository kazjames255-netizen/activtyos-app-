/**
 * Seed the add-ons run's fixtures (CASES-v2.md of ~/ActivityOS-QA/runs/addons-2026-10-08) into a LOCAL emulator stack.
 *
 *   EMU_PORT_OFFSET=<n> server/node_modules/.bin/tsx scripts/emu/seed-addons-run.mts [--d1 10] [--extra-d1 4,2] [--reset] [--wipe]
 *
 *   --d1 N          D1 of LK, LK2, QL, FL = today + N days (default 10)
 *   --extra-d1 4,2  also create LK_D4 / LK_D2: copies of LK (same add-ons) starting today + 4 / today + 2, for the cut-off cases
 *   --reset         delete all bookings and their side data first, then seed (library, add-ons, settings restored)
 *   --wipe          wipe ALL Firestore + Auth data first (restart the API afterwards), then seed
 *
 * Refuses any non-local host (exit 78), SYNTHETIC DATA ONLY, idempotent, prints ids as JSON (never passwords).
 * Plumbing and the seed itself live in addons-helpers.mts. See ~/ActivityOS-QA/runs/addons-2026-10-08/SEED-README.md.
 */
import { resetToSeed, seedAddons } from "./addons-helpers.mts";

const flag = (n: string) => process.argv.includes(`--${n}`);
const val = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };
const d1 = val("d1") ? Number(val("d1")) : undefined;
const extraD1 = val("extra-d1") ? val("extra-d1")!.split(",").map(Number) : undefined;
if ((d1 !== undefined && !Number.isInteger(d1)) || (extraD1 ?? []).some((n) => !Number.isInteger(n))) { console.error("--d1 and --extra-d1 must be whole numbers of days"); process.exit(2); }

const out = flag("reset") || flag("wipe") ? await resetToSeed({ everything: flag("wipe"), d1, extraD1 }) : await seedAddons({ d1, extraD1 });
console.log(JSON.stringify({ ...out, note: "password is E2E_PASSWORD / e2e/.auth/e2e-password (not printed); ids also saved under .emu/" }, null, 2));
process.exit(0);
