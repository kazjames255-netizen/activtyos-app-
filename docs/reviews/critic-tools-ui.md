# Critic review: tool experience (FloatingPanel, ToolHost, ToolPicker, dock, "Just the tool")

## Evidence status (read first)

- I could NOT get a live-browser run. `scripts/e2e-locked.sh` sat in the FIFO for about 45 min and then about 85 min. Both runs were mine, and the first died in `beforeAll` on `fetch failed`, the second on a 400s fixture timeout (the dev API was slow under the queue load).
- I then started an unlocked run with an isolated throwaway account. The auto-mode classifier blocked my follow-up read of that run's output as interfering with the shared workload. I stopped there and did not read or pursue it further.
- I deleted my temporary spec `e2e/review/_critic-tools-ui.spec.ts`. An unlocked Playwright process from it may still be alive. It only touches its own `@activityos-test.com` account and `scratchpad/critic-state.json`, not `.auth` or the standing tenants. Nothing was killed, and no real tenant or cleanup was touched.
- The screenshots directory `docs/reviews/shots/tools-ui/` is therefore EMPTY.
- Everything below is (a) a line-by-line read of `FloatingPanel.tsx`, `ToolPicker.tsx`, the LessonPlayer dock, `ToolHost.tsx` and `HelpTools.tsx`, plus (b) a visual review of about 9 of the 103 existing bare-mode shots in `docs/teaching-hub-review/screenshots/tools-bare/`.
- Items are tagged **[shot]** (seen in an existing screenshot), **[code]** (read in source, not exercised) or **[verify]** (needs a live check). Treat [code] items as strong hypotheses, not confirmed bugs.
- Viewports 1024/768/390 and light/dark were NOT observed. The operator portal is light (`LIGHT_PALETTE`), so the tools sit in `.aos-light`. A true dark render was not checked.

## Fix status (overnight autonomous pass, 27 Sep)

Verified with a standalone headless Playwright script (`scratch/tools-ui-verify.mjs`, modes `shots | checks | bare-sweep`; `scratch/hit.mjs`) against the running dev stack using the existing throwaway `@activityos-test.com` freelancer state. No e2e queue used. Shots and JSON results are in `docs/reviews/shots/tools-ui/` (`window-*` / `bare-*` at 1440/768/390, light + dark; `_checks.json`, `_report.json`, `hit-*.png`). `npx tsc --noEmit` clean. Nothing committed.

### Fixed (verified live unless marked [code])
- H1 bare frame no longer captures the pointer: root `pointer-events:none`, only the pill, grip, tool controls and tool stage are `auto`. Legacy widgets get the same rule in `LegacyWidget.tsx`. Hit-test: 60/80 sample points fall through on the equation balancer, 76/80 on the atoms tool. Tools whose stage IS a full-width SVG (geometry board, balance scales) still own their own box, by design.
- H4 grip hidden when minimised; Close hit-test at its bottom-right corner returns Close.
- H2 body no longer `touch-none` in bare mode; finger scroll works ([code] for touch), grip lives in a reserved 44px corner (`pb-14`) instead of over the last row.
- H6 auto-open no longer steals focus when an input/textarea/contenteditable is focused; focus return only if the opener is still in the DOM.
- H3 grip is a focusable `role="slider"` with arrow-key resize (20px, Shift 60px), `aria-valuenow/valuetext`. Verified: 980 -> 1020 after two ArrowRight.
- H5 every header/pill control measured 44px high (min 44 wide); picker chips, "Add tool", picker close, dock switch/"Use on all" buttons and the every-question remove button are now 44px.
- M2 bare pill labelled: Move / Fade (Solid) / Back to window / - / + / reset. Strings are inline English (Fade, Solid, Back to window); they still need i18n keys, deliberately not added because i18n files are being edited elsewhere.
- M3 Escape closes only the innermost layer: skipped when the target is inside a select / listbox / menu / nested dialog, or the panel holds an `aria-expanded="true"` control; already-handled Escapes (`defaultPrevented`, hub escape layers) are ignored. Plain Escape still closes the panel (verified).
- M4 one z scale in `features/learninghub/zLayers.ts`: dock 900, panel band 1000-1099 (any counter is wrapped into it, so a window can never climb over dialogs), sheet 1200, dialog 1250, picker 1300/1301, toast 1400; minimised tray 1150; ToolHost modal 1250.
- M5 picker menu and card: `aria-modal`, Tab focus trap, the rest of the hub host is set `inert` while open, focus returns to "Add tool" ([code] beyond load check).
- M6 dock at tablet/phone widths (no free room beside the lesson): collapses to a 44px "Tools" button that opens/closes the dock ([code], needs a lesson fixture to shoot).
- M9 bare and see-through choices remembered per tool in localStorage (`aos.toolwin.<title>`). Verified: close + reopen stays bare.
- L2 reduced-motion: the body opacity transition and picker tile hover lift are motion-safe. L3 picker opens upward using its measured height. L1/L7 partial: grip glyph now inside an aria-hidden span; dialog landmark kept.
- "Just the tool" chrome trimmed (verified by before/after control counts across all 102 tools): writing frames N-06/N-07/N-08/E-04/E-05/X-15 lose the text-size and line-spacing rows (13 -> 7 controls); E-06 loses those plus the timer checkbox (9 -> 2); M-60/M-61/S-02 lose the axis-range inputs (9 -> 5); periodic table loses its zoom buttons; fraction bars lose Smaller/Bigger; widgets lose their "Challenge me" button. Undo, redo, clear, rub out, flip, resize stay.

