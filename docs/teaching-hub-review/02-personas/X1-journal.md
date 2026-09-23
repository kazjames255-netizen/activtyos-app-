# X1 - Accessibility audit (WCAG 2.2 AA), Teaching Hub, all roles

Method: code-read only (no browser). Contrast ratios computed with a python script (WCAG relative luminance). Line numbers are from features/learninghub/ unless a path says otherwise. Severity 1 (minor) to 4 (blocker). Findings marked "unverified" need a live check with a screen reader.

## Overall verdict
Better than typical: real dialogs with focus trap and focus return (kit.tsx:300-327, ToolHost.tsx, AreaDrawer.tsx:35-50, ui.tsx:236-252), a roving-tabindex tablist (HubTabs.tsx), keyboard alternatives for every drag interaction I found (Order arrows, Match tap-pick-then-place, CardSort/VennSort menu, Sequencer arrows, FloatingPanel arrow-key move), reduced-motion handled almost everywhere, 44px targets as standard, an AA-safe --ink-3 override inside #learning-hub. It does NOT yet pass AA. Main gaps: (a) the whiteboard cannot be drawn on by keyboard, (b) colour tokens --green / --sem-* / --gold used with white text or as text fail contrast, (c) no page heading, no title change, and focus is lost when a "Needs your attention" button switches tab, (d) a nested-Escape conflict between the assessment dialog and ToolHost, (e) the quiz timer auto-submits with no extension route, (f) control borders are about 1.3:1.

