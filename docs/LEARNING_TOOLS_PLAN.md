# LEARNING HUB — SUBJECT TOOLS BUILD PLAN (for Claude Code)

**Owner:** Kaz James · **Target:** Learning Hub (tutor / student / parent portals) · **Version:** 1.1 (reconciled with the real repo, 23 Sep 2026)  
**Subjects:** Maths · English · Humanities (History, Geography, RE) · Spanish · French · German

> **v1.1 — WHAT CHANGED.** v1.0 was written without seeing the code and assumed Supabase/Postgres, Yjs, a monorepo and Vitest. The repo is actually **Next 16 + React 19 + Firestore (firebase-admin) + an Express API in `server/`, Daily for video, and a custom op-based whiteboard**. Sections 3, 4.1, 4.3, 4.5, 4.6, 10 and 11 below are rewritten to match; the tool catalogues (5–9) are unchanged. **Section 3 is the Phase 0 audit, already done.** Phase 0 is COMPLETE; start at Phase 1.
>
> **HOW TO USE THIS FILE IN CLAUDE CODE**
>
> 1. Save this file into the repo as `docs/LEARNING_TOOLS_PLAN.md`.
> 2. Open the Claude Code panel in VS Code.
> 3. Paste exactly: `Read docs/LEARNING_TOOLS_PLAN.md. Do PHASE 0 ONLY. Stop and report back using the Phase Report template in section 14.`
> 4. Review the report. Then paste: `Do PHASE 1 ONLY` — and so on. **Never ask for more than one phase at a time.**
> 5. Before every phase: make sure Git has committed the previous phase (see section 13). If Git is not installed, Phase 0 installs it.

---

## 0. THE ONE-PARAGRAPH BRIEF

UK platforms (MyMaths, Mathletics, MathsBot, Mathigon Polypad, Spelling Shed, Bedrock, Languagenut, Language Gym, Digimap for Schools, Bramble) win on three things our tools currently do not do: (1) **instruments that behave like the real thing** (a protractor you can rotate and snap, compasses that hold a radius), (2) **the same tool works in three modes** — tutor demonstrates it live, student practises with it, and the student's tool state *is* an auto-marked answer, and (3) **regenerating questions** so homework can be retried with new numbers. We will NOT build 150 separate widgets. We build **one tool engine** (a shared stage, instruments, ink, live sync, saving, marking) and then ship tools as small plug-ins on top of it, subject by subject, in the priority order in section 11.

---

## 1. RESEARCH SUMMARY — WHAT THE UK PLATFORMS ACTUALLY DO

### 1.1 Maths
| Platform | What matters for us |
|---|---|
| MyMaths (OUP) | Lesson ⇄ homework pairs; self-marking homework; questions regenerate on every attempt; traffic-light teacher dashboard; lessons used front-of-class on whiteboards; KS2 → A Level. |
| MyiMaths | Same engine for international curricula; tutor-friendly clear diagrams praised for whole-class teaching. |
| Mathletics (3P) | Differentiated assignment per student/group; auto-marked activities; rewards (points, certificates, unlockable worlds); printable worksheets alongside digital. |
| MathsBot (Jonathan Hall) | ~30 virtual manipulatives: algebra discs, algebra tiles, average & range tiles, bar modelling, coins, coordinate pegboard, counters, counting stick, Cuisenaire rods, dice, Dienes blocks, directed counters, dominoes, equation solver, fraction wall, geoboard, hundred square, Hungarian frame, number frames, pattern blocks, pentominoes, place value cards/counters/dice, prime factor tiles, rekenrek, Tak-tiles, tangrams, ten frame, two-colour counters, unit box. Plus question generators, starters, variation grids. |
| Mathigon Polypad | Single open canvas with geometry, number, fractions, algebra, probability & data tile sets; class codes; assignable activities with live view of student work; authoring mode; undo/redo on constructions; editable accessibility text per tile. Licensable technology. |
| MathsPad | Free whiteboard with protractor, compass, ruler; subscription to save; extra tools (constructions, plans & elevations, exterior angles, probability spinners). |
| Robocompass | Compass + straightedge constructions with step-by-step playback. |
| Gynzy | Front-of-class tool palette: ruler, triangle protractor, half-circle protractor, drawing compass, clocks, thermometer, base-10, number bonds, charts, timers, name picker, spotlight, curtain/cover. |
| Desmos | Embeddable graphing/geometry/scientific calculators via API — **production requires your own API key / partner arrangement**. |

### 1.2 English
| Platform | What matters for us |
|---|---|
| Bedrock Learning | Tier 2 + Tier 3 vocabulary taught through original fiction/non-fiction texts; grammar practice; adaptive placement; reading diagnostic; school/class/student reporting. |
| Spelling Shed / EdShed | Spelling scheme + games; **phonics mode** (spell with graphemes, not letters); **test mode** removes scaffolding; live "Hive" whole-class spelling competition; free **Letter Tiles** workspace (graphemes, prefixes, suffixes, grammar symbols, accented characters, freehand annotation, dictionary with audio). |
| Literacy Shed Plus | Visual stimuli → full teaching sequences; model texts; comprehension; grammar lessons. |

### 1.3 Modern Foreign Languages (Spanish, French, German)
| Platform | What matters for us |
|---|---|
| Languagenut | Vocab trainer across all four skills; GCSE sections per exam board; grammar taught in chunks/short sentences; custom content matched to scheme of work; dictation, read-aloud, photo-based speaking, gap-fill, translation tasks; AI chat; leaderboards. |
| Language Gym (Conti) | Verb Trainer (FR/ES/IT/DE) with cheat sheet; timed recognition games (reading + audio "Boxing"); Sentence Trainer: sentence puzzle, gapped sentences, delayed copying (EPI method). |
| Sentence Builders (Textivate/Taskmagic) | Substitution tables as the base for interactive activities. |
| Linguascope | Wide activity library, cheap site licence. |

**Critical 2026 context:** the reformed GCSE French/German/Spanish (teaching from Sept 2024, first exams summer 2026) adds **dictation** and **read-aloud**, is built on **sound–symbol correspondences (SSCs)** listed per language by the DfE, and uses **frequency-based vocab lists (≈1,200 Foundation / ≈1,700 Higher items)**. Any MFL tool that ignores dictation, read-aloud and SSC is already out of date.

### 1.4 Humanities
| Platform | What matters for us |
|---|---|
| Digimap for Schools (EDINA + Ordnance Survey) | OS maps at all scales, aerial + historical maps; search by postcode/place/grid reference; drawing & measuring tools; buffers; bring-your-own fieldwork data onto the map. Used by ~4,000 schools. |
| History resources (Tes, School History, Pearson guides) | Almost entirely static worksheets/PowerPoints for source analysis, interpretations, causation, chronology. **There is no dominant interactive history tool — this is our gap to own.** |