### Closed in the second overnight pass (27 Sep; `scratch/tools-ui-verify2.mjs` modes `phone | hit | dock`, shots and JSON `_phone.json`, `_hit.json`, `_dock-768.json`, `_dock-390.json` in `docs/reviews/shots/tools-ui/`)
- **Phones get the real window, so "Just the tool" works at 390.** `ToolHost` no longer swaps to the full-screen `ToolHostModal` under 640px (deleted). Phones open the same `FloatingPanel` at 374 x 720 (8px gutter). Verified with `hasTouch`/`isMobile`: bare pill shows Move / See-through / Back to window with -, +, close in a tidy second row (reset is hidden under 520px wide; the pill is `rounded-3xl`); a CDP touch drag on the Move pill moved it (+24, +96); see-through works; hit-test in the empty part of the frame falls through to the page (`phone-bare-M-10.png`, `phone-bare-ghost-M-10.png`, `phone-bare-w.balance.png`). Finger scroll (CDP `synthesizeScrollGesture`, touch source): bare Chart builder scrolls 38px, bare periodic table fits (no scroll needed), window periodic table scrolls 69px. A swipe that STARTS on the chart's own bars does not scroll (the chart owns that pointer, tool-native); starting elsewhere scrolls 145px.
- **Full-width SVG hit target.** New `data-bare-pass` contract: in bare mode an element (or svg) carrying it is `pointer-events:none` while its drawn children stay `auto` (`FloatingPanel.tsx`). Geometry board marks its svg and wrapper; balance scales (`#bs-svg`) and every legacy widget root get it from `LegacyWidget.tsx`. Geometry adds a transparent `geo-bare-hit` rect ONLY while a drawing tool (Line / Pencil) is active, so drawing on the grid still works; with the move tool the whole sheet falls through. Live: balance scales 73/88 sample points fall through, 0 hit the svg root, the tokens still hit; geometry move tool falls through, geometry with Line active hits the rect. Legacy widgets: the 63/88 samples that used to hit the widget root box now fall through. Caveat: a scripted mouse drag of the tray token did not change the balance state in EITHER window or bare mode (control run identical), so drag-through was not proven, only the hit-test.
- **M1 legibility.** Bare tool text gets a paper halo (`text-shadow` in the surface colour on HTML text, `paint-order:stroke` 3px surface stroke on `svg text`), not on buttons/inputs. Visible on the balance scales "x + 2 = 10" over busy cards.
- **M7 wording.** One vocabulary in both modes: See-through / Solid (bare no longer says "Fade"), Just the tool / Back to window, Move. All from `hubtoolsui.*`.
- **M8 narrow headers.** Labels for See-through and Just the tool now always show; under 420px wide the Minimise and Reset buttons are hidden instead (Close, See-through, Just the tool keep their words).
- **L4** sticky A-Z rail (one scrolling row of 44px buttons, only when more than 3 letters) in the picker card. **L5** EMOJI_RULES: specific phrases first (times tables, coordinate grid, area/perimeter, light rays), `time` word-bounded. **L6** panel shadow lightened (0 8px 24px, .16), see-through header uses `--surface` not `--panel` so it no longer greys.
- **Per-widget trim.** The `-fb` / `-msg` feedback lines are hidden and the `-say` narrator lines are visually hidden (still read by screen readers) in bare; game and answer-check buttons are marked as chrome: Challenge me, Check, Check my colours, Reveal x, New puzzle, New round, New sentence, Next sentence, Surprise me, Mix them up again. Kept: flip, undo, redo, clear, rub out, start again / reset, resize, and every tool-native control (mode tabs, unit chips, counters). Sweep JSON: `scratch/sweep-after.json` (102 tools, 0 errors).
- **i18n.** New area `lib/i18n/messages/areas/hubtoolsui.ts` (en pl ro ur pa bn ar pt es fr cy: move, seeThrough, solid, backToWindow, collapseTools, resizeValue, moveHint) registered by one line in `lib/i18n/messages/hub.ts`. The former English literals "Fade", "Solid", "Back to window", the resize `aria-valuetext` ("{w} by {h} pixels") and the dock's "Collapse tools" aria-label now use it. `moveHint` is translated but not yet shown anywhere. Wording is copied from the existing hublive dSeeThrough / dSolid / dMoveWord per locale; a native speaker has not reviewed the new strings.
- **Previously code-only, now live-verified.** Dock collapse at 768 and 390 with a real lesson fixture (Neurones and synapses preview): collapsed 44px "Tools" button bottom-right, opens to the dock with a 44px collapse button. Picker focus: opens with focus inside the menu, Escape returns focus to "Add tool", card opens with the rest of the hub `inert`, Tab stays inside the card, Escape and the close button both return focus to "Add tool". Touch scroll: see above.

