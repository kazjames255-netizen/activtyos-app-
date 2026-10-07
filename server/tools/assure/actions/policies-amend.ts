// Policies + amend fuzz actions (area "policies-amend"): cancellation-policy edits, date-change (amend) rules, and the money that follows.
// Each action that changes money reads the booking before and after and checks the result against an independent oracle built from the
// pure rules (lib/cancellation.ts refundFor/effectiveRefundDate, lib/dateChange.ts notice + limit). A disagreement is pushed onto
// world.__violations (rules "pa-*") and fails the seed. Every action tolerates 4xx; only a wrongly ACCEPTED or wrongly REFUSED request is a finding.
import type { ActionCtx, ActionDef } from "../types";
import { pick, randInt, type World } from "../world";
import { DEFAULT_POLICIES, effectiveRefundDate, refundFor, type NamedPolicy } from "../../../../lib/cancellation";
import { refundableSoFar, refundedGross } from "../../../../features/bookings/helpers";
import { amendLimitError, amendNoticeError } from "../../../src/lib/dateChange";

const W = (c: ActionCtx) => c.world as World;
const hasRows = (c: ActionCtx) => !!(c.world as any).__hasBookings;
const days = (b: any): string[] => {
  const k = (Array.isArray(b?.kids) ? b.kids : []).flatMap((x: any) => (x.cancelled ? [] : x.dates ?? x.days ?? []));
  return [...new Set([...(Array.isArray(b?.days) ? b.days : []), ...k])].sort();
};
const st = (r: { status: number; json: any }) => `${r.status}${r.status >= 300 ? " " + String(typeof r.json?.error === "string" ? r.json.error : JSON.stringify(r.json?.error ?? "")).slice(0, 70) : ""}`;
const ok = (r: { status: number }) => r.status >= 200 && r.status < 300;
const POLICY_IDS = DEFAULT_POLICIES.map((p) => p.id);

interface Rules { allowDateChanges: boolean; amendNoticeHours: number; amendLimit: number; amendFee: number; amendSelfService: boolean; amendAllowCheaper: boolean }
type St = { ready?: boolean; rules: Rules; policyOf: Record<string, string>; firstSeen: Record<string, string> };
const S = (c: ActionCtx): St => ((c.world as any).__pa ??= { rules: { allowDateChanges: true, amendNoticeHours: 0, amendLimit: 0, amendFee: 0, amendSelfService: false, amendAllowCheaper: true }, policyOf: {}, firstSeen: {} } as St);

function flag(c: ActionCtx, rule: string, severity: "money" | "state", ref: string, message: string) {
  const w = c.world as any;
  (w.__violations ??= []).push({ rule, severity, message, refs: [ref] });
}

async function putRules(c: ActionCtx, rules: Rules): Promise<{ status: number; json: any }> {
  const w = W(c);
  const lib = (await w.api("GET", "/api/library")).json ?? {};
  const settings = { ...(lib.settings ?? {}), cancellationPolicies: DEFAULT_POLICIES, ...rules };
  return w.api("PUT", "/api/library", { settings });
}
const randomRules = (c: ActionCtx): Rules => {
  const r = c.rng;
  return {
    allowDateChanges: r() < 0.85,
    amendNoticeHours: pick(r, [0, 0, 24, 72, 168]),
    amendLimit: pick(r, [0, 0, 1, 2]),
    amendFee: pick(r, [0, 0, 2.5, 5]),
    amendSelfService: r() < 0.5,
    amendAllowCheaper: r() < 0.8,
  };
};

async function ensure(c: ActionCtx) {
  const s = S(c);
  if (s.ready) return;
  s.ready = true;
  const w = W(c);
  s.rules = randomRules(c);
  const res = await putRules(c, s.rules);
  if (!ok(res)) s.rules = { allowDateChanges: true, amendNoticeHours: 0, amendLimit: 0, amendFee: 0, amendSelfService: false, amendAllowCheaper: true }; // settings refused: fall back to what the stored defaults mean
  for (const l of w.listings) {
    const id = pick(c.rng, POLICY_IDS);
    const r = await w.api("PUT", `/api/listings/${l.id}`, { cancellationPolicyId: id });
    if (ok(r)) s.policyOf[l.id] = id;
  }
}

