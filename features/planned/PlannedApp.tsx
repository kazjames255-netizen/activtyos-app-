import Link from "next/link";
import { Card } from "@/components/ui";

// ─────────────────────────────────────────────────────────────────────────
// An honest page for a feature that's on the roadmap but not built yet.
// It says so plainly and points at what to use today — never canned data,
// never a dead button. Replace a planned() entry in lib/view-registry.tsx
// with the real component when the feature lands.
//
// NOT a client component: the registry calls planned() while the server
// renders the route, so this module must stay server-safe (no hooks — it's
// pure markup, and that's the point).
// ─────────────────────────────────────────────────────────────────────────

export interface PlannedSpec {
  title: string;
  /** What this area will do when it's built — one or two sentences. */
  blurb: string;
  /** Where to go today, if anywhere covers part of the job. */
  links?: { href: string; label: string; hint: string }[];
}

export function Planned({ title, blurb, links = [] }: PlannedSpec) {
  return (
    <div className="mx-auto max-w-[560px] pt-6 text-[var(--ink)]">
      <Card className="p-6">
        <span className="rounded-full bg-[var(--brand-soft)] px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--brand-strong)]">
          Planned
        </span>
        <h2 className="mt-3 text-[20px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
          {title}
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--ink-2)]">{blurb}</p>
        <p className="mt-3 text-[12px] text-[var(--ink-3)]">
          Nothing here is live yet — this page is a placeholder so you know where the feature will
          live, not a preview of it.
        </p>
        {links.length > 0 && (
          <div className="mt-4 border-t border-[var(--line)] pt-3.5">
            <div className="mb-2 text-[10.5px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-3)]">
              Until then
            </div>
            <div className="flex flex-col gap-2">
              {links.map((l) => (
                <Link key={l.href} href={l.href} className="group flex items-baseline gap-2 text-[13px]">
                  <span className="font-bold text-[var(--brand-2,#2f6bd8)] group-hover:underline">{l.label}</span>
                  <span className="text-[12px] text-[var(--ink-3)]">{l.hint}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

/** Registry helper: `planned({...})` → a zero-prop component. */
export const planned = (spec: PlannedSpec) => {
  const C = () => <Planned {...spec} />;
  C.displayName = `Planned(${spec.title})`;
  return C;
};
