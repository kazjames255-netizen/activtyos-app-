"use client";

import { JoinRemoteSyncBanner } from "./remotesync/JoinRemoteSyncBanner";
import { hubName } from "./names";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentType } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { HubHero } from "./HubHero";
import { HubWelcomeSplash } from "./HubWelcomeSplash";
import { CallProvider } from "./live/CallProvider";
import { HubTabs, type HubTab } from "./HubTabs";
import { EmptyState, ErrorBanner, FOCUS, isOfflineError, HubStyles, Icon, Skeleton, SkeletonRows } from "./kit";
import { NotesPanel } from "./NotesPanel";
import TabHowTo from "./howitworks/TabHowTo";
import FirstTimeTour from "./howitworks/FirstTimeTour";
import { NOTES_META, PANEL_MODULES, STUDENTS_MODULE, TAB_ORDER } from "./panels";
import type { PanelMeta, PanelProps } from "./panelTypes";
import { TopicFilter } from "./TopicFilter";
import { useHubData, useLiveNow } from "./useHubData";
import { coveredTopicIds, type HubFilter } from "./types";
import { ChildSwitcher, FamilyProvider, type FamilyCtx } from "./family/FamilyContext";
import { FamilyTabBar } from "./family/FamilyTabBar";
import { KidIconTabs } from "./family/KidIconTabs";
import { bandOrDefault } from "./family/kidCopy";
import { KID_STRIP_HIDDEN, KID_TABS, KID_TAB_LABEL, KidBar, readKid, useKidGuards, writeKid } from "./family/KidMode";
import { setLinkParams, seedOpen, useLinkSearch, type OpenRef } from "./family/link";
import { firstName } from "./home/homeLib";
import { FamilyInviteClaim } from "./family/FamilyInviteClaim";
import { useRealtime } from "@/lib/realtime";
import { listDoubts } from "./lesson/doubts/api";
import { useOnBrand } from "./onBrand";
import { resolveTarget } from "./tabAlias";
import { TUTOR_TOPS, recalledSub, rememberSub, subById, subFor, topOfKey, type SubDef } from "./tabGroups";
import { FAMILY_TOPS, KID_TOPS, famRecalledSub, famRememberSub, famSubById, famSubFor, famTopOfKey, type FamSubDef, type FamTopDef } from "./familyGroups";
import { SubMenuCard, type ItemInfo } from "./SubMenuCard";
import { setHubIntent } from "./hubIntent";
import { useMarkItems } from "./mark/useMarkItems";
import { useI18n, useT } from "@/lib/i18n/provider";
import { useHubMessagesReady } from "@/lib/i18n/hubMessages";
import { useLbl, usePlural } from "./hubLabel";
import { MascotSettingsProvider } from "./mascot";

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
const HW_VIEW: Record<string, string> = { mark: "mark", inbox: "inbox", results: "results", set: "assignments" };
const HW_SUB: Record<string, string> = { mark: "mark", inbox: "inbox", results: "results", assignments: "set" };
const NONE: HubFilter = { subject: null, topicId: null };

/** Real (path-based) deep-link entry: a Level 2/3 route mounts the whole hub already pointed at a child (and,
 *  for an item route, at that item) instead of relying on the `?child=&open=` query alone. `backHref` renders
 *  a "← Back to <Name>'s Today" link above the shell — see StudentLearningHubDeep below. */
export interface LearningHubDeepProps { initialChildId?: string; initialTab?: TabKey; initialOpen?: OpenRef; backHref?: string }

