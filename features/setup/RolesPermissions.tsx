"use client";

import { Fragment, useState } from "react";
import { ROLE_CAPS, DEFAULT_ROLES, type StaffRole, type CapLevel } from "@/lib/settings";
import { Button, Input } from "@/components/ui";

// ── Roles & permissions matrix (company / head-office) ─────────────────────
// Define named roles and, per area, how much access each gets: None / View /
// Edit. Phase 1 = model + editor; enforcing it (hiding nav, gating actions) and
// picking a role on each invite come next. This just captures the access model.

const LEVELS: { v: CapLevel; label: string; short: string; fg: string; bg: string }[] = [
  { v: "none", label: "None", short: "N", fg: "var(--ink-3)", bg: "var(--panel)" },
  { v: "view", label: "View", short: "V", fg: "#1d3a8f", bg: "#e7effc" },
  { v: "edit", label: "Edit", short: "E", fg: "#0f7a43", bg: "#e2f4ea" },
];

const uid = () => `role-${Math.random().toString(36).slice(2, 9)}`;

// The distinct area groups, in ROLE_CAPS order.
const GROUPS = ROLE_CAPS.reduce<string[]>((acc, c) => (acc.includes(c.group) ? acc : [...acc, c.group]), []);

function LevelPicker({ value, disabled, onChange }: { value: CapLevel; disabled?: boolean; onChange: (v: CapLevel) => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-[var(--line)]" role="group">
      {LEVELS.map((l) => {
        const on = value === l.v;
        return (
          <button
            key={l.v}
            type="button"
            disabled={disabled}
            onClick={() => onChange(l.v)}
            title={l.label}
            className="h-7 w-8 text-[11px] font-extrabold transition-colors disabled:cursor-not-allowed disabled:opacity-70"
            style={on ? { background: l.bg, color: l.fg } : { background: "transparent", color: "var(--ink-3)" }}
          >
            {l.short}
          </button>
        );
      })}
    </div>
  );
}

