"use client";

// ── Head-office team & recruitment ─────────────────────────────────────────
// A deliberately simple, HEAD-OFFICE version of the staff area — recruit central
// staff (CEO / Manager / Marketing / Admin), track their onboarding, and run
// their appraisals. No per-site rostering, locations, or deployment-to-listings
// (that's the on-site operator/franchise view). Kept intentionally lighter than
// the company Team area. Shown for the HO combined scope in place of TeamApp.
import { useCallback, useEffect, useState } from "react";
import { get as apiGet, post as apiPost } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import { useSettings, HO_DEFAULT_ROLES } from "@/lib/settings";
import { Button, Card, Input, Select } from "@/components/ui";
import { OperatorPage, TabStrip } from "@/components/OperatorPage";
import { OnboardingPanel } from "@/features/team/OnboardingApp";
import { AppraisalsApp } from "@/features/appraisals/AppraisalsApp";

interface Invite { token: string; role: "franchise" | "staff"; createdAt: string; usedBy: string | null; sentTo?: string | null; franchiseId?: string | null }
interface Franchise { franchiseId: string; name: string; area: string | null }
type LocalMeta = { name?: string; staffRole?: string; status?: "active" | "deactivated" | "deleted" };
const META_KEY = "aos.team.meta.v1"; // shared with the company Team area
const loadMeta = (): Record<string, LocalMeta> => { try { return JSON.parse(localStorage.getItem(META_KEY) || "{}"); } catch { return {}; } };
const saveMeta = (m: Record<string, LocalMeta>) => { try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch { /* ignore */ } };

const initials = (s: string) => s.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
const ROLE_TONE: Record<string, { bg: string; fg: string }> = {
  director: { bg: "#eef0ff", fg: "#3730a3" }, "ops-manager": { bg: "#e6f4ff", fg: "#1d4ed8" },
  marketing: { bg: "#fdeef6", fg: "#be185d" }, admin: { bg: "#eef7ee", fg: "#166534" },
};

type Tab = "team" | "onboarding" | "appraisals";

