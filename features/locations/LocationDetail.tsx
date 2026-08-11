"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { useSettings, type SchedulingSettings, DEFAULT_SCHEDULING } from "@/lib/settings";
import { Card, Input, Select } from "@/components/ui";
import { VenueMap } from "@/features/listings/VenueMap";

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

type LocTab = "general" | "roles" | "staff" | "scheduling" | "timesheets" | "notifications";
const TABS: [LocTab, string][] = [
  ["general", "General"], ["roles", "Roles"], ["staff", "Staff"],
  ["scheduling", "Scheduling"], ["timesheets", "Timesheets"], ["notifications", "Notifications & extensions"],
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
  const scheduling = { ...DEFAULT_SCHEDULING, ...(settings.scheduling ?? {}) };
  const saveJobTitles = (next: string[]) => void save({ settings: { ...settings, staffRoles: next } });
  const saveScheduling = (next: SchedulingSettings) => void save({ settings: { ...settings, scheduling: next } });

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
          {tab === "general" && <GeneralTab venue={venue} />}
          {tab === "roles" && <RolesTab jobTitles={jobTitles} onChange={saveJobTitles} />}
          {tab === "staff" && (
            <StaffTab venue={venue} venues={venues} store={store} persist={persist} jobTitles={jobTitles} permRoles={permRoles}
              onAddJobTitle={(t) => saveJobTitles([...new Set([...jobTitles, t])])} assignedHere={assignedHere} flash={flash} />
          )}
          {tab === "scheduling" && <SchedulingTab value={scheduling} onChange={saveScheduling} />}
          {tab === "timesheets" && <TimesheetsTab venueName={venue.name} />}
          {tab === "notifications" && <NotificationsTab />}
        </div>
      </div>

      {toast && <div className="fixed bottom-5 left-1/2 z-[140] -translate-x-1/2 rounded-full bg-[#16306e] px-4 py-2.5 text-[12.5px] font-bold text-white shadow-lg">{toast}</div>}
    </div>
  );
}

// ── General ─────────────────────────────────────────────────────────────────
function GeneralTab({ venue }: { venue: Venue }) {
  return (
    <Card className="overflow-hidden p-0">
      {venue.kind !== "online" && venue.lat !== undefined && venue.lng !== undefined && <VenueMap lat={venue.lat} lng={venue.lng} zoom={venue.zoom} height={170} />}
      <div className="p-5">
        <div className="text-[16px] font-extrabold text-[var(--ink)]">{venue.name}</div>
        {venue.address && <div className="mt-1 text-[13px] text-[var(--ink-2)]">{venue.address}{venue.city ? `, ${venue.city}` : ""}</div>}
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {venue.transport && <Field label="Transport" value={venue.transport} />}
          {venue.directions && <Field label="Directions" value={venue.directions} />}
          {venue.what3words && <Field label="what3words" value={`///${venue.what3words.replace(/^\/+/, "")}`} />}
        </div>
        {venue.facilities && venue.facilities.length > 0 && (
          <div className="mt-3"><div className="mb-1 text-[10px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Facilities</div><div className="flex flex-wrap gap-1.5">{venue.facilities.map((f, i) => <span key={i} className="rounded-full bg-[var(--panel)] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--ink-2)]">{f}</span>)}</div></div>
        )}
        <p className="mt-4 rounded-lg bg-[var(--panel)] px-3 py-2.5 text-[12px] text-[var(--ink-3)]">Venue details (address, map, facilities) are edited under <b>Listings → Locations</b> — that&rsquo;s the single source. This page manages the staff, roles and scheduling for the venue.</p>
      </div>
    </Card>
  );
}
const Field = ({ label, value }: { label: string; value: string }) => (
  <div><div className="text-[10px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{label}</div><div className="text-[12.5px] text-[var(--ink)]">{value}</div></div>
);

