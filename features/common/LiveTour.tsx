"use client";

import { useEffect, useRef } from "react";
import { SETTINGS_LINKS } from "./tourSteps";
import { NARRATOR_CSS, narratorScene, settingsScene } from "./tourNarrator";

// A narrated walkthrough that drives the REAL page. It embeds /tour/<portal>/<view>
// (the real component populated with demo fixtures) in an iframe, then for each
// step asks the iframe to spotlight a section (by the text it renders), points a
// moving cursor at it, and narrates a line in the fixed British voice. Same
// controls + splash as GuidedTour; the difference is the stage is the live page,
// not a hand-drawn mock — so what you see is exactly the real screen.

export type LiveStep = {
  find?: string; line: string; label?: string;
  click?: boolean;              // press the `find` element (open its form)
  advance?: string;            // after narrating, press the element matching this text
  fill?: [string, string][];   // [field label/placeholder, value] — types into real inputs
  pick?: string[];             // chip / option / checkbox texts to click (select)
  slide?: string;              // slides mode: HTML shown in the stage for this step
  link?: { label: string; href: string }; // a deep-link pill shown during this step (opens in a new tab)
};
// `slides` mode swaps the live-page iframe for a deck of hand-built HTML screens
// (each step's `slide`), for flows whose real steps happen on an external site
// we can't embed — e.g. connecting Gmail. Everything else (robot, voice, splash,
// controls) is identical, so it looks and sounds like every other walkthrough.
export type LiveTourSteps = { title: string; introLine: string; doneLine: string; steps: LiveStep[]; slides?: boolean; noSpotlight?: boolean };

const CSS = `
.lt-root{--navy:#16306e;--blue:#2f6bd8;--blue2:#4f8bf5;--teal:#0ea5a5;--ink:#12203c;--ink2:#3a4a68;--faint:#9aa6bd;--line:#e6ebf5;--surface:#fff;color:var(--ink)}
.lt-root .lt-controls{margin:0 0 12px;display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.lt-root .cbtn{border:1px solid var(--line);background:var(--surface);border-radius:11px;padding:10px 16px;font-size:13.5px;font-weight:800;color:var(--ink);cursor:pointer}.lt-root .cbtn:hover{border-color:#bcd0f5;background:#f4f8ff}.lt-root .cbtn.on{background:linear-gradient(180deg,var(--blue2),var(--blue));border-color:transparent;color:#fff}.lt-root .cbtn.ico{padding:10px 13px}
.lt-root .lt-stage{position:relative;background:var(--surface);border:1px solid var(--line);border-radius:18px;box-shadow:0 24px 50px -36px rgba(20,48,110,.5);overflow:hidden;height:clamp(420px,66vh,640px)}
.lt-root .lt-frame{position:absolute;inset:0;width:100%;height:100%;border:0;background:#f5f8fd}
.lt-root .lt-cursor{position:absolute;left:0;top:0;z-index:20;pointer-events:none;transition:transform .6s cubic-bezier(.5,.05,.25,1);filter:drop-shadow(0 3px 4px rgba(20,48,110,.4))}
.lt-root .lt-cursor .ring{position:absolute;left:-10px;top:-10px;width:36px;height:36px;border-radius:50%;border:2px solid var(--blue);opacity:0}.lt-root .lt-cursor.click .ring{animation:ltclk .5s ease-out}@keyframes ltclk{0%{opacity:.7;transform:scale(.3)}100%{opacity:0;transform:scale(1)}}
.lt-root .lt-cap{margin-top:12px;background:var(--surface);border:1px solid var(--line);border-left:4px solid var(--teal);border-radius:12px;padding:11px 13px;font-size:12.5px;line-height:1.55;color:var(--ink2);min-height:42px}.lt-root .lt-cap b{color:var(--ink)}
.lt-root .lt-overlay{position:absolute;inset:0;z-index:15;display:none;padding:16px;background:#0b1020;overflow:auto}
.lt-root .lt-splash{position:absolute;inset:0;z-index:30;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:radial-gradient(130% 120% at 50% 0%,#1b3f8f,#0b1020 75%);transition:opacity .5s ease;overflow:hidden}
.lt-root .lt-splash.hide{opacity:0;pointer-events:none}
.lt-root .lt-splash::before{content:"";position:absolute;top:0;left:-70%;width:55%;height:100%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.28),transparent);transform:skewX(-18deg);animation:ltshine 2s ease-in-out .2s}
@keyframes ltshine{0%{left:-70%}100%{left:130%}}
.lt-root .splmark{font-size:28px;color:#7fd0ff;animation:ltspin 3s linear infinite;text-shadow:0 0 18px rgba(80,170,255,.7)}@keyframes ltspin{to{transform:rotate(360deg)}}
.lt-root .splogo{font-size:38px;font-weight:900;letter-spacing:-1px;background:linear-gradient(90deg,#7fd0ff,#ffffff 45%,#7fd0ff);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 2px 10px rgba(80,170,255,.4))}
.lt-root .splos{-webkit-text-fill-color:#ff5aa8;color:#ff5aa8;background:none;filter:drop-shadow(0 2px 10px rgba(255,90,168,.5))}
.lt-root .sptitle{font-size:17px;font-weight:800;color:#e6f0ff}.lt-root .spsub{font-size:11.5px;font-weight:700;color:#9fb4dd}
.lt-root .lt-slide{display:flex;align-items:center;justify-content:center;overflow:auto;padding:26px;background:radial-gradient(120% 130% at 50% -10%,#e9f1fd 0%,#d9e6fb 48%,#c7dbf6 100%)}
.lt-root .lt-link{position:absolute;left:50%;bottom:16px;transform:translateX(-50%) translateY(8px);z-index:22;display:none;align-items:center;gap:8px;max-width:calc(100% - 32px);padding:10px 18px;border-radius:999px;font-size:12.5px;font-weight:800;color:#fff;text-decoration:none;background:linear-gradient(180deg,#4f8bf5,#2f6bd8);box-shadow:0 10px 26px -8px rgba(47,107,216,.7);opacity:0;transition:opacity .3s,transform .3s}
.lt-root .lt-link.show{display:inline-flex;opacity:1;transform:translateX(-50%) translateY(0)}
.lt-root .lt-link:hover{filter:brightness(1.06)}
`;

