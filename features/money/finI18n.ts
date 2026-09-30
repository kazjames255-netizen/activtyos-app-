// Display-only helpers for the finance screens (the stored/API value always stays the canonical English string).
type T = (key: string, vars?: Record<string, string | number>) => string;

const CATS: Record<string, string> = {
  "Equipment": "p8fin.catEquipment", "Supplies": "p8fin.catSupplies", "Venue hire": "p8fin.catVenueHire", "Staff": "p8fin.catStaff", "Travel": "p8fin.catTravel",
  "Marketing": "p8fin.catMarketing", "Insurance": "p8fin.catInsurance", "Training": "p8fin.catTraining", "Software": "p8fin.catSoftware", "Utilities": "p8fin.catUtilities", "Other": "p8fin.catOther",
  "Bookings": "p8fin.catBookings", "Invoices": "p8fin.catInvoices", "Sessions": "p8fin.catSessions", "Camps": "p8fin.catCamps", "Memberships": "p8fin.catMemberships",
  "Merchandise": "p8fin.catMerchandise", "Grants": "p8fin.catGrants", "Fundraising": "p8fin.catFundraising", "Deposits": "p8fin.catDeposits",
  // staff expense-claim categories (Staff portal, existing staffp.* words)
  "Travel & mileage": "staffp.expCatTravel", "Activity materials": "staffp.expCatMaterials", "Food & catering": "staffp.expCatFood",
};

/** Expense category display label; an unknown / custom category renders as typed. */
export function catLabel(t: T, category: string | null | undefined): string {
  if (!category) return category ?? "";
  const k = CATS[category];
  return k ? t(k) : category;
}

const METHODS: Record<string, string> = {
  "Card": "p8fin.recMCard", "Bank transfer": "p8fin.recMBank", "Childcare vouchers": "p8fin.recMVouchers", "Cash": "p8fin.recMCash", "Other": "p8fin.catOther",
  "HAF (funded £0)": "p8fin.mthHaf", "Free place": "p8fin.mthFree", "Invoice": "p8fin.mthInvoice", "Store credit": "p8fin.mthStoreCredit",
};

/** Payment-method display label (canonical English kept in data; Tax-Free Childcare / PayPal stay as-is). */
export function methodLabel(t: T, method: string | null | undefined): string {
  if (!method) return method ?? "";
  const k = METHODS[method];
  return k ? t(k) : method;
}
