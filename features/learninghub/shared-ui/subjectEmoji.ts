// One emoji per subject for card faces and deck tiles (child + tutor flashcards). Pure TS.
export function subjectEmoji(subject: string | null | undefined): string {
  const s = (subject ?? "").toLowerCase();
  if (/math|number|algebra|geometry|statistic/.test(s)) return "🧮";
  if (/english|literature|reading|writing|spelling|phonic|grammar/.test(s)) return "📖";
  if (/scien|biolog|chemi|physic/.test(s)) return "🔬";
  if (/french|spanish|german|language|latin|welsh|arabic|urdu|polish/.test(s)) return "🗣️";
  if (/histor|geograph|humanit|religio|citizen|social/.test(s)) return "🌍";
  if (/comput|coding|ict|tech/.test(s)) return "💻";
  if (/art|design|draw/.test(s)) return "🎨";
  if (/music/.test(s)) return "🎵";
  return "🃏";
}
