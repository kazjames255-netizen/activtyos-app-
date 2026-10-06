"use client";

import { dateLocale } from "@/lib/i18n/format";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api as apiCall, get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Button, Card, FieldLabel, Input, Select } from "@/components/ui";
import { TourLauncher } from "@/features/common/TourLauncher";
import { PageHero } from "@/components/OperatorPage";
import { useT, useI18n, tNow } from "@/lib/i18n/provider";
import { Rich } from "@/components/i18n/Rich";
import { isRTL } from "@/lib/i18n/config";
import { pickPlural } from "@/lib/i18n/plural";
import * as blocksApi from "./blocksApi";
import type { ApiBundle, BundleInput } from "./blocksApi";

// ─────────────────────────────────────────────────────────────────────────
// Blocks — the build-manual's "Reusable scheduling patterns" builder.
//
// Periods (session time windows) → Passes (booking lengths) → Block Bundles
// (period+pass sets, kept in a searchable Block Library), each with a pricing
// calculator and "sent" to one or more listings. Fully backed by the API:
//   GET/POST/PUT/DELETE /api/periods
//   GET/POST/PUT/DELETE /api/passes
//   GET/POST/PUT/DELETE /api/block-bundles (+ /duplicate /archive /reorder /:id/listings)
// The pricing model lives server-side (spec §4): each bundle response carries a
// computed `resolved` (per-pass prices, per-timing prices, perDay) that this
// screen renders — the browser never re-derives prices. "Send to a listing"
// associates the bundle and snapshots the resolved pass prices onto the
// listing server-side; it does NOT materialise dated runs (that's POST
// /api/blocks). Deleting a period/pass cascades it out of every bundle.
// ─────────────────────────────────────────────────────────────────────────

interface Period {
  id: string;
  title: string;
  start: string; // "HH:MM" (24h)
  finish: string;
}
interface Pass {
  id: string;
  name: string;
  days: number;
  details?: string;
}
interface ResolvedPricing {
  passes: { id: string; name: string; days: number; price: number; details?: string }[];
  timings: Record<string, number>; // "{passId}_{periodId}" → price
  perDay: number;
}
interface Bundle {
  createdAt?: string;
  id: string;
  name: string;
  periodIds: string[];
  passIds: string[];
  listingIds: string[];
  order: number;
  archived: boolean;
  priced: boolean;
  masterPrice: number | null;
  calcOn: boolean;
  passFlat: Record<string, number>;
  passMode: Record<string, "flat">;
  periodPrice: Record<string, number>;
  resolved: ResolvedPricing;
}
interface Listing {
  id: string;
  name: string;
}
interface Draft {
  name: string;
  periodIds: string[];
  passIds: string[];
}

const EMPTY_DRAFT: Draft = { name: "", periodIds: [], passIds: [] };

// The writable half of a bundle (POST/PUT body — the server manages listingIds
// and order separately). Pricing edits merge over the current values.
interface BundleBody {
  name: string;
  periodIds: string[];
  passIds: string[];
  archived: boolean;
  priced: boolean;
  masterPrice: number | null;
  calcOn: boolean;
  passFlat: Record<string, number>;
  passMode: Record<string, "flat">;
  periodPrice: Record<string, number>;
}
function bundleBody(b: Bundle, over: Partial<BundleBody> = {}): BundleBody {
  return {
    name: b.name,
    periodIds: b.periodIds,
    passIds: b.passIds,
    archived: b.archived,
    priced: b.priced,
    masterPrice: b.masterPrice,
    calcOn: b.calcOn,
    passFlat: b.passFlat,
    passMode: b.passMode,
    periodPrice: b.periodPrice,
    ...over,
  };
}

// ── Formatting helpers (presentation only — pricing is server-side) ─────────
function to12h(t: string): string {
  const [hStr, m] = t.split(":");
  let h = parseInt(hStr, 10);
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
}
const periodRange = (p: Period) => `${to12h(p.start)}–${to12h(p.finish)}`;
const money = (n: number) => `£${(Math.round(n * 100) / 100).toFixed(2)}`;
const num = (v: string): number => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};


/** When someone presses "+ Add to block", the card lifts off the page, hovers with a glow, and visibly travels across (scrolling the page along if the
 *  block box is out of sight) into the block box, which then pulses. Respects "reduce motion". Purely visual: the real add happens in the caller. */
function flyToBlock(from: HTMLElement | null) {
  if (typeof window === "undefined" || !from) return;
  const target = document.querySelector<HTMLElement>("[data-block-drop]");
  if (!target) return;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const tr0 = target.getBoundingClientRect();
  const offscreen = tr0.top < 90 || tr0.bottom > window.innerHeight - 30;
  if (offscreen) target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  // "Reduce motion" is on in the system settings: still show where the card went, but with one short straight slide (no arc, spin or bounce).
  const a = from.getBoundingClientRect();
  const clone = from.cloneNode(true) as HTMLElement;
  Object.assign(clone.style, { position: "fixed", left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px`, margin: "0", zIndex: "2147483000", pointerEvents: "none", transformOrigin: "center", background: "#fff8e3", color: "#171534", border: "2px solid #e9a915", borderRadius: "14px" });
  document.body.appendChild(clone);
  // 1. lift off and glow (while any scrolling happens), 2. fly in a high arc to the block box, 3. land and pulse the box.
  if (reduce) {
    const b0 = target.getBoundingClientRect();
    const dx0 = b0.left + Math.min(b0.width, 300) / 2 - (a.left + a.width / 2);
    const dy0 = b0.top + Math.min(Math.max(b0.height, 80), 160) / 2 - (a.top + a.height / 2);
    clone.animate([{ transform: "translate(0,0) scale(1)", opacity: 1 }, { transform: `translate(${dx0}px, ${dy0}px) scale(0.5)`, opacity: 0.2 }], { duration: 380, easing: "ease-in-out", fill: "forwards" }).onfinish = () => clone.remove();
    return;
  }
  const lift = clone.animate(
    [{ transform: "translateY(0) scale(1)", boxShadow: "0 0 0 0 rgba(233,169,21,0)" }, { transform: "translateY(-14px) scale(1.06) rotate(-2deg)", boxShadow: "0 24px 50px -10px rgba(233,169,21,.75)" }],
    { duration: 260, easing: "ease-out", fill: "forwards" },
  );
  lift.onfinish = () => {
    window.setTimeout(() => {
      const b = target.getBoundingClientRect();
      const tx = b.left + Math.min(b.width, 300) / 2;
      const ty = b.top + Math.min(Math.max(b.height, 80), 160) / 2;
      const dx = tx - (a.left + a.width / 2);
      const dy = ty - (a.top + a.height / 2);
      const fly = clone.animate(
        [
          { transform: "translateY(-14px) scale(1.06) rotate(-2deg)", opacity: 1 },
          { transform: `translate(${dx * 0.45}px, ${Math.min(dy * 0.45, 0) - 90}px) scale(0.9) rotate(4deg)`, opacity: 1, offset: 0.5 },
          { transform: `translate(${dx}px, ${dy}px) scale(0.42) rotate(0deg)`, opacity: 0.95 },
        ],
        { duration: 950, easing: "cubic-bezier(.45,.05,.2,1)", fill: "forwards" },
      );
      fly.onfinish = () => {
        clone.animate([{ opacity: 0.95 }, { opacity: 0 }], { duration: 160, fill: "forwards" }).onfinish = () => clone.remove();
        target.animate(
          [{ boxShadow: "0 0 0 0 rgba(233,169,21,0)", transform: "scale(1)" }, { boxShadow: "0 0 0 10px rgba(233,169,21,.6)", transform: "scale(1.025)" }, { boxShadow: "0 0 0 0 rgba(233,169,21,0)", transform: "scale(1)" }],
          { duration: 650, easing: "ease-out" },
        );
      };
    }, offscreen ? 420 : 0);
  };
}

// ── Manual chrome ──────────────────────────────────────────────────────────
function PaletteCard({
  title,
  meta,
  onAdd,
  onEdit,
  onRemove,
  onDragStart,
  added = false,
  onUndo,
  accent,
}: {
  accent?: string; // a standout colour for the most important kind of card (the time periods)
  title: string;
  meta: string;
  onAdd: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onDragStart: (e: React.DragEvent) => void;
  added?: boolean;
  onUndo?: () => void;
}) {
  const t = useT();
  const cardRef = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={cardRef}
      draggable
      onDragStart={onDragStart}
      className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 transition-colors ${added ? "border-[#bfe6cd] bg-[#eefaf1]" : accent ? "" : "border-[var(--line)] bg-[var(--panel)]"}`}
      style={!added && accent ? { borderColor: `color-mix(in srgb, ${accent} 55%, var(--line))`, borderInlineStartWidth: 5, borderInlineStartColor: accent, background: `color-mix(in srgb, ${accent} 12%, var(--surface))` } : undefined}
    >
      <div className="min-w-0">
        <div className="truncate text-[12.5px] font-bold text-[var(--ink)]">{title}</div>
        <div className="truncate text-[11px] text-[var(--ink-3)]">{meta}</div>
      </div>
      <div className="flex flex-none items-center gap-1">
        {added ? (
          <>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#127a3e] px-2.5 py-[3px] text-[11px] font-extrabold text-white">{t("p8lst.blkInBlock")}</span>
            <button
              type="button"
              onClick={onUndo}
              className="px-1 text-[10.5px] font-bold text-[var(--ink-3)] underline hover:text-[var(--red)]"
            >
              {t("p8lst.blkUndo")}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => { flyToBlock(cardRef.current); onAdd(); }}
            className={accent ? "rounded-full border-0 px-2.5 py-[3px] text-[11px] font-extrabold hover:brightness-105" : "rounded-full border border-[var(--line)] px-2 py-[2px] text-[10.5px] font-bold text-[var(--brand-ink,#1d3a8f)] hover:border-[var(--brand)]"}
            style={accent ? { background: accent, color: accent === "#e9a915" ? "#2a1d00" : "#fff" } : undefined}
          >
            {t("p8lst.blkAddToBlock")}
          </button>
        )}
        <button
          type="button"
          onClick={onEdit}
          aria-label={t("p8lst.blkEdit")}
          className="px-1 text-[12px] leading-none text-[var(--ink-3)] hover:text-[var(--brand)]"
        >
          ✎
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={t("p8lst.blkDelete")}
          className="px-1 text-[13px] leading-none text-[var(--ink-3)] hover:text-[var(--red)]"
        >
          ×
        </button>
      </div>
    </div>
  );
}

