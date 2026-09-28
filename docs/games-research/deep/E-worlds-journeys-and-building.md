# E - Worlds, journeys and building: the meta-layer over our games

Author: designer/researcher pass, 2026-09-27. No app code changed. Tags: [Verified] = seen in a fetched search result this session; [Unverified] = plausible/from memory, check before relying on it. Builds on A (feel), B (theme; recommends Lantern Cove), C (learning science), D (tutors/parents/market), and 03-concepts.md.

Owner feedback: "ok, but more like Roblox: themes, journeys, building cities." Diagnosis: the 10 prototypes are *verbs* (slide, bond, detect). Roblox/Animal Crossing/Prodigy retain because there is a *noun* the child owns and grows (a town, a base, a pet) and a *path* (what next). This doc designs that noun and path, while keeping every learning event server-marked and mastery-driven.

## 0. Evidence digest (22 searches) and what we take from each

| Reference | Finding | Take-away for us |
|---|---|---|
| Roblox obbies/tycoons | Short core loop (<5 min), visible progression hook; first-5-minute decision; obby difficulty as staircase with plateaus, not a ramp; do action, get reward, spend, repeat. [Verified] https://rolearn.dev/guidance/first-week-retention-optimization/ , https://kitsblox.com/blog/how-to-make-roblox-obby , https://game-ace.com/blog/roblox-game-ideas-that-actually-work/ | First build placed in <30 s; mission = 3-6 min; difficulty staircase = our mastery bands. |
| Roblox 2026 safety | Facial age checks required for chat from Jan 2026; under-9 in-experience chat off by default; chat outside experiences restricted <13; 5-8/9-12 groups lose email/phone data. [Verified] https://about.roblox.com/newsroom/2026/01/roblox-age-checks-required-to-chat | Even Roblox is walling children off from chat. We ship with no chat at all. |
| Adopt Me / Bloxburg | Pet trading creates scams targeting young players; rare pets worth real money. [Verified] https://screenwiseapp.com/guides/adopt-me-and-roleplay-games-on-roblox , https://adoptme.fandom.com/wiki/Scams | No trading, no gifting between children, ever. Collectibles are earned and non-transferable. |
| Minecraft Education | Prebuilt curriculum worlds + Camera/Portfolio evidence for teachers. [Verified] https://www.monash.edu/education/research/projects/building-an-evidence-base-for-using-minecraft-education-edition-as-an-educational-tool ; https://simonbaddeley64.wordpress.com/2019/04/11/how-do-i-know-what-they-learned-in-minecraft-education-edition/ | "Photo of my town" = portfolio + parent wow. Build goals tied to lessons. |
| Animal Crossing | Real-time clock, seasons, small daily tasks, predictable routine produce calm engagement. [Verified] https://www.eteogames.com/rhythms-of-the-everyday-in-animal-crossing/ | Dusk/day atmosphere and seasons are cheap, cosy retention. |
| Stardew | Community Centre bundles: donate items across rooms, each room unlocks town-wide benefit; seasonal items push variety. [Verified] https://stardewvalleywiki.com/Bundles | Our "restore the Counting House" = bundles of mastered topics. Ideal co-op class milestone. |
| Tiny Tower / Township | Build timers and IAP pacing; you close the app and return on alert. [Verified, thin] https://www.commonsensemedia.org/app-reviews/tiny-tower | Copy the "come back to see it grown" feeling via spaced-review, NOT paid timer skips. |
| Prodigy | Freemium upsell criticised as manipulative; rewards gated behind membership; story rewritten/removed. [Verified] https://www.nbcnews.com/tech/tech-news/child-protection-nonprofit-alleges-manipulative-upselling-math-game-prodigy-n1258294 , https://fairplayforkids.org/pf/prodigy/ | Copy its world-as-motivator; never gate cosmetics/quests on payment; never delete what a child built. |
| Toca Boca / Sago Mini | Open-ended, no fail state, no time pressure. [Verified] https://sagomini.com/world/ | Building/decorating is free-play and never punished. Y R-2 skin follows this. |
| Khan Academy Kids | Cast (Kodi bear, Ollo elephant, Reya red panda), collect hats/toys, adaptive path, no ads, no social contact. [Verified] https://blog.khanacademy.org/best-early-learning-apps-for-kids/ | Our cast overlaps (bear, elephant, red panda): keep silhouettes/names distinct. Closed environment is the trust model. |
| Teach Your Monster | Map journey over three games, characters met en route, academic-backed. [Verified] https://usborne.com/us/about-us/teach-your-monster-to-read/ | Map + character-per-stage is a proven under-8 UK structure. |
| Duolingo | Streaks drive return; leniency/"earn back" raised long-term engagement; all-or-nothing streaks cause anxiety. [Verified] https://yukaichou.com/gamification-study/master-the-art-of-streak-design-for-short-term-engagement-and-long-term-success/ , https://screenwiseapp.com/guides/duolingo-streaks-and-anxiety-in-kids | Weekly rhythm goal, banked rest days, no loss framing. |
| Kahoot | Team mode, Team Talk pause before answering, whole-class co-op modes. [Verified] https://kahoot.com/blog/2021/09/22/kahoots-new-team-mode/ | Class quests: shared target, team averages, discussion beat. |
| Wonderville | 220 games organised by curriculum outcome + teacher dashboard. [Verified] https://wonderville.org/teachers | Tutor assign/insight must be first-class, not an afterthought. |
| Intrinsic integration | Zombie Division: learned more and chose to play 7x longer when maths IS the mechanic. [Verified] https://shura.shu.ac.uk/3556/1/Habgood_Ainsworth_final.pdf | Rule 1: the world must never be a wrapper around unrelated maths. Building = consequence of mastery, minigames = the maths. |
| Gamification meta-analysis | g=0.49 cognitive, 0.36 motivational, 0.25 behavioural; game fiction and collaboration+competition moderate behavioural outcomes; motivational/behavioural effects less stable. [Verified] https://link.springer.com/article/10.1007/s10648-019-09498-w | Fiction/narrative is worth doing; don't oversell effect sizes. |
| Overjustification | Harm mostly when expected tangible reward is tied to an already-enjoyed task; free-choice tests show it; effects vary. [Verified] https://journals.sagepub.com/doi/10.3102/00346543064003363 | Reward *unexpectedly and informationally* (mastery lights a lantern), never "do 10 questions get 10 coins" bribes on tasks kids already like (building, free play). |
| DGBL meta-analysis | Medium effect on cognitive outcomes, small on motivational. [Verified] https://journals.sagepub.com/doi/abs/10.3102/00346543231167795 | Sell it on learning outcomes to tutors/parents, not "addictive fun". |
| ICO Children's Code | Std 5 detrimental use / Std 13 nudge: no countdown/one-time offers, no pressure purchases, positive nudges to breaks and natural stop points. [Verified] https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/13-nudge-techniques/ | Hard rules in section 3. Stopping points are a legal-grade feature. |
| Loot boxes UK | Not legally gambling in UK as of mid-2026; ASA enforces disclosure; strong association with problem gambling. [Verified] https://blog.promise.legal/lootbox-regulation-2026-game-studios/ | Legal but unethical for kids; we ban random paid rewards outright. |
| Online Safety Act scope | Services with only likes/emoji reactions on provider content are exempt from U2U; substantive user-to-user replies or sharing content are in scope. [Verified] https://www.bristows.com/expertise/sectors/technology/onlinesafety/scope-of-act/ | Preset emotes + tutor-authored content only keeps us outside U2U-heavy duties. Get legal confirmation ([Unverified] as applied to our exact features). |

