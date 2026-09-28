"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Button, Card } from "@/components/ui";
import { EmptyState, FOCUS, Icon, SkeletonRows } from "./kit";
import { get } from "@/lib/api";
import { useT } from "@/lib/i18n/provider";
import type { PanelMeta, PanelProps } from "./panelTypes";
import { liveBackend } from "./games/penguin/store";
import { liveBackend as liveTurboBackend } from "./games/turbo/store";
import { liveBackend as liveAppliedBackend } from "./games/applied/store";
import { liveQuizBackend } from "./games/quiz/store";
import { liveBackend as liveBotFoundryBackend } from "./games/botfoundry/store";
import { liveBackend as liveSortYardBackend } from "./games/sortyard/store";
import { liveBackend as liveTrainingBackend } from "./games/training/store";
import { liveBackend as liveQuizArcadeBackend } from "./games/quizArcade/store";
import { QuizRunner } from "./games/quizArcade/QuizRunner";
import { QUIZ_ARCADE_GAMES as QUIZ_ARCADE_DEFS } from "./games/quizArcade/games";
import { BIOMES } from "./games/penguin/config";
import { cleanSupport, type SupportProfile } from "./support";
import { GameCardArt } from "./games/cardArt";

// Games — Penguin Slide (docs/games-research/03-concepts.md), played from the FAMILY side only: the server itself
// refuses a run for any account that isn't a plain parent ("Games are played from a student's own account", see
// server/src/routes/hub/gamesApi.ts). This panel mirrors that at the UI layer so a tutor/staff account never sees a
// "Start playing" affordance for themselves, and follows the exact same child-gating every other family tab uses
// (QuizzesPanel / StudentAssess): no child chosen on a multi-child account = a clear empty state, never a game that
// silently defaults to some child. There is no picker in here — the shell (LearningHubApp) is the single source of
// "which child": this panel only ever renders once a real childId is in context (family.childId / the /[childId] route).
//
// Shape (matches StudentAssess.tsx exactly, per owner correction): a CARD LIST is the landing state — one small
// card per game — and picking a card is what launches it, with a real "back to games" exit; never straight into
// gameplay from the tab bar itself.
const PenguinJourney = dynamic(() => import("./games/penguin/PenguinJourney"), {
  loading: () => <SkeletonRows rows={3} label="…" />,
  ssr: false,
});
const TurboSlide = dynamic(() => import("./games/turbo/TurboSlide"), {
  loading: () => <SkeletonRows rows={3} label="…" />,
  ssr: false,
});
const MarketDaySlide = dynamic(() => import("./games/market/MarketDaySlide"), {
  loading: () => <SkeletonRows rows={3} label="…" />,
  ssr: false,
});
const BakeOffSlide = dynamic(() => import("./games/bakeoff/BakeOffSlide"), {
  loading: () => <SkeletonRows rows={3} label="…" />,
  ssr: false,
});
const RhythmReefSlide = dynamic(() => import("./games/reef/RhythmReefSlide"), {
  loading: () => <SkeletonRows rows={3} label="…" />,
  ssr: false,
});
const CompassQuest = dynamic(() => import("./games/compass/CompassQuest"), {
  loading: () => <SkeletonRows rows={3} label="…" />,
  ssr: false,
});
const MuseumVault = dynamic(() => import("./games/museum/MuseumVault"), {
  loading: () => <SkeletonRows rows={3} label="…" />,
  ssr: false,
});
const ColourLab = dynamic(() => import("./games/colourlab/ColourLab"), {
  loading: () => <SkeletonRows rows={3} label="…" />,
  ssr: false,
});
const DebateKeep = dynamic(() => import("./games/debate/DebateKeep"), {
  loading: () => <SkeletonRows rows={3} label="…" />,
  ssr: false,
});
const StoryDetective = dynamic(() => import("./games/detective/StoryDetective"), {
  loading: () => <SkeletonRows rows={3} label="…" />,
  ssr: false,
});
const WordVault = dynamic(() => import("./games/vault/WordVault"), {
  loading: () => <SkeletonRows rows={3} label="…" />,
  ssr: false,
});
const WordPop = dynamic(() => import("./games/wordpop/WordPop"), {
  loading: () => <SkeletonRows rows={3} label="…" />,
  ssr: false,
});
const BotFoundryApp = dynamic(() => import("./games/botfoundry/BotFoundryApp").then((m) => m.BotFoundryApp), {
  loading: () => <SkeletonRows rows={3} label="…" />,
  ssr: false,
});
const SortYardApp = dynamic(() => import("./games/sortyard/SortYardApp").then((m) => m.SortYardApp), {
  loading: () => <SkeletonRows rows={3} label="…" />,
  ssr: false,
});
const TrainingApp = dynamic(() => import("./games/training/TrainingApp").then((m) => m.TrainingApp), {
  loading: () => <SkeletonRows rows={3} label="…" />,
  ssr: false,
});

