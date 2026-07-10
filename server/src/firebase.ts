import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp, type AppOptions } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Credential resolution order:
//   1. GOOGLE_APPLICATION_CREDENTIALS (standard Admin SDK env var — path to a
//      service-account JSON)
//   2. server/serviceAccountKey.json (gitignored; drop the key from the
//      Firebase console → Project settings → Service accounts here)
//   3. No credential (works against the Firebase emulators, where
//      FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST are set)
const here = path.dirname(fileURLToPath(import.meta.url));
const keyPath = path.resolve(here, "../serviceAccountKey.json");

const usingEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;

const options: AppOptions = {};
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  // Admin SDK reads the env var itself; nothing to configure.
} else if (fs.existsSync(keyPath)) {
  const key = JSON.parse(fs.readFileSync(keyPath, "utf8"));
  options.credential = cert(key);
  options.projectId = key.project_id;
} else if (usingEmulator) {
  options.projectId = process.env.FIREBASE_PROJECT_ID || "demo-activityos";
} else {
  throw new Error(
    "No Firebase credentials found. Set GOOGLE_APPLICATION_CREDENTIALS, " +
      "save server/serviceAccountKey.json, or run the Firebase emulators.",
  );
}

const app = getApps()[0] ?? initializeApp(options);

export const db = getFirestore(app);
// Booking objects contain optional fields; don't reject docs over `undefined`.
db.settings({ ignoreUndefinedProperties: true });

export const auth = getAuth(app);
