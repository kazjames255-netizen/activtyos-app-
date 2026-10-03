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
import { brandAccent, brandLogo, brandVars } from "@/lib/brand-theme";

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
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  // ?embed=1 = we're inside a provider's website via public/embed.js:
  // hide the ActivityOS chrome and report our height to the parent so
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
  // The listing's provider's public settings — for their logo + brand colour.
  const { settings, ready } = useTenantSettings(listing?.tenantId);

  useEffect(() => {
    apiPublic<ServerListing>(`/api/listings/${encodeURIComponent(id)}`)
      .then((l) => { setListing(l); if (embedded) window.parent?.postMessage({ type: "activityos:debug", kind: "listing", msg: "listing loaded" }, "*"); })
      .catch((e) => { setError(e instanceof Error ? e.message : t("p7pub.errLoadListing")); if (embedded) window.parent?.postMessage({ type: "activityos:debug", kind: "listing-error", msg: String(e?.message ?? e) }, "*"); });
  }, [id]);
  useEffect(() => firebaseAuth.onAuthStateChanged((u) => setSignedIn(!!u)), []);
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
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f7ff] p-6">
        <div className="max-w-[420px] rounded-2xl border border-[#e8edf7] bg-white p-6 text-center">
          <div className="text-[16px] font-extrabold text-[#171534]">{t("p7pub.listingNA")}</div>
          <p className="mt-1 text-[13px] text-[#8a86a3]">{error}</p>
          <Link href="/" className="mt-3 inline-block text-[13px] font-bold text-[#2f6bd8] underline">
            {t("p7pub.homeLink")}
          </Link>
        </div>
      </div>
    );
  if (!listing)
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f7ff] text-[13px] text-[#8a86a3]">
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
    <Link href={`/login?next=${encodeURIComponent(`/book/${id}${embedded ? "?embed=1" : ""}`)}`} onClick={keepBasketForAuth} className={linkCls}>{t("p7pub.signIn")}</Link>
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
    <div className="min-h-screen pb-16" style={brandVars(picked) as React.CSSProperties}>
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
      <CustomerPage listing={listing} topRight={topRight} logo={brandLogo(settings)} />
      <div id="book"></div>
    </div>
  );
}
