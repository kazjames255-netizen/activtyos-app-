"use client";

import { useEffect, useRef } from "react";
import { NARRATOR_CSS, narratorScene, settingsScene, type SettingsLink } from "./tourNarrator";

// ─────────────────────────────────────────────────────────────────────────
// A reusable, self-driving, narrated "watch me use it" walkthrough. Feed it a
// config (title + intro/done lines + a list of steps, each with a pre-filled
// mock body of HTML and a one-line narration) and it plays a guided tour:
// shiny ActivityOS splash → step-by-step frames with a moving cursor and a
// British voice → done. Play / Pause / ⏮ / ⏭ / Sound + voice picker.
//
// Step bodies use the shared "atom" classes below and should already be filled
// with realistic sample data so the visuals match what real data looks like.
// ─────────────────────────────────────────────────────────────────────────

export type TourStep = { label: string; stage: string; line: string; bodyHtml: string };
export type TourConfig = { title: string; introLine: string; doneLine: string; steps: TourStep[]; introHtml?: string; settings?: SettingsLink[] };

const CSS = `
.gt-root{--navy:#16306e;--blue:#2f6bd8;--blue2:#4f8bf5;--teal:#0ea5a5;--green:#0e9a5a;--ink:#12203c;--ink2:#3a4a68;--muted:#5b6b86;--faint:#9aa6bd;--line:#e6ebf5;--panel:#f4f7fc;--surface:#fff;--brandink:#1d3a8f;color:var(--ink)}
.gt-root .gt-controls{margin:0 0 12px;display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.gt-root .cbtn{border:1px solid var(--line);background:var(--surface);border-radius:11px;padding:11px 20px;font-size:14px;font-weight:800;color:var(--ink);cursor:pointer}.gt-root .cbtn:hover{border-color:#bcd0f5;background:#f4f8ff}.gt-root .cbtn.on{background:linear-gradient(180deg,var(--blue2),var(--blue));border-color:transparent;color:#fff}
.gt-root .gt-count{font-size:11.5px;color:var(--faint);font-weight:700;margin-right:auto}
.gt-root .gt-stage{position:relative;background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:16px;box-shadow:0 24px 50px -36px rgba(20,48,110,.5);min-height:320px;overflow:hidden}
.gt-root .appear{animation:gtrise .4s ease both}@keyframes gtrise{from{opacity:0;transform:translateY(9px)}to{opacity:1;transform:none}}
.gt-root .field{border:1px solid var(--line);background:var(--surface);border-radius:9px;padding:8px 10px;font-size:12.5px;color:var(--ink);font-weight:600;min-height:34px}.gt-root .field.ph{color:var(--faint);font-weight:500}
.gt-root .row2{display:flex;gap:10px}.gt-root .row2>div{flex:1}
.gt-root .btn{border-radius:999px;padding:8px 15px;font-size:12.5px;font-weight:800;border:1px solid var(--line);background:var(--surface);color:var(--ink2);display:inline-block}.gt-root .btn.amber{background:linear-gradient(180deg,#f7c65a,#f0a92f);border-color:transparent;color:#5b3d05}.gt-root .btn.ghost{color:var(--faint)}
.gt-root .wcard{border:1px solid var(--line);border-radius:16px;overflow:hidden}
.gt-root .whead{display:flex;align-items:flex-start;gap:10px;padding:12px 15px;background:#f4f8ff;border-bottom:1px solid var(--line)}
.gt-root .wstage{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:var(--blue)}.gt-root .wtitle{font-size:16px;font-weight:800;color:var(--navy);margin-top:1px}
.gt-root .wstep{margin-left:auto;font-size:11px;font-weight:800;color:var(--faint);white-space:nowrap;padding-top:2px}
.gt-root .wbar{height:4px;background:var(--line)}.gt-root .wbar span{display:block;height:100%;background:linear-gradient(90deg,var(--blue2),var(--blue));transition:width .5s}
.gt-root .wbody{padding:15px;min-height:150px}
.gt-root .wfoot{display:flex;justify-content:space-between;padding:12px 15px;border-top:1px solid var(--line);background:#fbfdff}
.gt-root .frm{display:flex;flex-direction:column;gap:11px}
.gt-root .fl{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;color:var(--faint);margin-bottom:4px}
.gt-root .hint{font-size:11.5px;color:var(--muted);line-height:1.5}
.gt-root .g{color:var(--faint);font-weight:600}
.gt-root .chips{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.gt-root .ochip{font-size:11.5px;font-weight:800;background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:5px 10px}
.gt-root .chip2{display:inline-block;font-size:10.5px;font-weight:800;background:#eef4fd;color:var(--brandink);border-radius:999px;padding:3px 9px;margin:0 5px 5px 0}
.gt-root .chk{display:flex;align-items:center;gap:9px;border:1px solid var(--line);border-radius:10px;padding:8px 11px;font-size:12.5px;font-weight:700;margin-bottom:6px}.gt-root .chk .chkbx{width:18px;height:18px;border-radius:5px;background:var(--blue);display:grid;place-items:center;font-size:11px;color:#fff;flex:none}
.gt-root .tkt{border:1px solid var(--line);border-left:3px solid var(--blue);border-radius:10px;padding:9px 11px;margin-bottom:7px}.gt-root .tkhd{display:flex;align-items:center;gap:8px;font-size:13px}.gt-root .tkp{margin-left:auto;font-weight:800}
.gt-root .prevcard{border:1px solid var(--line);border-radius:12px;overflow:hidden;box-shadow:0 12px 30px -22px rgba(20,48,110,.5);max-width:340px}.gt-root .prevcard .ph{height:78px;background:linear-gradient(135deg,#2f6bd8,#3fd0c9);display:grid;place-items:center;font-size:26px}.gt-root .prevcard .pb{padding:10px 12px}.gt-root .prevcard .pt{font-size:13px;font-weight:800}.gt-root .prevcard .pm{font-size:11px;color:var(--faint);margin-top:2px}.gt-root .prevcard .pp{font-size:13px;font-weight:800;color:var(--green);margin-top:6px}
.gt-root .gt-cursor{position:absolute;left:0;top:0;z-index:20;pointer-events:none;transition:transform .55s cubic-bezier(.5,.05,.25,1);filter:drop-shadow(0 3px 4px rgba(20,48,110,.35))}.gt-root .gt-cursor.down{transition:transform .1s}
.gt-root .gt-cursor .ring{position:absolute;left:-9px;top:-9px;width:34px;height:34px;border-radius:50%;border:2px solid var(--blue);opacity:0}.gt-root .gt-cursor.click .ring{animation:gtclk .4s ease-out}@keyframes gtclk{0%{opacity:.7;transform:scale(.3)}100%{opacity:0;transform:scale(1)}}
.gt-root .gt-cap{margin-top:12px;background:var(--surface);border:1px solid var(--line);border-left:4px solid var(--teal);border-radius:12px;padding:11px 13px;font-size:12.5px;line-height:1.55;color:var(--ink2);min-height:42px}.gt-root .gt-cap b{color:var(--ink)}
.gt-root .gt-splash{position:absolute;inset:0;z-index:30;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:radial-gradient(130% 120% at 50% 0%,#1b3f8f,#0b1020 75%);transition:opacity .5s ease;overflow:hidden}
.gt-root .gt-splash.hide{opacity:0;pointer-events:none}
.gt-root .gt-splash::before{content:"";position:absolute;top:0;left:-70%;width:55%;height:100%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.28),transparent);transform:skewX(-18deg);animation:gtshine 2s ease-in-out .2s}
@keyframes gtshine{0%{left:-70%}100%{left:130%}}
.gt-root .splmark{font-size:28px;color:#7fd0ff;animation:gtspin 3s linear infinite;text-shadow:0 0 18px rgba(80,170,255,.7)}@keyframes gtspin{to{transform:rotate(360deg)}}
.gt-root .splogo{font-size:38px;font-weight:900;letter-spacing:-1px;background:linear-gradient(90deg,#7fd0ff,#ffffff 45%,#7fd0ff);-webkit-background-clip:text;background-clip:text;color:transparent;animation:gtsppop .6s ease both;filter:drop-shadow(0 2px 10px rgba(80,170,255,.4))}
.gt-root .splos{-webkit-text-fill-color:#ff5aa8;color:#ff5aa8;background:none;filter:drop-shadow(0 2px 10px rgba(255,90,168,.5))}
.gt-root .sptitle{font-size:17px;font-weight:800;color:#e6f0ff;animation:gtsppop .6s ease .1s both}
.gt-root .spsub{font-size:11.5px;font-weight:700;color:#9fb4dd;animation:gtsppop .6s ease .2s both}
@keyframes gtsppop{from{opacity:0;transform:translateY(8px) scale(.96)}to{opacity:1;transform:none}}
`;
// Intro + done bookends use the shared robot-narrator scene (tourNarrator.tsx)
// so GuidedTour and the bespoke Blocks/Listings tours look identical.
const scene = narratorScene;