## 1. THE WORLD MODEL

**One persistent world per child: "Lantern Cove"** (default theme, see section 5). Not a new game: a *view over data we already hold* (hubMastery per topic, game sessions, flashcard due dates).

Structure:
- **Districts = subjects** (from B): Counting House and Rink (maths; Penguin Slide/Bond Igloos live here), Bookshop Boat (English), Tidepool Lab (science), Museum of Finds (history), Chart Room (geography), Bandstand (languages), Workshop (computing/DT), Lighthouse (hub, weekly goal lantern), Study Hall (Y10-13).
- **Buildings = topic clusters.** A building has N windows/lanterns = topics in a curriculum strand (data: topicId lists we already have in the 23 packs). Lantern brightness = mastery band (unlit / flicker / lit / glowing). **Mastery is the only thing that builds.** A building you never played is a scaffold outline, so a child sees the *whole* curriculum as a town to fill in (Stardew bundle logic).
- **Props = evidence of specific wins.** Mastering "7 times table" places a 7-crate stack in the market; first perfect run puts a plaque. Props are deterministic (topicId to prop), so parents can read the town like a report.
- **Residents from our cast** run districts: penguin harbour keeper (mascot, guide), fox (Bookshop), otter (Tidepool), hedgehog (Workshop), red panda (Bandstand), bunny (Museum), bear cub (Counting House), elephant (Chart Room, "never forgets"), cloud (weather/Lighthouse). Residents give 1-line quests and react to mastery ("Fox found your new book!"). Flag: bear/elephant/red panda overlap Khan Academy Kids characters, so give ours distinct silhouettes, names and outfits.
- **Seasons/festivals (inclusive):** neutral defaults (Lantern Night, Harvest Day, Midwinter Glow, Spring Bloom); opt-in real festivals (Diwali, Eid, Christmas, Hanukkah, Vaisakhi, Lunar New Year) as cosmetic decor packs chosen by parent or tutor, never marketing pushes. Seasons are calendar-driven skins, no FOMO: every festival item stays obtainable at the next cycle or via a permanent "festival trunk" the child can earn any time.
- **Day/dusk atmosphere:** sky tint by the device local time (Animal Crossing rhythm). After 19:30 (parent-configurable), the cove "goes to bed": lanterns dim, resident says goodnight, the games gently end. This doubles as the ICO natural-break feature.

