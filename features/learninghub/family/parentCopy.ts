// Parent-facing wording (R-9/P1 language pass) in ONE place. Plain words a parent uses, no teaching jargon
// ("diagnostic", "mastery", "attainment", "placement"). Only the parent screens use this: tutor wording is untouched,
// and a child's wording lives in kidCopy.ts. Tenant-set level names (settings.hub.masteryBands) are never renamed here.

export const PARENT_COPY = {
  startingQuiz: "Starting quiz",
  takeStartingQuiz: "Take the starting quiz",
  howTheyAreDoing: "How they're doing",
  buildsWithQuizzes: "Progress builds with every quiz",
  buildsBody: "After a few quizzes you'll see the strongest subject and where to focus next.",
  levelWord: "level",
  progressLoading: "progress",
  topicsTried: "Topics tried",
  startingPointNote: "starting quiz result",
  startingPointKey: (who: string) => `marks ${who} starting quiz result`,
  noQuizYetTitle: "Your progress starts with the first quiz",
  reportButton: "Progress report",
  verdict: {
    couldntCheck: "We couldn't check homework just now",
    onTrack: "On track",
    allDone: "All done this week",
  },
  homeworkEmptyTitle: "Nothing to hand in",
  homeworkEmptyBody: "New homework from the tutor will show up here.",
  noResultsBody: (first: string) => `${first}'s first quiz result will appear here.`,
  tryAgain: "Try again",
  reportLoadFailed: "We couldn't build the report just now. Please try again.",
} as const;

/** "1 homework overdue" / "3 homework overdue": the count leads, "homework" stays singular like the word means. */
export const overdueVerdict = (c: number, first?: string) => `${first ? first + ": " : ""}${c} homework overdue`;
