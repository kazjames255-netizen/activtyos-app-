# Maths curriculum cross-check against DfE documents

Date: 2026-09-19. Scope: packs `maths-ks1`, `ks2maths`, `maths-ks3`, `maths-ks4`, `maths-ks5`. REPORT ONLY: no content file was edited.

## 1. Sources fetched (exact URLs)

| Source | URL | How obtained | Fidelity |
| --- | --- | --- | --- |
| National curriculum in England: mathematics programmes of study (KS1-2, KS3) | https://www.gov.uk/government/publications/national-curriculum-in-england-mathematics-programmes-of-study/national-curriculum-in-england-mathematics-programmes-of-study | WebFetch (page converted to markdown, then passed through a small summarising model) | The returned bullets look verbatim and match the statutory structure, but this was model-mediated, not a raw HTML/PDF copy. Treat quoted KS1-KS3 phrases as reliable but not byte-exact. |
| GCSE mathematics: subject content and assessment objectives (DfE, DFE-00233-2013) | https://assets.publishing.service.gov.uk/media/5a7cb5b040f0b6629523b52c/GCSE_mathematics_subject_content_and_assessment_objectives.pdf | Landing page https://www.gov.uk/government/publications/gcse-mathematics-subject-content-and-assessment-objectives via WebFetch; PDF downloaded with curl and text-extracted locally (pypdf) | Exact text. Limitation: the standard / underlined / bold (Foundation vs Higher) typography did not survive extraction, so I cannot say which GCSE items are Higher-only. Everything below is judged against the full GCSE content. |
| GCE AS and A level subject content for mathematics (DfE, April 2016) | https://assets.publishing.service.gov.uk/media/5a7f273a40f0b62305b85670/GCE_AS_and_A_level_subject_content_for_mathematics_with_appendices.pdf (found via https://www.gov.uk/api/content/government/publications/gce-as-and-a-level-mathematics; the guessed page URL .../gce-as-and-a-level-for-mathematics returned 404) | curl + pypdf | Exact text. AS content is marked in the DfE document by square brackets; the extraction kept the brackets, so "AS" vs "A2-only" below comes from them. Statements with no brackets are A-level (Y13) only. |

Sources I could not fetch: none. Further Maths content was not needed and not fetched.

Local working copies (not part of the repo): `/private/tmp/claude-501/-Users-kazjames-Downloads-activtyos-app-/b44a83fa-bed6-439e-9359-8e5732165c90/scratchpad/{gcse,alevel}.{pdf,txt}`.

## 2. Method and honest limitations

