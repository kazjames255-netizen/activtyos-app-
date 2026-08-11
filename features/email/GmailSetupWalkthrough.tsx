"use client";

import { useEffect } from "react";
import { LiveTour } from "@/features/common/LiveTour";
import { gmailTour } from "@/features/common/tourGmail";

// The Gmail-connect walkthrough. It runs through the shared LiveTour shell in
// "slides" mode, so it's the same experience as every other walkthrough —
// robot narrator, British voice, splash and controls — but the stage shows a
// recreation of each Gmail screen (the real steps happen inside Gmail, which we
// can't embed). Launched as a popup from the email-setup panel; the tour only
// mounts while the popup is open, so the voice stops when it closes.
export function GmailSetupWalkthrough({ address, code, onClose }: { address: string; code?: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "rgba(10,18,38,.55)", backdropFilter: "blur(3px)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ position: "relative", width: "min(1120px,96vw)", maxHeight: "94vh", overflow: "auto", background: "#f5f8fd", borderRadius: 20, padding: "18px 18px 20px", boxShadow: "0 40px 90px -30px rgba(10,20,50,.7)" }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close walkthrough"
          style={{ position: "absolute", top: 12, right: 12, zIndex: 5, width: 34, height: 34, borderRadius: 999, border: "1px solid #e6ebf5", background: "#fff", color: "#3a4a68", fontSize: 18, fontWeight: 800, cursor: "pointer", lineHeight: 1 }}
        >
          ×
        </button>
        <LiveTour view="gmail-setup" portal="freelancer" steps={gmailTour(address, code)} />
      </div>
    </div>
  );
}
