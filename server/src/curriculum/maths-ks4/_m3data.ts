// Shared DATA for the maths-ks4 pictures. The generator (scratch/curriculum-images/gen-m3.ts) draws every PNG from
// these values and _check_m3.ts recomputes the answer keys from the same values, so picture and key cannot disagree.

export const TRIG = { hyp: 12, angle: 35 }; // right angle at B, angle at A, hypotenuse AC, x = BC (opposite)
export const CIRC = { centreAngle: 110 }; // angle AOB at the centre; x = ACB at the circumference (C on the major arc)
export const COS = { p: 8, q: 11, angle: 40 }; // two sides enclosing the angle; x is the third side
export const LINE = { m: 2, c: -3 }; // y = mx + c
export const QUAD = { a: 1, b: -2, c: -3 }; // y = ax² + bx + c
export const VENN10 = { total: 30, frenchOnly: 9, both: 5, spanishOnly: 7, neither: 9 };
export const TREE = { pGreen: 0.3 };

/** Venn for the whole numbers 1..20: A = even, B = multiples of 3 (Year 11 probability). */
export const VENN11 = (() => {
  const U = Array.from({ length: 20 }, (_, i) => i + 1);
  const inA = (n: number) => n % 2 === 0, inB = (n: number) => n % 3 === 0;
  return {
    U, inA, inB,
    aOnly: U.filter((n) => inA(n) && !inB(n)),
    both: U.filter((n) => inA(n) && inB(n)),
    bOnly: U.filter((n) => !inA(n) && inB(n)),
    neither: U.filter((n) => !inA(n) && !inB(n)),
  };
})();

/** Scatter graph (Year 10 statistics): hours of revision (x) against test score (y, out of 80), with a line of best fit y = 5x + 20. */
export const SCATTER = {
  points: [[1, 24], [2, 33], [3, 33], [4, 42], [5, 44], [6, 52], [7, 52], [8, 62], [9, 63], [10, 72]] as [number, number][],
  line: { m: 5, c: 20 },
};

/** Histogram (Year 11): time taken in minutes. [lower, upper, frequency] — only frequency density is drawn. */
export const HIST: [number, number, number][] = [[0, 10, 8], [10, 20, 18], [20, 30, 26], [30, 50, 30], [50, 80, 18]];

/** Box plots (Year 11): test scores of two classes. */
export const BOX = {
  A: { min: 20, q1: 35, med: 50, q3: 70, max: 90 },
  B: { min: 30, q1: 45, med: 55, q3: 65, max: 80 },
};

/** Cumulative frequency (Year 11): heights in cm of 100 students. [upper class boundary, cumulative frequency] */
export const CF: [number, number][] = [[140, 0], [150, 10], [160, 25], [170, 50], [180, 75], [190, 90], [200, 100]];
