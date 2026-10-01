// node at.mjs <page> <w> <h> <x> <y> [scrollY]: which element is at that viewport point
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { webkit } = require('playwright');
const [pg, w, h, x, y, sy = '0'] = process.argv.slice(2);
const b = await webkit.launch();
const ctx = await b.newContext({ viewport: { width: +w, height: +h }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
const p = await ctx.newPage();
await p.goto(`http://127.0.0.1:8123/v2/${pg}.html`, { waitUntil: 'load' });
await p.waitForTimeout(800);
await p.evaluate(v => scrollTo(0, v), +sy);
await p.waitForTimeout(300);
console.log(await p.evaluate(([x, y]) => [...document.querySelectorAll("*")].filter(e => { const r = e.getBoundingClientRect(); return r.left <= x && r.right >= x && r.top <= y && r.bottom >= y && getComputedStyle(e).position !== "static" }).slice(0, 12).map(e => { const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return e.tagName + '.' + e.className + ' ' + Math.round(r.x) + ',' + Math.round(r.y) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height) + ' pos=' + c.position + ' bg=' + c.backgroundColor; }).join('\n'), [+x, +y]));
await b.close();
