import type { AddonRequest, AddonRequestTarget } from "./types";
import { parseAddonLabel } from "./addons";
import { requestTargets } from "./addonRequests";

// The plain sentences about a family's request to change or cancel an extra. ONE place builds them, so the provider's bell, the family's bell, the
// two screens and the emails all say the same thing. Every builder returns KEYS + DATA (never a finished English string): the bell stores them next to
// the English text and the viewer's browser renders them in their own language (p7shell.xr* in the message files). Pure: no database, no clock.
//
// Data rules:  a CHANGE reads "from <old choice> to <new choice>" using the choice names (size: xl -> m), per extra, never the raw label
//   "tshirty × 1 (size: xl)"; quantity only when it changed.   A CANCEL names the extra, the child and the day(s).   Money only where it matters.
//   Dates travel as ISO in vars named `date*` and are written in the viewer's language when shown (see renderFull).

export type Vars = Record<string, string>;
export interface Msg { key: string; vars: Vars }
/** A title, the main sentence, and extra sentences that follow it (each its own key so each translates whole). */
export interface Wording { title: Msg; body: Msg; more: Msg[] }
export type Tr = (key: string, vars?: Record<string, string | number>) => string;

const P = "p7shell.xr";
const m = (k: string, vars: Vars = {}): Msg => ({ key: `${P}${k}`, vars });

/** Vars whose name starts with "date" hold an ISO day; `fmt` writes it for the reader (English: "Wed 1 Sep"). */
export function renderVars(vars: Vars | undefined, fmt: (iso: string) => string): Record<string, string> {
  return Object.fromEntries(Object.entries(vars ?? {}).map(([k, v]) => [k, /^date/.test(k) && /^\d{4}-\d{2}-\d{2}/.test(v) ? fmt(v) : v]));
}

/** English day for stored text ("Wed 1 Sep"), the same on every machine (the ICU month names differ: "Sept"). */
const EN_DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const EN_MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function enDay(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : `${EN_DAY[d.getUTCDay()]} ${d.getUTCDate()} ${EN_MON[d.getUTCMonth()]}`;
}

/** £10.00 */
export const gbpText = (n: number): string => `£${(Math.round((Number(n) || 0) * 100) / 100).toFixed(2)}`;

/** A booking title the provider typed in capitals ("HOME VISIT FITNESS LESSON") reads as a sentence: "Home visit fitness lesson". Mixed case is left alone. */
export function plainTitle(s: string | undefined | null): string {
  const t = (s ?? "").trim();
  if (t.length < 4 || /[a-z]/.test(t) || !/[A-Z]/.test(t)) return t;
  const low = t.toLowerCase();
  return low.charAt(0).toUpperCase() + low.slice(1);
}

// ---- the facts of a request -----------------------------------------------------------------------------------------------------------------------

export interface Delta { q: string; from: string; to: string }
const answersOf = (label: string): Record<string, string> => Object.fromEntries(parseAddonLabel(label).answers.map((a) => [a.label, a.value]));

/** The choices a CHANGE swaps, per question: size xl -> m. The old choices come from `from` (new requests) or the label the request was made on. */
export function changeDeltas(r: Pick<AddonRequest, "label" | "to" | "toLabel"> & { from?: Record<string, string> }): Delta[] {
  const was = r.from ?? answersOf(r.label);
  const now = r.to ?? answersOf(r.toLabel ?? "");
  return Object.keys(now).filter((q) => (was[q] ?? "") !== (now[q] ?? "")).map((q) => ({ q, from: was[q] ?? "", to: now[q] ?? "" }));
}
/** [was, now] when the quantity changed, else null (a size/colour change keeps it). */
export function qtyChange(r: Pick<AddonRequest, "label" | "toLabel">): [number, number] | null {
  if (!r.toLabel) return null;
  const a = parseAddonLabel(r.label).qty, b = parseAddonLabel(r.toLabel).qty;
  return a !== b ? [a, b] : null;
}

const fullName = (child: string | undefined) => (child ?? "").trim() || "Child";
const extraName = (r: Pick<AddonRequest, "label"> & { name?: string }) => (r.name ?? parseAddonLabel(r.label).name).trim() || r.label;
const targetName = (t: AddonRequestTarget) => (t.name ?? parseAddonLabel(t.label).name).trim() || t.label;
/** The dates a cancel target is about: its listed days, else the one date of a whole one-off extra. */
const targetDates = (t: AddonRequestTarget & { when?: string[] }): string[] => (t.days?.length ? t.days : t.when ?? []);

/** Who asked: every child named once, in the order they appear ("Child B", "Child B, Child C"). */
export function whoText(r: Pick<AddonRequest, "key" | "child" | "label" | "price" | "targets">): string {
  const names = requestTargets(r).map((t) => fullName(t.child));
  return [...new Set(names)].join(", ");
}

