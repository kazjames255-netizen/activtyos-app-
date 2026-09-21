# Whiteboard review 02 — selection, editing, canvas

Scope: `features/learninghub/live/board/` — controller.ts, render.ts, model.ts, reducer.ts, BoardCanvas.tsx, BoardUi.tsx, sync.ts (op transport), exportBoard.ts, persist.ts, kit.ts (templates), plus the specs. Read-only review; nothing was run in a browser. Everything below is from reading code.
All paths are relative to `features/learninghub/live/board/` unless stated.

## 1. What works

- Clean op model: every edit is an `upd`/`add`/`del` with last-writer-wins `v` and tombstones; permission is enforced in the reducer (reducer.ts:31, `mayEdit`), so a student can never touch another's work.
- Select tool: click, shift-click toggle, marquee, drag-to-move (multi), arrow-key nudge (4px / 20px with Shift), Delete, Ctrl+D duplicate, Esc. Newly drawn shapes / placed stamps / templates / images auto-select and switch to the select tool.
- Handles: line endpoints (p1/p2), shape corner (p2), resize for image / sticky / stamp (aspect-locked for image/stamp, correct in the rotated frame), rotate for ruler and protractor (Shift snaps 15 deg).
- Undo/redo: per-user action stack of inverse actions, 200 deep, group actions for multi-element moves, re-added elements get a fresh `v` so they beat their tombstone (reducer.ts:213). Clear-page is undoable.
- Zoom/pan: wheel zoom about the cursor, trackpad two-finger pan vs pinch heuristic (controller.ts:169), Space-drag, middle-button, pan tool, `+`/`-`/`0`, "fit to everything", K 0.15–6, resize-safe re-centring. Touch: two-finger pinch + pan, third finger ignored, 700 ms palm rejection after a pen touch, pointer capture, coalesced events, pen pressure, `touch-action:none`.
- Text/sticky: text tool click, double-click (mouse or double-tap) in select mode, click an existing text with the text tool; textarea overlay follows zoom; click-away and Ctrl+Enter commit; empty commit deletes; each keystroke re-renders (selftest guards it).
- Pages: add / delete (with confirm) / switch, tutor drives, students follow; "Clear page" undoable; per-page background.
- Persistence: load-before-save guard, merge of anything drawn while loading (persist.ts:36, controller.ts:277), 5 s debounce + `visibilitychange`/`pagehide`/unmount flush, stroke simplification to fit the 690 KB limit, error/toobig states surfaced.
- Export: PNG of the current page cropped to content (no selection overlays), shrinks scale then falls back to JPEG to stay under 700 KB; "save page / all pages (<=10) to lesson notes".
- Tests: e2e covers draw/reload/notes, live sync + permission, one template per pack, text/sticky editing, shapes/widgets; selftests cover reducer, controller gestures, sync, toolkit shape.

## 2. Concrete bugs (file:line)

Ordered by impact.

