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
// Languages (French/German/Spanish…) has no curriculum checklist of its own, so its topic names are
// grammar-shaped ("Modal verbs", "Adjectives, agreement…") and used to fall through to the English
// grammar/punctuation 🧱 brick — wrong subject, ugly on a sticker. Checked first, before the general table,
// whenever the caller says this area belongs to the languages group.
const LANGUAGE_EMOJI: [RegExp, string][] = [
  [/greet|introduc|family|myself/i, "👋"], [/food|drink|meal/i, "🍽️"], [/school|classroom/i, "🎒"], [/holiday|travel|country|place/i, "✈️"],
  [/weather/i, "☀️"], [/animal|pet/i, "🐾"], [/hobby|sport|free time|leisure/i, "⚽"], [/house|home|room/i, "🏠"], [/body|health/i, "🩺"], [/cloth/i, "👕"],
  [/number|count/i, "🔢"], [/time|date|calendar/i, "🕐"], [/opinion|prefer|like/i, "💭"], [/culture|festival/i, "🎉"],
];
export const emojiFor = (area: string, strand = "", group = ""): string => {
  // Never fall through to the English/Maths/Science table for languages: its strands are literally
  // labelled "Grammar"/"Vocabulary" etc, which would otherwise keep matching the wrong-subject 🧱 brick.
  if (group === "languages") return LANGUAGE_EMOJI.find(([re]) => re.test(area))?.[1] ?? LANGUAGE_EMOJI.find(([re]) => re.test(strand))?.[1] ?? "🗣️";
  return EMOJI.find(([re]) => re.test(area))?.[1] ?? EMOJI.find(([re]) => re.test(strand))?.[1] ?? "⭐";
};
