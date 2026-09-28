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
import { SupportSection } from "./SupportSection";
import { cleanSupport, isDefaultSupport, type SupportProfile } from "./support";
import { PlanNextWeek } from "./plan/PlanNextWeek";
import HowItWorksButton from "./howitworks/HowItWorksButton";
import { useI18n, useT } from "@/lib/i18n/provider";

// Students — the tutor's roster. A family only ever sees the Learning Hub for a
// child that has been enrolled here, so this is where access is granted, paused
// and narrowed to particular subjects. Candidates come from the same lookup the
// header's "Find a child" uses (children who've booked with, or joined, you).

export const meta: PanelMeta = { key: "students", label: "Students", icon: "users", status: "live", blurb: "Enrol children, choose which subjects they can see, and pause or remove access." };

interface Candidate { childId: string; name: string; parentName: string; parentEmail: string; postcode: string; town: string; ref: string; photo?: string; /** false = never booked with this provider (added by the family to their own account). */ booked?: boolean; /** The server's dob-derived default school year, when it can work one out. */ yearGroup?: string | null; suggestedYearGroup?: string | null }

const norm = (s: string) => s.toLowerCase();

/** Subject toggles — empty selection means "all subjects". */
function SubjectPicker({ subjects, value, onChange }: { subjects: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const t = useT();
  const all = value.length === 0;
  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t("hubshell.st_subjectsCanSee")}>
        <button type="button" aria-pressed={all} onClick={() => onChange([])}
          className={`min-h-[44px] lg:min-h-[40px] rounded-full border px-3.5 text-[12.5px] font-extrabold transition ${FOCUS} ${all ? "border-transparent text-white" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] hover:border-[var(--brand-2)]"}`}
          style={all ? { background: "linear-gradient(180deg, var(--brand-2), var(--brand))" } : undefined}>{t("hubshell.st_allSubjects")}</button>
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
        {subjects.length === 0 ? t("hubshell.st_noSubjectsYet") : all ? t("hubshell.st_seeEverySubject") : t("hubshell.st_onlySee", { list: value.join(", ") })}
      </p>
    </div>
  );
}

/** School year — optional; "Not set" clears it. Options come from the tenant's own list (Setup → Learning Hub). */
function YearGroupSelect({ value, onChange, options, id, autoNote }: { value: string; onChange: (v: string) => void; options: string[]; id: string; autoNote?: string }) {
  const t = useT();
  const list = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-2)]">{t("hubshell.st_yearGroup")}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="min-h-[46px] w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-[13.5px] font-semibold text-[var(--ink)] outline-none focus:border-[var(--brand)]">
        <option value="">{autoNote ? t("hubshell.st_yearAutoNote", { note: autoNote }) : t("hubshell.st_yearAuto")}</option>
        {list.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
      <p className="mt-1 text-[11.5px] text-[var(--ink-3)]">{t("hubshell.st_yearHelp")}</p>
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
  const t = useT();
  if (tutors.length < 2) return null;
  const list = value && !tutors.some((x) => x.uid === value) ? [{ uid: value, name: t("hubshell.st_formerTutor"), role: "", me: false }, ...tutors] : tutors;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-2)]">{t("hubshell.st_tutor")}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="min-h-[46px] w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-[13.5px] font-semibold text-[var(--ink)] outline-none focus:border-[var(--brand)]">
        <option value="">{t("hubshell.st_unassigned")}</option>
        {list.map((x) => <option key={x.uid} value={x.uid}>{x.me ? t("hubshell.st_nameYou", { name: x.name }) : x.name}</option>)}
      </select>
      <p className="mt-1 text-[11.5px] text-[var(--ink-3)]">{t("hubshell.st_tutorHelp")}</p>
    </div>
  );
}

interface InviteRow { id: string; token: string | null; status: "pending" | "claimed" | "expired" | "revoked"; forName: string; createdAt: string; childNames: string[] }

/** F13 — a link for a family who has never booked: they open it signed in to their parent account, choose which of their own
 *  children to enrol, and the enrolment is created (POST /family-invites). Nothing is emailed from here: copy the link and send it. */