1. **Moving/nudging a stroke can silently fail to reach peers.** `moveSel` / `patchSelection(movePatch)` send the WHOLE `pts` array in one `upd` (controller.ts:579-587, 863; model.ts:283-286). `sliceBig` only slices `pts` ops, never `upd` (sync.ts:47-52); `packOps` then emits an oversized single op (reducer.ts:181-190). A handwriting stroke over ~200 points (~3.2 KB) exceeds the message cap and `raw()` swallows the error (sync.ts:186-192). Result: tutor drags a long stroke or a template containing paths (nets, matrix brackets); students see it stay put until the next snapshot. Also affects undo of such a move. Fix: send strokes' move as a translate op (`{op:"mov", dx, dy}`) or slice the `upd` into a `del`+chunked `add`.
2. **Duplicate of a grouped template joins the original group.** `duplicateSelection` spreads `...e` so `grp` is kept (controller.ts:734). Later click-select of any copy selects originals + copies (selectDown family, controller.ts:384) and they move together. `placeCopies` (controller.ts:785) remaps `grp` correctly; duplicate does not. Same line: every copy gets the same `z` (`topZ+1`), so relative stacking of a duplicated multi-selection is lost (ties fall back to id order).
3. **Bring-to-front flattens a multi-selection.** `bringToFront` patches every element to the same `z` (controller.ts:739), because the callback runs against un-updated state. Relative order of the selection becomes id-random. There is no send-to-back / forward / backward at all (BoardUi.tsx:183).
4. **Aborted shape / erase gestures are dropped.** `abortGesture` nulls `this.g` and then calls `pointerUp`, which returns immediately because `g` is null (controller.ts:461-467, 433-434). A shape being drawn when a second finger lands keeps its element but never gets the history entry, the tiny-shape cleanup or auto-select; an erase in progress is not undoable. `move` and `handle` gestures interrupted by pinch/`pointerCancel` are likewise never pushed to history (no case in `abortGesture`) though the ops were already sent, so the move cannot be undone.
5. **Two-finger pinch leaves a dot.** With the pen tool, finger 1 creates a 1-point stroke on pointerdown (controller.ts:345-347); the second finger calls `abortGesture` -> `finishStroke`, which keeps it and pushes it to history (controller.ts:531-538). The selftest titled "cancels a stray stroke" asserts nothing about it (controller.selftest.ts:127-136). Every pinch on iPad in pen mode leaves a dot. Fix: on abort, delete strokes with <=1-2 points and pop their history entry.
6. **Undo/redo diverges from peers when a "before" value was `undefined`.** `before[k] = cur[k]` (controller.ts:657, 705, 717, 728) and `actionOps` sends `patch: a.after` (reducer.ts:218). Locally `Object.assign` writes `undefined`; on the wire JSON drops the key, so peers keep the new value. Example: toggle Bold on template text whose `bold` was unset, then undo: tutor sees regular, students still see bold. Also affects `rot`, `fill`, `hl`. Fix: normalise undefined -> `null`/explicit default, or make `cleanPatch` treat null as delete.
7. **Undo is global across pages and silent.** History is one stack (controller.ts:75), not cleared or filtered on `setPage`; `undo()` never switches page (controller.ts:809). After navigating, Ctrl+Z changes the previous page invisibly and looks broken. After `deletePage`, stale actions are consumed as no-ops (history popped, nothing happens). Deleting a page is not undoable (controller.ts:216-222; only bg/clear are), though "Clear" is.
8. **Keyboard shortcuts only work while the canvas has focus.** Keys are on the surface div (BoardCanvas.tsx:79-83, 95). Any toolbar/palette click moves focus to the button, so Ctrl+Z, Delete, arrows stop until the board is clicked again. (Popup triggers `preventDefault` on mousedown, BoardUi.tsx:59, but chips/undo do not.) `spaceDown` is set on keydown and only cleared by keyup on the same element, so tabbing/clicking away while Space is held leaves pan-mode stuck (controller.ts:845, no blur reset).
9. **Rotated resize drifts.** Resize keeps `x,y` fixed while changing `w,h` in the unrotated frame (controller.ts:643-647), so the centre moves and a rotated ruler/stamp slides sideways while resizing. Needs to re-anchor the opposite corner.
10. **Escape behaves two ways.** In the textarea Escape commits (BoardCanvas.tsx:130); in `controller.key` Escape cancels (controller.ts:853). Tests document commit; users may expect cancel (undo of typed text is impossible before commit).
11. **Arrow-key nudge floods history/network.** Each key-repeat is a history entry + op + saveVersion (controller.ts:861-865); 200-deep cap is exhausted in seconds, evicting real history. Should coalesce within ~500 ms.
12. **Autosave can strand the last edit.** If a save is still in flight when the 5 s timer fires, `save` returns and never reschedules (persist.ts:57, 65). `pagehide`/unmount flush uses a plain `put` (no `keepalive`; `lib/api.ts` has none), so the final <=5 s of edits can be lost on tab close (persist.ts:91-95).
13. **Silent lossy save.** `fitToLimit` coarsens strokes in the saved copy only (model.ts:358-365, persist.ts:60); after reload strokes are simplified with no notice. Tombstones/`cleared` are not persisted (model.ts:349) — acceptable while snapshots reset peers, but a reconnecting student with old ops can resurrect deleted items.
14. **Export fallbacks.** If any picture taints the canvas the whole export is redone with NO images, silently (exportBoard.ts:46). PNG shrink loop can degrade legibility of small text before the JPEG fallback (exportBoard.ts:43-56). Only the current page is downloadable; "all pages" is notes-only and capped at 10 (exportBoard.ts:93).
15. **Marquee is enclose-only and ignores groups.** Only fully contained elements are selected (controller.ts:451) and the group family is not expanded, so a partial marquee over a template detaches pieces for a move. Marquee also grabs elements the user may not edit (they show selected but `orig` skips them, controller.ts:388).
16. **Sticky selection lacks controls.** `SelectionOptions` shows colour/size only for stroke/shape/text (BoardUi.tsx:171); a selected sticky cannot change colour or font size (the note-colour picker exists only for the sticky tool).

