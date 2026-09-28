"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useT } from "@/lib/i18n/provider";
import { openHowItWorks } from "./open";
import type { HowRole } from "./types";

// First visit to the Hub Home for a role: ONE quiet card offering a short guided tour (the same scenes as the "How it works" films, one
// per key area: scripts/clips.ts TOURS). It never plays by itself, never blocks the page and is remembered per signed-in person per role
// (localStorage), so a returning user only sees a small "Take the tour again" link. Nothing animates: it is safe for calm mode, and the
// tour itself only autoplays when the device has not asked for reduced motion.
const key = (who: string, role: HowRole) => `aos.hiw.tour.${who}.${role}`;
const read = (k: string): boolean => { try { return localStorage.getItem(k) === "1"; } catch { return false; } };
const write = (k: string) => { try { localStorage.setItem(k, "1"); } catch { /* storage blocked: the card simply shows again */ } };

export default function FirstTimeTour({ role }: { role: Exclude<HowRole, "kid"> }) {
  const tr = useT();
  const { user } = useAuth();
  const k = key(user?.uid ?? "anon", role);
  const [seen, setSeen] = useState<boolean | null>(null);   // null until we have looked at storage (no flash, no hydration mismatch)
  useEffect(() => { setSeen(read(k)); }, [k]); // eslint-disable-line react-hooks/set-state-in-effect -- browser-only, after mount
  if (seen === null) return null;
  const start = () => {
    write(k); setSeen(true);
    const calm = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    openHowItWorks({ role, tour: true, autoplay: !calm });
  };
  if (seen) return null;   // afterwards the tour is one pill inside the "Show me" window (HowItWorksHost), not another control on the page
  return (
    <section className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--brand-line,#cdddf7)] bg-[var(--surface,#fff)] p-3.5" data-testid="hiw-tour-card" aria-label={tr("hubhow.tourTitle")}>
      <span className="grid h-11 w-11 flex-none place-items-center rounded-full bg-[#f5b81f] text-[18px] text-[#2a1d00]" aria-hidden>▶</span>
      <div className="min-w-0 flex-1 basis-[220px]">
        <h2 className="m-0 text-[15px] font-extrabold text-[var(--ink,#0e1f4a)]">{tr("hubhow.tourTitle")}</h2>
        <p className="m-0 mt-0.5 text-[13px] leading-snug text-[var(--ink-2,#4a5677)]">{tr("hubhow.tourBody")}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={start} data-testid="hiw-tour-start" className="inline-flex min-h-[44px] items-center rounded-full bg-[var(--brand,#1d3a8f)] px-4 text-[13px] font-extrabold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand,#1d3a8f)]">{tr("hubhow.tourStart")}</button>
        <button type="button" onClick={() => { write(k); setSeen(true); }} data-testid="hiw-tour-skip" className="inline-flex min-h-[44px] items-center rounded-full px-3 text-[13px] font-bold text-[var(--ink-2,#4a5677)] underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand,#1d3a8f)]">{tr("hubhow.tourNotNow")}</button>
      </div>
    </section>
  );
}
