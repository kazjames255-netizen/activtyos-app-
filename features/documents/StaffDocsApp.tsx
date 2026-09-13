"use client";

// Staff-facing documents — the policies, procedures and (listing-specific) risk
// assessments a staff member has been assigned. They read each one and tick to
// confirm. Reads the operator's library from the server; a document assigned
// to a LISTING shows once the person is deployed to that listing. The tick is
// recorded on the server against THIS version — a new version needs a new
// confirmation — so it's evidence, not a browser setting.
import { useEffect, useState } from "react";
import { isDemoMode } from "@/lib/api";
import { confirmRead, fetchLibrary } from "./docStore";
import { Button, Card } from "@/components/ui";
import { LIGHT_PALETTE, PageHero } from "@/components/OperatorPage";
import { DOCS_KEY, seedDocs, openDoc, docDaysUntil, statusOf, type DocItem } from "./DocumentsApp";
import { useI18n } from "@/lib/i18n/provider";

// Same as DocumentsApp's docFmt, in the reader's language.
const docFmt = (d?: string, locale = "en-GB") => { if (!d) return "—"; const x = new Date(d + "T00:00:00"); return isNaN(+x) ? d : x.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }); };
// Display labels for the stored document categories (stored values stay English).
const CAT_KEY: Record<string, string> = {
  Policy: "staffp.docCatPolicy", "Risk assessment": "staffp.docCatRisk", Handbook: "staffp.docCatHandbook", Procedure: "staffp.docCatProcedure",
  Insurance: "staffp.docCatInsurance", Form: "staffp.docCatForm", Certificate: "staffp.docCatCertificate", Other: "staffp.docCatOther",
};

// Guided-tour demo only: who "me" is, and where they're deployed.
const DEMO_ME = { name: "Marcus Bell", role: "Lead", title: "Coach / Staff", listings: ["After-School Football Club"] };

const roleMatch = (list: string[], me: string) => !!me && list.some((r) => { const rl = r.toLowerCase(), m = me.toLowerCase(); return rl.includes(m) || m.includes(rl.split(/[ /]/)[0]); });

const RKEY = "aos.docs.read.v1";

