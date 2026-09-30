// Tiny, offset-preserving HTML tokenizer + tree builder for the hand-written marketing pages (public/v2/*.html).
// Not a general HTML5 parser: the pages are well-formed enough (verified by the convert script's round-trip check).
export const VOID = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
const RAW = new Set(['script', 'style']);

export function parse(src) {
  const root = { type: 'root', children: [], start: 0, end: src.length };
  const stack = [root];
  let i = 0;
  const top = () => stack[stack.length - 1];
  const pushText = (s, e) => { if (e > s) top().children.push({ type: 'text', start: s, end: e, raw: src.slice(s, e), parent: top() }); };
  while (i < src.length) {
    if (src[i] !== '<') { const j = nextLt(src, i); pushText(i, j); i = j; continue; }
    if (src.startsWith('<!--', i)) { const j = src.indexOf('-->', i + 4); const e = j < 0 ? src.length : j + 3; top().children.push({ type: 'comment', start: i, end: e, parent: top() }); i = e; continue; }
    if (src.startsWith('<!', i)) { const j = src.indexOf('>', i); const e = j < 0 ? src.length : j + 1; top().children.push({ type: 'doctype', start: i, end: e, parent: top() }); i = e; continue; }
    if (src[i + 1] === '/') {
      const j = src.indexOf('>', i); const e = j < 0 ? src.length : j + 1;
      const name = src.slice(i + 2, e - 1).trim().toLowerCase();
      // pop to the matching open element
      let k = stack.length - 1; while (k > 0 && stack[k].name !== name) k--;
      if (k > 0) { while (stack.length > k + 1) { const x = stack.pop(); x.end = i; x.implicit = true; } const x = stack.pop(); x.closeStart = i; x.end = e; }
      i = e; continue;
    }
    if (/[a-zA-Z]/.test(src[i + 1] || '')) {
      const el = readOpen(src, i);
      el.parent = top(); el.children = [];
      implicitClose(stack, el);
      el.parent = top();
      top().children.push(el);
      i = el.openEnd;
      if (VOID.has(el.name) || el.selfClosing) { el.end = el.openEnd; el.children = []; continue; }
      if (RAW.has(el.name)) {
        const close = src.toLowerCase().indexOf('</' + el.name, i);
        const ce = close < 0 ? src.length : close;
        el.children.push({ type: 'raw', start: i, end: ce, raw: src.slice(i, ce), parent: el });
        const gt = src.indexOf('>', ce); el.closeStart = ce; el.end = gt < 0 ? src.length : gt + 1; i = el.end; continue;
      }
      stack.push(el); continue;
    }
    pushText(i, i + 1); i++;
  }
  while (stack.length > 1) { const x = stack.pop(); x.end = src.length; x.implicit = true; }
  return root;
}
function nextLt(src, i) { let j = i + 1; for (; j < src.length; j++) { if (src[j] === '<' && /[a-zA-Z\/!]/.test(src[j + 1] || '')) return j; } return src.length; }
function implicitClose(stack, el) {
  const t = stack[stack.length - 1];
  if (t && t.name === 'li' && el.name === 'li') { stack.pop(); t.end = el.start; t.implicit = true; }
  if (t && t.name === 'p' && /^(div|p|ul|ol|h[1-6]|table|section|form|pre|blockquote)$/.test(el.name)) { stack.pop(); t.end = el.start; t.implicit = true; }
}
function readOpen(src, i) {
  let j = i + 1; while (j < src.length && /[^\s\/>]/.test(src[j])) j++;
  const name = src.slice(i + 1, j).toLowerCase();
  const attrs = [];
  let selfClosing = false;
  for (;;) {
    while (j < src.length && /\s/.test(src[j])) j++;
    if (src[j] === '>') { j++; break; }
    if (src[j] === '/' && src[j + 1] === '>') { selfClosing = true; j += 2; break; }
    if (src[j] === '/') { j++; continue; }
    if (j >= src.length) break;
    const as = j; while (j < src.length && /[^\s=\/>]/.test(src[j])) j++;
    const an = src.slice(as, j); let value = null, vs = j, ve = j, quote = '';
    let k = j; while (k < src.length && /\s/.test(src[k])) k++;
    if (src[k] === '=') {
      k++; while (k < src.length && /\s/.test(src[k])) k++;
      if (src[k] === '"' || src[k] === "'") { quote = src[k]; const q = src.indexOf(quote, k + 1); vs = k + 1; ve = q < 0 ? src.length : q; value = src.slice(vs, ve); j = ve + 1; }
      else { vs = k; while (k < src.length && /[^\s>]/.test(src[k])) k++; ve = k; value = src.slice(vs, ve); j = k; }
    }
    attrs.push({ name: an.toLowerCase(), value, start: as, vs, ve, quote });
  }
  return { type: 'el', name, attrs, start: i, openEnd: j, selfClosing };
}
export const attr = (el, n) => { const a = el.attrs.find((x) => x.name === n); return a ? a.value : undefined; };

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', mdash: '—', ndash: '–', hellip: '…', rarr: '→', larr: '←', middot: '·', times: '×', pound: '£', euro: '€', copy: '©', reg: '®', trade: '™', bull: '•', check: '✓', lsaquo: '‹', rsaquo: '›', laquo: '«', raquo: '»', uarr: '↑', darr: '↓', harr: '↔', deg: '°', eacute: 'é', shy: '­', thinsp: ' ', ensp: ' ', emsp: ' ', plusmn: '±', frac12: '½', sect: '§', para: '¶', checkmark: '✓', zwj: '‍' };
export function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (m, e) => {
    if (e[0] === '#') { const c = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); try { return String.fromCodePoint(c); } catch { return m; } }
    return e in ENT ? ENT[e] : (e.toLowerCase() in ENT ? ENT[e.toLowerCase()] : m);
  });
}
// Encode a decoded string back into safe HTML text for writing into the source (only what is required).
export const encodeText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const encodeAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
