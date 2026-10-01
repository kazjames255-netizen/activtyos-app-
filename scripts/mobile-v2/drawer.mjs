// node drawer.mjs <page> <w> <h> <out.png>: open burger, expand Platform + Built for, screenshot; also log behaviours
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { webkit } = require('playwright');
const [pg, w, h, out] = process.argv.slice(2);
const b = await webkit.launch();
const ctx = await b.newContext({ viewport: { width: +w, height: +h }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
const p = await ctx.newPage();
await p.goto(`http://127.0.0.1:8123/v2/${pg}.html`, { waitUntil: 'load' });
await p.waitForTimeout(600);
await p.tap('.rsp-burger'); await p.waitForTimeout(300);
const log = {};
log.expanded = await p.getAttribute('.rsp-burger', 'aria-expanded');
const drops = await p.$$('header.nav .navdrop-btn');
if (drops[0]) { await drops[0].tap(); await p.waitForTimeout(300); }
log.platformOpen = await p.evaluate(() => !!document.querySelector('.navdrop.rsp-open .navmega-menu') && getComputedStyle(document.querySelector('.navdrop.rsp-open .navmega-menu')).display);
if (drops[1]) { await drops[1].tap(); await p.waitForTimeout(300); }
log.openCount = await p.evaluate(() => document.querySelectorAll('.navdrop.rsp-open').length);
log.headerH = await p.evaluate(() => Math.round(document.querySelector('header.nav').getBoundingClientRect().height));
log.scrollLocked = await p.evaluate(() => document.documentElement.classList.contains('rsp-lock'));
await p.screenshot({ path: out });
await p.keyboard.press('Escape'); await p.waitForTimeout(200);
log.afterEsc = await p.getAttribute('.rsp-burger', 'aria-expanded');
console.log(JSON.stringify(log));
await b.close();
