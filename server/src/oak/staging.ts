// Creates (or finds) the throwaway "OakStaging" tenant used to test the Oak import — a real freelancer tenant with the
// Learning Hub switched on, on the live dev stack (needs the API on :4000). Same approach as hubLoadTest.ts: its OWN
// accounts (`oakstaging-*@example.com`, NOT the @activityos-test.com domain the e2e suite wipes), subscription gate removed.
//
//   cd server && npx tsx src/oak/staging.ts create     # idempotent: prints the existing tenant if one is recorded
//   npx tsx src/oak/staging.ts info
//   npx tsx src/oak/staging.ts remove                  # runs `import.ts clean`, then deletes the tenant + accounts
//
// State file: scratch/oak-staging.json (ids, logins).
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FieldValue } from "firebase-admin/firestore";
import { auth, db } from "../firebase";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "../../..");
const STATE = path.join(ROOT, "scratch/oak-staging.json");
const API = process.env.OAK_API || "http://localhost:4000";
const PW = "E2etest!123";

function apiKey(): string {
  if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY) return process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^\s*NEXT_PUBLIC_FIREBASE_API_KEY\s*=\s*(.*)\s*$/);
    if (m) return m[1].replace(/^["']|["']$/g, "");
  }
  throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY not found");
}
async function identity(endpoint: string, body: unknown) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/${endpoint}?key=${apiKey()}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = (await res.json()) as { idToken?: string; localId?: string; error?: { message?: string } };
  if (!res.ok || !j.idToken) throw new Error(`${endpoint}: ${j.error?.message ?? res.status}`);
  return { idToken: j.idToken, uid: j.localId! };
}
async function call<T = unknown>(pathQ: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${pathQ}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...init?.headers } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${pathQ} → ${res.status} ${text.slice(0, 200)}`);
  return JSON.parse(text) as T;
}
interface State { tenantId: string; tutor: { email: string; uid: string; password: string }; parent: { email: string; uid: string; password: string; childId: string } | null; createdAt: string }

async function create() {
  if (fs.existsSync(STATE)) { console.log(fs.readFileSync(STATE, "utf8")); return; }
  const runId = Date.now().toString(36);
  const tEmail = `oakstaging-tutor-${runId}@example.com`;
  const t = await identity("accounts:signUp", { email: tEmail, password: PW, returnSecureToken: true });
  const r = await call<{ tenantId: string }>("/api/register-role", t.idToken, { method: "POST", body: JSON.stringify({ role: "freelancer", businessName: "OakStaging", providerName: "OakStaging", providerNameMode: "business" }) });
  await db.collection("tenants").doc(r.tenantId).update({ subscription: FieldValue.delete() });
  const lib = (await call<{ settings?: Record<string, unknown> } | null>("/api/library", t.idToken)) ?? {};
  const settings = { ...(lib.settings ?? {}), features: { ...((lib.settings?.features as Record<string, boolean>) ?? {}), learninghub: true } };
  await call("/api/library", t.idToken, { method: "PUT", body: JSON.stringify({ settings }) });
  const state: State = { tenantId: r.tenantId, tutor: { email: tEmail, uid: t.uid, password: PW }, parent: null, createdAt: new Date().toISOString() };
  fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
  console.log(`OakStaging tenant ${r.tenantId} (tutor ${tEmail} / ${PW}) — hub enabled. State: ${STATE}`);
}

async function remove() {
  if (!fs.existsSync(STATE)) { console.log("no staging state"); return; }
  const s = JSON.parse(fs.readFileSync(STATE, "utf8")) as State;
  console.log(`Run first:  npx tsx src/oak/import.ts clean ${s.tenantId}`);
  await db.collection("tenants").doc(s.tenantId).delete();
  await db.collection("libraries").doc(s.tenantId).delete();
  for (const uid of [s.tutor.uid, s.parent?.uid].filter(Boolean) as string[]) { try { await auth.deleteUser(uid); } catch { /* already gone */ } await db.collection("users").doc(uid).delete(); }
  fs.unlinkSync(STATE);
  console.log("removed tenant + accounts");
}

(async () => {
  const cmd = process.argv[2];
  if (cmd === "create") await create();
  else if (cmd === "info") console.log(fs.existsSync(STATE) ? fs.readFileSync(STATE, "utf8") : "none");
  else if (cmd === "remove") await remove();
  else console.error("Usage: npx tsx src/oak/staging.ts create|info|remove");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
