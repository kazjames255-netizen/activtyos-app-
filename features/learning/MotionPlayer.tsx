"use client";

/*
 * MotionPlayer — an animated, video-like lesson.
 *
 * One requestAnimationFrame clock is the single source of truth for elapsed
 * time; the current scene and intra-scene progress (0..1) are derived from it,
 * so the film is deterministic and fully scrubbable. Narration is spoken with
 * the browser's SpeechSynthesis; in voice mode the VOICE paces the film — a
 * scene advances the instant its line finishes (no silent lag), and if a line
 * runs long the clock holds at the scene edge so audio is never clipped. Text
 * mode runs the exact same engine on the authored per-scene seconds.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MotionScene } from "./courseContent";
import { GENERIC_SCENES } from "./motionKit";

// the latest key word the narration has reached (charPos = char index read so far);
// defaults to the first key so a word shows immediately (no blank gap).
function keyAt(scene: MotionScene, charPos: number): string {
  const keys = scene.keys || [];
  if (!keys.length) return "";
  let shown = keys[0];
  for (const k of keys) { const at = scene.narration.indexOf(k); if (at >= 0 && at <= charPos) shown = k; }
  return shown;
}

// ————————————————————————————————————————————————————————————————
const FIELD_A = "#14265c", FIELD_B = "#2f6bd8";
const WARM = "#f6b352", WARM_D = "#e0973a";  // the child / the human at stake
const GOOD = "#34d399";                       // confirmation only
const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
const MIN_DWELL = 650;   // ms a scene must show before the voice may advance it

// Flat-illustration wardrobe (reads well on the indigo stage).
const CAST = [
  { top: "#4f8bf0", dark: "#3a6bc4", pants: "#26324f", skin: "#eab88f", hair: "#2f2016" },
  { top: "#2bb27a", dark: "#1f8f61", pants: "#2c3a58", skin: "#c68a5c", hair: "#141414" },
  { top: "#ef6b86", dark: "#cf556e", pants: "#3a2f4c", skin: "#f1c69c", hair: "#5a3a1f" },
  { top: "#9b6cf3", dark: "#7c4fd6", pants: "#2a3150", skin: "#a86b45", hair: "#1c1c1c" },
  { top: "#f2b03e", dark: "#d6952c", pants: "#5a4413", skin: "#e0a273", hair: "#3a2414" },
];
const CHILD = { top: WARM, dark: WARM_D, pants: "#6f4310", skin: "#eaa96f", hair: "#3a2415" };
const GREY = { top: "#8ea6d8", dark: "#7789bf", pants: "#5b6b8a", skin: "#b9c4de", hair: "#7f8db0" };

// ————————————————————————————————————————————————————————————————
// Narrator — the course voice, with a completion callback so the clock can pace
// itself to the speech.
function useNarrator() {
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const supported = () => typeof window !== "undefined" && !!window.speechSynthesis;
  useEffect(() => {
    if (!supported()) return;
    const pick = () => {
      const vs = window.speechSynthesis.getVoices();
      voiceRef.current =
        vs.find((v) => v.name === "Google UK English Female") ||
        vs.find((v) => /en-GB/i.test(v.lang) && /female|libby|hazel|susan|sonia/i.test(v.name)) ||
        vs.find((v) => /en-GB/i.test(v.lang)) || vs[0] || null;
    };
    pick();
    window.speechSynthesis.onvoiceschanged = pick;
    return () => { try { window.speechSynthesis.cancel(); } catch { /* ignore */ } };
  }, []);
  const speak = useCallback((text: string, onend?: () => void, onboundary?: (charIndex: number) => void) => {
    if (!supported() || !text) { onend?.(); return; }
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (voiceRef.current) u.voice = voiceRef.current;
      u.lang = "en-GB"; u.rate = 1.08; u.pitch = 1.02;
      u.onboundary = (e) => { if (e.charIndex != null) onboundary?.(e.charIndex + (e.charLength || 0)); };
      u.onend = () => onend?.();
      u.onerror = () => onend?.();
      window.speechSynthesis.speak(u);
    } catch { onend?.(); }
  }, []);
  const stop = useCallback(() => { try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } }, []);
  return { speak, stop, supported };
}

