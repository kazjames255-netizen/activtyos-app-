"use client";

// Head-office feature control — a simple matrix to turn each main feature (page)
// ON/OFF per franchise, or for ALL of them at once. It writes the franchise's OWN
// `settings.features`, so a franchise can still change its features itself later
// in its Setup — this is just the HO's quick network-wide switch.

import { useEffect, useMemo, useState } from "react";
import { get as apiGet, api } from "@/lib/api";
import { Card } from "@/components/ui";
import { useT, tNow, useI18n } from "@/lib/i18n/provider";
import { isRTL } from "@/lib/i18n/config";
import { navLabel } from "@/lib/i18n/words";
import { NAV_GROUPS } from "@/lib/nav/config";
import { CORE_VIEWS } from "@/lib/use-customer-area";
import { isFeatureOff } from "@/lib/accessMap";

interface FrFeatures { franchiseId: string; name: string; features: Record<string, boolean> }

// Plain-English explainer for each togglable feature, keyed by nav view.
// Shown on the ⓘ hover next to the feature name so head office knows exactly
// what each switch turns on or off for a franchise.
const infoKey = (view: string) => `p8fr.featInfo_${view.replace(/-/g, "_")}`;

// The togglable "main pages" a franchise has — the franchise nav minus the
// always-on essentials and non-feature views (mirrors Setup → Features).
const SKIP = new Set(["dash", "dashboard", "auth", "setup", "account", "subscription", "getpaid", "billing", "privacy"]);
function featureList(): { view: string; label: string }[] {
  const seen = new Set<string>();
  return (NAV_GROUPS.franchise ?? [])
    .flatMap((g) => g.items)
    .filter((it) => !it.hidden && !SKIP.has(it.view) && !CORE_VIEWS.has(it.view))
    .filter((it) => (seen.has(it.view) ? false : (seen.add(it.view), true)))
    .map((it) => ({ view: it.view, label: it.label ?? it.view }));
}

function Switch({ on, onChange, busy }: { on: boolean; onChange: (v: boolean) => void; busy?: boolean }) {
  const { locale } = useI18n();
  const rtl = isRTL(locale);
  return (
    <button type="button" disabled={busy} onClick={() => onChange(!on)} aria-pressed={on}
      className="relative inline-flex h-[22px] w-[38px] flex-none items-center rounded-full transition-colors disabled:opacity-50"
      style={{ background: on ? "#0f9d58" : "#cbd2de" }}>
      <span className="absolute h-[16px] w-[16px] rounded-full bg-[var(--surface)] shadow transition-transform" style={{ insetInlineStart: 0, transform: `translateX(${(rtl ? -1 : 1) * (on ? 19 : 3)}px)` }} />
    </button>
  );
}

