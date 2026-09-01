"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiPublic } from "@/lib/api";
import { firebaseAuth } from "@/lib/firebase/client";
import { CustomerPage, type ServerListing } from "@/features/listings/ListingWizard";

// ─────────────────────────────────────────────────────────────────────────
// /book/{id} — the provider's public storefront page. Renders the exact
// customer page the operator designed (same component, same server data)
// with the real parent checkout underneath. Browsable signed out; the
// checkout asks for sign-in only when it's time to book.
// ─────────────────────────────────────────────────────────────────────────

export function BookPage({ id }: { id: string }) {
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
  // Arrived from an embedded storefront grid — offer the way back.
  const fromStore = sp.get("from") === "store";
  // ?preview=1 — the operator opened this from "View as parent". Show the exact
  // storefront, but with a "Preview" bar instead of the parent-portal nav (My
  // home page / My bookings / Back to activities), so a provider previewing
  // isn't handed links that drop them into the parent app.
  const preview = sp.get("preview") === "1";

  useEffect(() => {
    apiPublic<ServerListing>(`/api/listings/${encodeURIComponent(id)}`)
      .then(setListing)
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn’t load this listing"));
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
          <div className="text-[16px] font-extrabold text-[#171534]">This listing isn’t available</div>
          <p className="mt-1 text-[13px] text-[#8a86a3]">{error}</p>
          <Link href="/" className="mt-3 inline-block text-[13px] font-bold text-[#2f6bd8] underline">
            ActivityOS home
          </Link>
        </div>
      </div>
    );
  if (!listing)
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f7ff] text-[13px] text-[#8a86a3]">
        Loading…
      </div>
    );

  // Header links live INSIDE the storefront's own (black/branded) header bar, so
  // the page is full-bleed with no light edge around it.
  // Colour is set by each storefront theme (white on the dark page, blue on the
  // light one) via a [&_a] wrapper — so the links stay legible on both.
  // Styled to match the storefront's own nav — bold, uppercase, tracked, no
  // underline — inheriting the page font from the header wrapper.
  const linkCls = "text-[11.5px] font-extrabold uppercase tracking-[0.05em] transition-opacity hover:opacity-70";
  // In preview, the provider gets a single "Close" affordance, never parent nav.
  const topRight = preview ? (
    <button type="button" onClick={() => window.close()} className={linkCls}>Close preview ✕</button>
  ) : signedIn === false ? (
    // Inside an embed, keep ?embed=1 through the sign-in round trip.
    <Link href={`/login?next=${encodeURIComponent(`/book/${id}${embedded ? "?embed=1" : ""}`)}`} className={linkCls}>Sign in</Link>
  ) : signedIn && !embedded ? (
    // Not shown in embeds — navigating a provider's iframe into the dashboard
    // would trap the parent page's visitor.
    <span className="flex items-center gap-4">
      <Link href="/custdash/browse" className={linkCls}>← Back to activities</Link>
      <Link href="/custdash" className={linkCls}>My home page</Link>
      <Link href="/custdash/bookings" className={linkCls}>My bookings</Link>
    </span>
  ) : null;

  return (
    <div className="min-h-screen pb-16">
      {preview && (
        // Provider-only bar; parents never see this. Distinct amber so it reads
        // as "preview chrome", not part of the storefront.
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 bg-[#fef3c7] px-4 py-2 text-center text-[12.5px] font-semibold text-[#92400e]">
          <span>👁 Preview — this is exactly what a parent sees. This bar isn’t shown to them.</span>
          <button type="button" onClick={() => window.close()} className="font-extrabold underline">Close</button>
        </div>
      )}
      {embedded && fromStore && (
        <div className="px-4 pt-3 text-[12.5px]">
          <button type="button" onClick={() => window.history.back()} className="font-bold text-[#2f6bd8] underline">← All activities</button>
        </div>
      )}
      <CustomerPage listing={listing} topRight={topRight} />
      <div id="book"></div>
    </div>
  );
}
