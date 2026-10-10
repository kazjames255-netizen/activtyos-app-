import { displayNameFallback } from "../lib/directoryRules";
import { isPayrollAdmin } from "./payroll";
import { Router } from "express";
import { db } from "../firebase";
import { canWrite } from "../middleware/role";
import { stripAddonCatalogPrices } from "../lib/rosterRules";
import { forgetSettings } from "../middleware/access";
import { geocodeAddress } from "./geo";
import { normaliseChildcareSettings } from "../lib/childcare";
import { publicLibrarySettings } from "../lib/publicLibrary";
import { cardReady } from "../lib/cardReady";
import { brandSettingsError } from "../lib/listingRules";
import { librarySnap } from "../lib/tenantLibrary";
import { cutoffValue } from "../../../features/bookings/addonRequests";
import { isCapLevel } from "../../../lib/accessMap";

type Venue = { id: string; name?: string; address?: string; city?: string; kind?: string; lat?: number; lng?: number };

// ─────────────────────────────────────────────────────────────────────────
// The tenant's shared listing library — the option lists reused across all
// of a tenant's listings (was `LocalState` in the browser): categories,
// venues, provided/safety/send/outcomes chips, add-ons, staff, emojis.
// One doc per tenant (`libraries/{tenantId}`), stored as sent: it's operator
// content with no server-side behaviour attached. Parents never read this
// endpoint — GET /api/listings/:id embeds the slice a listing references.
// ─────────────────────────────────────────────────────────────────────────

export const library = Router();

const KEYS = [
  "categories",
  "venues",
  "provided",
  "toBring",
  "safety",
  "send",
  "outcomes",
  "addons",
  "staff",
  "emojis",
  // The venue section's heading on customer pages — tenant-level, set once in
  // the Locations tab rather than per listing. Without it here the PUT silently
  // dropped it and the operator's wording reverted on reload.
  "whereHeading",
  // Setup & features (features/setup/SetupApp.tsx). `settings` is the flat bag
  // of toggles, numbers and short lists; `childQuestions` is its own key
  // because it is the largest and the one most likely to grow.
  "settings",
  "childQuestions",
  // The Activity timetable's per-tenant catalog (categories/activities +
  // facilities) — edited inside the Timetable builder, shared by the team.
  "timetable",
] as const;

const MAX_BYTES = 400_000; // well under Firestore's 1MB doc limit

// A franchise manages its OWN settings library, separate from the head office,
// so its Setup never clobbers the HO's (or a sibling's). Its doc is keyed per
// franchise; every other role uses the tenant doc.
function libDocId(auth: { role: string; tenantId: string | null; franchiseId: string | null }): string {
  return (auth.role === "franchise" || auth.role === "staff") && auth.franchiseId ? `${auth.tenantId}__fr__${auth.franchiseId}` : auth.tenantId!;
}

// GET /api/library — any member of the tenant (staff included).
async function publicNameFor(tenantId: string, settings?: { providerName?: string; billing?: { businessName?: string } }): Promise<string> {
  try {
    const t = await db.collection("tenants").doc(tenantId).get();
    return displayNameFallback(settings, t.get("name") as string | undefined);
  } catch { return displayNameFallback(settings, undefined); }
}

library.get("/", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId) {
    res.status(403).json({ error: "Requires an account with a tenant" });
    return;
  }
  const docId = libDocId(auth);
  let snap = await db.collection("libraries").doc(docId).get();
  // Seed a franchise's library from the head office's the first time it's read,
  // so a new franchise starts fully configured and then diverges on its own.
  if (!snap.exists && (auth.role === "franchise" || auth.role === "staff") && auth.franchiseId) {
    const ho = await db.collection("libraries").doc(auth.tenantId).get();
    if (ho.exists) {
      await db.collection("libraries").doc(docId).set({ ...ho.data(), tenantId: auth.tenantId, franchiseId: auth.franchiseId });
      snap = await db.collection("libraries").doc(docId).get();
    }
  }
  let data = snap.exists ? snap.data() : null;
  // Staff never need to know who administers payroll.
  if (data && auth.role === "staff" && data.settings && "payrollAdmins" in (data.settings as object)) { const { payrollAdmins: _pa, ...restS } = data.settings as Record<string, unknown>; data = { ...data, settings: restS }; }
  // Staff never see add-on prices (the names, options and questions stay: the register and booking screens use them).
  if (data && auth.role === "staff") data = stripAddonCatalogPrices(data);
  // Staff read the library for everything they render (venues, question sets, switches), but the business bank account printed on
  // invoices is finance's, not theirs — a role set to Finances/Money: None must not be able to read it straight off this call.
  const billing = (data?.settings as { billing?: Record<string, unknown> } | undefined)?.billing;
  if (data && auth.role === "staff" && billing) {
    const { bankName: _b, accountName: _a, sortCode: _s, accountNumber: _n, ...rest } = billing;
    res.json({ ...data, settings: { ...data.settings, billing: rest }, publicName: auth.tenantId ? await publicNameFor(auth.tenantId, data.settings as { providerName?: string; billing?: { businessName?: string } }) : "" });
    return;
  }
  // The name parents see for this provider (Setup > Display name, then business name, then the tenant name): the web app's previews use it
  // instead of the signed-in account's own name ("support").
  const publicName = auth.tenantId ? await publicNameFor(auth.tenantId, data?.settings as { providerName?: string; billing?: { businessName?: string } } | undefined) : "";
  res.json(data ? { ...data, publicName } : data);
});

