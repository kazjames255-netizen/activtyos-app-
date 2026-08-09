"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────
// A self-driving, narrated "watch me build it" demo for Sessions & blocks. A
// fake cursor types values in and clicks — make periods, make passes, tap
// "+ Add to block" on each, name the block, "Move to Block Library" — landing
// on a Block Library card that mirrors the real one. Optional voice narration
// uses the browser's most natural available voice (no external service).
// ─────────────────────────────────────────────────────────────────────────

const PERIODS = [
  { key: "p1", nm: "8am-3pm", mt: "8:00 AM – 3:00 PM", start: "08:00", finish: "15:00" },
  { key: "p2", nm: "9am-3.30pm", mt: "9:00 AM – 3:30 PM", start: "09:00", finish: "15:30" },
];
const PASSES = [
  { key: "x1", nm: "5 day pass", mt: "5 days", days: "5" },
  { key: "x2", nm: "1 day pay", mt: "1 day", days: "1" },
];

// Rank the device's installed voices, most natural first. Chrome's "Google"
// voices and Apple's premium/enhanced voices sound closest to a real person.
function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const vs = window.speechSynthesis.getVoices();
  if (!vs.length) return null;
  const pref = ["Google UK English Female", "Google UK English Male", "Google US English", "Microsoft Sonia", "Microsoft Libby", "Samantha", "Serena", "Kate", "Fiona", "Daniel", "Moira"];
  for (const name of pref) { const v = vs.find((x) => x.name === name) || vs.find((x) => x.name.includes(name)); if (v) return v; }
  return vs.find((v) => /en-GB/i.test(v.lang) && !v.localService) || vs.find((v) => /en-GB/i.test(v.lang)) || vs.find((v) => /^en/i.test(v.lang)) || vs[0];
}

