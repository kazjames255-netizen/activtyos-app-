// Tiny synthesised WebAudio: SFX + a soft music bed. No files, nothing before a user gesture (the AudioContext is created in resume(), which the
// first tap calls), mute + volume, and it never throws (a browser without WebAudio just gets silence).

type Ctx = AudioContext;
const PENTA = [0, 2, 4, 7, 9]; // major pentatonic: every note a child can hit sounds nice
const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export interface Mood { bpm: number; chords: number[][]; arp: number[]; pad: OscillatorType; shimmer: boolean; bass: boolean; scale: number[] }
export interface GameAudio {
  resume(): void; setMuted(m: boolean): void; setVolume(v: number): void; muted(): boolean; volume(): number;
  latency(): { base: number; out: number } | null; steer(v: number): void; lock(): void; correct(streak: number, boss: boolean): void; wrong(): void; fish(n: number): void; power(): void; whoosh(): void; bump(): void;
  finish(newBest: boolean): void; breath(): void; music(on: boolean, intensity?: number): void; setMood(m: Mood): void; dispose(): void;
  // the slide game: every object has its own voice, the music layers with the streak, the wind is a real ambience
  setStreak(streak: number, boss: boolean): void; ledge(): void; hit(hard: boolean): void; smash(): void; boost(): void; launch(big: boolean): void; trick(n: number): void; land(tricks: number): void;
  flop(): void; span(open: boolean, biome: number): void; ring(): void; crystal(): void; bag(): void; phase(n: number): void; defeat(): void; chirp(up?: boolean): void; wind(k: number): void;
}