/** Every cap level in settings.roles must be exactly "none" | "view" | "edit" (an unknown one used to be stored and read as full access). */
function roleCapsError(roles: unknown): string | null {
  if (roles === undefined || roles === null) return null;
  if (!Array.isArray(roles)) return "Roles must be a list";
  for (const r of roles) {
    const caps = (r as { caps?: unknown } | null)?.caps;
    if (caps === undefined || caps === null) continue;
    if (typeof caps !== "object" || Array.isArray(caps)) return "A role's permissions must be an object";
    for (const [area, lvl] of Object.entries(caps)) if (!isCapLevel(lvl)) return `Permission for "${area}" must be none, view or edit`;
  }
  return null;
}

// PUT /api/library — replace the whole library (operators only).
library.put("/", async (req, res) => {
  const auth = req.auth!;
  if (!canWrite(auth.role) || !auth.tenantId) {
    res.status(403).json({ error: "Requires an operator account with a tenant" });
    return;
  }
  const body = req.body as Record<string, unknown>;
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    res.status(400).json({ error: "Body must be an object" });
    return;
  }
  // Overlay onto what's already stored rather than replacing the document.
  //
  // This used to be a plain .set(), which deletes every key the caller leaves
  // out. That was harmless while one screen owned the whole library and always
  // sent all of it — but Setup & features now writes `settings` and
  // `childQuestions` while the Listings screen still sends only its own ten
  // keys, so saving a category would have silently wiped every setting.
  //
  // Read-modify-write rather than .set(..., {merge:true}): merge descends into
  // nested maps, so removing an emoji from `emojis` would never propagate. A
  // key that is present here still replaces its stored value wholesale.
  // A franchise writes its OWN library doc — never the head office's shared one.
  const ref = db.collection("libraries").doc(libDocId(auth));
  const existing = (await ref.get()).data() ?? {};
  const doc: Record<string, unknown> = { ...existing, tenantId: auth.tenantId, ...(auth.role === "franchise" && auth.franchiseId ? { franchiseId: auth.franchiseId } : {}) };
  for (const k of KEYS) if (k in body) doc[k] = body[k];
  // "Show your name as" (business ↔ own name) switched without the display
  // name being edited in the same save: fill it in, so families actually see
  // the chosen name — the switch used to change only a label (acceptance d1s4).
  const prevS = (existing.settings ?? {}) as Record<string, unknown>;
  const nextS = (doc.settings ?? {}) as Record<string, unknown>;
  // The payroll-administrator allow-list guards pay/NI/bank data: only someone already on it may change it (else any owner-tier login could add themselves).
  if (JSON.stringify(nextS.payrollAdmins ?? null) !== JSON.stringify(prevS.payrollAdmins ?? null) && Array.isArray(prevS.payrollAdmins) && prevS.payrollAdmins.length) {
    if (!(await isPayrollAdmin(req))) { res.status(403).json({ error: "Only a payroll administrator can change who the payroll administrators are." }); return; }
  }
  if (nextS !== prevS && nextS.providerNameMode && nextS.providerNameMode !== prevS.providerNameMode && nextS.providerName === prevS.providerName) {
    let name = "";
    if (nextS.providerNameMode === "business") name = String((nextS.billing as { businessName?: string } | undefined)?.businessName ?? "").trim() || String((await db.collection("tenants").doc(auth.tenantId).get()).get("name") ?? "").trim();
    else if (req.user?.uid) name = String((await db.collection("users").doc(req.user.uid).get()).get("name") ?? "").trim();
    if (name) doc.settings = { ...nextS, providerName: name };
  }
  // `settings.childcare` is the provider identity a parent types into their
  // HMRC Tax-Free Childcare account (docs/tfc-build-spec.md §B1). It has to
  // match what HMRC holds or the payment fails with "provider not added to
  // your HMRC account" — so it is the one part of this bag that is stored
  // canonically rather than exactly as sent: postcode upper-cased and spaced,
  // registration number stripped of spaces, schemes trimmed and de-duped.
  // Everything else in `settings` remains operator content with no behaviour.
  if ("settings" in body) {
    const s = (doc.settings ?? {}) as Record<string, unknown>;
    const capErr = roleCapsError(s.roles);
    if (capErr) { res.status(400).json({ error: capErr }); return; }
    const brandErr = brandSettingsError(s);
    if (brandErr) { res.status(400).json({ error: brandErr }); return; }
    if ("childcare" in s) {
      try {
        const cc = normaliseChildcareSettings(s.childcare);
        const { childcare: _drop, ...rest } = s;
        doc.settings = cc ? { ...rest, childcare: cc } : rest;
      } catch (e) {
        res.status(400).json({ error: (e as Error).message });
        return;
      }
    }
  }
  // A per-add-on request cut-off is a whole number of days, 0 to 60 (absent / null = follow the Setup default). Anything else is refused.
  if ("addons" in body && Array.isArray(doc.addons)) {
    for (const a of doc.addons as { name?: string; requestCutoffDays?: unknown }[]) {
      const v = a?.requestCutoffDays;
      if (v !== undefined && v !== null && cutoffValue(v) === null) { res.status(400).json({ error: `"${String(a?.name ?? "Add-on")}": the change cut-off must be a whole number of days from 0 to 60.` }); return; }
    }
  }
  const size = JSON.stringify(doc).length;
  if (size > MAX_BYTES) {
    res.status(413).json({
      error: `Library too large (${Math.round(size / 1024)}KB — max ${MAX_BYTES / 1000}KB). Upload add-on images via POST /api/uploads instead of embedding them.`,
    });
    return;
  }
  await ref.set(doc);
  forgetSettings(auth.tenantId); // a Features / Roles switch applies on the next request
  res.json(doc);

  // Geocode venues ONCE at save time and store lat/lng, so the browse page
  // reads stored coordinates instead of geocoding on the fly (which hammered
  // the rate-limited geocoder — see routes/geo.ts). Fire-and-forget: the save
  // has already returned; coords land a moment later and push out via realtime.
  if ("venues" in body) {
    void (async () => {
      const venues = (doc.venues as Venue[] | undefined) ?? [];
      const prevById = new Map(((existing.venues as Venue[] | undefined) ?? []).map((v) => [v.id, v]));
      // Only what's missing coords, or whose address changed since it was geocoded.
      const stale = venues.filter((v) => {
        if (v.kind === "online" || !v.address?.trim()) return false;
        const prev = prevById.get(v.id);
        const hasCoords = typeof v.lat === "number" && typeof v.lng === "number";
        return !hasCoords || !prev || prev.address !== v.address;
      });
      if (!stale.length) return;
      const found = new Map<string, { lat: number; lng: number; address: string }>();
      for (const v of stale) {
        const hit = await geocodeAddress(v.address!);
        if (hit) found.set(v.id, { ...hit, address: v.address! });
      }
      if (!found.size) return;
      // Re-read and merge by id (only where the address still matches) so a
      // concurrent edit isn't clobbered by our slightly-stale copy.
      const fresh = (await ref.get()).data() ?? {};
      const freshVenues = (fresh.venues as Venue[] | undefined) ?? [];
      const merged = freshVenues.map((v) => {
        const c = found.get(v.id);
        return c && c.address === v.address ? { ...v, lat: c.lat, lng: c.lng } : v;
      });
      await ref.update({ venues: merged });
    })().catch((e) => console.error("[library] venue geocode failed:", (e as Error).message));
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Public, read-only slice of a tenant's settings — for the signed-out
// booking page.
//
// The parent booking flow needs the child questions, the voucher schemes
// (with references — that's the whole point, they go and pay with them) and
// the checkout toggles. A parent has no account, so /api/library above 401s
// them. This serves only what the storefront legitimately shows a stranger,
// keyed by the tenant id the public listing already carries.
//
// A denylist, not an allowlist, would leak the next provider-internal field
// someone adds. So this hand-picks the parent-facing settings and drops the
// rest — cancellationReasons in particular, which carries the operator's own
// "Staffing" / "Venue unavailable" wording that isn't a stranger's business.
//
// Interim: the cleaner home for this is the /api/listings/:id payload, the
// way categories are already embedded (see the backend handoff, §"anonymous
// read"). This unblocks the front end without waiting for that.
// ─────────────────────────────────────────────────────────────────────────


export const libraryPublic = Router();

// GET /api/public/library/:tenantId — no auth. Parent-facing settings only.
libraryPublic.get("/:tenantId", async (req, res) => {
  const { tenantId } = req.params;
  if (!tenantId) {
    res.status(400).json({ error: "tenantId required" });
    return;
  }
  // A listing run by a franchise is governed by the franchise's OWN Setup
  // (child questions, DOB required/optional, refer-a-friend, memberships…), so
  // when the caller names the listing, read that franchise's library — falling
  // back to head office's (librarySnap). The listing must belong to this tenant.
  let franchiseId: string | null = null;
  const listingId = typeof req.query.listingId === "string" ? req.query.listingId : "";
  if (listingId) {
    const l = await db.collection("listings").doc(listingId).get();
    if (l.exists && l.get("tenantId") === tenantId) franchiseId = (l.get("franchiseId") as string | null | undefined) ?? null;
  }
  const snap = await librarySnap(tenantId, franchiseId);
  const data = (snap.data() ?? {}) as Record<string, unknown>;
  const src = (data.settings ?? {}) as Record<string, unknown>;

  const settings = publicLibrarySettings(src);
  settings.cardReady = await cardReady(tenantId);

  res.json({ settings, childQuestions: data.childQuestions ?? null });
});
