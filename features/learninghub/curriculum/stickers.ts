// Sticker-book wording and pictures for the CHILD view (KS1/KS2). Kind words only: no percentages, no "overdue", no "gap".
export type Tr = (key: string, vars?: Record<string, string | number>) => string;
/** The sticker book's kind wording, in the active language (pass `t` from useT()). */
export const stickerCopy = (t: Tr) => ({
  // `allYears`: this family's lesson access isn't limited to the child's own year (Setup → Teaching Hub
  // "Lessons students can open" = every lesson / by year), so naming ONE year in the title would be wrong —
  // say "all year groups" instead of guessing which year is on show.
  title: (name: string, year: number, allYears?: boolean) => allYears ? t("hublessons.scTitleAllYears", { name }) : t("hublessons.scTitle", { name, year }),
  titleNoName: (year: number, allYears?: boolean) => allYears ? t("hublessons.scTitleAllYearsNoName") : t("hublessons.scTitleNoName", { year }),
  intro: t("hublessons.scIntro"),
  got: t("hublessons.scGot"),
  next: t("hublessons.scNext"),
  stars: (n: number) => t("hublessons.scStars", { n }),
  empty: t("hublessons.scEmpty"),
  teenTitle: t("hublessons.scTeenTitle"),
  teenDone: t("hublessons.stepDone"),
  teenNotYet: t("hublessons.scTeenNotYet"),
});

const EMOJI: [RegExp, string][] = [
  [/fraction|decimal|percent/i, "🍕"], [/place value|counting|number and/i, "🔢"], [/addition|subtraction|add\b/i, "➕"], [/multipl|division|times/i, "✖️"],
  [/position|direction|coordinate/i, "🧭"], [/shape|geometry|angle|symmetry/i, "🔷"], [/measure|length|mass|capacity|time|money/i, "📏"], [/statistic|data|graph/i, "📊"],
  [/algebra|sequence|equation/i, "🧩"], [/ratio|proportion/i, "⚖️"], [/probab/i, "🎲"],
  [/read|comprehension|story|fiction/i, "📖"], [/writ|composition/i, "✏️"], [/spell/i, "🔤"], [/grammar|punctuation/i, "🧱"], [/vocab|word/i, "💬"], [/poet|poem|drama/i, "🎭"],
  [/plant/i, "🌱"], [/animal|habitat|living/i, "🦋"], [/human|body|nutrition|skeleton/i, "🫀"], [/material|matter|state|solid|liquid|gas/i, "🧪"], [/force|magnet/i, "🧲"],
  [/light|shadow/i, "💡"], [/sound/i, "🔊"], [/electric|circuit/i, "⚡"], [/earth|space|sun|moon/i, "🪐"], [/rock|soil|fossil/i, "🪨"], [/evolution|inherit/i, "🧬"],
];
export const emojiFor = (area: string, strand = ""): string => EMOJI.find(([re]) => re.test(area))?.[1] ?? EMOJI.find(([re]) => re.test(strand))?.[1] ?? "⭐";
