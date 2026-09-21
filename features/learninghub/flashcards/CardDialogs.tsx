"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Button, FieldLabel, Select } from "@/components/ui";
import { get, post, put } from "@/lib/api";
import { canChangeRow, errMsg, topicLabel, type Topic } from "../types";
import { CreatorTabs, DiscardStrip, ExistingPicker, type ExistingPage, type ExistingQuery } from "../EditExisting";
import { NewTopicInline, useTopicsWithNew } from "../NewTopicInline";
import { Dialog, FOCUS, Notice, Pill, withQs } from "../teachKit";
import { parseBulk, type Card } from "./fcTypes";

// Tutor: add/edit one card, or paste many ("front | back", one per line).

const areaCls = "w-full resize-y rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-[13.5px] leading-relaxed text-[var(--ink)] outline-none focus:border-[var(--brand)]";

function TopicSelect({ id, topics, value, onChange }: { id: string; topics: Topic[]; value: string; onChange: (v: string) => void }) {
  const sorted = useMemo(() => [...topics].sort((a, b) => topicLabel(a).localeCompare(topicLabel(b))), [topics]);
  return (
    <Select id={id} className="min-h-[44px] w-full" value={value} onChange={(e) => onChange(e.target.value)}>
      {sorted.map((t) => <option key={t.id} value={t.id}>{topicLabel(t)}</option>)}
    </Select>
  );
}

