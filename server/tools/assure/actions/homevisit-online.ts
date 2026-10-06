// Home-visit + online fuzz actions (area "homevisit-online").
//  · home-visit: listings with a postcode-prefix / radius / both coverage area; bookings with covered, uncovered, odd-case/odd-spacing and lookalike-district
//    addresses, or none at all (the family's saved postcode is then used). Refusals must create nothing; accepted bookings must store the address.
//  · online: platform-room and own-link listings whose session is TODAY at a time chosen relative to now (before / inside / after the join window), so the
//    join rules (window, host must start first, booked-and-paid children only, own-link visibility, attendance on join) can be judged against a model.
//  · privacy: the provider's base postcode and the own session link never appear in a response to anyone who should not see them.
// Findings the action itself detects are pushed on world.__violations (fuzz.ts drains them every step); structural rules live in invariants.ts.
import type { ActionCtx, ActionDef, Violation } from "../types";
import { db } from "../../../src/firebase";
import { pick, randInt, type World } from "../world";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const W = (c: ActionCtx) => c.world as World;
const brief = (r: { status: number; json: any }) => `${r.status}${r.status >= 300 ? " " + String(typeof r.json?.error === "string" ? r.json.error : JSON.stringify(r.json?.error ?? "")).slice(0, 70) : ""}`;
const compact = (s: string) => s.toUpperCase().replace(/\s+/g, "");

// ---------- the model (written from the product rules, not copied from the server) ----------
/** Is `postcode` covered by a prefix list? A prefix ending in a digit must end the district: NN5 covers NN5 / NN5 7EA but not NN50; SW1 covers SW1A but not SW10. */
export function modelCovered(prefixes: string[], postcode: string): boolean {
  const pc = compact(postcode);
  if (!pc) return false;
  const outward = pc.length > 3 ? pc.slice(0, -3) : pc;
  return prefixes.some((raw) => {
    const p = compact(raw);
    if (!p || !(outward.startsWith(p) || pc.startsWith(p))) return false;
    return !(/\d$/.test(p) && outward.length > p.length && outward.startsWith(p) && /\d/.test(outward[p.length]));
  });
}
const FAMILY_POSTCODE = "NN5 7EA"; // every fuzz parent registers with this saved postcode
const BASE_RADIUS = "NE1 4ST"; // the radius listing's base: distinctive, so a leak is unmistakable
const RADIUS_MILES = 3;

const ukParts = () => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, mins: Number(p.hour) * 60 + Number(p.minute) };
};
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

// ---------- per-world state ----------
interface HvL { id: string; kind: "hv-prefix" | "hv-radius" | "hv-both"; prefixes: string[]; title: string; blocks: { id: string; dates: string[] }[] }
interface OnL { id: string; kind: string; title: string; mode: "platform" | "own"; showLinkNow: boolean; link: string; when: "inside" | "before" | "after"; start: number; finish: number; blockId: string; date: string }
interface St { ready?: boolean; hv: HvL[]; on: OnL[]; used: Set<string>; addrN: number; unique: string[]; baseSeen: string[] }
const S = (c: ActionCtx): St => ((c.world as any).__hvo ??= { hv: [], on: [], used: new Set(), addrN: 0, unique: [], baseSeen: [] } as St);
const violate = (c: ActionCtx, rule: string, message: string, severity: Violation["severity"] = "state") => { ((c.world as any).__violations ??= []).push({ rule, severity, message }); };

async function mkListing(c: ActionCtx, a: { title: string; periodIds: string[]; extra: Record<string, unknown>; from: string; to: string; days: number[] }): Promise<{ id: string; blocks: { id: string; dates: string[] }[] }> {
  const w = W(c);
  const passes = ((await w.api("GET", "/api/passes")).json ?? []) as { id: string; name: string }[];
  let pass = passes.find((p) => p.name === "1 day");
  if (!pass) { const r = await w.api("POST", "/api/passes", { name: "1 day", days: 1 }); if (r.status >= 300) throw new Error(`pass: ${brief(r)}`); pass = r.json; }
  const passFlat = { [pass!.id]: 20 }; const periodPrice = Object.fromEntries(a.periodIds.map((p) => [`${pass!.id}_${p}`, 20]));
  const b = await w.api("POST", "/api/block-bundles", { name: `Bundle ${a.title}`, periodIds: a.periodIds, passIds: [pass!.id], priced: true, masterPrice: 20, calcOn: false, passFlat, periodPrice });
  if (b.status >= 300) throw new Error(`bundle: ${brief(b)}`);
  const l = await w.api("POST", "/api/listings", {
    title: a.title, runFrom: a.from, runTo: a.to, blockMode: "weekly", days: a.days, maxAttendees: "30", capacityScope: "day", showSpaces: true, ageFrom: "3", ageTo: "17", allowOutOfRange: true,
    blockId: b.json.id, passes: [{ name: "1 day", price: 20, days: 1 }], bookingType: "auto", waitlist: false, payMethods: ["Cash on the day"], status: "live", visibility: "public", ...a.extra,
  });
  if (l.status >= 300) throw new Error(`listing ${a.title}: ${brief(l)}`);
  await w.api("PUT", `/api/block-bundles/${b.json.id}/listings`, { listingIds: [l.json.id] });
  const full = (await w.api("GET", `/api/listings/${l.json.id}`)).json;
  const blocks = ((full.blocks ?? []) as { id: string; sessions?: { date: string }[] }[]).map((x) => ({ id: x.id, dates: (x.sessions ?? []).map((s) => s.date).sort() }));
  w.listingIds.add(l.json.id);
  (((w as any).__extraTitles ??= []) as string[]).push(a.title);
  return { id: l.json.id, blocks };
}

