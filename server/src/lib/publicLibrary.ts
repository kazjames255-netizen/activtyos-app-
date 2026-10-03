export const PUBLIC_SETTINGS_KEYS = [
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
  // The provider identity a parent searches for inside their HMRC Tax-Free
  // Childcare account — setting name, registration number, postcode. It is
  // published ON PURPOSE: the parent cannot pay us until they have added us,
  // and the checkout's TFC panel already reads `settings.childcare` to show
  // them exactly what to type. Nothing here is private — the registration
  // number is on the public Ofsted register. (Without this key the panel
  // rendered blank for every signed-out booker, which is the whole audience.)
  "childcare",
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
  // The accent colour picked in Setup → Branding — tints the storefront + the
  // family's portal. (The logo is exposed separately below: it lives inside
  // `billing`, which also holds bank details, so billing itself never goes out.)
  "brandColor",
] as const;

/** What a signed-out visitor may see of a tenant's library settings: an allow-list of keys, the logo URL lifted out of `billing`,
 *  and only a `bankReady` boolean (never the bank details). Pure - used by GET /api/public/library/:tenantId (extracted, behaviour unchanged). */
export function publicLibrarySettings(src: Record<string, unknown>): Record<string, unknown> {
  const settings: Record<string, unknown> = {};
  for (const k of PUBLIC_SETTINGS_KEYS) if (k in src) settings[k] = src[k];
  // Just the logo URL out of billing, lifted to a top-level public field — the
  // rest of billing (sort code, account number…) stays private.
  const logoUrl = (src.billing as { logoUrl?: unknown } | undefined)?.logoUrl;
  if (typeof logoUrl === "string" && logoUrl.trim()) settings.logoUrl = logoUrl.trim();
  // Only WHETHER bank details exist (so the booking page can hide "Bank transfer" when there is nowhere to pay);
  // the details themselves are shown to the booker after booking, never published here.
  const bill = (src.billing ?? {}) as { sortCode?: unknown; accountNumber?: unknown };
  settings.bankReady = typeof bill.sortCode === "string" && !!bill.sortCode.trim() && typeof bill.accountNumber === "string" && !!bill.accountNumber.trim();

  // Only the reasons a parent may be offered — "both" and "parent" scoped. The
  // full list carries provider-only wording ("Staffing") that isn't theirs to
  // see, so it stays out; this exposes just the parent-facing slice.
  const reasons = (src.cancellationReasons ?? []) as { id: string; label: string; who?: string }[];
  settings.cancelReasons = reasons.filter((r) => r.who !== "provider").map((r) => ({ id: r.id, label: r.label }));
  return settings;
}
