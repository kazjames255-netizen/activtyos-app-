// The family's free-text "anything we should know to find you?" on a home-visit booking (how to get there, parking, door/gate codes, pets).
// Cleaned HERE (server-side) before it is stored: the browser is never trusted for length or content.

export const VISIT_NOTES_MAX = 500;

/** Trim, normalise line breaks, drop control characters, cap the length. Returns undefined when nothing is left. */
export function cleanVisitNotes(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const s = raw
    .replace(/\r\n?/g, "\n")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, VISIT_NOTES_MAX)
    .trim();
  return s || undefined;
}

/** The "use my saved address?" decision at checkout: a saved address is only offered when it has a postcode. */
export function savedAddressOffer(saved: { address?: string; postcode?: string } | null | undefined): { address: string; postcode: string } | null {
  const pc = (saved?.postcode ?? "").trim();
  return pc ? { address: (saved?.address ?? "").trim(), postcode: pc } : null;
}
