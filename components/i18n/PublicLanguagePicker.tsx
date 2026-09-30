"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { PORTALS } from "@/lib/nav/config";
import { LanguageSelector } from "./LanguageSelector";

// A language selector on every PUBLIC page (login, signup, how-it-works, storefront, booking, pay, plan, reference, errors…).
// The signed-in portals carry their own in the header, so it is hidden there. Fixed to the top inline-end corner (mirrors in RTL),
// tucked a little closer to the corner on phones so it clears page headers. Hidden when the page is embedded in another site
// (?embed=1 storefront/booking widget) and inside the call-ended iframe, where a floating picker would sit over someone else's page.
export function PublicLanguagePicker() {
  const path = usePathname() ?? "/";
  const first = path.split("/")[1] ?? "";
  const [embedded, setEmbedded] = useState(false);
  useEffect(() => {
    try { setEmbedded(new URLSearchParams(window.location.search).get("embed") === "1"); } catch { /* ignore */ }
  }, [path]);
  if ((PORTALS as readonly string[]).includes(first) || first === "call-ended" || embedded) return null;
  return (
    <div data-ui="public-language-picker" className="fixed end-2 top-2 z-[60] sm:end-3 sm:top-3">
      <LanguageSelector />
    </div>
  );
}
