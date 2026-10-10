import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/i18n/config";

// Installable-app (PWA) identity: name + the ActivityLane mark. Icons are generated from public/brand/mark.svg
// by scripts/gen-brand-assets.mjs.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND,
    short_name: BRAND,
    description: "Bookings, staff, registers and payments for children's activity providers",
    start_url: "/",
    display: "standalone",
    background_color: "#0b1f5c",
    theme_color: "#14378f",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
