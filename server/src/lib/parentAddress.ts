import { addressMissing, isFullAddress } from "../../../lib/addressComplete";
import { lookupPostcode } from "./postcodeLookup";

// A parent's FULL home address (house number/name, street, town, postcode) is compulsory at registration and when they edit their profile, because
// a home-visit provider has to find the door. Enforced on the live API (Railway) and in production builds; local dev stacks and the e2e/fuzz harnesses
// (which create throwaway parents through the API with no address) are left alone unless ENFORCE_PARENT_ADDRESS=1. ENFORCE_PARENT_ADDRESS=0 switches it off.
export function enforceParentAddress(): boolean {
  const v = process.env.ENFORCE_PARENT_ADDRESS;
  if (v === "1") return true;
  if (v === "0") return false;
  return !!process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === "production";
}

export const FULL_ADDRESS_MESSAGE = "Please enter your full address: house number or name, street, town and postcode, so a provider can find you.";

/** null when fine (or not enforced); otherwise the message to send back with a 400. */
export function parentAddressProblem(address: string | undefined, postcode: string | undefined): string | null {
  if (!enforceParentAddress()) return null;
  return isFullAddress(address, postcode) ? null : FULL_ADDRESS_MESSAGE;
}

export { addressMissing };

export const POSTCODE_NOT_FOUND_MESSAGE = "We can't find that postcode — please check it";
export const POSTCODE_FORMAT_MESSAGE = "That doesn't look like a UK postcode — check it and try again";

/** After the shape check: does the postcode really EXIST (official postcode database)? null = fine / not enforced / the lookup service is down
 *  (fails OPEN, logged: a provider's outage must not stop families signing up). */
export async function parentPostcodeProblem(postcode: string | undefined): Promise<string | null> {
  if (!enforceParentAddress() || !postcode?.trim()) return null;
  const r = await lookupPostcode(postcode);
  if (r.ok) return null;
  if (r.code === "format") return POSTCODE_FORMAT_MESSAGE;
  if (r.code === "notfound") return POSTCODE_NOT_FOUND_MESSAGE;
  console.warn(`[parentAddress] postcode lookup unavailable, accepted ${postcode} without checking it exists`);
  return null;
}
