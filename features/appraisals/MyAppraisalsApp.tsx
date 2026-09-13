"use client";

// Staff "My appraisals" — my upcoming/past reviews, the self-assessment I owe,
// and my live goals. Read + self-assess only; the manager side and sign-off
// live in the operator suite. From the server (/api/appraisals), which hands a
// member of staff their own reviews only — it used to read the manager's
// browser storage, so on the staff member's own phone it was always empty.
// The demo filters its seeded reviews to the demo person (Marcus Bell).
import { useEffect, useMemo, useState } from "react";
import { Button, Card } from "@/components/ui";
import { LIGHT_PALETTE, PageHero } from "@/components/OperatorPage";
import { type Review, type Rating, type ReviewKind, type ReviewStatus, type Goal, daysUntil, isOverdue, overallScore } from "@/lib/appraisals";
import { loadReviews, saveReviews, templateFor, slug, syncAppraisals, submitSelfAssessment } from "./data";
import { isDemoMode } from "@/lib/api";
import { useI18n } from "@/lib/i18n/provider";

// Display labels (the stored values stay English) — mirror lib/appraisals' *_LABEL maps.
const KIND_KEY: Record<ReviewKind, string> = { probation: "staffp.aprKindProbation", "3-month": "staffp.aprKind3m", "6-month": "staffp.aprKind6m", annual: "staffp.aprKindAnnual", supervision: "staffp.aprKindSupervision" };
const STATUS_KEY: Record<ReviewStatus, string> = { scheduled: "staffp.aprStScheduled", self: "staffp.aprStSelf", manager: "staffp.aprStManager", signoff: "staffp.aprStSignoff", complete: "staffp.aprStComplete" };
const RATING_KEY: Record<Rating, string> = { 1: "staffp.aprRate1", 2: "staffp.aprRate2", 3: "staffp.aprRate3", 4: "staffp.aprRate4", 5: "staffp.aprRate5" };
const GOAL_KEY: Record<Goal["status"], string> = { open: "staffp.aprGoalOpen", progress: "staffp.aprGoalProgress", done: "staffp.aprGoalDone", carried: "staffp.aprGoalCarried" };
// Same as lib/appraisals' fmtDate, in the reader's language.
const fmtDate = (iso?: string, locale = "en-GB") => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }) : "—");

const ME = "Marcus Bell";

