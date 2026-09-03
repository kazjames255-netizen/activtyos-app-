import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "../firebase";
import { fromDoc, type BookingDoc } from "../lib/bookingDoc";

// Split fees (Money) — the franchisor's royalty report. A franchise is a
// franchiseId-scoped role WITHIN a company's tenant, so this groups the
// company's bookings by franchiseId, sums each franchise's revenue and applies
// the configured royalty (a % of revenue, or a flat fee per booking). Company
// accounts only (it's the HQ's view of what its franchises owe).
export const splitfees = Router();

const settingsSchema = z.object({
  basis: z.enum(["revenue", "perBooking"]),
  rate: z.number().min(0).max(100).optional(), // % of revenue
  perBookingFee: z.number().min(0).max(100_000).optional(), // £ per booking
});
const round2 = (n: number) => Math.round(n * 100) / 100;
// Bookings that count as revenue — they hold a place and aren't written off.
const COUNTS = (status: string) => status !== "Cancelled" && status !== "Declined" && status !== "Waitlisted";

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

async function franchiseNames(tenantId: string): Promise<Map<string, string>> {
  const snap = await db.collection("users").where("tenantId", "==", tenantId).where("role", "==", "franchise").get();
  const m = new Map<string, string>();
  for (const d of snap.docs) {
    const u = d.data() as { name?: string; email?: string; franchiseId?: string; franchiseName?: string; franchiseArea?: string };
    // Prefer the head-office-granted franchise identity (e.g. "APF Activity Camps · London") over the account holder's personal name.
    const label = [u.franchiseName || u.name, u.franchiseArea].filter(Boolean).join(" · ") || u.email || "Franchise";
    m.set(u.franchiseId ?? d.id, label);
  }
  return m;
}

// Parse the ?period=/?from=/?to= window into an inclusive [fromMs,toMs] filter.
// period: "1m" | "3m" | "6m" | "12m" | "all" (default). from/to (ISO dates) override.
function parseRange(req: Request) {
  const period = typeof req.query.period === "string" ? req.query.period : "all";
  const monthsBack: Record<string, number> = { "1m": 1, "3m": 3, "6m": 6, "12m": 12 };
  let fromMs: number | null = null, toMs: number | null = null;
  const now = new Date();
  if (typeof req.query.from === "string" && req.query.from) { const t = Date.parse(req.query.from); if (!Number.isNaN(t)) fromMs = t; }
  if (typeof req.query.to === "string" && req.query.to) { const t = Date.parse(req.query.to); if (!Number.isNaN(t)) toMs = t + 86_399_999; }
  if (fromMs == null && monthsBack[period]) { const d = new Date(now); d.setMonth(d.getMonth() - monthsBack[period]); fromMs = d.getTime(); }
  const inRange = (iso?: string) => {
    if (fromMs == null && toMs == null) return true;      // "all"
    if (!iso) return false;
    const t = Date.parse(iso); if (Number.isNaN(t)) return false;
    if (fromMs != null && t < fromMs) return false;
    if (toMs != null && t > toMs) return false;
    return true;
  };
  return { period, from: fromMs, to: toMs, inRange };
}

