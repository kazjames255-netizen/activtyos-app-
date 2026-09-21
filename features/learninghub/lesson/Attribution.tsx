import type { Lesson } from "./types";
import { isOak, OGL_URL } from "./types";

/** The Open Government Licence credit an Oak lesson MUST show (docs/oak-import.md). Other sources show their own attribution line. */
export function Attribution({ lesson }: { lesson: Lesson }) {
  const s = lesson.source;
  if (isOak(lesson)) {
    return (
      <footer className="mt-6 text-center text-[12.5px] leading-relaxed text-[var(--ink-3)]" data-testid="lesson-attribution">
        A {lesson.subject || "school"} lesson by Oak National Academy licensed under{" "}
        <a href={OGL_URL} target="_blank" rel="noopener noreferrer" className="font-bold text-[var(--brand-2)] underline underline-offset-2">Open Government Licence (OGL)</a>
        {s.url && <> · <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-bold text-[var(--brand-2)] underline underline-offset-2">source lesson</a></>}
      </footer>
    );
  }
  return s.attribution ? <footer className="mt-6 text-center text-[12.5px] text-[var(--ink-3)]" data-testid="lesson-attribution">{s.attribution}</footer> : null;
}
