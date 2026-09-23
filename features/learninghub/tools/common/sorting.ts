// Generic sorting engine (pure): card sorts, sequences and Venn diagrams for every subject.
import { checkSequence, checkSetMatch } from "../engine/quantity";
import type { CheckResult } from "../engine/marking";
import { makeRng } from "../engine/rng";
import type { KeyStage, ToolSubject } from "../types";

export interface SortCard { id: string; text: string; cat: string }
export interface SortSet { id: string; title: string; subject: ToolSubject; keyStages: KeyStage[]; instruction: string; categories: { id: string; label: string }[]; cards: SortCard[]; explanation?: string }
export interface SeqStep { id: string; text: string }
/** `steps` are in the CORRECT order. */
export interface SequenceSet { id: string; title: string; subject: ToolSubject; keyStages: KeyStage[]; instruction: string; steps: SeqStep[]; explanation?: string }
export type VennZone = "left" | "both" | "right";
export interface VennCard { id: string; text: string; zone: VennZone }
export interface VennSet { id: string; title: string; subject: ToolSubject; keyStages: KeyStage[]; instruction: string; left: string; right: string; cards: VennCard[]; explanation?: string }

/** card id -> category id (or Venn zone) currently chosen. */
export type Placement = Record<string, string>;

/** Deterministic shuffle of any list. */
export function seededShuffle<T>(xs: readonly T[], seed: number): T[] { return makeRng(seed).shuffle(xs); }

/** Shuffled steps that are never in the correct order (for 3+ steps). */
export function shuffleSteps(steps: readonly SeqStep[], seed: number): SeqStep[] {
  for (let k = 0; k < 50; k++) {
    const out = seededShuffle(steps, seed + k * 7919);
    if (steps.length < 3 || out.some((s, i) => s.id !== steps[i]!.id)) return out;
  }
  return [...steps].reverse();
}

const texts = (cards: { id: string; text: string }[]) => Object.fromEntries(cards.map((c) => [c.id, c.text]));

/** One mark per correctly placed card. Unplaced cards score nothing. */
export function scoreSort(set: SortSet | VennSet, placement: Placement): CheckResult {
  const expected: Record<string, string> = {};
  const answer: Record<string, string> = {};
  const name = texts(set.cards);
  for (const c of set.cards) {
    const want = "zone" in c ? c.zone : c.cat;
    expected[name[c.id]!] = want;
    if (placement[c.id] !== undefined) answer[name[c.id]!] = placement[c.id]!;
  }
  return checkSetMatch(answer, expected);
}

/** Card ids placed wrongly or not placed at all. */
export function misplacedIds(set: SortSet | VennSet, placement: Placement): string[] {
  return set.cards.filter((c) => placement[c.id] !== ("zone" in c ? c.zone : c.cat)).map((c) => c.id);
}

/** Neighbour-pair scoring for a sequence (ids in the learner's order). */
export function scoreSequence(set: SequenceSet, order: string[]): CheckResult {
  return checkSequence(order, set.steps.map((s) => s.id));
}

/** 1-based positions holding the wrong step. Numbers only, never the answers. */
export function wrongPositions(set: SequenceSet, order: string[]): number[] {
  const out: number[] = [];
  set.steps.forEach((s, i) => { if (order[i] !== s.id) out.push(i + 1); });
  return out;
}

/** A reasoning question about ONE misplaced card; never names the correct category. */
export function nextHint(set: SortSet | VennSet, placement: Placement, seed = 0): string | null {
  const bad = misplacedIds(set, placement);
  if (!bad.length) return null;
  const c = set.cards.find((x) => x.id === bad[seed % bad.length])!;
  const isVenn = "left" in set;
  return isVenn
    ? `Look at “${c.text}”. Does it describe only one thing, or both? Which features does it share?`
    : `Look at “${c.text}”. What is it, and which group's rule does it meet? Check it against the heading of each group.`;
}

export function nextSequenceHint(set: SequenceSet, order: string[]): string | null {
  const w = wrongPositions(set, order);
  if (!w.length) return null;
  const s = set.steps.find((x) => x.id === order[w[0]! - 1]);
  return s ? `Look at “${s.text}”. What has to happen just before it, and what comes straight after?` : `Position ${w[0]} is empty. What must happen there?`;
}

export function validateSortSet(s: SortSet): string[] {
  const e: string[] = [], p = `${s.id}:`;
  const cats = new Set(s.categories.map((c) => c.id));
  if (cats.size !== s.categories.length) e.push(`${p} duplicate category ids`);
  if (new Set(s.categories.map((c) => c.label)).size !== s.categories.length) e.push(`${p} duplicate category labels`);
  if (s.categories.length < 2) e.push(`${p} needs 2+ categories`);
  if (s.cards.length < 5 || s.cards.length > 14) e.push(`${p} card count ${s.cards.length}`);
  if (new Set(s.cards.map((c) => c.id)).size !== s.cards.length) e.push(`${p} duplicate card ids`);
  if (new Set(s.cards.map((c) => c.text.toLowerCase())).size !== s.cards.length) e.push(`${p} duplicate card text`);
  for (const c of s.cards) if (!cats.has(c.cat)) e.push(`${p} card ${c.id} has unknown category`);
  for (const k of s.categories) if (s.cards.filter((c) => c.cat === k.id).length < 2) e.push(`${p} category ${k.id} has < 2 cards`);
  if (!s.keyStages.length || !s.instruction || !s.title) e.push(`${p} missing title/instruction/keyStages`);
  return e;
}

export function validateSequenceSet(s: SequenceSet): string[] {
  const e: string[] = [], p = `${s.id}:`;
  if (s.steps.length < 4 || s.steps.length > 9) e.push(`${p} step count ${s.steps.length}`);
  if (new Set(s.steps.map((x) => x.id)).size !== s.steps.length) e.push(`${p} duplicate step ids`);
  if (new Set(s.steps.map((x) => x.text.toLowerCase())).size !== s.steps.length) e.push(`${p} duplicate step text`);
  if (!s.keyStages.length || !s.instruction || !s.title) e.push(`${p} missing title/instruction/keyStages`);
  return e;
}

export function validateVennSet(s: VennSet): string[] {
  const e: string[] = [], p = `${s.id}:`;
  if (s.cards.length < 6 || s.cards.length > 14) e.push(`${p} card count ${s.cards.length}`);
  if (new Set(s.cards.map((c) => c.id)).size !== s.cards.length) e.push(`${p} duplicate card ids`);
  if (new Set(s.cards.map((c) => c.text.toLowerCase())).size !== s.cards.length) e.push(`${p} duplicate card text`);
  for (const z of ["left", "both", "right"] as VennZone[]) if (s.cards.filter((c) => c.zone === z).length < 2) e.push(`${p} zone ${z} has < 2 cards`);
  if (!s.left || !s.right || s.left === s.right) e.push(`${p} bad circle labels`);
  return e;
}
