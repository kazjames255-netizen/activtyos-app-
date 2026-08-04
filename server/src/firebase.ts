import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp, type AppOptions } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Credential resolution order:
//   1. Emulator mode (FIRESTORE_EMULATOR_HOST set) — no real credentials are
//      loaded even if a service-account key exists, so an emulator run can
//      never mix project ids with (or touch) the real project.
//   2. FIREBASE_SERVICE_ACCOUNT — the service-account JSON itself, inline, as
//      either raw JSON or base64 (base64 avoids newline/quoting mangling in a
//      host's secret store). This is how a hosted API (Render / Railway / Fly)
//      gets its credentials, since those inject secrets as env VALUES, not files.
//   3. GOOGLE_APPLICATION_CREDENTIALS (standard Admin SDK env var — path to a
//      service-account JSON)
//   4. server/serviceAccountKey.json (gitignored; drop the key from the
//      Firebase console → Project settings → Service accounts here)
const here = path.dirname(fileURLToPath(import.meta.url));
const keyPath = path.resolve(here, "../serviceAccountKey.json");

/** Parse the inline service-account env var (raw JSON or base64-encoded JSON). */
function inlineServiceAccount(): Record<string, string> | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!raw) return null;
  const json = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  return JSON.parse(json);
}

const usingEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
const inlineKey = usingEmulator ? null : inlineServiceAccount();

const options: AppOptions = {};
if (usingEmulator) {
  options.projectId = process.env.FIREBASE_PROJECT_ID || "demo-activityos";
} else if (inlineKey) {
  options.credential = cert(inlineKey);
  options.projectId = inlineKey.project_id;
} else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  // Admin SDK reads the env var itself; nothing to configure.
} else if (fs.existsSync(keyPath)) {
  const key = JSON.parse(fs.readFileSync(keyPath, "utf8"));
  options.credential = cert(key);
  options.projectId = key.project_id;
} else {
  throw new Error(
    "No Firebase credentials found. Set FIREBASE_SERVICE_ACCOUNT (inline JSON " +
      "or base64) or GOOGLE_APPLICATION_CREDENTIALS, save " +
      "server/serviceAccountKey.json, or run the Firebase emulators.",
  );
}

const app = getApps()[0] ?? initializeApp(options);

export const db = getFirestore(app);
// Booking objects contain optional fields; don't reject docs over `undefined`.
db.settings({ ignoreUndefinedProperties: true });

export const auth = getAuth(app);
