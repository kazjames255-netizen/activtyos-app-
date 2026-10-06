import fs from "node:fs"; import path from "node:path";
import { ROOT } from "../helpers/env";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const admin = require("/Users/kazjames/Downloads/activtyos-app-/server/node_modules/firebase-admin");
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(require("/Users/kazjames/Downloads/activtyos-app-/server/serviceAccountKey.json")) });
const sd = JSON.parse(fs.readFileSync(path.join(ROOT, "e2e/review/shots/embed/seed.json"), "utf8"));
(async () => { const u = await admin.auth().getUserByEmail(sd.email); await admin.auth().updateUser(u.uid, { displayName: "Sam Taylor" }); await admin.firestore().collection("users").doc(u.uid).set({ name: "Sam Taylor" }, { merge: true }); console.log("named"); process.exit(0); })();