const policyFor = (c: ActionCtx, listingId: string): NamedPolicy => DEFAULT_POLICIES.find((p) => p.id === (S(c).policyOf[listingId] ?? "standard")) ?? DEFAULT_POLICIES[0];
const noteFirst = (c: ActionCtx, b: any) => { const f = days(b)[0]; const s = S(c); if (f && (!s.firstSeen[b.ref] || f < s.firstSeen[b.ref])) s.firstSeen[b.ref] = f; };
const refetch = async (c: ActionCtx, ref: string) => (await W(c).bookings()).find((b) => b.ref === ref);
const markPaid = async (c: ActionCtx, b: any) => { if (/^(paid|funded)$/i.test(b.pay ?? "") || !(b.amount > 0)) return; await W(c).api("POST", `/api/bookings/${encodeURIComponent(b.ref)}/actions`, { type: "paid" }); };

/** Candidates for a policy/amend scenario: confirmed, priced, untouched by a cancellation or a date request in flight. */
const candidates = async (c: ActionCtx) =>
  (await W(c).bookings()).filter((b) => b.status === "Confirmed" && b.amount > 0 && !b.cancel && b.dateChangeRequest?.status !== "pending" && days(b).length >= 1 && !(b.kids ?? []).some((k: any) => k.cancelled));

/** The provider's amend rules as STORED right now. Fuzz processes started by other agents can lease the same throwaway provider (leases are per process) and
 *  overwrite its Setup; when the stored rules differ from what this seed set, adopt them and say so instead of blaming the product. */
async function rulesStillHold(c: ActionCtx): Promise<boolean> {
  const s = S(c); const w = W(c);
  const st0 = ((await w.api("GET", "/api/library")).json?.settings ?? {}) as Record<string, unknown>;
  const stored: Rules = {
    allowDateChanges: st0.allowDateChanges !== false, amendNoticeHours: Number(st0.amendNoticeHours) || 0, amendLimit: Number(st0.amendLimit) || 0,
    amendFee: Number(st0.amendFee) || 0, amendSelfService: st0.amendSelfService !== false, amendAllowCheaper: st0.amendAllowCheaper !== false,
  };
  if (JSON.stringify(stored) === JSON.stringify(s.rules)) return true;
  w.warnings.push(`provider settings changed under this seed (another fuzz process shares the provider): ${JSON.stringify(s.rules)} -> ${JSON.stringify(stored)}`);
  s.rules = stored;
  return false;
}

