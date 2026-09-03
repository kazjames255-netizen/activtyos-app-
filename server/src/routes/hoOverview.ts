import { Router, type Request, type Response } from "express";
import { db } from "../firebase";
import { fromDoc, type BookingDoc } from "../lib/bookingDoc";

// Head-office network overview — the franchisor's command centre. Aggregates the
// WHOLE tenant (every franchise + the HO's own direct operation) into network
// KPIs, a revenue time-series, a per-franchise deep table, an attention list and
// an onboarding pipeline. Company (head office) accounts only. Read-only.
export const hoOverview = Router();

const round2 = (n: number) => Math.round(n * 100) / 100;
const COUNTS = (status: string) => status !== "Cancelled" && status !== "Declined" && status !== "Waitlisted";
const DAY = 86_400_000;

function companyScope(req: Request, res: Response): string | null {
  const auth = req.auth!;
  if (auth.role === "platform") {
    const t = typeof req.query.tenantId === "string" ? req.query.tenantId : null;
    if (!t) { res.status(400).json({ error: "Platform: pass ?tenantId=" }); return null; }
    return t;
  }
  if (auth.role !== "company" || !auth.tenantId) { res.status(403).json({ error: "Requires a head-office (company) account" }); return null; }
  return auth.tenantId;
}

interface FrAgg {
  franchiseId: string; name: string; area: string | null;
  revenue: number; bookings: number; collected: number;
  families: Set<string>; children: Set<string>;
  rev30: number; revPrev30: number;              // trend windows
  lastBookingAt: string | null;
  openIncidents: number;
  territory: string;                              // agreed | proposed | none
  live: boolean;
  perListing: Map<string, { name: string; bookings: number; revenue: number }>;
  perSeason: Map<string, { name: string; bookings: number; revenue: number }>;
}

// child id / lowercased name → owning franchiseId (null = head office), so a
// child-scoped record (incident / medication) can be attributed to a franchise.
async function childFranchiseMap(tenantId: string): Promise<Map<string, string | null>> {
  const [bookingsSnap, listingsSnap] = await Promise.all([
    db.collection("bookings").where("tenantId", "==", tenantId).get(),
    db.collection("listings").where("tenantId", "==", tenantId).get(),
  ]);
  const listingFr = new Map<string, string | null>();
  for (const d of listingsSnap.docs) listingFr.set(d.id, (d.data() as { franchiseId?: string }).franchiseId ?? null);
  const m = new Map<string, string | null>();
  for (const d of bookingsSnap.docs) {
    const b = d.data() as { franchiseId?: string; listingId?: string; child?: string; childId?: string; kids?: { name?: string; childId?: string }[] };
    const fid = b.franchiseId ?? (b.listingId ? (listingFr.get(b.listingId) ?? null) : null);
    const put = (k?: string) => { if (k) m.set(k.trim().toLowerCase(), fid); };
    if (b.childId) m.set(b.childId, fid);
    put(b.child);
    for (const k of b.kids ?? []) { if (k.childId) m.set(k.childId, fid); put(k.name); }
  }
  return m;
}

