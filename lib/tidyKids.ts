/** A family's children as a clean list: a joined entry ("Bella James, Ava James") is split into its children, and the same child never appears twice. */
export function tidyKids<T extends { name?: string | null }>(kids: T[] | undefined | null): T[] {
  const JOINED = /,|&|\band\b/i;
  const SPLIT = /\s*(?:,|&|\band\b)\s*/i;
  const out: T[] = [];
  const seen = new Set<string>();
  const add = (k: T) => { const key = (k.name ?? "").trim().toLowerCase(); if (key && !seen.has(key)) { seen.add(key); out.push(k); } };
  const all = kids ?? [];
  all.filter((k) => !JOINED.test(k.name ?? "")).forEach(add);
  for (const k of all.filter((k) => JOINED.test(k.name ?? ""))) {
    for (const part of (k.name ?? "").split(SPLIT).map((n) => n.trim()).filter(Boolean)) add({ ...k, name: part, age: undefined } as T);
  }
  return out;
}
