import type { ComponentType } from "react";

/** What every widget component receives. `onXP` gives the pupil a small reward (the player's XP pill). */
export interface WidgetProps { onXP: (n: number) => void }

/** A registered interactive "Explore" widget (lesson.widget = its id). */
export interface WidgetDef {
  id: string;
  title: string;
  /** One sentence telling the pupil what to try. */
  intro: string;
  Component: ComponentType<WidgetProps>;
  /** true = a plain-JS module from scratch/prototype/widgets mounted by <LegacyWidget>. */
  legacy?: boolean;
}
