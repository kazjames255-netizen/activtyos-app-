import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "../firebase";
import { actorName } from "../lib/actorName";
import { isRealDay, ukMonth, ukToday } from "../lib/ukDate";
import {
  computeFromLite, monthBounds, royaltyFee, round2, withRateChange, type PayoutRow,
} from "../lib/franchisePayouts";
import { franchiseNames, loadLite, loadSettings, settingsOf } from "../lib/franchisePayoutsData";

// Split fees (Money) - the franchisor's royalty report, and the Franchise payouts screen (what head office and each franchise owe each other).
// A franchise is a franchiseId-scoped role WITHIN a company's tenant. EVERY figure here comes from ONE shared helper (lib/franchisePayouts.ts),
// the same one the head office overview uses, so the screens cannot disagree. Company accounts only (platform: read only, ?tenantId=).
export const splitfees = Router();

const settingsSchema = z.object({
  basis: z.enum(["revenue", "perBooking"]),
  // A percentage to two decimals at most (7.5, 12.25); "0.1+0.2"-style junk is refused.
  rate: z.number().min(0).max(100).refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, "Use at most two decimal places").optional(),
  perBookingFee: z.number().min(0).max(100_000).optional(), // GBP per booking
  /** The UK day a changed rate starts from (today or later). Past months keep the rate they had. */
  effectiveFrom: z.string().refine(isRealDay, "Enter a real date").optional(),
});

function companyScope(req: Request, res: Response): string | null {
  const auth = req.auth!;
  if (auth.role === "platform") {
    const t = typeof req.query.tenantId === "string" ? req.query.tenantId : null;
    if (!t) { res.status(400).json({ error: "Platform: pass ?tenantId=" }); return null; }
    return t;
  }
  if (auth.role !== "company" || !auth.tenantId) { res.status(403).json({ error: "Requires a company (franchisor) account" }); return null; }
  return auth.tenantId;
}

/** "N months back" as a UK day, clamped to the month's length. */
function ukMonthsBack(n: number): string {
  const [y, m, d] = ukToday().split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 - n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

/** The ?month=YYYY-MM / ?from=&to= (UK days) / ?period=1m|3m|6m|12m|all window. `fallback` is used when nothing is given. */
function parseWindow(req: Request, fallback: "all" | "month") {
  const q = req.query;
  const month = typeof q.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(q.month) ? q.month : null;
  const f = typeof q.from === "string" && isRealDay(q.from) ? q.from : null;
  const t = typeof q.to === "string" && isRealDay(q.to) ? q.to : null;
  let period = typeof q.period === "string" ? q.period : fallback === "month" ? "month" : "all";
  let from: string | null = null, to: string | null = null;
  if (month) { ({ from, to } = monthBounds(month)); period = "month"; }
  else if (f || t) { from = f; to = t; period = "custom"; }
  else {
    const back: Record<string, number> = { "1m": 1, "3m": 3, "6m": 6, "12m": 12 };
    if (back[period]) from = ukMonthsBack(back[period]);
    else if (period === "month" || (fallback === "month" && period !== "all")) { ({ from, to } = monthBounds(ukMonth())); period = "month"; }
  }
  if (from && to && from > to) [from, to] = [to, from];
  return { period, from, to, month: period === "month" && from ? from.slice(0, 7) : null };
}

const plainRow = (r: PayoutRow) => ({ ...r });

// GET /api/splitfees - the royalty breakdown by franchise, filterable by window, with a per-month series for the chart. No window = all time.
splitfees.get("/", async (req, res) => {
  const tenantId = companyScope(req, res);
  if (!tenantId) return;
  const win = parseWindow(req, "all");
  const [settings, names, lite] = await Promise.all([loadSettings(tenantId), franchiseNames(tenantId), loadLite(tenantId)]);
  const opts = { from: win.from, to: win.to, history: settings.history, fallbackRate: settings.rate };
  const result = computeFromLite(lite, opts, names.keys());
  const feeOf = (r: PayoutRow) => royaltyFee(r, settings.basis, settings.perBookingFee);
  const franchises = [...result.franchises.values()]
    .map((r) => ({ franchiseId: r.franchiseId, name: names.get(r.franchiseId) ?? "Franchise", count: r.bookings, revenue: r.total, collected: r.total, fee: feeOf(r) }))
    .sort((a, b) => b.revenue - a.revenue);
  const direct = { count: result.direct.bookings, revenue: result.direct.total, collected: result.direct.total };

  // Month series across the window (or the span of the data for "all").
  const inWin = lite.filter((l) => l.day && (!win.from || l.day >= win.from) && (!win.to || l.day <= win.to));
  let months = [...new Set(inWin.map((l) => l.day!.slice(0, 7)))].sort();
  if (win.from) {
    months = [];
    const end = (win.to ?? ukToday()).slice(0, 7);
    for (let m = win.from.slice(0, 7); m <= end;) { months.push(m); const [y, mo] = m.split("-").map(Number); m = new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 7); }
  }
  const series = months.map((mk) => {
    const b = monthBounds(mk);
    const r = computeFromLite(lite, { ...opts, from: b.from, to: b.to }, []);
    const byFranchise: Record<string, { revenue: number; fee: number }> = {};
    let fee = 0, revenue = 0;
    for (const row of r.franchises.values()) { const f = feeOf(row); byFranchise[row.franchiseId] = { revenue: row.total, fee: f }; fee = round2(fee + f); revenue = round2(revenue + row.total); }
    // Head-office direct bookings owe NO royalty - only franchises do.
    if (r.direct.total > 0) { byFranchise.__ho__ = { revenue: r.direct.total, fee: 0 }; revenue = round2(revenue + r.direct.total); }
    return { month: mk, revenue, fee, byFranchise };
  });
  const seriesLegend = [...franchises.map((f) => ({ franchiseId: f.franchiseId, name: f.name })), { franchiseId: "__ho__", name: "Head office (direct)" }];

  res.json({
    settings: { basis: settings.basis, rate: settings.rate, perBookingFee: settings.perBookingFee },
    franchises,
    direct,
    totals: {
      franchises: franchises.length,
      revenue: round2(franchises.reduce((s, r) => s + r.revenue, 0)),
      fee: round2(franchises.reduce((s, r) => s + r.fee, 0)),
    },
    range: { period: win.period, from: win.from, to: win.to },
    basis: "Counted by the day the booking was made (UK time), only money actually received, net of refunds.",
    series,
    seriesLegend,
  });
});

