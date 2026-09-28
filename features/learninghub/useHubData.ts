"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { get, getActAs, primeHubReads } from "@/lib/api";
import { hubUrl } from "./home/homeLib";
import { useRealtime } from "@/lib/realtime";
import { HUB_DEFAULTS, mergeHub, type HubSettings } from "@/lib/hubConfig";
import { applySubjectColours } from "./subjectColour";
import { errMsg, type HubGroup, type HubProvider, type NoteStats, type Student, type Topic } from "./types";

// Everything the hub shell needs from the API, in one place: the providers a
// caller can open, the chosen provider / child, and that provider's topics,
// roster and config. Data is keyed by (provider, child) so switching
// either NEVER shows the previous one's rows — they're cleared, not stale.
//
// SCALE: a seeded provider has ~700 topics and ~450 notes, so the shell no longer downloads the note LIBRARY. First
// paint needs only topics + roster + config (after the provider list); the note counts the sidebar/hero show
// (GET /notes/counts) and the tutor's groups arrive a moment later and never block a tab. The Notes panel fetches its
// own (light, paginated) list — see NotesPanel.

const ls = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

// Stale-while-revalidate for the shell: the LAST payload this tab saw (providers, and per provider/child the topics + roster + config + counts) is put
// on screen immediately on a revisit / reload, while the real requests run and replace it. Per tab (sessionStorage), per mode, per "view as" account;
// the API stays the authority (a hub switched off since, or a removed child, is corrected the moment the answer lands). Skipped when huge.
const SW_MAX_CHARS = 2_000_000;
const swScope = (mode: string) => `aos.hub.sw.v1.${mode}.${getActAs()?.uid ?? "me"}`;
const swRead = <T,>(k: string): T | null => { try { const v = sessionStorage.getItem(k); return v ? (JSON.parse(v) as T) : null; } catch { return null; } };
const swWrite = (k: string, v: unknown) => { try { const j = JSON.stringify(v); if (j.length < SW_MAX_CHARS) sessionStorage.setItem(k, j); } catch { /* full / private mode */ } };

interface Bundle { key: string; topics: Topic[]; students: Student[]; config: HubSettings; groups: HubGroup[]; noteStats: NoteStats | null }
const REFETCH_AFTER_MS = 30_000; // signed attachment links are short-lived

