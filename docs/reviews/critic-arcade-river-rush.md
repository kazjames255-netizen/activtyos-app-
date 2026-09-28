# Critic review: River Rush (arcade build, preview.html)

Method: real mouse, touch (CDP) and keyboard at 375x812 and 1280x800. About 8 sessions: bad run to Game Over (2 cards in), a decent run into level 2 (before/after), a boss fight with Mo (lost it), the cause-and-consequence level (wIdx=1, lv=3 hack), a desktop keyboard run, shop, settings, daily, Journey title. Screenshots in scratchpad/ar/critic-tt/. No console errors or warnings in any run.

## Verdict

Not yet a YouTube-beater, but close to a good 3-minute snack. The feel is right: big readable cards, a hand-pointer tutorial, a satisfying combo counter, a cute Mo and penguin, and an honest post-mortem screen. The weakness is the core question itself. A 9-year-old sees "Flag Fen timber causeway" with no date, no picture and no clue, and must pick one of four eras. That is recall of obscure facts, not a skill that improves in play. Kids who know nothing lose 3 hearts in about 6 seconds and see a wall of text. Kids who already know Ancient Britain steamroll (my bot hit x5 and 23 in a row in 20 seconds). Fairness and ramp need work before it holds a bored kid for 10 minutes. Estimated: 5 minutes of interest for a kid who does history at school, under a minute for one who doesn't.

## What works

- Tutorial: first card is slow, a pointing hand plus "Drag the card to the right era!" appears at once, and the first card is forgiving. Touch drag worked 18/18 on the first attempt, and keys 1-4 also work on desktop.
- Clear main screen: score, combo (x1 to x5, "23 IN A ROW"), 3 hearts, progress bar. The text is big (card titles ~20px equivalent, dock names bolder still).
- Era docks carry date ranges, so a kid can reason from a date when the card gives one (before/after and boss cards do).
- Juice: score pop-ups, confetti, "UNSTOPPABLE / ON FIRE" banners, shield power-up, the boss rising from the river with eyebrows and tusks, a boss HP bar.
- The missed-item review explains why ("You chose Stone Age. Stone Age is to 2500 BC. ... was in AD 43, which is after that") and adds a fun fact. Good pedagogy.
- Guardrails hold: no green theme, no "Oak", no chat, shop says "Nothing is random". Calm mode and read-aloud exist.

## Top flaws (ranked)