**Per-age skins (one world, one data model):**
| Band | Skin | Verbs | Notes |
|---|---|---|---|
| R-Y2 | Tactile sticker-town: big tap targets, drag stickers onto a scene; buildings are cottages; voice-over; no reading needed | place sticker, feed a resident, tap to light | No fail states, no timers, no currency shown as numbers (sticker count only). |
| Y3-Y6 | Harbour town builder: full map, districts, cottage decorating, Glimmer collection | build, decorate, collect, quests | The flagship. Tycoon-lite: buildings "grow" with mastery, no idle timers. |
| Y7-Y9 | "Explorer" base/campus: muted journal palette, stats page (mastery radar, accuracy, time), base upgrades named as rooms | unlock rooms, expeditions, personal best | Autonomy + competence framing; avoid babyish cast (residents become "field notes"). |
| Y10-13 | "Study campus" progress map: a single-screen map of specification blocks lit by mastery, lantern = quiet timer, cosmetic profile only | plan, log, gate check | Minimal, adult-feel; no collectibles push. Exam-technique gates prominent. |
The band is a *theme token set + component set*, chosen by the child's year, overridable by parent/tutor.

## 2. JOURNEYS

**Map structure:** a path per subject (Duolingo/TYM style) laid over the district. Nodes are *missions*; the path is generated server-side from curriculum order + the child's mastery, so it adapts (Khan Kids pattern). Child can always free-roam districts (Toca-style) — path is a recommendation.

