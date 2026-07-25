"use client";

import { useCallback, useEffect, useState } from "react";
import { get as apiGet, api } from "@/lib/api";
import { Button } from "@/components/ui";

interface Band { id: string; label: string; price: number; staffMax?: number | null; perStaffOver?: number }
interface Plan { id: string; name: string; price: number; cadence: string; blurb: string; features: string[]; bands?: Band[]; perLocationPct?: number }

const fld = "rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] text-[var(--ink)] outline-none focus:border-[#1d3a8f]";
const lbl = "text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]";

/**
 * platform/pricing — edit the live catalogue (prices, bands, staff limits and
 * the descriptions customers read). Saving applies to NEW signups immediately;
 * existing subscribers stay grandfathered on their snapshot.
 */
export function PlatformPricingApp() {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [defaults, setDefaults] = useState<Plan[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    apiGet<{ plans: Plan[]; defaults: Plan[]; updatedAt: string | null }>("/api/subscription/pricing")
      .then((d) => { setPlans(d.plans); setDefaults(d.defaults); setUpdatedAt(d.updatedAt); })
      .catch((e) => setErr(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  useEffect(load, [load]);

  const setPlan = (i: number, patch: Partial<Plan>) => setPlans((ps) => ps!.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const setBand = (pi: number, bi: number, patch: Partial<Band>) => setPlans((ps) => ps!.map((p, j) => (j === pi ? { ...p, bands: p.bands!.map((b, k) => (k === bi ? { ...b, ...patch } : b)) } : p)));
  const num = (v: string) => (v === "" ? 0 : Number(v));

  async function save() {
    if (!plans) return;
    setSaving(true); setErr(null); setMsg(null);
    const clean = plans.map((p) => ({ ...p, features: p.features.map((f) => f.trim()).filter(Boolean) }));
    try { await api("/api/subscription/pricing", { method: "PUT", body: JSON.stringify({ plans: clean }) }); setMsg("Saved — new signups now see this pricing."); load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Couldn’t save"); }
    finally { setSaving(false); }
  }
  function reset() { setPlans(defaults.map((p) => ({ ...p, bands: p.bands?.map((b) => ({ ...b })) }))); setMsg("Reset to defaults — press Save to apply."); }

  if (err && !plans) return <div className="p-2 text-[12.5px] text-[var(--red)]">{err}</div>;
  if (!plans) return <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading pricing…</div>;

  return (
    <div className="text-[var(--ink)]">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="mb-1 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Pricing</h2>
          <p className="text-[12.5px] text-[var(--ink-3)]">Edit prices, staff limits, franchise % and the descriptions customers read. Changes apply to <b>new signups</b>; existing customers stay on what they signed up at.{updatedAt ? ` · last edited ${new Date(updatedAt).toLocaleDateString("en-GB")}` : " · currently on defaults"}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={reset} sm>Reset to defaults</Button>
          <Button variant="primary" onClick={save} disabled={saving} sm>{saving ? "Saving…" : "Save"}</Button>
        </div>
      </div>

      {msg && <div className="mt-3 rounded-lg bg-[#eaf0fc] px-3 py-2 text-[12px] font-bold text-[#1d3a8f]">{msg}</div>}
      {err && <div className="mt-3 rounded-lg bg-[#fdebec] px-3 py-2 text-[12px] font-bold text-[var(--red)]">{err}</div>}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {plans.map((p, i) => (
          <div key={p.id} className="flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
            <div className="flex flex-col gap-1">
              <span className={lbl}>Plan name</span>
              <input className={fld} value={p.name} onChange={(e) => setPlan(i, { name: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1">
              <span className={lbl}>Base price £/mo</span>
              <input type="number" min="0" className={fld} value={p.price} onChange={(e) => setPlan(i, { price: num(e.target.value) })} />
            </div>
            <div className="flex flex-col gap-1">
              <span className={lbl}>Description</span>
              <textarea rows={2} className={`${fld} resize-y`} value={p.blurb} onChange={(e) => setPlan(i, { blurb: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1">
              <span className={lbl}>Features — one per line</span>
              <textarea rows={6} className={`${fld} resize-y`} value={p.features.join("\n")} onChange={(e) => setPlan(i, { features: e.target.value.split("\n") })} />
            </div>

            {p.bands && (
              <div className="flex flex-col gap-1.5">
                <span className={lbl}>Bands — label · £/mo · staff cap</span>
                {p.bands.map((b, bi) => (
                  <div key={b.id} className="flex gap-1.5">
                    <input className={`${fld} min-w-0 flex-1`} value={b.label} onChange={(e) => setBand(i, bi, { label: e.target.value })} />
                    <input type="number" min="0" className={`${fld} w-16`} value={b.price} onChange={(e) => setBand(i, bi, { price: num(e.target.value) })} />
                    <input type="number" min="0" placeholder="∞" className={`${fld} w-16`} value={b.staffMax ?? ""} onChange={(e) => setBand(i, bi, { staffMax: e.target.value === "" ? null : Number(e.target.value) })} />
                  </div>
                ))}
              </div>
            )}
            {p.perLocationPct != null && (
              <div className="flex flex-col gap-1">
                <span className={lbl}>Each extra franchise location · +% of band</span>
                <input type="number" min="0" className={`${fld} w-24`} value={p.perLocationPct} onChange={(e) => setPlan(i, { perLocationPct: num(e.target.value) })} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