1. **Cards carry no scaffold, so it is guessing.** "Flag Fen timber causeway", "Star Carr lakeside camp", "Must Farm stilt houses", "Vindolanda letters" mean nothing to a 9-year-old, and the card shows no date or clue. Fix: show a picture/icon and a one-line hint chip ("a wooden road across a marsh") on the first 2 cards of each level and after any miss of that event; or add a 3-second "hint" power-up that tints the correct dock. Weight world 1 events toward well-known ones (pyramids-adjacent, Stonehenge, Romans, Boudicca, Hadrian) and put the obscure ones in later levels.
2. **Game Over arrives in seconds for a novice.** My "bad" run ended after 3 cards / 5.7s of game time with 0 points. There is no ramp of mercy: heart loss on misses while cards are 4-way guessed means 3 wrong answers in a row ends the run. Fix: level 1 with only 2 docks (Before/After the Romans, or Stone vs Bronze), then grow to 4 docks; or give a free retry of the first miss ("Oops! Try again" with no life lost for the first miss of each run).
3. **Game Over screen buries the lesson in a text wall and the Menu/Shop buttons fall off-screen.** On 375x812 the Menu and Shop buttons sit at y 611-659 while the canvas ends at 625, so they are clipped (screenshot j_over.png). Result text ("1 of 4 right (25%). Best combo x1 (1 in a row)") is drawn over the dock labels and collides with them. Fix: shrink the review card or make it scroll, keep PLAY AGAIN and Menu/Shop pinned inside the canvas, dim the docks behind the overlay more.
4. **Misleading celebration on failure.** A run scoring 18 points, 1 of 4 right and 0 stars shows "NEW BEST!" and confetti. Fine for a first run, but it feels fake. Fix: suppress confetti/NEW BEST under about 5 correct answers or without at least 1 star; show "Good start!" instead.
5. **Review shows one missed item at a time (or the first), with long paragraphs (~45 words).** A 9-year-old will not read "Soldiers from many parts of the empire served there." Fix: one short line for why plus one emoji fact, and a "see all" strip of all misses as small date chips on a timeline.
6. **Boss fight is a re-skinned normal level.** Mo appears (nicely), but cards land on top of his face and the fight has no boss reaction to hits, no telegraphed attack, and no reward beat after it. It also needs no new skill. Fix: Mo should wobble/roar on a correct answer and stomp a dock (temporarily disabling it) on a miss; show a "BOSS!" banner with music sting on entry; keep the HP bar visible below the top edge.
7. **Cause-and-consequence level is too easy and mechanically odd.** Cards are just the titles of other events, e.g. cause "Alfred beats the Danes AD 878" with the choices "Athelstan rules all England", "Iceland's Althing begins", "Cnut becomes King of England". The right answer can be found by date alone, not by understanding cause. The intended `reason` text appears only after the run. Cards also overlap in the river (a second card was hidden under "Luther's 95 Theses" in e_cc3.png). Fix: show the reason sentences as the choices and use sensible same-era distractors. Separate cards so they never stack.
8. **Desktop layout is a phone column inside a huge window.** At 1280x800 the game is 432px wide with two small text columns; on phone the canvas is 625px of an 812px viewport, leaving about 190px of dead navy below. Fix: scale the canvas to fill the viewport height on phones and make the desktop stage larger.
9. **UI polish issues.** "Endless (beat World 1)" is dim low-contrast grey (looks disabled and is hard to read). The Shop is longer than the canvas, so "Done" is off-screen until you scroll, and every item shows "Need N more" with 0 coins; coin income is about 1 coin per 18 points and 20 coins for a 514-point run, so the cheapest item (40) costs about 2 decent runs and the top (200) about 10. "SHIELD Absorbs one mistake" text blankets the docks for a moment. "23 IN A ROW" sits on the progress bar and touches it while at x5. Pause shows an empty navy screen instead of the frozen game (good for cheating prevention, but reads like a crash for a kid).
10. **Two brands, two games.** Journey is titled "Timeline Tumble" with ropes/ladders/arrows and a different UI; it is the "second mode" but feels like a different app, and text is dense (12+ line intro paragraph). The first Journey stage is even titled "Stones and Iron, Stone age" (Iron is not the Stone Age). Fix: rename or share the "River Rush" header and shorten the intros.

## Content accuracy issues

Dock assignments and dates I believe are wrong, misleading or arguable:

