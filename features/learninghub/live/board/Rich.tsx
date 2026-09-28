import type { ReactNode } from "react";

/** Renders a translated string where **double-starred** parts are bold (keeps word order per language). */
export function Rich({ text }: { text: string }): ReactNode {
  return <>{text.split("**").map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part))}</>;
}

/** Translation lookup that falls back to the English source when a key isn't catalogued (e.g. tutor-defined or newly added items). */
export function tx(t: (k: string, v?: Record<string, string | number>) => string, key: string, fallback: string): string {
  const r = t(key);
  return r === key ? fallback : r;
}

export { slug } from "./boardI18n";