export function LiveTour({ view, portal, steps: cfg }: { view: string; portal: string; steps: LiveTourSteps }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const stage = root.querySelector(".lt-stage") as HTMLElement;
    const frame = root.querySelector(".lt-frame") as HTMLIFrameElement;
    const slideEl = root.querySelector(".lt-slide") as HTMLElement | null; // present only in slides mode
    const slidesMode = !!cfgRef.current.slides;
    const cursor = root.querySelector(".lt-cursor") as HTMLElement;
    const linkEl = root.querySelector(".lt-link") as HTMLAnchorElement;
    const capEl = root.querySelector(".lt-cap") as HTMLElement;
    const overlay = root.querySelector(".lt-overlay") as HTMLElement;
    const splash = root.querySelector(".lt-splash") as HTMLElement;
    const showScene = (html: string) => { overlay.innerHTML = html; overlay.style.display = "block"; };
    const hideScene = () => { overlay.style.display = "none"; overlay.innerHTML = ""; };
    const replayBtn = root.querySelector(".lt-replay") as HTMLElement;
    const pauseBtn = root.querySelector(".lt-pause") as HTMLElement;
    const backBtn = root.querySelector(".lt-back") as HTMLElement;
    const fwdBtn = root.querySelector(".lt-fwd") as HTMLElement;
    const soundBtn = root.querySelector(".lt-sound") as HTMLElement;
    const hasSpeech = typeof window !== "undefined" && "speechSynthesis" in window;

    let token = 0, dead = false, soundOn = false, paused = false, currentIdx = -1, ready = false;
    const waiters: (() => void)[] = [];
    let voice: SpeechSynthesisVoice | null = null;
    let speaking: Promise<unknown> = Promise.resolve();
    let resolveReady: () => void = () => {};
    const readyP = new Promise<void>((res) => (resolveReady = res));

    const gate = () => (paused ? new Promise<void>((r) => waiters.push(r)) : Promise.resolve());
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms)).then(gate);
    // Caption dwell (also the floor when sound is off). Kept a touch under
    // spoken pace so that, with sound on, we wait on the speech itself and add
    // no dead air after it — the gap between cards was the main complaint.
    const readMs = (t: string) => Math.max(1400, t.split(/\s+/).length * 235);

    function pickVoice(): SpeechSynthesisVoice | null {
      if (!hasSpeech) return null;
      const vs = window.speechSynthesis.getVoices();
      if (!vs.length) return null;
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
      speaking = Promise.race([
        new Promise((res) => { u.onend = () => { mouth(false); res(undefined); }; u.onerror = () => { mouth(false); res(undefined); }; }),
        sleep(22000).then(() => mouth(false)),
      ]);
      s.speak(u);
    }
    async function line(t: string) { await speaking; capEl.textContent = t; speak(t); await Promise.all([speaking, sleep(readMs(t))]); }

    // ── iframe messaging ──
    const pending = new Map<number, (r: DOMRect | null) => void>();
    let msgId = 0;
    function onMsg(e: MessageEvent) {
      const d = e.data as { type?: string; id?: number; ok?: boolean; rect?: DOMRect } | null;
      if (!d || typeof d !== "object") return;
      if (d.type === "tour:ready") { ready = true; resolveReady(); }
      else if (d.type === "tour:rect" && typeof d.id === "number") {
        const cb = pending.get(d.id);
        if (cb) { pending.delete(d.id); cb(d.ok ? (d.rect ?? null) : null); }
      }
    }
    window.addEventListener("message", onMsg);
    const noBox = !!cfgRef.current.noSpotlight; // some tours want the cursor only, no ring
    const spotlight = (find: string) =>
      new Promise<DOMRect | null>((res) => {
        const id = ++msgId;
        pending.set(id, res);
        frame.contentWindow?.postMessage({ type: "tour:find", find, id, noBox }, "*");
        setTimeout(() => { if (pending.has(id)) { pending.delete(id); res(null); } }, 2600);
      });
    const clearHi = () => frame.contentWindow?.postMessage({ type: "tour:clear" }, "*");
    // Click a real control in the page (e.g. "Add event") so the tour can open a
    // create form and then walk through it — showing HOW to build, not just talk.
    const clickInFrame = (find: string) => frame.contentWindow?.postMessage({ type: "tour:click", find }, "*");
    const fillInFrame = (field: string, value: string) => frame.contentWindow?.postMessage({ type: "tour:fill", field, value }, "*");
    const pickInFrame = (text: string) => frame.contentWindow?.postMessage({ type: "tour:pick", text }, "*");

    async function moveTo(rect: DOMRect | null) {
      if (rect) {
        const cx = rect.left + Math.min(rect.width * 0.5, 90);
        const cy = rect.top + Math.min(rect.height * 0.5, 34);
        cursor.style.transform = `translate(${cx}px,${cy}px)`;
        cursor.classList.add("click");
        await sleep(450);
        cursor.classList.remove("click");
      } else {
        await sleep(200);
      }
    }

    async function run(startIdx = 0) {
      const c = cfgRef.current;
      const tk = ++token; const alive = () => tk === token && !dead;
      if (hasSpeech) window.speechSynthesis.cancel();
      paused = false; waiters.splice(0).forEach((f) => f()); pauseBtn.textContent = "⏸";
      cursor.style.transform = "translate(34px,30px)"; linkEl.classList.remove("show");
      if (startIdx <= 0) {
        splash.style.display = "flex"; splash.classList.remove("hide"); void splash.offsetWidth;
        await sleep(1200); if (!alive()) return;
        splash.classList.add("hide"); await sleep(400); splash.style.display = "none";
        // Robot greets before we dive into the page.
        currentIdx = -1; clearHi();
        showScene(narratorScene("Guided walkthrough", c.title, "Sit back — I'll show you round this page."));
        await line(c.introLine); if (!alive()) return;
        hideScene();
      } else { splash.style.display = "none"; hideScene(); }
      if (!slidesMode && !ready) await Promise.race([readyP, sleep(4500)]);
      for (let i = Math.max(0, startIdx); i < c.steps.length; i++) {
        const step = c.steps[i];
        currentIdx = i; hideScene();
        // Slides mode: swap in this step's screen and just narrate — no live
        // page to spotlight, so no cursor/click/fill.
        if (slidesMode) {
          if (slideEl && step.slide != null) slideEl.innerHTML = step.slide;
          cursor.style.display = "none";
          await line(step.line); if (!alive()) return;
          continue;
        }
        // A deep-link pill for this step (e.g. "set up your locations") — shown
        // while the step is on screen, so the provider can go do it if needed.
        if (step.link) { linkEl.textContent = step.link.label; linkEl.href = step.link.href; linkEl.classList.add("show"); }
        else linkEl.classList.remove("show");
        const rect = await spotlight(step.find || ""); if (!alive()) return;
        await moveTo(rect); if (!alive()) return;
        // A "click" step presses the control (opening its form) before narrating.
        // Clear the ring straight after, so it doesn't linger over the button
        // that's now hidden behind the form that opened.
        if (step.click) { clickInFrame(step.find || ""); await sleep(850); clearHi(); if (!alive()) return; }
        // Narrate AND demonstrate at the same time: start the voice, then type
        // into the real fields / pick the real options while it talks — so the
        // spoken line and the on-screen action stay together (and a pause halts
        // both). We await the narration afterwards so the step's timing is the
        // longer of the two.
        const say = line(step.line);
        if (step.fill) { for (const [f, v] of step.fill) { fillInFrame(f, v); await sleep(Math.max(560, v.length * 55 + 260)); if (!alive()) return; } }
        if (step.pick) { for (const t of step.pick) { pickInFrame(t); await sleep(520); if (!alive()) return; } }
        await say; if (!alive()) return;
        // Advance a real multi-step builder (e.g. click the wizard's "Next ›")
        // AFTER narrating, so the next step spotlights the panel that appears.
        if (step.advance) { clickInFrame(step.advance); await sleep(850); if (!alive()) return; }
      }
      // Page-specific "one last thing" — the robot beams down the Settings tabs
      // that control THIS page (each with a note on what it does).
      currentIdx = c.steps.length; clearHi(); linkEl.classList.remove("show");
      const links = SETTINGS_LINKS[view] || [];
      if (links.length) {
        showScene(settingsScene(portal, links));
        // Say what each setting actually does (its note) — with examples —
        // rather than just naming the tabs.
        const detail = links.map((l) => `${l.label} — ${l.note}`).join(". ");
        await line(`One last thing — everything on this page is set up in your Settings. ${detail}. Tap any card to jump straight there.`);
        if (!alive()) return;
      }
      // Sign-off from the robot.
      showScene(narratorScene("✓ Complete", "All done", "You've seen the essentials of this page."));
      if (!alive()) return; await line(c.doneLine);
    }

    const setSound = (on: boolean) => { soundOn = on; soundBtn.classList.toggle("on", on); soundBtn.textContent = on ? "🔊 Sound on" : "▶ Play with sound"; capEl.style.display = on ? "none" : ""; };
    let vp = 0;
    const pollIv = hasSpeech ? window.setInterval(() => { if (window.speechSynthesis.getVoices().length) { voice = pickVoice(); window.clearInterval(pollIv); } else if (++vp > 24) window.clearInterval(pollIv); }, 250) : 0;
    if (hasSpeech) { voice = pickVoice(); window.speechSynthesis.onvoiceschanged = () => { voice = pickVoice(); }; }
    replayBtn.onclick = () => { run(0); };
    backBtn.onclick = () => { run(currentIdx - 1); };
    fwdBtn.onclick = () => { run(currentIdx + 1); };
    // Turning sound on shouldn't restart — just voice the current caption and
    // carry on; every later line then speaks because soundOn is now true.
    soundBtn.onclick = () => { const on = !soundOn; setSound(on); if (hasSpeech) window.speechSynthesis.cancel(); if (on) speak(capEl.textContent || ""); };
    pauseBtn.onclick = () => { paused = !paused; pauseBtn.textContent = paused ? "▶" : "⏸"; if (hasSpeech) { if (paused) window.speechSynthesis.pause(); else window.speechSynthesis.resume(); } if (!paused) waiters.splice(0).forEach((f) => f()); };
    run();

    return () => {
      dead = true; token++; window.clearInterval(pollIv);
      window.removeEventListener("message", onMsg);
      if (hasSpeech) { window.speechSynthesis.cancel(); window.speechSynthesis.onvoiceschanged = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, portal]);

  return (
    <div className="lt-root" ref={rootRef}>
      <style>{CSS + NARRATOR_CSS}</style>
      <div className="lt-controls">
        <button type="button" className="cbtn ico lt-back" title="Back a step" aria-label="Back a step">⏮</button>
        <button type="button" className="cbtn ico lt-pause" title="Pause or resume" aria-label="Pause or resume">⏸</button>
        <button type="button" className="cbtn ico lt-fwd" title="Skip forward" aria-label="Skip forward">⏭</button>
        <button type="button" className="cbtn lt-replay" title="Start again">↺ Replay</button>
        <button type="button" className="cbtn lt-sound">▶ Play with sound</button>
      </div>
      <div className="lt-stage">
        {cfg.slides
          ? <div className="lt-frame lt-slide" />
          : <iframe className="lt-frame" title="walkthrough" src={`/tour/${portal}/${view}`} />}
        <div className="lt-overlay" />
        <div className="lt-cursor"><span className="ring" /><svg width="24" height="24" viewBox="0 0 24 24"><path d="M4 2 L4 19 L8.5 14.5 L11.5 21.5 L14 20.5 L11 13.8 L18 13.8 Z" fill="#12203c" stroke="#fff" strokeWidth="1.3" strokeLinejoin="round" /></svg></div>
        <a className="lt-link" target="_blank" rel="noreferrer" href="#" />
        <div className="lt-splash"><div className="splmark">◈</div><div className="splogo">Activity<span className="splos">OS</span></div><div className="sptitle">{cfg.title}</div><div className="spsub">a quick guided walkthrough</div></div>
      </div>
      <div className="lt-cap" />
    </div>
  );
}
