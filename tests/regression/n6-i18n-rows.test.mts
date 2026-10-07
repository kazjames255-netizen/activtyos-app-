import test from "node:test";
import assert from "node:assert/strict";
import p8lst from "../../lib/i18n/messages/areas/p8lst";
import p9fr from "../../lib/i18n/messages/areas/p9fr";

// fromRows throws at import time when a row has the wrong number of columns (a language missing); a bad row once reached the live web bundle and
// blanked the whole lazy catalogue ("i18n row ... has 10 columns"). Importing the two catalogues here makes that a failing test instead.
const A = (p8lst as unknown as { default: Record<string, Record<string, string>> }).default;
const F = (p9fr as unknown as { default: Record<string, Record<string, string>> }).default;

test("the Tax-Free Childcare provider-details, registers-name and first-run strings exist in all 11 languages", () => {
  const keys = ["tfcDetTitle", "tfcDetLede", "tfcDetName", "tfcDetRegulator", "tfcDetReg", "tfcDetRegPh", "tfcDetPostcode", "tfcDetSave", "tfcDetSaved", "tfcDetReady", "tfcDetMissing", "tfcDetMName", "tfcDetMReg", "tfcDetMPostcode", "tfcDetBadReg", "tfcDetBadPc", "tfcNotReady", "regNameAsk", "regNameWhy", "regNamePh", "regNameSave", "regNameBad"];
  for (const l of ["en", "pl", "ro", "ur", "pa", "bn", "ar", "pt", "es", "fr", "cy"]) for (const k of keys) assert.ok((A[l]?.[k] ?? "").trim(), `p8lst.${k} missing in ${l}`);
  for (const l of ["en", "pl", "ro", "ur", "pa", "bn", "ar", "pt", "es", "fr", "cy"]) for (const k of ["tfc", "tfcBtn"]) assert.ok((F[l]?.[k] ?? "").trim(), `p9fr.${k} missing in ${l}`);
});
