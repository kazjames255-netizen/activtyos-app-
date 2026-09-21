"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Input } from "@/components/ui";
import { del, post, put } from "@/lib/api";
import { FOCUS, Icon, Modal, RowMenu, Skeleton, tint } from "./kit";
import { Stack } from "./home/homeKit";
import { GroupDot } from "./groupKit";
import { groupStatus, shortWhen, type GroupStatus } from "./groupStatus";
import { setHubIntent, setHubView, type HubIntent, type ViewSection } from "./hubIntent";
import type { PanelMeta } from "./panelTypes";
import type { RawRows } from "./useRosterInsights";
import { Ico } from "./teachIcons";
import { StudentPicker } from "./teachKit";
import { GROUP_COLOURS, errMsg, groupColour, groupMemberIds, type HubGroup, type Student } from "./types";

// Student groups (contract §7) — optional, tutor-made, students can be in several.
// A group exists to make three things one click: set homework, set a quiz,
// schedule a live lesson for everyone in it. Nothing anywhere requires a group.
//
// Each card carries three STATUS tiles (Homework / Quiz / Lesson). A tile says what already exists for THIS
// group and links to that area filtered to the group (a `view` intent, see hubIntent.ts); when nothing exists
// yet its main click opens the create form preselected, and a small "+" always creates new.

type Tone = "muted" | "neutral" | "attention" | "overdue" | "live";
const TILES: { kind: HubIntent["kind"]; section: ViewSection; tab: PanelMeta["key"]; viewTab: PanelMeta["key"]; label: string; full: string; icon: "homework" | "quiz" | "video" }[] = [
  { kind: "homework", section: "homework", tab: "homework", viewTab: "homework", label: "Homework", full: "Set new homework", icon: "homework" },
  { kind: "quiz", section: "quiz", tab: "homework", viewTab: "quizzes", label: "Quiz", full: "Set a new quiz", icon: "quiz" },
  { kind: "lesson", section: "lesson", tab: "live", viewTab: "live", label: "Lesson", full: "Schedule a new video lesson", icon: "video" },
];
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** What one tile says, how it reads to a screen reader, and whether it has anything to show yet. */
function tileInfo(kind: HubIntent["kind"], st: GroupStatus, now: number, name: string): { text: string | null; tone: Tone; exists: boolean; chip?: string; aria: string } {
  if (kind === "homework") {
    const h = st.homework;
    if (!h) return { text: null, tone: "muted", exists: false, aria: `Set homework for ${name}` };
    if (h.set === 0) return { text: "None set", tone: "muted", exists: false, aria: `No homework set for ${name} yet — set some` };
    const text = h.open === null ? `${h.set} set` : h.open > 0 ? `${h.open} open${h.toMark ? ` · ${h.toMark} to mark` : ""}` : h.marked ? `All marked · ${h.marked}` : `${h.set} set`;
    const tone: Tone = h.overdue ? "overdue" : h.toMark ? "attention" : h.open ? "neutral" : "muted";
    return { text, tone, exists: true, chip: h.overdue ? `${h.overdue} overdue` : undefined, aria: h.open ? `View ${h.open} open homework for ${name}${h.overdue ? `, ${h.overdue} overdue` : ""}` : `View homework for ${name}` };
  }
  if (kind === "quiz") {
    const q = st.quiz;
    if (!q) return { text: null, tone: "muted", exists: false, aria: `Set a quiz for ${name}` };
    if (q.set === 0) return { text: "No quiz set", tone: "muted", exists: false, aria: `No quiz set for ${name} yet — set one` };
    const tail = q.avg !== null ? ` · avg ${q.avg}%` : q.toMark ? ` · ${q.toMark} to mark` : " · no results yet";
    return { text: `${plural(q.set, "quiz")} set${tail}`, tone: q.toMark ? "attention" : "neutral", exists: true, aria: `View results for ${plural(q.set, "quiz")} set for ${name}` };
  }
  const l = st.lesson;
  if (!l) return { text: null, tone: "muted", exists: false, aria: `Schedule a video lesson for ${name}` };
  if (l.kind === "live") return { text: "Live now · Join", tone: "live", exists: true, aria: `${name} has a lesson live now — open it` };
  if (l.kind === "next") return { text: `Next: ${shortWhen(l.at, now)}`, tone: "neutral", exists: true, aria: `View live lessons for ${name}, next ${shortWhen(l.at, now)}` };
  if (l.kind === "past") return { text: "Nothing upcoming", tone: "muted", exists: true, aria: `View past live lessons for ${name}` };
  return { text: "None scheduled", tone: "muted", exists: false, aria: `No live lesson scheduled for ${name} yet — schedule one` };
}

