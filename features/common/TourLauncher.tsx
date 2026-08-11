"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { LiveTour } from "./LiveTour";
import { GuidedTour } from "./GuidedTour";
import { TOUR_STEPS } from "./tourSteps";
import { TOUR_FIXTURES } from "./tourFixtures";
import { TOUR_CONFIGS } from "./tourConfigs";

// The "How it works" affordance: a compact launcher button that opens the
// walkthrough in a popup. The tour only mounts while the popup is open (so the
// voice/iframe don't run in the background), and closing it unmounts the tour,
// which stops the narration.
export function TourLauncher({ view, portal: portalProp, custom }: { view: string; portal?: string; custom?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const portal = portalProp || pathname?.split("/")[1] || "freelancer";
  const hasLive = !!TOUR_STEPS[view] && !!TOUR_FIXTURES[view];
  const hasTour = !!custom || hasLive || !!TOUR_CONFIGS[view];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open]);

  if (!hasTour) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-extrabold shadow-sm transition-all hover:-translate-y-px"
        style={{ background: "#ffffff", borderColor: "#e6ebf5", color: "#1d3a8f" }}
      >
        <span>ℹ️ How it works</span>
        <span
          className="rounded-full px-2.5 py-1 text-[11px] font-extrabold text-white"
          style={{ background: "linear-gradient(180deg,#4f8bf5,#2f6bd8)" }}
        >
          ▶ Watch walkthrough
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", background: "rgba(10,18,38,.55)", backdropFilter: "blur(3px)" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ position: "relative", width: "min(1120px,96vw)", maxHeight: "94vh", overflow: "auto", background: "#f5f8fd", borderRadius: 20, padding: "18px 18px 20px", boxShadow: "0 40px 90px -30px rgba(10,20,50,.7)" }}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close walkthrough"
              style={{ position: "absolute", top: 12, right: 12, zIndex: 5, width: 34, height: 34, borderRadius: 999, border: "1px solid #e6ebf5", background: "#fff", color: "#3a4a68", fontSize: 18, fontWeight: 800, cursor: "pointer", lineHeight: 1 }}
            >
              ×
            </button>
            {custom ? (
              custom
            ) : hasLive ? (
              <LiveTour view={view} portal={portal} steps={TOUR_STEPS[view]} />
            ) : (
              <GuidedTour config={TOUR_CONFIGS[view]} />
            )}
          </div>
        </div>
      )}
    </>
  );
}
