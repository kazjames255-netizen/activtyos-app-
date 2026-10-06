// Discounts + add-ons fuzz actions: rule edits on listings, discount codes, baskets with add-ons, sibling bookings, simultaneous checkouts (early-bird claim), add-on edits/deletes after bookings exist, hidden/closed tickets.
// Every action tolerates 4xx; the invariants (money.*) judge the resulting bookings.
import type { ActionCtx, ActionDef } from "../types";
import { pick, randInt, type World } from "../world";

const W = (c: ActionCtx) => c.world as World;
const METHODS = ["Bank transfer", "Cash on the day"]; // the fuzz operator offers no card
const GAP = 3500; // the email rule treats bookings <3 s apart as one checkout, so separate checkouts by one family are spaced out
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const shuffle = <T>(rng: () => number, xs: T[]) => [...xs].sort(() => rng() - 0.5);
const st = (r: { status: number; json: any }) => `${r.status}${r.status >= 300 ? " " + String(typeof r.json?.error === "string" ? r.json.error : JSON.stringify(r.json?.error ?? "")).slice(0, 70) : ""}`;

// Add-ons the fuzzer owns in the operator library. "fz-ghost" is deliberately never put on any listing; "fz-neg" has a negative price.
const ADDONS = [
  { id: "fz-lunch", name: "Fuzz lunch", type: "perday", price: 4.5 },
  { id: "fz-tshirt", name: "Fuzz t-shirt", type: "oneoff", price: 12 },
  { id: "fz-free", name: "Fuzz freebie", type: "oneoff", price: 0 },
  { id: "fz-neg", name: "Fuzz negative", type: "oneoff", price: -5 },
  { id: "fz-ghost", name: "Fuzz ghost", type: "oneoff", price: 7 },
];
const ON_LISTING = ["fz-lunch", "fz-tshirt", "fz-free", "fz-neg"];

type St = { ready?: boolean; codes: string[]; codeN: number };
const S = (c: ActionCtx): St => ((c.world as any).__da ??= { codes: [], codeN: 0 } as St);

async function ensure(c: ActionCtx) {
  const s = S(c); const w = W(c);
  if (s.ready) return;
  s.ready = true;
  const lib = (await w.api("GET", "/api/library")).json ?? {};
  const keep = (lib.addons ?? []).filter((a: any) => !String(a.id).startsWith("fz-"));
  await w.api("PUT", "/api/library", { addons: [...keep, ...ADDONS] });
  for (const l of w.listings) await w.api("PUT", `/api/listings/${l.id}`, { addonIds: ON_LISTING });
}

const fresh = (c: ActionCtx) => `r${Math.floor(c.rng() * 1e9).toString(36)}`;
function rule(c: ActionCtx, kind: "person" | "session" | "early", method: "percent" | "subtract" | "price", dated: boolean, passNames: string[]) {
  const w = W(c);
  const todayPlus = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  return {
    id: fresh(c), kind, appliesTo: "all", name: `${kind} ${method}`, passNames, enabled: true,
    moreThan: kind === "early" ? 0 : randInt(w.rng, 1, 2),
    method, value: method === "percent" ? pick(w.rng, [5, 10, 25, 50, 100]) : pick(w.rng, [1, 2.5, 5, 10, 30]),
    beforeDate: kind === "early" && dated ? todayPlus(pick(w.rng, [-3, 10, 60])) : "",
  };
}

async function basket(c: ActionCtx, opts: { listingIdx?: number; parentKey?: string; codes?: string[]; nKids?: number; addons?: boolean; weeks?: number[] }) {
  const w = W(c);
  const l = w.listings[opts.listingIdx ?? randInt(w.rng, 0, w.listings.length - 1)];
  const p = opts.parentKey ? w.parents.find((x) => x.key === opts.parentKey)! : pick(w.rng, w.parents);
  const fit = p.children.filter((k) => l.allowOutOfRange || (k.age >= l.ageFrom && k.age <= l.ageTo));
  const kids = shuffle(w.rng, fit.length ? fit : p.children).slice(0, opts.nKids ?? randInt(w.rng, 1, 3));
  const b = l.blocks[Math.min(opts.weeks?.[0] ?? randInt(w.rng, 0, l.blocks.length - 1), l.blocks.length - 1)];
  const pass = pick(w.rng, l.passes);
  const dates = shuffle(w.rng, b.dates).slice(0, Math.min(pass.days, b.dates.length)).sort();
  const items = kids.map((k) => {
    const addons: any[] = [];
    if (opts.addons) {
      const n = randInt(w.rng, 0, 3);
      for (let i = 0; i < n; i++) {
        const id = pick(w.rng, [...ON_LISTING, "fz-ghost", "fz-lunch"]); // repeats and not-on-listing happen on purpose
        const a: any = { id };
        if (id === "fz-lunch" && w.rng() < 0.5) a.days = shuffle(w.rng, dates).slice(0, randInt(w.rng, 1, dates.length));
        if (id === "fz-lunch" && w.rng() < 0.1) a.days = [b.dates[0], "2099-01-01"]; // a day outside the pass
        addons.push(a);
      }
    }
    return { pass: pass.name, child: k.name, childId: k.id, dates, addons };
  });
  const method = pick(w.rng, METHODS);
  const body: any = { listingId: l.id, blockId: b.id, method, items };
  if (opts.codes?.length) body.discountCodes = opts.codes;
  const r = await w.api("POST", "/api/my/bookings", body, p.key);
  (c.world as any).__hasBookings = true;
  return { r, text: `${p.key} ${l.kind}/${pass.name} x${kids.length} ${dates.length}d ${method}${opts.codes?.length ? " codes=" + opts.codes.join("+") : ""}${opts.addons ? " addons=" + items.map((i) => i.addons.map((a: any) => a.id.slice(3)).join(",")).join("/") : ""}: ${st(r)}` };
}

