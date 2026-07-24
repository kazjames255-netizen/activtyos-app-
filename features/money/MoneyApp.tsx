"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useSettings } from "@/lib/settings";
import { PurchasingApp } from "@/features/money/PurchasingApp";
import { InvoicesApp } from "@/features/money/InvoicesApp";

const LIGHT_PALETTE = {
  "--bg": "#f5f8fd", "--surface": "#ffffff", "--panel": "#fbf8fc",
  "--ink": "#171534", "--ink-2": "#4a4763", "--ink-3": "#8a86a3", "--line": "#ece6f1",
} as CSSProperties;

// Combined outgoing (Bills & POs) + incoming (Invoices) area, with one clear
// in/out switch at the top. Setup → Money's `show` decides which sides are
// available; `both` gives the toggle, otherwise it locks to the one side.
export function MoneyApp() {
  const { settings } = useSettings();
  const show = settings.money?.show ?? "both";
  const [side, setSide] = useState<"out" | "in">(show === "incoming" ? "in" : "out");
  useEffect(() => { if (show === "incoming") setSide("in"); else if (show === "outgoing") setSide("out"); }, [show]);
  const canSwitch = show === "both";

  const SIDES = [
    { key: "out" as const, arrow: "↑", label: "Money out", sub: "Supplier bills", dot: "#e2643b" },
    { key: "in" as const, arrow: "↓", label: "Money in", sub: "POs & invoices", dot: "#22a06b" },
  ];

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      {/* Combined hero + in/out switch */}
      <div className="relative mb-4 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 62%,#ffffff 100%)" }}>
        <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">💷</span>
          Bills &amp; Invoices
        </div>
        <p className="mt-1.5 max-w-[560px] text-[12.5px] leading-[1.5] text-white/85">Everything moving through your business — <b>money out</b> (supplier bills) and <b>money in</b> (POs &amp; invoices you send parents). Pick a side below.</p>

        {canSwitch ? (
          <div className="mt-4 inline-flex gap-1 rounded-2xl bg-white/15 p-1 backdrop-blur-sm">
            {SIDES.map((s) => (
              <button key={s.key} type="button" onClick={() => setSide(s.key)} className="flex items-center gap-2.5 rounded-xl px-4 py-2 text-left transition-colors" style={side === s.key ? { background: "#fff", color: "#1d3a8f" } : { color: "#fff" }}>
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[13px] font-extrabold" style={{ background: side === s.key ? s.dot : "rgba(255,255,255,.25)", color: "#fff" }}>{s.arrow}</span>
                <span className="leading-tight"><span className="block text-[13px] font-extrabold">{s.label}</span><span className="block text-[10.5px] opacity-75">{s.sub}</span></span>
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-4 inline-flex items-center gap-2.5 rounded-xl bg-white/15 px-4 py-2 backdrop-blur-sm">
            {(() => { const s = SIDES.find((x) => x.key === side)!; return (<><span className="flex h-6 w-6 items-center justify-center rounded-full text-[13px] font-extrabold" style={{ background: s.dot }}>{s.arrow}</span><span className="leading-tight"><span className="block text-[13px] font-extrabold">{s.label}</span><span className="block text-[10.5px] opacity-75">{s.sub}</span></span></>); })()}
          </div>
        )}
      </div>

      {/* A colour-coded strip so the current side is unmistakable */}
      <div className="mb-3 flex items-center gap-2 text-[12px] font-bold" style={{ color: side === "out" ? "#c2410c" : "#0f7a44" }}>
        <span className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] text-white" style={{ background: side === "out" ? "#e2643b" : "#22a06b" }}>{side === "out" ? "↑" : "↓"}</span>
        {side === "out" ? "OUTGOING — money you pay out to suppliers" : "INCOMING — money you collect from parents"}
      </div>

      {side === "out" ? <PurchasingApp embedded /> : <InvoicesApp embedded />}
    </div>
  );
}
