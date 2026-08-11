"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useSettings } from "@/lib/settings";
import { Card, Input, Select } from "@/components/ui";

export interface Venue {
  id: string;
  name: string;
  address?: string;
  city?: string;
  kind?: "place" | "online";
  facilities?: string[];
  directions?: string;
  transport?: string;
  what3words?: string;
  lat?: number;
  lng?: number;
  zoom?: number;
}

type LocTab = "staff" | "timesheets" | "notifications";
const TABS: [LocTab, string][] = [
  ["staff", "Staff"], ["timesheets", "Timesheets"], ["notifications", "Notifications & extensions"],
];

const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const AV_COL = ["#c2268f", "#0f857b", "#2f6bd8", "#c06a10", "#6366f1", "#b45309"];
const avColour = (id: string) => AV_COL[[...id].reduce((n, c) => n + c.charCodeAt(0), 0) % AV_COL.length];

// ── Local demo store: who's assigned to which sites + pending invites ────────
interface LocStaff { id: string; name: string; home: string; sites: string[]; role?: string; perm?: string }
interface Pending { id: string; name: string; email: string; perm: string; jobTitle: string; at: string }
interface Store { staff: LocStaff[]; pending: Pending[] }
const KEY = "aos.locstaff.v1";
const load = (): Store | null => { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; } };
const seed = (venueIds: string[]): Store => {
  const all = venueIds.slice();
  const two = venueIds.slice(0, 2);
  return {
    staff: [
      { id: "susan", name: "Susan Preston", home: "Milton Keynes", role: "Lead Coach", perm: "Manager", sites: two },
      { id: "amelia", name: "Amelia Hart", home: "Milton Keynes", role: "Coach", perm: "Staff", sites: two },
      { id: "oluwa", name: "OluwaDamilola Adeyemi", home: "Loughton", role: "Lead Coach", perm: "Manager", sites: all },
      { id: "liberty", name: "Liberty Young", home: "Milton Keynes", role: "Coach", perm: "Staff", sites: [venueIds[0]].filter(Boolean) },
      { id: "dom", name: "Dom Reyes", home: "Milton Keynes", role: "Lifeguard", perm: "Staff", sites: [] },
      { id: "kitty", name: "Kitty-Rose Bright", home: "Loughton", role: "Activity Assistant", perm: "Staff", sites: [] },
      { id: "louis", name: "Louis Calderwood", home: "Milton Keynes", role: "Lifeguard", perm: "Staff", sites: [] },
      { id: "taigan", name: "Taigan McMahon", home: "Loughton", role: "First Aider", perm: "Staff", sites: [] },
    ],
    pending: [],
  };
};

export function LocationDetail({ venue, venues, onBack }: { venue: Venue; venues: Venue[]; onBack: () => void }) {
  const { settings, save } = useSettings();
  const jobTitles = settings.staffRoles?.length ? settings.staffRoles : ["Lead Coach", "Coach", "Lifeguard", "First Aider", "Activity Assistant"];
  const permRoles = (settings.roles ?? []).map((r) => r.name);
  const saveJobTitles = (next: string[]) => void save({ settings: { ...settings, staffRoles: next } });

  const [tab, setTab] = useState<LocTab>("staff");
  const [store, setStore] = useState<Store>({ staff: [], pending: [] });
  const [toast, setToast] = useState<string | null>(null);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2400); };
  const venueIds = useMemo(() => venues.map((v) => v.id), [venues]);

  useEffect(() => { setStore(load() ?? seed(venueIds)); }, [venueIds]);
  const persist = (s: Store) => { setStore(s); try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } };

  const assignedHere = store.staff.filter((s) => s.sites.includes(venue.id));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <button type="button" onClick={onBack} className="mb-1 text-[13px] font-bold text-[#1d3a8f] hover:underline">‹ All locations</button>
          <h2 className="text-[26px] font-extrabold text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{venue.name}</h2>
        </div>
        <button type="button" onClick={() => flash("Saved.")} className="rounded-full bg-[#0f7a43] px-6 py-2.5 text-[14px] font-extrabold text-white hover:brightness-105">Save</button>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="lg:w-[180px] lg:flex-none">
          <div className="flex gap-1.5 overflow-x-auto lg:flex-col">
            {TABS.map(([t, lbl]) => (
              <button key={t} type="button" onClick={() => setTab(t)}
                className={"whitespace-nowrap rounded-xl px-3.5 py-2.5 text-left text-[13.5px] font-bold transition-colors " + (tab === t ? "bg-[#eef4fd] text-[#1d3a8f]" : "text-[var(--ink-2)] hover:bg-[var(--panel)]")}
                style={tab === t ? { boxShadow: "inset 3px 0 0 #2f6bd8" } : undefined}>{lbl}</button>
            ))}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          {tab === "staff" && (
            <StaffTab venue={venue} venues={venues} store={store} persist={persist} jobTitles={jobTitles} permRoles={permRoles}
              onAddJobTitle={(t) => saveJobTitles([...new Set([...jobTitles, t])])} assignedHere={assignedHere} flash={flash} />
          )}
          {tab === "timesheets" && <TimesheetsTab venueName={venue.name} />}
          {tab === "notifications" && <NotificationsTab />}
        </div>
      </div>

      {toast && <div className="fixed bottom-5 left-1/2 z-[140] -translate-x-1/2 rounded-full bg-[#16306e] px-4 py-2.5 text-[12.5px] font-bold text-white shadow-lg">{toast}</div>}
    </div>
  );
}

