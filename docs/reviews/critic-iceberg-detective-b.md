# Critic and fixer: Iceberg Detective (B, campaign build)

URL (republished in place, version 3): https://claude.ai/artifact/8qrMNDobNHtCE3QY4zsDdh
Source: scratchpad/iceberg-detective-campaign.html (pre-fix copy: scratchpad/icb/orig-campaign.html). Test harness: scratchpad/icb/ (lib.mjs, bot.mjs, run1.mjs).

## How it was tested
Playwright, real mouse events on the canvas (drag, tap, scrub), button clicks, at 1280x900 and 390x844 (touch context). A bot read the game state through the `#iddebug` hook only to know where to aim, then played every stage of all five worlds, every boss and the finale (Iceberg Court boss, 8 cases). Runs: perfect play at 1280 (all 25 stages, 3 stars, all bosses beaten, worlds unlock in order, finale card shows), and 25-35% deliberate mistakes at 390 (feedback, hints, auto-reveal after two misses, retest queue, warm-up result). Zero console errors in every run. Maths: all 44 authored cases checked by hand (every step, fix, distractor and explanation is correct); the 24 generated templates are self-validated by an evaluator at load (a line must be true or false as claimed at test values) and none failed across roughly 500 generated cases played.

## Top 10 flaws found (13-year-old and maths teacher)
1. Bug: Camp "Hunch" button called an undefined function (`buyLens`), so the purchase silently threw. FIXED (now `buyHunch`); verified: buying works, count and clues update.
2. Scale House boss (4 weigh-ins): tapping a step to select it for Accuse, while a number was still selected, silently spent a weigh-in. Bot log: used 2 -> 3 on every tap. FIXED: with limited weigh-ins a tap only selects.
3. Maths wording: the world 2 rule said a correct line weighs level "whatever number you put in". True for expressions, false for equations (only the true x balances). FIXED text in both rule card and controls.
4. No stakes at all: flames dropped but nothing ever happened at zero, so bosses felt like ordinary stages. FIXED (ported idea from A's ice crystals): in a boss stage, if all flames go out the run ends with "Hattie needs a warm-up", nothing lost, missed cases return; Junior gets 5 flames; Calm mode switches it off; the brief says so. Verified at both widths.
5. Only a Hunch for repairs existed; nothing helped when stuck finding the flaw. FIXED (ported A's Hint Flare): Camp item, 6 clues, outlines two steps, one is the flaw, works in Tower, Scale, Lab, Chain and Court (single- and two-flaw files). It never says which.
6. Currency naming: Today said "8 crystals" while everything else says clues. FIXED.
7. Desktop (1280): the playfield is a 436px phone column with sparse side panels and a large empty area under the slabs on short files. NOT FIXED (layout change is larger than tonight's scope); suggested: scale the stage up on wide screens and use the side panel for the case brief.
8. At 390 the feedback panel covers the rebuilt chain, so the child cannot look at the repaired working while reading the explanation. NOT FIXED; suggested: shrink the panel to a one-line summary with "Show working" expand.
9. Generated fraction cases sometimes leave unsimplified fractions (for example 2/4 divided by 4/2), which a teacher would call untidy. NOT FIXED (templates are self-consistent and correct).
10. "Case closed, clean" as the success heading is opaque to a teenager ("clean" is also the name of a file kind in the Court). NOT FIXED; suggest "Case solved".

## Ports from the other build (A)
- Ice crystal stakes: ported as boss-only, gentle stakes (see 4).
- Lodge consumables: ported Hint Flare (see 5). B already had a Camp shop with cosmetics, tools and Hunch, so a separate Lodge was not needed.
- Casebook (free replay): B already has replayable stages, daily challenge and return visits; not ported.
- Court of Proof (prove before accusing with weighings): not ported; B's Court already teaches presumption of soundness with a permanent-crack penalty, and adding weighing there would blur the world 2 verb. Candidate for later: an optional "check with a number" table in the Court.

## Re-critique (one round after fixes)
Re-ran worlds 2 and 5 at 1280 with perfect play (all stages, boss, finale complete, no errors) and all five worlds at 390 with mistakes (no errors, boss warm-up path works, no horizontal overflow). Remaining open items are 7-10 above. Not verified: real finger feel on a physical device, audio, and music (no audio device in the harness).

## Rules check
No mention of Oak; no green theme colour (blue, violet, gold, navy only); nothing committed; no real tenants; dev servers not touched; no e2e queue used.
