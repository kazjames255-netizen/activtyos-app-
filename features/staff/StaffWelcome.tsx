"use client";

// First-login welcome for a staff member. The moment they first open the portal
// (after being sent the sign-up link), this points them straight at onboarding:
// read your documents & policies, add your certificates, complete your training.
// Shows exactly once — a localStorage flag is stamped on start/skip. `?welcome=1`
// forces it open for testing. Front-end demo; real per-user "welcomed" state is
// Amir's (mirror the parent /api/me/welcome flow).
import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

const FLAG = "aos.staff.welcomed.v1";

export function StaffWelcome() {
  const router = useRouter();
  const portal = (usePathname() || "/staff").split("/")[1] || "staff";
  const forced = useSearchParams().get("welcome") === "1";
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try { if (forced || !localStorage.getItem(FLAG)) setOpen(true); } catch { setOpen(true); }
  }, [forced]);

  const dismiss = () => { try { localStorage.setItem(FLAG, new Date().toISOString()); } catch { /* ignore */ } setOpen(false); };
  const go = (view: string) => { dismiss(); router.push(`/${portal}/${view}`); };

  if (!open) return null;

  const STEPS: [string, string, string, string][] = [
    ["📄", "Read your documents & policies", "Safeguarding, code of conduct and more — read each and confirm.", "documents"],
    ["🎖", "Add your certificates", "Upload your DBS, First Aid and other certificates.", "certificates"],
    ["📚", "Complete your training", "Work through the courses assigned to you.", "certificates"],
  ];

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="relative overflow-hidden px-6 py-6 text-white" style={{ background: "linear-gradient(135deg,#1d3a8f,#3f7ae0)" }}>
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 400 140" preserveAspectRatio="xMidYMid slice" aria-hidden><circle cx="368" cy="18" r="66" fill="#fff" opacity="0.1" /><circle cx="330" cy="140" r="44" fill="#fff" opacity="0.07" /></svg>
          <div className="relative">
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/80">Welcome to the team</div>
            <h2 className="mt-1 text-[22px] font-extrabold leading-tight">Let&rsquo;s get you set up</h2>
            <p className="mt-1 text-[13px] text-white/85">A few quick things to complete before you start. It only takes a few minutes.</p>
          </div>
        </div>
        <div className="space-y-2 px-5 py-4">
          {STEPS.map(([icon, title, sub, view]) => (
            <button key={title} type="button" onClick={() => go(view)} className="flex w-full items-center gap-3 rounded-xl border border-[var(--line)] p-3 text-left transition-colors hover:border-[#1d3a8f] hover:bg-[#f6f9ff]">
              <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[#eef4ff] text-[18px]">{icon}</span>
              <span className="min-w-0 flex-1"><span className="block text-[13.5px] font-extrabold text-[var(--ink)]">{title}</span><span className="block text-[11.5px] text-[var(--ink-3)]">{sub}</span></span>
              <span className="text-[#1d3a8f]">→</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 border-t border-[var(--line)] px-5 py-3">
          <button type="button" onClick={dismiss} className="text-[12.5px] font-bold text-[var(--ink-3)] hover:text-[var(--ink-2)]">Skip for now</button>
          <button type="button" onClick={() => go("documents")} className="ml-auto rounded-full bg-[#1d3a8f] px-4 py-2 text-[13px] font-extrabold text-white hover:brightness-110">Start onboarding →</button>
        </div>
      </div>
    </div>
  );
}
