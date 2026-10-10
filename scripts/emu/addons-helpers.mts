/**
 * Add-ons run (CASES-v2, 8 Oct 2026): seed + helpers for independent testers, against a LOCAL emulator stack only.
 *
 * Import what you need:   import { login, bookWithAddons, operatorAction, ... } from "../../scripts/emu/addons-helpers.mts";
 * Seed from the shell:    server/node_modules/.bin/tsx scripts/emu/seed-addons-run.mts   (thin wrapper around seedAddons below)
 *
 * Which stack: EMU_PORT_OFFSET (the same number you started the emulators and API with) picks API 4101+off, Auth 9099+off,
 * Firestore 8080+off. Override with EMU_API / FIREBASE_AUTH_EMULATOR_HOST / FIRESTORE_EMULATOR_HOST. Anything that is not
 * localhost / 127.0.0.1 / [::1] makes this module exit 78 at import. Password for every account: E2E_PASSWORD, or the gitignored
 * e2e/.auth/e2e-password (never printed). SYNTHETIC DATA ONLY (@emu.test); no Stripe calls, no mail (mailLog only).
 *
 * Seeded ids are written to .emu/addons-seed-<api port>.json (gitignored) and read back by ids().
 * DIRECT EMULATOR WRITES (documented shortcut, instead of heavy invites): the franchise user, all staff users and the platform
 * user are created by writing their `users/{uid}` documents in the EMULATOR Firestore (the same shape invites/accept writes).
 * Everything else (providers, parents, listings, add-ons, settings) goes through the real API.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "../..");
const LOCAL = /^(https?:\/\/)?(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;
const off = Number(process.env.EMU_PORT_OFFSET || 0);
export const API = (process.env.EMU_API || `http://localhost:${4101 + off}`).replace(/\/$/, "");
export const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST || `127.0.0.1:${9099 + off}`;
export const FS = process.env.FIRESTORE_EMULATOR_HOST || `127.0.0.1:${8080 + off}`;
if (!LOCAL.test(API) || !LOCAL.test(AUTH) || !LOCAL.test(FS)) { console.error("Refusing: API, Auth and Firestore hosts must be on this machine (localhost / 127.0.0.1 / [::1])."); process.exit(78); }
process.env.FIRESTORE_EMULATOR_HOST = FS;
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH;
process.env.FIREBASE_PROJECT_ID ||= "demo-activityos";
const PROJECT = process.env.FIREBASE_PROJECT_ID;
if (!PROJECT.startsWith("demo-")) { console.error("Refusing: project id must start with demo-"); process.exit(78); }

function password(): string {
  if (process.env.E2E_PASSWORD) return process.env.E2E_PASSWORD;
  for (const f of [process.env.E2E_PASSWORD_FILE ?? "", resolve(ROOT, "e2e/.auth/e2e-password"), `${process.env.HOME}/ActivityLane-QA/runs/addons-2026-10-08/.emu-password`]) {
    try { if (f) { const p = readFileSync(f, "utf8").trim(); if (p) return p; } } catch { /* next */ }
  }
  throw new Error("No password: set E2E_PASSWORD (or E2E_PASSWORD_FILE) or create e2e/.auth/e2e-password");
}
const PW = password();
const IDENTITY = `http://${AUTH}/identitytoolkit.googleapis.com/v1`;
const IDS_FILE = resolve(ROOT, `.emu/addons-seed-${new URL(API).port || "80"}.json`);

