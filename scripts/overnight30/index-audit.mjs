#!/usr/bin/env node
// Static Firestore composite-index audit. No dependencies.
//
// Rules implemented (Firestore documented behaviour, conservative):
//  * A query needs a COMPOSITE index when, after dropping orderBy on fields that
//    also carry an equality filter, it has >= 2 index fields and is not
//    "equality-only" (equality-only queries are served by merging single-field
//    indexes). Equality = ==, in.
//  * array-contains / array-contains-any combined with any other equality is
//    merge-able; combined with a range or an orderBy on another field, composite.
//  * Required index fields: equality fields (any order) FIRST, then range/
//    inequality fields (<,<=,>,>=,!=,not-in), then orderBy fields in order.
//    If a range field has no orderBy it is ordered ASC implicitly.
//  * A declared index satisfies a query only on an EXACT match: same collection
//    id, scope compatible (collectionGroup query needs COLLECTION_GROUP scope;
//    collection query accepts COLLECTION scope), the first |E| declared fields are
//    exactly the equality set, and the remainder equal the required ordered list
//    with directions matching, or ALL directions inverted (Firestore scans an
//    index backwards). A trailing __name__ is ignored. Supersets are NOT accepted
//    (conservative: a longer index does not serve a shorter prefix query).
//  * Single-field (one ordering/range field, no other filter) needs no composite.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EQ = new Set(["==", "in"]);
const ARR = new Set(["array-contains", "array-contains-any"]);
const RANGE = new Set(["<", "<=", ">", ">=", "!=", "not-in"]);

function stripComments(src) {
  // keep length/offsets: replace comment chars with spaces (respect strings crudely)
  let out = "", i = 0, n = src.length, q = null;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (q) {
      out += c;
      if (c === "\\") { out += src[i + 1] ?? ""; i += 2; continue; }
      if (c === q) q = null;
      i++; continue;
    }
    if (c === '"' || c === "'" || c === "`") { q = c; out += c; i++; continue; }
    if (c === "/" && d === "/") { while (i < n && src[i] !== "\n") { out += " "; i++; } continue; }
    if (c === "/" && d === "*") {
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) { out += src[i] === "\n" ? "\n" : " "; i++; }
      out += "  "; i += 2; continue;
    }
    out += c; i++;
  }
  return out;
}