async function ensure(c: ActionCtx) {
  const s = S(c); if (s.ready) return; s.ready = true;
  const w = W(c);
  const lib = (await w.api("GET", "/api/library")).json ?? {};
  const venues = ((lib.venues ?? []) as { id: string }[]).filter((v) => v.id !== "fz-online");
  await w.api("PUT", "/api/library", { venues: [...venues, { id: "fz-online", name: "Online", kind: "online", directions: "Join from My bookings." }] });
  const nextMon = addDays(new Date(), (8 - new Date().getDay()) % 7 || 7);
  const from = iso(nextMon), to = iso(addDays(nextMon, 11));
  const stamp = w.stamp;
  const per = async (title: string, start: number, finish: number) => { const r = await w.api("POST", "/api/periods", { title, start: hhmm(start), finish: hhmm(finish) }); if (r.status >= 300) throw new Error(`period: ${brief(r)}`); return r.json.id as string; };
  const day = await per(`Fz hv ${stamp}`, 9 * 60, 15 * 60);
  const hv: [HvL["kind"], string[], Record<string, unknown>][] = [
    ["hv-prefix", ["SW1", "LS1", "NN6"], { deliveryMode: "home-visit", coverageArea: { mode: "postcodePrefixes", postcodePrefixes: ["SW1", "LS1", "NN6"] } }],
    ["hv-radius", [], { deliveryMode: "home-visit", coverageArea: { mode: "radius", basePostcode: BASE_RADIUS, radiusMiles: RADIUS_MILES } }],
    ["hv-both", ["NN5", "B1"], { deliveryMode: "both", venueId: "fz-venue", coverageArea: { mode: "postcodePrefixes", postcodePrefixes: ["NN5", "B1"] } }],
  ];
  for (const [kind, prefixes, extra] of hv) {
    const title = `Fz ${kind} ${stamp}`;
    const l = await mkListing(c, { title, periodIds: [day], extra, from, to, days: [1, 2, 3, 4, 5] });
    s.hv.push({ id: l.id, kind, prefixes, title, blocks: l.blocks });
  }
  // online listings, timed relative to now (UK wall clock)
  const { date, mins } = ukParts();
  const dayStart = iso(new Date());
  const plans: { when: OnL["when"]; mode: OnL["mode"]; showLinkNow: boolean; start: number; finish: number }[] = [];
  if (mins >= 10 && mins <= 1400) {
    plans.push({ when: "inside", mode: "platform", showLinkNow: false, start: mins - 5, finish: Math.min(mins + 180, 1439) });
    plans.push({ when: "inside", mode: "own", showLinkNow: false, start: mins - 5, finish: Math.min(mins + 180, 1439) });
  }
  if (mins <= 1250) {
    plans.push({ when: "before", mode: "platform", showLinkNow: false, start: mins + 150, finish: Math.min(mins + 210, 1439) });
    plans.push({ when: "before", mode: "own", showLinkNow: false, start: mins + 150, finish: Math.min(mins + 210, 1439) });
    plans.push({ when: "before", mode: "own", showLinkNow: true, start: mins + 150, finish: Math.min(mins + 210, 1439) });
  }
  if (mins >= 140) plans.push({ when: "after", mode: "platform", showLinkNow: false, start: 0, finish: mins - 75 });
  for (const p of plans) {
    const title = `Fz on-${p.mode}${p.showLinkNow ? "-now" : ""}-${p.when} ${stamp}`;
    const link = `https://meet.example.test/${p.mode}${p.showLinkNow ? "now" : ""}${p.when}-SECRETLINK-${stamp}`;
    const period = await per(`Fz ${p.when}${p.mode}${p.showLinkNow ? "N" : ""} ${stamp}`, p.start, p.finish);
    const l = await mkListing(c, { title, periodIds: [period], from: dayStart, to: iso(addDays(new Date(), 1)), days: [0, 1, 2, 3, 4, 5, 6],
      extra: { venueId: "fz-online", videoMode: p.mode, showLinkNow: p.showLinkNow, ...(p.mode === "own" ? { ownLink: link } : {}) } });
    const blk = l.blocks.find((b) => b.dates.includes(date));
    if (!blk) { c.log(`online ${title}: no block holds ${date}`); continue; }
    s.on.push({ id: l.id, kind: title, title, mode: p.mode, showLinkNow: p.showLinkNow, link, when: p.when, start: p.start, finish: p.finish, blockId: blk.id, date });
    if (p.mode === "own") s.unique.push(link);
  }
  s.baseSeen.push(BASE_RADIUS);
}