// ————————————————————————————————————————————————————————————————
// Illustration kit
const VW = 320, VH = 184;
function Person({ x, y, s = 1, o = 1, cast = CAST[0], lean = 0, hood = false }:
  { x: number; y: number; s?: number; o?: number; cast?: typeof CAST[number]; lean?: number; hood?: boolean }) {
  const c = cast;
  return (
    <g transform={`translate(${x} ${y}) scale(${s}) rotate(${lean})`} opacity={o} style={{ transition: "opacity .35s ease" }}>
      <ellipse cx={0} cy={3} rx={17} ry={4.5} fill="#020c26" opacity={0.22} />
      <rect x={-9} y={-24} width={7.6} height={27} rx={3.6} fill={c.pants} />
      <rect x={1.4} y={-24} width={7.6} height={27} rx={3.6} fill={c.pants} />
      <rect x={-15.6} y={-47} width={6.6} height={28} rx={3.2} fill={c.dark} />
      <rect x={9} y={-47} width={6.6} height={28} rx={3.2} fill={c.dark} />
      <path d="M-13 -49 Q0 -55 13 -49 L11.5 -21 Q0 -16 -11.5 -21 Z" fill={c.top} />
      <path d="M-13 -49 Q0 -55 13 -49 L12 -43 Q0 -48 -12 -43 Z" fill="#ffffff" opacity={0.16} />
      <rect x={-3} y={-55} width={6} height={7} rx={2} fill={c.skin} />
      <circle cx={0} cy={-62} r={9.2} fill={c.skin} />
      {hood
        ? <path d="M-12.5 -59 Q-14 -79 0 -79 Q14 -79 12.5 -59 Q6 -70 0 -70 Q-6 -70 -12.5 -59 Z" fill={c.top} />
        : <path d="M-9.6 -61 Q-10 -75 0 -75 Q10 -75 9.6 -61 Q4.6 -69 0 -69 Q-4.6 -69 -9.6 -61 Z" fill={c.hair} />}
    </g>
  );
}
const SHIELD_D = "M50 8 L84 21 V50 C84 71 68 84 50 90 C32 84 16 71 16 50 V21 Z";
function Shield({ x, y, size, draw, tick, gloss = true }: { x: number; y: number; size: number; draw: number; tick?: number; gloss?: boolean }) {
  const len = 320;
  return (
    <g transform={`translate(${x} ${y}) scale(${size / 100})`}>
      <path d={SHIELD_D} fill="url(#mp-shield)" opacity={easeOut(seg(draw, 0.05, 1))} />
      {gloss && <path d="M50 8 L84 21 V50 C84 60 78 68 68 74 L34 20 Z" fill="#ffffff" opacity={0.18 * easeOut(seg(draw, 0.4, 1))} />}
      <path d={SHIELD_D} fill="none" stroke="#ffffff" strokeWidth={3.6} strokeLinejoin="round" strokeLinecap="round"
        strokeDasharray={len} strokeDashoffset={len * (1 - easeOut(draw))} />
      {tick != null && (
        <path d="M36 51 L47 62 L67 38" fill="none" stroke={GOOD} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray={50} strokeDashoffset={50 * (1 - easeOut(tick))} />
      )}
    </g>
  );
}
const Floor = ({ o = 0.06 }: { o?: number }) => <ellipse cx={160} cy={156} rx={150} ry={20} fill="#ffffff" opacity={o} />;
interface SP { p: number; scene: MotionScene; reduced: boolean }

