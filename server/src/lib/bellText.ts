// The PROVIDER's bell is a narrow list: the title shows about 32 characters and the body about 48, and anything longer is cut off mid-sentence
// ("New booking (awaiting bank transfer pay…"). So a bell is never a sentence. It is a short fixed label plus the booking reference, and a body of
// at most three short facts: TYPE, COST and one optional tag. The long detail (listing, children, notes, deadlines) lives in the email and on the
// booking page. Pure on purpose (no database), so every bell kind can be tested against the limits.

/** Characters the bell list can show before it cuts the text. Words are never cut: optional parts are dropped instead. */
export const BELL_TITLE_MAX = 32;
export const BELL_BODY_MAX = 48;

export type BellKind =
  | "new-booking"
  | "booking-request"
  | "waiting-list"
  | "waiting-list-started"
  | "paid"
  | "cancel-request"
  | "request-withdrawn"
  | "request-expired"
  | "answer-by"
  | "dates-moved"
  | "change-request"
  | "day-released"
  | "addon-request"
  | "place-free"
  | "addon-orders"
  | "refundToSend";

/** One fixed label per kind. Each is at most 20 characters so the reference always fits after it. */
export const BELL_LABEL: Record<BellKind, string> = {
  "new-booking": "New booking",
  "booking-request": "Booking request",
  "waiting-list": "Waiting list",
  "waiting-list-started": "New waiting list",
  "paid": "Paid ✓",
  "cancel-request": "Cancel request",
  "request-withdrawn": "Request withdrawn",
  "request-expired": "Request expired",
  "answer-by": "Answer by",
  "dates-moved": "Dates moved",
  "change-request": "Change request",
  "day-released": "Day released",
  "addon-request": "Extra request",
  "place-free": "Place free",
  "addon-orders": "Add-on orders",
  "refundToSend": "Refund to send",
};

/** 'New booking · APF-10334', or 'New booking · APF-10334 +1' when one checkout made several bookings. Never longer than BELL_TITLE_MAX. */
export function bellTitle(kind: BellKind, refs: string | string[]): string {
  const list = (Array.isArray(refs) ? refs : [refs]).filter(Boolean);
  const label = BELL_LABEL[kind];
  const first = list[0] ?? "";
  const withMore = list.length > 1 ? `${label} · ${first} +${list.length - 1}` : `${label} · ${first}`;
  if (withMore.length <= BELL_TITLE_MAX) return first ? withMore : label;
  const plain = `${label} · ${first}`;
  return first && plain.length <= BELL_TITLE_MAX ? plain : label;
}

/** '£15.30' */
export const bellMoney = (n: number): string => `£${(Math.round((Number(n) || 0) * 100) / 100).toFixed(2)}`;

/** '14 Oct': the short day used for deadlines. */
export function bellDay(iso: string | Date | undefined): string {
  if (!iso) return "";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });
}

/** How the family pays, in two words or fewer: the TYPE fact. */
export function paymentType(b: { method?: string | null; voucherScheme?: string | null; pay?: string | null; amount?: number | null; cardHold?: { state?: string } | null }): string {
  if ((b.amount ?? 0) <= 0 || b.pay === "Funded") return "Free";
  const hold = b.cardHold?.state;
  if (hold === "held" || hold === "awaiting") return "Card held";
  const m = `${b.method ?? ""} ${b.voucherScheme ?? ""}`.toLowerCase();
  if (/tax-?free|tfc/.test(m)) return "Tax-Free Childcare";
  if (/haf/.test(m)) return "HAF";
  if (/voucher|childcare/.test(m)) return "Voucher";
  if (/bank|transfer|bacs/.test(m)) return "Bank transfer";
  if (/cash/.test(m)) return "Cash";
  if (/wallet|credit/.test(m)) return "Credit";
  if (/card/.test(m)) return "Card";
  const raw = (b.method ?? "").trim();
  return raw && raw.length <= 18 ? raw.charAt(0).toUpperCase() + raw.slice(1) : "Other";
}

/**
 * The bell body: facts joined by ' · '. The first two facts (TYPE, COST) are kept; optional facts after them are added while the whole line still fits
 * BELL_BODY_MAX, and dropped (never cut) when it does not. Empty facts are ignored. No sentence, no brackets.
 */
export function bellBody(facts: (string | false | null | undefined)[], max: number = BELL_BODY_MAX): string {
  const list = facts.filter((f): f is string => typeof f === "string" && f.trim().length > 0).map((f) => f.trim());
  let out = "";
  list.forEach((f, i) => {
    const next = out ? `${out} · ${f}` : f;
    if (i < 2 || next.length <= max) out = next;
  });
  return out;
}

/** The plain-text paragraph an email falls back to when a bell's old long wording must stay in the email. */
export function plainParagraph(text: string): string {
  return `<p>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>`;
}
