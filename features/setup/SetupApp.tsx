"use client";

import { StepDonePrompt } from "@/features/dashboard/StepDonePrompt";
import { CancelWelcome } from "./CancelWelcome";
import { settingsOwner } from "@/lib/franchiseTerms";
import { dateLocale as dl } from "@/lib/i18n/format";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { api, get as apiGet } from "@/lib/api";
import { NAV_GROUPS, type PortalKey } from "@/lib/nav/config";
import { CORE_VIEWS, featureOff } from "@/lib/use-customer-area";
import { Button, Card, FieldLabel, Input, Select, inputCls } from "@/components/ui";
import { useI18n, useT, useWord, tNow } from "@/lib/i18n/provider";
import { Rich, tr, slug } from "./Rich";
import { pickPlural } from "@/lib/i18n/plural";
import { navLabel } from "@/lib/i18n/words";
import { PrintableDoc } from "@/features/money/doc-shared";
import { HowItWorks } from "@/components/HowItWorks";
import { OperatorPage, TabStrip } from "@/components/OperatorPage";
import { useHoScope } from "@/components/franchise/HoScope";
import { peekMe } from "@/components/auth/PortalGuard";
import { RolesPermissions } from "./RolesPermissions";
import { DOB_OPTIONAL_LOSSES } from "@/lib/childDob";
import {
  useSettings,
  PROVIDER_NOTIFICATIONS,
  NOTIFICATIONS_SAFETY,
  notificationChannel,
  type NotifyChannel,
  EMAIL_DELIVERY_KEY,
  notificationOn,
  answerKey,
  dobRequired,
  DEFAULT_QUESTION_LENGTH,
  HO_DEFAULT_ROLES,
  HO_ROLE_AREAS,
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
  HUB_DEFAULTS,
  type HubSettings,
} from "@/lib/settings";
import { policyWordingT, sortBands, HOURS, type CancellationPolicy, type NamedPolicy, type RefundBand } from "@/lib/cancellation";
import { defaultSeasonNames, type Season } from "@/lib/seasons";
import { SG_CATEGORIES, DEFAULT_PROTOCOL } from "@/features/incidents/safeguarding";
import { MembershipTierCard } from "@/features/parent/MembershipsApp";
import { CERT_TEMPLATES, CERT_ACCENTS, certTemplateOf, certificateDoc, openCertificate, CERT_SAMPLE } from "@/features/learning/certificates";
import { useCredentials } from "@/features/learning/credentials";
import { useTeam } from "@/features/team/useTeam";
import { LevelsEditorDraft } from "@/features/learninghub/progress/levels";
import { YearGroupsEditor } from "@/features/learninghub/quiz/YearGroupsEditor";
import { SubjectColoursEditor } from "@/features/learninghub/SubjectColourPicker";
import { ParentEmailSettings } from "@/features/learninghub/digest/ParentEmailSettings";
import type { Student } from "@/features/learninghub/types";
import { BrandSwatches, BRAND_KEYS, brandLabelKey } from "./BrandColours";

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

type Tab = "features" | "company" | "branding" | "people" | "staff" | "announcements" | "roles" | "reviews" | "learning" | "hub" | "meals" | "medication" | "safeguarding" | "registers" | "trips" | "calendar" | "inventory" | "groups" | "cancel" | "defaults" | "bookings" | "seasons" | "vouchers" | "marketplace" | "refer" | "memberships" | "notifications" | "money";

