import type { QuizGameId } from "./store";
import type { QuizTheme } from "./QuizRunner";

// The three quiz-arcade games' themes — colour/copy only, the mechanics are 100% shared (QuizRunner.tsx). Accent
// colours are existing category tokens from app/globals.css, deliberately never --green / --sem-ok (content rule:
// no green as a persistent brand colour).
export const QUIZ_ARCADE_GAMES: { id: QuizGameId; theme: QuizTheme; nameKey: string; blurbKey: string; emoji: string }[] = [
  { id: "prime-reef", nameKey: "hubshell.lbl_games_primereef", blurbKey: "hubshell.gamesPrimeReefBlurb", emoji: "🐠",
    theme: { gameId: "prime-reef", title: "Prime Reef", mascot: "🐠", accentVar: "--cat-5", frameWord: "reef tile", icon: "🪸" } },
  { id: "data-carnival", nameKey: "hubshell.lbl_games_datacarnival", blurbKey: "hubshell.gamesDataCarnivalBlurb", emoji: "🎡",
    theme: { gameId: "data-carnival", title: "Data Carnival", mascot: "🎡", accentVar: "--cat-10", frameWord: "stall", icon: "🎟️" } },
  { id: "shape-workshop", nameKey: "hubshell.lbl_games_shapeworkshop", blurbKey: "hubshell.gamesShapeWorkshopBlurb", emoji: "🛠️",
    theme: { gameId: "shape-workshop", title: "Shape Workshop", mascot: "🛠️", accentVar: "--cat-2", frameWord: "piece", icon: "🔩" } },
];
