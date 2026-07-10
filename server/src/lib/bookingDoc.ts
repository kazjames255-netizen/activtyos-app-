import type { Booking } from "../../../features/bookings/types";

// Firestore rejects directly-nested arrays, and Booking.answers is
// [string, string][] — so answers are persisted as {q, a}[] and converted at
// this boundary. The wire format (API request/response bodies) stays the
// exact Booking shape the frontend already uses.

type AnswerDoc = { q: string; a: string };
export type BookingDoc = Omit<Booking, "answers"> & { answers: AnswerDoc[] };

// Transient client-only fields must never reach Firestore.
const TRANSIENT_KEYS = ["_cancelling", "_refundType", "_chgKi", "_chgDt"] as const;

export function toDoc(b: Booking): BookingDoc {
  const clean = { ...b } as Booking & Record<string, unknown>;
  for (const k of TRANSIENT_KEYS) delete clean[k];
  return {
    ...(clean as Omit<Booking, "answers">),
    answers: (b.answers || []).map(([q, a]) => ({ q, a })),
  };
}

export function fromDoc(d: BookingDoc): Booking {
  return {
    ...(d as Omit<Booking, "answers">),
    answers: (d.answers || []).map(({ q, a }) => [q, a] as [string, string]),
  };
}
