import type { Metadata } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { LanguageProvider } from "@/lib/i18n/provider";
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

export const metadata: Metadata = {
  title: "ActivityOS",
  description: "Booking / CRM / ops platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${bricolageGrotesque.variable} ${hankenGrotesk.variable}`}>
      <body>
        <AuthProvider><LanguageProvider>{children}</LanguageProvider></AuthProvider>
      </body>
    </html>
  );
}
