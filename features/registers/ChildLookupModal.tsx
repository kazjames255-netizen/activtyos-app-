"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { get as apiGet } from "@/lib/api";
import { useSettings } from "@/lib/settings";
import { ChildCard, type ChildInfo } from "./ChildCard";

interface LookupRow { childId: string; name: string; dob: string; parentName: string; parentEmail: string; parentPhone: string; ref: string; postcode: string }
interface CardResp { childId: string; name: string; parentName: string; parentEmail: string; parentPhone: string; ref: string; postcode: string; bookings?: { ref: string; listing: string; dates: string; pass: string; start: string; end: string; status: string }[]; record: Record<string, string | boolean | Record<string, string> | undefined> }

const ageOf = (dob?: string) => { if (!dob) return undefined; const bd = new Date(dob); if (isNaN(+bd)) return undefined; const n = new Date(); let a = n.getFullYear() - bd.getFullYear(); const m = n.getMonth() - bd.getMonth(); if (m < 0 || (m === 0 && n.getDate() < bd.getDate())) a--; return a >= 0 && a < 120 ? a : undefined; };

// The WhatsApp glyph (no Unicode emoji exists for it).
const WA_ICON = (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="#25D366" aria-hidden><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.334.101 11.892c0 2.096.549 4.14 1.595 5.945L0 24l6.335-1.652a12.062 12.062 0 005.71 1.447h.006c6.585 0 11.946-5.335 11.949-11.896 0-3.176-1.24-6.165-3.495-8.411"/></svg>
);

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
  const [openInfo, setOpenInfo] = useState<{ info: ChildInfo; name: string; email: string; phone: string } | null>(null);
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
        attending: (d.bookings ?? []).map((bk) => ({ label: bk.dates || bk.listing || `#${bk.ref}`, start: bk.start || "", end: bk.end || "", listing: [bk.listing, bk.pass].filter(Boolean).join(" · ") })),
      };
      setOpenInfo({ info, name: d.name, email: d.parentEmail, phone: d.parentPhone });
    } catch (e) { setErr(e instanceof Error ? e.message : "Couldn’t load the child card"); }
    setLoadingCard(false);
  }

  // Quick links on the card — the exact set the register uses, hidden the moment
  // they're switched off in Setup → Register.
  const go = (href: string) => { onClose(); router.push(href); };
  const openExternal = (href: string) => { const a = document.createElement("a"); a.href = href; a.target = "_blank"; a.rel = "noopener noreferrer"; document.body.appendChild(a); a.click(); a.remove(); };
  const incidentSeg = portal === "staff" ? "incident" : "incidents";
  // UK-first E.164-ish number for wa.me (0… → 44…, strip non-digits).
  const waNumber = (phone: string) => { let n = (phone || "").replace(/\D/g, ""); if (n.startsWith("00")) n = n.slice(2); else if (n.startsWith("0")) n = "44" + n.slice(1); return n; };
  // A fancy action tile — icon disc + label, hover lift, tinted to its action.
  const tile = (icon: ReactNode, label: string, tint: string, href: string, disabled = false, external = false) => (
    <button key={label} type="button" disabled={disabled} onClick={() => external ? openExternal(href) : go(href)}
      className="flex flex-col items-center gap-1 rounded-xl border px-1 py-1.5 text-center transition hover:-translate-y-0.5 hover:shadow-[0_8px_18px_-10px_rgba(9,20,44,.5)] disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none"
      style={{ borderColor: tint + "33", background: tint + "0f" }}>
      <span className="flex h-7 w-7 items-center justify-center rounded-full text-[13px]" style={{ background: tint + "22" }}>{icon}</span>
      <span className="text-[9.5px] font-extrabold leading-tight" style={{ color: tint }}>{label}</span>
    </button>
  );
  // Two "wheels": Log (records) and Family (reach the parent). Columns match the
  // tile count so every tile fits on one line.
  const wheel = (title: string, dot: string, items: ReactNode[]) => items.length === 0 ? null : (
    <div className="min-w-[220px] flex-1 rounded-2xl border border-[var(--line)] bg-[var(--panel)]/60 p-2.5">
      <div className="mb-1.5 flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: dot }} /><span className="text-[10.5px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-2)]">{title}</span></div>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0,1fr))` }}>{items}</div>
    </div>
  );
  let quickLinks: ReactNode = null;
  if (openInfo) {
    const name = encodeURIComponent(openInfo.name);
    const email = encodeURIComponent(openInfo.email.trim().toLowerCase());
    const wa = waNumber(openInfo.phone);
    // First aid / incidents / medication / moments are "on the day" records —
    // they only make sense once the child has attended, i.e. has a booking. For
    // a child with no booking they'd never link to the parent, so disable them.
    const noBooking = !((openInfo.info.attending ?? []).length);
    const log: ReactNode[] = [];
    if (acts.firstAid !== false) log.push(tile("⛑️", "First aid", "#be123c", `/${portal}/accidents?child=${name}`, noBooking));
    if (acts.incident !== false) log.push(tile("⚠️", "Log concern", "#b45309", `/${portal}/${incidentSeg}?child=${name}`, noBooking));
    if (acts.medication !== false) log.push(tile("💊", "Medication", "#15803d", `/${portal}/medication?child=${name}`, noBooking));
    if (acts.meals !== false) log.push(tile("🍽️", "Meals", "#0f766e", `/${portal}/meals?child=${name}`, noBooking));
    if (acts.moments !== false) log.push(tile("📸", "Moment", "#7c3aed", `/${portal}/moments?child=${name}`, noBooking));
    const fam: ReactNode[] = [];
    if (acts.message !== false) fam.push(tile("💬", "Message parent", "#1d3a8f", `/${portal}/messages?compose=1&emails=${email}`, !openInfo.email));
    if (acts.email !== false) fam.push(tile("✉️", "Email parent", "#0e7490", `/${portal}/email?to=${email}`, !openInfo.email));
    if (acts.whatsapp !== false) fam.push(tile(WA_ICON, "WhatsApp", "#128c7e", `https://wa.me/${wa}`, !wa, true));
    quickLinks = (
      <div className="w-full">
        <div className="flex w-full flex-wrap gap-2">{wheel("Log", "#be123c", log)}{wheel("Family", "#1d3a8f", fam)}</div>
        {noBooking && (
          <div className="mt-2 text-[11px] leading-[1.5] text-[var(--ink-3)]">
            First aid, concerns, medication, meals &amp; moments unlock once <b>{openInfo.name}</b> has a booking — they&rsquo;re on-the-day records that only reach the parent for a child who&rsquo;s attending.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 p-4 pt-[6vh]" onClick={onClose}>
      <div className="w-full max-w-[860px]" onClick={(e) => e.stopPropagation()}>
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
                  : shown.length === 0 ? <div className="py-8 text-center text-[12.5px] text-[var(--ink-3)]">{term ? "No child matches." : "No children on your list yet."}</div>
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