// ───────────────────────── plumbing ─────────────────────────
type IdResp = { idToken?: string; localId?: string; error?: { message?: string } };
async function idCall(endpoint: string, body: unknown): Promise<IdResp> {
  const r = await fetch(`${IDENTITY}/${endpoint}?key=any`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return (await r.json()) as IdResp;
}
export interface Session { email: string; token: string; uid: string; created: boolean }
const sessions = new Map<string, Session>();
/** Sign in (or create) an @emu.test account on the Auth emulator. Tokens last an hour; call login() again to refresh. */
export async function login(email: string): Promise<Session> {
  if (!/@emu\.test$/i.test(email)) throw new Error("Only @emu.test accounts are allowed");
  let j = await idCall("accounts:signInWithPassword", { email, password: PW, returnSecureToken: true });
  let created = false;
  if (!j.idToken) { j = await idCall("accounts:signUp", { email, password: PW, returnSecureToken: true }); created = true; }
  if (!j.idToken) throw new Error(`Auth emulator refused ${email}: ${j.error?.message}`);
  const s = { email, token: j.idToken, uid: j.localId!, created };
  sessions.set(email, s);
  return s;
}
export interface Res<T = any> { status: number; ok: boolean; json: T }
export async function call<T = any>(method: string, path: string, token: string | null, body?: unknown, headers: Record<string, string> = {}): Promise<Res<T>> {
  const r = await fetch(`${API}${path}`, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const text = await r.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: r.status, ok: r.ok, json };
}
async function must<T = any>(method: string, path: string, token: string | null, body?: unknown, allow: number[] = []): Promise<T> {
  const r = await call<T>(method, path, token, body);
  if (!r.ok && !allow.includes(r.status)) throw new Error(`${method} ${path} -> ${r.status} ${typeof r.json === "string" ? r.json : JSON.stringify(r.json).slice(0, 400)}`);
  return r.json;
}

let _db: FirebaseFirestore.Firestore | null = null;
/** The server's own Firestore handle, pointed at the EMULATOR (admin SDK). Used only for the documented direct writes and reset. */
export async function adminDb(): Promise<FirebaseFirestore.Firestore> {
  if (!_db) _db = (await import("../../server/src/firebase")).db as FirebaseFirestore.Firestore;
  return _db;
}

export const ukDay = (offsetDays = 0) => new Date(Date.now() + offsetDays * 86400_000).toLocaleDateString("en-CA", { timeZone: "Europe/London" });
const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// ───────────────────────── accounts ─────────────────────────
/** Role key -> email. P owner of the company tenant; Q a second company; F franchise under P; A/B parents of P. */
export const EMAILS = {
  P: "provider-p@emu.test", Q: "provider-q@emu.test", F: "franchise-f@emu.test",
  A: "parent-a@emu.test", B: "parent-b@emu.test",
  S1: "staff-s1@emu.test", // team LEAD, scoped to LK (listing assignment)
  S2: "staff-s2@emu.test", // ordinary staff, scoped to LK
  S3: "staff-s3@emu.test", // ordinary staff, scoped to LK2 only (other-site check)
  S4: "staff-s4@emu.test", // ordinary staff on LK whose role is set to Bookings: none, Registers: none (AP09)
  SF: "staff-sf@emu.test", // staff of franchise F (carries F's franchiseId)
  HQ: "platform-hq@emu.test", // platform (HQ) user, 2FA stamped verified for 12 h on each seed run
} as const;
export type RoleKey = keyof typeof EMAILS;
const ROLE_PW_NOTE = "all accounts share the one password";

// ───────────────────────── seed ─────────────────────────
export interface SeedOptions { d1?: number; extraD1?: number[] }
type ListingSpec = { key: string; title: string; perDay: number; days: number; d1: number; addonIds: string[]; franchise?: boolean };

// Deterministic add-on definitions (library ids are stable so cases and helpers can name them).
const Q_COLOUR = { id: "q-colour", label: "Colour", type: "choice" as const, options: ["Red", "Blue"], required: true };
const Q_SIZE = { id: "q-size", label: "Size", type: "choice" as const, options: ["S", "M", "L"], required: true };
export const ADDON_DEFS = {
  AW: { id: "addon-emu-aw", name: "Water bottle", type: "perday", price: 3, description: "Synthetic: 3 pounds per day", questions: [Q_COLOUR] },
  AT: { id: "addon-emu-at", name: "T-shirt", type: "once", price: 8, description: "Synthetic: 8 pounds one-off", questions: [Q_SIZE] },
  AL: { id: "addon-emu-al", name: "Lunch", type: "perday", price: 6, description: "Synthetic: 6 pounds per day" },
  AS: { id: "addon-emu-as", name: "Snack pack", type: "perday", price: 2, description: "Synthetic LK2 add-on: 2 pounds per day" },
  AF: { id: "addon-emu-af", name: "Franchise cap", type: "once", price: 4, description: "Synthetic franchise add-on: 4 pounds one-off" },
  AQ: { id: "addon-emu-aq", name: "Q Juice", type: "perday", price: 1.5, description: "Synthetic provider-Q add-on, no code, no question" },
} as const;
export type AddonKey = keyof typeof ADDON_DEFS;

async function mkProvider(key: "P" | "Q", businessName: string) {
  const s = await login(EMAILS[key]);
  const reg = await call("POST", "/api/register-role", s.token, { role: "company", businessName, ownerName: `Test Owner ${key}`, providerName: businessName, providerNameMode: "business", agreedTermsAt: new Date().toISOString() });
  if (!reg.ok && reg.status !== 409) throw new Error(`register ${key}: ${reg.status} ${JSON.stringify(reg.json)}`);
  const me = await must("GET", "/api/me", s.token);
  const tenantId = (reg.json?.tenantId ?? me.tenantId) as string;
  // A fresh provider is walled until a Stripe trial starts; the emulator has no billing, so clear the field there (as the coupon seed does).
  const clr = await fetch(`http://${FS}/v1/projects/${PROJECT}/databases/(default)/documents/tenants/${tenantId}?updateMask.fieldPaths=subscription`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: "Bearer owner" }, body: JSON.stringify({ fields: {} }) });
  if (!clr.ok) throw new Error(`could not clear subscription in the emulator: ${clr.status}`);
  return { ...s, tenantId };
}
async function mkParent(key: "A" | "B", homeTenantId: string) {
  const s = await login(EMAILS[key]);
  await call("POST", "/api/register-role", s.token, { role: "parent", firstName: "Test", lastName: `Parent ${key}`, providerId: homeTenantId });
  return s;
}

