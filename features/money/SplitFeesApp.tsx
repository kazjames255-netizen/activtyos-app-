"use client";

import { useCallback, useEffect, useState } from "react";
import { api, get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { money } from "@/features/bookings/helpers";
import { Button, Card, FieldLabel, Input, Select } from "@/components/ui";

interface Settings { basis: "revenue" | "perBooking"; rate?: number; perBookingFee?: number }
interface Row { franchiseId: string; name: string; count: number; revenue: number; collected: number; fee: number }
interface Payload { settings: Settings; franchises: Row[]; direct: { count: number; revenue: number; collected: number }; totals: { franchises: number; revenue: number; fee: number } }

export function SplitFeesApp() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState(false);
  const [basis, setBasis] = useState<Settings["basis"]>("revenue");
  const [rate, setRate] = useState("10");
  const [perBookingFee, setPerBookingFee] = useState("0");

  const refresh = useCallback(() => {
    apiGet<Payload>("/api/splitfees").then((p) => {
      setData(p); setError(null);
      setBasis(p.settings.basis); setRate(String(p.settings.rate ?? 10)); setPerBookingFee(String(p.settings.perBookingFee ?? 0));
    }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtime(["bookings"], refresh);

  async function saveSettings() {
    try {
      await api("/api/splitfees/settings", { method: "PUT", body: JSON.stringify({ basis, rate: Number(rate) || 0, perBookingFee: Number(perBookingFee) || 0 }) });
      setEdit(false); refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save"); }
  }

  if (error) return <div className="p-2 text-[12.5px] text-[var(--red)]">{error}</div>;
  if (!data) return <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>;

  const basisLabel = data.settings.basis === "perBooking" ? `${money(data.settings.perBookingFee ?? 0)} per booking` : `${data.settings.rate ?? 0}% of revenue`;

  return (
    <div className="text-[var(--ink)]">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Split fees</h2>
        {!edit && <Button onClick={() => setEdit(true)}>Royalty settings</Button>}
      </div>
      <p className="mb-4 text-[12.5px] text-[var(--ink-3)]">What each franchise owes head office — currently <span className="font-bold text-[var(--ink)]">{basisLabel}</span>.</p>

      {edit && (
        <Card className="mb-3.5 p-4">
          <div className="grid gap-2.5 sm:grid-cols-3">
            <div><FieldLabel>Basis</FieldLabel><Select value={basis} onChange={(e) => setBasis(e.target.value as Settings["basis"])} className="w-full"><option value="revenue">% of revenue</option><option value="perBooking">Fee per booking</option></Select></div>
            {basis === "revenue"
              ? <div><FieldLabel>Rate (%)</FieldLabel><Input type="number" min="0" max="100" step="0.5" value={rate} onChange={(e) => setRate(e.target.value)} className="w-full" /></div>
              : <div><FieldLabel>Fee per booking (£)</FieldLabel><Input type="number" min="0" step="0.01" value={perBookingFee} onChange={(e) => setPerBookingFee(e.target.value)} className="w-full" /></div>}
          </div>
          <div className="mt-3 flex gap-2"><Button variant="primary" onClick={saveSettings}>Save</Button><Button onClick={() => setEdit(false)}>Cancel</Button></div>
        </Card>
      )}

      <div className="mb-3 grid gap-2.5 sm:grid-cols-3">
        <Card className="p-4"><div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">Franchise revenue</div><div className="mt-1 text-[24px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{money(data.totals.revenue)}</div></Card>
        <Card className="p-4"><div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">Royalties owed</div><div className="mt-1 text-[24px] font-extrabold" style={{ fontFamily: "var(--ff-display)", color: "var(--brand)" }}>{money(data.totals.fee)}</div></Card>
        <Card className="p-4"><div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">Franchises</div><div className="mt-1 text-[24px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{data.totals.franchises}</div></Card>
      </div>

      {data.franchises.length === 0 ? <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">No franchises yet — invite them from Team &amp; invites.</Card> : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-[var(--line)] text-left text-[11px] font-extrabold uppercase tracking-[0.03em] text-[var(--ink-3)]">
                  <th className="px-3.5 py-2">Franchise</th>
                  <th className="px-3.5 py-2 text-right">Bookings</th>
                  <th className="px-3.5 py-2 text-right">Revenue</th>
                  <th className="px-3.5 py-2 text-right">Collected</th>
                  <th className="px-3.5 py-2 text-right">Royalty owed</th>
                </tr>
              </thead>
              <tbody>
                {data.franchises.map((r) => (
                  <tr key={r.franchiseId} className="border-b border-[var(--line)] last:border-0">
                    <td className="px-3.5 py-2 font-bold">{r.name}</td>
                    <td className="px-3.5 py-2 text-right tabular-nums">{r.count}</td>
                    <td className="px-3.5 py-2 text-right tabular-nums">{money(r.revenue)}</td>
                    <td className="px-3.5 py-2 text-right tabular-nums text-[var(--ink-3)]">{money(r.collected)}</td>
                    <td className="px-3.5 py-2 text-right font-extrabold tabular-nums">{money(r.fee)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {data.direct.count > 0 && (
        <div className="mt-2 text-[11.5px] text-[var(--ink-3)]">Plus {money(data.direct.revenue)} of direct (head-office) bookings across {data.direct.count} — no royalty applies.</div>
      )}
    </div>
  );
}
