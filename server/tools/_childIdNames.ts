import { db } from "../src/firebase";
import type { KidEntry } from "../src/lib/tidyChildren";

/** childId -> real name, for every childId on a joined ("A, B") entry, so the split keeps the id on the right child. */
export async function idNamesFor(customers: { children?: KidEntry[] }[]): Promise<Map<string, string>> {
  const ids = new Set<string>();
  for (const c of customers) for (const k of c.children ?? []) if (/,|&|\band\b/i.test(String(k.name ?? "")) && (k.childId || k.id)) ids.add(String(k.childId ?? k.id));
  const out = new Map<string, string>();
  if (!ids.size) return out;
  const docs = await db.getAll(...[...ids].map((id) => db.collection("children").doc(id)));
  for (const d of docs) if (d.exists) out.set(d.id, String((d.data() as { name?: string }).name ?? ""));
  return out;
}
