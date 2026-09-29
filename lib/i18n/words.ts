// Canonical English "enum" words that the data layer stores and the UI displays verbatim (booking status, payment state, payment method…).
// `translateWord(t, "Awaiting voucher payment")` looks up `words.awaiting_voucher_payment` and falls back to the original text, so an
// unknown / provider-typed value still shows as typed. Add the word to lib/i18n/messages/areas/words.ts to translate it.
type T = (key: string, vars?: Record<string, string | number>) => string;

export const wordKey = (s: string): string => "words." + s.toLowerCase().replace(/£/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

export function translateWord(t: T, s: string | null | undefined): string {
  if (!s) return s ?? "";
  const k = wordKey(s);
  const r = t(k);
  if (r !== k) return r;
  const m = /^(.+) pending$/.exec(s); // "Edenred pending" — a named voucher scheme
  if (m) return t("words.named_pending", { name: m[1] });
  return s;
}

/** Sidebar / page-name labels from lib/nav/config.ts ("Bookings", "Ratios & groups") -> `p7nav.<slug>`; unknown labels render as authored. */
export function navLabel(t: T, label: string | null | undefined): string {
  if (!label) return label ?? "";
  const k = "p7nav." + label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const r = t(k);
  return r !== k ? r : label;
}
