# 03 - Maths toolkit review (KS1 to A-level)

Scope: `features/learninghub/live/board/toolkit/maths.ts` (+ `kit.ts`, `general.ts`, `geography.ts` where relevant), stamp renderers in `render.ts:337-436` and `render-stamps.ts`, `ToolkitPop.tsx`, and the interaction rules in `controller.ts` / `model.ts` / `reducer.ts`. Read-only review; nothing was run in a browser, so every finding below is from reading code (arithmetic on net geometry was done by hand). Line numbers are current at review time.

Terms used. **Stamp** = one element with its own draw routine and `opts` (number line, fraction bar, coord grid, times-table, clock, ruler, protractor, plot). **Template** = many primitive elements (lines, rects, text) sharing one `grp` id, built by `B` in `kit.ts`. This distinction drives most findings.

## 0. Cross-cutting findings (these affect almost every tool)

1. **Templates cannot be resized or rotated.** Resize/rotate handles only appear when exactly one element is selected (`controller.ts:376`; `handlesOf` in `render.ts:494`). Clicking any piece of a template selects the whole `grp` family (`controller.ts:384`), so a template is move-only. Affects: 100 square, ten frame, place-value chart, bar model, array, tables, trig triangle, circle parts, nets, bar-chart frame, scatter axes, box plot, matrix, Venn, population pyramid.
2. **There is no ungroup command.** `kit.ts:7` says templates "can be ungrouped to edit a single cell"; grep finds no ungroup anywhere. The only way to edit one part is a marquee that fully encloses just that part (`controller.ts:451`), which is undiscoverable.
3. **Empty cells/boxes are not typeable.** Table cells, place-value columns, ten-frame boxes, the population pyramid (34 empty rects, `geography.ts:24`) are plain line shapes. Double-click only edits `text`/`sticky` (`controller.ts:364,383`). With the Text tool, a click in a cell creates a left-anchored text at the click point, not centred and not snapped. This fails the "empty boxes must be typeable and resizable" requirement outright.
4. **Only ruler and protractor rotate.** `rotates: true` is set only for those two (`model.ts:322-323`); rotate handle is added only for them (`render.ts:500`). Clock, number line, coord grid, plot cannot be rotated (vertical number lines, angled protractor-style tools are impossible).
5. **Stamp resize locks aspect ratio** (`controller.ts:646`). A number line cannot be made longer without also becoming taller; ruler 10:1 is stuck.
6. **Children cannot use any tool.** Toolkit button is tutor-only (`BoardUi.tsx:57`); students' allowed element kinds exclude stamps (`reducer.ts:20`); students cannot even shade a fraction bar or move the tutor's ruler (`mayEditEl`, `controller.ts:319`). Their pad has pen/shape/text only. No child-driven manipulatives exist.
7. **No snapping.** No snap-to-grid for shapes/points (only 15-degree angle snap, `controller.ts:503`). On squared paper / coordinate grid a child's point or line lands off-grid.
8. **Toolkit search is per-pack** (`ToolkitPop.tsx:45`): searching "tally" or "dice" while in Maths does not find items in General. No `tags` are set on any maths item, so "counter", "coordinate", "shape", "angle" find nothing.
9. **No thumbnails** in the picker (`ToolkitPop.tsx:132-141`): text-only tiles, poor for pre-readers or fast scanning.
10. **Self-test checks only that numbers are finite and elements are valid** (`toolkit.selftest.ts:33-46`); it cannot catch the geometrically wrong nets below.

## 1. Inventory of existing maths tools

Legend: Move = draggable; Rot = rotatable; Size = resizable; Type = empty parts typeable. "Group" = template (see section 0).

