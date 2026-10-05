import { Router, type Request } from "express";
import { z } from "zod";
import { db } from "../firebase";
import { FieldValue } from "firebase-admin/firestore";
import { librarySnap, libraryDocId } from "../lib/tenantLibrary";
import { canWrite } from "../middleware/role";
import { isFranchise, visibleToFranchise } from "../lib/franchiseScope";
import { blockSummary, type BlockDoc } from "../lib/blockDomain";
import { desiredRuns, syncListingBlocks, bookedDatesDropped } from "../lib/listingRuns";
import { resolveBundlePricing, type BundleDoc, type PassDoc, type PeriodDoc } from "../lib/bundlePricing";
import { mealDayPlan } from "../lib/mealPlan";
import { ukToday } from "../lib/ukDate";
import { passCap, bookingHasPass } from "../lib/passBooking";
import { fromDoc, type BookingDoc } from "../lib/bookingDoc";
import { isBrowsable, directLinkVisible } from "../lib/listingVisibility";
import { earlyBirdScopeOf, earlyFixedUsed } from "../lib/earlyBird";
import { accessFor, subscriptionState } from "../middleware/subscription";

export const listings = Router();

const col = db.collection("listings");

// GET /api/listings is mounted BEFORE the /api-wide enforceSubscription wall
// on purpose (parents browse listings whether or not the provider's bill is
// current) — but that also let a read-only/locked tenant keep creating and
// editing listings, since the wall never ran for this router at all. Writes
// here follow the same mode the rest of the API enforces (p2-m28/p2-m29).
const TEAM_ROLES = new Set(["freelancer", "company", "franchise", "staff"]);
async function subscriptionRefusal(req: Request): Promise<string | null> {
  const auth = req.auth;
  if (!auth || !TEAM_ROLES.has(auth.role) || !auth.tenantId) return null;
  const { mode } = accessFor(await subscriptionState(auth.tenantId));
  if (mode === "readonly") return "Your provider's ActivityOS payment is overdue, so listings are read-only for now.";
  if (mode === "locked") return "Your provider's ActivityOS subscription has ended, so listings can't be changed right now.";
  return null;
}

// ── Schema ────────────────────────────────────────────────────────────────
// A listing stores the builder's draft near-verbatim (the WizardDraft shape
// in features/listings/ListingWizard.tsx) so the customer page a parent sees
// is exactly what the operator previewed. `name` + `passes` are kept for
// compatibility: `name` mirrors `title`, `passes` is the priced-tickets
// snapshot written by the Blocks builder's "send to listings".
//
// Images must be uploaded first (POST /api/uploads) — data URLs are rejected
// here so a listing document can never blow Firestore's 1MB limit.

import { baseListingSchema, createSchema, publishProblems, RUN_FIELDS, runRecipeOf, type ListingInput } from "../lib/listingRules";

// Join each listing's real blocks (availability included) onto the response.
// Only the blocks for the listings being returned are read — this used to scan
// the whole `blocks` collection (every tenant's) on every listings request,
// which got slower as the platform grew.
const IN_CHUNK = 30; // Firestore's max values per `in` filter

