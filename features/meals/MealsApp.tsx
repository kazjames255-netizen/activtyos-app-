"use client";

import { useCallback, useEffect, useState } from "react";
import { api, get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Badge, Button, Card, Input } from "@/components/ui";
import { OperatorPage } from "@/components/OperatorPage";
import { MealShopApp } from "./MealShopApp";

// ─────────────────────────────────────────────────────────────────────────
// Meals & allergies — the day's menu (with UK-allergen tags) and the dietary
// board: every child present with their allergies/dietary needs, and an
// alert wherever a child's allergy matches something on the menu. Operators
// set the menu; staff read the board at mealtime. Simple by design.
// ─────────────────────────────────────────────────────────────────────────

interface Meal { id: string; type: string; description: string; allergens: string[] }
interface BoardChild { ref: string; name: string; allergies: string; dietary: string; medical: string; alerts: string[] }
interface Session { blockId: string; listingName: string; blockName: string; start: string; end: string; children: BoardChild[] }
interface Board {
  date: string;
  menu: Meal[];
  allergens: string[];
  sessions: Session[];
  summary: { children: number; withNeeds: number; alerts: number };
}

const todayIso = () => {
  const t = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
};
const shiftDay = (iso: string, by: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + by); return d.toISOString().slice(0, 10); };
const dayLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
const MEAL_TYPES = ["Breakfast", "Morning snack", "Lunch", "Afternoon snack", "Tea"];

