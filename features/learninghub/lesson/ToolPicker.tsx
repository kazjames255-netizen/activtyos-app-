"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FOCUS } from "../kit";
import { Z } from "../zLayers";
import { REGISTRY } from "../tools/registry";
import { SUBJECT_ORDER, type ToolMeta, type ToolSubject } from "../tools/types";
import { useI18n } from "@/lib/i18n/provider";
import { subjectLabel, toolName } from "../tools/toolTextB";

// "Add tool to this question": every live tool from the Tools page, filtered by subject and searchable. Picking a tool that is one of the 20 help-drawer
// tools stores that drawer id (so it uses the ruler/protractor overlay, the calculator window etc. exactly as before); any other stores its Tools-page id.

export const HUE: Record<ToolSubject, number> = { maths: 222, english: 335, science: 152, languages: 28, humanities: 42, cross: 268 };
const SUBJECT_EMOJI: Record<ToolSubject, string> = { maths: "🧮", english: "📖", science: "🔬", languages: "🗣️", humanities: "🌍", cross: "🧰" };
// A picture for every tool: first matching word in its name / tags wins, else its subject's picture.
// Specific phrases first (a "Times tables" tool must not become a clock, "Coordinate grid" not a bar chart, "Area of a circle" not a pizza).
const EMOJI_RULES: [RegExp, string][] = [
  [/light ray|reflect|refract|mirror/i, "🔦"],  [/times table|multiplic|\barray\b/i, "✖️"], [/coordinate|\bgrid\b|transform/i, "🗺️"], [/\barea\b|perimeter/i, "🔷"], [/number line/i, "↔️"],
  [/protractor/i, "📐"], [/ruler|straight edge|measure|read the scale/i, "📏"], [/compass|bearing/i, "🧭"], [/set square/i, "📐"], [/angle/i, "📐"], [/clock|\btime\b|\bhours?\b/i, "🕒"], [/calculator/i, "🧮"],
  [/dice|coin|spinner|chance|probab/i, "🎲"], [/fraction|pie|circle/i, "🍕"], [/number line|hop/i, "↔️"], [/graph|chart|frequency|tally|statistic|mean|data/i, "📊"], [/coordinate|grid|transform/i, "🗺️"],
  [/array|multiplic|times table|share|group/i, "✖️"], [/ten frame|counter|place|number|count/i, "🔢"], [/balance|scale|weigh/i, "⚖️"], [/ratio|percent|decimal/i, "➗"], [/area|perimeter|shape|construct|paper/i, "🔷"], [/function|algebra|equation/i, "🔣"],
  [/accent|symbol|alphabet|spell|phonic|letter|word|verb|noun|adjective|grammar|sentence|punctuat|conjugat/i, "🔤"], [/poem|story|read|text|quote|writ/i, "✍️"],
  [/atom|element|periodic|molecule|chemi/i, "⚛️"], [/circuit|electric|current|voltage/i, "💡"], [/cell|plant|animal|body|organ|food|habitat|bio/i, "🌱"], [/force|energy|wave|light|sound|magnet|physic/i, "🧲"], [/planet|space|earth|moon|solar/i, "🪐"],
  [/map|geograph|climate|river|country|continent/i, "🗺️"], [/histor|timeline|chronolog|sort/i, "🏛️"], [/french|spanish|german|language|translate|vocab/i, "🗣️"],
];
export const emojiFor = (t: ToolMeta): string => { const hay = `${t.title} ${t.tags.join(" ")}`; return EMOJI_RULES.find(([re]) => re.test(hay))?.[1] ?? SUBJECT_EMOJI[t.subject]; };

/** The id to save for a picked tool. */
export const toolValue = (t: ToolMeta): string => (t.impl?.kind === "drawer" ? t.impl.id : t.id);
export const LIVE_TOOLS = () => REGISTRY.filter((t) => t.status === "live");

