import fs from "node:fs"; import path from "node:path";
import { fbSignUp, apiPost, apiFetch, TEST_EMAIL_DOMAIN } from "../helpers/accounts";
import { ROOT } from "../helpers/env";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const admin = require("/Users/kazjames/Downloads/activtyos-app-/server/node_modules/firebase-admin");
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(require("/Users/kazjames/Downloads/activtyos-app-/server/serviceAccountKey.json")) });
export const OUTJ = path.join(ROOT, "e2e/review/shots/embed/seed.json");
const iso = (d: Date) => d.toISOString().slice(0, 10);
export async function seed() {
  const email = `e2e-embed-${Date.now().toString(36)}@${TEST_EMAIL_DOMAIN}`;
  const s = await fbSignUp(email);
  const r = await apiPost<{ tenantId: string }>("/api/register-role", s.idToken, { role: "freelancer", businessName: "Riverside Activity Camps", providerName: "Riverside Activity Camps", providerNameMode: "business" });
  await admin.firestore().collection("tenants").doc(r.tenantId).set({ subscription: { status: "trialing", plan: "freelancer" } }, { merge: true });
  const t = s.idToken;
  const lib = ((await apiFetch<any>("/api/library", t)) ?? {}) as any;
  const settings = { ...(lib.settings ?? {}), billing: { ...(lib.settings?.billing ?? {}), bankName: "Test Bank", sortCode: "20-57-44", accountNumber: "63437582", accountName: "Riverside Activity Camps", email } };
  await apiFetch("/api/library", t, { method: "PUT", body: JSON.stringify({ venues: [{ id: "emb-v", name: "Northampton Sports Hall", address: "1 Test Way, Northampton", city: "Northampton", lat: 52.24, lng: -0.9, zoom: 16 }], settings }) });
  const period = await apiPost<{ id: string }>("/api/periods", t, { title: "Full day", start: "09:00", finish: "15:30" });
  const pass = await apiPost<{ id: string }>("/api/passes", t, { name: "1 day", days: 1 });
  const bundle = await apiPost<{ id: string }>("/api/block-bundles", t, { name: "Embed block", periodIds: [period.id], passIds: [pass.id], priced: true, masterPrice: 20, calcOn: false, passFlat: { [pass.id]: 20 }, periodPrice: { [`${pass.id}_${period.id}`]: 20 } });
  const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); const e = new Date(d); e.setDate(e.getDate() + 20);
  const mk = async (title: string, status: string) => {
    const l = await apiPost<{ id: string }>("/api/listings", t, { title, venueId: "emb-v", runFrom: iso(d), runTo: iso(e), blockMode: "weekly", days: [1, 2, 3, 4, 5], maxAttendees: "16", capacityScope: "day", ageFrom: "5", ageTo: "11", blockId: bundle.id, passes: [{ name: "1 day", price: 20, days: 1 }], bookingType: "auto", status, visibility: "public" });
    return l.id;
  };
  const live = await mk("Embed Live Camp", "live");
  const draft = await mk("Embed Draft Camp", "draft");
  await apiFetch(`/api/block-bundles/${bundle.id}/listings`, t, { method: "PUT", body: JSON.stringify({ listingIds: [live, draft] }) });
  const out = { email, tenantId: r.tenantId, live, draft, bundle: bundle.id };
  fs.writeFileSync(OUTJ, JSON.stringify(out, null, 1));
  return out;
}
if (process.argv[1]?.endsWith("embed-seed.ts")) seed().then((o) => { console.log(JSON.stringify(o)); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
