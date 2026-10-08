/**
 * Shared helpers for the emulator-stack tests (tests/emulator/*). These need the LOCAL test stack to be running:
 *   Firestore + Auth emulators, the API (with an sk_test Stripe key, STRIPE_PLATFORM_FALLBACK=1 and STRIPE_WEBHOOK_SECRET set),
 *   and the synthetic seed (scripts/emu/seed-coupon-run.mts).
 * Everything is local or Stripe TEST mode. Each helper refuses non-local hosts and non-test keys.
 */
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const serverRequire = createRequire(resolve(here, "../../server/package.json"));

const off = Number(process.env.EMU_PORT_OFFSET || 0);
export const API = `http://localhost:${4101 + off}`;
export const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || `127.0.0.1:${9099 + off}`;
export const FS_HOST = process.env.FIRESTORE_EMULATOR_HOST || `127.0.0.1:${8080 + off}`;
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;
if (!LOCAL.test(AUTH_HOST) || !LOCAL.test(FS_HOST)) throw new Error("Refusing: emulator hosts must be local");
process.env.FIRESTORE_EMULATOR_HOST = FS_HOST; // firebase-admin in this process talks to the emulator only
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;

const key = process.env.STRIPE_SECRET_KEY ?? "";
if (!key.startsWith("sk_test")) throw new Error("STRIPE_SECRET_KEY must be a Stripe TEST key (sk_test...) in the environment");
export const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";
if (!WEBHOOK_SECRET) throw new Error("STRIPE_WEBHOOK_SECRET must be set (the same value the API was started with)");
const PW = process.env.E2E_PASSWORD ?? "";
if (!PW) throw new Error("E2E_PASSWORD must be set (the password the seed used)");

/* eslint-disable @typescript-eslint/no-explicit-any */
const Stripe = serverRequire("stripe") as any;
export const stripe: any = new Stripe(key);

const admin = serverRequire("firebase-admin") as any;
if (!admin.apps.length) admin.initializeApp({ projectId: "demo-activityos" });
export const fs: any = admin.firestore();

export async function login(email: string): Promise<string> {
  const r = await fetch(`http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=any`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: PW, returnSecureToken: true }),
  });
  const j = (await r.json()) as { idToken?: string };
  if (!j.idToken) throw new Error(`login failed for ${email} (has the seed been run with this E2E_PASSWORD?)`);
  return j.idToken;
}

export async function call(method: string, path: string, token: string | null, body?: unknown): Promise<{ status: number; json: any }> {
  const r = await fetch(`${API}${path}`, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const t = await r.text();
  let json: unknown = null;
  try { json = t ? JSON.parse(t) : null; } catch { json = t; }
  return { status: r.status, json: json as any };
}

export interface Fixture { providerToken: string; parentToken: string; listingId: string; blockId: string; tenantId: string }
export async function fixture(): Promise<Fixture> {
  const providerToken = await login("provider-p@emu.test");
  const parentToken = await login("parent-a@emu.test");
  const listings = (await call("GET", "/api/listings", providerToken)).json as { id: string; title: string }[];
  const la = listings.find((l) => l.title === "LA Day camp 20");
  if (!la) throw new Error("seed not run: listing 'LA Day camp 20' missing");
  const blocks = (await call("GET", `/api/blocks?listingId=${la.id}`, providerToken)).json as { id: string }[];
  if (!blocks.length) throw new Error("seed not run: no block for LA");
  const me = (await call("GET", "/api/me", providerToken)).json as { tenantId: string };
  return { providerToken, parentToken, listingId: la.id, blockId: blocks[0].id, tenantId: me.tenantId };
}

let seq = 0;
/** An unpaid card booking of `amount` pounds for parent A (the provider records it, as the coupon run did). */
export async function newBooking(f: Fixture, amount = 36): Promise<string> {
  const child = `Idem ${Date.now().toString(36)}${seq++}`;
  const r = await call("POST", "/api/bookings", f.providerToken, {
    booker: "Test Parent A", email: "parent-a@emu.test", child, age: 8, listing: "LA Day camp 20", pass: "Day pass", blockId: f.blockId, amount, method: "card",
  });
  if (r.status !== 201) throw new Error(`could not create booking: ${r.status} ${JSON.stringify(r.json)}`);
  return (r.json.ref ?? r.json.bookings?.[0]?.ref ?? r.json.booking?.ref) as string;
}

export const checkout = (f: Fixture, refs: string[]) => call("POST", "/api/payments/checkout", f.parentToken, { refs, tenantId: f.tenantId });

export async function booking(f: Fixture, ref: string): Promise<any> {
  const list = (await call("GET", "/api/bookings", f.providerToken)).json as { ref: string }[];
  return list.find((b) => b.ref === ref);
}

/** All Stripe PaymentIntents (TEST) whose metadata.refs is exactly this booking ref. */
export async function intentsFor(ref: string, since: number): Promise<any[]> {
  const out: any[] = [];
  for await (const pi of stripe.paymentIntents.list({ created: { gte: since - 5 }, limit: 100 })) if (pi.metadata?.refs === ref) out.push(pi);
  return out;
}

export const payIntent = (id: string): Promise<any> => stripe.paymentIntents.confirm(id, { payment_method: "pm_card_visa", return_url: "http://localhost/return" });

/** Deliver a Stripe-signed webhook event to the local API (signed with the test STRIPE_WEBHOOK_SECRET, as Stripe would). */
export async function deliver(eventId: string, type: string, object: unknown): Promise<{ status: number; json: unknown }> {
  const payload = JSON.stringify({ id: eventId, object: "event", type, data: { object }, created: Math.floor(Date.now() / 1000), livemode: false, api_version: "2025-01-01" });
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
  const r = await fetch(`${API}/api/stripe/webhook`, { method: "POST", headers: { "Content-Type": "application/json", "stripe-signature": header }, body: payload });
  return { status: r.status, json: await r.json().catch(() => null) };
}
