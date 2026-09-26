// The periodic table: all 118 elements with the values a school data sheet gives (relative atomic mass to school precision; bracket-free — for elements with
// no stable isotope the mass number of the longest-lived isotope). Group / period / category are derived, not typed, so they cannot drift from the layout.

export type Category = "alkali" | "alkaline-earth" | "transition" | "post-transition" | "metalloid" | "nonmetal" | "halogen" | "noble" | "lanthanide" | "actinide";
export interface Element { z: number; sym: string; name: string; ar: number; period: number; group: number | null; category: Category; shells: string | null }

// [symbol, name, relative atomic mass], in atomic-number order (Z = index + 1).
const RAW: [string, string, number][] = [
  ["H", "Hydrogen", 1], ["He", "Helium", 4], ["Li", "Lithium", 7], ["Be", "Beryllium", 9], ["B", "Boron", 11], ["C", "Carbon", 12], ["N", "Nitrogen", 14], ["O", "Oxygen", 16], ["F", "Fluorine", 19], ["Ne", "Neon", 20],
  ["Na", "Sodium", 23], ["Mg", "Magnesium", 24], ["Al", "Aluminium", 27], ["Si", "Silicon", 28], ["P", "Phosphorus", 31], ["S", "Sulfur", 32], ["Cl", "Chlorine", 35.5], ["Ar", "Argon", 40],
  ["K", "Potassium", 39], ["Ca", "Calcium", 40], ["Sc", "Scandium", 45], ["Ti", "Titanium", 48], ["V", "Vanadium", 51], ["Cr", "Chromium", 52], ["Mn", "Manganese", 55], ["Fe", "Iron", 56], ["Co", "Cobalt", 59], ["Ni", "Nickel", 59],
  ["Cu", "Copper", 63.5], ["Zn", "Zinc", 65], ["Ga", "Gallium", 70], ["Ge", "Germanium", 73], ["As", "Arsenic", 75], ["Se", "Selenium", 79], ["Br", "Bromine", 80], ["Kr", "Krypton", 84],
  ["Rb", "Rubidium", 85.5], ["Sr", "Strontium", 88], ["Y", "Yttrium", 89], ["Zr", "Zirconium", 91], ["Nb", "Niobium", 93], ["Mo", "Molybdenum", 96], ["Tc", "Technetium", 98], ["Ru", "Ruthenium", 101], ["Rh", "Rhodium", 103],
  ["Pd", "Palladium", 106], ["Ag", "Silver", 108], ["Cd", "Cadmium", 112], ["In", "Indium", 115], ["Sn", "Tin", 119], ["Sb", "Antimony", 122], ["Te", "Tellurium", 128], ["I", "Iodine", 127], ["Xe", "Xenon", 131],
  ["Cs", "Caesium", 133], ["Ba", "Barium", 137], ["La", "Lanthanum", 139], ["Ce", "Cerium", 140], ["Pr", "Praseodymium", 141], ["Nd", "Neodymium", 144], ["Pm", "Promethium", 145], ["Sm", "Samarium", 150], ["Eu", "Europium", 152],
  ["Gd", "Gadolinium", 157], ["Tb", "Terbium", 159], ["Dy", "Dysprosium", 163], ["Ho", "Holmium", 165], ["Er", "Erbium", 167], ["Tm", "Thulium", 169], ["Yb", "Ytterbium", 173], ["Lu", "Lutetium", 175],
  ["Hf", "Hafnium", 178.5], ["Ta", "Tantalum", 181], ["W", "Tungsten", 184], ["Re", "Rhenium", 186], ["Os", "Osmium", 190], ["Ir", "Iridium", 192], ["Pt", "Platinum", 195], ["Au", "Gold", 197], ["Hg", "Mercury", 201],
  ["Tl", "Thallium", 204], ["Pb", "Lead", 207], ["Bi", "Bismuth", 209], ["Po", "Polonium", 209], ["At", "Astatine", 210], ["Rn", "Radon", 222],
  ["Fr", "Francium", 223], ["Ra", "Radium", 226], ["Ac", "Actinium", 227], ["Th", "Thorium", 232], ["Pa", "Protactinium", 231], ["U", "Uranium", 238], ["Np", "Neptunium", 237], ["Pu", "Plutonium", 244], ["Am", "Americium", 243],
  ["Cm", "Curium", 247], ["Bk", "Berkelium", 247], ["Cf", "Californium", 251], ["Es", "Einsteinium", 252], ["Fm", "Fermium", 257], ["Md", "Mendelevium", 258], ["No", "Nobelium", 259], ["Lr", "Lawrencium", 262],
  ["Rf", "Rutherfordium", 267], ["Db", "Dubnium", 268], ["Sg", "Seaborgium", 271], ["Bh", "Bohrium", 272], ["Hs", "Hassium", 270], ["Mt", "Meitnerium", 276], ["Ds", "Darmstadtium", 281], ["Rg", "Roentgenium", 280],
  ["Cn", "Copernicium", 285], ["Nh", "Nihonium", 286], ["Fl", "Flerovium", 289], ["Mc", "Moscovium", 290], ["Lv", "Livermorium", 293], ["Ts", "Tennessine", 294], ["Og", "Oganesson", 294],
];

