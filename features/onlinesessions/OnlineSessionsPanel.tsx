"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { dateLocale } from "@/lib/i18n/format";
import { ukClock, ukDay } from "./time";
import { useI18n, useT } from "@/lib/i18n/provider";
import { isRTL } from "@/lib/i18n/config";
import { indexAfterReload, orderSessions, sessionKey } from "./order";
import { Card } from "@/components/ui";

// Parent side: "Your online sessions" at the top of My bookings. A booked online session shows a Join button that wakes up 10 minutes before the
// start (our own video room, once the host has started) or the provider's own link. No address is ever shown for an online session.

export interface MySession {
  listingId: string; listingName: string; date: string; children: string[];
  startsAt: string; endsAt: string; opensAt: string; closesAt: string;
  mode: "platform" | "own"; state: "early" | "open"; hostLive: boolean; link?: string; noLink?: boolean;
  /** The server decides what to show (lib/onlineRules joinState); this component only draws it. */
  joinState?: "unpaid" | "early" | "early_own" | "waiting_host" | "open" | "finished" | "no_link";
  paid?: boolean; amountDue?: number; method?: string; ref?: string; refs?: string[]; providerName?: string;
}

const clock = (iso: string) => ukClock(iso, dateLocale());
const day = (iso: string) => ukDay(iso, dateLocale());

