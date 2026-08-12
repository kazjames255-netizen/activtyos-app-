"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Select } from "@/components/ui";
import { LIGHT_PALETTE, PageHero } from "@/components/OperatorPage";
import { SEED_LIBRARY, blankCourse, type CourseDoc } from "./courseContent";
import { CoursePlayer } from "./CoursePlayer";
import { CourseEditor } from "./CourseEditor";

// Company / Franchise Learning Centre — the training management side (the manual's
// LCM view, compliance merged in). Four tabs: Catalogue (courses + quizzes, create
// & assign), Assignments (by location + audience + due + required), Completion
// (KPIs + staff × training table), Certificates (DBS / First-Aid RAG). Front-end
// with a localStorage demo store; the real records/roll-up are Amir's backend.

type Tone = "green" | "amber" | "red" | "blue" | "grey";
const TONES: Record<Tone, string> = {
  green: "bg-[#e2f4ea] text-[#0f7a43]",
  amber: "bg-[#fcefd2] text-[#b45309]",
  red: "bg-[#fdecec] text-[#c0392b]",
  blue: "bg-[#eaf1ff] text-[#1d54c4]",
  grey: "bg-[#eef1f6] text-[#64748b]",
};
const STATUS_TONE: Record<string, Tone> = {
  Complete: "green", Valid: "green", Passed: "green",
  "In progress": "amber", Expiring: "amber", "Quiz pending": "amber",
  "Not started": "grey", Pending: "grey", Optional: "grey", Quiz: "grey",
  Overdue: "red", Expired: "red", Due: "red", Required: "red",
  Mandatory: "red", Recommended: "blue", Course: "blue",
};
const Badge = ({ text, tone }: { text: string; tone?: Tone }) => (
  <span className={"inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold " + TONES[tone ?? STATUS_TONE[text] ?? "grey"]}>{text}</span>
);

interface Quiz { id: string; title: string; cat: string; course: string | null; pass: number; questions: number }
interface Created { t: string; type: "Course" | "Quiz"; extra: string }
interface Assignment { item: string; scope: string; due: string; req: boolean }
interface Staff { name: string; role: string; op: string; sg: string; sgq: number | null; fa: string; dbs: string; pfa: string }

const SEED_QUIZZES: Quiz[] = [
  { id: "q1", title: "Safeguarding Basics Quiz", cat: "Mandatory", course: "c1", pass: 80, questions: 5 },
  { id: "q2", title: "Health & Safety Quiz", cat: "Mandatory", course: null, pass: 80, questions: 3 },
];
const SEED_ASSIGNMENTS: Assignment[] = [
  { item: "Safeguarding Children (Level 2)", scope: "All staff", due: "30 Jun", req: true },
  { item: "Health & Safety Quiz", scope: "All staff", due: "15 Jul", req: true },
  { item: "Paediatric First Aid Refresher", scope: "Leads only", due: "15 Jul", req: true },
];
const OPS: [string, string][] = [["all", "All locations"], ["Company-owned", "Company-owned (Head Office)"], ["Milton Keynes", "Milton Keynes"], ["Northampton", "Northampton"], ["Bedford", "Bedford"]];
const SEED_STAFF: Staff[] = [
  { name: "Marcus Bell", role: "Lead", op: "Company-owned", sg: "Complete", sgq: 92, fa: "In progress", dbs: "Valid", pfa: "Expiring" },
  { name: "Jess Patel", role: "Coach", op: "Company-owned", sg: "Complete", sgq: 84, fa: "Overdue", dbs: "Valid", pfa: "Valid" },
  { name: "Aisha Rahman", role: "Lead", op: "Milton Keynes", sg: "In progress", sgq: null, fa: "Not started", dbs: "Valid", pfa: "Expired" },
  { name: "Tom Lewis", role: "Coach", op: "Milton Keynes", sg: "Complete", sgq: 88, fa: "Complete", dbs: "Valid", pfa: "Valid" },
  { name: "Priya Khan", role: "Coach", op: "Northampton", sg: "Overdue", sgq: null, fa: "Not started", dbs: "Pending", pfa: "Valid" },
  { name: "Dan Reed", role: "Lead", op: "Bedford", sg: "Complete", sgq: 76, fa: "In progress", dbs: "Valid", pfa: "Valid" },
];
const WHO_OPTS = ["All staff", "Leads only", "Coaches only", "Selected individuals"];
const KEY = "aos.learn.lcm.v1";