const PERIOD_END = [2, 10, 18, 36, 54, 86, 118];
const periodOf = (z: number) => PERIOD_END.findIndex((e) => z <= e) + 1;
/** Group 1–18 in the standard layout; null for the lanthanides (57–71) and actinides (89–103), which sit in their own rows below the table. */
function groupOf(z: number): number | null {
  const p = periodOf(z), first = p === 1 ? 1 : PERIOD_END[p - 2]! + 1, i = z - first; // 0-based position within the period
  if (p === 1) return z === 1 ? 1 : 18;
  if (p === 2 || p === 3) return i < 2 ? i + 1 : i + 11;
  if (p === 4 || p === 5) return i + 1;
  if (z >= 57 && z <= 71) return null;
  if (z >= 89 && z <= 103) return null;
  if (p === 6) return z <= 56 ? i + 1 : z - 71 + 3; // Cs, Ba = 1, 2; Hf (72) = 4 … Rn (86) = 18
  return z <= 88 ? i + 1 : z - 103 + 3; // Fr, Ra = 1, 2; Rf (104) = 4 … Og (118) = 18
}
const METALLOID = new Set(["B", "Si", "Ge", "As", "Sb", "Te"]);
const NONMETAL = new Set(["H", "C", "N", "O", "P", "S", "Se"]);
const POST = new Set(["Al", "Ga", "In", "Sn", "Tl", "Pb", "Bi", "Po", "Nh", "Fl", "Mc", "Lv"]);
function categoryOf(z: number, sym: string, g: number | null): Category {
  if (z >= 57 && z <= 71) return "lanthanide";
  if (z >= 89 && z <= 103) return "actinide";
  if (g === 18) return "noble";
  if (g === 17) return "halogen";
  if (sym === "H" || NONMETAL.has(sym)) return "nonmetal";
  if (METALLOID.has(sym)) return "metalloid";
  if (g === 1) return "alkali";
  if (g === 2) return "alkaline-earth";
  if (POST.has(sym)) return "post-transition";
  return "transition";
}
const TRANSITION_SHELLS: Record<number, string> = { 21: "2,8,9,2", 22: "2,8,10,2", 23: "2,8,11,2", 24: "2,8,13,1", 25: "2,8,13,2", 26: "2,8,14,2", 27: "2,8,15,2", 28: "2,8,16,2", 29: "2,8,18,1", 30: "2,8,18,2" };
/** The school electron arrangement (2,8,1 …) for the first 36 elements; null beyond that (not asked at school level). */
function shellsOf(z: number): string | null {
  if (z > 36) return null;
  if (TRANSITION_SHELLS[z]) return TRANSITION_SHELLS[z]!;
  if (z <= 2) return String(z);
  if (z <= 10) return `2,${z - 2}`;
  if (z <= 18) return `2,8,${z - 10}`;
  if (z <= 20) return `2,8,8,${z - 18}`;
  return `2,8,18,${z - 28}`; // 31–36
}

export const ELEMENTS: Element[] = RAW.map(([sym, name, ar], i) => {
  const z = i + 1, group = groupOf(z);
  return { z, sym, name, ar, period: periodOf(z), group, category: categoryOf(z, sym, group), shells: shellsOf(z) };
});
export const byZ = (z: number) => ELEMENTS[z - 1];
export const CATEGORY_LABEL: Record<Category, string> = { alkali: "Alkali metal", "alkaline-earth": "Alkaline earth metal", transition: "Transition metal", "post-transition": "Post-transition metal", metalloid: "Metalloid", nonmetal: "Non-metal", halogen: "Halogen", noble: "Noble gas", lanthanide: "Lanthanide", actinide: "Actinide" };
/** Find elements by name, symbol or atomic number (case-insensitive, partial names allowed). */
export function findElements(q: string): Element[] {
  const t = q.trim().toLowerCase();
  if (!t) return [];
  if (/^\d+$/.test(t)) { const e = byZ(Number(t)); return e ? [e] : []; }
  return ELEMENTS.filter((e) => e.sym.toLowerCase() === t || e.name.toLowerCase().startsWith(t) || e.name.toLowerCase().includes(t));
}
