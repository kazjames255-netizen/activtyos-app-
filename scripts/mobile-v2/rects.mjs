// node rects.mjs <page> <width> <selector> -> bounding rects + key computed styles of matches
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { webkit } = require('playwright');
const [pg, w, sel, h = '844'] = process.argv.slice(2);
const b = await webkit.launch();
const ctx = await b.newContext({ viewport: { width: +w, height: +h }, hasTouch: +w < 1100, isMobile: +w < 1100, reducedMotion: 'reduce' });
const p = await ctx.newPage();
await p.goto(`http://127.0.0.1:8123/v2/${pg}.html`, { waitUntil: 'load' });
await p.waitForTimeout(800);
console.log(JSON.stringify(await p.evaluate(s => [...document.querySelectorAll(s)].slice(0, 12).map(e => { const r = e.getBoundingClientRect(), c = getComputedStyle(e); return { tag: e.tagName + '.' + e.className, x: Math.round(r.x), y: Math.round(r.y + scrollY), w: Math.round(r.width), h: Math.round(r.height), disp: c.display, pos: c.position, ov: c.overflow, jc: c.justifyContent, mh: c.minHeight, height: c.height, fs: c.fontSize }; }), sel), null, 1));
await b.close();
