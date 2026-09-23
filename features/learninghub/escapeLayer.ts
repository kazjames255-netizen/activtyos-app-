"use client";

import { useEffect, useRef } from "react";

// One Escape = close the TOPMOST layer only. Every hub overlay (dialog, sheet, menu, drawer, tool pop-up, year picker) registers here
// while it is open; the last one registered is the one Escape closes, and the key is swallowed so a layer underneath (or a page-level
// handler) never also reacts. Listens in the capture phase on window so it runs before any older per-component Escape handler.
const stack: symbol[] = [];

export function useEscapeLayer(open: boolean, onClose: () => void) {
  const ref = useRef(onClose);
  useEffect(() => { ref.current = onClose; });
  useEffect(() => {
    if (!open) return;
    const id = Symbol("hub-escape-layer");
    stack.push(id);
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || stack[stack.length - 1] !== id) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      ref.current();
    };
    window.addEventListener("keydown", key, true);
    return () => {
      window.removeEventListener("keydown", key, true);
      const i = stack.indexOf(id);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [open]);
}
