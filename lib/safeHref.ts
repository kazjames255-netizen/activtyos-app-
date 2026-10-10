// The one rule for a link inside an AI answer (used by the server filter AND the chat screen): an in-app path only.
// A single "/" then a letter or digit, then plain path characters. No backslash (browsers read "/\host" as "//host"), no "%" (so no
// /%5Chost or /%2Fhost), no second slash, no spaces or control characters, no scheme. Anything else is not a link.
const SAFE = /^\/[A-Za-z0-9][A-Za-z0-9\-._~/?=&#;]*$/;
export function isSafeInternalHref(href: string): boolean {
  return SAFE.test(href) && !href.includes("//");
}
