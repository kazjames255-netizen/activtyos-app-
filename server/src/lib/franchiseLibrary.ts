// A franchise's own Setup doc (libraries/{tenant}__fr__{franchise}) and how it relates to head office's. PURE (no Firebase) so tests can load it.
//
// Rules (F12/F14/F13, 10 Oct 2026 franchise run):
//  1. SEED, never copy. The first time a franchise doc is created (first read, or head office's first feature switch) it gets ONLY the fields in an
//     explicit allow-list. Bank details, payroll administrators, billing, roles, staff lists are never copied across.
//  2. POLICIES follow head office until the franchise overrides them. The franchise doc keeps an `overrides` map; a policy key not in it is resolved
//     from head office's CURRENT value at read time (so a head-office policy change reaches a franchise that never edited its own).
//  3. FEATURE SWITCHES head office turned off are authoritative: stored as `hoLocks` {view:false}; the franchise cannot switch them back on.
//  4. Safety features (registers, incidents, medication) cannot be switched off for a franchise at all.
type Rec = Record<string, unknown>;

/** settings keys a new franchise doc starts with: features, branding, listing / checkout defaults, and policies. NEVER bank, payroll, billing, roles. */
export const SEED_SETTINGS_KEYS = [
  "features", "brandColor", "brandColor2", "brandColor3",
  "requireDob", "collectGender", "genderOptions", "collectPhoto", "collectDietary", "askPhotoConsent", "collectSend", "collectSendPlan",
  "collectionCheck", "charLimits", "allowDateChanges", "amendSelfService", "amendNoticeHours", "amendLimit", "amendFee", "amendAllowCheaper",
  "payMethods", "customerArea", "referral", "memberships", "voucherHoldDays", "voucherClearDays", "voucherDueByDays", "voucherWhenClose",
  "cancellationPolicies", "allowCardRefund", "refundLetCustomerChoose", "noRefundCredit", "askReasonParent", "allowPartialCancel",
  "partialAllowRefund", "partialAllowWallet", "partialAllowChangeDate",
] as const;

/** top-level library keys a new franchise doc starts with (listing option lists and the child questions). Venues, add-ons (prices), staff and the timetable are head office's own. */
export const SEED_TOP_KEYS = ["categories", "provided", "toBring", "safety", "send", "outcomes", "emojis", "whereHeading", "childQuestions"] as const;

/** Policy keys that follow head office until the franchise changes them (then `overrides[key]` is true). */
export const INHERITED_POLICY_KEYS = [
  "cancellationPolicies", "allowCardRefund", "refundLetCustomerChoose", "noRefundCredit", "askReasonParent",
  "allowPartialCancel", "partialAllowRefund", "partialAllowWallet", "partialAllowChangeDate",
] as const;

/** Fields that must never sit in a franchise doc as a copy of head office's. */
const BILLING_BANK_KEYS = ["bankName", "accountName", "sortCode", "accountNumber"] as const;

/** Feature switches that guard children and cannot be switched off for a franchise. Both register keys (company "admin-registers", others "registers"). */
export const SAFETY_FEATURES = new Set(["registers", "admin-registers", "incidents", "incident", "accidents", "medication"]);

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const obj = (v: unknown): Rec => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {});

/** What a brand-new franchise doc contains, taken from head office's library (the allow-list only). */
export function seedFromHeadOffice(ho: Rec | undefined | null): Rec {
  const hs = obj(ho?.settings);
  const settings: Rec = {};
  for (const k of SEED_SETTINGS_KEYS) if (k in hs) settings[k] = hs[k];
  const logo = obj(hs.billing).logoUrl;
  if (typeof logo === "string" && logo) settings.billing = { logoUrl: logo };
  // Head office's "all franchises" switches are the default a franchise starts with (F10): a default OFF is also a lock, like any switch head office turns off.
  const defaults = obj(ho?.franchiseFeatureDefaults);
  if (Object.keys(defaults).length) settings.features = { ...obj(settings.features), ...defaults };
  const hoLocks: Rec = {};
  for (const [k, v] of Object.entries(defaults)) if (v === false) hoLocks[k] = false;
  const doc: Rec = { settings, overrides: {}, seedVersion: SEED_VERSION, inherited: [...INHERITED_POLICY_KEYS], ...(Object.keys(hoLocks).length ? { hoLocks } : {}) };
  for (const k of SEED_TOP_KEYS) if (ho && k in ho) doc[k] = ho[k];
  return doc;
}

/** Docs written by the allow-list seed carry this. A doc without it is a LEGACY full copy of head office's library (before 10 Oct 2026). */
export const SEED_VERSION = 2;

/** Make a legacy doc safe: bank details, payroll administrators removed WHATEVER their value (head office may have changed them since the copy was
 *  taken, so equality proves nothing), copies of head office's venues and staff removed (matched by id / name), then stamped so a franchise's own values
 *  entered afterwards are kept. A doc already stamped is returned as is. Pure. */
