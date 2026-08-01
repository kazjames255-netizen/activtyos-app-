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
import { CATEGORIES, DEFAULT_GROUPS, FACILITIES } from "./data";
import { blankWeek, buildAllDays, buildDays, genWeek } from "./engine";
import { get as apiGet, post as apiPost, put as apiPut, del as apiDel } from "@/lib/api";

// ─────────────────────────────────────────────────────────────────────────
// Fully server-backed:
//   · The listing picker is the tenant's REAL listings (+ their blocks'
//     dates/times), via GET /api/listings?mine=1.
//   · The activity catalog (categories/facilities) lives on the tenant
//     library (`timetable` key) — shared by the whole team, seeded from
//     the built-in starter catalog on first use.
//   · Age groups default from Setup's ratio groups.
//   · The built week autosaves to /api/timetables (debounced), and
//     Publish freezes a copy for the Staff portal / parents via
//     POST /api/timetables/:id/publish.
// ─────────────────────────────────────────────────────────────────────────

/** What GET /api/listings?mine=1 returns, the parts we use. */
interface ApiListing {
  id: string;
  name?: string;
  title?: string;
  archived?: boolean;
  venueId?: string;
  seasonId?: string | null;
  blocks: { id: string; name: string; startDate: string; endDate: string; sessions: { date: string; start: string; end: string }[] }[];
}
interface LibraryDoc {
  venues?: { id: string; name: string }[];
  timetable?: { cats?: Category[]; facilities?: string[] };
  settings?: { ratioGroups?: { name: string; ageFrom?: number; ageTo?: number }[] };
}
export interface SavedTimetable {
  id: string;
  listingId: string | null;
  name: string;
  dateFrom: string;
  dateTo: string;
  excluded: string[];
  config: { start: string; end: string; perDay: number; breaks: number; lunch: string; signin: string[]; signout: string[]; wholeTimes: string[]; groups: string[] };
  dayList: DayInfo[];
  plan: Plan;
  mode: Mode;
  updatedAt?: string;
  published?: { at: string; staff: boolean; parents: boolean; audience: "booked" | "everyone" } | null;
}

const prettyRange = (from: string, to: string) => {
  const f = (iso: string) => {
    const d = new Date(iso + "T00:00:00");
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };
  return from === to ? f(from) : `${f(from)} – ${f(to)}`;
};

/** A real listing → the builder's Listing shape (dates/times from its blocks). */
function toBuilderListing(l: ApiListing, venueName: string): Listing | null {
  const blocks = (l.blocks ?? []).filter((b) => b.sessions?.length);
  if (!blocks.length) return null;
  const from = blocks.map((b) => b.startDate).sort()[0];
  const to = blocks.map((b) => b.endDate).sort().slice(-1)[0];
  const first = blocks.find((b) => b.startDate === from)!.sessions[0];
  return {
    id: l.id,
    name: (l.title ?? l.name ?? "Untitled").trim() || "Untitled",
    venue: venueName,
    dates: prettyRange(from, to),
    from,
    to,
    start: first.start,
    end: first.end,
    signin: [first.start],
    signout: [first.end],
    sessionDates: blocks.flatMap((b) => b.sessions.map((s) => s.date)),
    seasonId: l.seasonId ?? null,
  };
}

interface TimetableState {
  // Reference data (server-loaded)
  CATS: Category[];
  FAC: string[];
  LISTINGS: Listing[];
  groupsList: Group[];
  loading: boolean;
  loadError: string | null;
  saved: SavedTimetable[];

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

  // Server draft
  timetableId: string | null;
  saveState: "idle" | "saving" | "saved" | "error";

  // Navigation
  tab: number; // 0 setup · 1 timetable · 2 publish
  wstep: number; // wizard step 1..7

  // Publish
  share: Record<string, boolean>;
  audience: "booked" | "everyone";
  notifyEmail: boolean;
  notifyPush: boolean;
  pubStatus: string | null;
  publishing: boolean;

  // actions
  init: () => Promise<void>;
  refreshListings: () => Promise<void>;
  groups: () => string[];
  buildConfig: () => GenConfig;
  saveDraft: () => Promise<void>;

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
  setNotify: (patch: Partial<{ email: boolean; push: boolean }>) => void;
  openSaved: (id: string) => void;
  deleteSaved: (id: string) => void;
  publish: () => Promise<void>;
}