export const meta: PanelMeta = { key: "games", label: "Games", icon: "🎮", status: "live", blurb: "Penguin Slide, Turbo Slide, Market Day, Bake Off Blitz, Rhythm Reef, Compass Quest, Museum Vault, Colour Lab, Bot Foundry, Sort Yard, Training Ground, Debate Keep, Story Detective, Word Vault, Word Pop, Prime Reef, Data Carnival and Shape Workshop — quick, playful practice that quietly turns into real skill." };

type GameId = "penguin" | "turbo" | "market" | "bakeoff" | "reef" | "compass" | "museum" | "colourlab" | "botfoundry" | "sortyard" | "training" | "debate" | "detective" | "vault" | "wordpop" | "primereef" | "datacarnival" | "shapeworkshop";
/** The applied-maths cluster (Market Day / Bake Off Blitz / Rhythm Reef) and the quiz-quest cluster (Compass Quest /
 *  Museum Vault / Colour Lab / Debate Keep / Story Detective / Word Vault / Word Pop): each has its own skill domain
 *  and its own server-picked difficulty/plan (features/learninghub/games/applied/ and games/quiz/ respectively), so
 *  — unlike Penguin/Turbo Slide's times-tables level picker below — they go straight from card to play. Bot Foundry
 *  (computing), Sort Yard (statistics) and Training Ground (a generic subject-agnostic drill engine — see
 *  games/training/core.ts) are three MORE such domains (server/src/lib/games/*.ts) and follow the same shape.
 *  Prime Reef / Data Carnival / Shape Workshop (number theory / statistics / geometry) are a FOURTH such cluster
 *  (games/quizArcade/, server/src/lib/quizArcade.ts) — same "straight from card to play" shape, but each run's
 *  items are freshly generated from a seed every time (never a fixed bank) so the arithmetic itself can't be
 *  memorised; see server/src/lib/quizArcade.ts's file header for why that's a separate engine from games/quiz/core.ts. */
