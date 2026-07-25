"use client";

import { useCallback, useEffect, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";

interface Row {
  id: string; name: string; type: string; plan: string | null; band: string | null;
  status: string; price: number | null; cadence: string; trialEndsAt: string | null;
  staffCount: number; staffLimit: number | null;
}
interface Payload { rows: Row[]; summary: { total: number; mrr: number; trialing: number; active: number } }

const gbp = (n: number) => `£${n.toLocaleString("en-GB")}`;
const SM: Record<string, { label: string; bg: string; fg: string }> = {
  trialing: { label: "Trial", bg: "#eaf0fc", fg: "#1d3a8f" },
  active: { label: "Active", bg: "#e7f6ee", fg: "#0f7a43" },
  canceling: { label: "Cancelling", bg: "#fdf0e3", fg: "#a5670a" },
  canceled: { label: "Cancelled", bg: "#fdebec", fg: "#c02636" },
  past_due: { label: "Past due", bg: "#fdebec", fg: "#c02636" },
  none: { label: "No plan", bg: "#eef0f5", fg: "#6b6880" },
};

/** platform/billing — what every provider is on, and the resulting MRR. */
export function PlatformBillingApp() {
  const [d, setD] = useState<Payload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => { apiGet<Payload>("/api/platform/subscriptions").then((p) => { setD(p); setErr(null); }).catch((e) => setErr(e instanceof Error ? e.message : "Failed to load")); }, []);
  useEffect(load, [load]);
  useRealtime(["tenants"], load);

  if (err) return <div className="p-2 text-[12.5px] text-[var(--red)]">{err}</div>;
  if (!d) return <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading billing…</div>;

  const tiles: [string, string][] = [
    ["Providers", String(d.summary.total)],
    ["Monthly recurring", `${gbp(d.summary.mrr)}/mo`],
    ["On trial", String(d.summary.trialing)],
    ["Active", String(d.summary.active)],
  ];

  return (
    <div className="text-[var(--ink)]">
      <h2 className="mb-1 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Billing</h2>
      <p className="mb-4 text-[12.5px] text-[var(--ink-3)]">What each provider has purchased, and the recurring revenue it adds up to.</p>

      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        {tiles.map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{k}</div>
            <div className="mt-1 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{v}</div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-[var(--line)] text-left text-[10.5px] uppercase tracking-wide text-[var(--ink-3)]">
              <th className="px-3 py-2.5">Provider</th><th className="px-3 py-2.5">Plan</th><th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5 text-right">Fee</th><th className="px-3 py-2.5 text-right">Staff</th><th className="px-3 py-2.5">Since</th>
            </tr>
          </thead>
          <tbody>
            {d.rows.map((r) => {
              const sm = SM[r.status] ?? SM.none;
              return (
                <tr key={r.id} className="border-b border-[var(--line)] last:border-0">
                  <td className="px-3 py-2.5"><div className="font-bold">{r.name}</div><div className="text-[10.5px] text-[var(--ink-3)]">{r.type}</div></td>
                  <td className="px-3 py-2.5">{r.plan ? <span className="font-semibold capitalize">{r.plan}{r.band ? ` · ${r.band}` : ""}</span> : <span className="text-[var(--ink-3)]">—</span>}</td>
                  <td className="px-3 py-2.5"><span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: sm.bg, color: sm.fg }}>{sm.label}</span></td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{r.price != null ? `${gbp(r.price)}/${r.cadence === "year" ? "yr" : "mo"}` : "—"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{r.staffCount}{r.staffLimit != null ? ` / ${r.staffLimit}` : ""}</td>
                  <td className="px-3 py-2.5 text-[var(--ink-3)]">{r.trialEndsAt ? new Date(r.trialEndsAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
