// Usage: NODE_PATH=<node_modules> OUT=<dir> node scripts/mobile-v2/audit.mjs <label> [pages,csv|*] [viewports,csv|*]
// Serves from http://127.0.0.1:8123 (static server on the worktree's public/). Writes shots + results JSON to OUT.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);
const { webkit, devices } = require('playwright');
const label = process.argv[2] || 'after';
const pageFilter = process.argv[3] && process.argv[3] !== '*' ? process.argv[3].split(',') : null;
const vpFilter = process.argv[4] && process.argv[4] !== '*' ? process.argv[4].split(',') : null;
const OUT = process.env.OUT || '/tmp/mobile-v2-out';
const BASE = 'http://127.0.0.1:8123/v2/';
const PAGES = ['activly','parents','companies','franchises','freelancers','schools','pricing','tour','safeguarding','security','platform-bookings','platform-comms','platform-finance','platform-safeguarding','platform-staff','privacy','terms','dpa'];
const VPS = [
  ['se',320,568,true],['p390',390,844,true],['p430',430,932,true],['land844',844,390,true],
  ['mini744',744,1133,true],['ipad820',820,1180,true],['pro11-834',834,1194,true],['pro129-1024',1024,1366,true],
  ['pro11L',1194,834,true],['ipad820L',1180,820,true],['pro129L',1366,1024,true],
  ['lap1280',1280,800,false],['lap1440',1440,900,false],
];
fs.mkdirSync(`${OUT}/${label}`, { recursive: true });

const detect = () => {
  const vw = innerWidth, res = {};
  res.overflowX = document.documentElement.scrollWidth - vw;
  const all = [...document.body.querySelectorAll('*')];
  const vis = e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width>0 && r.height>0 && cs.visibility!=='hidden' && cs.display!=='none'; };
  const inClipped = e => { for (let p=e.parentElement; p && p!==document.body; p=p.parentElement){ const o=getComputedStyle(p); if(/(hidden|auto|scroll|clip)/.test(o.overflowX)) { const r=p.getBoundingClientRect(); if (r.right<=vw+1 && r.left>=-1) return true; } } return false; };
  res.wide = [];
  for (const e of all) { if(!vis(e)) continue; const r=e.getBoundingClientRect(); if ((r.right>vw+1 || r.left<-1) && !inClipped(e) && getComputedStyle(e).position!=='fixed') { const c = e.className && e.className.baseVal!==undefined ? e.className.baseVal : e.className; res.wide.push(e.tagName.toLowerCase()+'.'+String(c).split(' ')[0]+' '+Math.round(r.left)+'..'+Math.round(r.right)); } }
  res.wide = res.wide.slice(0,400);
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n; res.smallText = 0; res.smallTextSamples=[];
  while ((n = walker.nextNode())) { if(!n.nodeValue.trim()) continue; const e=n.parentElement; if(!e||!vis(e)||e.closest("svg")) continue; const f=parseFloat(getComputedStyle(e).fontSize); if(f<12){ res.smallText++; { const k=e.tagName.toLowerCase()+"."+String(e.className&&e.className.baseVal===undefined?e.className:"").split(" ")[0]+" "+f; res.smallBy=res.smallBy||{}; res.smallBy[k]=(res.smallBy[k]||0)+1; } } }
  res.tap = 0; res.tapSamples=[];
  const tg=[...document.querySelectorAll('a[href],button,input,select,textarea,[role=button],summary')].filter(vis);
  for (const e of tg){ const r=e.getBoundingClientRect(); if (e.tagName==='A' && getComputedStyle(e).display==='inline' && e.closest('p,li,span,small')) continue; if(r.width<44||r.height<44){ res.tap++; if(res.tapSamples.length<8) res.tapSamples.push((e.className||e.tagName)+' '+Math.round(r.width)+'x'+Math.round(r.height)); } }
  res.inputSmall = [...document.querySelectorAll('input,select,textarea')].filter(vis).filter(e=>parseFloat(getComputedStyle(e).fontSize)<16).length;
  res.media = [...document.querySelectorAll('img,video,iframe,svg')].filter(vis).filter(e=>e.getBoundingClientRect().width>vw+1).length;
  res.vh = 0;
  for (const ss of document.styleSheets) { try { for (const r of ss.cssRules) { const t=r.cssText||''; if(/\b(min-)?height:\s*[\d.]+vh\b/.test(t)) res.vh++; if(/background-attachment:\s*fixed/.test(t)) res.bgFixed=(res.bgFixed||0)+1; } } catch(e){} }
  res.viewportFitCover = /viewport-fit=cover/.test((document.querySelector('meta[name=viewport]')||{}).content||'');
  res.navVisible = [...document.querySelectorAll('header.nav a,header.nav button')].filter(vis).length;
  res.hamburger = !!document.querySelector('.rsp-burger');
  res.height = document.documentElement.scrollHeight;
  return res;
};

const results = {};
const wk = await webkit.launch();
for (const p of PAGES) {
  if (pageFilter && !pageFilter.includes(p)) continue;
  for (const [vn, w, h, touch] of VPS) {
    if (vpFilter && !vpFilter.includes(vn)) continue;
    const ctx = await wk.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch, reducedMotion: 'reduce', userAgent: touch ? devices['iPhone 13'].userAgent : undefined });
    const page = await ctx.newPage();
    try {
      await page.goto(BASE + p + '.html' + (process.env.QS||''), { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(600);
      await page.evaluate(async () => { const h=document.documentElement.scrollHeight; for(let y=0;y<h;y+=500){ scrollTo(0,y); await new Promise(r=>setTimeout(r,40)); } scrollTo(0,0); });
      await page.waitForTimeout(500);
      results[`${p}|${vn}`] = await page.evaluate(detect);
      if (!process.env.NOSHOT) await page.screenshot({ path: `${OUT}/${label}/${p}__${vn}.png`, fullPage: true });
    } catch (e) { results[`${p}|${vn}`] = { error: String(e).slice(0,200) }; }
    await ctx.close();
  }
  console.error('done', p);
}
await wk.close();
fs.writeFileSync(`${OUT}/${label}${pageFilter||vpFilter?'.partial':''}.json`, JSON.stringify(results, null, 1));
const tot = {};
for (const [k, v] of Object.entries(results)) { const vn=k.split('|')[1]; tot[vn] ??= {ovf:0,wide:0,small:0,tap:0,inp:0}; if(v.error) continue; tot[vn].ovf += v.overflowX>0?1:0; tot[vn].wide += v.wide.length; tot[vn].small += v.smallText; tot[vn].tap += v.tap; tot[vn].inp += v.inputSmall; }
console.table(tot);
