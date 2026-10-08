/**
 * Seed the frozen coupon run's fixtures (CASES-v2.md) into a LOCAL API running against the Firebase emulators.
 *
 *   server/node_modules/.bin/tsx scripts/emu/seed-coupon-run.mts [--api http://localhost:4101] [--auth 127.0.0.1:9099]
 *
 * SYNTHETIC DATA ONLY. Every name, email and amount is generated below; nothing is read from, exported from or sent to
 * the live project or the live API. The script refuses to run unless the API and the Auth host are on this machine.
 * It makes no Stripe calls. Idempotent: re-running reuses accounts, listings and codes that already exist.
 * Prints ids as JSON (never passwords). Password: E2E_PASSWORD or the gitignored e2e/.auth/e2e-password.
 *
 * Fixtures: providers P and Q (Q has one code, QCODE); P's listings LA 20/day, LB 15, LC 14.99, LD 20 + 5 add-on per child,
 * LM 20 manual approval (card hold); parents A, B, F; P's codes as listed in CASES-v2.md, plus INACTIVE (active off, for C44).
 * Not seedable (no such setting in the product): P20M's own maximum, order-wide provider maximum, code start date.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const API = arg("api", "http://localhost:4101").replace(/\/$/, "");
const AUTH = arg("auth", process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099");
const FS = arg("fs", process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080");
const LOCAL = /^(https?:\/\/)?(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;
if (!LOCAL.test(API) || !LOCAL.test(AUTH) || !LOCAL.test(FS)) { console.error("Refusing: --api and --auth and --fs must be on this machine (localhost / 127.0.0.1 / [::1])."); process.exit(78); }

function password(): string {
  if (process.env.E2E_PASSWORD) return process.env.E2E_PASSWORD;
  try { const p = readFileSync(resolve(here, "../../e2e/.auth/e2e-password"), "utf8").trim(); if (p) return p; } catch { /* below */ }
  throw new Error("No password: set E2E_PASSWORD or create e2e/.auth/e2e-password");
}
const PW = password();
const IDENTITY = `http://${AUTH}/identitytoolkit.googleapis.com/v1`;

async function idCall(endpoint: string, body: unknown): Promise<{ idToken?: string; localId?: string; error?: { message?: string } }> {
  const r = await fetch(`${IDENTITY}/${endpoint}?key=any`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json() as Promise<never>;
}
async function login(email: string): Promise<{ token: string; uid: string; created: boolean }> {
  let j = await idCall("accounts:signInWithPassword", { email, password: PW, returnSecureToken: true });
  let created = false;
  if (!j.idToken) { j = await idCall("accounts:signUp", { email, password: PW, returnSecureToken: true }); created = true; }
  if (!j.idToken) throw new Error(`Auth emulator refused ${email}: ${j.error?.message}`);
  return { token: j.idToken, uid: j.localId!, created };
}
async function call<T = any>(method: string, path: string, token: string | null, body?: unknown, okStatuses: number[] = []): Promise<{ status: number; json: T }> {
  const r = await fetch(`${API}${path}`, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const text = await r.text(); let json: any = null; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!r.ok && !okStatuses.includes(r.status)) throw new Error(`${method} ${path} -> ${r.status} ${typeof json === "string" ? json : JSON.stringify(json)}`);
  return { status: r.status, json };
}

const ukDay = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86400_000).toLocaleDateString("en-CA", { timeZone: "Europe/London" });
const iso = (d: Date) => d.toISOString().slice(0, 10);

async function provider(key: string, businessName: string) {
  const email = `provider-${key.toLowerCase()}@emu.test`;
  const s = await login(email);
  const reg = await call("POST", "/api/register-role", s.token, { role: "company", businessName, ownerName: `Test Owner ${key}`, providerName: businessName, providerNameMode: "business", agreedTermsAt: new Date().toISOString() }, [409]);
  const me = await call("GET", "/api/me", s.token);
  const tenantId = (reg.json?.tenantId ?? me.json?.tenantId) as string;
  // A fresh provider is walled until it starts a Stripe free trial (402 go_live_requirements). The emulator stack has no live
  // billing, so clear the tenant's subscription field in the EMULATOR's Firestore (the state of accounts that predate the gate).
  const clr = await fetch(`http://${FS}/v1/projects/demo-activityos/databases/(default)/documents/tenants/${tenantId}?updateMask.fieldPaths=subscription`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: "Bearer owner" }, body: JSON.stringify({ fields: {} }) });
  if (!clr.ok) throw new Error(`could not clear subscription in the emulator: ${clr.status}`);
  return { email, ...s, tenantId };
}
async function parent(key: string, homeTenantId?: string) {
  const email = `parent-${key.toLowerCase()}@emu.test`;
  const s = await login(email);
  await call("POST", "/api/register-role", s.token, { role: "parent", firstName: "Test", lastName: `Parent ${key}`, ...(homeTenantId ? { providerId: homeTenantId } : {}) }, [409]);
  return { email, uid: s.uid };
}

