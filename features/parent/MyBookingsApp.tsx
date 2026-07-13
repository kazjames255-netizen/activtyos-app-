"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { money, payLabel, payTone, statusTone } from "@/features/bookings/helpers";
import type { Booking } from "@/features/bookings/types";
import { Badge, Button, Card, DefRow, SectionHead } from "@/components/ui";

function CancelRequest({ booking, onDone }: { booking: Booking; onDone: () => void }) {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await apiPost<Booking>(`/api/my/bookings/${encodeURIComponent(booking.ref)}/cancel`, {
        msg: msg.trim() || undefined,
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] p-3">
      <div className="mb-1.5 text-[12.5px] font-bold text-[var(--red,#e21d27)]">
        Request cancellation
      </div>
      <textarea
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        placeholder="Tell the provider why (optional)…"
        rows={2}
        className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] text-[var(--ink)] outline-none"
      />
      {error && <div className="mt-1 text-[12px] text-[var(--red)]">{error}</div>}
      <div className="mt-2 flex gap-2">
        <Button variant="danger" sm onClick={submit} disabled={busy}>
          {busy ? "Sending…" : "Send cancellation request"}
        </Button>
      </div>
      <div className="mt-1.5 text-[11px] text-[var(--ink-3)]">
        The provider reviews your request and decides the refund under their
        cancellation policy.
      </div>
    </div>
  );
}

function BookingCard({ b, refresh }: { b: Booking; refresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const cancelled = b.status === "Cancelled" || b.status === "Declined";

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-[14.5px] font-extrabold">{b.listing}</div>
          <div className="mt-0.5 text-[12px] text-[var(--ink-3)]">
            {b.child} · {b.pass} · {b.dates} · Ref {b.ref}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Badge tone={statusTone(b.status)}>{b.status}</Badge>
          {b.cancel?.refund === "pending" && (
            <Badge tone={{ bg: "var(--red-soft,#fdebec)", fg: "#bb1620" }}>Refund pending</Badge>
          )}
          <Badge tone={payTone(b.pay)}>{payLabel(b.pay)}</Badge>
          <span className="ml-1 text-[14px] font-extrabold">{money(b.amount)}</span>
        </div>
      </div>

      <div className="mt-2 flex gap-2">
        <Button sm onClick={() => setExpanded((x) => !x)}>
          {expanded ? "Hide details" : "Details"}
        </Button>
        {!cancelled && (
          <Button sm variant="cta" onClick={() => setCancelling((x) => !x)}>
            Cancel booking…
          </Button>
        )}
      </div>

      {expanded && (
        <div className="mt-2">
          <SectionHead>Sessions</SectionHead>
          {(b.sessions || []).map((s, i) => (
            <div key={i} className="border-b border-dashed border-[var(--line)] py-[4px] text-[12.5px]">
              {s}
            </div>
          ))}
          <SectionHead>Payment</SectionHead>
          <DefRow label="Method" value={b.method} />
          <DefRow label="Total" value={money(b.amount)} />
          {b.cancel && (
            <>
              <SectionHead>Cancellation</SectionHead>
              <DefRow label="Requested" value={b.cancel.on} />
              <DefRow label="Refund" value={b.cancel.refund ?? "—"} />
              {b.cancel.msg && <DefRow label="Message" value={b.cancel.msg} />}
            </>
          )}
        </div>
      )}

      {cancelling && !cancelled && (
        <CancelRequest
          booking={b}
          onDone={() => {
            setCancelling(false);
            refresh();
          }}
        />
      )}
    </Card>
  );
}

/** custdash/bookings — the signed-in parent's own bookings. */
export function MyBookingsApp() {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    apiGet<Booking[]>("/api/my/bookings")
      .then(setBookings)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load bookings"));
  }, []);

  useEffect(refresh, [refresh]);

  if (error) return <div className="p-2 text-[12.5px] text-[var(--red)]">{error}</div>;
  if (!bookings)
    return <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading your bookings…</div>;

  return (
    <div className="text-[var(--ink)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
            My bookings
          </h2>
          <p className="text-[12.5px] text-[var(--ink-3)]">
            Your family’s places — status updates as the provider confirms.
          </p>
        </div>
        <Link href="/custdash/browse">
          <Button variant="primary">+ Book an activity</Button>
        </Link>
      </div>
      {bookings.length === 0 ? (
        <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">
          No bookings yet —{" "}
          <Link href="/custdash/browse" className="font-bold text-[var(--brand-2)]">
            browse activities
          </Link>{" "}
          to get started.
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {bookings.map((b) => (
            <BookingCard key={`${b.tenantId}-${b.ref}`} b={b} refresh={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}
