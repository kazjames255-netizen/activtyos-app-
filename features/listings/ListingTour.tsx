"use client";

import { useEffect, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────
// A self-driving, narrated "watch me build it" demo for creating a listing.
// A fake cursor types through the 13-step builder — Basics → … → Publish —
// with short British-female narration (a little more on the trickier steps).
// Rendered imperatively into `.lt-content`; styles scoped under `.lt-root`.
// ─────────────────────────────────────────────────────────────────────────

const F = '<span class="caret"></span>';
type TypeField = { id: string; text: string };
type Step = { stage: string; label: string; line: string; body: string; type?: TypeField | TypeField[]; click?: string; tabHtml?: string; scroll?: boolean };
const STEPS: Step[] = [
  { stage: "About", label: "Basics", line: "Start with the basics — a clear name, and a big, bright photo. Pick a layout to see how it looks, then add your main image. You can pop extra photos in the gallery too.", type: { id: "F", text: "Summer Multi-Activity Camp" },
    body: `<div class="frm"><div><div class="fl">Listing title · up to 70 characters</div><div class="field ph focus" id="F">e.g. Summer Multi-Activity Camp${F}</div></div><div><div class="fl">Main image — layout + hero photo</div><div class="hero"><span class="heroem">⚽🤸🎨🏕️</span><span class="herocap">Summer Multi-Activity Camp</span></div><div class="lay" style="margin-top:7px"><span class="layopt on">🖼️ One big image</span><span class="layopt">Wide banner</span><span class="layopt">Collage</span><span class="layopt">Big + thumbnails</span></div></div></div>` },
  { stage: "About", label: "Details", line: "Add the details — the age range it's for, from and to, and choose your venue.", type: [{ id: "F", text: "5" }, { id: "F2", text: "12" }],
    body: `<div class="frm"><div class="row2"><div><div class="fl">Age from</div><div class="field ph focus" id="F">e.g. 5${F}</div></div><div><div class="fl">Age to</div><div class="field ph" id="F2">e.g. 12</div></div></div><div><div class="fl">Venue</div><div class="field">📍 Riverside Sports Hall</div></div></div>` },
  { stage: "About", label: "Capacity", line: "Set your capacity — the most children per session; once it's full, bookings stop by themselves. If you run age groups you can cap each one per day too — but leave those blank if you just have one overall number. Blank means no limit, and zero means closed.", type: { id: "F", text: "24" },
    body: `<div class="frm"><div style="max-width:210px"><div class="fl">Max children per session</div><div class="field ph focus" id="F">0${F}</div></div>
      <div class="fl" style="margin-top:2px">Per-age caps<span style="font-weight:600;color:var(--faint);text-transform:none;letter-spacing:0"> — optional, per day</span></div>
      <div class="capgrp"><span class="dot" style="background:#e2559a"></span><b>Cubs</b> <span class="g">5–7 · room 32</span><span class="field2">no limit</span></div>
      <div class="capgrp"><span class="dot" style="background:#2f6bd8"></span><b>Explorers</b> <span class="g">8–10 · room 32</span><span class="field2">no limit</span></div>
      <div class="capgrp"><span class="dot" style="background:#16306e"></span><b>Adventurers</b> <span class="g">11–14 · room 30</span><span class="field2">no limit</span></div>
      <div class="hint">Leave these blank if you just have an overall capacity. Blank = no limit · 0 = closed.</div></div>` },
  { stage: "About", label: "Content", line: "Now the description — tell parents what to expect. A friendly, clear write-up is what sells your listing.", type: { id: "F", text: "A fun-packed week of sports, games and crafts — something for everyone." },
    body: `<div class="frm"><div><div class="fl">Description</div><div class="field ph focus" id="F" style="min-height:64px">Tell parents what to expect…${F}</div></div></div>` },
  { stage: "About", label: "Provided", line: "Now the extras — three quick tabs here: what's provided, what to bring, and the outcomes children get. Tick what's included, then flick to What to bring and add things like a packed lunch or sun cream.", click: "C",
    tabHtml: `<div class="chips"><span class="ochip">🥪 Packed lunch</span><span class="ochip">🧴 Sun cream</span><span class="ochip">👟 Trainers</span><span class="ochip">💧 Water bottle</span><span class="btn">＋ Add option</span></div>`,
    body: `<div class="frm"><div class="tabs2"><span class="tab2 on">What's provided</span><span class="tab2" id="C">What to bring</span><span class="tab2">Outcomes</span></div>
      <div id="tabc"><div class="chips"><span class="ochip">🍽️ Hot lunch</span><span class="ochip">🎒 All equipment</span><span class="ochip">🍎 Snacks &amp; drinks</span><span class="btn">＋ Add option</span></div></div></div>` },
  { stage: "About", label: "Safety & SEND", line: "Safety and inclusion isn't free text — you pick from ready-made chips. Show your safety features, like DBS-checked staff and first aid, and the SEND support you offer, like a quiet space or one-to-one help. Anything you add here is saved for every listing.", click: "C",
    body: `<div class="frm"><div class="fl">Safety features</div><div class="chips"><span class="ochip">🛡️ DBS-checked staff</span><span class="ochip">🚑 First aid on site</span><span class="ochip">🧑‍⚖️ Safeguarding lead</span><span class="ochip">👥 Low ratios</span><span class="btn" id="C">＋ Add option</span></div>
      <div class="fl" style="margin-top:6px">SEND &amp; accessibility</div><div class="chips"><span class="ochip">♿ Wheelchair accessible</span><span class="ochip">🤝 1:1 support</span><span class="ochip">🤫 Quiet space</span><span class="ochip">🎓 SEND-trained staff</span></div></div>` },
  { stage: "When it runs", label: "When it runs", line: "Pick your dates, and the calendar builds itself. Not running a particular day — a bank holiday, say, or you just don't run Thursdays? Tap it to switch it off. Everything else stays bookable.", click: "C",
    body: `<div class="frm"><div class="row2"><div><div class="fl">Runs from</div><div class="field">Mon 28 Jul</div></div><div><div class="fl">Runs to</div><div class="field">Fri 8 Aug</div></div></div>
      <div class="fl">Calendar · 2 weeks — tap a day to switch it off</div>
      <div class="wkcard"><div class="wkhd" style="background:#16306e">Week 1 · from Mon 28 Jul</div><div class="wkdays"><span class="dchip">Mon 28</span><span class="dchip">Tue 29</span><span class="dchip">Wed 30</span><span class="dchip" id="C">Thu 31</span><span class="dchip">Fri 1</span></div></div>
      <div class="wkcard"><div class="wkhd" style="background:#2f6bd8">Week 2 · from Mon 4 Aug</div><div class="wkdays"><span class="dchip">Mon 4</span><span class="dchip">Tue 5</span><span class="dchip">Wed 6</span><span class="dchip">Thu 7</span><span class="dchip">Fri 8</span></div></div></div>` },
  { stage: "Tickets & pricing", label: "Tickets & pricing", line: "Your tickets come straight from the block you built — its passes and their prices. Each one can tweak its own age range and its capacity per day; that's how you'd cap a one-to-one place to the staff you have. Close a ticket and parents still see it marked closed; Hide it and it's gone. And here you choose how parents book each pass — any five days in one week, any five across the whole listing, or a fixed block.", click: "C",
    body: `<div class="frm"><div class="selrow">🧩 Summer Camp · 1 period · 2 passes<span class="pill2">✓ Selected</span></div>
      <div class="fl">Tickets on this listing — each can amend its own age &amp; capacity</div>
      <div class="tkt"><div class="tkhd"><b>5 day pass</b> <span class="g">5 days</span><span class="tkp">£500.00</span><span class="mini">Close</span><span class="mini">Hide</span></div>
        <div class="tkrow"><span class="mini2">Age from —</span><span class="mini2">Age to —</span><span class="mini2">Capacity/day 60</span></div></div>
      <div class="tkt"><div class="tkhd"><b>1 day pass</b> <span class="g">1 day</span><span class="tkp">£100.00</span><span class="mini">Close</span><span class="mini">Hide</span></div></div>
      <div class="fl" style="margin-top:2px">How parents can book each pass<span style="text-transform:none;letter-spacing:0;color:var(--ink2)"> · 5 day pass</span></div>
      <div class="chips"><span class="rchip on" data-note="Parents pick any 5 days within a single week.">Any 5 days in one week</span><span class="rchip" data-note="Parents pick any 5 days across all the weeks it runs.">Any 5 days across the listing</span><span class="rchip" id="C" data-note="Parents book one fixed Monday–Friday block.">Fixed 5-day block</span></div>
      <div class="hint" id="rnote">Parents pick any 5 days within a single week.</div></div>` },
  { stage: "Tickets & pricing", label: "Discounts", line: "Discounts are optional, but lovely. There are three kinds: multi-person, for siblings or a friend booking together; multi-session, a percentage off when they book several; and early bird, money off if they book before a date. Pick a type, name it, set the amount — and parents see it right there on the booking page. They come off automatically, so there's nothing for you to do.", click: "C",
    body: `<div class="frm"><div class="fl">Select a discount type</div>
      <div class="dtypes"><div class="dtype"><b>👥 Multi-person</b><div class="ds">Siblings or a friend booking together pay less.</div></div>
        <div class="dtype"><b>📅 Multi-session</b><div class="ds">Book more than 3 sessions to get 10% off.</div></div>
        <div class="dtype on" id="C"><b>🐤 Early bird</b><div class="ds">£10 off when they book before 1 June.</div></div></div>
      <div><div class="fl">Name your discount — parents see this</div><div class="field">Early bird — £10 off before 1 June</div></div>
      <div class="row2"><div><div class="fl">Discount method</div><div class="field">Subtract an amount</div></div><div><div class="fl">Amount</div><div class="field">£10</div></div></div>
      <div class="hint" style="border-left:3px solid var(--blue);padding-left:9px"><b>Parents will see:</b> Early bird — £10 off before 1 June</div></div>` },
  { stage: "Extras & team", label: "Add-ons", line: "Offer optional add-ons — a hot lunch, or late pick-up — that parents can tick on at checkout.", click: "C",
    body: `<div class="frm"><div class="fl">Optional add-ons</div><div class="chk"><span class="chkbx">✓</span>🍽️ Hot lunch · £4</div><div style="margin-top:2px"><span class="btn" id="C">＋ Add an add-on</span></div></div>` },
  { stage: "Extras & team", label: "Staff", line: "Add the staff who'll be running the sessions.", click: "C",
    body: `<div class="frm"><div class="fl">Staff on this listing</div><div class="chk"><span class="chkbx">✓</span>👤 Alex Turner · Lead</div><div style="margin-top:2px"><span class="btn" id="C">＋ Assign staff</span></div></div>` },
  { stage: "Publish", label: "Preview", line: "Here's the best bit — the preview shows your listing exactly as parents will see it. Let's scroll through: your big photo up top, the venue, dates and ages, how many spaces, your passes and prices, the early-bird discount, and the booking panel where they pick their dates and pass. If it looks good here, it'll look good to them.", scroll: true,
    body: `<div class="fl">Preview — the parent booking page</div><div class="ppwrap"><div class="ppscroll" id="pvscroll"><div id="pvinner">
      <div class="pphero">⚽🤸🎨<div class="ppht">Summer Multi-Activity Camp</div></div>
      <div class="pprow"><span>📍 Riverside Sports Hall</span><span>📅 28 Jul – 8 Aug</span><span>👧 Ages 5–12</span></div>
      <div class="ppcols"><div><div class="ppl">Spaces</div><div class="ppbig">Up to 60</div></div>
        <div><div class="ppl">Passes</div><div class="pppass">5 day pass <b>£500</b></div><div class="pppass">1 day pass <b>£100</b></div></div>
        <div><div class="ppl">Discounts</div><div class="ppdisc">🐤 Early bird · £10 off</div></div></div>
      <div class="ppcta"><div>CHOOSE DATES &amp; TIMES <span>from £500</span></div><div class="ppcta2">👉 Tap a week to take the fixed 5-day block</div></div>
      <div class="ppl" style="padding:0 14px">Choose your pass</div><div class="ppbox">5 day pass · £500</div><div class="ppbox">1 day pass · £100</div>
      <div class="ppl" style="padding:12px 14px 0">About this camp</div><div class="pptxt">A fun-packed week of sports, games and crafts — something for everyone. Ages 5 to 12.</div>
      <div class="ppl" style="padding:0 14px">What's provided</div><div class="pptxt">🍽️ Hot lunch · 🎒 all equipment · 🍎 snacks &amp; drinks</div>
      <div class="ppl" style="padding:0 14px">Safety &amp; SEND</div><div class="pptxt">🛡️ DBS-checked staff · 🚑 first aid on site · 🤫 quiet space · 🎓 SEND-trained staff</div></div></div></div>` },
  { stage: "Publish", label: "Policy & publish", line: "Last of all, set your booking policy, and hit Publish. That's it — your listing's live and ready for bookings!",
    body: `<div class="frm"><div><div class="fl">Booking policy</div><div class="field">Full refund up to 7 days before</div></div><div class="hint">All set — press Publish to go live.</div></div>` },
];

const CSS = `
.lt-root{--navy:#16306e;--blue:#2f6bd8;--blue2:#4f8bf5;--teal:#0ea5a5;--green:#0e9a5a;--ink:#12203c;--ink2:#3a4a68;--muted:#5b6b86;--faint:#9aa6bd;--line:#e6ebf5;--panel:#f4f7fc;--surface:#fff;--brandink:#1d3a8f;color:var(--ink)}
.lt-root .lt-stage{position:relative;background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:16px;box-shadow:0 24px 50px -36px rgba(20,48,110,.5);min-height:330px;overflow:hidden}
.lt-root .appear{animation:ltrise .4s ease both}@keyframes ltrise{from{opacity:0;transform:translateY(9px)}to{opacity:1;transform:none}}
.lt-root .field{border:1px solid var(--line);background:var(--surface);border-radius:9px;padding:8px 10px;font-size:12.5px;color:var(--ink);font-weight:600;min-height:34px}.lt-root .field.ph{color:var(--faint);font-weight:500}.lt-root .field.focus{border-color:var(--navy);box-shadow:0 0 0 3px rgba(22,48,110,.12)}
.lt-root .caret{display:inline-block;width:1.5px;height:14px;background:var(--navy);margin-left:1px;vertical-align:-2px;animation:ltblink 1s step-end infinite}@keyframes ltblink{50%{opacity:0}}
.lt-root .row2{display:flex;gap:10px}.lt-root .row2>div{flex:1}
.lt-root .btn{border-radius:999px;padding:8px 15px;font-size:12.5px;font-weight:800;border:1px solid var(--line);background:var(--surface);color:var(--ink2);display:inline-block}.lt-root .btn.amber{background:linear-gradient(180deg,#f7c65a,#f0a92f);border-color:transparent;color:#5b3d05}.lt-root .btn.ghost{color:var(--faint)}
.lt-root .wcard{border:1px solid var(--line);border-radius:16px;overflow:hidden}
.lt-root .whead{display:flex;align-items:flex-start;gap:10px;padding:12px 15px;background:#f4f8ff;border-bottom:1px solid var(--line)}
.lt-root .wstage{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:var(--blue)}.lt-root .wtitle{font-size:16px;font-weight:800;color:var(--navy);margin-top:1px}
.lt-root .wstep{margin-left:auto;font-size:11px;font-weight:800;color:var(--faint);white-space:nowrap;padding-top:2px}
.lt-root .wbar{height:4px;background:var(--line)}.lt-root .wbar span{display:block;height:100%;background:linear-gradient(90deg,var(--blue2),var(--blue));transition:width .5s}
.lt-root .wbody{padding:15px;min-height:150px}
.lt-root .wfoot{display:flex;justify-content:space-between;padding:12px 15px;border-top:1px solid var(--line);background:#fbfdff}
.lt-root .frm{display:flex;flex-direction:column;gap:11px}
.lt-root .fl{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;color:var(--faint);margin-bottom:4px}
.lt-root .hint{font-size:11.5px;color:var(--muted);line-height:1.5}
.lt-root .chk{display:flex;align-items:center;gap:9px;border:1px solid var(--line);border-radius:10px;padding:8px 11px;font-size:12.5px;font-weight:700;margin-bottom:6px}
.lt-root .chk .chkbx{width:18px;height:18px;border-radius:5px;border:1.5px solid var(--line);display:grid;place-items:center;font-size:11px;color:#fff;flex:none}
.lt-root .chk.on{background:#eef8ff;border-color:#bcd0f5}.lt-root .chk.on .chkbx{background:var(--blue);border-color:transparent}
.lt-root .imgrow{display:flex;gap:8px}.lt-root .imgph{flex:1;height:54px;border-radius:9px;background:linear-gradient(135deg,#eef2fb,#dbe6fb);display:grid;place-items:center;font-size:18px;color:#9fb4dd;border:1px solid var(--line)}
.lt-root .daychip{display:inline-block;border:1px solid var(--line);border-radius:999px;padding:4px 11px;font-size:11.5px;font-weight:800;color:var(--ink2);margin-right:5px}.lt-root .daychip.on{background:var(--navy);color:#fff;border-color:transparent}
.lt-root .tabs{display:flex;gap:4px;border-bottom:1px solid var(--line);padding-bottom:8px}.lt-root .tab{font-size:13px;font-weight:800;color:var(--faint);padding:4px 9px}.lt-root .tab.on{color:var(--navy);border-bottom:2px solid var(--navy)}
.lt-root .chip2{display:inline-block;font-size:10.5px;font-weight:800;background:#eef4fd;color:var(--brandink);border-radius:999px;padding:3px 9px;margin:0 5px 5px 0}
.lt-root .prevcard{border:1px solid var(--line);border-radius:12px;overflow:hidden;box-shadow:0 12px 30px -22px rgba(20,48,110,.5);max-width:320px}
.lt-root .prevcard .ph{height:78px;background:linear-gradient(135deg,#2f6bd8,#3fd0c9);display:grid;place-items:center;font-size:26px}
.lt-root .prevcard .pb{padding:10px 12px}.lt-root .prevcard .pt{font-size:13px;font-weight:800}.lt-root .prevcard .pm{font-size:11px;color:var(--faint);margin-top:2px}.lt-root .prevcard .pp{font-size:13px;font-weight:800;color:var(--green);margin-top:6px}
.lt-root .lt-cursor{position:absolute;left:0;top:0;z-index:20;pointer-events:none;transition:transform .55s cubic-bezier(.5,.05,.25,1);filter:drop-shadow(0 3px 4px rgba(20,48,110,.35))}.lt-root .lt-cursor.down{transition:transform .1s}
.lt-root .lt-cursor .ring{position:absolute;left:-9px;top:-9px;width:34px;height:34px;border-radius:50%;border:2px solid var(--blue);opacity:0}.lt-root .lt-cursor.click .ring{animation:ltclk .4s ease-out}@keyframes ltclk{0%{opacity:.7;transform:scale(.3)}100%{opacity:0;transform:scale(1)}}
.lt-root .lt-cap{margin-top:12px;background:var(--surface);border:1px solid var(--line);border-left:4px solid var(--teal);border-radius:12px;padding:11px 13px;font-size:12.5px;line-height:1.55;color:var(--ink2);min-height:42px}.lt-root .lt-cap b{color:var(--ink)}
.lt-root .lt-controls{margin:0 0 12px;display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.lt-root .cbtn{border:1px solid var(--line);background:var(--surface);border-radius:11px;padding:11px 20px;font-size:14px;font-weight:800;color:var(--ink);cursor:pointer}.lt-root .cbtn:hover{border-color:#bcd0f5;background:#f4f8ff}.lt-root .cbtn.on{background:linear-gradient(180deg,#4f8bf5,#2f6bd8);border-color:transparent;color:#fff}
.lt-root .lt-count{font-size:11.5px;color:var(--faint);font-weight:700;margin-right:auto}
.lt-root .lnk{font-size:11.5px;font-weight:800;color:var(--brandink);background:#eef4fd;border:1px solid #cfe0fb;border-radius:999px;padding:5px 11px;cursor:pointer;display:inline-block}.lt-root .lnk:hover{background:#e2ecfc}
.lt-root .lay{display:flex;gap:6px;flex-wrap:wrap}.lt-root .layopt{font-size:11px;font-weight:800;border:1px solid var(--line);border-radius:9px;padding:6px 9px;color:var(--ink2)}.lt-root .layopt.on{border-color:#bcd0f5;background:#eef4ff;color:var(--brandink)}
.lt-root .chips{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.lt-root .ochip{font-size:11.5px;font-weight:800;background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:5px 10px}
.lt-root .capgrp{display:flex;align-items:center;gap:8px;font-size:12px;padding:6px 0;border-top:1px dashed var(--line)}.lt-root .capgrp .g{color:var(--faint);font-weight:600}.lt-root .capgrp .field2{margin-left:auto;border:1px solid var(--line);border-radius:8px;padding:4px 10px;font-size:11px;color:var(--faint);background:var(--surface)}
.lt-root .dot{width:9px;height:9px;border-radius:50%;flex:none}
.lt-root .tabs2{display:flex;gap:4px;border-bottom:1px solid var(--line);margin-bottom:10px}.lt-root .tab2{font-size:12px;font-weight:800;color:var(--faint);padding:5px 9px;cursor:pointer}.lt-root .tab2.on{color:var(--navy);border-bottom:2px solid var(--navy)}
.lt-root .wkcard{border:1px solid var(--line);border-radius:10px;overflow:hidden;margin-bottom:7px}.lt-root .wkhd{font-size:11.5px;font-weight:800;color:#fff;padding:5px 10px}.lt-root .wkdays{display:flex;flex-wrap:wrap;gap:6px;padding:8px}
.lt-root .dchip{border:1px solid #2f6bd8;color:#2f6bd8;background:#fff;border-radius:8px;padding:4px 9px;font-size:11px;font-weight:800}.lt-root .dchip.off{border-color:var(--line);color:var(--faint);text-decoration:line-through}
.lt-root .selrow{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:800;background:#eef4fd;border:1px solid #cfe0fb;border-radius:10px;padding:8px 11px}.lt-root .pill2{margin-left:auto;font-size:10.5px;font-weight:800;color:#127a3e;background:#d8f3e1;border-radius:999px;padding:2px 9px}
.lt-root .tkt{border:1px solid var(--line);border-left:3px solid var(--blue);border-radius:10px;padding:9px 11px;margin-bottom:7px}.lt-root .tkhd{display:flex;align-items:center;gap:8px;font-size:13px}.lt-root .tkp{margin-left:auto;font-weight:800}.lt-root .mini{font-size:10.5px;font-weight:800;border:1px solid var(--line);border-radius:999px;padding:2px 8px;color:var(--ink2)}
.lt-root .tkrow{display:flex;gap:8px;margin-top:6px}.lt-root .mini2{font-size:10.5px;font-weight:700;color:var(--faint);border:1px solid var(--line);border-radius:8px;padding:4px 8px}
.lt-root .rchip{font-size:11.5px;font-weight:800;border:1px solid var(--line);border-radius:9px;padding:6px 10px;color:var(--ink2)}.lt-root .rchip.on{border-color:#bcd0f5;background:#eef4ff;color:var(--brandink)}
.lt-root .g{color:var(--faint);font-weight:600}
.lt-root .hero{position:relative;height:74px;border-radius:10px;background:linear-gradient(120deg,#1b3f8f,#2f6bd8 55%,#0ea5a5);display:flex;align-items:center;justify-content:center;overflow:hidden}.lt-root .heroem{font-size:30px;letter-spacing:4px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.25))}.lt-root .herocap{position:absolute;left:10px;bottom:7px;color:#fff;font-size:12px;font-weight:800;text-shadow:0 1px 3px rgba(0,0,0,.4)}
.lt-root .dtypes{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}@media(max-width:560px){.lt-root .dtypes{grid-template-columns:1fr}}
.lt-root .dtype{border:1px solid var(--line);border-radius:10px;padding:9px 10px;font-size:12.5px}.lt-root .dtype.on{border-color:#2f6bd8;background:#eef4ff;box-shadow:0 0 0 2px rgba(47,107,216,.15)}.lt-root .dtype .ds{font-size:10.5px;color:var(--faint);font-weight:600;margin-top:3px;line-height:1.4}
.lt-root .ppwrap{border:1px solid #1a2340;border-radius:12px;overflow:hidden}.lt-root .ppscroll{height:250px;overflow:hidden;background:#0b1020}.lt-root #pvinner{will-change:transform;transition:transform .1s linear}
.lt-root .pphero{background:linear-gradient(120deg,#1b3f8f,#2f6bd8 60%,#0ea5a5);color:#fff;font-size:26px;letter-spacing:3px;padding:22px 14px 26px}.lt-root .ppht{font-size:16px;font-weight:800;letter-spacing:0;margin-top:6px}
.lt-root .pprow{display:flex;gap:14px;flex-wrap:wrap;background:#0f1630;color:#cdd6f0;font-size:11px;font-weight:800;padding:9px 14px;border-bottom:2px solid #b6ff3a}
.lt-root .ppcols{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;padding:12px 14px}
.lt-root .ppl{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#7f8bb5;margin-bottom:5px}
.lt-root .ppbig{font-size:17px;font-weight:800;font-style:italic;color:#fff}
.lt-root .pppass{font-size:12px;color:#dfe6ff;border-left:2px solid #b6ff3a;padding-left:8px;margin-bottom:5px}.lt-root .pppass b{color:#b6ff3a}
.lt-root .ppdisc{font-size:12px;color:#dfe6ff}
.lt-root .ppcta{margin:8px 14px;background:linear-gradient(120deg,#2f6bd8,#1b3f8f);border-radius:12px;padding:12px;color:#fff;font-size:14px;font-weight:800;font-style:italic}.lt-root .ppcta span{font-size:11px;opacity:.85}.lt-root .ppcta2{margin-top:8px;background:rgba(255,255,255,.12);border-radius:8px;padding:8px;font-size:12px;font-style:normal;font-weight:700}
.lt-root .ppbox{margin:6px 14px;background:#0f1630;border:1px solid #1a2340;border-radius:10px;padding:10px 12px;color:#dfe6ff;font-size:12.5px;font-weight:700}
.lt-root .pptxt{padding:2px 14px 10px;color:#aeb8dc;font-size:12px;line-height:1.5}
.lt-root .lt-splash{position:absolute;inset:0;z-index:30;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:radial-gradient(130% 120% at 50% 0%,#1b3f8f,#0b1020 75%);transition:opacity .5s ease;overflow:hidden}
.lt-root .lt-splash.hide{opacity:0;pointer-events:none}
.lt-root .lt-splash::before{content:"";position:absolute;top:0;left:-70%;width:55%;height:100%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.28),transparent);transform:skewX(-18deg);animation:ltshine 2s ease-in-out .2s}
@keyframes ltshine{0%{left:-70%}100%{left:130%}}
.lt-root .splmark{font-size:28px;color:#7fd0ff;animation:ltspin 3s linear infinite;text-shadow:0 0 18px rgba(80,170,255,.7)}
@keyframes ltspin{to{transform:rotate(360deg)}}
.lt-root .splogo{font-size:38px;font-weight:900;letter-spacing:-1px;background:linear-gradient(90deg,#7fd0ff,#ffffff 45%,#7fd0ff);-webkit-background-clip:text;background-clip:text;color:transparent;animation:ltsppop .6s ease both;filter:drop-shadow(0 2px 10px rgba(80,170,255,.4))}
.lt-root .sptitle{font-size:17px;font-weight:800;color:#e6f0ff;animation:ltsppop .6s ease .1s both}
.lt-root .spsub{font-size:11.5px;font-weight:700;color:#9fb4dd;animation:ltsppop .6s ease .2s both}
@keyframes ltsppop{from{opacity:0;transform:translateY(8px) scale(.96)}to{opacity:1;transform:none}}
`;

export function ListingTour({ onTab }: { onTab?: (t: string) => void } = {}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const onTabRef = useRef(onTab);
  onTabRef.current = onTab;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const stage = root.querySelector(".lt-stage") as HTMLElement;
    const content = root.querySelector(".lt-content") as HTMLElement;
    const cursor = root.querySelector(".lt-cursor") as HTMLElement;
    const capEl = root.querySelector(".lt-cap") as HTMLElement;
    const replayBtn = root.querySelector(".lt-replay") as HTMLElement;
    const soundBtn = root.querySelector(".lt-sound") as HTMLElement;
    const voiceSel = root.querySelector(".lt-voice") as HTMLSelectElement | null;
    const pauseBtn = root.querySelector(".lt-pause") as HTMLElement;
    const backBtn = root.querySelector(".lt-back") as HTMLElement;
    const fwdBtn = root.querySelector(".lt-fwd") as HTMLElement;
    const splash = root.querySelector(".lt-splash") as HTMLElement | null;
    const setupHref = typeof window !== "undefined" ? window.location.pathname.replace(/\/[^/]*$/, "/setup") : "/freelancer/setup";
    const hasSpeech = typeof window !== "undefined" && "speechSynthesis" in window;

    let token = 0, dead = false, soundOn = false, paused = false, currentIdx = -1;
    const waiters: (() => void)[] = [];
    let voice: SpeechSynthesisVoice | null = null;
    let speaking: Promise<unknown> = Promise.resolve();
    const gate = () => (paused ? new Promise<void>((r) => waiters.push(r)) : Promise.resolve());
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms)).then(gate);
    const strip = (h: string) => h.replace(/<[^>]+>/g, "").replace(/[—–]/g, ", ").replace(/\s+/g, " ").trim();
    const readMs = (t: string) => Math.max(2400, t.split(/\s+/).length * 330);
    const pick = (id: string) => content.querySelector("#" + id) as HTMLElement | null;

    function pickVoice(): SpeechSynthesisVoice | null {
      if (!hasSpeech) return null;
      const vs = window.speechSynthesis.getVoices(); if (!vs.length) return null;
      const pref = ["Google UK English Female", "Microsoft Sonia", "Serena", "Kate", "Fiona", "Samantha"];
      for (const n of pref) { const v = vs.find((x) => x.name === n) || vs.find((x) => x.name.includes(n)); if (v) return v; }
      return vs.find((v) => /en-GB/i.test(v.lang)) || vs.find((v) => /^en/i.test(v.lang)) || vs[0];
    }
    function fillVoices(): boolean {
      if (!voiceSel || !hasSpeech) return false;
      const vs = window.speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang)); if (!vs.length) return false;
      const cur = voiceSel.value;
      voiceSel.innerHTML = vs.map((v) => `<option value="${v.name}">${v.name} (${v.lang})</option>`).join("");
      voiceSel.value = cur || (voice ? voice.name : "");
      return true;
    }
    function speak(t: string) {
      if (!soundOn || !hasSpeech || !t) { speaking = Promise.resolve(); return; }
      const s = window.speechSynthesis; s.cancel();
      const u = new SpeechSynthesisUtterance(t);
      if (voice) { u.voice = voice; u.lang = voice.lang; }
      u.rate = 1.0; u.pitch = 1.05;
      speaking = Promise.race([new Promise((res) => { u.onend = res; u.onerror = res; }), sleep(22000)]);
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
      for (let i = 1; i <= text.length; i++) { if (tk !== token || dead) return; e.innerHTML = text.slice(0, i) + '<span class="caret"></span>'; await sleep(38); }
    }
    const frame = (i: number) => {
      const s = STEPS[i], pct = Math.round((i + 1) / STEPS.length * 100);
      return `<div class="wcard"><div class="whead"><div><div class="wstage">${s.stage}</div><div class="wtitle">${s.label}</div></div><div class="wstep">Step ${i + 1} of ${STEPS.length}</div></div>
        <div class="wbar"><span style="width:${pct}%"></span></div>
        <div class="wbody">${s.body}</div>
        <div class="wfoot"><span class="btn ghost">← Back</span><span class="btn amber" id="next">${i === STEPS.length - 1 ? "Publish ✓" : "Next →"}</span></div></div>`;
    };
    const introView = `<div class="appear"><div class="tabs"><span class="tab">Listings</span><span class="tab on">Categories</span><span class="tab">Locations</span></div>
      <div class="hint" style="margin-top:12px;font-size:12px">Three quick set-ups live in their own tabs: your <b>Categories</b> (like “Holiday Camp”), your <b>Locations</b> (your venues), and your <b>Seasons</b> (your holiday and term date ranges). Set them once, and reuse them on every listing.</div>
      <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"><span class="lnk" id="lnkCat">🏷️ Set up categories →</span><span class="lnk" id="lnkLoc">📍 Set up locations →</span><span class="lnk" id="lnkSea">🗓️ Add a season →</span></div>
      <div style="margin-top:14px"><span class="btn amber" id="newListing">＋ New listing</span></div></div>`;
    const doneView = `<div class="appear" style="text-align:center;padding:8px 0"><div style="font-size:34px">🎉</div>
      <div style="font-size:16px;font-weight:800;margin-top:6px">Your listing is live!</div>
      <div style="font-size:12px;color:var(--muted);margin-top:3px">Summer Multi-Activity Camp · ready to take bookings</div>
      <div class="prevcard" style="margin:14px auto 0;text-align:left"><div class="ph">🤸</div><div class="pb"><div class="pt">Summer Multi-Activity Camp</div><div class="pm">📍 Riverside Sports Hall · Ages 5–12</div><div class="pp">From £150 / week</div></div></div></div>`;

    async function run(startIdx = 0) {
      const tk = ++token; const alive = () => tk === token && !dead;
      if (hasSpeech) window.speechSynthesis.cancel();
      paused = false; waiters.splice(0).forEach((f) => f()); if (pauseBtn) pauseBtn.textContent = "⏸ Pause";
      cursor.style.transform = "translate(24px,20px) scale(1)";
      if (startIdx <= 0) {
        if (splash) { splash.style.display = "flex"; splash.classList.remove("hide"); void splash.offsetWidth; await sleep(2300); if (!alive()) return; splash.classList.add("hide"); await sleep(500); splash.style.display = "none"; }
        currentIdx = -1; content.innerHTML = introView;
        const lc = pick("lnkCat"); if (lc) lc.onclick = () => onTabRef.current?.("categories");
        const ll = pick("lnkLoc"); if (ll) ll.onclick = () => onTabRef.current?.("locations");
        const lse = pick("lnkSea"); if (lse) lse.onclick = () => { window.location.href = setupHref; };
        await line("Let's create a listing — that's a camp, class or club parents can book. First though, three quick set-ups live in their own tabs: your <b>Categories</b>, your <b>Locations</b> — that's your venues — and your <b>Seasons</b>, your holiday and term dates. There are links right here to jump straight to each. Set them up once and reuse them everywhere. Then hit <b>New listing</b>."); if (!alive()) return;
        await move("newListing"); await click(); if (!alive()) return;
      } else if (splash) { splash.style.display = "none"; }
      for (let i = Math.max(0, startIdx); i < STEPS.length; i++) {
        currentIdx = i; const s = STEPS[i]; content.innerHTML = frame(i);
        const act = (async () => {
          if (s.type) { const arr = Array.isArray(s.type) ? s.type : [s.type]; for (const t of arr) { await move(t.id, 0.2); await type(t.id, t.text, tk); await sleep(150); } }
          else if (s.click) { await move(s.click); await click(); const c = pick(s.click); if (c) { if (c.classList.contains("chk")) { c.classList.add("on"); const b = c.querySelector(".chkbx"); if (b) b.textContent = "✓"; } else if (c.classList.contains("daychip")) c.classList.add("on"); else if (c.classList.contains("dchip")) c.classList.add("off"); else if (c.classList.contains("dtype")) { c.parentElement?.querySelectorAll(".dtype").forEach((x) => x.classList.remove("on")); c.classList.add("on"); } else if (c.classList.contains("rchip")) { c.parentElement?.querySelectorAll(".rchip").forEach((x) => x.classList.remove("on")); c.classList.add("on"); const rn = pick("rnote"); const nt = (c as HTMLElement).dataset.note; if (rn && nt) rn.textContent = nt; } else if (c.classList.contains("tab2")) { c.parentElement?.querySelectorAll(".tab2").forEach((x) => x.classList.remove("on")); c.classList.add("on"); const tc = pick("tabc"); if (tc && s.tabHtml) tc.innerHTML = s.tabHtml; } } await sleep(300); }
          else if (s.scroll) { const sc = pick("pvinner"), box = pick("pvscroll"); if (sc && box) { const max = Math.max(0, sc.offsetHeight - box.clientHeight); const steps = 46; for (let k = 1; k <= steps; k++) { await sleep(120); sc.style.transform = "translateY(" + (-Math.round(max * (k / steps))) + "px)"; } } }
          else await sleep(600);
          await move("next"); await click();
        })();
        await line(s.line); await act; if (!alive()) return;
      }
      currentIdx = STEPS.length; content.innerHTML = doneView;
      if (!alive()) return; await line("That's it — your listing is ready!");
    }

    let voicePoll = 0;
    const pollIv = hasSpeech ? window.setInterval(() => { if (fillVoices() || ++voicePoll > 24) window.clearInterval(pollIv); }, 250) : 0;
    if (hasSpeech) { voice = pickVoice(); window.speechSynthesis.onvoiceschanged = () => { voice = pickVoice(); fillVoices(); }; }
    if (voiceSel) {
      voiceSel.onmousedown = () => { fillVoices(); };
      voiceSel.onchange = () => { voice = window.speechSynthesis.getVoices().find((v) => v.name === voiceSel.value) || voice; if (!soundOn) setSound(true); if (hasSpeech) window.speechSynthesis.cancel(); speak(strip(capEl.innerHTML)); };
    }
    // Turning sound on hides the on-screen caption (the voice replaces it).
    const setSound = (on: boolean) => { soundOn = on; soundBtn.classList.toggle("on", on); soundBtn.textContent = on ? "🔊 Sound on" : "🔊 Sound"; capEl.style.display = on ? "none" : ""; };
    replayBtn.onclick = () => { run(0); };
    if (backBtn) backBtn.onclick = () => { run(currentIdx - 1); };
    if (fwdBtn) fwdBtn.onclick = () => { run(currentIdx + 1); };
    soundBtn.onclick = () => { fillVoices(); setSound(!soundOn); if (hasSpeech) window.speechSynthesis.cancel(); if (soundOn) run(currentIdx < 0 ? 0 : currentIdx); };
    if (pauseBtn) pauseBtn.onclick = () => { paused = !paused; pauseBtn.textContent = paused ? "▶ Resume" : "⏸ Pause"; if (hasSpeech) { if (paused) window.speechSynthesis.pause(); else window.speechSynthesis.resume(); } if (!paused) waiters.splice(0).forEach((f) => f()); };
    run();

    return () => { dead = true; token++; window.clearInterval(pollIv); if (hasSpeech) { window.speechSynthesis.cancel(); window.speechSynthesis.onvoiceschanged = null; } };
  }, []);

  return (
    <div className="lt-root" ref={rootRef}>
      <style>{CSS}</style>
      <div className="lt-controls">
        <span className="lt-count" />
        <button type="button" className="cbtn lt-back" title="Back a step">⏮</button>
        <button type="button" className="cbtn lt-replay">▶ Play</button>
        <button type="button" className="cbtn lt-pause">⏸ Pause</button>
        <button type="button" className="cbtn lt-fwd" title="Skip forward">⏭</button>
        <button type="button" className="cbtn lt-sound">🔊 Sound</button>
        <select className="cbtn lt-voice" title="Pick a voice" style={{ maxWidth: 200 }} />
      </div>
      <div className="lt-stage">
        <div className="lt-cursor down"><span className="ring" /><svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 2 L4 19 L8.5 14.5 L11.5 21.5 L14 20.5 L11 13.8 L18 13.8 Z" fill="#12203c" stroke="#fff" strokeWidth="1.3" strokeLinejoin="round" /></svg></div>
        <div className="lt-content" />
        <div className="lt-splash"><div className="splmark">◈</div><div className="splogo">ActivityOS</div><div className="sptitle">Create a listing</div><div className="spsub">a quick guided walkthrough</div></div>
      </div>
      <div className="lt-cap" />
    </div>
  );
}