/** Library: venue + marketplace + addons + addonRequestDays (+ optional extra settings). PUT replaces top-level keys, so merge. */
async function setLibrary(token: string, addons: (typeof ADDON_DEFS)[AddonKey][], settings: Record<string, unknown>) {
  const lib = (await must("GET", "/api/library", token)) ?? {};
  const venues: any[] = lib.venues ?? [];
  if (!venues.some((v) => v.id === "emu-venue")) venues.push({ id: "emu-venue", name: "Test Sports Hall", address: "1 Test Way", city: "Testville" });
  const have: any[] = lib.addons ?? [];
  const merged = [...have.filter((a) => !addons.some((x) => x.id === a.id)), ...addons.map((a) => JSON.parse(JSON.stringify(a)))];
  await must("PUT", "/api/library", token, { venues, addons: merged, settings: { ...(lib.settings ?? {}), marketplaceListed: true, ...settings } });
}

/** A run of `days` consecutive days starting D1 = today + d1; passes "1-day pass".."N-day pass" at perDay each (7 days = 7 x 20 = 140). */
async function ensureListing(token: string, spec: ListingSpec): Promise<{ id: string; created: boolean }> {
  const have: any[] = (await must("GET", "/api/listings", token)) ?? [];
  const existing = have.find((l) => l.title === spec.title);
  if (existing) return { id: existing.id, created: false };
  const start = ukDay(spec.d1);
  const end = addDays(start, spec.days - 1);
  const period = await must("POST", "/api/periods", token, { title: "Full day", start: "09:00", finish: "15:30" });
  const passDocs = [];
  for (let n = 1; n <= spec.days; n++) passDocs.push(await must("POST", "/api/passes", token, { name: `${n}-day pass`, days: n }));
  const bundle = await must("POST", "/api/block-bundles", token, { name: `Emu block ${spec.title}`, periodIds: [period.id], passIds: passDocs.map((p: any) => p.id), priced: true, masterPrice: spec.perDay * spec.days, calcOn: true });
  const listing = await must("POST", "/api/listings", token, {
    title: spec.title, venueId: "emu-venue", runFrom: start, runTo: end, blockMode: "custom", days: [0, 1, 2, 3, 4, 5, 6],
    maxAttendees: "500", capacityScope: "day", showSpaces: true, ageFrom: "5", ageTo: "12", blockId: bundle.id,
    passes: passDocs.map((p: any, i: number) => ({ name: p.name, price: spec.perDay * (i + 1), days: i + 1 })),
    bookingType: "auto", addonIds: spec.addonIds, status: "live", visibility: "public",
  });
  await must("PUT", `/api/block-bundles/${bundle.id}/listings`, token, { listingIds: [listing.id] });
  return { id: listing.id, created: true };
}

