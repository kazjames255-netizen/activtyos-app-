# A2 Science tools verification

Scope: features/learninghub/tools/science (S-01 labels, S-02 data graph, S-03 formulae, S-05 equations).

## Browser coverage
- S-01: verified in the real browser on desktop (all 10 diagrams, place by chip+marker, picker list, typed mode, hints, Check, tab order).
- S-02, S-03, S-05: NOT browser-verified. After the S-01 pass the Teaching Hub stopped loading (POST /api/events/ticket stayed pending, the hub showed "We can't reach Teaching Hub", "Try again" did not recover it) while several agents shared the stack. Code review only for these.
- 390px phone width not checked for any tool (same reason; the tab group was also reset twice).

## S-01 diagram screenshots (saved)
/var/folders/lm/5rqr9r_55vb0sz79h0x8_gvm0000gn/T/claude-chrome-screenshots-f00l3c/screenshot-1790196949368-5.png (plant cell), ...-7.png (bacterial), ...-8.png (flower before), ...-9.png (eye), ...-11.png (heart), ...-13.png (digestive), ...-14.png (leaf), ...-16.png (respiratory), ...-17.png (circuit before), ...-18.png (flower after), ...-19.png (circuit after)

## Fixes made (labels/)
- diagrams.tsx Flower: petals were two detached ovals; redrawn as petals attached to the base.
- diagramData.ts circuit: markers covered the cell plates, lamp cross and the A / V letters; ammeter, voltmeter, bulb, cell now use leaders, hotspots moved to the rim.
- diagramData.ts: leaf cuticle and upper epidermis markers overlapped (moved cuticle to x=340); flower stigma given a leader and ovary marker lifted so the ovules show; animal-cell mitochondrion and plant-cell chloroplast given leaders so the small organelles are not hidden.

Diagrams judged OK as drawn: animal, plant, bacterial, eye, heart (right side on left, noted), digestive, respiratory. Markers sit on the intended parts in all of them. The digestive drawing has a gap between stomach and small intestine (cosmetic, left).

## Behaviour checked (S-01)
Picker list, chip then marker, Check (correct / Not quite / Empty), hint ladder (function clue, then first letter + length), typed mode with typo forgiving of case/alternatives ("Light Bulb" = bulb, "cable" = wire), tab order input -> Hint -> next input. No horizontal scroll at desktop width.
Minor, not fixed: pressing Cancel in the picker leaves a previously held chip selected. Teach-mode "Show labels" and group body-systems not exercised (need mode/params from the lesson host).

## Code review only (not seen in browser)
DataGraph: no defects found on reading; unverified: pointer drag of best-fit handles, plotting snap, mobile layout. FormulaCalculator and EquationBalancer: no defects found on reading; subscripts, 360px layout unverified.

## Checks
All four selftests pass (284, 196, 179, 667 checks); tsc has no output for tools/science.
