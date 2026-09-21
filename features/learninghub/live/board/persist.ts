"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api, get } from "@/lib/api";
import { withQs } from "../../teachKit";
import type { BoardController } from "./controller";
import { fitToLimit, type SavedPage } from "./model";

// The board's saved copy on the server: loaded once on mount, and (tutor only)
// autosaved ~5 s after the last change, when the tab is hidden and on leave.

export type SaveState = "idle" | "loading" | "saving" | "saved" | "error" | "toobig";
interface BoardDoc { pages: SavedPage[]; updatedAt: string | null; readOnly: boolean }
const LIMIT = 690_000;
const DEBOUNCE_MS = 5000;

export function useBoardPersistence(ctrl: BoardController | null, o: { lessonId: string; qs: string; isTutor: boolean; enabled: boolean }) {
  const [state, setState] = useState<SaveState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const savedVer = useRef(-1);
  const inflight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const path = `/api/learning-hub/lessons/${o.lessonId}/board${withQs(o.qs, {})}`;

  // ── load ──
  useEffect(() => {
    if (!ctrl || !o.enabled) return;
    let dead = false;
    void (async () => {
      try {
        const doc = await get<BoardDoc>(path);
        if (dead) return;
        // A live sync that already landed is fresher than the saved copy: keep it, just refresh the picture links.
        let kept = 0;
        if (!ctrl.loaded) kept = ctrl.loadSaved(doc.pages);
        else ctrl.refreshUrls(doc.pages);
        // drawn while loading: those elements are not in the saved copy yet — save them soon
        savedVer.current = kept ? ctrl.saveVersion - 1 : ctrl.saveVersion;
        setState(kept && o.isTutor ? "idle" : "saved");
        if (kept && o.isTutor) { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => { void saveRef.current(); }, DEBOUNCE_MS); }
      } catch (e) {
        if (dead) return;
        // No saved board (or none we can read): start blank; a tutor can still draw and it will save.
        if (!ctrl.loaded) ctrl.loadSaved(undefined);
        savedVer.current = ctrl.saveVersion;
        setState(o.isTutor ? "error" : "idle");
        if (o.isTutor) setError(e instanceof Error ? e.message : "Couldn't load the saved board");
      } finally { if (!dead) setLoaded(true); }
    })();
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctrl, path, o.enabled]);

  // ── save ──
  const save = useCallback(async (force = false, leaving = false) => {
    if (!ctrl || !o.isTutor || !ctrl.loaded) return;
    // A save still in flight when the debounce fires must not swallow this one (the edit made meanwhile would sit unsaved until the next change): try again shortly.
    if (inflight.current) { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => { void saveRef.current(force, leaving); }, 800); return; }
    if (!force && ctrl.saveVersion === savedVer.current) return;
    const ver = ctrl.saveVersion;
    const pages = fitToLimit(ctrl.getSaved(), LIMIT);
    if (!pages) { setState("toobig"); setError("This board is too big to save. Clear a page or delete some long drawings."); return; }
    inflight.current = true; setState("saving");
    try {
      const body = JSON.stringify({ pages });
      // Leaving the page: `keepalive` lets the request outlive it (browsers cap those bodies at 64 KB, so only small boards use it).
      await api(path, { method: "PUT", body, ...(leaving && body.length < 60_000 ? { keepalive: true } : {}) });
      savedVer.current = ver; setState(ctrl.saveVersion === ver ? "saved" : "saving"); setError(null);
    } catch (e) {
      const big = e instanceof ApiError && e.status === 413;
      setState(big ? "toobig" : "error");
      setError(e instanceof Error ? e.message : "Couldn't save the board");
    } finally { inflight.current = false; }
  }, [ctrl, o.isTutor, path]);

  const saveRef = useRef(save);
  useEffect(() => { saveRef.current = save; });

  // debounce on every change
  useEffect(() => {
    if (!ctrl || !o.isTutor || !loaded) return;
    const off = ctrl.subscribe(() => {
      if (ctrl.saveVersion === savedVer.current) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => { void saveRef.current(); }, DEBOUNCE_MS);
      setState((s) => (s === "saving" ? s : "idle"));
    });
    return () => { off(); if (timer.current) clearTimeout(timer.current); };
  }, [ctrl, o.isTutor, loaded]);

  // tab hidden / page leaving / component unmounting: save now
  useEffect(() => {
    if (!ctrl || !o.isTutor) return;
    const flush = () => { if (timer.current) clearTimeout(timer.current); void saveRef.current(false, true); };
    const vis = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("pagehide", flush);
    return () => { document.removeEventListener("visibilitychange", vis); window.removeEventListener("pagehide", flush); flush(); };
  }, [ctrl, o.isTutor]);

  return { state, error, loaded, saveNow: () => save(true) };
}