async function setUser(uid: string, data: Record<string, unknown>) {
  const db = await adminDb();
  await db.collection("users").doc(uid).set(data, { merge: true });
}

export interface ListingInfo { id: string; blockId: string; title: string; perDay: number; dates: string[]; addons: Record<string, string>; passes: string[]; tenantId: string; franchiseId?: string }
export interface SeedIds {
  api: string; auth: string; firestore: string; generatedOn: string; d1: string;
  tenants: { P: string; Q: string };
  uids: Partial<Record<RoleKey, string>>;
  emails: typeof EMAILS;
  franchiseId: string;
  listings: Record<string, ListingInfo>;
  addons: Record<string, string>;
  questionIds: { Colour: string; Size: string };
  settings: { addonRequestDays: number };
  usersWrittenDirectly: RoleKey[];
}

/** Idempotent: re-running reuses accounts, listings and add-ons. Returns (and saves) every id. */
export async function seedAddons(opt: SeedOptions = {}): Promise<SeedIds> {
  const d1 = opt.d1 ?? 10;
  const P = await mkProvider("P", "Emu Test Provider P");
  const Q = await mkProvider("Q", "Emu Test Provider Q");
  await mkParent("A", P.tenantId); await mkParent("B", P.tenantId);

  // The staff role used for S4 (Registers and Bookings: none). Setting rolesSetAt switches the matrix on; staff with no permRole stay unrestricted.
  const roleNoBook = { id: "emu-no-bookings", name: "Emu: no bookings or registers", caps: { bookings: "none", registers: "none" } };
  const pLib = ((await must("GET", "/api/library", P.token)) ?? {}) as any;
  const roles = [...((pLib.settings?.roles as any[]) ?? []).filter((r) => r.id !== roleNoBook.id), roleNoBook];
  await setLibrary(P.token, [ADDON_DEFS.AW, ADDON_DEFS.AT, ADDON_DEFS.AL, ADDON_DEFS.AS], { addonRequestDays: 3, roles, rolesSetAt: pLib.settings?.rolesSetAt ?? new Date().toISOString() });

  const LK = await ensureListing(P.token, { key: "LK", title: "LK Holiday camp 20 a day (7 days)", perDay: 20, days: 7, d1, addonIds: [ADDON_DEFS.AW.id, ADDON_DEFS.AT.id, ADDON_DEFS.AL.id] });
  const LK2 = await ensureListing(P.token, { key: "LK2", title: "LK2 Mini camp 15 a day (3 days)", perDay: 15, days: 3, d1, addonIds: [ADDON_DEFS.AS.id] });
  const extra: Record<string, { id: string }> = {};
  for (const n of opt.extraD1 ?? []) extra[`LK_D${n}`] = await ensureListing(P.token, { key: `LK_D${n}`, title: `LK variant D1 plus ${n} days (7 days, 20 a day)`, perDay: 20, days: 7, d1: n, addonIds: [ADDON_DEFS.AW.id, ADDON_DEFS.AT.id, ADDON_DEFS.AL.id] });

  // Provider Q: its own listing and a code-free add-on (cross-tenant cases).
  await setLibrary(Q.token, [ADDON_DEFS.AQ], { addonRequestDays: 3 });
  const QL = await ensureListing(Q.token, { key: "QL", title: "QL Q camp 10 a day (3 days)", perDay: 10, days: 3, d1, addonIds: [ADDON_DEFS.AQ.id] });

  // Franchise F under P (users doc written directly), staff, platform.
  const F = await login(EMAILS.F);
  const written: RoleKey[] = [];
  await setUser(F.uid, { email: EMAILS.F, role: "franchise", chosen: true, tenantId: P.tenantId, franchiseId: F.uid, franchiseName: "Emu Franchise F", name: "Emu Franchise F" });
  written.push("F");
  // F's own settings library (the franchise has a separate doc) must be created by F itself.
  await setLibrary(F.token, [ADDON_DEFS.AF], { addonRequestDays: 3 });
  const FL = await ensureListing(F.token, { key: "FL", title: "FL Franchise camp 20 a day (3 days)", perDay: 20, days: 3, d1, addonIds: [ADDON_DEFS.AF.id], franchise: true });

  const staff: [RoleKey, Record<string, unknown>][] = [
    ["S1", { name: "Staff S1 (lead)", lead: true, assignment: { mode: "listings", ids: [LK.id] } }],
    ["S2", { name: "Staff S2", lead: false, assignment: { mode: "listings", ids: [LK.id] } }],
    ["S3", { name: "Staff S3", lead: false, assignment: { mode: "listings", ids: [LK2.id] } }],
    ["S4", { name: "Staff S4 (no bookings/registers)", lead: false, staffRole: roleNoBook.id, permRole: roleNoBook.id, assignment: { mode: "listings", ids: [LK.id] } }],
  ];
  const uids: Partial<Record<RoleKey, string>> = { P: P.uid, Q: Q.uid, F: F.uid };
  for (const [k, extraFields] of staff) {
    const s = await login(EMAILS[k]);
    await setUser(s.uid, { email: EMAILS[k], role: "staff", chosen: true, tenantId: P.tenantId, franchiseId: null, ...extraFields });
    uids[k] = s.uid; written.push(k);
  }
  const SF = await login(EMAILS.SF);
  await setUser(SF.uid, { email: EMAILS.SF, role: "staff", chosen: true, tenantId: P.tenantId, franchiseId: F.uid, name: "Staff SF (franchise F)", lead: false });
  uids.SF = SF.uid; written.push("SF");
  const HQ = await login(EMAILS.HQ);
  await setUser(HQ.uid, { email: EMAILS.HQ, role: "platform", chosen: true, name: "Emu HQ", twoFaVerifiedAt: Date.now() });
  uids.HQ = HQ.uid; written.push("HQ");
  uids.A = sessions.get(EMAILS.A)!.uid; uids.B = sessions.get(EMAILS.B)!.uid;

  // Describe every listing (real run dates, block id, passes, which add-ons).
  const db = await adminDb();
  const describe = async (key: string, id: string, token: string, tenantId: string, ao: AddonKey[], franchiseId?: string): Promise<ListingInfo> => {
    const l = await must("GET", `/api/listings/${id}`, token);
    const bl = await db.collection("blocks").where("listingId", "==", id).get();
    if (bl.empty) throw new Error(`listing ${key} has no block`);
    const dates = bl.docs.flatMap((d) => (d.data().sessions as { date: string }[]).map((s) => s.date)).sort();
    return { id, blockId: bl.docs[0].id, title: l.title ?? l.name ?? key, perDay: Number((l.passes ?? []).find((p: any) => p.name === "1-day pass")?.price ?? 0), dates, addons: Object.fromEntries(ao.map((a) => [a, ADDON_DEFS[a].id])), passes: (l.passes ?? []).map((p: any) => p.name), tenantId, ...(franchiseId ? { franchiseId } : {}) };
  };
  const listings: Record<string, ListingInfo> = {
    LK: await describe("LK", LK.id, P.token, P.tenantId, ["AW", "AT", "AL"]),
    LK2: await describe("LK2", LK2.id, P.token, P.tenantId, ["AS"]),
    QL: await describe("QL", QL.id, Q.token, Q.tenantId, ["AQ"]),
    FL: await describe("FL", FL.id, F.token, P.tenantId, ["AF"], F.uid),
  };
  for (const [k, v] of Object.entries(extra)) listings[k] = await describe(k, v.id, P.token, P.tenantId, ["AW", "AT", "AL"]);

  const ids: SeedIds = {
    api: API, auth: AUTH, firestore: FS, generatedOn: ukDay(0), d1: listings.LK.dates[0],
    tenants: { P: P.tenantId, Q: Q.tenantId }, uids, emails: EMAILS, franchiseId: F.uid, listings,
    addons: Object.fromEntries(Object.entries(ADDON_DEFS).map(([k, v]) => [k, v.id])),
    questionIds: { Colour: Q_COLOUR.id, Size: Q_SIZE.id }, settings: { addonRequestDays: 3 }, usersWrittenDirectly: written,
  };
  mkdirSync(dirname(IDS_FILE), { recursive: true });
  writeFileSync(IDS_FILE, JSON.stringify(ids, null, 2));
  return ids;
}

