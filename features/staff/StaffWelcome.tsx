"use client";

// First-login launcher for a staff member. Their first open of the portal should
// feel light, not a wall of reading — so it asks for the two things that actually
// gate their start, IN ORDER:
//   1. Availability  — so the manager can put them on the rota straight away.
//   2. Compliance    — the safer-recruitment onboarding details.
// Courses to complete and documents to read are deliberately NOT here; they live
// in the persistent top reminder bar (StaffReminderBanner) so they can be worked
// through over the first few shifts. Shows once (localStorage flag; ?welcome=1
// forces it). Front-end demo — real per-user "welcomed" state + identity are Amir's.
import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useT } from "@/lib/i18n/provider";
import { Rich } from "@/components/i18n/Rich";
import { availabilityDone, complianceProgress, outstandingDocs, outstandingCourses, syncOutstandingDocs } from "./staffTasks";

const FLAG = "aos.staff.welcomed.v1";

export function StaffWelcome() {
  const t = useT();
  const router = useRouter();
  const portal = (usePathname() || "/staff").split("/")[1] || "staff";
  const forced = useSearchParams().get("welcome") === "1";
  const [open, setOpen] = useState(false);
  const [availOk, setAvailOk] = useState(true);
  const [comp, setComp] = useState({ done: 0, total: 0 });
  const [laterCount, setLaterCount] = useState(0);

  useEffect(() => {
    try { if (forced || !localStorage.getItem(FLAG)) setOpen(true); } catch { setOpen(true); }
    setAvailOk(availabilityDone());
    setComp(complianceProgress());
    setLaterCount(outstandingDocs() + outstandingCourses());
    let live = true;
    void syncOutstandingDocs().then(() => { if (live) setLaterCount(outstandingDocs() + outstandingCourses()); });
    return () => { live = false; };
  }, [forced]);

  const dismiss = () => { try { localStorage.setItem(FLAG, new Date().toISOString()); } catch { /* ignore */ } setOpen(false); };
  const go = (view: string) => { dismiss(); router.push(`/${portal}/${view}`); };

  if (!open) return null;

  const complianceOk = comp.total > 0 && comp.done >= comp.total;
  // ordered gating steps — only the ones still outstanding
  const STEPS = ([
    ["1", "📅", t("p7tc.swAvailTitle"), t("p7tc.swAvailSub"), "availability", !availOk, t("p7tc.swMins")],
    ["2", "🪪", t("p7tc.swCompTitle"), t("p7tc.swCompSub"), "onboarding", !complianceOk, comp.total ? t("p7tc.swDone", { done: comp.done, total: comp.total }) : t("p7tc.swSafer")],
  ] as const).filter(([, , , , , outstanding]) => outstanding);
  const allDone = STEPS.length === 0;
  const firstView = STEPS[0]?.[4] ?? "availability";

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="relative overflow-hidden px-6 py-6 text-white" style={{ background: allDone ? "linear-gradient(135deg,#166534,#37b26a)" : "linear-gradient(135deg,#1d3a8f,#3f7ae0)" }}>
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 400 140" preserveAspectRatio="xMidYMid slice" aria-hidden><circle cx="368" cy="18" r="66" fill="#fff" opacity="0.1" /><circle cx="330" cy="140" r="44" fill="#fff" opacity="0.07" /></svg>
          <div className="relative">
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/80">{t("p7tc.swWelcome")}</div>
            <h2 className="mt-1 text-[22px] font-extrabold leading-tight">{allDone ? t("p7tc.swAllSet") : t("p7tc.swStarted")}</h2>
            <p className="mt-1 text-[13px] text-white/85">{allDone ? t("p7tc.swNothingLeft") : t("p7tc.swTwoThings")}</p>
          </div>
        </div>

        {!allDone && (
          <div className="space-y-2 px-5 py-4">
            {STEPS.map(([num, icon, title, sub, view, , hint]) => (
              <button key={view} type="button" onClick={() => go(view)} className="flex w-full items-center gap-3 rounded-xl border border-[var(--line)] p-3 text-start transition-colors hover:border-[#1d3a8f] hover:bg-[#f6f9ff]">
                <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-[#1d3a8f] text-[14px] font-extrabold text-white">{num}</span>
                <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-[#eef4ff] text-[17px]">{icon}</span>
                <span className="min-w-0 flex-1"><span className="block text-[13.5px] font-extrabold text-[var(--ink)]">{title}</span><span className="block text-[11.5px] text-[var(--ink-3)]">{sub}</span></span>
                <span className="flex-none rounded-full bg-[#eef4ff] px-2 py-0.5 text-[10.5px] font-extrabold text-[#1d3a8f]">{hint}</span>
              </button>
            ))}
            {laterCount > 0 && (
              <div className="mt-1 flex items-start gap-2 rounded-xl bg-[#fff7e6] p-3 text-[12px] text-[#8a5a00]">
                <span className="text-[14px]">📌</span>
                <span><Rich text={t("p7tc.swLater", { count: laterCount })} /></span>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 border-t border-[var(--line)] px-5 py-3">
          <button type="button" onClick={dismiss} className="text-[12.5px] font-bold text-[var(--ink-3)] hover:text-[var(--ink-2)]">{allDone ? t("p7tc.swClose") : t("p7tc.swSkip")}</button>
          {!allDone && <button type="button" onClick={() => go(firstView)} className="ms-auto rounded-full bg-[#1d3a8f] px-4 py-2 text-[13px] font-extrabold text-white hover:brightness-110">{t("p7tc.swStart")}</button>}
        </div>
      </div>
    </div>
  );
}