async function withBlocks(
  docs: { id: string; data: Record<string, unknown> }[],
): Promise<Record<string, unknown>[]> {
  const byListing = new Map<string, ReturnType<typeof blockSummary>[]>();
  const ids = docs.map((d) => d.id);
  if (ids.length) {
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += IN_CHUNK) chunks.push(ids.slice(i, i + IN_CHUNK));
    const snaps = await Promise.all(
      chunks.map((c) => db.collection("blocks").where("listingId", "in", c).get()),
    );
    for (const snap of snaps) {
      for (const d of snap.docs) {
        const b = d.data() as BlockDoc;
        const arr = byListing.get(b.listingId) ?? [];
        arr.push(blockSummary(d.id, b));
        byListing.set(b.listingId, arr);
      }
    }
  }
  // Per-pass caps: which dates each capped pass has no place left on, so the
  // parent UI can show that pass as full (the booking API enforces the same).
  const fullByListing = new Map<string, Record<string, string[]>>();
  const capped = docs.filter((d) => Object.values((d.data.ticketOverrides as Record<string, { capacity?: string }> | undefined) ?? {}).some((o) => (passCap(o?.capacity) ?? 0) > 0));
  const blockIds = capped.flatMap((d) => (byListing.get(d.id) ?? []).map((b) => b.id));
  if (blockIds.length) {
    const chunks: string[][] = [];
    for (let i = 0; i < blockIds.length; i += IN_CHUNK) chunks.push(blockIds.slice(i, i + IN_CHUNK));
    const live = new Set(["Confirmed", "Approval needed", "Offered"]);
    const snaps = await Promise.all(chunks.map((c) => db.collection("bookings").where("blockId", "in", c).get()));
    const bks = snaps.flatMap((sn) => sn.docs.map((x) => fromDoc(x.data() as BookingDoc))).filter((b) => live.has(b.status as string));
    for (const d of capped) {
      const ids = new Set((byListing.get(d.id) ?? []).map((b) => b.id));
      const ov = d.data.ticketOverrides as Record<string, { capacity?: string }>;
      const out: Record<string, string[]> = {};
      for (const [name, o] of Object.entries(ov)) {
        const cap = passCap(o?.capacity);
        if (cap === null || cap <= 0) continue;
        const held: Record<string, number> = {};
        for (const b of bks) {
          if (!b.blockId || !ids.has(b.blockId) || !bookingHasPass(b.pass, name)) continue;
          const seats = Math.max(1, (b as { kids?: unknown[] }).kids?.length ?? 1);
          const sess = (byListing.get(d.id) ?? []).find((x) => x.id === b.blockId)?.sessions.map((s) => s.date) ?? [];
          for (const day of b.days ?? sess) held[day] = (held[day] ?? 0) + seats;
        }
        const full = Object.keys(held).filter((day) => held[day] >= cap).sort();
        if (full.length) out[name] = full;
      }
      if (Object.keys(out).length) fullByListing.set(d.id, out);
    }
  }
  return docs.map((d) => ({
    id: d.id,
    ...d.data,
    ...(fullByListing.has(d.id) ? { passFullDates: fullByListing.get(d.id) } : {}),
    blocks: (byListing.get(d.id) ?? []).sort((a, b) => (a.startDate < b.startDate ? -1 : 1)),
  }));
}

