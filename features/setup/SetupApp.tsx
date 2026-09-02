"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { api, get as apiGet } from "@/lib/api";
import { NAV_GROUPS, type PortalKey } from "@/lib/nav/config";
import { CORE_VIEWS } from "@/lib/use-customer-area";
import { Button, Card, FieldLabel, Input, Select, inputCls } from "@/components/ui";
import { PrintableDoc } from "@/features/money/doc-shared";
import { HowItWorks } from "@/components/HowItWorks";
import { OperatorPage, TabStrip } from "@/components/OperatorPage";
import { RolesPermissions } from "./RolesPermissions";
import {
  useSettings,
  PROVIDER_NOTIFICATIONS,
  EMAIL_DELIVERY_KEY,
  notificationOn,
  answerKey,
  dobRequired,
  DEFAULT_QUESTION_LENGTH,
  type ChildQuestion,
  type QuestionType,
  type TenantSettings,
  inferWho,
  filledDetails,
  VOUCHER_DETAIL_LABELS,
  SCOPED_VOUCHER_LABELS,
  DEFAULT_RATIO_GROUPS,
  type CancelReason,
  type VoucherProvider,
  type RatioGroup,
  TOILET_QUESTION,
} from "@/lib/settings";
import { policyWording, sortBands, HOURS, type CancellationPolicy, type NamedPolicy, type RefundBand } from "@/lib/cancellation";
import { defaultSeasonNames, type Season } from "@/lib/seasons";
import { SG_CATEGORIES, DEFAULT_PROTOCOL } from "@/features/incidents/safeguarding";
import { MembershipTierCard } from "@/features/parent/MembershipsApp";
import { CERT_TEMPLATES, CERT_ACCENTS, certTemplateOf, certificateDoc, openCertificate, CERT_SAMPLE } from "@/features/learning/certificates";
import { useCredentials, DEMO_STAFF } from "@/features/learning/credentials";

// A logo can be a big PNG; /api/uploads caps at ~900KB, so downscale it first
// (keeps transparency via PNG when it fits, else falls back to JPEG).
async function compressLogo(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      // SVGs (and some formats) can report 0×0 — fall back to a sensible box so
      // they still rasterise instead of drawing blank.
      const iw = img.naturalWidth || img.width || 480;
      const ih = img.naturalHeight || img.height || 480;
      const max = 480, s = Math.min(1, max / Math.max(iw, ih));
      const w = Math.round(iw * s), h = Math.round(ih * s);
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const ctx = c.getContext("2d"); if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0, w, h);
      let out = c.toDataURL("image/png");
      if (out.length > 820_000) { let q = 0.85; out = c.toDataURL("image/jpeg", q); while (out.length > 820_000 && q > 0.4) { q -= 0.12; out = c.toDataURL("image/jpeg", q); } }
      resolve(out);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Setup & features — the real screen, replacing the legacy mock.
//
// Scoped to the four screens it actually governs: Listings, Sessions &
// blocks, Bookings and Families. The mock's other five tabs (Comms, Staff &
// workforce, Learning, Meals, Branding) describe features that don't exist
// yet, so they stay in the legacy prototype rather than shipping as controls
// that do nothing.
//
// Two rules this screen follows:
//
// 1. Nothing here is decorative. Every control is read by code. A settings
//    page whose switches don't do anything is worse than no settings page —
//    an operator turns "Collect SEND information" off, believes it, and is
//    still handed SEND data. Anything not yet wired says so on its face.
//
// 2. No Save button. The mock had one and it did nothing. Every change here
//    writes immediately; the header says when it last saved. A Save button on
//    a page of forty toggles is a page of forty chances to lose work.
// ─────────────────────────────────────────────────────────────────────────

type Tab = "features" | "company" | "branding" | "people" | "staff" | "announcements" | "roles" | "reviews" | "learning" | "meals" | "medication" | "safeguarding" | "registers" | "trips" | "calendar" | "inventory" | "groups" | "cancel" | "defaults" | "bookings" | "seasons" | "vouchers" | "marketplace" | "refer" | "memberships" | "notifications" | "money";

// A self-contained toggle for the "email me on a new message" preference. It
// lives on the tenant doc (via /api/messages/settings), not the library-settings
// store the rest of this page uses — so it manages its own load/save.
interface MsgSettings { emailOnNewMessage: boolean; notifyEmail: string; accountEmail: string }
function NotificationsTab() {
  const { settings, save } = useSettings();
  const prefs = settings.notifications ?? {};
  const setPref = (key: string, on: boolean) =>
    void save({ settings: { ...settings, notifications: { ...prefs, [key]: on } } });
  const groups = [...new Set(PROVIDER_NOTIFICATIONS.map((n) => n.group))];
  const emailOn = prefs[EMAIL_DELIVERY_KEY] !== false;

  const [s, setS] = useState<MsgSettings | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    apiGet<MsgSettings>("/api/messages/settings").then((d) => setS(d)).catch(() => setS({ emailOnNewMessage: true, notifyEmail: "", accountEmail: "" }));
  }, []);
  async function change(v: boolean) {
    if (s) setS({ ...s, emailOnNewMessage: v });
    setErr(null);
    try { await api<MsgSettings>("/api/messages/settings", { method: "PUT", body: JSON.stringify({ emailOnNewMessage: v }) }); }
    catch (e) { setErr(e instanceof Error ? e.message : "Couldn’t save"); }
  }
  // Where every alert email lands: the address you sign in with (an old custom
  // override still wins if one was ever set, but the UI to set one is gone).
  const alertEmail = (s?.notifyEmail || s?.accountEmail || "").trim();
  return (
    <Card className="p-5">
      <h3 className="text-[15px] font-extrabold">Message notifications</h3>
      <p className="mb-3 text-[12.5px] text-[var(--ink-3)]">Stay on top of what families send you.</p>
      <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] px-4 py-3">
        <div className="min-w-0">
          <div className="text-[13.5px] font-bold">Email me when I get a new message</div>
          <div className="text-[12px] text-[var(--ink-3)]">We’ll email you the message with a link straight to the conversation.</div>
        </div>
        {s && <Toggle on={s.emailOnNewMessage} onChange={change} />}
      </div>
      {s?.emailOnNewMessage && (
        <div className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3">
          <div className="text-[13px] font-semibold text-[var(--ink)]">
            Sent to <span className="font-extrabold">{alertEmail || "your sign-in email"}</span>
          </div>
          <div className="mt-0.5 text-[12px] text-[var(--ink-3)]">This is the email you sign in with — every alert goes here. To change it, update your email in Account.</div>
        </div>
      )}
      {err && <div className="mt-2 text-[12.5px] text-[var(--red,#e21d27)]">{err}</div>}

      <div className="mt-5 border-t border-[var(--line)] pt-4">
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border-2 px-4 py-3.5"
          style={{ borderColor: emailOn ? "#2f6bd8" : "var(--line)", background: emailOn ? "linear-gradient(180deg,#eff5ff,#fff)" : "var(--surface)" }}>
          <div className="min-w-0">
            <div className="text-[14px] font-extrabold">Platform emails to my personal inbox</div>
            <div className="text-[12px] text-[var(--ink-3)]">
              {emailOn
                ? <>On — you’ll get an email at <span className="font-bold">{alertEmail || "your sign-in email"}</span> for every alert below that’s switched on. Turn this off to keep everything in the in-app bell only, with nothing sent to your inbox.</>
                : "Off — nothing is emailed to you. Every alert still shows in your in-app bell so you don’t miss anything."}
            </div>
          </div>
          <Toggle on={emailOn} onChange={(v) => setPref(EMAIL_DELIVERY_KEY, v)} labels={["On", "Off"]} />
        </div>
        <h3 className="text-[15px] font-extrabold">What we alert you about</h3>
        <p className="mb-3 text-[12.5px] text-[var(--ink-3)]">
          {emailOn
            ? "Each of these sends your team an in-app bell and an email. Switch off any you don’t want — the rest keep coming."
            : "Emails are off above, so these send an in-app bell only. Switch off any you don’t want in the bell either."}
        </p>
        {groups.map((g) => (
          <div key={g} className="mb-3">
            <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-3)]">{g}</div>
            <div className="overflow-hidden rounded-xl border border-[var(--line)]">
              {PROVIDER_NOTIFICATIONS.filter((n) => n.group === g).map((n, i) => (
                <div key={n.key} className={`flex items-center justify-between gap-3 px-4 py-2.5 ${i > 0 ? "border-t border-[var(--line)]" : ""}`}>
                  <div className="min-w-0 text-[13px] font-semibold text-[var(--ink)]">{n.label}</div>
                  <Toggle on={notificationOn(prefs, n.key, n.defaultOff)} onChange={(v) => setPref(n.key, v)} labels={["On", "Off"]} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

const uid = () => Math.random().toString(36).slice(2, 9);

// ── Small shared pieces ────────────────────────────────────────────────────

/** One setting: what it is, why you'd change it, and the control. */
function Row({
  label,
  hint,
  children,
  note,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  note?: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-dashed border-[var(--line)] py-2.5 last:border-b-0">
      <div className="min-w-[220px] flex-1">
        <div className="text-[13px] font-bold">{label}</div>
        {hint && <div className="mt-0.5 text-[11.5px] leading-[1.45] text-[var(--ink-3)]">{hint}</div>}
        {note && (
          <div className="mt-1 inline-block rounded-full bg-[#fff3e0] px-2 py-[1px] text-[10.5px] font-extrabold text-[#8a5300]">
            {note}
          </div>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ on, onChange, labels = ["On", "Off"], disabled }: { on: boolean; onChange: (v: boolean) => void; labels?: [string, string] | string[]; disabled?: boolean }) {
  return (
    <div
      className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--panel)] p-[3px] text-[12px] font-extrabold shadow-[inset_0_1px_2px_rgba(15,23,42,.06)]"
      style={disabled ? { opacity: 0.5 } : undefined}
      title={disabled ? "Locked — turn Simple mode off to use this" : undefined}
    >
      {[true, false].map((v, i) => {
        const active = on === v;
        // "On/Shown/Yes" active → confident green; "Off/Hidden/No" active → calm slate.
        const activeStyle = v
          ? { background: "linear-gradient(180deg,#34d67f,#3f78d8)", color: "#fff", boxShadow: "0 2px 7px -1px rgba(16,163,74,.5)" }
          : { background: "linear-gradient(180deg,#9aa0af,#6b7280)", color: "#fff", boxShadow: "0 2px 7px -1px rgba(71,85,105,.4)" };
        return (
          <button
            key={String(v)}
            type="button"
            disabled={disabled}
            onClick={() => onChange(v)}
            className="rounded-full px-3.5 py-1.5 leading-none transition-all duration-150 disabled:cursor-not-allowed"
            style={active ? activeStyle : { background: "transparent", color: "var(--ink-3)" }}
          >
            {labels[i]}
          </button>
        );
      })}
    </div>
  );
}

function NumberBox({ value, onChange, min = 0, max = 999, suffix }: { value: number; onChange: (n: number) => void; min?: number; max?: number; suffix?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!Number.isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
        className="w-[76px]"
      />
      {suffix && <span className="text-[11.5px] text-[var(--ink-3)]">{suffix}</span>}
    </span>
  );
}

// A notice period a provider can express in hours, days, or "anytime" (0 = a
// session can be moved right up to when it starts). Stored as hours.
type NoticeUnit = "hours" | "days" | "anytime";
function NoticeInput({ hours, onChange }: { hours: number; onChange: (h: number) => void }) {
  const [unit, setUnit] = useState<NoticeUnit>(hours === 0 ? "anytime" : hours % 24 === 0 ? "days" : "hours");
  const shown = unit === "days" ? Math.round(hours / 24) || 1 : hours || 1;
  const apply = (n: number, u: NoticeUnit) => onChange(u === "anytime" ? 0 : Math.max(0, u === "days" ? n * 24 : n));
  return (
    <span className="inline-flex items-center gap-1.5">
      {unit !== "anytime" && (
        <Input
          type="number"
          min={1}
          value={shown}
          onChange={(e) => { const n = parseInt(e.target.value, 10); if (!Number.isNaN(n)) apply(n, unit); }}
          className="w-[76px]"
        />
      )}
      <Select value={unit} onChange={(e) => { const u = e.target.value as NoticeUnit; setUnit(u); apply(shown, u); }}>
        <option value="hours">hours before</option>
        <option value="days">days before</option>
        <option value="anytime">anytime — no limit</option>
      </Select>
    </span>
  );
}

// Amend limit: an "Endless" pill instead of a confusing 0. 0 = endless in the
// store; a specific cap is any number ≥ 1.
function MovesLimit({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const endless = value === 0;
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(endless ? 3 : 0)}
        className="rounded-full border px-3 py-1 text-[11.5px] font-bold"
        style={endless ? { borderColor: "transparent", background: "var(--brand-2)", color: "#fff" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}
      >
        ♾ Endless
      </button>
      {!endless && <NumberBox value={value} onChange={(n) => onChange(Math.max(1, n))} min={1} max={20} suffix="moves" />}
    </span>
  );
}

/**
 * A field that can't be switched off. Shown rather than left out, so the
 * section reads as the complete list of what a family is asked — one headed
 * "what you collect" that never mentions the child's name reads as though it
 * doesn't collect one.
 */
function AlwaysOn() {
  return (
    <span
      title="Can't be switched off — a register without it isn't a register."
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1 text-[11.5px] font-bold text-[var(--ink-3)]"
    >
      <span aria-hidden>🔒</span> Always on
    </span>
  );
}

/**
 * How much a family may write in one field. Sits on the field itself rather
 * than in a table of its own: a list of numbers away from the things they
 * measure means checking two places to answer one question.
 */
function Limit({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <span className="inline-flex items-center gap-1" title="Longest answer a family can give, in characters">
      <NumberBox value={value} onChange={onChange} min={20} max={2000} />
      <span className="text-[11px] text-[var(--ink-3)]">chars</span>
    </span>
  );
}

/**
 * An editable list of plain strings — pay methods, cancellation reasons and
 * so on. Renaming is inline rather than behind an edit mode: these are lists
 * of six things, and a modal to fix a typo is absurd.
 */
function ListEditor({
  items,
  onChange,
  placeholder,
  warn,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  /** Shown when removing — the consequence the operator can't see. */
  warn?: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v || items.includes(v)) return;
    onChange([...items, v]);
    setDraft("");
  };
  return (
    <div>
      <div className="mb-2 flex flex-col gap-1.5">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Input
              value={it}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
              className="flex-1"
            />
            <button
              type="button"
              aria-label={`Remove ${it}`}
              onClick={() => {
                if (warn && !confirm(`Remove “${it}”?\n\n${warn}`)) return;
                onChange(items.filter((_, j) => j !== i));
              }}
              className="px-1.5 text-[var(--ink-3)] hover:text-[var(--red,#e21d27)]"
            >
              ✕
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-[12px] text-[var(--ink-3)]">Nothing here yet — add the first below.</div>
        )}
      </div>
      <div className="flex gap-1.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={placeholder}
          className="flex-1"
        />
        <Button onClick={add}>＋ Add</Button>
      </div>
    </div>
  );
}

// ── How parents pay — fixed rails (toggle on/off) + your own labels ──────────
// Each standard method shows the payment state a booking lands in, so it's clear
// which ones sit as "awaiting payment" vs paid straight away.
const PAY_STANDARD: { label: string; behaviour: string; tone: "paid" | "pending" | "funded"; note: string }[] = [
  { label: "Card", behaviour: "Paid instantly", tone: "paid", note: "Routes to Stripe — the booking is marked Paid the moment it goes through." },
  { label: "Bank transfer", behaviour: "Awaiting payment", tone: "pending", note: "Sits as awaiting payment until you reconcile the transfer." },
  { label: "Cash on the day", behaviour: "Awaiting payment", tone: "pending", note: "Unpaid until they pay you on arrival." },
  { label: "Tax-Free Childcare", behaviour: "Awaiting payment", tone: "pending", note: "Awaiting the scheme's money (a few days in transit)." },
  { label: "Childcare vouchers", behaviour: "Awaiting payment", tone: "pending", note: "Awaiting the voucher scheme's payment." },
  { label: "HAF (funded £0)", behaviour: "Funded · £0", tone: "funded", note: "A £0 funded place — no payment is taken." },
];
const PAY_TONE: Record<string, { bg: string; fg: string }> = {
  paid: { bg: "#dff3e6", fg: "#127a3e" },
  pending: { bg: "#f7ead0", fg: "#9a5a00" },
  funded: { bg: "#e4edfd", fg: "#1d3a8f" },
};
function PayMethodEditor({ items, onChange }: { items: string[]; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const standard = new Set(PAY_STANDARD.map((m) => m.label));
  const enabled = new Set(items);
  const customs = items.filter((x) => !standard.has(x) && x !== "Free place");
  const strip = (xs: string[]) => xs.filter((x) => x !== "Free place");
  const toggle = (label: string, on: boolean) => onChange(on ? [...strip(items.filter((x) => x !== label)), label] : strip(items.filter((x) => x !== label)));
  const addCustom = () => { const v = draft.trim(); if (!v || items.includes(v)) return; onChange([...strip(items), v]); setDraft(""); };
  const badge = (tone: string, text: string) => <span className="flex-none rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: PAY_TONE[tone].bg, color: PAY_TONE[tone].fg }}>{text}</span>;
  return (
    <div className="flex flex-col gap-1.5">
      {PAY_STANDARD.map((m) => (
        <div key={m.label} className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-3 py-2">
          <span className="text-[13px] font-semibold text-[var(--ink)]">{m.label}</span>
          {badge(m.tone, m.behaviour)}
          <span className="hidden text-[11px] text-[var(--ink-3)] lg:inline">· {m.note}</span>
          <div className="ml-auto"><Toggle on={enabled.has(m.label)} onChange={(v) => toggle(m.label, v)} /></div>
        </div>
      ))}
      {customs.length > 0 && <div className="mt-2 text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Your own methods</div>}
      {customs.map((it) => (
        <div key={it} className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-3 py-2">
          <Input value={it} onChange={(e) => onChange(items.map((x) => (x === it ? e.target.value : x)))} className="flex-1" />
          {badge("pending", "Awaiting payment")}
          <button type="button" aria-label={`Remove ${it}`} onClick={() => { if (!confirm(`Remove “${it}”?\n\nBookings already recorded against it keep the method; it just stops being offered on new ones.`)) return; onChange(items.filter((x) => x !== it)); }} className="px-1.5 text-[var(--ink-3)] hover:text-[var(--red,#e21d27)]">✕</button>
        </div>
      ))}
      <div className="mt-1 flex gap-1.5">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCustom()} placeholder="Add your own — e.g. Standing order" className="flex-1" />
        <Button onClick={addCustom}>＋ Add</Button>
      </div>
    </div>
  );
}

// ── Seasons — just the names; listings pick their season in the listing builder ──
function SeasonsEditor({ items, onChange }: { items: Season[]; onChange: (next: Season[]) => void }) {
  const patch = (id: string, fn: (s: Season) => Season) => onChange(items.map((s) => (s.id === id ? fn(s) : s)));
  const remove = (name: string, id: string) => { if (confirm(`Remove “${name}”?\n\nListings set to it just become “no season”.`)) onChange(items.filter((s) => s.id !== id)); };
  const add = () => onChange([...items, { id: `s-${uid()}`, name: "New season" }]);
  const reset = () => { if (confirm("Replace your seasons with the standard UK set?\n\nThe 6 term half-terms + all 6 holidays (Oct, Christmas, Feb, Easter, May, Summer) + Full year. Any listing already set to one of your current seasons will need re-picking its season.")) onChange(defaultSeasonNames()); };
  return (
    <div className="flex flex-col gap-1.5">
      <div className="rounded-lg border-l-4 border-[#2f6bd8] bg-[#eef4fd] px-3 py-2 text-[12px] text-[#1d3a8f]">📅 Just the <b>names</b> here — no dates. You pick a listing’s season <b>when you build the listing</b> (Basics step). Bookings, audiences and takings then group by it, so different holiday dates across towns don’t matter.</div>
      {items.map((s) => (
        <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 py-2">
          <Input value={s.name} onChange={(e) => patch(s.id, (x) => ({ ...x, name: e.target.value }))} placeholder="Season name" className="min-w-[160px] flex-1 font-semibold" />
          <button type="button" aria-label={`Remove ${s.name}`} onClick={() => remove(s.name, s.id)} className="px-1.5 text-[var(--ink-3)] hover:text-[var(--red,#e21d27)]">✕</button>
        </div>
      ))}
      <div className="mt-1 flex flex-wrap gap-2">
        <Button sm onClick={add}>＋ Add a season</Button>
        <Button sm variant="ghost" onClick={reset}>↺ Reset to standard UK seasons</Button>
      </div>
    </div>
  );
}

/**
 * A control whose value is stored but not yet read by the screen it governs.
 *
 * This screen's rule is that nothing on it is decorative — a switch that does
 * nothing is worse than no switch, because an operator believes it. Where the
 * consuming screen hasn't been wired up yet the setting says so out loud,
 * rather than quietly lying about what it does.
 */
function NotWired({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 rounded-lg border border-[#f0d9a8] bg-[#fff8ec] px-2.5 py-1.5 text-[11px] font-semibold leading-[1.45] text-[#8a5300]">
      ⚠ {children}
    </div>
  );
}

/**
 * Cancellation reasons, each scoped to who's offered it.
 *
 * One flat list can't serve both sides: "Venue unavailable" in a parent's
 * dropdown is nonsense, and "Staffing" tells them something about how you run
 * that isn't theirs to know. The scope sits on the row rather than being two
 * separate lists to keep in step.
 */
function ReasonEditor({ items, onChange }: { items: CancelReason[]; onChange: (v: CancelReason[]) => void }) {
  const [draft, setDraft] = useState("");
  const WHO: [CancelReason["who"], string][] = [["provider", "You"], ["parent", "Parents"], ["both", "Both"]];
  const add = () => {
    const label = draft.trim();
    if (!label) return;
    // Guessed from the wording — "Coach unavailable" is obviously yours.
    onChange([...items, { id: uid(), label, who: inferWho(label) }]);
    setDraft("");
  };
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2 text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">
        <span className="flex-1">Reason</span>
        <span className="w-[190px]">Offered to</span>
        <span className="w-[22px]" />
      </div>
      <div className="mb-2 flex flex-col gap-1.5">
        {items.map((r, i) => (
          <div key={r.id} className="flex flex-wrap items-center gap-2">
            <Input
              value={r.label}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
              className="flex-1"
              maxLength={60}
            />
            <span className="inline-flex w-[190px] overflow-hidden rounded-full border border-[var(--line)] text-[11.5px] font-bold">
              {WHO.map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => onChange(items.map((x, j) => (j === i ? { ...x, who: v } : x)))}
                  className="flex-1 px-2 py-1 transition-colors"
                  style={r.who === v ? { background: "var(--brand-soft)", color: "var(--brand-ink)" } : { color: "var(--ink-3)" }}
                >
                  {l}
                </button>
              ))}
            </span>
            <button
              type="button"
              aria-label={`Remove ${r.label}`}
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="w-[22px] text-[var(--ink-3)] hover:text-[var(--red,#e21d27)]"
            >
              &#10005;
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-[12px] text-[var(--ink-3)]">
            No reasons — whoever cancels just types one, or leaves it blank.
          </div>
        )}
      </div>
      <div className="flex gap-1.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="e.g. Coach unavailable"
          className="flex-1"
        />
        <Button onClick={add}>&#65291; Add</Button>
      </div>
    </div>
  );
}

