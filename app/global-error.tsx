"use client"; // Error boundaries must be Client Components

import { LOCALE_COOKIE, isLocaleCode, isRTL, DEFAULT_LOCALE, type LocaleCode } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/translate";

// The visitor's language from the cookie the language picker writes (this boundary replaces the root layout,
// so the LanguageProvider is not available here).
function cookieLocale(): LocaleCode {
  try {
    const m = document.cookie.split("; ").find((c) => c.startsWith(`${LOCALE_COOKIE}=`));
    const v = m ? decodeURIComponent(m.slice(LOCALE_COOKIE.length + 1)) : "";
    return isLocaleCode(v) ? v : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

// The last line of defence: the root layout itself failed. Must render its own
// <html>/<body> (it replaces the layout), so it can't lean on globals.css.
export default function GlobalError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  const locale = cookieLocale();
  const t = (k: string, v?: Record<string, string | number>) => translate(locale, k, v);
  return (
    <html lang={locale} dir={isRTL(locale) ? "rtl" : "ltr"}>
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif", background: "#f4f7fc", color: "#171534" }}>
        <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ maxWidth: 420, width: "100%", background: "#fff", borderRadius: 18, padding: 28, textAlign: "center", boxShadow: "0 16px 44px -22px rgba(20,33,58,.5)" }}>
            <div style={{ fontSize: 38 }}>⚠️</div>
            <h1 style={{ fontSize: 20, margin: "8px 0" }}>{t("p8pub.gerrTitle")}</h1>
            <p style={{ fontSize: 13.5, color: "#5b6472", lineHeight: 1.55 }}>
              {t("p8pub.gerrBody")}{error.digest ? ` ${t("p8pub.gerrDigest", { digest: error.digest })}` : ""}
            </p>
            <button type="button" onClick={() => unstable_retry()} style={{ marginTop: 16, border: 0, borderRadius: 999, background: "#1d3a8f", color: "#fff", padding: "10px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              {t("p8pub.tryAgain")}
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