// GET /api/ho/oversight/:area — read-only safeguarding / medication oversight
// across every franchise. area ∈ incidents | accidents | medication. Each record
// is tagged with the franchise it belongs to (via child→franchise) + a
// per-franchise breakdown. Company (head office) only; never mutates.
hoOverview.get("/oversight/:area", async (req, res) => {
  const tenantId = companyScope(req, res);
  if (!tenantId) return;
  const area = req.params.area;
  if (!["incidents", "accidents", "medication"].includes(area)) { res.status(400).json({ error: "Unknown area" }); return; }

  const [usersSnap, childFr] = await Promise.all([
    db.collection("users").where("tenantId", "==", tenantId).where("role", "==", "franchise").get(),
    childFranchiseMap(tenantId),
  ]);
  const frName = new Map<string, string>();
  for (const d of usersSnap.docs) { const u = d.data(); const fid = (u.franchiseId as string) || d.id; if (!frName.has(fid)) frName.set(fid, (u.franchiseName as string) || (u.name as string) || "Franchise"); }

  const snap = await db.collection(area === "medication" ? "medications" : "incidents").where("tenantId", "==", tenantId).get();
  const now = Date.now();
  const attrib = (childId?: string, childName?: string): string | null => {
    if (childId && childFr.has(childId)) return childFr.get(childId)!;
    if (childName && childFr.has(childName.trim().toLowerCase())) return childFr.get(childName.trim().toLowerCase())!;
    return null;
  };

  let records = snap.docs.map((d) => {
    const r = d.data() as Record<string, unknown> & { kind?: string; childId?: string; childName?: string; date?: string; time?: string; bodyPart?: string; injury?: string; name?: string; dose?: string; status?: string; createdAt?: string; resolvedAt?: string };
    const fid = attrib(r.childId, r.childName);
    const when = r.createdAt || (r.date ? `${r.date}${r.time ? `T${r.time}` : ""}` : null);
    const open = !(r.status === "closed" || r.status === "resolved" || r.resolvedAt);
    return {
      id: d.id, kind: r.kind ?? (area === "medication" ? "medication" : "incident"),
      childName: r.childName ?? "A child",
      franchiseId: fid, franchiseName: fid ? (frName.get(fid) ?? "Franchise") : "Head office",
      when, open,
      // area-specific read-only summary
      ...(area === "medication"
        ? { medicine: r.name ?? "", dose: r.dose ?? "" }
        : { bodyPart: r.bodyPart ?? "", injury: r.injury ?? "", summary: (r.injury as string) || (r.bodyPart as string) || "" }),
    };
  });

  // Area → which incident kinds to include.
  if (area === "accidents") records = records.filter((r) => r.kind === "accident");
  else if (area === "incidents") records = records.filter((r) => r.kind === "incident" || r.kind === "safeguarding");
  records.sort((a, b) => (String(a.when ?? "") < String(b.when ?? "") ? 1 : -1));

  // Per-franchise breakdown (+ head office as null).
  const legend = [...frName.entries()].map(([franchiseId, name]) => ({ franchiseId, name }));
  const bucket = new Map<string, { total: number; open: number; last30: number }>();
  for (const r of records) {
    const key = r.franchiseId ?? "__ho__";
    const b = bucket.get(key) ?? { total: 0, open: 0, last30: 0 };
    b.total += 1; if (r.open) b.open += 1;
    if (r.when && now - Date.parse(String(r.when)) <= 30 * DAY) b.last30 += 1;
    bucket.set(key, b);
  }
  const byFranchise = [
    { franchiseId: null as string | null, name: "Head office (direct)", ...(bucket.get("__ho__") ?? { total: 0, open: 0, last30: 0 }) },
    ...legend.map((l) => ({ franchiseId: l.franchiseId, name: l.name, ...(bucket.get(l.franchiseId) ?? { total: 0, open: 0, last30: 0 }) })),
  ];

  res.json({
    area,
    records,
    byFranchise,
    totals: { records: records.length, open: records.filter((r) => r.open).length, last30: records.filter((r) => r.when && now - Date.parse(String(r.when)) <= 30 * DAY).length },
  });
});

