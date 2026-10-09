"use client";

import { useEffect, useState } from "react";
import { del, get, post, patch } from "@/lib/api";
import { currentLocaleCode, uiDate } from "@/lib/i18n/format";
import { isRTL } from "@/lib/i18n/config";
import { useT } from "@/lib/i18n/provider";

// HQ management for the /demo page's bookable call slots — a weekly recurring
// template (day + time), toggled on/off, that the public page turns into real
// open instances for the next 7 days (server/src/routes/demoSlots.ts). No
// cleanup needed to remove future availability: switching a template off just
// stops it generating instances from that point on.
//
// The actual booked calls live in their own tab — see VideoCallsPanel.tsx.

interface Template { id: string; weekday: number; time: string; durationMins: number; active: boolean }
interface Blackout { id: string; from: string; to: string; note: string }

// Weekday names follow the active language (index 0 = Sunday, matching the stored `weekday` number).
const weekdayName = (i: number) => uiDate(new Date(2024, 0, 7 + i), { weekday: "long" });
const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }); // raw-locale-ok: machine date key, not shown to anyone
const todayKey = () => dayKey.format(new Date());

export function DemoSlotsPanel() {
  const t = useT();
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [blackouts, setBlackouts] = useState<Blackout[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ weekday: 1, time: "10:00", durationMins: 30 });
  const [saving, setSaving] = useState(false);
  const [blockingOut, setBlockingOut] = useState(false);
  const [blockDraft, setBlockDraft] = useState({ from: todayKey(), to: todayKey(), note: "" });
  const [blockSaving, setBlockSaving] = useState(false);

  const refresh = () => {
    get<Template[]>("/api/platform/demo-slot-templates")
      .then((rows) => setTemplates([...rows].sort((a, b) => a.weekday - b.weekday || a.time.localeCompare(b.time))))
      .catch((e) => setError(e instanceof Error ? e.message : t("p8hq.dmLoadFail")));
    get<Blackout[]>("/api/platform/demo-slot-blackouts")
      .then((rows) => setBlackouts([...rows].sort((a, b) => a.from.localeCompare(b.from))))
      .catch((e) => setError(e instanceof Error ? e.message : t("p8hq.dmLoadBlockFail")));
  };
  useEffect(() => { refresh(); }, []);

  const addBlackout = async () => {
    setBlockSaving(true); setError(null);
    try {
      await post("/api/platform/demo-slot-blackouts", blockDraft);
      setBlockingOut(false);
      setBlockDraft({ from: todayKey(), to: todayKey(), note: "" });
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("p8hq.dmBlockFail"));
    } finally {
      setBlockSaving(false);
    }
  };
  const removeBlackout = (id: string) => {
    setBlackouts((prev) => prev?.filter((x) => x.id !== id) ?? prev);
    del(`/api/platform/demo-slot-blackouts/${id}`).catch((e) => { setError(e instanceof Error ? e.message : t("p8hq.dmRemoveFail")); refresh(); });
  };

  const toggle = (tpl: Template) => {
    setTemplates((prev) => prev?.map((x) => (x.id === tpl.id ? { ...x, active: !x.active } : x)) ?? prev);
    patch(`/api/platform/demo-slot-templates/${tpl.id}`, { active: !tpl.active }).catch((e) => {
      setError(e instanceof Error ? e.message : t("p8hq.dmSaveFail"));
      refresh();
    });
  };

  const remove = (id: string) => {
    if (!confirm(t("p8hq.dmConfirmRemove"))) return;
    setTemplates((prev) => prev?.filter((x) => x.id !== id) ?? prev);
    del(`/api/platform/demo-slot-templates/${id}`).catch((e) => { setError(e instanceof Error ? e.message : t("p8hq.dmDeleteFail")); refresh(); });
  };

  const add = async () => {
    setSaving(true); setError(null);
    try {
      await post("/api/platform/demo-slot-templates", draft);
      setAdding(false);
      setDraft({ weekday: 1, time: "10:00", durationMins: 30 });
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("p8hq.dmAddFail"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[15px] font-extrabold text-[var(--ink)]">{t("p8hq.dmTitle")}</h3>
          <p className="mt-0.5 max-w-[560px] text-[12px] text-[var(--ink-3)]">
            {t("p8hq.dmIntro")}
          </p>
        </div>
        <button type="button" onClick={() => setAdding(true)} className="rounded-full bg-[#1d3a8f] px-4 py-2 text-[12.5px] font-extrabold text-white hover:brightness-105">{t("p8hq.dmAdd")}</button>
      </div>

      {error && <div className="mt-3 rounded-lg bg-[#fdebec] px-3 py-2 text-[12px] font-bold text-[var(--red)]">{error}</div>}

      {adding && (
        <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3.5">
          <div>
            <label className="mb-1 block text-[10.5px] font-extrabold uppercase text-[var(--ink-3)]">{t("p8hq.dmDay")}</label>
            <select value={draft.weekday} onChange={(e) => setDraft({ ...draft, weekday: Number(e.target.value) })} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] font-bold text-[var(--ink)]">
              {WEEKDAYS.map((i) => <option key={i} value={i}>{weekdayName(i)}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[10.5px] font-extrabold uppercase text-[var(--ink-3)]">{t("p8hq.dmTimeUk")}</label>
            <input type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] font-bold text-[var(--ink)]" />
          </div>
          <div>
            <label className="mb-1 block text-[10.5px] font-extrabold uppercase text-[var(--ink-3)]">{t("p8hq.dmLength")}</label>
            <input type="number" min={10} max={240} step={5} value={draft.durationMins} onChange={(e) => setDraft({ ...draft, durationMins: Number(e.target.value) })} className="w-20 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] font-bold text-[var(--ink)]" />
          </div>
          <button type="button" disabled={saving} onClick={add} className="rounded-full bg-[#0f7a43] px-4 py-2 text-[12.5px] font-extrabold text-white disabled:opacity-60">{saving ? t("p8hq.slSaving") : t("p8hq.slSave")}</button>
          <button type="button" onClick={() => setAdding(false)} className="text-[12.5px] font-bold text-[var(--ink-3)]">{t("p8hq.slCancel")}</button>
        </div>
      )}

      <div className="mt-3.5 flex flex-col gap-2">
        {!templates ? (
          <div className="py-6 text-center text-[12.5px] text-[var(--ink-3)]">{t("p8hq.clLoading")}</div>
        ) : templates.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--line)] px-4 py-6 text-center text-[12.5px] text-[var(--ink-3)]">{t("p8hq.dmNone")}</div>
        ) : templates.map((tpl) => (
          <div key={tpl.id} data-ui="card" className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
            <span className="w-[90px] flex-none text-[13px] font-extrabold text-[var(--ink)]">{weekdayName(tpl.weekday)}</span>
            <span className="text-[13px] font-bold text-[var(--ink-2)]">{tpl.time}</span>
            <span className="text-[11.5px] text-[var(--ink-3)]">{t("p8hq.dmMins", { n: tpl.durationMins })}</span>
            <span className="ms-auto flex items-center gap-2">
              <button type="button" onClick={() => toggle(tpl)} className={`rounded-full px-3.5 py-1.5 text-[11.5px] font-extrabold ${tpl.active ? "bg-[#e7f6ee] text-[#0f7a43]" : "bg-[var(--panel)] text-[var(--ink-3)]"}`}>
                {tpl.active ? t("p8hq.dmOn") : t("p8hq.dmOff")}
              </button>
              <button type="button" onClick={() => remove(tpl.id)} className="rounded-full border border-[var(--line)] px-3 py-1.5 text-[11.5px] font-bold text-[var(--red,#c0392b)] hover:bg-[#fdebec]">{t("p8hq.dmRemove")}</button>
            </span>
          </div>
        ))}
      </div>

      <div className="mt-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-[15px] font-extrabold text-[var(--ink)]">{t("p8hq.dmNotAvail")}</h3>
            <p className="mt-0.5 max-w-[560px] text-[12px] text-[var(--ink-3)]">
              {t("p8hq.dmNotAvailHelp")}
            </p>
          </div>
          <button type="button" onClick={() => setBlockingOut(true)} className="rounded-full border border-[var(--line)] px-4 py-2 text-[12.5px] font-extrabold text-[var(--ink-2)] hover:bg-[var(--panel)]">{t("p8hq.dmBlockBtn")}</button>
        </div>

        {blockingOut && (
          <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3.5">
            <div>
              <label className="mb-1 block text-[10.5px] font-extrabold uppercase text-[var(--ink-3)]">{t("p8hq.dmFrom")}</label>
              <input type="date" value={blockDraft.from} onChange={(e) => setBlockDraft({ ...blockDraft, from: e.target.value, to: e.target.value > blockDraft.to ? e.target.value : blockDraft.to })} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] font-bold text-[var(--ink)]" />
            </div>
            <div>
              <label className="mb-1 block text-[10.5px] font-extrabold uppercase text-[var(--ink-3)]">{t("p8hq.dmTo")}</label>
              <input type="date" value={blockDraft.to} min={blockDraft.from} onChange={(e) => setBlockDraft({ ...blockDraft, to: e.target.value })} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] font-bold text-[var(--ink)]" />
            </div>
            <div className="min-w-[160px] flex-1">
              <label className="mb-1 block text-[10.5px] font-extrabold uppercase text-[var(--ink-3)]">{t("p8hq.dmNote")}</label>
              <input value={blockDraft.note} onChange={(e) => setBlockDraft({ ...blockDraft, note: e.target.value })} placeholder={t("p8hq.dmNotePh")} className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-[13px] font-bold text-[var(--ink)]" />
            </div>
            <button type="button" disabled={blockSaving} onClick={addBlackout} className="rounded-full bg-[#0f7a43] px-4 py-2 text-[12.5px] font-extrabold text-white disabled:opacity-60">{blockSaving ? t("p8hq.slSaving") : t("p8hq.dmBlock")}</button>
            <button type="button" onClick={() => setBlockingOut(false)} className="text-[12.5px] font-bold text-[var(--ink-3)]">{t("p8hq.slCancel")}</button>
          </div>
        )}

        <div className="mt-3 flex flex-col gap-2">
          {!blackouts ? null : blackouts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--line)] px-4 py-4 text-center text-[12px] text-[var(--ink-3)]">{t("p8hq.dmNothingBlocked")}</div>
          ) : blackouts.map((b) => (
            <div key={b.id} data-ui="card" className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
              <span className="text-[13px] font-extrabold text-[var(--ink)]">{b.from === b.to ? b.from : `${b.from} ${isRTL(currentLocaleCode()) ? "←" : "→"} ${b.to}`}</span>
              {b.note && <span className="text-[11.5px] text-[var(--ink-3)]">· {b.note}</span>}
              <button type="button" onClick={() => removeBlackout(b.id)} className="ms-auto rounded-full border border-[var(--line)] px-3 py-1.5 text-[11.5px] font-bold text-[var(--red,#c0392b)] hover:bg-[#fdebec]">{t("p8hq.dmRemove")}</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
