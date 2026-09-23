// Versioned tool state with undo/redo. Pure — the React layer only calls these.
// A tool's saved state is always wrapped in an envelope so an old save can be migrated when the tool changes.

export interface Envelope<S> { toolId: string; schemaVersion: number; state: S }

export interface History<S> { past: S[]; present: S; future: S[] }
const LIMIT = 200;

export const newHistory = <S,>(present: S): History<S> => ({ past: [], present, future: [] });
export function commit<S>(h: History<S>, next: S): History<S> {
  if (Object.is(next, h.present)) return h;
  const past = h.past.length >= LIMIT ? h.past.slice(h.past.length - LIMIT + 1) : h.past;
  return { past: [...past, h.present], present: next, future: [] };
}
/** Replace the present WITHOUT adding an undo step (used while dragging: only the drop is one undo step). */
export const replacePresent = <S,>(h: History<S>, next: S): History<S> => ({ ...h, present: next });
export const canUndo = <S,>(h: History<S>) => h.past.length > 0;
export const canRedo = <S,>(h: History<S>) => h.future.length > 0;
export function undo<S>(h: History<S>): History<S> {
  if (!h.past.length) return h;
  return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1]!, future: [h.present, ...h.future] };
}
export function redo<S>(h: History<S>): History<S> {
  if (!h.future.length) return h;
  return { past: [...h.past, h.present], present: h.future[0]!, future: h.future.slice(1) };
}

export const wrap = <S,>(toolId: string, schemaVersion: number, state: S): Envelope<S> => ({ toolId, schemaVersion, state });
/** Read a saved envelope. An older version goes through `migrate`; anything unreadable falls back to `initial()` — a bad save never breaks the tool. */
export function unwrap<S>(raw: unknown, toolId: string, schemaVersion: number, migrate: (old: unknown, from: number) => S, initial: () => S): S {
  try {
    if (!raw || typeof raw !== "object") return initial();
    const e = raw as Partial<Envelope<unknown>>;
    if (e.toolId !== toolId || typeof e.schemaVersion !== "number") return initial();
    if (e.schemaVersion === schemaVersion) return e.state as S;
    if (e.schemaVersion < schemaVersion) return migrate(e.state, e.schemaVersion);
    return initial();
  } catch { return initial(); }
}
