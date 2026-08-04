import { db } from "../firebase";

// Setup → Email → "Automatic emails": which system emails ActivityOS sends on
// a provider's behalf, and the reminder timings. The preferences live in the
// tenant's settings blob (libraries/{tenantId}.settings.autoEmails) — this is
// the server-side reader every sender consults before mailing a family.
//
// Defaults mirror lib/settings.ts DEFAULT_SETTINGS.autoEmails: everything ON
// except announcements (re-marketing is opt-in). An absent key means its
// default, and an unreadable settings doc fails OPEN for transactional mail —
// a lost booking confirmation is worse than an extra one.

export interface AutoEmailPrefs {
  bookings: boolean;        // booking confirmed / approved / declined / cancelled
  payments: boolean;        // receipts, refunds, payment-failed, voucher instructions
  paymentDue: boolean;      // payment-due reminder
  paymentDueTiming: number; // hours before the due date
  sessionReminder: boolean; // pre-session reminder
  sessionTiming: number;    // hours before the session
  waitlist: boolean;        // place-opened / moved-up
  dayOf: boolean;           // not-arrived alerts (30 min after session start)
  lateCollection: boolean;  // late-checkout alert
  announcements: boolean;   // re-marketing to past customers (opt-in)
  reviewRequests: boolean;  // ask for a review after the LAST booked session
}

export const AUTO_EMAIL_DEFAULTS: AutoEmailPrefs = {
  bookings: true,
  payments: true,
  paymentDue: true,
  paymentDueTiming: 24,
  sessionReminder: true,
  sessionTiming: 48,
  waitlist: true,
  dayOf: true,
  lateCollection: true,
  announcements: false,
  reviewRequests: true,
};

/** The tenant's resolved automatic-email preferences (defaults filled in). */
export async function autoEmailPrefs(tenantId: string): Promise<AutoEmailPrefs> {
  try {
    const lib = await db.collection("libraries").doc(tenantId).get();
    const raw = ((lib.data()?.settings as { autoEmails?: Partial<AutoEmailPrefs> } | undefined)?.autoEmails ?? {});
    return { ...AUTO_EMAIL_DEFAULTS, ...raw };
  } catch {
    return { ...AUTO_EMAIL_DEFAULTS };
  }
}

type BooleanKeys = { [K in keyof AutoEmailPrefs]: AutoEmailPrefs[K] extends boolean ? K : never }[keyof AutoEmailPrefs];

/** Is this category of automatic email on for the tenant? No tenantId (a
 *  booking object from before tenant stamping) fails open — send. */
export async function autoEmailOn(tenantId: string | undefined, key: BooleanKeys): Promise<boolean> {
  if (!tenantId) return true;
  return (await autoEmailPrefs(tenantId))[key];
}
