// Idempotently injects the i18n plumbing into every public/v2 page:
//   <head>: early language script (sets lang/dir, starts the dictionary fetch, hides body until translated), i18n.css, i18n.js
//   header : the language selector (native <select>, static native-language option labels)
// Re-run any time; existing blocks are replaced in place (marked with data-aos-i18n).   node scripts/i18n-v2/inject.mjs
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, PAGES } from './convert.mjs';

export const VERSION = '1';
export const LANGS = [['en', 'English'], ['ar', 'العربية'], ['ur', 'اردو'], ['pl', 'Polski'], ['ro', 'Română'], ['cy', 'Cymraeg'], ['bn', 'বাংলা'], ['pa', 'ਪੰਜਾਬੀ'], ['pt', 'Português'], ['es', 'Español'], ['fr', 'Français']];
const early = `<script data-aos-i18n>(function(){try{var L=${JSON.stringify(LANGS.map((x) => x[0]))},d=document.documentElement,l=null;try{l=localStorage.getItem('aos-lang')}catch(e){}if(!l||L.indexOf(l)<0){l='en';var n=navigator.languages||[navigator.language||'en'];for(var i=0;i<n.length;i++){var c=String(n[i]).toLowerCase().split('-')[0];if(L.indexOf(c)>=0){l=c;break}}}window.__aosV='${VERSION}';window.__aosLang=l;d.setAttribute('lang',l);d.setAttribute('dir',l==='ar'||l==='ur'?'rtl':'ltr');if(l!=='en'){d.className+=' i18n-wait';setTimeout(function(){d.className=d.className.replace(' i18n-wait','')},3500);try{window.__aosDictP=fetch('/v2/i18n/'+l+'.json?v=${VERSION}').then(function(r){return r.json()})}catch(e){}}}catch(e){}})();</script><link rel="stylesheet" href="/v2/i18n.css?v=${VERSION}" data-aos-i18n><script src="/v2/i18n.js?v=${VERSION}" defer data-aos-i18n></script>`;
const sel = `<div class="lang-sw" data-aos-i18n><svg class="lang-globe" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.9 5.6 3.9 9s-1.3 6.4-3.9 9c-2.6-2.6-3.9-5.6-3.9-9S9.4 5.6 12 3z"/></svg><select class="lang-sel" id="aosLang" aria-label="Language">${LANGS.map(([c, n]) => `<option value="${c}" lang="${c}">${n}</option>`).join('')}</select></div>`;

for (const p of PAGES) {
  const f = path.join(ROOT, p + '.html'); let s = fs.readFileSync(f, 'utf8');
  // strip old blocks
  s = s.replace(/<script data-aos-i18n>[\s\S]*?<\/script>/g, '').replace(/<link[^>]*data-aos-i18n>/g, '').replace(/<script[^>]*data-aos-i18n><\/script>/g, '').replace(/<div class="lang-sw" data-aos-i18n>[\s\S]*?<\/select><\/div>/g, '');
  // head: right after the viewport meta (so it runs before any CSS/paint)
  const vp = s.match(/<meta name="viewport"[^>]*>/); if (!vp) throw new Error('no viewport ' + p);
  s = s.replace(vp[0], vp[0] + early);
  // selector
  if (s.includes('<div class="nav-cta">')) s = s.replace('<div class="nav-cta">', '<div class="nav-cta">' + sel);
  else if (s.includes('</nav></div></header>')) s = s.replace('</nav></div></header>', '</nav>' + sel + '</div></header>');
  else throw new Error('no header slot ' + p);
  if (!/<title/.test(s)) s = s.replace(early, early + '<title>For parents — Activly</title>');
  fs.writeFileSync(f, s);
}
console.log('injected', PAGES.length, 'pages');