// ── Roles — editable job-titles list (the coloured schedule rows) ────────────
function RolesTab({ jobTitles, onChange }: { jobTitles: string[]; onChange: (next: string[]) => void }) {
  const [adding, setAdding] = useState("");
  const rename = (i: number, v: string) => onChange(jobTitles.map((r, j) => (j === i ? v : r)));
  const remove = (i: number) => onChange(jobTitles.filter((_, j) => j !== i));
  const add = () => { const v = adding.trim(); if (!v || jobTitles.includes(v)) { setAdding(""); return; } onChange([...jobTitles, v]); setAdding(""); };
  return (
    <Card className="p-5">
      <div className="text-[16px] font-extrabold text-[var(--ink)]">Roles</div>
      <p className="mt-1 text-[13px] leading-relaxed text-[var(--ink-2)]">The <b>roles</b> staff are rostered into — e.g. Lifeguard, Site Manager, Instructor, SEND, Lead Coach. (These are the coloured rows in the schedule.) Roles are managed centrally under <b>Your team</b> and sync here automatically; you can also add or edit them here. A role carries nothing extra — just a name.</p>
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

// ── Scheduling settings ─────────────────────────────────────────────────────
function SchedulingTab({ value, onChange }: { value: SchedulingSettings; onChange: (next: SchedulingSettings) => void }) {
  const set = <K extends keyof SchedulingSettings>(k: K, v: SchedulingSettings[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <SecHead>Basics</SecHead>
        <SelRow label="First day of week" desc="Determines the start day of the schedule and the default week period for calculating weekly overtime." value={value.firstDay} onChange={(v) => set("firstDay", v as "mon" | "sun")} opts={[["mon", "Mon"], ["sun", "Sun"]]} />
        <NumRow label="Default shift duration (hours)" desc="Default shift length when creating shifts." value={value.defaultShiftHours} onChange={(v) => set("defaultShiftHours", v)} suffix="hrs" />
        <NumRow label="Default break duration (minutes)" desc="Default break length when creating shifts." value={value.defaultBreakMins} onChange={(v) => set("defaultBreakMins", v)} suffix="mins" />
        <SelRow label="Default break — paid or unpaid" desc="Sets whether the pre-filled break counts as paid time. Drives worked-hours and the pay vs cost split shown on the schedule. Recorded only — no money is moved." value={value.breakPaid} onChange={(v) => set("breakPaid", v as "paid" | "unpaid")} opts={[["unpaid", "Unpaid"], ["paid", "Paid"]]} />
      </Card>

      <Card className="p-5">
        <SecHead>Creating and publishing shifts</SecHead>
        <SelRow label="Shift notifications recipient" desc="Who receives shift notifications for late staff and shift-swap approvals." value={value.notifyRecipient} onChange={(v) => set("notifyRecipient", v as SchedulingSettings["notifyRecipient"])} opts={[["bestfit", "Best fit"], ["manager", "Site manager"], ["admin", "Admin / Owner"]]} />
        <SelRow label="Send notification when shifts are removed" desc="Notify staff when they are removed from a published shift." value={value.notifyOnRemoved} onChange={(v) => set("notifyOnRemoved", v as SchedulingSettings["notifyOnRemoved"])} opts={[["email_push", "Email and smartphone push"], ["email", "Email only"], ["push", "Push only"], ["none", "Don't notify"]]} />
        <TogRow label="Allow staff to claim or request open shifts if unavailable" desc="Staff can claim or request open shifts (with approval) even if unavailable or partially available. Extends to staff-initiated swaps and offers." value={value.allowClaimOpen} onChange={(v) => set("allowClaimOpen", v)} />
        <SelRow label="Turn unconfirmed published shifts to open shifts" desc="After this timeframe, unconfirmed published shifts become open shifts." value={value.unconfirmedToOpen} onChange={(v) => set("unconfirmedToOpen", v as SchedulingSettings["unconfirmedToOpen"])} opts={[["off", "Not required"], ["12h", "After 12 hours"], ["24h", "After 24 hours"], ["48h", "After 48 hours"]]} />
        <SelRow label="Scheduling suggestion order" desc="How suggested staff are displayed. Best fit spreads scheduled hours evenly across the team while minimising cost." value={value.suggestionOrder} onChange={(v) => set("suggestionOrder", v as SchedulingSettings["suggestionOrder"])} opts={[["bestfit", "Best fit"], ["cost", "Lowest cost first"], ["hours", "Fewest hours first"]]} />
        <TogRow label="Display location and area name when publishing via SMS and calendar" desc="Show location and area names instead of codes. May result in additional SMS charges." value={value.showLocationNames} onChange={(v) => set("showLocationNames", v)} />
      </Card>

      <Card className="p-5">
        <SecHead>Swaps and offers</SecHead>
        <SelRow label="Co-worker schedule visibility" desc="If staff can view each other's schedule, you can enable shift swaps between them." value={value.coworkerVisibility} onChange={(v) => set("coworkerVisibility", v as SchedulingSettings["coworkerVisibility"])} opts={[["all", "Allow all"], ["team", "Same team only"], ["none", "Hidden"]]} />
        <TogRow label="Swap shifts" desc="Staff can swap shifts with each other if both hold the appropriate training/qualifications." value={value.swapShifts} onChange={(v) => set("swapShifts", v)} />
        <TogRow label="Manager approval for shift swaps" desc="Require a manager to approve shift swaps." value={value.swapApproval} onChange={(v) => set("swapApproval", v)} />
        <TogRow label="Offer shifts" desc="Staff can offer their shift to qualified, available co-workers. Manager approval not required but a manager is notified when the shift is accepted." value={value.offerShifts} onChange={(v) => set("offerShifts", v)} />
      </Card>

      <Card className="p-5">
        <SecHead>Reporting</SecHead>
        <NumRow label="On-cost percentage" desc="Adds an additional cost on top of all wages (e.g. employer NI, pension). Shows on the schedule and on cost reports. Recorded only — ActivityOS never moves money." value={value.onCostPct} onChange={(v) => set("onCostPct", v)} suffix="%" step="0.01" />
        <NumRow label="Default open/empty shift cost (per hour)" desc="Open/empty shifts are included in scheduled hours and cost using this default hourly cost." value={value.openShiftCost} onChange={(v) => set("openShiftCost", v)} suffix="£/hr" />
      </Card>

      <Card className="p-5">
        <SecHead>Availability</SecHead>
        <TogRow label="Send reminders" desc="Remind staff to keep their availability up to date." value={value.availabilityReminders} onChange={(v) => set("availabilityReminders", v)} />
      </Card>
    </div>
  );
}
const SecHead = ({ children }: { children: ReactNode }) => <div className="mb-1 text-[17px] font-extrabold text-[var(--ink)]">{children}</div>;
function RowShell({ label, desc, control }: { label: string; desc: string; control: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-4 border-t border-[var(--line-2,#eef2f8)] py-3.5 first:border-t-0">
      <div className="min-w-[180px] flex-1"><div className="text-[13.5px] font-extrabold text-[var(--ink)]">{label}</div><div className="mt-0.5 text-[11.5px] leading-relaxed text-[var(--ink-3)]">{desc}</div></div>
      <div className="flex-none">{control}</div>
    </div>
  );
}
function SelRow({ label, desc, value, onChange, opts }: { label: string; desc: string; value: string; onChange: (v: string) => void; opts: [string, string][] }) {
  return <RowShell label={label} desc={desc} control={<Select value={value} onChange={(e) => onChange(e.target.value)} className="min-w-[190px]">{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>} />;
}
function NumRow({ label, desc, value, onChange, suffix, step }: { label: string; desc: string; value: number; onChange: (v: number) => void; suffix?: string; step?: string }) {
  return <RowShell label={label} desc={desc} control={<span className="inline-flex items-center gap-1.5"><Input type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-[120px] text-right" />{suffix && <span className="text-[12.5px] font-bold text-[var(--ink-3)]">{suffix}</span>}</span>} />;
}
function TogRow({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return <RowShell label={label} desc={desc} control={
    <span className="inline-flex items-center gap-2">
      <button type="button" onClick={() => onChange(!value)} role="switch" aria-checked={value} className="relative h-[24px] w-[44px] flex-none rounded-full transition-colors" style={{ background: value ? "#22b365" : "var(--line)" }}><span className="absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white transition-all" style={{ left: value ? "23px" : "3px" }} /></button>
      <span className="w-[26px] text-[11px] font-extrabold" style={{ color: value ? "#0f7a43" : "var(--ink-3)" }}>{value ? "ON" : "OFF"}</span>
    </span>
  } />;
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

