// node shot.mjs <page> <width> <height> <scrollY> <out.png> [selectorToClick] [fullpage=0]  (viewport screenshot at scroll position)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { webkit } = require('playwright');
const [pg, w, h, y = '0', out, click, full] = process.argv.slice(2);
const b = await webkit.launch();
const ctx = await b.newContext({ viewport: { width: +w, height: +h }, hasTouch: +w < 1100, isMobile: +w < 1100, reducedMotion: 'reduce' });
const p = await ctx.newPage();
await p.goto(`http://127.0.0.1:8123/v2/${pg}.html`, { waitUntil: 'load' });
await p.waitForTimeout(800);
if (click && click !== '-') { await p.tap(click); await p.waitForTimeout(500); }
await p.evaluate(v => scrollTo(0, v), +y);
await p.waitForTimeout(500);
await p.screenshot({ path: out, fullPage: full === '1' });
await b.close();