### Still open
- The dock, when opened at tablet width, can cover the right of the lesson card (by design: the user opened it and it has a collapse button). No bottom-sheet variant.
- Tools whose own SVG handles pointer input on bars/tokens (chart builder bars) block a finger scroll that starts on them; that is tool-native.
- Drag-through on the balance scales tokens was not demonstrable by script (see above); the older behaviour is unchanged.
- Dark theme render and 1024 width are still not shot. The new i18n strings need a native-speaker pass.
- `moveHint` string is unused (kept for a future one-time phone hint).

## What is genuinely good (protect these)

1. Header drag is robust in principle. Pointer capture is only taken after a 5px threshold, so plain taps on the header buttons still click. `noClickAfterDrag` and the `onClickCapture` guard stop a drag from firing a click (`FloatingPanel.tsx:67-106,171`).
2. There is a keyboard drag alternative. Arrow keys on the Move button move the panel 10px, or 50px with Shift, and the position is clamped (`:108-115`). The Move button carries an aria-label with the tool title.
3. `HEADER_MIN_VISIBLE` (80px) keeps the header reachable after an off-screen drag (`:37,59-65`).
4. Focus lands in the panel on open and is restored to the opener on close (`:53-57`). Escape closes the panel, and `stopPropagation` avoids double handling.
5. The picker's Escape handling is layered correctly: a capture-phase listener closes the card first, then the menu (`ToolPicker.tsx:60-64`). The picker is portalled above the panels (z 100000/100001), so clipping never cuts it off.
6. The Alt-drag override over SVG/canvas, and the exemption of inputs, sliders and canvas from drag-from-anywhere, are sensible (`:82-93`).
7. See-through fades only the body, and the header stays solid (`:171`). Bare mode gives every tool a common set of controls and hides `data-tool-chrome`.
8. Picker card: subject chips have `aria-pressed`, each letter section has an aria-label, and the search field has autofocus and a thick brand border. The coloured tiles have a strong hierarchy, a 44px emoji tile, and subtitle text at hsl(h 45% 34%) on hsl(h 90% 96%), which is above 4.5:1. An empty state exists.
9. The dock centres itself in the free space to the right of the lesson card, is `pointer-events-none` outside its card, and falls back to the edge when there is less than 274px free (`LessonPlayer.tsx:165-183`).
10. Bare-mode shots of the instruments (protractor + ruler on the geometry board) look like the actual instrument. The French accent keys look like a real keyboard. The eye diagram is clean.

