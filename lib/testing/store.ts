"use client";

/**
 * Results store for the 25-day test run.
 *
 * localStorage, deliberately: a platform account has no tenant, so there is no
 * per-tenant document to hang this on, and building a server store for it is
 * Amir's time better spent on the backlog it produces. The cost is that the run
 * lives on ONE browser — so the export in the Testing page is not a nicety, it
 * is the backup. Export at the end of every day.
 */

import { PLAN, type Step } from "./plan";

const KEY = "aos.testing.run.v1";

export type Verdict = "pass" | "fail" | "blocked";
/** Who has to act on a failure. Chosen by you at the moment you log it. */
export type Owner = "amir" | "frontend" | "unsure";

export interface Result {
  stepId: string;
  verdict: Verdict;
  /** Only meaningful on a fail/blocked. */
  owner?: Owner;
  notes?: string;
  /** What you actually saw, when it wasn't what the step expected. */
  actual?: string;
  at: string;
  /** Set once the item has been dealt with, so Day 25 can re-run the rest. */
  resolved?: boolean;
}

export type Run = Record<string, Result>;

export function loadRun(): Run {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Run; } catch { return {}; }
}

export function saveResult(r: Result): Run {
  const run = loadRun();
  run[r.stepId] = r;
  localStorage.setItem(KEY, JSON.stringify(run));
  // Both the page and the floating logger listen, so they never disagree.
  window.dispatchEvent(new Event("aos:testing"));
  return run;
}

export function clearStep(stepId: string): Run {
  const run = loadRun();
  delete run[stepId];
  localStorage.setItem(KEY, JSON.stringify(run));
  window.dispatchEvent(new Event("aos:testing"));
  return run;
}

/** Every step, flattened, with its day — for lookups and the failure lists. */
export const ALL_STEPS: { day: number; date: string; dayTitle: string; step: Step }[] =
  PLAN.flatMap((d) => d.steps.map((step) => ({ day: d.day, date: d.date, dayTitle: d.title, step })));

export const stepById = (id: string) => ALL_STEPS.find((s) => s.step.id === id);

export interface Progress {
  done: number; total: number; pass: number; fail: number; blocked: number;
  openForAmir: number; openForFrontend: number;
}

export function progressOf(run: Run): Progress {
  const rs = Object.values(run);
  const open = rs.filter((r) => r.verdict !== "pass" && !r.resolved);
  return {
    done: rs.length,
    total: ALL_STEPS.length,
    pass: rs.filter((r) => r.verdict === "pass").length,
    fail: rs.filter((r) => r.verdict === "fail").length,
    blocked: rs.filter((r) => r.verdict === "blocked").length,
    openForAmir: open.filter((r) => r.owner === "amir").length,
    openForFrontend: open.filter((r) => r.owner === "frontend").length,
  };
}

/** The open items for one owner, newest first — this is what gets handed over. */
export function openFor(run: Run, owner: Owner) {
  return Object.values(run)
    .filter((r) => r.verdict !== "pass" && !r.resolved && r.owner === owner)
    .sort((a, b) => (a.at < b.at ? 1 : -1));
}

/**
 * The handover document. Markdown, because that's what Amir already reads and
 * what pastes cleanly into an email, an issue or a doc.
 */
export function buildHandover(run: Run, owner: Owner): string {
  const items = openFor(run, owner);
  const who = owner === "amir" ? "Amir (backend)" : owner === "frontend" ? "Front-end" : "Unassigned";
  const head = [
    `# Test findings — ${who}`,
    ``,
    `${items.length} open item${items.length === 1 ? "" : "s"} · exported ${new Date().toLocaleString("en-GB")}`,
    ``,
  ];
  if (!items.length) return [...head, `Nothing open. `].join("\n");
  const body = items.map((r) => {
    const s = stepById(r.stepId);
    if (!s) return `## ${r.stepId}\n${r.notes ?? ""}`;
    return [
      `## Day ${s.day} (${s.dayTitle}) — step ${r.stepId}`,
      ``,
      `**Where:** ${s.step.where}`,
      `**Did:** ${s.step.action}`,
      `**Expected:** ${s.step.expect}`,
      `**Actually got:** ${r.actual?.trim() || "(not recorded)"}`,
      r.notes?.trim() ? `**Notes:** ${r.notes.trim()}` : "",
      `**Status:** ${r.verdict.toUpperCase()} · logged ${new Date(r.at).toLocaleString("en-GB")}`,
      "",
    ].filter(Boolean).join("\n");
  });
  return [...head, ...body].join("\n");
}

/** Full run export, so a day's work is never trapped on one laptop. */
export function buildFullReport(run: Run): string {
  const p = progressOf(run);
  const out = [
    `# 25-day test run`,
    ``,
    `${p.done} of ${p.total} steps logged · ${p.pass} pass · ${p.fail} fail · ${p.blocked} blocked`,
    `Open: ${p.openForAmir} for Amir, ${p.openForFrontend} front-end`,
    ``,
  ];
  for (const d of PLAN) {
    const logged = d.steps.filter((s) => run[s.id]);
    if (!logged.length) continue;
    out.push(`## Day ${d.day} — ${d.title} (${d.label})`, ``);
    for (const s of d.steps) {
      const r = run[s.id];
      if (!r) continue;
      const mark = r.verdict === "pass" ? "PASS" : r.verdict === "fail" ? "FAIL" : "BLOCKED";
      out.push(`- **${mark}** \`${s.id}\` ${s.action}${r.actual ? ` — got: ${r.actual}` : ""}${r.notes ? ` (${r.notes})` : ""}`);
    }
    out.push(``);
  }
  return out.join("\n");
}
