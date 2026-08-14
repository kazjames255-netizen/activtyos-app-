"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LIGHT_PALETTE } from "@/components/OperatorPage";
import type { Block, CourseDoc, QuizQ } from "./courseContent";
import { activeQuizVersion, QUIZ_VERSION_LABELS } from "./courseContent";
import { coursePaletteOf } from "./courseTheme";
import { CourseBanner } from "./CourseBanner";
import { openCertificate, makeRef } from "./certificates";
import { useSettings } from "@/lib/settings";

// Interactive block kinds that must be attempted before a lesson can be marked complete.
const INTERACTIVE_KINDS = ["sort", "order", "match", "reveal", "scenario", "check"];

// ——— Illustrated scene panels ("visuals that mimic real life") ———
const ART: Record<string, { grad: string; emoji: string; motif: "people" | "phone" | "cross" | "doc" | "flame" | "shield" }> = {
  shield: { grad: "linear-gradient(135deg,#1d3a8f,#3f7ae0)", emoji: "🛡️", motif: "shield" },
  listen: { grad: "linear-gradient(135deg,#0e7d74,#22b4a6)", emoji: "🤝", motif: "people" },
  county: { grad: "linear-gradient(135deg,#6d28d9,#a855f7)", emoji: "📱", motif: "phone" },
  recruit: { grad: "linear-gradient(135deg,#0f766e,#14b8a6)", emoji: "🔎", motif: "people" },
  prevent: { grad: "linear-gradient(135deg,#b45309,#f59e0b)", emoji: "🧭", motif: "shield" },
  epipen: { grad: "linear-gradient(135deg,#b91c1c,#ef4444)", emoji: "💉", motif: "cross" },
  online: { grad: "linear-gradient(135deg,#1e40af,#38bdf8)", emoji: "🌐", motif: "phone" },
  behaviour: { grad: "linear-gradient(135deg,#7c3aed,#c084fc)", emoji: "🫧", motif: "people" },
  data: { grad: "linear-gradient(135deg,#334155,#64748b)", emoji: "🔒", motif: "doc" },
  firstaid: { grad: "linear-gradient(135deg,#047857,#10b981)", emoji: "⛑️", motif: "cross" },
  fire: { grad: "linear-gradient(135deg,#c2410c,#f97316)", emoji: "🔥", motif: "flame" },
  autism: { grad: "linear-gradient(135deg,#0369a1,#22d3ee)", emoji: "🧩", motif: "people" },
  adhd: { grad: "linear-gradient(135deg,#c2410c,#fbbf24)", emoji: "⚡", motif: "people" },
  mind: { grad: "linear-gradient(135deg,#4338ca,#a78bfa)", emoji: "🧠", motif: "people" },
  cse: { grad: "linear-gradient(135deg,#9d174d,#f43f5e)", emoji: "🚸", motif: "shield" },
  fgm: { grad: "linear-gradient(135deg,#831843,#be185d)", emoji: "🎗️", motif: "shield" },
  domestic: { grad: "linear-gradient(135deg,#3f3f5e,#7c3aed)", emoji: "🏠", motif: "shield" },
  food: { grad: "linear-gradient(135deg,#166534,#4ade80)", emoji: "🍽️", motif: "doc" },
  // ——— new library (c20–c39) ———
  med: { grad: "linear-gradient(135deg,#b91c1c,#f87171)", emoji: "💊", motif: "cross" },
  epilepsy: { grad: "linear-gradient(135deg,#9f1239,#fb7185)", emoji: "🧠", motif: "cross" },
  diabetes: { grad: "linear-gradient(135deg,#be123c,#fb7185)", emoji: "🩸", motif: "cross" },
  asthma: { grad: "linear-gradient(135deg,#0e7490,#22d3ee)", emoji: "🫁", motif: "cross" },
  risk: { grad: "linear-gradient(135deg,#b45309,#f59e0b)", emoji: "⚠️", motif: "doc" },
  trips: { grad: "linear-gradient(135deg,#166534,#4ade80)", emoji: "🚌", motif: "doc" },
  water: { grad: "linear-gradient(135deg,#0369a1,#38bdf8)", emoji: "🌊", motif: "people" },
  sun: { grad: "linear-gradient(135deg,#b45309,#fbbf24)", emoji: "☀️", motif: "flame" },
  lifting: { grad: "linear-gradient(135deg,#3f6212,#84cc16)", emoji: "📦", motif: "doc" },
  lone: { grad: "linear-gradient(135deg,#334155,#64748b)", emoji: "🚶", motif: "people" },
  hygiene: { grad: "linear-gradient(135deg,#0f766e,#2dd4bf)", emoji: "🧼", motif: "doc" },
  edi: { grad: "linear-gradient(135deg,#c2410c,#fb923c)", emoji: "🌍", motif: "people" },
  antibully: { grad: "linear-gradient(135deg,#9d174d,#f472b6)", emoji: "🙅", motif: "people" },
  send: { grad: "linear-gradient(135deg,#7c3aed,#c084fc)", emoji: "♿", motif: "people" },
  aces: { grad: "linear-gradient(135deg,#4338ca,#818cf8)", emoji: "💔", motif: "people" },
  develop: { grad: "linear-gradient(135deg,#166534,#86efac)", emoji: "🌱", motif: "people" },
  grief: { grad: "linear-gradient(135deg,#475569,#94a3b8)", emoji: "🕊️", motif: "people" },
  wellbeing: { grad: "linear-gradient(135deg,#0f766e,#5eead4)", emoji: "🌿", motif: "people" },
  slavery: { grad: "linear-gradient(135deg,#1e3a8a,#60a5fa)", emoji: "⛓️", motif: "shield" },
  parents: { grad: "linear-gradient(135deg,#475569,#94a3b8)", emoji: "🤝", motif: "people" },
};
export const ART_KEYS = ["shield", "listen", "county", "recruit", "prevent", "epipen", "online", "behaviour", "data", "firstaid", "fire", "autism", "adhd", "mind", "cse", "fgm", "domestic", "food", "med", "epilepsy", "diabetes", "asthma", "risk", "trips", "water", "sun", "lifting", "lone", "hygiene", "edi", "antibully", "send", "aces", "develop", "grief", "wellbeing", "slavery", "parents"];
// "Badge + text" illustration — a circular icon badge with the caption beside it,
// on a palette-tinted panel (--art-grad recolours it for themed courses).
function Scene({ art, caption }: { art: string; caption?: string }) {
  const a = ART[art] ?? ART.shield;
  return (
    <figure className="my-4">
      <div className="relative flex items-center gap-4 overflow-hidden rounded-2xl p-5 text-white shadow-[0_18px_40px_-24px_rgba(16,32,90,.6)]" style={{ background: `var(--art-grad, ${a.grad})` }}>
        <svg className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" viewBox="0 0 400 160" aria-hidden>
          <circle cx="372" cy="20" r="70" fill="#fff" opacity="0.08" />
          <circle cx="348" cy="150" r="42" fill="#fff" opacity="0.06" />
        </svg>
        <div className="relative grid h-16 w-16 flex-none place-items-center overflow-hidden rounded-full bg-white/20 text-[30px] leading-none shadow-inner backdrop-blur">{a.emoji}</div>
        <div className="relative min-w-0 pl-1">
          <div className="text-[17px] font-extrabold leading-tight" style={{ textWrap: "balance" } as React.CSSProperties}>{caption || "Illustration"}</div>
        </div>
      </div>
    </figure>
  );
}

