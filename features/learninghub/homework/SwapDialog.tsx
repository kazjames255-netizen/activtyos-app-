"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, FieldLabel } from "@/components/ui";
import { get, post } from "@/lib/api";
import { useT } from "@/lib/i18n/provider";
import { errMsg, type Student } from "../types";
import { Dialog, FOCUS, Notice, StudentPicker, withQs } from "../teachKit";
import { LessonPicker } from "../lesson/picker/LessonPicker";
import { QuizPicker } from "../lesson/picker/QuizPicker";
import type { InboxRow, TutorHomework } from "./hwTypes";

// Tutor: swap ONE item (quiz / lesson / worksheet) on a homework that is already set — for everyone still to do it, or only for chosen
// students — without deleting the homework. Anyone who has already handed in keeps the original (the server freezes their version), so
// their hand-in, attempts and marks are untouched. POST /homework/:id/swap; the server checks the new item and tells the families.

type Kind = "quiz" | "lesson" | "worksheet";
interface Item { kind: Kind; id: string; title: string }

export function SwapDialog({ homework, students, qs, onClose, onDone }: { homework: TutorHomework; students: Student[]; qs: string; onClose: () => void; onDone: () => void }) {
  const t = useT();
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [item, setItem] = useState<Item | null>(null);
  const [next, setNext] = useState<{ id: string; title: string } | null>(null);
  const [scope, setScope] = useState<"all" | "some">("all");
  const [childIds, setChildIds] = useState<string[]>([]);
  const [todo, setTodo] = useState<string[] | null>(null); // children who have not handed in yet
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  const wsTitle = useMemo(() => new Map((homework.worksheets ?? []).map((w) => [w.noteId, w.title] as const)), [homework.worksheets]);
  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    if (homework.assessmentId) out.push({ kind: "quiz", id: homework.assessmentId, title: titles[homework.assessmentId] ?? t("hubextras.sw_kind_quiz") });
    for (const id of homework.noteIds ?? []) out.push({ kind: "lesson", id, title: titles[id] ?? t("hubextras.sw_kind_lesson") });
    for (const id of homework.worksheetNoteIds ?? homework.worksheets?.map((w) => w.noteId) ?? []) out.push({ kind: "worksheet", id, title: wsTitle.get(id) ?? titles[id] ?? t("hubextras.sw_kind_ws") });
    return out;
  }, [homework, titles, wsTitle, t]);

  // Names for the quiz and the lessons (the list only carries their ids).
  useEffect(() => {
    let live = true;
    const wanted: [string, string][] = [];
    if (homework.assessmentId) wanted.push([homework.assessmentId, "assessments"]);
    for (const id of homework.noteIds ?? []) wanted.push([id, "notes"]);
    void Promise.all(wanted.map(([id, path]) => get<{ title?: string }>(`/api/learning-hub/${path}/${encodeURIComponent(id)}${withQs(qs, {})}`).then((r) => [id, r.title ?? ""] as const).catch(() => [id, ""] as const)))
      .then((rows) => { if (live) setTitles(Object.fromEntries(rows.filter(([, v]) => v))); });
    return () => { live = false; };
  }, [homework.assessmentId, homework.noteIds, qs]);

  // Who has not handed in yet (a partial swap is only for them).
  useEffect(() => {
    let live = true;
    get<InboxRow[]>(`/api/learning-hub/homework/inbox${withQs(qs, { status: "assigned" })}`)
      .then((rows) => { if (live) setTodo([...new Set((Array.isArray(rows) ? rows : []).filter((r) => r.homeworkId === homework.id).map((r) => r.childId))]); })
      .catch(() => { if (live) setTodo([]); });
    return () => { live = false; };
  }, [qs, homework.id]);
  const who = useMemo(() => students.filter((s) => (todo ?? []).includes(s.childId)), [students, todo]);

  const canGo = !!item && !!next && !busy && (scope === "all" || childIds.length > 0);
  const go = async () => {
    if (!item || !next) return;
    setBusy(true); setErr(null);
    try {
      const r = await post<{ changed: number }>(`/api/learning-hub/homework/${encodeURIComponent(homework.id)}/swap${withQs(qs, {})}`, {
        kind: item.kind, fromId: item.id, toId: next.id, ...(scope === "some" ? { childIds } : {}),
      });
      setDone(r.changed);
    } catch (e) { setErr(errMsg(e, t("hubextras.sw_err"))); } finally { setBusy(false); }
  };

  const kindLabel = (k: Kind) => t(k === "quiz" ? "hubextras.sw_kind_quiz" : k === "lesson" ? "hubextras.sw_kind_lesson" : "hubextras.sw_kind_ws");
  const pickLabel = item ? t(item.kind === "quiz" ? "hubextras.sw_pick_quiz" : item.kind === "lesson" ? "hubextras.sw_pick_lesson" : "hubextras.sw_pick_ws") : "";

  return (
    <Dialog id="hub-hw-swap" plain size="xl" title={t("hubextras.sw_title")} subtitle={homework.title} onClose={done !== null ? onDone : onClose}
      footer={done !== null
        ? <Button variant="solid" className={`min-h-[44px] ${FOCUS}`} onClick={onDone} data-testid="hub-hw-swap-close">{t("hubextras.sw_close")}</Button>
        : <>
          <Button variant="ghost" className={`min-h-[44px] ${FOCUS}`} onClick={onClose}>{t("hubshell.k_close")}</Button>
          <Button variant="solid" className={`min-h-[44px] ${FOCUS}`} disabled={!canGo} onClick={() => void go()} data-testid="hub-hw-swap-go">{busy ? t("hubextras.sw_working") : t("hubextras.sw_do")}</Button>
        </>}>
      <div className="grid gap-5">
        {err && <Notice onClose={() => setErr(null)}>{err}</Notice>}
        {done !== null ? (
          <p role="status" data-testid="hub-hw-swap-done" className="m-0 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4 text-[15px] font-extrabold text-[var(--ink)]">✅ {t("hubextras.sw_done", { n: done })}</p>
        ) : items.length === 0 ? (
          <p className="m-0 text-[14px] text-[var(--ink-2)]">{t("hubextras.sw_none")}</p>
        ) : (
          <>
            <section aria-labelledby="hub-sw-which" className="grid gap-2">
              <div id="hub-sw-which" className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]">{t("hubextras.sw_which")}</div>
              <div role="radiogroup" aria-labelledby="hub-sw-which" className="grid gap-1.5">
                {items.map((it) => {
                  const on = item?.id === it.id && item.kind === it.kind;
                  return (
                    <button key={`${it.kind}:${it.id}`} type="button" role="radio" aria-checked={on} data-testid="hub-hw-swap-item" onClick={() => { setItem(it); setNext(null); }}
                      className={`flex min-h-[48px] items-center gap-3 rounded-xl border-2 px-3 text-start text-[13.5px] font-bold ${FOCUS} ${on ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"}`}>
                      <span className="rounded-full bg-[var(--panel)] px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink-3)]">{kindLabel(it.kind)}</span>
                      <span className="min-w-0 flex-1 truncate">{it.title}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            {item && (
              <section className="grid gap-2" data-testid="hub-hw-swap-picker">
                <FieldLabel>{t("hubextras.sw_with")}: {pickLabel}</FieldLabel>
                {next && <p className="m-0 rounded-xl border-2 border-[var(--brand)] bg-[var(--brand-soft)] px-3 py-2 text-[13.5px] font-extrabold text-[var(--brand-strong)]" data-testid="hub-hw-swap-next">{next.title}</p>}
                {item.kind === "quiz" ? (
                  <QuizPicker qs={qs} value={next ? [next.id] : []} idPrefix="hub-sw-quiz" testId="hub-sw-quiz-picker"
                    onChange={(ids, picked) => { const id = ids.find((x) => x !== next?.id) ?? ids[0]; const p = picked.find((x) => x.id === id); setNext(id && id !== item.id ? { id, title: p?.title ?? id } : null); }} />
                ) : (
                  <LessonPicker qs={qs} mode="single" value={next ? [next.id] : []} idPrefix="hub-sw-lesson" testId="hub-sw-lesson-picker"
                    {...(item.kind === "worksheet" ? { worksheetOnly: true, lessonsOnly: false, published: false, kind: "worksheet" } : {})}
                    onChange={(ids, picked) => { const id = ids[0]; const p = picked.find((x) => x.id === id); setNext(id && id !== item.id ? { id, title: p?.title ?? id } : null); }} />
                )}
              </section>
            )}

            {item && next && (
              <section aria-labelledby="hub-sw-who" className="grid gap-2">
                <div id="hub-sw-who" className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]">{t("hubextras.sw_who")}</div>
                <div role="radiogroup" aria-labelledby="hub-sw-who" className="grid gap-1.5">
                  {(["all", "some"] as const).map((v) => (
                    <button key={v} type="button" role="radio" aria-checked={scope === v} data-testid={`hub-hw-swap-scope-${v}`} onClick={() => setScope(v)}
                      className={`min-h-[48px] rounded-xl border-2 px-3 text-start text-[13.5px] font-bold ${FOCUS} ${scope === v ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-strong)]" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"}`}>
                      {t(v === "all" ? "hubextras.sw_all" : "hubextras.sw_some")}
                    </button>
                  ))}
                </div>
                {scope === "some" && (todo !== null && who.length === 0
                  ? <p className="m-0 text-[13px] text-[var(--ink-2)]">{t("hubextras.sw_nostudents")}</p>
                  : <StudentPicker students={who} value={childIds} onChange={setChildIds} idPrefix="hub-sw-student" />)}
                <p className="m-0 text-[12.5px] text-[var(--ink-3)]">{t("hubextras.sw_kept")}</p>
              </section>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