const ACTIONS_DA: ActionDef[] = [
  { id: "da-set-rules", area: "discounts-addons", weight: 8, applicable: () => true,
    async run(c) {
      await ensure(c);
      const w = W(c); const l = pick(w.rng, w.listings);
      const rules: any[] = [];
      const n = randInt(w.rng, 0, 4);
      for (let i = 0; i < n; i++) {
        const kind = pick(w.rng, ["person", "session", "early", "early"] as const);
        const method = kind === "person" ? (w.rng() < 0.85 ? "percent" : "subtract") : pick(w.rng, ["percent", "subtract", "price"] as const);
        rules.push(rule(c, kind, method as any, w.rng() < 0.6, w.rng() < 0.6 ? [] : [pick(w.rng, l.passes).name]));
      }
      const r = await w.api("PUT", `/api/listings/${l.id}`, { discounts: rules });
      return { summary: `rules on ${l.kind}: ${rules.map((x) => `${x.kind}/${x.method}${x.value}${x.beforeDate ? "<" + x.beforeDate : ""}`).join(" ") || "none"} -> ${st(r)}` };
    } },

  { id: "da-create-code", area: "discounts-addons", weight: 5, applicable: () => true,
    async run(c) {
      await ensure(c);
      const w = W(c); const s = S(c);
      const code = `FZ${s.codeN++}${fresh(c).slice(1, 5)}`.toUpperCase();
      const type = pick(w.rng, ["percent", "amount", "perAttendee"] as const);
      const body: any = { code, type, value: type === "percent" ? pick(w.rng, [10, 50, 100]) : pick(w.rng, [2, 5, 15, 500]) };
      if (w.rng() < 0.3) body.minSpend = pick(w.rng, [10, 50, 100]);
      if (w.rng() < 0.3) body.usageLimit = randInt(w.rng, 1, 3);
      if (w.rng() < 0.2) body.perCustomerLimit = true;
      if (w.rng() < 0.25) body.exclusive = true;
      if (w.rng() < 0.3) body.listingId = pick(w.rng, w.listings).id;
      const r = await w.api("POST", "/api/discounts", body);
      if (r.status < 300) s.codes.push(code);
      return { summary: `create code ${code} ${type} ${body.value}${body.exclusive ? " excl" : ""} -> ${st(r)}` };
    } },

  { id: "da-basket", area: "discounts-addons", weight: 14, applicable: () => true,
    async run(c) { await ensure(c); const { text } = await basket(c, { addons: c.rng() < 0.7 }); return { summary: `basket ${text}` }; } },

  { id: "da-basket-codes", area: "discounts-addons", weight: 8, applicable: (c) => S(c).codes.length > 0,
    async run(c) {
      await ensure(c); const w = W(c); const s = S(c);
      const codes = shuffle(w.rng, s.codes).slice(0, randInt(w.rng, 1, 2));
      if (w.rng() < 0.1) codes.push("NOSUCHCODE");
      const { text } = await basket(c, { codes, addons: c.rng() < 0.5 });
      return { summary: `basket ${text}` };
    } },

  // Siblings booked in separate checkouts, on different weeks of the same listing.
  { id: "da-siblings-two-weeks", area: "discounts-addons", weight: 6, applicable: () => true,
    async run(c) {
      await ensure(c); const w = W(c);
      const li = randInt(w.rng, 0, w.listings.length - 1); const p = pick(w.rng, w.parents);
      const a = await basket(c, { listingIdx: li, parentKey: p.key, nKids: 1, weeks: [0], addons: c.rng() < 0.5 });
      await sleep(GAP);
      const b = await basket(c, { listingIdx: li, parentKey: p.key, nKids: randInt(w.rng, 1, 2), weeks: [1], addons: c.rng() < 0.5 });
      return { summary: `siblings: ${a.text} || ${b.text}` };
    } },

  // Two checkouts by one family at the same instant, on two listings (money/capacity under concurrency). Same-listing races can't be judged by
  // email.one-confirmation-per-checkout (it can't tell two simultaneous checkouts from one basket), so those are left to the sequential sibling action.
  { id: "da-simultaneous-checkouts", area: "discounts-addons", weight: 6, applicable: () => true,
    async run(c) {
      await ensure(c); const w = W(c);
      const p = pick(w.rng, w.parents);
      const li = randInt(w.rng, 0, w.listings.length - 1);
      const lj = (li + 1 + randInt(w.rng, 0, w.listings.length - 2)) % w.listings.length;
      const [a, b] = await Promise.all([
        basket(c, { listingIdx: li, parentKey: p.key, nKids: 1, weeks: [0] }),
        basket(c, { listingIdx: lj, parentKey: p.key, nKids: 1, weeks: [1] }),
      ]);
      return { summary: `simultaneous ${p.key}: ${a.text} || ${b.text}` };
    } },

  { id: "da-edit-addon-price", area: "discounts-addons", weight: 4, applicable: () => true,
    async run(c) {
      await ensure(c); const w = W(c);
      const lib = (await w.api("GET", "/api/library")).json ?? {};
      const a = pick(w.rng, ADDONS.slice(0, 2));
      const price = pick(w.rng, [0, 1, 3.33, 20, -2]);
      const next = (lib.addons ?? []).map((x: any) => (x.id === a.id ? { ...x, price } : x));
      const r = await w.api("PUT", "/api/library", { addons: next });
      return { summary: `addon ${a.id} price -> ${price}: ${st(r)}` };
    } },

  // Delete an add-on from the library (bookings already holding it must keep their price), or put it back.
  { id: "da-delete-or-restore-addon", area: "discounts-addons", weight: 3, applicable: () => true,
    async run(c) {
      await ensure(c); const w = W(c);
      const lib = (await w.api("GET", "/api/library")).json ?? {};
      const cur: any[] = lib.addons ?? [];
      const a = pick(w.rng, ADDONS.slice(0, 3));
      const has = cur.some((x) => x.id === a.id);
      const r = await w.api("PUT", "/api/library", { addons: has ? cur.filter((x) => x.id !== a.id) : [...cur, a] });
      return { summary: `addon ${a.id} ${has ? "deleted" : "restored"}: ${st(r)}` };
    } },

  // Untick/tick an add-on on one listing (a basket may still hold it).
  { id: "da-toggle-listing-addon", area: "discounts-addons", weight: 3, applicable: () => true,
    async run(c) {
      await ensure(c); const w = W(c);
      const l = pick(w.rng, w.listings);
      const ids = shuffle(w.rng, ON_LISTING).slice(0, randInt(w.rng, 0, ON_LISTING.length));
      const r = await w.api("PUT", `/api/listings/${l.id}`, { addonIds: ids });
      return { summary: `addons on ${l.kind} = [${ids.map((x) => x.slice(3)).join(",")}]: ${st(r)}` };
    } },

  // Hide/close a ticket (capacity 0 = closed) or reopen it; then try to book it.
  { id: "da-ticket-close-then-book", area: "discounts-addons", weight: 4, applicable: () => true,
    async run(c) {
      await ensure(c); const w = W(c);
      const li = randInt(w.rng, 0, w.listings.length - 1); const l = w.listings[li];
      const pass = pick(w.rng, l.passes);
      // Only close a ticket nobody holds yet: shrinking a cap under live bookings is a legal operator edit but the cap rule can't tell it from an overbooking.
      const held = (await w.bookings()).some((b) => b.listingId === l.id && ["Confirmed", "Approval needed", "Offered"].includes(b.status) && String(b.pass ?? "").startsWith(pass.name));
      const closed = !held && w.rng() < 0.6;
      const r1 = await w.api("PUT", `/api/listings/${l.id}`, { ticketOverrides: { [pass.name]: closed ? { capacity: "0" } : { capacity: "" } } });
      const { text } = await basket(c, { listingIdx: li, nKids: 1 });
      return { summary: `${closed ? "close" : "reopen"} ${pass.name} on ${l.kind} (${st(r1)}); then ${text}` };
    } },
];

export const ACTIONS: ActionDef[] = ACTIONS_DA;
