"use client";

import { dateLocale as dl, uiDate } from "@/lib/i18n/format";
import { useCallback, useEffect, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { PlatformPricingApp } from "./PlatformPricingApp";
import { useT } from "@/lib/i18n/provider";
import { H, hq } from "./hqText";
import {
  STATUS_TABS, SORT_KEYS, classify, isOnTrial, isTestAccount, matchesSearch, sortProviders, tiles, trialDaysLeft,
  type ProviderLike, type SortKey, type StatusTab,
} from "@/lib/providerFilters";

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
  trialing: { label: H("Trial"), bg: "#eaf0fc", fg: "#1d3a8f" },
  active: { label: H("Active"), bg: "#e7f6ee", fg: "#0f7a43" },
  canceling: { label: H("Cancelling"), bg: "#fdf0e3", fg: "#a5670a" },
  canceled: { label: H("Cancelled"), bg: "#fdebec", fg: "#c02636" },
  past_due: { label: H("Past due"), bg: "#fdebec", fg: "#c02636" },
  none: { label: H("Not started"), bg: "#eef0f5", fg: "#6b6880" },
};
const gbp = (n: number) => `£${n.toLocaleString(dl())}`;
const fmt = (iso?: string | null) => (iso ? uiDate(new Date(iso), { day: "numeric", month: "short", year: "numeric" }) : "—");

const GRADS = ["linear-gradient(135deg,#1d3a8f,#3f78d8)", "linear-gradient(135deg,#3f78d8,#5aa0f0)", "linear-gradient(135deg,#274ba3,#4f8bf5)", "linear-gradient(135deg,#16306e,#2f6bd8)"];
const initials = (s: string) => (s.trim().split(/\s+/).filter((w) => /^\p{L}/u.test(w)).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?");
const grad = (s: string) => GRADS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % GRADS.length];
// A franchise is a company tenant on the franchise plan; freelancer/company come from the tenant type.
const kindOf = (p: Provider) => ((p.subscription?.plan as string) === "franchise" ? "franchise" : p.type);
const FILTERS: { id: string; label: string }[] = [
  { id: "all", label: H("All") }, { id: "freelancer", label: H("Freelancer") }, { id: "company", label: H("Company") }, { id: "franchise", label: H("Franchise") },
];

interface Summary { total: number; mrr: number; trialing: number; active: number }
/** Per-tenant row from /api/platform/subscriptions (already fetched for the tiles): status, price and trial end with the same fallbacks the tiles use. */
interface SubRow { id: string; status: string; price: number | null; plan: string | null; trialEndsAt: string | null }

const TAB_LABEL: Record<StatusTab, string> = {
  all: H("All"), trial: H("Trial started"), endingSoon: H("Trial ending soon"), trialEnded: H("Trial ended"),
  active: H("Active"), pastDue: H("Payment failed"), cancelled: H("Cancelled"), noCard: H("No card"),
};
const SORT_LABEL: Record<SortKey, string> = { newest: H("Newest"), trialEnding: H("Trial ending soonest"), name: H("Name"), value: H("Monthly value") };
const daysText = (d: number) => (d <= 0 ? hq("ends today") : d === 1 ? hq("ends in 1 day") : hq("ends in {n} days", { n: d }));

// Tab/filter state lives in the page URL (?st=&kind=&q=&sort=&test=1) so a refresh keeps it.
function readUrl() {
  const q = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const st = q.get("st") as StatusTab | null;
  const sort = q.get("sort") as SortKey | null;
  return {
    st: st && STATUS_TABS.includes(st) ? st : ("all" as StatusTab),
    kind: q.get("kind") ?? "all",
    q: q.get("q") ?? "",
    sort: sort && SORT_KEYS.includes(sort) ? sort : ("newest" as SortKey),
    showTest: q.get("test") === "1",
  };
}
const feeLabel = (sub: Record<string, unknown>) => (sub.price != null ? hq(sub.cadence === "year" ? "{amount}/yr" : "{amount}/mo", { amount: gbp(sub.price as number) }) : null);

/** platform/providers — every provider (full signup record + subscription) plus
 *  the billing summary the MRR adds up to. (Merged from the old Billing page.) */
