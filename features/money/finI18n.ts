// Display-only helpers for the finance screens (the stored/API value always stays the canonical English string).
type T = (key: string, vars?: Record<string, string | number>) => string;

const CATS: Record<string, string> = {
  "Equipment": "p8fin.catEquipment", "Supplies": "p8fin.catSupplies", "Venue hire": "p8fin.catVenueHire", "Staff": "p8fin.catStaff", "Travel": "p8fin.catTravel",
  "Marketing": "p8fin.catMarketing", "Insurance": "p8fin.catInsurance", "Training": "p8fin.catTraining", "Software": "p8fin.catSoftware", "Utilities": "p8fin.catUtilities", "Other": "p8fin.catOther",
};

/** Expense category display label; an unknown / custom category renders as typed. */
export function catLabel(t: T, category: string | null | undefined): string {
  if (!category) return category ?? "";
  const k = CATS[category];
  return k ? t(k) : category;
}
