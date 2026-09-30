/** A URL the UI will render as a clickable link (receipts, PO copies, certificate documents): web addresses only.
 *  A staff member could submit `javascript:…` (or a phishing address dressed as "receipt") as a claim's receiptUrl and it was
 *  rendered as <a href> in the manager's claims list. Uploads come back as http(s) /api/images/… URLs, so nothing legitimate is refused.
 *  Blank is allowed (no attachment). */
export function isBlankOrWebUrl(u: string): boolean {
  if (u === "") return true;
  if (u.startsWith("/api/images/")) return true;
  try { const x = new URL(u); return x.protocol === "https:" || x.protocol === "http:"; } catch { return false; }
}