// GET /api/splitfees — the royalty breakdown by franchise, filterable by a date
// range (?period= / ?from= / ?to=), with a per-month royalty time-series for the
// chart. No range params = all-time (unchanged, so the dashboard keeps working).
splitfees.get("/", async (req, res) => {
  const tenantId = companyScope(req, res);
  if (!tenantId) return;
  const tenant = await db.collection("tenants").doc(tenantId).get();
  const settings = ((tenant.exists && (tenant.data()!.splitFees as z.infer<typeof settingsSchema>)) || null) ?? { basis: "revenue" as const, rate: 10, perBookingFee: 0 };
  const range = parseRange(req);

  const [bookingsSnap, names, listingsSnap] = await Promise.all([
    db.collection("bookings").where("tenantId", "==", tenantId).get(),
    franchiseNames(tenantId),
    db.collection("listings").where("tenantId", "==", tenantId).get(),
  ]);
  const listingFr = new Map<string, string>();
  for (const d of listingsSnap.docs) { const f = (d.data() as { franchiseId?: string }).franchiseId; if (f) listingFr.set(d.id, f); }

  const rows = new Map<string, { franchiseId: string; name: string; count: number; revenue: number; collected: number }>();
  const direct = { count: 0, revenue: 0, collected: 0 };
  // month → per-franchise {revenue,count} (+"__ho__" direct), for the series.
  const monthAgg = new Map<string, Map<string, { revenue: number; count: number }>>();
  const bump = (mk: string, key: string, amount: number) => {
    if (!monthAgg.has(mk)) monthAgg.set(mk, new Map());
    const m = monthAgg.get(mk)!; const cur = m.get(key) ?? { revenue: 0, count: 0 };
    cur.revenue = round2(cur.revenue + amount); cur.count += 1; m.set(key, cur);
  };

  for (const d of bookingsSnap.docs) {
    const b = fromDoc(d.data() as BookingDoc);
    if (!COUNTS(b.status)) continue;
    const raw = d.data() as { franchiseId?: string; listingId?: string; createdAt?: string };
    if (!range.inRange(b.createdAt ?? raw.createdAt)) continue;
    const amount = b.amount ?? 0;
    const paid = b.amountPaid ?? (b.pay === "Paid" ? amount : 0);
    const fid = raw.franchiseId ?? (raw.listingId ? listingFr.get(raw.listingId) : undefined);
    const created = b.createdAt ?? raw.createdAt;
    if (!fid) {
      direct.count += 1; direct.revenue = round2(direct.revenue + amount); direct.collected = round2(direct.collected + paid);
      if (created) bump(created.slice(0, 7), "__ho__", amount);
      continue;
    }
    const row = rows.get(fid) ?? { franchiseId: fid, name: names.get(fid) ?? "Franchise", count: 0, revenue: 0, collected: 0 };
    row.count += 1; row.revenue = round2(row.revenue + amount); row.collected = round2(row.collected + paid);
    rows.set(fid, row);
    if (created) bump(created.slice(0, 7), fid, amount);
  }
  for (const [fid, name] of names) if (!rows.has(fid)) rows.set(fid, { franchiseId: fid, name, count: 0, revenue: 0, collected: 0 });

  const feeOf = (r: { revenue: number; count: number }) =>
    settings.basis === "perBooking" ? round2(r.count * (settings.perBookingFee ?? 0)) : round2(r.revenue * ((settings.rate ?? 0) / 100));
  const franchises = [...rows.values()].map((r) => ({ ...r, fee: feeOf(r) })).sort((a, b) => b.revenue - a.revenue);

  // Build the month series across the window (or the span of data for "all"),
  // each month carrying per-franchise ROYALTY (fee) + revenue.
  const monthKeys = [...monthAgg.keys()].sort();
  let seriesMonths: string[] = monthKeys;
  if (range.from != null) {
    // Fill every month from `from` to `to` (or now) so gaps show as zero.
    seriesMonths = [];
    const start = new Date(range.from); start.setUTCDate(1);
    const end = new Date(range.to ?? Date.now());
    for (const dt = start; dt <= end; dt.setUTCMonth(dt.getUTCMonth() + 1)) seriesMonths.push(dt.toISOString().slice(0, 7));
  }
  const series = seriesMonths.map((mk) => {
    const m = monthAgg.get(mk);
    const byFranchise: Record<string, { revenue: number; fee: number }> = {};
    let fee = 0, revenue = 0;
    // Head-office direct bookings ("__ho__") owe NO royalty — only franchises do.
    if (m) for (const [key, v] of m) { const f = key === "__ho__" ? 0 : feeOf(v); byFranchise[key] = { revenue: v.revenue, fee: f }; fee = round2(fee + f); revenue = round2(revenue + v.revenue); }
    return { month: mk, revenue, fee, byFranchise };
  });
  const seriesLegend = [...franchises.map((f) => ({ franchiseId: f.franchiseId, name: f.name })), { franchiseId: "__ho__", name: "Head office (direct)" }];

  res.json({
    settings,
    franchises,
    direct,
    totals: {
      franchises: franchises.length,
      revenue: round2(franchises.reduce((s, r) => s + r.revenue, 0)),
      fee: round2(franchises.reduce((s, r) => s + r.fee, 0)),
    },
    range: { period: range.period, from: range.from ? new Date(range.from).toISOString().slice(0, 10) : null, to: range.to ? new Date(range.to).toISOString().slice(0, 10) : null },
    series,
    seriesLegend,
  });
});

// GET /api/splitfees/mine — a single franchise's own royalty view ("what I owe HQ").
splitfees.get("/mine", async (req, res) => {
  const auth = req.auth!;
  if (auth.role !== "franchise" || !auth.tenantId || !auth.franchiseId) {
    res.status(403).json({ error: "Franchise account only" });
    return;
  }
  const tenant = await db.collection("tenants").doc(auth.tenantId).get();
  const settings = ((tenant.exists && (tenant.data()!.splitFees as z.infer<typeof settingsSchema>)) || null) ?? { basis: "revenue" as const, rate: 10, perBookingFee: 0 };

  const [bookingsSnap, listingsSnap] = await Promise.all([
    db.collection("bookings").where("tenantId", "==", auth.tenantId).get(),
    db.collection("listings").where("tenantId", "==", auth.tenantId).get(),
  ]);
  const myListingIds = new Set(listingsSnap.docs.filter((d) => (d.data() as { franchiseId?: string }).franchiseId === auth.franchiseId).map((d) => d.id));

  let count = 0, revenue = 0, collected = 0;
  for (const d of bookingsSnap.docs) {
    const b = fromDoc(d.data() as BookingDoc);
    if (!COUNTS(b.status)) continue;
    const raw = d.data() as { franchiseId?: string; listingId?: string };
    const mine = raw.franchiseId === auth.franchiseId || (raw.listingId ? myListingIds.has(raw.listingId) : false);
    if (!mine) continue;
    count += 1;
    revenue = round2(revenue + (b.amount ?? 0));
    collected = round2(collected + (b.amountPaid ?? (b.pay === "Paid" ? (b.amount ?? 0) : 0)));
  }
  const fee = settings.basis === "perBooking" ? round2(count * (settings.perBookingFee ?? 0)) : round2(revenue * ((settings.rate ?? 0) / 100));
  res.json({ settings, count, revenue, collected, fee });
});

// PUT /api/splitfees/settings — the royalty basis + rate (company only).
splitfees.put("/settings", async (req, res) => {
  const auth = req.auth!;
  if (auth.role !== "company" || !auth.tenantId) { res.status(403).json({ error: "Requires a company (franchisor) account" }); return; }
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  await db.collection("tenants").doc(auth.tenantId).set({ splitFees: parsed.data }, { merge: true });
  res.json({ settings: parsed.data });
});