export function ToolPicker({ taken, disabled, onPick, lesson }: { taken: string[]; disabled?: boolean; onPick: (value: string) => void; lesson?: boolean }) {
  const { t: tr, locale } = useI18n();
  const nm = (x: ToolMeta) => toolName(tr, x);
  const [open, setOpen] = useState(false);              // the small menu: search + subject chips
  const [card, setCard] = useState<ToolSubject | "all" | null>(null); // the big popup card listing every tool of a subject
  const [q, setQ] = useState("");
  const all = useMemo(() => LIVE_TOOLS().slice().sort((a, b) => nm(a).localeCompare(nm(b), locale)), [locale]); // eslint-disable-line react-hooks/exhaustive-deps
  const counts = useMemo(() => { const c = new Map<ToolSubject, number>(); all.forEach((t) => c.set(t.subject, (c.get(t.subject) ?? 0) + 1)); return c; }, [all]);
  const subjects = SUBJECT_ORDER.filter((s) => counts.get(s));
  const host = () => btnRef.current?.closest<HTMLElement>("#learning-hub") ?? document.getElementById("learning-hub") ?? document.body;
  // The picker lives inside floating panels that clip overflow, so both layers are portalled and positioned against the viewport.
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = btnRef.current?.getBoundingClientRect(); if (!r) return;
      const W = Math.min(310, window.innerWidth - 16);
      const left = Math.max(8, Math.min(r.left, window.innerWidth - W - 8));
      const up = window.innerHeight - r.bottom < 240 && r.top > window.innerHeight - r.bottom;
      setPos({ left, top: up ? Math.max(8, r.top - 6 - (menuRef.current?.offsetHeight ?? 190)) : r.bottom + 6 });
    };
    place();
    window.addEventListener("resize", place); window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open]);
  useEffect(() => {
    if (!open && card === null) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); if (card !== null) setCard(null); else setOpen(false); } };
    window.addEventListener("keydown", k, true); return () => window.removeEventListener("keydown", k, true);
  }, [open, card]);
  const menuRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  // Focus trap: Tab cycles inside whichever picker layer is open.
  const trapTab = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== "Tab") return;
    const f = [...e.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]),input,a[href],[tabindex]:not([tabindex='-1'])")];
    if (!f.length) return;
    const a = f[0]!, z = f[f.length - 1]!;
    if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
  };
  // Everything behind the open layer is inert (unreachable by Tab / screen readers) until it closes; focus returns to "Add tool".
  useEffect(() => {
    if (!open && card === null) return;
    const root = host(); const kids = [...root.children].filter((c) => !(c as HTMLElement).contains(menuRef.current) && !(c as HTMLElement).contains(cardRef.current)) as HTMLElement[];
    const prev = kids.map((k) => k.hasAttribute("inert")); kids.forEach((k) => k.setAttribute("inert", ""));
    const btn = btnRef.current;
    return () => { kids.forEach((k, i) => { if (!prev[i]) k.removeAttribute("inert"); }); requestAnimationFrame(() => { if (!document.querySelector("[data-testid=tool-picker],[data-testid=tool-picker-card]")) btn?.focus(); }); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, card === null]);
  const close = () => { setCard(null); setOpen(false); setQ(""); };
  const shown = all.filter((t) => !taken.includes(toolValue(t)) && (card === "all" || card === null || t.subject === card)
    && (!q.trim() || `${nm(t)} ${t.title} ${t.tags.join(" ")}`.toLowerCase().includes(q.trim().toLowerCase())));
  const groups = useMemo(() => {
    const m = new Map<string, ToolMeta[]>();
    for (const t of shown) { const l = (nm(t).trim()[0] ?? "#").toLocaleUpperCase(locale); (m.get(l) ?? m.set(l, []).get(l)!).push(t); }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], locale));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, taken.join("|"), card, q, locale]);
  const chip = (on: boolean) => `rounded-full border inline-flex min-h-[44px] items-center px-3.5 text-[12px] font-extrabold ${FOCUS} ${on ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)]"}`;
  const openCard = (s: ToolSubject | "all") => { setCard(s); setOpen(false); };
  return (
    <div className="relative inline-block">
      <button ref={btnRef} type="button" disabled={disabled} onClick={() => setOpen((o) => !o)} aria-expanded={open} data-testid="preview-tool-add"
        className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 text-[12.5px] font-extrabold text-[var(--ink)] ${FOCUS}`}>
        ➕ {lesson ? tr("hublessons.pkAddLesson") : tr("hubtoolsb.pk_add")} <span aria-hidden>{open ? "▴" : "▾"}</span>
      </button>
      {open && pos && typeof document !== "undefined" && createPortal(
        <div style={{ position: "fixed", left: pos.left, top: pos.top, zIndex: Z.picker }} className="w-[min(310px,calc(100vw-1rem))] rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 shadow-[0_18px_44px_rgba(0,0,0,0.25)]" data-testid="tool-picker" role="dialog" aria-modal="true" ref={menuRef} onKeyDown={trapTab} aria-label={tr("hubtoolsb.pk_chooseSubject")}>
          <input autoFocus type="search" value={q} onChange={(e) => { setQ(e.target.value); if (e.target.value.trim()) { setCard("all"); setOpen(false); } }} placeholder={tr("hubtoolsb.tp_searchPh")} aria-label={tr("hubtoolsb.tp_searchAria")} data-testid="tool-picker-search"
            className={`mb-2 min-h-[40px] w-full rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 text-[13.5px] font-semibold text-[var(--ink)] ${FOCUS}`} />
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={tr("hubtoolsb.tp_subject")}>
            <button type="button" className={chip(false)} onClick={() => openCard("all")} data-testid="tool-picker-subject-all">{tr("hubtoolsb.pk_all")} · {all.length}</button>
            {subjects.map((s) => <button key={s} type="button" className={chip(false)} onClick={() => openCard(s)} data-testid={`tool-picker-subject-${s}`}>{subjectLabel(tr, s)} · {counts.get(s)}</button>)}
          </div>
        </div>, host())}
      {card !== null && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 grid place-items-center p-3 sm:p-6" style={{ zIndex: Z.picker + 1 }} role="presentation">
          <div aria-hidden className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={close} />
          <div role="dialog" aria-modal="true" ref={cardRef} onKeyDown={trapTab} aria-label={card === "all" ? tr("hubtoolsb.pk_allTools") : tr("hubtoolsb.pk_subjectTools", { subject: subjectLabel(tr, card) })} data-testid="tool-picker-card"
            className="relative flex max-h-[calc(100vh-2rem)] w-[min(920px,100%)] flex-col overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface)] shadow-[0_30px_80px_rgba(0,0,0,0.4)]">
            <div className="flex flex-none flex-wrap items-center gap-2 border-b border-[var(--line)] p-3.5">
              <h3 className="m-0 me-auto text-[18px] font-extrabold text-[var(--ink)]">{card === "all" ? tr("hubtoolsb.pk_allTools") : subjectLabel(tr, card)} <span className="text-[13px] font-bold text-[var(--ink-3)]">· {shown.length}</span></h3>
              <button type="button" onClick={close} aria-label={tr("hubtoolsb.pk_close")} data-testid="tool-picker-card-close" className={`grid h-11 w-11 place-items-center rounded-full border border-[var(--line)] text-[16px] font-extrabold text-[var(--ink)] ${FOCUS}`}>✕</button>
            </div>
            <div className="flex-none border-b border-[var(--line)] px-3.5 py-2.5">
              <input autoFocus type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("hubtoolsb.pk_cardSearchPh")} aria-label={tr("hubtoolsb.tp_searchAria")} data-testid="tool-picker-card-search"
                className={`min-h-[46px] w-full rounded-full border-2 border-[var(--brand)] bg-[var(--surface)] px-5 text-[15px] font-bold text-[var(--ink)] ${FOCUS}`} />
            </div>
            <div className="flex flex-none flex-wrap gap-1.5 border-b border-[var(--line)] px-3.5 py-2.5" role="group" aria-label={tr("hubtoolsb.tp_subject")}>
              <button type="button" className={chip(card === "all")} aria-pressed={card === "all"} onClick={() => setCard("all")}>{tr("hubtoolsb.pk_all")} · {all.length}</button>
              {subjects.map((s) => <button key={s} type="button" className={chip(card === s)} aria-pressed={card === s} onClick={() => setCard(s)}>{subjectLabel(tr, s)} · {counts.get(s)}</button>)}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3.5" data-testid="tool-picker-list">
              {groups.length > 3 && (
                <nav className="sticky -top-3.5 z-10 -mx-3.5 -mt-3.5 mb-2 flex gap-1 overflow-x-auto border-b border-[var(--line)] bg-[var(--surface)] px-3.5" data-testid="tool-picker-rail">
                  {groups.map(([letter]) => <button key={letter} type="button" aria-label={tr("hubtoolsb.tp_azAria", { letter })} onClick={() => cardRef.current?.querySelector(`[data-letter="${letter}"]`)?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })} className={`grid h-11 min-w-[36px] flex-none place-items-center rounded-lg text-[13px] font-extrabold text-[var(--brand)] ${FOCUS}`}>{letter}</button>)}
                </nav>
              )}
              {groups.map(([letter, tools]) => (
                <section key={letter} data-letter={letter} className="mb-3.5 scroll-mt-14" aria-label={tr("hubtoolsb.tp_azAria", { letter })}>
                  <div className="mb-1.5 flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--brand)] text-[13px] font-extrabold text-white">{letter}</span><span className="h-px flex-1 bg-[var(--line)]" /></div>
                  <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3 lg:grid-cols-4">
                    {tools.map((t) => { const h = HUE[t.subject]; return (
                      <li key={t.id}>
                        <button type="button" onClick={() => { onPick(toolValue(t)); close(); }} data-testid={`tool-picker-item-${toolValue(t)}`}
                          style={{ background: `hsl(${h} 90% 96%)`, borderColor: `hsl(${h} 60% 84%)` }}
                          className={`flex h-full w-full items-center gap-2.5 rounded-2xl border px-2.5 py-2.5 text-start transition hover:shadow-md motion-safe:hover:-translate-y-0.5 ${FOCUS}`}>
                          <span aria-hidden className="grid h-11 w-11 flex-none place-items-center rounded-xl text-[24px]" style={{ background: `hsl(${h} 85% 90%)` }}>{emojiFor(t)}</span>
                          <span className="min-w-0">
                            <span className="block text-[13.5px] font-extrabold leading-snug text-[var(--ink)]">{nm(t)}</span>
                            <span className="mt-0.5 block text-[11.5px] font-bold" style={{ color: `hsl(${h} 45% 34%)` }}>{subjectLabel(tr, t.subject)} · KS{t.keyStages.join("–KS")}</span>
                          </span>
                        </button>
                      </li>); })}
                  </ul>
                </section>
              ))}
              {!shown.length && <p className="m-0 px-2 py-6 text-center text-[13px] font-semibold text-[var(--ink-3)]">{tr("hubtoolsb.pk_none")}</p>}
            </div>
          </div>
        </div>, host())}
    </div>
  );
}
