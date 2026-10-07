"use client";

// First-run checklist for brand-new providers (company / freelancer / franchise).
// Every step ticks itself from real data (venues, blocks, listings, settings,
// Stripe status, invites) — no new server routes. Shown at the top of the
// Dashboard and as the empty state of Bookings; hidden for good once the
// provider has a published listing AND a booking, or taps Hide (remembered per
// tenant in localStorage).
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { useT } from "@/lib/i18n/provider";
import { BrandOnboardingCard } from "@/features/setup/BrandColours";
import { useFirstRunSteps, type StepId } from "@/features/dashboard/useFirstRunSteps";

export function FirstRunChecklist({ variant = "dashboard" }: { variant?: "dashboard" | "bookings" }) {
  const t = useT();
  const router = useRouter();
  const fr = useFirstRunSteps();
  const { steps, doneCount, allDone, store } = fr;

  if (!fr.enabled || !fr.ready || store.hidden) return null;
  // Established providers never see it.
  if (fr.established) return null;
  // On Bookings it's the empty state — only when there's nothing to list.
  if (variant === "bookings" && fr.hasBooking) return null;

  const nextId = fr.next?.id;
  const pct = Math.round((doneCount / steps.length) * 100);

  const hide = fr.hideCard;
  const go = (s: { id: StepId; href: string }) => {
    fr.markVisited(s.id);
    router.push(s.href);
  };

  return (
    <section data-testid="first-run-checklist" className="mb-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 text-[var(--ink)] shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[20px] font-extrabold leading-tight" style={{ fontFamily: "var(--ff-display)" }}>
            {allDone ? t("p9fr.doneTitle") : t("p9fr.title")}
          </h2>
          <p className="mt-1 text-[14px] leading-snug text-[var(--ink-2)]">{allDone ? t("p9fr.doneBody") : t("p9fr.sub")}</p>
        </div>
        <Button onClick={hide} data-testid="first-run-hide" className="!h-10 !px-4 !text-[14px]">{t("p9fr.hide")}</Button>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--line)]" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={doneCount}>
          <div className="h-full rounded-full bg-[var(--brand,#2f5fd0)] transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="whitespace-nowrap text-[14px] font-bold" data-testid="first-run-progress">{t("p9fr.progress", { n: doneCount, total: steps.length })}</span>
      </div>
      <ol className="mt-3 grid gap-2">
        {steps.map((s, i) => (
          <li key={s.id} data-testid={`first-run-step-${s.id}`} data-done={s.done ? "1" : "0"}
            className={"flex flex-wrap items-center gap-3 rounded-xl border px-3 py-3 " + (s.done ? "border-[var(--line)] bg-[var(--panel)]" : s.id === nextId ? "border-[var(--brand,#2f5fd0)] bg-[var(--surface)]" : "border-[var(--line)] bg-[var(--surface)]")}>
            <span aria-hidden className={"flex h-8 w-8 flex-none items-center justify-center rounded-full text-[15px] font-extrabold " + (s.done ? "bg-[#0f7a43] text-white" : "bg-[var(--line)] text-[var(--ink-2)]")}>{s.done ? "✓" : i + 1}</span>
            <div className="min-w-[10rem] flex-1">
              <div className={"text-[15px] font-bold leading-snug " + (s.done ? "text-[var(--ink-3)] line-through" : "")}>{t(`p9fr.${s.id}`)}</div>
              <div className="text-[14px] leading-snug text-[var(--ink-2)]">{t(`p9fr.${s.id}Hint`)}</div>
            </div>
            <button type="button" onClick={() => go(s)}
              className={"min-h-[44px] w-full rounded-xl px-4 text-[15px] font-bold sm:w-auto " + (s.done ? "border border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)]" : "bg-[var(--brand,#2f5fd0)] text-white hover:brightness-110")}>
              {s.done ? t("p9fr.review") : t(`p9fr.${s.id}Btn`)}
            </button>
          </li>
        ))}
      </ol>
      {variant === "dashboard" && !allDone && <BrandOnboardingCard />}
    </section>
  );
}
