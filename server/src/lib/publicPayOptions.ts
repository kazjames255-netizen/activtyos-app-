/**
 * Non-card ways to pay, as shown on the public pay-link pages (/pay/{invoice}, /pay/b/{token}).
 * Pure: takes the provider's settings and returns ONLY fields that are safe to hand to whoever holds the
 * unguessable link (the same bank details already go out in the booking emails and invoices).
 */
export interface PublicPayOptions {
  /** Enabled methods other than card, in the provider's order. */
  methods: string[];
  /** Bank-transfer details are NOT sent to a public page (only the booking email / the signed-in My bookings show them); this says only that the provider takes transfers, and the reference to quote. */
  bank: { reference: string } | null;
  cash: boolean;
  /** Childcare voucher / Tax-Free Childcare accepted. */
  vouchers: boolean;
  /** Shown when nothing else is configured: how to reach the provider. */
  contact: { email?: string; phone?: string } | null;
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function buildPayOptions(
  payMethods: unknown,
  billing: Record<string, unknown> | null | undefined,
  reference: string,
  fallbackMethods: string[] = [],
): PublicPayOptions {
  const listed = Array.isArray(payMethods) && payMethods.length ? (payMethods as unknown[]).map(str) : fallbackMethods;
  const methods = listed.filter((m) => m && !/^card$/i.test(m) && !/free place|haf/i.test(m));
  const b = billing ?? {};
  const sortCode = str(b.sortCode);
  const accountNumber = str(b.accountNumber);
  const hasBank = !!(sortCode && accountNumber);
  const bankListed = methods.some((m) => /bank|transfer/i.test(m));
  const bank = hasBank && bankListed ? { reference } : null;
  const cash = methods.some((m) => /cash/i.test(m));
  const vouchers = methods.some((m) => /voucher|tax.?free|childcare/i.test(m));
  const email = str(b.email);
  const phone = str(b.phone);
  const usable = !!bank || cash || vouchers;
  return {
    // A "Bank transfer" listed without any account details is not usable, so don't advertise it.
    methods: methods.filter((m) => !/bank|transfer/i.test(m) || !!bank),
    bank,
    cash,
    vouchers,
    contact: !usable && (email || phone) ? { ...(email ? { email } : {}), ...(phone ? { phone } : {}) } : null,
  };
}
