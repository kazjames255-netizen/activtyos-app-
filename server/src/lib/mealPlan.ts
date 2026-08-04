// A listing's meal plan maps an ISO run-date to the menu (and the specific
// dishes) served that day. Older plans stored just a menu-id string (= the
// whole menu); this normalises both shapes to one.
export type MealDayPlan = { menuId: string; itemIds: string[] };

export function mealDayPlan(v: unknown): MealDayPlan | null {
  if (typeof v === "string") return v ? { menuId: v, itemIds: [] } : null;
  if (v && typeof v === "object" && typeof (v as { menuId?: unknown }).menuId === "string") {
    const o = v as { menuId: string; itemIds?: unknown };
    return { menuId: o.menuId, itemIds: Array.isArray(o.itemIds) ? o.itemIds.filter((x): x is string => typeof x === "string") : [] };
  }
  return null;
}

// The dishes actually served on a day: the menu's items filtered to the plan's
// itemIds (an empty itemIds = the whole menu).
export function dishesForDay(plan: MealDayPlan, items: { id: string }[]): { id: string }[] {
  return plan.itemIds.length ? items.filter((it) => plan.itemIds.includes(it.id)) : items;
}