/** The ids written by the last seed on this stack. */
export function ids(): SeedIds {
  if (!existsSync(IDS_FILE)) throw new Error(`No seed ids at ${IDS_FILE}: run scripts/emu/seed-addons-run.mts first`);
  return JSON.parse(readFileSync(IDS_FILE, "utf8")) as SeedIds;
}

/**
 * Reset to the seeded state. Default: delete every booking and everything hanging off bookings (add-on ticks, registers, mail log,
 * bells, wallet, refunds, redemptions) in the EMULATOR, then re-run the seed (restores library, add-ons, settings).
 * { everything: true } wipes ALL Firestore + Auth data first (then restart the API to drop its in-memory caches, and re-seed).
 */
export async function resetToSeed(o: { everything?: boolean; d1?: number; extraD1?: number[] } = {}): Promise<SeedIds> {
  if (o.everything) {
    const a = await fetch(`http://${FS}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: "DELETE" });
    const b = await fetch(`http://${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: "DELETE" });
    if (!a.ok || !b.ok) throw new Error(`wipe failed ${a.status}/${b.status}`);
    sessions.clear();
  } else {
    const db = await adminDb();
    for (const c of ["bookings", "kitTicks", "registers", "mailLog", "notifications", "bells", "discountRedemptions", "wallets", "walletTxns", "refunds"]) {
      const snap = await db.collection(c).get();
      let batch = db.batch(), n = 0;
      for (const d of snap.docs) { batch.delete(d.ref); if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); } }
      await batch.commit();
    }
  }
  const prev = existsSync(IDS_FILE) ? ids() : null;
  const extraD1 = o.extraD1 ?? (prev ? Object.keys(prev.listings).filter((k) => k.startsWith("LK_D")).map((k) => Number(k.slice(4))) : []);
  return seedAddons({ d1: o.d1, extraD1 });
}