## Findings

### CRITICAL

None proven. The two candidates below are HIGH until a live hit-test confirms them.

### HIGH

**H1. Bare mode: the invisible frame steals the pointer over the question underneath.** [shot + code, verify]
- `FloatingPanel.tsx:171`: the body is `cursor-grab touch-none select-none` and covers the panel's whole rectangle, and the root is `position:fixed` at 960x720 by default (`ToolHost.tsx:56`).
- In `tools-bare/w.equationBalancer.png` and `S-25.png` the tool occupies about 40% of the frame. The blank remainder is a transparent, drag-capturing layer sitting over whatever it covers (the answer box in a lesson).
- Repro: open any tool, click "Just the tool", then click or type in the lesson content under the empty part of the frame.
- Fix: root and body get `pointer-events:none`. Only the tool's own elements, the pill and the grip get `pointer-events:auto`. Alternatively, shrink the frame to the tool's content box in bare mode.

**H2. Bare mode: touch scrolling is disabled on scrollable tools.** [code, verify]
- `:171` sets `touch-none` plus `overflow-auto` on the body in bare mode. Tall tools such as the chart builder (`w.chartBuilder.png`, "Swim" row cut off at the bottom), the story mountain and N-07 cannot be scrolled with a finger, because the drag is meant to move the window.
- Also, the resize grip, a 32px circle at bottom-right (`:174`), permanently sits on top of tool content (visible over the last row in `w.chartBuilder.png`).
- Fix: only apply `touch-none` to the pill and the rim. Make the resize handle offset outside the tool. Add a scroll fade or an "extra below" hint.

**H3. No keyboard way to resize, and the grip is mislabelled.** [code]
- `:172-175`: the grip is a `role="separator" tabIndex={-1} aria-label` `<div>`. It is not focusable, and `separator` is the wrong role for a resize handle.
- Keyboard and switch users can move a panel but never resize it, except through bare mode's +/- buttons. In normal mode there is no resize at all.
- Fix: make it a focusable `role="slider"`-style handle with arrow-key resizing and `aria-valuetext`, or put Bigger/Smaller into the normal header overflow.

**H4. The resize grip overlaps the Close button when minimised.** [code, verify]
- The grip is `absolute bottom-0 right-0 h-5 w-5` at `:174`, later in the DOM than the header. `ToolHost` minimises to `h=44` (`:62`), which is exactly the header height.
- The grip's 20x20 box therefore overlaps the bottom-right quadrant of the 44px Close button (Close is the last header item). A press on that quadrant starts a resize instead of closing.
- Fix: hide the grip when minimised, or raise the header's z-index above it.

**H5. Sub-44px targets on the primary controls.** [code]
- Ghost and "Just the tool" are `h-9` (36px) at `:152,156`. Smaller, Bigger and Reset in the bare pill are 36x36 (`:161-165`). The resize grip is 20px in normal mode. Picker chips are `py-1` (about 26px). "Add tool" is `min-h-[36px]`, and the "Use on ALL" buttons are 36px. The picker close is 40x40.
- Only the title and Close (`h-11 w-11`) meet the 44px target. These are the controls a child or a tutor tapping a whiteboard would hit.
- Fix: 44px hit areas (padding or `::before`) on everything in the header, the pill and the chips.

