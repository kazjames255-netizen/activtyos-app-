"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, Input } from "@/components/ui";
import { del, get, post, put } from "@/lib/api";
import { Avatar, EmptyState, FOCUS, Icon, MiniRing, Modal, RowMenu, Skeleton, SkeletonRows, SubjectChip, subjectColor, subjectInk, tint } from "./kit";
import type { PanelMeta, PanelProps } from "./panelTypes";
import { useRosterInsights, type Insight } from "./useRosterInsights";
import { GroupsSection } from "./GroupsSection";
import { GroupChip } from "./groupKit";
import { requestNewMessage, requestOpenStudent, setHubIntent, takeHubIntent } from "./hubIntent";
import { errMsg, fmtDate, groupMemberIds, subjectsOf, type HubGroup, type Student } from "./types";
import { ScopeToggle, useScope } from "./mineKit";

// Students — the tutor's roster. A family only ever sees the Learning Hub for a
// child that has been enrolled here, so this is where access is granted, paused
// and narrowed to particular subjects. Candidates come from the same lookup the
// header's "Find a child" uses (children who've booked with, or joined, you).

export const meta: PanelMeta = { key: "students", label: "Students", icon: "users", status: "live", blurb: "Enrol children, choose which subjects they can see, and pause or remove access." };

interface Candidate { childId: string; name: string; parentName: string; parentEmail: string; postcode: string; town: string; ref: string; photo?: string; /** The server's dob-derived default school year, when it can work one out. */ yearGroup?: string | null; suggestedYearGroup?: string | null }

const norm = (s: string) => s.toLowerCase();

/** Subject toggles — empty selection means "all subjects". */
function SubjectPicker({ subjects, value, onChange }: { subjects: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const all = value.length === 0;
  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Subjects this student can see">
        <button type="button" aria-pressed={all} onClick={() => onChange([])}
          className={`min-h-[44px] lg:min-h-[40px] rounded-full border px-3.5 text-[12.5px] font-extrabold transition ${FOCUS} ${all ? "border-transparent text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] hover:border-[var(--brand-2)]"}`}
          style={all ? { background: "linear-gradient(180deg, var(--brand-2), var(--brand))" } : undefined}>All subjects</button>
        {subjects.map((s) => {
          const on = value.includes(s);
          const c = subjectColor(s);
          return (
            <button key={s} type="button" aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== s) : [...value, s])}
              className={`inline-flex min-h-[44px] lg:min-h-[40px] items-center gap-1.5 rounded-full border px-3.5 text-[12.5px] font-extrabold transition ${FOCUS} ${on ? "" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] hover:border-[var(--ink-2)]"}`}
              style={on ? { background: tint(c, 16), borderColor: c, color: subjectInk(s) } : undefined}>
              {on && <Icon name="check" size={14} strokeWidth={2.6} />}{s}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[12px] leading-snug text-[var(--ink-2)]">
        {subjects.length === 0 ? "No subjects exist yet — the student will see everything you add." : all ? "They can see every subject, including ones you add later." : `They'll only see ${value.join(", ")}.`}
      </p>
    </div>
  );
}

/** School year — optional; "Not set" clears it. Options come from the tenant's own list (Setup → Learning Hub). */
function YearGroupSelect({ value, onChange, options, id, autoNote }: { value: string; onChange: (v: string) => void; options: string[]; id: string; autoNote?: string }) {
  const list = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-2)]">Year group</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="min-h-[46px] w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-[13.5px] font-semibold text-[var(--ink)] outline-none focus:border-[var(--brand)]">
        <option value="">Automatic — from their date of birth{autoNote ? ` (${autoNote})` : ""}</option>
        {list.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
      <p className="mt-1 text-[11.5px] text-[var(--ink-3)]">Used to show the right quizzes and placement tests. Leave on Automatic and we work it out from their date of birth; pick a year to set it yourself.</p>
    </div>
  );
}

interface Tutor { uid: string; name: string; role: string; me: boolean }
/** The people a student can be assigned to (owner + staff). Only fetched for tutors who may edit. */
function useTutors(enabled: boolean): Tutor[] {
  const [list, setList] = useState<Tutor[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    get<Tutor[]>("/api/learning-hub/tutors").then((r) => { if (live && Array.isArray(r)) setList(r); }).catch(() => undefined);
    return () => { live = false; };
  }, [enabled]);
  return list;
}

