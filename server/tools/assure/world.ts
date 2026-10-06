// The fuzzer's WORLD: a throwaway provider (freelancer, test-domain only), a pool of parents with children, and a fresh set of listings of
// different kinds per seed. Everything runs on the LOCAL stack against the REAL API; nothing here touches a real account.
//
// What action files (actions/*.ts, written by other agents) can rely on:
//   ctx.world: World  (this file)           ctx.api(method, url, body?, as?)   as = "op" (the provider) or a parent key like "p0"
//   world.listings[]  { id, title, kind, blockIds[], blocks[{id, dates[]}], passes[{name, days, price}], scope, capacity, bookingType, waitlistMode }
//   world.parents[]   { key, email, children[{id, name, age}] }
//   world.bookings()  fresh read of THIS seed's bookings straight from Firestore (read-only, no auth): [{ref, status, pay, email, listingId, blockId, days, kids, amount, ...}]
//   world.parentOf(email)   -> parent key
//   world.rng        the seeded random source (use it, never Math.random, so a seed replays)
import fs from "node:fs";
import path from "node:path";
import { db } from "../../src/firebase";
import { fbSignIn, fbSignUp, TEST_EMAIL_DOMAIN } from "../../../e2e/helpers/accounts";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
export const POOL_FILE = path.resolve(import.meta.dirname, "../../../e2e/review/shots/assure/pool.json");
const OPERATOR_MAX_SEEDS = 10; // retire a provider after this many seeds so its tenant (and every snapshot) stays small

export type Rng = () => number;
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const pick = <T>(rng: Rng, xs: T[]): T => xs[Math.floor(rng() * xs.length)];
export const randInt = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface Child { id: string; name: string; age: number }
export interface Parent { key: string; email: string; children: Child[] }
export interface ListingInfo {
  id: string; title: string; kind: string; scope: "day" | "listing"; capacity: number; bookingType: "auto" | "manual"; waitlistMode: "auto" | "manual";
  passes: { name: string; days: number; price: number }[];
  blocks: { id: string; dates: string[] }[];
  ageFrom: number; ageTo: number; allowOutOfRange: boolean; ticketCaps: Record<string, number>;
}
export interface ApiResult { status: number; json: any }
export interface World {
  seed: number; stamp: string;
  op: { email: string; tenantId: string };
  parents: Parent[]; listings: ListingInfo[]; listingIds: Set<string>;
  rng: Rng;
  api: (method: string, url: string, body?: unknown, as?: string) => Promise<ApiResult>;
  bookings: () => Promise<any[]>;
  parentOf: (email: string) => string | undefined;
  /** 5xx responses seen since the last call (cleared on read); the fuzz loop turns real ones into 'no-5xx' violations. */
  take5xx: () => { url: string; method: string; status: number; body: string }[];
  warnings: string[];
  release: () => void;
}

interface Acct { email: string; uid: string; tok: string; tokAt: number; tenantId?: string; uses?: number; children?: Child[] }
interface Pool { operators: Acct[]; parents: Acct[] }

function readPool(): Pool { try { return JSON.parse(fs.readFileSync(POOL_FILE, "utf8")); } catch { return { operators: [], parents: [] }; } }
function writePool(p: Pool) { fs.mkdirSync(path.dirname(POOL_FILE), { recursive: true }); const tmp = POOL_FILE + "." + process.pid; fs.writeFileSync(tmp, JSON.stringify(p, null, 1)); fs.renameSync(tmp, POOL_FILE); }

const leased = new Set<string>(); // emails leased inside THIS process
let tokenLock: Promise<unknown> = Promise.resolve();
async function freshTok(a: Acct): Promise<string> {
  if (a.tok && Date.now() - a.tokAt < 30 * 60_000) return a.tok;
  const s = await fbSignIn(a.email); a.tok = s.idToken; a.tokAt = Date.now(); return a.tok;
}

