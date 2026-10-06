"use client";

import { dateLocale as dl } from "@/lib/i18n/format";
import { useT } from "@/lib/i18n/provider";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiPublic, post as apiPost } from "@/lib/api";
import { money } from "@/features/bookings/helpers";
import { DEFAULT_SETTINGS, useTenantSettings } from "@/lib/settings";
import { brandAccent, brandLogo } from "@/lib/brand-theme";
import { startEmbedHeightReports } from "@/lib/embedHeight";
import { CroppedImage, type ServerListing } from "@/features/listings/ListingWizard";

// ─────────────────────────────────────────────────────────────────────────
// /store/{tenantId} — one provider's whole public storefront: every live,
// public listing they run, each opening its /book/{id} page. This is what
// the embed widget's data-store mode shows inside a provider's website,
// and what their subdomain will serve once hosting/domains exist.
// Publicly readable, no account needed until booking.
// ─────────────────────────────────────────────────────────────────────────

const fmtDate = (iso?: string) =>
  iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString(dl(), { day: "numeric", month: "short", timeZone: "UTC" }) : null;

export function StorePage({ tenantId }: { tenantId: string }) {
  const t = useT();
  const [listings, setListings] = useState<ServerListing[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The provider's chosen public name (own name vs business name, set at
  // onboarding) — falls back to the tenant's business name on the listing.
  const { settings, ready } = useTenantSettings(tenantId);
  // Same embed contract as BookPage: chromeless + height reports.
  const embedded = useSearchParams().has("embed");

  useEffect(() => {
    apiPublic<ServerListing[]>(`/api/listings?tenantId=${encodeURIComponent(tenantId)}`)
      .then(setListings)
      .catch((e) => setError(e instanceof Error ? e.message : t("p7pub.errLoadProvider")));
  }, [tenantId]);
  // Arriving here IS the link: a family sent this provider's booking link, or
  // who found them and signed up, gets attached to that provider — so their
  // portal resolves it, and the provider sees them in Families as a lead they
  // can market to (consent not assumed — the record is created opted-out).
  // Signed-out visitors are ignored; the call 401s harmlessly and is retried
  // on their next visit once they have an account.
  useEffect(() => {
    if (embedded) return;                       // inside someone's website, not a visit
    apiPost("/api/my/providers/follow", { tenantId }).catch(() => { /* not signed in yet */ });
  }, [tenantId, embedded]);

  useEffect(() => {
    if (!embedded) return;
    return startEmbedHeightReports();
  }, [embedded]);

  if (error)
    return <div className="flex min-h-[40vh] items-center justify-center bg-[#f4f7ff] p-6 text-[13px] text-[#e21d27]">{error}</div>;
  if (!listings)
    return <div className="flex min-h-[40vh] items-center justify-center bg-[#f4f7ff] text-[13px] text-[#8a86a3]">{t("p7pub.loadingWord")}</div>;

  const provider = settings.providerName.trim() || listings[0]?.tenantName || t("p7pub.ourActivities");
  // The provider's own branding (Setup → Branding / Money): logo in the header,
  // accent on the eyebrow, top rule and Book buttons. Unset (or the stock
  // blue, which is what defaults fill in) = the page's own blues.
  const accent = ready && settings.brandColor?.toLowerCase() !== DEFAULT_SETTINGS.brandColor?.toLowerCase() ? brandAccent(settings.brandColor) : null;
  const logo = brandLogo(settings);

  return (
    <div className={`${embedded ? "" : "min-h-screen "}bg-[#f4f7ff] pb-16`}>
      {accent && <div className="h-1" style={{ background: accent.bg }} />}
      <div className="mx-auto max-w-[1080px] px-4 pt-6">
        <div className="mb-4 flex items-center gap-3">
          {logo && (
            <img src={logo} alt={t("p7pub.logoAlt", { name: provider })} className="h-12 w-12 flex-none rounded-xl border border-[#e8edf7] bg-white object-contain p-1" />
          )}
          <div className="min-w-0">
            <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#2f6bd8]" style={accent ? { color: accent.text } : undefined}>
              {t("p8lst.spBookWith", { provider })}
            </div>
            <h1 className="text-[26px] font-extrabold tracking-[-0.02em] text-[#171534]" style={{ color: "#171534" }}>
              {t("p8lst.spHeading")}
            </h1>
          </div>
        </div>
        {listings.length === 0 ? (
          <div className="rounded-2xl border border-[#e8edf7] bg-white p-8 text-center text-[13px] text-[#8a86a3]">
            {t("p8lst.spNothingOpen")}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => {
              const hero = l.images?.[0];
              const passes = l.passes ?? [];
              const from = passes.length ? Math.min(...passes.map((p) => p.price)) : null;
              // The real first and last session dates (same as Browse), not the listing's recipe dates.
              const blockDates = (l.blocks ?? []) as { startDate?: string; endDate?: string }[];
              const first = blockDates.map((b) => b.startDate).filter(Boolean).sort()[0];
              const last = blockDates.map((b) => b.endDate).filter(Boolean).sort().at(-1);
              const runFrom = fmtDate(first ?? l.runFrom);
              const runTo = fmtDate(last ?? l.runTo);
              const offers = ((l as { offers?: { label: string }[] }).offers ?? []).slice(0, 2);
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
                      {runFrom && runTo ? `${runFrom} – ${runTo}` : t("p7pub.datesTbc")}
                      {spotsLeft > 0 && <span className="text-[#1d3a8f]" style={accent ? { color: accent.text } : undefined}>{" · "}{t("p7pub.placesAvailable")}</span>}
                    </div>
                    {offers.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {offers.map((o) => <span key={o.label} className="rounded-full bg-[#fdecea] px-2 py-0.5 text-[10.5px] font-bold text-[#b3261e]">🏷️ {o.label}</span>)}
                      </div>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[13px] font-extrabold text-[#171534]">
                        {from !== null ? t("p7pub.fromPrice", { amt: money(from) }) : ""}
                      </span>
                      <span className="rounded-full bg-[#3f78d8] px-3 py-1 text-[11.5px] font-bold text-white" style={accent ? { background: accent.bg, color: accent.ink } : undefined}>
                        {t("p7pub.bookArrow")}
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