## 3. Gaps, ranked by teaching value

**A. Typing into / resizing template cells (the population-pyramid case)** — highest.

Current state, from code:
- The pyramid (geography.ts:24) is 34 unfilled `rect` shapes + 17 `text` labels + 2 headings, all with one shared `grp`. Tables (kit.ts:70-80) are worse: only `line` shapes plus free `text`; there are no cell objects at all.
- Shapes cannot hold text (`El.text` is only rendered for `text`/`sticky`; render.ts:443-444). The only ways to put words "in" a box are the Text tool (click inside the box; text lands top-left at the click point, unaligned, not clipped, does not move/resize with the box) or a sticky (a coloured card, not a cell).
- Double-click-to-edit only exists for `text` and `sticky` (controller.ts:383). Double-clicking an empty box does nothing; an unfilled rect is only hittable on its outline (model.ts:250-254), so a click inside starts a marquee.
- The group cannot be split: kit.ts:7 says "can be ungrouped to edit a single cell" but there is NO ungroup/group code or UI anywhere (grep: `grp` is only read in selectDown, drawSelection, placeCopies, duplicate). Click always selects the whole family, shift-click toggles the whole family, so an individual cell can never be selected, resized, shaded or deleted; you can only move/delete the entire template.
- No whole-template resize: multi-selection has no handles (`single: sel.length === 1`, controller.ts:888; `handlesOf` is per element). A template can't be scaled to fit the page or a page-sized worksheet.
- Even if a single cell were selectable it has one handle (p2, bottom-right; render.ts:495-498) and the Fill toggle is tool-only: `setUi({fill})` never restyles a selection (controller.ts:828-840), so an existing empty cell can't be shaded. Shading bars is exactly what pupils do on a pyramid.
- Rows/columns can't be added or resized; a table is not an object.

**B. Group / ungroup / enter-group** — templates are groups but users can't manage them (see A). Also no "group selection" for the tutor's own compositions.

**C. Copy / cut / paste (incl. across pages) and paste-image** — none. No clipboard handling anywhere in `live/`; only Ctrl+D within a page. A tutor can't reuse a diagram on the next slide (only "Save page as template" -> place from My templates). No Ctrl+A select-all. No drag-and-drop or Ctrl+V of an image.

**D. Z-order** — bring-to-front only (and buggy, see bug 3). Need send-to-back (worksheet image behind annotations is the top use), forward/backward, keyboard `]`/`[`.

**E. Handles on more objects** — rotation only exists for ruler/protractor (render.ts:499-501 and `rotates`); images, stickies, text and shapes have `rot` support in `boundsOf`/`hitTest` but `drawSticky`/`drawImage`/shape rendering ignore `rot`, so it isn't a small toggle. Text has no resize handle (only 4 size presets). Shapes have a single corner handle. Strokes have none. No multi-select scale/rotate/align/distribute. Lock element/lock background missing (a worksheet image gets dragged by accident).