export function HoTeamApp() {
  const { settings } = useSettings();
  const roles = settings.roles?.length ? settings.roles : HO_DEFAULT_ROLES;
  const [tab, setTab] = useState<Tab>("team");
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [meta, setMeta] = useState<Record<string, LocalMeta>>({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState<string>(() => roles.find((r) => !r.owner)?.id ?? roles[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  // Link the franchises' own staff records — off by default (head office's own
  // team first), on shows every franchise's staff grouped by franchise.
  const [showFranchise, setShowFranchise] = useState(false);
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  useEffect(() => { apiGet<Franchise[]>("/api/franchises").then(setFranchises).catch(() => {}); }, []);

  const refresh = useCallback(() => {
    apiGet<Invite[]>("/api/invites").then(setInvites).catch((e) => setError(e instanceof Error ? e.message : "Couldn’t load the team."));
  }, []);
  useEffect(() => { setMeta(loadMeta()); refresh(); }, [refresh]);
  useRealtime(["invites"], refresh);
  // Keep the picked role valid if the role list changes.
  useEffect(() => { if (roles.length && !roles.some((r) => r.id === roleId)) setRoleId(roles.find((r) => !r.owner)?.id ?? roles[0].id); }, [roles, roleId]);

  const patchMeta = (token: string, p: LocalMeta) => setMeta((m) => { const next = { ...m, [token]: { ...m[token], ...p } }; saveMeta(next); return next; });
  const roleName = (id?: string) => roles.find((r) => r.id === id)?.name ?? "Staff";

  const rows = (invites ?? []).map((inv) => ({ ...inv, meta: meta[inv.token] ?? {} })).filter((r) => r.role === "staff" && r.meta.status !== "deleted");
  const hoRows = rows.filter((r) => !r.franchiseId);          // head office's own team
  const frRows = rows.filter((r) => !!r.franchiseId);         // each franchise's own staff
  const activeTeam = hoRows.filter((r) => r.usedBy && r.meta.status !== "deactivated");
  const pending = hoRows.filter((r) => !r.usedBy);
  const frActive = frRows.filter((r) => r.usedBy && r.meta.status !== "deactivated");
  // Franchise staff grouped by franchise, for the "link franchise staff" view.
  const frGroups = franchises
    .map((f) => ({ f, members: frActive.filter((r) => r.franchiseId === f.franchiseId) }))
    .filter((g) => g.members.length > 0);

  async function invite() {
    if (!roleId) { setError("Pick a role first."); return; }
    setBusy(true); setError(null); setNote(null);
    try {
      const to = email.trim();
      const r = await apiPost<{ token: string; sentTo: string | null }>("/api/invites", {
        role: "staff",
        ...(to ? { email: to } : {}),
        ...(name.trim() ? { name: name.trim() } : {}),
        staffRole: roleId,
        assignment: { mode: "none", ids: [] }, // HO staff aren't rostered to sites
      });
      patchMeta(r.token, { name: name.trim() || undefined, staffRole: roleId, status: "active" });
      setNote(r.sentTo ? `Invite emailed to ${r.sentTo}.` : "Invite created — copy the link below to send it.");
      setName(""); setEmail("");
      refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn’t create the invite."); }
    finally { setBusy(false); }
  }
  const copy = (token: string) => navigator.clipboard.writeText(`${window.location.origin}/signup?invite=${token}`).then(() => { setCopied(token); setTimeout(() => setCopied(null), 1500); });

  const roleChip = (id?: string) => {
    const tone = ROLE_TONE[id ?? ""] ?? { bg: "#eef1f6", fg: "#48566f" };
    return <span className="rounded-full px-2.5 py-0.5 text-[11px] font-extrabold" style={{ background: tone.bg, color: tone.fg }}>{roleName(id)}</span>;
  };

  return (
    <OperatorPage title="Team & recruitment" icon="👥" lede="Recruit and manage your head-office team — invite people to a role, onboard them, and run their appraisals.">
      <TabStrip<Tab> tabs={[["team", "Team & recruitment"], ["onboarding", "Onboarding"], ["appraisals", "Appraisals"]]} value={tab} onChange={setTab} />

      {tab === "team" && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_1fr]">
          {/* Recruit — a single, simple invite card */}
          <Card className="h-fit p-4">
            <div className="text-[15px] font-extrabold text-[var(--ink)]">Recruit a team member</div>
            <div className="mb-3 mt-0.5 text-[12px] text-[var(--ink-3)]">Invite someone to head office and give them a role. Their role sets what they can see and do.</div>
            {error && <div className="mb-2 rounded-lg border border-[#f6c9cc] bg-[#fdebec] px-3 py-2 text-[12px] text-[#c02636]">{error}</div>}
            {note && <div className="mb-2 rounded-lg border border-[#bfe6cf] bg-[#f2fbf5] px-3 py-2 text-[12px] font-semibold text-[#0f7a43]">✓ {note}</div>}
            <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sam Patel" className="mb-3 w-full" />
            <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Email (optional — or copy a link)</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@headoffice.co.uk" className="mb-3 w-full" />
            <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Role</label>
            <Select value={roleId} onChange={(e) => setRoleId(e.target.value)} className="mb-3 w-full">{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select>
            <div className="mb-3 rounded-xl bg-[var(--panel)] p-3 text-[12px] text-[var(--ink-2)]">This person joins as {roleChip(roleId)} — set exactly what that means in <b>Setup → Roles &amp; permissions</b>.</div>
            <Button variant="primary" onClick={invite} disabled={busy || !roleId}>{busy ? "Sending…" : "Send invite"}</Button>
          </Card>

          {/* The head-office team */}
          <div className="flex flex-col gap-3">
            {pending.length > 0 && (
              <Card className="p-4">
                <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Invited — not joined yet ({pending.length})</div>
                <div className="flex flex-col gap-2">
                  {pending.map((r) => (
                    <div key={r.token} className="flex flex-wrap items-center gap-2.5 rounded-xl border border-[var(--line)] p-2.5">
                      <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-[var(--panel)] text-[12px] font-extrabold text-[var(--ink-2)]">{initials(r.meta.name || r.sentTo || "?")}</span>
                      <div className="min-w-0"><div className="truncate text-[13px] font-bold text-[var(--ink)]">{r.meta.name || r.sentTo || "New invite"}</div><div className="text-[11px] text-[var(--ink-3)]">{r.sentTo ? `Emailed · ${r.sentTo}` : "Link not sent yet"}</div></div>
                      <span className="ml-auto">{roleChip(r.meta.staffRole)}</span>
                      <Button sm onClick={() => copy(r.token)}>{copied === r.token ? "Copied!" : "Copy link"}</Button>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            <Card className="p-4">
              <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Head-office team ({activeTeam.length})</div>
              {activeTeam.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--line)] p-6 text-center text-[12.5px] text-[var(--ink-3)]">No one’s joined yet. Recruit your first team member on the left.</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {activeTeam.map((r) => (
                    <div key={r.token} className="flex flex-wrap items-center gap-2.5 rounded-xl border border-[var(--line)] p-2.5">
                      <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-[#eef4fd] text-[12px] font-extrabold text-[#1d3a8f]">{initials(r.meta.name || r.usedBy || "?")}</span>
                      <div className="min-w-0"><div className="truncate text-[13px] font-bold text-[var(--ink)]">{r.meta.name || r.usedBy}</div><div className="truncate text-[11px] text-[var(--ink-3)]">{r.usedBy}</div></div>
                      <span className="ml-auto">{roleChip(r.meta.staffRole)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Link the franchises' own staff — read-only oversight across the network. */}
            {franchises.length > 0 && (
              <Card className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[13px] font-extrabold text-[var(--ink)]">Franchise staff{frActive.length ? ` (${frActive.length})` : ""}</div>
                    <div className="text-[11px] text-[var(--ink-3)]">See the staff each franchise has recruited across your network.</div>
                  </div>
                  <button type="button" onClick={() => setShowFranchise((v) => !v)} className="rounded-full border px-3 py-1 text-[11.5px] font-bold transition-colors" style={showFranchise ? { borderColor: "#1d3a8f", background: "#eef4fd", color: "#1d3a8f" } : { borderColor: "var(--line)", color: "var(--ink-3)" }}>{showFranchise ? "Hide" : "Link & show"}</button>
                </div>
                {showFranchise && (
                  <div className="mt-3 flex flex-col gap-3">
                    {frGroups.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-[var(--line)] p-5 text-center text-[12px] text-[var(--ink-3)]">No franchise staff on record yet — they’ll appear here as each franchise recruits its team.</div>
                    ) : frGroups.map(({ f, members }) => (
                      <div key={f.franchiseId}>
                        <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">🏬 {f.name}{f.area ? ` · ${f.area}` : ""} ({members.length})</div>
                        <div className="flex flex-col gap-2">
                          {members.map((r) => (
                            <div key={r.token} className="flex flex-wrap items-center gap-2.5 rounded-xl border border-[var(--line)] p-2.5">
                              <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-[var(--panel)] text-[12px] font-extrabold text-[var(--ink-2)]">{initials(r.meta.name || r.usedBy || "?")}</span>
                              <div className="min-w-0"><div className="truncate text-[13px] font-bold text-[var(--ink)]">{r.meta.name || r.usedBy}</div><div className="truncate text-[11px] text-[var(--ink-3)]">{r.usedBy}</div></div>
                              <span className="ml-auto">{roleChip(r.meta.staffRole)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>
      )}

      {tab === "onboarding" && <OnboardingPanel />}
      {tab === "appraisals" && <AppraisalsApp embedded />}
    </OperatorPage>
  );
}