const CSS = `
.bt-root{--navy:#16306e;--blue:#2f6bd8;--blue2:#4f8bf5;--teal:#0ea5a5;--green:#0e9a5a;--red:#e21d27;--ink:#12203c;--ink2:#3a4a68;--muted:#5b6b86;--faint:#9aa6bd;--line:#e6ebf5;--panel:#f4f7fc;--surface:#fff;--brandink:#1d3a8f;color:var(--ink)}
.bt-root .bt-rail{display:flex;gap:8px;margin:0 0 14px;flex-wrap:wrap}
.bt-root .rstep{flex:1;min-width:140px;display:flex;align-items:center;gap:9px;padding:8px 11px;border-radius:12px;background:var(--surface);border:1px solid var(--line);transition:.35s}
.bt-root .rstep .n{width:23px;height:23px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:800;background:var(--panel);color:var(--faint);border:1px solid var(--line);flex:none;transition:.35s}
.bt-root .rstep .t{font-size:12.5px;font-weight:800;color:var(--faint);transition:.35s}
.bt-root .rstep .s{font-size:10px;color:var(--faint);margin-top:1px}
.bt-root .rstep.on{border-color:#bcd0f5;background:#f4f8ff}
.bt-root .rstep.on .n{background:var(--navy);color:#fff;border-color:transparent}
.bt-root .rstep.on .t{color:var(--navy)}
.bt-root .rstep.done .n{background:var(--green);color:#fff;border-color:transparent}
.bt-root .rstep.done .t{color:var(--ink2)}
.bt-root .bt-stage{position:relative;background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:16px;box-shadow:0 24px 50px -36px rgba(20,48,110,.5);min-height:320px;overflow:hidden}
.bt-root .appear{animation:btrise .45s ease both}
@keyframes btrise{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}
.bt-root .card{border:1px solid var(--line);border-radius:16px;background:var(--surface);padding:14px}
.bt-root .card.rail-l{border-left:4px solid var(--blue)}
.bt-root .stephead{display:flex;align-items:center;gap:10px;margin-bottom:6px}
.bt-root .stephead .c{width:29px;height:29px;border-radius:50%;background:var(--navy);color:#fff;display:grid;place-items:center;font-weight:800;font-size:14px;flex:none}
.bt-root .stephead h3{margin:0;font-size:15px;font-weight:800}
.bt-root .lede{font-size:11.5px;color:var(--muted);line-height:1.5;margin:2px 0 12px}
.bt-root .formbox{border:1px solid var(--line);background:var(--panel);border-radius:12px;padding:11px;display:flex;flex-direction:column;gap:8px}
.bt-root .flab{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:var(--faint)}
.bt-root .field{border:1px solid var(--line);background:var(--surface);border-radius:9px;padding:8px 10px;font-size:12.5px;color:var(--ink);font-weight:600;min-height:34px}
.bt-root .field.ph{color:var(--faint);font-weight:500}
.bt-root .field.focus{border-color:var(--navy);box-shadow:0 0 0 3px rgba(22,48,110,.12)}
.bt-root .caret{display:inline-block;width:1.5px;height:14px;background:var(--navy);margin-left:1px;vertical-align:-2px;animation:btblink 1s step-end infinite}
@keyframes btblink{50%{opacity:0}}
.bt-root .row2{display:flex;gap:8px}.bt-root .row2>div{flex:1}
.bt-root .btn{border-radius:999px;padding:7px 14px;font-size:12.5px;font-weight:800;border:1px solid var(--line);background:var(--surface);color:var(--ink2);display:inline-block}
.bt-root .btn.amber{background:linear-gradient(180deg,#f7c65a,#f0a92f);border-color:transparent;color:#5b3d05}
.bt-root .chip{display:flex;align-items:center;justify-content:space-between;gap:8px;border:1px solid var(--line);background:var(--panel);border-radius:12px;padding:9px 12px}
.bt-root .chip .nm{font-size:12.5px;font-weight:800;color:var(--ink)}
.bt-root .chip .mt{font-size:11px;color:var(--faint);margin-top:1px}
.bt-root .chip.in{background:#eefaf1;border-color:#bfe6cd}
.bt-root .pill{border-radius:999px;padding:2px 9px;font-size:10px;font-weight:800;border:1px solid var(--line);color:var(--brandink);white-space:nowrap}
.bt-root .pill.ok{background:#d8f3e1;color:#127a3e;border-color:transparent}
.bt-root .bchip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);background:var(--surface);border-radius:999px;padding:6px 11px;font-size:12px;font-weight:800}
.bt-root .bchip .mt{color:var(--faint);font-weight:600}
.bt-root .bchip .x{color:var(--faint);font-weight:800;font-size:13px}
.bt-root .drop{border:2px dashed var(--line);border-radius:12px;padding:12px;margin-bottom:12px;display:grid;grid-template-columns:1fr;gap:10px}
@media(min-width:560px){.bt-root .drop{grid-template-columns:1fr 1fr}}
.bt-root .stacklist{display:flex;flex-direction:column;gap:8px}
/* Block Library card — mirrors the real one */
.bt-root .lib{border:1px solid var(--line);border-radius:14px;overflow:hidden;box-shadow:0 18px 40px -30px rgba(20,48,110,.5)}
.bt-root .lib .hd{background:linear-gradient(100deg,#16306e,#2f6bd8 90%);color:#fff;padding:12px 14px;display:flex;align-items:flex-start;gap:10px}
.bt-root .lib .drag{color:rgba(255,255,255,.55);font-size:12px;line-height:1;letter-spacing:1px;margin-top:2px}
.bt-root .lib .sw{width:16px;height:16px;border-radius:5px;background:#3b82f6;box-shadow:0 0 0 2px rgba(255,255,255,.4);margin-top:2px;flex:none}
.bt-root .lib .nm{font-size:15px;font-weight:800;display:flex;align-items:center;gap:7px}
.bt-root .lib .sub{font-size:11.5px;color:rgba(255,255,255,.82);margin-top:2px}
.bt-root .lib .r{margin-left:auto;display:flex;align-items:center;gap:9px}
.bt-root .lib .unpriced{background:rgba(255,255,255,.92);color:#1d3a8f;border-radius:999px;padding:3px 11px;font-size:11px;font-weight:800}
.bt-root .lib .chev{color:rgba(255,255,255,.85);font-size:11px}
.bt-root .lib .bd{padding:14px;background:#fff}
.bt-root .lib .grid2{display:grid;grid-template-columns:1fr;gap:12px}
@media(min-width:520px){.bt-root .lib .grid2{grid-template-columns:1fr 1fr}}
.bt-root .lib .seclab{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:var(--faint);margin-bottom:4px}
.bt-root .lib .line{font-size:12.5px;font-weight:700;color:var(--ink);margin-bottom:2px}
.bt-root .lib .line .g{color:var(--faint);font-weight:600}
.bt-root .lib .acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
.bt-root .lib .abtn{border:1px solid var(--line);border-radius:999px;padding:7px 14px;font-size:12px;font-weight:800;color:var(--ink2)}
.bt-root .lib .abtn.del{color:var(--red);border-color:#f6c9cc}
.bt-root .bt-cursor{position:absolute;left:0;top:0;z-index:20;pointer-events:none;transition:transform .55s cubic-bezier(.5,.05,.25,1);filter:drop-shadow(0 3px 4px rgba(20,48,110,.35))}
.bt-root .bt-cursor.down{transition:transform .1s}
.bt-root .bt-cursor .ring{position:absolute;left:-9px;top:-9px;width:34px;height:34px;border-radius:50%;border:2px solid var(--blue);opacity:0}
.bt-root .bt-cursor.click .ring{animation:btclick .4s ease-out}
@keyframes btclick{0%{opacity:.7;transform:scale(.3)}100%{opacity:0;transform:scale(1)}}
.bt-root .bt-cap{margin-top:12px;background:var(--surface);border:1px solid var(--line);border-left:4px solid var(--teal);border-radius:12px;padding:11px 13px;font-size:12.5px;line-height:1.55;color:var(--ink2);min-height:42px}
.bt-root .bt-cap b{color:var(--ink)}
.bt-root .bt-controls{margin-top:12px;display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.bt-root .cbtn{border:1px solid var(--line);background:var(--surface);border-radius:10px;padding:8px 15px;font-size:12.5px;font-weight:800;color:var(--ink);cursor:pointer}
.bt-root .cbtn:hover{border-color:#bcd0f5;background:#f4f8ff}
.bt-root .cbtn.on{background:#eef4ff;border-color:#bcd0f5;color:var(--brandink)}
.bt-root .count{font-size:11.5px;color:var(--faint);font-weight:700;margin-left:auto}
`;

