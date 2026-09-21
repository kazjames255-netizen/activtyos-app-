"use client";

import { useEffect, useMemo, useState } from "react";
import { FOCUS } from "../../teachKit";
import { del, get } from "@/lib/api";
import { withQs } from "../../teachKit";
import type { El } from "./model";
import { BIcon } from "./boardIcons";
import { useCtrl } from "./BoardUi";
import type { BoardController } from "./controller";
import { LEVELS, LEVEL_LABEL, type Level, type PackId, type ToolItem, type Vals } from "./toolkit/kit";
import { PACKS, forLevel, packById, searchItems } from "./toolkit/packs";
import { PACK_SYMBOLS, SYMBOL_SETS } from "./toolkit/symbols";

// The Toolkit: pick a subject pack (General, Maths, English, Languages, Geography,
// History, Science), see its templates for the chosen key-stage style, fill in the
// few things a template needs (words, a range, a language…) and drop it on the board.
// Special-character palettes (é ñ ß, ² √ π, → ⇌…) sit under the "Characters" tab.

const PACK_KEY = "hub-board-pack";
export const readPack = (subjectPack: PackId): PackId => { try { const v = localStorage.getItem(PACK_KEY) as PackId | null; if (v && packById(v)) return v; } catch { /* no storage */ } return subjectPack; };
export const rememberPack = (p: PackId) => { try { localStorage.setItem(PACK_KEY, p); } catch { /* fine */ } };

const seg = (on: boolean) => `inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl px-2 text-[12.5px] font-extrabold ${FOCUS} ${on ? "bg-[var(--brand)] text-white" : "text-[var(--ink-2)] hover:bg-[var(--brand-soft)]"}`;
const field = `w-full rounded-xl border border-[var(--hub-warm-line)] bg-[var(--surface)] px-3 text-[13.5px] text-[var(--ink)] ${FOCUS}`;

interface Tpl { id: string; name: string; elements: El[] }

