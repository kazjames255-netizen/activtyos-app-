import { THEME } from "../theme";

const P = THEME.palette;
/** All the game's screen CSS, in one string, tokens from the theme (nothing hard-coded to a world). Logical properties throughout: RTL-safe. */
export const CSS = `
.ps-root{--ps-navy:${P.navy};--ps-royal:${P.royal};--ps-violet:${P.violet};--ps-gold:${P.gold};--ps-gold-soft:${P.goldSoft};--ps-cyan:${P.cyan};--ps-ice:${P.ice1};--ps-ink:${P.ink};--ps-snow:#fff;
  position:relative;width:100%;height:100%;min-height:420px;overflow:hidden;background:${P.skyTop};color:#fff;font-family:var(--ff,system-ui,sans-serif);user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;touch-action:none;outline:none}
.ps-root *{box-sizing:border-box}
.ps-canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.ps-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.ps-layer{position:absolute;inset:0;pointer-events:none}
.ps-top{position:absolute;inset-inline:0;top:0;padding:max(10px,env(safe-area-inset-top)) 12px 0;display:flex;align-items:flex-start;justify-content:space-between;gap:8px;pointer-events:none}
.ps-btn{pointer-events:auto;appearance:none;border:0;cursor:pointer;font:inherit;color:#fff;background:rgba(14,22,74,.62);backdrop-filter:blur(6px);border:1.5px solid rgba(255,255,255,.28);border-radius:14px;min-width:48px;min-height:48px;padding:0 14px;display:inline-flex;align-items:center;justify-content:center;gap:8px;font-weight:700;transition:transform .12s,background .12s}
.ps-btn:hover{background:rgba(27,35,110,.8)}.ps-btn:active{transform:scale(.96)}
.ps-btn:focus-visible,.ps-pad:focus-visible,.ps-chip:focus-visible{outline:3px solid var(--ps-gold);outline-offset:2px}
.ps-btn[aria-pressed=true]{background:rgba(255,206,74,.22);border-color:var(--ps-gold)}
.ps-big{min-height:76px;padding:0 44px;border-radius:24px;font-size:28px;font-family:var(--ff-display,inherit);font-weight:800;color:var(--ps-ink);background:linear-gradient(180deg,#ffe58a,var(--ps-gold));border:0;box-shadow:0 6px 0 #c8901a,0 14px 30px rgba(255,206,74,.35)}
.ps-big:hover{background:linear-gradient(180deg,#fff0b3,#ffd863)}.ps-big:active{transform:translateY(3px);box-shadow:0 3px 0 #c8901a}
.ps-pill{position:absolute;inset-inline:0;margin-inline:auto;width:max-content;max-width:calc(100% - 200px);top:max(10px,env(safe-area-inset-top));text-align:center;pointer-events:none}
.ps-q{display:inline-flex;align-items:center;gap:10px;padding:8px 22px;border-radius:22px;background:rgba(255,255,255,.96);color:var(--ps-ink);font-family:var(--ff-display,inherit);font-weight:800;font-size:clamp(28px,5.2vw,52px);line-height:1.1;border:3px solid var(--ps-royal);box-shadow:0 8px 24px rgba(6,10,50,.4);pointer-events:auto}
.ps-q.boss{border-color:var(--ps-gold);box-shadow:0 0 0 4px rgba(255,206,74,.35),0 8px 24px rgba(6,10,50,.4)}
.ps-q .ps-speak{appearance:none;border:0;background:rgba(59,87,214,.12);color:var(--ps-royal);width:44px;height:44px;border-radius:14px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}
.ps-q .ps-speak:focus-visible{outline:3px solid var(--ps-gold)}
.ps-dots{display:flex;gap:5px;flex-wrap:wrap;max-width:36vw;align-items:center;padding:6px 4px}
.ps-dot{width:9px;height:9px;border-radius:50%;background:rgba(255,255,255,.28);border:1.5px solid rgba(255,255,255,.5)}.ps-dot.on{background:var(--ps-gold);border-color:var(--ps-gold-soft)}.ps-dot.cur{background:#fff;border-color:#fff;transform:scale(1.25)}
.ps-rail{position:relative;width:min(34vw,260px);height:10px;border-radius:6px;background:rgba(255,255,255,.2);margin-top:6px;pointer-events:none}
.ps-rail i{position:absolute;top:50%;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;transition:inset-inline-start .25s}
.ps-rail .me{background:var(--ps-gold);border:2px solid #fff}.ps-rail .ghost{background:rgba(255,255,255,.45);border:2px dashed rgba(255,255,255,.85)}
.ps-stats{position:absolute;inset-inline-start:12px;top:calc(max(10px,env(safe-area-inset-top)) + 70px);display:flex;flex-direction:column;gap:8px;pointer-events:none}
.ps-chip2{display:inline-flex;align-items:center;gap:8px;background:rgba(14,22,74,.62);border:1.5px solid rgba(255,255,255,.25);border-radius:14px;padding:6px 12px;font-weight:800;font-size:18px;width:max-content}
.ps-chip2 b{color:var(--ps-gold)}
.ps-pads{direction:ltr;position:absolute;inset-inline:0;bottom:0;padding:0 10px max(10px,env(safe-area-inset-bottom));display:grid;gap:10px;pointer-events:none}
.ps-pad{pointer-events:auto;appearance:none;border:0;cursor:pointer;min-height:52px;border-radius:16px;font-family:var(--ff-display,inherit);font-weight:800;font-size:clamp(22px,4.4vw,32px);opacity:.88;color:var(--ps-ink);background:linear-gradient(180deg,#fff,#d7efff);box-shadow:0 5px 0 #7fb2ee,0 10px 22px rgba(6,10,50,.28);position:relative;transition:transform .08s,box-shadow .08s,opacity .2s}
.ps-pad:active{transform:translateY(3px);box-shadow:0 2px 0 #7fb2ee}
.ps-pad kbd{position:absolute;inset-block-start:6px;inset-inline-start:10px;font:600 12px var(--ff,system-ui);color:#5670c0;opacity:.85}
.ps-pad[disabled]{opacity:.35;cursor:default}
.ps-pad.lock{box-shadow:0 5px 0 #c8901a,0 0 0 4px rgba(255,206,74,.6),0 10px 22px rgba(6,10,50,.28);background:linear-gradient(180deg,#fff8d8,#ffe58a)}
.ps-flop{pointer-events:auto;appearance:none;border:0;cursor:pointer;position:absolute;inset-inline-end:16px;bottom:max(18px,env(safe-area-inset-bottom));width:96px;height:96px;border-radius:50%;font:800 20px var(--ff-display,inherit);color:var(--ps-ink);background:radial-gradient(circle at 35% 30%,#fff3c2,var(--ps-gold));box-shadow:0 6px 0 #c8901a,0 14px 28px rgba(6,10,50,.4);transition:transform .08s,opacity .2s;touch-action:none}
.ps-flop:active{transform:translateY(4px);box-shadow:0 2px 0 #c8901a}.ps-flop.cool{opacity:.55}.ps-flop.air{background:radial-gradient(circle at 35% 30%,#fff,var(--ps-violet));color:#fff;box-shadow:0 6px 0 #5b3fc4,0 14px 28px rgba(6,10,50,.4)}
.ps-flop:focus-visible{outline:3px solid #fff;outline-offset:3px}
.ps-fact{position:absolute;inset-inline:0;bottom:calc(max(18px,env(safe-area-inset-bottom)) + 8px);margin-inline:auto;width:max-content;max-width:calc(100% - 140px);background:rgba(255,255,255,.97);color:var(--ps-ink);border:3px solid var(--ps-royal);border-radius:20px;padding:6px 20px;font:800 clamp(26px,5vw,44px)/1.15 var(--ff-display,inherit);box-shadow:0 10px 28px rgba(6,10,50,.4);pointer-events:none;animation:ps-pop .28s cubic-bezier(.22,1,.36,1)}
.ps-fb{position:absolute;inset-inline:0;top:19%;margin-inline:auto;width:max-content;max-width:min(92%,560px);text-align:center;pointer-events:none;animation:ps-pop .28s cubic-bezier(.22,1,.36,1)}
.ps-fb .card{background:rgba(255,255,255,.97);color:var(--ps-ink);border-radius:22px;padding:14px 26px;box-shadow:0 12px 34px rgba(6,10,50,.4);border:3px solid var(--ps-royal)}
.ps-fb.ok .card{border-color:var(--ps-gold);background:#fffbe8}
.ps-fb .fact{font:800 clamp(30px,6vw,54px)/1.1 var(--ff-display,inherit)}.ps-fb .msg{font-weight:700;font-size:clamp(15px,2.4vw,20px);color:#3b4a92;margin-top:4px}
.ps-coach{position:absolute;inset-inline:16px;top:96px;display:flex;justify-content:center;pointer-events:none}
.ps-coach .bubble{display:flex;gap:10px;align-items:center;background:rgba(255,255,255,.96);color:var(--ps-ink);border-radius:20px;padding:8px 18px 8px 8px;font-weight:700;font-size:clamp(15px,2.6vw,20px);box-shadow:0 8px 24px rgba(6,10,50,.35);max-width:520px}
.ps-power{display:flex;gap:6px}.ps-power span{background:rgba(255,255,255,.95);color:var(--ps-royal);border-radius:12px;padding:4px 10px;font-weight:800;font-size:14px;display:inline-flex;gap:6px;align-items:center}
.ps-over{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:16px;background:radial-gradient(ellipse at 50% 30%,rgba(20,30,110,.55),rgba(7,11,46,.86));z-index:5;overflow:auto;touch-action:pan-y}
.ps-card{width:min(680px,100%);margin:auto;background:linear-gradient(180deg,rgba(255,255,255,.98),rgba(233,243,255,.98));color:var(--ps-ink);border-radius:28px;padding:22px 22px 20px;box-shadow:0 24px 70px rgba(4,8,40,.6);border:3px solid rgba(255,255,255,.7)}
.ps-root svg{display:inline-block;vertical-align:-3px}
.ps-card h1,.ps-card h2{margin:0;font-family:var(--ff-display,inherit);font-weight:800;line-height:1.1;color:var(--ps-ink)}
.ps-card p{margin:6px 0 0}
.ps-title{font-size:clamp(34px,7vw,60px);background:linear-gradient(90deg,var(--ps-royal),var(--ps-violet));-webkit-background-clip:text;background-clip:text;color:transparent}
.ps-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:center;margin-top:14px}
.ps-chip{appearance:none;border:2px solid #b8cdf0;background:#fff;color:var(--ps-ink);border-radius:16px;min-height:48px;padding:0 16px;font:700 16px var(--ff,system-ui);cursor:pointer}
.ps-chip[aria-pressed=true]{background:var(--ps-royal);border-color:var(--ps-royal);color:#fff}
.ps-chip[disabled]{opacity:.4;cursor:default}
.ps-link{appearance:none;border:0;background:none;color:var(--ps-royal);font:700 15px var(--ff,system-ui);text-decoration:underline;cursor:pointer;min-height:44px;padding:0 8px}
.ps-demo{display:inline-block;background:#fff3c2;color:#6b4a00;border-radius:12px;padding:4px 10px;font-weight:700;font-size:13px}
.ps-help{color:#4a5a99;font-size:14px;margin-top:10px}
.ps-big-num{font:800 clamp(30px,6vw,46px)/1.05 var(--ff-display,inherit);color:var(--ps-royal)}
.ps-list{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:8px}.ps-list li{background:#eef5ff;border-radius:14px;padding:10px 14px;font-weight:600}
.ps-list li.gold{background:#fff6d6}
.ps-map{display:grid;gap:3px;margin-top:12px}
.ps-cell{aspect-ratio:1;border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;color:#1b2350}
.ps-t0{background:#dcecff}.ps-t1{background:#a9c8f6}.ps-t2{background:#ffe9a8}.ps-t3{background:#ffd25a}.ps-t4{background:#ffb300;box-shadow:0 0 0 2px #fff3c2 inset}
.ps-hdr{font-weight:800;font-size:12px;color:#5b6aa8;display:flex;align-items:center;justify-content:center}
.ps-range{width:120px;accent-color:var(--ps-royal)}
.ps-breath{width:120px;height:120px;border-radius:50%;background:radial-gradient(circle,#fff,#bfe6ff);margin:8px auto;animation:ps-breathe 8s ease-in-out infinite}
@keyframes ps-breathe{0%,100%{transform:scale(.7);opacity:.7}50%{transform:scale(1.1);opacity:1}}
@keyframes ps-pop{from{transform:translateY(10px) scale(.92);opacity:0}to{transform:none;opacity:1}}
.ps-fadein{animation:ps-pop .3s cubic-bezier(.22,1,.36,1)}
.ps-calm .ps-breath,.ps-still .ps-breath{animation:none;transform:scale(.9)}
.ps-calm .ps-fb,.ps-still .ps-fb,.ps-calm .ps-fact,.ps-still .ps-fact,.ps-calm .ps-fadein,.ps-still .ps-fadein{animation:none}
@media (prefers-reduced-motion:reduce){.ps-breath{animation:none;transform:scale(.9)}.ps-fb,.ps-fadein{animation:none}}
.ps-toast{position:absolute;inset-inline:0;margin-inline:auto;width:max-content;max-width:min(92%,520px);top:calc(max(10px,env(safe-area-inset-top)) + 96px);text-align:center;pointer-events:none;background:rgba(14,22,74,.86);color:#fff;border:2px solid var(--ps-gold);border-radius:16px;padding:8px 16px;font-weight:800;font-size:clamp(14px,2.4vw,18px);box-shadow:0 8px 24px rgba(6,10,50,.4);animation:ps-pop .25s cubic-bezier(.22,1,.36,1)}
.ps-x .ps-toast{border-radius:6px;background:rgba(9,14,46,.94)}
.ps-calm .ps-toast,.ps-still .ps-toast{animation:none}
.ps-pads{align-items:end}
.ps-pad.sel{min-height:80px;padding-top:22px;opacity:1;background:linear-gradient(180deg,#fff8d8,#ffe58a);box-shadow:0 5px 0 #c8901a,0 0 0 4px var(--ps-gold),0 0 0 9px rgba(255,206,74,.35),0 10px 22px rgba(6,10,50,.28);animation:ps-ring 1.1s ease-in-out infinite}
.ps-lockin{position:absolute;inset-block-start:5px;inset-inline:0;display:flex;justify-content:center;align-items:center;gap:6px;font:800 12px var(--ff,system-ui);color:#7a5200;text-transform:uppercase;letter-spacing:.06em}
.ps-lockin i{font-style:normal;display:inline-grid;place-items:center;width:18px;height:18px;border-radius:50%;background:#1b2350;color:#ffce4a;font-size:12px}
.ps-lockhint{position:absolute;inset-inline:0;bottom:calc(max(10px,env(safe-area-inset-bottom)) + 96px);padding-inline:12px;text-align:center;pointer-events:none;font-weight:800;color:#fff;text-shadow:0 1px 6px rgba(0,0,40,.8);font-size:clamp(14px,2.4vw,18px)}
@keyframes ps-ring{0%,100%{box-shadow:0 5px 0 #c8901a,0 0 0 4px var(--ps-gold),0 0 0 9px rgba(255,206,74,.35),0 10px 22px rgba(6,10,50,.28)}50%{box-shadow:0 5px 0 #c8901a,0 0 0 4px var(--ps-gold),0 0 0 14px rgba(255,206,74,.12),0 10px 22px rgba(6,10,50,.28)}}
.ps-calm .ps-pad.sel,.ps-still .ps-pad.sel{animation:none}
.ps-rise{transform-box:fill-box;transform-origin:50% 100%;animation:ps-rise 1.15s cubic-bezier(.2,1.35,.4,1) both}
@keyframes ps-rise{0%{transform:scale(.55,.02);opacity:0}25%{opacity:1}70%{transform:scale(1.05,1.1)}100%{transform:scale(1,1)}}
.ps-dust{transform-box:fill-box;transform-origin:center;animation:ps-dust 1.2s ease-out both}
@keyframes ps-dust{0%{transform:scale(.3);opacity:.9}100%{transform:translateY(-16px) scale(2.6);opacity:0}}
.ps-spark{transform-box:fill-box;transform-origin:center;animation:ps-spark 1.3s ease-out both;opacity:0}
@keyframes ps-spark{0%{transform:scale(.2) rotate(0);opacity:0}30%{opacity:1}100%{transform:scale(1.5) rotate(90deg) translateY(-14px);opacity:0}}
.ps-plotpulse{animation:ps-plot 1.1s ease-in-out infinite}
@keyframes ps-plot{0%,100%{opacity:.7}50%{opacity:1}}
.ps-wander{animation:ps-wander 8s ease-in-out infinite alternate}
@keyframes ps-wander{from{transform:translateX(-26px)}to{transform:translateX(26px)}}
.ps-smoke{animation:ps-smoke 3.2s ease-in-out infinite}.ps-steam{animation:ps-smoke 3.6s ease-in-out infinite}
@keyframes ps-smoke{0%,100%{transform:translateY(0);opacity:1}50%{transform:translateY(-6px);opacity:.6}}
.ps-beam{animation:ps-beam 5s ease-in-out infinite;transform-box:fill-box;transform-origin:0 50%}
@keyframes ps-beam{0%,100%{opacity:.5}50%{opacity:1}}
.ps-skate{animation:ps-skate 4s ease-in-out infinite alternate}
@keyframes ps-skate{from{transform:translateX(-22px)}to{transform:translateX(30px)}}
.ps-aurora{animation:ps-aur 14s ease-in-out infinite alternate}
@keyframes ps-aur{from{transform:translateX(-24px)}to{transform:translateX(24px)}}
.ps-drip{animation:ps-smoke 2s ease-in-out infinite}
.ps-still .ps-rise,.ps-still .ps-dust,.ps-still .ps-spark,.ps-still .ps-wander,.ps-still .ps-smoke,.ps-still .ps-steam,.ps-still .ps-beam,.ps-still .ps-skate,.ps-still .ps-aurora,.ps-still .ps-plotpulse,.ps-still .ps-drip,.ps-calm .ps-rise,.ps-calm .ps-dust,.ps-calm .ps-wander,.ps-calm .ps-skate,.ps-calm .ps-aurora{animation:none}
.ps-still .ps-dust,.ps-still .ps-spark{display:none}
@media (prefers-reduced-motion:reduce){.ps-rise,.ps-dust,.ps-spark,.ps-wander,.ps-smoke,.ps-steam,.ps-beam,.ps-skate,.ps-aurora,.ps-plotpulse,.ps-drip{animation:none}.ps-dust,.ps-spark{display:none}}
/* ── Explorer: the older-kids look. Same game, a different voice: dark instrument-panel cards, condensed capitals, square corners, flat shadows, amber accents, topographic lines instead of stickers. */
.ps-x{--ps-gold:#e8a53a;--ps-gold-soft:#f5d391;--ps-royal:#4a6499;--ps-violet:#7a86b8;--ps-ink:#e8eeff;--ff-display:"Barlow Condensed","Roboto Condensed","Arial Narrow","Helvetica Neue",system-ui,sans-serif}
.ps-x .ps-card{background:linear-gradient(180deg,#141c44,#0c1230);color:#e8eeff;border:1px solid #3d4f8f;border-radius:10px;box-shadow:0 18px 50px rgba(0,0,0,.65)}
.ps-x .ps-card h1,.ps-x .ps-card h2,.ps-x .ps-card h3{color:#f2f5ff;text-transform:uppercase;letter-spacing:.09em;font-weight:700}
.ps-x .ps-title{background:none;color:#f2f5ff;-webkit-text-fill-color:#f2f5ff;text-transform:uppercase;letter-spacing:.12em}
.ps-x .ps-big-num{color:var(--ps-gold);font-weight:700;letter-spacing:.03em}
.ps-x .ps-help{color:#9fb0e0}
.ps-x .ps-btn,.ps-x .ps-chip,.ps-x .ps-big,.ps-x .ps-pad,.ps-x .ps-flop{border-radius:6px}
.ps-x .ps-btn,.ps-x .ps-chip{text-transform:uppercase;letter-spacing:.08em;font-size:13px;font-family:var(--ff-display)}
.ps-x .ps-chip{background:#182252;border:1px solid #4a5ca8;color:#dfe7ff}
.ps-x .ps-chip[aria-pressed=true]{background:var(--ps-gold);border-color:var(--ps-gold);color:#0b1230}
.ps-x .ps-big{background:var(--ps-gold);color:#0b1230;box-shadow:0 4px 0 #8a5d16;text-transform:uppercase;letter-spacing:.1em;font-weight:700;border-radius:6px}
.ps-x .ps-big:hover{background:#f2b955}
.ps-x .ps-q{border-radius:8px;background:rgba(9,14,46,.94);color:#f2f5ff;border:2px solid var(--ps-gold);box-shadow:0 8px 24px rgba(0,0,0,.5);letter-spacing:.02em}
.ps-x .ps-q .ps-speak{background:rgba(255,255,255,.1);color:#dfe7ff;border-radius:6px}
.ps-x .ps-pad{background:#18225a;color:#f2f5ff;border:1px solid #5a6cc0;box-shadow:0 3px 0 #05081f,0 8px 18px rgba(0,0,0,.4);opacity:.94;letter-spacing:.02em}
.ps-x .ps-pad.sel{background:#3b2c0d;color:#ffe6ac;border-color:var(--ps-gold);box-shadow:0 3px 0 #05081f,0 0 0 3px var(--ps-gold),0 0 0 8px rgba(232,165,58,.3)}
.ps-x .ps-lockin{color:#ffd992}.ps-x .ps-lockin i{background:var(--ps-gold);color:#0b1230;border-radius:3px}
.ps-x .ps-chip2,.ps-x .ps-power span{border-radius:6px;background:rgba(9,14,46,.78);border-color:#3d4f8f;font-family:var(--ff-display);letter-spacing:.04em}
.ps-x .ps-power span{color:#f2f5ff}
.ps-x .ps-coach .bubble,.ps-x .ps-fact,.ps-x .ps-fb .card{background:rgba(9,14,46,.94);color:#f2f5ff;border-color:#4a5ca8;border-radius:8px}
.ps-x .ps-fact{border-color:var(--ps-gold)}
.ps-x .ps-list li{background:#182252;border-radius:6px}
.ps-x .ps-flop{background:#e8a53a;color:#0b1230;box-shadow:0 4px 0 #8a5d16;text-transform:uppercase;letter-spacing:.08em}
.ps-x .ps-demo{border-radius:6px}
.ps-x .ps-dot{border-radius:2px}
.ps-x .ps-breath{background:radial-gradient(circle,#2b3a80,#111a44)}
.ps-x .ps-cell{border-radius:2px}
.ps-x [data-testid=ps-map]{background-image:repeating-radial-gradient(circle at 20% 10%,rgba(160,180,255,.07) 0 2px,transparent 2px 26px),linear-gradient(180deg,rgba(6,9,30,.96),rgba(14,20,64,.9)) !important}
.ps-x [data-testid^=ps-biome-]{border-radius:8px !important;border-width:1px !important;box-shadow:none !important;background-blend-mode:multiply;filter:saturate(.7)}
.ps-x [data-testid^=ps-biome-] h2{text-transform:uppercase;letter-spacing:.1em}
.ps-x [data-testid^=ps-stage-]{border-radius:6px !important;border-width:2px !important;font-family:var(--ff-display);font-weight:700}
.ps-x [data-testid=ps-village]{background:linear-gradient(180deg,rgba(5,8,26,.97),rgba(16,24,70,.94)) !important}
.ps-x [data-testid=ps-village-scene]{filter:saturate(.6) brightness(.92)}
.ps-x [data-testid=ps-lookat]{background:#1a2456 !important;color:#e8eeff;border:1px solid #4a5ca8;border-radius:6px !important}
.ps-x .ps-list li.gold{background:#2a2410;color:#ffe6ac;border:1px solid #6b5520}
.ps-x .ps-card .ps-link{color:#9fb8ff}
.ps-x .ps-card input,.ps-x .ps-card select{background:#0c1230;color:#e8eeff;border-color:#4a5ca8}
@media (max-width:640px){.ps-toast{top:auto;bottom:calc(max(10px,env(safe-area-inset-bottom)) + 120px);max-width:calc(100% - 24px)}.ps-coach{top:calc(max(10px,env(safe-area-inset-top)) + 102px);inset-inline:10px}.ps-coach .bubble{font-size:14px;padding:6px 14px 6px 6px}.ps-top{padding-inline:8px}.ps-pill{top:calc(max(10px,env(safe-area-inset-top)) + 58px);max-width:calc(100% - 16px)}.ps-q{padding:6px 14px;font-size:clamp(26px,8vw,40px)}.ps-dots{max-width:46vw}.ps-rail{width:40vw}.ps-btn{min-width:44px;min-height:44px;padding:0 10px}.ps-stats{top:calc(max(10px,env(safe-area-inset-top)) + 184px)}.ps-big{padding:0 32px}.ps-card{padding:16px}}
`;