- I imported every `TOPIC` export and dumped objectives, notes, quiz prompts/answers and flashcards, then compared per year against the official text. I read every objective list and every quiz prompt (with answers) for all five packs.
- "Gap" = no coverage found in the objectives, note, questions or flashcards, after keyword search plus manual reading of the relevant question lists. A keyword search can miss a paraphrase; I re-checked the important ones by hand. Items marked "partial" have some coverage but not the official skill.
- Answer keys and image-based questions were NOT re-verified here (this is a scope/placement check, not a correctness QA). Where a question depends on a diagram I judged it by its prompt.
- KS3 is Y7-9 unbroken, so a KS3 statutory item is "gap" only if it appears nowhere in Y7-9 (an item that only appears in KS4 is noted).
- The KS4 pack has only 5 objective bullets and 13-14 questions per topic-year against roughly 100 GCSE content statements, so its gap list is long by construction. The KS5 pack is close to complete against the DfE list; its problems are scope and AS/A2 placement.
- Categories: G = gap, M = misplaced (wrong year), O = out of scope (beyond that key stage's DfE content), W = wording/terminology.

## 3. Totals

| Pack | Gap | Misplaced | Out of scope | Wording |
| --- | --- | --- | --- | --- |
| maths-ks1 | 3 | 0 | 0 | 0 |
| ks2maths | 16 | 3 | 0 | 1 |
| maths-ks3 | 17 | 0 | 5 | 1 |
| maths-ks4 | 20 | 0 | 0 | 1 |
| maths-ks5 | 13 | 7 | 9 | 3 |
| Total | 69 | 10 | 14 | 6 |

Severity guide: H = wrong for the audience or clearly required official content missing; M = real official item with no coverage; L = minor/partial/borderline.

## 4. maths-ks1 (Y1-2)

Everything else in KS1 matches the programme of study (all Y1/Y2 strands present; `stats` correctly `notIntroduced` for Y1). No misplaced or out-of-scope content found.

| # | Cat | Sev | Topic key | Year | Official reference | Finding | Recommended fix |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | G | M | npv | 1 | "count to and across 100, forwards and backwards, beginning with 0 or 1, or from any given number" | Objective and all 10 questions count forwards only; nothing counts back. | Add a count-back question (e.g. "count back from 15") and adjust the objective. |
| 2 | G | L | npv | 2 | "count in steps of 2, 3, and 5 from 0, and in 10s from any number, forward and backward" | Step-counting questions (npv-y2-06) are forward only. | Add one backward step question. |
| 3 | G | L | meas | 1 | "time (hours, minutes, seconds)" | Seconds never mentioned in Y1 measurement. | One question/flashcard naming seconds as a unit of time. |

## 5. ks2maths (Y3-6)

| # | Cat | Sev | Topic key | Year | Official reference | Finding | Recommended fix |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | G | L | npv | 3 | "find 10 or 100 more or less than a given number" | Only counting on in 100s (npv-y3-06). No 10/100 more/less. | Add 1-2 questions and an objective line. |
| 2 | G | M | npv | 4 | "find 1,000 more or less than a given number" | Not covered. | Add question + objective. |
| 3 | G | H | npv | 4 | "count backwards through 0 to include negative numbers" | No negative numbers anywhere in Y4 (first appear Y5, npv-y5-05/09). | Add Y4 negative-number counting/temperature questions and objective. |
| 4 | G | M | frac | 3 | "compare and order unit fractions, and fractions with the same denominators"; "recognise and use fractions as numbers" | No comparing/ordering, no number-line use in Y3 fractions. | Add ordering and number-line questions. |
| 5 | G | L | frac | 3 | "recognise that tenths arise ... in dividing one-digit numbers or quantities by 10" | Tenths counted (frac-y3-01, 08) but never as division by 10. | One question, e.g. 7 ÷ 10 = 7/10. |
| 6 | G | M | frac | 4 | "add and subtract fractions with the same denominator" | Not in Y4 objectives, note or quiz (only Y3 has it). | Add to Y4 objective and quiz (can go beyond one whole). |
| 7 | G | L | frac | 4 | "solve simple measure and money problems involving fractions and decimals to 2 decimal places"; "recognise and write decimal equivalents of any number of tenths or hundredths" | No money/measure contexts; decimal equivalents only for 1/4, 1/2, 3/4 (and 0.25 in frac-y4-08). | Add a £-and-p question and a tenths/hundredths equivalence question. |
| 8 | G | M | frac | 5 | "round decimals with 2 decimal places to the nearest whole number and to 1 decimal place"; "solve problems involving number up to 3 decimal places" | No decimal rounding at all in Y5 (it appears in the Y4 note instead, see M1). Little problem-solving with 3 d.p. | Move the 1 d.p. rounding to Y5 and add nearest-whole rounding of 2 d.p. numbers to Y4 (see M1). |
| 9 | G | H | frac / md | 6 | "multiply and divide numbers by 10, 100 and 1,000 giving answers up to 3 decimal places"; "multiply one-digit numbers with up to 2 decimal places by whole numbers"; "use written division methods in cases where the answer has up to 2 decimal places"; "solve problems which require answers to be rounded to specified degrees of accuracy" | Y6 has no decimal arithmetic or rounding-to-accuracy anywhere (frac-y6, md-y6, npv-y6 checked). Decimals appear only as fraction equivalents (frac-y6-03, -10). | Add a decimals block to Y6 (objectives, note example, 2-3 questions); the Y6 Number & Place Value / md quizzes are the natural home. |
| 10 | G | M | frac | 6 | "compare and order fractions, including fractions >1" | Not covered. | Add ordering question with improper fractions/mixed numbers. |
| 11 | G | M | md | 5 | "solve problems involving multiplication and division, including ... scaling by simple fractions and problems involving simple rates" | Absent from objectives and questions. | Add a scaling-by-fraction and a rate question. |
| 12 | G | L | md | 5 | "solve problems involving addition, subtraction, multiplication and division ... including understanding the meaning of the equals sign" | Absent. | Add a "which is true: 4 × 5 = 2 × 10 = ?" style question. |
| 13 | G | L | meas | 3 | "know the number of seconds in a minute and the number of days in each month, year and leap year" | Not covered. | Add 2 questions/flashcards. |
| 14 | G | L | meas | 4 | "solve problems involving converting from hours to minutes, minutes to seconds, years to months, weeks to days" | Partial: only hours to minutes (meas-y4-02) and metres/cm. | Add years-to-months and weeks-to-days problems. |
| 15 | G | L | meas | 5 | "estimate the area of irregular shapes" | Not covered. | Add count-the-squares estimate question. |
| 16 | G | L | meas | 6 | "recognise when it is possible to use formulae for area and volume of shapes" | Not stated; formulae are used but never discussed. | One reasoning question/flashcard. |
| M1 | M | M | frac | 4 | Y4: "round decimals with 1 decimal place to the nearest whole number" (2 d.p. to 1 d.p. is Y5) | frac-y4-05 "Round 6.47 to 1 decimal place", the Y4 note (rounding 5.86 to 1 d.p.) and a flashcard teach the Y5 skill, while the Y4 skill (1 d.p. to nearest whole) is missing. Y4 objective text also says "Round decimals with one decimal place to the nearest whole number", so question/note contradict their own objective. | Change frac-y4-05, note and flashcard to "round 6.7 to the nearest whole number"; move the 2 d.p.-to-1 d.p. version to Y5. |
| M2 | M | L | pos | 6 | Y6 position/direction: "describe positions on the full coordinate grid (all 4 quadrants)"; "draw and translate ... reflect them in the axes" | pos-y6-10 and its flashcard ask for the midpoint of a line segment. Midpoint is not in the KS2 programme (it is GCSE/KS3-plus). | Reword as "halfway along the line" only if kept, or replace with a translation/reflection question. |
| M3 | M | L | shape | 6 | "find unknown angles in any triangles, quadrilaterals, and regular polygons" | shape-y6-06 finds the missing angle of an irregular pentagon (angle sum given in the prompt). Irregular pentagons are outside the statement. | Use a regular polygon or a quadrilateral. |
| W1 | W | L | md | 6 | "use their knowledge of the order of operations" | Objective adds "(BIDMAS)". The DfE never names a mnemonic; harmless but not the official wording. | Keep as a teaching aid, but state the official phrase in the objective. |

Not flagged (checked and fine): `notIntroduced` claims for alg Y3-5, rp Y3-5 and pos Y3 all match the programme; Roman numerals, area, perimeter, angles, coordinates, pie charts and mean are in the correct years.

## 6. maths-ks3 (Y7-9)

Only six topics exist (alg, geo, num, prob, rp, stats); several official strands are thinly covered. Items covered only in KS4 are noted.

| # | Cat | Sev | Topic key | Year | Official reference | Finding | Recommended fix |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | G | M | alg | 7-9 | "understand and use standard mathematical formulae; rearrange formulae to change the subject" | No rearranging at KS3 (first appears in maths-ks4 alg Y10). | Add to Y8 or Y9 alg. |
| 2 | G | L | alg | 7-9 | "work with coordinates in all 4 quadrants" | No explicit coverage (negative coordinates only incidentally in geo-y8-08). | Add a 4-quadrant plotting question in Y7 or Y8. |
| 3 | G | M | alg | 8-9 | "recognise, sketch and produce graphs of linear and quadratic functions"; "use linear and quadratic graphs to estimate values of y ... and to find approximate solutions of simultaneous linear equations"; "find approximate solutions to contextual problems from given graphs of ... piece-wise linear, exponential and reciprocal graphs" | No quadratic, exponential, reciprocal or piecewise graphs; no graph-based solving. | Add a graphs objective/question set (Y9). |
| 4 | G | M | alg | 8 | "recognise geometric sequences and appreciate other sequences that arise" | Only arithmetic sequences. | Add geometric sequence questions in Y8. |
| 5 | G | M | geo | 7-9 | "use the properties of faces, surfaces, edges and vertices of cubes, cuboids, prisms, cylinders, pyramids, cones and spheres to solve problems in 3-D" | No 3-D solid properties at all. | Add a 3-D shapes objective + questions. |
| 6 | G | M | geo | 7-8 | "draw and measure line segments and angles in geometric figures, including interpreting scale drawings" | Not covered (no protractor/scale-drawing work). | Add to Y7. |
| 7 | G | L | geo | 8 | "standard ruler and compass constructions (... perpendicular to a given line from/at a given point, bisecting a given angle); recognise ... the perpendicular distance from a point to a line as the shortest distance" | Only the perpendicular bisector (geo-y8-03). | Add angle bisector and perpendicular-from-a-point questions. |
| 8 | G | L | geo | 7-8 | "describe, sketch and draw ... regular polygons, and other polygons that are reflectively and rotationally symmetric" | No line or rotational symmetry. | Add symmetry questions. |
| 9 | G | L | geo | 8 | "volume of cuboids (including cubes) and other prisms (including cylinders)" | Prisms and cuboids only; cylinders absent from KS3 (first in maths-ks4 geo Y10). | Add a cylinder volume question. |
| 10 | G | M | num | 7-8 | "use the 4 operations ... applied to integers, decimals, proper and improper fractions, and mixed numbers, all both positive and negative" | Only fraction addition and fraction-of-amount; no multiplication/division of fractions, no negative fractions (× ÷ fractions first appear in maths-ks4 num Y10). | Add fractions × ÷ (incl. mixed numbers) to Y8. |
| 11 | G | L | num | 7 | "use conventional notation for the priority of operations, including brackets, powers, roots and reciprocals" | Reciprocals not covered. | Add a reciprocal question. |
| 12 | G | L | num | 8 | "express 1 quantity as a percentage of another, compare 2 quantities using percentages" | Percentage of an amount and percentage change covered; "x as a percentage of y" is not. | Add question. |
| 13 | G | M | rp | 8-9 | "solve problems involving percentage change, including ... simple interest in financial mathematics" | Simple interest not covered. | Add simple interest question. |
| 14 | G | L | rp | 7 | "express 1 quantity as a fraction of another, where the fraction is less than 1 and greater than 1" | Not explicit. | Add a fraction-of-another question with an answer above 1. |
| 15 | G | L | prob | 9 | "enumerate sets and unions/intersections of sets systematically" | Venn diagrams used (prob-y9-04/05) but ∪ and ∩ notation never introduced (first in KS4). | Add notation to Y9 note. |
| 16 | G | L | stats | 7 | "pictograms for categorical data, and vertical line (or bar) charts for ungrouped and grouped numerical data" | No pictograms or vertical line charts. | Add one question each. |
| 17 | G | L | num | 7-9 | "use a calculator and other technologies ..."; "appreciate the infinite nature of the sets of integers, real and rational numbers" | Not covered. | Optional reasoning question. |
| O1 | O | M | alg | 9 | GCSE Algebra 19 ("solve two simultaneous equations ... algebraically"); KS3 only asks for approximate graphical solutions | Objective 2 "Solve a pair of simultaneous linear equations by elimination" (alg-y9-04, -09). GCSE content in KS3. | Either keep as deliberate stretch and flag it, or move to KS4 (where alg Y11 already covers simultaneous equations). |
| O2 | O | L | alg | 9 | GCSE Algebra 22 ("solve linear inequalities in one ... variable(s) ... on a number line") ; KS3 lists only inequality vocabulary | Objective 3 and alg-y9-03, -07. | Same as O1. |
| O3 | O | L | alg | 9 | GCSE Algebra 4 ("factorising quadratic expressions of the form x² + bx + c"); KS3 stops at "taking out common factors" and expanding binomials | Objective 4 and alg-y9-06. | Same as O1. |
| O4 | O | M | prob | 9 | GCSE Probability 8 ("independent and dependent combined events, including using tree diagrams") ; KS3: "theoretical sample spaces for single and combined events with equally likely, mutually exclusive outcomes" | Y9 objectives 1 and 3: independent/dependent events, tree diagrams, with vs without replacement (prob-y9-01, 02, 03, 06-10). | Move to KS4 or restrict Y9 to sample spaces and Venn diagrams. |
| O5 | O | L | stats | 9 | GCSE Statistics 4 ("modal class") ; KS3 "measures of central tendency (mean, mode, median)" | Objective 1 (estimated mean, modal class, class containing the median from grouped data; stats-y9-01, 04, 06). | Acceptable as extension; flag it. |
| W1 | W | L | num | 7 | "use conventional notation for the priority of operations" | Objective 3 and note use "BIDMAS" only. | State the official phrase alongside the mnemonic. |

No content was found in the wrong KS3 year in a way that breaks the statutory programme (KS3 is unbroken).

## 7. maths-ks4 (GCSE, Y10-11)

No out-of-scope content found (searched notes/questions for calculus, logarithms, binomial expansion, radians, partial fractions, matrices, series sums, compound-angle formulae: none). Everything present is genuine GCSE content. Y10/Y11 splits look reasonable. The problem is breadth: numbered references are the official GCSE list (Number N, Algebra A, Ratio R, Geometry G, Probability P, Statistics S).

| # | Cat | Sev | Topic key | Year | Official reference | Finding | Recommended fix |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | G | L | num | 10 | N5 "apply systematic listing strategies including use of the product rule for counting" | Not covered anywhere in KS4 or KS3. | Add counting/listing question. |
| 2 | G | L | num | 11 | N15 "use inequality notation to specify simple error intervals due to truncation or rounding" | Rounding intervals covered (num-y11-07); truncation is not. | Add a truncation question. |
| 3 | G | L | alg | 10 | A6 "know the difference between an equation and an identity" | No identities (≡). | Add note + question. |
| 4 | G | H | alg | 10-11 | A12 "recognise, sketch and interpret graphs of linear functions, quadratic functions, simple cubic functions, the reciprocal function y = 1/x with x ≠ 0, exponential functions y = k^x ... and the trigonometric functions y = sin x, y = cos x and y = tan x for angles of any size" | Only straight-line and one quadratic turning-point question; no cubic, reciprocal, exponential or trigonometric graphs. | Add a graphs block to Y10/Y11 alg. |
| 5 | G | M | alg | 11 | A13 "sketch translations and reflections of a given function" | Not covered. | Add y = f(x) transformation questions. |
| 6 | G | M | alg | 11 | A14-15 "plot and interpret graphs ... to find approximate solutions to problems such as simple kinematic problems"; "calculate or estimate gradients of graphs and areas under graphs" | No distance-time / velocity-time interpretation, no areas under graphs. | Add to alg or rp Y11. |
| 7 | G | M | alg | 11 | A16 "recognise and use the equation of a circle with centre at the origin; find the equation of a tangent to a circle at a given point" | Circle appears only inside a simultaneous-equation question (alg-y11-10); no circle equation or tangent work. | Add circle equation/tangent questions. |
| 8 | G | M | alg | 11 | A22 "solve linear inequalities in one or two variable(s), and quadratic inequalities in one variable; represent the solution set on a number line, using set notation and on a graph" | Only linear inequalities in one variable (alg-y10-07). | Add quadratic and two-variable (region) inequalities. |
| 9 | G | M | alg | 10-11 | A24-25 "sequences of triangular, square and cube numbers, ... Fibonacci type sequences, quadratic sequences, and simple geometric progressions"; "nth term of linear and quadratic sequences" | Only linear nth term. | Add quadratic nth term, geometric and Fibonacci-type sequences. |
| 10 | G | M | rp | 11 | R15 "interpret the gradient at a point on a curve as the instantaneous rate of change; ... (gradients of chords and tangents)" | Not covered. | Add tangent-gradient / chord questions. |
| 11 | G | M | geo | 10-11 | G2 "standard ruler and compass constructions ...; use these to construct given figures and solve loci problems; know that the perpendicular distance from a point to a line is the shortest distance" | No constructions or loci (also missing at KS3, see KS3 #7). | Add constructions/loci questions. |
| 12 | G | L | geo | 10 | G13 "construct and interpret plans and elevations of 3D shapes" | Not covered. | Add. |
| 13 | G | M | geo | 10 | G15 "measure line segments and angles ... use of bearings" | No bearings. | Add. |
| 14 | G | L | geo | 10 | G7-8 "(including fractional and negative scale factors)"; "describe the changes and invariance achieved by combinations of rotations, reflections and translations" | Fractional scale factor covered (geo-y10-08); negative scale factors and combined transformations are not. | Add. |
| 15 | G | M | geo | 10-11 | G17 "surface area and volume of spheres, pyramids, cones and composite solids" | Volumes of cylinder, cone, prism covered; no surface areas, no sphere/pyramid/composite-solid questions despite the objective naming spheres. | Add surface-area and sphere/pyramid questions. |
| 16 | G | M | geo | 10-11 | G21 "know the exact values of sinθ and cosθ for θ = 0°, 30°, 45°, 60° and 90°; ... tanθ for θ = 0°, 30°, 45° and 60°" | No exact trig values. | Add. |
| 17 | G | M | geo | 11 | G10 "apply and prove the standard circle theorems concerning angles, radii, tangents and chords" | Only two questions (geo-y11-01, -04): no alternate-segment, cyclic quadrilateral or tangent theorems, no proofs. | Broaden to several theorems. |
| 18 | G | L | prob | 10 | P1 "record, describe and analyse the frequency of outcomes of probability experiments using tables and frequency trees" | No frequency trees. | Add. |
| 19 | G | L | stats | 10-11 | S2 "tables and line graphs for time series data" | No time series. | Add. |
| 20 | G | L | stats | 10 | S4 "modal class"; S5 "apply statistics to describe a population"; S6 "recognise correlation and know that it does not indicate causation" | Modal class, population description and correlation-vs-causation are absent. | Add. |
| W1 | W | L | alg | 11 | A19 "solve two simultaneous equations in two variables (linear/linear or linear/quadratic)" | Objective says "one linear and one non-linear". A circle (alg-y11-10) is not "linear/quadratic" as worded; it is borderline GCSE-Higher. | Reword to "linear/quadratic" and keep circle only if the circle-equation item (A16) is also taught. |

## 8. maths-ks5 (A-level, Y12 = AS, Y13 = A2)

References are the DfE content codes (A Proof ... S Moments). Where I say "A2-only" the statement has no square brackets in the DfE text.

### 8a. Out of scope (beyond DfE AS/A level maths)

| # | Cat | Sev | Topic key | Year | Official reference | Finding | Recommended fix |
| --- | --- | --- | --- | --- | --- | --- | --- |
| O1 | O | H | vec | 13 | Appendix A, 9.12 "a.b the scalar product of a and b" is listed under "Vectors (Further Mathematics only)" | Objective 4 and vec-y13-01, -04, -10, -11 (scalar product, angle between vectors/lines, perpendicularity test). Further Maths content. | Remove, or move to a Further Maths pack; replace with in-scope A2 vector work (3-D position vectors, vectors in kinematics/forces; DfE J1-J5). |
| O2 | O | H | vec | 13 | J1-J5 cover 2-D and 3-D vectors, magnitude/direction, add/scale, position vectors, distance between two points, forces/kinematics. No vector equation of a line, skew lines or point-line distance. | Objectives 2, 3, 5 and vec-y13-02, -05, -06, -07, -09, -12, -13 (r = a + λb, intersect/skew, collinearity, perpendicular distance). Together with O1 this is 11 of 13 Y13 questions. | Same as O1. Only vec-y13-03 and -08 fit the DfE list. |
| O3 | O | H | stat5 | 13 | N2 "Understand and use the Normal distribution as a model ... Link to histograms, mean, standard deviation, points of inflection and the binomial distribution" (no approximation) | Objective 2 and stat5-y13-08, -14: normal approximation to the binomial with continuity correction. Not in the DfE list (I am confident it is not required; verify against the target exam board if it is wanted as an extension). | Remove or label as extension. |
| O4 | O | M | stat5 | 13 | L2 "(calculations involving regression lines are excluded)"; O1 "(calculation of correlation coefficients is excluded)" | Objective 4 "use linear regression"; stat5-y13-09 asks students to find the regression coefficient b. Interpretation/prediction from a given line (stat5-y13-03, -10) and using a given critical value (stat5-y13-12) are in scope. | Change stat5-y13-09 to interpret a given line; reword objective 4. |
| O5 | O | M | algf | 13 | B10 "partial fractions (denominators not more complicated than squared linear terms and with no more than 3 terms, numerators constant or linear)" | Objective 5 "improper fractions" and algf-y13-08 (numerator 2x² + 5x + 5 over a quadratic denominator). Numerator is quadratic. | Drop improper case, or label extension. |
| O6 | O | L | algf | 13 | B7 "the modulus of a linear function" | Objective 4 "sketch y = |f(x)|" and algf-y13-09 (|x² − 4|) go beyond a linear argument. Borderline: most boards examine |f(x)|. | Label as extension or keep to linear arguments. |
| O7 | O | L | stat5 | 12 | K1 names "simple random sampling and opportunity sampling" (the list says "including") | Objective 1 and stat5-y12-02, -03 add systematic, stratified, quota. Acceptable given "including"; not DfE-named. | Note only. |
| O8 | O | L | mech | 12 | Q2 "displacement against time ... velocity against time" | Objective 1 also lists acceleration-time graphs. | Note only. |
| O9 | O | L | diff | 13 | G2 lists derivatives of e^kx, a^kx, sin kx, cos kx, tan kx, ln x; sec x is not listed | diff-y13-13 "Show that d/dx (sec x) = sec x tan x". Provable from the quotient rule, so borderline. | Note only. |

### 8b. Misplaced (AS vs A2 per the DfE brackets)

The pack brief says AS = Y12, A2 = Y13. Many A-level courses co-teach Y12 content beyond the DfE AS list, so treat these as "label / reorder" items rather than errors, except where noted.

| # | Cat | Sev | Topic key | Year | Official reference | Finding | Recommended fix |
| --- | --- | --- | --- | --- | --- | --- | --- |
| M1 | M | M | seq | 12 | D1 (binomial, positive integer n) is AS; D2-D6 (sequences by formula, sigma notation, arithmetic, geometric, sum to infinity, modelling) are A2-only | Objectives 2-5 and seq-y12-01, -03 to -06, -08 to -13 are A2-only content filed under Y12. AS content in the DfE list is just the binomial expansion. | Decide the convention: either keep (and tag the subtopic "A-level Y12") or move arithmetic/geometric series to Y13. |
| M2 | M | M | trig | 12 | E1 "Work with radian measure, including use for arc length and area of sector" and E3 "exact values of sin and cos for 0, π/6, π/4, π/3, π/2" are A2-only; AS uses degrees | Objectives 1-2 and trig-y12-01, -04, -05 (radians, arc length, sector area). trig-y12-13 (E8 "construct proofs involving trigonometric functions and identities", A2-only). | Move radians to Y13 (or tag as A-level Y12). |
| M3 | M | L | integ | 12 | H3 "the area between two curves" and H4 "integration as the limit of a sum" are A2-only | Objectives 4-5 (part) and integ-y12-08 (area between a line and a curve). integ-y12-13 (area between curve and axis) is AS. | Move to Y13 or tag. |
| M4 | M | L | vec | 12 | J1 "Use vectors in two dimensions] and in three dimensions" - 3-D is A2-only | Objective 6 and vec-y12-09, -10 (3-D magnitude/unit vectors). | Move to Y13. |
| M5 | M | L | mech | 12 | R2 "restricted to forces in two perpendicular directions or simple cases of forces given as 2-D vectors" at AS; "extend to situations where forces need to be resolved" is A2-only | Objective 4 "resolve forces into components" and mech-y12-09 (force at 30° to the horizontal). | Move to Y13 or tag. |
| M6 | M | L | mech | 13 | Q4 "Use calculus in kinematics for motion in a straight line" is AS | mech-y13-08, -09 (v = 3t² − 4t) belong in Y12; Y12 has no calculus kinematics at all. | Move to Y12 mech. |
| M7 | M | L | explog | 13 | F6 "use logarithmic graphs to estimate parameters in relationships of the form y = ax^n and y = kb^x" is AS | Y12 covers y = a b^x only; y = a x^n is deferred to Y13 (objective 4, explog-y13-10). | Move y = a x^n to Y12. |

### 8c. Gaps

| # | Cat | Sev | Topic key | Year | Official reference | Finding | Recommended fix |
| --- | --- | --- | --- | --- | --- | --- | --- |
| G1 | G | M | mech | 12 | R4 "Understand and use Newton's third law" | No coverage (only first/second law, weight, connected particles). | Add note + questions. |
| G2 | G | L | mech | 12 | R3 "students should be aware that g is not a universal constant but depends on location" | Not mentioned. | One line in the note. |
| G3 | G | M | algf | 12 | B7 "sketch curves defined by simple equations including polynomials, ... y = a/x and y = a/x² (including their vertical and horizontal asymptotes)" | No reciprocal graphs or asymptotes. | Add. |
| G4 | G | M | algf | 12 | B6 "simple algebraic division ... Simplify rational expressions including by factorising and cancelling" | Factor theorem covered; polynomial division and rational-expression simplification are not. | Add. |
| G5 | G | M | algf | 12 | B5 "Represent linear and quadratic inequalities such as y > x + 1 and y > ax² + bx + c graphically" | Only solving by sign; no graphical regions. | Add. |
| G6 | G | L | algf | 12 | B7 "Understand and use proportional relationships and their graphs"; B11 "Use of functions in modelling" | Not covered. | Add. |
| G7 | G | L | coord | 12 | C1 "Be able to use straight line models in a variety of contexts" | No contextual line models. | Add. |
| G8 | G | L | seq | 12 | D1 "link to binomial probabilities" | Not covered. | Link to stat5 binomial. |
| G9 | G | L | trig | 13 | E9 "Use trigonometric functions to solve problems in context, including problems involving vectors, kinematics and forces" | Not covered. | Add. |
| G10 | G | M | diff / integ | 13 | G6 "Construct simple differential equations in pure mathematics and in context (kinematics, population growth, price and demand)" | Solving separable equations is covered; constructing them from a context is not. | Add. |
| G11 | G | M | stat5 | 12 | DfE paras 9-10 (become familiar with a large data set; use technology); L4 "Be able to clean data, including dealing with missing data, errors and outliers" | No large-data-set or data-cleaning content. | Add a large-data-set note/questions. |
| G12 | G | M | stat5 | 12-13 | M3 "Modelling with probability, including critiquing assumptions"; N3 "Select an appropriate probability distribution ... recognising when the binomial or Normal model may not be appropriate" | No critique/selection questions. | Add. |
| G13 | G | L | numm | 13 | I4 "Use numerical methods to solve problems in context" | Only pure examples. | One in-context problem. |

### 8d. Wording

| # | Cat | Sev | Topic key | Year | Official reference | Finding | Recommended fix |
| --- | --- | --- | --- | --- | --- | --- | --- |
| W1 | W | L | algf | 12 | B6 "use of the factor theorem" | The DfE names only the factor theorem; objective 5, note, algf-y12-08 and a flashcard teach the remainder theorem too. Common on exam boards, not in the DfE list. | Keep, but do not label it DfE. |
| W2 | W | L | stat5 | 13 | O1 "correlation coefficients" | Content uses "PMCC" (an exam-board term). | Say "product moment correlation coefficient (correlation coefficient)". |
| W3 | W | L | algf | 13 | OT1.4 "Understand and use the definition of a function; domain and range" | "one-one and many-one mappings" is not DfE wording. | Optional. |

Checked and correct against the DfE list: proof (A1, proof by contradiction A2), explog F1-F5/F7, diff G1-G5 (the A2 items are in Y13), integ H1-H3, H5-H7 in the right places, numm I1-I3, coord C2-C3, stat5 K1, L1-L3, M1-M2, N1-N2, O1-O3 in the right years.

## 9. Priority list (top issues)

1. maths-ks5 vec Y13: scalar product (explicitly "Further Mathematics only" in Appendix A) and vector equations of lines/skew lines/point-line distance are Further Maths; 11 of 13 questions and 4 of 6 objectives are out of scope.
2. maths-ks5 stat5 Y13: normal approximation to the binomial, and calculating regression/PMCC (DfE excludes those calculations) are out of scope.
3. maths-ks4: the pack skips large parts of the GCSE list: graphs of cubic/reciprocal/exponential/trig functions, function transformations, areas under graphs, quadratic inequalities, quadratic/geometric sequences, constructions/loci, bearings, plans/elevations, exact trig values, surface areas.
4. ks2maths: Y6 has no decimal arithmetic or rounding-to-accuracy; Y4 has no negative numbers and its rounding question (frac-y4-05) is Y5 content; Y3-4 fractions miss comparing/ordering and same-denominator addition in Y4.
5. maths-ks3: Y9 pulls in GCSE content (elimination, inequalities, factorising quadratics, tree diagrams) while the KS3 programme's 3-D shape properties, fraction multiplication/division, geometric sequences, rearranging formulae and quadratic graphs are missing.
