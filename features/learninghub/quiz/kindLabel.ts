import type { QuestionKind } from "../shared-assess/api";

// The tenant's question kinds carry an editable English label (lib/hubConfig HUB_DEFAULTS). When a kind still wears the DEFAULT
// label for its DEFAULT id we show the translated name; a tutor's own renamed / custom kind is shown exactly as written.
const DEFAULTS: Record<string, [label: string, key: string]> = {
  single: ["Single choice", "hubfam.qzKindSingle"],
  multi: ["Multiple choice", "hubfam.qzKindMulti"],
  short: ["Short answer", "hubfam.qzKindShort"],
  number: ["Number", "hubfam.qzKindNumber"],
  match: ["Matching pairs", "hubfam.qzKindMatch"],
  order: ["Put in order", "hubfam.qzKindOrder"],
  tool: ["Tool question (ruler, protractor, grid…)", "hubfam.qzKindTool"],
  written: ["Written answer (tutor marks)", "hubfam.qzKindWritten"],
};

/** Display name of a question kind, translated when it is one of the built-in defaults. */
export function kindText(t: (k: string) => string, kinds: QuestionKind[], id: string): string {
  const k = kinds.find((x) => x.id === id);
  const def = DEFAULTS[id];
  if (def && (!k || k.label === def[0])) return t(def[1]);
  return k?.label ?? id;
}
