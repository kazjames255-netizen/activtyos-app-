"use client";

import { useEffect, useRef, useState } from "react";
import { LOCALES, type LocaleCode } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/provider";
import { api } from "@/lib/api";

// Language picker for the top bar of every portal. Sets the locale in context
// (instant) + localStorage (persists), and best-effort saves it to the account
// so it follows the user (backend: users.locale). Compact by default.
export function LanguageSelector() {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const cur = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const pick = (code: LocaleCode) => {
    setLocale(code);
    setOpen(false);
    api("/api/account", { method: "PUT", body: JSON.stringify({ locale: code }) }).catch(() => {});
  };

  return (
    <div className="relative flex-none" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={t("common.chooseLanguage")}
        aria-label={t("common.chooseLanguage")}
        className="inline-flex h-[34px] items-center gap-1 rounded-full px-2.5 text-[12px] font-extrabold transition-all hover:-translate-y-px hover:brightness-105"
        style={{ background: "#ffffff", boxShadow: "inset 0 0 0 1px #e3e9f5", color: "#1d3a8f" }}
      >
        <span className="text-[15px] leading-none" aria-hidden>{cur.flag}</span>
        <span className="hidden sm:inline">{cur.code.toUpperCase()}</span>
        <span className="text-[8px] leading-none" aria-hidden>▼</span>
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 max-h-[70vh] w-52 overflow-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-1.5 shadow-[0_18px_44px_-16px_rgba(15,23,42,.4)]">
          <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]">{t("common.language")}</div>
          {LOCALES.map((l) => {
            const on = l.code === locale;
            return (
              <button
                key={l.code}
                type="button"
                onClick={() => pick(l.code)}
                dir={l.rtl ? "rtl" : "ltr"}
                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-bold no-underline transition-colors"
                style={on ? { background: "#eef4ff", color: "#1d3a8f" } : { color: "var(--ink)" }}
              >
                <span className="flex-none text-[16px]" aria-hidden>{l.flag}</span>
                <span className="min-w-0 flex-1 truncate text-left">{l.native}</span>
                {on && <span className="flex-none text-[#1d3a8f]" aria-hidden>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
