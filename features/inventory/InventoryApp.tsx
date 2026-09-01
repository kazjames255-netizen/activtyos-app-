"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { api, get as apiGet, post as apiPost, put as apiPut } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useSettings } from "@/lib/settings";
import { Badge, Button, Card } from "@/components/ui";

// ─────────────────────────────────────────────────────────────────────────
// Inventory — the operator's kit & stock check: what they hold, where it's
// stored, how many, which season, and when it was last counted. A stock-check
// updates the count and auto-stamps the time; a season's items can be carried
// over to the next. Backed by /api/inventory; categories/locations/seasons
// live in tenant settings.
// ─────────────────────────────────────────────────────────────────────────

interface Check { quantity: number; at: string; by?: string }
interface Item { id: string; name: string; category?: string; location?: string; quantity: number; unit?: string; minQty?: number; season?: string; notes?: string; lastCheckedAt?: string | null; lastCheckedBy?: string | null; checks?: Check[]; createdByName?: string; carriedFrom?: string; ordered?: boolean; orderQty?: number; orderCost?: number; orderCategory?: string; orderSupplier?: string; orderStatus?: "pending" | "paid"; orderedAt?: string }

// Kept in step with the Expenses page so a reorder logs under the same category.
const EXPENSE_CATEGORIES = ["Equipment", "Supplies", "Venue hire", "Staff", "Travel", "Marketing", "Insurance", "Training", "Software", "Utilities", "Other"];
const money = (n?: number) => `£${(n ?? 0).toFixed(2)}`;
// a stable colour per category name, for the group headings
const CAT_PALETTE = ["#6d28d9", "#0369a1", "#be1259", "#047857", "#b45309", "#c2410c", "#4338ca", "#0e7490", "#b91c1c", "#7c3aed"];
const catColor = (name: string) => { let h = 0; for (let k = 0; k < name.length; k++) h = (h * 31 + name.charCodeAt(k)) >>> 0; return CAT_PALETTE[h % CAT_PALETTE.length]; };

const LIGHT_PALETTE = { "--bg": "#f5f8fd", "--surface": "#ffffff", "--panel": "#fbf8fc", "--ink": "#171534", "--ink-2": "#4a4763", "--ink-3": "#8a86a3", "--line": "#ece6f1" } as CSSProperties;
const HERO = "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 100%)";
const BLUE = "#1d3a8f", GREEN = "#0f7a43", AMBER = "#9a5a00", RED = "#c02636";
const inputCls = "rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12.5px] text-[var(--ink)] outline-none focus:border-[#1d3a8f]";
const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");
const fmtStamp = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");
const dayssince = (iso?: string | null) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : Infinity);
const lowStock = (i: Item) => i.minQty != null && i.quantity <= i.minQty;

