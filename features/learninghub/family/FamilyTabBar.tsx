"use client";

import { useT } from "@/lib/i18n/provider";
import { useLbl } from "../hubLabel";
import { FOCUS } from "../kit";
import { FAMILY_TOPS } from "../familyGroups";

// The Level 2 family top nav (Today/Homework/Learn/Progress — 4 sections after the owner dropped the standalone
// Tools tab). Below `sm`, HubTabs' usual horizontally-scrolling pill row genuinely overflowed at 375px once every
// section was shown with an emoji + label (measured ~140px of scroll on a real run, back when there were 5). A tab
// bar that scrolls sideways fails the brief outright, so mobile gets its own layout here: a fixed N-column grid
// (bottom-nav styling — icon over a small label) that can never overflow because each column is exactly 1/N of
// the available width, however narrow. Desktop keeps the normal HubTabs strip (rendered by the caller).
export function FamilyTabBar({ active, onSelect }: { active: string; onSelect: (id: string) => void }) {
  const t = useT();
  const lbl = useLbl();
  return (
    <nav aria-label={t("hubshell.sections")} data-testid="hub-family-tabbar-mobile" className="mb-2 grid gap-0.5 sm:hidden" style={{ gridTemplateColumns: `repeat(${FAMILY_TOPS.length}, minmax(0, 1fr))` }} role="tablist">
      {FAMILY_TOPS.map((top) => {
        const on = top.id === active;
        return (
          <button key={top.id} type="button" role="tab" id={`hub-tab-${top.id}`} aria-selected={on} data-top={top.id}
            aria-controls={`hub-tabpanel-${top.subs[0]!.key}`} onClick={() => onSelect(top.id)}
            className={`flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-1.5 ${FOCUS} ${on ? "font-extrabold" : "font-bold"}`}
            style={on ? { background: "var(--brand-soft)", color: "var(--brand-strong)" } : { color: "var(--ink-2)" }}>
            <span aria-hidden="true" className="text-[19px] leading-none" style={{ fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif' }}>{top.emoji}</span>
            <span className="w-full truncate text-center text-[10.5px] leading-tight">{lbl(top.label)}</span>
          </button>
        );
      })}
    </nav>
  );
}
