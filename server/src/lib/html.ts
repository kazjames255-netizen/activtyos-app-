/** Escape a value for an HTML email body. Anything a parent, referee or staff
 *  member typed (names, notes, captions) goes through this before it's put in
 *  HTML — otherwise it lands as live markup in an email sent from the
 *  provider's own address. */
export const esc = (v: unknown): string =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