| Tool (id) | Kind | Works? | Accurate? | Child-usable (as tutor-driven aid) | Move | Rot | Size | Notes |
|---|---|---|---|---|---|---|---|---|
| Number line `m-numberline` | stamp | Yes | Yes; count rounding quirk (bug B6) | Good: big numerals, opts bar (from/to/by) | Y | N | Y (ratio locked) | No jumps/arcs, no marker, no hidden-number mode, no fraction labels |
| Fraction bar `m-fractions` | stamp | Yes | Yes | Good: tap a part to shade | Y | N | Y (ratio locked) | Parts 2,3,4,5,6,8,10,12 only. Label "1/N each" (B9). Tutor-only shading |
| Fraction wall `m-fracwall` | 9 stamps | Yes | Yes | OK; each row is separate, 32px tall bars | Y (each row) | N | Y (each) | Rows 1,2,3,4,5,6,8,10,12. No 7, 9, 11. Not grouped as one object |
| Coordinate grid `m-coord` | stamp | Yes | Mostly (B7) | Fair | Y | N | Y | Range 5/10/15/20. No axis names, arrows, origin "0", quadrant labels; no point plotting |
| Times-table grid `m-times` | stamp | Yes | Yes | Good | Y | N | Y | Answers always visible; no highlight/hide mode |
| Clock face `m-clock` | stamp | Yes | Yes (hour hand creeps correctly) | Weak: hands set only from toolbar selects, 5-min steps | Y | N | Y | No drag-hands, no digital readout, no 24h, no Roman, no minute-number ring |
| Ruler `m-ruler` | stamp | Yes | Yes: 40 units = 1 cm = one squared-paper square (`GRID=40`) | Good | Y | Y | Y (ratio locked) | Top edge only, cm only (no mm numbers, no inches) |
| Protractor `m-protractor` | stamp | Yes | Partly (B3, B4) | Fair | Y | Y (about bbox centre, B4) | Y (ratio locked) | Single 0-180 scale, left to right |
| Graph plotter `m-plot` | stamp | Yes | Yes for y=f(x) | Tutor-level; typed expression | Y | N | Y (square only) | Radians only; x and y range forced equal; labels overlap at large range (B8) |
| 100 square `m-hundred` | group of 200 elements | Yes | Yes (1-100) | Good numerals | Y | N | N | No cell highlight/shade; hide-a-number only via eraser |
| Ten frame `m-tenframe` | group of 10 rects | Yes | Yes (5 wide x 2 high) | Empty; no counters | Y | N | N | Nothing to put in it except drawn dots |
| Place-value chart `m-placevalue` | group (table) | Yes | Partly (B10) | Headers only; cells not typeable | Y | N | N | H T U / Th H T U / M HTh TTh Th H T U; no decimals |
| Bar model `m-bar` | group | Yes | Equal parts only | Label "total" editable; part boxes not typeable | Y | N | N | No unequal / comparison model |
| Array (dots) `m-arrays` | group of dots | Yes | Yes | Good | Y | N | N | Up to 10 x 12; no "3 x 4 =" caption |
| Right-angled triangle `m-trig` | group | Yes | Yes | OK | Y | N | N | Right-angle mark, O/A/H labels and SOH CAH TOA formulae are correct; labels not rotated to sides; no lengths |
| Circle parts `m-circle` | group | Partly | No: "chord" points at nothing (B5) | Weak | Y | N | N | No arc/sector/segment/tangent/centre point |
| 3-D nets `m-nets` | group | Cube only | 3 of 4 wrong (B1, B2, B3n) | Misleading | Y | N | N | Cube is a valid cross net |
| Bar chart frame `m-stats-bar` | group | Yes | Fixed 0-20 scale in 2s | OK; category labels editable | Y | N | N | Cannot re-scale axis; no draggable bars |
| Scatter axes `m-scatter` | group | Yes | Unlabelled ticks | Fair | Y | N | N | Tutor must type all numbers |
| Box-plot number line `m-boxplot` | group + stamp | Static picture | Arbitrary quartiles | Poor | Y | N | N | Box/whiskers not data-linked and cannot be nudged without marquee |
| Matrix / table frame `m-matrix` | 2 bracket strokes | Brackets only | Yes | Poor: no cells | Y | N | N | Named "table frame" but draws no grid |
| Backgrounds: squared, graph (+/-10), number line page (+/-10), isometric dots | bg | Yes | Yes | Good | n/a | n/a | n/a | Graph/number-line bgs are fixed at +/-10 and fixed page position; isometric is dots only |
| General pack, used by maths tutors: Table, Venn 2/3, Flowchart, Timer, Dice (d6, 1-2), Spinner, Score counter, Stickers | mixed | Yes | n/a | Good | Y | N | Stamps Y, groups N | "Score counter" (`g-tally`) shows a digit, not tally marks |
| Maths symbols palette `symbols.ts:9` | chars | Yes | Yes | Good | n/a | n/a | n/a | Lacks fraction/root/vector typesetting: no stacked fractions, no x^n in place |
| Shapes tool (line, arrow, rect, ellipse, triangle, rtriangle, diamond, pentagon, hexagon, star...) | primitives | Yes | Yes | Good | Y | N | Y (2-point handle) | No arc, no angle mark, no shape rotation, no regular n-gon |

