"use client";

// Staff-facing documents — the policies, procedures and (listing-specific) risk
// assessments a staff member has been assigned. They read each one and tick to
// confirm. Mirrors the operator Documents library (same demo store); a document
// assigned to a LISTING only shows once the person is deployed to that listing.
// Read confirmations stored per-staff (demo). Real per-user identity + read
// receipts are Amir's.
import { useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";
import { LIGHT_PALETTE, PageHero } from "@/components/OperatorPage";
import { DOCS_KEY, seedDocs, openDoc, docFmt, statusOf, type DocItem } from "./DocumentsApp";

// demo "me" — matches the Staff-certificates area
const ME = "Marcus Bell";
const ME_ROLE = "Lead";
const ME_TITLE = "Coach / Staff";
// listings this person is deployed to (set in the operator Deployment tab after
// they activate) — demo set so a listing-scoped doc shows here
const MY_LISTINGS = ["After-School Football Club"];

const roleMatch = (list: string[], me: string) => list.some((r) => { const rl = r.toLowerCase(), m = me.toLowerCase(); return rl.includes(m) || m.includes(rl.split(/[ /]/)[0]); });
const appliesToMe = (d: DocItem) => d.all || roleMatch(d.roles, ME_ROLE) || roleMatch(d.titles, ME_TITLE) || d.listings.some((l) => MY_LISTINGS.includes(l));

const RKEY = "aos.docs.read.v1";

export function StaffDocsApp() {
  const [docs, setDocs] = useState<DocItem[]>(seedDocs);
  const [read, setRead] = useState<Record<string, string>>({});
  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem(DOCS_KEY) || "null"); if (Array.isArray(s) && s.length) setDocs(s); } catch { /* ignore */ }
    try { const r = JSON.parse(localStorage.getItem(RKEY) || "null"); if (r && typeof r === "object") setRead(r[ME] || {}); } catch { /* ignore */ }
  }, []);
  const confirm = (id: string, on: boolean) => {
    const next = { ...read }; if (on) next[id] = new Date().toISOString(); else delete next[id];
    setRead(next);
    try { const all = JSON.parse(localStorage.getItem(RKEY) || "{}"); all[ME] = next; localStorage.setItem(RKEY, JSON.stringify(all)); } catch { /* ignore */ }
  };

  const mine = docs.filter(appliesToMe);
  const general = mine.filter((d) => d.listings.length === 0 || d.all);
  const listingDocs = mine.filter((d) => !d.all && d.listings.length > 0);
  const readCount = mine.filter((d) => read[d.id]).length;

  const docRow = (d: DocItem) => { const isRead = !!read[d.id]; const st = statusOf(d); return (
    <div key={d.id} className={"flex flex-wrap items-center gap-3 rounded-xl border p-3 " + (isRead ? "border-[#cfe8d7] bg-[#f4fbf6]" : "border-[var(--line)]")}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><span className="text-[13.5px] font-extrabold text-[var(--ink)]">{d.title}</span><span className="rounded-full bg-[#eef1f6] px-2 py-0.5 text-[10px] font-bold text-[#5b6577]">{d.category}</span>{d.listings.length > 0 && !d.all && d.listings.map((l) => <span key={l} className="rounded-full bg-[#eaf1ff] px-2 py-0.5 text-[10px] font-bold text-[#1d54c4]">📋 {l}</span>)}</div>
        <div className="mt-0.5 text-[11.5px] text-[var(--ink-3)]">v{d.version} · updated {docFmt(d.uploadedAt)}{d.expiry ? ` · review by ${docFmt(d.expiry)}` : ""}{isRead ? ` · ✓ you confirmed ${docFmt(read[d.id].slice(0, 10))}` : ""}</div>
      </div>
      <span className={"rounded-full px-2 py-0.5 text-[10px] font-bold " + st.tone}>{st.label}</span>
      <Button onClick={() => openDoc(d)}>📄 Read</Button>
      <label className="flex cursor-pointer items-center gap-2 text-[12.5px] font-bold text-[var(--ink-2)]"><input type="checkbox" checked={isRead} onChange={(e) => confirm(d.id, e.target.checked)} className="h-4 w-4 accent-[#0f7a43]" /> I&rsquo;ve read this</label>
    </div>
  ); };

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero title="My documents" icon="📁" lede="The policies, procedures and risk assessments your provider has assigned to you. Open each one, read it, then tick to confirm." />

      <Card className="mb-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div><div className="text-[11px] font-extrabold uppercase tracking-wide text-[#1d3a8f]">Reading</div><div className="text-[13px] text-[var(--ink-3)]">{readCount} of {mine.length} confirmed</div></div>
          <div className="min-w-[140px] flex-1"><div className="h-2 overflow-hidden rounded-full bg-[var(--panel)]"><div className={"h-full rounded-full transition-all " + (readCount === mine.length ? "bg-[#0f9d58]" : "bg-[#3f7ae0]")} style={{ width: `${mine.length ? (readCount / mine.length) * 100 : 0}%` }} /></div></div>
          <span className="text-[15px] font-extrabold tabular-nums text-[var(--ink)]">{mine.length ? Math.round((readCount / mine.length) * 100) : 0}%</span>
        </div>
      </Card>

      <h3 className="mb-1.5 text-[13px] font-extrabold uppercase tracking-wide text-[var(--ink-2)]">Policies & procedures</h3>
      <div className="space-y-2">{general.length ? general.map(docRow) : <Card className="p-4 text-center text-[12.5px] text-[var(--ink-3)]">Nothing assigned yet.</Card>}</div>

      {listingDocs.length > 0 && (<>
        <h3 className="mb-1.5 mt-4 text-[13px] font-extrabold uppercase tracking-wide text-[var(--ink-2)]">For your activities</h3>
        <div className="space-y-2">{listingDocs.map(docRow)}</div>
      </>)}

      <p className="mt-3 text-[11.5px] text-[var(--ink-3)]">Risk assessments for a specific activity appear here once you&rsquo;re deployed to that listing. Your manager can see who has confirmed each document.</p>
    </div>
  );
}