export function createAudio(opts: { muted: boolean; volume: number }): GameAudio {
  let ctx: Ctx | null = null; let master: GainNode | null = null; let sfx: GainNode | null = null; let mus: GainNode | null = null;
  let muted = opts.muted; let vol = opts.volume;
  let musicOn = false; let intensity = 0; let timer: ReturnType<typeof setInterval> | null = null; let nextBar = 0; let bar = 0;
  let noiseBuf: AudioBuffer | null = null; let lastSteer = 0;
  let streak = 0; let boss = false; let bossPhase = 1; let windGain: GainNode | null = null; let windSrc: AudioBufferSourceNode | null = null;

  const apply = () => { if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : vol, ctx.currentTime, 0.03); };
  const boot = () => {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return false;
      ctx = new AC({ latencyHint: "interactive" }); master = ctx.createGain(); sfx = ctx.createGain(); mus = ctx.createGain();
      sfx.gain.value = 0.9; mus.gain.value = 0.32;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4;
      sfx.connect(master); mus.connect(master); master.connect(comp); comp.connect(ctx.destination);
      const len = ctx.sampleRate; noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate); const d = noiseBuf.getChannelData(0);
      let seed = 1; for (let i = 0; i < len; i++) { seed = (seed * 16807) % 2147483647; d[i] = (seed / 2147483647) * 2 - 1; }
      apply();
      return true;
    } catch { ctx = null; return false; }
  };
  const ok = () => !!ctx && !!sfx && ctx.state !== "closed";

  function tone(f: number, t0: number, dur: number, o: { type?: OscillatorType; gain?: number; to?: number; bus?: GainNode; attack?: number; detune?: number } = {}) {
    if (!ctx) return;
    const osc = ctx.createOscillator(); const g = ctx.createGain();
    const jit = 1 + (Math.random() - 0.5) * 0.06; f *= jit; if (o.to) o.to *= jit;
    osc.type = o.type ?? "sine"; osc.frequency.setValueAtTime(f, t0); if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    if (o.detune) osc.detune.value = o.detune;
    const a = o.attack ?? 0.008; const peak = o.gain ?? 0.2;
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(o.bus ?? sfx!); osc.start(t0); osc.stop(t0 + dur + 0.05);
  }
  function noise(t0: number, dur: number, o: { f0: number; f1: number; q?: number; gain?: number; type?: BiquadFilterType }) {
    if (!ctx || !noiseBuf) return;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = o.type ?? "bandpass"; fl.Q.value = o.q ?? 1.2;
    fl.frequency.setValueAtTime(o.f0, t0); fl.frequency.exponentialRampToValueAtTime(o.f1, t0 + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(o.gain ?? 0.1, t0 + dur * 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(fl); fl.connect(g); g.connect(sfx!); src.start(t0); src.stop(t0 + dur + 0.05);
  }

  // Music: a mood per biome (tempo, chords, scale, pad timbre). Pad chords + a plucked arpeggio; a soft shimmer joins as the streak grows.
  let mood: Mood = { bpm: 92, chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], arp: [0, 1, 2, 1, 2, 1, 0, 2], pad: "triangle", shimmer: false, bass: false, scale: [0, 2, 4, 7, 9] };
  /** Four stems that stack with the streak: 0 pad, 1 + plucked arp, 2 + bass and hats, 3 + a lead line and a shimmering octave. A boss adds war drums and drives the tempo. */
  function scheduleBar(t0: number) {
    if (!ctx || !mus) return;
    const lvl = Math.max(intensity, Math.min(3, Math.floor(streak / 3))) + (boss ? Math.min(2, bossPhase) : 0);
    const level = Math.min(4, lvl);
    const bpm = mood.bpm * (boss ? 1.12 : 1) * (1 + Math.min(0.06, streak * 0.004));
    const beat = 60 / bpm; const chord = mood.chords[bar % mood.chords.length]!;
    const minor = boss ? -1 : 0; // a boss drops the third: darker
    for (const n of chord) tone(midi(n + (boss && n === chord[1] ? minor : 0)), t0, beat * 4.1, { type: mood.pad, gain: mood.pad === "sawtooth" ? 0.022 : 0.05, attack: 0.5, bus: mus, detune: n % 2 ? 4 : -4 });
    tone(midi(chord[0]! - 12), t0, beat * 4, { type: "sine", gain: 0.08, attack: 0.1, bus: mus });
    const pat = mood.arp;
    if (level >= 1) for (let i = 0; i < 8; i++) { if (level < 2 && i % 2) continue; tone(midi(chord[pat[i]! % chord.length]! + 12), t0 + i * beat * 0.5, beat * 0.9, { type: "sine", gain: level >= 2 ? 0.045 : 0.03, attack: 0.004, bus: mus }); }
    if (level >= 2 || mood.bass) for (let i = 0; i < 4; i++) tone(midi(chord[0]! - 24), t0 + i * beat, beat * 0.55, { type: level >= 3 ? "triangle" : "sine", gain: 0.07, attack: 0.01, bus: mus });
    if (level >= 2) for (let i = 0; i < 8; i++) noise(t0 + i * beat * 0.5, beat * 0.14, { f0: 7500, f1: 9500, q: 3, gain: i % 2 ? 0.016 : 0.009, type: "highpass" });
    if (level >= 3) { // lead: a singable line on the scale, one note a beat
      for (let i = 0; i < 4; i++) { const deg = mood.scale[(bar * 2 + i * 2 + (i === 3 ? 1 : 0)) % mood.scale.length]!; tone(midi(chord[0]! + 24 + deg), t0 + i * beat, beat * 0.85, { type: "triangle", gain: 0.05, attack: 0.02, bus: mus }); }
      for (let i = 0; i < 8; i++) tone(midi(chord[pat[(i + 3) % 8]! % chord.length]! + 24), t0 + i * beat * 0.5 + beat * 0.25, beat * 0.4, { type: "sine", gain: 0.02, attack: 0.003, bus: mus });
    }
    if (boss) { // war drums: kick on 1 and 3, snare on 2 and 4, a low saw growl
      for (const b of [0, 2]) tone(90, t0 + b * beat, 0.22, { type: "sine", gain: 0.16, to: 42, bus: mus });
      for (const b of [1, 3]) noise(t0 + b * beat, 0.16, { f0: 1800, f1: 900, q: 0.8, gain: 0.07, type: "bandpass" });
      if (bossPhase >= 2) for (let i = 0; i < 8; i++) tone(midi(chord[0]! - 24), t0 + i * beat * 0.5, beat * 0.4, { type: "sawtooth", gain: 0.02, attack: 0.01, bus: mus });
      if (bossPhase >= 3) for (let b = 0; b < 4; b++) tone(90, t0 + b * beat + beat * 0.5, 0.16, { type: "sine", gain: 0.1, to: 46, bus: mus });
    }
    bar++;
  }
  function pump() {
    if (!ctx || !musicOn || ctx.state !== "running") return;
    if (nextBar < ctx.currentTime) nextBar = ctx.currentTime + 0.05;
    while (nextBar < ctx.currentTime + 0.6) { scheduleBar(nextBar); nextBar += (60 / mood.bpm) * 4; }
  }

  return {
    resume() {
      if (!boot()) return;
      if (ctx!.state === "suspended") void ctx!.resume();
      try { const b = ctx!.createBuffer(1, 1, 22050); const src = ctx!.createBufferSource(); src.buffer = b; src.connect(ctx!.destination); src.start(0); } catch { /* iOS unlock: a silent tick inside the user gesture */ }
    },
    latency() { return ctx ? { base: ctx.baseLatency ?? 0, out: (ctx as unknown as { outputLatency?: number }).outputLatency ?? 0 } : null; },
    setMuted(m) { muted = m; apply(); },
    setVolume(v) { vol = Math.max(0, Math.min(1, v)); apply(); },
    muted: () => muted, volume: () => vol,
    steer(v) { if (!ok() || muted) return; const now = ctx!.currentTime; if (now - lastSteer < 0.16) return; lastSteer = now; noise(now, 0.16, { f0: 900 + Math.abs(v) * 500, f1: 2600, q: 0.8, gain: 0.05 }); },
    lock() { if (!ok() || muted) return; const t = ctx!.currentTime; tone(880, t, 0.06, { type: "triangle", gain: 0.07 }); },
    correct(st, boss2) {
      if (!ok() || muted) return; streak = st; const t = ctx!.currentTime;
      const step = Math.min(st, 9); const base = 72 + PENTA[step % 5]! + 12 * Math.floor(step / 5);
      noise(t, 0.03, { f0: 3000, f1: 6000, q: 2, gain: 0.09, type: "highpass" });                  // 1. transient tick (0 ms)
      tone(midi(base), t + 0.01, 0.34, { type: "sine", gain: 0.2 }); tone(midi(base) * 2, t + 0.01, 0.22, { type: "sine", gain: 0.05 }); // 2. the note
      tone(midi(base + 7), t + 0.06, 0.4, { type: "triangle", gain: 0.11 }); if (streak % 3 === 0 || boss2) this.chirp(true);
      noise(t + 0.04, 0.36, { f0: 5200, f1: 9000, q: 4, gain: 0.05, type: "highpass" });            // 3. sparkle tail (40-400 ms)
      if (boss2) [0, 4, 7, 12].forEach((s2, i) => tone(midi(72 + s2), t + 0.1 + i * 0.07, 0.6, { type: "triangle", gain: 0.12 }));
    },
    wrong() { if (!ok() || muted) return; const t = ctx!.currentTime; tone(190, t, 0.12, { type: "sine", gain: 0.2, to: 110 }); noise(t, 0.09, { f0: 420, f1: 180, q: 0.7, gain: 0.06, type: "lowpass" }); },
    fish(n) { if (!ok() || muted) return; const t = ctx!.currentTime; tone(midi(84 + PENTA[n % 5]!), t, 0.16, { type: "sine", gain: 0.1 }); },
    power() { if (!ok() || muted) return; const t = ctx!.currentTime; [0, 4, 7, 12, 16].forEach((s, i) => tone(midi(76 + s), t + i * 0.055, 0.28, { type: "triangle", gain: 0.12 })); },
    whoosh() { if (!ok() || muted) return; noise(ctx!.currentTime, 0.5, { f0: 400, f1: 3200, q: 0.6, gain: 0.09 }); },
    bump() { if (!ok() || muted) return; const t = ctx!.currentTime; tone(130, t, 0.14, { type: "sine", gain: 0.14, to: 80 }); },
    breath() { if (!ok() || muted) return; const t = ctx!.currentTime; tone(midi(60), t, 1.4, { type: "sine", gain: 0.1, attack: 0.5 }); tone(midi(67), t + 0.1, 1.4, { type: "sine", gain: 0.07, attack: 0.5 }); },
    finish(newBest) {
      if (!ok() || muted) return; const t = ctx!.currentTime;
      const seq = newBest ? [0, 4, 7, 12, 16, 19, 24] : [0, 4, 7, 12];
      seq.forEach((s, i) => tone(midi(69 + s), t + i * 0.1, 0.7, { type: "triangle", gain: 0.14 }));
      if (newBest) for (let i = 0; i < 8; i++) tone(midi(93 + PENTA[i % 5]!), t + 0.5 + i * 0.06, 0.3, { type: "sine", gain: 0.05 });
    },
    music(on, i = 0) {
      intensity = i; if (on === musicOn) return; musicOn = on;
      if (on) { if (!ctx) return; nextBar = 0; pump(); timer = setInterval(pump, 120); } else if (timer) { clearInterval(timer); timer = null; }
    },
    setMood(m) { mood = m; bar = 0; },
    setStreak(n, b) { if (b && !boss) bossPhase = 1; streak = n; boss = b; },
    chirp(up = true) { if (!ok() || muted) return; const t = ctx!.currentTime; tone(up ? 1100 : 900, t, 0.09, { type: "sine", gain: 0.07, to: up ? 1750 : 620 }); tone(up ? 1500 : 800, t + 0.07, 0.07, { type: "sine", gain: 0.05, to: up ? 2100 : 560 }); },
    ledge() { if (!ok() || muted) return; const t = ctx!.currentTime; noise(t, 0.35, { f0: 2400, f1: 500, q: 0.7, gain: 0.07, type: "lowpass" }); tone(midi(79), t + 0.2, 0.35, { type: "sine", gain: 0.07 }); tone(midi(72), t + 0.32, 0.5, { type: "sine", gain: 0.07 }); },
    hit(hard) { if (!ok() || muted) return; const t = ctx!.currentTime; tone(hard ? 150 : 210, t, 0.2, { type: "sine", gain: 0.24, to: 60 }); noise(t, hard ? 0.22 : 0.12, { f0: 1600, f1: 300, q: 0.7, gain: hard ? 0.14 : 0.07 }); if (hard) { tone(midi(52), t + 0.02, 0.35, { type: "sawtooth", gain: 0.05, to: 90 }); this.chirp(false); } },
    smash() { if (!ok() || muted) return; const t = ctx!.currentTime; noise(t, 0.18, { f0: 5000, f1: 1400, q: 1.2, gain: 0.16, type: "highpass" }); tone(320, t, 0.12, { type: "square", gain: 0.06, to: 120 }); tone(midi(84), t + 0.06, 0.15, { type: "sine", gain: 0.08 }); },
    boost() { if (!ok() || muted) return; const t = ctx!.currentTime; noise(t, 0.4, { f0: 600, f1: 5200, q: 0.6, gain: 0.1 }); [0, 4, 7].forEach((s2, i) => tone(midi(72 + s2), t + i * 0.05, 0.22, { type: "triangle", gain: 0.09 })); },
    launch(big) { if (!ok() || muted) return; const t = ctx!.currentTime; tone(220, t, big ? 0.7 : 0.4, { type: "sawtooth", gain: 0.05, to: big ? 1300 : 800 }); noise(t, big ? 0.7 : 0.4, { f0: 500, f1: 6000, q: 0.7, gain: 0.1 }); if (big) [0, 7, 12, 19].forEach((s2, i) => tone(midi(72 + s2), t + 0.15 + i * 0.07, 0.6, { type: "triangle", gain: 0.1 })); this.chirp(true); },
    trick(n) { if (!ok() || muted) return; const t = ctx!.currentTime; for (let i = 0; i < 3 + n; i++) tone(midi(84 + PENTA[(i + n) % 5]! + 12 * Math.floor((i + n) / 5)), t + i * 0.05, 0.22, { type: "sine", gain: 0.09 }); noise(t, 0.25, { f0: 4000, f1: 9000, q: 2, gain: 0.05, type: "highpass" }); if (n >= 2) this.chirp(true); },
    land(tricks) { if (!ok() || muted) return; const t = ctx!.currentTime; tone(110, t, 0.2, { type: "sine", gain: 0.2, to: 55 }); noise(t, 0.25, { f0: 2400, f1: 500, q: 0.7, gain: 0.11, type: "lowpass" }); if (tricks > 0) [0, 4, 7, 12].slice(0, 1 + tricks).forEach((s2, i) => tone(midi(76 + s2), t + 0.05 + i * 0.06, 0.35, { type: "triangle", gain: 0.1 })); },
    flop() { if (!ok() || muted) return; const t = ctx!.currentTime; noise(t, 0.4, { f0: 3200, f1: 600, q: 0.8, gain: 0.1, type: "bandpass" }); tone(700, t, 0.3, { type: "sine", gain: 0.06, to: 300 }); },
    span(open, biome) {
      if (!ok() || muted) return; const t = ctx!.currentTime;
      if (!open) { tone(midi(64), t, 0.28, { type: "triangle", gain: 0.1, to: midi(58) }); tone(midi(57), t + 0.2, 0.4, { type: "triangle", gain: 0.1, to: midi(50) }); return; }
      if (biome === 1) { for (let i = 0; i < 9; i++) noise(t + i * 0.045, 0.06, { f0: 7000, f1: 9500, q: 4, gain: 0.07, type: "highpass" }); [0, 4, 7, 12, 16, 19].forEach((s2, i) => tone(midi(84 + s2), t + 0.05 + i * 0.06, 0.6, { type: "sine", gain: 0.1 })); }
      else if (biome === 2) { tone(180, t, 0.5, { type: "sawtooth", gain: 0.05, to: 1500 }); [0, 7, 12, 16, 19, 24].forEach((s2, i) => tone(midi(72 + s2), t + 0.2 + i * 0.06, 0.6, { type: "triangle", gain: 0.1 })); }
      else if (biome === 3) { noise(t, 0.6, { f0: 500, f1: 120, q: 0.6, gain: 0.16, type: "lowpass" }); [0, 3, 7, 10, 12].forEach((s2, i) => tone(midi(60 + s2), t + 0.25 + i * 0.09, 0.8, { type: "sine", gain: 0.1 })); }
      else if (biome === 4) { tone(150, t, 1.2, { type: "sine", gain: 0.16, to: 96 }); tone(228, t + 0.05, 1.1, { type: "sine", gain: 0.06, to: 130 }); for (let i = 0; i < 5; i++) tone(500 + i * 130, t + 0.4 + i * 0.09, 0.09, { type: "sine", gain: 0.05, to: 900 + i * 100 }); }
      else { [0, 4, 7, 11, 14, 19, 23, 26].forEach((s2, i) => tone(midi(72 + s2), t + i * 0.07, 0.9, { type: "sine", gain: 0.09 })); noise(t, 0.8, { f0: 4000, f1: 9000, q: 2, gain: 0.05, type: "highpass" }); }
    },
    ring() { if (!ok() || muted) return; const t = ctx!.currentTime; tone(midi(88), t, 0.5, { type: "sine", gain: 0.09 }); tone(midi(95), t + 0.04, 0.5, { type: "sine", gain: 0.05 }); },
    crystal() { if (!ok() || muted) return; const t = ctx!.currentTime; tone(midi(91), t, 0.6, { type: "sine", gain: 0.09 }); tone(midi(98), t + 0.05, 0.5, { type: "sine", gain: 0.05 }); noise(t, 0.3, { f0: 6000, f1: 9000, q: 4, gain: 0.04, type: "highpass" }); },
    bag() { if (!ok() || muted) return; const t = ctx!.currentTime; [0, 4, 7, 12, 16].forEach((s2, i) => tone(midi(72 + s2), t + i * 0.06, 0.4, { type: "triangle", gain: 0.12 })); this.chirp(true); },
    phase(n) { if (!ok() || muted) return; const t = ctx!.currentTime; bossPhase = n; tone(midi(43), t, 0.9, { type: "sawtooth", gain: 0.09, to: midi(41) }); tone(midi(50), t, 0.9, { type: "sawtooth", gain: 0.06 }); for (let i = 0; i < 3; i++) tone(80, t + i * 0.13, 0.25, { type: "sine", gain: 0.2, to: 40 }); noise(t, 0.7, { f0: 300, f1: 90, q: 0.6, gain: 0.12, type: "lowpass" }); },
    defeat() { if (!ok() || muted) return; const t = ctx!.currentTime; tone(midi(50), t, 1.2, { type: "sawtooth", gain: 0.08, to: midi(33) }); noise(t, 1.0, { f0: 1200, f1: 100, q: 0.6, gain: 0.14, type: "lowpass" }); [0, 4, 7, 12, 16, 19, 24, 28].forEach((s2, i) => tone(midi(69 + s2), t + 1.0 + i * 0.09, 0.9, { type: "triangle", gain: 0.14 })); for (let i = 0; i < 10; i++) tone(midi(93 + PENTA[i % 5]!), t + 1.6 + i * 0.07, 0.3, { type: "sine", gain: 0.05 }); },
    wind(k) {
      if (!ctx || !noiseBuf || !sfx) return;
      if (!windSrc) { windSrc = ctx.createBufferSource(); windSrc.buffer = noiseBuf; windSrc.loop = true; const fl = ctx.createBiquadFilter(); fl.type = "bandpass"; fl.frequency.value = 500; fl.Q.value = 0.6; windGain = ctx.createGain(); windGain.gain.value = 0; windSrc.connect(fl); fl.connect(windGain); windGain.connect(sfx); windSrc.start(); }
      windGain!.gain.setTargetAtTime(muted ? 0 : Math.min(1, k) * 0.09, ctx.currentTime, 0.25);
    },
    dispose() { if (timer) clearInterval(timer); timer = null; musicOn = false; try { windSrc?.stop(); } catch { /* ignore */ } windSrc = null; try { void ctx?.close(); } catch { /* ignore */ } ctx = null; },
  };
}