export function StaffDocsApp() {
  const { t, locale: appLocale } = useI18n();
  const locale = appLocale === "en" ? "en-GB" : appLocale; // for dates — plain "en" formats US-style
  const [docs, setDocs] = useState<DocItem[]>(seedDocs);
  // docId → when I confirmed the CURRENT version
  const [read, setRead] = useState<Record<string, string>>({});
  const [me, setMe] = useState<{ name: string; role: string; title: string; listings: string[] }>(isDemoMode() ? DEMO_ME : { name: "", role: "", title: "", listings: [] });
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (isDemoMode()) {
      try { const s = JSON.parse(localStorage.getItem(DOCS_KEY) || "null"); if (Array.isArray(s) && s.length) setDocs(s); } catch { /* ignore */ }
      try { const r = JSON.parse(localStorage.getItem(RKEY) || "null"); if (r && typeof r === "object") setRead(r[DEMO_ME.name] || {}); } catch { /* ignore */ }
      return;
    }
    fetchLibrary<DocItem>().then((r) => {
      const list = r.docs?.length ? r.docs : [];
      setDocs(list);
      const cur = new Map(list.map((d) => [d.id, d.version]));
      setRead(Object.fromEntries((r.reads ?? []).filter((x) => cur.get(x.docId) === x.version).map((x) => [x.docId, x.at])));
      if (r.me) setMe({ name: r.me.name, role: r.me.role, title: r.me.role, listings: r.me.listings });
    }).catch((e) => setErr(e instanceof Error ? e.message : "staffp.docLoadErr"));
  }, []);
  const confirm = (id: string, on: boolean) => {
    const d = docs.find((x) => x.id === id);
    const prev = read;
    const next = { ...read }; if (on) next[id] = new Date().toISOString(); else delete next[id];
    setRead(next);
    if (isDemoMode()) { try { const all = JSON.parse(localStorage.getItem(RKEY) || "{}"); all[DEMO_ME.name] = next; localStorage.setItem(RKEY, JSON.stringify(all)); } catch { /* ignore */ } return; }
    if (d) confirmRead(id, d.version, on).catch((e) => { setRead(prev); setErr(e instanceof Error ? e.message : t("staffp.docRecordErr")); });
  };

  const appliesToMe = (d: DocItem) => d.all || roleMatch(d.roles, me.role) || roleMatch(d.titles, me.title) || d.listings.some((l) => me.listings.includes(l));
  const mine = docs.filter(appliesToMe);
  const general = mine.filter((d) => d.listings.length === 0 || d.all);
  const listingDocs = mine.filter((d) => !d.all && d.listings.length > 0);
  const readCount = mine.filter((d) => read[d.id]).length;

  const docRow = (d: DocItem) => {
    const isRead = !!read[d.id]; const st = statusOf(d);
    // same thresholds as statusOf, translated
    const dl = docDaysUntil(d.expiry);
    const stLabel = dl == null ? t("staffp.docStNoReview") : dl < 0 ? t("staffp.docStExpired") : dl <= 60 ? t("staffp.docStReviewIn", { n: dl }) : t("staffp.docStInDate");
    return (
    <div key={d.id} className={"flex flex-wrap items-center gap-3 rounded-xl border p-3 " + (isRead ? "border-[#cfe8d7] bg-[#f4fbf6]" : "border-[var(--line)]")}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><span className="text-[13.5px] font-extrabold text-[var(--ink)]">{d.title}</span><span className="rounded-full bg-[#eef1f6] px-2 py-0.5 text-[10px] font-bold text-[#5b6577]">{CAT_KEY[d.category] ? t(CAT_KEY[d.category]) : d.category}</span>{d.listings.length > 0 && !d.all && d.listings.map((l) => <span key={l} className="rounded-full bg-[#eaf1ff] px-2 py-0.5 text-[10px] font-bold text-[#1d54c4]">📋 {l}</span>)}</div>
        <div className="mt-0.5 text-[11.5px] text-[var(--ink-3)]">{t("staffp.docUpdated", { v: d.version, date: docFmt(d.uploadedAt, locale) })}{d.expiry ? ` · ${t("staffp.docReviewBy", { date: docFmt(d.expiry, locale) })}` : ""}{isRead ? ` · ${t("staffp.docYouConfirmed", { date: docFmt(read[d.id].slice(0, 10), locale) })}` : ""}</div>
      </div>
      <span className={"rounded-full px-2 py-0.5 text-[10px] font-bold " + st.tone}>{stLabel}</span>
      <Button onClick={() => openDoc(d)}>{t("staffp.docRead")}</Button>
      <label className="flex cursor-pointer items-center gap-2 text-[12.5px] font-bold text-[var(--ink-2)]"><input type="checkbox" checked={isRead} onChange={(e) => confirm(d.id, e.target.checked)} className="h-4 w-4 accent-[#0f7a43]" /> {t("staffp.docIveRead")}</label>
    </div>
  ); };

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero title={t("staffp.docTitle")} icon="📁" lede={t("staffp.docLede")} />
      {err && <Card className="mb-3 border-[#f6c9cc] bg-[#fdebec] p-3 text-[12.5px] font-semibold text-[#c02636]">{err.startsWith("staffp.") ? t(err) : err}</Card>}

      <Card className="mb-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div><div className="text-[11px] font-extrabold uppercase tracking-wide text-[#1d3a8f]">{t("staffp.docReading")}</div><div className="text-[13px] text-[var(--ink-3)]">{t("staffp.docConfirmedOf", { a: readCount, b: mine.length })}</div></div>
          <div className="min-w-[140px] flex-1"><div className="h-2 overflow-hidden rounded-full bg-[var(--panel)]"><div className={"h-full rounded-full transition-all " + (readCount === mine.length ? "bg-[#0f9d58]" : "bg-[#3f7ae0]")} style={{ width: `${mine.length ? (readCount / mine.length) * 100 : 0}%` }} /></div></div>
          <span className="text-[15px] font-extrabold tabular-nums text-[var(--ink)]">{mine.length ? Math.round((readCount / mine.length) * 100) : 0}%</span>
        </div>
      </Card>

      <h3 className="mb-1.5 text-[13px] font-extrabold uppercase tracking-wide text-[var(--ink-2)]">{t("staffp.docPolicies")}</h3>
      <div className="space-y-2">{general.length ? general.map(docRow) : <Card className="p-4 text-center text-[12.5px] text-[var(--ink-3)]">{t("staffp.docNothing")}</Card>}</div>

      {listingDocs.length > 0 && (<>
        <h3 className="mb-1.5 mt-4 text-[13px] font-extrabold uppercase tracking-wide text-[var(--ink-2)]">{t("staffp.docForActivities")}</h3>
        <div className="space-y-2">{listingDocs.map(docRow)}</div>
      </>)}

      <p className="mt-3 text-[11.5px] text-[var(--ink-3)]">{t("staffp.docFooter")}</p>
    </div>
  );
}
