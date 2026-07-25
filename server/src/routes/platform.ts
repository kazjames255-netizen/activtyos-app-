import { Router } from "express";
import { db, auth } from "../firebase";
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

// GET /api/platform/subscriptions — every tenant's plan/status/spend (HQ billing
// view: "what has each provider purchased"). Staff count = staff+franchise members.
platform.get("/subscriptions", async (req, res) => {
  if (req.auth!.role !== "platform") {
    res.status(403).json({ error: "Requires the platform role" });
    return;
  }
  const [tenantsSnap, usersSnap] = await Promise.all([
    db.collection("tenants").get(),
    db.collection("users").get(),
  ]);
  const staffByTenant: Record<string, number> = {};
  for (const d of usersSnap.docs) {
    const u = d.data();
    if ((u.role === "staff" || u.role === "franchise") && u.tenantId) {
      staffByTenant[u.tenantId as string] = (staffByTenant[u.tenantId as string] ?? 0) + 1;
    }
  }
  const rows = tenantsSnap.docs.map((d) => {
    const t = d.data();
    const sub = (t.subscription as Record<string, unknown> | undefined) ?? null;
    return {
      id: d.id,
      name: (t.name as string) ?? d.id,
      type: (t.type as string) ?? "freelancer",
      createdAt: (t.createdAt as string) ?? null,
      plan: (sub?.plan as string) ?? null,
      band: (sub?.band as string) ?? null,
      status: (sub?.status as string) ?? "active",
      price: (sub?.price as number) ?? null,
      cadence: (sub?.cadence as string) ?? "month",
      trialEndsAt: (sub?.trialEndsAt as string) ?? null,
      staffCount: staffByTenant[d.id] ?? 0,
      staffLimit: (sub?.staffLimit as number | null) ?? null,
    };
  });
  rows.sort((a, b) => (`${b.createdAt ?? ""}` < `${a.createdAt ?? ""}` ? -1 : 1));
  const billable = rows.filter((r) => ["active", "trialing", "canceling"].includes(r.status));
  const mrr = billable.reduce((s, r) => s + (r.price ?? 0), 0);
  res.json({
    rows,
    summary: {
      total: rows.length,
      mrr,
      trialing: rows.filter((r) => r.status === "trialing").length,
      active: rows.filter((r) => r.status === "active").length,
    },
  });
});

// GET /api/platform/providers — the FULL record for every provider: what they
// chose and wrote at signup (from their library settings + tenant doc) plus
// their subscription and owner. For the HQ Providers detail view.
platform.get("/providers", async (req, res) => {
  if (req.auth!.role !== "platform") {
    res.status(403).json({ error: "Requires the platform role" });
    return;
  }
  const [tenantsSnap, usersSnap, libsSnap] = await Promise.all([
    db.collection("tenants").get(),
    db.collection("users").get(),
    db.collection("libraries").get(),
  ]);
  const staffByTenant: Record<string, number> = {};
  for (const d of usersSnap.docs) {
    const u = d.data();
    if ((u.role === "staff" || u.role === "franchise") && u.tenantId) staffByTenant[u.tenantId as string] = (staffByTenant[u.tenantId as string] ?? 0) + 1;
  }
  const settingsById: Record<string, Record<string, unknown>> = {};
  for (const d of libsSnap.docs) settingsById[d.id] = (d.data()?.settings as Record<string, unknown>) ?? {};

  const providers = await Promise.all(tenantsSnap.docs.map(async (d) => {
    const t = d.data();
    const s = settingsById[d.id] ?? {};
    const billing = (s.billing as Record<string, unknown> | undefined) ?? {};
    let ownerEmail: string | null = null;
    try { if (t.ownerUid) ownerEmail = (await auth.getUser(t.ownerUid as string)).email ?? null; } catch { /* deleted owner */ }
    return {
      id: d.id,
      name: (t.name as string) ?? d.id,
      type: (t.type as string) ?? "freelancer",
      createdAt: (t.createdAt as string) ?? null,
      ownerEmail,
      // Signup answers.
      providerName: (s.providerName as string) ?? null,
      providerNameMode: (s.providerNameMode as string) ?? null,
      activityKinds: (s.activityKinds as string[]) ?? [],
      address: (s.address as string) ?? (billing.address as string) ?? null,
      postcode: (t.postcode as string) ?? (s.postcode as string) ?? null,
      logoUrl: (billing.logoUrl as string) ?? null,
      heardAbout: (t.heardAbout as string) ?? null,
      referredBy: (t.referredBy as string) ?? null,
      // Bank details, if they've since added them in Setup.
      bank: billing.accountNumber || billing.sortCode || billing.bankName
        ? { bankName: billing.bankName ?? null, accountName: billing.accountName ?? null, sortCode: billing.sortCode ?? null, accountNumber: billing.accountNumber ?? null }
        : null,
      subscription: (t.subscription as Record<string, unknown>) ?? null,
      staffCount: staffByTenant[d.id] ?? 0,
    };
  }));
  providers.sort((a, b) => (`${b.createdAt ?? ""}` < `${a.createdAt ?? ""}` ? -1 : 1));
  res.json({ providers });
});
