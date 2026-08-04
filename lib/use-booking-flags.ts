"use client";

import { useCallback, useEffect, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import type { PortalKey } from "@/lib/nav/config";
import type { Booking } from "@/features/bookings/types";

export interface BookingFlags {
  /** How many bookings need attention — the number on the Bookings tab. */
  count: number;
  /** Human breakdown for the hover tooltip ("2 to approve · 1 to pay"). */
  tip: string;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Booking-area flags surfaced as a badge on the Bookings tab:
 *  · Operator — new bookings to approve, date/time changes to review,
 *    cancellations/refunds to review, and failed card payments.
 *  · Parent  — their bookings still to pay.
 * Live: refreshes on the realtime `bookings` channel.
 */
export function useBookingFlags(portal: PortalKey): BookingFlags {
  const [flags, setFlags] = useState<BookingFlags>({ count: 0, tip: "" });

  const load = useCallback(() => {
    const url = portal === "custdash" ? "/api/my/bookings" : "/api/bookings";
    apiGet<Booking[]>(url)
      .then((bs) => {
        const live = bs.filter((b) => b.status !== "Cancelled" && b.status !== "Declined");
        if (portal === "custdash") {
          const toPay = live.filter((b) => b.pay !== "Paid" && (b.amount ?? 0) > 0).length;
          setFlags(toPay ? { count: toPay, tip: `${plural(toPay, "booking")} to pay` } : { count: 0, tip: "" });
          return;
        }
        const approve = bs.filter((b) => b.status === "Approval needed").length;
        const change = live.filter((b) => b.dateChangeRequest?.status === "pending").length;
        const cancel = bs.filter((b) => b.cancel?.refund === "pending").length;
        const card = live.filter((b) => b.cardFailed).length;
        const parts = [
          approve && `${plural(approve, "booking")} to approve`,
          change && `${plural(change, "date/time change")} to review`,
          cancel && `${plural(cancel, "cancellation")} to review`,
          card && `${plural(card, "card payment")} failed`,
        ].filter(Boolean).join(" · ");
        setFlags({ count: approve + change + cancel + card, tip: parts });
      })
      .catch(() => {});
  }, [portal]);

  useEffect(() => { load(); }, [load]);
  useRealtime(["bookings"], load);
  return flags;
}