const CALLOUT: Record<string, { bg: string; bar: string; ink: string; icon: string }> = {
  info: { bg: "#eef4fd", bar: "#2f6bd8", ink: "#1d3a8f", icon: "ℹ️" },
  warn: { bg: "#fdf0e6", bar: "#e07a1f", ink: "#a8560f", icon: "⚠️" },
  tip: { bg: "#eaf8f0", bar: "#0f9d58", ink: "#0f7a43", icon: "💡" },
  law: { bg: "#f2effe", bar: "#6d28d9", ink: "#5b21b6", icon: "⚖️" },
};

// ——— read-aloud text for one lesson ———
function speakText(blocks: Block[]): string {
  const parts: string[] = [];
  for (const b of blocks) {
    if (b.k === "text") parts.push(b.t);
    else if (b.k === "points") parts.push((b.title ? b.title + ". " : "") + b.items.join(". "));
    else if (b.k === "callout") parts.push(b.title + ". " + b.t);
    else if (b.k === "steps") parts.push((b.title ? b.title + ". " : "") + b.items.map((i) => i.h + ". " + i.t).join(" "));
    else if (b.k === "scenario") parts.push("Scenario. " + b.t);
    else if (b.k === "check") parts.push("Knowledge check. " + b.q);
    else if (b.k === "stat") parts.push(b.value + " " + b.label);
    else if (b.k === "quote") parts.push(b.t + (b.by ? ", " + b.by : ""));
    else if (b.k === "table") parts.push(b.head.join(", ") + ". " + b.rows.map((r) => r.join(", ")).join(". "));
    else if (b.k === "art" && b.caption) parts.push(b.caption);
    else if ((b.k === "image" || b.k === "video") && b.caption) parts.push(b.caption);
  }
  return parts.join(". ");
}

function useVoice() {
  const [on, setOn] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const pick = () => {
      const vs = window.speechSynthesis.getVoices();
      voiceRef.current = vs.find((v) => v.name === "Google UK English Female") || vs.find((v) => /en-GB/i.test(v.lang) && /female/i.test(v.name)) || vs.find((v) => /en-GB/i.test(v.lang)) || vs[0] || null;
    };
    pick();
    window.speechSynthesis.onvoiceschanged = pick;
    return () => { try { window.speechSynthesis.cancel(); } catch { /* ignore */ } };
  }, []);
  const stop = () => { try { window.speechSynthesis.cancel(); } catch { /* ignore */ } setSpeaking(false); };
  const speak = (text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (voiceRef.current) u.voice = voiceRef.current;
    u.lang = "en-GB"; u.rate = 0.98; u.pitch = 1;
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  };
  return { on, setOn, speaking, speak, stop };
}