// ————————————————————————————————————————————————————————————————
// Scene renderers — keyed by scene.visual
const SCENES: Record<string, (sp: SP) => React.ReactNode> = {
  // 0. Intro — branded title card; the shield assembles.
  intro: ({ p, reduced }) => {
    const d = reduced ? 1 : easeOut(seg(p, 0.05, 0.7));
    const rays = reduced ? 1 : easeOut(seg(p, 0.5, 1));
    return (
      <g>
        {!reduced && [0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
          const r = (a * Math.PI) / 180;
          return <line key={a} x1={160 + 40 * Math.cos(r)} y1={78 + 40 * Math.sin(r)} x2={160 + (52 + rays * 22) * Math.cos(r)} y2={78 + (52 + rays * 22) * Math.sin(r)} stroke={WARM} strokeWidth={2} strokeLinecap="round" opacity={rays * 0.5} />;
        })}
        <g transform="translate(130 40)"><Shield x={0} y={0} size={76} draw={d} /></g>
      </g>
    );
  },
  // 1. Cold open — a busy sports hall drains to grey; one hooded child stays sharp.
  "cold-open": ({ p, reduced }) => {
    const drain = reduced ? 1 : easeOut(seg(p, 0.15, 0.75));
    const staff = [{ x: 42, c: 0 }, { x: 84, c: 2 }, { x: 232, c: 1 }, { x: 276, c: 3 }];
    return (
      <g>
        {/* hall — windows + wall bench */}
        {[54, 120, 200, 266].map((x) => <rect key={x} x={x - 20} y={26} width={40} height={30} rx={4} fill="#ffffff" opacity={0.07} />)}
        <line x1={16} y1={150} x2={304} y2={150} stroke="#ffffff" strokeOpacity={0.14} strokeWidth={2} />
        <Floor />
        {staff.map((m, i) => (
          <g key={m.x} transform={`translate(${reduced ? 0 : (1 - drain) * (i % 2 ? 9 : -9)} 0)`}>
            <Person x={m.x} y={150} s={0.92} o={0.9 - drain * 0.6} cast={GREY} />
          </g>
        ))}
        {/* the child by the doorway, spotlit and still */}
        <g style={{ transformOrigin: "160px 120px", animation: reduced ? undefined : "aos-breathe 3.6s ease-in-out infinite" }}>
          <ellipse cx={160} cy={92} rx={40} ry={54} fill="url(#mp-spot)" opacity={0.5 * drain} />
          <Person x={160} y={150} s={1.05} cast={CHILD} hood />
        </g>
      </g>
    );
  },
  // 2. Everyone — staff light up one by one, then link into a protective ring.
  everyone: ({ p, reduced }) => {
    const spots = [{ x: 54, c: 0 }, { x: 104, c: 2 }, { x: 216, c: 1 }, { x: 266, c: 3 }];
    const ring = reduced ? 1 : easeOut(seg(p, 0.55, 1));
    const R = 2 * Math.PI * 50;
    return (
      <g>
        <Floor />
        {spots.map((m, i) => {
          const on = reduced ? 1 : seg(p, 0.1 + i * 0.09, 0.32 + i * 0.09);
          return <Person key={m.x} x={m.x} y={150} s={0.95} o={0.35 + 0.65 * on} cast={CAST[m.c]} />;
        })}
        <Person x={160} y={150} s={1.06} cast={CHILD} hood />
        <circle cx={160} cy={112} r={50} fill="none" stroke={WARM} strokeWidth={3} opacity={0.9}
          strokeDasharray={R} strokeDashoffset={R * (1 - ring)} transform="rotate(-90 160 112)" />
      </g>
    );
  },
  // 3. Notice — signal cards pass through; a magnifier sweeps.
  notice: ({ p, reduced }) => {
    const cards = [
      { cap: "a mark you can't explain", draw: (o: number) => <path d="M-14 4 q14 -9 28 0" fill="none" stroke={WARM} strokeWidth={3.4} strokeLinecap="round" opacity={o} /> },
      { cap: "a flinch, a step back", draw: (o: number) => <g opacity={o}><path d="M-12 -6 l9 11 M-3 -6 l-9 11" stroke={WARM} strokeWidth={3.4} strokeLinecap="round" /></g> },
      { cap: "gone quiet", draw: (o: number) => <line x1={-14} y1={2} x2={14} y2={2} stroke={WARM} strokeWidth={3.4} strokeLinecap="round" opacity={o} /> },
    ];
    const idx = reduced ? 1 : Math.min(2, Math.floor(p * 3));
    const local = reduced ? 0.5 : (p * 3) % 1;
    const enter = easeOut(seg(local, 0, 0.35)), exit = easeOut(seg(local, 0.72, 1));
    const c = cards[idx];
    return (
      <g transform="translate(160 92)">
        <g transform={`translate(${(1 - enter) * 46 - exit * 46} 0)`} opacity={reduced ? 1 : enter * (1 - exit)}>
          <rect x={-62} y={-52} width={124} height={104} rx={14} fill="#12295e" stroke="#ffffff" strokeOpacity={0.14} />
          <g transform="translate(-6 34) scale(0.8)"><Person x={0} y={0} s={1} cast={CAST[idx + 1]} /></g>
          {c.draw(1)}
          <g transform="translate(38 -30)" style={{ transformOrigin: "center", animation: reduced ? undefined : "aos-mag 2.2s ease-in-out infinite" }}>
            <circle cx={0} cy={0} r={11} fill="#ffffff" opacity={0.08} />
            <circle cx={0} cy={0} r={11} fill="none" stroke={WARM} strokeWidth={3} />
            <line x1={8} y1={8} x2={16} y2={16} stroke={WARM} strokeWidth={3.4} strokeLinecap="round" />
          </g>
        </g>
        {[0, 1, 2].map((i) => <circle key={i} cx={-14 + i * 14} cy={64} r={3.2} fill={i === idx ? WARM : "#ffffff55"} />)}
      </g>
    );
  },
  // 4. Respond — the adult lowers to the child's height; the child speaks.
  respond: ({ p, reduced }) => {
    const kneel = easeOut(seg(p, 0.05, 0.5));
    const bub = easeOut(seg(p, 0.4, 0.95));
    return (
      <g>
        <Floor />
        <g transform={`translate(112 ${150 + kneel * 20})`}><Person x={0} y={0} s={1 - kneel * 0.16} cast={CAST[0]} lean={kneel * 7} /></g>
        <Person x={214} y={150} s={0.9} cast={CHILD} hood />
        <g transform="translate(214 78)" opacity={reduced ? 1 : bub} style={{ transformOrigin: "left bottom" }}>
          <g transform={`scale(${reduced ? 1 : 0.5 + bub * 0.5})`}>
            <rect x={-6} y={-22} width={70} height={36} rx={10} fill="#ffffff" />
            <path d="M0 12 l-3 14 l16 -12 Z" fill="#ffffff" />
            <line x1={8} y1={-8} x2={52} y2={-8} stroke={FIELD_B} strokeWidth={3.4} strokeLinecap="round" />
            <line x1={8} y1={1} x2={40} y2={1} stroke={`${FIELD_B}99`} strokeWidth={3.4} strokeLinecap="round" />
          </g>
        </g>
      </g>
    );
  },
  // 5. Never a secret — a crossed padlock resolves into a shield.
  "not-secret": ({ p, reduced }) => {
    const morph = easeOut(seg(p, 0.45, 1));
    const lockOp = reduced ? 0 : 1 - morph;
    return (
      <g transform="translate(160 88)">
        <g opacity={lockOp}>
          <rect x={-22} y={-6} width={44} height={38} rx={8} fill="#ffffff" opacity={0.1} />
          <rect x={-22} y={-6} width={44} height={38} rx={8} fill="none" stroke="#ffffff" strokeWidth={4} />
          <path d="M-12 -6 V-17 a12 12 0 0 1 24 0 V-6" fill="none" stroke="#ffffff" strokeWidth={4} />
          <circle cx={0} cy={12} r={4} fill="#ffffff" />
          <line x1={-32} y1={-28} x2={32} y2={38} stroke={WARM} strokeWidth={5} strokeLinecap="round" />
        </g>
        <g opacity={reduced ? 1 : morph} transform="translate(-42 -52)"><Shield x={0} y={0} size={84} draw={morph} /></g>
      </g>
    );
  },
  // 6. Record — a spiral notebook fills with a timestamped, quoted line; opinion kept apart.
  record: ({ p, reduced }) => {
    const l1 = reduced ? 1 : easeOut(seg(p, 0.12, 0.42));
    const l2 = reduced ? 1 : easeOut(seg(p, 0.36, 0.66));
    const opi = reduced ? 1 : easeOut(seg(p, 0.7, 1));
    const pen = reduced ? 1 : clamp01(seg(p, 0.12, 0.66));
    return (
      <g transform="translate(160 90)">
        <rect x={-78} y={-58} width={156} height={116} rx={12} fill="#f5f8ff" />
        <rect x={-78} y={-58} width={156} height={116} rx={12} fill="none" stroke="#cdd9f5" strokeWidth={1.5} />
        <line x1={-56} y1={-58} x2={-56} y2={58} stroke="#e21d27" strokeOpacity={0.35} strokeWidth={2} />
        {[-44, -32, -20, -8].map((cy) => <circle key={cy} cx={-67} cy={cy} r={3} fill="none" stroke="#9ab4ea" strokeWidth={2} />)}
        <text x={-46} y={-34} fontSize={11} fontWeight={800} fill={FIELD_A}>3:10pm — he said</text>
        <rect x={-46} y={-28} width={108 * l1} height={7} rx={3.5} fill={FIELD_B} />
        <rect x={-46} y={-14} width={90 * l2} height={7} rx={3.5} fill={`${FIELD_B}cc`} />
        <line x1={-67} y1={12} x2={67} y2={12} stroke="#e3ebfb" strokeWidth={2} />
        <text x={-46} y={30} fontSize={9} fontWeight={700} fill="#9aa7c4" opacity={opi}>my opinion — kept separate</text>
        <rect x={-46} y={35} width={74 * opi} height={5} rx={2.5} fill="#c3d0ea" opacity={opi} />
        {/* the pen writing */}
        <g transform={`translate(${-46 + 108 * (l1 < 1 ? l1 : l2) } ${l1 < 1 ? -24 : -10}) rotate(38)`} opacity={pen < 1 ? 1 : 0}>
          <rect x={-1.5} y={-22} width={3.5} height={22} rx={1.5} fill="#1d3a8f" />
          <path d="M-1.5 0 L2 0 L0.3 5 Z" fill="#f6b352" />
        </g>
      </g>
    );
  },
  // 7. Report — a phone dials 999 while the note travels to the DSL; today locks.
  report: ({ p, reduced }) => {
    const travel = reduced ? 1 : easeOut(seg(p, 0.12, 0.64));
    const tick = reduced ? 1 : easeOut(seg(p, 0.64, 1));
    const nx = -70 + travel * 150;
    return (
      <g transform="translate(160 96)">
        <path d="M-92 8 Q0 -48 96 6" fill="none" stroke={`${WARM}66`} strokeWidth={2} strokeDasharray="3 5" />
        {/* staff + phone */}
        <Person x={-116} y={54} s={0.9} cast={CAST[2]} />
        <g transform="translate(-118 -30)">
          <rect x={-13} y={-16} width={26} height={40} rx={5} fill="#0e1f4a" stroke="#ffffff" strokeOpacity={0.2} />
          <rect x={-9} y={-11} width={18} height={22} rx={2} fill={FIELD_B} opacity={0.35} />
          <text x={0} y={5} fontSize={11} fontWeight={800} fill={WARM} textAnchor="middle">999</text>
        </g>
        {/* the note gliding along the thread */}
        <g transform={`translate(${nx} ${6 - Math.sin(travel * Math.PI) * 48})`} opacity={1 - seg(travel, 0.92, 1)}>
          <rect x={-11} y={-14} width={22} height={28} rx={3} fill="#f5f8ff" stroke="#cdd9f5" />
          <line x1={-6} y1={-6} x2={6} y2={-6} stroke={FIELD_B} strokeWidth={2} /><line x1={-6} y1={0} x2={4} y2={0} stroke={FIELD_B} strokeWidth={2} />
        </g>
        {/* the DSL, badged with a shield + tick */}
        <Person x={116} y={54} s={1.02} cast={CAST[1]} />
        <g transform="translate(107 -4)"><Shield x={0} y={0} size={30} draw={travel} tick={tick} gloss={false} /></g>
        <text x={116} y={72} fontSize={9} fontWeight={800} fill="#ffffff" textAnchor="middle" opacity={0.85}>your DSL</text>
      </g>
    );
  },
  // 8. Your turn — the alert pulses while the learner chooses (cards render in HTML).
  "your-turn": ({ reduced }) => (
    <g transform="translate(160 84)">
      <g style={{ transformOrigin: "160px 84px", animation: reduced ? undefined : "aos-alert 1.5s ease-in-out infinite" }}>
        <path d="M0 -38 L38 30 H-38 Z" fill={`${WARM}22`} stroke={WARM} strokeWidth={4.5} strokeLinejoin="round" />
        <line x1={0} y1={-14} x2={0} y2={12} stroke={WARM} strokeWidth={5.5} strokeLinecap="round" />
        <circle cx={0} cy={22} r={3.4} fill={WARM} />
      </g>
    </g>
  ),
  // 9. Close — the shield locks in with light rays.
  close: ({ p, reduced }) => {
    const draw = reduced ? 1 : easeOut(seg(p, 0.08, 0.7));
    const glow = reduced ? 0.5 : Math.sin(clamp01(seg(p, 0.55, 1)) * Math.PI);
    return (
      <g transform="translate(160 90)">
        {!reduced && [0, 45, 90, 135, 180, 225, 270, 315].map((a) => { const r = (a * Math.PI) / 180; return <line key={a} x1={160 + 44 * Math.cos(r)} y1={90 + 44 * Math.sin(r)} x2={160 + 64 * Math.cos(r)} y2={90 + 64 * Math.sin(r)} stroke={WARM} strokeWidth={2} strokeLinecap="round" opacity={glow * 0.55} transform="translate(-160 -90)" /> })}
        <g transform="translate(-46 -54)"><Shield x={0} y={0} size={92} draw={draw} tick={draw} /></g>
      </g>
    );
  },
};

