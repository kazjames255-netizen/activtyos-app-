import { Fragment, type ReactNode } from "react";

/** Renders a translated string containing <b>…</b> as bold nodes (no HTML injection: the text is split, never parsed). */
export function Rich({ text, bClass }: { text: string; bClass?: string }): ReactNode {
  return text.split(/<b>(.*?)<\/b>/g).map((part, i) => (i % 2 === 1 ? <b key={i} className={bClass}>{part}</b> : <Fragment key={i}>{part}</Fragment>));
}
