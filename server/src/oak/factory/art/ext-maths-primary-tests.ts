// Policy tests for the Maths KS1-KS2 extension pictures (agent X1): every picture gets a POSITIVE test (a slide on its concept gets it, in KS1 and KS2),
// the automatic NEGATIVES (same slide on a practice slide, in KS4, and, for `numeric` pictures, with digits in the text) and, where the picture has an
// `avoid` / `requires` gate, a targeted negative slide about the other meaning of the word.
import { chooseArt } from "./select";
import { PIC_BY_ID } from "./library";
import { EXT_MATHS_PRIMARY } from "./ext-maths-primary";
import type { Slide } from "../../../../../features/learninghub/lesson/slides/types";

type Row = { id: string; title: string; lead: string; neg: [string, string][] };
const R = (id: string, title: string, lead: string, ...neg: [string, string][]): Row => ({ id, title, lead, neg });
const ROWS: Row[] = [
  R("base-ten-blocks", "Base 10 blocks", "We use base 10 blocks to show ones, tens and hundreds.", ["Base 10 and base 2", "Compare base 10 numbers with base 2 binary numbers."]),
  R("regrouping", "Regrouping", "Regrouping means exchanging ten ones for one ten."),
  R("tens-and-ones", "Tens and ones", "A two digit number is made of tens and ones."),
  R("hundreds-tens-ones", "Hundreds, tens and ones", "Numbers are built from hundreds tens and ones.", ["Crossing the hundreds boundary", "Crossing the hundreds boundary changes the hundreds digit."]),
  R("count-forwards-backwards", "Counting forwards and backwards", "We can count forwards and backwards along a number line."),
  R("skip-counting", "Skip counting", "Skip counting means counting in equal steps."),
  R("multiples", "Multiples", "A multiple of a number is in its times table.", ["Multiple groups", "Compare multiple groups of objects using more than and fewer than."], ["Multiple choice", "Answer the multiple choice question about a number."]),
  R("multiples-of-ten", "Multiples of ten", "Multiples of ten all end in a zero.", ["Multiples of 100", "Count in multiples of 100."]),
  R("bridging-ten", "Bridging through ten", "We bridge through ten to add a one digit number.", ["Bridging through 100", "Bridge 100 by jumping to the next hundred."], ["Add without crossing the tens boundary", "We add two digit numbers without crossing the tens boundary."]),
  R("addition-terms", "Addends and the sum", "When we add, the addends are the numbers added and the sum is the total.", ["Sum of angles", "The sum of the angles in a triangle is found with addition."]),
  R("subtraction-terms", "Minuend and subtrahend", "In a subtraction the minuend is the number we start with and the difference is what is left.", ["Differences between shapes", "Find the difference between the shapes and describe it."]),
  R("multiplication-terms", "Factors and product", "In a multiplication the factors are multiplied to make the product.", ["Scale factor", "Use the scale factor to enlarge a shape by multiplying."]),
  R("division-terms", "Dividend and divisor", "In a division the dividend is divided by the divisor to give the quotient."),
  R("inverse-operations", "Inverse operations", "Addition and subtraction are inverse operations."),
  R("equal-groups", "Equal groups", "We can show multiplication as equal groups and repeated addition."),
  R("sharing-grouping", "Sharing and grouping", "Division can mean sharing equally or grouping. We divide to find each share.", ["Sorting and grouping", "Sorting and grouping data into a tally chart."]),
  R("multiplication-grid", "Times tables", "The times table grid shows all the products.", ["Times the size", "The shape is three times the size of the original."]),
  R("expanded-multiplication", "Expanded multiplication", "Expanded multiplication splits the number into tens and ones."),
  R("short-multiplication", "Short multiplication", "Short multiplication is a written method."),
  R("long-multiplication", "Long multiplication", "Long multiplication multiplies by tens and ones."),
  R("column-addition", "Column addition", "Column addition lines up the digits by place value."),
  R("column-subtraction", "Column subtraction", "Column subtraction lines up the digits by place value."),
  R("short-division", "Short division", "Short division is also called the bus stop method."),
  R("long-division", "Long division", "Long division divides by a two digit number."),
  R("doubling-halving", "Doubling and halving", "Double a number by making two equal groups and halve it by sharing between two.", ["Double number line", "Use a double number line to scale up."]),
  R("odd-even-numbers", "Odd and even numbers", "Even numbers can be shared into pairs with none left over.", ["The odd one out", "Find the odd one out."]),
  R("compare-symbols", "Comparing numbers", "We use greater than and less than symbols to compare numbers.", ["One less", "Find 10 less than a number using a number line."], ["Numbers less than zero", "Interpret numbers greater than and less than zero in temperatures."]),
  R("more-than-fewer-than", "More than and fewer than", "Match objects to find which group has fewer.", ["More than two parts", "A whole group can be split into more than two parts."]),
  R("ascending-descending", "Ascending and descending order", "Ascending order goes from smallest to largest."),
  R("one-more-one-less", "One more and one less", "One more than a number is the next number."),
  R("number-bonds-to-10", "Number bonds to 10", "Number bonds to 10 are pairs that make 10.", ["Number bonds to 20", "Number bonds to 20 use the bonds to 10."]),
  R("part-and-whole", "Whole and parts", "The whole is made of parts.", ["Whole numbers", "Whole numbers have no fraction part."], ["Whole metres", "Measure length from zero using whole metres and centimetres."], ["Equal parts", "The whole is made of equal parts or unequal parts."]),
  R("rounding-number-line", "Rounding", "Rounding to the nearest multiple uses the halfway point.", ["Rounding significant figures", "Rounding to one significant figure."]),
  R("roman-numerals", "Roman numerals", "Roman numerals use letters such as I, V and X."),
  R("square-numbers", "Square numbers", "Square numbers make a square of dots.", ["Square numbers and square roots", "Square numbers and their square roots."]),
  R("cube-numbers", "Cube numbers", "Cube numbers are made from cubes.", ["Cube numbers and cube roots", "Cube numbers and their cube root."]),
  R("prime-numbers", "Prime numbers", "A prime number has exactly two factors.", ["Prime factors", "Write a number as a product of prime factors."]),
  R("factor-pairs", "Factor pairs", "Factor pairs multiply to make a number.", ["Factors of square numbers", "A square number has an odd number of factors."]),
  R("divisibility-rules", "Divisibility rules", "Divisibility rules tell us when a number can be divided exactly.", ["Divisible by 7", "A number that is divisible by 7 has a special test."]),
  R("uk-coins", "Coins", "Coins have different values in pence.", ["Coin toss", "Flip a coin and record heads or tails."]),
  R("uk-banknotes", "Banknotes", "A banknote is paper money."),
  R("clock-time-words", "Half past", "Half past is when the minute hand points to the bottom of the clock."),
  R("clock-minutes", "Minutes past and minutes to", "Minutes past the hour are on the right of the clock."),
  R("digital-24-hour", "24 hour clock", "The 24 hour clock uses digital time.", ["Analogue and digital", "Digital clocks and analogue clocks."]),
  R("units-of-time", "Units of time", "We convert between hours and minutes."),
  R("days-of-the-week", "Days of the week", "There are seven days of the week."),
  R("months-of-the-year", "Months of the year", "There are twelve months of the year."),
  R("length-units", "Centimetres and millimetres", "There are millimetres in a centimetre.", ["Area in square centimetres", "Area is measured in square centimetres."]),
  R("measure-length", "Measure length", "We measure length with a ruler."),
  R("compare-lengths", "Comparing lengths", "Compare lengths to find the longest and the shortest.", ["Longer method", "A longer method takes more time."]),
  R("balance-scales", "Heavier and lighter", "Balance scales show which object is heavier."),
  R("mass-units", "Grams and kilograms", "Mass is measured in grams and kilograms.", ["Atomic mass", "The atomic mass of an atom."]),
  R("capacity-jug", "Capacity", "Capacity is measured in litres and millilitres."),
  R("thermometer", "Temperature", "A thermometer measures temperature."),
  R("triangle", "Triangles", "A triangle has three sides.", ["Pythagoras", "The hypotenuse of a right angled triangle uses Pythagoras."]),
  R("shapes-2d", "2D shapes", "We name 2D shapes such as circles and squares."),
  R("shapes-3d", "3D shapes", "We name 3D shapes such as cubes and spheres."),
  // image-QA gate: the composite now draws a prism AND a pyramid, so a prisms-and-pyramids slide gets it; solids it does not draw veto it
  R("shapes-3d", "3D shapes: prisms and pyramids", "A prism is a 3D shape with two identical polygon faces joined by rectangular faces. A pyramid is a 3D shape with a base and an apex.", ["Hemispheres", "A hemisphere is a 3D shape that is half a sphere."], ["Tetrahedra", "A tetrahedron is a 3D shape with four triangular faces."]),
  R("sides-and-vertices", "Sides and vertices", "A shape has sides and vertices.", ["Vertices of a cube", "A cube is a 3D shape with vertices, faces and edges."]),
  R("turns", "Quarter turns", "A quarter turn is a turn clockwise or anticlockwise."),
  R("equal-and-unequal-parts", "Equal parts", "Equal parts are all the same size."),
  R("fifths", "Fifths", "A whole cut into five equal parts gives fifths.", ["The fifth in line", "Who is the fifth in the queue?"]),
  R("sixths", "Sixths", "A whole cut into six equal parts gives sixths."),
  R("eighths", "Eighths", "A whole cut into eight equal parts gives eighths."),
  R("fraction-of-an-amount", "Fraction of an amount", "To find a fraction of an amount divide by the denominator."),
  R("fractions-on-a-number-line", "Fractions on a number line", "Fractions on a number line sit between zero and one."),
  R("fraction-decimal-equivalents", "Decimal equivalents", "Every fraction has a decimal equivalent.", ["Positioning fractions and decimals", "Fractions and decimals can be positive or negative on a number line."]),
  R("percentages", "Percentages", "A percentage is a number out of one hundred.", ["Percentage increase", "A percentage increase of a price."]),
  R("mean-average", "The mean", "The mean average of a set of data is found by sharing equally."),
  R("equation", "Equations", "An equation has an equals sign.", ["Quadratic equations", "Solve the quadratic equation by factorising."]),
  R("zero", "Zero", "Zero shows that there is no amount.", ["Zero as a placeholder", "Zero is a placeholder in place value."], ["Numbers less than zero", "Negative numbers are less than zero."]),
  R("ordinal-numbers", "Ordinal numbers", "Ordinal numbers tell us position."),
  R("digits", "Digits", "A number is made of digits.", ["Digit sum", "The digit sum of a number is used in divisibility."], ["Two digit numbers", "We add two digit numbers."]),
  R("scale-intervals", "Reading scales", "When reading scales look at the size of each interval.", ["Time intervals on a clock", "Reading scales on a clock face shows time intervals."]),
  R("bridging-hundred", "Crossing the hundreds boundary", "Crossing the hundreds boundary changes the hundreds digit."),
  R("unitising", "Unitising", "Unitising treats a group as one unit."),
  R("placeholder-zero", "Placeholder", "A placeholder holds a place in a number."),
  R("data-table", "A table", "Record the results in a table with rows and columns.", ["Times table", "Use the times table to record the results in rows and columns."]),
  R("partitioning", "Partitioning", "Partitioning splits a whole into smaller parts."),
  R("compose-decompose", "Composing and decomposing", "To compose is to combine parts and to decompose is to break a whole into parts.", ["Composite numbers", "A composite number has more than two factors."]),
  R("estimate", "Estimating", "An estimate is a sensible value close to the right answer.", ["Estimate the angle", "Estimate the angle before measuring it."]),
  R("missing-part", "Finding a missing part", "When the whole and one part are known we can find the missing part.", ["Missing whole", "Find the missing whole when both parts are known."], ["Percentage part", "If I know the whole, I can calculate the value of a part using percentages."]),
  R("angle", "Angles", "An angle is the amount of turn between two lines.", ["Acute angles", "Acute angles are smaller than a right angle."]),
];

