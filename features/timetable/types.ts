// Domain model for the Activity Timetable builder — mirrors the legacy TTB module.

export interface Activity {
  name: string;
  on: boolean;
  whole: boolean;
  exclude: number[]; // group indices excluded from this activity
  place: string; // facility
}

export interface Category {
  id: string;
  name: string;
  color: string;
  acts: Activity[];
}

export interface Listing {
  /** The real listing's id — timetable drafts key on it. */
  id: string;
  name: string;
  venue: string;
  dates: string;
  from: string; // yyyy-mm-dd
  to: string;
  start: string; // HH:MM
  end: string;
  signin: string[];
  signout: string[];
  /** Every ISO date the listing's blocks actually run — days in the range
   * with no session start excluded in the builder. */
  sessionDates?: string[];
  /** The season this listing is tagged to (Setup › Seasons); used to filter
   * the picker so a busy operator can narrow to one season. */
  seasonId?: string | null;
}

export interface Group {
  name: string;
  band: string;
}

export interface DayInfo {
  n: string; // weekday short (Mon…)
  d: string; // "28 Jul"
  iso: string; // yyyy-mm-dd
}

// A single scheduled activity block placed in a grid cell.
export interface Cell {
  name: string;
  color: string;
  cat: string;
  place: string;
}

export type WholeBlock = Cell;

// A row in a day's plan — one of several kinds.
export interface PlanRow {
  type: "signin" | "signout" | "lunch" | "break" | "session";
  time?: string;
  times?: string[];
  cells?: Cell[] | null;
  whole?: WholeBlock;
}

export type Day = PlanRow[];
export type Plan = Day[]; // one Day per date in dayList

export type Mode = "auto" | "manual";
export type ViewMode = "day" | "week" | "month";

export interface GenConfig {
  start: string;
  end: string;
  aps: number; // activities per day
  brk: number; // breaks per day
  lunch: string;
  wholeTimes: string[];
  groups: string[];
}
