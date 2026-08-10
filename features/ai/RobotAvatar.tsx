"use client";

// The ActivityOS co-pilot's face — the same robot from the guided walkthroughs,
// now a reactive React component. Drive it with `state`:
//   idle       — gentle bob + blink
//   thinking   — eyes scan, antenna pulses, "…" dots float above (model working)
//   talking    — mouth lip-syncs (host toggles this while the voice speaks)
//   listening  — pink halo + antenna pulse (mic is open)

export type RobotState = "idle" | "thinking" | "talking" | "listening";

const CSS = `
.rbt{position:relative;display:inline-grid;place-items:center;line-height:0}
.rbt-halo{position:absolute;inset:-11%;border-radius:50%;background:radial-gradient(circle,rgba(90,190,255,.45),transparent 62%);animation:rbtpulse 2.6s ease-in-out infinite}
.rbt.is-listening .rbt-halo{background:radial-gradient(circle,rgba(255,90,168,.55),transparent 60%);animation-duration:1.05s}
.rbt.is-thinking .rbt-halo{animation-duration:1.6s}
.rbt-svg{position:relative;width:100%;height:100%;animation:rbtbob 4s ease-in-out infinite}
.rbt.is-talking .rbt-svg{animation-duration:2.6s}
@keyframes rbtbob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4%)}}
@keyframes rbtpulse{0%,100%{opacity:.5;transform:scale(.93)}50%{opacity:1;transform:scale(1.06)}}
.rbt-eye{transform-box:fill-box;transform-origin:center;animation:rbtblink 5s infinite}
@keyframes rbtblink{0%,94%,100%{transform:scaleY(1)}97%{transform:scaleY(.12)}}
.rbt.is-thinking .rbt-eyes{animation:rbtscan 2.1s ease-in-out infinite}
@keyframes rbtscan{0%,100%{transform:translateX(-1.6px)}50%{transform:translateX(1.6px)}}
.rbt-mbar{transform-box:fill-box;transform-origin:center;animation:rbtidle 2.6s ease-in-out infinite}
.rbt-mbar.b2{animation-delay:.3s}.rbt-mbar.b3{animation-delay:.6s}
@keyframes rbtidle{0%,100%{transform:scaleY(.5)}50%{transform:scaleY(.7)}}
.rbt.is-talking .rbt-mbar{animation:rbttalk .5s ease-in-out infinite}
.rbt.is-talking .rbt-mbar.b2{animation-duration:.38s;animation-delay:.06s}
.rbt.is-talking .rbt-mbar.b3{animation-duration:.46s;animation-delay:.12s}
@keyframes rbttalk{0%,100%{transform:scaleY(.28)}50%{transform:scaleY(1)}}
.rbt.is-listening .rbt-mbar{animation:none;transform:scaleY(.34)}
.rbt-tip{transform-box:fill-box;transform-origin:center}
.rbt.is-thinking .rbt-tip,.rbt.is-listening .rbt-tip{animation:rbttip 1s ease-in-out infinite}
@keyframes rbttip{0%,100%{opacity:.55}50%{opacity:1}}
.rbt-dots{position:absolute;top:-9%;display:flex;gap:4px;opacity:0;transition:opacity .2s}
.rbt.is-thinking .rbt-dots{opacity:1}
.rbt-dots i{width:5px;height:5px;border-radius:50%;background:#7fd0ff}
.rbt.is-thinking .rbt-dots i{animation:rbtdot 1.2s ease-in-out infinite}
.rbt-dots i:nth-child(2){animation-delay:.15s}.rbt-dots i:nth-child(3){animation-delay:.3s}
@keyframes rbtdot{0%,100%{opacity:.3;transform:translateY(0)}50%{opacity:1;transform:translateY(-3px)}}
`;

export function RobotAvatar({ state = "idle", size = 112, className = "" }: { state?: RobotState; size?: number; className?: string }) {
  return (
    <div className={`rbt is-${state} ${className}`} style={{ width: size, height: size }} aria-hidden>
      <style>{CSS}</style>
      <span className="rbt-halo" />
      <div className="rbt-dots"><i /><i /><i /></div>
      <svg className="rbt-svg" viewBox="0 0 112 112" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="rbtHead" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f6faff" /><stop offset="1" stopColor="#c9dcff" /></linearGradient>
          <radialGradient id="rbtEye" cx="50%" cy="40%" r="60%"><stop offset="0" stopColor="#cbf3ff" /><stop offset="1" stopColor="#33b6ff" /></radialGradient>
        </defs>
        <line x1="56" y1="17" x2="56" y2="31" stroke="#8fb6ff" strokeWidth="3" strokeLinecap="round" />
        <circle className="rbt-tip" cx="56" cy="13" r="5" fill="#ff5aa8" />
        <circle cx="19" cy="63" r="11" fill="url(#rbtHead)" stroke="#a9c6ff" strokeWidth="1.5" />
        <circle cx="93" cy="63" r="11" fill="url(#rbtHead)" stroke="#a9c6ff" strokeWidth="1.5" />
        <circle cx="19" cy="63" r="4" fill="#7fd0ff" />
        <circle cx="93" cy="63" r="4" fill="#7fd0ff" />
        <rect x="26" y="30" width="60" height="60" rx="22" fill="url(#rbtHead)" stroke="#a9c6ff" strokeWidth="1.5" />
        <rect x="33" y="45" width="46" height="27" rx="13.5" fill="#0e1e46" />
        <g className="rbt-eyes">
          <ellipse className="rbt-eye" cx="47" cy="58" rx="5" ry="6.2" fill="url(#rbtEye)" />
          <ellipse className="rbt-eye" cx="65" cy="58" rx="5" ry="6.2" fill="url(#rbtEye)" />
        </g>
        <rect className="rbt-mbar b1" x="49.5" y="77" width="3" height="9" rx="1.5" fill="#7fd0ff" />
        <rect className="rbt-mbar b2" x="54.5" y="77" width="3" height="9" rx="1.5" fill="#7fd0ff" />
        <rect className="rbt-mbar b3" x="59.5" y="77" width="3" height="9" rx="1.5" fill="#7fd0ff" />
      </svg>
    </div>
  );
}
