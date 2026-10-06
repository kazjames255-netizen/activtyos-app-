import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { ROOT } from "./helpers/env";
import { DEFAULT_POLICIES } from "../lib/cancellation";
import { TEST_EMAIL_DOMAIN, apiFetch, apiPost, fbSignIn, fbSignUp } from "./helpers/accounts";

const realFetch = globalThis.fetch;
globalThis.fetch = (async (...a: Parameters<typeof fetch>) => {
  for (let i = 0; ; i++) { try { return await realFetch(...a); } catch (e) { if (i >= 8) throw e; await new Promise((r) => setTimeout(r, 3000)); } }
}) as typeof fetch;
test.describe.configure({ mode: "serial" });
const stamp = Date.now().toString(36);
const SHOTS = path.join(ROOT, "e2e/review/shots/pol");
fs.mkdirSync(SHOTS, { recursive: true });
const ukIso = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const plus = (n: number) => ukIso(new Date(Date.now() + n * 86_400_000));

type Acct = { email: string; uid: string; tenantId?: string; token: () => Promise<string> };
const tok = (email: string) => async () => (await fbSignIn(email)).idToken;
let parent: Acct, op: Acct;
async function mkParent(tag: string): Promise<Acct> {
  const email = `e2e-pol-${tag}-${stamp}@${TEST_EMAIL_DOMAIN}`;
  const s = await fbSignUp(email);
  await apiPost("/api/register-role", s.idToken, { role: "parent", postcode: "NN5 7EA" });
  await apiPost("/api/me/welcome", s.idToken, {});
  return { email, uid: s.uid, token: tok(email) };
}
async function mkOp(): Promise<Acct> {
  const email = `e2e-pol-op-${stamp}@${TEST_EMAIL_DOMAIN}`;
  const s = await fbSignUp(email);
  const name = `POL Co ${stamp}`;
  const r = await apiPost<{ tenantId: string }>("/api/register-role", s.idToken, { role: "company", businessName: name, providerName: name, providerNameMode: "business" });
  execFileSync("npm", ["--prefix", path.join(ROOT, "server"), "run", "e2e-unwall", "--", r.tenantId], { stdio: "pipe" });
  return { email, uid: s.uid, tenantId: r.tenantId, token: tok(email) };
}
async function setSettings(a: Acct, patch: Record<string, unknown>) {
  const t = await a.token();
  const lib = ((await apiFetch<Record<string, unknown> | null>("/api/library", t)) ?? {}) as { settings?: Record<string, unknown> };
  await apiFetch("/api/library", t, { method: "PUT", body: JSON.stringify({ settings: { ...(lib.settings ?? {}), ...patch } }) });
}
interface L { id: string; title: string; runFrom: string; tenantId: string; sessions: string[]; blockId: string }
async function mkListing(a: Acct, o: { title: string; offset: number; price?: number; passDays?: number; passName?: string; policy?: string; runDays?: number; cap?: number; extra?: Record<string, unknown>; discounts?: unknown[] }): Promise<L> {
  const t = await a.token();
  const lib = ((await apiFetch<Record<string, unknown> | null>("/api/library", t)) ?? {}) as { venues?: { id: string }[]; settings?: Record<string, unknown> };
  const vid = "pol-venue";
  await apiFetch("/api/library", t, { method: "PUT", body: JSON.stringify({ venues: (lib.venues ?? []).some((v) => v.id === vid) ? lib.venues : [...(lib.venues ?? []), { id: vid, name: "POL Hall", address: "1 Test Way", city: "Northampton" }], settings: { ...(lib.settings ?? {}) } }) });
  const passName = o.passName ?? "3 days";
  const period = await apiPost<{ id: string }>("/api/periods", t, { title: "Full day", start: "09:00", finish: "15:30" });
  const pass = await apiPost<{ id: string }>("/api/passes", t, { name: passName, days: o.passDays ?? 3 });
  const price = o.price ?? 54;
  const bundle = await apiPost<{ id: string }>("/api/block-bundles", t, { name: `POL Block ${o.title}`, periodIds: [period.id], passIds: [pass.id], priced: true, masterPrice: price, calcOn: true });
  const from = plus(o.offset), to = plus(o.offset + (o.runDays ?? 6));
  const l = await apiPost<{ id: string; tenantId: string }>("/api/listings", t, {
    title: o.title, venueId: vid, runFrom: from, runTo: to, blockMode: "custom", days: [0, 1, 2, 3, 4, 5, 6],
    maxAttendees: String(o.cap ?? 40), capacityScope: "day", showSpaces: true, ageFrom: "5", ageTo: "12",
    blockId: bundle.id, passes: [{ name: passName, price, days: o.passDays ?? 3 }], bookingType: "auto", status: "live", visibility: "public",
    ...(o.policy ? { cancellationPolicyId: o.policy } : {}), ...(o.discounts ? { discounts: o.discounts } : {}), ...(o.extra ?? {}),
  });
  await apiFetch(`/api/block-bundles/${bundle.id}/listings`, t, { method: "PUT", body: JSON.stringify({ listingIds: [l.id] }) });
  const doc = await apiFetch<{ blocks: { id: string; sessions?: { date: string }[] }[] }>(`/api/listings/${l.id}`, t);
  return { id: l.id, title: o.title, runFrom: from, tenantId: l.tenantId, sessions: (doc.blocks[0].sessions ?? []).map((s) => s.date).sort(), blockId: doc.blocks[0].id };
}
const setPolicy = async (l: L, id: string) => apiFetch(`/api/listings/${l.id}`, await op.token(), { method: "PUT", body: JSON.stringify({ cancellationPolicyId: id }) });
async function book(who: Acct, l: L, o: { child: string; passName?: string; dates: string[]; method?: string; extra?: Record<string, unknown>; extraItems?: Record<string, unknown>[]; walletCap?: number }) {
  const t = await who.token();
  const items = [{ pass: o.passName ?? "3 days", child: o.child, age: 8, dates: o.dates }, ...(o.extraItems ?? [])];
  const res = await apiPost<{ bookings: Record<string, any>[] }>("/api/my/bookings", t, { listingId: l.id, blockId: l.blockId, method: o.method ?? "card", walletCap: o.walletCap ?? 0, items, ...(o.extra ?? {}) });
  return res.bookings;
}
const opBooking = async (ref: string) => apiFetch<Record<string, any>>(`/api/bookings/${ref}`, await op.token());
const opAct = async (ref: string, body: Record<string, unknown>) => apiPost<Record<string, any>>(`/api/bookings/${ref}/actions`, await op.token(), body);
const markPaid = (ref: string) => opAct(ref, { type: "paid" });
const pCancel = async (a: Acct, ref: string, body: Record<string, unknown> = {}) => {
  // The dev API restarts under `tsx watch` when anyone edits server code; a request retried after a dropped connection can find the first attempt already done.
  try { return await apiPost<Record<string, any>>(`/api/my/bookings/${ref}/cancel`, await a.token(), body); } catch (e) { if (/Already cancelled/.test(String((e as Error).message))) return {} as Record<string, any>; throw e; }
};
const wallet = async (a: Acct) => { const w = await apiFetch<{ balances: { balance?: number }[] }>("/api/my/wallet", await a.token()); return w.balances.reduce((n, x) => n + (x.balance ?? 0), 0); };

