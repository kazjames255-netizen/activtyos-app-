// X2 policy unit tests for the Maths KS3-KS4 extension (ext-maths-secondary.ts): for EVERY picture a POSITIVE slide that must get exactly that
// picture (key stage ks4) and a NEGATIVE slide (a gate the picture must respect: an `avoid` phrase, a `requires` context, `numeric`, a passing mention,
// a look-alike concept owned by another picture ...) that must not. Also: KS1-2 slides never get these pictures, question slides never get pictures.
// Imported by cli.ts (runExtMathsSecondaryTests).
import type { Slide } from "../../../../../features/learninghub/lesson/slides/types";
import { chooseArt } from "./select";
import { EXT_MATHS_SECONDARY } from "./ext-maths-secondary";

type Row = { id: string; pos: [title: string, lead: string, expect?: string[]]; neg: [title: string, lead: string, expect?: string[]] };
const R = (id: string, pos: Row["pos"], neg: Row["neg"]): Row => ({ id, pos, neg });
/** a slide that only MENTIONS the concept in passing (a different title): never enough for a picture */
const weak = (concept: string): Row["neg"] => ["Starter", `Last lesson we met ${concept}.`];

const ROWS: Row[] = [
  // ── graphs and functions ──
  R("cubic-graph", ["Key features of a cubic graph", "A cubic graph is an S-shaped curve."], ["Cubic graphs and cube roots", "Compare a cubic graph with a cube root."]),
  R("reciprocal-graph", ["Drawing reciprocal graphs", "A reciprocal graph has two curves."], ["Reciprocal graphs", "A reciprocal graph is not the reciprocal of a number, the multiplicative inverse."]),
  R("exponential-graph", ["Drawing exponential graphs", "An exponential graph shows growth or decay."], ["Exponential graphs", "An exponential graph is not exponential form."]),
  R("y-mx-c", ["The equation of a straight line", "Any straight line can be written as y = mx + c."], ["Finding the equation of the line", "Some lines are written ay + bx + c = 0."]),
  R("horizontal-vertical-lines", ["Drawing vertical and horizontal graphs", "Some graphs are lines parallel to the axes."], weak("vertical and horizontal graphs")),
  R("direct-proportion-graph", ["Graphs showing direct proportion", "A direct proportion graph is a straight line through the origin."], weak("a direct proportion graph")),
  R("inverse-proportion-graph", ["Graphs showing inverse proportion", "An inverse proportion graph is a curve."], weak("an inverse proportion graph")),
  R("speed-time-graph", ["Speed-time graphs", "A speed-time graph has straight sections."], ["Speed-time graphs", "A speed-time graph can also be a curve."]),
  R("unit-circle", ["The unit circle", "The unit circle has centre the origin."], weak("the unit circle")),
  R("circle-equation", ["The equation of a circle", "A circle with centre the origin has an equation."], weak("the equation of a circle")),
  R("gradient-of-curve", ["Estimating the gradient of a curve", "Draw a tangent to a curve at a point."], weak("the gradient of a curve")),
  R("graph-transformations", ["Transforming graphs: y = f(x) + a", "Adding a to f(x) moves the graph."], ["Transforming graphs: y = af(x)", "Multiplying f(x) by a stretches the graph.", ["graph-stretches"]]),
  R("graph-stretches", ["Transforming graphs: y = af(x)", "Multiplying f(x) by a stretches the graph."], weak("the graph of y = af(x)")),
  R("inequality-number-line", ["Inequalities on number lines", "Use open and closed circles."], ["Inequalities on number lines", "An error interval can also be shown on a number line."]),
  R("inequality-region", ["Solving a linear inequality graphically", "Shade the region on the graph; the boundary line is dashed."], ["Solving a linear inequality graphically", "Read the solution from the graph."]),
  R("simultaneous-graph", ["Solving simultaneous linear equations graphically", "The solution is where the two graphs cross."], ["Solving simultaneous equations graphically", "A quadratic equation and a linear equation make a curve and a line."]),
  R("function-machine", ["Function machines", "A function machine takes an input and gives an output."], ["Function machines", "Use the inverse operation to undo each step."]),
  R("inverse-function", ["Finding the inverse of a function", "The inverse function undoes the function."], weak("the inverse function")),
  R("composite-function", ["Writing composite functions", "A composite function applies one function after another."], ["Composite functions", "gf(x) means f is applied first."]),
  R("arithmetic-sequence", ["Arithmetic sequences", "An arithmetic sequence goes up by a common difference."], weak("an arithmetic sequence")),
  R("geometric-sequence", ["Geometric sequences", "A geometric sequence has a common ratio."], ["Geometric sequences", "This is different from ratio and proportion."]),
  R("quadratic-sequence", ["Quadratic sequences", "A quadratic sequence has a constant second difference."], ["Quadratic sequences", "The sequence 2, 5, 10, 17 is quadratic."]),
  R("nth-term", ["The nth term", "The nth term is the rule for a sequence."], ["The nth term", "The nth term is 3n + 1."]),
  R("factor-tree", ["Prime factorisation", "Use a factor tree to find the prime factors."], ["Prime factorisation", "Use a factor tree for 60."]),
  R("set-notation", ["Set notation", "Set notation uses symbols for sets and the universal set."], weak("set notation")),
  // ── data ──
  R("histogram", ["Histograms with unequal bar widths", "Frequency density goes on the vertical axis."], ["Histograms with equal bar width", "The bars all have the same width."]),
  R("box-plot", ["Constructing box plots", "A box plot shows the median and the interquartile range."], weak("a box plot")),
  R("cumulative-frequency-graph", ["Constructing a cumulative frequency graph", "Plot the cumulative frequency against the upper class boundary."], ["Cumulative frequency table", "Complete the cumulative frequency table first."]),
  R("stem-and-leaf", ["Stem and leaf diagrams", "A stem and leaf diagram keeps every value."], ["Stem and leaf diagrams", "Draw one for 12, 15 and 18."]),
  R("frequency-polygon", ["Frequency polygons", "A frequency polygon joins the midpoints."], weak("a frequency polygon")),
  R("two-way-table", ["Two-way tables", "A two-way table shows two categories at once."], weak("a two-way table")),
  R("frequency-tree", ["Frequency trees", "A frequency tree shows how a total splits."], weak("a frequency tree")),
  R("probability-tree", ["Probability trees", "A probability tree shows every outcome."], ["Probability trees", "This is not the same as a frequency tree."]),
  R("mutually-exclusive", ["Mutually exclusive events", "Mutually exclusive events cannot both happen."], weak("mutually exclusive events")),
  R("scatter-outlier", ["Outliers in scatter graphs", "An outlier does not fit the pattern."], ["Outliers", "An outlier can also be found using a box plot."], ),
  R("interpolation-extrapolation", ["Interpolation versus extrapolation", "Interpolation stays inside the data."], ["Extrapolation", "Extrapolation of a sequence carries on the pattern."]),
  R("population-sample", ["Sampling methods", "A sample is chosen from the population."], ["Sample space diagrams", "A sample space shows all the outcomes."]),
  R("stratified-sample", ["Stratified sampling", "A stratified sample takes each group in proportion."], weak("a stratified sample")),
  // ── number and algebra ──
  R("standard-form", ["Writing large numbers in standard form", "Standard form makes big numbers short."], ["Standard form", "The standard form of a quadratic is ax² + bx + c."]),
  R("index-laws", ["The laws of indices - division", "Subtract the powers when dividing."], weak("the laws of indices")),
  R("power-notation", ["Exponential form", "Write repeated multiplication with a base and an exponent."], ["Exponential form", "Do not confuse it with standard form."]),
  R("surd-rules", ["Simplifying surds", "A surd is an irrational root."], weak("simplifying surds")),
  R("simple-vs-compound-interest", ["Compound interest", "Compound interest is earned on the interest as well."], ["Percentage increase", "Compound interest repeats the increase every year."], ),
  R("percentage-multiplier", ["Percentage increase", "Use a percentage multiplier to increase a quantity."], ["Percentage increase", "Compound interest repeats the increase every year."]),
  R("ratio-sharing-bar", ["Sharing in a ratio", "Find the value of one part first."], ["Sharing in a ratio", "Share £60 in the ratio 2 : 3."]),
  R("double-number-line", ["Using a double number line", "A double number line shows proportional quantities."], weak("a double number line")),
  R("hcf-lcm-venn", ["Highest common factor", "The HCF is the largest common factor."], ["Highest common factor with algebraic terms", "Find the HCF of two algebraic terms."]),
  R("arithmetic-laws", ["The commutative law", "The order does not change the answer."], ["The commutative law", "Subtraction is not commutative."]),
  R("order-of-operations-ks3", ["Priority of operations", "Brackets come first."], weak("the order of operations")),
  R("binomial-grid", ["The product of two binomials", "Use a grid to expand double brackets."], ["The product of two binomials", "A special case is the difference of two squares."]),
  R("difference-of-two-squares", ["Difference of two squares", "A square minus a square factorises."], weak("the difference of two squares")),
  R("quadratic-formula", ["The quadratic formula", "Use the formula to solve a quadratic equation."], weak("the quadratic formula")),
  R("balance-equation", ["Solving linear equations", "Use the balance method: do the same to both sides."], ["Solving linear equations graphically", "Draw the line and read off the answer."]),
  R("inequality-symbols", ["Inequality notation", "Use the symbols < and > for inequalities."], ["Inequality notation", "Use inequality notation to write an error interval."]),
  R("error-interval", ["Error intervals", "An error interval has a lower bound and an upper bound."], weak("an error interval")),
  R("like-terms", ["Like terms", "Like terms have the same letters."], ["Like terms", "Collect 3x + 2x."]),
  R("metric-prefixes", ["Metric prefixes", "A prefix changes the size of the unit."], ["Metric prefixes", "Convert 3 kilometres."]),
  // ── angles, circles, congruence, bearings ──
  R("bearing", ["Bearings", "A bearing is measured clockwise from north."], ["Finding a bearing", "Then work out the reverse bearing."]),
  R("reverse-bearing", ["Reverse bearings", "The back bearing differs by a half turn."], weak("a reverse bearing")),
  R("angle-notation", ["Formal angle notation", "Name an angle with three letters."], weak("angle notation")),
  R("interior-exterior-angle", ["Exterior angles", "An exterior angle lies outside the shape."], ["Exterior angles", "The exterior angle of a triangle is another idea."]),
  R("polygon-angle-sum", ["The sum of the interior angles of a polygon", "Split the polygon into triangles."], ["The sum of the interior angles of any triangle", "A triangle has three angles."]),
  R("quadrilateral-angle-sum", ["Angles in a quadrilateral", "The four angles add up to a full turn."], ["Angles in a quadrilateral", "Not to be confused with a cyclic quadrilateral."]),
  R("exterior-angle-triangle", ["The exterior angle of a triangle", "It equals the sum of the two opposite angles."], weak("the exterior angle of a triangle")),
  R("ct-centre", ["The angle at the centre is twice the angle at the circumference", "Use this circle theorem."], ["Angle at the centre of a sector", "A sector has an angle at the centre."]),
  R("ct-semicircle", ["The angle in a semicircle", "It is always a right angle."], weak("the angle in a semicircle")),
  R("ct-same-segment", ["Angles in the same segment", "They are equal."], weak("angles in the same segment")),
  R("ct-cyclic-quadrilateral", ["Cyclic quadrilaterals", "Opposite angles add up to 180 degrees."], weak("a cyclic quadrilateral")),
  R("ct-tangent-radius", ["A tangent to a circle", "It meets the radius at a right angle."], weak("a tangent to a circle")),
  R("ct-two-tangents", ["Two tangents from a point", "They have the same length."], weak("two tangents")),
  R("ct-alternate-segment", ["The alternate segment theorem", "Angles match across a chord."], weak("the alternate segment theorem")),
  R("ct-chord-bisector", ["The perpendicular bisector of a chord", "It passes through the centre."], weak("a chord bisector")),
  R("congruent-sss", ["Congruent triangles (SSS)", "Three pairs of equal sides make congruent triangles."], ["RHS and LHS of an equation", "Solve so that the LHS equals the RHS and SSS is not needed."]),
  R("congruent-sas", ["Congruent triangles (SAS)", "Two sides and the included angle make congruent triangles."], ["Solving with SAS", "SAS in a spreadsheet is a software name."]),
  R("congruent-asa", ["Congruent triangles (ASA)", "Two angles and the included side make congruent triangles."], ["ASA", "ASA is an exam board abbreviation."]),
  R("congruent-aas", ["Congruent triangles (AAS)", "Two angles and a side make congruent triangles.", ["congruent-aas"]], ["AAS", "AAS is an abbreviation."]),
  R("congruent-rhs", ["Congruent triangles (RHS)", "A right angle, hypotenuse and side make congruent triangles."], ["Equations with an RHS", "The RHS of the equation is 12, on the left hand side is x."]),
  // ── transformations, vectors ──
  R("scale-factor", ["Scale factor", "The scale factor is the multiplier between similar shapes."], ["Scale factor", "The area scale factor is the square of the length scale factor."]),
  R("clockwise-anticlockwise", ["Clockwise and anticlockwise turns", "Turns can go either way."], ["Clockwise", "A bearing is measured clockwise from north."]),
  R("column-vector", ["Column vectors", "A column vector shows a move across and up."], weak("a column vector")),
  R("vector-add-subtract", ["Vector addition and subtraction", "Add vectors head to tail."], weak("vector addition")),
  R("vector-multiples", ["Parallel vectors", "Parallel vectors are multiples of each other."], weak("parallel vectors")),
  // ── area, volume, nets ──
  R("compound-shape", ["Area of compound shapes", "Split the shape into rectangles."], ["Compound shapes", "Now find the volume of a compound solid."]),
  R("triangle-area", ["Area of a triangle", "Area equals half base times height."], ["Area of a triangle when the height is not known", "Use trigonometry."]),
  R("parallelogram-area", ["Area of a parallelogram", "Use the perpendicular height."], weak("the area of a parallelogram")),
  R("trapezium-area", ["Area of a trapezium", "Average the parallel sides."], weak("the area of a trapezium")),
  R("circle-formulas", ["Area of a circle", "Use the radius."], ["Area of a circle", "The area of a sector is a fraction of it."]),
  R("sector-formulas", ["Arc length and the area of a sector", "Use the angle at the centre as a fraction of 360."], ["Arc length", "Arc length on a pie chart is not needed."]),
  R("cylinder-formulas", ["The volume of a cylinder", "Use the area of the circular end."], ["The volume of a cylinder", "A hollow cylinder is a prism with a ring cross section."]),
  R("cone-formulas", ["The volume of a cone", "Use the perpendicular height."], ["The volume of a cone", "A frustum is a cone with its top removed."]),
  R("sphere-formulas", ["The volume of a sphere", "Use the radius cubed."], ["The volume of a sphere", "A hemisphere is half a sphere."]),
  R("pyramid-formula", ["The volume of a pyramid", "Use the perpendicular height."], weak("the volume of a pyramid")),
  R("prism", ["Properties of prisms", "A prism has the same cross section throughout."], ["Prisms in a lab", "A glass prism refracts light and makes a spectrum."]),
  R("frustum", ["The frustum of a cone", "Cut a cone parallel to its base."], weak("a frustum")),
  R("net-cylinder", ["The net of a cylinder", "It has a rectangle and two circles."], weak("the net of a cylinder")),
  R("net-cuboid", ["The net of a cuboid", "It has six rectangles."], weak("the net of a cuboid")),
  R("net-triangular-prism", ["The net of a triangular prism", "It has three rectangles and two triangles."], weak("the net of a triangular prism")),
  R("net-pyramid", ["The net of a square-based pyramid", "It has a square and four triangles."], weak("the net of a square-based pyramid")),
  // ── trigonometry, measures ──
  R("trig-ratios", ["Trigonometric ratios", "Sine, cosine and tangent compare two sides."], ["Trigonometric functions", "On the unit circle sine is the y-coordinate."]),
  R("sine-rule", ["The sine rule", "Use it with a side and its opposite angle."], weak("the sine rule")),
  R("cosine-rule", ["The cosine rule", "Use it with two sides and the included angle."], weak("the cosine rule")),
  R("area-of-any-triangle", ["The area of any triangle", "Use two sides and the angle between them."], ["The area of any triangle", "Do not use the sine rule here."]),
  R("speed-distance-time", ["Speed, distance and time", "Use the formula triangle."], ["Speed, distance and time graphs", "Read the speed from the gradient."]),
  R("density-mass-volume", ["Compound measures for density", "Density compares the mass with the volume.", ["compound-measures", "density-mass-volume"]], weak("density, mass and volume")),
  R("pressure-force-area", ["Compound measures for pressure", "Pressure compares the force with the area.", ["compound-measures", "pressure-force-area"]], ["Blood pressure", "Blood pressure is a force per area in the body."]),
  R("compound-measures", ["Compound measures", "A compound measure divides one quantity by another."], weak("compound measures")),
  R("proportion-formulas", ["The constant of proportionality", "Find k first."], weak("the constant of proportionality")),
  // ── constructions ──
  R("locus-types", ["Loci", "A locus is the set of points that follow a rule."], weak("a locus")),
  R("perpendicular-bisector", ["Constructing a perpendicular bisector", "Use a pair of compasses."], ["The perpendicular bisector of a chord", "It passes through the centre.", ["ct-chord-bisector"]]),
  R("angle-bisector", ["Bisecting an angle", "Use a pair of compasses."], ["Bisecting an angle", "Do not confuse it with a perpendicular bisector."]),
];

