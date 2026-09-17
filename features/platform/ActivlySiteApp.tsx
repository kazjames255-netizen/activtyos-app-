"use client";

import { Card, SectionHead } from "@/components/ui";

// Quick link to the Activly marketing site build (public/v2/*.html) — kept
// here so it's one click from HQ instead of a URL someone has to remember.
const PAGES: { label: string; href: string }[] = [
  { label: "Home", href: "/v2/activly.html" },
  { label: "Freelancers", href: "/v2/freelancers.html" },
  { label: "Companies", href: "/v2/companies.html" },
  { label: "Franchises", href: "/v2/franchises.html" },
  { label: "Schools & academies (MATs)", href: "/v2/schools.html" },
  { label: "Parents", href: "/v2/parents.html" },
  { label: "Pricing", href: "/v2/pricing.html" },
];

export function ActivlySiteApp() {
  return (
    <div className="flex flex-col gap-3.5 p-4">
      <SectionHead>Activly site</SectionHead>
      <Card className="p-4">
        <a
          href="/v2/activly.html"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-lg px-4 py-2 text-[13px] font-extrabold text-white"
          style={{ background: "var(--brand)" }}
        >
          ↗ Open the site
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
              {p.label}
            </a>
          ))}
        </div>
      </Card>
    </div>
  );
}
