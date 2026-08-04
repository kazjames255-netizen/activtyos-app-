// The 14 allergens UK food law requires to be declared — mirrors UK_ALLERGENS
// in server/src/routes/meals.ts. Used by the meal-shop editor and the parent
// ordering page so a meal on sale carries its allergen tags.
export const UK_ALLERGENS = [
  "celery", "gluten", "crustaceans", "eggs", "fish", "lupin", "milk",
  "molluscs", "mustard", "nuts", "peanuts", "sesame", "soya", "sulphites",
] as const;
