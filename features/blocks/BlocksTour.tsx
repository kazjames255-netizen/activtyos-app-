"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────
// A self-driving "watch me build it" demo for the Sessions & blocks page. A
// fake cursor moves to each field, types the values in, and clicks the
// buttons — periods → passes → block → pricing — so a new operator sees
// exactly how it's done. Pure presentation (no real data touched).
// ─────────────────────────────────────────────────────────────────────────

const PERIODS = [
  { key: "p1", nm: "Main day · 8am–3pm", mt: "8:00 AM – 3:00 PM" },
  { key: "p2", nm: "Early drop-off", mt: "7:30 AM – 9:00 AM" },
];
const PASSES = [
  { key: "x1", nm: "5-day week pass", mt: "5 days" },
  { key: "x2", nm: "Single day", mt: "1 day" },
];

const CSS = `
.bt-root{--navy:#16306e;--blue:#2f6bd8;--blue2:#4f8bf5;--teal:#0ea5a5;--green:#0e9a5a;--ink:#12203c;--ink2:#3a4a68;--muted:#5b6b86;--faint:#9aa6bd;--line:#e6ebf5;--panel:#f4f7fc;--surface:#fff;--brandink:#1d3a8f;color:var(--ink)}
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
.bt-root .bt-stage{position:relative;background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:16px;box-shadow:0 24px 50px -36px rgba(20,48,110,.5);min-height:300px;overflow:hidden}
.bt-root .appear{animation:btrise .45s ease both}
@keyframes btrise{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}
.bt-root .card{border:1px solid var(--line);border-radius:16px;background:var(--surface);padding:14px}
.bt-root .card.rail-l{border-left:4px solid var(--blue)}
.bt-root .stephead{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.bt-root .stephead .c{width:29px;height:29px;border-radius:50%;background:var(--navy);color:#fff;display:grid;place-items:center;font-weight:800;font-size:14px;flex:none}
.bt-root .stephead h3{margin:0;font-size:15px;font-weight:800}
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
.bt-root .cols{display:grid;grid-template-columns:1fr;gap:12px}
@media(min-width:640px){.bt-root .cols.two{grid-template-columns:1fr 1fr}}
.bt-root .stacklist{display:flex;flex-direction:column;gap:8px}
.bt-root .calc{border:1px solid #d7e6ff;background:linear-gradient(180deg,#f7faff,#eef4ff);border-radius:14px;padding:13px}
.bt-root .calc .h{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:800;color:var(--navy);margin-bottom:9px}
.bt-root .prow{display:flex;align-items:center;justify-content:space-between;padding:7px 10px;border-radius:9px;background:var(--surface);border:1px solid var(--line);margin-bottom:6px;font-size:12.5px}
.bt-root .prow .p{font-weight:800}
.bt-root .tagm{font-size:9.5px;font-weight:800;color:#127a3e;background:#d8f3e1;border-radius:999px;padding:1px 7px;margin-left:6px}
.bt-root .tagc{font-size:9.5px;font-weight:800;color:var(--brandink);background:#e7eefc;border-radius:999px;padding:1px 7px;margin-left:6px}
/* the fake cursor */
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
.bt-root .count{font-size:11.5px;color:var(--faint);font-weight:700;margin-left:auto}
`;

