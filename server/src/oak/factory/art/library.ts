// The verified picture library: every purpose-drawn diagram, keyed by id.
import type { Pic } from "./types";
import { EXT_LANG_PICS } from "./ext-languages"; // X5: French / Spanish / German pictures
import { EXT_MATHS_SECONDARY } from "./ext-maths-secondary"; // X2: Maths KS3-KS4 pictures
import { EXT_SCIENCE } from "./ext-science"; // X3: Science KS1-KS4 pictures
import { SHAPES3D } from "./shapes3d";
import { ALL_2D } from "./shapes2d";
import { NUMBER } from "./number";
import { GEOMETRY } from "./geometry";
import { SCIENCE } from "./science";
import { PHYSICS } from "./physics";
import { ENGLISH, FLAGS } from "./english";
import { EXT_ENGLISH } from "./ext-english";
import { EXT_MATHS_PRIMARY } from "./ext-maths-primary";
import { applyQaGates } from "./qaGates"; // independent Science image-QA gates

export const PICS: Pic[] = [...SHAPES3D, ...ALL_2D, ...NUMBER, ...GEOMETRY, ...SCIENCE, ...PHYSICS, ...ENGLISH, ...FLAGS, ...EXT_ENGLISH, ...EXT_MATHS_PRIMARY];
PICS.push(...EXT_LANG_PICS); // X5 registration (kept on its own line)
PICS.push(...EXT_MATHS_SECONDARY); // X2 registration (kept on its own line; import below)
PICS.push(...EXT_SCIENCE); // X3 registration (kept on its own line)
applyQaGates(PICS); // Science image-QA gates (kept last: they tighten the pictures registered above)
export const PIC_BY_ID: Record<string, Pic> = Object.fromEntries(PICS.map((p) => [p.id, p]));
