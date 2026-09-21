"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { get } from "@/lib/api";
import { useRealtime } from "@/lib/realtime";
import type { InboxRow, TutorHomework } from "../../homework/hwTypes";
import type { AttemptRow, FlashStatsLite, OverviewStudent } from "../../home/homeLib";
import { asArray } from "../../home/homeLib";
import { hubPath } from "../../shared-assess/api";

// The tutor's in-call workspace data: ONE aggregated call per resource (mastery
// overview, homework inbox + list, flashcard stats, attempts), fetched only when
// a tab that needs it is first opened, cached for the whole call (shared by every
// tab) and refreshed on realtime changes. The tabs filter to the lesson's
// attendees client-side — nothing here fans out per student.

export type WsKey = "overview" | "inbox" | "homework" | "flash" | "attempts";
const SPEC: Record<WsKey, { path: string; pick: (r: unknown) => unknown[] }> = {
  overview: { path: "/mastery/overview", pick: (r) => asArray<OverviewStudent>(r, "students") },
  inbox: { path: "/homework/inbox", pick: (r) => asArray<InboxRow>(r) },
  homework: { path: "/homework", pick: (r) => asArray<TutorHomework>(r) },
  flash: { path: "/flashcards/stats", pick: (r) => asArray<FlashStatsLite["students"][number]>(r, "students") },
  attempts: { path: "/attempts", pick: (r) => asArray<AttemptRow>(r) },
};

export interface WsData {
  overview: OverviewStudent[] | null;
  inbox: InboxRow[] | null;
  homework: TutorHomework[] | null;
  flash: FlashStatsLite["students"] | null;
  attempts: AttemptRow[] | null;
  /** Resources whose last fetch failed (a tab shows "couldn't load", never a fake empty). */
  failed: WsKey[];
  /** A tab announces what it needs; each resource is fetched at most once until a realtime change. */
  want: (keys: WsKey[]) => void;
  reload: () => void;
}

export function useWorkspaceData(qs: string, enabled: boolean): WsData {
  const [store, setStore] = useState<Partial<Record<WsKey, unknown[]>>>({});
  const [failed, setFailed] = useState<WsKey[]>([]);
  const wanted = useRef(new Set<WsKey>());
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const load = useCallback((k: WsKey) => {
    get<unknown>(hubPath(qs, SPEC[k].path))
      .then((r) => { if (alive.current) { setStore((s) => ({ ...s, [k]: SPEC[k].pick(r) })); setFailed((f) => f.filter((x) => x !== k)); } })
      .catch(() => { if (alive.current) setFailed((f) => (f.includes(k) ? f : [...f, k])); });
  }, [qs]);

  const want = useCallback((keys: WsKey[]) => {
    if (!enabled) return;
    for (const k of keys) if (!wanted.current.has(k)) { wanted.current.add(k); load(k); }
  }, [enabled, load]);
  const reload = useCallback(() => { for (const k of wanted.current) load(k); }, [load]);
  useRealtime(["hubHomework", "hubSubmissions", "hubAttempts", "hubMastery"], reload);

  return {
    overview: (store.overview as OverviewStudent[] | undefined) ?? null,
    inbox: (store.inbox as InboxRow[] | undefined) ?? null,
    homework: (store.homework as TutorHomework[] | undefined) ?? null,
    flash: (store.flash as FlashStatsLite["students"] | undefined) ?? null,
    attempts: (store.attempts as AttemptRow[] | undefined) ?? null,
    failed, want, reload,
  };
}
