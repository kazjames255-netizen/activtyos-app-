// K4 shared DATA: the single source of truth for every picture (drawn by scratch/curriculum-images/gen-k4.ts)
// and for every answer re-computation (_check_k4.ts). Underscore prefix => skipped by validate.ts.
// Change a number here and BOTH the PNG and the check move together, so key and picture cannot disagree.

export type Pt = [number, number];
export const tr = (p: Pt, dx: number, dy: number): Pt => [p[0] + dx, p[1] + dy];
/** reflect in the vertical mirror line x = m */
export const refV = (p: Pt, m: number): Pt => [2 * m - p[0], p[1]];
/** reflect in the horizontal mirror line y = m */
export const refH = (p: Pt, m: number): Pt => [p[0], 2 * m - p[1]];
export const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
export const fmt = (p: Pt) => `(${p[0] < 0 ? "−" : ""}${Math.abs(p[0])}, ${p[1] < 0 ? "−" : ""}${Math.abs(p[1])})`;

// ───────────────────────── POSITION & DIRECTION ─────────────────────────
export const POS = {
  // Y4
  y4grid: { A: [1, 4] as Pt, B: [6, 3] as Pt, C: [4, 1] as Pt, D: [7, 6] as Pt },
  y4map: { Lighthouse: [3, 6] as Pt, Boat: [6, 3] as Pt, Cave: [2, 2] as Pt, "Palm tree": [7, 7] as Pt },
  y4rect: { A: [2, 2] as Pt, B: [6, 2] as Pt, C: [6, 5] as Pt }, // fourth corner D = [A.x, C.y]
  y4move: { P: [2, 3] as Pt, Q: [6, 5] as Pt },
  y4tri: { A: [1, 1] as Pt, B: [5, 1] as Pt, T: [3, 5] as Pt, move: [2, 1] as Pt },
  // Y5
  y5mirror1: { P: [2, 4] as Pt, line: 5 }, // vertical mirror x = 5
  y5shapeA: [[1, 5], [4, 5], [4, 7], [2, 7]] as Pt[], // moved to shape B by y5shift
  y5shift: [5, -3] as Pt,
  y5tri: [[1, 1], [3, 1], [1, 4]] as Pt[], // reflect-pick panels: mirror x = 4
  y5panelMirror: 4,
  y5hmirror: { tri: [[1, 1], [4, 1], [2, 3]] as Pt[], X: [2, 3] as Pt, line: 5 }, // horizontal mirror y = 5
  y5touch: { tri: [[3, 1], [3, 5], [1, 1]] as Pt[], line: 3 }, // mirror x = 3, shape touches the mirror
  // Y6
  y6grid: { A: [3, -2] as Pt, B: [-4, 3] as Pt, C: [-5, -4] as Pt, D: [2, 5] as Pt },
  y6tri: { P: [-4, 1] as Pt, Q: [-1, 1] as Pt, R: [-3, 4] as Pt, move: [5, -3] as Pt },
  y6reflX: { tri: [[-5, 1], [-2, 2], [-4, 4]] as Pt[], P: [-4, 4] as Pt },
  y6rect: { A: [-3, 2] as Pt, B: [4, 2] as Pt, C: [4, -3] as Pt },
  y6move: { P: [-2, 3] as Pt, Q: [3, -1] as Pt },
  y6mid: { E: [-4, 1] as Pt, F: [2, 1] as Pt },
};