## 2. Bugs (with file:line)

Severity: H = teaches something wrong or blocks a stated requirement; M = wrong or awkward in normal use; L = polish.

| # | Sev | Location | Bug |
|---|---|---|---|
| B1 | H | `toolkit/maths.ts:22` | **Cuboid net is not foldable.** Strip faces are 90 wide with heights 72/90/72/90 (h = 0.8u). The two end caps should therefore be 72 wide x 90 tall, but are `w = u*1.4 = 126` wide. Side faces do not match the edges they meet. Cube (w=h=u) is correct. |
| B2 | H | `toolkit/maths.ts:23` | **Triangular prism net: the second triangle is upside down.** `b.tri(u*2.8, u*1.6, u*4.2, u*2.8)` uses the only triangle primitive (apex top, base bottom), so it touches the third rectangle at its apex instead of along its base. Not a valid net. |
| B3n | H | `toolkit/maths.ts:24` | **Square-based pyramid net: 3 of 4 triangles mis-oriented.** Only the top triangle sits on its base. The right and left triangles are apex-up boxes that touch the square at a corner; the bottom one touches at its apex. Cannot be fixed with current shapes (no shape rotation). |
| B4 | M | `controller.ts:637-640` + `render.ts:419-421` | **Protractor rotates about the bounding-box centre, not its baseline midpoint.** Its measuring origin is at `(cx, y+h-8)`, so turning it moves the origin off the vertex the tutor just placed. Every angle measurement needs a drag / rotate / drag loop. |
| B5 | M | `toolkit/maths.ts:19` | **Circle parts: "chord ↗" label at (-190,-150) labels nothing** - no chord is drawn (only diameter and radius). Also no centre point or arc/sector/tangent/segment. |
| B6 | M | `render.ts:339-348` + `BoardUi.tsx:203` | **Number line ignores `max` when `(max-min)/step` is not an integer** (`count = round(...)`): 0 to 10 by 4 shows 0,4,8,12. And "by" allows 0.01 across +/-1000, i.e. up to ~200,000 ticks redrawn every frame. Also `max < min` collapses to count=1 with a reversed label. |
| B7 | M | `render.ts:373-374`, `render-stamps.ts:97-98` | **Axis labels step by 2 starting from `-n`.** For odd ranges (15) only odd numbers are labelled and 0/even values are missing. Coord grid has no `x`, `y`, arrowheads or origin `0` (the page bg `render.ts:86-92` has them, the stamp does not). |
| B8 | M | `render-stamps.ts:96-98,106-108` | Plotter: at range 50 there are ~50 labels in 460px at 9px (overlap). The label prints `y = y=2x` if the tutor types the `y=` prefix. Grid draws every integer line at any range (dense grey mass). No axis arrowheads or `x`/`y` names. |
| B9 | L | `render.ts:362` | Fraction bar with no shading says "1/N each" (fine) but for `parts=1` says "1/1 each"; there is no word "whole", and shading count and denominator are the only read-outs (no equivalent decimal/percent). |
| B10 | M | `toolkit/maths.ts:15` | Place-value chart: "U" (units) headings while current KS1/KS2 practice uses "Ones"; no decimal columns (tenths/hundredths/thousandths) or decimal point; no thousands-group separators; the digit row is one 130px tall cell, not typeable (section 0.3). |
| B11 | H | `controller.ts:734` | **Duplicate does not re-issue `grp`.** Copies keep the source's group id (`placeCopies` at `controller.ts:785` does re-issue it). Selecting the copy then selects the original too (family lookup `controller.ts:384`), so a duplicated 100 square / table / ten frame drags as one 2x-sized lump and cannot be separated by normal clicks. |
| B12 | M | `toolkit/maths.ts:13` | 100 square is 200 separate elements (100 rects + 100 texts) broadcast on every place, undo and duplicate; no way to shade a cell (only free-hand highlighter), and the user must erase numbers one by one for missing-number puzzles. |
| B13 | M | `toolkit/maths.ts:27` | Box plot's box/median/whiskers are hard-coded pixel positions that do not correspond to any values on the number line; cannot be adjusted without marquee-ungrouping. It looks like data but is decoration. |
| B14 | L | `toolkit/maths.ts:25` | Bar-chart frame y-axis is fixed 0-20 (labels are plain text, editable but need 11 edits to rescale); tick labels are left-anchored so "0" and "20" do not right-align on the axis. |
| B15 | L | `toolkit/maths.ts:28` | "Matrix / table frame" draws only two brackets; name over-promises. |
| B16 | L | `render-stamps.ts:391-399` + `general.ts:32` | The "Score counter" stamp is a digit counter, not tally marks; a KS1/KS2 tutor looking for a tally chart will not find one. |
| B17 | M | `BoardUi.tsx:209-210` | Clock minutes only in 5-minute steps; KS2 (Y3+) requires times to the nearest minute. Hands cannot be dragged. |
| B18 | L | `toolkit/maths.ts:15,16` | `PASTEL` imported but unused in `maths.ts` (lint noise; trivial). |

