// Pure text helpers for "which add-ons does this listing offer" (editor summary + parent-facing extras line). No UI, no translation here:
// callers pass already-translated pieces so the same rules are testable and the wording stays in the message files.

export interface OfferAddon { id: string; name: string; price: number; type?: string }

/** How many of the account's add-ons are switched on for this listing (ids that no longer exist do not count). */
export function offeredCount(allAddons: { id: string }[], addonIds: string[]): { on: number; total: number } {
  const have = new Set(allAddons.map((a) => a.id));
  return { on: new Set(addonIds.filter((id) => have.has(id))).size, total: allAddons.length };
}

/** Show the gentle "switch one on" hint only when the account has add-ons and none is on. */
export function showNoneOnHint(c: { on: number; total: number }): boolean {
  return c.total > 0 && c.on === 0;
}

/** "tshirty (£10.00/day), water bottle (£5.00)" in the listing's own order. Empty list gives "". */
export function extrasList(addons: OfferAddon[], fmt: { money: (n: number) => string; perDay: (price: string) => string }): string {
  return addons
    .filter((a) => a.name?.trim())
    .map((a) => `${a.name.trim()} (${a.type === "perday" ? fmt.perDay(fmt.money(a.price)) : fmt.money(a.price)})`)
    .join(", ");
}
