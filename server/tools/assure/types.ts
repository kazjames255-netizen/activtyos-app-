// CONTRACT for the bookings assurance toolkit (written first so parallel agents build to one shape).
//   invariants.ts  -> exports `INVARIANTS: Invariant[]` and `checkAll(snapshot)`; pure functions over a Snapshot, no network.
//   snapshot.ts    -> exports `takeSnapshot(tenantId): Promise<Snapshot>` reading Firestore (read-only).
//   fuzz.ts        -> drives the REAL API (http://localhost:4000, test accounts only, Stripe TEST keys) with seeded random Actions,
//                     takes a snapshot after every action, runs checkAll, and on a violation prints seed + the shortest action trace.
//   actions/*.ts   -> each exports `ACTIONS: ActionDef[]`; area agents add files, fuzz.ts auto-loads every file in actions/.
// Everything here is TEST-ONLY: it must refuse to run against a tenant whose owner email does not end @activityos-test.com.

export interface SnapBooking {
  id: string; ref: string; listingId?: string; blockId?: string; tenantId: string; email: string;
  status: string; pay?: string; amount: number; received?: number; refunded?: number; walletApplied?: number;
  days: string[]; seats: number; kidsLive: number; promoted?: boolean; pass?: string; method?: string; createdAt?: string;
  discountOff?: number; listPrice?: number; addonsTotal?: number; waitlistedAt?: string; offerExpiresAt?: string;
  // ---- L1 additions (all optional so existing builders keep compiling) ----
  /** Normalised money: what the booking has received (incl. wallet) and refunded, as the dashboard counts them (features/bookings/helpers). */
  amountPaid?: number; cardPaid?: number; tfcAmount?: number; receivedAfterCancel?: number; amendFeesCharged?: number; hasPriceOverride?: boolean;
  cancel?: { on?: string; refund?: string; amount?: number; refundOnly?: boolean } | null; declineReason?: string;
  kids?: { childId?: string; name?: string; cancelled?: boolean; dates?: string[]; cancelledDays?: string[] }[];
  listingName?: string; childKey?: string; age?: number; ageGroup?: string; earlyBirdScope?: string; ticket?: string;
  offeredAt?: string; requeuedAt?: string; dateChangeStatus?: string; dateChangeMoves?: number; amendMovesApproved?: number; origFirstDate?: string; paymentIntentId?: string;
  tenantIdOnDoc?: string; blockMissing?: boolean; listingMissing?: boolean;
  /** Home-visit bookings only: where the session runs (checked against the listing's coverage area at checkout). */
  serviceAddress?: { address?: string; postcode?: string };
}
export interface SnapBlock { id: string; listingId: string; capacity: number; capacityScope?: "day" | "listing"; counts?: Record<string, number>; dates: string[]; bookedCount?: number; dayCounts?: Record<string, number>; startDate?: string; endDate?: string; open?: boolean }
export interface SnapPayment { id: string; refs: string[]; amount: number; status: string; type?: string; kind?: string; createdAt?: string; paidAt?: string; email?: string; paymentIntentId?: string; method?: string }
export interface SnapEmail { to: string; subject: string; kind?: string; ref?: string; at?: string }
export interface SnapListing { id: string; status: string; name?: string; ticketCaps?: Record<string, number>; ageCaps?: Record<string, number>; maxAttendees?: number; capacityScope?: string; waitlistMode?: string; waitlist?: boolean; createdAt?: string; deliveryMode?: string; coverageMode?: string; coveragePrefixes?: string[]; discounts?: { kind?: string; method?: string; enabled?: boolean }[] }
export interface Snapshot {
  tenantId: string; takenAt: string;
  bookings: SnapBooking[]; blocks: SnapBlock[]; payments: SnapPayment[]; listings: SnapListing[];
  /** Wallet balance per family email, and the ledger lines behind it. */
  wallet?: Record<string, number>; walletEntries?: { email: string; delta: number; ref?: string }[]; emailsSent?: SnapEmail[];
}

export interface Violation { rule: string; severity: "money" | "capacity" | "state" | "email"; message: string; refs?: string[] }
export interface Invariant { id: string; describe: string; severity: Violation["severity"]; check(s: Snapshot): Violation[] }

export interface ActionCtx { rng: () => number; api: (method: string, url: string, body?: unknown, as?: string) => Promise<{ status: number; json: any }>; world: any; log: (m: string) => void }
export interface ActionDef { id: string; area: string; weight: number; applicable(ctx: ActionCtx): boolean; run(ctx: ActionCtx): Promise<{ summary: string; expectError?: boolean }> }
