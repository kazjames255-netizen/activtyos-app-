import { Router } from "express";
import { db } from "../firebase";
import { canWrite } from "../middleware/role";
import { geocodeAddress } from "./geo";

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
  return auth.role === "franchise" && auth.franchiseId ? `${auth.tenantId}__fr__${auth.franchiseId}` : auth.tenantId!;
}

// GET /api/library — any member of the tenant (staff included).
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
  if (!snap.exists && auth.role === "franchise" && auth.franchiseId) {
    const ho = await db.collection("libraries").doc(auth.tenantId).get();
    if (ho.exists) {
      await db.collection("libraries").doc(docId).set({ ...ho.data(), tenantId: auth.tenantId, franchiseId: auth.franchiseId });
      snap = await db.collection("libraries").doc(docId).get();
    }
  }
  res.json(snap.exists ? snap.data() : null);
});

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
  const size = JSON.stringify(doc).length;
  if (size > MAX_BYTES) {
    res.status(413).json({
      error: `Library too large (${Math.round(size / 1024)}KB — max ${MAX_BYTES / 1000}KB). Upload add-on images via POST /api/uploads instead of embedding them.`,
    });
    return;
  }
  await ref.set(doc);
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

const PUBLIC_SETTINGS_KEYS = [
  "providerName",
  "requireDob",
  "collectGender",
  "genderOptions",
  "collectPhoto",
  "collectDietary",
  "askPhotoConsent",
  "collectSend",
  "collectSendPlan",
  "collectionCheck",
  "charLimits",
  "allowDateChanges",
  "amendSelfService",
  "amendNoticeHours",
  "amendLimit",
  "amendFee",
  "amendAllowCheaper",
  "allowCardRefund",
  "refundLetCustomerChoose",
  "noRefundCredit",
  // Cancellation refund terms (bands + prose) are customer-facing — a parent
  // needs them to know what they're entitled to when cancelling.
  "cancellationPolicies",
  "askReasonParent",
  // Per-day (partial) cancellation of a multi-day pass: whether it's allowed
  // and how a single day is valued for the refund. Parent cancel modal reads
  // these to offer the day-picker and preview the per-day refund.
  "allowPartialCancel",
  "partialAllowRefund",
  "partialAllowWallet",
  "partialAllowChangeDate",
  "voucherProviders",
  "voucherHoldDays",
  "voucherClearDays",
  "voucherDueByDays",
  "voucherWhenClose",
  // Which sections a family sees in their area — the parent app reads these to
  // hide toggled-off features (Setup → Customer area). Booleans only, no secrets.
  "customerArea",
  // Refer-a-friend amounts + on/off, shown on the family's referral page.
  "referral",
  // Membership tiers + on/off, shown on the family's Memberships page.
  "memberships",
  // Operator module switches — the family app reads these so a module the
  // operator switched off is hidden on the customer side too.
  "features",
] as const;

export const libraryPublic = Router();

// GET /api/public/library/:tenantId — no auth. Parent-facing settings only.
libraryPublic.get("/:tenantId", async (req, res) => {
  const { tenantId } = req.params;
  if (!tenantId) {
    res.status(400).json({ error: "tenantId required" });
    return;
  }
  const snap = await db.collection("libraries").doc(tenantId).get();
  const data = (snap.data() ?? {}) as Record<string, unknown>;
  const src = (data.settings ?? {}) as Record<string, unknown>;

  const settings: Record<string, unknown> = {};
  for (const k of PUBLIC_SETTINGS_KEYS) if (k in src) settings[k] = src[k];

  // Only the reasons a parent may be offered — "both" and "parent" scoped. The
  // full list carries provider-only wording ("Staffing") that isn't theirs to
  // see, so it stays out; this exposes just the parent-facing slice.
  const reasons = (src.cancellationReasons ?? []) as { id: string; label: string; who?: string }[];
  settings.cancelReasons = reasons.filter((r) => r.who !== "provider").map((r) => ({ id: r.id, label: r.label }));

  res.json({ settings, childQuestions: data.childQuestions ?? null });
});
