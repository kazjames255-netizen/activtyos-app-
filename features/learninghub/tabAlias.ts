import type { PanelMeta } from "./panelTypes";
import { subById, validSub } from "./tabGroups";

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
  lessons: "notes",
  progress: "dashboard",
  "live-lessons": "live",
  messages: "questions",
  message: "questions",
  "message-centre": "questions",
};

/** The panel key a `?tab=` value means (alias, then as-is). Null for an empty value. */
export function resolveTab(raw: string | null | undefined): TabKey | null {
  const t = (raw ?? "").trim().toLowerCase();
  if (!t) return null;
  return (TAB_ALIAS[t] ?? t) as TabKey;
}

/** Old-vocabulary `?tab=` values that also name a sub-tab of the grouped tutor strip (a bare panel key needs none: it has a default). */
export const SUB_ALIAS: Record<string, string> = {
  schedule: "schedule", "schedule-video-lesson": "schedule", "teach-in-person": "teach", enrol: "enrol", "enrol-a-student": "enrol",
  "new-quiz": "newquiz", "set-homework": "set", "to-mark": "mark", inbox: "inbox",
};

/** `?tab=` + optional `?sub=` -> the panel key and (validated) sub-tab id. `?tab=diagnostic` -> {diagnostic, null}; `?tab=set-homework` -> {homework, "set"}. */
export function resolveTarget(rawTab: string | null | undefined, rawSub?: string | null): { key: TabKey; sub: string | null } | null {
  const t = (rawTab ?? "").trim().toLowerCase();
  if (!t) return null;
  const viaSub = SUB_ALIAS[t] ? subById(SUB_ALIAS[t]) : null;
  if (viaSub) return { key: viaSub.key, sub: viaSub.id };
  const key = resolveTab(t);
  return key ? { key, sub: validSub(key, (rawSub ?? "").trim().toLowerCase()) } : null;
}
