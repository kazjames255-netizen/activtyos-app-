// PURE selection rules for a daily/one-off extra at checkout, across every pass (basket line) and child. The checkout view only renders these.

export interface Slot { itemId: string; child: string; dates: string[] }
export type SelState = "none" | "some" | "all";

/** Every (basket line, child) the extra can be ticked for. */
export function slotsOf(items: { id: string; dates: string[] }[], childrenOn: (id: string) => string[]): Slot[] {
  return items.flatMap((x) => childrenOn(x.id).map((child) => ({ itemId: x.id, child, dates: x.dates })));
}

/** What a slot holds when fully on: every day of its pass for a daily extra, or the "*" marker for a one-off. */
export const fullOf = (s: Slot, perDay: boolean): string[] => (perDay ? [...s.dates] : ["*"]);

/** Is this slot completely ticked? (compares the actual days, not just how many.) */
export function slotFull(s: Slot, days: string[], perDay: boolean): boolean {
  return perDay ? s.dates.length > 0 && s.dates.every((d) => days.includes(d)) : days.length > 0;
}

/** none / some / all across the given slots. */
export function selState(slots: Slot[], daysOf: (s: Slot) => string[], perDay: boolean): SelState {
  if (!slots.length) return "none";
  const full = slots.filter((s) => slotFull(s, daysOf(s), perDay)).length;
  const any = slots.some((s) => daysOf(s).length > 0);
  return full === slots.length ? "all" : any ? "some" : "none";
}

/** The new days for every slot after the banner (or per-pass) button is pressed: all on, unless everything is already on, then all off. */
export function sweepTo(slots: Slot[], daysOf: (s: Slot) => string[], perDay: boolean): { slot: Slot; days: string[] }[] {
  const off = selState(slots, daysOf, perDay) === "all";
  return slots.map((slot) => ({ slot, days: off ? [] : fullOf(slot, perDay) }));
}

/** Which message the "all days" button needs: 1 day, both days (2), all N. */
export function allDaysForm(n: number): { key: "allNDays_one" | "allBothDays" | "allNDays_other"; plural: boolean } {
  return n === 1 ? { key: "allNDays_one", plural: false } : n === 2 ? { key: "allBothDays", plural: false } : { key: "allNDays_other", plural: true };
}

/** Required questions still unanswered for ticked slots (a size must be chosen before Next/Pay). */
export function missingAnswers(
  slots: Slot[], daysOf: (s: Slot) => string[], questions: { id: string; label: string; required?: boolean }[], answerOf: (s: Slot, qid: string) => string,
): { slot: Slot; qid: string; label: string }[] {
  return slots.filter((s) => daysOf(s).length > 0).flatMap((slot) =>
    questions.filter((q) => q.required && !answerOf(slot, q.id).trim()).map((q) => ({ slot, qid: q.id, label: q.label })));
}

/** "Same for all days": the other ticked slots of the same child, to copy an answer onto. */
export function copyTargets(slots: Slot[], from: Slot, daysOf: (s: Slot) => string[]): Slot[] {
  return slots.filter((s) => s.child === from.child && s.itemId !== from.itemId && daysOf(s).length > 0);
}
