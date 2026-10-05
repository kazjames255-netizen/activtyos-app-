"use client";

// Staff certificates & credentials — the MANAGER oversight, in the Staff/Team
// area (moved out of the Learning Centre). Staff upload/renew in their own "My
// learning" area; here the manager sees the compliance matrix, verifies, chases
// and exports. Front-end demo store (see credentials.tsx); backend owed to Amir.
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button, Card, Select } from "@/components/ui";
import { LIGHT_PALETTE, PageHero, CollapsibleStats } from "@/components/OperatorPage";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n/provider";
import { credTypeName, credStatusWord, useCredentials, credStatus, CredBadge, CredEditor, blankRecord, openCredFile, appliesTo, targetLabel, exportCredsPdf, exportCredsPack, credFiles, fmtDate, daysUntil, type CredRecord, type CredStatus } from "./credentials";
import { useTeam } from "@/features/team/useTeam";
import { csvText } from "@/lib/csv";
import { useLearnRefresh, syncLearning, completionsFor, downloadCourseCertificate, courseCertData, courseCertTemplate, courseInDate, courseExpiry } from "./courseCompletions";

// Location filter options come from the team's real locations (never hardcoded demo sites).
const opsFor = (team: { op?: string }[]): [string, string][] => {
  const named = Array.from(new Set(team.map((s) => s.op).filter((o): o is string => !!o && o !== "Company-owned")));
  return [["all", "All locations"], ...(team.some((s) => s.op === "Company-owned") ? [["Company-owned", "Company-owned (Head Office)"] as [string, string]] : []), ...named.map((o) => [o, o] as [string, string])];
};

