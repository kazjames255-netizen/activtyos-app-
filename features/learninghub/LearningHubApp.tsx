"use client";

import { hubName } from "./names";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HubHero } from "./HubHero";
import { CallProvider } from "./live/CallProvider";
import { HubTabs, type HubTab } from "./HubTabs";
import { ComingSoon, EmptyState, ErrorBanner, FOCUS, HubStyles, Icon, Skeleton, SkeletonRows } from "./kit";
import { NotesPanel } from "./NotesPanel";
import { NOTES_META, PANEL_MODULES, STUDENTS_MODULE, TAB_ORDER } from "./panels";
import type { PanelMeta, PanelProps } from "./panelTypes";
import { TopicFilter } from "./TopicFilter";
import { useHubData, useLiveNow } from "./useHubData";
import { coveredTopicIds, type HubFilter } from "./types";
import { FamilyBar, FamilyProvider, type FamilyCtx } from "./family/FamilyContext";
import { KID_TABS, KID_TAB_LABEL, KidBar, readKid, useKidGuards, writeKid } from "./family/KidMode";
import { setLinkParams, useLinkSearch } from "./family/link";
import { FamilyInviteClaim } from "./family/FamilyInviteClaim";
import { useRealtime } from "@/lib/realtime";
import { listDoubts } from "./lesson/doubts/api";

// Learning Hub — the tutoring vertical's page. One shell, two audiences: a
// family sees their tutor's hub read-only for the chosen child; the tutor sees
// the same page with authoring switched on plus a Students roster.
//
// Live lessons is the headline function: first tab, default tab. Panels not
// built yet stay visible as a "Coming soon" preview (never hidden). The
// subject/topic sidebar drives every panel.
//
// Nothing here touches booking, invoicing or scheduling.

type TabKey = PanelMeta["key"];
type TabModule = { meta: PanelMeta; Panel: ComponentType<PanelProps> | null };
const NONE: HubFilter = { subject: null, topicId: null };

