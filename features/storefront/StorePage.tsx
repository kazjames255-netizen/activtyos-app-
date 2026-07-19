"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiPublic } from "@/lib/api";
import { money } from "@/features/bookings/helpers";
import { CroppedImage, type ServerListing } from "@/features/listings/ListingWizard";

// ─────────────────────────────────────────────────────────────────────────
// /store/{tenantId} — one provider's whole public storefront: every live,
// public listing they run, each opening its /book/{id} page. This is what
// the embed widget's data-store mode shows inside a provider's website,
// and what their subdomain will serve once hosting/domains exist.
// Publicly readable, no account needed until booking.
// ─────────────────────────────────────────────────────────────────────────

const fmtDate = (iso?: string) =>
  iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : null;

export function StorePage({ tenantId }: { tenantId: string }) {
  const [listings, setListings] = useState<ServerListing[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Same embed contract as BookPage: chromeless + height reports.
  const embedded = useSearchParams().has("embed");

  useEffect(() => {
    apiPublic<ServerListing[]>(`/api/listings?tenantId=${encodeURIComponent(tenantId)}`)
      .then(setListings)
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn’t load this provider"));
  }, [tenantId]);
  useEffect(() => {
    if (!embedded) return;
    const post = () =>
      window.parent?.postMessage(
        { type: "activityos:height", value: Math.ceil(document.documentElement.scrollHeight) },
        "*",
      );
    const ro = new ResizeObserver(post);
    ro.observe(document.body);
    post();
    return () => ro.disconnect();
  }, [embedded]);

  if (error)
    return <div className="flex min-h-[40vh] items-center justify-center bg-[#f4f7ff] p-6 text-[13px] text-[#e21d27]">{error}</div>;
  if (!listings)
    return <div className="flex min-h-[40vh] items-center justify-center bg-[#f4f7ff] text-[13px] text-[#8a86a3]">Loading…</div>;

  const provider = listings[0]?.tenantName ?? "Our activities";

  return (
    <div className="min-h-screen bg-[#f4f7ff] pb-16">
      <div className="mx-auto max-w-[1080px] px-4 pt-6">
        <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#2f6bd8]">
          Book with {provider}
        </div>
        <h1 className="mb-4 text-[26px] font-extrabold tracking-[-0.02em] text-[#171534]">
          Camps, clubs &amp; activities
        </h1>
        {listings.length === 0 ? (
          <div className="rounded-2xl border border-[#e8edf7] bg-white p-8 text-center text-[13px] text-[#8a86a3]">
            Nothing is open for booking right now — check back soon.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => {
              const hero = l.images?.[0];
              const passes = l.passes ?? [];
              const from = passes.length ? Math.min(...passes.map((p) => p.price)) : null;
              const runFrom = fmtDate(l.runFrom);
              const runTo = fmtDate(l.runTo);
              const spotsLeft = (l.blocks ?? []).filter((b) => b.open).reduce((s, b) => s + b.spotsLeft, 0);
              return (
                <Link
                  key={l.id}
                  href={`/book/${encodeURIComponent(l.id)}${embedded ? "?embed=1&from=store" : ""}`}
                  className="group overflow-hidden rounded-2xl border border-[#e8edf7] bg-white transition-shadow hover:shadow-[0_18px_44px_-24px_rgba(20,35,90,.35)]"
                >
                  <div className="h-[130px] overflow-hidden bg-gradient-to-br from-[#7fd4d6] via-[#2f7fae] to-[#1b4a6b]">
                    {hero && <CroppedImage im={hero} className="h-full w-full" />}
                  </div>
                  <div className="p-3.5">
                    <div className="truncate text-[14.5px] font-extrabold text-[#171534]">{l.title || l.name}</div>
                    <div className="mt-0.5 text-[11.5px] text-[#8a86a3]">
                      {runFrom && runTo ? `${runFrom} – ${runTo}` : "Dates TBC"}
                      {spotsLeft > 0 && <span className="text-[#0f7a44]"> · places available</span>}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[13px] font-extrabold text-[#171534]">
                        {from !== null ? `from ${money(from)}` : ""}
                      </span>
                      <span className="rounded-full bg-[#15b364] px-3 py-1 text-[11.5px] font-bold text-white">
                        Book →
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