### 1.5 Tutoring platforms (our closest direct competitors)
| Platform | What matters for us |
|---|---|
| Bramble | Collaborative whiteboard for tutors; session recording; PDF export of the board sent after each session; progress dashboards. |
| Third Space Learning | Shared interactive whiteboard + bespoke maths tools + audio, lessons adapted for its AI tutor. |

---

## 2. CRITIQUE PASSES (5 reviewer lenses applied to the first draft)

Each lens attacked the first draft. Every finding below changed the plan.

### Lens A — Senior maths teacher
1. A protractor that only shows an angle between two draggable lines is a toy. Students must **place** a protractor on a line, align the baseline and centre, read the inner/outer scale. Our protractor must be an instrument, not a calculator.
2. Compasses must **hold a radius** once set against the ruler, and draw arcs (not only full circles) — constructions are arcs.
3. Need **both** 180° and 360° protractors, and a set square.
4. Constructions must be **auto-checkable** (perpendicular bisector, angle bisector, triangle SSS/SAS/ASA, loci) with a tolerance matching exam practice — default ±2 mm / ±2°, configurable per tenant; confirm against the board mark scheme.
5. Calculator must be switchable OFF for non-calculator practice.

### Lens B — MFL head of department
6. Accent input is non-negotiable and must work on iPad and Chromebook without OS keyboard switching.
7. Marking must have **accent strictness** settings (strict / warn / lenient) — dictation credits accurate spelling; low-stakes practice shouldn't fail a student over one accent.
8. Browser text-to-speech voices vary wildly by device (some Chromebooks have no German voice). Use **pre-generated cloud TTS audio, cached per phrase**, with browser TTS only as fallback.
9. Read-aloud feedback: browser speech recognition is unreliable outside Chrome. Use server-side speech-to-text (routes through the AI cost model: cheap model, per-tenant budget gate).
10. Exam listening is heard a fixed number of times — our player needs an **exam mode** that limits replays and adds exam-style pauses.

### Lens C — Safeguarding / data protection
11. Students are minors. Any AI feature (writing feedback, AI chat, speech) must be logged, rate-limited, moderated, and visible to the tutor. No unsupervised open chat by default.
12. Audio recordings of children are personal data: retention limit (default 90 days, tenant-configurable), deletion on request, never used for model training, stored per tenant.
13. Follow the UK Children's Code principles: high-privacy defaults, no nudge techniques. **Leaderboards default OFF** and show first-name-initial only.

### Lens D — Platform architect (ActivityOS rules)
14. Single codebase, `tenantId` on every stored doc (tool states, recordings, custom content). Never fork per tenant.
15. White-label: all tool colours read CSS variables from the tenant token map — no hard-coded brand colours.
16. Style shared components by **class**, never by ID — tools mount many times per page (live lesson + homework preview).
17. Never inject tool UI as a direct child of a CSS-grid layout container. Mount inside the page content area, inside a view, or as `position:fixed` on `document.body` (full-screen tool mode).
18. Unbuilt P2 tools show greyed-out **"Coming soon"** — not hidden.
19. Licences: **tldraw SDK needs a paid commercial licence key for production** — do not use it. Desmos production needs its own key/partner agreement — put graphing behind an adapter so the engine is swappable. Only use MIT/BSD/Apache/ISC-licensed libraries unless Kaz approves.

### Lens E — Student / SEND / accessibility
20. Every instrument must be usable **without a mouse**: keyboard shortcuts (arrow keys move, Shift+arrows rotate, +/− resize) and on touch (two-finger rotate).
21. WCAG 2.2 AA: contrast, focus rings, screen-reader labels, reduced motion.
22. Dyslexia support: font toggle, line spacing, coloured overlay, read-aloud of instructions.
23. Big hit targets on phones (min 44×44 px); the customer portal is a phone layout.

### Findings that were REJECTED (and why)
- "Embed Polypad for everything" — rejected: licensing cost and we lose control of marking, branding and tenant data. Revisit only if Phase 2 slips badly.
- "Copy MyMaths lesson content" — rejected outright: IP. We build original generators and content.
- "Build a full GIS" — rejected: out of scope. We build a schools-level map tool on open tiles (section 8).

---

## 3. CURRENT-STATE AUDIT (Phase 0 — DONE 23 Sep 2026, read-only)

**Answers to the 8 questions**
1. **Frontend:** Next.js 16.2 (Turbopack) + React 19, TypeScript. Learning Hub lives in `features/learninghub/`; panels are self-contained modules registered in `panels.tsx` (`PANEL_MODULES`, `TAB_ORDER`), each exporting `meta` + `Panel`. Unbuilt panels render greyed "Coming soon" (`meta.status:"soon"`).
2. **Backend/DB:** Express API in `server/` (port 4000, `tsx watch`), **Firestore** via `firebase-admin`. No SQL, no RLS. Collections are flat camelCase `hub*` docs with ISO-string dates.
3. **Realtime:** two layers. (a) `useRealtime([...collections], refresh)` over server-sent events for content collections (`HUB_CONTENT_CHANNELS` in `server/src/routes/events.ts`). (b) **Live lessons sync over Daily `sendAppMessage`** (`live/board/sync.ts`): op batches every ~40 ms, last-writer-wins on element version `v`, receiver-side permission checks, wire sanitiser `wireGuard.ts`. **There is no Yjs and no CRDT library — do not add one; extend the op protocol.**
4. **Item schemas:** questions = `hubQuestions`, quizzes/tests = `hubAssessments` (+ `hubAttempts`), lessons = `hubNotes` (structured `lesson` field), homework = `hubHomework` + `hubSubmissions`, flashcards = `hubFlashcards` + `hubFlashcardReviews`, live lessons = `hubLessons`, boards = `hubBoards`. See `docs/learning-hub.md` for exact shapes.
5. **Tenant isolation:** every doc carries `tenantId` (+ `franchiseId|null`, `createdBy`); enforced in the route handlers (`server/src/routes/hub/*`, `teachingCommon.ts`), not by the database. Every new route MUST reuse those scope helpers. Parents pass `?tenantId=&childId=`.
6. **Theme tokens:** CSS custom properties in `app/globals.css` (`--bg --surface --panel --ink --line --brand --cta --sem-*`); hub components read them through `kit.tsx`. Tools use only these (plus `--tool-*` aliases defined in Phase 1).
7. **Tests:** **no Vitest/Jest.** Pure-logic tests are `*.selftest.ts` run with `npx tsx <file>` (board reducer, sync, toolkit, wireGuard). Playwright (`@playwright/test`) is installed with 57 specs in `e2e/` (`learning-hub-*.spec.ts`). Standard for this plan: **selftest.ts for logic (generators, checkers, geometry) + Playwright for UI.** Do not add Vitest.
8. **Git:** installed (2.55). Repo committed; work happens on branch `learning-hub-work-2026-09-23` (snapshot commit `06abf1d`). Phase branches `tools/phase-N` are cut from it.