// ---------- helpers over the stored bookings ----------
const BAD_PAY = ["Unpaid", "Refunded", "Refund pending"];
const joinableDoc = (b: any, date: string) =>
  b.status === "Confirmed" && !BAD_PAY.includes(b.pay) && (b.days ?? []).includes(date) && (!Array.isArray(b.kids) || !b.kids.length || b.kids.some((k: any) => !k.cancelled));

async function bookOnline(c: ActionCtx, l: OnL, pKey: string, kidIdx: number, method = "Cash on the day") {
  const w = W(c); const p = w.parents.find((x) => x.key === pKey)!; const kid = p.children[kidIdx];
  const k = `${l.id}|${kid.id}`; if (S(c).used.has(k)) return null;
  S(c).used.add(k);
  const r = await w.api("POST", "/api/my/bookings", { listingId: l.id, blockId: l.blockId, method, items: [{ pass: "1 day", child: kid.name, childId: kid.id, dates: [l.date] }] }, pKey);
  (c.world as any).__hasBookings = true;
  return { r, kid };
}
const docsFor = async (c: ActionCtx, listingId: string, email?: string) => (await W(c).bookings()).filter((b: any) => b.listingId === listingId && (!email || String(b.email).toLowerCase() === email.toLowerCase()));

const on = (c: ActionCtx) => S(c).on;
const hv = (c: ActionCtx) => S(c).hv;
const ready = (c: ActionCtx) => !!S(c).ready;

// ---------- home-visit bookings ----------
interface Addr { label: string; address?: string; postcode?: string }
const ADDRS: Addr[] = [
  { label: "NN5 7EA", postcode: "NN5 7EA" }, { label: "nn5 7ea", postcode: "nn5 7ea" }, { label: "NN57EA", postcode: "NN57EA" }, { label: "  NN5   7EA ", postcode: "  NN5   7EA " },
  { label: "NN50 1AA", postcode: "NN50 1AA" }, { label: "NN501AA", postcode: "NN501AA" }, { label: "NN6 8AA", postcode: "NN6 8AA" },
  { label: "SW1A 1AA", postcode: "SW1A 1AA" }, { label: "sw1a1aa", postcode: "sw1a1aa" }, { label: "SW10 9AA", postcode: "SW10 9AA" }, { label: "SW100AA", postcode: "SW100AA" }, { label: "SW1 2AA", postcode: "SW1 2AA" },
  { label: "LS1 4AP", postcode: "LS1 4AP" }, { label: "LS11 5AA", postcode: "LS11 5AA" }, { label: "B1 1AA", postcode: "B1 1AA" }, { label: "B10 0AA", postcode: "B10 0AA" }, { label: "M1 1AE", postcode: "M1 1AE" },
  { label: "NE1 4ST", postcode: "NE1 4ST" }, { label: "NE1 4ST lower", postcode: "ne1 4st" }, { label: "SW1A far", postcode: "SW1A 2AA" },
  { label: "none (family postcode)" }, { label: "blank postcode", address: "No postcode here", postcode: "" },
];