export function LearningHubApp({ mode, initialChildId, initialTab, initialOpen, backHref }: { mode: "student" | "tutor" } & LearningHubDeepProps) {
  const t = useT(); const lbl = useLbl(); const tp = usePlural();
  // The hub's words are fetched on demand (one locale + English), in parallel with its data — show the skeleton, never raw keys, until they are here.
  const msgsReady = useHubMessagesReady(useI18n().locale);
  const router = useRouter();
  const hub = useHubData(mode, { initialChildId });
  const hubN = lbl(hubName(mode));
  const { providers, provider, tenantId, qs, childQs, ready, topics, noteStats, notesVersion, students, groups, config, error, setError, refresh } = hub;
  const [filter, setFilter] = useState<HubFilter>(NONE);
  // The active tab lives in the URL (?tab=quizzes) so a reload or Back doesn't drop you on Home mid-task.
  const initial = () => { if (typeof window === "undefined") return null; const q = new URLSearchParams(window.location.search); return resolveTarget(q.get("tab"), q.get("sub")); };
  const [picked, setPicked] = useState<TabKey | null>(() => initial()?.key ?? initialTab ?? null);
  // Tutor hub: the sub-tab under the top tab (?sub=). Null = the panel's default sub-tab. `nonce` remounts a panel so an action sub-tab
  // ("Schedule video lesson", "Enrol a student"…) opens its existing dialog even when that panel is already showing.
  const [sub, setSub] = useState<string | null>(() => initial()?.sub ?? null);
  const [nonce, setNonce] = useState(0);
  const [dirty, setDirty] = useState(false);
  // Focus mode is stored AS the tab that asked for it, so it can never outlive
  // that tab: switching tab (or the panel unmounting) ends it by construction.
  const [focusFor, setFocusFor] = useState<TabKey | null>(null);
  const [focusBare, setFocusBare] = useState(false);
  const pathname = usePathname() ?? "";
  const portal = pathname.split("/")[1] || "custdash";
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

  // Level 3 deep link (/[childId]/homework/[id] etc.): the shell mounts already pointed at the child (via initialChildId)
  // — seed the item it should open too, once, so the panel's own useLinkOpen() picks it up like any other deep link.
  const seededOpen = useRef(false);
  useEffect(() => {
    if (seededOpen.current || !initialOpen || !initialChildId) return;
    if (hub.childId !== initialChildId) return; // wait for the seeded child to actually take
    seededOpen.current = true;
    seedOpen(initialOpen, { tab: initialTab });
  }, [initialOpen, initialTab, initialChildId, hub.childId]);

  // Level 1 → Level 2: a single-child family never sees the family overview — send the URL itself to the child's
  // own space (/[portal]/learninghub/[childId]) the moment we know there's only one child. Already on a child route
  // (initialChildId set) → nothing to do.
  useEffect(() => {
    if (tutor || kid || initialChildId || !ready || hub.children.length !== 1 || !hub.childId) return;
    const qp = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
    qp.delete("child");
    const suffix = qp.toString();
    router.replace(`/${portal}/learninghub/${encodeURIComponent(hub.childId)}${suffix ? `?${suffix}` : ""}`);
  }, [tutor, kid, initialChildId, ready, hub.children.length, hub.childId, portal, router]);

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
  // Level 1 (family overview, /learninghub with NO :childId — `initialChildId` unset) for a MULTI-child family:
  // nobody has said who this is for yet, so no other tab may render — a stale `?tab=quizzes` link (or one typed by
  // hand) must land on the overview, never silently default to hub.childId's first child and show that child's
  // quizzes/homework/progress with no indication whose they are (owner-verified repro: "who would be taking the
  // quiz? no student has been chosen"). Only a REAL Level 2 route (:childId in the path), a single-child family
  // (which the effect below sends straight to their own Level 2 route), or a link that itself NAMES the child
  // (`?child=…`, e.g. a bell/email notification built by server/src/lib/hubNotify.ts's hubHref) ever shows the tab
  // bar or its panels — `hub.childConfirmed` is exactly that signal (useHubData.ts): true the moment a real child
  // id was picked on purpose, whether by URL, a remembered pick, or a tap, and false only while nobody has said who
  // this is for. Without the `childConfirmed` check, a notification linking straight to a specific child's
  // homework/quiz (`?child=<id>&tab=homework&open=hw:<id>`) would be forced onto the overview instead — a real
  // regression this force-overview fix would otherwise have caused.
  const forceOverview = !tutor && !kid && !initialChildId && hub.children.length > 1 && !hub.childConfirmed;
  const active: TabKey = forceOverview ? "home" : kid && !(KID_TABS as readonly string[]).includes(wanted) ? "home" : wanted;
  const current = modules.find((m) => m.meta.key === active)!;
  // Tutor hub: which top tab / sub-tab the panel key sits under (a presentation grouping; `active` stays the panel key everywhere).
  const activeSub: SubDef | null = tutor ? subFor(active, sub) : null;
  const activeTop = tutor ? topOfKey(active) : null;
  // Family hub (redesign brief §1 Level 2): the same idea, over the 5-max FAMILY_TOPS instead of the tutor's seven.
  // Kid mode keeps its own flat KID_TABS strip — neither this nor the tutor grouping applies there.
  // Kid mode from Year 3 up uses the SAME grouped nav as a parent's view of the child, in a five-tab kid version (KID_TOPS): big tabs that
  // never scroll sideways. Reception to Year 2 keeps the three big icon tabs (KidIconTabs).
  const kidStrip = kid && bandOrDefault(hub.child?.yearGroup) !== "ks1";
  const famTops = kid ? KID_TOPS : FAMILY_TOPS;
  const famNav = !tutor && (!kid || kidStrip);
  const famActiveSub: FamSubDef | null = famNav ? famSubFor(active, sub, famTops) : null;
  const famActiveTop: FamTopDef | null = famNav ? (famTopOfKey(active, famTops) ?? (kid ? KID_TOPS[0]! : null)) : null;

  const activeRef = useRef<TabKey>(active);
  useLayoutEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => { if (activeTop && activeSub) rememberSub(activeTop, activeSub); }, [activeTop, activeSub]);
  useEffect(() => { if (famActiveTop && famActiveSub) famRememberSub(famActiveTop, famActiveSub); }, [famActiveTop, famActiveSub]);
  const setFocus = useCallback((on: boolean, opts?: { bare?: boolean }) => { setFocusFor(on ? activeRef.current : null); setFocusBare(on && !!opts?.bare); }, []);
  const focus = focusFor === active;
  // A tab switched by click / Enter / a link moves focus to the panel heading (arrow-key roving keeps focus on the strip) and titles the page.
  const moveFocus = useRef(false);
  // Bumped every time a click explicitly asks for focus (moveFocus.current = true), even when the click lands on the
  // ALREADY-active sub (e.g. clicking a top tab whose default sub is already open) — active/activeSub.id don't change
  // in that case, so the effect below can't rely on them alone or it silently never re-fires. Found live 29 Sept:
  // hub-shell-a11y-links.spec.ts clicking "Quizzes" top then its (already-default) "Quizzes" sub moved focus nowhere.
  const [focusNonce, setFocusNonce] = useState(0);
  useOnBrand(tenantId ?? "");
  useEffect(() => {
    const before = document.title;
    document.title = `${current.meta.label} - ${hubN}`;
    return () => { document.title = before; };
  }, [current.meta.label, mode]);
  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    const t = requestAnimationFrame(() => {
      const panel = document.getElementById(`hub-tabpanel-${active}`);
      if (!panel || panel.hidden) return;
      const h = panel.querySelector<HTMLElement>("h1, h2");
      const target = h ?? panel;
      if (h && !h.hasAttribute("tabindex")) h.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(t);
  }, [active, activeSub?.id, focusNonce]);
  const liveNow = useLiveNow(hub.childQs, !!tenantId && (!tutor ? !!hub.childId : true));

  // The Questions tab's unread badge — either side should see "someone's waiting" without opening the tab.
  const [unreadQuestions, setUnreadQuestions] = useState(0);
  const loadUnreadQuestions = useCallback(() => {
    if (!tenantId || (!tutor && !hub.childId)) return;
    listDoubts(tutor ? qs : hub.childQs).then((rows) => setUnreadQuestions(rows.filter((d) => (tutor ? d.unreadByTutor : d.unreadByFamily)).length)).catch(() => undefined);
  }, [tutor, tenantId, qs, hub.childId, hub.childQs]);
  useEffect(() => { loadUnreadQuestions(); const t = setInterval(loadUnreadQuestions, 20_000); return () => clearInterval(t); }, [loadUnreadQuestions]);
  useRealtime(["hubDoubts"], loadUnreadQuestions);

  // R-2: the Homework tab carries the count of everything waiting in the one Mark queue (all three kinds).
  const toMark = useMarkItems(qs, students, tutor && !!tenantId);

  // Navigating clears any stale error banner.
  const go = useCallback((k: TabKey) => {
    setError(null); setFocusFor(null); moveFocus.current = true; setFocusNonce((n) => n + 1); setPicked(k); setSub(null);
    setLinkParams({ tab: k, sub: null }, true); // a different tab never keeps the old lesson / quiz / homework open
  }, [setError]);
  // Grouped strip: a sub-tab opens its panel (and, for an action sub-tab, the existing dialog / overlay the old Home tile opened).
  const selectSub = useCallback((d: SubDef, opts?: { focus?: boolean }) => {
    const wantsFocus = opts?.focus !== false;
    setError(null); setFocusFor(null); moveFocus.current = wantsFocus;
    if (wantsFocus) setFocusNonce((n) => n + 1);
    setPicked(d.key); setSub(d.id);
    if (d.action === "intent" && d.intent) { setHubIntent(d.intent); setNonce((n) => n + 1); }
    setLinkParams({ tab: d.key, sub: d.id }, true);
  }, [setError]);
  useEffect(() => { // "Try it now" at the end of a How it works video
    if (!tutor) return;
    const h = (e: Event) => { const d = subById((e as CustomEvent<{ sub?: string }>).detail?.sub); if (d) selectSub(d); };
    window.addEventListener("aos:hub-goto", h);
    return () => window.removeEventListener("aos:hub-goto", h);
  }, [tutor, selectSub]);
  // Family hub: a sub-section pill under Learn / Quizzes opens its panel, same URL plumbing as the tutor's grouped strip.
  const selectFamSub = useCallback((d: FamSubDef, opts?: { focus?: boolean }) => {
    const wantsFocus = opts?.focus !== false;
    setError(null); setFocusFor(null); moveFocus.current = wantsFocus;
    if (wantsFocus) setFocusNonce((n) => n + 1);
    setPicked(d.key); setSub(d.id);
    setLinkParams({ tab: d.key, sub: d.id }, true);
  }, [setError]);
  const selectFamTop = useCallback((id: string, how?: "arrow") => {
    const top = famTops.find((x) => x.id === id);
    if (!top) return;
    const back = famRecalledSub(top);
    const d = back ?? top.subs[0]!;
    selectFamSub(d, { focus: top.subs.length === 1 && how !== "arrow" });
  }, [selectFamSub, famTops]);
  const selectTop = useCallback((id: string, how?: "arrow") => {
    const top = TUTOR_TOPS.find((t) => t.id === id);
    if (!top) return;
    // Opens the card AND a page at once: Homework goes straight to To mark while anything waits (else where you were, else Inbox);
    // every other top reopens the sub-section last used (else its first).
    const back = recalledSub(top);
    const d = top.entry === "mark" ? (back ?? subById("results")) : back ?? top.subs.find((x) => !x.action)!;   // Homework opens on Marking & results (the To mark tab is part of it now)
    selectSub(d!, { focus: top.subs.length === 1 && how !== "arrow" });
  }, [selectSub, toMark.count]);
  // The Homework panel reports the view it is on (its own default, a Home deep link, or a sub-tab click): keep sub-tab + URL in step.
  const onHwSubView = useCallback((v: string) => { const id = HW_SUB[v]; if (id) { setSub(id); setLinkParams({ sub: id }); } }, []);
  // Back / a link that names a tab (a notification, "Start the lesson" from a homework) moves the tab too.
  useEffect(() => {
    const q = new URLSearchParams(linkSearch);
    const t = resolveTarget(q.get("tab"), q.get("sub"));
    if (t) { setPicked((cur) => (cur === t.key ? cur : t.key)); setSub((cur) => (cur === t.sub ? cur : t.sub)); }
  }, [linkSearch]);
  const onFilter = useCallback((f: HubFilter) => { setError(null); setFilter(f); }, [setError]);
  const onProvider = (id: string) => {
    if (dirty && !window.confirm(t("hubshell.switchProviderConfirm"))) return;
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
  // "Looks off" (empty provider list / no matching tenant) can be momentarily true for a reason that has nothing
  // to do with the hub actually being off — a real bug hit live: switching child via the redesign's own
  // ChildSwitcher flashed "None of your providers have switched on the Learning Hub" for an instant before the
  // right page landed. Rather than trust the very first render where this looks true, require it to still be true
  // a moment later before showing the "off" card — a genuine off/misconfigured account settles into this and stays
  // there (the short delay is imperceptible); a transient blip during a child switch never gets the chance to paint.
  const looksOff = providers !== null && msgsReady && (!providers.length || !tenantId || !provider);
  const [confirmedOff, setConfirmedOff] = useState(false);
  useEffect(() => {
    if (!looksOff) { setConfirmedOff(false); return; }
    const t = setTimeout(() => setConfirmedOff(true), 500);
    return () => clearTimeout(t);
  }, [looksOff]);
  if (inviteToken && msgsReady) return <FamilyInviteClaim token={inviteToken} portal={pathname.split("/")[1] ?? "custdash"} />;
  if (providers === null || !msgsReady || (looksOff && !confirmedOff)) {
    return (
      <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={{ background: "var(--bg)", color: "var(--ink)" }} id="learning-hub-loading">
        <HubStyles />
        <div role="status" aria-busy="true" aria-label={t("hubshell.loadingHub", { name: hubN })}>
          <Skeleton className="mb-3.5 h-[64px] w-full !rounded-2xl" />
          <div className="mb-4 flex gap-2">{[112, 96, 104, 88, 120].map((w, i) => <Skeleton key={i} className="h-11 flex-none !rounded-full" style={{ width: w }} />)}</div>
          <SkeletonRows rows={3} label={t("hubshell.loadingLessons")} />
        </div>
      </div>
    );
  }
  if (!providers.length || !tenantId || !provider) {
    const portal = pathname.split("/")[1] ?? "";
    // A network blip (lib/api's "Couldn't reach the server at http://…" / "didn't respond within 15s") is developer wording: a parent
    // or child sees a plain sentence and a Try again button instead.
    const offline = isOfflineError(error);
    const tryAgain = <button type="button" onClick={refresh} className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-5 text-[13px] font-extrabold text-white ${FOCUS}`} style={{ background: "linear-gradient(180deg, var(--brand-2), var(--brand))" }}>{t("hubshell.tryAgain")}</button>;
    return (
      <div className="-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5" style={{ background: "var(--bg)", color: "var(--ink)" }}>
        <div className="mx-auto mt-6 max-w-[560px]">
          <EmptyState icon="notes" title={hubN} id="learning-hub-off"
            body={offline ? t("hubshell.offlineBody", { name: hubN }) : error ?? (mode === "student" ? t("hubshell.offStudent") : portal === "staff" ? t("hubshell.offStaff") : t("hubshell.offOperator"))}
            action={offline ? tryAgain : tutor && ["company", "franchise", "freelancer"].includes(portal)
              ? <Link href={`/${portal}/setup`} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-5 text-[13px] font-extrabold text-white" style={{ background: "linear-gradient(180deg, var(--brand-2), var(--brand))" }}>{t("hubshell.turnOnInSetup")} <Icon name="chevronRight" size={15} className="rtl:-scale-x-100" /></Link>
              : undefined} />
        </div>
      </div>
    );
  }

  const panelProps: PanelProps = {
    tenantId, qs, canEdit, readOnly, franchiseId: provider.franchiseId ?? null, me: tutor && provider.uid ? { uid: provider.uid, role: provider.role ?? "" } : null, topics, filter, covered, students, childId: hub.childId, config,
    onError: setError, mode, providerName: provider.name, child: hub.child, refreshStudents: refresh, goTo: go, childQs, setFocus, groups, refreshGroups: refresh,
    subView: tutor && active === "homework" && sub && subById(sub)?.key === "homework" ? HW_VIEW[sub] : undefined,
    onSubView: tutor ? onHwSubView : undefined,
  };
  const meta0 = (k: TabKey, label: string) => ({ ...(modules.find((m) => m.meta.key === k)?.meta ?? current.meta), label, status: "live" as const });
  const topTabs: HubTab[] = tutor ? TUTOR_TOPS.filter((t) => t.subs.some((x) => modules.some((m) => m.meta.key === x.key))).map((t) => ({
    id: t.id, emoji: t.emoji, meta: meta0(t.subs[0].key, t.label), accent: t.accent,
    badge: t.id === "lessons" && dirty ? "Unsaved" : t.id === "messages" && unreadQuestions > 0 ? String(unreadQuestions) : t.id === "homework" && toMark.count > 0 ? String(toMark.count) : undefined,
    dot: t.id === "lessons" ? liveNow : undefined, sr: t.id === "lessons" && liveNow ? "live now" : undefined,
  })) : [];
  const subList: SubDef[] = activeTop ? activeTop.subs.filter((d) => !(d.action && readOnly)) : [];
  // Family hub (max 5 tops): Live lessons / Tools / Flashcards fold into Learn, Starting quizzes folds into Quizzes —
  // exactly the panels behind them are unchanged, only how they're grouped. Messages (questions) has no top here at
  // all (brief: "leaves the tab bar entirely") — it stays fully reachable by a direct ?tab=questions deep link
  // (notifications, "Ask your tutor") via tabAlias.ts, same as any panel key not currently shown as a tab.
  const famTopTabs: HubTab[] = famNav ? famTops.map((top) => ({ id: top.id, emoji: top.emoji, meta: meta0(top.subs[0]!.key, top.label) })) : [];
  const famSubList: FamSubDef[] = famActiveTop ? famActiveTop.subs : [];
  const famSubTabs: HubTab[] = famSubList.map((d) => ({ id: d.id, emoji: d.emoji, meta: meta0(d.key, d.label) }));
  // Live numbers in the side card: only what the hub already holds (the Mark queue, the roster, a running lesson, an unsaved draft).
  const itemInfo: Record<string, ItemInfo | undefined> = {
    results: toMark.count > 0 ? { count: t("hubshell.toMarkCount", { n: toMark.count }) } : undefined,
    live: liveNow ? { count: t("hubshell.liveNowCap"), live: true } : undefined,
    lessons: dirty ? { count: t("hubshell.unsavedDraft") } : undefined,
    students: activeStudents > 0 ? { count: tp("hubshell.studentsCount", activeStudents) } : undefined,
  };
  const tabs: HubTab[] = modules.filter((m) => !kid || ((KID_TABS as readonly string[]).includes(m.meta.key) && !KID_STRIP_HIDDEN.includes(m.meta.key))).map((m) => ({
    // One vocabulary: "Messages" and "Starting quizzes" for everyone; a child's own words (KID_TAB_LABEL) win on their screens.
    meta: kid && KID_TAB_LABEL[m.meta.key] ? { ...m.meta, label: KID_TAB_LABEL[m.meta.key] } : m.meta,
    badge: m.meta.key === "notes" && dirty ? "Unsaved" : m.meta.key === "questions" && unreadQuestions > 0 ? String(unreadQuestions) : m.meta.key === "homework" && tutor && toMark.count > 0 ? String(toMark.count) : undefined,
  }));
  // The roster is about people, not topics — give it the full width. Quizzes,
  // homework and placement are card grids that want the width too: their
  // subject filter is a chip bar above the content, not a 280px column.
  // Family hub (brief §1 Level 2): the subject chip row lives INSIDE Learn (which now also holds Quizzes and
  // Starting quizzes, folded in per the owner's Tools-drop correction) and Progress only — never its own tab bar,
  // never on Homework or Today. It already only ever lists the child's enrolled subjects (and their one chosen
  // language, not every language taught) because `topics` itself is narrowed to `child.subjects` in
  // useHubData.ts before it ever reaches here.
  // Reception–Y2 (KS1): no subject chips or search on "Stars" (the drill-in is for readers), and no typing box anywhere.
  const ks1Kid = kid && bandOrDefault(hub.child?.yearGroup) === "ks1";
  // Kaz asked repeatedly, across every portal/mode, for this row gone from Progress ("dashboard") — it is
  // NEVER shown there now, tutor included. Only Quizzes/Starting quizzes (picking which topic to browse) and
  // Lessons' OWN picker (rendered inside NotesPanel, not here) still use a subject filter.
  const chips = active === "notes" || active === "dashboard" ? false : tutor || kid
    ? active === "quizzes" || active === "diagnostic"
    : !!famActiveTop && famActiveTop.id === "learn";
  // Notes (Lessons & curriculum) has its own primary browse now — the always-open curriculum card, whose tiles
  // lead straight to a lesson list — so it no longer needs the subject/topic sidebar. Tools has its own filters.
  // The left "Subjects & topics" card is gone everywhere (owner decision): the curriculum map and the per-panel chips replace it.
  const sidebar = false;

  const settled = ready && (!kid || hub.childId === kidChildId);
  const body = (() => {
    if (!settled) return <SkeletonRows rows={4} label={t("hubshell.loading")} variant={active === "students" ? "roster" : "row"} grid={active === "students"} />;
    if (current.Panel) { const P = current.Panel; return <P {...panelProps} />; }
    return null;
  })();

  const topicFilter = (variant: "sidebar" | "chips") => (ready ? (
    <TopicFilter topics={topics} noteStats={noteStats} filter={filter} onFilter={onFilter} canEdit={canEdit && !readOnly} franchiseId={provider.franchiseId ?? null} qs={qs} onChanged={refresh} onError={setError} variant={variant} noSearch={ks1Kid} />
  ) : variant === "chips" ? (
    <div role="status" aria-busy="true" aria-label={t("hubshell.loadingSubjects")} className="mb-4 flex gap-2">{[104, 92, 108, 96].map((w, i) => <Skeleton key={i} className="h-11 flex-none !rounded-full" style={{ width: w }} />)}</div>
  ) : (
    <div role="status" aria-busy="true" aria-label={t("hubshell.loadingSubjects")} className="space-y-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
      {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
    </div>
  ));

  const family: FamilyCtx = tutor ?{ active: false, kids: [], childId: null, multi: false, confirmed: true, kid: false, providerName: "", tenantId: "", pick: () => undefined, handOver: () => undefined, messageHref: null } : {
    active: true, kids: hub.children.map((c) => ({ childId: c.childId, childName: c.childName })), childId: hub.childId, multi: hub.children.length > 1, confirmed: hub.childConfirmed, kid, routed: !!initialChildId,
    providerName: provider.name, tenantId,
    pick: (id) => { setError(null); hub.setChildId(id); },
    handOver: (id) => { hub.setChildId(id); const v = { t: tenantId, c: id }; writeKid(v); setKidRaw(v); go("home"); },
    messageHref: `/${portal}/messages?compose=1&tenant=${encodeURIComponent(tenantId)}`,
    support: hub.child?.support,
  };
  const exitKid = () => { writeKid(null); setKidRaw(null); };
  const kidName = hub.children.find((c) => c.childId === kidChildId)?.childName ?? "";

  return (
    <MascotSettingsProvider enabled calm={!!hub.child?.support?.calm}>
    <div className={kid ? "fixed inset-0 z-[320] overflow-y-auto overscroll-contain p-3 sm:p-5" : "-m-3 min-h-[calc(100vh-3.5rem)] p-3 sm:-m-5 sm:p-5"} style={{ background: "var(--bg)", color: "var(--ink)" }} id="learning-hub" data-kid={kid ? "1" : undefined} data-calm={!tutor && hub.child?.support?.calm ? "1" : undefined} data-text={!tutor && hub.child?.support?.textSize === "large" ? "large" : undefined}>
      <HubStyles />
      <HubWelcomeSplash tutor={tutor && !kid} />
      <FamilyProvider value={family}>
      <CallProvider p={panelProps} key={tenantId}>
      <div className="mx-auto max-w-[1240px]">
        {backHref && !kid && (
          <Link href={backHref} data-testid="hub-deep-back" className={`mb-3 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-1 text-[13px] font-extrabold text-[var(--brand)] ${FOCUS}`}>
            <Icon name="arrowLeft" size={16} className="rtl:-scale-x-100" />{t("hubshell.hm_backToChildToday", { name: firstName(hub.child?.childName) })}
          </Link>
        )}
        {kid ? (focus ? null : <KidBar name={kidName} onExit={exitKid} />) : focus && focusBare ? null : focus ? (!tutor ? null : (
          <div className="mb-3 flex min-h-[44px] items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3 shadow-[var(--shadow-sm)]" id="hub-focus-bar">
            <span className="grid h-7 w-7 flex-none place-items-center rounded-lg" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}><Icon name="sparkle" size={14} /></span>
            <span className="min-w-0 flex-1 truncate text-[13px] font-extrabold text-[var(--ink)]">{lbl(current.meta.label)}<span className="font-semibold text-[var(--ink-2)]"> · {t("hubshell.focusMode")}</span></span>
            <button type="button" onClick={() => setFocusFor(null)} className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 text-[12.5px] font-extrabold text-[var(--brand)] hover:bg-[var(--brand-soft)] ${FOCUS}`}>
              <Icon name="layers" size={15} /> {t("hubshell.showMenu")}
            </button>
          </div>
        )) : (
          <HubHero mode={mode} providers={providers} provider={provider} onProvider={onProvider} kids={hub.children} childId={hub.childId} onChild={onChild}
            topics={topics} noteStats={noteStats} activeStudents={activeStudents} ready={ready} compact={active !== "home"} />
        )}

        {!focus && <ChildSwitcher portal={portal} />}

        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} onRetry={refresh} hub={hubN} kid={kid} />}

        {tutor && !provider.canEdit && (
          <div role="status" id="hub-view-only" className="mb-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2.5 text-[13px] font-semibold text-[var(--ink-2)]">
            <b className="font-extrabold text-[var(--ink)]">{t("hubshell.viewOnlyTitle")}</b> {t("hubshell.viewOnlyBody")}
          </div>
        )}

        {!tutor && hub.childId &&<p role="status" aria-live="polite" aria-busy={!settled || undefined} className="sr-only" id="hub-child-live">{settled ? t("hubshell.showingChild", { name: hub.children.find((c) => c.childId === hub.childId)?.childName ?? t("hubshell.yourChild") }) : t("hubshell.loading")}</p>}

        {!focus && kid && bandOrDefault(hub.child?.yearGroup) === "ks1" ? <KidIconTabs active={active} onSelect={(k) => go(k as TabKey)} /> : null}
        {!focus && tutor && activeTop && (
          <>
            <HubTabs variant="top" tabs={topTabs} active={activeTop.id} onSelect={selectTop} className="mb-2"
              controls={(id) => (TUTOR_TOPS.find((t) => t.id === id)!.subs.length > 1 ? `hub-subtabs-${id}` : `hub-tabpanel-${active}`)} />
            {subList.length > 1 && activeSub && (
              <SubMenuCard key={activeTop.id} top={activeTop} subs={subList} active={activeSub.id} info={itemInfo} listId={`hub-subtabs-${activeTop.id}`} controls={`hub-tabpanel-${active}`}
                onSelect={(d, how) => selectSub(d, { focus: how !== "arrow" })} />
            )}
          </>
        )}
        {!focus && famNav && !forceOverview && famActiveTop && (
          <>
            {/* Mobile (<640px): a fixed N-column grid — never scrolls sideways, however narrow (brief: "bottom nav
                on mobile, tabs on desktop", and explicitly no horizontal scroll at 375px). Desktop: the usual strip. */}
            <FamilyTabBar active={famActiveTop.id} onSelect={selectFamTop} tops={famTops} kid={kid} />
            <HubTabs variant="top" tabs={famTopTabs} active={famActiveTop.id} onSelect={selectFamTop} className="mb-2 hidden sm:block"
              controls={(id) => (famTops.find((x) => x.id === id)!.subs.length > 1 ? `hub-famsubtabs-${id}` : `hub-tabpanel-${active}`)} />
            {famSubList.length > 1 && famActiveSub && (
              <HubTabs variant="sub" tabs={famSubTabs} active={famActiveSub.id} listId={`hub-famsubtabs-${famActiveTop.id}`} bleed={false} className="mb-3"
                onSelect={(id, how) => { const d = famSubById(id); if (d) selectFamSub(d, { focus: how !== "arrow" }); }} />
            )}
          </>
        )}

        {chips && !focus && topicFilter("chips")}

        {/* A tutor sending this child a live lesson: the invite shows on EVERY tab, not just Lessons. */}
        {/* Checks EVERY provider this child learns with, not only the one currently on screen: a tutor at a different
            provider than the family's default pick (a fresh browser starts on the first) was invisible before. */}
        {!tutor && !!tenantId && (providers ?? []).filter((p) => !!hub.childId && p.children.some((c) => c.childId === hub.childId)).map((p) => (
          <JoinRemoteSyncBanner key={p.tenantId} qs={`?tenantId=${encodeURIComponent(p.tenantId)}&childId=${encodeURIComponent(hub.childId!)}`} childId={hub.childId} config={config} topics={p.tenantId === tenantId ? topics : undefined} />
        ))}

        <div className={sidebar ? "grid items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)]" : ""}>
          {sidebar && <aside className="lg:sticky lg:top-3">{topicFilter("sidebar")}</aside>}

          <main className="min-w-0">
            {!kid && active === "home" && <FirstTimeTour role={tutor ? "tutor" : "parent"} />}
            {!kid && <TabHowTo tutor={tutor} tab={active} />}
            {/* Notes stays mounted (hidden) on other tabs so an unsaved draft survives a tab switch. */}
            {settled && (
              <div role="tabpanel" id="hub-tabpanel-notes" data-hub-panel aria-labelledby={tutor ? "hub-subtab-lessons" : "hub-tab-notes"} hidden={active !== "notes"} tabIndex={-1} className="outline-none" key={tenantId}>
                <NotesPanel topics={topics} version={notesVersion} listQs={childQs} covered={covered} filter={filter} canEdit={canEdit} readOnly={readOnly} franchiseId={provider.franchiseId ?? null} qs={qs} students={students} onChanged={refresh} onError={setError}
                  onDirtyChange={setDirty} active={active === "notes"}
                  childId={hub.childId} config={config} setFocus={setFocus} goTo={go as (k: "flashcards" | "homework") => void} years={hub.years} onYearsChange={hub.setYears} />
              </div>
            )}
            {active !== "notes" && (
              <div role="tabpanel" id={`hub-tabpanel-${active}`} data-hub-panel aria-busy={!settled || undefined} aria-labelledby={tutor && activeTop ? (activeTop.subs.length > 1 && activeSub ? `hub-subtab-${activeSub.id}` : `hub-tab-${activeTop.id}`) : `hub-tab-${active}`} tabIndex={-1} className="hub-rise outline-none" key={`${active}:${nonce}`}>{body}</div>
            )}
            {active === "notes" && !settled && <SkeletonRows rows={4} label={t("hubshell.loadingLessons")} variant="card" grid />}
          </main>
        </div>
      </div>
      </CallProvider>
      </FamilyProvider>
    </div>
    </MascotSettingsProvider>
  );
}

export const StudentLearningHubApp = () => <LearningHubApp mode="student" />;
export const TutorLearningHubApp = () => <LearningHubApp mode="tutor" />;

/** Level 2/3 routes (app/[portal]/learninghub/[childId]/…): the same hub, already pointed at one child (and,
 *  from an item route, one open item), with a real URL instead of relying on `?child=&open=` alone. */
export const StudentLearningHubDeep = ({ childId, initialTab, initialOpen, backHref }: { childId: string } & LearningHubDeepProps) => (
  <LearningHubApp mode="student" initialChildId={childId} initialTab={initialTab} initialOpen={initialOpen} backHref={backHref} />
);
