"use client";

import { useEffect, useState } from "react";
import { get as apiGet, api } from "@/lib/api";

// HQ Leads — demo/"Book a demo" requests captured from the marketing site's
// public /demo form (POST /api/leads). Work the pipeline: New → Contacted →
// Won / Lost. New leads also ping the HQ bell (platformNotifications "lead").
interface Lead {
  id: string; name: string; email: string; phone?: string; business?: string;
  size?: string; message?: string; source?: string; status: string; createdAt: string;
}

const STATUSES = ["new", "contacted", "won", "lost"] as const;
const TONE: Record<string, { bg: string; fg: string; label: string }> = {
  new: { bg: "rgba(255,61,127,.14)", fg: "#C81E5E", label: "New" },
  contacted: { bg: "rgba(245,185,74,.16)", fg: "#f5b94a", label: "Contacted" },
  won: { bg: "rgba(52,211,193,.16)", fg: "#0e7a75", label: "Won" },
  lost: { bg: "rgba(139,151,188,.16)", fg: "#5F6A88", label: "Lost" },
};

// Where a lead came from. Today the website demo form is the only source, but
// the field is stored per-lead so more can be added later (referral, event…).
const SOURCE: Record<string, { label: string; emoji: string }> = {
  demo: { label: "Demo request", emoji: "📩" },
};
const srcMeta = (s?: string) => SOURCE[s || "demo"] || { label: (s || "Website").replace(/^\w/, (c) => c.toUpperCase()), emoji: "🌐" };

function fmt(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()} ${d.toLocaleString("en-GB", { month: "short" })} · ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

export function LeadsApp() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [src, setSrc] = useState<string>("all");

  const load = () => apiGet<{ leads: Lead[] }>("/api/leads").then((r) => setLeads(r.leads || [])).catch(() => setLeads([])).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const setStatus = async (id: string, status: string) => {
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, status } : l)));
    await api(`/api/leads/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }).catch(() => {});
  };

  const shown = leads.filter((l) => (filter === "all" || l.status === filter) && (src === "all" || (l.source || "demo") === src));
  const counts = STATUSES.reduce((a, s) => ({ ...a, [s]: leads.filter((l) => l.status === s).length }), {} as Record<string, number>);
  const sources = Array.from(new Set(leads.map((l) => l.source || "demo")));

  return (
    <div>
      <div className="op-hero relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: "var(--hero-grad)" }}>
        <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">💬</span>Leads
        </div>
        <p className="mt-1.5 max-w-[640px] text-[12.5px] leading-[1.5] text-white/85">Demo requests from the website — {counts.new || 0} new to follow up.</p>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {(["all", ...STATUSES] as const).map((s) => (
          <button key={s} type="button" onClick={() => setFilter(s)}
            className="rounded-full px-3.5 py-1.5 text-[12.5px] font-extrabold transition-colors"
            style={filter === s
              ? { background: "var(--brand)", color: "#fff" }
              : { background: "var(--surface)", color: "var(--ink-2)", border: "1px solid var(--line)" }}>
            {s === "all" ? `All · ${leads.length}` : `${TONE[s].label} · ${counts[s] || 0}`}
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-extrabold uppercase tracking-[.06em] text-[var(--ink-3)]">Source</span>
        <button type="button" onClick={() => setSrc("all")}
          className="rounded-full px-3 py-1 text-[12px] font-extrabold transition-colors"
          style={src === "all" ? { background: "var(--brand)", color: "#fff" } : { background: "var(--surface)", color: "var(--ink-2)", border: "1px solid var(--line)" }}>
          All
        </button>
        {sources.map((s) => (
          <button key={s} type="button" onClick={() => setSrc(s)}
            className="rounded-full px-3 py-1 text-[12px] font-extrabold transition-colors"
            style={src === s ? { background: "var(--brand)", color: "#fff" } : { background: "var(--surface)", color: "var(--ink-2)", border: "1px solid var(--line)" }}>
            {srcMeta(s).emoji} {srcMeta(s).label} · {leads.filter((l) => (l.source || "demo") === s).length}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-8 text-center text-[var(--ink-3)]">Loading leads…</div>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-10 text-center text-[var(--ink-3)]">
          No leads yet. Demo requests from the website land here.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {shown.map((l) => {
            const tone = TONE[l.status] || TONE.new;
            return (
              <div key={l.id} className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <b className="text-[15px] text-[var(--ink)]">{l.name}</b>
                      {l.business && <span className="text-[13px] text-[var(--ink-3)]">· {l.business}</span>}
                      <span className="rounded-full px-2.5 py-0.5 text-[11px] font-extrabold" style={{ background: tone.bg, color: tone.fg }}>{tone.label}</span>
                      <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: "var(--panel)", color: "var(--ink-2)", border: "1px solid var(--line)" }} title="How this lead reached you">{srcMeta(l.source).emoji} {srcMeta(l.source).label}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[12.5px] text-[var(--ink-2)]">
                      <a href={`mailto:${l.email}`} className="font-semibold hover:underline" style={{ color: "var(--brand)" }}>✉️ {l.email}</a>
                      {l.phone && <a href={`tel:${l.phone}`} className="hover:underline">📞 {l.phone}</a>}
                      {l.size && <span>👥 {l.size}</span>}
                      <span className="text-[var(--ink-3)]">{fmt(l.createdAt)}</span>
                    </div>
                    {l.message && <p className="mt-2 max-w-[70ch] rounded-lg bg-[var(--panel)] p-2.5 text-[12.5px] leading-[1.5] text-[var(--ink-2)]">{l.message}</p>}
                  </div>
                  <div className="flex flex-none flex-wrap gap-1.5">
                    {STATUSES.filter((s) => s !== l.status).map((s) => (
                      <button key={s} type="button" onClick={() => setStatus(l.id, s)}
                        className="rounded-lg px-2.5 py-1.5 text-[11.5px] font-extrabold transition-colors"
                        style={{ background: "var(--panel)", color: TONE[s].fg, border: "1px solid var(--line)" }}>
                        → {TONE[s].label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