// A self-contained toggle for the "email me on a new message" preference. It
// lives on the tenant doc (via /api/messages/settings), not the library-settings
// store the rest of this page uses — so it manages its own load/save.
interface MsgSettings { emailOnNewMessage: boolean; notifyEmail: string; accountEmail: string }
function NotificationsTab() {
  const t = useT();
  const { settings, save } = useSettings();
  const prefs = settings.notifications ?? {};
  const setPref = (key: string, on: boolean) =>
    void save({ settings: { ...settings, notifications: { ...prefs, [key]: on } } });
  const setChannel = (key: string, ch: NotifyChannel, label: string) => {
    // Not locked — but "a child hasn't been collected" isn't a preference in
    // the way "new booking" is, so say so once before it goes quiet.
    if (ch === "off" && NOTIFICATIONS_SAFETY.has(key)
      && !confirm(t("p8set.ntOffConfirm", { label }))) return;
    const v = ch === "off" ? false : ch === "bell" ? "bell" : true;
    void save({ settings: { ...settings, notifications: { ...prefs, [key]: v } } });
  };
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
    catch (e) { setErr(e instanceof Error ? e.message : t("p8set.ntCouldntSave")); }
  }
  // Where every alert email lands: the address you sign in with (an old custom
  // override still wins if one was ever set, but the UI to set one is gone).
  const alertEmail = (s?.notifyEmail || s?.accountEmail || "").trim();
  return (
    <Card className="p-5">
      <h3 className="text-[15px] font-extrabold">{t("p8set.ntMsgHead")}</h3>
      <p className="mb-3 text-[12.5px] text-[var(--ink-3)]">{t("p8set.ntMsgLede")}</p>
      <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] px-4 py-3">
        <div className="min-w-0">
          <div className="text-[13.5px] font-bold">{t("p8set.ntEmailMe")}</div>
          <div className="text-[12px] text-[var(--ink-3)]">{t("p8set.ntEmailMeHint")}</div>
        </div>
        {s && <Toggle on={s.emailOnNewMessage} onChange={change} />}
      </div>
      {s?.emailOnNewMessage && (
        <div className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3">
          <div className="text-[13px] font-semibold text-[var(--ink)]">
            <Rich k="p8set.ntSentTo" vars={{}} slots={{ email: <span className="font-extrabold">{alertEmail || t("p8set.ntSignInEmail")}</span> }} />
          </div>
          <div className="mt-0.5 text-[12px] text-[var(--ink-3)]">{t("p8set.ntSentHint")}</div>
        </div>
      )}
      {err && <div className="mt-2 text-[12.5px] text-[var(--red,#e21d27)]">{err}</div>}

      <div className="mt-5 border-t border-[var(--line)] pt-4">
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border-2 px-4 py-3.5"
          style={{ borderColor: emailOn ? "#2f6bd8" : "var(--line)", background: emailOn ? "linear-gradient(180deg,#eff5ff,#fff)" : "var(--surface)" }}>
          <div className="min-w-0">
            <div className="text-[14px] font-extrabold">{t("p8set.ntPlatHead")}</div>
            <div className="text-[12px] text-[var(--ink-3)]">
              {emailOn
                ? <Rich k="p8set.ntPlatOn" slots={{ email: <span className="font-bold">{alertEmail || t("p8set.ntSignInEmail")}</span> }} />
                : t("p8set.ntPlatOff")}
            </div>
          </div>
          <Toggle on={emailOn} onChange={(v) => setPref(EMAIL_DELIVERY_KEY, v)} labels={[t("p8set.on"), t("p8set.off")]} />
        </div>
        <h3 className="text-[15px] font-extrabold">{t("p8set.ntAlertHead")}</h3>
        <p className="mb-3 text-[12.5px] text-[var(--ink-3)]">
          {emailOn
            ? t("p8set.ntAlertOn")
            : t("p8set.ntAlertOff")}
        </p>
        {groups.map((g) => (
          <div key={g} className="mb-3">
            <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-3)]">{tr(t, "p8set.ntg_" + slug(g), g)}</div>
            <div className="overflow-hidden rounded-xl border border-[var(--line)]">
              {PROVIDER_NOTIFICATIONS.filter((n) => n.group === g).map((n, i) => (
                <div key={n.key} className={`flex items-center justify-between gap-3 px-4 py-2.5 ${i > 0 ? "border-t border-[var(--line)]" : ""}`}>
                  <div className="min-w-0 text-[13px] font-semibold text-[var(--ink)]">
                    {tr(t, "p8set.ntf_" + slug(n.key), n.label)}
                    {NOTIFICATIONS_SAFETY.has(n.key) && <span className="ms-1.5 text-[10.5px] font-extrabold uppercase tracking-wide text-[#a5760a]">{t("p8set.ntSafety")}</span>}
                  </div>
                  {/* Three-way: bell + email · bell only · off. The old boolean
                      still reads correctly — true is "both", false is "off". */}
                  <div className="flex shrink-0 gap-1">
                    {(["both", "bell", "off"] as NotifyChannel[]).map((c) => {
                      const cur = notificationChannel(prefs, n.key, n.defaultOff);
                      const label = c === "both" ? t("p8set.ntBoth") : c === "bell" ? t("p8set.ntBell") : t("p8set.off");
                      return (
                        <button key={c} type="button" onClick={() => setChannel(n.key, c, tr(t, "p8set.ntf_" + slug(n.key), n.label))}
                          className="rounded-full px-2.5 py-1 text-[11.5px] font-extrabold"
                          style={cur === c
                            ? { background: c === "off" ? "#fdeaee" : "#eaf0fc", color: c === "off" ? "#b3123c" : "#1d3a8f" }
                            : { background: "transparent", color: "var(--ink-3)" }}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
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

/** Who a feature is for — shown under its name in Setup → Features. */
const FEATURE_HINTS: Record<string, string> = {
  learninghub: "For tutoring providers — topics, lessons, quizzes, homework, flashcards and live lessons",
};

const MARK_RULES: { id: HubSettings["questionKinds"][number]["mark"]; label: string }[] = [
  { id: "choice", label: "One right option" },
  { id: "multi", label: "All the right options" },
  { id: "exact", label: "Typed text must match" },
  { id: "numeric", label: "Number within a tolerance" },
  { id: "match", label: "Every pair matched" },
  { id: "order", label: "Items in the exact order" },
  { id: "manual", label: "Tutor marks it" },
];

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

function Toggle({ on, onChange, labels: labelsIn, disabled }: { on: boolean; onChange: (v: boolean) => void; labels?: [string, string] | string[]; disabled?: boolean }) {
  const t = useT();
  const labels = labelsIn ?? [t("p8set.on"), t("p8set.off")];
  return (
    <div
      className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--panel)] p-[3px] text-[12px] font-extrabold shadow-[inset_0_1px_2px_rgba(15,23,42,.06)]"
      style={disabled ? { opacity: 0.5 } : undefined}
      title={disabled ? t("p8set.toggleLocked") : undefined}
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
  const t = useT();
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
        <option value="hours">{t("p8set.noticeHours")}</option>
        <option value="days">{t("p8set.noticeDays")}</option>
        <option value="anytime">{t("p8set.noticeAnytime")}</option>
      </Select>
    </span>
  );
}

// Amend limit: an "Endless" pill instead of a confusing 0. 0 = endless in the
// store; a specific cap is any number ≥ 1.
function MovesLimit({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const t = useT();
  const endless = value === 0;
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(endless ? 3 : 0)}
        className="rounded-full border px-3 py-1 text-[11.5px] font-bold"
        style={endless ? { borderColor: "transparent", background: "var(--brand-2)", color: "#fff" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}
      >
        ♾ {t("p8set.endless")}
      </button>
      {!endless && <NumberBox value={value} onChange={(n) => onChange(Math.max(1, n))} min={1} max={20} suffix={t("p8set.moves")} />}
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
  const t = useT();
  return (
    <span
      title={t("p8set.alwaysOnTip")}
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1 text-[11.5px] font-bold text-[var(--ink-3)]"
    >
      <span aria-hidden>🔒</span> {t("p8set.alwaysOn")}
    </span>
  );
}

/**
 * How much a family may write in one field. Sits on the field itself rather
 * than in a table of its own: a list of numbers away from the things they
 * measure means checking two places to answer one question.
 */
function Limit({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const t = useT();
  return (
    <span className="inline-flex items-center gap-1" title={t("p8set.limitTip")}>
      <NumberBox value={value} onChange={onChange} min={20} max={2000} />
      <span className="text-[11px] text-[var(--ink-3)]">{t("p8set.chars")}</span>
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
  const t = useT();
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
              aria-label={t("p8set.removeItem", { name: it })}
              onClick={() => {
                if (warn && !confirm(t("p8set.removeItemConfirm", { name: it, warn }))) return;
                onChange(items.filter((_, j) => j !== i));
              }}
              className="px-1.5 text-[var(--ink-3)] hover:text-[var(--red,#e21d27)]"
            >
              ✕
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-[12px] text-[var(--ink-3)]">{t("p8set.listEmpty")}</div>
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
        <Button onClick={add}>＋ {t("p8set.add")}</Button>
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
  const t = useT();
  const w = useWord();
  const payLabel = (l: string) => tr(t, "p8set.pay_" + slug(l), w(l));
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
        <div key={m.label} className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
          <span className="text-[13px] font-semibold text-[var(--ink)]">{payLabel(m.label)}</span>
          {badge(m.tone, t("p8set.payBeh_" + m.tone))}
          <span className="hidden text-[11px] text-[var(--ink-3)] lg:inline">· {t("p8set.payNote_" + slug(m.label))}</span>
          <div className="ms-auto"><Toggle on={enabled.has(m.label)} onChange={(v) => toggle(m.label, v)} /></div>
        </div>
      ))}
      {customs.length > 0 && <div className="mt-2 text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{t("p8set.payOwn")}</div>}
      {customs.map((it) => (
        <div key={it} className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
          <Input value={it} onChange={(e) => onChange(items.map((x) => (x === it ? e.target.value : x)))} className="flex-1" />
          {badge("pending", t("p8set.payBeh_pending"))}
          <button type="button" aria-label={t("p8set.removeItem", { name: it })} onClick={() => { if (!confirm(t("p8set.payRemoveConfirm", { name: it }))) return; onChange(items.filter((x) => x !== it)); }} className="px-1.5 text-[var(--ink-3)] hover:text-[var(--red,#e21d27)]">✕</button>
        </div>
      ))}
      <div className="mt-1 flex gap-1.5">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCustom()} placeholder={t("p8set.payAddOwn")} className="flex-1" />
        <Button onClick={addCustom}>＋ {t("p8set.add")}</Button>
      </div>
    </div>
  );
}

// ── Seasons — just the names; listings pick their season in the listing builder ──
function SeasonsEditor({ items, onChange }: { items: Season[]; onChange: (next: Season[]) => void }) {
  const t = useT();
  const patch = (id: string, fn: (s: Season) => Season) => onChange(items.map((s) => (s.id === id ? fn(s) : s)));
  const remove = (name: string, id: string) => { if (confirm(t("p8set.seasonRemoveConfirm", { name }))) onChange(items.filter((s) => s.id !== id)); };
  const add = () => onChange([...items, { id: `s-${uid()}`, name: t("p8set.seasonNew") }]);
  const reset = () => { if (confirm(t("p8set.seasonResetConfirm"))) onChange(defaultSeasonNames()); };
  return (
    <div className="flex flex-col gap-1.5">
      <div className="rounded-lg border-s-4 border-[#2f6bd8] bg-[#eef4fd] px-3 py-2 text-[12px] text-[#1d3a8f]"><Rich k="p8set.seasonNote" slots={{}} /></div>
      {items.map((s) => (
        <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
          <Input value={s.name} onChange={(e) => patch(s.id, (x) => ({ ...x, name: e.target.value }))} placeholder={t("p8set.seasonName")} className="min-w-[160px] flex-1 font-semibold" />
          <button type="button" aria-label={t("p8set.removeItem", { name: s.name })} onClick={() => remove(s.name, s.id)} className="px-1.5 text-[var(--ink-3)] hover:text-[var(--red,#e21d27)]">✕</button>
        </div>
      ))}
      <div className="mt-1 flex flex-wrap gap-2">
        <Button sm onClick={add}>＋ {t("p8set.seasonAdd")}</Button>
        <Button sm variant="ghost" onClick={reset}>↺ {t("p8set.seasonReset")}</Button>
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
  const t = useT();
  const [draft, setDraft] = useState("");
  const WHO: [CancelReason["who"], string][] = [["provider", t("p8set.whoYou")], ["parent", t("p8set.whoParents")], ["both", t("p8set.whoBoth")]];
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
        <span className="flex-1">{t("p8set.rsnReason")}</span>
        <span className="w-[190px]">{t("p8set.rsnOfferedTo")}</span>
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
              aria-label={t("p8set.removeItem", { name: r.label })}
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="w-[22px] text-[var(--ink-3)] hover:text-[var(--red,#e21d27)]"
            >
              &#10005;
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-[12px] text-[var(--ink-3)]">
            {t("p8set.rsnEmpty")}
          </div>
        )}
      </div>
      <div className="flex gap-1.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={t("p8set.rsnPlaceholder")}
          className="flex-1"
        />
        <Button onClick={add}>&#65291; {t("p8set.add")}</Button>
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
  const t = useT();
  const { locale } = useI18n();
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
                placeholder={t("p8set.vSchemeName")}
                className="w-[190px]"
                maxLength={50}
              />
              <span className="min-w-0 flex-1 truncate text-[11.5px] text-[var(--ink-3)]">
                {filled.length
                  ? filled.map((d) => `${d.label}: ${d.value}`).join("  ·  ")
                  : t("p8set.vNotReg")}
              </span>
              <Button sm onClick={() => setOpenId(open ? null : v.id)}>{open ? t("p8set.done") : t("p8set.vDetails")}</Button>
              <button
                type="button"
                aria-label={t("p8set.removeItem", { name: v.name })}
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                className="w-[22px] text-[var(--ink-3)] hover:text-[var(--red,#e21d27)]"
              >
                &#10005;
              </button>
            </div>

            {open && (
              <div className="mt-3 border-t border-dashed border-[var(--line)] pt-3">
                <div className="mb-1.5 flex items-center gap-2 text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">
                  <span className="w-[190px]">{t("p8set.vWhatCall")}</span>
                  <span className="flex-1">{t("p8set.vWhatQuote")}</span>
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
                        aria-label={t("p8set.removeItem", { name: d.label })}
                        onClick={() => patch(i, (x) => ({ ...x, details: x.details.filter((_, n) => n !== k) }))}
                        className="w-[22px] text-[var(--ink-3)] hover:text-[var(--red,#e21d27)]"
                      >
                        &#10005;
                      </button>
                      {SCOPED_VOUCHER_LABELS.test(d.label) && (
                        <div className="flex w-full flex-wrap items-center gap-2 ps-1 text-[11px] text-[var(--ink-3)]">
                          <span className="font-bold uppercase tracking-wide">{t("p8set.vAppliesTo")}</span>
                          <select value={d.listingId ?? ""} onChange={(e) => patch(i, (x) => ({ ...x, details: x.details.map((y, n) => (n === k ? { ...y, listingId: e.target.value || null, ...(e.target.value ? { locationId: null } : {}) } : y)) }))} className="max-w-[220px] rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[12px]">
                            <option value="">{t("p8set.vAllListings")}</option>
                            {listings.map((l) => <option key={l.id} value={l.id}>{l.title || l.name || t("p8set.vListing")}</option>)}
                          </select>
                          <span>·</span>
                          <select value={d.locationId ?? ""} disabled={!!d.listingId} onChange={(e) => patch(i, (x) => ({ ...x, details: x.details.map((y, n) => (n === k ? { ...y, locationId: e.target.value || null } : y)) }))} className="max-w-[220px] rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[12px] disabled:opacity-50">
                            <option value="">{d.listingId ? t("p8set.vThatLoc") : t("p8set.vAllLocs")}</option>
                            {venues.map((vn) => <option key={vn.id} value={vn.id}>{vn.name}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <Button sm className="mt-2" onClick={() => patch(i, (x) => ({ ...x, details: [...x.details, { id: uid(), label: "", value: "" }] }))}>
                  &#65291; {t("p8set.vAddDetail")}
                </Button>
                <p className="mt-2 text-[11px] leading-snug text-[var(--ink-3)]"><Rich k="p8set.vTip" slots={{}} /></p>
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
          &#65291; {t("p8set.vAddScheme")}
        </Button>
        <span className="text-[11.5px] text-[var(--ink-3)]">
          {live === 0
            ? t("p8set.vNone")
            : pickPlural(t, locale, "p8set.vLive", live)}
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
  const t = useT();
  const patch = (i: number, fn: (g: RatioGroup) => RatioGroup) => onChange(groups.map((x, j) => (j === i ? fn(x) : x)));
  const num = (v: string, min: number) => Math.max(min, parseInt(v, 10) || min);
  const inp = "rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[12.5px]";
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr className="text-[10.5px] uppercase tracking-[0.04em] text-[var(--ink-3)]">
            <th className="px-2 py-1.5 text-start font-extrabold">{t("p8set.grpColour")}</th>
            <th className="px-2 py-1.5 text-start font-extrabold">{t("p8set.grpGroup")}</th>
            <th className="px-2 py-1.5 text-start font-extrabold">{t("p8set.grpAge")}</th>
            <th className="px-2 py-1.5 text-start font-extrabold">{t("p8set.grpRatio")}</th>
            <th className="px-2 py-1.5 text-start font-extrabold">{t("p8set.grpRoom")}</th>
            <th className="px-2 py-1.5" />
          </tr>
        </thead>
        <tbody>
          {groups.map((g, i) => (
            <tr key={g.id} className="border-t border-[var(--line)]">
              <td className="px-2 py-1.5">
                <input type="color" value={g.colour} onChange={(e) => patch(i, (x) => ({ ...x, colour: e.target.value }))} className="h-7 w-10 cursor-pointer rounded border border-[var(--line)] bg-transparent p-0.5" aria-label={t("p8set.grpColourAria", { name: g.name })} />
              </td>
              <td className="px-2 py-1.5">
                <input value={g.name} onChange={(e) => patch(i, (x) => ({ ...x, name: e.target.value }))} className={`${inp} w-[130px] font-bold`} placeholder={t("p8set.grpNamePh")} />
              </td>
              <td className="px-2 py-1.5">
                <span className="inline-flex items-center gap-1">
                  <input type="number" min={0} max={21} value={g.ageFrom} onChange={(e) => patch(i, (x) => ({ ...x, ageFrom: num(e.target.value, 0) }))} className={`${inp} w-[52px]`} />
                  <span className="text-[var(--ink-3)]">{t("p8set.grpTo")}</span>
                  <input type="number" min={0} max={21} value={g.ageTo} onChange={(e) => patch(i, (x) => ({ ...x, ageTo: num(e.target.value, 0) }))} className={`${inp} w-[52px]`} />
                  <span className="text-[var(--ink-3)]">{t("p8set.grpYrs")}</span>
                </span>
              </td>
              <td className="px-2 py-1.5">
                <span className="inline-flex items-center gap-1">1 :<input type="number" min={1} value={g.targetRatio} onChange={(e) => patch(i, (x) => ({ ...x, targetRatio: num(e.target.value, 1) }))} className={`${inp} w-[56px]`} /></span>
              </td>
              <td className="px-2 py-1.5">
                <input type="number" min={0} value={g.maxSize || ""} placeholder={t("p8set.grpNoCap")} onChange={(e) => patch(i, (x) => ({ ...x, maxSize: Math.max(0, parseInt(e.target.value, 10) || 0) }))} className={`${inp} w-[72px]`} />
              </td>
              <td className="px-2 py-1.5 text-end">
                <button type="button" onClick={() => onChange(groups.filter((_, j) => j !== i))} aria-label={t("p8set.removeItem", { name: g.name })} className="text-[16px] leading-none text-[var(--ink-3)] hover:text-[var(--red,#e21d27)]">×</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2.5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => onChange([...groups, { id: uid(), name: t("p8set.grpN", { n: groups.length + 1 }), colour: "#2f6bd8", ageFrom: 0, ageTo: 18, targetRatio: 8, maxSize: 24 }])}
          className="rounded-full border border-dashed border-[var(--line)] px-3 py-1 text-[12px] font-bold text-[var(--brand-ink,#1d3a8f)]"
        >
          ＋ {t("p8set.grpAdd")}
        </button>
        {groups.length === 0 && (
          <button type="button" onClick={() => onChange(DEFAULT_RATIO_GROUPS)} className="text-[12px] font-bold text-[var(--brand-ink,#1d3a8f)] underline">
            {t("p8set.grpStd")}
          </button>
        )}
        <span className="text-[11px] text-[var(--ink-3)]"><Rich k="p8set.grpLeave" slots={{}} /></span>
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
type NoticeT = (key: string, vars?: Record<string, string | number>) => string;
/** The notice-period choices in the active language: [hoursBefore, label][] groups, most used first. */
function noticeGroups(t: NoticeT, locale: string): { label: string; items: [number, string][] }[] {
  const hrs = (n: number) => pickPlural(t, locale, "p8set.nHours", n);
  const days = (n: number) => pickPlural(t, locale, "p8set.nDays", n);
  const wks = (n: number) => pickPlural(t, locale, "p8set.nWeeks", n);
  const common: [number, string][] = [
    [HOURS.twoWeeks, wks(2)],
    [HOURS.week, wks(1)],
    [HOURS.twoDays, hrs(48)],
    [HOURS.day, hrs(24)],
  ];
  return [
    { label: t("p8set.noticeMost"), items: common },
    { label: t("p8set.noticeHoursG"), items: Array.from({ length: 23 }, (_, i) => [i + 1, hrs(i + 1)] as [number, string]) },
    { label: t("p8set.noticeDaysG"), items: Array.from({ length: 6 }, (_, i) => [(i + 1) * 24, days(i + 1)] as [number, string]) },
    { label: t("p8set.noticeWeeksG"), items: Array.from({ length: 8 }, (_, i) => [(i + 1) * HOURS.week, wks(i + 1)] as [number, string]) },
  ];
}

/**
 * The refund rules, as rules.
 *
 * The wording underneath is generated live, so the provider can see exactly
 * what a parent will read as they change the numbers. That's the whole point
 * of the rewrite: prose typed separately from the rules drifts away from
 * them, and then the page promises one thing while the system does another.
 */
function PolicyList({ policies, onChange }: { policies: NamedPolicy[]; onChange: (v: NamedPolicy[]) => void }) {
  const t = useT();
  const { locale } = useI18n();
  const choices = noticeGroups(t, locale).flatMap((g) => g.items);
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
                  title={t("p8set.polDefaultTip")}
                  className="rounded-full bg-[var(--brand-soft)] px-2 py-[2px] text-[10px] font-extrabold text-[var(--brand-ink)]"
                >
                  {t("p8set.polDefault")}
                </span>
              )}
              <Input
                value={p.name}
                onChange={(e) => onChange(policies.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                placeholder={t("p8set.polNamePh")}
                className="w-[190px]"
                maxLength={40}
              />
              <span className="min-w-0 flex-1 text-[11.5px] text-[var(--ink-3)]">
                {sortBands(p.bands)
                  .map((b) => (b.hoursBefore > 0 ? t("p8set.polBand", { label: choices.find(([h]) => h === b.hoursBefore)?.[1] ?? pickPlural(t, locale, "p8set.nHours", b.hoursBefore), pct: b.refundPercent }) : t("p8set.polLater", { pct: b.refundPercent })))
                  .join("  ·  ")}
              </span>
              <Button sm onClick={() => setOpenId(open ? null : p.id)}>{open ? t("p8set.done") : t("p8set.polEditRules")}</Button>
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
  const t = useT();
  const { locale } = useI18n();
  const NOTICE_GROUPS = noticeGroups(t, locale);
  const NOTICE_CHOICES = NOTICE_GROUPS.flatMap((g) => g.items);
  const bands = sortBands(policy.bands);
  const tiers = bands.filter((b) => b.hoursBefore > 0);
  const floor = bands.find((b) => b.hoursBefore <= 0) ?? { hoursBefore: 0, refundPercent: 0 };

  const write = (nextTiers: RefundBand[], nextFloor: RefundBand) =>
    onChange({ ...policy, bands: [...sortBands(nextTiers), nextFloor] });

  // The floor is "less than your shortest notice period", so it says that
  // rather than "any later than that", which left the reader working out
  // later than *what*.
  const shortest = tiers.length ? tiers[tiers.length - 1].hoursBefore : 0;
  const shortestLabel = NOTICE_CHOICES.find(([h]) => h === shortest)?.[1] ?? pickPlural(t, locale, "p8set.nHours", shortest);
  const cell = "px-2 py-2";

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="text-[10.5px] uppercase tracking-[0.04em] text-[var(--ink-3)]">
              <th className={`${cell} text-start font-extrabold`}>{t("p8set.polNotice")}</th>
              <th className={`${cell} text-start font-extrabold`}>{t("p8set.polGetBack")}</th>
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
                    <span className="whitespace-nowrap text-[var(--ink-3)]">{t("p8set.polOrMore")}</span>
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
                <td className={`${cell} text-end`}>
                  <button
                    type="button"
                    aria-label={t("p8set.polRemoveRow")}
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
                <span className="font-semibold">{tiers.length ? t("p8set.polLessThan", { label: shortestLabel }) : t("p8set.polAnyNotice")}</span>
                <span className="ms-1.5 text-[11px] text-[var(--ink-3)]">{t("p8set.polIncluding")}</span>
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
          &#65291; {t("p8set.polAddRow")}
        </Button>
      </div>

      <div className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
        <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">
          {t("p8set.polParentsRead")}
        </div>
        <div className="text-[12.5px] leading-[1.55]">{policyWordingT(t, locale, { ...policy, wording: undefined })}</div>
        <div className="mt-2 text-[10.5px] leading-[1.45] text-[var(--ink-3)]">
          {t("p8set.polWritten")}
        </div>
      </div>
    </div>
  );
}

// ── Child questions ────────────────────────────────────────────────────────


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
  const t = useT();
  const { locale } = useI18n();
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
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="text-[10px] leading-none text-[var(--ink-3)] disabled:opacity-25" aria-label={t("p8set.moveUp")}>▲</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === questions.length - 1} className="text-[10px] leading-none text-[var(--ink-3)] disabled:opacity-25" aria-label={t("p8set.moveDown")}>▼</button>
              </div>

              <div className="min-w-[160px] flex-1">
                <div className="text-[13px] font-bold">{q.label || <span className="text-[var(--ink-3)]">{t("p8set.qUntitled")}</span>}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--ink-3)]">
                  <span>{t("p8set.qType_" + q.type)}</span>
                  {q.required && <span className="rounded-full bg-[var(--brand-soft)] px-1.5 font-bold text-[var(--brand-ink)]">{t("p8set.qMustAnswer")}</span>}
                  {q.ask === "every" && <span className="rounded-full bg-[var(--surface)] px-1.5 font-bold">{t("p8set.qEveryBooking")}</span>}
                  <span>· {scoped ? pickPlural(t, locale, "p8set.qListings", (q.scope as string[]).length) : t("p8set.vAllListings")}</span>
                  {(q.minAge !== undefined || q.maxAge !== undefined) && (
                    <span className="rounded-full bg-[var(--surface)] px-1.5 font-bold">
                      {q.minAge !== undefined && q.maxAge !== undefined
                        ? t("p8set.qAges", { min: q.minAge, max: q.maxAge })
                        : q.minAge !== undefined
                          ? t("p8set.qAgesMin", { min: q.minAge })
                          : t("p8set.qUnder", { n: (q.maxAge ?? 0) + 1 })}
                    </span>
                  )}
                  {q.hidden && <span className="rounded-full bg-[var(--surface)] px-1.5 font-bold">{t("p8set.qHidden")}</span>}
                </div>
              </div>

              <Toggle on={!q.hidden} onChange={(v) => patch(q.id, (x) => ({ ...x, hidden: !v }))} labels={[t("p8set.qAsking"), t("p8set.qHidden")]} />
              <Button sm onClick={() => setOpenId(open ? null : q.id)}>{open ? t("p8set.done") : t("p8set.edit")}</Button>
            </div>

            {open && (
              <div className="mt-3 border-t border-dashed border-[var(--line)] pt-3">
                <div className="grid gap-2.5 md:grid-cols-2">
                  <div>
                    <FieldLabel>{t("p8set.qQuestion")}</FieldLabel>
                    <Input
                      value={q.label}
                      onChange={(e) => patch(q.id, (x) => ({ ...x, label: e.target.value }))}
                      placeholder={t("p8set.qQuestionPh")}
                      className="w-full"
                      maxLength={80}
                    />
                  </div>
                  <div>
                    <FieldLabel>{t("p8set.qAnswerType")}</FieldLabel>
                    <Select
                      value={q.type}
                      onChange={(e) => patch(q.id, (x) => ({ ...x, type: e.target.value as QuestionType }))}
                      className="w-full"
                    >
                      <option value="text">{t("p8set.qType_text")}</option>
                      <option value="choice">{t("p8set.qType_choice")}</option>
                      <option value="yesno">{t("p8set.qType_yesno")}</option>
                    </Select>
                  </div>
                </div>

                <div className="mt-2.5">
                  <FieldLabel>{t("p8set.qHelper")}</FieldLabel>
                  <Input
                    value={q.help ?? ""}
                    onChange={(e) => patch(q.id, (x) => ({ ...x, help: e.target.value || undefined }))}
                    placeholder={t("p8set.qHelperPh")}
                    className="w-full"
                    maxLength={120}
                  />
                </div>

                {q.type === "text" && (
                  <div className="mt-2.5">
                    <FieldLabel>{t("p8set.qLongest")}</FieldLabel>
                    <NumberBox
                      value={q.maxLength ?? DEFAULT_QUESTION_LENGTH}
                      onChange={(n) => patch(q.id, (x) => ({ ...x, maxLength: n }))}
                      min={20}
                      max={2000}
                      suffix={t("p8set.qCharacters")}
                    />
                    <div className="mt-1 text-[10.5px] leading-[1.45] text-[var(--ink-3)]">
                      {t("p8set.qShortNote")}
                    </div>
                  </div>
                )}

                {q.type === "choice" && (
                  <div className="mt-2.5">
                    <FieldLabel>{t("p8set.qOptions")}</FieldLabel>
                    <ListEditor
                      items={q.options ?? []}
                      onChange={(options) => patch(q.id, (x) => ({ ...x, options }))}
                      placeholder={t("p8set.qAddOption")}
                    />
                  </div>
                )}

                <div className="mt-3">
                  <FieldLabel>{t("p8set.qWhenAsked")}</FieldLabel>
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      sm
                      variant={q.ask !== "every" ? "primary" : "default"}
                      onClick={() => patch(q.id, (x) => ({ ...x, ask: "once" }))}
                    >
                      {t("p8set.qOnce")}
                    </Button>
                    <Button
                      sm
                      variant={q.ask === "every" ? "primary" : "default"}
                      onClick={() => patch(q.id, (x) => ({ ...x, ask: "every" }))}
                    >
                      {t("p8set.qEveryBooking")}
                    </Button>
                  </div>
                  <div className="mt-1 text-[10.5px] leading-[1.45] text-[var(--ink-3)]">
                    {q.ask === "every"
                      ? t("p8set.qEveryNote")
                      : t("p8set.qOnceNote")}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-[12px] font-bold">{t("p8set.qMustBeAnswered")}</span>
                  <Toggle on={!!q.required} onChange={(v) => patch(q.id, (x) => ({ ...x, required: v }))} labels={[t("p8set.yes"), t("p8set.no")]} />
                </div>

                {q.type === "yesno" && (
                  <div className="mt-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[12px] font-bold"><Rich k="p8set.qIfNo" slots={{}} /></span>
                      <Toggle on={!!q.reviewIfNo} onChange={(v) => patch(q.id, (x) => ({ ...x, reviewIfNo: v || undefined }))} labels={[t("p8set.yes"), t("p8set.no")]} />
                    </div>
                    <div className="mt-1 text-[10.5px] leading-[1.45] text-[var(--ink-3)]">
                      {q.reviewIfNo
                        ? t("p8set.qIfNoOn")
                        : t("p8set.qIfNoOff")}
                    </div>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-[12px] font-bold">{t("p8set.qShowStaff")}</span>
                  <Toggle on={q.showOnRegister !== false} onChange={(v) => patch(q.id, (x) => ({ ...x, showOnRegister: v }))} labels={[t("p8set.yes"), t("p8set.no")]} />
                  <span className="text-[11.5px] text-[var(--ink-3)]">{t("p8set.qShowStaffNote")}</span>
                </div>

                <div className="mt-3">
                  <FieldLabel>{t("p8set.qOnlyAge")}</FieldLabel>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Input
                      type="number"
                      min={0}
                      max={18}
                      value={q.minAge ?? ""}
                      placeholder={t("p8set.qAny")}
                      onChange={(e) => patch(q.id, (x) => ({ ...x, minAge: e.target.value === "" ? undefined : Math.max(0, Math.min(18, parseInt(e.target.value, 10) || 0)) }))}
                      className="w-[74px]"
                    />
                    <span className="text-[12px] text-[var(--ink-3)]">{t("p8set.grpTo")}</span>
                    <Input
                      type="number"
                      min={0}
                      max={18}
                      value={q.maxAge ?? ""}
                      placeholder={t("p8set.qAny")}
                      onChange={(e) => patch(q.id, (x) => ({ ...x, maxAge: e.target.value === "" ? undefined : Math.max(0, Math.min(18, parseInt(e.target.value, 10) || 0)) }))}
                      className="w-[74px]"
                    />
                    {(q.minAge !== undefined || q.maxAge !== undefined) && (
                      <Button sm onClick={() => patch(q.id, (x) => ({ ...x, minAge: undefined, maxAge: undefined }))}>
                        {t("p8set.qAskAnyAge")}
                      </Button>
                    )}
                  </div>
                  <div className="mt-1 text-[10.5px] leading-[1.45] text-[var(--ink-3)]">
                    {q.minAge === undefined && q.maxAge === undefined
                      ? t("p8set.qAgeEvery")
                      : q.minAge !== undefined && q.maxAge !== undefined
                        ? t("p8set.qAgeBoth", { min: q.minAge, max: q.maxAge })
                        : q.minAge !== undefined
                          ? t("p8set.qAgeMin", { min: q.minAge })
                          : t("p8set.qAgeMax", { max: q.maxAge ?? 0 })}
                  </div>
                </div>

                <div className="mt-3">
                  <FieldLabel>{t("p8set.qAskedOn")}</FieldLabel>
                  <div className="mb-1.5 flex gap-1.5">
                    <Button sm variant={q.scope === "all" ? "primary" : "default"} onClick={() => patch(q.id, (x) => ({ ...x, scope: "all" }))}>
                      {t("p8set.vAllListings")}
                    </Button>
                    <Button sm variant={scoped ? "primary" : "default"} onClick={() => patch(q.id, (x) => ({ ...x, scope: scoped ? (x.scope as string[]) : [] }))}>
                      {t("p8set.qChosenListings")}
                    </Button>
                  </div>
                  {scoped && (
                    <div className="flex flex-wrap gap-1.5">
                      {listings.length === 0 && (
                        <span className="text-[12px] text-[var(--ink-3)]">{t("p8set.qNoListings")}</span>
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
                    {t("p8set.qHideNote")}
                  </span>
                  <Button
                    sm
                    variant="danger"
                    onClick={() => {
                      if (!confirm(t("p8set.qDeleteConfirm", { name: q.label || t("p8set.qThis") }))) return;
                      onChange(questions.filter((x) => x.id !== q.id));
                      setOpenId(null);
                    }}
                  >
                    {t("p8set.delete")}
                  </Button>
                </div>

                <div className="mt-2 text-[10.5px] text-[var(--ink-3)]">
                  <Rich k="p8set.qStoredAs" slots={{ key: <code>answers.{answerKey(q)}</code> }} />
                  {q.replaces && <> <Rich k="p8set.qReplaces" slots={{ field: <code>{q.replaces}</code> }} /></>}
                </div>
              </div>
            )}
          </div>
        );
      })}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={add}>＋ {t("p8set.qAdd")}</Button>
        <Button onClick={addToilet}>{hasToilet ? `🚼 ${t("p8set.qToiletAdded")}` : `🚼 ${t("p8set.qToiletAdd")}`}</Button>
      </div>
      {!hasToilet && <p className="mt-1.5 text-[11.5px] text-[var(--ink-3)]"><Rich k="p8set.qToiletNote" slots={{}} /></p>}
    </div>
  );
}

// ── The screen ─────────────────────────────────────────────────────────────

export function SetupApp() {
  const t = useT();
  const tx = t; // alias for blocks whose .map callback shadows `t`
  const { locale } = useI18n();
  const { settings, questions, loading, save, error } = useSettings();
  const [tmplPreview, setTmplPreview] = useState(false);
  const [poPreview, setPoPreview] = useState(false);
  const portal = ((usePathname().split("/")[1] || "freelancer")) as PortalKey;
  // Head office viewing the whole network ("all franchises") only configures the
  // network-level settings — the day-to-day operational tabs (registers, meals,
  // medication, listings…) belong to each franchise and to head office's OWN
  // locations, so they only appear once you drill into a specific scope.
  const hoScope = useHoScope();
  const hoCombined = portal === "company" && !!peekMe()?.hasFranchises && !hoScope;
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
  const backLabel = fromView ? (FROM_LABELS[fromView] ? navLabel(t, FROM_LABELS[fromView]) : fromView.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase())) : "";
  const VALID_TABS: Tab[] = ["features", "company", "branding", "people", "staff", "announcements", "roles", "reviews", "learning", "hub", "meals", "medication", "safeguarding", "registers", "trips", "calendar", "inventory", "groups", "cancel", "defaults", "bookings", "seasons", "vouchers", "marketplace", "refer", "memberships", "notifications", "money"];
  const [tab, setTab] = useState<Tab>(() => (initialTab && (VALID_TABS as string[]).includes(initialTab) ? (initialTab as Tab) : "features"));
  // The set-up checklist links to ?tab=cancel&welcome=1: the first visit shows the chosen policy and a one-tap "keep and move on" instead of the full editor.
  const [cancelWelcome, setCancelWelcome] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("welcome") === "1");
  const [listings, setListings] = useState<{ id: string; title: string }[]>([]);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // An age-gated question makes a date of birth compulsory whatever the
  // toggle below says — see dobRequired().
  const dobLock = dobRequired(settings, questions);

  // The scope picker needs the operator's own listings — never the public
  // browse feed, which would offer other providers' listings to scope to.
  useEffect(() => {
    apiGet<{ id: string; title?: string; name?: string }[]>("/api/listings?mine=1")
      .then((rows) => setListings(rows.map((r) => ({ id: r.id, title: r.title || r.name || tNow("p8set.untitledListing") }))))
      .catch(() => setListings([]));
  }, []);

  // Teaching Hub tab: the year-group reminder needs the hub roster, which nothing
  // else on this page otherwise fetches — load it lazily, only once that tab is
  // actually opened (not on every Setup visit for every other tab).
  const me = peekMe();
  const hubTenantId = me?.tenantId ?? null;
  const hubQs = hubTenantId ? `?tenantId=${encodeURIComponent(hubTenantId)}` : "";
  const [hubStudents, setHubStudents] = useState<Student[] | null>(null);
  const loadHubStudents = useCallback(() => {
    apiGet<Student[]>(`/api/learning-hub/students${hubQs}`).then(setHubStudents).catch(() => setHubStudents([]));
  }, [hubQs]);
  useEffect(() => { if (tab === "hub" && hubStudents === null) loadHubStudents(); }, [tab, hubStudents, loadHubStudents]);

  const cred = useCredentials([]);
  const credTeam = useTeam();
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
      setSavedAt(new Date().toLocaleTimeString(dl(), { hour: "2-digit", minute: "2-digit" })),
    );
  };
  const setQuestions = (next: ChildQuestion[]) => {
    void save({ questions: next }).then(() =>
      setSavedAt(new Date().toLocaleTimeString(dl(), { hour: "2-digit", minute: "2-digit" })),
    );
  };

  if (loading)
    return (
      <OperatorPage title={t("setup.setupAndFeatures")} icon="⚙️">
        <span className="text-[var(--ink-3)]">{t("setup.loading")}</span>
      </OperatorPage>
    );

  const ALL_TABS: [Tab, string][] = [
    ["notifications", `🔔 ${t("setup.tabNotifications")}`],
    ["features", t("setup.tabFeatures")],
    ["company", t("setup.tabCompanySetup")],
    ["seasons", t("setup.tabSeasons")],
    ["branding", t("setup.tabBranding")],
    ["people", t("setup.tabChildQuestions")],
    ["staff", t("setup.tabStaffWorkforce")],
    ["announcements", t("setup.tabAnnouncements")],
    ["reviews", t("setup.tabReviews")],
    ...(portal === "company" ? [["roles", t("setup.tabRolesPermissions")] as [Tab, string]] : []),
    ["learning", t("setup.tabLearning")],
    // The tutoring Learning Hub's own settings — only once the hub is switched on.
    ...(!featureOff(settings.features, "learninghub") ? [["hub", t("hubshell.lbl_teaching_hub")] as [Tab, string]] : []),
    ["meals", t("setup.tabMeals")],
    ["medication", t("setup.tabMedication")],
    ["safeguarding", t("setup.tabSafeguarding")],
    ["registers", t("setup.tabRegister")],
    ["trips", t("setup.tabTripsVisits")],
    ["calendar", t("setup.tabCalendar")],
    ["inventory", t("setup.tabInventory")],
    ["groups", t("setup.tabAgeGroupsRooms")],
    ["cancel", t("setup.tabCancellationsRefunds")],
    ["defaults", t("setup.tabNewListingDefaults")],
    ["bookings", t("setup.tabPayments")],
    ["money", t("setup.tabMoney")],
    ["vouchers", t("setup.tabChildcareVouchers")],
    ["marketplace", t("setup.tabMarketplace")],
    ["refer", t("setup.tabReferFriend")],
    ["memberships", t("setup.tabMemberships")],
  ];
  // In the head-office "all franchises" view keep only the handful of settings
  // that head office actually owns — company identity, branding, its own staff &
  // roles, and money. Everything else (operational, per-site, or per-franchise)
  // is hidden until a scope is picked.
  const HO_COMBINED_KEEP: Tab[] = ["company", "branding", "roles", "money"];
  const TABS: [Tab, string][] = hoCombined ? ALL_TABS.filter(([k]) => HO_COMBINED_KEEP.includes(k)) : ALL_TABS;
  // If a deep-link (or a leftover selection) lands on a tab that's hidden in this
  // view, fall back to the first visible one so the page never renders blank.
  const activeTab: Tab = TABS.some(([k]) => k === tab) ? tab : (TABS[0]?.[0] ?? "features");

  return (
    <OperatorPage
      title={t("setup.setupAndFeatures")}
      icon="⚙️"
      lede={t("setup.setupLede")}
      actions={
        <>
          {fromView && (
            <Link href={`/${portal}/${fromView}`} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface)] px-3.5 py-1.5 text-[12px] font-extrabold text-[#2f5fd0] shadow-sm transition hover:brightness-95">
              <span className="inline-block text-[14px] leading-none rtl:-scale-x-100">‹</span>{t("setup.backTo", { label: backLabel })}
            </Link>
          )}
          <span className="rounded-full bg-white/15 px-3 py-1 text-[11.5px] font-semibold text-white backdrop-blur-sm">
            {error ? <span className="font-bold text-[#ffd5d5]">{error}</span> : savedAt ? `✓ ${t("setup.savedAt", { time: savedAt })}` : t("setup.changesSaveAsYouGo")}
          </span>
        </>
      }
    >
      <HowItWorks
        video={t("setup.howItWorksVideo")}
        minutes="2 min"
      >
        <p className="mb-2">
          {t("setup.howItWorksP1")}
        </p>
        <p>
          {t("setup.howItWorksP2")}
        </p>
      </HowItWorks>

      {/* A franchise's settings are stored in its OWN library document
          (`libraries/{tenantId}__fr__{franchiseId}`), seeded from head office and
          then diverging. Since 12 Sept the server reads a franchise's OWN copy
          (server/src/lib/tenantLibrary.ts) for everything that enforces or
          decides something: medication gates, trips consent + who can plan,
          safeguarding notifications, staff/rota compliance, cancellation
          policies (refunds), meals ordering + cut-off, the customer pages'
          venues/add-ons/staff, and Setup → Notifications. What still runs on
          head office's copy: marketing/automatic emails (branding, reminders),
          referrals, memberships and reviews. Say so — precisely. */}
      {portal === "franchise" && (
        <div className="mb-3 rounded-xl border border-[#f0d9a8] bg-[#fdf6e6] px-4 py-3 text-[12.5px] leading-[1.6] text-[#7a5b06]">
          <Rich k="p8set.frBanner" slots={{}} />
        </div>
      )}

      <TabStrip tabs={TABS} value={activeTab} onChange={setTab} accent="notifications" />
      {portal === "franchise" && (
        <div data-ui="settings-owner" className="mb-2 inline-flex items-center rounded-full px-3 py-1 text-[11.5px] font-extrabold" style={settingsOwner(activeTab) === "headOffice" ? { background: "#fdf0e3", color: "#b45309" } : { background: "#e2f4ea", color: "#0f7a43" }}>
          {settingsOwner(activeTab) === "headOffice" ? t("p9jr.setByHeadOffice") : t("p9jr.setYours")}
        </div>
      )}

      {activeTab === "company" && (
        <Section title={t("setup.companySetup")} lede={t("setup.companySetupLede")}>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div><FieldLabel>{t("setup.displayName")}</FieldLabel><Input value={settings.providerName ?? ""} placeholder="Sunshine Coaching" onChange={(e) => set("providerName", e.target.value)} className="w-full" /></div>
            <div><FieldLabel>{t("setup.showYourNameAs")}</FieldLabel><Select value={settings.providerNameMode ?? "business"} onChange={(e) => {
              // Switching what families see you as fills the display name with
              // that name — the choice used to change only a label (d1s4).
              // (One save with both fields — two set() calls would overwrite each other.)
              const mode = e.target.value as "person" | "business";
              const saveBoth = (name?: string) => void save({ settings: { ...settings, providerNameMode: mode, ...(name ? { providerName: name } : {}) } }).then(() => setSavedAt(new Date().toLocaleTimeString(dl(), { hour: "2-digit", minute: "2-digit" })));
              if (mode === "business") saveBoth((settings.billing as { businessName?: string } | undefined)?.businessName?.trim());
              else void apiGet<{ name?: string }>("/api/account").then((a) => saveBoth(a?.name?.trim())).catch(() => saveBoth());
            }} className="w-full"><option value="business">{t("setup.businessName")}</option><option value="person">{t("setup.myOwnName")}</option></Select></div>
            {([
              ["businessName", t("p8set.coLegal"), "Little Kickers Ltd"],
              ["email", t("p8set.coEmail"), "hello@yourbiz.co.uk"],
              ["phone", t("p8set.coPhone"), "07700 900000"],
              ["address", t("p8set.coAddress"), "12 High St, Townsville, AB1 2CD"],
              ["vatNumber", t("p8set.coVat"), "GB123456789"],
              ["companyReg", t("p8set.coReg"), "133950"],
            ] as const).map(([k, label, ph]) => (
              <div key={k}><FieldLabel>{label}</FieldLabel><Input value={settings.billing?.[k] ?? ""} placeholder={ph} onChange={(e) => void save({ settings: { ...settings, billing: { ...(settings.billing ?? {}), [k]: e.target.value } } })} className="w-full" /></div>
            ))}
            <label className="col-span-full mt-1 flex cursor-pointer items-start gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 text-[12.5px]">
              <input type="checkbox" className="mt-0.5 h-4 w-4" checked={(settings.billing as { showAddressPublicly?: boolean } | undefined)?.showAddressPublicly === true}
                onChange={(e) => void save({ settings: { ...settings, billing: { ...(settings.billing ?? {}), showAddressPublicly: e.target.checked } as typeof settings.billing } })} />
              <span><b>{t("p9tx.showAddrTitle")}</b><br /><span className="text-[var(--ink-3)]">{t("p9tx.showAddrNote")}</span></span>
            </label>
          </div>
        </Section>
      )}

      {activeTab === "branding" && (
        <Section title={t("setup.branding")} lede={t("setup.brandingLede")}>
          <Row label={t("setup.logo")} hint={t("setup.logoHint")}>
            <div>
            <div className="flex items-center gap-2">
              {settings.billing?.logoUrl && <img src={settings.billing.logoUrl} alt={t("p8set.logoAlt")} className="h-9 max-w-[120px] rounded border border-[var(--line)] object-contain" />}
              <label className="cursor-pointer rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-bold text-[#1d3a8f]">⬆ {t("setup.upload")}<input type="file" accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp,image/gif,image/bmp,image/avif,image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { const dataUrl = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error(t("p8set.logoReadErr"))); r.readAsDataURL(f); }); const payload = dataUrl.startsWith("data:image/") ? await compressLogo(dataUrl) : dataUrl; const { url } = await api<{ url: string }>("/api/uploads", { method: "POST", body: JSON.stringify({ dataUrl: payload }) }); await save({ settings: { ...settings, billing: { ...(settings.billing ?? {}), logoUrl: url } } }); } catch (err) { alert(err instanceof Error ? t("p8set.logoFailed", { msg: err.message }) : t("p8set.logoFailedGeneric")); } e.target.value = ""; }} /></label>
              {settings.billing?.logoUrl && <button type="button" onClick={() => void save({ settings: { ...settings, billing: { ...(settings.billing ?? {}), logoUrl: "" } } })} className="text-[11.5px] font-bold text-[var(--ink-3)]">{t("setup.remove")}</button>}
            </div>
            <div className="mt-1.5 text-[11px] text-[var(--ink-3)]">{t("setup.logoFormatsNote")}</div>
            </div>
          </Row>
          {BRAND_KEYS.map((k, i) => (
            <Row key={k} label={t(brandLabelKey(k))} hint={i === 0 ? t("setup.accentColourHint") : i === 1 ? t("p8lst.brandHint") : undefined}>
              <BrandSwatches testId={"brand-colour-" + (i + 1)} value={settings[k] ?? (i === 0 ? "#2f6bd8" : undefined)} onPick={(c) => set(k, c)} onClear={i === 0 ? undefined : () => set(k, undefined)} />
            </Row>
          ))}
        </Section>
      )}

      {activeTab === "staff" && (
        <Section title={t("setup.staffWorkforce")} lede={t("setup.staffWorkforceLede")}>
          {portal === "company" && (
            <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-[#f3d98a] bg-[#fdf6e3] px-4 py-3">
              <span className="text-[12.5px] leading-relaxed text-[#7a5a12]">
                <Rich k="p8set.staffRolesBanner" slots={{}} />
              </span>
              <button type="button" onClick={() => setTab("roles")} className="ms-auto flex-none rounded-full bg-[#1d3a8f] px-4 py-1.5 text-[12.5px] font-extrabold text-white hover:bg-[#16306e]">{t("setup.openRolesPermissions")} <span className="inline-block rtl:-scale-x-100">→</span></button>
            </div>
          )}
          <Row label={t("setup.whoAssignsStaff")} hint={t("setup.whoAssignsStaffHint")}>
            <Toggle on={settings.staff?.assignByLeads ?? false} onChange={(v) => set("staff", { ...settings.staff, assignByLeads: v })} labels={[t("setup.leadsOnly"), t("setup.anyone")]} />
          </Row>
          <Row label={t("setup.requireDBS")} hint={t("setup.requireDBSHint")} note={t("setup.enforcementBackend")}>
            <Toggle on={settings.staff?.requireDBS ?? true} onChange={(v) => set("staff", { ...settings.staff, requireDBS: v })} labels={[t("setup.yes"), t("setup.no")]} />
          </Row>
          <Row label={t("setup.requireCerts")} hint={t("setup.requireCertsHint")} note={t("setup.enforcementBackend")}>
            <Toggle on={settings.staff?.requireCompliance ?? true} onChange={(v) => set("staff", { ...settings.staff, requireCompliance: v })} labels={[t("setup.yes"), t("setup.no")]} />
          </Row>
          <Row label={t("setup.defaultRatio")} hint={t("setup.defaultRatioHint")}>
            <Input type="number" min={1} value={settings.staff?.defaultRatioTarget ?? 8} onChange={(e) => set("staff", { ...settings.staff, defaultRatioTarget: Number(e.target.value) || 1 })} className="w-24" />
          </Row>
          <div className="mt-3"><FieldLabel>{t("setup.inviteNote")}</FieldLabel><Input value={settings.staff?.inviteMessage ?? ""} placeholder={t("setup.inviteNotePlaceholder")} onChange={(e) => set("staff", { ...settings.staff, inviteMessage: e.target.value })} className="w-full" /></div>
        </Section>
      )}

      {activeTab === "announcements" && (
        <Section title={t("setup.announcements")} lede={t("setup.announcementsLede")}>
          <Row label={t("setup.staffBoard")} hint={t("setup.staffBoardHint")}>
            <Toggle on={settings.announcements?.enabled ?? true} onChange={(v) => set("announcements", { ...settings.announcements, enabled: v })} labels={[t("setup.on"), t("setup.off")]} />
          </Row>
          <Row label={t("setup.letLeadsPost")} hint={t("setup.letLeadsPostHint")}>
            <Toggle on={settings.announcements?.leadsCanPost ?? true} onChange={(v) => set("announcements", { ...settings.announcements, leadsCanPost: v })} labels={[t("setup.leadsToo"), t("setup.hoOnly")]} />
          </Row>
          <Row label={t("setup.requireAck")} hint={t("setup.requireAckHint")} note={t("setup.auditBackend")}>
            <Toggle on={settings.announcements?.requireAck ?? false} onChange={(v) => set("announcements", { ...settings.announcements, requireAck: v })} labels={[t("setup.yes"), t("setup.no")]} />
          </Row>
          <Row label={t("setup.keepOnDashboard")} hint={t("setup.keepOnDashboardHint")}>
            <div className="flex items-center gap-2"><Input type="number" min={1} max={14} value={settings.announcements?.dashboardDays ?? 1} onChange={(e) => set("announcements", { ...settings.announcements, dashboardDays: Math.min(14, Math.max(1, Number(e.target.value) || 1)) })} className="w-20" /><span className="text-[12.5px] text-[var(--ink-3)]">{t("setup.days")}</span></div>
          </Row>
          <Row label={t("setup.defaultAudience")} hint={t("setup.defaultAudienceHint")}>
            <Toggle on={(settings.announcements?.defaultAudience ?? "all") === "all"} onChange={(v) => set("announcements", { ...settings.announcements, defaultAudience: v ? "all" : "listing" })} labels={[t("setup.allStaff"), t("setup.perListing")]} />
          </Row>
          <Row label={t("setup.startImportant")} hint={t("setup.startImportantHint")}>
            <Toggle on={settings.announcements?.defaultImportant ?? false} onChange={(v) => set("announcements", { ...settings.announcements, defaultImportant: v })} labels={[t("setup.yes"), t("setup.no")]} />
          </Row>
        </Section>
      )}

      {activeTab === "reviews" && (() => {
        const rv = settings.reviews ?? {};
        // Default the selection from any config already present.
        const selected = rv.sources ?? ([...(rv.googlePlaceId || rv.googleReviewUrl ? ["google"] : []), ...(rv.trustpilotBusinessUnitId ? ["trustpilot"] : [])] as ("google" | "trustpilot")[]);
        const has = (s: "google" | "trustpilot") => selected.includes(s);
        const toggleSrc = (s: "google" | "trustpilot") => set("reviews", { ...rv, sources: has(s) ? selected.filter((x) => x !== s) : [...selected, s] });
        // Accept anything they copy — a ChIJ Place ID, a review/maps link, or a
        // Google search/maps URL — and pull out the right identifier.
        const parseGoogle = (v: string): { googlePlaceId: string; googleReviewUrl: string } => {
          const s = v.trim();
          if (!s) return { googlePlaceId: "", googleReviewUrl: "" };
          if (/^ChIJ[\w-]+$/.test(s)) return { googlePlaceId: s, googleReviewUrl: "" };
          const wr = s.match(/writereview\?placeid=([\w-]+)/i); if (wr) return { googlePlaceId: wr[1], googleReviewUrl: "" };
          const pid = s.match(/place_id[:=]([\w-]{20,})/i); if (pid) return { googlePlaceId: pid[1], googleReviewUrl: "" };
          const cid = s.match(/[?&#]cid=(\d+)/); if (cid) return { googlePlaceId: "", googleReviewUrl: `https://www.google.com/maps?cid=${cid[1]}` };
          const hex = s.match(/(?:lrd=|!1s)0x[0-9a-f]+:0x([0-9a-f]+)/i); if (hex) { try { return { googlePlaceId: "", googleReviewUrl: `https://www.google.com/maps?cid=${BigInt("0x" + hex[1]).toString()}` }; } catch { /* fall through */ } }
          if (/^https?:\/\//.test(s)) return { googlePlaceId: "", googleReviewUrl: s };
          return { googlePlaceId: s, googleReviewUrl: "" };
        };
        return (
        <Section title={t("setup.reviews")} lede={t("setup.reviewsLede")}>
          <div className="mb-1 text-[12.5px] font-extrabold text-[var(--ink)]">{t("setup.howCollectReviews")}</div>
          <p className="mb-2.5 text-[11.5px] text-[var(--ink-3)]">{t("setup.bothCompliant")}</p>
          <div className="mb-4 grid gap-2.5 sm:grid-cols-2">
            {([
              { k: "inhouse", icon: "🛡️", title: t("p8set.rvInhouseTitle"), tag: t("p8set.rvInhouseTag"), benefits: [t("p8set.rvInhouseB1"), t("p8set.rvInhouseB2"), t("p8set.rvInhouseB3"), t("p8set.rvInhouseB4")] },
              { k: "external", icon: "🌟", title: t("p8set.rvExtTitle"), tag: t("p8set.rvExtTag"), benefits: [t("p8set.rvExtB1"), t("p8set.rvExtB2"), t("p8set.rvExtB3"), t("p8set.rvExtB4")] },
            ] as { k: "inhouse" | "external"; icon: string; title: string; tag: string; benefits: string[] }[]).map((o) => {
              const on = (rv.captureMode ?? "inhouse") === o.k;
              return (
                <button key={o.k} type="button" onClick={() => set("reviews", { ...rv, captureMode: o.k })} className={"rounded-xl border-2 p-3.5 text-start transition " + (on ? "border-[#C6D0E6] bg-[#E8EEFD]" : "border-[var(--line)] bg-[var(--surface)] hover:border-[#E4E9F5]")}>
                  <div className="flex items-center gap-2">
                    <span className="text-[18px]">{o.icon}</span>
                    <span className="text-[13.5px] font-extrabold text-[var(--ink)]">{o.title}</span>
                    <span className={"ms-auto rounded-full px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wide " + (on ? "bg-[#1d3a8f] text-white" : "bg-[var(--panel)] text-[var(--ink-3)]")}>{on ? t("p8set.rvSelected") : o.tag}</span>
                  </div>
                  <ul className="mt-2 flex flex-col gap-1">
                    {o.benefits.map((b) => <li key={b} className="flex gap-1.5 text-[11.5px] leading-[1.4] text-[var(--ink-2)]"><span className="flex-none text-[#0f7a43]">✓</span>{b}</li>)}
                  </ul>
                </button>
              );
            })}
          </div>

          <div className="mb-1 text-[12.5px] font-extrabold text-[var(--ink)]">{t("setup.whichReviewSites")}</div>
          <p className="mb-2.5 text-[11.5px] text-[var(--ink-3)]">{t("setup.whichReviewSitesHint")}</p>
          <div className="mb-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eef4fd] px-3 py-1.5 text-[12.5px] font-bold text-[#1d3a8f]"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "#1d3a8f" }} />{t("p8set.rvInhouseOn")}</span>
            {([["google", "Google", "#ea4335"], ["trustpilot", "Trustpilot", "#00b67a"]] as [("google" | "trustpilot"), string, string][]).map(([k, label, col]) => (
              <button key={k} type="button" onClick={() => toggleSrc(k)} className={"inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-bold transition " + (has(k) ? "border-transparent text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] hover:bg-[var(--panel)]")} style={has(k) ? { background: col } : undefined}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: has(k) ? "#fff" : col }} />{has(k) ? `✓ ${label}` : label}
              </button>
            ))}
          </div>

          {has("google") && (() => {
            type Place = { id: string; label: string; placeId?: string; reviewUrl?: string };
            const places: Place[] = rv.googlePlaces?.length
              ? rv.googlePlaces
              : [{ id: "loc1", label: "", placeId: rv.googlePlaceId || "", reviewUrl: rv.googleReviewUrl || "" }];
            const writePlaces = (list: Place[]) => {
              const first = list[0];
              set("reviews", { ...rv, googlePlaces: list, googlePlaceId: first?.placeId || "", googleReviewUrl: first?.reviewUrl || "" });
            };
            const patch = (id: string, p: Partial<Place>) => writePlaces(places.map((x) => (x.id === id ? { ...x, ...p } : x)));
            const multi = places.length > 1;
            const connected = (p: Place) => !!(p.placeId || p.reviewUrl);
            const precise = (p: Place) => !!p.placeId || /writereview/i.test(p.reviewUrl || ""); // true one-tap star box (ChIJ) vs listing link
            const FINDER = "https://developers.google.com/maps/documentation/javascript/examples/places-placeid-finder";
            return (<>
              <div className="mb-2 mt-1 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide text-[#ea4335]">Google{multi && <span className="rounded-full bg-[#fdece9] px-2 py-0.5 text-[9.5px] font-black tracking-wide text-[#b3261e]">{pickPlural(t, locale, "p8set.rvLocations", places.length)}</span>}</div>

              {/* Grab the Place ID from Google's finder — a visual shows exactly what to copy. */}
              <div className="mb-3 rounded-xl border border-[#f6d3cd] bg-[#fdf3f1] p-3.5">
                <div className="mb-2 flex flex-wrap items-center gap-2.5">
                  <a href={FINDER} target="_blank" rel="noopener noreferrer" className="rounded-full bg-[#ea4335] px-3.5 py-1.5 text-[12px] font-extrabold text-white shadow-sm transition hover:brightness-110">{t("p8set.rvGetPlaceId")}</a>
                  <span className="text-[12px] font-extrabold text-[#b3261e]">{t("p8set.rvThenCopy")}</span>
                </div>
                <ol className="ms-4 list-decimal space-y-0.5 text-[12px] leading-relaxed text-[#7a2a22]">
                  <li><Rich k="p8set.rvStep1" slots={{}} /></li>
                  <li><Rich k="p8set.rvStep2" slots={{}} /></li>
                  <li>{t("p8set.rvStep3")}</li>
                </ol>
                {/* Visual: a mock of Google's info window, with the Place ID highlighted. */}
                <div className="mt-2.5 flex flex-wrap items-center gap-3">
                  <div className="relative w-[340px] max-w-full rounded-md border border-[#E4E9F5] bg-[var(--surface)] p-2.5 shadow-[0_4px_16px_rgba(0,0,0,.14)]">
                    <div className="absolute end-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-sm text-[12px] text-[#70757a]">✕</div>
                    <div className="text-[12.5px] font-bold text-[#3c4043]">Kings Camps - Sheffield</div>
                    <div className="mt-1 text-[11.5px] text-[#3c4043]"><span className="font-bold">Place ID:</span> <mark className="rounded bg-[#fff2a8] px-1 py-0.5 font-mono text-[11px] font-bold text-[#7a2a22] ring-1 ring-[#efcf3d]">ChIJSbBEmHOCeUgRTzxu9F_YMUg</mark></div>
                    <div className="mt-1 text-[10.5px] text-[#70757a]">High School, 10 Rutland Park, Broomhall, Sheffield S10 2PE, UK</div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[12px] font-black text-[#0f7a43]"><span className="text-[16px]">👈</span> {t("p8set.rvCopyThis")}</div>
                </div>
                <p className="mt-2 text-[10.5px] text-[#9a5148]"><Rich k="p8set.rvSydney" slots={{}} /></p>
              </div>

              <div className="mb-3 flex flex-col gap-2.5">
                {places.map((p, i) => (
                  <div key={p.id} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      {multi ? (
                        <input value={p.label} placeholder={t("p8set.rvLocPh", { n: i + 1 })} onChange={(e) => patch(p.id, { label: e.target.value })} className="min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12.5px] font-bold text-[var(--ink)]" />
                      ) : (
                        <span className="flex-1 text-[12px] font-extrabold text-[var(--ink-2)]">{t("p8set.rvYourListing")}</span>
                      )}
                      {multi && <button type="button" onClick={() => writePlaces(places.filter((x) => x.id !== p.id))} className="flex-none rounded-full border border-[var(--line)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--ink-3)] transition hover:bg-[var(--panel)]" aria-label={t("p8set.rvRemoveLoc")}>✕</button>}
                    </div>
                    <input value={p.placeId || p.reviewUrl || ""} placeholder={t("p8set.rvPastePh")} onChange={(e) => { const g = parseGoogle(e.target.value); patch(p.id, { placeId: g.googlePlaceId, reviewUrl: g.googleReviewUrl }); }} className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12.5px] text-[var(--ink)]" />
                    {connected(p) && <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-[#0f7a43]">{t(precise(p) ? "p8set.rvConnPrecise" : "p8set.rvConnLink", { label: multi && p.label ? ` — ${p.label}` : "" })}<button type="button" onClick={() => patch(p.id, { placeId: "", reviewUrl: "" })} className="text-[var(--ink-3)] underline hover:text-[var(--ink)]">{t("p8set.clear")}</button></div>}
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => writePlaces([...places, { id: "loc" + (places.length + 1) + Date.now().toString(36), label: "", placeId: "", reviewUrl: "" }])} className="mb-4 rounded-full border border-dashed border-[#c9d6f5] bg-[#f5f8ff] px-3.5 py-1.5 text-[12px] font-extrabold text-[#1d3a8f] transition hover:bg-[#eef4ff]">+ {t("p8set.rvAddLoc")}</button>

              <Row label={t("setup.showGoogleRating")} hint={t("setup.showGoogleRatingHint")}>
                <Toggle on={rv.showGoogleRating ?? true} onChange={(v) => set("reviews", { ...rv, showGoogleRating: v })} labels={[t("setup.on"), t("setup.off")]} />
              </Row>
              <Row label={t("setup.inviteToGoogle")} hint={t("setup.inviteToGoogleHint")}>
                <Toggle on={rv.inviteToGoogle ?? true} onChange={(v) => set("reviews", { ...rv, inviteToGoogle: v })} labels={[t("setup.on"), t("setup.off")]} />
              </Row>
              <div className="mb-4 rounded-lg border border-[#cde0f7] bg-[#eef5ff] px-3.5 py-2.5 text-[11.5px] leading-relaxed text-[#1d3a8f]">
                <Rich k="p8set.rvPullBox" slots={{}} />
              </div>
            </>);
          })()}

          {has("trustpilot") && (<>
            <div className="mb-2 mt-1 text-[11px] font-extrabold uppercase tracking-wide text-[#00b67a]">Trustpilot</div>

            {/* Precise steps to find the Trustpilot Business Unit ID, with a visual. */}
            <div className="mb-3 rounded-xl border border-[#bfeadb] bg-[#e9f9f2] p-3.5">
              <div className="mb-2 flex flex-wrap items-center gap-2.5">
                <a href="https://www.trustpilot.com/" target="_blank" rel="noopener noreferrer" className="rounded-full bg-[#00b67a] px-3.5 py-1.5 text-[12px] font-extrabold text-white shadow-sm transition hover:brightness-110">{t("p8set.rvOpenTp")}</a>
                <span className="text-[12px] font-extrabold text-[#05603a]">{t("p8set.rvGrabBuid")}</span>
              </div>
              <ol className="ms-4 list-decimal space-y-0.5 text-[12px] leading-relaxed text-[#0b5a3f]">
                <li><Rich k="p8set.rvTpStep1" slots={{}} /></li>
                <li><Rich k="p8set.rvTpStep2" slots={{}} /></li>
                <li><Rich k="p8set.rvTpStep3" slots={{}} /></li>
              </ol>
              {/* Visual: a mock of the page-source line, with the ID highlighted. */}
              <div className="mt-2.5 flex flex-wrap items-center gap-3">
                <div className="w-[360px] max-w-full overflow-x-auto rounded-md border border-[#cfe9df] bg-[#0b2b22] p-2.5 font-mono text-[11px] leading-relaxed text-[#9fe7cd] shadow-[0_4px_16px_rgba(0,0,0,.16)]">
                  <span className="text-[#7fb8a6]">…,</span>&quot;<span className="text-[#e6f6ef]">businessUnitId</span>&quot;:&quot;<mark className="rounded bg-[#fff2a8] px-1 py-0.5 font-bold text-[#0b2b22] ring-1 ring-[#efcf3d]">4b2f1a9c00006400051a3c4e</mark>&quot;<span className="text-[#7fb8a6]">,&quot;displayName&quot;:…</span>
                </div>
                <div className="flex items-center gap-1.5 text-[12px] font-black text-[#05603a]"><span className="text-[16px]">👈</span> {t("p8set.rvCopyThis")}</div>
              </div>
              <p className="mt-2 text-[10.5px] text-[#3a6a58]"><Rich k="p8set.rvTpLogin" slots={{}} /></p>
            </div>

            <Row label={t("setup.trustpilotBUID")} hint={t("setup.trustpilotBUIDHint")} note={t("setup.needsPlatformKey")}>
              <Input value={rv.trustpilotBusinessUnitId ?? ""} placeholder="e.g. 4b2f1a9c00006400051a3c4e" onChange={(e) => set("reviews", { ...rv, trustpilotBusinessUnitId: e.target.value.trim() })} className="w-full" />
            </Row>
          </>)}

          <div className="mb-1 mt-1 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("setup.yourWebsite")}</div>
          <Row label={t("setup.publicWidget")} hint={t("setup.publicWidgetHint")} note={t("setup.backend")}>
            <Toggle on={rv.publicWidget ?? false} onChange={(v) => set("reviews", { ...rv, publicWidget: v })} labels={[t("setup.on"), t("setup.off")]} />
          </Row>
        </Section>
        );
      })()}

      {activeTab === "roles" && (
        <Section title={t("setup.rolesPermissions")} lede={t("setup.rolesPermissionsLede")}>
          {/* Editing the matrix stamps rolesSetAt — from then on the API enforces it (lib/accessMap.ts). */}
          <RolesPermissions roles={settings.roles ?? []} onChange={(roles) => { void save({ settings: { ...settings, roles, rolesSetAt: new Date().toISOString() } }).then(() => setSavedAt(new Date().toLocaleTimeString(dl(), { hour: "2-digit", minute: "2-digit" }))); }} areas={hoCombined ? HO_ROLE_AREAS : undefined} defaultRoles={hoCombined ? HO_DEFAULT_ROLES : undefined} />
        </Section>
      )}

      {activeTab === "learning" && (
        <Section title={t("setup.learning")} lede={t("setup.learningLede")}>
          <Row label={t("setup.keepTrainingRecords")} hint={t("setup.keepTrainingRecordsHint")}>
            <Toggle on={settings.learning?.trackTraining ?? true} onChange={(v) => set("learning", { ...settings.learning, trackTraining: v })} labels={[t("setup.on"), t("setup.off")]} />
          </Row>
          <Row label={t("setup.observations")} hint={t("setup.observationsHint")} note={t("setup.needsBackend")}>
            <Toggle on={settings.learning?.observations ?? false} onChange={(v) => set("learning", { ...settings.learning, observations: v })} labels={[t("setup.on"), t("setup.off")]} />
          </Row>
          <div className="mt-3"><FieldLabel>{t("setup.curriculumFramework")}</FieldLabel><Input value={settings.learning?.framework ?? ""} placeholder="EYFS" onChange={(e) => set("learning", { ...settings.learning, framework: e.target.value })} className="w-full sm:w-64" /></div>

          <div className="mt-5 mb-1 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("setup.coursesCertificates")}</div>
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <div><FieldLabel>{t("setup.passMark")}</FieldLabel><Input type="number" min={1} max={100} value={settings.learning?.passMark ?? 80} onChange={(e) => set("learning", { ...settings.learning, passMark: Number(e.target.value) })} className="w-full sm:w-40" /></div>
            <div><FieldLabel>{t("setup.defaultRenewal")}</FieldLabel><Input type="number" min={0} value={settings.learning?.renewMonths ?? 12} onChange={(e) => set("learning", { ...settings.learning, renewMonths: Number(e.target.value) })} className="w-full sm:w-40" /></div>
          </div>
          <Row label={t("setup.issueCertsAuto")} hint={t("setup.issueCertsAutoHint")}>
            <Toggle on={settings.learning?.autoCert ?? true} onChange={(v) => set("learning", { ...settings.learning, autoCert: v })} labels={[t("setup.on"), t("setup.off")]} />
          </Row>
          <Row label={t("setup.showLogoOnCerts")} hint={t("setup.showLogoOnCertsHint")}>
            <Toggle on={settings.learning?.certLogo ?? true} onChange={(v) => set("learning", { ...settings.learning, certLogo: v })} labels={[t("setup.on"), t("setup.off")]} />
          </Row>
          <Row label={t("setup.requirePolicyConfirm")} hint={t("setup.requirePolicyConfirmHint")}>
            <Toggle on={settings.learning?.requirePolicyConfirm ?? true} onChange={(v) => set("learning", { ...settings.learning, requirePolicyConfirm: v })} labels={[t("setup.on"), t("setup.off")]} />
          </Row>
          <Row label={t("setup.selfEnrol")} hint={t("setup.selfEnrolHint")}>
            <Toggle on={settings.learning?.selfEnrol ?? false} onChange={(v) => set("learning", { ...settings.learning, selfEnrol: v })} labels={[t("setup.on"), t("setup.off")]} />
          </Row>
          <div className="mt-5 mb-1 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("p8set.certDesign")}</div>
          <p className="mb-2.5 text-[12px] text-[var(--ink-3)]">{t("p8set.certDesignLede")}</p>
          <div className="mb-3 flex flex-wrap gap-2.5">
            {CERT_TEMPLATES.map((t) => { const on = (settings.learning?.certTemplate ?? "gold") === t.id; return (
              <button key={t.id} type="button" onClick={() => set("learning", { ...settings.learning, certTemplate: t.id })} className={"w-[196px] overflow-hidden rounded-xl border text-start transition-all " + (on ? "border-transparent ring-2 ring-[#1d3a8f] ring-offset-1" : "border-[var(--line)] hover:-translate-y-0.5 hover:shadow-md")}>
                <div className="relative h-[139px] w-full overflow-hidden bg-[#eef1f6]"><iframe title={t.name} tabIndex={-1} scrolling="no" srcDoc={certificateDoc(certPreview, t.id, false)} className="pointer-events-none absolute left-0 top-0 origin-top-left" style={{ width: 1000, height: 710, transform: "scale(0.196)" }} /></div>
                <div className="flex items-center gap-1.5 px-2.5 py-1.5"><span className="truncate text-[11.5px] font-bold text-[var(--ink)]">{t.name}</span>{on && <span className="ms-auto text-[11px] font-extrabold text-[#1d3a8f]">{tx("p8set.certChosen")}</span>}</div>
              </button>
            ); })}
          </div>
          <div className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("p8set.certAccent")}</div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {CERT_ACCENTS.map(([name, hex]) => { const on = settings.learning?.certColor === hex; return (
              <button key={hex} type="button" title={name} aria-label={name} onClick={() => set("learning", { ...settings.learning, certColor: hex })} className={"h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 " + (on ? "border-[var(--ink)]" : "border-white shadow-[0_0_0_1px_var(--line)]")} style={{ background: hex }} />
            ); })}
            <button type="button" onClick={() => set("learning", { ...settings.learning, certColor: undefined })} className={"rounded-full border px-2.5 py-1 text-[11px] font-bold " + (settings.learning?.certColor ? "border-[var(--line)] text-[var(--ink-2)] hover:border-[#1d3a8f]" : "border-[#1d3a8f] text-[#1d3a8f]")}>{t("p8set.certTplDefault")}</button>
          </div>
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <div><FieldLabel>{t("p8set.certHeading")}</FieldLabel><Input value={settings.learning?.certTitle ?? ""} placeholder="Certificate of Achievement" onChange={(e) => set("learning", { ...settings.learning, certTitle: e.target.value })} className="w-full" /></div>
            <div className="flex items-end gap-5 pb-1.5">
              <label className="flex items-center gap-2 text-[12.5px] font-semibold text-[var(--ink-2)]"><input type="checkbox" checked={settings.learning?.certShowScore !== false} onChange={(e) => set("learning", { ...settings.learning, certShowScore: e.target.checked })} /> {t("p8set.certShowScore")}</label>
              <label className="flex items-center gap-2 text-[12.5px] font-semibold text-[var(--ink-2)]"><input type="checkbox" checked={settings.learning?.certShowQr !== false} onChange={(e) => set("learning", { ...settings.learning, certShowQr: e.target.checked })} /> {t("p8set.certShowQr")}</label>
            </div>
          </div>
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <div><FieldLabel>{t("p8set.certSigName")}</FieldLabel><Input value={settings.learning?.certSignatory ?? ""} placeholder={t("p8set.egAlex")} onChange={(e) => set("learning", { ...settings.learning, certSignatory: e.target.value })} className="w-full" /></div>
            <div><FieldLabel>{t("p8set.certSigRole")}</FieldLabel><Input value={settings.learning?.certSignatoryRole ?? ""} placeholder={t("p8set.egTrainMgr")} onChange={(e) => set("learning", { ...settings.learning, certSignatoryRole: e.target.value })} className="w-full" /></div>
          </div>
          <div className="mb-3">
            <FieldLabel>{t("p8set.certSigImg")}</FieldLabel>
            <div className="flex flex-wrap items-center gap-2">
              <label className="cursor-pointer rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)] hover:border-[#1d3a8f]">⬆ {t("p8set.certUploadSig")}<input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => set("learning", { ...settings.learning, certSignature: String(r.result) }); r.readAsDataURL(f); }} /></label>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {settings.learning?.certSignature && <img src={settings.learning.certSignature} alt={t("p8set.certSigAlt")} className="h-9 w-auto rounded border border-[var(--line)] bg-[var(--surface)] object-contain px-1" />}
              {settings.learning?.certSignature && <button type="button" onClick={() => set("learning", { ...settings.learning, certSignature: undefined })} className="text-[12px] font-semibold text-[var(--ink-3)] hover:text-[#c0392b]">{t("setup.remove")}</button>}
            </div>
          </div>
          <Button variant="primary" onClick={() => openCertificate(certPreview, settings.learning?.certTemplate)}>👁 {t("p8set.certPreview")}</Button>

          <div id="credtypes" className="mt-5 mb-1 scroll-mt-28 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("p8set.credTypes")}</div>
          <p className="mb-2.5 text-[12px] text-[var(--ink-3)]">{t("p8set.credTypesLede")}</p>
          <div className="grid gap-2">
            {cred.types.map((t) => (
              <div key={t.id} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <Input value={t.name} onChange={(e) => cred.upsertType({ ...t, name: e.target.value })} className="w-[190px] font-semibold" />
                  {t.dbs && <span className="rounded-full bg-[#eef4fd] px-2 py-0.5 text-[10px] font-bold text-[#1d3a8f]" title={tx("p8set.credDbsTip")}>{tx("p8set.credDbsExtras")}</span>}
                  <label className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--ink-2)]"><input type="checkbox" checked={t.required} onChange={(e) => cred.upsertType({ ...t, required: e.target.checked })} /> {tx("p8set.credRequired")}</label>
                  <label className="flex items-center gap-1.5 text-[12px] text-[var(--ink-2)]"><Rich k="p8set.credRenew" slots={{ input: <Input type="number" min={0} value={t.renewMonths} onChange={(e) => cred.upsertType({ ...t, renewMonths: Number(e.target.value) })} className="w-[62px]" /> }} /></label>
                  <button type="button" title={tx("p8set.credDelete")} onClick={() => cred.deleteType(t.id)} className="ms-auto text-[13px] text-[var(--ink-3)] hover:text-[#c0392b]">🗑</button>
                </div>
                {t.required && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-[var(--line-2,#eef2f8)] pt-2">
                    <span className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{tx("p8set.credRequiredFor")}</span>
                    <Select value={t.applyKind ?? "all"} onChange={(e) => cred.upsertType({ ...t, applyKind: e.target.value as "all" | "roles" | "staff" })} className="max-w-[170px]"><option value="all">{tx("p8set.credAllStaff")}</option><option value="roles">{tx("p8set.credRoleOrTitle")}</option><option value="staff">{tx("p8set.credNamed")}</option></Select>
                    {(t.applyKind ?? "all") === "roles" && (() => {
                      const access = (settings.roles ?? []).map((r) => r.name).filter(Boolean);
                      const titles = (settings.staffRoles ?? []).filter(Boolean);
                      if (!access.length && !titles.length) return <span className="text-[11px] text-[var(--ink-3)]">{tx("p8set.credAddRolesFirst")}</span>;
                      const chip = (r: string) => { const on = (t.applyRoles ?? []).includes(r); return <button key={r} type="button" onClick={() => cred.upsertType({ ...t, applyRoles: toggleIn(t.applyRoles, r) })} className={"rounded-full border px-2.5 py-0.5 text-[11px] font-bold transition-colors " + (on ? "border-transparent bg-[#111634] text-white" : "border-[var(--line)] text-[var(--ink-2)] hover:border-[var(--ink-3)]")}>{r}</button>; };
                      return (
                        <div className="w-full space-y-1.5">
                          {access.length > 0 && <div className="flex flex-wrap items-center gap-1.5"><span className="me-0.5 inline-flex items-center rounded bg-[#eef1f6] px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-[#5b6577]" title={tx("p8set.credAccessRoleTip")}>{tx("p8set.credAccessRole")}</span>{access.map(chip)}</div>}
                          {titles.length > 0 && <div className="flex flex-wrap items-center gap-1.5"><span className="me-0.5 inline-flex items-center rounded bg-[#eaf1ff] px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-[#1d54c4]" title={tx("p8set.credJobTitleTip")}>{tx("p8set.credJobTitle")}</span>{titles.map(chip)}</div>}
                        </div>
                      );
                    })()}
                    {(t.applyKind ?? "all") === "staff" && credTeam.map((s) => { const on = (t.applyStaff ?? []).includes(s.name); return <button key={s.name} type="button" onClick={() => cred.upsertType({ ...t, applyStaff: toggleIn(t.applyStaff, s.name) })} className={"rounded-full border px-2.5 py-0.5 text-[11px] font-bold transition-colors " + (on ? "border-transparent bg-[#111634] text-white" : "border-[var(--line)] text-[var(--ink-2)] hover:border-[var(--ink-3)]")}>{s.name}</button>; })}
                  </div>
                )}
              </div>
            ))}
          </div>
          <Button className="mt-2" onClick={() => cred.upsertType({ id: "ct" + Date.now().toString(36), name: t("p8set.credNew"), required: false, renewMonths: 12, needsFile: true })}>+ {t("p8set.credAdd")}</Button>

          <p className="mt-4 rounded-lg bg-[var(--panel)] px-3 py-2 text-[11.5px] text-[var(--ink-3)]"><Rich k="p8set.credReminders" slots={{}} /></p>
        </Section>
      )}

      {activeTab === "meals" && (
        <Section title={t("setup.meals")} lede={t("setup.mealsLede")}>
          <Row label={t("setup.preOrderMeals")} hint={t("setup.preOrderMealsHint")}>
            <Toggle on={settings.meals?.ordering ?? true} onChange={(v) => set("meals", { ...settings.meals, ordering: v })} labels={[t("setup.on"), t("setup.off")]} />
          </Row>
          <Row label={t("setup.showAllergens")} hint={t("setup.showAllergensHint")}>
            <Toggle on={settings.meals?.showAllergens ?? true} onChange={(v) => set("meals", { ...settings.meals, showAllergens: v })} labels={[t("setup.yes"), t("setup.no")]} />
          </Row>
          {/* The "hours before a session" cut-off was REMOVED, not moved. It
              wrote settings.meals.orderCutoffHours, which nothing has read since
              the cut-off became a when+time pair (cutoffWhen / cutoffTime) set
              per menu in Meals → Menu sharing. Two controls for one rule, and
              the one here silently did nothing — an operator could close
              ordering 18 hours out and watch orders keep arriving. */}
          <div className="mt-3"><FieldLabel>{t("setup.mealsNote")}</FieldLabel><Input value={settings.meals?.menuNote ?? ""} placeholder={t("setup.mealsNotePlaceholder")} onChange={(e) => set("meals", { ...settings.meals, menuNote: e.target.value })} className="w-full" /></div>
        </Section>
      )}

      {activeTab === "medication" && (
        <Section
          title={t("setup.medication")}
          lede={t("setup.medicationLede")}
        >
          <Row label={t("setup.tellParentGiven")} hint={t("setup.tellParentGivenHint")}>
            <Toggle on={settings.medication?.informParentGiven ?? true} onChange={(v) => set("medication", { ...settings.medication, informParentGiven: v })} labels={[t("setup.yes"), t("setup.no")]} />
          </Row>
          <Row label={t("setup.tellParentMissed")} hint={t("setup.tellParentMissedHint")}>
            <Toggle on={settings.medication?.informParentMissed ?? true} onChange={(v) => set("medication", { ...settings.medication, informParentMissed: v })} labels={[t("setup.yes"), t("setup.no")]} />
          </Row>
          <Row label={t("setup.notifyParentNote")} hint={t("setup.notifyParentNoteHint")}>
            <Toggle on={settings.medication?.notifyParentNote ?? true} onChange={(v) => set("medication", { ...settings.medication, notifyParentNote: v })} labels={[t("setup.yes"), t("setup.no")]} />
          </Row>
          <Row label={t("setup.notifyParentAuthorise")} hint={t("setup.notifyParentAuthoriseHint")}>
            <Toggle on={settings.medication?.notifyParentAuthorise ?? true} onChange={(v) => set("medication", { ...settings.medication, notifyParentAuthorise: v })} labels={[t("setup.yes"), t("setup.no")]} />
          </Row>
          <Row label={t("setup.remindDose")} hint={t("setup.remindDoseHint")}>
            <Toggle on={settings.medication?.remindWhenDue ?? true} onChange={(v) => set("medication", { ...settings.medication, remindWhenDue: v })} labels={[t("setup.yes"), t("setup.no")]} />
          </Row>
          <Row label={t("setup.requireWitness")} hint={t("setup.requireWitnessHint")}>
            <Toggle on={settings.medication?.requireWitness ?? false} onChange={(v) => set("medication", { ...settings.medication, requireWitness: v })} labels={[t("setup.yes"), t("setup.no")]} />
          </Row>
          {portal !== "freelancer" && (
            <Row label={t("p8set.medLeadsOnly")} hint={t("p8set.medLeadsOnlyHint")}>
              <Toggle on={settings.medication?.leadsOnly ?? false} onChange={(v) => set("medication", { ...settings.medication, leadsOnly: v })} labels={[t("p8set.yes"), t("p8set.no")]} />
            </Row>
          )}
        </Section>
      )}

      {activeTab === "safeguarding" && (
        <Section
          title={t("p8set.sgTitle")}
          lede={t("p8set.sgLede")}
        >
          <Row label={t("p8set.sgNotifyAcc")} hint={t("p8set.sgNotifyAccHint")}>
            <Toggle on={settings.safeguarding?.notifyParentAccident ?? true} onChange={(v) => set("safeguarding", { ...settings.safeguarding, notifyParentAccident: v })} labels={[t("p8set.yes"), t("p8set.no")]} />
          </Row>
          <Row label={t("p8set.sgNotifyInc")} hint={t("p8set.sgNotifyIncHint")}>
            <Toggle on={settings.safeguarding?.notifyParentIncident ?? false} onChange={(v) => set("safeguarding", { ...settings.safeguarding, notifyParentIncident: v })} labels={[t("p8set.yes"), t("p8set.no")]} />
          </Row>
          <Row label={t("p8set.sgTellStaff")} hint={t("p8set.sgTellStaffHint")}>
            <Toggle on={settings.safeguarding?.notifyStaffAcknowledged ?? true} onChange={(v) => set("safeguarding", { ...settings.safeguarding, notifyStaffAcknowledged: v })} labels={[t("p8set.yes"), t("p8set.no")]} />
          </Row>
          <Row label={t("p8set.sgReqAck")} hint={t("p8set.sgReqAckHint")}>
            <Toggle on={settings.safeguarding?.requireAcknowledgement ?? false} onChange={(v) => set("safeguarding", { ...settings.safeguarding, requireAcknowledgement: v })} labels={[t("p8set.yes"), t("p8set.no")]} />
          </Row>

          <div className="mt-5 mb-2 text-[13px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{t("p8set.sgDslHead")}</div>
          <p className="mb-2.5 -mt-1 text-[12px] text-[var(--ink-3)]">{t("p8set.sgDslLede")}</p>
          {!settings.safeguarding?.dslName?.trim() && (
            // Not a hard block — a concern must always be loggable — but nobody
            // named as DSL is a gap an inspector asks about first.
            <div className="mb-2.5 rounded-lg border border-[#f6c9cc] bg-[#fdebec] px-3 py-2 text-[12px] font-semibold text-[#c02636]">
              {t("p8set.sgNoDsl")}
            </div>
          )}
          <Row label={t("p8set.sgYourName")} hint={t("p8set.sgYourNameHint")}>
            <Input value={settings.safeguarding?.dslName ?? ""} onChange={(e) => set("safeguarding", { ...settings.safeguarding, dslName: e.target.value })} placeholder={t("p8set.egSam")} className="w-full" />
          </Row>
          <Row label={t("p8set.sgRoleTitle")} hint={t("p8set.sgRoleTitleHint")}>
            <Input value={settings.safeguarding?.dslTitle ?? "Designated Safeguarding Lead (DSL)"} onChange={(e) => set("safeguarding", { ...settings.safeguarding, dslTitle: e.target.value })} className="w-full" />
          </Row>
          <Row label={t("p8set.sgDslEmail")} hint={t("p8set.sgDslEmailHint")}>
            <Input type="email" value={settings.safeguarding?.dslEmail ?? ""} onChange={(e) => set("safeguarding", { ...settings.safeguarding, dslEmail: e.target.value.trim() })} placeholder={t("p8set.egSamEmail")} className="w-full" />
          </Row>
          <Row label={t("p8set.sgDeputy")} hint={t("p8set.sgDeputyHint")}>
            <div className="grid w-full gap-2 sm:grid-cols-2">
              <Input value={settings.safeguarding?.deputyDslName ?? ""} onChange={(e) => set("safeguarding", { ...settings.safeguarding, deputyDslName: e.target.value })} placeholder={t("p8set.sgDeputyName")} className="w-full" />
              <Input type="email" value={settings.safeguarding?.deputyDslEmail ?? ""} onChange={(e) => set("safeguarding", { ...settings.safeguarding, deputyDslEmail: e.target.value.trim() })} placeholder={t("p8set.sgDeputyEmail")} className="w-full" />
            </div>
          </Row>

          <div className="mt-5 mb-2 text-[13px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{t("p8set.sgContactsHead")}</div>
          <p className="mb-2.5 -mt-1 text-[12px] text-[var(--ink-3)]">{t("p8set.sgContactsLede")}</p>
          {(() => {
            const c = settings.safeguarding?.contacts ?? {};
            const setC = (patch: Partial<NonNullable<TenantSettings["safeguarding"]>["contacts"]>) => set("safeguarding", { ...settings.safeguarding, contacts: { ...c, ...patch } });
            const auths = c.authorities ?? [];
            const setAuths = (next: NonNullable<typeof auths>) => setC({ authorities: next });
            const extra = c.extra ?? [];
            return (
              <>
                <div className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">{t("p8set.sgImmediate")}</div>
                <Row label={t("p8set.sgPolice")}><Input value={c.policePhone ?? "999 (emergency) / 101"} onChange={(e) => setC({ policePhone: e.target.value })} className="w-full" /></Row>
                <Row label={t("p8set.sgNspcc")}><Input value={c.nspccPhone ?? "0808 800 5000"} onChange={(e) => setC({ nspccPhone: e.target.value })} className="w-full" /></Row>

                <div className="mt-4 mb-1 text-[11px] font-extrabold uppercase tracking-[0.04em] text-[var(--ink-3)]">{t("p8set.sgLocalAuth")}</div>
                <p className="mb-2 text-[11.5px] text-[var(--ink-3)]">{t("p8set.sgLocalAuthLede")}</p>
                <div className="flex flex-col gap-2.5">
                  {auths.map((a, i) => (
                    <div key={a.id} className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-2.5">
                      <div className="mb-1.5 flex items-center gap-1.5">
                        <Input value={a.name} onChange={(e) => setAuths(auths.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder={t("p8set.sgCouncilPh")} className="flex-1 font-bold" />
                        <button type="button" aria-label={t("p8set.sgRemoveAuth")} onClick={() => setAuths(auths.filter((_, j) => j !== i))} className="px-1.5 text-[var(--ink-3)] hover:text-[var(--red,#e21d27)]">✕</button>
                      </div>
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        <Input value={a.ladoName ?? ""} onChange={(e) => setAuths(auths.map((x, j) => (j === i ? { ...x, ladoName: e.target.value } : x)))} placeholder={t("p8set.sgLadoName")} />
                        <Input value={a.ladoPhone ?? ""} onChange={(e) => setAuths(auths.map((x, j) => (j === i ? { ...x, ladoPhone: e.target.value } : x)))} placeholder={t("p8set.sgLadoPhone")} />
                        <Input value={a.socialCarePhone ?? ""} onChange={(e) => setAuths(auths.map((x, j) => (j === i ? { ...x, socialCarePhone: e.target.value } : x)))} placeholder={t("p8set.sgMash")} />
                        <Input value={a.outOfHoursPhone ?? ""} onChange={(e) => setAuths(auths.map((x, j) => (j === i ? { ...x, outOfHoursPhone: e.target.value } : x)))} placeholder={t("p8set.sgEdt")} />
                      </div>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => setAuths([...auths, { id: `la_${new Date().toISOString()}`, name: "" }])} className="mt-1.5 rounded-full border border-[var(--line)] px-3 py-1 text-[12px] font-bold text-[#1d3a8f]">{t("p8set.sgAddAuth")}</button>

                <div className="mt-4">
                  <FieldLabel>{t("p8set.sgMoreContacts")}</FieldLabel>
                  <div className="flex flex-col gap-1.5">
                    {extra.map((x, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-1.5">
                        <Input value={x.label} onChange={(e) => setC({ extra: extra.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)) })} placeholder={t("p8set.sgLabelPh")} className="min-w-[180px] flex-1" />
                        <Input value={x.phone} onChange={(e) => setC({ extra: extra.map((y, j) => (j === i ? { ...y, phone: e.target.value } : y)) })} placeholder={t("p8set.sgPhonePh")} className="w-40" />
                        <button type="button" aria-label={t("p8set.sgRemoveContact")} onClick={() => setC({ extra: extra.filter((_, j) => j !== i) })} className="px-1.5 text-[var(--ink-3)] hover:text-[var(--red,#e21d27)]">✕</button>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => setC({ extra: [...extra, { label: "", phone: "" }] })} className="mt-1.5 rounded-full border border-[var(--line)] px-3 py-1 text-[12px] font-bold text-[#1d3a8f]">{t("p8set.sgAddContact")}</button>
                </div>
              </>
            );
          })()}

          <div className="mt-5 mb-2 text-[13px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{t("p8set.sgCategories")}</div>
          <p className="mb-2.5 -mt-1 text-[12px] text-[var(--ink-3)]">{t("p8set.sgCategoriesLede")}</p>
          <ListEditor items={settings.safeguarding?.categories ?? [...SG_CATEGORIES]} onChange={(next) => set("safeguarding", { ...settings.safeguarding, categories: next })} placeholder={t("p8set.sgAddCat")} />

          <div className="mt-5 mb-2 text-[13px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{t("p8set.sgProtocol")}</div>
          <p className="mb-2.5 -mt-1 text-[12px] text-[var(--ink-3)]">{t("p8set.sgProtocolLede")}</p>
          <Row label={t("p8set.sgTimescale")} hint={t("p8set.egSameDay")}>
            <Input value={settings.safeguarding?.protocol?.due ?? DEFAULT_PROTOCOL.due} onChange={(e) => set("safeguarding", { ...settings.safeguarding, protocol: { ...settings.safeguarding?.protocol, due: e.target.value } })} className="w-full" />
          </Row>
          <Row label={t("p8set.sgReference")} hint={t("p8set.sgReferenceHint")}>
            <Input value={settings.safeguarding?.protocol?.ref ?? DEFAULT_PROTOCOL.ref} onChange={(e) => set("safeguarding", { ...settings.safeguarding, protocol: { ...settings.safeguarding?.protocol, ref: e.target.value } })} className="w-full" />
          </Row>
          <FieldLabel>{t("p8set.sgSteps")}</FieldLabel>
          <ListEditor items={settings.safeguarding?.protocol?.steps ?? [...DEFAULT_PROTOCOL.steps]} onChange={(next) => set("safeguarding", { ...settings.safeguarding, protocol: { ...settings.safeguarding?.protocol, steps: next } })} placeholder={t("p8set.sgAddStep")} />
        </Section>
      )}

      {activeTab === "registers" && (
        <Section title={t("p8set.regTitle")} lede={t("p8set.regLede")}>
          <Row label={t("p8set.regTimes")} hint={t("p8set.regTimesHint")}>
            <Toggle on={settings.registers?.timestamps ?? true} onChange={(v) => set("registers", { ...settings.registers, timestamps: v })} labels={[t("p8set.on"), t("p8set.off")]} />
          </Row>
          <Row label={t("p8set.regAskWho")} hint={t("p8set.regAskWhoHint")}>
            <Toggle on={settings.registers?.askCollectedBy ?? false} onChange={(v) => set("registers", { ...settings.registers, askCollectedBy: v })} labels={[t("p8set.on"), t("p8set.off")]} />
          </Row>
          <Row label={t("p8set.regPin")} hint={t("p8set.regPinHint")}>
            <Toggle on={settings.registers?.requireCollectionPin ?? false} onChange={(v) => set("registers", { ...settings.registers, requireCollectionPin: v })} labels={[t("p8set.on"), t("p8set.off")]} />
          </Row>
          <div className="mt-3 mb-1 text-[12px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{t("p8set.regCardHead")}</div>
          <p className="mb-2 -mt-0.5 text-[12px] text-[var(--ink-3)]">{t("p8set.regCardLede")}</p>
          {([["allergies", t("p8set.regc_allergies")], ["medical", t("p8set.regc_medical")], ["dietary", t("p8set.regc_dietary")], ["send", t("p8set.regc_send")], ["swimming", t("p8set.regc_swimming")], ["likes", t("p8set.regc_likes")], ["dislikes", t("p8set.regc_dislikes")], ["careNotes", t("p8set.regc_carenotes")], ["answers", t("p8set.regc_answers")], ["consents", t("p8set.regc_consents")], ["mainContact", t("p8set.regc_maincontact")], ["emergency", t("p8set.regc_emergency")], ["password", t("p8set.regc_password")], ["school", t("p8set.regc_school")], ["bookingNotes", t("p8set.regc_bookingnotes")], ["attending", t("p8set.regc_attending")]] as [string, string][]).map(([k, label]) => (
            <Row key={k} label={label}>
              <Toggle on={settings.registers?.card?.[k as keyof NonNullable<NonNullable<typeof settings.registers>["card"]>] ?? true} onChange={(v) => set("registers", { ...settings.registers, card: { ...settings.registers?.card, [k]: v } })} labels={[t("p8set.show"), t("p8set.hide")]} />
            </Row>
          ))}
          <div className="mt-4 mb-1 text-[12px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>{t("p8set.regActHead")}</div>
          <p className="mb-2 -mt-0.5 text-[12px] text-[var(--ink-3)]">{t("p8set.regActLede")}</p>
          {([["firstAid", t("p8set.rega_firstaid")], ["incident", t("p8set.rega_incident")], ["medication", t("p8set.rega_medication")], ["moments", t("p8set.rega_moments")], ["message", t("p8set.rega_message")], ["email", t("p8set.rega_email")], ["whatsapp", t("p8set.rega_whatsapp")]] as [string, string][]).map(([k, label]) => (
            <Row key={k} label={label}>
              <Toggle on={settings.registers?.actions?.[k as keyof NonNullable<NonNullable<typeof settings.registers>["actions"]>] ?? true} onChange={(v) => set("registers", { ...settings.registers, actions: { ...settings.registers?.actions, [k]: v } })} labels={[t("p8set.on"), t("p8set.off")]} />
            </Row>
          ))}
        </Section>
      )}

      {activeTab === "trips" && (
        <Section title={t("p8set.tripTitle")} lede={t("p8set.tripLede")}>
          <Row label={t("p8set.tripNotify")} hint={t("p8set.tripNotifyHint")}>
            <Toggle on={settings.trips?.notifyParent ?? true} onChange={(v) => set("trips", { ...settings.trips, notifyParent: v })} labels={[t("p8set.yes"), t("p8set.no")]} />
          </Row>
          <Row label={t("p8set.tripRequire")} hint={t("p8set.tripRequireHint")}>
            <Toggle on={settings.trips?.requireConsent ?? true} onChange={(v) => set("trips", { ...settings.trips, requireConsent: v })} labels={[t("p8set.yes"), t("p8set.no")]} />
          </Row>
          <Row label={t("p8set.tripRatio")} hint={t("p8set.tripRatioHint")}>
            <NumberBox value={settings.trips?.ratioTarget ?? 8} onChange={(n) => set("trips", { ...settings.trips, ratioTarget: Math.max(1, n) })} min={1} max={30} suffix=":1" />
          </Row>
          <Row label={t("p8set.tripWhoPlan")} hint={t("p8set.tripWhoPlanHint")} note={t("p8set.tripEnforcement")}>
            <Select value={settings.trips?.whoCanPlan ?? "all"} onChange={(e) => set("trips", { ...settings.trips, whoCanPlan: e.target.value as "all" | "leads" | "managers" })}>
              <option value="all">{t("p8set.tripAll")}</option>
              <option value="leads">{t("p8set.tripLeads")}</option>
              <option value="managers">{t("p8set.tripManagers")}</option>
            </Select>
          </Row>
          <Row label={t("p8set.tripWhoSend")} hint={t("p8set.tripWhoSendHint")}>
            <Select value={settings.trips?.whoCanSend ?? "all"} onChange={(e) => set("trips", { ...settings.trips, whoCanSend: e.target.value as "all" | "lead" })}>
              <option value="all">{t("p8set.tripAnyStaff")}</option>
              <option value="lead">{t("p8set.tripLeadOnly")}</option>
            </Select>
          </Row>
        </Section>
      )}

      {activeTab === "calendar" && (
        <Section title={t("p8set.calTitle")} lede={t("p8set.calLede")}>
          <Row label={t("p8set.calRemind")} hint={t("p8set.calRemindHint")}>
            <Toggle on={settings.calendar?.reminderOn ?? true} onChange={(v) => set("calendar", { ...settings.calendar, reminderOn: v })} labels={[t("p8set.on"), t("p8set.off")]} />
          </Row>
          <Row label={t("p8set.calHowLong")} hint={t("p8set.calHowLongHint")}>
            <NumberBox value={settings.calendar?.reminderMinutes ?? 30} onChange={(n) => set("calendar", { ...settings.calendar, reminderMinutes: Math.max(0, n) })} min={0} max={1440} suffix={" " + t("p8set.sfxMin")} />
          </Row>
          <NotWired>{t("p8set.calNotWired")}</NotWired>
        </Section>
      )}

      {activeTab === "inventory" && (
        <Section title={t("p8set.invTitle")} lede={t("p8set.invLede")}>
          <Row label={t("p8set.invMark")} hint={t("p8set.invMarkHint")}>
            <Toggle on={(settings.inventory?.orderExpenseStatus ?? "paid") === "paid"} onChange={(v) => set("inventory", { ...settings.inventory, orderExpenseStatus: v ? "paid" : "pending" })} labels={[t("p8set.paid"), t("p8set.owed")]} />
          </Row>
          <Row label={t("p8set.invCheck")} hint={t("p8set.invCheckHint")}>
            <NumberBox value={settings.inventory?.checkEveryDays ?? 30} onChange={(n) => set("inventory", { ...settings.inventory, checkEveryDays: Math.max(1, n) })} min={1} max={365} suffix={" " + t("p8set.sfxDays")} />
          </Row>
          <Row label={t("p8set.invWarn")} hint={t("p8set.invWarnHint")}>
            <Toggle on={settings.inventory?.lowStockAlert ?? true} onChange={(v) => set("inventory", { ...settings.inventory, lowStockAlert: v })} labels={[t("p8set.on"), t("p8set.off")]} />
          </Row>
        </Section>
      )}

      {activeTab === "people" && (
        <>
          <Section
            title={t("p8set.ppHead")}
            lede={t("p8set.ppLede")}
          >
            <Row label={t("p8set.ppChildName")} hint={t("p8set.ppChildNameHint")}>
              <AlwaysOn />
            </Row>
            <Row
              label={t("p8set.regc_allergies")}
              hint={t("p8set.ppAllergiesHint")}
            >
              <span className="flex items-center gap-2">
                <AlwaysOn />
                <Limit value={settings.charLimits.allergies} onChange={(n) => set("charLimits", { ...settings.charLimits, allergies: n })} />
              </span>
            </Row>
            <Row label={t("p8set.ppMedical")} hint={t("p8set.ppMedicalHint")}>
              <span className="flex items-center gap-2">
                <AlwaysOn />
                <Limit value={settings.charLimits.medical} onChange={(n) => set("charLimits", { ...settings.charLimits, medical: n })} />
              </span>
            </Row>
            <Row label={t("p8set.ppDietary")} hint={t("p8set.ppDietaryHint")}>
              <span className="flex items-center gap-2">
                {settings.collectDietary && (
                  <Limit value={settings.charLimits.dietary} onChange={(n) => set("charLimits", { ...settings.charLimits, dietary: n })} />
                )}
                <Toggle on={settings.collectDietary} onChange={(v) => set("collectDietary", v)} />
              </span>
            </Row>
            <Row label={t("p8set.ppLikes")} hint={t("p8set.ppLikesHint")}>
              <span className="flex items-center gap-2">
                <Limit value={settings.charLimits.likes} onChange={(n) => set("charLimits", { ...settings.charLimits, likes: n })} />
                <Limit value={settings.charLimits.dislikes} onChange={(n) => set("charLimits", { ...settings.charLimits, dislikes: n })} />
              </span>
            </Row>

            <Row
              label={t("p8set.ppDob")}
              hint={
                dobLock.forcedBy.length
                  ? (dobLock.forcedBy.length === 1 ? t("p8set.ppDobLockOne", { label: dobLock.forcedBy[0].label }) : t("p8set.ppDobLockMany", { n: dobLock.forcedBy.length }))
                  : t("p8set.ppDobHint")
              }
            >
              <Toggle
                on={dobLock.required}
                disabled={dobLock.forcedBy.length > 0}
                onChange={(v) => set("requireDob", v)}
                labels={[t("p8set.credRequired"), t("p8set.optional")]}
              />
            </Row>
            {!dobLock.required && (
              <div role="alert" data-testid="dob-optional-warning" className="mx-1 my-2 rounded-xl border px-3.5 py-3 text-[12.5px] leading-[1.5]" style={{ background: "#fffbeb", borderColor: "#f59e0b", color: "#92400e" }}>
                <div className="font-extrabold">⚠ {t("p8set.dobWarnTitle")}</div>
                <ul className="m-0 mt-1.5 list-disc ps-5">
                  {DOB_OPTIONAL_LOSSES.map((k) => <li key={k}>{t(k)}</li>)}
                </ul>
                <div className="mt-1.5 font-semibold">{t("p8set.dobWarnFoot")}</div>
              </div>
            )}
            <Row label={t("p8set.ppGender")} hint={t("p8set.ppGenderHint")}>
              <Toggle on={settings.collectGender} onChange={(v) => set("collectGender", v)} />
            </Row>
            {settings.collectGender && (
              <Row label={t("p8set.ppOptions")} hint={t("p8set.ppOptionsHint")} note={t("p8set.ppOptionsNote")}>
                <div className="w-[240px]">
                  <ListEditor items={settings.genderOptions} onChange={(v) => set("genderOptions", v)} placeholder={t("p8set.qAddOption")} />
                </div>
              </Row>
            )}
            <Row label={t("p8set.ppPhoto")} hint={t("p8set.ppPhotoHint")}>
              <Toggle on={settings.collectPhoto} onChange={(v) => set("collectPhoto", v)} />
            </Row>
            <Row
              label={t("p8set.ppPhotoConsent")}
              hint={t("p8set.ppPhotoConsentHint")}
            >
              <Toggle on={settings.askPhotoConsent} onChange={(v) => set("askPhotoConsent", v)} />
            </Row>
            <Row label={t("p8set.ppSend")} hint={t("p8set.ppSendHint")}>
              <span className="flex items-center gap-2">
                {settings.collectSend && (
                  <Limit value={settings.charLimits.send} onChange={(n) => set("charLimits", { ...settings.charLimits, send: n })} />
                )}
                <Toggle on={settings.collectSend} onChange={(v) => set("collectSend", v)} />
              </span>
            </Row>
            {settings.collectSend && (
              <Row
                label={t("p8set.ppSendPlan")}
                hint={t("p8set.ppSendPlanHint")}
              >
                <Toggle on={settings.collectSendPlan} onChange={(v) => set("collectSendPlan", v)} />
              </Row>
            )}
            <Row label={t("p8set.ppCollCheck")} hint={t("p8set.ppCollCheckHint")}>
              <Select value={settings.collectionCheck} onChange={(e) => set("collectionCheck", e.target.value as TenantSettings["collectionCheck"])}>
                <option value="off">{t("p8set.ppNotUsed")}</option>
                <option value="password">{t("p8set.ppPassword")}</option>
                <option value="pin">{t("p8set.ppPin")}</option>
              </Select>
            </Row>
            <Row
              label={t("p8set.regc_emergency")}
              hint={t("p8set.ppEmergencyHint")}
              note={t("p8set.ppEmergencyNote")}
            >
              <span className="flex items-center gap-2">
                <AlwaysOn />
                <NumberBox value={settings.emergencyContacts} onChange={(n) => set("emergencyContacts", n)} min={1} max={4} />
              </span>
            </Row>
          </Section>

          <Section
            title={t("p8set.ppOwnQ")}
            lede={t("p8set.ppOwnQLede")}
          >
            <QuestionsEditor questions={questions} onChange={setQuestions} listings={listings} />
            <p className="mt-3 border-t border-dashed border-[var(--line)] pt-2.5 text-[11.5px] leading-[1.5] text-[var(--ink-3)]">
              {t("p8set.ppOwnQNote")}
            </p>
          </Section>

        </>
      )}

      {activeTab === "cancel" && (
        <>
          {cancelWelcome && settings.cancellationPolicies[0] ? (
            <CancelWelcome policy={settings.cancellationPolicies[0]} onEdit={() => setCancelWelcome(false)} />
          ) : (<>
          <StepDonePrompt step="cancel" />
          <Section
            title={t("p8set.cnTitle")}
            lede={t("p8set.cnLede")}
          >
            <PolicyList policies={settings.cancellationPolicies} onChange={(v) => set("cancellationPolicies", v)} />

            <div className="mt-3 border-t border-dashed border-[var(--line)] pt-2.5">
              <Row
                label={t("p8set.cnRefundDue")}
                hint={t("p8set.cnRefundDueHint")}
                note={t("p8set.cnAutoNote")}
              >
                <Select
                  value={settings.refundApproval}
                  onChange={(e) => set("refundApproval", e.target.value as TenantSettings["refundApproval"])}
                >
                  <option value="review">{t("p8set.cnFlag")}</option>
                  <option value="auto">{t("p8set.cnAuto")}</option>
                </Select>
              </Row>
              {settings.refundApproval === "auto" && (
                <NotWired>{t("p8set.cnUnsent")}</NotWired>
              )}
              <Row
                label={t("p8set.cnCredit")}
                hint={t("p8set.cnCreditHint")}
              >
                <Toggle on={settings.noRefundCredit} onChange={(v) => set("noRefundCredit", v)} />
              </Row>
              <Row
                label={t("p8set.cnPartial")}
                hint={t("p8set.cnPartialHint")}
                note={undefined}
              >
                <Toggle on={settings.allowPartialCancel} onChange={(v) => set("allowPartialCancel", v)} />
              </Row>
              {settings.allowPartialCancel && (
                <div className="mt-1 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-2.5">
                  <div className="mb-1.5 text-[11.5px] font-bold text-[var(--ink-2)]">{t("p8set.cnReleased")}</div>
                  <Row label={t("p8set.cnMove")} hint={t("p8set.cnMoveHint")}>
                    <Toggle on={settings.partialAllowChangeDate} onChange={(v) => set("partialAllowChangeDate", v)} />
                  </Row>
                  <Row label={t("p8set.cnWallet")} hint={t("p8set.cnWalletHint")}>
                    <Toggle on={settings.partialAllowWallet} onChange={(v) => set("partialAllowWallet", v)} />
                  </Row>
                  <Row label={t("p8set.cnRefundIt")} hint={t("p8set.cnRefundItHint")}>
                    <Toggle on={settings.partialAllowRefund} onChange={(v) => set("partialAllowRefund", v)} />
                  </Row>
                </div>
              )}
            </div>
          </Section>
          <Section
            title={t("p8set.cnReasonsTitle")}
            lede={t("p8set.cnReasonsLede")}
          >
            <Row label={t("p8set.cnAskYou")} hint={t("p8set.cnAskYouHint")}>
              <Toggle on={settings.askReasonOperator} onChange={(v) => set("askReasonOperator", v)} />
            </Row>
            <Row
              label={t("p8set.cnAskParents")}
              hint={t("p8set.cnAskParentsHint")}
            >
              <Toggle on={settings.askReasonParent} onChange={(v) => set("askReasonParent", v)} />
            </Row>
            <div className="mt-2.5">
            <ReasonEditor items={settings.cancellationReasons} onChange={(v) => set("cancellationReasons", v)} />
            </div>
          </Section>

          <Section
            title={t("p8set.amTitle")}
            lede={t("p8set.amLede")}
          >
            <Row label={t("p8set.amOffer")} hint={t("p8set.amOfferHint")}>
              <Toggle on={settings.allowDateChanges} onChange={(v) => set("allowDateChanges", v)} />
            </Row>
            {settings.allowDateChanges && (
            <Row label={t("p8set.amSelf")} hint={t("p8set.amSelfHint")}>
              <Toggle on={settings.amendSelfService} onChange={(v) => set("amendSelfService", v)} />
            </Row>
            )}
            <Row label={t("p8set.amNotice")} hint={t("p8set.amNoticeHint")}>
              <NoticeInput hours={settings.amendNoticeHours} onChange={(h) => set("amendNoticeHours", h)} />
            </Row>
            <Row label={t("p8set.amLimit")} hint={t("p8set.amLimitHint")}>
              <MovesLimit value={settings.amendLimit} onChange={(n) => set("amendLimit", n)} />
            </Row>
            <Row label={t("p8set.amFee")} hint={t("p8set.amFeeHint")}>
              <NumberBox value={settings.amendFee} onChange={(n) => set("amendFee", n)} min={0} max={200} suffix="£" />
            </Row>
            <Row label={t("p8set.amCheaper")} hint={t("p8set.amCheaperHint")}>
              <Toggle on={settings.amendAllowCheaper} onChange={(v) => set("amendAllowCheaper", v)} />
            </Row>
            {settings.amendAllowCheaper && (
              <>
                <Row label={t("p8set.amCardRefund")} hint={t("p8set.amCardRefundHint")}>
                  <Toggle on={settings.allowCardRefund} onChange={(v) => set("allowCardRefund", v)} />
                </Row>
                {settings.allowCardRefund && (
                  <Row label={t("p8set.amChoose")} hint={t("p8set.amChooseHint")}>
                    <Toggle on={settings.refundLetCustomerChoose} onChange={(v) => set("refundLetCustomerChoose", v)} labels={[t("p8set.theyChoose"), t("p8set.alwaysCard")]} />
                  </Row>
                )}
              </>
            )}
            <div className="mt-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[11.5px] leading-[1.6] text-[var(--ink-3)]">
              <Rich k="p8set.amDearer" slots={{}} />
            </div>
          </Section>
          </>)}
        </>
      )}

      {activeTab === "defaults" && (
        <>
          <Section title={t("p8set.dfTitle")} lede={t("p8set.dfLede")}>
            <Row label={t("p8set.dfCapacity")} hint={t("p8set.dfCapacityHint")}>
              <NumberBox value={settings.defaultCapacity} onChange={(n) => set("defaultCapacity", n)} min={1} max={999} suffix={t("p8set.places")} />
            </Row>
            <Row label={t("p8set.dfDays")} hint={t("p8set.dfDaysHint")}>
              <div className="flex gap-1">
                {Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2024, 0, 1 + i)).toLocaleDateString(dl(), { weekday: "narrow", timeZone: "UTC" })).map((d, i) => {
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
            <Row label={t("p8set.dfShow")} hint={t("p8set.dfShowHint")}>
              <Toggle on={settings.showSpaces} onChange={(v) => set("showSpaces", v)} />
            </Row>
          </Section>
        </>
      )}

      {activeTab === "marketplace" && (
        <Section
          title={t("p8set.mkTitle")}
          lede={t("p8set.mkLede")}
        >
          <Row label={t("p8set.mkList")} hint={t("p8set.mkListHint")}>
            <Toggle on={!!settings.marketplaceListed} onChange={(v) => set("marketplaceListed", v)} labels={[t("p8set.listed"), t("p8set.off")]} />
          </Row>
        </Section>
      )}

      {activeTab === "money" && (
        <Section
          title={t("p8set.mnTitle")}
          lede={t("p8set.mnLede")}
        >
          <Row label={t("p8set.mnShow")} hint={t("p8set.mnShowHint")}>
            <div className="inline-flex overflow-hidden rounded-full border border-[var(--line)] text-[12px] font-bold">
              {(["outgoing", "incoming", "both"] as const).map((k) => (
                <button key={k} type="button" onClick={() => void save({ settings: { ...settings, money: { ...(settings.money ?? {}), show: k } } })} className="px-3.5 py-1.5 capitalize transition-colors" style={(settings.money?.show ?? "both") === k ? { background: "#1d3a8f", color: "#fff" } : { color: "var(--ink-3)" }}>{t("p8set.mnShow_" + k)}</button>
              ))}
            </div>
          </Row>
          <Row label={t("p8set.mnPo")} hint={t("p8set.mnPoHint")}>
            <Toggle on={!!settings.money?.usePurchaseOrders} onChange={(v) => void save({ settings: { ...settings, money: { ...(settings.money ?? {}), usePurchaseOrders: v } } })} labels={[t("p8set.yes"), t("p8set.no")]} />
          </Row>

          <div className="mt-4 border-t border-[var(--line)] pt-4">
            <div className="text-[14px] font-extrabold text-[var(--ink)]">{t("p8set.bbHead")}</div>
            <p className="mb-3 mt-0.5 text-[12px] text-[var(--ink-3)]">{t("p8set.bbLede")}</p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {([
                ["businessName", t("p8set.bbBusinessName"), "Little Kickers Ltd"],
                ["email", t("p8set.coEmail"), "hello@yourbiz.co.uk"],
                ["phone", t("p8set.coPhone"), "07700 900000"],
                ["vatNumber", t("p8set.coVat"), "GB123456789"],
                ["address", t("p8set.bbAddress"), "12 High St, Townsville, AB1 2CD"],
                ["paymentTerms", t("p8set.bbTerms"), t("p8set.bbTermsPh")],
                ["bankName", t("p8set.bbBank"), "Barclays"],
                ["accountName", t("p8set.bbAccName"), "Little Kickers Ltd"],
                ["sortCode", t("p8set.bbSort"), "12-34-56"],
                ["accountNumber", t("p8set.bbAccNo"), "12345678"],
              ] as const).map(([k, label, ph]) => (
                <div key={k}><FieldLabel>{label}</FieldLabel><Input value={settings.billing?.[k] ?? ""} placeholder={ph} onChange={(e) => void save({ settings: { ...settings, billing: { ...(settings.billing ?? {}), [k]: e.target.value } } })} className="w-full" /></div>
              ))}
            </div>
            <div className="mt-2.5"><FieldLabel>{t("p8set.bbFooter")}</FieldLabel><Input value={settings.billing?.footer ?? ""} placeholder={t("p8set.bbFooterPh")} onChange={(e) => void save({ settings: { ...settings, billing: { ...(settings.billing ?? {}), footer: e.target.value } } })} className="w-full" /></div>
          </div>

          <div className="mt-4 border-t border-[var(--line)] pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[14px] font-extrabold text-[var(--ink)]">{t("p8set.invTmplHead")}</div>
              <button type="button" onClick={() => setTmplPreview(true)} className="rounded-full bg-[#1d3a8f] px-3.5 py-1.5 text-[12px] font-extrabold text-white shadow-sm hover:brightness-110">{t("p8set.invPreview")}</button>
            </div>
            <p className="mb-3 mt-0.5 text-[12px] text-[var(--ink-3)]"><Rich k="p8set.invTmplLede" slots={{}} /></p>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div>
                <FieldLabel>{t("p8set.invLogo")}</FieldLabel>
                <div className="flex items-center gap-2">
                  {settings.billing?.logoUrl && <img src={settings.billing.logoUrl} alt={t("p8set.logoAlt")} className="h-9 max-w-[120px] rounded border border-[var(--line)] object-contain" />}
                  <label className="cursor-pointer rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[12px] font-bold text-[#1d3a8f]">⬆ {t("setup.upload")}<input type="file" accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp,image/gif,image/bmp,image/avif,image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { const dataUrl = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error(t("p8set.logoReadErr"))); r.readAsDataURL(f); }); const payload = dataUrl.startsWith("data:image/") ? await compressLogo(dataUrl) : dataUrl; const { url } = await api<{ url: string }>("/api/uploads", { method: "POST", body: JSON.stringify({ dataUrl: payload }) }); await save({ settings: { ...settings, billing: { ...(settings.billing ?? {}), logoUrl: url } } }); } catch (err) { alert(err instanceof Error ? t("p8set.logoFailed", { msg: err.message }) : t("p8set.logoFailedGeneric")); } e.target.value = ""; }} /></label>
                  {settings.billing?.logoUrl && <button type="button" onClick={() => void save({ settings: { ...settings, billing: { ...(settings.billing ?? {}), logoUrl: "" } } })} className="text-[11.5px] font-bold text-[var(--ink-3)]">{t("setup.remove")}</button>}
                </div>
                <div className="mt-1.5 text-[11px] text-[var(--ink-3)]">{t("p8set.logoFormats")}</div>
              </div>
              <div><FieldLabel>{t("p8set.coReg")}</FieldLabel><Input value={settings.billing?.companyReg ?? ""} placeholder="133950" onChange={(e) => void save({ settings: { ...settings, billing: { ...(settings.billing ?? {}), companyReg: e.target.value } } })} className="w-full" /></div>
            </div>
            <div className="mt-3">
              <FieldLabel>{t("p8set.invOptFields")}</FieldLabel>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1.5 text-[12.5px]">
                {([["poNumber", t("p8set.invFldPo")], ["accountRef", t("p8set.invFldRef")], ["vat", t("p8set.invFldVat")]] as const).map(([k, label]) => (
                  <label key={k} className="flex items-center gap-1.5 font-bold"><input type="checkbox" checked={!!settings.billing?.fields?.[k]} onChange={(e) => void save({ settings: { ...settings, billing: { ...(settings.billing ?? {}), fields: { ...(settings.billing?.fields ?? {}), [k]: e.target.checked } } } })} /> {label}</label>
                ))}
              </div>
            </div>
            {settings.billing?.fields?.vat && <div className="mt-2.5 max-w-[200px]"><FieldLabel>{t("p8set.invDefVat")}</FieldLabel><Input type="number" value={settings.billing?.defaultTaxRate ?? ""} placeholder="20" onChange={(e) => void save({ settings: { ...settings, billing: { ...(settings.billing ?? {}), defaultTaxRate: e.target.value === "" ? undefined : Number(e.target.value) } } })} className="w-full" /></div>}
          </div>

          <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[14px] font-extrabold text-[var(--ink)]">{t("p8set.poTmplHead")}</div>
              <button type="button" onClick={() => setPoPreview(true)} className="rounded-full bg-[#1d3a8f] px-3.5 py-1.5 text-[12px] font-extrabold text-white shadow-sm hover:brightness-110">{t("p8set.poPreview")}</button>
            </div>
            <p className="mb-3 mt-0.5 text-[12px] text-[var(--ink-3)]">{t("p8set.poTmplLede")}</p>
            <div className="grid gap-3">
              <div><FieldLabel>{t("p8set.poPayMethod")}</FieldLabel><Input value={settings.billing?.poPaymentMethod ?? ""} placeholder={t("p8set.poPayMethodPh")} onChange={(e) => void save({ settings: { ...settings, billing: { ...(settings.billing ?? {}), poPaymentMethod: e.target.value } } })} className="w-full" /></div>
              <div><FieldLabel>{t("p8set.poInstr")} <span className="font-normal normal-case text-[var(--ink-3)]">{t("p8set.poInstrNote")}</span></FieldLabel><textarea value={settings.billing?.poInstructions ?? ""} rows={4} placeholder={t("p8set.poInstrPh")} onChange={(e) => void save({ settings: { ...settings, billing: { ...(settings.billing ?? {}), poInstructions: e.target.value } } })} className={`${inputCls} w-full resize-y`} /></div>
              <div><FieldLabel>{t("p8set.poTerms")}</FieldLabel><textarea value={settings.billing?.poTerms ?? ""} rows={3} placeholder={t("p8set.poTermsPh")} onChange={(e) => void save({ settings: { ...settings, billing: { ...(settings.billing ?? {}), poTerms: e.target.value } } })} className={`${inputCls} w-full resize-y`} /></div>
            </div>
          </div>
          {tmplPreview && (() => {
            const f = settings.billing?.fields ?? {};
            const sample = {
              reference: "INV-1001", customerName: "Sample Customer Ltd", customerAddress: "1 Example Street, Townsville AB1 2CD", customerEmail: "customer@example.com",
              poNumber: f.poNumber ? "4200075991" : undefined, accountRef: f.accountRef ? "ACC-001" : undefined,
              date: "2026-01-15",
              lineItems: [{ description: t("p8set.smpSummerCamp"), qty: 1, unitPrice: 120 }, { description: t("p8set.smpExtDay"), qty: 3, unitPrice: 8 }],
              taxRate: f.vat ? (settings.billing?.defaultTaxRate ?? 20) : undefined,
              notes: t("p8set.smpNoteInv"),
            } as Record<string, unknown>;
            return <PrintableDoc kind="invoice" doc={sample} billing={settings.billing} onClose={() => setTmplPreview(false)} />;
          })()}
          {poPreview && (() => {
            const sample = {
              reference: "PO-1001", supplier: "Sample Supplier Ltd", supplierAddress: "12 Trade Park, Industry Way, Townsville AB1 2CD", supplierEmail: "sales@supplier.example",
              date: "2026-01-15", dueDate: "2026-01-29",
              requestedBy: settings.billing?.businessName ? `${settings.billing.businessName} — Ops` : "Operations",
              deliveryAddress: settings.billing?.address ?? "", comments: t("p8set.smpComment"),
              lineItems: [{ description: t("p8set.smpHaf"), qty: 1, unitPrice: 16800 }, { description: t("p8set.smpExtra"), qty: 4, unitPrice: 120 }],
              notes: t("p8set.smpNotePo"),
            } as Record<string, unknown>;
            return <PrintableDoc kind="po" doc={sample} billing={settings.billing} onClose={() => setPoPreview(false)} />;
          })()}
        </Section>
      )}

      {activeTab === "hub" && (() => {
        const h = settings.hub ?? HUB_DEFAULTS;
        const setH = (patch: Partial<HubSettings>) => set("hub", { ...h, ...patch });
        const num = (v: string, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number(v) || 0)));
        const setKind = (i: number, patch: Partial<HubSettings["questionKinds"][number]>) => setH({ questionKinds: h.questionKinds.map((k, j) => (j === i ? { ...k, ...patch } : k)) });
        const moveKind = (i: number, d: -1 | 1) => { const a = [...h.questionKinds]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; setH({ questionKinds: a }); };
        const addKind = () => {
          const taken = new Set(h.questionKinds.map((k) => k.id));
          let id = `kind-${uid()}`; while (taken.has(id)) id = `kind-${uid()}`;
          setH({ questionKinds: [...h.questionKinds, { id, label: t("hubshell.su_newQuestionType"), mark: "exact" }] });
        };
        return (
          <>
            <Section title={t("hubshell.su_markingTitle")} lede={t("hubshell.su_markingLede")}>
              <Row label={t("hubshell.su_passMark")} hint={t("hubshell.su_passMarkHint")}>
                <Input type="number" min={1} max={100} value={h.passMarkPct} onChange={(e) => setH({ passMarkPct: num(e.target.value, 1, 100) })} className="w-24" aria-label={t("hubshell.su_passMarkAria")} />
              </Row>
              <Row label={t("hubshell.su_lessonAccess")} hint={t("hubshell.su_lessonAccessHint")}>
                <Select value={h.lessonAccess} onChange={(e) => setH({ lessonAccess: e.target.value as HubSettings["lessonAccess"] })} className="w-full sm:w-64" aria-label={t("hubshell.su_lessonAccessAria")}>
                  <option value="assigned">{t("hubshell.su_lessonAccess_assigned")}</option>
                  <option value="year">{t("hubshell.su_lessonAccess_year")}</option>
                  <option value="all">{t("hubshell.su_lessonAccess_all")}</option>
                </Select>
              </Row>
              <Row label={t("hubshell.su_requireDiag")} hint={t("hubshell.su_requireDiagHint")}>
                <Toggle on={h.requireDiagnostic} onChange={(v) => setH({ requireDiagnostic: v })} labels={[t("hubshell.su_on"), t("hubshell.su_off")]} />
              </Row>
              <Row label={t("hubshell.su_reveal")} hint={t("hubshell.su_revealHint")}>
                <Select value={h.revealAnswers} onChange={(e) => setH({ revealAnswers: e.target.value as HubSettings["revealAnswers"] })} className="w-full sm:w-56" aria-label={t("hubshell.su_revealAria")}>
                  <option value="after_pass">{t("hubshell.su_reveal_after_pass")}</option>
                  <option value="after_submit">{t("hubshell.su_reveal_after_submit")}</option>
                  <option value="after_marked">{t("hubshell.su_reveal_after_marked")}</option>
                  <option value="never">{t("hubshell.su_reveal_never")}</option>
                </Select>
              </Row>
              <Row label={t("hubshell.su_retakes")} hint={t("hubshell.su_retakesHint")}>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={h.retakePolicy} onChange={(e) => setH({ retakePolicy: e.target.value as HubSettings["retakePolicy"] })} className="w-full sm:w-56" aria-label={t("hubshell.su_retakeAria")}>
                    <option value="unlimited">{t("hubshell.su_retake_unlimited")}</option>
                    <option value="once">{t("hubshell.su_retake_once")}</option>
                    <option value="cooldown">{t("hubshell.su_retake_cooldown")}</option>
                  </Select>
                  {h.retakePolicy === "cooldown" && (
                    <span className="inline-flex items-center gap-2"><Input type="number" min={1} max={720} value={h.retakeCooldownHours} onChange={(e) => setH({ retakeCooldownHours: num(e.target.value, 1, 720) })} className="w-24" aria-label={t("hubshell.su_cooldownAria")} /><span className="text-[12px] font-bold text-[var(--ink-2)]">{t("hubshell.su_hours")}</span></span>
                  )}
                </div>
              </Row>
              {h.retakePolicy === "unlimited" && (
                <Row label={t("hubshell.su_break")} hint={t("hubshell.su_breakHint")}>
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <Input type="number" min={0} max={10} value={h.retakeBreakAfter} onChange={(e) => setH({ retakeBreakAfter: num(e.target.value, 0, 10) })} className="w-20" aria-label={t("hubshell.su_breakAfterAria")} />
                    <span className="text-[12px] font-bold text-[var(--ink-2)]">{t("hubshell.su_triesThen")}</span>
                    <Input type="number" min={5} max={720} value={h.retakeBreakMinutes} onChange={(e) => setH({ retakeBreakMinutes: num(e.target.value, 5, 720) })} className="w-24" aria-label={t("hubshell.su_minutesAria")} disabled={h.retakeBreakAfter === 0} />
                    <span className="text-[12px] font-bold text-[var(--ink-2)]">{t("hubshell.su_minutes")}</span>
                  </span>
                </Row>
              )}
              <Row label={t("hubshell.su_hwDue")} hint={t("hubshell.su_hwDueHint")}>
                <Input type="number" min={0} max={90} value={h.homeworkDueDays} onChange={(e) => setH({ homeworkDueDays: num(e.target.value, 0, 90) })} className="w-24" aria-label={t("hubshell.su_hwDueAria")} />
              </Row>
            </Section>

            <Section title={t("hubshell.su_levelsTitle")} lede={t("hubshell.su_levelsLede")}>
              <LevelsEditorDraft bands={h.masteryBands} onCommit={(b) => setH({ masteryBands: b })} />
            </Section>

            <Section title={t("hubshell.su_yearsTitle")} lede={t("hubshell.su_yearsLede")}>
              <YearGroupsEditor groups={h.yearGroups} onChange={(g) => setH({ yearGroups: g })} defaults={HUB_DEFAULTS.yearGroups} />
              <Row label={t("hubshell.su_yearAdvance")} hint={t("hubshell.su_yearAdvanceHint")}>
                <span data-testid="setup-year-advance"><Toggle on={h.yearAutoAdvance !== false} onChange={(v) => setH({ yearAutoAdvance: v })} labels={[t("hubshell.su_on"), t("hubshell.su_off")]} /></span>
              </Row>
              {(hubStudents ?? []).some((s) => s.mayHaveLeft && s.active !== false) && (
                <p data-testid="setup-year-left" className="text-[12.5px] font-semibold text-[var(--ink-2)]">{t("hubshell.su_yearLeftNote", { n: (hubStudents ?? []).filter((s) => s.mayHaveLeft && s.active !== false).length })}</p>
              )}
            </Section>

            <Section title={t("hubshell.su_coloursTitle")} lede={t("hubshell.su_coloursLede")}>
              <SubjectColoursEditor colours={h.subjectColours ?? {}} onChange={(subjectColours) => setH({ subjectColours })} />
            </Section>

            <Section title={t("hubshell.su_enrolTitle")} lede={t("hubshell.su_enrolLede")}>
              <Row label={t("hubshell.su_autoEnrol")} hint={t("hubshell.su_autoEnrolHint")}>
                <span data-testid="setup-auto-enrol"><Toggle on={!!h.autoEnrolOnBooking} onChange={(v) => setH({ autoEnrolOnBooking: v })} labels={[t("hubshell.su_on"), t("hubshell.su_off")]} /></span>
              </Row>
            </Section>


            <Section title={t("hubplan.dg_title")}>
              <ParentEmailSettings parentDigest={!!h.parentDigest} homeworkNudges={!!h.homeworkNudges} nudgeLeadHours={h.nudgeLeadHours ?? 24} onChange={setH} students={hubStudents ?? []} qs={hubQs} />
            </Section>

            <Section title={t("hubshell.su_kindsTitle")} lede={t("hubshell.su_kindsLede")}>
              {h.questionKinds.map((k, i) => (
                <div key={k.id} className="flex flex-wrap items-center gap-2 border-b border-dashed border-[var(--line)] py-2 last:border-b-0">
                  <Input value={k.label} maxLength={60} onChange={(e) => setKind(i, { label: e.target.value })} className="min-w-[160px] flex-1" aria-label={t("hubshell.su_kindNameAria", { n: i + 1 })} />
                  <Select value={k.mark} onChange={(e) => setKind(i, { mark: e.target.value as HubSettings["questionKinds"][number]["mark"] })} className="w-full sm:w-56" aria-label={t("hubshell.su_kindRuleAria", { n: i + 1 })}>
                    {MARK_RULES.map((m) => <option key={m.id} value={m.id}>{t(`hubshell.su_mark_${m.id}`)}</option>)}
                  </Select>
                  <span className="flex items-center">
                    <button type="button" disabled={i === 0} onClick={() => moveKind(i, -1)} className="h-8 w-8 rounded-full text-[var(--ink-2)] hover:bg-[var(--panel)] disabled:opacity-30" aria-label={t("hubshell.su_moveUp", { name: k.label })}>↑</button>
                    <button type="button" disabled={i === h.questionKinds.length - 1} onClick={() => moveKind(i, 1)} className="h-8 w-8 rounded-full text-[var(--ink-2)] hover:bg-[var(--panel)] disabled:opacity-30" aria-label={t("hubshell.su_moveDown", { name: k.label })}>↓</button>
                    <button type="button" disabled={h.questionKinds.length <= 1} onClick={() => setH({ questionKinds: h.questionKinds.filter((_, j) => j !== i) })} className="rounded-full px-2.5 py-1 text-[12px] font-bold text-[var(--ink-2)] hover:bg-[var(--red-soft)] hover:text-[var(--red)] disabled:opacity-30" aria-label={t("hubshell.su_removeKind", { name: k.label })}>{t("hubshell.su_remove")}</button>
                  </span>
                </div>
              ))}
              <div className="mt-2 flex flex-wrap gap-2">
                {h.questionKinds.length < 12 && <Button sm onClick={addKind}>＋ {t("hubshell.su_addKind")}</Button>}
                <Button sm onClick={() => setH({ questionKinds: HUB_DEFAULTS.questionKinds })}>{t("hubshell.su_restoreDefaults")}</Button>
              </div>
            </Section>
          </>
        );
      })()}

      {activeTab === "features" && (() => {
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
            {/* The header pill already shows save state, but it's easy to miss while
                scanning a long toggle list — a save that failed (a stale token, a
                permissions refusal, a dropped connection…) used to revert the toggle
                silently a moment later, which reads exactly like "the click did
                nothing". Repeat the error right where the toggles are. */}
            {error && (
              <div className="mb-3 rounded-xl border border-[#f3b9b9] bg-[#fdeeee] px-4 py-3 text-[12.5px] font-semibold text-[#8a1c1c]">
                {t("p8set.ftSaveFailed", { error: error ?? "" })}
              </div>
            )}
            <Section
              title={t("p8set.ftAlwaysOn")}
              lede={t("p8set.ftAlwaysOnLede")}
            >
              {core.map((it) => (
                <Row key={it.view} label={navLabel(t, it.label ?? it.view)}>
                  <span className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1 text-[11px] font-bold text-[var(--ink-3)]">🔒 {t("p8set.ftAlwaysOn")}</span>
                </Row>
              ))}
            </Section>

            <Section
              title={t("p8set.ftYourFeatures")}
              lede={t("p8set.ftYourFeaturesLede")}
            >
              {optional.map((it) => {
                const on = !featureOff(fe, it.view);
                const keys = custKeys[it.view];
                const shownToFamilies = keys ? keys.every((k) => ca[k] !== false) && !ca.simpleMode : false;
                return (
                  <div key={it.view} className="border-b border-dashed border-[var(--line)] py-2.5 last:border-b-0">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-[200px] flex-1">
                        <div className="text-[13px] font-bold">{navLabel(t, it.label ?? it.view)}</div>
                        {FEATURE_HINTS[it.view] && <div className="mt-0.5 text-[11.5px] leading-[1.45] text-[var(--ink-2)]">{it.view === "learninghub" ? t("hubshell.su_learninghubHint") : FEATURE_HINTS[it.view]}</div>}
                        {keys && <div className="mt-0.5 text-[11px] text-[var(--ink-3)]">{t("p8set.ftFamiliesSee")}</div>}
                      </div>
                      <Toggle on={on} onChange={(v) => setFe(it.view, v)} labels={[t("p8set.on"), t("p8set.off")]} />
                    </div>
                    {keys && on && (
                      <div className="mt-2 ms-3 flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2">
                        <span className="text-[11.5px] font-semibold text-[var(--ink-2)]">{t("p8set.ftShowFamilies")}{ca.simpleMode ? t("p8set.ftOffSimple") : ""}</span>
                        <Toggle on={shownToFamilies} disabled={ca.simpleMode} onChange={(v) => setCAkeys(keys, v)} labels={[tx("p8set.shown"), tx("p8set.hidden")]} />
                      </div>
                    )}
                  </div>
                );
              })}
            </Section>

            <Section
              title={t("p8set.ftFamiliesAlso")}
              lede={t("p8set.ftFamiliesAlsoLede")}
            >
              <Row label={t("p8set.ftSimple")} note={t("p8set.ftOverrides")} hint={t("p8set.ftSimpleHint")}>
                <Toggle on={ca.simpleMode} onChange={(v) => setCAkey("simpleMode", v)} labels={[t("p8set.on"), t("p8set.off")]} />
              </Row>
              <Row label={t("p8set.ftWallet")} hint={t("p8set.ftWalletHint")}>
                <Toggle on={ca.simpleMode ? false : ca.wallet} disabled={ca.simpleMode} onChange={(v) => setCAkey("wallet", v)} labels={[tx("p8set.shown"), tx("p8set.hidden")]} />
              </Row>
              <Row label={t("p8set.ftBrowse")} hint={t("p8set.ftBrowseHint")}>
                <Toggle on={ca.simpleMode ? false : ca.browse} disabled={ca.simpleMode} onChange={(v) => setCAkey("browse", v)} labels={[tx("p8set.shown"), tx("p8set.hidden")]} />
              </Row>
            </Section>
          </>
        );
      })()}

      {activeTab === "refer" && (() => {
        const r = settings.referral;
        const unit = (v: number) => (r.type === "percent" ? `${v}%` : `£${v}`);
        return (
          <Section
            title={t("p8set.rfTitle")}
            lede={t("p8set.rfLede")}
          >
            <div className="flex flex-col items-start gap-3 py-1">
              <div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[12.5px] text-[var(--ink-2)]">
                {r.enabled
                  ? <Rich k="p8set.rfOn" vars={{ friend: unit(r.friendOff), referrer: unit(r.referrerReward) }} slots={{}} />
                  : <Rich k="p8set.rfOff" slots={{}} />}
              </div>
              <a href={`/${portal}/referrals`} className="rounded-full bg-[#2f5fd0] px-4 py-2 text-[12.5px] font-bold text-white transition-opacity hover:opacity-90">{t("p8set.rfOpen")}</a>
            </div>
          </Section>
        );
      })()}

      {activeTab === "memberships" && (() => {
        const m = settings.memberships;
        const setM = (patch: Partial<typeof m>) => set("memberships", { ...m, ...patch });
        const num = (v: string) => Math.max(0, Math.round(Number(v) || 0));
        const setTier = (id: string, patch: Partial<(typeof m.tiers)[number]>) =>
          setM({ tiers: m.tiers.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
        return (
          <Section
            title={t("p8set.msTitle")}
            lede={t("p8set.msLede")}
          >
            <Row label={t("p8set.msLabel")} hint={t("p8set.msHint")}>
              <Toggle on={m.enabled} onChange={(v) => setM({ enabled: v })} labels={[t("p8set.on"), t("p8set.off")]} />
            </Row>
            {m.tiers.map((t) => {
              const pct = t.benefitType === "percent";
              return (
                <div key={t.id} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <Input value={t.name} onChange={(e) => setTier(t.id, { name: e.target.value })} className="w-[160px] font-bold" />
                    <Toggle on={t.enabled} onChange={(v) => setTier(t.id, { enabled: v })} labels={[tx("p8set.on"), tx("p8set.off")]} />
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <label className="text-[12px] font-semibold text-[var(--ink-2)]">{tx("p8set.msPrice")}
                      <span className="mt-1 flex items-center gap-1"><span className="text-[12px] font-bold text-[var(--ink-3)]">£</span><Input type="number" min="0" step="1" value={String(t.priceMonthly)} onChange={(e) => setTier(t.id, { priceMonthly: num(e.target.value) })} className="w-full" /></span>
                    </label>
                    <label className="text-[12px] font-semibold text-[var(--ink-2)]">{tx("p8set.msBenefit")}
                      <span className="mt-1 block"><Toggle on={pct} onChange={(v) => setTier(t.id, { benefitType: v ? "percent" : "credit" })} labels={[tx("p8set.msPctOff"), tx("p8set.msCredit")]} /></span>
                    </label>
                    <label className="text-[12px] font-semibold text-[var(--ink-2)]">{pct ? tx("p8set.msPctEvery") : tx("p8set.msCreditMonth")}
                      <span className="mt-1 flex items-center gap-1">{!pct && <span className="text-[12px] font-bold text-[var(--ink-3)]">£</span>}<Input type="number" min="0" step="1" max={pct ? "100" : undefined} value={String(t.benefitValue)} onChange={(e) => setTier(t.id, { benefitValue: Math.min(pct ? 100 : 1e6, num(e.target.value)) })} className="w-full" />{pct && <span className="text-[12px] font-bold text-[var(--ink-3)]">%</span>}</span>
                    </label>
                  </div>
                  {/* Live benefit line — updates as they switch % ↔ £ or change the
                      value, so they always see what a member actually gets. It's
                      shown automatically on the customer card, so it's NOT a perk. */}
                  <div className="mt-2 rounded-lg bg-[#eef4ff] px-3 py-1.5 text-[12px] font-bold text-[#1d3a8f]">
                    {pct ? "🏷️ " : "👛 "}{pct ? tx("p8set.msGetPct", { n: t.benefitValue }) : tx("p8set.msGetCredit", { n: t.benefitValue })}
                  </div>
                  {t.benefitType === "credit" && t.benefitValue <= t.priceMonthly && (
                    <div className="mt-2 rounded-lg bg-[#fdf3d8] px-3 py-1.5 text-[11.5px] font-semibold text-[#8a5300]">{tx("p8set.msWarn", { price: t.priceMonthly, benefit: t.benefitValue, suggest: Math.round(t.priceMonthly * 1.25) })}</div>
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
                  <div className="mb-2 text-[12px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-3)]">{t("p8set.msPreview")}</div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {live.map((t) => (
                      <MembershipTierCard key={t.id} tier={t}
                        footer={<div className="rounded-full bg-[var(--brand-2,#2f6bd8)] py-2 text-center text-[12.5px] font-extrabold text-white">{tx("p8set.msJoin", { name: t.name })}</div>} />
                    ))}
                  </div>
                </div>
              );
            })()}
          </Section>
        );
      })()}

      {activeTab === "notifications" && <NotificationsTab />}

      {activeTab === "seasons" && (
        <Section
          title={t("p8set.ssTitle")}
          lede={t("p8set.ssLede")}
        >
          <SeasonsEditor items={settings.seasons ?? []} onChange={(v) => set("seasons", v)} />
        </Section>
      )}

      {activeTab === "bookings" && (
        <>
          <Section
            title={t("p8set.hpTitle")}
            lede={t("p8set.hpLede")}
          >
            <PayMethodEditor items={settings.payMethods} onChange={(v) => set("payMethods", v)} />
            <div className="mt-3 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[11.5px] leading-[1.5] text-[var(--ink-3)]">
              <Rich k="p8set.hpNoteA" slots={{}} />
              <br />
              <br />
              <Rich k="p8set.hpNoteB" slots={{}} />
            </div>
          </Section>
        </>
      )}

      {activeTab === "vouchers" && (
        <>
          <Section
            title={t("p8set.cvTitle")}
            lede={t("p8set.cvLede")}
          >
            <VoucherEditor items={settings.voucherProviders} onChange={(v) => set("voucherProviders", v)} />

            <div className="mt-3 border-t border-dashed border-[var(--line)] pt-2.5">
              <Row
                label={t("p8set.cvHold")}
                hint={t("p8set.cvHoldHint")}
              >
                <NumberBox value={settings.voucherHoldDays} onChange={(n) => set("voucherHoldDays", n)} min={1} max={60} suffix={t("p8set.sfxDays")} />
              </Row>
              <Row
                label={t("p8set.cvMust")}
                hint={t("p8set.cvMustHint")}
              >
                <Select value={String(settings.voucherDueByDays)} onChange={(e) => set("voucherDueByDays", Number(e.target.value))}>
                  <option value="0">{t("p8set.cvBy0")}</option>
                  <option value="1">{t("p8set.cvBy1")}</option>
                  <option value="2">{t("p8set.cvBy2")}</option>
                  <option value="3">{t("p8set.cvBy3")}</option>
                  <option value="7">{t("p8set.cvBy7")}</option>
                </Select>
              </Row>
              <Row
                label={t("p8set.cvSoon")}
                hint={t("p8set.cvSoonHint")}
                note={settings.voucherWhenClose === "approve" ? t("p8set.cvApproveNote") : undefined}
              >
                <Select value={settings.voucherWhenClose} onChange={(e) => set("voucherWhenClose", e.target.value as TenantSettings["voucherWhenClose"])}>
                  <option value="hide">{t("p8set.cvHide")}</option>
                  <option value="warn">{t("p8set.cvWarn")}</option>
                  <option value="approve">{t("p8set.cvApprove")}</option>
                  <option value="normal">{t("p8set.cvNormal")}</option>
                </Select>
              </Row>
              <Row
                label={t("p8set.cvTakes")}
                hint={t("p8set.cvTakesHint")}
              >
                <NumberBox value={settings.voucherClearDays} onChange={(n) => set("voucherClearDays", n)} min={0} max={14} suffix={t("p8set.sfxDays")} />
              </Row>
            </div>

            <div className="mt-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[11.5px] leading-[1.5] text-[var(--ink-3)]">
              <Rich k="p8set.vTfcNote" slots={{}} />
            </div>
          </Section>
        </>
      )}

      {activeTab === "groups" && (
        <>
          <Section
            title={t("p8set.agTitle")}
            lede={t("p8set.agLede")}
          >
            <GroupsEditor groups={settings.ratioGroups} onChange={(v) => set("ratioGroups", v)} />

            {/* One scannable strip: where these groups get used. */}
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {[
                { icon: "📋", head: t("p8set.agHere"), body: t("p8set.agHereBody") },
                { icon: "🎫", head: t("p8set.agListings"), body: t("p8set.agListingsBody") },
                { icon: "⚖️", head: t("p8set.agRatios"), body: t("p8set.agRatiosBody") },
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