// GET /api/splitfees/mine - a single franchise's own royalty view ("what I owe HQ"). Franchise owner only (franchise staff see no money).
splitfees.get("/mine", async (req, res) => {
  const auth = req.auth!;
  if (auth.role !== "franchise" || !auth.tenantId || !auth.franchiseId) {
    res.status(403).json({ error: "Franchise account only" });
    return;
  }
  const win = parseWindow(req, "all");
  const [settings, lite] = await Promise.all([loadSettings(auth.tenantId), loadLite(auth.tenantId)]);
  const result = computeFromLite(lite, { from: win.from, to: win.to, history: settings.history, fallbackRate: settings.rate }, [auth.franchiseId]);
  const r = result.franchises.get(auth.franchiseId)!;
  res.json({
    settings: { basis: settings.basis, rate: settings.rate, perBookingFee: settings.perBookingFee },
    count: r.bookings, revenue: r.total, collected: r.total, fee: royaltyFee(r, settings.basis, settings.perBookingFee),
    period: win.period, from: win.from, to: win.to,
  });
});

// GET /api/splitfees/settings - the royalty basis + rate + rate history.
splitfees.get("/settings", async (req, res) => {
  const auth = req.auth!;
  if (auth.role !== "company" || !auth.tenantId) { res.status(403).json({ error: "Requires a company (franchisor) account" }); return; }
  const s = await loadSettings(auth.tenantId);
  res.json({ settings: { basis: s.basis, rate: s.rate, perBookingFee: s.perBookingFee }, history: s.history });
});

// PUT /api/splitfees/settings - the royalty basis + rate (company only). A changed rate starts on `effectiveFrom` (default today, never in the
// past) and is kept in a history, so changing it never rewrites a past month.
splitfees.put("/settings", async (req, res) => {
  const auth = req.auth!;
  if (auth.role !== "company" || !auth.tenantId) { res.status(403).json({ error: "Requires a company (franchisor) account" }); return; }
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const { effectiveFrom, ...next } = parsed.data;
  const today = ukToday();
  if (effectiveFrom && effectiveFrom < today) { res.status(400).json({ error: "A new rate can start today or later - past months keep the rate they had." }); return; }
  const ref = db.collection("tenants").doc(auth.tenantId);
  const out = await db.runTransaction(async (tx) => {
    const cur = await loadSettingsTx(tx, ref);
    const rateChanged = next.rate != null && next.rate !== cur.rate;
    const history = rateChanged ? withRateChange(cur.history, cur.rate, next.rate!, effectiveFrom ?? today) : cur.history;
    const stored = { basis: next.basis, rate: next.rate ?? cur.rate, perBookingFee: next.perBookingFee ?? cur.perBookingFee, ...(history.length ? { history } : {}) };
    tx.set(ref, { splitFees: stored }, { merge: true });
    return { settings: { basis: stored.basis, rate: stored.rate, perBookingFee: stored.perBookingFee }, history };
  });
  res.json(out);
});

