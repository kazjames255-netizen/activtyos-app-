import { Fragment, type ReactNode } from "react";

/** Render a translated sentence that has inline elements: "Tap a {hl} to see…" + { hl: <b>word</b> } → nodes. Word order stays the translator's. */
export function rich(s: string, map: Record<string, ReactNode>): ReactNode {
  return s.split(/(\{[a-zA-Z0-9_]+\})/).map((part, i) => {
    const m = /^\{([a-zA-Z0-9_]+)\}$/.exec(part);
    return m && m[1] in map ? <Fragment key={i}>{map[m[1]]}</Fragment> : part ? <Fragment key={i}>{part}</Fragment> : null;
  });
}
