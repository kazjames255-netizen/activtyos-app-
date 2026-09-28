"use client";

import dynamic from "next/dynamic";
import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { demoBackend, liveBackend } from "@/features/learninghub/games/penguin/store";
import { PenguinTutorPanel } from "@/features/learninghub/games/penguin/TutorPanel";

// Dev entry for Penguin Slide. The game is its OWN chunk (loaded here on demand, never part of the hub bundle).
//   /dev/games/penguin-slide                          demo: no account, nothing leaves this device (the ice map lives in localStorage)
//   /dev/games/penguin-slide?tenantId=T&childId=C     live: a signed-in family account, the server issues the seed and re-simulates every run
//   &tutor=1 (with childId, signed in as the TUTOR) shows the tutor panel: fact strengths, pin tables, misconceptions.
//   &unlock=all opens every stage (demo); &calm=1 forces the Calm variant (what a child's support profile does); &name=Ava sets the demo child's name.
const PenguinSlide = dynamic(() => import("@/features/learninghub/games/penguin/PenguinSlide"), { ssr: false, loading: () => <div style={{ height: "100dvh", background: "#070b2e" }} /> });

function Page() {
  const q = useSearchParams();
  const tenantId = q.get("tenantId"), childId = q.get("childId");
  const calm = q.get("calm") === "1";
  const backend = useMemo(() => (tenantId && childId ? liveBackend(tenantId, childId, q.get("name") ?? "") : demoBackend(q.get("name") ?? "Explorer", { support: { calm }, unlockAll: q.get("unlock") === "all" })), [tenantId, childId, calm, q]);
  if (q.get("tutor") === "1" && childId) return <div style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}><PenguinTutorPanel childId={childId} childName={q.get("name") ?? ""} tenantQuery={tenantId ? `tenantId=${encodeURIComponent(tenantId)}` : ""} /></div>;
  return (
    <div style={{ height: "100dvh", background: "#070b2e" }}>
      <PenguinSlide backend={backend} support={calm ? { calm: true } : undefined} unlockAll={q.get("unlock") === "all"} />
    </div>
  );
}
export default function PenguinSlideDevPage() { return <Suspense fallback={null}><Page /></Suspense>; }
