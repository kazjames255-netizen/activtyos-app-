// Shared setup for the emulator behaviour tests (run with `npm run test:emu`, never part of `npm run test:all`).
// Everything goes through the REAL API (started by scripts/emu/test-emu.mjs against the Firebase emulators) or the REAL server
// lib functions, which talk to the same emulator. Synthetic data only; refuses to run unless every host is on this machine.
import assert from "node:assert/strict";

const LOCAL = /^(https?:\/\/)?(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;
export const API = (process.env.EMU_API ?? "").replace(/\/$/, "");
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "";
const FS = process.env.FIRESTORE_EMULATOR_HOST ?? "";
if (!API || !LOCAL.test(API) || !LOCAL.test(AUTH) || !LOCAL.test(FS) || process.env.TEST_STACK !== "1") {
  console.error("Refusing: these tests only run against the local emulator stack (use `npm run test:emu`).");
  process.exit(78);
}
const PW = process.env.E2E_PASSWORD ?? "";
assert.ok(PW, "E2E_PASSWORD is set by scripts/emu/test-emu.mjs");

// The server's own Firestore handle, pointed at the emulator by the environment above.
export const { db } = await import("../../server/src/firebase");

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const uniq = () => Math.random().toString(36).slice(2, 8);

const IDENTITY = `http://${AUTH}/identitytoolkit.googleapis.com/v1`;
async function idCall(endpoint: string, body: unknown) {
  const r = await fetch(`${IDENTITY}/${endpoint}?key=any`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return (await r.json()) as { idToken?: string; localId?: string; error?: { message?: string } };
}
export async function login(email: string) {
  let j = await idCall("accounts:signInWithPassword", { email, password: PW, returnSecureToken: true });
  if (!j.idToken) j = await idCall("accounts:signUp", { email, password: PW, returnSecureToken: true });
  assert.ok(j.idToken, `Auth emulator refused ${email}: ${j.error?.message}`);
  return { token: j.idToken!, uid: j.localId! };
}

export async function call<T = any>(method: string, path: string, token: string | null, body?: unknown): Promise<{ status: number; json: T }> {
  const r = await fetch(`${API}${path}`, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const text = await r.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: r.status, json };
}
export async function ok<T = any>(method: string, path: string, token: string | null, body?: unknown): Promise<T> {
  const r = await call<T>(method, path, token, body);
  assert.ok(r.status >= 200 && r.status < 300, `${method} ${path} -> ${r.status} ${JSON.stringify(r.json).slice(0, 400)}`);
  return r.json;
}

export interface Provider { tenantId: string; token: string; email: string }
export interface Parent { token: string; email: string }

export async function makeProvider(tag: string): Promise<Provider> {
  const email = `prov-${tag}-${uniq()}@emu.test`;
  const s = await login(email);
  const reg = await call("POST", "/api/register-role", s.token, { role: "company", businessName: `Emu ${tag}`, ownerName: "Test Owner", providerName: `Emu ${tag}`, providerNameMode: "business", agreedTermsAt: new Date().toISOString() });
  assert.ok(reg.status < 300 || reg.status === 409, `register provider ${reg.status} ${JSON.stringify(reg.json)}`);
  const me = await ok("GET", "/api/me", s.token);
  const tenantId = (reg.json?.tenantId ?? me.tenantId) as string;
  assert.ok(tenantId, "provider has a tenant");
  // A fresh provider is walled until a Stripe trial starts; the emulator has no billing, so clear it (as the seed script does).
  const clr = await fetch(`http://${FS}/v1/projects/demo-activityos/databases/(default)/documents/tenants/${tenantId}?updateMask.fieldPaths=subscription`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: "Bearer owner" }, body: JSON.stringify({ fields: {} }) });
  assert.ok(clr.ok, `could not clear subscription in the emulator: ${clr.status}`);
  return { tenantId, token: s.token, email };
}
export async function makeParent(tag: string, p: Provider): Promise<Parent> {
  const email = `parent-${tag}-${uniq()}@emu.test`;
  const s = await login(email);
  await call("POST", "/api/register-role", s.token, { role: "parent", firstName: "Test", lastName: `Parent ${tag}`, providerId: p.tenantId });
  return { token: s.token, email };
}