function Arrow() {
  const { locale } = useI18n();
  const rtl = isRTL(locale);
  return (
    <div className="hidden select-none items-center justify-center px-1 text-[20px] text-[var(--ink-3)] lg:flex">
      {rtl ? "←" : "→"}
    </div>
  );
}

/** Blocks (freelancer) — the manual's reusable scheduling-pattern builder. */
export function BlocksApp({ embedded = false }: { embedded?: boolean } = {}) {
  const t = useT();
  const [periods, setPeriods] = useState<Period[] | null>(null);
  const [passes, setPasses] = useState<Pass[] | null>(null);
  const [bundles, setBundles] = useState<Bundle[] | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [view, setView] = useState<"make" | "library">("make");
  const [justId, setJustId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  const refresh = useCallback(() => {
    Promise.all([
      apiGet<Period[]>("/api/periods"),
      apiGet<Pass[]>("/api/passes"),
      apiGet<Bundle[]>("/api/block-bundles"),
      apiGet<Listing[]>("/api/listings?mine=1"),
    ])
      .then(([p, q, b, l]) => {
        setPeriods(p);
        setPasses(q);
        setBundles(b);
        setListings(l.map((x) => ({ id: x.id, name: x.name })));
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : tNow("p8lst.blkLoadFail")));
  }, []);

  useEffect(refresh, [refresh]);
  useRealtime(["periods", "passes", "blockBundles", "listings"], refresh);

  // Run a mutation, surface any error, then refetch. Returns whether it worked
  // so callers can clear local UI (e.g. the builder draft) only on success.
  const act = useCallback(
    async (fn: () => Promise<unknown>): Promise<boolean> => {
      try {
        await fn();
        refresh();
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : tNow("p8lst.blkWentWrong"));
        return false;
      }
    },
    [refresh],
  );

  const loading = !periods || !passes || !bundles;

  return (
    // Light palette to match the build manual (mirrors the custdash light theme).
    // Full-bleed: cancel the wrapper's p-5, re-pad, fill viewport minus the header.
    <div
      // Embedded as a tab inside the Listings page, which already supplies the
      // light palette + padding — so drop the full-bleed wrapper, hero and tour
      // launcher and render just the builder.
      className={embedded ? "" : "-m-5 min-h-[calc(100vh-3.5rem)] p-5"}
      style={
        {
          ...(embedded ? {} : { background: "var(--bg)" }),
          color: "var(--ink)",
          "--bg": "#f5f8fd",
          "--surface": "#ffffff",
          "--panel": "#fbf8fc",
          "--ink": "#171534",
          "--ink-2": "#4a4763",
          "--ink-3": "#8a86a3",
          "--line": "#ece6f1",
        } as React.CSSProperties
      }
    >
      <style>{`@keyframes aosChipPop{0%{transform:scale(.2) translateY(-30px);opacity:0}60%{transform:scale(1.18) translateY(0);opacity:1}100%{transform:scale(1);opacity:1}}.aos-chip-pop{animation:aosChipPop 520ms cubic-bezier(.2,.9,.3,1.2) both}@media (prefers-reduced-motion: reduce){.aos-chip-pop{animation:none}}`}</style>
      {!embedded && <PageHero title={t("p8lst.blkHeroTitle")} lede={t("p8lst.blkHeroLede")} icon="🗓️" actions={<TourLauncher view="blocks" compact />} />}

      {error && (
        <div className="mb-3 rounded-lg border border-[var(--red)] bg-[color-mix(in_srgb,var(--red)_8%,#ffffff)] px-3 py-2 text-[12.5px] text-[var(--red)]">
          {error}
        </div>
      )}


      {loading ? (
        <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">{t("p8lst.blkLoading")}</div>
      ) : (
        <>
          {/* Two panes that slide: making blocks (left) and the block library (right). */}
          <div className="mb-4 grid gap-2.5 sm:grid-cols-2" role="tablist" aria-label="Blocks">
            {([
              ["make", "🛠️", t("p8lst.blkTabMake"), t("p8lst.blkTabMakeSub"), "linear-gradient(120deg,#e9a915,#f3c24a)", "#2a1d00"],
              ["library", "📚", t("p8lst.blkTabLib"), t("p8lst.blkTabLibSub"), "linear-gradient(120deg,#5b3fd6,#2f6bd8)", "#fff"],
            ] as const).map(([k, icon, label, sub, bg, fg]) => {
              const on = view === k;
              const count = (bundles ?? []).filter((b) => !b.archived).length;
              return (
                <button key={k} type="button" role="tab" aria-selected={on} onClick={() => { setView(k); if (k === "make") setJustId(null); }}
                  className="relative flex items-center gap-3 rounded-2xl px-4 py-3 text-start transition-all"
                  style={on
                    ? { background: bg, color: fg, boxShadow: "0 12px 28px -12px rgba(30,40,120,.55)", transform: "translateY(-1px)" }
                    : { background: "var(--surface)", color: "var(--ink-2)", border: "2px solid var(--line)", opacity: 0.92 }}>
                  <span className="grid h-10 w-10 flex-none place-items-center rounded-xl text-[22px]" style={{ background: on ? "rgba(255,255,255,.28)" : "var(--panel)" }} aria-hidden>{icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-extrabold leading-tight">{label}{k === "library" ? ` (${count})` : ""}</span>
                    <span className="block text-[12px] leading-snug opacity-85">{sub}</span>
                  </span>
                  <span className="text-[22px] font-extrabold" aria-hidden>{k === "make" ? "‹" : "›"}</span>
                  {k === "library" && justId && view !== "library" && <span className="absolute -end-1 -top-1 h-3.5 w-3.5 rounded-full bg-[#e9a915] ring-2 ring-white" />}
                </button>
              );
            })}
          </div>
          <SlidePanes
            view={view}
            make={
              <>
                {/* .blkFlow — 3 columns */}
                <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
                  <PeriodsColumn periods={periods} draft={draft} setDraft={setDraft} act={act} />
                  <Arrow />
                  <PassesColumn passes={passes} draft={draft} setDraft={setDraft} act={act} />
                  <Arrow />
                  <BuildColumn periods={periods} passes={passes} draft={draft} setDraft={setDraft} act={act} onSaved={(id) => { setJustId(id ?? null); setView("library"); }} />
                </div>
                <div className="mt-3 flex justify-end">
                  <button type="button" onClick={() => setView("library")} className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-extrabold text-white shadow-lg transition hover:brightness-110" style={{ background: "linear-gradient(120deg,#5b3fd6,#2f6bd8)" }}>📚 {t("p8lst.blkToLib")} ›</button>
                </div>
              </>
            }
            library={
              <>
                <div className="mb-2"><button type="button" onClick={() => { setView("make"); setJustId(null); }} className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-extrabold shadow-md transition hover:brightness-105" style={{ background: "linear-gradient(120deg,#e9a915,#f3c24a)", color: "#2a1d00" }}>‹ 🛠️ {t("p8lst.blkToMake")}</button></div>
                <BlockLibrary bundles={bundles} periods={periods} passes={passes} listings={listings} act={act} pinnedId={justId} />
              </>
            }
          />
        </>
      )}
    </div>
  );
}


/** A two-pane slider: the panes sit side by side and slide across (not stacked underneath). The container follows the visible pane's height. */
function SlidePanes({ view, make, library }: { view: "make" | "library"; make: React.ReactNode; library: React.ReactNode }) {
  const aRef = useRef<HTMLDivElement>(null);
  const bRef = useRef<HTMLDivElement>(null);
  const [h, setH] = useState<number | null>(null);
  useEffect(() => {
    const el = view === "make" ? aRef.current : bRef.current;
    if (!el) return;
    const measure = () => setH(el.offsetHeight);
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [view]);
  return (
    <div className="overflow-hidden" style={{ height: h ?? undefined, transition: "height 380ms cubic-bezier(.2,.8,.2,1)" }}>
      <div className="flex items-start" style={{ width: "200%", transform: view === "library" ? "translateX(-50%)" : "translateX(0)", transition: "transform 480ms cubic-bezier(.2,.8,.2,1)" }}>
        <div ref={aRef} className="w-1/2 flex-none px-0.5" aria-hidden={view !== "make"} {...(view !== "make" ? { inert: true } : {})}>{make}</div>
        <div ref={bRef} className="w-1/2 flex-none px-0.5" aria-hidden={view !== "library"} {...(view !== "library" ? { inert: true } : {})}>{library}</div>
      </div>
    </div>
  );
}

type Act = (fn: () => Promise<unknown>) => Promise<boolean>;

// ── Column 1: Make your periods (add + edit) ───────────────────────────────
function PeriodsColumn({
  periods,
  draft,
  setDraft,
  act,
}: {
  periods: Period[];
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  act: Act;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("09am–3:30pm");
  const [start, setStart] = useState("09:00");
  const [finish, setFinish] = useState("15:30");
  const [busy, setBusy] = useState(false);
  const [triedSave, setTriedSave] = useState(false); // show validation only after a save attempt
  // The title defaults to the timings (e.g. "9am–3:30pm") and keeps following
  // them — until the user types their own, at which point we leave it alone.
  const [titleEdited, setTitleEdited] = useState(false);

  const fmtT = (t: string) => { const [h, m] = t.split(":").map(Number); if (Number.isNaN(h)) return t; const ap = h < 12 ? "am" : "pm"; return `${h % 12 || 12}${m ? ":" + String(m).padStart(2, "0") : ""}${ap}`; };
  const presetTitle = (s: string, f: string) => `${fmtT(s)}–${fmtT(f)}`;

  function reset() {
    setStart("09:00");
    setFinish("15:30");
    setTitle(presetTitle("09:00", "15:30"));
    setTitleEdited(false);
    setEditingId(null);
    setTriedSave(false);
  }
  function openEdit(p: Period) {
    setTitle(p.title);
    setStart(p.start);
    setFinish(p.finish);
    setTitleEdited(true); // keep their saved title; don't overwrite from timings
    setEditingId(p.id);
    setOpen(true);
  }
  async function saveForm() {
    setTriedSave(true);
    if (title.trim().length < 2 || start >= finish) return;
    const body = { title: title.trim(), start, finish };
    setBusy(true);
    const ok = await act(() =>
      editingId
        ? apiCall(`/api/periods/${encodeURIComponent(editingId)}`, {
            method: "PUT",
            body: JSON.stringify(body),
          })
        : apiPost("/api/periods", body),
    );
    setBusy(false);
    if (ok) {
      reset();
      setOpen(false);
    }
  }

  const addToDraft = (id: string) =>
    setDraft((d) =>
      d.periodIds.includes(id) ? d : { ...d, periodIds: [...d.periodIds, id] },
    );
  const removeFromDraft = (id: string) =>
    setDraft((d) => ({ ...d, periodIds: d.periodIds.filter((x) => x !== id) }));
  const removePeriod = (id: string) => {
    if (!confirm(t("p8lst.blkDelPeriodConfirm")))
      return;
    setDraft((d) => ({ ...d, periodIds: d.periodIds.filter((x) => x !== id) }));
    void act(() => apiCall(`/api/periods/${encodeURIComponent(id)}`, { method: "DELETE" }));
  };

  return (
    <Card className="p-3.5" style={{ borderInlineStartWidth: "4px", borderInlineStartColor: "var(--brand)" }}>
      <StepHead n={1} title={t("p8lst.blkStep1")} />
      <p className="mb-2.5 text-[11.5px] text-[var(--ink-3)]">
        {t("p8lst.blkPeriodHelp")}
      </p>

      {open ? (
        <div className="mb-2.5 flex flex-col gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-2.5">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">
            {editingId ? t("p8lst.blkEditPeriod") : t("p8lst.blkNewPeriod")}
          </div>
          <Input value={title} onChange={(e) => { const v = e.target.value; if (v.trim() === "") { setTitle(presetTitle(start, finish)); setTitleEdited(false); } else { setTitle(v); setTitleEdited(true); } }} placeholder={t("p8lst.blkPeriodTitlePh")} className="w-full" />
          {triedSave && title.trim().length < 2 && (
            <div className="text-[11px] text-[var(--red)]">{t("p8lst.blkPeriodTitleReq")}</div>
          )}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <FieldLabel>{t("p8lst.blkStart")}</FieldLabel>
              <Input type="time" value={start} onChange={(e) => { const v = e.target.value; setStart(v); if (!titleEdited) setTitle(presetTitle(v, finish)); }} className="w-full" />
            </div>
            <div className="flex-1">
              <FieldLabel>{t("p8lst.blkFinish")}</FieldLabel>
              <Input type="time" value={finish} onChange={(e) => { const v = e.target.value; setFinish(v); if (!titleEdited) setTitle(presetTitle(start, v)); }} className="w-full" />
            </div>
          </div>
          {start >= finish && (
            <div className="text-[11px] text-[var(--red)]">{t("p8lst.blkFinishAfter")}</div>
          )}
          <div className="flex gap-2">
            <Button sm variant="primary" disabled={busy} onClick={saveForm}>
              {busy ? t("p8lst.blkSaving") : editingId ? t("p8lst.blkSavePeriod") : t("p8lst.blkAddPeriod")}
            </Button>
            <Button
              sm
              onClick={() => {
                reset();
                setOpen(false);
              }}
            >
              {t("p8lst.blkCancel")}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          sm
          onClick={() => {
            reset();
            setOpen(true);
          }}
          className="mb-2.5"
        >
          {t("p8lst.blkAddAPeriod")}
        </Button>
      )}

      <div className="flex flex-col gap-1.5">
        {periods.map((p) => (
          <PaletteCard
            accent="#e9a915"
            key={p.id}
            title={p.title}
            meta={periodRange(p)}
            added={draft.periodIds.includes(p.id)}
            onAdd={() => addToDraft(p.id)}
            onUndo={() => removeFromDraft(p.id)}
            onEdit={() => openEdit(p)}
            onRemove={() => removePeriod(p.id)}
            onDragStart={(e) => e.dataTransfer.setData("text/plain", `period:${p.id}`)}
          />
        ))}
      </div>
    </Card>
  );
}

// ── Column 2: Make your passes (add + edit) ────────────────────────────────
function PassesColumn({
  passes,
  draft,
  setDraft,
  act,
}: {
  passes: Pass[];
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  act: Act;
}) {
  const t = useT();
  const { locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [days, setDays] = useState("1");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  function reset() {
    setName("");
    setDays("1");
    setDetails("");
    setEditingId(null);
  }
  function openEdit(p: Pass) {
    setName(p.name);
    setDays(String(p.days));
    setDetails(p.details ?? "");
    setEditingId(p.id);
    setOpen(true);
  }
  async function saveForm() {
    if (name.trim().length < 2) return;
    const body = { name: name.trim(), days: Math.max(1, parseInt(days, 10) || 1), details: details.trim() || undefined };
    setBusy(true);
    const ok = await act(() =>
      editingId
        ? apiCall(`/api/passes/${encodeURIComponent(editingId)}`, {
            method: "PUT",
            body: JSON.stringify(body),
          })
        : apiPost("/api/passes", body),
    );
    setBusy(false);
    if (ok) {
      reset();
      setOpen(false);
    }
  }

  const addToDraft = (id: string) =>
    setDraft((d) => (d.passIds.includes(id) ? d : { ...d, passIds: [...d.passIds, id] }));
  const removeFromDraft = (id: string) =>
    setDraft((d) => ({ ...d, passIds: d.passIds.filter((x) => x !== id) }));
  const removePass = (id: string) => {
    if (!confirm(t("p8lst.blkDelPassConfirm")))
      return;
    setDraft((d) => ({ ...d, passIds: d.passIds.filter((x) => x !== id) }));
    void act(() => apiCall(`/api/passes/${encodeURIComponent(id)}`, { method: "DELETE" }));
  };

  return (
    <Card className="p-3.5" style={{ borderInlineStartWidth: "4px", borderInlineStartColor: "var(--brand)" }}>
      <StepHead n={2} title={t("p8lst.blkStep2")} />
      <p className="mb-2.5 text-[11.5px] text-[var(--ink-3)]">
        {t("p8lst.blkPassHelp")}
      </p>

      {open ? (
        <div className="mb-2.5 flex flex-col gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-2.5">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">
            {editingId ? t("p8lst.blkEditPass") : t("p8lst.blkNewPass")}
          </div>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("p8lst.blkPassNamePh")}
            className="w-full"
          />
          <div>
            <FieldLabel>{t("p8lst.blkDetailsLabel")} <span className="font-normal text-[var(--ink-3)]">{t("p8lst.blkDetailsOpt")}</span></FieldLabel>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder={t("p8lst.blkDetailsPh")}
              rows={2}
              maxLength={500}
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12.5px] text-[var(--ink)] outline-none"
            />
          </div>
          <div className="w-[120px]">
            <FieldLabel>{t("p8lst.blkDaysLabel")}</FieldLabel>
            <Input type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} className="w-full" />
          </div>
          <div className="flex gap-2">
            <Button sm variant="primary" disabled={busy} onClick={saveForm}>
              {busy ? t("p8lst.blkSaving") : editingId ? t("p8lst.blkSavePass") : t("p8lst.blkAddPass")}
            </Button>
            <Button
              sm
              onClick={() => {
                reset();
                setOpen(false);
              }}
            >
              {t("p8lst.blkCancel")}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          sm
          onClick={() => {
            reset();
            setOpen(true);
          }}
          className="mb-2.5"
        >
          {t("p8lst.blkAddAPass")}
        </Button>
      )}

      <div className="flex flex-col gap-1.5">
        {passes.map((p) => (
          <PaletteCard
            accent="#2f6bd8"
            key={p.id}
            title={p.name}
            meta={`${pickPlural(t, locale, "p8lst.blkDays", p.days)}${p.details ? ` · ${t("p8lst.blkHasDetails")}` : ""}`}
            added={draft.passIds.includes(p.id)}
            onAdd={() => addToDraft(p.id)}
            onUndo={() => removeFromDraft(p.id)}
            onEdit={() => openEdit(p)}
            onRemove={() => removePass(p.id)}
            onDragStart={(e) => e.dataTransfer.setData("text/plain", `pass:${p.id}`)}
          />
        ))}
      </div>
    </Card>
  );
}

// ── Column 3: Build your blocks (drop zone + click-to-add) ─────────────────
function BuildColumn({
  periods,
  passes,
  draft,
  setDraft,
  act,
  onSaved,
}: {
  periods: Period[];
  passes: Pass[];
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  act: Act;
  onSaved?: (newId?: string) => void;
}) {
  const t = useT();
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const draftPeriods = draft.periodIds
    .map((id) => periods.find((p) => p.id === id))
    .filter(Boolean) as Period[];
  const draftPasses = draft.passIds
    .map((id) => passes.find((p) => p.id === id))
    .filter(Boolean) as Pass[];
  const empty = draftPeriods.length === 0 && draftPasses.length === 0;

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setOver(false);
    const [kind, id] = e.dataTransfer.getData("text/plain").split(":");
    if (!id) return;
    if (kind === "period")
      setDraft((d) =>
        d.periodIds.includes(id) ? d : { ...d, periodIds: [...d.periodIds, id] },
      );
    if (kind === "pass")
      setDraft((d) => (d.passIds.includes(id) ? d : { ...d, passIds: [...d.passIds, id] }));
  }

  const setName = (name: string) => setDraft((d) => ({ ...d, name }));
  const dropPeriod = (id: string) =>
    setDraft((d) => ({ ...d, periodIds: d.periodIds.filter((x) => x !== id) }));
  const dropPass = (id: string) =>
    setDraft((d) => ({ ...d, passIds: d.passIds.filter((x) => x !== id) }));

  async function moveToLibrary() {
    if (empty || busy || !draft.name.trim()) return;
    const body = {
      name: draft.name.trim(),
      periodIds: draft.periodIds,
      passIds: draft.passIds,
    };
    setBusy(true);
    let createdId: string | undefined;
    const ok = await act(async () => { const made = await apiPost<Bundle>("/api/block-bundles", body); createdId = made?.id; return made; });
    setBusy(false);
    if (ok) { setDraft(EMPTY_DRAFT); onSaved?.(createdId); }
  }

  return (
    <Card className="p-3.5" style={{ borderInlineStartWidth: "6px", borderInlineStartColor: "#e9a915", background: "linear-gradient(180deg, #fffaf0, var(--surface) 140px)", boxShadow: "0 14px 34px -18px rgba(233,169,21,.65)" }}>
      <StepHead n={3} title={t("p8lst.blkStep3")} />
      <p className="mb-2.5 text-[11.5px] text-[var(--ink-3)]">
        {t("p8lst.blkBuildHelp")}
      </p>

      <div
        data-block-drop
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className="mb-2.5 rounded-xl border-2 border-dashed p-3 transition-colors"
        style={{
          borderColor: over ? "var(--brand-2, #1d3a8f)" : "#e9a915",
          background: over ? "var(--brand-soft)" : "#fffdf6",
        }}
      >
        {empty ? (
          <div className="py-4 text-center text-[12px] text-[var(--ink-3)]">
            {t("p8lst.blkDropEmpty")}
            <div className="text-[11px]">{t("p8lst.blkDropTap")}</div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {draftPeriods.length > 0 && (
              <ChipRow label={t("p8lst.blkPeriods")}>
                {draftPeriods.map((p) => (
                  <Chip key={p.id} accent="#e9a915" onRemove={() => dropPeriod(p.id)}>
                    {p.title} <span className="text-[var(--ink-3)]">{periodRange(p)}</span>
                  </Chip>
                ))}
              </ChipRow>
            )}
            {draftPasses.length > 0 && (
              <ChipRow label={t("p8lst.blkPasses")}>
                {draftPasses.map((p) => (
                  <Chip key={p.id} accent="#2f6bd8" onRemove={() => dropPass(p.id)}>
                    {p.name}
                  </Chip>
                ))}
              </ChipRow>
            )}
          </div>
        )}
      </div>

      <FieldLabel>{t("p8lst.blkNameBlock")}</FieldLabel>
      <Input
        value={draft.name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("p8lst.blkNamePh")}
        className="mb-2.5 w-full"
      />

      <Button sm variant="primary" disabled={empty || busy || !draft.name.trim()} onClick={moveToLibrary}>
        {busy ? t("p8lst.blkSaving") : t("p8lst.blkMoveToLib")}
      </Button>
      {!empty && !draft.name.trim() && <div data-ui="block-name-required" className="mt-1.5 text-[11.5px] font-semibold text-[#b45309]">{t("p9jr.blockNameRequired")}</div>}
    </Card>
  );
}

// ── Block Library ──────────────────────────────────────────────────────────
// Bright, distinct colour per block (cycled by position in the library).
const BLOCK_COLORS = [
  "#e22295", "#8b5cf6", "#6366f1", "#3b82f6", "#0ea5e9", "#14b8a6",
  "#22c55e", "#84cc16", "#f59e0b", "#f97316", "#ef4444", "#f43f5e",
];
// Stable colour per block (hash of id) so reordering never reshuffles colours.
function blockColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return BLOCK_COLORS[h % BLOCK_COLORS.length];
}

function BlockLibrary({
  bundles,
  periods,
  passes,
  listings,
  act,
  pinnedId,
}: {
  bundles: Bundle[];
  periods: Period[];
  passes: Pass[];
  listings: Listing[];
  act: Act;
  pinnedId?: string | null;
}) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);

  const q = query.trim().toLowerCase();
  const active = bundles.filter((b) => !b.archived);
  const archived = bundles.filter((b) => b.archived);
  // Alphabetical, except the block just created, which sits on its own at the top (highlighted) until they leave and come back.
  const byName = [...(q ? active.filter((b) => b.name.toLowerCase().includes(q)) : active)].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true }));
  const pinned = !q && pinnedId ? byName.find((b) => b.id === pinnedId) ?? null : null;
  const filtered = pinned ? byName.filter((b) => b.id !== pinned.id) : byName;

  const expandAll = () => setCollapsed(new Set());
  const collapseAll = () => setCollapsed(new Set(active.map((b) => b.id)));
  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Drag-to-reorder within the library. Send the full ordered id list; the
  // server assigns `order` = position for each.
  const reorder = (draggedId: string, targetId: string) => {
    const ids = bundles.map((b) => b.id);
    const from = ids.indexOf(draggedId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0 || from === to) return;
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    void act(() => apiPost("/api/block-bundles/reorder", { orderedIds: next }));
  };

  const unarchive = (id: string) =>
    void act(() => apiPost(`/api/block-bundles/${encodeURIComponent(id)}/archive`, { archived: false }));
  const deleteBlock = (id: string, name: string) => {
    if (!confirm(t("p8lst.blkDeleteBlockConfirm", { name }))) return;
    void act(() => apiCall(`/api/block-bundles/${encodeURIComponent(id)}`, { method: "DELETE" }));
  };

  return (
    <div className="mt-4">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[15px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
          {t("p8lst.blkLibrary")}
        </div>
        {active.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Button sm onClick={expandAll}>
              {t("p8lst.blkExpandAll")}
            </Button>
            <Button sm onClick={collapseAll}>
              {t("p8lst.blkCollapseAll")}
            </Button>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("p8lst.blkSearchPh")}
              className="w-[200px]"
            />
          </div>
        )}
      </div>
      <p className="mb-2.5 text-[12px] text-[var(--ink-3)]">
        {t("p8lst.blkLibHelp")}
      </p>

      {(() => {
        const unpriced = active.filter((b) => !b.priced);
        if (unpriced.length === 0) return null;
        return (
          <div className="mb-2.5 flex items-start gap-2 rounded-lg border border-[#f0c98a] bg-[#fdf6ea] px-3 py-2.5 text-[12px] leading-[1.5] text-[#8a5a09]">
            <span className="text-[14px]">⚠️</span>
            <span><Rich text={t("p8lst.blkUnpricedWarn", { n: unpriced.length, names: `${unpriced.slice(0, 3).map((b) => b.name).join(", ")}${unpriced.length > 3 ? "…" : ""}` })} /></span>
          </div>
        );
      })()}

      {active.length === 0 ? (
        <Card className="p-5 text-center text-[12.5px] text-[var(--ink-3)]">
          {bundles.length === 0
            ? t("p8lst.blkNoBlocks")
            : t("p8lst.blkAllArchived")}
        </Card>
      ) : filtered.length === 0 && !pinned ? (
        <Card className="p-5 text-center text-[12.5px] text-[var(--ink-3)]">
          {t("p8lst.blkNoMatch", { q: query })}
        </Card>
      ) : (
        <>
        {pinned && (
          <div className="mb-4 rounded-2xl p-3" style={{ background: "linear-gradient(120deg, #fff3cf, #ffe3a3)", border: "2px solid #e9a915", boxShadow: "0 10px 30px -14px rgba(233,169,21,.7)" }}>
            <div className="mb-2 flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-wide text-[#7a4b00]"><span aria-hidden>✨</span>{t("p8lst.blkJustCreated")}</div>
            <LibraryCard block={pinned} periods={periods} passes={passes} listings={listings} act={act} color={blockColor(pinned.id)} expanded={!collapsed.has(pinned.id)} onToggle={() => toggle(pinned.id)} onDropBlock={(draggedId) => reorder(draggedId, pinned.id)} />
          </div>
        )}
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map((b) => (
            <LibraryCard
              key={b.id}
              block={b}
              periods={periods}
              passes={passes}
              listings={listings}
              act={act}
              color={blockColor(b.id)}
              expanded={!collapsed.has(b.id)}
              onToggle={() => toggle(b.id)}
              onDropBlock={(draggedId) => reorder(draggedId, b.id)}
            />
          ))}
        </div>
        </>
      )}

      {archived.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="flex items-center gap-1.5 text-[12px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]"
          >
            <span>{showArchived ? "▾" : "▸"}</span> {t("p8lst.blkArchivedN", { n: archived.length })}
          </button>
          {showArchived && (
            <div className="mt-2 flex flex-col gap-1.5">
              {archived.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2"
                >
                  <span className="h-3 w-3 flex-none rounded-[4px]" style={{ background: blockColor(b.id) }} />
                  <span className="flex-1 truncate text-[13px] font-bold">{b.name}</span>
                  <Button sm onClick={() => unarchive(b.id)}>
                    {t("p8lst.blkUnarchive")}
                  </Button>
                  <Button sm variant="danger" onClick={() => deleteBlock(b.id, b.name)}>
                    {t("p8lst.blkDelete")}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LibraryCard({
  block,
  periods,
  passes,
  listings,
  act,
  color,
  expanded,
  onToggle,
  onDropBlock,
}: {
  block: Bundle;
  periods: Period[];
  passes: Pass[];
  listings: Listing[];
  act: Act;
  color: string;
  expanded: boolean;
  onToggle: () => void;
  onDropBlock: (draggedId: string) => void;
}) {
  const t = useT();
  const [renaming, setRenaming] = useState(false);
  const [tempName, setTempName] = useState(block.name);
  const [showCalc, setShowCalc] = useState(!block.priced); // new / unpriced blocks open with their prices showing
  const [dragOver, setDragOver] = useState(false);
  const [editing, setEditing] = useState(false);

  const blockPeriods = useMemo(
    () => block.periodIds.map((id) => periods.find((p) => p.id === id)).filter(Boolean) as Period[],
    [block.periodIds, periods],
  );
  const blockPasses = useMemo(
    () => block.passIds.map((id) => passes.find((p) => p.id === id)).filter(Boolean) as Pass[],
    [block.passIds, passes],
  );
  const inListings = block.listingIds
    .map((id) => listings.find((l) => l.id === id))
    .filter(Boolean) as Listing[];
  const available = listings.filter((l) => !block.listingIds.includes(l.id));

  // Every structural edit PUTs the whole bundle (server keeps listingIds/order).
  const putBundle = (over: Partial<BundleBody>) =>
    act(() =>
      apiCall(`/api/block-bundles/${encodeURIComponent(block.id)}`, {
        method: "PUT",
        body: JSON.stringify(bundleBody(block, over)),
      }),
    );

  const saveName = () => {
    const name = tempName.trim();
    if (name && name !== block.name) void putBundle({ name });
    setRenaming(false);
  };
  const setListingIds = (listingIds: string[]) =>
    act(() =>
      apiCall(`/api/block-bundles/${encodeURIComponent(block.id)}/listings`, {
        method: "PUT",
        body: JSON.stringify({ listingIds }),
      }),
    );
  const addListing = (id: string) =>
    block.listingIds.includes(id) ? undefined : void setListingIds([...block.listingIds, id]);
  const removeListing = (id: string) =>
    void setListingIds(block.listingIds.filter((x) => x !== id));
  const addPeriod = (pid: string) =>
    block.periodIds.includes(pid) ? undefined : void putBundle({ periodIds: [...block.periodIds, pid] });
  const removePeriodFromBlock = (pid: string) =>
    void putBundle({ periodIds: block.periodIds.filter((x) => x !== pid) });
  const addPass = (pid: string) =>
    block.passIds.includes(pid) ? undefined : void putBundle({ passIds: [...block.passIds, pid] });
  const removePassFromBlock = (pid: string) =>
    void putBundle({ passIds: block.passIds.filter((x) => x !== pid) });
  const availablePeriods = periods.filter((p) => !block.periodIds.includes(p.id));
  const availablePasses = passes.filter((p) => !block.passIds.includes(p.id));

  const duplicate = () =>
    void act(() => apiPost(`/api/block-bundles/${encodeURIComponent(block.id)}/duplicate`, {}));
  const archive = () =>
    void act(() => apiPost(`/api/block-bundles/${encodeURIComponent(block.id)}/archive`, { archived: true }));
  const remove = () => {
    if (!confirm(t("p8lst.blkDeleteBlockConfirm", { name: block.name }))) return;
    void act(() => apiCall(`/api/block-bundles/${encodeURIComponent(block.id)}`, { method: "DELETE" }));
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        setDragOver(false);
        const [kind, id] = e.dataTransfer.getData("text/plain").split(":");
        if (kind === "block" && id) onDropBlock(id);
      }}
      className="overflow-hidden rounded-xl border p-3.5"
      style={{
        borderColor: dragOver ? color : "var(--line)",
        background: "#ffffff",
        boxShadow: dragOver ? `0 0 0 2px ${color}` : undefined,
      }}
    >
      {/* Featured gradient header — matches the Money "at a glance" card. */}
      <div className="-mx-3.5 -mt-3.5 mb-3 px-3.5 py-2.5 text-white" style={{ background: "radial-gradient(120% 140% at 12% -20%, #4f8bf5 0%, transparent 55%), linear-gradient(120deg,#16306e 0%,#3f78d8 100%)" }}>
      <div className="flex items-start justify-between gap-2">
        {renaming ? (
          <div className="flex flex-1 items-center gap-1.5">
            <Input
              autoFocus
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveName()}
              className="flex-1"
            />
            <Button sm variant="primary" onClick={saveName}>
              {t("p8lst.blkSave")}
            </Button>
          </div>
        ) : (
          <div className="flex min-w-0 items-center gap-1.5">
            <span
              draggable
              onDragStart={(e) => e.dataTransfer.setData("text/plain", `block:${block.id}`)}
              title={t("p8lst.blkDragReorder")}
              className="flex-none cursor-grab text-[14px] leading-none text-white/60 active:cursor-grabbing"
            >
              ⠿
            </span>
            <span className="h-3.5 w-3.5 flex-none rounded-[5px]" style={{ background: color }} />
            <button
              type="button"
              onClick={onToggle}
              className="truncate text-start text-[14px] font-extrabold text-white"
            >
              {block.name}
            </button>
            <button
              type="button"
              onClick={() => {
                setTempName(block.name);
                setRenaming(true);
              }}
              aria-label={t("p8lst.blkRename")}
              className="flex-none text-[12px] text-white/70 hover:text-white"
            >
              ✎
            </button>
          </div>
        )}
        <div className="flex flex-none items-center gap-1.5">
          <span
            className={`rounded-full px-2 py-[2px] text-[10px] font-bold ${
              block.priced
                ? "bg-white text-[#1d3a8f]"
                : "bg-[#f59e0b] text-white"
            }`}
          >
            {block.priced ? t("p8lst.blkPriced") : t("p8lst.blkNeedsPricing")}
          </span>
          <button
            type="button"
            onClick={onToggle}
            aria-label={expanded ? t("p8lst.blkCollapse") : t("p8lst.blkExpand")}
            className="text-[11px] text-white/70 hover:text-white"
          >
            {expanded ? "▲" : "▼"}
          </button>
        </div>
      </div>
      <div className="mt-0.5 text-[11.5px] text-white/80">
        {t("p8lst.blkCounts", { p: blockPeriods.length, q: blockPasses.length })}{block.createdAt ? ` · ${t("p9tx.blkCreated", { date: new Date(block.createdAt).toLocaleDateString(dateLocale(), { day: "numeric", month: "short", year: "numeric" }) })}` : ""}
      </div>
      </div>

      {expanded && (
        <>
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">
                {t("p8lst.blkPeriods")}
              </div>
              {editing ? (
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {blockPeriods.map((p) => (
                    <Chip key={p.id} onRemove={() => removePeriodFromBlock(p.id)}>
                      {p.title}
                    </Chip>
                  ))}
                  {availablePeriods.length > 0 && (
                    <Select
                      value=""
                      onChange={(e) => e.target.value && addPeriod(e.target.value)}
                      className="h-[26px] py-0 text-[11px]"
                    >
                      <option value="">{t("p8lst.blkAddPeriodOpt")}</option>
                      {availablePeriods.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </Select>
                  )}
                </div>
              ) : (
                <div className="text-[12px] text-[var(--ink-2)]">
                  {blockPeriods.length ? (
                    blockPeriods.map((p) => (
                      <div key={p.id}>
                        {p.title} <span className="text-[var(--ink-3)]">{periodRange(p)}</span>
                      </div>
                    ))
                  ) : (
                    <span className="text-[var(--ink-3)]">—</span>
                  )}
                </div>
              )}
            </div>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">
                {t("p8lst.blkPasses")}
              </div>
              {editing ? (
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {blockPasses.map((p) => (
                    <Chip key={p.id} onRemove={() => removePassFromBlock(p.id)}>
                      {p.name}
                    </Chip>
                  ))}
                  {availablePasses.length > 0 && (
                    <Select
                      value=""
                      onChange={(e) => e.target.value && addPass(e.target.value)}
                      className="h-[26px] py-0 text-[11px]"
                    >
                      <option value="">{t("p8lst.blkAddPassOpt")}</option>
                      {availablePasses.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </div>
              ) : (
                <div className="text-[12px] text-[var(--ink-2)]">
                  {blockPasses.length ? (
                    blockPasses.map((p) => p.name).join(" · ")
                  ) : (
                    <span className="text-[var(--ink-3)]">—</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {showCalc && (
            <PricingCalculator block={block} periods={blockPeriods} onSavePricing={putBundle} />
          )}

          {/* Send to listings */}
          <div className="mt-2.5">
            <div className="text-[10px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">
              {t("p8lst.blkSentTo")}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {inListings.length ? (
                inListings.map((l) => (
                  <Chip key={l.id} onRemove={() => removeListing(l.id)}>
                    {l.name}
                  </Chip>
                ))
              ) : (
                <span className="text-[11.5px] text-[var(--ink-3)]">{t("p8lst.blkNotSent")}</span>
              )}
              {available.length > 0 && (
                <Select
                  value=""
                  onChange={(e) => e.target.value && addListing(e.target.value)}
                  className="cursor-pointer py-0 text-[11.5px] font-bold"
                  style={{
                    height: 30,
                    borderRadius: 999,
                    borderColor: "var(--brand-line, #cdddf7)",
                    background: "var(--brand-soft)",
                    color: "var(--brand-ink)",
                    paddingInlineStart: 12,
                    paddingInlineEnd: 10,
                  }}
                >
                  <option value="">{t("p8lst.blkSendOpt")}</option>
                  {available.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              )}
            </div>
            {inListings.length > 0 && !block.priced && (
              <div className="mt-1 text-[11px] text-[var(--ink-3)]">
                {t("p8lst.blkSortToPush")}
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <Button sm variant={showCalc ? "primary" : "default"} onClick={() => setShowCalc((v) => !v)}
              style={!showCalc && !block.priced ? { background: "#f59e0b", color: "#fff", borderColor: "#f59e0b" } : undefined}>
              {showCalc ? t("p8lst.blkClosePricing") : block.priced ? t("p8lst.blkSortPricing") : t("p8lst.blkSetPrices")}
            </Button>
            <Button sm variant={editing ? "primary" : "default"} onClick={() => setEditing((v) => !v)}>
              {editing ? t("p8lst.blkDone") : t("p8lst.blkEdit")}
            </Button>
            <Button sm onClick={duplicate}>
              {t("p8lst.blkDuplicate")}
            </Button>
            <Button sm onClick={archive}>
              {t("p8lst.blkArchive")}
            </Button>
            <Button sm variant="danger" onClick={remove}>
              {t("p8lst.blkDelete")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Pricing calculator ─────────────────────────────────────────────────────
// The operator sets the inputs (master price, per-pass/per-timing overrides,
// auto-calc on/off); the derived numbers come from the server's `resolved`
// pricing (spec §4). Editing is local; "Save pricing" PUTs the bundle and the
// server returns freshly-resolved prices.
function PricingCalculator({
  block,
  periods,
  onSavePricing,
}: {
  block: Bundle;
  periods: Period[];
  onSavePricing: (over: Partial<BundleBody>) => Promise<boolean>;
}) {
  const t = useT();
  const { locale } = useI18n();
  // A block that still needs prices opens with every pass row expanded, so the price field is in plain sight instead of behind a collapsed "£0.00 ▼" row.
  const [openAll] = useState(!block.priced);
  const [toggled, setToggled] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);

  const [masterPrice, setMasterPrice] = useState(
    block.masterPrice != null ? String(block.masterPrice) : "",
  );
  const [calcOn, setCalcOn] = useState(block.calcOn !== false);
  // Each pass is priced on its OWN — a day pass isn't a fraction of the week, so
  // editing the longest pass must not move the shorter ones. Non-longest passes
  // seed from their current price as independent (flat) values; only the timings
  // WITHIN a pass are pro-rata'd (by hours) from that pass's price.
  const [passFlat, setPassFlat] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    // A pass that already has its own real price keeps it. Passes never priced start on AUTO (calculated from the longest pass).
    block.resolved.passes.forEach((p, i) => { if (i > 0 && p.price > 0) seed[p.id] = String(p.price); });
    return { ...seed, ...Object.fromEntries(Object.entries(block.passFlat).map(([k, v]) => [k, String(v)])) };
  });
  const [passMode, setPassMode] = useState<Record<string, "flat">>(() => {
    const seed: Record<string, "flat"> = {};
    block.resolved.passes.forEach((p, i) => { if (i > 0 && p.price > 0) seed[p.id] = "flat"; });
    return { ...seed, ...block.passMode };
  });
  const [periodPrice, setPeriodPriceState] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(block.periodPrice).map(([k, v]) => [k, String(v)])),
  );

  // Ordered pass list with server-resolved prices (days DESC; first is master).
  const passes = block.resolved.passes;
  const resolvedTiming = (passId: string, periodId: string) =>
    block.resolved.timings[`${passId}_${periodId}`] ?? 0;
  // Timing rows: the block's periods, ordered by start (matches the palette).
  const timingRows = useMemo(
    () => [...periods].sort((a, b) => (a.start < b.start ? -1 : 1)),
    [periods],
  );
  // Hours in a timing, and the longest timing's hours — the pro-rata base for
  // per-timing pricing (a shorter finish costs proportionally less).
  const pHrs = (p: Period) => { const mins = (s: string) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; }; const d = (mins(p.finish) - mins(p.start)) / 60; return d > 0 ? d : 1; };
  const baseTimingH = timingRows.length ? Math.max(...timingRows.map(pHrs)) : 0;
  // The longest-finish timing — the one the pass price is set against (the rest
  // work out shorter). Named so the price box can say WHY it's the reference.
  const longestTiming = timingRows.length ? timingRows.reduce((a, b) => (pHrs(b) > pHrs(a) ? b : a)) : null;
  // Label for the longest timing: its range, prefixed with the title only when
  // that's a real name (not itself a time — periods can auto-title to their range).
  const longestLabel = longestTiming
    ? (/\d\s*(am|pm)|\d:\s*\d/i.test(longestTiming.title) ? periodRange(longestTiming) : `${longestTiming.title} · ${periodRange(longestTiming)}`)
    : "";

  const setFlat = (passId: string, v: string) => {
    setPassFlat((m) => ({ ...m, [passId]: v }));
    setPassMode((m) => ({ ...m, [passId]: "flat" }));
  };
  const resetPass = (passId: string) => {
    setPassFlat((m) => {
      const next = { ...m };
      delete next[passId];
      return next;
    });
    setPassMode((m) => {
      const next = { ...m };
      delete next[passId];
      return next;
    });
  };
  const setPeriodPrice = (key: string, v: string) =>
    setPeriodPriceState((m) => ({ ...m, [key]: v }));
  const resetPeriodPrice = (key: string) =>
    setPeriodPriceState((m) => {
      const next = { ...m };
      delete next[key];
      return next;
    });

  async function save() {
    const master = masterPrice.trim() === "" ? null : num(masterPrice);
    const flat = Object.fromEntries(Object.entries(passFlat).map(([k, v]) => [k, num(v)]));
    const timings = Object.fromEntries(Object.entries(periodPrice).map(([k, v]) => [k, num(v)]));
    // "Priced" means the provider set a price. A price they TYPED as £0 is a deliberate choice (a funded or free ticket, e.g. HAF),
    // so it counts; an empty field does not.
    const priced = master !== null || Object.values(flat).some((v) => v > 0);
    setBusy(true);
    await onSavePricing({
      masterPrice: master,
      calcOn,
      passFlat: flat,
      passMode,
      periodPrice: timings,
      priced,
    });
    setBusy(false);
  }

  // Display price for a pass row: master + flat overrides are what the operator
  // typed (local). Auto rows compute LIVE from the typed master — same pro-rata
  // formula as the server (perDay = master / longest-pass days) — so shorter
  // passes update as you type, not only after Save.
  const passDisplayPrice = (passId: string, idx: number, resolvedPrice: number): number => {
    if (idx === 0) return num(masterPrice);
    // A pass the provider priced themselves keeps that price. Every other pass is CALCULATED live from the longest pass (price per day x its days).
    if (passMode[passId] === "flat") return num(passFlat[passId] ?? "0");
    if (calcOn) return autoPassPrice(passId, resolvedPrice);
    return resolvedPrice;
  };
  const autoPassPrice = (passId: string, fallback: number): number => {
    const top = passes[0];
    const me = passes.find((x) => x.id === passId);
    if (!top || !me || !top.days) return fallback;
    return Math.round((num(masterPrice) * me.days / top.days) * 100) / 100;
  };
  const recalcAll = () => { setPassFlat({}); setPassMode({}); };

  // Per-timing price, computed LIVE from the typed master price so the boxes
  // fill in as you type (not only after Save). A timing costs its share of the
  // pass price by hours: pass price × (this timing's hours ÷ longest timing's
  // hours) — the longest timing = the full pass price. Manual mode / no master
  // falls back to the saved server value.
  const liveTiming = (passId: string, idx: number, per: Period): number => {
    if (calcOn && baseTimingH > 0) {
      const base = passDisplayPrice(passId, idx, passes[idx]?.price ?? 0);
      return Math.round(((base * pHrs(per)) / baseTimingH) * 100) / 100;
    }
    return resolvedTiming(passId, per.id);
  };

  return (
    <div className="mt-2.5 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2.5">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[13px] font-extrabold">{t("p8lst.blkCalcTitle")}</span>
        <button
          type="button"
          onClick={() => setCalcOn((v) => !v)}
          role="switch"
          aria-checked={calcOn}
          className="relative h-[18px] w-[32px] rounded-full transition-colors"
          style={{ background: calcOn ? "var(--brand)" : "var(--line)" }}
        >
          <span
            className="absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white transition-all"
            style={{ insetInlineStart: calcOn ? "16px" : "2px" }}
          />
        </button>
        <span className="text-[11px] text-[var(--ink-3)]">{calcOn ? t("p8lst.blkAutoOn") : t("p8lst.blkAutoOff")}</span>
      </div>
      <p className="mb-2 text-[11px] text-[var(--ink-3)]">
        {calcOn
          ? t("p8lst.blkCalcOnHelp")
          : t("p8lst.blkCalcOffHelp")}
      </p>

      {calcOn && passes.length > 1 && (
        <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg bg-[#e7f6ee] px-3 py-2 text-[12px] text-[#0b5a3f]">
          <span className="font-extrabold">✨ {t("p8lst.blkCalcAllNote")}</span>
          <button type="button" onClick={recalcAll} className="ms-auto rounded-full bg-[#0f7a43] px-3 py-1 text-[11.5px] font-extrabold text-white">{t("p8lst.blkCalcAllBtn")}</button>
        </div>
      )}
      {passes.length === 0 ? (
        <div className="text-[11.5px] text-[var(--ink-3)]">{t("p8lst.blkAddPassesToPrice")}</div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {passes.map((q, idx) => {
            const isM = idx === 0;
            // Every pass gets its own colour so they are easy to tell apart (the longest, set-first pass is always gold).
            const PASS_COLS = ["#e9a915", "#2f6bd8", "#0f9d6b", "#8a4fd6", "#e0457b", "#0e8fa8", "#d9692a"];
            const pc = PASS_COLS[idx % PASS_COLS.length];
            const isFlat = passMode[q.id] === "flat";
            const price = passDisplayPrice(q.id, idx, q.price);
            const open = openAll !== toggled.has(q.id);
            return (
              <div key={q.id} className="overflow-hidden rounded-lg border" style={{ borderColor: pc, borderWidth: isM ? 3 : 2, borderInlineStartWidth: 8, boxShadow: isM ? "0 14px 34px -16px rgba(233,169,21,.8)" : `0 8px 22px -16px ${pc}` }}>
                {isM && (
                  <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-[12.5px] font-extrabold text-[#2a1d00]" style={{ background: "linear-gradient(120deg,#f3c24a,#e9a915)" }}>
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-[#2a1d00] text-[13px] text-[#f3c24a]">1</span>
                    {t("p8lst.blkStartHere")}
                    <span className="font-semibold opacity-85">{t("p8lst.blkStartHereSub")}</span>
                  </div>
                )}
                {!isM && idx === 1 && (
                  <div className="border-b border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[11.5px] font-bold text-[var(--ink-3)]">{t("p8lst.blkThenOthers")}</div>
                )}
                <button
                  type="button"
                  onClick={() => { setToggled((s) => { const n = new Set(s); if (n.has(q.id)) n.delete(q.id); else n.add(q.id); return n; }); }}
                  className="flex w-full items-center gap-2 px-2.5 py-1.5 text-start"
                  style={{ background: `color-mix(in srgb, ${pc} ${isM ? 22 : 16}%, #fff)` }}
                >
                  <span className="grid h-6 w-6 flex-none place-items-center rounded-full text-[12px] font-extrabold text-white" style={{ background: pc }}>{idx + 1}</span>
                  <span className="text-[14px] font-extrabold">{q.name}</span>
                  <span className="text-[11px] text-[var(--ink-3)]">
                    {pickPlural(t, locale, "p8lst.blkDays", q.days)}
                    {isM ? ` · ${t("p8lst.blkLongest")}` : ""}
                  </span>
                  <span className="ms-auto text-[13px] font-extrabold">{money(price || 0)}</span>
                  <span className="text-[var(--ink-3)]">{open ? "▲" : "▼"}</span>
                </button>

                {open && (
                  <div className="border-t border-[var(--line)] p-2.5">
                    {/* The driver: this pass's own full price, up top and clearly
                        highlighted. Each pass is priced on its own — a day pass
                        isn't a fraction of the week. Its timings calculate from it. */}
                    <div className="mb-2.5 rounded-lg border-2 p-2.5" style={{ borderColor: pc, background: `color-mix(in srgb, ${pc} ${isM ? 20 : 12}%, #fff)` }}>
                      <label className="block text-[11.5px] font-extrabold leading-[1.45] text-[#8a5a09]">
                        {t("p8lst.blkFullPrice")}
                        {longestTiming && timingRows.length > 1 ? (
                          <span className="font-semibold text-[#a97b2e]"> <Rich text={t("p8lst.blkFullPriceLongest", { label: longestLabel })} /></span>
                        ) : (
                          <span className="font-semibold text-[#a97b2e]"> {t("p8lst.blkFullPriceSimple")}</span>
                        )}
                      </label>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className="text-[16px] font-extrabold text-[#8a5a09]">£</span>
                        <Input
                          type="number"
                          step="0.01"
                          value={isM ? masterPrice : (isFlat ? (passFlat[q.id] ?? "") : (calcOn ? (num(masterPrice) ? autoPassPrice(q.id, 0).toFixed(2) : "") : (passFlat[q.id] ?? "")))}
                          onChange={(e) => (isM ? setMasterPrice(e.target.value) : setFlat(q.id, e.target.value))}
                          placeholder="0.00"
                          className={isM ? "w-[170px] text-[18px] font-extrabold" : "w-[130px] text-[15px] font-bold"}
                        />
                        {!isM && calcOn && !isFlat && <span className="rounded-full bg-[#e7f6ee] px-2.5 py-1 text-[11px] font-extrabold text-[#0f7a43]">✨ {t("p8lst.blkCalcAuto")}</span>}
                        {!isM && isFlat && calcOn && (
                          <button type="button" onClick={() => resetPass(q.id)} className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] font-extrabold text-[var(--brand)]">↺ {t("p8lst.blkCalcBack")}</button>
                        )}
                      </div>
                    </div>
                    <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">
                      {t("p8lst.blkTimingsPrices")} <span className="font-semibold normal-case tracking-normal">{t("p8lst.blkTimingsNote")}</span>
                    </div>
                    {timingRows.length === 0 ? (
                      <div className="text-[11px] text-[var(--ink-3)]">{t("p8lst.blkNoTimings")}</div>
                    ) : (
                      timingRows.map((p) => {
                        const key = `${q.id}_${p.id}`;
                        const ovStr = periodPrice[key];
                        const calc = liveTiming(q.id, idx, p);
                        const inputVal =
                          ovStr !== undefined ? ovStr : calcOn && calc ? calc.toFixed(2) : "";
                        return (
                          <div
                            key={p.id}
                            className="flex items-center gap-2 border-t border-dashed border-[var(--line)] py-1.5 first:border-t-0"
                          >
                            <div className="flex-1">
                              <div className="text-[12px] font-bold">{p.title}</div>
                              <div className="text-[10.5px] text-[var(--ink-3)]">{periodRange(p)}</div>
                            </div>
                            <span className="font-extrabold">£</span>
                            <Input
                              type="number"
                              step="0.01"
                              value={inputVal}
                              onChange={(e) => setPeriodPrice(key, e.target.value)}
                              className="w-[84px]"
                            />
                            {ovStr !== undefined && calcOn && (
                              <button
                                type="button"
                                title={t("p8lst.blkResetCalc")}
                                onClick={() => resetPeriodPrice(key)}
                                className="text-[14px] font-bold text-[var(--brand)]"
                              >
                                ↺
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-2.5 flex items-center gap-2">
        <Button sm variant="primary" disabled={busy} onClick={save}>
          {busy ? t("p8lst.blkSaving") : t("p8lst.blkSavePricing")}
        </Button>
        {calcOn && block.resolved.perDay > 0 && (
          <span className="text-[11px] text-[var(--ink-3)]">
            {t("p8lst.blkPerDay", { price: money(block.resolved.perDay) })}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Small shared bits ──────────────────────────────────────────────────────
function StepHead({ n, title }: { n: number; title: string }) {
  return (
    <div className="mb-1.5 flex items-center gap-2">
      <span
        className="flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full text-[12px] font-extrabold text-white"
        style={{ background: "var(--brand)" }}
      >
        {n}
      </span>
      <span className="text-[14px] font-extrabold">{title}</span>
    </div>
  );
}

function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({ children, onRemove, accent }: { children: React.ReactNode; onRemove: () => void; accent?: string }) {
  const t = useT();
  return (
    <span
      className={accent ? "aos-chip-pop inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-extrabold" : "inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-[3px] text-[11.5px] font-semibold text-[var(--ink-2)]"}
      style={accent ? { background: `color-mix(in srgb, ${accent} 16%, #fff)`, border: `2px solid ${accent}`, color: "#171534" } : undefined}
    >
      {children}
      <button
        type="button"
        onClick={onRemove}
        aria-label={t("p8lst.blkRemove")}
        className="text-[var(--ink-3)] hover:text-[var(--red)]"
      >
        ×
      </button>
    </span>
  );
}
