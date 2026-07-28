"use client";

import { useState, type ReactNode } from "react";
import type { ChildQuestion } from "@/lib/settings";

// Shared child-info card — the blue-header, colour-coded card used on the
// Register (in a modal) and in the Bookings detail (inline as a tab). One
// source of truth so both stay identical.

const HERO = "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 62%,#ffffff 100%)";
const BLUE = "#1d3a8f";
const AV = ["#fde2e4", "#e2f0d9", "#e0e7ff", "#fff3d6", "#e5f6f8", "#f3e8ff", "#ffe9d6", "#dce7ff"];
const avBg = (n: string) => AV[[...n].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length];

export const SWIM_LABEL: Record<string, string> = { none: "Non-swimmer", weak: "Weak / needs support", confident: "Confident", strong: "Strong swimmer" };
export type Tint = { bg: string; fg: string };
export const T = {
  allergy: { bg: "#fee2e2", fg: "#b91c1c" }, medical: { bg: "#dbeafe", fg: "#1d4ed8" }, dietary: { bg: "#dcfce7", fg: "#15803d" },
  send: { bg: "#f3e8ff", fg: "#7c3aed" }, swim: { bg: "#cffafe", fg: "#0e7490" }, likes: { bg: "#dcfce7", fg: "#15803d" },
  dislikes: { bg: "#fef3c7", fg: "#b45309" }, care: { bg: "#eef2ff", fg: "#4338ca" }, neutral: { bg: "#f1f5f9", fg: "#475569" },
  password: { bg: "#fef3c7", fg: "#92400e" }, emergency: { bg: "#ffe4e6", fg: "#be123c" }, ask: { bg: "#e0e7ff", fg: "#3730a3" },
} as const;

// One coloured fact tile; renders nothing when empty so sections self-collapse.
// Long text stays in a 2-line box with a Show-more arrow (no card growth).
export function Fact({ label, value, tint, full }: { label: string; value?: ReactNode; tint: Tint; full?: boolean }) {
  const [exp, setExp] = useState(false);
  if (value === undefined || value === null || value === "" || value === false) return null;
  const long = typeof value === "string" && value.length > (full ? 115 : 42);
  return (
    <div className={`rounded-xl px-3 py-2 ${full ? "col-span-2" : ""}`} style={{ background: tint.bg }}>
      <div className="text-[9.5px] font-extrabold uppercase tracking-[0.04em]" style={{ color: tint.fg }}>{label}</div>
      <div className={`mt-0.5 text-[12.5px] font-semibold leading-snug text-[var(--ink)] ${long && !exp ? "line-clamp-2" : ""}`}>{value}</div>
      {long && <button type="button" onClick={() => setExp((v) => !v)} className="mt-1 text-[10.5px] font-extrabold" style={{ color: tint.fg }}>{exp ? "▲ Show less" : "▾ Show more"}</button>}
    </div>
  );
}
export function SectionTitle({ dot, children }: { dot: string; children: ReactNode }) {
  return <div className="mb-1.5 mt-3.5 flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: dot }} /><span className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-2)]">{children}</span></div>;
}

export interface ChildInfo {
  name: string; age?: number; dob?: string; sex?: string; photo?: string;
  allergies?: string; medical?: string; dietary?: string; send?: string; sendPlanName?: string; swimming?: string;
  careNotes?: string; likes?: string; dislikes?: string; answers?: Record<string, string>;
  photoConsent?: boolean; suncreamConsent?: boolean; firstAidConsent?: boolean; walkHomeConsent?: boolean;
  collectionPassword?: string; emergencyName?: string; emergencyPhone?: string; school?: string;
  contactName?: string; contactPhone?: string; contactEmail?: string;
  bookingRef?: string; bookingNotes?: string; collected?: string;
  siblings?: string[];
  statusChip?: { text: string; bg?: string } | null;
  attending?: { label: string; start: string; end: string; listing: string }[];
}

/**
 * The card. `inline` renders it flat (for a page tab, the page scrolls);
 * otherwise it's a self-contained scrolling panel (for a modal). Pass `onClose`
 * to show the ✕. `card` gates each fact (Setup toggles); `fields` are the
 * register's legacy contact toggles (default all on).
 */
