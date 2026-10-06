"use client";

import { Card, SectionHead } from "@/components/ui";
import { useT } from "@/lib/i18n/provider";
import { H, hq } from "./hqText";

// Quick link to the Name TBC marketing site build (public/v2/*.html) — kept
// here so it's one click from HQ instead of a URL someone has to remember.
const PAGES: { label: string; href: string }[] = [
  { label: H("Home"), href: "/v2/activly.html" },
  { label: H("Freelancers"), href: "/v2/freelancers.html" },
  { label: H("Companies"), href: "/v2/companies.html" },
  { label: H("Franchises"), href: "/v2/franchises.html" },
  { label: H("Schools & academies (MATs)"), href: "/v2/schools.html" },
  { label: H("Parents"), href: "/v2/parents.html" },
  { label: H("Pricing"), href: "/v2/pricing.html" },
];

export function ActivlySiteApp() {
  useT(); // re-render on language change
  return (
    <div className="flex flex-col gap-3.5 p-4">
      <SectionHead>{hq("Name TBC site")}</SectionHead>
      <Card className="p-4">
        <a
          href="/v2/activly.html"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-lg px-4 py-2 text-[13px] font-extrabold text-white"
          style={{ background: "var(--brand)" }}
        >
          {hq("↗ Open the site")}
        </a>
        <div className="mt-4 flex flex-wrap gap-2">
          {PAGES.map((p) => (
            <a
              key={p.href}
              href={p.href}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-[12.5px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]"
            >
              {hq(p.label)}
            </a>
          ))}
        </div>
      </Card>
    </div>
  );
}