## 3. What a maths tutor expects that is missing, ranked by teaching value

Ranking weights: frequency of use across a tutoring week x how badly the whiteboard is worse than paper without it x how many key stages it serves.

| Rank | Missing tool | Key stages | Why it matters |
|---|---|---|---|
| 1 | **Typeable, resizable table/grid cells** (fix section 0.1-0.3): tables, place value, frequency, two-way, ratio, function tables, population pyramid, part-whole boxes | All | Nearly every worksheet-style task needs "write in the box". Currently impossible. |
| 2 | **Movable counters / discs / base-10 blocks** (ones, tens, hundreds, thousands; place-value counters 1/10/100/1000; two-colour counters; ten-frame counters) that child and tutor can drag, with snapping into frames | KS1-KS2 | Core of mastery teaching (place value, addition/subtraction with exchange, negatives, ratio). Ten frame and place-value chart are currently empty shells. |
| 3 | **Column-method / bus-stop / long-multiplication / long-division frames** with aligned typeable digit boxes and carry row | KS1-KS4 | Daily use in KS2; tutors currently draw them freehand and misalign. |
| 4 | **Interactive number line v2**: hidden labels, movable markers, drawable jump arcs (+/-), fraction / decimal / negative modes, double number line, ratio table | KS1-KS3 | Number-line jumps are the standard model for addition, subtraction, fractions, ratio. |
| 5 | **Fraction circles (pie), fraction of a shape, equivalence bar pairs, percentage bar (0-100)**, mixed-number labels | KS1-KS3 | Bar only today; circles are the first model most children meet. |
| 6 | **Angle tools**: dual-scale protractor (inner/outer 0-180), protractor pivoting at its baseline centre, angle-arc/angle-label drawing, set squares (45 and 30/60), compasses with arc, straight-edge that draws along its edge | KS2-KS4 | Constructions, bearings, measuring and drawing angles are exam skills; current protractor cannot be aligned reliably and there is no compass at all. |
| 7 | **Correct 3-D nets + solid pictures** (cuboid, prism, pyramid fixed; add cylinder, cone, hexagonal prism) and 2D/3D shape banks (all quadrilaterals, regular polygons, sector) | KS1-KS4 | Nets are wrong today; shape properties are a Y1-Y6 staple. |
| 8 | **Coordinate grid v2**: axis names, arrowheads, origin, four-quadrant / first-quadrant only, click-to-plot points with snap, draw line through 2 points, shape transformations (reflect, rotate, translate, enlarge) with mirror line | KS2-KS4 | Coordinates and transformations are heavy topics; child cannot plot on the current stamp. |
| 9 | **Data handling**: real tally chart (marks in fives), pictogram, bar chart that takes values, pie chart, histogram (unequal widths), frequency polygon, cumulative frequency, stem-and-leaf, two-way table, tree diagram, scatter with best-fit line, box plot driven by 5 numbers | KS1-KS5 | Only static frames exist now (bar frame, scatter axes, box-plot picture). |
| 10 | **Algebra tools**: algebra tiles (x, x^2, 1, negatives) with area model / completing the square, balance scales, function machine, factor tree, expanding-brackets grid/box method, sequence table (nth term) | KS3-KS4 | High-value at GCSE; no algebra tooling exists at all. |
| 11 | **Time and money**: draggable clock hands, digital clock, 24h, timetable, coins and notes (draggable), calendar | KS1-KS2 | Y1-Y4 objectives; money completely absent. |
| 12 | **Measures**: reading scales (thermometer, weighing scales, measuring jug, ruler mm), capacity/volume pictures | KS1-KS2 | Scale-reading is a recurring test item. |
| 13 | **Number-representation tools**: Cuisenaire rods, bead string, rekenrek, part-whole (bond) circles, hundred square with shading / 0-99 / hidden-number mode, number square with sliding window | KS1-KS2 | Common in Singapore/mastery schemes used by UK primaries. |
| 14 | **Plotter v2**: degrees mode, separate x/y ranges, first-quadrant view, plotted points, tangent/normal, shaded area, inequality regions, parametric | KS4-KS5 | Trig graphs in degrees (0-360) are impossible now; A-level needs area under curve, tangents. |
| 15 | **A-level / FM aids**: vector grid with arrows, unit circle with special angles, normal distribution with shading, complex plane (Argand), probability distributions, Venn with probabilities, differentiation-from-first-principles chord slider | KS5 | Advanced level lists only ~8 maths items, mostly reused KS4 ones. |
| 16 | **Symmetry and pattern**: mirror line + folding, rotational-symmetry wheel, tessellation dot/iso grids (isometric lines, not only dots), Carroll diagram, sorting circles, arrow/ratio diagrams | KS1-KS3 | Frequent short tasks. |
| 17 | **Probability**: coin, multi-sided dice (d4-d20), probability scale, spinner with unequal sectors, bag of counters | KS2-KS4 | Existing d6 and equal-sector spinner cover only the basics. |
| 18 | **Group-level editing**: ungroup, group, resize-as-a-whole, rotate-as-a-whole, snap to grid | All | Enabler for everything above. |