// ───────────────────────────── STATISTICS ─────────────────────────────
export const ST = {
  // Y3
  y3pict: { title: "Favourite pets in Class 3", per: 2, rows: [["Cats", 8], ["Dogs", 11], ["Fish", 6], ["Rabbits", 5], ["Hamsters", 4]] as [string, number][] },
  y3bar: { title: "Library books borrowed each day", cats: ["Mon", "Tue", "Wed", "Thu", "Fri"], values: [25, 35, 15, 30, 45], yMax: 50, label: 10, minor: 5, yTitle: "Number of books" },
  y3tally: { title: "Favourite sport", rows: [["Football", 12], ["Cricket", 8], ["Swimming", 15], ["Gymnastics", 6]] as [string, number][] },
  y3table: { title: "Items sold at the school shop", head: ["Item", "Monday", "Tuesday"], rows: [["Pencils", 14, 18], ["Rubbers", 9, 12], ["Rulers", 5, 8]] as [string, number, number][] },
  // Y4
  y4bar: { title: "Cups of hot chocolate sold", cats: ["Mon", "Tue", "Wed", "Thu", "Fri"], values: [60, 90, 40, 110, 70], yMax: 120, label: 20, minor: 10, yTitle: "Cups sold" },
  y4time: { title: "Temperature in a garden shed", xs: ["6 am", "8 am", "10 am", "12 noon", "2 pm", "4 pm", "6 pm"], values: [4, 6, 10, 16, 18, 14, 8], yMax: 20, label: 2, minor: 2, yTitle: "Temperature (°C)", xTitle: "Time of day" },
  y4dbl: { title: "Books read each month", cats: ["Jan", "Feb", "Mar", "Apr"], a: { name: "Class 4A", values: [30, 50, 40, 60] }, b: { name: "Class 4B", values: [20, 40, 60, 30] }, yMax: 70, label: 10, minor: 10, yTitle: "Books read" },
  // Y5
  y5line: { title: "Height of a sunflower", xs: ["0", "1", "2", "3", "4", "5", "6"], values: [5, 15, 25, 40, 50, 55, 60], yMax: 60, label: 10, minor: 5, yTitle: "Height (cm)", xTitle: "Week" },
  y5two: { title: "Average temperature in two towns", xs: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"], a: { name: "Town A", values: [2, 4, 8, 12, 16, 20] }, b: { name: "Town B", values: [6, 8, 10, 10, 12, 14] }, yMax: 22, label: 2, minor: 2, yTitle: "Temperature (°C)", xTitle: "Month" },
  y5timetable: {
    title: "Bus timetable: Oakfield to Town Station",
    head: ["", "Bus 1", "Bus 2", "Bus 3", "Bus 4"],
    rows: [
      ["Oakfield School", "07:40", "08:25", "09:10", "10:00"],
      ["Market Square", "07:55", "08:40", "09:25", "10:15"],
      ["Library", "08:10", "08:55", "09:40", "10:30"],
      ["Park Gates", "08:20", "09:05", "09:50", "10:40"],
      ["Town Station", "08:35", "09:20", "10:05", "10:55"],
    ],
  },
  // rows = classes; columns = books, games, toys, total.  5B's toys cell is hidden ("?") in the picture.
  y5table: { title: "Donations to the school fair", head: ["Class", "Books", "Games", "Toys", "Total"], rows: [["5A", 24, 15, 18, 57], ["5B", 31, 22, 25, 78], ["5C", 20, 17, 28, 65]] as [string, number, number, number, number][], totals: ["All classes", 75, 54, 71, 200], hidden: [1, 3] as [number, number] },
  // Y6
  y6pie1: { title: "Favourite sport of 40 children", total: 40, slices: [["Football", 144], ["Swimming", 90], ["Tennis", 72], ["Gymnastics", 54]] as [string, number][] },
  y6pie2: { title: "How children travel to school", slices: [["Walk", 150], ["Bus", 100], ["Car", 70], ["Bike", 40]] as [string, number][], hidden: "Bike" },
  y6line: { title: "Distance from home on a bike ride", xs: ["0", "10", "20", "30", "40", "50", "60"], values: [0, 2, 4, 4, 4, 10, 16], yMax: 16, label: 2, minor: 1, yTitle: "Distance (km)", xTitle: "Time (minutes)" },
  y6goals: { title: "Goals scored in five matches", cats: ["Match 1", "Match 2", "Match 3", "Match 4", "Match 5"], values: [3, 7, 2, 6, 2], yMax: 8, label: 1, minor: 1, yTitle: "Goals" },
};
