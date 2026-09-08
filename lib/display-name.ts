/**
 * A person's display name, for anywhere a HUMAN is shown — task assignees,
 * comment authors, "who collected", audit lines.
 *
 * The name on the user record is the truth. It is only blank when nobody has
 * filled it in (Account → Name), and the fallback in most of this app was to
 * drop the raw email address into the UI instead — so a task read
 * "assigned to kazjames255@gmail.com" rather than to a person.
 *
 * The fallback here derives something name-shaped from the local part, and
 * never shows the domain. It is a stopgap, not a guess at anybody's real name:
 * `looksDerived` lets a caller say so and point at where to fix it properly.
 */

const TITLE = (w: string) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w);

/** "kaz.james+camps@x.com" → "Kaz James". "kazjames255@x.com" → "Kazjames". */
export function nameFromEmail(email: string): string {
  const local = (email || "").split("@")[0] ?? "";
  if (!local) return "";
  return local
    .replace(/\+.*$/, "")        // drop a +tag
    .split(/[._-]+/)             // the only separators that reliably mean "word"
    .map((part) => part.replace(/\d+$/, ""))   // trailing digits are noise, not a name
    .filter(Boolean)
    .map(TITLE)
    .join(" ")
    .trim();
}

/** The name to show. Prefers the real one; never returns an email address. */
export function displayName(name?: string | null, email?: string | null): string {
  const n = (name ?? "").trim();
  if (n) return n;
  return nameFromEmail(email ?? "");
}

/** True when we had to invent it — so the UI can offer to fix it at source. */
export function looksDerived(name?: string | null, email?: string | null): boolean {
  return !(name ?? "").trim() && !!nameFromEmail(email ?? "");
}