export function scrubLegacyDoc(fr: Rec, ho: Rec | undefined | null): Rec {
  if (fr.seedVersion === SEED_VERSION) return fr;
  const hs = obj(ho?.settings);
  const settings: Rec = { ...obj(fr.settings) };
  delete settings.payrollAdmins;
  if (settings.billing !== undefined) { const nb: Rec = { ...obj(settings.billing) }; for (const k of BILLING_BANK_KEYS) delete nb[k]; settings.billing = nb; }
  const out: Rec = { ...fr, settings, overrides: overridesOf(fr, hs), seedVersion: SEED_VERSION };
  const hoIds = new Set((Array.isArray(ho?.venues) ? (ho!.venues as Rec[]) : []).map((v) => String(v?.id ?? "")));
  if (Array.isArray(fr.venues)) out.venues = (fr.venues as Rec[]).filter((v) => !hoIds.has(String(v?.id ?? "")));
  const hoStaff = new Set((Array.isArray(ho?.staff) ? (ho!.staff as Rec[]) : []).map((x) => JSON.stringify(x)));
  const hoNames = new Set((Array.isArray(ho?.staff) ? (ho!.staff as Rec[]) : []).map((x) => String(x?.name ?? "").toLowerCase()).filter(Boolean));
  if (Array.isArray(fr.staff)) out.staff = (fr.staff as Rec[]).filter((x) => !hoStaff.has(JSON.stringify(x)) && !hoNames.has(String(x?.name ?? "").toLowerCase()));
  return out;
}

/** Strip anything in a franchise settings bag that is a copy of head office's private data (bank details, payroll administrators). A franchise's OWN differing values stay. */
export function scrubSeededSettings(frSettings: Rec, hoSettings: Rec): Rec {
  const out: Rec = { ...frSettings };
  if ("payrollAdmins" in out && same(out.payrollAdmins, hoSettings.payrollAdmins)) delete out.payrollAdmins;
  const fb = obj(out.billing), hb = obj(hoSettings.billing);
  if (Object.keys(fb).length) {
    const nb: Rec = { ...fb };
    for (const k of BILLING_BANK_KEYS) if (k in nb && same(nb[k], hb[k])) delete nb[k];
    out.billing = nb;
  }
  return out;
}

/** Which inherited policies the franchise has made its own. A doc written before the overrides map existed (a full copy seeded from head office) has none:
 *  there, a policy that still differs from head office's is kept as the franchise's own (we can't tell an edit from a stale copy, so we never silently change it)
 *  and one that equals head office's follows it. */
export function overridesOf(fr: Rec, hoSettings: Rec): Rec {
  if (fr.overrides && typeof fr.overrides === "object" && !Array.isArray(fr.overrides)) return fr.overrides as Rec;
  const own = obj(fr.settings), out: Rec = {};
  for (const k of INHERITED_POLICY_KEYS) if (k in own && !same(own[k], hoSettings[k])) out[k] = true;
  return out;
}

/** The franchise's settings as every reader should see them: head office's allow-listed base, under the franchise's own values, with un-overridden
 *  policies re-read from head office NOW, head-office feature locks forced, and any seeded copy of head-office secrets removed. */
export function resolveFranchiseLibrary(frRaw: Rec, ho: Rec | undefined | null): Rec {
  const fr = scrubLegacyDoc(frRaw, ho);
  const hs = obj(ho?.settings);
  const base = seedFromHeadOffice(ho);
  const own = scrubSeededSettings(obj(fr.settings), hs);
  const settings: Rec = { ...obj(base.settings), ...own };
  const overrides = overridesOf(fr, hs);
  for (const k of INHERITED_POLICY_KEYS) {
    if (overrides[k] === true) continue;
    if (k in hs) settings[k] = hs[k]; else delete settings[k];
  }
  const locks = obj(fr.hoLocks);
  if (Object.keys(locks).length) settings.features = { ...obj(settings.features), ...locks };
  const out: Rec = { ...fr };
  for (const k of SEED_TOP_KEYS) if (!(k in out) && ho && k in ho) out[k] = ho[k];
  out.settings = settings;
  out.inherited = INHERITED_POLICY_KEYS.filter((k) => overrides[k] !== true);
  return out;
}

/** The first feature switch a franchise tries that head office has locked off, or null. `features` is the bag the franchise submitted. */
export function lockedFeatureViolation(locks: unknown, features: unknown): string | null {
  const l = obj(locks), f = obj(features);
  // A key left out is not a switch-on (readers force the lock anyway); only an explicit non-false value is.
  for (const [k, v] of Object.entries(l)) if (v === false && k in f && f[k] !== false) return k;
  return null;
}

/** Work out what to STORE when a franchise saves its settings: un-edited inherited policies stay un-stored (they keep following head office),
 *  edited ones become overrides; head-office secrets echoed back are dropped. `submitted` is the settings bag the franchise sent. */
export function franchiseSettingsToStore(submitted: Rec, previous: { settings?: unknown; overrides?: unknown }, ho: Rec | undefined | null): { settings: Rec; overrides: Rec } {
  const hs = obj(ho?.settings);
  const prevOverrides = overridesOf({ settings: previous.settings, overrides: previous.overrides }, hs);
  const resolvedBefore = obj(resolveFranchiseLibrary({ settings: previous.settings, overrides: prevOverrides }, ho).settings);
  const settings = scrubSeededSettings(submitted, hs);
  const overrides: Rec = { ...prevOverrides };
  for (const k of INHERITED_POLICY_KEYS) {
    if (!(k in submitted)) continue;
    if (prevOverrides[k] === true) continue; // already the franchise's own: stored as sent
    if (same(submitted[k], resolvedBefore[k])) delete settings[k]; // unchanged: keep following head office
    else overrides[k] = true; // edited: now the franchise's own
  }
  for (const k of INHERITED_POLICY_KEYS) if (overrides[k] !== true) delete settings[k];
  return { settings, overrides };
}

/** The feature keys a switch may name: every nav view of the operator portals plus every module key the API gates on. */
export function isKnownFeatureKey(view: string, navViews: Iterable<string>, gatedKeys: Iterable<string>): boolean {
  for (const v of navViews) if (v === view) return true;
  for (const v of gatedKeys) if (v === view) return true;
  return false;
}