const TONE_STYLE: Record<Tone, { border: string; ink: string; chipBg: string }> = {
  muted: { border: "var(--line)", ink: "var(--ink-3)", chipBg: "var(--panel)" },
  neutral: { border: "var(--line)", ink: "var(--ink-2)", chipBg: "var(--panel)" },
  attention: { border: "var(--amber-line)", ink: "color-mix(in srgb, var(--gold) 40%, var(--ink))", chipBg: "var(--amber-soft)" },
  overdue: { border: "var(--red-line)", ink: "var(--ink-2)", chipBg: "var(--red-soft)" },
  live: { border: "var(--green-line)", ink: "color-mix(in srgb, var(--green) 70%, var(--ink))", chipBg: "var(--green-soft)" },
};

function StatusTile({ tile, group, info, loading, disabled, colour, onMain, onCreate }: {
  tile: (typeof TILES)[number]; group: HubGroup; info: ReturnType<typeof tileInfo>; loading: boolean; disabled: boolean; colour: string; onMain: () => void; onCreate: () => void;
}) {
  const t = TONE_STYLE[info.tone];
  return (
    <div className="flex items-stretch gap-1.5" data-group-tile={tile.kind} data-tone={info.tone} data-exists={info.exists ? "1" : "0"}>
      <button type="button" disabled={disabled || loading} aria-busy={loading || undefined} onClick={onMain} data-group-action={tile.kind} aria-label={info.aria}
        title={disabled ? "Add students to this group first" : info.aria}
        className={`flex min-h-[48px] min-w-0 flex-1 items-center gap-2.5 rounded-xl border px-2.5 text-left transition hover:-translate-y-px disabled:opacity-45 disabled:hover:translate-y-0 motion-reduce:transition-none ${FOCUS}`}
        style={{ background: info.tone === "live" ? t.chipBg : tint(colour, 6), borderColor: info.tone === "muted" || info.tone === "neutral" ? tint(colour, 26) : t.border }}>
        <span className="relative grid h-8 w-8 flex-none place-items-center rounded-lg" style={{ background: tint(colour, 16), color: "var(--ink)" }}>
          <Ico name={tile.icon} size={16} />
          {info.tone === "live" && <span aria-hidden className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--green)] ring-2 ring-[var(--surface)] motion-reduce:animate-none" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[12.5px] font-extrabold leading-tight text-[var(--ink)]">{tile.label}
            {info.chip && <span className="rounded-full px-1.5 py-px text-[11px] font-extrabold" style={{ background: "var(--red-soft)", color: "var(--red)" }}>{info.chip}</span>}
          </span>
          {loading ? <Skeleton className="mt-1 h-3 w-24 max-w-full" />
            : info.text ? <span className="block truncate text-[11.5px] font-bold leading-tight" style={{ color: t.ink }} data-tile-status>{info.text}</span> : null}
        </span>
        {info.exists && <Ico name="chevronRight" size={15} className="flex-none text-[var(--ink-3)]" />}
      </button>
      <button type="button" disabled={disabled} onClick={onCreate} data-group-create={tile.kind} aria-label={`${tile.full} for ${group.name}`} title={disabled ? "Add students to this group first" : `${tile.full} for ${group.name}`}
        className={`grid h-12 w-11 flex-none place-items-center rounded-xl border text-[var(--ink-2)] transition hover:text-[var(--ink)] disabled:opacity-45 motion-reduce:transition-none ${FOCUS}`}
        style={{ background: "var(--surface)", borderColor: tint(colour, 30) }}>
        <Icon name="plus" size={16} strokeWidth={2.4} />
      </button>
    </div>
  );
}

