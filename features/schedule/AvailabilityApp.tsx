"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button, Card, Input } from "@/components/ui";
import { PageHero, LIGHT_PALETTE } from "@/components/OperatorPage";

// ── My availability (staff, Phase 1) ───────────────────────────────────────
// Per the Build Manual: "Set available days/times; submit to manager." The
// manager-side who's-available grid, leave requests and auto-scheduling are
// Phase 2. Saved locally + best-effort POST /api/availability until the
// backend store lands (docs/availability-handoff.md).

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
const DAYS: [DayKey, string][] = [
  ["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"], ["thu", "Thursday"],
  ["fri", "Friday"], ["sat", "Saturday"], ["sun", "Sunday"],
];
interface DayAvail { on: boolean; from: string; to: string }
interface Availability { days: Record<DayKey, DayAvail>; note: string; submittedAt: string | null }

const KEY = "aos.myavailability.v1";
// Light fill + crisp inset outline so inputs clearly read as fields on white.
const FIELD_STYLE = { backgroundColor: "#f5f3fb", boxShadow: "inset 0 0 0 1.5px #c5bfd6" } as const;
const blankDay = (): DayAvail => ({ on: false, from: "09:00", to: "17:00" });
const blank = (): Availability => ({ days: Object.fromEntries(DAYS.map(([k]) => [k, blankDay()])) as Record<DayKey, DayAvail>, note: "", submittedAt: null });
const load = (): Availability => { try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); return v && v.days ? v : blank(); } catch { return blank(); } };

export function AvailabilityApp() {
  const [a, setA] = useState<Availability>(blank);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setA(load()); }, []);
  const persist = (next: Availability) => { setA(next); try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ } };

  const setDay = (k: DayKey, patch: Partial<DayAvail>) => persist({ ...a, days: { ...a.days, [k]: { ...a.days[k], ...patch } }, submittedAt: null });
  const setNote = (note: string) => persist({ ...a, note, submittedAt: null });

  const anyOn = DAYS.some(([k]) => a.days[k].on);
  const submit = () => {
    const next = { ...a, submittedAt: new Date().toISOString() };
    persist(next); setSaved(true); setTimeout(() => setSaved(false), 2500);
    // Best-effort — the backend store + manager notification land later.
    void api("/api/availability", { method: "POST", body: JSON.stringify(next) }).catch(() => {});
  };

  const submittedLabel = a.submittedAt
    ? `Submitted ${new Date(a.submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} at ${new Date(a.submittedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
    : "Not submitted yet";

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero title="My availability" icon="⏱" lede="Tell your manager which days and hours you can work — they build the rota around it." />

      <Card className="p-4">
        <div className="flex flex-col divide-y divide-[var(--line-2,#eef2f8)]">
          {DAYS.map(([k, label]) => {
            const day = a.days[k];
            return (
              <div key={k} className="flex flex-wrap items-center gap-3 py-2.5">
                <button
                  type="button"
                  onClick={() => setDay(k, { on: !day.on })}
                  role="switch"
                  aria-checked={day.on}
                  className="relative h-[22px] w-[40px] flex-none rounded-full transition-colors"
                  style={{ background: day.on ? "#2f6bd8" : "var(--line)" }}
                >
                  <span className="absolute top-[3px] h-[16px] w-[16px] rounded-full bg-white transition-all" style={{ left: day.on ? "21px" : "3px" }} />
                </button>
                <span className="w-[92px] flex-none text-[13.5px] font-extrabold text-[var(--ink)]">{label}</span>
                {day.on ? (
                  <div className="flex items-center gap-2 text-[12.5px] text-[var(--ink-2)]">
                    <Input type="time" value={day.from} onChange={(e) => setDay(k, { from: e.target.value })} className="w-[112px]" style={FIELD_STYLE} />
                    <span className="text-[var(--ink-3)]">to</span>
                    <Input type="time" value={day.to} onChange={(e) => setDay(k, { to: e.target.value })} className="w-[112px]" style={FIELD_STYLE} />
                  </div>
                ) : (
                  <span className="text-[12.5px] font-semibold text-[var(--ink-3)]">Not available</span>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-3">
          <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Anything your manager should know <span className="font-normal normal-case">— optional</span></label>
          <textarea
            value={a.note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="e.g. can do extra Saturdays in August, prefer mornings…"
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] p-2.5 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--brand)]"
          />
        </div>

        <div className="mt-3.5 flex flex-wrap items-center gap-3 border-t border-[var(--line)] pt-3.5">
          <Button variant="primary" disabled={!anyOn} onClick={submit} className="!bg-[#1d3a8f] !border-[#1d3a8f] !text-white">Submit to manager</Button>
          {saved ? <span className="text-[12.5px] font-bold text-[#0f7a43]">✓ Sent to your manager</span>
            : <span className="text-[12.5px] text-[var(--ink-3)]">{submittedLabel}</span>}
          {!anyOn && <span className="text-[12px] text-[var(--ink-3)]">Turn on at least one day first.</span>}
        </div>
      </Card>

      <p className="mt-3 text-[11.5px] text-[var(--ink-3)]">
        Coming soon: request holiday &amp; time off, and your manager building the rota straight from everyone&rsquo;s availability.
      </p>
    </div>
  );
}
