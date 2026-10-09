"use client";

import { useEffect, useState } from "react";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { useT } from "@/lib/i18n/provider";
import { formatDay } from "@/lib/i18n/format";
import { money } from "@/features/bookings/helpers";
import { requestTargets } from "@/features/bookings/addonRequests";
import type { AddonRequest, Booking } from "@/features/bookings/types";

// A family asks to CHANGE (size, colour...) or CANCEL extras. Never automatic and not the same as cancelling the booking: the request goes to
// the provider, who approves or declines it. Cancelling is ONE request that can cover several days of a daily extra and several extras at once.
// The server decides what may be asked (the provider's real options, the cut-off per day, one request per extra); this only shows it.

interface Day { date: string; state: "none" | "past" | "cutoff" }
interface Line {
  key: string; child: string; label: string; name: string; meal: boolean; price: number;
  block: "none" | "past" | "cutoff" | "pending" | "cancelled";
  canCancel: boolean; canChange: boolean;
  splittable?: boolean; days?: Day[]; changeDays?: string[];
  questions: { id: string; label: string; options: string[]; required: boolean }[];
  current: Record<string, string>;
  pending: AddonRequest | null;
  until?: string;
}
interface Options { cutoffDays: number; lines: Line[]; history: AddonRequest[] }

const first = (n: string) => n.trim().split(/\s+/)[0] || "Child";
const WHOLE = "*";

