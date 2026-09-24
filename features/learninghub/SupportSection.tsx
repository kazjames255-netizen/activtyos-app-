"use client";

import { FOCUS } from "./kit";
import { cleanSupport, type SupportProfile } from "./support";

// R-5: the tutor's compact "Support" section (enrol dialog + student details). Tutor-only: the server refuses this
// from a family account. Nothing here is required; leaving it alone keeps today's behaviour.

const box = "h-5 w-5 flex-none accent-[var(--brand)]";
const row = `flex min-h-[44px] items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[13px] font-bold text-[var(--ink)] ${FOCUS}`;

export function SupportSection({ id, value, onChange }: { id: string; value: SupportProfile; onChange: (v: SupportProfile) => void }) {
  const set = (p: Partial<SupportProfile>) => onChange(cleanSupport({ ...value, ...p }));
  return (
    <fieldset data-testid="hub-support-section" className="m-0 min-w-0 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3">
      <legend className="px-1 text-[12px] font-extrabold uppercase tracking-[0.06em] text-[var(--ink-2)]">Support</legend>
      <p className="m-0 mb-2 text-[12px] leading-snug text-[var(--ink-2)]">Set by you only. The child and family can&apos;t change it.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className={row}><input type="checkbox" className={box} checked={value.noTimer} onChange={(e) => set({ noTimer: e.target.checked })} data-testid="support-notimer" />No timer on quizzes</label>
        <label className={row}><input type="checkbox" className={box} checked={value.calm} onChange={(e) => set({ calm: e.target.checked })} data-testid="support-calm" />Calm mode (no streaks, XP, confetti or motion)</label>
        <label className={row}><input type="checkbox" className={box} checked={value.readAloudDefault} onChange={(e) => set({ readAloudDefault: e.target.checked })} data-testid="support-readaloud" />Read answers aloud too</label>
        <label className={`${row} justify-between`} htmlFor={`${id}-extra`}>
          <span>Extra time</span>
          <select id={`${id}-extra`} disabled={value.noTimer} value={value.extraTimePercent} onChange={(e) => set({ extraTimePercent: Number(e.target.value) as 0 | 25 | 50 })} className="min-h-[36px] rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 text-[13px] font-bold">
            <option value={0}>None</option><option value={25}>+25%</option><option value={50}>+50%</option>
          </select>
        </label>
        <label className={`${row} justify-between`} htmlFor={`${id}-text`}>
          <span>Text size</span>
          <select id={`${id}-text`} value={value.textSize} onChange={(e) => set({ textSize: e.target.value as "normal" | "large" })} className="min-h-[36px] rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2 text-[13px] font-bold">
            <option value="normal">Normal</option><option value="large">Large</option>
          </select>
        </label>
      </div>
    </fieldset>
  );
}
