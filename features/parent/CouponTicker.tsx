"use client";

import { useEffect, useRef, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { money } from "@/features/bookings/helpers";

// custdash coupon ticker — a slow-scrolling bar of the discount codes a family
// can use right now (public codes from their providers + any reserved for them),
// styled like the operator's aos-ticker. It only READS /api/my/coupons (the
// server already drops paused / expired / used-up codes), so nothing scrolling
// past is a dead end. The parent can pause the roll or hide the bar entirely,
// and both choices persist in localStorage. See the manual's ticker for style.

type Coupon = {
  id: string; code: string; type: "percent" | "amount" | "perAttendee";
  value: number; provider: string; reserved: boolean; listingName: string | null;
};

const DISMISS_KEY = "aos.couponTicker.hidden";
const PAUSE_KEY = "aos.couponTicker.paused";
const valueLabel = (c: Coupon) =>
  c.type === "percent" ? `${c.value}% off` : c.type === "perAttendee" ? `${money(c.value)} off/child` : `${money(c.value)} off`;

export function CouponTicker() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [hidden, setHidden] = useState(true); // start hidden → no flash before we know
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    setHidden(localStorage.getItem(DISMISS_KEY) === "1");
    setPaused(localStorage.getItem(PAUSE_KEY) === "1");
  }, []);

  const load = () => apiGet<Coupon[]>("/api/my/coupons").then((r) => setCoupons(r ?? [])).catch(() => setCoupons([]));
  useEffect(() => { void load(); }, []);
  useRealtime(["discountCodes", "bookings"], load);

  // Scroll the strip in JS (not CSS animation) so it moves reliably — CSS
  // marquees are silently killed by the OS "reduce motion" setting, and the
  // parent has an explicit pause control here anyway. Freezes on pause/hover.
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [hovered, setHovered] = useState(false);
  useEffect(() => {
    const el = trackRef.current;
    if (!el || paused || hovered || hidden || coupons.length === 0) return;
    let raf = 0, last = 0, offset = 0;
    const m = /translateX\((-?\d+(?:\.\d+)?)px\)/.exec(el.style.transform);
    if (m) offset = -parseFloat(m[1]); // resume from where it froze
    const tick = (t: number) => {
      if (last) {
        offset += (t - last) * 0.045; // ≈ 45px/s
        const half = el.scrollWidth / 2;
        if (half > 0 && offset >= half) offset -= half; // seamless wrap
        el.style.transform = `translateX(${-offset}px)`;
      }
      last = t;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused, hovered, hidden, coupons.length]);

  if (coupons.length === 0) return null;

  const dismiss = () => { setHidden(true); try { localStorage.setItem(DISMISS_KEY, "1"); } catch {} };
  const reveal = () => { setHidden(false); try { localStorage.setItem(DISMISS_KEY, "0"); } catch {} };
  const togglePause = () => setPaused((p) => { const n = !p; try { localStorage.setItem(PAUSE_KEY, n ? "1" : "0"); } catch {} return n; });

  // Hidden → keep a slim, always-there way to bring it back (never lost).
  if (hidden) return (
    <div className="flex h-[26px] items-center justify-end border-b border-black/20 px-3" style={{ background: "linear-gradient(90deg,#3a4266,#454e77)" }}>
      <button type="button" onClick={reveal} className="text-[11px] font-bold text-[#c7d3f5] hover:text-white">🏷️ Show my codes ({coupons.length}) ›</button>
    </div>
  );

  // Repeat the codes until one copy is wide enough to fill the bar, THEN
  // duplicate that — so the -50% slide scrolls continuously with no dead gap,
  // even when there are only one or two codes.
  const oneCopy = Array.from({ length: Math.max(2, Math.ceil(10 / coupons.length)) }, () => coupons).flat();
  const items = [...oneCopy, ...oneCopy];

  return (
    <div
      className="relative flex h-[34px] items-center overflow-hidden border-b border-black/20"
      style={{ background: "linear-gradient(90deg,#3a4266,#454e77)" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="z-10 flex-none px-3 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[#FACC15]">🏷️ Your codes</span>
      <div className="min-w-0 flex-1 overflow-hidden">
        <div ref={trackRef} className="inline-flex items-center whitespace-nowrap [will-change:transform]">
          {items.map((c, i) => (
            <span key={`${c.id}-${i}`} className="inline-flex items-center gap-2 px-5 text-[12.5px] font-semibold text-[#eef2ff]">
              <span className="font-mono font-extrabold tracking-wider text-white">{c.code}</span>
              <span className="text-[#c7d3f5]">{valueLabel(c)} · {c.provider} · {c.listingName ? c.listingName : "all listings"}</span>
              {c.reserved && <span className="text-[#FACC15]">🎁</span>}
              <span className="px-1 text-[8px] text-[#FACC15] opacity-50">◆</span>
            </span>
          ))}
        </div>
      </div>
      {/* Controls — stop it rolling, or hide the bar for good. */}
      <div className="z-10 flex flex-none items-center gap-1 px-2">
        <button type="button" onClick={togglePause} title={paused ? "Let it scroll" : "Stop scrolling"} className="rounded px-1.5 py-0.5 text-[13px] leading-none text-[#c7d3f5] hover:text-white">{paused ? "▶" : "⏸"}</button>
        <button type="button" onClick={dismiss} title="Hide this bar" className="rounded px-1.5 py-0.5 text-[15px] leading-none text-[#c7d3f5] hover:text-white">×</button>
      </div>
    </div>
  );
}