/** The name the title uses: the extra's name, or "3 extras" when one request covers several. */
function nameMsgVars(r: Pick<AddonRequest, "kind" | "key" | "child" | "label" | "price" | "targets">): { name: string; many: boolean; n: number } {
  const ts = requestTargets(r);
  if (r.kind === "cancel" && ts.length > 1) return { name: "", many: true, n: ts.length };
  return { name: r.kind === "cancel" ? targetName(ts[0]) : extraName(r), many: false, n: 1 };
}

// A change fragment is itself a translated sentence, so a stored bell keeps it as DATA too: `changes` is filled in when shown (renderFull).
// To keep the stored shape flat (strings only) each fragment is stored as `c1q`,`c1from`,`c1to`... and joined here with "; ".
const MAX_PARTS = 4;
function packDeltas(r: Parameters<typeof changeDeltas>[0]): Vars {
  const deltas = changeDeltas(r), qty = qtyChange(r);
  const v: Vars = {};
  deltas.slice(0, MAX_PARTS).forEach((d, i) => { v[`c${i + 1}q`] = d.q; v[`c${i + 1}from`] = d.from; v[`c${i + 1}to`] = d.to; });
  if (qty) { v.qtyA = String(qty[0]); v.qtyB = String(qty[1]); }
  return v;
}
/** Joins the packed fragments for the given shape. */
export function expandChanges(t: Tr, vars: Vars, shape: "to" | "from" | "arrow"): string {
  const key = shape === "to" ? "PartTo" : shape === "from" ? "PartFrom" : "PartArrow";
  const parts: string[] = [];
  for (let i = 1; i <= MAX_PARTS; i++) if (vars[`c${i}q`] !== undefined) parts.push(t(`${P}${key}`, { q: vars[`c${i}q`], from: vars[`c${i}from`], to: vars[`c${i}to`] }));
  if (vars.qtyA !== undefined) parts.push(t(`${P}PartQty`, { a: vars.qtyA, b: vars.qtyB }));
  return parts.join("; ");
}

/** Which fragment shape a sentence key uses, so a stored message can be rebuilt in any language. */
const SHAPE: Record<string, "to" | "from" | "arrow"> = {
  [`${P}ReqChange`]: "to", [`${P}BOkChange`]: "from", [`${P}PendChange`]: "arrow", [`${P}DoneChange`]: "from",
};

/** Full render of one message, expanding `changes` from the packed fragments where its sentence has them. */
export function renderFull(t: Tr, msg: Msg, fmt: (iso: string) => string = enDay): string {
  const shape = SHAPE[msg.key];
  const vars = renderVars(msg.vars, fmt);
  if (shape) vars.changes = expandChanges(t, msg.vars, shape);
  return t(msg.key, vars);
}
export const renderWordingBody = (t: Tr, w: Wording, fmt: (iso: string) => string = enDay): string => [w.body, ...w.more].map((x) => renderFull(t, x, fmt)).join(" ");
export const renderWordingTitle = (t: Tr, w: Wording, fmt: (iso: string) => string = enDay): string => renderFull(t, w.title, fmt);

// ---- the provider's bell / panel / email: a NEW request -------------------------------------------------------------------------------------------

interface RequestLike extends Pick<AddonRequest, "kind" | "key" | "child" | "label" | "price" | "targets"> { to?: Record<string, string>; toLabel?: string; from?: Record<string, string> }

/** The cancel sentence for a request: one extra (with its day or number of days), or several. Returns the key suffix and the vars. */
function cancelShape(r: RequestLike): { suffix: "" | "On" | "Days" | "Many"; vars: Vars } {
  const ts = requestTargets(r);
  if (ts.length > 1) return { suffix: "Many", vars: { n: String(ts.length) } };
  const t = ts[0];
  const dates = targetDates(t);
  if (dates.length === 1) return { suffix: "On", vars: { name: targetName(t), date: dates[0] } };
  if (dates.length > 1) return { suffix: "Days", vars: { name: targetName(t), n: String(dates.length) } };
  return { suffix: "", vars: { name: targetName(t) } };
}

/**
 * The provider's wording for a request that has just been sent. `refundable` is what the family has actually paid towards this (so a refund is
 * possible): money is mentioned for a CANCEL only, and only when something is paid; a size / colour change never shows a price.
 */
export function newRequestWording(r: RequestLike, ctx: { ref: string; refundable?: number }): Wording {
  const who = whoText(r);
  if (r.kind === "change") {
    const nm = extraName(r);
    return {
      title: m("TReqChange", { name: nm }),
      body: m("ReqChange", { who, name: nm, ref: ctx.ref, ...packDeltas(r) }),
      more: [m("Approve")],
    };
  }
  const { suffix, vars } = cancelShape(r);
  const nv = nameMsgVars(r);
  const refundable = Math.min(r.price ?? 0, ctx.refundable ?? 0);
  const more: Msg[] = [];
  if (refundable > 0.004) more.push(m("CanRefund", { amt: gbpText(refundable) }));
  more.push(m("Approve"));
  return {
    title: nv.many ? m("TReqCancelMany", { n: String(nv.n) }) : m("TReqCancel", { name: nv.name }),
    body: m(`ReqCancel${suffix}`, { who, ref: ctx.ref, ...vars }),
    more,
  };
}

