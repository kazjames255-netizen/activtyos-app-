import { Router } from "express";
import { db } from "../firebase";
import type { BookingDoc } from "../lib/bookingDoc";

export const platform = Router();

// GET /api/platform/overview — platform-wide aggregates for the HQ
// dashboard. Fine as full-collection reads at the current scale; becomes a
// scheduled aggregation job when tenant counts grow.
platform.get("/overview", async (req, res) => {
  if (req.auth!.role !== "platform") {
    res.status(403).json({ error: "Requires the platform role" });
    return;
  }

  const [tenantsSnap, bookingsSnap, listingsSnap, usersSnap] = await Promise.all([
    db.collection("tenants").get(),
    db.collection("bookings").get(),
    db.collection("listings").get(),
    db.collection("users").get(),
  ]);

  const tenants = tenantsSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as { name: string; type: "company" | "freelancer"; createdAt: string }),
  }));
  const tenantsByType = { company: 0, freelancer: 0 };
  for (const t of tenants) tenantsByType[t.type] = (tenantsByType[t.type] ?? 0) + 1;
  const recentTenants = [...tenants]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 5)
    .map(({ id, name, type, createdAt }) => ({ id, name, type, createdAt }));

  const bookingsByStatus: Record<string, number> = {};
  let bookedValue = 0;
  let paidValue = 0;
  let refundsPending = 0;
  for (const doc of bookingsSnap.docs) {
    const b = doc.data() as BookingDoc;
    bookingsByStatus[b.status] = (bookingsByStatus[b.status] ?? 0) + 1;
    bookedValue += b.amount || 0;
    if (b.pay === "Paid") paidValue += b.amount || 0;
    if (b.cancel?.refund === "pending") refundsPending++;
  }

  const accountsByRole: Record<string, number> = {};
  for (const doc of usersSnap.docs) {
    const role = (doc.data().role as string) || "parent";
    accountsByRole[role] = (accountsByRole[role] ?? 0) + 1;
  }

  res.json({
    tenants: { total: tenants.length, byType: tenantsByType, recent: recentTenants },
    bookings: {
      total: bookingsSnap.size,
      byStatus: bookingsByStatus,
      bookedValue,
      paidValue,
      refundsPending,
    },
    listings: { total: listingsSnap.size },
    accounts: { total: usersSnap.size, byRole: accountsByRole },
  });
});