**Mission types:**
1. **Fluency sprint** = an existing game, 3-5 min. Yields: mastery slice at reduced weight, lantern progress, prop chance (deterministic).
2. **Story quest** (resident dialogue + 3-5 varied items, ~8 min): narrative wrapper using bank questions; yields chapter progress.
3. **Boss/exam-technique gate**: mixed-topic, untimed for R-Y6, exam-conditions optional Y7+; passes (>= threshold across topics) open the next district ring. Failing yields a *targeted return route*, never lock-out.
4. **Cooperative class quest**: tutor launches a "Harbour Repair"; class bundles (Stardew) fill a shared meter using each child's own-level questions (so weak and strong contribute equally).
5. **Return visit** (spaced review): a building "gets dusty" after SM-2 due dates lapse (hubFlashcardReviews nextDueAt / stale mastery); a 2-minute "polish" mission restores it. This is the Tiny-Tower-return hook made pedagogical (spacing per C).

**The 10 games as missions**
| Game | Plugs in as | Yields |
|---|---|---|
| Penguin Slide | Harbour ramp sprint (Counting House); one sprint per times table | Table lantern; market props |
| Bond Igloos | Igloo row build: each solved bond adds a brick | Igloo block on Rink; bond-facts mastery |
| Sound Snowdrift | Bookshop Boat "sound cargo" | Phonics stickers; word-family shelf items |
| Iceberg Detective | Exam-gate mini-case in the Museum/Chart Room | "Detective" badge, error-spotting mastery |
| Circuit Rescue | Workshop/Lab power-restore quest | Powers a building (lights on) |
| Deep Freeze | THE return-visit engine (flashcards/SM-2) | Restores dusty buildings |
| Fraction Bridge | Bridge-repair between districts | Physical bridge unlock (path gating) |
| Timeline Tumble | Museum of Finds chronology room | Timeline wall in museum |
| Word Class Sprint | Bookshop grammar sprint | Grammar shelf items |
| 10th prototype (see landing page) | Slot into Bandstand/Workshop by subject | per design |
All of them submit through the single session contract in 03-concepts.md section 0 (server marks, `assessmentType:"game"`, reduced weight, speed never in mastery).

**Unlock rules (mastery, not grind):** a district ring opens when >=60% of its prerequisite topics reach "secure" in hubMastery (bank + game evidence, game weight 0.5) OR the tutor unlocks it. Buildings light at 3 confidence levels. Nothing unlocks from time spent or money.

**Session rhythm:** 8-12 minutes = arrive (resident greets, "today's 3"), 1 sprint + 1 story/bank mission + place/decorate reward, then a **natural stopping point**: the lantern lights, the resident says "That's tonight's glow, come back tomorrow", a calm town animation plays. Continue-play remains possible but with no extra rewards after the goal (prevents grind; ICO break nudge). Y7+ sees a session summary instead.

