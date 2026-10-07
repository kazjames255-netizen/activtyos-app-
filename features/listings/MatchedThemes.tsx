"use client";

// "Matched to your brand": the three themes (of all 25) closest to the provider's brand colours, as larger
// selectable cards with a mini swatch of the theme and the reason it was picked. Pure presentation: the matching
// itself is matchThemes() in pageThemes.ts. Clicking a card selects it AND saves it as the provider's default.
import { useMemo, useState } from "react";
import { useT } from "@/lib/i18n/provider";
import { matchThemes, themeKeyColours, type BrandColours, type MatchSlot } from "./pageThemes";

const REASON: Record<MatchSlot, string> = { main: "p8lst.matchMain", second: "p8lst.matchSecond", third: "p8lst.matchThird" };

/** A tiny rendition of a theme's booking page: ground, header band, accent tag and main button. */
function MiniTheme({ k }: { k: string }) {
  const c = themeKeyColours(k);
  if (!c) return null;
  const [band, acc, cta, bg] = c;
  return (
    <div aria-hidden className="relative h-[74px] w-full overflow-hidden rounded-lg ring-1 ring-black/15" style={{ background: bg }}>
      <div className="h-[28px] w-full" style={{ background: band }} />
      <span className="absolute start-2 top-[18px] h-3 w-9 rounded-full ring-1 ring-black/10" style={{ background: acc }} />
      <div className="absolute inset-x-2 bottom-2 flex items-center gap-1.5">
        <span className="h-2 w-8 rounded-full" style={{ background: band, opacity: 0.55 }} />
        <span className="h-2 flex-1 rounded-full" style={{ background: band, opacity: 0.2 }} />
        <span className="h-4 w-10 rounded-full ring-1 ring-black/10" style={{ background: cta }} />
      </div>
    </div>
  );
}

export function MatchedThemes({ brand, value, onPick, label, allThemes, saved }: {
  brand: BrandColours;
  value: string;
  onPick: (key: string) => void;
  label: (key: string) => string;
  /** The existing full picker, shown under "All themes". */
  allThemes: React.ReactNode;
  /** True once the picked theme has been saved as the provider's default. */
  saved?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const matches = useMemo(() => matchThemes(brand, 3), [brand.c1, brand.c2, brand.c3]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!matches.length) return null;
  return (
    <div data-testid="matched-themes" className="mx-3 mb-3 rounded-2xl border-2 bg-white p-3.5 sm:mx-5" style={{ borderColor: "#e9a915", boxShadow: "0 12px 30px -16px rgba(233,169,21,.8)" }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[15px] font-extrabold text-[var(--ink)]">{t("p8lst.matchedTitle")}</div>
        <div className="flex items-center gap-1" aria-hidden>
          {([brand.c1, brand.c2, brand.c3] as (string | null | undefined)[]).filter(Boolean).map((c, i) => <span key={i} className="h-4 w-4 rounded-full ring-1 ring-black/15" style={{ background: c! }} />)}
        </div>
      </div>
      <div className="mt-0.5 text-[12.5px] leading-snug text-[var(--ink-3)]">{t("p8lst.matchedLede")}</div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {matches.map((m, i) => {
          const on = value === m.key;
          return (
            <button key={m.key} type="button" data-testid={`matched-theme-${m.key}`} data-selected={on ? "1" : "0"} aria-pressed={on} onClick={() => onPick(m.key)}
              className="flex flex-col gap-2 rounded-xl border-2 p-2.5 text-start transition-all hover:-translate-y-0.5"
              style={on ? { borderColor: "#1d3a8f", background: "#eef3ff" } : { borderColor: "var(--line)", background: "var(--surface)" }}>
              <MiniTheme k={m.key} />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[14px] font-extrabold text-[var(--ink)]">{label(m.key)}</span>
                {on ? <span className="rounded-full bg-[#1d3a8f] px-2 py-0.5 text-[11px] font-bold text-white">✓ {t("p8lst.matchChosen")}</span>
                  : i === 0 ? <span className="rounded-full bg-[#fdf1cf] px-2 py-0.5 text-[11px] font-bold text-[#7a4b00]">{t("p8lst.matchBest")}</span> : null}
              </div>
              <div className="text-[12px] leading-snug text-[var(--ink-3)]">{t(REASON[m.slot])}</div>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" data-testid="matched-all-themes" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[12.5px] font-bold text-[var(--ink-2)]">
          {open ? t("p8lst.matchHideAll") : t("p8lst.matchAll")}
        </button>
        {saved && <span className="text-[12px] font-semibold text-[#0f7a43]">✓ {t("p8lst.matchDefaultSaved")}</span>}
      </div>
      {open && <div className="mt-2.5">{allThemes}</div>}
    </div>
  );
}
