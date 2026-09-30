// node probe.mjs <page> <width> [height] -> narrow text columns, multi-col grids, elements clipped by overflow
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { webkit } = require('playwright');
const [page_, w = '390', h = '844'] = process.argv.slice(2);
const b = await webkit.launch();
const ctx = await b.newContext({ viewport: { width: +w, height: +h }, hasTouch: +w < 1100, isMobile: +w < 1100, reducedMotion: 'reduce' });
const p = await ctx.newPage();
await p.goto(`http://127.0.0.1:8123/v2/${page_}.html`, { waitUntil: 'load' });
await p.waitForTimeout(800);
const out = await p.evaluate(() => {
  const sel = e => { let s = e.tagName.toLowerCase(); if (e.id) s += '#' + e.id; const c = (e.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 3).join('.'); if (c) s += '.' + c; return s; };
  const chain = e => { const a = []; for (let i = 0; e && i < 4 && e !== document.body; i++, e = e.parentElement) a.push(sel(e)); return a.join(' < '); };
  const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
  const vw = innerWidth;
  const res = { narrow: [], clipped: [], grids: [] };
  const seen = new Set();
  for (const e of document.body.querySelectorAll('*')) {
    if (!vis(e)) continue;
    const r = e.getBoundingClientRect();
    const own = [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.nodeValue.trim()).join(' ');
    if (own.length > 24 && r.width < Math.min(130, vw * 0.4)) { const k = chain(e); if (!seen.has(k)) { seen.add(k); res.narrow.push(Math.round(r.width) + 'px ' + chain(e) + ' "' + own.slice(0, 30) + '"'); } }
    const cs = getComputedStyle(e);
    if (cs.display === 'grid' || cs.display === 'inline-grid') { const cols = cs.gridTemplateColumns.split(' ').length; if (cols > 1 && r.width > 0) res.grids.push(cols + 'col ' + Math.round(r.width) + 'px ' + chain(e)); }
    if (r.right > vw + 2 || r.left < -2) { const k = 'c' + chain(e); if (!seen.has(k)) { seen.add(k); res.clipped.push(Math.round(r.left) + '..' + Math.round(r.right) + ' ' + chain(e)); } }
  }
  res.narrow = res.narrow.slice(0, 40); res.clipped = res.clipped.filter(c => !/hs-|ch-|ma-|lst|mq|ctrack|slide|track/.test(c)).slice(0, 14); res.grids = res.grids.slice(0, 60);
  return res;
});
console.log(JSON.stringify(out, null, 1));
await b.close();