async function hvBook(c: ActionCtx) {
  const w = W(c); const s = S(c);
  const l = pick(w.rng, s.hv); const p = pick(w.rng, w.parents); const kid = pick(w.rng, p.children);
  const key = `${l.id}|${kid.id}`; if (s.used.has(key)) return { summary: `hv-book: ${p.key}/${kid.name} already used on ${l.kind}` };
  const a = pick(w.rng, ADDRS);
  const pc = a.postcode === undefined || !a.postcode.trim() ? FAMILY_POSTCODE : a.postcode;
  const unique = `Fz Lane ${w.stamp} n${++s.addrN}x`; // x ends the token so n1x is never inside n11x
  const sent = a.label.startsWith("none") ? undefined : { address: a.address ?? unique, postcode: a.postcode ?? "" };
  const blk = pick(w.rng, l.blocks); const date = pick(w.rng, blk.dates);
  const before = (await docsFor(c, l.id, p.email)).length;
  const r = await w.api("POST", "/api/my/bookings", { listingId: l.id, blockId: blk.id, method: "Cash on the day", items: [{ pass: "1 day", child: kid.name, childId: kid.id, dates: [date] }], ...(sent ? { serviceAddress: sent } : {}) }, p.key);
  (c.world as any).__hasBookings = true;
  s.used.add(key);
  const after = await docsFor(c, l.id, p.email);
  const created = after.length - before;
  const reason = String(r.json?.error ?? "");
  const isCoverage409 = r.status === 409 && /coverage|outside|miles from/i.test(reason);
  const geocodeFail = r.status === 409 && /Couldn't check/i.test(reason);
  const expectIn = l.kind === "hv-radius" ? (compact(pc) === compact(BASE_RADIUS) ? true : compact(pc).startsWith("NE1") ? true : false) : modelCovered(l.prefixes, pc);
  const tag = `${p.key} ${l.kind} "${a.label}" (${pc.trim()}) -> ${brief(r)}`;
  if (r.status < 300) {
    if (!expectIn) violate(c, "homevisit.accepted-outside-coverage", `${tag}: accepted a booking for ${pc.trim()} outside ${l.kind} coverage ${l.kind === "hv-radius" ? `${RADIUS_MILES} miles of ${BASE_RADIUS}` : `[${l.prefixes.join(", ")}]`}`);
    if (created < 1) violate(c, "homevisit.accepted-no-booking", `${tag}: 2xx but no booking was stored`);
    const doc = after.find((b: any) => !(b.serviceAddress == null) ) ?? after[after.length - 1];
    const stored = (after.filter((b: any) => (b.days ?? []).includes(date)).pop() ?? doc)?.serviceAddress;
    if (!stored?.postcode) violate(c, "homevisit.address-not-stored", `${tag}: booking accepted but no service postcode stored`);
    else if (compact(stored.postcode) !== compact(pc)) violate(c, "homevisit.address-mismatch", `${tag}: stored postcode "${stored.postcode}" differs from the one used "${pc}"`);
    if (sent?.address && sent.address === unique && stored?.address && stored.address !== unique) violate(c, "homevisit.address-mismatch", `${tag}: stored address "${stored.address}" differs from sent "${unique}"`);
    if (sent?.address === unique) s.unique.push(unique);
  } else if (isCoverage409 || geocodeFail) {
    if (created > 0) violate(c, "homevisit.refused-but-created", `${tag}: refused for coverage but ${created} booking(s) were stored`);
    if (expectIn && isCoverage409) violate(c, "homevisit.refused-inside-coverage", `${tag}: refused a postcode that is inside coverage: ${reason.slice(0, 80)}`);
  } else if (created > 0) violate(c, "homevisit.refused-but-created", `${tag}: ${r.status} but ${created} booking(s) were stored`);
  return { summary: tag };
}

// ---------- the leak scan ----------
function scan(c: ActionCtx, who: string, url: string, body: unknown, needles: string[], rule: string) {
  const text = JSON.stringify(body ?? "").toLowerCase();
  const textCompact = text.replace(/\s+/g, "");
  for (const n of needles) {
    const nl = n.toLowerCase();
    const esc = nl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`(^|[^a-z0-9-])${esc}($|[^a-z0-9])`).test(text) || (/^[a-z]{1,2}\d/.test(nl) && textCompact.includes(nl.replace(/\s+/g, "")))) violate(c, rule, `${who} GET ${url} contains "${n.slice(0, 60)}" (should be hidden from this viewer)`, "money");
  }
}
async function anon(url: string) {
  const r = await fetch(`${API}${url}`, { headers: { accept: "application/json" } });
  let json: any = null; try { json = await r.json(); } catch { /* not json */ }
  return { status: r.status, json };
}

// ---------- online state helpers ----------
const sessionDoc = async (l: OnL) => (await db.collection("onlineSessions").doc(`${l.id}_${l.date}`).get()).data() as any;
/** Where "now" sits relative to the join window of this listing's session (session doc may have been extended by the host: only judge clear cases). */
function phase(l: OnL): "early" | "open" | "late" | "edge" {
  const { mins } = ukParts(); const sec = new Date().getSeconds(); const now = mins + sec / 60;
  const opens = l.start - 10, closes = l.finish + 30;
  if (Math.abs(now - opens) < 1.5 || Math.abs(now - closes) < 1.5) return "edge";
  return now < opens ? "early" : now > closes + 20 ? "late" : now > closes ? "edge" : "open";
}

