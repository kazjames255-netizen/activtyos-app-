// The 14 allergens UK food law requires to be declared — mirrors UK_ALLERGENS
// in server/src/routes/meals.ts. Used by the meal-shop editor and the parent
// ordering page so a meal on sale carries its allergen tags.
export const UK_ALLERGENS = [
  "celery", "gluten", "crustaceans", "eggs", "fish", "lupin", "milk",
  "molluscs", "mustard", "nuts", "peanuts", "sesame", "soya", "sulphites",
] as const;

// Free-text allergies → the 14 UK allergens a dish can carry. ONE list, shared
// by the parent's meal picker, the kitchen view and the server — they used to
// keep their own copies, and both missed the case below.
//
// Matching is deliberately generous: a hit means "please check", never "safe",
// so over-matching is the safe direction. A child recorded with a "nut allergy"
// must be warned about a PEANUT dish (peanuts are the classic nut allergy even
// though they're a legume), so "nut" matches both nuts and peanuts.
export const ALLERGEN_SYNONYMS: Record<string, string[]> = {
  milk: ["milk", "dairy", "lactose", "cheese", "butter", "cream", "casein", "whey"],
  gluten: ["gluten", "wheat", "coeliac", "celiac", "barley", "rye", "spelt"],
  eggs: ["egg"],
  fish: ["fish", "cod", "salmon", "tuna", "haddock"],
  crustaceans: ["crustacean", "shellfish", "prawn", "shrimp", "crab", "lobster"],
  molluscs: ["mollusc", "shellfish", "squid", "mussel", "oyster", "clam"],
  peanuts: ["peanut", "groundnut", "arachis", "nut"],
  nuts: ["nut", "almond", "cashew", "walnut", "hazelnut", "pecan", "pistachio", "brazil", "macadamia"],
  soya: ["soya", "soy"],
  sesame: ["sesame", "tahini"],
  celery: ["celery", "celeriac"],
  mustard: ["mustard"],
  lupin: ["lupin"],
  sulphites: ["sulphite", "sulfite", "sulphur", "sulfur"],
};

/** Which of a dish's allergens the child's free-text allergies may cover. */
export function allergenHits(allergyText: string | undefined, dishAllergens: Iterable<string> | undefined): string[] {
  const t = (allergyText ?? "").toLowerCase();
  if (!t.trim() || !dishAllergens) return [];
  const hits: string[] = [];
  for (const a of dishAllergens) {
    const key = a.toLowerCase();
    if ((ALLERGEN_SYNONYMS[key] ?? [key]).some((term) => t.includes(term))) hits.push(a);
  }
  return hits;
}
