"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { get } from "@/lib/api";
import type { PanelProps } from "../panelTypes";
import type { StudentHomework } from "../homework/hwTypes";
import { PARENT_COPY } from "../family/parentCopy";
import { friendlyError } from "../kit";
import { hubPath, type Mastery } from "../shared-assess/api";
import { errMsg } from "../types";
import { starsOf } from "./KidStars";
import { MY_CLASSROOM } from "../names";
import { useHubI18n } from "../family/hubT";
import { Rich } from "./Rich";
import { bandName } from "../family/KidMode";
import { uiDate } from "@/lib/i18n/format";

// R-12 printable progress report: one child's summary as a clean paper page (window.print + @media print, no PDF service).
// Child-scoped: it only ever fetches the chosen child's mastery and homework, and shows nothing from the tutor's private
// notes, other children, or free-text feedback. The whole page is plain black on white so it prints well without theme colours.

const TERM_DAYS = 90; // "this term" = the last 90 days of homework (there is no term calendar in the data yet)
const day = 86_400_000;
const fmtOn = (locale: string) => (iso: string | number) => { try { return uiDate(new Date(iso), { day: "numeric", month: "long", year: "numeric" }, locale); } catch { return new Date(iso).toDateString(); } };

const PRINT_CSS = `
@media print {
  body > *:not(#aos-report-root) { display: none !important; }
  #aos-report-root { position: static !important; inset: auto !important; overflow: visible !important; background: #fff !important; }
  #aos-report-root .aos-noprint { display: none !important; }
  #aos-report-root .aos-sheet { box-shadow: none !important; border: 0 !important; margin: 0 !important; max-width: none !important; padding: 0 !important; }
  @page { margin: 16mm; }
}`;

export function ProgressReportButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} data-testid="hub-report-open"
      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 text-[13px] font-extrabold text-[var(--brand)] hover:bg-[var(--brand-soft)] focus-visible:ring-2 focus-visible:ring-[var(--brand-2)]">
      {PARENT_COPY.reportButton}
    </button>
  );
}

