"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { get as apiGet } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { dateLocale } from "@/lib/i18n/format";
import { useT } from "@/lib/i18n/provider";
import { Card, Button } from "@/components/ui";

// Provider side: "Online sessions today" with who has booked and who has joined, and the Start / Join-as-host button.
interface Row { listingId: string; name: string; date: string; startsAt: string; endsAt: string; status: "scheduled" | "live" | "ended"; mode: "platform" | "own"; booked: number; joined: number; link?: string | null }
const clock = (iso: string) => new Date(iso).toLocaleTimeString(dateLocale(), { hour: "numeric", minute: "2-digit", timeZone: "Europe/London" }); // UK time everywhere (not the browser's timezone)

export function HostSessionsCard() {
  const t = useT();
  const router = useRouter();
  const portal = (usePathname() ?? "").split("/")[1] || "freelancer";
  const [rows, setRows] = useState<Row[] | null>(null);
  const load = useCallback(() => { apiGet<Row[]>("/api/online-sessions/today").then(setRows).catch(() => setRows([])); }, []);
  useEffect(() => { load(); const id = window.setInterval(load, 15_000); return () => window.clearInterval(id); }, [load]);
  useRealtime(["bookings", "registers"], load);
  if (!rows || !rows.length) return null;
  return (
    <div data-testid="host-sessions-card"><Card className="mb-4 p-4">
      <div className="mb-2 flex items-center gap-2 text-[15px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}><span aria-hidden>💻</span>{t("p9tx.osHostTitle")}</div>
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <div key={`${r.listingId}_${r.date}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3.5 py-3">
            <div className="min-w-0">
              <div className="truncate text-[14.5px] font-extrabold">{r.name}</div>
              <div className="text-[12.5px] text-[var(--ink-3)]">{clock(r.startsAt)} · {t("p9tx.osBooked", { n: r.booked })} · {t("p9tx.osJoined", { n: r.joined })} · {r.status === "live" ? t("p9tx.osLive") : r.status === "ended" ? t("p9tx.osEnded") : t("p9tx.osNotStarted")}</div>
            </div>
            {r.mode === "own"
              ? (r.link ? <a href={r.link} target="_blank" rel="noreferrer"><Button variant="primary">{t("p9tx.osOpenLink")}</Button></a> : <span className="text-[12.5px] text-[#b91c1c]">{t("p9tx.osNoLink")}</span>)
              : <Button variant="primary" onClick={() => router.push(`/${portal}/session?l=${encodeURIComponent(r.listingId)}&d=${r.date}`)} data-testid="os-start">{r.status === "live" ? t("p9tx.osJoinHost") : t("p9tx.osStart")}</Button>}
          </div>
        ))}
      </div>
    </Card></div>
  );
}
