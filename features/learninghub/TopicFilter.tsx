"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Button, Input } from "@/components/ui";
import { del, post, put } from "@/lib/api";
import { FOCUS, Icon, Modal, RowMenu, inkOf, subjectColor, subjectInk, tint, useIsDesktop } from "./kit";
import { SubjectTile } from "./subjectArt";
import { SubjectColourModal } from "./SubjectColourPicker";
import { buildTree, canChangeRow, countsFromStats, errMsg, type HubFilter, type NoteStats, type SubjectNode, type Topic } from "./types";
import { deleteHubSubject } from "./NewTopicInline";

// The subject / topic sidebar — drives every panel on the hub. Students just
// pick; tutors (canEdit) also add, rename and delete from a per-row ⋯ menu.
// Subjects aren't a fixed list: they're whatever this tenant has typed.
//
// Desktop: a sticky card. Phones: one "Maths › Algebra · 12 notes ▾" button that
// opens the same tree in a bottom sheet.

interface Props {
  topics: Topic[];
  /** Note counts from the server (GET /notes/counts); null until they arrive — the badges then read 0. */
  noteStats: NoteStats | null;
  filter: HubFilter;
  onFilter: (f: HubFilter) => void;
  canEdit: boolean;
  /** The caller's franchise: head-office topics are read-only for it. */
  franchiseId?: string | null;
  qs: string;
  /** Refetch after a change; the server also pushes hubTopics over realtime. */
  onChanged: () => void;
  onError: (msg: string) => void;
  /** Bump to open the "add topic" form from elsewhere (empty states). */
  addSignal?: number;
  /** "sidebar" (default): the sticky tree card / phone summary button.
   *  "chips": a horizontal snap-scrolling chip bar (quizzes, homework, placement),
   *  with the full tree one tap away in a sheet. */
  variant?: "sidebar" | "chips";
}

const CAP = 6;

type Editing =
  | { kind: "add-topic"; subject?: string }
  | { kind: "add-sub"; parentId: string }
  | { kind: "rename-topic" | "rename-sub"; id: string; value: string }
  | { kind: "rename-subject"; from: string; value: string }
  | null;

const Pill = ({ n, active, color }: { n: number; active?: boolean; color?: string }) => (
  <span className="flex-none rounded-full px-1.5 py-px text-[11px] font-extrabold tabular-nums" style={active && color ? { background: tint(color, 20), color: inkOf(color) } : { background: "var(--panel)", color: "var(--ink-2)" }}
    aria-label={`${n} ${n === 1 ? "lesson" : "lessons"}`}>{n}</span>
);

/** Edge fades for a horizontal chip strip that only show where there is more to scroll to (a fixed fade hid the last chip even when
 *  everything fit, and a strip scrolled to the right clipped its first chip hard with no hint). */
function useEdgeFade() {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ l: false, r: false });
  const read = useCallback(() => {
    const s = ref.current;
    if (!s) return;
    const l = s.scrollLeft > 4, r = s.scrollLeft + s.clientWidth < s.scrollWidth - 4;
    setEdges((e) => (e.l === l && e.r === r ? e : { l, r }));
  }, []);
  useEffect(() => {
    read();
    const s = ref.current;
    if (!s || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(s);
    for (const c of Array.from(s.children)) ro.observe(c);
    return () => ro.disconnect();
  });
  const style = { "--hub-fade-l": edges.l ? "32px" : "0px", "--hub-fade-r": edges.r ? "32px" : "0px" } as CSSProperties;
  return { ref, style, onScroll: read };
}