// ───────────────────────── helpers for testers ─────────────────────────
const tokenFor = async (who: RoleKey | string): Promise<{ token: string; email: string }> => {
  const email = (EMAILS as Record<string, string>)[who] ?? who;
  const s = await login(email); // fresh token every call: cheap, and never stale
  return { token: s.token, email };
};
/** Authenticated request as a role key ("P", "A", "S2"...) or any seeded @emu.test email. Platform (HQ) calls get ?tenantId=P unless one is present. */
export async function as(who: RoleKey | string, method: string, path: string, body?: unknown): Promise<Res> {
  const { token } = await tokenFor(who);
  let p = path;
  if (who === "HQ" && !/[?&]tenantId=/.test(p)) p += `${p.includes("?") ? "&" : "?"}tenantId=${ids().tenants.P}`;
  return call(method, p, token, body);
}

/** "D3" / 3 / "2026-10-20" -> an ISO date of listing `l` (default LK). */
export function day(d: string | number, l = "LK"): string {
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const n = typeof d === "number" ? d : Number(String(d).replace(/^D/i, ""));
  const dates = ids().listings[l].dates;
  if (!Number.isInteger(n) || n < 1 || n > dates.length) throw new Error(`No day ${d} on ${l} (it has ${dates.length})`);
  return dates[n - 1];
}

