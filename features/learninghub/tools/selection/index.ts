// The shipped rule set (one JSON per subject, git-reviewed) + the calls the rest of the app makes.
import cross from "./rules/cross.json";
import english from "./rules/english.json";
import languages from "./rules/languages.json";
import maths from "./rules/maths.json";
import science from "./rules/science.json";
import { mergeRules, selectTools, type SelectOptions } from "./select";
import type { RuleSet, Signal, Suggestion } from "./types";

export const RULES: RuleSet = mergeRules([maths, english, science, languages, cross] as RuleSet[], "2026-09-23");
export const suggest = (sig: Signal, isAvailable: (toolId: string) => boolean, opts?: SelectOptions): Suggestion[] => selectTools(sig, RULES, isAvailable, opts);
export { unitFromKey, programmeFromKey } from "./select";
export type { Signal, Suggestion, Overrides } from "./types";
