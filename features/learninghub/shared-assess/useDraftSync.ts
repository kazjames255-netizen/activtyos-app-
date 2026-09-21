"use client";

import { useEffect, useRef } from "react";
import { draftBody, pushDraft } from "./draft";
import { isAnswered, type Answer } from "./QuestionView";

/** Keeps a running paper's answers-so-far on the server (PUT /attempts/:id/draft), debounced, so "Resume" also works on another
 *  device. Quiet: a failure just means the local copy (draft.ts) is what a resume uses. Nothing is sent once `enabled` is false
 *  (before the paper starts, after hand-in, read-only preview). A change still waiting when the runner closes is sent then. */
export function useDraftSync(path: string | null, answers: Record<string, Answer>, idx: number, enabled: boolean) {
  const sent = useRef("");
  const pending = useRef<{ path: string; body: ReturnType<typeof draftBody>; sig: string } | null>(null);
  const live = useRef(enabled);
  live.current = enabled;

  useEffect(() => {
    if (!enabled || !path) { pending.current = null; return; }
    const body = draftBody(answers, idx, isAnswered);
    const sig = JSON.stringify(body);
    if (sig === sent.current || (!body.answers.length && !sent.current)) { pending.current = null; return; }
    pending.current = { path, body, sig };
    const t = setTimeout(() => { void pushDraft(path, body).then((ok) => { if (ok) sent.current = sig; if (pending.current?.sig === sig) pending.current = null; }); }, 1200);
    return () => clearTimeout(t);
  }, [path, answers, idx, enabled]);

  useEffect(() => () => {
    const p = pending.current;
    if (p && live.current) void pushDraft(p.path, p.body);
  }, []);
}
