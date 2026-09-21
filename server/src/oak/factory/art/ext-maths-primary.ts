// Verified picture extension: MATHS KS1-KS2 (Years 1-6), agent X1. Registered in library.ts (one line).
// Policy reminder (docs/hub-review/F1-images.md): a wrong picture is far worse than none. Every picture here is a generic diagram of a concept
// (structure, layout or definition) that cannot contradict a slide about that concept; drawings that imply a specific quantity are `numeric`.
import type { Pic } from "./types";
import { EXT_NUMBER } from "./ext-maths-primary-number";
import { EXT_MEASURE } from "./ext-maths-primary-measure";
import { EXT_SHAPE } from "./ext-maths-primary-shape";

export const EXT_MATHS_PRIMARY: Pic[] = [...EXT_NUMBER, ...EXT_MEASURE, ...EXT_SHAPE];