const APPLIED_GAMES = new Set<GameId>(["market", "bakeoff", "reef"]);
const QUIZ_GAMES = new Set<GameId>(["compass", "museum", "colourlab", "debate", "detective", "vault", "wordpop"]);
const MINI_GAMES = new Set<GameId>(["botfoundry", "sortyard", "training"]);
const QUIZ_ARCADE_GAMES = new Set<GameId>(["primereef", "datacarnival", "shapeworkshop"]);
const QUIZ_ARCADE_SERVER_ID: Partial<Record<GameId, "prime-reef" | "data-carnival" | "shape-workshop">> = {
  primereef: "prime-reef", datacarnival: "data-carnival", shapeworkshop: "shape-workshop",
};
/** Short in-app GameId -> the server's own gameId (server/src/lib/hubQuizGames.ts). */
const QUIZ_SERVER_ID: Partial<Record<GameId, "compass-quest" | "museum-vault" | "colour-lab" | "debate-keep" | "story-detective" | "word-vault" | "word-pop">> = {
  compass: "compass-quest", museum: "museum-vault", colourlab: "colour-lab",
  debate: "debate-keep", detective: "story-detective", vault: "word-vault", wordpop: "word-pop",
};
interface GameDef { id: GameId; emoji: string; nameKey: string; blurbKey: string }
// Turbo Slide is a highway reskin of the exact same server-authoritative simulation as Penguin Slide (same fact
// selection, same lane physics, same replay - see docs/games-prototypes/BACKEND-PATTERN.md); adding it here was
// exactly the "another row" the comment above used to promise, nothing else to wire.
const GAMES: GameDef[] = [
  { id: "penguin", emoji: "🐧", nameKey: "hubshell.lbl_games_penguin", blurbKey: "hubshell.gamesPenguinBlurb" },
  { id: "turbo", emoji: "🏎️", nameKey: "hubshell.lbl_games_turbo", blurbKey: "hubshell.gamesTurboBlurb" },
  { id: "market", emoji: "🧺", nameKey: "hubshell.lbl_games_market", blurbKey: "hubshell.gamesMarketBlurb" },
  { id: "bakeoff", emoji: "🧁", nameKey: "hubshell.lbl_games_bakeoff", blurbKey: "hubshell.gamesBakeoffBlurb" },
  { id: "reef", emoji: "🐠", nameKey: "hubshell.lbl_games_reef", blurbKey: "hubshell.gamesReefBlurb" },
  { id: "compass", emoji: "🧭", nameKey: "hubshell.lbl_games_compass", blurbKey: "hubshell.gamesCompassBlurb" },
  { id: "museum", emoji: "🏛️", nameKey: "hubshell.lbl_games_museum", blurbKey: "hubshell.gamesMuseumBlurb" },
  { id: "colourlab", emoji: "🔬", nameKey: "hubshell.lbl_games_colourlab", blurbKey: "hubshell.gamesColourlabBlurb" },
  { id: "botfoundry", emoji: "🤖", nameKey: "hubshell.lbl_games_botfoundry", blurbKey: "hubshell.gamesBotfoundryBlurb" },
  { id: "sortyard", emoji: "📊", nameKey: "hubshell.lbl_games_sortyard", blurbKey: "hubshell.gamesSortyardBlurb" },
  { id: "training", emoji: "🎯", nameKey: "hubshell.lbl_games_training", blurbKey: "hubshell.gamesTrainingBlurb" },
  { id: "debate", emoji: "🏰", nameKey: "hubshell.lbl_games_debate", blurbKey: "hubshell.gamesDebateBlurb" },
  { id: "detective", emoji: "🔎", nameKey: "hubshell.lbl_games_detective", blurbKey: "hubshell.gamesDetectiveBlurb" },
  { id: "vault", emoji: "🔐", nameKey: "hubshell.lbl_games_vault", blurbKey: "hubshell.gamesVaultBlurb" },
  { id: "wordpop", emoji: "💬", nameKey: "hubshell.lbl_games_wordpop", blurbKey: "hubshell.gamesWordpopBlurb" },
  ...QUIZ_ARCADE_DEFS.map((g): GameDef => ({ id: (g.id === "prime-reef" ? "primereef" : g.id === "data-carnival" ? "datacarnival" : "shapeworkshop"), emoji: g.emoji, nameKey: g.nameKey, blurbKey: g.blurbKey })),
];

// The level/difficulty choice, straight from the game's OWN existing progression data (config.ts BIOMES: the same
// five times-tables groupings the journey map's five biomes already teach, glacier -> summit) — not a new,
// invented difficulty scale. Only affects a stage-LESS run (Free play / Quick / Daily / Pit): a journey stage
// still always uses its own tables and its own mastery-gated unlock, untouched. "Auto" (Pip's own weakest-first
// pick) stays the default experience when nobody chooses a level.
/** Big topic tiles the child picks from instead of an 18-card wall. Every game appears in exactly one. */
const GAME_CATS: { id: string; emoji: string; nameKey: string; tone: string; ids: GameId[] }[] = [
  { id: "numbers", emoji: "🔢", nameKey: "hubshell.gamesCatNumbers", tone: "var(--cat-4)", ids: ["penguin", "turbo", "market", "bakeoff", "reef", "primereef", "shapeworkshop"] },
  { id: "words", emoji: "🔤", nameKey: "hubshell.gamesCatWords", tone: "var(--cat-1)", ids: ["wordpop", "vault", "detective", "debate"] },
  { id: "world", emoji: "🌍", nameKey: "hubshell.gamesCatWorld", tone: "var(--cat-3)", ids: ["museum", "colourlab", "compass"] },
  { id: "puzzles", emoji: "🧩", nameKey: "hubshell.gamesCatPuzzles", tone: "var(--cat-6)", ids: ["botfoundry", "sortyard", "training", "datacarnival"] },
];
interface LevelDef { n: number; tables: number[]; nameKey: string }
const LEVELS: LevelDef[] = BIOMES.map((b) => ({ n: b.n, tables: b.tables, nameKey: `hubshell.gamesLevel${b.n}` }));
/** A sensible starting level from the child's own year group (Reception/Y1/Y2 -> 1 ... Y6+ -> 5); free-text /
 *  unknown year groups fall back to the gentlest level rather than guessing high. */
