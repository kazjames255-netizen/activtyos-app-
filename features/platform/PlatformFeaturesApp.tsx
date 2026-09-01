"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { get as apiGet, patch as apiPatch } from "@/lib/api";

// The operator pages HQ can switch on/off per provider. CORE pages (dashboard,
// bookings, listings, setup…) are never toggleable, so they're not listed.
// A page is OFF only when its flag is explicitly false (featureOff); anything
// else is ON — matching lib/use-customer-area.
const PAGES: [string, string][] = [
  ["registers", "Registers"],
  ["ratios", "Ratios & groups"],
  ["timetable", "Activity timetable"],
  ["trips", "Trips & visits"],
  ["calendar", "Events calendar"],
  ["tasks", "Task manager"],
  ["schedule", "Staff rota"],
  ["incidents", "Incidents"],
  ["accidents", "Accidents"],
  ["medication", "Medication"],
  ["meals", "Meals"],
  ["moments", "Moments"],
  ["newsfeed", "Newsfeed"],
  ["messages", "Messages"],
  ["marketing", "Marketing"],
  ["referrals", "Referrals"],
  ["email", "Email"],
  ["templates", "Templates"],
  ["expenses", "Money out"],
  ["purchasing", "Money in"],
  ["reconciliation", "Reconciliation"],
  ["inventory", "Inventory"],
  ["compliance", "Compliance"],
  ["memberships", "Memberships"],
  ["ai", "AI assistant"],
];

interface Provider { id: string; name: string; type: string; features: Record<string, boolean> }

const HERO = "radial-gradient(120% 160% at 12% -30%, rgba(120,170,255,.5) 0%, transparent 55%), linear-gradient(120deg,#16306e 0%,#274ba3 58%,#3f78d8 100%)";
const BLUE = "#1d3a8f";
const isOn = (features: Record<string, boolean>, view: string) => features[view] !== false;

