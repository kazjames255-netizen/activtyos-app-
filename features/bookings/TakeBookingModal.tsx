"use client";

import { useEffect, useState } from "react";
import { useBookingsStore } from "./store";
import { get as apiGet } from "@/lib/api";
import { BookingOnly, type ServerListing } from "@/features/listings/ListingWizard";
import { Pill, PillSelect } from "@/features/listings/FreelancerListingsApp";

// ─────────────────────────────────────────────────────────────────────────
// Take a booking — the same booking flow a parent gets, run by an operator.
//
// This used to be its own flat form: one child, one pass, whole block, and an
// amount the operator typed in. That could not express what the listings can
// (per-day passes, several children, add-ons, sibling discounts), and its
// hand-typed price was a second opinion on what a booking costs.
//
// So it renders the listing's own widget instead. Choose the listing here;
// everything past that — pass, timing, dates, who's coming, extras, payment —
// is the component the customer page uses, in operator mode. One flow, one
// price, no drift.
// ─────────────────────────────────────────────────────────────────────────

export function TakeBookingModal() {
  const show = useBookingsStore((s) => s.showCreate);
  const close = useBookingsStore((s) => s.close);
  const setShow = useBookingsStore.setState;

  // The list endpoint returns the listing docs and their blocks; only
  // /api/listings/:id embeds the bundle (passes and timings) and the library
  // (add-ons, venue). The widget needs both, so the dropdown is filled from
  // the list and the chosen one is fetched in full.
  type Row = {
    id: string; name: string; title?: string; status?: string; archived?: boolean;
    blockId?: string | null; blocks?: { startDate?: string }[];
    venueId?: string | null; categoryIds?: string[];
  };
  const [listings, setListings] = useState<Row[] | null>(null);
  // Venue and category names for the pills — the listing docs carry ids only.
  const [lib, setLib] = useState<{ venues?: { id: string; name: string }[]; categories?: { id: string; name: string }[] } | null>(null);
  const [q, setQ] = useState("");
  const [venue, setVenue] = useState("");
  const [cat, setCat] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [id, setId] = useState("");
  // One piece of state, not three: which listing is loaded, and whether the
  // one being asked for has arrived. Setting "loading" and clearing "full"
  // synchronously in the effect cascaded a render before the fetch even began.
  const [full, setFull] = useState<ServerListing | null>(null);

  useEffect(() => {
    if (!show || listings) return;
    // ?mine=1 — the operator's own listings. Without it this is the public
    // browse feed, i.e. every provider on the platform, and you could take a
    // booking on somebody else's listing.
    apiGet<Row[]>("/api/listings?mine=1")
      .then((all) => {
        // Only what can actually be booked: live, not archived, with a pricing
        // block and dated runs. A draft with no block renders the widget's
        // "pick a block in Tickets & pricing" dead end, which is a listing
        // problem the operator can do nothing about from here.
        const ls = all.filter((l) =>
          !l.archived && (l.status ?? "live") === "live" && !!l.blockId && (l.blocks?.length ?? 0) > 0);
        setListings(ls);
        if (ls.length) setId(ls[0].id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load your listings"));
  }, [show, listings]);

  useEffect(() => {
    if (!show || lib) return;
    apiGet<{ venues?: { id: string; name: string }[]; categories?: { id: string; name: string }[] }>("/api/library")
      .then(setLib)
      .catch(() => setLib({}));  // the pills just don't appear
  }, [show, lib]);

  // Same three controls as the Listings tab, for the same reason: a provider
  // with forty listings can't find one in a dropdown.
  const countBy = (pick: (r: Row) => boolean) => (listings ?? []).filter(pick).length;
  const venueOpts = (lib?.venues ?? [])
    .map((v) => ({ ...v, n: countBy((r) => r.venueId === v.id) })).filter((v) => v.n > 0);
  const catOpts = (lib?.categories ?? [])
    .map((c) => ({ ...c, n: countBy((r) => (r.categoryIds ?? []).includes(c.id)) })).filter((c) => c.n > 0);
  const query = q.trim().toLowerCase();
  const shown = (listings ?? []).filter((l) => {
    if (query && !`${l.title ?? ""} ${l.name}`.toLowerCase().includes(query)) return false;
    if (venue && l.venueId !== venue) return false;
    if (cat && !(l.categoryIds ?? []).includes(cat)) return false;
    return true;
  });

  // A filter that hides the chosen listing selects the first one still
  // visible, rather than leaving the dropdown blank with the old listing's
  // widget underneath it.
  const activeId = shown.some((l) => l.id === id) ? id : (shown[0]?.id ?? "");
  // Derived, not a third piece of state: setting a "loading" flag inside the
  // effect cascaded a render before the fetch had even begun.
  const loading = !!activeId && !error && full?.id !== activeId;

  useEffect(() => {
    if (!activeId) return;
    let alive = true;
    apiGet<ServerListing>(`/api/listings/${encodeURIComponent(activeId)}`)
      .then((l) => { if (alive) { setFull(l); setError(null); } })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : "Couldn't load that listing"); });
    return () => { alive = false; };
  }, [activeId]);

  if (!show) return null;

  const dismiss = () => {
    setShow({ showCreate: false });
    close();
  };

  return (
    // The Bookings page runs the light palette its neighbours use; this modal
    // deliberately doesn't inherit it. It carries the booking widget, which is
    // built for the dark customer-page themes — on white it read as a bright
    // slab dropped into the page.
    <div
      onClick={(e) => e.target === e.currentTarget && dismiss()}
      className="fixed inset-0 z-[9999] flex items-start justify-center overflow-auto bg-black/55 px-3.5 py-8"
      style={
        {
          "--bg": "#0f1115",
          "--surface": "#181a21",
          "--panel": "#21242e",
          "--ink": "#f2f4f8",
          "--ink-2": "#aeb3c2",
          "--ink-3": "#787e8e",
          "--line": "#2a2e39",
        } as React.CSSProperties
      }
    >
      <div className="w-full max-w-[1100px] rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-[22px] py-5 text-[var(--ink)] shadow-[0_24px_60px_rgba(0,0,0,.5)]">
        <div className="mb-2 flex items-center gap-2.5">
          <h3 className="m-0 font-[var(--ff-display)] text-[18px] font-extrabold">Take a booking</h3>
          <span onClick={dismiss} className="ml-auto cursor-pointer text-[22px] text-[var(--ink-3)]">×</span>
        </div>
        <div className="mb-3 text-[11.5px] leading-[1.5] text-[var(--ink-2)]">
          A phone booking, on the same screen a parent sees. We&rsquo;ll <b>email them a payment
          link</b>; it sits as <b>Invoice sent</b> until they pay.
        </div>

        {error && <div className="mb-3 text-[12.5px] text-[var(--red)]">{error}</div>}

        <div className="text-[11.5px] font-bold text-[var(--ink)]">Which listing?</div>

        {(listings?.length ?? 0) > 1 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[160px] flex-1 sm:max-w-[240px]">
              <svg viewBox="0 0 16 16" fill="none" className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ink-3)] opacity-60">
                <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.7" /><path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search listings…"
                className="h-8 w-full rounded-full border border-[var(--line)] bg-[var(--panel)] pl-[32px] pr-3 text-[12.5px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-2)] focus:border-[var(--brand-2)]" />
            </div>
            {venueOpts.length > 0 && (
              <Pill active={!!venue} onClear={() => setVenue("")}>
                <PillSelect active={!!venue} value={venue} onChange={setVenue} title="Filter by location"
                  options={[["", "Location"], ...venueOpts.map((v) => [v.id, `${v.name} (${v.n})`] as [string, string])]} />
              </Pill>
            )}
            {catOpts.length > 0 && (
              <Pill active={!!cat} onClear={() => setCat("")}>
                <PillSelect active={!!cat} value={cat} onChange={setCat} title="Filter by category"
                  options={[["", "Category"], ...catOpts.map((c) => [c.id, `${c.name} (${c.n})`] as [string, string])]} />
              </Pill>
            )}
            {(q || venue || cat) && (
              <button type="button" onClick={() => { setQ(""); setVenue(""); setCat(""); }}
                className="h-8 px-1 text-[11.5px] font-semibold text-[var(--ink-3)] hover:text-[var(--ink)] hover:underline">Reset</button>
            )}
          </div>
        )}

        <select
          value={activeId}
          onChange={(e) => setId(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[13px] text-[var(--ink)] outline-none"
        >
          {shown.map((l) => (
            <option key={l.id} value={l.id}>{l.title || l.name}</option>
          ))}
        </select>
        {(listings?.length ?? 0) > 0 && shown.length === 0 && (
          <div className="mt-1.5 text-[11.5px] text-[var(--ink-3)]">
            No listing matches those filters.
          </div>
        )}

        {(!listings || loading) && !error && (
          <div className="mt-3 text-[12.5px] text-[var(--ink-3)]">Loading…</div>
        )}
        {listings?.length === 0 && (
          <div className="mt-3 text-[12.5px] leading-[1.5] text-[var(--ink-3)]">
            Nothing bookable yet. A listing shows up here once it&rsquo;s published and has its
            dates and pricing set — Tickets &amp; pricing in the listing builder.
          </div>
        )}

        {full?.id === activeId && (
          <div className="mt-3">
            <BookingOnly key={full.id} listing={full} />
          </div>
        )}
      </div>
    </div>
  );
}
