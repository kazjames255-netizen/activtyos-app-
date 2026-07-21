"use client";

import { useCallback, useEffect, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Badge, Card } from "@/components/ui";

// The parent's view — "My child's day". Moments featuring their own children,
// across every provider. Only consented children ever appear (enforced when
// the moment is posted), so a family sees exactly what they agreed to.

interface Moment {
  id: string;
  photoUrl: string;
  caption?: string;
  childNames: string[];
  postedByName?: string;
  createdAt?: string;
}
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

export function ParentMomentsApp() {
  const [moments, setMoments] = useState<Moment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(() => {
    apiGet<Moment[]>("/api/moments").then((m) => { setMoments(m); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useRealtime(["children"], refresh);

  return (
    <div className="text-[var(--ink)]">
      <h2 className="mb-1 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>My child’s day</h2>
      <p className="mb-4 text-[12.5px] text-[var(--ink-3)]">Photos your provider has shared of your child.</p>
      {error && <div className="mb-3 text-[12.5px] text-[var(--red)]">{error}</div>}
      {!moments ? (
        <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
      ) : moments.length === 0 ? (
        <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">No moments yet — they’ll appear here when your provider shares one.</Card>
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {moments.map((m) => (
            <Card key={m.id} className="overflow-hidden p-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.photoUrl} alt={m.caption ?? ""} className="h-[200px] w-full object-cover" />
              <div className="p-3">
                {m.caption && <div className="text-[13px]">{m.caption}</div>}
                {m.childNames?.filter(Boolean).length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">{m.childNames.filter(Boolean).map((n, i) => <Badge key={i} tone={{ bg: "var(--panel)", fg: "var(--ink-2)" }}>{n}</Badge>)}</div>
                )}
                <div className="mt-1.5 text-[11px] text-[var(--ink-3)]">{m.postedByName} · {when(m.createdAt)}</div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
