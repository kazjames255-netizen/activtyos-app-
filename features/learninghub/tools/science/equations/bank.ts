// Original bank of unbalanced equation skeletons. The solver supplies the answer.

export type EqType =
  | "combustion" | "neutralisation" | "metal + acid" | "metal + oxygen" | "displacement"
  | "thermal decomposition" | "precipitation" | "extraction" | "respiration / photosynthesis" | "other";
export type EqLevel = 1 | 2 | 3;
export interface BankEquation { id: string; level: EqLevel; type: EqType; name: string; eq: string }

export const EQ_TYPES: EqType[] = ["combustion", "neutralisation", "metal + acid", "metal + oxygen", "displacement", "thermal decomposition", "precipitation", "extraction", "respiration / photosynthesis", "other"];

const b = (id: string, level: EqLevel, type: EqType, name: string, eq: string): BankEquation => ({ id, level, type, name, eq });

export const BANK: BankEquation[] = [
  // Level 1: simple KS3
  b("e01", 1, "other", "hydrogen + oxygen -> water", "H2 + O2 -> H2O"),
  b("e02", 1, "metal + oxygen", "magnesium + oxygen -> magnesium oxide", "Mg + O2 -> MgO"),
  b("e03", 1, "combustion", "carbon + oxygen -> carbon dioxide", "C + O2 -> CO2"),
  b("e04", 1, "other", "nitrogen + hydrogen -> ammonia", "N2 + H2 -> NH3"),
  b("e05", 1, "metal + oxygen", "sodium + oxygen -> sodium oxide", "Na + O2 -> Na2O"),
  b("e06", 1, "metal + oxygen", "copper + oxygen -> copper oxide", "Cu + O2 -> CuO"),
  b("e07", 1, "other", "hydrogen + chlorine -> hydrogen chloride", "H2 + Cl2 -> HCl"),
  b("e08", 1, "thermal decomposition", "hydrogen peroxide -> water + oxygen", "H2O2 -> H2O + O2"),
  b("e09", 1, "displacement", "zinc + copper chloride -> zinc chloride + copper", "Zn + CuCl2 -> ZnCl2 + Cu"),
  b("e10", 1, "metal + acid", "magnesium + hydrochloric acid -> magnesium chloride + hydrogen", "Mg + HCl -> MgCl2 + H2"),
  b("e11", 1, "combustion", "methane + oxygen -> carbon dioxide + water", "CH4 + O2 -> CO2 + H2O"),
  b("e12", 1, "thermal decomposition", "calcium carbonate -> calcium oxide + carbon dioxide", "CaCO3 -> CaO + CO2"),
  b("e13", 1, "neutralisation", "sodium hydroxide + hydrochloric acid -> sodium chloride + water", "NaOH + HCl -> NaCl + H2O"),
  b("e14", 1, "metal + oxygen", "calcium + oxygen -> calcium oxide", "Ca + O2 -> CaO"),
  // Level 2: KS4 foundation
  b("e15", 2, "combustion", "ethane + oxygen -> carbon dioxide + water", "C2H6 + O2 -> CO2 + H2O"),
  b("e16", 2, "combustion", "propane + oxygen -> carbon dioxide + water", "C3H8 + O2 -> CO2 + H2O"),
  b("e17", 2, "combustion", "ethene + oxygen -> carbon dioxide + water", "C2H4 + O2 -> CO2 + H2O"),
  b("e18", 2, "combustion", "ethanol + oxygen -> carbon dioxide + water", "C2H5OH + O2 -> CO2 + H2O"),
  b("e19", 2, "combustion", "methanol + oxygen -> carbon dioxide + water", "CH3OH + O2 -> CO2 + H2O"),
  b("e20", 2, "metal + acid", "zinc + hydrochloric acid -> zinc chloride + hydrogen", "Zn + HCl -> ZnCl2 + H2"),
  b("e21", 2, "metal + acid", "aluminium + hydrochloric acid -> aluminium chloride + hydrogen", "Al + HCl -> AlCl3 + H2"),
  b("e22", 2, "metal + acid", "magnesium + sulfuric acid -> magnesium sulfate + hydrogen", "Mg + H2SO4 -> MgSO4 + H2"),
  b("e23", 2, "metal + acid", "sodium + water -> sodium hydroxide + hydrogen", "Na + H2O -> NaOH + H2"),
  b("e24", 2, "metal + oxygen", "aluminium + oxygen -> aluminium oxide", "Al + O2 -> Al2O3"),
  b("e25", 2, "metal + oxygen", "iron + oxygen -> iron(III) oxide", "Fe + O2 -> Fe2O3"),
  b("e26", 2, "neutralisation", "sodium hydroxide + sulfuric acid -> sodium sulfate + water", "NaOH + H2SO4 -> Na2SO4 + H2O"),
  b("e27", 2, "neutralisation", "calcium hydroxide + hydrochloric acid -> calcium chloride + water", "Ca(OH)2 + HCl -> CaCl2 + H2O"),
  b("e28", 2, "neutralisation", "magnesium oxide + hydrochloric acid -> magnesium chloride + water", "MgO + HCl -> MgCl2 + H2O"),
  b("e29", 2, "neutralisation", "copper oxide + sulfuric acid -> copper sulfate + water", "CuO + H2SO4 -> CuSO4 + H2O"),
  b("e30", 2, "displacement", "magnesium + copper sulfate -> magnesium sulfate + copper", "Mg + CuSO4 -> MgSO4 + Cu"),
  b("e31", 2, "displacement", "chlorine + potassium bromide -> potassium chloride + bromine", "Cl2 + KBr -> KCl + Br2"),
  b("e32", 2, "displacement", "zinc + silver nitrate -> zinc nitrate + silver", "Zn + AgNO3 -> Zn(NO3)2 + Ag"),
  b("e33", 2, "thermal decomposition", "copper carbonate -> copper oxide + carbon dioxide", "CuCO3 -> CuO + CO2"),
  b("e34", 2, "thermal decomposition", "potassium chlorate -> potassium chloride + oxygen", "KClO3 -> KCl + O2"),
  b("e35", 2, "respiration / photosynthesis", "aerobic respiration", "C6H12O6 + O2 -> CO2 + H2O"),
  b("e36", 2, "respiration / photosynthesis", "photosynthesis", "CO2 + H2O -> C6H12O6 + O2"),
  b("e37", 2, "precipitation", "silver nitrate + sodium chloride -> silver chloride + sodium nitrate", "AgNO3 + NaCl -> AgCl + NaNO3"),
  // Level 3: KS4 higher
  b("e38", 3, "combustion", "butane + oxygen -> carbon dioxide + water", "C4H10 + O2 -> CO2 + H2O"),
  b("e39", 3, "combustion", "pentane + oxygen -> carbon dioxide + water", "C5H12 + O2 -> CO2 + H2O"),
  b("e40", 3, "combustion", "octane + oxygen -> carbon dioxide + water", "C8H18 + O2 -> CO2 + H2O"),
  b("e41", 3, "combustion", "propan-1-ol + oxygen -> carbon dioxide + water", "C3H7OH + O2 -> CO2 + H2O"),
  b("e42", 3, "extraction", "iron(III) oxide + carbon monoxide -> iron + carbon dioxide", "Fe2O3 + CO -> Fe + CO2"),
  b("e43", 3, "extraction", "iron(III) oxide + carbon -> iron + carbon dioxide", "Fe2O3 + C -> Fe + CO2"),
  b("e44", 3, "extraction", "zinc oxide + carbon -> zinc + carbon monoxide", "ZnO + C -> Zn + CO"),
  b("e45", 3, "displacement", "thermite reaction", "Al + Fe2O3 -> Al2O3 + Fe"),
  b("e46", 3, "neutralisation", "aluminium hydroxide + sulfuric acid -> aluminium sulfate + water", "Al(OH)3 + H2SO4 -> Al2(SO4)3 + H2O"),
  b("e47", 3, "neutralisation", "calcium hydroxide + nitric acid -> calcium nitrate + water", "Ca(OH)2 + HNO3 -> Ca(NO3)2 + H2O"),
  b("e48", 3, "neutralisation", "ammonia + sulfuric acid -> ammonium sulfate", "NH3 + H2SO4 -> (NH4)2SO4"),
  b("e49", 3, "metal + acid", "aluminium + sulfuric acid -> aluminium sulfate + hydrogen", "Al + H2SO4 -> Al2(SO4)3 + H2"),
  b("e50", 3, "precipitation", "barium chloride + aluminium sulfate -> barium sulfate + aluminium chloride", "BaCl2 + Al2(SO4)3 -> BaSO4 + AlCl3"),
  b("e51", 3, "precipitation", "lead nitrate + potassium iodide -> lead iodide + potassium nitrate", "Pb(NO3)2 + KI -> PbI2 + KNO3"),
  b("e52", 3, "precipitation", "iron(III) chloride + sodium hydroxide -> iron(III) hydroxide + sodium chloride", "FeCl3 + NaOH -> Fe(OH)3 + NaCl"),
  b("e53", 3, "thermal decomposition", "hydrated copper sulfate -> anhydrous copper sulfate + water", "CuSO4.5H2O -> CuSO4 + H2O"),
  b("e54", 3, "thermal decomposition", "sodium hydrogencarbonate -> sodium carbonate + water + carbon dioxide", "NaHCO3 -> Na2CO3 + H2O + CO2"),
  b("e55", 3, "thermal decomposition", "lead nitrate -> lead oxide + nitrogen dioxide + oxygen", "Pb(NO3)2 -> PbO + NO2 + O2"),
  b("e56", 3, "metal + oxygen", "iron + steam -> iron oxide + hydrogen", "Fe + H2O -> Fe3O4 + H2"),
  b("e57", 3, "other", "ammonia + oxygen -> nitrogen monoxide + water", "NH3 + O2 -> NO + H2O"),
];
