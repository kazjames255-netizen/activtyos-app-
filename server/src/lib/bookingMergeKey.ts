/**
 * Which created booking rows may be folded into ONE joint booking at checkout.
 *
 * A booking stores a single `timing` (and the register / clash check / amend
 * flow all key off it), so rows for different timings of a block (e.g. Morning
 * vs Afternoon on the same day) must stay separate bookings. Merging them kept
 * only the first row's timing, so the second timing was charged but dropped
 * from the register and calendar (BM-007).
 */
export function mergeGroupKey(b: { blockId?: string | null; status: string; timing?: string | null }): string {
  return `${b.blockId ?? ""}|${b.status}|${(b.timing ?? "").trim().toLowerCase()}`;
}
