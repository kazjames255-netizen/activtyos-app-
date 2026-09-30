"use client";

import { useEffect, useRef } from "react";
import { NARRATOR_CSS, narratorScene } from "@/features/common/tourNarrator";
import { useI18n } from "@/lib/i18n/provider";
import { pickPlural } from "@/lib/i18n/plural";

// ─────────────────────────────────────────────────────────────────────────
// A self-driving, narrated "watch me build it" demo for Sessions & blocks.
// A fake cursor types values in and clicks through: make periods, make passes,
// add them to a block, name it, move it to the Block Library, then price it.
// Optional voice narration uses the browser's most natural British voice.
//
// Rendered imperatively (one static React shell; the tour drives the DOM
// inside `.bt-content`) so it stays byte-for-byte in step with the standalone
// walkthrough. All content is static/author-controlled — no user data.
// ─────────────────────────────────────────────────────────────────────────

const CSS = `
.bt-root{--navy:#16306e;--blue:#2f6bd8;--blue2:#4f8bf5;--teal:#0ea5a5;--green:#0e9a5a;--red:#e21d27;--ink:#12203c;--ink2:#3a4a68;--muted:#5b6b86;--faint:#9aa6bd;--line:#e6ebf5;--panel:#f4f7fc;--surface:#fff;--brandink:#1d3a8f;color:var(--ink)}
.bt-root .rail{display:flex;gap:8px;margin:0 0 14px;flex-wrap:wrap}
.bt-root .rstep{flex:1;min-width:120px;display:flex;align-items:center;gap:9px;padding:8px 11px;border-radius:12px;background:var(--surface);border:1px solid var(--line);transition:.35s}
.bt-root .rstep .n{width:23px;height:23px;border-radius:50%;display:grid;place-items:center;font-size:12px;font-weight:800;background:var(--panel);color:var(--faint);border:1px solid var(--line);flex:none;transition:.35s}
.bt-root .rstep .t{font-size:12.5px;font-weight:800;color:var(--faint);transition:.35s}
.bt-root .rstep .s{font-size:10px;color:var(--faint);margin-top:1px}
.bt-root .rstep.on{border-color:#bcd0f5;background:#f4f8ff}.bt-root .rstep.on .n{background:var(--navy);color:#fff;border-color:transparent}.bt-root .rstep.on .t{color:var(--navy)}
.bt-root .rstep.done .n{background:var(--green);color:#fff;border-color:transparent}.bt-root .rstep.done .t{color:var(--ink2)}
.bt-root .bt-stage{position:relative;background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:16px;box-shadow:0 24px 50px -36px rgba(20,48,110,.5);min-height:330px;overflow:hidden}
.bt-root .appear{animation:btrise .45s ease both}@keyframes btrise{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}
.bt-root .card{border:1px solid var(--line);border-radius:16px;background:var(--surface);padding:14px}.bt-root .card.rail-l{border-inline-start:4px solid var(--blue)}
.bt-root .stephead{display:flex;align-items:center;gap:10px;margin-bottom:6px}.bt-root .stephead .c{width:29px;height:29px;border-radius:50%;background:var(--navy);color:#fff;display:grid;place-items:center;font-weight:800;font-size:14px;flex:none}.bt-root .stephead h3{margin:0;font-size:15px;font-weight:800}
.bt-root .lede{font-size:11.5px;color:var(--muted);line-height:1.5;margin:2px 0 12px}
.bt-root .formbox{border:1px solid var(--line);background:var(--panel);border-radius:12px;padding:11px;display:flex;flex-direction:column;gap:8px}
.bt-root .flab{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:var(--faint)}
.bt-root .field{border:1px solid var(--line);background:var(--surface);border-radius:9px;padding:8px 10px;font-size:12.5px;color:var(--ink);font-weight:600;min-height:34px}.bt-root .field.ph{color:var(--faint);font-weight:500}.bt-root .field.focus{border-color:var(--navy);box-shadow:0 0 0 3px rgba(22,48,110,.12)}
.bt-root .caret{display:inline-block;width:1.5px;height:14px;background:var(--navy);margin-inline-start:1px;vertical-align:-2px;animation:btblink 1s step-end infinite}@keyframes btblink{50%{opacity:0}}
.bt-root .row2{display:flex;gap:8px}.bt-root .row2>div{flex:1}
.bt-root .btn{border-radius:999px;padding:7px 14px;font-size:12.5px;font-weight:800;border:1px solid var(--line);background:var(--surface);color:var(--ink2);display:inline-block}.bt-root .btn.amber{background:linear-gradient(180deg,#f7c65a,#f0a92f);border-color:transparent;color:#5b3d05}
.bt-root .chip{display:flex;align-items:center;justify-content:space-between;gap:8px;border:1px solid var(--line);background:var(--panel);border-radius:12px;padding:9px 12px}.bt-root .chip .nm{font-size:12.5px;font-weight:800;color:var(--ink)}.bt-root .chip .mt{font-size:11px;color:var(--faint);margin-top:1px}.bt-root .chip.in{background:#eefaf1;border-color:#bfe6cd}
.bt-root .pill{border-radius:999px;padding:2px 9px;font-size:10px;font-weight:800;border:1px solid var(--line);color:var(--brandink);white-space:nowrap}.bt-root .pill.ok{background:#d8f3e1;color:#127a3e;border-color:transparent}
.bt-root .bchip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);background:var(--surface);border-radius:999px;padding:6px 11px;font-size:12px;font-weight:800}.bt-root .bchip .mt{color:var(--faint);font-weight:600}.bt-root .bchip .x{color:var(--faint);font-weight:800;font-size:13px}
.bt-root .drop{border:2px dashed var(--line);border-radius:12px;padding:12px;margin-bottom:12px;display:grid;grid-template-columns:1fr;gap:10px}@media(min-width:560px){.bt-root .drop{grid-template-columns:1fr 1fr}}
.bt-root .stacklist{display:flex;flex-direction:column;gap:8px}
.bt-root .lib{border:1px solid var(--line);border-radius:14px;overflow:hidden;box-shadow:0 18px 40px -30px rgba(20,48,110,.5)}
.bt-root .lib .hd{background:linear-gradient(100deg,#16306e,#2f6bd8 90%);color:#fff;padding:12px 14px;display:flex;align-items:flex-start;gap:10px;cursor:pointer}
.bt-root .lib .drag{color:rgba(255,255,255,.55);font-size:12px;letter-spacing:1px;margin-top:2px}.bt-root .lib .sw{width:16px;height:16px;border-radius:5px;background:#3b82f6;box-shadow:0 0 0 2px rgba(255,255,255,.4);margin-top:2px;flex:none}
.bt-root .lib .nm{font-size:15px;font-weight:800;display:flex;align-items:center;gap:7px}.bt-root .lib .sub{font-size:11.5px;color:rgba(255,255,255,.82);margin-top:2px}
.bt-root .lib .r{margin-inline-start:auto;display:flex;align-items:center;gap:9px}.bt-root .lib .unpriced{background:rgba(255,255,255,.92);color:#1d3a8f;border-radius:999px;padding:3px 11px;font-size:11px;font-weight:800}.bt-root .lib .chev{color:rgba(255,255,255,.85);font-size:11px}
.bt-root .lib .bd{padding:14px;background:#fff}.bt-root .lib .grid2{display:grid;grid-template-columns:1fr;gap:12px}@media(min-width:520px){.bt-root .lib .grid2{grid-template-columns:1fr 1fr}}
.bt-root .lib .seclab{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:var(--faint);margin-bottom:4px}.bt-root .lib .line{font-size:12.5px;font-weight:700;margin-bottom:2px}.bt-root .lib .line .g{color:var(--faint);font-weight:600}
.bt-root .lib .acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.bt-root .lib .abtn{border:1px solid var(--line);border-radius:999px;padding:7px 14px;font-size:12px;font-weight:800;color:var(--ink2)}.bt-root .lib .abtn.del{color:var(--red);border-color:#f6c9cc}
.bt-root .calc2{border:1px solid #d7e6ff;background:linear-gradient(180deg,#f7faff,#eef4ff);border-radius:14px;padding:13px}
.bt-root .calc2 .h{display:flex;align-items:center;gap:9px;font-size:13px;font-weight:800;color:var(--navy);margin-bottom:6px}
.bt-root .calc2 .tog{width:32px;height:18px;border-radius:999px;background:var(--blue);position:relative}.bt-root .calc2 .knob{position:absolute;top:2px;inset-inline-start:16px;width:14px;height:14px;border-radius:50%;background:#fff}
.bt-root .calc2 .cnote{font-size:11px;color:var(--muted);margin:0 0 10px;line-height:1.5}
.bt-root .calc2 .prow2{display:flex;align-items:center;justify-content:space-between;gap:10px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:9px 11px;margin-bottom:7px}
.bt-root .calc2 .pn{font-size:12.5px;font-weight:800}.bt-root .calc2 .pd{font-size:10.5px;color:var(--faint)}
.bt-root .calc2 .pin{font-size:13px;font-weight:800;display:flex;align-items:center;gap:4px}
.bt-root .calc2 .pinF{border:1px solid var(--navy);box-shadow:0 0 0 3px rgba(22,48,110,.12);border-radius:8px;padding:4px 8px;background:#fff;min-width:60px;display:inline-block}
.bt-root .calc2 .autotag{font-size:9.5px;font-weight:800;color:#127a3e;background:#d8f3e1;border-radius:999px;padding:1px 7px;margin-inline-start:4px}
.bt-root .calc2 .trow{display:flex;align-items:center;justify-content:space-between;font-size:12px;font-weight:700;padding:5px 0}.bt-root .calc2 .trow .g{color:var(--faint);font-weight:600}
.bt-root .bt-cursor{position:absolute;left:0;top:0;z-index:20;pointer-events:none;transition:transform .55s cubic-bezier(.5,.05,.25,1);filter:drop-shadow(0 3px 4px rgba(20,48,110,.35))}.bt-root .bt-cursor.down{transition:transform .1s}
.bt-root .bt-cursor .ring{position:absolute;left:-9px;top:-9px;width:34px;height:34px;border-radius:50%;border:2px solid var(--blue);opacity:0}.bt-root .bt-cursor.click .ring{animation:btclk .4s ease-out}@keyframes btclk{0%{opacity:.7;transform:scale(.3)}100%{opacity:0;transform:scale(1)}}
.bt-root .bt-cap{margin-top:12px;background:var(--surface);border:1px solid var(--line);border-inline-start:4px solid var(--teal);border-radius:12px;padding:11px 13px;font-size:12.5px;line-height:1.55;color:var(--ink2);min-height:42px}.bt-root .bt-cap b{color:var(--ink)}
.bt-root .bt-controls{margin-top:12px;display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.bt-root .cbtn{border:1px solid var(--line);background:var(--surface);border-radius:10px;padding:8px 15px;font-size:12.5px;font-weight:800;color:var(--ink);cursor:pointer}.bt-root .cbtn:hover{border-color:#bcd0f5;background:#f4f8ff}.bt-root .cbtn.on{background:#eef4ff;border-color:#bcd0f5;color:var(--brandink)}
.bt-root .bt-count{font-size:11.5px;color:var(--faint);font-weight:700}
`;

