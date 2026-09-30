// Stable catalogue key for an API error message. Template variables (${x} on the server, {v1} here) are collapsed to "X" so every
// instance of one template shares a key. A short hash keeps two long messages with the same 40-character prefix apart.
export function apiErrorKey(message: string): string {
  const norm = message.replace(/\{v\d+\}/g, "X");
  let h = 2166136261;
  for (let i = 0; i < norm.length; i++) { h ^= norm.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  const slug = norm.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40).replace(/_+$/, "");
  return `e_${slug}_${h.toString(36)}`;
}
