# Hub mascot (working name via `MASCOT_NAME`)

Code: `features/learninghub/mascot/`. Showcase (dev only): `/dev/mascot`. Screenshots: `docs/mascot/showcase-{light,dark}.png`.
The name lives ONLY in `name.ts`. Never write it in strings; translations take `{mascot}` / callers pass `MASCOT_NAME`.

## Poses
wave, celebrate (arms up + confetti), think (wing to chin + thought bubble), read (book), point (`dir` left/right),
cheer (hop + star), encourage (kind thumbs-up flipper), sleep (zzz, empty states), peek (over a ledge),
dance (all caught up), speak (read-aloud sound arcs), `icon` (24px mark).

## Props
`<Mascot pose size decorative label still dir bubble ground />` — decorative (aria-hidden) by default; for a meaningful
mascot pass `decorative={false}` and an already-translated `label` (`t("hubmascot.alt",{mascot:MASCOT_NAME})`).
`still` or Calm mode or prefers-reduced-motion stop all animation. `<MascotSpeech side="left|right|bottom" live>` shows
caller-translated text.

## Settings
`<MascotSettingsProvider enabled calm>` once near the hub root. `useMascotEnabled()` -> false means render nothing.
`calm` (from the child's support profile `calm`) makes every Mascot still automatically.
Proposal: hub setting `mascotEnabled` (default true) on the tenant hub settings; tutor toggles it for their students;
UI copy for the toggle to be added to `hubmascot` when built.

## Static export (emails)
`node scripts/render-mascot.mjs` (dev server running) writes `public/mascot/<pose>-{96,192,384}.png` (transparent).

## Copy keys (`hubmascot.*`, all 11 locales, already registered)
greet {name}, done {name}, again, empty, caught_up, streak {n}, tour, verdict, alt {mascot}.

## Phase 2 integration plan (NOT implemented)
Wrap each hub root in `MascotSettingsProvider` first (`features/learninghub/LearningHubApp.tsx`, reads support.calm + hub setting).
Owner column = agent currently editing; sequence after they finish. Component names not verified beyond the folder listing.

| Placement | File to touch | Wiring | Keys | Owner |
|---|---|---|---|---|
| Child Home greeting | home/StudentHome.tsx | `<Mascot pose="wave" size={72}/>` beside heading; `MascotSpeech` optional | greet | translation agent (home) |
| Homework / quiz finished | homework/* result view; quiz/* results | `celebrate` + confetti; skip when calm | done | homework agent; translation (quiz) |
| Wrong-answer screen | quiz/* feedback panel | `encourage` + `MascotSpeech live` | again | translation (quiz) |
| Streaks | progress/* streak card | `cheer size 56` | streak | translation (progress) |
| Empty states kid/parent/tutor | family/*, home/*, students/*, mark/* empty blocks (shared EmptyState in kit.tsx if any) | `sleep` (nothing yet) or `peek` (loading/searching) | empty | translation (family, students, home) |
| Tutor all caught up (marking) | mark/* queue empty | `dance` | caught_up | unowned/mark (check) |
| Video guide | howitworks/* player | `point dir` toward the video | (reuse guide copy) | How-it-works finisher |
| Read-aloud | speak.tsx speaker button | `speak` while speaking | - | shared, low risk |
| First-time tour | app/tour or howitworks tour | `wave` then `point` | tour | How-it-works finisher |
| Parent verdict line | family/* verdict | small `encourage`/`icon` 28px | verdict | translation (family) |
| Weekly digest email | server email template (server/) | `<img src=".../mascot/celebrate-192.png">` from render script | verdict | backend |
| Welcome splash | HubWelcomeSplash.tsx | `wave` size 240 | greet | check owner |
| Sidebar mark | components/shell/Sidebar.tsx (already modified by someone) | `<Mascot pose="icon" size={24}/>` next to hub item | - | shell owner; do last |

Guards everywhere: `useMascotEnabled()` false -> render nothing; never place the mascot inside quiz question areas.
