// Builds a self-contained, inline-styled HTML document of the current
// timetable view and opens it in a print window (mirrors legacy ttbPrint,
// which relied on the page CSS — here we inline everything so it stands alone).

import { facColor, groupIntoWeeks } from "./engine";
import type { Cell, DayInfo, Plan, PlanRow, ViewMode } from "./types";

const esc = (x: unknown) =>
  String(x == null ? "" : x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&quot;");

const cellBg = (c: Cell, FAC: string[]) => c.color || facColor(c.place, FAC) || "#64748B";

const blk = (bg: string, inner: string) =>
  `<div style="background:${bg};color:#fff;border-radius:6px;padding:5px 7px;font-size:11px;font-weight:700;line-height:1.25">${inner}</div>`;

function bannerRow(r: PlanRow, cols: number): string {
  const lab = r.type === "signin" ? "Sign-in" : r.type === "signout" ? "Sign-out" : r.type === "lunch" ? "Lunch" : "Break";
  const tm = r.times ? r.times.join(" · ") : r.time;
  return `<tr><td colspan="${cols + 1}" style="background:#eef1fb;padding:5px 9px;font-weight:800;font-size:11px"><b>${lab}</b> <span style="color:#555;float:right">${esc(tm)}</span></td></tr>`;
}

function dayHtml(plan: Plan, di: number, dayList: DayInfo[], groups: string[], FAC: string[]): string {
  const rows = plan[di] || [];
  const n = groups.length;
  const dd = dayList[di] ? `${dayList[di].n} ${(dayList[di].d || "").split(" ")[0] || ""}` : "";
  let h = `<table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif"><thead><tr>`;
  h += `<th style="width:70px;background:#1d3a8f;color:#fff;padding:6px;font-size:10px">${esc(dd)}</th>`;
  h += groups.map((g) => `<th style="background:#1d3a8f;color:#fff;padding:6px;font-size:10px">${esc(g)}</th>`).join("");
  h += `</tr></thead><tbody>`;
  rows.forEach((r) => {
    if (r.whole) {
      h += `<tr><td style="padding:4px;font-size:10px;color:#555;text-align:right;border:1px solid #e5e7eb">${esc(r.time)}</td><td colspan="${n}" style="padding:4px;border:1px solid #e5e7eb">${blk(r.whole.color, "★ " + esc(r.whole.name) + " — whole camp")}</td></tr>`;
    } else if (r.cells) {
      h += `<tr><td style="padding:4px;font-size:10px;color:#555;text-align:right;border:1px solid #e5e7eb">${esc(r.time)}</td>`;
      h += r.cells.map((c) => `<td style="padding:4px;border:1px solid #e5e7eb">${blk(cellBg(c, FAC), esc(c.name) + (c.place ? `<div style="opacity:.85;font-weight:600">@ ${esc(c.place)}</div>` : ""))}</td>`).join("");
      h += `</tr>`;
    } else {
      h += bannerRow(r, n);
    }
  });
  h += `</tbody></table>`;
  return h;
}

function weekHtml(plan: Plan, cur: number, dayList: DayInfo[], groups: string[], FAC: string[]): string {
  const weeks = groupIntoWeeks(dayList);
  let wi = 0;
  weeks.forEach((wk, i) => {
    if (wk.some((o) => o.di === cur)) wi = i;
  });
  const wk = weeks[wi] || [];
  const gshort = groups.map((g) => g.split("(")[0].trim());
  let h = `<h3>Week ${wi + 1}</h3><table style="width:100%;border-collapse:collapse;font-family:Arial"><thead><tr><th style="width:50px"></th>`;
  h += wk.map((o) => `<th style="background:#1d3a8f;color:#fff;padding:5px;font-size:10px">${esc(o.day.n)} ${esc(o.day.d)}</th>`).join("") + `</tr></thead><tbody>`;
  const tmpl = plan[wk[0]?.di] || [];
  tmpl.forEach((tr, ri) => {
    if (tr.whole || tr.cells) {
      h += `<tr><td style="font-size:9px;color:#555">${esc(tr.time)}</td>`;
      wk.forEach((o) => {
        const row = (plan[o.di] || [])[ri] || {};
        if (row.whole) h += `<td style="padding:3px;border:1px solid #e5e7eb">${blk(row.whole.color, esc(row.whole.name))}</td>`;
        else if (row.cells)
          h += `<td style="padding:3px;border:1px solid #e5e7eb">${row.cells.map((c, gi) => `<div style="background:${cellBg(c, FAC)};color:#fff;border-radius:4px;padding:2px 4px;font-size:9px;margin-bottom:2px"><b>${esc(gshort[gi] || "")}</b> ${esc(c.name)}</div>`).join("")}</td>`;
        else h += `<td></td>`;
      });
      h += `</tr>`;
    }
  });
  h += `</tbody></table>`;
  return h;
}

function monthHtml(plan: Plan, dayList: DayInfo[], FAC: string[]): string {
  const weeks = groupIntoWeeks(dayList);
  let h = "";
  weeks.slice(0, 4).forEach((wk, wi) => {
    h += `<h4>Week ${wi + 1}</h4><div style="display:flex;gap:8px;flex-wrap:wrap">`;
    wk.forEach((o) => {
      const rows = plan[o.di] || [];
      const seen: Record<string, boolean> = {};
      const chips: string[] = [];
      rows.forEach((r) => {
        if (r.cells)
          r.cells.forEach((c) => {
            if (c.name && c.name !== "Free Play" && !seen[c.name]) {
              seen[c.name] = true;
              chips.push(`<span style="background:${cellBg(c, FAC)};color:#fff;border-radius:4px;padding:2px 5px;font-size:9px;margin:2px;display:inline-block">${esc(c.name)}</span>`);
            }
          });
      });
      h += `<div style="border:1px solid #e5e7eb;border-radius:8px;padding:8px;min-width:120px"><b style="font-size:11px">${esc(o.day.n)} ${esc(o.day.d)}</b><div>${chips.join("") || "<i>no activities</i>"}</div></div>`;
    });
    h += `</div>`;
  });
  return h;
}

interface PrintArgs {
  view: ViewMode;
  plan: Plan;
  cur: number;
  dayList: DayInfo[];
  groups: string[];
  FAC: string[];
}

export function printTimetable({ view, plan, cur, dayList, groups, FAC }: PrintArgs) {
  const title = view === "week" ? "Weekly timetable" : view === "month" ? "4-week overview" : "Daily timetable";
  const body =
    view === "week" ? weekHtml(plan, cur, dayList, groups, FAC) : view === "month" ? monthHtml(plan, dayList, FAC) : dayHtml(plan, cur, dayList, groups, FAC);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body style="font-family:Arial,sans-serif;padding:16px"><h2 style="color:#1d3a8f">ActivityOS · ${title}</h2>${body}<script>window.onload=function(){window.print();}<\/script></body></html>`;
  const w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}
