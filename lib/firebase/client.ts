// Firebase web SDK — client-side auth only (all data goes through the
// Express API, which verifies the ID token; the browser never talks to
// Firestore directly).
import { getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps()[0] ?? initializeApp(config);

export const firebaseAuth = getAuth(app);

// Local development against the Firebase Auth emulator (no real project
// needed): set NEXT_PUBLIC_FIREBASE_EMULATOR=1.
if (
  process.env.NEXT_PUBLIC_FIREBASE_EMULATOR === "1" &&
  typeof window !== "undefined" &&
  !("emulatorConfig" in firebaseAuth && firebaseAuth.emulatorConfig)
) {
  connectAuthEmulator(firebaseAuth, "http://127.0.0.1:9099", { disableWarnings: true });
}
