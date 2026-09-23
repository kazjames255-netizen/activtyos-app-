import type { PanelMeta } from "./panelTypes";

// `?tab=` values other than a panel key. The keys themselves never change (they are in notifications, emails and old bookmarks:
// ?tab=diagnostic, ?tab=tools, ?tab=questions&open=doubt:...), so this only maps the NEW vocabulary names people may type or later
// links may use onto the existing keys. Runs BEFORE the "is this tab allowed" checks (a child's explicit allow-list, the module list),
// so an alias can never open a tab the audience is not allowed to see.
type TabKey = PanelMeta["key"];
export const TAB_ALIAS: Record<string, TabKey> = {
  placement: "diagnostic",
  "placement-test": "diagnostic",
  starting: "diagnostic",
  "starting-quiz": "diagnostic",
  "starting-quizzes": "diagnostic",
  messages: "questions",
  message: "questions",
  "message-centre": "questions",
  lessons: "notes",
  progress: "dashboard",
};

/** The panel key a `?tab=` value means (alias, then as-is). Null for an empty value. */
export function resolveTab(raw: string | null | undefined): TabKey | null {
  const t = (raw ?? "").trim().toLowerCase();
  if (!t) return null;
  return (TAB_ALIAS[t] ?? t) as TabKey;
}
