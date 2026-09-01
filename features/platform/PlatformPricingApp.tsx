"use client";

import { useCallback, useEffect, useState } from "react";
import { get as apiGet, api } from "@/lib/api";

interface Band { id: string; label: string; price: number; staffMax?: number | null; perStaffOver?: number }
interface Plan { id: string; name: string; price: number; cadence: string; blurb: string; features: string[]; bands?: Band[]; perLocationPct?: number }

const fld = "rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)] outline-none transition-colors focus:border-[#1d3a8f] focus:ring-2 focus:ring-[#1d3a8f]/15";
const lbl = "text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]";
const HERO = "radial-gradient(120% 160% at 12% -30%, rgba(120,170,255,.5) 0%, transparent 55%), linear-gradient(120deg,#16306e 0%,#274ba3 58%,#3f78d8 100%)";
const gbp = (n: number) => `£${(Number(n) || 0).toLocaleString("en-GB")}`;
const ICONS: Record<string, string> = { freelancer: "⭐", company: "🏛️", franchise: "🌐" };

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
  const setFeat = (pi: number, fi: number, val: string) => setPlans((ps) => ps!.map((p, j) => (j === pi ? { ...p, features: p.features.map((f, k) => (k === fi ? val : f)) } : p)));
  const addFeat = (pi: number) => setPlans((ps) => ps!.map((p, j) => (j === pi ? { ...p, features: [...p.features, ""] } : p)));
  const rmFeat = (pi: number, fi: number) => setPlans((ps) => ps!.map((p, j) => (j === pi ? { ...p, features: p.features.filter((_, k) => k !== fi) } : p)));
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
      <div className="overflow-hidden rounded-2xl text-white" style={{ backgroundImage: `radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1.6px), ${HERO}`, backgroundSize: "18px 18px, cover", backgroundRepeat: "repeat, no-repeat" }}>
        <div className="flex flex-wrap items-end justify-between gap-3 px-6 py-5">
          <div className="min-w-0">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "#ffd23f" }}>Platform · Head office</div>
            <h2 className="mt-0.5 text-[25px] font-extrabold" style={{ fontFamily: "var(--ff-display)", color: "#fff" }}>💷 Pricing</h2>
            <p className="mt-1 max-w-[600px] text-[12.5px] leading-snug text-white/85">
              Edit prices, staff limits, franchise % and the descriptions customers read. Changes apply to <b className="text-white">new signups</b>; existing customers stay grandfathered.
              <span className="text-white/60">{updatedAt ? ` · last edited ${new Date(updatedAt).toLocaleDateString("en-GB")}` : " · currently on defaults"}</span>
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={reset} className="rounded-full border border-white/30 bg-white/10 px-4 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-white/20">Reset to defaults</button>
            <button type="button" onClick={save} disabled={saving} className="rounded-full bg-[#ffd23f] px-5 py-2 text-[12.5px] font-extrabold text-[#3a2a00] transition hover:brightness-105 disabled:opacity-60">{saving ? "Saving…" : "Save changes"}</button>
          </div>
        </div>
      </div>

      {msg && <div className="mt-3 rounded-xl bg-[#eaf0fc] px-3.5 py-2.5 text-[12.5px] font-bold text-[#1d3a8f]">{msg}</div>}
      {err && <div className="mt-3 rounded-xl bg-[#fdebec] px-3.5 py-2.5 text-[12.5px] font-bold text-[var(--red)]">{err}</div>}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {plans.map((p, i) => (
          <div key={p.id} className="flex flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[0_1px_3px_rgba(16,24,40,.06)]">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--line)] bg-[var(--panel)] px-4 py-3">
              <span className="flex items-center gap-2 text-[13px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
                <span className="text-[17px]">{ICONS[p.id] ?? "•"}</span>{p.name || "Plan"}
              </span>
              <span className="rounded-full bg-[#eaf0fc] px-2.5 py-0.5 text-[11px] font-extrabold text-[#1d3a8f]">{gbp(p.price)}/mo{p.bands ? "+" : ""}</span>
            </div>

            <div className="flex flex-col gap-3.5 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1"><span className={lbl}>Plan name</span><input className={fld} value={p.name} onChange={(e) => setPlan(i, { name: e.target.value })} /></label>
                <label className="flex flex-col gap-1"><span className={lbl}>Base £/mo</span><input type="number" min="0" className={fld} value={p.price} onChange={(e) => setPlan(i, { price: num(e.target.value) })} /></label>
              </div>
              <label className="flex flex-col gap-1"><span className={lbl}>Description</span><textarea rows={3} className={`${fld} min-h-[68px] resize-y leading-relaxed`} value={p.blurb} onChange={(e) => setPlan(i, { blurb: e.target.value })} /></label>

              <div className="flex flex-col gap-1.5">
                <span className={lbl}>Features</span>
                <div className="flex flex-col gap-1.5">
                  {p.features.map((f, fi) => (
                    <div key={fi} className="flex items-center gap-2">
                      <span className="shrink-0 text-[13px] font-bold text-[#1d3a8f]">✓</span>
                      <input className={`${fld} min-w-0 flex-1 !py-1.5`} value={f} placeholder="Describe a feature…"
                        onChange={(e) => setFeat(i, fi, e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addFeat(i); } }} />
                      <button type="button" onClick={() => rmFeat(i, fi)} aria-label="Remove feature"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[13px] text-[var(--ink-3)] transition-colors hover:bg-[#fdebec] hover:text-[#c02636]">✕</button>
                    </div>
                  ))}
                  {p.features.length === 0 && <p className="text-[11.5px] italic text-[var(--ink-3)]">No features yet — add the first one below.</p>}
                </div>
                <button type="button" onClick={() => addFeat(i)}
                  className="mt-0.5 self-start rounded-lg border border-dashed border-[var(--line)] px-2.5 py-1.5 text-[12px] font-bold text-[#1d3a8f] transition-colors hover:border-[#1d3a8f] hover:bg-[#eaf0fc]">+ Add feature</button>
              </div>

              {p.bands && (
                <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
                  <div className="mb-2 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">👥 Bands — by team size</div>
                  <div className="flex flex-col gap-2">
                    {p.bands.map((b, bi) => (
                      <div key={b.id} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-2.5">
                        <input className={`${fld} w-full`} value={b.label} placeholder="e.g. Starter · up to 10 staff" onChange={(e) => setBand(i, bi, { label: e.target.value })} />
                        <div className="mt-2 flex gap-2">
                          <label className="flex flex-1 items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 focus-within:border-[#1d3a8f]">
                            <span className="text-[12.5px] font-bold text-[var(--ink-3)]">£</span>
                            <input type="number" min="0" className="w-full min-w-0 bg-transparent text-[13px] text-[var(--ink)] outline-none" value={b.price} onChange={(e) => setBand(i, bi, { price: num(e.target.value) })} />
                            <span className="text-[11px] text-[var(--ink-3)]">/mo</span>
                          </label>
                          <label className="flex flex-1 items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 focus-within:border-[#1d3a8f]">
                            <input type="number" min="0" placeholder="∞" className="w-full min-w-0 bg-transparent text-[13px] text-[var(--ink)] outline-none" value={b.staffMax ?? ""} onChange={(e) => setBand(i, bi, { staffMax: e.target.value === "" ? null : Number(e.target.value) })} />
                            <span className="whitespace-nowrap text-[11px] text-[var(--ink-3)]">staff max</span>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] leading-snug text-[var(--ink-3)]">Leave staff max blank (∞) for a metered top tier. The label is what customers see on the pricing card.</p>
                </div>
              )}
              {p.perLocationPct != null && (
                <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
                  <div className="mb-2 text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">🌐 Each extra franchise location</div>
                  <label className="flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 focus-within:border-[#1d3a8f]">
                    <span className="text-[12.5px] font-bold text-[var(--ink-3)]">+</span>
                    <input type="number" min="0" className="w-full min-w-0 bg-transparent text-[13px] text-[var(--ink)] outline-none" value={p.perLocationPct} onChange={(e) => setPlan(i, { perLocationPct: num(e.target.value) })} />
                    <span className="whitespace-nowrap text-[11px] text-[var(--ink-3)]">% of band, per site</span>
                  </label>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
