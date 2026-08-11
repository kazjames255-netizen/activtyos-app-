"use client";

import { useEffect, useMemo, useState } from "react";
import { get as apiGet } from "@/lib/api";
import { Button, Card, Input, Select } from "@/components/ui";
import { PageHero, LIGHT_PALETTE } from "@/components/OperatorPage";

// ── Staff schedule / rota (manual edit663) ─────────────────────────────────
// The full scheduling screen: a left staff panel (rates, hours, pay, cost incl.
// on-cost, availability status) and a right week grid grouped by Location →
// Role, with per-day hour totals, shift blocks (assigned/unfilled/locked +
// check-in status), Add per cell, a wages total with on-cost, and the
// availability-request workflow. Demo store for now (front-end); the backend
// (staff pay rates, shifts w/ site+role+check-in+publish, availability) is
// owed — see docs/availability-handoff.md.

const ON_COST = 12.07; // employer NI / pension %, recorded only
const money = (n: number) => `£${n.toFixed(2)}`;
const iso = (d: Date) => d.toISOString().slice(0, 10);
function mondayOf(d: Date) { const x = new Date(d); const day = (x.getUTCDay() + 6) % 7; x.setUTCDate(x.getUTCDate() - day); return x; }
const mins = (t: string) => { const [h, m] = t.split(":").map(Number); return (h || 0) * 60 + (m || 0); };
const dur = (a: string, b: string) => Math.max(0, mins(b) - mins(a)) / 60;
const hLabel = (h: number) => (h === 0 ? "0h" : Number.isInteger(h) ? `${h}h` : `${Math.floor(h)}h ${Math.round((h % 1) * 60)}m`);
const to12 = (t: string) => { const [h, m] = t.split(":").map(Number); const ap = h < 12 ? "am" : "pm"; const hh = ((h + 11) % 12) + 1; return `${hh}:${String(m).padStart(2, "0")}${ap}`; };
const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

interface Staff { id: string; name: string; role: string; rate: number; avail: "notsubmitted" | "confirmed"; note?: string; reminders?: number }
interface Shift { id: string; staffId: string | null; site: string; role: string; date: string; start: string; end: string; in?: string; out?: string; locked?: boolean }
interface Store { staff: Staff[]; shifts: Shift[]; sites: string[] }

const ROLE_COL: Record<string, string> = { "Lead Coach": "#2f6bd8", "Lifeguard": "#0f857b", "Coach": "#6366f1", "Activity Assistant": "#8b5cf6", "First Aider": "#c06a10" };
const roleCol = (r: string) => ROLE_COL[r] ?? "#64748b";

