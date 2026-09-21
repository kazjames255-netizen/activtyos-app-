import { Router } from "express";
import { z } from "zod";
import { db } from "../../firebase";
import { canSee, canWriteRow, hubConfig, okId, registerTopicRef, requireEdit, resolveCtx, type EnrolledChild, type HubCtx } from "../../lib/hubCore";
import { buildQueue, isQuality, sm2, type SrsState } from "../../lib/hubSrs";
import { chunk, flashcardsCol, isParent, nowIso, parentChild, reviewsCol, tenantEnrolments, topicFamily, visibleTopic } from "./teachingCommon";
import { cardIndex, patchCard, tenantTopics as cachedTopics, topicRank, type CardRow } from "../../lib/hubIndex";
import { hubCached } from "../../lib/hubCache";
import { pingHub } from "../../lib/hubPing";

// Learning Hub — FLASHCARDS & SPACED REPETITION (milestone 7). Contract:
// docs/learning-hub.md → "Flashcards" and "Spaced repetition (SM-2)".
//
// A tutor writes cards per topic; each enrolled child then has their own review
// state per card (`hubFlashcardReviews`, id `${tenantId}__${childId}__${cardId}`).
// The interval maths is ALL server-side (lib/hubSrs.ts) — the browser sends only
// a quality (1 Again / 3 Hard / 4 Good / 5 Easy) and shows what comes back.
// A parent only ever reaches their own enrolled child's queue and reviews.

export const hubFlashcardsApi = Router();
registerTopicRef(flashcardsCol); // a topic can't be deleted while cards hang off it

interface CardDoc {
  tenantId: string; franchiseId: string | null; topicId: string; front: string; back: string; published: boolean;
  createdBy: string; createdByName: string; createdAt: string; updatedAt: string;
}
interface ReviewDoc {
  tenantId: string; franchiseId: string | null; childId: string; cardId: string; topicId: string; parentUid: string;
  easeFactor: number; intervalDays: number; repetitions: number; nextDueAt: string; lastQuality: number; lastReviewedAt: string;
  createdAt: string; updatedAt: string;
}
type Card = CardDoc & { id: string };
interface TopicLite { subject: string; franchiseId: string | null }

const MAX_CARDS = 20000;     // per tenant — a fully seeded curriculum is ~4,500; the queue reads a cached light index, not the cards
const SESSION_MAX = 50;      // cards handed to a child per fetch
const MASTERED_DAYS = 21;    // "mastered" in the tutor's stats = next review ≥ 3 weeks away
const reviewId = (tenantId: string, childId: string, cardId: string) => `${tenantId}__${childId}__${cardId}`;

const cardOut = (c: Card) => ({ id: c.id, topicId: c.topicId, front: c.front, back: c.back, published: c.published !== false, franchiseId: c.franchiseId ?? null, createdAt: c.createdAt, updatedAt: c.updatedAt });

const cardBody = z.object({
  topicId: z.string().min(1).max(100),
  front: z.string().trim().min(1).max(1000),
  back: z.string().trim().min(1).max(2000),
  published: z.boolean().default(true),
});

/** May THIS child study this card? Published; from head office or the child's own
 *  franchise; in a subject the child is enrolled for. */
function cardForChild(c: { published?: boolean; topicId: string; franchiseId?: string | null }, topics: Map<string, TopicLite>, kid: EnrolledChild): boolean {
  if (c.published === false) return false;
  const t = topics.get(c.topicId);
  if (!t) return false; // topic gone, or not this tenant's
  const f = c.franchiseId ?? null;
  if (f !== null && f !== (kid.franchiseId ?? null)) return false;
  return !kid.subjects.length || kid.subjects.some((s) => s.toLowerCase() === t.subject.toLowerCase());
}

async function tenantTopics(tenantId: string): Promise<Map<string, TopicLite & { topic: string; subtopic: string | null }>> {
  return new Map((await cachedTopics(tenantId)).map((t) => [t.id, { subject: t.subject, topic: t.topic, subtopic: t.subtopic ?? null, franchiseId: t.franchiseId ?? null }] as const));
}
/** Full card documents by id (one batched read). */
async function cardsById(ids: string[]): Promise<Card[]> {
  if (!ids.length) return [];
  const snaps = await db.getAll(...ids.map((id) => flashcardsCol.doc(id)));
  return snaps.filter((d) => d.exists).map((d) => ({ id: d.id, ...(d.data() as CardDoc) }));
}
const UNPAGED_MAX = 500;
const intQ = (v: unknown, dflt: number, max: number) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), max) : dflt; };