function levelForYear(yearGroup: string | null | undefined): number {
  const n = yearGroup ? Number(String(yearGroup).match(/\d+/)?.[0]) : NaN;
  if (!Number.isFinite(n)) return 1;
  if (n <= 2) return 1;
  if (n === 3) return 2;
  if (n === 4) return 3;
  if (n === 5) return 4;
  return 5;
}

export function Panel(p: PanelProps) {
  const t = useT();
  // Tutors / staff (canEdit): games are family/child-only, matching the API's own 403. Point them at what's
  // actually useful here — a student's fact strengths, in Progress -> that student (ProgressPanel.tsx mounts
  // games/penguin/TutorPanel.tsx there) — rather than any play control of their own.
  if (p.canEdit) {
    return <EmptyState icon="sparkle" title={t("hubshell.lbl_games")} body={t("hubshell.gamesTutorBody")} />;
  }
  const childId = p.childId;
  if (!childId) return <EmptyState icon="users" title={t("hubfam.asChooseChild")} body={t("hubfam.asChooseChildBody")} />;
  return (
    <GamesHome key={childId} tenantId={p.tenantId} childQs={p.childQs} childId={childId} childName={p.child?.childName ?? ""}
      support={p.child?.support} yearGroup={p.child?.yearGroup} />
  );
}

