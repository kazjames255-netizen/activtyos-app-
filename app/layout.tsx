import type { Metadata } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk, Noto_Naskh_Arabic, Noto_Nastaliq_Urdu, Noto_Sans_Bengali, Noto_Sans_Gurmukhi } from "next/font/google";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { LanguageProvider } from "@/lib/i18n/provider";
import { PublicLanguagePicker } from "@/components/i18n/PublicLanguagePicker";
import { dirFor, requestLocale, serverT } from "@/lib/i18n/server";
import { BRAND } from "@/lib/i18n/config";
import "./globals.css";

// Self-hosted equivalents of the legacy prototype's fonts, exposed as the
// same --ff-display / --ff custom properties the design tokens in
// globals.css (and every migrated feature) already reference.
const bricolageGrotesque = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--ff-display",
});

const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--ff",
});

// Script fonts for the RTL / South-Asian locales (ar, ur, pa, bn). The Latin fonts above carry no Arabic, Gurmukhi or Bengali glyphs, so without
// these the browser fell back to whatever the OS ships (Naskh instead of Nastaliq for Urdu on Windows/Android, tofu on a bare Linux box).
// `preload: false` = no <link rel=preload> and the @font-face rules are unicode-range subsets, so a font is only downloaded when a page
// actually renders a glyph in that script: English/European users pay nothing. The stacks are applied per <html lang> below (the language
// provider sets lang at runtime), by re-pointing --ff / --ff-display, which every component already uses.
const naskhArabic = Noto_Naskh_Arabic({ subsets: ["arabic"], display: "swap", preload: false });
const nastaliqUrdu = Noto_Nastaliq_Urdu({ subsets: ["arabic"], display: "swap", preload: false });
const sansGurmukhi = Noto_Sans_Gurmukhi({ subsets: ["gurmukhi"], display: "swap", preload: false });
const sansBengali = Noto_Sans_Bengali({ subsets: ["bengali"], display: "swap", preload: false });

const stack = (latin: string, script: string, generic: string) => `${latin}, ${script}, ${generic}`;
const scriptCss = [
  ["ar", naskhArabic.style.fontFamily, `"Geeza Pro", "Segoe UI", Tahoma, sans-serif`],
  ["ur", nastaliqUrdu.style.fontFamily, `"Jameel Noori Nastaleeq", "Noto Naskh Arabic", "Geeza Pro", serif`],
  ["pa", sansGurmukhi.style.fontFamily, `"Gurmukhi MN", "Raavi", sans-serif`],
  ["bn", sansBengali.style.fontFamily, `"Kohinoor Bangla", "Nirmala UI", "Vrinda", sans-serif`],
].map(([l, f, g]) => `html:lang(${l}){--ff:${stack(hankenGrotesk.style.fontFamily, f!, g!)};--ff-display:${stack(bricolageGrotesque.style.fontFamily, f!, g!)}}`).join("")
  // Nastaliq has tall ascenders and deep descenders: give Urdu body copy the extra leading it needs so lines do not collide.
  + "html:lang(ur) body{line-height:1.9}";

// The tab title + description follow the language the visitor picked (cookie), so a Polish parent does not see an English meta description.
export async function generateMetadata(): Promise<Metadata> {
  const loc = await requestLocale();
  return { title: BRAND, description: serverT(loc, "p8pub.metaDescription") };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await requestLocale(); // first paint already in the picked language + direction (no English flash)
  return (
    <html lang={locale} dir={dirFor(locale)} suppressHydrationWarning className={`${bricolageGrotesque.variable} ${hankenGrotesk.variable}`}>
      <head><style dangerouslySetInnerHTML={{ __html: scriptCss }} /></head>
      <body>
        <AuthProvider><LanguageProvider initialLocale={locale}>{children}<PublicLanguagePicker /></LanguageProvider></AuthProvider>
      </body>
    </html>
  );
}
