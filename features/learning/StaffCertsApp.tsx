"use client";

// Staff self-service — "My learning": a Certificates tab (upload & renew your own
// DBS, First Aid, etc.) plus an optional My-courses tab (assigned ActivityOS
// courses + progress). The manager verifies certificates in the Staff area. Demo
// store; real file storage + per-user identity are Amir's.
import { useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";
import { LIGHT_PALETTE, PageHero, CollapsibleStats } from "@/components/OperatorPage";
import { useCredentials, credStatus, CRED_TONE, CredEditor, blankRecord, openCredFile, appliesTo, daysUntil, type CredRecord, type CredType, type CredStatus } from "./credentials";
import { syncLearning, useLearnRefresh, recordCompletion, completionsFor, downloadCourseCertificate, courseInDate, courseExpiry, rolesCover, withoutDemoAssignments } from "./courseCompletions";
import { useSettings } from "@/lib/settings";
import { CATEGORIES, CAT_BY_KEY, catOf, metaOf, isPlatform, CourseCover, type CatKey } from "./courseMeta";
import { SEED_LIBRARY, type CourseDoc } from "./courseContent";
import { CoursePlayer } from "./CoursePlayer";
import { useI18n } from "@/lib/i18n/provider";
import { get as apiGet, isDemoMode } from "@/lib/api";

// Same as credentials' fmtDate, in the reader's language.
const fmtDate = (s?: string, locale = "en-GB") => { if (!s) return "—"; const d = new Date(s + "T00:00:00"); return isNaN(d.getTime()) ? s : d.toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" }); };
// Display labels (the stored values stay English).
const CRED_KEY: Record<CredStatus, string> = { Valid: "staffp.certStValid", Expiring: "staffp.certStExpiring", Expired: "staffp.certStExpired", Pending: "staffp.certStPending", Rejected: "staffp.certStRejected", Missing: "staffp.certStMissing" };
const CAT_KEY: Record<CatKey, string> = { saf: "staffp.certCatSaf", inclusion: "staffp.certCatInclusion", send: "staffp.certCatSend", medical: "staffp.certCatMedical", health: "staffp.certCatHealth", digital: "staffp.certCatDigital", together: "staffp.certCatTogether" };
const LEVEL_KEY: Record<string, string> = { Intro: "staffp.certLvIntro", Core: "staffp.certLvCore", Advanced: "staffp.certLvAdvanced" };
// credentials' CredBadge, with the status label passed in (translated)
const CredBadge = ({ s, label }: { s: CredStatus; label: string }) => <span className={"inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold " + CRED_TONE[s]}>{label}</span>;

const SEED = [
  { name: "Marcus Bell", dbs: "Valid", pfa: "Expiring" }, { name: "Jess Patel", dbs: "Valid", pfa: "Valid" },
  { name: "Aisha Rahman", dbs: "Valid", pfa: "Expired" }, { name: "Tom Lewis", dbs: "Valid", pfa: "Valid" },
  { name: "Priya Khan", dbs: "Pending", pfa: "Valid" }, { name: "Dan Reed", dbs: "Valid", pfa: "Valid" },
];
// The demo person only in demo mode — a real member of staff is who they
// signed in as (/api/me), or their uploads land against someone else.
const DEMO_ME = { name: "Marcus Bell", role: "Lead" };

interface Asn { course: string; kind: "all" | "roles" | "staff"; roles: string[]; staff: string[]; due: string; required: boolean }
// My role against the assignment's roles — "Lead / manager" used to match every role.
const roleMatch = (roles: string[], myRole: string) => rolesCover(roles, myRole);

export function StaffCertsApp() {
  const { t, locale: appLocale } = useI18n();
  const locale = appLocale === "en" ? "en-GB" : appLocale; // for dates — plain "en" formats US-style
  const { settings } = useSettings();
  const cred = useCredentials(SEED);
  const [me, setMe] = useState(() => (isDemoMode() ? DEMO_ME : { name: "", role: "" }));
  useEffect(() => { if (!isDemoMode()) apiGet<{ name?: string; email?: string | null; jobTitle?: string | null }>("/api/me").then((m) => setMe({ name: (m.name || m.email || "").trim(), role: m.jobTitle || "" })).catch(() => {}); }, []);
  const ME = me.name;
  const ME_ROLE = me.role;
  // Assignments + completions come from the server (courseCompletions.syncLearning).
  useLearnRefresh();
  const [view, setView] = useState<"certs" | "courses">("certs");
  const [catFilter, setCatFilter] = useState<"all" | CatKey>("all");
  const [edit, setEdit] = useState<CredRecord | null>(null);
  const [player, setPlayer] = useState<CourseDoc | null>(null);
  const [asns, setAsns] = useState<Asn[]>([]);
  const [progress, setProgress] = useState<Record<string, { pct: number; passed: boolean }>>({});
  const [courses, setCourses] = useState<CourseDoc[]>(SEED_LIBRARY);
  useEffect(() => { void syncLearning().then(() => { try { const x = JSON.parse(localStorage.getItem("aos.learn.lcm.v2") || "null"); if (x?.assignments) setAsns(withoutDemoAssignments(x.assignments)); } catch { /* ignore */ } }); }, []);
  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem("aos.learn.lcm.v2") || "null"); if (s?.assignments) setAsns(withoutDemoAssignments(s.assignments)); } catch { /* ignore */ }
    try { const c = JSON.parse(localStorage.getItem("aos.learn.courses.v10") || "null"); if (Array.isArray(c) && c.length) setCourses(c); } catch { /* ignore */ }
  }, []);
  useEffect(() => { try { setProgress(JSON.parse(localStorage.getItem("aos.learn.progress.v1") || "{}")); } catch { /* ignore */ } }, [player]);
  // mirror any newly-passed course into the per-staff completion store the manager reads
  useEffect(() => {
    if (!ME) return;
    const doneIds = new Set(completionsFor(ME).map((d) => d.courseId));
    Object.entries(progress).forEach(([id, p]) => {
      if (p?.passed && !doneIds.has(id)) { const c = courses.find((x) => x.id === id); recordCompletion(ME, { courseId: id, title: c?.title || id, score: p.pct || 100, date: new Date().toISOString().slice(0, 10) }); }
    });
  }, [progress, courses, ME]);

  const mine = (typeId: string) => cred.recordFor(ME, typeId);
  const shownTypes = cred.types.filter((ct) => appliesTo(ct, ME, ME_ROLE) || mine(ct.id));
  // compulsory for me (set by the provider in Setup) vs anything else I hold
  const requiredTypes = cred.types.filter((ct) => ct.required && appliesTo(ct, ME, ME_ROLE));
  const requiredShown = shownTypes.filter((ct) => ct.required && appliesTo(ct, ME, ME_ROLE));
  const optionalShown = shownTypes.filter((ct) => !(ct.required && appliesTo(ct, ME, ME_ROLE)));
  // things that actually need the STAFF to act (upload / renew / re-upload) — NOT "Pending" (that's just awaiting the manager's approval)
  const needAction = requiredShown.filter((ct) => ["Missing", "Expired", "Rejected"].includes(credStatus(mine(ct.id))));
  const awaitingApproval = requiredShown.filter((ct) => credStatus(mine(ct.id)) === "Pending");
  const validReq = requiredTypes.filter((ct) => credStatus(mine(ct.id)) === "Valid").length;
  const pct = requiredTypes.length ? Math.round((validReq / requiredTypes.length) * 100) : 100;

  const certCard = (ct: CredType) => {
    const r = mine(ct.id); const st = credStatus(r); const dl = daysUntil(r?.expiry);
    return (
      <Card key={ct.id} className="p-3.5">
        <div className="mb-1.5 flex items-center gap-2">
          {r?.fileData ? <button type="button" onClick={() => openCredFile(r.fileData)} title={t("staffp.certViewUploaded")} className="text-[13.5px] font-extrabold text-[#1d3a8f] hover:underline">{ct.name} 📎</button> : <span className="text-[13.5px] font-extrabold text-[var(--ink)]">{ct.name}</span>}
          {ct.required && appliesTo(ct, ME, ME_ROLE) ? <span className="rounded-full bg-[#fdecec] px-2 py-0.5 text-[10px] font-bold text-[#c0392b]">{t("staffp.certRequired")}</span> : <span className="rounded-full bg-[#eef1f6] px-2 py-0.5 text-[10px] font-bold text-[#64748b]">{t("staffp.certOptional")}</span>}
          <span className="ml-auto"><CredBadge s={st} label={t(CRED_KEY[st])} /></span>
        </div>
        {r ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[var(--ink-3)]">
            <span>{t("staffp.certIssued")} <b className="text-[var(--ink-2)]">{fmtDate(r.issue, locale)}</b></span>
            <span>{t("staffp.certExpires")} <b className="text-[var(--ink-2)]">{fmtDate(r.expiry, locale)}</b>{dl != null && dl >= 0 && dl <= 60 ? <span className="font-bold text-[#b45309]"> · {t("staffp.certDaysLeft", { n: dl })}</span> : null}{dl != null && dl < 0 ? <span className="font-bold text-[#c0392b]"> · {t("staffp.certExpiredLower")}</span> : null}</span>
            {r.verified === "pending" && <span className="font-semibold text-[#1d54c4]">{t("staffp.certAwaitingVerif")}</span>}
            {r.verified === "rejected" && <span className="font-semibold text-[#c0392b]">{t("staffp.certRejectedReupload")}</span>}
          </div>
        ) : <div className="text-[12px] font-semibold text-[#c0392b]">{ct.required && appliesTo(ct, ME, ME_ROLE) ? t("staffp.certReqNotUploaded") : t("staffp.certNotUploaded")}</div>}
        <div className="mt-2.5 flex flex-wrap gap-2">
          {r?.fileData && <Button onClick={() => openCredFile(r.fileData)}>{t("staffp.certView")}</Button>}
          <Button variant={r ? undefined : "primary"} onClick={() => setEdit(r ?? blankRecord(ME, ct.id))}>{r ? (st === "Expiring" || st === "Expired" ? t("staffp.certRenew") : t("staffp.certUpdate")) : t("staffp.certUpload")}</Button>
        </div>
      </Card>
    );
  };

  // courses assigned to me (all-staff, my role, or by name)
  const myCourses = asns.filter((a) => a.kind === "all" || (a.kind === "roles" && roleMatch(a.roles, ME_ROLE)) || (a.kind === "staff" && a.staff.includes(ME)))
    .map((a) => ({ a, c: courses.find((x) => x.id === a.course) })).filter((x): x is { a: Asn; c: CourseDoc } => !!x.c)
    // A franchise's staff get head office's assignments too — one card per
    // course, required if either list says so.
    .reduce<{ a: Asn; c: CourseDoc }[]>((out, x) => { const i = out.findIndex((y) => y.c.id === x.c.id); if (i < 0) out.push(x); else if (x.a.required && !out[i].a.required) out[i] = x; return out; }, []);

  const courseCard = (c: CourseDoc, o: { required?: boolean; due?: string }) => {
    const cat = CAT_BY_KEY[catOf(c)] ?? CATEGORIES[0]; const m = metaOf(c.id);
    const catLabel = !isPlatform(c.id) && c.category ? c.category : t(CAT_KEY[cat.key]);
    const p = progress[c.id]; const state = p?.passed ? t("staffp.certCourseComplete") : p && p.pct > 0 ? t("staffp.certCourseInProgress") : t("staffp.certCourseNotStarted");
    const mins = c.lessons.reduce((n, l) => n + l.mins, 0); const lessons = c.lessons.length; const hasQuiz = !!(c.quiz?.length || c.quizzes?.length);
    return (
      <Card key={c.id} className="overflow-hidden p-0">
        <div className="h-1.5 w-full" style={{ background: cat.grad }} />
        <div className="flex gap-3 p-3.5">
          <CourseCover cover={c.cover} catKey={catOf(c)} size={50} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5"><span className="text-[13.5px] font-extrabold text-[var(--ink)]">{c.title}</span>{o.required ? <span className="rounded-full bg-[#fdecec] px-2 py-0.5 text-[9.5px] font-extrabold uppercase text-[#c0392b]">{t("staffp.certRequired")}</span> : <span className="rounded-full bg-[#eef1f6] px-2 py-0.5 text-[9.5px] font-extrabold uppercase text-[#64748b]">{t("staffp.certOptional")}</span>}{p?.passed && <span className="rounded-full bg-[#e6f4ea] px-2 py-0.5 text-[9.5px] font-extrabold text-[#0f7a43]">{t("staffp.certDone")}</span>}</div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full px-2 py-0.5 text-[10px] font-extrabold" style={{ background: cat.soft, color: cat.ink }}>{cat.icon} {catLabel}</span>
              <span className="rounded-full bg-[var(--panel)] px-2 py-0.5 text-[10px] font-bold text-[var(--ink-3)]">{LEVEL_KEY[m.level] ? t(LEVEL_KEY[m.level]) : m.level}</span>
              {m.tags.slice(0, 2).map((tg) => <span key={tg} className="rounded-full bg-[var(--panel)] px-2 py-0.5 text-[10px] font-semibold text-[var(--ink-3)]">{tg}</span>)}
            </div>
            <div className="mt-1.5 text-[11.5px] text-[var(--ink-3)]">{t("staffp.certMins", { n: mins })} · {t(lessons > 1 ? "staffp.certLessonMany" : "staffp.certLessonOne", { n: lessons })}{hasQuiz ? ` · ${t("staffp.certQuiz")}` : ""}{o.due && o.due !== "—" ? ` · ${t("staffp.certDue", { date: o.due })}` : ""} · {state}{p?.passed && p.pct ? ` · ${t("staffp.certScored", { n: p.pct })}` : ""}</div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--panel)]"><div className="h-full rounded-full transition-all" style={{ width: `${p?.pct ?? 0}%`, background: cat.grad }} /></div>
            <div className="mt-2.5"><button type="button" onClick={() => setPlayer(c)} className="rounded-full px-4 py-1.5 text-[12.5px] font-extrabold text-white shadow-sm hover:brightness-110" style={{ background: cat.grad }}>{p?.passed ? t("staffp.certReview") : p && p.pct > 0 ? t("staffp.certContinue") : t("staffp.certStart")}</button></div>
          </div>
        </div>
      </Card>
    );
  };

  if (player) return <CoursePlayer course={player} onClose={() => setPlayer(null)} />;

  return (
    <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={LIGHT_PALETTE}>
      <PageHero title={t("staffp.certTitle")} icon="🎖" lede={t("staffp.certLede")} />

      <div className="mb-3 inline-flex gap-0.5 rounded-full border border-[var(--line)] bg-[var(--panel)] p-0.5">
        {([["certs", t("staffp.certTabCerts")], ["courses", `${t("staffp.certTabCourses")}${myCourses.length ? ` (${myCourses.length})` : ""}`]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setView(k)} className={"rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition-colors " + (view === k ? "bg-white text-[#1d3a8f] shadow-sm" : "text-[var(--ink-3)] hover:text-[var(--ink-2)]")}>{l}</button>
        ))}
      </div>

      {view === "certs" && (<>
        <Card className="mb-3 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div><div className="text-[11px] font-extrabold uppercase tracking-wide text-[#1d3a8f]">{t("staffp.certCompliance")}</div><div className="text-[13px] text-[var(--ink-3)]">{t(requiredTypes.length === 1 ? "staffp.certValidOfOne" : "staffp.certValidOfMany", { a: validReq, b: requiredTypes.length })}</div></div>
            <div className="min-w-[140px] flex-1"><div className="h-2 overflow-hidden rounded-full bg-[var(--panel)]"><div className={"h-full rounded-full transition-all " + (pct === 100 ? "bg-[#0f9d58]" : "bg-[#b45309]")} style={{ width: `${pct}%` }} /></div></div>
            <span className="text-[15px] font-extrabold tabular-nums text-[var(--ink)]">{pct}%</span>
          </div>
          {needAction.length > 0 && (
            <div className="mt-3 rounded-xl border border-[#f3cfa6] bg-[#fdf3e0] px-3.5 py-2.5">
              <div className="text-[12.5px] font-extrabold text-[#8a4b09]">⚠ {t(needAction.length === 1 ? "staffp.certNeedActionOne" : "staffp.certNeedActionMany", { n: needAction.length })}</div>
              <div className="mt-0.5 text-[12px] text-[#8a4b09]">{t("staffp.certNeedList", { list: needAction.map((ct) => `${ct.name} (${t(CRED_KEY[credStatus(mine(ct.id))])})`).join(" · ") })}</div>
            </div>
          )}
          {awaitingApproval.length > 0 && (
            <div className="mt-2 rounded-xl border border-[#cfe0f5] bg-[#eef4ff] px-3.5 py-2.5">
              <div className="text-[12.5px] font-extrabold text-[#1d54c4]">⏳ {t("staffp.certAwaitingMgr", { n: awaitingApproval.length })}</div>
              <div className="mt-0.5 text-[12px] text-[#1d54c4]">{t("staffp.certAwaitingList", { list: awaitingApproval.map((ct) => ct.name).join(" · ") })}</div>
            </div>
          )}
        </Card>

        <div className="mb-1.5 flex items-center gap-2">
          <h3 className="text-[13px] font-extrabold uppercase tracking-wide text-[var(--ink-2)]">{t("staffp.certRequiredByProvider")}</h3>
          <span className="rounded-full bg-[#fdecec] px-2 py-0.5 text-[10px] font-bold text-[#c0392b]">{t("staffp.certCompulsoryRole")}</span>
        </div>
        {requiredShown.length ? (
          <div className="grid gap-2.5 sm:grid-cols-2">{requiredShown.map(certCard)}</div>
        ) : <Card className="p-4 text-center text-[12.5px] text-[var(--ink-3)]">{t("staffp.certNoCompulsory")}</Card>}

        {optionalShown.length > 0 && (<>
          <h3 className="mb-1.5 mt-4 text-[13px] font-extrabold uppercase tracking-wide text-[var(--ink-2)]">{t("staffp.certOtherCreds")}</h3>
          <div className="grid gap-2.5 sm:grid-cols-2">{optionalShown.map(certCard)}</div>
        </>)}

        {(() => { const myCourseCerts = completionsFor(ME); return myCourseCerts.length > 0 && (<>
          <div className="mb-1.5 mt-4 flex items-center gap-2"><h3 className="text-[13px] font-extrabold uppercase tracking-wide text-[var(--ink-2)]">{t("staffp.certCourseCerts")}</h3><span className="rounded-full bg-[#e6f4ea] px-2 py-0.5 text-[10px] font-bold text-[#0f7a43]">{t("staffp.certEarned")}</span></div>
          <div className="grid gap-2.5 sm:grid-cols-2">{myCourseCerts.map((d) => { const exp = courseExpiry(d, settings); const ok = courseInDate(d, settings); return (
            <Card key={d.courseId} className="p-3.5">
              <div className="mb-1 flex items-center gap-2"><span className="text-[13.5px] font-extrabold text-[var(--ink)]">{d.title}</span>{ok ? <span className="rounded-full bg-[#e6f4ea] px-2 py-0.5 text-[10px] font-bold text-[#0f7a43]">{t("staffp.certInDate")}</span> : <span className="rounded-full bg-[#fdecec] px-2 py-0.5 text-[10px] font-bold text-[#c0392b]">{t("staffp.certStExpired")}</span>}</div>
              <div className="mb-2 text-[12px] text-[var(--ink-3)]">{d.score}% · {t("staffp.certCompleted", { date: fmtDate(d.date, locale) })}{exp ? ` · ${t("staffp.certExpiresOn", { date: fmtDate(exp.toISOString().slice(0, 10), locale) })}` : ` · ${t("staffp.certNoExpiry")}`}</div>
              <Button onClick={() => downloadCourseCertificate(ME, d, settings)}>{t("staffp.certDownload")}</Button>
            </Card>
          ); })}</div>
        </>); })()}

        <p className="mt-3 text-[11.5px] text-[var(--ink-3)]">{t("staffp.certFooterCerts")}</p>
      </>)}

      {view === "courses" && (() => {
        const requiredList = myCourses.filter((x) => x.a.required);
        const reqIds = new Set(requiredList.map((x) => x.c.id));
        const otherCourses = courses.filter((c) => !reqIds.has(c.id)); // everything else in the library — optional
        const myDone = completionsFor(ME);
        const myAvg = myDone.length ? Math.round(myDone.reduce((n, d) => n + d.score, 0) / myDone.length) : null;
        const teamScores = SEED.flatMap((s) => completionsFor(s.name).map((d) => d.score));
        const teamAvg = teamScores.length ? Math.round(teamScores.reduce((a, b) => a + b, 0) / teamScores.length) : null;
        const availCats = Array.from(new Set(otherCourses.map((c) => catOf(c))));
        const otherFiltered = catFilter === "all" ? otherCourses : otherCourses.filter((c) => catOf(c) === catFilter);
        return (<>
          <CollapsibleStats id="staff-certs">
          <div className="grid grid-cols-3 gap-3">
            {([[t("staffp.certStatCompleted"), String(myDone.length), t("staffp.certStatAllTime")], [t("staffp.certStatMyAvg"), myAvg == null ? "—" : `${myAvg}%`, t("staffp.certStatAcross")], [t("staffp.certStatTeamAvg"), teamAvg == null ? "—" : `${teamAvg}%`, t("staffp.certStatEveryone")]] as const).map(([label, value, sub]) => (
              <div key={label} className="rounded-2xl border border-[var(--line)] bg-white p-3.5 text-center sm:text-left">
                <div className="text-[10px] font-bold uppercase tracking-wide text-[var(--ink-3)]">{label}</div>
                <div className="mt-0.5 text-[22px] font-extrabold tabular-nums text-[var(--ink)]">{value}</div>
                <div className="text-[10px] text-[var(--ink-3)]">{sub}</div>
              </div>
            ))}
          </div>
          </CollapsibleStats>

          <div className="mb-1.5 flex items-center gap-2">
            <h3 className="text-[13px] font-extrabold uppercase tracking-wide text-[var(--ink-2)]">{t("staffp.certNeedComplete")}</h3>
            {requiredList.length > 0 && <span className="rounded-full bg-[#fdecec] px-2 py-0.5 text-[10px] font-bold text-[#c0392b]">{t("staffp.certToDo", { n: requiredList.filter((x) => !progress[x.c.id]?.passed).length })}</span>}
          </div>
          {requiredList.length ? (
            <div className="grid gap-2.5 sm:grid-cols-2">{requiredList.map(({ a, c }) => courseCard(c, { required: true, due: a.due }))}</div>
          ) : <Card className="p-4 text-center text-[12.5px] text-[var(--ink-3)]">{t("staffp.certUpToDate")}</Card>}

          <h3 className="mb-1.5 mt-4 text-[13px] font-extrabold uppercase tracking-wide text-[var(--ink-2)]">{t("staffp.certOtherCourses")}</h3>
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setCatFilter("all")} className={"rounded-full px-3 py-1 text-[11.5px] font-bold " + (catFilter === "all" ? "bg-[#1d3a8f] text-white" : "border border-[var(--line)] bg-white text-[var(--ink-2)]")}>{t("staffp.certAll")}</button>
            {availCats.map((k) => { const cc = CAT_BY_KEY[k]; const on = catFilter === k; return (
              <button key={k} type="button" onClick={() => setCatFilter(k)} className={"rounded-full px-3 py-1 text-[11.5px] font-bold " + (on ? "text-white" : "border border-[var(--line)] bg-white text-[var(--ink-2)]")} style={on ? { background: cc.grad } : undefined}>{cc.icon} {t(CAT_KEY[cc.key])}</button>
            ); })}
          </div>
          {otherFiltered.length ? (
            <div className="grid gap-2.5 sm:grid-cols-2">{otherFiltered.map((c) => courseCard(c, { required: false }))}</div>
          ) : <Card className="p-4 text-center text-[12.5px] text-[var(--ink-3)]">{t("staffp.certNoInCat")}</Card>}
          <p className="mt-3 text-[11.5px] text-[var(--ink-3)]">{t("staffp.certFooterCourses")}</p>
        </>);
      })()}

      {edit && <CredEditor rec={edit} types={cred.types} lockStaff onSave={(x) => { cred.upsertRecord(x); setEdit(null); }} onClose={() => setEdit(null)} />}
    </div>
  );
}
