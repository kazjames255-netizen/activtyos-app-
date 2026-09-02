"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY, isRTL, type LocaleCode } from "./config";
import { CATALOGS } from "./messages";

type Vars = Record<string, string | number>;
interface Ctx {
  locale: LocaleCode;
  setLocale: (l: LocaleCode) => void;
  t: (key: string, vars?: Vars) => string;
}

const I18nContext = createContext<Ctx | null>(null);

// Resolve a dotted key ("header.myBookings") against a nested catalogue.
function resolve(obj: unknown, path: string): string | undefined {
  const out = path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
  return typeof out === "string" ? out : undefined;
}

function translate(locale: LocaleCode, key: string, vars?: Vars): string {
  const cat = CATALOGS[locale] ?? CATALOGS.en;
  let s = resolve(cat, key) ?? resolve(CATALOGS.en, key) ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>(DEFAULT_LOCALE);

  // Restore the saved language on first paint.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCALE_STORAGE_KEY) as LocaleCode | null;
      if (saved && CATALOGS[saved]) setLocaleState(saved);
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
  };

  const t = (key: string, vars?: Vars) => translate(locale, key, vars);

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  // Safe fallback if a component renders outside the provider (e.g. isolated tests).
  if (!ctx) return { locale: DEFAULT_LOCALE, setLocale: () => {}, t: (k, v) => translate(DEFAULT_LOCALE, k, v) };
  return ctx;
}

// Convenience: `const t = useT(); t("header.myBookings")`.
export function useT() {
  return useI18n().t;
}
