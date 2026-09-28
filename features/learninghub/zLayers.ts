/** One named z-index scale for everything floating in the hub. Tool windows live in the panel band (Z.panel .. Z.panel + PANEL_SPAN - 1). */
export const Z = { dock: 900, panel: 1000, sheet: 1200, dialog: 1250, picker: 1300, toast: 1400 } as const;
export const PANEL_SPAN = 100;
/** Clamp any window stacking counter into the panel band so windows can never climb over dialogs, the picker or toasts. */
export const panelZ = (n: number) => Z.panel + (((n % PANEL_SPAN) + PANEL_SPAN) % PANEL_SPAN);