export function ProgressReport({ p, childId, onClose }: { p: PanelProps; childId: string; onClose: () => void }) {
  const { t, locale } = useHubI18n();
  const fmt = useMemo(() => fmtOn(locale), [locale]);
  const starWords = (n: number) => (n === 0 ? t("hubfam.pgStarsNone") : t("hubfam.pgStarsN", { n }));
  const [mastery, setMastery] = useState<Mastery | null>(null);
  const [homework, setHomework] = useState<StudentHomework[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [now] = useState(() => Date.now());
  useEffect(() => {
    let live = true;
    Promise.all([get<Mastery>(hubPath(p.qs, "/mastery", { childId })), get<StudentHomework[] | { homework?: StudentHomework[] }>(hubPath(p.qs, "/homework", { childId }))])
      .then(([m, h]) => { if (!live) return; setErr(null); setMastery(m); setHomework(Array.isArray(h) ? h : h?.homework ?? []); })
      .catch((e) => { if (live) setErr(errMsg(e, PARENT_COPY.reportLoadFailed)); });
    return () => { live = false; };
  }, [p.qs, childId, tick]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);

  const first = (p.child?.childName ?? mastery?.childName ?? "").split(" ")[0] || t("hubfam.pgYourChild");
  const full = p.child?.childName ?? mastery?.childName ?? "";
  const data = useMemo(() => {
    if (!mastery || !homework) return null;
    const mine = homework.filter((h) => h.childId === childId && now - new Date(h.dueAt).getTime() <= TERM_DAYS * day);
    const set = mine.filter((h) => new Date(h.dueAt).getTime() <= now + 7 * day || h.submission.status !== "assigned");
    const done = set.filter((h) => h.submission.status !== "assigned").length;
    const open = homework.filter((h) => h.childId === childId && h.submission.status === "assigned").sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    const overdue = open.filter((h) => new Date(h.dueAt).getTime() < now);
    const subjects = mastery.subjects.filter((s) => s.masteryPct != null || s.topics.some((t) => t.attempts > 0)).sort((a, b) => a.subject.localeCompare(b.subject));
    const topics = subjects.flatMap((s) => s.topics.filter((t) => t.masteryPct != null && t.attempts > 0).map((t) => ({ ...t, subject: s.subject }))).sort((a, b) => (a.masteryPct ?? 0) - (b.masteryPct ?? 0));
    const next: string[] = [];
    for (const h of overdue.slice(0, 3)) next.push(t("hubfam.pgNextHand", { title: h.title, date: fmt(h.dueAt) }));
    for (const h of open.filter((x) => new Date(x.dueAt).getTime() >= now).slice(0, 2)) next.push(t("hubfam.pgNextDue", { title: h.title, date: fmt(h.dueAt) }));
    if (topics.length > 1) next.push(t("hubfam.pgNextPractise", { topic: [topics[0].topic, topics[0].subtopic].filter(Boolean).join(" › "), subject: topics[0].subject }));
    if (next.length === 0) next.push(subjects.length ? t("hubfam.pgNextNone") : t("hubfam.pgNextFirst"));
    return { done, setN: set.length, subjects, next };
  }, [mastery, homework, childId, now, t, fmt]);

  if (typeof document === "undefined") return null;
  const S: React.CSSProperties = { background: "#fff", color: "#111" };
  return createPortal(
    <div id="aos-report-root" role="dialog" aria-modal="true" aria-label={t("hubfam.pgRepAria", { name: first })} data-testid="hub-report" className="fixed inset-0 z-[80] overflow-auto" style={{ background: "#eef0f4" }}>
      <style>{PRINT_CSS}</style>
      <div className="aos-noprint sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b px-4 py-2" style={{ background: "#fff", borderColor: "#d5d9e0", color: "#111" }}>
        <button type="button" onClick={onClose} data-testid="hub-report-close" className="min-h-[44px] rounded-full px-4 text-[13px] font-extrabold" style={{ border: "1px solid #b8bec9", color: "#111", background: "#fff" }}>{t("hubfam.pgRepBack")}</button>
        <button type="button" onClick={() => window.print()} disabled={!data} data-testid="hub-report-print" className="ms-auto min-h-[44px] rounded-full px-5 text-[13px] font-extrabold disabled:opacity-50" style={{ background: "#1f3a8a", color: "#fff" }}>{t("hubfam.pgRepPrint")}</button>
      </div>
      <article className="aos-sheet mx-auto my-4 max-w-[800px] rounded-lg px-6 py-7 sm:px-10 sm:py-10" style={{ ...S, boxShadow: "0 2px 12px rgba(0,0,0,.12)", fontFamily: "system-ui, sans-serif" }}>
        <header style={{ borderBottom: "2px solid #111", paddingBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#444" }}>{t("hubfam.pgRepHeader", { provider: p.providerName ?? t("hubfam.pgYourTutor") })}</div>
          <h1 style={{ color: "#111", margin: "6px 0 0", fontSize: 28, lineHeight: 1.15 }} data-testid="hub-report-name">{full || first}</h1>
          <div style={{ fontSize: 13, color: "#444", marginTop: 2 }}>{t("hubfam.pgPrepared", { date: fmt(now) })}</div>
        </header>
        {err && !data ? (
          <div role="alert" style={{ marginTop: 20, fontSize: 14 }}>{friendlyError(err, MY_CLASSROOM)} <button type="button" className="aos-noprint" onClick={() => setTick((n) => n + 1)} style={{ minHeight: 44, textDecoration: "underline", fontWeight: 700 }}>{PARENT_COPY.tryAgain}</button></div>
        ) : !data ? (
          <div role="status" style={{ marginTop: 20, fontSize: 14, color: "#444" }}>{t("hubfam.pgBuilding")}</div>
        ) : (
          <>
            <section style={{ marginTop: 20 }}>
              <h2 style={{ color: "#111", fontSize: 16, margin: "0 0 8px" }}>{t("hubfam.pgSubjects")}</h2>
              {data.subjects.length === 0 ? <p style={{ margin: 0, fontSize: 14 }}>{t("hubfam.pgNoResultsYet", { name: first })}</p> : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead><tr style={{ textAlign: "start", borderBottom: "1px solid #999" }}><th style={{ padding: "6px 4px" }}>{t("hubfam.pgColSubject")}</th><th style={{ padding: "6px 4px" }}>{t("hubfam.pgColStars")}</th><th style={{ padding: "6px 4px" }}>{t("hubfam.pgLevelCap")}</th><th style={{ padding: "6px 4px" }}>{PARENT_COPY.topicsTried}</th></tr></thead>
                  <tbody>
                    {data.subjects.map((s) => {
                      const stars = starsOf(s.masteryPct);
                      const tried = s.topics.filter((t) => t.attempts > 0).length;
                      return (
                        <tr key={s.subject} style={{ borderBottom: "1px solid #ddd" }}>
                          <td style={{ padding: "8px 4px", fontWeight: 700 }}>{s.subject}</td>
                          <td style={{ padding: "8px 4px" }}><span aria-hidden style={{ letterSpacing: 2 }}>{"★".repeat(stars)}{"☆".repeat(3 - stars)}</span> <span>{starWords(stars)}</span></td>
                          <td style={{ padding: "8px 4px" }}>{s.band ? bandName(s.band) : t("hubfam.pgNotStartedYet")}</td>
                          <td style={{ padding: "8px 4px" }}>{s.topics.length ? `${tried} of ${s.topics.length}` : "–"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </section>
            <section style={{ marginTop: 20 }}>
              <h2 style={{ color: "#111", fontSize: 16, margin: "0 0 8px" }}>{t("hubfam.pgHwTerm")}</h2>
              <p style={{ margin: 0, fontSize: 14 }} data-testid="hub-report-homework">{data.setN === 0 ? t("hubfam.pgHwNone") : <Rich text={t("hubfam.pgHwDone", { a: data.done, b: data.setN })} />}</p>
            </section>
            <section style={{ marginTop: 20 }}>
              <h2 style={{ color: "#111", fontSize: 16, margin: "0 0 8px" }}>{t("hubfam.pgNext")}</h2>
              <ul style={{ margin: 0, paddingInlineStart: 20, listStyle: "disc", fontSize: 14, lineHeight: 1.6 }}>{data.next.map((x) => <li key={x}>{x}</li>)}</ul>
            </section>
            <footer style={{ marginTop: 28, borderTop: "1px solid #bbb", paddingTop: 8, fontSize: 11, color: "#555" }}>{t("hubfam.pgFooter", { name: first, provider: p.providerName ?? t("hubfam.pgTheTutor") })}</footer>
          </>
        )}
      </article>
    </div>,
    document.body,
  );
}
