// Was a dose actually given? `given` (the form's explicit outcome) wins; otherwise the free-text dose decides. Free text such as
// "No dose", "Missed" or "Refused" used to be reported to the parent as GIVEN - only "Not given..." was recognised (health run H22).
// Pure on purpose: tested for every spelling in tests/med-dose-given.test.mts.

const NOT_GIVEN = new RegExp(
  "^\\s*(" + [
    "not[\\s-]*given", "not[\\s-]*taken", "no[\\s-]*dose", "dose[\\s-]*not[\\s-]*(given|taken)", "didn'?t[\\s-]*(take|have)", "did[\\s-]*not[\\s-]*(take|have)",
    "miss(ed)?\\b", "refus", "declin", "skip", "withh[eo]ld", "omitted", "none\\b", "nil\\b", "nothing\\b",
  ].join("|") + ")",
  "i",
);

export function doseWasGiven(doseGiven: string, given?: boolean): boolean {
  if (typeof given === "boolean") return given;
  return !NOT_GIVEN.test(String(doseGiven ?? ""));
}
