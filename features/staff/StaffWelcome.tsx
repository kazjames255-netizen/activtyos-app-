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
import { availabilityDone, complianceProgress, outstandingDocs, outstandingCourses } from "./staffTasks";

const FLAG = "aos.staff.welcomed.v1";

export function StaffWelcome() {
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
  }, [forced]);

  const dismiss = () => { try { localStorage.setItem(FLAG, new Date().toISOString()); } catch { /* ignore */ } setOpen(false); };
  const go = (view: string) => { dismiss(); router.push(`/${portal}/${view}`); };

  if (!open) return null;

  const complianceOk = comp.total > 0 && comp.done >= comp.total;
  // ordered gating steps — only the ones still outstanding
  const STEPS = ([
    ["1", "📅", "Set your availability", "Tell us the days and times you can work — this puts you on the rota.", "availability", !availOk, "2 mins"],
    ["2", "🪪", "Complete your compliance details", "Your right-to-work, DBS, references and emergency contacts. Save as you go.", "onboarding", !complianceOk, comp.total ? `${comp.done}/${comp.total} done` : "safer recruitment"],
  ] as const).filter(([, , , , , outstanding]) => outstanding);
  const allDone = STEPS.length === 0;
  const firstView = STEPS[0]?.[4] ?? "availability";

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="relative overflow-hidden px-6 py-6 text-white" style={{ background: allDone ? "linear-gradient(135deg,#166534,#37b26a)" : "linear-gradient(135deg,#1d3a8f,#3f7ae0)" }}>
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 400 140" preserveAspectRatio="xMidYMid slice" aria-hidden><circle cx="368" cy="18" r="66" fill="#fff" opacity="0.1" /><circle cx="330" cy="140" r="44" fill="#fff" opacity="0.07" /></svg>
          <div className="relative">
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/80">Welcome to the team</div>
            <h2 className="mt-1 text-[22px] font-extrabold leading-tight">{allDone ? "You're all set up 🎉" : "Let's get you started"}</h2>
            <p className="mt-1 text-[13px] text-white/85">{allDone ? "Nothing left to set up. Anything else will show as a gentle reminder at the top." : "Just two quick things before your first shift — the rest can wait."}</p>
          </div>
        </div>

        {!allDone && (
          <div className="space-y-2 px-5 py-4">
            {STEPS.map(([num, icon, title, sub, view, , hint]) => (
              <button key={view} type="button" onClick={() => go(view)} className="flex w-full items-center gap-3 rounded-xl border border-[var(--line)] p-3 text-left transition-colors hover:border-[#1d3a8f] hover:bg-[#f6f9ff]">
                <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-[#1d3a8f] text-[14px] font-extrabold text-white">{num}</span>
                <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-[#eef4ff] text-[17px]">{icon}</span>
                <span className="min-w-0 flex-1"><span className="block text-[13.5px] font-extrabold text-[var(--ink)]">{title}</span><span className="block text-[11.5px] text-[var(--ink-3)]">{sub}</span></span>
                <span className="flex-none rounded-full bg-[#eef4ff] px-2 py-0.5 text-[10.5px] font-extrabold text-[#1d3a8f]">{hint}</span>
              </button>
            ))}
            {laterCount > 0 && (
              <div className="mt-1 flex items-start gap-2 rounded-xl bg-[#fff7e6] p-3 text-[12px] text-[#8a5a00]">
                <span className="text-[14px]">📌</span>
                <span>You also have <b>{laterCount}</b> course{laterCount > 1 ? "s" : ""} & document{laterCount > 1 ? "s" : ""} to work through — no rush. We'll keep a reminder at the top of your screen until they're done.</span>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 border-t border-[var(--line)] px-5 py-3">
          <button type="button" onClick={dismiss} className="text-[12.5px] font-bold text-[var(--ink-3)] hover:text-[var(--ink-2)]">{allDone ? "Close" : "Skip for now"}</button>
          {!allDone && <button type="button" onClick={() => go(firstView)} className="ml-auto rounded-full bg-[#1d3a8f] px-4 py-2 text-[13px] font-extrabold text-white hover:brightness-110">Start with step 1 →</button>}
        </div>
      </div>
    </div>
  );
}