**What already exists (KEEP — build on it, never delete)**
| # | Existing | Subject | What it does | Weakness | Decision |
|---|---|---|---|---|---|
| 1 | `live/board/*` whiteboard | all | Vector board over Daily: pen, highlighter, shapes, text, stickies, images, pages, student pads, laser, PNG export to lesson notes, per-lesson save (`hubBoards`) | No PDF import/export; tools are stamps, not instruments | **KEEP = X-01.** Extend, don't rebuild |
| 2 | `live/board/toolkit/*` (7 packs, ~96 templates) + `render-stamps.ts` | all | Data-driven stamps: number line, fraction bar/wall, coord grid, times table, clock, ruler, protractor, graph plotter, 100 square, ten frame, place value, bar model, arrays, Venn, timeline, periodic table… | Ruler/protractor are non-snapping stamps; no marking | **KEEP**; M-01/M-02/M-03 become real instruments that replace the stamps once tested |
| 3 | `lesson/widgets/*` — 2 native + ~50 legacy JS widgets via `LegacyWidget` (`scratch/prototype/widgets/*.js`, generated by `npm run hub:widgets`) | maths, english, MFL, science | "Explore" widgets attached to a lesson (`lesson.widget`): angleExplorer, balance, chartBuilder, clockFace, coordGrid, fractionWall, numberLine, probSim, transformGrid, wordClass, punctFixer, spellingLCWC, langVerbs/Gender/Listen/Numbers/Sounds/Agree… | Cosmetic XP only; no saved state, no marking, no modes | **KEEP and register in the Tools tab as `legacy` tools**; port to real tools one by one |
| 4 | `remotesync/NumberLineTool.tsx`, `HelpTools.tsx` | maths | Tutor-driven tools inside remote-sync lessons | Separate from board | KEEP; absorb into M-40 later |
| 5 | Flashcards (SM-2 in `server/src/lib/hubSrs.ts`) | all | Spaced repetition | SM-2 not FSRS | KEEP SM-2. **Do not add ts-fsrs** unless Kaz asks |
| 6 | "Written answers to mark" flow, quizzes, homework, in-person, mastery | all | Marking + attempt pipeline | No `tool` question kind | EXTEND in Phase 3 |
| 7 | `katex` | maths | Installed | — | reuse |

**Genuinely missing:** Tools tab · shared engine (stage/state/undo/registry/host) · tool-as-question item + checkers · seeded regenerating generators · compass, set square, straight edge, construction checker · accent input + marking policies · dictation/SSC/TTS · annotator/source tools · maps.

## 4. ARCHITECTURE — THE TOOL ENGINE

### 4.1 Layout (single Next app — NO monorepo, NO packages/)
```
features/learninghub/tools/
  registry.ts          every tool (all 118) with metadata; `status: "live"|"soon"`; `impl` = {kind:"widget",id} | {kind:"native",Component} | none
  ToolsPanel.tsx       the Tools tab (exports `meta` + `Panel`)
  ToolHost.tsx         mounts one tool in teach | practise | assess mode; autosave; error boundary
  engine/
    Stage.tsx          SVG stage: pan, zoom, world units (mm), layers, pointer capture, hit-testing
    state.ts           versioned JSON state, undo/redo (pure, selftest-covered)
    keyboard.ts        keymap + focus handling + live-region announcer
    theme.css          --tool-* aliases onto the existing tenant tokens
    geometry/          points, segments, rays, circles, arcs, intersections, angles (pure TS, selftests)
    marking/           checker framework: {score,max,feedback[],log}
    generators/        seeded PRNG + generator contract
  maths/ english/ mfl/ humanities/ x/    one folder per tool
server/src/routes/hub/toolsApi.ts        /api/learning-hub/tools/* (mounted from teachingApi.ts)
```
Ink reuses the board's stroke code (`live/board/render.ts`); do not add perfect-freehand unless the board's pen proves insufficient.

### 4.2 Host (React component; web component deferred)
Every surface that mounts a tool is React inside the same Next app, so the host is a plain React component: `<ToolHost toolId="maths.protractor" mode="teach" context={{type,id}} />`. Keep the tool code free of React-specific state (tool logic = pure functions + a small view) so a custom-element wrapper can be added later if a tool ever has to run outside React.

### 4.3 The ToolDefinition contract (every tool implements this)
```ts
interface ToolDefinition<S> {
  id: string;                       // "maths.protractor"
  subject: 'maths'|'english'|'humanities'|'mfl';
  languages?: ('es'|'fr'|'de')[];   // MFL only
  keyStages: ('KS1'|'KS2'|'KS3'|'KS4'|'KS5')[];
  tier: 'P1'|'P2';
  modes: ('teach'|'practise'|'assess')[];
  stateSchemaVersion: number;
  initialState(params?: unknown): S;
  migrate(old: unknown, fromVersion: number): S;
  mount(stage: Stage, ctx: ToolContext): ToolInstance<S>;
  checkers?: CheckerDefinition<S>[];      // for assess mode
  generators?: GeneratorDefinition[];     // regenerating questions
  keyboardMap: KeyBinding[];
  a11yDescription(state: S): string;      // screen-reader summary
  exportSVG?(state: S): string;           // for PDF/board export
}
```

### 4.4 The three modes (the single most important idea in this plan)
1. **Teach** — tutor drives; big UI; spotlight, curtain/reveal, "push tool to all students", "freeze students", "show student N's board".
2. **Practise** — student free use; hints on; state autosaves; no marking.
3. **Assess** — tool is a question item. Student's final tool state is submitted and marked by the tool's checker. Scaffolds removable (Spelling Shed "test mode" idea). Seeds make each attempt regenerate.

### 4.5 Data model (Firestore collections — flat, camelCase, ISO dates; all carry `tenantId`, `franchiseId|null`, `createdBy`, `createdAt`)
1. `hubToolStates` — id, tenantId, franchiseId, ownerUid | childId, toolId, contextType (`liveLesson|lesson|homework|quiz|free`), contextId, schemaVersion, state (JSON, ≤ 200 KB), updatedAt.
2. `hubToolItems` — a tool question: toolId, generatorId, params, checkerId, checkerParams, marks. Surfaces as a new question kind `tool` in `hubQuestions` (Phase 3) rather than a parallel item list.
3. `hubToolAttempts` — toolItemId, childId, seed, finalState, autoScore, maxScore, checkerLog, teacherOverrideScore, submittedAt. (Or extra fields on `hubAttempts`, decided in Phase 3.)
4. `hubToolMedia` — kind (`recording|upload|ttsCache`), storagePath, language, retentionUntil.
5. `hubToolContent` — custom vocab lists, sentence builders, texts, timelines: toolId, title, content, visibility (`private|tenant`).
6. Settings live in the existing hub settings (`lib/hubConfig.ts` `HubSettings.tools`) — not a new collection.
7. `hubToolEvents` — append-only usage log (Phase 1): `{tenantId, toolId, kind:"open"|"comingSoonClick", mode, at}`; drives P2 priority.
Rules: every route reuses the hub scope helpers (`teachingCommon.ts`); parents only ever read/write their own enrolled child's rows; add each new collection to `e2eCleanup`, to the privacy export/erase (`eraseChildLearning`) and, where a family reads it, to `HUB_CONTENT_CHANNELS`.