/** The provider is told the family took the request back. */
export function withdrawnWording(r: RequestLike, ctx: { ref: string }): Wording {
  const who = whoText(r);
  const nv = nameMsgVars(r);
  const nm = nv.many ? `${nv.n}` : nv.name;
  return {
    title: nv.many ? m("TWdMany", { n: String(nv.n) }) : m("TWd", { name: nv.name }),
    body: nv.many ? m("WdCancelMany", { who, n: String(nv.n), ref: ctx.ref })
      : r.kind === "change" ? m("WdChange", { who, name: nm, ref: ctx.ref }) : m("WdCancel", { who, name: nm, ref: ctx.ref }),
    more: [],
  };
}

// ---- the family's bell / email: the provider's ANSWER ---------------------------------------------------------------------------------------------

type Decided = RequestLike & Pick<AddonRequest, "status" | "declineReason" | "money">;

/** What the family hears when the provider answers. The money sentence follows the REAL outcome (wallet / refund / nothing / difference to pay). */
export function decisionWording(r: Decided, ctx: { ref: string; listing: string }): Wording {
  const listing = plainTitle(ctx.listing);
  const base = { listing, ref: ctx.ref };
  const approved = r.status === "approved";
  if (r.kind === "change") {
    const nm = extraName(r);
    const more: Msg[] = [];
    if (approved) {
      if (r.money?.resolution === "charge" && r.money.amount > 0) more.push(m("MCharge", { amt: gbpText(r.money.amount) }));
      else if ((r.money?.resolution === "wallet" || r.money?.resolution === "refund") && r.money.amount > 0) more.push(m(r.money.resolution === "wallet" ? "MWallet" : "MRefund", { amt: gbpText(r.money.amount) }));
    } else if (r.declineReason?.trim()) more.push(m("Reason", { reason: r.declineReason.trim() }));
    return approved
      ? { title: m("TOkChange", { name: nm }), body: m("BOkChange", { who: whoText(r), name: nm, ...base, ...packDeltas(r) }), more }
      : { title: m("TNoChange", { name: nm }), body: m("BNoChange", { name: nm, ...base }), more };
  }
  const { suffix, vars } = cancelShape(r);
  const nv = nameMsgVars(r);
  const more: Msg[] = [];
  if (approved) {
    const mo = r.money;
    if (mo && mo.amount > 0 && (mo.resolution === "wallet" || mo.resolution === "refund")) more.push(m(mo.resolution === "wallet" ? "MWallet" : "MRefund", { amt: gbpText(mo.amount) }));
    else more.push(m("MNone"));
  } else if (r.declineReason?.trim()) more.push(m("Reason", { reason: r.declineReason.trim() }));
  return approved
    ? { title: nv.many ? m("TOkCancelMany", { n: String(nv.n) }) : m("TOkCancel", { name: nv.name }), body: m(`BOkCancel${suffix}`, { ...base, ...vars }), more }
    : { title: nv.many ? m("TNoCancelMany", { n: String(nv.n) }) : m("TNoCancel", { name: nv.name }), body: m(nv.many ? "BNoCancelMany" : "BNoCancel", { ...base, ...(nv.many ? { n: String(nv.n) } : { name: nv.name }) }), more };
}

// ---- the family's screen ---------------------------------------------------------------------------------------------------------------------------

/** "Change or cancel your tshirty", or "...your extras" when there are several (or none named). */
export function headingMsg(names: string[]): Msg {
  const uniq = [...new Set(names.map((x) => x.trim()).filter(Boolean))];
  return uniq.length === 1 ? m("HeadOne", { name: uniq[0] }) : m("HeadMany");
}
/** The one-line status of a pending request on the family's screen. */
export function pendingLineMsg(r: RequestLike, provider: string): Msg {
  if (r.kind === "change") return m("PendChange", { name: extraName(r), provider, ...packDeltas(r) });
  const ts = requestTargets(r);
  return m("PendCancel", { name: ts.length > 1 ? ts.map(targetName).join(", ") : targetName(ts[0]), provider });
}
/** What a decided request left behind, as a line in the family's screen: "Changed from size xl to size m". */
export function doneLineMsg(r: Decided): Msg {
  if (r.status === "approved") return r.kind === "change" ? m("DoneChange", packDeltas(r)) : m("DoneCancel");
  return m("DoneNo");
}
/** The name an extra goes by in a sentence (a request, a line). */
export const extraNameOf = (r: Pick<AddonRequest, "kind" | "key" | "child" | "label" | "price" | "targets">): string => {
  const nv = nameMsgVars(r);
  return nv.many ? "" : nv.name;
};
export { m as xrMsg };
