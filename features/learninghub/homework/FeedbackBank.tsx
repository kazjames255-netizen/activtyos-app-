"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { get, put } from "@/lib/api";
import { useT } from "@/lib/i18n/provider";
import { errMsg } from "../types";
import { Dialog, FOCUS, Notice, withQs } from "../teachKit";

// A tutor's saved marking comments: the ones they type most, kept once (server: routes/hub/feedbackBankApi.ts, one small list per tutor) and
// offered as one-tap chips in the marking dialog. Add / edit / delete / reorder are all "edit the list, then save it".

interface Bank { snippets: string[]; max: number; maxLen: number }
const DEFAULTS: Bank = { snippets: [], max: 30, maxLen: 200 };

/** The tutor's saved comments (loaded once per open dialog; `enabled` false for a view-only role, which has no list). */
export function useFeedbackBank(qs: string, enabled: boolean) {
  const [bank, setBank] = useState<Bank>(DEFAULTS);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    get<Bank>(`/api/learning-hub/feedback-bank${withQs(qs, {})}`).then((b) => { if (live && Array.isArray(b?.snippets)) setBank({ ...DEFAULTS, ...b }); }).catch(() => undefined); // no list is fine: the built-in chips still work
    return () => { live = false; };
  }, [qs, enabled]);
  const save = useCallback(async (snippets: string[]) => {
    const b = await put<Bank>(`/api/learning-hub/feedback-bank${withQs(qs, {})}`, { snippets });
    setBank({ ...DEFAULTS, ...b });
  }, [qs]);
  return { ...bank, save };
}

/** The manager: edit the list in a draft, Done saves it. */
export function FeedbackManager({ snippets, max, maxLen, onSave, onClose }: { snippets: string[]; max: number; maxLen: number; onSave: (s: string[]) => Promise<void>; onClose: () => void }) {
  const t = useT();
  const [draft, setDraft] = useState<string[]>(snippets);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const full = draft.length >= max;
  const add = () => { const v = text.replace(/\s+/g, " ").trim(); if (!v || full) return; setDraft((d) => (d.some((x) => x.toLowerCase() === v.toLowerCase()) ? d : [...d, v.slice(0, maxLen)])); setText(""); };
  const move = (i: number, by: -1 | 1) => setDraft((d) => { const j = i + by; if (j < 0 || j >= d.length) return d; const c = [...d]; [c[i], c[j]] = [c[j], c[i]]; return c; });
  const done = async () => {
    setBusy(true); setErr(null);
    const pending = text.replace(/\s+/g, " ").trim();
    const list = pending && !full && !draft.some((x) => x.toLowerCase() === pending.toLowerCase()) ? [...draft, pending.slice(0, maxLen)] : draft; // a comment typed but not yet "Added" is not lost
    try { await onSave(list); onClose(); } catch (e) { setErr(errMsg(e, t("hubextras.fb_err"))); } finally { setBusy(false); }
  };
  const btn = `grid h-11 w-11 place-items-center rounded-lg border border-[var(--line)] bg-[var(--surface)] text-[14px] font-extrabold text-[var(--ink-2)] hover:bg-[var(--panel)] disabled:opacity-40 ${FOCUS}`;
  return (
    <Dialog id="hub-feedback-bank" plain size="lg" title={t("hubextras.fb_title")} subtitle={t("hubextras.fb_limit", { n: max, len: maxLen })} onClose={onClose}
      footer={<Button variant="solid" className={`min-h-[44px] ${FOCUS}`} disabled={busy} onClick={() => void done()} data-testid="hub-fb-done">{busy ? t("hubextras.fb_saving") : t("hubextras.fb_done")}</Button>}>
      <div className="grid gap-3">
        {err && <Notice onClose={() => setErr(null)}>{err}</Notice>}
        <div className="flex gap-2">
          <input value={text} maxLength={maxLen} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} disabled={full}
            placeholder={t("hubextras.fb_ph")} aria-label={t("hubextras.fb_ph")} data-testid="hub-fb-input"
            className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 text-[13.5px] text-[var(--ink)] outline-none focus:border-[var(--brand)]" />
          <Button variant="solid" className={`min-h-[44px] ${FOCUS}`} disabled={!text.trim() || full} onClick={add} data-testid="hub-fb-add">{t("hubextras.fb_add")}</Button>
        </div>
        {draft.length === 0 ? (
          <p className="m-0 text-[13px] text-[var(--ink-3)]">{t("hubextras.fb_empty")}</p>
        ) : (
          <ul className="m-0 grid list-none gap-1.5 p-0" data-testid="hub-fb-list">
            {draft.map((s, i) => (
              <li key={`${i}:${s}`} className="flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1.5">
                <input value={s} maxLength={maxLen} onChange={(e) => setDraft((d) => d.map((x, k) => (k === i ? e.target.value : x)))} aria-label={s}
                  className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 text-[13.5px] text-[var(--ink)] outline-none focus:border-[var(--brand)]" />
                <button type="button" className={btn} disabled={i === 0} onClick={() => move(i, -1)} aria-label={t("hubextras.fb_up")} title={t("hubextras.fb_up")}>▲</button>
                <button type="button" className={btn} disabled={i === draft.length - 1} onClick={() => move(i, 1)} aria-label={t("hubextras.fb_down")} title={t("hubextras.fb_down")}>▼</button>
                <button type="button" className={btn} onClick={() => setDraft((d) => d.filter((_, k) => k !== i))} aria-label={t("hubextras.fb_del")} title={t("hubextras.fb_del")} data-testid="hub-fb-del">✕</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