// ── Parent: the due queue ────────────────────────────────────────────────────
// GET /flashcards/due?childId=&topicId= → {due:[…due first, then new], dueCount, newCount, upcoming}
hubFlashcardsApi.get("/flashcards/due", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  if (!isParent(ctx)) { res.status(403).json({ error: "The study queue is a student's — open it from a family account" }); return; }
  const kid = parentChild(ctx, res);
  if (!kid) return;
  const topicId = typeof req.query.topicId === "string" && req.query.topicId ? req.query.topicId : null;
  let family: Set<string> | null = null;
  if (topicId) {
    if (!(await visibleTopic(ctx, topicId))) { res.status(404).json({ error: "Topic not found" }); return; }
    family = await topicFamily(ctx.tenantId, topicId);
  }
  // The queue is worked out from the cached LIGHT card index (id, topic, scope, published, created) + this child's review
  // rows; only the ≤50 cards actually handed over are read in full (front/back) — never all ~4,500 of them.
  const [topics, index, revSnap] = await Promise.all([
    tenantTopics(ctx.tenantId), cardIndex(ctx.tenantId),
    reviewsCol.where("tenantId", "==", ctx.tenantId).where("childId", "==", kid.childId).select("cardId", "nextDueAt").get(),
  ]);
  const mine = [...index.values()].filter((c) => (!family || family.has(c.topicId)) && cardForChild(c, topics, kid));
  const reviews = new Map(revSnap.docs.map((d) => [d.get("cardId") as string, { cardId: d.get("cardId") as string, nextDueAt: d.get("nextDueAt") as string }]));
  mine.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const q = buildQueue(mine, reviews, new Date());
  const pick = [...q.due.map((c) => ({ c, isNew: false })), ...q.fresh.map((c) => ({ c, isNew: true }))].slice(0, SESSION_MAX);
  const full = new Map((await cardsById(pick.map((x) => x.c.id))).map((c) => [c.id, c] as const));
  const list = pick.filter(({ c }) => full.has(c.id)).map(({ c, isNew }) => ({ c: full.get(c.id)!, isNew }));
  res.json({
    due: list.map(({ c, isNew }) => ({ id: c.id, topicId: c.topicId, front: c.front, back: c.back, isNew })),
    dueCount: q.due.length, newCount: q.fresh.length, upcoming: q.upcoming,
  });
});

// POST /flashcards/:id/review {childId, quality} → {nextDueAt, intervalDays, …}
hubFlashcardsApi.post("/flashcards/:id/review", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx) return;
  if (!isParent(ctx)) { res.status(403).json({ error: "Only a student's family reviews their cards" }); return; }
  const body = (req.body ?? {}) as { childId?: unknown; quality?: unknown };
  const kid = parentChild(ctx, res, body.childId);
  if (!kid) return;
  if (!isQuality(body.quality)) { res.status(400).json({ error: "quality must be 1 (Again), 3 (Hard), 4 (Good) or 5 (Easy)" }); return; }
  if (!okId(req.params.id)) { res.status(404).json({ error: "Card not found" }); return; }
  const cs = await flashcardsCol.doc(req.params.id).get();
  if (!cs.exists || cs.get("tenantId") !== ctx.tenantId) { res.status(404).json({ error: "Card not found" }); return; }
  const card = { id: cs.id, ...(cs.data() as CardDoc) };
  const topics = await tenantTopics(ctx.tenantId);
  if (!cardForChild(card, topics, kid)) { res.status(404).json({ error: "Card not found" }); return; }
  const cfg = await hubConfig(ctx.tenantId, kid.franchiseId);
  const ref = reviewsCol.doc(reviewId(ctx.tenantId, kid.childId, card.id));
  const quality = body.quality;
  // Transactional: a double-tap can't apply one review twice from the same starting state.
  const out = await db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    const prev: SrsState | null = s.exists ? { easeFactor: Number(s.get("easeFactor")) || 2.5, intervalDays: Number(s.get("intervalDays")) || 0, repetitions: Number(s.get("repetitions")) || 0 } : null;
    const now = nowIso();
    // A card that isn't due yet keeps its schedule: repeat reviews (a double-tap, or
    // cramming the same card) must not stretch its interval or inflate "mastered".
    if (s.exists && String(s.get("nextDueAt") ?? "") > now) {
      return { nextDueAt: s.get("nextDueAt") as string, intervalDays: prev!.intervalDays, easeFactor: prev!.easeFactor, repetitions: prev!.repetitions, lastQuality: quality, lastReviewedAt: now };
    }
    const r = sm2(prev, quality, cfg.srsMinEase, new Date());
    const doc: ReviewDoc = {
      tenantId: ctx.tenantId, franchiseId: kid.franchiseId ?? null, childId: kid.childId, cardId: card.id, topicId: card.topicId, parentUid: ctx.uid,
      easeFactor: r.easeFactor, intervalDays: r.intervalDays, repetitions: r.repetitions, nextDueAt: r.nextDueAt, lastQuality: r.lastQuality, lastReviewedAt: r.lastReviewedAt,
      createdAt: s.exists ? (s.get("createdAt") as string) : now, updatedAt: now,
    };
    tx.set(ref, doc);
    return r;
  });
  res.json({ nextDueAt: out.nextDueAt, intervalDays: out.intervalDays, easeFactor: out.easeFactor, repetitions: out.repetitions });
});

