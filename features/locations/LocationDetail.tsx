"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useTenantSettings } from "@/lib/settings";
import { Button, Card, Input, Select } from "@/components/ui";
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
// Front-end only until the backend lands (staff_assignments + invites). Mirrors
// the manual's "onboarded once, assigned to the sites they work at" model.
interface LocStaff { id: string; name: string; home: string; sites: string[]; role?: string }
interface Pending { id: string; name: string; email: string; role: string; at: string }
interface Store { staff: LocStaff[]; pending: Pending[] }
const KEY = "aos.locstaff.v1";
const load = (): Store | null => { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; } };
const seed = (venueIds: string[]): Store => {
  const all = venueIds.slice();
  const two = venueIds.slice(0, 2);
  return {
    staff: [
      { id: "susan", name: "Susan Preston", home: "Milton Keynes", role: "Lead Coach", sites: two },
      { id: "amelia", name: "Amelia Hart", home: "Milton Keynes", role: "Coach", sites: two },
      { id: "oluwa", name: "OluwaDamilola Adeyemi", home: "Loughton", role: "Lead Coach", sites: all },
      { id: "liberty", name: "Liberty Young", home: "Milton Keynes", role: "Coach", sites: [venueIds[0]].filter(Boolean) },
      { id: "dom", name: "Dom Reyes", home: "Milton Keynes", role: "Lifeguard", sites: [] },
      { id: "kitty", name: "Kitty-Rose Bright", home: "Loughton", role: "Activity Assistant", sites: [] },
      { id: "louis", name: "Louis Calderwood", home: "Milton Keynes", role: "Lifeguard", sites: [] },
      { id: "taigan", name: "Taigan McMahon", home: "Loughton", role: "First Aider", sites: [] },
    ],
    pending: [],
  };
};