function Toggle({ on, busy, onClick }: { on: boolean; busy: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={on}
      className={`relative inline-block h-5 w-9 flex-none rounded-full transition-colors ${busy ? "opacity-60" : ""}`}
      style={{ background: on ? "#0f7a43" : "#c7ccd8" }}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}

export function PlatformFeaturesApp() {
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [typeTab, setTypeTab] = useState("all");
  const [busy, setBusy] = useState<string | null>(null); // `${id}:${view}` mid-save
  const [open, setOpen] = useState<Set<string>>(() => new Set()); // expanded cards (start closed)
  const toggleOpen = (id: string) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const load = useCallback(() => {
    apiGet<{ providers: Provider[] }>("/api/platform/providers")
      .then((p) => { setProviders(p.providers ?? []); setError(null); })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  useEffect(load, [load]);

  const toggle = async (p: Provider, view: string, next: boolean) => {
    const key = `${p.id}:${view}`;
    setBusy(key);
    // Optimistic — flip locally, then persist.
    setProviders((list) => (list ?? []).map((x) => (x.id === p.id ? { ...x, features: { ...x.features, [view]: next } } : x)));
    try {
      await apiPatch(`/api/platform/providers/${encodeURIComponent(p.id)}/features`, { view, on: next });
    } catch (e) {
      // Roll back on failure.
      setProviders((list) => (list ?? []).map((x) => (x.id === p.id ? { ...x, features: { ...x.features, [view]: !next } } : x)));
      alert(e instanceof Error ? e.message : "Couldn’t save — try again");
    } finally {
      setBusy(null);
    }
  };

  // Tabs by provider type, plus the live count per type.
  const typeTabs = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of providers ?? []) counts.set(p.type, (counts.get(p.type) ?? 0) + 1);
    const order = ["freelancer", "company", "franchise"];
    const present = [...counts.keys()].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    return [["all", "All", providers?.length ?? 0] as const, ...present.map((t) => [t, t[0].toUpperCase() + t.slice(1), counts.get(t) ?? 0] as const)];
  }, [providers]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (providers ?? [])
      .filter((p) => typeTab === "all" || p.type === typeTab)
      .filter((p) => !t || p.name.toLowerCase().includes(t) || p.type.toLowerCase().includes(t));
  }, [providers, q, typeTab]);

  return (
    <div className="text-[var(--ink)]">
      <div className="overflow-hidden rounded-2xl text-white" style={{ backgroundImage: `radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1.6px), ${HERO}`, backgroundSize: "18px 18px, cover", backgroundRepeat: "repeat, no-repeat" }}>
        <div className="px-6 py-5">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "#ffd23f" }}>Platform · Head office</div>
          <h2 className="mt-0.5 text-[25px] font-extrabold" style={{ fontFamily: "var(--ff-display)", color: "#fff" }}>🎛️ Provider features</h2>
          <p className="mt-1 max-w-[640px] text-[12.5px] leading-snug text-white/85">
            Turn pages on or off for each provider. Changes are live — a page switched off disappears from that provider&rsquo;s menu straight away.
          </p>
        </div>
      </div>

      {error && <div className="mt-3 text-[12.5px] text-[var(--red)]">{error}</div>}

      {!providers ? (
        <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading providers…</div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {typeTabs.map(([v, label, count]) => (
              <button key={v} type="button" onClick={() => setTypeTab(v)}
                className="rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-colors"
                style={typeTab === v ? { borderColor: "transparent", background: BLUE, color: "#fff" } : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-2)" }}>
                {label} <span className={typeTab === v ? "opacity-80" : "text-[var(--ink-3)]"}>{count}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search providers…"
              className="w-[240px] rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 py-1.5 text-[12.5px] outline-none focus:border-[var(--brand)]" />
            <span className="text-[11.5px] text-[var(--ink-3)]">{shown.length} provider{shown.length === 1 ? "" : "s"} · {PAGES.length} toggleable pages · core pages always on</span>
          </div>

          <div className="mt-3 grid gap-3 xl:grid-cols-2">
            {shown.map((p) => {
              const offCount = PAGES.filter(([v]) => !isOn(p.features, v)).length;
              return (
                <div key={p.id} className="h-fit overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
                  <button type="button" onClick={() => toggleOpen(p.id)} className="flex w-full items-center justify-between gap-2 px-3.5 py-3 text-left transition hover:bg-[var(--panel)]" style={open.has(p.id) ? { background: "var(--panel)" } : undefined}>
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="grid h-8 w-8 flex-none place-items-center rounded-full text-[13px] font-extrabold text-white" style={{ background: p.type === "company" ? "#0ea5a5" : p.type === "franchise" ? "#7a5af8" : "#2f6bd8" }}>{(p.name.trim()[0] || "?").toUpperCase()}</span>
                      <div className="min-w-0">
                        <div className="truncate text-[13.5px] font-extrabold text-[var(--ink)]">{p.name}</div>
                        <div className="text-[11px] capitalize text-[var(--ink-3)]">{p.type}</div>
                      </div>
                    </div>
                    <span className="flex flex-none items-center gap-2">
                      <span className="whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-extrabold" style={offCount === 0 ? { background: "#eef4fd", color: "#1d3a8f" } : { background: "#fff3e0", color: "#96631a" }}>{PAGES.length - offCount}/{PAGES.length} on</span>
                      <span className={`text-[12px] text-[var(--ink-3)] transition-transform ${open.has(p.id) ? "rotate-180" : ""}`}>▾</span>
                    </span>
                  </button>
                  {open.has(p.id) && (
                    <div className="grid gap-x-4 gap-y-1 p-3 sm:grid-cols-2">
                      {PAGES.map(([view, label]) => {
                        const on = isOn(p.features, view);
                        return (
                          <div key={view} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--panel)]">
                            <span className={`text-[12.5px] font-semibold ${on ? "text-[var(--ink)]" : "text-[var(--ink-3)]"}`}>{label}</span>
                            <Toggle on={on} busy={busy === `${p.id}:${view}`} onClick={() => toggle(p, view, !on)} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {shown.length === 0 && <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] py-10 text-center text-[12.5px] text-[var(--ink-3)]">No providers match “{q}”.</div>}
        </>
      )}
    </div>
  );
}