async function loadSettingsTx(tx: FirebaseFirestore.Transaction, ref: FirebaseFirestore.DocumentReference) {
  const snap = await tx.get(ref);
  return settingsOf(snap.exists ? (snap.data() as Record<string, unknown>) : undefined);
}

// ---- Franchise payouts ------------------------------------------------------------------------------------------------------------------

const BASIS_NOTE = "Counted by the day each booking was made (UK time). Only money actually received counts, net of refunds; unpaid, pending and card-hold bookings do not. Stripe's card fee is not deducted - head office absorbs it.";

interface Settlement {
  id: string; franchiseId: string; franchiseName: string; from: string; to: string;
  amount: number; direction: "hoPays" | "franchiseOwes" | "even";
  card: number; direct: number; hoKeepsCard: number; hoShareDirect: number; bookings: number; rates: number[];
  settledAt: string; settledBy: { uid: string; name: string };
}
const sid = (tenantId: string, fid: string, from: string, to: string) => `${tenantId}__${fid}__${from}__${to}`.replace(/[/\s]/g, "_");
const settlementOf = (d: FirebaseFirestore.DocumentSnapshot): Settlement => ({ id: d.id, ...(d.data() as Omit<Settlement, "id">) });
async function settlementsFor(tenantId: string, fid?: string): Promise<Settlement[]> {
  let q: FirebaseFirestore.Query = db.collection("franchiseSettlements").where("tenantId", "==", tenantId);
  if (fid) q = q.where("franchiseId", "==", fid);
  const snap = await q.get();
  return snap.docs.map(settlementOf).sort((a, b) => (a.settledAt < b.settledAt ? 1 : -1));
}

/** The payout window: ?month=YYYY-MM, or ?from=&to=. Default: this UK month. */
function payoutWindow(req: Request) {
  const w = parseWindow(req, "month");
  if (!w.from || !w.to) { const b = monthBounds(ukMonth()); return { period: "month", from: b.from, to: b.to, month: ukMonth() }; }
  return { ...w, from: w.from, to: w.to };
}

// GET /api/splitfees/payouts - head office (or platform, read only): one row per franchise for the window, with any settlement already recorded.
splitfees.get("/payouts", async (req, res) => {
  const tenantId = companyScope(req, res);
  if (!tenantId) return;
  const win = payoutWindow(req);
  const [settings, names, lite, settled] = await Promise.all([loadSettings(tenantId), franchiseNames(tenantId), loadLite(tenantId), settlementsFor(tenantId)]);
  const result = computeFromLite(lite, { from: win.from, to: win.to, history: settings.history, fallbackRate: settings.rate }, names.keys());
  const rows = [...result.franchises.values()].map((r) => ({
    ...plainRow(r), name: names.get(r.franchiseId) ?? "Franchise",
    settlement: settled.find((s) => s.franchiseId === r.franchiseId && s.from === win.from && s.to === win.to) ?? null,
    overlapping: settled.some((s) => s.franchiseId === r.franchiseId && s.from <= win.to && s.to >= win.from && !(s.from === win.from && s.to === win.to)),
  })).sort((a, b) => a.name.localeCompare(b.name));
  res.json({
    range: { period: win.period, from: win.from, to: win.to, month: win.month, today: ukToday() },
    rate: settings.rate, rateHistory: settings.history, settings: { basis: settings.basis, rate: settings.rate, perBookingFee: settings.perBookingFee },
    basis: BASIS_NOTE,
    rows,
    direct: result.direct,
    settlements: settled.slice(0, 200),
    canSettle: req.auth!.role === "company",
  });
});

