"use client";

// Staff self-service — "My learning": a Certificates tab (upload & renew your own
// DBS, First Aid, etc.) plus an optional My-courses tab (assigned ActivityOS
// courses + progress). The manager verifies certificates in the Staff area. Demo
// store; real file storage + per-user identity are Amir's.
import { useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";
import { LIGHT_PALETTE, PageHero } from "@/components/OperatorPage";
import { useCredentials, credStatus, CredBadge, CredEditor, blankRecord, openCredFile, appliesTo, fmtDate, daysUntil, type CredRecord, type CredType } from "./credentials";
import { SEED_LIBRARY, type CourseDoc } from "./courseContent";
import { CoursePlayer } from "./CoursePlayer";

const SEED = [
  { name: "Marcus Bell", dbs: "Valid", pfa: "Expiring" }, { name: "Jess Patel", dbs: "Valid", pfa: "Valid" },
  { name: "Aisha Rahman", dbs: "Valid", pfa: "Expired" }, { name: "Tom Lewis", dbs: "Valid", pfa: "Valid" },
  { name: "Priya Khan", dbs: "Pending", pfa: "Valid" }, { name: "Dan Reed", dbs: "Valid", pfa: "Valid" },
];
const ME = "Marcus Bell";
const ME_ROLE = "Lead";

interface Asn { course: string; kind: "all" | "roles" | "staff"; roles: string[]; staff: string[]; due: string; required: boolean }
const roleMatch = (roles: string[]) => roles.some((r) => { const rl = r.toLowerCase(); return rl.includes("lead") || rl.includes("manager") || rl.includes(ME_ROLE.toLowerCase()); });

export function StaffCertsApp() {
  const cred = useCredentials(SEED);
  const [view, setView] = useState<"certs" | "courses">("certs");
  const [edit, setEdit] = useState<CredRecord | null>(null);
  const [player, setPlayer] = useState<CourseDoc | null>(null);
  const [asns, setAsns] = useState<Asn[]>([]);
  const [progress, setProgress] = useState<Record<string, { pct: number; passed: boolean }>>({});
  const [courses, setCourses] = useState<CourseDoc[]>(SEED_LIBRARY);
  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem("aos.learn.lcm.v2") || "null"); if (s?.assignments) setAsns(s.assignments); } catch { /* ignore */ }
    try { const c = JSON.parse(localStorage.getItem("aos.learn.courses.v10") || "null"); if (Array.isArray(c) && c.length) setCourses(c); } catch { /* ignore */ }
  }, []);
  useEffect(() => { try { setProgress(JSON.parse(localStorage.getItem("aos.learn.progress.v1") || "{}")); } catch { /* ignore */ } }, [player]);

  const mine = (typeId: string) => cred.recordFor(ME, typeId);
  const shownTypes = cred.types.filter((t) => appliesTo(t, ME, ME_ROLE) || mine(t.id));
  // compulsory for me (set by the provider in Setup) vs anything else I hold
  const requiredTypes = cred.types.filter((t) => t.required && appliesTo(t, ME, ME_ROLE));
  const requiredShown = shownTypes.filter((t) => t.required && appliesTo(t, ME, ME_ROLE));
  const optionalShown = shownTypes.filter((t) => !(t.required && appliesTo(t, ME, ME_ROLE)));
  const outstanding = requiredShown.filter((t) => credStatus(mine(t.id)) !== "Valid");
  const validReq = requiredTypes.filter((t) => credStatus(mine(t.id)) === "Valid").length;
  const pct = requiredTypes.length ? Math.round((validReq / requiredTypes.length) * 100) : 100;

  const certCard = (t: CredType) => {
    const r = mine(t.id); const st = credStatus(r); const dl = daysUntil(r?.expiry);
    return (
      <Card key={t.id} className="p-3.5">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-[13.5px] font-extrabold text-[var(--ink)]">{t.name}</span>
          {t.required && appliesTo(t, ME, ME_ROLE) ? <span className="rounded-full bg-[#fdecec] px-2 py-0.5 text-[10px] font-bold text-[#c0392b]">Required</span> : <span className="rounded-full bg-[#eef1f6] px-2 py-0.5 text-[10px] font-bold text-[#64748b]">Optional</span>}
          <span className="ml-auto"><CredBadge s={st} /></span>
        </div>
        {r ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[var(--ink-3)]">
            <span>Issued <b className="text-[var(--ink-2)]">{fmtDate(r.issue)}</b></span>
            <span>Expires <b className="text-[var(--ink-2)]">{fmtDate(r.expiry)}</b>{dl != null && dl >= 0 && dl <= 60 ? <span className="font-bold text-[#b45309]"> · {dl}d left</span> : null}{dl != null && dl < 0 ? <span className="font-bold text-[#c0392b]"> · expired</span> : null}</span>
            {r.verified === "pending" && <span className="font-semibold text-[#1d54c4]">Awaiting verification</span>}
            {r.verified === "rejected" && <span className="font-semibold text-[#c0392b]">Rejected — please re-upload</span>}
          </div>
        ) : <div className="text-[12px] font-semibold text-[#c0392b]">{t.required && appliesTo(t, ME, ME_ROLE) ? "Required — not uploaded yet" : "Not uploaded yet."}</div>}
        <div className="mt-2.5 flex flex-wrap gap-2">
          {r?.fileData && <Button onClick={() => openCredFile(r.fileData)}>📎 View</Button>}
          <Button variant={r ? undefined : "primary"} onClick={() => setEdit(r ?? blankRecord(ME, t.id))}>{r ? (st === "Expiring" || st === "Expired" ? "🔄 Renew" : "Update") : "⬆ Upload"}</Button>
        </div>
      </Card>
    );
  };

  // courses assigned to me (all-staff, my role, or by name)
  const myCourses = asns.filter((a) => a.kind === "all" || (a.kind === "roles" && roleMatch(a.roles)) || (a.kind === "staff" && a.staff.includes(ME)))
    .map((a) => ({ a, c: courses.find((x) => x.id === a.course) })).filter((x): x is { a: Asn; c: CourseDoc } => !!x.c);

  if (player) return <CoursePlayer course={player} onClose={() => setPlayer(null)} />;

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero title="My learning" icon="🎖" lede="Your certificates and your assigned training in one place. Your manager verifies certificates and is reminded before they expire." />

      <div className="mb-3 inline-flex gap-0.5 rounded-full border border-[var(--line)] bg-[var(--panel)] p-0.5">
        {([["certs", "🎖 Certificates"], ["courses", `📚 My courses${myCourses.length ? ` (${myCourses.length})` : ""}`]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setView(k)} className={"rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition-colors " + (view === k ? "bg-white text-[#1d3a8f] shadow-sm" : "text-[var(--ink-3)] hover:text-[var(--ink-2)]")}>{l}</button>
        ))}
      </div>

      {view === "certs" && (<>
        <Card className="mb-3 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div><div className="text-[11px] font-extrabold uppercase tracking-wide text-[#1d3a8f]">Your compliance</div><div className="text-[13px] text-[var(--ink-3)]">{validReq} of {requiredTypes.length} required certificate{requiredTypes.length === 1 ? "" : "s"} valid</div></div>
            <div className="min-w-[140px] flex-1"><div className="h-2 overflow-hidden rounded-full bg-[var(--panel)]"><div className={"h-full rounded-full transition-all " + (pct === 100 ? "bg-[#0f9d58]" : "bg-[#b45309]")} style={{ width: `${pct}%` }} /></div></div>
            <span className="text-[15px] font-extrabold tabular-nums text-[var(--ink)]">{pct}%</span>
          </div>
          {outstanding.length > 0 && (
            <div className="mt-3 rounded-xl border border-[#f3cfa6] bg-[#fdf3e0] px-3.5 py-2.5">
              <div className="text-[12.5px] font-extrabold text-[#8a4b09]">⚠ {outstanding.length} required certificate{outstanding.length === 1 ? "" : "s"} need{outstanding.length === 1 ? "s" : ""} your attention</div>
              <div className="mt-0.5 text-[12px] text-[#8a4b09]">{outstanding.map((t) => `${t.name} (${credStatus(mine(t.id))})`).join(" · ")}</div>
            </div>
          )}
        </Card>

        <div className="mb-1.5 flex items-center gap-2">
          <h3 className="text-[13px] font-extrabold uppercase tracking-wide text-[var(--ink-2)]">Required by your provider</h3>
          <span className="rounded-full bg-[#fdecec] px-2 py-0.5 text-[10px] font-bold text-[#c0392b]">Compulsory for your role</span>
        </div>
        {requiredShown.length ? (
          <div className="grid gap-2.5 sm:grid-cols-2">{requiredShown.map(certCard)}</div>
        ) : <Card className="p-4 text-center text-[12.5px] text-[var(--ink-3)]">Your provider hasn't set any compulsory certificates for your role.</Card>}

        {optionalShown.length > 0 && (<>
          <h3 className="mb-1.5 mt-4 text-[13px] font-extrabold uppercase tracking-wide text-[var(--ink-2)]">Other credentials</h3>
          <div className="grid gap-2.5 sm:grid-cols-2">{optionalShown.map(certCard)}</div>
        </>)}

        <p className="mt-3 text-[11.5px] text-[var(--ink-3)]">Which certificates are compulsory is set by your provider in Setup. Your manager keeps the single verified record — missing or expiring ones show on their dashboard and trigger reminders.</p>
      </>)}

      {view === "courses" && (
        myCourses.length ? (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {myCourses.map(({ a, c }) => { const p = progress[c.id]; const state = p?.passed ? "Complete" : p && p.pct > 0 ? "In progress" : "Not started"; const mins = c.lessons.reduce((n, l) => n + l.mins, 0); return (
              <Card key={c.id} className="p-3.5">
                <div className="mb-1 flex items-center gap-2"><span className="text-[13.5px] font-extrabold text-[var(--ink)]">{c.title}</span>{a.required ? <span className="rounded-full bg-[#fdecec] px-2 py-0.5 text-[10px] font-bold text-[#c0392b]">Required</span> : <span className="rounded-full bg-[#eef1f6] px-2 py-0.5 text-[10px] font-bold text-[#64748b]">Optional</span>}</div>
                <div className="mb-2 text-[11.5px] text-[var(--ink-3)]">⏱ ~{mins} min{a.due && a.due !== "—" ? ` · due ${a.due}` : ""} · {state}</div>
                <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full bg-[#0f9d58] transition-all" style={{ width: `${p?.pct ?? 0}%` }} /></div>
                <Button variant="primary" onClick={() => setPlayer(c)}>{p?.passed ? "Review" : p && p.pct > 0 ? "Continue" : "Start"}</Button>
              </Card>
            ); })}
          </div>
        ) : <Card className="p-6 text-center text-[13px] text-[var(--ink-3)]">No courses assigned to you yet — your manager assigns training in the Learning Centre.</Card>
      )}

      {edit && <CredEditor rec={edit} types={cred.types} lockStaff onSave={(x) => { cred.upsertRecord(x); setEdit(null); }} onClose={() => setEdit(null)} />}
    </div>
  );
}