**F. Multi-page / slides** — tabs show numbers only: no thumbnails, no reorder (the `pages` op exists in reducer.ts:41), no duplicate page, no page keyboard nav, no undoable delete. Students cannot browse pages (tabs disabled unless current). No per-page zoom memory.

**G. Touch/pen/iPad** — no multi-select without a Shift key (no toggle/"add" mode; marquee always replaces unless shift) so selecting several things on iPad is marquee-only; select-mode one-finger drag on empty canvas is marquee (pan needs two fingers or the pan tool) — fine but undiscoverable; palm rejection is only time-since-pen-down (controller.ts:323), not "pen currently down/hovering", so a palm landing during a long stroke (>700 ms) starts a second gesture and overwrites `this.g` (orphaning the stroke's hold timer); no Apple Pencil eraser-end / barrel-button (`buttons & 32`) mapping; Safari trackpad pinch uses gesture events, not `wheel+ctrlKey`, so it likely pans instead of zooming (unverified).

**H. Text editing depth** — no alignment, no wrap width for plain text (only manual newlines; wrapping exists for stickies), no formatting beyond bold/size, no rotation of the edit overlay for rotated items, no spellcheck toggle for language lessons (languages pack), editing overlay ignores sticky rotation.

**I. Export** — PNG only. No PDF / multi-page PDF / print, no full-sheet export for lined/squared pages (crops to content), no "export selection", no transparent background, no whole-board download.

**J. Persistence/collab** — whole-document PUT every 5 s (up to 690 KB); no versioning / restore; no dead/cleared persistence (see bug 13).

**K. Test coverage** — no test for marquee, multi-select, resize/rotate handles, groups, duplicate, z-order, keyboard shortcuts beyond undo (e2e/learning-hub-board-ui.spec.ts, controller.selftest.ts), export (PNG) or pinch-leaves-dot. No test of moving a >250-point stroke over the sync pack path (sync.selftest.ts).

## 4. Prioritised build list (with sequencing hints)

Files-touched columns are what a lead needs to avoid merge conflicts. controller.ts and BoardUi.tsx are the hot files; group edits to them into ONE owner/PR sequence.

| # | Item | Size | Files |
|---|------|------|-------|
| 1 | Fix stroke-move oversize `upd` (bug 1): add `mov` op, or slice `upd`s, + selftest with a 500-pt stroke | M | model.ts (Op), reducer.ts (apply + `movePatch` use), sync.ts (`compact`/`sliceBig`), controller.ts (moveSel, patchSelection), sync.selftest.ts |
| 2 | Group / ungroup / enter-group (double-click a grouped cell selects just that member; Ctrl+G / Ctrl+Shift+G; drawSelection group box stays) + fix duplicate `grp` remap (bug 2) | S-M | controller.ts (selectDown, duplicateSelection, key), BoardUi.tsx (SelectionOptions buttons), render.ts (none/optional), boardIcons.tsx |
| 3 | Text inside shapes (`El.text` on rect/ellipse/poly): render centred + wrapped, dbl-click / Enter to type, rect-with-text hit-tests as filled, textarea overlay sized to the shape; size-to-fit | M | render.ts (drawShape), model.ts (hitTest, boundsOf helper), controller.ts (beginEdit/commitEdit, dbl-click), BoardCanvas.tsx (TextEditor placement), BoardUi.tsx (font size for shapes) |
| 4 | Selection styling for existing shapes: Fill toggle + fill colour applied to a selection (`setUi({fill})` -> patchSelection); sticky colour/size in SelectionOptions | S | controller.ts (setUi), BoardUi.tsx (SelectionOptions/OptionsBar) |
| 5 | 8-handle resize for rect/ellipse/poly + bounding-box handles for multi-selection/group (scale positions and sizes, strokes scale pts) | M-L | render.ts (`handlesOf`, `drawSelection`), controller.ts (selectDown, handleMove, finishHandle), model.ts (scale patches) |
| 6 | Z-order: send to back / forward / backward, unique z per element, fix bring-to-front + duplicate z (bug 3) | S | controller.ts (bringToFront + new), BoardUi.tsx, boardIcons.tsx |
| 7 | Copy / cut / paste (in-page, cross-page, system clipboard JSON) + Ctrl+A; paste image from clipboard | M | controller.ts (clipboard, key), BoardCanvas.tsx (paste/copy events), model.ts (serialise), LessonBoard.tsx (image upload path) |
| 8 | Gesture abort fixes (bugs 4, 5): finalise move/handle/shape/erase on abort; drop 1-point stroke on pinch; palm rejection while pen is down | S | controller.ts (abortGesture, pointerDown), controller.selftest.ts (assert dot gone) |
| 9 | Undo hardening: normalise undefined `before` values (bug 6), per-page history or switch to the action's page on undo (bug 7), undoable page delete, coalesce arrow nudges (bug 11) | M | reducer.ts (Action/invert, actionOps), controller.ts, model.ts (Action page ops), reducer.selftest.ts |
| 10 | Focus/keyboard robustness (bug 8): board-level key listener that ignores inputs, blur resets `spaceDown`; Escape consistency (bug 10) | S | BoardCanvas.tsx, BoardShell.tsx, controller.ts (key) |
| 11 | Real "table" object (rows/cols add/resize, cell text) or rebuild table/pyramid templates as text-in-shape cells so items 2, 3, 5 apply; pyramid bars as separate resizable bars | L (after 3,5) | kit.ts (`B.table`), geography.ts, general.ts, english.ts, languages.ts, history.ts, maths.ts, toolkit.selftest.ts |
| 12 | Rotation for image/sticky/text/shape (render with `rot`, rotate handle, rotated editor) + lock element | M | render.ts (drawSticky/drawImage/drawShape), controller.ts, model.ts, BoardCanvas.tsx |
| 13 | Pages: thumbnails, reorder, duplicate, keyboard nav; students can browse read-only | M | BoardUi.tsx (PageTabs), controller.ts (pages ops), reducer.ts (`pages` already exists), LessonBoard.tsx |
| 14 | Persistence/export: retry-after-inflight, `keepalive`/beacon on pagehide, warn on lossy simplification, PDF/all-pages download, full-sheet export, image-taint fallback message | M | persist.ts, exportBoard.ts, lib/api.ts (keepalive option), BoardUi.tsx (MoreMenu) |
| 15 | Marquee intersect mode (Alt/two modes), group expansion, "select multiple" toggle for touch | S | controller.ts, BoardUi.tsx |
| 16 | Test debt: e2e specs for marquee, multi-move, group/ungroup, resize, duplicate, z-order, copy/paste, template-cell typing; selftests for abort, undo across pages | M | e2e/learning-hub-board-ui.spec.ts (or new spec), controller.selftest.ts |

Suggested sequencing to avoid conflicts: (1) and (8) first (small, controller/sync only, correctness); then (2)+(4)+(6) as one controller/BoardUi PR; then (3) and (5) (render.ts/controller.ts heavy, must be serial); (7) and (9) touch reducer/controller and should follow; (11) last because it depends on 2/3/5. Items 10, 13, 14 are largely independent of the above (BoardCanvas/BoardShell, PageTabs, persist/export) and can run in parallel with the render.ts work.

## 5. Direct answer: template cells (population pyramid)

- Are cells typeable? Only indirectly: Text tool click inside the box makes a free text element at the click point; it is not attached to the box, isn't centred, and won't follow when the template is moved unless it is also inside the group (new text is NOT added to the group). After moving the template the typed text stays behind.
- Resizable? No: the group can't be scaled and members can't be selected individually (no ungroup; kit.ts:7 promises it, code doesn't provide it).
- Minimum viable fix: items 2 (enter-group/ungroup) + 3 (text in shapes with double-click) + 4 (fill on selection) — S+M+S — makes the pyramid, KWL boxes and any box template usable; item 5 adds resize.