const got = (kind: Slide["kind"], title: string, lead: string, ks: string, lessonTitle = ""): string[] =>
  chooseArt({ kind, title, blocks: [{ t: "lead", text: lead }] } as Pick<Slide, "kind" | "title" | "blocks">, { subject: "Maths", keyStage: ks, lessonTitle }).pics.slice().sort();
const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === [...b].sort()[i]);

export function runExtMathsSecondaryTests(): { problems: string[]; tests: number } {
  const bad: string[] = []; let tests = 0;
  const have = new Set(ROWS.map((r) => r.id));
  for (const p of EXT_MATHS_SECONDARY) if (!have.has(p.id)) bad.push(`X2: picture ${p.id} has no test row`);
  for (const r of ROWS) {
    if (!EXT_MATHS_SECONDARY.some((p) => p.id === r.id)) { bad.push(`X2 test row for unknown picture ${r.id}`); continue; }
    const p = EXT_MATHS_SECONDARY.find((x) => x.id === r.id)!;
    for (const ks of ["ks3", "ks4"]) { tests++; const g = got("explain", r.pos[0], r.pos[1], ks); const want = r.pos[2] ?? [r.id]; if (!same(g, want)) bad.push(`X2 TEST ${r.id} (${ks}): "${r.pos[0]}" expected [${want}] got [${g}]`); }
    for (const ks of ["ks1", "ks2"]) { tests++; if (got("explain", r.pos[0], r.pos[1], ks).includes(r.id)) bad.push(`X2 TEST ${r.id}: must not appear in ${ks}`); }
    tests++; if (got("practice", r.pos[0], r.pos[1], "ks4").length) bad.push(`X2 TEST ${r.id}: a practice slide must get no picture`);
    tests++; { const g = got("explain", r.neg[0], r.neg[1], "ks4"); const want = r.neg[2] ?? []; if (!same(g, want)) bad.push(`X2 NEG ${r.id}: "${r.neg[0]}" / "${r.neg[1]}" expected [${want}] got [${g}]`); }
    if (p.numeric) { tests++; if (got("explain", r.pos[0], `${r.pos[1]} For example 12 and 5.`, "ks4").includes(r.id)) bad.push(`X2 TEST ${r.id}: a numeric picture must be refused when the slide has digits`); }
  }
  // family behaviour, multi-picture slides and the old shapes
  const multi: [string, string, string, string[]][] = [
    ["ASA and AAS name both members of the congruence family", "Congruent triangles (ASA and AAS)", "Two angles and a side make triangles congruent.", ["congruent-aas", "congruent-asa"]],
    ["all four congruence criteria: no single picture is right", "Applying the criteria for congruence", "Use SSS, SAS, ASA or RHS to show two triangles are congruent.", []],
    ["a cone slide that names the cylinder shows both", "The volume of a cone", "The volume of a cone is one third of the cylinder with the same base and height.", ["cone-formulas", "cylinder"]],
    ["a sphere lesson gets the sphere formulas", "The volume of a sphere", "A sphere is a 3D shape where every point on its surface is equidistant from the centre.", ["sphere-formulas"]],
    ["back-to-back stem and leaf diagrams do not get the single diagram", "Back-to-back stem and leaf diagrams", "Two data sets share one stem.", []],
    ["a single stem and leaf sample slide is not a sampling picture", "Stem and leaf diagrams for a single sample", "The stem is all but the last digit.", ["stem-and-leaf"]],
    ["surface area of cylinders (plural) gets the cylinder formulas only", "Surface area of cylinders", "Find the total surface area.", ["cylinder-formulas"]],
    ["sine rule lesson: the sine rule picture, not the right-angle labels", "The sine rule", "The sine rule finds a side when you know an angle and the opposite side.", ["sine-rule"]],
    // image-QA gates (the drawing must never contradict the slide)
    ["histogram: equal bin widths (the drawing has unequal bars)", "Constructing histograms using technology", "Using the raw data allows software to calculate equal bin widths easily for the histogram.", []],
    ["histogram: bars of the same width (the drawing has unequal bars)", "Histograms", "In this histogram every bar has the same width.", []],
    ["histogram: unequal class widths still gets the picture", "Histograms with unequal class widths", "A histogram uses frequency density when the class widths are unequal.", ["histogram"]],
    ["rotation: the centre can lie inside the object (the drawing has it outside)", "Understanding the centre of rotation", "The centre of rotation can be lying inside the object. The centre of rotation can be lying outside the object.", []],
    ["rotation: the centre on a vertex (the drawing has it outside)", "Describing a rotation", "The centre of rotation can be on a vertex of the shape.", []],
    ["rotation: anticlockwise (the drawing turns clockwise)", "Rotation", "Rotate the shape a quarter turn anticlockwise about the centre of rotation.", []],
    ["rotation: a plain rotation slide still gets the picture", "Introduction to rotations", "A rotation turns an object about a fixed point called the centre of rotation.", ["rotation"]],
    ["circle: the graph of a circle is not the plain circle", "The graph of a circle", "The graph of a circle with centre the origin is drawn on coordinate axes.", []],
    ["circle: the equation of a circle gets its own picture, not the plain circle", "The equation of a circle", "A circle with centre the origin has an equation linking x and y.", ["circle-equation"]],
    ["circle: a plain circle slide still gets the picture", "Constructing a circle", "Every point on the circle is the same distance from the centre.", ["circle"]],
  ];
  { // the owner's example at KS4: the sphere key-word slide (a define block) still gets the plain sphere
    tests++; const g = chooseArt({ kind: "intro", title: "Key words", blocks: [{ t: "define", items: [{ term: "sphere", def: "A sphere is a 3D shape where every point on its surface is equidistant from the centre." }] }] } as Pick<Slide, "kind" | "title" | "blocks">, { subject: "Maths", keyStage: "ks4", lessonTitle: "The volume of a sphere" }).pics.slice().sort();
    if (!same(g, ["sphere", "sphere-formulas"]) && !same(g, ["sphere"])) bad.push(`X2 TEST owner's sphere key-word slide at KS4: expected [sphere] (+ formulas) got [${g}]`);
  }
  for (const [name, title, lead, want] of multi) { tests++; const g = got("explain", title, lead, "ks4"); if (!same(g, want)) bad.push(`X2 TEST ${name}: expected [${want}] got [${g}]`); }
  return { problems: bad, tests };
}
