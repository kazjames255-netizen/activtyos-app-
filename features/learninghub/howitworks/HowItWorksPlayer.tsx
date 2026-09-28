"use client";

import { Mascot } from "../mascot";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import "./howitworks.css";
import { keyParts, posIn, type HowScript, type Scene } from "./types";
import { cancelSpeech, sentenceStart, speak, speechSupported, voicesFor } from "./narrator";
import { SPEECH_LANG, useHowText } from "./i18n";
import { resolveScene, rectsUrl, sceneShots, type RectMap } from "./rects";
import * as snd from "./sound";
import Glyph from "./Glyph";
import { captionSegments, segAt, type CapSeg } from "./captions";

// The How it works player: a self-contained, "video-like" explainer. Scenes are narrated with the browser's own voice (offline), key
// words pop in sync with the voice via word-boundary events, and every visual cue (zoom, ring, cursor, callout, flow card) is anchored to
// a PHRASE of the narration — so with sound on it follows the voice, and with sound off the same cues follow a scene clock. Same
// mechanics as public/courses/safeguarding.html, as a React component. Nothing makes a sound before a click / key press.

const CPS = 14.5;          // narration speed at 1x, characters per second (clock mode + estimates)
const HOLD_CLOCK = 1700;   // ms a scene lingers after its last word when running on the clock
const HOLD_VOICE = 650;    // ms after the voice ends before the next scene
const SPEEDS = [0.85, 1, 1.15, 1.3];
interface Prefs { sound: boolean; music: boolean; cc: boolean; speed: number; voice: string | null }
const DEFAULT_PREFS: Prefs = { sound: true, music: true, cc: true, speed: 1, voice: null };
// A child's explainer keeps its own preferences (never inherits a grown-up having muted it), starts a touch slower, and always begins with the voice on.
const KID_DEFAULTS: Prefs = { sound: true, music: true, cc: true, speed: 0.85, voice: null };
const prefKey = (kid: boolean) => (kid ? "aos.hiw.prefs.kid" : "aos.hiw.prefs");
const loadPrefs = (kid: boolean): Prefs => {
  const d = { ...(kid ? KID_DEFAULTS : DEFAULT_PREFS) };
  try { if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) d.music = false; } catch { /* no matchMedia */ }   // a viewer who asked for less motion gets no music bed unless they turn it on
  try { return { ...d, ...JSON.parse(localStorage.getItem(prefKey(kid)) || "{}") }; } catch { return d; }
};
const savePrefs = (kid: boolean, p: Prefs) => { try { localStorage.setItem(prefKey(kid), JSON.stringify(p)); } catch { /* private mode */ } };

const anchor = (s: Scene, on: string) => (on ? Math.max(0, posIn(s.say, on)) : 0);
const narrMs = (s: Scene, speed: number) => (s.say.length / (CPS * speed)) * 1000;

interface Derived {
  cam: { x: number; y: number; z: number };
  ring: { x: number; y: number; w: number; h: number; n: number } | null;
  cursor: { x: number; y: number; click: boolean; n: number } | null;
  callouts: number[];
  nodes: number;
  shot: number;
  key: number;
  word: number;
  seg: number;
  sig: string;
}
function derive(s: Scene, pos: number, words: number[], segs: CapSeg[], phone = false): Derived {
  const hit = (on: string) => pos > anchor(s, on);
  let cam = { x: 50, y: 50, z: 1 };
  (s.cam ?? []).forEach((c) => { if (hit(c.on) && c.x != null && c.y != null) cam = { x: c.x, y: c.y, z: c.z ?? 1.6 }; });
  let ring: Derived["ring"] = null;
  (s.rings ?? []).forEach((r, n) => { if (hit(r.on) && r.x != null && r.y != null && r.w != null && r.h != null) ring = r.off && hit(r.off) ? null : { x: r.x, y: r.y, w: r.w, h: r.h, n }; });
  let cursor: Derived["cursor"] = null;
  (s.cursor ?? []).forEach((c, n) => { if (hit(c.on) && c.x != null && c.y != null) cursor = { x: c.x, y: c.y, click: !!c.click, n }; });
  if (ring) { // the highlighted area is the crop target: 1.6-2x on a screen (more on a phone, so the words stay readable), and a tap lands on a small target
    const r = ring as NonNullable<Derived["ring"]>;
    const z = clamp(56 / Math.max(r.w, r.h * 1.8, 1), 1.6, 2) * (phone ? 1.4 : 1);
    cam = { x: r.x + r.w / 2, y: r.y + r.h / 2, z: Math.min(z, phone ? 3 : 2) };
    if (!cursor && r.w <= 34 && r.h <= 14) cursor = { x: r.x + Math.min(r.w * 0.7, r.w - 1), y: r.y + r.h * 0.6, click: true, n: 100 + r.n };
  }
  const callouts: number[] = [];
  (s.callouts ?? []).forEach((c, n) => { if (hit(c.on) && c.x != null && c.y != null && !(c.off && hit(c.off))) callouts.push(n); });
  let nodes = 0;
  (s.nodes ?? []).forEach((n) => { if (hit(n.on)) nodes++; });
  let shot = 0;
  (s.shots ?? []).forEach((sh, n) => { if (hit(sh.on)) shot = n; });
  let key = 0;
  s.keys.forEach((k, n) => { if (posIn(s.say, keyParts(k)[1]) <= pos) key = n; });
  let word = 0;
  words.forEach((w, n) => { if (w <= pos) word = n; });
  const seg = segAt(segs, pos);
  const sig = [seg, cam.x, cam.y, cam.z, ring ? (ring as { n: number }).n : -1, cursor ? (cursor as { n: number }).n : -1, callouts.join("."), nodes, shot, key, word].join("|");
  return { cam, ring, cursor, callouts, nodes, shot, key, word, seg, sig };
}
const wordStarts = (say: string) => { const out: number[] = []; const re = /\S+/g; let m: RegExpExecArray | null; while ((m = re.exec(say))) out.push(m.index); return out; };
const fmt = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