export function CardDialog({ card, topics: topicsProp, defaultTopicId, qs, onClose, onSaved, onOpenOther, onStartNew, franchiseId = null }: {
  card: Card | null; topics: Topic[]; defaultTopicId: string; qs: string; onClose: () => void; onSaved: (more: boolean) => void;
  /** "Edit existing" tab: swap this dialog over to another card. Without it the tab strip is not shown. */
  onOpenOther?: (c: Card) => void;
  /** "New" tab while editing a card: swap to a blank dialog. */
  onStartNew?: () => void;
  franchiseId?: string | null;
}) {
  const [topics, rememberTopic] = useTopicsWithNew(topicsProp);
  const [topicId, setTopicId] = useState(card?.topicId ?? defaultTopicId);
  const [front, setFront] = useState(card?.front ?? "");
  const [back, setBack] = useState(card?.back ?? "");
  const [published, setPublished] = useState(card?.published ?? true);
  const [busy, setBusy] = useState<"one" | "more" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const ok = !!topicId && !!front.trim() && !!back.trim();
  const [picking, setPicking] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);
  const dirty = front !== (card?.front ?? "") || back !== (card?.back ?? "") || topicId !== (card?.topicId ?? defaultTopicId) || published !== (card?.published ?? true);
  const cardCache = useRef(new Map<string, Card>());
  const fetchExisting = useCallback(async (x: ExistingQuery): Promise<ExistingPage> => {
    const r = await get<{ items: Card[]; total: number; nextCursor: string | null }>(`/api/learning-hub/flashcards${withQs(qs, { limit: "20", sort: "topic", cursor: x.cursor, ...(x.topicId ? { topicId: x.topicId } : x.subject ? { subject: x.subject } : {}), q: x.q || null })}`);
    for (const c of r.items) cardCache.current.set(c.id, c);
    return { rows: r.items.map((c) => ({ id: c.id, title: c.front.length > 90 ? `${c.front.slice(0, 90)}…` : c.front, topicId: c.topicId, draft: !c.published, meta: `Back: ${c.back.length > 50 ? `${c.back.slice(0, 50)}…` : c.back}${canChangeRow(franchiseId, c.franchiseId) ? "" : " · From head office (read-only)"}` })), total: r.total, next: r.nextCursor };
  }, [qs, franchiseId]);
  const pickExisting = async (row: { id: string }) => {
    const c = cardCache.current.get(row.id);
    if (!c) throw new Error("Couldn't open that card");
    if (!canChangeRow(franchiseId, c.franchiseId)) throw new Error("Head office owns that card, so you can't edit it.");
    onOpenOther?.(c);
  };
  const onTab = (m: "new" | "existing") => {
    if (m === "existing") { setPicking(true); return; }
    if (card) { if (dirty) setConfirmNew(true); else onStartNew?.(); return; }
    setPicking(false);
  };

  const save = async (more: boolean) => {
    if (!ok) { setErr("Add a topic, a front and a back."); return; }
    setBusy(more ? "more" : "one"); setErr(null);
    const body = { topicId, front: front.trim(), back: back.trim(), published };
    try {
      if (card) await put(`/api/learning-hub/flashcards/${card.id}${qs}`, body);
      else await post(`/api/learning-hub/flashcards${qs}`, body);
      if (more) { setFront(""); setBack(""); setBusy(null); onSaved(true); } else onSaved(false);
    } catch (e) { setErr(errMsg(e, "Couldn't save the card")); setBusy(null); }
  };

  return (
    <Dialog id="hub-card-dialog" title={card ? "Edit card" : "New flashcard"} subtitle="Keep the front short — one question, term or prompt." onClose={onClose}
      footer={<>
        <Button variant="ghost" className={`min-h-[44px] ${FOCUS}`} onClick={onClose}>Cancel</Button>
        {!card && <Button variant="ghost" className={`min-h-[44px] ${FOCUS}`} disabled={!!busy || !ok || picking} onClick={() => void save(true)}>{busy === "more" ? "Saving…" : "Save & add another"}</Button>}
        <Button variant="solid" className={`min-h-[44px] ${FOCUS}`} disabled={!!busy || !ok || picking} onClick={() => void save(false)}>{busy === "one" ? "Saving…" : card ? "Save changes" : "Save card"}</Button>
      </>}>
      <div className="grid gap-4">
        {err && <Notice onClose={() => setErr(null)}>{err}</Notice>}
        {onOpenOther && <CreatorTabs mode={picking || card ? "existing" : "new"} onChange={onTab} noun="Flashcard" />}
        {confirmNew && <DiscardStrip message="Start a new card? Your unsaved changes to this one will be lost." confirmLabel="Discard and start new" onKeep={() => setConfirmNew(false)} onConfirm={() => onStartNew?.()} testId="edit-existing-confirm-new" />}
        {picking && onOpenOther ? (
          <ExistingPicker noun="flashcard" topics={topics} fetchPage={fetchExisting} onPick={pickExisting} guard={dirty ? "You have unsaved changes on this card." : null} />
        ) : (<>
        <div><FieldLabel htmlFor="hub-card-topic">Topic</FieldLabel><TopicSelect id="hub-card-topic" topics={topics} value={topicId} onChange={setTopicId} />
          <NewTopicInline qs={qs} topics={topics} subject={topics.find((t) => t.id === topicId)?.subject} testId="card-new-topic" onCreated={(t) => { rememberTopic(t); setTopicId(t.id); }} /></div>
        <div><FieldLabel htmlFor="hub-card-front">Front (question)</FieldLabel><textarea id="hub-card-front" data-autofocus rows={3} maxLength={1000} className={areaCls} value={front} onChange={(e) => setFront(e.target.value)} placeholder="e.g. What is the quadratic formula?" /></div>
        <div><FieldLabel htmlFor="hub-card-back">Back (answer)</FieldLabel><textarea id="hub-card-back" rows={4} maxLength={2000} className={areaCls} value={back} onChange={(e) => setBack(e.target.value)} placeholder="e.g. x = (−b ± √(b² − 4ac)) / 2a" /></div>
        <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 text-[13px] font-semibold text-[var(--ink)]">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />
          Published — students can see and review it
        </label>
        </>)}
      </div>
    </Dialog>
  );
}

