"use client";

import { useState, type ReactNode } from "react";
import { needsNappies, type ChildQuestion } from "@/lib/settings";
import { openFile } from "@/lib/api";

// Shared child-info card — the blue-header, colour-coded card used on the
// Register (in a modal) and in the Bookings detail (inline as a tab). One
// source of truth so both stay identical.

const BLUE = "#1d3a8f";
const AV = ["#fde2e4", "#e2f0d9", "#e0e7ff", "#fff3d6", "#e5f6f8", "#f3e8ff", "#ffe9d6", "#dce7ff"];
const avBg = (n: string) => AV[[...n].reduce((a, c) => a + c.charCodeAt(0), 0) % AV.length];

export const SWIM_LABEL: Record<string, string> = { none: "Non-swimmer", weak: "Weak / needs support", confident: "Confident", strong: "Strong swimmer" };
export type Tint = { bg: string; fg: string; grad?: string; ic?: string; glyph?: string };
// Each category carries a soft wash, an icon-plate colour and a glyph, so a fact
// reads as a designed object rather than a bordered box. `bg`/`fg` stay for the
// chips and for callers (Bookings) that only want the flat pair.
export const T = {
  allergy:  { bg: "#fee2e2", fg: "#c0362c", grad: "linear-gradient(135deg,#fff1ef,#ffe3df)", ic: "#ffd9d3", glyph: "⚠" },
  medical:  { bg: "#dbeafe", fg: "#1c3f8f", grad: "linear-gradient(135deg,#eef4ff,#dfe9fe)", ic: "#d5e2fc", glyph: "✚" },
  dietary:  { bg: "#dcfce7", fg: "#0f7a43", grad: "linear-gradient(135deg,#eefaf2,#dcf3e6)", ic: "#cdeeda", glyph: "🍽" },
  send:     { bg: "#f3e8ff", fg: "#6d28d9", grad: "linear-gradient(135deg,#f6f0ff,#ece0ff)", ic: "#e3d3fd", glyph: "◆" },
  swim:     { bg: "#cffafe", fg: "#0e7490", grad: "linear-gradient(135deg,#edfbfd,#d8f4f8)", ic: "#c8eef4", glyph: "🏊" },
  likes:    { bg: "#dcfce7", fg: "#0f7a43", grad: "linear-gradient(135deg,#eefaf2,#dcf3e6)", ic: "#cdeeda", glyph: "♥" },
  dislikes: { bg: "#fef3c7", fg: "#a25c00", grad: "linear-gradient(135deg,#fff8e9,#ffefcf)", ic: "#ffe6b8", glyph: "✕" },
  care:     { bg: "#eef2ff", fg: "#4338ca", grad: "linear-gradient(135deg,#f1f2ff,#e4e6fe)", ic: "#dcdffc", glyph: "☂" },
  neutral:  { bg: "#f1f5f9", fg: "#3b4763", grad: "linear-gradient(135deg,#f3f6fb,#e7edf7)", ic: "#dde5f2", glyph: "•" },
  password: { bg: "#fef3c7", fg: "#92400e", grad: "linear-gradient(135deg,#fff8e9,#ffefcf)", ic: "#ffe6b8", glyph: "🔑" },
  emergency:{ bg: "#ffe4e6", fg: "#be123c", grad: "linear-gradient(135deg,#fff0f2,#ffe0e5)", ic: "#ffd2d9", glyph: "☎" },
  ask:      { bg: "#e0e7ff", fg: "#3730a3", grad: "linear-gradient(135deg,#eef1ff,#e0e6fe)", ic: "#d8dffd", glyph: "?" },
} as const;

