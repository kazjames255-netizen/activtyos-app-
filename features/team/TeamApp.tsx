"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { get as apiGet, post as apiPost, api } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useSettings } from "@/lib/settings";
import { DEFAULT_ROLES } from "@/lib/settings";
import { Button, Card, Input, Select } from "@/components/ui";
import { PageHero, LIGHT_PALETTE } from "@/components/OperatorPage";
import { LocationsApp, DEMO_VENUES } from "@/features/locations/LocationsApp";

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
interface Listing { id: string; title: string }
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

export function TeamApp() {
  const { settings, save } = useSettings();
  const [tab, setTab] = useState<"team" | "locations">("team");
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

  // Invite form
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("coach");
  const jobTitles = settings.staffRoles ?? [];
  const [jobTitle, setJobTitle] = useState("");
  const [assignMode, setAssignMode] = useState<"all" | "listings" | "locations" | "none">("all");
  const [assignIds, setAssignIds] = useState<string[]>([]);

  const refresh = useCallback(() => {
    apiGet<Invite[]>("/api/invites").then(setInvites).catch((e) => setError(e instanceof Error ? e.message : "Failed to load the team"));
  }, []);

  useEffect(() => {
    setMeta(loadMeta());
    apiGet<Me>("/api/me").then(setMe).catch(() => {});
    apiGet<{ id: string; title?: string; name?: string }[]>("/api/listings?mine=1").then((rows) => setListings(rows.map((r) => ({ id: r.id, title: r.title || r.name || "Untitled listing" })))).catch(() => {});
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
  const deactivated = rows.filter((r) => r.usedBy && r.meta.status === "deactivated");
  const pending = rows.filter((r) => !r.usedBy);

  // Staff usage — prefer the server's number, else count accepted staff invites.
  const staffCount = sub?.staffUsed ?? active.filter((r) => r.role === "staff").length;
  const staffLimit = sub?.staffLimit ?? null;
  const atCap = staffLimit != null && staffCount >= staffLimit;
  const pct = staffLimit != null && staffLimit > 0 ? Math.min(100, Math.round((staffCount / staffLimit) * 100)) : 0;

  const patchMeta = (token: string, p: LocalMeta) => setMeta((m) => { const next = { ...m, [token]: { ...m[token], ...p } }; saveMeta(next); return next; });

  async function createInvite(role: "franchise" | "staff") {
    setBusy(true); setError(null); setSentNote(null); setCapNote(null);
    try {
      const to = email.trim();
      const assignment: Assignment = { mode: assignMode, ids: (assignMode === "all" || assignMode === "none") ? [] : assignIds };
      const r = await apiPost<{ token: string; sentTo: string | null }>("/api/invites", {
        role,
        ...(to ? { email: to } : {}),
        // Extra fields — stored by the backend later (see handoff); harmless now.
        ...(to || name.trim() ? { name: name.trim() || undefined } : {}),
        ...(role === "staff" ? { staffRole: roleId, jobTitle: jobTitle || undefined, assignment } : {}),
      });
      if (role === "staff") patchMeta(r.token, { name: name.trim() || undefined, staffRole: roleId, jobTitle: jobTitle || undefined, assignment, status: "active" });
      if (r.sentTo) { setSentNote(`Invite emailed to ${r.sentTo}`); setEmail(""); setName(""); }
      setAssignMode("all"); setAssignIds([]); setStep(1);
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
  const toggleAssign = (id: string) => setAssignIds((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));
  const roleName = (id?: string) => roles.find((r) => r.id === id)?.name ?? "Staff";
  const assignLabel = (a?: Assignment) =>
    !a || a.mode === "all" ? "All listings"
      : a.mode === "locations" ? `${a.ids.length} location${a.ids.length === 1 ? "" : "s"}`
        : `${a.ids.length} listing${a.ids.length === 1 ? "" : "s"}`;

  const memberRow = (r: (typeof rows)[number], tone: "active" | "deactivated") => (
    <Card key={r.token} className={"flex flex-wrap items-center gap-3 p-3 " + (tone === "deactivated" ? "opacity-60" : "")}>
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[13px] font-extrabold text-white" style={{ background: "linear-gradient(135deg,#4f8bf5,#16306e)" }}>{initials(r.sentTo || r.usedBy || "?")}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-extrabold text-[var(--ink)]">{r.sentTo || r.usedBy || "Team member"}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11.5px]">
          <span className="rounded-full px-2 py-[2px] font-extrabold" style={roleStyle(r.role === "franchise" ? "franchise" : r.meta.staffRole ?? "coach")}>{r.role === "franchise" ? "Franchise" : roleName(r.meta.staffRole)}</span>
          {r.role === "staff" && <span className="rounded-full bg-[var(--panel)] px-2 py-[2px] font-semibold text-[var(--ink-3)]">📍 {assignLabel(r.meta.assignment)}</span>}
          <span className="text-[var(--ink-3)]">· joined {r.createdAt.slice(0, 10)}</span>
        </div>
      </div>
      {tone === "active" ? (
        <button type="button" onClick={() => setStatus(r.token, "deactivated")} className="flex-none rounded-full border border-[#e6b3b3] bg-white px-3 py-1.5 text-[12px] font-bold text-[#c0392b] hover:bg-[#fdebec]">Deactivate</button>
      ) : (
        <button type="button" onClick={() => setStatus(r.token, "active")} className="flex-none rounded-full border border-[#bfe6cf] bg-white px-3 py-1.5 text-[12px] font-bold text-[#0f7a43] hover:bg-[#eafaf0]">Reactivate</button>
      )}
    </Card>
  );

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero title="Team & invites" icon="👥" lede={`${active.length} active · ${pending.length} pending — invite people, give them a role and their listings`} />

      <div className="mb-3 inline-flex rounded-xl bg-[var(--panel)] p-1">
        {([["team", "Team members"], ["locations", "Deployment"]] as const).map(([t, lbl]) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={"rounded-lg px-4 py-1.5 text-[13px] font-bold transition-colors " + (tab === t ? "bg-white text-[#1d3a8f] shadow-sm" : "text-[var(--ink-2)]")}>{lbl}</button>
        ))}
      </div>

      {tab === "locations" ? <LocationsApp embedded /> : (
      <>
      {/* Staff usage / plan meter */}
      <Card className="mb-3 overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3.5 text-white" style={{ background: atCap ? "linear-gradient(120deg,#8a4a12,#e0742c)" : "linear-gradient(120deg,#16306e,#2f6bd8)" }}>
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-white/15 text-[20px]">👥</span>
          <div className="min-w-0">
            <div className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-white/70">Staff on your plan{sub?.details?.name ? ` · ${sub.details.name}` : ""}</div>
            <div className="text-[22px] font-extrabold tabular-nums leading-tight">{staffCount}{staffLimit != null && <span className="text-white/55"> / {staffLimit}</span>}<span className="ml-1.5 text-[12.5px] font-bold text-white/70">on the team</span></div>
          </div>
          <Link href="/company/subscription" className="ml-auto rounded-full bg-white/15 px-3.5 py-1.5 text-[12px] font-extrabold text-white transition-colors hover:bg-white/25">Manage plan →</Link>
        </div>
        <div className="px-4 py-3">
          {staffLimit != null && (
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: Math.min(staffLimit, 24) }).map((_, i) => (
                <span key={i} className="h-2.5 min-w-[8px] flex-1 rounded-full transition-colors" style={{ background: i < staffCount ? (atCap ? "#e0742c" : "#2f6bd8") : "var(--panel)" }} />
              ))}
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-[var(--ink-3)]">
            {atCap ? (
              <>
                <span className="font-bold text-[#b45309]">You&rsquo;ve reached the staff included on your plan.</span>
                <span>Invite more and you move up a tier.</span>
                <Link href="/company/subscription" className="rounded-full bg-[#1d3a8f] px-3 py-1 text-[11.5px] font-extrabold text-white hover:bg-[#16306e]">Upgrade plan →</Link>
              </>
            ) : staffLimit != null ? (
              <span><b className="text-[var(--ink)]">{staffLimit - staffCount}</b> more included before your next tier — extra staff bill a little more each month.</span>
            ) : (
              <span>Extra staff bill a little more each month — see your plan.</span>
            )}
          </div>
        </div>
      </Card>

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
          const assignTxt = assignMode === "all" ? "All listings" : assignMode === "none" ? "Not rostered — role access only" : assignMode === "locations" ? (assignIds.length ? `${assignIds.length} location${assignIds.length === 1 ? "" : "s"}` : "By location — pick some") : (assignIds.length ? `${assignIds.length} listing${assignIds.length === 1 ? "" : "s"}` : "By listing — pick some");
          const pillStyle = (on: boolean) => on ? { borderColor: "#2f6bd8", background: "#eef4fd", color: "#1d3a8f" } : { borderColor: "var(--line)", color: "var(--ink-2)" };
          const chipStyle = (on: boolean) => on ? { borderColor: "#22b365", background: "#e7f7ee", color: "#0f7a43" } : { borderColor: "#bcd0f5", background: "#f5f9ff", color: "#1d3a8f" };
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
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jamie Rivers" className="w-full !py-2.5 !text-[15px]" />
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
                <div>
                  <div className="flex flex-wrap gap-2">
                    {([["all", "All listings"], ["locations", "By location"], ["listings", "By listing"], ["none", "None"]] as const).map(([m, label]) => (
                      <button key={m} type="button" onClick={() => { setAssignMode(m); setAssignIds([]); }} className="rounded-full border px-4 py-2 text-[13px] font-bold" style={pillStyle(assignMode === m)}>{label}</button>
                    ))}
                  </div>
                  {assignMode === "listings" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {listings.length === 0 && <span className="text-[12px] text-[var(--ink-3)]">No listings yet.</span>}
                      {listings.map((l) => { const on = assignIds.includes(l.id); return <button key={l.id} type="button" onClick={() => toggleAssign(l.id)} className="rounded-full border-2 px-3.5 py-2 text-[13px] font-extrabold transition-colors" style={chipStyle(on)}>{on ? "✓ " : "🎟 "}{l.title}</button>; })}
                    </div>
                  )}
                  {assignMode === "locations" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(venues.length ? venues : DEMO_VENUES).map((v) => { const on = assignIds.includes(v.id); return <button key={v.id} type="button" onClick={() => toggleAssign(v.id)} className="rounded-full border-2 px-3.5 py-2 text-[13px] font-extrabold transition-colors" style={chipStyle(on)}>{on ? "✓ " : "📍 "}{v.name}</button>; })}
                    </div>
                  )}
                  {assignMode === "none" ? (
                    <div className="mt-3 rounded-xl bg-[var(--panel)] px-3.5 py-3 text-[12px] text-[var(--ink-2)]"><b>Not rostered anywhere.</b> They won&rsquo;t appear in the schedule or on any register, but still get the page access their <b>role</b> allows (office / admin staff). Deploy them later from <b>Deployment</b>.</div>
                  ) : (
                    <p className="mt-3 text-[12px] text-[var(--ink-3)]">Where they&rsquo;re rostered — they show in the schedule for these{assignMode === "locations" ? " locations" : " listings"} and can be given shifts. <b>What they can see &amp; do is set by their access role</b>, not this.</p>
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

      {/* Team */}
      {!invites ? (
        <div className="py-6 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]">Active team · {active.length}</div>
            {active.length === 0 ? <Card className="p-5 text-center text-[12.5px] text-[var(--ink-3)]">No one has joined yet — invites appear below until they accept.</Card>
              : <div className="flex flex-col gap-2">{active.map((r) => memberRow(r, "active"))}</div>}
          </div>

          {pending.length > 0 && (
            <div>
              <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]">Pending invites · {pending.length}</div>
              <div className="flex flex-col gap-2">
                {pending.map((r) => (
                  <Card key={r.token} className="flex flex-wrap items-center gap-3 p-3">
                    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#fdf6e3] text-[15px]">✉️</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-bold text-[var(--ink)]">{r.sentTo || "Shareable link"}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11.5px]">
                        <span className="rounded-full px-2 py-[2px] font-extrabold" style={roleStyle(r.role === "franchise" ? "franchise" : r.meta.staffRole ?? "coach")}>{r.role === "franchise" ? "Franchise" : roleName(r.meta.staffRole)}</span>
                        {r.role === "staff" && <span className="rounded-full bg-[var(--panel)] px-2 py-[2px] font-semibold text-[var(--ink-3)]">📍 {assignLabel(r.meta.assignment)}</span>}
                        <span className="rounded-full bg-[#fcefd2] px-2 py-[2px] font-extrabold text-[#b45309]">Pending</span>
                      </div>
                    </div>
                    <div className="flex flex-none items-center gap-2">
                      <Button sm onClick={() => copy(r.token)}>{copied === r.token ? "Copied!" : "Copy link"}</Button>
                      <button type="button" onClick={() => deleteInvite(r.token)} title="Delete this invite — the link stops working" className="rounded-full border border-[#e6b3b3] bg-white px-3 py-1.5 text-[12px] font-bold text-[#c0392b] hover:bg-[#fdebec]">Delete</button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {deactivated.length > 0 && (
            <div>
              <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-3)]">Deactivated · {deactivated.length}</div>
              <div className="flex flex-col gap-2">{deactivated.map((r) => memberRow(r, "deactivated"))}</div>
            </div>
          )}
        </div>
      )}
      </>
      )}
    </div>
  );
}




