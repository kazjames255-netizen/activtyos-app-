"use client";

import { Fragment, useState } from "react";
import { ROLE_CAPS, DEFAULT_ROLES, type StaffRole, type CapLevel } from "@/lib/settings";
import { Button, Input } from "@/components/ui";
import { useT } from "@/lib/i18n/provider";

const levelKey = (v: CapLevel) => (v === "none" ? "setup.levelNone" : v === "view" ? "setup.levelView" : "setup.levelEdit");

// ── Roles & permissions matrix (company / head-office) ─────────────────────
// Define named roles and, per area, how much access each gets: None / View /
// Edit, plus a per-role scope (all sites vs assigned listings only). Phase 1 =
// model + editor; enforcing it and picking a role on each invite come next.

const LEVELS: { v: CapLevel; label: string; fg: string; bg: string; ring: string }[] = [
  { v: "none", label: "None", fg: "var(--ink-3)", bg: "var(--surface)", ring: "var(--line)" },
  { v: "view", label: "View", fg: "#1d3a8f", bg: "#eaf1fd", ring: "#bcd3f5" },
  { v: "edit", label: "Edit", fg: "#0f7a43", bg: "#e4f5eb", ring: "#a9dcc0" },
];

const GROUP_ICON: Record<string, string> = {
  "Overview": "📊", "Sell & take bookings": "🎟", "Run the day": "📆", "Safeguarding": "🛡",
  "Team & learning": "👥", "Money": "💷", "Growth": "📣", "Communication": "✉️", "Admin": "⚙️",
};

const uid = () => `role-${Math.random().toString(36).slice(2, 9)}`;
const GROUPS = ROLE_CAPS.reduce<string[]>((acc, c) => (acc.includes(c.group) ? acc : [...acc, c.group]), []);

function LevelPicker({ value, disabled, onChange }: { value: CapLevel; disabled?: boolean; onChange: (v: CapLevel) => void }) {
  const t = useT();
  return (
    <div className="inline-flex items-center gap-0.5 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-[3px]">
      {LEVELS.map((l) => {
        const on = value === l.v;
        return (
          <button
            key={l.v}
            type="button"
            disabled={disabled}
            onClick={() => onChange(l.v)}
            aria-pressed={on}
            className="rounded-lg px-2.5 py-1 text-[11.5px] font-extrabold transition-all disabled:cursor-not-allowed disabled:opacity-60"
            style={on
              ? { background: l.bg, color: l.fg, boxShadow: `inset 0 0 0 1px ${l.ring}, 0 1px 2px rgba(20,40,90,.08)` }
              : { color: "var(--ink-3)" }}
          >
            {t(levelKey(l.v))}
          </button>
        );
      })}
    </div>
  );
}

