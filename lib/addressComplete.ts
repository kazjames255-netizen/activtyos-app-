// Is a family's saved home address COMPLETE enough for a provider to find the door? Pure (no DB, no React): shared by the sign-up forms, the
// account page, the home-visit checkout and the API (server/src/routes/registerRole.ts + account.ts), and covered by tests/regression.
//
// An address is stored as ONE string `address` ("12 Corris Court, Milton Keynes" / "Rose Cottage, High Street, Milton Keynes") plus a separate
// `postcode`. Complete = a house number/name, a street, a town and a real-looking UK postcode.

export interface AddressParts { house: string; street: string; town: string; postcode: string }
export type AddressMissing = "house" | "street" | "town" | "postcode";

const UK_POSTCODE = /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s?\d[A-Za-z]{2}$/;
export const isUkPostcodeShape = (pc: string): boolean => UK_POSTCODE.test((pc ?? "").trim());

const clean = (s: string | undefined): string => (s ?? "").replace(/\s+/g, " ").trim();

/** One string from the separate form fields. A house NUMBER joins its street ("12 Corris Court"); a house NAME stands on its own line. */
export function composeAddress(p: Pick<AddressParts, "house" | "street" | "town">): string {
  const house = clean(p.house), street = clean(p.street), town = clean(p.town);
  const first = /^\d/.test(house) ? [house, street].filter(Boolean).join(" ") : [house, street].filter(Boolean).join(", ");
  return [first, town].filter(Boolean).join(", ");
}

/** The form fields back out of a stored address string (best effort, for prefilling the inline editor). */
export function splitAddress(address: string, postcode = ""): AddressParts {
  const parts = clean(address).split(",").map((s) => s.trim()).filter(Boolean);
  const pc = clean(postcode).toUpperCase();
  if (parts.length >= 3) return { house: parts[0], street: parts[1], town: parts.slice(2).join(", "), postcode: pc };
  if (parts.length === 2) {
    const m = parts[0].match(/^(\d+[A-Za-z]?(?:-\d+[A-Za-z]?)?)\s+(.+)$/);
    return m ? { house: m[1], street: m[2], town: parts[1], postcode: pc } : { house: "", street: parts[0], town: parts[1], postcode: pc };
  }
  if (parts.length === 1) {
    const m = parts[0].match(/^(\d+[A-Za-z]?(?:-\d+[A-Za-z]?)?)\s+(.+)$/);
    return m ? { house: m[1], street: m[2], town: "", postcode: pc } : { house: "", street: parts[0], town: "", postcode: pc };
  }
  return { house: "", street: "", town: "", postcode: pc };
}

/** What is missing from a stored address + postcode (empty = complete). */
export function addressMissing(address: string | undefined, postcode: string | undefined): AddressMissing[] {
  const p = splitAddress(address ?? "", postcode ?? "");
  const out: AddressMissing[] = [];
  if (!p.house) out.push("house");
  if (!p.street) out.push("street");
  if (!p.town) out.push("town");
  if (!isUkPostcodeShape(p.postcode)) out.push("postcode");
  return out;
}

export const isFullAddress = (address: string | undefined, postcode: string | undefined): boolean => addressMissing(address, postcode).length === 0;

/** A single address LINE the family types for a visit ("12 High Street" / "Rose Cottage, High Street"): it must say which house. */
export function visitLineHasHouse(line: string | undefined): boolean {
  const l = clean(line);
  return /\d/.test(l) || l.split(/[\s,]+/).filter(Boolean).length >= 3;
}