export interface Listing { id: string; blockId: string }
/** A 4-week weekday day-camp at 20 pounds a day. `approval` = manual approval ("Approval needed"), otherwise auto-confirm. */
export async function makeListing(p: Provider, title: string, approval: boolean): Promise<Listing> {
  const lib = (await ok("GET", "/api/library", p.token)) ?? {};
  const venues: any[] = lib.venues ?? [];
  if (!venues.some((v) => v.id === "emu-venue")) venues.push({ id: "emu-venue", name: "Test Sports Hall", address: "1 Test Way", city: "Testville" });
  await ok("PUT", "/api/library", p.token, { venues, addons: lib.addons ?? [], settings: { ...(lib.settings ?? {}), marketplaceListed: true } });
  const start = new Date(); start.setDate(start.getDate() + ((8 - start.getDay()) % 7 || 7));
  const end = new Date(start); end.setDate(end.getDate() + 27);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const period = await ok("POST", "/api/periods", p.token, { title: "Full day", start: "09:00", finish: "15:30" });
  const pass = await ok("POST", "/api/passes", p.token, { name: "Day pass", days: 1 });
  const bundle = await ok("POST", "/api/block-bundles", p.token, { name: `Emu block ${title}`, periodIds: [period.id], passIds: [pass.id], priced: true, masterPrice: 20, calcOn: true });
  const listing = await ok("POST", "/api/listings", p.token, {
    title, venueId: "emu-venue", runFrom: iso(start), runTo: iso(end), blockMode: "weekly", days: [1, 2, 3, 4, 5],
    maxAttendees: "500", capacityScope: "day", showSpaces: true, ageFrom: "5", ageTo: "12", blockId: bundle.id,
    passes: [{ name: "Day pass", price: 20, days: 1 }],
    ...(approval ? {} : { bookingType: "auto" }),
    status: "live", visibility: "public",
  });
  await ok("PUT", `/api/block-bundles/${bundle.id}/listings`, p.token, { listingIds: [listing.id] });
  const blocks = await db.collection("blocks").where("listingId", "==", listing.id).get();
  assert.ok(!blocks.empty, "the listing has a block");
  return { id: listing.id, blockId: blocks.docs[0].id };
}

export interface Code { id: string; code: string }
/** A percentage code. `usageLimit` omitted = unlimited, but usedCount is still counted. */
export async function makeCode(p: Provider, code: string, extra: Record<string, unknown> = {}): Promise<Code> {
  await ok("POST", "/api/discounts", p.token, { code, type: "percent", value: 10, ...extra });
  const snap = await db.collection("discountCodes").where("tenantId", "==", p.tenantId).where("code", "==", code).limit(1).get();
  assert.ok(!snap.empty, `code ${code} exists`);
  return { id: snap.docs[0].id, code };
}
export const usedCount = async (c: Code) => Number((await db.collection("discountCodes").doc(c.id).get()).get("usedCount") ?? 0);
export const redemptionsFor = async (c: Code) => (await db.collection("discountRedemptions").where("codeId", "==", c.id).get()).docs;

let childN = 0;
/** One parent books one child for one day (the first Monday-Friday of the run), optionally with a code. Returns the booking ref. */
export async function book(parent: Parent, l: Listing, o: { code?: string; method?: string; children?: number } = {}): Promise<string> {
  const n = o.children ?? 1;
  const items = Array.from({ length: n }, () => ({ pass: "Day pass", child: `Kid ${++childN}${uniq()}`, age: 8 }));
  const r = await call("POST", "/api/my/bookings", parent.token, { listingId: l.id, blockId: l.blockId, method: o.method ?? "Bank transfer", items, ...(o.code ? { discountCode: o.code } : {}) });
  assert.ok(r.status < 300, `book -> ${r.status} ${JSON.stringify(r.json).slice(0, 400)}`);
  const list = Array.isArray(r.json) ? r.json : (r.json?.bookings ?? [r.json]);
  const ref = (list[0]?.ref ?? list[0]?.booking?.ref) as string;
  assert.ok(ref, `booking ref in ${JSON.stringify(r.json).slice(0, 300)}`);
  return ref;
}

export const bookingDoc = async (p: Provider, ref: string) => (await db.collection("bookings").doc(`${p.tenantId}_${ref}`).get()).data() as Record<string, any>;
export const patchBooking = (p: Provider, ref: string, patch: Record<string, unknown>) => db.collection("bookings").doc(`${p.tenantId}_${ref}`).set(patch, { merge: true });

/** Releases run after the response (fire and forget), so wait for the code to reach the value, then hold a moment to catch a late second release. */
export async function settle(c: Code, expected: number, label: string, quietMs = 600): Promise<void> {
  const until = Date.now() + 8000;
  let n = await usedCount(c);
  while (n !== expected && Date.now() < until) { await sleep(150); n = await usedCount(c); }
  await sleep(quietMs);
  n = await usedCount(c);
  assert.equal(n, expected, `${label}: usedCount should be ${expected} but is ${n}`);
}
/** Assert the count stays put for a moment (for "must NOT release"). */
export const stays = (c: Code, expected: number, label: string) => settle(c, expected, label, 1200);

export const operatorAction = (p: Provider, ref: string, action: Record<string, unknown>) => call("POST", `/api/bookings/${encodeURIComponent(ref)}/actions`, p.token, action);
export const bulk = (p: Provider, refs: string[], action: "approve" | "decline" | "waitlist" | "cancel") => call("POST", "/api/bookings/bulk", p.token, { refs, action });
