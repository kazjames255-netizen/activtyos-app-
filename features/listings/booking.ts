"use client";

// ─────────────────────────────────────────────────────────────────────────
// The booking engine — the state behind picking dates, filling a basket,
// putting children on passes and pricing the result. Shared by the operator's
// preview and the parent's storefront, so the two can't drift: whatever the
// operator sees when they preview a listing is what a parent gets.
//
// Types come from ListingWizard as type-only imports (erased at build), so
// this module can be pulled in from anywhere without a runtime cycle.
// ─────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { applyDiscounts } from "./discounts";
import { blockOn, lowAt } from "./capacity";
import { money } from "@/features/bookings/helpers";
import { mondayOf, ordinal, uid } from "./format";
import type { BlockBooking, BookRule, RunBlock, WizardDraft } from "./ListingWizard";
import type { ChildProfile } from "./checkout";

export function useOpensAt(opensAt?: string) {
  const at = opensAt ?? "";
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!at) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [at]);
  const openMs = at ? new Date(at).getTime() : 0;
  const locked = !!at && !Number.isNaN(openMs) && now < openMs;
  const countdown = (() => {
    if (!locked) return "";
    let s2 = Math.max(0, Math.floor((openMs - now) / 1000));
    const dd = Math.floor(s2 / 86400); s2 -= dd * 86400;
    const hh = Math.floor(s2 / 3600); s2 -= hh * 3600;
    const mm = Math.floor(s2 / 60); s2 -= mm * 60;
    const p2 = (n: number) => String(n).padStart(2, "0");
    return dd > 0 ? `${dd} day${dd === 1 ? "" : "s"} ${hh}h ${mm}m` : `${p2(hh)}:${p2(mm)}:${p2(s2)}`;
  })();
  const opensLabel = at && !Number.isNaN(openMs)
    ? new Date(openMs).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" })
    : "";
  return { locked, countdown, opensLabel };
}
export type BasketItem = { id: string; name: string; timing: string; price: number; dates: string[]; rule?: BookRule;
  /** The chosen period's id — sent to the server so timings PRICE correctly
   * (the label in `timing` is display-only). */
  periodId?: string;
  /** 24h "09:00"/"13:00" — two sessions in a day are fine if they don't overlap. */
  start?: string; finish?: string };
