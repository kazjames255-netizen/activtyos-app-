"use client";

// Staff appraisals & performance — operator suite. Review cycles + two-sided
// reviews (self + manager) with data-informed signals, SMART goals, an ongoing
// feedback/supervision log, a 9-box talent grid, editable templates, and PIPs.
// Embedded as a Team tab next to Deployment. Demo store; backend owed
// (docs/appraisals-handoff.md).
import { Fragment, useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Select } from "@/components/ui";
import { LIGHT_PALETTE, PageHero } from "@/components/OperatorPage";
import {
  type Review, type ReviewTemplate, type FeedbackNote, type PIP, type Talent, type ReviewKind, type Rating, type FeedbackKind, type BoxDef, type Goal, type PIPTarget, type PIPCheckIn,
  KIND_LABEL, STATUS_LABEL, RATING_LABEL, GOAL_STATUS_LABEL, PIP_STATUS_LABEL, PIP_STATUS_TONE, FB_META, NINEBOX, overallScore, isOverdue, daysUntil, fmtDate, isoDate, bradfordTone, pipProgress,
} from "@/lib/appraisals";
import { useSettings, DEFAULT_ROLES } from "@/lib/settings";
import {
  loadReviews, saveReviews, loadTemplates, saveTemplates, loadFeedback, saveFeedback, loadPIPs, savePIPs, loadTalent, saveTalent,
  loadBoxes, saveBoxes, resetBoxes, BOX_TONES, templateFor, signalsFor, slug,
} from "./data";
import { DEMO_STAFF } from "@/features/learning/credentials";

const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "id" + Math.floor(performance.now() * 1000));
type Sub = "reviews" | "feedback" | "talent" | "templates" | "pip" | "settings";

