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
    const u = d.data() as { name?: string; email?: string; franchiseId?: string };
    m.set(u.franchiseId ?? d.id, u.name || u.email || "Franchise");
  }
  return m;
}

// GET /api/splitfees — the royalty breakdown by franchise.
splitfees.get("/", async (req, res) => {
  const tenantId = companyScope(req, res);
  if (!tenantId) return;
  const tenant = await db.collection("tenants").doc(tenantId).get();
  const settings = ((tenant.exists && (tenant.data()!.splitFees as z.infer<typeof settingsSchema>)) || null) ?? { basis: "revenue" as const, rate: 10, perBookingFee: 0 };

  const [bookingsSnap, names] = await Promise.all([
    db.collection("bookings").where("tenantId", "==", tenantId).get(),
    franchiseNames(tenantId),
  ]);

  const rows = new Map<string, { franchiseId: string; name: string; count: number; revenue: number; collected: number }>();
  const direct = { count: 0, revenue: 0, collected: 0 };
  for (const d of bookingsSnap.docs) {
    const b = fromDoc(d.data() as BookingDoc);
    if (!COUNTS(b.status)) continue;
    const amount = b.amount ?? 0;
    const paid = b.amountPaid ?? (b.pay === "Paid" ? amount : 0);
    const fid = (d.data() as { franchiseId?: string }).franchiseId;
    if (!fid) { direct.count += 1; direct.revenue = round2(direct.revenue + amount); direct.collected = round2(direct.collected + paid); continue; }
    const row = rows.get(fid) ?? { franchiseId: fid, name: names.get(fid) ?? "Franchise", count: 0, revenue: 0, collected: 0 };
    row.count += 1; row.revenue = round2(row.revenue + amount); row.collected = round2(row.collected + paid);
    rows.set(fid, row);
  }
  // Include franchises that exist but have no bookings yet (a £0 row is useful).
  for (const [fid, name] of names) if (!rows.has(fid)) rows.set(fid, { franchiseId: fid, name, count: 0, revenue: 0, collected: 0 });

  const feeOf = (r: { revenue: number; count: number }) =>
    settings.basis === "perBooking" ? round2(r.count * (settings.perBookingFee ?? 0)) : round2(r.revenue * ((settings.rate ?? 0) / 100));
  const franchises = [...rows.values()].map((r) => ({ ...r, fee: feeOf(r) })).sort((a, b) => b.revenue - a.revenue);

  res.json({
    settings,
    franchises,
    direct,
    totals: {
      franchises: franchises.length,
      revenue: round2(franchises.reduce((s, r) => s + r.revenue, 0)),
      fee: round2(franchises.reduce((s, r) => s + r.fee, 0)),
    },
  });
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
