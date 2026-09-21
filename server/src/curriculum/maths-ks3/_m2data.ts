// Shared DATA for the maths-ks3 pictures (drawn by scratch/curriculum-images/gen-m2.ts) and the answer checker
// (_check_m2.ts). Change a number here and BOTH the PNG and the recomputed answer move together.
export type Pt = [number, number];

export const D = {
  numline: { min: -3, max: 1, step: 0.5, arrow: -1.5 },
  angLine: { known: 68 }, // angles on a straight line: 68 + x = 180
  triAng: { a: 47, b: 72 }, // third angle x
  trap: { a: 7, b: 11, h: 5 },
  prism: { base: 6, height: 4, length: 10 }, // right-angled triangular prism
  pyth: { a: 6, b: 8 }, // hypotenuse x
  trig: { angle: 30, hyp: 10 }, // opposite = x
  sim: { ab: 4, ac: 6, de: 10 }, // ABC ~ DEF: AB=4, AC=6, DE=10, DF = x
  line: { m: 2, c: -1 }, // y = 2x − 1 on a grid
  bar7: { title: "Favourite fruit in Class 7T", cats: ["Apple", "Banana", "Orange", "Grape"], values: [7, 12, 5, 9], yMax: 14, label: 2, yTitle: "Number of pupils" },
  scat: {
    title: "Hours of revision and test score",
    pts: [[1, 33], [2, 46], [3, 44], [4, 58], [5, 63], [6, 61], [7, 76], [8, 80], [9, 88], [10, 85]] as Pt[],
    line: { c: 30, m: 6 }, // line of best fit: score = 30 + 6 × hours
    xMax: 10, yMax: 100,
  },
  pie: { title: "How 240 pupils travel to school", slices: [["Walk", 120], ["Bus", 90], ["Car", 60], ["Cycle", 90]] as [string, number][], total: 240 },
  misl: { title: "Cakes sold this week", cats: ["Mon", "Tue", "Wed"], values: [46, 48, 50], axisMin: 44, axisMax: 50 },
  spin: { sections: ["red", "blue", "green", "red", "yellow", "blue", "green", "red"] },
  venn: { total: 25, football: 8, both: 4, tennis: 5 }, // football-only 8, both 4, tennis-only 5
  tree: { red: 3, blue: 2 }, // pick, replace, pick again
  ratioBar: { a: 3, b: 5, total: 96 },
  dt: { pts: [[0, 0], [1, 24], [1.5, 24], [2, 0]] as Pt[] }, // hours, km
};
