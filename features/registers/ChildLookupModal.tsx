"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { get as apiGet } from "@/lib/api";
import { useSettings } from "@/lib/settings";
import { ChildCard, type ChildInfo } from "./ChildCard";

interface LookupRow { childId: string; name: string; dob: string; parentName: string; parentEmail: string; parentPhone: string; ref: string; postcode: string }
interface CardResp { childId: string; name: string; parentName: string; parentEmail: string; parentPhone: string; ref: string; postcode: string; record: Record<string, string | boolean | Record<string, string> | undefined> }

const ageOf = (dob?: string) => { if (!dob) return undefined; const bd = new Date(dob); if (isNaN(+bd)) return undefined; const n = new Date(); let a = n.getFullYear() - bd.getFullYear(); const m = n.getMonth() - bd.getMonth(); if (m < 0 || (m === 0 && n.getDate() < bd.getDate())) a--; return a >= 0 && a < 120 ? a : undefined; };

/** The "Find a child" popup — search the tenant's children, open their card. */
export function ChildLookupModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const portal = usePathname()?.split("/")[1] || "freelancer";
  const { settings, questions } = useSettings();
  const card = settings.registers?.card ?? {};
  const fields = settings.registers?.fields ?? {};
  const acts = settings.registers?.actions ?? {};

  const [rows, setRows] = useState<LookupRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [openInfo, setOpenInfo] = useState<{ info: ChildInfo; name: string; email: string } | null>(null);
  const [loadingCard, setLoadingCard] = useState(false);

  useEffect(() => {
    let alive = true;
    apiGet<LookupRow[]>("/api/children/lookup").then((r) => { if (alive) setRows(r); }).catch((e) => { if (alive) setErr(e instanceof Error ? e.message : "Couldn’t load children"); });
    return () => { alive = false; };
  }, []);

  const term = q.trim().toLowerCase();
  const shown = (rows ?? []).filter((r) => !term || r.name.toLowerCase().includes(term) || r.parentName.toLowerCase().includes(term) || r.postcode.toLowerCase().includes(term));

  async function openChild(childId: string) {
    setLoadingCard(true); setErr(null);
    try {
      const d = await apiGet<CardResp>(`/api/children/${encodeURIComponent(childId)}`);
      const r = d.record ?? {};
      const info: ChildInfo = {
        name: d.name, age: ageOf(r.dob as string | undefined), dob: r.dob as string | undefined, sex: r.sex as string | undefined, photo: r.photo as string | undefined,
        allergies: r.allergies as string | undefined, medical: r.medical as string | undefined, dietary: r.dietary as string | undefined, send: r.send as string | undefined, sendPlanName: r.sendPlanName as string | undefined, swimming: r.swimming as string | undefined,
        careNotes: r.careNotes as string | undefined, likes: r.likes as string | undefined, dislikes: r.dislikes as string | undefined, answers: r.answers as Record<string, string> | undefined,
        photoConsent: r.photoConsent as boolean | undefined, suncreamConsent: r.suncreamConsent as boolean | undefined, firstAidConsent: r.firstAidConsent as boolean | undefined, walkHomeConsent: r.walkHomeConsent as boolean | undefined,
        collectionPassword: r.collectionPassword as string | undefined, emergencyName: r.emergencyName as string | undefined, emergencyPhone: r.emergencyPhone as string | undefined, school: r.school as string | undefined,
        contactName: d.parentName, contactPhone: d.parentPhone, contactEmail: d.parentEmail, bookingRef: d.ref,
      };
      setOpenInfo({ info, name: d.name, email: d.parentEmail });
    } catch (e) { setErr(e instanceof Error ? e.message : "Couldn’t load the child card"); }
    setLoadingCard(false);
  }

  // Quick links on the card — the exact set the register uses, hidden the moment
  // they're switched off in Setup → Register.
  const go = (href: string) => { onClose(); router.push(href); };
  const incidentSeg = portal === "staff" ? "incident" : "incidents";
  const mkLink = (label: string, tint: string, href: string, disabled = false) => (
    <button key={label} type="button" disabled={disabled} onClick={() => go(href)} className="rounded-lg border px-2.5 py-1.5 text-[11.5px] font-bold transition hover:-translate-y-px disabled:opacity-40" style={{ borderColor: "var(--line)", color: tint, background: "var(--surface)" }}>{label}</button>
  );
  let quickLinks: ReactNode = null;
  if (openInfo) {
    const name = encodeURIComponent(openInfo.name);
    const email = encodeURIComponent(openInfo.email.trim().toLowerCase());
    const items: ReactNode[] = [];
    if (acts.firstAid !== false) items.push(mkLink("First aid", "#be123c", `/${portal}/accidents?child=${name}`));
    if (acts.incident !== false) items.push(mkLink("Incident", "#b45309", `/${portal}/${incidentSeg}?child=${name}`));
    if (acts.medication !== false) items.push(mkLink("Medication", "#15803d", `/${portal}/medication?child=${name}`));
    if (acts.moments !== false) items.push(mkLink("Moments", "#7c3aed", `/${portal}/moments?child=${name}`));
    if (acts.email !== false) items.push(mkLink("Email", "#0e7490", `/${portal}/email?to=${email}`, !openInfo.email));
    if (acts.message !== false) items.push(mkLink("Message", "#1d3a8f", `/${portal}/messages?compose=1&emails=${email}`, !openInfo.email));
    quickLinks = <>{items}</>;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 p-4 pt-[6vh]" onClick={onClose}>
      <div className="w-full max-w-[680px]" onClick={(e) => e.stopPropagation()}>
        {openInfo ? (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <button type="button" onClick={() => setOpenInfo(null)} className="rounded-full bg-white/90 px-3 py-1.5 text-[12.5px] font-extrabold text-[#1d3a8f]">‹ Back to search</button>
              <button type="button" onClick={onClose} className="rounded-full bg-white/90 px-3 py-1.5 text-[12.5px] font-extrabold text-[#1d3a8f]">Close</button>
            </div>
            <ChildCard info={openInfo.info} card={card} questions={questions} fields={fields} actions={quickLinks} />
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl bg-[var(--surface)] shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 text-white" style={{ background: "linear-gradient(120deg,#1d3a8f 0%,#3f78d8 62%,#ffffff 100%)" }}>
              <div className="text-[17px] font-extrabold" style={{ fontFamily: "var(--ff-display)" }}>🔎 Find a child</div>
              <button type="button" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-[15px] font-bold leading-none hover:bg-white/30">×</button>
            </div>
            <div className="p-4">
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by child, parent or where they live…" className="mb-2 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2.5 text-[13px] text-[var(--ink)] outline-none focus:border-[#1d3a8f]" />
              {err && <div className="mb-2 rounded-lg border border-[#f6c9cc] bg-[#fdebec] px-3 py-2 text-[12.5px] text-[#c02636]">{err}</div>}
              <div className="max-h-[52vh] overflow-y-auto">
                {rows === null ? <div className="py-8 text-center text-[12.5px] text-[var(--ink-3)]">Loading…</div>
                  : shown.length === 0 ? <div className="py-8 text-center text-[12.5px] text-[var(--ink-3)]">{term ? "No child matches." : "No children booked yet."}</div>
                    : <ul className="space-y-1">{shown.map((r) => (
                        <li key={r.childId}>
                          <button type="button" disabled={loadingCard} onClick={() => openChild(r.childId)} className="flex w-full items-center gap-3 rounded-xl border border-[var(--line)] px-3 py-2 text-left transition hover:border-[#1d3a8f] hover:bg-[#f7faff] disabled:opacity-50">
                            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl text-[13px] font-extrabold text-[#1d3a8f]" style={{ background: "#eef4fd" }}>{r.name.slice(0, 1)}</span>
                            <span className="min-w-0">
                              <span className="block truncate text-[13px] font-extrabold text-[var(--ink)]">{r.name}</span>
                              <span className="block truncate text-[11.5px] text-[var(--ink-3)]">👤 {r.parentName || "—"}{r.postcode ? ` · 📍 ${r.postcode}` : ""}</span>
                            </span>
                          </button>
                        </li>
                      ))}</ul>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