- **"WWI era" is the dock for 1901-1919.** That includes the Wright brothers 1903, Suffragettes founded 1903, and the Titanic 1912, none of which are WWI. Rename to "Edwardians / Early 1900s" (or "1901-1919") or drop the WWI label.
- **"Since 1945" starts at 1946**; VE Day 1945 and Auschwitz liberated 1945 belong in the "World War Two" dock (1939-1946), so a child who reads "Since 1945" literally and drops VE Day there is marked wrong. Rename the dock "After the war (1946+)" or make it 1945.
- **Viking Age dock 793-1066 holds Athelstan (927)**, Alfred (878) and Lady of the Mercians (918); these are Anglo-Saxon English kings in every KS2 scheme. The Anglo-Saxon dock ends in 793, so "Athelstan rules all England" cannot be filed under Anglo-Saxons. Use overlapping labels (Anglo-Saxons 410-1066, Vikings 793-1066) or drop the Alfred/Athelstan cards from the dock game and keep them in cause-and-consequence.
- **House of Wisdom in Baghdad (c. 830)** is filed in the "Viking Age" dock: right date, but a kid will not connect Baghdad with Vikings. Same for Mansa Musa (Middle Ages, fine), Ewuare, Gutenberg: the dock names are British, so world events feel arbitrary.
- **Cromwell becomes Lord Protector (1653) in Stuarts.** Arguable: the Interregnum was not Stuart rule. Also "Iron tools spread, c. 800 BC" is right at the Bronze/Iron boundary (whitelisted, but fair-game for arguments), as are Bosworth 1485 (Middle Ages/Tudors) and Lindisfarne 793.
- **Pompeii (AD 79) vs Colosseum opens (AD 80)** in Before/After: one year apart; it is a trivia trap, not history, and the Colosseum opening dates are usually given as AD 80 while construction began AD 70-72. Also Bosworth 1485 vs Columbus 1492 and Globe 1599 vs Gunpowder 1605 are only 6-7 years apart.
- **Watt (1769) causes Stockton and Darlington Railway (1825)** is arguable; the railway used Stephenson-style high-pressure locomotives, and Watt famously resisted high-pressure steam. Say "steam power" generally.
- **"Magna Carta caused Simon de Montfort's Parliament"** is a big compression (50 years, several kings). Plausible but not a direct cause.
- **"Windrush: Britain needed workers and invited them"** is the intended answer, but the distractor "The ship carried soldiers coming home" is partly true (many passengers were ex-servicemen). Fix the distractor.
- **Arguable simplification: Hadrian's Wall begun AD 122** is fine, but the explanation says "A stone wall marks the northern edge of the empire", which is actually the northern edge of Roman Britain at that time; fine for KS2.

Implausible or silly cause-consequence distractors (too obvious, so they teach nothing, and some are jokes that break trust):

- "Queen Victoria asked for women to vote" (Victoria died in 1901, before the WSPU existed)
- "The King read one book and ended it alone" (Equiano / slave trade)
- "Equiano was made a member of Parliament"
- "Steam engines could not be made any bigger" (Watt to trains)
- "Jarrow's shipyard was bombed in the Blitz" (the march was 1936, before the Blitz)
- "Athelstan conquered Scotland before Wessex"
- "Doctors had always been free before that" and "Wartime rationing was simply renamed the NHS"
- "Simon de Montfort was King John's own son"
- "Martin Luther King wrote the law himself"
- "Rome ordered the Angles to settle here" and "A plague had left Britain almost empty for years" (invented history; the Plague of Justinian claim is disputed)
- "Charles I had named Cromwell his heir"

## Bugs

1. **Game Over Menu/Shop buttons clipped at phone size** (rect top 611-659 vs canvas bottom 625, j_over.png). Blocking: the kid cannot reach the shop from the result screen without playing again.
2. Game Over overlay text is drawn over the dock labels behind it ("1 of 4 right ..." overlaps "to 2500 BC" and "800 BC to AD 43"), hurting legibility.
3. "NEW BEST!" and confetti show on a 0-star, 25% run.
4. Cause-consequence cards overlap in the river and hide each other's text (e_cc3.png).
5. Boss intro: the mammoth head is cropped by the HUD at the top, and cards drift over its face; boss bar text "MO THE MAMMOTH 100%" sits directly on the HUD progress bar.
6. Combo caption "23 IN A ROW" overlaps the progress bar at x5 in the before/after level (c_l1.png).
7. Shop "Done" is off-screen on 812px height; the canvas letterbox wastes about 190px at the bottom on phones.
8. Grammar in the review: "Stone Age is to 2500 BC", "+1 coins".
9. Hack-only note: setting a.world=3 without wIdx gave only 4 docks in a 5-dock world; not a player-facing bug, but the game state is easy to desync if `world` and `wIdx` are separate fields.
10. No console errors, warnings or page errors in any run; touch, mouse and keyboard input were all reliable.

## Suggested fixes (by priority)

