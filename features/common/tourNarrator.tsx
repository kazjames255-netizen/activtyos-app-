// ─────────────────────────────────────────────────────────────────────────
// Shared "robot narrator" bookend scene for the guided tours — a classy dark
// screen with a female-styled robot that idles (bob + blink) and "talks" via
// an equalizer mouth. Used for the intro and done screens of GuidedTour AND the
// two bespoke tours (Blocks, Listings) so every walkthrough opens and closes
// the same premium way. Self-contained: the CSS is unscoped (tnr- prefix), so
// each host tour just appends NARRATOR_CSS to its own <style> and drops
// narratorScene(...) into its stage. The `margin:-16px` bleeds the host stage's
// 16px padding so the dark scene fills the frame.
// ─────────────────────────────────────────────────────────────────────────

const NARRATOR_BOT = `<div class="tnr-bot"><span class="halo"></span><svg class="bob" width="112" height="112" viewBox="0 0 112 112" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="tnrHead" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6faff"/><stop offset="1" stop-color="#c9dcff"/></linearGradient><radialGradient id="tnrEye" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#cbf3ff"/><stop offset="1" stop-color="#33b6ff"/></radialGradient></defs><line x1="56" y1="17" x2="56" y2="31" stroke="#8fb6ff" stroke-width="3" stroke-linecap="round"/><circle cx="56" cy="13" r="5" fill="#ff5aa8"/><circle cx="19" cy="63" r="11" fill="url(#tnrHead)" stroke="#a9c6ff" stroke-width="1.5"/><circle cx="93" cy="63" r="11" fill="url(#tnrHead)" stroke="#a9c6ff" stroke-width="1.5"/><circle cx="19" cy="63" r="4" fill="#7fd0ff"/><circle cx="93" cy="63" r="4" fill="#7fd0ff"/><rect x="26" y="30" width="60" height="60" rx="22" fill="url(#tnrHead)" stroke="#a9c6ff" stroke-width="1.5"/><rect x="33" y="45" width="46" height="27" rx="13.5" fill="#0e1e46"/><ellipse class="eye" cx="47" cy="58" rx="5" ry="6.2" fill="url(#tnrEye)"/><ellipse class="eye" cx="65" cy="58" rx="5" ry="6.2" fill="url(#tnrEye)"/><rect class="mbar b1" x="49.5" y="77" width="3" height="9" rx="1.5" fill="#7fd0ff"/><rect class="mbar b2" x="54.5" y="77" width="3" height="9" rx="1.5" fill="#7fd0ff"/><rect class="mbar b3" x="59.5" y="77" width="3" height="9" rx="1.5" fill="#7fd0ff"/></svg></div>`;

export const NARRATOR_CSS = `
.tnr-scene{position:relative;margin:-16px;min-height:352px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:15px;text-align:center;padding:34px 26px;background:radial-gradient(130% 120% at 50% 0%,#1b3f8f,#0b1020 78%);overflow:hidden;color:#eaf2ff}
.tnr-scene::before{content:"";position:absolute;top:-30%;left:-45%;width:60%;height:100%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.09),transparent);transform:skewX(-18deg);animation:tnrshine 5.5s ease-in-out infinite}
@keyframes tnrshine{0%{left:-45%}100%{left:130%}}
.tnr-bot{position:relative;width:118px;height:118px;display:grid;place-items:center}
.tnr-bot .halo{position:absolute;inset:-16px;border-radius:50%;background:radial-gradient(circle,rgba(90,190,255,.5),transparent 62%);animation:tnrpulse 2.4s ease-in-out infinite}
@keyframes tnrpulse{0%,100%{opacity:.5;transform:scale(.92)}50%{opacity:1;transform:scale(1.07)}}
.tnr-bot .bob{position:relative;animation:tnrbob 4s ease-in-out infinite}
@keyframes tnrbob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
.tnr-bot .eye{transform-box:fill-box;transform-origin:center;animation:tnrblink 5.2s infinite}
@keyframes tnrblink{0%,93%,100%{transform:scaleY(1)}96.5%{transform:scaleY(.12)}}
.tnr-bot .mbar{transform-box:fill-box;transform-origin:center;animation:tnrtalk .82s ease-in-out infinite}
.tnr-bot .mbar.b2{animation-duration:.6s;animation-delay:.09s}.tnr-bot .mbar.b3{animation-duration:.72s;animation-delay:.18s}
@keyframes tnrtalk{0%,100%{transform:scaleY(.3)}50%{transform:scaleY(1)}}
.tnr-badge{display:inline-flex;align-items:center;gap:6px;font-size:10px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;color:#7fd0ff;background:rgba(80,170,255,.12);border:1px solid rgba(127,208,255,.28);border-radius:999px;padding:4px 12px}
.tnr-title{font-size:20px;font-weight:800;color:#eaf2ff;letter-spacing:-.2px;animation:tnrpop .5s ease both}
.tnr-sub{font-size:12.5px;font-weight:600;color:#9fb4dd;max-width:350px;line-height:1.55;animation:tnrpop .5s ease .1s both}
@keyframes tnrpop{from{opacity:0;transform:translateY(8px) scale(.96)}to{opacity:1;transform:none}}
`;

export function narratorScene(badge: string, title: string, sub: string): string {
  return `<div class="tnr-scene">${NARRATOR_BOT}<div class="tnr-badge">${badge}</div><div class="tnr-title">${title}</div><div class="tnr-sub">${sub}</div></div>`;
}