export function BlocksTour() {
  const [runId, setRunId] = useState(0);
  const [phase, setPhase] = useState(1);
  const [cap, setCap] = useState("");
  const [pTitle, setPTitle] = useState("");
  const [passName, setPassName] = useState("");
  const [blockName, setBlockName] = useState("");
  const [periods, setPeriods] = useState<typeof PERIODS>([]);
  const [passes, setPasses] = useState<typeof PASSES>([]);
  const [focus, setFocus] = useState<string | null>(null);
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);
  const [cursor, setCursor] = useState<{ x: number; y: number; down: boolean; click: boolean }>({ x: 24, y: 20, down: false, click: false });

  const stageRef = useRef<HTMLDivElement | null>(null);
  const refs = useRef<Record<string, HTMLElement | null>>({});
  const reg = (k: string) => (el: HTMLElement | null) => { refs.current[k] = el; };

  const run = useCallback(async (alive: () => boolean) => {
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const set = <T,>(fn: (v: T) => void, v: T) => { if (alive()) fn(v); };
    const moveTo = async (key: string, ox = 0.5, oy = 0.6) => {
      const el = refs.current[key], st = stageRef.current;
      if (el && st) {
        const e = el.getBoundingClientRect(), s = st.getBoundingClientRect();
        set(setCursor, { x: e.left - s.left + e.width * ox, y: e.top - s.top + e.height * oy, down: false, click: false });
      }
      await sleep(650);
    };
    const click = async () => {
      setCursor((c) => ({ ...c, down: true, click: true }));
      await sleep(150);
      setCursor((c) => ({ ...c, down: false }));
      await sleep(120);
      setCursor((c) => ({ ...c, click: false }));
    };
    const typeInto = async (fn: (v: string) => void, text: string) => {
      for (let i = 1; i <= text.length; i++) { if (!alive()) return; fn(text.slice(0, i)); await sleep(42); }
    };

    // reset
    set(setPeriods, []); set(setPasses, []); set(setAdded, {}); set(setSaved, false);
    set(setPTitle, ""); set(setPassName, ""); set(setBlockName, ""); set(setFocus, null);

    // ── Phase 1: periods
    set(setPhase, 1); set(setCap, "First, make your <b>periods</b> — the session time windows.");
    await sleep(700);
    for (let i = 0; i < PERIODS.length; i++) {
      set(setFocus, "pTitle"); await moveTo("pTitle");
      await typeInto(setPTitle, PERIODS[i].nm); await sleep(250);
      set(setFocus, null); await moveTo("pAdd");
      await click(); set(setPeriods, PERIODS.slice(0, i + 1)); set(setPTitle, "");
      set(setCap, i === 0 ? "Type a title, set the times, and press <b>Add period</b>." : "Add any extras the same way — like an <b>early drop-off</b>.");
      await sleep(700);
    }

    // ── Phase 2: passes
    set(setPhase, 2); set(setCap, "Next, make your <b>passes</b> — how long a parent books."); await sleep(800);
    for (let i = 0; i < PASSES.length; i++) {
      set(setFocus, "passName"); await moveTo("passName");
      await typeInto(setPassName, PASSES[i].nm); await sleep(250);
      set(setFocus, null); await moveTo("passAdd");
      await click(); set(setPasses, PASSES.slice(0, i + 1)); set(setPassName, "");
      set(setCap, i === 0 ? "A full <b>5-day week</b> pass…" : "…and a <b>single day</b>. Prices come from the calculator, not by hand.");
      await sleep(700);
    }

    // ── Phase 3: build the block
    set(setPhase, 3); set(setCap, "Now build the <b>block</b>: name it, then add the periods and passes."); await sleep(800);
    set(setFocus, "bName"); await moveTo("bName");
    await typeInto(setBlockName, "Summer Holiday Club"); await sleep(250);
    set(setFocus, null);
    for (const it of [...PERIODS, ...PASSES]) {
      await moveTo("add-" + it.key);
      await click(); set(setAdded, (() => { const cur = { ...refsAdded.current }; cur[it.key] = true; refsAdded.current = cur; return cur; })());
      await sleep(320);
    }
    set(setCap, "Each one turns <b>green</b> with an Undo. Then press <b>Save block</b>."); await sleep(300);
    await moveTo("save"); await click(); set(setSaved, true); await sleep(500);

    // ── Phase 4: done + pricing
    set(setPhase, 4);
    set(setCap, "Saved. Set the price of the longest pass and the <b>pricing calculator</b> fills in the rest — then send the block to any listing.");
    await sleep(400);
  }, []);

  // small mutable mirror of `added` so the async loop can accumulate safely
  const refsAdded = useRef<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    refsAdded.current = {};
    run(() => !cancelled);
    return () => { cancelled = true; };
  }, [run, runId]);

  const railOn = Math.min(phase, 3);
  const chip = (it: { key: string; nm: string; mt: string }, inBlock: boolean) => (
    <div key={it.key} className={`chip ${inBlock ? "in" : ""}`}>
      <div><div className="nm">{it.nm}</div><div className="mt">{it.mt}</div></div>
      {inBlock
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
                    <div><div className="flab" style={{ marginBottom: 4 }}>Start</div><div className="field">08:00</div></div>
                    <div><div className="flab" style={{ marginBottom: 4 }}>Finish</div><div className="field">15:00</div></div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}><span ref={reg("pAdd")} className="btn amber">Add period</span><span className="btn">Cancel</span></div>
                </>
              ) : (
                <>
                  <div ref={reg("passName")} className={`field ${focus === "passName" ? "focus" : ""} ${passName ? "" : "ph"}`}>{passName || "Pass name (e.g. 5-day week pass)"}{focus === "passName" && <span className="caret" />}</div>
                  <div className="row2">
                    <div><div className="flab" style={{ marginBottom: 4 }}>Days</div><div className="field">{passes.length === 1 ? 1 : 5}</div></div>
                    <div><div className="flab" style={{ marginBottom: 4 }}>Details (optional)</div><div className="field ph">Anything parents should know…</div></div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}><span ref={reg("passAdd")} className="btn amber">Add pass</span><span className="btn">Cancel</span></div>
                </>
              )}
            </div>
            <div className="stacklist">
              {(phase === 1 ? periods : passes).map((it) => <div key={it.key} className="appear">{chip(it, false)}</div>)}
            </div>
          </div>
        )}

        {phase === 3 && (
          <div className="card rail-l">
            <div className="stephead"><span className="c">3</span><h3>Build your blocks</h3></div>
            <div className="formbox" style={{ marginBottom: 12 }}>
              <div className="flab">Block name</div>
              <div ref={reg("bName")} className={`field ${focus === "bName" ? "focus" : ""} ${blockName ? "" : "ph"}`}>{blockName || "Name this block"}{focus === "bName" && <span className="caret" />}</div>
            </div>
            <div className="cols two">
              <div><div className="flab" style={{ marginBottom: 6 }}>Periods</div><div className="stacklist">{PERIODS.map((it) => chip(it, !!added[it.key]))}</div></div>
              <div><div className="flab" style={{ marginBottom: 6 }}>Passes</div><div className="stacklist">{PASSES.map((it) => chip(it, !!added[it.key]))}</div></div>
            </div>
            <div style={{ marginTop: 13 }}><span ref={reg("save")} className="btn amber">Save block</span></div>
          </div>
        )}

        {phase === 4 && (
          <div className="appear">
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="flab" style={{ marginBottom: 8 }}>Your blocks</div>
              <div className="chip in"><div><div className="nm">🧩 Summer Holiday Club</div><div className="mt">2 periods · 2 passes · ready to send to listings</div></div><span className="pill ok">Saved ✓</span></div>
            </div>
            <div className="calc">
              <div className="h">💷 Pricing calculator</div>
              <div className="prow"><span>5-day week pass <span className="tagm">master price</span></span><span className="p">£150.00</span></div>
              <div className="prow"><span>Single day <span className="tagc">auto-filled</span></span><span className="p">£33.00</span></div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6, lineHeight: 1.5 }}>Set the longest pass; the calculator prices the shorter ones — edit any if you want.</div>
            </div>
          </div>
        )}
      </div>

      <div className="bt-cap" dangerouslySetInnerHTML={{ __html: cap }} />
      <div className="bt-controls">
        <button type="button" className="cbtn" onClick={() => setRunId((n) => n + 1)}>↻ Replay</button>
        <span className="count">Step {railOn} of 3{phase === 4 ? " · done" : ""}</span>
      </div>
    </div>
  );
}
