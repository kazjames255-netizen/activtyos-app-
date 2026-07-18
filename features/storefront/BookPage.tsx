"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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

  useEffect(() => {
    apiPublic<ServerListing>(`/api/listings/${encodeURIComponent(id)}`)
      .then(setListing)
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn’t load this listing"));
  }, [id]);
  useEffect(() => firebaseAuth.onAuthStateChanged((u) => setSignedIn(!!u)), []);

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

  return (
    <div className="min-h-screen bg-[#f4f7ff] pb-16">
      <div className="mx-auto flex max-w-[1040px] items-center justify-between px-4 pb-1 pt-4 text-[12.5px]">
        <span className="font-bold text-[#4a4763]">{listing.tenantName}</span>
        {signedIn === false ? (
          <Link href={`/login?next=/book/${encodeURIComponent(id)}`} className="font-bold text-[#2f6bd8] underline">
            Sign in
          </Link>
        ) : signedIn ? (
          <Link href="/custdash/bookings" className="font-bold text-[#2f6bd8] underline">
            My bookings
          </Link>
        ) : null}
      </div>
      <div className="mx-auto max-w-[1040px] px-4">
        <CustomerPage listing={listing} />
        <div className="mt-5" id="book"></div>
      </div>
    </div>
  );
}
