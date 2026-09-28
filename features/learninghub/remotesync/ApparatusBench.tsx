"use client";

import { useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { useT } from "@/lib/i18n/provider";
import { FOCUS } from "../kit";
import { useBareTool } from "../tools/bareContext";

// The Equipment tool: a lab bench. Tap an item in the tray to put it on the bench, drag it where it belongs, then make it bigger / smaller, turn it, flip it,
// give it a name, or take it off. It is a drawing surface for "draw the set-up" questions — it never says which items an experiment needs.

export interface BenchItem { id: number; kind: string; icon: string; label: string; x: number; y: number; size: number; rot: number; flip: boolean; name: string }
export interface BenchState { items: BenchItem[]; sel: number | null; next: number }
export const BENCH_DEFAULT: BenchState = { items: [], sel: null, next: 1 };

export const APPARATUS = [
  { kind: "tube", icon: "🧪", label: "Test tube" }, { kind: "flask", icon: "⚗️", label: "Flask" }, { kind: "burner", icon: "🔥", label: "Bunsen burner" },
  { kind: "goggles", icon: "🥽", label: "Goggles" }, { kind: "petri", icon: "🧫", label: "Petri dish" }, { kind: "balance", icon: "⚖️", label: "Balance" },
  { kind: "thermo", icon: "🌡️", label: "Thermometer" }, { kind: "magnet", icon: "🧲", label: "Magnet" }, { kind: "microscope", icon: "🔬", label: "Microscope" },
  { kind: "dropper", icon: "💧", label: "Dropper / drop" }, { kind: "stopwatch", icon: "⏱️", label: "Stopwatch" }, { kind: "battery", icon: "🔋", label: "Battery" },
  { kind: "bulb", icon: "💡", label: "Bulb" }, { kind: "bottle", icon: "🧴", label: "Bottle" }, { kind: "spoon", icon: "🥄", label: "Spatula" }, { kind: "text", icon: "🏷️", label: "Text label" },
];
const MIN = 28, MAX = 140, STEP = 12;
// Translation key per equipment kind (the English `label` above is only the stored fallback).
const AP_KEY: Record<string, string> = { tube: "hublive.dAptube", flask: "hublive.dApflask", burner: "hublive.dApburner", goggles: "hublive.dApgoggles", petri: "hublive.dAppetri", balance: "hublive.dApbalance", thermo: "hublive.dApthermo", magnet: "hublive.dApmagnet", microscope: "hublive.dApmicroscope", dropper: "hublive.dApdropper", stopwatch: "hublive.dApstopwatch", battery: "hublive.dApbattery", bulb: "hublive.dApbulb", bottle: "hublive.dApbottle", spoon: "hublive.dApspoon", text: "hublive.dAptext" };

export function ApparatusBench({ value, onChange }: { value: BenchState; onChange: (v: BenchState) => void }) {
  const t = useT();
  const apLabel = (kind: string, fallback: string) => (AP_KEY[kind] ? t(AP_KEY[kind]!) : fallback);
  const v = { ...BENCH_DEFAULT, ...value };
  const bench = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; dx: number; dy: number; pid: number } | null>(null);
  const bare = useBareTool();
  const [editing, setEditing] = useState(false);
  const sel = v.items.find((i) => i.id === v.sel) ?? null;
  const set = (p: Partial<BenchState>) => onChange({ ...v, ...p });
  const patch = (id: number, p: Partial<BenchItem>) => set({ items: v.items.map((i) => (i.id === id ? { ...i, ...p } : i)) });

  const add = (a: { kind: string; icon: string; label: string }) => {
    const n = v.items.length;
    const it: BenchItem = { id: v.next, kind: a.kind, icon: a.icon, label: a.label, x: 0.18 + ((n * 0.11) % 0.64), y: 0.25 + ((n * 0.13) % 0.5), size: a.kind === "text" ? 20 : 56, rot: 0, flip: false, name: a.kind === "text" ? t("hublive.dLabelDefault") : "" };
    set({ items: [...v.items, it], sel: it.id, next: v.next + 1 });
    if (a.kind === "text") setEditing(true);
  };
  const down = (e: RPointerEvent, it: BenchItem) => {
    const r = bench.current!.getBoundingClientRect();
    drag.current = { id: it.id, dx: e.clientX - (r.left + it.x * r.width), dy: e.clientY - (r.top + it.y * r.height), pid: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    set({ sel: it.id });
  };
  const move = (e: RPointerEvent) => {
    const d = drag.current; if (!d || d.pid !== e.pointerId) return;
    const r = bench.current!.getBoundingClientRect();
    patch(d.id, { x: Math.max(0.02, Math.min(0.98, (e.clientX - d.dx - r.left) / r.width)), y: Math.max(0.04, Math.min(0.96, (e.clientY - d.dy - r.top) / r.height)) });
  };
  const btn = "min-h-[40px] rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-[13px] font-extrabold text-[var(--ink)] disabled:opacity-40 " + FOCUS;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2" data-testid="apparatus-bench">
      <div className="flex flex-none flex-wrap gap-1.5" role="group" aria-label={t("hublive.dEquipTray")} data-tool-strip>
        {APPARATUS.map((a) => (
          <button key={a.kind} type="button" onClick={() => add(a)} data-testid={`apparatus-add-${a.kind}`} title={t("hublive.dPutOnBench", { item: apLabel(a.kind, a.label) })}
            className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--panel)] px-3 text-[12.5px] font-extrabold text-[var(--ink)] hover:brightness-95 ${FOCUS}`}>
            <span aria-hidden className="text-[18px] leading-none">{a.icon}</span>{apLabel(a.kind, a.label)}
          </button>
        ))}
      </div>
      <div ref={bench} className={`relative min-h-[220px] flex-1 touch-none select-none overflow-hidden rounded-xl ${bare ? "" : "border border-[var(--line)]"}`} data-testid="apparatus-surface"
        style={bare ? undefined : { background: "linear-gradient(var(--panel), var(--surface))", backgroundImage: "linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)", backgroundSize: "28px 28px" }}
        onPointerDown={(e) => { if (e.target === e.currentTarget) { set({ sel: null }); setEditing(false); } }}>
        {v.items.length === 0 && <p data-tool-chrome className="m-0 p-4 text-[13px] font-semibold text-[var(--ink-3)]">{t("hublive.dBenchHint")}</p>}
        {v.items.map((it) => (
          <div key={it.id} role="button" tabIndex={0} aria-label={it.name ? t("hublive.dItemAriaNamed", { item: apLabel(it.kind, it.label), name: it.name }) : t("hublive.dItemAria", { item: apLabel(it.kind, it.label) })} aria-pressed={it.id === v.sel} data-testid={`apparatus-item-${it.kind}`}
            onPointerDown={(e) => down(e, it)} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
            onKeyDown={(e) => { const s = 0.02; if (e.key === "ArrowLeft") patch(it.id, { x: Math.max(0.02, it.x - s) }); else if (e.key === "ArrowRight") patch(it.id, { x: Math.min(0.98, it.x + s) }); else if (e.key === "ArrowUp") patch(it.id, { y: Math.max(0.04, it.y - s) }); else if (e.key === "ArrowDown") patch(it.id, { y: Math.min(0.96, it.y + s) }); else if (e.key === "Delete" || e.key === "Backspace") set({ items: v.items.filter((x) => x.id !== it.id), sel: null }); else return; e.preventDefault(); }}
            className={`absolute cursor-grab text-center outline-none ${it.id === v.sel ? "rounded-lg ring-2 ring-[var(--brand)]" : ""} ${FOCUS}`}
            style={{ left: `${it.x * 100}%`, top: `${it.y * 100}%`, transform: `translate(-50%,-50%) rotate(${it.rot}deg) scaleX(${it.flip ? -1 : 1})`, fontSize: it.size, lineHeight: 1, padding: 4, touchAction: "none" }}>
            {it.kind === "text" ? <span style={{ fontSize: it.size * 0.6, fontWeight: 800, color: "var(--ink)", whiteSpace: "nowrap", transform: it.flip ? "scaleX(-1)" : undefined, display: "inline-block" }}>{it.name || t("hublive.dLabelDefault")}</span> : <span aria-hidden>{it.icon}</span>}
            {it.kind !== "text" && it.name && <span style={{ display: "block", fontSize: 12, fontWeight: 800, color: "var(--ink)", transform: `scaleX(${it.flip ? -1 : 1}) rotate(${-it.rot}deg)`, whiteSpace: "nowrap" }}>{it.name}</span>}
          </div>
        ))}
      </div>
      <div className="flex flex-none flex-wrap items-center gap-1.5" role="toolbar" aria-label={t("hublive.dSelectedItem")} data-tool-strip>
        <button type="button" className={btn} disabled={!sel} onClick={() => sel && patch(sel.id, { size: Math.min(MAX, sel.size + STEP) })} data-testid="apparatus-bigger">{t("hublive.dBigger")}</button>
        <button type="button" className={btn} disabled={!sel} onClick={() => sel && patch(sel.id, { size: Math.max(MIN, sel.size - STEP) })} data-testid="apparatus-smaller">{t("hublive.dSmaller")}</button>
        <button type="button" className={btn} disabled={!sel} onClick={() => sel && patch(sel.id, { rot: (sel.rot + 45) % 360 })} data-testid="apparatus-turn">{t("hublive.dTurnBtn")}</button>
        <button type="button" className={btn} disabled={!sel} onClick={() => sel && patch(sel.id, { flip: !sel.flip })} data-testid="apparatus-flip">{t("hublive.dFlip")}</button>
        <input value={sel?.name ?? ""} disabled={!sel} onChange={(e) => sel && patch(sel.id, { name: e.target.value.slice(0, 24) })} placeholder={sel?.kind === "text" ? t("hublive.dTypeLabel") : t("hublive.dNameOptional")} aria-label={t("hublive.dNameAria")} data-testid="apparatus-name" autoFocus={editing} data-tool-chrome={sel?.kind === "text" ? undefined : ""}
          className={`min-h-[40px] w-40 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 text-[13px] font-semibold text-[var(--ink)] disabled:opacity-40 ${FOCUS}`} />
        <button type="button" className={btn} disabled={!sel} onClick={() => sel && set({ items: v.items.filter((i) => i.id !== sel.id), sel: null })} data-testid="apparatus-remove">{t("hublive.dRemove")}</button>
        <button type="button" className={btn} disabled={!v.items.length} onClick={() => set({ items: [], sel: null })} data-testid="apparatus-clear">{t("hublive.dClearBench")}</button>
      </div>
    </div>
  );
}