// ---- independent oracle (NOT lib/cancellation): notice = whole hours from 00:00 UTC on the first session date ----
type Bands = { hoursBefore: number; refundPercent: number }[];
function oracle(bands: Bands, sessionIso: string, paid: number, now = Date.now()) {
  const hours = Math.floor((Date.parse(`${sessionIso}T00:00:00Z`) - now) / 3_600_000);
  const sorted = [...bands].sort((a, b) => b.hoursBefore - a.hoursBefore);
  const band = sorted.find((b) => hours >= b.hoursBefore);
  const pct = band ? band.refundPercent : 0;
  return { hours, pct, amount: Math.round((Math.round(paid * 100) * pct) / 100) / 100 };
}
const CUSTOM: { id: string; name: string; bands: Bands } = { id: "custom", name: "Custom", bands: [{ hoursBefore: 336, refundPercent: 100 }, { hoursBefore: 168, refundPercent: 50 }, { hoursBefore: 48, refundPercent: 25 }, { hoursBefore: 0, refundPercent: 0 }] };
const POLICIES = [...DEFAULT_POLICIES, CUSTOM];

const OUT = path.join(SHOTS, "results.json");
const RES: Record<string, { status: string; note: string }> = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
const rec = (id: string, status: "pass" | "fail" | "info", note: string) => { RES[id] = { status, note }; fs.writeFileSync(OUT, JSON.stringify(RES, null, 1)); console.log(`RESULT ${id} ${status} :: ${note}`); };
async function check(id: string, fn: () => Promise<string>) {
  try { rec(id, "pass", await fn()); } catch (e) { rec(id, "fail", String((e as Error).message).split("\n").filter(Boolean).slice(0, 4).join(" | ").slice(0, 700)); }
}

