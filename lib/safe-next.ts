/** A `next` param is only honoured when it is a same-origin relative path
 *  ("/book/abc?embed=1"). Anything else (absolute URLs, "//host", "/\host",
 *  javascript:) is dropped, so a crafted link can't bounce a user off-site. */
export function safeNext(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return null;
  if (/[\u0000-\u001f\\]/.test(raw)) return null;
  return raw;
}
