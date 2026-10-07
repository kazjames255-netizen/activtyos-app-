"use client";

// The brand-colour picker shared by Setup → Branding and the first-run checklist: a swatch row + custom picker for
// each of the provider's three brand colours (main = settings.brandColor, then brandColor2 / brandColor3).
import { useState } from "react";
import { useT } from "@/lib/i18n/provider";
import { useSettings, DEFAULT_SETTINGS, type TenantSettings } from "@/lib/settings";

export const BRAND_SWATCHES = [
  "#2f6bd8", "#1d4ed8", "#4f46e5", "#6d28d9", "#7c3aed", "#9333ea",
  "#0ea5e9", "#0891b2", "#0d9488", "#0f766e", "#059669", "#16a34a",
  "#65a30d", "#ca8a04", "#d97706", "#ea580c", "#dc2626", "#e11d48",
  "#db2777", "#be123c", "#475569", "#1e293b",
];

export type BrandKey = "brandColor" | "brandColor2" | "brandColor3";
export const BRAND_KEYS: BrandKey[] = ["brandColor", "brandColor2", "brandColor3"];

export function BrandSwatches({ value, onPick, onClear, testId }: { value?: string; onPick: (c: string) => void; onClear?: () => void; testId: string }) {
  const t = useT();
  const cur = (value ?? "").toLowerCase();
  return (
    <div className="flex max-w-[420px] flex-wrap items-center gap-2" data-testid={testId}>
      {BRAND_SWATCHES.map((c) => (
        <button key={c} type="button" onClick={() => onPick(c)} title={c} aria-label={c} aria-pressed={cur === c} className="h-6 w-6 rounded-full transition-transform hover:scale-110"
          style={{ background: c, boxShadow: cur === c ? "0 0 0 2px #fff, 0 0 0 4px #111" : "inset 0 0 0 1px rgba(0,0,0,.08)" }} />
      ))}
      <label className="flex cursor-pointer items-center gap-1.5 rounded-full border border-[var(--line)] px-2 py-1 text-[11px] font-bold text-[var(--ink-3)]">
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(value ?? "") ? value : "#2f6bd8"} onChange={(e) => onPick(e.target.value)} className="h-5 w-6 cursor-pointer rounded border-0 bg-transparent p-0" title={t("setup.customColour")} />
        {t("setup.customColour")}
      </label>
      {onClear && value ? <button type="button" onClick={onClear} className="text-[11.5px] font-bold text-[var(--ink-3)]">{t("p8lst.brandClear")}</button> : null}
    </div>
  );
}

/** Label for each slot ("Main colour" / "Second colour" / "Third colour"). */
export const brandLabelKey = (k: BrandKey) => (k === "brandColor" ? "p8lst.brandMain" : k === "brandColor2" ? "p8lst.brandSecond" : "p8lst.brandThird");

/** The provider's brand colours from their settings, or null when they have not set any of their own (the stock blue alone does not count). */
export function brandFromSettings(s: Pick<TenantSettings, "brandColor" | "brandColor2" | "brandColor3">, stock: string | undefined): { c1: string | null; c2: string | null; c3: string | null } | null {
  const ok = (v?: string) => (v && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) ? v : null);
  const c1 = ok(s.brandColor), c2 = ok(s.brandColor2), c3 = ok(s.brandColor3);
  const mainIsStock = !!c1 && c1.toLowerCase() === (stock ?? "").toLowerCase();
  if (!c2 && !c3 && (mainIsStock || !c1)) return null;
  return { c1, c2, c3 };
}

/** Optional first-run question: "What are your brand colours?" Saves straight to the same settings fields as Setup → Branding. */
export function BrandOnboardingCard() {
  const t = useT();
  const { settings, loading, save } = useSettings();
  const [err, setErr] = useState<string | null>(null);
  if (loading) return null;
  const put = (k: BrandKey, v: string | undefined) => {
    setErr(null);
    void save({ settings: { ...settings, [k]: v } }).catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
  };
  return (
    <div data-testid="first-run-brand" className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-3">
      <div className="text-[15px] font-bold leading-snug">{t("p8lst.brandStepTitle")}</div>
      <div className="text-[14px] leading-snug text-[var(--ink-2)]">{t("p8lst.brandStepSub")}</div>
      <div className="mt-2 grid gap-3 sm:grid-cols-3">
        {BRAND_KEYS.map((k, i) => (
          <div key={k}>
            <div className="mb-1 text-[13px] font-bold">{t(brandLabelKey(k))}</div>
            <BrandSwatches testId={"onboard-brand-colour-" + (i + 1)} value={settings[k] ?? (i === 0 ? DEFAULT_SETTINGS.brandColor : undefined)} onPick={(c) => put(k, c)} onClear={i === 0 ? undefined : () => put(k, undefined)} />
          </div>
        ))}
      </div>
      {err && <div className="mt-2 text-[13px] text-[#b3261e]">{err}</div>}
    </div>
  );
}