// generic, topic-agnostic scene templates (gtitle/gcards/gcheck/…) available to
// every course video, alongside the bespoke Safeguarding scenes above.
Object.assign(SCENES, GENERIC_SCENES);

const PHASE_OF: Record<string, number> = {
  intro: -1, "cold-open": -1, everyone: -1, notice: 0, respond: 1, "not-secret": 1, record: 2, report: 3, "your-turn": 3, close: 4,
};
const PHASES = ["Notice", "Respond", "Record", "Report"];

// ————————————————————————————————————————————————————————————————
export function MotionBlock({ b, onDone }: { b: { title?: string; voice?: boolean; accent?: string; scenes: MotionScene[] }; onDone?: () => void }) {
  const scenes = b.scenes;
  const narrator = useNarrator();
  const cum = useMemo(() => { let t = 0; return scenes.map((s) => (t += Math.max(1, s.seconds) * 1000)); }, [scenes]);
  const totalMs = cum[cum.length - 1] ?? 0;

  const reduced = useRef(false);
  const [, force] = useState(0);
  const rerender = useCallback(() => force((n) => (n + 1) & 0xffff), []);

  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState<"voice" | "text">(b.voice === false ? "text" : "voice");
  const [fb, setFb] = useState<string | null>(null);

  const elapsed = useRef(0);
  const startAt = useRef(0);
  const raf = useRef<number | undefined>(undefined);
  const playRef = useRef(false);
  const modeRef = useRef(mode);
  const spoken = useRef(-1);
  // key-word sync: how far the voice (or clock) has read into the current narration
  const speechChar = useRef(0);
  const speechLen = useRef(1);
  const boundaryFired = useRef(false);
  const speakStart = useRef(0);
  const ended = useRef<Set<number>>(new Set());
  const answered = useRef<Set<number>>(new Set());
  const watchdog = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduced.current = mq.matches;
    const on = () => { reduced.current = mq.matches; rerender(); };
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, [rerender]);

  const locate = useCallback((ms: number) => {
    let i = cum.findIndex((end) => ms < end);
    if (i === -1) i = scenes.length - 1;
    const start = i === 0 ? 0 : cum[i - 1];
    const p = clamp01((ms - start) / (Math.max(1, scenes[i].seconds) * 1000));
    return { i, p, start };
  }, [cum, scenes]);

  const speakScene = useCallback((i: number) => {
    if (modeRef.current !== "voice" || spoken.current === i) return;
    spoken.current = i;
    ended.current.delete(i);
    const text = scenes[i].narration;
    speechChar.current = 0; speechLen.current = Math.max(1, text.length); boundaryFired.current = false; speakStart.current = performance.now();
    const words = text.split(/\s+/).length;
    if (watchdog.current) clearTimeout(watchdog.current);
    watchdog.current = setTimeout(() => ended.current.add(i), Math.max(scenes[i].seconds * 1000, words * 300) + 1400);
    narrator.speak(text, () => { ended.current.add(i); speechChar.current = speechLen.current; },
      (ci) => { boundaryFired.current = true; speechChar.current = ci; });
  }, [narrator, scenes]);

  const frame = useCallback(() => {
    if (!playRef.current) return;
    const now = performance.now();
    let e = now - startAt.current;
    const { i, start } = locate(e);
    const endMs = cum[i];
    const sc = scenes[i];

    speakScene(i);

    // Interactive beat: let the scene arrive, then hold for the answer.
    if (sc.interactive && !answered.current.has(i)) {
      const cap = endMs - 30;
      if (e > cap) { e = cap; startAt.current = now - e; }
      elapsed.current = e; rerender();
      raf.current = requestAnimationFrame(frame);
      return;
    }
    // Voice paces the film: advance the instant a line ends (no silent lag); if
    // it runs long, hold at the scene edge so audio is never clipped.
    if (modeRef.current === "voice") {
      if (ended.current.has(i)) {
        if (e - start > MIN_DWELL && e < endMs) { e = endMs; startAt.current = now - e; }
      } else if (e >= endMs) { e = endMs - 1; startAt.current = now - e; }
    }
    elapsed.current = e;
    if (e >= totalMs) { elapsed.current = totalMs; playRef.current = false; setPlaying(false); onDone?.(); rerender(); return; }
    rerender();
    raf.current = requestAnimationFrame(frame);
  }, [cum, locate, onDone, rerender, scenes, speakScene, totalMs]);

  const kick = useCallback(() => { if (raf.current) cancelAnimationFrame(raf.current); raf.current = requestAnimationFrame(frame); }, [frame]);

  const play = useCallback(() => {
    setStarted(true); setFb(null);
    playRef.current = true; setPlaying(true);
    spoken.current = -1;
    startAt.current = performance.now() - elapsed.current;
    kick();
  }, [kick]);

  const pause = useCallback(() => {
    playRef.current = false; setPlaying(false);
    if (raf.current) cancelAnimationFrame(raf.current);
    narrator.stop(); spoken.current = -1;
  }, [narrator]);

  const replay = useCallback(() => {
    elapsed.current = 0; ended.current.clear(); answered.current.clear(); spoken.current = -1; setFb(null);
    play();
  }, [play]);

  const seek = useCallback((ms: number) => {
    const t = Math.max(0, Math.min(totalMs, ms));
    elapsed.current = t; startAt.current = performance.now() - t;
    narrator.stop(); spoken.current = -1;
    const { i } = locate(t);
    for (const k of Array.from(ended.current)) if (k >= i) ended.current.delete(k);
    rerender();
  }, [locate, narrator, rerender, totalMs]);

  const answer = useCallback((i: number, ok: boolean, msg: string) => {
    setFb(msg);
    if (ok) { answered.current.add(i); if (!playRef.current) play(); else { startAt.current = performance.now() - elapsed.current; } }
  }, [play]);

  const stageRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onVis = () => { if (document.hidden && playRef.current) pause(); };
    document.addEventListener("visibilitychange", onVis);
    let io: IntersectionObserver | undefined;
    if (stageRef.current && "IntersectionObserver" in window) {
      io = new IntersectionObserver((ents) => { if (ents[0] && ents[0].intersectionRatio < 0.25 && playRef.current) pause(); }, { threshold: [0, 0.25, 1] });
      io.observe(stageRef.current);
    }
    return () => { document.removeEventListener("visibilitychange", onVis); io?.disconnect(); };
  }, [pause]);

  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); if (watchdog.current) clearTimeout(watchdog.current); try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } }, []);

  const { i: cur, p } = locate(elapsed.current);
  const scene = scenes[cur];
  const Render = SCENES[scene.visual] ?? SCENES["close"];
  const pct = totalMs ? (elapsed.current / totalMs) * 100 : 0;
  const globalPhase = clamp01(elapsed.current / totalMs) * 4;
  // key word to show: timed to the VOICE when narrating (word boundaries, or a
  // rate estimate), else to the scene clock. No full running caption.
  let charPos: number;
  if (mode === "voice") {
    if (!boundaryFired.current && playRef.current) { const est = (speechLen.current / 14.5 / 1.08) * 1000; speechChar.current = Math.min(speechLen.current, (performance.now() - speakStart.current) / Math.max(1, est) * speechLen.current); }
    charPos = speechChar.current;
  } else { charPos = (reduced.current ? 1 : p) * scene.narration.length; }
  const key = keyAt(scene, charPos);
  const showSpine = scenes.some((s) => PHASE_OF[s.visual] !== undefined && PHASE_OF[s.visual] >= 0);
  const fmt = (ms: number) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === " " || e.key === "k") { e.preventDefault(); playing ? pause() : play(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); seek(elapsed.current + 5000); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); seek(elapsed.current - 5000); }
    else if (e.key === "r") { e.preventDefault(); replay(); }
    else if (e.key === "Home") { e.preventDefault(); seek(0); }
    else if (e.key === "End") { e.preventDefault(); seek(totalMs); }
  };

  return (
    <figure className="my-5" role="group" aria-label={b.title || "Animated lesson"} tabIndex={0} onKeyDown={onKey} style={{ outline: "none" }}>
      <style>{`
        @keyframes aos-breathe { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-2px)} }
        @keyframes aos-mag { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-4px,3px)} }
        @keyframes aos-alert { 0%,100%{opacity:.75;transform:scale(1)} 50%{opacity:1;transform:scale(1.05)} }
        @keyframes aos-poster { 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }
        @keyframes aos-pop { from{opacity:0;transform:scale(.72) translateY(12px)} to{opacity:1;transform:scale(1) translateY(0)} }
        .aos-kin-pop { animation: aos-pop .42s cubic-bezier(.22,1,.36,1) both }
        @media (prefers-reduced-motion: reduce){ .aos-kin-pop{animation:none!important} }
      `}</style>

      <div ref={stageRef} className="relative overflow-hidden rounded-2xl" style={{ background: `linear-gradient(160deg, ${FIELD_A}, ${FIELD_B})`, boxShadow: "0 20px 48px -18px rgba(16,35,86,.62)" }}>
        <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,.09) 1px, transparent 1.6px)", backgroundSize: "15px 15px", opacity: 0.5 }} />
        <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(120% 80% at 50% 0%, transparent 55%, rgba(6,14,40,.5) 100%)" }} />

        {/* spine — Notice · Respond · Record · Report (Safeguarding videos only) */}
        {showSpine && <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 px-4 pt-3">
          {PHASES.map((ph, i) => {
            const active = PHASE_OF[scene.visual] === i;
            const done = globalPhase > i + 1 || PHASE_OF[scene.visual] > i;
            return (
              <div key={ph} className="flex flex-1 items-center gap-2">
                <span className="inline-flex h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: active ? WARM : done ? GOOD : "rgba(255,255,255,.4)" }} />
                <span className="text-[9.5px] font-extrabold uppercase tracking-[0.12em]" style={{ color: active ? "#fff" : "rgba(255,255,255,.5)", transition: "color .3s" }}>{ph}</span>
              </div>
            );
          })}
        </div>}

        <div className="relative aspect-[320/184] w-full">
          <svg viewBox={`0 0 ${VW} ${VH}`} className="absolute inset-0 h-full w-full" role="img" aria-label={scene.narration}>
            <defs>
              <linearGradient id="mp-shield" x1="0" y1="0" x2="0.3" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#cfe0ff" /></linearGradient>
              <radialGradient id="mp-spot" cx="0.5" cy="0.4" r="0.6"><stop offset="0" stopColor={WARM} stopOpacity="0.5" /><stop offset="1" stopColor={WARM} stopOpacity="0" /></radialGradient>
            </defs>
            <g style={{ opacity: reduced.current ? 1 : easeOut(seg(p, 0, 0.08)) * (1 - seg(p, 0.94, 1)) }}>{Render({ p, scene, reduced: reduced.current })}</g>
          </svg>

          {/* key word — pops up in time with the narration (no full caption) */}
          {!scene.interactive && key && (
            <div className="pointer-events-none absolute inset-x-0 bottom-[10%] flex justify-center px-6 text-center" aria-live="polite">
              <span key={key} className="aos-kin-pop inline-block font-extrabold tracking-tight"
                style={{ fontSize: 28, color: "#fff", textShadow: "0 2px 16px rgba(6,14,40,.6)", lineHeight: 1.05 }}>{key}</span>
            </div>
          )}

          {/* interactive beat */}
          {scene.interactive && !answered.current.has(cur) && (
            <div className="absolute inset-x-0 bottom-3 z-20 flex flex-col items-center gap-2 px-4">
              <div className="flex w-full max-w-[440px] flex-col gap-1.5">
                {(scene.choices ?? []).map((c, ci) => (
                  <button key={ci} type="button" onClick={() => answer(cur, c.ok, c.fb)} className="rounded-xl border px-3 py-2 text-left text-[12.5px] font-bold text-white transition-colors hover:bg-white/20" style={{ borderColor: "rgba(255,255,255,.35)", background: "rgba(255,255,255,.10)" }}>{c.label}</button>
                ))}
              </div>
            </div>
          )}
          {fb && scene.interactive && <div className="absolute inset-x-0 bottom-1 z-20 px-6 text-center text-[11.5px] font-semibold" style={{ color: answered.current.has(cur) ? GOOD : WARM }}>{fb}</div>}

          {/* poster / play-gesture gate (also unlocks mobile audio) */}
          {!started && (
            <button type="button" onClick={play} className="absolute inset-0 z-30 grid place-items-center" style={{ background: "rgba(9,18,45,.30)" }} aria-label="Play the animated lesson">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-white/95 text-[24px] text-[#1d3a8f] shadow-xl" style={{ animation: reduced.current ? undefined : "aos-poster 2.2s ease-in-out infinite" }}>▶</span>
              <span className="absolute bottom-4 text-[12px] font-bold text-white/90">{b.title || "Watch"} · {fmt(totalMs)}</span>
            </button>
          )}
        </div>

        {/* transport */}
        <div className="flex items-center gap-2 border-t border-white/10 px-3 py-2">
          <button type="button" onClick={() => (playing ? pause() : play())} className="grid h-8 w-8 place-items-center rounded-full bg-white text-[14px] text-[#1d3a8f]" aria-label={playing ? "Pause" : "Play"}>{playing ? "❚❚" : "▶"}</button>
          <button type="button" onClick={replay} className="grid h-8 w-8 place-items-center rounded-full bg-white/12 text-[13px] text-white" aria-label="Replay from start">↺</button>
          <input type="range" min={0} max={totalMs} value={elapsed.current} onChange={(e) => seek(Number(e.target.value))} className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full" style={{ background: `linear-gradient(90deg, ${WARM} ${pct}%, rgba(255,255,255,.22) ${pct}%)` }} aria-label="Scrub" />
          <span className="tabular-nums text-[11px] font-semibold text-white/80">{fmt(elapsed.current)} / {fmt(totalMs)}</span>
          <button type="button" onClick={() => { narrator.stop(); spoken.current = -1; setMode((m) => (m === "voice" ? "text" : "voice")); }} className="ml-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold text-white" style={{ background: mode === "voice" ? "rgba(255,255,255,.18)" : "rgba(255,255,255,.08)" }} aria-pressed={mode === "voice"} title={mode === "voice" ? "Narration on — switch to text only" : "Text only — switch narration on"}>{mode === "voice" ? "🔊 Voice" : "📝 Text"}</button>
        </div>
      </div>
      {b.title && <figcaption className="mt-2 text-center text-[11.5px] font-semibold text-[var(--ink-3)]">{b.title}</figcaption>}
    </figure>
  );
}