**Weekly rhythm goal (no streak guilt):** the Lighthouse holds a weekly lantern with tutor/parent-set target (e.g. 3 of 7 days, or N minutes). Missing days never drains anything; unused days bank as "rest tokens" visibly, the goal reads "2 of 3 lit". No loss language, no "streak broken" animation. (Duolingo's own data: leniency helped long-term engagement. [Verified] see table.)

## 3. ECONOMY

**Currencies (earned only, never bought):**
- **Lumens** (soft): earned on mastery gains and mission completion (not per question; informational, avoids overjustification). Capped daily (e.g. 60), so 20 minutes and 60 minutes earn similar.
- **Glimmers** (collectibles): tiny lantern-creatures; each tied to a specific topic mastery (deterministic; child sees "master Fractions of amounts to find Fen the Frog-Glimmer"). No random draws.
- **Stickers/props**: from topics, deterministic.
No premium currency. No real-money purchase inside the child surface at all; subscription lives in the parent/tutor area.

**Sinks:** decorating slots, resident outfits, cottage rooms, festival trunk items, "town projects" (shared class cost). Lumens are spent on *cosmetics and self-expression only*; nothing that affects learning/marks.
**Anti-inflation:** daily cap; costs scale by tier; a "repaint and re-arrange" is free and unlimited (creativity has no cost); permanent collection never expires so there is nothing to farm out of anxiety.

**Explicit anti-dark-pattern rules (ship as an internal checklist and test in e2e):**
1. No streak-loss, no countdown offers, no expiring items (ICO 13 [Verified] above).
2. No loot boxes/random paid or unpaid rewards; collectibles deterministic.
3. No paid speed-ups, no timers gating progress; return visits are optional.
4. No pay-to-progress; nothing in the child world is premium-gated (Prodigy anti-pattern).
5. No trading/gifting/marketplace between children (Adopt Me scam vector).
6. No guilt copy ("Pip is sad you left"); residents may be *glad*, never *hurt*.
7. Never delete or rewrite what a child built (Prodigy complaint).
8. Notifications go to parents/tutors by default, none to under-13s. 
9. Cosmetic-only spend; marks/mastery are never for sale or influenced.
10. Session end shown and honoured; default bedtime wind-down.
11. Leaderboards: none against strangers; only self-best and class *cooperative* meters.

**Tutor levers:** "Assign a quest" (pick topics, pick mission type, due date, optional custom message in the resident's voice, reward = a named prop/Glimmer chosen by tutor), set the weekly goal, unlock/lock districts, hosted co-op quests. **Class city view:** all children's coves as tiles with mastery heat + stale (dusty) flags; drill into a child's town = their topic map. **Parent weekly view:** one screen, "This week: 3 lanterns lit, new Glimmer: Fen, ready to revise: 2 dusty buildings" + a share-able town screenshot. This is the retention story for paying adults (D).

## 4. SOCIAL (no chat, moderation-free by design)

No free text or drawn/UGC between children. All social is preset, from pre-approved libraries.
- **Visit a friend's cove (parent/tutor-approved link list):** read-only tour; leave a *preset emote* ("Wow!", "Love the lanterns", "Thanks"). Emote-only and provider-content-only sits within the OSA "likes/emoji on provider content" exemption reading [Verified via Bristows; confirm with counsel for our precise design, [Unverified]].
- **Class Town Square:** tutor-hosted shared plaza showing the class co-op meter and a "wall of wins" auto-generated from mastery (first names/avatars only, tutor-controlled).
- **Co-op milestones:** Harbour Repair / Community Centre bundles; class average drives it; nobody is named as slowing it.
- **Tutor-hosted live:** existing live rooms host missions; kids answer in own-level items; Team Talk pause per Kahoot.
- Names: avatar + first-name-or-alias chosen from a list; no photos.
Data-protection posture: high-privacy defaults; profiling for mastery only (ICO std 5; opt-in for anything else).

## 5. THEME OPTIONS

**A. Lantern Cove (recommended).** Refinements: keep penguin-on-ice cues (slide ramps, snowy roofs, aurora night sky); lantern = universal mastery symbol (lit = learned; dusty = needs polishing); Glimmers as the field guide (each with a real fact); cottage as the personal space; the Lighthouse = weekly goal; Y7-9 becomes the "Harbour Log", Y10-13 the "Study Hall". Why: most cross-age, calm, ownable, natural fit with penguin and current prototypes, low art-cost per district (reusable kit). Risk: Aurora/penguin similarity to Club Penguin; keep lantern/harbour identity.

**B. Aurora Station / space station "Orbit".** Modules = subjects, crew = cast in spacesuits, build out the station, spacewalk = sprint missions. Pros: strong Y7-13 "Explorer" feel; boys 8-13 skew; science tie-in. Cons: colder, less cosy for R-Y2; overlap with existing space games.

**C. Jungle Research Base "Canopy Lab".** Rangers/field station, survey species, restore habitats (mastery = habitat health), fits geography/science/sustainability (UK curriculum), inclusive and non-violent. Pros: collectible species double as real-fact learning; great Y3-Y9. Cons: heavier art; risk of "cute animals in a jungle" cliche; conservation guilt if habitat "dies" (must never show decay).

Recommendation: Lantern Cove as the skin, keep the world-model theme-agnostic (a token set of names/art), so Canopy/Orbit can later be offered as a parent-chosen "world" for Y7-9 who reject the cosy look. Test with 6-8 children per band before commissioning art (B's plan).

## 6. DATA & ARCHITECTURE

Principle: **the world is derived state; the truth is mastery + sessions.** Server-authoritative economy.

Firestore sketch (all with tenantId/franchiseId/childId as in existing docs):
- `hubWorlds/{childId}`: `{themeId, band, cottage:{layout[]}, placed[{propId,slot}], unlockedDistricts[], glimmers[], lumens, lumensToday:{date,n}, weeklyGoal:{target,doneDays[],restBanked}, festivalPacks[], version}`
- `hubWorldEvents/{id}`: append-only ledger `{childId, type:"earn"|"spend"|"unlock"|"place", source:{sessionId|attemptId|tutorGrant}, delta, at}` (audit + rebuild + anti-cheat).
- `hubQuests/{id}`: tutor-assigned `{childId|classId, topicIds[], missionType, dueAt, rewardPropId, status}`.
- `hubMissionCatalog` (static in code/JSON, not Firestore): mission defs: gameId, topic filters, yields.
- Existing: `hubAttempts` (game rows at 0.5 weight), `hubMastery`, `hubFlashcardReviews`, `hubGameSessions` (from 03).

Flow: child plays game to `POST /games/session` to server-generated items to `.../submit` to server marks, writes hubAttempts, recomputes mastery, then a **world reducer** (pure function `applyMastery(worldState, masteryDelta)`) produces rewards (Lumens capped, props by topic map, Glimmers by rule), writes ledger + world doc in one transaction. Client only renders and sends placement intents; server validates ownership/slots/cost. Kids cannot mint currency because no endpoint accepts a client-stated amount. Idempotency key = sessionId. Rate limit per child.

Reads: the world view is cheap (1 doc + mastery doc), realtime via existing `useRealtime(["hubWorlds","hubMastery"])`. Tutor class view: batched query on tenant/class.

Performance budget: first interactive < 2 s on a 2019 school tablet / mid Chromebook; initial JS for world shell < 150 KB gz; art as SVG/sprite atlases; **district chunks loaded on demand** (dynamic import per district + its atlas, < 250 KB each); no WebGL required for R-Y6 (SVG/CSS + Canvas2D); a 60 fps target for scenes limited to ~150 animated nodes; games remain separate lazy bundles (as prototypes). Respect prefers-reduced-motion; offline-tolerant placement queue is *not* needed (server-authoritative).

Data-protection: DPIA update; no new personal data beyond alias/avatar; parent controls for visiting/emotes/festival packs; data export/delete includes world.

## 7. BUILD PLAN

| Phase | Scope | Effort | Key risk |
|---|---|---|---|
| 0 (1-2 wk) | Playtest paper/Figma of Lantern Cove with 6-8 children (R-Y2, Y3-6, Y7-9) + 3 tutors; decide theme | S | Art direction cost |
| 1 (3-4 wk) | **Cove v0**: world doc, Counting House only, mastery-lit lanterns from hubMastery, Penguin Slide + Bond Igloos as missions, server reducer, ledger, weekly lantern; Y3-6 skin | M | Server session contract must exist first |
| 2 (4 wk) | All districts (static art kit), props, Glimmers field guide, decorate cottage, return visits from SM-2, dusk mode, 5 more games plugged | M-L | Content mapping topic to prop (curriculum team) |
| 3 (3 wk) | Tutor: assign quest, weekly goal, class city view, parent weekly view + shareable screenshot | M | Tutor UX adoption |
| 4 (3 wk) | R-Y2 sticker skin + voice; Y7-9 Explorer; Y10-13 Study campus | M | Three UIs = maintenance |
| 5 (3 wk) | Social-lite: visit + preset emotes, class square, co-op quests; legal review | M | OSA/ICO interpretation |
| 6 | Festivals/opt-in packs; alt world theme; A/B on retention/learning | S-M | Inclusivity governance |
Total to a compelling Y3-6 slice: ~7 weeks after phase 0. Critical dependency: `hubGameSessions` + server marking from 03-concepts.

**Top risks:** (1) extrinsic layer crowding out learning (mitigate: intrinsic integration, mastery-only building, measure accuracy and delayed retest not just minutes); (2) art scope; (3) three age skins; (4) tutor adoption; (5) the economy quietly turning into a grind; (6) accessibility (colour-blind lantern states need shape + label).

**10 decisions for Kaz**
1. Lantern Cove as the primary world (vs Orbit/Canopy)? 
2. Y3-6 flagship first, or start R-Y2 sticker-town?
3. Do we allow *any* child-to-child visiting in v1, or launch social after tutor features?
4. Currency count: Lumens + Glimmers only (recommended)?
5. Daily Lumens cap and bedtime wind-down defaults (proposal 60/day, 19:30)?
6. Streak model: weekly goal with banked rest days (recommended) vs no rhythm feature at all?
7. Festivals: neutral-only default with opt-in real festivals (recommended)?
8. Tutor-granted rewards allowed (custom prop for a quest)? Any monetary cost to tutors?
9. Subscription placement: parent/tutor area only, nothing premium-gated inside the world (recommended)?
10. Commission an illustrator/animator now, or prototype with the existing SVG cast?

## 8. Roblox: differences and later connection

Differences: Roblox is an open UGC platform with chat, trading, creator economy (their scam/safety burden, now with mandatory age checks for chat [Verified]). We are a closed, curriculum-first, tutor-supervised world; the learning record is the product. Later connection options (all [Unverified] as of 2026, verify current Roblox Terms/API before planning): (a) a branded Roblox *experience* as an acquisition/fun front door (obby-style "Cove Sprint" with maths gates) that carries no personal data and links out to the Hub by code; (b) Roblox OpenCloud/DataStores cannot safely receive child learning data (data minimisation, Roblox's own child data restrictions [Unverified]); (c) any link-out from Roblox to external sites is restricted for young users (link/URL policies [Unverified]); (d) Roblox chat exposure makes it unsuitable for tutor-supervised children without careful configuration. Recommendation: do not build on Roblox first; if pursued, make it a marketing satellite with zero data flow, cosmetic mirror of Cove items being an optional later step, and PEGI/Roblox age-rating compliance reviewed by counsel.

## 9. "WOW" shortlist (what a child shows their parent)

1. "Look, my times-tables lit up the whole market street" — the town map glowing at dusk.
2. Photo mode: postcard of my cottage/town (shareable to parent, no public feed).
3. New Glimmer with its real-fact card ("Fen lives in 7 ponds").
4. The bridge I repaired actually opens the next island (Fraction Bridge).
5. The dusty museum I polished in 2 minutes, and it sparkled.
6. My name on the class Harbour Repair board when we finished together.
7. Tutor's personal quest arrives with the tutor's voice line from the penguin.
8. Year-end "town growth" time-lapse (Jan empty to July glowing).
9. Y7-9: my stat radar grew in Chemistry; Y10-13: the spec map went from grey to green.
10. Seasonal decorations, chosen by the family, appearing on the cove.

## Top-10 recommendations
1. Make the world a *view of mastery* (buildings/lanterns), never a currency-for-questions loop.
2. Adopt Lantern Cove with theme-agnostic data model; other worlds later.
3. Ship the Y3-6 Counting House slice first, with Penguin Slide + Bond Igloos + Deep Freeze as missions.
4. Use Deep Freeze/SM-2 as the "dusty building" return visit.
5. Server-authoritative reducer + append-only ledger; no client-stated currency.
6. Earned-only Lumens with daily cap; deterministic Glimmers; no trading, no loot, no timers.
7. Weekly goal lantern with banked rest days; visible natural stopping point and bedtime wind-down.
8. Tutor "assign a quest" + class city view + parent weekly card as the paid value story.
9. Social = visit + preset emotes + class co-op meters only; get legal sign-off on OSA scope.
10. Playtest with children first and measure delayed retest accuracy, not just minutes played.
