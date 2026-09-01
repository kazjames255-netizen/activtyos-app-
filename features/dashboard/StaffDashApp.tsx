"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { get as apiGet, put as apiPut } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { Badge, Button, Card } from "@/components/ui";
import { PageHero } from "@/components/OperatorPage";
import { Tile, GRAD } from "@/features/money/finance-kit";
import { loadClock, clockIn, clockOut, startBreak, endBreak, slug, fmtDur, workedMs, type ClockRecord } from "@/features/timeclock/data";
import { greeting } from "@/lib/greeting";

// ─────────────────────────────────────────────────────────────────────────
// staff/dash — the staff member's colourful landing page. Live tenant data:
// today's sessions, the team's tasks, plus the staffer's own shift-today +
// a quick clock in/out card (same store the Clock in & out page uses).
// Demo "me" = Marcus Bell (per-user identity is Amir's).
// ─────────────────────────────────────────────────────────────────────────

const ME = "Marcus Bell";
const ROTA_KEY = "aos.rota.v5";

interface RatioSession { blockId: string; start: string; end: string; blockName: string; listingName: string; totalChildren: number; sendCount: number; requiredStaff: number; staffAssigned: number; met: boolean }
interface Task { id: string; title: string; done: boolean; priority?: "low" | "normal" | "high"; dueDate?: string; assignee?: string }
interface PublishedLite { id: string; dayList: { iso: string }[] }
interface Me { tenantName: string | null; name?: string }
interface MyShift { start: string; end: string; role?: string; site?: string; listing?: string }
// Register feed — the day's real attendance + safeguarding flags per child.
interface ChildFlags { allergies?: string; medical?: string; dietary?: string; send?: string; sendPlanId?: string; sendPlanName?: string; careNotes?: string }
interface RegAttendee { ref: string; children: { name: string; age?: number }[]; child: ChildFlags | null; attendance: { status?: "in" | "absent"; collectedAt?: string } | null }
interface RegSession { blockId: string; start: string; end: string; blockName: string; listingName: string; attendees: RegAttendee[]; counts: { expected: number; present: number; notArrived: number; absent: number; collected: number } }
interface WatchFlag { k: string; detail?: string; bg: string; fg: string }
interface WatchKid { key: string; name: string; where: string; status: "in" | "absent" | "due"; flags: WatchFlag[] }

// Which safeguarding flags a child carries, as colour-coded chips.
function flagsOf(c: ChildFlags): WatchFlag[] {
  const out: WatchFlag[] = [];
  if (c.send || c.sendPlanId || c.sendPlanName) out.push({ k: "SEND", detail: c.sendPlanName || c.send || undefined, bg: "#f3e8ff", fg: "#7c3aed" });
  if (c.allergies) out.push({ k: "Allergy", detail: c.allergies, bg: "#fdecec", fg: "#c0362c" });
  if (c.medical) out.push({ k: "Medical", detail: c.medical, bg: "#fef3d8", fg: "#9a5a00" });
  if (c.dietary) out.push({ k: "Dietary", detail: c.dietary, bg: "#e6f7ee", fg: "#0f7a43" });
  if (c.careNotes) out.push({ k: "Care plan", detail: c.careNotes, bg: "#e7f0ff", fg: "#1d4ed8" });
  return out;
}

