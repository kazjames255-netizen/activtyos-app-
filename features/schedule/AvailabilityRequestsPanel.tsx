"use client";

// Operator → "Availability requests": ask a team member to submit their
// availability (a week, or a camp assignment), see what they chose, and assign
// them to specific days. Assigned days lock on the staffer's My availability
// page (they can only request time off). Real store: /api/availability.
import { useEffect, useMemo, useState } from "react";
import { get, post, patch, del } from "@/lib/api";
import { useT } from "@/lib/i18n/provider";
import { Button, Card, Input } from "@/components/ui";

interface ReqWindow { kind: "week" | "range" | "ongoing" | "camp"; label: string; from?: string; to?: string }
interface Camp { listingName: string; location?: string; open: string; close: string; weeks: number; startDate: string; assignedDates?: string[] }
interface DayAvail { on: boolean; from: string; to: string }
interface AvailRequest { id: string; staffEmail: string; staffName?: string | null; window: ReqWindow; camp?: Camp | null; note?: string; status: "pending" | "submitted"; createdAt: string; submittedAt?: string }
interface Pattern { grid?: Record<string, DayAvail>; days?: Record<string, DayAvail>; submittedAt?: string }
interface Invite { token: string; role: string; sentTo?: string | null; usedBy?: string | null }

