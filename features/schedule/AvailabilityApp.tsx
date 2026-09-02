"use client";

import { useEffect, useState } from "react";
import { api, get as apiGet } from "@/lib/api";
import { Button, Card, Input } from "@/components/ui";
import { PageHero, LIGHT_PALETTE } from "@/components/OperatorPage";

// A request from the manager to submit availability for a window (or ongoing).
interface ReqWindow { kind: "week" | "range" | "ongoing"; label: string; from?: string; to?: string }
interface AvailRequest { id: string; window: ReqWindow; note?: string; status: "pending" | "submitted"; createdAt: string; createdBy?: string | null; submittedAt?: string }
interface Pattern { days?: Record<string, { on: boolean; from: string; to: string }>; note?: string; submittedAt?: string }
const fmtDay = (iso?: string) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) : "");
const windowText = (w: ReqWindow) => w.kind === "ongoing" ? "your usual weekly pattern (no fixed dates)" : w.from && w.to ? `${fmtDay(w.from)} – ${fmtDay(w.to)}` : w.label;

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
  const [requests, setRequests] = useState<AvailRequest[]>([]);

  const refreshRequests = () => apiGet<{ requests: AvailRequest[]; pattern: Pattern | null }>("/api/availability/mine")
    .then((r) => {
      setRequests(r.requests || []);
      if (r.pattern?.days) setA((prev) => ({ ...prev, days: { ...prev.days, ...(r.pattern!.days as Record<DayKey, DayAvail>) }, note: r.pattern!.note ?? prev.note, submittedAt: r.pattern!.submittedAt ?? prev.submittedAt }));
    })
    .catch(() => {});

  useEffect(() => { setA(load()); void refreshRequests(); }, []);
  const persist = (next: Availability) => { setA(next); try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ } };

  const setDay = (k: DayKey, patch: Partial<DayAvail>) => persist({ ...a, days: { ...a.days, [k]: { ...a.days[k], ...patch } }, submittedAt: null });
  const setNote = (note: string) => persist({ ...a, note, submittedAt: null });

  // The most recent request still awaiting a response drives the page's framing.
  const pendingReq = requests.find((r) => r.status === "pending") ?? null;
  const lastReq = requests[0] ?? null;

  const anyOn = DAYS.some(([k]) => a.days[k].on);
  const submit = () => {
    const next = { ...a, submittedAt: new Date().toISOString() };
    persist(next); setSaved(true); setTimeout(() => setSaved(false), 2500);
    // Real store: saves the pattern and marks any pending request submitted.
    void api("/api/availability/mine", { method: "PUT", body: JSON.stringify({ days: a.days, note: a.note }) })
      .then(() => refreshRequests())
      .catch(() => {});
  };

  const submittedLabel = a.submittedAt
    ? `Submitted ${new Date(a.submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} at ${new Date(a.submittedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
    : "Not submitted yet";

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero title="My availability" icon="⏱" lede="Set your usual working week — the days and hours you can normally work. It's the starting point your manager uses when building the rota." />

      {pendingReq ? (
        <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-[#f3d98a] bg-[#fdf6e3] p-3.5 text-[12.5px] leading-relaxed text-[#7a5a12]">
          <span className="mt-px flex-none text-[16px] leading-none">📩</span>
          <div>
            <b>Your manager has asked for your availability</b> for <b className="text-[#7a5a12]">{pendingReq.window.label}</b>{pendingReq.window.kind !== "ongoing" && pendingReq.window.from ? <> · <span className="tabular-nums">{windowText(pendingReq.window)}</span></> : ""}.
            {pendingReq.note ? <div className="mt-1 italic text-[#8a6a2a]">“{pendingReq.note}”</div> : null}
            <div className="mt-1.5 text-[#8a6a2a]">Set the days &amp; times you can work below, then <b>Submit to manager</b>. {pendingReq.createdBy ? `Requested by ${pendingReq.createdBy}.` : ""}</div>
          </div>
        </div>
      ) : lastReq && lastReq.status === "submitted" ? (
        <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-[#bfe6cf] bg-[#f2fbf5] p-3.5 text-[12.5px] leading-relaxed text-[#0f7a43]">
          <span className="mt-px flex-none text-[16px] leading-none">✅</span>
          <div><b>Availability submitted</b> for {lastReq.window.label}{lastReq.submittedAt ? ` on ${fmtDay(lastReq.submittedAt.slice(0, 10))}` : ""}. You can update it any time — your manager will see the latest.</div>
        </div>
      ) : (
        <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-[#cde0f7] bg-[#eef5ff] p-3.5 text-[12.5px] leading-relaxed text-[#1d3a8f]">
          <span className="mt-px flex-none text-[16px] leading-none">🔁</span>
          <div>
            <b>This is your standard weekly availability</b> — a repeating pattern, not a specific week. You&rsquo;re not being asked to fill in particular dates: it applies from today and stays in place until you change it.
            <div className="mt-1.5 text-[var(--ink-2)]">When your manager needs it for a specific week, <b className="text-[#1d3a8f]">a request will appear here</b> and you can submit for those dates.</div>
          </div>
        </div>
      )}

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
        Coming soon: availability for specific published weeks, a notification each time new shifts are released, and your manager building the rota straight from everyone&rsquo;s availability.
      </p>
    </div>
  );
}