export function RolesPermissions({ roles, onChange }: { roles: StaffRole[]; onChange: (roles: StaffRole[]) => void }) {
  const t = useT();
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
    const base = list.find((r) => r.id === "coach")?.caps ?? Object.fromEntries(ROLE_CAPS.map((c) => [c.key, "none" as CapLevel]));
    onChange([...list, { id: uid(), name, scope: "assigned", caps: { ...base } }]);
    setNewName("");
  };
  const resetDefaults = () => onChange(DEFAULT_ROLES.map((r) => ({ ...r, caps: { ...r.caps } })));

  return (
    <div className="flex flex-col gap-3.5">
      {/* Intro + legend */}
      <div className="rounded-2xl border border-[#dbe6fb] bg-gradient-to-b from-[#f6faff] to-[#eef4fd] px-4 py-3.5">
        <div className="text-[12.5px] leading-relaxed text-[#1d3a8f]">
          Set what each role can reach, then give each person a role when you invite them.
          Each role also has a <b>scope</b> — <b>All sites</b> or <b>Assigned only</b> (they see just the listings they&rsquo;re on).
          Booking <b>cost</b> and dashboard <b>money tiles</b> show only to roles with Finances access.
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {LEVELS.map((l) => (
            <span key={l.v} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold" style={{ background: l.bg, color: l.fg, boxShadow: `inset 0 0 0 1px ${l.ring}` }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: l.fg }} />
              {t(levelKey(l.v))}
              <span className="font-semibold opacity-70">{l.v === "none" ? t("setup.legendHidden") : l.v === "view" ? t("setup.legendReadOnly") : t("setup.legendCanChange")}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Matrix */}
      <div className="overflow-x-auto rounded-2xl border border-[var(--line)] shadow-[0_12px_30px_-22px_rgba(20,35,90,.5)]">
        <table className="w-full border-collapse text-left" style={{ minWidth: 300 + list.length * 176 }}>
          <thead>
            <tr>
              <th className="sticky left-0 z-20 min-w-[240px] border-b border-[var(--line)] bg-[var(--surface)] px-4 py-3 align-bottom shadow-[6px_0_10px_-8px_rgba(20,35,90,.25)]">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.09em] text-[var(--ink-3)]">{t("setup.areaOfApp")}</span>
              </th>
              {list.map((r) => (
                <th key={r.id} className="min-w-[176px] border-b border-l border-[var(--line)] bg-gradient-to-b from-[var(--panel)] to-[var(--surface)] px-3 py-2.5 align-bottom">
                  <div className="flex items-center justify-between gap-1">
                    <input
                      value={r.name}
                      onChange={(e) => rename(r.id, e.target.value)}
                      title={t("setup.renameRoleTitle")}
                      className="w-full min-w-0 rounded-md border border-transparent bg-transparent text-[13.5px] font-extrabold text-[var(--ink)] outline-none hover:border-[var(--line)] focus:border-[var(--brand)]"
                    />
                    {r.owner ? (
                      <span title={t("setup.fullAccessLocked")} className="flex-none text-[11px] text-[var(--ink-3)]">🔒</span>
                    ) : !r.builtin ? (
                      <button type="button" onClick={() => remove(r.id)} title={t("setup.deleteRole")} className="flex-none rounded px-1 text-[13px] leading-none text-[var(--ink-3)] hover:bg-[#fdebec] hover:text-[#c0392b]">×</button>
                    ) : null}
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="text-[9.5px] font-bold uppercase tracking-[0.05em] text-[var(--ink-3)]">{t("setup.sees")}</span>
                    <div className="inline-flex overflow-hidden rounded-md border border-[var(--line)]">
                      {(["all", "assigned"] as const).map((s) => {
                        const on = (r.scope ?? "all") === s;
                        return (
                          <button key={s} type="button" disabled={r.owner} onClick={() => setScope(r.id, s)}
                            title={s === "all" ? t("setup.seesEverySite") : t("setup.seesAssignedOnly")}
                            className="px-2 py-[3px] text-[9.5px] font-extrabold uppercase tracking-[0.03em] transition-colors disabled:opacity-60"
                            style={on ? { background: "#eef4fd", color: "#1d3a8f" } : { background: "transparent", color: "var(--ink-3)" }}>
                            {s === "all" ? t("setup.allSites") : t("setup.assigned")}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mt-1 text-[9.5px] font-semibold uppercase tracking-[0.05em] text-[var(--ink-3)]">{r.builtin ? t("setup.builtIn") : t("setup.custom")}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GROUPS.map((group) => (
              <Fragment key={group}>
                <tr>
                  <td colSpan={1 + list.length} className="sticky left-0 border-t border-[var(--line)] bg-gradient-to-r from-[#eef3fb] to-transparent px-4 py-1.5">
                    <span className="text-[10.5px] font-extrabold uppercase tracking-[0.09em] text-[var(--ink-2)]">
                      <span className="mr-1.5">{GROUP_ICON[group] ?? "•"}</span>{group}
                    </span>
                  </td>
                </tr>
                {ROLE_CAPS.filter((c) => c.group === group).map((cap) => (
                  <tr key={cap.key} className="group border-t border-[var(--line-2,#eef2f8)] transition-colors hover:bg-[color-mix(in_srgb,var(--brand)_4%,transparent)]">
                    <td className="sticky left-0 z-10 min-w-[240px] bg-[var(--surface)] px-4 py-2.5 shadow-[6px_0_10px_-8px_rgba(20,35,90,.18)] group-hover:bg-[color-mix(in_srgb,var(--brand)_4%,var(--surface))]">
                      <div className="text-[13px] font-semibold text-[var(--ink)]">
                        {cap.sensitive && <span title={t("setup.sensitiveData")} className="mr-1 text-[10.5px]">🔒</span>}
                        {cap.label}
                        {cap.scoped && <span title={t("setup.honoursScope")} className="ml-1.5 text-[10px] text-[#2f6bd8]">◎</span>}
                      </div>
                      {cap.note && <div className="mt-0.5 text-[10.5px] leading-tight text-[var(--ink-3)]">{cap.note}</div>}
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
          placeholder={t("setup.newRolePlaceholder")}
          className="w-[240px]"
        />
        <Button variant="primary" onClick={addRole} disabled={!newName.trim()}>＋ {t("setup.addRole")}</Button>
        <button type="button" onClick={resetDefaults} className="ml-auto text-[12px] font-semibold text-[var(--ink-3)] underline hover:text-[var(--ink)]">
          {t("setup.resetToDefaults")}
        </button>
      </div>
    </div>
  );
}
