import type { CSSProperties } from "react";

/** Light "paper" colours for a layer portalled to <body> (the Tools pop-up, the curriculum lesson panel). Those escape the portal's own theme scope and
 *  would inherit the app's dark default tokens — but the tools inside (lesson widgets, drawer tools) are designed for a light background.
 *  Inline on purpose: it can't be missed by a cached stylesheet. (Mirrors `.aos-light` in app/globals.css.) */
export const LIGHT_SCOPE = {
  "--bg": "#f5f8fd", "--surface": "#ffffff", "--panel": "#f4f7fc", "--ink": "#171534", "--ink-2": "#4a4763", "--ink-3": "#6b6885", "--line": "#e3e8f3",
  color: "#171534", colorScheme: "light",
} as CSSProperties;