// ── Tutor: stats, list, CRUD ─────────────────────────────────────────────────
// GET /flashcards/stats → {totalCards, publishedCards, topics[], students[]}
hubFlashcardsApi.get("/flashcards/stats", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  type RevLite = { childId: string; cardId: string; nextDueAt: string; intervalDays: number; lastReviewedAt: string };
  const [topics, index, students, revs] = await Promise.all([
    tenantTopics(ctx.tenantId), cardIndex(ctx.tenantId), tenantEnrolments(ctx),
    // Only the five fields the stats use, cached for a few seconds (a tenant's review rows grow with students × cards studied).
    hubCached("reviews", ctx.tenantId, "", 20_000, async () =>
      (await reviewsCol.where("tenantId", "==", ctx.tenantId).select("childId", "cardId", "nextDueAt", "intervalDays", "lastReviewedAt").get()).docs.map((d) => d.data() as RevLite)),
  ]);
  const cards = [...index.values()].filter((c) => canSee(ctx, c.franchiseId));
  const byTopic = new Map<string, number>();
  for (const c of cards) byTopic.set(c.topicId, (byTopic.get(c.topicId) ?? 0) + 1);
  const revByChild = new Map<string, RevLite[]>();
  for (const r of revs) { const l = revByChild.get(r.childId); if (l) l.push(r); else revByChild.set(r.childId, [r]); }
  const nowIsoStr = nowIso();
  const rows = [...students.values()].filter((e) => e.active !== false).map((e) => {
    const kid: EnrolledChild = { childId: e.childId, childName: e.childName, franchiseId: e.franchiseId ?? null, subjects: e.subjects ?? [] };
    const avail = cards.filter((c) => cardForChild(c, topics, kid));
    const availIds = new Set(avail.map((c) => c.id));
    const rev = (revByChild.get(e.childId) ?? []).filter((r) => availIds.has(r.cardId));
    return {
      childId: e.childId, childName: e.childName, cardsAvailable: avail.length, reviewed: rev.length,
      due: rev.filter((r) => r.nextDueAt <= nowIsoStr).length, new: avail.length - rev.length,
      mastered: rev.filter((r) => r.intervalDays >= MASTERED_DAYS).length,
      lastReviewedAt: rev.map((r) => r.lastReviewedAt).sort().pop() ?? null,
    };
  }).sort((a, b) => a.childName.localeCompare(b.childName));
  res.json({
    totalCards: cards.length, publishedCards: cards.filter((c) => c.published !== false).length,
    topics: [...byTopic].map(([topicId, n]) => { const t = topics.get(topicId); return { topicId, subject: t?.subject ?? "", topic: t?.topic ?? "", subtopic: t?.subtopic ?? null, cards: n }; })
      .sort((a, b) => a.subject.localeCompare(b.subject) || a.topic.localeCompare(b.topic) || (a.subtopic ?? "").localeCompare(b.subtopic ?? "")),
    students: rows,
  });
});

