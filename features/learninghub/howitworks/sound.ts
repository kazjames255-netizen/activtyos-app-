// Sound design for the explainers, all made in the browser with WebAudio (no files): a soft, warm, loopable music bed that ducks under the
// voice, and tiny UI cues (click, whoosh, pop, chime). Nothing is created before a gesture (start() is only called from the play click),
// and everything is gated by the caller's sound / music preferences and by prefers-reduced-motion for the music.

type Ctx = AudioContext;
let ctx: Ctx | null = null;
let master: GainNode | null = null;
let bed: GainNode | null = null;
let bedTimer: number | null = null;
let musicOn = false;
let step = 0;

const AC = (): typeof AudioContext | null => (typeof window === "undefined" ? null : window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ?? null);
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

/** Create / resume the audio graph. Call from a click or key handler only. */
export function unlock(): boolean {
  const C = AC(); if (!C) return false;
  try {
    if (!ctx) {
      ctx = new C(); master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      bed = ctx.createGain(); bed.gain.value = 0; bed.connect(master);
    }
    if (ctx.state === "suspended") void ctx.resume();
    return true;
  } catch { return false; }
}

// A calm four-chord loop (Cmaj9 - Am9 - Fmaj9 - G6), a slow pad plus a soft pluck arpeggio. 72 bpm, one chord per bar.
const CHORDS: number[][] = [[48, 55, 59, 62, 64], [45, 52, 57, 60, 64], [41, 48, 55, 60, 64], [43, 50, 55, 59, 64]];
const BAR = 60 / 72 * 4;
function pad(c: Ctx, out: AudioNode, notes: number[], t: number, len: number) {
  const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + 1.2); g.gain.linearRampToValueAtTime(0.35, t + len - 0.6); g.gain.linearRampToValueAtTime(0, t + len + 0.8);
  const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900; lp.Q.value = 0.4;
  g.connect(lp); lp.connect(out);
  notes.forEach((n, i) => { for (const det of [-6, 5]) { const o = c.createOscillator(); o.type = i === 0 ? "sine" : "triangle"; o.frequency.value = hz(n); o.detune.value = det; const og = c.createGain(); og.gain.value = 0.11 / (1 + i * 0.25); o.connect(og); og.connect(g); o.start(t); o.stop(t + len + 1); } });
}
function pluck(c: Ctx, out: AudioNode, note: number, t: number) {
  const o = c.createOscillator(); o.type = "sine"; o.frequency.value = hz(note);
  const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.18, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0008, t + 1.1);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + 1.2);
}
function scheduleBar() {
  if (!ctx || !bed || !musicOn) return;
  const t = ctx.currentTime + 0.05; const ch = CHORDS[step % CHORDS.length]; step++;
  pad(ctx, bed, ch, t, BAR);
  const arp = [ch[2], ch[3], ch[4], ch[3], ch[4] + 12, ch[3], ch[4], ch[2] + 12];
  arp.forEach((n, i) => pluck(ctx!, bed!, n + 12, t + i * (BAR / 8)));
}
export function musicStart(level = 0.09): void {
  if (!ctx || !bed || musicOn) return;
  musicOn = true; bed.gain.cancelScheduledValues(ctx.currentTime); bed.gain.setTargetAtTime(level, ctx.currentTime, 0.6);
  scheduleBar(); bedTimer = window.setInterval(scheduleBar, BAR * 1000);
}
export function musicStop(): void {
  if (bedTimer != null) { clearInterval(bedTimer); bedTimer = null; }
  musicOn = false;
  if (ctx && bed) { bed.gain.cancelScheduledValues(ctx.currentTime); bed.gain.setTargetAtTime(0, ctx.currentTime, 0.25); }
}
/** Lower the bed under the voice (true) or bring it back up (false). */
export function duck(on: boolean, level = 0.09): void {
  if (!ctx || !bed || !musicOn) return;
  bed.gain.cancelScheduledValues(ctx.currentTime); bed.gain.setTargetAtTime(on ? level * 0.42 : level, ctx.currentTime, on ? 0.15 : 0.5);
}

export type Cue = "click" | "whoosh" | "pop" | "chime" | "tick";
/** One tiny UI sound. `vol` scales it (a child's version is softer). */
export function cue(kind: Cue, vol = 1): void {
  if (!ctx || !master || ctx.state !== "running") return;
  const c = ctx; const t = c.currentTime;
  const out = c.createGain(); out.connect(master);
  if (kind === "click" || kind === "tick") {
    const o = c.createOscillator(); o.type = "triangle"; o.frequency.setValueAtTime(kind === "click" ? 1500 : 2100, t); o.frequency.exponentialRampToValueAtTime(kind === "click" ? 420 : 900, t + 0.05);
    out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(0.16 * vol, t + 0.004); out.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(out); o.start(t); o.stop(t + 0.08);
  } else if (kind === "pop") {
    const o = c.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(380, t); o.frequency.exponentialRampToValueAtTime(760, t + 0.09);
    out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(0.13 * vol, t + 0.01); out.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(out); o.start(t); o.stop(t + 0.18);
  } else if (kind === "whoosh") {
    const len = Math.floor(c.sampleRate * 0.45); const buf = c.createBuffer(1, len, c.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = buf;
    const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 0.9; bp.frequency.setValueAtTime(300, t); bp.frequency.exponentialRampToValueAtTime(2600, t + 0.4);
    out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(0.09 * vol, t + 0.12); out.gain.exponentialRampToValueAtTime(0.0001, t + 0.44);
    src.connect(bp); bp.connect(out); src.start(t);
  } else {
    [784, 1175, 1568].forEach((f, i) => {
      const o = c.createOscillator(); o.type = "sine"; o.frequency.value = f; const g = c.createGain(); const s = t + i * 0.09;
      g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.12 * vol, s + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.7);
      o.connect(g); g.connect(out); o.start(s); o.stop(s + 0.75);
    });
  }
  window.setTimeout(() => { try { out.disconnect(); } catch { /* gone */ } }, 1200);
}
export function soundClose(): void { musicStop(); }
