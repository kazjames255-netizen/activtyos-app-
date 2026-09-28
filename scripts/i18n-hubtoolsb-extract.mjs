// Extracts candidate UI strings from the generated legacy widgets (lesson/widgets/legacy/*.gen.ts) for translation.
// Output: lib/i18n/messages/areas/hubtoolsb-legacy/source.json  { "<english or pattern with {0}>": ["widgetId", ...] }
import ts from "typescript";
import fs from "node:fs";
import path from "node:path";

const DIR = "features/learninghub/lesson/widgets/legacy";
const out = new Map();
const add = (s, w, isText = false) => {
  s = s.replace(/\s+/g, " ").trim();
  if (s.length < 2 || !/\p{L}{2}/u.test(s)) return;
  if (/^[\w#.\-:/\[\]=,%()> +*~"'|]*$/.test(s) && !/\s/.test(s) && !/^[A-Z][a-z]+$/.test(s) && !(isText && /^[a-z]{4,}$/.test(s))) return; // ids, classes, css-ish single tokens
  if (/[{};]/.test(s.replace(/\{\d+\}/g, "")) && /(=>|function|const |return |;\s)/.test(s)) return; // code
  if (/^[.#]|\[data-|\[id|;\s*[a-z-]+:|^[a-z-]+:\s*[^ ]+;?$/.test(s) && !/[A-Z][a-z]+ [a-z]+/.test(s)) return;
  if (/^(https?:|data:|#[0-9a-f]{3,8}$|M[\d .\-,a-zA-Z]+$)/i.test(s)) return;
  if (/^(rgba?|hsla?|var|translate|rotate|scale|calc)\(/.test(s)) return;
  if (/^[\d\s.,+\-×÷=/:%°]+$/.test(s)) return;
  (out.get(s) ?? out.set(s, new Set()).get(s)).add(w);
};
// text nodes + translatable attributes from an html-ish string where ${} became «n». Chunks are split at every NON-inline tag, so a
// sentence with <b>bold</b> stays whole; inline tags are kept WITHOUT attributes (the runtime re-attaches the original elements).
const INLINE = new Set(["b", "i", "em", "strong", "u", "sub", "sup", "code", "small", "span", "kbd", "mark", "a"]);
function fromHtml(str, w) {
  const attrRe = /\b(?:aria-label|title|placeholder|alt)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m; while ((m = attrRe.exec(str))) add(m[1] ?? m[2], w);
  const noStyle = str.replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<script[\s\S]*?<\/script>/g, " ");
  let chunk = "";
  const flush = () => { const t = chunk.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"'); chunk = ""; if (t.replace(/<[^>]*>/g, "").trim()) add(t, w, true); };
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/?)>/g; let last = 0;
  while ((m = re.exec(noStyle))) {
    chunk += noStyle.slice(last, m.index); last = re.lastIndex;
    const tag = m[2].toLowerCase();
    if (INLINE.has(tag) && !m[3]) chunk += `<${m[1]}${tag}>`; else flush();
  }
  chunk += noStyle.slice(last); flush();
}
const pat = (s) => { let i = 0; return s.replace(/«\d+»/g, () => `{${i++}}`); };
function tmplText(node, sf) {
  if (ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  let i = 0, s = node.head.text;
  for (const sp of node.templateSpans) { s += `«${i++}»` + sp.literal.text; }
  return s;
}
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".gen.ts") && x !== "manifest.gen.ts")) {
  const w = f.replace(".gen.ts", "");
  const src = fs.readFileSync(path.join(DIR, f), "utf8");
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true);
  const visit = (n) => {
    let text = null;
    if (ts.isStringLiteral(n)) text = n.text;
    else if (ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateExpression(n)) text = tmplText(n, sf);
    if (text !== null) {
      if (/<[a-zA-Z!\/][^>]*>/.test(text)) fromHtml(text, w); else add(text, w);
      if (ts.isTemplateExpression(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isStringLiteral(n)) { /* no recursion into spans handled below */ }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}
const obj = {};
for (const [k, v] of [...out].sort((a, b) => a[0].localeCompare(b[0]))) obj[pat(k)] = [...v];
fs.writeFileSync("lib/i18n/messages/areas/hubtoolsb-legacy/source.json", JSON.stringify(obj, null, 1));
console.log(Object.keys(obj).length, "candidates");
