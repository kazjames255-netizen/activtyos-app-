"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { money } from "@/features/bookings/helpers";
import type { Booking } from "@/features/bookings/types";
import { Button, Card, FieldLabel, Input, Select } from "@/components/ui";
import type { Child } from "./ChildrenApp";
import type { BlockSummary, CreateMyBookingInput, ListingSummary } from "./types";
import { CroppedImage, CustomerPage, type ServerListing } from "@/features/listings/ListingWizard";

const METHODS = ["Card", "Tax-Free Childcare"];
const MANUAL = "__manual__";

function BookForm({
  listing,
  savedChildren,
  onDone,
}: {
  listing: ListingSummary;
  savedChildren: Child[];
  onDone: () => void;
}) {
  const router = useRouter();
  const openBlocks = listing.blocks.filter((b) => b.open);
  const [childId, setChildId] = useState(savedChildren[0]?.id ?? MANUAL);
  const [child, setChild] = useState("");
  const [age, setAge] = useState("");
  const [pass, setPass] = useState(listing.passes[0]?.name ?? "");
  const [blockId, setBlockId] = useState(openBlocks[0]?.id ?? "");
  const [method, setMethod] = useState(METHODS[0]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const price = listing.passes.find((p) => p.name === pass)?.price ?? 0;
  const selected = savedChildren.find((c) => c.id === childId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const input: CreateMyBookingInput = {
        listingId: listing.id,
        pass,
        blockId,
        child: selected ? selected.name : child,
        age: selected ? (selected.age ?? 0) : parseInt(age, 10) || 0,
        method,
      };
      await apiPost<Booking>("/api/my/bookings", input);
      router.push("/custdash/bookings");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Booking failed");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 flex flex-col gap-2.5 border-t border-[var(--line)] pt-3">
      <div className="grid grid-cols-2 gap-2.5">
        {savedChildren.length > 0 && (
          <div className="col-span-2">
            <FieldLabel>Who&apos;s going?</FieldLabel>
            <Select value={childId} onChange={(e) => setChildId(e.target.value)} className="w-full">
              {savedChildren.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.age !== undefined ? ` (age ${c.age})` : ""}
                </option>
              ))}
              <option value={MANUAL}>Someone else…</option>
            </Select>
          </div>
        )}
        {(childId === MANUAL || savedChildren.length === 0) && (
          <>
            <div>
              <FieldLabel>Child name</FieldLabel>
              <Input required value={child} onChange={(e) => setChild(e.target.value)} className="w-full" />
            </div>
            <div>
              <FieldLabel>Child age</FieldLabel>
              <Input
                type="number"
                required
                min={0}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="w-full"
              />
            </div>
          </>
        )}
        <div>
          <FieldLabel>Pass</FieldLabel>
          <Select value={pass} onChange={(e) => setPass(e.target.value)} className="w-full">
            {listing.passes.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name} — {money(p.price)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <FieldLabel>Dates</FieldLabel>
          <Select value={blockId} onChange={(e) => setBlockId(e.target.value)} className="w-full">
            {openBlocks.map((b: BlockSummary) => (
              <option key={b.id} value={b.id}>
                {b.name} — {b.spotsLeft > 0 ? `${b.spotsLeft} place${b.spotsLeft === 1 ? "" : "s"} left` : "Full · join waitlist"}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <FieldLabel>How you’ll pay</FieldLabel>
          <Select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full">
            {METHODS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </Select>
        </div>
        <div className="flex items-end justify-end text-[15px] font-extrabold">
          Total: {money(price)}
        </div>
      </div>
      {error && <div className="text-[12.5px] text-[var(--red)]">{error}</div>}
      <div className="flex gap-2">
        <Button variant="primary" type="submit" disabled={busy}>
          {busy ? "Booking…" : "Confirm booking request"}
        </Button>
        <Button type="button" onClick={onDone}>
          Cancel
        </Button>
      </div>
      <div className="text-[11.5px] text-[var(--ink-3)]">
        Your place is held while the provider approves the booking. Payment is
        collected after approval.
      </div>
    </form>
  );
}

/** custdash/browse — parents browse the provider's listings and book. */
export function BrowseApp() {
  const [listings, setListings] = useState<ListingSummary[] | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  // The full customer page (GET /api/listings/:id — the same page the
  // operator previews, rendered from the same server data).
  const [page, setPage] = useState<ServerListing | null>(null);
  const [pageBusy, setPageBusy] = useState<string | null>(null);
  // Captured once per mount — the server enforces opensAt regardless.
  const [now] = useState(() => Date.now());

  const viewPage = (id: string) => {
    setPageBusy(id);
    apiGet<ServerListing>(`/api/listings/${encodeURIComponent(id)}`)
      .then(setPage)
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn’t open the listing"))
      .finally(() => setPageBusy(null));
  };

  const loadListings = useCallback(() => {
    apiGet<ListingSummary[]>("/api/listings")
      .then(setListings)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load activities"));
  }, []);

  useEffect(() => {
    loadListings();
    apiGet<Child[]>("/api/my/children")
      .then(setChildren)
      .catch(() => {
        /* booking still works with manual entry */
      });
  }, [loadListings]);
  useRealtime(["listings", "blocks"], loadListings);

  if (error) {
    return <div className="p-2 text-[12.5px] text-[var(--red)]">{error}</div>;
  }
  if (!listings) {
    return <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading activities…</div>;
  }

  return (
    <div className="text-[var(--ink)]">
      <h2 className="mb-1 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
        Browse activities
      </h2>
      <p className="mb-4 text-[12.5px] text-[var(--ink-3)]">
        Camps and clubs with places available — book directly from here.
      </p>
      <div className="grid gap-3.5 lg:grid-cols-2">
        {listings.map((l) => {
          const from = Math.min(...l.passes.map((p) => p.price));
          const hero = l.images?.[0];
          const opensLater = !!l.opensAt && new Date(l.opensAt).getTime() > now;
          return (
            <Card key={l.id} className="overflow-hidden p-0">
              {hero && (
                <button type="button" onClick={() => viewPage(l.id)} className="block h-[120px] w-full overflow-hidden" aria-label={`View ${l.name}`}>
                  <CroppedImage im={hero} className="h-full w-full" />
                </button>
              )}
              <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[15.5px] font-extrabold">{l.title || l.name}</div>
                  <div className="mt-0.5 text-[12px] text-[var(--ink-3)]">
                    by <span className="font-bold text-[var(--ink-2)]">{l.tenantName}</span> ·{" "}
                    {l.blocks.length} block{l.blocks.length === 1 ? "" : "s"} · from {money(from)}
                  </div>
                </div>
                <div className="flex flex-none items-center gap-1.5">
                  <Button onClick={() => viewPage(l.id)} disabled={pageBusy === l.id}>
                    {pageBusy === l.id ? "Opening…" : "View"}
                  </Button>
                  {opensLater ? (
                    <span className="rounded-full bg-[#fff7ed] px-2.5 py-[5px] text-[11px] font-bold text-[#9a3412]">
                      ⏰ Opens {new Date(l.opensAt!).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                    </span>
                  ) : (
                    openId !== l.id &&
                    l.blocks.some((b) => b.open) && (
                      <Button variant="primary" onClick={() => setOpenId(l.id)}>
                        Book
                      </Button>
                    )
                  )}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {l.passes.map((p) => (
                  <span
                    key={p.name}
                    className="rounded-full border border-[var(--line)] bg-[var(--panel)] px-2.5 py-[3px] text-[11px] font-bold text-[var(--ink-2)]"
                  >
                    {p.name} · {money(p.price)}
                  </span>
                ))}
              </div>
              {openId === l.id && (
                <BookForm listing={l} savedChildren={children} onDone={() => setOpenId(null)} />
              )}
              </div>
            </Card>
          );
        })}
      </div>

      {page && (
        <div onClick={(e) => e.target === e.currentTarget && setPage(null)} className="fixed inset-0 z-[10000] flex items-start justify-center overflow-auto bg-black/60 p-4 sm:p-6">
          <div className="w-full max-w-[1040px]">
            <div className="mb-2 flex items-center justify-between text-white">
              <span className="text-[13px] font-bold">{page.title || page.name} — {page.tenantName}</span>
              <button type="button" onClick={() => setPage(null)} aria-label="Close" className="text-[22px] leading-none">×</button>
            </div>
            <CustomerPage listing={page} />
            <div className="sticky bottom-3 mt-3 flex justify-center">
              {(() => {
                const summary = listings.find((x) => x.id === page.id);
                const bookable = summary?.blocks.some((b) => b.open) && !(page.opensAt && new Date(page.opensAt).getTime() > now);
                return bookable ? (
                  <Button variant="primary" onClick={() => { setOpenId(page.id); setPage(null); }}>
                    Book this activity
                  </Button>
                ) : null;
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
