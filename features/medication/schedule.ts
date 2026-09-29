// A medication's schedule is stored as canonical English text ("On every booked day", "On these days: Mon 27 Jul, …",
// "Only when needed", optionally suffixed " · at 08:00, 12:00") because the register/bell logic parses it. Show it in the
// active language with scheduleLabel(); never write the translated text back.
type T = (key: string, vars?: Record<string, string | number>) => string;
export function scheduleLabel(t: T, s?: string): string {
  if (!s) return "";
  const [main, ...rest] = s.split(" · at ");
  let m = main;
  if (main === "On every booked day") m = t("p7med.schedBooked");
  else if (main.startsWith("On these days: ")) m = t("p7med.schedThese", { days: main.slice("On these days: ".length) });
  else if (main === "Only when needed") m = t("p7med.schedNeeded");
  return rest.length ? t("p7med.schedAt", { base: m, times: rest.join(" · at ") }) : m;
}