// find matching ")" for "(" at index i; returns index of ")" or -1
function matchParen(s, i) {
  let depth = 0, q = null;
  for (let k = i; k < s.length; k++) {
    const c = s[k];
    if (q) { if (c === "\\") k++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === "`") { q = c; continue; }
    if (c === "(") depth++;
    else if (c === ")") { depth--; if (depth === 0) return k; }
  }
  return -1;
}
function matchParenBack(s, i) { // i is index of ")"
  let depth = 0, q = null;
  for (let k = i; k >= 0; k--) {
    const c = s[k];
    if (q) { if (c === q && s[k - 1] !== "\\") q = null; continue; }
    if (c === '"' || c === "'" || c === "`") { q = c; continue; }
    if (c === ")") depth++;
    else if (c === "(") { depth--; if (depth === 0) return k; }
  }
  return -1;
}
function splitArgs(a) {
  const out = []; let depth = 0, q = null, cur = "";
  for (let k = 0; k < a.length; k++) {
    const c = a[k];
    if (q) { cur += c; if (c === "\\") { cur += a[++k] ?? ""; } else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === "`") { q = c; cur += c; continue; }
    if ("([{".includes(c)) depth++;
    if (")]}".includes(c)) depth--;
    if (c === "," && depth === 0) { out.push(cur.trim()); cur = ""; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
const strLit = (s) => { const m = /^(["'`])(.*)\1$/s.exec(s.trim()); return m && !m[2].includes("${") ? m[2] : null; };

function fieldOf(arg) {
  const l = strLit(arg);
  if (l !== null) return { name: l, dynamic: false };
  if (/documentId\(\)/.test(arg) || /^(idPath|docIdPath|idField)$/.test(arg.trim())) return { name: "__name__", dynamic: false };
  return { name: `<dyn:${arg.replace(/\s+/g, " ").slice(0, 40)}>`, dynamic: true };
}

// Parse chains of .method(args) calls. Returns [{calls:[{name,args,start,end}], firstDot}]
function findChains(src) {
  const callRe = /\.\s*([A-Za-z_]\w*)\s*\(/g;
  const calls = [];
  let m;
  while ((m = callRe.exec(src))) {
    const open = m.index + m[0].length - 1;
    const close = matchParen(src, open);
    if (close < 0) continue;
    calls.push({ name: m[1], dot: m.index, open, close, args: src.slice(open + 1, close) });
    callRe.lastIndex = open + 1; // allow nested calls to be found too
  }
  // link: call B chained to call A if only whitespace between A.close+1 and B.dot
  const byDot = new Map(calls.map((c) => [c.dot, c]));
  const nextOf = new Map();
  const hasPrev = new Set();
  for (const a of calls) {
    let k = a.close + 1;
    while (k < src.length && /\s/.test(src[k])) k++;
    if (src[k] === "." && byDot.has(k)) { nextOf.set(a, byDot.get(k)); hasPrev.add(byDot.get(k)); }
  }
  const chains = [];
  for (const a of calls) {
    if (hasPrev.has(a)) continue;
    const list = [a]; let cur = a;
    while (nextOf.has(cur)) { cur = nextOf.get(cur); list.push(cur); }
    if (list.some((c) => c.name === "where" || c.name === "orderBy")) chains.push(list);
  }
  return chains;
}

function lineOf(src, idx) { let n = 1; for (let i = 0; i < idx; i++) if (src[i] === "\n") n++; return n; }

// Resolve the root of a chain (text before first dot).
function resolveRoot(src, firstDot, helpers) {
  let k = firstDot - 1;
  while (k >= 0 && /\s/.test(src[k])) k--;
  if (src[k] === ")") {
    const o = matchParenBack(src, k);
    let j = o - 1; while (j >= 0 && /\s/.test(src[j])) j--;
    let e = j + 1; while (j >= 0 && /[\w$]/.test(src[j])) j--;
    const fn = src.slice(j + 1, e);
    const arg = splitArgs(src.slice(o + 1, k))[0] ?? "";
    if (fn === "collection") { const l = strLit(arg); return l ? { kind: "collection", name: l } : { kind: "collection", name: `<dyn:${arg.slice(0, 30)}>`, dynamic: true }; }
    if (fn === "collectionGroup") { const l = strLit(arg); return l ? { kind: "group", name: l } : { kind: "group", name: `<dyn:${arg}>`, dynamic: true }; }
    if (helpers[fn]) return { kind: helpers[fn].kind, name: helpers[fn].name, via: fn };
    return { kind: "unknown", name: `${fn}()`, dynamic: true };
  }
  let e = k + 1; while (k >= 0 && /[\w$.]/.test(src[k])) k--;
  return { kind: "variable", name: src.slice(k + 1, e), dynamic: true };
}

// helper functions like: const wallets = () => db.collection("x")  /  function wallets() { return db.collection("x"); }
function findHelpers(src) {
  const h = {};
  const re1 = /(?:const|let)\s+(\w+)\s*=\s*(?:\([^)]*\)|\w+)\s*(?::[^=]+)?=>\s*\{?\s*(?:return\s+)?[\w.]*?\.?\s*(collection|collectionGroup)\(\s*(["'`])([^"'`$]+)\3\s*\)/g;
  const re2 = /function\s+(\w+)\s*\([^)]*\)\s*(?::[^{]+)?\{\s*return\s+[\w.()\s]*?\.?(collection|collectionGroup)\(\s*(["'`])([^"'`$]+)\3\s*\)/g;
  for (const re of [re1, re2]) { let m; while ((m = re.exec(src))) h[m[1]] = { kind: m[2] === "collection" ? "collection" : "group", name: m[4] }; }
  return h;
}

// Build query descriptor from the chain calls.
function describe(calls) {
  const filters = [], orders = [];
  let dynamic = false;
  for (const c of calls) {
    if (c.name === "where") {
      const a = splitArgs(c.args);
      if (a.length < 3) { dynamic = true; continue; } // Filter.or(...) etc
      const f = fieldOf(a[0]); if (f.dynamic) dynamic = true;
      const op = strLit(a[1]);
      if (!op) { dynamic = true; continue; }
      filters.push({ field: f.name, op });
    } else if (c.name === "orderBy") {
      const a = splitArgs(c.args);
      const f = fieldOf(a[0] ?? ""); if (f.dynamic) dynamic = true;
      const dir = /desc/i.test(a[1] ?? "") ? "DESCENDING" : "ASCENDING";
      orders.push({ field: f.name, dir });
    }
  }
  return { filters, orders, dynamic };
}

function requiredIndex(q) {
  const eq = new Set(), arr = new Set(), range = [];
  for (const f of q.filters) {
    if (EQ.has(f.op)) eq.add(f.field);
    else if (ARR.has(f.op)) arr.add(f.field);
    else if (RANGE.has(f.op) && !range.includes(f.field)) range.push(f.field);
  }
  // orderBy on an equality field is a no-op
  const orders = q.orders.filter((o, i, all) => o.field !== "__name__" && !eq.has(o.field) && all.findIndex((x) => x.field === o.field) === i);
  const seq = []; // ordered non-equality fields
  const used = new Set();
  // orderBy on range fields come in orderBy order; unordered range fields implicitly ASC after
  for (const o of orders) { if (range.includes(o.field) || !used.has(o.field)) { seq.push({ ...o }); used.add(o.field); } }
  const rangeFirst = range.filter((r) => !used.has(r)).map((r) => ({ field: r, dir: "ASCENDING", implicit: true }));
  // range fields not ordered explicitly precede explicit orderBy fields
  const ordered = [...rangeFirst, ...seq];
  const fields = [...eq].map((f) => ({ field: f, eq: true })).concat(ordered);
  const arrNeeds = arr.size > 0 && ordered.length > 0; // array-contains + range/order
  const nonEq = ordered.length;
  let composite;
  if (nonEq === 0 && !arrNeeds) composite = false;       // equality-only (+ array-contains merge)
  else if (eq.size === 0 && arr.size === 0 && nonEq <= 1) composite = false; // single field
  else composite = true;
  return { eq: [...eq], arr: [...arr], ordered, composite, fields };
}

function satisfied(req, coll, isGroup, indexes) {
  const E = new Set(req.eq);
  // array-contains fields are part of the index as CONTAINS config; we require the
  // declared index to mention them (treated as equality-position) -> not satisfiable
  // by plain ASC/DESC entries, so arrays go "missing" unless declared with arrayConfig.
  const Eall = new Set([...E, ...req.arr]);
  for (const ix of indexes) {
    if (ix.collectionGroup !== coll) continue;
    if (isGroup && ix.queryScope !== "COLLECTION_GROUP") continue;
    if (!isGroup && !["COLLECTION", "COLLECTION_GROUP"].includes(ix.queryScope)) continue;
    let df = (ix.fields || []).filter((f) => f.fieldPath !== "__name__");
    const n = Eall.size;
    if (df.length !== n + req.ordered.length) continue;
    const head = df.slice(0, n);
    const headOk = head.every((f) => Eall.has(f.fieldPath) && (req.arr.includes(f.fieldPath) ? !!f.arrayConfig : !f.arrayConfig)) && new Set(head.map((f) => f.fieldPath)).size === n;
    if (!headOk) continue;
    const tail = df.slice(n);
    const dirOf = (f) => f.order;
    const same = tail.every((f, i) => f.fieldPath === req.ordered[i].field && dirOf(f) === req.ordered[i].dir);
    const inv = (d) => (d === "ASCENDING" ? "DESCENDING" : "ASCENDING");
    const rev = tail.every((f, i) => f.fieldPath === req.ordered[i].field && dirOf(f) === inv(req.ordered[i].dir));
    // implicit range-only ordering may be scanned either way
    const onlyImplicit = req.ordered.every((o) => o.implicit) && tail.every((f, i) => f.fieldPath === req.ordered[i].field);
    if (same || rev || onlyImplicit) return ix;
  }
  return null;
}

const DEV_RE = /(^|\/)(seed\w*|backfill\w*|e2e\w*|fix\w*|promote\w*|copy\w*|create\w*|set\w*|verify\w*|check\w*|audit\w*|fake\w*|hub(SelfTest|LoadTest|CacheBench|DigestRun)\w*|support\w*)\.m?ts$|scripts\//;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (/^(node_modules|oak|scratch|data|curriculum)$/i.test(e.name)) continue; walk(p, out); }
    else if (/\.m?ts$/.test(e.name) && !/test|selftest|scratch|\.d\.ts/i.test(e.name)) out.push(p);
  }
  return out;
}

function rootAndCalls(clean, calls, helpers) {
  const ci = calls.map((c) => c.name).reduce((a, n, i) => (n === "collection" || n === "collectionGroup" ? i : a), -1);
  if (ci >= 0) {
    const c = calls[ci], arg = splitArgs(c.args)[0] ?? "", l = strLit(arg);
    return { root: { kind: c.name === "collectionGroup" ? "group" : "collection", name: l ?? `<dyn:${arg.slice(0, 30)}>`, dynamic: l === null }, calls: calls.slice(ci + 1) };
  }
  return { root: resolveRoot(clean, calls[0].dot, helpers), calls };
}

function analyse(src, file, indexes) {
  const clean = stripComments(src);
  const helpers = findHelpers(clean);
  const all = findChains(clean);
  const results = [];
  for (const chain of all) {
    let { root, calls } = rootAndCalls(clean, chain, helpers);
    if (!calls.length) continue;
    let q = describe(calls);
    let note = "";
    // Variable-rooted chain (`q = q.where(..)`): accumulate every earlier chain assigned to the same variable since its
    // `let/const` declaration (all conditional branches unioned, which over-approximates = conservative), then resolve the root.
    if (root.kind === "variable") {
      const V = root.name, nm = V.replace(/[$.]/g, "\\$&");
      const declRe = new RegExp(`\\b(?:let|const|var)\\s+${nm}\\b`, "g");
      let declAt = -1, mm; while ((mm = declRe.exec(clean)) && mm.index < chain[0].dot) declAt = mm.index;
      const stmtOf = (c) => { const before = clean.slice(0, c[0].dot); const st = Math.max(before.lastIndexOf(";"), before.lastIndexOf("{"), before.lastIndexOf("}")) + 1; return clean.slice(st, c[0].dot); };
      const assignRe = new RegExp(`^\\s*(?:(?:let|const|var)\\s+)?${nm}\\s*(?::[^=]+)?=\\s*[\\w$.]*(?:\\([^)]*\\))?\\s*$`);
      if (declAt >= 0) {
        const prior = all.filter((c) => c !== chain && c[0].dot > declAt && c[0].dot < chain[0].dot && assignRe.test(stmtOf(c)));
        let rootFound = null;
        for (const c of prior) {
          const r2 = rootAndCalls(clean, c, helpers), q2 = describe(r2.calls);
          q = { filters: [...q2.filters, ...q.filters], orders: [...q2.orders, ...q.orders], dynamic: q.dynamic || q2.dynamic };
          if (r2.root.kind !== "variable" || r2.root.name !== V) rootFound = r2.root;
          note = "variable-built; earlier assignments unioned (conditional branches over-approximated)";
        }
        if (rootFound) root = rootFound;
        else {
          // declaration like `let q = col as Query` -> resolve the aliased root variable
          const dm = new RegExp(`(?:let|const|var)\\s+${nm}\\s*(?::[^=;]+)?=\\s*([\\w$.]+)`).exec(clean.slice(declAt));
          if (dm && dm[1] !== V && !/^\s*[\w$.]*\s*(?:as\s+\w[\w.]*\s*)?$/.test("") && !/collection(Group)?\(/.test(clean.slice(declAt, declAt + 160).split(";")[0])) root = { kind: "variable", name: dm[1].split(".").pop(), dynamic: true };
        }
      }
    }
    let guard = 0;
    while (root.kind === "variable" && guard++ < 3) {
      const nm = root.name.replace(/[$.]/g, "\\$&");
      const mm = new RegExp(`\\b(?:const|let|var)\\s+${nm}\\s*(?::[^=;]+)?=\\s*[^;]*?\\b(collectionGroup|collection)\\(\\s*(["'\`])([^"'\`$]+)\\2\\s*\\)`).exec(clean);
      if (mm) { root = { kind: mm[1] === "collectionGroup" ? "group" : "collection", name: mm[3], via: root.name }; break; }
      const fn = helpers[root.name];
      if (fn) { root = { kind: fn.kind, name: fn.name, via: root.name }; break; }
      break;
    }
    // dedupe identical filters (union of branches)
    const seen = new Set(); q.filters = q.filters.filter((f) => { const k = f.field + f.op; if (seen.has(k)) return false; seen.add(k); return true; });
    const seenO = new Set(); q.orders = q.orders.filter((o) => { const k = o.field; if (seenO.has(k)) return false; seenO.add(k); return true; });
    const isGroup = root.kind === "group";
    const req = requiredIndex(q);
    let status, ix = null;
    const unresolved = root.dynamic || q.dynamic || root.kind === "variable" || root.kind === "unknown";
    if (!req.composite && !unresolved) status = "none-needed";
    else if (unresolved && !req.composite) status = "unresolved";
    else { ix = satisfied(req, root.name, isGroup, indexes); status = ix ? "satisfied" : unresolved ? "unresolved-composite" : "MISSING"; }
    results.push({ file, line: lineOf(src, chain[0].dot), root, q, req, status, note, dev: DEV_RE.test(file.replace(/\\/g, "/")) });
  }
  return results;
}

function fmt(r) {
  const fl = r.q.filters.map((f) => `${f.field} ${f.op}`).join(", ") || "-";
  const ob = r.q.orders.map((o) => `${o.field} ${o.dir === "DESCENDING" ? "desc" : "asc"}`).join(", ") || "-";
  const need = r.req.composite ? `[${r.req.eq.concat(r.req.arr.map((a) => a + "(array)")).join(",")} | ${r.req.ordered.map((o) => o.field + " " + o.dir[0]).join(",")}]` : "no composite";
  return `${r.file}:${r.line} ${r.root.kind === "group" ? "collectionGroup" : "collection"}(${r.root.name}${r.root.via ? " via " + r.root.via + "()" : ""}) where[${fl}] orderBy[${ob}] -> ${r.status} ${need}${r.dev ? " (dev/seed script)" : ""}${r.note ? " NOTE: " + r.note : ""}`;
}

function selftest() {
  const idx = [{ collectionGroup: "things", queryScope: "COLLECTION", fields: [{ fieldPath: "tenantId", order: "ASCENDING" }, { fieldPath: "at", order: "DESCENDING" }] }];
  const fixtures = {
    missing: `db.collection("widgets").where("tenantId","==",t).where("day",">=",d).get();`,
    satisfied: `db.collection("things")\n .where("tenantId", "==", t)\n .orderBy("at", "desc").limit(5).get();`,
    equalityOnly: `db.collection("widgets").where("a","==",1).where("b","==",2).get();`,
    singleOrder: `db.collection("widgets").orderBy("at").get();`,
    groupNeedsGroupScope: `db.collectionGroup("things").where("tenantId","==",t).orderBy("at","desc").get();`,
  };
  const st = (s) => analyse(s, "fx.ts", idx)[0]?.status;
  const checks = [
    st(fixtures.missing) === "MISSING",
    st(fixtures.satisfied) === "satisfied",
    st(fixtures.equalityOnly) === "none-needed",
    st(fixtures.singleOrder) === "none-needed",
    st(fixtures.groupNeedsGroupScope) === "MISSING",
  ];
  if (checks.every(Boolean)) { console.log("index-audit selftest passed"); return 0; }
  console.log("index-audit selftest FAILED", checks); return 1;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--selftest")) process.exit(selftest());
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const indexes = JSON.parse(fs.readFileSync(path.join(root, "firestore.indexes.json"), "utf8")).indexes;
  const srcDir = path.join(root, "server/src");
  const results = [];
  for (const f of walk(srcDir).sort()) results.push(...analyse(fs.readFileSync(f, "utf8"), path.relative(root, f), indexes));
  const verbose = !args.includes("--quiet");
  const order = { MISSING: 0, "unresolved-composite": 1, unresolved: 2, satisfied: 3, "none-needed": 4 };
  results.sort((a, b) => order[a.status] - order[b.status]);
  if (verbose) for (const r of results) if (args.includes("--all") || r.status !== "none-needed") console.log(fmt(r));
  const missing = results.filter((r) => r.status === "MISSING");
  const unres = results.filter((r) => r.status.startsWith("unresolved"));
  const used = new Set(results.filter((r) => r.status === "satisfied").map((r) => satisfied(r.req, r.root.name, r.root.kind === "group", indexes)));
  for (const ix of indexes) if (!used.has(ix)) console.log(`info: declared index not matched by a statically-resolved query (likely built from a function parameter, or unused): ${ix.collectionGroup} [${ix.fields.map((f) => f.fieldPath).join(", ")}]`);
  console.log(`(${unres.length} queries had dynamic/unresolvable parts, see lines marked unresolved; ${missing.filter((r) => r.dev).length} missing are dev/seed only)`);
  console.log(`index audit: ${results.length} queries scanned, ${missing.length} missing`);
}
main();