export function ToolkitPop({ ctrl, subjectPack, close, onPicture, onImport, qs }: { ctrl: BoardController; subjectPack: PackId; close: () => void; onPicture: () => void; onImport?: () => void; qs?: string }) {
  useCtrl(ctrl);
  const [pack, setPack] = useState<PackId>(() => readPack(subjectPack));
  const [mode, setMode] = useState<"aids" | "chars">("aids");
  const [q, setQ] = useState("");
  const [allLevels, setAllLevels] = useState(false);
  const [form, setForm] = useState<{ item: ToolItem; vals: Vals } | null>(null);
  const level = ctrl.level;
  const [tpls, setTpls] = useState<Tpl[] | null>(null);
  useEffect(() => {
    if (pack !== "mine" || !qs) return;
    let dead = false;
    get<Tpl[]>(`/api/learning-hub/board-templates${withQs(qs, {})}`).then((r) => { if (!dead) setTpls(Array.isArray(r) ? r : []); }).catch(() => { if (!dead) setTpls([]); });
    return () => { dead = true; };
  }, [pack, qs]);
  const P = packById(pack) ?? { id: "mine" as PackId, label: "My templates", blurb: "Pages you saved from the board (⋯ menu → Save this page as a template)", items: [] as ToolItem[], groups: undefined };
  const items = useMemo(() => searchItems(forLevel(P.items, level, allLevels || !!q.trim()), q), [P, level, allLevels, q]);
  const choose = (p: PackId) => { setPack(p); rememberPack(p); setForm(null); };
  const pick = (item: ToolItem) => {
    if (item.action === "picture") { close(); onPicture(); return; }
    if (item.action === "import") { close(); onImport?.(); return; }
    if (item.params?.length) { setForm({ item, vals: Object.fromEntries(item.params.map((p) => [p.k, p.def])) }); return; }
    ctrl.placeTemplate(item, {}); close();
  };
  const groups = P.groups ?? [null];

  return (
    <div role="dialog" aria-label="Toolkit" style={{ containerType: "inline-size" }} onMouseDown={(e) => { if (ctrl.editing && !(e.target as HTMLElement).closest("input,textarea,select,label")) e.preventDefault(); /* keep the open text box focused while picking a character */ }} data-testid="board-toolkit" className="hub-pop flex max-h-[min(80vh,660px)] min-h-0 w-[560px] max-w-full flex-col overflow-hidden rounded-2xl border border-[var(--hub-warm-line)] bg-[var(--surface)] shadow-[var(--shadow)]">
      <div className="flex-none border-b border-[var(--hub-warm-line)] p-2" style={{ background: "var(--hub-warm)" }}>
        <div role="tablist" aria-label="Subject packs" className="flex gap-1 overflow-x-auto pb-1">
          {[...PACKS, ...(qs ? [{ id: "mine" as PackId, label: "My templates" }] : [])].map((p) => (
            <button key={p.id} type="button" role="tab" aria-selected={p.id === pack} data-pack={p.id} onClick={() => choose(p.id)}
              className={`inline-flex min-h-[44px] flex-none items-center rounded-xl border px-3 text-[13px] font-extrabold ${FOCUS} ${p.id === pack ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--hub-warm-line)] bg-[var(--surface)] text-[var(--ink-2)] hover:border-[var(--brand)]"}`}>{p.label}</button>
          ))}
        </div>
        <div className="mt-1 flex gap-1 rounded-2xl border border-[var(--hub-warm-line)] p-0.5" role="group" aria-label="Style" style={{ background: "var(--hub-warm-2)" }}>
          {LEVELS.map((l: Level) => <button key={l} type="button" aria-pressed={level === l} data-level={l} onClick={() => ctrl.setLevel(l)} className={seg(level === l)} title={LEVEL_LABEL[l]}>{LEVEL_LABEL[l]}</button>)}
        </div>
        <div className="mt-1 flex gap-1" role="group" aria-label="Show">
          <button type="button" aria-pressed={mode === "aids"} onClick={() => setMode("aids")} className={`${seg(mode === "aids")} border border-[var(--hub-warm-line)]`}>Teaching aids</button>
          <button type="button" aria-pressed={mode === "chars"} onClick={() => setMode("chars")} data-mode="chars" className={`${seg(mode === "chars")} border border-[var(--hub-warm-line)]`}>Characters</button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {mode === "chars" ? (
          <div>
            <p className="m-0 mb-1.5 px-1 text-[12px] leading-snug text-[var(--ink-3)]">Tap a character to add it to the text you&apos;re typing (or to place it on the board).</p>
            {(PACK_SYMBOLS[pack] ?? ["eng"]).map((id) => SYMBOL_SETS.find((s) => s.id === id)).filter(Boolean).map((set) => (
              <div key={set!.id} className="mb-2.5">
                <div className="px-1 pb-1 text-[11px] font-extrabold uppercase tracking-[0.1em] text-[var(--ink-3)]">{set!.label}</div>
                <div className="flex flex-wrap gap-1" data-charset={set!.id}>
                  {set!.chars.map((ch) => <button key={ch} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => ctrl.insertChars(ch)} aria-label={`Insert ${ch}`} className={`grid h-11 min-w-[44px] place-items-center rounded-xl border border-[var(--hub-warm-line)] bg-[var(--surface)] px-1.5 text-[19px] font-bold text-[var(--ink)] hover:border-[var(--brand)] hover:bg-[var(--brand-soft)] ${FOCUS}`}>{ch}</button>)}
                </div>
              </div>
            ))}
          </div>
        ) : form ? (
          <div data-testid="toolkit-form">
            <button type="button" onClick={() => setForm(null)} className={`mb-1 inline-flex min-h-[44px] items-center gap-1 rounded-xl px-2 text-[12.5px] font-bold text-[var(--brand)] hover:bg-[var(--brand-soft)] ${FOCUS}`}><BIcon name="chevron" size={15} className="rotate-90" />Back</button>
            <div className="px-1 pb-2 text-[15px] font-extrabold text-[var(--ink)]">{form.item.label}</div>
            <div className="grid gap-2.5 px-1">
              {form.item.params!.map((p) => (
                <label key={p.k} className="block">
                  <span className="mb-1 block text-[11.5px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">{p.label}</span>
                  {p.type === "select" ? (
                    <select aria-label={p.label} className={`${field} min-h-[44px]`} value={String(form.vals[p.k])} onChange={(e) => setForm({ ...form, vals: { ...form.vals, [p.k]: e.target.value } })}>{p.options!.map((o) => <option key={o}>{o}</option>)}</select>
                  ) : p.type === "number" ? (
                    <input type="number" aria-label={p.label} className={`${field} min-h-[44px]`} value={String(form.vals[p.k])} onChange={(e) => setForm({ ...form, vals: { ...form.vals, [p.k]: e.target.value } })} />
                  ) : (p.type === "list" || String(p.def).includes("\n") || String(p.def).length > 40) ? (
                    <textarea aria-label={p.label} rows={3} className={`${field} py-2`} value={String(form.vals[p.k])} onChange={(e) => setForm({ ...form, vals: { ...form.vals, [p.k]: e.target.value } })} />
                  ) : (
                    <input type="text" aria-label={p.label} className={`${field} min-h-[44px]`} value={String(form.vals[p.k])} onChange={(e) => setForm({ ...form, vals: { ...form.vals, [p.k]: e.target.value } })} />
                  )}
                </label>
              ))}
            </div>
            <button type="button" data-action="place-template" onClick={() => { ctrl.placeTemplate(form.item, form.vals); close(); }} className={`mt-3 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl px-4 text-[14px] font-extrabold text-white ${FOCUS}`} style={{ background: "linear-gradient(180deg, var(--brand-2), var(--brand))" }}>Add to the board</button>
          </div>
        ) : (
          <>
            <div className="mb-1.5 flex items-center gap-2 px-0.5">
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${P.label.toLowerCase()}…`} aria-label="Search the toolkit" className={`${field} min-h-[44px] flex-1`} />
            </div>
            <p className="m-0 mb-1.5 px-1 text-[11.5px] leading-snug text-[var(--ink-3)]">{P.blurb}</p>
            {pack === "mine" && (
              <ul className="m-0 mb-2 grid list-none gap-1 p-0" data-testid="my-templates">
                {tpls === null && <li className="px-2 py-3 text-[12.5px] text-[var(--ink-3)]">Loading…</li>}
                {tpls?.length === 0 && <li className="px-2 py-3 text-[12.5px] leading-relaxed text-[var(--ink-3)]">No templates yet. Set a page up the way you like, then ⋯ → &ldquo;Save this page as a template&rdquo;.</li>}
                {tpls?.map((t) => (
                  <li key={t.id} className="flex items-center gap-1">
                    <button type="button" data-template={t.id} onClick={() => { ctrl.placeCopies(t.elements); close(); }} className={`flex min-h-[56px] flex-1 flex-col justify-center rounded-xl border border-[var(--hub-warm-line)] bg-[var(--surface)] px-3 text-left hover:border-[var(--brand)] hover:bg-[var(--brand-soft)] ${FOCUS}`}><span className="text-[13.5px] font-extrabold text-[var(--ink)]">{t.name}</span><span className="text-[11.5px] text-[var(--ink-3)]">{t.elements.length} items</span></button>
                    <button type="button" aria-label={`Delete ${t.name}`} onClick={() => { void del(`/api/learning-hub/board-templates/${t.id}${withQs(qs!, {})}`).then(() => setTpls((l) => (l ?? []).filter((x) => x.id !== t.id))); }} className={`grid h-11 w-11 place-items-center rounded-xl text-[var(--red)] hover:bg-[var(--red-soft)] ${FOCUS}`}><BIcon name="trash" size={17} /></button>
                  </li>
                ))}
              </ul>
            )}
            {groups.map((g) => {
              const rows = items.filter((i) => (g ? i.group === g : true));
              if (!rows.length) return null;
              return (
                <div key={g ?? "all"} className="mb-2">
                  {g && <div className="px-1 pb-1 pt-1 text-[11px] font-extrabold uppercase tracking-[0.1em] text-[var(--ink-3)]">{g}</div>}
                  <ul className="m-0 grid list-none grid-cols-2 gap-1.5 p-0 @[420px]:grid-cols-3">
                    {rows.map((it) => (
                      <li key={it.id}>
                        <button type="button" data-item={it.id} onClick={() => pick(it)} title={it.sub ?? it.label}
                          className={`flex min-h-[64px] w-full flex-col justify-center rounded-xl border border-[var(--hub-warm-line)] bg-[var(--surface)] px-3 py-2 text-left hover:border-[var(--brand)] hover:bg-[var(--brand-soft)] ${FOCUS}`}>
                          <span className="text-[13.5px] font-extrabold leading-tight text-[var(--ink)]">{it.label}</span>
                          {it.sub && <span className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-[var(--ink-3)]">{it.sub}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            {!items.length && <p className="px-2 py-4 text-center text-[12.5px] text-[var(--ink-3)]">Nothing matches.</p>}
            <label className={`mt-1 flex min-h-[44px] cursor-pointer items-center gap-2 px-1 text-[12px] font-bold text-[var(--ink-2)]`}><input type="checkbox" checked={allLevels} onChange={(e) => setAllLevels(e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />Show items for every style</label>
          </>
        )}
      </div>
      <div className="flex-none border-t border-[var(--hub-warm-line)] p-1.5">
        <button type="button" data-action="insert-picture" onClick={() => { close(); onPicture(); }} className={`flex min-h-[44px] w-full items-center gap-2 rounded-xl px-2 text-left text-[12.5px] font-bold text-[var(--ink)] hover:bg-[var(--brand-soft)] ${FOCUS}`}>
          <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-[var(--gold-soft)] text-[var(--ink)]"><BIcon name="image" size={18} /></span>Picture…
        </button>
      </div>
    </div>
  );
}
