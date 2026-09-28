"use client";
import type { ItemOut } from "../applied/core";
import type { Backend } from "../applied/store";
import { AppliedGameUI, type Theme } from "../applied/AppliedGameUI";

// Market Day — money/economics maths (making change, best-value comparison, simple profit/loss, budgeting) framed
// as running a market stall. Content and marking: features/learninghub/games/applied/core.ts (kind "money:*").
// Gold/amber accent — never green (content rule: no green as a persistent brand colour).
const ACCENT = "#b8860b";
const KIND_EMOJI: Record<string, string> = { change: "💷", bestvalue: "⚖️", profit: "📈", budget: "🧺" };

function parseMoney(_item: ItemOut, raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed === "-") return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100); // pounds typed -> pence stored
}

interface BudgetItem { name: string; priceLabel: string }

const theme: Theme = {
  title: "Market Day", frameEmoji: "🧺", accent: ACCENT,
  introBody: "Give the right change, spot the best-value pack, and keep the stall's books balanced.",
  scene: (phase, idx, total) => phase === "intro" ? "🧺 🍎 🍊" : phase === "done" ? "🎉" : `${idx + 1} / ${total} 🛒`,
  unitLabel: (item) => (item.unit === "p" ? "£" : null),
  parseValue: parseMoney,
  prompt: (item) => {
    const p = item.prompt as { priceLabel?: string; paidLabel?: string; good?: string; costLabel?: string; sellLabel?: string; budgetLabel?: string; items?: BudgetItem[] };
    if (item.kind === "change") return { headline: <>A customer buys something for <b>{p.priceLabel}</b> and hands over <b>{p.paidLabel}</b>.</>, detail: "How much change do they get?" };
    if (item.kind === "bestvalue") return { headline: <>Which is better value: {p.good}?</>, detail: <span aria-hidden="true">{KIND_EMOJI.bestvalue}</span> };
    if (item.kind === "profit") return { headline: <>You bought {p.good} for <b>{p.costLabel}</b> and sold them for <b>{p.sellLabel}</b>.</>, detail: "What's the profit? (use a minus sign for a loss)" };
    return { headline: <>You have <b>{p.budgetLabel}</b> to spend at the stall.</>, detail: <>Buying: {(p.items ?? []).map((i) => `${i.name} (${i.priceLabel})`).join(", ")}. How much money is left?</> };
  },
};

export default function MarketDaySlide({ backend, onExit, resume, exitToken }: { backend: Backend; onExit: () => void; resume?: boolean; exitToken?: number }) {
  return <AppliedGameUI backend={backend} theme={theme} onExit={onExit} resume={resume} exitToken={exitToken} />;
}