// ── Roles editor — the shared job-titles list (coloured schedule rows) ───────
// One central editor (used in the Staff area). Not per-location — the list is
// company-wide and feeds the schedule + the invite Job-title picker.
export function RolesEditor({ jobTitles, onChange }: { jobTitles: string[]; onChange: (next: string[]) => void }) {
  const [adding, setAdding] = useState("");
  const rename = (i: number, v: string) => onChange(jobTitles.map((r, j) => (j === i ? v : r)));
  const remove = (i: number) => onChange(jobTitles.filter((_, j) => j !== i));
  const add = () => { const v = adding.trim(); if (!v || jobTitles.includes(v)) { setAdding(""); return; } onChange([...jobTitles, v]); setAdding(""); };
  return (
    <Card className="p-5">
      <div className="text-[16px] font-extrabold text-[var(--ink)]">Roles</div>
      <p className="mt-1 text-[13px] leading-relaxed text-[var(--ink-2)]">The <b>roles</b> staff are rostered into — e.g. Lifeguard, Site Manager, Instructor, SEND, Lead Coach. These are the coloured rows in the schedule and the <b>Job title</b> options when you invite someone. A role carries nothing extra — just a name.</p>
      <p className="mt-1 text-[12px] italic text-[var(--ink-3)]">Access levels (Owner / Management / Staff) are separate — those are set under Roles &amp; permissions in Setup.</p>

      <div className="mt-4 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Roles</div>
      <div className="mt-2 flex flex-col gap-2">
        {jobTitles.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input value={r} onChange={(e) => rename(i, e.target.value)} className="flex-1" />
            <button type="button" onClick={() => remove(i)} title="Remove role" className="px-2 text-[18px] text-[var(--ink-3)] hover:text-[#c0392b]">×</button>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <Input value={adding} onChange={(e) => setAdding(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder="e.g. Site Manager" className="flex-1" />
          <button type="button" onClick={add} className="whitespace-nowrap px-2 text-[13px] font-extrabold text-[#1d3a8f] hover:underline">＋ Add a role</button>
        </div>
      </div>
    </Card>
  );
}

// ── Staff (the main tab) ────────────────────────────────────────────────────
function StaffTab({ venue, venues, store, persist, jobTitles, permRoles, onAddJobTitle, assignedHere, flash }: {
  venue: Venue; venues: Venue[]; store: Store; persist: (s: Store) => void; jobTitles: string[]; permRoles: string[];
  onAddJobTitle: (t: string) => void; assignedHere: LocStaff[]; flash: (m: string) => void;
}) {
  const [view, setView] = useState<"staff" | "site">("staff");
  const [q, setQ] = useState("");
  const [nName, setNName] = useState("");
  const [nEmail, setNEmail] = useState("");
  const [nPerm, setNPerm] = useState("");
  const [nJob, setNJob] = useState("");

  const toggleSite = (staffId: string, siteId: string) => persist({ ...store, staff: store.staff.map((s) => s.id === staffId ? { ...s, sites: s.sites.includes(siteId) ? s.sites.filter((x) => x !== siteId) : [...s.sites, siteId] } : s) });
  const tickAll = () => persist({ ...store, staff: store.staff.map((s) => ({ ...s, sites: venues.map((v) => v.id) })) });
  const untickAll = () => persist({ ...store, staff: store.staff.map((s) => ({ ...s, sites: [] })) });
  const removeFromLoc = (staffId: string) => persist({ ...store, staff: store.staff.map((s) => s.id === staffId ? { ...s, sites: s.sites.filter((x) => x !== venue.id) } : s) });

  const notHere = store.staff.filter((s) => !s.sites.includes(venue.id));
  const searchMatches = q.trim() ? notHere.filter((s) => s.name.toLowerCase().includes(q.toLowerCase())) : [];
  const addToLoc = (staffId: string) => { persist({ ...store, staff: store.staff.map((s) => s.id === staffId ? { ...s, sites: [...new Set([...s.sites, venue.id])] } : s) }); setQ(""); flash("Added to this location."); };

  const sendInvite = () => {
    if (!nName.trim() || !nEmail.trim()) return;
    const p: Pending = { id: `p${Date.now()}`, name: nName.trim(), email: nEmail.trim(), perm: nPerm || permRoles[0] || "Staff", jobTitle: nJob || jobTitles[0] || "", at: new Date().toISOString() };
    persist({ ...store, pending: [...store.pending, p] });
    void api("/api/invites", { method: "POST", body: JSON.stringify({ role: "staff", email: p.email, staffRole: p.perm, jobTitle: p.jobTitle, assignment: { mode: "locations", ids: [venue.id] } }) }).catch(() => {});
    setNName(""); setNEmail(""); setNPerm(""); setNJob(""); flash("Invite sent — they'll appear under Pending until they activate.");
  };
  const cancelPending = (id: string) => persist({ ...store, pending: store.pending.filter((p) => p.id !== id) });

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <div className="text-[17px] font-extrabold text-[var(--ink)]">Staff at this location</div>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--ink-2)]">People are onboarded to your company <b>once</b>, then assigned to the <b>sites</b> they work at within {venue.name}. Turn a site on for someone and the schedule offers them for that site&rsquo;s shifts.</p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--panel)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--ink-2)]">👥 {assignedHere.length} assigned to this location</span>
          <button type="button" onClick={tickAll} className="rounded-full border border-[#bfe3cd] bg-[#eef8f1] px-3.5 py-2 text-[12.5px] font-bold text-[#0f7a43] hover:brightness-105">✓ Tick all sites</button>
          <button type="button" onClick={untickAll} className="rounded-full border border-[var(--line)] bg-white px-3.5 py-2 text-[12.5px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">Untick all</button>
        </div>

        <div className="mt-3 inline-flex rounded-xl bg-[var(--panel)] p-1">
          {(["staff", "site"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)} className={"rounded-lg px-4 py-1.5 text-[13px] font-bold transition-colors " + (view === v ? "bg-white text-[#1d3a8f] shadow-sm" : "text-[var(--ink-2)]")}>{v === "staff" ? "Staff view" : "Site view"}</button>
          ))}
        </div>

        {venues.length === 0 ? (
          <p className="mt-3 rounded-lg bg-[var(--panel)] px-3 py-3 text-center text-[12.5px] text-[var(--ink-3)]">No sites yet — add venues under Listings → Locations first.</p>
        ) : view === "staff" ? (
          <div className="mt-3 flex flex-col gap-2">
            {store.staff.map((s) => (
              <div key={s.id} className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[12px] font-extrabold text-white" style={{ background: avColour(s.id) }}>{initials(s.name)}</span>
                  <div className="min-w-0 flex-1"><div className="truncate text-[14px] font-extrabold text-[var(--ink)]">{s.name}</div><div className="text-[11.5px] text-[var(--ink-3)]">{s.role ? `${s.role} · ` : ""}{s.perm ? `${s.perm} · ` : ""}from {s.home}</div></div>
                  <span className="text-[11.5px] font-bold text-[var(--ink-3)]">{s.sites.length} of {venues.length} sites</span>
                  <button type="button" onClick={() => removeFromLoc(s.id)} title="Remove from this location" className="text-[16px] text-[var(--ink-3)] hover:text-[#c0392b]">×</button>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {venues.map((v) => { const on = s.sites.includes(v.id); return (
                    <button key={v.id} type="button" onClick={() => toggleSite(s.id, v.id)}
                      className="rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors"
                      style={on ? { borderColor: "#22b365", background: "#eef8f1", color: "#0f7a43" } : { borderColor: "#c9d6ef", background: "white", color: "#1d3a8f" }}>
                      {on ? "✓ " : ""}{v.name}
                    </button>
                  ); })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {venues.map((v) => { const on = store.staff.filter((s) => s.sites.includes(v.id)); return (
              <div key={v.id} className="overflow-hidden rounded-2xl border border-[var(--line)]" style={{ boxShadow: `inset 4px 0 0 ${v.id === venue.id ? "#22b365" : "#2f6bd8"}` }}>
                <div className="flex items-center gap-2 bg-[var(--panel)] px-3 py-2.5"><span className="text-[13px]">📍</span><span className="text-[14px] font-extrabold text-[var(--ink)]">{v.name}</span><span className="ml-auto text-[11.5px] font-bold text-[#1d3a8f]">{on.length} of {store.staff.length} staff</span></div>
                <div className="flex flex-col divide-y divide-[var(--line-2,#eef2f8)] bg-white">
                  {store.staff.map((s) => { const isOn = s.sites.includes(v.id); return (
                    <div key={s.id} className="flex items-center gap-2.5 px-3 py-2.5">
                      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[11px] font-extrabold text-white" style={{ background: avColour(s.id) }}>{initials(s.name)}</span>
                      <div className="min-w-0 flex-1"><div className="truncate text-[13.5px] font-bold text-[var(--ink)]">{s.name}</div><div className="text-[11px] text-[var(--ink-3)]">from {s.home}</div></div>
                      <button type="button" onClick={() => toggleSite(s.id, v.id)} role="switch" aria-checked={isOn} className="relative h-[22px] w-[40px] flex-none rounded-full transition-colors" style={{ background: isOn ? "#22b365" : "var(--line)" }}><span className="absolute top-[3px] h-[16px] w-[16px] rounded-full bg-white transition-all" style={{ left: isOn ? "21px" : "3px" }} /></button>
                    </div>
                  ); })}
                </div>
              </div>
            ); })}
          </div>
        )}
      </Card>

      {/* add existing staff */}
      <Card className="p-5">
        <div className="text-[15px] font-extrabold text-[var(--ink)]">Add an existing staff member</div>
        <p className="mt-1 text-[12.5px] text-[var(--ink-3)]">Search across <b>all</b> your onboarded staff — including people onboarded at another location — and add them to {venue.name}.</p>
        <Select value="" onChange={(e) => { if (e.target.value) addToLoc(e.target.value); }} className="mt-3 w-full">
          <option value="">Choose from all staff…</option>
          {notHere.map((s) => <option key={s.id} value={s.id}>{s.name}{s.role ? ` · ${s.role}` : ""} — from {s.home}</option>)}
        </Select>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 …or search all staff by name" className="mt-2 w-full" />
        {q.trim() ? (
          <div className="mt-2 flex flex-col gap-1.5">
            {searchMatches.length === 0 ? <p className="text-[12px] text-[var(--ink-3)]">No matches not already here.</p> : searchMatches.map((s) => (
              <button key={s.id} type="button" onClick={() => addToLoc(s.id)} className="flex items-center gap-2.5 rounded-xl border border-[var(--line)] px-3 py-2 text-left hover:bg-[var(--panel)]">
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[11px] font-extrabold text-white" style={{ background: avColour(s.id) }}>{initials(s.name)}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-bold text-[var(--ink)]">{s.name}</span><span className="block text-[11px] text-[var(--ink-3)]">from {s.home}</span></span>
                <span className="text-[12px] font-bold text-[#1d3a8f]">Add ›</span>
              </button>
            ))}
          </div>
        ) : <p className="mt-1.5 text-[11.5px] text-[var(--ink-3)]">Start typing a name to find staff from any location.</p>}
      </Card>

      {/* pending invites */}
      <Card className="p-5">
        <div className="flex items-center gap-2"><div className="text-[15px] font-extrabold text-[var(--ink)]">Pending invites</div><span className="rounded-full bg-[#fff4d6] px-2 py-0.5 text-[11px] font-extrabold text-[#a86a00]">{store.pending.length}</span></div>
        <p className="mt-1 text-[12.5px] text-[var(--ink-3)]">People you invite wait here until they activate. <b>They are not in the schedule</b> and can&rsquo;t be rostered until they first log in and complete onboarding.</p>
        {store.pending.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-[var(--line)] px-3 py-3 text-center text-[12.5px] text-[var(--ink-3)]">No pending invites — anyone you invite below appears here as <b>Pending</b> until they activate.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-1.5">{store.pending.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[12.5px]">
              <span className="font-bold text-[var(--ink)]">{p.name}</span><span className="text-[var(--ink-3)]">{p.email} · {p.perm}{p.jobTitle ? ` · ${p.jobTitle}` : ""}</span>
              <span className="ml-auto rounded-full bg-[#fff4d6] px-2 py-0.5 text-[11px] font-bold text-[#a86a00]">Pending</span>
              <button type="button" onClick={() => cancelPending(p.id)} className="text-[12px] font-bold text-[#c0392b] hover:underline">Cancel</button>
            </div>
          ))}</div>
        )}
      </Card>

      {/* onboard someone new — two layers: access role + job title */}
      <Card className="p-5">
        <div className="text-[15px] font-extrabold text-[var(--ink)]">Onboard someone new</div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--ink-3)]">Add their name and email — we&rsquo;ll <b>email them an invite</b>. Give them an <b>access role</b> (what they can see &amp; do) and a <b>job title</b> (what they&rsquo;re rostered as). They appear under <b>Pending invites</b>, <b>not in the schedule</b>, until they first log in and finish onboarding.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Input value={nName} onChange={(e) => setNName(e.target.value)} placeholder="Full name" className="w-full" />
          <Input type="email" value={nEmail} onChange={(e) => setNEmail(e.target.value)} placeholder="Email address" className="w-full" />
          <div><label className="mb-1 block text-[10px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Access role — permissions</label><Select value={nPerm} onChange={(e) => setNPerm(e.target.value)} className="w-full"><option value="">— Access role —</option>{permRoles.map((r) => <option key={r} value={r}>{r}</option>)}</Select></div>
          <div>
            <label className="mb-1 flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Job title — rostered as
              <button type="button" onClick={() => { const t = window.prompt("New job title")?.trim(); if (t) { onAddJobTitle(t); setNJob(t); } }} className="ml-auto normal-case text-[11px] font-bold text-[#1d3a8f] hover:underline">＋ Add</button>
            </label>
            <Select value={nJob} onChange={(e) => setNJob(e.target.value)} className="w-full"><option value="">— Job title —</option>{jobTitles.map((r) => <option key={r} value={r}>{r}</option>)}</Select>
          </div>
        </div>
        <div className="mt-3 flex justify-end"><button type="button" disabled={!nName.trim() || !nEmail.trim()} onClick={sendInvite} className="rounded-full bg-[#0f7a43] px-6 py-2.5 text-[13px] font-extrabold text-white hover:brightness-105 disabled:opacity-40">Send invite</button></div>
      </Card>
    </div>
  );
}

