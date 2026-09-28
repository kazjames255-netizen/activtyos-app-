"use client";

import type { HelpToolId } from "../remotesync/HelpTools";
import { REGISTRY } from "./registry";
import { suggest, suggestForQuestion, type Signal } from "./selection";
import overrides from "./selection/questionToolOverrides.json";

// Ties the suggestion engine to the tools that can actually be opened where the pupil is.

/** Registry tools that were rebuilt on the engine ("native") but whose help-drawer twin still exists under this id —
 *  without this they'd never be suggested (Protractor ranked first for "Draw angles using a protractor" and was dropped). */
const DRAWER_TWIN: Record<string, HelpToolId> = { "M-01": "ruler", "M-02": "protractor", "M-21": "grid", "M-60": "plot" };
const drawerIdOf = (t: { id: string; impl: { kind: string; id?: string } | null } | undefined): HelpToolId | null =>
  !t ? null : t.impl?.kind === "drawer" ? (t.impl.id as HelpToolId) : DRAWER_TWIN[t.id] ?? null;

/** Tools the Tools DRAWER can open for this lesson, best first (drawer ids), limited to those the tutor enabled. Empty when nothing fits. */
export function suggestDrawerTools(sig: Signal, enabled: HelpToolId[], max = 6): HelpToolId[] {
  const on = new Set<string>(enabled);
  const byId = new Map(REGISTRY.map((t) => [t.id, t]));
  const out: HelpToolId[] = [];
  for (const s of suggest(sig, (id) => { const d = drawerIdOf(byId.get(id)); return !!d && on.has(d); }, { max: max * 2 })) {
    const d = drawerIdOf(byId.get(s.tool));
    if (d && !out.includes(d)) out.push(d);
    if (out.length >= max) break;
  }
  return out;
}

/** Help tools that fit ONE question, judged from the question's OWN wording only — never from the lesson's title/topic (a
 *  lesson called "Draw angles using a protractor" has warm-up questions like "How many angles does a triangle have?" that
 *  need no protractor). Strict on purpose: only rules scoring at least `min` count, and the generic fallback tools never
 *  do, so a question with no real signal gets NO tool. Returns drawer ids (best first), limited to `enabled`. */
export const QUESTION_TOOL_MIN = 0.6;
export function suggestQuestionTools(sig: { subject: string; year: number | null; prompt: string }, enabled: HelpToolId[], opts: { min?: number; max?: number } = {}): HelpToolId[] {
  const { min = QUESTION_TOOL_MIN, max = 3 } = opts;
  // The subject decides which subject's rules apply; with none, the engine would let EVERY subject's rules fire (a science calculator rule on a maths question).
  // No subject = no engine guess: only a judged decision (questionToolOverrides.json) can show a tool.
  if (!sig.subject) return [];
  const on = new Set<string>(enabled);
  const byId = new Map(REGISTRY.map((t) => [t.id, t]));
  const out: HelpToolId[] = [];
  for (const s of suggestForQuestion({ subject: sig.subject, year: sig.year, title: sig.prompt, unit: "", objective: "" }, (id) => { const d = drawerIdOf(byId.get(id)); return !!d && on.has(d); }, { max: max * 3 })) {
    if (s.source === "fallback" || s.score < min) continue;
    const d = drawerIdOf(byId.get(s.tool));
    if (d && !out.includes(d)) out.push(d);
    if (out.length >= max) break;
  }
  return out;
}

/** Question ids differ per tenant (`curr-<tenantId>-…`, `oak-<tenantId>-q-…`, `shared-hubQuestions-…`): strip the tenant so one decision covers every copy of a question. */
export const normaliseQuestionId = (id: string): string =>
  id.replace(/^shared-hubQuestions-/, "").replace(/^(curr|oak)-[A-Za-z0-9]{20}-/, "$1-");

/** Key in the provider's questionToolsAdd map meaning "on EVERY question". */
export const ALL_QUESTIONS_KEY = "*";

/** THE per-question answer: which help tools show on this question, out of the ones the tutor allowed (`enabled`).
 *  1) a question the agent judging pass decided on (questionToolOverrides.json, incl. explicit "no tool") wins;
 *  2) otherwise the strict wording rules (suggestQuestionTools). No question in view (a slide, the start screen) = no tool. */
export function toolsForQuestion(q: { id?: string | null; prompt?: string | null; subject?: string; year?: number | null }, enabled: HelpToolId[], off?: readonly string[], add?: Record<string, readonly string[]>): HelpToolId[] {
  if (!q.prompt && !q.id) return [];
  const on = new Set<string>(enabled);
  const key = q.id ? normaliseQuestionId(q.id) : "";
  // The provider's own choices for this question: the default tool can be switched OFF, and any tool can be ADDED (both saved in their hub settings).
  const added = [...new Set([...(key ? add?.[key] ?? [] : []), ...(add?.[ALL_QUESTIONS_KEY] ?? [])])].filter((t) => on.has(t)) as HelpToolId[];
  if (q.id && off?.length && off.includes(key)) return added;
  const map = (overrides as { tools: Record<string, string[]> }).tools;
  const hit = q.id ? map[key] : undefined;
  const base = hit ? (hit.filter((t) => on.has(t)) as HelpToolId[]) : q.prompt ? suggestQuestionTools({ subject: q.subject ?? "", year: q.year ?? null, prompt: q.prompt }, enabled) : [];
  return [...base, ...added.filter((t) => !base.includes(t))];
}

/** Tools-page tools (not one of the 20 help-drawer ids) a provider ADDED to this question: registry ids, opened in their own window. */
export function extraToolsForQuestion(q: { id?: string | null }, add?: Record<string, readonly string[]>, helpIds: readonly string[] = []): string[] {
  if (!q.id || !add) return [];
  const list = [...new Set([...(add[normaliseQuestionId(q.id)] ?? []), ...(add[ALL_QUESTIONS_KEY] ?? [])])];
  return list.filter((t) => !helpIds.includes(t));
}

/** Live tools (any kind) for a lesson — used by "Tools for this lesson" chips. */
export function suggestLiveTools(sig: Signal, max = 3) {
  const byId = new Map(REGISTRY.map((t) => [t.id, t]));
  return suggest(sig, (id) => byId.get(id)?.status === "live", { max }).map((s) => ({ tool: byId.get(s.tool)!, why: s.why, source: s.source }));
}
