import en, { type Messages } from "./en";
import pl from "./pl";
import ro from "./ro";
import ur from "./ur";
import ar from "./ar";
import fr from "./fr";
import es from "./es";
import type { LocaleCode } from "../config";

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

// Authored catalogues. Locales not yet fully authored (pa/bn/pt/cy) fall back to
// English so the app stays usable while translations are added area-by-area.
export const CATALOGS: Record<LocaleCode, DeepPartial<Messages>> = {
  en, pl, ro, ur, ar, fr, es,
  pa: en, bn: en, pt: en, cy: en,
};

export type { Messages };
export { en };
