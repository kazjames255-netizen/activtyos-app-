# Critic pass: deep games (overnight)

All four republished to the same artifact URLs as version 2. Light fix passes; nothing committed. Playwright at 390x844 and 1280x800, no console errors in any game.

## lantern-cove
Wrong: quiz with a town-builder skin (5 MCQ per mission); no stakes; no in-mission juice; flat rewards; new modes/worlds change format/skin not rules; 12-item pools so repeats come fast; retest identical; padlock overlapped "0 of 8 facts"; first-run toasts stack over dialogs.
Fixed: streak tag and "bonus building"; mission-end streak and flawless bonuses; district label/padlock layout.
Open: real stakes, per-world mechanics, bigger/generated pools, varied retests, toast overlap. Untested: Calm, Junior/Explorer, later modes. Bonus adds material; not rebalanced.

## detective-agency
Wrong: every case is find, fix, reason (quiz with skin); slips cost nothing; guessing free; no cover/streak display; no fail states; 131 fixed cases repeat; toast covers hint bubble on mobile; rank chip omitted bonuses.
Fixed: 3-pip Cover meter (3 slips = 0 rank points); streak chip with +1 every third clean case; 0.9s tap lockout after a wrong tap (not in exam); correct rank totals.
Open: core loop unchanged, no procedural cases, toast overlap, no Junior look exists. Untested: exam mode, replays, cmp/rev/contra kinds, small pools. Lockout may frustrate very young players.

## bridge-builder
Wrong: no stakes; Rush had no pressure; no streak; Cross button hid animals/weight label in Harbour Mouth; tool rack wrapped; worlds 1-4 same core interaction; Worn Planks/Percent Post quiz-like; Hint/Rewind free; Junior/Calm only lightly different.
Fixed: streak HUD and pop-up; shield every 3 clean bridges (max 2); opt-in Storm clock (75s Rush bar, overtime only forfeits gold hard hat); layout fixes for Cross and tool rack; HUD collisions.
Open: soft failure, shared core interaction, quiz-like worlds, no new hats/sounds. Never saw "Gold hard hat" tag or "Overtime" fire; touch input untested; no post-publish replay.

## penguin-slide-deluxe
Wrong: no stakes, runs cannot fail; "Nearly!" banner blocked answer blocks; bosses unlosable; streak/score carry no decision; worlds change question type not action; boredom after ~5 runs; jump is quiz plus button; speed never counts; tiny fish HUD and clipped note on mobile; text-heavy end screen.
Fixed: fish bank (carry, bank every 5 for +20, drop on wrong unless shielded); bosses need 70% accuracy; compact shorter banner below question.
Open: lives (left out deliberately for young kids), jump timing, speed reward, power-ups, fish glyph size, end-screen density. Untested: Junior look, first-run flow, replays.

## Cross-cutting
All four remain essentially quizzes with skins; fixes added streaks/stakes, not new rules per world. Next priorities: per-world rule changes, generated question pools, varied retests.