// One fact; renders nothing when empty so sections self-collapse. White card
// with a hairline border and a thin colour accent down the left edge — the
// colour still codes the category, but as a cue rather than a block of fill,
// which is what made a card of eight facts read like a paint chart.
// Long text stays in a 2-line box with a Show-more arrow (no card growth).
export function Fact({ label, value, tint, full, icon }: { label: string; value?: ReactNode; tint: Tint; full?: boolean; icon?: string }) {
  const [exp, setExp] = useState(false);
  if (value === undefined || value === null || value === "" || value === false) return null;
  const long = typeof value === "string" && value.length > (full ? 130 : 46);
  const glyph = icon ?? tint.glyph ?? "•";
  return (
    <div className={`flex items-start gap-3 rounded-2xl px-4 py-3.5 ${full ? "col-span-2" : ""}`}
      style={{ background: tint.grad ?? tint.bg }}>
      <span className="grid h-9 w-9 flex-none place-items-center rounded-xl text-[16px] shadow-[inset_0_0_0_1px_rgba(255,255,255,.55)]"
        style={{ background: tint.ic ?? "rgba(255,255,255,.6)", color: tint.fg }}>{glyph}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[9.5px] font-bold uppercase tracking-[0.14em]" style={{ color: tint.fg, opacity: 0.78 }}>{label}</div>
        <div className={`mt-1 text-[15.5px] font-bold leading-snug tracking-[-0.01em] text-[var(--ink)] ${long && !exp ? "line-clamp-2" : ""}`}>{value}</div>
        {long && <button type="button" onClick={() => setExp((v) => !v)} className="mt-1.5 text-[11px] font-extrabold" style={{ color: tint.fg }}>{exp ? "▲ Show less" : "▾ Show more"}</button>}
      </div>
    </div>
  );
}
// A quiet section heading with a hairline rule, rather than a coloured dot.
export function SectionTitle({ dot, children }: { dot: string; children: ReactNode }) {
  return (
    <div className="mb-2 mt-4 flex items-center gap-2 first:mt-0">
      <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: dot }} />
      <span className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-[var(--ink-3)]">{children}</span>
      <span className="h-px flex-1 bg-[var(--line)]" />
    </div>
  );
}

// Opens a child's EHCP/SEND plan securely. The file lives behind an
// authenticated API route (no public URL), so we fetch it with the signed-in
// operator's token and hand the browser a blob — never an attachment or a
// shareable link.
function PlanButton({ id, name }: { id: string; name?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="mt-2">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setErr(null); setBusy(true);
          try { await openFile(`/api/my/files/${id}`); }
          catch (e) { setErr(e instanceof Error ? e.message : "Couldn’t open the plan."); }
          finally { setBusy(false); }
        }}
        className="inline-flex items-center gap-1.5 rounded-full border border-[#c9d8f6] bg-[#eef3ff] px-3 py-1.5 text-[12px] font-bold text-[#1d3a8f] hover:bg-[#e2ecfe] disabled:opacity-60"
      >
        📎 {busy ? "Opening…" : `Open EHCP plan${name ? ` — ${name}` : ""}`}
      </button>
      {err && <div className="mt-1 text-[11.5px] font-semibold text-[var(--red,#e21d27)]">{err}</div>}
    </div>
  );
}

// A contact action that hands off to the device — dialler, SMS, mail client,
// maps. `external` opens a new tab; tel:/mailto: must not, or the register is
// left sitting on a blank page when the handler takes over.
function ContactLink({ href, external, children }: { href: string; external?: boolean; children: ReactNode }) {
  return (
    <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="inline-flex items-center gap-1.5 rounded-full border border-[#c9d8f6] bg-[#eef3ff] px-3.5 py-2 text-[13px] font-bold text-[#1d3a8f] transition hover:bg-[#e2ecfe]">
      {children}
    </a>
  );
}

