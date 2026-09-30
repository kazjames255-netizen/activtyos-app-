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

// Subscription plan text comes from the API / HQ pricing catalogue in English. The default catalogue's names, blurbs, features and band labels are
// translated for display here; anything HQ has edited (or a custom plan) renders as typed.
const PLAN_TEXT: Record<string, string> = {
  "Freelancer": "p8pub.suFreelancer", "Company": "p8pub.suCompany", "Franchise": "p8fin.planFranchise",
  "For solo coaches & instructors — your own branding.": "p8fin.planB1",
  "For established companies — priced by team size, never a cut of bookings.": "p8fin.planB2",
  "For franchisors & multi-brand groups — one HQ console, billed by how many franchisees you have.": "p8fin.planB3",
  "Branded booking page & basket": "p8fin.planF1", "Payments to your own account": "p8fin.planF2", "Blocks & smart listings": "p8fin.planF3",
  "Registers on any device": "p8fin.planF4", "Parent app & messaging": "p8fin.planF5", "Dashboard & finance analytics": "p8fin.planF6",
  "Everything in Freelancer, plus:": "p8fin.planF7", "Staff scheduling, timetable & payroll": "p8fin.planF8", "Learning Centre & recruitment": "p8fin.planF9",
  "Multi-staff dashboard & team performance": "p8fin.planF10", "Everything in Company, plus:": "p8fin.planF11",
  "Head-office command centre & network reporting": "p8fin.planF12", "White-label per franchisee": "p8fin.planF13", "Territory mapping & agreements": "p8fin.planF14",
  "Split fees & royalty collection": "p8fin.planF15", "Per-franchise scoping & settings": "p8fin.planF16", "Priority onboarding & support": "p8fin.planF17",
};
const BAND_NAME: Record<string, string> = { Starter: "p8fin.planBandStarter", Growth: "p8fin.planBandGrowth", Scale: "p8fin.planBandScale" };

/** Display text for a subscription plan name / blurb / feature / band label (see PLAN_TEXT). Unknown text is returned unchanged. */
export function planText(t: T, text: string): string {
  const k = PLAN_TEXT[text];
  if (k) return t(k);
  let m = /^(\d+) SMS a month included$/.exec(text); if (m) return t("p8fin.planSms", { n: m[1] });
  m = /^(Starter|Growth|Scale) · up to (\d+) staff$/.exec(text); if (m) return t("p8fin.planBandUpTo", { name: t(BAND_NAME[m[1]]), n: m[2] });
  m = /^(Starter|Growth|Scale) · (\d+)–(\d+) staff$/.exec(text); if (m) return t("p8fin.planBandRange", { name: t(BAND_NAME[m[1]]), a: m[2], b: m[3] });
  m = /^(\d+)\+ staff · \+£(\d+)\/staff$/.exec(text); if (m) return t("p8fin.planBandOver", { n: m[1], p: m[2] });
  return text;
}
