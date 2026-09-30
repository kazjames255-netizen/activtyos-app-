// Repeatable converter for the public marketing site (public/v2/*.html).
//   node scripts/i18n-v2/convert.mjs [--dry]     adds data-i18n / data-i18n-attr hooks (English text is left byte-for-byte as-is)
//                                                and (re)writes public/v2/i18n/en.json from the English in the HTML.
// Idempotent: elements that already carry data-i18n are skipped; en.json is rebuilt from every hook in the HTML, so
// hand-edited English in the HTML is picked up by just re-running. Keys are content-addressed (scope.slug-hash) so they are
// stable across runs. Run `node scripts/i18n-v2/check.mjs` afterwards.
import fs from 'node:fs';
import path from 'node:path';
import { parse, attr, decode, VOID } from './html.mjs';

export const ROOT = path.resolve(new URL('../../public/v2', import.meta.url).pathname);
export const PAGES = ['activly', 'parents', 'companies', 'franchises', 'freelancers', 'schools', 'pricing', 'tour', 'safeguarding', 'security', 'dpa', 'privacy', 'terms', 'platform-bookings', 'platform-comms', 'platform-finance', 'platform-safeguarding', 'platform-staff'];
export const LEGAL = new Set(['privacy', 'terms', 'dpa', 'security', 'safeguarding']);

const INLINE = new Set(['a', 'b', 'strong', 'em', 'i', 'u', 'span', 'small', 'sup', 'sub', 'br', 'code', 'abbr', 'mark', 's', 'kbd', 'time', 'q', 'cite', 'label', 'svg', 'img', 'canvas', 'input', 'select', 'textarea', 'wbr']);
const OPAQUE_TAGS = new Set(['svg', 'img', 'canvas', 'input', 'select', 'textarea', 'iframe', 'video', 'audio', 'object']);
const SKIP = new Set(['script', 'style', 'noscript', 'pre', 'code', 'canvas', 'template', 'textarea']);
const TEXT_ATTRS = ['alt', 'title', 'placeholder', 'aria-label'];
const META_CONTENT = /^(description|og:title|og:description|twitter:title|twitter:description)$/;
const hasLetters = (s) => /\p{L}/u.test(s);

export function textOf(n) {
  if (n.type === 'text') return decode(n.raw);
  if (n.type === 'el') return n.children.map(textOf).join('');
  return '';
}
const isOpaque = (el) => (OPAQUE_TAGS.has(el.name) && !(el.name === 'svg' && hasLetters(textOf(el)))) || !hasLetters(textOf(el));
const blocky = (c) => c.type === 'el' && !SKIP.has(c.name) && (!INLINE.has(c.name) || (c.name === 'svg' ? hasLetters(textOf(c)) : containsBlock(c)));
function containsBlock(el) { return el.children.some(blocky); }
const isInlineFlow = (n) => n.type === 'text' || n.type === 'comment' || (n.type === 'el' && INLINE.has(n.name) && !blocky(n));

export function serialize(nodes, ctr = { n: 0 }) {
  let out = '';
  for (const n of nodes) {
    if (n.type === 'text') out += decode(n.raw).replace(/</g, '&lt;');
    else if (n.type === 'el') {
      if (n.name === 'br') { out += '<br>'; continue; }
      const i = ++ctr.n;
      out += isOpaque(n) ? `<${i}/>` : `<${i}>${serialize(n.children, ctr)}</${i}>`;
    }
  }
  return out;
}
export const BRAND_LITERAL = 'Activly';
export const norm = (s) => s.replace(/[ \t\r\n\f]+/g, ' ').trim().split(BRAND_LITERAL).join('{brand}');

function h(s) { let x = 5381; for (const c of s) x = ((x * 33) ^ c.codePointAt(0)) >>> 0; return x.toString(36).slice(0, 4); }
function slug(v) {
  const w = v.replace(/<\/?\d+\/?>|<br>/g, ' ').toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]+/g, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 4);
  return (w.join('-') || 'x');
}
const NOTRANS = /^(\{brand\}|Activ|ly|Activly|[A-Z]{1,3})$/;
const initials = (v) => NOTRANS.test(v.replace(/<\/?\d+\/?>/g, ''));

