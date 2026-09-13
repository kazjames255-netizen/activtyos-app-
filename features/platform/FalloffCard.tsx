"use client";

// "Fall-off" — who's still with us against who left. The dashboard's answer to
// "is the leak getting worse": one bar for the whole book (paying · on trial ·
// leaving · gone), the retention rate that falls out of it, and cancellations
// per month across the last six so a bad month is obvious.
//
// Read from GET /api/platform/providers — each tenant's `subscription` carries
// its status and, when it ended, `canceledAt`. Same source as Providers &
// billing, so the counts can't disagree with that page.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { get as apiGet } from "@/lib/api";

interface Provider {
  id: string;
  name: string;
  createdAt?: string | null;
  subscription?: { status?: string; canceledAt?: string; plan?: string; fee?: number } | null;
}

// The four states a provider can be in, in the order they appear on the bar:
// still paying, still trying, on their way out, gone.
const BANDS = [
  { key: "active", label: "Paying", colour: "#0f7a43" },
  { key: "trialing", label: "On trial", colour: "#2f5fd0" },
  { key: "canceling", label: "Leaving", colour: "#b45309" },
  { key: "canceled", label: "Cancelled", colour: "#c02636" },
] as const;

const MONTHS = 6;
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
// Churn is small by nature, so a whole number hides the difference between a
// good month and a bad one. One decimal, unless it's a clean zero.
const fmtPct = (n: number) => (n === 0 ? "0%" : `${n < 10 ? Math.round(n * 10) / 10 : Math.round(n)}%`);