const got = (kind: Slide["kind"], title: string, lead: string, ks: string) => chooseArt({ kind, title, blocks: [{ t: "lead", text: lead }] }, { subject: "Maths", keyStage: ks, lessonTitle: "" }).pics;

/** returns the problems (empty = all pass) and the number of tests run */
export function runExtMathsPrimaryTests(): { problems: string[]; tests: number } {
  const bad: string[] = [];
  let tests = 0;
  const have = new Set(ROWS.map((r) => r.id));
  for (const p of EXT_MATHS_PRIMARY) if (!have.has(p.id)) bad.push(`X1: picture ${p.id} has no test row`);
  for (const r of ROWS) {
    const p = PIC_BY_ID[r.id];
    if (!p) { bad.push(`X1 test row for unknown picture ${r.id}`); continue; }
    for (const ks of ["ks1", "ks2"]) { tests++; if (!got("explain", r.title, r.lead, ks).includes(r.id)) bad.push(`X1 TEST ${r.id} (${ks}): "${r.title}" should get the picture`); }
    tests++; if (got("explain", r.title, r.lead, "ks4").includes(r.id)) bad.push(`X1 TEST ${r.id}: must not appear in KS4`);
    tests++; if (got("practice", r.title, r.lead, "ks2").length) bad.push(`X1 TEST ${r.id}: a practice slide must get no picture`);
    if (p.numeric) { tests++; if (got("explain", r.title, `${r.lead} For example 12 and 5.`, "ks2").includes(r.id)) bad.push(`X1 TEST ${r.id}: a numeric picture must be refused when the slide has digits`); }
    for (const [t, l] of r.neg) { tests++; if (got("explain", t, l, "ks2").includes(r.id)) bad.push(`X1 TEST ${r.id}: "${t}" must NOT get this picture`); }
  }
  return { problems: bad, tests };
}
