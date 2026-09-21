// X3: verified Science picture extension (biology, chemistry, physics, earth and space). Registered in library.ts.
import type { Pic } from "./types";
import { BIO1 } from "./ext-science-bio1";
import { BIO2 } from "./ext-science-bio2";
import { BIO3 } from "./ext-science-bio3";
import { CHEM1 } from "./ext-science-chem1";
import { CHEM2 } from "./ext-science-chem2";
import { PHYS } from "./ext-science-phys";

export const EXT_SCIENCE: Pic[] = [...BIO1, ...BIO2, ...BIO3, ...CHEM1, ...CHEM2, ...PHYS];
