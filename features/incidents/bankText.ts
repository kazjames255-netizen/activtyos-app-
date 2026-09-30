import { TREATMENT_BANK } from "./firstAid";
import { BEHAVIOUR_ACTIONS } from "./behaviourBank";

// The first-aid treatment and behaviour-action pick lists are stored as canonical English strings (the log, the
// "relevant treatments" matching and the parent's view all key off them). They are translated for DISPLAY only:
// the catalogue key is derived from the English text, and anything not in the catalogue (typed free text) shows as typed.
type T = (key: string, vars?: Record<string, string | number>) => string;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48);

export function bankLabel(t: T, s: string): string {
  const k = `p8ops.bk_${slug(s)}`;
  const r = t(k);
  return r !== k ? r : s;
}

const ALL: string[] = [...TREATMENT_BANK, ...BEHAVIOUR_ACTIONS].sort((a, b) => b.length - a.length);

/** A stored "a; b; c" text with every known pick-list phrase shown in the active language. */
export function bankText(t: T, text?: string): string {
  if (!text) return text ?? "";
  let out = text;
  for (const en of ALL) if (out.includes(en)) out = out.split(en).join(bankLabel(t, en));
  return out;
}
