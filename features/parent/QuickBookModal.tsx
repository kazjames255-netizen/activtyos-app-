"use client";

// Quick book — the SAME parent booking + checkout flow as the /book page, but in
// a white/blue modal launched straight from a browse card. Reuses CustomerPage's
// booking-only path (bookingOnly), so the process can't diverge from the full page.
import { useEffect, useState } from "react";
import { apiPublic } from "@/lib/api";
import { CustomerPage, type ServerListing } from "@/features/listings/ListingWizard";
import { useT } from "@/lib/i18n/provider";

export function QuickBookModal({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useT();
  const [listing, setListing] = useState<ServerListing | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiPublic<ServerListing>(`/api/listings/${encodeURIComponent(id)}`)
      .then(setListing)
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn’t load this listing"));
  }, [id]);

  // Esc to close.
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-auto bg-black/50 p-3 py-6 sm:p-6" onClick={onClose}>
      <div className="w-full max-w-[600px] overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_-12px_rgba(20,30,60,.55)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 text-white" style={{ background: "linear-gradient(120deg,#16306e 0%,#3f78d8 100%)" }}>
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/70">{t("parent.quickBook")}</div>
            <div className="truncate text-[15px] font-extrabold">{listing?.title || listing?.name || "…"}</div>
          </div>
          <button type="button" onClick={onClose} aria-label={t("common.cancel")} className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-white/20 text-[16px] font-bold leading-none hover:bg-white/30">×</button>
        </div>
        <div className="max-h-[calc(100vh-8rem)] overflow-auto bg-[#f4f7ff] p-4">
          {error ? (
            <div className="p-6 text-center text-[13px] font-semibold text-[#c0362c]">{error}</div>
          ) : !listing ? (
            <div className="p-10 text-center text-[13px] text-[#8a86a3]">{t("parent.loading")}</div>
          ) : (
            <CustomerPage listing={listing} bookingOnly />
          )}
        </div>
      </div>
    </div>
  );
}
