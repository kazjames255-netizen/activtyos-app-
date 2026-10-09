"use client";

import { dateLocale as dl, uiDate } from "@/lib/i18n/format";
import { useCallback, useEffect, useState } from "react";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useT } from "@/lib/i18n/provider";
import { H, hq } from "./hqText";

interface Row { id: string; name: string; type: string; fee: number; contactEmail: string | null; phone: string | null; reason: string; detail: string; contactedAt: string | null }

const HERO = "radial-gradient(120% 160% at 12% -30%, rgba(120,170,255,.5) 0%, transparent 55%), linear-gradient(120deg,#16306e 0%,#274ba3 58%,#3f78d8 100%)";
const money = (n: number) => `£${n.toLocaleString(dl())}`;
const RISK: Record<string, { label: string; color: string; hint: string }> = {
  payment_failed: { label: H("Payment failed"), color: "#c02636", hint: H("card declined — will lapse") },
  cancelling: { label: H("Cancelling"), color: "#e8590c", hint: H("asked to cancel") },
  trial_ending: { label: H("Trial ending"), color: "#a5670a", hint: H("≤3 days left, no plan yet") },
  never_launched: { label: H("Never launched"), color: "#6b6880", hint: H("no bookings taken yet") },
  quiet: { label: H("Gone quiet"), color: "#b47e00", hint: H("no bookings in 45+ days") },
};

export function PlatformAtRiskApp() {
  useT(); // re-render on language change (labels are translated at render time)
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"todo" | "done">("todo");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    apiGet<{ rows: Row[] }>("/api/platform/at-risk").then((d) => { setRows(d.rows); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : hq("Failed to load")));
  }, []);
  useEffect(load, [load]);
  useRealtime(["tenants"], load);

  async function mark(id: string, contacted: boolean) {
    setBusy(id);
    try { await apiPost(`/api/platform/at-risk/${id}/contacted`, { contacted }); load(); }
    catch (e) { setError(e instanceof Error ? e.message : hq("Failed")); }
    finally { setBusy(null); }
  }

  if (error) return <div className="p-2 text-[12.5px] text-[var(--red)]">{error}</div>;
  if (!rows) return <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">{hq("Loading…")}</div>;

  const todo = rows.filter((r) => !r.contactedAt);
  const done = rows.filter((r) => r.contactedAt);
  const atRiskMrr = todo.reduce((a, b) => a + b.fee, 0);
  const list = tab === "todo" ? todo : done;

  return (
    <div className="text-[var(--ink)]">
      <div className="overflow-hidden rounded-2xl text-white" style={{ backgroundImage: `radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1.6px), ${HERO}`, backgroundSize: "18px 18px, cover, cover, cover, cover", backgroundRepeat: "repeat, no-repeat, no-repeat, no-repeat, no-repeat" }}>
        <div className="flex flex-wrap items-end justify-between gap-3 px-6 py-5">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-[0.12em]" style={{ color: "#ffd23f" }}>{hq("Platform · Head office")}</div>
            <h2 className="mt-0.5 text-[25px] font-extrabold" style={{ fontFamily: "var(--ff-display)", color: "#fff" }}>{hq("🚨 At risk — who to save")}</h2>
            <p className="mt-1 max-w-[640px] text-[12.5px] leading-snug text-white/85">{hq("Providers worth a call — flagged from their booking activity and subscription state, ranked most urgent first. Mark them off as you go.")}</p>
          </div>
          {todo.length > 0 && <span className="rounded-full bg-white/15 px-3 py-1 text-[12.5px] font-extrabold text-white">{hq("{amount}/mo at risk", { amount: money(atRiskMrr) })}</span>}
        </div>
      </div>

      {/* Key */}
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 text-[11px]">
        <span className="font-bold text-[var(--ink-2)]">{hq("Key:")}</span>
        {Object.entries(RISK).map(([k, r]) => (
          <span key={k} className="flex items-center gap-1.5" title={hq(r.hint)}><span className="h-2 w-2 rounded-full" style={{ background: r.color }} /><span className="font-bold text-[var(--ink-2)]">{hq(r.label)}</span><span className="text-[var(--ink-3)]">— {hq(r.hint)}</span></span>
        ))}
      </div>

      {/* Tabs */}
      <div className="mb-3 mt-4 inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--surface)] p-1 text-[12.5px] font-bold">
        {([["todo", hq("To contact · {n}", { n: todo.length })], ["done", hq("Contacted · {n}", { n: done.length })]] as const).map(([v, label]) => (
          <button key={v} type="button" onClick={() => setTab(v)} className="rounded-full px-3.5 py-1.5 transition-colors" style={tab === v ? { background: "#1d3a8f", color: "#fff" } : { color: "var(--ink-3)" }}>{label}</button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] py-12 text-center text-[13px] text-[var(--ink-3)]">{tab === "todo" ? hq("Nobody left to contact. 🎉") : hq("Nobody marked contacted yet.")}</div>
      ) : (
        <div className="flex flex-col gap-2">
          {list.map((p) => { const r = RISK[p.reason] ?? { label: p.reason, color: "#6b6880", hint: H("") }; return (
            <div key={p.id} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="min-w-0 flex-1 truncate text-[14px] font-extrabold">{p.name} <span className="text-[10.5px] font-normal text-[var(--ink-3)]">· {hq(p.type.charAt(0).toUpperCase() + p.type.slice(1))}</span></span>
                <span className="rounded-full px-2.5 py-0.5 text-[10.5px] font-bold text-white" style={{ background: r.color }}>{hq(r.label)}</span>
                {p.fee > 0 && <span className="w-16 text-end text-[13px] font-extrabold tabular-nums">{hq("{amount}/mo", { amount: money(p.fee) })}</span>}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]">
                <span className="font-semibold" style={{ color: r.color }}>{p.detail}</span>
                {p.contactEmail && <a href={`mailto:${p.contactEmail}?subject=${encodeURIComponent(hq("Your {brand} account"))}`} className="font-semibold text-[#1d3a8f] hover:underline">✉ {p.contactEmail}</a>}
                {p.phone && <a href={`tel:${p.phone}`} className="font-semibold text-[#1d3a8f] hover:underline">📞 {p.phone}</a>}
                {p.contactedAt && <span className="text-[var(--ink-3)]">· {hq("contacted {date}", { date: uiDate(new Date(p.contactedAt), { day: "numeric", month: "short" }) })}</span>}
                <span className="ms-auto">
                  {tab === "todo"
                    ? <button type="button" onClick={() => mark(p.id, true)} disabled={busy === p.id} className="rounded-full bg-[#0f7a43] px-3 py-1 text-[11.5px] font-bold text-white hover:brightness-110 disabled:opacity-50">{busy === p.id ? "…" : hq("✓ Mark contacted")}</button>
                    : <button type="button" onClick={() => mark(p.id, false)} disabled={busy === p.id} className="rounded-full border border-[var(--line)] px-3 py-1 text-[11.5px] font-bold text-[var(--ink-3)] hover:border-[var(--ink-3)] disabled:opacity-50">{busy === p.id ? "…" : hq("↩ Reopen")}</button>}
                </span>
              </div>
            </div>
          ); })}
        </div>
      )}
    </div>
  );
}
