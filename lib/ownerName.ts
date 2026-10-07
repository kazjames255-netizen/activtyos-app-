// Is this display name a placeholder rather than a person's real name? ("support", "admin", an email local part ...)
// Used by the listing wizard's Staff onsite step: the account owner is listed first as "You", and a placeholder name
// triggers the prompt "Add your real name so parents know who is coming".

const PLACEHOLDERS = new Set([
  "support", "admin", "administrator", "info", "contact", "hello", "hi", "office", "team", "staff", "enquiries", "enquiry", "sales", "accounts",
  "bookings", "booking", "manager", "owner", "noreply", "no-reply", "test", "demo", "user", "provider", "freelancer", "company", "me", "n/a", "na", "none",
]);

const compact = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

/** True when `name` is empty, a role-style word, contains an @, has no letters, is a single character, or is just the email's local part. */
export function isPlaceholderName(name: string | null | undefined, emailLocal?: string | null): boolean {
  const n = (name ?? "").trim();
  if (!n) return true;
  if (n.includes("@")) return true;
  if (!/\p{L}/u.test(n)) return true;
  const c = compact(n);
  if (c.length < 2) return true;
  if (PLACEHOLDERS.has(n.toLowerCase()) || PLACEHOLDERS.has(c)) return true;
  // The sign-in name typed as-is (no spaces) is the email's local part, not a person's name; "Kaz James" for kazjames@ is a real name.
  if (emailLocal && !/\s/.test(n) && n.toLowerCase() === emailLocal.trim().toLowerCase()) return true;
  return false;
}
