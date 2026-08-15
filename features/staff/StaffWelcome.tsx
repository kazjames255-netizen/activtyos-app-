"use client";

// First-login welcome for a staff member. The moment they first open the portal
// (after being sent the sign-up link), this points them straight at onboarding —
// but only shows the steps that still have OUTSTANDING items (unread documents,
// missing certificates, incomplete training). If nothing's left, it congratulates
// them. Shows once (localStorage flag; ?welcome=1 forces it). Front-end demo —
// real per-user "welcomed" state + identity are Amir's.
import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCredentials, credStatus, appliesTo, DEMO_STAFF } from "@/features/learning/credentials";
import { DOCS_KEY, seedDocs, type DocItem } from "@/features/documents/DocumentsApp";

const FLAG = "aos.staff.welcomed.v1";
// demo "me" — matches the Staff-certificates / Staff-documents areas
const ME = "Marcus Bell";
const ME_ROLE = "Lead";
const ME_TITLE = "Coach / Staff";
const MY_LISTINGS = ["After-School Football Club"];
const rmatch = (list: string[], me: string) => list.some((r) => { const rl = r.toLowerCase(), m = me.toLowerCase(); return rl.includes(m) || m.includes(rl.split(/[ /]/)[0]); });
const courseRoleMatch = (roles: string[]) => roles.some((r) => { const rl = r.toLowerCase(); return rl.includes("lead") || rl.includes("manager") || rl.includes(ME_ROLE.toLowerCase()); });

export function StaffWelcome() {
  const router = useRouter();
  const portal = (usePathname() || "/staff").split("/")[1] || "staff";
  const forced = useSearchParams().get("welcome") === "1";
  const cred = useCredentials(DEMO_STAFF);
  const [open, setOpen] = useState(false);
  const [docsOut, setDocsOut] = useState(0);
  const [trainOut, setTrainOut] = useState(0);

  useEffect(() => {
    try { if (forced || !localStorage.getItem(FLAG)) setOpen(true); } catch { setOpen(true); }
    // outstanding documents (assigned to me & not yet read)
    try {
      let docs: DocItem[]; const s = JSON.parse(localStorage.getItem(DOCS_KEY) || "null"); docs = Array.isArray(s) && s.length ? s : seedDocs();
      const mine = docs.filter((d) => d.all || rmatch(d.roles, ME_ROLE) || rmatch(d.titles, ME_TITLE) || d.listings.some((l) => MY_LISTINGS.includes(l)));
      const reads = (JSON.parse(localStorage.getItem("aos.docs.read.v1") || "{}")[ME]) || {};
      setDocsOut(mine.filter((d) => !reads[d.id]).length);
    } catch { /* ignore */ }
    // outstanding training (courses assigned to me & not passed)
    try {
      const asns = JSON.parse(localStorage.getItem("aos.learn.lcm.v2") || "null")?.assignments || [];
      const progress = JSON.parse(localStorage.getItem("aos.learn.progress.v1") || "{}");
      const mine = asns.filter((a: { kind: string; roles: string[]; staff: string[] }) => a.kind === "all" || (a.kind === "roles" && courseRoleMatch(a.roles)) || (a.kind === "staff" && a.staff.includes(ME)));
      setTrainOut(mine.filter((a: { course: string }) => !progress[a.course]?.passed).length);
    } catch { /* ignore */ }
  }, [forced]);

  // outstanding certificates (required for me & not valid)
  const certOut = cred.types.filter((t) => t.required && appliesTo(t, ME, ME_ROLE) && credStatus(cred.recordFor(ME, t.id)) !== "Valid").length;

  const dismiss = () => { try { localStorage.setItem(FLAG, new Date().toISOString()); } catch { /* ignore */ } setOpen(false); };
  const go = (view: string) => { dismiss(); router.push(`/${portal}/${view}`); };

  if (!open) return null;

  const STEPS = ([
    ["📄", "Read your documents & policies", "Safeguarding, code of conduct and more — read each and confirm.", "documents", docsOut],
    ["🎖", "Add your certificates", "Upload your DBS, First Aid and other certificates.", "certificates", certOut],
    ["📚", "Complete your training", "Work through the courses assigned to you.", "certificates", trainOut],
  ] as const).filter(([, , , , n]) => n > 0);
  const allDone = STEPS.length === 0;
  const firstView = STEPS[0]?.[3] ?? "documents";

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="relative overflow-hidden px-6 py-6 text-white" style={{ background: allDone ? "linear-gradient(135deg,#166534,#37b26a)" : "linear-gradient(135deg,#1d3a8f,#3f7ae0)" }}>
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 400 140" preserveAspectRatio="xMidYMid slice" aria-hidden><circle cx="368" cy="18" r="66" fill="#fff" opacity="0.1" /><circle cx="330" cy="140" r="44" fill="#fff" opacity="0.07" /></svg>
          <div className="relative">
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/80">Welcome to the team</div>
            <h2 className="mt-1 text-[22px] font-extrabold leading-tight">{allDone ? "You're all set up 🎉" : "Let's get you set up"}</h2>
            <p className="mt-1 text-[13px] text-white/85">{allDone ? "Everything's complete — nothing outstanding. You're good to go." : "A few quick things to complete before you start. It only takes a few minutes."}</p>
          </div>
        </div>

        {!allDone && (
          <div className="space-y-2 px-5 py-4">
            {STEPS.map(([icon, title, sub, view, n]) => (
              <button key={title} type="button" onClick={() => go(view)} className="flex w-full items-center gap-3 rounded-xl border border-[var(--line)] p-3 text-left transition-colors hover:border-[#1d3a8f] hover:bg-[#f6f9ff]">
                <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[#eef4ff] text-[18px]">{icon}</span>
                <span className="min-w-0 flex-1"><span className="block text-[13.5px] font-extrabold text-[var(--ink)]">{title}</span><span className="block text-[11.5px] text-[var(--ink-3)]">{sub}</span></span>
                <span className="rounded-full bg-[#fdecec] px-2 py-0.5 text-[10.5px] font-extrabold text-[#c0392b]">{n} to do</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 border-t border-[var(--line)] px-5 py-3">
          <button type="button" onClick={dismiss} className="text-[12.5px] font-bold text-[var(--ink-3)] hover:text-[var(--ink-2)]">{allDone ? "Close" : "Skip for now"}</button>
          {!allDone && <button type="button" onClick={() => go(firstView)} className="ml-auto rounded-full bg-[#1d3a8f] px-4 py-2 text-[13px] font-extrabold text-white hover:brightness-110">Start onboarding →</button>}
        </div>
      </div>
    </div>
  );
}
