"use client";

import { get, put } from "@/lib/api";
import type { Note, Topic } from "../types";
import { FOCUS } from "../teachKit";
import type { QuizLite, WorksheetRef } from "./hwTypes";
import { PreviewButton } from "./hwPreview";
import { LessonPicker } from "../lesson/picker/LessonPicker";
import type { PickItem } from "../lesson/picker/types";
import { useT } from "@/lib/i18n/provider";

// The homework form's pickers. A seeded provider has ~450 quizzes and ~450 lessons, so neither is a flat list any
// more: each is a search box over a SERVER-side search (`q`, `limit`), with the current choice always kept in the
// list so it never silently disappears while you type.

export type QuizPick = QuizLite & { published?: boolean };

/** Worksheet picker: a browsable card grid of every lesson that carries a worksheet (server `worksheet=1`, shown at once, paged, sorted subject › unit),
 *  with year / subject chips and search as an addition. Tick to attach (several), Preview before choosing. Chosen ones show as chips. */
export function WorksheetPicker({ qs, chosen, rows, onToggle, onPreview }: { qs: string; topics?: Topic[]; chosen: string[]; rows: Map<string, WorksheetRef>; onToggle: (w: WorksheetRef) => void; onPreview: (w: WorksheetRef) => void; yearGroups?: string[] }) {
  const t = useT();
  const ref = (it: PickItem): WorksheetRef => ({ noteId: it.id, title: it.title, ...(it.worksheetQuizId ? { quizId: it.worksheetQuizId } : {}) });
  return (
    <div className="grid gap-2" data-testid="hub-hw-worksheets">
      {chosen.length > 0 && (
        <div className="flex flex-wrap gap-1.5" data-testid="hub-hw-attached-worksheets" aria-label="Attached worksheets">
          {chosen.map((id) => { const w = rows.get(id); return (
            <span key={id} className="inline-flex min-h-[44px] max-w-full items-center gap-1 rounded-full border border-[var(--brand-line)] bg-[var(--brand-soft)] py-0.5 ps-3 pe-1 text-[12px] font-extrabold text-[var(--brand-strong)]">
              <span className="truncate">{w?.title ?? "A worksheet"}</span>
              {w && <PreviewButton label={`Preview worksheet ${w.title}`} testId="hub-hw-ws-chip-preview" onClick={() => onPreview(w)} />}
              <button type="button" aria-label={`Remove ${w?.title ?? "worksheet"}`} onClick={() => w && onToggle(w)} className={`grid h-11 w-11 place-items-center rounded-full hover:bg-[var(--surface)] ${FOCUS}`}>×</button>
            </span>); })}
        </div>
      )}
      <LessonPicker qs={qs} mode="multi" worksheetOnly lessonsOnly={false} published={false} value={chosen} idPrefix="hub-hw-ws" testId="hub-hw-ws-picker" kind="worksheet"
        searchLabel={t("hubpicker.searchWsPh")} emptyLibrary={t("hubpicker.worksheetsSoon")}
        onChange={(ids, items) => {
          const now = new Set(ids), had = new Set(chosen);
          for (const id of ids) if (!had.has(id)) { const it = items.find((x) => x.id === id); if (it) onToggle(ref(it)); }
          for (const id of chosen) if (!now.has(id)) { const w = rows.get(id); if (w) onToggle(w); }
        }}
        actions={(it) => <PreviewButton label={`Preview worksheet ${it.title}`} testId="hub-hw-ws-preview-btn" onClick={() => onPreview(ref(it))}>{t("hubpicker.openPreview")}</PreviewButton>} />
    </div>
  );
}

/** Publish a draft quiz from the homework form (same PUT the Quizzes tab's Publish button sends). */
export async function publishQuiz(qs: string, id: string): Promise<void> {
  const a = await get<{ type: string; title: string; subject: string; topicIds: string[]; questionIds?: string[]; timeLimitMins: number | null; passMarkPct: number; audience?: unknown; retakePolicy?: string; retakeCooldownHours?: number | null }>(`/api/learning-hub/assessments/${encodeURIComponent(id)}${qs}`);
  await put(`/api/learning-hub/assessments/${encodeURIComponent(id)}${qs}`, {
    type: a.type, title: a.title, subject: a.subject, topicIds: a.topicIds, questionIds: a.questionIds ?? [], timeLimitMins: a.timeLimitMins, passMarkPct: a.passMarkPct, published: true,
    ...(a.audience ? { audience: a.audience } : {}), ...(a.retakePolicy ? { retakePolicy: a.retakePolicy } : {}), ...(a.retakeCooldownHours != null ? { retakeCooldownHours: a.retakeCooldownHours } : {}),
  });
}

/** Publish a draft lesson (the server keeps its structured lesson / videos when they're omitted). */
export async function publishNote(qs: string, id: string): Promise<void> {
  const n = await get<Note>(`/api/learning-hub/notes/${encodeURIComponent(id)}${qs}`);
  await put(`/api/learning-hub/notes/${encodeURIComponent(id)}${qs}`, {
    topicId: n.topicId, title: n.title, body: n.body ?? "", published: true, attachments: (n.attachments ?? []).map((a) => ({ id: a.id, name: a.name })),
  });
}
