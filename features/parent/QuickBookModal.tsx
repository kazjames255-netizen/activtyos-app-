"use client";

// Quick book — the SAME parent booking + checkout flow as the /book page, but as
// a panel that SLIDES in exactly over the browse-card grid (same size, on top),
// in the white/blue theme. Reuses CustomerPage's bookingOnly path so the process
// can't diverge from the full page.
import { useEffect, useState } from "react";
import { apiPublic } from "@/lib/api";
import { CustomerPage, type ServerListing } from "@/features/listings/ListingWizard";
import { useT, tNow } from "@/lib/i18n/provider";
import { ViewErrorBoundary } from "@/components/ViewErrorBoundary";

export function QuickBookModal({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useT();
  const [listing, setListing] = useState<ServerListing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState(false); // drives the slide-in

  useEffect(() => {
    apiPublic<ServerListing>(`/api/listings/${encodeURIComponent(id)}`)
      .then(setListing)
      .catch((e) => setError(e instanceof Error ? e.message : tNow("p8par.qbFailed")));
  }, [id]);

  // Trigger the slide once mounted; Esc closes.
  useEffect(() => { const r = requestAnimationFrame(() => setShown(true)); return () => cancelAnimationFrame(r); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    // Fixed to the viewport: it used to be `absolute inset-0` in a non-positioned wrapper, so it stretched over the whole page and a phone
    // user who had scrolled to a card saw only an empty white panel (the header sat at the top of the page, off-screen).
    <div className="fixed inset-0 z-[9999] bg-black/40 p-2 sm:p-4">
      <div
        className={`mx-auto flex h-full max-w-[1100px] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_-12px_rgba(20,30,60,.55)] ring-1 ring-[#e3e9f5] transition-all duration-300 ease-out ${shown ? "translate-y-0 scale-100 opacity-100" : "translate-y-6 scale-[.97] opacity-0"}`}
      >
        <div className="flex flex-none items-center justify-between px-4 py-3 text-white" style={{ background: "linear-gradient(120deg,var(--brand-strong) 0%,var(--brand-2) 100%)" }}>
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/70">{t("parent.quickBook")}</div>
            <div className="truncate text-[15px] font-extrabold">{listing?.title || listing?.name || "…"}</div>
          </div>
          <button type="button" onClick={onClose} aria-label={t("common.cancel")} className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-white/20 text-[16px] font-bold leading-none hover:bg-white/30">×</button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-[#f4f7ff] p-4">
          {error ? (
            <div className="p-6 text-center text-[13px] font-semibold text-[#c0362c]">{error}</div>
          ) : !listing ? (
            <div className="p-10 text-center text-[13px] text-[#8a86a3]">{t("parent.loading")}</div>
          ) : (
            <ViewErrorBoundary name="Quick book"><CustomerPage listing={listing} bookingOnly /></ViewErrorBoundary>
          )}
        </div>
      </div>
    </div>
  );
}
