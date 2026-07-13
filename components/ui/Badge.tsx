import type { ReactNode } from "react";

export function Badge({
  tone,
  children,
}: {
  tone: { bg: string; fg: string };
  children: ReactNode;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-transparent px-2.5 py-[3px] text-[11px] font-bold leading-[1.4]"
      style={{ background: tone.bg, color: tone.fg }}
    >
      {children}
    </span>
  );
}
