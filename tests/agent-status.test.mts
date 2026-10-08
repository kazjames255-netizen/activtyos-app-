import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AGENT_AREAS, AGENT_STATUS_LABEL, AGENT_STATUS_ORDER, validateAgentData, type AgentArea } from "../lib/testing/agentStatus";
import { AgentStatusPanel } from "../features/testTracker/AgentStatusPanel";

test("agent status data is well formed", () => {
  assert.deepEqual(validateAgentData(), []);
});
test("validator catches duplicates, bad status and bad dates", () => {
  const a: AgentArea = { ...AGENT_AREAS[0] };
  const bad = validateAgentData([a, { ...a, status: "nope" as never, date: "2026-13-45" }]);
  assert.ok(bad.some((b) => b.includes("duplicate")) && bad.some((b) => b.includes("bad status")) && bad.some((b) => b.includes("bad date")));
});
test("panel renders every status", () => {
  const rows: AgentArea[] = AGENT_STATUS_ORDER.map((s, i) => ({ id: `T${i}`, area: `Area ${s}`, status: s, rounds: "1 round", next: "next", date: "2026-10-08" }));
  const html = renderToStaticMarkup(createElement(AgentStatusPanel, { areas: rows }));
  for (const s of AGENT_STATUS_ORDER) {
    assert.ok(html.includes(`data-status="${s}"`));
    assert.ok(html.includes(AGENT_STATUS_LABEL[s]));
  }
  assert.ok(html.includes("Your phone checks"));
});
