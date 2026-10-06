"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { dateLocale } from "@/lib/i18n/format";
import { useT } from "@/lib/i18n/provider";
import { Card } from "@/components/ui";

// Parent side: "Your online sessions" at the top of My bookings. A booked online session shows a Join button that wakes up 10 minutes before the
// start (our own video room, once the host has started) or the provider's own link. No address is ever shown for an online session.

export interface MySession {
  listingId: string; listingName: string; date: string; children: string[];
  startsAt: string; endsAt: string; opensAt: string; closesAt: string;
  mode: "platform" | "own"; state: "early" | "open"; hostLive: boolean; link?: string; noLink?: boolean;
}

const clock = (iso: string) => new Date(iso).toLocaleTimeString(dateLocale(), { hour: "numeric", minute: "2-digit" });
const day = (iso: string) => new Date(iso).toLocaleDateString(dateLocale(), { weekday: "short", day: "numeric", month: "short" });

export function OnlineSessionsPanel() {
  const t = useT();
  const router = useRouter();
  const [list, setList] = useState<MySession[] | null>(null);
  const [, tick] = useState(0);
  const load = useCallback(() => { apiGet<MySession[]>("/api/online-sessions/mine").then(setList).catch(() => setList([])); }, []);
  useEffect(() => { load(); }, [load]);
  // Re-check every 10 s (whether the host has started, and whether the window has just opened).
  useEffect(() => { const id = window.setInterval(() => { tick((n) => n + 1); load(); }, 10_000); return () => window.clearInterval(id); }, [load]);
  if (!list || !list.length) return null;
  const now = Date.now();
  const btn = "inline-flex min-h-[44px] items-center justify-center rounded-full px-5 text-[14px] font-extrabold";
  return (
    <div data-testid="online-sessions-panel"><Card className="mb-4 p-4">
      <div className="mb-2 flex items-center gap-2 text-[15px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}><span aria-hidden>💻</span>{t("p9tx.osTitle")}</div>
      <div className="flex flex-col gap-2">
        {list.map((s) => {
          const open = now >= new Date(s.opensAt).getTime();
          const key = `${s.listingId}_${s.date}`;
          let action: React.ReactNode;
          if (s.mode === "own") {
            action = s.link
              ? <a href={s.link} target="_blank" rel="noreferrer" onClick={() => { void apiPost("/api/online-sessions/attended", { listingId: s.listingId, date: s.date }).catch(() => undefined); }} className={`${btn} bg-[#0f9d6b] text-white`} data-testid="os-open-link">{t("p9tx.osOpenLink")}</a>
              : <span className={`${btn} cursor-not-allowed bg-[var(--line)] text-[var(--ink-3)]`} data-testid="os-link-later">{s.noLink ? t("p9tx.osNoLink") : t("p9tx.osLinkAt", { time: clock(s.opensAt) })}</span>;
          } else if (!open) {
            action = <span className={`${btn} cursor-not-allowed bg-[var(--line)] text-[var(--ink-3)]`} data-testid="os-opens-later">{t("p9tx.osOpens", { time: clock(s.opensAt) })}</span>;
          } else if (!s.hostLive) {
            action = <span className={`${btn} cursor-wait bg-[#fff3d6] text-[#7a4b00]`} data-testid="os-waiting">{t("p9tx.osWaiting")}</span>;
          } else {
            action = <button type="button" onClick={() => router.push(`/custdash/session?l=${encodeURIComponent(s.listingId)}&d=${s.date}`)} className={`${btn} bg-[#0f9d6b] text-white`} data-testid="os-join">{t("p9tx.osJoin")}</button>;
          }
          return (
            <div key={key} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3.5 py-3">
              <div className="min-w-0">
                <div className="truncate text-[14.5px] font-extrabold">{s.listingName}</div>
                <div className="text-[12.5px] text-[var(--ink-3)]">{day(s.startsAt)} · {clock(s.startsAt)} · {t("p9tx.osOnline")}{s.children.length ? ` · ${t("p9tx.osFor", { names: s.children.join(", ") })}` : ""}</div>
                {s.mode !== "own" && open && !s.hostLive && <div className="mt-0.5 text-[12px] font-semibold text-[#7a4b00]">{t("p9tx.osWaitingHint")}</div>}
              </div>
              {action}
            </div>
          );
        })}
      </div>
    </Card></div>
  );
}
