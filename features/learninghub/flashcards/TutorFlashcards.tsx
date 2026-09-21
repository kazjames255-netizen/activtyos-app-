"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Input } from "@/components/ui";
import { del, get, post, put } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import type { PanelProps } from "../panelTypes";
import { canChangeRow, errMsg, topicLabel } from "../types";
import { DISPLAY, EmptyState, FOCUS, MenuItem, MoreMenu, Pill, ProgressBar, Skeleton, fmtDay, useCountUp, withQs } from "../teachKit";
import { GradientTile, Ico } from "../teachIcons";
import { subjectColor } from "../kit";
import { BulkDialog, CardDialog } from "./CardDialogs";
import type { Card, FlashStats } from "./fcTypes";

// Tutor flashcards: a card bank per topic (create / edit / delete / publish,
// bulk paste) and how the students are getting on (server stats).

export function TutorFlashcards({ qs, topics, covered, filter, onError, readOnly, franchiseId }: PanelProps) {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [stats, setStats] = useState<FlashStats | null>(null);
  const [q, setQ] = useState("");
  const [dialog, setDialog] = useState<{ kind: "card"; card: Card | null; topicId: string } | { kind: "bulk"; topicId: string } | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [flipped, setFlipped] = useState<Set<string>>(new Set());
  const [allStudents, setAllStudents] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  // SCALE: ~4,500 cards per provider, so the deck is fetched for the sidebar's topic / subject, 60 at a time (search runs
  // server-side, debounced); the header numbers come from /flashcards/stats, not from counting a loaded list.
  const PAGE = 60;
  const [next, setNext] = useState<string | null>(null);
  const [listTotal, setListTotal] = useState(0);
  const [more, setMore] = useState(false);
  const [dq, setDq] = useState("");
  const seq = useRef(0);
  const kept = useRef(PAGE);
  useEffect(() => { const t = setTimeout(() => setDq(q.trim()), 250); return () => clearTimeout(t); }, [q]);
  const listPath = useCallback((cursor: string | null, limit: number) =>
    `/api/learning-hub/flashcards${withQs(qs, { limit: String(limit), sort: "topic", cursor, ...(filter.topicId ? { topicId: filter.topicId } : filter.subject ? { subject: filter.subject } : {}), q: dq || null })}`, [qs, filter.topicId, filter.subject, dq]);
  const loadCards = useCallback((append: boolean, cursor: string | null = null, keep = false) => {
    const mine = ++seq.current;
    if (append) setMore(true);
    get<{ items: Card[]; total: number; nextCursor: string | null }>(listPath(append ? cursor : null, append ? PAGE : keep ? Math.min(200, Math.max(PAGE, kept.current)) : PAGE))
      .then((r) => {
        if (!mounted.current || mine !== seq.current) return;
        setCards((cur) => (append ? [...(cur ?? []), ...r.items.filter((x) => !(cur ?? []).some((c) => c.id === x.id))] : r.items));
        kept.current = append ? kept.current + r.items.length : Math.max(PAGE, r.items.length);
        setListTotal(r.total); setNext(r.nextCursor);
      })
      .catch((e) => { if (mounted.current && mine === seq.current) { setCards((c) => c ?? []); onError(errMsg(e, "Couldn't load the flashcards")); } })
      .finally(() => { if (mounted.current && mine === seq.current) setMore(false); });
  }, [listPath, onError]);
  const loadStats = useCallback(() => {
    get<FlashStats>(`/api/learning-hub/flashcards/stats${withQs(qs, {})}`).then((r) => mounted.current && setStats(r)).catch(() => undefined);
  }, [qs]);
  const load = useCallback(() => { loadCards(false, null, true); loadStats(); }, [loadCards, loadStats]);
  useEffect(() => { kept.current = PAGE; loadCards(false); }, [loadCards]);
  useEffect(() => { loadStats(); }, [loadStats]);
  useRealtime(["hubFlashcards", "hubFlashcardReviews", "hubTopics"], load);

  const sortedTopics = useMemo(() => topics.filter((t) => covered.has(t.id)).sort((a, b) => topicLabel(a).localeCompare(topicLabel(b))), [topics, covered]);
  const needle = dq.toLowerCase();
  const byTopic = useMemo(() => {
    const m = new Map<string, Card[]>();
    for (const c of cards ?? []) {
      if (!covered.has(c.topicId)) continue;
      const l = m.get(c.topicId); if (l) l.push(c); else m.set(c.topicId, [c]);
    }
    return m;
  }, [cards, covered]);

  const defaultTopic = filter.topicId ?? (cards ?? []).find((c) => covered.has(c.topicId))?.topicId ?? sortedTopics[0]?.id ?? topics[0]?.id ?? "";

  const setPublished = async (list: Card[], published: boolean) => {
    setBusy(list.length === 1 ? list[0]!.id : "many");
    try {
      // One request however many cards ("Publish 60 drafts" used to be 60 parallel PUTs).
      if (list.length === 1) await put(`/api/learning-hub/flashcards/${list[0]!.id}${withQs(qs, {})}`, { published });
      else await post(`/api/learning-hub/flashcards/publish${withQs(qs, {})}`, { ids: list.map((c) => c.id), published });
      load();
    }
    catch (e) { onError(errMsg(e, "Couldn't update the card")); }
    finally { setBusy(null); }
  };
  const remove = async (c: Card) => {
    setBusy(c.id);
    try { await del(`/api/learning-hub/flashcards/${c.id}${withQs(qs, {})}`); setConfirmDel(null); load(); }
    catch (e) { onError(errMsg(e, "Couldn't delete the card")); }
    finally { setBusy(null); }
  };

  if (cards === null) return <div className="grid gap-3" aria-busy="true" aria-label="Loading flashcards"><Skeleton className="h-[84px]" /><Skeleton className="h-[120px]" /><Skeleton className="h-[120px]" /></div>;

  const noTopics = topics.length === 0;
  const total = stats?.totalCards ?? cards.length;
  const published = stats?.publishedCards ?? cards.filter((c) => c.published).length;
  const shown = [...byTopic.values()].reduce((n, l) => n + l.length, 0);
  const addBtns = readOnly ? null : (
    <div className="flex flex-wrap gap-2">
      <Button variant="solid" id="hub-add-card" className={`min-h-[44px] gap-2 ${FOCUS}`} disabled={noTopics} onClick={() => setDialog({ kind: "card", card: null, topicId: defaultTopic })}><Ico name="plus" size={16} strokeWidth={2.4} />Add card</Button>
      <Button variant="ghost" id="hub-bulk-cards" className={`min-h-[44px] gap-2 ${FOCUS}`} disabled={noTopics} onClick={() => setDialog({ kind: "bulk", topicId: defaultTopic })}><Ico name="inbox" size={16} />Paste many</Button>
    </div>
  );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4" id="hub-flashcards">
      <div className="flex flex-wrap items-center gap-3">
        <GradientTile icon="cards" size={44} />
        <div className="min-w-0 flex-1 basis-[200px]">
          <h2 className="m-0 text-[19px] font-extrabold text-[var(--ink)]" style={DISPLAY}>Flashcards</h2>
          <p className="text-[12.5px] text-[var(--ink-3)]">Write cards per topic. Students review them on a spaced schedule — the app decides when each card comes back.</p>
        </div>
        {addBtns}
      </div>

      {noTopics ? (
        <EmptyState icon={<Ico name="folder" size={26} />} title="Add a topic first" body="Flashcards hang off topics. Create a subject and topic in the sidebar, then come back to write cards." />
      ) : total === 0 ? (
        <EmptyState icon={<Ico name="cards" size={26} />} title="Write your first flashcards" body="Add cards one at a time, or paste a whole list — “front | back”, one per line. Publish them and your students get a daily review queue." action={addBtns} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {[
              { label: "Cards", value: total, tone: "var(--brand-2)" },
              { label: "Published", value: published, tone: "var(--green)" },
              { label: "Drafts", value: Math.max(0, total - published), tone: "var(--gold)" },
              { label: "Due to review", value: (stats?.students ?? []).reduce((n, s) => n + s.due, 0), tone: "var(--brand)" },
            ].map((t) => <StatTile key={t.label} {...t} />)}
          </div>

          {stats && stats.students.length > 0 && (
            <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-sm)]" aria-label="Student progress">
              <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]">Student progress</div>
              <div className="grid gap-2.5">
                {[...stats.students].sort((a, b) => b.due - a.due || (b.lastReviewedAt ?? "").localeCompare(a.lastReviewedAt ?? "")).slice(0, allStudents ? 200 : 5).map((s) => (
                  <div key={s.childId} className="grid items-center gap-x-4 gap-y-1 sm:grid-cols-[150px_minmax(0,1fr)_auto]">
                    <div className="truncate text-[13px] font-extrabold text-[var(--ink)]">{s.childName}</div>
                    <div>
                      <ProgressBar pct={s.cardsAvailable ? (s.reviewed / s.cardsAvailable) * 100 : 0} label={`${s.childName}: ${s.reviewed} of ${s.cardsAvailable} cards started`} />
                      <div className="mt-1 text-[11px] text-[var(--ink-3)]">{s.reviewed}/{s.cardsAvailable} started · {s.mastered} mastered{s.lastReviewedAt ? ` · last ${fmtDay(s.lastReviewedAt)}` : " · not started"}</div>
                    </div>
                    <div className="flex gap-1.5">{s.due > 0 && <Pill tone="gold">{s.due} due</Pill>}{s.new > 0 && <Pill tone="violet">{s.new} new</Pill>}{s.due === 0 && s.new === 0 && <Pill tone="green">Up to date</Pill>}</div>
                  </div>
                ))}
              </div>
              {stats.students.length > 5 && <button type="button" onClick={() => setAllStudents((v) => !v)} className={`mt-2 min-h-[44px] lg:min-h-[40px] rounded-lg px-1 text-[12px] font-bold text-[var(--brand)] hover:underline ${FOCUS}`}>{allStudents ? "Show fewer" : `Show all ${stats.students.length} students`}</button>}
            </section>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Input aria-label="Search cards" className="min-h-[44px] min-w-[200px] flex-1" placeholder="Search cards…" value={q} onChange={(e) => setQ(e.target.value)} />
            <span className="text-[12px] text-[var(--ink-3)]">{listTotal || shown} card{(listTotal || shown) === 1 ? "" : "s"}{filter.subject || filter.topicId ? " in this topic" : ""}</span>
          </div>

          {shown === 0 ? (
            <p className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-8 text-center text-[13px] text-[var(--ink-3)]">{needle ? "No cards match that search." : "No cards in this topic yet — add some above."}</p>
          ) : sortedTopics.filter((t) => byTopic.has(t.id)).map((t) => {
            const list = byTopic.get(t.id)!;
            // Head office's cards are the franchise's to use, not to change.
            const drafts = list.filter((c) => !c.published && canChangeRow(franchiseId, c.franchiseId));
            return (
              <section key={t.id} aria-label={topicLabel(t)} data-topic={t.id} className="grid gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="m-0 min-w-0 truncate text-[14px] font-extrabold text-[var(--brand-strong)]" style={DISPLAY}>{topicLabel(t)}</h3>
                  <Pill tone="brand">{list.length}</Pill>
                  <div className="ml-auto flex flex-wrap gap-1.5">
                    {!readOnly && drafts.length > 0 && <Button variant="ghost" className={`min-h-[44px] ${FOCUS}`} disabled={busy === "many"} onClick={() => void setPublished(drafts, true)}>Publish {drafts.length} draft{drafts.length === 1 ? "" : "s"}</Button>}
                    {!readOnly && <Button variant="ghost" className={`min-h-[44px] gap-1.5 ${FOCUS}`} onClick={() => setDialog({ kind: "card", card: null, topicId: t.id })}><Ico name="plus" size={14} strokeWidth={2.4} />Card</Button>}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {list.map((c) => (
                    <MiniCard key={c.id} card={c} accent={subjectColor(t.subject)} flipped={flipped.has(c.id)} busy={busy === c.id} confirming={confirmDel === c.id} locked={readOnly ? "view" : canChangeRow(franchiseId, c.franchiseId) ? null : "head-office"}
                      onFlip={() => setFlipped((st) => { const n = new Set(st); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; })}
                      onEdit={() => setDialog({ kind: "card", card: c, topicId: c.topicId })}
                      onPublish={() => void setPublished([c], !c.published)}
                      onAskDelete={() => setConfirmDel(c.id)} onCancelDelete={() => setConfirmDel(null)} onDelete={() => void remove(c)} />
                  ))}
                </div>
              </section>
            );
          })}
          {next && <div className="flex justify-center"><Button onClick={() => loadCards(true, next)} disabled={more} className={`min-h-[44px] !px-6 ${FOCUS}`}>{more ? "Loading…" : `Show more (${Math.max(0, listTotal - (cards?.length ?? 0))} left)`}</Button></div>}
        </>
      )}

      {dialog?.kind === "card" && (
        <CardDialog key={dialog.card?.id ?? "new"} card={dialog.card} topics={topics} defaultTopicId={dialog.topicId} qs={qs} franchiseId={franchiseId} onClose={() => setDialog(null)}
          onOpenOther={readOnly ? undefined : (c) => setDialog({ kind: "card", card: c, topicId: c.topicId })} onStartNew={() => setDialog({ kind: "card", card: null, topicId: defaultTopic })}
          onSaved={(more) => { load(); if (!more) setDialog(null); }} />
      )}
      {dialog?.kind === "bulk" && <BulkDialog topics={topics} defaultTopicId={dialog.topicId} qs={qs} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); load(); }} />}
    </div>
  );
}

