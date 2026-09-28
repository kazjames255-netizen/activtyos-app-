import type { CSSProperties, ReactNode } from "react";

// Speech bubble for the mascot. Pure presentation: callers pass ALREADY-TRANSLATED text (t(...)); this file has no
// user-visible strings. `side` is where the mascot sits relative to the bubble (the tail points at it).
export function MascotSpeech({
  children,
  side = "left",
  live = false,
  className,
  style,
}: {
  children: ReactNode;
  side?: "left" | "right" | "bottom";
  /** Announce to screen readers when it appears (e.g. a wrong-answer nudge). */
  live?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const tail: CSSProperties =
    side === "left"
      ? { left: -6, top: "50%", marginTop: -6, borderWidth: "0 0 1px 1px" }
      : side === "right"
        ? { right: -6, top: "50%", marginTop: -6, borderWidth: "1px 1px 0 0" }
        : { left: "50%", marginLeft: -6, bottom: -6, borderWidth: "0 1px 1px 0" };
  return (
    <div
      className={className}
      role={live ? "status" : undefined}
      style={{
        position: "relative",
        display: "inline-block",
        maxWidth: "min(100%, 28rem)",
        padding: "10px 14px",
        borderRadius: 16,
        background: "var(--surface)",
        color: "var(--ink)",
        border: "1px solid var(--line)",
        boxShadow: "0 2px 8px rgba(20,28,60,.08)",
        fontWeight: 600,
        lineHeight: 1.35,
        ...style,
      }}
    >
      {children}
      <span
        aria-hidden
        style={{
          position: "absolute",
          width: 12,
          height: 12,
          background: "var(--surface)",
          borderStyle: "solid",
          borderColor: "var(--line)",
          transform: "rotate(45deg)",
          ...tail,
        }}
      />
    </div>
  );
}
