// Sticker-book wording and pictures for the CHILD view (KS1/KS2). Kind words only: no percentages, no "overdue", no "gap".
export const STICKER_COPY = {
  title: (name: string, year: number) => `${name}’s Year ${year} sticker book`,
  titleNoName: (year: number) => `My Year ${year} sticker book`,
  intro: "Finish a lesson to win a sticker.",
  got: "Got it!",
  next: "Next up",
  stars: (n: number) => `${n} out of 5 stars`,
  empty: "Your stickers will show up here soon.",
  teenTitle: "My progress by topic",
  teenDone: "Done",
  teenNotYet: "Not started",
  lessons: (n: number) => `${n} ${n === 1 ? "lesson" : "lessons"}`,
} as const;

const EMOJI: [RegExp, string][] = [
  [/fraction|decimal|percent/i, "🍕"], [/place value|counting|number and/i, "🔢"], [/addition|subtraction|add\b/i, "➕"], [/multipl|division|times/i, "✖️"],
  [/position|direction|coordinate/i, "🧭"], [/shape|geometry|angle|symmetry/i, "🔷"], [/measure|length|mass|capacity|time|money/i, "📏"], [/statistic|data|graph/i, "📊"],
  [/algebra|sequence|equation/i, "🧩"], [/ratio|proportion/i, "⚖️"], [/probab/i, "🎲"],
  [/read|comprehension|story|fiction/i, "📖"], [/writ|composition/i, "✏️"], [/spell/i, "🔤"], [/grammar|punctuation/i, "🧱"], [/vocab|word/i, "💬"], [/poet|poem|drama/i, "🎭"],
  [/plant/i, "🌱"], [/animal|habitat|living/i, "🦋"], [/human|body|nutrition|skeleton/i, "🫀"], [/material|matter|state|solid|liquid|gas/i, "🧪"], [/force|magnet/i, "🧲"],
  [/light|shadow/i, "💡"], [/sound/i, "🔊"], [/electric|circuit/i, "⚡"], [/earth|space|sun|moon/i, "🪐"], [/rock|soil|fossil/i, "🪨"], [/evolution|inherit/i, "🧬"],
];
export const emojiFor = (area: string, strand = ""): string => EMOJI.find(([re]) => re.test(area))?.[1] ?? EMOJI.find(([re]) => re.test(strand))?.[1] ?? "⭐";
