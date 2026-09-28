"use client";

import { useEffect, useRef, useState } from "react";
import { useBareTool } from "../../tools/bareContext";
import { bindLegacy, type LegacyDef } from "./legacyRuntime";
import type { WidgetProps } from "./types";
import { useI18n } from "@/lib/i18n/provider";
import { createTranslator, loadLegacyTable } from "./legacyI18n";

// Generic adapter: mounts a plain-JS widget module (WIDGETS.id = {title, intro, html(), init()}) inside the React player.
// html() is injected into a ref'd div and init() called once it is in the DOM — exactly the prototype's contract — so every
// file in scratch/prototype/widgets works in-app without being ported. The wrapper maps the prototype's colour names
// (--brand2, --ink2, --ok …) and helper classes (.explore .btn .small .stat .tag .row .spread) onto the hub's tokens.

const CSS = `
.lw-root{--brand2:var(--brand-2);--ink2:var(--ink-2);--ink3:var(--ink-3);--ok:var(--green);--ok-soft:var(--green-soft);--bad:var(--red);--bad-soft:var(--red-soft);--warn:color-mix(in srgb,var(--gold) 40%,var(--ink));--warn-soft:var(--gold-soft);color:var(--ink);font-size:15px;line-height:1.5}
/* "Just the tool": the widget keeps its stage and its own controls (they sit in a small translucent strip) but drops the card, hint text, tags and headings */
.lw-bare,.lw-bare>div,.lw-bare .explore{pointer-events:none}.lw-bare .explore>*{pointer-events:auto}
.lw-bare .explore{background:none!important;border:0!important;padding:0!important;border-radius:0!important}
.lw-bare .explore .small,.lw-bare .explore .muted,.lw-bare .explore .tag,.lw-bare .explore h3,.lw-bare .explore h4{display:none!important}
.lw-bare [id$="-fb"],.lw-bare [id$="-msg"]{display:none!important}
.lw-bare [id$="-say"]{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.lw-bare .explore>.row{background:color-mix(in srgb,var(--surface) 92%,transparent);border:1px solid var(--line);border-radius:14px;padding:4px 8px;width:fit-content;box-shadow:0 4px 12px rgba(0,0,0,.12)}
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
  const bare = useBareTool();
  const ref = useRef<HTMLDivElement>(null);
  const xp = useRef(onXP);
  xp.current = onXP;
  const [failed, setFailed] = useState(false);
  const { t, locale } = useI18n();
  const tr = useRef<{ stop(): void } | null>(null);

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
    // Marks the widget's game / answer-checking buttons (Challenge me, Check, Reveal, New puzzle, Next sentence...) as chrome, so "Just the tool" (the floating window) hides them: the tool itself stays, not the game wrapper.
    el.querySelectorAll("button").forEach((b) => { if (/^\s*(challenge me|check( my \w+)?|reveal \w+|new (puzzle|round|sentence)|next sentence|surprise me|mix them up again)\s*$/i.test(b.textContent ?? "")) b.setAttribute("data-tool-chrome", "1"); });
    // Stage SVGs whose drawn parts are the only real targets (balance scales) let taps on their empty area fall through to the lesson in "Just the tool".
    el.querySelectorAll("#bs-svg").forEach((s) => s.setAttribute("data-bare-pass", "1"));
    // Other languages: translate the rendered widget (see legacyI18n.ts). English needs nothing.
    let live = true;
    if (locale !== "en") loadLegacyTable(locale).then((table) => { if (!live || !ref.current) return; tr.current?.stop(); const x = createTranslator(el, table); x.run(); tr.current = x; });
    return () => { live = false; tr.current?.stop(); tr.current = null; bindLegacy(null); el.innerHTML = ""; };
  }, [def, locale]);

  return (
    <div className={bare ? "lw-root lw-bare" : "lw-root"} data-bare-pass={bare ? "1" : undefined}>
      <style>{CSS}</style>
      <div ref={ref} />
      {failed && <p role="alert" className="m-0 rounded-xl bg-[var(--red-soft)] px-3 py-2 text-[13px] font-semibold text-[var(--red)]">{t("hubtoolsb.lw_failed")}</p>}
    </div>
  );
}