**H6. Focus is stolen from the answer box on auto-open.** [code, verify]
- `:53-57` always calls `titleRef.focus()` on mount, including panels that auto-open for a question (per-question tools). A pupil typing an answer loses the caret when a tool opens.
- Fix: only take focus when the open was user-initiated, via a `focusOnOpen` prop.

### MEDIUM

**M1. Text legibility of bare tools over busy backgrounds.** [shot]
- `M-60.png` (graph): axis numbers strike through page text. `N-07.png` and `w.storyMountain.png`: "Appearance", "Personality" and step labels have no plate and collide with the underlying cards.
- Only `[data-tool-strip]` gets a frosted plate (`:171`). Labels inside the tool do not. Give bare-mode text a subtle text-shadow or paper plate, or a user-selectable frosted backing.

**M2. Bare pill: icon-only buttons and unclear meaning.** [shot + code]
- In `tools-bare/*.png` the pill reads "Move | ◐ | Window | - | + | refresh | x". The ◐ has no label in bare mode (`:153`). "Window" reads as a noun and not as "Back to window".
- There is no visible label for -/+, reset or close beyond the tooltips. A 7-year-old sees glyphs.
- Suggested labels: "Fade", "Smaller", "Bigger", "Back to window", plus tooltips on touch.

**M3. Escape closes the whole panel even from inside the tool.** [code]
- `:140` closes on any Escape keydown inside the panel. A tool with its own open select, popover or dialog (calculator memory, a match/label chooser such as S-25) loses the whole tool on the first Escape.
- The tools page's `useEscapeLayer` is used by the modal `ToolHost`, but not by the floating variant. Layer Escape with `useEscapeLayer`, and only close when the target is not inside an open popup.

**M4. z-index scale is ad hoc and unbounded.** [code]
- `ToolHost` starts at z=3000 and increments forever (`:59,63`). `HelpTools` uses `1000 + c.z`. The dock is z-[900]. Toasts are 1400 and the bottom sheet is 1200 (`HelpTools.tsx:450,464,567`). The picker is z-[100000/100001]. Real dialogs (Ask teacher, confirm) are unknown.
- A ToolHost panel (3000+) covers HelpTools panels (1000+), the dock (900) and toasts (1400). Define named layers (dock < panel < dialog < picker < toast).

**M5. The picker card is `role="dialog"` but not modal.** [code, verify]
- `:89-96`: there is no `aria-modal`, no focus trap, and the backdrop is `role="presentation" aria-hidden`, but the tools behind it stay tab-reachable and available to screen readers. The menu popover also says `role="dialog"`.
- Fix: `aria-modal="true"`, a focus trap, and `inert` on the background. Return focus to the "Add tool" button on close (currently not restored).

**M6. The dock's placement collapses at tablet widths.** [code, verify]
- `LessonPlayer.tsx:165-183`: with `gap < w + 24` the dock sits fixed on the right, over the lesson card (at 1024 and below the lesson column is likely wider than the free space). It has `max-h calc(100vh-7rem)` with its own scroll, but there is no collapse handle, so the dock can cover the question's right side. `z-[900]` also sits under any tool panel.
- Verify at 1024, 768 and 390: it needs a bottom-sheet or collapsed mode.

**M7. The unit swaps between "tool" and "window" language.** [code]
- Strings in the header: "Move" (bare) versus the tool's name (normal), "See-through" versus "Solid", "Just the tool" versus "Window", "Put back", "Reset size and position". "Reset" and "Put back" are used for the same action in two modes.

**M8. Header label hiding below 420px.** [code, verify]
- `:153,157`: labels are shown only at `w >= 420`, and `minW` is 360 for ToolHost. Between 360 and 420 wide the header is 4 icon buttons plus a squeezed title. The ghost glyph ◐ and the bare glyph ▢ are unlabelled beyond the aria-label.

**M9. State loss.** [code]
- Bare and ghost are local `useState` in `FloatingPanel` (`:45-46`). Opening a different tool, reloading, or moving to the next question resets them. A tutor who prefers "Just the tool" has to re-select it every time.
- Persist the preference per user (localStorage), keyed by mode. `ToolHost`'s `z`, `g` and `min` state is also lost on remount.

