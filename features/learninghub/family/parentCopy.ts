import { hubT, hubLocale, tp } from "./hubT";
// Parent-facing wording (R-9/P1 language pass) in ONE place. Plain words a parent uses, no teaching jargon
// ("diagnostic", "mastery", "attainment", "placement"). Only the parent screens use this: tutor wording is untouched,
// and a child's wording lives in kidCopy.ts. Tenant-set level names (settings.hub.masteryBands) are never renamed here.

const T = (k: string, v?: Record<string, string | number>) => hubT(`hubfam.${k}`, v);
// Getters (not fixed strings): also read by files outside hubfam, and must follow the active language.
export const PARENT_COPY = {
  get startingQuiz() { return T("pStartingQuiz"); },
  get takeStartingQuiz() { return T("pTakeStartingQuiz"); },
  get howTheyAreDoing() { return T("pHowDoing"); },
  get buildsWithQuizzes() { return T("pBuilds"); },
  get buildsBody() { return T("pBuildsBody"); },
  get levelWord() { return T("pLevel"); },
  get progressLoading() { return T("pProgress"); },
  get topicsTried() { return T("pTopicsTried"); },
  get startingPointNote() { return T("pStartNote"); },
  startingPointKey: (who: string) => T("pStartKey", { who }),
  get noQuizYetTitle() { return T("pNoQuizTitle"); },
  get reportButton() { return T("pReport"); },
  verdict: {
    get couldntCheck() { return T("vCouldnt"); },
    get onTrack() { return T("vOnTrack"); },
    get allDone() { return T("vAllDone"); },
  },
  get homeworkEmptyTitle() { return T("pHwEmptyTitle"); },
  get homeworkEmptyBody() { return T("pHwEmptyBody"); },
  noResultsBody: (first: string) => T("pNoResults", { first }),
  get tryAgain() { return T("pTryAgain"); },
  get reportLoadFailed() { return T("pReportFail"); },
};

/** "1 homework overdue" / "3 homework overdue" (per-locale plural forms; the child's name leads when given). */
export const overdueVerdict = (c: number, first?: string) => (first ? tp(hubT, hubLocale(), "hubfam.pOverdueNamed", c, { name: first }) : tp(hubT, hubLocale(), "hubfam.pOverdue", c));
