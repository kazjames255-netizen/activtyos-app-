// HQ > Test tracker > "Agent testing" section. Reads the typed data in lib/testing/agentStatus.ts (updated by pull request).
// Pure presentational: no API, no Firestore, no browser storage.

import { AGENT_AREAS, AGENT_AS_OF, AGENT_STATUS_LABEL, AGENT_STATUS_ORDER, PHONE_CHECKS, type AgentArea, type AgentStatus } from "../../lib/testing/agentStatus";

const TONE: Record<AgentStatus, { bg: string; fg: string }> = {
  shipped: { bg: "#e3f6ea", fg: "#0f6b34" },
  verified: { bg: "var(--brand-soft,#eaf0fc)", fg: "var(--brand-ink,#102356)" },
  testing: { bg: "#fdf0d3", fg: "#8a5300" },
  waiting: { bg: "#fde8ea", fg: "#b4161f" },
  held: { bg: "var(--panel,#eef1f8)", fg: "var(--ink-2,#4a4763)" },
};

function niceDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function AgentStatusPanel({ areas = AGENT_AREAS }: { areas?: AgentArea[] }) {
  const sorted = [...areas].sort((a, b) => AGENT_STATUS_ORDER.indexOf(a.status) - AGENT_STATUS_ORDER.indexOf(b.status));
  return (
    <section data-testid="agent-testing" aria-labelledby="agent-testing-h" className="mt-4">
      <h2 id="agent-testing-h" className="text-[20px] font-extrabold">Agent testing</h2>
      <p className="mt-1 text-[12.5px]" style={{ color: "var(--ink-3,#8a86a3)" }}>
        Source of truth: updated by pull request as the agents report, so it is not live. Last updated {niceDate(AGENT_AS_OF)}.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {AGENT_STATUS_ORDER.map((s) => (
          <span key={s} className="rounded-full px-3 py-1 text-[12px] font-extrabold" style={{ background: TONE[s].bg, color: TONE[s].fg }}>
            {AGENT_STATUS_LABEL[s]} · {areas.filter((a) => a.status === s).length}
          </span>
        ))}
      </div>
      <div className="mt-3 grid gap-2">
        {sorted.map((a) => (
          <div key={a.id} data-ui="card" data-status={a.status} className="rounded-2xl border p-3" style={{ borderColor: "var(--line,#ece6f1)", background: "var(--surface,#fff)" }}>
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
              <div className="min-w-0 flex-1 text-[14.5px] font-bold [overflow-wrap:anywhere]">{a.area}</div>
              <span className="whitespace-nowrap rounded-full px-3 py-0.5 text-[12px] font-extrabold" style={{ background: TONE[a.status].bg, color: TONE[a.status].fg }}>{AGENT_STATUS_LABEL[a.status]}</span>
            </div>
            <div className="mt-1 text-[13px] [overflow-wrap:anywhere]" style={{ color: "var(--ink-2,#4a4763)" }}>{a.next}</div>
            <div className="mt-1 text-[12px]" style={{ color: "var(--ink-3,#8a86a3)" }}>{a.rounds} · {niceDate(a.date)}</div>
          </div>
        ))}
      </div>

      <h3 className="mt-5 text-[16px] font-extrabold">Your phone checks</h3>
      <ul data-testid="phone-checks" className="mt-2 grid gap-2">
        {PHONE_CHECKS.map((c) => (
          <li key={c.id} className="rounded-2xl border p-3 text-[13.5px]" style={{ borderColor: "var(--line,#ece6f1)", background: "var(--surface,#fff)" }}>
            <b>{c.when}:</b> {c.task}
          </li>
        ))}
      </ul>
    </section>
  );
}