### 4.6 Libraries (re-verify licence before installing; print it in the phase report)
| Need | Decision |
|---|---|
| Freehand ink | reuse the whiteboard's own stroke code — **no new dependency** |
| Realtime | **extend the Daily `sendAppMessage` op protocol** (`live/board/sync.ts`, `wireGuard.ts`) — **no Yjs** |
| Maths rendering | `katex` (already installed, MIT) |
| Maths input | MathLive (MIT) — add in Phase 7 when M-55 is built |
| Graphing | Adapter interface; default = the board's own `mathExpr.ts` plotter; JSXGraph/function-plot or Desmos only if needed (decision D1) |
| Maps | MapLibre GL JS (BSD-3) + OSM/OS Open Zoomstack, attribution shown — Phase 8 |
| Charts | own SVG renderer |
| Spaced repetition | existing SM-2 (`hubSrs.ts`) |
| PDF import (board) | `pdfjs-dist` (Apache-2.0) — only when Kaz approves |
| Tests | `tsx` selftests + Playwright (both already present) |

**Banned without Kaz's written approval:** tldraw, Yjs/other CRDT stacks, Vitest/Jest, any GPL/AGPL library, anything that phones home.

### 4.7 Marking framework
1. **Deterministic checkers** (instant, free): numeric within tolerance; angle within tolerance; length within tolerance; point on locus; line is perpendicular bisector of AB; arc centred at P with radius r; set equality; ordered sequence; string match with accent/case/punctuation policies; regex; conjugation match.
2. **AI rubric checkers** (English/Humanities extended writing, MFL free writing): rubric JSON per item → cheap model → returns score + criterion-by-criterion evidence → lands in the existing **"Written answers to mark"** queue for tutor confirm/override. AI never finalises a mark without tutor confirm unless the tenant enables auto-release.
3. Every checker returns `{score, max, feedback[], log}` so tutors can see *why*.

### 4.8 AI cost routing (follows the locked AI cost model)
1. Text marking/feedback → cheap model, per-tenant monthly budget gate.
2. TTS → generate once per phrase per voice, cache in `hubToolMedia`, reuse forever (near-zero ongoing cost).
3. STT for read-aloud/speaking → metered; counts against the tenant's voice allowance; hard ceiling auto-disables the feature for the month with a friendly message.
4. Platform-wide spend limit as backstop.

---

## 5. MATHS TOOLS (enumerated)

Tier P1 = build in first pass. P2 = greyed "Coming soon" until built.

### 5.1 Geometry set (the headline fix)
| ID | Tool | Tier | Done means |
|---|---|---|---|
| M-01 | Ruler (cm/mm, 15 cm & 30 cm, rotatable) | P1 | Drag, rotate (handle + Shift+arrows), snap edge to points/lines; draw straight line along edge; readable mm ticks at every zoom. |
| M-02 | Protractor 180° (dual inner/outer scale) | P1 | Place centre on a point (snap), align baseline to a line (snap), rotate; readout optional (off in assess mode); mark an angle with a dot; draw ray through mark. |
| M-03 | Protractor 360° | P1 | Same as M-02, full circle; reflex angles. |
| M-04 | Pair of compasses | P1 | Set radius by dragging legs or against ruler; lock radius; draw arc (sweep) or full circle; pencil leg shows live radius (off in assess). |
| M-05 | Set square 45° and 30/60° | P1 | Slide along ruler to draw parallels; right angles. |
| M-06 | Straight edge (unmarked) | P1 | For pure compass-and-straightedge constructions (no measurements). |
| M-07 | Construction checker | P1 | Checkers for: perpendicular bisector, angle bisector, perpendicular from/at a point, triangle SSS/SAS/ASA/RHS, equilateral triangle, 60°/90°/45°/30° constructions, loci (fixed distance from point/line, equidistant from two points/lines), regions. Tolerance from tenant settings (default ±2 mm/±2°). Construction arcs must be present if "show construction lines" required. |
| M-08 | Construction replay | P2 | Step-through playback of how a construction was made (Robocompass idea) — for tutors to review student method. |
| M-09 | Angle facts board | P1 | Parallel lines + transversal, triangle, polygon interior/exterior; drag to vary; label angles; hide/reveal values. |
| M-10 | Bearings tool | P1 | North line, 3-figure bearings, back bearings; checker. (Shared with Geography H-G05.) |
| M-11 | Circle theorems explorer | P2 | Drag points on circle; angle relationships update. |
| M-12 | Pythagoras & trig visualiser | P2 | Right-angled triangle, squares on sides, SOH-CAH-TOA labelling. |

### 5.2 Grids, graphs & transformations
| ID | Tool | Tier | Done means |
|---|---|---|---|
| M-20 | Paper backgrounds: squared, dotted, isometric, graph (mm), polar | P1 | Any tool can sit on any background; print-accurate export. |
| M-21 | Coordinate grid (4 quadrants, configurable axes) | P1 | Plot/drag points, label, join; checker for plotted points. |
| M-22 | Function plotter (via GraphEngine adapter) | P1 | Linear, quadratic, cubic, reciprocal, exponential, trig; table of values generator; gradient/intercept readout; checker for drawn line within tolerance. |
| M-23 | Transformations (reflect, rotate, translate, enlarge incl. fractional/negative scale factor) | P1 | Pick centre/mirror line/vector; ghost preview; checker compares image. |
| M-24 | Loci & regions shader | P2 | Shade region satisfying conditions; checker. |
| M-25 | Plans & elevations / 3D shape viewer + nets | P2 | Rotate solid, unfold net, plan/front/side views on isometric grid. |
| M-26 | Geoboard | P2 | Rubber bands on pegs; area/perimeter readout toggle. |
| M-27 | Tangrams, pattern blocks, pentominoes | P2 | Drag/rotate/flip, snap. |

### 5.3 Number & algebra manipulatives
| ID | Tool | Tier | Done means |
|---|---|---|---|
| M-40 | Number line (integers, decimals, fractions, blank; zoomable) | P1 | Jumps/arcs, markers, hide labels; checker for placed value. |
| M-41 | Place value chart + counters (incl. decimals) | P1 | Exchange 10-for-1 by drag. |
| M-42 | Dienes / base-10 blocks | P1 | Break/combine. |
| M-43 | Bar model | P1 | Part-whole and comparison bars, labels, split into equal parts. |
| M-44 | Fraction wall + fraction circles | P1 | Equivalence, compare, add same-denominator. |
| M-45 | Hundred square | P1 | Highlight patterns, hide cells. |
| M-46 | Multiplication grid / times-table trainer | P1 | Timed mode; KS2 Multiplication Tables Check style drill. |
| M-47 | Two-colour & directed counters (zero pairs) | P1 | Negative numbers. |
| M-48 | Algebra tiles | P1 | x², x, 1 (positive/negative), expand/factorise, completing the square. |
| M-49 | Algebra discs | P2 | Collecting like terms. |
| M-50 | Balance scale equation solver | P1 | Do-the-same-to-both-sides steps recorded. |
| M-51 | Prime factor tree + Venn for HCF/LCM | P1 | Checker for final product of primes. |
| M-52 | Double number line / ratio table | P1 | Proportional reasoning. |
| M-53 | Cuisenaire rods | P2 | |
| M-54 | Ten frame, rekenrek, number frames | P2 | Primary. |
| M-55 | Equation/expression editor (MathLive) | P1 | Used by every maths question for typed answers; equivalence checking. |

