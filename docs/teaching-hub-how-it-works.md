# Teaching Hub: "How it works" explainers

Narrated, animated product films built from **real screens of the app** (Playwright captures at 2x). Each film is short (about 1 to 2.5
minutes) and there is a small library per audience. The look is a produced product video, not slides: the real UI floats on a light
Teaching Hub stage, the camera glides and rack-focuses (everything outside the ringed element softens), a cursor clicks through the
screen, big kinetic phrases stack up in step with the voice, cards spring in, the penguin mascot reacts, and a soft synthesised music
bed plus tiny UI sounds play under the voice.

| Library | Who sees it | Public URL | Videos |
| --- | --- | --- | --- |
| Tutors: "Run your Teaching Hub" | tutors (freelancer / company / franchise / staff) | `/how-it-works/tutors` (chooser) | home, families, students, lessons, live, tools, quizzes, homework, progress, messages — in that order, the same order as the Hub's own tabs |
| Parents: "Your child's Learning Hub" | parents | `/how-it-works/parents` (chooser) | start, homework, week, handover |
| Children | children in kid mode (Year 3 upwards) | `/how-it-works/children` | the tour, plus `/children/homework` |
| Children, Reception to Year 2 | children with a KS1 year group | `/how-it-works/children?band=ks1` | one extra-simple video |

Each video is deep-linkable: `/how-it-works/tutors/homework`, `/how-it-works/parents/start`, `/how-it-works/children/homework`.
`?scene=<id>` starts on a scene. A page's own "Watch: ..." link opens its video and starts playing at once (no second play press); the
chooser's title cards still show a poster with a play button. Old tutor topic slugs redirect into their new home (`TOPIC_ALIAS` in
`scripts/tutorTopics.ts`: `roster` → `families`, `diagnostic`/`starting` → `quizzes`).
The chooser shows one card per video with a tick once it has been watched to the end (kept in this browser only); each video remembers
the last scene it was on (also kept in this browser only) and resumes there next time, unless it was watched to the end.

## Who sees what (role isolation)

`ALLOWED` in `scripts/index.ts`, enforced by `HowItWorksHost`: tutor -> tutor library only; parent -> parent library plus a "What your
child sees" tab that plays the child video; child -> child video only (no role tabs, no speed / voice pickers, no links, larger captions,
voice on by default after the first tap, its own preference key `aos.hiw.prefs.kid`). Leaving the child area still needs the existing
parent gate.

## Where it is linked

| Entry point | File | Opens |
| --- | --- | --- |
| **How it works** pill in the Hub banner (tutor and parent portals; not in kid mode) | `features/learninghub/HubHero.tsx` | the viewer's chooser |
| "Watch: ..." link at the top of each Hub area (autoplays) | `features/learninghub/howitworks/TabHowTo.tsx` (mounted in `LearningHubApp.tsx`) | that area's video: Home -> home, Students -> students, Lessons -> lessons, Live lessons -> live, Tools -> tools, Flashcards / Quizzes / Starting quizzes -> quizzes, Homework -> homework, Progress -> progress, Messages -> messages; parents: Homework -> homework |
| Enrol dialog: **How does enrolling work?** | `StudentsPanel.tsx` | roster video, scene `ways-in` |
| Parent invite-claim page: **How this works** | `family/FamilyInviteClaim.tsx` | parent start video, scene `invite` |
| Child Home: big **How it works** button | `home/KidHome.tsx` | child video (KS1 gets the extra-simple one) |
| Public pages | `app/how-it-works/[role]/page.tsx`, `[role]/[topic]/page.tsx` | any video |

Anything can open it with `openHowItWorks({ role, topic, scene, band })` from `features/learninghub/howitworks/open.ts`.

## How it is built (`features/learninghub/howitworks/`)

* `HowItWorksPlayer.tsx`: the player and scene engine (scenes, narration, cues, kinetic type, captions, transport, scene list, keyboard).
* `narrator.ts`: browser `speechSynthesis` (en-GB voice preferred, sentence pauses), word-boundary events drive the cues.
* `sound.ts`: WebAudio only, no files: a calm four-chord music bed that ducks under the voice, plus click / whoosh / pop / chime cues.
  Nothing plays before the first click; the Sound and Music buttons (and `prefers-reduced-motion`, which turns the bed off) are respected.
