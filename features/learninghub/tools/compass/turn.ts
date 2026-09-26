// Pure compass logic: a heading in degrees clockwise from North, and turns applied to it. The tool draws the arrow; it never prints the direction's name
// (a question like "you start facing North, turn 90° clockwise, then 270° anticlockwise — which way now?" is answered by the child reading the rose).
export const norm = (h: number) => ((h % 360) + 360) % 360;
/** Apply a turn: positive = clockwise, negative = anticlockwise. */
export const turn = (heading: number, deg: number) => norm(heading + deg);
const NAMES = ["North", "North-east", "East", "South-east", "South", "South-west", "West", "North-west"];
/** The nearest of the 8 points of the compass (used for tests and for the tutor, never shown to the child on the rose). */
export const pointName = (heading: number) => NAMES[Math.round(norm(heading) / 45) % 8]!;
/** Snap a dragged heading to the nearest 45°. */
export const snap45 = (heading: number) => norm(Math.round(heading / 45) * 45);
