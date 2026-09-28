// A small set of duotone icons (navy + violet, one gold highlight) drawn for the explainers, so no system emoji is ever shown on
// screen. Scripts still name an icon with an emoji; this maps it to the drawn one.
const N = "#1d3a8f", V = "#8b73e6", S = "#dfe6ff", G = "#f5b81f", W = "#ffffff";
const sk = { stroke: N, strokeWidth: 1.6, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

const ICONS: Record<string, React.ReactNode> = {
  book: <><path d="M3.5 5.5h7A1.5 1.5 0 0 1 12 7v12a1.5 1.5 0 0 0-1.5-1.5h-7z" fill={S} {...sk} /><path d="M20.5 5.5h-7A1.5 1.5 0 0 0 12 7v12a1.5 1.5 0 0 1 1.5-1.5h7z" fill={W} {...sk} /><path d="M16.5 5.5v5l1.5-1 1.5 1v-5z" fill={G} /></>,
  notebook: <><rect x="5" y="3" width="14" height="18" rx="2" fill={S} {...sk} /><path d="M9 8h7M9 12h7M9 16h4" {...sk} /><rect x="3" y="6" width="3" height="3" rx=".8" fill={G} /><rect x="3" y="12" width="3" height="3" rx=".8" fill={G} /></>,
  chart: <><rect x="4" y="12" width="4" height="8" rx="1" fill={V} /><rect x="10" y="8" width="4" height="12" rx="1" fill={N} /><rect x="16" y="4" width="4" height="16" rx="1" fill={G} /></>,
  video: <><rect x="3" y="6" width="13" height="12" rx="2.5" fill={N} /><path d="M16.5 10.5 21 7.5v9l-4.5-3z" fill={G} /><circle cx="9.5" cy="12" r="2.5" fill={S} /></>,
  users: <><circle cx="9" cy="8" r="3.2" fill={N} /><path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5z" fill={N} /><circle cx="17" cy="9" r="2.5" fill={V} /><path d="M16 14c3 0 5 1.8 5 4.5h-5z" fill={V} /><circle cx="19.5" cy="4.5" r="1.4" fill={G} /></>,
  person: <><circle cx="12" cy="8" r="3.6" fill={N} /><path d="M5 20c0-4 3.1-6.5 7-6.5s7 2.5 7 6.5z" fill={V} /><circle cx="18.5" cy="4.5" r="1.4" fill={G} /></>,
  cards: <><rect x="4" y="6" width="12" height="15" rx="2" transform="rotate(-8 10 13)" fill={S} {...sk} /><rect x="8" y="3" width="12" height="15" rx="2" fill={W} {...sk} /><path d="M12 9h4M12 12h4" {...sk} /><circle cx="17.5" cy="15" r="1.3" fill={G} /></>,
  tools: <><rect x="2.5" y="9" width="19" height="6.5" rx="1.5" transform="rotate(-28 12 12)" fill={G} {...sk} /><path d="m6 14.5 1-1.8m2.4 1 .7-1.2m2 .4 1-1.8m1.9.9.7-1.2" {...sk} /></>,
  link: <><rect x="2.5" y="8.5" width="10" height="7" rx="3.5" fill="none" {...sk} strokeWidth={2.2} /><rect x="11.5" y="8.5" width="10" height="7" rx="3.5" fill="none" stroke={V} strokeWidth={2.2} strokeLinecap="round" /><circle cx="12" cy="12" r="1.5" fill={G} /></>,
  cart: <><path d="M3 4h2.5l2 10h9.5l2-7H7" fill={S} {...sk} /><circle cx="9" cy="18.5" r="1.7" fill={N} /><circle cx="16" cy="18.5" r="1.7" fill={N} /><circle cx="18.5" cy="4.5" r="1.5" fill={G} /></>,
  plus: <><circle cx="12" cy="12" r="9" fill={N} /><path d="M12 7.5v9M7.5 12h9" stroke={W} strokeWidth={2.2} strokeLinecap="round" /></>,
  check: <><circle cx="12" cy="12" r="9" fill={S} {...sk} /><path d="m7.5 12.3 3 3 6-6.3" fill="none" stroke={N} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" /></>,
  home: <><path d="m3.5 11.5 8.5-7.5 8.5 7.5V20a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1z" fill={S} {...sk} /><rect x="10" y="14" width="4" height="7" rx="1" fill={G} /></>,
  door: <><rect x="6" y="3" width="12" height="18" rx="1.5" fill={N} /><rect x="8" y="5" width="8" height="14" rx="1" fill={V} /><circle cx="14.5" cy="12.5" r="1.1" fill={G} /></>,
  printer: <><rect x="7" y="3" width="10" height="6" rx="1" fill={W} {...sk} /><rect x="3.5" y="9" width="17" height="8" rx="2" fill={S} {...sk} /><rect x="7" y="14" width="10" height="7" rx="1" fill={W} {...sk} /><circle cx="17.5" cy="11.5" r="1" fill={G} /></>,
  star: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" fill={G} {...sk} />,
  globe: <><circle cx="12" cy="12" r="9" fill={S} {...sk} /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" fill="none" stroke={V} strokeWidth={1.4} /></>,
  cap: <><path d="m2.5 9 9.5-4.5L21.5 9 12 13.5z" fill={N} /><path d="M6.5 11.5v4c1.5 1.7 3.4 2.5 5.5 2.5s4-.8 5.5-2.5v-4L12 14z" fill={V} /><path d="M21 9.5v5" stroke={G} strokeWidth={1.6} strokeLinecap="round" /></>,
  phone: <><rect x="7" y="2.5" width="10" height="19" rx="2.5" fill={N} /><rect x="8.6" y="5" width="6.8" height="12.5" rx="1" fill={S} /><circle cx="12" cy="19.4" r=".9" fill={G} /></>,
  monitor: <><rect x="3" y="4" width="18" height="12" rx="2" fill={N} /><rect x="4.8" y="5.8" width="14.4" height="8.4" rx="1" fill={S} /><path d="M9 20h6M12 16v4" stroke={V} strokeWidth={1.8} strokeLinecap="round" /></>,
  pencil: <><path d="m4 20 1-4.5L16.5 4a2 2 0 0 1 2.8 0l.7.7a2 2 0 0 1 0 2.8L8.5 19z" fill={G} {...sk} /><path d="m14.5 6 3.5 3.5" {...sk} /><path d="m4 20 1-4.5 3.5 3.5z" fill={S} {...sk} /></>,
  quiz: <><rect x="4" y="3" width="16" height="18" rx="2" fill={S} {...sk} /><path d="m7.5 8 1.3 1.3 2.4-2.6M7.5 14l1.3 1.3 2.4-2.6" fill="none" stroke={V} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /><path d="M13 8.5h4M13 14.5h4" {...sk} /></>,
  game: <><rect x="2.5" y="7.5" width="19" height="10" rx="5" fill={N} /><path d="M8 10.5v4M6 12.5h4" stroke={S} strokeWidth={1.6} strokeLinecap="round" /><circle cx="15.5" cy="11.5" r="1.1" fill={G} /><circle cx="18" cy="13.5" r="1.1" fill={V} /></>,
  sparkle: <path d="M12 2.5c.7 4.6 2.9 6.8 7.5 7.5-4.6.7-6.8 2.9-7.5 7.5-.7-4.6-2.9-6.8-7.5-7.5 4.6-.7 6.8-2.9 7.5-7.5zM19 15.5c.3 1.9 1.1 2.7 3 3-1.9.3-2.7 1.1-3 3-.3-1.9-1.1-2.7-3-3 1.9-.3 2.7-1.1 3-3z" fill={G} />,
  divide: <><circle cx="12" cy="12" r="9" fill={N} /><path d="M7 12h10" stroke={W} strokeWidth={2.2} strokeLinecap="round" /><circle cx="12" cy="7.8" r="1.4" fill={G} /><circle cx="12" cy="16.2" r="1.4" fill={G} /></>,
  point: <><path d="M9 11V5.5a1.6 1.6 0 0 1 3.2 0V10l6 1.4c1.4.3 2.3 1.6 2 3l-.9 4.3A3 3 0 0 1 16.3 21H12a4 4 0 0 1-3.2-1.6l-4-5.3a1.4 1.4 0 0 1 2-1.9L9 13.5" fill={S} {...sk} /></>,
};
const MAP: Record<string, string> = {
  "📚": "book", "📖": "book", "📓": "notebook", "📝": "quiz", "✅": "check", "📈": "chart", "🎥": "video", "👨‍👩‍👧": "users", "👥": "users", "🧑": "person", "🧑‍🏫": "cap", "🎓": "cap",
  "🛒": "cart", "🔗": "link", "🃏": "cards", "🧰": "tools", "➕": "plus", "🏠": "home", "🏡": "home", "🚪": "door", "🏫": "home", "🖨️": "printer", "⭐": "star", "🌟": "star",
  "🌐": "globe", "📱": "phone", "🖥️": "monitor", "✏️": "pencil", "🎮": "game", "➗": "divide", "👉": "point", "🎉": "sparkle", "👋": "sparkle",
};
export const glyphName = (emoji: string) => MAP[emoji] ?? MAP[emoji.replace(/️/g, "")] ?? "sparkle";
export default function Glyph({ icon, size = 28 }: { icon: string; size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden focusable="false" className="hiw-glyph">{ICONS[glyphName(icon)] ?? ICONS.sparkle}</svg>;
}
export { ICONS };
