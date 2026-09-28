"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Input } from "@/components/ui";
import { del, get, post, put } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import type { PanelProps } from "../panelTypes";
import { canChangeRow, errMsg, topicLabel } from "../types";
import { DISPLAY, EmptyState, FOCUS, MenuItem, MoreMenu, Notice, Pill, ProgressBar, Skeleton, fmtDay, useCountUp, withQs } from "../teachKit";
import { useI18n } from "@/lib/i18n/provider";
import { pickPlural } from "@/lib/i18n/plural";
import { GradientTile, Ico } from "../teachIcons";
import { subjectColor } from "../kit";
import { subjectSwatch } from "../subjectColour";
import { YearGroupPicker } from "../YearGroupPicker";
import { BulkDialog, CardDialog } from "./CardDialogs";
import { StudentRings } from "./StudentRings";
import type { Card, FlashStats } from "./fcTypes";

// Tutor flashcards: a card bank per topic (create / edit / delete / publish,
// bulk paste) and how the students are getting on (server stats).

export function TutorFlashcards({ qs, topics, covered, filter, onError, readOnly, franchiseId, goTo }: PanelProps) {
  const { t: tr, locale } = useI18n();
  const [cards, setCards] = useState<Card[] | null>(null);
  const [stats, setStats] = useState<FlashStats | null>(null);
  const [q, setQ] = useState("");
  const [dialog, setDialog] = useState<{ kind: "card"; card: Card | null; topicId: string } | { kind: "bulk"; topicId: string } | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [flipped, setFlipped] = useState<Set<string>>(new Set());
  const [allStudents, setAllStudents] = useState(false);
  // The library holds tens of thousands of cards, so it is narrowed here by subject and school year (sent to the server, not filtered on screen).
  const [subjectSel, setSubjectSel] = useState<string | null>(null);
  const [yearsSel, setYearsSel] = useState<number[]>([]);
  // A save that forked a head-office (shared-library) card into the tutor's own copy — the dialog
  // closes right away, so the confirmation lives here.
  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => { if (!flash) return; const timer = setTimeout(() => setFlash(null), 5000); return () => clearTimeout(timer); }, [flash]);
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
  useEffect(() => { const timer = setTimeout(() => setDq(q.trim()), 250); return () => clearTimeout(timer); }, [q]);
  const subjectQ = subjectSel ?? filter.subject ?? null;
  const listPath = useCallback((cursor: string | null, limit: number) =>
    `/api/learning-hub/flashcards${withQs(qs, { limit: String(limit), sort: "topic", cursor, ...(filter.topicId ? { topicId: filter.topicId } : subjectQ ? { subject: subjectQ } : {}), ...(yearsSel.length ? { year: yearsSel.join(",") } : {}), q: dq || null })}`, [qs, filter.topicId, subjectQ, yearsSel, dq]);
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
      .catch((e) => { if (mounted.current && mine === seq.current) { setCards((c) => c ?? []); onError(errMsg(e, tr("hublessons.tfCouldntLoad"))); } })
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
      if (list.length === 1) {
        const r = await put<{ forked?: boolean }>(`/api/learning-hub/flashcards/${list[0]!.id}${withQs(qs, {})}`, { published });
        if (r.forked) setFlash(tr("hublessons.tfForkedPublish"));
      }
      else await post(`/api/learning-hub/flashcards/publish${withQs(qs, {})}`, { ids: list.map((c) => c.id), published });
      load();
    }
    catch (e) { onError(errMsg(e, tr("hublessons.tfCouldntUpdate"))); }
    finally { setBusy(null); }
  };
  const remove = async (c: Card) => {
    setBusy(c.id);
    try { await del(`/api/learning-hub/flashcards/${c.id}${withQs(qs, {})}`); setConfirmDel(null); load(); }
    catch (e) { onError(errMsg(e, tr("hublessons.tfCouldntDelete"))); }
    finally { setBusy(null); }
  };

  if (cards === null) return <div className="grid gap-3" aria-busy="true" aria-label={tr("hublessons.fcLoadingAria")}><Skeleton className="h-[84px]" /><Skeleton className="h-[120px]" /><Skeleton className="h-[120px]" /></div>;

  const noTopics = topics.length === 0;
  const total = stats?.totalCards ?? cards.length;
  const published = stats?.publishedCards ?? cards.filter((c) => c.published).length;
  const shown = [...byTopic.values()].reduce((n, l) => n + l.length, 0);
  const addBtns = readOnly ? null : (
    <div className="flex flex-wrap gap-2">
      <Button variant="solid" id="hub-add-card" className={`min-h-[44px] gap-2 ${FOCUS}`} disabled={noTopics} onClick={() => setDialog({ kind: "card", card: null, topicId: defaultTopic })}><Ico name="plus" size={16} strokeWidth={2.4} />{tr("hublessons.tfAdd")}</Button>
      <Button variant="ghost" id="hub-bulk-cards" className={`min-h-[44px] gap-2 ${FOCUS}`} disabled={noTopics} onClick={() => setDialog({ kind: "bulk", topicId: defaultTopic })}><Ico name="inbox" size={16} />{tr("hublessons.tfPasteMany")}</Button>
    </div>
  );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4" id="hub-flashcards">
      {flash && <Notice tone="green" onClose={() => setFlash(null)}>{flash}</Notice>}
      <div className="flex flex-wrap items-center gap-3">
        <GradientTile icon="cards" size={44} />
        <div className="min-w-0 flex-1 basis-[200px]">
          <h2 className="m-0 text-[19px] font-extrabold text-[var(--ink)]" style={DISPLAY}>{tr("hublessons.fcaTitle")}</h2>
          <p className="text-[12.5px] text-[var(--ink-3)]">{tr("hublessons.tfTagline")}</p>
        </div>
        {addBtns}
      </div>

      {noTopics ? (
        <EmptyState icon={<Ico name="folder" size={26} />} title={tr("hublessons.tfAddTopicTitle")} body={tr("hublessons.tfAddTopicBody")} />
      ) : total === 0 ? (
        <EmptyState icon={<Ico name="cards" size={26} />} title={tr("hublessons.tfFirstTitle")} body={tr("hublessons.tfFirstBody")} action={addBtns} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {[
              { label: tr("hublessons.tfStatCards"), value: total, tone: "var(--brand-2)" },
              { label: tr("hublessons.npPublished"), value: published, tone: "var(--green)" },
              { label: tr("hublessons.tfStatDrafts"), value: Math.max(0, total - published), tone: "var(--gold)" },
              { label: tr("hublessons.tfStatDue"), value: (stats?.students ?? []).reduce((n, s) => n + s.due, 0), tone: "var(--brand)" },
            ].map((t) => <StatTile key={t.label} {...t} />)}
          </div>

          {stats && stats.students.length > 0 && <StudentRings students={stats.students} goTo={goTo} />}

          <div className="flex flex-wrap items-center gap-2" data-testid="fc-filters">
            <div role="group" aria-label={tr("hubshell.k_subject")} className="flex flex-wrap gap-1.5">
              {[null, ...[...new Set(topics.map((t) => t.subject))].sort((a, b) => a.localeCompare(b))].map((sb) => {
                const on = (subjectSel ?? null) === sb;
                return (
                  <button key={sb ?? "all"} type="button" aria-pressed={on} onClick={() => setSubjectSel(sb)} data-testid={`fc-subject-${sb ?? "all"}`}
                    className={`min-h-[44px] lg:min-h-[36px] rounded-full border px-3.5 text-[13px] font-bold transition ${FOCUS} ${on ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)]"}`}>
                    {sb ?? tr("hubshell.k_allSubjects")}
                  </button>
                );
              })}
            </div>
            <YearGroupPicker years={yearsSel} onChange={setYearsSel} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input aria-label={tr("hublessons.tfSearchAria")} className="min-h-[44px] min-w-[200px] flex-1" placeholder={tr("hublessons.tfSearchPh")} value={q} onChange={(e) => setQ(e.target.value)} />
            <span className="text-[12px] text-[var(--ink-3)]">{pickPlural(tr, locale, filter.subject || filter.topicId || subjectSel || yearsSel.length ? "hublessons.tfCardsInTopic" : "hublessons.tfCardsTotal", listTotal || shown)}</span>
          </div>

          {shown === 0 ? (
            <p className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-8 text-center text-[13px] text-[var(--ink-3)]">{needle ? tr("hublessons.tfNoMatch") : tr("hublessons.tfNoneInTopic")}</p>
          ) : sortedTopics.filter((t) => byTopic.has(t.id)).map((t) => {
            const list = byTopic.get(t.id)!;
            // Head office's cards are the franchise's to use, not to change.
            const drafts = list.filter((c) => !c.published && canChangeRow(franchiseId, c.franchiseId));
            return (
              <section key={t.id} aria-label={topicLabel(t)} data-topic={t.id} className="grid gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="m-0 min-w-0 truncate text-[14px] font-extrabold text-[var(--brand-strong)]" style={DISPLAY}>{topicLabel(t)}</h3>
                  <Pill tone="brand">{list.length}</Pill>
                  <div className="ms-auto flex flex-wrap gap-1.5">
                    {!readOnly && drafts.length > 0 && <Button variant="ghost" className={`min-h-[44px] ${FOCUS}`} disabled={busy === "many"} onClick={() => void setPublished(drafts, true)}>{pickPlural(tr, locale, "hublessons.tfPublishDrafts", drafts.length)}</Button>}
                    {!readOnly && <Button variant="ghost" className={`min-h-[44px] gap-1.5 ${FOCUS}`} onClick={() => setDialog({ kind: "card", card: null, topicId: t.id })}><Ico name="plus" size={14} strokeWidth={2.4} />{tr("hublessons.tfCardBtn")}</Button>}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {list.map((c, i) => (
                    <MiniCard key={c.id} card={c} index={i + 1} subject={t.subject} accent={subjectColor(t.subject)} flipped={flipped.has(c.id)} busy={busy === c.id} confirming={confirmDel === c.id} locked={readOnly ? "view" : canChangeRow(franchiseId, c.franchiseId) ? null : "head-office"}
                      onFlip={() => setFlipped((st) => { const n = new Set(st); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; })}
                      onEdit={() => setDialog({ kind: "card", card: c, topicId: c.topicId })}
                      onPublish={() => void setPublished([c], !c.published)}
                      onAskDelete={() => setConfirmDel(c.id)} onCancelDelete={() => setConfirmDel(null)} onDelete={() => void remove(c)} />
                  ))}
                </div>
              </section>
            );
          })}
          {next && <div className="flex justify-center"><Button onClick={() => loadCards(true, next)} disabled={more} className={`min-h-[44px] !px-6 ${FOCUS}`}>{more ? tr("hublessons.edLoading") : tr("hublessons.edShowMore", { n: Math.max(0, listTotal - (cards?.length ?? 0)) })}</Button></div>}
        </>
      )}

      {dialog?.kind === "card" && (
        <CardDialog key={dialog.card?.id ?? "new"} card={dialog.card} topics={topics} defaultTopicId={dialog.topicId} qs={qs} franchiseId={franchiseId} onClose={() => setDialog(null)}
          onOpenOther={readOnly ? undefined : (c) => setDialog({ kind: "card", card: c, topicId: c.topicId })} onStartNew={() => setDialog({ kind: "card", card: null, topicId: defaultTopic })}
          onSaved={(more, forked) => { load(); if (!more) setDialog(null); if (forked) setFlash(tr("hublessons.tfForkedSave")); }} />
      )}
      {dialog?.kind === "bulk" && <BulkDialog topics={topics} defaultTopicId={dialog.topicId} qs={qs} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); load(); }} />}
    </div>
  );
}