export function FalloffCard() {
  const router = useRouter();
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [nowMs] = useState(() => Date.now());
  const load = useCallback(() => {
    apiGet<{ providers: Provider[] }>("/api/platform/providers")
      .then((r) => { setProviders(r?.providers ?? []); setFailed(false); })
      // A failed load isn't "no providers" — say it didn't load (acceptance d27s1).
      .catch(() => { setProviders([]); setFailed(true); });
  }, []);
  useEffect(load, [load]);

  const { counts, total, live, gone, retention, months, worst, lostThisMonth } = useMemo(() => {
    const list = providers ?? [];
    // past_due is still a customer — they've a card problem, they haven't left.
    const statusOf = (p: Provider) => {
      const s = p.subscription?.status ?? "active";
      return s === "canceled" ? "canceled" : s === "canceling" ? "canceling" : s === "trialing" ? "trialing" : "active";
    };
    const counts = Object.fromEntries(BANDS.map((b) => [b.key, list.filter((p) => statusOf(p) === b.key).length])) as Record<string, number>;
    const gone = counts.canceled;
    const live = list.length - gone;

    // Cancellations by month, oldest first. A cancellation with no date can't
    // be placed on the chart — it still counts in the bar above.
    const now = new Date(nowMs);
    const months = Array.from({ length: MONTHS }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (MONTHS - 1 - i), 1);
      return { key: monthKey(d), label: d.toLocaleDateString("en-GB", { month: "short" }), startMs: d.getTime(), count: 0, base: 0, pct: 0 };
    });
    const byKey = new Map(months.map((m) => [m.key, m]));
    for (const p of list) {
      const at = p.subscription?.canceledAt;
      if (!at) continue;
      const d = new Date(at);
      if (Number.isNaN(d.getTime())) continue;
      const m = byKey.get(monthKey(d));
      if (m) m.count++;
    }

    // The count alone can't say whether a month was bad — 4 out of 200 and 4
    // out of 12 are different stories. So each month also carries the rate:
    // cancellations against the providers who were actually on the books when
    // that month opened (signed up before it, not already gone).
    const msOf = (s?: string | null) => {
      if (!s) return null;
      const t = new Date(s).getTime();
      return Number.isNaN(t) ? null : t;
    };
    for (const m of months) {
      m.base = list.filter((p) => {
        // No createdAt means we can't date the signup — assume they predate the
        // window rather than dropping them out of the denominator entirely.
        const created = msOf(p.createdAt);
        if (created !== null && created >= m.startMs) return false;  // joined later
        const left = msOf(p.subscription?.canceledAt);
        return left === null || left >= m.startMs;                   // already gone
      }).length;
      m.pct = m.base ? (m.count / m.base) * 100 : 0;
    }

    return {
      counts, total: list.length, live, gone,
      retention: list.length ? Math.round((live / list.length) * 100) : 100,
      months,
      worst: Math.max(1, ...months.map((m) => m.count)),
      lostThisMonth: months[months.length - 1]?.count ?? 0,
    };
  }, [providers, nowMs]);

  const prevMonth = months[months.length - 2]?.count ?? 0;
  const trend = lostThisMonth - prevMonth;

  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(16,32,90,.04)]">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-[var(--line)] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span aria-hidden className="flex h-7 w-7 flex-none items-center justify-center rounded-xl text-[14px] leading-none shadow-sm" style={{ background: "linear-gradient(150deg,#f0768a,#a31427)" }}>📉</span>
          <h3 className="m-0 truncate text-[14px] font-extrabold leading-tight text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>Fall-off</h3>
          <span className="flex-none rounded-full bg-[var(--panel)] px-2 py-0.5 text-[10.5px] font-extrabold text-[var(--ink-2)]">Live vs cancelled</span>
        </div>
        <button type="button" onClick={() => router.push("/platform/providers")} className="flex-none text-[11px] font-bold text-[var(--brand)] hover:underline">Providers &amp; billing →</button>
      </div>

      {providers === null ? (
        <div className="py-6 text-center text-[12px] text-[var(--ink-3)]">Loading providers…</div>
      ) : total === 0 ? (
        <div className="py-6 text-center text-[12px] text-[var(--ink-3)]">{failed ? <>Couldn&apos;t load providers — is the server running? <button type="button" onClick={load} className="font-bold text-[var(--brand)] underline">Try again</button></> : "No providers yet."}</div>
      ) : (
        <div className="grid gap-4 p-4 lg:grid-cols-[1.35fr_1fr]">
          {/* The whole book in one bar — how much of it is still yours. */}
          <div>
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]">Still with us</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[27px] font-extrabold leading-none tabular-nums text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{live}</span>
                  <span className="text-[12.5px] font-bold text-[var(--ink-3)]">of {total} · {retention}% retained</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]">Cancelled</div>
                <span className="text-[27px] font-extrabold leading-none tabular-nums" style={{ fontFamily: "var(--ff-display)", color: "#c02636" }}>{gone}</span>
              </div>
            </div>

            <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-[var(--panel)]">
              {BANDS.map((b) => counts[b.key] > 0 && (
                <span
                  key={b.key}
                  title={`${counts[b.key]} ${b.label.toLowerCase()}`}
                  style={{ width: `${(counts[b.key] / total) * 100}%`, background: b.colour }}
                />
              ))}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1">
              {BANDS.map((b) => (
                <span key={b.key} className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--ink-2)]">
                  <span className="h-2 w-2 rounded-full" style={{ background: b.colour }} aria-hidden />
                  {b.label} <span className="font-extrabold tabular-nums text-[var(--ink)]">{counts[b.key]}</span>
                </span>
              ))}
            </div>
            {counts.canceling > 0 && (
              <div className="mt-2.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold" style={{ background: "rgba(180,83,9,.08)", color: "#8a5a09" }}>
                {counts.canceling} {counts.canceling === 1 ? "provider has" : "providers have"} given notice — still paying until their term ends.
              </div>
            )}
          </div>

          {/* Is the leak getting worse? Six months of cancellations. */}
          <div className="rounded-xl border border-[var(--line)] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]">Cancellations by month</span>
              <span className="text-[11px] font-extrabold" style={{ color: trend > 0 ? "#c02636" : trend < 0 ? "#0f7a43" : "var(--ink-3)" }}>
                {trend === 0 ? "level" : `${trend > 0 ? "▲" : "▼"} ${Math.abs(trend)} vs last month`}
              </span>
            </div>
            <div className="mt-3 flex items-end gap-1.5" style={{ height: 64 }}>
              {months.map((m, i) => (
                <div key={m.key} className="flex flex-1 flex-col items-center justify-end" style={{ height: "100%" }} title={`${m.count} of ${m.base} cancelled in ${m.label} — ${fmtPct(m.pct)}`}>
                  <span className="mb-1 text-[10px] font-extrabold tabular-nums text-[var(--ink-2)]">{m.count}</span>
                  <div
                    className="w-full rounded-t-[3px]"
                    style={{
                      // A zero month still needs a visible floor, or the row
                      // reads as missing data rather than a clean month.
                      height: `${Math.max(3, (m.count / worst) * 100)}%`,
                      background: m.count === 0 ? "var(--line)" : "#c02636",
                      opacity: i === months.length - 1 ? 1 : 0.65,
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-1 flex gap-1.5 text-[9.5px] font-bold text-[var(--ink-3)]">
              {months.map((m) => <span key={m.key} className="flex-1 text-center">{m.label}</span>)}
            </div>
            {/* The rate under each month — a clean month reads grey, any loss
                reads red, so a small base with one cancellation still shows up. */}
            <div className="mt-0.5 flex gap-1.5 text-[9.5px] font-extrabold tabular-nums">
              {months.map((m) => (
                <span key={m.key} className="flex-1 text-center" style={{ color: m.count === 0 ? "var(--ink-3)" : "#c02636" }}>
                  {fmtPct(m.pct)}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="border-t border-[var(--line)] px-4 py-2 text-[10.5px] text-[var(--ink-3)]">
        Retention is providers still on the books against every provider ever signed up. A card problem (past due) counts as still with us; only a cancelled subscription counts as gone. The percentage under each month is that month&rsquo;s churn rate — cancellations against the providers who were on the books when the month opened.
      </div>
    </div>
  );
}
