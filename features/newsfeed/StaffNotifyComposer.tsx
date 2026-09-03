"use client";

// Operator "To staff" composer — the STAFF audience of notifications, reached
// from the Newsfeed's Parents / Staff switch. A manager writes a notice here and
// every staff member on the chosen site sees it on their Announcements board (and,
// in production, their bell). Demo-wired to the shared announcements store; real
// per-site delivery + push is Amir's.
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui";
import { get as apiGet } from "@/lib/api";
import { useSettings } from "@/lib/settings";
import { addAnnouncement, loadAnnouncements, type Announcement } from "@/features/staff/announcements";

const BLUE = "#1d3a8f";

export function StaffNotifyComposer({ listings, authorName }: { listings: { id: string; title: string }[]; authorName?: string }) {
  const { settings } = useSettings();
  const annCfg = settings.announcements;
  const portal = usePathname()?.split("/")[1] || "freelancer";
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [scope, setScope] = useState("all"); // "all" | listing title
  const [important, setImportant] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [sent, setSent] = useState<Announcement[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  // Head-office targeting: aim a staff notice at everyone in the network or a
  // single franchise's team. Only shown when this company has franchises.
  const [franchises, setFranchises] = useState<{ franchiseId: string; name: string; area: string | null }[]>([]);
  const [frTarget, setFrTarget] = useState(""); // "" = all franchises across the network
  useEffect(() => { if (portal === "company") apiGet<{ franchiseId: string; name: string; area: string | null }[]>("/api/franchises").then(setFranchises).catch(() => {}); }, [portal]);
  const isHo = franchises.length > 0;
  const frName = frTarget ? (franchises.find((f) => f.franchiseId === frTarget)?.name ?? "this franchise") : "";

  useEffect(() => { setSent(loadAnnouncements()); }, []);
  // Apply the composer defaults from Setup → Announcements on load.
  useEffect(() => {
    if (annCfg?.defaultImportant) setImportant(true);
    if (annCfg?.defaultAudience === "listing" && listings[0]) setScope(listings[0].title);
  }, [annCfg?.defaultImportant, annCfg?.defaultAudience, listings]);

  const baseAudience = scope === "all" ? "All staff" : `Staff at ${scope}`;
  const audienceLabel = isHo ? (frTarget ? `${frName} · ${baseAudience.toLowerCase()}` : `All franchises across the network · ${baseAudience.toLowerCase()}`) : baseAudience;
  const canSend = title.trim().length > 1 && body.trim().length > 1;

  const send = () => {
    if (!canSend) return;
    const next = addAnnouncement({ author: authorName?.trim() || "Head Office", role: "Manager", title: title.trim(), body: body.trim(), audienceLabel, important, pinned });
    setSent(next);
    setTitle(""); setBody(""); setImportant(false); setPinned(false); setScope("all"); setFrTarget("");
    setFlash(`Sent to ${audienceLabel.toLowerCase()} — it’s on their Announcements board now.`);
    setTimeout(() => setFlash(null), 4000);
  };

  const fmtDate = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  return (
    <div className="grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
      {/* Composer */}
      <div className="rounded-2xl border border-[#dbe6fb] bg-[var(--surface)] p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <span className="grid h-8 w-8 flex-none place-items-center rounded-lg text-[16px] text-white" style={{ background: BLUE }}>🧑‍🏫</span>
          <div className="min-w-0">
            <div className="text-[14px] font-extrabold text-[var(--ink)]">Notify your staff</div>
            <div className="text-[11.5px] text-[var(--ink-3)]">Goes to their Announcements board and in-app bell — not to families.</div>
          </div>
          <Link href={`/${portal}/setup?tab=announcements`} title="Announcement settings" className="ml-auto flex flex-none items-center gap-1 rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-[11.5px] font-bold text-[var(--ink-2)] transition hover:border-[#c9d6f5] hover:text-[#1d3a8f]">⚙ Settings</Link>
        </div>

        {isHo && (
          <>
            <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Send across your network to</label>
            <select value={frTarget} onChange={(e) => setFrTarget(e.target.value)} className="mb-3 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[13px] text-[var(--ink)]">
              <option value="">🌐 All franchises across the network</option>
              {franchises.map((f) => <option key={f.franchiseId} value={f.franchiseId}>{f.name}{f.area ? ` · ${f.area}` : ""}</option>)}
            </select>
          </>
        )}

        <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Who gets it</label>
        <select value={scope} onChange={(e) => setScope(e.target.value)} className="mb-3 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[13px] text-[var(--ink)]">
          <option value="all">All staff on the site</option>
          {listings.map((l) => <option key={l.id} value={l.title}>Staff on {l.title}</option>)}
        </select>

        <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={90} placeholder="e.g. Early start tomorrow — 8am" className="mb-3 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[13.5px] text-[var(--ink)]" />

        <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Message</label>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={1200} placeholder="Write your notice to the team…" className="mb-3 w-full resize-y rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[13.5px] leading-[1.55] text-[var(--ink)]" />

        <div className="mb-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setImportant((v) => !v)} className={"rounded-full border px-3 py-1.5 text-[12px] font-bold " + (important ? "border-[#f3c6c1] bg-[#fdedeb] text-[#c0392b]" : "border-[var(--line)] bg-white text-[var(--ink-3)]")}>{important ? "★ Marked important" : "Mark important"}</button>
          <button type="button" onClick={() => setPinned((v) => !v)} className={"rounded-full border px-3 py-1.5 text-[12px] font-bold " + (pinned ? "border-[#b9d0f7] bg-[#eaf1fe] text-[#1d3a8f]" : "border-[var(--line)] bg-white text-[var(--ink-3)]")}>{pinned ? "📌 Pinned to top" : "Pin to top"}</button>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={send} disabled={!canSend}>Send to staff</Button>
          <span className="text-[11.5px] text-[var(--ink-3)]">{audienceLabel}</span>
        </div>
        {flash && <div className="mt-3 rounded-lg border border-[#bfe6cf] bg-[#f2fbf5] px-3 py-2 text-[12.5px] font-semibold text-[#0f7a43]">✓ {flash}</div>}
      </div>

      {/* Recently sent */}
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4">
        <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">On the staff board</div>
        <div className="flex flex-col gap-2">
          {sent.slice(0, 6).map((a) => (
            <div key={a.id} className="rounded-xl border border-[var(--line)] bg-white p-3">
              <div className="flex items-center gap-1.5">
                {a.pinned && <span className="text-[12px]">📌</span>}
                {a.important && <span className="rounded-full bg-[#fdedeb] px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase text-[#c0392b]">Important</span>}
                <span className="text-[13px] font-extrabold text-[var(--ink)]">{a.title}</span>
              </div>
              <div className="mt-0.5 text-[11px] text-[var(--ink-3)]">{a.author} · {a.audienceLabel || "All staff"} · {fmtDate(a.date)}</div>
              <p className="mt-1 line-clamp-2 text-[12px] leading-[1.5] text-[var(--ink-2)]">{a.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
