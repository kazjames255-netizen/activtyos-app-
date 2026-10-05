"use client";

// Shown on the page of a set-up step once that step is done: says so, offers the next step, and lets the
// provider say "not yet" (they want to add more venues / blocks / listings first). Dismissal is per step
// and per browser session, so it comes back next time but never nags within a visit.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { useT } from "@/lib/i18n/provider";
import { useFirstRunSteps, type StepId } from "@/features/dashboard/useFirstRunSteps";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const key = (step: StepId) => `aos.stepprompt.${step}`;
const seen = (step: StepId) => { try { return window.sessionStorage.getItem(key(step)) === "1"; } catch { return false; } };

export function StepDonePrompt({ step }: { step: "venue" | "block" | "listing" | "pay" | "cancel" }) {
  const t = useT();
  const router = useRouter();
  const fr = useFirstRunSteps();
  const [gone, setGone] = useState(() => typeof window !== "undefined" && seen(step));
  const me = fr.steps.find((s) => s.id === step);
  const next = fr.next;
  if (gone || !fr.enabled || !fr.ready || fr.established || fr.store.hidden) return null;
  if (!me?.done || !next || next.id === step) return null;
  const dismiss = () => { try { window.sessionStorage.setItem(key(step), "1"); } catch { /* shown again next time */ } setGone(true); };
  const more = t(`p9fr.spMore${cap(step)}`);
  return (
    <div data-testid="step-done-prompt" className="mb-3 rounded-2xl border border-[#b9dfc9] bg-[#eefaf2] p-3.5 text-[var(--ink)] sm:p-4">
      <div className="text-[15px] font-extrabold text-[#0f7a43]">✓ {t(`p9fr.sp${cap(step)}`)}</div>
      <div className="mt-0.5 text-[14px] text-[var(--ink-2)]">{t("p9fr.spNext", { step: t(`p9fr.${next.id}`) })}</div>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => { fr.markVisited(next.id); router.push(next.href); }}>{t(`p9fr.${next.id}Btn`)} →</Button>
        <Button onClick={dismiss}>{t("p9fr.spNotYet")} — {more}</Button>
      </div>
    </div>
  );
}
