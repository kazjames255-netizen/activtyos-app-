// A tiny bridge so NON-React board code (the controller's toasts, the canvas renderer, export errors) can speak the
// active language. The React shell registers the app's `t` on every render (idempotent); until then the English
// fallback passed at each call site is used (selftests, SSR).
type Tr = (key: string, vars?: Record<string, string | number>) => string;
let tr: Tr | null = null;
export const setBoardT = (f: Tr) => { tr = f; };
/** `key` is WITHOUT the "hublive." prefix. */
export function bt(key: string, fallback: string, vars?: Record<string, string | number>): string {
  if (tr) { const full = "hublive." + key, r = tr(full, vars); if (r !== full) return r; }
  return vars ? Object.entries(vars).reduce((s, [k, v]) => s.split(`{${k}}`).join(String(v)), fallback) : fallback;
}

/** Stable key fragment from an English label. */
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").map((w, i) => (i ? w[0]!.toUpperCase() + w.slice(1) : w)).join("").slice(0, 60);