export function MyAppraisalsApp() {
  const { t, locale: appLocale } = useI18n();
  const locale = appLocale === "en" ? "en-GB" : appLocale; // for dates — plain "en" formats US-style
  const [reviews, setReviews] = useState<Review[]>([]);
  const [self, setSelf] = useState<Review | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const demo = isDemoMode();
  // Never the device's cache — on a shared browser it could be someone else's.
  useEffect(() => { if (demo) { setReviews(loadReviews()); return; } void syncAppraisals().then((ok) => { setReviews(ok ? loadReviews() : []); setLoadErr(!ok); }); }, [demo]);
  const mine = useMemo(() => (demo ? reviews.filter((r) => r.staffId === slug(ME)) : reviews), [reviews, demo]);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2400); };
  const persist = (r: Review[]) => { setReviews(r); saveReviews(r); };
  const submitSelf = (r: Review) => {
    if (demo) { persist(reviews.map((x) => x.id === r.id ? r : x)); setSelf(null); flash(t("staffp.aprSubmitted")); return; }
    submitSelfAssessment(r).then(() => { setReviews(loadReviews()); setSelf(null); flash(t("staffp.aprSubmitted")); }).catch((e) => flash(`⚠ ${e instanceof Error ? e.message : "Couldn't send it — try again"}`));
  };

  const todo = mine.filter((r) => r.status !== "complete" && !r.self.done);
  const upcoming = mine.filter((r) => r.status !== "complete").sort((a, b) => (a.due < b.due ? -1 : 1));
  const past = mine.filter((r) => r.status === "complete");
  const goals = mine.flatMap((r) => r.goals.map((g) => ({ ...g, from: t(KIND_KEY[r.kind]) }))).filter((g) => g.status !== "done");

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero title={t("staffp.aprTitle")} icon="📋" lede={t("staffp.aprLede")} />
      {loadErr && <Card className="mt-4 border-l-4 border-l-[#c0392b] p-3 text-[12.5px] font-semibold text-[#c0392b]">⚠ Couldn&rsquo;t load your appraisals — check your connection and reopen this page.</Card>}

      {todo.length > 0 && (
        <Card className="mt-4 border-l-4 border-l-[#1d3a8f] p-4">
          <div className="text-[13px] font-extrabold text-[var(--ink)]">{t("staffp.aprYourTurn")}</div>
          <div className="mt-2 space-y-2">{todo.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-[var(--panel)] p-2.5"><span className="text-[12.5px] font-bold text-[var(--ink)]">{t(KIND_KEY[r.kind])}</span><span className={`text-[11.5px] ${isOverdue(r) ? "font-bold text-[#c0392b]" : "text-[var(--ink-3)]"}`}>{t("staffp.aprDue", { date: fmtDate(r.due, locale) })} · {isOverdue(r) ? t("staffp.aprOverdue") : t("staffp.aprInDays", { n: daysUntil(r.due) })}</span><Button variant="primary" className="ml-auto" onClick={() => setSelf(r)}>{t("staffp.aprFillIn")}</Button></div>
          ))}</div>
        </Card>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="mb-2 text-[12px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("staffp.aprGoals")}</div>
          {goals.length === 0 ? <div className="text-[12.5px] text-[var(--ink-3)]">{t("staffp.aprNoGoals")}</div> : <div className="space-y-2">{goals.map((g) => (
            <div key={g.id} className="rounded-xl border border-[var(--line)] p-2.5"><div className="flex items-center gap-2"><span className="text-[12.5px] font-bold text-[var(--ink)]">{g.title || t("staffp.aprUntitled")}</span><span className="ml-auto rounded-full bg-[#eef4fd] px-2 py-0.5 text-[10px] font-bold text-[#1d3a8f]">{t(GOAL_KEY[g.status])}</span></div>{g.detail && <div className="mt-0.5 text-[11px] text-[var(--ink-2)]">{g.detail}</div>}<div className="mt-0.5 text-[10.5px] text-[var(--ink-3)]">{g.from}{g.due ? ` · ${t("staffp.aprTarget", { date: fmtDate(g.due, locale) })}` : ""}</div>{(typeof g.progress === "number" || g.status === "done") && <div className="mt-1.5 flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full bg-[#1d3a8f]" style={{ width: `${g.status === "done" ? 100 : g.progress}%` }} /></div><span className="text-[10px] font-bold tabular-nums text-[var(--ink-3)]">{g.status === "done" ? 100 : g.progress}%</span></div>}</div>
          ))}</div>}
        </Card>

        <Card className="p-4">
          <div className="mb-2 text-[12px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("staffp.aprUpcoming")}</div>
          {upcoming.length === 0 ? <div className="text-[12.5px] text-[var(--ink-3)]">{t("staffp.aprNothing")}</div> : <div className="space-y-1.5">{upcoming.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 text-[12.5px]"><span className="font-bold text-[var(--ink)]">{t(KIND_KEY[r.kind])}</span><span className="text-[10.5px] text-[var(--ink-3)]">· {t("staffp.aprWith", { name: r.appraiser && r.appraiser !== "You" ? r.appraiser : t("staffp.aprYourManager") })}</span><span className="ml-auto text-[var(--ink-3)]">{fmtDate(r.due, locale)}</span><span className="rounded-full bg-[#eef4fd] px-2 py-0.5 text-[10px] font-bold text-[#1d3a8f]">{t(STATUS_KEY[r.status])}</span></div>
          ))}</div>}
        </Card>
      </div>

      <Card className="mt-4 p-4">
        <div className="mb-2 text-[12px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{t("staffp.aprPast")}</div>
        {past.length === 0 ? <div className="text-[12.5px] text-[var(--ink-3)]">{t("staffp.aprNoPast")}</div> : <div className="space-y-2">{past.map((r) => { const sc = overallScore(r); return (
          <div key={r.id} className="rounded-xl border border-[var(--line)] p-3"><div className="flex items-center gap-2"><span className="text-[12.5px] font-bold text-[var(--ink)]">{t(KIND_KEY[r.kind])}</span><span className="text-[11px] text-[var(--ink-3)]">{fmtDate(r.due, locale)}</span>{sc != null && <span className="ml-auto rounded-full bg-[#e6f4ea] px-2 py-0.5 text-[11px] font-extrabold text-[#0f7a43]">{sc}/5</span>}</div>{r.manager.text && <p className="mt-1.5 text-[12px] text-[var(--ink-2)]">“{r.manager.text}”</p>}</div>
        ); })}</div>}
      </Card>

      {self && <SelfAssess rev={self} onSave={submitSelf} onClose={() => setSelf(null)} />}
      {toast && <div className="fixed bottom-5 left-1/2 z-[150] max-w-[92vw] -translate-x-1/2 rounded-2xl bg-[#111634] px-4 py-2.5 text-center text-[12.5px] font-bold text-white shadow-xl">{toast}</div>}
    </div>
  );
}

