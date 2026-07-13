"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { money } from "@/features/bookings/helpers";
import type { Booking } from "@/features/bookings/types";
import { Button, Card, FieldLabel, Input, Select } from "@/components/ui";
import type { CreateMyBookingInput, ListingSummary } from "./types";

const METHODS = ["Card", "Tax-Free Childcare"];

function BookForm({ listing, onDone }: { listing: ListingSummary; onDone: () => void }) {
  const router = useRouter();
  const [child, setChild] = useState("");
  const [age, setAge] = useState("");
  const [pass, setPass] = useState(listing.passes[0]?.name ?? "");
  const [dates, setDates] = useState(listing.blocks[0] ?? "");
  const [method, setMethod] = useState(METHODS[0]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const price = listing.passes.find((p) => p.name === pass)?.price ?? 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const input: CreateMyBookingInput = {
        listingId: listing.id,
        pass,
        dates,
        child,
        age: parseInt(age, 10) || 0,
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
          <Select value={dates} onChange={(e) => setDates(e.target.value)} className="w-full">
            {listing.blocks.map((b) => (
              <option key={b}>{b}</option>
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
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    apiGet<ListingSummary[]>("/api/listings")
      .then(setListings)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load activities"));
  }, []);

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
          return (
            <Card key={l.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[15.5px] font-extrabold">{l.name}</div>
                  <div className="mt-0.5 text-[12px] text-[var(--ink-3)]">
                    by <span className="font-bold text-[var(--ink-2)]">{l.tenantName}</span> ·{" "}
                    {l.blocks.length} block{l.blocks.length === 1 ? "" : "s"} · from {money(from)}
                  </div>
                </div>
                {openId !== l.id && (
                  <Button variant="primary" onClick={() => setOpenId(l.id)}>
                    Book
                  </Button>
                )}
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
              {openId === l.id && <BookForm listing={l} onDone={() => setOpenId(null)} />}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