export function AppraisalsApp({ embedded = false }: { embedded?: boolean }) {
  const [sub, setSub] = useState<Sub>("reviews");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [templates, setTemplates] = useState<ReviewTemplate[]>([]);
  const [feedback, setFeedback] = useState<FeedbackNote[]>([]);
  const [pips, setPips] = useState<PIP[]>([]);
  const [talent, setTalent] = useState<Talent[]>([]);
  const [boxes, setBoxes] = useState<Record<string, BoxDef>>(NINEBOX);
  const [op, setOp] = useState("all");
  const [edit, setEdit] = useState<Review | null>(null);
  const [newRev, setNewRev] = useState(false);
  const [fbAdd, setFbAdd] = useState(false);
  const [fbType, setFbType] = useState<"all" | FeedbackKind>("all");
  const [fbEditId, setFbEditId] = useState<string | null>(null);
  const [fbDraft, setFbDraft] = useState("");
  const [pipEdit, setPipEdit] = useState<PIP | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const { settings } = useSettings();
  const roleNames = useMemo(() => [...new Set([...(settings.roles?.length ? settings.roles : DEFAULT_ROLES).map((r) => r.name), ...DEMO_STAFF.map((s) => s.role)])], [settings.roles]);
  useEffect(() => { setReviews(loadReviews()); setTemplates(loadTemplates()); setFeedback(loadFeedback()); setPips(loadPIPs()); setTalent(loadTalent()); setBoxes(loadBoxes()); }, []);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2400); };
  const persistR = (r: Review[]) => { setReviews(r); saveReviews(r); };
  const persistF = (f: FeedbackNote[]) => { setFeedback(f); saveFeedback(f); };
  const persistP = (p: PIP[]) => { setPips(p); savePIPs(p); };
  const persistT = (t: Talent[]) => { setTalent(t); saveTalent(t); };
  const persistTpl = (t: ReviewTemplate[]) => { setTemplates(t); saveTemplates(t); };
  const persistBoxes = (b: Record<string, BoxDef>) => { setBoxes(b); saveBoxes(b); };

  const locations = useMemo(() => [...new Set(DEMO_STAFF.map((s) => s.op))].sort(), []);
  const inOp = (opv?: string) => op === "all" || opv === op;
  const visReviews = reviews.filter((r) => inOp(r.op));
  const overdue = visReviews.filter(isOverdue);
  const dueSoon = visReviews.filter((r) => !isOverdue(r) && r.status !== "complete" && daysUntil(r.due) <= 14);
  const scored = visReviews.map(overallScore).filter((n): n is number => n != null);
  const avg = scored.length ? Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 10) / 10 : null;
  const flagged = new Set(pips.filter((p) => p.status === "open").map((p) => p.staffId));

  const Body = (
    <>
      {/* tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Due ≤ 14 days", dueSoon.length, "#1d3a8f"], ["Overdue", overdue.length, "#c0392b"], ["Avg score", avg != null ? `${avg}/5` : "—", "#0f7a43"], ["On a PIP", pips.filter((p) => p.status === "open").length, "#f59e0b"]].map(([l, v, c]) => (
          <div key={l as string} className="rounded-2xl border border-[var(--line)] bg-white p-4"><div className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{l}</div><div className="mt-1 text-[22px] font-extrabold tabular-nums" style={{ color: c as string, fontFamily: "var(--ff-display)" }}>{v as string | number}</div></div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap gap-1 rounded-full bg-white p-1 shadow-sm">
          {([["reviews", "📋 Reviews"], ["feedback", "🌟 Feedback & 1:1s"], ["talent", "🎯 Talent grid"], ["templates", "🧩 Templates"], ["pip", "📈 PIPs"], ["settings", "⚙️ Settings"]] as [Sub, string][]).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setSub(k)} className={`rounded-full px-3 py-1.5 text-[12px] font-bold ${sub === k ? "bg-[#1d3a8f] text-white" : "text-[var(--ink-2)] hover:bg-[#f2f5fb]"}`}>{l}</button>
          ))}
        </div>
        <Select value={op} onChange={(e) => setOp(e.target.value)} className="ml-auto"><option value="all">All listings</option>{locations.map((l) => <option key={l} value={l}>{l}</option>)}</Select>
        {sub === "reviews" && <Button variant="primary" onClick={() => setNewRev(true)}>+ New review</Button>}
        {sub === "feedback" && <Button variant="primary" onClick={() => setFbAdd(true)}>+ Add note</Button>}
      </div>

      {/* ── REVIEWS ── */}
      {sub === "reviews" && (
        <Card className="mt-4 p-0">
          {visReviews.length === 0 ? <div className="p-8 text-center text-[13px] text-[var(--ink-3)]">No reviews yet — start one with “+ New review”.</div> : (
            <div className="overflow-x-auto"><table className="w-full text-[12.5px]"><thead><tr className="bg-[var(--panel)] text-left text-[10px] uppercase tracking-wide text-[var(--ink-3)]"><th className="px-3 py-2.5 font-extrabold">Staff</th><th className="px-3 py-2.5 font-extrabold">Review</th><th className="px-3 py-2.5 font-extrabold">Due</th><th className="px-3 py-2.5 font-extrabold">Status</th><th className="px-3 py-2.5 text-center font-extrabold">Score</th><th className="px-3 py-2.5"></th></tr></thead>
              <tbody>{[...visReviews].sort((a, b) => (a.due < b.due ? -1 : 1)).map((r) => { const sc = overallScore(r); const od = isOverdue(r); return (
                <tr key={r.id} className="border-t border-[var(--line-2,#eef2f8)]">
                  <td className="px-3 py-2.5"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--panel)] text-[10.5px] font-extrabold text-[var(--ink-2)]">{initials(r.name)}</span><div><div className="font-bold text-[var(--ink)]">{r.name}{flagged.has(r.staffId) && <span className="ml-1.5 rounded-full bg-[#fdecec] px-1.5 py-0.5 text-[9.5px] font-bold text-[#c0392b]">PIP</span>}</div><div className="text-[10.5px] text-[var(--ink-3)]">{r.role}{r.op ? ` · ${r.op}` : ""}</div></div></div></td>
                  <td className="px-3 py-2.5 text-[var(--ink-2)]">{KIND_LABEL[r.kind]}</td>
                  <td className="px-3 py-2.5"><span className={od ? "font-bold text-[#c0392b]" : "text-[var(--ink-2)]"}>{fmtDate(r.due)}{od ? " · overdue" : ""}</span></td>
                  <td className="px-3 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${r.status === "complete" ? "bg-[#e6f4ea] text-[#0f7a43]" : "bg-[#eef4fd] text-[#1d3a8f]"}`}>{STATUS_LABEL[r.status]}</span></td>
                  <td className="px-3 py-2.5 text-center font-extrabold tabular-nums text-[var(--ink)]">{sc != null ? `${sc}` : "—"}</td>
                  <td className="px-3 py-2.5 text-right"><button type="button" onClick={() => setEdit(r)} className="rounded-lg border border-[var(--line)] px-2.5 py-1 text-[11.5px] font-bold text-[#1d3a8f] hover:border-[#1d3a8f]">Open →</button></td>
                </tr>
              ); })}</tbody></table></div>
          )}
        </Card>
      )}

      {/* ── FEEDBACK ── */}
      {sub === "feedback" && (() => {
        const rows = feedback.filter((f) => inOp(DEMO_STAFF.find((s) => slug(s.name) === f.staffId)?.op) && (fbType === "all" || f.kind === fbType)).sort((a, b) => (a.at < b.at ? 1 : -1));
        return (
        <Card className="mt-4 p-0">
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] bg-[var(--panel)] px-4 py-2.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Ongoing feedback & supervision</span>
            <div className="ml-auto inline-flex gap-1">
              {([["all", "All"], ["kudos", "🌟 Kudos"], ["concern", "⚠️ Concern"], ["supervision", "🗒️ Supervision"]] as [("all" | FeedbackKind), string][]).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setFbType(k)} className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${fbType === k ? "bg-[#1d3a8f] text-white" : "bg-white text-[var(--ink-2)] ring-1 ring-black/5 hover:bg-[#f2f5fb]"}`}>{l}</button>
              ))}
            </div>
          </div>
          <div className="divide-y divide-[var(--line)]">{rows.map((f) => { const m = FB_META[f.kind]; const editing = fbEditId === f.id; return (
            <div key={f.id} className="group flex items-start gap-3 px-4 py-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[14px]" style={{ background: m.tone + "1a" }}>{m.icon}</span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="text-[12.5px] font-bold text-[var(--ink)]">{f.name}</span><span className="rounded-full px-1.5 py-0.5 text-[9.5px] font-bold" style={{ background: m.tone + "1a", color: m.tone }}>{m.label}</span><span className="ml-auto text-[10.5px] text-[var(--ink-3)]">{new Date(f.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
              {!editing && <><button type="button" onClick={() => { setFbEditId(f.id); setFbDraft(f.text); }} className="text-[11px] font-bold text-[#1d3a8f] opacity-0 hover:underline group-hover:opacity-100">Edit</button><button type="button" onClick={() => { persistF(feedback.filter((x) => x.id !== f.id)); flash("Note deleted."); }} className="text-[11px] font-bold text-[var(--ink-3)] opacity-0 hover:text-[#c0392b] group-hover:opacity-100">Delete</button></>}
            </div>
            {editing ? <div className="mt-1"><textarea value={fbDraft} onChange={(e) => setFbDraft(e.target.value)} rows={2} className="w-full rounded-lg border border-[var(--line)] p-2 text-[12px]" /><div className="mt-1 flex justify-end gap-2"><Button onClick={() => setFbEditId(null)}>Cancel</Button><Button variant="primary" onClick={() => { persistF(feedback.map((x) => x.id === f.id ? { ...x, text: fbDraft.trim() } : x)); setFbEditId(null); flash("Note updated."); }}>Save</Button></div></div>
              : <div className="mt-0.5 text-[12px] text-[var(--ink-2)]">{f.text}</div>}
            </div></div>
          ); })}</div>
          {rows.length === 0 && <div className="p-6 text-center text-[12.5px] text-[var(--ink-3)]">No notes{fbType !== "all" ? " of this type" : ""} yet.</div>}
        </Card>
        );
      })()}

      {/* ── TALENT 9-BOX ── */}
      {sub === "talent" && (
        <TalentGrid talent={talent.filter((t) => inOp(DEMO_STAFF.find((s) => slug(s.name) === t.staffId)?.op))} reviews={reviews} boxes={boxes}
          onMove={(id, perf, pot) => { persistT(talent.map((x) => x.staffId === id ? { ...x, performance: perf, potential: pot } : x)); const s = DEMO_STAFF.find((x) => slug(x.name) === id); flash(`${s?.name.split(" ")[0]} → ${boxes[`${perf}-${pot}`].label}`); }}
          onOpenReview={(id) => { const r = reviews.filter((x) => x.staffId === id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0]; if (r) setEdit(r); else flash("No review yet — start one on the Reviews tab."); }}
          onLogNote={(name, text) => { persistF([{ id: uid(), staffId: slug(name), name, kind: "supervision", text, at: new Date().toISOString(), by: "You" }, ...feedback]); flash("Note logged."); }} />
      )}

      {/* ── TEMPLATES ── */}
      {sub === "templates" && (
        <>
        <div className="mt-4 mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-[#eef4fd] px-3 py-2 text-[12px] text-[#1d3a8f]">
          <span>📌 The competency set a review uses is chosen by the staff member&rsquo;s <b>role</b> — so different roles get different appraisals.</span>
          <Button variant="primary" className="ml-auto" onClick={() => persistTpl([...templates, { id: uid(), name: "New appraisal", role: roleNames.find((rn) => !templates.some((t) => t.role === rn)) || "", competencies: [{ id: uid(), label: "New competency" }] }])}>+ New template</Button>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">{templates.map((tpl) => (
          <Card key={tpl.id} className="p-4">
            <div className="mb-2 flex items-center gap-2"><Input value={tpl.name} onChange={(e) => persistTpl(templates.map((t) => t.id === tpl.id ? { ...t, name: e.target.value } : t))} className="flex-1 font-bold" /><Select value={tpl.role || ""} onChange={(e) => persistTpl(templates.map((t) => t.id === tpl.id ? { ...t, role: e.target.value || undefined } : t))} className="w-40 text-[12px]" title="Which role uses this template"><option value="">Any role</option>{roleNames.map((rn) => <option key={rn} value={rn}>{rn}</option>)}</Select><button type="button" onClick={() => persistTpl(templates.filter((t) => t.id !== tpl.id))} className="px-1 text-[15px] text-[var(--ink-3)] hover:text-[#c0392b]" title="Delete template">×</button></div>
            <div className="space-y-1.5">{tpl.competencies.map((c) => (
              <div key={c.id} className="flex items-center gap-2"><Input value={c.label} onChange={(e) => persistTpl(templates.map((t) => t.id === tpl.id ? { ...t, competencies: t.competencies.map((x) => x.id === c.id ? { ...x, label: e.target.value } : x) } : t))} className="flex-1 text-[12.5px]" /><button type="button" onClick={() => persistTpl(templates.map((t) => t.id === tpl.id ? { ...t, competencies: t.competencies.filter((x) => x.id !== c.id) } : t))} className="px-1 text-[15px] text-[var(--ink-3)] hover:text-[#c0392b]">×</button></div>
            ))}</div>
            <button type="button" onClick={() => persistTpl(templates.map((t) => t.id === tpl.id ? { ...t, competencies: [...t.competencies, { id: uid(), label: "New competency" }] } : t))} className="mt-2 text-[12px] font-bold text-[#1d3a8f] hover:underline">+ Add competency</button>
          </Card>
        ))}</div>
        </>
      )}

      {/* ── PIP ── */}
      {sub === "pip" && (
        <Card className="mt-4 p-4">
          <div className="mb-3 flex items-center gap-2"><div><div className="text-[13px] font-extrabold text-[var(--ink)]">Performance improvement plans</div><div className="text-[11px] text-[var(--ink-3)]">Structured, time-bound plans with measurable targets, support and dated check-ins.</div></div><Button variant="primary" className="ml-auto" onClick={() => setPipEdit({ id: uid(), staffId: "", name: "", concern: "", support: "", consequence: "If targets aren't met by the review date, the plan may be extended once or escalated to a formal capability process.", owner: "", targets: [], checkIns: [], start: isoDate(new Date()), end: isoDate(new Date(Date.now() + 30 * 86400000)), status: "open" })}>+ New PIP</Button></div>
          {pips.length === 0 ? <div className="py-6 text-center text-[12.5px] text-[var(--ink-3)]">No PIPs — hopefully none needed. A PIP is a fair, documented way to turn performance around.</div> : <div className="space-y-2.5">{pips.filter((p) => inOp(DEMO_STAFF.find((s) => slug(s.name) === p.staffId)?.op) || !p.staffId).map((p) => { const pct = pipProgress(p); const left = daysUntil(p.end); return (
            <button key={p.id} type="button" onClick={() => setPipEdit(p)} className="block w-full rounded-xl border border-[var(--line)] p-3 text-left hover:border-[#1d3a8f]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--panel)] text-[10.5px] font-extrabold text-[var(--ink-2)]">{p.name ? initials(p.name) : "—"}</span>
                <div><div className="text-[13px] font-bold text-[var(--ink)]">{p.name || "Unassigned"}</div><div className="text-[10.5px] text-[var(--ink-3)]">{p.role || "—"}{p.op ? ` · ${p.op}` : ""}</div></div>
                <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: PIP_STATUS_TONE[p.status] + "1a", color: PIP_STATUS_TONE[p.status] }}>{PIP_STATUS_LABEL[p.status]}</span>
                <span className="ml-auto text-[11px] text-[var(--ink-3)]">{fmtDate(p.start)} → {fmtDate(p.end)}{p.status === "open" ? ` · ${left < 0 ? `${-left}d overdue` : `${left}d left`}` : ""}</span>
              </div>
              {p.concern && <div className="mt-1.5 truncate text-[12px] text-[var(--ink-2)]">{p.concern}</div>}
              <div className="mt-2 flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: PIP_STATUS_TONE[p.status] }} /></div><span className="text-[10.5px] font-bold tabular-nums text-[var(--ink-3)]">{p.targets.filter((t) => t.met).length}/{p.targets.length} targets</span></div>
            </button>
          ); })}</div>}
        </Card>
      )}

      {sub === "settings" && (
        <Card className="mt-4 p-4">
          <div className="mb-2 text-[14px] font-extrabold text-[var(--ink)]">How appraisals work here</div>
          <ul className="space-y-2 text-[12.5px] leading-relaxed text-[var(--ink-2)]">
            <li>• <b>Reviews</b> run on cycles — probation, 3-month, 6-month, annual, plus supervision 1:1s. Each is <b>two-sided</b>: the staff member self-assesses, then you review.</li>
            <li>• Competencies are rated <b>1–5</b> ({Object.entries(RATING_LABEL).map(([n, l]) => `${n} ${l}`).join(" · ")}). Build the list per role in <b>Templates</b>.</li>
            <li>• Each review pulls <b>real signals</b> — lateness (clock-in), sickness &amp; Bradford factor (Leave &amp; absence), and DBS / first-aid — so it&rsquo;s evidence-based.</li>
            <li>• Log <b>kudos, concerns and supervision notes</b> any time so nothing is invented on the day; place people on the <b>9-box grid</b>; and open a <b>PIP</b> when needed.</li>
            <li className="text-[var(--ink-3)]">Demo matches people by name. Real per-user store, e-signatures and reminders are the backend piece.</li>
          </ul>
        </Card>
      )}

      {sub === "settings" && (
        <Card className="mt-4 p-4">
          <div className="mb-1 flex items-center gap-2"><div className="text-[14px] font-extrabold text-[var(--ink)]">Talent-grid categories</div><button type="button" onClick={() => { resetBoxes(); setBoxes(loadBoxes()); flash("Categories reset to default."); }} className="ml-auto text-[11.5px] font-bold text-[var(--ink-3)] hover:text-[#c0392b]">Reset to default</button></div>
          <div className="mb-3 text-[11.5px] text-[var(--ink-3)]">Rename each box, reword its recommended action, and pick a colour. These are what appear on the 9-box grid.</div>
          <div className="grid gap-2 sm:grid-cols-3">
            {([3, 2, 1] as const).flatMap((pot) => ([1, 2, 3] as const).map((perf) => { const key = `${perf}-${pot}`; const b = boxes[key]; return (
              <div key={key} className="rounded-xl border p-2.5" style={{ borderColor: b.tone + "55", background: b.tone + "0d" }}>
                <div className="mb-1 text-[9px] font-bold uppercase text-[var(--ink-3)]">P{perf} · Pot{pot}</div>
                <Input value={b.label} onChange={(e) => persistBoxes({ ...boxes, [key]: { ...b, label: e.target.value } })} className="mb-1.5 text-[12px] font-bold" />
                <textarea value={b.action} onChange={(e) => persistBoxes({ ...boxes, [key]: { ...b, action: e.target.value } })} rows={2} className="w-full rounded-lg border border-[var(--line)] p-1.5 text-[11px]" />
                <div className="mt-1.5 flex gap-1">{BOX_TONES.map((t) => <button key={t} type="button" onClick={() => persistBoxes({ ...boxes, [key]: { ...b, tone: t } })} className={`h-5 w-5 rounded-full ${b.tone === t ? "ring-2 ring-offset-1 ring-[var(--ink-2)]" : ""}`} style={{ background: t }} title={t} />)}</div>
              </div>
            ); }))}
          </div>
        </Card>
      )}
    </>
  );

  const modals = (
    <>
      {edit && <ReviewEditor rev={edit} onSave={(r) => { persistR(reviews.map((x) => x.id === r.id ? r : x)); setEdit(null); flash("Review saved."); }} onClose={() => setEdit(null)} />}
      {newRev && <NewReview onCreate={(r) => { persistR([r, ...reviews]); setNewRev(false); setEdit(r); }} onClose={() => setNewRev(false)} />}
      {fbAdd && <AddFeedback onAdd={(f) => { persistF([f, ...feedback]); setFbAdd(false); flash("Note logged."); }} onClose={() => setFbAdd(false)} />}
      {pipEdit && <PIPEditor pip={pipEdit} reviews={reviews}
        onSave={(p) => { persistP(pips.some((x) => x.id === p.id) ? pips.map((x) => x.id === p.id ? p : x) : [p, ...pips]); setPipEdit(null); flash("PIP saved."); }}
        onDelete={() => { persistP(pips.filter((x) => x.id !== pipEdit.id)); setPipEdit(null); flash("PIP removed."); }}
        onClose={() => setPipEdit(null)} />}
      {toast && <div className="fixed bottom-5 left-1/2 z-[150] max-w-[92vw] -translate-x-1/2 rounded-2xl bg-[#111634] px-4 py-2.5 text-center text-[12.5px] font-bold text-white shadow-xl">{toast}</div>}
    </>
  );

  if (embedded) return <div>{Body}{modals}</div>;
  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero title="Appraisals & performance" icon="📋" lede="Review cycles, two-sided appraisals with real lateness/absence/training signals, goals, a feedback log, a 9-box talent grid and PIPs — all in one place." />
      {Body}{modals}
    </div>
  );
}

// ── Talent 9-box ─────────────────────────────────────────────────────────────
const suggestPerf = (score: number | null): 1 | 2 | 3 | null => (score == null ? null : score >= 4 ? 3 : score >= 2.5 ? 2 : 1);
const LMH = { 1: "Low", 2: "Med", 3: "High" } as const;

function TalentGrid({ talent, reviews, boxes, onMove, onOpenReview, onLogNote }: {
  talent: Talent[]; reviews: Review[]; boxes: Record<string, BoxDef>;
  onMove: (id: string, perf: 1 | 2 | 3, pot: 1 | 2 | 3) => void;
  onOpenReview: (id: string) => void; onLogNote: (name: string, text: string) => void;
}) {
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [place, setPlace] = useState<string | null>(null);
  const scoreFor = (id: string) => { const r = reviews.filter((x) => x.staffId === id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0]; return r ? overallScore(r) : null; };
  const staffOf = (id: string) => DEMO_STAFF.find((s) => slug(s.name) === id);
  const POT_LABEL = { 3: "High", 2: "Medium", 1: "Low" } as const;
  const PERF_LABEL = { 1: "Low", 2: "Medium", 3: "High" } as const;
  return (
    <Card className="mt-4 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[12px] text-[var(--ink-3)]">
        <span>Nine-box — <b>performance</b> → against <b>potential</b> ↑. <b>Drag</b> a card to move, or <b>click</b> it to place, add a note or open the review.</span>
        <span className="ml-auto rounded-full bg-[var(--panel)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--ink-2)]">⚑ review score suggests another box</span>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[620px]">
          <div className="grid gap-2" style={{ gridTemplateColumns: "64px repeat(3, minmax(0,1fr))" }}>
            {([3, 2, 1] as const).map((pot, ri) => (
              <Fragment key={pot}>
                <div className="flex flex-col items-end justify-center pr-1 text-right">
                  {ri === 0 && <div className="mb-1 text-[9px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Potential ↑</div>}
                  <div className="text-[11px] font-extrabold text-[var(--ink-2)]">{POT_LABEL[pot]}</div>
                </div>
                {([1, 2, 3] as const).map((perf) => {
                  const key = `${perf}-${pot}`; const cell = boxes[key];
                  const here = talent.filter((t) => t.performance === perf && t.potential === pot);
                  const isOver = over === key;
                  return (
                    <div key={key}
                      onDragOver={(e) => { e.preventDefault(); setOver(key); }} onDragLeave={() => setOver((o) => (o === key ? null : o))}
                      onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/id") || drag; if (id) onMove(id, perf, pot); setDrag(null); setOver(null); }}
                      className={`min-h-[104px] rounded-xl border p-2 transition-colors ${here.length === 0 ? "opacity-70" : ""}`}
                      style={{ borderColor: isOver ? cell.tone : cell.tone + "55", background: isOver ? cell.tone + "24" : cell.tone + "0f", borderWidth: isOver ? 2 : 1 }}>
                      <div className="mb-1 flex items-center gap-1">
                        <span className="text-[9.5px] font-extrabold uppercase" style={{ color: cell.tone }}>{cell.label}</span>
                        {here.length > 0 && <span className="rounded-full bg-white px-1.5 text-[9px] font-bold text-[var(--ink-2)] ring-1 ring-black/5">{here.length}</span>}
                      </div>
                      <div className="mb-1.5 text-[9px] leading-tight text-[var(--ink-3)]">{cell.action}</div>
                      <div className="space-y-1">{here.map((t) => {
                        const s = staffOf(t.staffId); if (!s) return null;
                        const sc = scoreFor(t.staffId); const sug = suggestPerf(sc); const mismatch = sug != null && sug !== t.performance;
                        return (
                          <button key={t.staffId} type="button" draggable
                            onDragStart={(e) => { setDrag(t.staffId); e.dataTransfer.setData("text/id", t.staffId); e.dataTransfer.effectAllowed = "move"; }}
                            onDragEnd={() => { setDrag(null); setOver(null); }}
                            onClick={() => setPlace(t.staffId)}
                            className="flex w-full cursor-grab items-center gap-1.5 rounded-lg bg-white p-1.5 text-left shadow-sm ring-1 ring-black/5 hover:ring-[color:var(--ink-3)] active:cursor-grabbing">
                            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--panel)] text-[9px] font-extrabold text-[var(--ink-2)]">{s.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("")}</span>
                            <span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-bold text-[var(--ink)]">{s.name}</span><span className="block truncate text-[9px] text-[var(--ink-3)]">{s.role}{mismatch ? ` · ⚑ ${boxes[`${sug}-${pot}`].label}` : ""}</span></span>
                            {sc != null && <span className="shrink-0 rounded-full bg-[#eef4fd] px-1.5 py-0.5 text-[9.5px] font-extrabold text-[#1d3a8f]">{sc}</span>}
                          </button>
                        );
                      })}</div>
                    </div>
                  );
                })}
              </Fragment>
            ))}
            <div />
            {([1, 2, 3] as const).map((perf) => <div key={perf} className="pt-0.5 text-center text-[11px] font-extrabold text-[var(--ink-2)]">{PERF_LABEL[perf]}</div>)}
          </div>
          <div className="mt-0.5 text-center text-[9px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Performance →</div>
        </div>
      </div>
      {place && (() => { const s = staffOf(place); if (!s) return null; const t = talent.find((x) => x.staffId === place); const sc = scoreFor(place); const sug = suggestPerf(sc);
        return <PlacePopover name={s.name} role={s.role} perf={t?.performance ?? 2} pot={t?.potential ?? 2} score={sc} suggest={sug} boxes={boxes}
          onMove={(perf, pot) => onMove(place, perf, pot)} onOpenReview={() => { onOpenReview(place); setPlace(null); }} onLogNote={(txt) => onLogNote(s.name, txt)} onClose={() => setPlace(null)} />;
      })()}
    </Card>
  );
}

function PlacePopover({ name, role, perf, pot, score, suggest, boxes, onMove, onOpenReview, onLogNote, onClose }: {
  name: string; role: string; perf: 1 | 2 | 3; pot: 1 | 2 | 3; score: number | null; suggest: 1 | 2 | 3 | null; boxes: Record<string, BoxDef>;
  onMove: (perf: 1 | 2 | 3, pot: 1 | 2 | 3) => void; onOpenReview: () => void; onLogNote: (text: string) => void; onClose: () => void;
}) {
  const [p, setP] = useState<1 | 2 | 3>(perf); const [q, setQ] = useState<1 | 2 | 3>(pot); const [note, setNote] = useState("");
  const cell = boxes[`${p}-${q}`];
  const Row = ({ label, val, set, hint }: { label: string; val: 1 | 2 | 3; set: (n: 1 | 2 | 3) => void; hint?: 1 | 2 | 3 | null }) => (
    <div className="flex items-center gap-2"><span className="w-20 text-[11px] font-extrabold uppercase text-[var(--ink-3)]">{label}</span><div className="flex gap-1">{([1, 2, 3] as const).map((n) => <button key={n} type="button" onClick={() => set(n)} className={`h-8 w-14 rounded-lg text-[11px] font-bold ${val === n ? "bg-[#1d3a8f] text-white" : "bg-[var(--panel)] text-[var(--ink-2)] hover:bg-[#e2e8f4]"}`}>{LMH[n]}{hint === n && val !== n ? " ⚑" : ""}</button>)}</div></div>
  );
  return (
    <div className="fixed inset-0 z-[145] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[14vh]" onClick={onClose} style={LIGHT_PALETTE}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center gap-2"><h3 className="text-[14px] font-extrabold text-[var(--ink)]">{name}</h3><span className="text-[11px] text-[var(--ink-3)]">{role}</span>{score != null && <span className="ml-auto rounded-full bg-[#eef4fd] px-2 py-0.5 text-[10.5px] font-extrabold text-[#1d3a8f]">Review {score}/5</span>}<button type="button" onClick={onClose} className="text-[17px] text-[var(--ink-3)]">×</button></div>
        <div className="space-y-2"><Row label="Performance" val={p} set={setP} hint={suggest} /><Row label="Potential" val={q} set={setQ} /></div>
        <div className="mt-2 rounded-lg p-2 text-[11px] font-semibold" style={{ background: cell.tone + "14", color: cell.tone }}>{cell.label} — <span className="font-normal text-[var(--ink-2)]">{cell.action}</span>{suggest != null && suggest !== p && <div className="mt-0.5 text-[10px] font-normal text-[var(--ink-3)]">⚑ Their latest review score suggests {({ 1: "Low", 2: "Medium", 3: "High" } as const)[suggest]} performance.</div>}</div>
        <label className="mt-2 block"><span className="mb-1 block text-[10px] font-extrabold uppercase text-[var(--ink-3)]">Add a note (optional)</span><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Why this placement…" className="w-full rounded-lg border border-[var(--line)] p-2 text-[12px]" /></label>
        <div className="mt-3 flex items-center gap-2">
          <button type="button" onClick={onOpenReview} className="text-[12px] font-bold text-[#1d3a8f] hover:underline">Open review →</button>
          <div className="ml-auto flex gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={() => { onMove(p, q); if (note.trim()) onLogNote(note.trim()); onClose(); }}>Save</Button></div>
        </div>
      </div>
    </div>
  );
}

// ── PIP editor ───────────────────────────────────────────────────────────────
function PIPEditor({ pip, reviews, onSave, onDelete, onClose }: { pip: PIP; reviews: Review[]; onSave: (p: PIP) => void; onDelete: () => void; onClose: () => void }) {
  const [p, setP] = useState<PIP>(pip);
  const set = (patch: Partial<PIP>) => setP((x) => ({ ...x, ...patch }));
  const setTarget = (id: string, patch: Partial<PIPTarget>) => set({ targets: p.targets.map((t) => t.id === id ? { ...t, ...patch } : t) });
  const staffReviews = reviews.filter((r) => r.staffId === p.staffId);
  const pct = pipProgress(p);
  const setDuration = (days: number) => { const s = new Date(`${p.start}T00:00:00`); s.setDate(s.getDate() + days); set({ end: isoDate(s) }); };
  const [chk, setChk] = useState("");
  return (
    <div className="fixed inset-0 z-[145] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[5vh]" onClick={onClose} style={LIGHT_PALETTE}>
      <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2"><h3 className="text-[16px] font-extrabold text-[var(--ink)]">Performance improvement plan</h3><span className="ml-auto rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: PIP_STATUS_TONE[p.status] + "1a", color: PIP_STATUS_TONE[p.status] }}>{PIP_STATUS_LABEL[p.status]} · {pct}%</span><button type="button" onClick={onClose} className="text-[18px] text-[var(--ink-3)]">×</button></div>

        {/* who + dates + status */}
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block"><span className="mb-1 block text-[10px] font-extrabold uppercase text-[var(--ink-3)]">Employee</span><Select value={p.staffId} onChange={(e) => { const s = DEMO_STAFF.find((x) => slug(x.name) === e.target.value); set({ staffId: e.target.value, name: s?.name || "", role: s?.role, op: s?.op }); }} className="w-full"><option value="">Choose staff…</option>{DEMO_STAFF.map((s) => <option key={s.name} value={slug(s.name)}>{s.name} · {s.role}</option>)}</Select></label>
          <label className="block"><span className="mb-1 block text-[10px] font-extrabold uppercase text-[var(--ink-3)]">Plan owner</span><Input value={p.owner || ""} onChange={(e) => set({ owner: e.target.value })} placeholder="e.g. Site lead" className="w-full" /></label>
          <label className="block"><span className="mb-1 block text-[10px] font-extrabold uppercase text-[var(--ink-3)]">Start</span><Input type="date" value={p.start} onChange={(e) => set({ start: e.target.value })} className="w-full" /></label>
          <label className="block"><span className="mb-1 block text-[10px] font-extrabold uppercase text-[var(--ink-3)]">Review by</span><Input type="date" value={p.end} onChange={(e) => set({ end: e.target.value })} className="w-full" /></label>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5"><span className="text-[10px] font-extrabold uppercase text-[var(--ink-3)]">Duration</span>{[30, 60, 90].map((d) => <button key={d} type="button" onClick={() => setDuration(d)} className="rounded-full bg-[var(--panel)] px-2.5 py-1 text-[11px] font-bold text-[var(--ink-2)] hover:bg-[#e2e8f4]">{d} days</button>)}</div>

        {/* concern */}
        <label className="mt-3 block"><span className="mb-1 block text-[10px] font-extrabold uppercase text-[var(--ink-3)]">Concern — why the plan is needed</span><textarea value={p.concern} onChange={(e) => set({ concern: e.target.value })} rows={2} className="w-full rounded-lg border border-[var(--line)] p-2 text-[12.5px]" /></label>

        {/* targets */}
        <div className="mt-3 flex items-center gap-2"><span className="text-[11px] font-extrabold uppercase text-[var(--ink-3)]">🎯 Targets to meet</span><span className="text-[10.5px] text-[var(--ink-3)]">{p.targets.filter((t) => t.met).length}/{p.targets.length} met</span><button type="button" onClick={() => set({ targets: [...p.targets, { id: uid(), text: "", measure: "", met: false }] })} className="ml-auto text-[11.5px] font-bold text-[#1d3a8f] hover:underline">+ Add target</button></div>
        <div className="mt-1 space-y-1.5">{p.targets.map((t) => (
          <div key={t.id} className="flex items-start gap-2 rounded-lg border border-[var(--line)] p-2">
            <button type="button" onClick={() => setTarget(t.id, { met: !t.met })} className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md text-[11px] font-bold ${t.met ? "bg-[#0f7a43] text-white" : "bg-[var(--panel)] text-transparent hover:text-[var(--ink-3)]"}`}>✓</button>
            <div className="flex-1 space-y-1"><Input value={t.text} onChange={(e) => setTarget(t.id, { text: e.target.value })} placeholder="Target — what must improve" className="w-full text-[12.5px] font-semibold" /><Input value={t.measure || ""} onChange={(e) => setTarget(t.id, { measure: e.target.value })} placeholder="How it's measured / evidence" className="w-full text-[11.5px]" /></div>
            <button type="button" onClick={() => set({ targets: p.targets.filter((x) => x.id !== t.id) })} className="px-1 text-[15px] text-[var(--ink-3)] hover:text-[#c0392b]">×</button>
          </div>
        ))}{p.targets.length === 0 && <div className="text-[11.5px] text-[var(--ink-3)]">Add clear, measurable targets.</div>}</div>

        {/* support + consequence */}
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="block"><span className="mb-1 block text-[10px] font-extrabold uppercase text-[var(--ink-3)]">Support & resources offered</span><textarea value={p.support} onChange={(e) => set({ support: e.target.value })} rows={2} className="w-full rounded-lg border border-[var(--line)] p-2 text-[12px]" /></label>
          <label className="block"><span className="mb-1 block text-[10px] font-extrabold uppercase text-[var(--ink-3)]">If targets aren't met</span><textarea value={p.consequence || ""} onChange={(e) => set({ consequence: e.target.value })} rows={2} className="w-full rounded-lg border border-[var(--line)] p-2 text-[12px]" /></label>
        </div>

        {/* check-in log */}
        <div className="mt-3 text-[11px] font-extrabold uppercase text-[var(--ink-3)]">🗓️ Check-ins</div>
        <div className="mt-1 space-y-1">{[...p.checkIns].sort((a, b) => (a.date < b.date ? 1 : -1)).map((c) => (
          <div key={c.id} className="flex items-start gap-2 rounded-lg bg-[var(--panel)] p-2 text-[12px]"><span className="shrink-0 font-bold text-[var(--ink-2)]">{fmtDate(c.date)}</span><span className="flex-1 text-[var(--ink-2)]">{c.note}</span><button type="button" onClick={() => set({ checkIns: p.checkIns.filter((x) => x.id !== c.id) })} className="text-[13px] text-[var(--ink-3)] hover:text-[#c0392b]">×</button></div>
        ))}</div>
        <div className="mt-1 flex gap-2"><Input value={chk} onChange={(e) => setChk(e.target.value)} placeholder="Log a check-in note…" className="flex-1 text-[12px]" /><Button onClick={() => { if (chk.trim()) { set({ checkIns: [...p.checkIns, { id: uid(), date: isoDate(new Date()), note: chk.trim() }] }); setChk(""); } }}>Add</Button></div>

        {/* link to review + status + actions */}
        <div className="mt-4 grid gap-2 border-t border-[var(--line)] pt-3 sm:grid-cols-2">
          <label className="block"><span className="mb-1 block text-[10px] font-extrabold uppercase text-[var(--ink-3)]">Linked review</span><Select value={p.reviewId || ""} onChange={(e) => set({ reviewId: e.target.value || undefined })} className="w-full text-[12px]"><option value="">— none —</option>{staffReviews.map((r) => <option key={r.id} value={r.id}>{KIND_LABEL[r.kind]} · {fmtDate(r.due)}</option>)}</Select></label>
          <label className="block"><span className="mb-1 block text-[10px] font-extrabold uppercase text-[var(--ink-3)]">Outcome / status</span><Select value={p.status} onChange={(e) => set({ status: e.target.value as PIP["status"] })} className="w-full text-[12px]">{(Object.keys(PIP_STATUS_LABEL) as PIP["status"][]).map((s) => <option key={s} value={s}>{PIP_STATUS_LABEL[s]}</option>)}</Select></label>
        </div>
        <div className="mt-3 flex items-center gap-2"><button type="button" onClick={onDelete} className="text-[12px] font-bold text-[var(--ink-3)] hover:text-[#c0392b]">Delete plan</button><div className="ml-auto flex gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!p.staffId} onClick={() => onSave(p)}>Save PIP</Button></div></div>
      </div>
    </div>
  );
}

