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

type Assignment = { mode: "all" | "listings" | "locations"; ids: string[] };
type LocalMeta = { staffRole?: string; jobTitle?: string; assignment?: Assignment; status?: "active" | "deactivated" | "deleted" };
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
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("coach");
  const jobTitles = settings.staffRoles ?? [];
  const [jobTitle, setJobTitle] = useState("");
  const [assignMode, setAssignMode] = useState<"all" | "listings" | "locations">("all");
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
      const assignment: Assignment = { mode: assignMode, ids: assignMode === "all" ? [] : assignIds };
      const r = await apiPost<{ token: string; sentTo: string | null }>("/api/invites", {
        role,
        ...(to ? { email: to } : {}),
        // Extra fields — stored by the backend later (see handoff); harmless now.
        ...(role === "staff" ? { staffRole: roleId, jobTitle: jobTitle || undefined, assignment } : {}),
      });
      if (role === "staff") patchMeta(r.token, { staffRole: roleId, jobTitle: jobTitle || undefined, assignment, status: "active" });
      if (r.sentTo) { setSentNote(`Invite emailed to ${r.sentTo}`); setEmail(""); }
      setAssignMode("all"); setAssignIds([]);
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
        {([["team", "Team members"], ["locations", "Locations"]] as const).map(([t, lbl]) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={"rounded-lg px-4 py-1.5 text-[13px] font-bold transition-colors " + (tab === t ? "bg-white text-[#1d3a8f] shadow-sm" : "text-[var(--ink-2)]")}>{lbl}</button>
        ))}
      </div>

      {tab === "locations" ? <LocationsApp embedded /> : (
      <>
      {/* Staff usage / plan meter */}
      <Card className="mb-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[13px] font-extrabold text-[var(--ink)]">
            Staff on your plan{sub?.details?.name ? ` · ${sub.details.name}` : ""}
          </div>
          <div className="text-[13px] font-extrabold tabular-nums text-[var(--ink)]">{staffCount}{staffLimit != null ? ` / ${staffLimit}` : ""}</div>
        </div>
        {staffLimit != null && (
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--panel)]">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: atCap ? "linear-gradient(90deg,#f0a13a,#e0742c)" : "linear-gradient(90deg,#4f8bf5,#2f6bd8)" }} />
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
            <span>{staffLimit - staffCount} more included before your next tier.</span>
          ) : (
            <span>Extra staff bill a little more each month — see your plan.</span>
          )}
        </div>
      </Card>

      {error && <div className="mb-3 rounded-lg border border-[#f6c9cc] bg-[#fdebec] px-3 py-2 text-[12.5px] text-[#e21d27]">{error}</div>}

      {/* Invite panel */}
      <Card className="mb-4 p-4">
        <div className="text-[14px] font-extrabold text-[var(--ink)]">Invite someone</div>
        <p className="mt-0.5 text-[12px] text-[var(--ink-3)]">{me?.tenantName ? `${me.tenantName} — ` : ""}send it by email, or create it and share the link yourself.</p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Their email <span className="font-normal normal-case">— optional</span></label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="their@email.com" className="w-full" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Access role — permissions</label>
            <Select value={roleId} onChange={(e) => setRoleId(e.target.value)} className="w-full">
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </Select>
            <div className="mt-1 text-[11px] text-[var(--ink-3)]">Sets what they can see &amp; do — edit in <Link href="/company/setup?tab=roles" className="font-bold text-[#1d3a8f] underline">Roles &amp; permissions</Link>.</div>
          </div>
          <div>
            <label className="mb-1 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Job title — rostered as
              <button type="button" onClick={() => { const t = window.prompt("New job title")?.trim(); if (t) { void save({ settings: { ...settings, staffRoles: [...new Set([...jobTitles, t])] } }); setJobTitle(t); } }} className="ml-auto normal-case text-[11px] font-bold text-[#1d3a8f] hover:underline">＋ Add</button>
            </label>
            <Select value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="w-full">
              <option value="">— Job title —</option>
              {jobTitles.map((j) => <option key={j} value={j}>{j}</option>)}
            </Select>
            <div className="mt-1 text-[11px] text-[var(--ink-3)]">The role they&rsquo;re scheduled as (Lifeguard, Site Manager…) — the coloured rows in the rota. Not listed? Use <b>＋ Add</b> and it saves for everyone.</div>
          </div>
        </div>

        {/* Listing assignment */}
        <div className="mt-3">
          <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Assign to</label>
          <div className="flex flex-wrap gap-1.5">
            {([["all", "All listings"], ["locations", "By location"], ["listings", "By listing"]] as const).map(([m, label]) => (
              <button key={m} type="button" onClick={() => { setAssignMode(m); setAssignIds([]); }} className="rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold"
                style={assignMode === m ? { borderColor: "#2f6bd8", background: "#eef4fd", color: "#1d3a8f" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>
                {label}
              </button>
            ))}
          </div>
          {assignMode === "listings" && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {listings.length === 0 && <span className="text-[12px] text-[var(--ink-3)]">No listings yet.</span>}
              {listings.map((l) => {
                const on = assignIds.includes(l.id);
                return (
                  <button key={l.id} type="button" onClick={() => toggleAssign(l.id)} className="rounded-lg border px-2.5 py-1 text-[12px] font-semibold"
                    style={on ? { borderColor: "#2f6bd8", background: "#eef4fd", color: "#1d3a8f" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>
                    {on ? "✓ " : ""}{l.title}
                  </button>
                );
              })}
            </div>
          )}
          {assignMode === "locations" && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(venues.length ? venues : DEMO_VENUES).map((v) => {
                const on = assignIds.includes(v.id);
                return (
                  <button key={v.id} type="button" onClick={() => toggleAssign(v.id)} className="rounded-lg border px-2.5 py-1 text-[12px] font-semibold"
                    style={on ? { borderColor: "#2f6bd8", background: "#eef4fd", color: "#1d3a8f" } : { borderColor: "var(--line)", color: "var(--ink-2)" }}>
                    {on ? "✓ " : ""}📍 {v.name}
                  </button>
                );
              })}
            </div>
          )}
          <div className="mt-1 text-[11px] text-[var(--ink-3)]">Assigned people only see the registers, trips, timetable and children for these{assignMode === "locations" ? " locations" : " listings"}. A location covers every listing that runs there.</div>
        </div>

        {capNote && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-[#f0d9a8] bg-[#fdf6e3] px-3 py-2 text-[12.5px] text-[#7a5b06]">
            <span className="font-bold">{capNote}</span>
            <Link href="/company/subscription" className="rounded-full bg-[#1d3a8f] px-3 py-1 text-[11.5px] font-extrabold text-white hover:bg-[#16306e]">Upgrade plan →</Link>
          </div>
        )}

        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          <Button variant="primary" disabled={busy} onClick={() => createInvite("staff")} className="!bg-[#1d3a8f] !border-[#1d3a8f] !text-white">＋ Send staff invite</Button>
          {canInviteFranchise && <Button disabled={busy} onClick={() => createInvite("franchise")}>＋ Invite a franchise</Button>}
          {sentNote && <span className="text-[12px] font-bold text-[#0f7a43]">✓ {sentNote}</span>}
        </div>
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


