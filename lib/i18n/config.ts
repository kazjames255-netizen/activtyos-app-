// Supported languages. Chosen for a UK childcare/activities platform by PARENT
// demographics (2021 E&W census main languages), not global speaker counts —
// the goal is families understanding consent/medical/booking. Welsh is included
// for the Wales bilingual-service expectation. RTL flagged for layout mirroring.
export type LocaleCode = "en" | "pl" | "ro" | "ur" | "pa" | "bn" | "ar" | "pt" | "es" | "fr" | "cy";

export interface LocaleDef {
  code: LocaleCode;
  label: string;   // English name
  native: string;  // endonym, shown in the picker
  flag: string;
  rtl?: boolean;
}

export const LOCALES: LocaleDef[] = [
  { code: "en", label: "English", native: "English", flag: "🇬🇧" },
  { code: "pl", label: "Polish", native: "Polski", flag: "🇵🇱" },
  { code: "ro", label: "Romanian", native: "Română", flag: "🇷🇴" },
  { code: "ur", label: "Urdu", native: "اردو", flag: "🇵🇰", rtl: true },
  { code: "pa", label: "Panjabi", native: "ਪੰਜਾਬੀ", flag: "🇮🇳" },
  { code: "bn", label: "Bengali", native: "বাংলা", flag: "🇧🇩" },
  { code: "ar", label: "Arabic", native: "العربية", flag: "🇸🇦", rtl: true },
  { code: "pt", label: "Portuguese", native: "Português", flag: "🇵🇹" },
  { code: "es", label: "Spanish", native: "Español", flag: "🇪🇸" },
  { code: "fr", label: "French", native: "Français", flag: "🇫🇷" },
  { code: "cy", label: "Welsh", native: "Cymraeg", flag: "🏴󠁧󠁢󠁷󠁬󠁳󠁿" },
];

export const DEFAULT_LOCALE: LocaleCode = "en";
export const LOCALE_STORAGE_KEY = "aos.locale";

export const localeDef = (code: string): LocaleDef =>
  LOCALES.find((l) => l.code === code) ?? LOCALES[0];

export const isRTL = (code: string): boolean => !!localeDef(code).rtl;

/** The product name, shown in user-facing text. The product is being renamed: change it HERE only. Catalogue strings use the {brand} token (filled automatically by translate()). */
export const BRAND = "ActivityOS";

/** Cookie mirror of the picked language, so the server can render the first paint in the right language + direction (no English flash). */
export const LOCALE_COOKIE = "aos.locale";

export const isLocaleCode = (v: unknown): v is LocaleCode => typeof v === "string" && LOCALES.some((l) => l.code === v);
