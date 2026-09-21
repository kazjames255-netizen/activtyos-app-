# Board review 01 — Drawing tools and shapes

Scope: `features/learninghub/live/board/` (controller.ts, render.ts, model.ts, reducer.ts, BoardUi.tsx, BoardCanvas.tsx, ToolkitPop.tsx, toolkit/*), `server/src/routes/hub/boardsApi.ts`, and the existing e2e/selftests. Code audit only; nothing was run and no source was edited. Paths below are relative to `features/learninghub/live/board/` unless they start with `server/` or `e2e/`.

## Verdict on the owner's complaint (templates are empty boxes)

The complaint is correct. There are three separate causes, and none of them is a bug in the pyramid alone.

1. **A shape cannot hold text.** `El.text` is only used by `text` and `sticky` (model.ts:65). `drawShape` (render.ts:237-269) draws no label. `B.rect()` (toolkit/kit.ts:46) makes a plain outline. The population pyramid (toolkit/geography.ts:24) is 34 unfilled `b.rect` calls, plus the age labels and two headings. A cell has nothing to type into.
2. **Typing into a cell means placing a loose text element on top of it.** Loose text has these problems:
   - The Text tool creates a top-left-anchored block at a fixed 20/28/40/60px (controller.ts:365). A pyramid row is 26px high, so 28px text overflows it.
   - It does not centre in the cell, does not follow the cell if the cell moves, and cannot wrap.
   - An unfilled rect is only hit on its outline (model.ts:250-254), so clicking inside a cell never targets the cell.
3. **Cells cannot be resized or moved individually.**
   - Every template element carries one shared `grp`. `selectDown` (controller.ts:384-386) selects the whole family on any click, and shift-click toggles the whole family.
   - There is no ungroup and no group-enter. The comment in kit.ts:8 ("can be ungrouped to edit a single cell") describes a feature that does not exist; `grep` finds no ungroup anywhere.
   - Resize handles are drawn only when exactly one element is selected (controller.ts:376, render.ts:484). A selected group has no handle at all, so a template cannot be scaled either.
   - Closed shapes get one handle, bottom-right `p2` (render.ts:494-498). There is no top-left or edge handle.

Other templates share the problem. `geo-water` builds four dashed answer boxes, and its label strings are discarded with `void t` (geography.ts:21). `geo-rock` has three empty dashed boxes (geography.ts:22). The `b.table()` builder (kit.ts:60-70) makes cells that are only lines with loose centred text, so empty cells are again nothing.

## 1. What works

- **Pen.**
  - Quadratic smoothing (render.ts:153-164) and per-point pressure for a stylus (controller.ts:344).
  - Hold still for 650ms to straighten the line (controller.ts:485-509). Shift snaps the angle to 15 degrees.
  - Palm rejection for touch while a pen is in use (controller.ts:323). Two-finger pinch aborts the stroke.
  - Pen styles solid / dotted / neon / rainbow (render.ts:176-200) are stored on `sty` and survive the server schema (boardsApi.ts:44).
  - The highlighter uses multiply blending at 0.4 alpha and butt caps (render.ts:210).
- **Shapes.**
  - 13 shapes in one popover (BoardUi.tsx:22-26). All are stored as two corner points, so they stay vector and resizable via `p2`.
  - Shift gives a straight or 15-degree line, or a square or circle (controller.ts:546-549).
  - Closed shapes take fill and dashed. Hit-testing follows the polygon outline for rect, ellipse and all poly shapes, and fill makes the interior hittable (model.ts:247-266).
  - Line-type shapes have `p1` and `p2` handles, so an arrow can be re-aimed.
  - A zero-size click-drag leaves nothing behind (controller.ts:440-441).
- **Eraser.** Live, replicated deletes with tombstones. An undo restores the whole drag as one action (controller.ts:446). A student can only erase their own work (`mayEditEl`, controller.ts:319).
- **Text and sticky.**
  - Click to create. Click-away, Esc or Ctrl+Enter commits. Double-click, or the text tool on an existing item, edits it.
  - Editing an emptied item deletes it. The size and bold presets apply to a selected text element.
  - The textarea is positioned in world space, so it follows zoom (BoardCanvas.tsx:100-131).
  - Toolkit "Characters" inserts into the open editor (`insertChars`, controller.ts:790).
- **Select.** Marquee, shift-multi, arrow-key nudge (4px, or 20px with Shift), Ctrl+D duplicate, bring-to-front, Delete. Ruler and protractor rotate by handle.
- **Undo/redo** covers add, delete, update, group, background and clear.
- **Permissions and sync.** `reducer.ts` re-checks ownership on every remote op, `cleanPatch` blocks changes to identity fields, and last-writer-wins on `v` is deterministic.
- **Test coverage.** controller.selftest.ts covers Shift-square, tiny-drag cleanup, eraser permissions, new-shape hit-testing and fill/dash. e2e/learning-hub-board-ui.spec.ts covers text/sticky flows and the star/bubble/pen-style round trip, including the server not stripping fields.

## 2. Concrete bugs

Ordered by classroom impact.

1. **Duplicate keeps `grp`, so a copy is glued to the original.** controller.ts:734 spreads `...e` and never reassigns `grp`. After Ctrl+D on a template, clicking either copy selects both, and dragging moves both. `placeCopies` (controller.ts:784-785) does this correctly with a fresh `grp`; `duplicateSelection` should do the same.
2. **The eraser deletes whole images, stamps and template lines it merely crosses.** `eraseAt` (controller.ts:562) runs `hitTest` on every element. The default branch of `hitTest` (model.ts:272-277) is a filled rectangle test, so wiping across a periodic table, a map, a picture or a coordinate grid deletes it. It also removes single grid lines from a template, because each line is its own element, while the rest of the group stays. The eraser bar says "Rub out whole drawings" (BoardUi.tsx:142), which is not how images behave. A child rubbing out a scribble can destroy the tutor's worksheet page; undo brings it back as one step, but it is easy to miss.
3. **A filled triangle cannot be selected or erased by its interior.** The triangle branch of `hitTest` (model.ts:267-269) ignores `e.fill`. Rect, ellipse and poly shapes honour it. There is also no selftest for it.
4. **`abortGesture` never finishes a shape or erase gesture.** controller.ts:461-466 sets `this.g = null` and then calls `pointerUp(...)`, which reads `this.g`, finds null and returns. A two-finger touch during a shape drag leaves a zero-size shape, which draws as a dot for line shapes because of round caps. It is not in history and is never cleaned up. An interrupted erase never pushes its history entry, so it cannot be undone.
5. **Style changes made while editing existing text are lost.** `setUi` updates `this.editing.{c,size,bold}` (controller.ts:838), but `commitEdit` for an existing element only patches `text` (controller.ts:690). Changing size or colour while editing an existing text element does nothing.
6. **Selected shapes cannot be re-filled, made dashed or re-styled.** `setUi` ignores `fill`, `dashed` and `penStyle` for a selection (controller.ts:828-837), and `SelectionOptions` shows no such buttons (BoardUi.tsx:170-189). Fill and dash can only be chosen before drawing. A recolour of a filled shape forces `fill = colour` (controller.ts:832).
7. **Selecting a template and clicking a colour recolours everything.** controller.ts:832 patches every stroke, shape, text and stamp in the selection. It destroys a template's deliberate colour coding, for example the pyramid's blue and red headings. The colours row is shown for any mixed group (BoardUi.tsx:173).
8. **Sticky note controls are missing.** Sticky is excluded from `styled` (BoardUi.tsx:173), so a selected note has no colour swatches. `setUi({stickyColour})` handles a selected sticky (controller.ts:836) but nothing calls it. Sticky text is fixed at 22px bold, with no size control (controller.ts:366), clipped without warning, and never auto-fit (render.ts:301-302).
9. **"Regular" shapes are not regular.**
   - Hexagon is hard-coded at u=0.25/0.75 (model.ts:208). A regular hexagon has an aspect of 1:0.866, so Shift-square gives a visibly squat hexagon.
   - Pentagon and star go through `fit()` (model.ts:199-204), which stretches to the drag box. Shift-square does not give a regular pentagon either (regular is 1:0.951).
   - Triangle Shift-square gives a tall isosceles triangle, not an equilateral one.
   - This matters for KS1-3 shape-properties teaching.
9b. **Triangles cannot point any other way.** All shapes are normalised with `min/max`, so there is no orientation. The right triangle always has its right angle at bottom-left (model.ts:207). There is no scalene, obtuse or upside-down triangle, and shapes have no `rot` (only stamps rotate, render.ts:503).
10. **The shape tool drops back to Select after every shape** (controller.ts:442). Drawing five arrows for a diagram costs five popover round-trips. The tool should stay active, with double-click or Esc to leave.
11. **Text tool over a shape.** `hitAt` (controller.ts:363) returns the topmost hit element. A click on the outline of a shape creates a new text box instead of labelling it; a click inside an unfilled shape misses it entirely. This is the direct cause of the "cells can't be typed in" behaviour.
12. **Text elements are not resizable.** `handlesOf` (render.ts:499) gives handles only to image, sticky and stamp. Text size is limited to the four presets (model.ts:372), with no wrap width, alignment, italic or underline. The typing box on a sticky uses `resize-none`.
13. **Undo of a move of a group** stores one `upd` per element inside a `group` action (controller.ts:593-602). It works, but with the 34+ elements of a template it is a large op fan-out per drag tick (`moveSel` queues one `upd` per element per pointermove, controller.ts:579-587) and can flood the call channel. A group needs a parent transform, or throttling.
14. **The server drops unknown fields silently.** The element schema in server/src/routes/hub/boardsApi.ts:35-61 is a plain `z.object`, so any new El field is stripped on save. Every item below that adds a field must be added there, as well as in model.ts, or it disappears on reload. `opts` keys are capped at 20 chars and string values at 4000 (boardsApi.ts:60), which rules out a JSON-in-opts table for anything large.

## 3. Missing tools, ranked by teaching value

1. **Text inside shapes and typeable cells.** The owner's complaint; every framing template depends on it. Needs a centred, wrapped label on a shape, edited by double-click or the Text tool, with the label following the shape.
2. **Resizable single cells / ungroup / group scale.** Without this a tutor cannot make a row taller or resize a template to fit the lesson.
3. **Snapping.**
   - Today the only snap is Shift at 15 degrees or square. There is no snap to the grid or dot grid, which every maths and geography use case needs (bar charts, polygons on squared paper, number lines, coordinate plotting).
   - Grid sizes already exist: GRID 40 (render.ts:49), dotgrid 32, isometric 36, handwriting/tianzige 100.
   - Also missing: snap to shape edges and centres, and smart guides so cells line up.
4. **Opaque fill and separate fill and stroke colour.**
   - Fill is a 22% alpha wash of the stroke colour (render.ts:266). There is no solid fill, no "no outline", and no independent fill colour.
   - Needed for shading fractions and area on a grid, colouring shapes for early years, and Venn overlaps.
5. **Geometry kit.** Missing shapes and tools:
   - True regular n-gon (3-12 sides, honouring Shift).
   - Equilateral, scalene and obtuse triangles; parallelogram, trapezium, kite, rhombus.
   - Semicircle, sector and arc.
   - Angle marker with a degree label; right-angle box; equal-side ticks; parallel arrows.
   - Length and angle readout while drawing a line.
   - 3D solids (cube, cuboid, cylinder, cone, prism), which sit naturally on the existing isometric background.
6. **Connectors.** Arrows that attach to shapes and follow them. Flowcharts, mind maps and food webs are all made from loose arrows (`toolkit/general.ts`, `toolkit/science.ts`), and moving a box orphans its arrows.
7. **Table element.** Rows and columns, add and remove, drag column and row borders, per-cell text, header row. It replaces the line-and-loose-text tables in `b.table()` and lets the tutor build KWL charts, results tables and conjugation tables live.
8. **Shape recognition on the pen.** After the hold-to-straighten pause, snap a rough circle, rectangle or triangle to a clean shape. Kids love it and it is quick for a tutor.
9. **Eraser modes.** Stroke-only (leave images, stamps and templates alone) versus everything, and optionally partial-stroke erase.
10. **Z-order and lock.** Send to back, forward and back one step, and lock (so a worksheet image or template cannot be dragged by accident while students draw on it).
11. **Text upgrades.** Alignment, wrap width via a handle, a friendly handwriting font for early years, superscript and subscript, fractions. Text style in the shape label follows the same controls.
12. **Line styles.** Arrowhead choices (open, filled, none, dot), line dash on selection, and a curved or elbow connector.
13. **Freehand smart eraser and a pointer trail** — nice to have, not needed.

## 4. Prioritised build list

Sizes: S under half a day, M about a day, L multi-day. "Hot files" are conflict risks when several people edit at once: `controller.ts`, `BoardUi.tsx`, `render.ts` and `model.ts` are each touched by most items. A lead should give one person ownership of each hot file per wave, or run these in the wave order below.

| # | Item | Size | Files touched |
|---|---|---|---|
| A | Bug fixes 1, 3, 4, 5, 8, 10 (duplicate `grp`, filled triangle hit, abortGesture, style-on-edit, sticky colour and size control, keep the shape tool active) | S-M | controller.ts (lines 734, 461-467, 690, 442, 836), model.ts (triangle branch, lines 267-269), BoardUi.tsx (SelectionOptions) |
| B | Text inside shapes (`El.text` on `k:"shape"`) | M | model.ts (`textBox`, `hitTest`), render.ts (`drawShape` label: centred, wrapped, `size`/`c`/`bold`), controller.ts (`beginEdit`, `commitEdit`, text-tool branch of `pointerDown`, double-click in `selectDown`), BoardCanvas.tsx (`TextEditor` kind `"shape"`: centred over the shape's box), toolkit/kit.ts (`rect`/`ellipse`/`shape` accept `text`), server boardsApi.ts (no change: `text` is already in the schema, max 2000) |
| C | Fix the empty-template problem in the toolkit (depends on B) | S-M | toolkit/geography.ts (pyramid: real filled bars from a data param `male, female per band`, axis ticks, and a value cell per row; water cycle and rock cycle: use the discarded labels as box text), toolkit/general.ts, science.ts, languages.ts, english.ts, history.ts (replace empty `b.rect` answer boxes with `b.rect(..., {text})`); extend `toolkit.selftest.ts` to fail on an empty closed shape without a `text` or `dash` reason |
| D | Ungroup and single-cell selection | M | controller.ts (`selectDown`: double-click inside a group enters it, or Alt-click selects one element; `ungroupSelection`/`regroup` with Ctrl+Shift+G / Ctrl+G; fix the `move` fan-out in `moveSel` by batching or throttling), BoardUi.tsx (SelectionOptions: Group/Ungroup buttons), render.ts (`drawSelection` group box), reducer.ts (no change; `grp` already patchable) |
| E | Group scale handle and resize handles for every shape corner | M-L | render.ts (`handlesOf`: 4 corners + edge midpoints for closed shapes, a group-box corner for groups), controller.ts (`handleMove` for `nw/ne/sw/n/e/s/w` and a group-scale gesture that scales each member: shapes by their points, strokes by `pts`, text by `size`, stamps and stickies by `w/h`), model.ts (a `scalePatch(e, sx, sy, ox, oy)` next to `movePatch`) |
| F | Snapping (grid, edges, centres, guides) | M | controller.ts (`shapeMove`, `handleMove`, `moveSel`, `insertX`: one `snap(x, y)` helper reading `curPage.bg`), render.ts (guide lines overlay, exported grid size per `BgKind`), BoardUi.tsx (Snap toggle in the options bar and top bar), model.ts (`snapStep(bg)`) |
| G | Fill and stroke colours, solid fill, no outline, selection restyle | M | model.ts (`El.fill` stays a colour; add `El.fa?: number` alpha or `El.nostroke?`), boardsApi.ts (new fields in the element schema), render.ts (`drawShape` fill alpha and no-stroke), controller.ts (`UiState.fillColour`, `setUi`, `patchSelection` for fill/dash), BoardUi.tsx (a second swatch row for fill, dashed and fill on `SelectionOptions`) |
| H | Geometry kit: `ngon` tool (sides 3-12, regular under Shift), triangle types, quadrilaterals, arc and sector, angle marker | M-L | model.ts (`ShapeKind` + `polyPoints` cases, new `El.n` sides), boardsApi.ts (shape enum + `n`), render.ts (draw arcs, angle markers), controller.ts (`isShapeTool`, key map, per-shape options), BoardUi.tsx (`SHAPES` list + sides stepper), boardIcons.tsx (icons), controller.selftest.ts |
| I | Vertex-editable polygon (click to add vertices, drag any vertex) | M-L | model.ts/`El.pts` reuse with `shape:"poly"`, controller.ts (gesture, handles), render.ts (vertex handles), boardsApi.ts (shape enum). Delivers scalene, obtuse and any irregular shape without a fixed list, so it can replace half of H |
| J | Eraser modes | S-M | controller.ts (`eraseAt` filter by kind and `grp`), BoardUi.tsx (eraser bar: "Drawings only / Everything"), controller.selftest.ts |
| K | Z-order (send to back, forward, back) and lock | S-M | controller.ts (`sendToBack`, `lock` as `El.lock`), model.ts (`El.lock`), boardsApi.ts (new field), BoardUi.tsx (SelectionOptions buttons), render.ts (lock badge) |
| L | Connectors (attach to shape ids, follow on move) | L | model.ts (`El.from`/`El.to` with an anchor side), boardsApi.ts (fields), render.ts (compute endpoints from bound shapes), controller.ts (drag an arrow endpoint onto a shape to bind; `moveSel` re-routes), reducer.ts (deleting a shape unbinds), boardIcons.tsx |
| M | Table element (real rows/cols, typeable cells, drag borders, add/remove) | L | model.ts (`StampKind` `"table"`, `opts.rows/cols`, cell data), boardsApi.ts (raise the `opts` string cap or add a `cells` array field; the current 4000 cap will not hold a large table), render-stamps.ts (draw), controller.ts (cell hit and edit, border drag), BoardUi.tsx (StampOptions: add and remove row/col), toolkit/kit.ts (`table()` emits it), toolkit/* (adopt it); needs B first |
| N | Pen shape recognition | M | controller.ts (`finishStroke`: recogniser on the hold-still path), a new `recogniseShape.ts` (pure), controller.selftest.ts |
| O | Text upgrades (alignment, wrap width via handle, italic and sub/superscript, handwriting font for early years) | M | model.ts (`El.align`, `El.tw`), boardsApi.ts (fields), render.ts (`drawText`), controller.ts, BoardCanvas.tsx (`TextEditor`), BoardUi.tsx, theme.ts |
| P | Line styles and arrowhead choices, angle/length readout | S-M | model.ts (`El.ah`), boardsApi.ts, render.ts (`drawShape`), controller.ts (readout during `shapeMove`), BoardUi.tsx |

### Suggested sequencing to avoid conflicts

- **Wave 1 (one person on controller.ts and model.ts):** A, then B, then C. B unblocks C and M. C is the fix the owner asked for and should ship first after B.
- **Wave 2:** D and E (both mostly `controller.ts` and `render.ts` selection code, so one owner), then J and K (small, safe, same owner or a second person on BoardUi.tsx only).
- **Wave 3:** F and G. Both touch `BoardUi.tsx` options bars and `render.ts` `drawShape`, so do not run them in parallel with H.
- **Wave 4:** H or I, N, P, O. All change `ShapeKind` or `El` and the server schema, so decide the new El fields once up front (`n`, `fa`, `ah`, `align`, `lock`, `from`/`to`) and add them to model.ts and boardsApi.ts in one commit to avoid repeated schema churn.
- **Wave 5:** L and M. They are the largest and depend on B, D and E.
- Any new El field needs the server zod change in `server/src/routes/hub/boardsApi.ts:35-61` plus an e2e check that it survives a save and reload. The star/bubble test at e2e/learning-hub-board-ui.spec.ts:448-451 shows the pattern.

## Test gaps to close alongside the work

- controller.selftest.ts has no case for filled triangle hit-testing, duplicate-of-group, `abortGesture` during a shape, or editing style while a text element is open.
- No e2e covers typing into a template cell, resizing a cell, ungroup, or the eraser on an image or stamp. New e2e should follow the AGENTS.md rule: assert against this run's own element (`cardWith`-style anchoring), not a stale row.
- `toolkit.selftest.ts` only checks that elements are grouped (line 36). Add "no template ships a closed shape that is meant for input without a `text` slot".
