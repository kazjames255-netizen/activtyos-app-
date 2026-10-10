// Pure checks over the assistant's knowledge text (lib/setupKnowledge.ts). Run by tests/knowledge-lint.test.mts in CI.
// Deliberately simple: each rule is one regex or one map, so it never fails for a reason nobody can read.

export interface KnowledgeLint {
  /** Paragraphs that repeat another paragraph (same first 160 characters). Edits land in one copy only, so the copies drift. */
  duplicates: string[];
  /** Mentions of the product name: the text must say "the platform" (the brand is about to change). */
  productNames: string[];
  /** /api/... paths the text mentions that the server does not mount. */
  badApiPaths: string[];
  /** "not built" claims. A feature that exists must not be described as missing; a genuinely missing one is worded another way. */
  notBuilt: string[];
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

export function lintKnowledge(text: string, mountedApiPaths: string[]): KnowledgeLint {
  const paras = text.split(/\n+/).map((p) => p.trim()).filter((p) => p.length >= 40);
  const seen = new Map<string, string>();
  const duplicates: string[] = [];
  for (const p of paras) {
    const key = norm(p).slice(0, 160);
    if (seen.has(key)) duplicates.push(p.slice(0, 80));
    else seen.set(key, p);
  }
  const productNames = [...text.matchAll(/activity\s?os/gi)].map((m) => text.slice(Math.max(0, m.index! - 20), m.index! + 40).replace(/\s+/g, " "));
  const badApiPaths = [...new Set([...text.matchAll(/\/api\/[a-z0-9/_-]+/gi)].map((m) => m[0].replace(/\/+$/, "")))]
    .filter((p) => !mountedApiPaths.some((m) => p === m || p.startsWith(m + "/")));
  const notBuilt = [...text.matchAll(/\(?not built( yet)?\)?/gi)].map((m) => text.slice(Math.max(0, m.index! - 60), m.index! + 30).replace(/\s+/g, " "));
  return { duplicates, productNames, badApiPaths, notBuilt };
}