/** Try a parent move and check the amend rules decided it correctly. Returns what happened. */
async function tryAmend(c: ActionCtx, t: any, from: string, to: string): Promise<{ r: { status: number; json: any }; text: string }> {
  const w = W(c); const s = S(c);
  const before = Date.now();
  const preFee = Number(t.amendFeesCharged) || 0;
  const rawMoves = [{ from, to }];
  const r = await w.api("POST", `/api/my/bookings/${encodeURIComponent(t.ref)}/amend?tenantId=${w.op.tenantId}`, { moves: rawMoves }, w.parentOf(t.email) ?? "p0");
  const after = Date.now();
  const rules = s.rules;
  const approved = Number(t.amendMovesApproved) || 0;
  const illegalNow = !rules.allowDateChanges || !!amendNoticeError(rawMoves, rules.amendNoticeHours, before) || !!amendLimitError(rawMoves, approved, rules.amendLimit);
  const legalLater = rules.allowDateChanges && !amendNoticeError(rawMoves, rules.amendNoticeHours, after) && !amendLimitError(rawMoves, approved, rules.amendLimit);
  const msg = String(r.json?.error ?? "");
  if (((ok(r) && illegalNow) || (!ok(r) && legalLater && /too close|date changes? per booking|already had its|doesn't offer date changes/i.test(msg))) && !(await rulesStillHold(c))) return { r, text: `move ${from}->${to}: ${st(r)} (rules changed by another process, not judged)` };
  if (ok(r) && illegalNow) flag(c, "pa-amend-illegal-accepted", "state", t.ref, `${t.ref}: move ${from}->${to} was accepted (${r.status}) but the provider's rules forbid it (changes ${rules.allowDateChanges ? "on" : "off"}, notice ${rules.amendNoticeHours}h, limit ${rules.amendLimit}, ${approved} used)`);
  if (!ok(r) && legalLater && /too close|date changes? per booking|already had its|doesn't offer date changes/i.test(msg)) flag(c, "pa-amend-legal-refused", "state", t.ref, `${t.ref}: move ${from}->${to} refused ("${msg.slice(0, 80)}") although notice ${rules.amendNoticeHours}h / limit ${rules.amendLimit} / ${approved} used allow it`);
  if (ok(r)) {
    const doc = await refetch(c, t.ref);
    if (doc && (await rulesStillHold(c))) {
      const applied = r.json?.amendApplied === true;
      if (applied && !rules.amendSelfService) flag(c, "pa-amend-selfservice-off", "state", t.ref, `${t.ref}: move applied at once although self-service date changes are off`);
      if (applied && !days(doc).includes(to)) flag(c, "pa-amend-applied-no-day", "state", t.ref, `${t.ref}: move reported applied but ${to} is not on the booking (${days(doc).join(",")})`);
      if (!applied && doc.dateChangeRequest?.status !== "pending") flag(c, "pa-amend-pending-lost", "state", t.ref, `${t.ref}: move accepted for approval but no pending request is stored (${doc.dateChangeRequest?.status ?? "none"})`);
      const dFee = (Number(doc.amendFeesCharged) || 0) - preFee;
      if (applied && rules.amendFee > 0 && Math.abs(dFee - rules.amendFee) > 0.01 && !(Number(t.amountPaid) === 0 && !(t.amount > 0))) flag(c, "pa-amend-fee", "money", t.ref, `${t.ref}: self-service move should add the £${rules.amendFee} admin fee once, booking recorded £${dFee.toFixed(2)}`);
      if (applied && rules.amendFee === 0 && dFee > 0.004) flag(c, "pa-amend-fee", "money", t.ref, `${t.ref}: admin fee £${dFee.toFixed(2)} charged although none is set`);
    }
  }
  return { r, text: `move ${from}->${to}: ${st(r)}` };
}

/** Approve/deny a pending request and check the booking ended up where the decision says. */
async function decide(c: ActionCtx, t: any, approve: boolean): Promise<string> {
  const w = W(c); const s = S(c);
  const pre = await refetch(c, t.ref);
  if (!pre?.dateChangeRequest || pre.dateChangeRequest.status !== "pending") return "no pending request";
  noteFirst(c, pre);
  const moves = (pre.dateChangeRequest.moves ?? []) as { from: string; to: string }[];
  const r = await w.api("POST", `/api/bookings/${encodeURIComponent(t.ref)}/actions`, approve ? { type: "move-approve" } : { type: "move-deny", reason: "fuzz" });
  if (!ok(r)) return st(r);
  const post = await refetch(c, t.ref);
  if (!post) return "gone";
  if (approve) {
    const want = moves.filter((m) => m.from && m.to);
    if (want.length && !want.every((m) => days(post).includes(m.to))) flag(c, "pa-amend-approve-days", "state", t.ref, `${t.ref}: approved move(s) ${want.map((m) => m.from + "->" + m.to).join(",")} but days are now ${days(post).join(",")}`);
    const used = (Number(post.amendMovesApproved) || 0) - (Number(pre.amendMovesApproved) || 0);
    if (want.length && used !== want.length) flag(c, "pa-amend-approve-count", "state", t.ref, `${t.ref}: approved ${want.length} move(s) but the booking counts ${used}`);
    const fee = (Number(post.amendFeesCharged) || 0) - (Number(pre.amendFeesCharged) || 0);
    if (s.rules.amendFee === 0 && fee > 0.004) flag(c, "pa-amend-fee", "money", t.ref, `${t.ref}: approval added £${fee.toFixed(2)} admin fee although none is set`);
    if (want.length && post.origFirstDate && s.firstSeen[t.ref] && post.origFirstDate > s.firstSeen[t.ref]) flag(c, "pa-amend-orig-date", "money", t.ref, `${t.ref}: original first date ${post.origFirstDate} is later than the first date we saw before moving (${s.firstSeen[t.ref]})`);
  } else if (days(post).join() !== days(pre).join()) flag(c, "pa-amend-deny-moved", "state", t.ref, `${t.ref}: move denied but days changed ${days(pre).join(",")} -> ${days(post).join(",")}`);
  return `${approve ? "approve" : "deny"} ${st(r)}`;
}

/** Whole-booking parent cancel, checked against the policy oracle. `moveExempt`: a move was involved, so only "too generous" is judged. */
async function cancelWithOracle(c: ActionCtx, ref: string): Promise<string> {
  const w = W(c); const s = S(c);
  const pre = await refetch(c, ref);
  if (!pre) return "gone";
  await markPaid(c, pre);
  const paidDoc = (await refetch(c, ref)) ?? pre;
  noteFirst(c, paidDoc);
  const paid = refundableSoFar(paidDoc as never);
  const policy = policyFor(c, paidDoc.listingId);
  const seenFirst = s.firstSeen[ref];
  const curFirst = days(paidDoc)[0];
  const moved = !!paidDoc.origFirstDate || !!paidDoc.dateChangeRequest || (Number(paidDoc.amendMovesApproved) || 0) > 0;
  const expectAt = (nowIso: string) => refundFor(policy, effectiveRefundDate(seenFirst, curFirst), paid, nowIso, "parent")?.amount;
  const t0 = new Date().toISOString();
  const r = await w.api("POST", `/api/my/bookings/${encodeURIComponent(ref)}/cancel?tenantId=${w.op.tenantId}`, { msg: "fuzz policy cancel", refundPref: "card" }, w.parentOf(paidDoc.email) ?? "p0");
  const t1 = new Date().toISOString();
  if (!ok(r)) return `cancel ${st(r)}`;
  const doc = await refetch(c, ref);
  if (!doc?.cancel) return "cancel recorded nothing";
  const eBefore = expectAt(t0), eAfter = expectAt(t1);
  if (eBefore === undefined || eAfter === undefined) return `cancelled (no oracle: ${policy.id})`;
  const actual = Number(doc.cancel.amount) || 0;
  const label = `${ref}: policy ${policy.id}, paid £${paid}, first day ${curFirst}${seenFirst && seenFirst !== curFirst ? ` (was ${seenFirst})` : ""}`;
  if (actual > eBefore + 0.01) flag(c, "pa-refund-too-generous", "money", ref, `${label}: cancellation asks for a £${actual} refund but the policy allows at most £${eBefore}`);
  else if (!moved && actual < eAfter - 0.01) flag(c, "pa-refund-too-stingy", "money", ref, `${label}: cancellation recorded a £${actual} refund but the policy gives £${eAfter}`);
  if (policy.id === "none" && actual > 0.004) flag(c, "pa-refund-no-refunds", "money", ref, `${label}: "No refunds" policy but a £${actual} refund was proposed`);
  return `cancel ${policy.id} paid £${paid} -> proposed £${actual} (oracle £${eAfter}..£${eBefore})`;
}

const ACTIONS_PA: ActionDef[] = [
  // This area runs on its own, so it makes the bookings it then cancels and moves (1-3 days, one child, so the money is easy to reason about).
  { id: "pa-book", area: "policies-amend", weight: 16, applicable: () => true,
    async run(c) {
      await ensure(c);
      const w = W(c);
      const l = pick(w.rng, w.listings); const b = pick(w.rng, l.blocks); const p = pick(w.rng, w.parents); const kid = pick(w.rng, p.children.filter((k) => k.age <= 11));
      const pass = pick(w.rng, l.passes.slice(0, 2));
      const dates = [...b.dates].sort(() => w.rng() - 0.5).slice(0, Math.min(pass.days, b.dates.length)).sort();
      const method = pick(w.rng, ["Bank transfer", "Cash on the day"]);
      const r = await w.api("POST", "/api/my/bookings", { listingId: l.id, blockId: b.id, method, items: [{ pass: pass.name, child: kid.name, childId: kid.id, dates }] }, p.key);
      (c.world as any).__hasBookings = true;
      return { summary: `${p.key} books ${l.kind}/${pass.name} ${dates.length}d ${method}: ${st(r)}` };
    } },

  { id: "pa-op-approve", area: "policies-amend", weight: 5, applicable: hasRows,
    async run(c) {
      const w = W(c);
      const t = (await w.bookings()).find((b) => b.status === "Approval needed");
      if (!t) return { summary: "approve: nothing waiting" };
      const r = await w.api("POST", `/api/bookings/${encodeURIComponent(t.ref)}/actions`, { type: "approve" });
      return { summary: `operator approves ${t.ref}: ${st(r)}` };
    } },

  { id: "pa-set-listing-policy", area: "policies-amend", weight: 3, applicable: () => true,
    async run(c) {
      await ensure(c);
      const w = W(c); const l = pick(w.rng, w.listings); const id = pick(w.rng, POLICY_IDS);
      const r = await w.api("PUT", `/api/listings/${l.id}`, { cancellationPolicyId: id });
      if (ok(r)) S(c).policyOf[l.id] = id;
      return { summary: `listing ${l.kind} -> policy ${id}: ${st(r)}` };
    } },

  { id: "pa-set-amend-rules", area: "policies-amend", weight: 2, applicable: () => true,
    async run(c) {
      await ensure(c);
      const next = randomRules(c);
      const r = await putRules(c, next);
      if (ok(r)) S(c).rules = next;
      return { summary: `amend rules ${JSON.stringify(next)}: ${st(r)}` };
    } },

  { id: "pa-parent-amend", area: "policies-amend", weight: 10, applicable: hasRows,
    async run(c) {
      await ensure(c);
      const w = W(c); const list = await candidates(c);
      if (!list.length) return { summary: "amend: nothing movable" };
      const t = pick(w.rng, list); noteFirst(c, t);
      const l = w.listings.find((x) => x.id === t.listingId); const blk = l?.blocks.find((x) => x.id === t.blockId);
      const free = (blk?.dates ?? []).filter((d) => !days(t).includes(d));
      if (!free.length) return { summary: `amend ${t.ref}: no free day` };
      const out = await tryAmend(c, t, pick(w.rng, days(t)), pick(w.rng, free));
      return { summary: `parent ${t.ref} ${out.text}` };
    } },

  { id: "pa-op-move-decision", area: "policies-amend", weight: 5, applicable: hasRows,
    async run(c) {
      await ensure(c);
      const t = (await W(c).bookings()).find((b) => b.dateChangeRequest?.status === "pending");
      if (!t) return { summary: "move-decision: no pending request" };
      const out = await decide(c, t, W(c).rng() < 0.75);
      return { summary: `operator ${t.ref} ${out}` };
    } },

  // Cancel a booking and compare the proposed refund with the policy the listing is on.
  { id: "pa-parent-cancel-policy", area: "policies-amend", weight: 9, applicable: hasRows,
    async run(c) {
      await ensure(c);
      const list = await candidates(c);
      if (!list.length) return { summary: "policy-cancel: nothing to cancel" };
      const t = pick(W(c).rng, list);
      return { summary: `parent ${t.ref} ${await cancelWithOracle(c, t.ref)}` };
    } },

  // The refund loophole: move the first day LATER, then cancel. The refund must be judged on the earlier original date.
  { id: "pa-move-later-then-cancel", area: "policies-amend", weight: 7, applicable: hasRows,
    async run(c) {
      await ensure(c);
      const w = W(c); const list = await candidates(c);
      if (!list.length) return { summary: "move-then-cancel: nothing movable" };
      const t = pick(w.rng, list); noteFirst(c, t);
      const l = w.listings.find((x) => x.id === t.listingId); const blk = l?.blocks.find((x) => x.id === t.blockId);
      const first = days(t)[0];
      const later = (blk?.dates ?? []).filter((d) => d > first && !days(t).includes(d));
      if (!later.length) return { summary: `move-then-cancel ${t.ref}: no later free day` };
      const to = later[later.length - 1];
      const m = await tryAmend(c, t, first, to);
      let dec = "";
      if (ok(m.r) && m.r.json?.amendApplied !== true) dec = ` ${await decide(c, t, true)};`;
      return { summary: `parent ${t.ref} ${m.text};${dec} then ${await cancelWithOracle(c, t.ref)}` };
    } },

  // Provider-initiated cancel: the family did nothing wrong, so "full" must propose the whole paid amount whatever the notice.
  { id: "pa-op-cancel-override", area: "policies-amend", weight: 4, applicable: hasRows,
    async run(c) {
      await ensure(c);
      const w = W(c); const list = await candidates(c);
      if (!list.length) return { summary: "op-cancel: nothing to cancel" };
      const t = pick(w.rng, list);
      await markPaid(c, t);
      const paid = refundableSoFar(((await refetch(c, t.ref)) ?? t) as never);
      const refund = pick(w.rng, ["full", "none"] as const);
      const r = await w.api("POST", `/api/bookings/${encodeURIComponent(t.ref)}/actions`, { type: "cancel", refund, reason: "fuzz provider cancel" });
      if (!ok(r)) return { summary: `operator cancel ${t.ref} ${refund}: ${st(r)}` };
      const doc = await refetch(c, t.ref);
      const amt = Number(doc?.cancel?.amount) || 0;
      if (refund === "full" && paid > 0 && doc?.cancel && amt < paid - 0.01 && doc.cancel.refund !== "full") flag(c, "pa-provider-cancel-full", "money", t.ref, `${t.ref}: provider cancelled with a FULL refund but the booking proposes £${amt} of £${paid} (${doc.cancel.refund})`);
      if (refund === "none" && amt > 0.004) flag(c, "pa-provider-cancel-none", "money", t.ref, `${t.ref}: provider cancelled with NO refund but £${amt} is proposed`);
      return { summary: `operator cancels ${t.ref} refund=${refund} paid £${paid} -> £${amt}` };
    } },

  // Approve / decline a pending refund and check the money actually moved (or not) by the proposed amount.
  { id: "pa-op-refund-decision", area: "policies-amend", weight: 6, applicable: hasRows,
    async run(c) {
      await ensure(c);
      const w = W(c);
      const t = (await w.bookings()).find((b) => /refund pending/i.test(b.pay ?? "") && b.cancel && b.cancel.refund !== "approved");
      if (!t) return { summary: "refund-decision: nothing pending" };
      const type = w.rng() < 0.75 ? "refund-approve" : "refund-decline";
      const before = refundedGross(t as never);
      const owed = Math.min(Number(t.cancel?.amount) || 0, refundableSoFar(t as never));
      const r = await w.api("POST", `/api/bookings/${encodeURIComponent(t.ref)}/actions`, { type });
      if (!ok(r)) return { summary: `operator ${type} ${t.ref}: ${st(r)}` };
      const post = await refetch(c, t.ref);
      if (post) {
        const moved = refundedGross(post as never) - before;
        if (type === "refund-decline" && moved > 0.01) flag(c, "pa-refund-declined-paid", "money", t.ref, `${t.ref}: refund declined but £${moved.toFixed(2)} was refunded`);
        if (type === "refund-approve" && t.cancel?.refundTo !== "wallet" && owed > 0.01 && moved < owed - 0.01) flag(c, "pa-refund-approved-short", "money", t.ref, `${t.ref}: refund of £${owed} approved but the booking records £${moved.toFixed(2)} refunded`);
        if (type === "refund-approve" && moved > owed + 0.01) flag(c, "pa-refund-approved-over", "money", t.ref, `${t.ref}: refund approved for £${owed} but £${moved.toFixed(2)} was refunded`);
      }
      return { summary: `operator ${type} ${t.ref} (£${owed}): ${st(r)}` };
    } },

  // Release some days of a multi-day booking for a refund: the pending refund may never exceed those days' share of what was paid.
  { id: "pa-parent-release-days", area: "policies-amend", weight: 5, applicable: hasRows,
    async run(c) {
      await ensure(c);
      const w = W(c);
      const list = (await candidates(c)).filter((b) => (b.days ?? []).length >= 2 && !(b.kids ?? []).length);
      if (!list.length) return { summary: "release-days: nothing with 2+ days" };
      const t = pick(w.rng, list);
      await markPaid(c, t);
      const paidDoc = (await refetch(c, t.ref)) ?? t;
      const paid = refundableSoFar(paidDoc as never);
      const all = days(paidDoc);
      const some = [...all].sort(() => w.rng() - 0.5).slice(0, randInt(w.rng, 1, all.length - 1));
      const r = await w.api("POST", `/api/my/bookings/${encodeURIComponent(t.ref)}/cancel?tenantId=${w.op.tenantId}`, { resolution: "refund", days: some }, w.parentOf(t.email) ?? "p0");
      if (!ok(r)) return { summary: `parent releases ${some.length}/${all.length} day(s) of ${t.ref}: ${st(r)}` };
      const doc = await refetch(c, t.ref);
      const share = (paid * some.length) / all.length;
      const amt = doc?.cancel?.refundOnly ? Number(doc.cancel.amount) || 0 : 0;
      if (amt > share + 0.01) flag(c, "pa-release-over-share", "money", t.ref, `${t.ref}: released ${some.length} of ${all.length} days (share £${share.toFixed(2)} of £${paid}) but a £${amt} refund is pending`);
      return { summary: `parent releases ${some.length}/${all.length} day(s) of ${t.ref}: pending £${amt} (share £${share.toFixed(2)})` };
    } },
];

// --verbose prints each step's outcome, so a clean run still shows the scenarios really happened.
export const ACTIONS: ActionDef[] = ACTIONS_PA.map((a) => ({ ...a, async run(c: ActionCtx) { const out = await a.run(c); c.log(`${a.id}: ${out.summary}`); return out; } }));
