"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { get as apiGet, post as apiPost, api } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useSettings } from "@/lib/settings";
import { DEFAULT_ROLES } from "@/lib/settings";
import { Button, Card, Input, Select } from "@/components/ui";
import { LIGHT_PALETTE, PageHero } from "@/components/OperatorPage";
import { LocationsApp } from "@/features/locations/LocationsApp";
import { AppraisalsApp } from "@/features/appraisals/AppraisalsApp";
import { OnboardingPanel } from "@/features/team/OnboardingApp";
import { ApplicationsPanel } from "@/features/team/ApplicationsApp";
import { TourLauncher } from "@/features/common/TourLauncher";

// ── Team & invites (company / franchise) ──────────────────────────────────
// Invite people, give each a role (from Setup → Roles & permissions) and the
// listings they're assigned to, then manage the team — resend, deactivate,
// reactivate. Staff count is metered against the plan: at the included limit,
// inviting more prompts an upgrade (the server also hard-caps banded plans).
//
// The invite endpoint stores role="staff"|"franchise" today; the sub-role and
// the assignment ride along as extra fields and are mirrored locally so they
// show now — the backend persists them per docs/team-invites-handoff.md.

interface Invite { token: string; role: "franchise" | "staff"; createdAt: string; usedBy: string | null; sentTo?: string | null }
interface Me { role: string; tenantName: string | null }
interface Listing { id: string; title: string; venueId?: string | null; seasonId?: string | null }
interface Venue { id: string; name: string }
interface SubCurrent { plan: string; staffLimit?: number | null; staffUsed?: number | null; details?: { name?: string } }

type Assignment = { mode: "all" | "listings" | "locations" | "none"; ids: string[] };
type LocalMeta = { name?: string; staffRole?: string; jobTitle?: string; assignment?: Assignment; status?: "active" | "deactivated" | "deleted" };
const META_KEY = "aos.team.meta.v1";
const loadMeta = (): Record<string, LocalMeta> => { try { return JSON.parse(localStorage.getItem(META_KEY) || "{}"); } catch { return {}; } };
const saveMeta = (m: Record<string, LocalMeta>) => { try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch { /* ignore */ } };

// Role → chip colour. Falls back to grey for custom roles.
const ROLE_TONE: Record<string, { bg: string; fg: string }> = {
  owner: { bg: "#e7e9fb", fg: "#3d3aa8" },
  manager: { bg: "#e7effc", fg: "#1d3a8f" },
  lead: { bg: "#dcf1ee", fg: "#0f766e" },
  coach: { bg: "#e2f4ea", fg: "#0f7a43" },
  franchise: { bg: "#f3e8fc", fg: "#7a3aa8" },
};
const roleTone = (id: string) => ROLE_TONE[id] ?? { bg: "#eef1f6", fg: "#48566f" };
const roleStyle = (id: string): React.CSSProperties => { const t = roleTone(id); return { background: t.bg, color: t.fg }; };
const initials = (s: string) => s.split(/[\s@.]+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";

// Dashboard-style coloured KPI tiles.
const GRAD = {
  green: "linear-gradient(135deg,#0b6b3a 0%,#2fb56f 100%)",
  amber: "linear-gradient(135deg,#9a5a12 0%,#f5b81f 100%)",
  violet: "linear-gradient(135deg,#5b21b6 0%,#8b5cf6 100%)",
  teal: "linear-gradient(135deg,#0e6f8a 0%,#14b8a6 100%)",
} as const;
function Tile({ label, value, sub, grad, icon, aside }: { label: string; value: string; sub?: React.ReactNode; grad: string; icon?: string; aside?: React.ReactNode }) {
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-2xl p-4 text-white shadow-[0_12px_28px_-16px_rgba(20,30,80,.5)] sm:aspect-auto" style={{ background: grad }}>
      <div className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/10" />
      <div className="relative flex h-full flex-col">
        <div className="flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-white/70">
          {icon && <span className="grid h-5 w-5 flex-none place-items-center rounded-md bg-white/15 text-[11px]">{icon}</span>}
          <span className="truncate">{label}</span>
        </div>
        <div className="mt-1.5 text-[28px] font-extrabold leading-none tabular-nums" style={{ fontFamily: "var(--ff-display)", textShadow: "0 1px 2px rgba(0,0,0,.25)" }}>{value}</div>
        {sub && <div className="mt-1 text-[11px] font-semibold text-white/80">{sub}</div>}
        {aside && <div className="mt-auto pt-2">{aside}</div>}
      </div>
    </div>
  );
}