function SelfAssess({ rev, onSave, onClose }: { rev: Review; onSave: (r: Review) => void; onClose: () => void }) {
  const { t } = useI18n();
  const [r, setR] = useState<Review>(rev);
  const tpl = templateFor(r.role);
  const setRating = (id: string, rating: Rating) => setR((x) => ({ ...x, self: { ...x.self, ratings: x.self.ratings.some((c) => c.id === id) ? x.self.ratings.map((c) => c.id === id ? { ...c, rating } : c) : [...x.self.ratings, { id, rating }] } }));
  return (
    <div className="fixed inset-0 z-[140] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[6vh]" onClick={onClose} style={LIGHT_PALETTE}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center gap-2"><h3 className="text-[15px] font-extrabold text-[var(--ink)]">{t("staffp.aprSelf")}</h3><span className="text-[12px] text-[var(--ink-3)]">· {t(KIND_KEY[r.kind])}</span><button type="button" onClick={onClose} className="ml-auto text-[18px] text-[var(--ink-3)]">×</button></div>
        <p className="mb-3 text-[12px] text-[var(--ink-3)]">{t("staffp.aprSelfIntro")}</p>
        <div className="space-y-1.5">{tpl.competencies.map((c) => { const cur = r.self.ratings.find((x) => x.id === c.id)?.rating; return (
          <div key={c.id} className="flex items-center gap-2"><div className="min-w-0 flex-1 text-[12.5px] font-semibold text-[var(--ink)]">{c.label}</div><div className="flex gap-1">{([1, 2, 3, 4, 5] as Rating[]).map((n) => (<button key={n} type="button" onClick={() => setRating(c.id, n)} title={t(RATING_KEY[n])} className={`h-7 w-7 rounded-lg text-[12px] font-bold ${cur === n ? "bg-[#1d3a8f] text-white" : "bg-[var(--panel)] text-[var(--ink-2)] hover:bg-[#e2e8f4]"}`}>{n}</button>))}</div></div>
        ); })}</div>
        <label className="mt-3 block"><span className="mb-1 block text-[10px] font-extrabold uppercase text-[var(--ink-3)]">{t("staffp.aprAdd")}</span><textarea value={r.self.text || ""} onChange={(e) => setR((x) => ({ ...x, self: { ...x.self, text: e.target.value } }))} rows={3} placeholder={t("staffp.aprAddPh")} className="w-full rounded-lg border border-[var(--line)] p-2 text-[12.5px]" /></label>
        <div className="mt-3 flex justify-end gap-2"><Button onClick={onClose}>{t("staffp.aprCancel")}</Button><Button variant="primary" onClick={() => onSave({ ...r, self: { ...r.self, done: true }, status: r.status === "self" || r.status === "scheduled" ? "manager" : r.status })}>{t("staffp.aprSubmit")}</Button></div>
      </div>
    </div>
  );
}

export default MyAppraisalsApp;
