import { Router } from "express";
import { db } from "../firebase";
import { canWrite } from "../middleware/role";

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
] as const;

const MAX_BYTES = 400_000; // well under Firestore's 1MB doc limit

// GET /api/library — any member of the tenant (staff included).
library.get("/", async (req, res) => {
  const auth = req.auth!;
  if (!auth.tenantId) {
    res.status(403).json({ error: "Requires an account with a tenant" });
    return;
  }
  const snap = await db.collection("libraries").doc(auth.tenantId).get();
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
  const ref = db.collection("libraries").doc(auth.tenantId);
  const existing = (await ref.get()).data() ?? {};
  const doc: Record<string, unknown> = { ...existing, tenantId: auth.tenantId };
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
