"use client";

import { useEffect, useRef, useState } from "react";
import { bindLegacy, type LegacyDef } from "./legacyRuntime";
import type { WidgetProps } from "./types";

// Generic adapter: mounts a plain-JS widget module (WIDGETS.id = {title, intro, html(), init()}) inside the React player.
// html() is injected into a ref'd div and init() called once it is in the DOM — exactly the prototype's contract — so every
// file in scratch/prototype/widgets works in-app without being ported. The wrapper maps the prototype's colour names
// (--brand2, --ink2, --ok …) and helper classes (.explore .btn .small .stat .tag .row .spread) onto the hub's tokens.

const CSS = `
.lw-root{--brand2:var(--brand-2);--ink2:var(--ink-2);--ink3:var(--ink-3);--ok:var(--green);--ok-soft:var(--green-soft);--bad:var(--red);--bad-soft:var(--red-soft);--warn:color-mix(in srgb,var(--gold) 40%,var(--ink));--warn-soft:var(--gold-soft);color:var(--ink);font-size:15px;line-height:1.5}
.lw-root .explore{background:linear-gradient(180deg,var(--brand-soft),var(--surface));border:2px solid var(--brand-line);border-radius:16px;padding:16px}
.lw-root .explore svg{width:100%;height:auto;display:block}
.lw-root .btn{border:0;border-radius:12px;padding:10px 18px;min-height:44px;font:inherit;font-weight:800;font-size:15px;background:var(--brand);color:#fff;cursor:pointer;transition:filter .15s,transform .12s}
.lw-root .btn:hover{filter:brightness(1.12)}.lw-root .btn:active{transform:translateY(1px)}
.lw-root .btn[disabled]{opacity:.4;pointer-events:none}
.lw-root .btn.ghost{background:var(--surface);color:var(--brand);border:2px solid var(--line)}
.lw-root .btn.st,.lw-root .btn.pr,.lw-root .btn.fk{padding:6px 14px;min-height:40px}
.lw-root .btn.sel{background:var(--brand-soft);border-color:var(--brand)}
.lw-root button:focus-visible,.lw-root input:focus-visible,.lw-root select:focus-visible,.lw-root [tabindex]:focus-visible{outline:2px solid var(--brand-2);outline-offset:2px}
.lw-root .small{font-size:13px;color:var(--ink-3)}
.lw-root .stat{font-variant-numeric:tabular-nums;font-weight:900;color:var(--brand);font-size:18px}
.lw-root .tag{display:inline-block;background:var(--green-soft);color:var(--green);font-weight:900;font-size:11px;letter-spacing:.06em;padding:3px 10px;border-radius:99px;text-transform:uppercase}
.lw-root .row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.lw-root .spread{justify-content:space-between}
.lw-root .switch{display:inline-flex;gap:8px;align-items:center;font-weight:800;cursor:pointer;min-height:44px}
.lw-root .switch input{width:20px;height:20px;accent-color:var(--brand)}
.lw-root .muted{color:var(--ink-2)}
.lw-root .frac{display:inline-flex;flex-direction:column;align-items:center;font-weight:900;line-height:1.1;vertical-align:middle;color:var(--brand)}
.lw-root .frac b{border-bottom:3px solid var(--brand);padding:0 8px 2px}.lw-root .frac u{text-decoration:none;padding-top:2px}
@media (prefers-reduced-motion:reduce){.lw-root *{animation:none!important;transition:none!important}}
`;

export function LegacyWidget({ def, onXP }: { def: LegacyDef; onXP: WidgetProps["onXP"] }) {
  const ref = useRef<HTMLDivElement>(null);
  const xp = useRef(onXP);
  xp.current = onXP;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setFailed(false);
    bindLegacy(el, (n) => xp.current(n));
    try {
      el.innerHTML = def.html();
      def.init();
    } catch (e) {
      console.warn("[lesson widgets] widget failed to start:", e);
      el.innerHTML = "";
      setFailed(true);
    }
    return () => { bindLegacy(null); el.innerHTML = ""; };
  }, [def]);

  return (
    <div className="lw-root">
      <style>{CSS}</style>
      <div ref={ref} />
      {failed && <p role="alert" className="m-0 rounded-xl bg-[var(--red-soft)] px-3 py-2 text-[13px] font-semibold text-[var(--red)]">This activity couldn&apos;t start. You can carry on with the lesson.</p>}
    </div>
  );
}
