"use client";

// Staff self-service — "My Certificates". Each staff member uploads and renews
// their own DBS, First Aid and other credentials here; the manager verifies them
// in the Learning Centre → Certificates grid (shared demo store). Front-end only.
import { useState } from "react";
import { Button, Card } from "@/components/ui";
import { LIGHT_PALETTE, PageHero } from "@/components/OperatorPage";
import { useCredentials, credStatus, CredBadge, CredEditor, blankRecord, openCredFile, appliesTo, fmtDate, daysUntil, type CredRecord } from "./credentials";

// demo seed (mirrors the manager's staff list) + the "current" staff member
const SEED = [
  { name: "Marcus Bell", dbs: "Valid", pfa: "Expiring" }, { name: "Jess Patel", dbs: "Valid", pfa: "Valid" },
  { name: "Aisha Rahman", dbs: "Valid", pfa: "Expired" }, { name: "Tom Lewis", dbs: "Valid", pfa: "Valid" },
  { name: "Priya Khan", dbs: "Pending", pfa: "Valid" }, { name: "Dan Reed", dbs: "Valid", pfa: "Valid" },
];
const ME = "Marcus Bell";

export function StaffCertsApp() {
  const cred = useCredentials(SEED);
  const [edit, setEdit] = useState<CredRecord | null>(null);
  const ME_ROLE = "Lead";
  const mine = (typeId: string) => cred.recordFor(ME, typeId);
  const shownTypes = cred.types.filter((t) => appliesTo(t, ME, ME_ROLE) || mine(t.id));
  const requiredTypes = cred.types.filter((t) => t.required && appliesTo(t, ME, ME_ROLE));
  const validReq = requiredTypes.filter((t) => credStatus(mine(t.id)) === "Valid").length;
  const pct = requiredTypes.length ? Math.round((validReq / requiredTypes.length) * 100) : 100;

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero title="My Certificates" icon="🎖" lede="Upload and renew your DBS, First Aid and other certificates. Your manager verifies them and is reminded before they expire." />

      <Card className="mb-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div><div className="text-[11px] font-extrabold uppercase tracking-wide text-[#1d3a8f]">Your compliance</div><div className="text-[13px] text-[var(--ink-3)]">{validReq} of {requiredTypes.length} required certificates valid</div></div>
          <div className="min-w-[140px] flex-1"><div className="h-2 overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full bg-[#0f9d58] transition-all" style={{ width: `${pct}%` }} /></div></div>
          <span className="text-[15px] font-extrabold tabular-nums text-[var(--ink)]">{pct}%</span>
        </div>
      </Card>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {shownTypes.map((t) => {
          const r = mine(t.id); const st = credStatus(r); const dl = daysUntil(r?.expiry);
          return (
            <Card key={t.id} className="p-3.5">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-[13.5px] font-extrabold text-[var(--ink)]">{t.name}</span>
                {t.required ? <span className="rounded-full bg-[#fdecec] px-2 py-0.5 text-[10px] font-bold text-[#c0392b]">Required</span> : <span className="rounded-full bg-[#eef1f6] px-2 py-0.5 text-[10px] font-bold text-[#64748b]">Optional</span>}
                <span className="ml-auto"><CredBadge s={st} /></span>
              </div>
              {r ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[var(--ink-3)]">
                  <span>Issued <b className="text-[var(--ink-2)]">{fmtDate(r.issue)}</b></span>
                  <span>Expires <b className="text-[var(--ink-2)]">{fmtDate(r.expiry)}</b>{dl != null && dl >= 0 && dl <= 60 ? <span className="font-bold text-[#b45309]"> · {dl}d left</span> : null}{dl != null && dl < 0 ? <span className="font-bold text-[#c0392b]"> · expired</span> : null}</span>
                  {r.verified === "pending" && <span className="font-semibold text-[#1d54c4]">Awaiting verification</span>}
                  {r.verified === "rejected" && <span className="font-semibold text-[#c0392b]">Rejected — please re-upload</span>}
                </div>
              ) : <div className="text-[12px] text-[var(--ink-3)]">Not uploaded yet.</div>}
              <div className="mt-2.5 flex flex-wrap gap-2">
                {r?.fileData && <Button onClick={() => openCredFile(r.fileData)}>📎 View</Button>}
                <Button variant={r ? undefined : "primary"} onClick={() => setEdit(r ?? blankRecord(ME, t.id))}>{r ? (st === "Expiring" || st === "Expired" ? "🔄 Renew" : "Update") : "⬆ Upload"}</Button>
              </div>
            </Card>
          );
        })}
      </div>

      <p className="mt-3 text-[11.5px] text-[var(--ink-3)]">Your manager keeps the single verified record. Missing or expiring credentials show up on their dashboard and in reminders.</p>

      {edit && <CredEditor rec={edit} types={cred.types} lockStaff onSave={(x) => { cred.upsertRecord(x); setEdit(null); }} onClose={() => setEdit(null)} />}
    </div>
  );
}