// Collect translatable units of one page. Returns {units:[{value, el, run?, ...}], attrs:[{el,name,value}]}
export function collect(root) {
  const units = [], attrs = [];
  const visit = (el) => {
    if (el.type === 'root') { el.children.forEach(visit); return; }
    if (el.type !== 'el') return;
    // attributes
    for (const a of TEXT_ATTRS) { const v = attr(el, a); if (v != null && hasLetters(decode(v)) && !(a === 'title' && el.name === 'title')) attrs.push({ el, name: a, value: norm(decode(v)) }); }
    if (el.name === 'meta') { const k = attr(el, 'name') || attr(el, 'property'); const c = attr(el, 'content'); if (k && c != null && META_CONTENT.test(k)) attrs.push({ el, name: 'content', value: norm(decode(c)) }); }
    if (el.name === 'input') { const t = (attr(el, 'type') || '').toLowerCase(); const v = attr(el, 'value'); if ((t === 'submit' || t === 'button') && v && hasLetters(v)) attrs.push({ el, name: 'value', value: norm(decode(v)) }); }
    if (SKIP.has(el.name)) return;
    if (el.name === 'head' || el.name === 'html' || el.name === 'root') { el.children.forEach(visit); return; }
    if (attr(el, 'data-i18n') !== undefined) return;
    if (attr(el, 'data-i18n-skip') !== undefined) return;
    const elKids = el.children.filter((c) => c.type === 'el' && c.name !== 'br');
    const split = elKids.length >= 2 && !el.children.some((c) => c.type === 'text' && c.raw.trim()) && !el.children.some((c) => c.type === 'el' && c.name === 'br');
    if (!el.children.some(blocky) && !split) {
      const v = norm(serialize(el.children));
      if (hasLetters(v.replace(/<\/?\d+\/?>|<br>/g, '')) && !initials(v)) units.push({ kind: 'el', el, value: v });
      // still descend into inline children for their attributes
      const d = (n) => { if (n.type === 'el') { for (const a of TEXT_ATTRS) { const v2 = attr(n, a); if (v2 != null && hasLetters(decode(v2))) attrs.push({ el: n, name: a, value: norm(decode(v2)) }); } n.children.forEach(d); } };
      el.children.forEach(d);
      return;
    }
    // mixed / container: split children into runs of inline-flow vs block containers
    let run = [];
    const flush = () => {
      const nodes = run; run = [];
      if (!nodes.length) return;
      const nonWs = nodes.filter((n) => !(n.type === 'comment' || (n.type === 'text' && !n.raw.trim())));
      if (!nonWs.length) return;
      if (nonWs.some((n) => n.type === 'el' && attr(n, 'data-i18n') !== undefined)) return; // already hooked
      const v = norm(serialize(nodes));
      if (!hasLetters(v.replace(/<\/?\d+\/?>|<br>/g, '')) || initials(v)) { nodes.forEach((n) => n.type === 'el' && visit(n)); return; }
      if (nonWs.length === 1 && nonWs[0].type === 'el' && attr(nonWs[0], 'data-i18n') === undefined) {
        const only = nonWs[0]; const v1 = norm(serialize(only.children));
        if (hasLetters(v1.replace(/<\/?\d+\/?>|<br>/g, ''))) { units.push({ kind: 'el', el: only, value: v1 }); return; }
      }
      const first = nonWs[0], last = nonWs[nonWs.length - 1];
      // trim whitespace at the edges of the run (kept outside the wrapper)
      let s = first.start, e = last.end;
      if (first.type === 'text') s = first.start + (first.raw.length - first.raw.trimStart().length);
      if (last.type === 'text') e = last.end - (last.raw.length - last.raw.trimEnd().length);
      units.push({ kind: 'run', value: v, start: s, end: e, nodes });
      nodes.forEach((n) => { if (n.type === 'el') { const d = (x) => { if (x.type === 'el') { for (const a of TEXT_ATTRS) { const v2 = attr(x, a); if (v2 != null && hasLetters(decode(v2))) attrs.push({ el: x, name: a, value: norm(decode(v2)) }); } x.children.forEach(d); } }; d(n); } });
    };
    for (const c of el.children) {
      if (split && c.type === 'el' && isInlineFlow(c)) { flush(); run.push(c); flush(); continue; }
      if (isInlineFlow(c) && !(c.type === 'el' && SKIP.has(c.name) && c.name !== 'svg' && c.name !== 'code')) run.push(c);
      else { flush(); visit(c); }
    }
    flush();
  };
  visit(root);
  return { units, attrs };
}

