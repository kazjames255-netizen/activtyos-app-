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

// R-12 printable progress report: one child's summary as a clean paper page (window.print + @media print, no PDF service).
// Child-scoped: it only ever fetches the chosen child's mastery and homework, and shows nothing from the tutor's private
// notes, other children, or free-text feedback. The whole page is plain black on white so it prints well without theme colours.

const TERM_DAYS = 90; // "this term" = the last 90 days of homework (there is no term calendar in the data yet)
const day = 86_400_000;
const fmt = (iso: string | number) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
const starWords = (n: number) => (n === 0 ? "not started yet" : `${n} of 3 stars`);

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

  const first = (p.child?.childName ?? mastery?.childName ?? "").split(" ")[0] || "Your child";
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
    for (const h of overdue.slice(0, 3)) next.push(`Hand in "${h.title}" (it was due ${fmt(h.dueAt)}).`);
    for (const h of open.filter((x) => new Date(x.dueAt).getTime() >= now).slice(0, 2)) next.push(`Homework "${h.title}" is due ${fmt(h.dueAt)}.`);
    if (topics.length > 1) next.push(`Practise ${[topics[0].topic, topics[0].subtopic].filter(Boolean).join(" › ")} (${topics[0].subject}) next.`);
    if (next.length === 0) next.push(subjects.length ? "Nothing is waiting. A short quiz or a few flashcards keeps things fresh." : "Start with a first quiz, so there is something to report on.");
    return { done, setN: set.length, subjects, next };
  }, [mastery, homework, childId, now]);

  if (typeof document === "undefined") return null;
  const S: React.CSSProperties = { background: "#fff", color: "#111" };
  return createPortal(
    <div id="aos-report-root" role="dialog" aria-modal="true" aria-label={`${first}'s progress report`} data-testid="hub-report" className="fixed inset-0 z-[80] overflow-auto" style={{ background: "#eef0f4" }}>
      <style>{PRINT_CSS}</style>
      <div className="aos-noprint sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b px-4 py-2" style={{ background: "#fff", borderColor: "#d5d9e0", color: "#111" }}>
        <button type="button" onClick={onClose} data-testid="hub-report-close" className="min-h-[44px] rounded-full px-4 text-[13px] font-extrabold" style={{ border: "1px solid #b8bec9", color: "#111", background: "#fff" }}>Back</button>
        <button type="button" onClick={() => window.print()} disabled={!data} data-testid="hub-report-print" className="ml-auto min-h-[44px] rounded-full px-5 text-[13px] font-extrabold disabled:opacity-50" style={{ background: "#1f3a8a", color: "#fff" }}>Print or save as PDF</button>
      </div>
      <article className="aos-sheet mx-auto my-4 max-w-[800px] rounded-lg px-6 py-7 sm:px-10 sm:py-10" style={{ ...S, boxShadow: "0 2px 12px rgba(0,0,0,.12)", fontFamily: "system-ui, sans-serif" }}>
        <header style={{ borderBottom: "2px solid #111", paddingBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#444" }}>{p.providerName ?? "Your tutor"} · Progress report</div>
          <h1 style={{ color: "#111", margin: "6px 0 0", fontSize: 28, lineHeight: 1.15 }} data-testid="hub-report-name">{full || first}</h1>
          <div style={{ fontSize: 13, color: "#444", marginTop: 2 }}>Prepared on {fmt(now)}</div>
        </header>
        {err && !data ? (
          <div role="alert" style={{ marginTop: 20, fontSize: 14 }}>{friendlyError(err, "My Classroom")} <button type="button" className="aos-noprint" onClick={() => setTick((t) => t + 1)} style={{ minHeight: 44, textDecoration: "underline", fontWeight: 700 }}>{PARENT_COPY.tryAgain}</button></div>
        ) : !data ? (
          <div role="status" style={{ marginTop: 20, fontSize: 14, color: "#444" }}>Building the report…</div>
        ) : (
          <>
            <section style={{ marginTop: 20 }}>
              <h2 style={{ color: "#111", fontSize: 16, margin: "0 0 8px" }}>Subjects</h2>
              {data.subjects.length === 0 ? <p style={{ margin: 0, fontSize: 14 }}>{first} hasn&apos;t finished a quiz yet, so there are no results to show. They will appear here after the first one.</p> : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead><tr style={{ textAlign: "left", borderBottom: "1px solid #999" }}><th style={{ padding: "6px 4px" }}>Subject</th><th style={{ padding: "6px 4px" }}>Stars</th><th style={{ padding: "6px 4px" }}>Level</th><th style={{ padding: "6px 4px" }}>Topics tried</th></tr></thead>
                  <tbody>
                    {data.subjects.map((s) => {
                      const stars = starsOf(s.masteryPct);
                      const tried = s.topics.filter((t) => t.attempts > 0).length;
                      return (
                        <tr key={s.subject} style={{ borderBottom: "1px solid #ddd" }}>
                          <td style={{ padding: "8px 4px", fontWeight: 700 }}>{s.subject}</td>
                          <td style={{ padding: "8px 4px" }}><span aria-hidden style={{ letterSpacing: 2 }}>{"★".repeat(stars)}{"☆".repeat(3 - stars)}</span> <span>{starWords(stars)}</span></td>
                          <td style={{ padding: "8px 4px" }}>{s.band ?? "Not started yet"}</td>
                          <td style={{ padding: "8px 4px" }}>{s.topics.length ? `${tried} of ${s.topics.length}` : "–"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </section>
            <section style={{ marginTop: 20 }}>
              <h2 style={{ color: "#111", fontSize: 16, margin: "0 0 8px" }}>Homework this term</h2>
              <p style={{ margin: 0, fontSize: 14 }} data-testid="hub-report-homework">{data.setN === 0 ? "No homework has been set in the last 3 months." : <><b>{data.done} of {data.setN}</b> handed in (the last 3 months).</>}</p>
            </section>
            <section style={{ marginTop: 20 }}>
              <h2 style={{ color: "#111", fontSize: 16, margin: "0 0 8px" }}>Next steps</h2>
              <ul style={{ margin: 0, paddingLeft: 20, listStyle: "disc", fontSize: 14, lineHeight: 1.6 }}>{data.next.map((t) => <li key={t}>{t}</li>)}</ul>
            </section>
            <footer style={{ marginTop: 28, borderTop: "1px solid #bbb", paddingTop: 8, fontSize: 11, color: "#555" }}>This report covers {first} only. Levels use {p.providerName ?? "the tutor"}&apos;s own level names.</footer>
          </>
        )}
      </article>
    </div>,
    document.body,
  );
}
