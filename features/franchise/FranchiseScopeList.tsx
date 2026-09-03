"use client";

// A rich "choose a franchise" list used by the head-office Find-a-child and
// Find-a-family flows. Shows All franchises / Head office (direct) / each
// franchise, each with its live child + family counts so the head office can
// see where everyone is before drilling in. Presentational + self-fetching;
// calls onPick(scope) where scope = "__all__" | "__ho__" | a franchiseId.

import { useEffect, useMemo, useState } from "react";
import { get as apiGet } from "@/lib/api";

interface Fr { franchiseId: string; name: string; area: string | null }
interface Counts { children: number; families: number; bookings?: number }
interface Overview { franchises: (Counts & { franchiseId: string })[]; direct: Counts }

const PALETTE = ["#2f6bd8", "#e0483d", "#0f9d58", "#f5b81f", "#8e44ad", "#e67e22", "#16a085", "#c2185b"];

export function FranchiseScopeList({ onPick, noun = "children", hideAll = false }: { onPick: (scope: string, label: string) => void; noun?: "children" | "families"; hideAll?: boolean }) {
  const [franchises, setFranchises] = useState<Fr[] | null>(null);
  const [ov, setOv] = useState<Overview | null>(null);

  useEffect(() => {
    apiGet<Fr[]>("/api/franchises").then(setFranchises).catch(() => setFranchises([]));
    apiGet<Overview>("/api/ho/overview").then(setOv).catch(() => setOv(null));
  }, []);

  const totals = useMemo(() => {
    if (!ov) return { children: 0, families: 0 };
    const children = ov.franchises.reduce((s, f) => s + (f.children || 0), 0) + (ov.direct.children || 0);
    const families = ov.franchises.reduce((s, f) => s + (f.families || 0), 0) + (ov.direct.families || 0);
    return { children, families };
  }, [ov]);
  const countOf = (fid: string | null): Counts => (fid == null ? (ov?.direct ?? { children: 0, families: 0 }) : (ov?.franchises.find((f) => f.franchiseId === fid) ?? { children: 0, families: 0 }));
  const sub = (c: Counts) => `${c.children} children · ${c.families} ${c.families === 1 ? "family" : "families"}`;

  const Card = ({ icon, iconBg, iconInk, title, area, subline, onClick }: { icon: string; iconBg: string; iconInk?: string; title: React.ReactNode; area?: string | null; subline: string; onClick: () => void }) => (
    <button type="button" onClick={onClick} className="flex items-center gap-3 rounded-xl border border-[#e3e0ea] bg-white px-3.5 py-2.5 text-left text-[#171534] transition hover:border-[#171534] hover:bg-[#f7f6fb]">
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg text-[14px] font-extrabold" style={{ background: iconBg, color: iconInk }}>{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-extrabold text-[#171534]">{title}{area && <span className="font-semibold text-[#6b6880]"> · 📍 {area}</span>}</div>
        <div className="text-[11.5px] font-medium text-[#6b6880]">{subline}</div>
      </div>
      <span className="flex-none text-[15px] font-bold text-[#8a86a3]">›</span>
    </button>
  );

  return (
    <div className="flex flex-col gap-1.5">
      {!hideAll && <Card icon="🌐" iconBg="#ede9fe" title="All franchises" subline={ov ? sub(totals) : `Search every ${noun} across the network`} onClick={() => onPick("__all__", "All franchises")} />}
      <Card icon="🏛️" iconBg="#e6eaf5" title={<>Head office <span className="font-normal text-[var(--ink-3)]">· direct</span></>} subline={ov ? sub(countOf(null)) : "Your own locations"} onClick={() => onPick("__ho__", "Head office")} />
      {(franchises ?? []).map((f, i) => (
        <Card key={f.franchiseId} icon={f.name.slice(0, 1).toUpperCase()} iconBg={`${PALETTE[i % PALETTE.length]}1f`} iconInk={PALETTE[i % PALETTE.length]} title={f.name} area={f.area} subline={ov ? sub(countOf(f.franchiseId)) : "Franchise"} onClick={() => onPick(f.franchiseId, f.name)} />
      ))}
      {franchises && franchises.length === 0 && <div className="py-4 text-center text-[12px] text-[var(--ink-3)]">No franchises yet.</div>}
    </div>
  );
}