function MenuEditor({ date, menu, allergens, onSaved }: { date: string; menu: Meal[]; allergens: string[]; onSaved: () => void }) {
  const [meals, setMeals] = useState<Meal[]>(menu);
  const [busy, setBusy] = useState(false);
  const upd = (id: string, patch: Partial<Meal>) => setMeals((m) => m.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const toggleAllergen = (id: string, a: string) =>
    setMeals((m) => m.map((x) => (x.id === id ? { ...x, allergens: x.allergens.includes(a) ? x.allergens.filter((y) => y !== a) : [...x.allergens, a] } : x)));

  async function save() {
    setBusy(true);
    try { await api(`/api/meals/${date}`, { method: "PUT", body: JSON.stringify({ meals }) }); onSaved(); }
    finally { setBusy(false); }
  }
  return (
    <Card className="mb-3.5 p-4">
      <div className="mb-2 text-[13.5px] font-extrabold">Today’s menu</div>
      <div className="flex flex-col gap-3">
        {meals.map((m) => (
          <div key={m.id} className="rounded-xl border border-[var(--line)] p-2.5">
            <div className="flex gap-2">
              <select value={m.type} onChange={(e) => upd(m.id, { type: e.target.value })} className="rounded border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[12.5px] font-bold">
                {MEAL_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
              <Input value={m.description} onChange={(e) => upd(m.id, { description: e.target.value })} placeholder="e.g. Pasta with tomato sauce, garlic bread" className="w-full" />
              <button type="button" onClick={() => setMeals((x) => x.filter((y) => y.id !== m.id))} className="text-[var(--ink-3)]" aria-label="Remove">×</button>
            </div>
            <div className="mt-1.5">
              <span className="mr-1.5 text-[10.5px] font-bold uppercase tracking-[0.05em] text-[var(--ink-3)]">Contains</span>
              {allergens.map((a) => (
                <button key={a} type="button" onClick={() => toggleAllergen(m.id, a)}
                  className="m-0.5 rounded-full border px-2 py-[1px] text-[10.5px] font-bold capitalize transition-colors"
                  style={m.allergens.includes(a) ? { borderColor: "transparent", background: "var(--red,#e21d27)", color: "#fff" } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>
                  {a}
                </button>
              ))}
            </div>
          </div>
        ))}
        <button type="button" onClick={() => setMeals((m) => [...m, { id: uid(), type: MEAL_TYPES[2], description: "", allergens: [] }])} className="self-start text-[12px] font-bold text-[var(--brand-2,#2f6bd8)] underline">+ Add a meal</button>
      </div>
      <div className="mt-3"><Button sm variant="primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save menu"}</Button></div>
    </Card>
  );
}

export function MealsApp() {
  const [date, setDate] = useState(todayIso);
  const [loaded, setLoaded] = useState<{ date: string; board: Board } | null>(null);
  const board = loaded && loaded.date === date ? loaded.board : null;
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [tab, setTab] = useState<"board" | "shop">("board");

  const refresh = useCallback(() => {
    apiGet<Board>(`/api/meals?date=${date}`).then((b) => { setLoaded({ date, board: b }); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [date]);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { apiGet<{ role: string }>("/api/me").then((me) => setCanManage(["company", "freelancer", "franchise"].includes(me.role))).catch(() => {}); }, []);
  useRealtime(["menus", "bookings", "blocks"], refresh);

  if (tab === "shop") return <MealShopApp canManage={canManage} onBoard={() => setTab("board")} />;

  return (
    <OperatorPage
      title="Meals & allergies"
      icon="🍽️"
      lede={`${dayLabel(date)} — the menu, and who at the table needs care.`}
      actions={
        <div className="flex items-center gap-1.5">
          <Button sm onClick={() => setTab("shop")}>Meal shop →</Button>
          <Button sm onClick={() => setDate((d) => shiftDay(d, -1))} aria-label="Previous day">←</Button>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12.5px] text-[var(--ink)]" />
          <Button sm onClick={() => setDate((d) => shiftDay(d, 1))} aria-label="Next day">→</Button>
          {date !== todayIso() && <Button sm onClick={() => setDate(todayIso())}>Today</Button>}
        </div>
      }
    >
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}

      {board && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-[12px]">
          <span className="text-[var(--ink-2)]">{board.summary.children} children</span>
          {board.summary.withNeeds > 0 && <Badge tone={{ bg: "#fdf3d8", fg: "#9a5a00" }}>{board.summary.withNeeds} with dietary needs</Badge>}
          {board.summary.alerts > 0 && <Badge tone={{ bg: "var(--red-soft,#fdebec)", fg: "var(--red,#e21d27)" }}>⚠ {board.summary.alerts} allergen alert{board.summary.alerts === 1 ? "" : "s"} against today’s menu</Badge>}
          {canManage && <Button sm className="ml-auto" onClick={() => setEditing((e) => !e)}>{editing ? "Close menu" : board.menu.length ? "Edit menu" : "Add a menu"}</Button>}
        </div>
      )}

      {editing && board && <MenuEditor date={date} menu={board.menu} allergens={board.allergens} onSaved={() => { setEditing(false); refresh(); }} />}

      {board && board.menu.length > 0 && !editing && (
        <Card className="mb-3.5 p-4">
          <div className="mb-1.5 text-[12px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">Today’s menu</div>
          {board.menu.map((m) => (
            <div key={m.id} className="border-t border-dashed border-[var(--line)] py-1.5 text-[13px] first:border-t-0">
              <b>{m.type}:</b> {m.description}
              {m.allergens.length > 0 && <span className="ml-2 text-[11px] capitalize text-[var(--red)]">contains {m.allergens.join(", ")}</span>}
            </div>
          ))}
        </Card>
      )}

      {!board ? (
        <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
      ) : board.sessions.length === 0 ? (
        <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">Nothing runs on {dayLabel(date)}.</Card>
      ) : (
        <div className="flex flex-col gap-3.5">
          {board.sessions.map((s) => (
            <Card key={s.blockId} className="p-4">
              <div className="text-[15px] font-extrabold">{s.listingName}</div>
              <div className="mb-2 text-[12px] text-[var(--ink-3)]">{s.blockName} · {s.start} – {s.end}</div>
              {s.children.length === 0 ? (
                <div className="text-[12.5px] text-[var(--ink-3)]">No children booked.</div>
              ) : (
                s.children.map((c) => {
                  const hasNeeds = c.allergies || c.dietary || c.alerts.length;
                  return (
                    <div key={c.ref} className="flex flex-wrap items-baseline gap-2 border-t border-[var(--line)] py-1.5 text-[12.5px] first:border-t-0" style={c.alerts.length ? { background: "rgba(226,29,41,.04)" } : undefined}>
                      <span className="font-bold">{c.name}</span>
                      {c.alerts.length > 0 && (
                        <span className="rounded px-1.5 py-[1px] text-[11px] font-bold capitalize" style={{ background: "var(--red,#e21d27)", color: "#fff" }}>
                          ⚠ menu contains {c.alerts.join(", ")}
                        </span>
                      )}
                      {c.allergies && <span className="rounded px-1.5 py-[1px] text-[11px] font-bold" style={{ background: "var(--red-soft,#fdebec)", color: "var(--red,#e21d27)" }}>Allergies: {c.allergies}</span>}
                      {c.dietary && <span className="rounded px-1.5 py-[1px] text-[11px] font-bold" style={{ background: "var(--brand-soft,#e7f0ff)", color: "var(--brand-ink,#1d3a8f)" }}>{c.dietary}</span>}
                      {!hasNeeds && <span className="text-[11.5px] text-[var(--ink-3)]">no dietary needs on file</span>}
                    </div>
                  );
                })
              )}
            </Card>
          ))}
        </div>
      )}
    </OperatorPage>
  );
}