// GET /api/listings — the browse feed: LIVE, PUBLIC, unarchived listings from
// every provider (feeds the parent marketplace). `hidden` means unlisted, not
// private — those listings only come back from GET /api/listings/:id (the
// direct link). With ?mine=1, ALL of the caller's own tenant's listings
// (drafts and hidden included — the operator management view).
listings.get("/", async (req, res) => {
  if (req.query.mine === "1") {
    const auth = req.auth!;
    if (!auth.tenantId) {
      res.status(403).json({ error: "Requires an operator account with a tenant" });
      return;
    }
    const snap = await col.where("tenantId", "==", auth.tenantId).get();
    // A franchise manages only its OWN listings; the head office sees all (with
    // each listing's franchiseId so it can show an owner column / assign).
    // A franchise's own STAFF are scoped the same way (they carry its franchiseId) —
    // matching on auth.role alone let them list head office's and sibling franchises' listings.
    const docs = isFranchise(auth)
      ? snap.docs.filter((d) => (d.data() as { franchiseId?: string | null }).franchiseId === auth.franchiseId)
      : snap.docs;
    const list = await withBlocks(docs.map((d) => ({ id: d.id, data: d.data() })));
    list.sort((a, b) => ((a.name as string) < (b.name as string) ? -1 : 1));
    res.json(list);
    return;
  }
  // ?tenantId= narrows the public feed to ONE provider — the storefront
  // page and embed widget use it ("all of this provider's activities").
  const tenantFilter = typeof req.query.tenantId === "string" ? req.query.tenantId : null;
  const snap = await col.orderBy("name").get();
  let visible = snap.docs.filter((d) => {
    const l = d.data();
    if (tenantFilter && l.tenantId !== tenantFilter) return false;
    // Production guard: a listing only reaches a family when it's genuinely
    // finished — a real title, live, public, not archived. A seeded stub or
    // half-built draft with no title never leaks to the marketplace. (The
    // `?? "live"` default stays for legacy titled listings; bookability — at
    // least one block — is enforced below, once blocks are joined.)
    return isBrowsable(l);
  });

  // Marketplace opt-in. The cross-provider feed (no ?tenantId) shows only
  // providers who've switched on `settings.marketplaceListed` — plus, for a
  // signed-in parent, their OWN providers (anyone they've booked) regardless.
  // A provider's own storefront (?tenantId=) is unaffected: their public
  // listings always show there.
  if (!tenantFilter) {
    const tids = [...new Set(visible.map((d) => d.data().tenantId).filter(Boolean) as string[])];
    const libSnaps = await Promise.all(tids.map((id) => db.collection("libraries").doc(id).get()));
    const allowed = new Set(
      libSnaps
        .filter((s) => ((s.data()?.settings as { marketplaceListed?: boolean } | undefined)?.marketplaceListed) === true)
        .map((s) => s.id),
    );
    const email = req.user?.email?.toLowerCase();
    if (email) {
      const mine = await db.collection("bookings").where("email", "==", email).get();
      for (const b of mine.docs) { const t = b.data().tenantId as string | undefined; if (t) allowed.add(t); }
    }
    visible = visible.filter((d) => allowed.has(d.data().tenantId as string));
  }

  // Resolve each listing's category ids to their names, and its venue id to a
  // location — the browse page filters by both. Names live per tenant in the
  // library, so batch a library read per distinct tenant and build the maps.
  const tenantIds = [...new Set(visible.map((d) => d.data().tenantId).filter(Boolean))];
  const libs = await Promise.all(tenantIds.map((id) => db.collection("libraries").doc(id).get()));
  const catNames = new Map<string, Map<string, string>>();
  const venueById = new Map<string, Map<string, { name: string; address?: string; city?: string; lat?: number; lng?: number }>>();
  const seasonNames = new Map<string, Map<string, string>>(); // tenant → seasonId → name
  const payMethodsByTenant = new Map<string, string[]>();     // tenant → accepted payment methods
  const displayNameByTenant = new Map<string, string>();      // tenant → the name families see (Setup → Display name)
  // A franchise's seasons / categories / venues live in ITS OWN library, not head office's: read those too (keyed by franchise id).
  // (The franchise doc id is `${tenantId}__fr__${franchiseId}` — see lib/tenantLibrary.libraryDocId — and a listing's franchiseId alone isn't that id.)
  const frPairs = [...new Map(visible.filter((d) => !!d.data().franchiseId).map((d) => [d.data().franchiseId as string, d.data().tenantId as string])).entries()];
  const franchiseIds = frPairs.map(([f]) => f);
  const franchiseLibs = await Promise.all(frPairs.map(([f, t]) => db.collection("libraries").doc(libraryDocId(t, f)).get()));
  const libKeys = [...tenantIds, ...franchiseIds];
  const allLibs = [...libs, ...franchiseLibs];
  allLibs.forEach((snap, i) => {
    const data = snap.data() ?? {};
    const cats = (data.categories ?? []) as { id: string; name: string }[];
    const venues = (data.venues ?? []) as { id: string; name: string; address?: string; city?: string; lat?: number; lng?: number }[];
    const settings = (data.settings ?? {}) as { seasons?: { id: string; name: string }[]; payMethods?: string[] };
    catNames.set(libKeys[i], new Map(cats.map((c) => [c.id, c.name])));
    venueById.set(libKeys[i], new Map(venues.map((v) => [v.id, { name: v.name, address: v.address, city: v.city, lat: v.lat, lng: v.lng }])));
    seasonNames.set(libKeys[i], new Map((settings.seasons ?? []).map((s) => [s.id, s.name])));
    payMethodsByTenant.set(libKeys[i], settings.payMethods ?? []);
    if (typeof (settings as { providerName?: string }).providerName === "string" && (settings as { providerName?: string }).providerName!.trim()) displayNameByTenant.set(libKeys[i], (settings as { providerName?: string }).providerName!.trim());
  });

  // Advertisable discounts live on the listing itself (`discounts` = the rules the
  // provider set in the Discounts step — siblings, multi-day, early bird). These
  // apply automatically, so they're safe to show. We do NOT advertise discount
  // CODES (entered at checkout; some are personal/referral codes).
  type Rule = { name?: string; method?: string; value?: number; moreThan?: number; kind?: string; enabled?: boolean; beforeDate?: string };
  const ruleOffer = (r: Rule): { label: string; percent?: number } => {
    const pct = r.method === "percent";
    const amt = r.method === "subtract" ? `£${r.value} off` : pct ? `${r.value}% off` : `£${r.value} each`;
    const label = r.name && r.name.trim() ? r.name.trim() : amt;
    return { label, percent: pct ? r.value : undefined };
  };

  // Bundle timings (periods) per listing — the real "Choose a timing" options,
  // so the card shows every timing, not just what the sessions happened to store.
  const fmtT = (hhmm?: string): string | null => {
    const m = /^(\d{1,2}):(\d{2})/.exec(hhmm ?? "");
    if (!m) return null;
    let h = Number(m[1]); const mn = Number(m[2]); const ap = h < 12 ? "am" : "pm"; h = h % 12 || 12;
    return mn ? `${h}:${String(mn).padStart(2, "0")}${ap}` : `${h}${ap}`;
  };
  const bundleIds = [...new Set(visible.map((d) => d.data().blockId).filter(Boolean) as string[])];
  const bundleSnaps = await Promise.all(bundleIds.map((id) => db.collection("blockBundles").doc(id).get()));
  const bundlePeriodIds = new Map<string, string[]>();
  const allPeriodIds = new Set<string>();
  bundleSnaps.forEach((s) => { if (s.exists) { const pids = ((s.data() as { periodIds?: string[] }).periodIds) ?? []; bundlePeriodIds.set(s.id, pids); pids.forEach((p) => allPeriodIds.add(p)); } });
  const periodSnaps = await Promise.all([...allPeriodIds].map((id) => db.collection("periods").doc(id).get()));
  const periodLabel = new Map<string, string>();
  periodSnaps.forEach((s) => { if (s.exists) { const p = s.data() as PeriodDoc; const a = fmtT(p.start); const z = fmtT(p.finish); if (a && z) periodLabel.set(s.id, `${a} – ${z}`); } });
  const timingsFor = (bid?: string): string[] => (bid ? (bundlePeriodIds.get(bid) ?? []) : []).map((pid) => periodLabel.get(pid)).filter((x): x is string => !!x);

  // A listing only reaches the marketplace while it still has a run that hasn't
  // finished. Past-only listings (every block ended) have nothing to book, so
  // they drop out of Browse automatically — no manual un-publishing needed.
  const todayYmd = ukToday();
  const hasUpcomingBlock = (blocks: unknown[]) =>
    (blocks as { endDate?: string }[]).some((b) => (b.endDate ?? "") >= todayYmd);
  const list = (await withBlocks(visible.map((d) => ({ id: d.id, data: d.data() }))))
    // Bookability guard: at least one block (a dated run with sessions) that
    // hasn't already ended — otherwise there's literally nothing to book.
    .filter((l) => Array.isArray(l.blocks) && (l.blocks as unknown[]).length > 0 && hasUpcomingBlock(l.blocks as unknown[]));
  res.json(
    list.map((l) => {
      const libOf = (m: Map<string, Map<string, any>>) => (l.franchiseId ? m.get(l.franchiseId as string) : undefined);
      const byCat = catNames.get(l.tenantId as string);
      // Prefer the names denormalised onto the listing at save; fall back to a
      // live id→name resolve for listings saved before that field existed.
      const stored = l.categoryNames as string[] | undefined;
      const categories = stored ?? ((l.categoryIds as string[]) ?? [])
        .map((id) => libOf(catNames)?.get(id) ?? byCat?.get(id))
        .filter((n): n is string => !!n);
      const venue = libOf(venueById)?.get(l.venueId as string) ?? venueById.get(l.tenantId as string)?.get(l.venueId as string);
      // Normalise the display title: older listings stored it as `name`, newer
      // ones as `title`. The browse UI reads `title`, so fall back to `name`
      // rather than showing a blank card.
      const title = ((l.title as string) ?? (l.name as string) ?? "").trim();
      const season = l.seasonId ? (libOf(seasonNames)?.get(l.seasonId as string) ?? seasonNames.get(l.tenantId as string)?.get(l.seasonId as string) ?? null) : null;
      // Advertisable discounts on this listing, best % first so the top chip
      // always matches the "SAVE %" ribbon.
      // An early-bird whose book-by date has passed isn't a saving on offer —
      // checkout won't give it, so don't advertise it (acceptance d4s2).
      const rules = ((l.discounts as Rule[] | undefined) ?? []).filter((r) => r.enabled !== false && !(r.kind === "early" && r.beforeDate && r.beforeDate < ukToday()));
      const offers = rules.map(ruleOffer).sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0));
      const bestOfferPercent = offers.reduce((m, o) => (o.percent && o.percent > m ? o.percent : m), 0) || null;
      const pm = payMethodsByTenant.get(l.tenantId as string) ?? [];
      const acceptsTFC = pm.includes("Tax-Free Childcare");
      const acceptsVouchers = pm.includes("Childcare vouchers");
      const timings = timingsFor(l.blockId as string | undefined);
      // The provider's current display name, not the one frozen on the listing
      // when it was created (acceptance d1s4).
      return { ...l, tenantName: displayNameByTenant.get(l.tenantId as string) ?? l.tenantName, title, categories, season, offers, bestOfferPercent, acceptsTFC, acceptsVouchers, timings, location: venue?.name ?? null, address: venue?.address ?? null, city: venue?.city ?? null, lat: venue?.lat ?? null, lng: venue?.lng ?? null };
    }),
  );
});