export function ChildCard({ info, card, questions, fields, inline, actions, onClose }: {
  info: ChildInfo;
  card?: Record<string, boolean | undefined>;
  questions?: ChildQuestion[];
  fields?: { emergency?: boolean; password?: boolean; school?: boolean };
  inline?: boolean;
  actions?: ReactNode; // optional quick-link row (First aid / Message / …)
  onClose?: () => void;
}) {
  const [showDays, setShowDays] = useState(false);
  const on = (k: string) => (card ?? {})[k] !== false;
  const flds = fields ?? { emergency: true, password: true, school: true };
  const yesNo = (v?: boolean) => (v === true ? "Yes" : v === false ? "No" : undefined);
  const qById = new Map((questions ?? []).map((q) => [q.id, q] as const));
  const answered = on("answers") ? Object.entries(info.answers ?? {}).filter(([id, v]) => v != null && String(v).trim() !== "" && (qById.get(id)?.showOnRegister !== false)) : [];
  const anyHealth = (on("allergies") && info.allergies) || (on("medical") && info.medical) || (on("dietary") && info.dietary) || (on("send") && (info.send || info.sendPlanName)) || (on("swimming") && info.swimming);
  const attend = info.attending ?? [];
  return (
    <div className={`flex w-full flex-col overflow-hidden rounded-3xl bg-[var(--surface)] ${inline ? "border border-[#dbe6fb] shadow-sm" : "max-h-[90vh] shadow-2xl"}`}>
      {/* Gradient header */}
      <div className="relative flex-none px-5 pb-4 pt-5 text-white" style={{ background: HERO }}>
        {onClose && <button type="button" onClick={onClose} className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-[15px] font-bold leading-none hover:bg-white/30">×</button>}
        <div className="flex items-center gap-3">
          {info.photo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={info.photo} alt="" className="h-14 w-14 flex-none rounded-2xl object-cover ring-2 ring-white/60" />
            : <span className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl text-[20px] font-extrabold text-[#1d3a8f] ring-2 ring-white/60" style={{ background: "rgba(255,255,255,.9)" }}>{(info.name ?? "?").slice(0, 1)}</span>}
          <div className="min-w-0">
            <div className="truncate text-[19px] font-extrabold leading-tight" style={{ fontFamily: "var(--ff-display)" }}>{info.name}</div>
            <div className="mt-0.5 text-[12px] text-white/85">{info.age != null ? `Age ${info.age}` : ""}{info.dob ? ` · born ${info.dob}` : ""}{info.sex ? ` · ${info.sex}` : ""}</div>
            {info.siblings && info.siblings.length > 0 && <div className="mt-0.5 truncate text-[11px] text-white/75">👥 Sibling of {info.siblings.join(", ")}</div>}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {info.statusChip && <span className="rounded-full px-2.5 py-1 text-[10.5px] font-extrabold" style={{ background: info.statusChip.bg ?? "rgba(255,255,255,.22)" }}>{info.statusChip.text}</span>}
          {info.allergies && <span className="rounded-full bg-white px-2.5 py-1 text-[10.5px] font-extrabold" style={{ color: T.allergy.fg }}>⚠ Allergy</span>}
          {info.medical && <span className="rounded-full bg-white px-2.5 py-1 text-[10.5px] font-extrabold" style={{ color: T.medical.fg }}>Medical</span>}
          {(info.send || info.sendPlanName) && <span className="rounded-full bg-white px-2.5 py-1 text-[10.5px] font-extrabold" style={{ color: T.send.fg }}>SEND</span>}
        </div>
      </div>

      {/* Body */}
      <div className={`px-5 pb-5 pt-1 ${inline ? "" : "min-h-0 flex-1 overflow-y-auto [scrollbar-color:#9db8ee_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#9db8ee] [&::-webkit-scrollbar]:w-2.5"}`}>
        {actions && <div className="mt-2 flex flex-wrap gap-1.5">{actions}</div>}
        <SectionTitle dot={T.allergy.fg}>Health &amp; safeguarding</SectionTitle>
        {anyHealth ? (
          <div className="grid grid-cols-2 gap-2">
            {on("allergies") && <Fact label="Allergies" tint={T.allergy} full value={info.allergies && `⚠ ${info.allergies}`} />}
            {on("medical") && <Fact label="Medical" tint={T.medical} value={info.medical} />}
            {on("dietary") && <Fact label="Dietary" tint={T.dietary} value={info.dietary} />}
            {on("send") && <Fact label="SEND / needs" tint={T.send} value={(info.send || info.sendPlanName) && `${info.send ?? ""}${info.sendPlanName ? `${info.send ? " · " : ""}plan on file` : ""}`} />}
            {on("swimming") && <Fact label="Swimming" tint={T.swim} value={info.swimming && (SWIM_LABEL[info.swimming] ?? info.swimming)} />}
          </div>
        ) : <div className="rounded-xl bg-[#e7f6ee] px-3 py-2 text-[12px] font-semibold text-[#15803d]">✓ Nothing flagged</div>}

        {((on("careNotes") && info.careNotes) || (on("likes") && info.likes) || (on("dislikes") && info.dislikes)) && <>
          <SectionTitle dot={T.care.fg}>Personality &amp; care</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {on("careNotes") && <Fact label="Care notes" tint={T.care} full value={info.careNotes} />}
            {on("likes") && <Fact label="Likes / settles them" tint={T.likes} value={info.likes} />}
            {on("dislikes") && <Fact label="Dislikes / avoid" tint={T.dislikes} value={info.dislikes} />}
          </div>
        </>}

        {answered.length > 0 && <>
          <SectionTitle dot={T.ask.fg}>Parent&rsquo;s answers</SectionTitle>
          <div className="grid grid-cols-2 gap-2">{answered.map(([id, v]) => <Fact key={id} label={qById.get(id)?.label ?? id} tint={T.ask} full value={String(v)} />)}</div>
        </>}

        {on("consents") && <>
          <SectionTitle dot={T.send.fg}>Consents</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {([["Photos", info.photoConsent === false ? "No" : yesNo(info.photoConsent)], ["Suncream", yesNo(info.suncreamConsent)], ["First aid", yesNo(info.firstAidConsent)], ["Walk home", yesNo(info.walkHomeConsent)]] as [string, string | undefined][]).map(([l, v]) => v == null ? null : (
              <span key={l} className="rounded-full border px-2.5 py-1 text-[11px] font-bold" style={v === "Yes" ? { borderColor: "#bbf7d0", background: "#f0fdf4", color: "#15803d" } : { borderColor: "#fecdd3", background: "#fff1f2", color: "#be123c" }}>{l}: {v}</span>
            ))}
          </div>
        </>}

        <SectionTitle dot={T.medical.fg}>Contact &amp; collection</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          {on("mainContact") && <Fact label="Main contact" tint={T.medical} full value={info.contactName && `${info.contactName}${info.contactPhone ? ` · ${info.contactPhone}` : ""}${info.contactEmail ? ` · ${info.contactEmail}` : ""}`} />}
          {on("emergency") && flds.emergency && <Fact label="Emergency contact" tint={T.emergency} full value={(info.emergencyName || info.emergencyPhone) && `${info.emergencyName ?? ""}${info.emergencyPhone ? ` · ${info.emergencyPhone}` : ""}`} />}
          {on("password") && flds.password && <Fact label="Collection password" tint={T.password} value={info.collectionPassword && <span>🔑 {info.collectionPassword}</span>} />}
          {on("school") && flds.school && <Fact label="School" tint={T.neutral} value={info.school} />}
          {info.bookingRef && <Fact label="Booking ref" tint={T.neutral} value={`#${info.bookingRef}`} />}
          {on("bookingNotes") && <Fact label="Booking notes" tint={T.neutral} full value={info.bookingNotes} />}
          {info.collected && <Fact label="Collected" tint={T.dietary} full value={info.collected} />}
        </div>

        {on("attending") && attend.length > 0 && <>
          <SectionTitle dot={BLUE}>Attending</SectionTitle>
          <button type="button" onClick={() => setShowDays((v) => !v)} className="flex w-full items-center justify-between rounded-xl bg-[#eef4fd] px-3 py-2 text-left">
            <span className="text-[12.5px] font-extrabold text-[#1d3a8f]">📅 {attend.length} {attend.length === 1 ? "session" : "sessions"} booked</span>
            <span className="text-[11px] font-bold text-[#1d3a8f]">{showDays ? "hide ▲" : "show all ▼"}</span>
          </button>
          {showDays && <ol className="mt-1.5 space-y-1">{attend.map((s, i) => (
            <li key={`${s.label}-${s.start}-${i}`} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg border border-[var(--line)] px-3 py-1.5 text-[12px]">
              <span className="font-extrabold text-[var(--ink)]">{s.label}</span>
              {s.start && <span className="text-[var(--ink-2)]">🕒 {s.start}{s.end ? `–${s.end}` : ""}</span>}
              {s.listing && <span className="text-[var(--ink-3)]">· {s.listing}</span>}
            </li>
          ))}</ol>}
        </>}
      </div>
    </div>
  );
}
