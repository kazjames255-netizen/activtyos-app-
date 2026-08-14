"use client";

// Staff certificates & credentials — the MANAGER oversight, in the Staff/Team
// area (moved out of the Learning Centre). Staff upload/renew in their own "My
// learning" area; here the manager sees the compliance matrix, verifies, chases
// and exports. Front-end demo store (see credentials.tsx); backend owed to Amir.
import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button, Card, Select } from "@/components/ui";
import { LIGHT_PALETTE, PageHero } from "@/components/OperatorPage";
import { useCredentials, credStatus, CredBadge, CredEditor, blankRecord, openCredFile, appliesTo, targetLabel, exportCredsPdf, DEMO_STAFF, fmtDate, daysUntil, type CredRecord, type CredStatus } from "./credentials";

const OPS: [string, string][] = [["all", "All locations"], ["Company-owned", "Company-owned (Head Office)"], ["Milton Keynes", "Milton Keynes"], ["Northampton", "Northampton"], ["Bedford", "Bedford"]];

export function CredentialsApp() {
  const cred = useCredentials(DEMO_STAFF);
  const router = useRouter();
  const portal = (usePathname() || "/company").split("/")[1] || "company";
  const [op, setOp] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<CredStatus | "all">("all");
  const [edit, setEdit] = useState<CredRecord | null>(null);
  const [cell, setCell] = useState<{ staff: string; typeId: string } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const staff = op === "all" ? DEMO_STAFF : DEMO_STAFF.filter((s) => s.op === op);
  const visTypes = typeFilter === "all" ? cred.types : cred.types.filter((t) => t.id === typeFilter);
  const cells = staff.flatMap((s) => cred.types.map((t) => ({ req: t.required, applies: appliesTo(t, s.name, s.role), st: credStatus(cred.recordFor(s.name, t.id)) })));
  const cnt = (st: CredStatus) => st === "Missing" ? cells.filter((c) => c.st === "Missing" && c.req && c.applies).length : cells.filter((c) => c.st === st).length;
  const rows = staff.filter((s) => statusFilter === "all" || visTypes.some((t) => { const st = credStatus(cred.recordFor(s.name, t.id)); if (st !== statusFilter) return false; return statusFilter === "Missing" ? t.required && appliesTo(t, s.name, s.role) : true; }));
  const csv = () => { const e = (v: string | number) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }; const rowsCsv = [["Staff", "Location", ...cred.types.map((t) => t.name)], ...staff.map((s) => [s.name, s.op, ...cred.types.map((t) => credStatus(cred.recordFor(s.name, t.id)))])].map((r) => r.map(e).join(",")).join("\n"); const url = URL.createObjectURL(new Blob([rowsCsv], { type: "text/csv" })); const a = document.createElement("a"); a.href = url; a.download = "staff-credentials.csv"; a.click(); URL.revokeObjectURL(url); };

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero title="Staff certificates" icon="🎖" lede="Your team's DBS, First Aid and other credentials. Staff upload and renew in their own area; you verify, chase and export the single record here." />

      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="text-[12px] font-bold text-[var(--ink-3)]">Location</label>
          <Select value={op} onChange={(e) => setOp(e.target.value)} className="max-w-[240px]">{OPS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
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
                {([["CSV (spreadsheet)", () => csv()], ["PDF — register only", () => exportCredsPdf(staff, cred.types, cred.recordFor, "Your company", false)], ["PDF — with certificate docs", () => exportCredsPdf(staff, cred.types, cred.recordFor, "Your company", true)]] as const).map(([lbl, fn]) => (
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
          <table className="w-full text-[13px]"><thead><tr className="bg-[var(--panel)] text-left text-[11px] uppercase tracking-wide text-[var(--ink-3)]"><th className="px-3 py-2.5 font-extrabold">Staff</th><th className="px-3 py-2.5 font-extrabold">Location</th>{visTypes.map((t) => <th key={t.id} title={t.required ? "Required for: " + targetLabel(t) : "Optional"} className="whitespace-nowrap px-3 py-2.5 font-extrabold">{t.name}{t.required && <span className="ml-0.5 text-[#c0392b]">*</span>}</th>)}</tr></thead>
            <tbody>{rows.map((s) => (
              <tr key={s.name} className="border-t border-[var(--line-2,#eef2f8)]"><td className="px-3 py-2.5 font-bold text-[var(--ink)]">{s.name}</td><td className="px-3 py-2.5 text-[var(--ink-2)]">{s.op}</td>{visTypes.map((t) => { const r = cred.recordFor(s.name, t.id); if (!appliesTo(t, s.name, s.role) && !r) return <td key={t.id} className="px-3 py-2 text-[var(--ink-3)]" title="Not required for this staff member">—</td>; return <td key={t.id} className="px-3 py-2"><button type="button" onClick={() => setCell({ staff: s.name, typeId: t.id })} className="transition-opacity hover:opacity-70"><CredBadge s={credStatus(r)} /></button></td>; })}</tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={visTypes.length + 2} className="px-3 py-6 text-center text-[12.5px] text-[var(--ink-3)]">No staff match this filter.</td></tr>}</tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-[var(--ink-3)]"><span className="text-[#c0392b]">*</span> required. Manage credential types &amp; who they apply to in <button type="button" onClick={() => router.push(`/${portal}/setup?tab=learning#credtypes`)} className="font-bold text-[#1d3a8f] underline hover:text-[#16297a]">Setup → Learning</button>.</p>
      </Card>

      {edit && <CredEditor rec={edit} types={cred.types} onSave={(r) => { cred.upsertRecord(r); setEdit(null); }} onClose={() => setEdit(null)} />}

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
                {r.fileData && <button type="button" onClick={() => openCredFile(r.fileData)} className="mt-2 w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[12.5px] font-bold text-[#1d3a8f] hover:border-[#1d3a8f]">📎 View {r.fileName || "certificate"}</button>}
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