export function AddonRequests({ booking, providerName, onChanged }: { booking: Booking; providerName?: string; onChanged?: () => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Options | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [mode, setMode] = useState<"menu" | "cancel">("menu");
  // Cancel: for each extra (by key) the ticked days; [WHOLE] = a whole one-off extra.
  const [sel, setSel] = useState<Record<string, string[]>>({});
  const [note, setNote] = useState("");
  // Change: one extra at a time (a choice such as size or colour).
  const [change, setChange] = useState<{ key: string; answers: Record<string, string>; note: string } | null>(null);
  const provider = providerName || t("p9tx.osYourProvider");
  const tenantQ = booking.tenantId ? `?tenantId=${encodeURIComponent(booking.tenantId)}` : "";
  const base = `/api/my/bookings/${encodeURIComponent(booking.ref)}`;
  const dayText = (d: string) => formatDay(d, { weekday: "short", day: "numeric", month: "short" });

  const load = () => apiGet<Options>(`${base}/addon-options${tenantQ}`).then(setData).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  useEffect(() => { if (open) void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open, booking.ref, (booking.addonRequests ?? []).length]);

  const chosen = Object.values(sel).reduce((n, d) => n + d.length, 0);
  const reset = () => { setMode("menu"); setSel({}); setNote(""); setChange(null); };

  const post = async (body: Record<string, unknown>) => {
    setBusy(true); setError(null);
    try { await apiPost(`${base}/addon-requests${tenantQ}`, body); reset(); setSent(true); await load(); onChanged?.(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  };
  const sendCancel = () => {
    const targets = Object.entries(sel).filter(([, d]) => d.length).map(([key, d]) => ({ key, ...(d[0] === WHOLE ? {} : { days: [...d].sort() }) }));
    if (!targets.length) { setError(t("p8lst.arPickSome")); return; }
    void post({ kind: "cancel", targets, note: note.trim() || undefined });
  };
  const sendChange = () => { if (change) void post({ key: change.key, kind: "change", answers: change.answers, note: change.note.trim() || undefined }); };
  const withdraw = async (id: string) => {
    setBusy(true); setError(null);
    try { await apiPost(`${base}/addon-requests/${encodeURIComponent(id)}/withdraw${tenantQ}`, {}); await load(); onChanged?.(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  };
  const toggleDay = (key: string, date: string) => setSel((s) => { const cur = s[key] ?? []; return { ...s, [key]: cur.includes(date) ? cur.filter((x) => x !== date) : [...cur, date] }; });
  const toggleAll = (l: Line) => setSel((s) => {
    const openDays = (l.days ?? []).filter((d) => d.state === "none").map((d) => d.date);
    const all = openDays.length > 0 && openDays.every((d) => (s[l.key] ?? []).includes(d));
    return { ...s, [l.key]: all ? [] : openDays };
  });

  if (!(booking.addonLines ?? []).length) return null; // an older booking with only text lines: the family messages the provider
  if (booking.status === "Cancelled" || booking.status === "Declined") return null;
  const btn = "rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-[5px] text-[12px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)] disabled:opacity-50";
  const pendingRequests = Array.from(new Map((data?.lines ?? []).filter((l) => l.pending).map((l) => [l.pending!.id, l.pending!])).values());
  const askable = (data?.lines ?? []).filter((l) => l.canCancel && !l.pending);
  const changeable = (data?.lines ?? []).filter((l) => l.canChange && !l.pending);
  const pendingLines = new Set(pendingRequests.flatMap((r) => requestTargets(r).map((x) => x.key)));
  const blocked = (data?.lines ?? []).filter((l) => !l.pending && !l.canCancel && !pendingLines.has(l.key));

  return (
    <div className="mt-2" data-testid="addon-requests-parent">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="text-[12.5px] font-bold text-[var(--brand-2)] underline">{t("p8lst.arOpen")}</button>
      ) : (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[13px] font-extrabold">🎁 {t("p8lst.arTitle")}</div>
            <button type="button" onClick={() => { setOpen(false); reset(); setSent(false); }} className="text-[12px] font-bold text-[var(--ink-3)]">{t("p8lst.arBack")}</button>
          </div>
          <p className="mt-1 text-[12px] text-[var(--ink-3)]">{t("p8lst.arIntro")}</p>
          {sent && <div className="mt-2 rounded-lg bg-[var(--green-soft)] px-3 py-2 text-[12.5px] font-bold text-[var(--green)]">{t("p8lst.arSent", { provider })}</div>}
          {error && <div className="mt-2 rounded-lg bg-[var(--red-soft)] px-3 py-2 text-[12.5px] font-bold text-[var(--red)]" role="alert">{error}</div>}
          {!data && !error && <div className="mt-2 text-[12px] text-[var(--ink-3)]">…</div>}

          {pendingRequests.map((r) => (
            <div key={r.id} className="mt-2.5 rounded-lg border border-dashed border-[var(--line)] p-2.5" data-testid="addon-pending-request">
              <div className="flex flex-wrap items-center gap-2 text-[12.5px] font-semibold text-[var(--amber)]">
                <span>⏳ {t("p8lst.arPending", { provider })}</span>
                <button type="button" disabled={busy} onClick={() => withdraw(r.id)} className={btn}>{t("p8lst.arWithdraw")}</button>
              </div>
              <ul className="mt-1.5 space-y-0.5 text-[12.5px] text-[var(--ink-2)]">
                {r.kind === "change"
                  ? <li><b>{r.label}</b> → {r.toLabel}</li>
                  : requestTargets(r).map((x) => (
                    <li key={x.key}><b>{x.label}</b> <span className="text-[var(--ink-3)]">· {first(x.child)}{x.days?.length ? ` · ${t("p8lst.arDaysList", { days: x.days.map(dayText).join(", ") })}` : ""}</span></li>
                  ))}
              </ul>
            </div>
          ))}

          {data && mode === "menu" && !change && (
            <div className="mt-2.5 space-y-2.5">
              {askable.length > 0 && (
                <button type="button" className={btn} data-testid="addon-open-cancel" onClick={() => { setSent(false); setError(null); setMode("cancel"); }}>{t("p8lst.arCancelHead")}</button>
              )}
              {changeable.length > 0 && (
                <div>
                  <div className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("p8lst.arChangeHead")}</div>
                  <div className="flex flex-wrap gap-2">
                    {changeable.map((l) => (
                      <button key={l.key} type="button" className={btn} onClick={() => { setSent(false); setError(null); setChange({ key: l.key, answers: { ...l.current }, note: "" }); }}>
                        {t("p8lst.arChange")}: {l.name} · {first(l.child)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {blocked.map((l) => (
                <div key={l.key} className="text-[12px] text-[var(--ink-3)]">
                  <b>{l.label}</b> · {first(l.child)} — {l.block === "past" ? t("p8lst.arPast") : l.block === "cutoff" ? t("p8lst.arCutoff", { date: l.until ? dayText(l.until) : "" }) : ""}
                </div>
              ))}
            </div>
          )}

          {data && mode === "cancel" && (
            <div className="mt-2.5" data-testid="addon-cancel-form">
              <p className="text-[12px] text-[var(--ink-3)]">{t("p8lst.arBulkIntro")}</p>
              {askable.map((l) => {
                const picked = sel[l.key] ?? [];
                const openDays = (l.days ?? []).filter((d) => d.state === "none");
                return (
                  <div key={l.key} className="mt-2.5 border-t border-dashed border-[var(--line)] pt-2.5" data-testid="addon-line">
                    <div className="text-[13px]"><b>{l.label}</b> <span className="text-[var(--ink-3)]">· {first(l.child)} · {money(l.price)}</span></div>
                    {l.splittable && (l.days?.length ?? 0) > 0 ? (
                      <div className="mt-1.5">
                        <label className="mb-1 flex cursor-pointer items-center gap-2 text-[12.5px] font-bold">
                          <input type="checkbox" checked={openDays.length > 0 && openDays.every((d) => picked.includes(d.date))} onChange={() => toggleAll(l)} />
                          {t("p8lst.arAllDays")}
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {(l.days ?? []).map((d) => {
                            const on = picked.includes(d.date);
                            const dead = d.state !== "none";
                            return (
                              <label key={d.date} title={dead ? (d.state === "past" ? t("p8lst.arPast") : t("p8lst.arDayClosed")) : undefined}
                                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-[5px] text-[12px] font-bold ${dead ? "cursor-not-allowed border-[var(--line)] bg-transparent text-[var(--ink-3)] opacity-60 line-through" : on ? "cursor-pointer border-[var(--brand-2)] bg-[var(--brand-soft)] text-[var(--brand-ink)]" : "cursor-pointer border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)]"}`}>
                                <input type="checkbox" className="sr-only" disabled={dead} checked={on} onChange={() => toggleDay(l.key, d.date)} />
                                {dayText(d.date)}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <label className="mt-1.5 flex cursor-pointer items-center gap-2 text-[12.5px] font-bold">
                        <input type="checkbox" checked={picked[0] === WHOLE} onChange={() => setSel((s) => ({ ...s, [l.key]: s[l.key]?.[0] === WHOLE ? [] : [WHOLE] }))} />
                        {t("p8lst.arWholeExtra")}
                      </label>
                    )}
                  </div>
                );
              })}
              <label className="mt-3 block text-[12px] font-bold text-[var(--ink-2)]">
                {t("p8lst.arNoteLabel")}
                <textarea value={note} maxLength={300} rows={2} onChange={(e) => setNote(e.target.value)}
                  className="mt-0.5 block w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] font-normal text-[var(--ink)]" />
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" disabled={busy || chosen === 0} onClick={sendCancel} data-testid="addon-send-cancel"
                  className="rounded-full bg-[var(--brand)] px-4 py-[6px] text-[12.5px] font-extrabold text-white disabled:opacity-50">{t("p8lst.arSendBulk", { n: chosen })}</button>
                <button type="button" disabled={busy} onClick={reset} className={btn}>{t("p8lst.arBack")}</button>
              </div>
            </div>
          )}

          {data && change && (() => {
            const l = data.lines.find((x) => x.key === change.key);
            if (!l) return null;
            return (
              <div className="mt-2.5 space-y-2" data-testid="addon-change-form">
                <div className="text-[13px]"><b>{l.label}</b> <span className="text-[var(--ink-3)]">· {first(l.child)}</span></div>
                {l.changeDays && l.days && l.changeDays.length > 0 && l.changeDays.length < l.days.length && (
                  <div className="text-[12px] text-[var(--ink-3)]">{t("p8lst.arDaysList", { days: l.changeDays.map(dayText).join(", ") })}</div>
                )}
                {l.questions.map((q) => (
                  <label key={q.id} className="block text-[12px] font-bold text-[var(--ink-2)]">
                    {q.label}
                    <select value={change.answers[q.label] ?? l.current[q.label] ?? ""} onChange={(e) => setChange({ ...change, answers: { ...change.answers, [q.label]: e.target.value } })}
                      className="mt-0.5 block w-full max-w-[260px] rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] font-normal text-[var(--ink)]">
                      {q.options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </label>
                ))}
                <label className="block text-[12px] font-bold text-[var(--ink-2)]">
                  {t("p8lst.arNoteLabel")}
                  <textarea value={change.note} maxLength={300} rows={2} onChange={(e) => setChange({ ...change, note: e.target.value })}
                    className="mt-0.5 block w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] font-normal text-[var(--ink)]" />
                </label>
                <div className="flex gap-2">
                  <button type="button" disabled={busy} onClick={sendChange} className="rounded-full bg-[var(--brand)] px-4 py-[6px] text-[12.5px] font-extrabold text-white disabled:opacity-50">{t("p8lst.arSend")}</button>
                  <button type="button" disabled={busy} onClick={reset} className={btn}>{t("p8lst.arBack")}</button>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
