import fs from "node:fs";
import { fbSignUp, fbSignIn, TEST_EMAIL_DOMAIN } from "../helpers/accounts";
import { API_URL } from "../helpers/env";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const admin = require("/Users/kazjames/Downloads/activtyos-app-/server/node_modules/firebase-admin");
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(require("/Users/kazjames/Downloads/activtyos-app-/server/serviceAccountKey.json")) });
export const db = admin.firestore();
export const STATE = "/private/tmp/claude-501/-Users-kazjames-Downloads-activtyos-app-/d6be64b6-4124-4419-9525-b7eb6fbb7058/scratchpad/hv-state.json";
export const SHOTS = "/Users/kazjames/Downloads/activtyos-app-/e2e/review/shots/hv";
export const stamp = process.env.HV_STAMP || Date.now().toString(36);
export const em = (k: string) => `e2e-hv-${k}-${stamp}@${TEST_EMAIL_DOMAIN}`;
export async function call(tok: string | null, method: string, url: string, body?: unknown) {
  let res!: Response;
  for (let a = 0; ; a++) { try { res = await fetch(`${API_URL}${url}`, { method, headers: { "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }); break; } catch (e) { if (a >= 12) throw e; await new Promise((r) => setTimeout(r, 4000)); } }
  let json: any = null; try { json = await res.json(); } catch { /* empty */ }
  return { status: res.status, json };
}
export const ok = async (tok: string | null, method: string, url: string, body?: unknown) => { const r = await call(tok, method, url, body); if (r.status >= 300) throw new Error(`${method} ${url} -> ${r.status} ${JSON.stringify(r.json).slice(0, 300)}`); return r.json; };
export const pad = (n: number) => String(n).padStart(2, "0");
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const today = new Date();
export const nextMonday = addDays(today, (8 - today.getDay()) % 7 || 7);
export interface Acct { email: string; uid: string; tenantId: string | null }
export const load = () => JSON.parse(fs.readFileSync(STATE, "utf8"));
export const save = (s: unknown) => fs.writeFileSync(STATE, JSON.stringify(s, null, 1));
export async function tokFor(email: string) { return (await fbSignIn(email)).idToken; }
export async function provider(key: string, role: "freelancer" | "company", name: string) {
  const s = await fbSignUp(em(key));
  const r = await call(s.idToken, "POST", "/api/register-role", { role, businessName: name, providerName: name, providerNameMode: "business", ownerName: "Sam Provider", address: "12 Corris Court", postcode: "MK10 9NR", contactEmail: em(key), phone: "07700900123" });
  if (r.status >= 300) throw new Error("register " + JSON.stringify(r.json));
  const tenantId = r.json.tenantId as string;
  await db.collection("tenants").doc(tenantId).set({ subscription: { status: "trialing", plan: role === "company" ? "company" : "freelancer", since: new Date().toISOString() } }, { merge: true });
  const lib = (await call(s.idToken, "GET", "/api/library")).json ?? {};
  const venues = [{ id: "hv-venue", name: "HV Sports Hall", address: "1 Venue Way, Northampton", city: "Northampton" }, { id: "hv-online", name: "Online", address: "", kind: "online", directions: "Join on Zoom: https://zoom.example/j/123456 (meeting ID 123 456). Have a pencil ready." }];
  await ok(s.idToken, "PUT", "/api/library", { venues, settings: { ...(lib.settings ?? {}), billing: { ...((lib.settings ?? {}).billing ?? {}), bankName: "Test Bank", sortCode: "20-57-44", accountNumber: "63437582", accountName: name, email: em(key) }, providerName: name } });
  return { email: em(key), uid: s.uid, tenantId };
}
export async function parent(key: string, postcode = "NN5 7EA") {
  const s = await fbSignUp(em(key));
  const r = await call(s.idToken, "POST", "/api/register-role", { role: "parent", postcode, firstName: key.toUpperCase(), lastName: "Parent" });
  if (r.status >= 300) throw new Error("register parent " + JSON.stringify(r.json));
  await call(s.idToken, "POST", "/api/me/welcome", {});
  return { email: em(key), uid: s.uid, tenantId: null };
}
