/** One lesson (or quiz) as the shared picker shows it — the same shape whether it came from the paged /notes list or a curriculum cell. */
export interface PickItem {
  id: string; title: string; excerpt?: string; year?: number | null; subject?: string; /** card header colour (a CSS colour) */ color?: string;
  isLesson?: boolean; hasWorksheet?: boolean; worksheetQuizId?: string | null; hasQuiz?: boolean;
  /** quizzes only */ questionCount?: number; kind?: "quiz" | "diagnostic";
  /** The curriculum topic this lesson belongs to (when the source knows it — a plain `/notes` page does, a curriculum-map cell may not). */
  topicId?: string;
}
