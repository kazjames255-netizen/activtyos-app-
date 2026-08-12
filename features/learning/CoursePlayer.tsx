"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LIGHT_PALETTE } from "@/components/OperatorPage";
import type { Block, CourseDoc } from "./courseContent";

// ——— Illustrated scene panels ("visuals that mimic real life") ———
const ART: Record<string, { grad: string; emoji: string; motif: "people" | "phone" | "cross" | "doc" | "flame" | "shield" }> = {
  shield: { grad: "linear-gradient(135deg,#1d3a8f,#3f7ae0)", emoji: "🛡️", motif: "shield" },
  listen: { grad: "linear-gradient(135deg,#0e7d74,#22b4a6)", emoji: "🧑‍🤝‍🧒", motif: "people" },
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
};
export const ART_KEYS = ["shield", "listen", "county", "recruit", "prevent", "epipen", "online", "behaviour", "data", "firstaid", "fire", "autism", "adhd", "mind", "cse", "fgm", "domestic", "food"];
function Scene({ art, caption }: { art: string; caption?: string }) {
  const a = ART[art] ?? ART.shield;
  return (
    <figure className="my-4">
      <div className="relative overflow-hidden rounded-2xl p-7 text-white shadow-[0_18px_40px_-24px_rgba(16,32,90,.6)]" style={{ background: a.grad }}>
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-25" preserveAspectRatio="none" viewBox="0 0 400 160" aria-hidden>
          <circle cx="330" cy="20" r="70" fill="#fff" opacity="0.14" />
          <circle cx="360" cy="120" r="46" fill="#fff" opacity="0.1" />
          <path d="M0 130 Q100 90 200 120 T400 110 V160 H0 Z" fill="#fff" opacity="0.08" />
        </svg>
        <div className="relative flex items-center gap-5">
          <div className="grid h-20 w-20 flex-none place-items-center rounded-2xl bg-white/15 text-[42px] backdrop-blur">{a.emoji}</div>
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => <span key={i} className="h-2.5 w-2.5 rounded-full bg-white/50" style={{ opacity: 1 - i * 0.28 }} />)}
          </div>
        </div>
      </div>
      {caption && <figcaption className="mt-2 text-center text-[12.5px] italic text-[var(--ink-3)]">{caption}</figcaption>}
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
function ScenarioBlock({ b }: { b: Extract<Block, { k: "scenario" }> }) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div className="my-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-[#eef4fd] px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-[#1d3a8f]">🎬 Real-life scenario</div>
      <p className="mb-3 text-[14.5px] font-semibold text-[var(--ink)]">{b.t}</p>
      <div className="flex flex-col gap-2">
        {b.choices.map((c, i) => {
          const sel = picked === i;
          const tone = picked == null ? "border-[var(--line)] hover:border-[#1d3a8f]" : c.ok ? "border-[#0f9d58] bg-[#eaf8f0]" : sel ? "border-[#c0392b] bg-[#fdecec]" : "border-[var(--line)] opacity-70";
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
function CheckBlock({ b }: { b: Extract<Block, { k: "check" }> }) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div className="my-4 rounded-2xl border border-[#bcd0f5] bg-[#f6f9ff] p-4">
      <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-[#1d3a8f]">✓ Knowledge check</div>
      <p className="mb-3 text-[14.5px] font-semibold text-[var(--ink)]">{b.q}</p>
      <div className="flex flex-col gap-2">
        {b.opts.map((o, i) => {
          const sel = picked === i;
          const tone = picked == null ? "border-[var(--line)] bg-white hover:border-[#1d3a8f]" : i === b.a ? "border-[#0f9d58] bg-[#eaf8f0]" : sel ? "border-[#c0392b] bg-[#fdecec]" : "border-[var(--line)] bg-white opacity-70";
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

function BlockView({ b }: { b: Block }) {
  if (b.k === "text") return <p className="my-3 text-[15px] leading-[1.75] text-[var(--ink-2)]">{b.t}</p>;
  if (b.k === "art") return <Scene art={b.art} caption={b.caption} />;
  if (b.k === "points") return (
    <div className="my-3">{b.title && <div className="mb-1.5 text-[13px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{b.title}</div>}
      <ul className="flex flex-col gap-1.5">{b.items.map((it, i) => <li key={i} className="flex gap-2.5 text-[14.5px] leading-[1.6] text-[var(--ink-2)]"><span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-[#1d3a8f]" />{it}</li>)}</ul></div>
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
          <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-[#1d3a8f] text-[13px] font-extrabold text-white">{i + 1}</span>
          <div><div className="text-[14px] font-extrabold text-[var(--ink)]">{it.h}</div><div className="text-[13.5px] leading-[1.55] text-[var(--ink-2)]">{it.t}</div></div>
        </li>))}</ol></div>
  );
  if (b.k === "stat") return (
    <div className="my-4 inline-flex items-baseline gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-5 py-3">
      <span className="text-[34px] font-extrabold leading-none tracking-tight text-[#1d3a8f]">{b.value}</span><span className="text-[13px] font-semibold text-[var(--ink-3)]">{b.label}</span></div>
  );
  if (b.k === "quote") return (
    <blockquote className="my-4 rounded-r-xl border-l-4 border-[#c084fc] bg-[#f7f2ff] p-4 text-[15px] italic leading-relaxed text-[var(--ink)]">“{b.t.replace(/^[“"]|[”"]$/g, "")}”{b.by && <footer className="mt-1.5 text-[12.5px] not-italic font-semibold text-[var(--ink-3)]">— {b.by}</footer>}</blockquote>
  );
  if (b.k === "table") return (
    <div className="my-4 overflow-x-auto rounded-xl border border-[var(--line)]"><table className="w-full text-[13.5px]">
      <thead><tr className="bg-[var(--panel)] text-left">{b.head.map((h, i) => <th key={i} className="px-3 py-2.5 font-extrabold text-[var(--ink)]">{h}</th>)}</tr></thead>
      <tbody>{b.rows.map((r, i) => <tr key={i} className="border-t border-[var(--line-2,#eef2f8)]">{r.map((c, j) => <td key={j} className="px-3 py-2.5 align-top leading-[1.5] text-[var(--ink-2)]">{c}</td>)}</tr>)}</tbody></table></div>
  );
  if (b.k === "scenario") return <ScenarioBlock b={b} />;
  if (b.k === "check") return <CheckBlock b={b} />;
  return null;
}

export function CoursePlayer({ course, onClose }: { course: CourseDoc; onClose: () => void }) {
  const [li, setLi] = useState(0);
  const [done, setDone] = useState<Set<number>>(new Set());
  const voice = useVoice();
  const lesson = course.lessons[li];
  const pct = Math.round((done.size / course.lessons.length) * 100);
  const readText = useMemo(() => speakText(lesson.blocks), [lesson]);

  useEffect(() => { voice.stop(); voice.setOn(false); /* stop voice when lesson changes */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [li]);
  useEffect(() => () => voice.stop(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleVoice = () => { if (voice.on || voice.speaking) { voice.stop(); voice.setOn(false); } else { voice.setOn(true); voice.speak(readText); } };
  const complete = () => { const n = new Set(done); n.add(li); setDone(n); if (li < course.lessons.length - 1) setLi(li + 1); };

  return (
    <div className="fixed inset-0 z-[140] flex flex-col bg-[#f5f8fd]" style={LIGHT_PALETTE}>
      {/* top bar */}
      <div className="flex flex-none items-center gap-3 border-b border-[var(--line)] bg-white px-4 py-2.5 sm:px-6">
        <button type="button" onClick={onClose} className="rounded-full border border-[var(--line)] px-3 py-1.5 text-[13px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">‹ Exit</button>
        <div className="min-w-0"><div className="truncate text-[14px] font-extrabold text-[var(--ink)]">{course.title}</div><div className="text-[11px] text-[var(--ink-3)]">Lesson {li + 1} of {course.lessons.length} · {lesson.mins} min read</div></div>
        <button type="button" onClick={toggleVoice} title="Read this lesson aloud" className={"ml-auto inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-extrabold transition-colors " + (voice.speaking ? "bg-[#1d3a8f] text-white" : "border border-[#bcd0f5] bg-[#eef4fd] text-[#1d3a8f]")}>{voice.speaking ? "⏹ Stop voice" : "🔊 Read aloud"}{voice.speaking && <span className="flex items-end gap-0.5">{[0, 1, 2].map((i) => <span key={i} className="w-[3px] animate-pulse rounded-full bg-white" style={{ height: 6 + i * 4, animationDelay: `${i * 120}ms` }} />)}</span>}</button>
      </div>
      {/* progress */}
      <div className="h-1 flex-none bg-[var(--line)]"><div className="h-full bg-[#0f9d58] transition-all" style={{ width: `${pct}%` }} /></div>

      <div className="flex min-h-0 flex-1">
        {/* lesson rail */}
        <aside className="hidden w-[248px] flex-none overflow-y-auto border-r border-[var(--line)] bg-white p-3 md:block">
          {course.lessons.map((ls, i) => (
            <button key={ls.id} type="button" onClick={() => setLi(i)} className={"mb-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors " + (i === li ? "bg-[#eef4fd]" : "hover:bg-[var(--panel)]")}>
              <span className={"grid h-6 w-6 flex-none place-items-center rounded-full text-[11px] font-extrabold " + (done.has(i) ? "bg-[#0f9d58] text-white" : i === li ? "bg-[#1d3a8f] text-white" : "bg-[var(--panel)] text-[var(--ink-3)]")}>{done.has(i) ? "✓" : i + 1}</span>
              <span className={"text-[12.5px] font-bold " + (i === li ? "text-[#1d3a8f]" : "text-[var(--ink-2)]")}>{ls.title}</span>
            </button>
          ))}
        </aside>
        {/* content */}
        <main className="min-w-0 flex-1 overflow-y-auto">
          <article className="mx-auto max-w-[720px] px-5 py-7 sm:px-8">
            <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#1d3a8f]">{course.cat} · {course.title}</div>
            <h1 className="mb-4 text-[26px] font-extrabold leading-tight tracking-tight text-[var(--ink)]">{lesson.title}</h1>
            {lesson.blocks.map((b, i) => <BlockView key={i} b={b} />)}
            <div className="mt-8 flex items-center gap-3 border-t border-[var(--line)] pt-5">
              <button type="button" onClick={() => setLi(Math.max(0, li - 1))} disabled={li === 0} className="rounded-full border border-[var(--line)] px-4 py-2 text-[13px] font-bold text-[var(--ink-2)] disabled:opacity-40">‹ Previous</button>
              <button type="button" onClick={complete} className="ml-auto rounded-full bg-[#0f7a43] px-6 py-2 text-[14px] font-extrabold text-white hover:brightness-105">{li < course.lessons.length - 1 ? "Mark complete & continue ›" : done.has(li) ? "Finish ✓" : "Mark complete ✓"}</button>
            </div>
            {pct === 100 && <div className="mt-4 rounded-2xl border border-[#bfe3cd] bg-[#eef8f1] p-4 text-center"><div className="text-[15px] font-extrabold text-[#0f7a43]">🎉 Course complete</div><div className="text-[12.5px] text-[var(--ink-2)]">All lessons done — a completion certificate would be issued here.</div></div>}
          </article>
        </main>
      </div>
    </div>
  );
}