export function InventoryApp() {
  const { settings, save } = useSettings();
  const inv = settings.inventory ?? {};
  const categories = useMemo(() => inv.categories ?? [], [inv.categories]);
  const locations = useMemo(() => inv.locations ?? [], [inv.locations]);
  const seasons = useMemo(() => (inv.seasons?.length ? inv.seasons : ["This season"]), [inv.seasons]);
  const STALE_DAYS = inv.checkEveryDays ?? 30;

  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [season, setSeason] = useState<string>("");
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [locFilter, setLocFilter] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [uncheckedOnly, setUncheckedOnly] = useState(false);
  const [checkMode, setCheckMode] = useState(false);
  const [checkVals, setCheckVals] = useState<Record<string, string>>({});
  const [histId, setHistId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Item | null>(null);
  const [adding, setAdding] = useState(false);
  const [carry, setCarry] = useState(false);
  const [ordering, setOrdering] = useState<Item | null>(null);
  const [canManage, setCanManage] = useState(false);

  const refresh = useCallback(() => { apiGet<Item[]>("/api/inventory").then((l) => { setItems(l); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load")); }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { apiGet<{ role: string }>("/api/me").then((m) => setCanManage(["company", "freelancer", "franchise"].includes(m.role))).catch(() => {}); }, []);
  useRealtime(["inventory"], refresh);

  const all = useMemo(() => items ?? [], [items]);
  // the effective season: user pick, else the tenant's current, else the first
  const sel = season || inv.currentSeason || seasons[0] || "";
  const seasonItems = useMemo(() => all.filter((i) => (sel ? (i.season ?? "") === sel : true)), [all, sel]);
  const ql = q.trim().toLowerCase();
  const shown = useMemo(() => seasonItems.filter((i) =>
    (!ql || `${i.name} ${i.category ?? ""} ${i.location ?? ""} ${i.notes ?? ""}`.toLowerCase().includes(ql)) &&
    (!catFilter || (i.category ?? "") === catFilter) && (!locFilter || (i.location ?? "") === locFilter) &&
    (!lowOnly || lowStock(i)) && (!uncheckedOnly || dayssince(i.lastCheckedAt) >= STALE_DAYS)
  ), [seasonItems, ql, catFilter, locFilter, lowOnly, uncheckedOnly, STALE_DAYS]);

  // group shown items by category
  const groups = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const i of [...shown].sort((a, b) => (a.name < b.name ? -1 : 1))) { const k = i.category || "Uncategorised"; (m.get(k) ?? m.set(k, []).get(k)!).push(i); }
    return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  }, [shown]);

  const low = seasonItems.filter(lowStock).length;
  const toCheck = seasonItems.filter((i) => dayssince(i.lastCheckedAt) >= STALE_DAYS).length;
  const cats = new Set(seasonItems.map((i) => i.category || "Uncategorised")).size;
  const tiles: [string, number | string][] = [["Items", seasonItems.length], ["Categories", cats], ["Low stock", low], ["To check", toCheck]];

  async function remove(i: Item) { if (!confirm(`Delete “${i.name}”?`)) return; try { await api(`/api/inventory/${encodeURIComponent(i.id)}`, { method: "DELETE" }); refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } }
  async function doCheck(i: Item, qty: number) { try { await apiPost(`/api/inventory/${encodeURIComponent(i.id)}/check`, { quantity: qty }); setCheckVals((v) => { const n = { ...v }; delete n[i.id]; return n; }); refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } }
  async function markReceived(i: Item) { if (!confirm(`Mark ${i.orderQty ?? 0} ${i.name} as received? They'll be added to stock.`)) return; try { await apiPost(`/api/inventory/${encodeURIComponent(i.id)}/received`, {}); refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } }

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      {/* hero */}
      <div className="relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ backgroundImage: `radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1.6px), ${HERO}`, backgroundSize: "18px 18px, cover, cover, cover, cover", backgroundRepeat: "repeat, no-repeat, no-repeat, no-repeat, no-repeat" }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}><span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">📦</span>Inventory</div>
            <p className="mt-1.5 max-w-[640px] text-[12.5px] leading-[1.5] text-white/85">Your kit & stock — what you hold, where it&rsquo;s stored, how many, and when it was last counted. Run a stock check, and carry a season&rsquo;s stock over to the next.</p>
          </div>
          <button type="button" onClick={() => setAdding(true)} className="rounded-full bg-white px-4 py-2 text-[13px] font-extrabold text-[#1d3a8f] shadow-md transition-transform hover:-translate-y-px">＋ Add item</button>
        </div>
        {items && (
          <div className="mt-4 flex flex-wrap gap-2.5">{tiles.map(([label, v]) => (
            <div key={label} className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur-sm"><div className="text-[20px] font-extrabold leading-none">{v}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/80">{label}</div></div>
          ))}</div>
        )}
      </div>

      {/* how it works — top, under the title */}
      <details className="group mb-3 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)]">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-[13px] font-extrabold" style={{ color: BLUE }}><span className="text-[11px] transition-transform group-open:rotate-90">▸</span> How it works</summary>
        <div className="border-t border-[var(--line)] px-4 py-3 text-[12.5px] leading-[1.6] text-[var(--ink-2)]">
          <ul className="ml-4 list-disc space-y-1.5">
            <li><b>Add your kit</b> — each item has a category, where it&rsquo;s stored, how many, an optional reorder level and a season. Items are grouped by category (each colour-coded).</li>
            <li><b>Do a stock check</b> — <b>Start stock check</b> turns every count into an input; enter the real figure and <b>✓ Count</b> saves it and <b>auto-stamps the time + who</b>. The most-recent count sits on the card; click it to see the <b>last 5 counts</b>.</li>
            <li><b>Running low</b> — set a reorder level and an item shows <b>⚠ Low</b> when it drops to it. Anything not counted in a while is flagged <b>due a check</b> (set the window in Settings → Inventory).</li>
            <li><b>Order more → Expenses</b> — <b>🛒 Order</b> records how many, the cost and supplier, and <b>logs a matching expense</b> under the category you pick (Paid or Owed — default in Settings). <b>✓ Received</b> adds them into stock.</li>
            <li><b>Seasons</b> — pick a season up top; <b>Carry over to next season</b> copies a season&rsquo;s items (kit + counts) into a new one so you don&rsquo;t re-enter everything.</li>
            <li><b>Find things</b> — filter by category, location, <b>Low stock</b> or <b>Needs a check</b>, or search.</li>
          </ul>
        </div>
      </details>

      {error && <div className="mb-3 rounded-lg border border-[#f6c9cc] bg-[#fdebec] px-3 py-2 text-[12.5px] text-[#e21d27]">{error}</div>}
      {(adding || editing) && <ItemForm existing={editing ?? undefined} categories={categories} locations={locations} seasons={seasons} defaultSeason={sel} settings={settings} save={save} onClose={() => { setAdding(false); setEditing(null); }} onSaved={() => { setAdding(false); setEditing(null); refresh(); }} onDelete={editing && canManage ? () => remove(editing) : undefined} />}
      {carry && <CarryOverModal seasons={seasons} fromDefault={sel} settings={settings} save={save} onClose={() => setCarry(false)} onDone={(to) => { setCarry(false); setSeason(to); refresh(); }} />}
      {ordering && <OrderModal item={ordering} defaultStatus={inv.orderExpenseStatus ?? "paid"} defaultCategory={inv.orderCategory ?? "Equipment"} onClose={() => setOrdering(null)} onDone={() => { setOrdering(null); refresh(); }} />}

      {/* season bar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--ink-3)]">Season</span>
        <select value={sel} onChange={(e) => setSeason(e.target.value)} className={`${inputCls} font-bold`}>
          {seasons.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {canManage && <Button sm onClick={() => setCarry(true)}>↪ Carry over to next season…</Button>}
        <button type="button" onClick={() => setCheckMode((v) => !v)} className="rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-colors" style={checkMode ? { borderColor: GREEN, background: "#e7f6ee", color: GREEN } : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-2)" }}>{checkMode ? "✓ Stock-check mode on" : "🔢 Start stock check"}</button>
      </div>

      {/* filters */}
      {items && all.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className={inputCls}><option value="">All categories</option>{[...new Set(seasonItems.map((i) => i.category || "Uncategorised"))].sort().map((c) => <option key={c} value={c === "Uncategorised" ? "" : c}>{c}</option>)}</select>
          <select value={locFilter} onChange={(e) => setLocFilter(e.target.value)} className={inputCls}><option value="">All locations</option>{[...new Set(seasonItems.map((i) => i.location).filter(Boolean))].sort().map((l) => <option key={l} value={l!}>{l}</option>)}</select>
          <button type="button" onClick={() => setLowOnly((v) => !v)} className="rounded-full border px-3 py-1 text-[11.5px] font-bold" style={lowOnly ? { borderColor: RED, background: "#fdebec", color: RED } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>{lowOnly ? "✓ " : ""}Low stock</button>
          <button type="button" onClick={() => setUncheckedOnly((v) => !v)} className="rounded-full border px-3 py-1 text-[11.5px] font-bold" style={uncheckedOnly ? { borderColor: AMBER, background: "#fdf3d8", color: AMBER } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>{uncheckedOnly ? "✓ " : ""}Needs a check</button>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items…" className="ml-auto w-56 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 py-1.5 text-[12.5px] outline-none focus:border-[#1d3a8f]" />
        </div>
      )}

      {!items ? <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
        : shown.length === 0 ? <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">{all.length === 0 ? "No stock recorded yet — add your first item." : seasonItems.length === 0 ? `Nothing in “${sel}” yet — add items, or carry over from a previous season.` : "No items match your filters."}</Card>
        : (
          <div className="flex flex-col gap-4">
            {groups.map(([cat, list]) => (
              <div key={cat}>
                <div className="mb-1.5 flex items-center gap-2"><span className="h-3.5 w-[5px] rounded-full" style={{ background: catColor(cat) }} /><span className="text-[13px] font-extrabold" style={{ fontFamily: "var(--ff-display)", color: catColor(cat) }}>{cat}</span><span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: `color-mix(in srgb,${catColor(cat)} 14%,var(--surface))`, color: catColor(cat) }}>{list.length}</span></div>
                <div className="flex flex-col gap-2">
                  {list.map((i) => {
                    const stale = dayssince(i.lastCheckedAt) >= STALE_DAYS, checking = checkMode;
                    const val = checkVals[i.id] ?? String(i.quantity);
                    const nChecks = i.checks?.length ?? 0, histOpen = histId === i.id || checking;
                    return (
                      <Card key={i.id} className="p-2.5">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                          <div className="min-w-[150px] flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[13.5px] font-extrabold">{i.name}</span>
                              {i.location && <Badge tone={{ bg: "#eef4fd", fg: BLUE }}>📍 {i.location}</Badge>}
                              {lowStock(i) && <Badge tone={{ bg: "#fdebec", fg: RED }}>⚠ Low</Badge>}
                              {i.ordered && <Badge tone={{ bg: "#fdf3d8", fg: AMBER }}>🛒 On order · {i.orderQty} · {money(i.orderCost)}{i.orderStatus === "pending" ? " (owed)" : " (paid)"}</Badge>}
                              {i.carriedFrom && <Badge tone={{ bg: "var(--panel)", fg: "var(--ink-3)" }}>↪ {i.carriedFrom}</Badge>}
                            </div>
                            {i.notes && <div className="mt-0.5 truncate text-[11px] text-[var(--ink-3)]">{i.notes}</div>}
                          </div>
                          {checking ? (
                            <div className="flex items-center gap-1.5">
                              <input type="number" min={0} value={val} onChange={(e) => setCheckVals((v) => ({ ...v, [i.id]: e.target.value }))} className="w-20 rounded-md border border-[var(--line)] px-2 py-1 text-center text-[13px] font-extrabold" />
                              {i.unit && <span className="text-[11.5px] text-[var(--ink-3)]">{i.unit}</span>}
                              <Button sm variant="solid" onClick={() => doCheck(i, Math.max(0, parseInt(val, 10) || 0))}>✓ Count</Button>
                            </div>
                          ) : (
                            // most recent count, inline in the header — click to see the last 5
                            <button type="button" onClick={() => nChecks && setHistId(histId === i.id ? null : i.id)} className="text-right" title={nChecks ? "Count history" : undefined}>
                              <div className="text-[17px] font-extrabold leading-none tabular-nums" style={{ color: lowStock(i) ? RED : "var(--ink)" }}>{i.quantity}{i.unit ? <span className="text-[11px] font-semibold text-[var(--ink-3)]"> {i.unit}</span> : ""}</div>
                              <div className="mt-0.5 text-[10px]" style={stale || !i.lastCheckedAt ? { color: AMBER, fontWeight: 700 } : { color: "var(--ink-3)" }}>{i.lastCheckedAt ? `✓ ${fmtDate(i.lastCheckedAt)}${i.lastCheckedBy ? ` · ${i.lastCheckedBy.split(" ")[0]}` : ""}${stale ? " · due" : ""}` : "never checked"}{i.minQty != null ? ` · min ${i.minQty}` : ""}{nChecks > 0 ? (histOpen ? " ▴" : " ▾") : ""}</div>
                            </button>
                          )}
                          <div className="flex flex-wrap gap-1.5">
                            {!checking && <Button sm onClick={() => { setCheckVals((v) => ({ ...v, [i.id]: String(i.quantity) })); setHistId(i.id); setCheckMode(true); }}>Check</Button>}
                            {canManage && (i.ordered ? <Button sm variant="solid" onClick={() => markReceived(i)}>✓ Received</Button> : <Button sm onClick={() => setOrdering(i)}>🛒 Order</Button>)}
                            <Button sm onClick={() => { setEditing(i); setAdding(false); }}>Edit</Button>
                            {canManage && <Button sm variant="danger" onClick={() => remove(i)}>Delete</Button>}
                          </div>
                        </div>
                        {histOpen && nChecks > 0 && (
                          <div className="mt-2 flex items-center gap-2 overflow-x-auto border-t border-[var(--line)] pt-2 [scrollbar-width:thin]">
                            <span className="flex-none text-[10px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">Last 5:</span>
                            {(i.checks ?? []).slice(0, 5).map((c, idx) => (
                              <div key={idx} className="flex flex-none items-center gap-1.5 rounded-lg border px-2 py-1" style={idx === 0 ? { borderColor: GREEN, background: "#e7f6ee" } : { borderColor: "var(--line)", background: "var(--panel)" }}>
                                <span className="text-[13px] font-extrabold tabular-nums" style={{ color: idx === 0 ? GREEN : "var(--ink)" }}>{c.quantity}</span>
                                <span className="text-[10px] text-[var(--ink-3)]">{fmtStamp(c.at)}{c.by ? ` · ${c.by.split(" ")[0]}` : ""}</span>
                                {idx === 0 && <span className="rounded-full px-1.5 py-0.5 text-[8.5px] font-extrabold uppercase text-white" style={{ background: GREEN }}>latest</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

// ── Add / edit item ─────────────────────────────────────────────────────────
type SettingsShape = ReturnType<typeof useSettings>["settings"];
type SaveFn = ReturnType<typeof useSettings>["save"];
function ItemForm({ existing, categories, locations, seasons, defaultSeason, settings, save, onClose, onSaved, onDelete }: { existing?: Item; categories: string[]; locations: string[]; seasons: string[]; defaultSeason: string; settings: SettingsShape; save: SaveFn; onClose: () => void; onSaved: () => void; onDelete?: () => void }) {
  const isEdit = !!existing;
  const [name, setName] = useState(existing?.name ?? "");
  const [category, setCategory] = useState(existing?.category ?? (categories[0] ?? ""));
  const [location, setLocation] = useState(existing?.location ?? (locations[0] ?? ""));
  const [quantity, setQuantity] = useState(String(existing?.quantity ?? 0));
  const [unit, setUnit] = useState(existing?.unit ?? "");
  const [minQty, setMinQty] = useState(existing?.minQty != null ? String(existing.minQty) : "");
  const [season, setSeason] = useState(existing?.season ?? defaultSeason ?? seasons[0] ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // add-a-new helpers persist the option to settings so it's reusable
  async function addOption(key: "categories" | "locations" | "seasons", value: string, setLocal: (v: string) => void) {
    const v = value.trim(); if (!v) return;
    const cur = settings.inventory?.[key] ?? [];
    if (!cur.includes(v)) await save({ settings: { ...settings, inventory: { ...settings.inventory, [key]: [...cur, v] } } });
    setLocal(v);
  }
  const promptAdd = (key: "categories" | "locations" | "seasons", label: string, setLocal: (v: string) => void) => { const v = window.prompt(`New ${label}`); if (v) addOption(key, v, setLocal); };

  async function submit() {
    if (!name.trim()) { setError("Give the item a name."); return; }
    setBusy(true); setError(null);
    const body = { name: name.trim(), category: category || undefined, location: location || undefined, quantity: Math.max(0, parseInt(quantity, 10) || 0), unit: unit.trim() || undefined, minQty: minQty.trim() === "" ? undefined : Math.max(0, parseInt(minQty, 10) || 0), season: season || undefined, notes: notes.trim() || undefined };
    try { if (isEdit) await apiPut(`/api/inventory/${encodeURIComponent(existing!.id)}`, body); else await apiPost("/api/inventory", body); onSaved(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t save"); setBusy(false); }
  }
  const lbl = (s: string) => <span className="text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">{s}</span>;
  const selectAdd = (key: "categories" | "locations" | "seasons", label: string, opts: string[], val: string, setVal: (v: string) => void) => (
    <div className="flex gap-1.5"><select value={val} onChange={(e) => setVal(e.target.value)} className={`${inputCls} flex-1`}><option value="">— none —</option>{opts.map((o) => <option key={o} value={o}>{o}</option>)}</select><button type="button" onClick={() => promptAdd(key, label, setVal)} className="rounded-md border border-[var(--line)] px-2 text-[11px] font-bold text-[#1d3a8f]">＋</button></div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4" onClick={onClose}>
      <div className="mt-[5vh] w-full max-w-[480px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between"><div className="text-[15px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{isEdit ? "Edit item" : "Add item"}</div><button type="button" onClick={onClose} className="text-[var(--ink-3)] hover:text-[var(--ink)]">✕</button></div>
        <div className="flex flex-col gap-2.5">
          <label className="flex flex-col gap-1">{lbl("Item")}<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Footballs (size 4)" className={`${inputCls} w-full`} /></label>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">{lbl("Category")}{selectAdd("categories", "category", categories, category, setCategory)}</div>
            <div className="flex flex-col gap-1">{lbl("Stored at")}{selectAdd("locations", "location", locations, location, setLocation)}</div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <label className="flex flex-col gap-1">{lbl("How many")}<input type="number" min={0} value={quantity} onChange={(e) => setQuantity(e.target.value)} className={`${inputCls} w-full`} /></label>
            <label className="flex flex-col gap-1">{lbl("Unit")}<input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="e.g. box" className={`${inputCls} w-full`} /></label>
            <label className="flex flex-col gap-1">{lbl("Reorder at")}<input type="number" min={0} value={minQty} onChange={(e) => setMinQty(e.target.value)} placeholder="min" className={`${inputCls} w-full`} /></label>
          </div>
          <div className="flex flex-col gap-1">{lbl("Season")}{selectAdd("seasons", "season", seasons, season, setSeason)}</div>
          <label className="flex flex-col gap-1">{lbl("Notes (optional)")}<textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Condition, supplier, anything to remember…" className={`${inputCls} w-full resize-y leading-[1.5] [field-sizing:content]`} /></label>
        </div>
        {error && <div className="mt-2.5 text-[12px] font-bold text-[var(--red,#e21d27)]">{error}</div>}
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--line)] pt-3">
          {onDelete ? <button type="button" onClick={onDelete} className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[12px] font-bold" style={{ color: RED }}>Delete</button> : <span />}
          <div className="flex gap-2"><button type="button" onClick={onClose} className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)]">Cancel</button><button type="button" disabled={busy} onClick={submit} className="rounded-lg bg-[#1d3a8f] px-4 py-1.5 text-[12px] font-extrabold text-white disabled:opacity-60">{busy ? "Saving…" : "Save item"}</button></div>
        </div>
      </div>
    </div>
  );
}

// ── Order more ───────────────────────────────────────────────────────────────
function OrderModal({ item, defaultStatus, defaultCategory, onClose, onDone }: { item: Item; defaultStatus: "paid" | "pending"; defaultCategory: string; onClose: () => void; onDone: () => void }) {
  const suggested = item.minQty != null ? Math.max(1, (item.minQty * 2) - item.quantity) : 1;
  const [quantity, setQuantity] = useState(String(suggested > 0 ? suggested : 1));
  const [cost, setCost] = useState("");
  const [supplier, setSupplier] = useState(item.orderSupplier ?? "");
  const [category, setCategory] = useState(EXPENSE_CATEGORIES.includes(item.orderCategory ?? "") ? item.orderCategory! : (EXPENSE_CATEGORIES.includes(defaultCategory) ? defaultCategory : "Equipment"));
  const [status, setStatus] = useState<"pending" | "paid">(defaultStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lbl = (s: string) => <span className="text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">{s}</span>;

  async function submit() {
    const qty = Math.max(0, parseInt(quantity, 10) || 0), amt = Math.max(0, parseFloat(cost) || 0);
    if (!qty) { setError("How many are you ordering?"); return; }
    setBusy(true); setError(null);
    try { await apiPost(`/api/inventory/${encodeURIComponent(item.id)}/order`, { quantity: qty, cost: amt, category, supplier: supplier.trim() || undefined, status }); onDone(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn’t place order"); setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4" onClick={onClose}>
      <div className="mt-[7vh] w-full max-w-[420px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 text-[15px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Order more — {item.name}</div>
        <p className="mb-3 text-[12px] text-[var(--ink-2)]">Records the order on this item and logs it to <b>Expenses</b> under the category you pick.</p>
        <div className="flex flex-col gap-2.5">
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">{lbl("How many")}<input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} className={`${inputCls} w-full`} /></label>
            <label className="flex flex-col gap-1">{lbl("Total cost (£)")}<input type="number" min={0} step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0.00" className={`${inputCls} w-full`} /></label>
          </div>
          <label className="flex flex-col gap-1">{lbl("Supplier (optional)")}<input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Who from" className={`${inputCls} w-full`} /></label>
          <label className="flex flex-col gap-1">{lbl("Expense category")}<select value={category} onChange={(e) => setCategory(e.target.value)} className={`${inputCls} w-full`}>{EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
          <div>{lbl("Payment")}<div className="mt-1 flex gap-1.5">{(["pending", "paid"] as const).map((s) => <button key={s} type="button" onClick={() => setStatus(s)} className="rounded-full border-2 px-3 py-1 text-[12px] font-bold" style={status === s ? { borderColor: BLUE, background: "#eef4fd", color: BLUE } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>{s === "pending" ? "Owed (unpaid)" : "Already paid"}</button>)}</div></div>
        </div>
        {error && <div className="mt-2.5 text-[12px] font-bold text-[var(--red,#e21d27)]">{error}</div>}
        <div className="mt-4 flex justify-end gap-2 border-t border-[var(--line)] pt-3"><button type="button" onClick={onClose} className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)]">Cancel</button><button type="button" disabled={busy} onClick={submit} className="rounded-lg bg-[#1d3a8f] px-4 py-1.5 text-[12px] font-extrabold text-white disabled:opacity-60">{busy ? "Ordering…" : "Place order → Expenses"}</button></div>
      </div>
    </div>
  );
}

// ── Carry over ───────────────────────────────────────────────────────────────
function CarryOverModal({ seasons, fromDefault, settings, save, onClose, onDone }: { seasons: string[]; fromDefault: string; settings: SettingsShape; save: SaveFn; onClose: () => void; onDone: (to: string) => void }) {
  const [from, setFrom] = useState(fromDefault || seasons[0] || "");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<number | null>(null);

  async function run() {
    const target = to.trim(); if (!from || !target) { setError("Pick a season to copy from and name the new one."); return; }
    setBusy(true); setError(null);
    try {
      const r = await apiPost<{ copied: number }>("/api/inventory/carry-over", { fromSeason: from, toSeason: target });
      // make sure the new season is saved + selectable, and becomes current
      const cur = settings.inventory?.seasons ?? [];
      if (!cur.includes(target)) await save({ settings: { ...settings, inventory: { ...settings.inventory, seasons: [...cur, target], currentSeason: target } } });
      else await save({ settings: { ...settings, inventory: { ...settings.inventory, currentSeason: target } } });
      setResult(r.copied);
      setTimeout(() => onDone(target), 900);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t carry over"); setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4" onClick={onClose}>
      <div className="mt-[8vh] w-full max-w-[420px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 text-[15px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Carry over to next season</div>
        <p className="mb-3 text-[12px] text-[var(--ink-2)]">Copies every item (kit + current counts) from one season into a new one, so you don&rsquo;t re-enter everything. The new season starts unchecked.</p>
        <div className="flex flex-col gap-2.5">
          <label className="flex flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">Copy from</span><select value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputCls} w-full`}>{seasons.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
          <label className="flex flex-col gap-1"><span className="text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--ink-3)]">Into season — pick one or type a new name</span><input list="carry-into-seasons" value={to} onChange={(e) => setTo(e.target.value)} placeholder="e.g. Summer 2027" className={`${inputCls} w-full`} /><datalist id="carry-into-seasons">{seasons.filter((s) => s !== from).map((s) => <option key={s} value={s} />)}</datalist></label>
        </div>
        {error && <div className="mt-2.5 text-[12px] font-bold text-[var(--red,#e21d27)]">{error}</div>}
        {result != null && <div className="mt-2.5 rounded-lg bg-[#e7f6ee] px-3 py-2 text-[12px] font-bold" style={{ color: GREEN }}>✓ Carried over {result} item{result === 1 ? "" : "s"} into “{to}”.</div>}
        <div className="mt-4 flex justify-end gap-2 border-t border-[var(--line)] pt-3"><button type="button" onClick={onClose} className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)]">Close</button><button type="button" disabled={busy} onClick={run} className="rounded-lg bg-[#1d3a8f] px-4 py-1.5 text-[12px] font-extrabold text-white disabled:opacity-60">{busy ? "Working…" : "Carry over"}</button></div>
      </div>
    </div>
  );
}
