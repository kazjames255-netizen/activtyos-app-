"use client";

import { useCallback, useEffect, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Badge, Card } from "@/components/ui";

interface Tenant {
  id: string;
  name: string;
  type: "company" | "freelancer";
  createdAt: string;
}

/** platform/providers — every tenant on the platform (super-admin view). */
export function ProvidersApp() {
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    apiGet<Tenant[]>("/api/tenants")
      .then(setTenants)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load providers"));
  }, []);

  useEffect(load, [load]);
  useRealtime(["tenants"], load);

  if (error) return <div className="p-2 text-[12.5px] text-[var(--red)]">{error}</div>;
  if (!tenants)
    return <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading providers…</div>;

  return (
    <div className="text-[var(--ink)]">
      <h2 className="mb-1 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
        Providers
      </h2>
      <p className="mb-4 text-[12.5px] text-[var(--ink-3)]">
        Every tenant on the platform — {tenants.length} provider{tenants.length === 1 ? "" : "s"}.
      </p>

      <InviteProviders />

      <div className="mb-2 mt-6 text-[13px] font-extrabold text-[var(--ink)]">On the platform</div>
      <div className="flex flex-col gap-2">
        {tenants.map((t) => (
          <Card key={t.id} className="flex flex-wrap items-center justify-between gap-2 p-3.5">
            <div>
              <div className="text-[14px] font-extrabold">{t.name}</div>
              <div className="text-[11.5px] text-[var(--ink-3)]">
                {t.id} · since {t.createdAt?.slice(0, 10) ?? "—"}
              </div>
            </div>
            <Badge
              tone={
                t.type === "company"
                  ? { bg: "var(--brand-soft)", fg: "var(--brand-strong)" }
                  : { bg: "#eaf0fc", fg: "#1d3a8f" }
              }
            >
              {t.type}
            </Badge>
          </Card>
        ))}
      </div>
    </div>
  );
}

/**
 * Invite-a-provider panel — a copyable sign-up link (and one-tap email compose)
 * the platform team sends to potential providers. The link lands on the normal
 * signup wizard, tagged `?ref=invite` for attribution; no account is pre-created,
 * so a fresh provider builds their own tenant. (Distinct from staff/franchise
 * `?invite=` tokens, which join an existing tenant.)
 */
function InviteProviders() {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);

  const link = `${origin || ""}/signup?ref=invite`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked — the field is selectable as a fallback */ }
  };
  const mailto = `mailto:?subject=${encodeURIComponent("You're invited to run on ActivityOS")}&body=${encodeURIComponent(
    `Hi,\n\nI'd love for you to run your camps, clubs & classes on ActivityOS — bookings, registers, payments and more in one place.\n\nSign up here (takes a couple of minutes):\n${link}\n\nAny questions, just reply to this email.\n\nThanks`,
  )}`;

  return (
    <div
      className="mb-2 overflow-hidden rounded-2xl text-white"
      style={{ background: "radial-gradient(120% 160% at 12% -30%, rgba(120,170,255,.5) 0%, transparent 55%), linear-gradient(120deg,#16306e 0%,#274ba3 58%,#3f78d8 100%)" }}
    >
      <div className="p-5">
        <div className="text-[11px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "#ffd23f" }}>Grow the platform</div>
        <div className="mt-0.5 text-[18px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>📣 Invite a provider to sign up</div>
        <p className="mt-1 max-w-[520px] text-[12.5px] leading-snug text-white/85">
          Copy this link and send it to any camp, club or class provider. It opens the sign-up wizard and creates their own account — nothing to set up first.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-[12.5px] font-semibold text-white outline-none placeholder:text-white/50"
            aria-label="Provider sign-up invite link"
          />
          <div className="flex gap-2">
            <button type="button" onClick={copy} className="rounded-full bg-[#ffd23f] px-4 py-2 text-[12.5px] font-extrabold text-[#3a2a00] transition-colors hover:brightness-105">
              {copied ? "✓ Copied" : "Copy link"}
            </button>
            <a href={mailto} className="rounded-full border border-white/30 bg-white/10 px-4 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-white/20">
              ✉️ Email invite
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
