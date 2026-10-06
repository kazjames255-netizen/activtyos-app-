// Core fuzz actions: the everyday things parents and providers do to bookings. Areas: bookings, waitlist, money, capacity.
// Every action tolerates 4xx (a refusal is a legal outcome); only an unexpected 5xx or a broken invariant is a failure.
import type { ActionCtx, ActionDef } from "../types";
import { db } from "../../../src/firebase";
import { expireOffers } from "../../../src/lib/waitlist";
import { pick, randInt, sleep, type ListingInfo, type World } from "../world";

const W = (c: ActionCtx) => c.world as World;
const LIVE = ["Confirmed", "Approval needed", "Offered"];
const OPEN = ["Confirmed", "Approval needed", "Offered", "Waitlisted"];
const METHODS = ["card", "card", "Bank transfer", "Cash on the day"];
const shuffle = <T>(rng: () => number, xs: T[]) => [...xs].sort(() => rng() - 0.5);

async function mine(c: ActionCtx, filter: (b: any) => boolean): Promise<any[]> { return (await W(c).bookings()).filter(filter); }
const hasRows = (c: ActionCtx) => !!(c.world as any).__hasBookings;
const days = (b: any): string[] => (Array.isArray(b.days) ? b.days : []);
const parentKey = (c: ActionCtx, b: any) => W(c).parentOf(b.email) ?? "p0";
const okSummary = (r: { status: number; json: any }, what: string) => `${what} -> ${r.status}${r.status >= 300 ? ` ${String(r.json?.error ?? "").slice(0, 80)}` : ""}`;

// ---- booking ----
function bookAction(id: string, weight: number, shape: "single" | "multi" | "week" | "twoWeeks"): ActionDef {
  return {
    id, area: "bookings", weight, applicable: () => true,
    async run(c) {
      const w = W(c);
      const l = pick(w.rng, w.listings);
      const p = pick(w.rng, w.parents);
      const nKids = randInt(w.rng, 1, shape === "single" ? 3 : 2);
      const kids = shuffle(w.rng, p.children).slice(0, nKids);
      const method = pick(w.rng, METHODS);
      const blocks = shape === "twoWeeks" ? l.blocks.slice(0, 2) : [pick(w.rng, l.blocks)];
      const out: string[] = [];
      for (const b of blocks) {
        const pass = shape === "single" ? l.passes[0] : shape === "week" ? l.passes[2] : pick(w.rng, l.passes);
        const dates = shuffle(w.rng, b.dates).slice(0, Math.min(pass.days, b.dates.length)).sort();
        const items = kids.map((k) => ({ pass: pass.name, child: k.name, childId: k.id, dates }));
        const r = await w.api("POST", "/api/my/bookings", { listingId: l.id, blockId: b.id, method, items }, p.key);
        out.push(`${l.kind}/${pass.name} x${kids.length} ${dates.length}d ${method}: ${r.status}${r.status >= 300 ? " " + String(r.json?.error ?? "").slice(0, 60) : ""}`);
      }
      (c.world as any).__hasBookings = true;
      return { summary: `${p.key} books ${out.join(" | ")}` };
    },
  };
}