export function BlocksTour() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { locale, t } = useI18n();

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const stage = root.querySelector(".bt-stage") as HTMLElement;
    const content = root.querySelector(".bt-content") as HTMLElement;
    const cursor = root.querySelector(".bt-cursor") as HTMLElement;
    const capEl = root.querySelector(".bt-cap") as HTMLElement;
    const countEl = root.querySelector(".bt-count") as HTMLElement;
    const rail = [...root.querySelectorAll(".rstep")] as HTMLElement[];
    const replayBtn = root.querySelector(".bt-replay") as HTMLElement;
    const soundBtn = root.querySelector(".bt-sound") as HTMLElement;
    const hasSpeech = typeof window !== "undefined" && "speechSynthesis" in window;

    const L = (k: string, v?: Record<string, string | number>) => t("p8lst." + k, v);
    const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const PERIODS = [
      { key: "p1", nm: "8am-3pm", mt: "8:00 AM – 3:00 PM", start: "08:00", finish: "15:00" },
      { key: "p2", nm: "9am-3.30pm", mt: "9:00 AM – 3:30 PM", start: "09:00", finish: "15:30" },
    ];
    const PASSES = [
      { key: "x1", nm: L("bktPass5"), mt: pickPlural(t, locale, "p8lst.blkDays", 5), days: "5" },
      { key: "x2", nm: L("bktPass1"), mt: pickPlural(t, locale, "p8lst.blkDays", 1), days: "1" },
    ];

    let token = 0, dead = false, soundOn = false;
    let voice: SpeechSynthesisVoice | null = null;
    let speaking: Promise<unknown> = Promise.resolve();
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const strip = (h: string) => h.replace(/<[^>]+>/g, "").replace(/[—–]/g, ", ").replace(/\s+/g, " ").trim();
    const readMs = (t: string) => Math.max(2600, t.split(/\s+/).length * 340);
    const pick = (id: string) => content.querySelector("#" + id) as HTMLElement | null;

    // One fixed narrator, matching the shared GuidedTour: "Google UK English
    // Female" when available, else the closest British female / en-GB voice.
    // No picker.
    function pickVoice(): SpeechSynthesisVoice | null {
      if (!hasSpeech) return null;
      const vs = window.speechSynthesis.getVoices();
      if (!vs.length) return null;
      if (locale !== "en") { const own = vs.find((v) => v.lang.toLowerCase().startsWith(locale)); if (own) return own; }
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
      speaking = Promise.race([new Promise((res) => { u.onend = () => { mouth(false); res(undefined); }; u.onerror = () => { mouth(false); res(undefined); }; }), sleep(20000).then(() => mouth(false))]);
      s.speak(u);
    }
    async function line(h: string) { await speaking; capEl.innerHTML = h; const t = strip(h); speak(t); await Promise.all([speaking, sleep(readMs(t))]); }

    async function move(id: string, ox = 0.5, oy = 0.6) {
      const e = pick(id);
      if (e) { const r = e.getBoundingClientRect(), s = stage.getBoundingClientRect(); cursor.classList.remove("down"); cursor.style.transform = `translate(${r.left - s.left + r.width * ox}px,${r.top - s.top + r.height * oy}px) scale(1)`; }
      await sleep(650);
    }
    async function click() {
      cursor.classList.add("down", "click"); cursor.style.transform = cursor.style.transform.replace("scale(1)", "scale(.82)"); await sleep(150);
      cursor.classList.remove("down"); cursor.style.transform = cursor.style.transform.replace("scale(.82)", "scale(1)"); await sleep(120);
      cursor.classList.remove("click");
    }
    async function type(id: string, text: string, tk: number) {
      const e = pick(id); if (!e) return; e.classList.remove("ph");
      for (let i = 1; i <= text.length; i++) { if (tk !== token || dead) return; e.innerHTML = text.slice(0, i) + '<span class="caret"></span>'; await sleep(40); }
    }
    function setRail(on: number) { rail.forEach((r) => { const s = Number(r.dataset.s); r.classList.toggle("on", s === on); r.classList.toggle("done", on > s); }); countEl.textContent = L(on > 4 ? "bktStepDone" : "bktStep", { n: Math.min(on, 4) }); }
    const chip = (it: { key: string; nm: string; mt: string }, inb: boolean) => `<div class="chip ${inb ? "in" : ""}"><div><div class="nm">${it.nm}</div><div class="mt">${it.mt}</div></div>${inb ? '<div style="display:flex;gap:6px;align-items:center"><span class="pill ok">${esc(L("blkInBlock"))}</span><span style="font-size:10.5px;font-weight:800;color:var(--faint);text-decoration:underline">${esc(L("blkUndo"))}</span></div>' : `<span class="pill" id="add-${it.key}">${esc(L("blkAddToBlock"))}</span>`}</div>`;
    const makeForm = (kind: "p" | "x", made: { key: string; nm: string; mt: string }[], added: Record<string, boolean>, cur: { start?: string; finish?: string; days?: string }) => {
      const isP = kind === "p";
      return `<div class="card rail-l"><div class="stephead"><span class="c">${isP ? 1 : 2}</span><h3>${esc(isP ? L("blkStep1") : L("blkStep2"))}</h3></div>
        <div class="formbox" style="margin-bottom:12px"><div class="flab">${esc(isP ? L("blkNewPeriod") : L("blkNewPass"))}</div>
          <div class="field ph focus" id="${isP ? "pTitle" : "passName"}">${esc(isP ? L("blkPeriodTitlePh") : L("blkPassNamePh"))}<span class="caret"></span></div>
          <div class="row2"><div><div class="flab" style="margin-bottom:4px">${esc(isP ? L("blkStart") : L("blkDaysLabel"))}</div><div class="field">${isP ? cur.start : cur.days}</div></div>
            <div><div class="flab" style="margin-bottom:4px">${esc(isP ? L("blkFinish") : L("bktDetailsOptLabel"))}</div><div class="field ${isP ? "" : "ph"}">${isP ? cur.finish : esc(L("bktDetailsPh"))}</div></div></div>
          <div style="display:flex;gap:8px"><span class="btn amber" id="${isP ? "pAdd" : "passAdd"}">${esc(isP ? L("blkAddPeriod") : L("blkAddPass"))}</span><span class="btn">${esc(L("blkCancel"))}</span></div></div>
        <div class="stacklist">${made.map((it) => `<div class="appear">${chip(it, !!added[it.key])}</div>`).join("")}</div></div>`;
    };
    const blockView = `<div class="card rail-l"><div class="stephead"><span class="c">3</span><h3>${esc(L("blkStep3"))}</h3></div>
      <p class="lede">${esc(L("bktBuildLede"))}</p>
      <div class="drop"><div><div class="flab" style="margin-bottom:6px">${esc(L("blkPeriods"))}</div><div class="stacklist">${PERIODS.map((p) => `<span class="bchip">${p.nm} <span class="mt">${p.mt}</span> <span class="x">×</span></span>`).join("")}</div></div>
        <div><div class="flab" style="margin-bottom:6px">${esc(L("blkPasses"))}</div><div class="stacklist">${PASSES.map((p) => `<span class="bchip">${p.nm} <span class="x">×</span></span>`).join("")}</div></div></div>
      <div class="flab" style="margin-bottom:6px">${esc(L("blkNameBlock"))}</div>
      <div class="field ph focus" id="bName" style="margin-bottom:12px">${esc(L("blkNamePh"))}<span class="caret"></span></div>
      <span class="btn amber" id="save">${esc(L("blkMoveToLib"))}</span></div>`;
    const libView = `<div class="appear"><div style="font-size:15px;font-weight:800;margin-bottom:3px">${esc(L("blkLibrary"))}</div>
      <div style="font-size:11.5px;color:var(--muted);margin-bottom:12px">${esc(L("bktLibLede"))}</div>
      <div class="lib"><div class="hd" id="libHd" title="${esc(L("bktTapToggle"))}"><span class="drag">⠿</span><span class="sw"></span>
        <div><div class="nm">${esc(L("bktBlockName"))} <span style="font-size:12px;opacity:.8">✎</span></div><div class="sub">${esc(L("blkCounts", { p: 2, q: 2 }))}</div></div>
        <div class="r"><span class="unpriced">${esc(L("bktUnpriced"))}</span><span class="chev" id="libChev">▲</span></div></div>
        <div class="bd" id="libBd"><div class="grid2"><div><div class="seclab">${esc(L("blkPeriods"))}</div>${PERIODS.map((p) => `<div class="line">${p.nm} <span class="g">${p.mt}</span></div>`).join("")}</div>
          <div><div class="seclab">${esc(L("blkPasses"))}</div><div class="line">${esc(L("bktPass5"))} <span class="g">· ${esc(L("bktPass1"))}</span></div></div></div>
          <div style="margin-top:12px"><div class="seclab">${esc(L("blkSentTo"))}</div><div style="font-size:12.5px;color:var(--muted)">${esc(L("blkNotSent"))}</div></div>
          <div class="acts"><span class="abtn" id="sortPrice">${esc(L("blkSortPricing"))}</span><span class="abtn">${esc(L("blkEdit"))}</span><span class="abtn">${esc(L("blkDuplicate"))}</span><span class="abtn">${esc(L("blkArchive"))}</span><span class="abtn del">${esc(L("blkDelete"))}</span></div></div></div></div>`;
    const calcView = `<div class="appear"><div style="font-size:15px;font-weight:800;margin-bottom:3px">${esc(L("bktPricing"))}</div>
      <div style="font-size:11.5px;color:var(--muted);margin-bottom:12px">${esc(L("bktPricingLede"))}</div>
      <div class="calc2"><div class="h"><span>${esc(L("blkCalcTitle"))}</span><span class="tog"><span class="knob"></span></span><span style="font-size:11px;color:var(--faint)">${esc(L("blkAutoOn"))}</span></div>
        <p class="cnote">${esc(L("bktCnote"))}</p>
        <div style="border:1px solid var(--line);border-radius:10px;overflow:hidden;margin-bottom:7px">
          <div class="prow2" style="border:0;border-radius:0;margin:0"><div><div class="pn">${esc(L("bktPass5"))}</div><div class="pd">${esc(PASSES[0].mt)} · ${esc(L("blkLongest"))}</div></div><div class="pin">£ <span class="pinF" id="masterPrice">0.00</span> <span id="passChev" style="color:var(--faint);font-size:11px">▼</span></div></div>
          <div id="passBd" style="display:none;border-top:1px dashed var(--line);padding:8px 11px;background:#fbfdff">
            <div style="font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:var(--faint);margin-bottom:4px">${esc(L("bktTimingsPerDay"))}</div>
            <div class="trow"><span>8am-3pm <span class="g">8:00 AM–3:00 PM</span></span><span>£ <span class="pinF">26.00</span></span></div>
            <div class="trow"><span>9am-3.30pm <span class="g">9:00 AM–3:30 PM</span></span><span>£ <span class="pinF">30.00</span></span></div></div></div>
        <div class="prow2"><div><div class="pn">${esc(L("bktPass1"))}</div><div class="pd">${esc(PASSES[1].mt)}</div></div><div class="pin" id="autoPrice">£0.00 <span class="autotag">${esc(L("bktAuto"))}</span></div></div>
        <div style="margin-top:12px"><span class="btn amber" id="savePrice">${esc(L("blkSavePricing"))}</span></div></div></div>`;

    function wireLib() { const hd = pick("libHd"), bd = pick("libBd"), chev = pick("libChev"); if (!hd) return; hd.onclick = () => { const open = bd!.style.display !== "none"; bd!.style.display = open ? "none" : ""; chev!.textContent = open ? "▼" : "▲"; }; }

    async function run() {
      const tk = ++token; const alive = () => tk === token && !dead;
      cursor.style.transform = "translate(24px,20px) scale(1)";
      const added: Record<string, boolean> = {};
      // Intro bookend
      setRail(1); content.innerHTML = narratorScene(L("bktGuided"), esc(L("blkHeroTitle")), L("bktSitBack"));
      await line(L("bktN1")); if (!alive()) return;
      // Phase 1 — periods
      content.innerHTML = makeForm("p", [], added, PERIODS[0]);
      const madeP: typeof PERIODS = [];
      const lineP = [L("bktN2"), L("bktN3")];
      for (let i = 0; i < PERIODS.length; i++) {
        const act = (async () => {
          content.innerHTML = makeForm("p", madeP, added, PERIODS[i]);
          await move("pTitle", 0.15); await type("pTitle", PERIODS[i].nm, tk); await sleep(150);
          await move("pAdd"); await click(); madeP.push(PERIODS[i]); content.innerHTML = makeForm("p", madeP, added, PERIODS[i]); await sleep(250);
          await move("add-" + PERIODS[i].key); await click(); added[PERIODS[i].key] = true; content.innerHTML = makeForm("p", madeP, added, PERIODS[i]);
        })();
        await line(lineP[i]); await act; if (!alive()) return;
      }
      // Phase 2 — passes
      setRail(2); content.innerHTML = makeForm("x", [], added, PASSES[0]);
      await line(L("bktN4")); if (!alive()) return;
      const madeX: typeof PASSES = [];
      const lineX = [L("bktN5"), L("bktN6")];
      for (let i = 0; i < PASSES.length; i++) {
        const act = (async () => {
          content.innerHTML = makeForm("x", madeX, added, PASSES[i]);
          await move("passName", 0.15); await type("passName", PASSES[i].nm, tk); await sleep(150);
          await move("passAdd"); await click(); madeX.push(PASSES[i]); content.innerHTML = makeForm("x", madeX, added, PASSES[i]); await sleep(250);
          await move("add-" + PASSES[i].key); await click(); added[PASSES[i].key] = true; content.innerHTML = makeForm("x", madeX, added, PASSES[i]);
        })();
        await line(lineX[i]); await act; if (!alive()) return;
      }
      // Phase 3 — name + move to library
      setRail(3); content.innerHTML = blockView;
      const act3 = (async () => { await move("bName", 0.1); await type("bName", L("bktBlockName"), tk); await sleep(150); await move("save"); await click(); })();
      await line(L("bktN7")); await act3; if (!alive()) return;
      // Phase 4 — library
      setRail(3); content.innerHTML = libView; wireLib();
      await line(L("bktN8")); if (!alive()) return;
      await move("sortPrice"); await click(); if (!alive()) return;
      // Phase 5 — pricing
      setRail(4); content.innerHTML = calcView;
      const act5 = (async () => {
        await move("masterPrice", 0.5); await type("masterPrice", "150.00", tk); await sleep(400);
        const a = pick("autoPrice"); if (a) a.innerHTML = '£30.00 <span class="autotag">' + esc(L("bktAuto")) + '</span>';
        await sleep(500);
        await move("passChev"); await click(); const bd = pick("passBd"), ch = pick("passChev"); if (bd) bd.style.display = ""; if (ch) ch.textContent = "▲"; await sleep(800);
        await move("savePrice"); await click();
      })();
      await line(L("bktN9")); await act5; if (!alive()) return;
      // Done bookend
      setRail(5); content.innerHTML = narratorScene(L("bktComplete"), L("bktAllDone"), L("bktAllDoneSub"));
      await line(L("bktN10"));
    }

    let voicePoll = 0;
    const pollIv = hasSpeech ? window.setInterval(() => { if (window.speechSynthesis.getVoices().length) { voice = pickVoice(); window.clearInterval(pollIv); } else if (++voicePoll > 24) window.clearInterval(pollIv); }, 250) : 0;
    if (hasSpeech) { voice = pickVoice(); window.speechSynthesis.onvoiceschanged = () => { voice = pickVoice(); }; }
    replayBtn.onclick = () => { run(); };
    soundBtn.onclick = () => { soundOn = !soundOn; soundBtn.classList.toggle("on", soundOn); soundBtn.textContent = soundOn ? L("bktSoundOn") : L("bktPlaySound"); if (hasSpeech) window.speechSynthesis.cancel(); if (soundOn) run(); };
    run();

    return () => { dead = true; token++; window.clearInterval(pollIv); if (hasSpeech) { window.speechSynthesis.cancel(); window.speechSynthesis.onvoiceschanged = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  return (
    <div className="bt-root" ref={rootRef}>
      <style>{CSS + NARRATOR_CSS}</style>
      <div className="rail">
        <div className="rstep" data-s="1"><span className="n">1</span><span><span className="t">{t("p8lst.blkPeriods")}</span><div className="s">{t("p8lst.bktRail1Sub")}</div></span></div>
        <div className="rstep" data-s="2"><span className="n">2</span><span><span className="t">{t("p8lst.blkPasses")}</span><div className="s">{t("p8lst.bktRail2Sub")}</div></span></div>
        <div className="rstep" data-s="3"><span className="n">3</span><span><span className="t">{t("p8lst.bktRail3")}</span><div className="s">{t("p8lst.bktRail3Sub")}</div></span></div>
        <div className="rstep" data-s="4"><span className="n">4</span><span><span className="t">{t("p8lst.bktRail4")}</span><div className="s">{t("p8lst.bktRail4Sub")}</div></span></div>
      </div>
      <div className="bt-stage">
        <div className="bt-cursor down"><span className="ring" /><svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 2 L4 19 L8.5 14.5 L11.5 21.5 L14 20.5 L11 13.8 L18 13.8 Z" fill="#12203c" stroke="#fff" strokeWidth="1.3" strokeLinejoin="round" /></svg></div>
        <div className="bt-content" />
      </div>
      <div className="bt-cap" />
      <div className="tctl bt-controls">
        <span className="tctl-count bt-count" />
        <button type="button" className="tctl-btn bt-replay" title={t("p8lst.bktStartAgain")}>{t("p8lst.bktReplay")}</button>
        <button type="button" className="tctl-btn bt-sound">{t("p8lst.bktPlaySound")}</button>
      </div>
    </div>
  );
}
