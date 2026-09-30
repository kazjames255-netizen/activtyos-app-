"use client";

import { usePathname } from "next/navigation";
import { PORTALS } from "@/lib/nav/config";
import { LanguageSelector } from "./LanguageSelector";

// A language selector on every PUBLIC page (login, signup, how-it-works, storefront, booking, pay, plan, reference, errors…).
// The signed-in portals carry their own in the header, so it is hidden there. Fixed to the top inline-end corner (mirrors in RTL).
export function PublicLanguagePicker() {
  const path = usePathname() ?? "/";
  const first = path.split("/")[1] ?? "";
  if ((PORTALS as readonly string[]).includes(first)) return null;
  return (
    <div data-ui="public-language-picker" className="fixed end-3 top-3 z-[60]">
      <LanguageSelector />
    </div>
  );
}