// ── Review editor ───────────────────────────────────────────────────────────
function ReviewEditor({ rev, onSave, onClose }: { rev: Review; onSave: (r: Review) => void; onClose: () => void }) {
  const [r, setR] = useState<Review>(rev);
  const tpl = templateFor(r.role);
  const sig = signalsFor(r.name);
  const set = (patch: Partial<Review>) => setR((x) => ({ ...x, ...patch }));
  const setMgrRating = (id: string, rating: Rating) => set({ manager: { ...r.manager, ratings: r.manager.ratings.map((c) => c.id === id ? { ...c, rating } : c) } });
  const overall = overallScore(r);
  const addGoal = () => set({ goals: [...r.goals, { id: uid(), title: "", status: "open" }] });
  const setGoal = (id: string, patch: Partial<Review["goals"][number]>) => set({ goals: r.goals.map((g) => g.id === id ? { ...g, ...patch } : g) });
  return (
    <div className="fixed inset-0 z-[140] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[5vh]" onClick={onClose} style={LIGHT_PALETTE}>
      <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center gap-2"><h3 className="text-[16px] font-extrabold text-[var(--ink)]">{r.name}</h3><span className="text-[12.5px] text-[var(--ink-3)]">· {KIND_LABEL[r.kind]} · due {fmtDate(r.due)}</span><span className="ml-auto rounded-full bg-[#eef4fd] px-2 py-0.5 text-[10.5px] font-bold text-[#1d3a8f]">{STATUS_LABEL[r.status]}</span><button type="button" onClick={onClose} className="ml-1 text-[18px] text-[var(--ink-3)]">×</button></div>

        {/* data-informed signals */}
        <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl bg-[var(--panel)] p-2.5 sm:grid-cols-4">
          {[["Late clock-ins", sig.late ? "⚠ recent" : "None", sig.late ? "#c0392b" : "#0f7a43"], ["Sickness", `${sig.sicknessDays}d · ${sig.sicknessSpells} spell${sig.sicknessSpells === 1 ? "" : "s"}`, "#4a4763"], ["Bradford", String(sig.bradford), bradfordTone(sig.bradford)], ["DBS · First aid", `${sig.dbs} · ${sig.pfa}`, "#4a4763"]].map(([l, v, c]) => (
            <div key={l as string}><div className="text-[9.5px] font-bold uppercase text-[var(--ink-3)]">{l}</div><div className="text-[12px] font-extrabold" style={{ color: c as string }}>{v as string}</div></div>
          ))}
        </div>
        <div className="mb-3 text-[10px] text-[var(--ink-3)]">↑ Pulled live from Clock-in, Leave &amp; absence and staff credentials — evidence for the conversation.</div>

        {/* self-assessment */}
        {r.self.done && <div className="mb-3 rounded-xl border border-[var(--line)] p-3"><div className="mb-1 text-[11px] font-extrabold uppercase text-[var(--ink-3)]">🧑 Self-assessment</div>{r.self.text && <p className="mb-1.5 text-[12.5px] italic text-[var(--ink-2)]">“{r.self.text}”</p>}<div className="flex flex-wrap gap-1.5">{tpl.competencies.map((c) => { const s = r.self.ratings.find((x) => x.id === c.id)?.rating; return <span key={c.id} className="rounded-full bg-[var(--panel)] px-2 py-0.5 text-[10.5px] font-semibold text-[var(--ink-2)]">{c.label.split(" ")[0]}: {s ? `${s}` : "—"}</span>; })}</div></div>}

        {/* manager ratings */}
        <div className="mb-1 flex items-center gap-2"><div className="text-[11px] font-extrabold uppercase text-[var(--ink-3)]">👤 Manager review</div>{overall != null && <span className="ml-auto rounded-full bg-[#e6f4ea] px-2 py-0.5 text-[11px] font-extrabold text-[#0f7a43]">Overall {overall}/5</span>}</div>
        <div className="space-y-1.5">{tpl.competencies.map((c) => { const cur = r.manager.ratings.find((x) => x.id === c.id)?.rating; return (
          <div key={c.id} className="flex items-center gap-2"><div className="min-w-0 flex-1"><div className="truncate text-[12.5px] font-semibold text-[var(--ink)]">{c.label}</div>{c.desc && <div className="truncate text-[10.5px] text-[var(--ink-3)]">{c.desc}</div>}</div><div className="flex gap-1">{([1, 2, 3, 4, 5] as Rating[]).map((n) => (<button key={n} type="button" onClick={() => setMgrRating(c.id, n)} title={RATING_LABEL[n]} className={`h-7 w-7 rounded-lg text-[12px] font-bold ${cur === n ? "bg-[#1d3a8f] text-white" : "bg-[var(--panel)] text-[var(--ink-2)] hover:bg-[#e2e8f4]"}`}>{n}</button>))}</div></div>
        ); })}</div>
        <label className="mt-2 block"><span className="mb-1 block text-[10px] font-extrabold uppercase text-[var(--ink-3)]">Manager summary</span><textarea value={r.manager.text || ""} onChange={(e) => set({ manager: { ...r.manager, text: e.target.value } })} rows={2} placeholder="Strengths, areas to develop, overall comment…" className="w-full rounded-lg border border-[var(--line)] p-2 text-[12.5px]" /></label>

        {/* goals */}
        <div className="mt-3 flex items-center gap-2"><div className="text-[11px] font-extrabold uppercase text-[var(--ink-3)]">🎯 Goals & objectives</div><button type="button" onClick={addGoal} className="ml-auto text-[11.5px] font-bold text-[#1d3a8f] hover:underline">+ Add goal</button></div>
        <div className="mt-1 space-y-2">{r.goals.map((g) => { const pct = g.status === "done" ? 100 : (g.progress ?? 0); return (
          <div key={g.id} className="rounded-xl border border-[var(--line)] p-2.5">
            <div className="flex items-center gap-2"><Input value={g.title} onChange={(e) => setGoal(g.id, { title: e.target.value })} placeholder="SMART objective — e.g. Mentor two new coaches by term end" className="flex-1 text-[12.5px] font-semibold" /><Select value={g.status} onChange={(e) => setGoal(g.id, { status: e.target.value as Goal["status"] })} className="w-32 text-[12px]">{(Object.keys(GOAL_STATUS_LABEL) as Goal["status"][]).map((s) => <option key={s} value={s}>{GOAL_STATUS_LABEL[s]}</option>)}</Select><button type="button" onClick={() => set({ goals: r.goals.filter((x) => x.id !== g.id) })} className="px-1 text-[15px] text-[var(--ink-3)] hover:text-[#c0392b]">×</button></div>
            <textarea value={g.detail || ""} onChange={(e) => setGoal(g.id, { detail: e.target.value })} rows={2} placeholder="What good looks like, how it'll be measured, support needed…" className="mt-1.5 w-full rounded-lg border border-[var(--line)] p-2 text-[12px]" />
            <div className="mt-1.5 flex flex-wrap items-center gap-3">
              <div className="flex min-w-[160px] flex-1 items-center gap-2"><span className="text-[10px] font-extrabold uppercase text-[var(--ink-3)]">Progress</span><input type="range" min={0} max={100} step={5} value={pct} disabled={g.status === "done"} onChange={(e) => setGoal(g.id, { progress: Number(e.target.value) })} className="flex-1 accent-[#1d3a8f]" /><span className="w-9 text-right text-[11px] font-bold tabular-nums text-[var(--ink-2)]">{pct}%</span></div>
              <label className="flex items-center gap-1 text-[10px] font-extrabold uppercase text-[var(--ink-3)]">Links to<Select value={g.compId || ""} onChange={(e) => setGoal(g.id, { compId: e.target.value || undefined })} className="text-[11px] font-normal normal-case"><option value="">— competency —</option>{tpl.competencies.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select></label>
              <label className="flex items-center gap-1 text-[10px] font-extrabold uppercase text-[var(--ink-3)]">Target<Input type="date" value={g.due || ""} onChange={(e) => setGoal(g.id, { due: e.target.value })} className="w-36 text-[11px]" /></label>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full bg-[#1d3a8f] transition-[width]" style={{ width: `${pct}%` }} /></div>
          </div>
        ); })}{r.goals.length === 0 && <div className="text-[11.5px] text-[var(--ink-3)]">No goals set yet — add SMART objectives to work on before the next review.</div>}</div>

        {/* probation outcome */}
        {r.kind === "probation" && <label className="mt-3 block"><span className="mb-1 block text-[10px] font-extrabold uppercase text-[var(--ink-3)]">Probation outcome</span><Select value={r.probationOutcome || ""} onChange={(e) => set({ probationOutcome: (e.target.value || undefined) as Review["probationOutcome"] })} className="w-full"><option value="">Not decided</option><option value="pass">✓ Pass — confirm in post</option><option value="extend">Extend probation</option><option value="fail">Do not confirm</option></Select></label>}

        {/* sign-off */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-3">
          <span className="text-[11px] text-[var(--ink-3)]">{r.signoff.managerAt ? `✓ Manager signed ${fmtDate(r.signoff.managerAt)}` : "Not signed"}{r.signoff.staffAt ? ` · Staff acknowledged ${fmtDate(r.signoff.staffAt)}` : ""}</span>
          <div className="ml-auto flex gap-2">
            <Button onClick={onClose}>Cancel</Button>
            <Button onClick={() => onSave({ ...r, status: "self", self: { ...r.self, done: false } })}>Save draft</Button>
            <Button variant="primary" onClick={() => onSave({ ...r, status: "complete", signoff: { managerAt: isoDate(new Date()), staffAt: r.signoff.staffAt || isoDate(new Date()) } })}>Sign off & complete</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NewReview({ onCreate, onClose }: { onCreate: (r: Review) => void; onClose: () => void }) {
  const [name, setName] = useState(""); const [kind, setKind] = useState<ReviewKind>("annual"); const [due, setDue] = useState(isoDate(new Date(Date.now() + 14 * 86400000)));
  const create = () => { const s = DEMO_STAFF.find((x) => slug(x.name) === name); if (!s) return; const tpl = templateFor(s.role); onCreate({ id: uid(), staffId: slug(s.name), name: s.name, role: s.role, op: s.op, kind, templateId: tpl.id, due, status: "scheduled", self: { done: false, ratings: tpl.competencies.map((c) => ({ id: c.id })) }, manager: { ratings: tpl.competencies.map((c) => ({ id: c.id })) }, goals: [], signoff: {}, createdAt: new Date().toISOString() }); };
  return (
    <div className="fixed inset-0 z-[140] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[10vh]" onClick={onClose} style={LIGHT_PALETTE}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2"><h3 className="text-[15px] font-extrabold text-[var(--ink)]">New review</h3><button type="button" onClick={onClose} className="ml-auto text-[18px] text-[var(--ink-3)]">×</button></div>
        <div className="grid gap-2.5">
          <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Employee</span><Select value={name} onChange={(e) => setName(e.target.value)} className="w-full"><option value="">Choose…</option>{DEMO_STAFF.map((s) => <option key={s.name} value={slug(s.name)}>{s.name} · {s.role}</option>)}</Select></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Type</span><Select value={kind} onChange={(e) => setKind(e.target.value as ReviewKind)} className="w-full">{(Object.keys(KIND_LABEL) as ReviewKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</Select></label>
            <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Due</span><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="w-full" /></label>
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!name} onClick={create}>Create & open</Button></div>
      </div>
    </div>
  );
}

function AddFeedback({ onAdd, onClose }: { onAdd: (f: FeedbackNote) => void; onClose: () => void }) {
  const [name, setName] = useState(""); const [kind, setKind] = useState<FeedbackKind>("kudos"); const [text, setText] = useState("");
  return (
    <div className="fixed inset-0 z-[140] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[12vh]" onClick={onClose} style={LIGHT_PALETTE}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2"><h3 className="text-[15px] font-extrabold text-[var(--ink)]">Log feedback / 1:1</h3><button type="button" onClick={onClose} className="ml-auto text-[18px] text-[var(--ink-3)]">×</button></div>
        <div className="grid gap-2.5">
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Employee</span><Select value={name} onChange={(e) => setName(e.target.value)} className="w-full"><option value="">Choose…</option>{DEMO_STAFF.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}</Select></label>
            <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Type</span><Select value={kind} onChange={(e) => setKind(e.target.value as FeedbackKind)} className="w-full">{(Object.keys(FB_META) as FeedbackKind[]).map((k) => <option key={k} value={k}>{FB_META[k].icon} {FB_META[k].label}</option>)}</Select></label>
          </div>
          <label className="block"><span className="mb-1 block text-[11px] font-extrabold uppercase text-[var(--ink-3)]">Note</span><textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className="w-full rounded-lg border border-[var(--line)] p-2 text-[12.5px]" /></label>
        </div>
        <div className="mt-3 flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!name || !text.trim()} onClick={() => onAdd({ id: uid(), staffId: slug(name), name, kind, text: text.trim(), at: new Date().toISOString(), by: "You" })}>Log it</Button></div>
      </div>
    </div>
  );
}

export default AppraisalsApp;