// GET /flashcards?topicId= — the tutor's deck (drafts included); a topic id also pulls in its subtopics.
hubFlashcardsApi.get("/flashcards", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const topicId = typeof req.query.topicId === "string" && req.query.topicId ? req.query.topicId : null;
  let family: Set<string> | null = null;
  if (topicId) {
    if (!(await visibleTopic(ctx, topicId))) { res.status(404).json({ error: "Topic not found" }); return; }
    family = await topicFamily(ctx.tenantId, topicId);
  }
  const subjectQ = typeof req.query.subject === "string" && req.query.subject ? req.query.subject.toLowerCase() : null;
  const topicRows = await cachedTopics(ctx.tenantId);
  if (!family && subjectQ) family = new Set(topicRows.filter((t) => t.subject.toLowerCase() === subjectQ && canSee(ctx, t.franchiseId)).map((t) => t.id));
  // Topic order is an integer rank per topic and the tie-breaks are plain string compares (ISO dates, ids): a deck can hold
  // ~50k cards, and ICU compares per pair made this sort the slowest part of the request.
  const rank = req.query.sort === "topic" ? topicRank(topicRows) : null;
  const order = (a: { id: string; topicId: string; createdAt: string }, b: { id: string; topicId: string; createdAt: string }) =>
    (rank ? (rank.get(a.topicId) ?? -1) - (rank.get(b.topicId) ?? -1) : 0) || (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  // Optional: `subject`, `sort=topic`, `q` (front/back text), `published=0|1`, `limit`/`cursor` (→ `{items,total,nextCursor}`, default 60, max 200). A
  // plain call is still an array (at most 500). A topic-scoped call reads just that topic's cards; otherwise the light index + a
  // batched read of the page.
  const needle = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
  const pub = req.query.published === "1" ? true : req.query.published === "0" ? false : null;
  const paged = req.query.limit !== undefined || req.query.cursor !== undefined;
  const start = paged ? intQ(req.query.cursor, 0, 1_000_000) : 0;
  const limit = paged ? intQ(req.query.limit, 60, 200) : UNPAGED_MAX;
  let rows: Card[];
  let total: number;
  if (family && family.size <= 30 && !needle) {
    const snap = await flashcardsCol.where("tenantId", "==", ctx.tenantId).where("topicId", "in", [...family]).get();
    const all = snap.docs.map((d) => ({ id: d.id, ...(d.data() as CardDoc) })).filter((c) => canSee(ctx, c.franchiseId) && (pub === null || (c.published !== false) === pub))
      .sort(order);
    total = all.length; rows = all.slice(start, start + limit);
  } else if (needle) {
    // Text search needs the bodies: scan the (topic-scoped when given) cards once.
    const snap = family && family.size <= 30
      ? await flashcardsCol.where("tenantId", "==", ctx.tenantId).where("topicId", "in", [...family]).get()
      : await flashcardsCol.where("tenantId", "==", ctx.tenantId).get();
    const all = snap.docs.map((d) => ({ id: d.id, ...(d.data() as CardDoc) })).filter((c) => canSee(ctx, c.franchiseId) && (!family || family.has(c.topicId)) && (pub === null || (c.published !== false) === pub) && `${c.front}\n${c.back}`.toLowerCase().includes(needle))
      .sort(order);
    total = all.length; rows = all.slice(start, start + limit);
  } else {
    const ix = [...(await cardIndex(ctx.tenantId)).values()].filter((c: CardRow) => canSee(ctx, c.franchiseId) && (!family || family.has(c.topicId)) && (pub === null || c.published === pub))
      .sort(order);
    total = ix.length; rows = await cardsById(ix.slice(start, start + limit).map((c) => c.id));
  }
  const out = rows.map(cardOut);
  if (!paged) { res.set("X-Total-Count", String(total)); res.json(out); return; }
  res.json({ items: out, total, nextCursor: start + limit < total ? String(start + limit) : null });
});

