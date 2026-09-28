// Tiny helper so the pure logic modules can return translated messages when the UI passes its `t`, and plain English otherwise
// (the *.selftest.ts files call them without a translator). Keys are written without the "hubtoolsb." namespace.
export type Tr = (key: string, vars?: Record<string, string | number>) => string;

export function say(tr: Tr | undefined, key: string, en: string, vars?: Record<string, string | number>): string {
  if (tr) return tr(`hubtoolsb.${key}`, vars);
  return vars ? Object.entries(vars).reduce((s, [k, v]) => s.split(`{${k}}`).join(String(v)), en) : en;
}
