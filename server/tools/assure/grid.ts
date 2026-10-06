// COMBINATION GRID: listing configuration (rows) x action (columns). Every cell is TESTED, NOT-ALLOWED or GAP.
//   tsx server/tools/assure/grid.ts --check            prints GRID COMPLETE only when GAP = 0, otherwise the gaps as tasks
//   tsx server/tools/assure/grid.ts --html out.html    colour-coded matrix (green tested, grey not-allowed, red gap)
//   tsx server/tools/assure/grid.ts --verify           only re-check that every cited piece of evidence still exists
//   tsx server/tools/assure/grid.ts --deps             show which axes each action reads (the independence proof)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AXES, AXIS_TOKENS, COLS, EXTRA_DEP, HUMAN, NOT_ALLOWED, ROWS, UNITS, type AxisId, type Claim, type Ref } from "./grid-data.ts";
import "./grid-claims.ts";
import { CLAIMS } from "./grid-data.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (f: string) => { try { return fs.readFileSync(path.join(ROOT, f), "utf8"); } catch { return null; } };
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

// ---- code units -> axis dependence -------------------------------------------------------------------------------------------
function unitText(u: { file: string; start?: string }): string | null {
  const t = read(u.file);
  if (t == null) return null;
  if (!u.start) return stripComments(t);
  const lines = t.split("\n");
  const re = new RegExp(u.start);
  const i = lines.findIndex((l) => re.test(l));
  if (i < 0) return null;
  let j = lines.length;
  for (let k = i + 1; k < lines.length; k++) if (/^([a-zA-Z_]+\.(get|post|put|patch|delete|use)\(|export |interface |type |function |async function |const |let )/.test(lines[k])) { j = k; break; }
  return stripComments(lines.slice(i, j).join("\n"));
}
const problems: string[] = [];
const depCache = new Map<string, Set<AxisId>>();
function depsOf(col: string): Set<AxisId> {
  const hit = depCache.get(col);
  if (hit) return hit;
  const set = new Set<AxisId>(EXTRA_DEP[col] || []);
  for (const u of UNITS[col] || []) {
    const t = unitText(u);
    if (t == null) { problems.push(`code unit for ${col} not found: ${u.file}${u.start ? " /" + u.start + "/" : ""}`); continue; }
    for (const [ax, re] of Object.entries(AXIS_TOKENS)) if (re!.test(t)) set.add(ax as AxisId);
  }
  depCache.set(col, set);
  return set;
}

// ---- evidence verification ---------------------------------------------------------------------------------------------------
const verified = new Map<string, boolean>();
function verifyRef(r: Ref): string | null {
  switch (r.kind) {
    case "pure": {
      const t = read(r.file);
      if (t == null) return `missing file ${r.file}`;
      return t.includes(r.test) ? null : `no test titled "${r.test}" in ${r.file}`;
    }
    case "report": {
      const t = read(r.file);
      if (t == null) return `missing report ${r.file}`;
      let j: unknown;
      try { j = JSON.parse(t); } catch { return `unparseable ${r.file}`; }
      const entries: [string, unknown][] = Array.isArray(j)
        ? (j as Record<string, unknown>[]).map((x) => [String(x.id ?? x.name ?? ""), x.ok ?? x.status])
        : Object.entries(j as Record<string, Record<string, unknown>>).map(([k, v]) => [k, v?.ok ?? v?.status]);
      const m = entries.filter(([k]) => k.includes(r.key));
      if (!m.length) return `no entry "${r.key}" in ${r.file}`;
      return m.some(([, v]) => v === true || v === "pass") ? null : `entry "${r.key}" in ${r.file} is not passing`;
    }
    case "script": {
      const t = read(r.file);
      if (t == null) return `missing file ${r.file}`;
      return t.includes(r.match) ? null : `"${r.match}" not found in ${r.file}`;
    }
    case "tracker": {
      const t = read("lib/testTracker/catalogue.ts");
      return t && t.includes(r.id) ? null : `tracker id ${r.id} not in catalogue`;
    }
    case "fuzz": {
      const dir = path.join(ROOT, "server/tools/assure/actions");
      const files = fs.existsSync(dir) ? fs.readdirSync(dir).map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("\n") : "";
      return files.includes(`"${r.action}"`) || files.includes(`'${r.action}'`) ? null : `fuzz action ${r.area}/${r.action} not found in actions/`;
    }
  }
}
function claimOk(c: Claim): boolean {
  if (verified.has(c.id)) return verified.get(c.id)!;
  const bad = c.refs.map(verifyRef).filter(Boolean) as string[];
  if (!c.refs.length) bad.push("claim cites no evidence");
  for (const b of bad) problems.push(`claim ${c.id}: ${b}`);
  verified.set(c.id, bad.length === 0);
  return bad.length === 0;
}

// ---- build the matrix --------------------------------------------------------------------------------------------------------
type State = "T" | "N" | "G";
interface Cell { state: State; why: string }
const rowIds = new Set(ROWS.map((r) => r.id)), colIds = new Set(COLS.map((c) => c.id));
for (const c of CLAIMS) {
  for (const r of c.rows) if (!rowIds.has(r)) problems.push(`claim ${c.id}: unknown row ${r}`);
  for (const k of c.cols) if (!colIds.has(k)) problems.push(`claim ${c.id}: unknown column ${k}`);
}
for (const n of NOT_ALLOWED) {
  const t = read(n.source.file);
  if (t == null || !t.includes(n.source.match)) problems.push(`not-allowed ${n.id}: server rule text "${n.source.match}" not found in ${n.source.file}`);
}

function cell(row: (typeof ROWS)[number], col: (typeof COLS)[number]): Cell {
  const na = NOT_ALLOWED.find((n) => n.rows.includes(row.id) && n.cols.includes(col.id));
  if (na) return { state: "N", why: na.rule };
  const direct = CLAIMS.filter((c) => c.rows.includes(row.id) && c.cols.includes(col.id) && claimOk(c));
  if (direct.length) return { state: "T", why: direct.map((c) => c.id).join(", ") };
  if (!depsOf(col.id).has(row.axis)) {
    const any = CLAIMS.filter((c) => c.cols.includes(col.id) && claimOk(c));
    if (any.length) return { state: "T", why: `independent of ${AXES[row.axis]} (static scan); action tested by ${any[0].id}` };
    return { state: "G", why: `${col.label} has no verified test at all` };
  }
  return { state: "G", why: `${col.label} reads ${AXES[row.axis]} but nothing tests it on "${row.label}"` };
}

const grid = ROWS.map((r) => COLS.map((c) => cell(r, c)));
const count = (s: State) => grid.flat().filter((x) => x.state === s).length;
const [T, N, G] = [count("T"), count("N"), count("G")];

const arg = (f: string) => process.argv.indexOf(f);
if (arg("--deps") >= 0) {
  for (const c of COLS) console.log(c.id.padEnd(20), [...depsOf(c.id)].sort().join(","));
}
if (arg("--html") >= 0) {
  const out = process.argv[arg("--html") + 1];
  const esc = (s: string) => s.replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[m]!);
  const bg = { T: "#cdeccd", N: "#dcdcdc", G: "#f3b4b4" } as const;
  let h = `<!doctype html><meta charset="utf-8"><title>Listings x actions grid</title><style>body{font:13px system-ui;margin:16px;background:#fff;color:#111}table{border-collapse:collapse}th,td{border:1px solid #bbb;padding:3px 5px;text-align:center}th.r{text-align:left;position:sticky;left:0;background:#fff}th.c{min-width:78px;max-width:78px;font-size:11px;font-weight:600;vertical-align:bottom;line-height:1.15;position:sticky;top:0;background:#fff;z-index:2}td{cursor:help}</style>`;
  h += `<h2>Listing configurations x actions</h2><p>${ROWS.length} rows x ${COLS.length} columns = ${ROWS.length * COLS.length} cells: <b style="background:${bg.T}">${T} tested</b>, <b style="background:${bg.N}">${N} not allowed</b>, <b style="background:${bg.G}">${G} gap</b>. Hover a cell for why.</p><table><tr><th></th>`;
  for (const c of COLS) h += `<th class="c" title="${esc(c.group)}">${esc(c.label)}</th>`;
  h += "</tr>";
  let prev = "";
  ROWS.forEach((r, i) => {
    if (r.axis !== prev) { h += `<tr><td colspan="${COLS.length + 1}" style="text-align:left;background:#eee"><b>${esc(AXES[r.axis])}</b></td></tr>`; prev = r.axis; }
    h += `<tr><th class="r">${esc(r.label)}</th>`;
    COLS.forEach((c, j) => { const x = grid[i][j]; h += `<td style="background:${bg[x.state]}" title="${esc(x.why)}">${x.state === "T" ? "&#10003;" : x.state === "N" ? "&ndash;" : "GAP"}</td>`; });
    h += "</tr>";
  });
  h += "</table>";
  const hc = (id: string) => COLS.find((c) => c.id === id)?.label ?? id;
  h += `<h2 style="margin-top:28px;color:#0a4fa8">Needs a human (real money / real devices): ${HUMAN.filter((x) => x.done).length} of ${HUMAN.length} done</h2><table>`;
  for (const x of HUMAN) h += `<tr style="background:${x.done ? "#cdeccd" : "#d6e6fb"}"><td><b>${x.id}</b></td><td style="text-align:left"><b>${esc(x.what)}</b><br>${esc(x.how)}<br><i>${esc(x.cols.map(hc).join(", "))}</i></td><td>${x.done ? "done " + esc(x.done) : "TO DO"}</td></tr>`;
  fs.writeFileSync(out, h + "</table>");
  console.log(`wrote ${out}`);
}

const summary = `GRID ${ROWS.length} rows x ${COLS.length} actions = ${ROWS.length * COLS.length} cells | tested ${T} | not-allowed ${N} | gap ${G}`;
if (arg("--verify") >= 0 || arg("--check") >= 0) {
  const uniq = [...new Set(problems)];
  for (const p of uniq) console.log("PROBLEM:", p);
  console.log(summary);
  if (arg("--check") >= 0) {
    if (G === 0 && uniq.length === 0) console.log("GRID COMPLETE");
    else {
      // group gaps per action so each task is one assignable unit
      COLS.forEach((c, j) => {
        const rows = ROWS.filter((_, i) => grid[i][j].state === "G").map((r) => r.label);
        if (rows.length) console.log(`TASK [${c.id}] ${c.label}: add evidence for ${rows.length} row(s): ${rows.join("; ")}`);
      });
      process.exitCode = 1;
    }
  } else process.exitCode = uniq.length ? 1 : 0;
} else if (arg("--html") < 0 && arg("--deps") < 0) console.log(summary);