hubFlashcardsApi.post("/flashcards", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const parsed = cardBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  if (!(await visibleTopic(ctx, parsed.data.topicId))) { res.status(404).json({ error: "Topic not found" }); return; }
  const n = (await flashcardsCol.where("tenantId", "==", ctx.tenantId).count().get()).data().count;
  if (n >= MAX_CARDS) { res.status(409).json({ error: `A hub can hold up to ${MAX_CARDS} flashcards — tidy some away first` }); return; }
  const now = nowIso();
  const doc: CardDoc = { tenantId: ctx.tenantId, franchiseId: ctx.franchiseId, ...parsed.data, createdBy: ctx.uid, createdByName: ctx.name, createdAt: now, updatedAt: now };
  const ref = await flashcardsCol.add(doc);
  patchCard(ctx.tenantId, ref.id, doc); pingHub(ctx.tenantId, "hubFlashcards");
  res.status(201).json(cardOut({ id: ref.id, ...doc }));
});

/** A visible-and-writable card, or a refusal already sent. */
async function editableCard(ctx: HubCtx, id: string, res: import("express").Response) {
  if (!okId(id)) { res.status(404).json({ error: "Card not found" }); return null; }
  const snap = await flashcardsCol.doc(id).get();
  if (!snap.exists || snap.get("tenantId") !== ctx.tenantId || !canSee(ctx, snap.get("franchiseId"))) { res.status(404).json({ error: "Card not found" }); return null; }
  if (!canWriteRow(ctx, snap.get("franchiseId"))) { res.status(403).json({ error: "That card belongs to head office" }); return null; }
  return snap;
}

// POST /flashcards/publish {ids, published} — publish (or un-publish) many cards in ONE request ("Publish 60 drafts" used to be 60
// parallel PUTs). Cards outside the caller's scope or that head office owns are skipped, not failed: {updated, skipped}.
const bulkPublishBody = z.object({ ids: z.array(z.string().min(1).max(100)).min(1).max(500), published: z.boolean() });
hubFlashcardsApi.post("/flashcards/publish", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const parsed = bulkPublishBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const ids = [...new Set(parsed.data.ids)].filter(okId);
  const snaps = ids.length ? await db.getAll(...ids.map((id) => flashcardsCol.doc(id))) : [];
  const ok = snaps.filter((d) => d.exists && d.get("tenantId") === ctx.tenantId && canSee(ctx, d.get("franchiseId")) && canWriteRow(ctx, d.get("franchiseId")));
  const patch = { published: parsed.data.published, updatedAt: nowIso() };
  for (const part of chunk(ok, 400)) { const b = db.batch(); for (const d of part) b.update(d.ref, patch); await b.commit(); }
  for (const d of ok) patchCard(ctx.tenantId, d.id, patch);
  if (ok.length) pingHub(ctx.tenantId, "hubFlashcards");
  res.json({ updated: ok.length, skipped: parsed.data.ids.length - ok.length });
});

hubFlashcardsApi.put("/flashcards/:id", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const parsed = cardBody.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const snap = await editableCard(ctx, req.params.id, res);
  if (!snap) return;
  if (parsed.data.topicId && !(await visibleTopic(ctx, parsed.data.topicId))) { res.status(404).json({ error: "Topic not found" }); return; }
  const patch = { ...parsed.data, updatedAt: nowIso() };
  await snap.ref.update(patch);
  patchCard(ctx.tenantId, snap.id, patch); pingHub(ctx.tenantId, "hubFlashcards");
  res.json(cardOut({ id: snap.id, ...(snap.data() as CardDoc), ...patch }));
});

// DELETE /flashcards/:id — the card and every child's review state for it.
hubFlashcardsApi.delete("/flashcards/:id", async (req, res) => {
  const ctx = await resolveCtx(req, res);
  if (!ctx || !requireEdit(ctx, res)) return;
  const snap = await editableCard(ctx, req.params.id, res);
  if (!snap) return;
  const revs = await reviewsCol.where("tenantId", "==", ctx.tenantId).where("cardId", "==", snap.id).get();
  for (const part of chunk(revs.docs, 400)) { const b = db.batch(); for (const d of part) b.delete(d.ref); await b.commit(); }
  await snap.ref.delete();
  patchCard(ctx.tenantId, snap.id, null); pingHub(ctx.tenantId, "hubFlashcards");
  res.json({ ok: true });
});
