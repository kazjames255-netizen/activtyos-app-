// "A, B and C" in the active language. Intl.ListFormat is missing before Safari 14.1 and can throw for odd locales; called unguarded inside a
// render it unmounts the whole React tree (a blank white page), so fall back to a plain comma list instead of ever throwing.
export function joinList(items: string[], locale: string): string {
  if (items.length < 2) return items.join("");
  try {
    return new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(items);
  } catch {
    return items.join(", ");
  }
}

/** A locale tag the browser accepts, else en-GB (an unsupported / invalid tag makes Intl.* and toLocale* throw RangeError on some Safari builds). */
export function safeLocale(tag: string): string {
  // raw-locale-ok: only probes whether the tag is valid
  try { new Intl.DateTimeFormat(tag); new Intl.NumberFormat(tag); return tag; } catch { return "en-GB"; }
}
