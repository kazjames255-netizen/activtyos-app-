"use client";

// Persistent slim "finish setting up" bar for providers (company / franchise /
// freelancer). Mounted once in app/[portal]/layout.tsx under the Header so it
// follows the provider across every page until the first-run steps are done.
// Shares its data with the Dashboard card via useFirstRunSteps (one cached set
// of reads). "Hide for today" snoozes until tomorrow; there is deliberately no
// permanent dismiss while setup is incomplete.
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/provider";
import { useHoScope } from "@/components/franchise/HoScope";
import { useFirstRunSteps, type StepId } from "@/features/dashboard/useFirstRunSteps";

export function SetupBanner() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const hoScope = useHoScope();
  const fr = useFirstRunSteps();
  const [open, setOpen] = useState(false);

  if (!fr.enabled || !fr.ready || fr.established || fr.allDone || fr.snoozed || !fr.next) return null;
  // A head office looking at a franchisee's combined view sees that franchise's data, not its own setup.
  if (hoScope) return null;
  // The full card owns the Dashboard while it is visible.
  const seg = pathname.split("/")[2] ?? "";
  if ((seg === "dash" || seg === "dashboard") && !fr.store.hidden) return null;

  const go = (s: { id: StepId; href: string }) => { fr.markVisited(s.id); setOpen(false); router.push(s.href); };
  const nextLabel = t(`p9fr.${fr.next.id}`);
  const btn = "inline-flex min-h-[44px] items-center justify-center whitespace-nowrap rounded-xl px-3 text-[14px] font-bold";

  return (
    <div data-testid="setup-banner" className="print:hidden border-b border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]" style={{ maxWidth: "100vw" }}>
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 sm:px-5">
        <span aria-hidden className="text-[16px]">🚀</span>
        <div className="min-w-0 flex-1 truncate whitespace-nowrap text-[14px] leading-snug sm:basis-auto">
          <span className="font-extrabold max-sm:hidden">{t("p9fr.title")}</span>
          <span className="font-extrabold sm:hidden">{t("p9fr.bnShort")}</span>
          <span className="text-[var(--ink-2)]"> · <span data-testid="setup-banner-progress">{t("p9fr.progress", { n: fr.doneCount, total: fr.steps.length })}</span>
            <span className="max-sm:hidden"> · {t("p9fr.bnNext", { step: nextLabel })}</span></span>
        </div>
        <div className="flex flex-none items-center gap-1">
          <button type="button" data-testid="setup-banner-continue" onClick={() => go(fr.next!)}
            className={btn + " bg-[var(--brand,#2f5fd0)] text-white hover:brightness-110"}>{t("p9fr.bnContinue")}</button>
          <button type="button" data-testid="setup-banner-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}
            className={btn + " text-[var(--ink-2)] hover:bg-[var(--panel)] max-sm:hidden"}>{open ? t("p9fr.bnHideSteps") : t("p9fr.bnSeeAll")} {open ? "▴" : "▾"}</button>
          <button type="button" data-testid="setup-banner-toggle-m" aria-expanded={open} aria-label={t("p9fr.bnSeeAll")} onClick={() => setOpen((o) => !o)}
            className={btn + " text-[var(--ink-2)] hover:bg-[var(--panel)] sm:hidden"}>{open ? "▴" : "▾"}</button>
          <button type="button" data-testid="setup-banner-snooze" aria-label={t("p9fr.bnHideTodayAria")} onClick={fr.snoozeToday}
            className={btn + " text-[var(--ink-2)] hover:bg-[var(--panel)]"}><span className="max-sm:hidden">{t("p9fr.bnHideToday")} </span>×</button>
        </div>
      </div>
      {open && (
        <ol data-testid="setup-banner-panel" className="grid gap-1 border-t border-[var(--line)] px-3 py-2 sm:px-5 md:grid-cols-2">
          {fr.steps.map((s, i) => (
            <li key={s.id} data-done={s.done ? "1" : "0"} className="flex min-w-0 items-center gap-2">
              <span aria-hidden className={"flex h-7 w-7 flex-none items-center justify-center rounded-full text-[13px] font-extrabold " + (s.done ? "bg-[#0f7a43] text-white" : "bg-[var(--line)] text-[var(--ink-2)]")}>{s.done ? "✓" : i + 1}</span>
              <span className={"min-w-0 flex-1 text-[14px] font-semibold leading-snug " + (s.done ? "text-[var(--ink-3)] line-through" : "")}>{t(`p9fr.${s.id}`)}</span>
              <button type="button" onClick={() => go(s)}
                className={"min-h-[44px] flex-none rounded-xl px-3 text-[14px] font-bold " + (s.done ? "border border-[var(--line)] text-[var(--ink-2)]" : "bg-[var(--brand,#2f5fd0)] text-white")}>
                {s.done ? t("p9fr.review") : t(`p9fr.${s.id}Btn`)}
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
