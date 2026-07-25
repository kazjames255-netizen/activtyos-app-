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
      // Contact — the business email/phone shown to parents (falls back to login email).
      contactEmail: (billing.email as string) ?? ownerEmail ?? null,
      phone: (billing.phone as string) ?? null,
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

// GET /api/platform/analytics — the money/trends dashboard for HQ: MRR/ARR,
// churn, tenure, conversion, signups & GMV over 12 months, attribution, top
// providers, at-risk, and a simple MRR projection. Full-collection reads at
// current scale (becomes a scheduled rollup later).
platform.get("/analytics", async (req, res) => {
  if (req.auth!.role !== "platform") {
    res.status(403).json({ error: "Requires the platform role" });
    return;
  }
  const [tenantsSnap, bookingsSnap, libsSnap] = await Promise.all([
    db.collection("tenants").get(),
    db.collection("bookings").get(),
    db.collection("libraries").get(),
  ]);
  const settingsById: Record<string, Record<string, unknown>> = {};
  for (const ld of libsSnap.docs) settingsById[ld.id] = (ld.data()?.settings as Record<string, unknown>) ?? {};
  const now = new Date();
  const DAY = 86_400_000;
  const mKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) months.push(mKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))));
  const monthEnd = (k: string) => { const [y, m] = k.split("-").map(Number); return new Date(Date.UTC(y, m, 0, 23, 59, 59)); };
  const BILLABLE = new Set(["active", "trialing", "canceling"]);

  const tenants = tenantsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) })) as (Record<string, unknown> & { id: string; type?: string; createdAt?: string; heardAbout?: string; subscription?: Record<string, unknown> })[];

  let mrr = 0, mrrPaying = 0, mrrTrial = 0, active = 0, trialing = 0, canceling = 0, canceled = 0, started = 0, tenureSum = 0, tenureCount = 0;
  const byPlan: Record<string, { count: number; mrr: number }> = {};
  const byStatus: Record<string, number> = {};
  const byType: Record<string, number> = {};
  const attribution: Record<string, number> = {};
  const topProviders: { id: string; name: string; plan: string; band: string | null; fee: number; tenureDays: number }[] = [];
  const atRisk: { id: string; name: string; cancelAt: string | null; fee: number; contactEmail: string | null; phone: string | null }[] = [];

  for (const t of tenants) {
    const sub = t.subscription ?? {};
    const status = (sub.status as string) ?? "active"; // legacy no-field tenants = active, £0
    byStatus[status] = (byStatus[status] ?? 0) + 1;
    const plan = (sub.plan as string) ?? (t.type === "company" ? "company" : "freelancer");
    const kind = plan === "franchise" ? "franchise" : (t.type ?? "freelancer");
    byType[kind] = (byType[kind] ?? 0) + 1;
    if (t.heardAbout) attribution[t.heardAbout] = (attribution[t.heardAbout] ?? 0) + 1;
    const price = Number(sub.price) || 0;
    const tenureDays = t.createdAt ? Math.max(0, Math.round((now.getTime() - Date.parse(t.createdAt)) / DAY)) : 0;
    if (BILLABLE.has(status)) {
      mrr += price;
      byPlan[plan] = byPlan[plan] ?? { count: 0, mrr: 0 };
      byPlan[plan].count++; byPlan[plan].mrr += price;
      if (price > 0) topProviders.push({ id: t.id, name: (t.name as string) ?? t.id, plan, band: (sub.band as string) ?? null, fee: price, tenureDays });
      tenureSum += tenureDays; tenureCount++;
    }
    if (status === "active") { active++; mrrPaying += price; }
    if (status === "trialing") { trialing++; mrrTrial += price; }
    if (status === "canceling") {
      canceling++; mrrPaying += price;
      const billing = (settingsById[t.id]?.billing as Record<string, unknown> | undefined) ?? {};
      let contactEmail: string | null = (billing.email as string) || null;
      if (!contactEmail && t.ownerUid) { try { contactEmail = (await auth.getUser(t.ownerUid as string)).email ?? null; } catch { /* owner gone */ } }
      atRisk.push({ id: t.id, name: (t.name as string) ?? t.id, cancelAt: (sub.cancelAt as string) ?? null, fee: price, contactEmail, phone: (billing.phone as string) ?? null });
    }
    if (status === "canceled") canceled++;
    if (["active", "trialing", "canceling", "canceled"].includes(status)) started++;
  }
  const avgTenureDays = tenureCount ? Math.round(tenureSum / tenureCount) : 0;
  const churnRate = canceled + active + canceling ? canceled / (canceled + active + canceling) : 0;
  const trialConversion = started ? (active + canceling) / started : 0;

  // Signups per month + cumulative.
  const signBuckets: Record<string, number> = {};
  for (const t of tenants) if (t.createdAt) { const k = mKey(new Date(t.createdAt)); if (months.includes(k)) signBuckets[k] = (signBuckets[k] ?? 0) + 1; }
  let cum = tenants.filter((t) => t.createdAt && new Date(t.createdAt) < monthEnd(months[0])).length;
  const signupsByMonth = months.map((k) => { const count = signBuckets[k] ?? 0; cum += count; return { month: k, count, cumulative: cum }; });

  // Approx MRR at each month end = providers who'd started by then. Two series:
  // incl. trials (billable) and paying-only (active + cancelling).
  const PAYING = new Set(["active", "canceling"]);
  const mrrAt = (statuses: Set<string>) => months.map((k) => {
    const end = monthEnd(k);
    let m = 0;
    for (const t of tenants) { const sub = t.subscription ?? {}; if (!statuses.has(sub.status as string)) continue; const since = (sub.since as string) ?? t.createdAt; if (since && new Date(since) <= end) m += Number(sub.price) || 0; }
    return { month: k, mrr: m };
  });
  const mrrByMonth = mrrAt(BILLABLE);
  const mrrPayingByMonth = mrrAt(PAYING);

  // GMV (what parents pay providers) from bookings.
  const gmvBuckets: Record<string, { booked: number; paid: number }> = {};
  let gmvBooked = 0, gmvPaid = 0;
  for (const d of bookingsSnap.docs) {
    const b = d.data() as { amount?: number; pay?: string; createdAt?: string };
    const amt = Number(b.amount) || 0; const paid = b.pay === "Paid" ? amt : 0;
    gmvBooked += amt; gmvPaid += paid;
    if (b.createdAt) { const k = mKey(new Date(b.createdAt)); if (months.includes(k)) { gmvBuckets[k] = gmvBuckets[k] ?? { booked: 0, paid: 0 }; gmvBuckets[k].booked += amt; gmvBuckets[k].paid += paid; } }
  }
  const gmvByMonth = months.map((k) => ({ month: k, booked: Math.round(gmvBuckets[k]?.booked ?? 0), paid: Math.round(gmvBuckets[k]?.paid ?? 0) }));

  // Simple linear MRR projection from the last 6 months' average delta.
  const recent = mrrByMonth.slice(-6).map((x) => x.mrr);
  const deltas = recent.slice(1).map((v, i) => v - recent[i]);
  const avgDelta = deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 0;
  const lastMrr = recent.length ? recent[recent.length - 1] : mrr;
  const projection = [1, 2, 3].map((n) => ({ month: mKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + n, 1))), mrr: Math.max(0, Math.round(lastMrr + avgDelta * n)) }));

  topProviders.sort((a, b) => b.fee - a.fee);
  res.json({
    summary: {
      mrr, arr: mrr * 12, mrrPaying, mrrTrial, arrPaying: mrrPaying * 12, totalProviders: tenants.length, active, trialing, canceling, canceled,
      avgTenureDays, churnRate, trialConversion, newThisMonth: signBuckets[months[months.length - 1]] ?? 0,
      gmvBooked: Math.round(gmvBooked), gmvPaid: Math.round(gmvPaid),
    },
    byPlan, byStatus, byType, attribution,
    signupsByMonth, mrrByMonth, mrrPayingByMonth, gmvByMonth, projection,
    topProviders: topProviders.slice(0, 8), atRisk,
  });
});