export interface ChildInfo {
  name: string; age?: number; dob?: string; sex?: string; photo?: string;
  allergies?: string; medical?: string; dietary?: string; send?: string; sendPlanName?: string; sendPlanId?: string; swimming?: string;
  careNotes?: string; likes?: string; dislikes?: string; answers?: Record<string, string>;
  photoConsent?: boolean; suncreamConsent?: boolean; firstAidConsent?: boolean; walkHomeConsent?: boolean;
  collectionPassword?: string; emergencyName?: string; emergencyPhone?: string; school?: string;
  contactName?: string; contactPhone?: string; contactEmail?: string; contactAddress?: string;
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
export function ChildCard({ info, card, questions, fields, inline, actions, canSeeSafeguarding, onClose }: {
  info: ChildInfo;
  card?: Record<string, boolean | undefined>;
  questions?: ChildQuestion[];
  fields?: { emergency?: boolean; password?: boolean; school?: boolean };
  inline?: boolean;
  actions?: ReactNode; // optional quick-link row (First aid / Message / …)
  /** Admins / designated safeguarding lead only — gates the Safeguarding tab. */
  canSeeSafeguarding?: boolean;
  onClose?: () => void;
}) {
  const [showDays, setShowDays] = useState(false);
  const on = (k: string) => (card ?? {})[k] !== false;
  const flds = fields ?? { emergency: true, password: true, school: true };
  const yesNo = (v?: boolean) => (v === true ? "Yes" : v === false ? "No" : undefined);
  const qById = new Map((questions ?? []).map((q) => [q.id, q] as const));
  const answered = on("answers") ? Object.entries(info.answers ?? {}).filter(([id, v]) => v != null && String(v).trim() !== "" && (qById.get(id)?.showOnRegister !== false)) : [];
  const anyMain = (on("allergies") && info.allergies) || (on("medical") && info.medical) || (on("dietary") && info.dietary) || (on("send") && (info.send || info.sendPlanName)) || (on("swimming") && info.swimming);
  const attend = info.attending ?? [];
  // Drives the panel's Continence line — same helper the register row uses.
  const nappies = needsNappies(questions ?? [], info.answers);

  // Tabs are built from what this child actually has, so you never tap through
  // to an empty panel. "main" always exists — it's the safeguarding headline.
  const hasLikes = (on("likes") && info.likes) || (on("dislikes") && info.dislikes) || (on("careNotes") && info.careNotes);
  const hasMedical = (on("medical") && info.medical) || (on("dietary") && info.dietary) || info.firstAidConsent != null || info.suncreamConsent != null;
  const hasFamily = !!(info.contactName || info.contactPhone || info.contactEmail || info.contactAddress || info.emergencyName);
  const hasBooking = !!(info.bookingRef || (on("bookingNotes") && info.bookingNotes) || info.collected || info.contactName || attend.length);
  const tabs = [
    { id: "main", label: "Allergies & needs" },
    ...(hasLikes ? [{ id: "likes", label: "Likes & dislikes" }] : []),
    ...(hasMedical ? [{ id: "medical", label: "Medical & first aid" }] : []),
    // Gated: safeguarding detail isn't for whoever happens to be holding the
    // tablet. Hidden entirely rather than shown-and-locked — a greyed tab still
    // tells you something exists.
    ...(canSeeSafeguarding ? [{ id: "safeguarding", label: "🔒 Safeguarding" }] : []),
    ...(hasFamily ? [{ id: "family", label: "Family" }] : []),
    ...(hasBooking ? [{ id: "booking", label: "Booking & notes", count: attend.length || undefined }] : []),
  ] as { id: string; label: string; count?: number }[];

  const [tab, setTab] = useState("main");
  const [dir, setDir] = useState(1);
  // Derived, not stored: if the active tab vanishes (a fact was cleared, or the
  // viewer isn't safeguarding-cleared) we fall back to "main" without a
  // render-phase setState.
  const live = tabs.some((t) => t.id === tab) ? tab : "main";
  // Slide direction follows the tab order, so the panel travels the way your eye did.
  const go = (id: string) => {
    setDir(tabs.findIndex((t) => t.id === id) >= tabs.findIndex((t) => t.id === live) ? 1 : -1);
    setTab(id);
  };
  return (
    <div className={`grid w-full overflow-hidden rounded-2xl bg-[var(--surface)] md:grid-cols-[280px_minmax(0,1fr)] ${inline ? "border border-[var(--line)] shadow-sm" : "max-h-[90vh] shadow-[0_40px_80px_-34px_rgba(4,12,34,.7)]"}`}>

      {/* ── Standing panel ──────────────────────────────────────────────────
          A full-height column on the app's own sidebar surface. The facts that
          could hurt a child live HERE, not in a tab: they're in a different
          column, so no amount of scrolling or tab-switching can take them off
          screen. That's the whole point of the layout. */}
      <aside className="relative flex flex-col gap-4 p-5 text-white md:min-h-full"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1.6px), var(--side-bg)",
          backgroundSize: "18px 18px, cover",
          backgroundRepeat: "repeat, no-repeat",
        }}>
        {onClose && <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-[17px] font-bold leading-none text-white/70 transition hover:bg-white/15 hover:text-white md:hidden">×</button>}

        {info.photo
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={info.photo} alt="" className="h-[78px] w-[78px] rounded-3xl object-cover shadow-[inset_0_0_0_3px_rgba(255,255,255,.28)]" />
          : <span className="grid h-[78px] w-[78px] place-items-center rounded-3xl bg-white/16 text-[30px] font-extrabold text-white shadow-[inset_0_0_0_3px_rgba(255,255,255,.28)]">{(info.name ?? "?").slice(0, 1)}</span>}

        <div className="min-w-0">
          <h2 className="text-[23px] font-extrabold leading-tight tracking-[-0.025em]" style={{ fontFamily: "var(--ff-display)" }}>{info.name}</h2>
          <div className="mt-1.5 text-[12.5px] text-white/70">
            {[info.age != null ? `Age ${info.age}` : "", info.dob ? `born ${info.dob}` : "", info.sex || ""].filter(Boolean).join(" · ")}
          </div>
          {info.school && <div className="mt-0.5 truncate text-[12px] text-white/55">🏫 {info.school}</div>}
        </div>

        {info.statusChip && (
          <span className="w-fit rounded-full bg-white/18 px-3.5 py-1.5 text-[12.5px] font-extrabold text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.28)]">{info.statusChip.text}</span>
        )}

        <div className="h-px bg-white/18" />

        {/* The non-negotiables. Rendered as label + value rather than tiles —
            on the navy these need to read as facts, not decorated boxes. */}
        <div className="flex flex-col gap-3.5">
          {on("allergies") && info.allergies && (
            <div><div className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-white/55">Allergies</div>
              <div className="mt-1 text-[14.5px] font-bold leading-snug">⚠ {info.allergies}</div></div>
          )}
          {on("medical") && info.medical && (
            <div><div className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-white/55">Medical</div>
              <div className="mt-1 text-[14.5px] font-bold leading-snug">{info.medical}</div></div>
          )}
          {on("send") && (info.send || info.sendPlanName) && (
            <div><div className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-white/55">SEND / needs</div>
              <div className="mt-1 text-[14.5px] font-bold leading-snug">{info.send ?? ""}{info.sendPlanName ? `${info.send ? " · " : ""}plan on file` : ""}</div></div>
          )}
          {nappies && (
            <div><div className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-white/55">Continence</div>
              <div className="mt-1 text-[14.5px] font-bold leading-snug">🚼 Nappy changes needed</div></div>
          )}
          {!anyMain && !nappies && (
            <div className="rounded-xl bg-white/12 px-3.5 py-2.5 text-[13px] font-semibold text-white/85">✓ Nothing flagged</div>
          )}
        </div>

        {info.siblings && info.siblings.length > 0 && (
          <div className="mt-auto pt-2 text-[12px] text-white/60">👥 Sibling of {info.siblings.join(", ")}</div>
        )}
      </aside>

      {/* ── Content column ── */}
      <div className={`flex min-w-0 flex-col ${inline ? "" : "max-h-[90vh]"}`}>
        <div className="relative flex-none border-b border-[var(--line)]">
          {onClose && <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-2.5 z-10 hidden h-8 w-8 place-items-center rounded-full text-[17px] font-bold leading-none text-[var(--ink-3)] transition hover:bg-[var(--line)] md:grid">×</button>}
      {/* Tabs — the card carries more than fits comfortably on one screen, and
          safeguarding needs gating anyway. Tabs build themselves from what this
          child actually has, so an empty one never appears. */}
      <div className="px-3">
        <div className="flex gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((t) => {
            const active = t.id === live;
            return (
              <button key={t.id} type="button" role="tab" aria-selected={active} onClick={() => go(t.id)}
                className={"relative whitespace-nowrap px-3.5 py-2.5 text-[14px] font-bold transition-colors " + (active ? "text-[#1d3a8f]" : "text-[var(--ink-3)] hover:text-[var(--ink-2)]")}>
                {t.label}
                {t.count ? <span className="ml-1.5 rounded-full bg-[var(--line)] px-1.5 py-0.5 text-[10.5px] font-extrabold text-[var(--ink-2)]">{t.count}</span> : null}
                {active && <span className="absolute inset-x-2 -bottom-px h-[3px] rounded-t-full bg-[#1d3a8f]" />}
              </button>
            );
          })}
        </div>
        </div>
      </div>

      {/* Panel */}
      <div className={`px-5 py-4 ${inline ? "" : "min-h-0 flex-1 overflow-y-auto [scrollbar-color:#c7d2e6_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#c7d2e6] [&::-webkit-scrollbar]:w-2"}`}>
        {actions && live === "main" && <div className="mb-4 flex flex-wrap gap-1.5">{actions}</div>}
        <div key={live} className={dir >= 0 ? "aos-tab-r" : "aos-tab-l"}>

          {live === "main" && <>
            <SectionTitle dot={T.allergy.fg}>Allergies, medical, dietary &amp; SEND</SectionTitle>
            {anyMain ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {on("allergies") && <Fact label="Allergies" tint={T.allergy} full value={info.allergies && `⚠ ${info.allergies}`} />}
                {on("medical") && <Fact label="Medical" tint={T.medical} full value={info.medical} />}
                {on("dietary") && <Fact label="Dietary" tint={T.dietary} full value={info.dietary} />}
                {on("send") && <Fact label="SEND / needs" tint={T.send} full value={(info.send || info.sendPlanName) && `${info.send ?? ""}${info.sendPlanName ? `${info.send ? " · " : ""}plan on file` : ""}`} />}
                {on("swimming") && <Fact label="Swimming" tint={T.swim} value={info.swimming && (SWIM_LABEL[info.swimming] ?? info.swimming)} />}
              </div>
            ) : <div className="rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-3.5 py-2.5 text-[14px] font-semibold text-[#15803d]">✓ Nothing flagged</div>}
            {on("send") && info.sendPlanId && <PlanButton id={info.sendPlanId} name={info.sendPlanName} />}

            {on("consents") && <>
              <SectionTitle dot={T.send.fg}>Permissions</SectionTitle>
              <div className="flex flex-wrap gap-2">
                {([["Photos", info.photoConsent === false ? "No" : yesNo(info.photoConsent)], ["Suncream", yesNo(info.suncreamConsent)], ["First aid", yesNo(info.firstAidConsent)], ["Walk home", yesNo(info.walkHomeConsent)]] as [string, string | undefined][]).map(([l, v]) => v == null ? null : (
                  <span key={l} className="rounded-full border px-3 py-1.5 text-[13px] font-bold" style={v === "Yes" ? { borderColor: "#bbf7d0", background: "#f0fdf4", color: "#15803d" } : { borderColor: "#fecdd3", background: "#fff1f2", color: "#be123c" }}>{l}: {v}</span>
                ))}
              </div>
            </>}

            {answered.length > 0 && <>
              <SectionTitle dot={T.ask.fg}>Parent&rsquo;s answers</SectionTitle>
              <div className="grid gap-2 sm:grid-cols-2">{answered.map(([id, v]) => <Fact key={id} label={qById.get(id)?.label ?? id} tint={T.ask} full value={String(v)} />)}</div>
            </>}
          </>}

          {live === "likes" && (
            <div className="grid gap-2 sm:grid-cols-2">
              {on("likes") && <Fact label="Likes / settles them" tint={T.likes} full value={info.likes} />}
              {on("dislikes") && <Fact label="Dislikes / avoid" tint={T.dislikes} full value={info.dislikes} />}
              {on("careNotes") && <Fact label="Care notes" tint={T.care} full value={info.careNotes} />}
            </div>
          )}

          {live === "medical" && (
            <div className="grid gap-2 sm:grid-cols-2">
              {on("medical") && <Fact label="Medical" tint={T.medical} full value={info.medical} />}
              {on("dietary") && <Fact label="Dietary" tint={T.dietary} full value={info.dietary} />}
              <Fact label="First-aid consent" tint={T.medical} value={yesNo(info.firstAidConsent)} />
              <Fact label="Suncream consent" tint={T.medical} value={yesNo(info.suncreamConsent)} />
            </div>
          )}

          {live === "safeguarding" && (
            <>
              <div className="mb-2.5 rounded-lg border border-[#e2d3f7] bg-[#faf5ff] px-3.5 py-2 text-[12.5px] font-semibold text-[#6d28d9]">
                🔒 Restricted — visible to admins and your safeguarding lead only.
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {on("send") && <Fact label="SEND / needs" tint={T.send} full value={(info.send || info.sendPlanName) && `${info.send ?? ""}${info.sendPlanName ? `${info.send ? " · " : ""}plan on file` : ""}`} />}
                {on("careNotes") && <Fact label="Care notes" tint={T.care} full value={info.careNotes} />}
                {on("emergency") && flds.emergency && <Fact label="Emergency contact" tint={T.emergency} full value={(info.emergencyName || info.emergencyPhone) && `${info.emergencyName ?? ""}${info.emergencyPhone ? ` · ${info.emergencyPhone}` : ""}`} />}
                {on("password") && flds.password && <Fact label="Collection password" tint={T.password} value={info.collectionPassword && <span>🔑 {info.collectionPassword}</span>} />}
              </div>
              {on("send") && info.sendPlanId && <PlanButton id={info.sendPlanId} name={info.sendPlanName} />}
            </>
          )}

          {live === "family" && (
            <>
              <SectionTitle dot={T.medical.fg}>Parent / carer</SectionTitle>
              <div className="grid gap-2 sm:grid-cols-2">
                <Fact label="Name" tint={T.medical} value={info.contactName} />
                <Fact label="Phone" tint={T.medical} value={info.contactPhone} />
                <Fact label="Email" tint={T.medical} full value={info.contactEmail} />
                <Fact label="Address" tint={T.neutral} full value={info.contactAddress} />
              </div>
              {/* Straight to the phone's own dialler / mail app — on a tablet
                  mid-register that beats copying a number out by hand. */}
              <div className="mt-2.5 flex flex-wrap gap-2">
                {info.contactPhone && <ContactLink href={`tel:${info.contactPhone.replace(/[^\d+]/g, "")}`}>📞 Call</ContactLink>}
                {info.contactPhone && <ContactLink href={`sms:${info.contactPhone.replace(/[^\d+]/g, "")}`}>💬 Text</ContactLink>}
                {info.contactPhone && <ContactLink href={`https://wa.me/${info.contactPhone.replace(/[^\d]/g, "").replace(/^0/, "44")}`} external>🟢 WhatsApp</ContactLink>}
                {info.contactEmail && <ContactLink href={`mailto:${info.contactEmail}`}>✉️ Email</ContactLink>}
                {info.contactAddress && <ContactLink href={`https://maps.google.com/?q=${encodeURIComponent(info.contactAddress)}`} external>🗺️ Map</ContactLink>}
              </div>

              {(info.emergencyName || info.emergencyPhone) && <>
                <SectionTitle dot={T.emergency.fg}>Emergency contact</SectionTitle>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Fact label="Name" tint={T.emergency} value={info.emergencyName} />
                  <Fact label="Phone" tint={T.emergency} value={info.emergencyPhone} />
                </div>
                {info.emergencyPhone && <div className="mt-2.5"><ContactLink href={`tel:${info.emergencyPhone.replace(/[^\d+]/g, "")}`}>📞 Call emergency contact</ContactLink></div>}
              </>}

              {info.siblings && info.siblings.length > 0 && <>
                <SectionTitle dot={BLUE}>Siblings</SectionTitle>
                <div className="flex flex-wrap gap-2">{info.siblings.map((n) => <span key={n} className="rounded-full border border-[var(--line)] px-3 py-1.5 text-[13px] font-bold text-[var(--ink-2)]">👥 {n}</span>)}</div>
              </>}
            </>
          )}

          {live === "booking" && (
            <>
              <SectionTitle dot={T.medical.fg}>Contact &amp; collection</SectionTitle>
              <div className="grid gap-2 sm:grid-cols-2">
                {on("mainContact") && <Fact label="Main contact" tint={T.medical} full value={info.contactName && `${info.contactName}${info.contactPhone ? ` · ${info.contactPhone}` : ""}${info.contactEmail ? ` · ${info.contactEmail}` : ""}`} />}
                {on("emergency") && flds.emergency && <Fact label="Emergency contact" tint={T.emergency} full value={(info.emergencyName || info.emergencyPhone) && `${info.emergencyName ?? ""}${info.emergencyPhone ? ` · ${info.emergencyPhone}` : ""}`} />}
                {on("password") && flds.password && <Fact label="Collection password" tint={T.password} value={info.collectionPassword && <span>🔑 {info.collectionPassword}</span>} />}
                {info.bookingRef && <Fact label="Booking ref" tint={T.neutral} value={`#${info.bookingRef}`} />}
                {on("bookingNotes") && <Fact label="Booking notes" tint={T.neutral} full value={info.bookingNotes} />}
                {info.collected && <Fact label="Collected" tint={T.dietary} full value={info.collected} />}
              </div>

              {on("attending") && attend.length > 0 && <>
                <SectionTitle dot={BLUE}>Attending</SectionTitle>
                <button type="button" onClick={() => setShowDays((v) => !v)} className="flex w-full items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2.5 text-left">
                  <span className="text-[14px] font-extrabold text-[var(--ink-2)]">📅 {attend.length} {attend.length === 1 ? "session" : "sessions"} booked</span>
                  <span className="text-[12.5px] font-bold text-[#1d3a8f]">{showDays ? "hide ▲" : "show all ▼"}</span>
                </button>
                {showDays && <ol className="mt-1.5 space-y-1">{attend.map((s, i) => (
                  <li key={`${s.label}-${s.start}-${i}`} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg border border-[var(--line)] px-3.5 py-2 text-[13px]">
                    <span className="font-extrabold text-[var(--ink)]">{s.label}</span>
                    {s.start && <span className="text-[var(--ink-2)]">🕒 {s.start}{s.end ? `–${s.end}` : ""}</span>}
                    {s.listing && <span className="text-[var(--ink-3)]">· {s.listing}</span>}
                  </li>
                ))}</ol>}
              </>}
            </>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