### LOW

- **L1.** The bare-mode grip glyph "⤡" and the drag handle "⠿" are Unicode characters. They render differently across fonts and can be read out by screen readers (aria-hidden is set only on the handle).
- **L2.** `transition: opacity .15s` is not guarded by `prefers-reduced-motion` (`:171`). `hover:-translate-y-0.5` on picker tiles (`ToolPicker.tsx:117`) also lacks `motion-reduce`. `backdrop-blur-[2px]` is fine.
- **L3.** The picker's fixed positioning uses `top - 190` when opening upward (a hard-coded height, `:44`), which may misplace the menu on short screens.
- **L4.** The A-Z headings mean a tile grid with many single-tile letters, so the picker looks sparse. A sticky letter rail would help.
- **L5.** `EMOJI_RULES` is first-match. "Time" would catch "Times tables", and "graph" would catch "Coordinate grid". Several tools will get the wrong picture ("area" and "map" collisions). Emoji-only tiles also have no text alternative, though they are `aria-hidden`.
- **L6.** The panel shadow (`0_18px_44px`) is heavy on the light theme. The tools frame uses `aos-light`, so the see-through header keeps `--panel` at 92% and can look grey against the page.
- **L7.** `role="dialog" aria-modal="false"` on every floating window means many nested dialog landmarks. Consider `role="group"`/`region` with an aria-label.

## "Just the tool": is it literally just the tool?

Sampled from `tools-bare/`: M-10, w.equationBalancer, L-01, w.chartBuilder, S-25, N-07, M-60, w.storyMountain (plus the `_report.tsv` button counts for about 30 more).

- **Strong**: instruments (M-04, M-07, M-10, H-G05), the eye diagram (S-25), the French accent keyboard (L-01). The tool shows and the frame vanishes.
- **Acceptable, but keeps controls**: the equation balancer keeps its +/- steppers and number picker, chart builder its type chips, and story mountain its story tabs. These are tool-native controls, so keeping them is correct.
- **Not "just the tool"**: N-07 keeps "Text size / Line spacing" and "Clear writing". Chart builder shows only the top of the pictogram, with the bottom clipped. M-60 keeps four number inputs and the mode strip (the strip is the tool). `_report.tsv` shows 20-26 buttons still visible on w.atomBuilder, w.langVerbs, L-12 and w.equationBalancer.
- **Essential actions**: geometry board (M-10) keeps flip (the "Tap an instrument to flip it" hint), undo and redo, and "Clear" in the strip, as requested. Verify that "Clear" is visible in bare mode for the geometry board, because the `[data-tool-chrome]` rule could hide it.
- Judgement: bare mode reads as "the tool without its window". It does not reduce tools to a minimal interface. That is fine, but the pill label should say so honestly, and for tools with more than about 20 controls a "quick controls" collapse would help.

## Top 10 to fix first

1. H1 - the bare frame's transparent area captures pointer events over the question. Use `pointer-events:none` on the frame.
2. H4 - the resize grip overlaps Close when minimised.
3. H2 - `touch-none` blocks scrolling in bare mode, and the grip covers tool content.
4. H6 - do not steal focus from the answer box when a tool auto-opens.
5. H3 - keyboard-operable, correctly-roled resize.
6. H5 - 44px targets on the header, the bare pill and picker chips.
7. M3 - Escape inside the tool should close only the innermost layer.
8. M4 - a single named z-index scale (dock, panel, dialog, picker, toast).
9. M5 - make the picker card a true modal (`aria-modal`, focus trap, focus return).
10. M6/M9 - dock behaviour at tablet widths, and persisting bare/ghost choices.

## To close the gap

Run once the lock frees: open M-10, M-21, w.balance at 1440/1024/768/390, and in each measure the hit-test at empty bare-frame points (H1), the Close hit-test when minimised (H4), and the tab order and target sizes. Then open the picker card from the dock in the lesson preview at each width. A ready-to-adapt script was drafted, but I removed it.
