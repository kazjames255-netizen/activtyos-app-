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
// K–O were recorded (days 9/10/12/14/15) but never wired in here — fixed 15 Sept 2026.
import K from "./agent-results/plan2-agent-K.json";
import L from "./agent-results/plan2-agent-L.json";
import M from "./agent-results/plan2-agent-M.json";
import N from "./agent-results/plan2-agent-N.json";
import O from "./agent-results/plan2-agent-O.json";
// Day 16 (home-visit delivery mode + 18 retested prior fails) — 16 Sept 2026.
import P from "./agent-results/plan2-agent-P.json";
// Day 17 (trip whoCanSend + rota leave/needsCover + provider welcome email,
// plus a fresh cross-tenant/multi-role/attack-surface sweep) — 16 Sept 2026.
import Q from "./agent-results/plan2-agent-Q.json";
// Day 18 (broad sweep — money, bookings, safeguarding, staff/rota, messaging,
// multi-tenant edge cases beyond days 1-17) — 16 Sept 2026.
import R from "./agent-results/plan2-agent-R.json";
// Day 19 (closing the inventory's last real gaps — ventureLakes, geo/tiles,
// the platform's own notification bell, the parent-facing refer-a-friend
// flow, and the HAF/£0-booking Funded-status rule) — 16 Sept 2026.
import S from "./agent-results/plan2-agent-S.json";
// Day 20 (race conditions/concurrency, load/stress, data-integrity sweep on
// booking/money/safeguarding records, deeper privilege-escalation) — 16 Sept 2026.
import T from "./agent-results/plan2-agent-T.json";
// Day 21 (round 2 of the "keep hunting" mandate — concurrent invite-accept,
// discount-code create race, staff-cap-under-concurrency, a bigger booking
// burst, more data-integrity/privesc checks) — 16 Sept 2026.
import U from "./agent-results/plan2-agent-U.json";
// Day 22 (round 3 — customer-record lost-update race, double-send-message
// check, staff assignment-scope leak, franchiseId query-param spoofing,
// orphaned-reference integrity checks) — 16 Sept 2026.
import V from "./agent-results/plan2-agent-V.json";
// Day 23 (round 4 — tasks.ts PUT merge confirmed clean, one more orphaned-
// reference integrity check) — 16 Sept 2026.
import W from "./agent-results/plan2-agent-W.json";
// Day 24 (round 5 — expense-claim approve race, the FOURTH confirmed
// instance of the same check-then-act-without-a-transaction pattern) — 16
// Sept 2026.
import X from "./agent-results/plan2-agent-X.json";
// p2-r9 re-verified at real volume (leads collection now 71.7k docs, 132.6s/
// 62MB unpaged) — supersedes plan2-agent-O's blocked reading; plus e2e suite
// fixes (smoke-test cold-compile warm-up, signup consent-checkbox) — 17 Sept 2026.
import Y from "./agent-results/plan2-agent-Y.json";

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
  ...(K as Record<string, AgentResult>), ...(L as Record<string, AgentResult>), ...(M as Record<string, AgentResult>),
  ...(N as Record<string, AgentResult>), ...(O as Record<string, AgentResult>), ...(P as Record<string, AgentResult>),
  ...(Q as Record<string, AgentResult>), ...(R as Record<string, AgentResult>), ...(S as Record<string, AgentResult>),
  ...(T as Record<string, AgentResult>), ...(U as Record<string, AgentResult>), ...(V as Record<string, AgentResult>),
  ...(W as Record<string, AgentResult>), ...(X as Record<string, AgentResult>), ...(Y as Record<string, AgentResult>),
};