export function BulkDialog({ topics: topicsProp, defaultTopicId, qs, onClose, onSaved }: { topics: Topic[]; defaultTopicId: string; qs: string; onClose: () => void; onSaved: () => void }) {
  const [topics, rememberTopic] = useTopicsWithNew(topicsProp);
  const [topicId, setTopicId] = useState(defaultTopicId);
  const [text, setText] = useState("");
  const [published, setPublished] = useState(true);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const parsed = useMemo(() => parseBulk(text), [text]);
  const busy = !!progress;

  const run = async () => {
    if (!parsed.cards.length || !topicId) return;
    setErr(null);
    const list = parsed.cards.slice(0, 200);
    setProgress({ done: 0, total: list.length });
    let done = 0;
    const failed: string[] = [];
    // A few at a time: gentle on the API, quick enough for a pasted list.
    for (let i = 0; i < list.length; i += 4) {
      await Promise.all(list.slice(i, i + 4).map((c) =>
        post(`/api/learning-hub/flashcards${qs}`, { topicId, front: c.front, back: c.back, published })
          .then(() => { done++; })
          .catch((e) => { failed.push(`"${c.front.slice(0, 24)}": ${errMsg(e, "failed")}`); })
          .finally(() => setProgress({ done: done + failed.length, total: list.length }))));
    }
    if (failed.length) { setErr(`${done} added, ${failed.length} failed — ${failed[0]}`); setProgress(null); if (done) onSaved(); return; }
    onSaved();
  };

  return (
    <Dialog id="hub-bulk-dialog" size="lg" title="Add many cards" subtitle={<>One card per line: <code className="rounded bg-[var(--panel)] px-1">front | back</code></>} onClose={onClose}
      footer={<>
        <Button variant="ghost" className={`min-h-[44px] ${FOCUS}`} onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="solid" className={`min-h-[44px] ${FOCUS}`} disabled={busy || !parsed.cards.length || !topicId} onClick={() => void run()}>{busy ? `Adding ${progress!.done}/${progress!.total}…` : `Add ${parsed.cards.length || ""} card${parsed.cards.length === 1 ? "" : "s"}`}</Button>
      </>}>
      <div className="grid gap-4">
        {err && <Notice onClose={() => setErr(null)}>{err}</Notice>}
        <div><FieldLabel htmlFor="hub-bulk-topic">Topic</FieldLabel><TopicSelect id="hub-bulk-topic" topics={topics} value={topicId} onChange={setTopicId} />
          <NewTopicInline qs={qs} topics={topics} subject={topics.find((t) => t.id === topicId)?.subject} testId="bulk-new-topic" onCreated={(t) => { rememberTopic(t); setTopicId(t.id); }} /></div>
        <div>
          <FieldLabel htmlFor="hub-bulk-text">Paste your cards</FieldLabel>
          <textarea id="hub-bulk-text" data-autofocus rows={10} className={`${areaCls} font-mono text-[12.5px]`} value={text} onChange={(e) => setText(e.target.value)} disabled={busy}
            placeholder={"Capital of France | Paris\nSquare root of 144 | 12\nH₂O is | Water"} />
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]" aria-live="polite">
            <Pill tone={parsed.cards.length ? "green" : "neutral"}>{parsed.cards.length} card{parsed.cards.length === 1 ? "" : "s"} ready</Pill>
            {parsed.bad.length > 0 && <Pill tone="gold">Line{parsed.bad.length === 1 ? "" : "s"} {parsed.bad.slice(0, 5).join(", ")}{parsed.bad.length > 5 ? "…" : ""} need a &ldquo;|&rdquo; between front and back</Pill>}
            {parsed.cards.length > 200 && <Pill tone="red">Only the first 200 will be added</Pill>}
          </div>
        </div>
        {parsed.cards.length > 0 && (
          <div className="max-h-[150px] overflow-y-auto rounded-xl border border-[var(--line)]">
            {parsed.cards.slice(0, 6).map((c, i) => (
              <div key={i} className="grid grid-cols-2 gap-3 border-b border-[var(--line)] px-3 py-2 text-[12.5px] last:border-b-0"><span className="truncate font-bold text-[var(--ink)]">{c.front}</span><span className="truncate text-[var(--ink-2)]">{c.back}</span></div>
            ))}
            {parsed.cards.length > 6 && <div className="px-3 py-1.5 text-[11.5px] text-[var(--ink-3)]">…and {parsed.cards.length - 6} more</div>}
          </div>
        )}
        <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 text-[13px] font-semibold text-[var(--ink)]">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} disabled={busy} className="h-4 w-4 accent-[var(--brand)]" />
          Publish immediately
        </label>
      </div>
    </Dialog>
  );
}