test.beforeAll(async () => {
  test.setTimeout(300_000);
  parent = await mkParent("p"); op = await mkOp();
  await setSettings(op, { cancellationPolicies: POLICIES, allowCardRefund: true, refundLetCustomerChoose: false, noRefundCredit: false, allowPartialCancel: true, partialAllowRefund: true, partialAllowWallet: true });
  console.log("ACCOUNTS", parent.email, op.email, op.tenantId);
});


// ================= A. policy x distance matrix (API, server-computed vs independent oracle) =================
const OFFSETS = [20, 14, 8, 7, 3, 2, 1, 0];
const MATRIX: string[] = [];
test("A. policy x distance matrix", async () => {
  test.setTimeout(1_500_000);
  let bad = 0, n = 0;
  for (const off of OFFSETS) {
    let l: L;
    try { l = await mkListing(op, { title: `POL A${off} ${stamp}`, offset: off, policy: "standard" }); } catch (e) { rec(`A-d${off}`, "fail", `could not create listing: ${(e as Error).message.slice(0, 200)}`); continue; }
    let first = l.sessions.slice(0, 3);
    for (const pol of POLICIES) {
      const child = `a${off}${pol.id} ${stamp}`;
      let ref = "";
      try {
        const [b] = await book(parent, l, { child, dates: first });
        ref = b.ref;
      } catch (e) { rec(`A-d${off}-${pol.id}`, "fail", `booking refused: ${(e as Error).message.slice(0, 220)}`); bad++; continue; }
      await markPaid(ref);
      await setPolicy(l, pol.id);
      const now = Date.now();
      await pCancel(parent, ref, {});
      const b = await opBooking(ref);
      const exp = oracle(pol.bands, first[0], 54, now);
      const ok = Math.abs((b.cancel?.amount ?? -1) - exp.amount) < 0.005;
      n++; if (!ok) bad++;
      MATRIX.push(`${pol.name.padEnd(10)} d-${String(off).padStart(2)}  notice~${exp.hours}h  expected £${exp.amount.toFixed(2)} (${exp.pct}%)  actual £${(b.cancel?.amount ?? -1).toFixed(2)} refund=${b.cancel?.refund}  ${ok ? "PASS" : "FAIL"}`);
      rec(`A-d${off}-${pol.id}`, ok ? "pass" : "fail", `notice ${exp.hours}h expected £${exp.amount} actual £${b.cancel?.amount} (${b.cancel?.refund})`);
    }
  }
  fs.writeFileSync(path.join(SHOTS, "matrix-A.txt"), MATRIX.join("\n") + "\n");
  console.log("MATRIX_A\n" + MATRIX.join("\n"));
  expect(bad, `${bad} of ${n} matrix cells differ from the oracle`).toBe(0);
});
