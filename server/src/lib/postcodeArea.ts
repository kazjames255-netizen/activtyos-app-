// PURE helpers for the home-visit postcode step (no network, no Firestore - unit-tested in tests/regression/postcode-area.test.mts).
// A family types a postcode; the server looks it up, and what it finds (the town / area) is stored on the booking so the provider can see
// the app really did recognise the place.

const COUNTRY_WORDS = new Set(["england", "scotland", "wales", "northern ireland", "united kingdom", "uk", "great britain", "gb"]);

const compact = (s: string) => (s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/** A plausible UK postcode (format only - a real lookup decides if it exists). Accepts it with or without the space. */
export function isUkPostcodeFormat(pc: string): boolean {
  return /^(GIR0AA|[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2})$/.test(compact(pc));
}

/** "mk109nr" -> "MK10 9NR". Anything that is not a plausible postcode comes back trimmed + upper-cased, unchanged otherwise. */
export function formatPostcode(pc: string): string {
  const c = compact(pc);
  if (!isUkPostcodeFormat(c)) return (pc ?? "").trim().toUpperCase().replace(/\s+/g, " ");
  return `${c.slice(0, -3)} ${c.slice(-3)}`;
}

/** The outward code ("MK10") of a postcode, compact. */
export function outwardOf(pc: string): string {
  const c = compact(pc);
  return c.length > 3 ? c.slice(0, -3) : c;
}

/** Does a geocoder label really belong to THIS postcode (at least its district)? Stops a random place name passing as "recognised". */
export function labelMatchesPostcode(label: string, postcode: string): boolean {
  const l = compact(label);
  const out = outwardOf(postcode);
  return !!out && l.includes(out);
}

/** "MK10 9NR, Kents Hill, Milton Keynes, Buckinghamshire, England, United Kingdom" -> "Kents Hill". The first place name after the postcode itself. */
export function areaFromLabel(label: string, postcode: string): string | undefined {
  const pc = compact(postcode);
  const out = outwardOf(postcode);
  for (const raw of (label ?? "").split(",")) {
    const part = raw.trim();
    if (!part) continue;
    const c = compact(part);
    if (c === pc || c === out) continue; // the postcode (or just its district) is not an "area name"
    if (COUNTRY_WORDS.has(part.toLowerCase())) continue;
    if (isUkPostcodeFormat(part)) continue; // a different postcode in the label
    return part.length > 60 ? part.slice(0, 60) : part;
  }
  return undefined;
}