function StatTile({ label, value, tone }: { label: string; value: number; tone: string }) {
  const v = useCountUp(value, 600);
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 ps-4 shadow-[var(--shadow-sm)]">
      <div className="absolute bottom-3 start-0 top-3 w-[3px] rounded-e" style={{ background: tone }} />
      <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]">{label}</div>
      <div className="mt-1 text-[26px] font-extrabold leading-none tabular-nums" style={{ ...DISPLAY, color: tone }}>{v}</div>
    </div>
  );
}

const cardEmoji = (subject: string) =>
  /math/i.test(subject) ? "🧮" : /engl|lit|read|writ/i.test(subject) ? "📖" : /sci|bio|chem|phys/i.test(subject) ? "🔬"
  : /french|german|spanish|lang|latin|welsh|urdu|arabic/i.test(subject) ? "🗣️" : /hist|geog|human|relig|citizen/i.test(subject) ? "🌍"
  : /comput|ict|code|data/i.test(subject) ? "💻" : /art|design/i.test(subject) ? "🎨" : /music/i.test(subject) ? "🎵" : "🃏";

/** A fixed-height flip card that looks like a real flashcard: a coloured paper face (the topic's subject colour,
 *  dotted like index-card stock), a deck of card edges behind it, an index badge and a status pill that stay put
 *  on both sides. Hover (or tap / Enter) turns it to show the back; the ⋯ menu stays underneath, so every card
 *  in the grid is the same size. */
