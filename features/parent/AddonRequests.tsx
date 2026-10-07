"use client";

import { useEffect, useState } from "react";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { useT } from "@/lib/i18n/provider";
import { dateLocale as dl } from "@/lib/i18n/format";
import { money } from "@/features/bookings/helpers";
import type { AddonRequest, Booking } from "@/features/bookings/types";

// A family asks to CHANGE (size, colour...) or CANCEL one extra. Never automatic and not the same as cancelling the booking: the request goes to
// the provider, who approves or declines it. The server decides what may be asked (the provider's real options, the cut-off, one request per extra).

interface Line {
  key: string; child: string; label: string; name: string; meal: boolean; price: number;
  block: "none" | "past" | "cutoff" | "pending" | "cancelled";
  canCancel: boolean; canChange: boolean;
  questions: { id: string; label: string; options: string[]; required: boolean }[];
  current: Record<string, string>;
  pending: AddonRequest | null;
  until?: string;
}
interface Options { cutoffDays: number; lines: Line[]; history: AddonRequest[] }

const first = (n: string) => n.trim().split(/\s+/)[0] || "Child";

export function AddonRequests({ booking, providerName, onChanged }: { booking: Booking; providerName?: string; onChanged?: () => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Options | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState<{ key: string; kind: "change" | "cancel"; answers: Record<string, string>; note: string } | null>(null);
  const provider = providerName || t("p9tx.osYourProvider");
  const tenantQ = booking.tenantId ? `?tenantId=${encodeURIComponent(booking.tenantId)}` : "";
  const base = `/api/my/bookings/${encodeURIComponent(booking.ref)}`;

  const load = () => apiGet<Options>(`${base}/addon-options${tenantQ}`).then(setData).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  useEffect(() => { if (open) void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open, booking.ref, (booking.addonRequests ?? []).length]);

  const send = async () => {
    if (!form) return;
    setBusy(true); setError(null);
    try {
      await apiPost(`${base}/addon-requests${tenantQ}`, { key: form.key, kind: form.kind, note: form.note.trim() || undefined, ...(form.kind === "change" ? { answers: form.answers } : {}) });
      setForm(null); setSent(true); await load(); onChanged?.();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  };
  const withdraw = async (id: string) => {
    setBusy(true); setError(null);
    try { await apiPost(`${base}/addon-requests/${encodeURIComponent(id)}/withdraw${tenantQ}`, {}); await load(); onChanged?.(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  };

  if (!(booking.addonLines ?? []).length) return null; // an older booking with only text lines: the family messages the provider
  if (booking.status === "Cancelled" || booking.status === "Declined") return null;
  const btn = "rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-[5px] text-[12px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)] disabled:opacity-50";
  return (
    <div className="mt-2" data-testid="addon-requests-parent">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="text-[12.5px] font-bold text-[var(--brand-2)] underline">{t("p8lst.arOpen")}</button>
      ) : (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[13px] font-extrabold">🎁 {t("p8lst.arTitle")}</div>
            <button type="button" onClick={() => { setOpen(false); setForm(null); setSent(false); }} className="text-[12px] font-bold text-[var(--ink-3)]">{t("p8lst.arBack")}</button>
          </div>
          <p className="mt-1 text-[12px] text-[var(--ink-3)]">{t("p8lst.arIntro")}</p>
          {sent && <div className="mt-2 rounded-lg bg-[#e8f8ee] px-3 py-2 text-[12.5px] font-bold text-[#0f6b34]">{t("p8lst.arSent", { provider })}</div>}
          {error && <div className="mt-2 rounded-lg bg-[#fdebec] px-3 py-2 text-[12.5px] font-bold text-[#c02636]" role="alert">{error}</div>}
          {!data && !error && <div className="mt-2 text-[12px] text-[var(--ink-3)]">…</div>}
          {data?.lines.map((l) => (
            <div key={l.key} className="mt-2.5 border-t border-dashed border-[var(--line)] pt-2.5" data-testid="addon-line">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="text-[13px]"><b>{l.label}</b> <span className="text-[var(--ink-3)]">· {first(l.child)} · {money(l.price)}</span></div>
              </div>
              {l.pending ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12.5px] font-semibold text-[#8a5300]">
                  <span>⏳ {t("p8lst.arPending", { provider })}</span>
                  <button type="button" disabled={busy} onClick={() => withdraw(l.pending!.id)} className={btn}>{t("p8lst.arWithdraw")}</button>
                </div>
              ) : l.block === "cutoff" ? (
                <div className="mt-1 text-[12px] text-[var(--ink-3)]">{t("p8lst.arCutoff", { date: l.until ? new Date(`${l.until}T00:00:00Z`).toLocaleDateString(dl(), { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }) : "" })}</div>
              ) : l.block === "past" ? (
                <div className="mt-1 text-[12px] text-[var(--ink-3)]">{t("p8lst.arPast")}</div>
              ) : form?.key === l.key ? (
                <div className="mt-2 space-y-2">
                  {form.kind === "change" ? l.questions.map((q) => (
                    <label key={q.id} className="block text-[12px] font-bold text-[var(--ink-2)]">
                      {q.label}
                      <select value={form.answers[q.label] ?? l.current[q.label] ?? ""} onChange={(e) => setForm({ ...form, answers: { ...form.answers, [q.label]: e.target.value } })}
                        className="mt-0.5 block w-full max-w-[260px] rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] font-normal text-[var(--ink)]">
                        {q.options.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </label>
                  )) : <div className="text-[12.5px] font-semibold">{t("p8lst.arCancelAsk", { name: l.name, child: first(l.child) })}</div>}
                  <label className="block text-[12px] font-bold text-[var(--ink-2)]">
                    {t("p8lst.arNoteLabel")}
                    <textarea value={form.note} maxLength={300} rows={2} onChange={(e) => setForm({ ...form, note: e.target.value })}
                      className="mt-0.5 block w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] font-normal text-[var(--ink)]" />
                  </label>
                  <div className="flex gap-2">
                    <button type="button" disabled={busy} onClick={send} className="rounded-full bg-[var(--brand)] px-4 py-[6px] text-[12.5px] font-extrabold text-white disabled:opacity-50">{t("p8lst.arSend")}</button>
                    <button type="button" disabled={busy} onClick={() => setForm(null)} className={btn}>{t("p8lst.arBack")}</button>
                  </div>
                </div>
              ) : (
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {l.canChange && <button type="button" className={btn} onClick={() => { setSent(false); setForm({ key: l.key, kind: "change", answers: { ...l.current }, note: "" }); }}>{t("p8lst.arChange")}</button>}
                  {l.canCancel && <button type="button" className={btn} onClick={() => { setSent(false); setForm({ key: l.key, kind: "cancel", answers: {}, note: "" }); }}>{t("p8lst.arCancel")}</button>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