const iso = (d: Date) => d.toISOString().slice(0, 10);
const fmt = (s?: string) => (s ? new Date(`${s}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "");
const addDaysISO = (i: string, n: number) => { const d = new Date(`${i}T00:00:00`); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const wdShort = (i: string) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(`${i}T00:00:00`).getDay()];
const dNum = (i: string) => new Date(`${i}T00:00:00`).getDate();
function weekFrom(offset: number): ReqWindow {
  const d = new Date();
  const dow = (d.getDay() + 6) % 7;
  const mon = new Date(d); mon.setDate(d.getDate() - dow + offset * 7); mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return { kind: "week", label: `week of ${mon.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}`, from: iso(mon), to: iso(sun) };
}
const WINDOWS: [string, () => ReqWindow][] = [
  ["This week", () => weekFrom(0)],
  ["Next week", () => weekFrom(1)],
  ["The week after", () => weekFrom(2)],
  ["Ongoing (usual weekly pattern)", () => ({ kind: "ongoing", label: "your usual weekly pattern" })],
];

export function AvailabilityRequestsPanel() {
  const t = useT();
  const [rows, setRows] = useState<AvailRequest[]>([]);
  const [invited, setInvited] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [winIdx, setWinIdx] = useState(1);
  const [note, setNote] = useState(() => t("schedule.requestNoteDefault"));
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = () => get<AvailRequest[]>("/api/availability/requests").then(setRows).catch(() => {});
  useEffect(() => {
    void load();
    get<Invite[]>("/api/invites").then((xs) => setInvited([...new Set(xs.filter((x) => x.role === "staff" && x.sentTo).map((x) => x.sentTo as string))])).catch(() => {});
  }, []);

  const valid = /.+@.+\..+/.test(email.trim());
  const send = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      const window = WINDOWS[winIdx][1]();
      await post("/api/availability/requests", { staffEmail: email.trim(), staffName: name.trim() || undefined, window, note: note.trim() || undefined });
      setFlash(t("schedule.requestedFromFlash", { email: email.trim(), window: window.label }));
      setEmail(""); setName("");
      await load();
      setTimeout(() => setFlash(null), 4000);
    } catch (e) { setFlash(e instanceof Error ? e.message : t("schedule.requestSendError")); }
    finally { setBusy(false); }
  };
  const withdraw = async (id: string) => { await del(`/api/availability/requests/${id}`).catch(() => {}); await load(); };

  const pending = useMemo(() => rows.filter((r) => r.status === "pending").length, [rows]);

  return (
    <div className="flex flex-col gap-3">
      <Card className="p-4">
        <div className="mb-1 text-[14px] font-extrabold text-[var(--ink)]">{t("schedule.requestAvailTitle")}</div>
        <p className="mb-3 text-[12px] text-[var(--ink-3)]">{t("schedule.requestAvailIntro")}</p>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("schedule.staffEmail")}</label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" className="w-full" />
            {invited.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {invited.map((x) => <button key={x} type="button" onClick={() => setEmail(x)} className="rounded-full bg-[var(--panel)] px-2 py-0.5 text-[11px] font-semibold text-[var(--ink-2)] hover:bg-[#eef4fd] hover:text-[#1d3a8f]">{x}</button>)}
              </div>
            )}
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("schedule.name")} <span className="font-normal normal-case">{t("schedule.optionalSuffix")}</span></label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("schedule.namePlaceholder")} className="w-full" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("schedule.forLabel")}</label>
            <select value={winIdx} onChange={(e) => setWinIdx(Number(e.target.value))} className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[13px] text-[var(--ink)]">
              {WINDOWS.map(([label], i) => <option key={label} value={i}>{label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("schedule.note")} <span className="font-normal normal-case">{t("schedule.optionalSuffix")}</span></label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} className="w-full" />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button variant="primary" disabled={!valid || busy} onClick={send} className="!bg-[#1d3a8f] !border-[#1d3a8f] !text-white">{busy ? t("schedule.sending") : t("schedule.sendRequest")}</Button>
          {flash && <span className="text-[12.5px] font-semibold text-[#0f7a43]">✓ {flash}</span>}
        </div>
      </Card>

      <Card className="p-0">
        <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--panel)] px-4 py-2.5">
          <span className="text-[11px] font-black uppercase tracking-wide text-[var(--ink-3)]">{t("schedule.requests")}</span>
          <span className="text-[12px] font-bold text-[var(--ink-3)]">{t("schedule.awaitingTotal", { awaiting: pending, total: rows.length })}</span>
        </div>
        {rows.length === 0 ? (
          <div className="px-4 py-6 text-center text-[12.5px] text-[var(--ink-3)]">{t("schedule.noRequestsYet")}</div>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {rows.map((r) => {
              const assignedN = r.camp?.assignedDates?.length ?? 0;
              return (
                <li key={r.id}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                    <span className="text-[13px] font-extrabold text-[var(--ink)]">{r.staffName || r.staffEmail}</span>
                    {r.staffName && <span className="text-[11.5px] text-[var(--ink-3)]">{r.staffEmail}</span>}
                    <span className="text-[12px] text-[var(--ink-2)]">· {r.window.label}{r.window.from ? ` (${fmt(r.window.from)}–${fmt(r.window.to)})` : ""}</span>
                    {assignedN > 0 && <span className="rounded-full bg-[#eef4fd] px-2 py-0.5 text-[10.5px] font-extrabold text-[#1d3a8f]">📌 {t("schedule.assignedCount", { count: assignedN })}</span>}
                    <span className="ml-auto flex items-center gap-2">
                      {r.status === "submitted"
                        ? <span className="rounded-full bg-[#e7f5ec] px-2.5 py-0.5 text-[11px] font-extrabold text-[#0f7a43]">✓ {t("schedule.submitted")}</span>
                        : <span className="rounded-full bg-[#fdf6e3] px-2.5 py-0.5 text-[11px] font-extrabold text-[#8a5a09]">{t("schedule.awaiting")}</span>}
                      {r.camp && r.status === "submitted" && (
                        <button type="button" onClick={() => setOpenId((o) => (o === r.id ? null : r.id))} className="rounded-full bg-[#1d3a8f] px-3 py-1 text-[11px] font-bold text-white transition hover:brightness-110">{openId === r.id ? t("schedule.close") : t("schedule.viewAssign")}</button>
                      )}
                      <button type="button" onClick={() => withdraw(r.id)} className="text-[11.5px] font-bold text-[var(--ink-3)] hover:text-[#c0392b]">{t("schedule.withdraw")}</button>
                    </span>
                  </div>
                  {openId === r.id && r.camp && <AssignPanel req={r} onSaved={load} />}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

// Operator view of a staff member's submitted camp availability + day assignment.
function AssignPanel({ req, onSaved }: { req: AvailRequest; onSaved: () => void }) {
  const t = useT();
  const camp = req.camp!;
  const [grid, setGrid] = useState<Record<string, DayAvail> | null>(null);
  const [assigned, setAssigned] = useState<Set<string>>(new Set(camp.assignedDates ?? []));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    get<{ pattern: Pattern | null }>(`/api/availability/requests/${req.id}/submission`)
      .then((d) => setGrid(d.pattern?.grid ?? {}))
      .catch(() => setGrid({}));
  }, [req.id]);

  const weeks = useMemo(() => Array.from({ length: camp.weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => addDaysISO(camp.startDate, w * 7 + d))), [camp.weeks, camp.startDate]);
  const chose = (dt: string) => !!grid?.[dt]?.on;
  const toggle = (dt: string) => { if (!chose(dt)) return; setAssigned((s) => { const n = new Set(s); n.has(dt) ? n.delete(dt) : n.add(dt); return n; }); };
  const save = async () => {
    setBusy(true);
    try { await patch(`/api/availability/requests/${req.id}/assign`, { assignedDates: [...assigned] }); setSaved(true); setTimeout(() => setSaved(false), 2500); onSaved(); }
    catch { /* ignore */ } finally { setBusy(false); }
  };
  const chosenCount = grid ? Object.values(grid).filter((c) => c.on).length : 0;

  return (
    <div className="border-t border-[var(--line)] bg-[#f7f9ff] px-4 py-3">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[11.5px]">
        <span className="font-extrabold text-[var(--ink)]">{camp.listingName}{camp.location ? ` · ${camp.location}` : ""}</span>
        <span className="text-[var(--ink-3)]">{camp.open}–{camp.close}</span>
        <span className="text-[var(--ink-3)]">· {chosenCount} days available · <b className="text-[#1d3a8f]">{assigned.size} assigned</b></span>
      </div>
      {grid === null ? <div className="py-3 text-center text-[12px] text-[var(--ink-3)]">{t("schedule.loadingAvailability")}</div> : (
        <div className="flex flex-col gap-1.5">
          {weeks.map((wk, wi) => (
            <div key={wi} className="flex flex-wrap items-center gap-1.5">
              <span className="w-[60px] flex-none text-[11px] font-extrabold text-[#1d3a8f]">{t("schedule.weekN", { n: wi + 1 })}</span>
              {wk.map((dt) => {
                const ok = chose(dt); const on = assigned.has(dt);
                return (
                  <button key={dt} type="button" disabled={!ok} onClick={() => toggle(dt)}
                    title={ok ? t("schedule.availClickTo", { from: grid![dt].from, to: grid![dt].to, action: on ? t("schedule.unassign") : t("schedule.assign") }) : t("schedule.notAvailable")}
                    className={"rounded-md px-2 py-1 text-[11px] font-bold tabular-nums transition " + (on ? "bg-[#1d3a8f] text-white" : ok ? "bg-white text-[#1d3a8f] ring-1 ring-[#c9d6f5] hover:bg-[#eef4fd]" : "cursor-not-allowed bg-[var(--panel)] text-[var(--ink-3)] opacity-60")}>
                    {on ? "📌 " : ""}{wdShort(dt)} {dNum(dt)}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center gap-3">
        <Button variant="primary" disabled={busy} onClick={save} className="!bg-[#1d3a8f] !border-[#1d3a8f] !text-white">{busy ? t("schedule.saving") : t("schedule.saveAssignments")}</Button>
        {saved && <span className="text-[12px] font-bold text-[#0f7a43]">✓ {t("schedule.assignedLocked")}</span>}
        <span className="ml-auto text-[11px] text-[var(--ink-3)]">{t("schedule.assignDaysHint")}</span>
      </div>
    </div>
  );
}
