import { get as apiGet, isDemoMode } from "@/lib/api";

// The rota is stored on the server (GET/PUT /api/rota). Several screens —
// staff dashboard, My schedule, the clock, On site now, payroll, holiday —
// still read the old same-device copy under "aos.rota.v5". Refreshing that
// copy from the server once per session means those screens work on ANY
// device, not just the laptop the rota was built on.
const KEY = "aos.rota.v5";
let started = false;

export function syncRotaCacheOnce(): void {
  if (started || typeof window === "undefined" || isDemoMode()) return;
  started = true;
  apiGet<{ staff?: unknown[]; shifts?: unknown[]; sites?: string[] }>("/api/rota")
    .then((r) => {
      // Never overwrite a rota this browser has that the server doesn't: the
      // Schedule screen uploads it the first time a manager opens it, and
      // replacing it with the server's empty copy first would lose it.
      const serverEmpty = !(r.staff?.length) && !(r.shifts?.length);
      if (serverEmpty) {
        try { const cur = JSON.parse(localStorage.getItem(KEY) || "null"); if (cur && ((cur.staff?.length ?? 0) || (cur.shifts?.length ?? 0))) return; } catch { /* ignore */ }
      }
      try { localStorage.setItem(KEY, JSON.stringify({ staff: r.staff ?? [], shifts: r.shifts ?? [], sites: r.sites ?? [] })); } catch { /* ignore */ }
      window.dispatchEvent(new Event("aos:rota"));
    })
    .catch(() => { started = false; });
}
