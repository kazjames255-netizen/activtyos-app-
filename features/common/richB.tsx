import type { ReactNode } from "react";

/** Renders a catalogue string that contains <b>…</b> spans as real bold elements (no HTML injection). */
export function RichB({ text, className }: { text: string; className?: string }): ReactNode {
  const parts = text.split(/(<b>.*?<\/b>)/g);
  return (
    <>
      {parts.map((p, i) => (/^<b>.*<\/b>$/.test(p) ? <b key={i} className={className}>{p.slice(3, -4)}</b> : <span key={i}>{p}</span>))}
    </>
  );
}
