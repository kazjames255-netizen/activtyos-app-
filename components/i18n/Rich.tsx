import { Fragment, type ReactNode } from "react";

/** Renders a translated sentence that carries inline `<b>…</b>` emphasis, so the bold span can sit anywhere the language needs it
 *  (splicing English fragments around a <b> broke word order in every other language). Only <b> is recognised; everything else is text. */
export function Rich({ text, bClass }: { text: string; bClass?: string }): ReactNode {
  const parts = text.split(/(<b>[\s\S]*?<\/b>)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("<b>") ? <b key={i} className={bClass}>{p.slice(3, -4)}</b> : <Fragment key={i}>{p}</Fragment>,
      )}
    </>
  );
}
