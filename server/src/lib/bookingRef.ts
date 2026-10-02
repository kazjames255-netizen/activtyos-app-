import { db } from "../firebase";

/** The letters a provider's booking references start with: the first three letters of their name ("Amir Coaching" -> "AMI"). Falls back to "APF" for a name with fewer than three letters. */
export function prefixFromName(name?: string | null): string {
  const letters = (name ?? "").normalize("NFD").replace(/[^A-Za-z]/g, "").toUpperCase();
  return letters.length >= 3 ? letters.slice(0, 3) : "APF";
}

const cache = new Map<string, { p: string; at: number }>();

/** The prefix for a tenant's new bookings (cached for ten minutes; a failed lookup just falls back to "APF" and never blocks a booking). */
export async function refPrefixFor(tenantId: string): Promise<string> {
  const hit = cache.get(tenantId);
  if (hit && Date.now() - hit.at < 600_000) return hit.p;
  let p = "APF";
  try {
    const t = await db.collection("tenants").doc(tenantId).get();
    p = prefixFromName(t.get("name") as string | undefined);
  } catch {
    /* keep the fallback */
  }
  cache.set(tenantId, { p, at: Date.now() });
  return p;
}
