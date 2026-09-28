"use client";

import { createContext, useContext } from "react";

/** True while a tool sits in a floating window in "Just the tool" mode: the tool must draw ONLY itself (its instrument / stage) — no toolbars, tabs, question
 *  pickers, paper or card chrome. A tool reads it with `useBareTool()`; simple tools can instead mark their controls `data-tool-chrome` (hidden by the window). */
export const BareToolContext = createContext(false);
export const useBareTool = () => useContext(BareToolContext);