function StatTile({ label, value, tone }: { label: string; value: number; tone: string }) {
  const v = useCountUp(value, 600);
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 pl-4 shadow-[var(--shadow-sm)]">
      <div className="absolute bottom-3 left-0 top-3 w-[3px] rounded-r" style={{ background: tone }} />
      <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]">{label}</div>
      <div className="mt-1 text-[26px] font-extrabold leading-none tabular-nums" style={{ ...DISPLAY, color: tone }}>{v}</div>
    </div>
  );
}

/** A fixed-height flip card: hover (or tap) turns it to show the back; the status
 *  dot and the ⋯ menu stay put underneath, so every card in the grid is the same size. */
function MiniCard({ card: c, accent, flipped, busy, confirming, locked, onFlip, onEdit, onPublish, onAskDelete, onCancelDelete, onDelete }: {
  card: Card; accent: string; flipped: boolean; busy: boolean; confirming: boolean; locked: "view" | "head-office" | null;
  onFlip: () => void; onEdit: () => void; onPublish: () => void; onAskDelete: () => void; onCancelDelete: () => void; onDelete: () => void;
}) {
  const face = "absolute inset-0 flex flex-col rounded-xl px-3.5 py-3";
  const hide = { backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" } as const;
  return (
    <div data-ui="card" data-card={c.id} data-published={c.published}
      className={`group flex h-[176px] flex-col rounded-2xl border bg-[var(--surface)] p-1.5 shadow-[var(--shadow-sm)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow)] motion-reduce:transition-none motion-reduce:hover:transform-none ${c.published ? "border-[var(--line)]" : "border-dashed border-[var(--gold-line)]"}`}>
      <div className="min-h-0 flex-1 [perspective:900px]">
        <button type="button" aria-label={flipped ? "Show the front" : "Show the back"} aria-pressed={flipped} onClick={onFlip}
          className={`relative block h-full w-full rounded-xl text-left transition-transform duration-500 ease-out motion-reduce:transition-none ${FOCUS} ${flipped ? "" : "[@media(hover:hover)]:group-hover:[transform:rotateY(180deg)]"}`}
          style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : undefined }}>
          <span className={`${face} bg-[var(--panel)]`} style={{ ...hide, boxShadow: `inset 3px 0 0 ${accent}` }}>
            <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--ink-3)]">Front</span>
            <span className="mt-1 line-clamp-4 block whitespace-pre-wrap break-words text-[13.5px] font-extrabold leading-snug text-[var(--ink)]">{c.front}</span>
            <Ico name="refresh" size={14} className="absolute bottom-2.5 right-3 text-[var(--ink-3)] opacity-60" />
          </span>
          <span className={`${face} text-white`} style={{ ...hide, transform: "rotateY(180deg)", background: "linear-gradient(140deg, var(--brand-2), var(--brand))" }}>
            <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-white/75">Back</span>
            <span className="mt-1 line-clamp-4 block whitespace-pre-wrap break-words text-[13.5px] font-semibold leading-snug">{c.back}</span>
          </span>
        </button>
      </div>
      <div className="flex min-h-[44px] items-center gap-2 pl-2">
        <span className={`inline-flex items-center gap-1.5 text-[11.5px] font-bold ${c.published ? "text-[var(--hub-green-ink)]" : "text-[var(--ink-3)]"}`}>
          <span aria-hidden className={`h-2 w-2 rounded-full ${c.published ? "bg-[var(--green)]" : "border-2 border-[var(--gold)] bg-transparent"}`} />
          {c.published ? "Published" : "Draft"}
        </span>
        {locked === "head-office" && <span className="ml-auto pr-2 text-[11px] font-bold text-[var(--ink-3)]" title="Head office owns this card — you can't change it.">Head office</span>}
        {!locked && <span className="ml-auto">
          <MoreMenu label="Card actions">
            {(close) => confirming ? (
              <div className="grid gap-1 p-1">
                <div className="px-2 pt-1 text-[12px] font-bold text-[var(--ink-2)]">Delete this card?</div>
                <button type="button" disabled={busy} onClick={() => { close(); onDelete(); }} className={`min-h-[44px] rounded-lg bg-[var(--red)] px-3 text-[13px] font-extrabold text-white ${FOCUS}`}>{busy ? "Deleting…" : "Yes, delete"}</button>
                <button type="button" onClick={() => { onCancelDelete(); close(); }} className={`min-h-[44px] rounded-lg px-3 text-[13px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)] ${FOCUS}`}>Keep it</button>
              </div>
            ) : (
              <>
                <MenuItem icon="edit" onClick={() => { close(); onEdit(); }}>Edit card</MenuItem>
                <MenuItem icon={c.published ? "eye" : "check"} disabled={busy} onClick={() => { close(); onPublish(); }}>{c.published ? "Unpublish (make draft)" : "Publish"}</MenuItem>
                <MenuItem icon="trash" tone="danger" onClick={onAskDelete}>Delete card…</MenuItem>
              </>
            )}
          </MoreMenu>
        </span>}
      </div>
    </div>
  );
}