const KEY = "aos.rota.v2";
function seed(): Store {
  const mon = mondayOf(new Date());
  const day = (n: number) => { const x = new Date(mon); x.setUTCDate(x.getUTCDate() + n); return iso(x); };
  const LM = "Loughton Manor First School", GL = "Gullivers Land, Milton Keynes";
  const staff: Staff[] = [
    { id: "amelia", name: "Amelia Hart", role: "Coach", rate: 14.0, avail: "confirmed" },
    { id: "dom", name: "Dom Reyes", role: "Lifeguard", rate: 11.5, avail: "notsubmitted" },
    { id: "kitty", name: "Kitty-Rose Bright", role: "Activity Assistant", rate: 13.0, avail: "notsubmitted" },
    { id: "liberty", name: "Liberty Young", role: "Coach", rate: 12.0, avail: "confirmed" },
    { id: "louis", name: "Louis Calderwood", role: "Lifeguard", rate: 11.0, avail: "notsubmitted" },
    { id: "oluwa", name: "OluwaDamilola Adeyemi", role: "Lead Coach", rate: 15.5, avail: "confirmed" },
    { id: "susan", name: "Susan Preston", role: "Lead Coach", rate: 12.5, avail: "confirmed" },
    { id: "taigan", name: "Taigan McMahon", role: "First Aider", rate: 13.5, avail: "notsubmitted" },
  ];
  let n = 0; const id = () => `sh${++n}`;
  const shifts: Shift[] = [
    { id: id(), staffId: "susan", site: LM, role: "Lead Coach", date: day(0), start: "08:00", end: "09:00", in: "08:04" },
    { id: id(), staffId: "oluwa", site: LM, role: "Lead Coach", date: day(0), start: "08:00", end: "09:00", out: "13:02" },
    { id: id(), staffId: null, site: LM, role: "Lead Coach", date: day(0), start: "08:00", end: "09:00" },
    { id: id(), staffId: null, site: LM, role: "Lead Coach", date: day(0), start: "08:00", end: "09:00" },
    { id: id(), staffId: "louis", site: LM, role: "Lead Coach", date: day(4), start: "17:00", end: "18:00" },
    { id: id(), staffId: null, site: LM, role: "Lead Coach", date: day(4), start: "17:00", end: "18:00" },
    { id: id(), staffId: null, site: LM, role: "Lead Coach", date: day(5), start: "11:45", end: "16:15" },
    { id: id(), staffId: null, site: LM, role: "Lead Coach", date: day(5), start: "11:45", end: "16:15" },
    { id: id(), staffId: "liberty", site: LM, role: "Lifeguard", date: day(2), start: "09:00", end: "13:00" },
    { id: id(), staffId: "oluwa", site: GL, role: "Lead Coach", date: day(1), start: "09:00", end: "15:00" },
    { id: id(), staffId: "amelia", site: GL, role: "Lead Coach", date: day(1), start: "09:00", end: "15:00", in: "09:02" },
    { id: id(), staffId: "taigan", site: GL, role: "Lead Coach", date: day(6), start: "11:45", end: "16:15", locked: true },
  ];
  return { staff, shifts, sites: [LM, GL, "Stantonbury Leisure Centre"] };
}
const load = (): Store => { try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); return v && v.shifts ? v : seed(); } catch { return seed(); } };

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
type Draft = { site: string; role: string; date: string; staffId: string | null; start: string; end: string };