// Exported for components: select `s.groupsList` (stable reference) and
// derive with useMemo. Selecting `s.groups()` returns a FRESH array every
// snapshot, which React rejects ("getSnapshot should be cached") and
// re-renders forever — the day grid hung on exactly that.
export function groupsFrom(list: Group[]): string[] {
  const src = list && list.length ? list : DEFAULT_GROUPS;
  return src.map((g) => (g.band ? g.name + " (" + g.band + ")" : g.name));
}

// Debounced autosave + catalog save — module-level so rapid edits coalesce.
let draftTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleDraftSave() {
  if (draftTimer) clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    draftTimer = null;
    void useTimetableStore.getState().saveDraft();
  }, 900);
}
let catsTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleCatsSave() {
  if (catsTimer) clearTimeout(catsTimer);
  catsTimer = setTimeout(() => {
    catsTimer = null;
    const s = useTimetableStore.getState();
    // The library route overlays keys — sending `timetable` alone is safe.
    apiPut("/api/library", { timetable: { cats: s.CATS, facilities: s.FAC } }).catch(() => {
      /* next edit retries; the draft itself still saves */
    });
  }, 900);
}

/** Weekdays inside [from,to] that the listing has NO session on — excluded up
 * front so the built week matches the days that actually run. */
function gapsFor(l: Listing): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (!l.sessionDates?.length) return out;
  const has = new Set(l.sessionDates);
  for (const d of buildAllDays(l.from, l.to)) if (d.iso && !has.has(d.iso)) out[d.iso] = true;
  return out;
}