### 5.4 Data & probability
| ID | Tool | Tier | Done means |
|---|---|---|---|
| M-60 | Chart builder: bar, dual bar, pictogram, line, pie (with protractor link), scatter + line of best fit, histogram (unequal widths), box plot, cumulative frequency, stem-and-leaf | P1 (bar, pie, scatter, line) / P2 (rest) | Student draws the chart from data; checker verifies. |
| M-61 | Frequency table / tally | P1 | Including grouped data, mean from table. |
| M-62 | Probability tree | P1 | Branches, fractions/decimals, checker. |
| M-63 | Sample space grid & Venn diagram (2 and 3 sets) | P1 | |
| M-64 | Dice / coin / spinner simulator | P1 | Relative frequency chart as trials run. |
| M-65 | Averages & range tiles | P2 | |

### 5.5 Measure & calculators
| ID | Tool | Tier | Done means |
|---|---|---|---|
| M-80 | Scientific calculator (GCSE-style key layout, original design) | P1 | Fractions, powers, roots, trig (deg), memory; **tenant/tutor can disable per item** for non-calculator practice. |
| M-81 | Four-function calculator | P1 | Primary. |
| M-82 | Clocks: analogue (draggable hands), digital, 12/24h converter | P1 | |
| M-83 | UK coins & notes | P1 | Making amounts, change. |
| M-84 | Measuring scales: jug, thermometer, weighing scale, ruler readings | P2 | Read-the-scale questions with generators. |
| M-85 | Area/perimeter on squared grid | P2 | |
| M-86 | Unit converter trainer (metric, time, speed) | P2 | |

### 5.6 Maths question generators (regenerating, seeded)
| ID | Generator family | Tier |
|---|---|---|
| M-G01 | Measure/draw angle (random angle, random orientation) | P1 |
| M-G02 | Construct (perp bisector / angle bisector / triangle from random valid lengths) | P1 |
| M-G03 | Plot points / read coordinates | P1 |
| M-G04 | Plot graph from equation | P1 |
| M-G05 | Transformations (random shape, random transformation) | P1 |
| M-G06 | Number line placement | P1 |
| M-G07 | Fractions equivalence/compare | P1 |
| M-G08 | Prime factorisation | P1 |
| M-G09 | Bearings | P1 |
| M-G10 | Draw pie chart from table | P1 |
| M-G11 | Probability tree completion | P1 |
| M-G12 | Solve linear equation (balance) | P1 |
| M-G13 | Expand/factorise (tiles) | P2 |
| M-G14 | Read a scale | P2 |

---

## 6. ENGLISH TOOLS (enumerated)

| ID | Tool | Tier | Done means |
|---|---|---|---|
| E-01 | Text annotator | P1 | Load text (tenant upload or public-domain library); highlight in colour-coded categories (tenant-configurable: e.g. language, structure, context, technique); margin notes; arrows; tutor and student layers; export to PDF. Works on phone (tap-to-select sentence/word). |
| E-02 | Technique tagger (assess mode of E-01) | P1 | "Find 3 examples of metaphor" — checker matches spans against an answer key with overlap tolerance. |
| E-03 | Quotation bank | P1 | Save quotes from E-01 with theme/character tags; auto-generates Flashcards (links to existing Flashcards tab). |
| E-04 | Paragraph builder (PEE / PETAL / What-How-Why — tenant picks the scaffold) | P1 | Colour-coded slots; drag sentences into order; free-write mode; AI rubric feedback optional. |
| E-05 | Essay planner | P1 | Thesis → paragraph cards → evidence slots → conclusion; timer; converts to writing frame. |
| E-06 | Timed writing pad | P1 | Word count, timer, exam-style conditions (no spellcheck toggle), autosave, submit to "Written answers to mark". |
| E-07 | Word-class & sentence parser | P1 | Tag each word (noun, verb, adjective, adverb, pronoun, preposition, conjunction, determiner); identify clauses (main/subordinate/relative); checker. Covers KS2 SPaG. |
| E-08 | Punctuation fixer | P1 | Insert/remove punctuation in a passage; checker with diff view. |
| E-09 | Spelling trainer | P1 | Look–say–cover–write–check; audio (cached TTS); **phonics mode** with grapheme tiles; test mode strips scaffolds; statutory KS2 word lists + tenant custom lists. |
| E-10 | Letter/grapheme tiles workspace | P1 | Letters, digraphs/trigraphs, prefixes, suffixes; snap to build words; freehand annotate. |
| E-11 | Morphology explorer (prefix–root–suffix) | P1 | Build/split words; meaning of parts; Tier 2 vocab focus. |
| E-12 | Vocabulary trainer (Tier 2 / Tier 3) | P1 | Definition, example sentence, synonyms/antonyms, spaced repetition (ts-fsrs), shared engine with L-05. |
| E-13 | Poetry scanner | P2 | Mark stressed/unstressed syllables, rhyme scheme letters, enjambment, caesura; comparison grid for two poems. |
| E-14 | Comparison grid | P2 | Two texts side by side; similarities/differences table. |
| E-15 | Readability & sentence-variety checker | P2 | Sentence length histogram, sentence openers, repeated words — for students' own writing. |
| E-16 | Comprehension question layer | P1 | Attach retrieval/inference questions to line numbers of an E-01 text. |
| E-17 | Live "Hive-style" spelling bee | P2 | Tutor-led, whole group spells same word at once; leaderboard OFF by default. |

**Copyright rule for English texts:** ship only public-domain texts in the built-in library (e.g. Shakespeare, Dickens, Brontë, Stevenson, Shelley, pre-1900 poetry). Copyrighted set texts are **tenant uploads only**, private to that tenant, with a notice that the tenant is responsible for rights.

---

## 7. MFL TOOLS — SPANISH, FRENCH, GERMAN (enumerated)

**One engine, three language packs.** Each pack = `mfl/packs/{es|fr|de}/` containing: alphabet & accent set, SSC list, verb tables, grammar rules, vocab lists, TTS voice IDs, false-friend list. Adding Italian later = add a pack.