## 4. Prioritised build list

Sizes: S = under a day; M = 1-3 days; L = a week or more (incl. selftests and e2e per AGENTS.md "new views get a spec").

| Pri | Item | Size | Files touched | Notes |
|---|---|---|---|---|
| P0-1 | **Fix duplicate group id** (B11) | S | `controller.ts:731-738` | Re-issue `grp` per duplicated family, as `placeCopies` does. Add case to `controller.selftest.ts`. |
| P0-2 | **Fix the three wrong nets** (B1-B3n) | S | `toolkit/maths.ts:20-24`; needs rotated triangles: either add `rot` support for shapes (`model.ts`, `render.ts` drawShape, `boundsOf`, `hitTest`) or draw net triangles with `b.polygon` strokes (no core changes) | Cheapest: polygon strokes. Add a net-closure assertion to `toolkit.selftest.ts` (edge lengths match). |
| P0-3 | **Cell element**: a new template primitive `cell` = transparent sticky-like box with centred text, typed by double-click or tap; `B.cell()` in `kit.ts`; switch `table()`, place-value, pyramid, ten-frame, bar-model parts, matrix to use it | M | `kit.ts`, `model.ts` (`ElKind` or `sticky` variant with `nofill`), `render.ts` (drawSticky variant), `controller.ts` (double-click hits empty cell), `reducer.ts` (student kinds), `maths.ts`, `geography.ts:24`, `general.ts:20-23`, `toolkit.selftest.ts`, `e2e/learning-hub-board-ui.spec.ts` | Solves section 0.3 with one mechanism. Existing stickies already resize (`handlesOf`) and edit text, so a "borderless sticky" is the smallest change. |
| P0-4 | **Group resize / rotate / ungroup**: show handles on the group bbox; scale every member (positions, font sizes, line widths kept); "Ungroup" chip in the selection bar | M-L | `render.ts` (`drawSelection`, `handlesOf` for groups), `controller.ts` (`selectDown`, `handleMove`, `finishHandle`, history action), `BoardUi.tsx` (selection bar), `model.ts` (scale helper), `reducer.selftest.ts` | Scaling `stroke` pts and text `size` is straightforward; text boxes need re-measure. Aspect lock for groups optional. |
| P1-1 | **Convert big grids to stamps**: 100 square (with `mask` shading, 0-99/1-100, hide-number toggle), ten frame (with counters), place-value chart (decimals option, "Ones" naming), times-table (hide-answers) | M | `model.ts` (StampKind/`STAMPS`), `render.ts` or `render-stamps.ts` (new draw fns, register in `DRAW`), `controller.ts` `CLICKABLE_STAMPS` (line 29) + `finishMove`, `BoardUi.tsx` `StampOptions`, `boardIcons.tsx`, `toolkit/maths.ts`, selftests | Resizable and 1 element instead of 200 (fixes B12). Reuses the fraction-bar tap-to-toggle pattern. |
| P1-2 | **Draggable manipulatives** (counters, base-10 blocks, coins, cubes) with snap-to-frame; allow students to move tutor-marked "manipulative" elements | L | `model.ts` (new `ElKind`/stamp `manip` + `perm` flag), `reducer.ts` (`mayEdit` exception for manipulatives, STUDENT_KINDS), `controller.ts` (move own/tutor-flagged, snap), `render-stamps.ts`, `toolkit/maths.ts` (new "Manipulatives" items), `PadBoard.tsx`/`BoardUi.tsx` (student palette), e2e | Also unlocks child-driven use (section 0.6). Sync payloads stay small if each is one element. |
| P1-3 | **Number line v2** (fix B6; hidden labels, markers, jump arcs, fractions, negatives; allow non-ratio-locked resize) | M | `render.ts:337-350`, `BoardUi.tsx:203`, `controller.ts:646` (lift ratio lock per stamp via `StampDef.freeResize`), `model.ts` | Clamp tick count (e.g. 200) and validate `max > min`. |
| P1-4 | **Protractor/angle tools**: dual scale, 0/180 labels, rotate about baseline centre (add `pivot` to `StampDef`), set squares, compasses (arc), angle-arc shape | M | `render.ts:418-433`, `controller.ts:636-640`, `model.ts` (`StampDef.pivot`, new stamps), `boardIcons.tsx`, `toolkit/maths.ts` | Rotating about the pivot fixes B4. Rotation for set squares/compass reuses the same path. |
| P1-5 | **Coordinate grid v2** (fix B7; axis names/arrows/origin, first-quadrant option, tap to plot with snap, reflection helper) | M | `render.ts:365-376`, `controller.ts` (`CLICKABLE_STAMPS` + plot toggle), `BoardUi.tsx`, `model.ts` | Store plotted points in `opts.pts` as a string, as timelines do. |
| P1-6 | **Column-method frames** (add, subtract, long multiplication, bus stop, long division) built from P0-3 cells | S-M | `toolkit/maths.ts`, `kit.ts` (helper), `toolkit.selftest.ts` | Depends on P0-3. |
| P2-1 | Fraction circles / pie + percentage bar + equivalence pair | M | `render.ts` (new `fracpie`), `model.ts`, `controller.ts`, `BoardUi.tsx`, `maths.ts` | Reuse the fraction mask logic. |
| P2-2 | Data stamps: tally marks, pictogram, value-driven bar chart, pie chart, histogram, stem-and-leaf | L | `render-stamps.ts`, `model.ts`, `BoardUi.tsx` (opts editors), `maths.ts` | Drive from a typed list (`opts.data`), like the timeline events. Replace static `m-stats-bar`, `m-boxplot` (B13, B14). |
| P2-3 | Clock v2 (drag hands, minute steps, digital/24h/Roman) (B17) | S-M | `render.ts:392-406`, `BoardUi.tsx:209`, `controller.ts` | Drag-hand needs a new gesture branch in `selectDown`. |
| P2-4 | Plotter v2 (degrees toggle, separate x/y ranges, first-quadrant, points, tangent) (B8) | M | `render-stamps.ts:88-109`, `toolkit/mathExpr.ts` (deg-mode trig), `BoardUi.tsx` | Also allow `sin x` without brackets. |
| P2-5 | Algebra tiles, balance scales, function machine, factor tree, grid multiplication box | M-L | new `toolkit/maths.ts` items (templates with P0-3 cells), one draggable-tile stamp on top of P1-2 | Algebra tiles need P1-2's manipulatives. |
| P2-6 | Time/money/measures (coins, notes, thermometer, scales, jug) | M | `render-stamps.ts`, `model.ts`, `maths.ts` | Money reuses P1-2 manipulatives. |
| P2-7 | Toolkit UX: per-tool thumbnails, tags on every maths item, cross-pack search, "recently used" | S-M | `ToolkitPop.tsx:45,132-141`, `kit.ts` (`tags`), `maths.ts` | Small change, large discoverability gain. |
| P2-8 | Circle parts fix (draw a chord, centre, arc/sector/tangent options) (B5) + circle-theorem set | S-M | `toolkit/maths.ts:19` | Add param select for which parts to show. |
| P3 | A-level aids: vector grid, unit circle, normal distribution, Argand diagram, calculus sliders | L | new stamps in `render-stamps.ts`, `model.ts`, `maths.ts` (advanced level) | After plotter v2. |
| P3 | Snap-to-grid toggle for all draw tools on squared/graph pages | M | `controller.ts` (`toWorld` snap when enabled), `BoardUi.tsx` toggle, `render.ts` (`GRID`) | Improves child accuracy on all grids. |

Suggested order: P0-1, P0-2 (same day), then P0-3 -> P0-4 -> P1-1 -> P1-2. Everything else stacks on these four.

## 5. What is good (keep)

- Ruler scale is coherent with squared paper (40 units = 1 cm = 1 square), and it rotates with 15-degree shift-snap.
- Fraction bar tap-to-shade, fraction wall, times-table, plotter parsing (`mathExpr.ts` is eval-free, handles implicit multiplication, asymptote breaks) are solid and self-tested.
- SOH CAH TOA triangle content is mathematically correct.
- Tap targets are 44px in `ToolkitPop.tsx` and the options bar; theme via CSS variables; level filter (Early/Standard/Advanced) is a good structure to extend.
