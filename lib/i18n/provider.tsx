"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALE_STORAGE_KEY, isLocaleCode, isRTL, type LocaleCode } from "./config";
import { translate, type Vars } from "./translate";
import { currentLocaleCode, setDateLocale } from "./format";
import { translateWord } from "./words";
import { subscribeHub } from "./hubMessages";

interface Ctx {
  locale: LocaleCode;
  setLocale: (l: LocaleCode) => void;
  t: (key: string, vars?: Vars) => string;
  /** Translate a canonical English data word ("Confirmed", "Paid · voucher") — unknown text is returned unchanged. */
  w: (s: string | null | undefined) => string;
}

const I18nContext = createContext<Ctx | null>(null);

function writeCookie(l: LocaleCode) {
  try { document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`; } catch { /* ignore */ }
}

export function LanguageProvider({ children, initialLocale = DEFAULT_LOCALE }: { children: ReactNode; initialLocale?: LocaleCode }) {
  const [locale, setLocaleState] = useState<LocaleCode>(initialLocale);
  // Re-render every consumer when a lazily-loaded catalogue (the Teaching Hub's) arrives.
  const [, setHubVer] = useState(0);
  useEffect(() => subscribeHub(() => setHubVer((n) => n + 1)), []);

  // Restore the saved language on first paint.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (isLocaleCode(saved) && saved !== initialLocale) setLocaleState(saved); // older sessions / e2e seed only localStorage; the cookie (read by the server) wins otherwise
      if (isLocaleCode(saved)) writeCookie(saved);
    } catch { /* storage blocked */ }
  }, []);

  // Reflect the language + text direction on <html> (RTL for Arabic/Urdu).
  useEffect(() => {
    const el = document.documentElement;
    el.setAttribute("lang", locale);
    el.setAttribute("dir", isRTL(locale) ? "rtl" : "ltr");
  }, [locale]);

  const setLocale = (l: LocaleCode) => {
    setLocaleState(l);
    try { localStorage.setItem(LOCALE_STORAGE_KEY, l); } catch { /* ignore */ }
    writeCookie(l);
  };

  // Keep the shared date/number tag in step with the picker during render, so every child formats with the same language.
  setDateLocale(locale);
  const t = (key: string, vars?: Vars) => translate(locale, key, vars);

  const w = (s: string | null | undefined) => translateWord(t, s);
  return <I18nContext.Provider value={{ locale, setLocale, t, w }}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  // Safe fallback if a component renders outside the provider (e.g. isolated tests).
  if (!ctx) { const t = (k: string, v?: Vars) => translate(DEFAULT_LOCALE, k, v); return { locale: DEFAULT_LOCALE, setLocale: () => {}, t, w: (s) => translateWord(t, s) }; }
  return ctx;
}

// Convenience: `const t = useT(); t("header.myBookings")`.
export function useT() {
  return useI18n().t;
}

/** `const w = useWord(); w(b.status)` — see lib/i18n/words.ts. */
export function useWord() {
  return useI18n().w;
}

/** Translate outside React (confirm() dialogs, non-hook helpers) in the language the picker is currently on. */
export function tNow(key: string, vars?: Vars): string {
  return translate(currentLocaleCode(), key, vars);
}