// GET /api/listings/:id — the direct link (`/book/{id}` reads this). Returns
// hidden listings too (hidden = unlisted but bookable by link). Drafts and
// archived listings only exist for their own tenant (and platform).
// Embeds everything the customer page needs beyond the doc itself:
//   blocks   — dated runs with availability
//   bundle   — the block bundle's passes/timings, server-priced
//   library  — the tenant's venue/add-ons/staff/categories the listing uses
listings.get("/:id", async (req, res) => {
  const snap = await col.doc(req.params.id).get();
  if (!snap.exists) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }
  const l = snap.data()!;
  const auth = req.auth!;
  // "Own" = your tenant — but a franchise (and its staff) only owns ITS listings: drafts / hidden
  // ones of head office or a sibling franchise stay private to them.
  const own = auth.role === "platform" || (auth.tenantId && auth.tenantId === l.tenantId && (!isFranchise(auth) || (l.franchiseId ?? null) === auth.franchiseId));
  if (!directLinkVisible(l, !!own)) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }

  const [joined] = await withBlocks([{ id: snap.id, data: l }]);

  // Block-bundle pricing (passes × timings), resolved server-side.
  let bundle: unknown = null;
  if (l.blockId) {
    const bSnap = await db.collection("blockBundles").doc(l.blockId).get();
    if (bSnap.exists && bSnap.data()!.tenantId === l.tenantId) {
      const b = bSnap.data() as BundleDoc;
      const [periodSnaps, passSnaps] = await Promise.all([
        Promise.all((b.periodIds ?? []).map((id: string) => db.collection("periods").doc(id).get())),
        Promise.all((b.passIds ?? []).map((id: string) => db.collection("passes").doc(id).get())),
      ]);
      const periodsById = new Map(
        periodSnaps
          .filter((s) => s.exists && s.data()!.tenantId === l.tenantId)
          .map((s) => [s.id, { id: s.id, ...(s.data() as PeriodDoc) }]),
      );
      const passesById = new Map(
        passSnaps
          .filter((s) => s.exists && s.data()!.tenantId === l.tenantId)
          .map((s) => [s.id, { id: s.id, ...(s.data() as PassDoc) }]),
      );
      const resolved = resolveBundlePricing(b, passesById, periodsById);
      bundle = {
        id: bSnap.id,
        name: b.name,
        passes: resolved.passes,
        timings: resolved.timings,
        periods: [...periodsById.values()].map((p) => ({
          id: p.id,
          title: p.title,
          start: p.start,
          finish: p.finish,
        })),
      };
    }
  }

  // The slice of the tenant's library this listing references.
  // A franchise's listing shows ITS venues, add-ons and staff — the franchise
  // keeps its own library; reading head office's lost everything it added.
  const libSnap = await librarySnap(l.tenantId, (l.franchiseId as string | null | undefined) ?? null);
  const libData = libSnap.exists ? (libSnap.data() as Record<string, unknown>) : {};
  const lib = libData as Record<string, { id: string }[]>;
  const pick = (arr: { id: string }[] | undefined, ids: string[] | undefined) =>
    (arr ?? []).filter((x) => (ids ?? []).includes(x.id));
  const library = {
    venue: (lib.venues ?? []).find((v) => v.id === l.venueId) ?? null,
    addons: pick(lib.addons, l.addonIds as string[]),
    staff: pick(lib.staff, l.staffIds as string[]),
    categories: lib.categories ?? [],
  };

  // Meals: resolve the saved menus this listing's mealPlan references, so the
  // parent can see each day's menu + allergens at checkout without hitting the
  // operator-only /api/meal-menus endpoint. Only the menus actually used are
  // embedded (deduped by id).
  let mealMenus: unknown[] = [];
  if (l.mealsEnabled && l.mealPlan && typeof l.mealPlan === "object") {
    const ids = [...new Set(Object.values(l.mealPlan as Record<string, unknown>).map((v) => mealDayPlan(v)?.menuId).filter((v): v is string => !!v))];
    if (ids.length) {
      const menuSnaps = await Promise.all(ids.map((id) => db.collection("mealMenus").doc(id).get()));
      mealMenus = menuSnaps
        .filter((s) => s.exists && s.data()!.tenantId === l.tenantId)
        .map((s) => ({ id: s.id, name: s.data()!.name, items: s.data()!.items ?? [] }));
    }
  }

  // Parents see the provider's chosen public name (own name vs business name,
  // set at onboarding) rather than the business name denormalised onto the
  // listing at creation. Falls back to that stored name when unset.
  const providerName = (libData.settings as { providerName?: string } | undefined)?.providerName?.trim();
  // A signed-in family that already used a fixed-£ early bird this season: the booking page prices without it, as checkout will.
  const hasFixedEarly = ((l.discounts as { kind?: string; enabled?: boolean; method?: string }[] | undefined) ?? []).some((r) => r.kind === "early" && r.enabled !== false && r.method !== "percent");
  const earlyUsed = hasFixedEarly && req.user?.email ? await earlyFixedUsed(l.tenantId as string, req.user.email.toLowerCase(), earlyBirdScopeOf(snap.id, l.seasonId as string | undefined)) : false;
  res.json({ ...joined, tenantName: providerName || joined.tenantName, bundle, library, mealMenus, ...(earlyUsed ? { earlyFixedUsed: true } : {}) });
});

