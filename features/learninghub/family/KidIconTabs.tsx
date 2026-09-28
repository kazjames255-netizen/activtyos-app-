"use client";

import { useT } from "@/lib/i18n/provider";
import { FOCUS, Icon, type IconName } from "../kit";

// KS1 (Reception to Year 2) navigation (R-6): three big icon tabs. It is only a PRESENTATION of the same allow-listed KID_TABS: every
// button just selects one of those existing tabs (no new route, the whitelist in KidMode.tsx stays the single source, deep links
// like ?tab=quizzes keep working and light up "Play & learn"). "Play & learn" opens Quizzes; the rest is reached from the Home card.
const PLAY: readonly string[] = ["notes", "quizzes", "diagnostic", "homework", "flashcards", "questions", "live", "games"];
const ITEMS: { id: string; label: string; icon: IconName; to: string; on: (k: string) => boolean }[] = [
  { id: "today", label: "tabToday", icon: "home", to: "home", on: (k) => k === "home" },
  { id: "play", label: "tabPlay", icon: "play", to: "quizzes", on: (k) => PLAY.includes(k) },
  { id: "stars", label: "tabStars", icon: "sparkle", to: "dashboard", on: (k) => k === "dashboard" },
];

export function KidIconTabs({ active, onSelect }: { active: string; onSelect: (k: string) => void }) {
  const t = useT();
  return (
    <div role="tablist" aria-label={t("hubfam.tabSections")} data-testid="kid-icon-tabs" className="mb-4 grid grid-cols-3 gap-2">
      {ITEMS.map((it) => {
        const on = it.on(active);
        return (
          <button key={it.id} type="button" role="tab" aria-selected={on} data-testid={`kid-tab-${it.id}`} data-panel={it.to} onClick={() => onSelect(it.to)}
            className={`flex min-h-[76px] flex-col items-center justify-center gap-1 rounded-3xl border px-2 py-2 text-[15px] font-extrabold ${on ? "border-transparent bg-[var(--brand)] text-[var(--on-brand,#fff)]" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"} ${FOCUS}`}>
            <Icon name={it.icon} size={30} strokeWidth={2.2} />{t(`hubfam.${it.label}`)}
          </button>
        );
      })}
    </div>
  );
}