export interface HowPlayerProps {
  script: HowScript;
  /** Scene id to open on (deep link from an empty state). */
  startScene?: string | null;
  /** Other explainers to offer on the end card. */
  others?: { label: string; onPick: () => void }[];
  /** Force a colour scheme for the chrome around the stage (defaults to the OS setting). */
  theme?: "light" | "dark";
  /** Set false to stop the global keyboard shortcuts (e.g. when something is layered on top). */
  keys?: boolean;
  /** A child is watching: bigger captions and buttons, voice on by default (after the first tap), no speed / voice pickers. */
  kid?: boolean;
  /** Called once when the last scene has played out (used to tick the topic off in the chooser). */
  onFinish?: () => void;
  /** Play as soon as it opens (a page's Watch button). */
  autoplay?: boolean;
  /** "Try it now": leaves the video for the real screen (shown on the last scene when the script has a tryIt). */
  onTryIt?: () => void;
  /** The next video in the library, offered on the last scene. */
  nextVideo?: { label: string; onPick: () => void };
  /** Take keyboard focus on open (the in-app window), so Space / arrows work at once. */
  autofocus?: boolean;
}

export default function HowItWorksPlayer({ script: englishScript, startScene, others, theme, keys = true, kid = false, onFinish, autoplay = false, onTryIt, nextVideo, autofocus = false }: HowPlayerProps) {
  const H = useHowText();
  const script = useMemo(() => H.script(englishScript), [H, englishScript]);
  const lang = SPEECH_LANG[H.locale];   // the narration's language: a matching device voice, else captions only
  const [maps, setMaps] = useState<RectMap>({});
  useEffect(() => { // the recorded element rectangles for this video's screens (tiny json next to each webp); cues that name an element wait for them
    let live = true;
    const srcs = [...new Set(script.scenes.flatMap((sc) => sceneShots(sc).map((x) => x.src)).filter(Boolean))];
    void Promise.all(srcs.map((src) => fetch(rectsUrl(src)).then((r) => (r.ok ? r.json() : [])).catch(() => []).then((rows) => [src, rows] as const)))
      .then((pairs) => { if (live) setMaps(Object.fromEntries(pairs)); });
    return () => { live = false; };
  }, [script]);
  const S = useMemo(() => script.scenes.map((sc) => resolveScene(sc, maps)), [script, maps]);
  const N = S.length;
  const posKey = `aos.hiw.pos.${script.role}.${script.band ?? "std"}.${script.topic ?? "main"}`;
  const startIdx = useMemo(() => { // an explicit scene wins; else pick up where this video was left (never resume on the last scene: that means it was finished)
    const named = S.findIndex((s) => s.id === startScene); if (named >= 0) return named;
    try { const k = S.findIndex((s) => s.id === localStorage.getItem(posKey)); return k > 0 && k < S.length - 1 ? k : 0; } catch { return 0; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [phone, setPhone] = useState(false);
  useEffect(() => { const mq = window.matchMedia("(max-width: 599px)"); const f = () => setPhone(mq.matches); f(); mq.addEventListener?.("change", f); return () => mq.removeEventListener?.("change", f); }, []);
  const [i, setI] = useState(startIdx);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [prefs, setPrefsState] = useState<Prefs>(kid ? KID_DEFAULTS : DEFAULT_PREFS);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [canSpeak, setCanSpeak] = useState(false); // false on the server and on first paint, so hydration always matches
  const [showList, setShowList] = useState(false);
  const [narrating, setNarrating] = useState(false);
  const wordsBy = useMemo(() => S.map((s) => wordStarts(s.say)), [S]);
  const segsBy = useMemo(() => S.map((s) => captionSegments(s.say)), [S]);
  const phoneRef = useRef(false);
  useEffect(() => { phoneRef.current = phone; }, [phone]);
  const [d, setD] = useState<Derived>(() => derive(S[startIdx], 0, wordsBy[startIdx], segsBy[startIdx]));

  const R = useRef({ i: startIdx, t: 0, pos: 0, playing: false, narr: false, spoke: false, spokeAt: 0, speakAt: 0, from: 0, boundary: false, ended: false, hold: 0, last: 0, sig: "", raf: 0 });
  const prefsRef = useRef<Prefs>(kid ? KID_DEFAULTS : DEFAULT_PREFS);
  const segs = useRef<(HTMLSpanElement | null)[]>([]);
  const timeEl = useRef<HTMLSpanElement | null>(null);
  const root = useRef<HTMLDivElement | null>(null);
  const listEl = useRef<HTMLOListElement | null>(null);

  // preferences + voices (client only, after mount)
  useEffect(() => {
    // Saved preferences and speech support are browser-only facts: read after mount so the server render and first paint always match.
    const p = loadPrefs(kid); prefsRef.current = p;
    /* eslint-disable react-hooks/set-state-in-effect */
    setPrefsState(p);
    setCanSpeak(speechSupported() && voicesFor(lang).length > 0 || speechSupported() && lang.startsWith("en"));
    if (!speechSupported()) return;
    const upd = () => { const v = voicesFor(lang); setVoices(v); setCanSpeak(v.length > 0 || lang.startsWith("en")); };   // no voice for this language on the device: captions only (clock mode)
    upd();
    /* eslint-enable react-hooks/set-state-in-effect */ speechSynthesis.addEventListener?.("voiceschanged", upd);
    return () => speechSynthesis.removeEventListener?.("voiceschanged", upd);
  }, [kid, lang]);
  const setPrefs = (patch: Partial<Prefs>) => { const p = { ...prefsRef.current, ...patch }; prefsRef.current = p; setPrefsState(p); savePrefs(kid, p); };

  const total = useMemo(() => S.reduce((a, s) => a + narrMs(s, prefs.speed) + HOLD_CLOCK, 0), [S, prefs.speed]);
  const before = useCallback((k: number) => S.slice(0, k).reduce((a, s) => a + narrMs(s, prefsRef.current.speed) + HOLD_CLOCK, 0), [S]);

  const paint = useCallback((force = false) => {
    const r = R.current; const s = S[r.i];
    const nd = derive(s, r.pos, wordsBy[r.i], segsBy[r.i], phoneRef.current);
    if (force || nd.sig !== r.sig) { r.sig = nd.sig; setD(nd); }
    const nm = narrMs(s, prefsRef.current.speed);
    const frac = clamp(r.pos / Math.max(1, s.say.length), 0, 1);
    const seg = segs.current;
    seg.forEach((el, k) => { if (el) el.style.width = k < r.i ? "100%" : k === r.i ? `${(r.playing || r.t > 0 || r.pos > 0 ? frac : 0) * 100}%` : "0%"; });
    if (timeEl.current) timeEl.current.textContent = `${fmt(before(r.i) + frac * (nm + HOLD_CLOCK))} / ${fmt(S.reduce((a, x) => a + narrMs(x, prefsRef.current.speed) + HOLD_CLOCK, 0))}`;
  }, [S, wordsBy, segsBy, before]);

  const startVoice = useCallback((from: number) => {
    const r = R.current; const s = S[r.i]; const p = prefsRef.current;
    if (!p.sound || !speechSupported() || (!lang.startsWith("en") && !voicesFor(lang).length)) { r.narr = false; setNarrating(false); return; }
    const f = sentenceStart(s.say, from);
    r.narr = true; r.spoke = false; r.boundary = false; r.ended = false; r.hold = 0; r.from = f; r.pos = Math.min(r.pos, f) || f; r.speakAt = performance.now();
    setNarrating(true);
    speak(s.say, {
      rate: p.speed, voiceURI: p.voice, from: f, lang,
      onStart: () => { r.spoke = true; r.spokeAt = performance.now(); },
      onBoundary: (c) => { r.boundary = true; r.pos = Math.max(r.pos, c); },
      onEnd: () => { r.ended = true; r.pos = s.say.length; },
      onError: () => { r.narr = false; setNarrating(false); r.t = (r.pos / s.say.length) * narrMs(s, p.speed); },
    });
  }, [S, lang]);

  const finish = useCallback(() => {
    const r = R.current; r.playing = false; setPlaying(false); setFinished(true); cancelSpeech(); r.narr = false; setNarrating(false); r.pos = S[r.i].say.length; paint(true); snd.musicStop(); if (prefsRef.current.sound) snd.cue("chime", kid ? 0.7 : 1); try { localStorage.removeItem(posKey); } catch { /* ignore */ }
  }, [S, paint, kid, posKey]);

  const gotoScene = useCallback((k: number, opts?: { play?: boolean }) => {
    const r = R.current; const idx = clamp(k, 0, N - 1);
    cancelSpeech();
    r.i = idx; r.t = 0; r.pos = 0; r.ended = false; r.hold = 0; r.narr = false; r.sig = "";
    setI(idx); setFinished(false); setNarrating(false);
    if (opts?.play ?? r.playing) { r.playing = true; setPlaying(true); startVoice(0); }
    paint(true);
  }, [N, paint, startVoice]);

  const loop = useCallback((now: number) => {
    const r = R.current;
    if (!r.playing) return;
    const dt = Math.min(100, now - (r.last || now)); r.last = now;
    const s = S[r.i]; const p = prefsRef.current; const len = s.say.length;
    let advance = false;
    if (r.narr) {
      if (!r.spoke && now - r.speakAt > 3200 && !r.boundary) { cancelSpeech(); r.narr = false; setNarrating(false); r.t = (r.pos / len) * narrMs(s, p.speed); }   // the voice never started: run on the clock
      else {
        if (r.spoke && !r.boundary) { const span = len - r.from; r.pos = Math.max(r.pos, r.from + Math.min(span - 1, ((now - r.spokeAt) / ((span / (CPS * p.speed)) * 1000)) * span)); }
        if (!r.ended && now - r.speakAt > narrMs(s, p.speed) * 2.4 + 6000) r.ended = true;   // a stuck voice must never freeze the film
        if (r.ended) { r.hold += dt; if (r.hold >= HOLD_VOICE) advance = true; }
      }
    }
    if (!r.narr) {
      r.t += dt;
      const nm = narrMs(s, p.speed);
      r.pos = Math.min(len, (r.t / nm) * len);
      if (r.t >= nm + HOLD_CLOCK) advance = true;
    }
    if (advance) { if (r.i >= N - 1) { finish(); return; } gotoScene(r.i + 1, { play: true }); }
    else paint();
    r.raf = requestAnimationFrame(loop);
  }, [S, N, paint, gotoScene, finish]);

  useEffect(() => { // (re)start the frame loop whenever playing flips on
    const r = R.current;
    if (playing) { r.last = 0; cancelAnimationFrame(r.raf); r.raf = requestAnimationFrame(loop); }
    return () => cancelAnimationFrame(r.raf);
  }, [playing, loop]);
  useEffect(() => { paint(true); }, [paint, phone]);
  useEffect(() => () => { cancelSpeech(); snd.soundClose(); }, []);
  useEffect(() => { try { if (started) localStorage.setItem(posKey, S[i].id); } catch { /* private mode: no resume */ } }, [i, started, S, posKey]);
  const reached = started && i === N - 1;
  useEffect(() => { if (reached) onFinish?.(); }, [reached]); // eslint-disable-line react-hooks/exhaustive-deps -- Watched is ticked once the LAST scene is reached, never on open
  useEffect(() => { if (autofocus) root.current?.focus({ preventScroll: true }); }, [autofocus]);
  useEffect(() => { snd.duck(narrating, kid ? 0.06 : 0.09); }, [narrating, kid]);   // the music bed sits under the voice
  useEffect(() => { // never talk to a hidden tab
    const h = () => { if (document.hidden && R.current.playing) pause(); };
    document.addEventListener("visibilitychange", h);
    return () => document.removeEventListener("visibilitychange", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { // warm the next scene's screens so the cut is instant (they are lazy-loaded webp, a few dozen KB each)
    const nx = S[i + 1]; if (!nx) return;
    for (const sh of [nx.shot, ...(nx.shots ?? [])]) if (sh?.src) { const im = new Image(); im.decoding = "async"; im.src = sh.src; }
  }, [i, S]);
  useEffect(() => { // keep the current scene visible in the list
    listEl.current?.querySelector<HTMLElement>('[aria-current="step"]')?.scrollIntoView({ block: "nearest" });
  }, [i]);

  // Test / QA hook: window.dispatchEvent(new CustomEvent("hiw:seek", { detail: { scene: 3, at: 0.6 } })) parks the film on a scene at a fraction of its narration.
  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent<{ scene: number | string; at?: number }>).detail; if (!d) return;
      const k = typeof d.scene === "string" ? S.findIndex((x) => x.id === d.scene) : d.scene; if (k < 0) return;
      setStarted(true); gotoScene(k, { play: false });
      const r = R.current; r.pos = Math.floor((d.at ?? 0) * S[k].say.length); r.t = (r.pos / S[k].say.length) * narrMs(S[k], prefsRef.current.speed); paint(true);
    };
    window.addEventListener("hiw:seek", h);
    return () => window.removeEventListener("hiw:seek", h);
  }, [S, gotoScene, paint]);

  function play() {
    const r = R.current;
    if (finished) { setFinished(false); gotoScene(0, { play: true }); setStarted(true); return; }
    setStarted(true); r.playing = true; setPlaying(true);
    if (prefsRef.current.sound && snd.unlock() && prefsRef.current.music) snd.musicStart(kid ? 0.06 : 0.09);   // the click that starts the film is also what unlocks the audio
    startVoice(r.pos);           // called synchronously from the click: this is what unlocks speech on phones
    if (!prefsRef.current.sound) { r.narr = false; setNarrating(false); }
  }
  function pause() {
    const r = R.current; r.playing = false; setPlaying(false); cancelSpeech(); snd.musicStop();
    if (r.narr) { r.narr = false; setNarrating(false); r.t = (r.pos / S[r.i].say.length) * narrMs(S[r.i], prefsRef.current.speed); }
  }
  const toggle = () => (R.current.playing ? pause() : play());
  const next = () => { if (R.current.i >= N - 1) { finish(); return; } setStarted(true); gotoScene(R.current.i + 1); };
  const prev = () => { const r = R.current; setStarted(true); gotoScene(r.pos > 80 ? r.i : r.i - 1); };
  const restart = () => { setStarted(true); setFinished(false); gotoScene(0, { play: true }); };
  const jump = (k: number) => { setStarted(true); gotoScene(k, { play: true }); };

  const setSound = (on: boolean) => {
    const r = R.current; setPrefs({ sound: on });
    if (!on) snd.musicStop(); else if (r.playing && prefsRef.current.music && snd.unlock()) snd.musicStart(kid ? 0.06 : 0.09);
    if (!on) { cancelSpeech(); if (r.narr) { r.narr = false; setNarrating(false); r.t = (r.pos / S[r.i].say.length) * narrMs(S[r.i], prefsRef.current.speed); } }
    else if (r.playing) startVoice(r.pos);
  };
  const setMusic = (on: boolean) => { setPrefs({ music: on }); if (!on) snd.musicStop(); else if (R.current.playing && prefsRef.current.sound && snd.unlock()) snd.musicStart(kid ? 0.06 : 0.09); };
  const setSpeed = (v: number) => { const r = R.current; setPrefs({ speed: v }); if (r.playing && r.narr) startVoice(r.pos); else if (r.playing) r.t = (r.pos / S[r.i].say.length) * narrMs(S[r.i], v); };
  const setVoice = (v: string) => { const r = R.current; setPrefs({ voice: v || null }); if (r.playing && r.narr) startVoice(r.pos); };

  // keyboard: Space / K play-pause, ← → scenes, R restart, C captions, M sound
  useEffect(() => {
    if (!keys) return;
    const h = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || t?.isContentEditable) return;
      const inBar = !!t?.closest?.(".hiw-bar");
      const activating = (tag === "BUTTON" || tag === "A" || t?.getAttribute("role") === "button") && (e.key === "Enter" || (e.key === " " && !inBar));   // Space always plays / pauses, unless it is pressing a button outside the transport bar
      if (activating) return;
      if (!root.current || (!root.current.contains(t) && t !== document.body && !t?.closest?.(".hiw-sheet"))) return;
      const k = e.key.toLowerCase();
      if (k === " " || k === "k") { e.preventDefault(); toggle(); }
      else if (k === "arrowright" || k === "l") { e.preventDefault(); next(); }
      else if (k === "arrowleft" || k === "j") { e.preventDefault(); prev(); }
      else if (k === "r") { e.preventDefault(); restart(); }
      else if (k === "c") { e.preventDefault(); setPrefs({ cc: !prefsRef.current.cc }); }
      else if (k === "m") { e.preventDefault(); setSound(!prefsRef.current.sound); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys, finished, i]);

  useEffect(() => { if (autoplay) { const t = window.setTimeout(() => { if (!R.current.playing) play(); }, 60); return () => window.clearTimeout(t); } }, []); // eslint-disable-line react-hooks/exhaustive-deps -- once, on open
  const sc = S[i];
  // tiny UI sounds tied to what happens on screen (only while playing, and only with sound on)
  const cueSeen = useRef({ i, ring: -1, cursor: -1, callouts: 0, nodes: 0, key: 0 });
  useEffect(() => {
    const c = cueSeen.current; const on = playing && prefsRef.current.sound; const v = kid ? 0.65 : 1;
    if (c.i !== i) { c.i = i; c.ring = -1; c.cursor = -1; c.callouts = 0; c.nodes = 0; c.key = 0; if (on) snd.cue("whoosh", v); return; }
    if (on) {
      if (d.cursor && d.cursor.n !== c.cursor) { if (d.cursor.click) window.setTimeout(() => snd.cue("click", v), 900); }
      else if (d.ring && d.ring.n !== c.ring) snd.cue("pop", v);
      else if (d.callouts.length > c.callouts || d.nodes > c.nodes) snd.cue("pop", v);
      else if (d.key !== c.key) snd.cue("tick", v * 0.6);
    }
    c.ring = d.ring?.n ?? -1; c.cursor = d.cursor?.n ?? -1; c.callouts = d.callouts.length; c.nodes = d.nodes; c.key = d.key;
  }, [i, d, playing, kid]);
  const layout = sc.layout ?? (sc.shot || sc.shots ? "shot" : "flow");
  const pose = finished ? "celebrate" : !started ? "wave" : d.ring || d.cursor?.click ? "point" : playing ? "speak" : "think";

  return (
    <div ref={root} tabIndex={-1} className={`hiw${kid ? " hiw--kid" : ""}`} lang={H.lang} dir={H.dir} data-theme={theme} data-testid="hiw" data-role={script.role} data-scene={sc.id} data-playing={playing ? "1" : "0"} data-started={started ? "1" : "0"} data-narrating={narrating ? "1" : "0"}>
      <div className="hiw-main">
        <div className="hiw-stage" data-layout={layout} data-device={sc.shot?.device ?? sc.shots?.[0]?.device ?? "desktop"} aria-label={H.ui("stageAria", { script: script.title, i: i + 1, n: N, title: sc.title })} role="group">
          <div className="hiw-bg" aria-hidden />
          <p className="hiw-sr" aria-live="polite">{started ? H.ui("sceneLive", { i: i + 1, n: N, title: sc.title }) : ""}</p>
          <SceneView key={sc.id} sc={sc} d={d} layout={layout} />
          <div className={`hiw-keys${sc.keys.length ? " on" : ""}`} aria-hidden data-testid="hiw-keys">
            <ol>
              {sc.keys.slice(0, d.key + 1).map((k, n) => (n < d.key - 3 ? null : <li key={`${sc.id}-${n}`} className={n === d.key ? "cur" : n === d.key - 1 ? "old" : "older"} data-testid={n === d.key ? "hiw-key" : undefined}><span className="hiw-kw">{keyParts(k)[0]}</span></li>))}
            </ol>
          </div>
          <div className="hiw-pip" aria-hidden data-pose={pose}><Mascot key={pose} pose={pose} size={150} ground={false} /></div>
          {!started && (
            <div className="hiw-poster" data-testid="hiw-poster">
              <div className="hiw-poster-in">
                <div className="hiw-poster-ico" aria-hidden><Mascot pose="wave" size={132} ground={false} /></div>
                <h2>{script.title}</h2>
                <p>{script.tagline}</p>
                <button type="button" className="hiw-bigplay" data-testid="hiw-start" onClick={play} aria-label={H.ui("playAria", { title: script.title })}>
                  <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
                </button>
                <small>{H.ui("minScenes", { m: Math.round(total / 60000), n: N })} · {canSpeak ? H.ui("soundOnCaps") : lang.startsWith("en") ? H.ui("capsBelow") : `${H.ui("noVoice")} ${H.ui("capsBelow")}`}{startIdx > 0 ? ` ${H.ui("startsAt", { title: S[startIdx].title })}` : ""}</small>
              </div>
            </div>
          )}
          {finished && (
            <div className="hiw-poster hiw-end" data-testid="hiw-end">
              <div className="hiw-poster-in">
                <div className="hiw-poster-ico" aria-hidden><Mascot pose="celebrate" size={132} ground={false} /></div>
                <h2>{H.ui("thatsTheLot")}</h2>
                <p>{script.tagline}</p>
                <div className="hiw-end-row">
                  <button type="button" className="hiw-pill primary" onClick={restart}>{H.ui("watchAgain")}</button>
                  {(others ?? []).map((o) => <button key={o.label} type="button" className="hiw-pill" onClick={o.onPick}>{o.label}</button>)}
                </div>
              </div>
            </div>
          )}
        </div>

        {i === N - 1 && started && (onTryIt || nextVideo) && (
          <div className="hiw-last" data-testid="hiw-last">
            {onTryIt && <button type="button" className="hiw-pill primary" data-testid="hiw-tryit" onClick={onTryIt}>{H.ui("tryNow")}</button>}
            {nextVideo && <button type="button" className="hiw-pill" data-testid="hiw-nextvideo" onClick={nextVideo.onPick}>{nextVideo.label}</button>}
          </div>
        )}

        {prefs.cc && (() => {
          const sg = segsBy[i][Math.min(d.seg, segsBy[i].length - 1)];
          const ws = wordsBy[i]; const first = ws.filter((x) => x < sg.a).length;
          const parts: { w: string; idx: number }[] = []; const re = /\S+/g; let m: RegExpExecArray | null; const text = sc.say.slice(sg.a, sg.b);
          while ((m = re.exec(text))) parts.push({ w: m[0], idx: first + parts.length });
          return (
            <div className="hiw-cc" data-testid="hiw-caption" aria-label={H.ui("captions")} role="region">
              <p data-seg={d.seg}>{parts.map((x, n) => <span key={n}>{n ? " " : ""}<span className={x.idx < d.word ? "said" : x.idx === d.word ? "now" : "todo"}>{x.w}</span></span>)}</p>
            </div>
          );
        })()}

        <div className="hiw-bar" role="toolbar" aria-label={H.ui("controls")}>
          <div className="hiw-segs" role="group" aria-label={H.ui("scenesJump")}>
            {S.map((s, k) => (
              <button key={s.id} type="button" className="hiw-seg" style={{ flexGrow: s.say.length } as CSSProperties} aria-label={H.ui("sceneN", { k: k + 1, title: s.title })} aria-current={k === i ? "step" : undefined} title={`${k + 1}. ${s.title}`} onClick={() => jump(k)}>
                <span className="hiw-seg-fill" ref={(el) => { segs.current[k] = el; }} />
              </button>
            ))}
          </div>
          <div className="hiw-ctrls">
            <button type="button" className="hiw-btn" onClick={prev} aria-label={H.ui("prev")} title={H.ui("prevT")}><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden><path d="M6 6h2v12H6zM20 6v12L9.5 12z" fill="currentColor" /></svg></button>
            <button type="button" className="hiw-btn hiw-play" data-testid="hiw-play" onClick={toggle} aria-label={playing ? H.ui("pause") : finished ? H.ui("replay") : H.ui("play")} title={playing ? H.ui("pauseT") : H.ui("playT")}>
              {playing ? <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden><path d="M6 5h4v14H6zM14 5h4v14h-4z" fill="currentColor" /></svg> : <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden><path d="M8 5v14l11-7z" fill="currentColor" /></svg>}
            </button>
            <button type="button" className="hiw-btn" onClick={next} aria-label={H.ui("next")} title={H.ui("nextT")}><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden><path d="M16 6h2v12h-2zM4 6v12l10.5-6z" fill="currentColor" /></svg></button>
            <button type="button" className="hiw-btn hiw-nomobile" onClick={restart} aria-label={H.ui("restart")} title={H.ui("restartT")}><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden><path d="M12 5V2L7 6.5 12 11V8a5 5 0 1 1-5 5H5a7 7 0 1 0 7-8z" fill="currentColor" /></svg></button>
            <span className="hiw-time hiw-nomobile" aria-hidden ref={timeEl}>0:00 / 0:00</span>
            <span className="hiw-grow hiw-nomobile" />
            <button type="button" className="hiw-btn hiw-tog" aria-pressed={prefs.cc} onClick={() => setPrefs({ cc: !prefs.cc })} title={H.ui("captionsT")}><span aria-hidden>CC</span><span className="hiw-sr">{prefs.cc ? H.ui("captionsOn") : H.ui("captionsOff")}</span></button>
            <button type="button" className="hiw-btn hiw-tog" aria-pressed={prefs.sound} onClick={() => setSound(!prefs.sound)} title={H.ui("soundT")} disabled={!canSpeak}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>{prefs.sound ? <path d="M3 9v6h4l5 4V5L7 9zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z" fill="currentColor" /> : <path d="M3 9v6h4l5 4V5L7 9zm14.6 3 2.4-2.4-1.4-1.4-2.4 2.4-2.4-2.4-1.4 1.4 2.4 2.4-2.4 2.4 1.4 1.4 2.4-2.4 2.4 2.4 1.4-1.4z" fill="currentColor" />}</svg>
              <span className="hiw-sr">{prefs.sound ? H.ui("soundOn") : H.ui("soundOff")}</span>
            </button>
            <button type="button" className="hiw-btn hiw-tog hiw-nomobile" data-testid="hiw-music" aria-pressed={prefs.music && prefs.sound} onClick={() => setMusic(!prefs.music)} title={H.ui("musicT")} disabled={!canSpeak || !prefs.sound}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden><path d="M9 17V6l10-2v11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="6.5" cy="17.5" r="2.5" fill="currentColor" /><circle cx="16.5" cy="15.5" r="2.5" fill="currentColor" /></svg>
              <span className="hiw-sr">{prefs.music && prefs.sound ? H.ui("musicOn") : H.ui("musicOff")}</span>
            </button>
            {!kid && <label className="hiw-sel"><span className="hiw-sr">{H.ui("speed")}</span>
              <select value={prefs.speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label={H.ui("speed")} data-testid="hiw-speed">
                {SPEEDS.map((v) => <option key={v} value={v}>{v}×</option>)}
              </select>
            </label>}
            {!kid && voices.length > 0 && (
              <label className="hiw-sel hiw-voice hiw-nomobile"><span className="hiw-sr">{H.ui("voice")}</span>
                <select value={prefs.voice ?? ""} onChange={(e) => setVoice(e.target.value)} aria-label={H.ui("voice")} data-testid="hiw-voice">
                  <option value="">{H.ui("autoVoice")}</option>
                  {voices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>)}
                </select>
              </label>
            )}
            <button type="button" className="hiw-btn hiw-scenes-btn hiw-nomobile" aria-expanded={showList} aria-controls="hiw-scenes" onClick={() => setShowList((v) => !v)}>☰ <span>{H.ui("scenes")}</span></button>
          </div>
        </div>
      </div>

      <aside className={`hiw-list${showList ? " open" : ""}`} id="hiw-scenes" aria-label={H.ui("scenes")}>
        <h3>{H.ui("scenes")}</h3>
        <ol ref={listEl}>
          {S.map((s, k) => (
            <li key={s.id}>
              <button type="button" data-testid={`hiw-scene-${s.id}`} aria-current={k === i ? "step" : undefined} onClick={() => jump(k)}>
                <span className="n">{k + 1}</span>
                <span className="t"><small>{s.chapter}</small>{s.title}</span>
              </button>
            </li>
          ))}
        </ol>
        <details className="hiw-tx">
          <summary>{H.ui("readScript")}</summary>
          {S.map((s, k) => <div key={s.id}><b>{k + 1}. {s.title}</b><p>{s.say}</p></div>)}
        </details>
      </aside>
    </div>
  );
}

function SceneView({ sc, d, layout }: { sc: Scene; d: Derived; layout: string }) {
  const shots = sc.shots?.length ? sc.shots : sc.shot ? [{ on: "", ...sc.shot }] : [];
  const shot = shots[d.shot] ?? shots[0];
  if (layout === "shot" && shot) {
    const phone = shot.device === "phone";
    const { x, y, z } = d.cam;
    const tx = clamp(50 - x * z, 100 * (1 - z), 0);
    const ty = clamp(50 - y * z, 100 * (1 - z), 0);
    const vx = (px: number) => px * z + tx;
    const vy = (py: number) => py * z + ty;
    const ring = d.ring;
    const camStyle = { transform: `translate(${tx}%, ${ty}%) scale(${z})`, ["--z" as string]: z } as CSSProperties;
    const imgs = shots.map((s2, n) => (
      // eslint-disable-next-line @next/next/no-img-element
      <img key={s2.src} src={s2.src} alt="" width={s2.w} height={s2.h} loading={n === 0 ? "eager" : "lazy"} decoding="async" className={n === d.shot ? "on" : ""} draggable={false} />
    ));
    return (
      <div className={`hiw-shotwrap${phone ? " phone" : ""}`}>
        <div className="hiw-drift">
          <div className={`hiw-device${phone ? " phone" : ""}`} style={{ ["--ar" as string]: shot.w / shot.h } as CSSProperties}>
            <div className={`hiw-view${ring ? " focus" : ""}`}>
              <div className="hiw-cam base" style={camStyle}>{imgs}</div>
              {ring && <div key={`l${ring.n}`} className="hiw-cam lit" style={{ ...camStyle, clipPath: `inset(${ring.y}% ${100 - ring.x - ring.w}% ${100 - ring.y - ring.h}% ${ring.x}% round ${10 / z}px)` }}>{imgs}</div>}
              {ring && <div className="hiw-cam" style={camStyle}><div key={`r${ring.n}`} className="hiw-ring" style={{ left: `${ring.x}%`, top: `${ring.y}%`, width: `${ring.w}%`, height: `${ring.h}%` }} /></div>}
              {!phone && d.callouts.map((n) => {
                const c = sc.callouts![n];
                const px = vx(c.x ?? 50); const dir = (c.dir ?? "right") === "right" && px > 62 ? "left" : (c.dir ?? "right");   // a label near the right edge opens to the left, so it never squeezes
                return <div key={n} className="hiw-co" data-dir={dir} style={{ left: `${px}%`, top: `${vy(c.y ?? 50)}%` }}><span className="dot" /><span className="bub">{c.text}</span></div>;
              })}
              {d.cursor && (
                <div className="hiw-cursor" style={{ left: `${vx(d.cursor.x)}%`, top: `${vy(d.cursor.y)}%` }} aria-hidden>
                  <svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 2l15 9-6.5 1.6L15 20l-3 1-2.6-7.2L4 18z" fill="#fff" stroke="#0e1f4a" strokeWidth="1.4" strokeLinejoin="round" /></svg>
                  {d.cursor.click && <b key={`c${d.cursor.n}`} className="hiw-click" />}
                </div>
              )}
            </div>
          </div>
        </div>
        {phone && (
          <ul className="hiw-side" aria-hidden>
            {d.callouts.map((n, k) => <li key={n} className={k === d.callouts.length - 1 ? "new" : ""}>{sc.callouts![n].text}</li>)}
          </ul>
        )}
      </div>
    );
  }
  return (
    <div className={`hiw-flow${layout === "title" ? " title" : ""}`}>
      {layout === "title" && <h3>{sc.title}</h3>}
      <div className="hiw-nodes" data-n={sc.nodes?.length ?? 0}>
        {(sc.nodes ?? []).map((n, k) => (
          <div key={k} className={`hiw-node tone-${n.tone ?? "a"}${k < d.nodes ? " on" : ""}`} style={{ ["--k" as string]: k } as CSSProperties} data-testid="hiw-node">
            <span className="ic" aria-hidden><Glyph icon={n.icon} size={34} /></span>
            <b>{n.title}</b>
            {n.sub && <span className="sub">{n.sub}</span>}
          </div>
        ))}
      </div>
      {sc.links && d.nodes >= (sc.nodes?.length ?? 0) && (
        <div className="hiw-links">{sc.links.map((l) => <a key={l.href} href={l.href} className="hiw-pill">{l.label}</a>)}</div>
      )}
    </div>
  );
}