function GamesHome({ tenantId, childQs, childId, childName, support, yearGroup }: {
  tenantId: string; childQs?: string; childId: string; childName: string; support: SupportProfile | undefined; yearGroup?: string | null;
}) {
  const t = useT();
  // Two steps, same shape as picking a quiz then taking it: pick a game -> choose a level -> play. `picking` is the
  // game card just tapped (level step); `playing` is the launched run (game + the level's tables, or undefined for
  // "Auto" - and `resume: true` when this is picking a genuinely resumable run back up, not a fresh start).
  const [picking, setPicking] = useState<GameId | null>(null);
  const [playing, setPlaying] = useState<{ id: GameId; tables?: number[]; resume?: boolean } | null>(null);
  // Real (not fabricated) per-game "Continue" wording: does THIS game have a run this child left mid-way, still
  // resumable (not finished, not expired)? Penguin Slide and Turbo Slide keep separate sessions (only the fact-
  // mastery map is shared), so each card is checked on its own skin. The applied-maths cluster (Market Day / Bake
  // Off Blitz / Rhythm Reef) has the SAME real pause/resume, under its own per-game endpoint (features/learninghub/
  // games/applied/store.ts, server/src/lib/appliedGames.ts) since each is its own skill domain, not a shared skin.
  const SLIDE_GAMES = useMemo(() => GAMES.filter((g) => !APPLIED_GAMES.has(g.id) && !QUIZ_GAMES.has(g.id) && !MINI_GAMES.has(g.id) && !QUIZ_ARCADE_GAMES.has(g.id)), []);
  const [resumable, setResumable] = useState<Record<GameId, boolean>>(() => Object.fromEntries(GAMES.map((g) => [g.id, false])) as Record<GameId, boolean>);
  useEffect(() => {
    if (!childQs) return;
    let alive = true;
    Promise.all(SLIDE_GAMES.map((g) => get<{ resumable: { sessionId: string } | null }>(`/api/learning-hub/games/sessions/resumable${childQs}&skin=${g.id}`).then((r) => !!r.resumable).catch(() => false)))
      .then((rs) => { if (alive) setResumable((prev) => ({ ...prev, ...Object.fromEntries(SLIDE_GAMES.map((g, i) => [g.id, rs[i]])) })); });
    return () => { alive = false; };
  }, [childQs, SLIDE_GAMES]);
  const APPLIED_LIST = useMemo(() => GAMES.filter((g) => APPLIED_GAMES.has(g.id)), []);
  useEffect(() => {
    if (!childQs) return;
    let alive = true;
    Promise.all(APPLIED_LIST.map((g) => get<{ resumable: { sessionId: string } | null }>(`/api/learning-hub/games/applied/${g.id}/sessions/resumable${childQs}`).then((r) => !!r.resumable).catch(() => false)))
      .then((rs) => { if (alive) setResumable((prev) => ({ ...prev, ...Object.fromEntries(APPLIED_LIST.map((g, i) => [g.id, rs[i]])) })); });
    return () => { alive = false; };
  }, [childQs, APPLIED_LIST]);

  if (playing) {
    return (
      <GameRunner game={playing.id} tenantId={tenantId} childId={childId} childName={childName} support={support} startTables={playing.tables} resume={!!playing.resume}
        onExit={() => setPlaying(null)} />
    );
  }

  if (picking) {
    const def = GAMES.find((g) => g.id === picking)!;
    const defaultLevel = levelForYear(yearGroup);
    return (
      <div data-testid="hub-games-levels">
        <button type="button" onClick={() => setPicking(null)} data-testid="hub-games-level-back"
          className={`mb-3 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg pe-3 text-[13px] font-bold text-[var(--ink-2)] hover:text-[var(--brand)] ${FOCUS}`}>
          <Icon name="arrowLeft" size={16} className="rtl:rotate-180" />{t("hubshell.gamesBackToGames")}
        </button>
        <h3 className="m-0 mb-1 text-[16px] font-extrabold text-[var(--ink)]">{t("hubshell.gamesLevelTitle", { game: t(def.nameKey) })}</h3>
        <p className="m-0 mb-3 text-[13px] font-semibold text-[var(--ink-3)]">{t("hubshell.gamesLevelBody")}</p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <button type="button" data-testid="hub-games-level-auto" onClick={() => { setPlaying({ id: picking }); setPicking(null); }}
            className={`flex flex-col items-start gap-1 rounded-2xl border-2 p-3 text-start ${FOCUS}`}
            style={{ borderColor: "var(--brand)", background: "var(--brand-soft)" }}>
            <span className="text-[13px] font-extrabold text-[var(--brand-strong)]">{t("hubshell.gamesLevelAuto")}</span>
            <span className="text-[11.5px] font-semibold text-[var(--ink-2)]">{t("hubshell.gamesLevelAutoBody")}</span>
          </button>
          {LEVELS.map((lv) => {
            const on = lv.n === defaultLevel;
            return (
              <button key={lv.n} type="button" data-testid={`hub-games-level-${lv.n}`} onClick={() => { setPlaying({ id: picking, tables: lv.tables }); setPicking(null); }}
                className={`flex flex-col items-start gap-1 rounded-2xl border-2 p-3 text-start ${FOCUS}`}
                style={on ? { borderColor: "var(--brand)", background: "var(--brand-soft)" } : { borderColor: "var(--line)", background: "var(--surface)" }}>
                <span className="text-[13px] font-extrabold text-[var(--ink)]">{t(lv.nameKey)}</span>
                <span className="text-[11.5px] font-semibold text-[var(--ink-2)] tabular-nums">{lv.tables.map((n) => `×${n}`).join(" · ")}</span>
                {on && <span className="text-[10.5px] font-extrabold uppercase tracking-wide text-[var(--brand-strong)]">{t("hubshell.gamesLevelSuggested")}</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const launch = (g: GameDef) => (resumable[g.id] ? setPlaying({ id: g.id, resume: true }) : QUIZ_GAMES.has(g.id) || MINI_GAMES.has(g.id) || QUIZ_ARCADE_GAMES.has(g.id) ? setPlaying({ id: g.id }) : setPicking(g.id));
  // Kids: ONE obvious "play next" card first (a run left half-way, else Penguin Slide), then four big topic tiles; a tile opens at most five
  // games at a time (Show all for the rest). Reception–Y2 (KS1) see names only, no paragraphs.
  const ks1 = /reception|foundation|\b(?:year|y)\s*[12]\b/i.test(yearGroup ?? "");
  const byId = new Map(GAMES.map((g) => [g.id, g]));
  const next = GAMES.find((g) => resumable[g.id]) ?? byId.get("penguin")!;
  const [openCat, setOpenCat] = useState<string>("numbers");
  const [all, setAll] = useState<Record<string, boolean>>({});
  const cat = GAME_CATS.find((c) => c.id === openCat) ?? GAME_CATS[0]!;
  const catGames = cat.ids.map((id) => byId.get(id)).filter((g): g is GameDef => !!g);
  const shown = all[cat.id] ? catGames : catGames.slice(0, 5);
  return (
    <div className="grid gap-5" data-testid="hub-games-home">
      <div className="flex flex-col gap-3 overflow-hidden rounded-3xl border-2 p-3 sm:flex-row sm:items-center sm:gap-5 sm:p-4" data-testid="hub-games-next"
        style={{ borderColor: "color-mix(in srgb, var(--brand) 35%, var(--line))", background: "linear-gradient(135deg, var(--brand-soft), var(--surface))" }}>
        <div className="h-24 w-full overflow-hidden rounded-2xl sm:h-28 sm:w-56 sm:flex-none" aria-hidden="true"><GameCardArt id={next.id} emoji={next.emoji} /></div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-[var(--brand-strong)]">{t("hubshell.gamesPlayNext")}</span>
          <h3 className="m-0 text-[22px] font-extrabold leading-tight text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{next.emoji} {t(next.nameKey)}</h3>
          <Button variant="solid" className="w-full !min-h-[56px] !text-[17px] sm:w-auto sm:!px-10" data-testid="hub-games-play-next" onClick={() => launch(next)}>
            {resumable[next.id] ? t("hubshell.gamesContinue") : t("hubshell.gamesPlay")}
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" role="tablist" aria-label={t("hubshell.lbl_games")}>
        {GAME_CATS.map((c) => {
          const on = c.id === cat.id;
          return (
            <button key={c.id} type="button" role="tab" aria-selected={on} data-testid={`hub-games-cat-${c.id}`} onClick={() => setOpenCat(c.id)}
              className={`flex min-h-[92px] flex-col items-center justify-center gap-1 rounded-3xl border-2 px-2 py-3 text-center transition motion-reduce:transition-none ${FOCUS} ${on ? "-translate-y-0.5 shadow-[var(--shadow-md,0_10px_24px_-12px_rgba(0,0,0,.35))]" : ""}`}
              style={{ borderColor: on ? c.tone : `color-mix(in srgb, ${c.tone} 30%, var(--line))`, background: `color-mix(in srgb, ${c.tone} ${on ? 22 : 10}%, var(--surface))` }}>
              <span aria-hidden className="text-[30px] leading-none">{c.emoji}</span>
              <span className="text-[15px] font-extrabold text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{t(c.nameKey)}</span>
              {!ks1 && <span className="text-[11.5px] font-bold text-[var(--ink-2)]">{t("hubshell.gamesNGames", { n: c.ids.length })}</span>}
            </button>
          );
        })}
      </div>
      <div className="grid gap-2.5" data-testid="hub-games-list" role="tabpanel">
        {shown.map((g) => (
          <div key={g.id} className="flex items-center gap-3 rounded-2xl border-2 bg-[var(--surface)] p-2.5 sm:gap-4 sm:p-3" style={{ borderColor: `color-mix(in srgb, ${cat.tone} 35%, var(--line))` }}>
            <span aria-hidden className="grid h-14 w-14 flex-none place-items-center rounded-2xl text-[30px]" style={{ background: `color-mix(in srgb, ${cat.tone} 18%, var(--surface))` }}>{g.emoji}</span>
            <div className="min-w-0 flex-1">
              <h4 className="m-0 text-[17px] font-extrabold leading-tight text-[var(--ink)]" style={{ fontFamily: "var(--ff-display)" }}>{t(g.nameKey)}</h4>
              {!ks1 && <p className="m-0 mt-0.5 line-clamp-1 text-[12.5px] font-semibold text-[var(--ink-2)]">{t(g.blurbKey)}</p>}
            </div>
            <Button variant="solid" className="!min-h-[52px] !px-6 !text-[15px]" data-testid={`hub-games-play-${g.id}`} onClick={() => launch(g)}>
              {resumable[g.id] ? t("hubshell.gamesContinue") : t("hubshell.gamesPlay")}
            </Button>
          </div>
        ))}
        {catGames.length > 5 && (
          <button type="button" data-testid="hub-games-showall" onClick={() => setAll((a) => ({ ...a, [cat.id]: !a[cat.id] }))}
            className={`mx-auto inline-flex min-h-[48px] items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--panel)] px-5 text-[14px] font-extrabold text-[var(--brand-strong)] ${FOCUS}`}>
            {all[cat.id] ? t("hubshell.gamesShowFewer") : t("hubshell.gamesShowAll", { n: catGames.length })} <span aria-hidden>{all[cat.id] ? "▲" : "▼"}</span>
          </button>
        )}
      </div>
    </div>
  );
}

function GameRunner({ game, tenantId, childId, childName, support, startTables, resume, onExit }: {
  game: GameId; tenantId: string; childId: string; childName: string; support: SupportProfile | undefined; startTables?: number[]; resume: boolean; onExit: () => void;
}) {
  const t = useT();
  const backend = useMemo(() => liveBackend(tenantId, childId, childName), [tenantId, childId, childName]);
  const turboBackend = useMemo(() => liveTurboBackend(tenantId, childId, childName), [tenantId, childId, childName]);
  // Compass Quest / Museum Vault / Colour Lab: one quiz backend per short-form MCQ run (server/src/lib/
  // hubQuizGames.ts) - no tick log, no pause/resume (a run is 8 questions, the same short-form precedent as MTC
  // practice), so unlike Penguin/Turbo Slide there's no exitToken/checkpoint plumbing to wire here.
  const quizBackend = useMemo(() => (QUIZ_GAMES.has(game) ? liveQuizBackend(QUIZ_SERVER_ID[game]!, tenantId, childId) : null), [game, tenantId, childId]);
  // Bot Foundry / Sort Yard / Training Ground: same "no tick log, no checkpoint" short-run shape as the quiz-quest
  // cluster above — each finishes in one POST with the whole run's submissions/answers, so there's nothing to
  // checkpoint mid-run (see docs/games-prototypes/BACKEND-PATTERN.md and each game's own server/src/lib/games/*.ts).
  const botFoundryBackend = useMemo(() => liveBotFoundryBackend(tenantId, childId), [tenantId, childId]);
  const sortYardBackend = useMemo(() => liveSortYardBackend(tenantId, childId), [tenantId, childId]);
  const trainingBackend = useMemo(() => liveTrainingBackend(tenantId, childId), [tenantId, childId]);
  // Prime Reef / Data Carnival / Shape Workshop: same "no tick log, no checkpoint" 8-question run shape as the
  // quiz-quest / mini clusters above (server/src/lib/quizArcade.ts) - one POST issues the run, one POST finishes it.
  const quizArcadeBackend = useMemo(() => (QUIZ_ARCADE_GAMES.has(game) ? liveQuizArcadeBackend(QUIZ_ARCADE_SERVER_ID[game]!, tenantId, childId) : null), [game, tenantId, childId]);
  // Market Day / Bake Off Blitz / Rhythm Reef: their own skill domain each, but the SAME server-authoritative
  // typed-answer session shape (features/learninghub/games/applied/) - including real pause/resume, so (unlike the
  // quiz-quest / mini clusters above) they DO wire the shared exitToken checkpoint-then-exit below.
  const appliedBackend = useMemo(() => (APPLIED_GAMES.has(game) ? liveAppliedBackend(game as "market" | "bakeoff" | "reef", tenantId, childId, childName) : null), [game, tenantId, childId, childName]);
  const clean = useMemo(() => cleanSupport(support), [support]);
  // "Back to Games" while a run is live must give it one last chance to save a checkpoint before it unmounts - the
  // button lives up here, but only the game component (PenguinJourney/TurboSlide) can see its own live Game engine
  // state, so this just bumps a token and lets the child do the actual saving-then-exiting (see each component's
  // `exitToken` effect). A resumed run exits exactly the same way, so leaving it again is still safe.
  const [exitAt, setExitAt] = useState(0);
  // Only the slide-style games (Penguin / Turbo / the applied trio) watch `exitToken` and leave once their checkpoint is saved. Every other game has no
  // token to react to, so bumping it did NOTHING and this button was dead: those leave straight away (a short run has nothing to checkpoint).
  const checkpointed = game === "penguin" || game === "turbo" || APPLIED_GAMES.has(game);
  return (
    <div data-testid="hub-games-runner">
      {/* A real way back to the card list — never a dead end, never relying on the browser's Back button. Penguin
          Slide's own map screen also has a "Done" button (ui/JourneyMap.tsx) wired to this same onExit. */}
      <button type="button" onClick={() => (checkpointed ? setExitAt(Date.now()) : onExit())} data-testid="hub-games-back"
        className={`mb-3 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg pe-3 text-[13px] font-bold text-[var(--ink-2)] hover:text-[var(--brand)] ${FOCUS}`}>
        <Icon name="arrowLeft" size={16} className="rtl:rotate-180" />{t("hubshell.gamesBackToGames")}
      </button>
      {/* Stays inside the normal hub page — same width, same card chrome, same tab bar as every other panel. The
          game itself fills a bounded, rounded card at a fixed height; both games' root elements are
          `width/height:100%` of whatever box they're given, so this box is what keeps their canvas art contained. */}
      <div className="overflow-hidden rounded-2xl border border-[var(--line)] shadow-[var(--shadow-sm)]" style={{ height: "min(760px, 78vh)", minHeight: 480 }}>
        {game === "compass"
          ? <CompassQuest backend={quizBackend!} support={clean} onExit={onExit} />
          : game === "museum"
          ? <MuseumVault backend={quizBackend!} support={clean} onExit={onExit} />
          : game === "colourlab"
          ? <ColourLab backend={quizBackend!} support={clean} onExit={onExit} />
          : game === "debate"
          ? <DebateKeep backend={quizBackend!} support={clean} onExit={onExit} />
          : game === "detective"
          ? <StoryDetective backend={quizBackend!} support={clean} onExit={onExit} />
          : game === "vault"
          ? <WordVault backend={quizBackend!} support={clean} onExit={onExit} />
          : game === "wordpop"
          ? <WordPop backend={quizBackend!} support={clean} onExit={onExit} />
          : game === "botfoundry"
          ? <BotFoundryApp backend={botFoundryBackend} onExit={onExit} />
          : game === "sortyard"
          ? <SortYardApp backend={sortYardBackend} onExit={onExit} />
          : game === "training"
          ? <TrainingApp backend={trainingBackend} calm={clean.calm || clean.noTimer} onExit={onExit} />
          : QUIZ_ARCADE_GAMES.has(game)
          ? <QuizRunner theme={QUIZ_ARCADE_DEFS.find((d) => d.id === QUIZ_ARCADE_SERVER_ID[game])!.theme} backend={quizArcadeBackend!} onExit={onExit} />
          : game === "market"
          ? <MarketDaySlide backend={appliedBackend!} onExit={onExit} resume={resume} exitToken={exitAt} />
          : game === "bakeoff"
          ? <BakeOffSlide backend={appliedBackend!} onExit={onExit} resume={resume} exitToken={exitAt} />
          : game === "reef"
          ? <RhythmReefSlide backend={appliedBackend!} onExit={onExit} resume={resume} exitToken={exitAt} />
          : game === "turbo"
          ? <TurboSlide backend={turboBackend} support={clean} onExit={onExit} startTables={startTables} resume={resume} exitToken={exitAt} />
          : <PenguinJourney backend={backend} support={clean} onExit={onExit} startTables={startTables} resume={resume} exitToken={exitAt} />}
      </div>
    </div>
  );
}