export function CredentialsApp() {
  const tr = useT();
  const opLabel = (v: string, l: string) => (v === "all" ? tr("p8lrn.lcAllLocations") : v === "Company-owned" ? tr("p8lrn.lcCompanyOwnedHO") : l);
  const TEAM = useTeam();
  const cred = useCredentials(TEAM);
  const OPS = opsFor(TEAM);
  const { settings } = useSettings();
  // Completions come from the server (courseCompletions.syncLearning) — re-render when they land.
  useLearnRefresh();
  useEffect(() => { void syncLearning(); }, []);
  const router = useRouter();
  const portal = (usePathname() || "/company").split("/")[1] || "company";
  const [op, setOp] = useState("all");
  const [showCourses, setShowCourses] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<CredStatus | "all">("all");
  const [edit, setEdit] = useState<CredRecord | null>(null);
  const [cell, setCell] = useState<{ staff: string; typeId: string } | null>(null);
  const [profile, setProfile] = useState<{ name: string; role: string; op: string } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [packCfg, setPackCfg] = useState(false);
  const [xStaff, setXStaff] = useState<Set<string>>(new Set());
  const [xTypes, setXTypes] = useState<Set<string>>(new Set());
  const [xDocs, setXDocs] = useState(true);
  const [xCourses, setXCourses] = useState(false);
  const [xCourseIds, setXCourseIds] = useState<Set<string>>(new Set());

  const staff = op === "all" ? TEAM : TEAM.filter((s) => s.op === op);
  const visTypes = typeFilter === "all" ? cred.types : cred.types.filter((t) => t.id === typeFilter);
  const cells = staff.flatMap((s) => cred.types.map((t) => ({ req: t.required, applies: appliesTo(t, s.name, s.role), st: credStatus(cred.recordFor(s.name, t.id)) })));
  const cnt = (st: CredStatus) => st === "Missing" ? cells.filter((c) => c.st === "Missing" && c.req && c.applies).length : cells.filter((c) => c.st === st).length;
  const rows = staff.filter((s) => statusFilter === "all" || visTypes.some((t) => { const st = credStatus(cred.recordFor(s.name, t.id)); if (st !== statusFilter) return false; return statusFilter === "Missing" ? t.required && appliesTo(t, s.name, s.role) : true; }));
  const csv = () => { const rowsCsv = csvText([[tr("p8lrn.docColStaff"), tr("p8lrn.lcColLocation"), ...cred.types.map((t) => credTypeName(t))], ...staff.map((s) => [s.name, s.op, ...cred.types.map((t) => credStatusWord(credStatus(cred.recordFor(s.name, t.id))))])]); const url = URL.createObjectURL(new Blob([rowsCsv], { type: "text/csv" })); const a = document.createElement("a"); a.href = url; a.download = "staff-credentials.csv"; a.click(); URL.revokeObjectURL(url); };
  const providerName = settings.providerName || settings.billing?.businessName || "Your company";
  // distinct completed courses across the staff currently in scope
  const courseOpts = Array.from(new Map(staff.flatMap((s) => completionsFor(s.name)).map((d) => [d.courseId, d.title])).entries());
  const openPack = () => { setXStaff(new Set(staff.map((s) => s.name))); setXTypes(new Set(cred.types.map((t) => t.id))); setXDocs(true); setXCourses(false); setXCourseIds(new Set(courseOpts.map(([id]) => id))); setPackCfg(true); setExportOpen(false); };
  const runPack = () => {
    const selStaff = staff.filter((s) => xStaff.has(s.name));
    const selTypes = cred.types.filter((t) => xTypes.has(t.id));
    const courseCerts = xCourses ? selStaff.flatMap((s) => completionsFor(s.name).filter((d) => xCourseIds.has(d.courseId)).map((d) => ({ data: courseCertData(s.name, d, settings), templateId: courseCertTemplate(settings) }))) : [];
    exportCredsPack({ staff: selStaff, types: selTypes, getRec: cred.recordFor, provider: providerName, withDocs: xDocs, courseCerts });
    setPackCfg(false);
  };
  const toggleSet = (set: Set<string>, fn: (s: Set<string>) => void, v: string) => { const n = new Set(set); n.has(v) ? n.delete(v) : n.add(v); fn(n); };

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero title={tr("p8lrn.crTitle")} icon="🎖" lede={tr("p8lrn.crLede")} />

      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="text-[12px] font-bold text-[var(--ink-3)]">{tr("p8lrn.crLocationLbl")}</label>
          <Select value={op} onChange={(e) => setOp(e.target.value)} className="max-w-[240px]">{OPS.map(([k, l]) => <option key={k} value={k}>{opLabel(k, l)}</option>)}</Select>
          <button type="button" onClick={() => setShowCourses((v) => !v)} className={"ms-auto inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px] font-bold transition-colors " + (showCourses ? "border-[#1d3a8f] bg-[#eaf1ff] text-[#1d3a8f]" : "border-[var(--line)] bg-white text-[var(--ink-2)] hover:border-[#1d3a8f]")}><span className={"grid h-4 w-7 items-center rounded-full px-0.5 transition-colors " + (showCourses ? "bg-[#1d3a8f]" : "bg-[var(--line)]")}><span className={"h-3 w-3 rounded-full bg-white transition-transform " + (showCourses ? "translate-x-3 rtl:-translate-x-3" : "")} /></span>{tr("p8lrn.crInternalCourses")}</button>
        </div>

        <CollapsibleStats id="credentials">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {([["Expiring", tr("p8lrn.lcStatExpiringSoon"), "#b45309", "#fdf3e0", "⏳"], ["Expired", tr("p8lrn.lcStatExpiredLower"), "#c0392b", "#fdeceb", "⛔"], ["Pending", tr("p8lrn.lcStatToVerify"), "#1d54c4", "#eaf1ff", "🔎"], ["Missing", tr("p8lrn.lcStatRequiredMissing"), "#5b6577", "#eef1f6", "➖"]] as const).map(([st, lbl, col, bg, icon]) => { const on = statusFilter === st; return (
            <button key={st} type="button" onClick={() => setStatusFilter(on ? "all" : st)} className={"flex items-center gap-3 rounded-2xl border border-transparent px-3.5 py-3 text-start transition-all " + (on ? "ring-2 ring-offset-1" : "hover:-translate-y-0.5 hover:shadow-md")} style={{ background: bg, ...(on ? ({ "--tw-ring-color": col } as React.CSSProperties) : {}) }}><span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-white/70 text-[17px]">{icon}</span><div><div className="text-[22px] font-extrabold leading-none tabular-nums" style={{ color: col }}>{cnt(st)}</div><div className="mt-0.5 text-[11px] font-semibold" style={{ color: col }}>{lbl}</div></div></button>
          ); })}
        </div>
        </CollapsibleStats>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative">
            <Button onClick={() => setExportOpen((v) => !v)}>{tr("p8lrn.lcExportMenu")}</Button>
            {exportOpen && (
              <div className="absolute z-20 mt-1 w-[240px] rounded-xl border border-[var(--line)] bg-white p-1 shadow-xl">
                {([[tr("p8lrn.lcExpCsv"), () => csv()], [tr("p8lrn.lcExpPdfReg"), () => exportCredsPdf(staff, cred.types, cred.recordFor, providerName, false)], [tr("p8lrn.crExpPdfDocsCourses"), () => openPack()]] as const).map(([lbl, fn]) => (
                  <button key={lbl} type="button" onClick={() => { fn(); setExportOpen(false); }} className="block w-full rounded-lg px-3 py-2 text-start text-[12.5px] font-semibold text-[var(--ink-2)] hover:bg-[var(--panel)]">{lbl}</button>
                ))}
              </div>
            )}
          </div>
          <Button variant="primary" onClick={() => setEdit(blankRecord(staff[0]?.name ?? "", cred.types[0]?.id ?? ""))}>{tr("p8lrn.lcAddCert")}</Button>
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="max-w-[200px]"><option value="all">{tr("p8lrn.lcAllCreds")}</option>{cred.types.map((t) => <option key={t.id} value={t.id}>{credTypeName(t)}</option>)}</Select>
          {statusFilter !== "all" && <button type="button" onClick={() => setStatusFilter("all")} className="text-[12px] font-bold text-[#1d3a8f] hover:underline">{tr("p8lrn.lcClearX")}</button>}
        </div>

        <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
          <table className="w-full text-[13px]"><thead><tr className="bg-[var(--panel)] text-start text-[11px] uppercase tracking-wide text-[var(--ink-3)]"><th className="px-3 py-2.5 font-extrabold">{tr("p8lrn.docColStaff")}</th><th className="px-3 py-2.5 font-extrabold">{tr("p8lrn.lcColLocation")}</th>{visTypes.map((t) => <th key={t.id} title={t.required ? tr("p8lrn.lcRequiredFor", { who: targetLabel(t) }) : tr("p8lrn.lcStOptional")} className="whitespace-nowrap px-3 py-2.5 font-extrabold">{credTypeName(t)}{t.required && <span className="ms-0.5 text-[#c0392b]">*</span>}</th>)}{showCourses && <th className="whitespace-nowrap px-3 py-2.5 font-extrabold" title={tr("p8lrn.crOnlyInDateTip")}>{tr("p8lrn.crInternalCourses")} <span className="font-semibold normal-case text-[#0f7a43]">{tr("p8lrn.crInDate")}</span></th>}</tr></thead>
            <tbody>{rows.map((s) => (
              <tr key={s.name} className="border-t border-[var(--line-2,#eef2f8)]"><td className="px-3 py-2.5"><button type="button" onClick={() => setProfile({ name: s.name, role: s.role, op: s.op })} className="font-bold text-[#1d3a8f] hover:underline" title={tr("p8lrn.crOpenProfile")}>{s.name}</button></td><td className="px-3 py-2.5 text-[var(--ink-2)]">{s.op}</td>{visTypes.map((t) => { const r = cred.recordFor(s.name, t.id); if (!appliesTo(t, s.name, s.role) && !r) return <td key={t.id} className="px-3 py-2 text-[var(--ink-3)]" title={tr("p8lrn.lcNotRequiredFor")}>—</td>; return <td key={t.id} className="px-3 py-2"><button type="button" onClick={() => setCell({ staff: s.name, typeId: t.id })} className="transition-opacity hover:opacity-70"><CredBadge s={credStatus(r)} /></button></td>; })}{showCourses && (() => { const inDate = completionsFor(s.name).filter((d) => courseInDate(d, settings)); return <td className="px-3 py-2"><div className="flex max-w-[320px] flex-wrap gap-1">{inDate.length ? inDate.map((d) => { const exp = courseExpiry(d, settings); return <button key={d.courseId} type="button" onClick={() => downloadCourseCertificate(s.name, d, settings)} title={exp ? tr("p8lrn.crInDateUntilTip", { until: fmtDate(exp.toISOString().slice(0, 10)), score: d.score, done: fmtDate(d.date) }) : tr("p8lrn.crInDateNoExpTip", { score: d.score, done: fmtDate(d.date) })} className="inline-flex max-w-[210px] items-center gap-1 truncate rounded-full bg-[#e6f4ea] px-2 py-0.5 text-[10.5px] font-bold text-[#0f7a43] hover:bg-[#d4ecdb]"><span className="text-[8px]">✓</span><span className="truncate">{d.title}</span></button>; }) : <span className="text-[11px] text-[var(--ink-3)]">{tr("p8lrn.crNoneInDate")}</span>}</div></td>; })()}</tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={visTypes.length + (showCourses ? 3 : 2)} className="px-3 py-6 text-center text-[12.5px] text-[var(--ink-3)]">{tr("p8lrn.lcNoStaffFilter")}</td></tr>}</tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-[var(--ink-3)]"><span className="text-[#c0392b]">*</span> {tr("p8lrn.lcLegendRequired")} <button type="button" onClick={() => router.push(`/${portal}/setup?tab=learning#credtypes`)} className="font-bold text-[#1d3a8f] underline hover:text-[#16297a]">{tr("p8lrn.lcSetupLearning")}</button>.</p>
      </Card>

      {showCourses && (
        <Card className="mt-3 p-4">
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-[14px] font-extrabold text-[var(--ink)]">{tr("p8lrn.crCoursesCompletedHead")}</h3>
            <span className="rounded-full bg-[#eaf1ff] px-2 py-0.5 text-[11px] font-bold text-[#1d3a8f]">{tr("p8lrn.crBrandTraining")}</span>
          </div>
          <div className="grid gap-2.5">
            {staff.map((s) => { const done = completionsFor(s.name); return (
              <div key={s.name} className="rounded-xl border border-[var(--line)] p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-[13.5px] font-extrabold text-[var(--ink)]">{s.name}</span>
                  <span className="text-[11.5px] text-[var(--ink-3)]">{s.role} · {s.op}</span>
                  <span className="ms-auto text-[11.5px] font-bold text-[var(--ink-2)]">{tr("p8lrn.crCompletedN", { n: done.length })}</span>
                </div>
                {done.length ? (
                  <div className="flex flex-wrap gap-2">
                    {done.map((d) => (
                      <button key={d.courseId} type="button" onClick={() => downloadCourseCertificate(s.name, d, settings)} title={tr("p8lrn.crDownloadCertTip")} className="group inline-flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1.5 text-start hover:border-[#1d3a8f]">
                        <span className="max-w-[220px] truncate text-[12px] font-bold text-[var(--ink)]">{d.title}</span>
                        <span className="rounded-full bg-[#e6f4ea] px-1.5 py-0.5 text-[10px] font-extrabold text-[#0f7a43] tabular-nums" title={d.selfReported ? tr("p8lrn.crSelfReportedTip") : undefined}>{d.score}%{d.selfReported ? tr("p8lrn.crSelfSuffix") : ""}</span>
                        <span className="text-[10.5px] text-[var(--ink-3)]">{fmtDate(d.date)}</span>
                        <span className="text-[11px] font-bold text-[#1d3a8f] group-hover:underline">{tr("p8lrn.crCertBtn")}</span>
                      </button>
                    ))}
                  </div>
                ) : <p className="text-[12px] text-[var(--ink-3)]">{tr("p8lrn.crNoCoursesYet")}</p>}
              </div>
            ); })}
          </div>
          <p className="mt-3 text-[11px] text-[var(--ink-3)]">{tr("p8lrn.crAssignMoreA")} <button type="button" onClick={() => router.push(`/${portal}/learning`)} className="font-bold text-[#1d3a8f] underline hover:text-[#16297a]">{tr("p8lrn.lcTitle")}</button>{tr("p8lrn.crAssignMoreB")}</p>
        </Card>
      )}

      {packCfg && (() => {
        const nCerts = xCourses ? staff.filter((s) => xStaff.has(s.name)).reduce((n, s) => n + completionsFor(s.name).filter((d) => xCourseIds.has(d.courseId)).length, 0) : 0;
        const allStaff = xStaff.size === staff.length; const allTypes = xTypes.size === cred.types.length; const allCourses = xCourseIds.size === courseOpts.length;
        const row = (key: string, checked: boolean, onClick: () => void, label: React.ReactNode, sub?: string) => (
          <label key={key} className={"flex min-w-0 cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors " + (checked ? "border-[#1d3a8f] bg-[#eef4ff]" : "border-[var(--line)] hover:bg-[var(--panel)]")}><input type="checkbox" checked={checked} onChange={onClick} className="h-3.5 w-3.5 flex-none accent-[#1d3a8f]" /><span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-semibold text-[var(--ink)]">{label}</span>{sub && <span className="block truncate text-[10px] text-[var(--ink-3)]">{sub}</span>}</span></label>
        );
        const secHead = (title: string, all: boolean, onToggle: () => void) => (
          <div className="mb-1.5 flex items-center gap-2"><span className="text-[10.5px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{title}</span><button type="button" onClick={onToggle} className="ms-auto text-[11px] font-bold text-[#1d3a8f] hover:underline">{all ? tr("p8lrn.crClearAll") : tr("p8lrn.crSelectAll")}</button></div>
        );
        return (
          <div className="fixed inset-0 z-[141] flex items-center justify-center bg-black/45 p-4" onClick={() => setPackCfg(false)}>
            <div className="flex max-h-[86vh] w-full max-w-lg select-none flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()} style={LIGHT_PALETTE}>
              <div className="flex-none border-b border-[var(--line)] px-5 py-3.5">
                <div className="flex items-center gap-2"><h3 className="text-[15px] font-extrabold text-[var(--ink)]">{tr("p8lrn.crBuildPack")}</h3><button type="button" onClick={() => setPackCfg(false)} className="ms-auto text-[18px] text-[var(--ink-3)] hover:text-[var(--ink)]">×</button></div>
                <p className="mt-0.5 text-[11.5px] text-[var(--ink-3)]">{tr("p8lrn.crPackSub", { loc: opLabel(op, op) })}</p>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4">
                <div className="mb-4">
                  {secHead(tr("p8lrn.docColStaff"), allStaff, () => setXStaff(allStaff ? new Set() : new Set(staff.map((s) => s.name))))}
                  <div className="grid grid-cols-2 gap-1.5">{staff.map((s) => row(s.name, xStaff.has(s.name), () => toggleSet(xStaff, setXStaff, s.name), s.name, s.op))}</div>
                </div>

                <div className="mb-4">
                  {secHead(tr("p8lrn.crSecCredentials"), allTypes, () => setXTypes(allTypes ? new Set() : new Set(cred.types.map((t) => t.id))))}
                  <div className="grid grid-cols-2 gap-1.5">{cred.types.map((t) => row(t.id, xTypes.has(t.id), () => toggleSet(xTypes, setXTypes, t.id), credTypeName(t), t.required ? tr("p8lrn.crReqLower") : tr("p8lrn.crOptLower")))}</div>
                </div>

                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-[var(--panel)] px-3 py-2"><input type="checkbox" checked={xDocs} onChange={() => setXDocs((v) => !v)} className="h-4 w-4 accent-[#1d3a8f]" /><span className="text-[12.5px] font-bold text-[var(--ink)]">{tr("p8lrn.crAttachFiles")}</span></label>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-[var(--panel)] px-3 py-2"><input type="checkbox" checked={xCourses} onChange={() => setXCourses((v) => !v)} className="h-4 w-4 accent-[#1d3a8f]" /><span className="text-[12.5px] font-bold text-[var(--ink)]">{tr("p8lrn.crIncludeCourseCerts")}</span></label>
                </div>

                {xCourses && (courseOpts.length ? (
                  <div className="mt-3">
                    {secHead(tr("p8lrn.crSecWhichCourses"), allCourses, () => setXCourseIds(allCourses ? new Set() : new Set(courseOpts.map(([id]) => id))))}
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">{courseOpts.map(([id, title]) => row(id, xCourseIds.has(id), () => toggleSet(xCourseIds, setXCourseIds, id), title))}</div>
                  </div>
                ) : <p className="mt-2 text-[12px] text-[var(--ink-3)]">{tr("p8lrn.crNoCompletedCourses")}</p>)}
              </div>

              <div className="flex flex-none items-center gap-2 border-t border-[var(--line)] px-5 py-3">
                <span className="text-[11.5px] text-[var(--ink-3)]">{tr("p8lrn.crPackSummary", { s: xStaff.size, c: xTypes.size })}{xCourses ? tr("p8lrn.crPackSummaryCerts", { n: nCerts }) : ""}</span>
                <Button onClick={() => setPackCfg(false)} className="ms-auto">{tr("p8lrn.gCancel")}</Button>
                <Button variant="primary" disabled={!xStaff.size || !xTypes.size} onClick={runPack}>{tr("p8lrn.crGeneratePdf")}</Button>
              </div>
            </div>
          </div>);
      })()}

      {profile && (() => {
        const applic = cred.types.filter((t) => appliesTo(t, profile.name, profile.role) || cred.recordFor(profile.name, t.id));
        const reqTypes = cred.types.filter((t) => t.required && appliesTo(t, profile.name, profile.role));
        const validReq = reqTypes.filter((t) => credStatus(cred.recordFor(profile.name, t.id)) === "Valid").length;
        const pc = reqTypes.length ? Math.round((validReq / reqTypes.length) * 100) : 100;
        const outstanding = reqTypes.filter((t) => credStatus(cred.recordFor(profile.name, t.id)) !== "Valid");
        const done = completionsFor(profile.name);
        return (
          <div className="fixed inset-0 z-[139] flex justify-end bg-black/45" onClick={() => setProfile(null)}>
            <div className="h-full w-full max-w-lg overflow-y-auto bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()} style={LIGHT_PALETTE}>
              <div className="mb-1 flex items-start gap-2">
                <div><h3 className="text-[18px] font-extrabold text-[var(--ink)]">{profile.name}</h3><div className="text-[12.5px] text-[var(--ink-3)]">{profile.role} · {profile.op}</div></div>
                <button type="button" onClick={() => setProfile(null)} className="ms-auto text-[20px] text-[var(--ink-3)] hover:text-[var(--ink)]">×</button>
              </div>

              <div className="my-3 rounded-xl border border-[var(--line)] p-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1"><div className="text-[11px] font-extrabold uppercase tracking-wide text-[#1d3a8f]">{tr("p8lrn.cmpTitle")}</div><div className="text-[12.5px] text-[var(--ink-3)]">{tr("p8lrn.crRequiredValid", { a: validReq, b: reqTypes.length })}</div></div>
                  <div className="min-w-[120px] flex-1"><div className="h-2 overflow-hidden rounded-full bg-[var(--panel)]"><div className={"h-full rounded-full " + (pc === 100 ? "bg-[#0f9d58]" : "bg-[#b45309]")} style={{ width: `${pc}%` }} /></div></div>
                  <span className="text-[15px] font-extrabold tabular-nums text-[var(--ink)]">{pc}%</span>
                </div>
                {outstanding.length > 0 && <div className="mt-2 text-[12px] font-semibold text-[#8a4b09]">{tr("p8lrn.crNeedsAttention", { list: outstanding.map((t) => `${credTypeName(t)} (${credStatusWord(credStatus(cred.recordFor(profile.name, t.id)))})`).join(" · ") })}</div>}
              </div>

              <h4 className="mb-1.5 text-[12px] font-extrabold uppercase tracking-wide text-[var(--ink-2)]">{tr("p8lrn.crCertificatesHead")}</h4>
              <div className="space-y-1.5">
                {applic.map((t) => { const r = cred.recordFor(profile.name, t.id); const st = credStatus(r); const dl = daysUntil(r?.expiry); const fs = credFiles(r); return (
                  <div key={t.id} className="rounded-lg border border-[var(--line)] p-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[12.5px] font-bold text-[var(--ink)]">{credTypeName(t)}</span>
                      {t.required && appliesTo(t, profile.name, profile.role) ? <span className="rounded-full bg-[#fdecec] px-1.5 py-0.5 text-[9px] font-bold text-[#c0392b]">{tr("p8lrn.lcStRequired")}</span> : <span className="rounded-full bg-[#eef1f6] px-1.5 py-0.5 text-[9px] font-bold text-[#64748b]">{tr("p8lrn.lcStOptional")}</span>}
                      <span className="ms-auto"><CredBadge s={st} /></span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-[var(--ink-3)]">
                      {r?.issue && <span>{tr("p8lrn.cmpFldIssued")} <b className="text-[var(--ink-2)]">{fmtDate(r.issue)}</b></span>}
                      {r?.expiry && <span>{tr("p8lrn.cmpFldExpires")} <b className="text-[var(--ink-2)]">{fmtDate(r.expiry)}</b>{dl != null && dl >= 0 && dl <= 60 ? <span className="text-[#b45309]"> · {dl}d</span> : null}{dl != null && dl < 0 ? <span className="text-[#c0392b]">{tr("p8lrn.lcExpiredSuffix")}</span> : null}</span>}
                      {!r && <span className="font-semibold text-[#c0392b]">{tr("p8lrn.crNotOnFile")}</span>}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      {fs.map((f, i) => <button key={i} type="button" onClick={() => openCredFile(f.data)} className="text-[11px] font-bold text-[#1d3a8f] hover:underline">📎 {i === fs.length - 1 ? tr("p8lrn.crCurrent") : tr("p8lrn.crOlder")}</button>)}
                      {r && st === "Pending" && <button type="button" onClick={() => cred.upsertRecord({ ...r, verified: "verified" })} className="text-[11px] font-bold text-[#0f7a43] hover:underline">{tr("p8lrn.lcVerify")}</button>}
                      <button type="button" onClick={() => setEdit(r ?? blankRecord(profile.name, t.id))} className="ms-auto text-[11px] font-bold text-[#1d3a8f] hover:underline">{r ? tr("p8lrn.gEdit") : tr("p8lrn.gAdd")}</button>
                    </div>
                  </div>
                ); })}
                {!applic.length && <div className="text-[12px] text-[var(--ink-3)]">{tr("p8lrn.crNoCredsApply")}</div>}
              </div>

              <h4 className="mb-1.5 mt-4 text-[12px] font-extrabold uppercase tracking-wide text-[var(--ink-2)]">{tr("p8lrn.crCoursesCompletedHead")}</h4>
              {done.length ? (
                <div className="space-y-1.5">
                  {done.map((d) => (
                    <div key={d.courseId} className="flex items-center gap-2 rounded-lg border border-[var(--line)] px-2.5 py-1.5">
                      <span className="truncate text-[12.5px] font-bold text-[var(--ink)]">{d.title}</span>
                      <span className="rounded-full bg-[#e6f4ea] px-1.5 py-0.5 text-[10px] font-extrabold text-[#0f7a43] tabular-nums" title={d.selfReported ? tr("p8lrn.crSelfReportedTip") : undefined}>{d.score}%{d.selfReported ? tr("p8lrn.crSelfSuffix") : ""}</span>
                      <span className="text-[10.5px] text-[var(--ink-3)]">{fmtDate(d.date)}</span>
                      <button type="button" onClick={() => downloadCourseCertificate(profile.name, d, settings)} className="ms-auto text-[11px] font-bold text-[#1d3a8f] hover:underline">{tr("p8lrn.crCertBtn")}</button>
                    </div>
                  ))}
                </div>
              ) : <div className="text-[12px] text-[var(--ink-3)]">{tr("p8lrn.crNoCoursesYet")}</div>}

              <div className="mt-4 flex gap-2"><Button variant="primary" onClick={() => setEdit(blankRecord(profile.name, cred.types[0]?.id ?? ""))}>{tr("p8lrn.lcAddCert")}</Button><Button onClick={() => setProfile(null)}>{tr("p8lrn.gClose")}</Button></div>
            </div>
          </div>);
      })()}

      {edit && <CredEditor rec={edit} types={cred.types} staffList={TEAM} onSave={(r) => { cred.upsertRecord(r); setEdit(null); }} onClose={() => setEdit(null)} />}

      {cell && (() => {
        const t = cred.types.find((x) => x.id === cell.typeId); const r = cred.recordFor(cell.staff, cell.typeId); const st = credStatus(r); const dl = daysUntil(r?.expiry);
        return (
          <div className="fixed inset-0 z-[138] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[6vh]" onClick={() => setCell(null)}>
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()} style={LIGHT_PALETTE}>
              <div className="mb-1 flex items-center gap-2"><h3 className="text-[15px] font-extrabold text-[var(--ink)]">{t ? credTypeName(t) : tr("p8lrn.lcCredentialWord")}</h3><CredBadge s={st} /><button type="button" onClick={() => setCell(null)} className="ms-auto text-[18px] text-[var(--ink-3)]">×</button></div>
              <div className="mb-3 text-[12px] text-[var(--ink-3)]">{cell.staff}</div>
              {r ? (<>
                <div className="grid grid-cols-2 gap-2 text-[12.5px]">
                  <div className="rounded-lg bg-[var(--panel)] px-3 py-2"><div className="text-[10px] font-extrabold uppercase text-[var(--ink-3)]">{tr("p8lrn.cmpFldIssued")}</div><div className="font-bold text-[var(--ink)]">{fmtDate(r.issue)}</div></div>
                  <div className="rounded-lg bg-[var(--panel)] px-3 py-2"><div className="text-[10px] font-extrabold uppercase text-[var(--ink-3)]">{tr("p8lrn.cmpFldExpires")}</div><div className="font-bold text-[var(--ink)]">{fmtDate(r.expiry)}{dl != null && dl >= 0 && dl <= 60 ? <span className="text-[#b45309]"> · {dl}d</span> : null}{dl != null && dl < 0 ? <span className="text-[#c0392b]">{tr("p8lrn.lcExpiredSuffix")}</span> : null}</div></div>
                  {r.issuer && <div className="rounded-lg bg-[var(--panel)] px-3 py-2"><div className="text-[10px] font-extrabold uppercase text-[var(--ink-3)]">{tr("p8lrn.lcIssuer")}</div><div className="font-bold text-[var(--ink)]">{r.issuer}</div></div>}
                  {r.number && <div className="rounded-lg bg-[var(--panel)] px-3 py-2"><div className="text-[10px] font-extrabold uppercase text-[var(--ink-3)]">{tr("p8lrn.lcNumber")}</div><div className="font-bold text-[var(--ink)]">{r.number}</div></div>}
                  {t?.dbs && r.dbsLevel && <div className="col-span-2 rounded-lg bg-[var(--panel)] px-3 py-2"><div className="text-[10px] font-extrabold uppercase text-[var(--ink-3)]">DBS</div><div className="font-bold text-[var(--ink)]">{r.dbsLevel}{r.dbsUpdate ? tr("p8lrn.lcOnUpdateService") : ""}{r.dbsUpdateNo ? " · " + r.dbsUpdateNo : ""}</div></div>}
                </div>
                {credFiles(r).length > 0 && (() => { const fs = credFiles(r); return (
                  <div className="mt-2 space-y-1">
                    <div className="text-[10px] font-extrabold uppercase text-[var(--ink-3)]">{fs.length > 1 ? tr("p8lrn.crDocumentsN", { n: fs.length }) : tr("p8lrn.crDocument")}</div>
                    {fs.slice().reverse().map((f, i) => { const latest = i === 0; return (
                      <button key={i} type="button" onClick={() => openCredFile(f.data)} className="flex w-full items-center gap-2 rounded-lg border border-[var(--line)] px-3 py-1.5 text-start text-[12px] font-semibold text-[#1d3a8f] hover:border-[#1d3a8f]">📎 <span className="truncate">{f.name}</span>{latest ? <span className="rounded-full bg-[#e6f4ea] px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-[#0f7a43]">{tr("p8lrn.crCurrent")}</span> : <span className="rounded-full bg-[#eef1f6] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#64748b]">{tr("p8lrn.crOlder")}</span>}{f.at && <span className="ms-auto text-[10px] font-normal text-[var(--ink-3)]">{fmtDate(f.at.slice(0, 10))}</span>}</button>
                    ); })}
                  </div>
                ); })()}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {r.verified !== "verified" && <Button variant="primary" onClick={() => cred.upsertRecord({ ...r, verified: "verified" })}>{tr("p8lrn.lcVerify")}</Button>}
                  {r.verified !== "rejected" && <Button onClick={() => cred.upsertRecord({ ...r, verified: "rejected" })}>{tr("p8lrn.lcReject")}</Button>}
                  <Button onClick={() => { setEdit(r); setCell(null); }}>{tr("p8lrn.gEdit")}</Button>
                  <button type="button" title={tr("p8lrn.gDelete")} onClick={() => { if (typeof window !== "undefined" && window.confirm(tr("p8lrn.lcConfirmDelCert"))) { cred.deleteRecord(r.id); setCell(null); } }} className="ms-auto text-[15px] text-[var(--ink-3)] hover:text-[#c0392b]">🗑</button>
                </div>
              </>) : (<>
                <p className="rounded-lg bg-[#fdecec] px-3 py-2.5 text-[12.5px] font-semibold text-[#c0392b]">{tr("p8lrn.lcNoCredOnFile", { type: t ? credTypeName(t) : tr("p8lrn.lcCredentialWord"), staff: cell.staff })}</p>
                <div className="mt-3 flex justify-end gap-2"><Button onClick={() => setCell(null)}>{tr("p8lrn.gClose")}</Button><Button variant="primary" onClick={() => { setEdit(blankRecord(cell.staff, cell.typeId)); setCell(null); }}>{tr("p8lrn.lcAddOnBehalf")}</Button></div>
              </>)}
            </div>
          </div>);
      })()}
    </div>
  );
}
