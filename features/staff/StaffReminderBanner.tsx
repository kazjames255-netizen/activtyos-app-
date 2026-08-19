"use client";

// Persistent, non-blocking reminder bar across the staff portal. Unlike the
// first-login launcher (StaffWelcome), this never blocks — it keeps outstanding
// setup visible so a "Skip for now" doesn't bury it. Priority order matches the
// launcher: availability → compliance (these gate their start), then the
// no-rush items — courses to complete and documents to read. Re-reads on
// navigation so it updates as items clear, and disappears once nothing's left.
// Dismiss hides it for the session; it returns next sign-in while anything
// remains. Demo/local — per-user identity is Amir's.
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { availabilityDone, complianceProgress, outstandingDocs, outstandingCourses } from "./staffTasks";

const HIDE_KEY = "aos.staff.reminderHidden.v1"; // sessionStorage

interface Part { label: string; view: string; gating: boolean }

export function StaffReminderBanner() {
  const router = useRouter();
  const pathname = usePathname() || "/staff";
  const portal = pathname.split("/")[1] || "staff";
  const [parts, setParts] = useState<Part[]>([]);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const next: Part[] = [];
    // gating setup first, in the same order as the first-login launcher
    if (!availabilityDone()) next.push({ label: "Set your availability", view: "availability", gating: true });
    const comp = complianceProgress();
    if (comp.total > 0 && comp.done < comp.total) next.push({ label: `Finish your compliance details (${comp.done}/${comp.total})`, view: "onboarding", gating: true });
    // no-rush items
    const courses = outstandingCourses();
    if (courses > 0) next.push({ label: `${courses} course${courses > 1 ? "s" : ""} to complete`, view: "training", gating: false });
    const docs = outstandingDocs();
    if (docs > 0) next.push({ label: `${docs} document${docs > 1 ? "s" : ""} to read`, view: "documents", gating: false });
    setParts(next);
    try { setHidden(sessionStorage.getItem(HIDE_KEY) === "1"); } catch { setHidden(false); }
  }, [pathname]);

  if (hidden || parts.length === 0) return null;

  const anyGating = parts.some((p) => p.gating);
  const dismiss = () => { try { sessionStorage.setItem(HIDE_KEY, "1"); } catch { /* ignore */ } setHidden(true); };

  return (
    <div className="flex items-center gap-3 border-b border-[#f2d9a8] bg-gradient-to-r from-[#fff5df] to-[#fdecc8] px-4 py-2 sm:px-5" style={{ color: "#7a4e00" }}>
      <span className="text-[15px]" aria-hidden>📌</span>
      <div className="min-w-0 flex-1 text-[12.5px] font-semibold">
        <span className="font-extrabold">Still to do:</span>{" "}
        {parts.map((p, i) => (
          <span key={p.view}>
            <button type="button" onClick={() => router.push(`/${portal}/${p.view}`)} className="underline decoration-[#c98a1a]/50 underline-offset-2 hover:decoration-[#7a4e00]">{p.label}</button>
            {i < parts.length - 1 ? <span className="text-[#b98a3c]"> · </span> : null}
          </span>
        ))}
        {!anyGating && <span className="ml-1 hidden text-[#a9803a] sm:inline">— no rush, work through them over your first few shifts.</span>}
      </div>
      <button type="button" onClick={dismiss} aria-label="Hide reminder" className="flex-none rounded-full px-2 py-0.5 text-[15px] leading-none text-[#a9803a] hover:bg-white/50 hover:text-[#7a4e00]">×</button>
    </div>
  );
}
