/**
 * Results logged by Claude's test agents, working through the plan on
 * 12 Sept 2026 — one JSON file per agent (a day range each), so parallel
 * agents never write the same file.
 *
 * These are NOT the owner's verdicts (those live in the browser, see store.ts).
 * The Testing page shows them beside each step as "Checked by Claude", with
 * what was actually observed and how it was tested, and can copy them into the
 * run.
 *
 * method:
 *   api        — the real route code exercised in-process against a throwaway
 *                tenant (created and deleted by the test)
 *   live-read  — a read-only request against the running dev server / data
 *   code       — established by reading the code path (no request possible)
 *   browser    — clicked through in the browser (demo tour or read-only)
 */
import A from "./agent-results/agent-A.json";
import B from "./agent-results/agent-B.json";
import C from "./agent-results/agent-C.json";
import D from "./agent-results/agent-D.json";
import E from "./agent-results/agent-E.json";
import F from "./agent-results/agent-F.json";
// Plan 2 (what the 28-day run never touched) — run from 13 Sept 2026.
import G from "./agent-results/plan2-agent-G.json";
import H from "./agent-results/plan2-agent-H.json";
import I from "./agent-results/plan2-agent-I.json";
import J from "./agent-results/plan2-agent-J.json";

export interface AgentResult {
  verdict: "pass" | "fail" | "blocked";
  method: "api" | "live-read" | "code" | "browser";
  /** What actually happened — the observed result, in words. */
  actual: string;
  notes?: string;
  /** The script / command / file that produced it, so it can be re-run. */
  evidence?: string;
  at: string;
  agent?: string;
}

export const AGENT_RESULTS: Record<string, AgentResult> = {
  ...(A as Record<string, AgentResult>), ...(B as Record<string, AgentResult>), ...(C as Record<string, AgentResult>),
  ...(D as Record<string, AgentResult>), ...(E as Record<string, AgentResult>), ...(F as Record<string, AgentResult>),
  ...(G as Record<string, AgentResult>), ...(H as Record<string, AgentResult>), ...(I as Record<string, AgentResult>), ...(J as Record<string, AgentResult>),
};