/** Create / rename / recolour / change members / delete — one dialog. */
function GroupDialog({ group, roster, qs, onClose, onSaved, onError }: {
  group: HubGroup | "new" | null; roster: Student[]; qs: string; onClose: () => void; onSaved: () => void; onError: (m: string) => void;
}) {
  const editing = group && group !== "new" ? group : null;
  const [name, setName] = useState("");
  const [colour, setColour] = useState("blue");
  const [ids, setIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const open = !!group;
  useEffect(() => {
    if (!group) return;
    setName(editing?.name ?? ""); setColour(editing?.colour || "blue"); setIds(editing ? groupMemberIds(editing) : []); setAsking(false); setErr(null);
  }, [group, editing]);

  const save = async () => {
    const n = name.trim();
    if (!n) { setErr("Give the group a name."); return; }
    setBusy(true); setErr(null);
    try {
      const body = { name: n, colour, childIds: ids };
      if (editing) await put(`/api/learning-hub/groups/${editing.id}${qs}`, body);
      else await post(`/api/learning-hub/groups${qs}`, body);
      onSaved(); onClose();
    } catch (e) { setErr(errMsg(e, "Couldn't save the group")); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!editing) return;
    setBusy(true);
    try { await del(`/api/learning-hub/groups/${editing.id}${qs}`); onSaved(); onClose(); }
    catch (e) { onError(errMsg(e, "Couldn't delete the group")); setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} wide id="hub-group-dialog" title={editing ? `Edit ${editing.name}` : "New group"}
      footer={
        <>
          {editing && (asking ? (
            <span className="mr-auto flex items-center gap-1.5">
              <button type="button" disabled={busy} onClick={remove} className={`min-h-[44px] rounded-full px-4 text-[12.5px] font-extrabold text-white ${FOCUS}`} style={{ background: "var(--red)" }}>Delete group</button>
              <button type="button" onClick={() => setAsking(false)} className={`min-h-[44px] rounded-full px-3 text-[12.5px] font-bold text-[var(--ink-2)] ${FOCUS}`}>Keep it</button>
            </span>
          ) : (
            <button type="button" onClick={() => setAsking(true)} className={`mr-auto inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 text-[12.5px] font-bold text-[var(--red)] hover:bg-[var(--red-soft)] ${FOCUS}`}><Icon name="trash" size={15} />Delete group</button>
          ))}
          <Button onClick={onClose} className="!h-[44px]">Cancel</Button>
          <Button variant="primary" disabled={busy || !name.trim()} onClick={save} className="!h-[44px]" data-save-group>{busy ? "Saving…" : editing ? "Save group" : "Create group"}</Button>
        </>
      }>
      <div className="grid gap-5">
        {err && <p role="alert" className="rounded-xl border px-3 py-2 text-[12.5px] font-bold" style={{ background: "var(--red-soft)", borderColor: "var(--red-line)", color: "var(--red)" }}>{err}</p>}
        <div>
          <label htmlFor="hub-group-name" className="mb-1 block text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-2)]">Group name</label>
          <Input id="hub-group-name" data-autofocus value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. Year 5 Maths, Thursday club" className="!min-h-[46px] w-full" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void save(); } }} />
        </div>
        <div>
          <div id="hub-group-colour-label" className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-2)]">Colour</div>
          <div role="radiogroup" aria-labelledby="hub-group-colour-label" className="flex flex-wrap gap-2">
            {GROUP_COLOURS.map((c) => {
              const on = colour === c.id;
              return (
                <button key={c.id} type="button" role="radio" aria-checked={on} aria-label={c.label} onClick={() => setColour(c.id)} title={c.label}
                  className={`grid h-11 w-11 place-items-center rounded-full border-2 transition ${FOCUS}`} style={{ borderColor: on ? c.v : "transparent", background: on ? tint(c.v, 16) : "var(--surface)", boxShadow: on ? undefined : "inset 0 0 0 1px var(--line)" }}>
                  <span className="grid h-6 w-6 place-items-center rounded-full text-white" style={{ background: c.v }}>{on && <Icon name="check" size={13} strokeWidth={3} />}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-2)]">Students in this group</span>
            <span className="text-[12px] font-extrabold tabular-nums text-[var(--brand-strong)]" aria-live="polite">{ids.length} selected</span>
          </div>
          <StudentPicker students={roster} value={ids} onChange={setIds} idPrefix="hub-group-member" />
          <p className="mt-2 text-[11.5px] text-[var(--ink-3)]">A student can be in several groups. Groups are just shortcuts — you can always pick students one by one.</p>
        </div>
      </div>
    </Modal>
  );
}

export function GroupsSection({ groups, students, qs, filterId, onFilter, onChanged, onError, goTo, raw, loaded = false }: {
  groups: HubGroup[]; students: Student[]; qs: string; filterId: string | null; onFilter: (id: string | null) => void; onChanged: () => void; onError: (m: string) => void; goTo?: (k: PanelMeta["key"]) => void;
  /** The roster's already-fetched homework / hand-ins / lessons / attempts, folded per group here. Null parts = that endpoint failed. */
  raw?: RawRows; loaded?: boolean;
}) {
  const roster = useMemo(() => students.filter((s) => s.active !== false), [students]);
  const nameOf = useMemo(() => new Map(students.map((s) => [s.childId, s.childName])), [students]);
  const [dialog, setDialog] = useState<HubGroup | "new" | null>(null);

  // Clock for "overdue" / "live now" — a tile must flip without a reload.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);
  const statuses = useMemo(() => new Map(groups.map((g) => [g.id, raw ? groupStatus(g, raw, now) : null])), [groups, raw, now]);

  const create = (g: HubGroup, t: (typeof TILES)[number]) => { setHubIntent({ kind: t.kind, groupId: g.id }); goTo?.(t.tab); };
  // Something exists → show it, filtered to this group; nothing yet → open the create form (the old one-click behaviour).
  const open = (g: HubGroup, t: (typeof TILES)[number], exists: boolean) => {
    if (!exists) { create(g, t); return; }
    setHubView(t.section, g.id); goTo?.(t.viewTab);
  };

  return (
    <section aria-label="Student groups" id="hub-groups" className="mb-5">
      <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
        <h2 className="m-0 flex items-center gap-2 text-[15px] font-extrabold text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>
          <span className="grid h-8 w-8 place-items-center rounded-xl" style={{ background: "var(--violet-soft)", color: "var(--violet)" }}><Ico name="layers" size={16} /></span>
          Groups
          {groups.length > 0 && <span className="rounded-full bg-[var(--panel)] px-2 py-px text-[11px] font-extrabold tabular-nums text-[var(--ink-2)]">{groups.length}</span>}
        </h2>
        <span className="text-[12px] text-[var(--ink-3)]">Optional — one click to set homework, a quiz or a lesson for a whole group.</span>
        <Button className="ml-auto !h-[44px] !px-4" id="hub-new-group" onClick={() => setDialog("new")}><Icon name="plus" size={15} strokeWidth={2.4} /> New group</Button>
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-[var(--brand-line)] px-4 py-3.5" style={{ background: tint("var(--brand)", 4) }}>
          <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]"><Ico name="users" size={19} /></span>
          <p className="min-w-0 flex-1 basis-[220px] text-[12.5px] leading-snug text-[var(--ink-2)]"><b className="text-[var(--ink)]">Teach several students the same thing?</b> Put them in a group — say &ldquo;Year 5 Maths&rdquo; — then set homework or schedule a live lesson for all of them at once.</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map((g) => {
            const ids = groupMemberIds(g);
            const names = g.members?.length ? g.members.map((m) => m.childName) : ids.map((id) => nameOf.get(id) ?? "Student");
            const c = groupColour(g.colour);
            const on = filterId === g.id;
            const st = statuses.get(g.id) ?? null;
            const parts: string[] = [];
            if (st?.lesson?.kind === "live") parts.push("Lesson live now");
            else if (st?.lesson?.kind === "next") parts.push(`Next lesson ${shortWhen(st.lesson.at, now)}`);
            if (st?.homework?.open) parts.push(`${st.homework.open} homework open`);
            const activity = parts.join(" · ");
            return (
              <li key={g.id} data-group-card={g.name} data-ui="card" className="hub-lift relative flex flex-col overflow-hidden rounded-2xl border bg-[var(--surface)] shadow-[var(--shadow-sm)]" style={{ borderColor: on ? c : "var(--line)", boxShadow: on ? `0 0 0 2px ${tint(c, 35)}` : undefined }}>
                <span aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: c }} />
                <div className="flex items-start gap-2.5 py-3 pl-4 pr-1.5">
                  <button type="button" aria-pressed={on} onClick={() => onFilter(on ? null : g.id)} data-group-filter={g.name}
                    className={`-my-1 flex min-h-[44px] min-w-0 flex-1 flex-col items-start justify-center rounded-lg text-left ${FOCUS}`} title={on ? "Showing this group — tap to show everyone" : "Show only this group's students"}>
                    <span className="flex max-w-full items-center gap-2"><GroupDot colour={g.colour} /><span className="truncate text-[14.5px] font-extrabold text-[var(--ink)]">{g.name}</span></span>
                    <span className="mt-0.5 text-[11.5px] font-semibold text-[var(--ink-2)]">{ids.length} student{ids.length === 1 ? "" : "s"}{on ? " · showing below" : ""}</span>
                  </button>
                  {names.length > 0 && <span className="mt-1.5 flex-none"><Stack names={names} max={4} size={26} /></span>}
                  <RowMenu label={`Actions for group ${g.name}`} roomy items={[
                    { label: "Edit group", icon: "edit", onSelect: () => setDialog(g) },
                    { label: on ? "Show everyone" : "Show only this group", icon: "users", onSelect: () => onFilter(on ? null : g.id) },
                  ]} />
                </div>
                {activity && (
                  <p data-group-activity className="-mt-1 flex items-center gap-1.5 truncate py-0 pl-4 pr-3 text-[11.5px] font-semibold text-[var(--ink-2)]"><Ico name="clock" size={12} className="flex-none text-[var(--ink-3)]" /><span className="truncate">{activity}</span></p>
                )}
                <div className="mt-auto grid gap-1.5 border-t border-dashed border-[var(--line)] p-2.5 pl-3.5">
                  {TILES.map((t) => {
                    const info = tileInfo(t.kind, st ?? { homework: null, quiz: null, lesson: null }, now, g.name);
                    return <StatusTile key={t.kind} tile={t} group={g} info={info} loading={!loaded} disabled={ids.length === 0} colour={c} onMain={() => open(g, t, info.exists)} onCreate={() => create(g, t)} />;
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <GroupDialog group={dialog} roster={roster} qs={qs} onClose={() => setDialog(null)} onSaved={onChanged} onError={onError} />
    </section>
  );
}