/** Who teaches this student. Shown only when the business has more than one tutor. "" = unassigned (every tutor sees them). */
function TutorSelect({ tutors, value, onChange, id }: { tutors: Tutor[]; value: string; onChange: (v: string) => void; id: string }) {
  if (tutors.length < 2) return null;
  const list = value && !tutors.some((t) => t.uid === value) ? [{ uid: value, name: "Former tutor", role: "", me: false }, ...tutors] : tutors;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-2)]">Tutor</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="min-h-[46px] w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-[13.5px] font-semibold text-[var(--ink)] outline-none focus:border-[var(--brand)]">
        <option value="">Unassigned — every tutor sees them</option>
        {list.map((t) => <option key={t.uid} value={t.uid}>{t.name}{t.me ? " (you)" : ""}</option>)}
      </select>
      <p className="mt-1 text-[11.5px] text-[var(--ink-3)]">Tutors see their own students first (and can switch to Everyone). Owners and managers always see everyone.</p>
    </div>
  );
}

interface InviteRow { id: string; token: string | null; status: "pending" | "claimed" | "expired" | "revoked"; forName: string; createdAt: string; childNames: string[] }

/** F13 — a link for a family who has never booked: they open it signed in to their parent account, choose which of their own
 *  children to enrol, and the enrolment is created (POST /family-invites). Nothing is emailed from here: copy the link and send it. */