export function GuidedTour({ config }: { config: TourConfig }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const cfgRef = useRef(config);
  cfgRef.current = config;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const stage = root.querySelector(".gt-stage") as HTMLElement;
    const content = root.querySelector(".gt-content") as HTMLElement;
    const cursor = root.querySelector(".gt-cursor") as HTMLElement;
    const capEl = root.querySelector(".gt-cap") as HTMLElement;
    const splash = root.querySelector(".gt-splash") as HTMLElement | null;
    const replayBtn = root.querySelector(".gt-replay") as HTMLElement;
    const pauseBtn = root.querySelector(".gt-pause") as HTMLElement;
    const backBtn = root.querySelector(".gt-back") as HTMLElement;
    const fwdBtn = root.querySelector(".gt-fwd") as HTMLElement;
    const soundBtn = root.querySelector(".gt-sound") as HTMLElement;
    const hasSpeech = typeof window !== "undefined" && "speechSynthesis" in window;

    let token = 0, dead = false, soundOn = false, paused = false, currentIdx = -1;
    const waiters: (() => void)[] = [];
    let voice: SpeechSynthesisVoice | null = null;
    let speaking: Promise<unknown> = Promise.resolve();
    const gate = () => (paused ? new Promise<void>((r) => waiters.push(r)) : Promise.resolve());
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms)).then(gate);
    const strip = (h: string) => h.replace(/<[^>]+>/g, "").replace(/&amp;/g, " and ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;|&rsquo;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/[—–]/g, ", ").replace(/\s+/g, " ").trim();
    const readMs = (t: string) => Math.max(2400, t.split(/\s+/).length * 330);

    // One fixed narrator: "Google UK English Female" when available (Chrome),
    // otherwise the closest British female / en-GB voice. No picker — every tour
    // sounds the same on a given device.
    function pickVoice(): SpeechSynthesisVoice | null {
      if (!hasSpeech) return null;
      const vs = window.speechSynthesis.getVoices(); if (!vs.length) return null;
      return vs.find((v) => v.name === "Google UK English Female")
        || vs.find((v) => /en-GB/i.test(v.lang) && /female|Sonia|Serena|Kate|Fiona|Libby|Hazel/i.test(v.name))
        || vs.find((v) => /en-GB/i.test(v.lang))
        || vs.find((v) => /^en/i.test(v.lang)) || vs[0];
    }
    function speak(t: string) {
      if (!soundOn || !hasSpeech || !t) { speaking = Promise.resolve(); return; }
      const s = window.speechSynthesis; s.cancel();
      const u = new SpeechSynthesisUtterance(t);
      if (voice) { u.voice = voice; u.lang = voice.lang; }
      u.rate = 1.0; u.pitch = 1.05;
      // Move the robot's mouth only while it's genuinely speaking.
      const mouth = (on: boolean) => rootRef.current?.querySelector(".tnr-bot")?.classList.toggle("speaking", on);
      u.onstart = () => mouth(true);
      speaking = Promise.race([new Promise((res) => { u.onend = () => { mouth(false); res(undefined); }; u.onerror = () => { mouth(false); res(undefined); }; }), sleep(22000).then(() => mouth(false))]);
      s.speak(u);
    }
    async function line(h: string) { await speaking; capEl.innerHTML = h; const t = strip(h); speak(t); await Promise.all([speaking, sleep(readMs(t))]); }
    async function move(id: string, ox = 0.5, oy = 0.6) {
      const e = content.querySelector("#" + id) as HTMLElement | null;
      if (e) { const r = e.getBoundingClientRect(), s = stage.getBoundingClientRect(); cursor.classList.remove("down"); cursor.style.transform = `translate(${r.left - s.left + r.width * ox}px,${r.top - s.top + r.height * oy}px) scale(1)`; }
      await sleep(650);
    }
    async function click() {
      cursor.classList.add("down", "click"); cursor.style.transform = cursor.style.transform.replace("scale(1)", "scale(.82)"); await sleep(150);
      cursor.classList.remove("down"); cursor.style.transform = cursor.style.transform.replace("scale(.82)", "scale(1)"); await sleep(120);
      cursor.classList.remove("click");
    }
    const frame = (i: number) => {
      const cfg = cfgRef.current, s = cfg.steps[i], pct = Math.round((i + 1) / cfg.steps.length * 100);
      return `<div class="wcard"><div class="whead"><div><div class="wstage">${s.stage}</div><div class="wtitle">${s.label}</div></div><div class="wstep">Step ${i + 1} of ${cfg.steps.length}</div></div>
        <div class="wbar"><span style="width:${pct}%"></span></div>
        <div class="wbody">${s.bodyHtml}</div>
        <div class="wfoot"><span class="btn ghost">← Back</span><span class="btn amber" id="gtnext">${i === cfg.steps.length - 1 ? "Done ✓" : "Next →"}</span></div></div>`;
    };
    const doneView = scene("✓ Complete", "All done", "You've seen the essentials of this page.");

    async function run(startIdx = 0) {
      const cfg = cfgRef.current;
      const portal = (typeof window !== "undefined" ? window.location.pathname.split("/")[1] : "") || "freelancer";
      const tk = ++token; const alive = () => tk === token && !dead;
      if (hasSpeech) window.speechSynthesis.cancel();
      paused = false; waiters.splice(0).forEach((f) => f()); if (pauseBtn) pauseBtn.textContent = "⏸";
      cursor.style.transform = "translate(24px,20px) scale(1)";
      if (startIdx <= 0) {
        if (splash) { splash.style.display = "flex"; splash.classList.remove("hide"); void splash.offsetWidth; await sleep(2200); if (!alive()) return; splash.classList.add("hide"); await sleep(500); splash.style.display = "none"; }
        currentIdx = -1; content.innerHTML = scene("Guided walkthrough", cfg.title, "Sit back — I'll show you round this page.");
        await line(cfg.introLine); if (!alive()) return;
      } else if (splash) { splash.style.display = "none"; }
      for (let i = Math.max(0, startIdx); i < cfg.steps.length; i++) {
        currentIdx = i; content.innerHTML = frame(i);
        const act = (async () => { await sleep(500); await move("gtnext"); await click(); })();
        await line(cfg.steps[i].line); await act; if (!alive()) return;
      }
      // Settings reminder — the robot beams down direct links to the Settings
      // tabs that control features on this page (shown before the sign-off).
      if (cfg.settings?.length) {
        currentIdx = cfg.steps.length; content.innerHTML = settingsScene(portal, cfg.settings);
        const names = cfg.settings.map((x) => x.label).join(", ");
        await line(`One last thing — a few of these live in your Settings: ${names}. Tap any card to jump straight there.`);
        if (!alive()) return;
      }
      currentIdx = cfg.steps.length; content.innerHTML = doneView;
      if (!alive()) return; await line(cfg.doneLine);
    }

    const setSound = (on: boolean) => { soundOn = on; soundBtn.classList.toggle("on", on); soundBtn.textContent = on ? "🔊 Sound on" : "▶ Play with sound"; capEl.style.display = on ? "none" : ""; };
    // Voices load asynchronously — poll until the fixed narrator resolves.
    let vp = 0; const pollIv = hasSpeech ? window.setInterval(() => { if (window.speechSynthesis.getVoices().length) { voice = pickVoice(); window.clearInterval(pollIv); } else if (++vp > 24) window.clearInterval(pollIv); }, 250) : 0;
    if (hasSpeech) { voice = pickVoice(); window.speechSynthesis.onvoiceschanged = () => { voice = pickVoice(); }; }
    replayBtn.onclick = () => { run(0); };
    if (backBtn) backBtn.onclick = () => { run(currentIdx - 1); };
    if (fwdBtn) fwdBtn.onclick = () => { run(currentIdx + 1); };
    soundBtn.onclick = () => { const on = !soundOn; setSound(on); if (hasSpeech) window.speechSynthesis.cancel(); if (on) speak(strip(capEl.innerHTML)); };
    if (pauseBtn) pauseBtn.onclick = () => { paused = !paused; pauseBtn.textContent = paused ? "▶" : "⏸"; pauseBtn.title = paused ? "Resume" : "Pause"; if (hasSpeech) { if (paused) window.speechSynthesis.pause(); else window.speechSynthesis.resume(); root.querySelector(".tnr-bot")?.classList.toggle("speaking", !paused && soundOn && window.speechSynthesis.speaking); } if (!paused) waiters.splice(0).forEach((f) => f()); };
    run();

    return () => { dead = true; token++; window.clearInterval(pollIv); if (hasSpeech) { window.speechSynthesis.cancel(); window.speechSynthesis.onvoiceschanged = null; } };
  }, []);

  return (
    <div className="gt-root" ref={rootRef}>
      <style>{CSS + NARRATOR_CSS}</style>
      <div className="tctl gt-controls">
        <span className="tctl-count gt-count" />
        <div className="tctl-grp">
          <button type="button" className="tctl-btn ico gt-back" title="Back a step" aria-label="Back a step">⏮</button>
          <button type="button" className="tctl-btn primary gt-pause" title="Pause or resume" aria-label="Pause or resume">⏸</button>
          <button type="button" className="tctl-btn ico gt-fwd" title="Skip forward" aria-label="Skip forward">⏭</button>
        </div>
        <button type="button" className="tctl-btn gt-replay" title="Start again">↺ Replay</button>
        <button type="button" className="tctl-btn gt-sound">▶ Play with sound</button>
      </div>
      <div className="gt-stage">
        <div className="gt-cursor down"><span className="ring" /><svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 2 L4 19 L8.5 14.5 L11.5 21.5 L14 20.5 L11 13.8 L18 13.8 Z" fill="#12203c" stroke="#fff" strokeWidth="1.3" strokeLinejoin="round" /></svg></div>
        <div className="gt-content" />
        <div className="gt-splash"><div className="splmark">◈</div><div className="splogo">Activity<span className="splos">OS</span></div><div className="sptitle">{config.title}</div><div className="spsub">a quick guided walkthrough</div></div>
      </div>
      <div className="gt-cap" />
    </div>
  );
}