// Shared booking logic — one source of truth, rendered in two visual themes.
export function useBooking(d: WizardDraft, booking: BlockBooking | null, weeks: { n: number; mon: string; days: string[] }[], blocks?: RunBlock[], mode: "operator" | "parent" = "operator") {
  const parentMode = mode === "parent";
  // The children on this booking, and who's been taken off which line. Stored
  // as exceptions so a child added is on everything immediately.
  const [roster, setRoster] = useState<ChildProfile[]>([]);
  const [removed, setRemoved] = useState<Record<string, string[]>>({});
  const passes = booking?.passes ?? [];
  const periods = booking?.periods ?? [];
  // The block loads from the API after first render, so useState's initial
  // value is always empty — fall back to the first entry instead of leaving
  // nothing selected (which recorded a blank timing on the basket line).
  const [passPick, setPassId] = useState<string | null>(null);
  const [periodPick, setPeriodId] = useState<string | null>(null);
  const passId = passPick ?? passes[0]?.id ?? null;
  const periodId = periodPick ?? periods[0]?.id ?? null;
  const [sel, setSel] = useState<string[]>([]);
  // Dates the parent wants but can't have — queued, not booked.
  const [waitSel, setWaitSel] = useState<string[]>([]);
  const [waitDone, setWaitDone] = useState(false);
  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [stage, setStage] = useState<"pick" | "checkout" | "done">("pick");
  const [child, setChild] = useState("");
  // Operator-side checkout: which parent it's for, a child per pass, and any
  // add-ons. Attendees is derived from the children actually assigned.
  // id "new" means a family being created on the call rather than one already
  // on the account; the contact details come with it so the booking write can
  // make the account. See §H of the backend handoff.
  const [parent, setParent] = useState<{ id: string; name: string; email?: string; phone?: string; address?: string } | null>(null);
  const [assign, setAssign] = useState<Record<string, string>>({});
  // Add-ons are chosen per pass (so per child), and per-day ones record which
  // days they cover: { passId: { addonId: [dates] } }.
  const [addonSel, setAddonSel] = useState<Record<string, Record<string, string[]>>>({});
  // Operator-side price edits: per pass, and an optional override of the final
  // figure. Discounts recalculate from the edited pass prices.
  const [priceEdit, setPriceEdit] = useState<Record<string, number>>({});
  const [totalOverride, setTotalOverride] = useState<number | null>(null);
  const pass = passes.find((t) => t.id === passId) || null;
  const period = periods.find((p) => p.id === periodId) || null;
  const rule: BookRule = pass ? ((d.bookRules ?? {})[pass.name] ?? "week") : "week";
  const need = pass?.days ?? 0;
  // A single-day pass isn't a fixed block: parents can pick as many days as they
  // like, and each selected day becomes its own 1-day pass in the basket.
  const isSingle = need === 1;
  const unitPrice = pass && booking ? booking.priceFor(pass.id, periodId) : pass?.basePrice ?? 0;
  const off = (iso: string) => (d.datesOff ?? []).includes(iso);
  function pickDay(iso: string, weekMon: string) {
    if (!pass || off(iso)) return;
    if (isSingle) { setSel((prev) => (prev.includes(iso) ? prev.filter((x) => x !== iso) : [...prev, iso])); return; }
    if (rule === "blocks") {
      const wk = weeks.find((w) => w.mon === weekMon);
      const avail = (wk?.days ?? []).filter((x) => !off(x)).slice(0, need);
      const same = avail.length === sel.length && avail.every((x) => sel.includes(x));
      setSel(same ? [] : avail);
      return;
    }
    setSel((prev) => {
      if (prev.includes(iso)) return prev.filter((x) => x !== iso);
      if (prev.length >= need) return prev;
      if (rule === "week" && prev.length && mondayOf(prev[0]) !== weekMon) return prev;
      return [...prev, iso];
    });
  }
  const { locked, countdown, opensLabel } = useOpensAt(d.opensAt);
  // Capacity. Two scopes: "day" caps how many children are on site on any one
  // date, "listing" caps the whole run. Parse carefully — `parseInt(...) || null`
  // turned a capacity of 0 into "no limit", which is why a sold-out listing
  // still took bookings.
  //
  // This is the UI half: it stops a basket overfilling in front of you. The
  // real limit is the block's capacity on the server, which is what settles
  // two parents taking the last place at once.
  const capNum = parseInt(d.maxAttendees, 10);
  const capacity = Number.isFinite(capNum) ? capNum : null;
  const perDay = d.capacityScope === "day";
  const seatsOn = (iso: string) => basket.filter((x) => x.dates.includes(iso)).length;

  // A basket line is one child, whichever dates it covers.
  // Where the server has generated dated runs, its spotsLeft is the truth and
  // the configured ceiling is only a fallback for the operator's preview.
  const leftOn = (iso: string) => {
    const blk = blockOn(blocks, iso);
    if (blk) return Math.max(0, blk.spotsLeft - seatsOn(iso));
    return capacity === null ? null : Math.max(0, capacity - (perDay ? seatsOn(iso) : basket.length));
  };
  // Capacity that applies to a date — the run's, else the configured one.
  const capOn = (iso: string) => blockOn(blocks, iso)?.capacity ?? capacity;
  const isLow = (iso: string, left: number) => left > 0 && left <= lowAt(capOn(iso));
  const fullDates = sel.filter((iso) => {
    const left = leftOn(iso);
    return left !== null && left < 1;
  });
  const listingFull = capacity !== null && !perDay && !blocks?.length && basket.length + 1 > capacity;
  const soldOut = (capacity !== null && capacity <= 0) || listingFull
    || (!!blocks?.length && blocks.every((b) => !b.open || b.spotsLeft <= 0));
  const hasSpace = !soldOut && fullDates.length === 0;
  // Tightest count that applies to what's on screen — the selection if there
  // is one, else the run as a whole.
  const hasCounts = !!blocks?.length || capacity !== null;
  const waitlistOn = !!d.waitlist;
  const isFull = (iso: string) => { const left = leftOn(iso); return left !== null && left < 1; };
  const toggleWait = (iso: string) => setWaitSel((w) => (w.includes(iso) ? w.filter((x) => x !== iso) : [...w, iso]));
  // Bulk: every full date across the run, for someone who'll take anything.
  // Every full day the parent could join the waiting list for.
  const fullDays = weeks.flatMap((w) => w.days).filter((iso) => !off(iso) && isFull(iso));
  const waitAll = () => setWaitSel((w) => (w.length === fullDays.length ? [] : fullDays));
  const fullCount = fullDays.length;
  const seatsLeft = (() => {
    const pool = sel.length ? sel.map(leftOn).filter((n): n is number => n !== null) : [];
    if (pool.length) return Math.min(...pool);
    if (blocks?.length) return Math.max(...blocks.map((b) => b.spotsLeft));
    return capacity === null ? null : perDay ? capacity : Math.max(0, capacity - basket.length);
  })();

  const canAdd = !locked && hasSpace && !!pass && (isSingle ? sel.length >= 1 : need > 0 && sel.length === need);
  // One booking may cover several children; the count drives multi-person rules.
  const rosterNames = roster.map((c) => c.name.trim()).filter(Boolean);
  /** Who's on a given basket line. A multi-day pass is a block: on it or not. */
  const childrenOn = (id: string) => rosterNames.filter((n) => !(removed[id] ?? []).includes(n));
  const toggleChild = (id: string, name: string) =>
    setRemoved((m) => {
      const list = m[id] ?? [];
      return { ...m, [id]: list.includes(name) ? list.filter((n) => n !== name) : [...list, name] };
    });
  /**
   * Forget every exception recorded against a child. A child added to the
   * booking is on everything — but taking them off the booking writes a
   * removal on each pass, and those outlived them: adding the same child back
   * left them listed and on nothing, looking like the click hadn't worked.
   */
  const clearRemovalsFor = (name: string) =>
    setRemoved((m) => Object.fromEntries(
      Object.entries(m).map(([id, names]) => [id, names.filter((n) => n !== name)]),
    ));

  const attendees = parentMode
    ? Math.max(1, rosterNames.length)
    : Math.max(1, new Set(Object.values(assign).map((n) => n.trim()).filter(Boolean)).size);

  // Automatic discounts come off here so the basket shows what's really owed.
  const priceOf = (x: BasketItem) => priceEdit[x.id] ?? x.price;
  // A pass in the basket is for at least one child — children are named on the
  // next stage, so before then childrenOn is empty and the total would read £0
  // against a line showing its price. Floor at one so the basket shows what
  // they're committing to; it recomputes upward the moment a second child is
  // put on the pass.
  const headsOn = (x: BasketItem) => (parentMode ? Math.max(1, childrenOn(x.id).length) : attendees);
  // Priced per child per line, so a second child doubles that line.
  // Priced per child per line, so a second child doubles that line — and the
  // engine now sees those head counts, so a sibling discount lands only where
  // children are genuinely on the same pass.
  const subtotal = basket.reduce((s, x) => s + priceOf(x) * headsOn(x), 0);
  const { lines: discountLines, total } = applyDiscounts(
    d.discounts ?? [],
    basket.map((x) => ({ name: x.name, price: priceOf(x), days: x.dates.length, heads: headsOn(x) })),
    attendees,
  );
  const saved = Math.max(0, Math.round((subtotal - total) * 100) / 100);
  // "21st, 22nd, 23rd, 24th August" — grouped by month so the month isn't
  // repeated, and readable on the row itself rather than hidden in a tooltip.
  const datesPretty = (isos: string[]) => {
    const byMonth = new Map<string, number[]>();
    for (const iso of [...isos].sort()) {
      const dt = new Date(`${iso}T00:00:00Z`);
      const month = dt.toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" });
      const list = byMonth.get(month) ?? [];
      list.push(dt.getUTCDate());
      byMonth.set(month, list);
    }
    return [...byMonth].map(([month, days]) => `${days.map(ordinal).join(", ")} ${month}`).join(", ");
  };
  const addToBasket = () => {
    if (!canAdd || !pass) return;
    if (isSingle) {
      // One basket line per chosen day → as many 1-day passes as they want.
      const items: BasketItem[] = [...sel].sort().map((day) => ({ id: uid() + day, name: pass.name, timing: period?.range ?? "", periodId: period?.id, price: unitPrice, dates: [day], rule, start: period?.start, finish: period?.finish }));
      setBasket((b) => [...b, ...items]);
    } else {
      setBasket((b) => [...b, { id: uid(), name: pass.name, timing: period?.range ?? "", periodId: period?.id, price: unitPrice, dates: [...sel].sort(), rule, start: period?.start, finish: period?.finish }]);
    }
    setSel([]);
  };
  const removeItem = (id: string) => setBasket((b) => b.filter((y) => y.id !== id));
  /**
   * Change which days a pass covers. A 5 day pass is 5 days — you don't drop
   * one, you swap it — so this puts the parent back on the calendar with the
   * current choice loaded and the line taken out of the basket.
   */
  const editDates = (id: string) => {
    const item = basket.find((y) => y.id === id);
    if (!item) return;
    const p = passes.find((x) => x.name === item.name);
    if (p) setPassId(p.id);
    setSel([...item.dates]);
    setBasket((b) => b.filter((y) => y.id !== id));
    setStage("pick");
  };
  // One instruction, shown both in the card header and above the calendar.
  const hint = !pass
    ? ""
    : isSingle
      ? `Tap every day you'd like — each one is a single-day pass (${sel.length} selected)`
      : rule === "blocks"
        ? `Tap a week to take the fixed ${need}-day block`
        : rule === "week"
          ? `Pick any ${need} days within one week (${sel.length}/${need})`
          : `Pick any ${need} days across the weeks below (${sel.length}/${need})`;
  // What the basket would look like if they added the current selection — so
  // an already-earned discount is stated before they commit, not after.
  const addPreview = (() => {
    if (!canAdd || !pass) return null;
    const pending = isSingle
      ? sel.map(() => ({ name: pass.name, price: unitPrice, days: 1 }))
      : [{ name: pass.name, price: unitPrice, days: sel.length }];
    const items = [...basket.map((x) => ({ name: x.name, price: priceOf(x), days: x.dates.length })), ...pending];
    const gross = items.reduce((s, i) => s + i.price, 0) * attendees;
    const res = applyDiscounts(d.discounts ?? [], items, attendees);
    const off = Math.max(0, Math.round((gross - res.total) * 100) / 100);
    return off > 0 ? { ...res, gross, off } : null;
  })();

  // What adding this selection really costs: the increase in the basket total
  // once discounts are recalculated, not the sticker price.
  const pendingGross = (isSingle ? unitPrice * sel.length : unitPrice) * attendees;
  const addNet = addPreview ? Math.max(0, Math.round((addPreview.total - total) * 100) / 100) : pendingGross;

  // "Add 3 more dates to get 10% off" — how close they are to the nearest
  // discount they haven't triggered yet. Counts what's in the basket plus
  // what's currently selected, so it ticks down as they tap.
  // Multi-session only, and only for rules that cover the pass they're picking
  // — nudging someone toward a discount their ticket can't earn is a lie.
  const nudge = (() => {
    if (!pass) return null;
    const rulesFor = (d.discounts ?? []).filter(
      (r) => r.enabled && r.kind === "session" && (r.passNames.length === 0 || r.passNames.includes(pass.name)),
    );
    const options = rulesFor
      .map((r) => {
        // Count only the sessions this rule actually covers.
        const inBasket = basket
          .filter((x) => r.passNames.length === 0 || r.passNames.includes(x.name))
          .reduce((s, x) => s + x.dates.length, 0);
        const now = (inBasket + sel.length) * attendees;
        return {
          need: r.moreThan + 1 - now,
          amt: r.method === "percent" ? `${r.value}% off` : `${money(r.value)} off`,
          scope: r.passNames.length === 0 ? "" : ` on ${pass.name}`,
        };
      })
      .filter((o) => o.need > 0)
      .sort((a, b) => a.need - b.need);
    const best = options[0];
    return best ? `Add ${best.need} more ${best.need === 1 ? "date" : "dates"} to get ${best.amt}${best.scope}` : null;
  })();
  const reset = () => { setBasket([]); setChild(""); setParent(null); setAssign({}); setAddonSel({}); setPriceEdit({}); setTotalOverride(null); setStage("pick"); };
  const assignTo = (itemId: string, name: string) => setAssign((a) => ({ ...a, [itemId]: name }));
  const assignAll = (name: string) => setAssign(Object.fromEntries(basket.map((x) => [x.id, name])));
  const setItemPrice = (itemId: string, price: number | null) =>
    setPriceEdit((m) => {
      const next = { ...m };
      if (price === null) delete next[itemId];
      else next[itemId] = Math.max(0, price);
      return next;
    });
  /** One child's add-ons on one basket line — lunch is per child, not per pass. */
  const addonKey = (itemId: string, child: string) => `${itemId}|${child}`;
  const setAddonDays = (itemId: string, child: string, addonId: string, dates: string[]) =>
    setAddonSel((all) => {
      const key = addonKey(itemId, child);
      const forKey = { ...(all[key] ?? {}) };
      if (dates.length) forKey[addonId] = dates;
      else delete forKey[addonId];
      return { ...all, [key]: forKey };
    });
  const addonDays = (itemId: string, child: string, addonId: string) => addonSel[addonKey(itemId, child)]?.[addonId] ?? [];

  // Answers to an add-on's questions — a t-shirt size, a meal choice. Kept
  // beside the days rather than inside them: an answer is per child per
  // add-on, not per day, and clearing the add-on clears its answers with it.
  const [addonAns, setAddonAns] = useState<Record<string, Record<string, string>>>({});
  const ansKey = (itemId: string, child: string, addonId: string) => `${itemId}|${child}|${addonId}`;
  const setAnswer = (itemId: string, child: string, addonId: string, qId: string, value: string) =>
    setAddonAns((all) => {
      const key = ansKey(itemId, child, addonId);
      return { ...all, [key]: { ...(all[key] ?? {}), [qId]: value } };
    });
  const answers = (itemId: string, child: string, addonId: string) => addonAns[ansKey(itemId, child, addonId)] ?? {};

  return { passes, periods, passId, setPassId, periodId, setPeriodId, sel, basket, stage, setStage, child, setChild, attendees, parent, setParent, assign, assignTo, assignAll, addonSel, setAddonDays, addonDays, addonKey, addonAns, setAnswer, answers, priceOf, setItemPrice, priceEdit, totalOverride, setTotalOverride, pass, period, rule, need, isSingle, unitPrice, off, pickDay, canAdd, locked, countdown, opensLabel, soldOut, hasSpace, seatsLeft, fullDates, leftOn, hasCounts, isLow, editDates,
    roster, setRoster, childrenOn, toggleChild, clearRemovalsFor, headsOn, rosterNames,
    waitlistOn, waitSel, toggleWait, waitAll, fullCount, fullDays, isFull, waitDone, setWaitDone, subtotal, discountLines, saved, total, datesPretty, hint, nudge, addPreview, pendingGross, addNet, addToBasket, removeItem, reset };
}
