import { Avatar, Icon } from "../kit";
import type { RsSession } from "./api";

// The live tile shape shared by the tutor's "Live — where each student is" grid (one per roster child) and the
// student's own "My progress" card (one, for themself) — same data shape (RsSession["liveAnswers"][number]),
// same rendering, so the two views can never silently drift apart.

/** own_pace's step order for the mini step-tracker on each card — mirrors LessonPlayer's own header tracker
 *  (Start → Learn/Lesson/Key words → Warm-up → Quiz → Done), just at a smaller scale and a fixed canonical order
 *  (a given lesson may skip some of these — that's fine, the dots just show how far through THIS shape a child is). */
export const MINI_STEPS: { id: string; label: string }[] = [
  { id: "start", label: "Start" }, { id: "learn", label: "Learn" }, { id: "slides", label: "Lesson" },
  { id: "words", label: "Key words" }, { id: "warm", label: "Warm-up" }, { id: "quiz", label: "Quiz" }, { id: "done", label: "Done" },
];
/** Recent enough that this child is very likely still actively typing/selecting right now. */
const TYPING_MS = 2000;

export const previewOf = (r: unknown): string => {
  if (r === undefined) return "Nothing yet…";
  if (typeof r === "string") return r || "Nothing yet…";
  if (typeof r === "number") return String(r);
  if (Array.isArray(r)) return r.length ? `${r.length} selected` : "Nothing yet…";
  return "Nothing yet…";
};

export function MiniScreenCard({ childName, connected, live, questionCount }: { childName: string; connected: boolean; live?: RsSession["liveAnswers"][number]; questionCount?: number }) {
  if (!connected) {
    return (
      <div data-ui="card" className="grid min-h-[110px] place-items-center rounded-xl border border-dashed border-[var(--line)] bg-[var(--panel)] px-4 py-3.5 text-center opacity-70">
        <div>
          <Avatar name={childName} size={32} />
          <div className="mt-1.5 truncate text-[13.5px] font-extrabold text-[var(--ink)]">{childName}</div>
          <div className="mt-1 text-[12px] text-[var(--ink-3)]">Waiting for {childName.split(" ")[0]} to join</div>
        </div>
      </div>
    );
  }

  const step = live?.step ?? "start";
  const idx = Math.max(0, MINI_STEPS.findIndex((s) => s.id === step));
  const label = MINI_STEPS.find((s) => s.id === step)?.label ?? step;
  const onWarm = step === "warm";
  const onQuiz = step === "quiz";
  const typing = !!live?.updatedAt && Date.now() - new Date(live.updatedAt).getTime() < TYPING_MS;
  const hasVerdict = onWarm && typeof live?.verdict === "boolean";
  const correct = hasVerdict ? live!.verdict : null;

  return (
    <div data-ui="card" data-testid="mini-screen-card" className="overflow-hidden rounded-xl border border-[#0a4a30] bg-[var(--surface)]">
      <div className="flex items-center gap-2.5 px-4 py-3"
        style={{
          backgroundImage: "linear-gradient(135deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 32%), linear-gradient(155deg, #0e8f52 0%, #0a6b3d 55%, #06452a 100%)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25)",
        }}>
        <Avatar name={childName} size={32} />
        <div className="min-w-0 flex-1 truncate text-[15px] font-extrabold text-white">{childName}</div>
        {!!questionCount && (
          <span className="grid h-5 min-w-[20px] flex-none place-items-center rounded-full px-1 text-[10.5px] font-extrabold" style={{ background: "#F59E0B", color: "#3A2400" }} aria-label={`${questionCount} unread question${questionCount === 1 ? "" : "s"}`}>{questionCount}</span>
        )}
        <div className="flex-none text-[12px] font-extrabold text-white/85">
          {onWarm || onQuiz ? (correct === true ? "Correct!" : correct === false ? "Not quite" : label) : "In lesson"}
        </div>
      </div>
      <div className="px-4 py-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-extrabold uppercase tracking-[0.05em] text-[var(--ink-3)]">{label}</span>
          <span className="flex-none text-[11px] font-extrabold text-[var(--ink-3)]">{idx + 1} / {MINI_STEPS.length}</span>
        </div>
        <div className="mt-2 flex gap-[3px]" aria-hidden>
          {MINI_STEPS.map((s, i) => <span key={s.id} className="h-1.5 flex-1 rounded-full" style={{ background: i <= idx ? "#0a6b3d" : "var(--line)" }} />)}
        </div>
        {onWarm || onQuiz ? (
          <>
            {live?.questionPrompt && <p className="m-0 mt-2.5 line-clamp-2 text-[13.5px] leading-snug text-[var(--ink-2)]">Q: {live.questionPrompt}</p>}
            <div className="mt-1.5 truncate text-[15px] font-extrabold text-[var(--ink)]">
              {typing ? <span className="text-[var(--brand)]">Typing…</span> : previewOf(live?.response)}
            </div>
            {correct !== null && (
              <div className={`mt-2.5 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-extrabold ${correct ? "bg-[var(--green-soft)] text-[var(--hub-green-ink)]" : "bg-[var(--red-soft)] text-[var(--red)]"}`}>
                <Icon name={correct ? "check" : "close"} size={15} strokeWidth={3} />{correct ? "Correct!" : "Not quite"}
              </div>
            )}
            {onQuiz && live?.questionId && (
              <div className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-[var(--panel)] px-2.5 py-1.5 text-[13px] font-extrabold text-[var(--ink-2)]">
                <Icon name="check" size={15} strokeWidth={3} />Answered — score known after they finish
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
