"use client";

import { useCallback, useEffect, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Badge, Card } from "@/components/ui";

interface Record_ {
  id: string;
  kind: string;
  childName: string;
  date?: string;
  time?: string;
  location?: string;
  description?: string;
  firstAid?: string;
  treatment?: string;
  severity?: string;
  parentNotified?: boolean;
  followUp?: string;
}
const fmt = (d?: string, t?: string) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) + (t ? ` · ${t}` : "") : "");

export function ParentAccidentsApp() {
  const [records, setRecords] = useState<Record_[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    apiGet<Record_[]>("/api/incidents?kind=accident").then((r) => { setRecords(r); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtime(["children"], refresh);

  return (
    <div className="text-[var(--ink)]">
      <h2 className="mb-1 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Accidents</h2>
      <p className="mb-4 text-[12.5px] text-[var(--ink-3)]">Accident records the provider has logged for your child.</p>
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}

      {!records ? <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
      : records.length === 0 ? <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">No accident records — nothing’s been logged for your child.</Card>
      : (
        <div className="flex flex-col gap-2">
          {records.map((r) => (
            <Card key={r.id} className="p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-extrabold">{r.childName}</span>
                <span className="text-[11.5px] text-[var(--ink-3)]">{fmt(r.date, r.time)}</span>
                {r.severity && <Badge tone={r.severity === "serious" ? { bg: "var(--red-soft,#fdebec)", fg: "var(--red,#e21d27)" } : { bg: "#fdf3d8", fg: "#9a5a00" }}>{r.severity}</Badge>}
                {r.parentNotified && <Badge tone={{ bg: "#eaf0fc", fg: "#1d3a8f" }}>you were notified</Badge>}
              </div>
              {r.description && <div className="mt-1.5 text-[13px] text-[var(--ink-2)]">{r.description}</div>}
              <div className="mt-1 flex flex-col gap-0.5 text-[12px] text-[var(--ink-3)]">
                {r.location && <div><span className="font-bold text-[var(--ink-2)]">Where:</span> {r.location}</div>}
                {(r.firstAid || r.treatment) && <div><span className="font-bold text-[var(--ink-2)]">First aid:</span> {r.firstAid || r.treatment}</div>}
                {r.followUp && <div><span className="font-bold text-[var(--ink-2)]">Follow-up:</span> {r.followUp}</div>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