const todayIso = () => { const t = new Date(); const p = (n: number) => String(n).padStart(2, "0"); return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`; };
const to12 = (t: string) => { const [h, m] = (t || "0:0").split(":").map(Number); const ap = h >= 12 ? "pm" : "am"; const hr = h % 12 === 0 ? 12 : h % 12; return `${hr}${m ? ":" + String(m).padStart(2, "0") : ""}${ap}`; };
function myShiftToday(): MyShift | null {
  try {
    const s = JSON.parse(localStorage.getItem(ROTA_KEY) || "null") as { staff?: { id: string; name: string }[]; shifts?: MyShift[] & { staffId?: string; date?: string }[] } | null;
    const ids = new Set((s?.staff || []).filter((x) => x.name === ME).map((x) => x.id));
    const day = todayIso();
    return ((s?.shifts as (MyShift & { staffId?: string; date?: string })[]) || []).find((x) => x.staffId && ids.has(x.staffId) && x.date === day) ?? null;
  } catch { return null; }
}

export function StaffDashApp() {
  const [me, setMe] = useState<Me | null>(null);
  const [sessions, setSessions] = useState<RatioSession[] | null>(null);
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [regs, setRegs] = useState<RegSession[] | null>(null);
  const [timetableToday, setTimetableToday] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clock, setClock] = useState<Record<string, ClockRecord> | null>(null);
  const [shift, setShift] = useState<MyShift | null>(null);
  const [, tick] = useState(0); // live worked-time tick
  const today = todayIso();

  const refresh = useCallback(() => {
    apiGet<{ sessions: RatioSession[] }>(`/api/ratios?date=${today}`).then((d) => setSessions(d?.sessions ?? [])).catch((e) => setError(e instanceof Error ? e.message : "Couldn’t load today"));
    apiGet<RegSession[]>(`/api/registers?date=${today}`).then((r) => setRegs(r ?? [])).catch(() => setRegs([]));
    apiGet<Task[]>("/api/tasks").then((t) => setTasks(t ?? [])).catch(() => {});
    apiGet<PublishedLite[]>("/api/timetables/published").then((w) => setTimetableToday((w ?? []).some((x) => x.dayList.some((d) => d.iso === today)))).catch(() => {});
  }, [today]);
  useEffect(() => { apiGet<Me>("/api/me").then(setMe).catch(() => {}); refresh(); setClock(loadClock()); setShift(myShiftToday()); }, [refresh]);
  useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(id); }, []);
  useRealtime(["bookings", "blocks", "tasks", "timetables", "registers"], refresh);

  const open = (tasks ?? []).filter((t) => !t.done);
  // "at my site, today" — from the live register: present = in now, expected = due in.
  const childrenIn = (regs ?? []).reduce((n, s) => n + s.counts.present, 0);
  const dueIn = (regs ?? []).reduce((n, s) => n + s.counts.expected, 0);
  const watch: WatchKid[] = (regs ?? []).flatMap((s) => s.attendees
    .filter((a) => a.child && flagsOf(a.child).length > 0)
    .map((a) => ({
      key: `${s.blockId}:${a.ref}`,
      name: a.children[0]?.name ?? "—",
      where: `${s.start}–${s.end} · ${s.listingName}`,
      status: a.attendance?.status === "in" ? "in" : a.attendance?.status === "absent" ? "absent" : "due",
      flags: flagsOf(a.child!),
    } as WatchKid)));
  const tickTask = (t: Task) => { setTasks((list) => (list ?? []).map((x) => (x.id === t.id ? { ...x, done: true } : x))); void apiPut(`/api/tasks/${t.id}`, { done: true }).catch(() => refresh()); };
  const dayLabel = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  // ── quick clock in/out ──
  const meId = slug(ME);
  const rec = clock?.[meId];
  const status = rec?.status ?? "out";
  const doIn = () => setClock((c) => clockIn(c || {}, meId, ME, shift?.site));
  const doOut = () => setClock((c) => clockOut(c || {}, meId, ME));
  const doBreak = () => setClock((c) => (status === "break" ? endBreak(c || {}, meId) : startBreak(c || {}, meId)));
  const STAT = [
    { big: sessions === null ? "…" : String(sessions.length), small: "Sessions today", grad: GRAD.blue, icon: "🎪", sub: "running at your site" },
    { big: regs === null ? "…" : String(childrenIn), small: "Children in", grad: GRAD.green, icon: "🧒", sub: "signed in right now" },
    { big: regs === null ? "…" : String(dueIn), small: "Due in today", grad: GRAD.amber, icon: "📋", sub: "expected across sessions" },
    { big: tasks === null ? "…" : String(open.length), small: "My open tasks", grad: GRAD.violet, icon: "✅", sub: "assigned to you" },
  ];

  return (
    <div className="text-[var(--ink)]">
      <PageHero
        icon="👋"
        title={`${greeting(me?.name)} — here’s ${me?.tenantName ?? "your club"} today`}
        lede={`${dayLabel} — live from bookings, registers and the team’s tasks.`}
      />

      {error && <div className="mb-3 text-[12.5px] font-bold text-[var(--red,#e21d27)]">{error}</div>}

      {/* Hero row — pink "my shift" + clock in/out */}
      <div className="mb-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-[0_1px_3px_rgba(20,30,60,.06)]">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--ink-3)]">🗓 My shift today</div>
            <span className="rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold" style={shift ? { background: "#eaf0fc", color: "#1d3a8f" } : { background: "#eef1f6", color: "#64748b" }}>{shift ? "Rostered" : "Day off"}</span>
          </div>
          {shift ? (<>
            <div className="mt-2 text-[22px] font-extrabold leading-none text-[#1d3a8f]" style={{ fontFamily: "var(--ff-display)" }}>{to12(shift.start)} – {to12(shift.end)}</div>
            <div className="mt-1.5 text-[13px] font-semibold text-[var(--ink-2)]">{[shift.role, shift.site, shift.listing].filter(Boolean).join(" · ") || "On shift"}</div>
          </>) : (<>
            <div className="mt-2 text-[17px] font-extrabold leading-tight text-[#1d3a8f]" style={{ fontFamily: "var(--ff-display)" }}>You’re not rostered today</div>
            <div className="mt-1 text-[13px] text-[var(--ink-3)]">Enjoy your day off 🌿</div>
          </>)}
        </div>

        <div className={"rounded-2xl border p-4 " + (status === "in" ? "border-[#bfe6cf] bg-[#f2fbf5]" : status === "break" ? "border-[#f3d9a7] bg-[#fdf6e8]" : "border-[var(--line)] bg-white")}>
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">⏱ Clock in / out</div>
            <span className="rounded-full px-2.5 py-0.5 text-[10.5px] font-extrabold" style={status === "in" ? { background: "#d7f5e3", color: "#0f7a43" } : status === "break" ? { background: "#fbe6c4", color: "#9a5a00" } : { background: "#eef1f6", color: "#64748b" }}>{status === "in" ? "Clocked in" : status === "break" ? "On break" : "Clocked out"}</span>
          </div>
          {status === "out" ? (
            <div className="mt-2">
              <div className="text-[12.5px] text-[var(--ink-3)]">{rec?.clockOutAt ? `You clocked out — worked ${fmtDur(workedMs(rec))} today.` : "Tap when you arrive to start your shift."}</div>
              <button type="button" onClick={doIn} className="mt-2.5 w-full rounded-xl py-2.5 text-[14px] font-extrabold text-white shadow-sm hover:brightness-110" style={{ background: "linear-gradient(135deg,#0f9d58,#3ddc84)" }}>Clock in</button>
            </div>
          ) : (
            <div className="mt-2">
              <div className="flex items-end justify-between">
                <div><div className="text-[10.5px] font-bold uppercase text-[var(--ink-3)]">Worked today</div><div className="text-[22px] font-extrabold tabular-nums text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{fmtDur(workedMs(rec!))}</div></div>
              </div>
              <div className="mt-2.5 flex gap-2">
                <button type="button" onClick={doBreak} className="flex-1 rounded-xl border border-[var(--line)] bg-white py-2 text-[12.5px] font-extrabold text-[#9a5a00] hover:border-[#f3d9a7]">{status === "break" ? "End break" : "Take a break"}</button>
                <button type="button" onClick={doOut} className="flex-1 rounded-xl py-2 text-[12.5px] font-extrabold text-white hover:brightness-110" style={{ background: "linear-gradient(135deg,#e11d48,#fb7185)" }}>Clock out</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stat tiles — counts are for your site, today */}
      <div className="mb-3 grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {STAT.map((t) => (
          <Tile key={t.small} label={t.small} value={t.big} sub={t.sub} grad={t.grad} icon={t.icon} />
        ))}
      </div>

      {/* Watch list — flagged children in today (SEND / allergy / medical / dietary) */}
      <Card className="mb-3 overflow-hidden p-0">
        <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg,#c0362c,#f59e0b)" }} />
        <div className="p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[13px] font-extrabold">⚠️ Watch list — today</span>
            {regs !== null && watch.length > 0 && <span className="rounded-full bg-[#fdecec] px-2 py-0.5 text-[10.5px] font-extrabold text-[#c0362c]">{watch.length} to keep an eye on</span>}
          </div>
          <p className="mb-2 text-[11.5px] text-[var(--ink-3)]">Children in at your site today with SEND, allergy, medical or dietary needs. Tap a name in the register for the full care plan.</p>
          {regs === null ? <div className="py-3 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
            : watch.length === 0 ? <div className="py-3 text-center text-[12.5px] text-[var(--ink-3)]">No flagged children in today. 👍</div>
              : watch.map((k) => (
                <div key={k.key} className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-dashed border-[var(--line)] py-2 last:border-b-0">
                  <span className="text-[13px] font-extrabold">{k.name}</span>
                  <span className={"rounded-full px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase " + (k.status === "in" ? "bg-[#d7f5e3] text-[#0f7a43]" : k.status === "absent" ? "bg-[#eef1f6] text-[#64748b]" : "bg-[#fef3d8] text-[#9a5a00]")}>{k.status === "in" ? "In" : k.status === "absent" ? "Absent" : "Due"}</span>
                  <span className="flex flex-wrap gap-1">
                    {k.flags.map((f, i) => (
                      <span key={i} title={f.detail || f.k} className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: f.bg, color: f.fg }}>{f.k}</span>
                    ))}
                  </span>
                  <span className="ml-auto text-[11px] text-[var(--ink-3)]">{k.where}</span>
                </div>
              ))}
        </div>
      </Card>

      {/* Today's sessions */}
      <Card className="mb-3 overflow-hidden p-0">
        <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg,#1d3a8f,#3f7ae0)" }} />
        <div className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13px] font-extrabold">Today&rsquo;s sessions</span>
            <span className="flex gap-2">
              {timetableToday && <Link href="/staff/timetable"><Button sm>Day plan</Button></Link>}
              <Link href="/staff/registers"><Button sm variant="primary">Open registers</Button></Link>
            </span>
          </div>
          {sessions === null ? <div className="py-4 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
            : sessions.length === 0 ? <div className="py-4 text-center text-[12.5px] text-[var(--ink-3)]">Nothing runs today.</div>
              : sessions.map((s) => (
                <div key={s.blockId} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-dashed border-[var(--line)] py-2 last:border-b-0">
                  <span className="text-[12px] font-bold text-[var(--ink-3)]">{s.start}–{s.end}</span>
                  <span className="text-[13px] font-extrabold">{s.listingName}</span>
                  <span className="text-[12px] text-[var(--ink-3)]">{s.blockName}</span>
                  <span className="ml-auto flex items-center gap-1.5 text-[11.5px]">
                    <Badge tone={{ bg: "var(--brand-soft)", fg: "var(--brand-strong)" }}>{s.totalChildren} children</Badge>
                    {s.sendCount > 0 && <Badge tone={{ bg: "#f3e8ff", fg: "#7c3aed" }}>{s.sendCount} SEND</Badge>}
                    <Badge tone={s.met ? { bg: "#eaf0fc", fg: "#1d3a8f" } : { bg: "#fdf3d8", fg: "#9a5a00" }}>{s.staffAssigned}/{s.requiredStaff} staff</Badge>
                  </span>
                </div>
              ))}
        </div>
      </Card>

      {/* Team tasks */}
      <Card className="overflow-hidden p-0">
        <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg,#b45309,#f59e0b)" }} />
        <div className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13px] font-extrabold">Team tasks</span>
            <Link href="/staff/tasks"><Button sm>All tasks</Button></Link>
          </div>
          {tasks === null ? <div className="py-3 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
            : open.length === 0 ? <div className="py-3 text-center text-[12.5px] text-[var(--ink-3)]">All done — nothing open. 🎉</div>
              : open.slice(0, 6).map((t) => (
                <div key={t.id} className="flex items-center gap-2.5 border-b border-dashed border-[var(--line)] py-1.5 last:border-b-0">
                  <button type="button" onClick={() => tickTask(t)} aria-label={`Mark "${t.title}" done`} className="h-[18px] w-[18px] flex-none cursor-pointer rounded-md border-[1.5px] border-[var(--line)] hover:border-[var(--brand)]" />
                  <span className="min-w-0 flex-1 truncate text-[12.5px]">{t.title}</span>
                  {t.priority === "high" && <Badge tone={{ bg: "var(--red-soft,#fdebec)", fg: "#bb1620" }}>high</Badge>}
                  {t.dueDate && <span className="text-[11px] text-[var(--ink-3)]">{t.dueDate}</span>}
                </div>
              ))}
        </div>
      </Card>
    </div>
  );
}
