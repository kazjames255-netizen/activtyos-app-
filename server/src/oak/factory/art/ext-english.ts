// X4: English teaching-diagram pictures (grammar, punctuation, word-level, text types, literary devices, reading skills, poetry, drama).
// Registered in library.ts via `EXT_ENGLISH`. Unit tests for these pictures: EXT_ENGLISH_TESTS (run by art/cli.ts check).
import type { Pic } from "./types";
import { PIC_A } from "./ext-english-a";
import { PIC_B } from "./ext-english-b";
import { PIC_C } from "./ext-english-c";
import { PIC_D } from "./ext-english-d";
export { EXT_ENGLISH_WARN } from "./ext-english-kit";

export const EXT_ENGLISH: Pic[] = [...PIC_A, ...PIC_B, ...PIC_C, ...PIC_D];
