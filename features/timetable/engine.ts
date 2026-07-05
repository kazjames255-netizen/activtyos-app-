// Pure scheduling engine — a faithful TypeScript port of the legacy TTB
// generator (skeleton / genWeek / blankWeek / interleavedPool). Kept
// algorithmically identical so generated timetables match the original.

import type { Activity, Category, Cell, DayInfo, GenConfig, Plan, PlanRow } from "./types";

const FACPAL = [
  "#2563EB", "#15803D", "#C2410C", "#7C3AED", "#0E7490", "#B45309",
  "#B91C1C", "#4338CA", "#0F766E", "#9333EA", "#92400E", "#4D7C0F",
];

export function toMin(s: string): number {
  const p = (s || "9:0").split(":");
  return +p[0] * 60 + +(p[1] || 0);
}

export function fmt(m: number): string {
  m = ((m % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return (h < 10 ? "0" : "") + h + ":" + (mm < 10 ? "0" : "") + mm;
}

export function shortGroup(g: string): string {
  return (g || "").replace(/\(.*/, "").trim() || g;
}

export function facColor(place: string, FAC: string[]): string {
  const i = (FAC || []).indexOf(place);
  if (i < 0) return "#94A3B8";
  return FACPAL[i % FACPAL.length];
}

const facOK = (place: string, facOn: Record<string, boolean>) =>
  !place || facOn[place] !== false;

export function buildAllDays(from: string, to: string): DayInfo[] {
  const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const a = new Date(from + "T00:00:00");
  const b = new Date(to + "T00:00:00");
  const out: DayInfo[] = [];
  const p2 = (x: number) => (x < 10 ? "0" : "") + x;
  if (isNaN(a.getTime()) || isNaN(b.getTime()) || b < a) {
    return [
      { n: "Mon", d: "", iso: "" },
      { n: "Tue", d: "", iso: "" },
      { n: "Wed", d: "", iso: "" },
      { n: "Thu", d: "", iso: "" },
      { n: "Fri", d: "", iso: "" },
    ];
  }
  let n = 0;
  for (const dt = new Date(a); dt <= b && n < 31; dt.setDate(dt.getDate() + 1)) {
    const dw = dt.getDay();
    if (dw === 0 || dw === 6) continue;
    const iso = dt.getFullYear() + "-" + p2(dt.getMonth() + 1) + "-" + p2(dt.getDate());
    out.push({ n: WD[dt.getDay()], d: dt.getDate() + " " + MO[dt.getMonth()], iso });
    n++;
  }
  return out;
}

export function buildDays(from: string, to: string, excluded: Record<string, boolean>): DayInfo[] {
  const all = buildAllDays(from, to);
  const ex = excluded || {};
  return all.filter((x) => !x.iso || !ex[x.iso]);
}

export function enabledCategories(CATS: Category[], enabledIds: Set<string>): Category[] {
  const ec = CATS.filter((c) => enabledIds.has(c.id));
  return ec.length ? ec : CATS.slice();
}

interface PoolItem {
  a: Activity;
  c: Category;
}

function interleavedPool(ec: Category[], facOn: Record<string, boolean>): PoolItem[] {
  const lists = ec.map((c) =>
    c.acts.filter((a) => a.on && !a.whole && facOK(a.place, facOn)).map((a) => ({ a, c })),
  );
  const pool: PoolItem[] = [];
  let i = 0;
  let more = true;
  while (more) {
    more = false;
    for (let k = 0; k < lists.length; k++) {
      if (i < lists[k].length) {
        pool.push(lists[k][i]);
        more = true;
      }
    }
    i++;
  }
  return pool;
}

interface Skeleton {
  rows: PlanRow[];
  sidx: number[];
  wholeRows: number[];
  nSess: number;
}

function skeleton(cfg: GenConfig, signin: string[], signout: string[]): Skeleton {
  const nSess = Math.max(2, cfg.aps);
  const sMin = Math.round(toMin(cfg.start) / 5) * 5;
  const eMin = toMin(cfg.end);
  const brk = cfg.brk | 0;
  let anchors: { kind: string; start: number; dur: number }[] = [
    { kind: "lunch", start: toMin(cfg.lunch || "12:00"), dur: 45 },
  ];
  (cfg.wholeTimes || []).forEach((wt) => anchors.push({ kind: "whole", start: toMin(wt), dur: 0 }));
  anchors = anchors.filter((a) => a.start > sMin + 10 && a.start < eMin - 10);
  anchors.sort((a, b) => a.start - b.start);
  const nWhole = anchors.filter((a) => a.kind === "whole").length;
  const avail = eMin - sMin - 45 - brk * 15;
  const sess = Math.max(25, Math.floor(avail / (nSess + nWhole) / 5) * 5);
  anchors.forEach((a) => {
    if (a.kind === "whole") a.dur = sess;
  });
  const rows: PlanRow[] = [{ type: "signin", times: signin.slice() }];
  const sidx: number[] = [];
  const wholeRows: number[] = [];
  let t = sMin;
  let placed = 0;
  let bk = brk;

  function fillSeg(limit: number) {
    const len = limit - t;
    if (len < 25 || placed >= nSess) {
      if (len >= 5) rows.push({ type: "break", time: fmt(t) + "-" + fmt(limit) });
      t = limit;
      return;
    }
    let k = Math.max(1, Math.round(len / sess));
    k = Math.min(k, nSess - placed);
    const useBrk = bk > 0 && k >= 2 && len >= k * 25 + 15;
    const avail2 = useBrk ? len - 15 : len;
    const brkAfter = useBrk ? Math.ceil(k / 2) - 1 : -1;
    let each = Math.floor(avail2 / k / 5) * 5;
    if (each < 25) each = 25;
    for (let j = 0; j < k; j++) {
      const last = j === k - 1;
      const en = last ? limit : t + each;
      rows.push({ type: "session", time: fmt(t) + "-" + fmt(en), cells: null });
      sidx.push(rows.length - 1);
      placed++;
      t = en;
      if (useBrk && j === brkAfter && !last) {
        rows.push({ type: "break", time: fmt(t) + "-" + fmt(t + 15) });
        t += 15;
        bk--;
      }
    }
    if (t < limit) {
      const li = sidx[sidx.length - 1];
      if (li != null) rows[li].time = rows[li].time!.split("-")[0] + "-" + fmt(limit);
      t = limit;
    }
  }

  for (let ai = 0; ai < anchors.length; ai++) {
    const an = anchors[ai];
    if (an.start > t) fillSeg(an.start);
    if (an.kind === "lunch") {
      rows.push({ type: "lunch", time: fmt(an.start) + "-" + fmt(an.start + an.dur) });
      t = an.start + an.dur;
    } else {
      rows.push({ type: "session", time: fmt(an.start) + "-" + fmt(an.start + an.dur), cells: null });
      wholeRows.push(rows.length - 1);
      t = an.start + an.dur;
    }
  }
  fillSeg(eMin);
  rows.push({ type: "signout", times: signout.slice() });
  return { rows, sidx, wholeRows, nSess };
}

export interface GenContext {
  dayList: DayInfo[];
  CATS: Category[];
  enabledIds: Set<string>;
  FAC: string[];
  facOn: Record<string, boolean>;
  signin: string[];
  signout: string[];
  seed: number;
}

export function genWeek(cfg: GenConfig, ctx: GenContext): Plan {
  const groups = cfg.groups;
  const ng = groups.length;
  const ec = enabledCategories(ctx.CATS, ctx.enabledIds);
  const pool = interleavedPool(ec, ctx.facOn);
  const wholeActs: PoolItem[] = [];
  ec.forEach((c) =>
    c.acts.forEach((a) => {
      if (a.on && a.whole && facOK(a.place, ctx.facOn)) wholeActs.push({ a, c });
    }),
  );
  cfg.wholeTimes = wholeActs.length ? cfg.wholeTimes || [] : [];
  const days: Plan = [];
  for (let d = 0; d < ctx.dayList.length; d++) {
    const sk = skeleton(cfg, ctx.signin, ctx.signout);
    const R = sk.sidx.length;
    const dayActs: (PoolItem | null)[] = [];
    const usedN: string[] = [];
    const off = (d + (ctx.seed || 0)) * 2;
    for (let p = 0; p < R; p++) {
      const clash: Record<string, number> = {};
      for (let rq = 1; rq < ng; rq++) {
        const ia = p - rq;
        if (ia >= 0 && dayActs[ia] && dayActs[ia]!.a) clash[dayActs[ia]!.a.place] = 1;
        const ib = p + rq - R;
        if (ib >= 0 && ib < p && dayActs[ib] && dayActs[ib]!.a) clash[dayActs[ib]!.a.place] = 1;
      }
      let pick: PoolItem | null = null;
      for (let k = 0; pool.length && k < pool.length; k++) {
        const it = pool[(off + p + k) % pool.length];
        if (usedN.indexOf(it.a.name) < 0 && !clash[it.a.place]) {
          pick = it;
          break;
        }
      }
      if (!pick)
        for (let k2 = 0; pool.length && k2 < pool.length; k2++) {
          const it2 = pool[(off + p + k2) % pool.length];
          if (usedN.indexOf(it2.a.name) < 0) {
            pick = it2;
            break;
          }
        }
      if (!pick && pool.length) pick = pool[(off + p) % pool.length];
      if (pick) usedN.push(pick.a.name);
      dayActs.push(pick);
    }
    sk.sidx.forEach((ri, p) => {
      sk.rows[ri].cells = groups.map((g, gi): Cell => {
        const it = R ? dayActs[(p + gi) % R] : null;
        if (!it) return { name: "Free Play", color: "#94A3B8", cat: "Others", place: "Playground" };
        return {
          name: it.a.name,
          color: ctx.FAC.indexOf(it.a.place) >= 0 ? facColor(it.a.place, ctx.FAC) : it.c.color,
          cat: it.c.name,
          place: it.a.place,
        };
      });
    });
    sk.wholeRows.forEach((wri, wi) => {
      if (wholeActs.length) {
        const w = wholeActs[(d + (ctx.seed || 0) + wi) % wholeActs.length];
        sk.rows[wri].whole = {
          name: w.a.name,
          color: ctx.FAC.indexOf(w.a.place) >= 0 ? facColor(w.a.place, ctx.FAC) : w.c.color,
          cat: w.c.name,
          place: w.a.place,
        };
        sk.rows[wri].cells = null;
      }
    });
    days.push(sk.rows);
  }
  return days;
}

export function blankWeek(
  cfg: GenConfig,
  ctx: Pick<GenContext, "dayList" | "signin" | "signout">,
): Plan {
  const groups = cfg.groups;
  const days: Plan = [];
  for (let d = 0; d < ctx.dayList.length; d++) {
    const sk = skeleton(cfg, ctx.signin, ctx.signout);
    sk.sidx.concat(sk.wholeRows).forEach((ri) => {
      sk.rows[ri].cells = groups.map(() => ({ name: "", color: "", cat: "", place: "" }));
    });
    days.push(sk.rows);
  }
  return days;
}

// Group days into weeks (Mon-anchored) for the week / month views.
function weekKey(iso: string): string | null {
  if (!iso) return null;
  const dt = new Date(iso + "T00:00:00");
  if (isNaN(dt.getTime())) return null;
  const wd = (dt.getDay() + 6) % 7;
  dt.setDate(dt.getDate() - wd);
  return dt.getFullYear() + "-" + dt.getMonth() + "-" + dt.getDate();
}

export function groupIntoWeeks(dayList: DayInfo[]): { di: number; day: DayInfo }[][] {
  const weeks: { di: number; day: DayInfo }[][] = [];
  const map: Record<string, number> = {};
  (dayList || []).forEach((day, di) => {
    let k = weekKey(day.iso);
    if (k == null) k = "w" + Math.floor(di / 5);
    if (!Object.prototype.hasOwnProperty.call(map, k)) {
      map[k] = weeks.length;
      weeks.push([]);
    }
    weeks[map[k]].push({ di, day });
  });
  return weeks;
}
