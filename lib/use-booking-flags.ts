"use client";

import { useCallback, useEffect, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import type { PortalKey } from "@/lib/nav/config";
import type { Booking } from "@/features/bookings/types";

export interface BookingFlags {
  /** How many bookings need attention — the number on the Bookings tab. */
  count: number;
  /** Breakdown for the hover tooltip: catalogue key (p7shell.tip*) + how many. The header joins them with " · " in the active language. */
  tips: { key: string; n: number }[];
}

/**
 * Booking-area flags surfaced as a badge on the Bookings tab:
 *  · Operator — new bookings to approve, date/time changes to review,
 *    cancellations/refunds to review, and failed card payments.
 *  · Parent  — their bookings still to pay.
 * Live: refreshes on the realtime `bookings` channel.
 */
export function useBookingFlags(portal: PortalKey): BookingFlags {
  const [flags, setFlags] = useState<BookingFlags>({ count: 0, tips: [] });

  const load = useCallback(() => {
    const url = portal === "custdash" ? "/api/my/bookings" : "/api/bookings";
    apiGet<Booking[]>(url)
      .then((bs) => {
        const live = bs.filter((b) => b.status !== "Cancelled" && b.status !== "Declined");
        if (portal === "custdash") {
          // A waiting-list place isn't yours yet, so there's nothing to pay for
          // it — counting it made "My bookings 2" appear over a list showing
          // one booking, because the other was queued, not booked.
          const NO_PLACE_YET = ["Waitlisted", "Offered", "Approval needed"];
          const toPay = live.filter((b) => !NO_PLACE_YET.includes(b.status) && b.pay !== "Paid" && (b.amount ?? 0) > 0).length;
          setFlags(toPay ? { count: toPay, tips: [{ key: "p7shell.tipToPay", n: toPay }] } : { count: 0, tips: [] });
          return;
        }
        const approve = bs.filter((b) => b.status === "Approval needed").length;
        const change = live.filter((b) => b.dateChangeRequest?.status === "pending").length;
        const cancel = bs.filter((b) => b.cancel?.refund === "pending").length;
        const card = live.filter((b) => b.cardFailed).length;
        const tips = [
          { key: "p7shell.tipApprove", n: approve },
          { key: "p7shell.tipChange", n: change },
          { key: "p7shell.tipCancel", n: cancel },
          { key: "p7shell.tipCard", n: card },
        ].filter((x) => x.n > 0);
        setFlags({ count: approve + change + cancel + card, tips });
      })
      .catch(() => {});
  }, [portal]);

  useEffect(() => { load(); }, [load]);
  useRealtime(["bookings"], load);
  return flags;
}
