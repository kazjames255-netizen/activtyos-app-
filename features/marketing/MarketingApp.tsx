"use client";

import { dateLocale as dl } from "@/lib/i18n/format";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { api, get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { money } from "@/features/bookings/helpers";
import { Badge, Button, Card, FieldLabel, Input, Select } from "@/components/ui";
import { TourLauncher } from "@/features/common/TourLauncher";
import { useT } from "@/lib/i18n/provider";
import { rich } from "@/features/money/rich";

const LIGHT_PALETTE = {
  "--bg": "#f5f8fd", "--surface": "#ffffff", "--panel": "#fbf8fc",
  "--ink": "#171534", "--ink-2": "#4a4763", "--ink-3": "#8a86a3", "--line": "#ece6f1",
} as CSSProperties;

interface Code {
  id: string;
  code: string;
  type: "percent" | "amount" | "perAttendee";
  value: number;
  minSpend?: number;
  expiry?: string;
  usageLimit?: number;
  usedCount?: number;
  active?: boolean;
  assignedTo?: string;
  assignedName?: string;
  assignedGroupId?: string;
  assignedGroupName?: string;
  assignedEmails?: string[];
  listingId?: string;
  perCustomerLimit?: boolean;
  exclusive?: boolean;
}
interface Family { id: string; name?: string; email?: string }
interface Listing { id: string; title?: string; name?: string }
interface Group { id: string; name: string; emails: string[] }
const rand = (n: number) => Math.random().toString(36).slice(2, 2 + n).toUpperCase();
const randomCode = () => "SAVE" + rand(5);
const surnameOf = (name: string) => (name.trim().split(/\s+/).pop() || "FAM").replace(/[^A-Za-z]/g, "").toUpperCase() || "FAMILY";
// A friendly code from a family's surname + this year, e.g. "KHAN2026".
const codeFromFamily = (name: string) => `${surnameOf(name)}${new Date().getFullYear()}`;
const fmt = (iso?: string) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString(dl(), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");
const todayIso = () => new Date().toISOString().slice(0, 10);
const isExpired = (c: Code) => !!c.expiry && c.expiry < todayIso();
const isSpent = (c: Code) => c.usageLimit != null && (c.usedCount ?? 0) >= c.usageLimit;

// Parent groups — named sets of families (e.g. "NHS parents") to send a code to
// all at once. Managed here in the discount-codes area; a code's "…or a group"
// picker reads them.
function GroupsManager({ families, groups, reload }: { families: Family[]; groups: Group[]; reload: () => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [emails, setEmails] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const emailable = families.filter((x) => x.email);
  const start = (g?: Group) => { setEditId(g?.id ?? null); setName(g?.name ?? ""); setEmails(g?.emails ?? []); setErr(null); setOpen(true); setPanelOpen(true); };
  const toggle = (email: string) => setEmails((es) => (es.includes(email) ? es.filter((x) => x !== email) : [...es, email]));
  async function save() {
    if (!name.trim()) { setErr(t("p8fin.mkGroupNameReq")); return; }
    try {
      if (editId) await api(`/api/discounts/groups/${encodeURIComponent(editId)}`, { method: "PUT", body: JSON.stringify({ name, emails }) });
      else await apiPost("/api/discounts/groups", { name, emails });
      setOpen(false); setEditId(null); reload();
    } catch (e) { setErr(e instanceof Error ? e.message : t("p8fin.mkGroupSaveErr")); }
  }
  async function remove(g: Group) { if (!confirm(t("p8fin.mkConfirmDeleteGroup", { name: g.name }))) return; try { await api(`/api/discounts/groups/${encodeURIComponent(g.id)}`, { method: "DELETE" }); reload(); } catch {} }

  return (
    <Card className="mb-3.5 p-4">
      <button type="button" onClick={() => setPanelOpen((o) => !o)} className="flex w-full items-center justify-between text-start">
        <span className="text-[14px] font-extrabold">{t("p8fin.mkParentGroups")} <span className="ms-1 font-normal text-[var(--ink-3)]">{t("p8fin.mkParentGroupsHint")}</span></span>
        <span className="text-[var(--ink-3)]">{panelOpen ? "▲" : "▼"}</span>
      </button>
      {panelOpen && (
        <div className="mt-3">
          <div className="flex flex-wrap gap-2">
            {groups.length === 0 && !open && <span className="text-[12.5px] text-[var(--ink-3)]">{t("p8fin.mkNoGroups")}</span>}
            {groups.map((g) => (
              <span key={g.id} className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[12px]">
                <b>{g.name}</b><span className="text-[var(--ink-3)]">{t("p8fin.mkFamiliesN", { n: g.emails.length })}</span>
                <button type="button" onClick={() => start(g)} className="font-bold text-[var(--brand-2)]">{t("p8fin.gEdit")}</button>
                <button type="button" onClick={() => remove(g)} className="font-bold text-[var(--red,#e21d27)]">✕</button>
              </span>
            ))}
            {!open && <button type="button" onClick={() => start()} className="rounded-full bg-[var(--brand-2)] px-3 py-1.5 text-[12px] font-bold text-white">{t("p8fin.mkNewGroup")}</button>}
          </div>

          {open && (
            <div className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
              <FieldLabel>{t("p8fin.mkGroupName")}</FieldLabel>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("p8fin.mkGroupNamePh")} className="w-full" />
              <div className="mt-2.5 flex items-baseline justify-between">
                <FieldLabel>{t("p8fin.mkMembers")} <span className="font-normal text-[var(--ink-3)]">{t("p8fin.mkSelectedN", { n: emails.length })}</span></FieldLabel>
                <button type="button" onClick={() => setEmails(emails.length === emailable.length ? [] : emailable.map((x) => x.email!))} className="text-[11px] font-bold text-[var(--brand-2)]">{emails.length === emailable.length ? t("p8fin.mkClearAll") : t("p8fin.mkSelectAll")}</button>
              </div>
              <div className="mt-1 max-h-[220px] overflow-auto rounded-lg border border-[var(--line)] bg-[var(--surface)] p-1">
                {emailable.length === 0 && <div className="p-2 text-[12px] text-[var(--ink-3)]">{t("p8fin.mkNoEmailFamilies")}</div>}
                {emailable.map((x) => (
                  <label key={x.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[12.5px] hover:bg-[var(--panel)]">
                    <input type="checkbox" checked={emails.includes(x.email!)} onChange={() => toggle(x.email!)} className="h-4 w-4 accent-[var(--brand-2)]" />
                    <span className="truncate">{x.name || x.email}</span>
                    {x.name && <span className="truncate text-[11px] text-[var(--ink-3)]">{x.email}</span>}
                  </label>
                ))}
              </div>
              {err && <div className="mt-1.5 text-[11.5px] text-[var(--red,#e21d27)]">{err}</div>}
              <div className="mt-2.5 flex gap-2">
                <Button variant="primary" onClick={save}>{editId ? t("p8fin.mkSaveGroup") : t("p8fin.mkCreateGroup")}</Button>
                <Button onClick={() => { setOpen(false); setEditId(null); }}>{t("p8fin.gCancel")}</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export function MarketingApp() {
  const t = useT();
  const [codes, setCodes] = useState<Code[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [families, setFamilies] = useState<Family[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const empty = { code: "", type: "percent", value: "", minSpend: "", expiry: "", usageLimit: "", assignedTo: "", assignedName: "", assignedGroupId: "", listingId: "", perCustomerLimit: false, exclusive: false };
  const [f, setF] = useState(empty);
  const set = (patch: Partial<typeof f>) => setF((p) => ({ ...p, ...patch }));

  // Generate a genuinely NEW code every press: name-based (SURNAME+year+2) when
  // a family is reserved, random otherwise — and never one that already exists
  // or matches what's in the box, so a code is never silently reused.
  function freshCode(): string {
    const taken = new Set([...(codes ?? []).map((c) => c.code.toUpperCase()), f.code.toUpperCase()]);
    const make = () => (f.assignedName ? `${surnameOf(f.assignedName)}${new Date().getFullYear()}${rand(2)}` : randomCode());
    let code = make();
    for (let i = 0; i < 40 && taken.has(code.toUpperCase()); i++) code = make();
    return code;
  }

  const refresh = useCallback(() => {
    apiGet<Code[]>("/api/discounts").then((c) => { setCodes(c); setError(null); }).catch((e) => setError(e instanceof Error ? e.message : t("p8fin.gLoadFailed")));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { apiGet<Family[]>("/api/customers").then((cs) => setFamilies(cs.filter((c) => c.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)))).catch(() => {}); }, []);
  useEffect(() => { apiGet<Listing[]>("/api/listings?mine=1").then(setListings).catch(() => {}); }, []);
  const loadGroups = useCallback(() => { apiGet<Group[]>("/api/discounts/groups").then(setGroups).catch(() => {}); }, []);
  useEffect(() => { loadGroups(); }, [loadGroups]);
  useRealtime(["discountCodes"], refresh);

  function openCreate() { setEditId(null); setF(empty); setError(null); setOpen(true); }
  function openEdit(c: Code) {
    setEditId(c.id);
    setF({ code: c.code, type: c.type, value: String(c.value), minSpend: c.minSpend != null ? String(c.minSpend) : "", expiry: c.expiry ?? "", usageLimit: c.usageLimit != null ? String(c.usageLimit) : "", assignedTo: c.assignedTo ?? "", assignedName: c.assignedName ?? "", assignedGroupId: c.assignedGroupId ?? "", listingId: c.listingId ?? "", perCustomerLimit: !!c.perCustomerLimit, exclusive: !!c.exclusive });
    setError(null); setOpen(true);
  }

  async function save() {
    const value = Number(f.value);
    if (!f.code.trim() || !value || value <= 0) { setError(t("p8fin.mkNeedCodeValue")); return; }
    if (f.type === "percent" && value > 100) { setError(t("p8fin.mkPctMax")); return; }
    // On edit, a blank/unticked field must be sent explicitly (null / false) — an omitted key means "leave as is",
    // so before this an expiry, cap or "one use per customer" tick could never be removed once saved.
    const clr = <T,>(v: T | undefined): T | null | undefined => (v === undefined && editId ? null : v);
    const payload = {
      code: f.code, type: f.type, value,
      minSpend: clr(f.minSpend ? Number(f.minSpend) : undefined),
      expiry: clr(f.expiry || undefined),
      usageLimit: clr(f.usageLimit ? Number(f.usageLimit) : undefined),
      assignedTo: clr(f.assignedTo || undefined),
      assignedName: clr(f.assignedName || undefined),
      // Sent as "" on edit so deselecting a group actually clears it.
      assignedGroupId: editId ? f.assignedGroupId : (f.assignedGroupId || undefined),
      listingId: clr(f.listingId || undefined),
      perCustomerLimit: editId ? f.perCustomerLimit : (f.perCustomerLimit || undefined),
      exclusive: editId ? f.exclusive : (f.exclusive || undefined),
    };
    try {
      if (editId) await api(`/api/discounts/${encodeURIComponent(editId)}`, { method: "PUT", body: JSON.stringify(payload) });
      else await apiPost("/api/discounts", payload);
      setF(empty); setEditId(null); setOpen(false); refresh();
    } catch (e) { setError(e instanceof Error ? e.message : t("p8fin.mkSaveErr")); }
  }
  async function toggle(c: Code) { try { await api(`/api/discounts/${encodeURIComponent(c.id)}`, { method: "PUT", body: JSON.stringify({ active: !(c.active !== false) }) }); refresh(); } catch (e) { setError(e instanceof Error ? e.message : t("p8fin.gFailed")); } }
  async function remove(c: Code) { if (!confirm(t("p8fin.mkConfirmDeleteCode", { code: c.code }))) return; try { await api(`/api/discounts/${encodeURIComponent(c.id)}`, { method: "DELETE" }); refresh(); } catch (e) { setError(e instanceof Error ? e.message : t("p8fin.gFailed")); } }

  const valueLabel = (c: Code) => (c.type === "percent" ? t("p8fin.mkPctOff", { value: c.value }) : c.type === "perAttendee" ? t("p8fin.mkAmtOffChild", { amount: money(c.value) }) : t("p8fin.mkAmtOff", { amount: money(c.value) }));
  const listingName = (id?: string) => { const l = listings.find((x) => x.id === id); return l ? (l.title || l.name || t("p8fin.mkAListing")) : null; };
  const statusBadge = (c: Code) => {
    if (c.active === false) return <Badge tone={{ bg: "var(--panel)", fg: "var(--ink-3)" }}>{t("p8fin.mkPaused")}</Badge>;
    if (isExpired(c)) return <Badge tone={{ bg: "var(--red-soft,#fdebec)", fg: "var(--red,#e21d27)" }}>{t("p8fin.mkExpired")}</Badge>;
    if (isSpent(c)) return <Badge tone={{ bg: "var(--red-soft,#fdebec)", fg: "var(--red,#e21d27)" }}>{t("p8fin.mkUsedUp")}</Badge>;
    return <Badge tone={{ bg: "#eaf0fc", fg: "#1d3a8f" }}>{t("p8fin.mkActive")}</Badge>;
  };

  const activeCount = (codes ?? []).filter((c) => c.active !== false && !isExpired(c) && !isSpent(c)).length;
  const totalRedemptions = (codes ?? []).reduce((s, c) => s + (c.usedCount ?? 0), 0);

  return (
    <div className="-m-5 min-h-[calc(100vh-3.5rem)] bg-[var(--bg)] p-5 text-[var(--ink)]" style={LIGHT_PALETTE}>
      {/* Hero */}
      <div className="mb-4 overflow-hidden rounded-2xl p-5 text-white shadow-[0_10px_30px_-12px_rgba(29,58,143,.55)]" style={{ background: "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 100%)" }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[22px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[17px]">🏷️</span>
              {t("p8fin.mkTitle")}
            </div>
            <p className="mt-1.5 max-w-[540px] text-[12.5px] leading-[1.5] text-white/85">{t("p8fin.mkIntro")}</p>
          </div>
          <div className="flex flex-none flex-wrap items-center gap-2">
            <TourLauncher view="marketing" compact />
            {!open && (
              <button type="button" onClick={openCreate} className="z-10 flex-none rounded-full bg-[#1d3a8f] px-4 py-2 text-[13px] font-extrabold text-white shadow-md transition-transform hover:-translate-y-px">{t("p8fin.mkNewCode")}</button>
            )}
          </div>
        </div>
        {codes && codes.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2.5">
            <div className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur-sm"><div className="text-[20px] font-extrabold leading-none">{activeCount}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/80">{t("p8fin.mkStatActive")}</div></div>
            <div className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur-sm"><div className="text-[20px] font-extrabold leading-none">{totalRedemptions}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/80">{t("p8fin.mkStatRedemptions")}</div></div>
            <div className="rounded-xl bg-white/15 px-4 py-2 backdrop-blur-sm"><div className="text-[20px] font-extrabold leading-none">{codes.length}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white/80">{t("p8fin.mkStatTotal")}</div></div>
          </div>
        )}
      </div>
      {error && <div className="mb-3 rounded-lg border border-[var(--red-line,#f6c9cc)] bg-[var(--red-soft,#fdebec)] px-3 py-2 text-[12.5px] text-[var(--red,#e21d27)]">{error}</div>}

      {open && (
        <Card className="mb-3.5 p-4">
          <div className="mb-3 text-[14px] font-extrabold">{editId ? t("p8fin.mkEditCode") : t("p8fin.mkNewCodeTitle")}</div>
          <div className="grid gap-2.5 sm:grid-cols-3">
            <div>
              <div className="flex items-baseline justify-between"><FieldLabel>{t("p8fin.mkCode")}</FieldLabel><button type="button" onClick={() => set({ code: freshCode() })} className="text-[11px] font-bold text-[var(--brand-2)]">{f.assignedName ? t("p8fin.mkGenFromName") : t("p8fin.mkGenerate")}</button></div>
              <Input value={f.code} onChange={(e) => set({ code: e.target.value.toUpperCase() })} placeholder={t("p8fin.mkCodePh")} className="w-full uppercase" />
            </div>
            <div><FieldLabel>{t("p8fin.mkDiscountType")}</FieldLabel><Select value={f.type} onChange={(e) => set({ type: e.target.value })} className="w-full"><option value="percent">{t("p8fin.mkTypePercent")}</option><option value="amount">{t("p8fin.mkTypeAmount")}</option><option value="perAttendee">{t("p8fin.mkTypePerAttendee")}</option></Select></div>
            <div><FieldLabel>{f.type === "percent" ? t("p8fin.mkValuePercent") : f.type === "perAttendee" ? t("p8fin.mkValuePerChild") : t("p8fin.mkValueAmount")}</FieldLabel><Input type="number" min="0" step={f.type === "percent" ? "1" : "0.01"} value={f.value} onChange={(e) => set({ value: e.target.value })} className="w-full" /></div>
            <div><FieldLabel>{t("p8fin.mkMinSpend")}</FieldLabel><Input type="number" min="0" step="0.01" value={f.minSpend} onChange={(e) => set({ minSpend: e.target.value })} placeholder={t("p8fin.mkOptional")} className="w-full" /></div>
            <div><FieldLabel>{t("p8fin.mkExpiry")}</FieldLabel><Input type="date" value={f.expiry} onChange={(e) => set({ expiry: e.target.value })} className="w-full" /><p className="mt-1 text-[11px] leading-[1.35] text-[var(--ink-3)]">{t("p8fin.mkExpiryHint")}</p></div>
            <div><FieldLabel>{t("p8fin.mkUsageLimit")}</FieldLabel><Input type="number" min="1" step="1" value={f.usageLimit} onChange={(e) => set({ usageLimit: e.target.value })} placeholder={t("p8fin.mkUnlimited")} className="w-full" /><p className="mt-1 text-[11px] leading-[1.35] text-[var(--ink-3)]">{t("p8fin.mkUsageHint")}</p></div>
            <div>
              <FieldLabel>{t("p8fin.mkAppliesTo")}</FieldLabel>
              <Select value={f.listingId} onChange={(e) => set({ listingId: e.target.value })} className="w-full">
                <option value="">{t("p8fin.recAllListings")}</option>
                {listings.map((l) => <option key={l.id} value={l.id}>{l.title || l.name || t("p8fin.mkUntitledListing")}</option>)}
              </Select>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
            <label className="flex cursor-pointer items-center gap-2 text-[12.5px] font-semibold text-[var(--ink-2)]">
              <input type="checkbox" checked={f.perCustomerLimit} onChange={(e) => set({ perCustomerLimit: e.target.checked })} className="h-4 w-4 accent-[var(--brand-2)]" />
              {t("p8fin.mkOnePerCustomer")}
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-[12.5px] font-semibold text-[var(--ink-2)]">
              <input type="checkbox" checked={f.exclusive} onChange={(e) => set({ exclusive: e.target.checked })} className="h-4 w-4 accent-[var(--brand-2)]" />
              {t("p8fin.mkNoCombine")}
            </label>
          </div>

          {/* Reserve for a single family OR a whole group — either way, only they
              can redeem it and each one gets a message + email. */}
          <div className="mt-3 grid gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3 sm:grid-cols-2">
            <div>
              <FieldLabel>{t("p8fin.mkReserveOne")}</FieldLabel>
              <Select
                value={f.assignedTo}
                onChange={(e) => {
                  const fam = families.find((x) => x.email === e.target.value);
                  if (!fam) { set({ assignedTo: "", assignedName: "" }); return; }
                  const name = fam.name || fam.email || "";
                  set({ assignedTo: fam.email || "", assignedName: name, assignedGroupId: "", code: f.code.trim() ? f.code : codeFromFamily(name) });
                }}
                className="w-full"
              >
                <option value="">{t("p8fin.mkAnyoneCanUse")}</option>
                {families.map((c) => <option key={c.id} value={c.email}>{c.name || c.email}</option>)}
              </Select>
            </div>
            <div>
              <FieldLabel>{t("p8fin.mkOrAGroup")}</FieldLabel>
              <Select
                value={f.assignedGroupId}
                onChange={(e) => set({ assignedGroupId: e.target.value, ...(e.target.value ? { assignedTo: "", assignedName: "" } : {}) })}
                className="w-full"
              >
                <option value="">{t("p8fin.mkNoGroup")}</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.emails.length})</option>)}
              </Select>
            </div>
            <div className="sm:col-span-2">
              {f.assignedTo
                ? <div className="text-[11.5px] text-[var(--ink-3)]">{rich(t("p8fin.mkOnlyFamily", { name: f.assignedName || f.assignedTo }))}</div>
                : f.assignedGroupId
                ? <div className="text-[11.5px] text-[var(--ink-3)]">{rich(t("p8fin.mkOnlyGroup", { name: groups.find((g) => g.id === f.assignedGroupId)?.name ?? "", n: groups.find((g) => g.id === f.assignedGroupId)?.emails.length ?? 0 }))}</div>
                : <div className="text-[11.5px] leading-[1.5] text-[var(--ink-3)]">{rich(t("p8fin.mkAnyoneNote"))}</div>}
            </div>
          </div>

          <div className="mt-3 flex gap-2"><Button variant="primary" onClick={save}>{editId ? t("p8fin.mkSaveChanges") : t("p8fin.mkCreateCode")}</Button><Button onClick={() => { setOpen(false); setEditId(null); }}>{t("p8fin.gCancel")}</Button></div>
        </Card>
      )}

      <GroupsManager families={families} groups={groups} reload={loadGroups} />

      {!codes ? <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">{t("p8fin.gLoading")}</div>
      : codes.length === 0 ? <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">{t("p8fin.mkNoCodes")}</Card>
      : (
        <div className="flex flex-col gap-2.5">
          {codes.map((c) => {
            const live = c.active !== false && !isExpired(c) && !isSpent(c);
            const accent = live ? "#3f78d8" : c.active === false ? "#8a86a3" : "#e21d27";
            const railBg = live ? "linear-gradient(180deg,#4f8bf5,#1d3a8f)" : accent;
            const pct = c.usageLimit != null && c.usageLimit > 0 ? Math.min(100, Math.round(((c.usedCount ?? 0) / c.usageLimit) * 100)) : null;
            return (
              <div key={c.id} data-ui="card" className="flex items-stretch overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[0_1px_3px_rgba(20,30,60,.06)] transition-shadow hover:shadow-[0_8px_24px_-14px_rgba(20,30,60,.4)]">
                <span className="w-1.5 flex-none" style={{ background: railBg }} />
                <div className="flex flex-1 flex-wrap items-center gap-3 px-4 py-3">
                  <span className="rounded-lg border border-dashed border-[var(--brand-line,#cdddf7)] bg-[var(--brand-soft,#eaf0fc)] px-2.5 py-1 font-mono text-[14px] font-extrabold tracking-wider text-[var(--brand-strong,#16306e)]">{c.code}</span>
                  <span className="rounded-full bg-[#e8ecfb] px-2.5 py-1 text-[12.5px] font-extrabold text-[#2f3fa8]">{valueLabel(c)}</span>
                  {statusBadge(c)}
                  <div className="min-w-[140px] flex-1">
                    <div className="text-[11.5px] text-[var(--ink-3)]">
                      {c.assignedTo ? t("p8fin.mkOnlyFor", { name: c.assignedName || c.assignedTo }) : ""}
                      {c.assignedGroupName ? `👥 ${c.assignedGroupName} (${c.assignedEmails?.length ?? 0}) · ` : ""}
                      {c.listingId && listingName(c.listingId) ? t("p8fin.mkListingOnly", { name: listingName(c.listingId) ?? "" }) : ""}
                      {c.perCustomerLimit ? t("p8fin.mkOnePerCust") : ""}
                      {c.exclusive ? t("p8fin.mkNoCombining") : ""}
                      {c.minSpend ? t("p8fin.mkMinSpendTag", { amount: money(c.minSpend) }) : ""}
                      {c.usageLimit != null ? t("p8fin.mkUsedOf", { used: c.usedCount ?? 0, limit: c.usageLimit }) : t("p8fin.mkUsed", { used: c.usedCount ?? 0 })}
                      {c.expiry ? t("p8fin.mkExpiresOn", { date: fmt(c.expiry) }) : ""}
                    </div>
                    {pct != null && (
                      <div className="mt-1 h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-[var(--panel)]">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: accent }} />
                      </div>
                    )}
                  </div>
                  <div className="ms-auto flex gap-2">
                    <Button sm onClick={() => openEdit(c)}>{t("p8fin.gEdit")}</Button>
                    <Button sm onClick={() => toggle(c)}>{c.active === false ? t("p8fin.mkResume") : t("p8fin.mkPause")}</Button>
                    <Button sm variant="danger" onClick={() => remove(c)}>{t("p8fin.gDelete")}</Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