export function RolesPermissions({ roles, onChange }: { roles: StaffRole[]; onChange: (roles: StaffRole[]) => void }) {
  const list = roles.length ? roles : DEFAULT_ROLES;
  const [newName, setNewName] = useState("");

  const setCap = (roleId: string, cap: string, level: CapLevel) =>
    onChange(list.map((r) => (r.id === roleId ? { ...r, caps: { ...r.caps, [cap]: level } } : r)));
  const setScope = (roleId: string, scope: "all" | "assigned") =>
    onChange(list.map((r) => (r.id === roleId ? { ...r, scope } : r)));
  const rename = (roleId: string, name: string) =>
    onChange(list.map((r) => (r.id === roleId ? { ...r, name } : r)));
  const remove = (roleId: string) => onChange(list.filter((r) => r.id !== roleId));
  const addRole = () => {
    const name = newName.trim();
    if (!name) return;
    // Start a new role from "Coach / Staff" if present, else all-None.
    const base = list.find((r) => r.id === "coach")?.caps ?? Object.fromEntries(ROLE_CAPS.map((c) => [c.key, "none" as CapLevel]));
    onChange([...list, { id: uid(), name, caps: { ...base } }]);
    setNewName("");
  };
  const resetDefaults = () => onChange(DEFAULT_ROLES.map((r) => ({ ...r, caps: { ...r.caps } })));

  return (
    <div className="flex flex-col gap-3.5">
      <div className="rounded-xl border border-[#dbe6fb] bg-[#f4f8ff] px-4 py-3 text-[12.5px] leading-relaxed text-[#1d3a8f]">
        Set what each role can reach — <b>None</b> hides it, <b>View</b> is read-only, <b>Edit</b> lets them change it.
        Owner always has full access. Each role also has a <b>scope</b>: <b>All sites</b> or <b>Assigned only</b> — assigned roles
        see just the listings they&rsquo;re on (registers, trips, timetable, calendar, listings). Booking <b>cost</b> and the
        dashboard <b>money tiles</b> show only to roles with Finances access.
        <span className="block text-[#5b6b86]">Next step: pick a role when you invite each person, and these rules take effect across the app and sidebar.</span>
      </div>

      {/* The matrix — sticky first column, scrolls sideways as roles grow. */}
      <div className="overflow-x-auto rounded-2xl border border-[var(--line)]">
        <table className="w-full border-collapse text-left" style={{ minWidth: 520 + list.length * 132 }}>
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-[var(--surface)] px-4 py-3 align-bottom">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]">Area</span>
              </th>
              {list.map((r) => (
                <th key={r.id} className="min-w-[132px] border-l border-[var(--line-2,#eef2f8)] px-3 py-2.5 align-bottom">
                  <div className="flex items-center justify-between gap-1">
                    {/* Every role's name is editable — the single source, so a
                        rename shows everywhere the role appears. */}
                    <input
                      value={r.name}
                      onChange={(e) => rename(r.id, e.target.value)}
                      title="Rename this role — used everywhere it appears"
                      className="w-full min-w-0 rounded-md border border-transparent bg-transparent text-[12.5px] font-extrabold text-[var(--ink)] outline-none hover:border-[var(--line)] focus:border-[var(--brand)]"
                    />
                    {r.owner ? (
                      <span title="Full access — locked" className="flex-none text-[11px] text-[var(--ink-3)]">🔒</span>
                    ) : !r.builtin ? (
                      <button type="button" onClick={() => remove(r.id)} title="Delete role" className="flex-none text-[13px] leading-none text-[var(--ink-3)] hover:text-[#c0392b]">×</button>
                    ) : null}
                  </div>
                  {/* Scope: all sites vs assigned listings only */}
                  <div className="mt-1.5 inline-flex overflow-hidden rounded-md border border-[var(--line)]">
                    {(["all", "assigned"] as const).map((s) => {
                      const on = (r.scope ?? "all") === s;
                      return (
                        <button key={s} type="button" disabled={r.owner} onClick={() => setScope(r.id, s)}
                          title={s === "all" ? "Sees every site / listing" : "Sees only listings they're assigned to"}
                          className="px-1.5 py-[3px] text-[9.5px] font-extrabold uppercase tracking-[0.03em] transition-colors disabled:opacity-60"
                          style={on ? { background: "#eef4fd", color: "#1d3a8f" } : { background: "transparent", color: "var(--ink-3)" }}>
                          {s === "all" ? "All" : "Assigned"}
                        </button>
                      );
                    })}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GROUPS.map((group) => (
              <Fragment key={group}>
                <tr>
                  <td colSpan={1 + list.length} className="sticky left-0 bg-[var(--panel)] px-4 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]">
                    {group}
                  </td>
                </tr>
                {ROLE_CAPS.filter((c) => c.group === group).map((cap) => (
                  <tr key={cap.key} className="border-t border-[var(--line-2,#eef2f8)]">
                    <td className="sticky left-0 z-10 bg-[var(--surface)] px-4 py-2">
                      <div className="text-[12.5px] font-semibold text-[var(--ink)]">
                        {cap.sensitive && <span title="Sensitive data" className="mr-1 text-[10px]">🔒</span>}
                        {cap.label}
                        {cap.scoped && <span title="Honours the role's Assigned-only scope" className="ml-1 text-[10px] text-[var(--ink-3)]">◎</span>}
                      </div>
                      {cap.note && <div className="text-[10.5px] leading-tight text-[var(--ink-3)]">{cap.note}</div>}
                    </td>
                    {list.map((r) => (
                      <td key={r.id} className="border-l border-[var(--line-2,#eef2f8)] px-3 py-2 text-center">
                        <LevelPicker
                          value={r.owner ? "edit" : (r.caps[cap.key] ?? "none")}
                          disabled={r.owner}
                          onChange={(v) => setCap(r.id, cap.key, v)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add / reset */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addRole(); }}
          placeholder="New role name — e.g. Senior Coach"
          className="w-[220px]"
        />
        <Button variant="primary" onClick={addRole} disabled={!newName.trim()}>＋ Add role</Button>
        <button type="button" onClick={resetDefaults} className="ml-auto text-[12px] font-semibold text-[var(--ink-3)] underline hover:text-[var(--ink)]">
          Reset to defaults
        </button>
      </div>
    </div>
  );
}