// Operators manage their own tenant's listings. (Bookings keep a denormalised
// listing name, so editing/deleting a listing never corrupts past bookings.)

// Resolve category ids to their current names from the tenant's library and
// store them ON the listing. Category ids are volatile — the freelancer app
// regenerates them whenever it re-seeds (e.g. localStorage cleared), which
// orphans any listing referencing the old ids and makes their tags silently
// vanish from Browse. Denormalising the names at save time means a listing
// carries its own labels and never depends on that fragile join surviving.
async function categoryNamesFor(tenantId: string, categoryIds: unknown): Promise<string[]> {
  const ids = Array.isArray(categoryIds) ? (categoryIds as string[]) : [];
  if (!ids.length) return [];
  const lib = (await db.collection("libraries").doc(tenantId).get()).data() ?? {};
  const byId = new Map(((lib.categories ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
  return ids.map((id) => byId.get(id)).filter((n): n is string => !!n);
}

/** A listing may only point at a ticket bundle / meal menu its OWNER can use. Same tenant is not enough: a franchise
 *  that pasted head office's (or a sibling's) bundle id got that bundle's name, timings and passes published on its
 *  own listing. Head office / freelancers are unrestricted within their tenant. */
async function foreignRefProblem(auth: Parameters<typeof visibleToFranchise>[0], tenantId: string, data: { blockId?: string | null; mealPlan?: Record<string, unknown> }): Promise<string | null> {
  if (data.blockId) {
    const b = await db.collection("blockBundles").doc(data.blockId).get();
    if (!b.exists || b.get("tenantId") !== tenantId || !(await visibleToFranchise(auth, b.data() as { franchiseId?: string | null; createdBy?: string | null }))) return "Unknown ticket bundle (it must be one of yours)";
  }
  const menuIds = new Set<string>();
  for (const v of Object.values(data.mealPlan ?? {})) {
    const id = typeof v === "string" ? v : (v as { menuId?: string } | null)?.menuId;
    if (id) menuIds.add(id);
  }
  for (const id of menuIds) {
    const m = await db.collection("mealMenus").doc(id).get();
    if (!m.exists || m.get("tenantId") !== tenantId || !(await visibleToFranchise(auth, m.data() as { franchiseId?: string | null; createdBy?: string | null }))) return "Unknown meal menu (it must be one of yours)";
  }
  return null;
}

listings.post("/", async (req, res) => {
  const auth = req.auth!;
  if (!canWrite(auth.role) || !auth.tenantId) {
    res.status(403).json({ error: "Requires an operator account with a tenant" });
    return;
  }
  const subRefusal = await subscriptionRefusal(req);
  if (subRefusal) { res.status(402).json({ error: subRefusal }); return; }
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  const tenant = await db.collection("tenants").doc(auth.tenantId).get();
  const data = parsed.data;
  { const bad = personRuleProblem(data.discounts, undefined); if (bad) { res.status(400).json({ error: bad }); return; } }
  { const bad = await foreignRefProblem(auth, auth.tenantId, data); if (bad) { res.status(400).json({ error: bad }); return; } }
  if (data.status === "live") {
    const problems = publishProblems(data as Record<string, unknown>);
    if (problems.length) {
      res.status(400).json({ error: `Can't publish yet — this listing needs ${problems.join(", ")}.` });
      return;
    }
  }
  const name = (data.title ?? data.name)!;
  const doc = {
    ...data,
    name,
    title: data.title ?? data.name,
    passes: data.passes ?? [],
    status: data.status ?? "draft",
    visibility: data.visibility ?? "public",
    categoryNames: await categoryNamesFor(auth.tenantId, data.categoryIds),
    tenantId: auth.tenantId,
    tenantName: tenant.exists ? tenant.data()!.name : "Unknown provider",
    // Franchise ownership: a listing created by a franchise belongs to that
    // franchise, so every booking on it (whoever makes it) is attributed to
    // them (split-fees, territory). HO/company/freelancer listings = null.
    franchiseId: auth.role === "franchise" ? auth.franchiseId : null,
    // Optimistic-concurrency stamp — see PUT /:id below.
    updatedAt: Date.now(),
  };
  const ref = await col.add(doc);
  await syncListingBlocks(ref.id, auth.tenantId, runRecipeOf(doc));
  res.status(201).json({ id: ref.id, ...doc });
});


// Multi-person (sibling) discounts are percentage-only: a £ amount is taken per child per line, so a family
// could split a week into single days and out-discount the weekly pass. Rules already saved with another
// method keep working (stored id + method unchanged); only NEW or CHANGED ones are refused.
function personRuleProblem(next: unknown, stored: unknown): string | null {
  const have = new Map(((stored as { id?: string; method?: string; value?: number }[] | undefined) ?? []).map((r) => [r.id, r]));
  for (const r of (next as { id: string; kind: string; method: string; value: number }[] | undefined) ?? []) {
    if (r.kind !== "person" || r.method === "percent") continue;
    const old = have.get(r.id);
    if (!old || old.method !== r.method || old.value !== r.value) return "A multi-person discount must be a percentage (a fixed £ amount per child can be beaten by splitting a week into single days).";
  }
  return null;
}

// Load a listing and verify it belongs to the caller's tenant.
async function ownListing(req: Request, id: string) {
  const auth = req.auth!;
  if (!canWrite(auth.role) || !auth.tenantId) return { status: 403 as const };
  const snap = await col.doc(id).get();
  if (!snap.exists) return { status: 404 as const };
  if (snap.data()!.tenantId !== auth.tenantId) return { status: 404 as const };
  // A franchise may only edit/delete listings IT owns — never the head office's
  // or a sibling franchise's.
  if (auth.role === "franchise" && (snap.data()!.franchiseId ?? null) !== auth.franchiseId) return { status: 404 as const };
  return { status: 200 as const, snap };
}

listings.put("/:id", async (req, res) => {
  const own = await ownListing(req, req.params.id);
  if (own.status !== 200) {
    res
      .status(own.status)
      .json({ error: own.status === 403 ? "Requires an operator account" : "Listing not found" });
    return;
  }
  const subRefusal = await subscriptionRefusal(req);
  if (subRefusal) { res.status(402).json({ error: subRefusal }); return; }
  const parsed = baseListingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues });
    return;
  }
  { const bad = personRuleProblem(parsed.data.discounts, own.snap.data()!.discounts); if (bad) { res.status(400).json({ error: bad }); return; } }
  // Optimistic concurrency: two tabs autosaving the SAME listing used to be
  // silent last-writer-wins on the WHOLE document — Tab B's stale save could
  // revert Tab A's title change with no warning. The wizard sends back the
  // `updatedAt` it last loaded/saved (not part of baseListingSchema, read
  // raw); if the document has since moved on, refuse the write instead of
  // clobbering it. A doc saved before this stamp existed has no updatedAt —
  // nothing to compare against, so that first save always goes through.
  const clientUpdatedAt = (req.body as Record<string, unknown>).expectedUpdatedAt;
  const serverUpdatedAt = own.snap.data()!.updatedAt;
  if (typeof clientUpdatedAt === "number" && typeof serverUpdatedAt === "number" && clientUpdatedAt !== serverUpdatedAt) {
    res.status(409).json({
      error: "This listing changed elsewhere since you last loaded it. Refresh to see the latest version before saving.",
      code: "stale_listing",
      current: { id: own.snap.id, ...own.snap.data()! },
    });
    return;
  }
  const data: ListingInput = parsed.data;
  { // Only ids CHANGED vs the stored listing are checked — inherited head-office bundle/menu ids must not block an unrelated edit.
    const stored = own.snap.data() as { blockId?: string | null; mealPlan?: Record<string, unknown> };
    const menuOf = (v: unknown) => (typeof v === "string" ? v : (v as { menuId?: string } | null)?.menuId);
    const oldMenus = new Set(Object.values(stored.mealPlan ?? {}).map(menuOf));
    const mealPlan = data.mealPlan ? Object.fromEntries(Object.entries(data.mealPlan).filter(([, v]) => !oldMenus.has(menuOf(v)))) : undefined;
    const bad = await foreignRefProblem(req.auth!, req.auth!.tenantId!, { blockId: data.blockId && data.blockId !== stored.blockId ? data.blockId : null, mealPlan }); if (bad) { res.status(400).json({ error: bad }); return; } }
  if (data.status === "live") {
    const problems = publishProblems({ ...own.snap.data()!, ...data });
    if (problems.length) {
      res.status(400).json({ error: `Can't publish yet — this listing needs ${problems.join(", ")}.` });
      return;
    }
  }
  const patch: Record<string, unknown> = { ...data, updatedAt: Date.now() };
  // Head office (company) / platform can ASSIGN or reassign a listing to a
  // franchise (or back to "own" with null). A franchise can never change ownership.
  if ((req.auth!.role === "company" || req.auth!.role === "platform") && "franchiseId" in (req.body as Record<string, unknown>)) {
    const fid = (req.body as { franchiseId?: string | null }).franchiseId;
    patch.franchiseId = typeof fid === "string" && fid.trim() ? fid.trim() : null;
  }
  if (data.title ?? data.name) {
    patch.name = data.title ?? data.name;
    patch.title = data.title ?? data.name;
  }
  // Re-denormalise the category labels whenever the tags change, so the stored
  // names stay in step with the picks.
  if ("categoryIds" in data) {
    patch.categoryNames = await categoryNamesFor(own.snap.data()!.tenantId as string, data.categoryIds);
  }
  const merged = { ...own.snap.data()!, ...patch };
  // Refuse — BEFORE anything is written — an edit that would take a date off
  // while children are booked on it (lib/listingRuns bookedDatesDropped).
  if (RUN_FIELDS.some((f) => f in data)) {
    const dropped = await bookedDatesDropped(own.snap.id, req.auth!.tenantId!, runRecipeOf(merged));
    if (dropped.length) {
      const nice = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).replace(",", "");
      const list = dropped.slice(0, 6).map((d) => `${nice(d.date)} (${d.booked} booked)`).join(", ");
      res.status(409).json({
        error: `This change removes ${dropped.length === 1 ? "a date" : "dates"} that children are booked on: ${list}${dropped.length > 6 ? "…" : ""}. Move or cancel those bookings first — removing the date would delete that day's register.`,
        droppedDates: dropped,
      });
      return;
    }
  }
  await own.snap.ref.update(patch);
  // Reassigning a listing to another franchise (or back to head office) moves its EXISTING bookings with it: bookings
  // carry their own franchiseId (the franchise Bookings / Families / register lists filter on it), so without this the
  // new owner is credited the royalty and sessions but can't see or run the children already booked on them.
  if ("franchiseId" in patch && ((patch.franchiseId as string | null) ?? null) !== ((own.snap.data()!.franchiseId as string | null | undefined) ?? null)) {
    // Parent checkouts carry listingId; operator-taken bookings carry only blockId — match both.
    const tid = req.auth!.tenantId!;
    const blockIds = (await db.collection("blocks").where("tenantId", "==", tid).where("listingId", "==", own.snap.id).get()).docs.map((d) => d.id);
    const found = new Map<string, FirebaseFirestore.DocumentReference>();
    for (const d of (await db.collection("bookings").where("tenantId", "==", tid).where("listingId", "==", own.snap.id).get()).docs) found.set(d.id, d.ref);
    for (let i = 0; i < blockIds.length; i += 30)
      for (const d of (await db.collection("bookings").where("tenantId", "==", tid).where("blockId", "in", blockIds.slice(i, i + 30)).get()).docs) found.set(d.id, d.ref);
    const refs = [...found.values()];
    for (let i = 0; i < refs.length; i += 400) {
      const batch = db.batch();
      for (const r of refs.slice(i, i + 400)) batch.update(r, { franchiseId: (patch.franchiseId as string | null) ?? FieldValue.delete() });
      await batch.commit();
    }
  }
  if (RUN_FIELDS.some((f) => f in data)) {
    await syncListingBlocks(own.snap.id, req.auth!.tenantId!, runRecipeOf(merged));
  }
  res.json({ id: own.snap.id, ...merged });
});

listings.delete("/:id", async (req, res) => {
  const own = await ownListing(req, req.params.id);
  if (own.status !== 200) {
    res
      .status(own.status)
      .json({ error: own.status === 403 ? "Requires an operator account" : "Listing not found" });
    return;
  }
  const subRefusal = await subscriptionRefusal(req);
  if (subRefusal) { res.status(402).json({ error: subRefusal }); return; }
  // A listing with booked places can't be deleted (its bookings would point
  // at nothing) — archive it instead. Empty blocks go with the listing.
  const blocks = await db.collection("blocks").where("listingId", "==", own.snap.id).get();
  const booked = blocks.docs.reduce((s, d) => s + (d.data().bookedCount ?? 0), 0);
  if (booked > 0) {
    res.status(409).json({ error: "This listing has bookings — archive it instead of deleting" });
    return;
  }
  const batch = db.batch();
  for (const b of blocks.docs) batch.delete(b.ref);
  batch.delete(own.snap.ref);
  await batch.commit();
  res.json({ ok: true });
});