* `rects.ts`: **cues point at real elements.** Every capture also records the rectangle of each interesting element
  (`public/how-it-works/<name>.rects.json`). A cue names its target (`el: "Set homework"`, `"#hub-hw-title"`, `"section~Needs your attention"`,
  `"button~Actions for Ava"`, `"tag:h2"`, optional `@2`), and rings, zooms, cursors and labels are computed from that rectangle. An `el`
  that cannot be found draws nothing, so a ring can never float over the wrong spot; the spec fails if any cue names an element that is
  not on its screen.
* `scripts/*.ts`: the copy. `tutor.ts` holds the tutor scene bank; `tutorTopics.ts`, `tutorHomework.ts` and `tutorMessages.ts` each pick the
  scenes for one tutor topic video, in tab order. `captions.ts` splits narration into ONE sentence at a time for the on-screen caption
  (also splitting an over-long sentence at its commas, so a caption never holds more than ~20 words), including Arabic/Urdu (`؟ ۔`),
  Devanagari/Bengali/Gurmukhi (`। ॥`) and CJK (`。`) sentence terminators. Every cue is anchored to a **phrase of the narration**, so with sound on it follows the voice and with sound off
  the same cues follow a scene clock. `keys` are the kinetic phrases (3 to 6 words; `"Shown text::phrase in the narration"` when the shown
  words differ from the spoken ones).
* `Glyph.tsx`: the drawn duotone icon set (no system emoji on screen). `../mascot`: the penguin (`Mascot`, poses by state).
* `HowItWorksChooser.tsx`, `HowItWorksHost.tsx`, `HowItWorksPage.tsx`, `HowItWorksButton.tsx`, `open.ts`: the library UI and the in-app window
  (lazy, inside an error fence, so a fault here can never take the Hub down).
* `shots.gen.ts` / `shot.ts`: generated registry of the captured screens (`public/how-it-works/*.webp`).

Palette: the Hub's own navy / royal blue / violet with gold as the one accent, in light by default; the chrome follows a dark OS scheme
with deep navy (never grey or black); the stage stays light. No green as a theme colour. Family-facing name: **Learning Hub**; tutors: **Teaching Hub**.

