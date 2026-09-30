"use client";

// A can't-miss bar shown across every portal while an HQ owner is viewing the
// app AS another account. Everything below it is that account's real data, so
// the bar stays put until you Exit back to HQ.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getActAs, setActAs, type ActAs } from "@/lib/api";
import { getDefaultView } from "@/lib/nav/config";
import { useT } from "@/lib/i18n/provider";
import { richT } from "./richT";

export function ImpersonationBar() {
  const router = useRouter();
  const t = useT();
  const [act, setAct] = useState<ActAs | null>(null);

  useEffect(() => {
    const sync = () => setAct(getActAs());
    sync();
    window.addEventListener("aos:actas", sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("aos:actas", sync); window.removeEventListener("storage", sync); };
  }, []);

  if (!act) return null;
  const exit = () => { setActAs(null); router.push(`/platform/${getDefaultView("platform")}`); };

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-[#8a1c1c] px-4 py-2 text-center text-[12.5px] font-bold text-white">
      <span>{richT(t, "p8ops.shViewingAs", { name: <b className="font-extrabold">{act.label}</b>, data: <b>{t("p8ops.shTheirRealData")}</b> })}</span>
      <button type="button" onClick={exit} className="rounded-full bg-white/20 px-3 py-1 text-[12px] font-extrabold text-white transition-colors hover:bg-white/30">{t("p8ops.shExitHQ")}</button>
    </div>
  );
}
