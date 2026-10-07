"use client";

import { useT } from "@/lib/i18n/provider";
import { dateLocale as dl } from "@/lib/i18n/format";
import type { Booking } from "./types";
import { sessionIsoDates } from "./helpers";

// The REAL date of the event, big and colourful, at the top of a booking: providers (and families) think in dates, not in "Week 4".
// Plus the family's own note ("we have pets", parking, gate codes) as a callout straight under it so it cannot be missed.

const fmtDay = (iso: string, withYear: boolean, long = false) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString(dl(), { weekday: long ? "long" : "short", day: "numeric", month: long ? "long" : "short", ...(withYear ? { year: "numeric" as const } : {}), timeZone: "UTC" });

/** "tomorrow", "in 3 weeks", "in 11 months" (or null when it is already past). */
function relativeHint(iso: string): string | null {
  const days = Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(new Date().toISOString().slice(0, 10) + "T00:00:00Z")) / 86_400_000);
  if (days < 0) return null;
  const rtf = new Intl.RelativeTimeFormat(dl(), { numeric: "auto" });
  if (days < 14) return rtf.format(days, "day");
  if (days < 60) return rtf.format(Math.round(days / 7), "week");
  return rtf.format(Math.round(days / 30), "month");
}

/** The time of day from a session string like "Mon 06 Sept 2027 · 09:00 – 15:30". */
function timeOf(b: Booking): string {
  const s = (b.sessions ?? []).find((x) => x.includes(" · "));
  return s ? s.split(" · ").slice(1).join(" · ").replace(/\s*–\s*/, "–") : "";
}

export function EventDateBanner({ b }: { b: Booking }) {
  const t = useT();
  const days = (b.days && b.days.length ? [...b.days] : sessionIsoDates(b)).sort();
  if (!days.length) return null;
  const year = new Date().getFullYear();
  const showYear = days.some((d) => Number(d.slice(0, 4)) !== year);
  const first = days[0];
  const last = days[days.length - 1];
  const hint = relativeHint(first);
  const time = timeOf(b);
  const home = !!b.serviceAddress && !!(b.serviceAddress.address || b.serviceAddress.postcode);
  return (
    <div className="mt-3 rounded-2xl px-5 py-4 text-white" style={{ background: "linear-gradient(120deg,#1d3a8f,#2f6bd8)", boxShadow: "0 10px 26px -14px rgba(29,58,143,.7)" }}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <div className="text-[clamp(22px,4vw,30px)] font-extrabold uppercase leading-[1.1] tracking-[0.01em]">
          {days.length === 1 ? fmtDay(first, true, true) : `${fmtDay(first, showYear)} – ${fmtDay(last, true)}`}
        </div>
        {time && <div className="text-[clamp(16px,2.6vw,20px)] font-extrabold opacity-95">· {time}</div>}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] font-bold">
        {days.length > 1 && <span className="rounded-full bg-white/20 px-2.5 py-[2px]">{t("p8lst.evDays", { n: days.length })}</span>}
        {hint && <span className="rounded-full bg-white/20 px-2.5 py-[2px]">{hint}</span>}
        {home && <span className="rounded-full bg-white/20 px-2.5 py-[2px]">🏠 {t("p8lst.evAtHome")}</span>}
      </div>
      {days.length > 1 && days.length <= 12 && (
        <div className="mt-2 flex flex-wrap gap-1.5 text-[12px] font-bold">
          {days.map((d) => <span key={d} className="rounded-md bg-white/15 px-2 py-[2px]">{fmtDay(d, false)}</span>)}
        </div>
      )}
    </div>
  );
}

/** The family's note for the provider (access, pets, parking, gate codes), impossible to miss. */
export function FamilyNoteCallout({ b }: { b: Booking }) {
  const t = useT();
  const note = b.serviceAddress?.notes?.trim();
  if (!note) return null;
  return (
    <div className="mt-3 rounded-xl border px-3.5 py-2.5" style={{ borderColor: "#eadfb8", background: "#fffaec", color: "#4d3f12" }}>
      <div className="text-[11px] font-bold uppercase tracking-[0.06em] opacity-80">📝 {t("p8lst.noteFromFamily")}</div>
      <div className="mt-0.5 whitespace-pre-wrap break-words text-[14px] font-semibold leading-[1.4]">{note}</div>
    </div>
  );
}