1. Add hints and scaffolding: 2-dock start, icons plus one-line hint chips on cards, a tint-the-right-dock power-up, and mercy for the first miss.
2. Fix the Game Over layout: keep buttons inside the canvas, shorten the review to one line per miss, dim the background, and only show confetti for a good run.
3. Rename docks: "WWI era" to "Early 1900s", "Since 1945" to "After 1945" including 1945 events, and make Anglo-Saxon/Viking overlaps explicit.
4. Replace the cause-consequence distractors with plausible same-period ones and show `reason` text as the answer choices; stop cards overlapping.
5. Give Mo a real boss beat: banner, roar on a hit, stomp on a miss, a reward on defeat.
6. Fill the phone viewport (canvas to full height) and enlarge the desktop stage.
7. Tune the ramp: fewer obscure events in world 1 level 1, a slower fall at the start, then faster with a level-2 speed-up; reward income of about 5 coins per correct answer so the shop matters.
8. Brand Journey consistently (River Rush) and cut its intro text.

## Response after the first critique (republished in place, version 6)
Fixed: dates now show on cards in each world's first level and on easy cards (mercy ramp) and a free Shield on the very first run; docks renamed for accuracy (Early Saxons, Viking Age, Early 1900s, World War Two 1939 to 1945, After the war 1946 onwards); Athelstan, Aethelflaed and Cromwell removed from the dock game as arguable; cause-consequence decoys now sit within a few years of the true answer (so date logic no longer solves them) and the silly reasons were rewritten (also fixed in Journey); Watt-to-Stockton replaced by Stockton-to-Metro; wrong-dock explanations now read "Its dates: ..."; boss: Mo is drawn at the side with his face visible, cards run in a narrower lane, CHARGE / RAMPAGE call-outs, HP 90 to 120; shop prices roughly halved; "1 coin" plural fixed; review list height reduced.
Not fixed (engine or layout limits): about 190px of unused space below the 9:16 canvas on a tall phone; dim "Endless" button and title layout (shared engine); Journey's first screen is the full Timeline Tumble journey and keeps its dense intro text.

## Second pass
Method: touch (CDP) at 375x812, three runs: a no-skill run to Game Over, a 70%-accuracy run, and the boss (lv=4 shortcut, waited 3s, then played at 75%). Screenshots in scratchpad/ar/critic2/rr/. Console errors or warnings: none.

Verified fixed:
- Menu and Shop on Game Over now sit inside the canvas (top 549 to 597 CSS px, canvas bottom 625).
- Dates show on the first cards, and the tutorial card was easy. Docks are renamed as promised.
- Mo is fully visible at the side, with a "Boss fight! Right answers hurt it." line and a HUD boss bar. The boss face is no longer hidden.
- The review text is plainer ("Its dates: ...") and coins are now awarded (+5, +7).

Remaining or new flaws (ranked):
1. The review panel is still clipped mid-sentence ("...in the Romans (AD 43 to 410). Soldiers f..."), and it is a text wall on top of the dock art. The child sees one miss only. Make it one short line or let it scroll.
2. Game Over text and the review card are still drawn over the dock labels ("Stone Age" / "Bronze Age" ghosts show through the score, stars and result line). The dim is not strong enough.
3. "NEW BEST!" still shows with 0 stars (29 points, 7 of 11 right), and confetti fires on a boss loss (2 of 5 right, 0 stars). It reads as fake praise.
4. A novice still loses fast: with random answers the run ended at 13s with 0 of 4, before the mercy ramp helped. The 4-way guess is unchanged, and a free first-miss forgive would fix it.
5. About 190px of dead space under the canvas on a 812px phone (unchanged, engine limit). The boss intro title also sits on the docks and the boss bar covers the progress bar.
Positive note: the boss dies to a novice in about 10 seconds. It is a scarier intro than a fight, with no visible reaction to hits in the screens I checked.

Verdict: a decent 3 to 5 minute snack for a kid who knows some history, but still not a YouTube-beater for 10 minutes. Fewer text walls and a real ramp are needed.
