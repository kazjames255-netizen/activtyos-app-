import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  Category,
  Cell,
  DayInfo,
  GenConfig,
  Group,
  Listing,
  Mode,
  Plan,
  ViewMode,
} from "./types";
import { CATEGORIES, DEFAULT_GROUPS, FACILITIES, LISTINGS } from "./data";
import { blankWeek, buildDays, genWeek } from "./engine";

const LS_KEY = "aos_ttb_cats_v3";

function loadCats(): Category[] {
  try {
    const x = typeof localStorage !== "undefined" && localStorage.getItem(LS_KEY);
    if (x) {
      const p = JSON.parse(x);
      if (p && p.length) return p;
    }
  } catch {
    /* noop */
  }
  return JSON.parse(JSON.stringify(CATEGORIES));
}

function saveCats(cats: Category[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(cats));
  } catch {
    /* noop */
  }
}

interface TimetableState {
  // Reference data
  CATS: Category[];
  FAC: string[];
  LISTINGS: Listing[];
  groupsList: Group[];

  // Setup inputs
  listingIndex: number;
  curListing: Listing | null;
  dateFrom: string;
  dateTo: string;
  start: string;
  end: string;
  breaks: number;
  lunch: string;
  perDay: number;
  signin: string[];
  signout: string[];
  wholeTimes: string[];
  excluded: Record<string, boolean>;
  enabledCatIds: Record<string, boolean>;
  facOn: Record<string, boolean>;
  openCat: Record<string, boolean>;

  // Build output
  dayList: DayInfo[];
  plan: Plan;
  cur: number;
  mode: Mode;
  view: ViewMode;
  seed: number;
  edit: { r: number; g: number } | null;

  // Navigation
  tab: number; // 0 setup · 1 timetable · 2 publish
  wstep: number; // wizard step 1..7

  // Publish
  share: Record<string, boolean>;
  audience: "booked" | "everyone";
  pubStatus: string | null;

  // actions
  init: () => void;
  groups: () => string[];
  buildConfig: () => GenConfig;

  pickListing: (index: number) => void;
  setDates: (from: string, to: string) => void;
  toggleDate: (iso: string) => void;
  setField: (patch: Partial<Pick<TimetableState, "start" | "end" | "breaks" | "lunch" | "perDay">>) => void;

  addSign: (kind: "signin" | "signout", time: string) => void;
  delSign: (kind: "signin" | "signout", i: number) => void;
  addWhole: (time: string) => void;
  delWhole: (i: number) => void;

  toggleCat: (id: string) => void;
  addGroup: (name: string, band: string) => void;
  delGroup: (i: number) => void;

  toggleFac: (f: string) => void;
  addFac: (name: string) => void;

  toggleCatOpen: (id: string) => void;
  toggleActOn: (cid: string, idx: number) => void;
  setActPlace: (cid: string, idx: number, place: string) => void;
  toggleActWhole: (cid: string, idx: number) => void;
  toggleActGroup: (cid: string, idx: number, gi: number) => void;
  addAct: (cid: string, name: string) => void;
  delAct: (cid: string, idx: number) => void;

  generate: (mode?: Mode) => void;
  regenIfAuto: () => void;
  showDay: (i: number) => void;
  setView: (v: ViewMode) => void;
  setTab: (n: number) => void;
  setWizStep: (n: number) => void;

  cellEdit: (r: number, g: number) => void;
  cellColor: (color: string, name: string) => void;
  cellSave: (name: string) => void;
  cellClear: () => void;
  dropOnCell: (r: number, g: number, payload: string) => void;

  toggleShare: (key: string) => void;
  setAudience: (a: "booked" | "everyone") => void;
  publish: () => void;
}

function groupsFrom(list: Group[]): string[] {
  const src = list && list.length ? list : DEFAULT_GROUPS;
  return src.map((g) => (g.band ? g.name + " (" + g.band + ")" : g.name));
}

