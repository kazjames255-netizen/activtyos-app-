"use client";

import { useCallback, useEffect, useState } from "react";
import { api, get as apiGet } from "@/lib/api";
import { Badge, Button, Card } from "@/components/ui";

interface Plan { id: string; name: string; price: number; cadence: string; blurb: string; features: string[] }
interface Payload { current: { plan: string; status: string; since: string | null; details: Plan }; plans: Plan[]; billingConfigured: boolean }

export function SubscriptionApp() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const refresh = useCallback(() => {
    apiGet<Payload>("/api/subscription").then((p) => { setData(p); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  async function choose(planId: string) {
    setSaving(planId);
    try { await api("/api/subscription", { method: "PUT", body: JSON.stringify({ plan: planId }) }); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t change plan"); }
    finally { setSaving(null); }
  }

  if (error) return <div className="p-2 text-[12.5px] text-[var(--red)]">{error}</div>;
  if (!data) return <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>;

  const priceLabel = (p: Plan) => (p.price === 0 ? "Free" : `£${p.price}/${p.cadence}`);

  return (
    <div className="text-[var(--ink)]">
      <h2 className="mb-1 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Subscription</h2>
      <p className="mb-3 text-[12.5px] text-[var(--ink-3)]">Your ActivityOS plan. You’re currently on <span className="font-bold text-[var(--ink)]">{data.current.details.name}</span>.</p>

      {!data.billingConfigured && (
        <div className="mb-4 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[12px] text-[var(--ink-3)]">
          Billing isn’t connected yet — choosing a plan records your selection but doesn’t take payment. Card billing comes with the next release.
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        {data.plans.map((p) => {
          const current = p.id === data.current.plan;
          return (
            <Card key={p.id} className={`flex flex-col p-4 ${current ? "border-[var(--brand)]" : ""}`}>
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{p.name}</span>
                {current && <Badge tone={{ bg: "var(--brand)", fg: "#fff" }}>current</Badge>}
              </div>
              <div className="mt-0.5 text-[20px] font-extrabold">{priceLabel(p)}</div>
              <div className="mt-1 text-[12px] text-[var(--ink-3)]">{p.blurb}</div>
              <ul className="mt-2.5 flex flex-1 flex-col gap-1">
                {p.features.map((f, i) => <li key={i} className="flex gap-1.5 text-[12px]"><span className="text-[var(--brand)]">✓</span>{f}</li>)}
              </ul>
              <div className="mt-3">
                {current ? <Button className="w-full" disabled>Your plan</Button>
                  : <Button variant="primary" className="w-full" onClick={() => choose(p.id)} disabled={saving === p.id}>{saving === p.id ? "Switching…" : `Switch to ${p.name}`}</Button>}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