// GET /api/splitfees/payouts/mine - a franchise sees ONLY its own statement for the window (read only). Franchise staff: 403, no money.
splitfees.get("/payouts/mine", async (req, res) => {
  const auth = req.auth!;
  if (auth.role !== "franchise" || !auth.tenantId || !auth.franchiseId) { res.status(403).json({ error: "Franchise account only" }); return; }
  const win = payoutWindow(req);
  const [settings, lite, settled] = await Promise.all([loadSettings(auth.tenantId), loadLite(auth.tenantId), settlementsFor(auth.tenantId, auth.franchiseId)]);
  const result = computeFromLite(lite, { from: win.from, to: win.to, history: settings.history, fallbackRate: settings.rate }, [auth.franchiseId]);
  const r = result.franchises.get(auth.franchiseId)!;
  res.json({
    range: { period: win.period, from: win.from, to: win.to, month: win.month, today: ukToday() },
    rate: settings.rate, basis: BASIS_NOTE,
    row: { ...plainRow(r), settlement: settled.find((s) => s.from === win.from && s.to === win.to) ?? null },
    settlements: settled.slice(0, 200),
  });
});

const settleSchema = z.object({
  franchiseId: z.string().trim().min(1).max(200),
  from: z.string().refine(isRealDay, "Enter a real date"),
  to: z.string().refine(isRealDay, "Enter a real date"),
});

// POST /api/splitfees/payouts/settle - record that this franchise's payout for the period has been settled. Head office only. The amount is
// worked out HERE (never taken from the browser). Immutable: a second click on the same period changes nothing and returns the first record.
splitfees.post("/payouts/settle", async (req, res) => {
  const auth = req.auth!;
  if (auth.role !== "company" || !auth.tenantId) { res.status(403).json({ error: "Only head office can mark a payout settled" }); return; }
  const parsed = settleSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const { franchiseId, from, to } = parsed.data;
  if (from > to) { res.status(400).json({ error: "The period starts after it ends" }); return; }
  if (to > ukToday()) { res.status(400).json({ error: "This period has not finished yet - settle it once it has ended, so the figures cannot change." }); return; }
  const names = await franchiseNames(auth.tenantId);
  if (!names.has(franchiseId)) { res.status(404).json({ error: "No such franchise" }); return; }
  const id = sid(auth.tenantId, franchiseId, from, to);
  const ref = db.collection("franchiseSettlements").doc(id);
  const first = await ref.get();
  if (first.exists) { res.json({ settlement: settlementOf(first), alreadySettled: true }); return; }
  // A different period that overlaps one already settled would count some bookings twice.
  const prior = await settlementsFor(auth.tenantId, franchiseId);
  const same = prior.find((s) => s.id === id); // a click that raced the first one: its record stands
  if (same) { res.json({ settlement: same, alreadySettled: true }); return; }
  const clash = prior.find((s) => s.from <= to && s.to >= from);
  if (clash) { res.status(409).json({ error: `This overlaps ${clash.from} to ${clash.to}, which is already settled.` }); return; }

  const [settings, lite, by] = await Promise.all([loadSettings(auth.tenantId), loadLite(auth.tenantId), actorName(req, "Head office")]);
  const r = computeFromLite(lite, { from, to, history: settings.history, fallbackRate: settings.rate }, [franchiseId]).franchises.get(franchiseId)!;
  const rec: Omit<Settlement, "id"> & { tenantId: string } = {
    tenantId: auth.tenantId, franchiseId, franchiseName: names.get(franchiseId) ?? "Franchise", from, to,
    amount: Math.abs(r.net), direction: r.net > 0 ? "hoPays" : r.net < 0 ? "franchiseOwes" : "even",
    card: r.card, direct: r.direct, hoKeepsCard: r.hoKeepsCard, hoShareDirect: r.hoShareDirect, bookings: r.bookings, rates: r.rates,
    settledAt: new Date().toISOString(), settledBy: { uid: req.user?.uid ?? "", name: by },
  };
  // create() fails if another click got there first - that click's record stands. Under a burst the emulator / Firestore may also answer
  // "aborted" to the losers: look again (briefly) before treating it as an error.
  for (let attempt = 0; ; attempt++) {
    try {
      await ref.create(rec);
      res.status(201).json({ settlement: { id, ...rec }, alreadySettled: false });
      return;
    } catch (e) {
      const again = await ref.get();
      if (again.exists) { res.json({ settlement: settlementOf(again), alreadySettled: true }); return; }
      const code = (e as { code?: number }).code; // 6 = already exists, 10 = aborted (contention), 4 / 14 = busy
      if (attempt >= 5 || ![6, 10, 4, 14].includes(code ?? -1)) throw e;
      await new Promise((r) => setTimeout(r, 60 * (attempt + 1)));
    }
  }
});