export function useHubData(mode: "student" | "tutor", opts?: { initialChildId?: string }) {
  const initialChildId = opts?.initialChildId ?? null;
  const [providers, setProviders] = useState<HubProvider[] | null>(null);
  // Start from the remembered provider so topics/roster/config/counts can be fetched IN PARALLEL with the provider list (one round trip
  // less before first paint). Validated the moment the list lands: a stale pick just switches to the first provider.
  const [tenantId, setTenantIdRaw] = useState<string | null>(() => (typeof window === "undefined" ? null : ls.get("aos.hub.tenant")));
  const tenantIdRef = useRef(tenantId);
  useEffect(() => { tenantIdRef.current = tenantId; }, [tenantId]);
  const providersRef = useRef<HubProvider[] | null>(null);
  const [provTick, setProvTick] = useState(0);
  const [childPick, setChildPick] = useState<Record<string, string>>({});
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fetchedAt = useRef(0);
  // The Lessons tab's year-group filter — lifted up here (not local to NotesPanel) so the sidebar's counts
  // (GET /notes/counts) can be scoped by it too: they should always match what the list is actually showing.
  const [years, setYears] = useState<number[]>([]);

  useEffect(() => {
    // ONE round trip for the whole first paint: the shell's reads AND the Home tab's are fetched together by GET /bootstrap
    // (server: routes/hub/bootstrapApi.ts) and parked in lib/api.ts; the normal calls below and in the panels then resolve from
    // that. Needs the remembered provider (a first-ever visit has none: it goes the normal way). Any miss falls back on its own.
    const t = ls.get("aos.hub.tenant");
    const cold = !t; // nothing remembered: the server fills {T}/{C} from the caller's own first provider / child
    const T = t ?? "{T}";
    const q = `?tenantId=${T === "{T}" ? T : encodeURIComponent(T)}`;
    const c = mode === "student" ? (new URLSearchParams(window.location.search).get("child") ?? initialChildId ?? (t ? ls.get(`aos.hub.child.${t}`) : null) ?? (cold ? "{C}" : null)) : null;
    if (mode === "tutor" || c) {
      const enc = (x: string) => (x === "{C}" ? x : encodeURIComponent(x));
      const cq = c ? `${q}&childId=${enc(c)}` : q;
      const shell = ["/api/learning-hub/providers", `/api/learning-hub/topics${cq}`, `/api/learning-hub/students${q}`, `/api/learning-hub/config${q}`, `/api/learning-hub/notes/counts${cq}`];
      const home = mode === "tutor"
        ? [`/api/learning-hub/groups${q}`, hubUrl(q, "/lessons"), hubUrl(q, "/doubts"), hubUrl(q, "/homework/inbox"), hubUrl(q, "/attempts", { status: "pending_marking" }), hubUrl(q, "/attempts"),
           hubUrl(q, "/mastery/overview"), hubUrl(q, "/remote-sync/sessions", { status: "live" }), hubUrl(q, "/curriculum", { framework: "nc2014" })]
        : [hubUrl(q, "/lessons", { childId: c }), hubUrl(q, "/homework", { childId: c }), hubUrl(q, "/flashcards/due", { childId: c }), hubUrl(q, "/attempts", { childId: c }),
           hubUrl(q, "/mastery", { childId: c }), hubUrl(q, "/assessments", { childId: c }),
           hubUrl(cq, "/doubts"), hubUrl(cq, "/curriculum", { framework: "nc2014" }), hubUrl(cq, "/remote-sync/active")];
      void primeHubReads([...shell, ...home], { placeholders: cold });
    }
    // Head start from the last visit (see swRead above); the request below replaces it either way.
    const cached = swRead<HubProvider[]>(`${swScope(mode)}.providers`);
    if (cached && cached.length) { providersRef.current = cached; setProviders((cur) => cur ?? cached); }
    get<HubProvider[]>("/api/learning-hub/providers")
      .then((p) => {
        swWrite(`${swScope(mode)}.providers`, p);
        providersRef.current = p;
        setProviders(p);
        const saved = ls.get("aos.hub.tenant");
        const picked = (p.some((x) => x.tenantId === tenantIdRef.current) ? tenantIdRef.current : (p.find((x) => x.tenantId === saved) ?? p[0])?.tenantId) ?? null;
        // Persist the auto-picked tenant, not just the manually-switched one (setTenantId does that already): a
        // family with a single provider never calls setTenantId by hand, so `aos.hub.tenant` was never written —
        // meaning `tenantId`'s own lazy `useState` initializer read `null` on every later mount of this hook (real
        // bug hit live: the redesign's child switcher briefly showed "None of your providers have switched on the
        // Learning Hub" on every switch, because `!tenantId` was momentarily true again on the fresh mount, before
        // this same effect re-ran and fixed it a beat later).
        if (picked) ls.set("aos.hub.tenant", picked);
        setTenantIdRaw(picked);
        setProvTick((n) => n + 1); // a speculative shell fetch that failed before we knew who the caller is retries now
      })
      .catch((e) => { providersRef.current = []; setError(errMsg(e, "Couldn't load your lessons")); setProviders([]); });
  }, [mode]);

  const provider = providers?.find((p) => p.tenantId === tenantId) ?? null;
  const children = useMemo(() => provider?.children ?? [], [provider]);
  // A link that names the child (?child=…: a notification, a bookmark, a refresh) wins over the remembered pick.
  const [urlChild] = useState<string | null>(() => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("child") ?? initialChildId));
  // A family's chosen child (this session's tap, else the link's, else the last one remembered per provider); a tutor has none.
  // `confirmed` = it was chosen on purpose, not defaulted to the first child (the runners ask "Who's learning?" until it is).
  const { childId, childConfirmed } = useMemo(() => {
    if (mode !== "student" || !tenantId) return { childId: null as string | null, childConfirmed: true };
    const cands = [childPick[tenantId], urlChild, ls.get(`aos.hub.child.${tenantId}`)];
    // Providers not known yet: trust the remembered child so the shell data can start now (re-keyed if it turns out to be stale).
    if (!providers) return { childId: cands.find((x) => !!x) ?? null, childConfirmed: true };
    const hit = cands.find((x) => !!x && children.some((c) => c.childId === x)) ?? null;
    return { childId: hit ?? children[0]?.childId ?? null, childConfirmed: children.length < 2 || !!hit };
  }, [mode, tenantId, childPick, urlChild, children, providers]);

  // A panel reporting "the hub was switched off" (403 feature_off, whichever fetch hit it first) means
  // the provider list is now stale: re-read it, so the shell falls to the proper "isn't available"
  // page instead of leaving a live-looking hub with a red banner over empty panels.
  const reportError = useCallback((msg: string | null) => {
    setError(msg);
    if (msg && /switched on My Classroom|(Learning|Teaching) Hub is turned off|turned off for this account|switched the (Learning|Teaching) Hub on/i.test(msg)) {
      // A genuinely stale list (the hub really was switched off, or back on, elsewhere) should replace it — but a
      // transient failure of THIS re-check must never blank out a list we already know is good (real bug hit live:
      // switching child fires a burst of child-scoped requests; if any one of them transiently errors with
      // switched-off-shaped wording, this used to wipe `providers` to `[]` and flash "None of your providers have
      // switched on the Learning Hub" for an instant before the real page caught up). Only a genuine, successful
      // re-read of the provider list is trusted; a failed one just leaves the current list alone.
      get<HubProvider[]>("/api/learning-hub/providers").then(setProviders).catch(() => undefined);
    }
  }, []);
  const setTenantId = useCallback((id: string) => { ls.set("aos.hub.tenant", id); setTenantIdRaw(id); }, []);
  const setChildId = useCallback((id: string) => {
    if (!tenantId) return;
    ls.set(`aos.hub.child.${tenantId}`, id);
    setChildPick((m) => ({ ...m, [tenantId]: id }));
  }, [tenantId]);
  // `initialChildId` (from a Level 2/3 route's own [childId] segment) is only read ONCE, above, to seed state on
  // first mount — a real page load always gets a fresh mount. But the App Router can reuse this same component
  // across a client-side navigation between two routes that share the [childId] TEMPLATE (one child's page to a
  // sibling's), just handing it a new `initialChildId` prop — with nothing here to notice that, every panel kept
  // showing the child just left (real bug hit by the redesign's own child switcher). Re-derive the moment the
  // caller's own child id actually changes, exactly as if it had been tapped from the picker.
  const initialChildIdRef = useRef(initialChildId);
  useEffect(() => {
    if (initialChildId && initialChildId !== initialChildIdRef.current && tenantId) {
      initialChildIdRef.current = initialChildId;
      setChildId(initialChildId);
    }
  }, [initialChildId, tenantId, setChildId]);

  // Operators are pinned to their own tenant by the token; a family names the
  // provider it's reading. Sent either way — the server ignores it for tutors.
  const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : "";
  const childQs = childId ? `${qs}&childId=${encodeURIComponent(childId)}` : qs;
  const key = `${tenantId ?? ""}|${childId ?? ""}`;
  const keyRef = useRef(key);
  useEffect(() => { keyRef.current = key; }, [key]);

  const patchBundle = useCallback((mine: string, patch: Partial<Bundle>) => {
    if (keyRef.current !== mine) return;
    setBundle((b) => (b?.key === mine ? { ...b, ...patch } : b));
  }, []);
  // Note counts (sidebar badges, hero stats) — cheap, and separate so a note edit doesn't reload the whole shell.
  const [notesVersion, setNotesVersion] = useState(0);
  const fetchNoteStats = useCallback(() => {
    const yq = years.length ? `${childQs ? "&" : "?"}year=${years.join(",")}` : "";
    return get<NoteStats>(`/api/learning-hub/notes/counts${childQs}${yq}`).catch(() => null);
  }, [childQs, years]);
  const loadNoteStats = useCallback(() => {
    if (!tenantId) return;
    const mine = key;
    void fetchNoteStats().then((r) => { if (!r) return; patchBundle(mine, { noteStats: r }); setNotesVersion((v) => v + 1); });
  }, [tenantId, key, fetchNoteStats, patchBundle]);
  const fetchGroups = useCallback(() => {
    // Groups are tutor-only and optional: a parent, an older server or a failure just means "no groups".
    if (mode !== "tutor") return Promise.resolve(null);
    return get<HubGroup[]>(`/api/learning-hub/groups${qs}`).then((g) => (Array.isArray(g) ? g : [])).catch(() => null);
  }, [mode, qs]);
  const loadGroups = useCallback(() => {
    if (!tenantId || mode !== "tutor") return;
    const mine = key;
    void fetchGroups().then((g) => { if (g) patchBundle(mine, { groups: g }); });
  }, [tenantId, key, mode, fetchGroups, patchBundle]);

  const refresh = useCallback(() => {
    if (!tenantId) return;
    if (mode === "student" && !childId && providersRef.current === null) return; // nothing remembered to guess from: wait for the provider list
    const mine = key;
    // Counts and groups start NOW, alongside the shell data (they used to wait for it: one whole extra round trip), but never gate it.
    const statsP = fetchNoteStats();
    const groupsP = fetchGroups();
    Promise.all([
      get<Topic[]>(`/api/learning-hub/topics${childQs}`),
      get<Student[]>(`/api/learning-hub/students${qs}`).catch(() => [] as Student[]),
      get<{ hub?: Partial<HubSettings> }>(`/api/learning-hub/config${qs}`).then((r) => mergeHub(r?.hub)).catch(() => HUB_DEFAULTS),
    ])
      .then(([topics, students, config]) => {
        if (keyRef.current !== mine) return; // the caller moved on — drop the stale answer
        fetchedAt.current = Date.now();
        setBundle((b) => ({ groups: [], noteStats: null, ...(b?.key === mine ? b : {}), key: mine, topics, students, config }));
        setError(null);
        void groupsP.then((g) => { if (g) patchBundle(mine, { groups: g }); });
        void statsP.then((r) => {
          if (r) { patchBundle(mine, { noteStats: r }); setNotesVersion((v) => v + 1); }
          if (keyRef.current === mine) swWrite(`${swScope(mode)}.b.${mine}`, { topics, students, config, noteStats: r ?? null });
        });
      })
      .catch((e) => {
        if (keyRef.current !== mine) return;
        // Fired speculatively before the provider list arrived (a stale remembered pick can 403): stay quiet, the retry after the list lands decides.
        if (providersRef.current === null) return;
        setError(errMsg(e, "Couldn't load your lessons"));
        setBundle((b) => (b?.key === mine ? b : { key: mine, topics: [], students: [], groups: [], noteStats: null, config: HUB_DEFAULTS }));
      });
  }, [tenantId, key, mode, childId, qs, childQs, fetchNoteStats, fetchGroups, patchBundle]);

  // Show the remembered payload for this provider/child the moment the key is known (only while nothing better is on screen).
  useEffect(() => {
    if (!tenantId || bundle?.key === key) return;
    const c = swRead<Pick<Bundle, "topics" | "students" | "config" | "noteStats">>(`${swScope(mode)}.b.${key}`);
    if (c && Array.isArray(c.topics)) setBundle((b) => (b?.key === key ? b : { groups: [], ...c, key }));
  }, [tenantId, key, mode]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { refresh(); }, [refresh]);
  // The list of providers just landed while the speculative shell fetch had failed / not answered: make sure THIS key has a bundle.
  const haveBundleRef = useRef(false);
  useEffect(() => { haveBundleRef.current = bundle?.key === key; }, [bundle, key]);
  useEffect(() => { if (provTick > 0 && !haveBundleRef.current) refresh(); }, [provTick]); // eslint-disable-line react-hooks/exhaustive-deps
  // Only a change of the year filter re-reads the counts on its own (the first read rides along with refresh()).
  const firstYears = useRef(true);
  useEffect(() => { if (firstYears.current) { firstYears.current = false; return; } loadNoteStats(); }, [years]); // eslint-disable-line react-hooks/exhaustive-deps
  useRealtime(["hubTopics", "hubEnrolments"], refresh);
  // A family's note list/counts are now scoped to what's actually been assigned (server: GET /notes, /notes/counts),
  // so a newly-assigned lesson must refresh this the moment the homework naming their child is created — not just
  // when the library itself changes.
  useRealtime(["hubNotes", "hubHomework"], loadNoteStats);
  useRealtime(["hubGroups"], loadGroups);

  // Coming back to the tab: re-sign the attachment links if they've aged.
  useEffect(() => {
    const again = () => { if (document.visibilityState === "visible" && Date.now() - fetchedAt.current > REFETCH_AFTER_MS) refresh(); };
    document.addEventListener("visibilitychange", again);
    window.addEventListener("focus", again);
    return () => { document.removeEventListener("visibilitychange", again); window.removeEventListener("focus", again); };
  }, [refresh]);

  const ready = bundle?.key === key;
  // The tutor's subject colours (settings.hub.subjectColours) become CSS variables, so every chip / tile / card for a subject repaints at once —
  // families included: they read the same config through the same provider.
  const chosenColours = ready ? bundle!.config.subjectColours : undefined;
  useEffect(() => { if (chosenColours) applySubjectColours(chosenColours); }, [chosenColours]);
  const students = useMemo(() => (ready ? bundle!.students : []), [ready, bundle]);
  const groups = useMemo(() => (ready ? bundle!.groups : []), [ready, bundle]);
  const child = useMemo(() => students.find((s) => s.childId === childId) ?? null, [students, childId]);

  // A family sees only what its child is enrolled in (empty subjects = all). The
  // server enforces this too; narrowing here keeps the picker honest.
  const topics = useMemo(() => {
    if (!ready) return [] as Topic[];
    const allow = mode === "student" && child?.subjects?.length ? new Set(child.subjects) : null;
    return allow ? bundle!.topics.filter((x) => allow.has(x.subject)) : bundle!.topics;
  }, [ready, bundle, mode, child]);

  return {
    providers, provider, tenantId, setTenantId, children, childId, childConfirmed, setChildId, child,
    qs, childQs, ready, topics, noteStats: ready ? bundle!.noteStats : null, notesVersion, students, groups, config: ready ? bundle!.config : HUB_DEFAULTS,
    error, setError: reportError, refresh, years, setYears,
  };
}