/** Mostly a (listing, parent) pair that really has a booking (so the join rules get exercised), sometimes any pair (so the refusals do). */
async function pairFor(c: ActionCtx, platformOnly = false): Promise<{ l: OnL; p: World["parents"][number] }> {
  const w = W(c); const pool = on(c).filter((o) => !platformOnly || o.mode === "platform");
  if (w.rng() < 0.75) {
    const docs = (await w.bookings()).filter((b: any) => pool.some((o) => o.id === b.listingId) && w.parentOf(b.email));
    if (docs.length) { const b = pick(w.rng, docs); return { l: pool.find((o) => o.id === b.listingId)!, p: w.parents.find((x) => x.key === w.parentOf(b.email))! }; }
  }
  return { l: pick(w.rng, pool), p: pick(w.rng, w.parents) };
}

async function onlineJoin(c: ActionCtx) {
  const w = W(c); const { l, p } = await pairFor(c);
  const docs = (await docsFor(c, l.id, p.email)).filter((b: any) => b.status !== undefined);
  const joinable = docs.some((b: any) => joinableDoc(b, l.date));
  const ph = phase(l); const sess = await sessionDoc(l);
  const hostLive = !!sess && sess.status === "live" && !sess.needsHost;
  const r = await w.api("POST", "/api/online-sessions/join", { listingId: l.id, date: l.date }, p.key);
  const tag = `${p.key} joins ${l.mode}${l.showLinkNow ? "+now" : ""}/${l.when} [${joinable ? "booked" : "not booked"}, host ${hostLive ? "live" : "not in"}, ${ph}] -> ${brief(r)}`;
  const leaked = r.status < 300 && (r.json?.token || r.json?.link);
  if (!joinable) {
    if (r.status < 300) violate(c, "online.join-not-entitled", `${tag}: let a family in whose booking is missing, cancelled, unpaid or for another child`, "money");
    else if (r.status !== 404 && r.status < 500) violate(c, "online.join-not-entitled-code", `${tag}: expected 404 (not on your bookings)`);
    return { summary: tag };
  }
  if (ph === "edge") return { summary: tag + " (edge, not judged)" };
  if (l.mode === "own") {
    const showable = ph === "open" || l.showLinkNow;
    if (ph === "late") { if (r.status < 300) violate(c, "online.join-after-window", `${tag}: handed the link after the window closed`, "money"); }
    else if (showable && r.status === 200 && r.json?.link !== l.link) violate(c, "online.own-link-wrong", `${tag}: link missing or different`);
    else if (showable && r.status >= 300 && r.status < 500) violate(c, "online.own-link-withheld", `${tag}: link should be available`);
    else if (!showable && leaked) violate(c, "online.own-link-early", `${tag}: own link handed over before the window opened and showLinkNow is off`, "money");
    return { summary: tag };
  }
  // platform room
  if (ph === "late") { if (r.status < 300) violate(c, "online.join-after-window", `${tag}: entered after the window closed`, "money"); }
  else if (ph === "early") { if (r.status < 300) violate(c, "online.join-before-window", `${tag}: entered before the window opened`, "money"); }
  else if (!hostLive) { if (r.status < 300) violate(c, "online.join-before-host", `${tag}: family entered an empty room (host has not started)`, "money"); }
  else if (r.status < 300 && !r.json?.token) violate(c, "online.join-no-token", `${tag}: 2xx without a room token`);
  else if (r.status >= 400 && r.status < 500) violate(c, "online.join-wrongly-refused", `${tag}: entitled family inside the window with the host live was refused`);
  if (r.status < 300 && r.json?.token) await attended(c, l, p.key, p.email, tag);
  return { summary: tag };
}

/** The family's client confirms it joined: the children must go on the register and the session's joined map. */
async function attended(c: ActionCtx, l: OnL, pKey: string, email: string, tag: string) {
  const w = W(c);
  const r = await w.api("POST", "/api/online-sessions/attended", { listingId: l.id, date: l.date }, pKey);
  if (r.status >= 300) { violate(c, "online.attended-refused", `${tag}: /attended answered ${brief(r)} right after a successful join`); return; }
  const sess = await sessionDoc(l);
  if (!sess || !Object.keys(sess.joined ?? {}).length) violate(c, "online.attendance-not-recorded", `${tag}: attended OK but the session has no joined children`);
  const reg = (await db.collection("registers").doc(`${l.blockId}_${l.date}`).get()).data() as any;
  const mine = (await docsFor(c, l.id, email)).filter((b: any) => joinableDoc(b, l.date));
  if (mine.length && !Object.values(reg?.entries ?? {}).some((e: any) => e?.status === "in")) violate(c, "online.register-not-marked", `${tag}: attended OK but nobody is marked in on the register`);
}

