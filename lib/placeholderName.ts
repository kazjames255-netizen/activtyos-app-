/**
 * Is this "name" really a login / role label rather than a person's or a business's name?
 *
 * A provider who signs in as support@theircompany.com has an account display name of "support" (or no name at all, so the app falls back to the
 * email's local part). Printing that on a listing page, or offering it as "who is onsite", is wrong: parents should see the person's or the
 * business's real name. Pure and shared by the web app and (via relative import) the server.
 */

/** Mailbox / role words that are never somebody's name. Compared after lower-casing and dropping everything except letters. */
const ROLE_WORDS = new Set([
  "support", "admin", "administrator", "info", "information", "accounts", "account", "noreply", "donotreply", "hello", "hi", "contact",
  "team", "office", "enquiries", "enquiry", "sales", "billing", "bookings", "booking", "mail", "email", "webmaster", "postmaster", "help",
  "me", "test", "user", "owner", "manager", "staff", "provider", "business", "company",
]);

const lettersOnly = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

/** The part of an email before the @, lower-cased ("" for no email). */
export const emailLocalPart = (email?: string | null): string => ((email ?? "").split("@")[0] ?? "").trim().toLowerCase();

/**
 * True when `name` is empty, an email address, a role word like "support", or just the sign-in email's own local part
 * (so the app has clearly invented it rather than the person typing it).
 */
export function isPlaceholderName(name?: string | null, email?: string | null): boolean {
  const n = (name ?? "").trim();
  if (!n) return true;
  if (n.includes("@")) return true;
  const letters = lettersOnly(n);
  if (!letters) return true;
  if (ROLE_WORDS.has(letters)) return true;
  const local = emailLocalPart(email);
  if (local && n.toLowerCase() === local) return true;
  return false;
}

/**
 * The name a provider's pages should show: the public display name (Setup → Display name, then the business name, then the tenant
 * name), NEVER the signed-in account's own name or email. `placeholder` is true when nothing real was found, so the caller can show
 * "Your business" and prompt for the real name.
 */
export function providerBrand(parts: { publicName?: string | null; providerName?: string | null; businessName?: string | null; tenantName?: string | null }): { name: string; placeholder: boolean } {
  for (const c of [parts.publicName, parts.providerName, parts.businessName, parts.tenantName]) {
    const v = (c ?? "").trim();
    if (v && !isPlaceholderName(v)) return { name: v, placeholder: false };
  }
  return { name: "", placeholder: true };
}