type ListingSpec = { key: string; title: string; price: number; approval?: boolean; addon?: boolean };
async function ensureListings(token: string, specs: ListingSpec[], tenantTag: string): Promise<Record<string, string>> {
  // venue + marketplace opt-in; add-on in the library (PUT replaces each top-level key wholesale, so merge)
  const lib = (await call("GET", "/api/library", token)).json ?? {};
  const venues: any[] = lib.venues ?? [];
  const addons: any[] = lib.addons ?? [];
  const addonId = `addon-emu-${tenantTag}-extra`;
  if (!addons.some((a) => a.id === addonId)) addons.push({ id: addonId, name: "Extra kit", type: "once", price: 5, description: "Synthetic test add-on, 5 pounds per child" });
  if (!venues.some((v) => v.id === "emu-venue")) venues.push({ id: "emu-venue", name: "Test Sports Hall", address: "1 Test Way", city: "Testville" });
  await call("PUT", "/api/library", token, { venues, addons, settings: { ...(lib.settings ?? {}), marketplaceListed: true } });

  const have: any[] = (await call("GET", "/api/listings", token)).json ?? [];
  const out: Record<string, string> = {};
  const start = new Date(); start.setDate(start.getDate() + ((8 - start.getDay()) % 7 || 7)); // next Monday
  const end = new Date(start); end.setDate(end.getDate() + 27);
  for (const sp of specs) {
    const existing = have.find((l) => l.title === sp.title);
    if (existing) { out[sp.key] = existing.id; continue; }
    const period = await call("POST", "/api/periods", token, { title: "Full day", start: "09:00", finish: "15:30" });
    const pass = await call("POST", "/api/passes", token, { name: "Day pass", days: 1 });
    const bundle = await call("POST", "/api/block-bundles", token, { name: `Emu block ${sp.title}`, periodIds: [period.json.id], passIds: [pass.json.id], priced: true, masterPrice: sp.price, calcOn: true });
    const listing = await call("POST", "/api/listings", token, {
      title: sp.title, venueId: "emu-venue", runFrom: iso(start), runTo: iso(end), blockMode: "weekly", days: [1, 2, 3, 4, 5],
      maxAttendees: "16", capacityScope: "day", showSpaces: true, ageFrom: "5", ageTo: "12", blockId: bundle.json.id,
      passes: [{ name: "Day pass", price: sp.price, days: 1 }],
      ...(sp.approval ? {} : { bookingType: "auto" }), // omitted = "Approval needed" (card paid bookings then take a card hold)
      ...(sp.addon ? { addonIds: [addonId] } : {}),
      status: "live", visibility: "public",
    });
    await call("PUT", `/api/block-bundles/${bundle.json.id}/listings`, token, { listingIds: [listing.json.id] });
    out[sp.key] = listing.json.id;
  }
  return out;
}

async function ensureCodes(token: string, codes: Record<string, unknown>[]): Promise<string[]> {
  const have: any[] = (await call("GET", "/api/discounts", token)).json ?? [];
  const made: string[] = [];
  for (const c of codes) {
    if (have.some((h) => String(h.code).toUpperCase() === String(c.code).toUpperCase())) continue;
    await call("POST", "/api/discounts", token, c); made.push(String(c.code));
  }
  return made;
}

const P = await provider("P", "Emu Test Provider P");
const Q = await provider("Q", "Emu Test Provider Q");
const A = await parent("A", P.tenantId), B = await parent("B", P.tenantId), F = await parent("F", P.tenantId);

const L = await ensureListings(P.token, [
  { key: "LA", title: "LA Day camp 20", price: 20 },
  { key: "LB", title: "LB Day camp 15", price: 15 },
  { key: "LC", title: "LC Day camp 14.99", price: 14.99 },
  { key: "LD", title: "LD Day camp 20 plus add-on", price: 20, addon: true },
  { key: "LM", title: "LM Manual approval 20", price: 20, approval: true },
], "p");

const pct = (code: string, value: number, extra: Record<string, unknown> = {}) => ({ code, type: "percent", value, ...extra });
const codesMade = await ensureCodes(P.token, [
  pct("TEST10", 10),
  { code: "OFF5", type: "amount", value: 5 },
  { code: "KID2", type: "perAttendee", value: 2 },
  { code: "MIN30", type: "amount", value: 5, minSpend: 30 },
  pct("OLD", 10, { expiry: ukDay(-1) }),
  pct("EXPTODAY", 10, { expiry: ukDay(0) }),
  pct("ONCE", 10, { usageLimit: 1 }),
  pct("ONE2", 10, { usageLimit: 1 }),
  pct("FAM", 10, { assignedTo: F.email, assignedName: "Test Parent F" }),
  pct("P20", 20),
  { code: "EXCL", type: "amount", value: 3, exclusive: true },
  { code: "BIG", type: "amount", value: 50 },
  pct("FREE", 100),
  pct("LISTONLY", 10, { listingId: L.LA }),
  pct("PERCUST", 10, { perCustomerLimit: true }),
  pct("ONEM", 10, { usageLimit: 1 }),
  pct("INACTIVE", 10, { active: false }),
]);
const qCodes = await ensureCodes(Q.token, [pct("QCODE", 10)]);

console.log(JSON.stringify({
  api: API, authEmulator: AUTH,
  providers: { P: { tenantId: P.tenantId, uid: P.uid, email: P.email }, Q: { tenantId: Q.tenantId, uid: Q.uid, email: Q.email } },
  parents: { A, B, F },
  listings: L,
  codesCreatedThisRun: { P: codesMade, Q: qCodes },
  note: "password is the one in E2E_PASSWORD / e2e/.auth/e2e-password (not printed)",
}, null, 2));