export const useTimetableStore = create<TimetableState>()(
  immer((set, get) => ({
    CATS: JSON.parse(JSON.stringify(CATEGORIES)),
    FAC: FACILITIES.slice(),
    LISTINGS: [],
    groupsList: DEFAULT_GROUPS.map((g) => ({ ...g })),
    loading: true,
    loadError: null,
    saved: [],

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

    timetableId: null,
    saveState: "idle",

    tab: 0,
    wstep: 1,

    share: {},
    audience: "booked",
    notifyEmail: true,
    notifyPush: true,
    pubStatus: null,
    publishing: false,

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

    init: async () => {
      set((s) => {
        s.loading = true;
        s.loadError = null;
      });
      try {
        const [listings, lib, saved] = await Promise.all([
          apiGet<ApiListing[]>("/api/listings?mine=1"),
          apiGet<LibraryDoc | null>("/api/library"),
          apiGet<SavedTimetable[]>("/api/timetables"),
        ]);
        const venueName = (id?: string) => (lib?.venues ?? []).find((v) => v.id === id)?.name ?? "";
        const mapped = (listings ?? [])
          .filter((l) => !l.archived)
          .map((l) => toBuilderListing(l, venueName(l.venueId)))
          .filter((l): l is Listing => !!l)
          .sort((a, b) => (a.from < b.from ? -1 : 1));
        set((s) => {
          s.LISTINGS = mapped;
          s.saved = saved ?? [];
          if (lib?.timetable?.cats?.length) s.CATS = lib.timetable.cats;
          if (lib?.timetable?.facilities?.length) s.FAC = lib.timetable.facilities;
          s.enabledCatIds = Object.fromEntries(s.CATS.map((c) => [c.id, s.enabledCatIds[c.id] !== false]));
          const rg = lib?.settings?.ratioGroups;
          if (rg?.length)
            s.groupsList = rg.map((g) => ({
              name: g.name,
              band: g.ageFrom != null && g.ageTo != null ? `${g.ageFrom}-${g.ageTo}` : "",
            }));
          s.loading = false;
        });
        get().pickListing(0);
      } catch (e) {
        set((s) => {
          s.loading = false;
          s.loadError = e instanceof Error ? e.message : "Couldn’t load your listings";
        });
      }
    },

    refreshListings: async () => {
      try {
        const [listings, lib] = await Promise.all([
          apiGet<ApiListing[]>("/api/listings?mine=1"),
          apiGet<LibraryDoc | null>("/api/library"),
        ]);
        const venueName = (id?: string) => (lib?.venues ?? []).find((v) => v.id === id)?.name ?? "";
        const mapped = (listings ?? [])
          .filter((l) => !l.archived)
          .map((l) => toBuilderListing(l, venueName(l.venueId)))
          .filter((l): l is Listing => !!l)
          .sort((a, b) => (a.from < b.from ? -1 : 1));
        set((s) => {
          s.LISTINGS = mapped;
          // Keep the selection pinned to the same listing if it still exists.
          if (s.curListing) {
            const i = mapped.findIndex((l) => l.id === s.curListing!.id);
            if (i >= 0) s.listingIndex = i;
          }
        });
      } catch {
        /* transient — the next realtime nudge retries */
      }
    },

    saveDraft: async () => {
      const s0 = get();
      if (s0.loading || !s0.dayList.length) return;
      set((s) => void (s.saveState = "saving"));
      const body = {
        listingId: s0.curListing?.id ?? null,
        name: s0.curListing?.name ?? `Custom week (${s0.dateFrom || "?"})`,
        dateFrom: s0.dateFrom,
        dateTo: s0.dateTo,
        excluded: Object.keys(s0.excluded).filter((k) => s0.excluded[k]),
        config: {
          start: s0.start,
          end: s0.end,
          perDay: s0.perDay,
          breaks: s0.breaks,
          lunch: s0.lunch,
          signin: s0.signin.slice(0, 8),
          signout: s0.signout.slice(0, 8),
          wholeTimes: s0.wholeTimes.slice(0, 8),
          groups: groupsFrom(s0.groupsList),
        },
        dayList: s0.dayList,
        plan: s0.plan,
        mode: s0.mode,
      };
      try {
        const doc = s0.timetableId
          ? await apiPut<SavedTimetable>(`/api/timetables/${s0.timetableId}`, body)
          : await apiPost<SavedTimetable>("/api/timetables", body);
        set((s) => {
          s.timetableId = doc.id;
          s.saveState = "saved";
          const i = s.saved.findIndex((t) => t.id === doc.id);
          if (i >= 0) s.saved[i] = doc;
          else s.saved.unshift(doc);
        });
      } catch {
        set((s) => void (s.saveState = "error"));
      }
    },

    pickListing: (index) => {
      const L = get().LISTINGS[index];
      if (!L) {
        // No listings yet — a blank custom week is still usable.
        set((s) => {
          s.listingIndex = 0;
          s.curListing = null;
        });
        if (!get().plan.length && get().dateFrom) get().generate("auto");
        return;
      }
      const draft = get().saved.find((t) => t.listingId === L.id);
      set((s) => {
        s.listingIndex = index;
        s.curListing = L;
        s.timetableId = draft?.id ?? null;
        s.pubStatus = draft?.published
          ? `Published ${new Date(draft.published.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
          : null;
        s.share = draft?.published ? { staff: draft.published.staff, parents: draft.published.parents } : {};
        s.audience = draft?.published?.audience ?? "booked";
        if (draft) {
          // Resume the saved week exactly as it was left.
          s.dateFrom = draft.dateFrom;
          s.dateTo = draft.dateTo;
          s.excluded = Object.fromEntries(draft.excluded.map((d) => [d, true]));
          s.start = draft.config.start;
          s.end = draft.config.end;
          s.perDay = draft.config.perDay;
          s.breaks = draft.config.breaks;
          s.lunch = draft.config.lunch;
          s.signin = draft.config.signin.slice();
          s.signout = draft.config.signout.slice();
          s.wholeTimes = draft.config.wholeTimes.slice();
          s.dayList = draft.dayList;
          s.plan = draft.plan;
          s.mode = draft.mode;
          s.cur = 0;
        } else {
          s.start = L.start;
          s.end = L.end;
          s.dateFrom = L.from;
          s.dateTo = L.to;
          s.signin = L.signin.slice();
          s.signout = L.signout.slice();
          // Days the listing doesn't actually run start excluded.
          s.excluded = gapsFor(L);
          s.dayList = buildDays(L.from, L.to, s.excluded);
        }
      });
      if (!draft) get().generate("auto");
    },

    setDates: (from, to) => {
      set((s) => {
        s.dateFrom = from;
        s.dateTo = to;
        s.dayList = buildDays(from, to, s.excluded);
        s.curListing = null;
        s.timetableId = get().saved.find((t) => t.listingId === null)?.id ?? null;
      });
      get().regenIfAuto();
      scheduleDraftSave();
    },

    toggleDate: (iso) => {
      if (!iso) return;
      set((s) => {
        s.excluded[iso] = !s.excluded[iso];
        s.dayList = buildDays(s.dateFrom, s.dateTo, s.excluded);
      });
      get().regenIfAuto();
      scheduleDraftSave();
    },

    setField: (patch) => {
      set((s) => Object.assign(s, patch));
      get().regenIfAuto();
      scheduleDraftSave();
    },

    addSign: (kind, time) => {
      if (!time) return;
      set((s) => void s[kind].push(time));
      scheduleDraftSave();
    },
    delSign: (kind, i) => {
      set((s) => void s[kind].splice(i, 1));
      scheduleDraftSave();
    },
    addWhole: (time) => {
      if (!time) return;
      set((s) => {
        if (s.wholeTimes.indexOf(time) < 0) s.wholeTimes.push(time);
        s.wholeTimes.sort();
      });
      get().regenIfAuto();
      scheduleDraftSave();
    },
    delWhole: (i) => {
      set((s) => void s.wholeTimes.splice(i, 1));
      get().regenIfAuto();
      scheduleDraftSave();
    },

    toggleCat: (id) => set((s) => void (s.enabledCatIds[id] = !s.enabledCatIds[id])),

    addGroup: (name, band) => {
      if (!name.trim()) return;
      set((s) => void s.groupsList.push({ name: name.trim(), band: band.trim() }));
      scheduleDraftSave();
    },
    delGroup: (i) => {
      set((s) => void s.groupsList.splice(i, 1));
      scheduleDraftSave();
    },

    toggleFac: (f) => {
      set((s) => {
        s.facOn[f] = s.facOn[f] === false;
      });
    },
    addFac: (name) => {
      const v = name.trim();
      if (!v) return;
      set((s) => {
        if (s.FAC.indexOf(v) < 0) {
          s.FAC.push(v);
          s.facOn[v] = true;
        }
      });
      scheduleCatsSave();
    },

    toggleCatOpen: (id) => set((s) => void (s.openCat[id] = !s.openCat[id])),

    toggleActOn: (cid, idx) => {
      set((s) => {
        const c = s.CATS.find((x) => x.id === cid);
        if (c) c.acts[idx].on = !c.acts[idx].on;
      });
      scheduleCatsSave();
    },
    setActPlace: (cid, idx, place) => {
      set((s) => {
        const c = s.CATS.find((x) => x.id === cid);
        if (c) c.acts[idx].place = place;
      });
      scheduleCatsSave();
    },
    toggleActWhole: (cid, idx) => {
      set((s) => {
        const c = s.CATS.find((x) => x.id === cid);
        if (c) c.acts[idx].whole = !c.acts[idx].whole;
      });
      scheduleCatsSave();
    },
    toggleActGroup: (cid, idx, gi) => {
      set((s) => {
        const c = s.CATS.find((x) => x.id === cid);
        if (!c) return;
        const ex = c.acts[idx].exclude;
        const k = ex.indexOf(gi);
        if (k >= 0) ex.splice(k, 1);
        else ex.push(gi);
      });
      scheduleCatsSave();
    },
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
      });
      scheduleCatsSave();
    },
    delAct: (cid, idx) => {
      set((s) => {
        const c = s.CATS.find((x) => x.id === cid);
        if (c) c.acts.splice(idx, 1);
      });
      scheduleCatsSave();
    },

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
      scheduleDraftSave();
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
    cellColor: (color, name) => {
      set((s) => {
        if (!s.edit) return;
        const c = s.plan[s.cur][s.edit.r].cells![s.edit.g];
        c.name = name;
        c.color = color;
      });
      scheduleDraftSave();
    },
    cellSave: (name) => {
      set((s) => {
        if (!s.edit) return;
        const c = s.plan[s.cur][s.edit.r].cells![s.edit.g];
        c.name = name;
        if (!c.color) c.color = "#64748B";
        s.edit = null;
      });
      scheduleDraftSave();
    },
    cellClear: () => {
      set((s) => {
        if (!s.edit) return;
        s.plan[s.cur][s.edit.r].cells![s.edit.g] = { name: "", color: "", cat: "", place: "" };
        s.edit = null;
      });
      scheduleDraftSave();
    },
    dropOnCell: (r, g, payload) => {
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
      });
      scheduleDraftSave();
    },

    toggleShare: (key) => set((s) => void (s.share[key] = !s.share[key])),
    setAudience: (a) => set((s) => void (s.audience = a)),
    setNotify: (patch) =>
      set((s) => {
        if (patch.email !== undefined) s.notifyEmail = patch.email;
        if (patch.push !== undefined) s.notifyPush = patch.push;
      }),

    // Load a saved timetable back into the builder (mirrors pickListing's
    // resume-a-draft branch) and drop the operator onto the built grid.
    openSaved: (id) => {
      const t = get().saved.find((x) => x.id === id);
      if (!t) return;
      set((s) => {
        s.timetableId = t.id;
        const li = s.LISTINGS.findIndex((l) => l.id === t.listingId);
        if (li >= 0) {
          s.listingIndex = li;
          s.curListing = s.LISTINGS[li];
        } else {
          s.curListing = null;
        }
        s.dateFrom = t.dateFrom;
        s.dateTo = t.dateTo;
        s.excluded = Object.fromEntries(t.excluded.map((d) => [d, true]));
        s.start = t.config.start;
        s.end = t.config.end;
        s.perDay = t.config.perDay;
        s.breaks = t.config.breaks;
        s.lunch = t.config.lunch;
        s.signin = t.config.signin.slice();
        s.signout = t.config.signout.slice();
        s.wholeTimes = t.config.wholeTimes.slice();
        s.dayList = t.dayList;
        s.plan = t.plan;
        s.mode = t.mode;
        s.cur = 0;
        s.share = t.published ? { staff: t.published.staff, parents: t.published.parents } : {};
        s.audience = t.published?.audience ?? "booked";
        s.pubStatus = t.published
          ? `Published ${new Date(t.published.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
          : null;
        s.wstep = 1;
        s.tab = 1;
      });
    },

    deleteSaved: (id) => {
      set((s) => {
        s.saved = s.saved.filter((t) => t.id !== id);
        if (s.timetableId === id) s.timetableId = null;
      });
      apiDel(`/api/timetables/${id}`).catch(() => {
        /* best-effort; the next load re-syncs if it failed */
      });
    },
    publish: async () => {
      if (get().publishing) return;
      set((s) => {
        s.publishing = true;
        s.pubStatus = null;
      });
      try {
        // Flush any pending edits so what publishes is what's on screen.
        if (draftTimer) {
          clearTimeout(draftTimer);
          draftTimer = null;
        }
        await get().saveDraft();
        const s0 = get();
        if (!s0.timetableId) throw new Error("Couldn’t save the timetable first");
        const doc = await apiPost<SavedTimetable>(`/api/timetables/${s0.timetableId}/publish`, {
          staff: !!s0.share.staff,
          parents: !!s0.share.parents,
          audience: s0.audience,
          // Only meaningful when sharing to parents; backend sends on publish.
          notifyEmail: !!s0.share.parents && s0.notifyEmail,
          notifyPush: !!s0.share.parents && s0.notifyPush,
        });
        set((s) => {
          const i = s.saved.findIndex((t) => t.id === doc.id);
          if (i >= 0) s.saved[i] = doc;
          const who: string[] = [];
          if (doc.published?.staff) who.push("Staff portal");
          if (doc.published?.parents) who.push("Parents (" + doc.published.audience + ")");
          s.pubStatus = doc.published
            ? "Published ✓ · Visible to: " + who.join(", ") + " · " + (s.dayList.length || 0) + " days · just now"
            : "Unpublished — pick at least one audience to publish.";
        });
      } catch (e) {
        set((s) => void (s.pubStatus = e instanceof Error ? e.message : "Couldn’t publish — try again"));
      }
      set((s) => void (s.publishing = false));
    },
  })),
);

export type { Cell };