export function TopicFilter({ topics, noteStats, filter, onFilter, canEdit, franchiseId, qs, onChanged, onError, addSignal = 0, variant = "sidebar" }: Props) {
  const isDesktop = useIsDesktop();
  const tree = useMemo(() => buildTree(topics), [topics]);
  const counts = useMemo(() => countsFromStats(topics, noteStats), [topics, noteStats]);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Editing>(null);
  const [subject, setSubject] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [colouring, setColouring] = useState<string | null>(null); // the subject whose colour is being chosen
  const subjFade = useEdgeFade(), topicFade = useEdgeFade(); // chip-strip edge fades (hooks run before any early return)
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);

  const toggle = (id: string) => setOpen((o) => { const n = new Set(o); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const expand = (...ids: string[]) => setOpen((o) => new Set([...o, ...ids]));

  // A selection inside a collapsed branch opens it once (the user can still fold it).
  useEffect(() => {
    if (!filter.subject) return;
    const ids = [filter.subject];
    const t = topics.find((x) => x.id === filter.topicId);
    if (t?.parentTopicId) ids.push(t.parentTopicId);
    expand(...ids);
  }, [filter, topics]);

  const startEdit = (e: NonNullable<Editing>) => {
    setEditing(e); setName(""); setSubject(e.kind === "add-topic" ? e.subject ?? "" : "");
    // Keep the branch under edit open so the form never vanishes with a filter change.
    if (e.kind === "add-sub") { const p = topics.find((x) => x.id === e.parentId); expand(e.parentId, ...(p ? [p.subject] : [])); }
    if (e.kind === "rename-topic" || e.kind === "rename-sub") { const p = topics.find((x) => x.id === e.id); if (p) expand(p.subject); }
    if (e.kind === "rename-subject") expand(e.from);
    if (e.kind === "add-topic" && e.subject) expand(e.subject);
  };
  const cancelEdit = () => { setEditing(null); setSubject(""); setName(""); };

  const lastSignal = useRef(addSignal);
  useEffect(() => {
    if (addSignal === lastSignal.current) return;
    lastSignal.current = addSignal;
    if (canEdit) { startEdit({ kind: "add-topic" }); if (!isDesktop) setSheet(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addSignal]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); if (editing?.kind === "add-topic") setShowAll(true); cancelEdit(); onChanged(); }
    catch (e) { onError(errMsg(e, "Couldn't save that change")); }
    finally { setBusy(false); }
  };

  const pick = (f: HubFilter) => { onFilter(f); setSheet(false); };
  const roomy = !isDesktop;
  const rowH = roomy ? "min-h-[44px]" : "min-h-[38px]";

  const inlineForm = (opts: { placeholder: string; value: string; onValue: (v: string) => void; onSave: () => void; withSubject?: boolean }) => (
    <form className="my-1.5 space-y-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-2.5"
      onSubmit={(e) => { e.preventDefault(); opts.onSave(); }}
      onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); cancelEdit(); } }}>
      {opts.withSubject && (
        <>
          <Input list="hub-subjects" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject (e.g. Maths)" maxLength={80} aria-label="Subject" autoFocus className="w-full" />
          <datalist id="hub-subjects">{tree.map((s) => <option key={s.subject} value={s.subject} />)}</datalist>
        </>
      )}
      <Input value={opts.value} onChange={(e) => opts.onValue(e.target.value)} placeholder={opts.placeholder} maxLength={120} aria-label={opts.placeholder} autoFocus={!opts.withSubject} className="w-full" />
      <div className="flex gap-1.5">
        <Button type="submit" variant="primary" sm disabled={busy || !opts.value.trim() || (!!opts.withSubject && !subject.trim())}>Save</Button>
        <Button type="button" sm onClick={cancelEdit}>Cancel</Button>
      </div>
    </form>
  );

  const rowShell = (active: boolean, color: string) =>
    `group flex items-center rounded-xl transition-colors ${active ? "" : "hover:bg-[var(--panel)]"} ${rowH}`;
  const activeStyle = (active: boolean, color: string) => (active ? { background: tint(color, 11), boxShadow: `inset 0 0 0 1.5px ${tint(color, 55)}` } : undefined);

  const chevron = (id: string, label: string, isOpen: boolean, controls: string) => (
    <button type="button" onClick={() => toggle(id)} aria-expanded={isOpen} aria-controls={controls} aria-label={`${isOpen ? "Collapse" : "Expand"} ${label}`}
      className={`grid flex-none place-items-center rounded-lg text-[var(--ink-2)] hover:bg-[var(--line)] ${roomy ? "h-11 w-9" : "h-9 w-7"} ${FOCUS}`}>
      <Icon name="chevronRight" size={15} className={`transition-transform ${isOpen ? "rotate-90" : ""}`} strokeWidth={2.2} />
    </button>
  );
  const spacer = <span className={`flex-none ${roomy ? "w-9" : "w-7"}`} aria-hidden="true" />;

  const needle = q.trim().toLowerCase();
  const nameHit = (x: string | null | undefined) => !!x && x.toLowerCase().includes(needle);
  const subjectHit = (s: SubjectNode) => !needle || nameHit(s.subject) || s.topics.some(({ topic, subs }) => nameHit(topic.topic) || subs.some((x) => nameHit(x.subtopic)));
  const found = tree.filter(subjectHit);
  const renderTree = (capped: boolean) => (
    <div id="hub-topic-filter-tree">
      {(() => {
        const all = !filter.subject && !filter.topicId;
        return (
          <div className={rowShell(all, "var(--brand)")} style={activeStyle(all, "var(--brand)")}>
            <button type="button" onClick={() => pick({ subject: null, topicId: null })} aria-current={all ? "true" : undefined}
              className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2.5 text-left text-[13px] font-bold ${rowH} ${all ? "text-[var(--brand-strong)]" : "text-[var(--ink)]"} ${FOCUS}`}>
              <span className="grid h-6 w-6 flex-none place-items-center rounded-lg" style={{ background: tint("var(--brand)", 14), color: "var(--brand)" }}><Icon name="layers" size={14} /></span>
              <span className="min-w-0 flex-1 truncate">All subjects</span>
              <Pill n={counts.total} active={all} color="var(--brand)" />
            </button>
          </div>
        );
      })()}

      {(() => {
        const limit = capped && !needle && !showAll && found.length > CAP + 1 ? CAP : found.length;
        const visible = found.slice(0, limit);
        const sel = found.find((x) => x.subject === filter.subject);
        if (sel && !visible.includes(sel)) visible.push(sel);
        return visible;
      })().map((s) => {
        const color = subjectColor(s.subject);
        const isOpen = open.has(s.subject) || (!!needle && s.topics.some(({ topic, subs }) => nameHit(topic.topic) || subs.some((x) => nameHit(x.subtopic))));
        const sel = filter.subject === s.subject && !filter.topicId;
        const subId = `hub-subj-${s.subject.replace(/\W+/g, "-")}`;
        return (
          <div key={s.subject} className="mt-0.5">
            {editing?.kind === "rename-subject" && editing.from === s.subject ? (
              inlineForm({ placeholder: "Subject name", value: editing.value, onValue: (v) => setEditing({ ...editing, value: v }), onSave: () => run(() => post("/api/learning-hub/topics/rename-subject" + qs, { from: s.subject, to: editing.value })) })
            ) : (
              <div className={rowShell(sel, color)} style={activeStyle(sel, color)}>
                {s.topics.length ? chevron(s.subject, s.subject, isOpen, subId) : spacer}
                <button type="button" onClick={() => { expand(s.subject); pick({ subject: s.subject, topicId: null }); }} aria-current={sel ? "true" : undefined}
                  className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-xl pr-2 text-left text-[13px] font-bold text-[var(--ink)] ${rowH} ${FOCUS}`}>
                  <SubjectTile subject={s.subject} size={roomy ? 30 : 26} />
                  <span className="min-w-0 flex-1 truncate">{s.subject}</span>
                  <Pill n={counts.bySubject.get(s.subject) ?? 0} active={sel} color={color} />
                </button>
                {canEdit && (
                  <RowMenu label={`Actions for ${s.subject}`} roomy={roomy} items={[
                    { label: "Add topic", icon: "plus", onSelect: () => startEdit({ kind: "add-topic", subject: s.subject }) },
                    { label: "Subject colour", icon: "sparkle", onSelect: () => setColouring(s.subject) },
                    // A franchise can't rename a subject it shares with head office (that would rename head office's topics too).
                    ...(franchiseId ? [] : [{ label: "Rename subject", icon: "edit" as const, onSelect: () => startEdit({ kind: "rename-subject", from: s.subject, value: s.subject }) }]),
                    // Only a subject with no lessons in it can go (the server also refuses while quizzes / cards are filed under it).
                    ...((counts.bySubject.get(s.subject) ?? 0) === 0 ? [{ label: "Delete subject", icon: "trash" as const, danger: true, onSelect: () => run(async () => { await deleteHubSubject(qs, s.subject); if (filter.subject === s.subject) pick({ subject: null, topicId: null }); }) }] : []),
                  ]} />
                )}
              </div>
            )}

            {isOpen && (
              <div id={subId} className="ml-[13px] border-l-2 pl-1.5" style={{ borderColor: tint(color, 35) }}>
                {s.topics.filter(({ topic, subs }) => !needle || nameHit(s.subject) || nameHit(topic.topic) || subs.some((x) => nameHit(x.subtopic))).map(({ topic, subs: allSubs }) => {
                  // While searching, a topic opens onto (only) the subtopics that match, so a 700-row taxonomy stays a short list.
                  const subs = needle && !nameHit(s.subject) && !nameHit(topic.topic) ? allSubs.filter((x) => nameHit(x.subtopic)) : allSubs;
                  const tOpen = open.has(topic.id) || (!!needle && subs.some((x) => nameHit(x.subtopic)));
                  const tSel = filter.topicId === topic.id;
                  const tid = `hub-topic-${topic.id}`;
                  return (
                    <div key={topic.id}>
                      {editing?.kind === "rename-topic" && editing.id === topic.id ? (
                        inlineForm({ placeholder: "Topic name", value: editing.value, onValue: (v) => setEditing({ ...editing, value: v }), onSave: () => run(() => put(`/api/learning-hub/topics/${topic.id}${qs}`, { topic: editing.value })) })
                      ) : (
                        <div className={rowShell(tSel, color)} style={activeStyle(tSel, color)}>
                          {subs.length ? chevron(topic.id, topic.topic, tOpen, tid) : spacer}
                          <button type="button" onClick={() => pick({ subject: s.subject, topicId: topic.id })} aria-current={tSel ? "true" : undefined}
                            className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl pr-2 text-left text-[13px] font-semibold text-[var(--ink)] ${rowH} ${FOCUS}`}>
                            <span className="min-w-0 flex-1 truncate">{topic.topic}</span>
                            <Pill n={counts.byTopic.get(topic.id) ?? 0} active={tSel} color={color} />
                          </button>
                          {canEdit && (
                            <RowMenu label={`Actions for ${topic.topic}`} roomy={roomy} items={[
                              { label: "Add subtopic", icon: "plus", onSelect: () => startEdit({ kind: "add-sub", parentId: topic.id }) },
                              ...(canChangeRow(franchiseId, topic.franchiseId) ? [
                                { label: "Rename", icon: "edit" as const, onSelect: () => startEdit({ kind: "rename-topic", id: topic.id, value: topic.topic }) },
                                { label: "Delete", icon: "trash" as const, danger: true, onSelect: () => run(() => del(`/api/learning-hub/topics/${topic.id}${qs}`)) },
                              ] : []),
                            ]} />
                          )}
                          {canEdit && !canChangeRow(franchiseId, topic.franchiseId) && <span title="From head office — read only" className="sr-only">From head office</span>}
                        </div>
                      )}
                      {editing?.kind === "add-sub" && editing.parentId === topic.id &&
                        inlineForm({ placeholder: "Subtopic name", value: name, onValue: setName, onSave: () => run(() => post("/api/learning-hub/topics" + qs, { parentTopicId: topic.id, subtopic: name })) })}
                      {tOpen && subs.length > 0 && (
                        <div id={tid} className="ml-[13px] border-l border-[var(--line)] pl-1.5">
                          {subs.map((sub) => {
                            const sSel = filter.topicId === sub.id;
                            return (
                              <div key={sub.id}>
                                {editing?.kind === "rename-sub" && editing.id === sub.id ? (
                                  inlineForm({ placeholder: "Subtopic name", value: editing.value, onValue: (v) => setEditing({ ...editing, value: v }), onSave: () => run(() => put(`/api/learning-hub/topics/${sub.id}${qs}`, { subtopic: editing.value })) })
                                ) : (
                                  <div className={rowShell(sSel, color)} style={activeStyle(sSel, color)}>
                                    <button type="button" onClick={() => pick({ subject: s.subject, topicId: sub.id })} aria-current={sSel ? "true" : undefined}
                                      className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2.5 text-left text-[12.5px] font-semibold text-[var(--ink)] ${rowH} ${FOCUS}`}>
                                      <span className="min-w-0 flex-1 truncate">{sub.subtopic}</span>
                                      <Pill n={counts.byTopic.get(sub.id) ?? 0} active={sSel} color={color} />
                                    </button>
                                    {canEdit && canChangeRow(franchiseId, sub.franchiseId) && (
                                      <RowMenu label={`Actions for ${sub.subtopic}`} roomy={roomy} items={[
                                        { label: "Rename", icon: "edit", onSelect: () => startEdit({ kind: "rename-sub", id: sub.id, value: sub.subtopic ?? "" }) },
                                        { label: "Delete", icon: "trash", danger: true, onSelect: () => run(() => del(`/api/learning-hub/topics/${sub.id}${qs}`)) },
                                      ]} />
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                {editing?.kind === "add-topic" && editing.subject === s.subject &&
                  inlineForm({ placeholder: "Topic name (e.g. Algebra)", value: name, onValue: setName, withSubject: true, onSave: () => run(() => post("/api/learning-hub/topics" + qs, { subject, topic: name })) })}
              </div>
            )}
          </div>
        );
      })}

      {(() => {
        const shown = capped && !needle && !showAll && found.length > CAP + 1 ? CAP + (found.slice(CAP).some((x) => x.subject === filter.subject) ? 1 : 0) : found.length;
        const hidden = found.length - shown;
        if (hidden > 0) return (
          <button type="button" onClick={() => setShowAll(true)}
            className={`mt-1 flex min-h-[44px] lg:min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--line)] text-[12.5px] font-extrabold text-[var(--brand)] transition hover:bg-[var(--brand-soft)] ${FOCUS}`}>
            Show all {found.length} <Icon name="chevronDown" size={14} strokeWidth={2.2} />
          </button>
        );
        if (capped && showAll && !needle && found.length > CAP + 1) return (
          <button type="button" onClick={() => setShowAll(false)}
            className={`mt-1 flex min-h-[44px] lg:min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl text-[12.5px] font-bold text-[var(--ink-2)] transition hover:bg-[var(--panel)] ${FOCUS}`}>
            Show fewer <Icon name="chevronDown" size={14} strokeWidth={2.2} className="rotate-180" />
          </button>
        );
        return null;
      })()}

      {tree.length > 0 && found.length === 0 && (
        <p className="px-2 py-4 text-center text-[12.5px] text-[var(--ink-2)]">No subject or topic matches “{q.trim()}”.</p>
      )}

      {tree.length === 0 && (
        <div className="px-2 py-5 text-center">
          <span className="mx-auto grid h-10 w-10 place-items-center rounded-xl" style={{ background: tint("var(--brand)", 12), color: "var(--brand)" }}><Icon name="folder" size={20} /></span>
          <p className="mt-2 text-[12.5px] leading-snug text-[var(--ink-2)]">
            {canEdit ? "No subjects yet — add your first topic to get started." : "Your tutor hasn't added any topics yet."}
          </p>
        </div>
      )}

      {canEdit && (
        <div className="mt-2 border-t border-[var(--line)] pt-2.5">
          {editing?.kind === "add-topic" && !editing.subject
            ? inlineForm({ placeholder: "Topic name (e.g. Algebra)", value: name, onValue: setName, withSubject: true, onSave: () => run(() => post("/api/learning-hub/topics" + qs, { subject, topic: name })) })
            : <Button sm className="!min-h-[38px]" onClick={() => startEdit({ kind: "add-topic" })}><Icon name="plus" size={14} /> Add topic</Button>}
        </div>
      )}
    </div>
  );

  // ── search (only worth showing once the list is long) ─────────────────────
  const searchBox = tree.length > CAP ? (
    <div className="relative mb-1.5">
      <Icon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-3)]" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a subject or topic…" aria-label="Find a subject or topic"
        className={`min-h-[40px] w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] pl-8 pr-8 text-[13px] font-semibold text-[var(--ink)] placeholder:text-[var(--ink-3)] ${FOCUS}`} />
      {q && <button type="button" onClick={() => setQ("")} aria-label="Clear search" className={`absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-[var(--ink-2)] hover:bg-[var(--line)] ${FOCUS}`}><Icon name="close" size={14} /></button>}
    </div>
  ) : null;

  const sheetView = (
    <>
      <Modal open={sheet} onClose={() => setSheet(false)} title="Subjects & topics" id="hub-topic-sheet">{searchBox}{renderTree(false)}</Modal>
      {colouring && <SubjectColourModal subject={colouring} qs={qs} onClose={() => setColouring(null)} onSaved={onChanged} onError={onError} />}
    </>
  );

  // ── chips: a horizontal snap bar (quizzes, homework, placement) ───────────
  if (variant === "chips") {
    const chip = (on: boolean, color: string) => `hub-press inline-flex min-h-[44px] flex-none snap-start items-center gap-2 whitespace-nowrap rounded-full border pl-1.5 pr-3.5 text-[13px] font-extrabold transition-colors ${FOCUS} ${on ? "" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--ink-3)]"}`;
    const chipStyle = (on: boolean, color: string, ink = color) => (on ? { background: tint(color, 14), borderColor: color, color: ink } : undefined);
    const subj = filter.subject ? tree.find((x) => x.subject === filter.subject) : undefined;
    const activeTop = topics.find((t) => t.id === filter.topicId);
    const activeTopId = activeTop?.parentTopicId ?? activeTop?.id ?? null;
    return (
      <div id="hub-topic-filter" data-variant="chips" className="mb-4">
        <div role="group" aria-label="Filter by subject" ref={subjFade.ref} style={subjFade.style} onScroll={subjFade.onScroll} className="hub-fade-x -mx-3 flex snap-x snap-proximity gap-2 overflow-x-auto scroll-px-3 px-3 pb-1.5 pr-8 [scrollbar-width:none] sm:-mx-5 sm:px-5 sm:scroll-px-5 [&::-webkit-scrollbar]:hidden">
          <button type="button" aria-pressed={!filter.subject} onClick={() => onFilter({ subject: null, topicId: null })} className={chip(!filter.subject, "var(--brand)")} style={chipStyle(!filter.subject, "var(--brand)")}>
            <span className="grid h-[30px] w-[30px] place-items-center rounded-full" style={{ background: tint("var(--brand)", 16), color: "var(--brand)" }}><Icon name="layers" size={15} /></span>All subjects
          </button>
          {tree.map((s) => {
            const on = filter.subject === s.subject;
            const c = subjectColor(s.subject);
            return (
              <button key={s.subject} type="button" aria-pressed={on} onClick={() => onFilter({ subject: s.subject, topicId: null })} className={chip(on, c)} style={chipStyle(on, c, subjectInk(s.subject))}>
                <SubjectTile subject={s.subject} size={30} className="!rounded-full" />{s.subject}
              </button>
            );
          })}
          <button type="button" onClick={() => setSheet(true)} aria-haspopup="dialog" className={`hub-press inline-flex min-h-[44px] flex-none snap-start items-center gap-1.5 whitespace-nowrap rounded-full border border-dashed border-[var(--ink-3)] px-3.5 text-[13px] font-extrabold text-[var(--ink-2)] hover:bg-[var(--panel)] ${FOCUS}`}>
            <Icon name="gear" size={15} /> {canEdit ? "Manage" : "Browse"} topics
          </button>
        </div>
        {subj && subj.topics.length > 0 && (
          <div role="group" aria-label={`${subj.subject} topics`} ref={topicFade.ref} style={topicFade.style} onScroll={topicFade.onScroll} className="hub-fade-x -mx-3 mt-1 flex snap-x snap-proximity gap-1.5 overflow-x-auto scroll-px-3 px-3 pb-1 pr-8 [scrollbar-width:none] sm:-mx-5 sm:px-5 sm:scroll-px-5 [&::-webkit-scrollbar]:hidden">
            {[{ id: null as string | null, label: `All ${subj.subject}`, sub: false }, ...subj.topics.flatMap(({ topic, subs }) => [
              { id: topic.id as string | null, label: topic.topic, sub: false },
              ...(activeTopId === topic.id ? subs.map((x) => ({ id: x.id as string | null, label: x.subtopic ?? "", sub: true })) : []),
            ])].map((t) => {
              const on = (filter.topicId ?? null) === t.id;
              const c = subjectColor(subj.subject);
              return (
                <button key={t.id ?? "all"} type="button" aria-pressed={on} onClick={() => onFilter({ subject: subj.subject, topicId: t.id })}
                  className={`hub-press inline-flex min-h-[44px] flex-none snap-start items-center whitespace-nowrap rounded-full border px-3.5 text-[12.5px] font-bold transition-colors ${FOCUS} ${on ? "" : "border-[var(--line)] bg-[var(--panel)] text-[var(--ink-2)] hover:text-[var(--ink)]"} ${t.sub ? "ml-0.5 border-dashed" : ""}`}
                  style={on ? { background: tint(c, 14), borderColor: c, color: inkOf(c) } : undefined}>{t.label}</button>
              );
            })}
          </div>
        )}
        {sheetView}
      </div>
    );
  }

  // ── phone: one summary button + bottom sheet ─────────────────────────────
  const currentTopic = topics.find((t) => t.id === filter.topicId);
  const summary: ReactNode = (() => {
    if (!filter.subject) return <>All subjects</>;
    if (!currentTopic) return <>{filter.subject}</>;
    return <>{filter.subject} <span aria-hidden="true">›</span> {currentTopic.subtopic ?? currentTopic.topic}</>;
  })();
  const summaryCount = filter.topicId ? counts.byTopic.get(filter.topicId) ?? 0 : filter.subject ? counts.bySubject.get(filter.subject) ?? 0 : counts.total;

  if (!isDesktop) {
    return (
      <div id="hub-topic-filter">
        <button type="button" onClick={() => setSheet(true)} aria-haspopup="dialog" aria-label={`Subjects and topics: ${filter.subject ?? "All subjects"}. Change`}
          className={`flex min-h-[52px] w-full items-center gap-2.5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3 text-left shadow-[var(--shadow-sm)] ${FOCUS}`}>
          {filter.subject
            ? <SubjectTile subject={filter.subject} size={32} />
            : <span className="grid h-8 w-8 flex-none place-items-center rounded-[10px]" style={{ background: tint("var(--brand)", 14), color: "var(--brand)" }}><Icon name="layers" size={16} /></span>}
          <span className="min-w-0 flex-1 truncate text-[13.5px] font-extrabold text-[var(--ink)]">{summary}<span className="font-semibold text-[var(--ink-2)]"> · {summaryCount} {summaryCount === 1 ? "lesson" : "lessons"}</span></span>
          <Icon name="chevronDown" size={18} className="text-[var(--ink-2)]" />
        </button>
        {sheetView}
      </div>
    );
  }

  return (
    <nav aria-label="Subjects and topics" id="hub-topic-filter" data-ui="card"
      className="max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-2.5 shadow-[var(--shadow-sm)]">
      <div className="mb-1.5 flex items-center gap-2 px-2 pt-1 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-2)]">Subjects &amp; topics <span className="ml-auto rounded-full bg-[var(--panel)] px-1.5 py-px text-[11px] tabular-nums normal-case tracking-normal">{tree.length}</span></div>
      {searchBox}
      {renderTree(true)}
      {sheetView}
    </nav>
  );
}