// GET /api/ho/overview — the whole network in one payload.
hoOverview.get("/overview", async (req, res) => {
  const tenantId = companyScope(req, res);
  if (!tenantId) return;

  const [tenant, lib, bookingsSnap, listingsSnap, usersSnap, incidentsSnap, invitesSnap] = await Promise.all([
    db.collection("tenants").doc(tenantId).get(),
    db.collection("libraries").doc(tenantId).get(),
    db.collection("bookings").where("tenantId", "==", tenantId).get(),
    db.collection("listings").where("tenantId", "==", tenantId).get(),
    db.collection("users").where("tenantId", "==", tenantId).get(),
    db.collection("incidents").where("tenantId", "==", tenantId).get(),
    db.collection("invites").where("tenantId", "==", tenantId).get(),
  ]);

  const settings = ((tenant.exists && (tenant.data()!.splitFees as { basis: "revenue" | "perBooking"; rate?: number; perBookingFee?: number })) || null)
    ?? { basis: "revenue" as const, rate: 10, perBookingFee: 0 };

  // Season names (id → name), so a booking's season (= its listing's season) reads as a name.
  const seasonNames = new Map<string, string>();
  for (const s of ((lib.data()?.settings?.seasons as { id: string; name: string }[] | undefined) ?? [])) seasonNames.set(s.id, s.name);

  // listing → { owning franchiseId (null = HO), display name, season id }.
  const listingFr = new Map<string, string | null>();
  const listingMeta = new Map<string, { name: string; season: string | null }>();
  const assignedCount = new Map<string | null, number>();     // listings owned per franchise (incl. £0)
  for (const d of listingsSnap.docs) {
    const l = d.data() as { franchiseId?: string; name?: string; title?: string; season?: string };
    const fid = l.franchiseId ?? null;
    listingFr.set(d.id, fid);
    listingMeta.set(d.id, { name: l.title || l.name || "Listing", season: l.season ?? null });
    assignedCount.set(fid, (assignedCount.get(fid) ?? 0) + 1);
  }

  // Franchises (role:"franchise" users) → identity + territory status.
  const franchises = new Map<string, FrAgg>();
  for (const d of usersSnap.docs) {
    const u = d.data() as { role?: string; franchiseId?: string; franchiseName?: string; name?: string; franchiseArea?: string; franchiseTerritory?: { areas?: unknown[]; status?: string } };
    if (u.role !== "franchise") continue;
    const fid = u.franchiseId ?? d.id;
    if (franchises.has(fid)) continue;
    const terr = u.franchiseTerritory;
    const territory = terr?.status === "agreed" ? "agreed" : (terr?.areas?.length ? "proposed" : "none");
    franchises.set(fid, {
      franchiseId: fid, name: u.franchiseName || u.name || "Franchise", area: u.franchiseArea ?? null,
      revenue: 0, bookings: 0, collected: 0, families: new Set(), children: new Set(),
      rev30: 0, revPrev30: 0, lastBookingAt: null, openIncidents: 0, territory, live: false,
      perListing: new Map(), perSeason: new Map(),
    });
  }

  const now = Date.now();
  // 12 months of history so the client can show this-month / 3m / 6m / 12m, and
  // each month carries a per-franchise bookings + revenue split (fid → figures;
  // "__ho__" = head-office direct).
  const monthKeys: string[] = [];
  for (let i = 11; i >= 0; i--) { const d = new Date(now); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - i); monthKeys.push(d.toISOString().slice(0, 7)); }
  const seriesMap = new Map<string, { revenue: number; bookings: number; byFranchise: Map<string, { bookings: number; revenue: number }> }>(
    monthKeys.map((m) => [m, { revenue: 0, bookings: 0, byFranchise: new Map() }]),
  );

  const direct: FrAgg = { franchiseId: "__ho__", name: "Head office", area: "direct", revenue: 0, bookings: 0, collected: 0, families: new Set(), children: new Set(), rev30: 0, revPrev30: 0, lastBookingAt: null, openIncidents: 0, territory: "n/a", live: false, perListing: new Map(), perSeason: new Map() };

  // child id/name → franchiseId, so incidents (child-scoped) attribute to a franchise.
  const childFr = new Map<string, string | null>();

  for (const doc of bookingsSnap.docs) {
    const raw = doc.data() as BookingDoc & { franchiseId?: string; listingId?: string; childId?: string; kids?: { name?: string; childId?: string }[] };
    const b = fromDoc(raw);
    if (!COUNTS(b.status)) continue;
    const amount = b.amount ?? 0;
    const paid = b.amountPaid ?? (b.pay === "Paid" ? amount : 0);
    const fid = raw.franchiseId ?? (raw.listingId ? (listingFr.get(raw.listingId) ?? null) : null);
    const bucket = fid && franchises.has(fid) ? franchises.get(fid)! : direct;
    bucket.revenue = round2(bucket.revenue + amount);
    bucket.collected = round2(bucket.collected + paid);
    bucket.bookings += 1;
    bucket.live = true;
    if (b.email) bucket.families.add(b.email.toLowerCase());
    // children on this booking (ids preferred, else names)
    const kidKeys = (raw.kids?.length ? raw.kids.map((k) => k.childId || k.name || "") : [raw.childId || b.child || ""]).filter(Boolean);
    for (const k of kidKeys) { bucket.children.add(k); childFr.set(k, fid && franchises.has(fid) ? fid : null); }
    // Per-listing + per-season tallies (top listing / top season insights).
    if (raw.listingId) {
      const meta = listingMeta.get(raw.listingId);
      const lname = meta?.name ?? "Listing";
      const pl = bucket.perListing.get(raw.listingId) ?? { name: lname, bookings: 0, revenue: 0 };
      pl.bookings += 1; pl.revenue = round2(pl.revenue + amount); bucket.perListing.set(raw.listingId, pl);
      if (meta?.season) { const sname = seasonNames.get(meta.season) ?? meta.season; const ps = bucket.perSeason.get(meta.season) ?? { name: sname, bookings: 0, revenue: 0 }; ps.bookings += 1; ps.revenue = round2(ps.revenue + amount); bucket.perSeason.set(meta.season, ps); }
    }
    // trend + series by createdAt
    const created = b.createdAt ? Date.parse(b.createdAt) : NaN;
    if (!Number.isNaN(created)) {
      const age = now - created;
      if (age <= 30 * DAY) bucket.rev30 = round2(bucket.rev30 + amount);
      else if (age <= 60 * DAY) bucket.revPrev30 = round2(bucket.revPrev30 + amount);
      const mk = b.createdAt!.slice(0, 7);
      const s = seriesMap.get(mk);
      if (s) {
        s.revenue = round2(s.revenue + amount); s.bookings += 1;
        const serFid = fid && franchises.has(fid) ? fid : "__ho__";
        const bf = s.byFranchise.get(serFid) ?? { bookings: 0, revenue: 0 };
        bf.bookings += 1; bf.revenue = round2(bf.revenue + amount); s.byFranchise.set(serFid, bf);
      }
      if (!bucket.lastBookingAt || b.createdAt! > bucket.lastBookingAt) bucket.lastBookingAt = b.createdAt!;
    }
  }

  // Open incidents per franchise (safeguarding/accident/incident not resolved).
  let networkOpenIncidents = 0;
  const incidentsByKind = { accident: 0, incident: 0, safeguarding: 0 } as Record<string, number>;
  for (const d of incidentsSnap.docs) {
    const rec = d.data() as { childId?: string; childName?: string; status?: string; kind?: string; resolvedAt?: string };
    const open = !(rec.status === "closed" || rec.status === "resolved" || rec.resolvedAt);
    if (!open) continue;
    networkOpenIncidents += 1;
    if (rec.kind && incidentsByKind[rec.kind] != null) incidentsByKind[rec.kind] += 1;
    const fid = rec.childId ? childFr.get(rec.childId) : (rec.childName ? childFr.get(rec.childName) : undefined);
    if (fid && franchises.has(fid)) franchises.get(fid)!.openIncidents += 1;
  }

  const feeOf = (revenue: number, bookings: number) =>
    settings.basis === "perBooking" ? round2(bookings * (settings.perBookingFee ?? 0)) : round2(revenue * ((settings.rate ?? 0) / 100));

  const pct = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : cur > 0 ? 100 : 0);
  // Top listing (by bookings) + top season (by revenue) + avg booking value.
  const topListing = (f: FrAgg) => { const t = [...f.perListing.values()].sort((a, b) => b.bookings - a.bookings)[0]; return t ? { name: t.name, bookings: t.bookings } : null; };
  const topSeason = (f: FrAgg) => { const t = [...f.perSeason.values()].sort((a, b) => b.revenue - a.revenue)[0]; return t ? { name: t.name, revenue: t.revenue, bookings: t.bookings } : null; };
  const avgBooking = (f: FrAgg) => (f.bookings ? round2(f.revenue / f.bookings) : 0);

  const frList = [...franchises.values()].map((f) => ({
    franchiseId: f.franchiseId, name: f.name, area: f.area,
    revenue: f.revenue, bookings: f.bookings, collected: f.collected, outstanding: round2(f.revenue - f.collected),
    royalty: feeOf(f.revenue, f.bookings),
    families: f.families.size, children: f.children.size,
    trendPct: pct(f.rev30, f.revPrev30), rev30: f.rev30,
    lastBookingAt: f.lastBookingAt, openIncidents: f.openIncidents,
    territory: f.territory, live: f.live,
    listingCount: assignedCount.get(f.franchiseId) ?? 0,
    topListing: topListing(f), topSeason: topSeason(f), avgBooking: avgBooking(f),
  })).sort((a, b) => b.revenue - a.revenue);

  const netRevenue = round2(frList.reduce((s, r) => s + r.revenue, 0) + direct.revenue);
  const netCollected = round2(frList.reduce((s, r) => s + r.collected, 0) + direct.collected);
  const netBookings = frList.reduce((s, r) => s + r.bookings, 0) + direct.bookings;
  const netRoyalty = round2(frList.reduce((s, r) => s + r.royalty, 0));
  const netFamilies = new Set<string>(); const netChildren = new Set<string>();
  for (const f of franchises.values()) { f.families.forEach((x) => netFamilies.add(x)); f.children.forEach((x) => netChildren.add(x)); }
  direct.families.forEach((x) => netFamilies.add(x)); direct.children.forEach((x) => netChildren.add(x));
  const net30 = [...franchises.values()].reduce((s, f) => s + f.rev30, 0) + direct.rev30;
  const netPrev30 = [...franchises.values()].reduce((s, f) => s + f.revPrev30, 0) + direct.revPrev30;

  // Onboarding pipeline: pending franchise invites + franchises not yet live.
  const pendingInvites = invitesSnap.docs
    .map((d) => d.data() as { role?: string; usedBy?: string | null; franchiseName?: string | null; franchiseArea?: string | null; createdAt?: string; token?: string })
    .filter((i) => i.role === "franchise" && !i.usedBy)
    .map((i) => ({ name: i.franchiseName || "Franchise", area: i.franchiseArea ?? null, createdAt: i.createdAt ?? null }));
  const notLive = frList.filter((f) => !f.live).map((f) => ({ franchiseId: f.franchiseId, name: f.name, area: f.area }));

  // Attention list — the things a franchisor should act on, most urgent first.
  const attention: { severity: "high" | "med" | "low"; kind: string; message: string; franchiseId?: string; href?: string }[] = [];
  for (const f of frList) {
    if (f.openIncidents > 0) attention.push({ severity: "high", kind: "safeguarding", franchiseId: f.franchiseId, message: `${f.name}: ${f.openIncidents} open incident${f.openIncidents === 1 ? "" : "s"} to review` });
    if (f.territory === "proposed") attention.push({ severity: "med", kind: "territory-approve", franchiseId: f.franchiseId, message: `${f.name}'s territory is awaiting your approval`, href: "/company/territories" });
    if (f.territory === "none") attention.push({ severity: "med", kind: "territory", franchiseId: f.franchiseId, message: `${f.name} has no agreed territory`, href: "/company/territories" });
    if (f.live && f.trendPct <= -25) attention.push({ severity: "med", kind: "decline", franchiseId: f.franchiseId, message: `${f.name} revenue down ${Math.abs(f.trendPct)}% vs the prior 30 days` });
    if (f.outstanding > 250) attention.push({ severity: "low", kind: "outstanding", franchiseId: f.franchiseId, message: `${f.name}: £${Math.round(f.outstanding)} uncollected` });
  }
  for (const p of pendingInvites) attention.push({ severity: "low", kind: "invite", message: `${p.name}${p.area ? ` · ${p.area}` : ""} — invite sent, awaiting sign-up`, href: "/company/franchise-invites" });
  const sevRank = { high: 0, med: 1, low: 2 } as const;
  attention.sort((a, b) => sevRank[a.severity] - sevRank[b.severity]);

  res.json({
    settings,
    network: {
      revenue: netRevenue, collected: netCollected, outstanding: round2(netRevenue - netCollected),
      bookings: netBookings, royalty: netRoyalty,
      families: netFamilies.size, children: netChildren.size,
      franchises: frList.length, liveFranchises: frList.filter((f) => f.live).length,
      pendingInvites: pendingInvites.length,
      avgPerFranchise: frList.length ? round2(netRevenue / frList.length) : 0,
      revenueTrendPct: pct(net30, netPrev30), rev30: round2(net30),
      openIncidents: networkOpenIncidents, incidentsByKind,
    },
    // 12-month series; each month has network totals + a per-franchise split
    // (fid → {bookings, revenue}); "__ho__" is head-office direct.
    series: monthKeys.map((m) => {
      const s = seriesMap.get(m)!;
      const byFranchise: Record<string, { bookings: number; revenue: number }> = {};
      for (const [fid, v] of s.byFranchise) byFranchise[fid] = v;
      return { month: m, revenue: s.revenue, bookings: s.bookings, byFranchise };
    }),
    // Legend for the split charts: every franchise + head-office direct, in the
    // league order the client colours by.
    seriesLegend: [...frList.map((f) => ({ franchiseId: f.franchiseId, name: f.name })), { franchiseId: "__ho__", name: "Head office (direct)" }],
    franchises: frList,
    direct: { revenue: direct.revenue, bookings: direct.bookings, collected: direct.collected, families: direct.families.size, children: direct.children.size, live: direct.live, listingCount: assignedCount.get(null) ?? 0, topListing: topListing(direct), topSeason: topSeason(direct), avgBooking: avgBooking(direct) },
    onboarding: { pendingInvites, notLive },
    attention,
  });
});
