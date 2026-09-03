"use client";

// SSR-safe entry point for the territory map. Leaflet touches `window`, so the
// real component only ever loads on the client.
import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type TerritoryMap from "./TerritoryMap";

const TerritoryMapInner = dynamic(() => import("./TerritoryMap"), {
  ssr: false,
  loading: () => <div className="flex h-[400px] items-center justify-center rounded-xl border border-[var(--line)] bg-[#e8eef7] text-[12.5px] text-[var(--ink-3)]">Loading map…</div>,
});

export type { TerritoryArea } from "./TerritoryMap";
export function TerritoryMapClient(props: ComponentProps<typeof TerritoryMap>) {
  return <TerritoryMapInner {...props} />;
}
