"use client";

import { useT } from "@/lib/i18n/provider";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiPublic } from "@/lib/api";
import { firebaseAuth } from "@/lib/firebase/client";
import { CustomerPage, type ServerListing } from "@/features/listings/ListingWizard";
import { confirmLeavingBasket, keepBasketForAuth } from "@/features/listings/booking";
import { DEFAULT_SETTINGS, useTenantSettings } from "@/lib/settings";
import { startEmbedHeightReports } from "@/lib/embedHeight";
import { brandAccent, brandLogo, brandVars } from "@/lib/brand-theme";
import { listingLinkKindOf, listingLinkPath } from "@/lib/listingLinks";

// ─────────────────────────────────────────────────────────────────────────
// /book/{id} — the provider's public storefront page. Renders the exact
// customer page the operator designed (same component, same server data)
// with the real parent checkout underneath. Browsable signed out; the
// checkout asks for sign-in only when it's time to book.
// ─────────────────────────────────────────────────────────────────────────

export function BookPage({ id }: { id: string }) {
  const t = useT();
  const [listing, setListing] = useState<ServerListing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  // A home-visit listing the family's saved postcode is outside of: the API answers 404 + code "out_of_area" (provider name, the family's own district).
  const [outOfArea, setOutOfArea] = useState<{ provider: string; tenantId?: string; district: string } | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  // ?embed=1 = we're inside a provider's website via public/embed.js:
  // hide the Name TBC chrome and report our height to the parent so
  // inline embeds size themselves. useSearchParams (not a one-shot read):
  // client-side navigations from an embedded storefront mount this page
  // before window.location settles.
  const sp = useSearchParams();
  const embedded = sp.has("embed");
  // Inside a provider's website we cannot be inspected from outside, so report
  // what went wrong (errors, never data) to the embedding page's console.
  useEffect(() => {
    if (!embedded) return;
    const send = (kind: string, msg: unknown) => window.parent?.postMessage({ type: "activityos:debug", kind, msg: String(msg).slice(0, 300) }, "*");
    const onErr = (e: ErrorEvent) => send("error", e.message);
    const onRej = (e: PromiseRejectionEvent) => send("rejection", (e.reason as { message?: string })?.message ?? e.reason);
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    send("mounted", "book page mounted");
    // A few seconds of what the page has actually drawn.
    let n = 0;
    const beat = setInterval(() => {
      const b = document.body;
      send("beat", `h=${b.scrollHeight} text=${b.innerText.length} imgs=${document.images.length} bg=${getComputedStyle(b).backgroundColor} op=${getComputedStyle(b).opacity} vis=${document.visibilityState}`);
      if (++n >= 5) clearInterval(beat);
    }, 2000);
    return () => { clearInterval(beat); window.removeEventListener("error", onErr); window.removeEventListener("unhandledrejection", onRej); };
  }, [embedded]);
  // Arrived from an embedded storefront grid — offer the way back.
  const fromStore = sp.get("from") === "store";
  // ?preview=1 — the operator opened this from "View as parent". Show the exact
  // storefront, but with a "Preview" bar instead of the parent-portal nav (My
  // home page / My bookings / Back to activities), so a provider previewing
  // isn't handed links that drop them into the parent app.
  const preview = sp.get("preview") === "1";
  // ?quick=1 — the QUICK BOOK link: straight to the booking form (no sales page). Same sign-in rules as the storefront link.
  const quick = listingLinkKindOf(sp) === "quick";
  // Where a sign-in / create-account round trip must come back to: the SAME link (quick flag and embed flag kept).
  const nextPath = listingLinkPath(id, quick ? "quick" : "storefront", { embed: embedded });
  // The listing's provider's public settings — for their logo + brand colour.
  const { settings, ready } = useTenantSettings(listing?.tenantId, listing?.id);

  useEffect(() => {
    apiPublic<ServerListing>(`/api/listings/${encodeURIComponent(id)}`)
      .then((l) => { setListing(l); if (embedded) window.parent?.postMessage({ type: "activityos:debug", kind: "listing", msg: "listing loaded" }, "*"); })
      .catch((e) => { setNotFound((e as { status?: number })?.status === 404); const b = (e as { body?: { code?: string; provider?: { name?: string; tenantId?: string }; district?: string } })?.body; if (b?.code === "out_of_area") setOutOfArea({ provider: b.provider?.name || "", tenantId: b.provider?.tenantId, district: b.district || "" }); setError(e instanceof Error ? e.message : t("p7pub.errLoadListing")); if (embedded) window.parent?.postMessage({ type: "activityos:debug", kind: "listing-error", msg: String(e?.message ?? e) }, "*"); });
  }, [id]);
  const [gateDismissed, setGateDismissed] = useState(false);
  useEffect(() => firebaseAuth.onAuthStateChanged((u) => setSignedIn(!!u)), []);
  useEffect(() => {
    if (!embedded) return;
    return startEmbedHeightReports();
  }, [embedded]);

  if (error && outOfArea) {
    const prov = outOfArea.provider || t("p7cl.theProvider");
    return (
      <div className={`${embedded ? "" : "min-h-screen "}flex items-center justify-center bg-[#f4f7ff] p-6`}>
        <div className="max-w-[460px] rounded-2xl border border-[#e8edf7] bg-white p-6 text-center">
          <div className="text-[18px] font-extrabold text-[#171534]">{t("p7pub.areaTitle", { provider: prov })}</div>
          <p className="mt-2 text-[13.5px] leading-[1.5] text-[#4a4763]">{t("p7pub.areaBody", { provider: prov, district: outOfArea.district || "your area" })}</p>
          {!embedded && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Link href="/custdash/browse" className="rounded-xl bg-[#2f6bd8] px-4 py-2 text-[13px] font-bold text-white">{t("p7pub.areaBrowse")}</Link>
              {outOfArea.tenantId && <Link href={`/custdash/messages?compose=1&tenant=${encodeURIComponent(outOfArea.tenantId)}`} className="rounded-xl border border-[#dbe0ec] bg-white px-4 py-2 text-[13px] font-bold text-[#4a4763]">{t("p7pub.areaMessage", { provider: prov })}</Link>}
            </div>
          )}
        </div>
      </div>
    );
  }
  if (error) {
    // A listing that is not live (draft, ended, unpublished) answers 404: say so kindly instead of "not found", and inside a provider's
    // website never offer a link to the platform's home page (it would navigate their visitor out of the embed).
    const notOpen = notFound;
    return (
      <div className={`${embedded ? "" : "min-h-screen "}flex items-center justify-center bg-[#f4f7ff] p-6`}>
        <div className="max-w-[420px] rounded-2xl border border-[#e8edf7] bg-white p-6 text-center">
          <div className="text-[16px] font-extrabold text-[#171534]">{notOpen ? t("p7pub.listingNotOpenTitle") : t("p7pub.listingNA")}</div>
          <p className="mt-1 text-[13px] text-[#8a86a3]">{notOpen ? t("p7pub.listingNotOpenBody") : error}</p>
          {!embedded && (
            <Link href="/" className="mt-3 inline-block text-[13px] font-bold text-[#2f6bd8] underline">
              {t("p7pub.homeLink")}
            </Link>
          )}
        </div>
      </div>
    );
  }
  if (!listing)
    return (
      <div className={`${embedded ? "min-h-[40vh] " : "min-h-screen "}flex items-center justify-center bg-[#f4f7ff] text-[13px] text-[#8a86a3]`}>
        {t("p7pub.loadingWord")}
      </div>
    );

  // Header links live INSIDE the storefront's own (black/branded) header bar, so
  // the page is full-bleed with no light edge around it.
  // Colour is set by each storefront theme (white on the dark page, blue on the
  // light one) via a [&_a] wrapper — so the links stay legible on both.
  // Styled to match the storefront's own nav — bold, uppercase, tracked, no
  // underline — inheriting the page font from the header wrapper.
  const linkCls = "text-[11.5px] font-extrabold uppercase tracking-[0.05em] transition-opacity hover:opacity-70";
  // Every link off this page is a real navigation to a different route, which
  // unmounts the booking widget below and throws away whatever's in its
  // basket with no chance to recover it — warn first rather than staying
  // silent about it (item 68, docs/amir-backend-outstanding.md).
  const guardNav = (e: React.MouseEvent) => { if (!confirmLeavingBasket()) e.preventDefault(); };
  // In preview, the provider gets a single "Close" affordance, never parent nav.
  const topRight = preview ? (
    <button type="button" onClick={() => window.close()} className={linkCls}>{t("p7pub.closePreview")}</button>
  ) : signedIn === false ? (
    // Inside an embed, keep ?embed=1 through the sign-in round trip.
    <Link href={`/login?next=${encodeURIComponent(nextPath)}`} onClick={keepBasketForAuth} className={linkCls}>{t("p7pub.signIn")}</Link>
  ) : signedIn && !embedded ? (
    // Not shown in embeds — navigating a provider's iframe into the dashboard
    // would trap the parent page's visitor.
    <span className="flex items-center gap-4">
      <Link href="/custdash/browse" onClick={guardNav} className={linkCls}>{t("p7pub.backToActivities")}</Link>
      <Link href="/custdash" onClick={guardNav} className={linkCls}>{t("p7pub.myHomePage")}</Link>
      <Link href="/custdash/bookings" onClick={guardNav} className={linkCls}>{t("p7nav.my_bookings")}</Link>
    </span>
  ) : null;

  // Provider branding: logo in the storefront header; the accent as a top rule
  // and on the --brand-* surfaces below (checkout confirmation buttons etc.),
  // scoped to this page. Unset / the stock blue = the page's own colours.
  const picked = ready && settings.brandColor?.toLowerCase() !== DEFAULT_SETTINGS.brandColor?.toLowerCase() ? settings.brandColor : null;
  const accent = brandAccent(picked);

  return (
    <div className={`${embedded ? "" : "min-h-screen "}pb-16`} style={brandVars(picked) as React.CSSProperties}>
      {accent && <div className="h-1" style={{ background: accent.bg }} />}
      {preview && (
        // Provider-only bar; parents never see this. Distinct amber so it reads
        // as "preview chrome", not part of the storefront.
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 bg-[#fef3c7] px-4 py-2 text-center text-[12.5px] font-semibold text-[#92400e]">
          <span>{t("p7pub.previewBar")}</span>
          <button type="button" onClick={() => window.close()} className="font-extrabold underline">{t("p7pub.closeWord")}</button>
        </div>
      )}
      {embedded && fromStore && (
        <div className="px-4 pt-3 text-[12.5px]">
          <button type="button" onClick={() => { if (confirmLeavingBasket()) window.history.back(); }} className="font-bold text-[#2f6bd8] underline" style={accent ? { color: accent.text } : undefined}>{t("p7pub.allActivities")}</button>
        </div>
      )}
      {signedIn === false && !embedded && !preview && !gateDismissed && (
        // Opened from a shared link (e.g. WhatsApp) while signed out: say so up front, or the family list looks empty and confusing.
        <div className="fixed inset-0 z-[500] flex items-end justify-center bg-black/50 p-3 sm:items-center" role="dialog" aria-modal="true">
          <div className="w-full max-w-[420px] rounded-2xl bg-white p-5 text-[#171534] shadow-2xl">
            <div className="text-[18px] font-extrabold">{t("p7pub.signInFirstTitle")}</div>
            <p className="mt-2 text-[14px] leading-snug text-[#4a4668]">{t("p7pub.signInFirstBody")}</p>
            <div className="mt-4 flex flex-col gap-2">
              {([["/login", "p7ck.signInBtn", true], ["/parent?tab=up&", "p7ck.createAccountBtn", false]] as const).map(([base, key, primary]) => (
                <button key={key} type="button" className="rounded-full border-2 border-[#2f6bd8] px-4 py-3 text-[14px] font-extrabold" style={primary ? { background: "#2f6bd8", color: "#fff" } : { color: "#2f6bd8" }}
                  onClick={() => {
                    keepBasketForAuth();
                    const here = encodeURIComponent(nextPath);
                    window.location.assign(`${base}${base.endsWith("&") ? "" : "?"}next=${here}${base.endsWith("&") && listing.tenantId ? `&provider=${encodeURIComponent(listing.tenantId)}` : ""}`);
                  }}>{t(key)}</button>
              ))}
              <button type="button" onClick={() => setGateDismissed(true)} className="py-1 text-[13px] font-bold text-[#8a86a3] underline">{t("p7pub.signInFirstLater")}</button>
            </div>
          </div>
        </div>
      )}
      {quick ? (
        // Quick book: a compact branded header, then only the booking flow (dates, children, pay).
        <div className="mx-auto max-w-[620px] px-3 pt-4">
          <div className="flex items-center justify-between gap-3 rounded-t-2xl px-4 py-3 text-white" style={{ background: "linear-gradient(120deg,var(--brand-strong,#1d3a8f) 0%,var(--brand-2,#2f6bd8) 100%)" }}>
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/70">{t("parent.quickBook")}</div>
              <div className="truncate text-[15px] font-extrabold">{listing.title || listing.name}</div>
              {listing.tenantName && <div className="truncate text-[11.5px] text-white/75">{listing.tenantName}</div>}
            </div>
            <span className="flex-none text-[12px] [&_a]:text-white">{topRight}</span>
          </div>
          <div className="rounded-b-2xl bg-[#f4f7ff] p-4 ring-1 ring-[#e3e9f5]">
            <CustomerPage listing={listing} bookingOnly logo={brandLogo(settings)} />
          </div>
        </div>
      ) : (
        <CustomerPage listing={listing} topRight={topRight} logo={brandLogo(settings)} />
      )}
      <div id="book"></div>
    </div>
  );
}