const ACTIONS_HVO: ActionDef[] = [
  { id: "hvo-ensure", area: "homevisit-online", weight: 40, applicable: (c) => !ready(c), async run(c) { await ensure(c); return { summary: `listings ready: ${S(c).hv.length} home-visit, ${S(c).on.length} online (${S(c).on.map((o) => `${o.mode}${o.showLinkNow ? "+now" : ""}/${o.when}`).join(", ")})` }; } },

  { id: "hv-book", area: "homevisit-online", weight: 22, applicable: ready, run: hvBook },

  { id: "hv-book-venue-with-address", area: "homevisit-online", weight: 4, applicable: (c) => ready(c),
    async run(c) { // an address sent to a VENUE listing must be dropped (rule state.venue-has-no-service-address judges the stored booking)
      const w = W(c); const l = pick(w.rng, w.listings); const p = pick(w.rng, w.parents); const kid = pick(w.rng, p.children);
      const k = `${l.id}|${kid.id}`; if (S(c).used.has(k)) return { summary: "venue-address: child already used" };
      S(c).used.add(k);
      const b = pick(w.rng, l.blocks);
      const r = await w.api("POST", "/api/my/bookings", { listingId: l.id, blockId: b.id, method: "Cash on the day", items: [{ pass: l.passes[0].name, child: kid.name, childId: kid.id, dates: [b.dates[0]] }], serviceAddress: { address: "9 Not Needed Rd", postcode: "SW1A 1AA" } }, p.key);
      (c.world as any).__hasBookings = true;
      return { summary: `${p.key} books venue ${l.kind} with a stray address -> ${brief(r)}` };
    } },

  { id: "hv-other-family-read", area: "homevisit-online", weight: 6, applicable: ready,
    async run(c) {
      const w = W(c); const s = S(c);
      const docs = (await w.bookings()).filter((b: any) => s.hv.some((l) => l.id === b.listingId) && b.serviceAddress?.postcode);
      if (!docs.length) return { summary: "other-family-read: no home-visit booking yet" };
      const b = pick(w.rng, docs); const owner = w.parentOf(b.email);
      const other = pick(w.rng, w.parents.filter((p) => p.key !== owner));
      const r = await w.api("GET", "/api/my/bookings", undefined, other.key);
      scan(c, other.key, "/api/my/bookings", r.json, [String(b.serviceAddress.address ?? "")].filter((x) => /^Fz Lane .* n\d+x$/.test(x)), "privacy.other-family-booking");
      const mineR = await w.api("GET", "/api/my/bookings", undefined, owner!);
      const has = JSON.stringify(mineR.json ?? "").includes(b.ref);
      if (mineR.status < 300 && !has) violate(c, "homevisit.own-booking-missing", `${owner} cannot see their own booking ${b.ref} in /api/my/bookings`);
      return { summary: `${other.key} reads /api/my/bookings: ${r.status}; owner ${owner} sees own ${b.ref}: ${has}` };
    } },

  { id: "hvo-privacy-scan", area: "homevisit-online", weight: 9, applicable: ready,
    async run(c) {
      const w = W(c); const s = S(c);
      const secrets = [...s.baseSeen, ...s.unique.filter((u) => u.includes("SECRETLINK"))];
      const p = pick(w.rng, w.parents);
      const ids = [...s.hv, ...s.on].map((l) => l.id);
      const list = await anon("/api/listings"); // anonymous
      scan(c, "anonymous", "/api/listings", list.json, secrets, "privacy.listing-leak");
      const one = pick(w.rng, ids);
      const oneAnon = await anon(`/api/listings/${one}`);
      scan(c, "anonymous", `/api/listings/${one}`, oneAnon.json, secrets, "privacy.listing-leak");
      const lp = await w.api("GET", "/api/listings", undefined, p.key);
      scan(c, p.key, "/api/listings", lp.json, secrets, "privacy.listing-leak");
      const op1 = await w.api("GET", `/api/listings/${one}`, undefined, p.key);
      scan(c, p.key, `/api/listings/${one}`, op1.json, secrets, "privacy.listing-leak");
      // own-link must also not leak through the sessions list of a family that has no booking on it, or the provider's today view to a parent
      const unbookedFor = async (l: OnL) => (await docsFor(c, l.id, p.email)).filter((b: any) => joinableDoc(b, l.date)).length === 0;
      const ownLs = s.on.filter((o) => o.mode === "own");
      const sess = await w.api("GET", "/api/online-sessions/mine", undefined, p.key);
      for (const l of ownLs) if (await unbookedFor(l)) scan(c, p.key, "/api/online-sessions/mine", sess.json, [l.link], "privacy.ownlink-leak");
      const today = await w.api("GET", "/api/online-sessions/today", undefined, p.key);
      if (today.status < 300) violate(c, "privacy.today-open-to-parent", `${p.key} got ${today.status} from the provider-only /api/online-sessions/today`, "money");
      const ownerListing = await w.api("GET", `/api/listings/${s.hv.find((h) => h.kind === "hv-radius")!.id}`, undefined, "op");
      const ownerSeesBase = JSON.stringify(ownerListing.json ?? "").includes(BASE_RADIUS);
      if (ownerListing.status < 300 && !ownerSeesBase) violate(c, "privacy.owner-lost-base", "the owning provider no longer sees their own base postcode on the listing");
      return { summary: `scan ${secrets.length} secrets over anon/${p.key}: list ${list.status}/${lp.status}, one ${oneAnon.status}/${op1.status}, owner sees base: ${ownerSeesBase}` };
    } },

  { id: "on-book", area: "homevisit-online", weight: 16, applicable: (c) => ready(c) && on(c).length > 0,
    async run(c) {
      const w = W(c); const l = pick(w.rng, on(c)); const p = pick(w.rng, w.parents);
      const res = await bookOnline(c, l, p.key, randInt(w.rng, 0, 2));
      if (!res) return { summary: "on-book: child already booked here" };
      let note = "";
      if (res.r.status < 300) {
        const docs = await docsFor(c, l.id, p.email);
        const mine = docs.filter((b: any) => (b.kids ?? []).some((k: any) => k.childId === res.kid.id) || b.childId === res.kid.id);
        const d = mine[mine.length - 1];
        if (d && w.rng() < 0.7) { const pr = await w.api("POST", `/api/bookings/${encodeURIComponent(d.ref)}/actions`, { type: "paid" }); note = ` paid:${pr.status}`; }
        if (d && w.rng() < 0.12) { const cr = await w.api("POST", `/api/bookings/${encodeURIComponent(d.ref)}/actions`, { type: "cancel", refund: "none", reason: "fuzz" }); note += ` cancel:${cr.status}`; }
      }
      return { summary: `${p.key} books ${l.mode}${l.showLinkNow ? "+now" : ""}/${l.when} -> ${brief(res.r)}${note}` };
    } },

  { id: "on-join", area: "homevisit-online", weight: 26, applicable: (c) => ready(c) && on(c).length > 0, run: onlineJoin },

  { id: "on-host-start", area: "homevisit-online", weight: 14, applicable: (c) => ready(c) && on(c).some((o) => o.mode === "platform"),
    async run(c) {
      const w = W(c); const l = pick(w.rng, on(c).filter((o) => o.mode === "platform"));
      const ph = phase(l);
      const r = await w.api("POST", "/api/online-sessions/join", { listingId: l.id, date: l.date }, "op");
      const tag = `host starts platform/${l.when} [${ph}] -> ${brief(r)}`;
      if (r.status === 200) {
        const s = await sessionDoc(l);
        if (s?.status !== "live" || s?.needsHost || !s?.hostSeenAt) violate(c, "online.host-start-not-recorded", `${tag}: session is ${s?.status} needsHost=${s?.needsHost}`);
        if (!r.json?.token || r.json?.isOwner !== true) violate(c, "online.host-no-owner-token", `${tag}: host did not get an owner token`);
        const lesson = await db.collection("hubLessons").doc(`${l.id}_${l.date}`).get();
        const hubOn = ((await w.api("GET", "/api/settings")).json?.features ?? {}).learninghub === true;
        if (lesson.exists && !hubOn) violate(c, "online.hub-mirror-while-off", `${tag}: a Hub lesson was mirrored although the Teaching Hub is off`);
      } else if (ph === "late" && r.status < 300) violate(c, "online.host-after-window", `${tag}`);
      else if (ph !== "late" && ph !== "edge" && r.status >= 400 && r.status < 500) violate(c, "online.host-start-refused", `${tag}: provider could not start its own session`);
      return { summary: tag };
    } },

  { id: "on-host-end", area: "homevisit-online", weight: 3, applicable: (c) => ready(c) && on(c).some((o) => o.mode === "platform"),
    async run(c) {
      const w = W(c); const l = pick(w.rng, on(c).filter((o) => o.mode === "platform"));
      const r = await w.api("POST", "/api/online-sessions/end", { listingId: l.id, date: l.date }, "op");
      const s = await sessionDoc(l);
      if (r.status === 200 && (s?.status !== "ended" || !s?.needsHost)) violate(c, "online.end-not-recorded", `host ends ${l.when}: 200 but session is ${s?.status}/needsHost=${s?.needsHost}`);
      return { summary: `host ends platform/${l.when} -> ${brief(r)}` };
    } },

  { id: "on-extend", area: "homevisit-online", weight: 6, applicable: (c) => ready(c) && on(c).some((o) => o.mode === "platform"),
    async run(c) {
      const w = W(c); const { l, p } = await pairFor(c, true); const asHost = w.rng() < 0.4;
      const docs = await docsFor(c, l.id, p.email); const booked = docs.some((b: any) => joinableDoc(b, l.date));
      const before = await sessionDoc(l);
      const r = await w.api("POST", "/api/online-sessions/extend", { listingId: l.id, date: l.date }, asHost ? "op" : p.key);
      const tag = `${asHost ? "host" : p.key + (booked ? "(booked)" : "(not booked)")} extends platform/${l.when} -> ${brief(r)}`;
      if (!asHost && !booked && r.status < 300) violate(c, "online.extend-not-entitled", `${tag}: a family with no entitled booking extended a session`, "money");
      if (!asHost && booked && !(before?.status === "live" && !before?.needsHost) && r.status < 300) violate(c, "online.extend-before-host", `${tag}: family extended while the host was not in`);
      if (r.status === 200) { const s = await sessionDoc(l); if (!s?.roomUntil) violate(c, "online.extend-not-recorded", `${tag}: no roomUntil stored`); }
      return { summary: tag };
    } },

  { id: "on-check-mine", area: "homevisit-online", weight: 12, applicable: (c) => ready(c) && on(c).length > 0,
    async run(c) {
      const w = W(c); const { l, p } = await pairFor(c);
      const docs = await docsFor(c, l.id, p.email); const booked = docs.some((b: any) => joinableDoc(b, l.date));
      const ph = phase(l);
      const r = await w.api("GET", "/api/online-sessions/mine", undefined, p.key);
      const rows = (Array.isArray(r.json) ? r.json : []) as any[];
      const row = rows.find((x) => x.listingId === l.id && x.date === l.date);
      const tag = `${p.key} /mine ${l.mode}${l.showLinkNow ? "+now" : ""}/${l.when} [${booked ? "booked" : "not booked"}, ${ph}] -> ${r.status} row:${!!row}${row?.link ? " link" : ""}`;
      if (r.status >= 300) return { summary: tag };
      if (!booked && row) violate(c, "online.mine-not-entitled", `${tag}: a session appeared for a family with no entitled booking`, "money");
      if (booked && ph !== "edge" && ph !== "late" && !row) violate(c, "online.mine-missing", `${tag}: entitled family does not see their session`);
      if (row) {
        if (l.mode === "platform" && row.link) violate(c, "online.platform-link-in-list", `${tag}: platform session carries a link`, "money");
        if (l.mode === "own" && ph !== "edge") {
          const should = ph === "open" || l.showLinkNow;
          if (row.link && !should) violate(c, "online.own-link-early", `${tag}: own link shown before the window and showLinkNow is off`, "money");
          if (!row.link && should && !row.noLink) violate(c, "online.own-link-missing", `${tag}: own link should be visible now`);
          if (row.link && row.link !== l.link) violate(c, "online.own-link-wrong", `${tag}: wrong link`);
        }
      }
      return { summary: tag };
    } },

  { id: "on-op-today", area: "homevisit-online", weight: 5, applicable: (c) => ready(c) && on(c).length > 0,
    async run(c) {
      const w = W(c);
      const r = await w.api("GET", `/api/online-sessions/today?date=${on(c)[0].date}`, undefined, "op");
      if (r.status >= 300) return { summary: `op today -> ${brief(r)}` };
      const rows = r.json as any[];
      for (const l of on(c)) {
        const joinable = (await docsFor(c, l.id)).filter((b: any) => joinableDoc(b, l.date));
        const row = rows.find((x) => x.listingId === l.id);
        if (joinable.length && !row) violate(c, "online.today-missing", `provider's today view has no row for ${l.title} although ${joinable.length} entitled booking(s) exist`);
        if (!joinable.length && row && row.booked > 0) violate(c, "online.today-phantom", `provider's today view shows ${row.booked} booked on ${l.title} with no entitled booking`);
        if (row && l.mode === "own" && row.link !== l.link) violate(c, "online.today-link", `provider's today view lost the own link on ${l.title}`);
      }
      return { summary: `op today -> ${rows.length} rows` };
    } },
];

export const ACTIONS: ActionDef[] = ACTIONS_HVO;
