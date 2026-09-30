import { Fragment, type ReactNode } from "react";

/**
 * Translate a catalogue string that embeds React nodes (bold names, links…).
 * `parts` maps a {placeholder} in the string to the node to render there; `vars` are plain text placeholders.
 * The translator keeps word order, so each language decides where the bold bit goes.
 */
export function richT(t: (k: string, v?: Record<string, string | number>) => string, key: string, parts: Record<string, ReactNode>, vars: Record<string, string | number> = {}): ReactNode {
  const names = Object.keys(parts);
  const marks: Record<string, string> = {};
  names.forEach((n, i) => { marks[n] = `\u0001${i}\u0001`; });
  const out = t(key, { ...vars, ...marks });
  return out.split(/(\u0001\d+\u0001)/).map((seg, i) => {
    const m = /^\u0001(\d+)\u0001$/.exec(seg);
    return m ? <Fragment key={i}>{parts[names[Number(m[1])]]}</Fragment> : <Fragment key={i}>{seg}</Fragment>;
  });
}