export function keyFor(scope, value, used) {
  let k = `${scope}.${slug(value)}-${h(value)}`;
  let n = 1; while (used.has(k) && used.get(k) !== value) k = `${scope}.${slug(value)}-${h(value + n++)}`;
  used.set(k, value); return k;
}

function main() {
  const dry = process.argv.includes('--dry');
  const pages = {};
  for (const p of PAGES) {
    const file = path.join(ROOT, p + '.html'); const src = fs.readFileSync(file, 'utf8');
    pages[p] = { file, src, tree: parse(src) };
    pages[p].col = collect(pages[p].tree);
  }
  // existing hooks -> already-known key for a value (so keys stay stable when text is re-run)
  const existing = new Map(); // value -> key
  const en = {};
  for (const p of PAGES) readHooks(pages[p], en, existing);
  // page-count per value (for shared 'g' scope)
  const count = new Map();
  for (const p of PAGES) { const seen = new Set([...pages[p].col.units.map((u) => u.value), ...pages[p].col.attrs.map((a) => a.value)]); seen.forEach((v) => count.set(v, (count.get(v) || 0) + 1)); }
  const used = new Map(Object.entries(en));
  const stats = {};
  for (const p of PAGES) {
    const pg = pages[p]; const ins = []; // {pos, text}
    const keyOf = (v) => { if (existing.has(v)) return existing.get(v); const k = keyFor(count.get(v) > 1 ? 'g' : p, v, used); en[k] = v; existing.set(v, k); return k; };
    for (const u of pg.col.units) {
      const k = keyOf(u.value);
      if (u.kind === 'el') ins.push({ pos: u.el.start + 1 + u.el.name.length, text: ` data-i18n="${k}"` });
      else { ins.push({ pos: u.start, text: `<span data-i18n="${k}" style="display:contents">` }); ins.push({ pos: u.end, text: '</span>' }); }
    }
    const byEl = new Map();
    for (const a of pg.col.attrs) { if (attr(a.el, 'data-i18n-attr') !== undefined) continue; const k = keyOf(a.value); if (!byEl.has(a.el)) byEl.set(a.el, []); byEl.get(a.el).push(`${a.name}:${k}`); }
    for (const [el, list] of byEl) ins.push({ pos: el.start + 1 + el.name.length, text: ` data-i18n-attr="${list.join(';')}"` });
    stats[p] = { units: pg.col.units.length, attrs: pg.col.attrs.length, runs: pg.col.units.filter((u) => u.kind === 'run').length };
    if (!dry) {
      let out = pg.src; ins.sort((a, b) => b.pos - a.pos || (a.text === '</span>' ? -1 : 1));
      for (const i of ins) out = out.slice(0, i.pos) + i.text + out.slice(i.pos);
      fs.writeFileSync(pg.file, out);
    }
  }
  console.table(stats);
  console.log('unique keys:', Object.keys(en).length);
  if (!dry) {
    // rebuild en.json strictly from the (rewritten) HTML so it always mirrors the literal English
    const en2 = {};
    for (const p of PAGES) { const src = fs.readFileSync(pages[p].file, 'utf8'); const t = { src, tree: parse(src) }; readHooks(t, en2, new Map()); }
    fs.mkdirSync(path.join(ROOT, 'i18n'), { recursive: true });
    Object.assign(en2, JSON.parse(fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'dynamic.json'), 'utf8')));
    const sorted = Object.fromEntries(Object.entries(en2).sort(([a], [b]) => a.localeCompare(b)));
    fs.writeFileSync(path.join(ROOT, 'i18n', 'en.json'), JSON.stringify(sorted, null, 1) + '\n');
    console.log('en.json keys:', Object.keys(sorted).length);
  }
}

// Read existing data-i18n hooks out of a parsed page: fills en (key -> English value) and existing (value -> key).
export function readHooks(pg, en, existing) {
  const walk = (n) => {
    if (n.type !== 'el') { (n.children || []).forEach(walk); return; }
    const k = attr(n, 'data-i18n');
    if (k !== undefined) { const v = norm(serialize(n.children)); en[k] = v; existing.set(v, k); }
    const ka = attr(n, 'data-i18n-attr');
    if (ka) for (const pair of ka.split(';')) { const [an, key] = pair.split(':'); let v = attr(n, an); if (an === 'content' || v != null) { v = norm(decode(v || '')); en[key] = v; existing.set(v, key); } }
    n.children.forEach(walk);
  };
  walk(pg.tree);
}

if (process.argv[1] && process.argv[1].endsWith('convert.mjs')) main();