/** `refs` limits the panel to those bookings (the "you are booked" screen); `providerName` words the bank-transfer hint. */
/** `compact` (the "you are booked" screen, which already has its own heading box): no card and no title, just the session state(s). */
export function OnlineSessionsPanel({ refs, providerName, compact, reloadKey }: { refs?: string[]; providerName?: string; compact?: boolean; reloadKey?: number } = {}) {
  const t = useT();
  const { locale } = useI18n();
  const rtl = isRTL(locale);
  const router = useRouter();
  const [curKey, setCurKey] = useState<string | null>(null);
  const touchX = useRef<number | null>(null);
  const [list, setList] = useState<MySession[] | null>(null);
  const [, tick] = useState(0);
  const load = useCallback(() => { apiGet<MySession[]>("/api/online-sessions/mine").then(setList).catch(() => setList([])); }, []);
  // `reloadKey` changes the moment a payment completes on the "you are booked" screen: re-ask at once, so "Pay to unlock" never sits next to "✓ Paid".
  useEffect(() => { load(); }, [load, reloadKey]);
  // Re-check every 10 s (whether the host has started, and whether the window has just opened).
  useEffect(() => { const id = window.setInterval(() => { tick((n) => n + 1); load(); }, 10_000); return () => window.clearInterval(id); }, [load]);
  const shown = (list ?? []).filter((s) => !refs?.length || (s.refs ?? []).some((r) => refs.includes(r)));
  const ordered = orderSessions(shown);
  if (!ordered.length) return null;
  const now = Date.now();
  // One session at a time, nearest first. The list reloads every 10 s: stay on the session being looked at while it still exists.
  const idx = indexAfterReload(ordered, curKey);
  const total = ordered.length;
  const go = (to: number) => setCurKey(sessionKey(ordered[(to + total) % total]));
  const next = () => go(idx + 1);
  const prev = () => go(idx - 1);
  const btn = "inline-flex min-h-[44px] items-center justify-center rounded-full px-5 text-[14px] font-extrabold";
  return (
    <div data-testid="online-sessions-panel"><Shell compact={compact}>
      {(!compact || total > 1) && <div className="mb-2 flex items-center gap-2 text-[15px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}><span aria-hidden>💻</span>{t("p9tx.osTitle")}{total > 1 ? ` · ${total}` : ""}
        {total > 1 && (
          <div className="ms-auto flex items-center gap-1.5" data-testid="os-nav">
            <button type="button" onClick={prev} aria-label={t("p9tx.osPrev")} data-testid="os-prev" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--panel)] text-[20px] font-extrabold hover:bg-[var(--brand-soft)]"><span aria-hidden>{rtl ? "›" : "‹"}</span></button>
            <span className="min-w-[3.2rem] text-center text-[12.5px] font-bold text-[var(--ink-2)]" aria-live="polite" data-testid="os-counter">{t("p9tx.osCounter", { n: idx + 1, total })}</span>
            <button type="button" onClick={next} aria-label={t("p9tx.osNext")} data-testid="os-next" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--panel)] text-[20px] font-extrabold hover:bg-[var(--brand-soft)]"><span aria-hidden>{rtl ? "‹" : "›"}</span></button>
          </div>
        )}
      </div>}
      <div
        className="flex flex-col gap-2"
        role="group"
        aria-roledescription="carousel"
        onKeyDown={(e) => { if (total < 2) return; if (e.key === "ArrowRight") { e.preventDefault(); rtl ? prev() : next(); } else if (e.key === "ArrowLeft") { e.preventDefault(); rtl ? next() : prev(); } }}
        onTouchStart={(e) => { touchX.current = e.touches[0]?.clientX ?? null; }}
        onTouchEnd={(e) => {
          const x0 = touchX.current; touchX.current = null;
          const x1 = e.changedTouches[0]?.clientX;
          if (total < 2 || x0 == null || x1 == null || Math.abs(x1 - x0) < 48) return;
          // swipe left = next (right-to-left languages mirror it)
          const left = x1 < x0;
          (left !== rtl) ? next() : prev();
        }}
      >
        {[ordered[idx]].map((s) => {
          const open = now >= new Date(s.opensAt).getTime();
          const key = `${s.listingId}_${s.date}`;
          let action: React.ReactNode;
          let explain: React.ReactNode = null;
          const mins = Math.max(1, Math.round((new Date(s.startsAt).getTime() - new Date(s.opensAt).getTime()) / 60_000));
          const opensDay = ukDay(s.opensAt, dateLocale());
          if (s.joinState === "unpaid") {
            // Booked but not paid: the join link is locked, and the family is told exactly why and what to do.
            // No pay button here: paying lives on the booking card ("Pay by card instead").
            action = null;
            explain = <div className="mt-1 text-[12.5px] font-semibold text-[#7a4b00]" data-testid="os-unpaid-text">{t("p9tx.osUnpaid", { provider: s.providerName || providerName || t("p7cl.theProvider").toLocaleLowerCase(dateLocale()) })}</div>;
          } else if (s.joinState === "early" || s.joinState === "early_own") {
            explain = <div className="mt-1 text-[12.5px] font-semibold text-[#0f6b34]" data-testid="os-early-text">{t(s.joinState === "early" ? "p9tx.osEarly" : "p9tx.osEarlyOwn", { time: clock(s.opensAt), day: opensDay, mins })}</div>;
          }
          if (s.joinState === "unpaid") {
            /* action already set above */
          } else if (s.mode === "own") {
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
                {s.mode !== "own" && open && !s.hostLive && s.joinState !== "unpaid" && <div className="mt-0.5 text-[12px] font-semibold text-[#7a4b00]">{t("p9tx.osWaitingHint")}</div>}
                {explain}
              </div>
              {action}
            </div>
          );
        })}
        {total > 1 && total <= 7 && (
          <div className="flex justify-center gap-1.5" aria-hidden data-testid="os-dots">
            {ordered.map((o, i) => <button key={sessionKey(o)} type="button" tabIndex={-1} onClick={() => go(i)} className="h-2 w-2 rounded-full" style={{ background: i === idx ? "var(--brand-2)" : "var(--line)" }} />)}
          </div>
        )}
      </div>
    </Shell></div>
  );
}

function Shell({ compact, children }: { compact?: boolean; children: React.ReactNode }) {
  return compact ? <div>{children}</div> : <Card className="mb-4 p-4">{children}</Card>;
}
