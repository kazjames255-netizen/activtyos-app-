// Is this provider ready to take Tax-Free Childcare?
//
// HMRC pays a childcare provider by two things the PROVIDER must have: the registration number their childcare regulator gave them (Ofsted, CIW, Care
// Inspectorate...) and the postcode registered with it (`ccp_reg_reference` / `ccp_postcode` in the HMRC payment). Without both, every Tax-Free Childcare
// payment fails with "provider not added / not found". So the Setup screen asks for them, shows a plain status, and checkout only offers Tax-Free Childcare
// for a provider who has them. Pure and shared by the web app (Setup, checkout, first-run steps).

export const REGULATORS = ["Ofsted", "CIW", "Care Inspectorate", "Other"] as const;
export type Regulator = (typeof REGULATORS)[number];

export interface TfcDetails {
  settingName?: string;
  regulator?: string;
  registrationNumber?: string;
  postcode?: string;
}

export type TfcMissing = "name" | "registration" | "postcode";

/** Upper-case, no spaces, 5-8 characters, at least one letter-or-digit run that looks like a UK postcode: "MK45 4JZ", "SW1A 1AA", "M1 1AE". */
const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;
export const looksLikeUkPostcode = (v: string | null | undefined): boolean => UK_POSTCODE.test((v ?? "").trim());

/** A regulator registration number is quoted as one run of letters and digits ("EY123456", "1234567", "SC123456"): at least 4 of them, nothing else. */
export const looksLikeRegistration = (v: string | null | undefined): boolean => /^[A-Za-z0-9]{4,20}$/.test((v ?? "").replace(/\s+/g, ""));

/** What is still missing, in the order the form asks for it. `providerName` is the fallback for the registered name (the Setup display name or business name). */
export function tfcMissing(d: TfcDetails | null | undefined, providerName?: string | null): TfcMissing[] {
  const out: TfcMissing[] = [];
  if (!((d?.settingName ?? "").trim() || (providerName ?? "").trim())) out.push("name");
  if (!looksLikeRegistration(d?.registrationNumber)) out.push("registration");
  if (!looksLikeUkPostcode(d?.postcode)) out.push("postcode");
  return out;
}

export function tfcReady(d: TfcDetails | null | undefined, providerName?: string | null): { ready: boolean; missing: TfcMissing[] } {
  const missing = tfcMissing(d, providerName);
  return { ready: missing.length === 0, missing };
}

/** Does this provider's list of payment methods include Tax-Free Childcare? */
export const acceptsTfc = (payMethods: unknown): boolean =>
  Array.isArray(payMethods) && payMethods.some((m) => typeof m === "string" && /tax.?free|tfc/i.test(m));