function MiniCard({ card: c, index, subject, accent, flipped, busy, confirming, locked, onFlip, onEdit, onPublish, onAskDelete, onCancelDelete, onDelete }: {
  card: Card; index: number; subject: string; accent: string; flipped: boolean; busy: boolean; confirming: boolean; locked: "view" | "head-office" | null;
  onFlip: () => void; onEdit: () => void; onPublish: () => void; onAskDelete: () => void; onCancelDelete: () => void; onDelete: () => void;
}) {
  const { t: tr } = useI18n();
  const sw = subjectSwatch(subject);
  const face = "absolute inset-0 flex flex-col overflow-hidden rounded-xl px-4 pb-3 pt-9";
  const hide = { backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" } as const;
  const paper = { backgroundImage: `radial-gradient(color-mix(in srgb, ${accent} 24%, transparent) 1px, transparent 1.5px), linear-gradient(155deg, color-mix(in srgb, ${accent} 20%, var(--surface)), color-mix(in srgb, ${accent} 6%, var(--surface)))`, backgroundSize: "14px 14px, 100% 100%" };
  const emoji = cardEmoji(subject);
  return (
    <div data-ui="card" data-card={c.id} data-published={c.published} role="group" aria-label={`#${index}`} className="group relative pb-1 pe-1.5 pt-1">
      {/* the deck: two card edges peeking out behind */}
      <span aria-hidden className="pointer-events-none absolute inset-x-2 bottom-1 top-2 rounded-2xl border" style={{ background: `color-mix(in srgb, ${accent} 11%, var(--surface))`, borderColor: sw.ring, transform: "rotate(2.4deg)" }} />
      <span aria-hidden className="pointer-events-none absolute inset-x-1 bottom-0 top-1.5 rounded-2xl border" style={{ background: `color-mix(in srgb, ${accent} 16%, var(--surface))`, borderColor: sw.ring, transform: "rotate(-1.8deg)" }} />
      <div className={`relative flex h-[196px] flex-col rounded-2xl border bg-[var(--surface)] p-1.5 shadow-[0_10px_24px_-14px_color-mix(in_srgb,var(--ink)_45%,transparent)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_16px_30px_-14px_color-mix(in_srgb,var(--ink)_50%,transparent)] motion-reduce:transition-none motion-reduce:hover:transform-none ${c.published ? "" : "border-dashed"}`}
        style={{ borderColor: c.published ? sw.ring : "var(--gold-line)" }}>
        <div className="relative min-h-0 flex-1 [perspective:900px]">
          {/* badges live above the flipper so both faces keep them */}
          <span aria-hidden className="pointer-events-none absolute start-2.5 top-2.5 z-10 grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-[11px] font-extrabold tabular-nums text-white shadow-sm" style={{ background: accent }}>#{index}</span>
          <span className={`pointer-events-none absolute end-2.5 top-2.5 z-10 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-extrabold ${c.published ? "border-[var(--green-line,var(--line))] bg-[var(--green-soft,var(--surface))] text-[var(--hub-green-ink)]" : "border-[var(--gold-line)] bg-[var(--gold-soft,var(--surface))] text-[var(--ink-2)]"}`}>
            <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${c.published ? "bg-[var(--green)]" : "border border-[var(--gold)] bg-transparent"}`} />
            {c.published ? tr("hublessons.npPublished") : tr("hublessons.edDraft")}
          </span>
          <button type="button" aria-label={flipped ? tr("hublessons.tfShowFront") : tr("hublessons.tfShowBack")} aria-pressed={flipped} onClick={onFlip} title={`${c.front}\n—\n${c.back}`}
            className={`relative block h-full w-full rounded-xl text-start transition-transform duration-500 ease-out motion-reduce:transition-none ${FOCUS} ${flipped ? "" : "[@media(hover:hover)]:group-hover:[transform:rotateY(180deg)]"}`}
            style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : undefined }}>
            <span className={face} style={{ ...hide, ...paper, boxShadow: `inset 0 1px 0 color-mix(in srgb, #fff 55%, transparent), inset 0 0 0 1px ${sw.ring}` }}>
              <span aria-hidden className="pointer-events-none absolute -bottom-3 -end-2 select-none text-[76px] leading-none opacity-[0.16]">{emoji}</span>
              <span className="inline-flex w-fit items-center rounded-md px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.14em]" style={{ background: `color-mix(in srgb, ${accent} 16%, var(--surface))`, color: sw.fg }}>{tr("hublessons.tfFront")}</span>
              <span className="mt-1.5 line-clamp-4 block whitespace-pre-wrap break-words text-[16px] font-extrabold leading-snug" style={{ ...DISPLAY, color: "var(--ink)" }}>{c.front}</span>
              <span aria-hidden className="absolute bottom-2.5 start-3.5 opacity-70" style={{ color: sw.fg }}><Ico name="refresh" size={15} /></span>
            </span>
            <span className={`${face} text-white`} style={{ ...hide, transform: "rotateY(180deg)", backgroundImage: `radial-gradient(rgba(255,255,255,.22) 1px, transparent 1.5px), linear-gradient(145deg, ${accent}, color-mix(in srgb, ${accent} 68%, var(--ink)))`, backgroundSize: "14px 14px, 100% 100%" }}>
              <span aria-hidden className="pointer-events-none absolute -bottom-3 -end-2 select-none text-[76px] leading-none opacity-[0.18]">{emoji}</span>
              <span className="inline-flex w-fit items-center rounded-md bg-white/20 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-white">{tr("hublessons.tfBack")}</span>
              <span className="mt-1.5 line-clamp-4 block whitespace-pre-wrap break-words text-[15px] font-bold leading-snug">{c.back}</span>
            </span>
          </button>
        </div>
        <div className="flex min-h-[44px] items-center gap-2 ps-2">
          {locked === "head-office" && <span className="pe-2 text-[11px] font-bold text-[var(--ink-3)]" title={tr("hublessons.tfHeadOfficeTitle")}>{tr("hublessons.tfHeadOffice")}</span>}
        {!locked && <span className="ms-auto">
          <MoreMenu label={tr("hublessons.tfCardActions")}>
            {(close) => confirming ? (
              <div className="grid gap-1 p-1">
                <div className="px-2 pt-1 text-[12px] font-bold text-[var(--ink-2)]">{tr("hublessons.tfDeleteQ")}</div>
                <button type="button" disabled={busy} onClick={() => { close(); onDelete(); }} className={`min-h-[44px] rounded-lg bg-[var(--red)] px-3 text-[13px] font-extrabold text-white ${FOCUS}`}>{busy ? tr("hublessons.sdDeleting") : tr("hublessons.tfYesDelete")}</button>
                <button type="button" onClick={() => { onCancelDelete(); close(); }} className={`min-h-[44px] rounded-lg px-3 text-[13px] font-bold text-[var(--ink-2)] hover:bg-[var(--panel)] ${FOCUS}`}>{tr("hublessons.sdKeepIt")}</button>
              </div>
            ) : (
              <>
                <MenuItem icon="edit" onClick={() => { close(); onEdit(); }}>{tr("hublessons.tfEditCard")}</MenuItem>
                <MenuItem icon={c.published ? "eye" : "check"} disabled={busy} onClick={() => { close(); onPublish(); }}>{c.published ? tr("hublessons.tfUnpublish") : tr("hublessons.tfPublish")}</MenuItem>
                <MenuItem icon="trash" tone="danger" onClick={onAskDelete}>{tr("hublessons.tfDeleteCard")}</MenuItem>
              </>
            )}
          </MoreMenu>
        </span>}
        </div>
      </div>
    </div>
  );
}
