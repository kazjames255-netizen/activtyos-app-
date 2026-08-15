"use client";

// Staff "My appraisals" — my upcoming/past reviews, the self-assessment I owe,
// and my live goals. Filtered to ME (demo = Marcus Bell). Read + self-assess
// only; the manager side and sign-off live in the operator suite.
import { useEffect, useMemo, useState } from "react";
import { Button, Card } from "@/components/ui";
import { LIGHT_PALETTE, PageHero } from "@/components/OperatorPage";
import { type Review, type Rating, KIND_LABEL, STATUS_LABEL, RATING_LABEL, fmtDate, daysUntil, isOverdue, overallScore } from "@/lib/appraisals";
import { loadReviews, saveReviews, templateFor, slug } from "./data";

const ME = "Marcus Bell";

export function MyAppraisalsApp() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [self, setSelf] = useState<Review | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => { setReviews(loadReviews()); }, []);
  const mine = useMemo(() => reviews.filter((r) => r.staffId === slug(ME)), [reviews]);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2400); };
  const persist = (r: Review[]) => { setReviews(r); saveReviews(r); };

  const todo = mine.filter((r) => r.status !== "complete" && !r.self.done);
  const upcoming = mine.filter((r) => r.status !== "complete").sort((a, b) => (a.due < b.due ? -1 : 1));
  const past = mine.filter((r) => r.status === "complete");
  const goals = mine.flatMap((r) => r.goals.map((g) => ({ ...g, from: KIND_LABEL[r.kind] }))).filter((g) => g.status !== "done");

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero title="My appraisals" icon="📋" lede="Your reviews, the self-assessment you owe, and the goals you're working towards." />

      {todo.length > 0 && (
        <Card className="mt-4 border-l-4 border-l-[#1d3a8f] p-4">
          <div className="text-[13px] font-extrabold text-[var(--ink)]">Your turn — self-assessment</div>
          <div className="mt-2 space-y-2">{todo.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-[var(--panel)] p-2.5"><span className="text-[12.5px] font-bold text-[var(--ink)]">{KIND_LABEL[r.kind]}</span><span className={`text-[11.5px] ${isOverdue(r) ? "font-bold text-[#c0392b]" : "text-[var(--ink-3)]"}`}>due {fmtDate(r.due)}{isOverdue(r) ? " · overdue" : ` · in ${daysUntil(r.due)}d`}</span><Button variant="primary" className="ml-auto" onClick={() => setSelf(r)}>Fill it in →</Button></div>
          ))}</div>
        </Card>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="mb-2 text-[12px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">🎯 My goals</div>
          {goals.length === 0 ? <div className="text-[12.5px] text-[var(--ink-3)]">No open goals right now.</div> : <div className="space-y-2">{goals.map((g) => (
            <div key={g.id} className="rounded-xl border border-[var(--line)] p-2.5"><div className="flex items-center gap-2"><span className="text-[12.5px] font-bold text-[var(--ink)]">{g.title || "Untitled goal"}</span><span className="ml-auto rounded-full bg-[#eef4fd] px-2 py-0.5 text-[10px] font-bold text-[#1d3a8f]">{g.status}</span></div><div className="mt-0.5 text-[10.5px] text-[var(--ink-3)]">{g.from}{g.due ? ` · target ${fmtDate(g.due)}` : ""}</div>{typeof g.progress === "number" && <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full bg-[#1d3a8f]" style={{ width: `${g.progress}%` }} /></div>}</div>
          ))}</div>}
        </Card>

        <Card className="p-4">
          <div className="mb-2 text-[12px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">📅 Upcoming</div>
          {upcoming.length === 0 ? <div className="text-[12.5px] text-[var(--ink-3)]">Nothing scheduled.</div> : <div className="space-y-1.5">{upcoming.map((r) => (
            <div key={r.id} className="flex items-center gap-2 text-[12.5px]"><span className="font-bold text-[var(--ink)]">{KIND_LABEL[r.kind]}</span><span className="ml-auto text-[var(--ink-3)]">{fmtDate(r.due)}</span><span className="rounded-full bg-[#eef4fd] px-2 py-0.5 text-[10px] font-bold text-[#1d3a8f]">{STATUS_LABEL[r.status]}</span></div>
          ))}</div>}
        </Card>
      </div>

      <Card className="mt-4 p-4">
        <div className="mb-2 text-[12px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">✅ Past reviews</div>
        {past.length === 0 ? <div className="text-[12.5px] text-[var(--ink-3)]">No completed reviews yet.</div> : <div className="space-y-2">{past.map((r) => { const sc = overallScore(r); return (
          <div key={r.id} className="rounded-xl border border-[var(--line)] p-3"><div className="flex items-center gap-2"><span className="text-[12.5px] font-bold text-[var(--ink)]">{KIND_LABEL[r.kind]}</span><span className="text-[11px] text-[var(--ink-3)]">{fmtDate(r.due)}</span>{sc != null && <span className="ml-auto rounded-full bg-[#e6f4ea] px-2 py-0.5 text-[11px] font-extrabold text-[#0f7a43]">{sc}/5</span>}</div>{r.manager.text && <p className="mt-1.5 text-[12px] text-[var(--ink-2)]">“{r.manager.text}”</p>}</div>
        ); })}</div>}
      </Card>

      {self && <SelfAssess rev={self} onSave={(r) => { persist(reviews.map((x) => x.id === r.id ? r : x)); setSelf(null); flash("Self-assessment submitted — thanks."); }} onClose={() => setSelf(null)} />}
      {toast && <div className="fixed bottom-5 left-1/2 z-[150] max-w-[92vw] -translate-x-1/2 rounded-2xl bg-[#111634] px-4 py-2.5 text-center text-[12.5px] font-bold text-white shadow-xl">{toast}</div>}
    </div>
  );
}

function SelfAssess({ rev, onSave, onClose }: { rev: Review; onSave: (r: Review) => void; onClose: () => void }) {
  const [r, setR] = useState<Review>(rev);
  const tpl = templateFor(r.role);
  const setRating = (id: string, rating: Rating) => setR((x) => ({ ...x, self: { ...x.self, ratings: x.self.ratings.some((c) => c.id === id) ? x.self.ratings.map((c) => c.id === id ? { ...c, rating } : c) : [...x.self.ratings, { id, rating }] } }));
  return (
    <div className="fixed inset-0 z-[140] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[6vh]" onClick={onClose} style={LIGHT_PALETTE}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center gap-2"><h3 className="text-[15px] font-extrabold text-[var(--ink)]">Self-assessment</h3><span className="text-[12px] text-[var(--ink-3)]">· {KIND_LABEL[r.kind]}</span><button type="button" onClick={onClose} className="ml-auto text-[18px] text-[var(--ink-3)]">×</button></div>
        <p className="mb-3 text-[12px] text-[var(--ink-3)]">Rate yourself honestly on each area — your manager sees this alongside their own view.</p>
        <div className="space-y-1.5">{tpl.competencies.map((c) => { const cur = r.self.ratings.find((x) => x.id === c.id)?.rating; return (
          <div key={c.id} className="flex items-center gap-2"><div className="min-w-0 flex-1 text-[12.5px] font-semibold text-[var(--ink)]">{c.label}</div><div className="flex gap-1">{([1, 2, 3, 4, 5] as Rating[]).map((n) => (<button key={n} type="button" onClick={() => setRating(c.id, n)} title={RATING_LABEL[n]} className={`h-7 w-7 rounded-lg text-[12px] font-bold ${cur === n ? "bg-[#1d3a8f] text-white" : "bg-[var(--panel)] text-[var(--ink-2)] hover:bg-[#e2e8f4]"}`}>{n}</button>))}</div></div>
        ); })}</div>
        <label className="mt-3 block"><span className="mb-1 block text-[10px] font-extrabold uppercase text-[var(--ink-3)]">Anything you'd like to add</span><textarea value={r.self.text || ""} onChange={(e) => setR((x) => ({ ...x, self: { ...x.self, text: e.target.value } }))} rows={3} placeholder="Wins this year, what you'd like to develop, support you need…" className="w-full rounded-lg border border-[var(--line)] p-2 text-[12.5px]" /></label>
        <div className="mt-3 flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => onSave({ ...r, self: { ...r.self, done: true }, status: r.status === "self" || r.status === "scheduled" ? "manager" : r.status })}>Submit to manager</Button></div>
      </div>
    </div>
  );
}

export default MyAppraisalsApp;
