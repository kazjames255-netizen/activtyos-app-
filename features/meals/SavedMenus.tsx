"use client";

import { useCallback, useEffect, useState } from "react";
import { api, get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { money } from "@/features/bookings/helpers";
import { Badge, Button, Card, FieldLabel, Input } from "@/components/ui";
import { UK_ALLERGENS } from "./allergens";

// ─────────────────────────────────────────────────────────────────────────
// Saved-menu library (Phase 1 of the meal planner). A menu is a reusable,
// named set of meal items — build once here, then (Phase 2) drag it onto a
// listing's days. Meat and veg are just separate items on the same menu.
// ─────────────────────────────────────────────────────────────────────────

export interface MenuItem { id: string; name: string; price: number; allergens: string[]; description?: string }
export interface SavedMenu { id: string; name: string; items: MenuItem[] }

const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.round(Math.random() * 1e6)}`);
const blankItem = (): MenuItem => ({ id: uid(), name: "", price: 0, allergens: [], description: "" });

function MenuEditor({ initial, onSave, onCancel }: { initial: SavedMenu; onSave: (m: { name: string; items: MenuItem[] }) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState(initial.name);
  const [items, setItems] = useState<MenuItem[]>(initial.items.length ? initial.items : [blankItem()]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const upd = (id: string, patch: Partial<MenuItem>) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const toggleAllergen = (id: string, a: string) =>
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, allergens: x.allergens.includes(a) ? x.allergens.filter((y) => y !== a) : [...x.allergens, a] } : x)));

  async function save() {
    const clean = items.map((i) => ({ ...i, name: i.name.trim() })).filter((i) => i.name);
    if (!name.trim()) { setErr("Give the menu a name."); return; }
    if (clean.length === 0) { setErr("Add at least one meal."); return; }
    setBusy(true); setErr(null);
    try { await onSave({ name: name.trim(), items: clean.map((i) => ({ ...i, price: Number(i.price) || 0 })) }); }
    catch (e) { setErr(e instanceof Error ? e.message : "Couldn’t save"); setBusy(false); }
  }

  return (
    <Card className="mb-2.5 border-l-[3px] border-l-[#2f6bd8] p-3.5">
      {err && <div className="mb-2.5 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{err}</div>}
      <div className="mb-3"><FieldLabel>Menu name</FieldLabel><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Summer week A" className="w-full max-w-[320px]" /></div>
      <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">Meals on this menu</div>
      <div className="flex flex-col gap-2">
        {items.map((it) => (
          <div key={it.id} className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-2.5">
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[160px] flex-1"><FieldLabel>Meal</FieldLabel><Input value={it.name} onChange={(e) => upd(it.id, { name: e.target.value })} placeholder="Hot lunch — chicken" className="w-full" /></div>
              <div className="w-[92px]"><FieldLabel>Price (£)</FieldLabel><Input type="number" min="0" step="0.01" value={it.price} onChange={(e) => upd(it.id, { price: Number(e.target.value) })} className="w-full" /></div>
              <button type="button" onClick={() => setItems((xs) => (xs.length > 1 ? xs.filter((x) => x.id !== it.id) : xs))} className="pb-1.5 text-[var(--ink-3)] hover:text-[var(--red)]" aria-label="Remove meal">×</button>
            </div>
            <div className="mt-2"><Input value={it.description ?? ""} onChange={(e) => upd(it.id, { description: e.target.value })} placeholder="Description (optional) — e.g. served with salad" className="w-full" /></div>
            <div className="mt-2">
              <span className="mr-1.5 text-[10px] font-bold uppercase tracking-[0.05em] text-[var(--ink-3)]">Contains</span>
              {UK_ALLERGENS.map((a) => (
                <button key={a} type="button" onClick={() => toggleAllergen(it.id, a)}
                  className="m-0.5 rounded-full border px-2 py-[1px] text-[10.5px] font-bold capitalize transition-colors"
                  style={it.allergens.includes(a) ? { borderColor: "transparent", background: "var(--red,#e21d27)", color: "#fff" } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>
                  {a}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => setItems((xs) => [...xs, blankItem()])} className="mt-2 self-start text-[12px] font-bold text-[var(--brand-2,#2f6bd8)] underline">+ Add another meal</button>
      <div className="mt-3 flex gap-2"><Button variant="primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save menu"}</Button><Button disabled={busy} onClick={onCancel}>Cancel</Button></div>
    </Card>
  );
}

export function SavedMenus() {
  const [menus, setMenus] = useState<SavedMenu[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null); // menu id, or "new"

  const refresh = useCallback(() => {
    apiGet<SavedMenu[]>("/api/meal-menus").then(setMenus).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtime(["mealMenus"], refresh);

  async function create(body: { name: string; items: MenuItem[] }) { await api("/api/meal-menus", { method: "POST", body: JSON.stringify(body) }); setEditing(null); refresh(); }
  async function update(id: string, body: { name: string; items: MenuItem[] }) { await api(`/api/meal-menus/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(body) }); setEditing(null); refresh(); }
  async function duplicate(m: SavedMenu) { try { await api("/api/meal-menus", { method: "POST", body: JSON.stringify({ name: `${m.name} (copy)`, items: m.items.map((i) => ({ ...i, id: uid() })) }) }); refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } }
  async function remove(m: SavedMenu) { if (!confirm(`Delete the “${m.name}” menu?`)) return; try { await api(`/api/meal-menus/${encodeURIComponent(m.id)}`, { method: "DELETE" }); refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } }

  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[12px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">Saved menus</div>
        {editing !== "new" && <Button sm variant="primary" onClick={() => setEditing("new")}>＋ New menu</Button>}
      </div>
      <p className="mb-2.5 text-[11.5px] text-[var(--ink-3)]">Build a menu once — a set of meals with prices and allergens — then reuse it across your listings’ days.</p>
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}

      {editing === "new" && <MenuEditor initial={{ id: "", name: "", items: [] }} onSave={create} onCancel={() => setEditing(null)} />}

      {!menus ? <div className="py-6 text-center text-[12px] text-[var(--ink-3)]">Loading…</div>
      : menus.length === 0 && editing !== "new" ? <Card className="p-5 text-center text-[12.5px] text-[var(--ink-3)]">No saved menus yet — create your first above.</Card>
      : (
        <div className="flex flex-col gap-1.5">
          {menus.map((m) => editing === m.id ? (
            <MenuEditor key={m.id} initial={m} onSave={(b) => update(m.id, b)} onCancel={() => setEditing(null)} />
          ) : (
            <Card key={m.id} className="p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13.5px] font-extrabold">{m.name}</span>
                <Badge tone={{ bg: "#eaf0fc", fg: "#1d3a8f" }}>{m.items.length} meal{m.items.length === 1 ? "" : "s"}</Badge>
                <div className="ml-auto flex gap-1.5">
                  <Button sm onClick={() => setEditing(m.id)}>Edit</Button>
                  <Button sm onClick={() => duplicate(m)}>Duplicate</Button>
                  <Button sm variant="danger" onClick={() => remove(m)}>Delete</Button>
                </div>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {m.items.map((it) => (
                  <span key={it.id} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2 py-1 text-[11.5px]">
                    <b>{it.name}</b>
                    <span className="tabular-nums text-[var(--ink-2)]">{money(it.price)}</span>
                    {it.allergens.length > 0 && <span className="capitalize text-[var(--red,#e21d27)]">⚠ {it.allergens.join(", ")}</span>}
                  </span>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