export interface AddonSel { id: AddonKey | string; days?: (string | number)[]; answers?: Record<string, string> }
export interface ChildSel { name: string; days: (string | number)[] | "all"; addons?: AddonSel[]; age?: number; pass?: string }
export interface BookResult extends Res { total: number | null; refs: string[]; booking: any; addonLines: any[] }

/**
 * Book through the REAL POST /api/my/bookings.
 *   parent: "A" | "B" | any email.   listing: "LK" | "LK2" | "FL" | "QL" | "LK_D4" ... or a listing id.
 *   children[].days: [1..7] (D numbers), ISO dates or "all". Pass is chosen by day count ("N-day pass") unless child.pass is given.
 *   addons[].id: "AW" | "AT" | "AL" ... or a library id; answers keyed by question label ("Colour"/"Size") or id.
 *   Everything passes through unchecked, so refusals (blank answer, unknown add-on...) come back as status 400 with the reason.
 * Returns { status, json, total (sum of the amounts returned), refs, booking (first), addonLines }.
 */
export async function bookWithAddons(o: { parent: RoleKey | string; listing: string; children: ChildSel[]; code?: string; method?: string; walletCap?: number }): Promise<BookResult> {
  const I = ids();
  const l = I.listings[o.listing] ?? Object.values(I.listings).find((x) => x.id === o.listing);
  if (!l) throw new Error(`Unknown listing ${o.listing}`);
  const lk = Object.keys(I.listings).find((k) => I.listings[k].id === l.id)!;
  const qIds: Record<string, string> = { colour: I.questionIds.Colour, size: I.questionIds.Size };
  const items = o.children.map((c) => {
    const dates = c.days === "all" ? l.dates : c.days.map((d) => day(d, lk));
    return {
      pass: c.pass ?? `${dates.length}-day pass`, child: c.name, age: c.age ?? 8, dates,
      ...(c.addons?.length ? { addons: c.addons.map((a) => ({
        id: (ADDON_DEFS as Record<string, { id: string }>)[a.id as string]?.id ?? a.id,
        ...(a.days ? { days: a.days.map((d) => day(d, lk)) } : {}),
        ...(a.answers ? { answers: Object.fromEntries(Object.entries(a.answers).map(([k, v]) => [qIds[k.toLowerCase()] ?? k, v])) } : {}),
      })) } : {}),
    };
  });
  const { token } = await tokenFor(o.parent);
  const r = await call("POST", "/api/my/bookings", token, { listingId: l.id, blockId: l.blockId, method: o.method ?? "Bank transfer", items, ...(o.code ? { discountCode: o.code } : {}), ...(o.walletCap !== undefined ? { walletCap: o.walletCap } : {}) });
  const list: any[] = Array.isArray(r.json) ? r.json : Array.isArray(r.json?.bookings) ? r.json.bookings : r.json && !r.json.error ? [r.json.booking ?? r.json] : [];
  const amounts = list.map((b) => Number(b.amount ?? b.total)).filter((n) => Number.isFinite(n));
  return {
    ...r, refs: list.map((b) => b.ref).filter(Boolean), booking: list[0] ?? null,
    total: r.json?.total != null ? Number(r.json.total) : amounts.length ? Math.round(amounts.reduce((s, n) => s + n, 0) * 100) / 100 : null,
    addonLines: list.flatMap((b) => b.addonLines ?? []),
  };
}