// ---- operator + parent follow-ups ----
const ACTIONS_CORE: ActionDef[] = [
  bookAction("book-single", 14, "single"),
  bookAction("book-multiday", 9, "multi"),
  bookAction("book-fullweek", 5, "week"),
  bookAction("book-two-weeks", 3, "twoWeeks"),

  { id: "op-mark-paid", area: "money", weight: 6, applicable: hasRows,
    async run(c) {
      const t = pick(W(c).rng, await mine(c, (b) => LIVE.includes(b.status) && !/^(paid|funded)$/i.test(b.pay ?? "") && (b.amount ?? 0) > 0).then((x) => (x.length ? x : [null])));
      if (!t) return { summary: "mark-paid: nothing unpaid" };
      const r = await W(c).api("POST", `/api/bookings/${encodeURIComponent(t.ref)}/actions`, { type: "paid" });
      return { summary: okSummary(r, `operator marks ${t.ref} paid`) };
    } },

  { id: "op-approve", area: "bookings", weight: 6, applicable: hasRows,
    async run(c) {
      const t = (await mine(c, (b) => b.status === "Approval needed"))[0];
      if (!t) return { summary: "approve: nothing awaiting approval" };
      const r = await W(c).api("POST", `/api/bookings/${encodeURIComponent(t.ref)}/actions`, { type: "approve" });
      return { summary: okSummary(r, `operator approves ${t.ref}`) };
    } },

  { id: "op-decline", area: "bookings", weight: 2, applicable: hasRows,
    async run(c) {
      const t = (await mine(c, (b) => b.status === "Approval needed" || b.status === "Waitlisted"))[0];
      if (!t) return { summary: "decline: nothing to decline" };
      const r = await W(c).api("POST", `/api/bookings/${encodeURIComponent(t.ref)}/actions`, { type: "decline", reason: "fuzz decline" });
      return { summary: okSummary(r, `operator declines ${t.ref} (${t.status})`) };
    } },

  { id: "parent-cancel-whole", area: "bookings", weight: 7, applicable: hasRows,
    async run(c) {
      const w = W(c);
      const list = await mine(c, (b) => OPEN.includes(b.status));
      if (!list.length) return { summary: "cancel: nothing open" };
      const t = pick(w.rng, list);
      const refundPref = pick(w.rng, ["card", "wallet"] as const);
      const r = await w.api("POST", `/api/my/bookings/${encodeURIComponent(t.ref)}/cancel?tenantId=${w.op.tenantId}`, { msg: "fuzz cancel", refundPref }, parentKey(c, t));
      return { summary: okSummary(r, `parent cancels ${t.ref} (${t.status}, ${refundPref})`) };
    } },

  { id: "parent-cancel-days", area: "bookings", weight: 5, applicable: hasRows,
    async run(c) {
      const w = W(c);
      const list = await mine(c, (b) => LIVE.includes(b.status) && days(b).length >= 2);
      if (!list.length) return { summary: "cancel-days: nothing with 2+ days" };
      const t = pick(w.rng, list);
      const some = shuffle(w.rng, days(t)).slice(0, randInt(w.rng, 1, days(t).length - 1));
      const resolution = pick(w.rng, ["refund", "wallet"] as const);
      const kidsLive = (t.kids ?? []).filter((k: any) => !k.cancelled);
      const body = kidsLive.length > 1 ? { resolution, kids: [{ name: kidsLive[0].name, childId: kidsLive[0].childId, days: some.filter((d) => (kidsLive[0].dates ?? kidsLive[0].days ?? days(t)).includes(d)) }] } : { resolution, days: some };
      const r = await w.api("POST", `/api/my/bookings/${encodeURIComponent(t.ref)}/cancel?tenantId=${w.op.tenantId}`, body, parentKey(c, t));
      return { summary: okSummary(r, `parent cancels ${some.length} day(s) of ${t.ref} (${resolution})`) };
    } },

  { id: "op-cancel", area: "bookings", weight: 3, applicable: hasRows,
    async run(c) {
      const w = W(c);
      const t = pick(w.rng, (await mine(c, (b) => LIVE.includes(b.status))).concat([null as any]));
      if (!t) return { summary: "op-cancel: nothing live" };
      const refund = pick(w.rng, ["full", "partial", "none"] as const);
      const r = await w.api("POST", `/api/bookings/${encodeURIComponent(t.ref)}/actions`, { type: "cancel", refund, ...(refund === "partial" ? { amount: Math.max(1, Math.floor((t.amount ?? 20) / 2)) } : {}), reason: "fuzz" });
      return { summary: okSummary(r, `operator cancels ${t.ref} refund=${refund}`) };
    } },

  { id: "op-cancel-child", area: "bookings", weight: 3, applicable: hasRows,
    async run(c) {
      const w = W(c);
      const list = await mine(c, (b) => LIVE.includes(b.status) && (b.kids ?? []).filter((k: any) => !k.cancelled).length > 1);
      if (!list.length) return { summary: "cancel-child: no multi-child booking" };
      const t = pick(w.rng, list);
      const ki = (t.kids as any[]).findIndex((k) => !k.cancelled);
      const resolution = pick(w.rng, ["refund", "wallet", "none"] as const);
      const r = await w.api("POST", `/api/bookings/${encodeURIComponent(t.ref)}/actions`, { type: "cancel-child", ki, resolution });
      return { summary: okSummary(r, `operator cancels child #${ki} of ${t.ref} (${resolution})`) };
    } },

  { id: "op-refund-decision", area: "money", weight: 4, applicable: hasRows,
    async run(c) {
      const w = W(c);
      const t = (await mine(c, (b) => /refund pending/i.test(b.pay ?? "")))[0];
      if (!t) return { summary: "refund: nothing pending" };
      const type = w.rng() < 0.8 ? "refund-approve" : "refund-decline";
      const r = await w.api("POST", `/api/bookings/${encodeURIComponent(t.ref)}/actions`, { type });
      return { summary: okSummary(r, `operator ${type} ${t.ref}`) };
    } },

  { id: "parent-move-dates", area: "bookings", weight: 4, applicable: hasRows,
    async run(c) {
      const w = W(c);
      const list = await mine(c, (b) => b.status === "Confirmed" && days(b).length >= 1 && !b.dateChangeRequest);
      if (!list.length) return { summary: "move: nothing movable" };
      const t = pick(w.rng, list);
      const l = w.listings.find((x) => x.id === t.listingId); const blk = l?.blocks.find((x) => x.id === t.blockId);
      const free = (blk?.dates ?? []).filter((d) => !days(t).includes(d));
      if (!free.length) return { summary: `move ${t.ref}: no free day in the block` };
      const from = pick(w.rng, days(t)); const to = pick(w.rng, free);
      const r = await w.api("POST", `/api/my/bookings/${encodeURIComponent(t.ref)}/amend?tenantId=${w.op.tenantId}`, { moves: [{ from, to }] }, parentKey(c, t));
      return { summary: okSummary(r, `parent moves ${t.ref} ${from} -> ${to}`) };
    } },

  { id: "op-move-decision", area: "bookings", weight: 3, applicable: hasRows,
    async run(c) {
      const w = W(c);
      const t = (await mine(c, (b) => b.dateChangeRequest?.status === "pending"))[0];
      if (!t) return { summary: "move-decision: no pending request" };
      const type = w.rng() < 0.75 ? "move-approve" : "move-deny";
      const r = await w.api("POST", `/api/bookings/${encodeURIComponent(t.ref)}/actions`, { type, ...(type === "move-deny" ? { reason: "fuzz" } : {}) });
      return { summary: okSummary(r, `operator ${type} ${t.ref}`) };
    } },

  // ---- waiting list ----
  { id: "leave-waitlist", area: "waitlist", weight: 3, applicable: hasRows,
    async run(c) {
      const w = W(c);
      const t = (await mine(c, (b) => b.status === "Waitlisted"))[0];
      if (!t) return { summary: "leave-waitlist: nobody waiting" };
      const r = await w.api("POST", `/api/my/bookings/${encodeURIComponent(t.ref)}/cancel?tenantId=${w.op.tenantId}`, { msg: "fuzz leaves the list" }, parentKey(c, t));
      return { summary: okSummary(r, `parent leaves the waiting list ${t.ref}`) };
    } },

  { id: "op-offer", area: "waitlist", weight: 7, applicable: hasRows,
    async run(c) {
      const w = W(c);
      const t = pick(w.rng, (await mine(c, (b) => b.status === "Waitlisted")).concat([null as any]));
      if (!t) return { summary: "offer: nobody waiting" };
      const r = await w.api("POST", `/api/bookings/${encodeURIComponent(t.ref)}/actions`, { type: "offer" });
      return { summary: okSummary(r, `operator offers ${t.ref}`) };
    } },

  { id: "parent-offer-reply", area: "waitlist", weight: 5, applicable: hasRows,
    async run(c) {
      const w = W(c);
      const t = (await mine(c, (b) => b.status === "Offered"))[0];
      if (!t) return { summary: "offer-reply: no open offer" };
      const accept = w.rng() < 0.65;
      const r = await w.api("POST", `/api/my/bookings/${encodeURIComponent(t.ref)}/${accept ? "accept-offer" : "decline-offer"}?tenantId=${w.op.tenantId}`, {}, parentKey(c, t));
      return { summary: okSummary(r, `parent ${accept ? "accepts" : "declines"} offer ${t.ref}`) };
    } },

  { id: "offer-expires", area: "waitlist", weight: 3, applicable: hasRows,
    async run(c) {
      const t = (await mine(c, (b) => b.status === "Offered"))[0];
      if (!t) return { summary: "offer-expires: no open offer" };
      await db.collection("bookings").doc(t.id).update({ offerExpiresAt: new Date(Date.now() - 60_000).toISOString() });
      await expireOffers();
      return { summary: `offer on ${t.ref} lapsed, expiry sweep run` };
    } },

  { id: "sweep-offers", area: "waitlist", weight: 2, applicable: () => true,
    async run() { await expireOffers(); return { summary: "expiry sweep run" }; } },

  // ---- capacity ----
  { id: "op-change-capacity", area: "capacity", weight: 4, applicable: () => true,
    async run(c) {
      const w = W(c);
      const l = pick(w.rng, w.listings.filter((x) => x.kind !== "whole-listing" || true));
      // Never lower capacity below what is already held (a deliberate overbook is not a bug to hunt): read the highest held count first.
      const blocks = (await db.collection("blocks").where("listingId", "==", l.id).get()).docs.map((d) => d.data() as any);
      const held = Math.max(0, ...blocks.flatMap((b) => (l.scope === "day" ? Object.values(b.dayCounts ?? {}) : [b.bookedCount ?? 0]) as number[]));
      const next = Math.max(held, l.capacity + randInt(w.rng, -1, 3), 1);
      const r = await w.api("PUT", `/api/listings/${l.id}`, { maxAttendees: String(next) });
      if (r.status < 300) l.capacity = next;
      return { summary: okSummary(r, `capacity of ${l.kind} ${l.capacity}->${next}`) };
    } },

  { id: "op-change-ticket-cap", area: "capacity", weight: 3, applicable: () => true,
    async run(c) {
      const w = W(c);
      const l = pick(w.rng, w.listings);
      const cap = randInt(w.rng, 0, 3);
      const r = await w.api("PUT", `/api/listings/${l.id}`, { ticketOverrides: { "1 day": { capacity: cap === 0 ? "" : String(cap) } } });
      return { summary: okSummary(r, `ticket cap of '1 day' on ${l.kind} -> ${cap === 0 ? "none" : cap}`) };
    } },

  { id: "op-close-reopen-listing", area: "capacity", weight: 1, applicable: () => true,
    async run(c) {
      const w = W(c);
      const l = pick(w.rng, w.listings);
      const r1 = await w.api("PUT", `/api/listings/${l.id}`, { status: "draft" });
      await sleep(200);
      const r2 = await w.api("PUT", `/api/listings/${l.id}`, { status: "live" });
      return { summary: `listing ${l.kind} unpublished ${r1.status} then republished ${r2.status}` };
    } },
];

export const ACTIONS: ActionDef[] = ACTIONS_CORE;
export type { ListingInfo };
