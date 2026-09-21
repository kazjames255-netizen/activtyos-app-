"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import type { WidgetProps } from "./types";

// Explore widget "neurone" — send a nerve impulse down an axon with the myelin sheath on and off.
// The SVG keeps its own illustration colours (a diagram, not UI chrome).

const X0 = 106, X1 = 590;
const NODES = Array.from({ length: 8 }, (_, i) => Math.min(X0 + i * 65, X1));

/** Where the impulse is at progress t: it crawls without myelin, and hops between the gaps with it. */
function posAt(t: number, myelin: boolean) {
  if (!myelin) return X0 + (X1 - X0) * t;
  const n = NODES.length - 1, seg = Math.min(n - 1, Math.floor(t * n)), f = t * n - seg;
  const e = f < 0.3 ? 0 : Math.min(1, (f - 0.3) / 0.35), ease = e * e * (3 - 2 * e);
  return NODES[seg] + (NODES[seg + 1] - NODES[seg]) * ease;
}

export function Neurone({ onXP }: WidgetProps) {
  const [myelin, setMyelin] = useState(true);
  const [x, setX] = useState(X0);
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [time, setTime] = useState<string>("—");
  const raf = useRef(0);
  const hide = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { cancelAnimationFrame(raf.current); if (hide.current) clearTimeout(hide.current); }, []);

  const send = () => {
    cancelAnimationFrame(raf.current);
    setShown(true); setBusy(true);
    const dur = myelin ? 1100 : 3300;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finish = () => { setX(X1); setTime(`${(dur / 1000).toFixed(1)} s`); setBusy(false); hide.current = setTimeout(() => setShown(false), 900); onXP(3); };
    if (reduce) { finish(); return; }
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      setX(posAt(t, myelin)); setTime(`${((now - t0) / 1000).toFixed(1)} s`);
      if (t < 1) raf.current = requestAnimationFrame(tick); else finish();
    };
    raf.current = requestAnimationFrame(tick);
  };

  return (
    <div className="rounded-2xl border-2 border-[var(--brand-line)] p-4" style={{ background: "linear-gradient(180deg, var(--brand-soft), var(--surface))" }} data-widget="neurone">
      <svg viewBox="0 0 640 170" className="block h-auto w-full" role="img" aria-label="A neurone with an axon, an optional myelin sheath and a travelling impulse">
        <g stroke="#7b83a3" strokeWidth="3" fill="none" strokeLinecap="round"><path d="M40 40 L60 66M28 84 L58 80M42 128 L62 94" /></g>
        <circle cx="80" cy="80" r="26" fill="#c9d4ff" stroke="#3b5bdb" strokeWidth="3" /><circle cx="80" cy="80" r="9" fill="#3b5bdb" />
        <text x="80" y="128" textAnchor="middle" fontSize="12" fontWeight="800" fill="#4a5275">cell body</text>
        <line x1="106" y1="80" x2="590" y2="80" stroke="#3b5bdb" strokeWidth="7" strokeLinecap="round" />
        {myelin && <g>{NODES.slice(0, -1).map((n) => <rect key={n} x={n + 9} y="68" width="47" height="24" rx="12" fill="#f4c542" stroke="#c99a10" />)}</g>}
        <g fill="#3b5bdb"><circle cx="602" cy="70" r="5" /><circle cx="602" cy="90" r="5" /><circle cx="614" cy="80" r="5" /></g>
        <text x="330" y="40" textAnchor="middle" fontSize="12" fontWeight="800" fill="#4a5275">axon</text>
        {myelin && <text x="330" y="122" textAnchor="middle" fontSize="12" fontWeight="800" fill="#c99a10">myelin sheath (fatty insulation)</text>}
        <circle cx={x} cy="80" r="11" fill="#ff5a3c" stroke="#fff" strokeWidth="3" opacity={shown ? 1 : 0} />
      </svg>
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-[14px] font-extrabold text-[var(--ink)]">
          <input type="checkbox" checked={myelin} onChange={(e) => { setMyelin(e.target.checked); setTime("—"); }} className="h-5 w-5 accent-[var(--brand)]" /> Myelin sheath
        </label>
        <span className="text-[13px] text-[var(--ink-3)]" aria-live="polite">Time taken: <span className="text-[18px] font-black tabular-nums text-[var(--brand)]">{time}</span></span>
        <Button variant="solid" onClick={send} disabled={busy} className="!min-h-[44px]">⚡ Send impulse</Button>
      </div>
      <p className="m-0 mt-2 text-[13px] text-[var(--ink-3)]" role="status">{myelin ? "With myelin, the impulse jumps between the gaps, so it is much faster." : "Without myelin the impulse has to crawl along the whole axon, so it is slower."}</p>
    </div>
  );
}