export function FranchiseFeaturesApp() {
  const { t, locale } = useI18n();
  const rtl = isRTL(locale);
  const [rows, setRows] = useState<FrFeatures[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tip, setTip] = useState<{ label: string; text: string; x: number; y: number; rtl: boolean } | null>(null);
  const features = useMemo(featureList, []);

  function showTip(el: HTMLElement, ft: { view: string; label: string }) {
    const r = el.getBoundingClientRect();
    const k = infoKey(ft.view);
    const txt = t(k);
    setTip({ label: navLabel(t, ft.label), text: txt !== k ? txt : t("p8fr.featTipDefault"), x: rtl ? window.innerWidth - r.left + 8 : r.right + 8, y: r.top + r.height / 2, rtl });
  }

  useEffect(() => { apiGet<FrFeatures[]>("/api/franchises/features").then(setRows).catch((e) => setError(e instanceof Error ? e.message : tNow("franchise.couldntLoad"))); }, []);

  const isOn = (f: FrFeatures, view: string) => !isFeatureOff(f.features, view);
  const allOn = (view: string) => (rows ?? []).length > 0 && (rows ?? []).every((f) => isOn(f, view));

  async function toggle(fid: string, view: string, on: boolean) {
    setBusy(`${fid}:${view}`); setError(null);
    setRows((rs) => (rs ?? []).map((f) => (f.franchiseId === fid ? { ...f, features: { ...f.features, [view]: on } } : f)));
    try { await api(`/api/franchises/${fid}/features`, { method: "PUT", body: JSON.stringify({ view, on }) }); }
    catch (e) { setError(e instanceof Error ? e.message : t("franchise.couldntSave")); apiGet<FrFeatures[]>("/api/franchises/features").then(setRows).catch(() => {}); }
    finally { setBusy(null); }
  }
  async function toggleAll(view: string, on: boolean) {
    setBusy(`__all__:${view}`); setError(null);
    setRows((rs) => (rs ?? []).map((f) => ({ ...f, features: { ...f.features, [view]: on } })));
    try { await api(`/api/franchises/__all__/features`, { method: "PUT", body: JSON.stringify({ view, on }) }); }
    catch (e) { setError(e instanceof Error ? e.message : t("franchise.couldntSave")); apiGet<FrFeatures[]>("/api/franchises/features").then(setRows).catch(() => {}); }
    finally { setBusy(null); }
  }

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[#f6f6f8] p-5 text-[#171534]">
      <div className="max-w-[1600px]">
        <div className="op-hero relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(0,0,0,.5)]" style={{ background: "var(--hero-grad)" }}>
          <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-[16px]">🎛️</span>
            {t("franchise.featureControl")}
          </div>
          <p className="mt-1.5 max-w-[640px] text-[12.5px] leading-[1.5] text-white/80">{t("franchise.featureControlLede")}</p>
        </div>

        {error && <div className="mb-3 rounded-lg border border-[#f6c9cc] bg-[#fdebec] px-3 py-2 text-[12.5px] text-[#e21d27]">{error}</div>}
        {!rows ? (
          <div className="py-16 text-center text-[13px] text-[var(--ink-3)]">{t("franchise.loading")}</div>
        ) : rows.length === 0 ? (
          <Card className="p-10 text-center text-[13px] text-[var(--ink-3)]">{t("franchise.noFranchisesYetInvite")} <b>{t("franchise.inviteFranchises")}</b>.</Card>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[#E4E9F5] bg-[var(--surface)] shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-auto border-collapse text-[12.5px]">
                <thead>
                  <tr>
                    <th className="sticky start-0 z-10 w-[240px] min-w-[220px] border-b border-[#E4E9F5] bg-[var(--surface)] px-4 py-3 text-start text-[10.5px] font-extrabold uppercase tracking-[0.07em] text-[#5F6A88] shadow-[6px_0_10px_-8px_rgba(20,35,90,.14)]">{t("franchise.feature")}</th>
                    <th className="w-[104px] border-b border-[#eef1f6] bg-[#faf9fe] px-2 py-3 text-center text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[#8a7fbf]">{t("franchise.all")}</th>
                    {rows.map((f) => <th key={f.franchiseId} className="w-[116px] border-b border-[#eef1f6] px-3 py-3 text-center text-[11px] font-extrabold text-[#4a4763]"><div className="mx-auto max-w-[100px] truncate" title={f.name}>{f.name}</div></th>)}
                  </tr>
                </thead>
                <tbody>
                  {features.map((ft) => (
                    <tr key={ft.view} className="group">
                      <td className="sticky start-0 z-10 w-[240px] min-w-[220px] border-b border-[#E4E9F5] bg-[var(--surface)] px-4 py-3 font-bold text-[var(--ink)] shadow-[6px_0_10px_-8px_rgba(20,35,90,.12)] transition-colors group-hover:bg-[#E8EEFD]">
                        <span className="inline-flex items-center gap-1.5">
                          {navLabel(t, ft.label)}
                          <button type="button" aria-label={t("p8fr.featWhatIs", { label: navLabel(t, ft.label) })}
                            onMouseEnter={(e) => showTip(e.currentTarget, ft)} onMouseLeave={() => setTip(null)}
                            onFocus={(e) => showTip(e.currentTarget, ft)} onBlur={() => setTip(null)}
                            className="flex h-[15px] w-[15px] flex-none cursor-help items-center justify-center rounded-full border border-[#E4E9F5] text-[9.5px] font-bold leading-none text-[#2f5fd0] transition-colors hover:border-[#8a7fbf] hover:bg-[#E8EEFD] hover:text-[#2f5fd0]">
                            i
                          </button>
                        </span>
                      </td>
                      <td className="border-b border-[#E4E9F5] bg-[#E8EEFD] px-2 py-3 transition-colors group-hover:bg-[#E8EEFD]">
                        <div className="flex justify-center"><Switch on={allOn(ft.view)} busy={busy === `__all__:${ft.view}`} onChange={(v) => toggleAll(ft.view, v)} /></div>
                      </td>
                      {rows.map((f) => (
                        <td key={f.franchiseId} className="border-b border-[#f2f4f9] px-3 py-3 transition-colors group-hover:bg-[#fafbff]"><div className="flex justify-center"><Switch on={isOn(f, ft.view)} busy={busy === `${f.franchiseId}:${ft.view}`} onChange={(v) => toggle(f.franchiseId, ft.view, v)} /></div></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <p className="mt-3 text-[11.5px] text-[var(--ink-3)]">{t("franchise.featureOffNote")}</p>
      </div>

      {tip && (
        <div role="tooltip"
          className="pointer-events-none fixed z-[200] w-[250px] -translate-y-1/2 rounded-xl border border-[#E4E9F5] bg-[var(--surface)] p-3 shadow-[0_16px_40px_-12px_rgba(30,25,70,.35)]"
          style={tip.rtl ? { right: tip.x, top: tip.y } : { left: tip.x, top: tip.y }}>
          <div className="mb-1 text-[12px] font-extrabold text-[var(--ink)]">{tip.label}</div>
          <div className="text-[11.5px] leading-[1.5] text-[#44506F]">{tip.text}</div>
        </div>
      )}
    </div>
  );
}
