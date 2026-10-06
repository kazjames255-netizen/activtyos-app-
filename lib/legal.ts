// The legal documents live in ONE place each: the website pages under public/v2 (edit them there). Everything else links to them
// (sign-up checkbox, the HQ Manual) and reads the "last updated" date live from the page, so a change on the website shows everywhere.
// TERMS_VERSION is the version recorded against a provider when they accept at sign-up: change it whenever the Terms/DPA text changes,
// and the HQ Manual (Legal documents page) flags it if it no longer matches the date printed on the page.
export const TERMS_VERSION = "2026-09-05";

export interface LegalDoc { id: string; title: string; href: string; file: string; covers: string; where: string }
export const LEGAL_DOCS: LegalDoc[] = [
  { id: "terms", title: "Terms of Service", href: "/v2/terms.html", file: "public/v2/terms.html", covers: "The agreement between the platform and each provider: plans, trial, payments, acceptable use, liability.", where: "Sign-up checkbox, website footer" },
  { id: "privacy", title: "Privacy Policy", href: "/v2/privacy.html", file: "public/v2/privacy.html", covers: "How personal data is used, who the processors are (Stripe, Google Cloud, email), retention and rights.", where: "Sign-up checkbox, website footer" },
  { id: "dpa", title: "Data Processing Agreement", href: "/v2/dpa.html", file: "public/v2/dpa.html", covers: "The provider is the controller of children's data; the platform is the processor. Sub-processors, security, breach notice.", where: "Sign-up checkbox, website footer" },
  { id: "security", title: "Security", href: "/v2/security.html", file: "public/v2/security.html", covers: "Plain-language summary of how data and payments are protected.", where: "Website footer" },
  { id: "safeguarding", title: "Safeguarding", href: "/v2/safeguarding.html", file: "public/v2/safeguarding.html", covers: "How the platform supports providers' own safeguarding duties.", where: "Website" },
];
