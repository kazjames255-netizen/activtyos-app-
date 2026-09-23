"use client";

import { useEffect } from "react";

// `--on-brand`: the text colour that reads on the tenant's accent. The hub's brand buttons/tabs are a gradient from --brand-2 to --brand,
// so white is only right while BOTH ends are dark enough (>= 4.5:1). A pale tenant accent (yellow, mint) gets the dark ink instead.
// Set inline on #learning-hub (HubStyles supplies the white default) and refreshed when ParentBrandTheme rewrites the root variables.
const rgb = (v: string): [number, number, number] | null => {
  const s = v.trim();
  let m = /^#([0-9a-f]{6})$/i.exec(s);
  if (m) { const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  m = /^#([0-9a-f]{3})$/i.exec(s);
  if (m) return [...m[1]].map((c) => parseInt(c + c, 16)) as [number, number, number];
  m = /^rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)/i.exec(s);
  return m ? [+m[1], +m[2], +m[3]] : null;
};
const lum = ([r, g, b]: [number, number, number]) => { const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a: [number, number, number], b: [number, number, number]) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
export const DARK_ON_BRAND = "#171534";

/** Pure: "#ffffff" when white reads (>= 4.5:1) on every given accent, else the dark ink. Unparseable input keeps white. */
export function onBrandFor(...accents: string[]): string {
  const cols = accents.map(rgb).filter((c): c is [number, number, number] => !!c);
  return cols.every((c) => ratio(c, [255, 255, 255]) >= 4.5) ? "#ffffff" : DARK_ON_BRAND;
}

export function useOnBrand(depKey: string) {
  useEffect(() => {
    const host = document.getElementById("learning-hub");
    if (!host) return;
    const apply = () => {
      const cs = getComputedStyle(host);
      host.style.setProperty("--on-brand", onBrandFor(cs.getPropertyValue("--brand-2"), cs.getPropertyValue("--brand")));
    };
    apply();
    const mo = new MutationObserver(apply);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
    return () => mo.disconnect();
  }, [depKey]);
}
