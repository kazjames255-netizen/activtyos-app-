import type { Question } from "../shared-assess/api";

/** A Question back into a PUT body: pictures go as bare ids (never the signed urls the API showed us). */
export function toQuestionBody(x: Question, patch: Partial<{ published: boolean }> = {}) {
  return {
    topicId: x.topicId, kind: x.kind, prompt: x.prompt,
    options: (x.options ?? []).map((o) => ({ id: o.id, text: o.text, ...(o.image?.id ? { image: { id: o.image.id } } : {}) })),
    answer: x.answer,
    ...(x.pairs?.length ? { pairs: x.pairs } : {}), ...(x.items?.length ? { items: x.items } : {}),
    acceptedAnswers: x.acceptedAnswers ?? [], tolerance: x.tolerance ?? 0, marks: x.marks, explanation: x.explanation ?? "",
    published: patch.published ?? x.published, yearGroups: x.yearGroups ?? [],
    image: x.image?.id ? { id: x.image.id, alt: x.image.alt ?? "" } : null,
  };
}
