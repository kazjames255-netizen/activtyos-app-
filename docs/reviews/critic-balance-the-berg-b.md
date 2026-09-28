# Critic and fix pass: Balance the Berg (B, campaign build)

Artifact (same URL, now version 3): https://claude.ai/artifact/7A7ZEcpWSYwh9USkoKPvqQ
Source: `scratchpad/balance-the-berg-campaign.html`, modules in `scratchpad/crb/src/` (build with `crb/build.sh`; `dev.html` keeps a test hook, `pub.html` is stripped).
Nothing committed. Method: Playwright at 390 and 1280, real mouse, touch (CDP), keyboard. Bored-12-year-old script and maths-teacher audit.

## What was played
- Every stage of all five worlds, all five bosses and the finale, at 390 and 1280, in order, with real drags (one deliberate slip per stage). Before and after the fixes. No console errors, no horizontal scroll.
- Spam/abuse: key mashing, random taps, dragging tiles off the canvas, rapid double drops, Leave and return, all tabs. No auto-solve key exists (Enter/H/U only move pieces, hint costs a lens and never gives the answer). Key mashing on the beam ends in the "watch how it goes" demo, by design.
- Touch drag on the beam (CDP touch events) works. Keyboard-only play of the new story build and the beam works.
- Maths audit (in page, `crb/audit.mjs`): 6,200 items (181 bank + 250 generated per form, ladders, stories). Checked: printed equation is satisfied by x, x is the unique solution, every worked-solution line holds at x, every arithmetic sentence in the explanations, every ladder rung above the slip holds and the slip rung really fails, exactly one correct repair option and every distractor is genuinely false, the "put the wrong x back in" text arithmetic, and the story numbers. Zero errors found in the original content.

## Top 10 flaws found, and what was done
1. Stakes were fake. Ice blocks melted but nothing happened, and a stage/boss could be "cleared" with 0 correct (a finished run always paid a star and unlocked the next). Fixed: the last block melting ends the run kindly ("The ice cracked... Pip needs a rest", nothing lost, item saved); 3 blocks (5 in Junior). New Ice patch (6 coins, hold 3) mends a block. Boss is now only beaten by finishing with ice left.
2. Results panel unreachable on phones: title, stars and buttons were clipped at the top of a centred, scrolling overlay (both 390 and 1280). Fixed: full-viewport results panel, safe centring for all overlays.
3. Coach text was 10 to 12px in the canvas (rung notes 11px, kb help 9px). Fixed: coach now DOM text at 16px (14px for long lines) anchored per rule, keyboard hint 13px, rung notes and check text bumped, parcel labels 11px.
4. Self-corrected slips were labelled "Not this time". A child who undid a slip and solved it saw a fail heading. Fixed: three states (Clean solve / You solved it, with a slip on the way / Not this time), still requeued.
5. Ladder was pure guessing (tap = mark, first wrong tap a free miss). Fixed (ported idea, see below): tap replays a rung on the scales, then mark the first one that tips.
6. Bosses were the same rule with more decoys. Fixed for Puff: share tiles are padlocked while a parcel is sealed (open first); lock icons on tiles, hint respects it. Wally (wobble), Cogsworth (no guide, three machines), Octavia (sway) and Fogbank (mix) keep their patterns.
7. World 5 had no build or word-problem skill, and two of its stages were near duplicates. Fixed: "Story Time" stage (below); the two duplicate ladder stages merged.
8. Mixed stages (Mixed Ledger, Fogbank) switched rule with the help button still showing ladder text and no rule label. Fixed: "?" shows the current rule's help; the prompt label names the rule (MIRROR, UNDO, CANCEL, PARCELS, LADDER, STORY).
9. Settings text claimed "a run never ends early", and a miss after a failed run said "Try again". Text updated to match the new stakes.
10. Desktop stage was a small phone column (377px wide at 1280x800). Slightly larger (height budget 120px instead of 150px). Not a full landscape layout; still a phone-shaped play area on desktop.

## Ideas ported from the other build (LG6Bd...)
- Story-to-equation build: new arena "story". Read a story, drag the named pieces (crate, weights, balloons, parcels, plus decoys with the wrong sign or a near number) onto the pans; pieces the story does not name bounce back with a reason; when the pans match the story the same beam takes over to solve. 7 story templates, 28 curated plus generated items, all number-checked. Keyboard, touch and hint supported.
- Lantern Rock log replay: rung test on mini scales (level or tips) with a Mark button.
- Ice-block stakes and Ice patch (consumable): ported.
- Brackets as chests: B already has parcels; ported the boss padlock pattern (Captain Clam's sealed-chest lock) onto Puff.
- Fish shop: B's coin camp already covers hats, scarves and camp items; only the consumable (patch) was missing and is now in.
Not ported: A's tide meter and gull distraction (would add pressure), lantern oil (B already has hint lens).

## Second critique (after fixes, once)
Replayed all 25 stages at both sizes on the new build: no errors, world gates opened, boss and finale reached. Remaining, not fixed:
- Canvas text inside the beam scene is still smaller than 16px in places (crate labels, "÷k of a crate"); the story prompt is about 14px at 390.
- Desktop is a centred phone-shaped canvas, not a landscape layout.
- Real touch feel, real audio and haptics on a device are unverified.
- Boss fights differ by rule for Puff only in the strict sense; the other bosses are stronger variants of their world rule.
- Stakes could feel harsh to a very young child on Junior with 5 blocks; watch in real use.

## Hygiene
Test hook (`window.__bg`, gated by `#bgdebug`) removed from the published page (checked: `undefined` with the hash present). No "Oak", no green theme colour (ice blue, gold, violet, navy only). No real tenants touched, no dev servers touched.
