/** A Content-Disposition value that survives any file name. Node refuses a
 *  header with characters above 0xFF (a curly apostrophe, an en dash), which
 *  turned the download into a 500 — so send an ASCII fallback plus the
 *  RFC 5987 UTF-8 form. */
export function contentDisposition(kind: "inline" | "attachment", name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "");
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
