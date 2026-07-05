import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ActivityOS",
  description: "Booking / CRM / ops platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The legacy prototype ships its own fonts (Bricolage Grotesque / Hanken
  // Grotesk), so we don't declare next/font here during the shell phase.
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