### 7.1 Accent sets (built into L-01)
- **Spanish:** á é í ó ú ñ ü ¿ ¡ (+ capitals)
- **French:** à â æ ç é è ê ë î ï ô œ ù û ü ÿ « » (+ capitals)
- **German:** ä ö ü ß (+ capitals Ä Ö Ü, ẞ)

### 7.2 Tools
| ID | Tool | Tier | Done means |
|---|---|---|---|
| L-01 | Accent bar + shortcut input | P1 | Appears on every MFL text field; tap buttons; keyboard shortcuts (e.g. type `e'` → é, `a:` → ä, `ss` suggestion → ß); works on iPad and Chromebook; per-language set. |
| L-02 | Marking policy engine | P1 | Accent strictness (strict/warn/lenient), capitalisation (strict for German nouns by default), punctuation, article tolerance; tutor sets per item; tenant default in settings. |
| L-03 | Verb conjugation trainer | P1 | All GCSE tenses per language (present, preterite/perfect, imperfect, near future, future, conditional; + subjunctive/pluperfect for Higher where on spec); regular families + key irregulars; timed and untimed; cheat-sheet toggle; typed with L-01; stats per verb/tense. |
| L-04 | Sentence builder (substitution tables) | P1 | Tutor builds columns of chunks; student activities generated automatically: build sentence, translate, gapped sentence, sentence puzzle (jumbled), delayed copy, spot the error. |
| L-05 | Vocab trainer with spaced repetition | P1 | Four-skill modes: see→meaning, hear→meaning (cached TTS), meaning→type, hear→type (dictation-lite); ts-fsrs scheduling; lists = tenant custom + our own frequency-based core list (see 7.4). |
| L-06 | Dictation trainer (GCSE 2026) | P1 | Sentence played (default 3 plays, exam mode enforces limit + pauses); student types; diff view shows letter-level errors; scoring uses L-02; generator builds sentences from known vocab + SSC targets. |
| L-07 | Sound–symbol (SSC) phonics trainer | P1 | Per-language SSC list; hear the sound → pick spelling; see spelling → hear & repeat; minimal pairs; links every SSC to example words. |
| L-08 | Read-aloud trainer (GCSE 2026) | P1 | Student reads short text; recording saved (retention policy); server STT compares to target; highlights words likely mispronounced; tutor can listen and mark; metered per AI cost model. Fallback when STT unavailable/over budget: record-only, tutor marks. |
| L-09 | Listening player | P1 | Speed 0.75×/1×, replay count, exam mode, transcript reveal, gap-fill overlay. |
| L-10 | Gender & article trainer | P1 | ES el/la/los/las/un/una; FR le/la/l'/les/un/une/des; DE der/die/das + plural forms; colour coding consistent across all MFL tools (tenant-configurable colours via CSS vars). |
| L-11 | German case trainer | P1 | Nominative/accusative/dative/genitive articles and adjective endings; preposition → case drill. |
| L-12 | Adjective agreement trainer (ES/FR) | P1 | Gender/number agreement, position (before/after noun). |
| L-13 | Translation tool (EN→TL and TL→EN) | P1 | Multiple accepted answers per item; L-02 policies; AI rubric for longer passages → "Written answers to mark". |
| L-14 | Writing frame (90-word / 150-word style tasks) | P2 | Bullet prompts, tense checker (flags which tenses used), word count, connective/opinion phrase bank. |
| L-15 | Speaking prep: role-play & photo card | P2 | Prep timer, notes, record answer, tutor feedback. |
| L-16 | Numbers, dates, times & prices trainer | P1 | Hear → type digits; see digits → say/type words. |
| L-17 | Cognates & false friends spotter | P2 | |
| L-18 | Bilingual glossary lookup (per tenant list) | P2 | Pop-up on any word in an MFL text. |
| L-19 | Timed recognition game (Boxing-style) | P2 | Speed of recognition, reading and audio versions. Original design — do not copy Language Gym UI. |

### 7.3 Pronunciation audio
1. Cloud TTS voices chosen per language (tenant can pick regional voice: Spain/LatAm Spanish, France French, Germany German).
2. Every phrase hashed (language + voice + text) → generated once → stored in `hubToolMedia` as `tts_cache` → CDN-served.
3. Tutor can replace any TTS clip with their own recording.

### 7.4 Vocabulary lists — licensing warning
The DfE subject content defines the framework; exam boards publish their own lists. **Do not bulk-import an exam board's vocab list into the product without checking its reuse terms.** Default: build our own frequency-based core list per language from openly licensed frequency data, tagged by theme; let tenants upload their board's list privately. Kaz to confirm licence position before Phase 5.

---

## 8. HUMANITIES TOOLS — HISTORY, GEOGRAPHY, RE (enumerated)

### 8.1 History
| ID | Tool | Tier | Done means |
|---|---|---|---|
| H-H01 | Timeline builder | P1 | Zoomable BC/AD + dates; events, periods (bars), images; drag to reorder; assess mode = "place these events in order / on the timeline" with checker. |
| H-H02 | Chronology sort | P1 | Card sort with checker; before/after/during relationships. |
| H-H03 | Source analyser | P1 | Source image/text + provenance panel (who/when/why/audience — **N**ature, **O**rigin, **P**urpose); annotate content; inference ladder (what it says → what I can infer → evidence); usefulness/reliability judgement slider with justification box → AI rubric feedback. |
| H-H04 | Interpretations comparer | P1 | Two interpretations side by side; highlight agreement/difference; "why might they differ" scaffold. |
| H-H05 | Causation map | P1 | Nodes (causes) + weighted arrows → event; categories (political, economic, social, religious, individual); diamond-9 ranking; fishbone view. |
| H-H06 | Change & continuity graph | P2 | Plot "extent of change" over time periods (e.g. medicine through time). |
| H-H07 | Significance scorer | P2 | Criteria-based scoring (e.g. remarkable, remembered, resonant) — tenant can edit criteria. |
| H-H08 | Historic environment site plan annotator | P2 | Annotate a site map/plan image. |
| H-H09 | Essay/judgement planner (16-mark style) | P1 | Shares E-05 engine with history-specific scaffold (for/against/judgement). |

### 8.2 Geography
| ID | Tool | Tier | Done means |
|---|---|---|---|
| H-G01 | Map viewer (MapLibre + open tiles) | P1 | Pan/zoom, search place/postcode, draw points/lines/polygons, labels, symbols, attribution shown. **Not** OS Explorer mapping (that's Digimap's licence) — use OSM/OS Open data. |
| H-G02 | Grid reference trainer (4- and 6-figure) | P1 | Uses a generated OS-style practice map (our own SVG with symbols, contours, grid) so it's licence-free; checker. |
| H-G03 | Scale & distance tool | P1 | Measure straight and along-route distance on practice maps and real map; scale bar. |
| H-G04 | Contours & cross-section tool | P1 | Draw a line across contours → auto cross-section; student sketches cross-section in assess mode. |
| H-G05 | Compass directions & bearings | P1 | 8-point compass + 3-figure bearings (shares M-10). |
| H-G06 | Climate graph builder | P1 | Temperature line + rainfall bars on dual axis from data table; checker. |
| H-G07 | Population pyramid builder | P1 | From data; interpret. |
| H-G08 | Choropleth map maker | P2 | Shade regions by data classes; key. |
| H-G09 | Fieldwork data kit | P2 | Enter survey data (e.g. river width/depth, pedestrian counts, questionnaires) on phone → auto graphs (M-60) → pin on map (H-G01). |
| H-G10 | Development indicators scatter | P2 | Reuses M-60 scatter. |
| H-G11 | Sketch-map annotator | P1 | Annotate photos/field sketches (label-and-explain). |