/** Refuse anything that is not a throwaway test account. */
export function assertTestEmail(email: string) {
  if (!email.toLowerCase().endsWith("@" + TEST_EMAIL_DOMAIN)) throw new Error(`REFUSED: ${email} is not an @${TEST_EMAIL_DOMAIN} account`);
}

async function rawCall(tok: string | null, method: string, url: string, body?: unknown, setup = true): Promise<ApiResult> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(`${API}${url}`, { method, headers: { "Content-Type": "application/json", ...(tok ? { Authorization: `Bearer ${tok}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
      let json: any = null; try { json = await res.json(); } catch { /* empty */ }
      if (setup && res.status === 503 && attempt < 6) { await sleep(2500); continue; } // setup only: ride out 'we're busy' bursts
      return { status: res.status, json };
    } catch (e) { if (attempt >= 12) throw e; await sleep(2000); } // API restarts when other agents save a file: wait and retry a refused connection
  }
}

async function newOperator(stamp: string): Promise<Acct> {
  const email = `e2e-fz-op-${stamp}@${TEST_EMAIL_DOMAIN}`; assertTestEmail(email);
  const s = await fbSignUp(email);
  const r = await rawCall(s.idToken, "POST", "/api/register-role", { role: "freelancer", businessName: `Fuzz Camps ${stamp}`, providerName: `Fuzz Camps ${stamp}`, providerNameMode: "business", ownerName: "Fuzz Owner" });
  if (r.status >= 300) throw new Error(`register operator: ${JSON.stringify(r.json)}`);
  const tenantId = r.json.tenantId as string;
  await db.collection("tenants").doc(tenantId).update({ subscription: (await import("firebase-admin/firestore")).FieldValue.delete() }); // same as `npm run e2e-unwall`
  const a: Acct = { email, uid: s.uid, tok: s.idToken, tokAt: Date.now(), tenantId, uses: 0 };
  // venue + accepted payment methods (card is always accepted)
  const lib = (await rawCall(a.tok, "GET", "/api/library")).json ?? {};
  await rawCall(a.tok, "PUT", "/api/library", { venues: [...(lib.venues ?? []), { id: "fz-venue", name: "Fuzz Hall", address: "1 Test Way", city: "Northampton" }], settings: { ...(lib.settings ?? {}), payMethods: ["Bank transfer", "Cash on the day"] } });
  return a;
}

async function newParent(stamp: string, n: number): Promise<Acct> {
  const email = `e2e-fz-p${n}-${stamp}@${TEST_EMAIL_DOMAIN}`; assertTestEmail(email);
  const s = await fbSignUp(email);
  const r = await rawCall(s.idToken, "POST", "/api/register-role", { role: "parent", postcode: "NN5 7EA", firstName: `Fz${n}`, lastName: "Parent" });
  if (r.status >= 300) throw new Error(`register parent: ${JSON.stringify(r.json)}`);
  await rawCall(s.idToken, "POST", "/api/me/welcome", {});
  return { email, uid: s.uid, tok: s.idToken, tokAt: Date.now(), children: [] };
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const today = new Date();
const nextMonday = addDays(today, (8 - today.getDay()) % 7 || 7);
const sd = (w: number, d: number) => iso(addDays(nextMonday, w * 7 + d));

interface Kind { kind: string; scope: "day" | "listing"; cap: [number, number]; bookingType: "auto" | "manual"; wl: "auto" | "manual"; ticketCaps?: Record<string, number>; oor?: boolean }
const KINDS: Kind[] = [
  { kind: "day-auto", scope: "day", cap: [2, 3], bookingType: "auto", wl: "auto" },
  { kind: "day-manualwl", scope: "day", cap: [2, 3], bookingType: "auto", wl: "manual" },
  { kind: "approval", scope: "day", cap: [3, 4], bookingType: "manual", wl: "manual" },
  { kind: "whole-listing", scope: "listing", cap: [4, 6], bookingType: "auto", wl: "auto" },
  { kind: "ticket-cap", scope: "day", cap: [4, 5], bookingType: "auto", wl: "auto", ticketCaps: { "1 day": 1 } },
  { kind: "age-gate", scope: "day", cap: [3, 4], bookingType: "auto", wl: "manual", oor: true },
];
const PASSES = [{ name: "1 day", days: 1, price: 20 }, { name: "3 days", days: 3, price: 54 }, { name: "5 days", days: 5, price: 90 }];

async function buildListings(op: Acct, rng: Rng, stamp: string): Promise<ListingInfo[]> {
  const tok = op.tok;
  // passes + period once per provider (cached on the pool entry)
  const cache = ((op as any)._ids ??= {}) as { period?: string; passes?: Record<string, string> };
  const post = async (url: string, body: unknown) => { const r = await rawCall(tok, "POST", url, body); if (r.status >= 300) throw new Error(`${url} -> ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`); return r.json; };
  cache.period ??= (await post("/api/periods", { title: "Full day", start: "09:00", finish: "15:00" })).id;
  cache.passes ??= {};
  for (const p of PASSES) cache.passes[p.name] ??= (await post("/api/passes", { name: p.name, days: p.days })).id;
  const out: ListingInfo[] = [];
  const chosen = [...KINDS].sort(() => rng() - 0.5).slice(0, randInt(rng, 3, 4));
  for (const k of chosen) {
    const cap = randInt(rng, k.cap[0], k.cap[1]);
    const ids = PASSES.map((p) => cache.passes![p.name]);
    const passFlat: Record<string, number> = {}; const periodPrice: Record<string, number> = {};
    PASSES.forEach((p, i) => { passFlat[ids[i]] = p.price; periodPrice[`${ids[i]}_${cache.period}`] = p.price; });
    const title = `Fz ${k.kind} ${stamp}`;
    const bundle = await post("/api/block-bundles", { name: `Bundle ${title}`, periodIds: [cache.period], passIds: ids, priced: true, masterPrice: 90, calcOn: false, passFlat, periodPrice });
    const ticketOverrides = k.ticketCaps ? Object.fromEntries(Object.entries(k.ticketCaps).map(([n, c]) => [n, { capacity: String(c) }])) : undefined;
    const listing = await post("/api/listings", {
      title, venueId: "fz-venue", runFrom: sd(0, 0), runTo: sd(1, 4), blockMode: "weekly", days: [1, 2, 3, 4, 5],
      maxAttendees: String(cap), capacityScope: k.scope, showSpaces: true, ageFrom: "5", ageTo: "11", allowOutOfRange: !!k.oor, blockId: bundle.id,
      passes: PASSES.map((p) => ({ name: p.name, price: p.price, days: p.days })), bookingType: k.bookingType, waitlist: true, waitlistMode: k.wl, waitlistSize: "20",
      payMethods: ["Bank transfer", "Cash on the day"], status: "live", visibility: "public", ...(ticketOverrides ? { ticketOverrides } : {}),
    });
    await rawCall(tok, "PUT", `/api/block-bundles/${bundle.id}/listings`, { listingIds: [listing.id] });
    const full = (await rawCall(tok, "GET", `/api/listings/${listing.id}`)).json;
    const blocks = ((full.blocks ?? []) as { id: string; startDate: string; sessions?: { date: string }[] }[]).sort((a, b) => (a.startDate < b.startDate ? -1 : 1))
      .map((b) => ({ id: b.id, dates: (b.sessions ?? []).map((s) => s.date).sort() }));
    out.push({ id: listing.id, title, kind: k.kind, scope: k.scope, capacity: cap, bookingType: k.bookingType, waitlistMode: k.wl, passes: PASSES, blocks, ageFrom: 5, ageTo: 11, allowOutOfRange: !!k.oor, ticketCaps: k.ticketCaps ?? {} });
  }
  return out;
}

/** Build (or lease) the world for one seed. Call world.release() when the seed is done. */
export async function buildWorld(seed: number, rng: Rng): Promise<World> {
  const stamp = `${Date.now().toString(36)}${seed.toString(36)}`.slice(-9);
  // ---- lease a provider (create one if none free or it has had its share of seeds) ----
  let op: Acct | undefined;
  await (tokenLock = tokenLock.then(async () => {
    const pool = readPool();
    op = pool.operators.find((o) => !leased.has(o.email) && (o.uses ?? 0) < OPERATOR_MAX_SEEDS);
    if (!op) { op = await newOperator(stamp); pool.operators.push(op); }
    leased.add(op.email); op.uses = (op.uses ?? 0) + 1;
    writePool(pool);
  }));
  const operator = op!; assertTestEmail(operator.email); await freshTok(operator);
  // ---- parents (shared pool of 5; created on first use) ----
  const parents: Acct[] = [];
  await (tokenLock = tokenLock.then(async () => {
    const pool = readPool();
    while (pool.parents.length < 5) { pool.parents.push(await newParent(stamp, pool.parents.length)); writePool(pool); }
    for (const p of pool.parents) { assertTestEmail(p.email); await freshTok(p); parents.push(p); }
    writePool(pool);
  }));
  // children: three fresh ones per parent per seed (ages 6, 9, 13), so no cross-seed duplicate-day refusals
  const parentObjs: Parent[] = [];
  for (let i = 0; i < parents.length; i++) {
    const kids: Child[] = [];
    for (const age of [6, 9, 13]) {
      const name = `Fz ${stamp} p${i} a${age}`;
      const r = await rawCall(parents[i].tok, "POST", "/api/my/children", { name, dob: `${today.getFullYear() - age}-01-15` });
      if (r.status >= 300) throw new Error(`child: ${JSON.stringify(r.json).slice(0, 200)}`);
      kids.push({ id: r.json.id, name, age });
    }
    parentObjs.push({ key: `p${i}`, email: parents[i].email, children: kids });
  }
  const listings = await buildListings(operator, rng, stamp);
  await (tokenLock = tokenLock.then(async () => { // persist the provider's pass/period ids so the next seed reuses them
    const pool = readPool(); const o = pool.operators.find((x) => x.email === operator.email);
    if (o) { (o as any)._ids = (operator as any)._ids; o.tok = operator.tok; o.tokAt = operator.tokAt; writePool(pool); }
  }));
  const listingIds = new Set(listings.map((l) => l.id));
  const byKey: Record<string, Acct> = { op: operator, ...Object.fromEntries(parents.map((p, i) => [`p${i}`, p])) };
  const fiveXX: { url: string; method: string; status: number; body: string }[] = [];
  const warnings: string[] = [];
  const api = async (method: string, url: string, body?: unknown, as = "op"): Promise<ApiResult> => {
    const a = byKey[as]; if (!a) throw new Error(`unknown account ${as}`);
    let r = await rawCall(await freshTok(a), method, url, body, false);
    if (r.status >= 500) { // retry ONCE (a transaction aborted by contention writes nothing, so a retry is safe); a second 5xx is a real violation
      const first = r.status;
      await sleep(1500);
      r = await rawCall(await freshTok(a), method, url, body, false);
      if (r.status >= 500) fiveXX.push({ url, method, status: r.status, body: JSON.stringify(r.json).slice(0, 200) });
      else warnings.push(`transient ${first} on ${method} ${url} (retry ok)`);
    }
    return r;
  };
  const bookings = async () => {
    const snap = await db.collection("bookings").where("tenantId", "==", operator.tenantId!).get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })).filter((b) => listingIds.has(b.listingId));
  };
  const byEmail = Object.fromEntries(parentObjs.map((p) => [p.email.toLowerCase(), p.key]));
  return {
    seed, stamp, op: { email: operator.email, tenantId: operator.tenantId! }, parents: parentObjs, listings, listingIds, rng,
    api, bookings, parentOf: (e) => byEmail[String(e).toLowerCase()],
    take5xx: () => fiveXX.splice(0, fiveXX.length), warnings,
    release: () => { leased.delete(operator.email); },
  };
}
