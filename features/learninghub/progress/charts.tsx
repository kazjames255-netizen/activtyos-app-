"use client";

import type { HubSettings } from "@/lib/hubConfig";
import { bandTone, NEUTRAL, OK, RED, type Tone } from "../shared-assess/format";
import { Chip } from "../shared-assess/ui";

export function BandChip({ bands, band, pct }: { bands: HubSettings["masteryBands"]; band: string | null | undefined; pct?: number | null }) {
  if (!band) return <Chip tone={NEUTRAL}>Not started</Chip>;
  return <Chip tone={bandTone(bands, band)}>{band}{pct != null ? <span className="font-bold tabular-nums opacity-80"> · {Math.round(pct)}%</span> : null}</Chip>;
}

/** Growth vs the placement-test baseline: an arrow AND a signed number (never colour alone). */
export function GrowthChip({ growth, baseline }: { growth: number | null | undefined; baseline?: number | null }) {
  if (growth == null) return baseline == null ? <Chip tone={NEUTRAL}>No baseline yet</Chip> : <Chip tone={NEUTRAL}>Started at {Math.round(baseline)}%</Chip>;
  const g = Math.round(growth);
  const tone: Tone = g > 0 ? OK : g < 0 ? RED : NEUTRAL;
  return (
    <Chip tone={tone} icon={g > 0 ? "▲" : g < 0 ? "▼" : "▬"}>
      <span className="tabular-nums">{g > 0 ? "+" : g < 0 ? "−" : ""}{Math.abs(g)} pts</span>
      {baseline != null && <span className="font-semibold opacity-80"> since {Math.round(baseline)}% start</span>}
    </Chip>
  );
}

export { TrendChart } from "./TrendChart";