export function ScheduleApp() {
  const [store, setStore] = useState<Store>(seed);
  const [weekStart, setWeekStart] = useState(() => iso(mondayOf(new Date())));
  const [site, setSite] = useState("all");
  const [q, setQ] = useState("");
  const [help, setHelp] = useState(false);
  const [canManage, setCanManage] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => { setStore(load()); apiGet<{ role: string }>("/api/me").then((me) => setCanManage(["company", "freelancer", "franchise"].includes(me.role))).catch(() => {}); }, []);
  const persist = (s: Store) => { setStore(s); try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } };

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => { const x = new Date(`${weekStart}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + i); return x; }), [weekStart]);
  const weekEnd = iso(days[6]);
  const staffById = useMemo(() => Object.fromEntries(store.staff.map((s) => [s.id, s])), [store.staff]);
  const weekShifts = useMemo(() => store.shifts.filter((s) => s.date >= weekStart && s.date <= weekEnd && (site === "all" || s.site === site)), [store.shifts, weekStart, weekEnd, site]);

  const staffHours = (id: string) => weekShifts.filter((s) => s.staffId === id).reduce((n, s) => n + dur(s.start, s.end), 0);
  const wagesAt = store.staff.reduce((n, st) => n + staffHours(st.id) * st.rate, 0);
  const wagesCost = wagesAt * (1 + ON_COST / 100);
  const publishCount = new Set(weekShifts.filter((s) => s.staffId).map((s) => s.staffId)).size;
  const notSubmitted = store.staff.filter((s) => s.avail === "notsubmitted").length;

  // Group grid: site → role → day → shifts
  const grid = useMemo(() => {
    const sites = site === "all" ? store.sites.filter((si) => weekShifts.some((s) => s.site === si)) : [site];
    return sites.map((si) => {
      const roles = [...new Set(weekShifts.filter((s) => s.site === si).map((s) => s.role))];
      return {
        site: si,
        count: weekShifts.filter((s) => s.site === si).length,
        roles: roles.map((role) => ({
          role,
          byDay: days.map((d) => weekShifts.filter((s) => s.site === si && s.role === role && s.date === iso(d)).sort((a, b) => mins(a.start) - mins(b.start))),
        })),
      };
    });
  }, [store, weekShifts, days, site]);

  const shownStaff = store.staff.filter((s) => !q || s.name.toLowerCase().includes(q.toLowerCase()) || s.role.toLowerCase().includes(q.toLowerCase()));

  function shiftWeek(delta: number) { const s = new Date(`${weekStart}T00:00:00Z`); s.setUTCDate(s.getUTCDate() + delta * 7); setWeekStart(iso(s)); }
  const removeShift = (id: string) => persist({ ...store, shifts: store.shifts.filter((s) => s.id !== id) });
  const remind = (id: string) => persist({ ...store, staff: store.staff.map((s) => (s.id === id ? { ...s, reminders: (s.reminders ?? 0) + 1 } : s)) });
  const requestAvail = () => persist({ ...store, staff: store.staff.map((s) => (s.avail === "confirmed" ? s : { ...s, avail: "notsubmitted" })) });
  const saveDraft = () => { if (!draft) return; persist({ ...store, shifts: [...store.shifts, { id: `sh${Date.now()}`, ...draft }] }); setDraft(null); };

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero title="Staff schedule" icon="🗓" lede="Build the week's rota by site and role, request availability, and see wages with on-cost. Hours feed Payroll." />

      {/* How availability works */}
      <Card className="mb-3 overflow-hidden">
        <button type="button" onClick={() => setHelp((v) => !v)} className="flex w-full items-center gap-2 px-4 py-3 text-left">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--panel)] text-[12px]">ⓘ</span>
          <span className="text-[14px] font-extrabold text-[var(--ink)]">How availability works</span>
          <span className="ml-auto text-[12px] text-[var(--ink-3)]">{help ? "▲" : "▼"}</span>
        </button>
        {help && (
          <ol className="ml-9 list-decimal space-y-1 px-4 pb-3.5 text-[13px] leading-relaxed text-[var(--ink-2)]">
            <li><b>Request availability</b> — hit the green button in the staff panel and pick <b>This week</b> or <b>All weeks</b>. Everyone starts <b className="text-[#c0392b]">Not submitted</b>.</li>
            <li>Staff get a <b>notification</b> and set the days &amp; times they can work — their card turns <b className="text-[#0f7a43]">Confirmed</b>.</li>
            <li>Still red? Tap the <b>gold bell</b> on their card to send a reminder (it counts taps).</li>
            <li>Hover the <b>note icon</b> on a card to read anything they&rsquo;ve added.</li>
          </ol>
        )}
      </Card>

      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[13px] font-bold text-[#1d3a8f]">
          📍 <Select value={site} onChange={(e) => setSite(e.target.value)} className="border-0 bg-transparent p-0 text-[13px] font-bold text-[#1d3a8f] outline-none"><option value="all">All sites</option>{store.sites.map((s) => <option key={s} value={s}>{s}</option>)}</Select>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-1.5 py-1">
          <button type="button" onClick={() => shiftWeek(-1)} className="px-2 text-[15px] text-[var(--ink-3)] hover:text-[var(--ink)]">‹</button>
          <span className="min-w-[120px] text-center text-[12.5px] font-bold text-[var(--ink)]">{days[0].toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })} – {days[6].toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}</span>
          <button type="button" onClick={() => shiftWeek(1)} className="px-2 text-[15px] text-[var(--ink-3)] hover:text-[var(--ink)]">›</button>
        </div>
        <button type="button" className="rounded-full border border-[#bcd0f5] bg-[#eef4fd] px-3.5 py-1.5 text-[13px] font-bold text-[#1d3a8f]">🔔 Check-in alerts</button>
        {canManage && (
          <div className="ml-auto flex items-center gap-2">
            <button type="button" className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3.5 py-1.5 text-[13px] font-bold text-[#1d3a8f]">✨ Auto-schedule ▾</button>
            <button type="button" onClick={() => setStore(load())} title="Refresh" className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[13px]">↻</button>
            <button type="button" className="rounded-full bg-[#0f7a43] px-4 py-1.5 text-[13px] font-extrabold text-white">Publish to staff · {publishCount}</button>
          </div>
        )}
      </div>

      {/* Wages */}
      <Card className="mb-3 border-l-4 border-l-[#1d3a8f] p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="text-[14px] font-extrabold text-[var(--ink)]">Total wages for this week</div>
          <div className="flex gap-8 text-right">
            <div><div className="text-[10px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">At hourly rate</div><div className="text-[22px] font-extrabold tabular-nums text-[var(--ink)]">{money(wagesAt)}</div></div>
            <div><div className="text-[10px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Incl. {ON_COST}% on-cost</div><div className="text-[22px] font-extrabold tabular-nums text-[#1d3a8f]">{money(wagesCost)}</div></div>
          </div>
        </div>
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-[var(--ink-3)]">Predicted <b>on-cost</b> adds a cost on top of wages (e.g. employer NI, pension). Recorded only — ActivityOS never moves money.</p>
      </Card>

      {/* Body: staff panel + grid */}
      <div className="flex flex-col gap-3 lg:flex-row">
        {/* Left staff panel */}
        <div className="lg:w-[290px] lg:flex-none">
          <Card className="p-3">
            <div className="mb-2.5 flex items-center gap-2">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Search staff" className="w-full" />
            </div>
            {canManage && (
              <div className="mb-3">
                <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]">Step 1 · Confirm availability</div>
                <button type="button" onClick={requestAvail} className="w-full rounded-xl bg-[#c0392b] px-3 py-2.5 text-[12.5px] font-extrabold uppercase tracking-wide text-white hover:brightness-105">Request staff to confirm availability{notSubmitted ? ` · ${notSubmitted}` : ""}</button>
              </div>
            )}
            <div className="flex flex-col divide-y divide-[var(--line-2,#eef2f8)]">
              {shownStaff.map((st) => {
                const hrs = staffHours(st.id); const pay = hrs * st.rate; const cost = pay * (1 + ON_COST / 100);
                return (
                  <div key={st.id} className="flex items-start gap-2.5 py-2.5">
                    <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[var(--panel)] text-[12px] font-extrabold text-[var(--ink-2)]">{initials(st.name)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5"><span className="truncate text-[13px] font-extrabold text-[var(--ink)]">{st.name}</span>
                        {st.avail === "notsubmitted"
                          ? <button type="button" onClick={() => remind(st.id)} title={`Send reminder${st.reminders ? ` (sent ${st.reminders})` : ""}`} className="flex-none text-[12px]">🔔</button>
                          : <span title="Availability confirmed" className="flex-none text-[11px] text-[#0f7a43]">✓</span>}
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{st.role} · <span className={st.avail === "confirmed" ? "text-[#0f7a43]" : "text-[#c0392b]"}>{st.avail === "confirmed" ? "Confirmed" : "Not submitted"}</span></div>
                      <div className="mt-0.5 text-[11.5px] text-[var(--ink-2)]">{hLabel(hrs)} scheduled · £{st.rate.toFixed(2)}/hr</div>
                      <div className="text-[11.5px] font-bold text-[var(--ink)]">{money(pay)} pay <span className="font-normal text-[var(--ink-3)]">· {money(cost)} incl. on-cost</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Right grid */}
        <div className="min-w-0 flex-1">
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <div style={{ minWidth: 820 }}>
                {/* Day header */}
                <div className="grid text-white" style={{ gridTemplateColumns: "repeat(7,1fr)", background: "linear-gradient(120deg,#16306e,#2f6bd8)" }}>
                  {days.map((d) => <div key={iso(d)} className="px-3 py-2.5 text-[12.5px] font-extrabold">{DAYS[(d.getUTCDay() + 6) % 7]} {d.getUTCDate()}</div>)}
                </div>

                {grid.length === 0 && <div className="py-10 text-center text-[12.5px] text-[var(--ink-3)]">No shifts this week{site !== "all" ? " at this site" : ""}.</div>}

                {grid.map((g) => (
                  <div key={g.site}>
                    <div className="flex items-center gap-2 border-b border-[var(--line)] bg-[var(--panel)] px-3 py-2">
                      <span className="text-[13px]">📍</span><span className="text-[14px] font-extrabold text-[var(--ink)]">{g.site}</span>
                      <span className="ml-auto text-[11.5px] text-[var(--ink-3)]">{g.count} shift{g.count === 1 ? "" : "s"}</span>
                    </div>
                    {g.roles.map((r) => {
                      const col = roleCol(r.role);
                      return (
                        <div key={r.role}>
                          <div className="flex items-center gap-2 border-b border-[var(--line-2,#eef2f8)] px-3 py-1.5" style={{ boxShadow: `inset 3px 0 0 ${col}` }}>
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: col }} /><span className="text-[13px] font-extrabold" style={{ color: col }}>{r.role}</span>
                          </div>
                          {/* per-day hour totals */}
                          <div className="grid border-b border-[var(--line-2,#eef2f8)]" style={{ gridTemplateColumns: "repeat(7,1fr)" }}>
                            {r.byDay.map((cells, i) => <div key={i} className="px-3 py-1 text-[10.5px] font-bold text-[var(--ink-3)]">{hLabel(cells.reduce((n, s) => n + dur(s.start, s.end), 0))}</div>)}
                          </div>
                          {/* shift cells */}
                          <div className="grid" style={{ gridTemplateColumns: "repeat(7,1fr)" }}>
                            {r.byDay.map((cells, i) => (
                              <div key={i} className="flex min-h-[70px] flex-col gap-1.5 border-r border-[var(--line-2,#eef2f8)] p-1.5 last:border-r-0">
                                {cells.map((s) => {
                                  const st = s.staffId ? staffById[s.staffId] : null;
                                  const filled = !!st;
                                  return (
                                    <div key={s.id} className="rounded-lg border px-2 py-1.5 text-[11px]"
                                      style={filled ? { borderColor: col, background: `${col}0f`, borderLeftWidth: 3 } : { borderColor: "var(--line)", borderStyle: "dashed", background: "var(--surface)" }}>
                                      <div className="flex items-start gap-1">
                                        <span className="min-w-0 flex-1 font-extrabold text-[var(--ink)]">{to12(s.start)} – {to12(s.end)}</span>
                                        {canManage && <button type="button" onClick={() => removeShift(s.id)} className="flex-none text-[var(--ink-3)] hover:text-[#c0392b]" aria-label="Remove">×</button>}
                                      </div>
                                      <div className={"truncate " + (filled ? "font-bold text-[var(--ink)]" : "text-[var(--ink-3)]")}>{st ? st.name : "Unfilled"}</div>
                                      {filled && (
                                        <div className="mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold"
                                          style={s.out ? { background: "#e2f4ea", color: "#0f7a43" } : s.in ? { background: "#e2f4ea", color: "#0f7a43" } : { background: "var(--panel)", color: "var(--ink-3)" }}>
                                          {s.out ? `✅ Out ${to12(s.out)}` : s.in ? `🟢 In ${to12(s.in)}` : "⚪ Not in"}
                                        </div>
                                      )}
                                      {s.locked && <div className="mt-1 inline-block rounded bg-[#1d3a8f] px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-white">Locked</div>}
                                    </div>
                                  );
                                })}
                                {canManage && <button type="button" onClick={() => setDraft({ site: g.site, role: r.role, date: iso(days[i]), staffId: null, start: "09:00", end: "17:00" })} className="rounded-lg border border-dashed border-[var(--line)] py-1 text-[13px] text-[var(--ink-3)] hover:border-[var(--brand)] hover:text-[#1d3a8f]">＋</button>}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Add-shift modal */}
      {draft && (
        <div className="fixed inset-0 z-[130] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[8vh]" onClick={() => setDraft(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-[15px] font-extrabold text-[var(--ink)]">Add a shift</div>
            <div className="mt-1 text-[12px] text-[var(--ink-3)]">{draft.role} · {draft.site} · {new Date(`${draft.date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" })}</div>
            <div className="mt-3 grid gap-2.5">
              <div><label className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Assign to</label>
                <Select value={draft.staffId ?? ""} onChange={(e) => setDraft({ ...draft, staffId: e.target.value || null })} className="w-full"><option value="">Unfilled — fill later</option>{store.staff.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.role}</option>)}</Select></div>
              <div className="grid grid-cols-2 gap-2.5">
                <div><label className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Start</label><Input type="time" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} className="w-full" /></div>
                <div><label className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">End</label><Input type="time" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} className="w-full" /></div>
              </div>
            </div>
            <div className="mt-4 flex gap-2"><Button variant="primary" onClick={saveDraft}>Add shift</Button><Button onClick={() => setDraft(null)}>Cancel</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}