export function TeamApp() {
  const { settings, save } = useSettings();
  const [tab, setTab] = useState<"team" | "locations" | "onboarding" | "applications" | "appraisals">("team");
  const roles = (settings.roles?.length ? settings.roles : DEFAULT_ROLES).filter((r) => !r.owner || true); // include all
  const [me, setMe] = useState<Me | null>(null);
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [sub, setSub] = useState<SubCurrent | null>(null);
  const [meta, setMeta] = useState<Record<string, LocalMeta>>({});
  const [error, setError] = useState<string | null>(null);
  const [capNote, setCapNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [sentNote, setSentNote] = useState<string | null>(null);

  const [invFilter, setInvFilter] = useState<"all" | "pending" | "activated">("all");
  const [invQuery, setInvQuery] = useState("");
  // Invite form
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("coach");
  const jobTitles = settings.staffRoles ?? [];
  const [jobTitle, setJobTitle] = useState("");
  // Deployment flow: None, or pick location(s) → then listings within them.
  const [notRostered, setNotRostered] = useState(false);
  const [allLoc, setAllLoc] = useState(true);
  const [loc, setLoc] = useState<string[]>([]);
  const [allList, setAllList] = useState(true);
  const [list, setList] = useState<string[]>([]);
  const resetAssign = () => { setNotRostered(false); setAllLoc(true); setLoc([]); setAllList(true); setList([]); };

  const refresh = useCallback(() => {
    apiGet<Invite[]>("/api/invites").then(setInvites).catch((e) => setError(e instanceof Error ? e.message : "Failed to load the team"));
  }, []);

  useEffect(() => {
    setMeta(loadMeta());
    apiGet<Me>("/api/me").then(setMe).catch(() => {});
    apiGet<{ id: string; title?: string; name?: string; venueId?: string | null; seasonId?: string | null }[]>("/api/listings?mine=1").then((rows) => setListings(rows.map((r) => ({ id: r.id, title: r.title || r.name || "Untitled listing", venueId: r.venueId ?? null, seasonId: r.seasonId ?? null })))).catch(() => {});
    apiGet<{ venues?: Venue[] } | null>("/api/library").then((lib) => setVenues(lib?.venues ?? [])).catch(() => {});
    apiGet<{ current: SubCurrent }>("/api/subscription").then((p) => setSub(p.current)).catch(() => {});
    refresh();
  }, [refresh]);
  useRealtime(["invites"], refresh);

  const canInviteFranchise = me?.role === "company";
  const emailOk = /.+@.+\..+/.test(email.trim());

  // Active = accepted invites we haven't locally deactivated.
  const rows = useMemo(
    () => (invites ?? []).map((inv) => ({ ...inv, meta: meta[inv.token] ?? {} })).filter((r) => r.meta.status !== "deleted"),
    [invites, meta],
  );
  const active = rows.filter((r) => r.usedBy && r.meta.status !== "deactivated");
  const pending = rows.filter((r) => !r.usedBy);

  // Staff usage — prefer the server's number, else count accepted staff invites.
  const staffCount = sub?.staffUsed ?? active.filter((r) => r.role === "staff").length;
  const staffLimit = sub?.staffLimit ?? null;
  const atCap = staffLimit != null && staffCount >= staffLimit;

  const patchMeta = (token: string, p: LocalMeta) => setMeta((m) => { const next = { ...m, [token]: { ...m[token], ...p } }; saveMeta(next); return next; });

  async function createInvite(role: "franchise" | "staff") {
    setBusy(true); setError(null); setSentNote(null); setCapNote(null);
    try {
      const to = email.trim();
      const assignment: Assignment = notRostered ? { mode: "none", ids: [] }
        : (!allList && list.length) ? { mode: "listings", ids: list }
        : allLoc ? { mode: "all", ids: [] }
        : { mode: "locations", ids: loc };
      const r = await apiPost<{ token: string; sentTo: string | null }>("/api/invites", {
        role,
        ...(to ? { email: to } : {}),
        // Extra fields — stored by the backend later (see handoff); harmless now.
        ...(to || name.trim() ? { name: name.trim() || undefined } : {}),
        ...(role === "staff" ? { staffRole: roleId, jobTitle: jobTitle || undefined, assignment } : {}),
      });
      if (role === "staff") patchMeta(r.token, { name: name.trim() || undefined, staffRole: roleId, jobTitle: jobTitle || undefined, assignment, status: "active" });
      if (r.sentTo) { setSentNote(`Invite emailed to ${r.sentTo}`); setEmail(""); setName(""); }
      resetAssign(); setStep(1);
      refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create the invite";
      // The server hard-caps banded plans — surface it as an upgrade prompt.
      if (/plan|cap|limit|staff|upgrade/i.test(msg)) setCapNote(msg);
      else setError(msg);
    }
    setBusy(false);
  }

  function copy(token: string) {
    navigator.clipboard.writeText(`${window.location.origin}/signup?invite=${token}`).then(() => { setCopied(token); setTimeout(() => setCopied(null), 1500); });
  }
  const setStatus = (token: string, status: "active" | "deactivated") => {
    patchMeta(token, { status });
    // Best-effort backend call — no-op until Amir adds the route (handoff).
    void api(`/api/invites/${token}/status`, { method: "PATCH", body: JSON.stringify({ status }) }).catch(() => {});
  };
  const deleteInvite = (token: string) => {
    if (!confirm("Delete this invite? The link stops working — anyone who hasn't joined can't use it. This can't be undone.")) return;
    patchMeta(token, { status: "deleted" });
    // Best-effort backend call — revokes the token once Amir adds the route (handoff).
    void api(`/api/invites/${token}`, { method: "DELETE" }).catch(() => {});
  };
  const flipIn = (setter: React.Dispatch<React.SetStateAction<string[]>>, id: string) => setter((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));
  const roleName = (id?: string) => roles.find((r) => r.id === id)?.name ?? "Staff";
  const assignLabel = (a?: Assignment) =>
    !a || a.mode === "all" ? "All listings"
      : a.mode === "locations" ? `${a.ids.length} location${a.ids.length === 1 ? "" : "s"}`
        : `${a.ids.length} listing${a.ids.length === 1 ? "" : "s"}`;

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero icon="👥" title="Team &amp; invites" lede="Invite people, set their role and where they work — then onboard, deploy and review them." />

      <div className="mb-3 mt-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-xl bg-[var(--panel)] p-1">
          {([["team", "Team members"], ["applications", "Applications"], ["onboarding", "Onboarding"], ["locations", "Deployment"], ["appraisals", "Appraisals"]] as const).map(([t, lbl]) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={"rounded-lg px-4 py-1.5 text-[13px] font-bold transition-colors " + (tab === t ? "bg-white text-[#1d3a8f] shadow-sm" : "text-[var(--ink-2)]")}>{lbl}</button>
          ))}
        </div>
        {/* Each tab has its own guided walkthrough. */}
        <div className="ml-auto"><TourLauncher view={{ team: "staff", applications: "staff-applications", onboarding: "staff-onboarding", locations: "staff-deployment", appraisals: "staff-appraisals" }[tab]} /></div>
      </div>

      {tab === "applications" ? <ApplicationsPanel /> : tab === "onboarding" ? <OnboardingPanel /> : tab === "locations" ? <LocationsApp embedded /> : tab === "appraisals" ? <AppraisalsApp embedded /> : (
      <>
      {/* KPI tiles — dashboard style */}
      <div className="mb-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Tile label={`On your plan${sub?.details?.name ? ` · ${sub.details.name}` : ""}`} icon="👥" grad={atCap ? GRAD.amber : GRAD.violet}
          value={`${staffCount}${staffLimit != null ? ` / ${staffLimit}` : ""}`}
          sub={staffLimit != null ? (atCap ? "at your plan limit" : `${staffLimit - staffCount} more included`) : "extra bill monthly"}
          aside={<Link href="/company/subscription" className="inline-block rounded-full bg-white/20 px-3 py-1 text-[11px] font-extrabold text-white hover:bg-white/30">Manage plan →</Link>} />
        <Tile label="Active team" icon="✅" grad={GRAD.green} value={`${active.length}`} sub="activated accounts" />
        <Tile label="Pending" icon="✉️" grad={GRAD.amber} value={`${pending.length}`} sub="awaiting first login" />
        <Tile label="Locations" icon="📍" grad={GRAD.teal} value={`${venues.length}`} sub="sites they can work" aside={<button type="button" onClick={() => setTab("locations")} className="inline-block rounded-full bg-white/20 px-3 py-1 text-[11px] font-extrabold text-white hover:bg-white/30">Deployment →</button>} />
      </div>

      {atCap && <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-[#f0d9a8] bg-[#fdf6e3] px-3 py-2 text-[12.5px] text-[#7a5b06]"><span className="font-bold">You&rsquo;ve reached the staff included on your plan.</span><span>Invite more and you move up a tier.</span><Link href="/company/subscription" className="rounded-full bg-[#1d3a8f] px-3 py-1 text-[11.5px] font-extrabold text-white hover:bg-[#16306e]">Upgrade plan →</Link></div>}

      {error && <div className="mb-3 rounded-lg border border-[#f6c9cc] bg-[#fdebec] px-3 py-2 text-[12.5px] text-[#e21d27]">{error}</div>}

      {/* Invite wizard — stepped slideshow */}
      <Card className="mb-4 overflow-hidden p-0">
        {(() => {
          const STEPS = [
            { t: "Who's joining?", i: "👋", d: "Their name and the email we'll send the invite to." },
            { t: "What can they access?", i: "🔑", d: "Their permission level across the app." },
            { t: "What are they rostered as?", i: "🎽", d: "Their job title — the coloured rows on the rota." },
            { t: "Where do they work?", i: "📍", d: "Which locations or listings they're deployed to." },
            { t: "Ready to send", i: "✉️", d: "Check it over, then send their invite." },
          ];
          const s = STEPS[step - 1];
          const nm = name.trim() ? name.trim() : email.trim() ? email.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "New teammate";
          const roleNm = roles.find((r) => r.id === roleId)?.name ?? "Staff";
          const allVenues = venues;
          const locLabel = allLoc ? "All locations" : loc.length ? loc.map((id) => allVenues.find((v) => v.id === id)?.name ?? id).join(", ") : "no location";
          // listings that run at the chosen location(s)
          const scopedListings = listings.filter((l) => allLoc || (l.venueId && loc.includes(l.venueId)));
          const assignTxt = notRostered ? "Not rostered — role access only"
            : loc.length === 0 && !allLoc ? "Pick a location"
            : allList ? `${locLabel} · all listings`
            : list.length ? `${locLabel} · ${list.length} listing${list.length === 1 ? "" : "s"}` : `${locLabel} · pick listings`;
          const chipStyle = (on: boolean) => on ? { borderColor: "#22b365", background: "#e7f7ee", color: "#0f7a43" } : { borderColor: "#bcd0f5", background: "#f5f9ff", color: "#1d3a8f" };
          const seasonName = (sid?: string | null) => settings.seasons?.find((x) => x.id === sid)?.name;
          return (
          <>
            {/* big blue header + progress */}
            <div className="px-5 py-5 text-white sm:px-6" style={{ background: "linear-gradient(120deg,#0f2665,#2f6bd8)" }}>
              <div className="flex items-start gap-3.5">
                <span className="flex h-14 w-14 flex-none items-center justify-center rounded-2xl bg-white/15 text-[26px]">{s.i}</span>
                <div className="min-w-0">
                  <div className="text-[10.5px] font-extrabold uppercase tracking-[0.16em] text-white/55">Invite someone · Step {step} of {STEPS.length}</div>
                  <h3 className="text-[23px] font-extrabold leading-tight sm:text-[27px]" style={{ fontFamily: "var(--ff-display)" }}>{s.t}</h3>
                  <p className="mt-0.5 text-[12.5px] text-white/75">{s.d}</p>
                </div>
              </div>
              <div className="mt-4 flex gap-1.5">
                {STEPS.map((_, i) => (
                  <button key={i} type="button" onClick={() => { if (i + 1 <= step || emailOk) setStep(i + 1); }} className="h-1.5 flex-1 rounded-full transition-colors" style={{ background: i < step ? "#fff" : "rgba(255,255,255,.28)" }} />
                ))}
              </div>
            </div>

            {/* body */}
            <div className="min-h-[220px] px-5 py-6 sm:px-6">
              {step === 1 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]"><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#fbe6f3] text-[12px]">👤</span>Full name</span>
                    <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jamie Rivers" className="w-full !py-2.5 !text-[15px]" />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]"><span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#eaf1fe] text-[12px]">📧</span>Their email <span className="text-[#c0392b]">*</span></span>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="their@email.com" className="w-full !py-2.5 !text-[15px]" />
                    <span className="mt-1.5 block text-[11.5px] text-[var(--ink-3)]">We&rsquo;ll email a secure link to join — that&rsquo;s how they sign up.</span>
                  </label>
                </div>
              )}
              {step === 2 && (
                <div className="max-w-lg">
                  <Select value={roleId} onChange={(e) => setRoleId(e.target.value)} className="w-full !py-2.5 !text-[15px]">{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select>
                  <div className="mt-3 flex items-center gap-2 rounded-xl bg-[var(--panel)] p-3"><span className="rounded-full px-3 py-1 text-[12px] font-extrabold" style={roleStyle(roleId)}>{roleNm}</span><span className="text-[12px] text-[var(--ink-2)]">is what {nm.split(" ")[0]} will be able to see &amp; do.</span></div>
                  <p className="mt-2 text-[12px] text-[var(--ink-3)]">Roles &amp; what each can do are set in <Link href="/company/setup?tab=roles" className="font-bold text-[#1d3a8f] underline">Roles &amp; permissions</Link>.</p>
                </div>
              )}
              {step === 3 && (
                <div className="max-w-lg">
                  <div className="flex items-center gap-2">
                    <Select value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="w-full !py-2.5 !text-[15px]"><option value="">— Job title —</option>{jobTitles.map((j) => <option key={j} value={j}>{j}</option>)}</Select>
                    <button type="button" onClick={() => { const t = window.prompt("New job title")?.trim(); if (t) { void save({ settings: { ...settings, staffRoles: [...new Set([...jobTitles, t])] } }); setJobTitle(t); } }} className="whitespace-nowrap rounded-full border border-[var(--line)] px-3.5 py-2.5 text-[13px] font-bold text-[#1d3a8f] hover:bg-[var(--panel)]">＋ Add</button>
                  </div>
                  <p className="mt-2 text-[12px] text-[var(--ink-3)]">The role they&rsquo;re scheduled as (Lifeguard, Site Manager…) — the coloured rows on the rota. Not listed? Use <b>＋ Add</b> and it saves for everyone.</p>
                </div>
              )}
              {step === 4 && (
                <div className="flex flex-col gap-4">
                  {/* rostered vs none */}
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setNotRostered(false)} className="rounded-full border-2 px-4 py-2 text-[13px] font-extrabold transition-colors" style={chipStyle(!notRostered)}>{!notRostered ? "✓ " : ""}Rostered on the schedule</button>
                    <button type="button" onClick={() => setNotRostered(true)} className="rounded-full border-2 px-4 py-2 text-[13px] font-extrabold transition-colors" style={notRostered ? { borderColor: "#c06a10", background: "#fbeddb", color: "#8a4a12" } : { borderColor: "#bcd0f5", background: "#f5f9ff", color: "#1d3a8f" }}>{notRostered ? "✓ " : ""}None — office / admin</button>
                  </div>

                  {notRostered ? (
                    <div className="rounded-xl bg-[var(--panel)] px-3.5 py-3 text-[12.5px] text-[var(--ink-2)]"><b>No locations or listings.</b> They won&rsquo;t appear in the schedule or on any register — but still get the page access their <b>role</b> allows. You can deploy them later from <b>Deployment</b>.</div>
                  ) : (
                    <>
                      {/* 1 · locations */}
                      <div>
                        <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">① Location{allVenues.length === 1 ? "" : "s"} they work at</div>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => { setAllLoc(true); setLoc([]); }} className="rounded-full border-2 px-3.5 py-2 text-[13px] font-extrabold transition-colors" style={chipStyle(allLoc)}>{allLoc ? "✓ " : "🌍 "}All locations</button>
                          {allVenues.map((v) => { const on = !allLoc && loc.includes(v.id); return <button key={v.id} type="button" onClick={() => { setAllLoc(false); flipIn(setLoc, v.id); }} className="rounded-full border-2 px-3.5 py-2 text-[13px] font-extrabold transition-colors" style={chipStyle(on)}>{on ? "✓ " : "📍 "}{v.name}</button>; })}
                        </div>
                      </div>

                      {/* 2 · listings within those locations */}
                      {(allLoc || loc.length > 0) && (
                        <div>
                          <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">② Listings {allLoc ? "across all locations" : "at " + locLabel}</div>
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => { setAllList(true); setList([]); }} className="rounded-full border-2 px-3.5 py-2 text-[13px] font-extrabold transition-colors" style={chipStyle(allList)}>{allList ? "✓ " : "🎟 "}All listings here</button>
                            {scopedListings.map((l) => { const on = !allList && list.includes(l.id); const sn = seasonName(l.seasonId); return (
                              <button key={l.id} type="button" onClick={() => { setAllList(false); flipIn(setList, l.id); }} className="inline-flex items-center gap-1.5 rounded-full border-2 px-3.5 py-2 text-[13px] font-extrabold transition-colors" style={chipStyle(on)}>{on ? "✓" : "🎟"} {l.title}{sn && <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10.5px] font-bold" style={{ color: "#1d3a8f" }}>📅 {sn}</span>}</button>
                            ); })}
                          </div>
                          {scopedListings.length === 0 && <p className="mt-1 text-[12px] text-[var(--ink-3)]">No live listings {allLoc ? "yet" : "at the chosen location(s)"} — “All listings here” covers whatever runs there.</p>}
                        </div>
                      )}

                      <p className="text-[12px] text-[var(--ink-3)]">They show in the schedule for this and can be given shifts. <b>What they can see &amp; do is set by their access role</b>, not this.</p>
                    </>
                  )}
                </div>
              )}
              {step === 5 && (
                <div className="mx-auto max-w-md">
                  <div className="overflow-hidden rounded-2xl border border-[var(--line)] shadow-sm">
                    <div className="flex items-center gap-3 px-4 py-4" style={{ background: "linear-gradient(120deg,#0f2665,#2f6bd8)" }}>
                      <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-white/15 text-[16px] font-extrabold text-white">{initials(nm)}</span>
                      <div className="min-w-0"><div className="truncate text-[16px] font-extrabold text-white">{nm}</div><div className="truncate text-[12px] text-white/75">{email.trim() || "no email yet"}</div></div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--line-2,#eef2f8)] bg-white px-4 py-3">
                      <span className="rounded-full px-2.5 py-0.5 text-[11.5px] font-extrabold" style={roleStyle(roleId)}>{roleNm}</span>
                      <span className="rounded-full bg-[var(--panel)] px-2.5 py-0.5 text-[11.5px] font-bold text-[var(--ink-2)]">{jobTitle || "no job title"}</span>
                      <span className="ml-auto text-[12px] font-semibold text-[var(--ink-2)]">📍 {assignTxt}</span>
                    </div>
                    <p className="bg-white px-4 py-2.5 text-[11.5px] leading-relaxed text-[var(--ink-3)]">We&rsquo;ll email <b>{email.trim() || "them"}</b> a secure link. They appear under <b>Pending</b> until they log in &amp; finish onboarding.</p>
                  </div>
                  {capNote && <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-[#f0d9a8] bg-[#fdf6e3] px-3 py-2 text-[12.5px] text-[#7a5b06]"><span className="font-bold">{capNote}</span><Link href="/company/subscription" className="rounded-full bg-[#1d3a8f] px-3 py-1 text-[11.5px] font-extrabold text-white hover:bg-[#16306e]">Upgrade plan →</Link></div>}
                  {sentNote && <div className="mt-3 rounded-lg bg-[#eef8f1] px-3 py-2 text-[12.5px] font-bold text-[#0f7a43]">✓ {sentNote}</div>}
                </div>
              )}
            </div>

            {/* footer nav */}
            <div className="flex items-center justify-between gap-2 border-t border-[var(--line)] bg-[var(--panel)] px-5 py-3.5 sm:px-6">
              <button type="button" onClick={() => setStep((n) => Math.max(1, n - 1))} className={"rounded-full border border-[var(--line)] bg-white px-4 py-2 text-[13px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)] " + (step === 1 ? "invisible" : "")}>‹ Back</button>
              {step < 5 ? (
                <button type="button" disabled={step === 1 && !emailOk} onClick={() => setStep((n) => Math.min(5, n + 1))} className="rounded-full px-7 py-2.5 text-[14px] font-extrabold text-white shadow-sm hover:brightness-110 disabled:opacity-45" style={{ background: "linear-gradient(120deg,#0f2665,#2f6bd8)" }}>{step === 1 && !emailOk ? "Add their email to continue" : "Next ›"}</button>
              ) : (
                <div className="flex items-center gap-2">
                  {canInviteFranchise && <Button disabled={busy} onClick={() => createInvite("franchise")}>Invite a franchise</Button>}
                  <button type="button" disabled={busy || !emailOk} onClick={() => createInvite("staff")} className="rounded-full px-7 py-2.5 text-[14px] font-extrabold text-white shadow-sm hover:brightness-110 disabled:opacity-45" style={{ background: "linear-gradient(120deg,#0f7a43,#13a35c)" }}>✉️ Send invite</button>
                </div>
              )}
            </div>
          </>
          );
        })()}
      </Card>

      {/* Invites */}
      {!invites ? (
        <div className="py-6 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
      ) : (() => {
        const statusOf = (r: (typeof rows)[number]) => (!r.usedBy ? "pending" : r.meta.status === "deactivated" ? "deactivated" : "activated");
        const q = invQuery.trim().toLowerCase();
        const shownInv = rows
          .filter((r) => invFilter === "all" || statusOf(r) === invFilter)
          .filter((r) => !q || (r.meta.name ?? "").toLowerCase().includes(q) || (r.sentTo ?? "").toLowerCase().includes(q) || (r.meta.jobTitle ?? "").toLowerCase().includes(q));
        return (
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]">Invites · {rows.length}</div>
            <div className="ml-1 inline-flex rounded-lg bg-[var(--panel)] p-0.5">
              {([["all", `All ${rows.length}`], ["pending", `Pending ${pending.length}`], ["activated", `Activated ${active.length}`]] as const).map(([f, lbl]) => (
                <button key={f} type="button" onClick={() => setInvFilter(f)} className={"rounded-md px-3 py-1 text-[12px] font-bold transition-colors " + (invFilter === f ? "bg-white text-[#1d3a8f] shadow-sm" : "text-[var(--ink-3)]")}>{lbl}</button>
              ))}
            </div>
            <Input value={invQuery} onChange={(e) => setInvQuery(e.target.value)} placeholder="🔍 Search name or email" className="ml-auto w-[220px] text-[12.5px]" />
          </div>
          <p className="mb-2 text-[11.5px] text-[var(--ink-3)]"><b>Copy link</b> grabs that person&rsquo;s sign-up link so you can send it yourself (WhatsApp, Slack, text…) — they join when they open it. Activated team &amp; their sites live in <b>Deployment</b>.</p>
          {shownInv.length === 0 ? (
            <Card className="p-5 text-center text-[12.5px] text-[var(--ink-3)]">{invFilter === "activated" ? "No one has activated yet — invites show as Pending until they log in." : invFilter === "pending" ? "No pending invites — everyone's activated." : "No invites yet — send one above."}</Card>
          ) : (
            <div className="flex flex-col gap-2">
              {shownInv.map((r) => {
                const st = statusOf(r);
                const who = r.meta.name || r.sentTo || (r.usedBy ? "Team member" : "Shareable link");
                const badge = st === "pending" ? { t: "Pending", bg: "#fcefd2", fg: "#b45309" } : st === "deactivated" ? { t: "Deactivated", bg: "#eef1f6", fg: "#64748b" } : { t: "✓ Account activated", bg: "#e2f4ea", fg: "#0f7a43" };
                return (
                  <Card key={r.token} className="flex flex-wrap items-center gap-3 p-3">
                    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[13px] font-extrabold" style={{ background: st === "activated" ? "#e2f4ea" : st === "pending" ? "#fdf6e3" : "#eef1f6", color: st === "activated" ? "#0f7a43" : "var(--ink-2)" }}>{st === "activated" ? initials(who) : "✉️"}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-bold text-[var(--ink)]">{who}{r.meta.name && r.sentTo ? <span className="font-normal text-[var(--ink-3)]"> · {r.sentTo}</span> : ""}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11.5px]">
                        <span className="rounded-full px-2 py-[2px] font-extrabold" style={roleStyle(r.role === "franchise" ? "franchise" : r.meta.staffRole ?? "coach")}>{r.role === "franchise" ? "Franchise" : roleName(r.meta.staffRole)}</span>
                        {r.meta.jobTitle && <span className="rounded-full bg-[var(--panel)] px-2 py-[2px] font-bold text-[var(--ink-2)]">{r.meta.jobTitle}</span>}
                        {r.role === "staff" && <span className="rounded-full bg-[var(--panel)] px-2 py-[2px] font-semibold text-[var(--ink-3)]">📍 {assignLabel(r.meta.assignment)}</span>}
                        <span className="rounded-full px-2 py-[2px] font-extrabold" style={{ background: badge.bg, color: badge.fg }}>{badge.t}</span>
                      </div>
                    </div>
                    <div className="flex flex-none items-center gap-2">
                      {st === "pending" && <Button sm title="Copies their sign-up link — send it yourself and they join when they open it" onClick={() => copy(r.token)}>{copied === r.token ? "✓ Copied — send it to them" : "🔗 Copy invite link"}</Button>}
                      {st === "activated" && <button type="button" onClick={() => setStatus(r.token, "deactivated")} className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-[12px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)]">Deactivate</button>}
                      {st === "deactivated" && <button type="button" onClick={() => setStatus(r.token, "active")} className="rounded-full border border-[#bfe3cd] bg-[#eef8f1] px-3 py-1.5 text-[12px] font-bold text-[#0f7a43] hover:brightness-105">Reactivate</button>}
                      <button type="button" onClick={() => deleteInvite(r.token)} title="Remove this invite / person" className="rounded-full border border-[#e6b3b3] bg-white px-3 py-1.5 text-[12px] font-bold text-[#c0392b] hover:bg-[#fdebec]">Delete</button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
        );
      })()}
      </>
      )}
    </div>
  );
}