## Contrast table (computed)
| Pair | Ratio | Verdict |
|---|---|---|
| dark --ink / --surface | 15.78 | pass |
| dark --ink-2 / surface, panel | 8.30 / 7.39 | pass |
| dark --ink-3 (#787e8e) / surface, panel | 4.28 / 3.81 | FAIL text (globals.css:16) |
| light (.aos-light) --ink, --ink-2 / white | 17.60 / 8.85 | pass |
| custdash --ink-3 #8a86a3 / white, bg, panel | 3.49 / 3.28 / 3.31 | FAIL text (globals.css:126) |
| hub override --ink-3 #6b6788 / white, bg, warm-2 | 5.36 / 5.03 / 4.98 | pass (kit.tsx:99) |
| .aos-light --ink-3 #6b6885 / panel | 4.96 | pass |
| white / --brand #1d3a8f | 10.22 | pass |
| white / --brand-2 #2f6bd8 | 4.98 | pass |
| white / --green and --cta #15b364 | 2.74 | FAIL |
| white / --hub-green-fill #0b7a44 | 5.41 | pass (exists, but not used everywhere) |
| white / --red #e21d27 | 4.73 | pass; red on red-soft 4.12 FAIL (timer, kit.tsx / TakeAssessment.tsx:278) |
| white / --sem-ok, --sem-warn, --sem-info, --sem-crit, --sem-action | 2.28, 2.15, 3.23, 3.76, 4.29 | all FAIL as text or fill behind white text |
| on dark surface: sem-ok 7.63, sem-warn 8.09, sem-info 5.38, sem-crit 4.62, sem-action 4.05 | | action FAIL, rest pass |
| --brand on dark surface | 1.70 | FAIL for any brand text or border on dark |
| --gold / --amber #f5b81f as text or icon on white | 1.79 | FAIL (1.4.3 / 1.4.11) |
| --green as text on --green-soft | 2.49 | FAIL |
| sidebar --side-muted on gradient end #3f78d8 | 2.53 | FAIL (side-nav 3.54 also fails for small text) |
| --line #ece6f1 on white; --hub-warm-line on warm | 1.22 / 1.33 | FAIL 1.4.11 where it is the only field boundary |
| focus ring --brand-2 on white / warm | 4.98 / 4.81 | pass |

## 1.1.1 Non-text content
- Pass: match/option images carry alt (MatchOrder.tsx:22, QuestionView.tsx:59), decorative avatars are aria-hidden, SVG charts have role=img labels.
- Sev 1: order/match hint glyph "drag" (MatchOrder.tsx:104) is aria-hidden, correct. No failures found.

## 1.3.1 Info and relationships / 1.3.5
- Pass: fieldset/legend on questions (QuestionView.tsx:33), sr-only labels on inputs (:113-130), FieldLabel htmlFor in MarkDialog (:131-142) and MarkingQueue (:101,110).
- Sev 2: AreaDrawer subject switcher CurriculumCard.tsx:127-129 declares role=tablist/tab but has no tabpanel, no roving tabindex, no arrow keys (ARIA authoring pattern broken: every tab is a tab stop and a screen reader announces "tab 1 of 4" then expects arrows). Either use aria-pressed buttons (as ToolsPanel does) or implement the pattern.
- Sev 2: no tabpanel link on inactive tabs is fine, but the hub tablist "Soon" tabs use aria-disabled yet stay clickable and keep focus (HubTabs.tsx:118). Screen reader says "dimmed" while the tab opens a preview. Announce "coming soon" via sr-only text (visual "Soon" chip is present, so this is text-visible; low).
- Sev 3: the hub has no h1 (grep of HubHero, kit, panels, home: none) and heading levels start at h2/h4 (NotesPanel.tsx:721 uses h4 with no h2/h3 parent) - 1.3.1 / 2.4.6.

## 1.4.1 Use of colour
- Pass: correct/incorrect in tools use text ("correct", "not right", check/cross with words) (LabelDiagram.tsx:178), tab live dot has sr-only "(live now)" (HubTabs.tsx:122), curriculum legend uses patterns (CurriculumCard.tsx:183).
- Sev 2: Attention rows tone (brand/violet/red/gold, TutorHome.tsx:169-173) rely on colour, but each has label + count so it is not colour only. OK.
- Sev 3: CaptureGrid verdict buttons (inperson/CaptureGrid.tsx:185, WarmupExtra.tsx:74, RemoteDrivenWarmup.tsx:72) show right by green fill, wrong by other colour: check that a glyph or text accompanies each. Unverified.

## 1.4.3 Contrast (minimum)
- Sev 3: white text on --green (#15b364, 2.74:1): lesson/lessonUi.tsx:39, inperson/CaptureGrid.tsx:185, inperson/WarmupExtra.tsx:74, remotesync/RemoteDrivenWarmup.tsx:72, live/board/PadBoard.tsx:50, live/board/WorkView.tsx:101, live/Lobby.tsx:41, lesson/builder/SlideBuilder.tsx:196. Use existing --hub-green-fill (#0b7a44, 5.41).
- Sev 3: --gold as text: LiveNotesEditor draft warning live/workspace/LessonNotesEditor.tsx:141 (1.79:1, 11.5px). teachKit.tsx:279 warning glyph is gold on white; sem-ok check in curriculum/AreaDrawer.tsx:117 (2.28:1).
- Sev 2: urgent quiz timer red on red-soft, 4.12:1 at 13px (shared-assess/TakeAssessment.tsx:278). Use --hub-red-ink (#b3131c).
- Sev 3: global dark tokens: --ink-3 fails (3.81 on panel) and there is no hub override on dark portals; custdash --ink-3 3.3 (app/globals.css:126). Overlays portalled to body (ToolHost, AreaDrawer, QuestionImage) resolve to .aos-light where it is fine, but any other body-portalled surface inherits dark values.
- Sev 2: 447 uses of 11 to 11.5px text (e.g. TakeAssessment.tsx:274 progress line "Question 2 of 5 · 1 answered" at 11.5px in --ink-3). Passes ratio inside the hub, but with 200% zoom and low vision this is the smallest text in a critical status line. Raise to 12.5+.
- Sev 2: sidebar muted text on the gradient end 2.53:1 (globals.css --side-muted, --side-hero). 

## 1.4.4 / 1.4.10 Resize and reflow (320px, 200%)
- Pass: tablist scrolls inside its own strip, sheets use max-h-[94dvh] and min-w-0 rules (kit.tsx:121), dialogs go bottom-sheet on phones, ToolHost uses 92vh.
- Sev 2: horizontal scroll of the tab strip (HubTabs.tsx:80) hides tab labels behind a scrollbar-hidden overflow; keyboard users get scrollIntoView through focus (ok) but fingers/zoomed users see no cue except the edge fade. 2D scrolling in tools: CoordGrid, GeometryBoard and LessonBoard are fixed-aspect SVG/canvas and need two-dimensional pan at 400% (1.4.10 exception for maps/diagrams applies; low).
- Sev 2: ToolHost with 92vh max and 11 rem toolbars at 200% zoom on a 1280 screen leaves about 320px of work area; Geometry board toolbar wraps but instrument SVG shrinks (unverified).

## 1.4.11 Non-text contrast
- Sev 3: input/field borders are --line / --hub-warm-line, 1.22 to 1.33:1 against the field (kit.tsx:110-118, MatchOrder slots border-[var(--brand-line)] #cdddf7 on panel). Slots and text fields are identified only by faint border plus tint. Use --ink-3-level borders (3:1) for controls.
- Sev 2: match/order tiles, cards and toggles use border-[var(--line)] (1.2:1) as their only boundary (MatchOrder.tsx:98, tile at :224).
- Sev 3: focus ring itself passes (4.98) but the pill-sliding active tab draws the ring in --brand-2 on the --brand gradient (HubTabs.tsx:118); ring-offset uses --surface so it is visible. Low.

## 1.4.12 Text spacing / 1.4.13 hover
- Not verifiable in code; components use overflow-wrap:anywhere and min-h rather than fixed heights. Tooltips are native title only (no custom hover content).

## 2.1.1 Keyboard
- Sev 4 (blocker for live tutor): Live whiteboard (live/board/BoardCanvas.tsx:121-127, controller.ts:1183-1215). The canvas is role=application with tab focus, and keys can switch tool, undo, delete, nudge a selected element, edit existing text. There is no keyboard route to draw a stroke, place a shape, or create text/sticky at a chosen point (creation is pointerDown/Move/Up only). A keyboard or switch user cannot contribute to a shared board. Provide "add text/sticky/shape at centre" buttons plus arrow-nudge.
- Sev 2: FloatingPanel resize handle is role=separator tabIndex=-1 (remotesync/FloatingPanel.tsx:122-124) - pointer only; move is keyboard (good), Reset exists. Add Ctrl+arrow to resize.
- Pass with alternatives: OrderInput up/down buttons (MatchOrder.tsx:107-110); MatchInput tap-then-place with Enter/Space on tiles and slots (:206-236); CardSort/VennSort menu (CardSort.tsx:62-66); Sequencer buttons (Sequencer.tsx:62-63); GeometryBoard instruments tabIndex/role=button with arrow keys (GeometryBoard.tsx:367-385) and typed input on CoordGrid (:102-104); LabelDiagram picks label by keyboard (LabelDiagram.tsx:129-173).
- Sev 2: MatchInput drag: a match pool tile is a div role=button with aria-pressed; after placing via keyboard, focus is on a removed element (tile moves from pool to slot: React re-keys by definition index, so the same key is kept and focus mostly survives - unverified). Announced via status region (MatchOrder.tsx:263) which helps.
- Sev 2: Match slot with placed tile becomes tabIndex -1 but the tile inside is tabbable: fine. To take a tile out with keyboard the user must select it then activate the pool container, which is a div with onClick only, not focusable (MatchOrder.tsx:245): there is no keyboard way to "put back" except selecting another tile on a slot (swap). Add a "Put back" button on placed tiles. (unverified whether a key path exists.)

## 2.1.2 No keyboard trap
- Pass: dialogs trap and release via Escape (kit.tsx:327, ToolHost.tsx:47, ui.tsx:244).
- Sev 3: Escape conflict. shared-assess/ui.tsx:236-252 listens on document and calls stopPropagation on Escape; ToolHost.tsx:47 listens on window (bubble, later). A tool opened from a question inside that dialog therefore cannot be closed with Escape and the same Escape closes the quiz dialog (with its "leave" confirm), risking lost place. Also both focus traps run at once. Use one modal stack. Unverified live.

## 2.1.4 Character key shortcuts
- Sev 2: Whiteboard single-letter shortcuts (v, p, h, e, t, s, l, a, digits, brackets) (controller.ts:1200-1207) are active while the canvas has focus AND, by design, when a toolbar button was last clicked (BoardCanvas.tsx:64-83). No way to turn off or remap. Restrict to canvas focus or add a setting.

## 2.2.1 Timing adjustable
- Sev 3: TakeAssessment.tsx:77-78, 147, 287 auto-hands-in on time limit. No extension or turn-off for a learner needing more time (SEND, screen-reader users). At least: tutor per-child extra-time multiplier, and a warning at 5 min/1 min announced to AT (timer has role=timer, which is not live; only aria-label changes each second).

## 2.2.2 Pause, stop, hide
- Sev 2: infinite animations: hub-ping (live dot), hub-float, RhythmChart? All wrapped by prefers-reduced-motion (kit.tsx:141, homeKit.tsx:33, lessonUi.tsx:28, SlideDeck.tsx:47, CanvasSlide.tsx:203). Pass. JS animations respect it (LessonPlayer.tsx:248, teachKit.tsx:325). Gap: CSS tab pill transition uses motion-reduce:transition-none (pass); hub-sheet-in animation (kit.tsx:121-ish) - covered by the media block (verify list includes .hub-sheet).

## 2.4.1 Bypass blocks / 2.4.2 Page titled / 2.4.6 Headings / 2.4.3 Focus order
- Sev 3: no skip link inside hub; single <main> exists (LearningHubApp.tsx:253). Sidebar/tabs come before content.
- Sev 3: no document.title update on tab change (grep: none in features/learninghub). Screen reader users learn nothing on tab switch.
- Sev 4 for the tutor scenario: "Needs your attention" rows are buttons that call go("homework") etc. (home/TutorHome.tsx:169-173, home/homeKit.tsx:31). The Home panel unmounts and the new tabpanel is rendered with tabIndex -1 but is never focused (LearningHubApp.tsx:263; grep for focus() on tab change: none). Focus falls to <body>. Keyboard user must Tab from top of page through side nav and tab strip to reach the marking list. Move focus to the tabpanel heading on programmatic navigation and announce the destination.
- Sev 2: tab activation is on arrow key (automatic activation) - ok, but each arrow re-renders a whole panel; a screen-reader user scanning 12 tabs fires 12 data loads. Consider manual activation.

## 2.4.7 Focus visible / 2.4.11 Focus not obscured / 2.4.13
- Pass: FOCUS class (kit.tsx:23) gives a 2px brand-2 ring with offset.
- Sev 2: FloatingPanel and a few components use `focus-visible:outline-[var(--brand)]` (FloatingPanel.tsx:88,98): on dark theme --brand is 1.7:1 on --surface. Use --brand-2 or white-ringed.
- Sev 2: GeometryBoard/CoordGrid SVG <g> items set style outline none (GeometryBoard.tsx:368,385); focus indication depends on the sel state highlight - confirm that a visible ring exists for focused-but-unselected (onFocus sets sel, so likely ok).
- Sev 2 (2.4.11): FloatingPanel windows are position:fixed and non-modal and can cover the item that holds keyboard focus in the page below (FloatingPanel.tsx: z-order + drag). Sticky hero/top bars: none found that cover focus.

## 2.5.1 / 2.5.7 Dragging movements (WCAG 2.2)
- Pass: every drag has a single-pointer alternative (see 2.1.1 list). Board drawing itself is inherently path-based (exempt), but see 2.1.1 for the keyboard need.
- Sev 2: FloatingPanel header drag alternative is arrow keys via the title button, which is not discoverable except through its aria-label. OK for AT users.

## 2.5.8 Target size (minimum 24px; project standard 44px)
- Pass overall: most icon buttons are h-9/h-11 (kit.tsx:340 h-9 w-9 = 36px; ToolHost close 44).
- Sev 2 (project standard, passes 2.5.8): kit.tsx:340 Close 36px, 387 error dismiss 32px, teachKit.tsx:137 dismiss 24px (only just meets 2.5.8), CoordGrid plotted-points chips min-h 32px (:104), CurriculumCard framework toggle 36px (:112), FloatingPanel resize handle 20px (:122, pointer only), tool toolbar buttons min-h-[40px].
- Sev 2: coordinate-grid SVG hit areas: points on grid are draggable dots (CoordGrid.tsx:46-54) - pointer target radius unverified.

## 3.2.x Predictable
- Sev 2: ChildChip / who-picker: pressing a child in "Who's learning?" (family/FamilyContext.tsx:92) switches the whole hub view without any announcement (no live region) and keeps aria-pressed only. The parent hears nothing about the data changing. Add role=status "Now showing Maya's progress".
- Sev 2: parent gate uses a sum in a <label> (ParentGate.tsx:28) - accessible, but a maths gate is a cognitive barrier (3.3.8 Accessible authentication is about login, not this). Offer an alternative (hold 3 s or answer by tapping).

## 3.3.1 / 3.3.2 / 3.3.3 Errors and labels
- Pass: forms use labels; placeholders are additional (HomeworkForm.tsx). role=alert on errors (AreaDrawer.tsx:102, ParentGate.tsx:31, Guard).
- Sev 2: no aria-invalid / aria-describedby anywhere in the quiz, homework or marking forms (grep returned none in shared-assess, homework, quiz). Errors are shown in a banner (kit.tsx:387) rather than tied to the field. 
- Sev 2: MarkingQueue marks inputs (MarkingQueue.tsx:101) label says "Marks (out of N)" but out-of-range entry is not identified in text at the field - unverified.
- Sev 2: ParentGate error uses --red (#e21d27) at 13px on the sheet tint (4.73 on white, ~4.4 on --hub-warm) - borderline; use --hub-red-ink.

## 4.1.2 Name, role, value / 4.1.3 Status messages
- Pass: OrderInput and MatchInput announce moves through polite status (MatchOrder.tsx:263,-); CardSort/Sequencer/Venn have polite status; ToolsPanel result count aria-live (ToolsPanel.tsx:77); board toast role=status (BoardShell.tsx:101).
- Sev 3: Loading skeletons use role=status with aria-label only (kit.tsx:200, LearningHubApp.tsx:146): role=status with no text content may not be announced. Add sr-only text or aria-live content.
- Sev 2: async results after tab change (list loaded, "Saved", homework assigned) rely on toasts; verify hub toast has role=status (kit toasts: grep found role=status only on skeleton and notices).
- Sev 2: QuestionImage zoom % readout is aria-live (QuestionImage.tsx:108) - good; the img click-to-zoom cycle (QuestionImage.tsx:119) is a click on a non-focusable img (mouse-only convenience; buttons exist).
- Sev 2: Progress/attainment charts: TrendChart/charts.tsx SVG - verify a text alternative or data table exists (not audited in depth).

## Scenario walkthroughs
1. Tutor: open hub -> clear "Needs your attention" -> assign homework. Tab order reaches quick-action buttons in DOM order; each attention row is one button with count and hint in aria-label (good). Activating a row moves tab but not focus (2.4.3 sev 4). Marking dialog (MarkDialog) has labels and focus return (good). Assign homework form has labelled fields; the tool/quiz picker path unverified for keyboard. Estimated extra keystrokes lost to focus reset: 15-25 Tab presses per row.
2. Child: quiz with match/order and a tool question. Question view is a fieldset with radio/checkbox; match by tap-select then Enter on slot; order by arrow buttons with status announcements. A tool question opens ToolHost inside the quiz dialog (Escape conflict, sev 3). GeometryBoard/CoordGrid have keyboard paths; timer auto-submits (sev 3).
3. Parent: switch child -> read progress. Who-picker buttons are toggles with aria-pressed; no announcement of the change (sev 2); progress charts need text equivalents (unverified); ink-3 secondary text passes inside hub.
4. Any user: Tools tab + three tools. ToolsPanel filters are pressed-buttons with count live region; ToolHost trap and focus return good; card sort, sequencer and label diagram have keyboard routes; whiteboard is the exception (sev 4); coordinate grid needs typed entry (documented in its aria-label).
