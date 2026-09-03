"use client";

// Head-office READ-ONLY oversight across every franchise — safeguarding/incidents,
// accidents or medication. Shows a per-franchise breakdown + a records list, each
// tagged with the franchise it belongs to. The head office watches the whole
// network here; to act on a record it drills into that franchise.

import { useEffect, useMemo, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { Card } from "@/components/ui";
import { setHoScopeId } from "@/components/franchise/HoScope";

type Area = "incidents" | "accidents" | "medication";
interface Rec {
  id: string; kind: string; childName: string; franchiseId: string | null; franchiseName: string; when: string | null; open: boolean;
  medicine?: string; dose?: string; bodyPart?: string; injury?: string; summary?: string;
}
interface FrBucket { franchiseId: string | null; name: string; total: number; open: number; last30: number }
interface Payload { area: Area; records: Rec[]; byFranchise: FrBucket[]; totals: { records: number; open: number; last30: number } }

const META: Record<Area, { icon: string; title: string; lede: string; noun: string }> = {
  incidents: { icon: "🛡️", title: "Safeguarding & incidents", lede: "Every concern and incident logged across your network — view-only oversight.", noun: "records" },
  accidents: { icon: "🩹", title: "Accidents", lede: "Every accident logged across your network — view-only oversight.", noun: "accidents" },
  medication: { icon: "💊", title: "Medication", lede: "Every authorised medication across your network — view-only oversight.", noun: "medications" },
};
const PALETTE = ["#2f6bd8", "#e0483d", "#0f9d58", "#f5b81f", "#8e44ad", "#e67e22", "#16a085", "#c2185b"];
const KIND_TAG: Record<string, { label: string; bg: string; fg: string }> = {
  accident: { label: "Accident", bg: "#fdf0e3", fg: "#b45309" },
  incident: { label: "Incident", bg: "#eef4fd", fg: "#1d3a8f" },
  safeguarding: { label: "Safeguarding", bg: "#fdecec", fg: "#c0392b" },
  medication: { label: "Medication", bg: "#f3f0fb", fg: "#6d28d9" },
};
const fmtWhen = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");

export function HoOversightApp({ area }: { area: Area }) {
  const [d, setD] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fFilter, setFFilter] = useState<string>("all");
  const meta = META[area];

  useEffect(() => { setD(null); apiGet<Payload>(`/api/ho/oversight/${area}`).then(setD).catch((e) => setError(e instanceof Error ? e.message : "Couldn't load")); }, [area]);

  const colorOf = (fid: string | null) => (fid == null ? "#64748b" : PALETTE[Math.max(0, (d?.byFranchise ?? []).filter((b) => b.franchiseId).findIndex((b) => b.franchiseId === fid)) % PALETTE.length]);
  const records = useMemo(() => (d?.records ?? []).filter((r) => fFilter === "all" || (fFilter === "__ho__" ? !r.franchiseId : r.franchiseId === fFilter)), [d, fFilter]);
  const maxTotal = Math.max(1, ...(d?.byFranchise ?? []).map((b) => b.total));

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[#f6f6f8] p-5 text-[#171534]">
      <div className="mx-auto max-w-[1120px]">
        <div className="op-hero relative mb-3.5 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(0,0,0,.5)]" style={{ background: "var(--hero-grad)" }}>
          <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-[16px]">{meta.icon}</span>
            {meta.title}
          </div>
          <p className="mt-1.5 max-w-[620px] text-[12.5px] leading-[1.5] text-white/80">{meta.lede}</p>
        </div>

        <div className="mb-3 flex items-center gap-2 rounded-lg border border-[#dbe6fb] bg-[#eef4fd] px-3 py-2 text-[12px] font-bold text-[#1d3a8f]">👁 View-only across the network — open a franchise to add, edit or close a record.</div>
        {error && <div className="mb-3 rounded-lg border border-[#f6c9cc] bg-[#fdebec] px-3 py-2 text-[12.5px] text-[#e21d27]">{error}</div>}
        {!d ? (
          <div className="py-16 text-center text-[13px] text-[var(--ink-3)]">Loading…</div>
        ) : (
          <>
            {/* Summary tiles */}
            <div className="mb-3 grid grid-cols-3 gap-2.5">
              {[["Total", String(d.totals.records)], ["Open / unresolved", String(d.totals.open)], ["Last 30 days", String(d.totals.last30)]].map(([k, v], i) => (
                <Card key={k} className="p-4"><div className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{k}</div><div className={"mt-1 text-[22px] font-extrabold tabular-nums " + (i === 1 && d.totals.open > 0 ? "text-[#c0392b]" : "")} style={{ fontFamily: "var(--ff-display)" }}>{v}</div></Card>
              ))}
            </div>

            {/* Per-franchise breakdown */}
            <Card className="mb-3 p-4">
              <div className="mb-2.5 flex items-center justify-between">
                <div className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">By franchise</div>
                <button type="button" onClick={() => setFFilter("all")} className={"rounded-md px-2.5 py-1 text-[11.5px] font-extrabold " + (fFilter === "all" ? "bg-[#171534] text-white" : "border border-[var(--line)] text-[var(--ink-2)]")}>All · {d.totals.records}</button>
              </div>
              <div className="flex flex-col gap-1.5">
                {d.byFranchise.map((b) => {
                  const key = b.franchiseId ?? "__ho__";
                  const active = fFilter === key;
                  return (
                    <button key={key} type="button" onClick={() => setFFilter(active ? "all" : key)} className={"flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors " + (active ? "border-[#171534] bg-[var(--panel)]" : "border-[var(--line)] hover:bg-[var(--panel)]")}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-[12.5px] font-extrabold">
                          {b.franchiseId == null && <span className="rounded-full bg-[#17181c] px-1.5 py-0.5 text-[9px] font-black uppercase text-white">HO</span>}
                          <span className="truncate">{b.name}</span>
                          {b.open > 0 && <span className="rounded-full bg-[#fdecec] px-1.5 py-0.5 text-[9.5px] font-black text-[#c0392b]">{b.open} open</span>}
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full" style={{ width: `${(b.total / maxTotal) * 100}%`, background: colorOf(b.franchiseId) }} /></div>
                      </div>
                      <div className="flex-none text-right"><div className="text-[14px] font-black tabular-nums">{b.total}</div><div className="text-[10px] font-bold text-[var(--ink-3)]">{b.last30} in 30d</div></div>
                    </button>
                  );
                })}
              </div>
            </Card>

            {/* Records list (read-only) */}
            <Card className="p-0">
              <div className="border-b border-[var(--line)] px-4 py-3 text-[13px] font-extrabold">{meta.title} <span className="font-bold text-[var(--ink-3)]">· {records.length} {meta.noun}</span></div>
              {records.length === 0 ? (
                <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">No {meta.noun} to show.</div>
              ) : (
                <div className="flex flex-col divide-y divide-[var(--line-2,#eef2f8)]">
                  {records.map((r) => {
                    const tag = KIND_TAG[r.kind] ?? KIND_TAG.incident;
                    return (
                      <div key={r.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-[12.5px]">
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-extrabold" style={{ background: tag.bg, color: tag.fg }}>{tag.label}</span>
                        <span className="font-extrabold">{r.childName}</span>
                        {area === "medication"
                          ? <span className="text-[var(--ink-2)]">{r.medicine}{r.dose ? ` · ${r.dose}` : ""}</span>
                          : r.summary && <span className="text-[var(--ink-2)]">{r.summary}{r.bodyPart ? ` (${r.bodyPart})` : ""}</span>}
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: `${colorOf(r.franchiseId)}1a`, color: colorOf(r.franchiseId) }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: colorOf(r.franchiseId) }} />{r.franchiseName}</span>
                        {r.open && area !== "medication" && <span className="rounded-full bg-[#fdecec] px-1.5 py-0.5 text-[9.5px] font-black text-[#c0392b]">Open</span>}
                        <span className="ml-auto text-[11px] text-[var(--ink-3)]">{fmtWhen(r.when)}</span>
                        {r.franchiseId && <button type="button" onClick={() => setHoScopeId(r.franchiseId!)} className="text-[11px] font-extrabold text-[#2f6bd8] hover:underline">Open →</button>}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
