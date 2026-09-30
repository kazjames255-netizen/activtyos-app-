/* ActivityOS marketing site: language switching (static hosting, no framework).
 * English stays literal in the HTML. For other languages the dictionary /v2/i18n/<lang>.json maps key -> string and this
 * script rewrites every [data-i18n] element and every [data-i18n-attr] attribute in place. Markup inside a string uses
 * indexed tags: <1>..</1> = the 1st element of the original (attributes/classes/links kept), <2/> = an element kept as-is
 * (icon, svg, price span), <br> = line break. {brand} = the product name (the ONE place to rename it is BRAND below).
 * Loaded after an early inline script in <head> (sets lang/dir/class before first paint and starts the dictionary fetch).
 * Docs: docs/i18n-website.md */
(function () {
  'use strict';
  var BRAND = 'Activly';          // <- the product name shown on every page in every language (rename here)
  var HTML_BRAND = 'Activly';     // the brand word literally present in the static HTML (English text, SEO); see scripts/i18n-v2/rebrand.mjs
  var LANGS = ['en', 'ar', 'ur', 'pl', 'ro', 'cy', 'bn', 'pa', 'pt', 'es', 'fr'];
  var RTL = { ar: 1, ur: 1 };
  var V = window.__aosV || '1';
  var root = document.documentElement;
  var cur = window.__aosLang || 'en';
  var dicts = {};          // lang -> {key: string}
  var maps = new WeakMap(); // unit element -> array of original descendant nodes (pre-order, by index)
  var attrEn = new WeakMap(); // element -> {attr: original english value}
  var opaqueTags = { SVG: 1, IMG: 1, CANVAS: 1, INPUT: 1, SELECT: 1, TEXTAREA: 1, IFRAME: 1, VIDEO: 1, AUDIO: 1, OBJECT: 1 };
  var hasLetter = /\p{L}/u;

  function brand(s) { return s.split('{brand}').join(BRAND); }
  function load(lang) {
    if (dicts[lang]) return Promise.resolve(dicts[lang]);
    var p = (lang === window.__aosLang && window.__aosDictP) ? window.__aosDictP : fetch('/v2/i18n/' + lang + '.json?v=' + V).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
    return p.then(function (d) { dicts[lang] = d; return d; });
  }
  function isOpaque(n) {
    if (opaqueTags[n.tagName.toUpperCase()] && !(n.tagName.toLowerCase() === 'svg' && hasLetter.test(n.textContent))) return true;
    return !hasLetter.test(n.textContent);
  }
  function indexMap(nodes, out) {
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.nodeType === 1 && n.tagName !== 'BR') { out.push(n); if (!isOpaque(n)) indexMap(n.childNodes, out); }
    }
    return out;
  }
  var TOK = /<(\/?)(\d+)(\/?)>|<br\s*\/?>/g;
  function build(map, value) {
    var frag = document.createDocumentFragment(), stack = [frag], last = 0, m;
    TOK.lastIndex = 0;
    function text(s) { if (s) stack[stack.length - 1].appendChild(document.createTextNode(s.split('&lt;').join('<'))); }
    while ((m = TOK.exec(value))) {
      text(value.slice(last, m.index)); last = TOK.lastIndex;
      if (m[0].charAt(1) === 'b') { stack[stack.length - 1].appendChild(document.createElement('br')); continue; }
      var src = map[+m[2] - 1];
      if (!src) return null;
      if (m[3]) { stack[stack.length - 1].appendChild(src); }                  // <n/> keep original node (moved)
      else if (m[1]) { if (stack.length < 2) return null; stack.pop(); }       // </n>
      else { var sh = src.cloneNode(false); stack[stack.length - 1].appendChild(sh); stack.push(sh); }
    }
    text(value.slice(last));
    return stack.length === 1 ? frag : null;
  }
  function setUnit(el, value) {
    var map = maps.get(el);
    if (!map) { map = indexMap(el.childNodes, []); maps.set(el, map); }
    var f = build(map, brand(value));
    if (!f) return false;
    while (el.firstChild) el.removeChild(el.firstChild);
    el.appendChild(f);
    return true;
  }
  function apply(lang, dict, en) {
    var units = document.querySelectorAll('[data-i18n]'), i, el, k, v;
    for (i = 0; i < units.length; i++) {
      el = units[i]; k = el.getAttribute('data-i18n');
      v = dict && dict[k];
      if (v == null || v === '') { if (!en) continue; v = en[k]; if (v == null) continue; }
      if (!setUnit(el, v) && en && en[k] != null) setUnit(el, en[k]);
    }
    var at = document.querySelectorAll('[data-i18n-attr]'), j, pairs, p, name, key, val;
    for (i = 0; i < at.length; i++) {
      el = at[i]; pairs = el.getAttribute('data-i18n-attr').split(';');
      for (j = 0; j < pairs.length; j++) {
        p = pairs[j].split(':'); name = p[0]; key = p[1];
        var o = attrEn.get(el); if (!o) { o = {}; attrEn.set(el, o); }
        if (!(name in o)) o[name] = el.getAttribute(name);
        val = dict && dict[key];
        if (val == null || val === '') val = (en && en[key] != null) ? en[key] : o[name];
        if (val != null) el.setAttribute(name, brand(val));
      }
    }
    if (window.aosRebrand) window.aosRebrand();
  }
  function setDoc(lang) {
    root.setAttribute('lang', lang);
    root.setAttribute('dir', RTL[lang] ? 'rtl' : 'ltr');
    root.classList.remove('i18n-wait');
    cur = lang; window.__aosLang = lang;
    var sel = document.getElementById('aosLang'); if (sel && sel.value !== lang) sel.value = lang;
    legalNote(lang);
  }
  // Translated legal/pricing pages carry a notice that the English version is the binding one.
  function legalNote(lang) {
    var kind = document.body && document.body.getAttribute('data-aos-legal');
    var old = document.getElementById('aosLegalNote'); if (old) old.parentNode.removeChild(old);
    if (!kind || lang === 'en') return;
    var d = document.createElement('div'); d.id = 'aosLegalNote'; d.className = 'aos-legal-note'; d.setAttribute('role', 'note');
    var t = document.createElement('span'); t.textContent = window.aosT(kind === 'pricing' ? 'js.pricing-notice' : 'js.legal-notice', kind === 'pricing' ? 'Translation notice: this page has been translated for your convenience. The English version is the authoritative version of our prices and plan terms and prevails if there is any difference.' : 'Translation notice: this page has been translated for your convenience only. The English version is the legally binding version and prevails if there is any difference between the two.');
    var a = document.createElement('a'); a.href = '#'; a.textContent = window.aosT('js.legal-notice-link', 'Read the English version');
    a.addEventListener('click', function (e) { e.preventDefault(); set('en'); });
    d.appendChild(t); d.appendChild(document.createTextNode(' ')); d.appendChild(a);
    var h = document.querySelector('header.nav'); if (h && h.parentNode) h.parentNode.insertBefore(d, h.nextSibling); else document.body.insertBefore(d, document.body.firstChild);
  }
  function loadEn() { return load('en'); }
  function go(lang, first) {
    var p;
    if (lang === 'en') p = first ? Promise.resolve(null) : loadEn().then(function (en) { apply('en', en, en); });
    else p = Promise.all([load(lang), first ? Promise.resolve(null) : loadEn()]).then(function (r) { apply(lang, r[0], r[1]); });
    return p.then(function () { setDoc(lang); if (first && lang === 'en') return; if (!first) fire(lang); }, function () { setDoc(first ? 'en' : cur); root.classList.remove('i18n-wait'); });
  }
  function fire(lang) { try { window.dispatchEvent(new CustomEvent('aos:lang', { detail: { lang: lang } })); } catch (e) {} }
  function save(lang) { try { localStorage.setItem('aos-lang', lang); } catch (e) {} try { document.cookie = 'aos-lang=' + lang + ';path=/;max-age=31536000;samesite=lax'; } catch (e) {} }
  function set(lang) { if (LANGS.indexOf(lang) < 0) return Promise.resolve(); save(lang); return go(lang, false); }

  // public helpers
  window.aosT = function (key, fallback) { var d = dicts[cur]; var v = d && d[key]; return brand(v != null && v !== '' ? v : fallback); };
  window.aosSetLang = set;
  window.aosLocale = function () { return cur === 'en' ? 'en-GB' : cur + '-GB-u-nu-latn'; };
  window.aosLang = function () { return cur; };

  function rebrandEn() {
    // Keeps English/SEO text in sync when BRAND differs from the literal in the static HTML (single-constant rename)
    if (BRAND === HTML_BRAND) return;
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null), n;
    while ((n = w.nextNode())) if (n.nodeValue.indexOf(HTML_BRAND) >= 0 && !/^(SCRIPT|STYLE)$/.test(n.parentNode.tagName)) n.nodeValue = n.nodeValue.split(HTML_BRAND).join(BRAND);
    if (document.title.indexOf(HTML_BRAND) >= 0) document.title = document.title.split(HTML_BRAND).join(BRAND);
  }
  window.aosRebrand = rebrandEn;

  function init() {
    var sel = document.getElementById('aosLang');
    if (sel) { sel.value = cur; sel.addEventListener('change', function () { set(sel.value); }); }
    window.addEventListener('storage', function (e) { if (e.key === 'aos-lang' && e.newValue && e.newValue !== cur && LANGS.indexOf(e.newValue) >= 0) go(e.newValue, false); });
    if (cur === 'en') { rebrandEn(); root.classList.remove('i18n-wait'); fire('en'); return; }
    go(cur, true).then(function () { rebrandEn(); fire(cur); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