function FamilyInvite({ qs, tutorUid }: { qs: string; tutorUid: string }) {
  const t = useT();
  const [rows, setRows] = useState<InviteRow[] | null>(null);
  const [forName, setForName] = useState("");
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const load = () => get<InviteRow[]>(`/api/learning-hub/family-invites${qs}`).then((r) => setRows(Array.isArray(r) ? r : [])).catch(() => setRows([]));
  useEffect(() => { void load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);
  const link = (tok: string) => `${window.location.origin}/custdash/learninghub?invite=${tok}`;
  const create = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await post<{ token: string }>(`/api/learning-hub/family-invites${qs}`, { forName: forName.trim(), ...(tutorUid ? { tutorUid } : {}) });
      const url = link(r.token);
      setMade(url); setForName(""); void load();
      // One click: the link is on the clipboard the moment it exists (falls back to the visible field + Copy button).
      try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { /* the field below still has it */ }
    } catch (e) { setErr(errMsg(e, t("hubshell.st_inviteCreateFail"))); }
    finally { setBusy(false); }
  };
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { window.prompt(t("hubshell.st_copyThisLink"), text); }
  };
  const revoke = async (id: string) => { try { await del(`/api/learning-hub/family-invites/${id}${qs}`); void load(); } catch (e) { setErr(errMsg(e, t("hubshell.st_inviteWithdrawFail"))); } };
  const recent = (rows ?? []).slice(0, 4);
  return (
    <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3" data-testid="hub-family-invite">
      <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-2)]">{t("hubshell.st_inviteTitle")}</div>
      <p className="mt-1 text-[12px] leading-snug text-[var(--ink-2)]">{t("hubshell.st_inviteBody")}</p>
      <form className="mt-2 flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (!busy) void create(); }}>
        <Input aria-label={t("hubshell.st_inviteForAria")} placeholder={t("hubshell.st_inviteForPh")} value={forName} onChange={(e) => setForName(e.target.value)} maxLength={120} className="!min-h-[44px] min-w-[180px] flex-1" />
        <Button sm variant="primary" type="submit" data-testid="hub-family-invite-create" disabled={busy} className="!h-[44px] !px-4">{busy ? t("hubshell.st_making") : t("hubshell.st_createInviteLink")}</Button>
      </form>
      {err && <p role="alert" className="mt-2 text-[12.5px] text-[var(--red)]">{err}</p>}
      {made && (
        <div className="mt-2 flex flex-wrap items-center gap-2" data-testid="hub-family-invite-link">
          {copied && <p role="status" className="w-full text-[12.5px] font-bold text-[var(--green)]">{t("hubshell.st_linkReady")}</p>}
          <input readOnly value={made} aria-label={t("hubshell.st_inviteLink")} onFocus={(e) => e.currentTarget.select()} className="min-h-[40px] min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 text-[12.5px] text-[var(--ink)]" />
          <Button sm className="!h-[44px] lg:!h-[40px] !px-4" onClick={() => void copy(made)}>{copied ? t("hubshell.st_copied") : t("hubshell.st_copyLink")}</Button>
        </div>
      )}
      {recent.length > 0 && (
        <ul className="mt-3 grid gap-1.5 text-[12.5px]" aria-label={t("hubshell.st_recentInvites")}>
          {recent.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 text-[var(--ink-2)]">
              <span className="font-bold text-[var(--ink)]">{r.forName || t("hubshell.st_invite")}</span>
              <span>{r.status === "claimed" ? (r.childNames.length ? t("hubshell.st_joinedNames", { names: r.childNames.join(", ") }) : t("hubshell.st_joined")) : r.status === "pending" ? t("hubshell.st_invWaiting") : r.status === "expired" ? t("hubshell.st_invExpired") : t("hubshell.st_invRevoked")}</span>
              {r.status === "pending" && r.token && <button type="button" className={`ms-auto min-h-[44px] rounded-full px-3 text-[12px] font-extrabold text-[var(--brand)] hover:bg-[var(--brand-soft)] ${FOCUS}`} onClick={() => void copy(link(r.token!))}>{t("hubshell.st_copyLink")}</button>}
              {r.status === "pending" && <button type="button" className={`min-h-[44px] rounded-full px-3 text-[12px] font-extrabold text-[var(--red)] hover:bg-[var(--red-soft)] ${FOCUS}`} onClick={() => void revoke(r.id)}>{t("hubshell.st_withdraw")}</button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EnrolModal({ open, onClose, tenantId, students, subjects, yearGroups, autoEnrol, onAuto, qs, tutors, defaultTutor, onDone, onError }: { open: boolean; onClose: () => void; tenantId: string; students: Student[]; subjects: string[]; yearGroups: string[]; autoEnrol: boolean; onAuto: (v: boolean) => void; qs: string; tutors: Tutor[]; defaultTutor: string; onDone: (name: string) => void; onError: (m: string) => void }) {
  const t = useT();
  const [list, setList] = useState<Candidate[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<Candidate | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [year, setYear] = useState("");
  const [tutor, setTutor] = useState(defaultTutor);
  const [support, setSupport] = useState<SupportProfile>(cleanSupport(null));
  const [busy, setBusy] = useState(false);
  const [auto, setAuto] = useState(autoEnrol);
  const [autoBusy, setAutoBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAuto(autoEnrol);
    setQ(""); setPick(null); setChosen([]); setYear(""); setTutor(defaultTutor); setSupport(cleanSupport(null)); setList(null); setFailed(false);
    get<Candidate[]>("/api/children/lookup").then(setList).catch(() => { setFailed(true); setList([]); });
  }, [open]);

  const byId = useMemo(() => new Map(students.map((s) => [s.childId, s])), [students]);
  const shown = useMemo(() => {
    const n = norm(q.trim());
    return (list ?? []).filter((c) => !n || [c.name, c.parentName, c.parentEmail, c.postcode, c.town, c.ref].some((f) => norm(f ?? "").includes(n)));
  }, [list, q]);

  // Auto-enrol on booking (settings.hub.autoEnrolOnBooking, server/src/lib/hubAutoEnrol.ts): saved straight from here, no need to open Setup.
  const toggleAuto = async () => {
    if (autoBusy) return;
    const next = !auto;
    setAutoBusy(true); setAuto(next);
    try { await put(`/api/learning-hub/config${qs}`, { hub: { autoEnrolOnBooking: next } }); onAuto(next); }
    catch (e) { setAuto(!next); onError(errMsg(e, t("hubshell.st_autoEnrolFail"))); }
    finally { setAutoBusy(false); }
  };

  const enrol = async () => {
    if (!pick) return;
    setBusy(true);
    try {
      await post(`/api/learning-hub/students${qs}`, { childId: pick.childId, subjects: chosen, ...(year ? { yearGroup: year } : {}), ...(tutors.length > 1 ? { tutorUid: tutor || null } : {}), ...(isDefaultSupport(support) ? {} : { support }) });
      onDone(pick.name);
      onClose();
    } catch (e) { onError(errMsg(e, t("hubshell.st_enrolFail"))); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} wide id="hub-enrol-modal" title={pick ? t("hubshell.st_enrolName", { name: pick.name }) : t("hubshell.st_enrolAStudent")}
      footer={pick ? (
        <>
          <Button onClick={() => setPick(null)} className="!h-[44px] lg:!h-[40px]"><Icon name="arrowLeft" size={14} /> {t("hubshell.st_back")}</Button>
          <Button variant="primary" disabled={busy} onClick={enrol} className="!h-[44px] lg:!h-[40px]">{busy ? t("hubshell.st_enrolling") : t("hubshell.st_enrolStudent")}</Button>
        </>
      ) : undefined}>
      {pick ? (
        <div>
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3">
            <Avatar name={pick.name} size={44} />
            <div className="min-w-0"><div className="truncate text-[14px] font-extrabold text-[var(--ink)]">{pick.name}</div><div className="truncate text-[12px] text-[var(--ink-2)]">{pick.parentName || pick.parentEmail}</div></div>
          </div>
          <h3 className="mb-2 text-[12px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-2)]">{t("hubshell.st_whichSubjects")}</h3>
          <SubjectPicker subjects={subjects} value={chosen} onChange={setChosen} />
          <div className="mt-4"><YearGroupSelect id="hub-enrol-year" value={year} onChange={setYear} options={yearGroups} /></div>
          {tutors.length > 1 && <div className="mt-4"><TutorSelect id="hub-enrol-tutor" tutors={tutors} value={tutor} onChange={setTutor} /></div>}
          <details className="mt-4 rounded-xl border border-[var(--line)] px-3 py-2" data-testid="hub-enrol-support-more"><summary className="cursor-pointer text-[13px] font-extrabold text-[var(--ink-2)]">{t("hubshell.st_supportOptional")}</summary><div className="mt-3"><SupportSection id="hub-enrol-support" value={support} onChange={setSupport} /></div></details>
          <p className="mt-4 rounded-xl border border-[var(--gold-line)] bg-[var(--gold-soft)] px-3.5 py-2.5 text-[12.5px] leading-snug text-[var(--ink)]">
            {t("hubshell.st_familyWillSee")}
          </p>
        </div>
      ) : (
        <div>
          <div className="relative">
            <Icon name="search" size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--ink-2)]" />
            <Input data-autofocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("hubshell.st_searchChildPh")} aria-label={t("hubshell.st_searchChildren")} className="!min-h-[46px] w-full !rounded-full !pl-9" />
          </div>
          <div className="mt-3" aria-live="polite">
            {list === null ? <SkeletonRows rows={3} label={t("hubshell.st_findingChildren")} /> : failed ? (
              <p role="alert" className="py-6 text-center text-[13px] text-[var(--red)]">{t("hubshell.st_loadChildrenFail")}</p>
            ) : shown.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-[13.5px] font-extrabold text-[var(--ink)]">{list.length === 0 ? t("hubshell.st_noChildren") : t("hubshell.st_noMatchSearch")}</p>
                <p className="mx-auto mt-1 max-w-[380px] text-[12.5px] leading-snug text-[var(--ink-2)]">{list.length === 0 ? t("hubshell.st_noChildrenBody") : t("hubshell.st_noMatchBody")}</p>
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
                        <div className="truncate text-[12px] text-[var(--ink-2)]">{[c.parentName, c.postcode || c.town].filter(Boolean).join(" · ") || c.parentEmail}{c.booked === false ? ` · ${t("hubshell.st_addedByFamily")}` : ""}</div>
                      </div>
                      {enrolled ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-extrabold" style={{ background: "var(--green-soft)", color: "#0b6b3a" }}><Icon name="check" size={13} strokeWidth={2.6} /> {t("hubshell.st_enrolled")}</span>
                      ) : (
                        <Button sm className="!h-[44px] lg:!h-[38px] !px-4" aria-label={t(cur ? "hubshell.st_resumeName" : "hubshell.st_enrolName", { name: c.name })} onClick={() => { setPick(c); setChosen(cur?.subjects ?? []); setYear(cur && !cur.yearGroupAuto ? cur.yearGroup ?? "" : ""); setSupport(cleanSupport(cur?.support)); if (cur) setTutor(cur.tutorUid ?? ""); }}>{cur ? t("hubshell.st_resume") : t("hubshell.st_enrol")}</Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="mt-3 rounded-xl border border-[var(--line)] px-3.5 py-2.5" data-testid="hub-enrol-auto">
            <p className="text-[12.5px] leading-snug text-[var(--ink-2)]">{t("hubshell.st_autoEnrolNote")}</p>
            <label className="mt-2 flex items-center justify-between gap-3 text-[13px] font-extrabold text-[var(--ink)]" htmlFor="hub-enrol-auto-switch">
              {t("hubshell.st_autoEnrolLabel")}
              <button type="button" role="switch" id="hub-enrol-auto-switch" aria-checked={auto} disabled={autoBusy} onClick={() => void toggleAuto()}
                className={`relative h-7 w-12 flex-none rounded-full border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)] disabled:opacity-60 ${auto ? "border-[var(--brand)] bg-[var(--brand)]" : "border-[var(--line)] bg-[var(--panel)]"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all motion-reduce:transition-none ${auto ? "start-[26px]" : "start-0.5"}`} />
              </button>
            </label>
          </div>
          <div className="mt-2 text-center"><HowItWorksButton variant="link" role="tutor" topic="families" scene="fam-ways" autoplay label={t("hubshell.st_howEnrolling")} /></div>
          <FamilyInvite qs={qs} tutorUid={defaultTutor} />
        </div>
      )}
    </Modal>
  );
}

/** A family who has never booked joins by opening the provider's public page while signed in to their parent account (or by
 *  signing up through it): that links them to the provider, and their children then appear in the enrol list above. */
function FamilyLink({ tenantId }: { tenantId: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/store/${tenantId}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { window.prompt(t("hubshell.st_copyThisLink"), url); }
  };
  return (
    <div className="mx-auto mt-4 max-w-[420px] rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3 text-start" data-testid="hub-family-link">
      <div className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-2)]">{t("hubshell.st_pageLinkTitle")}</div>
      <div className="mt-1.5 flex items-center gap-2">
        <input readOnly value={url} aria-label={t("hubshell.st_pageLink")} onFocus={(e) => e.currentTarget.select()} className="min-h-[40px] min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 text-[12.5px] text-[var(--ink)]" />
        <Button sm className="!h-[44px] lg:!h-[40px] !px-4" onClick={() => void copy()}>{copied ? t("hubshell.st_copied") : t("hubshell.st_copyLink")}</Button>
      </div>
      <p className="mt-2 text-[12px] leading-snug text-[var(--ink-2)]">{t("hubshell.st_pageLinkBody")}</p>
    </div>
  );
}

type Tr = (k: string, v?: Record<string, string | number>) => string;
const DAY = 86_400_000;
function nextWhen(t: Tr, loc: string, at: number, now: number): string {
  const clock = new Date(at).toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" });
  const d0 = new Date(now); d0.setHours(0, 0, 0, 0);
  const days = Math.floor((at - d0.getTime()) / DAY);
  if (days <= 0) return t("hubshell.st_todayAt", { time: clock });
  if (days === 1) return t("hubshell.st_tomorrowAt", { time: clock });
  if (days < 7) return `${new Date(at).toLocaleDateString(loc, { weekday: "short" })} ${clock}`;
  return `${new Date(at).toLocaleDateString(loc, { day: "numeric", month: "short" })}, ${clock}`;
}
function seenAgo(t: Tr, loc: string, at: number | null, now: number): string {
  if (!at) return t("hubshell.st_noActivity");
  const d = now - at;
  const rtf = new Intl.RelativeTimeFormat(loc, { numeric: "auto" });
  if (d < 3_600_000) return t("hubshell.st_lastSeen", { when: t("hubshell.st_justNow") });
  if (d < DAY) return t("hubshell.st_lastSeen", { when: rtf.format(-Math.round(d / 3_600_000), "hour") });
  const days = Math.floor(d / DAY);
  return t("hubshell.st_lastSeen", { when: days < 30 ? rtf.format(-days, "day") : new Date(at).toLocaleDateString(loc, { day: "numeric", month: "short" }) });
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

export function Panel({ students, topics, qs, onError, refreshStudents, canEdit: tutorMode, readOnly, tenantId, franchiseId, config, groups = [], refreshGroups, goTo, me }: PanelProps) {
  const canEdit = tutorMode && !readOnly; // a view-only role sees the roster but none of the write controls
  const subjects = useMemo(() => subjectsOf(topics), [topics]);
  const t = useT();
  const { locale } = useI18n();
  const [enrolOpen, setEnrolOpen] = useState(false);
  const [autoEnrol, setAutoEnrol] = useState(config.autoEnrolOnBooking === true);
  useEffect(() => { setAutoEnrol(config.autoEnrolOnBooking === true); }, [config.autoEnrolOnBooking]);
  const [editing, setEditing] = useState<Student | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [editYear, setEditYear] = useState("");
  const [editMoveUp, setEditMoveUp] = useState(true);
  const [editGroups, setEditGroups] = useState<string[]>([]);
  const [editTutor, setEditTutor] = useState("");
  const [editSupport, setEditSupport] = useState<SupportProfile>(cleanSupport(null));
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
  const beginEdit = (s: Student) => { setEditing(s); setEditTutor(s.tutorUid ?? ""); setChosen(s.subjects ?? []); setEditYear(s.yearGroupAuto ? "" : s.yearGroup ?? ""); setEditMoveUp(s.yearMoveUp ?? config.yearAutoAdvance !== false); setEditSupport(cleanSupport(s.support)); setEditGroups((groupsOf.get(s.childId) ?? []).map((g) => g.id)); };
  const saveDetails = async () => {
    if (!editing) return;
    setBusy(editing.childId);
    // Several writes (the student, then each group whose membership changed). If any one fails, put back what already went through
    // so the roster never ends up half-saved.
    const undo: (() => Promise<unknown>)[] = [];
    try {
      const prevYear = editing.yearGroupAuto ? { yearGroupAuto: true } : { yearGroup: editing.yearGroup ?? null };
      const tutorChanged = tutors.length > 1 && editTutor !== (editing.tutorUid ?? "");
      const wasMoveUp = editing.yearMoveUp ?? config.yearAutoAdvance !== false, moveChanged = editMoveUp !== wasMoveUp;
      await put(`/api/learning-hub/students/${editing.childId}${qs}`, { subjects: chosen, ...(editYear ? { yearGroup: editYear } : { yearGroupAuto: true }), ...(moveChanged ? { yearMoveUp: editMoveUp } : {}), ...(tutorChanged ? { tutorUid: editTutor || null } : {}), support: editSupport });
      undo.push(() => put(`/api/learning-hub/students/${editing.childId}${qs}`, { subjects: editing.subjects ?? [], ...prevYear, ...(moveChanged ? { yearMoveUp: wasMoveUp } : {}), support: cleanSupport(editing.support), ...(tutorChanged ? { tutorUid: editing.tutorUid ?? null } : {}) }));
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
      onError(`${errMsg(e, t("hubshell.st_saveFail"))}${undo.length ? (restored ? t("hubshell.st_nothingChanged") : t("hubshell.st_partialSaved")) : ""}`);
    }
    finally { setBusy(null); }
  };

  const tabs = [["all", t("hubshell.st_tabAll", { n: students.length })], ["active", t("hubshell.st_tabActive", { n: active.length })], ["paused", t("hubshell.st_tabPaused", { n: students.length - active.length })], ...(attention.length ? [["attention", t("hubshell.st_tabAttention", { n: attention.length })]] : [])] as [typeof view, string][];

  return (
    <div id="hub-students">
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div role="group" aria-label={t("hubshell.st_filterStudents")} className="inline-flex max-w-full overflow-x-auto rounded-full border border-[var(--line)] bg-[var(--surface)] p-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map(([k, label]) => (
            <button key={k} type="button" aria-pressed={view === k} onClick={() => setView(k)}
              className={`min-h-[44px] lg:min-h-[40px] flex-none whitespace-nowrap rounded-full px-3.5 text-[12.5px] font-extrabold transition ${FOCUS} ${view === k ? "text-white" : "text-[var(--ink-2)] hover:text-[var(--ink)]"}`}
              style={view === k ? { background: "linear-gradient(180deg, var(--brand-2), var(--brand))" } : undefined}>{label}</button>
          ))}
        </div>
        {students.length > 5 && (
          <div className="relative min-w-[180px] flex-1 sm:max-w-[280px]">
            <Icon name="search" size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--ink-2)]" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("hubshell.st_searchStudentsPh")} aria-label={t("hubshell.st_searchStudents")} className="!min-h-[44px] w-full !rounded-full !pl-9" />
          </div>
        )}
        {multiTutor && <ScopeToggle scope={scope} onChange={setScope} mine={mineCount} all={students.length} what="students" />}
        {canEdit && <Button variant="primary" className="ms-auto !h-[44px] !px-5" onClick={() => setEnrolOpen(true)}><Icon name="plus" size={16} /> {t("hubshell.st_enrolAStudent")}</Button>}
      </div>

      {canEdit && <GroupsSection groups={groups} students={students} qs={qs} filterId={groupFilter} onFilter={setGroupFilter} onChanged={() => refreshGroups?.()} onError={onError} goTo={goTo} raw={insights.raw} loaded={insights.loaded} />}

      {activeGroup && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-[12.5px] font-semibold text-[var(--ink-2)]" role="status">
          {t("hubshell.st_showing")} <GroupChip group={activeGroup} /> · {t("hubshell.st_showingCount", { n: shown.length, total: students.length })}
          <button type="button" onClick={() => setGroupFilter(null)} className={`inline-flex min-h-[44px] items-center gap-1 rounded-full px-3 font-extrabold text-[var(--brand)] hover:bg-[var(--brand-soft)] ${FOCUS}`}><Icon name="close" size={13} /> {t("hubshell.st_showEveryone")}</button>
        </div>
      )}

      {flash && <div role="status" className="mb-3 flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-bold" style={{ background: "var(--green-soft)", borderColor: "var(--green-line)", color: "#0b6b3a" }}><Icon name="check" size={16} strokeWidth={2.6} /> {flash}</div>}

      {students.length === 0 ? (
        <EmptyState icon="users" title={t("hubshell.st_emptyTitle")} color="var(--violet)"
          body={t("hubshell.st_emptyBody")}
          action={canEdit ? <Button variant="primary" onClick={() => setEnrolOpen(true)}><Icon name="plus" size={15} /> {t("hubshell.st_enrolFirst")}</Button> : undefined} />
      ) : shown.length === 0 ? (
        <EmptyState icon="search" title={t("hubshell.st_noMatchTitle")} body={t("hubshell.st_noMatchFilter")} color="var(--violet)" action={<Button onClick={() => { setQ(""); setView("all"); setGroupFilter(null); }}>{t("hubshell.st_clearFilters")}</Button>} />
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
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: on ? "var(--green)" : "var(--gold)" }} />{on ? t("hubshell.st_active") : t("hubshell.st_paused")}
                      </span>
                    </div>
                    <div className="mt-1 text-[12.5px] font-semibold text-[var(--ink-2)]">
                      {loading ? <Skeleton className="inline-block h-3 w-28 align-middle" /> : seenAgo(t, locale, ins?.lastActive ?? null, now)}
                    </div>
                    {((groupsOf.get(s.childId)?.length ?? 0) > 0 || s.yearGroup) && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {s.yearGroup && <span data-year-chip className="inline-flex items-center gap-1 rounded-full border px-2.5 py-[3px] text-[11px] font-extrabold" style={{ background: "var(--gold-soft)", borderColor: "var(--gold-line)", color: "var(--brand-ink)" }}><Icon name="compass" size={11} strokeWidth={2.2} />{s.yearGroup}</span>}
                        {s.mayHaveLeft && <span data-testid="hub-student-left" className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--panel)] px-2.5 py-[3px] text-[11px] font-extrabold text-[var(--ink-2)]">{t("hubshell.st_mayHaveLeft")}</span>}
                        {(groupsOf.get(s.childId) ?? []).map((g) => <GroupChip key={g.id} group={g} />)}
                      </div>
                    )}
                    {tutors.length > 1 && <div data-testid="hub-student-tutor" className="mt-1 text-[11.5px] font-semibold text-[var(--ink-3)]">{s.tutorName ? t("hubshell.st_tutorName", { name: s.tutorName }) : t("hubshell.st_noTutor")}</div>}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {subs.length ? <>{subs.slice(0, 3).map((x) => <SubjectChip key={x} subject={x} />)}{subs.length > 3 && <span className="rounded-full bg-[var(--panel)] px-2.5 py-[3px] text-[11px] font-bold text-[var(--ink-2)]" title={subs.slice(3).join(", ")}>+{subs.length - 3}</span>}</> : <span className="rounded-full bg-[var(--panel)] px-2.5 py-[3px] text-[11px] font-bold text-[var(--ink-2)]">{t("hubshell.st_allSubjects")}</span>}
                    </div>
                  </div>
                  <div className="flex flex-none flex-col items-center gap-1">
                    {loading ? <Skeleton className="h-[56px] w-[56px] !rounded-full" /> : <MiniRing pct={ins?.mastery ?? null} size={56} stroke={6} color={ringColour(ins?.mastery ?? null, config.masteryBands)} />}
                    <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{t("hubshell.st_mastery")}</span>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2 border-t border-dashed border-[var(--line)] pt-2.5">
                  {loading ? <Skeleton className="h-6 w-40 !rounded-full" /> : (
                    <>
                      {ins?.nextLesson
                        ? <Badge tone={ins.nextLesson.live ? "green" : "brand"} icon="video">{ins.nextLesson.live ? t("hubshell.st_liveNow") : t("hubshell.st_next", { when: nextWhen(t, locale, ins.nextLesson.at, now) })}</Badge>
                        : <span className="text-[12px] font-semibold text-[var(--ink-3)]">{t("hubshell.st_noLessonBooked")}</span>}
                      {(ins?.overdue ?? 0) > 0 && <Badge tone="red" icon="warning">{t("hubshell.st_nOverdue", { n: ins!.overdue })}</Badge>}
                      {(ins?.toMark ?? 0) > 0 && <Badge tone="violet" icon="homework">{t("hubshell.st_nToMark", { n: ins!.toMark })}</Badge>}
                    </>
                  )}
                  <span className="ms-auto flex flex-wrap items-center gap-1">
                    <button type="button" data-testid="hub-student-progress" onClick={() => openProgress(s)} className={`inline-flex min-h-[44px] lg:min-h-[40px] items-center gap-1 rounded-full border border-[var(--line)] px-3 text-[12px] font-extrabold text-[var(--brand)] hover:bg-[var(--brand-soft)] ${FOCUS}`} aria-label={t("hubshell.st_openProgress", { name: s.childName })}>{t("hubshell.st_progress")} <Icon name="chevronRight" size={13} /></button>
                    {canEdit && <button type="button" data-testid="hub-student-message" onClick={() => openMessage(s)} className={`inline-flex min-h-[44px] lg:min-h-[40px] items-center gap-1 rounded-full border border-[var(--line)] px-3 text-[12px] font-extrabold text-[var(--brand)] hover:bg-[var(--brand-soft)] ${FOCUS}`} aria-label={t("hubshell.st_messageName", { name: s.childName })}><Icon name="help" size={13} />{t("hubshell.st_message")}</button>}
                    {canEdit && on && <button type="button" data-testid="hub-student-homework" onClick={() => setHomework(s)} className={`inline-flex min-h-[44px] lg:min-h-[40px] items-center gap-1 rounded-full border border-[var(--line)] px-3 text-[12px] font-extrabold text-[var(--brand)] hover:bg-[var(--brand-soft)] ${FOCUS}`} aria-label={t("hubshell.st_setHwFor", { name: s.childName })}>{t("hubshell.st_setHomework")}</button>}
                    {canEdit && on && <PlanNextWeek target={{ childId: s.childId }} targetName={s.childName} qs={qs} testId="hub-student-plan" onDone={() => refreshStudents?.()} />}
                  </span>
                  {canEdit && (
                    <span className="-me-1.5">
                      <RowMenu label={t("hubshell.st_actionsFor", { name: s.childName })} roomy items={[
                        { label: t("hubshell.st_editDetails"), icon: "edit", disabled: pending, onSelect: () => beginEdit(s) },
                        { label: on ? t("hubshell.st_pause") : t("hubshell.st_resume"), icon: on ? "pause" : "play", disabled: pending, onSelect: () => act(s.childId, () => put(`/api/learning-hub/students/${s.childId}${qs}`, { active: !on }), t("hubshell.st_updateFail")) },
                        { label: t("hubshell.st_unenrol"), icon: "close", danger: true, confirmText: t("hubshell.st_unenrolConfirm"), disabled: pending, onSelect: () => act(s.childId, () => del(`/api/learning-hub/students/${s.childId}${qs}`), t("hubshell.st_unenrolFail")) },
                      ]} />
                    </span>
                  )}
                </div>
                {s.createdAt && <span className="sr-only">{t("hubshell.st_enrolledOn", { date: fmtDate(s.createdAt) })}</span>}
              </li>
            );
          })}
        </ul>
      )}

      <EnrolModal open={enrolOpen} onClose={() => setEnrolOpen(false)} tenantId={tenantId} students={students} subjects={subjects} yearGroups={config.yearGroups} autoEnrol={autoEnrol} onAuto={setAutoEnrol} qs={qs} tutors={tutors} defaultTutor={defaultTutor} onError={onError}
        onDone={(name) => { setFlash(t("hubshell.st_enrolledFlash", { name })); refresh(); }} />

      <Modal open={!!editing} onClose={() => setEditing(null)} id="hub-subjects-modal" title={editing ? t("hubshell.st_detailsFor", { name: editing.childName }) : ""}
        footer={<><Button onClick={() => setEditing(null)} className="!h-[44px]">{t("hubshell.st_cancel")}</Button><Button variant="primary" disabled={!!busy} onClick={saveDetails} className="!h-[44px]">{t("hubshell.st_save")}</Button></>}>
        <div className="grid gap-5">
          <div>
            <h3 className="mb-2 text-[12px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-2)]">{t("hubshell.st_subjectsTheyCanSee")}</h3>
            <SubjectPicker subjects={subjects} value={chosen} onChange={setChosen} />
          </div>
          <YearGroupSelect id="hub-edit-year" value={editYear} onChange={setEditYear} options={config.yearGroups} autoNote={editing?.yearGroupAuto && editing.yearGroup ? t("hubshell.st_yearNow", { year: editing.yearGroup }) : undefined} />
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3" htmlFor="hub-edit-moveup">
            <input id="hub-edit-moveup" data-testid="hub-edit-moveup" type="checkbox" checked={editMoveUp} onChange={(e) => setEditMoveUp(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--brand)]" />
            <span>
              <span className="block text-[13.5px] font-extrabold text-[var(--ink)]">{t("hubshell.st_moveUpLabel")}</span>
              <span className="mt-0.5 block text-[11.5px] text-[var(--ink-3)]">{editing?.mayHaveLeft ? t("hubshell.st_mayHaveLeftHint") : t("hubshell.st_moveUpHint")}</span>
            </span>
          </label>
          <TutorSelect id="hub-edit-tutor" tutors={tutors} value={editTutor} onChange={setEditTutor} />
          <SupportSection id="hub-edit-support" value={editSupport} onChange={setEditSupport} />
          {groups.length > 0 && (
            <div>
              <h3 className="mb-2 text-[12px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-2)]">{t("hubshell.st_groups")}</h3>
              <div className="flex flex-wrap gap-2" role="group" aria-label={t("hubshell.st_groupsIn")}>
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
