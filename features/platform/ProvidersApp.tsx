"use client";

import { useCallback, useEffect, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { PlatformPricingApp } from "./PlatformPricingApp";

interface Provider {
  id: string; name: string; type: string; createdAt: string | null; ownerEmail: string | null;
  contactEmail: string | null; phone: string | null;
  providerName: string | null; providerNameMode: string | null; activityKinds: string[];
  address: string | null; postcode: string | null; logoUrl: string | null;
  heardAbout: string | null; referredBy: string | null;
  bank: { bankName?: string | null; accountName?: string | null; sortCode?: string | null; accountNumber?: string | null } | null;
  subscription: Record<string, unknown> | null;
  staffCount: number;
}

const SM: Record<string, { label: string; bg: string; fg: string }> = {
  trialing: { label: "Trial", bg: "#eaf0fc", fg: "#1d3a8f" },
  active: { label: "Active", bg: "#e7f6ee", fg: "#0f7a43" },
  canceling: { label: "Cancelling", bg: "#fdf0e3", fg: "#a5670a" },
  canceled: { label: "Cancelled", bg: "#fdebec", fg: "#c02636" },
  past_due: { label: "Past due", bg: "#fdebec", fg: "#c02636" },
  none: { label: "Not started", bg: "#eef0f5", fg: "#6b6880" },
};
const gbp = (n: number) => `£${n.toLocaleString("en-GB")}`;
const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");

const GRADS = ["linear-gradient(135deg,#1d3a8f,#3f78d8)", "linear-gradient(135deg,#3f78d8,#5aa0f0)", "linear-gradient(135deg,#274ba3,#4f8bf5)", "linear-gradient(135deg,#16306e,#2f6bd8)"];
const initials = (s: string) => (s.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?");
const grad = (s: string) => GRADS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % GRADS.length];
// A franchise is a company tenant on the franchise plan; freelancer/company come from the tenant type.
const kindOf = (p: Provider) => ((p.subscription?.plan as string) === "franchise" ? "franchise" : p.type);
const FILTERS: { id: string; label: string }[] = [
  { id: "all", label: "All" }, { id: "freelancer", label: "Freelancer" }, { id: "company", label: "Company" }, { id: "franchise", label: "Franchise" },
];

interface Summary { total: number; mrr: number; trialing: number; active: number }
const feeLabel = (sub: Record<string, unknown>) => (sub.price != null ? `${gbp(sub.price as number)}/${sub.cadence === "year" ? "yr" : "mo"}` : null);

/** platform/providers — every provider (full signup record + subscription) plus
 *  the billing summary the MRR adds up to. (Merged from the old Billing page.) */
export function ProvidersApp() {
  const [tab, setTab] = useState<"providers" | "pricing">("providers");
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const load = useCallback(() => {
    Promise.all([
      apiGet<{ providers: Provider[] }>("/api/platform/providers"),
      apiGet<{ summary: Summary }>("/api/platform/subscriptions"),
    ])
      .then(([p, s]) => { setProviders(p.providers); setSummary(s.summary); setError(null); })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load providers"));
  }, []);
  useEffect(load, [load]);
  useRealtime(["tenants"], load);

  const tabs = (
    <div className="mb-4 flex gap-1 border-b border-[var(--line)]">
      {([["providers", "Providers & billing"], ["pricing", "Pricing"]] as ["providers" | "pricing", string][]).map(([id, label]) => (
        <button key={id} type="button" onClick={() => setTab(id)} className="relative px-3.5 py-2 text-[13px] font-bold transition-colors"
          style={tab === id ? { color: "#1d3a8f" } : { color: "var(--ink-3)" }}>
          {label}
          {tab === id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded bg-[#1d3a8f]" />}
        </button>
      ))}
    </div>
  );

  if (tab === "pricing") return <div className="text-[var(--ink)]">{tabs}<PlatformPricingApp /></div>;
  if (error) return <div className="text-[var(--ink)]">{tabs}<div className="p-2 text-[12.5px] text-[var(--red)]">{error}</div></div>;
  if (!providers) return <div className="text-[var(--ink)]">{tabs}<div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading providers…</div></div>;

  return (
    <div className="text-[var(--ink)]">
      {tabs}
      <p className="mb-4 text-[12.5px] text-[var(--ink-3)]">Every tenant on the platform — {providers.length}, what they&rsquo;re on and the revenue it adds up to. Click a row for the full signup record and subscription.</p>

      {summary && (
        <div className="mb-5 grid gap-3 sm:grid-cols-4">
          {([["Providers", String(summary.total)], ["Monthly recurring", `${gbp(summary.mrr)}/mo`], ["On trial", String(summary.trialing)], ["Active", String(summary.active)]] as [string, string][]).map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{k}</div>
              <div className="mt-1 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{v}</div>
            </div>
          ))}
        </div>
      )}

      <InviteProviders />

      <div className="mb-3 mt-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const n = f.id === "all" ? providers.length : providers.filter((p) => kindOf(p) === f.id).length;
          const on = filter === f.id;
          return (
            <button key={f.id} type="button" onClick={() => setFilter(f.id)}
              className="rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-colors"
              style={on ? { borderColor: "#1d3a8f", background: "#1d3a8f", color: "#fff" } : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-2)" }}>
              {f.label} <span className={on ? "text-white/70" : "text-[var(--ink-3)]"}>{n}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        {providers.filter((p) => filter === "all" || kindOf(p) === filter).map((p) => {
          const sub = p.subscription ?? {};
          const status = (sub.status as string) ?? "none";
          const sm = SM[status] ?? SM.none;
          const isOpen = open === p.id;
          return (
            <div key={p.id} className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(16,24,40,.04)]">
              <button type="button" onClick={() => setOpen(isOpen ? null : p.id)} className="flex w-full flex-wrap items-center gap-3 px-3.5 py-3 text-left hover:bg-[var(--panel)]">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-[15px] font-extrabold text-white shadow-sm" style={{ background: grad(p.name) }}>{initials(p.name)}</span>
                <div className="min-w-0">
                  <div className="text-[14.5px] font-extrabold">{p.name}</div>
                  <div className="text-[11.5px] text-[var(--ink-3)]">{p.ownerEmail ?? "—"} · since {fmt(p.createdAt).replace(", 2026", "")}</div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  {feeLabel(sub) && <span className="rounded-full bg-[#f4f6fb] px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-[var(--ink-2)]">{feeLabel(sub)}</span>}
                  <span className="rounded-full bg-[#eaf0fc] px-2.5 py-0.5 text-[11px] font-bold capitalize text-[#1d3a8f]">{kindOf(p)}</span>
                  <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: sm.bg, color: sm.fg }}>{sm.label}</span>
                  <span className={`text-[13px] transition-transform ${isOpen ? "rotate-90" : ""} text-[var(--ink-3)]`}>▸</span>
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-[var(--line)] bg-[var(--panel)] px-3.5 py-3">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Section title="Signup answers">
                      <Row k="Business name" v={p.name} />
                      <Row k="Email" v={p.contactEmail ?? p.ownerEmail ?? "—"} />
                      <Row k="Phone" v={p.phone ?? "—"} />
                      <Row k="Shown to parents as" v={p.providerName ? `${p.providerName} (${p.providerNameMode === "person" ? "own name" : "business name"})` : "—"} />
                      <Row k="What they run" v={p.activityKinds.length ? p.activityKinds.join(", ") : "—"} />
                      <Row k="Based" v={[p.address, p.postcode].filter(Boolean).join(", ") || "—"} />
                      <Row k="Heard about us" v={p.heardAbout ?? "—"} />
                      <Row k="Invite ref" v={p.referredBy ?? "—"} />
                      {p.logoUrl && <div className="mt-1"><span className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Logo</span><br /><img src={p.logoUrl} alt="" className="mt-1 h-9 max-w-[120px] rounded border border-[var(--line)] object-contain" /></div>}
                    </Section>
                    <Section title="Subscription">
                      <Row k="Plan" v={sub.plan ? `${sub.plan}${sub.band ? ` · ${sub.band}` : ""}` : "—"} />
                      <Row k="Status" v={sm.label} />
                      <Row k="Fee" v={sub.price != null ? `${gbp(sub.price as number)}/${sub.cadence === "year" ? "yr" : "mo"}` : "—"} />
                      <Row k="Trial ends" v={sub.trialEndsAt ? fmt(sub.trialEndsAt as string) : "—"} />
                      <Row k="Renews / cancels" v={fmt((sub.cancelAt as string) ?? (sub.currentPeriodEnd as string))} />
                      <Row k="Staff" v={`${p.staffCount}${sub.staffLimit != null ? ` / ${sub.staffLimit}` : ""}`} />
                      <Row k="Started" v={sub.since ? fmt(sub.since as string) : "—"} />
                      {p.bank && <Row k="Payout bank" v={`${p.bank.bankName ?? ""} ${p.bank.sortCode ?? ""} ${p.bank.accountNumber ? `••••${String(p.bank.accountNumber).slice(-4)}` : ""}`.trim() || "—"} />}
                      <Row k="Tenant id" v={p.id} />
                    </Section>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[#1d3a8f]">{title}</div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-3 text-[12.5px]">
      <span className="w-[128px] shrink-0 text-[var(--ink-3)]">{k}</span>
      <span className="min-w-0 break-words font-semibold text-[var(--ink)]">{v}</span>
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
  const [origin] = useState(() => (typeof window === "undefined" ? "" : window.location.origin));
  const [copied, setCopied] = useState(false);

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