export function BlocksTour() {
  const [runId, setRunId] = useState(0);
  const [phase, setPhase] = useState(1);
  const [cap, setCap] = useState("");
  const [pTitle, setPTitle] = useState("");
  const [passName, setPassName] = useState("");
  const [blockName, setBlockName] = useState("");
  const [fStart, setFStart] = useState("08:00");
  const [fFinish, setFFinish] = useState("15:00");
  const [fDays, setFDays] = useState("5");
  const [periodsMade, setPeriodsMade] = useState<string[]>([]);
  const [passesMade, setPassesMade] = useState<string[]>([]);
  const [focus, setFocus] = useState<string | null>(null);
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [soundOn, setSoundOn] = useState(false);
  const [cursor, setCursor] = useState<{ x: number; y: number; down: boolean; click: boolean }>({ x: 24, y: 20, down: false, click: false });

  const stageRef = useRef<HTMLDivElement | null>(null);
  const refs = useRef<Record<string, HTMLElement | null>>({});
  const reg = (k: string) => (el: HTMLElement | null) => { refs.current[k] = el; };
  const soundOnRef = useRef(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const capRef = useRef("");

  // load the best available voice
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const load = () => { voiceRef.current = pickVoice(); };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => { window.speechSynthesis.onvoiceschanged = null; window.speechSynthesis.cancel(); };
  }, []);

  const run = useCallback(async (alive: () => boolean) => {
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const set = <T,>(fn: (v: T) => void, v: T) => { if (alive()) fn(v); };
    const strip = (h: string) => h.replace(/<[^>]+>/g, "");
    const speak = (text: string) => {
      if (!soundOnRef.current || typeof window === "undefined" || !("speechSynthesis" in window)) return;
      const s = window.speechSynthesis; s.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const v = voiceRef.current; if (v) { u.voice = v; u.lang = v.lang; }
      u.rate = 0.98; u.pitch = 1;
      s.speak(u);
    };
    const narrate = (html: string) => { capRef.current = html; set(setCap, html); speak(strip(html)); };
    const moveTo = async (key: string, ox = 0.5, oy = 0.6) => {
      const el = refs.current[key], st = stageRef.current;
      if (el && st) {
        const e = el.getBoundingClientRect(), s = st.getBoundingClientRect();
        set(setCursor, { x: e.left - s.left + e.width * ox, y: e.top - s.top + e.height * oy, down: false, click: false });
      }
      await sleep(650);
    };
    const click = async () => {
      setCursor((c) => ({ ...c, down: true, click: true })); await sleep(150);
      setCursor((c) => ({ ...c, down: false })); await sleep(120);
      setCursor((c) => ({ ...c, click: false }));
    };
    const typeInto = async (fn: (v: string) => void, text: string) => {
      for (let i = 1; i <= text.length; i++) { if (!alive()) return; fn(text.slice(0, i)); await sleep(40); }
    };

    // reset
    set(setPeriodsMade, []); set(setPassesMade, []); set(setAdded, {});
    set(setPTitle, ""); set(setPassName, ""); set(setBlockName, ""); set(setFocus, null);

    // ── Phase 1: periods
    set(setPhase, 1); narrate("First, make your <b>periods</b> — the daily time windows."); await sleep(1000);
    for (let i = 0; i < PERIODS.length; i++) {
      set(setFStart, PERIODS[i].start); set(setFFinish, PERIODS[i].finish);
      set(setFocus, "pTitle"); await moveTo("pTitle", 0.15);
      await typeInto(setPTitle, PERIODS[i].nm); await sleep(200);
      set(setFocus, null); await moveTo("pAdd");
      await click(); set(setPeriodsMade, PERIODS.slice(0, i + 1).map((p) => p.key)); set(setPTitle, "");
      if (i === 0) narrate("Give it a title, set the start and finish, and press <b>Add period</b>.");
      await sleep(500);
      await moveTo("add-" + PERIODS[i].key);
      await click(); set(setAdded, (() => { const c = { ...addedRef.current, [PERIODS[i].key]: true }; addedRef.current = c; return c; })());
      if (i === 0) narrate("Then tap <b>+ Add to block</b> — the card turns <b>green</b> to show it's in. Add any others the same way.");
      await sleep(i === 0 ? 900 : 600);
    }

    // ── Phase 2: passes
    set(setPhase, 2); narrate("Next, make your <b>passes</b> — how long a parent books."); await sleep(1000);
    for (let i = 0; i < PASSES.length; i++) {
      set(setFDays, PASSES[i].days);
      set(setFocus, "passName"); await moveTo("passName", 0.15);
      await typeInto(setPassName, PASSES[i].nm); await sleep(200);
      set(setFocus, null); await moveTo("passAdd");
      await click(); set(setPassesMade, PASSES.slice(0, i + 1).map((p) => p.key)); set(setPassName, "");
      await sleep(450);
      await moveTo("add-" + PASSES[i].key);
      await click(); set(setAdded, (() => { const c = { ...addedRef.current, [PASSES[i].key]: true }; addedRef.current = c; return c; })());
      if (i === 0) narrate("A full-week pass, and a single day. Prices come from the calculator, not by hand.");
      await sleep(i === 0 ? 900 : 600);
    }

    // ── Phase 3: name + move to library
    set(setPhase, 3); narrate("Now <b>name your block</b>, then move it to your Block Library."); await sleep(900);
    set(setFocus, "bName"); await moveTo("bName", 0.1);
    await typeInto(setBlockName, "Summer Camp"); await sleep(200);
    set(setFocus, null); await moveTo("save");
    await click(); await sleep(500);

    // ── Phase 4: library card
    set(setPhase, 4);
    narrate("Done. Your block is in the <b>Block Library</b> — reuse or duplicate it on any listing. Set the price and the calculator does the rest.");
    await sleep(400);
  }, []);

  const addedRef = useRef<Record<string, boolean>>({});
  useEffect(() => {
    let cancelled = false;
    addedRef.current = {};
    run(() => !cancelled);
    return () => { cancelled = true; if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel(); };
  }, [run, runId]);

  const toggleSound = () => {
    const on = !soundOn; setSoundOn(on); soundOnRef.current = on;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (on) { const u = new SpeechSynthesisUtterance(capRef.current.replace(/<[^>]+>/g, "")); const v = voiceRef.current; if (v) { u.voice = v; u.lang = v.lang; } u.rate = 0.98; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); }
    else window.speechSynthesis.cancel();
  };

  const railOn = Math.min(phase, 3);
  const byKey = (k: string) => [...PERIODS, ...PASSES].find((x) => x.key === k)!;
  const paletteChip = (it: { key: string; nm: string; mt: string }) => (
    <div className={`chip ${added[it.key] ? "in" : ""}`}>
      <div><div className="nm">{it.nm}</div><div className="mt">{it.mt}</div></div>
      {added[it.key]
        ? <div style={{ display: "flex", gap: 6, alignItems: "center" }}><span className="pill ok">✓ In block</span><span style={{ fontSize: "10.5px", fontWeight: 800, color: "var(--faint)", textDecoration: "underline" }}>Undo</span></div>
        : <span ref={reg("add-" + it.key)} className="pill">+ Add to block</span>}
    </div>
  );

  return (
    <div className="bt-root">
      <style>{CSS}</style>
      <div className="bt-rail">
        {[[1, "Periods", "Session time windows"], [2, "Passes", "How long they book"], [3, "Block", "Combine & reuse"]].map(([s, t, sub]) => (
          <div key={s as number} className={`rstep ${railOn === s ? "on" : ""} ${railOn > (s as number) ? "done" : ""}`}>
            <span className="n">{s as number}</span><span><span className="t">{t as string}</span><div className="s">{sub as string}</div></span>
          </div>
        ))}
      </div>

      <div className="bt-stage" ref={stageRef}>
        <div className={`bt-cursor ${cursor.down ? "down" : ""} ${cursor.click ? "click" : ""}`} style={{ transform: `translate(${cursor.x}px, ${cursor.y}px) scale(${cursor.down ? 0.82 : 1})` }}>
          <span className="ring" />
          <svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 2 L4 19 L8.5 14.5 L11.5 21.5 L14 20.5 L11 13.8 L18 13.8 Z" fill="#12203c" stroke="#fff" strokeWidth="1.3" strokeLinejoin="round" /></svg>
        </div>

        {(phase === 1 || phase === 2) && (
          <div className="card rail-l">
            <div className="stephead"><span className="c">{phase}</span><h3>{phase === 1 ? "Make your periods" : "Make your passes"}</h3></div>
            <div className="formbox" style={{ marginBottom: 12 }}>
              <div className="flab">{phase === 1 ? "New period" : "New pass"}</div>
              {phase === 1 ? (
                <>
                  <div ref={reg("pTitle")} className={`field ${focus === "pTitle" ? "focus" : ""} ${pTitle ? "" : "ph"}`}>{pTitle || "Period title"}{focus === "pTitle" && <span className="caret" />}</div>
                  <div className="row2">
                    <div><div className="flab" style={{ marginBottom: 4 }}>Start</div><div className="field">{fStart}</div></div>
                    <div><div className="flab" style={{ marginBottom: 4 }}>Finish</div><div className="field">{fFinish}</div></div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}><span ref={reg("pAdd")} className="btn amber">Add period</span><span className="btn">Cancel</span></div>
                </>
              ) : (
                <>
                  <div ref={reg("passName")} className={`field ${focus === "passName" ? "focus" : ""} ${passName ? "" : "ph"}`}>{passName || "Pass name (e.g. 5-day week pass)"}{focus === "passName" && <span className="caret" />}</div>
                  <div className="row2">
                    <div><div className="flab" style={{ marginBottom: 4 }}>Days</div><div className="field">{fDays}</div></div>
                    <div><div className="flab" style={{ marginBottom: 4 }}>Details (optional)</div><div className="field ph">Anything parents should know…</div></div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}><span ref={reg("passAdd")} className="btn amber">Add pass</span><span className="btn">Cancel</span></div>
                </>
              )}
            </div>
            <div className="stacklist">
              {phase === 1 && periodsMade.map((k) => <div key={k} className="appear">{paletteChip(byKey(k))}</div>)}
              {phase === 2 && passesMade.map((k) => <div key={k} className="appear">{paletteChip(byKey(k))}</div>)}
            </div>
          </div>
        )}

        {phase === 3 && (
          <div className="card rail-l">
            <div className="stephead"><span className="c">3</span><h3>Build your blocks</h3></div>
            <p className="lede">Tap &ldquo;+ Add to block&rdquo; on the periods &amp; passes you want, name it, then reuse or duplicate it across every listing.</p>
            <div className="drop">
              <div><div className="flab" style={{ marginBottom: 6 }}>Periods</div><div className="stacklist">{PERIODS.map((p) => <span key={p.key} className="bchip">{p.nm} <span className="mt">{p.mt}</span> <span className="x">×</span></span>)}</div></div>
              <div><div className="flab" style={{ marginBottom: 6 }}>Passes</div><div className="stacklist">{PASSES.map((p) => <span key={p.key} className="bchip">{p.nm} <span className="x">×</span></span>)}</div></div>
            </div>
            <div className="flab" style={{ marginBottom: 6 }}>Name your block</div>
            <div ref={reg("bName")} className={`field ${focus === "bName" ? "focus" : ""} ${blockName ? "" : "ph"}`} style={{ marginBottom: 12 }}>{blockName || "e.g. Summer Multi Activity Camp — Loughton"}{focus === "bName" && <span className="caret" />}</div>
            <span ref={reg("save")} className="btn amber">Move to Block Library →</span>
          </div>
        )}

        {phase === 4 && (
          <div className="appear">
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 3 }}>Block Library</div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 12 }}>Your finished blocks — reorder, sort pricing, and send them to your listings.</div>
            <div className="lib">
              <div className="hd">
                <span className="drag">⠿</span><span className="sw" />
                <div><div className="nm">Summer Camp <span style={{ fontSize: 12, opacity: 0.8 }}>✎</span></div><div className="sub">2 periods · 2 passes</div></div>
                <div className="r"><span className="unpriced">Unpriced</span><span className="chev">▲</span></div>
              </div>
              <div className="bd">
                <div className="grid2">
                  <div><div className="seclab">Periods</div>{PERIODS.map((p) => <div key={p.key} className="line">{p.nm} <span className="g">{p.mt}</span></div>)}</div>
                  <div><div className="seclab">Passes</div><div className="line">5 day pass <span className="g">· 1 day pay</span></div></div>
                </div>
                <div style={{ marginTop: 12 }}><div className="seclab">Sent to listings</div><div style={{ fontSize: 12.5, color: "var(--muted)" }}>Not sent to any listing yet.</div></div>
                <div className="acts">
                  <span className="abtn">Sort pricing</span><span className="abtn">Edit</span><span className="abtn">Duplicate</span><span className="abtn">Archive</span><span className="abtn del">Delete</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bt-cap" dangerouslySetInnerHTML={{ __html: cap }} />
      <div className="bt-controls">
        <button type="button" className="cbtn" onClick={() => setRunId((n) => n + 1)}>↻ Replay</button>
        <button type="button" className={`cbtn ${soundOn ? "on" : ""}`} onClick={toggleSound}>{soundOn ? "🔊 Sound on" : "🔈 Narrate"}</button>
        <span className="count">Step {railOn} of 3{phase === 4 ? " · done" : ""}</span>
      </div>
    </div>
  );
}