export function LocationDetail({ venue, venues, onBack }: { venue: Venue; venues: Venue[]; onBack: () => void }) {
  const { settings } = useTenantSettings();
  const staffRoles = settings.staffRoles?.length ? settings.staffRoles : ["Lead Coach", "Coach", "Lifeguard", "First Aider", "Activity Assistant"];
  const [tab, setTab] = useState<LocTab>("staff");
  const [store, setStore] = useState<Store>({ staff: [], pending: [] });
  const [toast, setToast] = useState<string | null>(null);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2400); };
  const venueIds = useMemo(() => venues.map((v) => v.id), [venues]);

  useEffect(() => {
    const existing = load();
    setStore(existing ?? seed(venueIds));
  }, [venueIds]);
  const persist = (s: Store) => { setStore(s); try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } };

  const venueName = (id: string) => venues.find((v) => v.id === id)?.name ?? id;
  const assignedHere = store.staff.filter((s) => s.sites.includes(venue.id));

  return (
    <div>
      {/* header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <button type="button" onClick={onBack} className="mb-1 text-[13px] font-bold text-[#1d3a8f] hover:underline">‹ All locations</button>
          <h2 className="text-[26px] font-extrabold text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{venue.name}</h2>
        </div>
        <button type="button" onClick={() => flash("Saved.")} className="rounded-full bg-[#0f7a43] px-6 py-2.5 text-[14px] font-extrabold text-white hover:brightness-105">Save</button>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* left nav */}
        <div className="lg:w-[180px] lg:flex-none">
          <div className="flex gap-1.5 overflow-x-auto lg:flex-col">
            {TABS.map(([t, lbl]) => (
              <button key={t} type="button" onClick={() => setTab(t)}
                className={"whitespace-nowrap rounded-xl px-3.5 py-2.5 text-left text-[13.5px] font-bold transition-colors " + (tab === t ? "bg-[#eef4fd] text-[#1d3a8f]" : "text-[var(--ink-2)] hover:bg-[var(--panel)]")}
                style={tab === t ? { boxShadow: "inset 3px 0 0 #2f6bd8" } : undefined}>{lbl}</button>
            ))}
          </div>
        </div>

        {/* body */}
        <div className="min-w-0 flex-1">
          {tab === "general" && <GeneralTab venue={venue} />}
          {tab === "roles" && <RolesTab staffRoles={staffRoles} />}
          {tab === "staff" && (
            <StaffTab venue={venue} venues={venues} store={store} persist={persist} staffRoles={staffRoles}
              venueName={venueName} assignedHere={assignedHere} flash={flash} />
          )}
          {tab === "scheduling" && <SchedulingTab />}
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

// ── Roles (reads the company Staff-roles list) ──────────────────────────────
function RolesTab({ staffRoles }: { staffRoles: string[] }) {
  const portalHref = "/company/setup?tab=staffRoles";
  return (
    <Card className="p-5">
      <div className="text-[16px] font-extrabold text-[var(--ink)]">Roles at this location</div>
      <p className="mt-1 text-[12.5px] text-[var(--ink-3)]">The job roles you can roster and invite people into. This is your company-wide list — the same roles show on every location, in the staff schedule and on the invite form.</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {staffRoles.map((r) => <span key={r} className="rounded-full border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[12.5px] font-bold text-[var(--ink)]">{r}</span>)}
      </div>
      <a href={portalHref} className="mt-4 inline-block text-[12.5px] font-bold text-[#1d3a8f] hover:underline">Manage roles in Setup → Staff roles ›</a>
    </Card>
  );
}

// ── Staff (the main tab) ────────────────────────────────────────────────────
function StaffTab({ venue, venues, store, persist, staffRoles, venueName, assignedHere, flash }: {
  venue: Venue; venues: Venue[]; store: Store; persist: (s: Store) => void; staffRoles: string[];
  venueName: (id: string) => string; assignedHere: LocStaff[]; flash: (m: string) => void;
}) {
  const [view, setView] = useState<"staff" | "site">("staff");
  const [pick, setPick] = useState("");
  const [q, setQ] = useState("");
  const [nName, setNName] = useState("");
  const [nEmail, setNEmail] = useState("");
  const [nRole, setNRole] = useState("");

  const toggleSite = (staffId: string, siteId: string) => persist({ ...store, staff: store.staff.map((s) => s.id === staffId ? { ...s, sites: s.sites.includes(siteId) ? s.sites.filter((x) => x !== siteId) : [...s.sites, siteId] } : s) });
  const tickAll = () => persist({ ...store, staff: store.staff.map((s) => ({ ...s, sites: venues.map((v) => v.id) })) });
  const untickAll = () => persist({ ...store, staff: store.staff.map((s) => ({ ...s, sites: [] })) });
  const removeFromLoc = (staffId: string) => persist({ ...store, staff: store.staff.map((s) => s.id === staffId ? { ...s, sites: s.sites.filter((x) => x !== venue.id) } : s) });

  // "add an existing staff member" — anyone not yet assigned to THIS venue
  const notHere = store.staff.filter((s) => !s.sites.includes(venue.id));
  const searchMatches = q.trim() ? notHere.filter((s) => s.name.toLowerCase().includes(q.toLowerCase())) : [];
  const addToLoc = (staffId: string) => { persist({ ...store, staff: store.staff.map((s) => s.id === staffId ? { ...s, sites: [...new Set([...s.sites, venue.id])] } : s) }); setPick(""); setQ(""); flash("Added to this location."); };

  const sendInvite = () => {
    if (!nName.trim() || !nEmail.trim()) return;
    const p: Pending = { id: `p${Date.now()}`, name: nName.trim(), email: nEmail.trim(), role: nRole || staffRoles[0], at: new Date().toISOString() };
    persist({ ...store, pending: [...store.pending, p] });
    void api("/api/invites", { method: "POST", body: JSON.stringify({ role: "staff", email: p.email, staffRole: p.role, assignment: { mode: "locations", ids: [venue.id] } }) }).catch(() => {});
    setNName(""); setNEmail(""); setNRole(""); flash("Invite sent — they'll appear under Pending until they activate.");
  };
  const cancelPending = (id: string) => persist({ ...store, pending: store.pending.filter((p) => p.id !== id) });

  return (
    <div className="flex flex-col gap-4">
      {/* assign staff to sites */}
      <Card className="p-5">
        <div className="text-[17px] font-extrabold text-[var(--ink)]">Staff at this location</div>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--ink-2)]">People are onboarded to your company <b>once</b>, then assigned to the <b>sites</b> they work at. Turn a site on for someone and the schedule offers them for that site&rsquo;s shifts.</p>

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
                  <div className="min-w-0 flex-1"><div className="truncate text-[14px] font-extrabold text-[var(--ink)]">{s.name}</div><div className="text-[11.5px] text-[var(--ink-3)]">{s.role ? `${s.role} · ` : ""}from {s.home}</div></div>
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
              <div key={v.id} className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3">
                <div className="flex items-center gap-2"><span className="text-[13px]">📍</span><span className="text-[14px] font-extrabold text-[var(--ink)]">{v.name}</span><span className="ml-auto text-[11.5px] font-bold text-[var(--ink-3)]">{on.length} staff</span></div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {on.length === 0 ? <span className="text-[12px] text-[var(--ink-3)]">No one assigned yet.</span> : on.map((s) => (
                    <span key={s.id} className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[12px] font-bold text-[var(--ink)]"><span className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-extrabold text-white" style={{ background: avColour(s.id) }}>{initials(s.name)}</span>{s.name}</span>
                  ))}
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
        <Select value={pick} onChange={(e) => { if (e.target.value) addToLoc(e.target.value); else setPick(""); }} className="mt-3 w-full">
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
              <span className="font-bold text-[var(--ink)]">{p.name}</span><span className="text-[var(--ink-3)]">{p.email} · {p.role}</span>
              <span className="ml-auto rounded-full bg-[#fff4d6] px-2 py-0.5 text-[11px] font-bold text-[#a86a00]">Pending</span>
              <button type="button" onClick={() => cancelPending(p.id)} className="text-[12px] font-bold text-[#c0392b] hover:underline">Cancel</button>
            </div>
          ))}</div>
        )}
      </Card>

      {/* onboard someone new */}
      <Card className="p-5">
        <div className="text-[15px] font-extrabold text-[var(--ink)]">Onboard someone new</div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--ink-3)]">Not in the list yet? Add their name and email — we&rsquo;ll <b>email them an invite</b>. They appear under <b>Pending invites</b> above, <b>not in the schedule</b>, and stay Pending until they <b>first log in</b> and finish onboarding. Only once they&rsquo;ve <b>activated</b> do they join the assignable staff and become available to roster.</p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-[140px] flex-1"><Input value={nName} onChange={(e) => setNName(e.target.value)} placeholder="Full name" className="w-full" /></div>
          <div className="min-w-[160px] flex-1"><Input type="email" value={nEmail} onChange={(e) => setNEmail(e.target.value)} placeholder="Email address" className="w-full" /></div>
          <div className="min-w-[120px]"><Select value={nRole} onChange={(e) => setNRole(e.target.value)} className="w-full"><option value="">— Role —</option>{staffRoles.map((r) => <option key={r} value={r}>{r}</option>)}</Select></div>
          <button type="button" disabled={!nName.trim() || !nEmail.trim()} onClick={sendInvite} className="rounded-full bg-[#0f7a43] px-5 py-2.5 text-[13px] font-extrabold text-white hover:brightness-105 disabled:opacity-40">Send invite</button>
        </div>
      </Card>
    </div>
  );
}

// ── Scheduling / Timesheets / Notifications (lighter tabs) ──────────────────
function SchedulingTab() {
  return (
    <Card className="p-5">
      <div className="text-[16px] font-extrabold text-[var(--ink)]">Scheduling</div>
      <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--ink-2)]">Rotas are built in the staff schedule. Whoever&rsquo;s ticked for this site on the Staff tab is offered for its shifts, and the roles you add there come from your company Staff-roles list.</p>
      <a href="/company/schedule" className="mt-3 inline-block rounded-full bg-[#1d3a8f] px-5 py-2.5 text-[13px] font-extrabold text-white hover:brightness-105">Open the staff schedule ›</a>
      <p className="mt-3 text-[11.5px] text-[var(--ink-3)]">Per-location scheduling defaults (standard shift times, auto-publish) are coming next.</p>
    </Card>
  );
}
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