export const useTimetableStore = create<TimetableState>()(
  immer((set, get) => ({
    CATS: JSON.parse(JSON.stringify(CATEGORIES)),
    FAC: FACILITIES.slice(),
    LISTINGS,
    groupsList: DEFAULT_GROUPS.map((g) => ({ ...g })),

    listingIndex: 0,
    curListing: null,
    dateFrom: "",
    dateTo: "",
    start: "09:00",
    end: "15:30",
    breaks: 2,
    lunch: "12:00",
    perDay: 6,
    signin: ["08:00", "09:00"],
    signout: ["15:30", "17:30"],
    wholeTimes: ["13:00"],
    excluded: {},
    enabledCatIds: Object.fromEntries(CATEGORIES.map((c) => [c.id, true])),
    facOn: {},
    openCat: {},

    dayList: [],
    plan: [],
    cur: 0,
    mode: "auto",
    view: "day",
    seed: 0,
    edit: null,

    tab: 0,
    wstep: 1,

    share: {},
    audience: "booked",
    pubStatus: null,

    groups: () => groupsFrom(get().groupsList),
    buildConfig: () => {
      const s = get();
      return {
        start: s.start || "09:00",
        end: s.end || "15:30",
        aps: s.perDay || 6,
        brk: s.breaks,
        lunch: s.lunch || "12:00",
        wholeTimes: s.wholeTimes && s.wholeTimes.length ? s.wholeTimes.slice() : ["13:00"],
        groups: groupsFrom(s.groupsList),
      };
    },

    init: () => {
      set((s) => {
        s.CATS = loadCats();
      });
      get().pickListing(0);
      get().generate("auto");
    },

    pickListing: (index) => {
      const L = get().LISTINGS[index] || get().LISTINGS[0];
      set((s) => {
        s.listingIndex = index;
        s.curListing = L;
        s.start = L.start;
        s.end = L.end;
        s.dateFrom = L.from;
        s.dateTo = L.to;
        s.signin = L.signin.slice();
        s.signout = L.signout.slice();
        s.dayList = buildDays(L.from, L.to, s.excluded);
      });
    },

    setDates: (from, to) => {
      set((s) => {
        s.dateFrom = from;
        s.dateTo = to;
        s.dayList = buildDays(from, to, s.excluded);
        s.curListing = null;
      });
      get().regenIfAuto();
    },

    toggleDate: (iso) => {
      if (!iso) return;
      set((s) => {
        s.excluded[iso] = !s.excluded[iso];
        s.dayList = buildDays(s.dateFrom, s.dateTo, s.excluded);
      });
      get().regenIfAuto();
    },

    setField: (patch) => {
      set((s) => Object.assign(s, patch));
      get().regenIfAuto();
    },

    addSign: (kind, time) => {
      if (!time) return;
      set((s) => void s[kind].push(time));
    },
    delSign: (kind, i) => set((s) => void s[kind].splice(i, 1)),
    addWhole: (time) => {
      if (!time) return;
      set((s) => {
        if (s.wholeTimes.indexOf(time) < 0) s.wholeTimes.push(time);
        s.wholeTimes.sort();
      });
      get().regenIfAuto();
    },
    delWhole: (i) => {
      set((s) => void s.wholeTimes.splice(i, 1));
      get().regenIfAuto();
    },

    toggleCat: (id) => set((s) => void (s.enabledCatIds[id] = !s.enabledCatIds[id])),

    addGroup: (name, band) => {
      if (!name.trim()) return;
      set((s) => void s.groupsList.push({ name: name.trim(), band: band.trim() }));
    },
    delGroup: (i) => set((s) => void s.groupsList.splice(i, 1)),

    toggleFac: (f) =>
      set((s) => {
        s.facOn[f] = s.facOn[f] === false;
      }),
    addFac: (name) => {
      const v = name.trim();
      if (!v) return;
      set((s) => {
        if (s.FAC.indexOf(v) < 0) {
          s.FAC.push(v);
          s.facOn[v] = true;
        }
      });
    },

    toggleCatOpen: (id) => set((s) => void (s.openCat[id] = !s.openCat[id])),

    toggleActOn: (cid, idx) =>
      set((s) => {
        const c = s.CATS.find((x) => x.id === cid);
        if (c) {
          c.acts[idx].on = !c.acts[idx].on;
          saveCats(s.CATS);
        }
      }),
    setActPlace: (cid, idx, place) =>
      set((s) => {
        const c = s.CATS.find((x) => x.id === cid);
        if (c) {
          c.acts[idx].place = place;
          saveCats(s.CATS);
        }
      }),
    toggleActWhole: (cid, idx) =>
      set((s) => {
        const c = s.CATS.find((x) => x.id === cid);
        if (c) {
          c.acts[idx].whole = !c.acts[idx].whole;
          saveCats(s.CATS);
        }
      }),
    toggleActGroup: (cid, idx, gi) =>
      set((s) => {
        const c = s.CATS.find((x) => x.id === cid);
        if (!c) return;
        const ex = c.acts[idx].exclude;
        const k = ex.indexOf(gi);
        if (k >= 0) ex.splice(k, 1);
        else ex.push(gi);
        saveCats(s.CATS);
      }),
    addAct: (cid, name) => {
      const n = name.trim();
      if (!n) return;
      set((s) => {
        const c = s.CATS.find((x) => x.id === cid);
        if (!c) return;
        c.acts.push({
          name: n,
          on: true,
          whole: false,
          exclude: [],
          place: c.acts.length ? c.acts[0].place : "Classroom",
        });
        s.openCat[cid] = true;
        saveCats(s.CATS);
      });
    },
    delAct: (cid, idx) =>
      set((s) => {
        const c = s.CATS.find((x) => x.id === cid);
        if (c) {
          c.acts.splice(idx, 1);
          saveCats(s.CATS);
        }
      }),

    generate: (mode) => {
      const s0 = get();
      const cfg = s0.buildConfig();
      set((s) => {
        if (mode) s.mode = mode;
        if (!s.mode) s.mode = "auto";
        if (!mode) s.seed = s.seed + 1;
        s.edit = null;
        if (!s.dayList || !s.dayList.length) s.dayList = buildDays(s.dateFrom, s.dateTo, s.excluded);
        const ctx = {
          dayList: s.dayList,
          CATS: s.CATS,
          enabledIds: new Set(Object.keys(s.enabledCatIds).filter((k) => s.enabledCatIds[k])),
          FAC: s.FAC,
          facOn: s.facOn,
          signin: s.signin,
          signout: s.signout,
          seed: s.seed,
        };
        s.plan = s.mode === "manual" ? blankWeek(cfg, ctx) : genWeek(cfg, ctx);
        s.cur = 0;
      });
    },

    regenIfAuto: () => {
      const s = get();
      if (s.plan && s.plan.length && s.mode !== "manual") s.generate("auto");
    },

    showDay: (i) => set((s) => {
      s.cur = i;
      s.edit = null;
    }),
    setView: (v) => set((s) => void (s.view = v)),
    setTab: (n) => set((s) => void (s.tab = n)),
    setWizStep: (n) => set((s) => void (s.wstep = Math.max(1, Math.min(7, n)))),

    cellEdit: (r, g) => set((s) => void (s.edit = { r, g })),
    cellColor: (color, name) =>
      set((s) => {
        if (!s.edit) return;
        const c = s.plan[s.cur][s.edit.r].cells![s.edit.g];
        c.name = name;
        c.color = color;
      }),
    cellSave: (name) =>
      set((s) => {
        if (!s.edit) return;
        const c = s.plan[s.cur][s.edit.r].cells![s.edit.g];
        c.name = name;
        if (!c.color) c.color = "#64748B";
        s.edit = null;
      }),
    cellClear: () =>
      set((s) => {
        if (!s.edit) return;
        s.plan[s.cur][s.edit.r].cells![s.edit.g] = { name: "", color: "", cat: "", place: "" };
        s.edit = null;
      }),
    dropOnCell: (r, g, payload) =>
      set((s) => {
        const d = (payload || "").split("|");
        const rows = s.plan[s.cur];
        if (!rows || !rows[r] || !rows[r].cells) return;
        if (d[0] === "lib") {
          rows[r].cells![g] = { name: d[1], color: d[2], cat: d[3], place: d[4] || "" };
        } else if (d[0] === "cell") {
          const sr = +d[1];
          const sg = +d[2];
          if (!rows[sr] || !rows[sr].cells) return;
          const tmp = rows[sr].cells![sg];
          rows[sr].cells![sg] = rows[r].cells![g];
          rows[r].cells![g] = tmp;
        }
      }),

    toggleShare: (key) => set((s) => void (s.share[key] = !s.share[key])),
    setAudience: (a) => set((s) => void (s.audience = a)),
    publish: () =>
      set((s) => {
        const who: string[] = [];
        if (s.share.staff) who.push("Staff portal");
        if (s.share.parents) who.push("Parents (" + s.audience + ")");
        s.pubStatus = who.length
          ? "Published ✓ · Visible to: " + who.join(", ") + " · " + (s.dayList.length || 0) + " days · just now"
          : "Pick at least one audience above.";
      }),
  })),
);

export type { Cell };
