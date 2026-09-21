// Validates only this pack (the shared validator aborts if another pack is mid-edit).
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateTopic } from "../validate";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const seen = new Set<string>();
let n = 0;
for (const f of readdirSync(HERE).filter((x) => x.endsWith(".ts") && !x.startsWith("_")).sort()) {
  const t = (await import(pathToFileURL(path.join(HERE, f)).href)).TOPIC;
  const errs = validateTopic(t, seen);
  n += errs.length;
  for (const e of errs) console.error(e);
}
console.log(n + " problem(s)");
