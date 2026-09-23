"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { get } from "@/lib/api";
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

interface Bundle { key: string; topics: Topic[]; students: Student[]; config: HubSettings; groups: HubGroup[]; noteStats: NoteStats | null }
const REFETCH_AFTER_MS = 30_000; // signed attachment links are short-lived

export function useHubData(mode: "student" | "tutor") {
  const [providers, setProviders] = useState<HubProvider[] | null>(null);
  const [tenantId, setTenantIdRaw] = useState<string | null>(null);
  const [childPick, setChildPick] = useState<Record<string, string>>({});
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fetchedAt = useRef(0);
  // The Lessons tab's year-group filter — lifted up here (not local to NotesPanel) so the sidebar's counts
  // (GET /notes/counts) can be scoped by it too: they should always match what the list is actually showing.
  const [years, setYears] = useState<number[]>([]);

  useEffect(() => {
    get<HubProvider[]>("/api/learning-hub/providers")
      .then((p) => {
        setProviders(p);
        const saved = ls.get("aos.hub.tenant");
        setTenantIdRaw((cur) => cur ?? (p.find((x) => x.tenantId === saved) ?? p[0])?.tenantId ?? null);
      })
      .catch((e) => { setError(errMsg(e, "Couldn't load your lessons")); setProviders([]); });
  }, []);

  const provider = providers?.find((p) => p.tenantId === tenantId) ?? null;
  const children = useMemo(() => provider?.children ?? [], [provider]);
  // A link that names the child (?child=…: a notification, a bookmark, a refresh) wins over the remembered pick.
  const [urlChild] = useState<string | null>(() => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("child")));
  // A family's chosen child (this session's tap, else the link's, else the last one remembered per provider); a tutor has none.
  // `confirmed` = it was chosen on purpose, not defaulted to the first child (the runners ask "Who's learning?" until it is).
  const { childId, childConfirmed } = useMemo(() => {
    if (mode !== "student" || !tenantId) return { childId: null as string | null, childConfirmed: true };
    const cands = [childPick[tenantId], urlChild, ls.get(`aos.hub.child.${tenantId}`)];
    const hit = cands.find((x) => !!x && children.some((c) => c.childId === x)) ?? null;
    return { childId: hit ?? children[0]?.childId ?? null, childConfirmed: children.length < 2 || !!hit };
  }, [mode, tenantId, childPick, urlChild, children]);

  // A panel reporting "the hub was switched off" (403 feature_off, whichever fetch hit it first) means
  // the provider list is now stale: re-read it, so the shell falls to the proper "isn't available"
  // page instead of leaving a live-looking hub with a red banner over empty panels.
  const reportError = useCallback((msg: string | null) => {
    setError(msg);
    if (msg && /switched on My Classroom|(Learning|Teaching) Hub is turned off|turned off for this account|switched the (Learning|Teaching) Hub on/i.test(msg)) {
      get<HubProvider[]>("/api/learning-hub/providers").then(setProviders).catch(() => setProviders([]));
    }
  }, []);
  const setTenantId = useCallback((id: string) => { ls.set("aos.hub.tenant", id); setTenantIdRaw(id); }, []);
  const setChildId = useCallback((id: string) => {
    if (!tenantId) return;
    ls.set(`aos.hub.child.${tenantId}`, id);
    setChildPick((m) => ({ ...m, [tenantId]: id }));
  }, [tenantId]);

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
  const loadNoteStats = useCallback(() => {
    if (!tenantId) return;
    const mine = key;
    const yq = years.length ? `${childQs ? "&" : "?"}year=${years.join(",")}` : "";
    get<NoteStats>(`/api/learning-hub/notes/counts${childQs}${yq}`)
      .then((r) => { patchBundle(mine, { noteStats: r }); setNotesVersion((v) => v + 1); })
      .catch(() => undefined);
  }, [tenantId, key, childQs, years, patchBundle]);
  const loadGroups = useCallback(() => {
    if (!tenantId || mode !== "tutor") return;
    const mine = key;
    // Groups are tutor-only and optional: a parent, an older server or a failure just means "no groups".
    get<HubGroup[]>(`/api/learning-hub/groups${qs}`).then((g) => patchBundle(mine, { groups: Array.isArray(g) ? g : [] })).catch(() => undefined);
  }, [tenantId, key, qs, mode, patchBundle]);

  const refresh = useCallback(() => {
    if (!tenantId) return;
    const mine = key;
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
        loadGroups();
        loadNoteStats();
      })
      .catch((e) => {
        if (keyRef.current !== mine) return;
        setError(errMsg(e, "Couldn't load your lessons"));
        setBundle((b) => (b?.key === mine ? b : { key: mine, topics: [], students: [], groups: [], noteStats: null, config: HUB_DEFAULTS }));
      });
  }, [tenantId, key, qs, childQs, loadGroups, loadNoteStats]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { loadNoteStats(); }, [years, loadNoteStats]);
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