/** POST /api/bookings/:ref/actions as an operator (default P). `action` is the action type, e.g. "addon-approve" {requestId, resolution:"refund"}, "addon-decline" {requestId, reason}, "cancel"... See actionSchema in server/src/routes/bookings.ts. */
export function operatorAction(ref: string, action: string, payload: Record<string, unknown> = {}, as_: RoleKey | string = "P"): Promise<Res> {
  return as(as_, "POST", `/api/bookings/${encodeURIComponent(ref)}/actions`, { type: action, ...payload });
}

/** The family's add-on request endpoints. op: "options" (GET addon-options), "request" (POST: key, kind change|cancel, answers, note), "withdraw" (id). */
export function parentAddonRequest(ref: string, o: { as?: RoleKey | string; op?: "options" | "request" | "withdraw"; key?: string; kind?: "change" | "cancel"; answers?: Record<string, string>; note?: string; id?: string } = {}): Promise<Res> {
  const who = o.as ?? "A";
  const r = encodeURIComponent(ref);
  switch (o.op ?? "request") {
    case "options": return as(who, "GET", `/api/my/bookings/${r}/addon-options`);
    case "withdraw": return as(who, "POST", `/api/my/bookings/${r}/addon-requests/${encodeURIComponent(o.id ?? "")}/withdraw`, {});
    default: {
      const q = o.answers; // the request endpoint keys answers by question LABEL ("Colour", "Size"), as addon-options "current" shows
      return as(who, "POST", `/api/my/bookings/${r}/addon-requests`, { key: o.key, kind: o.kind ?? "change", ...(o.answers ? { answers: q } : {}), ...(o.note ? { note: o.note } : {}) });
    }
  }
}

const qs = (p: Record<string, string | number | undefined>) => { const e = Object.entries(p).filter(([, v]) => v !== undefined && v !== ""); return e.length ? `?${e.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&")}` : ""; };
/** GET /api/kit (Add-on orders, one day). params: { name } etc. `who` defaults to P. date may be "D3". */
export const kitDay = (date: string | number, params: Record<string, string | number> = {}, who: RoleKey | string = "P") => as(who, "GET", `/api/kit${qs({ date: day(date), ...params })}`);
/** GET /api/kit/days (strip + month tally) for a range. */
export const kitDays = (from: string | number, to: string | number, params: Record<string, string | number> = {}, who: RoleKey | string = "P") => as(who, "GET", `/api/kit/days${qs({ from: day(from), to: day(to), ...params })}`);
/** GET /api/registers?date= (every session that day with expected children and their add-ons). */
export const registerDay = (date: string | number, who: RoleKey | string = "P") => as(who, "GET", `/api/registers${qs({ date: day(date) })}`);
/** GET /api/bookings/:ref as a role. Parents use their own list ("/api/my/bookings") because they have no operator route: for a parent role this returns their list filtered to the ref (status 404 when not theirs). */
export async function bookingAsRole(ref: string, role: RoleKey | string): Promise<Res> {
  if (role === "A" || role === "B" || /^parent-/.test(String(role))) {
    const r = await as(role, "GET", "/api/my/bookings");
    const list: any[] = Array.isArray(r.json) ? r.json : r.json?.bookings ?? [];
    const hit = list.find((b) => b.ref === ref);
    return hit ? { status: 200, ok: true, json: hit } : { status: r.ok ? 404 : r.status, ok: false, json: r.ok ? { error: "Booking not found in this family's list" } : r.json };
  }
  return as(role, "GET", `/api/bookings/${encodeURIComponent(ref)}`);
}
void ROLE_PW_NOTE;