export function LearningHubApp({ mode }: { mode: "student" | "tutor" }) {
  const hub = useHubData(mode);
  const { providers, provider, tenantId, qs, childQs, ready, topics, noteStats, notesVersion, students, groups, config, error, setError, refresh } = hub;
  const [filter, setFilter] = useState<HubFilter>(NONE);
  // The active tab lives in the URL (?tab=quizzes) so a reload or Back doesn't drop you on Home mid-task.
  const [picked, setPicked] = useState<TabKey | null>(() => (typeof window === "undefined" ? null : (new URLSearchParams(window.location.search).get("tab") as TabKey | null)));
  const [dirty, setDirty] = useState(false);
  const [addSignal, setAddSignal] = useState(0);
  // Focus mode is stored AS the tab that asked for it, so it can never outlive
  // that tab: switching tab (or the panel unmounting) ends it by construction.
  const [focusFor, setFocusFor] = useState<TabKey | null>(null);
  const [focusBare, setFocusBare] = useState(false);
  const pathname = usePathname() ?? "";
  const linkSearch = useLinkSearch();
  // Kid mode ("Hand over to Ava"): stored per browser session so a refresh stays in it. Only valid for a child of the current provider.
  const [kidRaw, setKidRaw] = useState(() => (typeof window === "undefined" ? null : readKid()));

  const tutor = mode === "tutor";
  // `canEdit` = TUTOR MODE (author / mark / roster screens). A staff member whose role can only VIEW the hub is still in tutor
  // mode — `readOnly` hides the write controls — otherwise they would be handed a family's screens with no child to look at.
  const canEdit = tutor;
  const readOnly = tutor && !!provider && !provider.canEdit;
  const kidChildId = !tutor && kidRaw && kidRaw.t === tenantId && hub.children.some((c) => c.childId === kidRaw.c) ? kidRaw.c : null;
  const kid = kidChildId !== null;
  // Kid mode is scoped to ONE child: the hub is forced onto them (there is no picker to change it), and a stale / foreign stored
  // mode (another provider, a child that was removed) is dropped rather than half-applied.
  useEffect(() => { if (kidChildId && hub.childId !== kidChildId) hub.setChildId(kidChildId); }, [kidChildId, hub.childId, hub.setChildId]);
  useEffect(() => { if (kidRaw && !kidChildId && tenantId && hub.providers && hub.providers.length) { writeKid(null); setKidRaw(null); } }, [kidRaw, kidChildId, tenantId, hub.providers]);
  useKidGuards(kid);
  // A family's chosen child rides in the URL (once it was chosen on purpose) so a refresh / shared link keeps it.
  useEffect(() => { if (!tutor && hub.childId && hub.childConfirmed) setLinkParams({ child: hub.childId }); }, [tutor, hub.childId, hub.childConfirmed]);

  // The tabs, in the order the spec fixes: Live lessons first.
  const modules = useMemo(() => {
    const byKey = new Map(PANEL_MODULES.map((m) => [m.meta.key, m]));
    const out: TabModule[] = [];
    for (const k of TAB_ORDER) {
      if (k === "notes") out.push({ meta: NOTES_META, Panel: null });
      else if (k === "students") { if (tutor) out.push({ meta: STUDENTS_MODULE.meta, Panel: STUDENTS_MODULE.Panel }); }
      else { const m = byKey.get(k); if (m) out.push({ meta: m.meta, Panel: m.Panel }); }
    }
    return out;
  }, [tutor]);
  const liveMeta = modules.find((m) => m.meta.key === "live")?.meta;
  const homeMeta = modules.find((m) => m.meta.key === "home")?.meta;
  const defaultTab: TabKey = homeMeta?.status === "live" ? "home" : liveMeta?.status === "live" ? "live" : "notes";
  const wanted: TabKey = picked && modules.some((m) => m.meta.key === picked) ? picked : defaultTab;
  const active: TabKey = kid && !(KID_TABS as readonly string[]).includes(wanted) ? "home" : wanted;
  const current = modules.find((m) => m.meta.key === active)!;
  const activeRef = useRef<TabKey>(active);
  useLayoutEffect(() => { activeRef.current = active; }, [active]);
  const setFocus = useCallback((on: boolean, opts?: { bare?: boolean }) => { setFocusFor(on ? activeRef.current : null); setFocusBare(on && !!opts?.bare); }, []);
  const focus = focusFor === active;
  const liveNow = useLiveNow(hub.childQs, !!tenantId && (!tutor ? !!hub.childId : true));

  // The Questions tab's unread badge — either side should see "someone's waiting" without opening the tab.
  const [unreadQuestions, setUnreadQuestions] = useState(0);
  const loadUnreadQuestions = useCallback(() => {
    if (!tenantId || (!tutor && !hub.childId)) return;
    listDoubts(tutor ? qs : hub.childQs).then((rows) => setUnreadQuestions(rows.filter((d) => (tutor ? d.unreadByTutor : d.unreadByFamily)).length)).catch(() => undefined);
  }, [tutor, tenantId, qs, hub.childId, hub.childQs]);
  useEffect(() => { loadUnreadQuestions(); const t = setInterval(loadUnreadQuestions, 20_000); return () => clearInterval(t); }, [loadUnreadQuestions]);
  useRealtime(["hubDoubts"], loadUnreadQuestions);

  // Navigating clears any stale error banner.
  const go = useCallback((k: TabKey) => {
    setError(null); setFocusFor(null); setPicked(k);
    setLinkParams({ tab: k }, true); // a different tab never keeps the old lesson / quiz / homework open
  }, [setError]);
  // Back / a link that names a tab (a notification, "Start the lesson" from a homework) moves the tab too.
  useEffect(() => {
    const t = new URLSearchParams(linkSearch).get("tab") as TabKey | null;
    if (t) setPicked((cur) => (cur === t ? cur : t));
  }, [linkSearch]);
  const onFilter = useCallback((f: HubFilter) => { setError(null); setFilter(f); }, [setError]);
  const onProvider = (id: string) => {
    if (dirty && !window.confirm("You have an unsaved lesson. Switch provider and lose it?")) return;
    setError(null); setFilter(NONE); hub.setTenantId(id);
  };
  const onChild = (id: string) => { setError(null); hub.setChildId(id); };

  // A topic or subject that vanished (deleted/renamed, here or by another
  // tutor) must not leave every panel filtered to nothing.
  useEffect(() => {
    if (!ready) return;
    if (filter.topicId && !topics.some((t) => t.id === filter.topicId)) setFilter(NONE);
    else if (filter.subject && !topics.some((t) => t.subject === filter.subject)) setFilter(NONE);
  }, [ready, topics, filter]);

  // Leaving with a half-written note asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const covered = useMemo(() => coveredTopicIds(topics, filter), [topics, filter]);
  const activeStudents = students.filter((s) => s.active !== false).length;

  // ── gates ────────────────────────────────────────────────────────────────
  // A tutor's invite link for a family (?invite=…): choose which of your children to enrol (F13).
  const inviteToken = !tutor ? new URLSearchParams(linkSearch).get("invite") : null;
  if (inviteToken) return <FamilyInviteClaim token={inviteToken} portal={pathname.split("/")[1] ?? "custdash"} />;
  if (providers === null) {
    return (
      <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={{ background: "var(--bg)", color: "var(--ink)" }} id="learning-hub-loading">
        <HubStyles />
        <div role="status" aria-busy="true" aria-label={`Loading ${hubName(mode)}`}>
          <Skeleton className="mb-3.5 h-[64px] w-full !rounded-2xl" />
          <div className="mb-4 flex gap-2">{[112, 96, 104, 88, 120].map((w, i) => <Skeleton key={i} className="h-11 flex-none !rounded-full" style={{ width: w }} />)}</div>
          <SkeletonRows rows={3} label="Loading lessons" />
        </div>
      </div>
    );
  }
  if (!providers.length || !tenantId || !provider) {
    const portal = pathname.split("/")[1] ?? "";
    // A network blip (lib/api's "Couldn't reach the server at http://…" / "didn't respond within 15s") is developer wording: a parent
    // or child sees a plain sentence and a Try again button instead.
    const offline = !!error && /reach the server|didn't respond within/i.test(error);
    const tryAgain = <button type="button" onClick={refresh} className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-5 text-[13px] font-extrabold text-white ${FOCUS}`} style={{ background: "linear-gradient(180deg, var(--brand-2), var(--brand))" }}>Try again</button>;
    return (
      <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={{ background: "var(--bg)", color: "var(--ink)" }}>
        <div className="mx-auto mt-6 max-w-[560px]">
          <EmptyState icon="notes" title={hubName(mode)} id="learning-hub-off"
            body={offline ? `We can't reach ${hubName(mode)} right now. Check your connection, then try again.` : error ?? (mode === "student" ? "None of your providers have switched on My Classroom yet." : portal === "staff" ? "The Teaching Hub isn't switched on for your team yet. Ask a manager to turn it on in Setup → Features (and give your role access in Roles & permissions)." : "The Teaching Hub isn't available on this account. It's off until you switch it on.")}
            action={offline ? tryAgain : tutor && ["company", "franchise", "freelancer"].includes(portal)
              ? <Link href={`/${portal}/setup`} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-5 text-[13px] font-extrabold text-white" style={{ background: "linear-gradient(180deg, var(--brand-2), var(--brand))" }}>Turn it on in Setup <Icon name="chevronRight" size={15} /></Link>
              : undefined} />
        </div>
      </div>
    );
  }

  const panelProps: PanelProps = {
    tenantId, qs, canEdit, readOnly, franchiseId: provider.franchiseId ?? null, me: tutor && provider.uid ? { uid: provider.uid, role: provider.role ?? "" } : null, topics, filter, covered, students, childId: hub.childId, config,
    onError: setError, mode, providerName: provider.name, child: hub.child, refreshStudents: refresh, goTo: go, childQs, setFocus, groups, refreshGroups: refresh,
  };
  const tabs: HubTab[] = modules.filter((m) => !kid || (KID_TABS as readonly string[]).includes(m.meta.key)).map((m) => ({
    // Families see "Messages" (it's their own inbox); the tutor keeps "Student message centre" (kid label wins when both apply).
    meta: kid && KID_TAB_LABEL[m.meta.key] ? { ...m.meta, label: KID_TAB_LABEL[m.meta.key] } : !tutor && m.meta.key === "questions" ? { ...m.meta, label: "Messages" } : m.meta,
    badge: m.meta.key === "notes" && dirty ? "Unsaved" : m.meta.key === "questions" && unreadQuestions > 0 ? String(unreadQuestions) : undefined,
  }));
  // The roster is about people, not topics — give it the full width. Quizzes,
  // homework and placement are card grids that want the width too: their
  // subject filter is a chip bar above the content, not a 280px column.
  const chips = active === "quizzes" || active === "homework" || active === "diagnostic";
  const sidebar = active !== "students" && active !== "home" && active !== "tools" && !chips && !focus; // Tools has its own filters

  const settled = ready && (!kid || hub.childId === kidChildId);
  const body = (() => {
    if (!settled) return <SkeletonRows rows={4} label="Loading" variant={active === "students" ? "roster" : "row"} grid={active === "students"} />;
    if (current.meta.status !== "live") return <ComingSoon meta={current.meta} />;
    if (current.Panel) { const P = current.Panel; return <P {...panelProps} />; }
    return null;
  })();

  const topicFilter = (variant: "sidebar" | "chips") => (ready ? (
    <TopicFilter topics={topics} noteStats={noteStats} filter={filter} onFilter={onFilter} canEdit={canEdit && !readOnly} franchiseId={provider.franchiseId ?? null} qs={qs} onChanged={refresh} onError={setError} addSignal={addSignal} variant={variant} />
  ) : variant === "chips" ? (
    <div role="status" aria-busy="true" aria-label="Loading subjects" className="mb-4 flex gap-2">{[104, 92, 108, 96].map((w, i) => <Skeleton key={i} className="h-11 flex-none !rounded-full" style={{ width: w }} />)}</div>
  ) : (
    <div role="status" aria-busy="true" aria-label="Loading subjects" className="space-y-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
      {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
    </div>
  ));

  const portal = pathname.split("/")[1] ?? "custdash";
  const family: FamilyCtx = tutor ? { active: false, kids: [], childId: null, multi: false, confirmed: true, kid: false, providerName: "", tenantId: "", pick: () => undefined, handOver: () => undefined, messageHref: null } : {
    active: true, kids: hub.children.map((c) => ({ childId: c.childId, childName: c.childName })), childId: hub.childId, multi: hub.children.length > 1, confirmed: hub.childConfirmed, kid,
    providerName: provider.name, tenantId,
    pick: (id) => { setError(null); hub.setChildId(id); },
    handOver: (id) => { hub.setChildId(id); const v = { t: tenantId, c: id }; writeKid(v); setKidRaw(v); go("home"); },
    messageHref: `/${portal}/messages?compose=1&tenant=${encodeURIComponent(tenantId)}`,
  };
  const exitKid = () => { writeKid(null); setKidRaw(null); };
  const kidName = hub.children.find((c) => c.childId === kidChildId)?.childName ?? "";

  return (
    <div className={kid ? "fixed inset-0 z-[320] overflow-y-auto overscroll-contain p-3 sm:p-5" : "-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5"} style={{ background: "var(--bg)", color: "var(--ink)" }} id="learning-hub" data-kid={kid ? "1" : undefined}>
      <HubStyles />
      <FamilyProvider value={family}>
      <CallProvider p={panelProps} key={tenantId}>
      <div className="mx-auto max-w-[1240px]">
        {kid ? (focus ? null : <KidBar name={kidName} onExit={exitKid} />) : focus && focusBare ? null : focus ? (!tutor ? null : (
          <div className="mb-3 flex min-h-[44px] items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3 shadow-[var(--shadow-sm)]" id="hub-focus-bar">
            <span className="grid h-7 w-7 flex-none place-items-center rounded-lg" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}><Icon name="sparkle" size={14} /></span>
            <span className="min-w-0 flex-1 truncate text-[13px] font-extrabold text-[var(--ink)]">{current.meta.label}<span className="font-semibold text-[var(--ink-2)]"> · focus mode</span></span>
            <button type="button" onClick={() => setFocusFor(null)} className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 text-[12.5px] font-extrabold text-[var(--brand)] hover:bg-[var(--brand-soft)] ${FOCUS}`}>
              <Icon name="layers" size={15} /> Show menu
            </button>
          </div>
        )) : (
          <HubHero mode={mode} providers={providers} provider={provider} onProvider={onProvider} kids={hub.children} childId={hub.childId} onChild={onChild}
            topics={topics} noteStats={noteStats} activeStudents={activeStudents} ready={ready} compact={active !== "home"} />
        )}

        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        {tutor && !provider.canEdit && (
          <div role="status" id="hub-view-only" className="mb-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 text-[13px] font-semibold text-[var(--ink-2)]">
            <b className="font-extrabold text-[var(--ink)]">View only.</b> Your role can look at the Teaching Hub but not change it. Ask a manager for Edit access in Setup → Roles &amp; permissions.
          </div>
        )}

        {!focus && !kid && !tutor && <FamilyBar />}

        {!focus && <HubTabs tabs={tabs} active={active} onSelect={go} liveNow={liveNow} />}

        {chips && !focus && topicFilter("chips")}

        <div className={sidebar ? "grid items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)]" : ""}>
          {sidebar && <aside className="lg:sticky lg:top-3">{topicFilter("sidebar")}</aside>}

          <main className="min-w-0">
            {/* Notes stays mounted (hidden) on other tabs so an unsaved draft survives a tab switch. */}
            {settled && (
              <div role="tabpanel" id="hub-tabpanel-notes" aria-labelledby="hub-tab-notes" hidden={active !== "notes"} tabIndex={-1} className="outline-none" key={tenantId}>
                <NotesPanel topics={topics} version={notesVersion} listQs={childQs} covered={covered} filter={filter} canEdit={canEdit} readOnly={readOnly} franchiseId={provider.franchiseId ?? null} qs={qs} onChanged={refresh} onError={setError}
                  onAddTopic={() => setAddSignal((n) => n + 1)} onDirtyChange={setDirty} onClearFilter={() => onFilter(NONE)} active={active === "notes"}
                  childId={hub.childId} config={config} setFocus={setFocus} goTo={go as (k: "flashcards" | "homework") => void} years={hub.years} onYearsChange={hub.setYears} />
              </div>
            )}
            {active !== "notes" && (
              <div role="tabpanel" id={`hub-tabpanel-${active}`} aria-labelledby={`hub-tab-${active}`} tabIndex={-1} className="hub-rise outline-none" key={active}>{body}</div>
            )}
            {active === "notes" && !settled && <SkeletonRows rows={4} label="Loading lessons" variant="card" grid />}
          </main>
        </div>
      </div>
      </CallProvider>
      </FamilyProvider>
    </div>
  );
}

export const StudentLearningHubApp = () => <LearningHubApp mode="student" />;
export const TutorLearningHubApp = () => <LearningHubApp mode="tutor" />;
