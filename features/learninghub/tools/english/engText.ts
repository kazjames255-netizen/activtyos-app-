import type { Frame } from "./frames";

// UI-layer translation helpers for the English writing tools (namespace `hubtoolsb`, keys `eng_*`).
// Frame DATA (frames.ts) stays English: sentence starters, model examples and word-bank WORDS are English writing content the pupil writes in.
// Only the instructional text (titles, headings, prompts, checklists, bank labels) is looked up here, falling back to the English in the data.

type T = (k: string, v?: Record<string, string | number>) => string;

const look = (t: T, suffix: string, fallback: string): string => {
  const k = `hubtoolsb.eng_f_${suffix}`;
  const v = t(k);
  return v && v !== k ? v : fallback;
};

/** A copy of the frame with its instructional text translated. Ids, starters, examples and bank words are untouched. */
export function localiseFrame(t: T, f: Frame): Frame {
  return {
    ...f,
    title: look(t, `${f.id}_title`, f.title),
    sections: f.sections.map((s) => ({
      ...s,
      heading: look(t, `${f.id}_${s.id}_heading`, s.heading),
      prompt: look(t, `${f.id}_${s.id}_prompt`, s.prompt),
      checklist: s.checklist?.map((c, i) => look(t, `${f.id}_${s.id}_cl${i}`, c)),
    })),
    overallChecklist: f.overallChecklist.map((c, i) => look(t, `${f.id}_oc${i}`, c)),
    banks: f.banks?.map((b, i) => ({ ...b, label: look(t, `${f.id}_bank${i}`, b.label) })),
  };
}

/** Maps the (English, selftest-asserted) advice strings from textstats.ts to translated text. Unknown strings pass through. */
export function tipText(t: T, tip: string, nf: (n: number) => string): string {
  if (tip === "One sentence is very long. Could you split it in two?") return t("hubtoolsb.eng_tipLong");
  if (tip === "Try a short sentence for impact.") return t("hubtoolsb.eng_tipShort");
  if (tip === "Try one longer sentence that adds extra detail with a connective.") return t("hubtoolsb.eng_tipLonger");
  let m = /^(\d+) sentences in a row start with the same word\./.exec(tip);
  if (m) return t("hubtoolsb.eng_openRun", { n: nf(Number(m[1])) });
  m = /^(\d+) sentences start with "(.*)"\. Try/.exec(tip);
  if (m) return t("hubtoolsb.eng_openTop", { n: nf(Number(m[1])), word: m[2]! });
  return tip;
}

export function readingText(t: T, label: string, nf: (n: number) => string): string {
  if (label === "nothing yet") return t("hubtoolsb.eng_readNothing");
  if (label === "under a minute") return t("hubtoolsb.eng_readUnder");
  const m = /^about (\d+) min$/.exec(label);
  return m ? t("hubtoolsb.eng_readAbout", { n: nf(Number(m[1])) }) : label;
}