export function ProvidersApp() {
  useT(); // re-render on language change (labels are translated at render time)
  const [tab, setTab] = useState<"providers" | "pricing">("providers");
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [subRows, setSubRows] = useState<Record<string, SubRow>>({});
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [init] = useState(readUrl);
  const [filter, setFilter] = useState<string>(init.kind);
  const [stTab, setStTab] = useState<StatusTab>(init.st);
  const [search, setSearch] = useState(init.q);
  const [sort, setSort] = useState<SortKey>(init.sort);
  const [showTest, setShowTest] = useState(init.showTest);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const put = (k: string, v: string, def: string) => (v === def ? q.delete(k) : q.set(k, v));
    put("st", stTab, "all"); put("kind", filter, "all"); put("q", search.trim(), ""); put("sort", sort, "newest"); put("test", showTest ? "1" : "0", "0");
    const qs = q.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`);
  }, [stTab, filter, search, sort, showTest]);

  const load = useCallback(() => {
    Promise.all([
      apiGet<{ providers: Provider[] }>("/api/platform/providers"),
      apiGet<{ rows: SubRow[] }>("/api/platform/subscriptions"),
    ])
      .then(([p, s]) => { setProviders(p.providers); setSubRows(Object.fromEntries(s.rows.map((r) => [r.id, r]))); setError(null); })
      .catch((e) => setError(e instanceof Error ? e.message : hq("Failed to load providers")));
  }, []);
  useEffect(load, [load]);
  useRealtime(["tenants"], load);

  const tabs = (
    <div className="mb-4 flex gap-1 border-b border-[var(--line)]">
      {([["providers", hq("Providers & billing")], ["pricing", hq("Pricing")]] as ["providers" | "pricing", string][]).map(([id, label]) => (
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
  if (!providers) return <div className="text-[var(--ink)]">{tabs}<div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">{hq("Loading providers…")}</div></div>;

  // Everything below is worked out from the lists already loaded (no extra reads): merge the subscription row (status / price / trial end,
  // the same numbers the tiles use) with the provider's own record (email, card), then filter, sort and total the visible set.
  const now = new Date();
  const enriched = providers.map((p) => {
    const r = subRows[p.id];
    const sub = p.subscription ?? {};
    return {
      p,
      f: {
        id: p.id, name: p.name, ownerEmail: p.ownerEmail, contactEmail: p.contactEmail, createdAt: p.createdAt,
        status: r?.status ?? (sub.status as string) ?? "none",
        trialEndsAt: r?.trialEndsAt ?? (sub.trialEndsAt as string | null) ?? null,
        hasCard: !!sub.cardLast4,
        price: r?.price ?? (sub.price as number | null) ?? null,
      } as ProviderLike,
    };
  });
  const pool = showTest ? enriched : enriched.filter((e) => !isTestAccount(e.f));
  const hidden = enriched.length - pool.length;
  const summary = tiles(pool.map((e) => e.f));
  const inKind = pool.filter((e) => matchesSearch(e.f, search) && (filter === "all" || kindOf(e.p) === filter));
  const tabCount = (t: StatusTab) => inKind.filter((e) => classify(e.f, now).has(t)).length;
  const shown = sortProviders(inKind.filter((e) => classify(e.f, now).has(stTab)).map((e) => e.f), sort, now);
  const byId = new Map(enriched.map((e) => [e.p.id, e]));

  return (
    <div className="text-[var(--ink)]">
      {tabs}
      <p className="mb-4 text-[12.5px] text-[var(--ink-3)]">{hq("Every tenant on the platform — {n}, what they’re on and the revenue it adds up to. Click a row for the full signup record and subscription.", { n: pool.length })}</p>

      {summary && (
        <div className="mb-1 grid gap-3 sm:grid-cols-4">
          {([[hq("Providers"), String(summary.total)], [hq("Monthly recurring"), hq("{amount}/mo", { amount: gbp(summary.mrr) })], [hq("On trial"), String(summary.trialing)], [hq("Active"), String(summary.active)]] as [string, string][]).map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{k}</div>
              <div className="mt-1 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{v}</div>
            </div>
          ))}
        </div>
      )}

      <div className="mb-5 mt-1.5 flex flex-wrap items-center gap-3 text-[12px] text-[var(--ink-3)]">
        <label className="flex cursor-pointer items-center gap-2 font-semibold text-[var(--ink-2)]">
          <input type="checkbox" role="switch" checked={!showTest} onChange={(e) => setShowTest(!e.target.checked)} className="h-4 w-4 accent-[#1d3a8f]" />
          {hq("Hide test accounts")}
        </label>
        {hidden > 0 && <span>{hq("excluding {n} test accounts", { n: hidden })}</span>}
      </div>

      <InviteProviders />

      <div className="mb-3 mt-6 flex flex-wrap items-center gap-2">
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={hq("Search name, email or tenant id…")} aria-label={hq("Search name, email or tenant id…")}
          className="min-w-[220px] flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[12.5px] text-[var(--ink)] outline-none focus:border-[#1d3a8f]" />
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label={hq("Sort by")}
          className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[12.5px] font-semibold text-[var(--ink)]">
          {SORT_KEYS.map((k) => <option key={k} value={k}>{hq(SORT_LABEL[k])}</option>)}
        </select>
      </div>

      <div className="mb-2 flex flex-wrap gap-2">
        {STATUS_TABS.map((t) => {
          const on = stTab === t;
          return (
            <button key={t} type="button" onClick={() => setStTab(t)}
              className="rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-colors"
              style={on ? { borderColor: "#1d3a8f", background: "#1d3a8f", color: "#fff" } : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-2)" }}>
              {hq(TAB_LABEL[t])} <span className={on ? "text-white/70" : "text-[var(--ink-3)]"}>{tabCount(t)}</span>
            </button>
          );
        })}
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const n = f.id === "all" ? pool.filter((e) => matchesSearch(e.f, search)).length : pool.filter((e) => matchesSearch(e.f, search) && kindOf(e.p) === f.id).length;
          const on = filter === f.id;
          return (
            <button key={f.id} type="button" onClick={() => setFilter(f.id)}
              className="rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-colors"
              style={on ? { borderColor: "#1d3a8f", background: "#1d3a8f", color: "#fff" } : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-2)" }}>
              {hq(f.label)} <span className={on ? "text-white/70" : "text-[var(--ink-3)]"}>{n}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        {shown.length === 0 && <div className="py-8 text-center text-[12.5px] text-[var(--ink-3)]">{hq("No providers match")}</div>}
        {shown.map((f) => {
          const p = byId.get(f.id)!.p;
          const sub = p.subscription ?? {};
          const status = f.status;
          const left = isOnTrial(f, now) ? trialDaysLeft(f.trialEndsAt, now) : null;
          const planName = (sub.plan as string) ?? subRows[p.id]?.plan ?? null;
          const sm = SM[status] ?? SM.none;
          const isOpen = open === p.id;
          return (
            <div key={p.id} className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(16,24,40,.04)]">
              <button type="button" onClick={() => setOpen(isOpen ? null : p.id)} className="flex w-full flex-wrap items-center gap-3 px-3.5 py-3 text-start hover:bg-[var(--panel)]">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-[15px] font-extrabold text-white shadow-sm" style={{ background: grad(p.name) }}>{initials(p.name)}</span>
                <div className="min-w-0">
                  <div className="text-[14.5px] font-extrabold">{p.name}</div>
                  <div className="text-[11.5px] text-[var(--ink-3)]">{p.ownerEmail ?? "—"} · {hq("since {date}", { date: fmt(p.createdAt).replace(", 2026", "") })}</div>
                  {status === "trialing" && f.trialEndsAt && (
                    <div className="text-[11.5px] font-semibold text-[#1d3a8f]">
                      {isOnTrial(f, now) ? `${hq("Trial ends")} ${fmt(f.trialEndsAt)}${left != null ? ` · ${daysText(left)}` : ""}` : `${hq("Trial ended")} ${fmt(f.trialEndsAt)}`}
                      {!f.hasCard && ` · ${hq("No card")}`}
                    </div>
                  )}
                </div>
                <div className="ms-auto flex items-center gap-2">
                  {planName && <span className="rounded-full bg-[#f4f6fb] px-2.5 py-0.5 text-[11px] font-bold text-[var(--ink-2)]">{hq(planName.charAt(0).toUpperCase() + planName.slice(1))}</span>}
                  {f.price != null && <span className="rounded-full bg-[#f4f6fb] px-2.5 py-0.5 text-[11px] font-bold tabular-nums text-[var(--ink-2)]">{feeLabel({ ...sub, price: f.price }) ?? ""}</span>}
                  <span className="rounded-full bg-[#eaf0fc] px-2.5 py-0.5 text-[11px] font-bold text-[#1d3a8f]">{hq(kindOf(p).charAt(0).toUpperCase() + kindOf(p).slice(1))}</span>
                  <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: sm.bg, color: sm.fg }}>{hq(sm.label)}</span>
                  <span className={`text-[13px] transition-transform ${isOpen ? "rotate-90" : ""} text-[var(--ink-3)]`}>▸</span>
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-[var(--line)] bg-[var(--panel)] px-3.5 py-3">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Section title={hq("Signup answers")}>
                      <Row k={hq("Business name")} v={p.name} />
                      <Row k={hq("Email")} v={p.contactEmail ?? p.ownerEmail ?? "—"} />
                      <Row k={hq("Phone")} v={p.phone ?? "—"} />
                      <Row k={hq("Shown to parents as")} v={p.providerName ? `${p.providerName} (${p.providerNameMode === "person" ? hq("own name") : hq("business name")})` : "—"} />
                      <Row k={hq("What they run")} v={p.activityKinds.length ? p.activityKinds.join(", ") : "—"} />
                      <Row k={hq("Based")} v={[p.address, p.postcode].filter(Boolean).join(", ") || "—"} />
                      <Row k={hq("Heard about us")} v={p.heardAbout ?? "—"} />
                      <Row k={hq("Invite ref")} v={p.referredBy ?? "—"} />
                      {p.logoUrl && <div className="mt-1"><span className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{hq("Logo")}</span><br /><img src={p.logoUrl} alt="" className="mt-1 h-9 max-w-[120px] rounded border border-[var(--line)] object-contain" /></div>}
                    </Section>
                    <Section title={hq("Subscription")}>
                      <Row k={hq("Plan")} v={sub.plan ? `${hq(String(sub.plan).charAt(0).toUpperCase() + String(sub.plan).slice(1))}${sub.band ? ` · ${sub.band}` : ""}` : "—"} />
                      <Row k={hq("Status")} v={hq(sm.label)} />
                      <Row k={hq("Fee")} v={feeLabel(sub) ?? "—"} />
                      <Row k={hq("Trial ends")} v={sub.trialEndsAt ? fmt(sub.trialEndsAt as string) : "—"} />
                      <Row k={hq("Renews / cancels")} v={fmt((sub.cancelAt as string) ?? (sub.currentPeriodEnd as string))} />
                      <Row k={hq("Staff")} v={`${p.staffCount}${sub.staffLimit != null ? ` / ${sub.staffLimit}` : ""}`} />
                      <Row k={hq("Started")} v={sub.since ? fmt(sub.since as string) : "—"} />
                      {p.bank && <Row k={hq("Payout bank")} v={`${p.bank.bankName ?? ""} ${p.bank.sortCode ?? ""} ${p.bank.accountNumber ? `••••${String(p.bank.accountNumber).slice(-4)}` : ""}`.trim() || "—"} />}
                      <Row k={hq("Tenant id")} v={p.id} />
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
  useT();
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
  // The invite e-mail is sent to a provider: composed in the language the operator is using, with the signup link filled in.
  const mailto = `mailto:?subject=${encodeURIComponent(hq("You’re invited to run on {brand}"))}&body=${encodeURIComponent(hq("Hi,\n\nI’d love for you to run your camps, clubs & classes on {brand} — bookings, registers, payments and more in one place.\n\nSign up here (takes a couple of minutes):\n{link}\n\nAny questions, just reply to this email.\n\nThanks", { link }))}`;

  return (
    <div
      className="mb-2 overflow-hidden rounded-2xl text-white"
      style={{ background: "radial-gradient(120% 160% at 12% -30%, rgba(120,170,255,.5) 0%, transparent 55%), linear-gradient(120deg,#16306e 0%,#274ba3 58%,#3f78d8 100%)" }}
    >
      <div className="p-5">
        <div className="text-[11px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "#ffd23f" }}>{hq("Grow the platform")}</div>
        <div className="mt-0.5 text-[18px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{hq("📣 Invite a provider to sign up")}</div>
        <p className="mt-1 max-w-[520px] text-[12.5px] leading-snug text-white/85">
          {hq("Copy this link and send it to any camp, club or class provider. It opens the sign-up wizard and creates their own account — nothing to set up first.")}
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-[12.5px] font-semibold text-white outline-none placeholder:text-white/50"
            aria-label={hq("Provider sign-up invite link")}
          />
          <div className="flex gap-2">
            <button type="button" onClick={copy} className="rounded-full bg-[#ffd23f] px-4 py-2 text-[12.5px] font-extrabold text-[#3a2a00] transition-colors hover:brightness-105">
              {copied ? hq("✓ Copied") : hq("Copy link")}
            </button>
            <a href={mailto} className="rounded-full border border-white/30 bg-white/10 px-4 py-2 text-[12.5px] font-bold text-white transition-colors hover:bg-white/20">
              {hq("✉️ Email invite")}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