// ── "is a lesson live right now?" ────────────────────────────────────────────
// Drives the pulsing dot on the Live lessons tab. One quiet GET /lessons (the
// Live panel does its own); any failure just means "no dot".
interface LessonLite { startsAt: string; durationMins: number; status: string }
export function useLiveNow(childQs: string, enabled: boolean): boolean {
  const [lessons, setLessons] = useState<{ key: string; rows: LessonLite[] } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const keyRef = useRef(childQs);
  useEffect(() => { keyRef.current = childQs; }, [childQs]);

  const load = useCallback(() => {
    if (!enabled || !childQs) return;
    const mine = childQs;
    get<unknown>(`/api/learning-hub/lessons${childQs}`)
      .then((r) => {
        if (keyRef.current !== mine) return;
        const rows = Array.isArray(r) ? r : Array.isArray((r as { lessons?: unknown })?.lessons) ? (r as { lessons: unknown[] }).lessons : [];
        setLessons({ key: mine, rows: rows as LessonLite[] });
      })
      .catch(() => { if (keyRef.current === mine) setLessons({ key: mine, rows: [] }); });
  }, [childQs, enabled]);
  useEffect(() => { load(); }, [load]);
  useRealtime(["hubLessons"], load);
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [enabled]);

  if (!enabled || lessons?.key !== childQs) return false;
  return lessons.rows.some((l) => {
    if (l.status === "cancelled" || l.status === "ended") return false;
    const start = new Date(l.startsAt).getTime();
    const end = start + l.durationMins * 60_000;
    return (l.status === "live" && now <= end + 30 * 60_000) || (now >= start && now <= end);
  });
}
