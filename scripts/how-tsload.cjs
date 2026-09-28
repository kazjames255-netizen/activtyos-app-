// Tiny TS loader for node scripts (esbuild/tsx are broken on this machine): require("./how-tsload.cjs")(path) -> module exports.
const ts = require("typescript"), fs = require("fs"), path = require("path"), Module = require("module");
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const out = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const m = { exports: {} }; cache.set(file, m);
  const req = (p) => {
    if (p.startsWith(".") || p.startsWith("@/")) {
      const base = p.startsWith("@/") ? path.join(process.cwd(), p.slice(2)) : path.resolve(path.dirname(file), p);
      for (const c of [base + ".ts", base + ".tsx", path.join(base, "index.ts"), base]) if (fs.existsSync(c) && fs.statSync(c).isFile()) return load(c);
      throw new Error("cannot resolve " + p + " from " + file);
    }
    return require(p);
  };
  new Function("exports", "require", "module", "__filename", "__dirname", out)(m.exports, req, m, file, path.dirname(file));
  return m.exports;
}
module.exports = load;
