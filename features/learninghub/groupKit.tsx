"use client";

import { useEffect } from "react";
import { FOCUS, tint } from "./kit";
import { useHubView, type ViewSection } from "./hubIntent";
import { Ico } from "./teachIcons";
import { groupColour, groupMemberIds, type HubGroup, type Student } from "./types";

// Shared bits for student groups (contract §7): the coloured chip and the
// "Groups" quick-pick row used above the student picker in the homework and
// lesson forms. Groups are OPTIONAL — with none, nothing here renders.

export function GroupDot({ colour, size = 10 }: { colour: string; size?: number }) {
  return <span aria-hidden className="inline-block flex-none rounded-full" style={{ width: size, height: size, background: groupColour(colour) }} />;
}

/** A read-only coloured chip: a student card's group, an assignment's audience. */
export function GroupChip({ group, className = "" }: { group: Pick<HubGroup, "name" | "colour">; className?: string }) {
  const c = groupColour(group.colour);
  return (
    <span data-group-chip className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-[11px] font-extrabold ${className}`} style={{ background: tint(c, 14), borderColor: tint(c, 40), color: "var(--ink)" }}>
      <GroupDot colour={group.colour} size={8} /><span className="truncate">{group.name}</span>
    </span>
  );
}

/** Tick a group and its members are added to the recipients; both groups and
 *  individual students work together. Untick removes only the members no other
 *  selected group still covers. */
export function GroupQuickPick({ groups, roster, childIds, groupIds, onChange, idPrefix = "hub-group" }: {
  groups: HubGroup[]; roster: Student[]; childIds: string[]; groupIds: string[]; onChange: (next: { childIds: string[]; groupIds: string[] }) => void; idPrefix?: string;
}) {
  if (!groups.length) return null;
  const onRoster = new Set(roster.map((s) => s.childId));
  const members = (g: HubGroup) => groupMemberIds(g).filter((id) => onRoster.has(id));
  const toggle = (g: HubGroup) => {
    if (groupIds.includes(g.id)) {
      const rest = groups.filter((x) => x.id !== g.id && groupIds.includes(x.id));
      const still = new Set(rest.flatMap(members));
      const gone = new Set(members(g).filter((id) => !still.has(id)));
      onChange({ groupIds: groupIds.filter((x) => x !== g.id), childIds: childIds.filter((id) => !gone.has(id)) });
    } else {
      onChange({ groupIds: [...groupIds, g.id], childIds: [...new Set([...childIds, ...members(g)])] });
    }
  };
  return (
    <div data-group-quickpick>
      <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-extrabold text-[var(--ink)]"><Ico name="users" size={14} />Groups <span className="font-semibold text-[var(--ink-3)]">— tick a group to add everyone in it</span></div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Student groups">
        {groups.map((g) => {
          const on = groupIds.includes(g.id);
          const c = groupColour(g.colour);
          const n = members(g).length;
          return (
            <button key={g.id} type="button" id={`${idPrefix}-${g.id}`} aria-pressed={on} onClick={() => toggle(g)} data-group-pick={g.name}
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border px-3.5 text-[12.5px] font-extrabold transition-colors ${FOCUS}`}
              style={on ? { background: tint(c, 20), borderColor: c, color: "var(--ink)" } : { background: "var(--surface)", borderColor: "var(--line)", color: "var(--ink-2)" }}>
              <GroupDot colour={g.colour} />{g.name}
              <span className="rounded-full px-1.5 py-px text-[11px] font-extrabold tabular-nums" style={{ background: on ? "color-mix(in srgb, var(--surface) 70%, transparent)" : "var(--panel)" }}>{n}</span>
              {on && <Ico name="check" size={13} strokeWidth={3} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** After a manual change to the recipients, drop any selected group whose members are no longer ALL
 *  ticked — otherwise the server (which expands a group to its members) would quietly re-add them. */
export function pruneGroups(groups: HubGroup[], roster: Student[], childIds: string[], groupIds: string[]): string[] {
  const onRoster = new Set(roster.map((s) => s.childId));
  const have = new Set(childIds);
  return groupIds.filter((id) => {
    const g = groups.find((x) => x.id === id);
    return !g || groupMemberIds(g).filter((m) => onRoster.has(m)).every((m) => have.has(m));
  });
}

/** "Sending to 6 students" — live count of the resulting recipients. */
export function RecipientSummary({ count, verb = "Sending to" }: { count: number; verb?: string }) {
  return (
    <p data-recipient-summary role="status" aria-live="polite" className="mt-2 flex items-center gap-1.5 text-[12.5px] font-extrabold" style={{ color: count ? "var(--brand-strong)" : "var(--ink-3)" }}>
      <Ico name="users" size={14} />{count ? `${verb} ${count} student${count === 1 ? "" : "s"}` : "No students chosen yet"}
    </p>
  );
}

/** The group a tab is currently filtered to (set by a group card's status tile), resolved against the live
 *  groups list. A group that vanished (deleted elsewhere) drops the filter instead of filtering to nothing. */
export function useGroupView(section: ViewSection, groups: HubGroup[]): { group: HubGroup | null; clear: () => void } {
  const [id, clear] = useHubView(section);
  const group = id ? groups.find((g) => g.id === id) ?? null : null;
  const gone = !!id && !group;
  useEffect(() => { if (gone) clear(); }, [gone, clear]);
  return { group, clear };
}

/** "Showing: Buddies · 3 students  ✕" — the dismissible chip every group-filtered tab wears. */
export function GroupViewChip({ group, what, onClear }: { group: HubGroup; what?: string; onClear: () => void }) {
  const c = groupColour(group.colour);
  const n = groupMemberIds(group).length;
  return (
    <div data-group-view-chip={group.name} role="status" className="min-w-0 max-w-full">
      <span className="inline-flex min-h-[44px] max-w-full items-center gap-1 rounded-full border py-0.5 pl-3.5 pr-1 text-[12.5px] font-semibold leading-snug text-[var(--ink-2)]" style={{ background: tint(c, 12), borderColor: tint(c, 40) }}>
        <span className="min-w-0 py-1">
          Showing: <GroupDot colour={group.colour} size={9} /> <span className="break-words font-extrabold text-[var(--ink)]">{group.name}</span> · {n} student{n === 1 ? "" : "s"}{what ? <span className="hidden sm:inline"> · {what}</span> : null}
        </span>
        <button type="button" onClick={onClear} aria-label={`Stop filtering to ${group.name}`} data-clear-group-view
          className={`grid h-10 w-10 flex-none place-items-center rounded-full text-[var(--ink-2)] hover:bg-[var(--surface)] hover:text-[var(--ink)] ${FOCUS}`}><Ico name="close" size={14} strokeWidth={2.4} /></button>
      </span>
    </div>
  );
}
