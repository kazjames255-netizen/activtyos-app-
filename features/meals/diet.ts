// Dietary type of a meal — set by the operator when building a menu, shown to
// parents on the menu, and used by the "quick-fill" basket shortcut. Optional:
// a dish can have no type.
export type Diet = "meat" | "veg" | "vegan";

export const DIETS: { key: Diet; label: string; short: string; icon: string; fg: string; bg: string }[] = [
  { key: "meat", label: "Meat", short: "meat", icon: "🍖", fg: "#a34a1a", bg: "#fbeee4" },
  { key: "veg", label: "Vegetarian", short: "vegetarian", icon: "🥕", fg: "#1f7a44", bg: "#e8f7ee" },
  { key: "vegan", label: "Vegan", short: "vegan", icon: "🌱", fg: "#2b7a2f", bg: "#e9f6ea" },
];

export const dietMeta = (d?: string) => DIETS.find((x) => x.key === d);