### 8.3 RE
| ID | Tool | Tier | Done means |
|---|---|---|---|
| H-R01 | Evaluation planner (12-mark style: for / against / conclusion) | P1 | Shares E-05 engine; sources of wisdom/authority slots. |
| H-R02 | Concept map | P2 | Beliefs → teachings → practices links. |
| H-R03 | Viewpoint comparer | P2 | Compare perspectives within/between traditions — neutral, respectful wording; tenant edits content. |

---

## 9. CROSS-SUBJECT TOOLS (every subject gets these)

| ID | Tool | Tier | Done means |
|---|---|---|---|
| X-01 | Tutor whiteboard (infinite canvas, pages, ink, text, shapes, images, PDF import) | P1 | Our own canvas (NOT tldraw); any subject tool can be dropped onto it; export whole board to PDF after a session (Bramble-style). |
| X-02 | Live classroom controls | P1 | Push tool to students, freeze, spotlight, curtain/reveal, view student boards grid, hand-raise, timer. |
| X-03 | Timer / stopwatch | P1 | |
| X-04 | Name picker / group maker | P2 | |
| X-05 | Card sort / matching (generic) | P1 | Used by every subject; checker. |
| X-06 | Diamond-9 / ranking | P1 | Shared H-H05. |
| X-07 | Venn / T-chart / table | P1 | |
| X-08 | Text-to-speech on any instruction | P1 | Accessibility. |
| X-09 | Dyslexia & accessibility panel | P1 | Font, spacing, overlay, reduced motion, high contrast. |
| X-10 | Screenshot/snip into homework | P2 | |

---

## 10. WHERE TOOLS APPEAR IN THE LEARNING HUB (UI integration)

Existing Learning Hub tabs: Home, Live lessons, Students, Progress, Placement test, Quizzes, Homework, Lessons, Flashcards.

1. **New tab: "Tools"** (between Lessons and Flashcards) — subject filter chips (Maths / English / Humanities / Spanish / French / German), search, key-stage filter. P2 tools shown greyed with "Coming soon".
2. **Live lessons** — tool dock on the live board (X-01/X-02); tutor opens any tool in Teach mode and pushes it to students.
3. **Lessons** — "Insert tool" block in the lesson builder (Practise mode).
4. **Quizzes & Homework** — new item type **"Tool question"**: pick tool → pick generator (or fixed params) → pick checker + marks → preview with 3 random seeds.
5. **Progress** — per-tool mastery (e.g. angles measured within tolerance %, verbs by tense accuracy), traffic-light view per student (MyMaths idea).
6. **Home → "Needs your attention"** — AI-assisted written answers flow into existing "Written answers to mark"; read-aloud recordings into a new row "Recordings to review".
7. **Flashcards** — E-03 quotation bank, L-05 vocab and H-H01 timeline events can generate flashcard decks.
8. **Placement test** — can include tool questions (e.g. measure an angle) for diagnostics.
9. **Student portal** — "My tools" (practise mode) + assigned tool questions.
10. **Parent/customer portal (phone layout)** — read-only view of submitted tool work + feedback.
11. **Settings (all portals)** — see section 12.

---

## 11. BUILD ORDER — PHASES (one phase per Claude Code session)

| Phase | Scope | Why this order |
|---|---|---|
| **0** | ✅ DONE 23 Sep 2026 — audit is section 3 | Nothing is built on unknowns. |
| **1** | Engine core: Stage (pan/zoom/layers), versioned state + undo/redo, `ToolHost`, registry of all 118 tools (existing widgets registered as `legacy`, live), theme via CSS vars, keyboard/a11y framework, `hubToolStates` + `hubToolEvents` API, the **Tools tab** (P1 not yet built = "In build" placeholder, P2 = greyed "Coming soon", clicks logged) | Everything else depends on it. |
| **2** | Maths geometry set: M-01 → M-07, M-09, M-10, M-20, M-21; generators M-G01, M-G02, M-G03, M-G09 | Kaz's stated pain point; hardest instruments; proves the engine. |
| **3** | Assess mode end-to-end: `hubToolItems`, `hubToolAttempts`, "Tool question" item type in Quizzes/Homework, checker framework, seeded regeneration, Progress traffic light | Turns tools into the MyMaths-style homework loop. |
| **4** | Live sync: extend the Daily op protocol so a tool's state syncs tutor↔students; X-02 live controls (push tool, freeze, spotlight, curtain); X-01 gaps only (tool dock, PDF export/import) — the whiteboard itself exists | Tutoring is the core product. |
| **5** | MFL core: L-01, L-02, L-03, L-05, L-06, L-07, L-09, L-10, L-16 + TTS cache + three language packs | GCSE 2026 dictation/SSC urgency; high reuse across 3 languages. |
| **6** | English core: E-01 → E-12, E-16 | Annotator engine is reused by History sources. |
| **7** | Maths remainder P1: M-22, M-23, M-40 → M-52, M-55, M-60 (P1 charts), M-61 → M-64, M-80 → M-83, generators M-G04 → M-G12 | Volume of simpler tools once engine proven. |
| **8** | Humanities core: H-H01 → H-H05, H-H09, H-G01 → H-G07, H-G11, H-R01, X-05 → X-07 | Uses annotator, card sort, chart and map engines. |
| **9** | AI + speech: AI rubric checkers, L-08 read-aloud STT, L-13 long translation, budget gates, moderation, logging, retention jobs | Needs cost gates and safeguarding in place first. |
| **10** | Remaining MFL P1: L-04, L-11, L-12, L-13 | |
| **11** | Polish: accessibility audit (axe + manual keyboard pass), performance (tool load < 150 ms after engine cached), phone layouts, print/PDF | |
| **12+** | P2 tools in order of tutor demand (track "Coming soon" clicks per tool — log them from Phase 1) | Data decides P2 order, not guesswork. |