export function LearningCentreApp({ scope = "company" }: { scope?: "company" | "franchise" }) {
  const isCo = scope === "company";
  const [tab, setTab] = useState<"cat" | "assign" | "comp" | "cert">("cat");
  const [help, setHelp] = useState(false);
  const [created, setCreated] = useState<Created[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>(SEED_ASSIGNMENTS);
  const [courses, setCourses] = useState<CourseDoc[]>(SEED_LIBRARY);
  const [player, setPlayer] = useState<CourseDoc | null>(null);
  const [editing, setEditing] = useState<CourseDoc | null>(null);
  const [op, setOp] = useState("all");
  const [toast, setToast] = useState<string | null>(null);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2400); };
  const CKEY = "aos.learn.courses.v1";

  // New-quiz modal + new-assignment modal
  const [newKind, setNewKind] = useState<"course" | "quiz" | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [aOpen, setAOpen] = useState(false);
  const [aItem, setAItem] = useState(""); const [aLoc, setALoc] = useState("all"); const [aWho, setAWho] = useState("All staff"); const [aDue, setADue] = useState(""); const [aReq, setAReq] = useState(true);

  useEffect(() => { try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s) { setCreated(s.created ?? []); setAssignments(s.assignments ?? SEED_ASSIGNMENTS); } } catch { /* ignore */ } try { const c = JSON.parse(localStorage.getItem(CKEY) || "null"); if (Array.isArray(c) && c.length) setCourses(c); } catch { /* ignore */ } }, []);
  const persist = (c: Created[], a: Assignment[]) => { setCreated(c); setAssignments(a); try { localStorage.setItem(KEY, JSON.stringify({ created: c, assignments: a })); } catch { /* ignore */ } };
  const persistCourses = (list: CourseDoc[]) => { setCourses(list); try { localStorage.setItem(CKEY, JSON.stringify(list)); } catch { /* ignore */ } };
  const saveCourse = (c: CourseDoc) => { persistCourses(courses.some((x) => x.id === c.id) ? courses.map((x) => (x.id === c.id ? c : x)) : [...courses, c]); setEditing(null); flash("✅ Course saved"); };
  const deleteCourse = (id: string) => { if (typeof window !== "undefined" && !window.confirm("Delete this course? This can't be undone.")) return; persistCourses(courses.filter((x) => x.id !== id)); flash("Course deleted"); };
  const courseMins = (c: CourseDoc) => c.lessons.reduce((n, l) => n + l.mins, 0);

  const catalogue = useMemo(() => {
    const out: { t: string; type: "Course" | "Quiz"; extra: string }[] = [];
    courses.forEach((c) => out.push({ t: c.title, type: "Course", extra: `${c.lessons.length} lessons` }));
    SEED_QUIZZES.forEach((q) => out.push({ t: q.title, type: "Quiz", extra: `${q.questions} Qs · pass ${q.pass}%` }));
    created.forEach((x) => out.push(x));
    return out;
  }, [created, courses]);

  const staff = useMemo(() => isCo ? (op === "all" ? SEED_STAFF : SEED_STAFF.filter((s) => s.op === op)) : SEED_STAFF.filter((s) => s.op === "Milton Keynes"), [isCo, op]);
  const compN = staff.filter((s) => s.sg === "Complete").length;
  const overN = staff.filter((s) => s.sg === "Overdue" || s.fa === "Overdue").length;
  const certAttN = staff.filter((s) => s.pfa === "Expiring" || s.pfa === "Expired" || s.dbs === "Pending").length;

  const saveNew = () => { const t = newTitle.trim() || `New ${newKind}`; persist([...created, { t, type: newKind === "course" ? "Course" : "Quiz", extra: "draft" }], assignments); setNewKind(null); setNewTitle(""); flash(`✅ ${newKind === "course" ? "Course" : "Quiz"} created — ready to assign`); };
  const openAssign = (item = "") => { setAItem(item || catalogue[0]?.t || ""); setALoc("all"); setAWho("All staff"); setADue(""); setAReq(true); setAOpen(true); };
  const saveAssign = () => { const locLabel = OPS.find((o) => o[0] === aLoc)?.[1] ?? ""; const scopeStr = aWho + (aLoc === "all" ? "" : ` · ${locLabel}`); persist(created, [...assignments, { item: aItem, scope: scopeStr, due: aDue || "—", req: aReq }]); setAOpen(false); flash("✅ Assignment created"); };

  const OpSelect = isCo ? (
    <div className="mb-3 text-[12.5px] font-semibold text-[var(--ink-2)]">Location <Select value={op} onChange={(e) => setOp(e.target.value)} className="ml-1 max-w-[260px] align-middle">{OPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></div>
  ) : <div className="mb-3 text-[12.5px] text-[var(--ink-3)]">Scope: <b className="text-[var(--ink-2)]">Milton Keynes</b> (your franchise)</div>;

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero title="Learning Centre" icon="🎓" lede={`Courses, quizzes, assignments, completion & certificates — ${isCo ? "your company" : "your franchise"}`} />

      <Card className="mb-3 overflow-hidden">
        <button type="button" onClick={() => setHelp((v) => !v)} className="flex w-full items-center gap-2 px-4 py-3 text-left"><span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--panel)] text-[12px]">ⓘ</span><span className="text-[14px] font-extrabold text-[var(--ink)]">How it works</span><span className="ml-auto text-[12px] text-[var(--ink-3)]">{help ? "▲" : "▼"}</span></button>
        {help && <ul className="ml-9 list-disc space-y-1 px-4 pb-3.5 text-[13px] leading-relaxed text-[var(--ink-2)]"><li><b>Catalogue</b> — your courses (videos + picture/doc material, optional quiz) and standalone quizzes. Create new ones, then <b>Assign</b>.</li><li><b>Assignments</b> — set who does what: by location and audience, with a <b>Complete-by</b> date and Required or Optional.</li><li><b>Completion</b> — a live picture of who's done their training, with quiz scores.</li><li><b>Certificates</b> — the DBS / First-Aid record. Staff upload theirs in their own Learning Centre; this is the single record.</li>{isCo && <li>The <b>Location</b> dropdown scopes Completion &amp; Certificates across all your sites and franchises.</li>}</ul>}
      </Card>

      <Card className="p-0">
        <div className="flex gap-1 border-b border-[var(--line)] px-3 pt-2">
          {([["cat", "Catalogue"], ["assign", "Assignments"], ["comp", "Completion"], ["cert", "Certificates"]] as const).map(([t, l]) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={"relative px-3.5 py-2.5 text-[13.5px] font-bold transition-colors " + (tab === t ? "text-[#1d3a8f]" : "text-[var(--ink-3)] hover:text-[var(--ink-2)]")}>{l}{tab === t && <span className="absolute inset-x-2 -bottom-px h-[2.5px] rounded-full bg-[#1d3a8f]" />}</button>
          ))}
        </div>
        <div className="p-4">
          {/* Catalogue */}
          {tab === "cat" && (<>
            <div className="mb-3 flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => setEditing(blankCourse("c" + Date.now().toString(36)))}>+ New course</Button>
              <Button onClick={() => { setNewKind("quiz"); setNewTitle(""); }}>+ New quiz</Button>
            </div>
            {/* Courses — interactive, editable, deletable */}
            <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Courses</div>
            <div className="mb-4 flex flex-col gap-2.5">
              {courses.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
                  <button type="button" onClick={() => setPlayer(c)} className="min-w-0 flex-1 text-left">
                    <div className="text-[14.5px] font-extrabold text-[var(--ink)]">{c.title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11.5px] text-[var(--ink-3)]"><Badge text="Course" /><Badge text={c.cat} />{c.lessons.length} lessons · ~{courseMins(c)} min · 🔊 read-aloud</div>
                    {c.blurb && <div className="mt-1 line-clamp-1 text-[12px] text-[var(--ink-2)]">{c.blurb}</div>}
                  </button>
                  <div className="flex flex-none gap-1.5">
                    <Button variant="primary" onClick={() => setPlayer(c)}>Open</Button>
                    <Button onClick={() => setEditing(c)}>Edit</Button>
                    <button type="button" onClick={() => deleteCourse(c.id)} title="Delete course" className="rounded-full border border-[var(--line)] px-3 py-1.5 text-[13px] font-bold text-[var(--ink-3)] hover:border-[#c0392b] hover:text-[#c0392b]">🗑</button>
                    <Button onClick={() => openAssign(c.title)}>Assign</Button>
                  </div>
                </div>
              ))}
            </div>
            {/* Standalone quizzes */}
            <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Quizzes</div>
            <div className="flex flex-col gap-2.5">
              {[...SEED_QUIZZES.map((q) => ({ t: q.title, extra: `${q.questions} Qs · pass ${q.pass}%` })), ...created.filter((x) => x.type === "Quiz").map((x) => ({ t: x.t, extra: x.extra }))].map((it, i) => (
                <div key={it.t + i} className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
                  <div className="min-w-0 flex-1"><div className="text-[14px] font-extrabold text-[var(--ink)]">{it.t}</div><div className="mt-1 flex items-center gap-2 text-[11.5px] text-[var(--ink-3)]"><Badge text="Quiz" tone="grey" />{it.extra}</div></div>
                  <Button onClick={() => openAssign(it.t)}>Assign</Button>
                </div>
              ))}
            </div>
          </>)}

          {/* Assignments */}
          {tab === "assign" && (<>
            <div className="mb-3"><Button variant="primary" onClick={() => openAssign("")}>+ New assignment</Button></div>
            <div className="flex flex-col gap-2.5">
              {assignments.map((a, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
                  <div className="min-w-0 flex-1"><div className="text-[14px] font-extrabold text-[var(--ink)]">{a.item}</div><div className="mt-0.5 text-[11.5px] text-[var(--ink-3)]">{a.scope} · due {a.due}</div></div>
                  <Badge text={a.req ? "Required" : "Optional"} />
                </div>
              ))}
              {assignments.length === 0 && <p className="rounded-xl bg-[var(--panel)] px-4 py-6 text-center text-[12.5px] text-[var(--ink-3)]">No assignments yet — create one above.</p>}
            </div>
          </>)}

          {/* Completion */}
          {tab === "comp" && (<>
            {OpSelect}
            <div className="mb-3 flex flex-wrap gap-2.5">
              {[[String(staff.length), "staff in scope", "var(--ink)"], [String(compN), "safeguarding complete", "#0f7a43"], [String(overN), "overdue", "#c0392b"]].map(([n, l, c], i) => (
                <div key={i} className="min-w-[130px] flex-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-2.5"><div className="text-[22px] font-extrabold tabular-nums" style={{ color: c }}>{n}</div><div className="text-[11px] text-[var(--ink-3)]">{l}</div></div>
              ))}
            </div>
            <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
              <table className="w-full text-[13px]"><thead><tr className="bg-[var(--panel)] text-left text-[11px] uppercase tracking-wide text-[var(--ink-3)]"><th className="px-3 py-2.5 font-extrabold">Staff</th><th className="px-3 py-2.5 font-extrabold">Location</th><th className="px-3 py-2.5 font-extrabold">Role</th><th className="px-3 py-2.5 font-extrabold">Safeguarding</th><th className="px-3 py-2.5 font-extrabold">S/G quiz</th><th className="px-3 py-2.5 font-extrabold">First aid</th></tr></thead>
                <tbody>{staff.map((s) => (
                  <tr key={s.name} className="border-t border-[var(--line-2,#eef2f8)]"><td className="px-3 py-2.5 font-bold text-[var(--ink)]">{s.name}</td><td className="px-3 py-2.5 text-[var(--ink-2)]">{s.op}</td><td className="px-3 py-2.5 text-[var(--ink-2)]">{s.role}</td><td className="px-3 py-2.5"><Badge text={s.sg} /></td><td className="px-3 py-2.5 tabular-nums text-[var(--ink-2)]">{s.sgq != null ? `${s.sgq}%` : "—"}</td><td className="px-3 py-2.5"><Badge text={s.fa} /></td></tr>
                ))}</tbody>
              </table>
            </div>
          </>)}

          {/* Certificates */}
          {tab === "cert" && (<>
            {OpSelect}
            <p className="mb-2.5 text-[11.5px] text-[var(--ink-3)]"><b className="text-[var(--ink-2)]">{certAttN}</b> staff have a certificate needing attention. Staff upload certificates in their own Learning Centre; this is the single record.</p>
            <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
              <table className="w-full text-[13px]"><thead><tr className="bg-[var(--panel)] text-left text-[11px] uppercase tracking-wide text-[var(--ink-3)]"><th className="px-3 py-2.5 font-extrabold">Staff</th><th className="px-3 py-2.5 font-extrabold">Location</th><th className="px-3 py-2.5 font-extrabold">DBS</th><th className="px-3 py-2.5 font-extrabold">Paediatric First Aid</th></tr></thead>
                <tbody>{staff.map((s) => (
                  <tr key={s.name} className="border-t border-[var(--line-2,#eef2f8)]"><td className="px-3 py-2.5 font-bold text-[var(--ink)]">{s.name}</td><td className="px-3 py-2.5 text-[var(--ink-2)]">{s.op}</td><td className="px-3 py-2.5"><Badge text={s.dbs} /></td><td className="px-3 py-2.5"><Badge text={s.pfa} /></td></tr>
                ))}</tbody>
              </table>
            </div>
          </>)}
        </div>
      </Card>

      {/* New course / quiz modal */}
      {newKind && (
        <div className="fixed inset-0 z-[130] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[12vh]" onClick={() => setNewKind(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()} style={LIGHT_PALETTE}>
            <div className="mb-3 flex items-center gap-2"><div className="text-[15px] font-extrabold text-[var(--ink)]">New {newKind}</div><button type="button" onClick={() => setNewKind(null)} className="ml-auto text-[18px] text-[var(--ink-3)]">×</button></div>
            <label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Title</label>
            <Input autoFocus value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={newKind === "course" ? "e.g. Allergy Awareness" : "e.g. Fire Safety Quiz"} className="w-full" />
            <p className="mt-2 text-[11.5px] text-[var(--ink-3)]">{newKind === "course" ? "You'll add videos / picture material after creating." : "You'll add questions + a pass mark after creating."}</p>
            <div className="mt-4 flex justify-end gap-2"><Button onClick={() => setNewKind(null)}>Cancel</Button><Button variant="primary" onClick={saveNew}>Create</Button></div>
          </div>
        </div>
      )}

      {/* New assignment modal */}
      {aOpen && (
        <div className="fixed inset-0 z-[130] flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-[9vh]" onClick={() => setAOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()} style={LIGHT_PALETTE}>
            <div className="mb-3 flex items-center gap-2"><div className="text-[15px] font-extrabold text-[var(--ink)]">New assignment</div><button type="button" onClick={() => setAOpen(false)} className="ml-auto text-[18px] text-[var(--ink-3)]">×</button></div>
            <div className="flex flex-col gap-3">
              <div><label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Course / quiz</label><Select value={aItem} onChange={(e) => setAItem(e.target.value)} className="w-full">{catalogue.map((it, i) => <option key={i} value={it.t}>{it.t}</option>)}</Select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Location</label><Select value={aLoc} onChange={(e) => setALoc(e.target.value)} className="w-full">{OPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></div>
                <div><label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Who</label><Select value={aWho} onChange={(e) => setAWho(e.target.value)} className="w-full">{WHO_OPTS.map((w) => <option key={w} value={w}>{w}</option>)}</Select></div>
              </div>
              <div><label className="mb-1 block text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">Complete by</label><Input type="date" value={aDue} onChange={(e) => setADue(e.target.value)} className="w-full" /></div>
              <label className="flex items-center gap-2 text-[12.5px] font-semibold text-[var(--ink-2)]"><input type="checkbox" checked={aReq} onChange={(e) => setAReq(e.target.checked)} /> Required (mandatory)</label>
            </div>
            <div className="mt-4 flex justify-end gap-2"><Button onClick={() => setAOpen(false)}>Cancel</Button><Button variant="primary" onClick={saveAssign} disabled={!aItem}>Assign</Button></div>
          </div>
        </div>
      )}

      {toast && <div className="fixed bottom-5 left-1/2 z-[150] -translate-x-1/2 rounded-full bg-[#111634] px-4 py-2 text-[13px] font-bold text-white shadow-lg">{toast}</div>}

      {player && <CoursePlayer course={player} onClose={() => setPlayer(null)} />}
      {editing && <CourseEditor course={editing} onSave={saveCourse} onCancel={() => setEditing(null)} />}
    </div>
  );
}