function FamilyInvite({ qs, tutorUid }: { qs: string; tutorUid: string }) {
  const [rows, setRows] = useState<InviteRow[] | null>(null);
  const [forName, setForName] = useState("");
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const load = () => get<InviteRow[]>(`/api/learning-hub/family-invites${qs}`).then((r) => setRows(Array.isArray(r) ? r : [])).catch(() => setRows([]));
  useEffect(() => { void load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);
  const link = (t: string) => `${window.location.origin}/custdash/learninghub?invite=${t}`;
  const create = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await post<{ token: string }>(`/api/learning-hub/family-invites${qs}`, { forName: forName.trim(), ...(tutorUid ? { tutorUid } : {}) });
      setMade(link(r.token)); setForName(""); void load();
    } catch (e) { setErr(errMsg(e, "Couldn't create the invite")); }
    finally { setBusy(false); }
  };
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { window.prompt("Copy this link", text); }
  };
  const revoke = async (id: string) => { try { await del(`/api/learning-hub/family-invites/${id}${qs}`); void load(); } catch (e) { setErr(errMsg(e, "Couldn't withdraw that invite")); } };
  const recent = (rows ?? []).slice(0, 4);
  return (
    <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3" data-testid="hub-family-invite">
      <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-2)]">Invite a family who hasn&apos;t booked</div>
      <p className="mt-1 text-[12px] leading-snug text-[var(--ink-2)]">Make a private link and send it to the parent yourself. They open it while signed in to their ActivityOS parent account (or after signing up), choose which of their children to enrol, and they appear on your roster. Valid for 30 days, for one family.</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Input aria-label="Who is it for (optional)" placeholder="Who is it for? (optional)" value={forName} onChange={(e) => setForName(e.target.value)} maxLength={120} className="!min-h-[44px] min-w-[180px] flex-1" />
        <Button sm variant="primary" data-testid="hub-family-invite-create" disabled={busy} className="!h-[44px] !px-4" onClick={() => void create()}>{busy ? "Making…" : "Create invite link"}</Button>
      </div>
      {err && <p role="alert" className="mt-2 text-[12.5px] text-[var(--red)]">{err}</p>}
      {made && (
        <div className="mt-2 flex items-center gap-2" data-testid="hub-family-invite-link">
          <input readOnly value={made} aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} className="min-h-[40px] min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 text-[12.5px] text-[var(--ink)]" />
          <Button sm className="!h-[44px] lg:!h-[40px] !px-4" onClick={() => void copy(made)}>{copied ? "Copied" : "Copy link"}</Button>
        </div>
      )}
      {recent.length > 0 && (
        <ul className="mt-3 grid gap-1.5 text-[12.5px]" aria-label="Recent invites">
          {recent.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 text-[var(--ink-2)]">
              <span className="font-bold text-[var(--ink)]">{r.forName || "Invite"}</span>
              <span>{r.status === "claimed" ? `joined${r.childNames.length ? `: ${r.childNames.join(", ")}` : ""}` : r.status === "pending" ? "waiting for them to open it" : r.status}</span>
              {r.status === "pending" && r.token && <button type="button" className={`ml-auto min-h-[44px] rounded-full px-3 text-[12px] font-extrabold text-[var(--brand)] hover:bg-[var(--brand-soft)] ${FOCUS}`} onClick={() => void copy(link(r.token!))}>Copy link</button>}
              {r.status === "pending" && <button type="button" className={`min-h-[44px] rounded-full px-3 text-[12px] font-extrabold text-[var(--red)] hover:bg-[var(--red-soft)] ${FOCUS}`} onClick={() => void revoke(r.id)}>Withdraw</button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EnrolModal({ open, onClose, tenantId, students, subjects, yearGroups, qs, tutors, defaultTutor, onDone, onError }: { open: boolean; onClose: () => void; tenantId: string; students: Student[]; subjects: string[]; yearGroups: string[]; qs: string; tutors: Tutor[]; defaultTutor: string; onDone: (name: string) => void; onError: (m: string) => void }) {
  const [list, setList] = useState<Candidate[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<Candidate | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [year, setYear] = useState("");
  const [tutor, setTutor] = useState(defaultTutor);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQ(""); setPick(null); setChosen([]); setYear(""); setTutor(defaultTutor); setList(null); setFailed(false);
    get<Candidate[]>("/api/children/lookup").then(setList).catch(() => { setFailed(true); setList([]); });
  }, [open]);

  const byId = useMemo(() => new Map(students.map((s) => [s.childId, s])), [students]);
  const shown = useMemo(() => {
    const n = norm(q.trim());
    return (list ?? []).filter((c) => !n || [c.name, c.parentName, c.parentEmail, c.postcode, c.town, c.ref].some((f) => norm(f ?? "").includes(n)));
  }, [list, q]);

  const enrol = async () => {
    if (!pick) return;
    setBusy(true);
    try {
      await post(`/api/learning-hub/students${qs}`, { childId: pick.childId, subjects: chosen, ...(year ? { yearGroup: year } : {}), ...(tutors.length > 1 ? { tutorUid: tutor || null } : {}) });
      onDone(pick.name);
      onClose();
    } catch (e) { onError(errMsg(e, "Couldn't enrol that child")); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} wide id="hub-enrol-modal" title={pick ? `Enrol ${pick.name}` : "Enrol a student"}
      footer={pick ? (
        <>
          <Button onClick={() => setPick(null)} className="!h-[44px] lg:!h-[40px]"><Icon name="arrowLeft" size={14} /> Back</Button>
          <Button variant="primary" disabled={busy} onClick={enrol} className="!h-[44px] lg:!h-[40px]">{busy ? "Enrolling…" : "Enrol student"}</Button>
        </>
      ) : undefined}>
      {pick ? (
        <div>
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3">
            <Avatar name={pick.name} size={44} />
            <div className="min-w-0"><div className="truncate text-[14px] font-extrabold text-[var(--ink)]">{pick.name}</div><div className="truncate text-[12px] text-[var(--ink-2)]">{pick.parentName || pick.parentEmail}</div></div>
          </div>
          <h3 className="mb-2 text-[12px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-2)]">Which subjects can they see?</h3>
          <SubjectPicker subjects={subjects} value={chosen} onChange={setChosen} />
          <div className="mt-4"><YearGroupSelect id="hub-enrol-year" value={year} onChange={setYear} options={yearGroups} /></div>
          {tutors.length > 1 && <div className="mt-4"><TutorSelect id="hub-enrol-tutor" tutors={tutors} value={tutor} onChange={setTutor} /></div>}
          <p className="mt-4 rounded-xl border border-[var(--gold-line)] bg-[var(--gold-soft)] px-3.5 py-2.5 text-[12.5px] leading-snug text-[var(--ink)]">
            Their family will see My Classroom from now on, and get a notification when you publish new lessons.
          </p>
        </div>
      ) : (
        <div>
          <div className="relative">
            <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-2)]" />
            <Input data-autofocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by child, parent, postcode…" aria-label="Search children" className="!min-h-[46px] w-full !rounded-full !pl-9" />
          </div>
          <div className="mt-3" aria-live="polite">
            {list === null ? <SkeletonRows rows={3} label="Finding children" /> : failed ? (
              <p role="alert" className="py-6 text-center text-[13px] text-[var(--red)]">Couldn&apos;t load your children. Close this and try again.</p>
            ) : shown.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-[13.5px] font-extrabold text-[var(--ink)]">{list.length === 0 ? "No children to enrol yet" : "No one matches that search"}</p>
                <p className="mx-auto mt-1 max-w-[380px] text-[12.5px] leading-snug text-[var(--ink-2)]">{list.length === 0 ? "A child shows up here once their family has booked with you or joined you. To bring in a family who hasn't booked, send them your page link below." : "Try part of the child's or parent's name, or a postcode — or send the family your page link below."}</p>
                <FamilyLink tenantId={tenantId} />
              </div>
            ) : (
              <ul className="divide-y divide-[var(--line)]">
                {shown.map((c) => {
                  const cur = byId.get(c.childId);
                  const enrolled = !!cur && cur.active !== false;
                  return (
                    <li key={c.childId} className="flex items-center gap-3 py-2.5">
                      <Avatar name={c.name} size={40} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-extrabold text-[var(--ink)]">{c.name}</div>
                        <div className="truncate text-[12px] text-[var(--ink-2)]">{[c.parentName, c.postcode || c.town].filter(Boolean).join(" · ") || c.parentEmail}</div>
                      </div>
                      {enrolled ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-extrabold" style={{ background: "var(--green-soft)", color: "#0b6b3a" }}><Icon name="check" size={13} strokeWidth={2.6} /> Enrolled</span>
                      ) : (
                        <Button sm className="!h-[44px] lg:!h-[38px] !px-4" aria-label={`${cur ? "Resume" : "Enrol"} ${c.name}`} onClick={() => { setPick(c); setChosen(cur?.subjects ?? []); setYear(cur && !cur.yearGroupAuto ? cur.yearGroup ?? "" : ""); if (cur) setTutor(cur.tutorUid ?? ""); }}>{cur ? "Resume" : "Enrol"}</Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <FamilyInvite qs={qs} tutorUid={defaultTutor} />
        </div>
      )}
    </Modal>
  );
}

/** A family who has never booked joins by opening the provider's public page while signed in to their parent account (or by
 *  signing up through it): that links them to the provider, and their children then appear in the enrol list above. */
function FamilyLink({ tenantId }: { tenantId: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/store/${tenantId}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { window.prompt("Copy this link", url); }
  };
  return (
    <div className="mx-auto mt-4 max-w-[420px] rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3 text-left" data-testid="hub-family-link">
      <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-2)]">Your page link for new families</div>
      <div className="mt-1.5 flex items-center gap-2">
        <input readOnly value={url} aria-label="Your page link" onFocus={(e) => e.currentTarget.select()} className="min-h-[40px] min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 text-[12.5px] text-[var(--ink)]" />
        <Button sm className="!h-[44px] lg:!h-[40px] !px-4" onClick={() => void copy()}>{copied ? "Copied" : "Copy link"}</Button>
      </div>
      <p className="mt-2 text-[12px] leading-snug text-[var(--ink-2)]">Ask the parent to open it while signed in to their ActivityOS parent account (or to sign up through it). Once they have, their children show up in this list and you can enrol them. No booking needed.</p>
    </div>
  );
}

const clock = (t: number) => new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const DAY = 86_400_000;
function nextWhen(t: number, now: number): string {
  const d0 = new Date(now); d0.setHours(0, 0, 0, 0);
  const days = Math.floor((t - d0.getTime()) / DAY);
  if (days <= 0) return `Today ${clock(t)}`;
  if (days === 1) return `Tomorrow ${clock(t)}`;
  if (days < 7) return `${new Date(t).toLocaleDateString("en-GB", { weekday: "short" })} ${clock(t)}`;
  return `${new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}, ${clock(t)}`;
}
function seenAgo(t: number | null, now: number): string {
  if (!t) return "No activity yet";
  const d = now - t;
  if (d < 3_600_000) return "Last seen just now";
  if (d < DAY) return `Last seen ${Math.round(d / 3_600_000)} h ago`;
  const days = Math.floor(d / DAY);
  return days === 1 ? "Last seen yesterday" : days < 30 ? `Last seen ${days} days ago` : `Last seen ${new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
}

/** Ring colour from the tenant's mastery ladder: lowest third gold, middle brand, top green (same rule as Progress). */
function ringColour(pct: number | null, bands: { min: number }[]): string {
  if (pct == null || !bands.length) return "var(--brand)";
  let best = 0;
  bands.forEach((b, i) => { if (b.min <= pct && b.min >= bands[best].min) best = i; });
  const t = bands.length === 1 ? 0.5 : best / (bands.length - 1);
  return t < 0.34 ? "var(--gold)" : t < 0.67 ? "var(--brand-2)" : "var(--green)";
}

function Badge({ tone, icon, children }: { tone: "red" | "violet" | "brand" | "green"; icon: "warning" | "check" | "video" | "homework"; children: ReactNode }) {
  const fg = tone === "red" ? "var(--red)" : tone === "violet" ? "var(--violet)" : tone === "green" ? "#0b6b3a" : "var(--brand-strong)";
  const bg = tone === "red" ? "var(--red-soft)" : tone === "violet" ? "var(--violet-soft)" : tone === "green" ? "var(--green-soft)" : "var(--brand-soft)";
  return <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-[3px] text-[11.5px] font-extrabold" style={{ background: bg, color: fg }}><Icon name={icon} size={12} strokeWidth={2.2} />{children}</span>;
}

export function Panel({ students, topics, qs, onError, refreshStudents, canEdit: tutorMode, readOnly, tenantId, config, groups = [], refreshGroups, goTo, me }: PanelProps) {
  const canEdit = tutorMode && !readOnly; // a view-only role sees the roster but none of the write controls
  const subjects = useMemo(() => subjectsOf(topics), [topics]);
  const [enrolOpen, setEnrolOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [editYear, setEditYear] = useState("");
  const [editGroups, setEditGroups] = useState<string[]>([]);
  const [editTutor, setEditTutor] = useState("");
  const tutors = useTutors(canEdit);
  // F11: in a business with more than one tutor, each tutor's own students come first (Everyone is one tap away).
  const myUid = me?.uid ?? null;
  const mineCount = myUid ? students.filter((s) => s.tutorUid === myUid).length : 0;
  const multiTutor = tutorMode && !!myUid && (me?.role === "staff" || students.some((s) => s.tutorUid && s.tutorUid !== myUid));
  const [scope, setScope] = useScope(me?.role === "staff" && mineCount > 0 ? "mine" : "all");
  const mineOnly = multiTutor && scope === "mine";
  const defaultTutor = me?.role === "staff" && myUid ? myUid : "";
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const [view, setView] = useState<"all" | "active" | "paused" | "attention">("all");
  const [now, setNow] = useState(() => Date.now());
  const insights = useRosterInsights(qs);

  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(null), 5000); return () => clearTimeout(t); }, [flash]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t); }, []);

  // Home's "Enrol student" quick action lands here with the enrol dialog already open.
  useEffect(() => { if (canEdit && takeHubIntent(["enrol"])) setEnrolOpen(true); }, [canEdit]);

  const refresh = () => refreshStudents?.();
  const refreshAll = () => { refreshStudents?.(); refreshGroups?.(); };
  // Which groups each student is in (a student can be in several; none is fine).
  const groupsOf = useMemo(() => {
    const m = new Map<string, HubGroup[]>();
    for (const g of groups) for (const id of groupMemberIds(g)) m.set(id, [...(m.get(id) ?? []), g]);
    return m;
  }, [groups]);
  const activeGroup = groupFilter ? groups.find((g) => g.id === groupFilter) ?? null : null;
  // A group that vanished (deleted here or elsewhere) must not leave the roster filtered to nothing.
  useEffect(() => { if (groupFilter && groups.length && !groups.some((g) => g.id === groupFilter)) setGroupFilter(null); if (groupFilter && !groups.length) setGroupFilter(null); }, [groups, groupFilter]);
  const act = async (id: string, fn: () => Promise<unknown>, fail: string) => {
    setBusy(id);
    try { await fn(); refresh(); } catch (e) { onError(errMsg(e, fail)); } finally { setBusy(null); }
  };

  const active = students.filter((s) => s.active !== false);
  const needs = (s: Student) => { const i = insights.byChild.get(s.childId); return (i?.overdue ?? 0) + (i?.toMark ?? 0); };
  const attention = active.filter((s) => needs(s) > 0);
  const shown = useMemo(() => {
    const n = norm(q.trim());
    const rows = students.filter((s) => {
      if (view === "attention") { const i = insights.byChild.get(s.childId); if (s.active === false || !i || i.overdue + i.toMark === 0) return false; }
      else if (view !== "all" && (view === "active") !== (s.active !== false)) return false;
      if (activeGroup && !groupMemberIds(activeGroup).includes(s.childId)) return false;
      if (mineOnly && s.tutorUid !== myUid) return false;
      return !n || norm(s.childName).includes(n) || norm(s.parentEmail ?? "").includes(n) || (s.subjects ?? []).some((x) => norm(x).includes(n));
    });
    // Name order, deliberately stable: cards must not shuffle under the tutor as live figures arrive.
    return rows.sort((a, b) => a.childName.localeCompare(b.childName));
  }, [students, q, view, insights.byChild, activeGroup, mineOnly, myUid]);

  const openProgress = (s: Student) => { requestOpenStudent(s.childId, s.childName); goTo?.("dashboard"); };
  const openMessage = (s: Student) => { requestNewMessage(s.childId); goTo?.("questions"); };
  const setHomework = (s: Student) => { setHubIntent({ kind: "homework", groupId: "", childIds: [s.childId] }); goTo?.("homework"); };
  const beginEdit = (s: Student) => { setEditing(s); setEditTutor(s.tutorUid ?? ""); setChosen(s.subjects ?? []); setEditYear(s.yearGroupAuto ? "" : s.yearGroup ?? ""); setEditGroups((groupsOf.get(s.childId) ?? []).map((g) => g.id)); };
  const saveDetails = async () => {
    if (!editing) return;
    setBusy(editing.childId);
    // Several writes (the student, then each group whose membership changed). If any one fails, put back what already went through
    // so the roster never ends up half-saved.
    const undo: (() => Promise<unknown>)[] = [];
    try {
      const prevYear = editing.yearGroupAuto ? { yearGroupAuto: true } : { yearGroup: editing.yearGroup ?? null };
      const tutorChanged = tutors.length > 1 && editTutor !== (editing.tutorUid ?? "");
      await put(`/api/learning-hub/students/${editing.childId}${qs}`, { subjects: chosen, ...(editYear ? { yearGroup: editYear } : { yearGroupAuto: true }), ...(tutorChanged ? { tutorUid: editTutor || null } : {}) });
      undo.push(() => put(`/api/learning-hub/students/${editing.childId}${qs}`, { subjects: editing.subjects ?? [], ...prevYear, ...(tutorChanged ? { tutorUid: editing.tutorUid ?? null } : {}) }));
      // Group membership lives on the group: write only the groups whose membership for this student changed.
      const was = new Set((groupsOf.get(editing.childId) ?? []).map((g) => g.id));
      const now = new Set(editGroups);
      for (const g of groups) {
        if (was.has(g.id) === now.has(g.id)) continue;
        const ids = groupMemberIds(g).filter((id) => id !== editing.childId);
        const before = groupMemberIds(g);
        await put(`/api/learning-hub/groups/${g.id}${qs}`, { childIds: now.has(g.id) ? [...ids, editing.childId] : ids });
        undo.push(() => put(`/api/learning-hub/groups/${g.id}${qs}`, { childIds: before }));
      }
      setEditing(null); refreshAll();
    }
    catch (e) {
      let restored = true;
      for (const u of undo.reverse()) { try { await u(); } catch { restored = false; } }
      refreshAll();
      onError(`${errMsg(e, "Couldn't save the student")}${undo.length ? (restored ? " — nothing was changed." : " — some changes may have been saved; check the details and try again.") : ""}`);
    }
    finally { setBusy(null); }
  };

  const tabs = [["all", `All ${students.length}`], ["active", `Active ${active.length}`], ["paused", `Paused ${students.length - active.length}`], ...(attention.length ? [["attention", `Needs attention ${attention.length}`]] : [])] as [typeof view, string][];

  return (
    <div id="hub-students">
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div role="group" aria-label="Filter students" className="inline-flex max-w-full overflow-x-auto rounded-full border border-[var(--line)] bg-[var(--surface)] p-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map(([k, label]) => (
            <button key={k} type="button" aria-pressed={view === k} onClick={() => setView(k)}
              className={`min-h-[44px] lg:min-h-[40px] flex-none whitespace-nowrap rounded-full px-3.5 text-[12.5px] font-extrabold transition ${FOCUS} ${view === k ? "text-white" : "text-[var(--ink-2)] hover:text-[var(--ink)]"}`}
              style={view === k ? { background: "linear-gradient(180deg, var(--brand-2), var(--brand))" } : undefined}>{label}</button>
          ))}
        </div>
        {students.length > 5 && (
          <div className="relative min-w-[180px] flex-1 sm:max-w-[280px]">
            <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-2)]" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search students…" aria-label="Search students" className="!min-h-[44px] w-full !rounded-full !pl-9" />
          </div>
        )}
        {multiTutor && <ScopeToggle scope={scope} onChange={setScope} mine={mineCount} all={students.length} what="students" />}
        {canEdit && <Button variant="primary" className="ml-auto !h-[44px] !px-5" onClick={() => setEnrolOpen(true)}><Icon name="plus" size={16} /> Enrol a student</Button>}
      </div>

      {canEdit && <GroupsSection groups={groups} students={students} qs={qs} filterId={groupFilter} onFilter={setGroupFilter} onChanged={() => refreshGroups?.()} onError={onError} goTo={goTo} raw={insights.raw} loaded={insights.loaded} />}

      {activeGroup && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-[12.5px] font-semibold text-[var(--ink-2)]" role="status">
          Showing <GroupChip group={activeGroup} /> · {shown.length} of {students.length} students
          <button type="button" onClick={() => setGroupFilter(null)} className={`inline-flex min-h-[44px] items-center gap-1 rounded-full px-3 font-extrabold text-[var(--brand)] hover:bg-[var(--brand-soft)] ${FOCUS}`}><Icon name="close" size={13} /> Show everyone</button>
        </div>
      )}

      {flash && <div role="status" className="mb-3 flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-bold" style={{ background: "var(--green-soft)", borderColor: "var(--green-line)", color: "#0b6b3a" }}><Icon name="check" size={16} strokeWidth={2.6} /> {flash}</div>}

      {students.length === 0 ? (
        <EmptyState icon="users" title="No students enrolled yet" color="var(--violet)"
          body="Families only see My Classroom once you've enrolled their child. Enrol a student to give them your lessons, quizzes and live lessons — and choose which subjects they can see."
          action={canEdit ? <Button variant="primary" onClick={() => setEnrolOpen(true)}><Icon name="plus" size={15} /> Enrol your first student</Button> : undefined} />
      ) : shown.length === 0 ? (
        <EmptyState icon="search" title="No students match" body="Try a different filter or search." color="var(--violet)" action={<Button onClick={() => { setQ(""); setView("all"); setGroupFilter(null); }}>Clear filters</Button>} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {shown.map((s) => {
            const on = s.active !== false;
            const pending = busy === s.childId;
            const ins: Insight | undefined = insights.byChild.get(s.childId);
            const loading = !insights.loaded;
            const subs = s.subjects ?? [];
            return (
              <li key={s.childId} data-ui="card" aria-busy={pending}
                className={`hub-lift relative flex flex-col overflow-hidden rounded-2xl border border-[var(--line)] p-4 shadow-[var(--shadow-sm)] ${on ? "bg-[var(--surface)]" : "bg-[var(--panel)]"}`}>
                <div className="flex items-start gap-3">
                  <Avatar name={s.childName} size={46} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <h3 className="truncate text-[15.5px] font-extrabold text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{s.childName}</h3>
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide" style={on ? { background: "var(--green-soft)", color: "#0b6b3a" } : { background: "var(--gold-soft)", color: "#7a5300" }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: on ? "var(--green)" : "var(--gold)" }} />{on ? "Active" : "Paused"}
                      </span>
                    </div>
                    <div className="mt-1 text-[12.5px] font-semibold text-[var(--ink-2)]">
                      {loading ? <Skeleton className="inline-block h-3 w-28 align-middle" /> : seenAgo(ins?.lastActive ?? null, now)}
                    </div>
                    {((groupsOf.get(s.childId)?.length ?? 0) > 0 || s.yearGroup) && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {s.yearGroup && <span data-year-chip className="inline-flex items-center gap-1 rounded-full border px-2.5 py-[3px] text-[11px] font-extrabold" style={{ background: "var(--gold-soft)", borderColor: "var(--gold-line)", color: "var(--brand-ink)" }}><Icon name="compass" size={11} strokeWidth={2.2} />{s.yearGroup}</span>}
                        {(groupsOf.get(s.childId) ?? []).map((g) => <GroupChip key={g.id} group={g} />)}
                      </div>
                    )}
                    {tutors.length > 1 && <div data-testid="hub-student-tutor" className="mt-1 text-[11.5px] font-semibold text-[var(--ink-3)]">{s.tutorName ? `Tutor: ${s.tutorName}` : "No tutor assigned"}</div>}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {subs.length ? <>{subs.slice(0, 3).map((x) => <SubjectChip key={x} subject={x} />)}{subs.length > 3 && <span className="rounded-full bg-[var(--panel)] px-2.5 py-[3px] text-[11px] font-bold text-[var(--ink-2)]" title={subs.slice(3).join(", ")}>+{subs.length - 3}</span>}</> : <span className="rounded-full bg-[var(--panel)] px-2.5 py-[3px] text-[11px] font-bold text-[var(--ink-2)]">All subjects</span>}
                    </div>
                  </div>
                  <div className="flex flex-none flex-col items-center gap-1">
                    {loading ? <Skeleton className="h-[56px] w-[56px] !rounded-full" /> : <MiniRing pct={ins?.mastery ?? null} size={56} stroke={6} color={ringColour(ins?.mastery ?? null, config.masteryBands)} />}
                    <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Mastery</span>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2 border-t border-dashed border-[var(--line)] pt-2.5">
                  {loading ? <Skeleton className="h-6 w-40 !rounded-full" /> : (
                    <>
                      {ins?.nextLesson
                        ? <Badge tone={ins.nextLesson.live ? "green" : "brand"} icon="video">{ins.nextLesson.live ? "Live now" : `Next: ${nextWhen(ins.nextLesson.at, now)}`}</Badge>
                        : <span className="text-[12px] font-semibold text-[var(--ink-3)]">No lesson booked</span>}
                      {(ins?.overdue ?? 0) > 0 && <Badge tone="red" icon="warning">{ins!.overdue} overdue</Badge>}
                      {(ins?.toMark ?? 0) > 0 && <Badge tone="violet" icon="homework">{ins!.toMark} to mark</Badge>}
                    </>
                  )}
                  <span className="ml-auto flex flex-wrap items-center gap-1">
                    <button type="button" data-testid="hub-student-progress" onClick={() => openProgress(s)} className={`inline-flex min-h-[44px] lg:min-h-[40px] items-center gap-1 rounded-full border border-[var(--line)] px-3 text-[12px] font-extrabold text-[var(--brand)] hover:bg-[var(--brand-soft)] ${FOCUS}`} aria-label={`Open ${s.childName}'s progress`}>Progress <Icon name="chevronRight" size={13} /></button>
                    {canEdit && <button type="button" data-testid="hub-student-message" onClick={() => openMessage(s)} className={`inline-flex min-h-[44px] lg:min-h-[40px] items-center gap-1 rounded-full border border-[var(--line)] px-3 text-[12px] font-extrabold text-[var(--brand)] hover:bg-[var(--brand-soft)] ${FOCUS}`} aria-label={`Message ${s.childName}`}><Icon name="help" size={13} />Message</button>}
                    {canEdit && on && <button type="button" data-testid="hub-student-homework" onClick={() => setHomework(s)} className={`inline-flex min-h-[44px] lg:min-h-[40px] items-center gap-1 rounded-full border border-[var(--line)] px-3 text-[12px] font-extrabold text-[var(--brand)] hover:bg-[var(--brand-soft)] ${FOCUS}`} aria-label={`Set homework for ${s.childName}`}>Set homework</button>}
                  </span>
                  {canEdit && (
                    <span className="-mr-1.5">
                      <RowMenu label={`Actions for ${s.childName}`} roomy items={[
                        { label: "Edit details", icon: "edit", disabled: pending, onSelect: () => beginEdit(s) },
                        { label: on ? "Pause" : "Resume", icon: on ? "pause" : "play", disabled: pending, onSelect: () => act(s.childId, () => put(`/api/learning-hub/students/${s.childId}${qs}`, { active: !on }), "Couldn't update that student") },
                        { label: "Un-enrol", icon: "close", danger: true, confirmText: "Tap again to un-enrol", disabled: pending, onSelect: () => act(s.childId, () => del(`/api/learning-hub/students/${s.childId}${qs}`), "Couldn't un-enrol that student") },
                      ]} />
                    </span>
                  )}
                </div>
                {s.createdAt && <span className="sr-only">Enrolled {fmtDate(s.createdAt)}</span>}
              </li>
            );
          })}
        </ul>
      )}

      <EnrolModal open={enrolOpen} onClose={() => setEnrolOpen(false)} tenantId={tenantId} students={students} subjects={subjects} yearGroups={config.yearGroups} qs={qs} tutors={tutors} defaultTutor={defaultTutor} onError={onError}
        onDone={(name) => { setFlash(`${name} is enrolled — their family can open My Classroom now.`); refresh(); }} />

      <Modal open={!!editing} onClose={() => setEditing(null)} id="hub-subjects-modal" title={editing ? `Details for ${editing.childName}` : ""}
        footer={<><Button onClick={() => setEditing(null)} className="!h-[44px]">Cancel</Button><Button variant="primary" disabled={!!busy} onClick={saveDetails} className="!h-[44px]">Save</Button></>}>
        <div className="grid gap-5">
          <div>
            <h3 className="mb-2 text-[12px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-2)]">Subjects they can see</h3>
            <SubjectPicker subjects={subjects} value={chosen} onChange={setChosen} />
          </div>
          <YearGroupSelect id="hub-edit-year" value={editYear} onChange={setEditYear} options={config.yearGroups} autoNote={editing?.yearGroupAuto && editing.yearGroup ? `now ${editing.yearGroup}` : undefined} />
          <TutorSelect id="hub-edit-tutor" tutors={tutors} value={editTutor} onChange={setEditTutor} />
          {groups.length > 0 && (
            <div>
              <h3 className="mb-2 text-[12px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-2)]">Groups</h3>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Groups this student is in">
                {groups.map((g) => {
                  const on = editGroups.includes(g.id);
                  return (
                    <button key={g.id} type="button" aria-pressed={on} onClick={() => setEditGroups(on ? editGroups.filter((x) => x !== g.id) : [...editGroups, g.id])}
                      className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border px-3.5 text-[12.5px] font-extrabold transition ${FOCUS} ${on ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)]"}`}>
                      {on && <Icon name="check" size={13} strokeWidth={3} />}{g.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