### 11.1 Per-phase Definition of Done (applies to EVERY phase)
1. `*.selftest.ts` (run with `npx tsx`) for every checker, generator and geometry function — generators tested with 1,000 seeds: no crashes, every generated question solvable.
2. Playwright E2E for each new tool: mount, use via mouse, use via keyboard only, save, reload, state restored.
3. Touch test on mobile viewport (iPhone + iPad sizes) in Playwright.
4. No console errors; headless render sweep of every portal page that mounts tools — no blank screens.
5. Tenant isolation test (Playwright, API level): tenant A cannot read or write tenant B's `hubToolStates` / `hubToolMedia`; a parent cannot read another family's child's rows.
6. Theme test: switch tenant theme → tool colours change, nothing hard-coded.
7. Lighthouse/axe accessibility score ≥ 95 on the Tools tab.
8. Dev spec (P1/P2) updated with the exact build-step numbers.
9. Settings updated across ALL portals where relevant.
10. Changelog entry + handover brief `.md` for Amir.
11. Git commit with message `tools: phase N — <summary>`.
12. Wear all 6 hats (Customer/Parent+Student, Company, Staff, Franchise, Freelancer/Tutor, Platform) and list one check per hat in the report.

---

## 12. SETTINGS TO ADD (enumerated)

### 12.1 Platform (HQ) settings
1. Global tool on/off per tool ID (kill switch).
2. AI marking model routing + platform spend cap.
3. TTS provider + voices per language.
4. STT provider.
5. Default recording retention (days).

### 12.2 Tenant (Company) settings
6. Enabled subjects.
7. Enabled tools (per tool ID).
8. Geometry tolerance (mm, degrees).
9. MFL accent strictness default.
10. German noun capitalisation strictness.
11. TTS regional voice per language.
12. Leaderboards on/off (default OFF).
13. AI written feedback on/off; auto-release vs tutor-confirm (default tutor-confirm).
14. Read-aloud STT on/off + monthly minute allowance.
15. Recording retention days (≤ platform max).
16. Annotator highlight categories + colours.
17. Paragraph scaffold (PEE / PETAL / What-How-Why / custom).
18. Significance criteria (history).
19. Calculator allowed by default on homework (yes/no).

### 12.3 Franchise settings
20. Franchises inherit tenant defaults but can override 8–19 (franchise independence rule).

### 12.4 Tutor / Staff / Freelancer settings
21. Default mode when opening a tool in a live lesson (Teach).
22. Personal tool favourites (dock order).
23. Per-item overrides (tolerance, accent strictness, calculator, replays).

### 12.5 Student settings
24. Accessibility panel (X-09) preferences.
25. Accent input shortcuts on/off.

### 12.6 Parent/Customer settings
26. Notification when tool homework is marked.

---

## 13. GIT & SAFETY RULES FOR CLAUDE CODE

1. Git is installed. Base branch = `learning-hub-work-2026-09-23`.
2. Start every phase on a new branch `tools/phase-N` cut from the previous phase's branch; never commit `scratch/` or `*.log`.
3. Commit after every tool that passes its tests, not only at phase end.
4. Never delete existing tools until the replacement passes tests AND Kaz approves in the report.
5. Never change the realtime, auth, or payments code outside what the phase needs; flag it instead.
6. Never install a library without printing its licence in the report.
7. Never hard-code tenant colours, names or content.
8. Never mount tool UI as a direct child of a CSS-grid layout container; use the content area, a view, or `position:fixed` on body.
9. Style by class, never by ID.
10. Staging/dev only — never write to production Firestore; use the `hubdemo-` / `@activityos-test.com` tenants for e2e and clean up in `e2eCleanup`.
11. The dev API's mail is LIVE (real recipients). Never trigger notifications, scheduler sweeps or emails from a test against a real tenant.

---

## 14. PHASE REPORT TEMPLATE (Claude Code must reply in exactly this shape)

```
PHASE N REPORT
1. Built: <every tool ID, one per line>
2. Files created/changed: <every path>
3. Migrations: <every table/column>
4. Libraries added + licences: <each>
5. Tests: unit <pass/total>, E2E <pass/total>, a11y score <n>
6. Tenant isolation test: PASS/FAIL
7. Six hats: Customer / Company / Staff / Franchise / Freelancer / Platform — one check each
8. Settings added: <each, per portal>
9. Dev spec updated: <P1/P2 step numbers>
10. Handover notes added: <summary>
11. Git: branch + commit hashes
12. Known issues / decisions needed from Kaz: <each>
CLOSING SUMMARY (BOLD CAPITALS)
```

---

## 15. DECISIONS KAZ MUST MAKE (before the phase shown)

| # | Decision | Needed before | My recommendation |
|---|---|---|---|
| D1 | Graphing engine: open-source adapter default vs paying for a Desmos production key | Phase 7 | Open-source default; Desmos only if tutors complain. |
| D2 | TTS provider | Phase 5 | Pick on voice quality for DE/FR/ES children's clarity; cache everything. |
| D3 | STT provider + monthly minute allowance per tenant | Phase 9 | Ship with a small bundled allowance; metered above. |
| D4 | Vocab list source (own frequency list vs licensed board list) | Phase 5 | Own list + tenant uploads. |
| D5 | Map tiles provider | Phase 8 | Open tiles with attribution; consider Digimap-style OS licence only if schools demand OS Explorer look. |
| D6 | Public-domain text library contents | Phase 6 | Start with 20 GCSE-relevant pre-1900 texts/poems. |
| D7 | Rewards/gamification (points/avatars like Mathletics) | Phase 12 | Leave OFF by default; add later as tenant option. |

---

## 16. PASTE-READY PROMPTS FOR CLAUDE CODE

**Phase 0**
```
(Phase 0 is done — see section 3. Skip.)
```

**Phase 1**
```
Read docs/LEARNING_TOOLS_PLAN.md. Do PHASE 1 ONLY: build the tool engine per section 4 (4.1–4.5, 4.6 as rewritten in v1.1) and the Tools tab per section 10 item 1, listing every tool ID from sections 5–9 (P1 as placeholders, P2 greyed "Coming soon"). Log clicks on Coming-soon tools. Meet every item in 11.1. Reply with the section 14 template.
```

**Phase 2**
```
Read docs/LEARNING_TOOLS_PLAN.md. Do PHASE 2 ONLY: build M-01, M-02, M-03, M-04, M-05, M-06, M-07, M-09, M-10, M-20, M-21 and generators M-G01, M-G02, M-G03, M-G09 on the Phase 1 engine. Every instrument must be fully usable by keyboard only and by touch (two-finger rotate). Tolerances come from tool_settings. Meet every item in 11.1. Reply with the section 14 template.
```

**Phases 3–12:** same pattern — "Do PHASE N ONLY: build <exact IDs from the section 11 table>. Meet every item in 11.1. Reply with the section 14 template."

---

## 17. TOOL COUNT CHECK

- Maths tools: 49 (M-01–M-12, M-20–M-27, M-40–M-55, M-60–M-65, M-80–M-86) + 14 generators
- English tools: 17 (E-01–E-17)
- MFL tools: 19 (L-01–L-19) × 3 language packs
- Humanities tools: 23 (H-H01–H-H09, H-G01–H-G11, H-R01–H-R03)
- Cross-subject: 10 (X-01–X-10)
- **Total: 118 tools + 14 generator families**, all running on **one engine**.
