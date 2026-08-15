"use client";

// Staff certificates & credentials — the MANAGER oversight, in the Staff/Team
// area (moved out of the Learning Centre). Staff upload/renew in their own "My
// learning" area; here the manager sees the compliance matrix, verifies, chases
// and exports. Front-end demo store (see credentials.tsx); backend owed to Amir.
import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button, Card, Select } from "@/components/ui";
import { LIGHT_PALETTE, PageHero } from "@/components/OperatorPage";
import { useSettings } from "@/lib/settings";
import { useCredentials, credStatus, CredBadge, CredEditor, blankRecord, openCredFile, appliesTo, targetLabel, exportCredsPdf, exportCredsPack, credFiles, DEMO_STAFF, fmtDate, daysUntil, type CredRecord, type CredStatus } from "./credentials";
import { completionsFor, downloadCourseCertificate, courseCertData, courseCertTemplate } from "./courseCompletions";

const OPS: [string, string][] = [["all", "All locations"], ["Company-owned", "Company-owned (Head Office)"], ["Milton Keynes", "Milton Keynes"], ["Northampton", "Northampton"], ["Bedford", "Bedford"]];

export function CredentialsApp() {
  const cred = useCredentials(DEMO_STAFF);
  const { settings } = useSettings();
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

  const staff = op === "all" ? DEMO_STAFF : DEMO_STAFF.filter((s) => s.op === op);
  const visTypes = typeFilter === "all" ? cred.types : cred.types.filter((t) => t.id === typeFilter);
  const cells = staff.flatMap((s) => cred.types.map((t) => ({ req: t.required, applies: appliesTo(t, s.name, s.role), st: credStatus(cred.recordFor(s.name, t.id)) })));
  const cnt = (st: CredStatus) => st === "Missing" ? cells.filter((c) => c.st === "Missing" && c.req && c.applies).length : cells.filter((c) => c.st === st).length;
  const rows = staff.filter((s) => statusFilter === "all" || visTypes.some((t) => { const st = credStatus(cred.recordFor(s.name, t.id)); if (st !== statusFilter) return false; return statusFilter === "Missing" ? t.required && appliesTo(t, s.name, s.role) : true; }));
  const csv = () => { const e = (v: string | number) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }; const rowsCsv = [["Staff", "Location", ...cred.types.map((t) => t.name)], ...staff.map((s) => [s.name, s.op, ...cred.types.map((t) => credStatus(cred.recordFor(s.name, t.id)))])].map((r) => r.map(e).join(",")).join("\n"); const url = URL.createObjectURL(new Blob([rowsCsv], { type: "text/csv" })); const a = document.createElement("a"); a.href = url; a.download = "staff-credentials.csv"; a.click(); URL.revokeObjectURL(url); };
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
      <PageHero title="Staff certificates" icon="🎖" lede="Your team's DBS, First Aid and other credentials. Staff upload and renew in their own area; you verify, chase and export the single record here." />

      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="text-[12px] font-bold text-[var(--ink-3)]">Location</label>
          <Select value={op} onChange={(e) => setOp(e.target.value)} className="max-w-[240px]">{OPS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
          <button type="button" onClick={() => setShowCourses((v) => !v)} className={"ml-auto inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px] font-bold transition-colors " + (showCourses ? "border-[#1d3a8f] bg-[#eaf1ff] text-[#1d3a8f]" : "border-[var(--line)] bg-white text-[var(--ink-2)] hover:border-[#1d3a8f]")}><span className={"grid h-4 w-7 items-center rounded-full px-0.5 transition-colors " + (showCourses ? "bg-[#1d3a8f]" : "bg-[var(--line)]")}><span className={"h-3 w-3 rounded-full bg-white transition-transform " + (showCourses ? "translate-x-3" : "")} /></span>📚 Internal courses</button>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {([["Expiring", "expiring soon", "#b45309", "#fdf3e0", "⏳"], ["Expired", "expired", "#c0392b", "#fdeceb", "⛔"], ["Pending", "to verify", "#1d54c4", "#eaf1ff", "🔎"], ["Missing", "required missing", "#5b6577", "#eef1f6", "➖"]] as const).map(([st, lbl, col, bg, icon]) => { const on = statusFilter === st; return (
            <button key={st} type="button" onClick={() => setStatusFilter(on ? "all" : st)} className={"flex items-center gap-3 rounded-2xl border border-transparent px-3.5 py-3 text-left transition-all " + (on ? "ring-2 ring-offset-1" : "hover:-translate-y-0.5 hover:shadow-md")} style={{ background: bg, ...(on ? ({ "--tw-ring-color": col } as React.CSSProperties) : {}) }}><span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-white/70 text-[17px]">{icon}</span><div><div className="text-[22px] font-extrabold leading-none tabular-nums" style={{ color: col }}>{cnt(st)}</div><div className="mt-0.5 text-[11px] font-semibold" style={{ color: col }}>{lbl}</div></div></button>
          ); })}
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative">
            <Button onClick={() => setExportOpen((v) => !v)}>⬇ Export ▾</Button>
            {exportOpen && (
              <div className="absolute z-20 mt-1 w-[240px] rounded-xl border border-[var(--line)] bg-white p-1 shadow-xl">
                {([["CSV (spreadsheet)", () => csv()], ["PDF — register only", () => exportCredsPdf(staff, cred.types, cred.recordFor, providerName, false)], ["PDF — with docs / courses…", () => openPack()]] as const).map(([lbl, fn]) => (
                  <button key={lbl} type="button" onClick={() => { fn(); setExportOpen(false); }} className="block w-full rounded-lg px-3 py-2 text-left text-[12.5px] font-semibold text-[var(--ink-2)] hover:bg-[var(--panel)]">{lbl}</button>
                ))}
              </div>
            )}
          </div>
          <Button variant="primary" onClick={() => setEdit(blankRecord(staff[0]?.name ?? "", cred.types[0]?.id ?? ""))}>+ Add certificate</Button>
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="max-w-[200px]"><option value="all">All credentials</option>{cred.types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
          {statusFilter !== "all" && <button type="button" onClick={() => setStatusFilter("all")} className="text-[12px] font-bold text-[#1d3a8f] hover:underline">Clear ✕</button>}
        </div>

        <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
          <table className="w-full text-[13px]"><thead><tr className="bg-[var(--panel)] text-left text-[11px] uppercase tracking-wide text-[var(--ink-3)]"><th className="px-3 py-2.5 font-extrabold">Staff</th><th className="px-3 py-2.5 font-extrabold">Location</th>{visTypes.map((t) => <th key={t.id} title={t.required ? "Required for: " + targetLabel(t) : "Optional"} className="whitespace-nowrap px-3 py-2.5 font-extrabold">{t.name}{t.required && <span className="ml-0.5 text-[#c0392b]">*</span>}</th>)}{showCourses && <th className="px-3 py-2.5 font-extrabold">📚 Internal courses</th>}</tr></thead>
            <tbody>{rows.map((s) => (
              <tr key={s.name} className="border-t border-[var(--line-2,#eef2f8)]"><td className="px-3 py-2.5"><button type="button" onClick={() => setProfile({ name: s.name, role: s.role, op: s.op })} className="font-bold text-[#1d3a8f] hover:underline" title="Open full profile">{s.name}</button></td><td className="px-3 py-2.5 text-[var(--ink-2)]">{s.op}</td>{visTypes.map((t) => { const r = cred.recordFor(s.name, t.id); if (!appliesTo(t, s.name, s.role) && !r) return <td key={t.id} className="px-3 py-2 text-[var(--ink-3)]" title="Not required for this staff member">—</td>; return <td key={t.id} className="px-3 py-2"><button type="button" onClick={() => setCell({ staff: s.name, typeId: t.id })} className="transition-opacity hover:opacity-70"><CredBadge s={credStatus(r)} /></button></td>; })}{showCourses && <td className="px-3 py-2"><div className="flex max-w-[320px] flex-wrap gap-1">{completionsFor(s.name).length ? completionsFor(s.name).map((d) => <button key={d.courseId} type="button" onClick={() => downloadCourseCertificate(s.name, d, settings)} title={`Download certificate · ${d.score}% · ${fmtDate(d.date)}`} className="max-w-[200px] truncate rounded-full bg-[#eaf1ff] px-2 py-0.5 text-[10.5px] font-bold text-[#1d3a8f] hover:bg-[#dbe7ff]">{d.title}</button>) : <span className="text-[11px] text-[var(--ink-3)]">—</span>}</div></td>}</tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={visTypes.length + (showCourses ? 3 : 2)} className="px-3 py-6 text-center text-[12.5px] text-[var(--ink-3)]">No staff match this filter.</td></tr>}</tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-[var(--ink-3)]"><span className="text-[#c0392b]">*</span> required. Manage credential types &amp; who they apply to in <button type="button" onClick={() => router.push(`/${portal}/setup?tab=learning#credtypes`)} className="font-bold text-[#1d3a8f] underline hover:text-[#16297a]">Setup → Learning</button>.</p>
      </Card>

      {showCourses && (
        <Card className="mt-3 p-4">
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-[14px] font-extrabold text-[var(--ink)]">📚 Internal courses completed</h3>
            <span className="rounded-full bg-[#eaf1ff] px-2 py-0.5 text-[11px] font-bold text-[#1d3a8f]">ActivityOS training</span>
          </div>
          <div className="grid gap-2.5">
            {staff.map((s) => { const done = completionsFor(s.name); return (
              <div key={s.name} className="rounded-xl border border-[var(--line)] p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-[13.5px] font-extrabold text-[var(--ink)]">{s.name}</span>
                  <span className="text-[11.5px] text-[var(--ink-3)]">{s.role} · {s.op}</span>
                  <span className="ml-auto text-[11.5px] font-bold text-[var(--ink-2)]">{done.length} completed</span>
                </div>
                {done.length ? (
                  <div className="flex flex-wrap gap-2">
                    {done.map((d) => (
                      <button key={d.courseId} type="button" onClick={() => downloadCourseCertificate(s.name, d, settings)} title="Download the completion certificate (PDF)" className="group inline-flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1.5 text-left hover:border-[#1d3a8f]">
                        <span className="max-w-[220px] truncate text-[12px] font-bold text-[var(--ink)]">{d.title}</span>
                        <span className="rounded-full bg-[#e6f4ea] px-1.5 py-0.5 text-[10px] font-extrabold text-[#0f7a43] tabular-nums">{d.score}%</span>
                        <span className="text-[10.5px] text-[var(--ink-3)]">{fmtDate(d.date)}</span>
                        <span className="text-[11px] font-bold text-[#1d3a8f] group-hover:underline">⬇ Certificate</span>
                      </button>
                    ))}
                  </div>
                ) : <p className="text-[12px] text-[var(--ink-3)]">No internal courses completed yet.</p>}
              </div>
            ); })}
          </div>
          <p className="mt-3 text-[11px] text-[var(--ink-3)]">Assign more training in the <button type="button" onClick={() => router.push(`/${portal}/learning`)} className="font-bold text-[#1d3a8f] underline hover:text-[#16297a]">Learning Centre</button>. Certificates use your chosen template &amp; branding from Setup → Learning.</p>
        </Card>
      )}

      {packCfg && (() => {
        const nCerts = xCourses ? staff.filter((s) => xStaff.has(s.name)).reduce((n, s) => n + completionsFor(s.name).filter((d) => xCourseIds.has(d.courseId)).length, 0) : 0;
        const allStaff = xStaff.size === staff.length; const allTypes = xTypes.size === cred.types.length; const allCourses = xCourseIds.size === courseOpts.length;
        const row = (checked: boolean, onClick: () => void, label: React.ReactNode, sub?: string) => (
          <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-[var(--panel)]"><input type="checkbox" checked={checked} onChange={onClick} className="h-4 w-4 flex-none accent-[#1d3a8f]" /><span className="text-[13px] font-semibold text-[var(--ink)]">{label}</span>{sub && <span className="text-[11.5px] text-[var(--ink-3)]">{sub}</span>}</label>
        );
        return (
          <div className="fixed inset-0 z-[141] flex justify-center overflow-y-auto bg-black/45 p-4 pt-[5vh]" onClick={() => setPackCfg(false)}>
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()} style={LIGHT_PALETTE}>
              <div className="mb-1 flex items-center gap-2"><h3 className="text-[15px] font-extrabold text-[var(--ink)]">Build export pack</h3><button type="button" onClick={() => setPackCfg(false)} className="ml-auto text-[18px] text-[var(--ink-3)]">×</button></div>
              <p className="mb-3 text-[12px] text-[var(--ink-3)]">Choose exactly who and what goes into the PDF. {op !== "all" ? `Scoped to ${op}.` : "All locations."}</p>

              <div className="mb-3">
                <div className="mb-1 flex items-center gap-2"><span className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Staff</span><button type="button" onClick={() => setXStaff(allStaff ? new Set() : new Set(staff.map((s) => s.name)))} className="ml-auto text-[11px] font-bold text-[#1d3a8f] hover:underline">{allStaff ? "Clear all" : "Select all"}</button></div>
                <div className="max-h-[168px] overflow-y-auto rounded-lg border border-[var(--line)] p-1">{staff.map((s) => row(xStaff.has(s.name), () => toggleSet(xStaff, setXStaff, s.name), s.name, s.op))}</div>
              </div>

              <div className="mb-3">
                <div className="mb-1 flex items-center gap-2"><span className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Credentials</span><button type="button" onClick={() => setXTypes(allTypes ? new Set() : new Set(cred.types.map((t) => t.id)))} className="ml-auto text-[11px] font-bold text-[#1d3a8f] hover:underline">{allTypes ? "Clear all" : "Select all"}</button></div>
                <div className="max-h-[150px] overflow-y-auto rounded-lg border border-[var(--line)] p-1">{cred.types.map((t) => row(xTypes.has(t.id), () => toggleSet(xTypes, setXTypes, t.id), t.name, t.required ? "required" : undefined))}</div>
              </div>

              <label className="mb-2 flex cursor-pointer items-center gap-2.5 rounded-lg bg-[var(--panel)] px-3 py-2"><input type="checkbox" checked={xDocs} onChange={() => setXDocs((v) => !v)} className="h-4 w-4 accent-[#1d3a8f]" /><span className="text-[13px] font-bold text-[var(--ink)]">Attach uploaded certificate files</span></label>

              <label className="mb-2 flex cursor-pointer items-center gap-2.5 rounded-lg bg-[var(--panel)] px-3 py-2"><input type="checkbox" checked={xCourses} onChange={() => setXCourses((v) => !v)} className="h-4 w-4 accent-[#1d3a8f]" /><span className="text-[13px] font-bold text-[var(--ink)]">Include internal course certificates</span></label>
              {xCourses && (courseOpts.length ? (
                <div className="mb-3 ml-1">
                  <div className="mb-1 flex items-center gap-2"><span className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Which courses</span><button type="button" onClick={() => setXCourseIds(allCourses ? new Set() : new Set(courseOpts.map(([id]) => id)))} className="ml-auto text-[11px] font-bold text-[#1d3a8f] hover:underline">{allCourses ? "Clear all" : "Select all"}</button></div>
                  <div className="max-h-[150px] overflow-y-auto rounded-lg border border-[var(--line)] p-1">{courseOpts.map(([id, title]) => row(xCourseIds.has(id), () => toggleSet(xCourseIds, setXCourseIds, id), title))}</div>
                </div>
              ) : <p className="mb-3 ml-1 text-[12px] text-[var(--ink-3)]">No completed courses among the selected staff.</p>)}

              <div className="mt-3 flex items-center gap-2 border-t border-[var(--line)] pt-3">
                <span className="text-[11.5px] text-[var(--ink-3)]">{xStaff.size} staff · {xTypes.size} credential{xTypes.size === 1 ? "" : "s"}{xCourses ? ` · ${nCerts} course cert${nCerts === 1 ? "" : "s"}` : ""}</span>
                <Button onClick={() => setPackCfg(false)} className="ml-auto">Cancel</Button>
                <Button variant="primary" disabled={!xStaff.size || !xTypes.size} onClick={runPack}>⬇ Generate PDF</Button>
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
                <button type="button" onClick={() => setProfile(null)} className="ml-auto text-[20px] text-[var(--ink-3)] hover:text-[var(--ink)]">×</button>
              </div>

              <div className="my-3 rounded-xl border border-[var(--line)] p-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1"><div className="text-[11px] font-extrabold uppercase tracking-wide text-[#1d3a8f]">Compliance</div><div className="text-[12.5px] text-[var(--ink-3)]">{validReq} of {reqTypes.length} required valid</div></div>
                  <div className="min-w-[120px] flex-1"><div className="h-2 overflow-hidden rounded-full bg-[var(--panel)]"><div className={"h-full rounded-full " + (pc === 100 ? "bg-[#0f9d58]" : "bg-[#b45309]")} style={{ width: `${pc}%` }} /></div></div>
                  <span className="text-[15px] font-extrabold tabular-nums text-[var(--ink)]">{pc}%</span>
                </div>
                {outstanding.length > 0 && <div className="mt-2 text-[12px] font-semibold text-[#8a4b09]">⚠ Needs attention: {outstanding.map((t) => `${t.name} (${credStatus(cred.recordFor(profile.name, t.id))})`).join(" · ")}</div>}
              </div>

              <h4 className="mb-1.5 text-[12px] font-extrabold uppercase tracking-wide text-[var(--ink-2)]">Certificates</h4>
              <div className="space-y-1.5">
                {applic.map((t) => { const r = cred.recordFor(profile.name, t.id); const st = credStatus(r); const dl = daysUntil(r?.expiry); const fs = credFiles(r); return (
                  <div key={t.id} className="rounded-lg border border-[var(--line)] p-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[12.5px] font-bold text-[var(--ink)]">{t.name}</span>
                      {t.required && appliesTo(t, profile.name, profile.role) ? <span className="rounded-full bg-[#fdecec] px-1.5 py-0.5 text-[9px] font-bold text-[#c0392b]">Required</span> : <span className="rounded-full bg-[#eef1f6] px-1.5 py-0.5 text-[9px] font-bold text-[#64748b]">Optional</span>}
                      <span className="ml-auto"><CredBadge s={st} /></span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-[var(--ink-3)]">
                      {r?.issue && <span>Issued <b className="text-[var(--ink-2)]">{fmtDate(r.issue)}</b></span>}
                      {r?.expiry && <span>Expires <b className="text-[var(--ink-2)]">{fmtDate(r.expiry)}</b>{dl != null && dl >= 0 && dl <= 60 ? <span className="text-[#b45309]"> · {dl}d</span> : null}{dl != null && dl < 0 ? <span className="text-[#c0392b]"> · expired</span> : null}</span>}
                      {!r && <span className="font-semibold text-[#c0392b]">Not on file</span>}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      {fs.map((f, i) => <button key={i} type="button" onClick={() => openCredFile(f.data)} className="text-[11px] font-bold text-[#1d3a8f] hover:underline">📎 {i === fs.length - 1 ? "Current" : "Older"}</button>)}
                      {r && st === "Pending" && <button type="button" onClick={() => cred.upsertRecord({ ...r, verified: "verified" })} className="text-[11px] font-bold text-[#0f7a43] hover:underline">✓ Verify</button>}
                      <button type="button" onClick={() => setEdit(r ?? blankRecord(profile.name, t.id))} className="ml-auto text-[11px] font-bold text-[#1d3a8f] hover:underline">{r ? "Edit" : "Add"}</button>
                    </div>
                  </div>
                ); })}
                {!applic.length && <div className="text-[12px] text-[var(--ink-3)]">No credentials apply to this person.</div>}
              </div>

              <h4 className="mb-1.5 mt-4 text-[12px] font-extrabold uppercase tracking-wide text-[var(--ink-2)]">📚 Internal courses completed</h4>
              {done.length ? (
                <div className="space-y-1.5">
                  {done.map((d) => (
                    <div key={d.courseId} className="flex items-center gap-2 rounded-lg border border-[var(--line)] px-2.5 py-1.5">
                      <span className="truncate text-[12.5px] font-bold text-[var(--ink)]">{d.title}</span>
                      <span className="rounded-full bg-[#e6f4ea] px-1.5 py-0.5 text-[10px] font-extrabold text-[#0f7a43] tabular-nums">{d.score}%</span>
                      <span className="text-[10.5px] text-[var(--ink-3)]">{fmtDate(d.date)}</span>
                      <button type="button" onClick={() => downloadCourseCertificate(profile.name, d, settings)} className="ml-auto text-[11px] font-bold text-[#1d3a8f] hover:underline">⬇ Certificate</button>
                    </div>
                  ))}
                </div>
              ) : <div className="text-[12px] text-[var(--ink-3)]">No internal courses completed yet.</div>}

              <div className="mt-4 flex gap-2"><Button variant="primary" onClick={() => setEdit(blankRecord(profile.name, cred.types[0]?.id ?? ""))}>+ Add certificate</Button><Button onClick={() => setProfile(null)}>Close</Button></div>
            </div>
          </div>);
      })()}

      {edit && <CredEditor rec={edit} types={cred.types} staffList={DEMO_STAFF} onSave={(r) => { cred.upsertRecord(r); setEdit(null); }} onClose={() => setEdit(null)} />}

      {cell && (() => {
        const t = cred.types.find((x) => x.id === cell.typeId); const r = cred.recordFor(cell.staff, cell.typeId); const st = credStatus(r); const dl = daysUntil(r?.expiry);
        return (
          <div className="fixed inset-0 z-[138] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[6vh]" onClick={() => setCell(null)}>
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()} style={LIGHT_PALETTE}>
              <div className="mb-1 flex items-center gap-2"><h3 className="text-[15px] font-extrabold text-[var(--ink)]">{t?.name ?? "Credential"}</h3><CredBadge s={st} /><button type="button" onClick={() => setCell(null)} className="ml-auto text-[18px] text-[var(--ink-3)]">×</button></div>
              <div className="mb-3 text-[12px] text-[var(--ink-3)]">{cell.staff}</div>
              {r ? (<>
                <div className="grid grid-cols-2 gap-2 text-[12.5px]">
                  <div className="rounded-lg bg-[var(--panel)] px-3 py-2"><div className="text-[10px] font-extrabold uppercase text-[var(--ink-3)]">Issued</div><div className="font-bold text-[var(--ink)]">{fmtDate(r.issue)}</div></div>
                  <div className="rounded-lg bg-[var(--panel)] px-3 py-2"><div className="text-[10px] font-extrabold uppercase text-[var(--ink-3)]">Expires</div><div className="font-bold text-[var(--ink)]">{fmtDate(r.expiry)}{dl != null && dl >= 0 && dl <= 60 ? <span className="text-[#b45309]"> · {dl}d</span> : null}{dl != null && dl < 0 ? <span className="text-[#c0392b]"> · expired</span> : null}</div></div>
                  {r.issuer && <div className="rounded-lg bg-[var(--panel)] px-3 py-2"><div className="text-[10px] font-extrabold uppercase text-[var(--ink-3)]">Issuer</div><div className="font-bold text-[var(--ink)]">{r.issuer}</div></div>}
                  {r.number && <div className="rounded-lg bg-[var(--panel)] px-3 py-2"><div className="text-[10px] font-extrabold uppercase text-[var(--ink-3)]">Number</div><div className="font-bold text-[var(--ink)]">{r.number}</div></div>}
                  {t?.dbs && r.dbsLevel && <div className="col-span-2 rounded-lg bg-[var(--panel)] px-3 py-2"><div className="text-[10px] font-extrabold uppercase text-[var(--ink-3)]">DBS</div><div className="font-bold text-[var(--ink)]">{r.dbsLevel}{r.dbsUpdate ? " · on Update Service" : ""}{r.dbsUpdateNo ? " · " + r.dbsUpdateNo : ""}</div></div>}
                </div>
                {credFiles(r).length > 0 && (() => { const fs = credFiles(r); return (
                  <div className="mt-2 space-y-1">
                    <div className="text-[10px] font-extrabold uppercase text-[var(--ink-3)]">Document{fs.length > 1 ? `s · ${fs.length} versions` : ""}</div>
                    {fs.slice().reverse().map((f, i) => { const latest = i === 0; return (
                      <button key={i} type="button" onClick={() => openCredFile(f.data)} className="flex w-full items-center gap-2 rounded-lg border border-[var(--line)] px-3 py-1.5 text-left text-[12px] font-semibold text-[#1d3a8f] hover:border-[#1d3a8f]">📎 <span className="truncate">{f.name}</span>{latest ? <span className="rounded-full bg-[#e6f4ea] px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-[#0f7a43]">Current</span> : <span className="rounded-full bg-[#eef1f6] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#64748b]">Older</span>}{f.at && <span className="ml-auto text-[10px] font-normal text-[var(--ink-3)]">{fmtDate(f.at.slice(0, 10))}</span>}</button>
                    ); })}
                  </div>
                ); })()}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {r.verified !== "verified" && <Button variant="primary" onClick={() => cred.upsertRecord({ ...r, verified: "verified" })}>✓ Verify</Button>}
                  {r.verified !== "rejected" && <Button onClick={() => cred.upsertRecord({ ...r, verified: "rejected" })}>Reject</Button>}
                  <Button onClick={() => { setEdit(r); setCell(null); }}>Edit</Button>
                  <button type="button" title="Delete" onClick={() => { if (typeof window !== "undefined" && window.confirm("Delete this certificate record?")) { cred.deleteRecord(r.id); setCell(null); } }} className="ml-auto text-[15px] text-[var(--ink-3)] hover:text-[#c0392b]">🗑</button>
                </div>
              </>) : (<>
                <p className="rounded-lg bg-[#fdecec] px-3 py-2.5 text-[12.5px] font-semibold text-[#c0392b]">No {t?.name} on file for {cell.staff}.</p>
                <div className="mt-3 flex justify-end gap-2"><Button onClick={() => setCell(null)}>Close</Button><Button variant="primary" onClick={() => { setEdit(blankRecord(cell.staff, cell.typeId)); setCell(null); }}>+ Add on their behalf</Button></div>
              </>)}
            </div>
          </div>);
      })()}
    </div>
  );
}