// ── Timesheets / Notifications ──────────────────────────────────────────────
function TimesheetsTab({ venueName }: { venueName: string }) {
  return (
    <Card className="p-5">
      <div className="text-[16px] font-extrabold text-[var(--ink)]">Timesheets</div>
      <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--ink-2)]">Once staff check in and out on the register, their hours at {venueName} roll up here and feed Payroll (hours × rate, plus on-cost). Check-in / check-out is wired on the schedule; the timesheet roll-up and export are on the backend list.</p>
      <div className="mt-3 rounded-xl bg-[var(--panel)] px-3 py-3 text-center text-[12.5px] text-[var(--ink-3)]">No approved hours yet this period.</div>
    </Card>
  );
}
function NotificationsTab() {
  const [flags, setFlags] = useState({ shiftPublished: true, checkinMissed: true, weeklySummary: false });
  const rows: [keyof typeof flags, string, string][] = [
    ["shiftPublished", "Shifts published", "Tell staff at this location when their rota is published."],
    ["checkinMissed", "Missed check-in", "Alert a manager when someone assigned here hasn't checked in by their start time."],
    ["weeklySummary", "Weekly summary", "Email a manager a Monday summary of the week's hours and gaps."],
  ];
  return (
    <Card className="p-5">
      <div className="text-[16px] font-extrabold text-[var(--ink)]">Notifications & extensions</div>
      <p className="mt-1 text-[12.5px] text-[var(--ink-3)]">What this location tells staff and managers. Saved locally for now.</p>
      <div className="mt-3 flex flex-col divide-y divide-[var(--line-2,#eef2f8)]">
        {rows.map(([k, title, desc]) => (
          <div key={k} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1"><div className="text-[13.5px] font-extrabold text-[var(--ink)]">{title}</div><div className="text-[11.5px] text-[var(--ink-3)]">{desc}</div></div>
            <button type="button" onClick={() => setFlags((f) => ({ ...f, [k]: !f[k] }))} role="switch" aria-checked={flags[k]} className="relative h-[22px] w-[40px] flex-none rounded-full transition-colors" style={{ background: flags[k] ? "#2f6bd8" : "var(--line)" }}><span className="absolute top-[3px] h-[16px] w-[16px] rounded-full bg-white transition-all" style={{ left: flags[k] ? "21px" : "3px" }} /></button>
          </div>
        ))}
      </div>
    </Card>
  );
}

