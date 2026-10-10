import { db } from "../firebase";
import { registerRows } from "./registerRows";
import type { Booking } from "../../../features/bookings/types";

// Staff-side guard (parent-portal P08): an accident or incident write-up that names ANOTHER child of the same session is read by that
// child's family too when it is shared. We can't know what staff meant, so we warn them to edit before sharing.

/** Names (full, and first name when 3+ letters) of the OTHER children booked on the same block(s) as `childId` on `date`. */
export async function otherChildNamesInSession(tenantId: string, childId: string | undefined, date?: string): Promise<string[]> {
  if (!childId) return [];
  const mine = await db.collection("bookings").where("tenantId", "==", tenantId).where("childId", "==", childId).get();
  const blockIds = [...new Set(mine.docs.map((d) => d.get("blockId") as string | undefined).filter((x): x is string => !!x))];
  const names = new Set<string>();
  for (const id of blockIds) {
    const snap = await db.collection("bookings").where("blockId", "==", id).get();
    for (const d of snap.docs) {
      const b = d.data() as Booking & { tenantId?: string };
      if (b.tenantId !== tenantId || b.status === "Cancelled" || b.status === "Declined") continue;
      // Anyone booked on the same block (the group the write-up is about), whichever day: staff may log it late, or about a different day.
      for (const r of registerRows(b, date ?? "")) {
        if (r.childId === childId || !r.name) continue;
        names.add(r.name.trim());
      }
    }
  }
  return [...names];
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Which of `names` (a full name, or its first name) appear as whole words in `text`. Returns the matching full names. */
export function namesMentioned(text: string, names: string[]): string[] {
  const hay = text.normalize("NFKD").toLowerCase();
  const found: string[] = [];
  for (const full of names) {
    const first = full.split(/\s+/)[0] ?? "";
    const cands = [full, first.length >= 3 ? first : ""].filter(Boolean);
    if (cands.some((c) => new RegExp(`(^|[^\\p{L}])${esc(c.normalize("NFKD").toLowerCase())}($|[^\\p{L}])`, "u").test(hay))) found.push(full);
  }
  return found;
}

export interface NamesWarning { code: "names_other_child"; names: string[]; message: string }

/** The warning to return to staff, or null when the write-up names no other child of the session. */
export async function otherChildWarning(tenantId: string, rec: { childId?: string; date?: string; description?: unknown; treatment?: unknown; actionTaken?: unknown; injury?: unknown }): Promise<NamesWarning | null> {
  const text = [rec.description, rec.treatment, rec.actionTaken, rec.injury].filter((x) => typeof x === "string").join("\n");
  if (!text.trim() || !rec.childId) return null;
  const names = namesMentioned(text, await otherChildNamesInSession(tenantId, rec.childId, rec.date));
  if (!names.length) return null;
  return { code: "names_other_child", names, message: `This names another child (${names.join(", ")}): edit before sharing, their family would read it.` };
}