Player controls: play / pause, previous / next scene, restart, segmented scrubber, captions (accessibility captions along the bottom, one
sentence at a time), sound, music, speed (0.85x to 1.3x), voice, scene list, full transcript. Keys: **Space / K**, **Left / Right** (or
J / L), **R**, **C**, **M**, **Esc**. Under 600px the stage runs edge to edge, the caption sits under it, and the transport bar (play/pause,
previous/next, captions, sound, speed) is pinned to the bottom of the screen; music, voice and the scene-list button drop off. The last
scene of every tutor topic video ends with a **Try it now →** button (closes the video and jumps straight to the matching Hub tab or
form, via `openHowItWorks`'s sibling `hubGoto()` in `open.ts`) and a **Next video** button. "Watched" is only ticked once the last scene
is reached, never on open; reopening a video resumes from the last scene it was on (localStorage, best-effort).

## First-visit tour, "Show me" clips and Watch along

None of these is a new video: each is made of scenes of the existing films (`scripts/clips.ts`), played by the same player, so captions, narration and all 10 translations come for free.

- **"Show me" clips** (`CLIPS`, `TAB_CLIP`): one or two scenes (about 15 seconds; the e2e spec fails a clip over 20 s). A "Show me" button sits beside the "Watch:" link at the top of each tutor area and the parent Homework tab (`TabHowTo.tsx`, `HowItWorksButton variant="showme"`). It opens the window with `openHowItWorks({ role, clip, autoplay })`; the window offers "Watch the full video" to move to the whole topic. Watching a clip never ticks the topic as watched.
- **First-visit tour** (`TOURS`, `FirstTimeTour.tsx`): tutors and parents get ONE quiet card on their Hub Home (tutor: 10 scenes, one per area; parent: 6). It is an offer, never an ambush: nothing plays until they press "Start the tour", it is remembered per signed-in person per role (`localStorage` `aos.hiw.tour.<uid>.<role>`), afterwards only a small "Take the tour again" link remains, and the tour autoplays only when the device has not asked for reduced motion (no animation in the card itself, so it is calm-mode safe). A child's "tour" is their own short film, reached from the big button on their Home.
- **Watch along** (`family/WatchAlong.tsx`): `?tab=notes&child=<id>&open=lesson:<noteId>&watch=1`. A parent sees the child's own (assigned) lesson exactly as the child does, but the lesson player runs in its tutor-preview `readOnly` mode: nothing is started, answered or saved, and a banner says so. Entry points: a "Watch along" button under each Home homework row that has an interactive lesson, and the link in the weekly digest and homework reminder emails (`server/src/lib/hubDigest.ts hubLink`, `hubDigestEmail.ts watchBlock`). Sending stays off by default (`HUB_DIGEST_ENABLED`); tutors never get the banner or the read-only mode from this link.
- Message text for all three lives in `lib/i18n/messages/areas/hubhow.ts` (entry points), `howitworks/i18n/ui.ts` + the 10 overlays (window text) and `hubDigestEmail.ts` (emails). `e2e/how-it-works-tour-clips-watch.spec.ts` checks that every `hubhow.*` key used in the code exists in all 11 locales and that no raw key is ever painted.

## Changing the words

Edit `say`, `keys` and the `on:` phrases in `scripts/*.ts`. `e2e/how-it-works.spec.ts` fails if a key or cue phrase is not in the narration,
if a scene is over 430 characters, if a video runs over about 230 s, if a screen is missing, or if a cue names an element that is not on its screen.
**Every sentence must stay true of the app**: check it against the code before editing. No user-visible text (narration, captions, labels, screens) may name any content provider or third-party brand.

## Translations (10 locales)

The English scripts in `scripts/*.ts` stay the source of truth (byte-identical). Every other locale is an overlay, `i18n/<locale>.json` (`{ui, scripts, scenes}`), applied at runtime by `i18n/index.ts` (`useHowText()`); the player chrome strings live in `i18n/ui.ts` (English) and under `ui` in each overlay.

- A scene overlay holds the translated `chapter`, `title`, `say`, `keys`, and per cue array (`shots`, `cam`, `rings`, `cursor`, `callouts`, `nodes`) the translated `on`/`off` phrases and `text`/`title`/`sub`. Cues that name a screen element (`el`) are untouched: they look the element up in the recorded English screenshots.
- Every `on`/`off` phrase and every key anchor must be a verbatim (case-insensitive) substring of the translated `say`, or the scene silently stays English at runtime.
- After changing English wording: `node scripts/how-i18n-template.cjs` regenerates `i18n/template.json` (what translators work from); `node scripts/how-i18n-template.cjs --check [locale]` validates every overlay (also run by `e2e/how-it-works-i18n.spec.ts`).
- Voice: `narrator.ts` picks a device voice whose language matches the locale (`SPEECH_LANG`); with none installed, non-English falls back to captions on the scene clock (sound button disabled, note on the poster). RTL (ar, ur): the page, sheet and player take `dir`/`lang` from the locale.
- The recorded screenshots are English UI; translated narration names the localised tab and button names.

## Regenerating the screens

The captures use only throwaway `@activityos-test.com` accounts (the review fixture in `e2e/review/fixture.ts`); nothing is emailed and the
real tenants are never touched. The fixture (accounts, children, a booked-but-not-enrolled child, an invite, a science lesson with a
worksheet, a quiz with a tool question, homework) is cached in `scratch/hiw-fx.json` and rebuilt when its data is gone.

```bash
scripts/e2e-locked.sh e2e/review/how-it-works-shots.spec.ts -g "00 fixture|01 mia|02 quiz|cap "   # all captures -> scratch/hiw-raw
scripts/e2e-locked.sh e2e/review/how-it-works-shots.spec.ts -g "cap t-enrol"                      # or one recipe (needs the fixture to be alive)
node scripts/hiw-optimise.mjs                                                                      # -> public/how-it-works/*.webp + .rects.json + shots.gen.ts
node scripts/hiw-reel.mjs                                                                          # screen-record every video -> docs/how-it-works-reels/*.mp4
```

A capture refuses to save a broken moment (API unreachable, the welcome splash, a loading state), removes duplicate subject chips that come
from the fixture data, scrubs run stamps from names on screen, hides the dev badge, and never changes data. Children's screens are 390x844 @2x,
the rest 1440x900 @1.5x.

## Tests

`scripts/e2e-locked.sh e2e/how-it-works.spec.ts`: script integrity; the tutor chooser and deep links; every public page (poster first, no sound
before the click, play -> voice -> kinetic phrase + captions -> auto-advance -> pause -> next / previous -> captions toggle -> jump from the
list, no console errors, phone width, dark scheme, reduced motion); and the in-app entry points for tutor (hero -> chooser, area link, Enrol
dialog), parent (chooser, "What your child sees", Homework tab link, invite page) and child (button, voice on after the first tap, no links).
Speech is faked (silent, fast) so the run works anywhere.
