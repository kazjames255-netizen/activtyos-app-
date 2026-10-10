// State logic of the per-add-on "Allow changes until N days before" control: the tick is its own on/off state, the box is free text while typing.

export interface CutoffControl { on: boolean; text: string; lastValid: number }

/** A whole number 0-60 typed as text, else null (empty, garbage, decimals and out-of-range are all null: never silently 0). */
export function parseCutoffText(text: string): number | null {
  const t = text.trim();
  if (!/^\d{1,2}$/.test(t)) return null;
  const n = Number(t);
  return n >= 0 && n <= 60 ? n : null;
}

export function cutoffFromSaved(saved: unknown, setupDays: number): CutoffControl {
  const ok = typeof saved === "number" && Number.isInteger(saved) && saved >= 0 && saved <= 60;
  return { on: ok, text: ok ? String(saved) : "", lastValid: ok ? (saved as number) : setupDays };
}

/** Ticking on starts from the last valid number (the Setup default at first). Ticking off keeps the text for next time. */
export function cutoffToggle(c: CutoffControl, on: boolean): CutoffControl {
  return on ? { ...c, on: true, text: parseCutoffText(c.text) !== null ? c.text : String(c.lastValid) } : { ...c, on: false };
}

/** Typing never changes the tick; a valid entry is remembered as the last valid number. */
export function cutoffType(c: CutoffControl, text: string): CutoffControl {
  const n = parseCutoffText(text);
  return { ...c, text, lastValid: n ?? c.lastValid };
}

/** On leaving the box: an invalid or empty entry reverts to the last valid number. */
export function cutoffBlur(c: CutoffControl): CutoffControl {
  return parseCutoffText(c.text) === null ? { ...c, text: String(c.lastValid) } : c;
}

/** What to store: undefined when off, else the valid number (an invalid entry falls back to the last valid one, never to 0). */
export function cutoffValueToSave(c: CutoffControl): number | undefined {
  return c.on ? parseCutoffText(c.text) ?? c.lastValid : undefined;
}