// ——— interactive blocks ———
function ScenarioBlock({ b, onDone }: { b: Extract<Block, { k: "scenario" }>; onDone?: () => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  useEffect(() => { if (picked != null) onDone?.(); }, [picked]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="my-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-[var(--accent)]">🎬 Real-life scenario</div>
      <p className="mb-3 text-[14.5px] font-semibold text-[var(--ink)]">{b.t}</p>
      <div className="flex flex-col gap-2">
        {b.choices.map((c, i) => {
          const sel = picked === i;
          const tone = picked == null ? "border-[var(--line)] hover:border-[var(--accent)]" : c.ok ? "border-[#0f9d58] bg-[#eaf8f0]" : sel ? "border-[#c0392b] bg-[#fdecec]" : "border-[var(--line)] opacity-70";
          return (
            <button key={i} type="button" disabled={picked != null} onClick={() => setPicked(i)} className={"rounded-xl border-2 px-3.5 py-2.5 text-left text-[13.5px] font-semibold text-[var(--ink)] transition-colors " + tone}>
              <span className="mr-1.5">{picked != null ? (c.ok ? "✅" : sel ? "❌" : "○") : "○"}</span>{c.label}
              {picked != null && (sel || c.ok) && <div className="mt-1 text-[12.5px] font-normal text-[var(--ink-2)]">{c.fb}</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
function CheckBlock({ b, onDone }: { b: Extract<Block, { k: "check" }>; onDone?: () => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  useEffect(() => { if (picked != null) onDone?.(); }, [picked]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="my-4 rounded-2xl border border-[var(--line)] bg-[var(--accent-soft)] p-4">
      <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-[var(--accent)]">✓ Knowledge check</div>
      <p className="mb-3 text-[14.5px] font-semibold text-[var(--ink)]">{b.q}</p>
      <div className="flex flex-col gap-2">
        {b.opts.map((o, i) => {
          const sel = picked === i;
          const tone = picked == null ? "border-[var(--line)] bg-white hover:border-[var(--accent)]" : i === b.a ? "border-[#0f9d58] bg-[#eaf8f0]" : sel ? "border-[#c0392b] bg-[#fdecec]" : "border-[var(--line)] bg-white opacity-70";
          return (
            <button key={i} type="button" disabled={picked != null} onClick={() => setPicked(i)} className={"rounded-xl border-2 px-3.5 py-2 text-left text-[13.5px] font-semibold text-[var(--ink)] transition-colors " + tone}>
              <span className="mr-1.5">{picked != null ? (i === b.a ? "✅" : sel ? "❌" : "○") : "○"}</span>{o}
            </button>
          );
        })}
      </div>
      {picked != null && <p className="mt-2.5 text-[12.5px] font-semibold" style={{ color: picked === b.a ? "#0f7a43" : "#c0392b" }}>{picked === b.a ? "Correct. " : "Not quite. "}{b.fb}</p>}
    </div>
  );
}

const shuffle = <T,>(a: T[]): T[] => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const ActWrap = ({ tag, children }: { tag: string; children: React.ReactNode }) => (
  <div className="my-4 rounded-2xl border border-[var(--line)] bg-[var(--accent-soft)] p-4">
    <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-[var(--accent)]">🎯 {tag}</div>
    {children}
  </div>
);

// Drag items into the right bucket
function SortBlock({ b, onDone }: { b: Extract<Block, { k: "sort" }>; onDone?: () => void }) {
  const [placed, setPlaced] = useState<Record<number, number | null>>(() => Object.fromEntries(b.items.map((_, i) => [i, null])));
  const [checked, setChecked] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);
  useEffect(() => { if (checked) onDone?.(); }, [checked]); // eslint-disable-line react-hooks/exhaustive-deps
  const tray = b.items.map((_, i) => i).filter((i) => placed[i] == null);
  const place = (item: number, bucket: number | null) => { if (checked) return; setPlaced((p) => ({ ...p, [item]: bucket })); };
  const correct = b.items.filter((it, i) => placed[i] === it.bucket).length;
  return (
    <ActWrap tag="Drag into the right group">
      <p className="mb-3 text-[14px] font-semibold text-[var(--ink)]">{b.prompt}</p>
      {tray.length > 0 && <div className="mb-3 flex flex-wrap gap-2 rounded-xl border border-dashed border-[var(--line)] bg-white p-2.5">
        {tray.map((i) => <span key={i} draggable onDragStart={() => setDrag(i)} onClick={() => setDrag(drag === i ? null : i)} className={"cursor-grab rounded-lg border px-2.5 py-1.5 text-[12.5px] font-semibold " + (drag === i ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--line)] bg-[var(--panel)]")}>{b.items[i].text}</span>)}
      </div>}
      <div className="grid gap-2.5 sm:grid-cols-2">
        {b.buckets.map((bk, bi) => (
          <div key={bi} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag != null) { place(drag, bi); setDrag(null); } }} onClick={() => { if (drag != null) { place(drag, bi); setDrag(null); } }} className="min-h-[64px] rounded-xl border-2 border-dashed border-[var(--line)] bg-white p-2.5">
            <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{bk}</div>
            <div className="flex flex-wrap gap-1.5">
              {b.items.map((it, i) => placed[i] === bi ? (
                <span key={i} draggable={!checked} onDragStart={() => setDrag(i)} onClick={(e) => { e.stopPropagation(); if (!checked) place(i, null); }} className={"rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-white " + (checked ? (it.bucket === bi ? "bg-[#0f9d58]" : "bg-[#c0392b]") : "bg-[var(--accent)]")}>{it.text}{checked && (it.bucket === bi ? " ✓" : " ✗")}</span>
              ) : null)}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        {!checked ? <button type="button" disabled={tray.length > 0} onClick={() => setChecked(true)} className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-[12.5px] font-extrabold text-white disabled:opacity-40">Check answers</button>
          : <><span className="text-[13px] font-extrabold" style={{ color: correct === b.items.length ? "#0f7a43" : "#b45309" }}>{correct} / {b.items.length} correct</span><button type="button" onClick={() => { setChecked(false); setPlaced(Object.fromEntries(b.items.map((_, i) => [i, null]))); }} className="rounded-full border border-[var(--line)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)]">Try again</button></>}
      </div>
    </ActWrap>
  );
}

// Drag to put the steps in the right order
function OrderBlock({ b, onDone }: { b: Extract<Block, { k: "order" }>; onDone?: () => void }) {
  const [order, setOrder] = useState<number[]>(() => { let s = shuffle(b.items.map((_, i) => i)); if (JSON.stringify(s) === JSON.stringify(b.items.map((_, i) => i)) && b.items.length > 1) s = shuffle(s); return s; });
  const [checked, setChecked] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);
  useEffect(() => { if (checked) onDone?.(); }, [checked]); // eslint-disable-line react-hooks/exhaustive-deps
  const move = (from: number, to: number) => { if (checked || from === to) return; setOrder((o) => { const a = [...o]; const [x] = a.splice(from, 1); a.splice(to, 0, x); return a; }); };
  const right = order.filter((v, pos) => v === pos).length;
  return (
    <ActWrap tag="Put in the correct order">
      <p className="mb-3 text-[14px] font-semibold text-[var(--ink)]">{b.prompt}</p>
      <div className="flex flex-col gap-2">
        {order.map((itemIdx, pos) => (
          <div key={itemIdx} draggable={!checked} onDragStart={() => setDrag(pos)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag != null) { move(drag, pos); setDrag(null); } }} className={"flex items-center gap-3 rounded-xl border px-3 py-2.5 " + (checked ? (itemIdx === pos ? "border-[#0f9d58] bg-[#eaf8f0]" : "border-[#c0392b] bg-[#fdecec]") : "cursor-grab border-[var(--line)] bg-white")}>
            <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-[var(--accent)] text-[11px] font-extrabold text-white">{pos + 1}</span>
            <span className="flex-1 text-[13.5px] font-semibold text-[var(--ink)]">{b.items[itemIdx]}</span>
            {checked ? <span>{itemIdx === pos ? "✓" : "✗"}</span> : <span className="text-[var(--ink-3)]">⠿</span>}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        {!checked ? <button type="button" onClick={() => setChecked(true)} className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-[12.5px] font-extrabold text-white">Check order</button>
          : <><span className="text-[13px] font-extrabold" style={{ color: right === b.items.length ? "#0f7a43" : "#b45309" }}>{right} / {b.items.length} in place</span><button type="button" onClick={() => { setChecked(false); setOrder(shuffle(b.items.map((_, i) => i))); }} className="rounded-full border border-[var(--line)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)]">Shuffle & retry</button></>}
      </div>
    </ActWrap>
  );
}

// Tap a term, then its match
function MatchBlock({ b, onDone }: { b: Extract<Block, { k: "match" }>; onDone?: () => void }) {
  const [rights] = useState(() => shuffle(b.pairs.map((_, i) => i)));
  const [sel, setSel] = useState<number | null>(null);
  const [links, setLinks] = useState<Record<number, number>>({}); // left index -> right pair index
  const done = Object.keys(links).length === b.pairs.length;
  useEffect(() => { if (done) onDone?.(); }, [done]); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (li: number) => { if (links[li] != null) return; setSel(sel === li ? null : li); };
  const connect = (ri: number) => { if (sel == null || Object.values(links).includes(ri)) return; setLinks((l) => ({ ...l, [sel]: ri })); setSel(null); };
  return (
    <ActWrap tag="Match the pairs">
      <p className="mb-3 text-[14px] font-semibold text-[var(--ink)]">{b.prompt}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">{b.pairs.map((p, li) => { const linked = links[li] != null; const ok = linked && links[li] === li; return (
          <button key={li} type="button" onClick={() => pick(li)} className={"rounded-xl border-2 px-3 py-2 text-left text-[13px] font-semibold transition-colors " + (linked ? (ok ? "border-[#0f9d58] bg-[#eaf8f0]" : "border-[#c0392b] bg-[#fdecec]") : sel === li ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--line)] bg-white")}>{p.l}{linked && (ok ? " ✓" : " ✗")}</button>
        ); })}</div>
        <div className="flex flex-col gap-2">{rights.map((ri) => { const used = Object.values(links).includes(ri); return (
          <button key={ri} type="button" disabled={used} onClick={() => connect(ri)} className={"rounded-xl border-2 px-3 py-2 text-left text-[13px] font-semibold transition-colors " + (used ? "border-[var(--line)] bg-[var(--panel)] opacity-45" : "border-[var(--line)] bg-white hover:border-[var(--accent)]")}>{b.pairs[ri].r}</button>
        ); })}</div>
      </div>
      {done && <button type="button" onClick={() => { setLinks({}); setSel(null); }} className="mt-3 rounded-full border border-[var(--line)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)]">Reset</button>}
    </ActWrap>
  );
}

// Flip cards
function RevealBlock({ b, onDone }: { b: Extract<Block, { k: "reveal" }>; onDone?: () => void }) {
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});
  const allFlipped = b.cards.every((_, i) => flipped[i]);
  useEffect(() => { if (allFlipped) onDone?.(); }, [allFlipped]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <ActWrap tag="Tap each card to reveal">
      {b.prompt && <p className="mb-3 text-[14px] font-semibold text-[var(--ink)]">{b.prompt}</p>}
      <div className="grid gap-2.5 sm:grid-cols-2">
        {b.cards.map((c, i) => (
          <button key={i} type="button" onClick={() => setFlipped((f) => ({ ...f, [i]: !f[i] }))} style={flipped[i] ? undefined : { background: "var(--accent-grad)" }} className={"min-h-[76px] rounded-xl border-2 px-3.5 py-3 text-left transition-colors " + (flipped[i] ? "border-[var(--accent)] bg-white" : "border-transparent text-white")}>
            {flipped[i] ? <div className="text-[13px] leading-snug text-[var(--ink-2)]"><div className="mb-1 text-[12.5px] font-extrabold text-[var(--ink)]">{c.front}</div>{c.back}</div> : <div className="flex h-full items-center gap-2 text-[14px] font-extrabold">🔎 {c.front}</div>}
          </button>
        ))}
      </div>
    </ActWrap>
  );
}

function videoEmbed(src: string): string | null {
  const yt = src.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = src.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}
export function BlockView({ b, onDone }: { b: Block; onDone?: () => void }) {
  if (b.k === "text") return <p className="my-3 text-[15px] leading-[1.75] text-[var(--ink-2)]">{b.t}</p>;
  if (b.k === "art") return <Scene art={b.art} caption={b.caption} />;
  if (b.k === "points") return (
    <div className="my-3">{b.title && <div className="mb-1.5 text-[13px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{b.title}</div>}
      <ul className="flex flex-col gap-1.5">{b.items.map((it, i) => <li key={i} className="flex gap-2.5 text-[14.5px] leading-[1.6] text-[var(--ink-2)]"><span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-[var(--accent)]" />{it}</li>)}</ul></div>
  );
  if (b.k === "callout") { const c = CALLOUT[b.tone]; return (
    <div className="my-4 rounded-r-xl p-3.5 pl-4" style={{ background: c.bg, borderLeft: `4px solid ${c.bar}` }}>
      <div className="mb-0.5 flex items-center gap-2 text-[13.5px] font-extrabold" style={{ color: c.ink }}>{c.icon} {b.title}</div>
      <p className="text-[13.5px] leading-[1.6] text-[var(--ink-2)]">{b.t}</p></div>
  ); }
  if (b.k === "steps") return (
    <div className="my-4">{b.title && <div className="mb-2 text-[13px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{b.title}</div>}
      <ol className="flex flex-col gap-2.5">{b.items.map((it, i) => (
        <li key={i} className="flex gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
          <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-[var(--accent)] text-[13px] font-extrabold text-white">{i + 1}</span>
          <div><div className="text-[14px] font-extrabold text-[var(--ink)]">{it.h}</div><div className="text-[13.5px] leading-[1.55] text-[var(--ink-2)]">{it.t}</div></div>
        </li>))}</ol></div>
  );
  if (b.k === "stat") return (
    <div className="my-4 inline-flex items-baseline gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-5 py-3">
      <span className="text-[34px] font-extrabold leading-none tracking-tight text-[var(--accent)]">{b.value}</span><span className="text-[13px] font-semibold text-[var(--ink-3)]">{b.label}</span></div>
  );
  if (b.k === "quote") return (
    <blockquote className="my-4 rounded-r-xl border-l-4 border-[#c084fc] bg-[#f7f2ff] p-4 text-[15px] italic leading-relaxed text-[var(--ink)]">“{b.t.replace(/^[“"]|[”"]$/g, "")}”{b.by && <footer className="mt-1.5 text-[12.5px] not-italic font-semibold text-[var(--ink-3)]">— {b.by}</footer>}</blockquote>
  );
  if (b.k === "table") return (
    <div className="my-4 overflow-x-auto rounded-xl border border-[var(--line)]"><table className="w-full text-[13.5px]">
      <thead><tr className="bg-[var(--panel)] text-left">{b.head.map((h, i) => <th key={i} className="px-3 py-2.5 font-extrabold text-[var(--ink)]">{h}</th>)}</tr></thead>
      <tbody>{b.rows.map((r, i) => <tr key={i} className="border-t border-[var(--line-2,#eef2f8)]">{r.map((c, j) => <td key={j} className="px-3 py-2.5 align-top leading-[1.5] text-[var(--ink-2)]">{c}</td>)}</tr>)}</tbody></table></div>
  );
  if (b.k === "image") return (
    <figure className="my-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={b.src} alt={b.caption || "Course image"} className="mx-auto max-h-[440px] w-full rounded-2xl border border-[var(--line)] object-cover" />
      {b.caption && <figcaption className="mt-2 text-center text-[12.5px] italic text-[var(--ink-3)]">{b.caption}</figcaption>}
    </figure>
  );
  if (b.k === "video") {
    const embed = videoEmbed(b.src);
    return (
      <figure className="my-4">
        {embed ? <div className="relative overflow-hidden rounded-2xl border border-[var(--line)]" style={{ paddingTop: "56.25%" }}><iframe src={embed} title={b.caption || "Video"} className="absolute inset-0 h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /></div>
          : <video src={b.src} controls className="w-full rounded-2xl border border-[var(--line)]" />}
        {b.caption && <figcaption className="mt-2 text-center text-[12.5px] italic text-[var(--ink-3)]">{b.caption}</figcaption>}
      </figure>
    );
  }
  if (b.k === "scenario") return <ScenarioBlock b={b} onDone={onDone} />;
  if (b.k === "check") return <CheckBlock b={b} onDone={onDone} />;
  if (b.k === "sort") return <SortBlock b={b} onDone={onDone} />;
  if (b.k === "order") return <OrderBlock b={b} onDone={onDone} />;
  if (b.k === "match") return <MatchBlock b={b} onDone={onDone} />;
  if (b.k === "reveal") return <RevealBlock b={b} onDone={onDone} />;
  return null;
}

// Certificates now live in ./certificates.ts (10 selectable templates). CoursePlayer
// builds a CertData from the course + provider settings and calls openCertificate.

// ——— final quiz (~10 min) ———
function QuizRunner({ qs, pass, versionLabel, courseTitle, onPass, makeCert }: { qs: QuizQ[]; pass: number; versionLabel: string; courseTitle: string; onPass: () => void; makeCert: (name: string, pct: number) => void }) {
  const [ans, setAns] = useState<Record<number, number>>({});
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const score = qs.filter((q, i) => ans[i] === q.a).length;
  const pctScore = qs.length ? Math.round((score / qs.length) * 100) : 0;
  const passed = pctScore >= pass;
  const submit = () => { setSubmitted(true); if (pctScore >= pass) onPass(); if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" }); };
  return (
    <article className="mx-auto max-w-[720px] px-5 py-7 sm:px-8">
      <div className="mb-1 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#6d28d9]">Final assessment <span className="rounded-full bg-[#f3effe] px-2 py-0.5 text-[10px] normal-case tracking-normal text-[#6d28d9]">{versionLabel}</span></div>
      <h1 className="mb-1 text-[26px] font-extrabold tracking-tight text-[var(--ink)]">Course quiz</h1>
      <p className="mb-5 text-[13.5px] text-[var(--ink-3)]">{qs.length} questions · pass mark {pass}% · about 10 minutes. Answer every question, then submit.</p>
      {submitted && (
        <div className={"mb-5 rounded-2xl border p-4 " + (passed ? "border-[#bfe3cd] bg-[#eef8f1]" : "border-[#f3c9cd] bg-[#fdecec]")}>
          <div className="text-[17px] font-extrabold" style={{ color: passed ? "#0f7a43" : "#c0392b" }}>{passed ? "🎉 Passed" : "Not passed yet"} — {pctScore}% ({score}/{qs.length})</div>
          {passed ? (
            <div className="mt-1">
              <div className="text-[13px] text-[var(--ink-2)]">Well done. Add your name and download your completion certificate.</div>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="rounded-lg border border-[var(--line)] bg-white px-3 py-1.5 text-[13px] text-[var(--ink)] outline-none focus:border-[#1d3a8f]" />
                <button type="button" onClick={() => makeCert(name, pctScore)} className="rounded-full bg-[#1d3a8f] px-4 py-1.5 text-[13px] font-extrabold text-white hover:brightness-110">🖨️ Download certificate (PDF)</button>
              </div>
            </div>
          ) : <div className="text-[13px] text-[var(--ink-2)]">{`You need ${pass}% to pass. Review the answers below and try again.`}</div>}
        </div>
      )}
      <div className="flex flex-col gap-4">
        {qs.map((q, i) => (
          <div key={i} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
            <div className="mb-2.5 flex gap-2 text-[14.5px] font-semibold text-[var(--ink)]"><span className="text-[#6d28d9]">{i + 1}.</span>{q.q}</div>
            <div className="flex flex-col gap-2">
              {q.opts.map((o, oi) => {
                const sel = ans[i] === oi;
                const tone = !submitted ? (sel ? "border-[#6d28d9] bg-[#efe9ff]" : "border-[var(--line)] bg-white hover:border-[#6d28d9]") : oi === q.a ? "border-[#0f9d58] bg-[#eaf8f0]" : sel ? "border-[#c0392b] bg-[#fdecec]" : "border-[var(--line)] bg-white opacity-70";
                return <button key={oi} type="button" disabled={submitted} onClick={() => setAns((a) => ({ ...a, [i]: oi }))} className={"rounded-xl border-2 px-3.5 py-2 text-left text-[13.5px] font-semibold text-[var(--ink)] transition-colors " + tone}><span className="mr-1.5">{submitted ? (oi === q.a ? "✅" : sel ? "❌" : "○") : sel ? "●" : "○"}</span>{o}</button>;
              })}
            </div>
            {submitted && q.fb && <p className="mt-2 text-[12.5px] font-semibold" style={{ color: ans[i] === q.a ? "#0f7a43" : "#c0392b" }}>{q.fb}</p>}
          </div>
        ))}
      </div>
      <div className="mt-5 border-t border-[var(--line)] pt-4">
        {!submitted ? <button type="button" disabled={Object.keys(ans).length < qs.length} onClick={submit} className="rounded-full bg-[#6d28d9] px-6 py-2.5 text-[14px] font-extrabold text-white disabled:opacity-40">{Object.keys(ans).length < qs.length ? `Answer all ${qs.length} to submit` : "Submit quiz"}</button>
          : !passed ? <button type="button" onClick={() => { setSubmitted(false); setAns({}); }} className="rounded-full bg-[#6d28d9] px-6 py-2.5 text-[14px] font-extrabold text-white">Try again</button> : null}
      </div>
    </article>
  );
}

export function CoursePlayer({ course, onClose }: { course: CourseDoc; onClose: () => void }) {
  const lessons = useMemo(() => course.lessons.filter((l) => !l.hidden), [course]); // hidden lessons are kept in data but skipped for learners
  const activeQuiz = useMemo(() => activeQuizVersion(course), [course]);
  const hasQuiz = activeQuiz.qs.length > 0;
  const quizIdx = lessons.length;
  const total = lessons.length + (hasQuiz ? 1 : 0);
  const [li, setLi] = useState(0);
  const [done, setDone] = useState<Set<number>>(new Set());
  const voice = useVoice();
  const { settings } = useSettings();
  const makeCert = (name: string, pct: number) => {
    const now = new Date();
    const rm = course.renewMonths ?? settings.learning?.renewMonths ?? 0;
    const exp = rm ? new Date(now.getFullYear(), now.getMonth() + rm, now.getDate()) : null;
    const fmt = (dt: Date) => dt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    openCertificate({
      name: name || "Team member", course: course.title, pct, date: fmt(now), expiry: exp ? fmt(exp) : undefined,
      provider: settings.providerName || settings.billing?.businessName || "Your organisation",
      logo: settings.learning?.certLogo === false ? undefined : course.logo,
      ref: makeRef(course.title + name + fmt(now)),
      signImg: settings.learning?.certSignature, signName: settings.learning?.certSignatory, signRole: settings.learning?.certSignatoryRole,
      accent: settings.learning?.certColor, title: settings.learning?.certTitle || undefined, showScore: settings.learning?.certShowScore, showQr: settings.learning?.certShowQr,
    }, settings.learning?.certTemplate);
  };
  const isQuiz = li >= lessons.length;
  const lesson = lessons[li];
  const pct = Math.round((done.size / total) * 100);
  const readText = useMemo(() => (lesson ? speakText(lesson.blocks) : ""), [lesson]);

  // ——— gate lesson completion behind the interactive activities ———
  const interactiveIdx = useMemo(
    () => (lesson ? lesson.blocks.map((b, i) => [b, i] as const).filter(([b]) => INTERACTIVE_KINDS.includes(b.k)).map(([, i]) => i) : []),
    [lesson],
  );
  const [engaged, setEngaged] = useState<Set<number>>(new Set());
  useEffect(() => { setEngaged(new Set()); }, [li]);
  const remaining = interactiveIdx.filter((i) => !engaged.has(i)).length;
  const canComplete = done.has(li) || remaining === 0;

  useEffect(() => { voice.stop(); voice.setOn(false); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [li]);
  useEffect(() => () => voice.stop(), []); // eslint-disable-line react-hooks/exhaustive-deps

  // persist progress so the catalogue can show it
  useEffect(() => {
    try {
      const k = "aos.learn.progress.v1";
      const m = JSON.parse(localStorage.getItem(k) || "{}");
      const pct = total ? Math.round((done.size / total) * 100) : 0;
      m[course.id] = { pct, passed: done.has(quizIdx) || m[course.id]?.passed || false };
      localStorage.setItem(k, JSON.stringify(m));
    } catch { /* ignore */ }
  }, [done, total, quizIdx, course.id]);

  const toggleVoice = () => { if (voice.on || voice.speaking) { voice.stop(); voice.setOn(false); } else { voice.setOn(true); voice.speak(readText); } };
  const complete = () => { if (!canComplete) return; const n = new Set(done); n.add(li); setDone(n); if (li < lessons.length - 1) setLi(li + 1); else if (hasQuiz) setLi(quizIdx); };
  const pal = coursePaletteOf(course.theme);
  // --art-grad recolours illustration scenes to the palette, but ONLY when the
  // course has explicitly chosen a theme — platform courses (no theme) keep their
  // meaningful per-topic illustration colours.
  const themeVars = { "--accent": pal.accent, "--accent-2": pal.accent2, "--accent-soft": pal.soft, "--accent-grad": pal.grad, ...(course.theme ? { "--art-grad": pal.grad } : {}) } as React.CSSProperties;

  return (
    <div className="fixed inset-0 z-[140] flex flex-col bg-[#f5f8fd]" style={{ ...LIGHT_PALETTE, ...themeVars }}>
      {/* top bar */}
      <div className="flex flex-none items-center gap-3 border-b border-[var(--line)] bg-white px-4 py-2.5 sm:px-6">
        <button type="button" onClick={onClose} className="rounded-full border border-[var(--line)] px-3 py-1.5 text-[13px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">‹ Exit</button>
        {course.logo && /* eslint-disable-next-line @next/next/no-img-element */ <img src={course.logo} alt="" className="h-8 w-auto flex-none rounded object-contain" />}
        <div className="min-w-0"><div className="truncate text-[14px] font-extrabold text-[var(--ink)]">{course.title}</div><div className="text-[11px] text-[var(--ink-3)]">{isQuiz ? "Final quiz" : `Lesson ${li + 1} of ${lessons.length} · ${lesson.mins} min read`}</div></div>
        {!isQuiz && <button type="button" onClick={toggleVoice} title="Read this lesson aloud" aria-label={voice.speaking ? "Stop reading this lesson aloud" : "Read this lesson aloud"} aria-pressed={voice.speaking} className={"ml-auto inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-extrabold transition-colors " + (voice.speaking ? "bg-[var(--accent)] text-white" : "border border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]")}>{voice.speaking ? "⏹ Stop voice" : "🔊 Read aloud"}{voice.speaking && <span className="flex items-end gap-0.5">{[0, 1, 2].map((i) => <span key={i} className="w-[3px] animate-pulse rounded-full bg-white" style={{ height: 6 + i * 4, animationDelay: `${i * 120}ms` }} />)}</span>}</button>}
      </div>
      {/* progress */}
      <div className="h-1 flex-none bg-[var(--line)]"><div className="h-full bg-[#0f9d58] transition-all" style={{ width: `${pct}%` }} /></div>

      <div className="flex min-h-0 flex-1">
        {/* lesson rail */}
        <aside className="hidden w-[248px] flex-none overflow-y-auto border-r border-[var(--line)] bg-white p-3 md:block">
          {lessons.map((ls, i) => (
            <button key={ls.id} type="button" onClick={() => setLi(i)} className={"mb-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors " + (i === li ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--panel)]")}>
              <span className={"grid h-6 w-6 flex-none place-items-center rounded-full text-[11px] font-extrabold " + (done.has(i) ? "bg-[#0f9d58] text-white" : i === li ? "bg-[var(--accent)] text-white" : "bg-[var(--panel)] text-[var(--ink-3)]")}>{done.has(i) ? "✓" : i + 1}</span>
              <span className={"text-[12.5px] font-bold " + (i === li ? "text-[var(--accent)]" : "text-[var(--ink-2)]")}>{ls.title}</span>
            </button>
          ))}
          {hasQuiz && (
            <button type="button" onClick={() => setLi(quizIdx)} className={"mt-1 flex w-full items-center gap-2.5 rounded-xl border-t border-[var(--line-2,#eef2f8)] px-3 py-2.5 pt-3 text-left transition-colors " + (isQuiz ? "bg-[#f3effe]" : "hover:bg-[var(--panel)]")}>
              <span className={"grid h-6 w-6 flex-none place-items-center rounded-full text-[11px] " + (done.has(quizIdx) ? "bg-[#0f9d58] text-white" : "bg-[#6d28d9] text-white")}>{done.has(quizIdx) ? "✓" : "🎓"}</span>
              <span className={"text-[12.5px] font-bold " + (isQuiz ? "text-[#6d28d9]" : "text-[var(--ink-2)]")}>Final quiz</span>
            </button>
          )}
        </aside>
        {/* content */}
        <main className="min-w-0 flex-1 overflow-y-auto">
          {isQuiz ? <QuizRunner qs={activeQuiz.qs} pass={course.pass ?? 80} versionLabel={`${QUIZ_VERSION_LABELS[activeQuiz.idx]} of ${activeQuiz.count}`} courseTitle={course.title} onPass={() => setDone((d) => new Set(d).add(quizIdx))} makeCert={makeCert} /> : (
          <article className="mx-auto max-w-[720px] px-5 py-7 sm:px-8">
            {course.theme
              ? <CourseBanner pal={pal} styleId="bubbles" subtitle={course.cat} title={course.title} className="mb-5 rounded-2xl" contentClassName="px-5 py-6 sm:px-6" />
              : <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.1em] text-[var(--accent)]">{course.cat} · {course.title}</div>}
            <h1 className="mb-4 text-[26px] font-extrabold leading-tight tracking-tight text-[var(--ink)]">{lesson.title}</h1>
            {lesson.blocks.map((b, i) => <BlockView key={i} b={b} onDone={() => setEngaged((s) => (s.has(i) ? s : new Set(s).add(i)))} />)}
            <div className="mt-8 border-t border-[var(--line)] pt-5">
              {interactiveIdx.length > 0 && !done.has(li) && remaining > 0 && (
                <p className="mb-3 flex items-center gap-2 rounded-xl bg-[#fdf0e6] px-3.5 py-2.5 text-[12.5px] font-semibold text-[#a8560f]">✋ Complete the {remaining} interactive {remaining === 1 ? "activity" : "activities"} above before you can mark this page complete.</p>
              )}
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setLi(Math.max(0, li - 1))} disabled={li === 0} className="rounded-full border border-[var(--line)] px-4 py-2 text-[13px] font-bold text-[var(--ink-2)] disabled:opacity-40">‹ Previous</button>
                <button type="button" onClick={complete} disabled={!canComplete} title={canComplete ? "" : "Finish the interactive activities first"} className={"ml-auto rounded-full px-6 py-2 text-[14px] font-extrabold text-white transition-all " + (canComplete ? "bg-[#0f7a43] hover:brightness-105" : "cursor-not-allowed bg-[var(--ink-3)] opacity-50")}>{li < lessons.length - 1 ? "Mark complete & continue ›" : hasQuiz ? "Take the final quiz ›" : done.has(li) ? "Finish ✓" : "Mark complete ✓"}</button>
              </div>
            </div>
          </article>
          )}
        </main>
      </div>
    </div>
  );
}
