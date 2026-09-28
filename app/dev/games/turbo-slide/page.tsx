"use client";

import dynamic from "next/dynamic";
import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { demoBackend, liveBackend } from "@/features/learninghub/games/turbo/store";

// Dev entry for Turbo Slide (same shape as /dev/games/penguin-slide). The game is its own chunk, loaded on demand.
//   /dev/games/turbo-slide                          demo: no account, nothing leaves this device
//   /dev/games/turbo-slide?tenantId=T&childId=C     live: a signed-in family account, the server issues the seed and re-simulates every run
//   &calm=1 forces the Calm variant; &name=Ava sets the demo child's name.
const TurboSlide = dynamic(() => import("@/features/learninghub/games/turbo/TurboSlide"), { ssr: false, loading: () => <div style={{ height: "100dvh", background: "#0b1440" }} /> });

function Page() {
  const q = useSearchParams();
  const tenantId = q.get("tenantId"), childId = q.get("childId");
  const calm = q.get("calm") === "1";
  const backend = useMemo(() => (tenantId && childId ? liveBackend(tenantId, childId, q.get("name") ?? "") : demoBackend(q.get("name") ?? "Explorer")), [tenantId, childId, q]);
  return (
    <div style={{ height: "100dvh", background: "#0b1440" }}>
      <TurboSlide backend={backend} support={calm ? { calm: true } : undefined} />
    </div>
  );
}
export default function TurboSlideDevPage() { return <Suspense fallback={null}><Page /></Suspense>; }