/**
 * The voucher schemes a provider is registered with.
 *
 * Labelled details rather than one reference: Sodexo wants a setting name,
 * Computershare an account number, some an Ofsted number. The labels are
 * editable because no fixed set covers them all.
 */
function VoucherEditor({ items, onChange }: { items: VoucherProvider[]; onChange: (v: VoucherProvider[]) => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  // Listings + locations (venues) so an account no / Ofsted / reference can be
  // pinned to the right registered setting.
  const [listings, setListings] = useState<{ id: string; title?: string; name?: string; venueId?: string | null }[]>([]);
  const [venues, setVenues] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    apiGet<{ id: string; title?: string; name?: string; venueId?: string | null }[]>("/api/listings?mine=1").then((l) => setListings(Array.isArray(l) ? l : [])).catch(() => {});
    apiGet<{ venues?: { id: string; name: string }[] }>("/api/library").then((lib) => setVenues(lib.venues ?? [])).catch(() => {});
  }, []);
  const live = items.filter((v) => filledDetails(v).length).length;
  const patch = (i: number, fn: (v: VoucherProvider) => VoucherProvider) =>
    onChange(items.map((x, j) => (j === i ? fn(x) : x)));

  return (
    <div>
      {items.map((v, i) => {
        const open = openId === v.id;
        const filled = filledDetails(v);
        return (
          <div key={v.id} className="mb-2 rounded-xl border border-[var(--line)] p-2.5" style={filled.length ? undefined : { opacity: 0.72 }}>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={v.name}
                onChange={(e) => patch(i, (x) => ({ ...x, name: e.target.value }))}
                placeholder="Scheme name"
                className="w-[190px]"
                maxLength={50}
              />
              <span className="min-w-0 flex-1 truncate text-[11.5px] text-[var(--ink-3)]">
                {filled.length
                  ? filled.map((d) => `${d.label}: ${d.value}`).join("  ·  ")
                  : "Not registered — parents won’t be offered this one"}
              </span>
              <Button sm onClick={() => setOpenId(open ? null : v.id)}>{open ? "Done" : "Details"}</Button>
              <button
                type="button"
                aria-label={`Remove ${v.name}`}
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                className="w-[22px] text-[var(--ink-3)] hover:text-[var(--red,#e21d27)]"
              >
                &#10005;
              </button>
            </div>

            {open && (
              <div className="mt-3 border-t border-dashed border-[var(--line)] pt-3">
                <div className="mb-1.5 flex items-center gap-2 text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">
                  <span className="w-[190px]">What they call it</span>
                  <span className="flex-1">What to quote</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {v.details.map((d, k) => (
                    <div key={d.id} className="flex flex-wrap items-center gap-2">
                      <Input
                        value={d.label}
                        onChange={(e) => patch(i, (x) => ({ ...x, details: x.details.map((y, n) => (n === k ? { ...y, label: e.target.value } : y)) }))}
                        list="voucher-detail-labels"
                        className="w-[190px]"
                        maxLength={40}
                      />
                      <Input
                        value={d.value}
                        onChange={(e) => patch(i, (x) => ({ ...x, details: x.details.map((y, n) => (n === k ? { ...y, value: e.target.value } : y)) }))}
                        placeholder="e.g. 0026978613"
                        className="flex-1"
                        maxLength={60}
                      />
                      <button
                        type="button"
                        aria-label={`Remove ${d.label}`}
                        onClick={() => patch(i, (x) => ({ ...x, details: x.details.filter((_, n) => n !== k) }))}
                        className="w-[22px] text-[var(--ink-3)] hover:text-[var(--red,#e21d27)]"
                      >
                        &#10005;
                      </button>
                      {SCOPED_VOUCHER_LABELS.test(d.label) && (
                        <div className="flex w-full flex-wrap items-center gap-2 pl-1 text-[11px] text-[var(--ink-3)]">
                          <span className="font-bold uppercase tracking-wide">Applies to</span>
                          <select value={d.listingId ?? ""} onChange={(e) => patch(i, (x) => ({ ...x, details: x.details.map((y, n) => (n === k ? { ...y, listingId: e.target.value || null, ...(e.target.value ? { locationId: null } : {}) } : y)) }))} className="max-w-[220px] rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[12px]">
                            <option value="">All listings</option>
                            {listings.map((l) => <option key={l.id} value={l.id}>{l.title || l.name || "Listing"}</option>)}
                          </select>
                          <span>·</span>
                          <select value={d.locationId ?? ""} disabled={!!d.listingId} onChange={(e) => patch(i, (x) => ({ ...x, details: x.details.map((y, n) => (n === k ? { ...y, locationId: e.target.value || null } : y)) }))} className="max-w-[220px] rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[12px] disabled:opacity-50">
                            <option value="">{d.listingId ? "(that listing's location)" : "All locations"}</option>
                            {venues.map((vn) => <option key={vn.id} value={vn.id}>{vn.name}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <Button sm className="mt-2" onClick={() => patch(i, (x) => ({ ...x, details: [...x.details, { id: uid(), label: "", value: "" }] }))}>
                  &#65291; Add a detail
                </Button>
                <p className="mt-2 text-[11px] leading-snug text-[var(--ink-3)]">Tip: add a <b>Website</b> detail (optional) — the sign-in link for this scheme. It shows the family a tappable link at checkout and in their confirmation email so they can pay in one tap.</p>
              </div>
            )}
          </div>
        );
      })}

      <datalist id="voucher-detail-labels">
        {VOUCHER_DETAIL_LABELS.map((l) => <option key={l} value={l} />)}
      </datalist>

      <div className="mt-1 flex items-center gap-2">
        <Button onClick={() => onChange([...items, { id: uid(), name: "", details: [{ id: uid(), label: "Account number/ID", value: "" }] }])}>
          &#65291; Add a scheme
        </Button>
        <span className="text-[11.5px] text-[var(--ink-3)]">
          {live === 0
            ? "None filled in yet — parents won’t be offered vouchers at all."
            : `${live} scheme${live === 1 ? "" : "s"} offered to parents.`}
        </span>
      </div>
    </div>
  );
}

function Section({ title, lede, children }: { title: string; lede?: string; children: React.ReactNode }) {
  return (
    <Card className="mb-3.5 p-4">
      <div className="text-[15px] font-extrabold">{title}</div>
      {lede && <p className="mb-2 mt-0.5 text-[12px] leading-[1.5] text-[var(--ink-3)]">{lede}</p>}
      {children}
    </Card>
  );
}

// ── Age groups & rooms ──────────────────────────────────────────────────────

/**
 * The single source of truth for the tenant's age groups: name, colour, age
 * band, target ratio and room size. Defined here once, then referenced
 * everywhere — the Ratios & groups board, the cover calculator, and every
 * listing's age caps. A listing can only cap a group *below* its room size,
 * never above, so these numbers can't be contradicted from a listing. This is
 * the same record the Ratios page shows; editing it in either place is the
 * same edit.
 */
function GroupsEditor({ groups, onChange }: { groups: RatioGroup[]; onChange: (g: RatioGroup[]) => void }) {
  const patch = (i: number, fn: (g: RatioGroup) => RatioGroup) => onChange(groups.map((x, j) => (j === i ? fn(x) : x)));
  const num = (v: string, min: number) => Math.max(min, parseInt(v, 10) || min);
  const inp = "rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[12.5px]";
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr className="text-[10.5px] uppercase tracking-[0.04em] text-[var(--ink-3)]">
            <th className="px-2 py-1.5 text-left font-extrabold">Colour</th>
            <th className="px-2 py-1.5 text-left font-extrabold">Group</th>
            <th className="px-2 py-1.5 text-left font-extrabold">Age</th>
            <th className="px-2 py-1.5 text-left font-extrabold">Target ratio</th>
            <th className="px-2 py-1.5 text-left font-extrabold">Room size</th>
            <th className="px-2 py-1.5" />
          </tr>
        </thead>
        <tbody>
          {groups.map((g, i) => (
            <tr key={g.id} className="border-t border-[var(--line)]">
              <td className="px-2 py-1.5">
                <input type="color" value={g.colour} onChange={(e) => patch(i, (x) => ({ ...x, colour: e.target.value }))} className="h-7 w-10 cursor-pointer rounded border border-[var(--line)] bg-transparent p-0.5" aria-label={`${g.name} colour`} />
              </td>
              <td className="px-2 py-1.5">
                <input value={g.name} onChange={(e) => patch(i, (x) => ({ ...x, name: e.target.value }))} className={`${inp} w-[130px] font-bold`} placeholder="Group name" />
              </td>
              <td className="px-2 py-1.5">
                <span className="inline-flex items-center gap-1">
                  <input type="number" min={0} max={21} value={g.ageFrom} onChange={(e) => patch(i, (x) => ({ ...x, ageFrom: num(e.target.value, 0) }))} className={`${inp} w-[52px]`} />
                  <span className="text-[var(--ink-3)]">to</span>
                  <input type="number" min={0} max={21} value={g.ageTo} onChange={(e) => patch(i, (x) => ({ ...x, ageTo: num(e.target.value, 0) }))} className={`${inp} w-[52px]`} />
                  <span className="text-[var(--ink-3)]">yrs</span>
                </span>
              </td>
              <td className="px-2 py-1.5">
                <span className="inline-flex items-center gap-1">1 :<input type="number" min={1} value={g.targetRatio} onChange={(e) => patch(i, (x) => ({ ...x, targetRatio: num(e.target.value, 1) }))} className={`${inp} w-[56px]`} /></span>
              </td>
              <td className="px-2 py-1.5">
                <input type="number" min={0} value={g.maxSize || ""} placeholder="no cap" onChange={(e) => patch(i, (x) => ({ ...x, maxSize: Math.max(0, parseInt(e.target.value, 10) || 0) }))} className={`${inp} w-[72px]`} />
              </td>
              <td className="px-2 py-1.5 text-right">
                <button type="button" onClick={() => onChange(groups.filter((_, j) => j !== i))} aria-label={`Remove ${g.name}`} className="text-[16px] leading-none text-[var(--ink-3)] hover:text-[var(--red,#e21d27)]">×</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2.5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => onChange([...groups, { id: uid(), name: `Group ${groups.length + 1}`, colour: "#2f6bd8", ageFrom: 0, ageTo: 18, targetRatio: 8, maxSize: 24 }])}
          className="rounded-full border border-dashed border-[var(--line)] px-3 py-1 text-[12px] font-bold text-[var(--brand-ink,#1d3a8f)]"
        >
          ＋ Add group
        </button>
        {groups.length === 0 && (
          <button type="button" onClick={() => onChange(DEFAULT_RATIO_GROUPS)} className="text-[12px] font-bold text-[var(--brand-ink,#1d3a8f)] underline">
            Start from the standard groups
          </button>
        )}
        <span className="text-[11px] text-[var(--ink-3)]">Leave <b>room size</b> blank for no cap.</span>
      </div>
    </div>
  );
}

// ── Cancellation policy ────────────────────────────────────────────────────

/**
 * Every notice period, grouped, with the usual ones pulled to the top.
 *
 * A short list of six is quicker to use and wrong for anyone who needs 36
 * hours or a month. Showing everything and *saying* which are common gets
 * both: the provider who wants "48 hours" finds it immediately, and the one
 * running residentials can still pick 4 weeks.
 */
const COMMON_NOTICE: [number, string][] = [
  [HOURS.twoWeeks, "2 weeks"],
  [HOURS.week, "1 week"],
  [HOURS.twoDays, "48 hours"],
  [HOURS.day, "24 hours"],
];

const NOTICE_GROUPS: { label: string; items: [number, string][] }[] = [
  { label: "Most used", items: COMMON_NOTICE },
  { label: "Hours", items: Array.from({ length: 23 }, (_, i) => [i + 1, `${i + 1} hour${i === 0 ? "" : "s"}`] as [number, string]) },
  { label: "Days", items: Array.from({ length: 6 }, (_, i) => [(i + 1) * 24, `${i + 1} day${i === 0 ? "" : "s"}`] as [number, string]) },
  { label: "Weeks", items: Array.from({ length: 8 }, (_, i) => [(i + 1) * HOURS.week, `${i + 1} week${i === 0 ? "" : "s"}`] as [number, string]) },
];

const NOTICE_CHOICES: [number, string][] = NOTICE_GROUPS.flatMap((g) => g.items);

/**
 * The refund rules, as rules.
 *
 * The wording underneath is generated live, so the provider can see exactly
 * what a parent will read as they change the numbers. That's the whole point
 * of the rewrite: prose typed separately from the rules drifts away from
 * them, and then the page promises one thing while the system does another.
 */
function PolicyList({ policies, onChange }: { policies: NamedPolicy[]; onChange: (v: NamedPolicy[]) => void }) {
  const [openId, setOpenId] = useState<string | null>(policies[0]?.id ?? null);
  return (
    <div>
      {policies.map((p, i) => {
        const open = openId === p.id;
        return (
          <div key={p.id} className="mb-2.5 rounded-xl border border-[var(--line)] p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              {i === 0 && (
                <span
                  title="New listings start on this one."
                  className="rounded-full bg-[var(--brand-soft)] px-2 py-[2px] text-[10px] font-extrabold text-[var(--brand-ink)]"
                >
                  DEFAULT
                </span>
              )}
              <Input
                value={p.name}
                onChange={(e) => onChange(policies.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                placeholder="Name this policy"
                className="w-[190px]"
                maxLength={40}
              />
              <span className="min-w-0 flex-1 text-[11.5px] text-[var(--ink-3)]">
                {sortBands(p.bands)
                  .map((b) => (b.hoursBefore > 0 ? `${NOTICE_CHOICES.find(([h]) => h === b.hoursBefore)?.[1] ?? `${b.hoursBefore}h`}: ${b.refundPercent}%` : `later: ${b.refundPercent}%`))
                  .join("  ·  ")}
              </span>
              <Button sm onClick={() => setOpenId(open ? null : p.id)}>{open ? "Done" : "Edit rules"}</Button>
            </div>
            {open && (
              <div className="mt-3 border-t border-dashed border-[var(--line)] pt-3">
                <PolicyEditor policy={p} onChange={(next) => onChange(policies.map((x, j) => (j === i ? { ...x, ...next } : x)))} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PolicyEditor({ policy, onChange }: { policy: CancellationPolicy; onChange: (p: CancellationPolicy) => void }) {
  const bands = sortBands(policy.bands);
  const tiers = bands.filter((b) => b.hoursBefore > 0);
  const floor = bands.find((b) => b.hoursBefore <= 0) ?? { hoursBefore: 0, refundPercent: 0 };

  const write = (nextTiers: RefundBand[], nextFloor: RefundBand) =>
    onChange({ ...policy, bands: [...sortBands(nextTiers), nextFloor] });

  // The floor is "less than your shortest notice period", so it says that
  // rather than "any later than that", which left the reader working out
  // later than *what*.
  const shortest = tiers.length ? tiers[tiers.length - 1].hoursBefore : 0;
  const shortestLabel = NOTICE_CHOICES.find(([h]) => h === shortest)?.[1] ?? `${shortest} hours`;
  const cell = "px-2 py-2";

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="text-[10.5px] uppercase tracking-[0.04em] text-[var(--ink-3)]">
              <th className={`${cell} text-left font-extrabold`}>Notice the family gives</th>
              <th className={`${cell} text-left font-extrabold`}>They get back</th>
              <th className={cell} />
            </tr>
          </thead>
          <tbody>
            {tiers.map((b, i) => (
              <tr key={i} className="border-t border-[var(--line)]">
                <td className={cell}>
                  <span className="flex items-center gap-1.5">
                    <Select
                      value={String(b.hoursBefore)}
                      onChange={(e) => write(tiers.map((x, j) => (j === i ? { ...x, hoursBefore: Number(e.target.value) } : x)), floor)}
                    >
                      {NOTICE_GROUPS.map((g) => (
                        <optgroup key={g.label} label={g.label}>
                          {g.items.map(([h, l]) => (
                            <option key={`${g.label}-${h}`} value={h}>{l}</option>
                          ))}
                        </optgroup>
                      ))}
                    </Select>
                    <span className="whitespace-nowrap text-[var(--ink-3)]">or more</span>
                  </span>
                </td>
                <td className={cell}>
                  <NumberBox
                    value={b.refundPercent}
                    onChange={(n) => write(tiers.map((x, j) => (j === i ? { ...x, refundPercent: n } : x)), floor)}
                    min={0}
                    max={100}
                    suffix="%"
                  />
                </td>
                <td className={`${cell} text-right`}>
                  <button
                    type="button"
                    aria-label="Remove this row"
                    onClick={() => write(tiers.filter((_, j) => j !== i), floor)}
                    className="px-1.5 text-[var(--ink-3)] hover:text-[var(--red,#e21d27)]"
                  >
                    &#10005;
                  </button>
                </td>
              </tr>
            ))}
            <tr className="border-t border-[var(--line)] bg-[var(--panel)]">
              <td className={cell}>
                <span className="font-semibold">{tiers.length ? `Less than ${shortestLabel}` : "Any notice at all"}</span>
                <span className="ml-1.5 text-[11px] text-[var(--ink-3)]">including after it has started</span>
              </td>
              <td className={cell}>
                <NumberBox value={floor.refundPercent} onChange={(n) => write(tiers, { hoursBefore: 0, refundPercent: n })} min={0} max={100} suffix="%" />
              </td>
              <td className={cell} />
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-2">
        <Button onClick={() => write([...tiers, { hoursBefore: HOURS.day, refundPercent: 25 }], floor)}>
          &#65291; Add a row
        </Button>
      </div>

      <div className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
        <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">
          What parents will read
        </div>
        <div className="text-[12.5px] leading-[1.55]">{policyWording({ ...policy, wording: undefined })}</div>
        <div className="mt-2 text-[10.5px] leading-[1.45] text-[var(--ink-3)]">
          Written from the rows above. When someone cancels, the same rows work out what&apos;s owed
          and show it to you &mdash; you always decide whether to send it. ActivityOS never moves money.
        </div>
      </div>
    </div>
  );
}

// ── Child questions ────────────────────────────────────────────────────────

const TYPE_LABEL: Record<QuestionType, string> = {
  text: "Typed answer",
  choice: "Pick one",
  yesno: "Yes / No",
};

/**
 * The questions a parent answers about their child, once, on the child's
 * profile — so they carry to every booking rather than being re-asked.
 *
 * Name, date of birth and the safeguarding fields are built in and not
 * listed here: they aren't optional, and offering to delete them would be
 * offering to break a register.
 */
function QuestionsEditor({
  questions,
  onChange,
  listings,
}: {
  questions: ChildQuestion[];
  onChange: (next: ChildQuestion[]) => void;
  listings: { id: string; title: string }[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  const patch = (id: string, fn: (q: ChildQuestion) => ChildQuestion) =>
    onChange(questions.map((q) => (q.id === id ? fn(q) : q)));

  const add = () => {
    const q: ChildQuestion = { id: uid(), label: "", type: "text", scope: "all" };
    onChange([...questions, q]);
    setOpenId(q.id);
  };

  // One-tap preset — it carries the `kind` the register needs for the nappy
  // badge and change log, which a hand-typed question can't.
  const hasToilet = questions.some((q) => q.kind === "toilet");
  const addToilet = () => {
    if (hasToilet) { setOpenId(TOILET_QUESTION.id); return; }
    onChange([...questions, { ...TOILET_QUESTION }]);
    setOpenId(TOILET_QUESTION.id);
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= questions.length) return;
    const next = [...questions];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div>
      {questions.map((q, i) => {
        const open = openId === q.id;
        const scoped = q.scope !== "all";
        return (
          <div
            key={q.id}
            className="mb-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-2.5"
            style={q.hidden ? { opacity: 0.62 } : undefined}
          >
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-col">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="text-[10px] leading-none text-[var(--ink-3)] disabled:opacity-25" aria-label="Move up">▲</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === questions.length - 1} className="text-[10px] leading-none text-[var(--ink-3)] disabled:opacity-25" aria-label="Move down">▼</button>
              </div>

              <div className="min-w-[160px] flex-1">
                <div className="text-[13px] font-bold">{q.label || <span className="text-[var(--ink-3)]">Untitled question</span>}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--ink-3)]">
                  <span>{TYPE_LABEL[q.type]}</span>
                  {q.required && <span className="rounded-full bg-[var(--brand-soft)] px-1.5 font-bold text-[var(--brand-ink)]">Must answer</span>}
                  {q.ask === "every" && <span className="rounded-full bg-[var(--surface)] px-1.5 font-bold">Every booking</span>}
                  <span>· {scoped ? `${(q.scope as string[]).length} listing${(q.scope as string[]).length === 1 ? "" : "s"}` : "All listings"}</span>
                  {(q.minAge !== undefined || q.maxAge !== undefined) && (
                    <span className="rounded-full bg-[var(--surface)] px-1.5 font-bold">
                      {q.minAge !== undefined && q.maxAge !== undefined
                        ? `Ages ${q.minAge}–${q.maxAge}`
                        : q.minAge !== undefined
                          ? `Ages ${q.minAge}+`
                          : `Under ${(q.maxAge ?? 0) + 1}`}
                    </span>
                  )}
                  {q.hidden && <span className="rounded-full bg-[var(--surface)] px-1.5 font-bold">Hidden</span>}
                </div>
              </div>

              <Toggle on={!q.hidden} onChange={(v) => patch(q.id, (x) => ({ ...x, hidden: !v }))} labels={["Asking", "Hidden"]} />
              <Button sm onClick={() => setOpenId(open ? null : q.id)}>{open ? "Done" : "Edit"}</Button>
            </div>

            {open && (
              <div className="mt-3 border-t border-dashed border-[var(--line)] pt-3">
                <div className="grid gap-2.5 md:grid-cols-2">
                  <div>
                    <FieldLabel>Question</FieldLabel>
                    <Input
                      value={q.label}
                      onChange={(e) => patch(q.id, (x) => ({ ...x, label: e.target.value }))}
                      placeholder="e.g. Can your child swim 25m?"
                      className="w-full"
                      maxLength={80}
                    />
                  </div>
                  <div>
                    <FieldLabel>Answer type</FieldLabel>
                    <Select
                      value={q.type}
                      onChange={(e) => patch(q.id, (x) => ({ ...x, type: e.target.value as QuestionType }))}
                      className="w-full"
                    >
                      <option value="text">Typed answer</option>
                      <option value="choice">Pick one</option>
                      <option value="yesno">Yes / No</option>
                    </Select>
                  </div>
                </div>

                <div className="mt-2.5">
                  <FieldLabel>Helper text — optional</FieldLabel>
                  <Input
                    value={q.help ?? ""}
                    onChange={(e) => patch(q.id, (x) => ({ ...x, help: e.target.value || undefined }))}
                    placeholder="Shown under the question — say why you're asking"
                    className="w-full"
                    maxLength={120}
                  />
                </div>

                {q.type === "text" && (
                  <div className="mt-2.5">
                    <FieldLabel>Longest answer</FieldLabel>
                    <NumberBox
                      value={q.maxLength ?? DEFAULT_QUESTION_LENGTH}
                      onChange={(n) => patch(q.id, (x) => ({ ...x, maxLength: n }))}
                      min={20}
                      max={2000}
                      suffix="characters"
                    />
                    <div className="mt-1 text-[10.5px] leading-[1.45] text-[var(--ink-3)]">
                      Too short and a parent can&apos;t say what they need to; too long and your
                      registers and exports become unreadable.
                    </div>
                  </div>
                )}

                {q.type === "choice" && (
                  <div className="mt-2.5">
                    <FieldLabel>Options</FieldLabel>
                    <ListEditor
                      items={q.options ?? []}
                      onChange={(options) => patch(q.id, (x) => ({ ...x, options }))}
                      placeholder="Add an option"
                    />
                  </div>
                )}

                <div className="mt-3">
                  <FieldLabel>When it&apos;s asked</FieldLabel>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      sm
                      variant={q.ask !== "every" ? "primary" : "default"}
                      onClick={() => patch(q.id, (x) => ({ ...x, ask: "once" }))}
                    >
                      Once, when they sign up
                    </Button>
                    <Button
                      sm
                      variant={q.ask === "every" ? "primary" : "default"}
                      onClick={() => patch(q.id, (x) => ({ ...x, ask: "every" }))}
                    >
                      Every booking
                    </Button>
                  </div>
                  <div className="mt-1 text-[10.5px] leading-[1.45] text-[var(--ink-3)]">
                    {q.ask === "every"
                      ? "Asked again on each new booking, and the answer replaces the old one. For anything that goes stale — a recent injury is true in March and wrong by August."
                      : "Asked while the child is being set up, then carried to every booking after. Right for anything that doesn't change: dietary needs, swimming ability. Families won't be asked twice."}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-[12px] font-bold">Must be answered</span>
                  <Toggle on={!!q.required} onChange={(v) => patch(q.id, (x) => ({ ...x, required: v }))} labels={["Yes", "No"]} />
                </div>

                {q.type === "yesno" && (
                  <div className="mt-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[12px] font-bold">If they answer <b>No</b>, hold for your approval</span>
                      <Toggle on={!!q.reviewIfNo} onChange={(v) => patch(q.id, (x) => ({ ...x, reviewIfNo: v || undefined }))} labels={["Yes", "No"]} />
                    </div>
                    <div className="mt-1 text-[10.5px] leading-[1.45] text-[var(--ink-3)]">
                      {q.reviewIfNo
                        ? "The family can still book. It arrives as “Approval needed” for you to accept or decline, rather than confirming itself."
                        : "The booking confirms itself whatever they answer."}
                    </div>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-[12px] font-bold">Show on child info for staff</span>
                  <Toggle on={q.showOnRegister !== false} onChange={(v) => patch(q.id, (x) => ({ ...x, showOnRegister: v }))} labels={["Yes", "No"]} />
                  <span className="text-[11.5px] text-[var(--ink-3)]">The answer appears on the child&rsquo;s register card on the day.</span>
                </div>

                <div className="mt-3">
                  <FieldLabel>Only ask about children aged</FieldLabel>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Input
                      type="number"
                      min={0}
                      max={18}
                      value={q.minAge ?? ""}
                      placeholder="any"
                      onChange={(e) => patch(q.id, (x) => ({ ...x, minAge: e.target.value === "" ? undefined : Math.max(0, Math.min(18, parseInt(e.target.value, 10) || 0)) }))}
                      className="w-[74px]"
                    />
                    <span className="text-[12px] text-[var(--ink-3)]">to</span>
                    <Input
                      type="number"
                      min={0}
                      max={18}
                      value={q.maxAge ?? ""}
                      placeholder="any"
                      onChange={(e) => patch(q.id, (x) => ({ ...x, maxAge: e.target.value === "" ? undefined : Math.max(0, Math.min(18, parseInt(e.target.value, 10) || 0)) }))}
                      className="w-[74px]"
                    />
                    {(q.minAge !== undefined || q.maxAge !== undefined) && (
                      <Button sm onClick={() => patch(q.id, (x) => ({ ...x, minAge: undefined, maxAge: undefined }))}>
                        Ask about any age
                      </Button>
                    )}
                  </div>
                  <div className="mt-1 text-[10.5px] leading-[1.45] text-[var(--ink-3)]">
                    {q.minAge === undefined && q.maxAge === undefined
                      ? "Asked about every child."
                      : `Asked only about children ${q.minAge !== undefined && q.maxAge !== undefined ? `aged ${q.minAge}–${q.maxAge}` : q.minAge !== undefined ? `aged ${q.minAge} and over` : `aged ${q.maxAge} and under`}. Worked out from their date of birth each time, so a child starts being asked on their birthday — and isn't asked at all until you have one.`}
                  </div>
                </div>

                <div className="mt-3">
                  <FieldLabel>Asked on</FieldLabel>
                  <div className="mb-1.5 flex gap-1.5">
                    <Button sm variant={q.scope === "all" ? "primary" : "default"} onClick={() => patch(q.id, (x) => ({ ...x, scope: "all" }))}>
                      All listings
                    </Button>
                    <Button sm variant={scoped ? "primary" : "default"} onClick={() => patch(q.id, (x) => ({ ...x, scope: scoped ? (x.scope as string[]) : [] }))}>
                      Chosen listings
                    </Button>
                  </div>
                  {scoped && (
                    <div className="flex flex-wrap gap-1.5">
                      {listings.length === 0 && (
                        <span className="text-[12px] text-[var(--ink-3)]">No listings yet — this question won&apos;t be asked anywhere until you pick one.</span>
                      )}
                      {listings.map((l) => {
                        const on = (q.scope as string[]).includes(l.id);
                        return (
                          <button
                            key={l.id}
                            type="button"
                            onClick={() =>
                              patch(q.id, (x) => {
                                const cur = x.scope as string[];
                                return { ...x, scope: on ? cur.filter((z) => z !== l.id) : [...cur, l.id] };
                              })
                            }
                            className="rounded-full border px-2.5 py-1 text-[11.5px] font-semibold"
                            style={on ? { borderColor: "transparent", background: "var(--brand-soft)", color: "var(--brand-ink)" } : { borderColor: "var(--line)", color: "var(--ink-3)" }}
                          >
                            {l.title}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between gap-2 border-t border-dashed border-[var(--line)] pt-2.5">
                  <span className="text-[11px] leading-[1.4] text-[var(--ink-3)]">
                    Hiding keeps every answer families have already given. Deleting throws them away.
                  </span>
                  <Button
                    sm
                    variant="danger"
                    onClick={() => {
                      if (!confirm(`Delete “${q.label || "this question"}”?\n\nEvery answer families have given is deleted with it. Hide it instead if you just want to stop asking.`)) return;
                      onChange(questions.filter((x) => x.id !== q.id));
                      setOpenId(null);
                    }}
                  >
                    Delete
                  </Button>
                </div>

                <div className="mt-2 text-[10.5px] text-[var(--ink-3)]">
                  Stored as <code>answers.{answerKey(q)}</code>
                  {q.replaces && <> · replaces the old fixed <code>{q.replaces}</code> field</>}
                </div>
              </div>
            )}
          </div>
        );
      })}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={add}>＋ Add a question</Button>
        <Button onClick={addToilet}>{hasToilet ? "🚼 Toilet training (added)" : "🚼 Add toilet-training question"}</Button>
      </div>
      {!hasToilet && <p className="mt-1.5 text-[11.5px] text-[var(--ink-3)]">Adds &ldquo;Is your child toilet trained?&rdquo;. Answering <b>no</b> holds the booking for you to accept, and the register shows a nappy tag plus a change log for that child.</p>}
    </div>
  );
}

// ── The screen ─────────────────────────────────────────────────────────────

export function SetupApp() {
  const { settings, questions, loading, save, error } = useSettings();
  const [tmplPreview, setTmplPreview] = useState(false);
  const [poPreview, setPoPreview] = useState(false);
  const portal = ((usePathname().split("/")[1] || "freelancer")) as PortalKey;
  // Deep link support: /setup?tab=refer opens that tab (e.g. from Referrals).
  const sp = useSearchParams();
  const initialTab = sp.get("tab");
  // `from` is set by the page's "Change settings" gear so we can offer a Back
  // link; absent when Setup is reached from the sidebar (so no Back button then).
  const fromView = (sp.get("from") || "").replace(/[^a-z0-9-]/gi, "");
  const FROM_LABELS: Record<string, string> = {
    "admin-registers": "Register", registers: "Register", customers: "Families", children: "Families",
    expenses: "Money out", purchasing: "Money in", invoices: "Invoices", incidents: "Report a concern",
    accidents: "Accidents", ratios: "Ratios & groups", meals: "Meals", medication: "Medication",
    trips: "Trips", calendar: "Calendar", inventory: "Inventory", newsfeed: "Newsfeed", messages: "Messages",
    email: "Emails", compliance: "Compliance", credentials: "Credentials", learning: "Learning",
    referrals: "Refer a friend", listings: "Listings", blocks: "Blocks", bookings: "Bookings",
    finance: "Finance", reconciliation: "Reconciliation", locations: "Locations", staff: "Team",
  };
  const backLabel = fromView ? (FROM_LABELS[fromView] ?? fromView.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase())) : "";
  const VALID_TABS: Tab[] = ["features", "company", "branding", "people", "staff", "announcements", "roles", "reviews", "learning", "meals", "medication", "safeguarding", "registers", "trips", "calendar", "inventory", "groups", "cancel", "defaults", "bookings", "seasons", "vouchers", "marketplace", "refer", "memberships", "notifications", "money"];
  const [tab, setTab] = useState<Tab>(() => (initialTab && (VALID_TABS as string[]).includes(initialTab) ? (initialTab as Tab) : "features"));
  const [listings, setListings] = useState<{ id: string; title: string }[]>([]);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // An age-gated question makes a date of birth compulsory whatever the
  // toggle below says — see dobRequired().
  const dobLock = dobRequired(settings, questions);

  // The scope picker needs the operator's own listings — never the public
  // browse feed, which would offer other providers' listings to scope to.
  useEffect(() => {
    apiGet<{ id: string; title?: string; name?: string }[]>("/api/listings?mine=1")
      .then((rows) => setListings(rows.map((r) => ({ id: r.id, title: r.title || r.name || "Untitled listing" }))))
      .catch(() => setListings([]));
  }, []);

  const cred = useCredentials([]);
  const toggleIn = (arr: string[] | undefined, v: string) => { const a = arr ?? []; return a.includes(v) ? a.filter((x) => x !== v) : [...a, v]; };
  const certPreview = { ...CERT_SAMPLE, provider: settings.providerName || settings.billing?.businessName || CERT_SAMPLE.provider, signName: settings.learning?.certSignatory || CERT_SAMPLE.signName, signRole: settings.learning?.certSignatoryRole || CERT_SAMPLE.signRole, signImg: settings.learning?.certSignature, accent: settings.learning?.certColor, title: settings.learning?.certTitle || undefined, showScore: settings.learning?.certShowScore, showQr: settings.learning?.certShowQr };
  // deep-link: /setup?tab=learning#credtypes opens the tab and scrolls to the section
  useEffect(() => {
    if (typeof window === "undefined") return;
    const h = window.location.hash.slice(1);
    if (h && tab === "learning") { const el = document.getElementById(h); if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 260); }
  }, [tab]);
  const set = <K extends keyof TenantSettings>(key: K, value: TenantSettings[K]) => {
    void save({ settings: { ...settings, [key]: value } }).then(() =>
      setSavedAt(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })),
    );
  };
  const setQuestions = (next: ChildQuestion[]) => {
    void save({ questions: next }).then(() =>
      setSavedAt(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })),
    );
  };

  if (loading)
    return (
      <OperatorPage title="Setup & features" icon="⚙️">
        <span className="text-[var(--ink-3)]">Loading…</span>
      </OperatorPage>
    );

  const TABS: [Tab, string][] = [
    ["notifications", "🔔 Notifications"],
    ["features", "Features"],
    ["company", "Company setup"],
    ["seasons", "Seasons"],
    ["branding", "Branding"],
    ["people", "Child questions"],
    ["staff", "Staff & workforce"],
    ["announcements", "Announcements"],
    ["reviews", "Reviews"],
    ...(portal === "company" ? [["roles", "Roles & permissions"] as [Tab, string]] : []),
    ["learning", "Learning"],
    ["meals", "Meals"],
    ["medication", "Medication"],
    ["safeguarding", "Safeguarding"],
    ["registers", "Register"],
    ["trips", "Trips & visits"],
    ["calendar", "Calendar"],
    ["inventory", "Inventory"],
    ["groups", "Age groups & rooms"],
    ["cancel", "Cancellations & refunds"],
    ["defaults", "New listing defaults"],
    ["bookings", "Payments"],
    ["money", "Money"],
    ["vouchers", "Childcare vouchers"],
    ["marketplace", "Marketplace"],
    ["refer", "Refer a friend"],
    ["memberships", "Memberships"],
  ];

  return (
    <OperatorPage
      title="Setup & features"
      icon="⚙️"
      lede="How your account runs — set once, used everywhere"
      actions={
        <>
          {fromView && (
            <Link href={`/${portal}/${fromView}`} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-[12px] font-extrabold text-[#1d3a8f] shadow-sm transition hover:brightness-95">
              <span className="text-[14px] leading-none">‹</span>Back to {backLabel}
            </Link>
          )}
          <span className="rounded-full bg-white/15 px-3 py-1 text-[11.5px] font-semibold text-white backdrop-blur-sm">
            {error ? <span className="font-bold text-[#ffd5d5]">{error}</span> : savedAt ? `✓ Saved ${savedAt}` : "Changes save as you make them"}
          </span>
        </>
      }
    >
      <HowItWorks
        video="Where each setting shows up: a question added here appearing on the parent's checkout, the child's profile and the register."
        minutes="2 min"
      >
        <p className="mb-2">
          Everything on this page is yours to change and applies across your whole account. There is
          no Save button — each change is stored the moment you make it.
        </p>
        <p>
          Each tab is one job. If a setting isn&apos;t here yet, it&apos;s because it&apos;s still
          fixed in the product — tell us and it moves.
        </p>
      </HowItWorks>

      <TabStrip tabs={TABS} value={tab} onChange={setTab} accent="notifications" />

      {tab === "company" && (
        <Section title="Company setup" lede="Who you are — the name and details your customers and documents show. Bank details and the invoice template live in the Money tab.">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div><FieldLabel>Display name (what customers see)</FieldLabel><Input value={settings.providerName ?? ""} placeholder="Amir Coaching" onChange={(e) => set("providerName", e.target.value)} className="w-full" /></div>
            <div><FieldLabel>Show your name as</FieldLabel><Select value={settings.providerNameMode ?? "business"} onChange={(e) => set("providerNameMode", e.target.value as "person" | "business")} className="w-full"><option value="business">Business name</option><option value="person">My own name</option></Select></div>
            {([
              ["businessName", "Legal / business name", "Little Kickers Ltd"],
              ["email", "Contact email", "hello@yourbiz.co.uk"],
              ["phone", "Phone", "07700 900000"],
              ["address", "Registered address", "12 High St, Townsville, AB1 2CD"],
              ["vatNumber", "VAT number (if any)", "GB123456789"],
              ["companyReg", "Company registration no.", "133950"],
            ] as const).map(([k, label, ph]) => (
              <div key={k}><FieldLabel>{label}</FieldLabel><Input value={settings.billing?.[k] ?? ""} placeholder={ph} onChange={(e) => void save({ settings: { ...settings, billing: { ...(settings.billing ?? {}), [k]: e.target.value } } })} className="w-full" /></div>
            ))}
          </div>
        </Section>
      )}

      {tab === "branding" && (
        <Section title="Branding" lede="Your logo and accent colour on customer-facing pages, emails and documents.">
          <Row label="Logo" hint="PNG, JPG, SVG, WebP, GIF, BMP or AVIF — up to 1MB. We resize it automatically. Shown on your customer pages, emails and PDFs.">
            <div>
            <div className="flex items-center gap-2">
              {settings.billing?.logoUrl && <img src={settings.billing.logoUrl} alt="logo" className="h-9 max-w-[120px] rounded border border-[var(--line)] object-contain" />}
              <label className="cursor-pointer rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-bold text-[#1d3a8f]">⬆ Upload<input type="file" accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp,image/gif,image/bmp,image/avif,image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { const dataUrl = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error("Couldn’t read that file")); r.readAsDataURL(f); }); const payload = dataUrl.startsWith("data:image/") ? await compressLogo(dataUrl) : dataUrl; const { url } = await api<{ url: string }>("/api/uploads", { method: "POST", body: JSON.stringify({ dataUrl: payload }) }); await save({ settings: { ...settings, billing: { ...(settings.billing ?? {}), logoUrl: url } } }); } catch (err) { alert(err instanceof Error ? `Logo upload failed: ${err.message}` : "Couldn’t upload that logo — most image files work (PNG, JPG, SVG, WebP, GIF…). iPhone HEIC photos: export as JPG first."); } e.target.value = ""; }} /></label>
              {settings.billing?.logoUrl && <button type="button" onClick={() => void save({ settings: { ...settings, billing: { ...(settings.billing ?? {}), logoUrl: "" } } })} className="text-[11.5px] font-bold text-[var(--ink-3)]">Remove</button>}
            </div>
            <div className="mt-1.5 text-[11px] text-[var(--ink-3)]">PNG, JPG, SVG, WebP, GIF, BMP or AVIF — up to 1MB, resized automatically. (iPhone HEIC: export as JPG first.)</div>
            </div>
          </Row>
          <Row label="Accent colour" hint="Tints buttons and highlights on your customer-facing pages.">
            <div className="flex items-center gap-2">
              {["#2f6bd8", "#0d9488", "#16a34a", "#ea580c", "#dc2626", "#db2777", "#7c3aed"].map((c) => <button key={c} type="button" onClick={() => set("brandColor", c)} title={c} className="h-6 w-6 rounded-full" style={{ background: c, boxShadow: (settings.brandColor ?? "#2f6bd8") === c ? "0 0 0 2px #fff, 0 0 0 4px #111" : "none" }} />)}
              <input type="color" value={settings.brandColor ?? "#2f6bd8"} onChange={(e) => set("brandColor", e.target.value)} className="h-7 w-8 cursor-pointer rounded border border-[var(--line)]" title="Custom colour" />
            </div>
          </Row>
        </Section>
      )}

      {tab === "staff" && (
        <Section title="Staff & workforce" lede="Team policy — the checks you require. The checks are enforced by the backend (handed over).">
          {portal === "company" && (
            <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-[#f3d98a] bg-[#fdf6e3] px-4 py-3">
              <span className="text-[12.5px] leading-relaxed text-[#7a5a12]">
                <b>Looking for roles &amp; who-can-see-what?</b> Name your roles and set View / Edit per area — Dashboard, Listings, Bookings, Finances and the rest — in the <b>Roles &amp; permissions</b> tab.
              </span>
              <button type="button" onClick={() => setTab("roles")} className="ml-auto flex-none rounded-full bg-[#1d3a8f] px-4 py-1.5 text-[12.5px] font-extrabold text-white hover:bg-[#16306e]">Open Roles &amp; permissions →</button>
            </div>
          )}
          <Row label="Who assigns staff to groups" hint="On: only site managers & leads can assign staff to age groups / rooms. Off: anyone on the team can.">
            <Toggle on={settings.staff?.assignByLeads ?? false} onChange={(v) => set("staff", { ...settings.staff, assignByLeads: v })} labels={["Leads only", "Anyone"]} />
          </Row>
          <Row label="Require a valid DBS" hint="A staff member can’t be rostered until a valid DBS is on file." note="Enforcement: backend">
            <Toggle on={settings.staff?.requireDBS ?? true} onChange={(v) => set("staff", { ...settings.staff, requireDBS: v })} labels={["Yes", "No"]} />
          </Row>
          <Row label="Require key certificates in date" hint="First aid, safeguarding and similar must be current." note="Enforcement: backend">
            <Toggle on={settings.staff?.requireCompliance ?? true} onChange={(v) => set("staff", { ...settings.staff, requireCompliance: v })} labels={["Yes", "No"]} />
          </Row>
          <Row label="Default staff : child ratio" hint="The starting target on the Ratios board (1 adult to N children).">
            <Input type="number" min={1} value={settings.staff?.defaultRatioTarget ?? 8} onChange={(e) => set("staff", { ...settings.staff, defaultRatioTarget: Number(e.target.value) || 1 })} className="w-24" />
          </Row>
          <div className="mt-3"><FieldLabel>Note added to staff invite emails</FieldLabel><Input value={settings.staff?.inviteMessage ?? ""} placeholder="Looking forward to having you on the team!" onChange={(e) => set("staff", { ...settings.staff, inviteMessage: e.target.value })} className="w-full" /></div>
        </Section>
      )}

      {tab === "announcements" && (
        <Section title="Announcements" lede="The internal staff notice board and the dashboard alert card. Delivery (in-app bell / push) and the read-acknowledgement audit are handled by the backend (handed over).">
          <Row label="Staff announcement board" hint="Turn the notice board and the staff-dashboard alert card on or off for your whole team.">
            <Toggle on={settings.announcements?.enabled ?? true} onChange={(v) => set("announcements", { ...settings.announcements, enabled: v })} labels={["On", "Off"]} />
          </Row>
          <Row label="Let site leads post" hint="On: managers & leads can post to their team. Off: only head office can post.">
            <Toggle on={settings.announcements?.leadsCanPost ?? true} onChange={(v) => set("announcements", { ...settings.announcements, leadsCanPost: v })} labels={["Leads too", "HO only"]} />
          </Row>
          <Row label="Require staff to acknowledge" hint="Staff must confirm they’ve read each notice — you get a read / acknowledged audit." note="Audit: backend">
            <Toggle on={settings.announcements?.requireAck ?? false} onChange={(v) => set("announcements", { ...settings.announcements, requireAck: v })} labels={["Yes", "No"]} />
          </Row>
          <Row label="Keep on the dashboard for" hint="How long a new notice keeps showing on the staff dashboard alert card.">
            <div className="flex items-center gap-2"><Input type="number" min={1} max={14} value={settings.announcements?.dashboardDays ?? 1} onChange={(e) => set("announcements", { ...settings.announcements, dashboardDays: Math.min(14, Math.max(1, Number(e.target.value) || 1)) })} className="w-20" /><span className="text-[12.5px] text-[var(--ink-3)]">day(s)</span></div>
          </Row>
          <Row label="Default audience" hint="What “Who gets it” starts on when you compose a new notice.">
            <Toggle on={(settings.announcements?.defaultAudience ?? "all") === "all"} onChange={(v) => set("announcements", { ...settings.announcements, defaultAudience: v ? "all" : "listing" })} labels={["All staff", "Per listing"]} />
          </Row>
          <Row label="Start new notices as Important" hint="New notices begin with the red Important flag ticked — you can still turn it off per notice.">
            <Toggle on={settings.announcements?.defaultImportant ?? false} onChange={(v) => set("announcements", { ...settings.announcements, defaultImportant: v })} labels={["Yes", "No"]} />
          </Row>
        </Section>
      )}

      {tab === "reviews" && (() => {
        const rv = settings.reviews ?? {};
        // Default the selection from any config already present.
        const selected = rv.sources ?? ([...(rv.googlePlaceId || rv.googleReviewUrl ? ["google"] : []), ...(rv.trustpilotBusinessUnitId ? ["trustpilot"] : [])] as ("google" | "trustpilot")[]);
        const has = (s: "google" | "trustpilot") => selected.includes(s);
        const toggleSrc = (s: "google" | "trustpilot") => set("reviews", { ...rv, sources: has(s) ? selected.filter((x) => x !== s) : [...selected, s] });
        return (
        <Section title="Reviews" lede="Blend your in-house feedback with the review sites you already use. Compliance is built in — every customer is invited to review on Google, never only the happy ones.">
          <div className="mb-1 text-[12.5px] font-extrabold text-[var(--ink)]">How do you want to collect reviews?</div>
          <p className="mb-2.5 text-[11.5px] text-[var(--ink-3)]">Both are fully compliant. Pick the one that suits how you like to run things — you can change it any time.</p>
          <div className="mb-4 grid gap-2.5 sm:grid-cols-2">
            {([
              { k: "inhouse", icon: "🛡️", title: "In-house first", tag: "Recommended", benefits: ["Catch a problem privately and fix it before it's public", "Captures feedback from every parent, even the quiet ones", "No accounts to set up — works today", "Still invites happy parents to Google/Trustpilot afterwards"] },
              { k: "external", icon: "🌟", title: "Send straight to Google / Trustpilot", tag: "Most public reviews", benefits: ["More public reviews → better search ranking & trust", "No double entry — one review, on the big sites", "Trustpilot reviews link back to the booking automatically", "Note: unhappy reviews go public too (no gating allowed)"] },
            ] as { k: "inhouse" | "external"; icon: string; title: string; tag: string; benefits: string[] }[]).map((o) => {
              const on = (rv.captureMode ?? "inhouse") === o.k;
              return (
                <button key={o.k} type="button" onClick={() => set("reviews", { ...rv, captureMode: o.k })} className={"rounded-xl border-2 p-3.5 text-left transition " + (on ? "border-[#1d3a8f] bg-[#f5f8ff]" : "border-[var(--line)] bg-white hover:border-[#c9d6f5]")}>
                  <div className="flex items-center gap-2">
                    <span className="text-[18px]">{o.icon}</span>
                    <span className="text-[13.5px] font-extrabold text-[var(--ink)]">{o.title}</span>
                    <span className={"ml-auto rounded-full px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wide " + (on ? "bg-[#1d3a8f] text-white" : "bg-[var(--panel)] text-[var(--ink-3)]")}>{on ? "Selected" : o.tag}</span>
                  </div>
                  <ul className="mt-2 flex flex-col gap-1">
                    {o.benefits.map((b) => <li key={b} className="flex gap-1.5 text-[11.5px] leading-[1.4] text-[var(--ink-2)]"><span className="flex-none text-[#0f7a43]">✓</span>{b}</li>)}
                  </ul>
                </button>
              );
            })}
          </div>

          <div className="mb-1 text-[12.5px] font-extrabold text-[var(--ink)]">Which review sites do you use?</div>
          <p className="mb-2.5 text-[11.5px] text-[var(--ink-3)]">In-house feedback is always on. Pick the external sites you collect reviews on — we&rsquo;ll only ask for what those need.</p>
          <div className="mb-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eef4fd] px-3 py-1.5 text-[12.5px] font-bold text-[#1d3a8f]"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "#1d3a8f" }} />In-house · always on</span>
            {([["google", "Google", "#ea4335"], ["trustpilot", "Trustpilot", "#00b67a"]] as [("google" | "trustpilot"), string, string][]).map(([k, label, col]) => (
              <button key={k} type="button" onClick={() => toggleSrc(k)} className={"inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-bold transition " + (has(k) ? "border-transparent text-white" : "border-[var(--line)] bg-white text-[var(--ink-2)] hover:bg-[var(--panel)]")} style={has(k) ? { background: col } : undefined}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: has(k) ? "#fff" : col }} />{has(k) ? `✓ ${label}` : label}
              </button>
            ))}
          </div>

          {has("google") && (<>
            <div className="mb-1 mt-1 text-[11px] font-extrabold uppercase tracking-wide text-[#ea4335]">Google</div>
            <Row label="Google review link or Place ID" hint="Paste your Google 'Get more reviews' link, or your Place ID. Powers the live Google rating on your Browse page and the one-tap 'review us on Google' button after feedback. No API setup needed.">
              <Input value={rv.googleReviewUrl || rv.googlePlaceId || ""} placeholder="https://g.page/r/… or ChIJ…" onChange={(e) => { const v = e.target.value.trim(); const isUrl = /^https?:\/\//.test(v); set("reviews", { ...rv, googleReviewUrl: isUrl ? v : "", googlePlaceId: isUrl ? (rv.googlePlaceId ?? "") : v }); }} className="w-full" />
            </Row>
            <Row label="Show my Google rating publicly" hint="Display your live Google star rating on your Browse page and blend it into your overall score.">
              <Toggle on={rv.showGoogleRating ?? true} onChange={(v) => set("reviews", { ...rv, showGoogleRating: v })} labels={["On", "Off"]} />
            </Row>
            <Row label="Invite customers to review on Google" hint="After a parent leaves in-house feedback, show a 'review us on Google' button — to EVERYONE, whatever they rated (this is what keeps you compliant with Google & the FTC).">
              <Toggle on={rv.inviteToGoogle ?? true} onChange={(v) => set("reviews", { ...rv, inviteToGoogle: v })} labels={["On", "Off"]} />
            </Row>
            <div className="mb-4 rounded-lg border border-[#cde0f7] bg-[#eef5ff] px-3.5 py-2.5 text-[11.5px] leading-relaxed text-[#1d3a8f]">
              Want to <b>pull every Google review + reply from ActivityOS</b>? That needs a one-time <b>Connect Google Business Profile</b> from the <b>Reviews</b> page (enabled once the platform link is live). The link above already shows your rating and invites reviews without it.
            </div>
          </>)}

          {has("trustpilot") && (<>
            <div className="mb-1 mt-1 text-[11px] font-extrabold uppercase tracking-wide text-[#00b67a]">Trustpilot</div>
            <Row label="Trustpilot Business Unit ID" hint="Paste your Business Unit ID to pull your Trustpilot reviews into your blended score." note="Needs platform key">
              <Input value={rv.trustpilotBusinessUnitId ?? ""} placeholder="e.g. 4b… " onChange={(e) => set("reviews", { ...rv, trustpilotBusinessUnitId: e.target.value.trim() })} className="w-full" />
            </Row>
          </>)}

          <div className="mb-1 mt-1 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Your website</div>
          <Row label="Public reviews widget & rich-snippet stars" hint="Expose a public feed of your reviews for embedding on your own website, plus AggregateRating data for Google star snippets." note="Backend">
            <Toggle on={rv.publicWidget ?? false} onChange={(v) => set("reviews", { ...rv, publicWidget: v })} labels={["On", "Off"]} />
          </Row>
        </Section>
        );
      })()}

      {tab === "roles" && (
        <Section title="Roles & permissions" lede="Define the roles in your organisation and what each can see or change. Assign a role to each person when you invite them (coming next); Owner always has full access.">
          <RolesPermissions roles={settings.roles ?? []} onChange={(roles) => set("roles", roles)} />
        </Section>
      )}

      {tab === "learning" && (
        <Section title="Learning" lede="Staff training records and children’s learning.">
          <Row label="Keep staff training records" hint="Track certificates and renewals for your team.">
            <Toggle on={settings.learning?.trackTraining ?? true} onChange={(v) => set("learning", { ...settings.learning, trackTraining: v })} labels={["On", "Off"]} />
          </Row>
          <Row label="Learning observations / journeys" hint="Log observations against children’s development." note="Needs backend">
            <Toggle on={settings.learning?.observations ?? false} onChange={(v) => set("learning", { ...settings.learning, observations: v })} labels={["On", "Off"]} />
          </Row>
          <div className="mt-3"><FieldLabel>Curriculum framework</FieldLabel><Input value={settings.learning?.framework ?? ""} placeholder="EYFS" onChange={(e) => set("learning", { ...settings.learning, framework: e.target.value })} className="w-full sm:w-64" /></div>

          <div className="mt-5 mb-1 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Courses &amp; certificates</div>
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <div><FieldLabel>Default quiz pass mark (%)</FieldLabel><Input type="number" min={1} max={100} value={settings.learning?.passMark ?? 80} onChange={(e) => set("learning", { ...settings.learning, passMark: Number(e.target.value) })} className="w-full sm:w-40" /></div>
            <div><FieldLabel>Default renewal (months, 0 = never)</FieldLabel><Input type="number" min={0} value={settings.learning?.renewMonths ?? 12} onChange={(e) => set("learning", { ...settings.learning, renewMonths: Number(e.target.value) })} className="w-full sm:w-40" /></div>
          </div>
          <Row label="Issue certificates automatically" hint="Give staff a certificate the moment they pass a course.">
            <Toggle on={settings.learning?.autoCert ?? true} onChange={(v) => set("learning", { ...settings.learning, autoCert: v })} labels={["On", "Off"]} />
          </Row>
          <Row label="Show your logo on certificates" hint="Brand the printable/PDF certificate with your logo.">
            <Toggle on={settings.learning?.certLogo ?? true} onChange={(v) => set("learning", { ...settings.learning, certLogo: v })} labels={["On", "Off"]} />
          </Row>
          <Row label="Require staff to confirm policies" hint="Required policies must be read and confirmed, with a dated record.">
            <Toggle on={settings.learning?.requirePolicyConfirm ?? true} onChange={(v) => set("learning", { ...settings.learning, requirePolicyConfirm: v })} labels={["On", "Off"]} />
          </Row>
          <Row label="Staff can self-enrol on optional courses" hint="Let staff pick up optional (non-required) courses themselves.">
            <Toggle on={settings.learning?.selfEnrol ?? false} onChange={(v) => set("learning", { ...settings.learning, selfEnrol: v })} labels={["On", "Off"]} />
          </Row>
          <div className="mt-5 mb-1 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Certificate design</div>
          <p className="mb-2.5 text-[12px] text-[var(--ink-3)]">Pick the certificate staff receive when they pass a course. It auto-fills their name, the course, the score, the completion date and — if the course renews — the expiry date.</p>
          <div className="mb-3 flex flex-wrap gap-2.5">
            {CERT_TEMPLATES.map((t) => { const on = (settings.learning?.certTemplate ?? "gold") === t.id; return (
              <button key={t.id} type="button" onClick={() => set("learning", { ...settings.learning, certTemplate: t.id })} className={"w-[196px] overflow-hidden rounded-xl border text-left transition-all " + (on ? "border-transparent ring-2 ring-[#1d3a8f] ring-offset-1" : "border-[var(--line)] hover:-translate-y-0.5 hover:shadow-md")}>
                <div className="relative h-[139px] w-full overflow-hidden bg-[#eef1f6]"><iframe title={t.name} tabIndex={-1} scrolling="no" srcDoc={certificateDoc(certPreview, t.id, false)} className="pointer-events-none absolute left-0 top-0 origin-top-left" style={{ width: 1000, height: 710, transform: "scale(0.196)" }} /></div>
                <div className="flex items-center gap-1.5 px-2.5 py-1.5"><span className="truncate text-[11.5px] font-bold text-[var(--ink)]">{t.name}</span>{on && <span className="ml-auto text-[11px] font-extrabold text-[#1d3a8f]">✓ Chosen</span>}</div>
              </button>
            ); })}
          </div>
          <div className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Accent colour</div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {CERT_ACCENTS.map(([name, hex]) => { const on = settings.learning?.certColor === hex; return (
              <button key={hex} type="button" title={name} aria-label={name} onClick={() => set("learning", { ...settings.learning, certColor: hex })} className={"h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 " + (on ? "border-[var(--ink)]" : "border-white shadow-[0_0_0_1px_var(--line)]")} style={{ background: hex }} />
            ); })}
            <button type="button" onClick={() => set("learning", { ...settings.learning, certColor: undefined })} className={"rounded-full border px-2.5 py-1 text-[11px] font-bold " + (settings.learning?.certColor ? "border-[var(--line)] text-[var(--ink-2)] hover:border-[#1d3a8f]" : "border-[#1d3a8f] text-[#1d3a8f]")}>Template default</button>
          </div>
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <div><FieldLabel>Heading text</FieldLabel><Input value={settings.learning?.certTitle ?? ""} placeholder="Certificate of Achievement" onChange={(e) => set("learning", { ...settings.learning, certTitle: e.target.value })} className="w-full" /></div>
            <div className="flex items-end gap-5 pb-1.5">
              <label className="flex items-center gap-2 text-[12.5px] font-semibold text-[var(--ink-2)]"><input type="checkbox" checked={settings.learning?.certShowScore !== false} onChange={(e) => set("learning", { ...settings.learning, certShowScore: e.target.checked })} /> Show score</label>
              <label className="flex items-center gap-2 text-[12.5px] font-semibold text-[var(--ink-2)]"><input type="checkbox" checked={settings.learning?.certShowQr !== false} onChange={(e) => set("learning", { ...settings.learning, certShowQr: e.target.checked })} /> Show QR</label>
            </div>
          </div>
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <div><FieldLabel>Signatory name</FieldLabel><Input value={settings.learning?.certSignatory ?? ""} placeholder="e.g. Alex Morgan" onChange={(e) => set("learning", { ...settings.learning, certSignatory: e.target.value })} className="w-full" /></div>
            <div><FieldLabel>Signatory role</FieldLabel><Input value={settings.learning?.certSignatoryRole ?? ""} placeholder="e.g. Training Manager" onChange={(e) => set("learning", { ...settings.learning, certSignatoryRole: e.target.value })} className="w-full" /></div>
          </div>
          <div className="mb-3">
            <FieldLabel>Signature image (optional)</FieldLabel>
            <div className="flex flex-wrap items-center gap-2">
              <label className="cursor-pointer rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)] hover:border-[#1d3a8f]">⬆ Upload signature<input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => set("learning", { ...settings.learning, certSignature: String(r.result) }); r.readAsDataURL(f); }} /></label>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {settings.learning?.certSignature && <img src={settings.learning.certSignature} alt="Signature" className="h-9 w-auto rounded border border-[var(--line)] bg-white object-contain px-1" />}
              {settings.learning?.certSignature && <button type="button" onClick={() => set("learning", { ...settings.learning, certSignature: undefined })} className="text-[12px] font-semibold text-[var(--ink-3)] hover:text-[#c0392b]">Remove</button>}
            </div>
          </div>
          <Button variant="primary" onClick={() => openCertificate(certPreview, settings.learning?.certTemplate)}>👁 Preview full certificate</Button>

          <div id="credtypes" className="mt-5 mb-1 scroll-mt-28 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Staff credential types</div>
          <p className="mb-2.5 text-[12px] text-[var(--ink-3)]">Certificates staff upload in their own area and you verify (DBS, First Aid, etc.). Add your own or delete any you don’t use.</p>
          <div className="grid gap-2">
            {cred.types.map((t) => (
              <div key={t.id} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <Input value={t.name} onChange={(e) => cred.upsertType({ ...t, name: e.target.value })} className="w-[190px] font-semibold" />
                  {t.dbs && <span className="rounded-full bg-[#eef4fd] px-2 py-0.5 text-[10px] font-bold text-[#1d3a8f]" title="Captures DBS level + Update Service number">DBS extras</span>}
                  <label className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--ink-2)]"><input type="checkbox" checked={t.required} onChange={(e) => cred.upsertType({ ...t, required: e.target.checked })} /> Required</label>
                  <label className="flex items-center gap-1.5 text-[12px] text-[var(--ink-2)]">Renew every <Input type="number" min={0} value={t.renewMonths} onChange={(e) => cred.upsertType({ ...t, renewMonths: Number(e.target.value) })} className="w-[62px]" /> months <span className="text-[var(--ink-3)]">(0 = never)</span></label>
                  <button type="button" title="Delete credential type" onClick={() => cred.deleteType(t.id)} className="ml-auto text-[13px] text-[var(--ink-3)] hover:text-[#c0392b]">🗑</button>
                </div>
                {t.required && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-[var(--line-2,#eef2f8)] pt-2">
                    <span className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Required for</span>
                    <Select value={t.applyKind ?? "all"} onChange={(e) => cred.upsertType({ ...t, applyKind: e.target.value as "all" | "roles" | "staff" })} className="max-w-[170px]"><option value="all">All staff</option><option value="roles">Role or job title</option><option value="staff">Named people</option></Select>
                    {(t.applyKind ?? "all") === "roles" && (() => {
                      const access = (settings.roles ?? []).map((r) => r.name).filter(Boolean);
                      const titles = (settings.staffRoles ?? []).filter(Boolean);
                      if (!access.length && !titles.length) return <span className="text-[11px] text-[var(--ink-3)]">Add access roles in Setup → Roles &amp; permissions, or job titles in Setup → Staff roles first.</span>;
                      const chip = (r: string) => { const on = (t.applyRoles ?? []).includes(r); return <button key={r} type="button" onClick={() => cred.upsertType({ ...t, applyRoles: toggleIn(t.applyRoles, r) })} className={"rounded-full border px-2.5 py-0.5 text-[11px] font-bold transition-colors " + (on ? "border-transparent bg-[#111634] text-white" : "border-[var(--line)] text-[var(--ink-2)] hover:border-[var(--ink-3)]")}>{r}</button>; };
                      return (
                        <div className="w-full space-y-1.5">
                          {access.length > 0 && <div className="flex flex-wrap items-center gap-1.5"><span className="mr-0.5 inline-flex items-center rounded bg-[#eef1f6] px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-[#5b6577]" title="Access role / permission — what the person can do in ActivityOS">🔑 Access role</span>{access.map(chip)}</div>}
                          {titles.length > 0 && <div className="flex flex-wrap items-center gap-1.5"><span className="mr-0.5 inline-flex items-center rounded bg-[#eaf1ff] px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-[#1d54c4]" title="Job title — the person's role on the ground">🧑‍🏫 Job title</span>{titles.map(chip)}</div>}
                        </div>
                      );
                    })()}
                    {(t.applyKind ?? "all") === "staff" && DEMO_STAFF.map((s) => { const on = (t.applyStaff ?? []).includes(s.name); return <button key={s.name} type="button" onClick={() => cred.upsertType({ ...t, applyStaff: toggleIn(t.applyStaff, s.name) })} className={"rounded-full border px-2.5 py-0.5 text-[11px] font-bold transition-colors " + (on ? "border-transparent bg-[#111634] text-white" : "border-[var(--line)] text-[var(--ink-2)] hover:border-[var(--ink-3)]")}>{s.name}</button>; })}
                  </div>
                )}
              </div>
            ))}
          </div>
          <Button className="mt-2" onClick={() => cred.upsertType({ id: "ct" + Date.now().toString(36), name: "New credential", required: false, renewMonths: 12, needsFile: true })}>+ Add credential type</Button>

          <p className="mt-4 rounded-lg bg-[var(--panel)] px-3 py-2 text-[11.5px] text-[var(--ink-3)]">🔔 Reminder emails (course due, overdue chase, renewal due, unread policy, weekly manager digest) are set in the <b className="text-[var(--ink-2)]">Learning Centre → Completion → Reminders</b>.</p>
        </Section>
      )}

      {tab === "meals" && (
        <Section title="Meals" lede="Meal ordering for parents. The menu itself is managed in the Meals area.">
          <Row label="Parents can pre-order meals" hint="Off: hide meal ordering from parents entirely.">
            <Toggle on={settings.meals?.ordering ?? true} onChange={(v) => set("meals", { ...settings.meals, ordering: v })} labels={["On", "Off"]} />
          </Row>
          <Row label="Show allergens on the menu" hint="Display allergen info against each meal.">
            <Toggle on={settings.meals?.showAllergens ?? true} onChange={(v) => set("meals", { ...settings.meals, showAllergens: v })} labels={["Yes", "No"]} />
          </Row>
          <Row label="Order cut-off" hint="How many hours before a session that meal ordering closes.">
            <Input type="number" min={0} value={settings.meals?.orderCutoffHours ?? 18} onChange={(e) => set("meals", { ...settings.meals, orderCutoffHours: Number(e.target.value) || 0 })} className="w-24" />
          </Row>
          <div className="mt-3"><FieldLabel>Note shown on the meals page</FieldLabel><Input value={settings.meals?.menuNote ?? ""} placeholder="Orders close at 6pm the day before." onChange={(e) => set("meals", { ...settings.meals, menuNote: e.target.value })} className="w-full" /></div>
        </Section>
      )}

      {tab === "medication" && (
        <Section
          title="Medication"
          lede="How medicines are recorded on the Medication page. Written parental consent is always required before a dose; these set what happens around each administration."
        >
          <Row label="Tell the parent when a dose is given" hint="Notifies the parent in their customer area each time a dose is logged.">
            <Toggle on={settings.medication?.informParentGiven ?? true} onChange={(v) => set("medication", { ...settings.medication, informParentGiven: v })} labels={["Yes", "No"]} />
          </Row>
          <Row label="Tell the parent if a dose is missed or refused" hint="Also notify when a dose is recorded as NOT given — safeguarding good practice.">
            <Toggle on={settings.medication?.informParentMissed ?? true} onChange={(v) => set("medication", { ...settings.medication, informParentMissed: v })} labels={["Yes", "No"]} />
          </Row>
          <Row label="Notify me when a parent adds a note" hint="Email + a bell here whenever a parent adds or edits a note on their child's medication.">
            <Toggle on={settings.medication?.notifyParentNote ?? true} onChange={(v) => set("medication", { ...settings.medication, notifyParentNote: v })} labels={["Yes", "No"]} />
          </Row>
          <Row label="Notify me when a parent authorises a medication" hint="Email + a bell here when a parent adds a new medication themselves — so it's not missed.">
            <Toggle on={settings.medication?.notifyParentAuthorise ?? true} onChange={(v) => set("medication", { ...settings.medication, notifyParentAuthorise: v })} labels={["Yes", "No"]} />
          </Row>
          <Row label="Remind staff when a dose is due" hint="If a medicine has a set time, ring a bell here when that time comes on a day it's due.">
            <Toggle on={settings.medication?.remindWhenDue ?? true} onChange={(v) => set("medication", { ...settings.medication, remindWhenDue: v })} labels={["Yes", "No"]} />
          </Row>
          <Row label="Require a witness on each dose" hint="A second person must be named when recording a dose — turns off one-tap logging so every dose goes through the full form.">
            <Toggle on={settings.medication?.requireWitness ?? false} onChange={(v) => set("medication", { ...settings.medication, requireWitness: v })} labels={["Yes", "No"]} />
          </Row>
          {portal !== "freelancer" && (
            <Row label="Only leads can record doses" hint="Restrict recording to leads/managers rather than all staff.">
              <Toggle on={settings.medication?.leadsOnly ?? false} onChange={(v) => set("medication", { ...settings.medication, leadsOnly: v })} labels={["Yes", "No"]} />
            </Row>
          )}
        </Section>
      )}

      {tab === "safeguarding" && (
        <Section
          title="Safeguarding"
          lede="Accidents and incidents. How parents are kept informed when something is logged for their child."
        >
          <Row label="Notify the parent when an accident is logged" hint="Email + a bell in their area, with a timestamp, each time an accident is recorded for their child.">
            <Toggle on={settings.safeguarding?.notifyParentAccident ?? true} onChange={(v) => set("safeguarding", { ...settings.safeguarding, notifyParentAccident: v })} labels={["Yes", "No"]} />
          </Row>
          <Row label="Notify the parent for incidents too" hint="Incidents are often internal (behaviour, near-misses) — leave off to keep them staff-only, or on to share them.">
            <Toggle on={settings.safeguarding?.notifyParentIncident ?? false} onChange={(v) => set("safeguarding", { ...settings.safeguarding, notifyParentIncident: v })} labels={["Yes", "No"]} />
          </Row>
          <Row label="Tell staff when a parent acknowledges" hint="Parents can confirm they've seen a logged accident. When they do, email + ring the bell for your staff so you know it landed. Turn off if you don't need the confirmation.">
            <Toggle on={settings.safeguarding?.notifyStaffAcknowledged ?? true} onChange={(v) => set("safeguarding", { ...settings.safeguarding, notifyStaffAcknowledged: v })} labels={["Yes", "No"]} />
          </Row>
          <Row label="Require parents to acknowledge" hint="On: un-acknowledged accidents show a persistent reminder in the parent's area until they confirm (nothing is blocked). Off: acknowledging is optional.">
            <Toggle on={settings.safeguarding?.requireAcknowledgement ?? false} onChange={(v) => set("safeguarding", { ...settings.safeguarding, requireAcknowledgement: v })} labels={["Yes", "No"]} />
          </Row>

          <div className="mt-5 mb-2 text-[13px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Designated Safeguarding Lead (DSL)</div>
          <p className="mb-2.5 -mt-1 text-[12px] text-[var(--ink-3)]">As a sole provider you are the DSL — you record a concern and decide the external action yourself. Your name appears on records and the PDF.</p>
          <Row label="Your name (the DSL)" hint="Shown on records and exports as the safeguarding lead.">
            <Input value={settings.safeguarding?.dslName ?? ""} onChange={(e) => set("safeguarding", { ...settings.safeguarding, dslName: e.target.value })} placeholder="e.g. Sam Taylor" className="w-full" />
          </Row>
          <Row label="Role title" hint="What you call the role (e.g. DSL, Safeguarding Lead, Welfare Officer).">
            <Input value={settings.safeguarding?.dslTitle ?? "Designated Safeguarding Lead (DSL)"} onChange={(e) => set("safeguarding", { ...settings.safeguarding, dslTitle: e.target.value })} className="w-full" />
          </Row>

          <div className="mt-5 mb-2 text-[13px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Your local safeguarding contacts</div>
          <p className="mb-2.5 -mt-1 text-[12px] text-[var(--ink-3)]">The agencies you actually report to. These show on the concern form (you pick which council applies) and the PDF, ready to call.</p>
          {(() => {
            const c = settings.safeguarding?.contacts ?? {};
            const setC = (patch: Partial<NonNullable<TenantSettings["safeguarding"]>["contacts"]>) => set("safeguarding", { ...settings.safeguarding, contacts: { ...c, ...patch } });
            const auths = c.authorities ?? [];
            const setAuths = (next: NonNullable<typeof auths>) => setC({ authorities: next });
            const extra = c.extra ?? [];
            return (
              <>
                <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">If a child is in immediate danger</div>
                <Row label="Police"><Input value={c.policePhone ?? "999 (emergency) / 101"} onChange={(e) => setC({ policePhone: e.target.value })} className="w-full" /></Row>
                <Row label="NSPCC helpline"><Input value={c.nspccPhone ?? "0808 800 5000"} onChange={(e) => setC({ nspccPhone: e.target.value })} className="w-full" /></Row>

                <div className="mt-4 mb-1 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">Local authorities you work in</div>
                <p className="mb-2 text-[11.5px] text-[var(--ink-3)]">Add each council whose area you run in. When you log a concern you pick the authority, and its LADO &amp; social-care numbers appear.</p>
                <div className="flex flex-col gap-2.5">
                  {auths.map((a, i) => (
                    <div key={a.id} className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-2.5">
                      <div className="mb-1.5 flex items-center gap-1.5">
                        <Input value={a.name} onChange={(e) => setAuths(auths.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="Council name — e.g. Milton Keynes Council" className="flex-1 font-bold" />
                        <button type="button" aria-label="Remove authority" onClick={() => setAuths(auths.filter((_, j) => j !== i))} className="px-1.5 text-[var(--ink-3)] hover:text-[var(--red,#e21d27)]">✕</button>
                      </div>
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        <Input value={a.ladoName ?? ""} onChange={(e) => setAuths(auths.map((x, j) => (j === i ? { ...x, ladoName: e.target.value } : x)))} placeholder="LADO name" />
                        <Input value={a.ladoPhone ?? ""} onChange={(e) => setAuths(auths.map((x, j) => (j === i ? { ...x, ladoPhone: e.target.value } : x)))} placeholder="LADO phone" />
                        <Input value={a.socialCarePhone ?? ""} onChange={(e) => setAuths(auths.map((x, j) => (j === i ? { ...x, socialCarePhone: e.target.value } : x)))} placeholder="Children's social care (MASH) phone" />
                        <Input value={a.outOfHoursPhone ?? ""} onChange={(e) => setAuths(auths.map((x, j) => (j === i ? { ...x, outOfHoursPhone: e.target.value } : x)))} placeholder="Out-of-hours / EDT phone" />
                      </div>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => setAuths([...auths, { id: `la_${new Date().toISOString()}`, name: "" }])} className="mt-1.5 rounded-full border border-[var(--line)] px-3 py-1 text-[12px] font-bold text-[#1d3a8f]">＋ Add a local authority</button>

                <div className="mt-4">
                  <FieldLabel>More contacts</FieldLabel>
                  <div className="flex flex-col gap-1.5">
                    {extra.map((x, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-1.5">
                        <Input value={x.label} onChange={(e) => setC({ extra: extra.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)) })} placeholder="Label — e.g. Diocese safeguarding" className="min-w-[180px] flex-1" />
                        <Input value={x.phone} onChange={(e) => setC({ extra: extra.map((y, j) => (j === i ? { ...y, phone: e.target.value } : y)) })} placeholder="Phone" className="w-40" />
                        <button type="button" aria-label="Remove contact" onClick={() => setC({ extra: extra.filter((_, j) => j !== i) })} className="px-1.5 text-[var(--ink-3)] hover:text-[var(--red,#e21d27)]">✕</button>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => setC({ extra: [...extra, { label: "", phone: "" }] })} className="mt-1.5 rounded-full border border-[var(--line)] px-3 py-1 text-[12px] font-bold text-[#1d3a8f]">＋ Add a contact</button>
                </div>
              </>
            );
          })()}

          <div className="mt-5 mb-2 text-[13px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Concern categories</div>
          <p className="mb-2.5 -mt-1 text-[12px] text-[var(--ink-3)]">The list staff choose from when logging a concern. Edit, add or remove — the special legal prompts (LADO, FGM, 999) still apply to matching categories.</p>
          <ListEditor items={settings.safeguarding?.categories ?? [...SG_CATEGORIES]} onChange={(next) => set("safeguarding", { ...settings.safeguarding, categories: next })} placeholder="Add a category…" />

          <div className="mt-5 mb-2 text-[13px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>“What to do now” protocol</div>
          <p className="mb-2.5 -mt-1 text-[12px] text-[var(--ink-3)]">The default guidance staff see on the form. Category-specific overrides (LADO, FGM, 999, NRM) are layered on top automatically.</p>
          <Row label="Timescale" hint="e.g. Same day.">
            <Input value={settings.safeguarding?.protocol?.due ?? DEFAULT_PROTOCOL.due} onChange={(e) => set("safeguarding", { ...settings.safeguarding, protocol: { ...settings.safeguarding?.protocol, due: e.target.value } })} className="w-full" />
          </Row>
          <Row label="Reference" hint="The standard you follow, shown as a tag (e.g. KCSIE).">
            <Input value={settings.safeguarding?.protocol?.ref ?? DEFAULT_PROTOCOL.ref} onChange={(e) => set("safeguarding", { ...settings.safeguarding, protocol: { ...settings.safeguarding?.protocol, ref: e.target.value } })} className="w-full" />
          </Row>
          <FieldLabel>Steps</FieldLabel>
          <ListEditor items={settings.safeguarding?.protocol?.steps ?? [...DEFAULT_PROTOCOL.steps]} onChange={(next) => set("safeguarding", { ...settings.safeguarding, protocol: { ...settings.safeguarding?.protocol, steps: next } })} placeholder="Add a step…" />
        </Section>
      )}

      {tab === "registers" && (
        <Section title="Register" lede="How the daily attendance register behaves — sign-in/out timestamps and which details show when you tap a child.">
          <Row label="Show sign-in / collection times" hint="On: each ✓ In and ✓ Collected shows the time it was tapped. Off: just the tick.">
            <Toggle on={settings.registers?.timestamps ?? true} onChange={(v) => set("registers", { ...settings.registers, timestamps: v })} labels={["On", "Off"]} />
          </Row>
          <Row label="Show the collection-PIN reminder" hint="On: a banner reminds staff to check the family's collection PIN before releasing a child. (The 4-digit PIN itself is Phase 2 — for now use the collection password.)">
            <Toggle on={settings.registers?.requireCollectionPin ?? false} onChange={(v) => set("registers", { ...settings.registers, requireCollectionPin: v })} labels={["On", "Off"]} />
          </Row>
          <div className="mt-3 mb-1 text-[12px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Show on a child&rsquo;s card</div>
          <p className="mb-2 -mt-0.5 text-[12px] text-[var(--ink-3)]">Every detail on the tap-through card. Turn off anything your staff don&rsquo;t need on the day. Keeping allergies, medical and SEND on is strongly recommended for safeguarding.</p>
          {([["allergies", "Allergies"], ["medical", "Medical"], ["dietary", "Dietary"], ["send", "SEND / needs"], ["swimming", "Swimming ability"], ["likes", "Likes / what settles them"], ["dislikes", "Dislikes / avoid"], ["careNotes", "Care notes"], ["answers", "Parent's question answers"], ["consents", "Consents (photos, suncream…)"], ["mainContact", "Main contact (name & number)"], ["emergency", "Emergency contact"], ["password", "Collection password"], ["school", "School"], ["bookingNotes", "Booking notes"], ["attending", "Attending days & times"]] as [string, string][]).map(([k, label]) => (
            <Row key={k} label={label}>
              <Toggle on={settings.registers?.card?.[k as keyof NonNullable<NonNullable<typeof settings.registers>["card"]>] ?? true} onChange={(v) => set("registers", { ...settings.registers, card: { ...settings.registers?.card, [k]: v } })} labels={["Show", "Hide"]} />
            </Row>
          ))}
          <div className="mt-4 mb-1 text-[12px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>Quick actions on each row</div>
          <p className="mb-2 -mt-0.5 text-[12px] text-[var(--ink-3)]">The one-tap links beside each child — each jumps straight to the right page with the child already filled in.</p>
          {([["firstAid", "First aid"], ["incident", "Report incident"], ["medication", "Give medication"], ["moments", "Add moment"], ["message", "Message parent"], ["email", "Email parent"], ["whatsapp", "WhatsApp parent"]] as [string, string][]).map(([k, label]) => (
            <Row key={k} label={label}>
              <Toggle on={settings.registers?.actions?.[k as keyof NonNullable<NonNullable<typeof settings.registers>["actions"]>] ?? true} onChange={(v) => set("registers", { ...settings.registers, actions: { ...settings.registers?.actions, [k]: v } })} labels={["On", "Off"]} />
            </Row>
          ))}
        </Section>
      )}

      {tab === "trips" && (
        <Section title="Trips & visits" lede="Off-site trips — how parents are kept informed and the safety guardrails.">
          <Row label="Ask parents to consent when their child is on a trip" hint="Email + a bell in their area with the trip details (destination, times, transport), and a consent request — reminded until they give it.">
            <Toggle on={settings.trips?.notifyParent ?? true} onChange={(v) => set("trips", { ...settings.trips, notifyParent: v })} labels={["Yes", "No"]} />
          </Row>
          <Row label="Require parental consent before a trip runs" hint="A trip can't be marked ready/completed until every child on it has consent. Off = consent is tracked but not enforced.">
            <Toggle on={settings.trips?.requireConsent ?? true} onChange={(v) => set("trips", { ...settings.trips, requireConsent: v })} labels={["Yes", "No"]} />
          </Row>
          <Row label="Target staff-to-child ratio" hint="The most children per staff member you're happy with on a trip. A trip over this is flagged so you can add staff or split it.">
            <NumberBox value={settings.trips?.ratioTarget ?? 8} onChange={(n) => set("trips", { ...settings.trips, ratioTarget: Math.max(1, n) })} min={1} max={30} suffix=":1" />
          </Row>
          <Row label="Who can plan a trip" hint="Who is allowed to create an off-site trip. Managers/owners can always plan; this controls staff. (Enforcement of leads-only on the staff side needs the roles system — backend.)" note="Enforcement: backend">
            <Select value={settings.trips?.whoCanPlan ?? "all"} onChange={(e) => set("trips", { ...settings.trips, whoCanPlan: e.target.value as "all" | "leads" | "managers" })}>
              <option value="all">All staff</option>
              <option value="leads">Leads &amp; managers only</option>
              <option value="managers">Managers &amp; owners only</option>
            </Select>
          </Row>
        </Section>
      )}

      {tab === "calendar" && (
        <Section title="Calendar" lede="Event reminders and how your calendar behaves. Event categories & colours are managed on the Calendar itself.">
          <Row label="Remind before an event starts" hint="Sends an email + an in-app bell to the staff on an event before it begins, so nothing gets missed.">
            <Toggle on={settings.calendar?.reminderOn ?? true} onChange={(v) => set("calendar", { ...settings.calendar, reminderOn: v })} labels={["On", "Off"]} />
          </Row>
          <Row label="How long before" hint="Minutes before the start time to send the reminder.">
            <NumberBox value={settings.calendar?.reminderMinutes ?? 30} onChange={(n) => set("calendar", { ...settings.calendar, reminderMinutes: Math.max(0, n) })} min={0} max={1440} suffix=" min" />
          </Row>
          <NotWired>Sending the reminder (email + in-app bell) is wired up by the backend.</NotWired>
        </Section>
      )}

      {tab === "inventory" && (
        <Section title="Inventory" lede="How stock checks and reorders behave. Categories, storage locations and seasons are managed on the Inventory page itself.">
          <Row label="When a reorder is logged to Expenses, mark it as" hint="Placing an order on the Inventory page creates a matching expense. Choose whether it lands already Paid, or Owed (pending) so you can pay it later.">
            <Toggle on={(settings.inventory?.orderExpenseStatus ?? "paid") === "paid"} onChange={(v) => set("inventory", { ...settings.inventory, orderExpenseStatus: v ? "paid" : "pending" })} labels={["Paid", "Owed"]} />
          </Row>
          <Row label="Flag an item for a stock check after" hint="An item not counted within this many days shows as 'due a check' and counts toward the 'To check' tile.">
            <NumberBox value={settings.inventory?.checkEveryDays ?? 30} onChange={(n) => set("inventory", { ...settings.inventory, checkEveryDays: Math.max(1, n) })} min={1} max={365} suffix=" days" />
          </Row>
          <Row label="Warn when an item hits its reorder level" hint="Show a Low badge (and, once wired, notify) when stock drops to or below an item's reorder level.">
            <Toggle on={settings.inventory?.lowStockAlert ?? true} onChange={(v) => set("inventory", { ...settings.inventory, lowStockAlert: v })} labels={["On", "Off"]} />
          </Row>
        </Section>
      )}

      {tab === "people" && (
        <>
          <Section
            title="What you collect about every child"
            lede="The built-in details, whoever fills them in — you or the parent. Switch off anything you have no use for; a field you never read is one a family shouldn't be asked to fill. Where a field is typed into, the character limit sits beside it — too short and a parent can't explain a real medical need, too long and your registers and exports become unreadable."
          >
            <Row label="Child's name" hint="Every register, booking and name badge is drawn from it.">
              <AlwaysOn />
            </Row>
            <Row
              label="Allergies"
              hint="A blank allergy field and a genuinely allergy-free child look identical, so it always gets asked."
            >
              <span className="flex items-center gap-2">
                <AlwaysOn />
                <Limit value={settings.charLimits.allergies} onChange={(n) => set("charLimits", { ...settings.charLimits, allergies: n })} />
              </span>
            </Row>
            <Row label="Medical needs" hint="Staff need it before day one, not on the day.">
              <span className="flex items-center gap-2">
                <AlwaysOn />
                <Limit value={settings.charLimits.medical} onChange={(n) => set("charLimits", { ...settings.charLimits, medical: n })} />
              </span>
            </Row>
            <Row label="Ask about dietary needs" hint="Vegetarian, halal, intolerances — separate from an allergy, which is a safety matter. Optional: a sports coach hiring a pitch provides no food and has no use for it, so switch it off.">
              <span className="flex items-center gap-2">
                {settings.collectDietary && (
                  <Limit value={settings.charLimits.dietary} onChange={(n) => set("charLimits", { ...settings.charLimits, dietary: n })} />
                )}
                <Toggle on={settings.collectDietary} onChange={(v) => set("collectDietary", v)} />
              </span>
            </Row>
            <Row label="Likes & dislikes" hint="What settles them and what doesn't. Two short boxes — the first is likes, the second dislikes.">
              <span className="flex items-center gap-2">
                <Limit value={settings.charLimits.likes} onChange={(n) => set("charLimits", { ...settings.charLimits, likes: n })} />
                <Limit value={settings.charLimits.dislikes} onChange={(n) => set("charLimits", { ...settings.charLimits, dislikes: n })} />
              </span>
            </Row>

            <Row
              label="Date of birth required"
              hint={
                dobLock.forcedBy.length
                  ? `Locked on: ${dobLock.forcedBy.length === 1 ? `“${dobLock.forcedBy[0].label}” is` : `${dobLock.forcedBy.length} questions are`} only asked about certain ages, and there's no age without a date of birth. Remove the age range to unlock this.`
                  : "Required: a child can't be saved without one. Optional: they can — useful when someone rings up and you haven't asked yet. The catch is that a child's age is worked out from their date of birth, so until it's there you won't see their age anywhere, listing age limits won't be checked for them, and they won't count towards a ratio band. Give any question an age range and this switches back on, because there's no age to match against."
              }
            >
              <Toggle
                on={dobLock.required}
                disabled={dobLock.forcedBy.length > 0}
                onChange={(v) => set("requireDob", v)}
                labels={["Required", "Optional"]}
              />
            </Row>
            <Row label="Ask a child's gender" hint="Some providers need it for changing rooms or teams; others have no reason to ask.">
              <Toggle on={settings.collectGender} onChange={(v) => set("collectGender", v)} />
            </Row>
            {settings.collectGender && (
              <Row label="Options offered" hint="What a parent can pick from." note="Not shown in the forms yet — they still offer Boy/Girl">
                <div className="w-[240px]">
                  <ListEditor items={settings.genderOptions} onChange={(v) => set("genderOptions", v)} placeholder="Add an option" />
                </div>
              </Row>
            )}
            <Row label="Child photo upload" hint="Lets a family upload a photo of their child. It shows on the register and the booking, so staff know who they're handing over at the end of the day.">
              <Toggle on={settings.collectPhoto} onChange={(v) => set("collectPhoto", v)} />
            </Row>
            <Row
              label="Ask permission to use photos"
              hint="Whether photos OF the child may be used in newsletters, on your website or social media. A different question from the one above — a family can happily give you a face for the register and still refuse publicity."
            >
              <Toggle on={settings.askPhotoConsent} onChange={(v) => set("askPhotoConsent", v)} />
            </Row>
            <Row label="Ask about SEND & additional needs" hint="A free-text field where a family describes the support their child needs, so staff can plan for it.">
              <span className="flex items-center gap-2">
                {settings.collectSend && (
                  <Limit value={settings.charLimits.send} onChange={(n) => set("charLimits", { ...settings.charLimits, send: n })} />
                )}
                <Toggle on={settings.collectSend} onChange={(v) => set("collectSend", v)} />
              </span>
            </Row>
            {settings.collectSend && (
              <Row
                label="Also ask for the EHCP / SEND plan"
                hint="Offered only once a family has said there are needs. This is a formal document you'd then be holding a copy of — worth deciding on purpose rather than collecting because you can. Your copy for staff; the parent isn't shown it back."
              >
                <Toggle on={settings.collectSendPlan} onChange={(v) => set("collectSendPlan", v)} />
              </Row>
            )}
            <Row label="Collection check" hint="Asked only when someone other than the usual adult collects. Set once per family, not per booking.">
              <Select value={settings.collectionCheck} onChange={(e) => set("collectionCheck", e.target.value as TenantSettings["collectionCheck"])}>
                <option value="off">Not used</option>
                <option value="password">Password word</option>
                <option value="pin">Numeric PIN</option>
              </Select>
            </Row>
            <Row
              label="Emergency contact"
              hint="Someone has to be reachable if you can't reach the parent, so at least one is always asked for. Set how many name-and-number pairs a family must give."
              note="Only the first is built so far"
            >
              <span className="flex items-center gap-2">
                <AlwaysOn />
                <NumberBox value={settings.emergencyContacts} onChange={(n) => set("emergencyContacts", n)} min={1} max={4} />
              </span>
            </Row>
          </Section>

          <Section
            title="Your own questions"
            lede="Anything else you need to know, asked once by the family on the child's profile and carried to every booking after — nobody re-types them. Add your own, hide the ones that don't apply to you, and choose whether a question goes on every listing or only some."
          >
            <QuestionsEditor questions={questions} onChange={setQuestions} listings={listings} />
            <p className="mt-3 border-t border-dashed border-[var(--line)] pt-2.5 text-[11.5px] leading-[1.5] text-[var(--ink-3)]">
              These are on top of the built-in details above — no need to re-create a field that
              already exists, or you&apos;ll have families answering the same thing twice.
            </p>
          </Section>

        </>
      )}

      {tab === "cancel" && (
        <>
          <Section
            title="Cancellation & refunds"
            lede="The usual policies, ready to use — edit the numbers and rename them to suit you. You pick one for each listing as you build it, and the first is what a new listing starts on. The wording writes itself from the rules, so what a parent is told and what gets worked out when they cancel can never say different things."
          >
            <PolicyList policies={settings.cancellationPolicies} onChange={(v) => set("cancellationPolicies", v)} />

            <div className="mt-3 border-t border-dashed border-[var(--line)] pt-2.5">
              <Row
                label="When a refund is due"
                hint="Right now nothing moves money on its own — every refund waits for you, and you action it in your own payment provider. Automatic would issue it through Stripe the moment the policy works one out."
                note="Automatic needs building (Amir)"
              >
                <Select
                  value={settings.refundApproval}
                  onChange={(e) => set("refundApproval", e.target.value as TenantSettings["refundApproval"])}
                >
                  <option value="review">Flag it for me to approve</option>
                  <option value="auto">Issue it automatically</option>
                </Select>
              </Row>
              {settings.refundApproval === "auto" && (
                <NotWired>
                  A refund can&apos;t be un-sent. Until this is built, refunds still wait for you —
                  which is the safe way round for it to be wrong.
                </NotWired>
              )}
              <Row
                label="Credit note when no cash refund is due"
                hint="When the policy works out to nothing back, still give the family a credit note for the full amount they paid to spend on a future booking. They keep the value, you keep the cash. Off means a no-refund is simply nothing back."
                note={settings.noRefundCredit ? "Issuing the credit needs building (Amir)" : undefined}
              >
                <Toggle on={settings.noRefundCredit} onChange={(v) => set("noRefundCredit", v)} />
              </Row>
              <Row
                label="Let families cancel single days"
                hint="On a multi-day pass, a parent can cancel individual days instead of the whole booking. Each day is refunded on its own notice window — a day next week may still get a refund while tomorrow gets none."
                note="Partial refund + freeing that day's place needs building (Amir)"
              >
                <Toggle on={settings.allowPartialCancel} onChange={(v) => set("allowPartialCancel", v)} />
              </Row>
              {settings.allowPartialCancel && (
                <div className="mt-1 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-2.5">
                  <div className="mb-1.5 text-[11.5px] font-bold text-[var(--ink-2)]">What a family can do with a released day (the day is valued pro-rata — what they paid ÷ days):</div>
                  <Row label="Move it to another date" hint="Keep the booking whole — the day just moves. Only turn on if this listing lets families pick days across your dates (not a fixed week); otherwise moving a single day makes no sense.">
                    <Toggle on={settings.partialAllowChangeDate} onChange={(v) => set("partialAllowChangeDate", v)} />
                  </Row>
                  <Row label="Credit it to their wallet" hint="The day's value goes to the family's wallet to spend on a future booking — instant, and the money stays with you.">
                    <Toggle on={settings.partialAllowWallet} onChange={(v) => set("partialAllowWallet", v)} />
                  </Row>
                  <Row label="Refund it" hint="Cash back under your cancellation policy. The only option that gives money out on a part-cancelled block, so leave it off if you'd rather keep families on move-a-date or wallet credit.">
                    <Toggle on={settings.partialAllowRefund} onChange={(v) => set("partialAllowRefund", v)} />
                  </Row>
                </div>
              )}
            </div>
          </Section>
          <Section
            title="Cancellation reasons"
            lede="Offered when a booking is cancelled, so you can report on why places are being lost."
          >
            <Row label="Ask you for a reason" hint="Off means you're never made to answer — cancel and move on.">
              <Toggle on={settings.askReasonOperator} onChange={(v) => set("askReasonOperator", v)} />
            </Row>
            <Row
              label="Ask parents for a reason"
              hint="When a parent cancels their own booking. Useful for spotting patterns, but it's one more step between them and a thing they've already decided to do."
            >
              <Toggle on={settings.askReasonParent} onChange={(v) => set("askReasonParent", v)} />
            </Row>
            <div className="mt-2.5">
            <ReasonEditor items={settings.cancellationReasons} onChange={(v) => set("cancellationReasons", v)} />
            </div>
          </Section>

          <Section
            title="Amending dates"
            lede="Whether a parent can move their own session dates, and the rules for it. A move only ever goes to another running date of the same listing that still has space — never onto a full day or across the age caps."
          >
            <Row label="Offer date changes at all" hint="Off: the 'Change dates' flow tells families up front it isn't offered for your listings — they never pick dates only to be turned away. On: the rules below apply.">
              <Toggle on={settings.allowDateChanges} onChange={(v) => set("allowDateChanges", v)} />
            </Row>
            {settings.allowDateChanges && (
            <Row label="Let parents move their own dates" hint="On: they reschedule themselves, within the rules below. Off: they send a request and you approve it, like a cancellation.">
              <Toggle on={settings.amendSelfService} onChange={(v) => set("amendSelfService", v)} />
            </Row>
            )}
            <Row label="How close to a session it can still move" hint="Inside this window it's locked — a place can't be juggled the night before. Enter it in hours or days, whichever reads better for you.">
              <NoticeInput hours={settings.amendNoticeHours} onChange={(h) => set("amendNoticeHours", h)} />
            </Row>
            <Row label="Most moves per booking" hint="Stops one place being reshuffled endlessly, or leave it endless.">
              <MovesLimit value={settings.amendLimit} onChange={(n) => set("amendLimit", n)} />
            </Row>
            <Row label="Admin fee per move" hint="Charged each time they move a date. Leave at 0 for free amends.">
              <NumberBox value={settings.amendFee} onChange={(n) => set("amendFee", n)} min={0} max={200} suffix="£" />
            </Row>
            <Row label="Allow moving to a cheaper option" hint="Whether a parent may swap onto a shorter/cheaper pass or date. Off means moves can only be to the same price or more.">
              <Toggle on={settings.amendAllowCheaper} onChange={(v) => set("amendAllowCheaper", v)} />
            </Row>
            {settings.amendAllowCheaper && (
              <>
                <Row label="A cheaper move can refund to a card" hint="On: the difference can go back to the card they paid with. Off: it's store credit in their wallet — money stays in the business.">
                  <Toggle on={settings.allowCardRefund} onChange={(v) => set("allowCardRefund", v)} />
                </Row>
                {settings.allowCardRefund && (
                  <Row label="Let them choose card or credit" hint="On: they pick when they move. Off: the difference always goes back to the card.">
                    <Toggle on={settings.refundLetCustomerChoose} onChange={(v) => set("refundLetCustomerChoose", v)} labels={["They choose", "Always card"]} />
                  </Row>
                )}
              </>
            )}
            <div className="mt-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[11.5px] leading-[1.6] text-[var(--ink-3)]">
              <b className="text-[var(--ink-2)]">Moving to something dearer</b> collects the difference at the point of the move —
              the same checkout they already know. <b className="text-[var(--ink-2)]">Cancellations</b> are separate: the refund is
              whatever the <em>cancellation policy</em> gives, and a family may take that as wallet credit if they&rsquo;d rather — but
              can&rsquo;t demand more than the policy allows. Enforcement of every rule here is server-side and still being built.
            </div>
          </Section>
        </>
      )}

      {tab === "defaults" && (
        <>
          <Section title="Defaults for a new listing" lede="What a new listing starts with. You can still change any of it per listing.">
            <Row label="Capacity" hint="A tutoring provider's default is 8; a holiday camp's is 60.">
              <NumberBox value={settings.defaultCapacity} onChange={(n) => set("defaultCapacity", n)} min={1} max={999} suffix="places" />
            </Row>
            <Row label="Days it runs" hint="Weekend-only providers shouldn't have to untick five boxes on every listing.">
              <div className="flex gap-1">
                {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => {
                  const on = settings.defaultRunningDays.includes(i + 1);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() =>
                        set(
                          "defaultRunningDays",
                          on ? settings.defaultRunningDays.filter((x) => x !== i + 1) : [...settings.defaultRunningDays, i + 1].sort(),
                        )
                      }
                      className="h-7 w-7 rounded-full border text-[11px] font-bold"
                      style={on ? { borderColor: "transparent", background: "var(--brand-soft)", color: "var(--brand-ink)" } : { borderColor: "var(--line)", color: "var(--ink-3)" }}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </Row>
            <Row label="Show places left to parents" hint="Off hides remaining-place counts on your booking page entirely. When it&rsquo;s on, the &ldquo;only N places left&rdquo; note appears on its own at a third of capacity, capped at five — so an 8-place class warns at 3 and a 60-place camp warns at 5. Nothing to set.">
              <Toggle on={settings.showSpaces} onChange={(v) => set("showSpaces", v)} />
            </Row>
          </Section>
        </>
      )}

      {tab === "marketplace" && (
        <Section
          title="ActivityOS marketplace"
          lede="Your own storefront link always shows your public activities. Switching this on also lists them in the shared ActivityOS marketplace, where families browsing the app can discover you — not just the ones who already have your link."
        >
          <Row label="List us in the marketplace" hint="Off: families reach you only through your storefront/booking link. On: your live, public listings also appear in every family's in-app Browse.">
            <Toggle on={!!settings.marketplaceListed} onChange={(v) => set("marketplaceListed", v)} labels={["Listed", "Off"]} />
          </Row>
        </Section>
      )}

      {tab === "money" && (
        <Section
          title="Money — what you track"
          lede="Your Money section splits into money going OUT (Expenses + supplier Bills/POs) and money coming IN (customer Invoices with pay-links). Show one side or both, and choose whether you raise formal purchase orders."
        >
          <Row label="Show in your Money menu" hint="Outgoing = Expenses + Bills/POs. Incoming = customer Invoices. Both shows everything.">
            <div className="inline-flex overflow-hidden rounded-full border border-[var(--line)] text-[12px] font-bold">
              {(["outgoing", "incoming", "both"] as const).map((k) => (
                <button key={k} type="button" onClick={() => void save({ settings: { ...settings, money: { ...(settings.money ?? {}), show: k } } })} className="px-3.5 py-1.5 capitalize transition-colors" style={(settings.money?.show ?? "both") === k ? { background: "#1d3a8f", color: "#fff" } : { color: "var(--ink-3)" }}>{k}</button>
              ))}
            </div>
          </Row>
          <Row label="We raise purchase orders" hint="On: the Bills page keeps a draft (PO) stage before a bill is received and paid. Off (common for smaller providers): you just track supplier bills — received, then paid.">
            <Toggle on={!!settings.money?.usePurchaseOrders} onChange={(v) => void save({ settings: { ...settings, money: { ...(settings.money ?? {}), usePurchaseOrders: v } } })} labels={["Yes", "No"]} />
          </Row>

          <div className="mt-4 border-t border-[var(--line)] pt-4">
            <div className="text-[14px] font-extrabold text-[var(--ink)]">Business &amp; bank details</div>
            <p className="mb-3 mt-0.5 text-[12px] text-[var(--ink-3)]">Printed on your POs and invoices (and their PDFs/emails). Bank details appear on invoices as the “how to pay” block.</p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {([
                ["businessName", "Business name", "Little Kickers Ltd"],
                ["email", "Contact email", "hello@yourbiz.co.uk"],
                ["phone", "Phone", "07700 900000"],
                ["vatNumber", "VAT number (if any)", "GB123456789"],
                ["address", "Address", "12 High St, Townsville, AB1 2CD"],
                ["paymentTerms", "Payment terms", "Due within 14 days"],
                ["bankName", "Bank name", "Barclays"],
                ["accountName", "Account name", "Little Kickers Ltd"],
                ["sortCode", "Sort code", "12-34-56"],
                ["accountNumber", "Account number", "12345678"],
              ] as const).map(([k, label, ph]) => (
                <div key={k}><FieldLabel>{label}</FieldLabel><Input value={settings.billing?.[k] ?? ""} placeholder={ph} onChange={(e) => void save({ settings: { ...settings, billing: { ...(settings.billing ?? {}), [k]: e.target.value } } })} className="w-full" /></div>
              ))}
            </div>
            <div className="mt-2.5"><FieldLabel>Invoice/PO footer note</FieldLabel><Input value={settings.billing?.footer ?? ""} placeholder="Thank you for your business" onChange={(e) => void save({ settings: { ...settings, billing: { ...(settings.billing ?? {}), footer: e.target.value } } })} className="w-full" /></div>
          </div>

          <div className="mt-4 border-t border-[var(--line)] pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[14px] font-extrabold text-[var(--ink)]">Invoice template — what to show</div>
              <button type="button" onClick={() => setTmplPreview(true)} className="rounded-full bg-[#1d3a8f] px-3.5 py-1.5 text-[12px] font-extrabold text-white shadow-sm hover:brightness-110">👁 Preview invoice</button>
            </div>
            <p className="mb-3 mt-0.5 text-[12px] text-[var(--ink-3)]">Add your logo and pick which optional fields appear when you raise an invoice. Hit <b>Preview</b> to see a sample with your details.</p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div>
                <FieldLabel>Logo</FieldLabel>
                <div className="flex items-center gap-2">
                  {settings.billing?.logoUrl && <img src={settings.billing.logoUrl} alt="logo" className="h-9 max-w-[120px] rounded border border-[var(--line)] object-contain" />}
                  <label className="cursor-pointer rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-bold text-[#1d3a8f]">⬆ Upload<input type="file" accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp,image/gif,image/bmp,image/avif,image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { const dataUrl = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error("Couldn’t read that file")); r.readAsDataURL(f); }); const payload = dataUrl.startsWith("data:image/") ? await compressLogo(dataUrl) : dataUrl; const { url } = await api<{ url: string }>("/api/uploads", { method: "POST", body: JSON.stringify({ dataUrl: payload }) }); await save({ settings: { ...settings, billing: { ...(settings.billing ?? {}), logoUrl: url } } }); } catch (err) { alert(err instanceof Error ? `Logo upload failed: ${err.message}` : "Couldn’t upload that logo — most image files work (PNG, JPG, SVG, WebP, GIF…). iPhone HEIC photos: export as JPG first."); } e.target.value = ""; }} /></label>
                  {settings.billing?.logoUrl && <button type="button" onClick={() => void save({ settings: { ...settings, billing: { ...(settings.billing ?? {}), logoUrl: "" } } })} className="text-[11.5px] font-bold text-[var(--ink-3)]">Remove</button>}
                </div>
                <div className="mt-1.5 text-[11px] text-[var(--ink-3)]">PNG, JPG, SVG, WebP, GIF, BMP or AVIF — up to 1MB, resized automatically. (iPhone HEIC: export as JPG first.)</div>
              </div>
              <div><FieldLabel>Company registration no.</FieldLabel><Input value={settings.billing?.companyReg ?? ""} placeholder="133950" onChange={(e) => void save({ settings: { ...settings, billing: { ...(settings.billing ?? {}), companyReg: e.target.value } } })} className="w-full" /></div>
            </div>
            <div className="mt-3">
              <FieldLabel>Optional invoice fields — tick what you use</FieldLabel>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px]">
                {([["poNumber", "Customer PO number"], ["accountRef", "Account ref"], ["vat", "VAT / tax"]] as const).map(([k, label]) => (
                  <label key={k} className="flex items-center gap-1.5 font-bold"><input type="checkbox" checked={!!settings.billing?.fields?.[k]} onChange={(e) => void save({ settings: { ...settings, billing: { ...(settings.billing ?? {}), fields: { ...(settings.billing?.fields ?? {}), [k]: e.target.checked } } } })} /> {label}</label>
                ))}
              </div>
            </div>
            {settings.billing?.fields?.vat && <div className="mt-2.5 max-w-[200px]"><FieldLabel>Default VAT %</FieldLabel><Input type="number" value={settings.billing?.defaultTaxRate ?? ""} placeholder="20" onChange={(e) => void save({ settings: { ...settings, billing: { ...(settings.billing ?? {}), defaultTaxRate: e.target.value === "" ? undefined : Number(e.target.value) } } })} className="w-full" /></div>}
          </div>

          <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[14px] font-extrabold text-[var(--ink)]">Purchase-order template</div>
              <button type="button" onClick={() => setPoPreview(true)} className="rounded-full bg-[#1d3a8f] px-3.5 py-1.5 text-[12px] font-extrabold text-white shadow-sm hover:brightness-110">👁 Preview PO</button>
            </div>
            <p className="mb-3 mt-0.5 text-[12px] text-[var(--ink-3)]">Boilerplate printed on every purchase order below the items. The per-PO bits (supplier, deliver-to, comments) are set when you raise the order.</p>
            <div className="grid gap-3">
              <div><FieldLabel>Payment method</FieldLabel><Input value={settings.billing?.poPaymentMethod ?? ""} placeholder="e.g. To be invoiced — 30 days from receipt" onChange={(e) => void save({ settings: { ...settings, billing: { ...(settings.billing ?? {}), poPaymentMethod: e.target.value } } })} className="w-full" /></div>
              <div><FieldLabel>Instructions to suppliers <span className="font-normal normal-case text-[var(--ink-3)]">— one per line, auto-numbered</span></FieldLabel><textarea value={settings.billing?.poInstructions ?? ""} rows={4} placeholder={"Quote this PO number on all invoices\nEmail invoices as PDF to accounts@yourbusiness.com\nA delivery note must accompany all goods"} onChange={(e) => void save({ settings: { ...settings, billing: { ...(settings.billing ?? {}), poInstructions: e.target.value } } })} className={`${inputCls} w-full resize-y`} /></div>
              <div><FieldLabel>Terms &amp; conditions</FieldLabel><textarea value={settings.billing?.poTerms ?? ""} rows={3} placeholder="By accepting this order you agree to our standard terms and conditions…" onChange={(e) => void save({ settings: { ...settings, billing: { ...(settings.billing ?? {}), poTerms: e.target.value } } })} className={`${inputCls} w-full resize-y`} /></div>
            </div>
          </div>
          {tmplPreview && (() => {
            const f = settings.billing?.fields ?? {};
            const sample = {
              reference: "INV-1001", customerName: "Sample Customer Ltd", customerAddress: "1 Example Street, Townsville AB1 2CD", customerEmail: "customer@example.com",
              poNumber: f.poNumber ? "4200075991" : undefined, accountRef: f.accountRef ? "ACC-001" : undefined,
              date: "2026-01-15",
              lineItems: [{ description: "Summer camp — week 1", qty: 1, unitPrice: 120 }, { description: "Extended day", qty: 3, unitPrice: 8 }],
              taxRate: f.vat ? (settings.billing?.defaultTaxRate ?? 20) : undefined,
              notes: "This is a preview of how your invoices will look.",
            } as Record<string, unknown>;
            return <PrintableDoc kind="invoice" doc={sample} billing={settings.billing} onClose={() => setTmplPreview(false)} />;
          })()}
          {poPreview && (() => {
            const sample = {
              reference: "PO-1001", supplier: "Sample Supplier Ltd", supplierAddress: "12 Trade Park, Industry Way, Townsville AB1 2CD", supplierEmail: "sales@supplier.example",
              date: "2026-01-15", dueDate: "2026-01-29",
              requestedBy: settings.billing?.businessName ? `${settings.billing.businessName} — Ops` : "Operations",
              deliveryAddress: settings.billing?.address ?? "", comments: "Please confirm receipt of this order by return email.",
              lineItems: [{ description: "Summer HAF programme — SEN", qty: 1, unitPrice: 16800 }, { description: "Extra sessions", qty: 4, unitPrice: 120 }],
              notes: "This is a preview of how your purchase orders will look.",
            } as Record<string, unknown>;
            return <PrintableDoc kind="po" doc={sample} billing={settings.billing} onClose={() => setPoPreview(false)} />;
          })()}
        </Section>
      )}

      {tab === "features" && (() => {
        const fe = settings.features;
        const setFe = (view: string, v: boolean) => set("features", { ...fe, [view]: v });
        const ca = settings.customerArea;
        const setCAkey = (key: keyof typeof ca, v: boolean) => set("customerArea", { ...ca, [key]: v });
        const setCAkeys = (keys: (keyof typeof ca)[], v: boolean) => set("customerArea", { ...ca, ...Object.fromEntries(keys.map((k) => [k, v])) });
        // A feature nav view → the customer-visibility toggle(s) it controls.
        const custKeys: Record<string, (keyof typeof ca)[]> = {
          messages: ["messaging"], marketing: ["coupons", "codesBanner"], newsfeed: ["newsfeed"],
          moments: ["moments"], meals: ["meals"], memberships: ["memberships"], referrals: ["refer"],
          timetable: ["timetable"], trips: ["trips"], accidents: ["accidents"], medication: ["medication"],
        };
        const skip = new Set(["dash", "dashboard", "auth"]);
        const seen = new Set<string>();
        const all = (NAV_GROUPS[portal] ?? [])
          .flatMap((g) => g.items)
          .filter((it) => !it.hidden && !skip.has(it.view))
          .filter((it) => (seen.has(it.view) ? false : (seen.add(it.view), true)));
        const core = all.filter((it) => CORE_VIEWS.has(it.view));
        const optional = all.filter((it) => !CORE_VIEWS.has(it.view));
        return (
          <>
            <Section
              title="Always on"
              lede="The essentials for running — including the pieces that go into setting up a listing (availability, locations). These can't be switched off."
            >
              {core.map((it) => (
                <Row key={it.view} label={it.label ?? it.view}>
                  <span className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1 text-[11px] font-bold text-[var(--ink-3)]">🔒 Always on</span>
                </Row>
              ))}
            </Section>

            <Section
              title="Your features"
              lede="Switch off anything you don't use — it leaves your dashboard entirely. For anything families also see, flip the nested “Show to families” switch to keep it for yourself but hide it from them."
            >
              {optional.map((it) => {
                const on = fe[it.view] !== false;
                const keys = custKeys[it.view];
                const shownToFamilies = keys ? keys.every((k) => ca[k] !== false) && !ca.simpleMode : false;
                return (
                  <div key={it.view} className="border-b border-dashed border-[var(--line)] py-2.5 last:border-b-0">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-[200px] flex-1">
                        <div className="text-[13px] font-bold">{it.label ?? it.view}</div>
                        {keys && <div className="mt-0.5 text-[11px] text-[var(--ink-3)]">👪 Families see this too</div>}
                      </div>
                      <Toggle on={on} onChange={(v) => setFe(it.view, v)} labels={["On", "Off"]} />
                    </div>
                    {keys && on && (
                      <div className="mt-2 ml-3 flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2">
                        <span className="text-[11.5px] font-semibold text-[var(--ink-2)]">👪 Show to families{ca.simpleMode ? " — off in Simple mode" : ""}</span>
                        <Toggle on={shownToFamilies} disabled={ca.simpleMode} onChange={(v) => setCAkeys(keys, v)} labels={["Shown", "Hidden"]} />
                      </div>
                    )}
                  </div>
                );
              })}
            </Section>

            <Section
              title="Families also see"
              lede="Extras in the family app. Simple mode strips their area right back to just booking, activities and account — overriding the switches above."
            >
              <Row label="✨ Simple mode" note="Overrides the rest" hint="On: families see only booking, activities and their account.">
                <Toggle on={ca.simpleMode} onChange={(v) => setCAkey("simpleMode", v)} labels={["On", "Off"]} />
              </Row>
              <Row label="👛 Wallet / credit" hint="Store credit families can spend at checkout.">
                <Toggle on={ca.simpleMode ? false : ca.wallet} disabled={ca.simpleMode} onChange={(v) => setCAkey("wallet", v)} labels={["Shown", "Hidden"]} />
              </Row>
              <Row label="🔍 Browse your activities" hint="The page where families see and book your activities. (The cross-provider marketplace is separate — see the Marketplace tab.)">
                <Toggle on={ca.simpleMode ? false : ca.browse} disabled={ca.simpleMode} onChange={(v) => setCAkey("browse", v)} labels={["Shown", "Hidden"]} />
              </Row>
            </Section>
          </>
        );
      })()}

      {tab === "refer" && (() => {
        const r = settings.referral;
        const setR = (patch: Partial<typeof r>) => set("referral", { ...r, ...patch });
        const num = (v: string) => Math.max(0, Math.round(Number(v) || 0));
        const pct = r.type === "percent";
        const Amount = ({ value, onChange }: { value: number; onChange: (n: number) => void }) => (
          <span className="inline-flex items-center gap-1">
            {!pct && <span className="text-[12px] font-bold text-[var(--ink-3)]">£</span>}
            <Input type="number" min="0" step="1" max={pct ? "100" : undefined} value={String(value)} onChange={(e) => onChange(Math.min(pct ? 100 : 1e6, num(e.target.value)))} className="w-[84px]" />
            {pct && <span className="text-[12px] font-bold text-[var(--ink-3)]">%</span>}
          </span>
        );
        return (
          <Section
            title="Refer a friend"
            lede="A give-X-get-X reward: a family shares their personal link, a friend gets money off their first booking, and the family earns a code once that booking goes through. You fund the rewards, so the amounts are yours."
          >
            <Row label="🎁 Refer a friend" hint="Off: no referral page for families. On: each family gets a shareable link and both sides earn.">
              <Toggle on={r.enabled} onChange={(v) => setR({ enabled: v })} labels={["On", "Off"]} />
            </Row>
            <Row label="Reward type" hint="Money off a fixed amount, or a percentage off.">
              <Toggle on={r.type === "amount"} onChange={(v) => setR({ type: v ? "amount" : "percent" })} labels={["£ off", "% off"]} />
            </Row>
            <Row label={`Friend gets — ${pct ? "% " : ""}off their first booking`} hint="The discount a brand-new family gets when they book with a friend's link.">
              <Amount value={r.friendOff} onChange={(n) => setR({ friendOff: n })} />
            </Row>
            <Row label={`Referrer earns — as a ${pct ? "% " : ""}code`} hint="The reward the referring family gets in their Coupons area once the friend's first booking is made.">
              <Amount value={r.referrerReward} onChange={(n) => setR({ referrerReward: n })} />
            </Row>
            <Row label="Minimum spend (£)" hint="The friend's first basket must reach this for the reward to apply. 0 = no minimum.">
              <span className="inline-flex items-center gap-1"><span className="text-[12px] font-bold text-[var(--ink-3)]">£</span><Input type="number" min="0" step="1" value={String(r.minSpend)} onChange={(e) => setR({ minSpend: num(e.target.value) })} className="w-[84px]" /></span>
            </Row>
            {pct && (
              <Row label="Cap reward to the friend's spend" note="Recommended" hint="Keeps you safe: the reward can never take off more than the friend actually paid — so a cheap referral can't unlock a big % discount on the referrer's next large booking.">
                <Toggle on={r.capToFriendSpend} onChange={(v) => setR({ capToFriendSpend: v })} labels={["On", "Off"]} />
              </Row>
            )}
          </Section>
        );
      })()}

      {tab === "memberships" && (() => {
        const m = settings.memberships;
        const setM = (patch: Partial<typeof m>) => set("memberships", { ...m, ...patch });
        const num = (v: string) => Math.max(0, Math.round(Number(v) || 0));
        const setTier = (id: string, patch: Partial<(typeof m.tiers)[number]>) =>
          setM({ tiers: m.tiers.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
        return (
          <Section
            title="Memberships"
            lede="Offer families up to three monthly plans. Each tier gives EITHER wallet credit every month, or a standing % off every booking (which stacks on top of any coupons). Toggle tiers on/off and set the price + benefit. Recurring billing is handled by Stripe."
          >
            <Row label="⭐ Memberships" hint="Off: no memberships page for families. On: families can join the tiers you switch on below.">
              <Toggle on={m.enabled} onChange={(v) => setM({ enabled: v })} labels={["On", "Off"]} />
            </Row>
            {m.tiers.map((t) => {
              const pct = t.benefitType === "percent";
              return (
                <div key={t.id} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <Input value={t.name} onChange={(e) => setTier(t.id, { name: e.target.value })} className="w-[160px] font-bold" />
                    <Toggle on={t.enabled} onChange={(v) => setTier(t.id, { enabled: v })} labels={["On", "Off"]} />
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <label className="text-[12px] font-semibold text-[var(--ink-2)]">Price / month
                      <span className="mt-1 flex items-center gap-1"><span className="text-[12px] font-bold text-[var(--ink-3)]">£</span><Input type="number" min="0" step="1" value={String(t.priceMonthly)} onChange={(e) => setTier(t.id, { priceMonthly: num(e.target.value) })} className="w-full" /></span>
                    </label>
                    <label className="text-[12px] font-semibold text-[var(--ink-2)]">Benefit
                      <span className="mt-1 block"><Toggle on={pct} onChange={(v) => setTier(t.id, { benefitType: v ? "percent" : "credit" })} labels={["% off", "£ credit"]} /></span>
                    </label>
                    <label className="text-[12px] font-semibold text-[var(--ink-2)]">{pct ? "% off every booking" : "£ credit / month"}
                      <span className="mt-1 flex items-center gap-1">{!pct && <span className="text-[12px] font-bold text-[var(--ink-3)]">£</span>}<Input type="number" min="0" step="1" max={pct ? "100" : undefined} value={String(t.benefitValue)} onChange={(e) => setTier(t.id, { benefitValue: Math.min(pct ? 100 : 1e6, num(e.target.value)) })} className="w-full" />{pct && <span className="text-[12px] font-bold text-[var(--ink-3)]">%</span>}</span>
                    </label>
                  </div>
                  {/* Live benefit line — updates as they switch % ↔ £ or change the
                      value, so they always see what a member actually gets. It's
                      shown automatically on the customer card, so it's NOT a perk. */}
                  <div className="mt-2 rounded-lg bg-[#eef4ff] px-3 py-1.5 text-[12px] font-bold text-[#1d3a8f]">
                    {pct ? "🏷️ " : "👛 "}Members get: {pct ? `${t.benefitValue}% off every booking` : `£${t.benefitValue} wallet credit every month`}
                  </div>
                  {t.benefitType === "credit" && t.benefitValue <= t.priceMonthly && (
                    <div className="mt-2 rounded-lg bg-[#fdf3d8] px-3 py-1.5 text-[11.5px] font-semibold text-[#8a5300]">⚠️ Members pay £{t.priceMonthly}/mo but only get £{t.benefitValue} back — set the credit above the price (e.g. £{t.priceMonthly}/mo → £{Math.round(t.priceMonthly * 1.25)} wallet) so it’s worth joining.</div>
                  )}
                </div>
              );
            })}
            {/* Live preview — the ACTUAL customer tier card (shared component),
                so what you see here is exactly what families see. Updates live. */}
            {(() => {
              const live = m.tiers.filter((t) => t.enabled);
              if (!m.enabled || live.length === 0) return null;
              return (
                <div className="mt-5">
                  <div className="mb-2 text-[12px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-3)]">Preview — how families see it</div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {live.map((t) => (
                      <MembershipTierCard key={t.id} tier={t}
                        footer={<div className="rounded-full bg-[var(--brand-2,#2f6bd8)] py-2 text-center text-[12.5px] font-extrabold text-white">Join {t.name}</div>} />
                    ))}
                  </div>
                </div>
              );
            })()}
          </Section>
        );
      })()}

      {tab === "notifications" && <NotificationsTab />}

      {tab === "seasons" && (
        <Section
          title="Seasons"
          lede="Your trading periods — just names (Autumn 1, Summer Holidays, Full year…). Each listing picks its season when you build it, and Bookings, Audiences and takings group by it. No dates, so different holiday dates across towns don’t matter."
        >
          <SeasonsEditor items={settings.seasons ?? []} onChange={(v) => set("seasons", v)} />
        </Section>
      )}

      {tab === "bookings" && (
        <>
          <Section
            title="How parents pay"
            lede="How you record payment when you take a booking yourself — over the phone, or for a funded or free place. These are stored on the booking and drive the funding column in your exports."
          >
            <PayMethodEditor items={settings.payMethods} onChange={(v) => set("payMethods", v)} />
            <div className="mt-3 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[11.5px] leading-[1.5] text-[var(--ink-3)]">
              <b className="text-[var(--ink-2)]">&ldquo;Awaiting payment&rdquo; is about the money, not the place.</b> The booking is <b>confirmed straight away</b> either way — the place is held, the child is on the register. The badge only tells you whether the cash has landed: Card is paid on the spot; bank transfer, cash and vouchers sit <b>awaiting payment</b> until you reconcile them (nothing is un-booked in the meantime). So a cash booking is <i>Booked · payment outstanding</i>, exactly as you&rsquo;d expect.
              <br />
              <br />
              Standard methods are fixed (toggle on/off); &ldquo;Card&rdquo; routes to Stripe so it can&rsquo;t be renamed. Add <i>your own</i> labels below for anything else you record by hand. There&rsquo;s no &ldquo;Free place&rdquo; — a <b>£0</b> booking skips payment on its own and is marked <b>Funded</b>.
            </div>
          </Section>
        </>
      )}

      {tab === "vouchers" && (
        <>
          <Section
            title="Childcare vouchers"
            lede="Parents paying by employer voucher pay on their scheme’s own website, not here — so they need whatever that scheme asks for. Some want an account number, some your setting name, some an Ofsted number, so the labels are yours to write. Fill in the schemes you’re registered with; anything left blank isn’t offered."
          >
            <VoucherEditor items={settings.voucherProviders} onChange={(v) => set("voucherProviders", v)} />

            <div className="mt-3 border-t border-dashed border-[var(--line)] pt-2.5">
              <Row
                label="Hold the place for"
                hint="After this the booking is flagged for you to look at (overdue vouchers show on your dashboard) — nothing is cancelled automatically. That's deliberate: if you're a day late reconciling a payment that did arrive, an automatic cancellation would throw away a family's booking over your admin. The call stays yours."
              >
                <NumberBox value={settings.voucherHoldDays} onChange={(n) => set("voucherHoldDays", n)} min={1} max={60} suffix="days" />
              </Row>
              <Row
                label="Money must reach you"
                hint="Most providers want it in before the child turns up. Set how far ahead — the parent is told to send it earlier still, since voucher money spends a few days in transit."
              >
                <Select value={String(settings.voucherDueByDays)} onChange={(e) => set("voucherDueByDays", Number(e.target.value))}>
                  <option value="0">By the day it starts</option>
                  <option value="1">The day before it starts</option>
                  <option value="2">2 days before</option>
                  <option value="3">3 days before</option>
                  <option value="7">A week before</option>
                </Select>
              </Row>
              <Row
                label="If it starts too soon"
                hint="A camp starting tomorrow can't be paid for by voucher in time. What happens then is your call — the parent is told what's going on either way."
                note={settings.voucherWhenClose === "approve" ? "Holding for approval needs building (Amir)" : undefined}
              >
                <Select value={settings.voucherWhenClose} onChange={(e) => set("voucherWhenClose", e.target.value as TenantSettings["voucherWhenClose"])}>
                  <option value="hide">Don&rsquo;t offer vouchers</option>
                  <option value="warn">Offer them, but warn</option>
                  <option value="approve">Offer them, but I approve first</option>
                  <option value="normal">Take it as a normal booking</option>
                </Select>
              </Row>
              <Row
                label="Voucher money takes"
                hint="How long it takes to reach you. Vouchers aren't offered on a booking starting sooner than this — a payment that can't arrive in time isn't a payment, it's you chasing someone on the morning of the camp."
              >
                <NumberBox value={settings.voucherClearDays} onChange={(n) => set("voucherClearDays", n)} min={0} max={14} suffix="days" />
              </Row>
            </div>

            <div className="mt-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[11.5px] leading-[1.5] text-[var(--ink-3)]">
              <b className="text-[var(--ink-2)]">Tax-Free Childcare isn’t here.</b> It’s HMRC rather
              than an employer scheme, it uses your Ofsted number, and it’s getting its own
              reconciliation — so it stays a payment method in its own right.
            </div>
          </Section>
        </>
      )}

      {tab === "groups" && (
        <>
          <Section
            title="Age groups & rooms"
            lede="Set your groups once, here — colour, age band, staffing ratio, and room size (the most children the space holds). This is the single source; the Ratios board and every listing read from it."
          >
            <GroupsEditor groups={settings.ratioGroups} onChange={(v) => set("ratioGroups", v)} />

            {/* One scannable strip: where these groups get used. */}
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {[
                { icon: "📋", head: "Here (Setup)", body: "The only place you edit a group — name, colour, age, ratio, room size." },
                { icon: "🎫", head: "Listings", body: "Cap how many places each group takes per day (never above its room size). Nothing else." },
                { icon: "⚖️", head: "Ratios board", body: "Shows the groups and runs the day's cover — drag a child to another group as needed. View only, never edits them." },
              ].map((t) => (
                <div key={t.head} className="rounded-xl border border-[var(--line)] bg-[var(--panel,#fbf8fc)] p-3">
                  <div className="text-[12px] font-extrabold">{t.icon} {t.head}</div>
                  <div className="mt-1 text-[11px] leading-[1.5] text-[var(--ink-3)]">{t.body}</div>
                </div>
              ))}
            </div>
          </Section>
        </>
      )}

    </OperatorPage>
  );
}
