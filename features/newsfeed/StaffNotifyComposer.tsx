"use client";

// Operator "To staff" composer — the STAFF audience of notifications, reached
// from the Newsfeed's Parents / Staff switch. A manager writes a notice here and
// every staff member on the chosen site sees it on their Announcements board (and,
// in production, their bell). Demo-wired to the shared announcements store; real
// per-site delivery + push is Amir's.
import { dateLocale as dl } from "@/lib/i18n/format";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui";
import { get as apiGet } from "@/lib/api";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n/provider";
import { fetchAnnouncements, postAnnouncement, type Announcement } from "@/features/staff/announcements";

const BLUE = "#1d3a8f";

export function StaffNotifyComposer({ listings, authorName }: { listings: { id: string; title: string }[]; authorName?: string }) {
  const t = useT();
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
  const frName = frTarget ? (franchises.find((f) => f.franchiseId === frTarget)?.name ?? t("p8em.snThisFranchise")) : "";

  useEffect(() => { fetchAnnouncements().then(setSent).catch(() => {}); }, []);
  // Apply the composer defaults from Setup → Announcements on load.
  useEffect(() => {
    if (annCfg?.defaultImportant) setImportant(true);
    if (annCfg?.defaultAudience === "listing" && listings[0]) setScope(listings[0].title);
  }, [annCfg?.defaultImportant, annCfg?.defaultAudience, listings]);

  const baseAudience = scope === "all" ? "All staff" : `Staff at ${scope}`;
  const audienceLabel = isHo ? (frTarget ? `${frName} · ${baseAudience.toLowerCase()}` : `All franchises across the network · ${baseAudience.toLowerCase()}`) : baseAudience;
  // Display-only label (the English audienceLabel above is what gets stored).
  const baseShown = scope === "all" ? t("p8em.snAudAll") : t("p8em.snAudAt", { scope });
  const audienceShown = isHo ? `${frTarget ? frName : t("p8em.snAllNetwork")} · ${baseShown}` : baseShown;
  const canSend = title.trim().length > 1 && body.trim().length > 1;

  const send = async () => {
    if (!canSend) return;
    try {
      // Really sent now: stored server-side and belled to each member of staff
      // in scope (a franchise target reaches only that franchise's team).
      const made = await postAnnouncement({ author: authorName?.trim() || "Head Office", role: "Manager", title: title.trim(), body: body.trim(), audienceLabel, important, pinned, ...(frTarget ? { franchiseId: frTarget } : {}) });
      setSent((p) => [made, ...p]);
      setTitle(""); setBody(""); setImportant(false); setPinned(false); setScope("all"); setFrTarget("");
      setFlash(t("p8em.snSent", { aud: audienceShown }));
    } catch (e) {
      setFlash(e instanceof Error ? t("p8em.snCouldntSendWith", { msg: e.message }) : t("p8em.snCouldntSend"));
    }
    setTimeout(() => setFlash(null), 4000);
  };

  const fmtDate = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString(dl(), { day: "numeric", month: "short" });

  return (
    <div className="grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
      {/* Composer */}
      <div className="rounded-2xl border border-[#dbe6fb] bg-[var(--surface)] p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <span className="grid h-8 w-8 flex-none place-items-center rounded-lg text-[16px] text-white" style={{ background: BLUE }}>🧑‍🏫</span>
          <div className="min-w-0">
            <div className="text-[14px] font-extrabold text-[var(--ink)]">{t("p8em.snTitle")}</div>
            <div className="text-[11.5px] text-[var(--ink-3)]">{t("p8em.snSub")}</div>
          </div>
          <Link href={`/${portal}/setup?tab=announcements`} title={t("p8em.snSettingsTitle")} className="ms-auto flex flex-none items-center gap-1 rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-[11.5px] font-bold text-[var(--ink-2)] transition hover:border-[#c9d6f5] hover:text-[#1d3a8f]">{t("p8em.snSettings")}</Link>
        </div>

        {isHo && (
          <>
            <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("p8em.snNetworkLabel")}</label>
            <select value={frTarget} onChange={(e) => setFrTarget(e.target.value)} className="mb-3 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[13px] text-[var(--ink)]">
              <option value="">🌐 {t("p8em.snAllNetwork")}</option>
              {franchises.map((f) => <option key={f.franchiseId} value={f.franchiseId}>{f.name}{f.area ? ` · ${f.area}` : ""}</option>)}
            </select>
          </>
        )}

        <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("p8em.snWho")}</label>
        <select value={scope} onChange={(e) => setScope(e.target.value)} className="mb-3 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[13px] text-[var(--ink)]">
          <option value="all">{t("p8em.snAllOnSite")}</option>
          {listings.map((l) => <option key={l.id} value={l.title}>{t("p8em.snStaffOn", { title: l.title })}</option>)}
        </select>

        <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("p8em.snTitleLabel")}</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={90} placeholder={t("p8em.snTitlePh")} className="mb-3 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[13.5px] text-[var(--ink)]" />

        <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("p8em.cMessage")}</label>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={1200} placeholder={t("p8em.snBodyPh")} className="mb-3 w-full resize-y rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[13.5px] leading-[1.55] text-[var(--ink)]" />

        <div className="mb-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => setImportant((v) => !v)} className={"rounded-full border px-3 py-1.5 text-[12px] font-bold " + (important ? "border-[#f3c6c1] bg-[#fdedeb] text-[#c0392b]" : "border-[var(--line)] bg-white text-[var(--ink-3)]")}>{important ? t("p8em.snImportantOn") : t("p8em.snImportantOff")}</button>
          <button type="button" onClick={() => setPinned((v) => !v)} className={"rounded-full border px-3 py-1.5 text-[12px] font-bold " + (pinned ? "border-[#b9d0f7] bg-[#eaf1fe] text-[#1d3a8f]" : "border-[var(--line)] bg-white text-[var(--ink-3)]")}>{pinned ? t("p8em.snPinnedOn") : t("p8em.snPinnedOff")}</button>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={send} disabled={!canSend}>{t("p8em.snSend")}</Button>
          <span className="text-[11.5px] text-[var(--ink-3)]">{audienceShown}</span>
        </div>
        {flash && <div className="mt-3 rounded-lg border border-[#bfe6cf] bg-[#f2fbf5] px-3 py-2 text-[12.5px] font-semibold text-[#0f7a43]">✓ {flash}</div>}
      </div>

      {/* Recently sent */}
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4">
        <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("p8em.snBoard")}</div>
        <div className="flex flex-col gap-2">
          {sent.slice(0, 6).map((a) => (
            <div key={a.id} className="rounded-xl border border-[var(--line)] bg-white p-3">
              <div className="flex items-center gap-1.5">
                {a.pinned && <span className="text-[12px]">📌</span>}
                {a.important && <span className="rounded-full bg-[#fdedeb] px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase text-[#c0392b]">{t("p8em.snImportantBadge")}</span>}
                <span className="text-[13px] font-extrabold text-[var(--ink)]">{a.title}</span>
              </div>
              <div className="mt-0.5 text-[11px] text-[var(--ink-3)]">{a.author} · {a.audienceLabel || t("p8em.snAudAll")} · {fmtDate(a.date)}</div>
              <p className="mt-1 line-clamp-2 text-[12px] leading-[1.5] text-[var(--ink-2)]">{a.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
