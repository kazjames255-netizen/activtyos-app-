"use client";

import { useEffect, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────
// An in-app guided walkthrough for the Sessions & blocks page — periods →
// passes → block → pricing. Self-playing, step-through mock UI that mirrors
// the real screens. All content is static/author-controlled (no user data),
// so scene markup is injected as HTML for brevity; styles are scoped under
// `.bt-root` so the generic class names can't leak into the rest of the app.
// ─────────────────────────────────────────────────────────────────────────

const CSS = `
.bt-root{--navy:#16306e;--blue:#2f6bd8;--blue2:#4f8bf5;--teal:#0ea5a5;--green:#0e9a5a;--amber2:#e8862a;--ink:#12203c;--ink2:#3a4a68;--muted:#5b6b86;--faint:#9aa6bd;--line:#e6ebf5;--panel:#f4f7fc;--surface:#fff;--brandink:#1d3a8f;color:var(--ink)}
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
.bt-root .bt-stage{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:16px;box-shadow:0 24px 50px -36px rgba(20,48,110,.5);min-height:300px;overflow:hidden}
.bt-root .scene{animation:btpop .45s ease}
@keyframes btpop{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.bt-root .appear{animation:btrise .5s ease both}
.bt-root .appear.d1{animation-delay:.12s}.bt-root .appear.d2{animation-delay:.26s}.bt-root .appear.d3{animation-delay:.4s}
@keyframes btrise{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}
.bt-root .card{border:1px solid var(--line);border-radius:16px;background:var(--surface);padding:14px}
.bt-root .card.rail-l{border-left:4px solid var(--blue)}
.bt-root .stephead{display:flex;align-items:center;gap:10px;margin-bottom:6px}
.bt-root .stephead .c{width:29px;height:29px;border-radius:50%;background:var(--navy);color:#fff;display:grid;place-items:center;font-weight:800;font-size:14px;flex:none}
.bt-root .stephead h3{margin:0;font-size:15px;font-weight:800}
.bt-root .lede{font-size:11.5px;color:var(--muted);line-height:1.5;margin:2px 0 12px}
.bt-root .formbox{border:1px solid var(--line);background:var(--panel);border-radius:12px;padding:11px;display:flex;flex-direction:column;gap:8px}
.bt-root .flab{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:var(--faint)}
.bt-root .field{border:1px solid var(--line);background:var(--surface);border-radius:9px;padding:8px 10px;font-size:12.5px;color:var(--ink);font-weight:600}
.bt-root .field.ph{color:var(--faint);font-weight:500}
.bt-root .field.focus{border-color:var(--navy);box-shadow:0 0 0 3px rgba(22,48,110,.12)}
.bt-root .row2{display:flex;gap:8px}.bt-root .row2>div{flex:1}
.bt-root .btn{border-radius:999px;padding:7px 14px;font-size:12.5px;font-weight:800;border:1px solid var(--line);background:var(--surface);color:var(--ink2);display:inline-block}
.bt-root .btn.amber{background:linear-gradient(180deg,#f7c65a,#f0a92f);border-color:transparent;color:#5b3d05}
.bt-root .btn.pulse{animation:btpulse 1.1s ease-in-out infinite}
@keyframes btpulse{0%,100%{box-shadow:0 0 0 0 rgba(240,169,47,.5)}50%{box-shadow:0 0 0 7px rgba(240,169,47,0)}}
.bt-root .chip{display:flex;align-items:center;justify-content:space-between;gap:8px;border:1px solid var(--line);background:var(--panel);border-radius:12px;padding:9px 12px}
.bt-root .chip .nm{font-size:12.5px;font-weight:800;color:var(--ink)}
.bt-root .chip .mt{font-size:11px;color:var(--faint);margin-top:1px}
.bt-root .chip.in{background:#eefaf1;border-color:#bfe6cd}
.bt-root .pill{border-radius:999px;padding:2px 9px;font-size:10px;font-weight:800;border:1px solid var(--line);color:var(--brandink)}
.bt-root .pill.ok{background:#d8f3e1;color:#127a3e;border-color:transparent}
.bt-root .cols{display:grid;grid-template-columns:1fr;gap:12px}
@media(min-width:640px){.bt-root .cols.two{grid-template-columns:1.1fr .9fr}}
.bt-root .stacklist{display:flex;flex-direction:column;gap:8px;margin-top:10px}
.bt-root .flow{display:flex;align-items:stretch;gap:10px;flex-wrap:wrap;justify-content:center}
.bt-root .fcard{flex:1;min-width:170px;border:1px solid var(--line);border-radius:16px;padding:15px;text-align:center;background:var(--surface)}
.bt-root .fcard .ic{font-size:25px}.bt-root .fcard h4{margin:8px 0 3px;font-size:13.5px;font-weight:800}
.bt-root .fcard p{margin:0;font-size:11.5px;color:var(--muted);line-height:1.5}
.bt-root .arrow{align-self:center;font-size:21px;color:var(--faint);font-weight:800}
.bt-root .bt-cap{margin-top:12px;background:var(--surface);border:1px solid var(--line);border-left:4px solid var(--teal);border-radius:12px;padding:11px 13px;font-size:12.5px;line-height:1.55;color:var(--ink2)}
.bt-root .bt-cap b{color:var(--ink)}
.bt-root .bt-controls{margin-top:12px;display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.bt-root .cbtn{border:1px solid var(--line);background:var(--surface);border-radius:10px;padding:8px 15px;font-size:12.5px;font-weight:800;color:var(--ink);cursor:pointer;transition:.15s}
.bt-root .cbtn:hover{border-color:#bcd0f5;background:#f4f8ff}
.bt-root .cbtn.primary{background:linear-gradient(180deg,var(--blue2),var(--blue));border-color:transparent;color:#fff}
.bt-root .cbtn:disabled{opacity:.4;cursor:default}
.bt-root .bt-dots{display:flex;gap:6px;margin-left:auto;align-items:center}
.bt-root .dot{width:8px;height:8px;border-radius:50%;background:var(--line);transition:.25s;cursor:pointer}
.bt-root .dot.on{background:var(--blue);transform:scale(1.25)}
.bt-root .count{font-size:11.5px;color:var(--faint);font-weight:700}
.bt-root .calc{border:1px solid #d7e6ff;background:linear-gradient(180deg,#f7faff,#eef4ff);border-radius:14px;padding:13px}
.bt-root .calc .h{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:800;color:var(--navy);margin-bottom:9px}
.bt-root .prow{display:flex;align-items:center;justify-content:space-between;padding:7px 10px;border-radius:9px;background:var(--surface);border:1px solid var(--line);margin-bottom:6px;font-size:12.5px}
.bt-root .prow .p{font-weight:800}
.bt-root .tagm{font-size:9.5px;font-weight:800;color:#127a3e;background:#d8f3e1;border-radius:999px;padding:1px 7px;margin-left:6px}
.bt-root .tagc{font-size:9.5px;font-weight:800;color:var(--brandink);background:#e7eefc;border-radius:999px;padding:1px 7px;margin-left:6px}
`;

const chip = (nm: string, mt: string, o: { in?: boolean; appear?: string } = {}) =>
  `<div class="chip ${o.in ? "in" : ""} ${o.appear || ""}">
     <div><div class="nm">${nm}</div>${mt ? `<div class="mt">${mt}</div>` : ""}</div>
     ${o.in
       ? `<div style="display:flex;gap:6px;align-items:center"><span class="pill ok">✓ In block</span><span style="font-size:10.5px;font-weight:800;color:var(--faint);text-decoration:underline">Undo</span></div>`
       : `<span class="pill">+ Add to block</span>`}
   </div>`;

const stepCard = (n: number, title: string, lede: string, body: string) =>
  `<div class="card rail-l"><div class="stephead"><span class="c">${n}</span><h3>${title}</h3></div><p class="lede">${lede}</p>${body}</div>`;

type Scene = { step: number; cap: string; html: string };
const SCENES: Scene[] = [
  { step: 0, cap: `A <b>block</b> is a reusable scheduling pattern — build it once, then drop it onto as many listings as you like. It's made of three simple pieces:`,
    html: `<div class="scene"><div class="flow">
      <div class="fcard appear d1"><div class="ic">⏰</div><h4>1 · Periods</h4><p>Daily time windows, e.g. <b>8am–3pm</b>, plus extras like early drop-off.</p></div>
      <div class="arrow appear d1">＋</div>
      <div class="fcard appear d2"><div class="ic">🎟️</div><h4>2 · Passes</h4><p>How long a parent books — a <b>single day</b> or a <b>5-day week</b>.</p></div>
      <div class="arrow appear d2">＝</div>
      <div class="fcard appear d3"><div class="ic">🧩</div><h4>3 · Block</h4><p>Combine them, name it, and the <b>pricing calculator</b> does the rest.</p></div>
    </div></div>` },
  { step: 1, cap: `<b>Step 1 — make a period.</b> A period is a session time window. Give it a title, set start and finish, and press <b>Add period</b>. The timings feed the pricing calculator.`,
    html: `<div class="scene">${stepCard(1, "Make your periods", "A period is a session time window. Title it anything — including extras like Early drop-off or Late pick-up.",
      `<div class="formbox appear"><div class="flab">New period</div><div class="field focus">Main day · 8am–3pm</div>
        <div class="row2"><div><div class="flab" style="margin-bottom:4px">Start</div><div class="field">08:00</div></div><div><div class="flab" style="margin-bottom:4px">Finish</div><div class="field">15:00</div></div></div>
        <div style="display:flex;gap:8px"><span class="btn amber pulse">Add period</span><span class="btn">Cancel</span></div></div>`)}</div>` },
  { step: 1, cap: `Added! Repeat for any extras — here we've also added an <b>Early drop-off</b> period. Make as many as you need; they become the pieces you'll combine in step 3.`,
    html: `<div class="scene">${stepCard(1, "Make your periods", "Your periods so far — add as many as you like.",
      `<span class="btn" style="margin-bottom:10px">+ Add a period</span><div class="stacklist">${chip("Main day · 8am–3pm", "8:00 AM – 3:00 PM", { appear: "appear d1" })}${chip("Early drop-off", "7:30 AM – 9:00 AM", { appear: "appear d2" })}</div>`)}</div>` },
  { step: 2, cap: `<b>Step 2 — make a pass.</b> A pass is simply how long a parent books. Name it, set the number of days, and press <b>Add pass</b>. Here's a full-week pass.`,
    html: `<div class="scene">${stepCard(2, "Make your passes", "A pass is the length of time a parent books — e.g. a single day or a full 5-day week.",
      `<div class="formbox appear"><div class="flab">New pass</div><div class="field focus">5-day week pass</div>
        <div class="row2"><div><div class="flab" style="margin-bottom:4px">Days</div><div class="field">5</div></div><div><div class="flab" style="margin-bottom:4px">Details (optional)</div><div class="field ph">Anything parents should know…</div></div></div>
        <div style="display:flex;gap:8px"><span class="btn amber pulse">Add pass</span><span class="btn">Cancel</span></div></div>`)}</div>` },
  { step: 2, cap: `Now add the shorter options too — a <b>Single day</b> pass. You don't price these by hand: the calculator works out the shorter passes from your headline price.`,
    html: `<div class="scene">${stepCard(2, "Make your passes", "Your passes so far.",
      `<span class="btn" style="margin-bottom:10px">+ Add a pass</span><div class="stacklist">${chip("5-day week pass", "5 days", { appear: "appear d1" })}${chip("Single day", "1 day", { appear: "appear d2" })}</div>`)}</div>` },
  { step: 3, cap: `<b>Step 3 — build the block.</b> Name it, then tap <b>+ Add to block</b> on the periods and passes you want. Added ones turn <b>green</b> with an Undo. Then press <b>Save block</b>.`,
    html: `<div class="scene">${stepCard(3, "Build your blocks", "Name it, add the periods and passes it should include, then save.",
      `<div class="formbox appear" style="margin-bottom:12px"><div class="flab">Block name</div><div class="field focus">Summer Holiday Club</div></div>
       <div class="cols two">
         <div><div class="flab" style="margin-bottom:6px">Periods</div><div class="stacklist" style="margin-top:0">${chip("Main day · 8am–3pm", "8:00 AM – 3:00 PM", { in: true, appear: "appear d1" })}${chip("Early drop-off", "7:30 AM – 9:00 AM", { in: true, appear: "appear d2" })}</div></div>
         <div><div class="flab" style="margin-bottom:6px">Passes</div><div class="stacklist" style="margin-top:0">${chip("5-day week pass", "5 days", { in: true, appear: "appear d2" })}${chip("Single day", "1 day", { in: true, appear: "appear d3" })}</div></div>
       </div>
       <div style="margin-top:13px"><span class="btn amber pulse">Save block</span></div>`)}</div>` },
  { step: 3, cap: `Saved. Set the headline price on your longest pass and the <b>pricing calculator</b> fills in the shorter ones automatically. Then <b>send the block to any listing</b> — reuse it everywhere, no retyping.`,
    html: `<div class="scene">
      <div class="card" style="margin-bottom:12px"><div class="flab" style="margin-bottom:8px">Your blocks</div>
        <div class="chip in appear d1"><div><div class="nm">🧩 Summer Holiday Club</div><div class="mt">2 periods · 2 passes · ready to send to listings</div></div><span class="pill ok">Saved ✓</span></div></div>
      <div class="calc appear d2"><div class="h">💷 Pricing calculator</div>
        <div class="prow"><span>5-day week pass <span class="tagm">master price</span></span><span class="p">£150.00</span></div>
        <div class="prow"><span>Single day <span class="tagc">auto-filled</span></span><span class="p">£33.00</span></div>
        <div style="font-size:11px;color:var(--muted);margin-top:6px;line-height:1.5">Set the longest pass; the calculator prices the shorter ones — edit any of them if you want.</div></div></div>` },
];

const RAIL: [number, string, string][] = [
  [1, "Periods", "Session time windows"],
  [2, "Passes", "How long they book"],
  [3, "Block", "Combine & reuse"],
];

export function BlocksTour() {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const scene = SCENES[i];

  useEffect(() => {
    if (!playing) return;
    if (i === SCENES.length - 1) { setPlaying(false); return; }
    const t = setTimeout(() => setI((n) => n + 1), 4200);
    return () => clearTimeout(t);
  }, [playing, i]);

  const go = (n: number) => { setPlaying(false); setI((n + SCENES.length) % SCENES.length); };

  return (
    <div className="bt-root">
      <style>{CSS}</style>
      <div className="bt-rail">
        {RAIL.map(([s, t, sub]) => (
          <div key={s} className={`rstep ${scene.step === s ? "on" : ""} ${scene.step > 0 && s < scene.step ? "done" : ""}`}>
            <span className="n">{s}</span>
            <span><span className="t">{t}</span><div className="s">{sub}</div></span>
          </div>
        ))}
      </div>

      <div className="bt-stage"><div key={i} dangerouslySetInnerHTML={{ __html: scene.html }} /></div>
      <div className="bt-cap" dangerouslySetInnerHTML={{ __html: scene.cap }} />

      <div className="bt-controls">
        <button type="button" className="cbtn" disabled={i === 0} onClick={() => go(i - 1)}>‹ Back</button>
        <button type="button" className="cbtn primary" onClick={() => go(i === SCENES.length - 1 ? 0 : i + 1)}>{i === SCENES.length - 1 ? "Restart ↻" : "Next ›"}</button>
        <button type="button" className="cbtn" onClick={() => setPlaying((p) => !p)}>{playing ? "⏸ Pause" : "▶ Play"}</button>
        <span className="count">{i + 1} / {SCENES.length}</span>
        <span className="bt-dots">{SCENES.map((_, k) => <span key={k} className={`dot ${k === i ? "on" : ""}`} onClick={() => go(k)} />)}</span>
      </div>
    </div>
  );
}
